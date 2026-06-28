"""Annexures 8-11: Sales-only checks"""
import pandas as pd


def annexure_8_tes_sku(sales_df_orig):
    """Annexure 8: TES SKU Invoices with E-Invoice or E-way Bill"""
    sales_df_orig['ClientSKU_str'] = sales_df_orig.get('ClientSKU', sales_df_orig.get('ClientSku', pd.Series(dtype=str))).astype(str).str.strip().str.upper()
    tes = sales_df_orig[sales_df_orig['ClientSKU_str'].str.startswith('TES')].copy()
    if tes.empty:
        return pd.DataFrame()
    tes['has_einv'] = tes.get('E-invoice No.(IRN)', pd.Series(dtype=str)).astype(str).str.strip().replace('nan', '').ne('')
    tes['has_eway'] = tes.get('E-way bill number', pd.Series(dtype=str)).astype(str).str.strip().replace('nan', '').ne('')
    tes_with = tes[tes['has_einv'] | tes['has_eway']].copy()
    if tes_with.empty:
        return pd.DataFrame()
    uniq = tes_with.drop_duplicates(subset=['InvoiceNo'])
    out = pd.DataFrame()
    out['Remark'] = 'TES SKU with E-Invoice/E-way Bill'
    out['Invoice No'] = uniq['InvoiceNo'].values
    out['Date of Invoice'] = uniq.get('DateofInvoice', '').values
    out['Order Channel'] = uniq.get('Order Channel', '').values
    out['Order No'] = uniq.get('ExternalOrderNo', '').values
    out['Billing Name'] = uniq.get('Billing Name of Customer', '').values
    out['State'] = uniq.get('State', '').values
    out['Client SKU'] = uniq.get('ClientSKU', uniq.get('ClientSku', '')).values
    out['Description'] = uniq.get('DescriptionofGoods', '').values
    out['GST No'] = uniq.get('GST No', '').values
    out['E-Invoice No'] = uniq.get('E-invoice No.(IRN)', '').values
    out['E-way Bill No'] = uniq.get('E-way bill number', '').values
    out['Order Amount'] = pd.to_numeric(uniq.get('OrderAmount', uniq.get('orderAmount', 0)), errors='coerce').round(2).values
    return out.sort_values('Order Amount', ascending=False)


def annexure_9_admin(sales_df_orig):
    """Annexure 9: Administration Order Channel Records"""
    admin = sales_df_orig[sales_df_orig.get('Order Channel', pd.Series(dtype=str)).astype(str).str.strip().str.lower() == 'administration'].copy()
    if admin.empty:
        return pd.DataFrame()
    uniq = admin.drop_duplicates(subset=['InvoiceNo'])
    out = pd.DataFrame()
    out['Remark'] = 'Administration Order'
    out['Invoice No'] = uniq['InvoiceNo'].values
    out['Date of Invoice'] = uniq.get('DateofInvoice', '').values
    out['Order Channel'] = uniq.get('Order Channel', '').values
    out['Order No'] = uniq.get('ExternalOrderNo', '').values
    out['Billing Name'] = uniq.get('Billing Name of Customer', '').values
    out['State'] = uniq.get('State', '').values
    out['Client SKU'] = uniq.get('ClientSKU', '').values
    out['Description'] = uniq.get('DescriptionofGoods', '').values
    out['GST No'] = uniq.get('GST No', '').values
    out['E-Invoice No'] = uniq.get('E-invoice No.(IRN)', '').values
    out['E-way Bill No'] = uniq.get('E-way bill number', '').values
    out['Order Amount'] = pd.to_numeric(uniq.get('OrderAmount', 0), errors='coerce').round(2).values
    return out.sort_values('Order Amount', ascending=False)


def annexure_10_discount(sales_df_orig):
    """Annexure 10: High Discount Records (>= 90%)"""
    sp = pd.to_numeric(sales_df_orig.get('Selling Price', 0), errors='coerce').fillna(0)
    disc = pd.to_numeric(sales_df_orig.get('Discount on item', 0), errors='coerce').fillna(0)
    pct = pd.Series(0.0, index=sales_df_orig.index)
    mask = sp > 0
    pct[mask] = (disc[mask] / sp[mask] * 100)
    high = sales_df_orig[pct >= 90].copy()
    if high.empty:
        return pd.DataFrame()
    out = pd.DataFrame()
    out['Remark'] = 'Discount >= 90%'
    out['Invoice No'] = high['InvoiceNo'].values
    out['Date of Invoice'] = high.get('DateofInvoice', '').values
    out['Order Channel'] = high.get('Order Channel', '').values
    out['Order No'] = high.get('ExternalOrderNo', '').values
    out['Billing Name'] = high.get('Billing Name of Customer', '').values
    out['State'] = high.get('State', '').values
    out['Client SKU'] = high.get('ClientSKU', '').values
    out['Description'] = high.get('DescriptionofGoods', '').values
    out['QTY'] = pd.to_numeric(high.get('QTY', 0), errors='coerce').values
    out['Selling Price'] = sp[high.index].round(2).values
    out['Discount on Item'] = disc[high.index].round(2).values
    out['Discount %'] = pct[high.index].round(2).values
    out['GST No'] = high.get('GST No', '').values
    return out.sort_values('Discount %', ascending=False)


def annexure_11_zero(sales_df_orig):
    """Annexure 11: Zero OrderAmount Invoices"""
    amt = pd.to_numeric(sales_df_orig.get('OrderAmount', sales_df_orig.get('orderAmount', 0)), errors='coerce').fillna(0)
    zero = sales_df_orig[amt == 0].copy()
    if zero.empty:
        return pd.DataFrame()
    uniq = zero.drop_duplicates(subset=['InvoiceNo'])
    out = pd.DataFrame()
    out['Remark'] = 'Zero Order Amount'
    out['Invoice No'] = uniq['InvoiceNo'].values
    out['Date of Invoice'] = uniq.get('DateofInvoice', '').values
    out['Order Channel'] = uniq.get('Order Channel', '').values
    out['Order No'] = uniq.get('ExternalOrderNo', '').values
    out['Billing Name'] = uniq.get('Billing Name of Customer', '').values
    out['State'] = uniq.get('State', '').values
    out['Client SKU'] = uniq.get('ClientSKU', '').values
    out['Description'] = uniq.get('DescriptionofGoods', '').values
    out['GST No'] = uniq.get('GST No', '').values
    out['E-Invoice No'] = uniq.get('E-invoice No.(IRN)', '').values
    out['E-way Bill No'] = uniq.get('E-way bill number', '').values
    out['Order Amount'] = 0
    return out.sort_values('Invoice No')
