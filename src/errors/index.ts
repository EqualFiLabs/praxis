export type ErrorCategory = "user" | "system" | "provider";

export class BaseError extends Error {
  public readonly category: ErrorCategory;
  public readonly cause?: unknown;

  constructor(message: string, category: ErrorCategory, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.category = category;
    this.cause = cause;
  }
}

export class UserError extends BaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "user", cause);
  }
}

export class SystemError extends BaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "system", cause);
  }
}

export class ProviderError extends BaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "provider", cause);
  }
}

export function classifyError(err: unknown): BaseError {
  if (err instanceof BaseError) {
    return err;
  }
  if (err instanceof Error) {
    return new SystemError(err.message, err);
  }
  return new SystemError("Unknown error", err);
}
