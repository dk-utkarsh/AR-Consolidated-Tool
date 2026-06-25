// ComplianceGuard — Excel reading. Faithful TS port of app/readers.py.
// Uses exceljs' streaming reader so the large (100MB+) sales workbook does not
// have to be fully materialised the way a plain Workbook.load() would.
//
// Reproduces two pandas behaviours the annexure logic depends on:
//   * _auto_detect_header — pick the first of the first 5 rows whose non-empty
//     cells exceed 50% of the sheet width (skips blank preamble rows).
//   * duplicate-column mangling — pandas read_excel renames repeat headers to
//     "Name.1", "Name.2"; so df.get("State") resolves to the FIRST "State".
import fs from "node:fs";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import type { Cell, Row } from "./helpers";

export interface SheetData {
  name: string;
  columns: string[];
  rows: Row[];
}

// A workbook source is either an in-memory buffer or a path to a file on disk.
// Streaming straight from disk keeps the (often 100MB+) compressed file out of
// the JS heap, which matters a lot on the 512MB Render instance.
export type ExcelSource = Buffer | string;

function sourceStream(src: ExcelSource): Readable {
  return typeof src === "string" ? fs.createReadStream(src) : Readable.from(src);
}

/** Normalise an exceljs cell value to a primitive we can reason about. */
function cellValue(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  const t = typeof v;
  if (t === "number" || t === "string" || t === "boolean") return v as Cell;
  if (t === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellValue(o.result);
    if ("text" in o && typeof o.text === "string") return o.text;
    if ("richText" in o && Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map((p) => p.text ?? "").join("");
    }
    if ("hyperlink" in o && "text" in o && typeof o.text === "string") return o.text;
    if ("error" in o) return null;
  }
  return null;
}

function rowToValues(rowValues: unknown): Cell[] {
  // exceljs row.values is a 1-indexed sparse array; index 0 is unused.
  if (!Array.isArray(rowValues)) return [];
  const out: Cell[] = [];
  for (let i = 1; i < rowValues.length; i++) out.push(cellValue(rowValues[i]));
  return out;
}

/** Max row width without spreading (spreading 100k+ args overflows the stack). */
function maxWidth(rows: Cell[][]): number {
  let w = 1;
  for (const r of rows) if (r.length > w) w = r.length;
  return w;
}

function nonEmptyCount(vals: Cell[]): number {
  let n = 0;
  for (const v of vals) {
    if (v !== null && v !== undefined && String(v).trim() !== "") n += 1;
  }
  return n;
}

/** Pick header row index from the first few rows (mirrors _auto_detect_header). */
function detectHeaderIndex(pre: Cell[][]): number {
  const width = maxWidth(pre.slice(0, 50));
  const limit = Math.min(5, pre.length);
  for (let h = 0; h < limit; h++) {
    if (nonEmptyCount(pre[h]) > width * 0.5) return h;
  }
  return 0;
}

/** Build mangled, unique header names from a raw header row. */
function buildColumns(headerRow: Cell[], width: number): string[] {
  const counts = new Map<string, number>();
  const cols: string[] = [];
  for (let i = 0; i < width; i++) {
    const raw = headerRow[i];
    let name = raw === null || raw === undefined ? "" : String(raw).trim();
    if (name === "") name = `Unnamed: ${i}`;
    const seen = counts.get(name) ?? 0;
    counts.set(name, seen + 1);
    cols.push(seen === 0 ? name : `${name}.${seen}`);
  }
  return cols;
}

function buildSheet(name: string, raw: Cell[][]): SheetData {
  if (raw.length === 0) return { name, columns: [], rows: [] };
  const headerIdx = detectHeaderIndex(raw);
  const width = maxWidth(raw);
  const columns = buildColumns(raw[headerIdx] ?? [], width);
  const rows: Row[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const vals = raw[i];
    // pandas dropna(how='all') happens in some readers; we mirror by skipping
    // rows that are entirely empty.
    let allEmpty = true;
    const obj: Row = {};
    for (let c = 0; c < columns.length; c++) {
      const v = vals[c] ?? null;
      obj[columns[c]] = v;
      if (allEmpty && v !== null && String(v).trim() !== "") allEmpty = false;
    }
    if (!allEmpty) rows.push(obj);
  }
  return { name, columns, rows };
}

function matchesCandidate(name: string, candidates: string[]): boolean {
  if (candidates.includes(name)) return true;
  const lower = name.toLowerCase().trim();
  return candidates.some((c) => c.toLowerCase().trim() === lower);
}

// exceljs' streaming WorkbookReader has a race (workbook-reader.js:303): when a
// worksheet zip entry is parsed inline before xl/workbook.xml, `this.model` is
// still undefined and it throws "Cannot read properties of undefined (reading
// 'sheets')". The zip-entry ordering varies run-to-run, so the failure is
// intermittent (~1 in 5). Each attempt re-streams from the in-memory buffer
// (CPU-only, no I/O), so retrying is cheap and only happens on the rare miss.
const STREAM_READ_RETRIES = 6;

function isExceljsRaceError(e: unknown): boolean {
  const m = (e as { message?: string } | null)?.message ?? "";
  return m.includes("reading 'sheets'");
}

async function withStreamRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < STREAM_READ_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isExceljsRaceError(e)) throw e;
    }
  }
  throw lastErr;
}

/**
 * Read the best-matching sheet from an xlsx buffer.
 * Sheet priority follows the candidate order (exact match first, then
 * case-insensitive), falling back to the first sheet — same as _find_sheet.
 */
export async function readSheet(source: ExcelSource, candidates: string[]): Promise<SheetData> {
  return withStreamRetry(() => readSheetOnce(source, candidates));
}

async function readSheetOnce(source: ExcelSource, candidates: string[]): Promise<SheetData> {
  const stream = sourceStream(source);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {
    worksheets: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
    entries: "ignore",
  });

  const parsed = new Map<string, SheetData>(); // by sheet name
  let firstSheet: SheetData | null = null;
  let sheetIndex = 0;

  for await (const worksheet of reader) {
    sheetIndex += 1;
    const wsName = (worksheet as unknown as { name?: string }).name ?? `Sheet${sheetIndex}`;
    const keep = firstSheet === null || matchesCandidate(wsName, candidates);
    if (!keep) {
      // Consume rows without storing to keep memory flat for big non-target sheets.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _row of worksheet) { /* skip */ }
      continue;
    }
    const raw: Cell[][] = [];
    for await (const row of worksheet) {
      raw.push(rowToValues((row as unknown as { values: unknown }).values));
    }
    const sheet = buildSheet(wsName, raw);
    parsed.set(wsName, sheet);
    if (firstSheet === null) firstSheet = sheet;
  }

  // Resolve by candidate priority.
  for (const cand of candidates) {
    for (const [name, sheet] of parsed) {
      if (name === cand) return sheet;
    }
    const cl = cand.toLowerCase().trim();
    for (const [name, sheet] of parsed) {
      if (name.toLowerCase().trim() === cl) return sheet;
    }
  }
  if (firstSheet) return firstSheet;
  return { name: "", columns: [], rows: [] };
}

/** Read the first worksheet's rows as a raw 2-D array (no header processing). */
export async function readFirstSheetRaw(source: ExcelSource): Promise<Cell[][]> {
  return withStreamRetry(() => readFirstSheetRawOnce(source));
}

async function readFirstSheetRawOnce(source: ExcelSource): Promise<Cell[][]> {
  const stream = sourceStream(source);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {
    worksheets: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
    entries: "ignore",
  });
  let firstRaw: Cell[][] | null = null;
  for await (const worksheet of reader) {
    if (firstRaw === null) {
      const raw: Cell[][] = [];
      for await (const row of worksheet) {
        raw.push(rowToValues((row as unknown as { values: unknown }).values));
      }
      firstRaw = raw;
    } else {
      // Consume remaining sheets without storing so the reader finalises cleanly.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _row of worksheet) { /* skip */ }
    }
  }
  return firstRaw ?? [];
}

/** Build a {columns, rows} frame from raw rows given an explicit header index. */
export function frameFromRaw(raw: Cell[][], headerIdx: number): SheetData {
  if (raw.length === 0) return { name: "", columns: [], rows: [] };
  const width = maxWidth(raw);
  const columns = buildColumns(raw[headerIdx] ?? [], width);
  const rows: Row[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const vals = raw[i];
    let allEmpty = true;
    const obj: Row = {};
    for (let c = 0; c < columns.length; c++) {
      const v = vals[c] ?? null;
      obj[columns[c]] = v;
      if (allEmpty && v !== null && String(v).trim() !== "") allEmpty = false;
    }
    if (!allEmpty) rows.push(obj);
  }
  return { name: "", columns, rows };
}

/** Try several candidate sheet sets; return null if the file/sheet is absent. */
export async function tryReadSheet(
  source: ExcelSource | null | undefined,
  candidates: string[],
): Promise<SheetData | null> {
  if (!source) return null;
  try {
    return await readSheet(source, candidates);
  } catch {
    return null;
  }
}
