import path from "node:path";
import ExcelJS from "exceljs";

export type CellValue = string | number | Date | null;

export interface VendorWorkbook {
  vendorName: string;
  filename: string;
  filePath: string;
}

export interface BifurcateOptions {
  sourceXlsxPath: string;
  outDir: string;
  periodLabel: string;
  monthYearSuffix: string;        // e.g. "Mar2026" — used in output filenames
  orgName?: string;
}

function safeFilename(name: string): string {
  return String(name ?? "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function asCell(v: ExcelJS.CellValue): CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
    return typeof v === "boolean" ? (v ? 1 : 0) : v;
  }
  // formula / rich text / hyperlink
  if (typeof v === "object") {
    const obj = v as { result?: ExcelJS.CellValue; text?: string };
    if ("result" in obj && obj.result !== undefined) return asCell(obj.result as ExcelJS.CellValue);
    if ("text" in obj && typeof obj.text === "string") return obj.text;
  }
  return null;
}

function isNumeric(v: CellValue): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

async function readSheet3Matrix(srcPath: string): Promise<CellValue[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(srcPath);
  const ws = wb.getWorksheet("Sheet3");
  if (!ws) throw new Error("Source workbook has no 'Sheet3'");

  const matrix: CellValue[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const out: CellValue[] = [];
    // exceljs row.values is 1-indexed with values[0] === undefined
    const values = row.values as ExcelJS.CellValue[];
    for (let c = 1; c < values.length; c++) {
      out.push(asCell(values[c]));
    }
    matrix.push(out);
  });
  return matrix;
}

function findRows(matrix: CellValue[][], label: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const first = matrix[i]?.[0];
    if (typeof first === "string" && first.trim() === label) result.push(i);
  }
  return result;
}

async function writeVendorWorkbook(
  outPath: string,
  vendorName: string,
  headerRow: CellValue[],
  dataRows: CellValue[][],
  totalRow: CellValue[],
  periodLabel: string,
  orgName: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("194Q");

  // Row 1: title across A..K
  ws.mergeCells(1, 1, 1, 11);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${orgName} — 194Q TDS Deduction Statement`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Row 2: vendor + period
  ws.mergeCells(2, 1, 2, 11);
  const subCell = ws.getCell(2, 1);
  subCell.value = `Vendor: ${vendorName}    |    Period: ${periodLabel}`;
  subCell.font = { bold: true, size: 11 };
  subCell.alignment = { horizontal: "center", vertical: "middle" };

  // Row 3: blank spacer
  ws.addRow([]);

  // Row 4: header
  const headerExcelRow = ws.addRow(headerRow.map((v) => v ?? ""));
  headerExcelRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF305496" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder();
  });

  // Data rows
  for (const row of dataRows) {
    const r = ws.addRow(row.map((v) => v ?? ""));
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder();
    });
  }

  // Total row
  const totalExcelRow = ws.addRow(totalRow.map((v) => v ?? ""));
  totalExcelRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    cell.border = thinBorder();
  });

  // Date column formatting (column 3 in source layout)
  const headerRowIdx = 4;
  const totalRowIdx = totalExcelRow.number;
  for (let r = headerRowIdx + 1; r < totalRowIdx; r++) {
    const cell = ws.getCell(r, 3);
    if (cell.value !== null && cell.value !== "") {
      cell.numFmt = "dd-mmm-yyyy";
    }
  }

  // Auto-width
  const widths = new Map<number, number>();
  for (let r = headerRowIdx; r <= totalRowIdx; r++) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const v = cell.value;
      if (v === null || v === "" || v === undefined) return;
      const len = String(v).length;
      widths.set(colNumber, Math.max(widths.get(colNumber) ?? 10, len));
    });
  }
  for (const [col, w] of widths) {
    ws.getColumn(col).width = Math.min(w + 2, 50);
  }

  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  await wb.xlsx.writeFile(outPath);
}

function thinBorder(): ExcelJS.Borders {
  const side = { style: "thin" as const, color: { argb: "FFB4B4B4" } };
  return { left: side, right: side, top: side, bottom: side } as ExcelJS.Borders;
}

export async function bifurcate(opts: BifurcateOptions): Promise<VendorWorkbook[]> {
  const matrix = await readSheet3Matrix(opts.sourceXlsxPath);

  const headerIdxs = findRows(matrix, "Vendor");
  const totalIdxs = findRows(matrix, "Total");
  const pairs: Array<[number, number]> = [];
  const n = Math.min(headerIdxs.length, totalIdxs.length);
  for (let i = 0; i < n; i++) pairs.push([headerIdxs[i], totalIdxs[i]]);

  const out: VendorWorkbook[] = [];
  const orgName = opts.orgName ?? "VASA DENTICITY LIMITED";

  for (const [hi, ti] of pairs) {
    if (ti <= hi + 1) continue;
    // block = rows (hi+1 .. ti), columns 0..10
    const block = matrix.slice(hi + 1, ti).map((r) => r.slice(0, 11));
    if (block.every((row) => row.every((c) => c === null))) continue;

    // first non-null in column 0 = vendor name
    let vendorName = "";
    for (const row of block) {
      const c = row[0];
      if (typeof c === "string" && c.trim()) {
        vendorName = c.trim();
        break;
      }
    }
    if (!vendorName || vendorName.toLowerCase() === "total") continue;

    let headerRow = (matrix[hi] ?? []).slice(0, 11);
    let dataRows = block;

    // Drop columns whose header contains "check" or "diff"
    const dropIdx = new Set<number>();
    headerRow.forEach((h, i) => {
      const t = String(h ?? "").toLowerCase();
      if (t.includes("check") || t.includes("diff")) dropIdx.add(i);
    });
    if (dropIdx.size > 0) {
      const keep = headerRow.map((_, i) => i).filter((i) => !dropIdx.has(i));
      headerRow = keep.map((i) => headerRow[i] ?? null);
      dataRows = dataRows.map((r) => keep.map((i) => r[i] ?? null));
    }

    // Compute totals for columns whose header is "Total" or "TDS" (case-insensitive)
    const sumTargets = new Set(["total", "tds"]);
    const sumCols = new Set<number>();
    headerRow.forEach((h, i) => {
      if (sumTargets.has(String(h ?? "").trim().toLowerCase())) sumCols.add(i);
    });
    const totalRow: CellValue[] = new Array(headerRow.length).fill("");
    if (headerRow.length > 0) totalRow[0] = "Total";
    for (const i of sumCols) {
      let s = 0;
      for (const r of dataRows) {
        const v = r[i];
        if (isNumeric(v)) s += v;
      }
      totalRow[i] = Math.round(s * 100) / 100;
    }

    const filename = `${safeFilename(vendorName)}_${opts.monthYearSuffix}.xlsx`;
    const filePath = path.join(opts.outDir, filename);
    await writeVendorWorkbook(filePath, vendorName, headerRow, dataRows, totalRow, opts.periodLabel, orgName);
    out.push({ vendorName, filename, filePath });
  }

  return out;
}
