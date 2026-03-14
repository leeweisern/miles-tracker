interface PrintResponseOptions {
  tableColumns?: string[];
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printError(message: string): void {
  console.error(message);
}

export function printResponse(
  value: unknown,
  options?: PrintResponseOptions
): void {
  const rows = extractRows(value);
  if (rows && rows.length > 0) {
    console.log(formatTable(rows, options?.tableColumns));
    return;
  }

  printJson(value);
}

export function formatTable(
  rows: Record<string, unknown>[],
  preferredColumns?: string[]
): string {
  if (rows.length === 0) {
    return "No rows";
  }

  const columns =
    preferredColumns && preferredColumns.length > 0
      ? preferredColumns
      : inferColumns(rows);

  if (columns.length === 0) {
    return "No rows";
  }

  const widths = columns.map((column) => {
    const valueWidth = rows.reduce((max, row) => {
      const rendered = renderCell(row[column]);
      return Math.max(max, rendered.length);
    }, 0);

    return Math.max(column.length, valueWidth);
  });

  const header = columns
    .map((column, index) => column.padEnd(widths[index]))
    .join("  ");
  const divider = widths.map((width) => "-".repeat(width)).join("  ");
  const body = rows.map((row) =>
    columns
      .map((column, index) => renderCell(row[column]).padEnd(widths[index]))
      .join("  ")
      .trimEnd()
  );

  return [header, divider, ...body].join("\n");
}

function extractRows(value: unknown): Record<string, unknown>[] | null {
  if (isRecordArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  const nestedData = value.data;
  if (isRecordArray(nestedData)) {
    return nestedData;
  }

  return null;
}

function inferColumns(rows: Record<string, unknown>[]): string[] {
  const first = rows[0];
  return Object.keys(first);
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "object" && entry !== null)
  );
}
