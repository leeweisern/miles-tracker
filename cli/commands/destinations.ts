import { Effect } from "effect";
import {
  ArgError,
  expectNoPositionals,
  hasHelpFlag,
  optionalBooleanFlag,
  optionalFlag,
  parseFlags,
  requireOneOf,
  validateAllowedFlags,
} from "../args";
import { printResponse } from "../format";
import type { FetchError } from "../http";
import { get } from "../http";

const CABIN_OPTIONS = ["economy", "business", "first"] as const;

const DESTINATIONS_HELP = `Usage:
  mt destinations list [--origin <IATA>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>] [--available-only <true|false>]`;

const DESTINATIONS_LIST_HELP = `Usage:
  mt destinations list [--origin <IATA>] [--date-from <YYYY-MM-DD>] [--date-to <YYYY-MM-DD>] [--cabin <economy|business|first>] [--available-only <true|false>]`;

export function runDestinationsCommand(
  args: string[]
): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (args.length === 0 || args[0] === "--help") {
      console.log(DESTINATIONS_HELP);
      return;
    }

    const [subcommand, ...rest] = args;
    switch (subcommand) {
      case "list":
        return yield* runDestinationsList(rest);
      default:
        console.log(DESTINATIONS_HELP);
        return yield* Effect.fail(
          new ArgError({
            message: `Unknown destinations subcommand: ${subcommand}`,
          })
        );
    }
  });
}

function runDestinationsList(
  args: string[]
): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (hasHelpFlag(args)) {
      console.log(DESTINATIONS_LIST_HELP);
      return;
    }

    const parsed = yield* parseFlags(args);
    yield* expectNoPositionals(parsed);
    yield* validateAllowedFlags(parsed, [
      "origin",
      "date-from",
      "date-to",
      "cabin",
      "available-only",
    ]);

    const cabinInput = yield* optionalFlag(parsed, "cabin");
    const cabin =
      cabinInput === undefined
        ? undefined
        : yield* requireOneOf("cabin", cabinInput, CABIN_OPTIONS);

    const query = {
      origin: yield* optionalFlag(parsed, "origin"),
      date_from: yield* optionalFlag(parsed, "date-from"),
      date_to: yield* optionalFlag(parsed, "date-to"),
      cabin,
      available_only: yield* optionalBooleanFlag(parsed, "available-only"),
    };

    const response = yield* get("/api/destinations", query);
    printResponse(response, {
      tableColumns: [
        "destination",
        "flight_count",
        "economy_min_points",
        "business_min_points",
        "first_min_points",
        "available_count",
        "last_updated",
      ],
    });
  });
}
