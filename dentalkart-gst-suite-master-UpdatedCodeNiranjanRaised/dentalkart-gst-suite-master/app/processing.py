"""Core job processing - runs all 17 annexures and writes Excel report.

OPTIMIZATION v3 (logic unchanged):
- calamine reader (Rust-based, 3-5x faster than openpyxl)
- Vectorized GST validation (no row-by-row .apply())
- Pre-computed invoice sets shared across annexures
- ThreadPoolExecutor(3) for Render single-core
- Lightweight Excel write (skip Raw Sales if >50K rows)
- No annexure logic is modified.
"""
import os
import uuid
from datetime import datetime
import pandas as pd

from app.config import OUTPUT_DIR
from app.models import store_job, get_job
from app.readers import get_excel_file, _find_sheet, _auto_detect_header, read_from_cached
from app.preparation import prepare_raw_sales_sheet, prepare_einvoice_data, prepare_eway_data

from app.annexures.sales_einvoice import annexure_1, annexure_2, annexure_3
from app.annexures.eway_bill import annexure_4, annexure_5, annexure_6, annexure_7
from app.annexures.sales_checks import annexure_8_tes_sku, annexure_9_admin, annexure_10_discount, annexure_11_zero
from app.annexures.credit_note import (
    annexure_12, annexure_13, annexure_14, annexure_15, annexure_16, annexure_17,
)


def _load_cdnr(einv_xl):
    """Load CDNR sheet from already-parsed E-Invoice ExcelFile"""
    try:
        cdnr_sheet = _find_sheet(einv_xl, ['cdnr', 'CDNR', 'b2b-cr', 'B2B-CR'])
        cdnr_header = _auto_detect_header(einv_xl, sheet_name=cdnr_sheet)
        df = read_from_cached(einv_xl, sheet_name=cdnr_sheet, header=cdnr_header)
        return df.dropna(how='all')
    except Exception:
        return None


def process_job(job_id, sales_b, einv_b, eway_b, cn_b, cn_einv_b=None,
                sales_fname='', einv_fname='', eway_fname='', cn_fname='', cn_einv_fname=''):
    """Runs in background thread."""
    job_state = get_job(job_id) or {}

    def upd(status, pct, msg=''):
        job_state.update({'status': status, 'pct': pct, 'msg': msg})
        store_job(job_id, dict(job_state))

    try:
        # -- Sales --
        upd('running', 5, 'Reading Sales data...')
        sales_xl = get_excel_file(sales_b, sales_fname)
        sales_sheet = _find_sheet(sales_xl, [
            'Dentalkart Standard Sales GST', 'Standard Sales GST', 'Sales Data', 'Sheet1',
        ])
        sales_header = _auto_detect_header(sales_xl, sheet_name=sales_sheet)
        sales_df = read_from_cached(sales_xl, sheet_name=sales_sheet, header=sales_header)
        del sales_xl, sales_b

        upd('running', 15, 'Preparing Sales data...')
        sales_df_orig = sales_df
        raw_sales = prepare_raw_sales_sheet(sales_df)
        del sales_df

        # -- E-Invoice --
        upd('running', 25, 'Reading E-Invoice data...')
        einv_xl = get_excel_file(einv_b, einv_fname)
        EINV_SHEET_CANDIDATES = [
            'E-invoice', 'E-Invoice', 'e-invoice', 'E-INVOICE',
            'b2b,sez,de', 'B2B,SEZ,DE', 'b2b,sez,de,txp',
            'b2b', 'B2B', 'b2b-sez-de', 'Sheet1', 'sheet1',
        ]
        einv_sheet = _find_sheet(einv_xl, EINV_SHEET_CANDIDATES)
        einv_header = _auto_detect_header(einv_xl, sheet_name=einv_sheet)
        einv_df = read_from_cached(einv_xl, sheet_name=einv_sheet, header=einv_header)
        einv = prepare_einvoice_data(einv_df)
        del einv_df

        # -- E-way Bill --
        eway = None
        eway_inward = None
        if eway_b:
            upd('running', 33, 'Reading E-way Bill data...')
            eway_xl = get_excel_file(eway_b, eway_fname)
            del eway_b
            try:
                eway_sheet = _find_sheet(eway_xl, [
                    'Outward Supply', 'outward supply', 'Eway Bill Report',
                    'EWay Bill Report', 'E-way Bill', 'Sheet1',
                ])
                eway_header = _auto_detect_header(eway_xl, sheet_name=eway_sheet)
                eway = prepare_eway_data(read_from_cached(eway_xl, sheet_name=eway_sheet, header=eway_header))
            except Exception as e:
                print(f"Eway Outward error: {e}")
            try:
                inward_sheet = _find_sheet(eway_xl, ['Inword', 'Inward Supply', 'inward supply', 'Inward'])
                inward_header = _auto_detect_header(eway_xl, sheet_name=inward_sheet)
                eway_inward = prepare_eway_data(read_from_cached(eway_xl, sheet_name=inward_sheet, header=inward_header))
            except Exception as e:
                print(f"Eway Inward error: {e}")
            del eway_xl

        # -- Credit Note --
        creditnote_df = None
        if cn_b:
            upd('running', 38, 'Reading Credit Note data...')
            try:
                cn_xl = get_excel_file(cn_b, cn_fname)
                del cn_b
                cn_sheet = _find_sheet(cn_xl, ['Standard Sales Return GST', 'Credit Notes', 'Returns', 'Sheet1'])
                cn_header = _auto_detect_header(cn_xl, sheet_name=cn_sheet)
                creditnote_df = read_from_cached(cn_xl, sheet_name=cn_sheet, header=cn_header)
                del cn_xl
            except Exception as e:
                print(f"CN error: {e}")

        # -- CDNR --
        cdnr_df = None
        if cn_einv_b:
            upd('running', 42, 'Reading CN E-Invoice data...')
            try:
                cn_einv_xl = get_excel_file(cn_einv_b, cn_einv_fname)
                del cn_einv_b
                cn_einv_sheet = _find_sheet(cn_einv_xl, ['b2b-cr', 'B2B-CR', 'cdnr', 'CDNR', 'Sheet1'])
                cn_einv_header = _auto_detect_header(cn_einv_xl, sheet_name=cn_einv_sheet)
                cdnr_df = read_from_cached(cn_einv_xl, sheet_name=cn_einv_sheet, header=cn_einv_header).dropna(how='all')
                del cn_einv_xl
            except Exception as e:
                print(f"CN E-Invoice error: {e}")
        else:
            upd('running', 42, 'Checking CDNR sheet...')
            cdnr_df = _load_cdnr(einv_xl)

        del einv_xl, einv_b

        # -- PRE-COMPUTE shared sets (avoids recomputing in each annexure) --
        upd('running', 45, 'Pre-computing lookups...')
        sales_inv_set = set(raw_sales['Invoice No'].unique())
        einv_inv_set = set(einv['E-Invoice No'].unique())

        # -- Run all 17 annexures IN PARALLEL (LOGIC UNCHANGED) --
        upd('running', 48, 'Running 17 compliance checks...')

        annexure_tasks = [
            ('Annexure 1',  'E-Invoice With Tax Invoice Total Val. Not Matched', annexure_1,          (raw_sales, einv)),
            ('Annexure 2',  'B2B Invoices Missing in E-Invoice Data',            annexure_2,          (raw_sales, einv)),
            ('Annexure 3',  'E-Invoices Missing in Sales Data',                  annexure_3,          (raw_sales, einv)),
            ('Annexure 4',  'Sales Invoices >= 50K Missing in E-way Bill',       annexure_4,          (sales_df_orig, eway)),
            ('Annexure 5',  'E-Invoices >= 50K Missing in E-way Bill',           annexure_5,          (einv, eway)),
            ('Annexure 6',  'E-way Bills Missing in Sales Data',                 annexure_6,          (sales_df_orig, eway)),
            ('Annexure 7',  'E-way Bills (with GST) Missing in E-Invoice',       annexure_7,          (einv, eway)),
            ('Annexure 8',  'TES SKU Invoices with E-Invoice/E-way Bill',        annexure_8_tes_sku,  (sales_df_orig,)),
            ('Annexure 9',  'Administration Order Channel Records',              annexure_9_admin,    (sales_df_orig,)),
            ('Annexure 10', 'High Discount Records (>= 90%)',                    annexure_10_discount,(sales_df_orig,)),
            ('Annexure 11', 'Zero OrderAmount Invoices',                         annexure_11_zero,    (sales_df_orig,)),
            ('Annexure 12', 'E-Invoice CDNR Missing in Credit Note',             annexure_12,         (cdnr_df, creditnote_df)),
            ('Annexure 13', 'Credit Notes (with GST) Missing in CDNR',           annexure_13,         (cdnr_df, creditnote_df)),
            ('Annexure 14', 'Credit Notes >= 50K Missing in E-way Bill Inward',  annexure_14,         (creditnote_df, eway_inward)),
            ('Annexure 15', 'E-Invoice CDNR >= 50K Missing in E-way Bill Inward',annexure_15,         (cdnr_df, eway_inward)),
            ('Annexure 16', 'E-way Bill Inward Missing in Credit Note',          annexure_16,         (creditnote_df, eway_inward)),
            ('Annexure 17', 'E-Invoice CDNR vs Credit Note Value Mismatch',      annexure_17,         (cdnr_df, creditnote_df)),
        ]

        anx = {}
        # Run SEQUENTIALLY, in order. These annexures mutate their input
        # DataFrames in place (e.g. cdnr_df['_note'] = ..., cn_df['_ret'] = ...,
        # sales_df_orig['Sum of Total'] = ...). pandas is not safe for concurrent
        # in-place mutation, so a ThreadPoolExecutor here raced and produced
        # non-deterministic results (e.g. Annexure 13 came out 84 one run, 0 the
        # next on identical input). The checks are cheap relative to the file
        # read, so sequential costs little and is correct + reproducible.
        done_count = 0
        for name, desc, func, args in annexure_tasks:
            try:
                anx[name] = (desc, func(*args))
            except Exception as e:
                print(f"{name} error: {e}")
                anx[name] = (desc, pd.DataFrame())
            done_count += 1
            if done_count % 4 == 0 or done_count == 17:
                upd('running', 48 + int(done_count / 17 * 37), f'Checked {done_count}/17 annexures...')

        # -- Write Excel (optimized) --
        upd('running', 88, 'Writing Excel report...')
        summary_rows = []
        anx_values = {}  # per-annexure value, surfaced in the JSON api_summary too
        for k, (d, df) in anx.items():
            cnt = 0 if df.empty else len(df)
            val = 0
            if not df.empty:
                for vc in ['Invoice Total', 'Invoice Value', 'Order Amount', 'Total Invoice Value',
                           'Note Value', 'Return Amount', 'Difference', 'Discount on Item']:
                    if vc in df.columns:
                        val = pd.to_numeric(df[vc], errors='coerce').sum()
                        break
            anx_values[k] = round(float(val), 2)
            summary_rows.append({'Annexure': k, 'Description': d, 'Records': cnt, 'Value': round(val, 2),
                                 'Remarks': d})
        summary_df = pd.DataFrame(summary_rows)

        fid = str(uuid.uuid4())[:8]
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        fname = f'Compliance_Report_{ts}_{fid}.xlsx'
        fpath = os.path.join(OUTPUT_DIR, fname)

        with pd.ExcelWriter(fpath, engine='xlsxwriter') as writer:
            summary_df.to_excel(writer, sheet_name='Annexure Summary', index=False)

            # Write Raw Sales - limit to 50K rows for speed, full data available in annexures
            if len(raw_sales) > 50000:
                raw_sales.head(50000).to_excel(writer, sheet_name='Raw Sales (Top 50K)', index=False)
            else:
                raw_sales.to_excel(writer, sheet_name='Raw Sales', index=False)

            einv.to_excel(writer, sheet_name='E-Invoice Summary', index=False)

            for name, (desc, df) in anx.items():
                if not df.empty:
                    df = df.copy()
                    # Every annexure must carry a remark on every row. A remark
                    # column only counts if it actually has values - some annexures
                    # build an all-empty 'Remark' column (a pandas quirk of assigning
                    # a scalar to a fresh DataFrame). If no *populated* remark column
                    # exists, fill it (in place when the column is present but blank,
                    # otherwise add a new 'Remarks' column) with the annexure's text
                    # from the Annexure Summary - on every row.
                    remark_cols = [c for c in df.columns
                                   if str(c).strip().lower() in ('remark', 'remarks')]

                    def _has_values(col):
                        s = df[col].astype(str).str.strip().str.lower()
                        return (df[col].notna() & (s != '') & (s != 'nan')).any()

                    if not any(_has_values(c) for c in remark_cols):
                        if remark_cols:
                            for c in remark_cols:
                                df[c] = desc
                        else:
                            df['Remarks'] = desc
                    df.to_excel(writer, sheet_name=name, index=False)

            wb = writer.book
            hf = wb.add_format({'bold': True, 'bg_color': '#FFC000', 'border': 1,
                                'text_wrap': True, 'valign': 'vcenter', 'align': 'center'})
            for sname, ws in writer.sheets.items():
                ws.set_column('A:AZ', 20)
                ws.set_row(0, 25, hf)
            smry_ws = writer.sheets['Annexure Summary']
            smry_ws.set_column('A:A', 15)
            smry_ws.set_column('B:B', 50)
            smry_ws.set_column('C:C', 12)
            smry_ws.set_column('D:D', 20)
            smry_ws.set_column('E:E', 50)

        api_summary = {
            'total_sales_records': raw_sales['Invoice No'].nunique(),
            'total_einvoice_records': len(einv),
        }
        for k, (d, df) in anx.items():
            api_summary[k.lower().replace(' ', '_') + '_count'] = 0 if df.empty else len(df)
            api_summary[k.lower().replace(' ', '_') + '_value'] = anx_values.get(k, 0)

        upd('done', 100, '')
        store_job(job_id, {
            **job_state,
            'status': 'done', 'pct': 100,
            'result': {'success': True, 'summary': api_summary,
                       'filename': fname, 'download_url': f'/download/{fname}'}
        })
    except MemoryError:
        store_job(job_id, {**job_state, 'status': 'error',
                           'result': {'success': False, 'error': 'Server ran out of memory. Try smaller files or upgrade plan.'}})
    except Exception as e:
        import traceback
        store_job(job_id, {**job_state, 'status': 'error',
                           'result': {'success': False, 'error': str(e), 'trace': traceback.format_exc()[-500:]}})
