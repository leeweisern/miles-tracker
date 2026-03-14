import { Effect } from "effect";
import {
  ArgError,
  expectNoPositionals,
  hasHelpFlag,
  optionalFlag,
  parseFlags,
  requiredFlag,
  validateAllowedFlags,
} from "../args";
import { printResponse } from "../format";
import type { FetchError } from "../http";
import { get, post } from "../http";

const PROGRAMS_HELP = `Usage:
  mt programs list
  mt programs upsert --id <id> --name <name> --airline <airline> [--alliance <alliance>]`;

const PROGRAMS_LIST_HELP = `Usage:
  mt programs list`;

const PROGRAMS_UPSERT_HELP = `Usage:
  mt programs upsert --id <id> --name <name> --airline <airline> [--alliance <alliance>]`;

export function runProgramsCommand(
  args: string[]
): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (args.length === 0 || args[0] === "--help") {
      console.log(PROGRAMS_HELP);
      return;
    }

    const [subcommand, ...rest] = args;

    switch (subcommand) {
      case "list": {
        if (hasHelpFlag(rest)) {
          console.log(PROGRAMS_LIST_HELP);
          return;
        }

        const parsed = yield* parseFlags(rest);
        yield* expectNoPositionals(parsed);
        yield* validateAllowedFlags(parsed, []);

        const response = yield* get("/api/programs");
        printResponse(response, {
          tableColumns: ["id", "name", "airline", "alliance", "created_at"],
        });
        return;
      }

      case "upsert": {
        if (hasHelpFlag(rest)) {
          console.log(PROGRAMS_UPSERT_HELP);
          return;
        }

        const parsed = yield* parseFlags(rest);
        yield* expectNoPositionals(parsed);
        yield* validateAllowedFlags(parsed, ["id", "name", "airline", "alliance"]);

        const payload = {
          id: yield* requiredFlag(parsed, "id"),
          name: yield* requiredFlag(parsed, "name"),
          airline: yield* requiredFlag(parsed, "airline"),
          alliance: yield* optionalFlag(parsed, "alliance"),
        };

        const response = yield* post("/api/programs", payload);
        printResponse(response);
        return;
      }

      default: {
        console.log(PROGRAMS_HELP);
        return yield* Effect.fail(
          new ArgError({ message: `Unknown programs subcommand: ${subcommand}` })
        );
      }
    }
  });
}
