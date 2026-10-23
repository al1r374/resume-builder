import type { FastifyRequest } from "fastify";
import { AppError } from "@resume-builder/shared";

export interface SecurityConfig {
  host: string;
  allowedExtensionIds: string[];
  allowNullOrigin: boolean;
}

export function parseAllowedExtensionIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assertSafeHostHeader(request: FastifyRequest, expectedHost: string, port: number): void {
  const hostHeader = request.headers.host;
  if (!hostHeader) {
    throw new AppError("BAD_HOST", "Missing Host header.", { statusCode: 400 });
  }
  const allowed = new Set([
    `${expectedHost}:${port}`,
    `localhost:${port}`,
    `127.0.0.1:${port}`,
  ]);
  if (!allowed.has(hostHeader)) {
    throw new AppError("BAD_HOST", "Unexpected Host header.", { statusCode: 400 });
  }
}

export function assertAllowedOrigin(
  request: FastifyRequest,
  config: SecurityConfig,
): void {
  const origin = request.headers.origin;
  // Non-browser clients (CLI curl) may omit Origin.
  if (!origin) {
    if (config.allowNullOrigin) return;
    // Allow missing Origin for same-machine tooling; still bind to loopback.
    return;
  }

  if (origin === "null" && config.allowNullOrigin) return;

  const chromeMatch = origin.match(/^chrome-extension:\/\/([a-p]{32})$/);
  if (chromeMatch) {
    const id = chromeMatch[1]!;
    if (config.allowedExtensionIds.length === 0) {
      // Dev convenience: any local extension ID is accepted when none configured.
      // Documented trust boundary — still loopback-only.
      return;
    }
    if (!config.allowedExtensionIds.includes(id)) {
      throw new AppError("ORIGIN_DENIED", "Extension origin is not allowed.", { statusCode: 403 });
    }
    return;
  }

  throw new AppError("ORIGIN_DENIED", "Request origin is not allowed.", { statusCode: 403 });
}

export function buildCorsOriginChecker(config: SecurityConfig) {
  return (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void): void => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (origin === "null" && config.allowNullOrigin) {
      cb(null, true);
      return;
    }
    const chromeMatch = origin.match(/^chrome-extension:\/\/([a-p]{32})$/);
    if (chromeMatch) {
      const id = chromeMatch[1]!;
      if (config.allowedExtensionIds.length === 0 || config.allowedExtensionIds.includes(id)) {
        cb(null, true);
        return;
      }
    }
    cb(null, false);
  };
}
