// ComplianceGuard — shared helpers. Faithful TS port of app/helpers.py +
// app/config.py from the Python dentalkart-gst-suite. Keep behaviour identical.

export type Cell = string | number | boolean | Date | null | undefined;
export type Row = Record<string, Cell>;

// Invoice-prefix → state of supply (app/config.py INVOICE_PLACE_MAPPING).
export const INVOICE_PLACE_MAPPING: Record<string, string> = {
  BLR: "Karnataka", DWK: "Delhi", DWH: "Delhi", DFN: "Haryana",
  CWH: "Tamil Nadu", FNG: "Haryana", BOM: "Maharashtra",
  NAG: "Maharashtra", KOL: "West Bengal", GAU: "Assam",
};

const GST_BLOCKLIST = new Set(["0", "URP", "URR", "", "nan", "None", "NaN"]);

/** Trim to string; null/undefined → "". Mirrors pandas .astype(str).str.strip(). */
export function s(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** pd.to_numeric(errors='coerce'): returns NaN when unparseable. */
export function num(v: Cell): number {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const cleaned = String(v).replace(/[,₹\s]/g, "");
  if (cleaned === "") return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** pd.to_numeric(...).fillna(0) */
export function num0(v: Cell): number {
  const n = num(v);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** is_valid_gst: 15 chars and not 0/URP/URR/blank. */
export function isValidGst(v: Cell): boolean {
  const g = s(v);
  if (GST_BLOCKLIST.has(g)) return false;
  return g.length === 15;
}

export function invoicePlace(invoiceNo: Cell): string {
  const prefix = s(invoiceNo).slice(0, 3).toUpperCase();
  return INVOICE_PLACE_MAPPING[prefix] ?? "Unknown";
}

// ----------------------------------------------------------------------------
// Tiny DataFrame-ish utilities (replacing the pandas operations we rely on).
// ----------------------------------------------------------------------------

/** Group rows by a string key, preserving first-seen order of keys. */
export function groupBy(rows: Row[], keyFn: (r: Row) => string): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const bucket = m.get(k);
    if (bucket) bucket.push(r);
    else m.set(k, [r]);
  }
  return m;
}

/** Set of unique non-empty trimmed string values of a column. */
export function uniqueStrings(rows: Row[], col: string): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    const v = s(r[col]);
    if (v !== "" && v.toLowerCase() !== "nan") out.add(v);
  }
  return out;
}

/** First value in a group for a column. */
export function first(rows: Row[], col: string): Cell {
  return rows.length ? rows[0][col] : "";
}

/** Sum of numeric (coerced, NaN→0) values for a column. */
export function sumCol(rows: Row[], col: string): number {
  let total = 0;
  for (const r of rows) total += num0(r[col]);
  return total;
}

/** Distinct preserving order, as strings. */
export function distinct(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

/**
 * Resolve a column name from a header list by keyword (case-insensitive,
 * substring match on lower-cased trimmed names). Mirrors the find_col() helpers.
 */
export function findCol(columns: string[], keywords: string[]): string | null {
  for (const c of columns) {
    const lc = String(c).toLowerCase().trim();
    if (keywords.some((kw) => lc.includes(kw))) return c;
  }
  return null;
}
