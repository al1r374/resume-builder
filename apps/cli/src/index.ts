#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { config as loadEnv } from "dotenv";
import { createAiProvider } from "@resume-builder/ai-provider";
import { generateTailoredResume, parseProfileYaml } from "@resume-builder/core";
import { closePdfBrowser, renderResumePdf } from "@resume-builder/pdf-renderer";
import {
  AppError,
  ResumeLanguageSchema,
  TemplateIdSchema,
  isAppError,
  type AiProviderName,
} from "@resume-builder/shared";
import { validateProfileData } from "@resume-builder/core";
import { parse as parseYaml } from "yaml";

loadEnv();

const program = new Command();

program
  .name("resume-builder")
  .description("AI-powered resume generator (CLI)")
  .version("1.0.0");

program
  .command("validate-profile")
  .description("Validate a candidate profile YAML file")
  .requiredOption("--profile <path>", "Path to profile.yaml")
  .action(async (opts: { profile: string }) => {
    try {
      const profilePath = path.resolve(opts.profile);
      const raw = await readFile(profilePath, "utf8").catch(() => {
        throw new AppError("PROFILE_NOT_FOUND", `Profile not found: ${profilePath}`);
      });
      const data = parseYaml(raw);
      const result = validateProfileData(data);
      if (!result.ok) {
        console.error("Profile validation failed:");
        for (const issue of result.issues) {
          console.error(`  - ${issue.path}: ${issue.message}`);
        }
        process.exitCode = 1;
        return;
      }
      // Confirm full schema parse succeeds
      parseProfileYaml(raw, profilePath);
      if (result.issues.length) {
        console.log("Profile is usable with warnings:");
        for (const issue of result.issues) {
          console.log(`  - ${issue.path}: ${issue.message}`);
        }
      } else {
        console.log("Profile is valid.");
      }
      const name = `${result.profile?.personal.first_name} ${result.profile?.personal.last_name}`;
      console.log(`Candidate: ${name}`);
      console.log(`Experience entries: ${result.profile?.experience.length ?? 0}`);
      console.log(`Education entries: ${result.profile?.education.length ?? 0}`);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command("generate")
  .description("Generate a tailored resume PDF")
  .requiredOption("--profile <path>", "Path to profile.yaml")
  .requiredOption("--job <path>", "Path to job description text file")
  .option("--template <id>", "Template: modern | ats", "modern")
  .option("--language <code>", "Resume language", "en")
  .option("--output <path>", "Output PDF path", "./output/resume.pdf")
  .option("--match-report <path>", "Optional JSON match report output path")
  .option("--provider <name>", "AI provider: mock | openai | cursor")
  .option("--force", "Overwrite existing output file", false)
  .option("--no-validate-pdf", "Skip PDF text validation")
  .action(async (opts: {
    profile: string;
    job: string;
    template: string;
    language: string;
    output: string;
    matchReport?: string;
    provider?: string;
    force?: boolean;
    validatePdf?: boolean;
  }) => {
    try {
      const template = TemplateIdSchema.parse(opts.template);
      const language = ResumeLanguageSchema.parse(opts.language);
      const profilePath = path.resolve(opts.profile);
      const jobPath = path.resolve(opts.job);
      const outputPath = path.resolve(opts.output);

      await access(profilePath).catch(() => {
        throw new AppError("PROFILE_NOT_FOUND", `Profile not found: ${profilePath}`);
      });
      await access(jobPath).catch(() => {
        throw new AppError("JOB_NOT_FOUND", `Job description file not found: ${jobPath}`);
      });

      if (!opts.force) {
        const exists = await access(outputPath).then(() => true).catch(() => false);
        if (exists) {
          throw new AppError(
            "OUTPUT_EXISTS",
            `Output file already exists: ${outputPath}. Use --force to overwrite.`,
          );
        }
      }

      const jobDescription = await readFile(jobPath, "utf8");
      const provider = createAiProvider({
        provider: (opts.provider as AiProviderName | undefined) ?? process.env.AI_PROVIDER,
      });

      console.log(`Using AI provider: ${provider.name}`);
      console.log("Analyzing job and tailoring resume...");

      const result = await generateTailoredResume({
        profilePath,
        jobDescription,
        template,
        language,
        provider,
      });

      console.log(`Match assessment: ${result.matchReport.assessment}`);
      console.log("Rendering PDF...");

      const allowedPhotoDirs = [
        path.dirname(profilePath),
        path.resolve(process.cwd()),
        path.resolve(process.cwd(), "assets"),
      ];

      const rendered = await renderResumePdf({
        resume: result.resume,
        template,
        photoPath: result.photoPath,
        allowedPhotoDirs,
        validate: opts.validatePdf !== false,
      });

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, rendered.pdf);
      console.log(`PDF written: ${outputPath}`);
      if (rendered.validation) {
        console.log(`Pages: ${rendered.validation.pageCount}`);
      }

      if (opts.matchReport) {
        const reportPath = path.resolve(opts.matchReport);
        await mkdir(path.dirname(reportPath), { recursive: true });
        await writeFile(reportPath, JSON.stringify(result.matchReport, null, 2), "utf8");
        console.log(`Match report written: ${reportPath}`);
      }
    } catch (error) {
      handleError(error);
    } finally {
      await closePdfBrowser();
    }
  });

function handleError(error: unknown): never {
  if (isAppError(error)) {
    console.error(`Error [${error.code}]: ${error.message}`);
    if (error.details && process.env.DEBUG === "1") {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exit(error.statusCode >= 500 ? 2 : 1);
  }
  console.error("Unexpected error:", error instanceof Error ? error.message : error);
  process.exit(2);
}

program.parseAsync(process.argv);
