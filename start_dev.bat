@echo off
REM ============================================================
REM מפעיל גם backend וגם frontend בשני חלונות נפרדים.
REM כל אחד עצמאי - סגירת חלון אחד לא משפיעה על השני.
REM ============================================================

cd /d "%~dp0"

echo Launching backend window...
start "Mundial 2026 - Backend" cmd /k "%~dp0start_backend.bat"

REM המתנה קצרה כדי שה-backend יספיק לעלות לפני שה-frontend ינסה לתקשר
timeout /t 2 /nobreak >nul

echo Launching frontend window...
start "Mundial 2026 - Frontend" cmd /k "%~dp0start_frontend.bat"

echo.
echo Both services launched in separate windows:
echo   Backend:  http://127.0.0.1:8000  (docs at /docs)
echo   Frontend: http://localhost:5173
echo.
echo Close each window to stop the corresponding service.
echo.
pause
