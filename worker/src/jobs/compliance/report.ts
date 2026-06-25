// ComplianceGuard — job orchestration + Excel writing. Faithful TS port of
// app/processing.py. Reads the (up to) 5 inputs, runs the 17 annexures, and
// writes a multi-sheet xlsx (Summary + Raw Sales + E-Invoice + annexures).
import path from "node:path";
import ExcelJS from "exceljs";
import { type Cell, type Row, s, num0, round2 } from "./helpers";
import { readSheet, tryReadSheet, type SheetData, type ExcelSource } from "./excel";
import { prepareRawSales, prepareEinvoice, prepareEway } from "./preparation";
import type { Frame } from "./types";
import * as A from "./annexures";

export interface ComplianceInputs {
  sales: ExcelSource;
  einvoice: ExcelSource;
  ewaybill?: ExcelSource | null;
  creditnote?: ExcelSource | null;
  cnEinvoice?: ExcelSource | null;
}

export interface AnnexureMeta { key: string; desc: string; }

export interface ComplianceResult {
  filename: string;
  summary: {
    total_sales_records: number;
    total_einvoice_records: number;
    annexures: Array<{ key: string; description: string; records: number; value: number }>;
  };
}

const SALES_SHEETS = ["Dentalkart Standard Sales GST", "Standard Sales GST", "Sales Data", "Sheet1"];
const EINV_SHEETS = [
  "E-invoice", "E-Invoice", "e-invoice", "E-INVOICE",
  "b2b,sez,de", "B2B,SEZ,DE", "b2b,sez,de,txp",
  "b2b", "B2B", "b2b-sez-de", "Sheet1", "sheet1",
];
const EWAY_OUT_SHEETS = ["Outward Supply", "outward supply", "Eway Bill Report", "EWay Bill Report", "E-way Bill", "Sheet1"];
const EWAY_IN_SHEETS = ["Inword", "Inward Supply", "inward supply", "Inward"];
const CN_SHEETS = ["Standard Sales Return GST", "Credit Notes", "Returns", "Sheet1"];
const CN_EINV_SHEETS = ["b2b-cr", "B2B-CR", "cdnr", "CDNR", "Sheet1"];
const CDNR_IN_EINV = ["cdnr", "CDNR", "b2b-cr", "B2B-CR"];

function asFrame(sheet: SheetData): Frame {
  return { columns: sheet.columns, rows: sheet.rows };
}

/** A CDNR sheet is only usable if it actually has a 'Note Number' column —
 * otherwise pandas would KeyError (→ empty) in the Python original. */
function usableCdnr(sheet: SheetData | null): Frame | null {
  if (!sheet || !sheet.columns.includes("Note Number") || sheet.rows.length === 0) return null;
  return asFrame(sheet);
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true };

function cellOut(v: Cell): ExcelJS.CellValue {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" && !Number.isFinite(v)) return null;
  return v as ExcelJS.CellValue;
}

function writeSheet(
  wb: ExcelJS.stream.xlsx.WorkbookWriter,
  name: string,
  columns: string[],
  rows: Row[],
  widths?: number[],
): void {
  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.columns = columns.map((_, i) => ({ width: widths?.[i] ?? 20 }));
  const header = ws.addRow(columns);
  header.height = 25;
  header.eachCell((c) => { c.fill = HEADER_FILL; c.font = HEADER_FONT; });
  header.commit();
  for (const r of rows) {
    ws.addRow(columns.map((c) => cellOut(r[c]))).commit();
  }
  ws.commit();
}

const VALUE_COLS = [
  "Invoice Total", "Invoice Value", "Order Amount", "Total Invoice Value",
  "Note Value", "Return Amount", "Difference", "Discount on Item",
];

function summaryValue(frame: Frame): number {
  for (const vc of VALUE_COLS) {
    if (frame.columns.includes(vc)) {
      let total = 0;
      for (const r of frame.rows) total += num0(r[vc]);
      return round2(total);
    }
  }
  return 0;
}

export type Progress = (pct: number, msg: string) => void;

export async function generateReport(
  inputs: ComplianceInputs,
  outDir: string,
  jobIdSeed: string,
  onProgress: Progress = () => {},
): Promise<ComplianceResult> {
  onProgress(5, "Reading Sales data...");
  const salesSheet = await readSheet(inputs.sales, SALES_SHEETS);
  const salesOrig: Frame = asFrame(salesSheet);

  onProgress(15, "Preparing Sales data...");
  const rawSales = prepareRawSales(salesSheet);

  onProgress(25, "Reading E-Invoice data...");
  const einvSheet = await readSheet(inputs.einvoice, EINV_SHEETS);
  const einv = prepareEinvoice(einvSheet);

  let eway: Frame | null = null;
  let ewayInward: Frame | null = null;
  if (inputs.ewaybill) {
    onProgress(33, "Reading E-way Bill data...");
    const outSheet = await tryReadSheet(inputs.ewaybill, EWAY_OUT_SHEETS);
    if (outSheet) { try { eway = prepareEway(outSheet); } catch { /* ignore */ } }
    const inSheet = await tryReadSheet(inputs.ewaybill, EWAY_IN_SHEETS);
    if (inSheet) { try { ewayInward = prepareEway(inSheet); } catch { /* ignore */ } }
  }

  let creditnote: Frame | null = null;
  if (inputs.creditnote) {
    onProgress(38, "Reading Credit Note data...");
    const cnSheet = await tryReadSheet(inputs.creditnote, CN_SHEETS);
    if (cnSheet) creditnote = asFrame(cnSheet);
  }

  onProgress(42, "Reading CN E-Invoice / CDNR data...");
  let cdnr: Frame | null = null;
  if (inputs.cnEinvoice) {
    cdnr = usableCdnr(await tryReadSheet(inputs.cnEinvoice, CN_EINV_SHEETS));
  } else {
    cdnr = usableCdnr(await tryReadSheet(inputs.einvoice, CDNR_IN_EINV));
  }

  onProgress(48, "Running 17 compliance checks...");
  const annexures: Array<{ key: string; desc: string; frame: Frame }> = [
    { key: "Annexure 1", desc: "E-Invoice With Tax Invoice Total Val. Not Matched", frame: A.annexure1(rawSales, einv) },
    { key: "Annexure 2", desc: "B2B Invoices Missing in E-Invoice Data", frame: A.annexure2(rawSales, einv) },
    { key: "Annexure 3", desc: "E-Invoices Missing in Sales Data", frame: A.annexure3(rawSales, einv) },
    { key: "Annexure 4", desc: "Sales Invoices >= 50K Missing in E-way Bill", frame: A.annexure4(salesOrig, eway) },
    { key: "Annexure 5", desc: "E-Invoices >= 50K Missing in E-way Bill", frame: A.annexure5(einv, eway) },
    { key: "Annexure 6", desc: "E-way Bills Missing in Sales Data", frame: A.annexure6(salesOrig, eway) },
    { key: "Annexure 7", desc: "E-way Bills (with GST) Missing in E-Invoice", frame: A.annexure7(einv, eway) },
    { key: "Annexure 8", desc: "TES SKU Invoices with E-Invoice/E-way Bill", frame: A.annexure8(salesOrig) },
    { key: "Annexure 9", desc: "Administration Order Channel Records", frame: A.annexure9(salesOrig) },
    { key: "Annexure 10", desc: "High Discount Records (>= 90%)", frame: A.annexure10(salesOrig) },
    { key: "Annexure 11", desc: "Zero OrderAmount Invoices", frame: A.annexure11(salesOrig) },
    { key: "Annexure 12", desc: "E-Invoice CDNR Missing in Credit Note", frame: A.annexure12(cdnr, creditnote) },
    { key: "Annexure 13", desc: "Credit Notes (with GST) Missing in CDNR", frame: A.annexure13(cdnr, creditnote) },
    { key: "Annexure 14", desc: "Credit Notes >= 50K Missing in E-way Bill Inward", frame: A.annexure14(creditnote, ewayInward) },
    { key: "Annexure 15", desc: "E-Invoice CDNR >= 50K Missing in E-way Bill Inward", frame: A.annexure15(cdnr, ewayInward) },
    { key: "Annexure 16", desc: "E-way Bill Inward Missing in Credit Note", frame: A.annexure16(creditnote, ewayInward) },
    { key: "Annexure 17", desc: "E-Invoice CDNR vs Credit Note Value Mismatch", frame: A.annexure17(cdnr, creditnote) },
  ];

  onProgress(88, "Writing Excel report...");
  const fname = `Compliance_Report_${jobIdSeed}.xlsx`;
  const fpath = path.join(outDir, fname);
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: fpath, useStyles: true });

  // Summary sheet
  const summaryRows: Row[] = annexures.map(({ key, desc, frame }) => ({
    Annexure: key,
    Description: desc,
    Records: frame.rows.length,
    Value: summaryValue(frame),
    Remarks: desc,
  }));
  writeSheet(wb, "Annexure Summary", ["Annexure", "Description", "Records", "Value", "Remarks"],
    summaryRows, [15, 50, 12, 20, 50]);

  // Raw Sales (capped at 50K like the original)
  if (rawSales.rows.length > 50000) {
    writeSheet(wb, "Raw Sales (Top 50K)", rawSales.columns, rawSales.rows.slice(0, 50000));
  } else {
    writeSheet(wb, "Raw Sales", rawSales.columns, rawSales.rows);
  }

  // E-Invoice Summary
  writeSheet(wb, "E-Invoice Summary", einv.columns, einv.rows);

  // Annexure sheets (only non-empty). Single remark column: keep the per-row
  // 'Remark', and where it's blank fall back to the annexure description. No
  // separate trailing 'Remarks' column (avoids duplicate remark columns).
  for (const { key, desc, frame } of annexures) {
    if (!frame.rows.length) continue;
    const columns = frame.columns.includes("Remark") ? frame.columns : ["Remark", ...frame.columns];
    const rows = frame.rows.map((r) => (s(r["Remark"]) ? r : { ...r, Remark: desc }));
    writeSheet(wb, key, columns, rows);
  }

  await wb.commit();
  onProgress(100, "");

  const uniqueInvoices = new Set(rawSales.rows.map((r) => s(r["Invoice No"]))).size;
  return {
    filename: fname,
    summary: {
      total_sales_records: uniqueInvoices,
      total_einvoice_records: einv.rows.length,
      annexures: annexures.map(({ key, desc, frame }) => ({
        key, description: desc, records: frame.rows.length, value: summaryValue(frame),
      })),
    },
  };
}
