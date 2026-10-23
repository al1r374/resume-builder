import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { config as loadEnv } from "dotenv";
import { z } from "zod";
import { createAiProvider } from "@resume-builder/ai-provider";
import { generateTailoredResume } from "@resume-builder/core";
import { closePdfBrowser, renderResumePdf } from "@resume-builder/pdf-renderer";
import {
  GenerateResumeRequestSchema,
  isAppError,
  toSafeClientError,
} from "@resume-builder/shared";
import {
  assertAllowedOrigin,
  assertSafeHostHeader,
  buildCorsOriginChecker,
  parseAllowedExtensionIds,
  type SecurityConfig,
} from "./security.js";

loadEnv();

const EnvSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(8787),
  PROFILE_PATH: z.string().default("./assets/profile.yaml"),
  OUTPUT_DIR: z.string().default("./output"),
  ALLOWED_EXTENSION_IDS: z.string().optional(),
  MAX_JOB_DESCRIPTION_LENGTH: z.coerce.number().int().positive().default(50_000),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  AI_PROVIDER: z.string().optional(),
});

const env = EnvSchema.parse(process.env);
const security: SecurityConfig = {
  host: env.HOST,
  allowedExtensionIds: parseAllowedExtensionIds(env.ALLOWED_EXTENSION_IDS),
  allowNullOrigin: false,
};

if (env.HOST !== "127.0.0.1" && env.HOST !== "localhost") {
  console.warn(
    `Warning: HOST is set to ${env.HOST}. Prefer 127.0.0.1 so the service is not exposed on other interfaces.`,
  );
}

const app = Fastify({
  logger: {
    level: "info",
    redact: ["req.headers.authorization", "body.jobDescription"],
  },
  bodyLimit: Math.max(env.MAX_JOB_DESCRIPTION_LENGTH + 4096, 64_000),
  requestTimeout: env.REQUEST_TIMEOUT_MS,
});

await app.register(cors, {
  origin: buildCorsOriginChecker(security),
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  maxAge: 600,
});

app.addHook("onRequest", async (request) => {
  assertSafeHostHeader(request, env.HOST === "localhost" ? "localhost" : "127.0.0.1", env.PORT);
  if (request.method !== "OPTIONS" && request.url.startsWith("/v1/")) {
    assertAllowedOrigin(request, security);
  }
});

app.get("/health", async () => ({
  ok: true,
  service: "resume-builder-local",
  provider: process.env.AI_PROVIDER ?? "mock",
}));

app.post("/v1/generate-resume", async (request, reply) => {
  const parsed = GenerateResumeRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({
      code: "INVALID_REQUEST",
      message: "Request validation failed.",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  if (parsed.data.jobDescription.length > env.MAX_JOB_DESCRIPTION_LENGTH) {
    return reply.code(400).send({
      code: "JOB_DESCRIPTION_TOO_LONG",
      message: `Job description exceeds maximum length of ${env.MAX_JOB_DESCRIPTION_LENGTH} characters.`,
    });
  }

  const provider = createAiProvider({ provider: env.AI_PROVIDER });
  const profilePath = path.resolve(env.PROFILE_PATH);
  const outputDir = path.resolve(env.OUTPUT_DIR);

  const result = await generateTailoredResume({
    profilePath,
    jobDescription: parsed.data.jobDescription,
    template: parsed.data.template,
    language: parsed.data.language,
    provider,
  });

  const allowedPhotoDirs = [
    path.dirname(profilePath),
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), "assets"),
  ];

  const rendered = await renderResumePdf({
    resume: result.resume,
    template: parsed.data.template,
    photoPath: result.photoPath,
    allowedPhotoDirs,
    validate: true,
  });

  await mkdir(outputDir, { recursive: true });
  const fileName = `resume-${parsed.data.template}-${randomUUID().slice(0, 8)}.pdf`;
  const outputPath = path.join(outputDir, fileName);
  await writeFile(outputPath, rendered.pdf);

  return reply.send({
    ok: true,
    fileName,
    // PDF as base64 for extension download — never includes API keys.
    pdfBase64: rendered.pdf.toString("base64"),
    matchReport: result.matchReport,
    pageCount: rendered.validation?.pageCount ?? null,
    template: parsed.data.template,
    language: parsed.data.language,
  });
});

app.setErrorHandler((error, _request, reply) => {
  const err = error as { code?: string; statusCode?: number; message?: string };
  if (err.code === "FST_ERR_CTP_INVALID_JSON_BODY" || err.statusCode === 400) {
    return reply.code(400).send({
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
    });
  }
  const safe = toSafeClientError(error);
  if (!isAppError(error)) {
    app.log.error({ err: error }, "Unhandled error");
  } else {
    app.log.warn({ code: error.code }, error.message);
  }
  reply.code(safe.statusCode).send({
    code: safe.code,
    message: safe.message,
  });
});

const shutdown = async () => {
  await closePdfBrowser();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: env.HOST, port: env.PORT });
console.log(`Resume builder local service listening on http://${env.HOST}:${env.PORT}`);
console.log(`Profile: ${path.resolve(env.PROFILE_PATH)}`);
console.log(`AI provider: ${env.AI_PROVIDER ?? "mock"}`);
