import os
from collections import OrderedDict
import threading

try:
    import python_calamine
    EXCEL_ENGINE = 'calamine'
except ImportError:
    EXCEL_ENGINE = 'openpyxl'

OUTPUT_DIR = os.environ.get('COMPLIANCE_OUTPUT_DIR', '/tmp/compliance_outputs')
os.makedirs(OUTPUT_DIR, exist_ok=True)

JOBS = OrderedDict()
JOBS_LOCK = threading.Lock()
MAX_JOBS = 50

INVOICE_PLACE_MAPPING = {
    'BLR': 'Karnataka', 'DWK': 'Delhi', 'DWH': 'Delhi', 'DFN': 'Haryana',
    'CWH': 'Tamil Nadu', 'FNG': 'Haryana', 'BOM': 'Maharashtra',
    'NAG': 'Maharashtra', 'KOL': 'West Bengal', 'GAU': 'Assam',
}
