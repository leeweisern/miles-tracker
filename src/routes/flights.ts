import { Effect } from "effect";
import type { Context } from "hono";
import { Hono } from "hono";
import { Database } from "../db/client";
import type { Bindings, Variables } from "../env";
import { ParseError } from "../lib/errors";
import { handleRouteError } from "../lib/http";
import {
  asRecord,
  asString,
  requireNumber,
  toNullableNumber,
  toNullableString,
} from "../lib/parse";
import {
  type DeleteFlightsInput,
  deleteFlights,
  getFlightStats,
  type SearchFlightsInput,
  searchFlights,
  type UpsertFlightInput,
  upsertFlights,
} from "../services/flights";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const INTEGER_QUERY_RE = /^-?\d+$/;

app.get("/flights", async (c) => {
  const program = searchFlights(parseSearchQuery(c)).pipe(
    Effect.provideService(Database, c.env.DB)
  );

  try {
    const result = await Effect.runPromise(program);
    return c.json({ ok: true, data: result.data, meta: result.meta });
  } catch (err) {
    return handleRouteError(c, err);
  }
});

app.post("/flights", async (c) => {
  const program = Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: () => c.req.json(),
      catch: () =>
        new ParseError({ message: "Request body is not valid JSON" }),
    });

    const records = Array.isArray(body) ? body : [body];
    const result = yield* upsertFlights(
      records.map((row) => toFlightInput(row))
    );

    return { ok: true, data: result };
  }).pipe(Effect.provideService(Database, c.env.DB));

  try {
    const result = await Effect.runPromise(program);
    return c.json(result);
  } catch (err) {
    return handleRouteError(c, err);
  }
});

app.delete("/flights", async (c) => {
  const program = deleteFlights(parseDeleteQuery(c)).pipe(
    Effect.provideService(Database, c.env.DB)
  );

  try {
    const result = await Effect.runPromise(program);
    return c.json({ ok: true, data: result });
  } catch (err) {
    return handleRouteError(c, err);
  }
});

app.get("/flights/stats", async (c) => {
  const program = getFlightStats(parseSearchQuery(c)).pipe(
    Effect.provideService(Database, c.env.DB)
  );

  try {
    const result = await Effect.runPromise(program);
    return c.json({ ok: true, data: result });
  } catch (err) {
    return handleRouteError(c, err);
  }
});

export const flightRoutes = app;

function parseSearchQuery(c: Context): SearchFlightsInput {
  return {
    destination: c.req.query("destination") ?? "",
    origin: c.req.query("origin") ?? "KUL",
    date: c.req.query("date") ?? undefined,
    dateFrom: c.req.query("date_from") ?? undefined,
    dateTo: c.req.query("date_to") ?? undefined,
    cabin: c.req.query("cabin") ?? undefined,
    tier: c.req.query("tier") ?? undefined,
    programId: c.req.query("program_id") ?? undefined,
    availableOnly: parseOptionalBooleanQuery(c.req.query("available_only")),
    pointsMax: parseOptionalIntQuery(c.req.query("points_max")),
    pointsMin: parseOptionalIntQuery(c.req.query("points_min")),
    sort: c.req.query("sort") ?? undefined,
    limit: parseOptionalIntQuery(c.req.query("limit")),
    offset: parseOptionalIntQuery(c.req.query("offset")),
  };
}

function parseDeleteQuery(c: Context): DeleteFlightsInput {
  return {
    programId: c.req.query("program_id") ?? "",
    destination: c.req.query("destination") ?? "",
    origin: c.req.query("origin") ?? "KUL",
    dateFrom: c.req.query("date_from") ?? undefined,
    dateTo: c.req.query("date_to") ?? undefined,
    cabin: c.req.query("cabin") ?? undefined,
  };
}

function toFlightInput(value: unknown): UpsertFlightInput {
  const payload = asRecord(value);

  return {
    programId: asString(payload.program_id),
    origin: toNullableString(payload.origin),
    destination: asString(payload.destination),
    flightNumber: asString(payload.flight_number),
    departureDate: asString(payload.departure_date),
    departureTime: asString(payload.departure_time),
    arrivalTime: asString(payload.arrival_time),
    arrivalDayOffset: requireNumber(payload.arrival_day_offset),
    durationMinutes: requireNumber(payload.duration_minutes),
    routeType: asString(payload.route_type),
    cabin: asString(payload.cabin),
    tier: asString(payload.tier),
    points: requireNumber(payload.points),
    available: parseOptionalBooleanBody(payload.available),
    seatsLeft:
      payload.seats_left == null ? null : toNullableNumber(payload.seats_left),
    taxesMyr: requireNumber(payload.taxes_myr),
    cashEquivalentMyr:
      payload.cash_equivalent_myr == null
        ? null
        : toNullableNumber(payload.cash_equivalent_myr),
    notes: toNullableString(payload.notes),
    scrapedAt: toNullableString(payload.scraped_at),
  };
}

function parseOptionalIntQuery(
  value: string | undefined
): number | undefined | null {
  if (value == null) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (!INTEGER_QUERY_RE.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseOptionalBooleanQuery(
  value: string | undefined
): boolean | undefined | null {
  if (value == null) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "") {
    return undefined;
  }
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function parseOptionalBooleanBody(value: unknown): boolean | undefined | null {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}
