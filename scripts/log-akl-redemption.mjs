#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_BASE_URL =
  process.env.MILES_TRACKER_API_URL ||
  "https://miles-tracker.leeweisern.workers.dev";
const TRAILING_SLASH_RE = /\/$/;

function parseArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];

    if (!part.startsWith("--")) {
      args._.push(part);
      continue;
    }

    const raw = part.slice(2);
    const eqIndex = raw.indexOf("=");

    if (eqIndex >= 0) {
      const key = raw.slice(0, eqIndex);
      const value = raw.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[raw] = next;
      i += 1;
      continue;
    }

    args[raw] = true;
  }

  return args;
}

function usage() {
  console.log(`miles-tracker CLI - log KUL -> AKL redemption routes

Usage (single record):
  bun run cli:log-akl \\
    --date 2026-06-01 \\
    --flight MH133 \\
    --departure 10:00 \\
    --arrival 21:45 \\
    --duration 645 \\
    --points 45500 \\
    --taxes 220.10

Usage (bulk file):
  bun run cli:log-akl --file ./flights.json

Required (single record):
  --date, --flight, --departure, --arrival, --duration, --points, --taxes

Optional:
  --program-id enrich           (default: enrich)
  --origin KUL                  (default: KUL)
  --destination AKL             (default: AKL)
  --cabin economy               (default: economy)
  --tier saver                  (default: saver)
  --route-type direct           (default: direct)
  --arrival-day-offset 0        (default: 0)
  --available true|false        (default: true)
  --seats-left 2
  --cash-equivalent 1200.50
  --notes "manual entry"
  --scraped-at 2026-02-27T13:00:00Z
  --token <AUTH_TOKEN>          (or env: AUTH_TOKEN / MILES_TRACKER_AUTH_TOKEN)
  --base-url https://...        (or env: MILES_TRACKER_API_URL)
`);
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function asRequiredString(value, fieldName) {
  const next = typeof value === "string" ? value.trim() : "";
  if (!next) {
    fail(`${fieldName} is required`);
  }
  return next;
}

function asOptionalString(value) {
  const next = typeof value === "string" ? value.trim() : "";
  return next || null;
}

function asPositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    fail(`${fieldName} must be a positive integer`);
  }
  return n;
}

function asNonNegativeInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    fail(`${fieldName} must be a non-negative integer`);
  }
  return n;
}

function asNonNegativeNumber(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    fail(`${fieldName} must be a non-negative number`);
  }
  return n;
}

function asBoolean(value, fieldName) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  fail(`${fieldName} must be true or false`);
}

function pick(input, keys, fallback) {
  for (const key of keys) {
    if (input[key] != null) {
      return input[key];
    }
  }
  return fallback;
}

function optionalNonNegativeInt(input, keys, fieldName) {
  const value = pick(input, keys, null);
  if (value == null || value === "") {
    return null;
  }
  return asNonNegativeInt(value, fieldName);
}

function optionalNonNegativeNumber(input, keys, fieldName) {
  const value = pick(input, keys, null);
  if (value == null || value === "") {
    return null;
  }
  return asNonNegativeNumber(value, fieldName);
}

function normalizeRecord(input, index = null) {
  const prefix = index == null ? "record" : `records[${index}]`;

  const record = {
    program_id: asRequiredString(
      pick(input, ["program_id", "programId", "program-id"], "enrich"),
      `${prefix}.program_id`
    ),
    origin: asRequiredString(
      pick(input, ["origin", "from"], "KUL"),
      `${prefix}.origin`
    ),
    destination: asRequiredString(
      pick(input, ["destination", "to"], "AKL"),
      `${prefix}.destination`
    ),
    flight_number: asRequiredString(
      pick(input, ["flight_number", "flightNumber", "flight"], null),
      `${prefix}.flight_number`
    ),
    departure_date: asRequiredString(
      pick(input, ["departure_date", "departureDate", "date"], null),
      `${prefix}.departure_date`
    ),
    departure_time: asRequiredString(
      pick(input, ["departure_time", "departureTime", "departure"], null),
      `${prefix}.departure_time`
    ),
    arrival_time: asRequiredString(
      pick(input, ["arrival_time", "arrivalTime", "arrival"], null),
      `${prefix}.arrival_time`
    ),
    arrival_day_offset: asNonNegativeInt(
      pick(input, ["arrival_day_offset", "arrivalDayOffset"], 0),
      `${prefix}.arrival_day_offset`
    ),
    duration_minutes: asPositiveInt(
      pick(input, ["duration_minutes", "durationMinutes", "duration"], null),
      `${prefix}.duration_minutes`
    ),
    route_type: asRequiredString(
      pick(input, ["route_type", "routeType", "route-type"], "direct"),
      `${prefix}.route_type`
    ),
    cabin: asRequiredString(
      pick(input, ["cabin"], "economy"),
      `${prefix}.cabin`
    ),
    tier: asRequiredString(pick(input, ["tier"], "saver"), `${prefix}.tier`),
    points: asPositiveInt(pick(input, ["points"], null), `${prefix}.points`),
    available: true,
    seats_left: null,
    taxes_myr: asNonNegativeNumber(
      pick(input, ["taxes_myr", "taxesMyr", "taxes"], null),
      `${prefix}.taxes_myr`
    ),
    cash_equivalent_myr: optionalNonNegativeNumber(
      input,
      ["cash_equivalent_myr", "cashEquivalentMyr", "cash-equivalent"],
      `${prefix}.cash_equivalent_myr`
    ),
    notes: asOptionalString(pick(input, ["notes"], null)),
    scraped_at: asOptionalString(
      pick(input, ["scraped_at", "scrapedAt"], null)
    ),
  };

  const rawAvailable = pick(input, ["available"], null);
  record.available =
    rawAvailable == null
      ? true
      : asBoolean(rawAvailable, `${prefix}.available`);

  record.seats_left = optionalNonNegativeInt(
    input,
    ["seats_left", "seatsLeft"],
    `${prefix}.seats_left`
  );

  return record;
}

async function loadRecordsFromFile(filePath) {
  const absolute = resolve(process.cwd(), filePath);
  const raw = await readFile(absolute, "utf8");
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed.map((row, index) => normalizeRecord(row, index));
  }

  return [normalizeRecord(parsed, 0)];
}

function getToken(args) {
  const token =
    args.token ||
    process.env.AUTH_TOKEN ||
    process.env.MILES_TRACKER_AUTH_TOKEN;

  if (!token) {
    fail(
      "Missing token. Pass --token or set AUTH_TOKEN / MILES_TRACKER_AUTH_TOKEN"
    );
  }

  return token;
}

async function postFlights({ baseUrl, token, payload }) {
  const response = await fetch(`${baseUrl}/api/flights`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;

  if (!response.ok) {
    console.error(`HTTP ${response.status} ${response.statusText}`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  return body;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    usage();
    return;
  }

  const token = getToken(args);
  const baseUrl = String(args["base-url"] || DEFAULT_BASE_URL).replace(
    TRAILING_SLASH_RE,
    ""
  );

  const payload = args.file
    ? await loadRecordsFromFile(String(args.file))
    : normalizeRecord(args);

  const body = await postFlights({ baseUrl, token, payload });

  const first = Array.isArray(payload) ? payload[0] : payload;
  console.log("✅ Logged redemption route(s)");
  console.log(`   upserted: ${body?.data?.upserted ?? "unknown"}`);
  console.log(
    `   route: ${first.origin} -> ${first.destination} (${first.departure_date})`
  );
  console.log(`   cabin/tier: ${first.cabin} / ${first.tier}`);
}

main().catch((error) => {
  console.error("Unexpected error:", error?.message ?? error);
  process.exit(1);
});
