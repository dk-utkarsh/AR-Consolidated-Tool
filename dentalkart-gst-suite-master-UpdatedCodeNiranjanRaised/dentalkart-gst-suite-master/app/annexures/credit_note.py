"""Annexures 12-17: Credit Note / CDNR checks"""
import pandas as pd
from app.helpers import is_valid_gst


def annexure_12(cdnr_df, cn_df):
    """Annexure 12: E-Invoice CDNR Missing in Credit Note"""
    if cdnr_df is None or cdnr_df.empty or cn_df is None or cn_df.empty:
        return pd.DataFrame()
    cdnr_notes = set(cdnr_df['Note Number'].dropna().astype(str).str.strip().unique())
    cn_col = next((c for c in cn_df.columns if any(k in str(c).lower() for k in ['return no', 'credit note', 'note no'])), None)
    if not cn_col:
        return pd.DataFrame()
    cn_returns = set(cn_df[cn_col].dropna().astype(str).str.strip().unique())
    missing = cdnr_notes - cn_returns
    if not missing:
        return pd.DataFrame()
    cdnr_df['_note'] = cdnr_df['Note Number'].astype(str).str.strip()
    mdf = cdnr_df[cdnr_df['_note'].isin(missing)].copy()
    out = pd.DataFrame()
    out['Remark'] = 'Not Found in Credit Note'
    out['Note Number'] = mdf['Note Number'].values
    out['Note Date'] = mdf.get('Note Date', '').values
    out['Note Type'] = mdf.get('Note Type', '').values
    out['GSTIN of Recipient'] = mdf.get('GSTIN/UIN of Recipient', '').values
    out['Receiver Name'] = mdf.get('Receiver Name', '').values
    nv_col = 'Note Value' if 'Note Value' in mdf.columns else ('Note value' if 'Note value' in mdf.columns else None)
    if nv_col:
        out['Note Value'] = pd.to_numeric(mdf[nv_col], errors='coerce').values
    return out.sort_values('Note Number')


def annexure_13(cdnr_df, cn_df):
    """Annexure 13: Credit Notes (with GST) Missing in E-Invoice CDNR"""
    if cdnr_df is None or cdnr_df.empty or cn_df is None or cn_df.empty:
        return pd.DataFrame()
    cn_with_gst = cn_df[cn_df.get('GST No', pd.Series(dtype=str)).apply(is_valid_gst)].copy()
    if cn_with_gst.empty:
        return pd.DataFrame()
    cn_col = next((c for c in cn_with_gst.columns if any(k in str(c).lower() for k in ['return no', 'credit note', 'note no'])), None)
    if not cn_col:
        return pd.DataFrame()
    cn_with_gst['_ret'] = cn_with_gst[cn_col].astype(str).str.strip()
    cdnr_notes = set(cdnr_df['Note Number'].dropna().astype(str).str.strip().unique())
    cn_returns = set(cn_with_gst['_ret'].dropna().unique())
    missing = cn_returns - cdnr_notes
    if not missing:
        return pd.DataFrame()
    mdf = cn_with_gst[cn_with_gst['_ret'].isin(missing)].drop_duplicates(subset=[cn_col]).copy()
    out = pd.DataFrame()
    out['Remark'] = 'Not Found in E-Invoice CDNR'
    out['Return No'] = mdf.get('Return No', mdf.get(cn_col, '')).values
    out['Return Date'] = mdf.get('Return Date', '').values
    out['Invoice No'] = mdf.get('InvoiceNo', '').values
    out['Date of Invoice'] = mdf.get('Date of Invoice', '').values
    out['Order Channel'] = mdf.get('Order Channel', '').values
    out['Name of Customer'] = mdf.get('Name of Customer', '').values
    out['State'] = mdf.get('State', '').values
    out['GST No'] = mdf.get('GST No', '').values
    out['Return Amount'] = pd.to_numeric(mdf.get('Return Amount', 0), errors='coerce').round(2).values
    return out.sort_values('Return Amount', ascending=False)


def annexure_14(cn_df, eway_inward):
    """Annexure 14: Credit Notes >= 50K Missing in E-way Bill Inward"""
    if cn_df is None or cn_df.empty or eway_inward is None or eway_inward.empty:
        return pd.DataFrame()
    cn_df['_amt'] = pd.to_numeric(cn_df.get('Return Amount', 0), errors='coerce').fillna(0)
    hv = cn_df[cn_df['_amt'] >= 50000].copy()
    if hv.empty:
        return pd.DataFrame()
    cn_col = next((c for c in hv.columns if any(k in str(c).lower() for k in ['return no', 'credit note', 'note no'])), None)
    if not cn_col:
        return pd.DataFrame()
    hv['_ret'] = hv[cn_col].astype(str).str.strip()
    eway_docs = set(eway_inward['Doc.No'].dropna().astype(str).str.strip().unique())
    missing = set(hv['_ret'].dropna().unique()) - eway_docs
    if not missing:
        return pd.DataFrame()
    mdf = hv[hv['_ret'].isin(missing)].drop_duplicates(subset=[cn_col]).copy()
    out = pd.DataFrame()
    out['Remark'] = 'E-way Bill Not Found'
    out['Return No'] = mdf.get('Return No', mdf.get(cn_col, '')).values
    out['Return Date'] = mdf.get('Return Date', '').values
    out['Invoice No'] = mdf.get('InvoiceNo', '').values
    out['Date of Invoice'] = mdf.get('Date of Invoice', '').values
    out['Order Channel'] = mdf.get('Order Channel', '').values
    out['Name of Customer'] = mdf.get('Name of Customer', '').values
    out['State'] = mdf.get('State', '').values
    out['GST No'] = mdf.get('GST No', '').values
    out['Return Amount'] = mdf['_amt'].round(2).values
    return out.sort_values('Return Amount', ascending=False)


def annexure_15(cdnr_df, eway_inward):
    """Annexure 15: E-Invoice CDNR >= 50K Missing in E-way Bill Inward"""
    if cdnr_df is None or cdnr_df.empty or eway_inward is None or eway_inward.empty:
        return pd.DataFrame()
    nv_col = 'Note Value' if 'Note Value' in cdnr_df.columns else ('Note value' if 'Note value' in cdnr_df.columns else None)
    if not nv_col:
        return pd.DataFrame()
    cdnr_df['_nv'] = pd.to_numeric(cdnr_df[nv_col], errors='coerce').fillna(0)
    hv = cdnr_df[cdnr_df['_nv'] >= 50000].copy()
    if hv.empty:
        return pd.DataFrame()
    hv['_note'] = hv['Note Number'].astype(str).str.strip()
    eway_docs = set(eway_inward['Doc.No'].dropna().astype(str).str.strip().unique())
    missing = set(hv['_note'].dropna().unique()) - eway_docs
    if not missing:
        return pd.DataFrame()
    mdf = hv[hv['_note'].isin(missing)].copy()
    out = pd.DataFrame()
    out['Remark'] = 'E-way Bill Not Found'
    out['Note Number'] = mdf['Note Number'].values
    out['Note Date'] = mdf.get('Note Date', '').values
    out['Note Type'] = mdf.get('Note Type', '').values
    out['GSTIN of Recipient'] = mdf.get('GSTIN/UIN of Recipient', '').values
    out['Receiver Name'] = mdf.get('Receiver Name', '').values
    out['Note Value'] = mdf['_nv'].round(2).values
    return out.sort_values('Note Value', ascending=False)


def annexure_16(cn_df, eway_inward):
    """Annexure 16: E-way Bill Inward Missing in Credit Note"""
    if cn_df is None or cn_df.empty or eway_inward is None or eway_inward.empty:
        return pd.DataFrame()
    cn_col = next((c for c in cn_df.columns if any(k in str(c).lower() for k in ['return no', 'credit note', 'note no'])), None)
    if not cn_col:
        return pd.DataFrame()
    cn_returns = set(cn_df[cn_col].dropna().astype(str).str.strip().unique())
    eway_inward['Doc.No_str'] = eway_inward['Doc.No'].astype(str).str.strip()
    eway_docs = set(eway_inward['Doc.No_str'].dropna().unique())
    missing = eway_docs - cn_returns
    if not missing:
        return pd.DataFrame()
    df = eway_inward[eway_inward['Doc.No_str'].isin(missing)].copy()
    df.insert(0, 'Remark', 'Not Found in Credit Note')
    return df.sort_values('Doc.No_str')


def annexure_17(cdnr_df, cn_df):
    """Annexure 17: E-Invoice CDNR vs Credit Note Value Mismatch"""
    if cdnr_df is None or cdnr_df.empty or cn_df is None or cn_df.empty:
        return pd.DataFrame()
    nv_col = 'Note Value' if 'Note Value' in cdnr_df.columns else ('Note value' if 'Note value' in cdnr_df.columns else None)
    if not nv_col:
        return pd.DataFrame()
    cn_col = next((c for c in cn_df.columns if any(k in str(c).lower() for k in ['return no', 'credit note', 'note no'])), None)
    amt_col = next((c for c in cn_df.columns if any(k in str(c).lower() for k in ['return amount', 'credit amount'])), None)
    if not cn_col or not amt_col:
        return pd.DataFrame()

    cdnr_df['_note'] = cdnr_df['Note Number'].astype(str).str.strip()
    cdnr_df['_nv'] = pd.to_numeric(cdnr_df[nv_col], errors='coerce').fillna(0)
    agg_dict = {'Note Number': 'first', 'Note Date': 'first', '_nv': 'sum',
                'GSTIN/UIN of Recipient': 'first', 'Receiver Name': 'first'}
    if 'Note Type' in cdnr_df.columns:
        agg_dict['Note Type'] = 'first'
    cdnr_grp = cdnr_df.groupby('_note').agg(agg_dict).reset_index()

    cn_df['_ret'] = cn_df[cn_col].astype(str).str.strip()
    cn_df['_amt'] = pd.to_numeric(cn_df[amt_col], errors='coerce').fillna(0)
    cn_grp = cn_df.groupby('_ret').agg({
        cn_col: 'first', '_amt': 'sum',
        **{c: 'first' for c in ['Return Date', 'Order Channel', 'Name of Customer'] if c in cn_df.columns}
    }).reset_index()

    merged = cdnr_grp.merge(cn_grp, left_on='_note', right_on='_ret', how='inner')
    if merged.empty:
        return pd.DataFrame()
    merged['Diff'] = (merged['_nv'] - merged['_amt']).round(2)
    bad = merged[abs(merged['Diff']) > 0.01].copy()
    if bad.empty:
        return pd.DataFrame()

    out = pd.DataFrame()
    out['Remark'] = 'Value Mismatch'
    out['Note Number'] = bad['Note Number'].values
    out['Note Date'] = bad.get('Note Date', '').values
    if 'Note Type' in bad.columns:
        out['Note Type'] = bad['Note Type'].values
    out['GSTIN of Recipient'] = bad.get('GSTIN/UIN of Recipient', '').values
    out['Receiver Name'] = bad.get('Receiver Name', '').values
    out['CDNR Note Value'] = bad['_nv'].round(2).values
    out[''] = ''
    out['Return No'] = bad.get(cn_col, '').values
    if 'Return Date' in bad.columns:
        out['Return Date'] = bad['Return Date'].values
    if 'Order Channel' in bad.columns:
        out['Order Channel'] = bad['Order Channel'].values
    if 'Name of Customer' in bad.columns:
        out['Customer Name'] = bad['Name of Customer'].values
    out['Credit Note Amount'] = bad['_amt'].round(2).values
    out['Difference'] = bad['Diff'].values
    return out.sort_values('Difference', key=abs, ascending=False)
