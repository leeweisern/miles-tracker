import type { Context } from "hono";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WRAPPED_ERROR_RE = /\(\w+\)\s+(\w+)/;

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
  const status = statusFromError(err);
  const body = bodyFromError(err);
  if (status >= 500) {
    console.error("[error-handler]", { status, error: err });
  }
  return c.json(body, status);
}

function statusFromError(err: unknown): 400 | 404 | 500 {
  const tag = getTag(err);

  // Map Effect tagged errors to HTTP status codes
  if (tag === "ValidationError" || tag === "ParseError") {
    return 400;
  }
  if (tag === "NotFoundError") {
    return 404;
  }

  // Fallback to 500 for unknown errors
  return 500;
}

function bodyFromError(err: unknown): ErrorBody {
  const tag = getTag(err);
  const message = getMessage(err);

  // If we have both tag and message, use them
  if (tag && message) {
    return errorBody(tag, message);
  }

  // If we have just a message, use the tag (or "INTERNAL_ERROR")
  if (message) {
    return errorBody(tag || "INTERNAL_ERROR", message);
  }

  // Last resort
  return errorBody("INTERNAL_ERROR", "Unknown error");
}

function getTag(err: unknown): string | null {
  if (!err || typeof err !== "object") {
    return null;
  }

  const value = err as Record<string, unknown>;

  // Check Effect Tagged error format (_tag property)
  if (typeof value._tag === "string") {
    return value._tag;
  }

  // Check if error message contains a wrapped error tag like "(FiberFailure) ValidationError"
  const msgStr = String(value);
  if (msgStr && msgStr !== "[object Object]") {
    const match = msgStr.match(WRAPPED_ERROR_RE);
    if (match?.[1]) {
      return match[1];
    }
  }

  // Try message property as fallback
  if (typeof value.message === "string") {
    const match = value.message.match(WRAPPED_ERROR_RE);
    if (match?.[1]) {
      return match[1];
    }
  }

  // Fallback: check error name
  if (typeof value.name === "string") {
    return value.name;
  }

  return null;
}

function getMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") {
    return null;
  }

  const value = err as Record<string, unknown>;

  // Try message property first (standard Error)
  if (typeof value.message === "string" && value.message.trim()) {
    const msg = value.message.trim();
    // Extract the actual message from wrapped format like "(FiberFailure) ValidationError: message"
    // Return everything after the first colon, or the whole message if no wrapping
    const colonIndex = msg.indexOf(":");
    if (colonIndex > 0) {
      const afterColon = msg.slice(colonIndex + 1).trim();
      if (afterColon) {
        return afterColon;
      }
    }
    return msg;
  }

  // Try toString as fallback
  try {
    const str = String(value);
    if (str && str !== "[object Object]") {
      return str;
    }
  } catch {
    // ignore
  }

  return null;
}
