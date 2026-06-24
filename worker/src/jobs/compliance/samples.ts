// ComplianceGuard — sample file generators. Port of app/samples.py.
import ExcelJS from "exceljs";

type CellVal = string | number | null;

async function buildWorkbook(
  sheetName: string,
  headers: string[],
  sampleRow: CellVal[],
  blankRowsBefore = 0,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  for (let i = 0; i < blankRowsBefore; i++) ws.addRow([]);
  const header = ws.addRow(headers);
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    c.font = { color: { argb: "FFFFFFFF" }, bold: true };
  });
  ws.addRow(sampleRow);
  ws.columns.forEach((col) => { col.width = 20; });
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export const SAMPLE_KINDS = ["sales", "einvoice", "ewaybill", "creditnote", "cn-einvoice"] as const;
export type SampleKind = (typeof SAMPLE_KINDS)[number];

export const SAMPLE_FILENAMES: Record<SampleKind, string> = {
  sales: "Sample_Sales_Data.xlsx",
  einvoice: "Sample_EInvoice.xlsx",
  ewaybill: "Sample_EwayBill.xlsx",
  creditnote: "Sample_CreditNote.xlsx",
  "cn-einvoice": "Sample_CN_EInvoice.xlsx",
};

export async function generateSample(kind: SampleKind): Promise<Buffer> {
  switch (kind) {
    case "sales":
      return buildWorkbook("Sales Data", [
        "InvoiceNo", "DateofInvoice", "ExternalOrderNo", "Order Channel",
        "Billing Name of Customer", "State", "ClientSKU", "DescriptionofGoods", "QTY", "HSN Code",
        "GST No", "E-invoice No.(IRN)", "E-way bill number", "Unit Price", "TaxPercent",
        "Taxable Value", "CGSTAmount", "SGSTAmount", "IGSTAmount", "TaxAmount", "OrderAmount",
        "Selling Price", "Discount on item",
      ], [
        "DK-INV-001", "15-01-2026", "ORD-1001", "WhatsApp", "Sample Customer", "Delhi",
        "SKU001", "Dental Mirror", 10, "90184990", "07AAACR1718R1ZP", "IRN123456",
        "EWB789012", 500, 18, 5000, 450, 450, 0, 900, 5900, 590, 0,
      ]);
    case "einvoice":
      return buildWorkbook("b2b,sez,de", [
        "Invoice Number", "Invoice Value", "IRN", "Invoice date", "GSTIN/UIN of Recipient", "Receiver Name",
      ], ["DK-INV-001", 5900, "IRN123456", "15-01-2026", "07AAACR1718R1ZP", "Sample Customer"]);
    case "ewaybill":
      return buildWorkbook("Outward Supply", [
        "Doc.No", "Doc.Date", "EWB No", "EWB Date", "Branch", "Supply Type",
        "Other Party GSTIN", "TO GSTIN Info", "Total Invoice Value", "status",
      ], [
        "DK-INV-001", "15-01-2026", "EWB789012", "15-01-2026", "Delhi",
        "Outward", "07AAACR1718R1ZP", "", 5900, "Active",
      ], 1);
    case "creditnote":
      return buildWorkbook("Credit Notes", [
        "Return No", "Return Date", "InvoiceNo", "Date of Invoice", "Order Channel",
        "Name of Customer", "State", "GST No", "Return Amount",
      ], ["RET-001", "20-01-2026", "DK-INV-001", "15-01-2026", "WhatsApp", "Sample Customer", "Delhi", "07AAACR1718R1ZP", 2950]);
    case "cn-einvoice":
      return buildWorkbook("b2b-cr", [
        "Unit", "GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date",
        "Note Type", "Place of Supply", "Reverse Charge", "Note Supply Type", "Note value",
        "Applicable % of Tax Rate", "Rate", "Taxable Value", "Integrated Tax",
        "Central Tax", "State/UT Tax", "Cess Amount", "IRN", "IRN date", "E-invoice status",
      ], [
        "VIK", "27AAACR1718R1ZP", "Sample Customer", "CN-001", "15-01-2026", "C",
        "07 - Delhi", "N", "Regular B2B", 5900, null, 18, 5000, 0, 450, 450, 0,
        "IRN_CN_001", "15-01-2026", "Valid",
      ], 2);
  }
}
