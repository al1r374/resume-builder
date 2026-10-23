export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: { statusCode?: number; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.statusCode = options?.statusCode ?? 400;
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toSafeClientError(error: unknown): { code: string; message: string; statusCode: number } {
  if (isAppError(error)) {
    return { code: error.code, message: error.message, statusCode: error.statusCode };
  }
  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
    statusCode: 500,
  };
}
