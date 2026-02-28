import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  Clock,
  Filter,
  Plane,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorCard } from "@/components/ui/error-card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { destinationsQuery, flightsQuery } from "@/lib/queries";
import type {
  AwardFlight,
  DestinationSummary,
  DestinationsFilters,
  SearchFilters,
} from "@/lib/types";
import {
  cabinColor,
  cn,
  fmt,
  fmtDate,
  fmtDateShort,
  fmtDuration,
  fmtTimeAgo,
} from "@/lib/utils";

const PAGE_SIZE = 50;
const STAGGER_CLASSES = [
  "stagger-1",
  "stagger-2",
  "stagger-3",
  "stagger-4",
  "stagger-5",
  "stagger-6",
  "stagger-7",
  "stagger-8",
  "stagger-9",
  "stagger-10",
] as const;

interface SearchFormState {
  cabin: SearchFilters["cabin"] | "";
  dateFrom: string;
  dateTo: string;
  destination: string;
  origin: string;
  sort: NonNullable<SearchFilters["sort"]>;
}

interface FlightGroup {
  key: string;
  flight: AwardFlight;
  tiers: AwardFlight[];
}

interface DateSection {
  date: string;
  groups: FlightGroup[];
}

const IATA_INPUT_CLASS =
  "bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary uppercase tracking-wider transition-colors duration-200 focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-gold/30";
const DATE_INPUT_CLASS =
  "bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary transition-colors duration-200 focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-gold/30";

function normalizeIata(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

function buildActiveFilters(
  form: SearchFormState
): Omit<SearchFilters, "limit" | "offset"> {
  const destination = normalizeIata(form.destination);
  const origin = normalizeIata(form.origin) || "KUL";

  return {
    destination,
    origin,
    date_from: form.dateFrom || undefined,
    date_to: form.dateTo || undefined,
    cabin: form.cabin || undefined,
    sort: form.sort,
  };
}

function seatAvailability(flight: AwardFlight) {
  if (flight.available) {
    const seatLabel =
      flight.seats_left != null ? `${flight.seats_left} seats` : "Available";
    return {
      dot: "bg-available",
      textClass: "text-available",
      label: seatLabel,
    };
  }

  return {
    dot: "bg-unavailable",
    textClass: "text-unavailable",
    label: "Unavailable",
  };
}

function groupFlights(flights: AwardFlight[]): FlightGroup[] {
  const groups = new Map<string, AwardFlight[]>();

  for (const flight of flights) {
    const key = `${flight.flight_number}|${flight.departure_date}|${flight.departure_time}|${flight.cabin}`;
    const group = groups.get(key);

    if (group) {
      group.push(flight);
      continue;
    }

    groups.set(key, [flight]);
  }

  return Array.from(groups.entries()).map(([key, tiers]) => {
    const representativeFlight = tiers[0];
    const sortedTiers = [...tiers].sort((a, b) => a.points - b.points);
    return {
      key,
      flight: representativeFlight,
      tiers: sortedTiers,
    };
  });
}

function groupByDate(groups: FlightGroup[]): DateSection[] {
  const dateMap = new Map<string, FlightGroup[]>();
  for (const group of groups) {
    const date = group.flight.departure_date;
    const existing = dateMap.get(date);
    if (existing) {
      existing.push(group);
    } else {
      dateMap.set(date, [group]);
    }
  }
  return Array.from(dateMap.entries()).map(([date, groups]) => ({
    date,
    groups,
  }));
}

function getLatestScrapedAt(flights: AwardFlight[]): string | null {
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  let latestIso: string | null = null;

  for (const flight of flights) {
    const iso = flight.updated_at;
    if (!iso) {
      continue;
    }

    const timestamp = Date.parse(iso);
    if (Number.isNaN(timestamp)) {
      continue;
    }

    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestIso = iso;
    }
  }

  return latestIso;
}

interface AnywhereResultsProps {
  destinations: DestinationSummary[];
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  onDestinationSelect: (destination: string) => void;
}

function AnywhereResults({
  destinations,
  error,
  isError,
  isLoading,
  onDestinationSelect,
}: AnywhereResultsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="stagger-3 h-36 animate-slide-up" />
        <Skeleton className="stagger-4 h-36 animate-slide-up" />
        <Skeleton className="stagger-5 h-36 animate-slide-up" />
        <Skeleton className="stagger-6 h-36 animate-slide-up" />
        <Skeleton className="stagger-7 h-36 animate-slide-up" />
        <Skeleton className="stagger-8 h-36 animate-slide-up" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorCard
        message={
          error instanceof Error ? error.message : "Unable to load destinations."
        }
        title="Explore unavailable"
      />
    );
  }

  if (destinations.length === 0) {
    return (
      <Card className="stagger-3 animate-slide-up p-10 text-center">
        <p className="font-display text-3xl text-text-primary">
          No destinations found
        </p>
        <p className="mt-3 text-text-secondary">
          Try widening your date range or switching cabin filters.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {destinations.map((dest) => (
        <button
          className="rounded-xl border border-border bg-bg-surface p-5 text-left transition-all hover:border-gold/50 hover:shadow-card-hover"
          key={dest.destination}
          onClick={() => {
            onDestinationSelect(dest.destination);
          }}
          type="button"
        >
          <div className="flex items-center justify-between">
            <p className="font-display text-3xl text-gold">{dest.destination}</p>
            <span className="font-mono text-text-tertiary text-xs">
              {fmt(dest.flight_count)} flights
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {dest.economy_min_points != null && (
              <Badge variant="economy">
                Economy from {fmt(dest.economy_min_points)}
              </Badge>
            )}
            {dest.business_min_points != null && (
              <Badge variant="business">
                Business from {fmt(dest.business_min_points)}
              </Badge>
            )}
            {dest.first_min_points != null && (
              <Badge variant="first">First from {fmt(dest.first_min_points)}</Badge>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-text-tertiary text-xs">
            <span>
              {fmtDateShort(dest.date_range.from)} - {fmtDateShort(dest.date_range.to)}
            </span>
            {dest.last_updated && (
              <span>Updated {fmtTimeAgo(dest.last_updated)}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

interface RouteFlightResultsProps {
  canNext: boolean;
  canPrev: boolean;
  dataLoaded: boolean;
  dateSections: DateSection[];
  error: unknown;
  flights: AwardFlight[];
  isError: boolean;
  isLoading: boolean;
  offset: number;
  onNext: () => void;
  onPrev: () => void;
  total: number;
}

function RouteFlightResults({
  canNext,
  canPrev,
  dataLoaded,
  dateSections,
  error,
  flights,
  isError,
  isLoading,
  offset,
  onNext,
  onPrev,
  total,
}: RouteFlightResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorCard
        message={error instanceof Error ? error.message : "Unable to load flights."}
        title="Search unavailable"
      />
    );
  }

  if (!dataLoaded || flights.length === 0) {
    return (
      <Card className="stagger-3 animate-slide-up p-10 text-center">
        <p className="font-display text-3xl text-text-primary">No flights found</p>
        <p className="mt-3 text-text-secondary">
          Try widening your date range or switching cabin filters.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {dateSections.map((section) => {
        const latestSectionUpdate = getLatestScrapedAt(
          section.groups.flatMap((group) => group.tiers)
        );

        return (
          <section key={section.date}>
            <div className="mb-3 flex items-center gap-3">
              <Calendar className="size-4 text-gold" />
              <h3 className="font-display text-lg text-text-primary tracking-wide">
                {fmtDate(section.date)}
              </h3>
              <span className="h-px flex-1 bg-border" />
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-text-tertiary uppercase tracking-wider">
                  {section.groups.length} {section.groups.length === 1 ? "flight" : "flights"}
                </span>
                {latestSectionUpdate && (
                  <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
                    Updated {fmtTimeAgo(latestSectionUpdate)}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {section.groups.map((group, index) => {
                const flight = group.flight;
                const hasSharedTaxes = group.tiers.every(
                  (tier) => tier.taxes_myr === flight.taxes_myr
                );

                return (
                  <article
                    className={cn(
                      "rounded-xl border border-border bg-bg-surface p-5 transition-all duration-300 hover:border-border-bright hover:shadow-card-hover",
                      "animate-slide-up",
                      STAGGER_CLASSES[Math.min(index, STAGGER_CLASSES.length - 1)]
                    )}
                    key={group.key}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-medium font-mono text-text-primary">
                        {flight.flight_number}
                      </p>
                      <p className="text-text-tertiary text-xs uppercase">
                        {flight.route_type}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <p className="font-mono text-lg text-text-primary">
                        {flight.departure_time}
                        <ArrowRight className="mx-2 inline size-4 text-gold" />
                        {flight.arrival_time}
                        {flight.arrival_day_offset > 0 && (
                          <sup className="ml-1 align-super text-text-tertiary text-xs">
                            +{flight.arrival_day_offset}
                          </sup>
                        )}
                      </p>
                      <p className="font-mono text-sm text-text-secondary">
                        <Clock className="mr-1.5 inline size-3.5 align-[-2px]" />
                        {fmtDuration(flight.duration_minutes)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={flight.cabin}>{flight.cabin}</Badge>
                        {hasSharedTaxes && (
                          <span className="font-mono text-text-secondary text-xs">
                            RM {fmt(flight.taxes_myr, 2)} taxes
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-64 flex-1 flex-wrap gap-2">
                        {group.tiers.map((tier) => {
                          const availability = seatAvailability(tier);

                          return (
                            <div
                              className="min-w-32 flex-1 rounded-lg border border-border/80 bg-bg-elevated/70 px-3 py-2"
                              key={tier.id}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-mono text-[11px] text-text-secondary uppercase tracking-wider">
                                  {tier.tier}
                                </p>
                                <span
                                  className={cn(
                                    "inline-block size-2 rounded-full",
                                    availability.dot
                                  )}
                                  title={availability.label}
                                />
                              </div>
                              <p
                                className={cn(
                                  "mt-1 font-mono text-sm",
                                  cabinColor(flight.cabin)
                                )}
                              >
                                {fmt(tier.points)} pts
                              </p>
                              {!hasSharedTaxes && (
                                <p className="mt-0.5 font-mono text-[11px] text-text-secondary">
                                  RM {fmt(tier.taxes_myr, 2)} taxes
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="font-mono text-text-tertiary text-xs uppercase tracking-wider">
          Page {fmt(Math.floor(offset / PAGE_SIZE) + 1)} of {fmt(Math.ceil(total / PAGE_SIZE))}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-border px-4 py-2 text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary disabled:opacity-40"
            disabled={!canPrev}
            onClick={onPrev}
            type="button"
          >
            Prev
          </button>
          <button
            className="rounded-lg border border-border px-4 py-2 text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary disabled:opacity-40"
            disabled={!canNext}
            onClick={onNext}
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function FlightSearch() {
  const [form, setForm] = useState<SearchFormState>({
    origin: "KUL",
    destination: "",
    dateFrom: "",
    dateTo: "",
    cabin: "",
    sort: "date",
  });
  const [activeFilters, setActiveFilters] = useState<Omit<
    SearchFilters,
    "limit" | "offset"
  > | null>(null);
  const [offset, setOffset] = useState(0);

  const filters: SearchFilters = {
    destination: activeFilters?.destination ?? "",
    origin: activeFilters?.origin,
    date_from: activeFilters?.date_from,
    date_to: activeFilters?.date_to,
    cabin: activeFilters?.cabin,
    sort: activeFilters?.sort,
    limit: PAGE_SIZE,
    offset,
  };

  const { data, error, isError, isFetching, isLoading } = useQuery(
    flightsQuery(filters)
  );

  const isAnywhereMode = !!activeFilters && !activeFilters.destination;

  const destinationsFilters: DestinationsFilters = {
    origin: activeFilters?.origin,
    date_from: activeFilters?.date_from,
    date_to: activeFilters?.date_to,
    cabin: activeFilters?.cabin,
  };

  const destQuery = useQuery({
    ...destinationsQuery(destinationsFilters),
    enabled: isAnywhereMode,
  });

  const flights = data?.data ?? [];
  const destinations: DestinationSummary[] = destQuery.data ?? [];
  const total = data?.meta.total ?? 0;
  const flightGroups = groupFlights(flights);
  const dateSections = groupByDate(flightGroups);
  const hasSearched = !!activeFilters;
  const routeOrigin = activeFilters?.origin || "KUL";
  const routeDestination = activeFilters?.destination || "";
  const routeDestinationLabel = isAnywhereMode ? "Anywhere" : routeDestination;

  const pageEnd = total > 0 ? Math.min(offset + flights.length, total) : 0;
  const canPrev = offset > 0 && !isFetching;
  const canNext = pageEnd < total && !isFetching;
  const showRouteSummary =
    hasSearched && !isAnywhereMode && !isLoading && !isError && data;

  function handleSelectDestination(destination: string) {
    setForm((prev) => ({ ...prev, destination }));
    setOffset(0);
    setActiveFilters(
      buildActiveFilters({
        ...form,
        destination,
      })
    );
  }

  return (
    <div className="space-y-8">
      <Card className="relative animate-fade-in overflow-hidden border-border-bright bg-bg-surface/80 p-6 shadow-elevated md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,164,85,0.14),transparent_55%)]" />
        <div className="relative space-y-6">
          {activeFilters ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3 md:gap-6">
                <div className="text-center">
                  <p className="font-display text-5xl text-text-primary leading-none md:text-6xl">
                    {routeOrigin}
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-text-secondary uppercase tracking-[0.2em]">
                    {routeOrigin}
                  </p>
                </div>

                <div className="flex min-w-32 items-center gap-2 text-gold md:min-w-48 md:gap-3">
                  <span className="h-px flex-1 bg-gold/60" />
                  <Plane className="size-4 md:size-5" strokeWidth={1.6} />
                  <span className="h-px flex-1 bg-gold/60" />
                  <ArrowRight className="size-4 md:size-5" />
                </div>

                <div className="text-center">
                  <p className="font-display text-5xl text-gold leading-none md:text-6xl">
                    {routeDestinationLabel}
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-text-secondary uppercase tracking-[0.2em]">
                    {routeDestinationLabel}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <p className="font-display text-5xl text-gold leading-none md:text-6xl">
                Where to?
              </p>
              <p className="font-mono text-text-secondary text-xs uppercase tracking-[0.18em]">
                Enter a destination to reveal award inventory
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="stagger-1 animate-slide-up p-5 md:p-6">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setOffset(0);
            setActiveFilters(buildActiveFilters(form));
          }}
        >
          <div className="min-w-24 flex-1 sm:flex-none">
            <label
              className="mb-1.5 block font-mono text-[10px] text-text-tertiary uppercase tracking-wider"
              htmlFor="flight-origin"
            >
              Origin
            </label>
            <input
              className={IATA_INPUT_CLASS}
              id="flight-origin"
              maxLength={3}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  origin: normalizeIata(event.target.value),
                }));
              }}
              type="text"
              value={form.origin}
            />
          </div>

          <div className="min-w-24 flex-1 sm:flex-none">
            <label
              className="mb-1.5 block font-mono text-[10px] text-text-tertiary uppercase tracking-wider"
              htmlFor="flight-destination"
            >
              Destination
            </label>
            <input
              className={IATA_INPUT_CLASS}
              id="flight-destination"
              maxLength={3}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  destination: normalizeIata(event.target.value),
                }));
              }}
              type="text"
              value={form.destination}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block font-mono text-[10px] text-text-tertiary uppercase tracking-wider"
              htmlFor="flight-date-from"
            >
              Date from
            </label>
            <input
              className={DATE_INPUT_CLASS}
              id="flight-date-from"
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  dateFrom: event.target.value,
                }));
              }}
              type="date"
              value={form.dateFrom}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block font-mono text-[10px] text-text-tertiary uppercase tracking-wider"
              htmlFor="flight-date-to"
            >
              Date to
            </label>
            <input
              className={DATE_INPUT_CLASS}
              id="flight-date-to"
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  dateTo: event.target.value,
                }));
              }}
              type="date"
              value={form.dateTo}
            />
          </div>

          <Select
            className="min-w-32"
            id="flight-cabin"
            label="Cabin"
            onChange={(event) => {
              setForm((prev) => ({
                ...prev,
                cabin: event.target.value as SearchFormState["cabin"],
              }));
            }}
            value={form.cabin}
          >
            <option value="">All</option>
            <option value="economy">Economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </Select>

          <Select
            className="min-w-32"
            id="flight-sort"
            label="Sort"
            onChange={(event) => {
              setForm((prev) => ({
                ...prev,
                sort: event.target.value as SearchFormState["sort"],
              }));
            }}
            value={form.sort}
          >
            <option value="date">Date</option>
            <option value="points">Points</option>
          </Select>

          <button
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-2 font-semibold text-white transition-colors hover:bg-gold-bright"
            type="submit"
          >
            <Search className="size-4" />
            Search
          </button>
        </form>
      </Card>

      {showRouteSummary && (
        <div className="stagger-2 flex animate-fade-in items-center justify-between">
          <p className="font-mono text-text-tertiary text-xs uppercase tracking-wider">
            <Filter className="mr-1.5 inline size-3.5 align-[-2px]" />
            <span className="text-gold">{fmt(flightGroups.length)}</span> flights found
          </p>
          {isFetching && (
            <span className="font-mono text-[10px] text-text-secondary uppercase tracking-wider">
              Updating...
            </span>
          )}
        </div>
      )}

      {!hasSearched && (
        <div className="stagger-2 animate-slide-up py-8 text-center">
          <p className="font-mono text-text-tertiary text-xs uppercase tracking-[0.15em]">
            Enter a destination code or leave empty to explore all routes
          </p>
        </div>
      )}

      {hasSearched && isAnywhereMode && (
        <AnywhereResults
          destinations={destinations}
          error={destQuery.error}
          isError={destQuery.isError}
          isLoading={destQuery.isLoading}
          onDestinationSelect={handleSelectDestination}
        />
      )}

      {hasSearched && !isAnywhereMode && (
        <RouteFlightResults
          canNext={canNext}
          canPrev={canPrev}
          dataLoaded={!!data}
          dateSections={dateSections}
          error={error}
          flights={flights}
          isError={isError}
          isLoading={isLoading}
          offset={offset}
          onNext={() => {
            setOffset((prev) => prev + PAGE_SIZE);
          }}
          onPrev={() => {
            setOffset((prev) => Math.max(0, prev - PAGE_SIZE));
          }}
          total={total}
        />
      )}
    </div>
  );
}
