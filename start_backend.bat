@echo off
REM ============================================================
REM הרצת FastAPI backend בחלון נפרד שלא תלוי ב-Claude / Cursor.
REM סגירת החלון = עצירת השרת.
REM ============================================================

title Mundial 2026 - Backend (uvicorn)
cd /d "%~dp0backend"

echo Starting backend on http://127.0.0.1:8000 ...
echo Docs: http://127.0.0.1:8000/docs
echo Press Ctrl+C to stop.
echo.

C:\Users\ohadc\anaconda3\envs\my_conda\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
