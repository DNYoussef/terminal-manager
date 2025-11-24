# Test PostgreSQL Connection Script
# Tests both password options and creates database if needed

$passwords = @("1qazXSW@3edc", "1qazXSW23edc", "postgres")
$dbName = "terminal_db"
$dbUser = "postgres"
$dbHost = "localhost"
$dbPort = 5432

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Connection Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find psql.exe
$psqlPaths = @(
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\18\bin\psql.exe",
    "C:\Program Files\edb\languagepack\v3\PostgreSQL\15\bin\psql.exe"
)

$psql = $null
foreach ($path in $psqlPaths) {
    if (Test-Path $path) {
        $psql = $path
        Write-Host "[+] Found psql: $path" -ForegroundColor Green
        break
    }
}

if (-not $psql) {
    Write-Host "[!] psql.exe not found. Please install PostgreSQL client tools." -ForegroundColor Red
    exit 1
}

$workingPassword = $null
$workingConnectionString = $null

# Test each password
foreach ($password in $passwords) {
    Write-Host "[*] Testing password: $password" -ForegroundColor Yellow

    $env:PGPASSWORD = $password

    try {
        $result = & $psql -h $dbHost -U $dbUser -p $dbPort -d postgres -c "SELECT version();" 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[+] SUCCESS! Password works: $password" -ForegroundColor Green
            Write-Host "[*] PostgreSQL version:" -ForegroundColor Cyan
            Write-Host "$result" -ForegroundColor White
            $workingPassword = $password
            $workingConnectionString = "postgresql://${dbUser}:${password}@${dbHost}:${dbPort}/${dbName}"
            break
        } else {
            Write-Host "[-] Failed: $password" -ForegroundColor Red
            Write-Host "[*] Error details: $result" -ForegroundColor Gray
        }
    } catch {
        Write-Host "[-] Error: $_" -ForegroundColor Red
    }
}

if (-not $workingPassword) {
    Write-Host ""
    Write-Host "[!] None of the passwords worked!" -ForegroundColor Red
    Write-Host "[!] Please check PostgreSQL configuration or reset password." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Creating Database (if needed)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$env:PGPASSWORD = $workingPassword

# Check if database exists
$dbExists = & $psql -h $dbHost -U $dbUser -p $dbPort -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname = '$dbName';" 2>&1 | Select-String "1"

if ($dbExists) {
    Write-Host "[+] Database '$dbName' already exists" -ForegroundColor Green
} else {
    Write-Host "[*] Creating database '$dbName'..." -ForegroundColor Yellow
    & $psql -h $dbHost -U $dbUser -p $dbPort -d postgres -c "CREATE DATABASE $dbName;" 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[+] Database created successfully!" -ForegroundColor Green
    } else {
        Write-Host "[-] Failed to create database" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Connection Details" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Working Password: $workingPassword" -ForegroundColor Green
Write-Host "Connection String: $workingConnectionString" -ForegroundColor Green
Write-Host ""
Write-Host "[+] Update .env file with this connection string:" -ForegroundColor Yellow
Write-Host "DATABASE_URL=$workingConnectionString" -ForegroundColor White
Write-Host ""

# Update .env file
$envPath = "C:\Users\17175\terminal-manager\backend\.env"
if (Test-Path $envPath) {
    (Get-Content $envPath) | ForEach-Object {
        if ($_ -match '^DATABASE_URL=') {
            "DATABASE_URL=$workingConnectionString"
        } elseif ($_ -match '^POSTGRES_PASSWORD=') {
            "POSTGRES_PASSWORD=$workingPassword"
        } else {
            $_
        }
    } | Set-Content $envPath

    Write-Host "[+] .env file updated!" -ForegroundColor Green
} else {
    Write-Host "[!] .env file not found at: $envPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "[+] Test complete!" -ForegroundColor Green
