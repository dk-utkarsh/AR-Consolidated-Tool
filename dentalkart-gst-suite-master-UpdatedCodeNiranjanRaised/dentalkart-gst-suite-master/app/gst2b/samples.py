"""Sample file generators for GST 2B Reconciliation."""
import io
import openpyxl
from app.gst2b.helpers import format_header, auto_col_width


def generate_sample_gstr2b():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "GSTR-2B"
    headers = ['GSTIN of Supplier', 'Trade/Legal Name', 'Invoice Number', 'Invoice Date', 'Taxable Value', 'Integrated Tax', 'Central Tax', 'State/UT Tax']
    ws.append(headers)
    format_header(ws, 1, '1F4E79')
    sample_rows = [
        ['07AAACR1718R1ZP', 'Sample Supplier Pvt Ltd', 'INV-001', '15-01-2026', 50000, 9000, 0, 0],
        ['09BBACS2345S1ZQ', 'Another Vendor Ltd', 'BILL/2026/102', '20-01-2026', 25000, 0, 2250, 2250],
        ['27CCCBT9876T1ZR', 'Third Party Enterprises', 'SI-2026-0055', '25-01-2026', 100000, 18000, 0, 0],
    ]
    for row in sample_rows:
        ws.append(row)
    auto_col_width(ws)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()


def generate_sample_purchase():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Purchase Register"
    headers = ['GST Identification Number (GSTIN)', 'Vendor Name', 'Bill Number', 'Branch Name', 'Taxable', 'IGST', 'CGST', 'SGST']
    ws.append(headers)
    format_header(ws, 1, '1F4E79')
    sample_rows = [
        ['07AAACR1718R1ZP', 'Sample Supplier Pvt Ltd', 'INV-001', 'Delhi', 50000, 9000, 0, 0],
        ['09BBACS2345S1ZQ', 'Another Vendor Ltd', 'BILL/2026/102', 'Mumbai', 25000, 0, 2250, 2250],
        ['27CCCBT9876T1ZR', 'Third Party Enterprises', 'SI-2026-0055', 'Pune', 100000, 18000, 0, 0],
    ]
    for row in sample_rows:
        ws.append(row)
    auto_col_width(ws)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()
