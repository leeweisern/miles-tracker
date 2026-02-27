interface Env {
  MILES_AUTH_TOKEN: string;
  MILES_TRACKER: Fetcher;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

const ALLOWED_PATHS = new Set(["flights", "flights/stats", "programs"]);

const STRIP_HEADERS = new Set([
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-expose-headers",
  "access-control-max-age",
  "access-control-allow-credentials",
]);

function sanitizeHeaders(upstream: Headers): Headers {
  const clean = new Headers();
  for (const [key, value] of upstream.entries()) {
    if (!STRIP_HEADERS.has(key.toLowerCase())) {
      clean.set(key, value);
    }
  }
  clean.set("Cache-Control", "private, no-store");
  return clean;
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: JSON_HEADERS,
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonError(
      405,
      "METHOD_NOT_ALLOWED",
      "Only GET requests are allowed"
    );
  }

  const url = new URL(context.request.url);
  const subPath = url.pathname.replace("/api/", "");

  if (!ALLOWED_PATHS.has(subPath)) {
    return jsonError(403, "FORBIDDEN", `Path not allowed: ${subPath}`);
  }

  const upstreamPath = `/api/${subPath}${url.search}`;

  try {
    const upstreamReq = new Request(`https://miles-tracker${upstreamPath}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${context.env.MILES_AUTH_TOKEN}`,
      },
    });
    const resp = await context.env.MILES_TRACKER.fetch(upstreamReq);
    return new Response(resp.body, {
      status: resp.status,
      headers: sanitizeHeaders(resp.headers),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("BFF upstream error:", message);
    return jsonError(502, "UPSTREAM_ERROR", "Upstream worker unreachable");
  }
};
