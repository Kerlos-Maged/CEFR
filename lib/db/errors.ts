/**
 * Error codes shared by the data-access layer and (later) server actions.
 * Mirrors docs/architecture/api-contracts.md §10 so HTTP status mapping stays in one place.
 */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "ILLEGAL_TRANSITION",
  "RATE_LIMITED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DalError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DalError";
    this.code = code;
  }
}
