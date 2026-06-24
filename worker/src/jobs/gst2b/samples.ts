// GST 2B sample files. Port of app/gst2b/samples.py.
import ExcelJS from "exceljs";

type CellVal = string | number;

async function build(sheetName: string, headers: string[], rows: CellVal[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  const header = ws.addRow(headers);
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    c.font = { color: { argb: "FFFFFFFF" }, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((col) => { col.width = 20; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const GST2B_SAMPLE_KINDS = ["gstr2b", "purchase"] as const;
export type Gst2bSampleKind = (typeof GST2B_SAMPLE_KINDS)[number];

export const GST2B_SAMPLE_FILENAMES: Record<Gst2bSampleKind, string> = {
  gstr2b: "Sample_GSTR2B.xlsx",
  purchase: "Sample_Purchase_Register.xlsx",
};

export async function generateGst2bSample(kind: Gst2bSampleKind): Promise<Buffer> {
  if (kind === "gstr2b") {
    return build("GSTR-2B",
      ["GSTIN of Supplier", "Trade/Legal Name", "Invoice Number", "Invoice Date", "Taxable Value", "Integrated Tax", "Central Tax", "State/UT Tax"],
      [
        ["07AAACR1718R1ZP", "Sample Supplier Pvt Ltd", "INV-001", "15-01-2026", 50000, 9000, 0, 0],
        ["09BBACS2345S1ZQ", "Another Vendor Ltd", "BILL/2026/102", "20-01-2026", 25000, 0, 2250, 2250],
        ["27CCCBT9876T1ZR", "Third Party Enterprises", "SI-2026-0055", "25-01-2026", 100000, 18000, 0, 0],
      ]);
  }
  return build("Purchase Register",
    ["GST Identification Number (GSTIN)", "Vendor Name", "Bill Number", "Branch Name", "Taxable", "IGST", "CGST", "SGST"],
    [
      ["07AAACR1718R1ZP", "Sample Supplier Pvt Ltd", "INV-001", "Delhi", 50000, 9000, 0, 0],
      ["09BBACS2345S1ZQ", "Another Vendor Ltd", "BILL/2026/102", "Mumbai", 25000, 0, 2250, 2250],
      ["27CCCBT9876T1ZR", "Third Party Enterprises", "SI-2026-0055", "Pune", 100000, 18000, 0, 0],
    ]);
}
