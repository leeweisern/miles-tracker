import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const programs = sqliteTable("programs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  airline: text("airline").notNull(),
  alliance: text("alliance"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const awardFlights = sqliteTable(
  "award_flights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    flightNumber: text("flight_number").notNull(),
    departureDate: text("departure_date").notNull(),
    departureTime: text("departure_time").notNull(),
    arrivalTime: text("arrival_time").notNull(),
    arrivalDayOffset: integer("arrival_day_offset").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull(),
    routeType: text("route_type").notNull(),
    cabin: text("cabin").notNull(),
    tier: text("tier").notNull(),
    points: integer("points").notNull(),
    available: integer("available").notNull().default(1),
    seatsLeft: integer("seats_left"),
    taxesMyr: real("taxes_myr").notNull(),
    cashEquivalentMyr: real("cash_equivalent_myr"),
    notes: text("notes"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    unique("uq_flight_route_date_cabin_tier").on(
      table.programId,
      table.origin,
      table.destination,
      table.flightNumber,
      table.departureDate,
      table.cabin,
      table.tier
    ),
    index("idx_flights_route_date").on(
      table.origin,
      table.destination,
      table.departureDate
    ),
    index("idx_flights_program_date").on(table.programId, table.departureDate),
    index("idx_flights_destination").on(
      table.destination,
      table.departureDate,
      table.cabin
    ),
  ]
);
