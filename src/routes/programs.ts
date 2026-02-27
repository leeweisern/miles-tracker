import { Effect } from "effect";
import { Hono } from "hono";
import { Database } from "../db/client";
import type { Bindings, Variables } from "../env";
import { ParseError } from "../lib/errors";
import { handleRouteError } from "../lib/http";
import { asRecord, asString, toNullableString } from "../lib/parse";
import { getPrograms, upsertProgram } from "../services/programs";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get("/programs", async (c) => {
  const program = getPrograms().pipe(Effect.provideService(Database, c.env.DB));

  try {
    const result = await Effect.runPromise(program);
    return c.json({ ok: true, data: result });
  } catch (err) {
    return handleRouteError(c, err);
  }
});

app.post("/programs", async (c) => {
  const program = Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: () => c.req.json(),
      catch: () =>
        new ParseError({ message: "Request body is not valid JSON" }),
    });

    const payload = asRecord(body);
    const result = yield* upsertProgram({
      id: asString(payload.id),
      name: asString(payload.name),
      airline: asString(payload.airline),
      alliance: toNullableString(payload.alliance),
    });

    return { ok: true, data: result };
  }).pipe(Effect.provideService(Database, c.env.DB));

  try {
    const result = await Effect.runPromise(program);
    return c.json(result);
  } catch (err) {
    return handleRouteError(c, err);
  }
});

export const programRoutes = app;
