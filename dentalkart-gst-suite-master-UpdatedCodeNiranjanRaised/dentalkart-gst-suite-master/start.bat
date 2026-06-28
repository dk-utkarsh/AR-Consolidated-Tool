@echo off
REM Launch the DentalKart GST Suite locally on http://localhost:8000
cd /d "%~dp0"
echo Starting DentalKart GST Suite on http://localhost:8000 ...
start "" http://localhost:8000
python run.py
pause
