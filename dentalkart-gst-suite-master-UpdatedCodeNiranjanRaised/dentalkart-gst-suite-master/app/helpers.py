import pandas as pd
import numpy as np
from app.config import INVOICE_PLACE_MAPPING


def is_valid_gst(gst_no):
    """Check if GST number is valid (15 characters and not 0/URP/URR/Blank)"""
    if pd.isna(gst_no):
        return False
    gst_str = str(gst_no).strip()
    if gst_str in ['0', 'URP', 'URR', '']:
        return False
    if len(gst_str) != 15:
        return False
    return True


def is_valid_gst_vectorized(series):
    """Vectorized GST validation - 10-50x faster than .apply(is_valid_gst) on large data."""
    s = series.astype(str).str.strip()
    valid = (
        s.notna()
        & (s.str.len() == 15)
        & (~s.isin(['0', 'URP', 'URR', '', 'nan', 'None', 'NaN']))
    )
    return valid


def get_invoice_place(invoice_no):
    if pd.isna(invoice_no):
        return None
    return INVOICE_PLACE_MAPPING.get(str(invoice_no)[:3].upper(), 'Unknown')
