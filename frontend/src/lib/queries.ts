import { queryOptions } from "@tanstack/react-query";
import { milesApi } from "./api";
import type {
  CheapestByDateFilters,
  DestinationsFilters,
  SearchFilters,
} from "./types";

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

export const destinationsQuery = (filters: DestinationsFilters) =>
  queryOptions({
    queryKey: ["miles", "destinations", filters],
    queryFn: () => milesApi.destinations(filters),
  });

export const cheapestByDateQuery = (filters: CheapestByDateFilters) =>
  queryOptions({
    queryKey: ["miles", "flights", "cheapest-by-date", filters],
    queryFn: () => milesApi.cheapestByDate(filters),
    enabled: !!filters.destination,
  });
