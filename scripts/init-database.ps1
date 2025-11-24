# Database Initialization Script
# HIGH-2: Initializes database tables for event persistence

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  DATABASE INITIALIZATION (HIGH-2)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$BackendPath = "C:\Users\17175\terminal-manager\backend"

# Check if backend exists
if (-not (Test-Path $BackendPath)) {
    Write-Host "ERROR: Backend directory not found at $BackendPath" -ForegroundColor Red
    exit 1
}

Write-Host "[1/4] Checking Python environment..." -ForegroundColor Yellow
cd $BackendPath

# Check if venv exists
if (-not (Test-Path "venv")) {
    Write-Host "  Creating virtual environment..." -ForegroundColor Gray
    python -m venv venv
}

# Activate venv
.\venv\Scripts\Activate.ps1

Write-Host "[2/4] Installing dependencies..." -ForegroundColor Yellow
pip install -q -r requirements.txt

Write-Host "[3/4] Initializing database tables..." -ForegroundColor Yellow
Write-Host "  - Projects, Terminals (existing)" -ForegroundColor Gray
Write-Host "  - StoredEvents, Sessions, BudgetHistory (HIGH-2: new)" -ForegroundColor Gray

# Run database init
python -c "from app.db_setup import init_db; init_db()"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[4/4] Verification..." -ForegroundColor Yellow

    # Check if database file was created (SQLite default)
    if (Test-Path "terminal.db") {
        $dbSize = (Get-Item "terminal.db").Length / 1KB
        Write-Host "  Database file: terminal.db (${dbSize}KB)" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "SUCCESS: Database initialized!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Start backend: uvicorn app.main:app --reload" -ForegroundColor White
    Write-Host "  2. Verify: node scripts\verify-database-persistence.js" -ForegroundColor White
    Write-Host ""

    exit 0
} else {
    Write-Host ""
    Write-Host "ERROR: Database initialization failed" -ForegroundColor Red
    Write-Host "Check error messages above for details" -ForegroundColor Red
    exit 1
}
