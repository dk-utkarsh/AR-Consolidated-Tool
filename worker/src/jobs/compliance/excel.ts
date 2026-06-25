// ComplianceGuard — Excel reading. Backed by SheetJS (xlsx).
//
// Previously this used exceljs' streaming reader to keep the (often 100MB+)
// sales workbook out of the JS heap on the 512MB Render free tier. The worker
// now runs on the Render Standard 2GB plan, so the streaming constraint is gone
// and we use SheetJS instead: it parses large workbooks ~5-10x faster. The
// parsed workbook is held in memory for the duration of a job (fine on 2GB).
//
// Reproduces two pandas behaviours the annexure logic depends on:
//   * _auto_detect_header — pick the first of the first 5 rows whose non-empty
//     cells exceed 50% of the sheet width (skips blank preamble rows).
//   * duplicate-column mangling — pandas read_excel renames repeat headers to
//     "Name.1", "Name.2"; so df.get("State") resolves to the FIRST "State".
import * as XLSX from "xlsx";
import type { Cell, Row } from "./helpers";

export interface SheetData {
  name: string;
  columns: string[];
  rows: Row[];
}

// A workbook source is either an in-memory buffer or a path to a file on disk.
export type ExcelSource = Buffer | string;

// dense layout is faster + lighter for the large sheets we parse; cellDates so
// date cells come back as JS Date (mirrors the old exceljs behaviour, which the
// helpers' s()/num() already special-case). Styles/formulas/HTML are ignored —
// we only ever read raw values.
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
  header: 1,        // array-of-arrays
  raw: true,        // underlying typed values, not formatted strings
  defval: null,     // fill gaps with null so column indices stay aligned
  blankrows: false, // drop fully-empty rows (buildSheet would drop them anyway)
};

// Parsed-workbook cache keyed by file path. report.ts reads the e-invoice and
// e-way files under more than one candidate sheet set, so without this each
// call would re-parse the whole workbook. Buffer sources aren't cached (no
// stable key). Cleared per-job in the compliance route's finally blocks via
// clearWorkbookCache(), alongside the temp-file cleanup.
const wbCache = new Map<string, XLSX.WorkBook>();

function loadWorkbook(src: ExcelSource): XLSX.WorkBook {
  if (typeof src === "string") {
    const hit = wbCache.get(src);
    if (hit) return hit;
    const wb = XLSX.readFile(src, READ_OPTS);
    wbCache.set(src, wb);
    return wb;
  }
  return XLSX.read(src, READ_OPTS);
}

/** Drop cached workbooks. With no argument clears everything; otherwise only
 *  the given paths (so one job's cleanup never evicts another job's entries). */
export function clearWorkbookCache(paths?: string[]): void {
  if (!paths) {
    wbCache.clear();
    return;
  }
  for (const p of paths) wbCache.delete(p);
}

function sheetToRaw(ws: XLSX.WorkSheet | undefined): Cell[][] {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, AOA_OPTS) as Cell[][];
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

/**
 * Read the best-matching sheet from an xlsx source.
 * Sheet priority follows the candidate order (exact match first, then
 * case-insensitive), falling back to the first sheet — same as _find_sheet.
 */
export async function readSheet(source: ExcelSource, candidates: string[]): Promise<SheetData> {
  const wb = loadWorkbook(source);
  const name = chooseSheetName(wb.SheetNames, candidates);
  return buildSheet(name, sheetToRaw(wb.Sheets[name]));
}

/** Read the first worksheet's rows as a raw 2-D array (no header processing). */
export async function readFirstSheetRaw(source: ExcelSource): Promise<Cell[][]> {
  const wb = loadWorkbook(source);
  const first = wb.SheetNames[0];
  return first ? sheetToRaw(wb.Sheets[first]) : [];
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
