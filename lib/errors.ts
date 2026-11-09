export type ErrorDetails = Readonly<Record<string, readonly string[]>>;

export abstract class ApplicationError extends Error {
  public readonly name: string;

  protected constructor(
    name: string,
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = name;
  }
}

export class ValidationError extends ApplicationError {
  public constructor(message: string, details?: ErrorDetails) {
    super("ValidationError", "VALIDATION_ERROR", 400, message, details);
  }
}

export class AuthenticationError extends ApplicationError {
  public constructor(message = "Authentication is required") {
    super("AuthenticationError", "UNAUTHENTICATED", 401, message);
  }
}

export class AuthorizationError extends ApplicationError {
  public constructor(
    message = "You are not authorized to perform this action",
  ) {
    super("AuthorizationError", "FORBIDDEN", 403, message);
  }
}

export class ResourceNotFoundError extends ApplicationError {
  public constructor(message = "The requested resource was not found") {
    super("ResourceNotFoundError", "NOT_FOUND", 404, message);
  }
}

export class ConflictError extends ApplicationError {
  public constructor(message: string) {
    super("ConflictError", "CONFLICT", 409, message);
  }
}

export class ConfigurationError extends ApplicationError {
  public constructor(message: string) {
    super("ConfigurationError", "CONFIGURATION_ERROR", 500, message);
  }
}

export class InvariantViolationError extends ApplicationError {
  public constructor(message: string) {
    super("InvariantViolationError", "INVARIANT_VIOLATION", 500, message);
  }
}

export class ServiceUnavailableError extends ApplicationError {
  public constructor(
    message = "The requested service is temporarily unavailable",
  ) {
    super("ServiceUnavailableError", "SERVICE_UNAVAILABLE", 503, message);
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}
