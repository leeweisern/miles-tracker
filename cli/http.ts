import { Data, Effect } from "effect";
import { AUTH_TOKEN, BASE_URL } from "./config";

type QueryValue = string | number | boolean | undefined;

export class FetchError extends Data.TaggedError("FetchError")<{
  message: string;
  status?: number;
  cause?: unknown;
}> {}

export function get(
  path: string,
  query?: Record<string, QueryValue>
): Effect.Effect<unknown, FetchError> {
  return request("GET", path, { query });
}

export function post(
  path: string,
  body: unknown
): Effect.Effect<unknown, FetchError> {
  return request("POST", path, { body });
}

export function del(
  path: string,
  query?: Record<string, QueryValue>
): Effect.Effect<unknown, FetchError> {
  return request("DELETE", path, { query });
}

function request(
  method: "GET" | "POST" | "DELETE",
  path: string,
  options: {
    query?: Record<string, QueryValue>;
    body?: unknown;
  }
): Effect.Effect<unknown, FetchError> {
  return Effect.tryPromise({
    try: async () => {
      const url = buildUrl(path, options.query);
      const headers: Record<string, string> = {
        authorization: `Bearer ${AUTH_TOKEN}`,
      };

      if (options.body !== undefined) {
        headers["content-type"] = "application/json";
      }

      const response = await fetch(url, {
        method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });

      const rawBody = await response.text();
      const parsedBody = parseResponseBody(rawBody);

      if (!response.ok) {
        throw new FetchError({
          message:
            extractErrorMessage(parsedBody) ??
            `Request failed with status ${response.status}`,
          status: response.status,
        });
      }

      if (isApiErrorBody(parsedBody)) {
        throw new FetchError({
          message: parsedBody.error.message,
          status: response.status,
        });
      }

      return parsedBody;
    },
    catch: (cause) => {
      if (cause instanceof FetchError) {
        return cause;
      }

      return new FetchError({
        message: "Failed to call miles-tracker API",
        cause,
      });
    },
  });
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path, BASE_URL);
  if (!query) {
    return url.toString();
  }

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function parseResponseBody(body: string): unknown {
  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function extractErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const nestedError = value.error;
  if (isRecord(nestedError) && typeof nestedError.message === "string") {
    return nestedError.message;
  }

  if (typeof value.message === "string") {
    return value.message;
  }

  return undefined;
}

function isApiErrorBody(
  value: unknown
): value is { error: { code?: string; message: string } } {
  if (!isRecord(value)) {
    return false;
  }

  const nestedError = value.error;
  return isRecord(nestedError) && typeof nestedError.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
