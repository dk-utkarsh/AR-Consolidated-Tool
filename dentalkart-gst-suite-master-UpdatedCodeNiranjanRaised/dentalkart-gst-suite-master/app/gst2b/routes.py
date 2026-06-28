"""GST 2B Reconciliation API routes - mounted as /gst2b prefix."""
import os
import base64

from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Request
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse, Response

from app.gst2b.config import OUTPUT_DIR
from app.gst2b.reconciliation import run_reconciliation
from app.gst2b.samples import generate_sample_gstr2b, generate_sample_purchase
from app.gst2b.widget import GST2B_WIDGET_HTML

router = APIRouter(prefix="/gst2b", tags=["GST 2B Reconciliation"])


@router.get("/")
async def root():
    return {"message": "GST 2B Reconciliation API", "version": "2.0.0", "status": "running"}


@router.get("/health")
async def health_check():
    return {"status": "healthy"}


@router.post("/reconcile")
async def reconcile(file_2b: UploadFile = File(...), file_pr: UploadFile = File(...)):
    allowed_extensions = ['.xlsx', '.xls']
    for f, name in [(file_2b, "2B file"), (file_pr, "Purchase Register")]:
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"Invalid {name} format. Expected .xlsx/.xls, got {ext}")
    try:
        file_2b_bytes = await file_2b.read()
        file_pr_bytes = await file_pr.read()
        result = run_reconciliation(file_2b_bytes, file_pr_bytes)
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconciliation failed: {str(e)}")


@router.post("/reconcile-zoho")
async def reconcile_zoho(request: Request):
    """Special endpoint for Zoho Creator file uploads"""
    try:
        form = await request.form()
        file_2b = None
        file_pr = None
        for key in form:
            if "2b" in key.lower() or "gstr" in key.lower():
                file_2b = form[key]
            elif "pr" in key.lower() or "purchase" in key.lower():
                file_pr = form[key]
        if file_2b is None or file_pr is None:
            keys = list(form.keys())
            if len(keys) >= 2:
                file_2b = form[keys[0]]
                file_pr = form[keys[1]]
        if file_2b is None or file_pr is None:
            return JSONResponse(content={"success": False, "error": f"Could not find files. Keys received: {list(form.keys())}"})
        file_2b_bytes = await file_2b.read()
        file_pr_bytes = await file_pr.read()
        result = run_reconciliation(file_2b_bytes, file_pr_bytes)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={"success": False, "error": str(e)})


@router.post("/reconcile-base64")
async def reconcile_base64(file_2b_base64: str = Form(...), file_2b_name: str = Form(...), file_pr_base64: str = Form(...), file_pr_name: str = Form(...)):
    try:
        file_2b_bytes = base64.b64decode(file_2b_base64)
        file_pr_bytes = base64.b64decode(file_pr_base64)
        result = run_reconciliation(file_2b_bytes, file_pr_bytes)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconciliation failed: {str(e)}")


@router.get("/download/{filename}")
async def download_file(filename: str):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found or expired")
    return FileResponse(file_path, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename=filename)


@router.get("/download-base64/{filename}")
async def download_file_base64(filename: str):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found or expired")
    with open(file_path, 'rb') as f:
        file_bytes = f.read()
    return JSONResponse(content={'filename': filename, 'content_base64': base64.b64encode(file_bytes).decode('utf-8'), 'content_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})


@router.get("/sample/gstr2b")
async def download_sample_gstr2b():
    return Response(content=generate_sample_gstr2b(),
                    media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={'Content-Disposition': 'attachment; filename=Sample_GSTR_2B.xlsx'})


@router.get("/sample/purchase")
async def download_sample_purchase():
    return Response(content=generate_sample_purchase(),
                    media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={'Content-Disposition': 'attachment; filename=Sample_Purchase_Register.xlsx'})


@router.get("/widget", response_class=HTMLResponse)
async def widget():
    return HTMLResponse(content=GST2B_WIDGET_HTML)
