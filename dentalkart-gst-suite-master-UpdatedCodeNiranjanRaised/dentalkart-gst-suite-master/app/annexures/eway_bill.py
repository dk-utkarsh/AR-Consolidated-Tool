"""Annexures 4-7: E-way Bill cross-checks"""
import pandas as pd
from app.helpers import is_valid_gst


def annexure_4(sales_df_orig, eway):
    """Annexure 4: Sales >= 50K missing E-way Bill.

    The qualifying amount ('Invoice Total' in the output) is the SUM of the
    'Sum of Total' column across all line-item rows of the same InvoiceNo -
    NOT the repeated whole-order 'OrderAmount' value. The >= 50,000 threshold
    is applied to this summed Invoice Total as well.
    """
    sales_df_orig['Sum of Total'] = pd.to_numeric(sales_df_orig.get('Sum of Total', 0), errors='coerce').fillna(0)
    sg = sales_df_orig.groupby('InvoiceNo').agg(
        InvoiceTotal=('Sum of Total', 'sum'),
        Date=('DateofInvoice', 'first'),
        Channel=('Order Channel', 'first'),
        OrderNo=('ExternalOrderNo', 'first'),
        Customer=('Billing Name of Customer', 'first'),
        State=('State', 'first'),
        GST=('GST No', 'first'),
        Eway=('E-way bill number', 'first'),
    ).reset_index()
    hv = sg[sg['InvoiceTotal'] >= 50000].copy()
    if hv.empty:
        return pd.DataFrame()

    if eway is not None and not eway.empty:
        eway_docs = set(eway['Doc.No'].astype(str).str.strip())
        hv['InvoiceNo_str'] = hv['InvoiceNo'].astype(str).str.strip()
        missing = hv[~hv['InvoiceNo_str'].isin(eway_docs)]
    else:
        ew = hv['Eway'].astype(str).str.strip()
        missing = hv[ew.isna() | ew.eq('') | ew.str.lower().eq('nan')]

    if missing.empty:
        return pd.DataFrame()
    out = pd.DataFrame()
    out['Remark'] = 'E-way Bill Not Found'
    out['Invoice No'] = missing['InvoiceNo'].values
    out['Date of Invoice'] = missing['Date'].values
    out['Order Channel'] = missing['Channel'].values
    out['Order No'] = missing['OrderNo'].values
    out['Billing Name of Customer'] = missing['Customer'].values
    out['State'] = missing['State'].values
    out['GST No'] = missing['GST'].values
    out['E-way Bill in Sales'] = missing['Eway'].values
    out['Invoice Total'] = missing['InvoiceTotal'].round(2).values
    return out.sort_values('Invoice Total', ascending=False)


def annexure_5(einv, eway):
    """Annexure 5: E-Invoices >= 50K missing E-way Bill"""
    if eway is None or eway.empty:
        return pd.DataFrame()
    hv = einv[einv['E-Invoice Amount'] >= 50000].copy()
    eway_docs = set(eway['Doc.No'].astype(str).str.strip())
    hv['Inv_str'] = hv['E-Invoice No'].astype(str).str.strip()
    missing = hv[~hv['Inv_str'].isin(eway_docs)]
    if missing.empty:
        return pd.DataFrame()
    out = pd.DataFrame()
    out['Remark'] = 'E-way Bill Not Found'
    out['Invoice No'] = missing['E-Invoice No'].values
    out['Invoice Date'] = missing['Invoice date'].values
    out['GSTIN of Recipient'] = missing['GSTIN/UIN of Recipient'].values
    out['Receiver Name'] = missing['Receiver Name'].values
    out['Invoice Value'] = missing['E-Invoice Amount'].round(2).values
    out['IRN'] = missing['IRN'].values
    return out.sort_values('Invoice Value', ascending=False)


def annexure_6(sales_df_orig, eway):
    """Annexure 6: E-way Bills missing in Sales"""
    if eway is None or eway.empty:
        return pd.DataFrame()
    sales_inv = set(sales_df_orig['InvoiceNo'].dropna().astype(str).str.strip().unique())
    eway['Doc.No_str'] = eway['Doc.No'].astype(str).str.strip()
    missing_docs = set(eway['Doc.No_str'].dropna().unique()) - sales_inv
    if not missing_docs:
        return pd.DataFrame()
    df = eway[eway['Doc.No_str'].isin(missing_docs)].copy()
    df.insert(0, 'Remark', 'Not Found in Sales')
    return df.sort_values('Doc.No')


def annexure_7(einv, eway):
    """Annexure 7: E-way Bills (with valid GST party) missing in E-Invoice"""
    if eway is None or eway.empty:
        return pd.DataFrame()
    einv_inv = set(einv['E-Invoice No'].unique())
    if 'Other Party GSTIN' in eway.columns:
        ewg = eway[eway['Other Party GSTIN'].apply(is_valid_gst)].copy()
    else:
        ewg = eway.copy()
    ewg['Doc.No_str'] = ewg['Doc.No'].astype(str).str.strip()
    missing = set(ewg['Doc.No_str'].dropna().unique()) - einv_inv
    if not missing:
        return pd.DataFrame()
    df = ewg[ewg['Doc.No_str'].isin(missing)].copy()
    df.insert(0, 'Remark', 'Not Found in E-Invoice')
    return df.sort_values('Doc.No_str')
