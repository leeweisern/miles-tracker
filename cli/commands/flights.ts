import { Effect } from "effect";
import {
  ArgError,
  expectNoPositionals,
  hasHelpFlag,
  optionalBooleanFlag,
  optionalFlag,
  optionalIntegerFlag,
  parseFlags,
  requiredFlag,
  requireOneOf,
  validateAllowedFlags,
} from "../args";
import { printResponse } from "../format";
import { del, get, post } from "../http";
import type { FetchError } from "../http";

const CABIN_OPTIONS = ["economy", "business", "first"] as const;
const SORT_OPTIONS = ["date", "points"] as const;
const MAX_UPSERT_RECORDS = 500;

const FLIGHTS_HELP = `Usage:
  mt flights search --destination <IATA> [--origin <IATA>] [--date <YYYY-MM-DD>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>] [--tier <saver|advantage|etc>] [--program <program_id>] [--available-only <true|false>] [--points-min <num>] [--points-max <num>] [--sort <date|points>] [--limit <num>] [--offset <num>]
  mt flights upsert --json '<JSON object or array>'
  mt flights delete --program <program_id> --destination <IATA> [--origin <IATA>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>]
  mt flights stats --destination <IATA> [--origin <IATA>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>] [--program <program_id>]
  mt flights cheapest --destination <IATA> [--origin <IATA>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>] [--program <program_id>] [--available-only <true|false>]`;

const FLIGHTS_SEARCH_HELP = `Usage:
  mt flights search --destination <IATA> [--origin <IATA>] [--date <YYYY-MM-DD>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>] [--tier <saver|advantage|etc>] [--program <program_id>] [--available-only <true|false>] [--points-min <num>] [--points-max <num>] [--sort <date|points>] [--limit <num>] [--offset <num>]

Notes:
  --origin defaults to KUL in the API when omitted.`;

const FLIGHTS_UPSERT_HELP = `Usage:
  mt flights upsert --json '<JSON object or array>'

Notes:
  Accepts a single flight object or an array of flight objects (max 500 records).`;

const FLIGHTS_DELETE_HELP = `Usage:
  mt flights delete --program <program_id> --destination <IATA> [--origin <IATA>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>]`;

const FLIGHTS_STATS_HELP = `Usage:
  mt flights stats --destination <IATA> [--origin <IATA>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>] [--program <program_id>]`;

const FLIGHTS_CHEAPEST_HELP = `Usage:
  mt flights cheapest --destination <IATA> [--origin <IATA>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>] [--program <program_id>] [--available-only <true|false>]`;

export function runFlightsCommand(
  args: string[]
): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (args.length === 0 || args[0] === "--help") {
      console.log(FLIGHTS_HELP);
      return;
    }

    const [subcommand, ...rest] = args;
    const handler = flightsSubcommandHandlers[subcommand];

    if (!handler) {
      console.log(FLIGHTS_HELP);
      return yield* Effect.fail(
        new ArgError({ message: `Unknown flights subcommand: ${subcommand}` })
      );
    }

    return yield* handler(rest);
  });
}

const flightsSubcommandHandlers: Record<
  string,
  (args: string[]) => Effect.Effect<void, ArgError | FetchError>
> = {
  search: runFlightsSearch,
  upsert: runFlightsUpsert,
  delete: runFlightsDelete,
  stats: runFlightsStats,
  cheapest: runFlightsCheapest,
};

function runFlightsSearch(
  args: string[]
): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (hasHelpFlag(args)) {
      console.log(FLIGHTS_SEARCH_HELP);
      return;
    }

    const parsed = yield* parseFlags(args);
    yield* expectNoPositionals(parsed);
    yield* validateAllowedFlags(parsed, [
      "destination",
      "origin",
      "date",
      "date-from",
      "date-to",
      "cabin",
      "tier",
      "program",
      "available-only",
      "points-min",
      "points-max",
      "sort",
      "limit",
      "offset",
    ]);

    const cabinInput = yield* optionalFlag(parsed, "cabin");
    const cabin =
      cabinInput === undefined
        ? undefined
        : yield* requireOneOf("cabin", cabinInput, CABIN_OPTIONS);

    const sortInput = yield* optionalFlag(parsed, "sort");
    const sort =
      sortInput === undefined
        ? undefined
        : yield* requireOneOf("sort", sortInput, SORT_OPTIONS);

    const query = {
      destination: yield* requiredFlag(parsed, "destination"),
      origin: yield* optionalFlag(parsed, "origin"),
      date: yield* optionalFlag(parsed, "date"),
      date_from: yield* optionalFlag(parsed, "date-from"),
      date_to: yield* optionalFlag(parsed, "date-to"),
      cabin,
      tier: yield* optionalFlag(parsed, "tier"),
      program_id: yield* optionalFlag(parsed, "program"),
      available_only: yield* optionalBooleanFlag(parsed, "available-only"),
      points_min: yield* optionalIntegerFlag(parsed, "points-min"),
      points_max: yield* optionalIntegerFlag(parsed, "points-max"),
      sort,
      limit: yield* optionalIntegerFlag(parsed, "limit"),
      offset: yield* optionalIntegerFlag(parsed, "offset"),
    };

    const response = yield* get("/api/flights", query);
    printResponse(response, {
      tableColumns: [
        "departure_date",
        "departure_time",
        "flight_number",
        "program_id",
        "origin",
        "destination",
        "cabin",
        "tier",
        "points",
        "taxes_myr",
        "available",
        "seats_left",
      ],
    });
  });
}

function runFlightsUpsert(
  args: string[]
): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (hasHelpFlag(args)) {
      console.log(FLIGHTS_UPSERT_HELP);
      return;
    }

    const parsed = yield* parseFlags(args);
    yield* expectNoPositionals(parsed);
    yield* validateAllowedFlags(parsed, ["json"]);

    const rawPayload = yield* requiredFlag(parsed, "json");
    const payload = yield* parseUpsertPayload(rawPayload);

    const response = yield* post("/api/flights", payload);
    printResponse(response);
  });
}

function runFlightsDelete(
  args: string[]
): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (hasHelpFlag(args)) {
      console.log(FLIGHTS_DELETE_HELP);
      return;
    }

    const parsed = yield* parseFlags(args);
    yield* expectNoPositionals(parsed);
    yield* validateAllowedFlags(parsed, [
      "program",
      "destination",
      "origin",
      "date-from",
      "date-to",
      "cabin",
    ]);

    const cabinInput = yield* optionalFlag(parsed, "cabin");
    const cabin =
      cabinInput === undefined
        ? undefined
        : yield* requireOneOf("cabin", cabinInput, CABIN_OPTIONS);

    const query = {
      program_id: yield* requiredFlag(parsed, "program"),
      destination: yield* requiredFlag(parsed, "destination"),
      origin: yield* optionalFlag(parsed, "origin"),
      date_from: yield* optionalFlag(parsed, "date-from"),
      date_to: yield* optionalFlag(parsed, "date-to"),
      cabin,
    };

    const response = yield* del("/api/flights", query);
    printResponse(response);
  });
}

function runFlightsStats(
  args: string[]
): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (hasHelpFlag(args)) {
      console.log(FLIGHTS_STATS_HELP);
      return;
    }

    const parsed = yield* parseFlags(args);
    yield* expectNoPositionals(parsed);
    yield* validateAllowedFlags(parsed, [
      "destination",
      "origin",
      "date-from",
      "date-to",
      "cabin",
      "program",
    ]);

    const cabinInput = yield* optionalFlag(parsed, "cabin");
    const cabin =
      cabinInput === undefined
        ? undefined
        : yield* requireOneOf("cabin", cabinInput, CABIN_OPTIONS);

    const query = {
      destination: yield* requiredFlag(parsed, "destination"),
      origin: yield* optionalFlag(parsed, "origin"),
      date_from: yield* optionalFlag(parsed, "date-from"),
      date_to: yield* optionalFlag(parsed, "date-to"),
      cabin,
      program_id: yield* optionalFlag(parsed, "program"),
    };

    const response = yield* get("/api/flights/stats", query);
    printResponse(response);
  });
}

function runFlightsCheapest(
  args: string[]
): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (hasHelpFlag(args)) {
      console.log(FLIGHTS_CHEAPEST_HELP);
      return;
    }

    const parsed = yield* parseFlags(args);
    yield* expectNoPositionals(parsed);
    yield* validateAllowedFlags(parsed, [
      "destination",
      "origin",
      "date-from",
      "date-to",
      "cabin",
      "program",
      "available-only",
    ]);

    const cabinInput = yield* optionalFlag(parsed, "cabin");
    const cabin =
      cabinInput === undefined
        ? undefined
        : yield* requireOneOf("cabin", cabinInput, CABIN_OPTIONS);

    const query = {
      destination: yield* requiredFlag(parsed, "destination"),
      origin: yield* optionalFlag(parsed, "origin"),
      date_from: yield* optionalFlag(parsed, "date-from"),
      date_to: yield* optionalFlag(parsed, "date-to"),
      cabin,
      program_id: yield* optionalFlag(parsed, "program"),
      available_only: yield* optionalBooleanFlag(parsed, "available-only"),
    };

    const response = yield* get("/api/flights/cheapest-by-date", query);
    printResponse(response, {
      tableColumns: [
        "departure_date",
        "economy",
        "business",
        "first",
        "last_updated",
      ],
    });
  });
}

function parseUpsertPayload(raw: string): Effect.Effect<unknown, ArgError> {
  return Effect.gen(function* () {
    const parsed = yield* Effect.try({
      try: () => JSON.parse(raw) as unknown,
      catch: () =>
        new ArgError({
          message: "Flag --json must be valid JSON text",
        }),
    });

    if (Array.isArray(parsed)) {
      if (parsed.length > MAX_UPSERT_RECORDS) {
        return yield* Effect.fail(
          new ArgError({
            message: `Flag --json supports a maximum of ${MAX_UPSERT_RECORDS} records`,
          })
        );
      }
      return parsed;
    }

    if (isRecord(parsed)) {
      return parsed;
    }

    return yield* Effect.fail(
      new ArgError({
        message: "Flag --json must be a JSON object or array",
      })
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
