@echo off
REM ============================================================================
REM MECHASUITE Backend Restart Script (Secure Router)
REM ============================================================================

echo.
echo ========================================
echo   MECHASUITE Backend Restart
echo   Activating Secure Budget Router
echo ========================================
echo.

REM Step 1: Kill existing backend process
echo [1/3] Stopping existing backend...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
    echo    Killing process %%a on port 8000...
    taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul

REM Step 2: Verify port is free
echo [2/3] Verifying port 8000 is free...
netstat -ano | findstr ":8000" >nul
if %errorlevel% equ 0 (
    echo    ERROR: Port 8000 still in use!
    echo    Please manually kill the process and try again.
    pause
    exit /b 1
) else (
    echo    Port 8000 is free ^(OK^)
)

REM Step 3: Start backend with secure router
echo [3/3] Starting backend with secure router...
echo.
echo ========================================
echo   Backend Starting...
echo   Security: HARDENED (budget_secure.py)
echo   URL: http://localhost:8000
echo   Docs: http://localhost:8000/docs
echo ========================================
echo.
echo Press Ctrl+C to stop the backend
echo.

cd /d "%~dp0backend"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

REM If we get here, the backend stopped
echo.
echo Backend stopped.
pause
