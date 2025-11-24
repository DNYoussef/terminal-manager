#!/usr/bin/env powershell
# MECHASUITE Backend Clean Restart Script
# Clears Python cache and restarts with fresh code

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   MECHASUITE Backend Clean Restart" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill existing backend
Write-Host "[1/5] Killing existing backend processes..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $processes) {
    Write-Host "   Killing process $procId" -ForegroundColor Gray
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Step 2: Clear Python cache
Write-Host "[2/5] Clearing Python bytecode cache..." -ForegroundColor Yellow
Get-ChildItem -Path "C:\Users\17175\terminal-manager\backend" -Filter "__pycache__" -Recurse | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path "C:\Users\17175\terminal-manager\backend" -Filter "*.pyc" -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Host "   Cache cleared" -ForegroundColor Green

# Step 3: Verify port is free
Write-Host "[3/5] Verifying port 8000 is free..." -ForegroundColor Yellow
$portCheck = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "   ERROR: Port 8000 still in use!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "   Port 8000 is free" -ForegroundColor Green
}

# Step 4: Show configuration
Write-Host "[4/5] Configuration:" -ForegroundColor Yellow
Write-Host "   Security: HARDENED (budget_secure.py)" -ForegroundColor Green
Write-Host "   Budget Tracker: C:\Users\17175\claude-code-plugins\ruv-sparc-three-loop-system\hooks\12fa\budget-tracker.js" -ForegroundColor Gray
Write-Host "   Models Fixed: metadata -> event_metadata" -ForegroundColor Green
Write-Host "   Validators: input-validator.cjs, safe-json-stringify.cjs" -ForegroundColor Green

# Step 5: Start backend
Write-Host "[5/5] Starting backend with --reload..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Backend Starting (Ctrl+C to stop)" -ForegroundColor Cyan
Write-Host "   URL: http://localhost:8000" -ForegroundColor White
Write-Host "   Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "   Health: http://localhost:8000/api/v1/budget/health" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "C:\Users\17175\terminal-manager\backend"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
