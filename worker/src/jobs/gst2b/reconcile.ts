// GST 2B Reconciliation — faithful TS port of app/gst2b/{reconciliation,config,helpers}.py.
// Synchronous: 2B return file vs Purchase Register → matched / mismatched /
// only-in-2B / only-in-books, written to a styled multi-sheet workbook.
import path from "node:path";
import ExcelJS from "exceljs";
import { type Cell, type Row, s, num0, round2, groupBy } from "../compliance/helpers";
import { readFirstSheetRaw, frameFromRaw } from "../compliance/excel";
import type { Frame } from "../compliance/types";

type ColMap = Record<string, string[]>;

const TWO_B_COLUMN_MAP: ColMap = {
  GSTIN: ["gstin of supplier", "gstin", "gst no", "supplier gstin"],
  Party_Name: ["trade/legal name", "trade name", "legal name", "party name", "supplier name"],
  Invoice_No: ["invoice number", "invoice no", "inv no", "doc no", "document number"],
  Invoice_Date: ["invoice date", "inv date", "date"],
  Taxable_Amount: ["taxable value", "taxable amount", "taxable"],
  IGST: ["integrated tax", "igst"],
  CGST: ["central tax", "cgst"],
  SGST: ["state/ut tax", "state tax", "sgst"],
};

const PR_COLUMN_MAP: ColMap = {
  GSTIN: ["gst identification number (gstin)", "gstin", "gst no", "supplier gstin", "vendor gstin"],
  Party_Name: ["vendor name", "party name", "supplier name", "trade name"],
  Invoice_No: ["bill number", "invoice number", "invoice no", "inv no", "voucher no"],
  Branch_Name: ["branch name", "branch", "location"],
  Taxable_Amount: ["taxable", "taxable value", "taxable amount", "base amount"],
  IGST: ["igst", "integrated tax"],
  CGST: ["cgst", "central tax"],
  SGST: ["sgst", "state tax", "state/ut tax"],
};

const HEADER_KEYWORDS = ["gstin", "gst no", "party", "supplier"];

function findHeaderRow(raw: Cell[][], maxScan = 10): number {
  const limit = Math.min(maxScan, raw.length);
  for (let i = 0; i < limit; i++) {
    const row = raw[i] ?? [];
    if (row.some((cell) => {
      const c = s(cell).toLowerCase();
      return HEADER_KEYWORDS.some((kw) => c.includes(kw));
    })) return i;
  }
  return 0;
}

/** map_columns: exact (lower/trim) match first, then substring. */
function mapColumns(columns: string[], colMap: ColMap): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const [std, candidates] of Object.entries(colMap)) {
    let found: string | null = null;
    for (const cand of candidates) {
      const cl = cand.toLowerCase();
      for (const col of columns) {
        if (String(col).toLowerCase().trim() === cl) { found = col; break; }
      }
      if (found) break;
      for (const col of columns) {
        if (String(col).toLowerCase().includes(cl)) { found = col; break; }
      }
      if (found) break;
    }
    mapping[std] = found;
  }
  return mapping;
}

async function loadWithHeader(buffer: Buffer, colMap: ColMap): Promise<{ frame: Frame; map: Record<string, string | null> }> {
  const raw = await readFirstSheetRaw(buffer);
  const headerRow = findHeaderRow(raw.slice(0, 15));
  const sheet = frameFromRaw(raw, headerRow);
  return { frame: sheet, map: mapColumns(sheet.columns, colMap) };
}

interface Std2B {
  GSTIN: string; Invoice_No: string; Party_Name: string; Invoice_Date: Cell;
  Taxable_Amount: number; IGST: number; CGST: number; SGST: number;
  Total_Tax: number; Invoice_Value: number; Match_Key: string;
}
interface StdPR extends Std2B { Branch_Name: string; }

const BAD = new Set(["NAN", "NONE", ""]);

export interface RecoSummary {
  matched_count: number; matched_taxable: number; matched_tax: number;
  mismatched_count: number; mismatched_2b_taxable: number; mismatched_books_taxable: number;
  not_in_2b_count: number; not_in_2b_taxable: number; not_in_2b_tax: number;
  not_in_books_count: number; not_in_books_taxable: number; not_in_books_tax: number;
  total_2b_records: number; total_pr_records: number;
}

export interface RecoResult { success: true; summary: RecoSummary; filename: string; }

export async function runReconciliation(
  buf2b: Buffer, bufPr: Buffer, outDir: string, idSeed: string,
): Promise<RecoResult> {
  const { frame: df2bRaw, map: m2b } = await loadWithHeader(buf2b, TWO_B_COLUMN_MAP);
  const { frame: dfPrRaw, map: mpr } = await loadWithHeader(bufPr, PR_COLUMN_MAP);

  const required = ["GSTIN", "Invoice_No", "Taxable_Amount"];
  const missing2b = required.filter((r) => !m2b[r]);
  const missingPr = required.filter((r) => !mpr[r]);
  if (missing2b.length) throw new Error(`Missing columns in 2B file: ${missing2b.join(", ")}. Available: ${df2bRaw.columns.slice(0, 10).join(", ")}`);
  if (missingPr.length) throw new Error(`Missing columns in Purchase Register: ${missingPr.join(", ")}. Available: ${dfPrRaw.columns.slice(0, 10).join(", ")}`);

  // --- standardise 2B ---
  const std2b: Std2B[] = [];
  for (const r of df2bRaw.rows) {
    const gstin = s(r[m2b.GSTIN!]).toUpperCase();
    const inv = s(r[m2b.Invoice_No!]).toUpperCase();
    if (BAD.has(gstin) || BAD.has(inv)) continue;
    const taxable = round2(num0(r[m2b.Taxable_Amount!]));
    const igst = m2b.IGST ? num0(r[m2b.IGST]) : 0;
    const cgst = m2b.CGST ? num0(r[m2b.CGST]) : 0;
    const sgst = m2b.SGST ? num0(r[m2b.SGST]) : 0;
    const totalTax = round2(igst + cgst + sgst);
    std2b.push({
      GSTIN: gstin, Invoice_No: inv,
      Party_Name: m2b.Party_Name ? s(r[m2b.Party_Name]) : "",
      Invoice_Date: m2b.Invoice_Date ? r[m2b.Invoice_Date] ?? "" : "",
      Taxable_Amount: taxable, IGST: igst, CGST: cgst, SGST: sgst,
      Total_Tax: totalTax, Invoice_Value: round2(taxable + totalTax),
      Match_Key: `${gstin}|${inv}`,
    });
  }

  // --- standardise PR ---
  const stdPr: StdPR[] = [];
  for (const r of dfPrRaw.rows) {
    const gstin = s(r[mpr.GSTIN!]).toUpperCase();
    const inv = s(r[mpr.Invoice_No!]).toUpperCase();
    if (BAD.has(gstin) || BAD.has(inv)) continue;
    const taxable = num0(r[mpr.Taxable_Amount!]);
    const igst = mpr.IGST ? num0(r[mpr.IGST]) : 0;
    const cgst = mpr.CGST ? num0(r[mpr.CGST]) : 0;
    const sgst = mpr.SGST ? num0(r[mpr.SGST]) : 0;
    stdPr.push({
      GSTIN: gstin, Invoice_No: inv,
      Party_Name: mpr.Party_Name ? s(r[mpr.Party_Name]) : "",
      Branch_Name: mpr.Branch_Name ? s(r[mpr.Branch_Name]) : "",
      Invoice_Date: "",
      Taxable_Amount: taxable, IGST: igst, CGST: cgst, SGST: sgst,
      Total_Tax: igst + cgst + sgst, Invoice_Value: 0,
      Match_Key: `${gstin}|${inv}`,
    });
  }

  // --- aggregate PR by GSTIN + Invoice_No ---
  const prRows: Row[] = stdPr.map((p) => ({ ...p }));
  const prGroups = groupBy(prRows, (r) => `${s(r.GSTIN)}|${s(r.Invoice_No)}`);
  const prAgg = new Map<string, StdPR>();
  for (const [key, rows] of prGroups) {
    const f = rows[0];
    const taxable = round2(rows.reduce((a, r) => a + num0(r.Taxable_Amount), 0));
    const igst = rows.reduce((a, r) => a + num0(r.IGST), 0);
    const cgst = rows.reduce((a, r) => a + num0(r.CGST), 0);
    const sgst = rows.reduce((a, r) => a + num0(r.SGST), 0);
    const totalTax = round2(igst + cgst + sgst);
    prAgg.set(key, {
      GSTIN: s(f.GSTIN), Invoice_No: s(f.Invoice_No),
      Party_Name: s(f.Party_Name), Branch_Name: s(f.Branch_Name), Invoice_Date: "",
      Taxable_Amount: taxable, IGST: igst, CGST: cgst, SGST: sgst,
      Total_Tax: totalTax, Invoice_Value: round2(taxable + totalTax),
      Match_Key: key,
    });
  }

  // --- matching (2B is de-duped by set-index like the original) ---
  const twoBByKey = new Map<string, Std2B>();
  for (const r of std2b) twoBByKey.set(r.Match_Key, r);   // last wins, mirrors set_index
  const keys2b = new Set(twoBByKey.keys());
  const keysPr = new Set(prAgg.keys());

  interface MergedRow extends Std2B { pr: StdPR; Diff_Taxable: number; Diff_Total_Tax: number; }
  const matched: MergedRow[] = [];
  const mismatched: MergedRow[] = [];
  for (const key of keys2b) {
    if (!keysPr.has(key)) continue;
    const a = twoBByKey.get(key)!;
    const p = prAgg.get(key)!;
    const diffTax = Math.abs(a.Taxable_Amount - p.Taxable_Amount);
    const diffTotal = Math.abs(a.Total_Tax - p.Total_Tax);
    const row: MergedRow = { ...a, pr: p, Diff_Taxable: diffTax, Diff_Total_Tax: diffTotal };
    if (diffTax <= 1 && diffTotal <= 1) matched.push(row);
    else mismatched.push(row);
  }
  const notInBooks = [...keys2b].filter((k) => !keysPr.has(k)).map((k) => twoBByKey.get(k)!);
  const notIn2b = [...keysPr].filter((k) => !keys2b.has(k)).map((k) => prAgg.get(k)!);

  const sum = (arr: number[]) => round2(arr.reduce((a, b) => a + b, 0));
  const summary: RecoSummary = {
    matched_count: matched.length,
    matched_taxable: sum(matched.map((m) => m.Taxable_Amount)),
    matched_tax: sum(matched.map((m) => m.Total_Tax)),
    mismatched_count: mismatched.length,
    mismatched_2b_taxable: sum(mismatched.map((m) => m.Taxable_Amount)),
    mismatched_books_taxable: sum(mismatched.map((m) => m.pr.Taxable_Amount)),
    not_in_2b_count: notIn2b.length,
    not_in_2b_taxable: sum(notIn2b.map((m) => m.Taxable_Amount)),
    not_in_2b_tax: sum(notIn2b.map((m) => m.Total_Tax)),
    not_in_books_count: notInBooks.length,
    not_in_books_taxable: sum(notInBooks.map((m) => m.Taxable_Amount)),
    not_in_books_tax: sum(notInBooks.map((m) => m.Total_Tax)),
    total_2b_records: std2b.length,
    total_pr_records: prAgg.size,
  };

  const filename = `GST_2B_Reco_${idSeed}.xlsx`;
  await writeWorkbook(path.join(outDir, filename), summary, matched, mismatched, notIn2b, notInBooks);
  return { success: true, summary, filename };
}

// ---------------------------------------------------------------------------
// Excel writing
// ---------------------------------------------------------------------------
const HDR: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF366092" } },
  alignment: { horizontal: "center", vertical: "middle" },
};
function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}
const GREEN1 = "FFC6EFCE", GREEN2 = "FFE2EFDA", RED = "FFFFC7CE", YELLOW = "FFFFEB9C", BLUE = "FFBDD7EE";

interface MergedRow {
  GSTIN: string; Invoice_No: string; Party_Name: string; Invoice_Date: Cell;
  Taxable_Amount: number; IGST: number; CGST: number; SGST: number; Total_Tax: number; Invoice_Value: number;
  pr: { Party_Name: string; Taxable_Amount: number; IGST: number; CGST: number; SGST: number; Total_Tax: number; Invoice_Value: number; };
  Diff_Taxable: number; Diff_Total_Tax: number;
}

async function writeWorkbook(
  fpath: string, summary: RecoSummary,
  matched: MergedRow[], mismatched: MergedRow[],
  notIn2b: StdPR[], notInBooks: Std2B[],
): Promise<void> {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: fpath, useStyles: true });

  // Summary
  const sumWs = wb.addWorksheet("Summary");
  sumWs.columns = [{ width: 32 }, { width: 10 }, { width: 18 }, { width: 18 }];
  const title = sumWs.addRow(["GST 2B RECONCILIATION SUMMARY"]);
  title.getCell(1).style = { font: { bold: true, size: 14, color: { argb: "FFFFFFFF" } }, fill: fill("FF366092"), alignment: { horizontal: "left", vertical: "middle" } };
  title.commit();
  sumWs.addRow([]).commit();
  const sh = sumWs.addRow(["Category", "Count", "Taxable Amount", "Total Tax"]);
  sh.eachCell((c) => { c.style = HDR; });
  sh.commit();
  const summaryRows: Array<[string, number, number, number, string]> = [
    ["Matched", summary.matched_count, summary.matched_taxable, summary.matched_tax, GREEN1],
    ["Mismatched", summary.mismatched_count, summary.mismatched_2b_taxable, 0, RED],
    ["Not in 2B (Only in Books)", summary.not_in_2b_count, summary.not_in_2b_taxable, summary.not_in_2b_tax, YELLOW],
    ["Not in Books (Only in 2B)", summary.not_in_books_count, summary.not_in_books_taxable, summary.not_in_books_tax, BLUE],
  ];
  for (const [label, count, taxable, tax, bg] of summaryRows) {
    const row = sumWs.addRow([label, count, taxable, tax]);
    row.eachCell((c) => { c.fill = fill(bg); c.font = { bold: true }; });
    row.commit();
  }
  sumWs.commit();

  // Matched (two rows per record: As Per 2B / As Per Books)
  const mWs = wb.addWorksheet("Matched");
  if (matched.length) {
    mWs.columns = [{ width: 14 }, { width: 20 }, { width: 28 }, { width: 18 }, { width: 18 },
      ...Array(7).fill({ width: 16 })];
    const h = mWs.addRow(["Source", "GSTIN", "Party Name", "Invoice No", "Invoice Date",
      "Taxable Amount", "IGST", "CGST", "SGST", "Total Tax", "Invoice Value", "Status"]);
    h.eachCell((c) => { c.style = HDR; });
    h.commit();
    matched.forEach((rec, i) => {
      const bg = i % 2 === 0 ? GREEN1 : GREEN2;
      const lines: Array<[string, number, number, number, number, number, number, Cell]> = [
        ["As Per 2B", rec.Taxable_Amount, rec.IGST, rec.CGST, rec.SGST, rec.Total_Tax, rec.Invoice_Value, rec.Invoice_Date],
        ["As Per Books", rec.pr.Taxable_Amount, rec.pr.IGST, rec.pr.CGST, rec.pr.SGST, rec.pr.Total_Tax, rec.pr.Invoice_Value, ""],
      ];
      for (const [src, taxable, igst, cgst, sgst, ttax, ival, date] of lines) {
        const row = mWs.addRow([src, rec.GSTIN, rec.pr.Party_Name, rec.Invoice_No, date,
          taxable, igst, cgst, sgst, ttax, ival, "Matched"]);
        row.eachCell((c) => { c.fill = fill(bg); });
        row.commit();
      }
    });
  }
  mWs.commit();

  // Mismatched (Books section, then 2B section)
  const misWs = wb.addWorksheet("Mismatched");
  if (mismatched.length) {
    const hdrs = ["GSTIN", "Party Name", "Invoice No", "Invoice Date",
      "Taxable Amount", "IGST", "CGST", "SGST", "Total Tax", "Invoice Value", "Diff Taxable", "Diff Tax"];
    misWs.columns = [{ width: 22 }, { width: 28 }, ...Array(10).fill({ width: 16 })];
    const t1 = misWs.addRow(["Mis-Match As Per Books"]);
    t1.getCell(1).style = { font: { bold: true, size: 12 }, fill: fill(RED) };
    t1.commit();
    const h1 = misWs.addRow(hdrs); h1.eachCell((c) => { c.style = HDR; }); h1.commit();
    for (const rec of mismatched) {
      misWs.addRow([rec.GSTIN, rec.pr.Party_Name, rec.Invoice_No, "",
        rec.pr.Taxable_Amount, rec.pr.IGST, rec.pr.CGST, rec.pr.SGST, rec.pr.Total_Tax, rec.pr.Invoice_Value,
        round2(rec.Diff_Taxable), round2(rec.Diff_Total_Tax)]).commit();
    }
    misWs.addRow([]).commit();
    const t2 = misWs.addRow(["Mis-Match As Per 2B"]);
    t2.getCell(1).style = { font: { bold: true, size: 12 }, fill: fill(YELLOW) };
    t2.commit();
    const h2 = misWs.addRow(hdrs); h2.eachCell((c) => { c.style = HDR; }); h2.commit();
    for (const rec of mismatched) {
      misWs.addRow([rec.GSTIN, rec.pr.Party_Name, rec.Invoice_No, rec.Invoice_Date,
        rec.Taxable_Amount, rec.IGST, rec.CGST, rec.SGST, rec.Total_Tax, rec.Invoice_Value,
        round2(rec.Diff_Taxable), round2(rec.Diff_Total_Tax)]).commit();
    }
  }
  misWs.commit();

  // Not in 2B
  const n2bWs = wb.addWorksheet("Not in 2B");
  if (notIn2b.length) {
    n2bWs.columns = [{ width: 22 }, { width: 28 }, ...Array(8).fill({ width: 16 })];
    const h = n2bWs.addRow(["GSTIN", "Invoice_No", "Party_Name", "Branch", "Books_Taxable", "Books_IGST", "Books_CGST", "Books_SGST", "Books_Total_Tax", "Books_Invoice_Value"]);
    h.eachCell((c) => { c.style = HDR; }); h.commit();
    for (const r of notIn2b) {
      n2bWs.addRow([r.GSTIN, r.Invoice_No, r.Party_Name, r.Branch_Name, r.Taxable_Amount, r.IGST, r.CGST, r.SGST, r.Total_Tax, r.Invoice_Value]).commit();
    }
  }
  n2bWs.commit();

  // Not in Books
  const nbWs = wb.addWorksheet("Not in Books");
  if (notInBooks.length) {
    nbWs.columns = [{ width: 22 }, { width: 28 }, ...Array(8).fill({ width: 16 })];
    const h = nbWs.addRow(["GSTIN", "Invoice_No", "Party_Name", "Invoice_Date", "2B_Taxable", "2B_IGST", "2B_CGST", "2B_SGST", "2B_Total_Tax", "2B_Invoice_Value"]);
    h.eachCell((c) => { c.style = HDR; }); h.commit();
    for (const r of notInBooks) {
      nbWs.addRow([r.GSTIN, r.Invoice_No, r.Party_Name, r.Invoice_Date, r.Taxable_Amount, r.IGST, r.CGST, r.SGST, r.Total_Tax, r.Invoice_Value]).commit();
    }
  }
  nbWs.commit();

  await wb.commit();
}
