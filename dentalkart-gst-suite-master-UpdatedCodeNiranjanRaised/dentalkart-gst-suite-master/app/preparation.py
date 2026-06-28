import numpy as np
import pandas as pd
from app.helpers import is_valid_gst, is_valid_gst_vectorized, get_invoice_place
from app.config import INVOICE_PLACE_MAPPING


def prepare_raw_sales_sheet(sales_df):
    """Prepare raw sales sheet - FILTERS FOR VALID GST ONLY (B2B)"""
    # Vectorized GST filter (was: .apply(is_valid_gst) - row by row)
    sales_df = sales_df[is_valid_gst_vectorized(sales_df['GST No'])]

    inv_no_str = sales_df['InvoiceNo'].astype(str).str.strip()
    inv_prefixes = inv_no_str.str[:3].str.upper()

    # Batch all numeric conversions at once using a dict
    num_cols = {
        'QTY': sales_df.get('QTY', 0),
        'Unit Price': sales_df.get('Unit Price', 0),
        'TaxPercent': sales_df.get('TaxPercent', 0),
        'Taxable Value': sales_df.get('Taxable Value', sales_df.get('TaxableAmount', 0)),
        'CGST': sales_df.get('CGSTAmount', 0),
        'SGST': sales_df.get('SGSTAmount', 0),
        'IGST': sales_df.get('IGSTAmount', 0),
        'Total Tax': sales_df.get('TaxAmount', 0),
        'Selling Price': sales_df.get('Selling Price', 0),
        'Discount': sales_df.get('Discount on item', 0),
    }
    numeric_data = {}
    for col_name, col_data in num_cols.items():
        numeric_data[col_name] = pd.to_numeric(col_data, errors='coerce').fillna(0)

    raw = pd.DataFrame({
        'Invoice No': inv_no_str,
        'Invoice Place': inv_prefixes.map(INVOICE_PLACE_MAPPING).fillna('Unknown'),
        'Invoice Date': sales_df.get('DateofInvoice', sales_df.get('Date of Invoice', '')),
        'Order No': sales_df.get('ExternalOrderNo', sales_df.get('External Order No', '')),
        'Channel': sales_df.get('Order Channel', ''),
        'Billing Name of Customer': sales_df.get('Billing Name of Customer', sales_df.get('Name of Customer', '')),
        'State': sales_df.get('State', ''),
        'Client SKU': sales_df.get('ClientSKU', sales_df.get('ClientSku', '')),
        'Description of Goods': sales_df.get('DescriptionofGoods', sales_df.get('DescriptionOfGoods', '')),
        'HSN Code': sales_df.get('HSN Code', ''),
        'GST No': sales_df.get('GST No', ''),
        'E-invoice No.(IRN)': sales_df.get('E-invoice No.(IRN)', ''),
        'E-way bill number': sales_df.get('E-way bill number', ''),
        **numeric_data,
    })

    raw['Total'] = (raw['Taxable Value'] + raw['Total Tax']).round(2)
    raw['Invoice Total'] = raw.groupby('Invoice No')['Total'].transform('sum')
    return raw


def prepare_einvoice_data(einv_df):
    """Prepare E-Invoice data - filters for valid GST, deduplicates by Invoice Number"""
    gstin_col = None
    for c in einv_df.columns:
        if any(kw in str(c).lower() for kw in ['gstin/uin', 'gstin of recipient', 'recipient gstin']):
            gstin_col = c
            break
    if gstin_col:
        # Vectorized GST filter
        einv_df = einv_df[is_valid_gst_vectorized(einv_df[gstin_col])]

    col_lower = {c: str(c).lower().strip() for c in einv_df.columns}
    def find_col(keywords):
        for col, lc in col_lower.items():
            if any(kw in lc for kw in keywords):
                return col
        return None

    inv_no_col  = find_col(['invoice number', 'invoice no', 'doc no'])
    inv_val_col = find_col(['invoice value', 'inv value', 'total value'])
    irn_col     = find_col(['irn'])
    date_col    = find_col(['invoice date', 'inv date', 'doc date'])
    gstin_col2  = find_col(['gstin/uin', 'gstin of recipient', 'recipient gstin'])
    name_col    = find_col(['receiver name', 'trade name', 'legal name', 'party name'])

    if not inv_no_col:
        raise ValueError(f"Cannot find Invoice Number column. Available: {list(einv_df.columns)[:15]}")
    if not inv_val_col:
        raise ValueError(f"Cannot find Invoice Value column. Available: {list(einv_df.columns)[:15]}")

    einv_u = einv_df.drop_duplicates(subset=[inv_no_col], keep='first')
    out = pd.DataFrame()
    out['E-Invoice No']     = einv_u[inv_no_col].astype(str).str.strip()
    out['E-Invoice Amount'] = pd.to_numeric(einv_u[inv_val_col], errors='coerce').fillna(0)
    out['IRN']              = einv_u[irn_col].astype(str).str.strip() if irn_col else ''
    out['Invoice date']     = einv_u[date_col] if date_col else ''
    out['GSTIN/UIN of Recipient'] = einv_u[gstin_col2].astype(str).str.strip() if gstin_col2 else ''
    out['Receiver Name']    = einv_u[name_col].astype(str).str.strip() if name_col else ''
    return out


def prepare_eway_data(eway_df):
    """Normalize E-way Bill columns."""
    col_lower = {str(c).lower().strip(): c for c in eway_df.columns}
    def find_col(keywords):
        for lc, orig in col_lower.items():
            if any(kw in lc for kw in keywords):
                return orig
        return None
    doc_col = find_col(['doc.no', 'doc no', 'invoice no', 'inv no'])
    gstin_col = find_col(['other party gstin', 'to gstn', 'from gstn', 'party gstin'])
    if doc_col and doc_col != 'Doc.No':
        eway_df = eway_df.rename(columns={doc_col: 'Doc.No'})
    if gstin_col and gstin_col != 'Other Party GSTIN':
        eway_df = eway_df.rename(columns={gstin_col: 'Other Party GSTIN'})
    if 'Doc.No' not in eway_df.columns:
        raise ValueError(f"Cannot find Doc/Invoice No column in E-way Bill. Available: {list(eway_df.columns)[:15]}")
    eway_df['Doc.No'] = eway_df['Doc.No'].astype(str).str.strip()
    return eway_df
