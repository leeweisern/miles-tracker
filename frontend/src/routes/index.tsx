import { createFileRoute } from "@tanstack/react-router";
import { FlightSearch } from "@/components/sections/flight-search";

export const Route = createFileRoute("/")({
  component: FlightSearch,
});
