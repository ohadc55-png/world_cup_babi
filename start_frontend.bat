@echo off
REM ============================================================
REM הרצת Vite frontend בחלון נפרד שלא תלוי ב-Claude / Cursor.
REM סגירת החלון = עצירת ה-dev server.
REM ============================================================

title Mundial 2026 - Frontend (vite)
cd /d "%~dp0frontend"

echo Starting frontend on http://localhost:5173 ...
echo Press Ctrl+C to stop.
echo.

call npm run dev
