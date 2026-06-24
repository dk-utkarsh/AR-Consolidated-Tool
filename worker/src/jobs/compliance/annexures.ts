// ComplianceGuard — the 17 annexure checks. Faithful TS port of
// app/annexures/{sales_einvoice,eway_bill,sales_checks,credit_note}.py.
// Each function returns a Frame; an empty Frame means "no discrepancies".
import {
  type Cell, type Row,
  s, num, num0, round2, isValidGst, groupBy, uniqueStrings, distinct, findCol,
} from "./helpers";
import type { Frame } from "./types";
import { EMPTY } from "./types";

// ----- small frame helpers -------------------------------------------------

function frame(columns: string[], rows: Row[]): Frame {
  return rows.length ? { columns, rows } : EMPTY;
}

function gv(row: Row, col: string | null, dflt: Cell = ""): Cell {
  return col ? row[col] ?? dflt : dflt;
}

function pickCol(columns: string[], candidates: string[]): string | null {
  for (const c of candidates) if (columns.includes(c)) return c;
  return null;
}

function sortNum(rows: Row[], col: string, ascending: boolean): Row[] {
  return [...rows].sort((a, b) => {
    const x = num0(a[col]);
    const y = num0(b[col]);
    return ascending ? x - y : y - x;
  });
}

function sortStr(rows: Row[], col: string, ascending = true): Row[] {
  return [...rows].sort((a, b) => {
    const x = s(a[col]);
    const y = s(b[col]);
    return ascending ? x.localeCompare(y) : y.localeCompare(x);
  });
}

function sortAbs(rows: Row[], col: string): Row[] {
  return [...rows].sort((a, b) => Math.abs(num0(b[col])) - Math.abs(num0(a[col])));
}

// ===========================================================================
// Annexures 1-3 : Sales vs E-Invoice
// ===========================================================================

export function annexure1(rawSales: Frame, einv: Frame): Frame {
  const einvAmt = new Map<string, number>();
  for (const r of einv.rows) {
    const k = s(r["E-Invoice No"]);
    if (!einvAmt.has(k)) einvAmt.set(k, num0(r["E-Invoice Amount"]));
  }

  const groups = groupBy(rawSales.rows, (r) => s(r["Invoice No"]));
  const out: Row[] = [];
  for (const [inv, rows] of groups) {
    if (!einvAmt.has(inv)) continue;                     // merge inner
    const total = round2(rows.reduce((a, r) => a + num0(r["Total"]), 0));
    const amt = einvAmt.get(inv)!;
    const diff = round2(total - amt);
    if (Math.abs(diff) <= 0.01) continue;
    const f = rows[0];
    out.push({
      "Invoice No": inv,
      Company: f["Channel"] ?? "",
      "Date of Invoice": f["Invoice Date"] ?? "",
      "Order No": "",
      "Order Channel": f["Channel"] ?? "",
      "Billing Name of Customer": f["Billing Name of Customer"] ?? "",
      State2: f["State"] ?? "",
      "Client SKU": f["Client SKU"] ?? "",
      "Description of Goods": f["Description of Goods"] ?? "",
      QTY: round2(rows.reduce((a, r) => a + num0(r["QTY"]), 0)),
      "HSN Code": f["HSN Code"] ?? "",
      "GST No": f["GST No"] ?? "",
      "E-invoice No.(IRN)": f["E-invoice No.(IRN)"] ?? "",
      "E-way bill number": f["E-way bill number"] ?? "",
      "Unit Price": f["Unit Price"] ?? "",
      Tax: f["TaxPercent"] ?? "",
      "Taxable Value": round2(rows.reduce((a, r) => a + num0(r["Taxable Value"]), 0)),
      CGST: round2(rows.reduce((a, r) => a + num0(r["CGST"]), 0)),
      SGST: round2(rows.reduce((a, r) => a + num0(r["SGST"]), 0)),
      IGST: round2(rows.reduce((a, r) => a + num0(r["IGST"]), 0)),
      "Total Tax": round2(rows.reduce((a, r) => a + num0(r["Total Tax"]), 0)),
      Total: total,
      "": "",
      " ": "",
      "  ": "",
      Remark: "E-Invoice & Sale Invoice Not Matched",
      "E-Invoice": inv,
      Amount: amt,
      "Diff.": diff,
    });
  }
  return frame(
    ["Invoice No", "Company", "Date of Invoice", "Order No", "Order Channel",
      "Billing Name of Customer", "State2", "Client SKU", "Description of Goods",
      "QTY", "HSN Code", "GST No", "E-invoice No.(IRN)", "E-way bill number",
      "Unit Price", "Tax", "Taxable Value", "CGST", "SGST", "IGST", "Total Tax",
      "Total", "", " ", "  ", "Remark", "E-Invoice", "Amount", "Diff."],
    out,
  );
}

export function annexure2(rawSales: Frame, einv: Frame): Frame {
  const einvSet = uniqueStrings(einv.rows, "E-Invoice No");
  const groups = groupBy(rawSales.rows, (r) => s(r["Invoice No"]));
  const out: Row[] = [];
  for (const [inv, rows] of groups) {
    if (einvSet.has(inv)) continue;                      // missing in e-invoice
    const skus = distinct(rows.map((r) => s(r["Client SKU"])));
    const descs = distinct(rows.map((r) => s(r["Description of Goods"])));
    const f = rows[0];
    out.push({
      Remark: "E-Invoice Not Found",
      "Invoice No": inv,
      "Invoice Place": f["Invoice Place"] ?? "",
      "Date of Invoice": f["Invoice Date"] ?? "",
      "Order No": f["Order No"] ?? "",
      Channel: f["Channel"] ?? "",
      "Billing Name of Customer": f["Billing Name of Customer"] ?? "",
      State: f["State"] ?? "",
      "GST No": f["GST No"] ?? "",
      "Client SKUs": skus.slice(0, 3).join(", ") + (skus.length > 3 ? "..." : ""),
      Description: descs.slice(0, 2).join(", ") + (descs.length > 2 ? "..." : ""),
      QTY: round2(rows.reduce((a, r) => a + num0(r["QTY"]), 0)),
      "Taxable Value": round2(rows.reduce((a, r) => a + num0(r["Taxable Value"]), 0)),
      "Total Tax": round2(rows.reduce((a, r) => a + num0(r["Total Tax"]), 0)),
      "Invoice Total": round2(rows.reduce((a, r) => a + num0(r["Total"]), 0)),
    });
  }
  return frame(
    ["Remark", "Invoice No", "Invoice Place", "Date of Invoice", "Order No",
      "Channel", "Billing Name of Customer", "State", "GST No", "Client SKUs",
      "Description", "QTY", "Taxable Value", "Total Tax", "Invoice Total"],
    sortNum(out, "Invoice Total", false),
  );
}

export function annexure3(rawSales: Frame, einv: Frame): Frame {
  const salesSet = uniqueStrings(rawSales.rows, "Invoice No");
  const out: Row[] = [];
  for (const r of einv.rows) {
    const inv = s(r["E-Invoice No"]);
    if (salesSet.has(inv)) continue;
    out.push({
      Remark: "Not Found in Sales Data",
      "Invoice No": inv,
      "Invoice Value": num0(r["E-Invoice Amount"]),
      IRN: r["IRN"] ?? "",
      "Invoice date": r["Invoice date"] ?? "",
      "GSTIN/UIN of Recipient": r["GSTIN/UIN of Recipient"] ?? "",
      "Receiver Name": r["Receiver Name"] ?? "",
    });
  }
  return frame(
    ["Remark", "Invoice No", "Invoice Value", "IRN", "Invoice date", "GSTIN/UIN of Recipient", "Receiver Name"],
    sortNum(out, "Invoice Value", false),
  );
}

// ===========================================================================
// Annexures 4-7 : E-way Bill
// ===========================================================================

export function annexure4(salesOrig: Frame, eway: Frame | null): Frame {
  // Amount = SUM of the 'Sum of Total' line-item column across all rows of the
  // same InvoiceNo (mirrors annexure_4 in app/annexures/eway_bill.py — NOT the
  // repeated 'OrderAmount' value). Missing column => 0, matching pandas .get(..., 0).
  const cAmt = pickCol(salesOrig.columns, ["Sum of Total"]);
  const groups = groupBy(salesOrig.rows, (r) => s(r["InvoiceNo"]));
  const hv: Array<{ inv: string; row: Row; amt: number }> = [];
  for (const [inv, rows] of groups) {
    let amt = 0;
    for (const r of rows) amt += num0(gv(r, cAmt, 0));
    if (amt >= 50000) hv.push({ inv, row: rows[0], amt });
  }
  if (hv.length === 0) return EMPTY;

  let missing: typeof hv;
  if (eway && eway.rows.length) {
    const docs = new Set([...eway.rows].map((r) => s(r["Doc.No"])));
    missing = hv.filter((h) => !docs.has(s(h.inv)));
  } else {
    missing = hv.filter((h) => {
      const ew = s(h.row["E-way bill number"]).toLowerCase();
      return ew === "" || ew === "nan";
    });
  }
  if (missing.length === 0) return EMPTY;

  const out = missing.map((h) => ({
    Remark: "E-way Bill Not Found",
    "Invoice No": h.row["InvoiceNo"] ?? "",
    "Date of Invoice": h.row["DateofInvoice"] ?? "",
    "Order Channel": h.row["Order Channel"] ?? "",
    "Order No": h.row["ExternalOrderNo"] ?? "",
    "Billing Name of Customer": h.row["Billing Name of Customer"] ?? "",
    State: h.row["State"] ?? "",
    "GST No": h.row["GST No"] ?? "",
    "E-way Bill in Sales": h.row["E-way bill number"] ?? "",
    "Order Amount": round2(h.amt),
  }));
  return frame(
    ["Remark", "Invoice No", "Date of Invoice", "Order Channel", "Order No",
      "Billing Name of Customer", "State", "GST No", "E-way Bill in Sales", "Order Amount"],
    sortNum(out, "Order Amount", false),
  );
}

export function annexure5(einv: Frame, eway: Frame | null): Frame {
  if (!eway || eway.rows.length === 0) return EMPTY;
  const docs = new Set(eway.rows.map((r) => s(r["Doc.No"])));
  const out: Row[] = [];
  for (const r of einv.rows) {
    if (num0(r["E-Invoice Amount"]) < 50000) continue;
    if (docs.has(s(r["E-Invoice No"]))) continue;
    out.push({
      Remark: "E-way Bill Not Found",
      "Invoice No": r["E-Invoice No"] ?? "",
      "Invoice Date": r["Invoice date"] ?? "",
      "GSTIN of Recipient": r["GSTIN/UIN of Recipient"] ?? "",
      "Receiver Name": r["Receiver Name"] ?? "",
      "Invoice Value": round2(num0(r["E-Invoice Amount"])),
      IRN: r["IRN"] ?? "",
    });
  }
  return frame(
    ["Remark", "Invoice No", "Invoice Date", "GSTIN of Recipient", "Receiver Name", "Invoice Value", "IRN"],
    sortNum(out, "Invoice Value", false),
  );
}

export function annexure6(salesOrig: Frame, eway: Frame | null): Frame {
  if (!eway || eway.rows.length === 0) return EMPTY;
  const salesInv = new Set(
    salesOrig.rows.map((r) => s(r["InvoiceNo"])).filter((v) => v !== "" && v.toLowerCase() !== "nan"),
  );
  const out: Row[] = [];
  for (const r of eway.rows) {
    const doc = s(r["Doc.No"]);
    if (salesInv.has(doc)) continue;
    out.push({ Remark: "Not Found in Sales", ...r, "Doc.No_str": doc });
  }
  const columns = ["Remark", ...eway.columns, "Doc.No_str"];
  return frame(columns, sortStr(out, "Doc.No"));
}

export function annexure7(einv: Frame, eway: Frame | null): Frame {
  if (!eway || eway.rows.length === 0) return EMPTY;
  const einvSet = uniqueStrings(einv.rows, "E-Invoice No");
  const hasGstCol = eway.columns.includes("Other Party GSTIN");
  const out: Row[] = [];
  for (const r of eway.rows) {
    if (hasGstCol && !isValidGst(r["Other Party GSTIN"])) continue;
    const doc = s(r["Doc.No"]);
    if (doc === "" || doc.toLowerCase() === "nan") continue;
    if (einvSet.has(doc)) continue;
    out.push({ Remark: "Not Found in E-Invoice", ...r, "Doc.No_str": doc });
  }
  const columns = ["Remark", ...eway.columns, "Doc.No_str"];
  return frame(columns, sortStr(out, "Doc.No_str"));
}

// ===========================================================================
// Annexures 8-11 : Sales-only checks (operate on the ORIGINAL sales sheet)
// ===========================================================================

const SALES_OUT_COLS = (extra: Record<string, string>) => extra; // doc only

export function annexure8(salesOrig: Frame): Frame {
  const cSku = pickCol(salesOrig.columns, ["ClientSKU", "ClientSku"]);
  const cAmt = pickCol(salesOrig.columns, ["OrderAmount", "orderAmount"]);
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of salesOrig.rows) {
    const sku = s(gv(r, cSku, "")).toUpperCase();
    if (!sku.startsWith("TES")) continue;
    const einvVal = s(r["E-invoice No.(IRN)"]).replace(/^nan$/i, "");
    const ewayVal = s(r["E-way bill number"]).replace(/^nan$/i, "");
    if (einvVal === "" && ewayVal === "") continue;
    const inv = s(r["InvoiceNo"]);
    if (seen.has(inv)) continue;
    seen.add(inv);
    out.push({
      Remark: "TES SKU with E-Invoice/E-way Bill",
      "Invoice No": r["InvoiceNo"] ?? "",
      "Date of Invoice": r["DateofInvoice"] ?? "",
      "Order Channel": r["Order Channel"] ?? "",
      "Order No": r["ExternalOrderNo"] ?? "",
      "Billing Name": r["Billing Name of Customer"] ?? "",
      State: r["State"] ?? "",
      "Client SKU": gv(r, cSku, ""),
      Description: r["DescriptionofGoods"] ?? "",
      "GST No": r["GST No"] ?? "",
      "E-Invoice No": r["E-invoice No.(IRN)"] ?? "",
      "E-way Bill No": r["E-way bill number"] ?? "",
      "Order Amount": round2(num0(gv(r, cAmt, 0))),
    });
  }
  return frame(
    ["Remark", "Invoice No", "Date of Invoice", "Order Channel", "Order No",
      "Billing Name", "State", "Client SKU", "Description", "GST No",
      "E-Invoice No", "E-way Bill No", "Order Amount"],
    sortNum(out, "Order Amount", false),
  );
}

export function annexure9(salesOrig: Frame): Frame {
  const cAmt = pickCol(salesOrig.columns, ["OrderAmount"]);
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of salesOrig.rows) {
    if (s(r["Order Channel"]).toLowerCase() !== "administration") continue;
    const inv = s(r["InvoiceNo"]);
    if (seen.has(inv)) continue;
    seen.add(inv);
    out.push({
      Remark: "Administration Order",
      "Invoice No": r["InvoiceNo"] ?? "",
      "Date of Invoice": r["DateofInvoice"] ?? "",
      "Order Channel": r["Order Channel"] ?? "",
      "Order No": r["ExternalOrderNo"] ?? "",
      "Billing Name": r["Billing Name of Customer"] ?? "",
      State: r["State"] ?? "",
      "Client SKU": r["ClientSKU"] ?? "",
      Description: r["DescriptionofGoods"] ?? "",
      "GST No": r["GST No"] ?? "",
      "E-Invoice No": r["E-invoice No.(IRN)"] ?? "",
      "E-way Bill No": r["E-way bill number"] ?? "",
      "Order Amount": round2(num0(gv(r, cAmt, 0))),
    });
  }
  return frame(
    ["Remark", "Invoice No", "Date of Invoice", "Order Channel", "Order No",
      "Billing Name", "State", "Client SKU", "Description", "GST No",
      "E-Invoice No", "E-way Bill No", "Order Amount"],
    sortNum(out, "Order Amount", false),
  );
}

export function annexure10(salesOrig: Frame): Frame {
  const out: Row[] = [];
  for (const r of salesOrig.rows) {
    const sp = num0(r["Selling Price"]);
    const disc = num0(r["Discount on item"]);
    const pct = sp > 0 ? (disc / sp) * 100 : 0;
    if (pct < 90) continue;
    out.push({
      Remark: "Discount >= 90%",
      "Invoice No": r["InvoiceNo"] ?? "",
      "Date of Invoice": r["DateofInvoice"] ?? "",
      "Order Channel": r["Order Channel"] ?? "",
      "Order No": r["ExternalOrderNo"] ?? "",
      "Billing Name": r["Billing Name of Customer"] ?? "",
      State: r["State"] ?? "",
      "Client SKU": r["ClientSKU"] ?? "",
      Description: r["DescriptionofGoods"] ?? "",
      QTY: num(r["QTY"]),
      "Selling Price": round2(sp),
      "Discount on Item": round2(disc),
      "Discount %": round2(pct),
      "GST No": r["GST No"] ?? "",
    });
  }
  return frame(
    ["Remark", "Invoice No", "Date of Invoice", "Order Channel", "Order No",
      "Billing Name", "State", "Client SKU", "Description", "QTY",
      "Selling Price", "Discount on Item", "Discount %", "GST No"],
    sortNum(out, "Discount %", false),
  );
}

export function annexure11(salesOrig: Frame): Frame {
  const cAmt = pickCol(salesOrig.columns, ["OrderAmount", "orderAmount"]);
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of salesOrig.rows) {
    if (num0(gv(r, cAmt, 0)) !== 0) continue;
    const inv = s(r["InvoiceNo"]);
    if (seen.has(inv)) continue;
    seen.add(inv);
    out.push({
      Remark: "Zero Order Amount",
      "Invoice No": r["InvoiceNo"] ?? "",
      "Date of Invoice": r["DateofInvoice"] ?? "",
      "Order Channel": r["Order Channel"] ?? "",
      "Order No": r["ExternalOrderNo"] ?? "",
      "Billing Name": r["Billing Name of Customer"] ?? "",
      State: r["State"] ?? "",
      "Client SKU": r["ClientSKU"] ?? "",
      Description: r["DescriptionofGoods"] ?? "",
      "GST No": r["GST No"] ?? "",
      "E-Invoice No": r["E-invoice No.(IRN)"] ?? "",
      "E-way Bill No": r["E-way bill number"] ?? "",
      "Order Amount": 0,
    });
  }
  return frame(
    ["Remark", "Invoice No", "Date of Invoice", "Order Channel", "Order No",
      "Billing Name", "State", "Client SKU", "Description", "GST No",
      "E-Invoice No", "E-way Bill No", "Order Amount"],
    sortStr(out, "Invoice No"),
  );
}

// ===========================================================================
// Annexures 12-17 : Credit Note / CDNR
// ===========================================================================

const CN_KEYS = ["return no", "credit note", "note no"];

function cnReturnCol(cols: string[]): string | null {
  return findCol(cols, CN_KEYS);
}

function noteValueCol(cols: string[]): string | null {
  if (cols.includes("Note Value")) return "Note Value";
  if (cols.includes("Note value")) return "Note value";
  return null;
}

export function annexure12(cdnr: Frame | null, cn: Frame | null): Frame {
  if (!cdnr || !cdnr.rows.length || !cn || !cn.rows.length) return EMPTY;
  const cnCol = cnReturnCol(cn.columns);
  if (!cnCol) return EMPTY;
  const cnReturns = uniqueStrings(cn.rows, cnCol);
  const cdnrNotes = uniqueStrings(cdnr.rows, "Note Number");
  const missing = new Set([...cdnrNotes].filter((n) => !cnReturns.has(n)));
  if (missing.size === 0) return EMPTY;

  const nv = noteValueCol(cdnr.columns);
  const out: Row[] = [];
  for (const r of cdnr.rows) {
    if (!missing.has(s(r["Note Number"]))) continue;
    const row: Row = {
      Remark: "Not Found in Credit Note",
      "Note Number": r["Note Number"] ?? "",
      "Note Date": r["Note Date"] ?? "",
      "Note Type": r["Note Type"] ?? "",
      "GSTIN of Recipient": r["GSTIN/UIN of Recipient"] ?? "",
      "Receiver Name": r["Receiver Name"] ?? "",
    };
    if (nv) row["Note Value"] = num(r[nv]);
    out.push(row);
  }
  const cols = ["Remark", "Note Number", "Note Date", "Note Type", "GSTIN of Recipient", "Receiver Name"];
  if (nv) cols.push("Note Value");
  return frame(cols, sortStr(out, "Note Number"));
}

export function annexure13(cdnr: Frame | null, cn: Frame | null): Frame {
  if (!cdnr || !cdnr.rows.length || !cn || !cn.rows.length) return EMPTY;
  const withGst = cn.rows.filter((r) => isValidGst(r["GST No"]));
  if (withGst.length === 0) return EMPTY;
  const cnCol = cnReturnCol(cn.columns);
  if (!cnCol) return EMPTY;
  const cdnrNotes = uniqueStrings(cdnr.rows, "Note Number");
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of withGst) {
    const ret = s(r[cnCol]);
    if (cdnrNotes.has(ret)) continue;
    if (seen.has(ret)) continue;                          // drop_duplicates(cn_col)
    seen.add(ret);
    out.push({
      Remark: "Not Found in E-Invoice CDNR",
      "Return No": r["Return No"] ?? r[cnCol] ?? "",
      "Return Date": r["Return Date"] ?? "",
      "Invoice No": r["InvoiceNo"] ?? "",
      "Date of Invoice": r["Date of Invoice"] ?? "",
      "Order Channel": r["Order Channel"] ?? "",
      "Name of Customer": r["Name of Customer"] ?? "",
      State: r["State"] ?? "",
      "GST No": r["GST No"] ?? "",
      "Return Amount": round2(num0(r["Return Amount"])),
    });
  }
  return frame(
    ["Remark", "Return No", "Return Date", "Invoice No", "Date of Invoice",
      "Order Channel", "Name of Customer", "State", "GST No", "Return Amount"],
    sortNum(out, "Return Amount", false),
  );
}

export function annexure14(cn: Frame | null, ewayInward: Frame | null): Frame {
  if (!cn || !cn.rows.length || !ewayInward || !ewayInward.rows.length) return EMPTY;
  const cnCol = cnReturnCol(cn.columns);
  if (!cnCol) return EMPTY;
  const ewayDocs = new Set(
    ewayInward.rows.map((r) => s(r["Doc.No"])).filter((v) => v !== "" && v.toLowerCase() !== "nan"),
  );
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of cn.rows) {
    const amt = num0(r["Return Amount"]);
    if (amt < 50000) continue;
    const ret = s(r[cnCol]);
    if (ewayDocs.has(ret)) continue;
    if (seen.has(ret)) continue;
    seen.add(ret);
    out.push({
      Remark: "E-way Bill Not Found",
      "Return No": r["Return No"] ?? r[cnCol] ?? "",
      "Return Date": r["Return Date"] ?? "",
      "Invoice No": r["InvoiceNo"] ?? "",
      "Date of Invoice": r["Date of Invoice"] ?? "",
      "Order Channel": r["Order Channel"] ?? "",
      "Name of Customer": r["Name of Customer"] ?? "",
      State: r["State"] ?? "",
      "GST No": r["GST No"] ?? "",
      "Return Amount": round2(amt),
    });
  }
  return frame(
    ["Remark", "Return No", "Return Date", "Invoice No", "Date of Invoice",
      "Order Channel", "Name of Customer", "State", "GST No", "Return Amount"],
    sortNum(out, "Return Amount", false),
  );
}

export function annexure15(cdnr: Frame | null, ewayInward: Frame | null): Frame {
  if (!cdnr || !cdnr.rows.length || !ewayInward || !ewayInward.rows.length) return EMPTY;
  const nv = noteValueCol(cdnr.columns);
  if (!nv) return EMPTY;
  const ewayDocs = new Set(
    ewayInward.rows.map((r) => s(r["Doc.No"])).filter((v) => v !== "" && v.toLowerCase() !== "nan"),
  );
  const out: Row[] = [];
  for (const r of cdnr.rows) {
    const v = num0(r[nv]);
    if (v < 50000) continue;
    if (ewayDocs.has(s(r["Note Number"]))) continue;
    out.push({
      Remark: "E-way Bill Not Found",
      "Note Number": r["Note Number"] ?? "",
      "Note Date": r["Note Date"] ?? "",
      "Note Type": r["Note Type"] ?? "",
      "GSTIN of Recipient": r["GSTIN/UIN of Recipient"] ?? "",
      "Receiver Name": r["Receiver Name"] ?? "",
      "Note Value": round2(v),
    });
  }
  return frame(
    ["Remark", "Note Number", "Note Date", "Note Type", "GSTIN of Recipient", "Receiver Name", "Note Value"],
    sortNum(out, "Note Value", false),
  );
}

export function annexure16(cn: Frame | null, ewayInward: Frame | null): Frame {
  if (!cn || !cn.rows.length || !ewayInward || !ewayInward.rows.length) return EMPTY;
  const cnCol = cnReturnCol(cn.columns);
  if (!cnCol) return EMPTY;
  const cnReturns = uniqueStrings(cn.rows, cnCol);
  const out: Row[] = [];
  for (const r of ewayInward.rows) {
    const doc = s(r["Doc.No"]);
    if (doc === "" || doc.toLowerCase() === "nan") continue;
    if (cnReturns.has(doc)) continue;
    out.push({ Remark: "Not Found in Credit Note", ...r, "Doc.No_str": doc });
  }
  const columns = ["Remark", ...ewayInward.columns, "Doc.No_str"];
  return frame(columns, sortStr(out, "Doc.No_str"));
}

export function annexure17(cdnr: Frame | null, cn: Frame | null): Frame {
  if (!cdnr || !cdnr.rows.length || !cn || !cn.rows.length) return EMPTY;
  const nv = noteValueCol(cdnr.columns);
  if (!nv) return EMPTY;
  const cnCol = cnReturnCol(cn.columns);
  const amtCol = findCol(cn.columns, ["return amount", "credit amount"]);
  if (!cnCol || !amtCol) return EMPTY;

  const hasNoteType = cdnr.columns.includes("Note Type");
  const hasReturnDate = cn.columns.includes("Return Date");
  const hasOrderChannel = cn.columns.includes("Order Channel");
  const hasCustomer = cn.columns.includes("Name of Customer");

  // group cdnr by note
  const cdnrGroups = groupBy(cdnr.rows, (r) => s(r["Note Number"]));
  const cdnrAgg = new Map<string, Row>();
  for (const [note, rows] of cdnrGroups) {
    const f = rows[0];
    cdnrAgg.set(note, {
      "Note Number": f["Note Number"] ?? "",
      "Note Date": f["Note Date"] ?? "",
      _nv: round2(rows.reduce((a, r) => a + num0(r[nv]), 0)),
      "GSTIN/UIN of Recipient": f["GSTIN/UIN of Recipient"] ?? "",
      "Receiver Name": f["Receiver Name"] ?? "",
      ...(hasNoteType ? { "Note Type": f["Note Type"] ?? "" } : {}),
    });
  }

  // group cn by return
  const cnGroups = groupBy(cn.rows, (r) => s(r[cnCol]));
  const cnAgg = new Map<string, Row>();
  for (const [ret, rows] of cnGroups) {
    const f = rows[0];
    cnAgg.set(ret, {
      [cnCol]: f[cnCol] ?? "",
      _amt: round2(rows.reduce((a, r) => a + num0(r[amtCol]), 0)),
      ...(hasReturnDate ? { "Return Date": f["Return Date"] ?? "" } : {}),
      ...(hasOrderChannel ? { "Order Channel": f["Order Channel"] ?? "" } : {}),
      ...(hasCustomer ? { "Name of Customer": f["Name of Customer"] ?? "" } : {}),
    });
  }

  const out: Row[] = [];
  for (const [note, c] of cdnrAgg) {
    const p = cnAgg.get(note);
    if (!p) continue;                                     // merge inner
    const diff = round2(num0(c._nv) - num0(p._amt));
    if (Math.abs(diff) <= 0.01) continue;
    const row: Row = {
      Remark: "Value Mismatch",
      "Note Number": c["Note Number"] ?? "",
      "Note Date": c["Note Date"] ?? "",
    };
    if (hasNoteType) row["Note Type"] = c["Note Type"] ?? "";
    row["GSTIN of Recipient"] = c["GSTIN/UIN of Recipient"] ?? "";
    row["Receiver Name"] = c["Receiver Name"] ?? "";
    row["CDNR Note Value"] = round2(num0(c._nv));
    row[""] = "";
    row["Return No"] = p[cnCol] ?? "";
    if (hasReturnDate) row["Return Date"] = p["Return Date"] ?? "";
    if (hasOrderChannel) row["Order Channel"] = p["Order Channel"] ?? "";
    if (hasCustomer) row["Customer Name"] = p["Name of Customer"] ?? "";
    row["Credit Note Amount"] = round2(num0(p._amt));
    row["Difference"] = diff;
    out.push(row);
  }

  const cols = ["Remark", "Note Number", "Note Date"];
  if (hasNoteType) cols.push("Note Type");
  cols.push("GSTIN of Recipient", "Receiver Name", "CDNR Note Value", "", "Return No");
  if (hasReturnDate) cols.push("Return Date");
  if (hasOrderChannel) cols.push("Order Channel");
  if (hasCustomer) cols.push("Customer Name");
  cols.push("Credit Note Amount", "Difference");
  return frame(cols, sortAbs(out, "Difference"));
}

void SALES_OUT_COLS;
