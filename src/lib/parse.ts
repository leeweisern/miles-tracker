const IATA_RE = /^[A-Z]{3}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Returns number or null. Does NOT silently coerce invalid strings to 0. */
export function toNullableNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Requires a valid finite number. Returns null if invalid. */
export function requireNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Requires a positive integer. Returns null if invalid. */
export function requirePositiveInt(value: unknown): number | null {
  const num = requireNumber(value);
  if (num == null || num <= 0 || !Number.isInteger(num)) {
    return null;
  }
  return num;
}

export function toBool(value: unknown): boolean {
  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "yes" ||
    value === "Yes"
  ) {
    return true;
  }
  return false;
}

export function isIataCode(value: string): boolean {
  return IATA_RE.test(value);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().slice(0, 10) === value;
}

export function isTime(value: string): boolean {
  if (!TIME_RE.test(value)) {
    return false;
  }
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
