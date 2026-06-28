"""
Entry point to run ComplianceGuard locally.
Usage: python run.py
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)
