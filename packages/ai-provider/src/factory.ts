import { AppError, type AiProviderName } from "@resume-builder/shared";
import { CursorAgentProvider } from "./cursor-provider.js";
import { MockAiProvider } from "./mock-provider.js";
import { OpenAiCompatibleProvider } from "./openai-provider.js";
import type { AiProvider } from "./types.js";

export interface CreateProviderOptions {
  provider?: AiProviderName | string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export function createAiProvider(options: CreateProviderOptions = {}): AiProvider {
  const env = options.env ?? process.env;
  const name = (options.provider ?? env.AI_PROVIDER ?? "mock").toLowerCase();

  switch (name) {
    case "mock":
      return new MockAiProvider();
    case "openai":
      return new OpenAiCompatibleProvider({
        apiKey: env.OPENAI_API_KEY ?? "",
        baseUrl: env.OPENAI_BASE_URL,
        model: env.OPENAI_MODEL,
      });
    case "cursor":
      return new CursorAgentProvider({
        apiKey: env.CURSOR_API_KEY ?? "",
        model: env.CURSOR_MODEL,
        cwd: options.cwd,
      });
    default:
      throw new AppError(
        "AI_PROVIDER_MISCONFIGURED",
        `Unknown AI provider "${name}". Use mock, openai, or cursor.`,
        { statusCode: 500 },
      );
  }
}
