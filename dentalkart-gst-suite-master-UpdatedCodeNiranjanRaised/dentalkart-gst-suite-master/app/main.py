"""
ComplianceGuard - Invoice Compliance Analyzer API v3.0
"""
import os
import uuid
import threading
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import OUTPUT_DIR, EXCEL_ENGINE
from app.models import store_job, get_job
from app.processing import process_job
from app.samples import (
    generate_sample_sales, generate_sample_einvoice,
    generate_sample_ewaybill, generate_sample_creditnote,
    generate_sample_cn_einvoice,
)
from app.webapp import WEBAPP_HTML
from app.gst2b.routes import router as gst2b_router


app = FastAPI(title="GST Compliance Suite", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# Mount GST 2B Reconciliation module
app.include_router(gst2b_router)


# ============ API ENDPOINTS ============

@app.get("/health")
async def health():
    return {"status": "healthy", "engine": EXCEL_ENGINE}


@app.post("/analyze")
async def analyze(
    background_tasks: BackgroundTasks,
    sales_file:       UploadFile = File(...),
    einvoice_file:    UploadFile = File(...),
    ewaybill_file:    UploadFile = File(None),
    creditnote_file:  UploadFile = File(None),
    cn_einvoice_file: UploadFile = File(None),
):
    try:
        sales_b   = await sales_file.read()
        einv_b    = await einvoice_file.read()
        eway_b    = await ewaybill_file.read()    if ewaybill_file    else None
        cn_b      = await creditnote_file.read()  if creditnote_file  else None
        cn_einv_b = await cn_einvoice_file.read() if cn_einvoice_file else None
    except Exception as e:
        return JSONResponse({"success": False, "error": f"File upload failed: {e}"})

    job_id = str(uuid.uuid4())[:12]
    store_job(job_id, {
        'status': 'queued', 'pct': 0, 'msg': 'Queued...',
        'submitted': datetime.now().isoformat(),
        'sales_mb': round(len(sales_b) / 1024 / 1024, 1),
        'result': None,
    })
    t = threading.Thread(target=process_job,
                         args=(job_id, sales_b, einv_b, eway_b, cn_b, cn_einv_b),
                         kwargs={
                             'sales_fname': sales_file.filename or '',
                             'einv_fname': einvoice_file.filename or '',
                             'eway_fname': ewaybill_file.filename if ewaybill_file else '',
                             'cn_fname': creditnote_file.filename if creditnote_file else '',
                             'cn_einv_fname': cn_einvoice_file.filename if cn_einvoice_file else '',
                         }, daemon=True)
    t.start()
    return JSONResponse({"job_id": job_id, "status": "queued", "poll_url": f"/status/{job_id}"})


@app.get("/status/{job_id}")
async def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found or expired")
    return JSONResponse({
        "job_id": job_id, "status": job['status'], "pct": job['pct'],
        "msg": job.get('msg', ''), "result": job.get('result'),
    })


@app.get("/download/{filename}")
async def download_file(filename: str):
    fp = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(fp):
        raise HTTPException(404, "File not found or expired")
    return FileResponse(fp, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        filename=filename)


@app.get("/sample/cn-einvoice")
async def sample_cn_einvoice():
    return Response(content=generate_sample_cn_einvoice(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=Sample_CN_EInvoice.xlsx'})


@app.get("/sample/sales")
async def sample_sales():
    return Response(content=generate_sample_sales(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=Sample_Sales_Data.xlsx'})


@app.get("/sample/einvoice")
async def sample_einvoice():
    return Response(content=generate_sample_einvoice(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=Sample_EInvoice.xlsx'})


@app.get("/sample/ewaybill")
async def sample_ewaybill():
    return Response(content=generate_sample_ewaybill(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=Sample_EwayBill.xlsx'})


@app.get("/sample/creditnote")
async def sample_creditnote():
    return Response(content=generate_sample_creditnote(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=Sample_CreditNote.xlsx'})


@app.get("/Dentalkart/GSTtool", response_class=HTMLResponse)
async def webapp():
    """Single-page web application - all tools in one UI"""
    return HTMLResponse(content=WEBAPP_HTML)


@app.get("/", response_class=HTMLResponse)
async def root_redirect():
    """Redirect root to the main app"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/Dentalkart/GSTtool")
