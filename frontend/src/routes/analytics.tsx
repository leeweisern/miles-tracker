import { createFileRoute } from "@tanstack/react-router";
import { RouteAnalytics } from "@/components/sections/route-analytics";

export const Route = createFileRoute("/analytics")({
  component: RouteAnalytics,
});
