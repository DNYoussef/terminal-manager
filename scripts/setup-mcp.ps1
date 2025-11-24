# MCP Configuration Setup Script
# Automates the process of adding MCP servers to Claude Desktop configuration
# Usage: .\scripts\setup-mcp.ps1 [-DryRun] [-BackupOnly]

param(
    [switch]$DryRun,
    [switch]$BackupOnly
)

$ErrorActionPreference = "Stop"

# Configuration
$configPath = Join-Path $env:USERPROFILE ".claude\claude_desktop_config.json"
$backupDir = Join-Path $env:USERPROFILE ".claude\backups"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupDir "claude_desktop_config_$timestamp.json"

# MCP Server Configuration
$mcpConfig = @{
    "memory-triple-layer" = @{
        "command" = "npx"
        "args" = @("-y", "@modelcontextprotocol/server-memory")
        "env" = @{
            "MEMORY_STORAGE_PATH" = "`${HOME}/.claude/memory-data"
        }
    }
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Test-JsonValid {
    param([string]$JsonString)

    try {
        $null = ConvertFrom-Json $JsonString -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function New-ClaudeConfig {
    return @{
        "mcpServers" = @{}
    }
}

function Backup-Config {
    if (-not (Test-Path $configPath)) {
        Write-ColorOutput "No existing config to backup" "Yellow"
        return $false
    }

    # Create backup directory if it doesn't exist
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Write-ColorOutput "Created backup directory: $backupDir" "Green"
    }

    # Copy config to backup
    Copy-Item -Path $configPath -Destination $backupPath -Force
    Write-ColorOutput "Backup created: $backupPath" "Green"
    return $true
}

function Get-ExistingConfig {
    if (-not (Test-Path $configPath)) {
        Write-ColorOutput "Config file not found, will create new one" "Yellow"
        return New-ClaudeConfig
    }

    try {
        $configContent = Get-Content -Path $configPath -Raw

        if ([string]::IsNullOrWhiteSpace($configContent)) {
            Write-ColorOutput "Config file is empty, creating new config" "Yellow"
            return New-ClaudeConfig
        }

        if (-not (Test-JsonValid $configContent)) {
            Write-ColorOutput "ERROR: Existing config has invalid JSON syntax" "Red"
            Write-ColorOutput "Please fix the JSON syntax manually or delete the file" "Red"
            exit 1
        }

        $config = ConvertFrom-Json $configContent -AsHashtable

        # Ensure mcpServers section exists
        if (-not $config.ContainsKey("mcpServers")) {
            $config["mcpServers"] = @{}
        }

        return $config
    }
    catch {
        Write-ColorOutput "ERROR: Failed to read config file: $($_.Exception.Message)" "Red"
        exit 1
    }
}

function Update-McpServers {
    param([hashtable]$Config)

    $updated = $false

    foreach ($serverName in $mcpConfig.Keys) {
        if ($Config["mcpServers"].ContainsKey($serverName)) {
            Write-ColorOutput "MCP server '$serverName' already exists, updating..." "Yellow"
        }
        else {
            Write-ColorOutput "Adding MCP server '$serverName'..." "Green"
        }

        $Config["mcpServers"][$serverName] = $mcpConfig[$serverName]
        $updated = $true
    }

    return $updated
}

function Save-Config {
    param([hashtable]$Config)

    try {
        # Ensure .claude directory exists
        $claudeDir = Split-Path $configPath -Parent
        if (-not (Test-Path $claudeDir)) {
            New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
            Write-ColorOutput "Created directory: $claudeDir" "Green"
        }

        # Ensure memory-data directory exists
        $memoryDataDir = Join-Path $env:USERPROFILE ".claude\memory-data"
        if (-not (Test-Path $memoryDataDir)) {
            New-Item -ItemType Directory -Path $memoryDataDir -Force | Out-Null
            Write-ColorOutput "Created memory storage directory: $memoryDataDir" "Green"
        }

        # Convert to JSON with proper formatting
        $jsonOutput = ConvertTo-Json $Config -Depth 10

        # Validate JSON before writing
        if (-not (Test-JsonValid $jsonOutput)) {
            Write-ColorOutput "ERROR: Generated JSON is invalid" "Red"
            exit 1
        }

        # Write to file
        Set-Content -Path $configPath -Value $jsonOutput -Encoding UTF8
        Write-ColorOutput "Configuration saved to: $configPath" "Green"
        return $true
    }
    catch {
        Write-ColorOutput "ERROR: Failed to save config: $($_.Exception.Message)" "Red"
        return $false
    }
}

# Main execution
Write-ColorOutput "`n=== MCP Configuration Setup ===" "Cyan"
Write-ColorOutput "Target config: $configPath`n" "Cyan"

# Backup existing config
$backupCreated = Backup-Config

if ($BackupOnly) {
    Write-ColorOutput "`nBackup completed. Exiting (BackupOnly mode)" "Cyan"
    exit 0
}

# Read existing config or create new
$config = Get-ExistingConfig

# Update MCP servers
$updated = Update-McpServers -Config $config

if (-not $updated) {
    Write-ColorOutput "`nNo changes needed. Configuration is already up to date." "Green"
    exit 0
}

# Display what will be changed
Write-ColorOutput "`n--- Configuration Preview ---" "Cyan"
Write-ColorOutput (ConvertTo-Json $config -Depth 10) "White"

if ($DryRun) {
    Write-ColorOutput "`n[DRY RUN] No changes written to disk" "Yellow"
    Write-ColorOutput "Run without -DryRun to apply changes" "Yellow"
    exit 0
}

# Save configuration
if (Save-Config -Config $config) {
    Write-ColorOutput "`n=== Setup Complete ===" "Green"
    Write-ColorOutput "`nNext Steps:" "Cyan"
    Write-ColorOutput "1. Restart Claude Desktop application" "White"
    Write-ColorOutput "2. MCP servers will be available automatically" "White"
    Write-ColorOutput "3. Memory storage location: $env:USERPROFILE\.claude\memory-data" "White"

    if ($backupCreated) {
        Write-ColorOutput "`nBackup location: $backupPath" "Yellow"
    }
}
else {
    Write-ColorOutput "`nSetup failed. Check errors above." "Red"
    exit 1
}
