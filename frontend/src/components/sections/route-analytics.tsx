import { useQuery } from "@tanstack/react-query";
import { BarChart3, Calendar, Plane, TrendingUp } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { BarChartCard } from "@/components/charts/bar-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardValue,
} from "@/components/ui/card";
import { ErrorCard } from "@/components/ui/error-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cheapestByDateQuery,
  destinationsQuery,
  flightStatsQuery,
} from "@/lib/queries";
import type {
  CheapestByDateFilters,
  DatePricing,
  DestinationSummary,
  DestinationsFilters,
  FlightStats,
  TierStats,
} from "@/lib/types";
import { cn, fmt, fmtDate, fmtDateShort, fmtTimeAgo } from "@/lib/utils";

const CABIN_KEYS = ["economy", "business", "first"] as const;
const STAGGER_CLASSES = [
  "stagger-1",
  "stagger-2",
  "stagger-3",
  "stagger-4",
  "stagger-5",
  "stagger-6",
] as const;

type CabinKey = (typeof CABIN_KEYS)[number];
type StatsFilters = Parameters<typeof flightStatsQuery>[0];
type CabinFilter = "all" | CabinKey;
type DateSortKey = "date" | "economy" | "business" | "first";

interface RouteFormState {
  cabin: CabinFilter;
  date_from: string;
  date_to: string;
  destination: string;
  origin: string;
}

const CABIN_META: Record<
  CabinKey,
  {
    label: string;
    borderClass: string;
    textClass: string;
    bgClass: string;
    chartColor: string;
    badgeVariant: "economy" | "business" | "first";
  }
> = {
  economy: {
    label: "Economy",
    borderClass: "border-t-cabin-economy",
    textClass: "text-cabin-economy",
    bgClass: "bg-cabin-economy/15",
    chartColor: "#7885a0",
    badgeVariant: "economy",
  },
  business: {
    label: "Business",
    borderClass: "border-t-cabin-business",
    textClass: "text-cabin-business",
    bgClass: "bg-cabin-business/15",
    chartColor: "#c8a455",
    badgeVariant: "business",
  },
  first: {
    label: "First",
    borderClass: "border-t-cabin-first",
    textClass: "text-cabin-first",
    bgClass: "bg-cabin-first/15",
    chartColor: "#c87a5a",
    badgeVariant: "first",
  },
};

function hasTierData(
  tierStats: Record<string, TierStats> | null
): tierStats is Record<string, TierStats> {
  return tierStats != null && Object.keys(tierStats).length > 0;
}

function formatDateLabel(date: string | null): string {
  if (!date) {
    return "--";
  }
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildChartData(stats: FlightStats) {
  const tierSet = new Set<string>();

  for (const cabin of CABIN_KEYS) {
    const cabinStats = stats[cabin];
    if (!cabinStats) {
      continue;
    }
    for (const tier of Object.keys(cabinStats)) {
      tierSet.add(tier);
    }
  }

  return Array.from(tierSet)
    .sort((a, b) => a.localeCompare(b))
    .map((tier) => ({
      tier: tier.toUpperCase(),
      economy: stats.economy?.[tier]?.avg_points,
      business: stats.business?.[tier]?.avg_points,
      first: stats.first?.[tier]?.avg_points,
    }));
}

function normalizeIata(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

function cabinPoints(row: DatePricing, cabin: Exclude<DateSortKey, "date">) {
  return row[cabin]?.min_points ?? null;
}

export function RouteAnalytics() {
  const [form, setForm] = useState<RouteFormState>({
    origin: "KUL",
    destination: "",
    date_from: "",
    date_to: "",
    cabin: "all",
  });
  const [activeFilters, setActiveFilters] = useState<StatsFilters | null>(null);
  const [dateSortKey, setDateSortKey] = useState<DateSortKey>("date");

  const hasSearched = activeFilters !== null;
  const isAnywhereMode = !!activeFilters && !activeFilters.destination;
  const isRouteMode = !!activeFilters?.destination;

  const statsQuery = useQuery({
    ...flightStatsQuery(activeFilters ?? { destination: "" }),
    enabled: isRouteMode,
  });
  const stats = statsQuery.data;

  const destinationsFilters: DestinationsFilters = {
    origin: activeFilters?.origin,
    date_from: activeFilters?.date_from,
    date_to: activeFilters?.date_to,
    cabin: activeFilters?.cabin,
  };
  const destinationsListQuery = useQuery({
    ...destinationsQuery(destinationsFilters),
    enabled: isAnywhereMode,
  });
  const destinations: DestinationSummary[] = destinationsListQuery.data ?? [];

  const cheapestByDateFilters: CheapestByDateFilters = {
    destination: activeFilters?.destination ?? "",
    origin: activeFilters?.origin,
    date_from: activeFilters?.date_from,
    date_to: activeFilters?.date_to,
    cabin: activeFilters?.cabin,
  };
  const cheapestDatesQuery = useQuery({
    ...cheapestByDateQuery(cheapestByDateFilters),
    enabled: isRouteMode,
  });
  const datePricing: DatePricing[] = cheapestDatesQuery.data ?? [];

  const highlightedDateRows = useMemo(() => {
    const highlighted = new Set<string>();
    const cabins: Exclude<DateSortKey, "date">[] = [
      "economy",
      "business",
      "first",
    ];

    for (const cabin of cabins) {
      let minPoints: number | null = null;
      for (const row of datePricing) {
        const pts = cabinPoints(row, cabin);
        if (pts != null && (minPoints == null || pts < minPoints)) {
          minPoints = pts;
        }
      }
      if (minPoints == null) {
        continue;
      }

      for (const row of datePricing) {
        if (cabinPoints(row, cabin) === minPoints) {
          highlighted.add(row.departure_date);
        }
      }
    }

    return highlighted;
  }, [datePricing]);

  const hasAnyLastUpdated = useMemo(
    () => datePricing.some((row) => row.last_updated != null),
    [datePricing]
  );

  const sortedDates = useMemo(() => {
    const sorted = [...datePricing];
    if (dateSortKey === "date") {
      sorted.sort((left, right) =>
        left.departure_date.localeCompare(right.departure_date)
      );
      return sorted;
    }

    sorted.sort((left, right) => {
      const leftPoints = cabinPoints(left, dateSortKey);
      const rightPoints = cabinPoints(right, dateSortKey);
      if (leftPoints == null && rightPoints == null) {
        return left.departure_date.localeCompare(right.departure_date);
      }
      if (leftPoints == null) {
        return 1;
      }
      if (rightPoints == null) {
        return -1;
      }
      if (leftPoints !== rightPoints) {
        return leftPoints - rightPoints;
      }
      return left.departure_date.localeCompare(right.departure_date);
    });

    return sorted;
  }, [datePricing, dateSortKey]);

  const cabinCards =
    stats == null
      ? []
      : CABIN_KEYS.flatMap((cabin) => {
          const tiers = stats[cabin];
          if (!hasTierData(tiers)) {
            return [];
          }
          const entries = Object.entries(tiers).sort(
            (a, b) => a[1].avg_points - b[1].avg_points
          );
          return [{ cabin, entries }];
        });

  const chartData = stats ? buildChartData(stats) : [];

  const cabinAvailability = cabinCards.map(({ cabin, entries }) => ({
    cabin,
    count: entries.reduce(
      (sum, [, tierStats]) => sum + tierStats.available_count,
      0
    ),
  }));

  const noData =
    hasSearched &&
    isRouteMode &&
    !statsQuery.isPending &&
    !statsQuery.isError &&
    (stats == null || stats.total_flights === 0);

  const isSubmitDisabled = false;

  function submitFilters(destinationInput: string) {
    const destination = normalizeIata(destinationInput);
    const origin = normalizeIata(form.origin) || "KUL";

    setDateSortKey("date");
    setActiveFilters({
      destination,
      origin,
      date_from: form.date_from || undefined,
      date_to: form.date_to || undefined,
      cabin: form.cabin === "all" ? undefined : form.cabin,
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitFilters(form.destination);
  }

  function analyzeDestination(destination: string) {
    setForm((prev) => ({ ...prev, destination }));
    submitFilters(destination);
  }

  return (
    <section className="animate-fade-in space-y-7">
      <header className="stagger-1 animate-slide-up space-y-2">
        <h2 className="font-display text-4xl text-text-primary tracking-wide sm:text-5xl">
          Route Analytics
        </h2>
        <p className="text-text-secondary">
          Award flight pricing analysis across cabins and tiers.
        </p>
      </header>

      <Card className="stagger-2 animate-slide-up border-border-bright/70 bg-bg-surface/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <Plane className="size-4 text-gold" />
            Route Selector
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6"
            onSubmit={onSubmit}
          >
            <label
              className="flex flex-col gap-1.5 lg:col-span-1"
              htmlFor="analytics-origin"
            >
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
                Origin
              </span>
              <input
                className="rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary transition-colors duration-200 focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-gold/30"
                id="analytics-origin"
                maxLength={3}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    origin: normalizeIata(event.target.value),
                  }))
                }
                placeholder="KUL"
                value={form.origin}
              />
            </label>

            <label
              className="flex flex-col gap-1.5 lg:col-span-1"
              htmlFor="analytics-destination"
            >
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
                Destination
              </span>
              <input
                className="rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary transition-colors duration-200 focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-gold/30"
                id="analytics-destination"
                maxLength={3}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    destination: normalizeIata(event.target.value),
                  }))
                }
                placeholder="LHR"
                value={form.destination}
              />
            </label>

            <label
              className="flex flex-col gap-1.5 lg:col-span-1"
              htmlFor="analytics-date-from"
            >
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
                Date From
              </span>
              <input
                className="rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary transition-colors duration-200 focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-gold/30"
                id="analytics-date-from"
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    date_from: event.target.value,
                  }))
                }
                type="date"
                value={form.date_from}
              />
            </label>

            <label
              className="flex flex-col gap-1.5 lg:col-span-1"
              htmlFor="analytics-date-to"
            >
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
                Date To
              </span>
              <input
                className="rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary transition-colors duration-200 focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-gold/30"
                id="analytics-date-to"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, date_to: event.target.value }))
                }
                type="date"
                value={form.date_to}
              />
            </label>

            <label
              className="flex flex-col gap-1.5 lg:col-span-1"
              htmlFor="analytics-cabin"
            >
              <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
                Cabin
              </span>
              <select
                className="rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary transition-colors duration-200 focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-gold/30"
                id="analytics-cabin"
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    cabin: event.target.value as CabinFilter,
                  }))
                }
                value={form.cabin}
              >
                <option value="all">All Cabins</option>
                <option value="economy">Economy</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </select>
            </label>

            <div className="flex items-end lg:col-span-1">
              <button
                className={cn(
                  "w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-sm text-white transition-all duration-200",
                  "hover:bg-gold-bright focus:outline-none focus:ring-2 focus:ring-gold/40",
                  "disabled:cursor-not-allowed disabled:opacity-55"
                )}
                disabled={
                  isSubmitDisabled ||
                  statsQuery.isFetching ||
                  destinationsListQuery.isFetching
                }
                type="submit"
              >
                {statsQuery.isFetching || destinationsListQuery.isFetching
                  ? "Analyzing..."
                  : "Analyze"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!hasSearched && (
        <Card className="stagger-3 animate-slide-up border-dashed">
          <CardContent className="flex min-h-40 items-center justify-center py-12">
            <p className="text-center font-display text-2xl text-text-secondary">
              Enter a route to analyze, or leave destination empty to explore.
            </p>
          </CardContent>
        </Card>
      )}

      {hasSearched && isAnywhereMode && destinationsListQuery.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="stagger-3 h-36 animate-slide-up" />
          <Skeleton className="stagger-4 h-36 animate-slide-up" />
          <Skeleton className="stagger-5 h-36 animate-slide-up" />
          <Skeleton className="stagger-6 h-36 animate-slide-up" />
          <Skeleton className="stagger-6 h-36 animate-slide-up" />
          <Skeleton className="stagger-6 h-36 animate-slide-up" />
        </div>
      )}

      {hasSearched && isAnywhereMode && destinationsListQuery.isError && (
        <div className="stagger-3 animate-slide-up">
          <ErrorCard
            message={
              destinationsListQuery.error instanceof Error
                ? destinationsListQuery.error.message
                : "Unable to load destinations."
            }
            title="Explore unavailable"
          />
        </div>
      )}

      {hasSearched &&
        isAnywhereMode &&
        !destinationsListQuery.isPending &&
        !destinationsListQuery.isError &&
        destinations.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((dest) => (
              <button
                className="rounded-xl border border-border bg-bg-surface p-5 text-left transition-all hover:border-gold/50 hover:shadow-card-hover"
                key={dest.destination}
                onClick={() => {
                  analyzeDestination(dest.destination);
                }}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <p className="font-display text-3xl text-gold">{dest.destination}</p>
                  <span className="font-mono text-xs text-text-tertiary">
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
                <div className="mt-3 flex items-center justify-between text-xs text-text-tertiary">
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
        )}

      {hasSearched &&
        isAnywhereMode &&
        !destinationsListQuery.isPending &&
        !destinationsListQuery.isError &&
        destinations.length === 0 && (
          <Card className="stagger-3 animate-slide-up border-border-bright/60">
            <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 py-12 text-center">
              <Plane className="size-5 text-text-tertiary" />
              <p className="font-display text-2xl text-text-primary">
                No destinations found
              </p>
              <p className="text-sm text-text-secondary">
                Try a wider date range or a different cabin.
              </p>
            </CardContent>
          </Card>
        )}

      {hasSearched && isRouteMode && statsQuery.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="stagger-3 h-48 animate-slide-up" />
          <Skeleton className="stagger-4 h-48 animate-slide-up" />
          <Skeleton className="stagger-5 h-48 animate-slide-up" />
        </div>
      )}

      {hasSearched && isRouteMode && statsQuery.isError && (
        <div className="stagger-3 animate-slide-up">
          <ErrorCard
            message={
              statsQuery.error instanceof Error
                ? statsQuery.error.message
                : "Unable to load route analytics."
            }
            title="Analytics unavailable"
          />
        </div>
      )}

      {noData && (
        <Card className="stagger-3 animate-slide-up border-border-bright/60">
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 py-12 text-center">
            <Plane className="size-5 text-text-tertiary" />
            <p className="font-display text-2xl text-text-primary">
              No stats available for this route
            </p>
            <p className="text-sm text-text-secondary">
              Try a wider date range or a different destination.
            </p>
          </CardContent>
        </Card>
      )}

      {isRouteMode &&
        stats != null &&
        !noData &&
        !statsQuery.isPending &&
        !statsQuery.isError && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cabinCards.map(({ cabin, entries }, index) => {
                const meta = CABIN_META[cabin];
                return (
                  <Card
                    className={cn(
                      "animate-slide-up overflow-hidden border border-border bg-bg-surface",
                      "border-t-[3px]",
                      meta.borderClass,
                      STAGGER_CLASSES[index] ?? STAGGER_CLASSES.at(-1)
                    )}
                    key={cabin}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-text-primary">
                          {meta.label}
                        </CardTitle>
                        <Badge variant={meta.badgeVariant}>
                          {entries.length} tiers
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {entries.map(([tier, tierStats]) => (
                        <div
                          className={cn(
                            "rounded-lg border border-border/80 p-3",
                            meta.bgClass
                          )}
                          key={`${cabin}-${tier}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={cn(
                                "font-mono text-[11px] uppercase tracking-wider",
                                meta.textClass
                              )}
                            >
                              {tier}
                            </p>
                            <p className="font-mono text-text-secondary text-xs">
                              avg {fmt(tierStats.avg_points)} pts
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-text-primary">
                            {fmt(tierStats.min_points)} -{" "}
                            {fmt(tierStats.max_points)} pts
                          </p>
                          <p
                            className={cn(
                              "mt-1 font-mono text-xs",
                              tierStats.available_count > 0
                                ? "text-available"
                                : "text-unavailable"
                            )}
                          >
                            {fmt(tierStats.available_count)} available
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="stagger-4 animate-slide-up border-border-bright/70 bg-bg-surface">
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-text-primary">
                    <BarChart3 className="size-4 text-gold" />
                    Pricing Distribution
                  </CardTitle>
                  <p className="mt-1 text-text-secondary text-xs">
                    Average points by tier and cabin class.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {chartData.length > 0 ? (
                  <BarChartCard
                    bars={CABIN_KEYS.map((cabin) => ({
                      dataKey: cabin,
                      color: CABIN_META[cabin].chartColor,
                      label: CABIN_META[cabin].label,
                    }))}
                    data={chartData}
                    formatTooltip={(value) => `${fmt(value)} pts`}
                    height={250}
                    showLegend
                    xKey="tier"
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center">
                    <p className="font-display text-text-secondary text-xl">
                      No tier data available
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {cheapestDatesQuery.isPending && (
              <Card className="stagger-5 animate-slide-up border-border-bright/70 bg-bg-surface">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-text-primary">
                    <Calendar className="size-4 text-gold" />
                    Best Dates to Book
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            )}

            {cheapestDatesQuery.isError && (
              <div className="stagger-5 animate-slide-up">
                <ErrorCard
                  message={
                    cheapestDatesQuery.error instanceof Error
                      ? cheapestDatesQuery.error.message
                      : "Unable to load best dates."
                  }
                  title="Best dates unavailable"
                />
              </div>
            )}

            {!cheapestDatesQuery.isPending && !cheapestDatesQuery.isError && (
              <Card className="stagger-5 animate-slide-up border-border-bright/70 bg-bg-surface">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-text-primary">
                    <Calendar className="size-4 text-gold" />
                    Best Dates to Book
                  </CardTitle>
                  <p className="mt-1 text-text-secondary text-xs">
                    Lowest points per date. Gold rows are the cheapest.
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  {sortedDates.length === 0 ? (
                    <div className="flex min-h-28 items-center justify-center">
                      <p className="font-display text-text-secondary text-xl">
                        No date pricing available
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th
                              className="cursor-pointer py-2 font-mono text-xs text-text-tertiary uppercase tracking-wider"
                              onClick={() => {
                                setDateSortKey("date");
                              }}
                            >
                              Date
                            </th>
                            <th
                              className="cursor-pointer py-2 text-right font-mono text-xs text-text-tertiary uppercase tracking-wider"
                              onClick={() => {
                                setDateSortKey("economy");
                              }}
                            >
                              Economy
                            </th>
                            <th
                              className="cursor-pointer py-2 text-right font-mono text-xs text-text-tertiary uppercase tracking-wider"
                              onClick={() => {
                                setDateSortKey("business");
                              }}
                            >
                              Business
                            </th>
                            <th
                              className="cursor-pointer py-2 text-right font-mono text-xs text-text-tertiary uppercase tracking-wider"
                              onClick={() => {
                                setDateSortKey("first");
                              }}
                            >
                              First
                            </th>
                            {hasAnyLastUpdated && (
                              <th className="py-2 text-right font-mono text-xs text-text-tertiary uppercase tracking-wider">
                                Updated
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedDates.map((row) => {
                            const isHighlighted = highlightedDateRows.has(
                              row.departure_date
                            );

                            return (
                              <tr
                                className={cn(
                                  "border-b border-border/50",
                                  isHighlighted && "bg-gold/10"
                                )}
                                key={row.departure_date}
                              >
                                <td className="py-2 font-mono text-text-primary">
                                  {fmtDate(row.departure_date)}
                                </td>
                                <td className="py-2 text-right font-mono">
                                  {row.economy ? (
                                    <span
                                      className={
                                        row.economy.available
                                          ? "text-cabin-economy"
                                          : "text-text-tertiary line-through"
                                      }
                                    >
                                      {fmt(row.economy.min_points)}
                                    </span>
                                  ) : (
                                    <span className="text-text-tertiary">--</span>
                                  )}
                                </td>
                                <td className="py-2 text-right font-mono">
                                  {row.business ? (
                                    <span
                                      className={
                                        row.business.available
                                          ? "text-cabin-business"
                                          : "text-text-tertiary line-through"
                                      }
                                    >
                                      {fmt(row.business.min_points)}
                                    </span>
                                  ) : (
                                    <span className="text-text-tertiary">--</span>
                                  )}
                                </td>
                                <td className="py-2 text-right font-mono">
                                  {row.first ? (
                                    <span
                                      className={
                                        row.first.available
                                          ? "text-cabin-first"
                                          : "text-text-tertiary line-through"
                                      }
                                    >
                                      {fmt(row.first.min_points)}
                                    </span>
                                  ) : (
                                    <span className="text-text-tertiary">--</span>
                                  )}
                                </td>
                                {hasAnyLastUpdated && (
                                  <td className="py-2 text-right font-mono text-xs text-text-tertiary">
                                    {fmtTimeAgo(row.last_updated)}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="stagger-6 animate-slide-up border-border-bright/70">
                <CardHeader>
                  <CardTitle className="text-text-primary">
                    Total Flights
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardValue className="font-display text-gold-bright">
                    {fmt(stats.total_flights)}
                  </CardValue>
                </CardContent>
              </Card>

              <Card className="stagger-6 animate-slide-up border-border-bright/70 md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-text-primary">
                    <TrendingUp className="size-4 text-copper" />
                    Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                    <span>Date range:</span>
                    <Badge variant="gold">
                      {formatDateLabel(stats.date_range.from)} -{" "}
                      {formatDateLabel(stats.date_range.to)}
                    </Badge>
                  </div>
                  {stats.last_updated && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                      <span>Last updated:</span>
                      <Badge variant="default">{fmtTimeAgo(stats.last_updated)}</Badge>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {cabinAvailability.map((item) => (
                      <Badge
                        key={item.cabin}
                        variant={CABIN_META[item.cabin].badgeVariant}
                      >
                        {CABIN_META[item.cabin].label}: {fmt(item.count)}{" "}
                        available
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
    </section>
  );
}
