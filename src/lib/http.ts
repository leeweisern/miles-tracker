import type { Context } from "hono";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value);
}

export function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

export function handleRouteError(c: Context, err: unknown): Response {
  return c.json(bodyFromError(err), statusFromError(err));
}

function statusFromError(err: unknown): 400 | 404 | 500 {
  const tag = getTag(err);
  if (!tag) {
    return 500;
  }
  if (tag === "ValidationError" || tag === "ParseError") {
    return 400;
  }
  if (tag === "NotFoundError") {
    return 404;
  }
  return 500;
}

function bodyFromError(err: unknown): ErrorBody {
  const tag = getTag(err);
  const message = getMessage(err);
  if (tag && message) {
    return errorBody(tag, message);
  }
  return errorBody("INTERNAL_ERROR", message || "Unknown error");
}

function getTag(err: unknown): string | null {
  if (!err || typeof err !== "object") {
    return null;
  }
  const value = err as Record<string, unknown>;
  return typeof value._tag === "string" ? value._tag : null;
}

function getMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") {
    return null;
  }
  const value = err as Record<string, unknown>;
  return typeof value.message === "string" ? value.message : null;
}
