"""Core GST 2B Reconciliation Logic - UNCHANGED from original."""
import os
import uuid
from datetime import datetime

import pandas as pd
import xlsxwriter

from app.gst2b.config import OUTPUT_DIR, _2B_COLUMN_MAP, PR_COLUMN_MAP
from app.gst2b.helpers import load_excel_with_header


def run_reconciliation(file_2b_bytes: bytes, file_pr_bytes: bytes) -> dict:
    df_2b, m2b, _ = load_excel_with_header(file_2b_bytes, _2B_COLUMN_MAP, "2B Data")
    df_pr, mpr, _ = load_excel_with_header(file_pr_bytes, PR_COLUMN_MAP, "Purchase Register")

    # Validate required columns
    required = ['GSTIN', 'Invoice_No', 'Taxable_Amount']
    missing_2b = [std for std in required if not m2b.get(std)]
    missing_pr = [std for std in required if not mpr.get(std)]

    if missing_2b:
        return {"success": False, "error": f"Missing columns in 2B file: {missing_2b}. Available: {list(df_2b.columns)[:10]}"}
    if missing_pr:
        return {"success": False, "error": f"Missing columns in Purchase Register: {missing_pr}. Available: {list(df_pr.columns)[:10]}"}

    # Standardize 2B data
    df_2b['GSTIN'] = df_2b[m2b['GSTIN']].astype(str).str.strip().str.upper()
    df_2b['Invoice_No'] = df_2b[m2b['Invoice_No']].astype(str).str.strip().str.upper()
    df_2b['Party_Name'] = df_2b[m2b['Party_Name']].astype(str).str.strip() if m2b['Party_Name'] else ''
    df_2b['Invoice_Date'] = df_2b[m2b['Invoice_Date']] if m2b['Invoice_Date'] else ''
    df_2b['Taxable_Amount'] = pd.to_numeric(df_2b[m2b['Taxable_Amount']], errors='coerce').fillna(0).round(2)
    for t in ['IGST', 'CGST', 'SGST']:
        df_2b[t] = pd.to_numeric(df_2b[m2b[t]], errors='coerce').fillna(0) if m2b[t] else 0.0
    df_2b['Total_Tax'] = (df_2b['IGST'] + df_2b['CGST'] + df_2b['SGST']).round(2)
    df_2b['Invoice_Value'] = (df_2b['Taxable_Amount'] + df_2b['Total_Tax']).round(2)
    df_2b['Match_Key'] = df_2b['GSTIN'] + '|' + df_2b['Invoice_No']
    df_2b = df_2b[~df_2b['GSTIN'].isin(['NAN', 'NONE', ''])]
    df_2b = df_2b[~df_2b['Invoice_No'].isin(['NAN', 'NONE', ''])]

    # Standardize PR data
    df_pr['GSTIN'] = df_pr[mpr['GSTIN']].astype(str).str.strip().str.upper()
    df_pr['Invoice_No'] = df_pr[mpr['Invoice_No']].astype(str).str.strip().str.upper()
    df_pr['Party_Name'] = df_pr[mpr['Party_Name']].astype(str).str.strip() if mpr['Party_Name'] else ''
    df_pr['Branch_Name'] = df_pr[mpr['Branch_Name']].astype(str).str.strip() if mpr['Branch_Name'] else ''
    df_pr['Taxable_Amount'] = pd.to_numeric(df_pr[mpr['Taxable_Amount']], errors='coerce').fillna(0)
    for t in ['IGST', 'CGST', 'SGST']:
        df_pr[t] = pd.to_numeric(df_pr[mpr[t]], errors='coerce').fillna(0) if mpr[t] else 0.0
    df_pr['Total_Tax'] = df_pr['IGST'] + df_pr['CGST'] + df_pr['SGST']
    df_pr['Match_Key'] = df_pr['GSTIN'] + '|' + df_pr['Invoice_No']
    df_pr = df_pr[~df_pr['GSTIN'].isin(['NAN', 'NONE', ''])]
    df_pr = df_pr[~df_pr['Invoice_No'].isin(['NAN', 'NONE', ''])]

    # Aggregate PR by GSTIN + Invoice_No
    df_pr_agg = df_pr.groupby(['GSTIN', 'Invoice_No']).agg(
        Party_Name=('Party_Name', 'first'),
        Branch_Name=('Branch_Name', 'first'),
        Taxable_Amount=('Taxable_Amount', 'sum'),
        IGST=('IGST', 'sum'),
        CGST=('CGST', 'sum'),
        SGST=('SGST', 'sum'),
        Total_Tax=('Total_Tax', 'sum'),
    ).reset_index()
    df_pr_agg['Taxable_Amount'] = df_pr_agg['Taxable_Amount'].round(2)
    df_pr_agg['Total_Tax'] = df_pr_agg['Total_Tax'].round(2)
    df_pr_agg['Invoice_Value'] = (df_pr_agg['Taxable_Amount'] + df_pr_agg['Total_Tax']).round(2)
    df_pr_agg['Match_Key'] = df_pr_agg['GSTIN'] + '|' + df_pr_agg['Invoice_No']

    # Matching Logic
    df_2b_idx = df_2b.set_index('Match_Key')
    df_pr_idx = df_pr_agg.set_index('Match_Key')

    keys_2b = set(df_2b_idx.index)
    keys_pr = set(df_pr_idx.index)
    common_keys = list(keys_2b & keys_pr)
    only_2b_keys = list(keys_2b - keys_pr)
    only_pr_keys = list(keys_pr - keys_2b)

    merged = df_2b_idx.loc[common_keys].join(
        df_pr_idx.loc[common_keys],
        lsuffix='_2b', rsuffix='_pr'
    ).reset_index()
    merged['Diff_Taxable'] = (merged['Taxable_Amount_2b'] - merged['Taxable_Amount_pr']).abs()
    merged['Diff_Total_Tax'] = (merged['Total_Tax_2b'] - merged['Total_Tax_pr']).abs()
    is_matched = (merged['Diff_Taxable'] <= 1) & (merged['Diff_Total_Tax'] <= 1)
    matched_df    = merged[is_matched].copy()
    mismatched_df = merged[~is_matched].copy()

    col_rename = {
        'Match_Key': 'Match_Key',
        'GSTIN_2b': 'GSTIN', 'Invoice_No_2b': 'Invoice_No',
        'Invoice_Date': 'Invoice_Date',
        'Party_Name_pr': 'Party_Name',
        'Taxable_Amount_2b': '2B_Taxable', 'IGST_2b': '2B_IGST',
        'CGST_2b': '2B_CGST', 'SGST_2b': '2B_SGST',
        'Total_Tax_2b': '2B_Total_Tax', 'Invoice_Value_2b': '2B_Invoice_Value',
        'Taxable_Amount_pr': 'Books_Taxable', 'IGST_pr': 'Books_IGST',
        'CGST_pr': 'Books_CGST', 'SGST_pr': 'Books_SGST',
        'Total_Tax_pr': 'Books_Total_Tax', 'Invoice_Value_pr': 'Books_Invoice_Value',
    }
    for df_ in [matched_df, mismatched_df]:
        df_.rename(columns=col_rename, inplace=True)

    matched_data    = matched_df.to_dict('records')
    mismatched_data = mismatched_df.to_dict('records')

    # Only in 2B (Not in Books)
    not_in_books_df = df_2b_idx.loc[only_2b_keys][
        ['GSTIN', 'Invoice_No', 'Party_Name', 'Invoice_Date', 'Taxable_Amount', 'IGST', 'CGST', 'SGST', 'Total_Tax', 'Invoice_Value']
    ].reset_index(drop=True).copy()
    not_in_books_df.columns = ['GSTIN', 'Invoice_No', 'Party_Name', 'Invoice_Date', '2B_Taxable', '2B_IGST', '2B_CGST', '2B_SGST', '2B_Total_Tax', '2B_Invoice_Value']

    # Only in Books (Not in 2B)
    not_in_2b_df = df_pr_idx.loc[only_pr_keys][
        ['GSTIN', 'Invoice_No', 'Party_Name', 'Branch_Name', 'Taxable_Amount', 'IGST', 'CGST', 'SGST', 'Total_Tax', 'Invoice_Value']
    ].reset_index(drop=True).copy()
    not_in_2b_df.columns = ['GSTIN', 'Invoice_No', 'Party_Name', 'Branch', 'Books_Taxable', 'Books_IGST', 'Books_CGST', 'Books_SGST', 'Books_Total_Tax', 'Books_Invoice_Value']

    summary = {
        'matched_count': len(matched_df),
        'matched_taxable': round(matched_df['2B_Taxable'].sum() if len(matched_df) > 0 else 0, 2),
        'matched_tax': round(matched_df['2B_Total_Tax'].sum() if len(matched_df) > 0 else 0, 2),
        'mismatched_count': len(mismatched_df),
        'mismatched_2b_taxable': round(mismatched_df['2B_Taxable'].sum() if len(mismatched_df) > 0 else 0, 2),
        'mismatched_books_taxable': round(mismatched_df['Books_Taxable'].sum() if len(mismatched_df) > 0 else 0, 2),
        'not_in_2b_count': len(not_in_2b_df),
        'not_in_2b_taxable': round(not_in_2b_df['Books_Taxable'].sum() if len(not_in_2b_df) > 0 else 0, 2),
        'not_in_2b_tax': round(not_in_2b_df['Books_Total_Tax'].sum() if len(not_in_2b_df) > 0 else 0, 2),
        'not_in_books_count': len(not_in_books_df),
        'not_in_books_taxable': round(not_in_books_df['2B_Taxable'].sum() if len(not_in_books_df) > 0 else 0, 2),
        'not_in_books_tax': round(not_in_books_df['2B_Total_Tax'].sum() if len(not_in_books_df) > 0 else 0, 2),
        'total_2b_records': len(df_2b),
        'total_pr_records': len(df_pr_agg),
    }

    # Build Excel Output
    file_id = str(uuid.uuid4())[:8]
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_filename = f'GST_2B_Reco_{ts}_{file_id}.xlsx'
    output_path = os.path.join(OUTPUT_DIR, output_filename)

    workbook = xlsxwriter.Workbook(output_path, {'constant_memory': True})

    def hex_to_xlsxw(h):
        return '#' + h

    hdr_fmt = workbook.add_format({'bold': True, 'font_color': '#FFFFFF', 'bg_color': '#366092', 'align': 'center', 'valign': 'vcenter', 'border': 1})
    title_fmt = workbook.add_format({'bold': True, 'font_size': 14, 'font_color': '#FFFFFF', 'bg_color': '#366092', 'align': 'center', 'valign': 'vcenter'})
    num_fmt = workbook.add_format({'num_format': '#,##0.00'})

    def color_fmt(bg_hex, bold=True):
        return workbook.add_format({'bold': bold, 'bg_color': hex_to_xlsxw(bg_hex), 'num_format': '#,##0.00'})

    def color_str_fmt(bg_hex, bold=True):
        return workbook.add_format({'bold': bold, 'bg_color': hex_to_xlsxw(bg_hex)})

    c_green1 = 'C6EFCE'; c_green2 = 'E2EFDA'
    c_red = 'FFC7CE'; c_yellow = 'FFEB9C'; c_blue = 'BDD7EE'

    # Summary Sheet
    ws_sum = workbook.add_worksheet('Summary')
    ws_sum.merge_range('A1:D1', 'GST 2B RECONCILIATION SUMMARY', title_fmt)
    ws_sum.set_row(0, 22)
    ws_sum.write_row(1, 0, [], workbook.add_format())
    sum_hdrs = ['Category', 'Count', 'Taxable Amount', 'Total Tax']
    ws_sum.write_row(2, 0, sum_hdrs, hdr_fmt)
    ws_sum.set_row(2, 18)
    summary_rows = [
        ('Matched',                   summary['matched_count'],    summary['matched_taxable'],       summary['matched_tax'],       c_green1),
        ('Mismatched',                summary['mismatched_count'], summary['mismatched_2b_taxable'],  0,                           c_red),
        ('Not in 2B (Only in Books)', summary['not_in_2b_count'],  summary['not_in_2b_taxable'],     summary['not_in_2b_tax'],     c_yellow),
        ('Not in Books (Only in 2B)', summary['not_in_books_count'],summary['not_in_books_taxable'], summary['not_in_books_tax'], c_blue),
    ]
    for r_idx, (label, count, taxable, tax, bg) in enumerate(summary_rows, start=3):
        sf = color_str_fmt(bg); nf = color_fmt(bg)
        ws_sum.write(r_idx, 0, label, sf)
        ws_sum.write(r_idx, 1, count, sf)
        ws_sum.write(r_idx, 2, taxable, nf)
        ws_sum.write(r_idx, 3, tax, nf)
    ws_sum.set_column(0, 0, 32); ws_sum.set_column(1, 1, 10); ws_sum.set_column(2, 3, 18)

    # Matched Sheet
    ws_matched = workbook.add_worksheet('Matched')
    if matched_data:
        hdrs = ['Source', 'GSTIN', 'Party Name', 'Invoice No', 'Invoice Date',
                'Taxable Amount', 'IGST', 'CGST', 'SGST', 'Total Tax', 'Invoice Value', 'Status']
        ws_matched.write_row(0, 0, hdrs, hdr_fmt)
        ws_matched.set_row(0, 18)
        row_idx = 1
        for i, rec in enumerate(matched_data):
            bg = c_green1 if i % 2 == 0 else c_green2
            sf = color_str_fmt(bg, bold=False); nf = color_fmt(bg, bold=False)
            for src, taxable, igst, cgst, sgst, ttax, ival, date_val in [
                ('As Per 2B',    rec['2B_Taxable'],    rec['2B_IGST'],    rec['2B_CGST'],    rec['2B_SGST'],    rec['2B_Total_Tax'],    rec['2B_Invoice_Value'],    rec['Invoice_Date']),
                ('As Per Books', rec['Books_Taxable'], rec['Books_IGST'], rec['Books_CGST'], rec['Books_SGST'], rec['Books_Total_Tax'], rec['Books_Invoice_Value'], ''),
            ]:
                ws_matched.write(row_idx, 0, src, sf)
                ws_matched.write(row_idx, 1, rec['GSTIN'], sf)
                ws_matched.write(row_idx, 2, rec['Party_Name'], sf)
                ws_matched.write(row_idx, 3, rec['Invoice_No'], sf)
                ws_matched.write(row_idx, 4, date_val, sf)
                ws_matched.write(row_idx, 5, taxable, nf)
                ws_matched.write(row_idx, 6, igst, nf)
                ws_matched.write(row_idx, 7, cgst, nf)
                ws_matched.write(row_idx, 8, sgst, nf)
                ws_matched.write(row_idx, 9, ttax, nf)
                ws_matched.write(row_idx, 10, ival, nf)
                ws_matched.write(row_idx, 11, 'Matched', sf)
                row_idx += 1
        ws_matched.set_column(0, 0, 14); ws_matched.set_column(1, 1, 20); ws_matched.set_column(2, 2, 28)
        ws_matched.set_column(3, 4, 18); ws_matched.set_column(5, 11, 16)

    # Mismatched Sheet
    ws_mis = workbook.add_worksheet('Mismatched')
    if mismatched_data:
        hdrs_mis = ['GSTIN', 'Party Name', 'Invoice No', 'Invoice Date',
                    'Taxable Amount', 'IGST', 'CGST', 'SGST', 'Total Tax', 'Invoice Value',
                    'Diff Taxable', 'Diff Tax']
        n = len(hdrs_mis)
        sec_fmt_red = workbook.add_format({'bold': True, 'font_size': 12, 'bg_color': hex_to_xlsxw(c_red)})
        ws_mis.merge_range(0, 0, 0, n - 1, 'Mis-Match As Per Books', sec_fmt_red)
        ws_mis.write_row(1, 0, hdrs_mis, hdr_fmt)
        row_idx = 2
        for rec in mismatched_data:
            ws_mis.write_row(row_idx, 0, [
                rec['GSTIN'], rec['Party_Name'], rec['Invoice_No'], '',
                rec['Books_Taxable'], rec['Books_IGST'], rec['Books_CGST'], rec['Books_SGST'],
                rec['Books_Total_Tax'], rec['Books_Invoice_Value'],
                round(rec['Diff_Taxable'], 2), round(rec['Diff_Total_Tax'], 2)
            ])
            row_idx += 1
        gap = row_idx + 1
        sec_fmt_yel = workbook.add_format({'bold': True, 'font_size': 12, 'bg_color': hex_to_xlsxw(c_yellow)})
        ws_mis.merge_range(gap, 0, gap, n - 1, 'Mis-Match As Per 2B', sec_fmt_yel)
        ws_mis.write_row(gap + 1, 0, hdrs_mis, hdr_fmt)
        row_idx = gap + 2
        for rec in mismatched_data:
            ws_mis.write_row(row_idx, 0, [
                rec['GSTIN'], rec['Party_Name'], rec['Invoice_No'], rec['Invoice_Date'],
                rec['2B_Taxable'], rec['2B_IGST'], rec['2B_CGST'], rec['2B_SGST'],
                rec['2B_Total_Tax'], rec['2B_Invoice_Value'],
                round(rec['Diff_Taxable'], 2), round(rec['Diff_Total_Tax'], 2)
            ])
            row_idx += 1
        ws_mis.set_column(0, 0, 22); ws_mis.set_column(1, 1, 28); ws_mis.set_column(2, 11, 16)

    # Not in 2B Sheet
    ws_n2b = workbook.add_worksheet('Not in 2B')
    if len(not_in_2b_df) > 0:
        ws_n2b.write_row(0, 0, list(not_in_2b_df.columns), hdr_fmt)
        for r_idx, row in enumerate(not_in_2b_df.itertuples(index=False), start=1):
            ws_n2b.write_row(r_idx, 0, list(row))
        ws_n2b.set_column(0, 0, 22); ws_n2b.set_column(1, 1, 28); ws_n2b.set_column(2, 9, 16)

    # Not in Books Sheet
    ws_nb = workbook.add_worksheet('Not in Books')
    if len(not_in_books_df) > 0:
        ws_nb.write_row(0, 0, list(not_in_books_df.columns), hdr_fmt)
        for r_idx, row in enumerate(not_in_books_df.itertuples(index=False), start=1):
            ws_nb.write_row(r_idx, 0, list(row))
        ws_nb.set_column(0, 0, 22); ws_nb.set_column(1, 1, 28); ws_nb.set_column(2, 9, 16)

    workbook.close()

    return {'success': True, 'summary': summary, 'file_id': file_id, 'filename': output_filename, 'download_url': f'/gst2b/download/{output_filename}'}
