import { Effect } from "effect";
import { Database } from "../db/client";
import { DatabaseError, ValidationError } from "../lib/errors";
import { asRecord, asString, toNullableString } from "../lib/parse";

export interface ProgramRow {
  id: string;
  name: string;
  airline: string;
  alliance: string | null;
  created_at: string | null;
}

export interface UpsertProgramInput {
  id: string;
  name: string;
  airline: string;
  alliance?: string | null;
}

export function getPrograms(): Effect.Effect<
  ProgramRow[],
  DatabaseError,
  Database
> {
  return Effect.gen(function* () {
    const db = yield* Database;
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .prepare(
            `SELECT id, name, airline, alliance, created_at
             FROM programs
             ORDER BY airline ASC, name ASC`
          )
          .all(),
      catch: (cause) =>
        new DatabaseError({ message: "Failed to query programs", cause }),
    });

    return (rows.results ?? []).map((row) => toProgramRow(row));
  });
}

export function upsertProgram(
  input: UpsertProgramInput
): Effect.Effect<ProgramRow, DatabaseError | ValidationError, Database> {
  return Effect.gen(function* () {
    const id = input.id.trim();
    const name = input.name.trim();
    const airline = input.airline.trim();

    if (!id) {
      return yield* Effect.fail(
        new ValidationError({ message: "id is required" })
      );
    }
    if (!name) {
      return yield* Effect.fail(
        new ValidationError({ message: "name is required" })
      );
    }
    if (!airline) {
      return yield* Effect.fail(
        new ValidationError({ message: "airline is required" })
      );
    }

    const db = yield* Database;
    yield* Effect.tryPromise({
      try: () =>
        db
          .prepare(
            `INSERT INTO programs (id, name, airline, alliance, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               airline = excluded.airline,
               alliance = excluded.alliance`
          )
          .bind(id, name, airline, input.alliance ?? null)
          .run(),
      catch: (cause) =>
        new DatabaseError({ message: "Failed to upsert program", cause }),
    });

    const row = yield* Effect.tryPromise({
      try: () =>
        db
          .prepare(
            `SELECT id, name, airline, alliance, created_at
             FROM programs
             WHERE id = ?`
          )
          .bind(id)
          .first(),
      catch: (cause) =>
        new DatabaseError({ message: "Failed to load program", cause }),
    });

    return toProgramRow(row);
  });
}

function toProgramRow(row: unknown): ProgramRow {
  const value = asRecord(row);
  return {
    id: asString(value.id),
    name: asString(value.name),
    airline: asString(value.airline),
    alliance: toNullableString(value.alliance),
    created_at: toNullableString(value.created_at),
  };
}
