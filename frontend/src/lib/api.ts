import type {
  CheapestByDateFilters,
  DatePricing,
  DestinationSummary,
  DestinationsFilters,
  FlightSearchResult,
  FlightStats,
  Program,
  SearchFilters,
} from "./types";

const BASE = "/api";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ??
        `API error ${res.status}`
    );
  }
  const json = await res.json();
  // Backend wraps in { ok, data }. Unwrap single-value responses.
  return (json as { data?: T }).data ?? (json as T);
}

/** Like fetchJSON but keeps full response shape (data + meta). */
async function fetchFullJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ??
        `API error ${res.status}`
    );
  }
  const json = await res.json();
  // Strip only the `ok` field, keep data + meta at top level
  const { ok: _, ...rest } = json as Record<string, unknown>;
  return rest as T;
}

function qs(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] != null
  );
  if (entries.length === 0) {
    return "";
  }
  return (
    "?" +
    new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
  );
}

export const milesApi = {
  programs: () => fetchJSON<Program[]>("/programs"),

  flights: (filters: SearchFilters) =>
    fetchFullJSON<FlightSearchResult>(
      `/flights${qs({
        destination: filters.destination,
        origin: filters.origin,
        date_from: filters.date_from,
        date_to: filters.date_to,
        cabin: filters.cabin,
        tier: filters.tier,
        program_id: filters.program_id,
        available_only: filters.available_only,
        points_min: filters.points_min,
        points_max: filters.points_max,
        sort: filters.sort,
        limit: filters.limit,
        offset: filters.offset,
      })}`
    ),

  stats: (filters: Omit<SearchFilters, "sort" | "limit" | "offset">) =>
    fetchJSON<FlightStats>(
      `/flights/stats${qs({
        destination: filters.destination,
        origin: filters.origin,
        date_from: filters.date_from,
        date_to: filters.date_to,
        cabin: filters.cabin,
        tier: filters.tier,
        program_id: filters.program_id,
        available_only: filters.available_only,
      })}`
    ),

  destinations: (filters: DestinationsFilters) =>
    fetchJSON<DestinationSummary[]>(
      `/destinations${qs({
        origin: filters.origin,
        date_from: filters.date_from,
        date_to: filters.date_to,
        cabin: filters.cabin,
        available_only: filters.available_only,
      })}`
    ),

  cheapestByDate: (filters: CheapestByDateFilters) =>
    fetchJSON<DatePricing[]>(
      `/flights/cheapest-by-date${qs({
        destination: filters.destination,
        origin: filters.origin,
        date_from: filters.date_from,
        date_to: filters.date_to,
        cabin: filters.cabin,
        program_id: filters.program_id,
        available_only: filters.available_only,
      })}`
    ),
};
