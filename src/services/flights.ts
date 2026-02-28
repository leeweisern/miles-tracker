import { Effect } from "effect";
import { Database } from "../db/client";
import { DatabaseError, ValidationError } from "../lib/errors";
import {
  asRecord,
  asString,
  isIataCode,
  isIsoDate,
  isTime,
  round2,
  toNullableNumber,
  toNullableString,
} from "../lib/parse";

const DEFAULT_ORIGIN = "KUL";
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const MAX_UPSERT_RECORDS = 500;
const D1_BATCH_SIZE = 50;

type Cabin = "economy" | "business" | "first";
type RouteType = "direct" | "1-stop" | "2-stop";
type SortOrder = "date" | "points";

const CABINS = new Set<Cabin>(["economy", "business", "first"]);
const ROUTE_TYPES = new Set<RouteType>(["direct", "1-stop", "2-stop"]);
const SORT_OPTIONS = new Set<SortOrder>(["date", "points"]);

export interface SearchFlightsInput {
  destination: string;
  origin?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  cabin?: string;
  tier?: string;
  programId?: string;
  availableOnly?: boolean | null;
  pointsMax?: number | null;
  pointsMin?: number | null;
  sort?: string;
  limit?: number | null;
  offset?: number | null;
}

export interface UpsertFlightInput {
  programId: string;
  origin?: string | null;
  destination: string;
  flightNumber: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  arrivalDayOffset?: number | null;
  durationMinutes: number | null;
  routeType: string;
  cabin: string;
  tier: string;
  points: number | null;
  available?: boolean | null;
  seatsLeft?: number | null;
  taxesMyr: number | null;
  cashEquivalentMyr?: number | null;
  notes?: string | null;
}

export interface DeleteFlightsInput {
  programId: string;
  destination: string;
  origin?: string;
  dateFrom?: string;
  dateTo?: string;
  cabin?: string;
}

export interface AwardFlightRow {
  id: number;
  program_id: string;
  origin: string;
  destination: string;
  flight_number: string;
  departure_date: string;
  departure_time: string;
  arrival_time: string;
  arrival_day_offset: number;
  duration_minutes: number;
  route_type: string;
  cabin: string;
  tier: string;
  points: number;
  available: boolean;
  seats_left: number | null;
  taxes_myr: number;
  cash_equivalent_myr: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SearchFlightsResult {
  data: AwardFlightRow[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface TierPointStats {
  min_points: number;
  max_points: number;
  avg_points: number;
  available_count: number;
}

export interface FlightStatsResult {
  origin: string;
  destination: string;
  date_range: {
    from: string | null;
    to: string | null;
  };
  economy: Record<string, TierPointStats> | null;
  business: Record<string, TierPointStats> | null;
  first: Record<string, TierPointStats> | null;
  total_flights: number;
  last_updated: string | null;
}

interface NormalizedSearchFilters {
  destination: string;
  origin: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  cabin?: Cabin;
  tier?: string;
  programId?: string;
  availableOnly: boolean;
  pointsMax?: number;
  pointsMin?: number;
  sort: SortOrder;
  limit: number;
  offset: number;
}

interface NormalizedDeleteFilters {
  programId: string;
  destination: string;
  origin: string;
  dateFrom?: string;
  dateTo?: string;
  cabin?: Cabin;
}

interface NormalizedFlightRecord {
  programId: string;
  origin: string;
  destination: string;
  flightNumber: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  arrivalDayOffset: number;
  durationMinutes: number;
  routeType: RouteType;
  cabin: Cabin;
  tier: string;
  points: number;
  available: boolean;
  seatsLeft: number | null;
  taxesMyr: number;
  cashEquivalentMyr: number | null;
  notes: string | null;
}

interface WhereClause {
  sql: string;
  params: Array<string | number>;
}

interface NormalizedDateFilters {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

type FiltersForWhere = Pick<
  NormalizedSearchFilters,
  | "origin"
  | "destination"
  | "date"
  | "dateFrom"
  | "dateTo"
  | "cabin"
  | "tier"
  | "programId"
  | "availableOnly"
  | "pointsMax"
  | "pointsMin"
>;

export function searchFlights(
  filters: SearchFlightsInput
): Effect.Effect<
  SearchFlightsResult,
  DatabaseError | ValidationError,
  Database
> {
  return Effect.gen(function* () {
    const normalized = yield* normalizeSearchFilters(filters);
    const where = buildWhereClause(normalized);

    const orderBy =
      normalized.sort === "points"
        ? "ORDER BY points ASC, departure_date ASC, departure_time ASC"
        : "ORDER BY departure_date ASC, departure_time ASC, points ASC";

    const db = yield* Database;
    const [rows, countRow] = yield* Effect.all([
      Effect.tryPromise({
        try: () =>
          db
            .prepare(
              `SELECT
                 id,
                 program_id,
                 origin,
                 destination,
                 flight_number,
                 departure_date,
                 departure_time,
                 arrival_time,
                 arrival_day_offset,
                 duration_minutes,
                 route_type,
                 cabin,
                 tier,
                 points,
                 available,
                 seats_left,
                 taxes_myr,
                 cash_equivalent_myr,
                 notes,
                 created_at,
                 updated_at
                FROM award_flights
               ${where.sql}
               ${orderBy}
               LIMIT ?
               OFFSET ?`
            )
            .bind(...where.params, normalized.limit, normalized.offset)
            .all(),
        catch: (cause) =>
          new DatabaseError({
            message: "Failed to query award flights",
            cause,
          }),
      }),
      Effect.tryPromise({
        try: () =>
          db
            .prepare(`SELECT COUNT(*) AS total FROM award_flights ${where.sql}`)
            .bind(...where.params)
            .first(),
        catch: (cause) =>
          new DatabaseError({
            message: "Failed to count award flights",
            cause,
          }),
      }),
    ]);

    return {
      data: (rows.results ?? []).map((row) => toAwardFlightRow(row)),
      meta: {
        total: toInt(asRecord(countRow).total),
        limit: normalized.limit,
        offset: normalized.offset,
      },
    };
  });
}

export function upsertFlights(
  flights: UpsertFlightInput[]
): Effect.Effect<
  { upserted: number },
  DatabaseError | ValidationError,
  Database
> {
  return Effect.gen(function* () {
    if (flights.length === 0) {
      return yield* validationFailure(
        "Request body must include at least one flight record"
      );
    }

    if (flights.length > MAX_UPSERT_RECORDS) {
      return yield* validationFailure(
        `Maximum ${MAX_UPSERT_RECORDS} records allowed per request`
      );
    }

    const normalized: NormalizedFlightRecord[] = [];
    for (let i = 0; i < flights.length; i++) {
      const next = yield* normalizeUpsertFlightInput(flights[i], i);
      normalized.push(next);
    }

    const db = yield* Database;
    for (const chunk of chunkArray(normalized, D1_BATCH_SIZE)) {
      const statements = chunk.map((flight) =>
        db
          .prepare(
            `INSERT INTO award_flights (
               program_id,
               origin,
               destination,
               flight_number,
               departure_date,
               departure_time,
               arrival_time,
               arrival_day_offset,
               duration_minutes,
               route_type,
               cabin,
               tier,
               points,
               available,
               seats_left,
               taxes_myr,
                 cash_equivalent_myr,
                 notes,
                 created_at,
                 updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
              ON CONFLICT(program_id, origin, destination, flight_number, departure_date, cabin, tier)
              DO UPDATE SET
                 departure_time = excluded.departure_time,
                arrival_time = excluded.arrival_time,
                arrival_day_offset = excluded.arrival_day_offset,
                duration_minutes = excluded.duration_minutes,
                route_type = excluded.route_type,
                points = excluded.points,
                available = excluded.available,
                seats_left = excluded.seats_left,
                taxes_myr = excluded.taxes_myr,
                 cash_equivalent_myr = excluded.cash_equivalent_myr,
                 notes = excluded.notes,
                 updated_at = datetime('now')`
          )
          .bind(
            flight.programId,
            flight.origin,
            flight.destination,
            flight.flightNumber,
            flight.departureDate,
            flight.departureTime,
            flight.arrivalTime,
            flight.arrivalDayOffset,
            flight.durationMinutes,
            flight.routeType,
            flight.cabin,
            flight.tier,
            flight.points,
            flight.available ? 1 : 0,
            flight.seatsLeft,
            flight.taxesMyr,
            flight.cashEquivalentMyr,
            flight.notes
          )
      );

      yield* Effect.tryPromise({
        try: () => db.batch(statements),
        catch: (cause) =>
          new DatabaseError({
            message: "Failed to upsert award flights",
            cause,
          }),
      });
    }

    return { upserted: normalized.length };
  });
}

export function deleteFlights(
  filters: DeleteFlightsInput
): Effect.Effect<
  { deleted: number },
  DatabaseError | ValidationError,
  Database
> {
  return Effect.gen(function* () {
    const normalized = yield* normalizeDeleteFilters(filters);

    const where: string[] = ["program_id = ?", "destination = ?", "origin = ?"];
    const params: Array<string | number> = [
      normalized.programId,
      normalized.destination,
      normalized.origin,
    ];

    if (normalized.dateFrom) {
      where.push("departure_date >= ?");
      params.push(normalized.dateFrom);
    }
    if (normalized.dateTo) {
      where.push("departure_date <= ?");
      params.push(normalized.dateTo);
    }
    if (normalized.cabin) {
      where.push("cabin = ?");
      params.push(normalized.cabin);
    }

    const db = yield* Database;
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .prepare(`DELETE FROM award_flights WHERE ${where.join(" AND ")}`)
          .bind(...params)
          .run(),
      catch: (cause) =>
        new DatabaseError({ message: "Failed to delete flights", cause }),
    });

    return { deleted: changesFromRun(result) };
  });
}

export function getFlightStats(
  filters: SearchFlightsInput
): Effect.Effect<FlightStatsResult, DatabaseError | ValidationError, Database> {
  return Effect.gen(function* () {
    const normalized = yield* normalizeSearchFilters(filters);
    const where = buildWhereClause(normalized);

    const db = yield* Database;
    const [rows, summaryRow] = yield* Effect.all([
      Effect.tryPromise({
        try: () =>
          db
            .prepare(
              `SELECT
                 cabin,
                 tier,
                 MIN(points) AS min_points,
                 MAX(points) AS max_points,
                 AVG(points) AS avg_points,
                 COUNT(*) AS total,
                 SUM(CASE WHEN available = 1 THEN 1 ELSE 0 END) AS available_count
               FROM award_flights
               ${where.sql}
               GROUP BY cabin, tier
               ORDER BY cabin, tier`
            )
            .bind(...where.params)
            .all(),
        catch: (cause) =>
          new DatabaseError({ message: "Failed to query flight stats", cause }),
      }),
      Effect.tryPromise({
        try: () =>
          db
            .prepare(
              `SELECT
                 COUNT(*) AS total_flights,
                 MIN(departure_date) AS min_date,
                 MAX(departure_date) AS max_date,
                 MAX(updated_at) AS last_updated
                FROM award_flights
                ${where.sql}`
            )
            .bind(...where.params)
            .first(),
        catch: (cause) =>
          new DatabaseError({
            message: "Failed to query flight stats summary",
            cause,
          }),
      }),
    ]);

    const byCabin: Record<Cabin, Record<string, TierPointStats>> = {
      economy: {},
      business: {},
      first: {},
    };

    for (const row of rows.results ?? []) {
      const value = asRecord(row);
      const cabin = asString(value.cabin);
      const tier = asString(value.tier);
      if (!isCabin(cabin)) {
        continue;
      }
      if (!tier) {
        continue;
      }

      byCabin[cabin][tier] = {
        min_points: toInt(value.min_points),
        max_points: toInt(value.max_points),
        avg_points: round2(toNumber(value.avg_points)),
        available_count: toInt(value.available_count),
      };
    }

    const summary = asRecord(summaryRow);
    const from =
      normalized.date ??
      normalized.dateFrom ??
      toNullableString(summary.min_date) ??
      null;
    const to =
      normalized.date ??
      normalized.dateTo ??
      toNullableString(summary.max_date) ??
      null;

    return {
      origin: normalized.origin,
      destination: normalized.destination,
      date_range: { from, to },
      economy: toNullableObject(byCabin.economy),
      business: toNullableObject(byCabin.business),
      first: toNullableObject(byCabin.first),
      total_flights: toInt(summary.total_flights),
      last_updated: toNullableString(summary.last_updated) ?? null,
    };
  });
}

export interface DestinationSummary {
  destination: string;
  flight_count: number;
  date_range: { from: string | null; to: string | null };
  economy_min_points: number | null;
  business_min_points: number | null;
  first_min_points: number | null;
  available_count: number;
  last_updated: string | null;
}

export interface DestinationsInput {
  origin?: string;
  dateFrom?: string;
  dateTo?: string;
  cabin?: string;
  availableOnly?: boolean | null;
}

export function getDestinations(
  input: DestinationsInput
): Effect.Effect<
  DestinationSummary[],
  DatabaseError | ValidationError,
  Database
> {
  return Effect.gen(function* () {
    const origin = yield* requireIataField(
      input.origin,
      "origin",
      DEFAULT_ORIGIN
    );
    const { dateFrom, dateTo } = yield* normalizeDateFilters(
      undefined,
      input.dateFrom,
      input.dateTo
    );
    const cabin = yield* normalizeCabinField(input.cabin);
    const availableOnly = yield* normalizeAvailableOnly(input.availableOnly);

    const where: string[] = ["origin = ?"];
    const params: Array<string | number> = [origin];

    if (dateFrom) {
      where.push("departure_date >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push("departure_date <= ?");
      params.push(dateTo);
    }
    if (cabin) {
      where.push("cabin = ?");
      params.push(cabin);
    }
    if (availableOnly) {
      where.push("available = 1");
    }

    const sql = `
      SELECT
        destination,
        COUNT(*) AS flight_count,
        MIN(departure_date) AS min_date,
        MAX(departure_date) AS max_date,
        MIN(CASE WHEN cabin = 'economy' THEN points END) AS economy_min_points,
        MIN(CASE WHEN cabin = 'business' THEN points END) AS business_min_points,
        MIN(CASE WHEN cabin = 'first' THEN points END) AS first_min_points,
        SUM(CASE WHEN available = 1 THEN 1 ELSE 0 END) AS available_count,
        MAX(updated_at) AS last_updated
      FROM award_flights
      WHERE ${where.join(" AND ")}
      GROUP BY destination
      ORDER BY destination
    `;

    const db = yield* Database;
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .prepare(sql)
          .bind(...params)
          .all(),
      catch: (cause) =>
        new DatabaseError({ message: "Failed to query destinations", cause }),
    });

    return (result.results ?? []).map((row) => {
      const r = asRecord(row);
      return {
        destination: asString(r.destination),
        flight_count: toInt(r.flight_count),
        date_range: {
          from: toNullableString(r.min_date) ?? null,
          to: toNullableString(r.max_date) ?? null,
        },
        economy_min_points: nullableInt(r.economy_min_points),
        business_min_points: nullableInt(r.business_min_points),
        first_min_points: nullableInt(r.first_min_points),
        available_count: toInt(r.available_count),
        last_updated: toNullableString(r.last_updated) ?? null,
      };
    });
  });
}

export interface DatePricing {
  departure_date: string;
  economy: { min_points: number; available: boolean } | null;
  business: { min_points: number; available: boolean } | null;
  first: { min_points: number; available: boolean } | null;
  last_updated: string | null;
}

export interface CheapestByDateInput {
  destination: string;
  origin?: string;
  dateFrom?: string;
  dateTo?: string;
  cabin?: string;
  programId?: string;
  availableOnly?: boolean | null;
}

export function getCheapestByDate(
  input: CheapestByDateInput
): Effect.Effect<DatePricing[], DatabaseError | ValidationError, Database> {
  return Effect.gen(function* () {
    const destination = yield* requireIataField(
      input.destination,
      "destination"
    );
    const origin = yield* requireIataField(
      input.origin,
      "origin",
      DEFAULT_ORIGIN
    );
    const { dateFrom, dateTo } = yield* normalizeDateFilters(
      undefined,
      input.dateFrom,
      input.dateTo
    );
    const cabin = yield* normalizeCabinField(input.cabin);
    const programId = normalizeOptionalString(input.programId);
    const availableOnly = yield* normalizeAvailableOnly(input.availableOnly);

    const where: string[] = ["origin = ?", "destination = ?"];
    const params: Array<string | number> = [origin, destination];

    if (dateFrom) {
      where.push("departure_date >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push("departure_date <= ?");
      params.push(dateTo);
    }
    if (cabin) {
      where.push("cabin = ?");
      params.push(cabin);
    }
    if (programId) {
      where.push("program_id = ?");
      params.push(programId);
    }
    if (availableOnly) {
      where.push("available = 1");
    }

    const sql = `
      SELECT
        departure_date,
        MIN(CASE WHEN cabin = 'economy' THEN points END) AS econ_min,
        MAX(CASE WHEN cabin = 'economy' AND available = 1 THEN 1 ELSE 0 END) AS econ_avail,
        MIN(CASE WHEN cabin = 'business' THEN points END) AS biz_min,
        MAX(CASE WHEN cabin = 'business' AND available = 1 THEN 1 ELSE 0 END) AS biz_avail,
        MIN(CASE WHEN cabin = 'first' THEN points END) AS first_min,
        MAX(CASE WHEN cabin = 'first' AND available = 1 THEN 1 ELSE 0 END) AS first_avail,
        MAX(updated_at) AS last_updated
      FROM award_flights
      WHERE ${where.join(" AND ")}
      GROUP BY departure_date
      ORDER BY departure_date ASC
    `;

    const db = yield* Database;
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .prepare(sql)
          .bind(...params)
          .all(),
      catch: (cause) =>
        new DatabaseError({
          message: "Failed to query cheapest by date",
          cause,
        }),
    });

    return (result.results ?? []).map((row) => {
      const r = asRecord(row);
      const econMin = nullableInt(r.econ_min);
      const bizMin = nullableInt(r.biz_min);
      const firstMin = nullableInt(r.first_min);

      return {
        departure_date: asString(r.departure_date),
        economy:
          econMin != null
            ? { min_points: econMin, available: toInt(r.econ_avail) === 1 }
            : null,
        business:
          bizMin != null
            ? { min_points: bizMin, available: toInt(r.biz_avail) === 1 }
            : null,
        first:
          firstMin != null
            ? { min_points: firstMin, available: toInt(r.first_avail) === 1 }
            : null,
        last_updated: toNullableString(r.last_updated) ?? null,
      };
    });
  });
}

function normalizeSearchFilters(
  input: SearchFlightsInput
): Effect.Effect<NormalizedSearchFilters, ValidationError, never> {
  return Effect.gen(function* () {
    const destination = yield* requireIataField(
      input.destination,
      "destination"
    );
    const origin = yield* requireIataField(
      input.origin,
      "origin",
      DEFAULT_ORIGIN
    );
    const { date, dateFrom, dateTo } = yield* normalizeDateFilters(
      input.date,
      input.dateFrom,
      input.dateTo
    );
    const cabin = yield* normalizeCabinField(input.cabin);
    const tier = normalizeOptionalString(input.tier);
    const programId = normalizeOptionalString(input.programId);
    const availableOnly = yield* normalizeAvailableOnly(input.availableOnly);
    const pointsMin = yield* normalizePositiveIntFilter(
      "points_min",
      input.pointsMin
    );
    const pointsMax = yield* normalizePositiveIntFilter(
      "points_max",
      input.pointsMax
    );
    yield* ensurePointsRange(pointsMin, pointsMax);
    const limit = yield* normalizeLimit(input.limit);
    const offset = yield* normalizeOffset(input.offset);
    const sort = yield* normalizeSort(input.sort);

    return {
      destination,
      origin,
      date,
      dateFrom,
      dateTo,
      cabin,
      tier,
      programId,
      availableOnly,
      pointsMin,
      pointsMax,
      sort,
      limit,
      offset,
    };
  });
}

function normalizeDeleteFilters(
  input: DeleteFlightsInput
): Effect.Effect<NormalizedDeleteFilters, ValidationError, never> {
  return Effect.gen(function* () {
    const programId = yield* requireNonEmptyField(
      input.programId,
      "program_id"
    );
    const destination = yield* requireIataField(
      input.destination,
      "destination"
    );
    const origin = yield* requireIataField(
      input.origin,
      "origin",
      DEFAULT_ORIGIN
    );
    const { dateFrom, dateTo } = yield* normalizeDateFilters(
      undefined,
      input.dateFrom,
      input.dateTo
    );
    const cabin = yield* normalizeCabinField(input.cabin);

    return {
      programId,
      destination,
      origin,
      dateFrom,
      dateTo,
      cabin,
    };
  });
}

function normalizeUpsertFlightInput(
  input: UpsertFlightInput,
  index: number
): Effect.Effect<NormalizedFlightRecord, ValidationError, never> {
  return Effect.gen(function* () {
    const pointer = `records[${index}]`;
    const programId = yield* requireRecordText(
      input.programId,
      pointer,
      "program_id"
    );
    const origin = yield* requireRecordIata(
      input.origin,
      pointer,
      "origin",
      DEFAULT_ORIGIN
    );
    const destination = yield* requireRecordIata(
      input.destination,
      pointer,
      "destination"
    );
    const flightNumber = yield* requireRecordText(
      input.flightNumber,
      pointer,
      "flight_number"
    );
    const departureDate = yield* requireRecordIsoDate(
      input.departureDate,
      pointer,
      "departure_date"
    );
    const departureTime = yield* requireRecordTime(
      input.departureTime,
      pointer,
      "departure_time"
    );
    const arrivalTime = yield* requireRecordTime(
      input.arrivalTime,
      pointer,
      "arrival_time"
    );
    const arrivalDayOffset = yield* normalizeRecordArrivalDayOffset(
      input.arrivalDayOffset,
      pointer
    );
    const durationMinutes = yield* requireRecordPositiveInt(
      input.durationMinutes,
      pointer,
      "duration_minutes"
    );
    const routeType = yield* normalizeRecordRouteType(input.routeType, pointer);
    const cabin = yield* normalizeRecordCabin(input.cabin, pointer);
    const tier = yield* requireRecordText(input.tier, pointer, "tier");
    const points = yield* requireRecordPositiveInt(
      input.points,
      pointer,
      "points"
    );
    const available = yield* normalizeRecordAvailable(input.available, pointer);
    const seatsLeft = yield* normalizeRecordOptionalNonNegativeInt(
      input.seatsLeft,
      pointer,
      "seats_left"
    );
    const taxesMyr = yield* requireRecordNonNegativeNumber(
      input.taxesMyr,
      pointer,
      "taxes_myr"
    );
    const cashEquivalentMyr = yield* normalizeRecordOptionalNonNegativeNumber(
      input.cashEquivalentMyr,
      pointer,
      "cash_equivalent_myr"
    );
    return {
      programId,
      origin,
      destination,
      flightNumber,
      departureDate,
      departureTime,
      arrivalTime,
      arrivalDayOffset,
      durationMinutes,
      routeType,
      cabin,
      tier,
      points,
      available,
      seatsLeft,
      taxesMyr: round2(taxesMyr),
      cashEquivalentMyr:
        cashEquivalentMyr == null ? null : round2(cashEquivalentMyr),
      notes: input.notes ?? null,
    };
  });
}

function requireIataField(
  value: string | undefined,
  field: string,
  fallback?: string
): Effect.Effect<string, ValidationError, never> {
  const normalized = normalizeOptionalString(value) ?? fallback ?? "";
  if (isIataCode(normalized)) {
    return Effect.succeed(normalized);
  }
  return validationFailure(`${field} must be an uppercase 3-letter IATA code`);
}

function requireNonEmptyField(
  value: string,
  field: string
): Effect.Effect<string, ValidationError, never> {
  const normalized = value.trim();
  if (normalized) {
    return Effect.succeed(normalized);
  }
  return validationFailure(`${field} is required`);
}

function normalizeDateFilters(
  dateInput: string | undefined,
  fromInput: string | undefined,
  toInput: string | undefined
): Effect.Effect<NormalizedDateFilters, ValidationError, never> {
  return Effect.gen(function* () {
    const date = normalizeOptionalString(dateInput);
    const dateFrom = normalizeOptionalString(fromInput);
    const dateTo = normalizeOptionalString(toInput);

    if (date && (dateFrom || dateTo)) {
      return yield* validationFailure(
        "date cannot be combined with date_from/date_to"
      );
    }

    yield* ensureIsoDateValue(date, "date");
    yield* ensureIsoDateValue(dateFrom, "date_from");
    yield* ensureIsoDateValue(dateTo, "date_to");

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return yield* validationFailure("date_from cannot be after date_to");
    }

    return {
      date,
      dateFrom,
      dateTo,
    };
  });
}

function ensureIsoDateValue(
  value: string | undefined,
  field: string
): Effect.Effect<void, ValidationError, never> {
  if (!value) {
    return Effect.void;
  }
  if (isIsoDate(value)) {
    return Effect.void;
  }
  return validationFailure(`${field} must be YYYY-MM-DD`);
}

function normalizeCabinField(
  value: string | undefined
): Effect.Effect<Cabin | undefined, ValidationError, never> {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return Effect.succeed(undefined);
  }
  if (isCabin(normalized)) {
    return Effect.succeed(normalized);
  }
  return validationFailure("cabin must be one of: economy, business, first");
}

function normalizeAvailableOnly(
  value: boolean | null | undefined
): Effect.Effect<boolean, ValidationError, never> {
  if (value === null) {
    return validationFailure("available_only must be true or false");
  }
  return Effect.succeed(value ?? true);
}

function normalizePositiveIntFilter(
  field: "points_min" | "points_max",
  value: number | null | undefined
): Effect.Effect<number | undefined, ValidationError, never> {
  if (value === null) {
    return validationFailure(`${field} must be a positive integer`);
  }
  if (value == null) {
    return Effect.succeed(undefined);
  }
  if (Number.isInteger(value) && value > 0) {
    return Effect.succeed(value);
  }
  return validationFailure(`${field} must be a positive integer`);
}

function ensurePointsRange(
  pointsMin: number | undefined,
  pointsMax: number | undefined
): Effect.Effect<void, ValidationError, never> {
  if (
    pointsMin != null &&
    pointsMax != null &&
    Number.isFinite(pointsMin) &&
    Number.isFinite(pointsMax) &&
    pointsMin > pointsMax
  ) {
    return validationFailure("points_min cannot be greater than points_max");
  }
  return Effect.void;
}

function normalizeLimit(
  value: number | null | undefined
): Effect.Effect<number, ValidationError, never> {
  if (value === null) {
    return validationFailure("limit must be an integer between 1 and 500");
  }

  const normalized = value ?? DEFAULT_LIMIT;
  if (
    Number.isInteger(normalized) &&
    normalized >= 1 &&
    normalized <= MAX_LIMIT
  ) {
    return Effect.succeed(normalized);
  }

  return validationFailure("limit must be an integer between 1 and 500");
}

function normalizeOffset(
  value: number | null | undefined
): Effect.Effect<number, ValidationError, never> {
  if (value === null) {
    return validationFailure("offset must be a non-negative integer");
  }

  const normalized = value ?? 0;
  if (Number.isInteger(normalized) && normalized >= 0) {
    return Effect.succeed(normalized);
  }

  return validationFailure("offset must be a non-negative integer");
}

function normalizeSort(
  value: string | undefined
): Effect.Effect<SortOrder, ValidationError, never> {
  const normalized = normalizeOptionalString(value) ?? "date";
  if (isSortOrder(normalized)) {
    return Effect.succeed(normalized);
  }
  return validationFailure("sort must be one of: date, points");
}

function requireRecordText(
  value: string,
  pointer: string,
  field: string
): Effect.Effect<string, ValidationError, never> {
  const normalized = value.trim();
  if (normalized) {
    return Effect.succeed(normalized);
  }
  return recordFailure(pointer, field, "is required");
}

function requireRecordIata(
  value: string | null | undefined,
  pointer: string,
  field: string,
  fallback?: string
): Effect.Effect<string, ValidationError, never> {
  const normalized = normalizeOptionalString(value) ?? fallback ?? "";
  if (isIataCode(normalized)) {
    return Effect.succeed(normalized);
  }
  return recordFailure(
    pointer,
    field,
    "must be an uppercase 3-letter IATA code"
  );
}

function requireRecordIsoDate(
  value: string,
  pointer: string,
  field: string
): Effect.Effect<string, ValidationError, never> {
  const normalized = value.trim();
  if (isIsoDate(normalized)) {
    return Effect.succeed(normalized);
  }
  return recordFailure(pointer, field, "must be YYYY-MM-DD");
}

function requireRecordTime(
  value: string,
  pointer: string,
  field: string
): Effect.Effect<string, ValidationError, never> {
  const normalized = value.trim();
  if (isTime(normalized)) {
    return Effect.succeed(normalized);
  }
  return recordFailure(pointer, field, "must be HH:MM");
}

function normalizeRecordArrivalDayOffset(
  value: number | null | undefined,
  pointer: string
): Effect.Effect<number, ValidationError, never> {
  const normalized = value ?? 0;
  if (Number.isInteger(normalized) && normalized >= 0 && normalized <= 2) {
    return Effect.succeed(normalized);
  }
  return recordFailure(
    pointer,
    "arrival_day_offset",
    "must be one of: 0, 1, 2"
  );
}

function requireRecordPositiveInt(
  value: number | null | undefined,
  pointer: string,
  field: string
): Effect.Effect<number, ValidationError, never> {
  if (value != null && Number.isInteger(value) && value > 0) {
    return Effect.succeed(value);
  }
  return recordFailure(pointer, field, "must be a positive integer");
}

function requireRecordNonNegativeNumber(
  value: number | null | undefined,
  pointer: string,
  field: string
): Effect.Effect<number, ValidationError, never> {
  if (value != null && Number.isFinite(value) && value >= 0) {
    return Effect.succeed(value);
  }
  return recordFailure(pointer, field, "must be a non-negative number");
}

function normalizeRecordRouteType(
  value: string,
  pointer: string
): Effect.Effect<RouteType, ValidationError, never> {
  const normalized = value.trim();
  if (isRouteType(normalized)) {
    return Effect.succeed(normalized);
  }
  return recordFailure(
    pointer,
    "route_type",
    "must be one of: direct, 1-stop, 2-stop"
  );
}

function normalizeRecordCabin(
  value: string,
  pointer: string
): Effect.Effect<Cabin, ValidationError, never> {
  const normalized = value.trim();
  if (isCabin(normalized)) {
    return Effect.succeed(normalized);
  }
  return recordFailure(
    pointer,
    "cabin",
    "must be one of: economy, business, first"
  );
}

function normalizeRecordAvailable(
  value: boolean | null | undefined,
  pointer: string
): Effect.Effect<boolean, ValidationError, never> {
  if (value === null) {
    return recordFailure(pointer, "available", "must be a boolean");
  }
  if (value == null) {
    return Effect.succeed(true);
  }
  if (typeof value === "boolean") {
    return Effect.succeed(value);
  }
  return recordFailure(pointer, "available", "must be a boolean");
}

function normalizeRecordOptionalNonNegativeInt(
  value: number | null | undefined,
  pointer: string,
  field: string
): Effect.Effect<number | null, ValidationError, never> {
  if (value == null) {
    return Effect.succeed(null);
  }
  if (Number.isInteger(value) && value >= 0) {
    return Effect.succeed(value);
  }
  return recordFailure(pointer, field, "must be a non-negative integer");
}

function normalizeRecordOptionalNonNegativeNumber(
  value: number | null | undefined,
  pointer: string,
  field: string
): Effect.Effect<number | null, ValidationError, never> {
  if (value == null) {
    return Effect.succeed(null);
  }
  if (Number.isFinite(value) && value >= 0) {
    return Effect.succeed(value);
  }
  return recordFailure(pointer, field, "must be a non-negative number");
}

function buildWhereClause(filters: FiltersForWhere): WhereClause {
  const where: string[] = ["origin = ?", "destination = ?"];
  const params: Array<string | number> = [filters.origin, filters.destination];

  if (filters.date) {
    where.push("departure_date = ?");
    params.push(filters.date);
  } else {
    if (filters.dateFrom) {
      where.push("departure_date >= ?");
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.push("departure_date <= ?");
      params.push(filters.dateTo);
    }
  }

  if (filters.cabin) {
    where.push("cabin = ?");
    params.push(filters.cabin);
  }
  if (filters.tier) {
    where.push("tier = ?");
    params.push(filters.tier);
  }
  if (filters.programId) {
    where.push("program_id = ?");
    params.push(filters.programId);
  }
  if (filters.availableOnly) {
    where.push("available = 1");
  }
  if (filters.pointsMax != null) {
    where.push("points <= ?");
    params.push(filters.pointsMax);
  }
  if (filters.pointsMin != null) {
    where.push("points >= ?");
    params.push(filters.pointsMin);
  }

  return { sql: `WHERE ${where.join(" AND ")}`, params };
}

function toAwardFlightRow(row: unknown): AwardFlightRow {
  const value = asRecord(row);

  return {
    id: toInt(value.id),
    program_id: asString(value.program_id),
    origin: asString(value.origin),
    destination: asString(value.destination),
    flight_number: asString(value.flight_number),
    departure_date: asString(value.departure_date),
    departure_time: asString(value.departure_time),
    arrival_time: asString(value.arrival_time),
    arrival_day_offset: toInt(value.arrival_day_offset),
    duration_minutes: toInt(value.duration_minutes),
    route_type: asString(value.route_type),
    cabin: asString(value.cabin),
    tier: asString(value.tier),
    points: toInt(value.points),
    available: toInt(value.available) === 1,
    seats_left: nullableInt(value.seats_left),
    taxes_myr: round2(toNumber(value.taxes_myr)),
    cash_equivalent_myr: nullableNumber(value.cash_equivalent_myr),
    notes: toNullableString(value.notes),
    created_at: toNullableString(value.created_at),
    updated_at: toNullableString(value.updated_at),
  };
}

function validationFailure(
  message: string
): Effect.Effect<never, ValidationError, never> {
  return Effect.fail(new ValidationError({ message }));
}

function recordFailure(
  pointer: string,
  field: string,
  message: string
): Effect.Effect<never, ValidationError, never> {
  return Effect.fail(invalidRecord(pointer, field, message));
}

function invalidRecord(
  pointer: string,
  field: string,
  message: string
): ValidationError {
  return new ValidationError({ message: `${pointer}.${field} ${message}` });
}

function changesFromRun(result: unknown): number {
  const meta = asRecord(asRecord(result).meta);
  const changes = toNullableNumber(meta.changes);
  if (changes == null) {
    return 0;
  }
  return Math.max(0, Math.trunc(changes));
}

function toNullableObject<T>(
  value: Record<string, T>
): Record<string, T> | null {
  return Object.keys(value).length > 0 ? value : null;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeOptionalString(
  value: string | null | undefined
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function nullableNumber(value: unknown): number | null {
  const num = toNullableNumber(value);
  return num == null ? null : round2(num);
}

function nullableInt(value: unknown): number | null {
  const num = toNullableNumber(value);
  return num == null ? null : Math.trunc(num);
}

function toNumber(value: unknown): number {
  const num = toNullableNumber(value);
  return num == null ? 0 : num;
}

function toInt(value: unknown): number {
  return Math.trunc(toNumber(value));
}

function isCabin(value: string): value is Cabin {
  return CABINS.has(value as Cabin);
}

function isRouteType(value: string): value is RouteType {
  return ROUTE_TYPES.has(value as RouteType);
}

function isSortOrder(value: string): value is SortOrder {
  return SORT_OPTIONS.has(value as SortOrder);
}
