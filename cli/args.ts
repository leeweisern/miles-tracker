import { Data, Effect } from "effect";

type FlagValue = string | boolean;

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, FlagValue>;
}

export class ArgError extends Data.TaggedError("ArgError")<{
  message: string;
}> {}

export function parseFlags(
  args: readonly string[]
): Effect.Effect<ParsedArgs, ArgError> {
  return Effect.gen(function* () {
    const positionals: string[] = [];
    const flags: Record<string, FlagValue> = {};

    let i = 0;
    while (i < args.length) {
      const token = args[i];

      if (token === "--") {
        positionals.push(...args.slice(i + 1));
        break;
      }

      if (!token.startsWith("--")) {
        positionals.push(token);
        i += 1;
        continue;
      }

      const parsedFlag = yield* parseFlagToken(token, args[i + 1]);
      flags[parsedFlag.key] = parsedFlag.value;
      i += parsedFlag.tokensConsumed;
    }

    return { positionals, flags };
  });
}

function parseFlagToken(
  token: string,
  next: string | undefined
): Effect.Effect<
  {
    key: string;
    value: FlagValue;
    tokensConsumed: 1 | 2;
  },
  ArgError
> {
  const raw = token.slice(2);
  if (!raw) {
    return Effect.fail(new ArgError({ message: "Invalid empty flag: --" }));
  }

  const equalsIndex = raw.indexOf("=");
  if (equalsIndex >= 0) {
    const key = raw.slice(0, equalsIndex);
    const value = raw.slice(equalsIndex + 1);
    if (!key) {
      return Effect.fail(
        new ArgError({ message: `Invalid flag syntax: ${token}` })
      );
    }

    return Effect.succeed({
      key,
      value,
      tokensConsumed: 1,
    });
  }

  if (next !== undefined && !next.startsWith("--")) {
    return Effect.succeed({
      key: raw,
      value: next,
      tokensConsumed: 2,
    });
  }

  return Effect.succeed({
    key: raw,
    value: true,
    tokensConsumed: 1,
  });
}

export function hasHelpFlag(args: readonly string[] | ParsedArgs): boolean {
  if (Array.isArray(args)) {
    return args.includes("--help");
  }
  return args.flags.help === true || args.flags.help === "true";
}

export function expectNoPositionals(
  parsed: ParsedArgs
): Effect.Effect<void, ArgError> {
  return parsed.positionals.length === 0
    ? Effect.void
    : Effect.fail(
        new ArgError({
          message: `Unexpected positional arguments: ${parsed.positionals.join(" ")}`,
        })
      );
}

export function validateAllowedFlags(
  parsed: ParsedArgs,
  allowed: readonly string[]
): Effect.Effect<void, ArgError> {
  const allowedSet = new Set(allowed);

  for (const key of Object.keys(parsed.flags)) {
    if (!allowedSet.has(key)) {
      return Effect.fail(new ArgError({ message: `Unknown flag: --${key}` }));
    }
  }

  return Effect.void;
}

export function requiredFlag(
  parsed: ParsedArgs,
  key: string
): Effect.Effect<string, ArgError> {
  const value = parsed.flags[key];
  if (value === undefined) {
    return Effect.fail(
      new ArgError({ message: `Missing required flag: --${key}` })
    );
  }

  if (value === true) {
    return Effect.fail(
      new ArgError({ message: `Flag --${key} requires a value` })
    );
  }

  return Effect.succeed(value);
}

export function optionalFlag(
  parsed: ParsedArgs,
  key: string
): Effect.Effect<string | undefined, ArgError> {
  const value = parsed.flags[key];
  if (value === undefined) {
    return Effect.succeed(undefined);
  }

  if (value === true) {
    return Effect.fail(
      new ArgError({ message: `Flag --${key} requires a value` })
    );
  }

  return Effect.succeed(value);
}

export function optionalIntegerFlag(
  parsed: ParsedArgs,
  key: string
): Effect.Effect<number | undefined, ArgError> {
  return Effect.gen(function* () {
    const value = yield* optionalFlag(parsed, key);
    if (value === undefined) {
      return undefined;
    }
    return yield* parseInteger(key, value);
  });
}

export function optionalBooleanFlag(
  parsed: ParsedArgs,
  key: string
): Effect.Effect<boolean | undefined, ArgError> {
  return Effect.gen(function* () {
    const value = parsed.flags[key];
    if (value === undefined) {
      return undefined;
    }

    if (value === true) {
      return true;
    }

    const normalized = value.toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }

    return yield* Effect.fail(
      new ArgError({ message: `Flag --${key} must be true or false` })
    );
  });
}

export function requireOneOf<T extends string>(
  flagName: string,
  value: string,
  allowed: readonly T[]
): Effect.Effect<T, ArgError> {
  if ((allowed as readonly string[]).includes(value)) {
    return Effect.succeed(value as T);
  }

  return Effect.fail(
    new ArgError({
      message: `Flag --${flagName} must be one of: ${allowed.join(", ")}`,
    })
  );
}

function parseInteger(
  key: string,
  raw: string
): Effect.Effect<number, ArgError> {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    return Effect.fail(
      new ArgError({ message: `Flag --${key} must be an integer` })
    );
  }
  return Effect.succeed(parsed);
}
