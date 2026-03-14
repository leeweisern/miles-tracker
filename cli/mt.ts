#!/usr/bin/env bun

import { Effect } from "effect";
import { ArgError } from "./args";
import { runDestinationsCommand } from "./commands/destinations";
import { runFlightsCommand } from "./commands/flights";
import { runProgramsCommand } from "./commands/programs";
import { printError } from "./format";
import type { FetchError } from "./http";

const ROOT_HELP = `Usage:
  mt <command> <subcommand> [flags]

Commands:
  programs      List/upsert loyalty programs
  flights       Search, upsert, delete, and analyze flight pricing
  destinations  List destination summaries

Run per-command help:
  mt <command> --help
  mt <command> <subcommand> --help`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const program = runCli(args);

  const exitCode = await Effect.runPromise(
    Effect.match(program, {
      onSuccess: () => 0,
      onFailure: (error) => {
        printError(getErrorMessage(error));
        return 1;
      },
    })
  );

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

function runCli(args: string[]): Effect.Effect<void, ArgError | FetchError> {
  return Effect.gen(function* () {
    if (args.length === 0 || args[0] === "--help") {
      console.log(ROOT_HELP);
      return;
    }

    const [command, ...rest] = args;

    switch (command) {
      case "programs":
        return yield* runProgramsCommand(rest);
      case "flights":
        return yield* runFlightsCommand(rest);
      case "destinations":
        return yield* runDestinationsCommand(rest);
      default:
        console.log(ROOT_HELP);
        return yield* Effect.fail(
          new ArgError({ message: `Unknown command: ${command}` })
        );
    }
  });
}

function getErrorMessage(error: ArgError | FetchError): string {
  if (error._tag === "ArgError" || error._tag === "FetchError") {
    return error.message;
  }

  return "Unknown error";
}

await main();
