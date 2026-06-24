// "Prepare Data" — turn each raw GST export into its template shape and drop
// Cancelled/closed rows. Mappings + status columns are the ones established
// while preparing the Non-Complience files by hand.

export interface ColumnSpec {
  /** Template column name (output header). */
  template: string;
  /** Source column names to try (first match wins); null => leave blank. */
  from: string[] | null;
}

export interface PrepareSpec {
  kind: string;
  label: string;
  /** Candidate sheet names in the raw file (priority order). */
  sheetCandidates: string[];
  /** Output sheet name (matches the template). */
  outSheet: string;
  /** Blank rows above the header in the output (matches the template layout). */
  blankRowsBefore: number;
  /** Output file name. */
  outFilename: string;
  /** Source column names that hold the status to filter on (first match wins). */
  statusFrom: string[];
  /** Ordered template columns + their source mapping. */
  columns: ColumnSpec[];
}

// Values (lower-cased) that cause a row to be dropped.
export const DROP_STATUS = new Set(["cancelled", "cancel", "closed"]);

const same = (name: string): ColumnSpec => ({ template: name, from: [name] });
const blank = (name: string): ColumnSpec => ({ template: name, from: null });

export const SPECS: Record<string, PrepareSpec> = {
  sales: {
    kind: "sales",
    label: "Sales Data",
    sheetCandidates: ["Dentalkart Standard Sales GST", "Standard Sales GST", "Sales Data", "Sheet1"],
    outSheet: "Sales Data",
    blankRowsBefore: 0,
    outFilename: "Sales_Data_Prepared.xlsx",
    statusFrom: ["Status"],
    columns: [
      "InvoiceNo", "DateofInvoice", "ExternalOrderNo", "Order Channel",
      "Billing Name of Customer", "State", "ClientSKU", "DescriptionofGoods", "QTY",
      "HSN Code", "GST No", "E-invoice No.(IRN)", "E-way bill number", "Unit Price",
      "TaxPercent", "Taxable Value", "CGSTAmount", "SGSTAmount", "IGSTAmount",
      "TaxAmount", "OrderAmount", "Selling Price", "Discount on item",
    ].map(same),
  },

  einvoice: {
    kind: "einvoice",
    label: "E-Invoice",
    sheetCandidates: ["B2B", "b2b", "b2b,sez,de", "E-Invoice", "E-invoice", "Sheet1"],
    outSheet: "b2b,sez,de",
    blankRowsBefore: 0,
    outFilename: "E_Invoice_Prepared.xlsx",
    statusFrom: ["E-invoice status"],
    columns: [
      "Invoice Number", "Invoice Value", "IRN", "Invoice date",
      "GSTIN/UIN of Recipient", "Receiver Name",
    ].map(same),
  },

  creditnote: {
    kind: "creditnote",
    label: "Credit Note",
    sheetCandidates: ["Standard Sales Return GST", "Credit Notes", "Returns", "Sheet1"],
    outSheet: "Credit Notes",
    blankRowsBefore: 0,
    outFilename: "Credit_Note_Prepared.xlsx",
    statusFrom: ["Order Status"],
    columns: [
      "Return No", "Return Date", "InvoiceNo", "Date of Invoice", "Order Channel",
      "Name of Customer", "State", "GST No", "Return Amount",
    ].map(same),
  },

  cnEinvoice: {
    kind: "cnEinvoice",
    label: "CN E-Invoice (CDNR)",
    sheetCandidates: ["CDNR", "cdnr", "b2b-cr", "B2B-CR", "Sheet1"],
    outSheet: "b2b-cr",
    blankRowsBefore: 2,
    outFilename: "CN_E_Invoice_Prepared.xlsx",
    statusFrom: ["E-invoice status"],
    columns: [
      { template: "Unit", from: ["Unit", "Branch"] },
      same("GSTIN/UIN of Recipient"), same("Receiver Name"), same("Note Number"),
      same("Note Date"), same("Note Type"), same("Place of Supply"), same("Reverse Charge"),
      same("Note Supply Type"), same("Note value"), same("Applicable % of Tax Rate"),
      same("Rate"), same("Taxable Value"), same("Integrated Tax"), same("Central Tax"),
      same("State/UT Tax"), same("Cess Amount"), same("IRN"), same("IRN date"),
      same("E-invoice status"),
    ],
  },

  ewaybill: {
    kind: "ewaybill",
    label: "E-way Bill",
    sheetCandidates: ["Outward Supply", "Eway Bill Report", "EWay Bill Report", "E-way Bill", "Sheet1"],
    outSheet: "Outward Supply",
    blankRowsBefore: 1,
    outFilename: "E_way_Bill_Prepared.xlsx",
    statusFrom: [],                       // E-way bill: do NOT filter any rows

    columns: [
      { template: "Doc.No", from: ["Invoice No", "Doc Ref No"] },
      { template: "Doc.Date", from: ["Invoice Date"] },
      { template: "EWB No", from: ["EWB No"] },
      { template: "EWB Date", from: ["EWB Datetime", "Generated On"] },
      blank("Branch"),
      blank("Supply Type"),
      { template: "Other Party GSTIN", from: ["To GSTN", "To GSTIN"] },
      blank("TO GSTIN Info"),
      blank("Total Invoice Value"),
      { template: "status", from: ["EWB Delivery Status"] },
    ],
  },
};

export const PREPARE_KINDS = Object.keys(SPECS);
