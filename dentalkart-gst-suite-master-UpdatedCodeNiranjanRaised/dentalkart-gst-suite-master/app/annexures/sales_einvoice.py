"""Annexures 1-3: Sales vs E-Invoice cross-checks"""
import pandas as pd


def annexure_1(raw_sales, einv):
    """Annexure 1: E-Invoice vs Sales amount mismatch"""
    sg = raw_sales.groupby('Invoice No').agg(
        Invoice_Total=('Invoice Total', 'first'),
        Customer=('Billing Name of Customer', 'first'),
        Channel=('Channel', 'first'),
        Invoice_Date=('Invoice Date', 'first'),
        GST_No=('GST No', 'first'),
        Invoice_Place=('Invoice Place', 'first'),
        State=('State', 'first'),
        Client_SKU=('Client SKU', 'first'),
        Description=('Description of Goods', 'first'),
        QTY=('QTY', 'sum'),
        HSN_Code=('HSN Code', 'first'),
        IRN=('E-invoice No.(IRN)', 'first'),
        Eway=('E-way bill number', 'first'),
        Unit_Price=('Unit Price', 'first'),
        TaxPct=('TaxPercent', 'first'),
        Taxable=('Taxable Value', 'sum'),
        CGST=('CGST', 'sum'),
        SGST=('SGST', 'sum'),
        IGST=('IGST', 'sum'),
        TotalTax=('Total Tax', 'sum'),
        Total=('Total', 'sum'),
    ).reset_index()

    m = sg.merge(einv[['E-Invoice No', 'E-Invoice Amount']],
                 left_on='Invoice No', right_on='E-Invoice No', how='inner')
    m['Diff'] = (m['Total'] - m['E-Invoice Amount']).round(2)
    bad = m[abs(m['Diff']) > 0.01].copy()
    if bad.empty:
        return pd.DataFrame()

    out = pd.DataFrame()
    out['Invoice No'] = bad['Invoice No']
    out['Company'] = bad['Channel']
    out['Date of Invoice'] = bad['Invoice_Date']
    out['Order No'] = ''
    out['Order Channel'] = bad['Channel']
    out['Billing Name of Customer'] = bad['Customer']
    out['State2'] = bad['State']
    out['Client SKU'] = bad['Client_SKU']
    out['Description of Goods'] = bad['Description']
    out['QTY'] = bad['QTY'].round(2)
    out['HSN Code'] = bad['HSN_Code']
    out['GST No'] = bad['GST_No']
    out['E-invoice No.(IRN)'] = bad['IRN']
    out['E-way bill number'] = bad['Eway']
    out['Unit Price'] = bad['Unit_Price']
    out['Tax'] = bad['TaxPct']
    out['Taxable Value'] = bad['Taxable'].round(2)
    out['CGST'] = bad['CGST'].round(2)
    out['SGST'] = bad['SGST'].round(2)
    out['IGST'] = bad['IGST'].round(2)
    out['Total Tax'] = bad['TotalTax'].round(2)
    out['Total'] = bad['Total'].round(2)
    out[''] = ''
    out[' '] = ''
    out['  '] = ''
    out['Remark'] = 'E-Invoice & Sale Invoice Not Matched'
    out['E-Invoice'] = bad['E-Invoice No']
    out['Amount'] = bad['E-Invoice Amount']
    out['Diff.'] = bad['Diff']
    return out


def annexure_2(raw_sales, einv):
    """Annexure 2: B2B Sales invoices missing in E-Invoice"""
    missing = set(raw_sales['Invoice No'].unique()) - set(einv['E-Invoice No'].unique())
    if not missing:
        return pd.DataFrame()
    mdf = raw_sales[raw_sales['Invoice No'].isin(missing)].copy()
    grp = mdf.groupby('Invoice No').agg(
        Invoice_Place=('Invoice Place', 'first'),
        Invoice_Date=('Invoice Date', 'first'),
        Order_No=('Order No', 'first'),
        Channel=('Channel', 'first'),
        Customer=('Billing Name of Customer', 'first'),
        State=('State', 'first'),
        GST_No=('GST No', 'first'),
        Client_SKU=('Client SKU', lambda x: ', '.join(x.astype(str).unique()[:3]) + ('...' if len(x.unique()) > 3 else '')),
        Description=('Description of Goods', lambda x: ', '.join(x.astype(str).unique()[:2]) + ('...' if len(x.unique()) > 2 else '')),
        QTY=('QTY', 'sum'),
        Taxable=('Taxable Value', 'sum'),
        TotalTax=('Total Tax', 'sum'),
        Total=('Total', 'sum'),
    ).reset_index()
    out = grp.rename(columns={
        'Invoice_Place': 'Invoice Place', 'Invoice_Date': 'Date of Invoice',
        'Order_No': 'Order No', 'Customer': 'Billing Name of Customer',
        'GST_No': 'GST No', 'Client_SKU': 'Client SKUs',
        'Description': 'Description', 'Taxable': 'Taxable Value',
        'TotalTax': 'Total Tax', 'Total': 'Invoice Total',
    })
    out.insert(0, 'Remark', 'E-Invoice Not Found')
    for c in ['QTY', 'Taxable Value', 'Total Tax', 'Invoice Total']:
        out[c] = out[c].round(2)
    return out.sort_values('Invoice Total', ascending=False)


def annexure_3(raw_sales, einv):
    """Annexure 3: E-Invoices missing in Sales"""
    missing = set(einv['E-Invoice No'].unique()) - set(raw_sales['Invoice No'].unique())
    if not missing:
        return pd.DataFrame()
    df = einv[einv['E-Invoice No'].isin(missing)].copy()
    df.insert(0, 'Remark', 'Not Found in Sales Data')
    df = df.rename(columns={'E-Invoice No': 'Invoice No', 'E-Invoice Amount': 'Invoice Value'})
    return df.sort_values('Invoice Value', ascending=False)
