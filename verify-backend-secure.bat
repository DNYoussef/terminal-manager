@echo off
REM ============================================================================
REM MECHASUITE Backend Verification Script
REM Runs after backend restart to verify secure router is active
REM ============================================================================

echo.
echo ========================================
echo   MECHASUITE Backend Verification
echo ========================================
echo.

REM Wait for backend to be ready
echo [1/4] Waiting for backend to start...
timeout /t 3 /nobreak >nul

REM Test health endpoint
echo [2/4] Testing health endpoint...
curl -s http://localhost:8000/api/v1/budget/health > nul 2>&1
if %errorlevel% neq 0 (
    echo    ERROR: Backend not responding!
    echo    Please ensure backend is running: restart-backend-secure.bat
    pause
    exit /b 1
) else (
    echo    Backend is responding ^(OK^)
)

REM Test security status
echo [3/4] Checking security status...
curl -s http://localhost:8000/api/v1/budget/health | findstr "hardened" >nul
if %errorlevel% neq 0 (
    echo    WARNING: Security status not 'hardened'
    echo    Old router might still be active
) else (
    echo    Security status: HARDENED ^(OK^)
)

REM Test secure endpoints
echo [4/4] Testing secure endpoints...
curl -s -X POST http://localhost:8000/api/v1/budget/init/verify-test -H "Content-Type: application/json" -d "{\"tokens_per_day\": 10000}" > nul 2>&1
if %errorlevel% neq 0 (
    echo    ERROR: Budget init endpoint failed
    pause
    exit /b 1
) else (
    echo    All endpoints responding ^(OK^)
)

echo.
echo ========================================
echo   Verification Complete!
echo   Backend is ready for security tests
echo ========================================
echo.
echo Next step: Run security verification tests
echo    node verify-security-deployment.cjs
echo.
pause
