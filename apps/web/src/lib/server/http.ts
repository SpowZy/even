import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  DuplicateIdempotencyError,
  PrevHashMismatchError,
  RunClosedError,
  RunNotFoundError,
  SeqGapError,
} from "@even/store";
import { WriteAuthError } from "./auth";

export function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export function rateLimited(): NextResponse {
  return jsonError("rate_limit_exceeded", 429);
}

/** Maps domain errors to consistent `{ error }` JSON responses. */
export function handleError(err: unknown): NextResponse {
  if (err instanceof WriteAuthError) return jsonError("unauthorized", 401);
  if (err instanceof ZodError) return jsonError("invalid_body", 400);
  if (err instanceof RunNotFoundError) return jsonError("run_not_found", 404);
  if (
    err instanceof DuplicateIdempotencyError ||
    err instanceof SeqGapError ||
    err instanceof PrevHashMismatchError ||
    err instanceof RunClosedError
  ) {
    return jsonError(err.message, 409);
  }
  if (err instanceof SyntaxError) return jsonError("invalid_json", 400);
  const message = err instanceof Error ? err.message : "internal_error";
  return jsonError(message, 500);
}
