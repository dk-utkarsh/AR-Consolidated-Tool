// "Prepare Data" core: map a raw export to its template shape, dropping
// Cancelled/closed rows. Streaming writer keeps memory flat for the big sales file.
import path from "node:path";
import ExcelJS from "exceljs";
import { type Cell, type Row, s } from "../compliance/helpers";
import { readSheet } from "../compliance/excel";
import { SPECS, DROP_STATUS, type PrepareSpec } from "./config";

export interface PreparedFile {
  kind: string;
  label: string;
  filename: string;
  kept: number;
  dropped: number;
  /** Template columns that found a source column. */
  mappedColumns: string[];
  /** Template columns left blank (no matching source column). */
  blankColumns: string[];
  /** Source column used for the status filter, if any. */
  statusColumn: string | null;
}

function pickFirst(columns: string[], candidates: string[] | null): string | null {
  if (!candidates) return null;
  for (const c of candidates) if (columns.includes(c)) return c;
  return null;
}

function cellOut(v: Cell): ExcelJS.CellValue {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" && !Number.isFinite(v)) return null;
  return v as ExcelJS.CellValue;
}

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true };

async function prepareOne(
  buffer: Buffer, spec: PrepareSpec, outDir: string,
): Promise<PreparedFile> {
  const sheet = await readSheet(buffer, spec.sheetCandidates);
  const cols = sheet.columns;

  // Resolve each template column to a source column (or blank).
  const resolved = spec.columns.map((c) => ({ template: c.template, source: pickFirst(cols, c.from) }));
  const mappedColumns = resolved.filter((r) => r.source).map((r) => r.template);
  const blankColumns = resolved.filter((r) => !r.source).map((r) => r.template);
  const statusColumn = pickFirst(cols, spec.statusFrom);

  // Stream-write the output workbook.
  const fpath = path.join(outDir, spec.outFilename);
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: fpath, useStyles: true });
  const ws = wb.addWorksheet(spec.outSheet);
  ws.columns = spec.columns.map(() => ({ width: 20 }));
  for (let i = 0; i < spec.blankRowsBefore; i++) ws.addRow([]).commit();
  const header = ws.addRow(spec.columns.map((c) => c.template));
  header.eachCell((c) => { c.font = HEADER_FONT; });
  header.commit();

  let kept = 0;
  let dropped = 0;
  for (const r of sheet.rows) {
    if (statusColumn) {
      const st = s(r[statusColumn]).toLowerCase();
      if (DROP_STATUS.has(st)) { dropped += 1; continue; }
    }
    const out: Row = {};
    const rowVals = resolved.map((rc) => {
      const v = rc.source ? r[rc.source] ?? null : null;
      out[rc.template] = v;
      return cellOut(v);
    });
    ws.addRow(rowVals).commit();
    kept += 1;
  }
  ws.commit();
  await wb.commit();

  return {
    kind: spec.kind, label: spec.label, filename: spec.outFilename,
    kept, dropped, mappedColumns, blankColumns, statusColumn,
  };
}

export interface PrepareInputs {
  sales?: Buffer | null;
  einvoice?: Buffer | null;
  creditnote?: Buffer | null;
  cnEinvoice?: Buffer | null;
  ewaybill?: Buffer | null;
}

export type Progress = (pct: number, msg: string) => void;

const ORDER: Array<keyof PrepareInputs> = ["sales", "einvoice", "creditnote", "cnEinvoice", "ewaybill"];

export async function prepareAll(
  inputs: PrepareInputs, outDir: string, onProgress: Progress = () => {},
): Promise<PreparedFile[]> {
  const present = ORDER.filter((k) => inputs[k]);
  const out: PreparedFile[] = [];
  let done = 0;
  for (const k of present) {
    const spec = SPECS[k];
    onProgress(Math.round((done / present.length) * 90) + 5, `Preparing ${spec.label}...`);
    out.push(await prepareOne(inputs[k] as Buffer, spec, outDir));
    done += 1;
  }
  onProgress(100, "");
  return out;
}
