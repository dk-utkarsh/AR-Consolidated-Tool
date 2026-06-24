// ComplianceGuard — input preparation. Faithful TS port of app/preparation.py.
import {
  type Cell, type Row,
  s, num0, round2, isValidGst, invoicePlace, groupBy, sumCol, findCol,
} from "./helpers";
import type { SheetData } from "./excel";
import type { Frame } from "./types";

/** Resolve the first candidate column that exists in the sheet, else null. */
function pick(columns: string[], candidates: string[]): string | null {
  for (const c of candidates) if (columns.includes(c)) return c;
  return null;
}

/** sales_df.get(col, default) over a row, given the resolved column (or null). */
function getv(row: Row, col: string | null, dflt: Cell = ""): Cell {
  return col ? row[col] ?? dflt : dflt;
}

// ---------------------------------------------------------------------------
// prepare_raw_sales_sheet — filters to valid-GST (B2B) rows only.
// ---------------------------------------------------------------------------
export function prepareRawSales(sales: SheetData): Frame {
  const cols = sales.columns;
  const cInvNo = pick(cols, ["InvoiceNo"]);
  const cQty = pick(cols, ["QTY"]);
  const cUnit = pick(cols, ["Unit Price"]);
  const cTaxPct = pick(cols, ["TaxPercent"]);
  const cTaxable = pick(cols, ["Taxable Value", "TaxableAmount"]);
  const cCgst = pick(cols, ["CGSTAmount"]);
  const cSgst = pick(cols, ["SGSTAmount"]);
  const cIgst = pick(cols, ["IGSTAmount"]);
  const cTax = pick(cols, ["TaxAmount"]);
  const cSelling = pick(cols, ["Selling Price"]);
  const cDisc = pick(cols, ["Discount on item"]);
  const cDate = pick(cols, ["DateofInvoice", "Date of Invoice"]);
  const cOrderNo = pick(cols, ["ExternalOrderNo", "External Order No"]);
  const cChannel = pick(cols, ["Order Channel"]);
  const cCustomer = pick(cols, ["Billing Name of Customer", "Name of Customer"]);
  const cState = pick(cols, ["State"]);
  const cSku = pick(cols, ["ClientSKU", "ClientSku"]);
  const cDesc = pick(cols, ["DescriptionofGoods", "DescriptionOfGoods"]);
  const cHsn = pick(cols, ["HSN Code"]);
  const cGst = pick(cols, ["GST No"]);
  const cIrn = pick(cols, ["E-invoice No.(IRN)"]);
  const cEway = pick(cols, ["E-way bill number"]);

  const out: Row[] = [];
  for (const r of sales.rows) {
    if (!isValidGst(r[cGst ?? "GST No"])) continue;
    const taxable = num0(getv(r, cTaxable, 0));
    const totalTax = num0(getv(r, cTax, 0));
    out.push({
      "Invoice No": s(getv(r, cInvNo, "")),
      "Invoice Place": invoicePlace(getv(r, cInvNo, "")),
      "Invoice Date": getv(r, cDate, ""),
      "Order No": getv(r, cOrderNo, ""),
      Channel: getv(r, cChannel, ""),
      "Billing Name of Customer": getv(r, cCustomer, ""),
      State: getv(r, cState, ""),
      "Client SKU": getv(r, cSku, ""),
      "Description of Goods": getv(r, cDesc, ""),
      "HSN Code": getv(r, cHsn, ""),
      "GST No": getv(r, cGst, ""),
      "E-invoice No.(IRN)": getv(r, cIrn, ""),
      "E-way bill number": getv(r, cEway, ""),
      QTY: num0(getv(r, cQty, 0)),
      "Unit Price": num0(getv(r, cUnit, 0)),
      TaxPercent: num0(getv(r, cTaxPct, 0)),
      "Taxable Value": taxable,
      CGST: num0(getv(r, cCgst, 0)),
      SGST: num0(getv(r, cSgst, 0)),
      IGST: num0(getv(r, cIgst, 0)),
      "Total Tax": totalTax,
      "Selling Price": num0(getv(r, cSelling, 0)),
      Discount: num0(getv(r, cDisc, 0)),
      Total: round2(taxable + totalTax),
    });
  }

  // Invoice Total = groupby('Invoice No')['Total'].transform('sum')
  const groups = groupBy(out, (r) => s(r["Invoice No"]));
  const invTotal = new Map<string, number>();
  for (const [k, rows] of groups) invTotal.set(k, sumCol(rows, "Total"));
  for (const r of out) r["Invoice Total"] = invTotal.get(s(r["Invoice No"])) ?? 0;

  const columns = [
    "Invoice No", "Invoice Place", "Invoice Date", "Order No", "Channel",
    "Billing Name of Customer", "State", "Client SKU", "Description of Goods",
    "HSN Code", "GST No", "E-invoice No.(IRN)", "E-way bill number", "QTY",
    "Unit Price", "TaxPercent", "Taxable Value", "CGST", "SGST", "IGST",
    "Total Tax", "Selling Price", "Discount", "Total", "Invoice Total",
  ];
  return { columns, rows: out };
}

// ---------------------------------------------------------------------------
// prepare_einvoice_data — valid-GST filter + dedup by invoice number.
// ---------------------------------------------------------------------------
export function prepareEinvoice(einv: SheetData): Frame {
  let rows = einv.rows;
  const cols = einv.columns;

  const gstinCol = findCol(cols, ["gstin/uin", "gstin of recipient", "recipient gstin"]);
  if (gstinCol) rows = rows.filter((r) => isValidGst(r[gstinCol]));

  const invNoCol = findCol(cols, ["invoice number", "invoice no", "doc no"]);
  const invValCol = findCol(cols, ["invoice value", "inv value", "total value"]);
  const irnCol = findCol(cols, ["irn"]);
  const dateCol = findCol(cols, ["invoice date", "inv date", "doc date"]);
  const gstin2 = findCol(cols, ["gstin/uin", "gstin of recipient", "recipient gstin"]);
  const nameCol = findCol(cols, ["receiver name", "trade name", "legal name", "party name"]);

  if (!invNoCol) throw new Error(`Cannot find Invoice Number column. Available: ${cols.slice(0, 15).join(", ")}`);
  if (!invValCol) throw new Error(`Cannot find Invoice Value column. Available: ${cols.slice(0, 15).join(", ")}`);

  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of rows) {
    const key = s(r[invNoCol]);                 // drop_duplicates(keep='first') is on raw value
    const rawKey = String(r[invNoCol] ?? "");
    if (seen.has(rawKey)) continue;
    seen.add(rawKey);
    out.push({
      "E-Invoice No": key,
      "E-Invoice Amount": num0(r[invValCol]),
      IRN: irnCol ? s(r[irnCol]) : "",
      "Invoice date": dateCol ? r[dateCol] ?? "" : "",
      "GSTIN/UIN of Recipient": gstin2 ? s(r[gstin2]) : "",
      "Receiver Name": nameCol ? s(r[nameCol]) : "",
    });
  }
  return {
    columns: ["E-Invoice No", "E-Invoice Amount", "IRN", "Invoice date", "GSTIN/UIN of Recipient", "Receiver Name"],
    rows: out,
  };
}

// ---------------------------------------------------------------------------
// prepare_eway_data — normalise Doc.No / Other Party GSTIN, keep all columns.
// ---------------------------------------------------------------------------
export function prepareEway(eway: SheetData): Frame {
  const cols = [...eway.columns];
  const docCol = findCol(cols, ["doc.no", "doc no", "invoice no", "inv no"]);
  const gstinCol = findCol(cols, ["other party gstin", "to gstn", "from gstn", "party gstin"]);

  const rename = new Map<string, string>();
  if (docCol && docCol !== "Doc.No") rename.set(docCol, "Doc.No");
  if (gstinCol && gstinCol !== "Other Party GSTIN") rename.set(gstinCol, "Other Party GSTIN");

  const newCols = cols.map((c) => rename.get(c) ?? c);
  if (!newCols.includes("Doc.No")) {
    throw new Error(`Cannot find Doc/Invoice No column in E-way Bill. Available: ${cols.slice(0, 15).join(", ")}`);
  }

  const rows: Row[] = eway.rows.map((r) => {
    const o: Row = {};
    for (const c of cols) o[rename.get(c) ?? c] = r[c] ?? null;
    o["Doc.No"] = s(o["Doc.No"]);
    return o;
  });
  return { columns: newCols, rows };
}
