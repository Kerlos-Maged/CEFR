import type { ZodError } from "zod";

import type { ErrorCode } from "@/lib/db/errors";
import { DalError } from "@/lib/db/errors";

/** Mirrors docs/architecture/api-contracts.md §2. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };
    };

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFailure<T = never>(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } };
}

export function zodToFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * Runs an action body and converts thrown errors into the shared `ActionResult` envelope.
 * `DalError` codes/messages are surfaced (they are authored, safe, non-leaking); everything
 * else collapses to a generic `INTERNAL` message so stack traces and database details never
 * reach the client.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
  context: string,
): Promise<ActionResult<T>> {
  try {
    return actionSuccess(await fn());
  } catch (error) {
    if (error instanceof DalError) {
      return actionFailure(error.code, error.message);
    }
    console.error(`[action:${context}]`, error instanceof Error ? error.message : "unknown error");
    return actionFailure("INTERNAL", "Something went wrong. Please try again.");
  }
}

/**
 * Maps a Postgres error raised by the workflow functions or RLS to a safe `DalError`.
 * Recognised SQLSTATEs: 42501 (RLS/role denial), P0001/P0002 (illegal transition / not found),
 * 22023 (invalid parameter), 23505 (unique violation).
 */
export function mapDatabaseError(
  error: { code?: string; message?: string },
  fallback: string,
): DalError {
  switch (error.code) {
    case "42501":
      return new DalError("FORBIDDEN", "You do not have permission to perform this action.");
    case "P0002":
      return new DalError("NOT_FOUND", "The requested record does not exist.");
    case "P0001":
      return new DalError("ILLEGAL_TRANSITION", "That state change is not allowed.");
    case "22023":
      return new DalError("VALIDATION", "The submitted values are not valid.");
    case "23505":
      return new DalError("CONFLICT", "That record already exists.");
    default:
      return new DalError("INTERNAL", fallback);
  }
}
