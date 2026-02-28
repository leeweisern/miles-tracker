import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number with locale commas */
export function fmt(n: number | undefined | null, decimals = 0): string {
  if (n == null) {
    return "--";
  }
  return n.toLocaleString("en-MY", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format duration in minutes to "Xh Ym" */
export function fmtDuration(minutes: number | undefined | null): string {
  if (minutes == null) {
    return "--";
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) {
    return `${m}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

/** Format date string to "Wed, 15 Mar" */
export function fmtDate(dateStr: string | undefined | null): string {
  if (!dateStr) {
    return "--";
  }
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-MY", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

/** Format date string to "15 Mar" */
export function fmtDateShort(dateStr: string | undefined | null): string {
  if (!dateStr) {
    return "--";
  }
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-MY", {
    month: "short",
    day: "numeric",
  });
}

/** Cabin class display color */
export function cabinColor(cabin: string): string {
  switch (cabin) {
    case "first":
      return "text-cabin-first";
    case "business":
      return "text-cabin-business";
    default:
      return "text-cabin-economy";
  }
}

/** Cabin class background color */
export function cabinBg(cabin: string): string {
  switch (cabin) {
    case "first":
      return "bg-cabin-first/15";
    case "business":
      return "bg-cabin-business/15";
    default:
      return "bg-cabin-economy/15";
  }
}

/** Format a scraped_at timestamp as relative time, e.g. "2h ago", "3d ago" */
export function fmtTimeAgo(isoString: string | null | undefined): string {
  if (!isoString) {
    return "--";
  }
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 0) {
    return "Just now";
  }
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  return new Date(isoString).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}
