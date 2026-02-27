import { useQuery } from "@tanstack/react-query";
import { BarChart3, Plane, TrendingUp } from "lucide-react";
import { type FormEvent, useState } from "react";
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
import { flightStatsQuery } from "@/lib/queries";
import type { FlightStats, TierStats } from "@/lib/types";
import { cn, fmt } from "@/lib/utils";

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

export function RouteAnalytics() {
  const [form, setForm] = useState<RouteFormState>({
    origin: "KUL",
    destination: "",
    date_from: "",
    date_to: "",
    cabin: "all",
  });
  const [activeFilters, setActiveFilters] = useState<StatsFilters | null>(null);

  const statsQuery = useQuery(
    flightStatsQuery(activeFilters ?? { destination: "" })
  );
  const stats = statsQuery.data;
  const hasSearched = activeFilters !== null;

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
    !statsQuery.isPending &&
    !statsQuery.isError &&
    (stats == null || stats.total_flights === 0);

  const isSubmitDisabled = form.destination.trim().length === 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const destination = form.destination.trim().toUpperCase();
    if (!destination) {
      return;
    }

    const origin = form.origin.trim().toUpperCase() || "KUL";

    setActiveFilters({
      destination,
      origin,
      date_from: form.date_from || undefined,
      date_to: form.date_to || undefined,
      cabin: form.cabin === "all" ? undefined : form.cabin,
    });
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
                  setForm((prev) => ({ ...prev, origin: event.target.value }))
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
                    destination: event.target.value,
                  }))
                }
                placeholder="LHR"
                required
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
                  "w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-bg-deep text-sm transition-all duration-200",
                  "hover:bg-gold-bright focus:outline-none focus:ring-2 focus:ring-gold/40",
                  "disabled:cursor-not-allowed disabled:opacity-55"
                )}
                disabled={isSubmitDisabled || statsQuery.isFetching}
                type="submit"
              >
                {statsQuery.isFetching ? "Analyzing..." : "Analyze"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!hasSearched && (
        <Card className="stagger-3 animate-slide-up border-dashed">
          <CardContent className="flex min-h-40 items-center justify-center py-12">
            <p className="text-center font-display text-2xl text-text-secondary">
              Select a route to analyze
            </p>
          </CardContent>
        </Card>
      )}

      {hasSearched && statsQuery.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="stagger-3 h-48 animate-slide-up" />
          <Skeleton className="stagger-4 h-48 animate-slide-up" />
          <Skeleton className="stagger-5 h-48 animate-slide-up" />
        </div>
      )}

      {hasSearched && statsQuery.isError && (
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

      {stats != null &&
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="stagger-5 animate-slide-up border-border-bright/70">
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
