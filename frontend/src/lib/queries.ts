import { queryOptions } from "@tanstack/react-query";
import { milesApi } from "./api";
import type { SearchFilters } from "./types";

export const programsQuery = () =>
  queryOptions({
    queryKey: ["miles", "programs"],
    queryFn: () => milesApi.programs(),
  });

export const flightsQuery = (filters: SearchFilters) =>
  queryOptions({
    queryKey: ["miles", "flights", filters],
    queryFn: () => milesApi.flights(filters),
    enabled: !!filters.destination,
  });

export const flightStatsQuery = (
  filters: Omit<SearchFilters, "sort" | "limit" | "offset">
) =>
  queryOptions({
    queryKey: ["miles", "flights", "stats", filters],
    queryFn: () => milesApi.stats(filters),
    enabled: !!filters.destination,
  });
