"""
Optimized Excel readers - caches ExcelFile objects to avoid re-parsing bytes.
Each file's bytes are parsed ONCE into a pd.ExcelFile, then reused for
sheet discovery, header detection, and final read.
"""
import io
import pandas as pd
from app.config import EXCEL_ENGINE


def _detect_engine(data: bytes, filename: str = ''):
    if filename.lower().endswith('.xlsb'):
        return 'pyxlsb'
    return EXCEL_ENGINE


def get_excel_file(data: bytes, filename: str = ''):
    """Parse bytes into a pd.ExcelFile ONCE. Reuse this for all operations on the same file."""
    engine = _detect_engine(data, filename)
    return pd.ExcelFile(io.BytesIO(data), engine=engine)


def read_from_cached(xl: pd.ExcelFile, **kwargs):
    """Read a sheet from an already-parsed ExcelFile (no re-parsing of bytes)."""
    return pd.read_excel(xl, **kwargs)


def read_excel(data: bytes, filename: str = '', **kwargs):
    """Legacy fallback - parses bytes fresh. Use get_excel_file + read_from_cached instead."""
    engine = _detect_engine(data, filename)
    return pd.read_excel(io.BytesIO(data), engine=engine, **kwargs)


def _auto_detect_header(xl: pd.ExcelFile, sheet_name=0, max_check=5):
    """Detect header row using cached ExcelFile - reads only 3 rows per attempt."""
    for h in range(max_check):
        try:
            df = pd.read_excel(xl, sheet_name=sheet_name, header=h, nrows=3)
            unnamed_count = sum(1 for c in df.columns if str(c).startswith('Unnamed'))
            if unnamed_count < len(df.columns) * 0.5:
                return h
        except Exception:
            continue
    return 0


def _find_sheet(xl: pd.ExcelFile, candidates: list):
    """Find best matching sheet name from cached ExcelFile."""
    sheets = xl.sheet_names
    for c in candidates:
        if c in sheets:
            return c
    sheets_lower = {s.lower().strip(): s for s in sheets}
    for c in candidates:
        if c.lower().strip() in sheets_lower:
            return sheets_lower[c.lower().strip()]
    return sheets[0]


def smart_read_sheet(data: bytes, filename: str, candidates: list, xl: pd.ExcelFile = None):
    """One-call helper: find sheet + detect header + read data. Parses file only once.
    Returns (dataframe, xl) so xl can be reused for other sheets in same file."""
    if xl is None:
        xl = get_excel_file(data, filename)
    sheet = _find_sheet(xl, candidates)
    header = _auto_detect_header(xl, sheet_name=sheet)
    df = read_from_cached(xl, sheet_name=sheet, header=header)
    return df, xl
