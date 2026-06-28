// ComplianceGuard — Excel reading. Hybrid reader: SheetJS for speed on small/
// medium workbooks, exceljs' streaming reader for large ones to keep memory
// flat.
//
// Why hybrid: SheetJS parses ~5-10x faster than exceljs but materialises the
// ENTIRE workbook (every sheet) in the heap. On the 2GB droplet a single very
// large sales workbook (or several held at once) can exhaust RAM and get the
// node process OOM-killed. So files above STREAM_THRESHOLD are read with the
// streaming reader (bounded memory, slower); everything else uses SheetJS.
// No workbook is cached across calls — one is held at a time, then released.
//
// Reproduces two pandas behaviours the annexure logic depends on:
//   * _auto_detect_header — pick the first of the first 5 rows whose non-empty
//     cells exceed 50% of the sheet width (skips blank preamble rows).
//   * duplicate-column mangling — pandas read_excel renames repeat headers to
//     "Name.1", "Name.2"; so df.get("State") resolves to the FIRST "State".
import fs from "node:fs";
import { Readable } from "node:stream";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { Cell, Row } from "./helpers";

export interface SheetData {
  name: string;
  columns: string[];
  rows: Row[];
}

// A workbook source is either an in-memory buffer or a path to a file on disk.
export type ExcelSource = Buffer | string;

// Files larger than this (on disk) are read with the streaming reader instead
// of SheetJS. 120MB suits the 4GB droplet (heap capped ~3GB): a workbook this
// size parses to well under the cap on the fast SheetJS path, so the big sales
// file stays fast; only genuinely huge files fall back to bounded-memory
// streaming. Override with COMPLIANCE_STREAM_THRESHOLD_MB.
const STREAM_THRESHOLD_BYTES =
  (Number(process.env.COMPLIANCE_STREAM_THRESHOLD_MB) || 120) * 1024 * 1024;

function fileSize(src: ExcelSource): number {
  if (typeof src !== "string") return src.length;
  try {
    return fs.statSync(src).size;
  } catch {
    return 0;
  }
}

function useStreaming(src: ExcelSource): boolean {
  return typeof src === "string" && fileSize(src) > STREAM_THRESHOLD_BYTES;
}

// ---------------------------------------------------------------------------
// Shared, pure frame-building (used by both readers)
// ---------------------------------------------------------------------------

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
    // pandas dropna(how='all'); mirror by skipping entirely-empty rows.
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

function matchesCandidate(name: string, candidates: string[]): boolean {
  if (candidates.includes(name)) return true;
  const lower = name.toLowerCase().trim();
  return candidates.some((c) => c.toLowerCase().trim() === lower);
}

/** Resolve a sheet name by candidate priority: exact match first, then
 *  case-insensitive, falling back to the first sheet — same as _find_sheet. */
function chooseSheetName(names: string[], candidates: string[]): string {
  for (const cand of candidates) {
    if (names.includes(cand)) return cand;
  }
  for (const cand of candidates) {
    const cl = cand.toLowerCase().trim();
    const hit = names.find((n) => n.toLowerCase().trim() === cl);
    if (hit) return hit;
  }
  return names[0] ?? "";
}

// ---------------------------------------------------------------------------
// Fast path: SheetJS (xlsx)
// ---------------------------------------------------------------------------

// dense layout is faster + lighter; cellDates so date cells come back as JS
// Date (mirrors exceljs, which the helpers' s()/num() already special-case).
const READ_OPTS: XLSX.ParsingOptions = {
  dense: true,
  cellDates: true,
  cellFormula: false,
  cellHTML: false,
  cellStyles: false,
  cellText: false,
  sheetStubs: false,
};

const AOA_OPTS: XLSX.Sheet2JSONOpts = {
  header: 1,
  raw: true,
  defval: null,
  blankrows: false,
};

function loadWorkbook(src: ExcelSource): XLSX.WorkBook {
  return typeof src === "string" ? XLSX.readFile(src, READ_OPTS) : XLSX.read(src, READ_OPTS);
}

function sheetToRaw(ws: XLSX.WorkSheet | undefined): Cell[][] {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, AOA_OPTS) as Cell[][];
}

function readSheetFast(source: ExcelSource, candidates: string[]): SheetData {
  const wb = loadWorkbook(source);
  const name = chooseSheetName(wb.SheetNames, candidates);
  return buildSheet(name, sheetToRaw(wb.Sheets[name]));
}

function readFirstSheetRawFast(source: ExcelSource): Cell[][] {
  const wb = loadWorkbook(source);
  const first = wb.SheetNames[0];
  return first ? sheetToRaw(wb.Sheets[first]) : [];
}

// ---------------------------------------------------------------------------
// Low-memory path: exceljs streaming
// ---------------------------------------------------------------------------

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

// exceljs' streaming WorkbookReader has a race (workbook-reader.js:303): when a
// worksheet zip entry is parsed before xl/workbook.xml, `this.model` is still
// undefined and it throws "Cannot read properties of undefined (reading
// 'sheets')". Zip-entry ordering varies run-to-run, so the failure is
// intermittent. Each attempt re-streams from disk (cheap), so retry on it.
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

function streamReader(source: ExcelSource): ExcelJS.stream.xlsx.WorkbookReader {
  return new ExcelJS.stream.xlsx.WorkbookReader(sourceStream(source), {
    worksheets: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    // "cache" (not "ignore") so exceljs resolves number formats and returns
    // Date objects for date-typed cells — matching the SheetJS fast path's
    // cellDates:true. With "ignore" date cells fell through as raw serial
    // numbers, so the same cell rendered differently above vs below the size
    // threshold. Keeps the two readers in parity.
    styles: "cache",
    entries: "ignore",
  });
}

/** A streamed row we keep only if it has at least one non-empty cell — mirrors
 *  SheetJS's blankrows:false so leading blank preamble rows don't shift header
 *  auto-detection differently between the two readers. */
function keepStreamedRow(vals: Cell[]): boolean {
  return nonEmptyCount(vals) > 0;
}

async function readSheetStreaming(source: ExcelSource, candidates: string[]): Promise<SheetData> {
  return withStreamRetry(async () => {
    const reader = streamReader(source);
    const parsed = new Map<string, SheetData>();
    let firstSheet: SheetData | null = null;
    let sheetIndex = 0;

    for await (const worksheet of reader) {
      sheetIndex += 1;
      const wsName = (worksheet as unknown as { name?: string }).name ?? `Sheet${sheetIndex}`;
      const keep = firstSheet === null || matchesCandidate(wsName, candidates);
      if (!keep) {
        // Drain rows without storing to keep memory flat for big non-target sheets.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _row of worksheet) { /* skip */ }
        continue;
      }
      const raw: Cell[][] = [];
      for await (const row of worksheet) {
        const vals = rowToValues((row as unknown as { values: unknown }).values);
        if (keepStreamedRow(vals)) raw.push(vals);
      }
      const sheet = buildSheet(wsName, raw);
      parsed.set(wsName, sheet);
      if (firstSheet === null) firstSheet = sheet;
    }

    for (const cand of candidates) {
      for (const [name, sheet] of parsed) if (name === cand) return sheet;
      const cl = cand.toLowerCase().trim();
      for (const [name, sheet] of parsed) if (name.toLowerCase().trim() === cl) return sheet;
    }
    if (firstSheet) return firstSheet;
    return { name: "", columns: [], rows: [] };
  });
}

async function readFirstSheetRawStreaming(source: ExcelSource): Promise<Cell[][]> {
  return withStreamRetry(async () => {
    const reader = streamReader(source);
    let firstRaw: Cell[][] | null = null;
    for await (const worksheet of reader) {
      if (firstRaw === null) {
        const raw: Cell[][] = [];
        for await (const row of worksheet) {
          const vals = rowToValues((row as unknown as { values: unknown }).values);
          if (keepStreamedRow(vals)) raw.push(vals);
        }
        firstRaw = raw;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _row of worksheet) { /* skip */ }
      }
    }
    return firstRaw ?? [];
  });
}

// ---------------------------------------------------------------------------
// Public API — picks the path by file size
// ---------------------------------------------------------------------------

/** Read the best-matching sheet from an xlsx source (candidate-priority). */
export async function readSheet(source: ExcelSource, candidates: string[]): Promise<SheetData> {
  if (useStreaming(source)) return readSheetStreaming(source, candidates);
  return readSheetFast(source, candidates);
}

/** Read the first worksheet's rows as a raw 2-D array (no header processing). */
export async function readFirstSheetRaw(source: ExcelSource): Promise<Cell[][]> {
  if (useStreaming(source)) return readFirstSheetRawStreaming(source);
  return readFirstSheetRawFast(source);
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
