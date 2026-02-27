# miles-tracker - Award Flight Pricing Database

A Cloudflare Worker backend for storing and querying airline award flight pricing data. Designed to track availability and pricing across multiple loyalty programs (starting with Malaysia Airlines Enrich, extensible to KrisFlyer and others).

## Stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Framework:** Hono v4 (lightweight HTTP routing)
- **Database:** Cloudflare D1 (SQLite)
- **Error Handling:** Effect v3 (typed error channels, composition)
- **Schema & Migrations:** Drizzle ORM (schema definition + migration generation only, no runtime queries)
- **Linting & Formatting:** Biome via ultracite, Lefthook pre-commit hooks
- **Type Checking:** tsgo (10x faster than tsc)

## Architecture

```
src/
├── index.ts              # Hono app entry, CORS, bearer auth, error handling
├── env.ts                # Cloudflare bindings type (DB: D1Database, AUTH_TOKEN)
├── db/
│   ├── client.ts         # Effect Database service tag
│   └── schema.ts         # Drizzle schema (2 tables, 4 indexes)
├── lib/
│   ├── errors.ts         # Tagged error types (ValidationError, DatabaseError, etc.)
│   ├── http.ts           # HTTP response helpers, error mapping
│   └── parse.ts          # Strict input validation (no silent coercion)
├── routes/
│   ├── programs.ts       # GET/POST programs (loyalty programs)
│   └── flights.ts        # GET/POST/DELETE flights, GET /stats
└── services/
    ├── programs.ts       # Program queries & upserts
    └── flights.ts        # Flight search, upsert, delete, stats with dynamic SQL
```

## Database Schema

### `programs` table
Loyalty programs (enrich, krisflyer, etc.)
- `id` (TEXT, PK): Program identifier
- `name`, `airline`, `alliance`: Program metadata
- `created_at`: ISO timestamp

### `award_flights` table
One row per flight-date-cabin-tier combination.
- **Key fields:** `program_id`, `origin`, `destination`, `flight_number`, `departure_date`, `cabin`, `tier`
- **Pricing:** `points`, `taxes_myr`, `cash_equivalent_myr`
- **Availability:** `available`, `seats_left`
- **Metadata:** `route_type`, `departure_time`, `arrival_time`, `duration_minutes`, `notes`
- **Tracking:** `scraped_at` (when data was captured), `created_at`, `updated_at`
- **Unique constraint:** `(program_id, origin, destination, flight_number, departure_date, cabin, tier)`
- **Indexes:** Route+date, program+date, destination+date+cabin

## API Endpoints

All endpoints require `Authorization: Bearer <AUTH_TOKEN>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ping` | Health check (no auth required) |
| GET | `/api/programs` | List all loyalty programs |
| POST | `/api/programs` | Upsert loyalty program |
| GET | `/api/flights` | Search flights (see query params below) |
| POST | `/api/flights` | Upsert one or many flights (max 500) |
| DELETE | `/api/flights` | Delete flights by filter |
| GET | `/api/flights/stats` | Aggregated pricing stats by cabin/tier |

### GET /api/flights Query Parameters
- `destination` (required): IATA code (e.g., "AKL")
- `origin`: Defaults to "KUL"
- `date` or `date_from`/`date_to`: Date filters (YYYY-MM-DD)
- `cabin`: "economy", "business", "first"
- `tier`: Points tier (e.g., "saver", "advantage")
- `program_id`: Filter by program
- `available_only`: Default true (show only available=1)
- `points_min`/`points_max`: Points range filter
- `sort`: "date" (default) or "points"
- `limit`: 1-500, default 200
- `offset`: Pagination offset

## Code Patterns

### Input Validation
- **Strict mode:** No silent coercion. Invalid input fails with descriptive 400 error.
- **IATA codes:** Must be uppercase 3-letter (validated on input).
- **Dates:** YYYY-MM-DD format, validated as real dates.
- **Numbers:** Must be positive integers or non-negative decimals as applicable.

### Error Handling
- All errors are Tagged types: `ValidationError`, `DatabaseError`, `NotFoundError`, `ParseError`.
- Errors propagate through Effect channel; handlers map to HTTP status codes:
  - `ValidationError` → 400
  - `NotFoundError` → 404
  - `DatabaseError` → 500
- All error responses: `{ error: { code, message } }`

### Database Operations
- **Raw SQL at runtime:** No ORM queries; all SQL is hand-written.
- **Dynamic query building:** WHERE clauses built dynamically based on filters (no `? IS NULL` tricks).
- **Batch operations:** Large upserts chunked into groups of 50 (D1 batch limit).
- **Upserts:** `ON CONFLICT ... DO UPDATE` pattern for idempotent writes.

### Effect Composition
- All database work wrapped in `Effect.gen()` for typed composition.
- Service functions return `Effect.Effect<T, ErrorType, Database>`.
- Route handlers provide `Database` service at call time: `Effect.provideService(Database, c.env.DB)`.

## Deployment

```bash
# Local development
bun run dev

# Type checking
bun run typecheck

# Linting
bun run check
bun run fix

# Generate migrations (after schema changes)
bun run db:generate

# Deploy to Cloudflare
bun run deploy
```

**Pre-deployment checklist:**
1. Run `bun run typecheck` and `bun run check` — must pass.
2. Update schema in `src/db/schema.ts` if needed.
3. Run `bun run db:generate` to create migrations.
4. Test locally: `bun run dev` + hit endpoints.
5. Deploy: `bun run deploy`.

## Conventions

- **Files:** kebab-case (`flights.ts`, `award-flights.ts`)
- **Functions/vars:** camelCase (`searchFlights()`, `normalizeFilters()`)
- **Types/interfaces:** PascalCase (`SearchFlightsInput`, `AwardFlightRow`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_LIMIT`, `D1_BATCH_SIZE`)
- **SQL columns:** snake_case (`departure_date`, `program_id`)
- **No barrel exports** — explicit imports per file
- **Timezone:** UTC (all timestamps in ISO/datetime('now'))

## Key Features

- **Upsert semantics:** Re-posting the same route/date/cabin/tier overwrites previous data.
- **Pagination:** Built-in `limit`/`offset` on search results with `meta.total` count.
- **Bulk ingestion:** POST up to 500 flight records per request.
- **Dynamic filtering:** Compose searches by origin, destination, date range, cabin, tier, points, availability.
- **Stats endpoint:** Aggregated min/max/avg points and availability count per cabin/tier.
- **Extensible:** Program model allows adding new loyalty programs without code changes.

## Future Enhancements

- GitHub Actions CI/CD (deploy on main push)
- Price history tracking (separate table for historical analytics)
- Scraper automation (manual data entry → automated polling)
- Real-time alerts (notify when pricing changes)
- Multi-currency support (currently MYR only)
