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
import { flightsQuery } from "@/lib/queries";
import type { AwardFlight, SearchFilters } from "@/lib/types";
import { cabinColor, cn, fmt, fmtDate, fmtDuration } from "@/lib/utils";

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

  const flights = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const hasSearched = !!activeFilters?.destination;
  const routeOrigin = activeFilters?.origin || "KUL";
  const routeDestination = activeFilters?.destination || "";

  const pageStart = total > 0 ? offset + 1 : 0;
  const pageEnd = total > 0 ? Math.min(offset + flights.length, total) : 0;
  const canPrev = offset > 0 && !isFetching;
  const canNext = pageEnd < total && !isFetching;

  return (
    <div className="space-y-8">
      <Card className="relative animate-fade-in overflow-hidden border-border-bright bg-bg-surface/80 p-6 shadow-elevated md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,164,85,0.14),transparent_55%)]" />
        <div className="relative space-y-6">
          {routeDestination ? (
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
                    {routeDestination}
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-text-secondary uppercase tracking-[0.2em]">
                    {routeDestination}
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
              required
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
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-2 font-semibold text-bg-deep transition-colors hover:bg-gold-bright"
            type="submit"
          >
            <Search className="size-4" />
            Search
          </button>
        </form>
      </Card>

      {hasSearched && !isLoading && !isError && data && (
        <div className="stagger-2 flex animate-fade-in items-center justify-between">
          <p className="font-mono text-text-tertiary text-xs uppercase tracking-wider">
            <Filter className="mr-1.5 inline size-3.5 align-[-2px]" />
            <span className="text-gold">{fmt(total)}</span> flights found
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
            Enter an IATA destination code above and hit search
          </p>
        </div>
      )}

      {hasSearched && isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {hasSearched && isError && (
        <ErrorCard
          message={
            error instanceof Error ? error.message : "Unable to load flights."
          }
          title="Search unavailable"
        />
      )}

      {hasSearched &&
        !isLoading &&
        !isError &&
        data &&
        flights.length === 0 && (
          <Card className="stagger-3 animate-slide-up p-10 text-center">
            <p className="font-display text-3xl text-text-primary">
              No flights found
            </p>
            <p className="mt-3 text-text-secondary">
              Try widening your date range or switching cabin filters.
            </p>
          </Card>
        )}

      {hasSearched && !isError && flights.length > 0 && (
        <div className="space-y-3">
          {flights.map((flight, index) => {
            const availability = seatAvailability(flight);
            return (
              <article
                className={cn(
                  "rounded-xl border border-border bg-bg-surface p-5 transition-all duration-300 hover:border-border-bright hover:shadow-card-hover",
                  "animate-slide-up",
                  STAGGER_CLASSES[Math.min(index, STAGGER_CLASSES.length - 1)]
                )}
                key={flight.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-medium font-mono text-text-primary">
                    {flight.flight_number}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {fmtDate(flight.departure_date)}
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

                <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={flight.cabin}>{flight.cabin}</Badge>
                    <span className="text-sm text-text-secondary capitalize">
                      {flight.tier}
                    </span>
                  </div>

                  <div className="text-right">
                    <p
                      className={cn(
                        "font-mono text-xl",
                        cabinColor(flight.cabin)
                      )}
                    >
                      {fmt(flight.points)} pts
                    </p>
                    <p className="font-mono text-sm text-text-secondary">
                      RM {fmt(flight.taxes_myr, 2)}
                    </p>
                  </div>

                  <p className="flex items-center font-mono text-sm">
                    <span
                      className={cn(
                        "mr-1 inline-block size-2 rounded-full",
                        availability.dot
                      )}
                    />
                    <span className={cn("text-sm", availability.textClass)}>
                      {availability.label}
                    </span>
                  </p>
                </div>
              </article>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="font-mono text-text-tertiary text-xs uppercase tracking-wider">
              <Calendar className="mr-1.5 inline size-3.5 align-[-2px]" />
              Showing {fmt(pageStart)}-{fmt(pageEnd)} of {fmt(total)}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-border px-4 py-2 text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary disabled:opacity-40"
                disabled={!canPrev}
                onClick={() => {
                  setOffset((prev) => Math.max(0, prev - PAGE_SIZE));
                }}
                type="button"
              >
                Prev
              </button>
              <button
                className="rounded-lg border border-border px-4 py-2 text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary disabled:opacity-40"
                disabled={!canNext}
                onClick={() => {
                  setOffset((prev) => prev + PAGE_SIZE);
                }}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
