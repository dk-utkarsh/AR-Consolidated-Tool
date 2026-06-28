import os

OUTPUT_DIR = os.environ.get('GST_OUTPUT_DIR', '/tmp/gst_reco_outputs')
os.makedirs(OUTPUT_DIR, exist_ok=True)

_2B_COLUMN_MAP = {
    'GSTIN': ['gstin of supplier', 'gstin', 'gst no', 'supplier gstin'],
    'Party_Name': ['trade/legal name', 'trade name', 'legal name', 'party name', 'supplier name'],
    'Invoice_No': ['invoice number', 'invoice no', 'inv no', 'doc no', 'document number'],
    'Invoice_Date': ['invoice date', 'inv date', 'date'],
    'Taxable_Amount': ['taxable value', 'taxable amount', 'taxable'],
    'IGST': ['integrated tax', 'igst'],
    'CGST': ['central tax', 'cgst'],
    'SGST': ['state/ut tax', 'state tax', 'sgst'],
}

PR_COLUMN_MAP = {
    'GSTIN': ['gst identification number (gstin)', 'gstin', 'gst no', 'supplier gstin', 'vendor gstin'],
    'Party_Name': ['vendor name', 'party name', 'supplier name', 'trade name'],
    'Invoice_No': ['bill number', 'invoice number', 'invoice no', 'inv no', 'voucher no'],
    'Branch_Name': ['branch name', 'branch', 'location'],
    'Taxable_Amount': ['taxable', 'taxable value', 'taxable amount', 'base amount'],
    'IGST': ['igst', 'integrated tax'],
    'CGST': ['cgst', 'central tax'],
    'SGST': ['sgst', 'state tax', 'state/ut tax'],
}
