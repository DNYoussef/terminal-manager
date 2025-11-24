# MCP Configuration Automation

Automated scripts for setting up MCP (Model Context Protocol) servers in Claude Desktop without manual JSON editing.

## Overview

These scripts handle:
- Automatic backup of existing configuration
- Safe JSON manipulation with validation
- Idempotent operation (can run multiple times)
- Cross-platform support (Windows PowerShell + Linux/Mac Bash)
- Clear error messages and user feedback

## Quick Start

### Windows (PowerShell)

```powershell
# Standard installation
.\scripts\setup-mcp.ps1

# Preview changes without applying
.\scripts\setup-mcp.ps1 -DryRun

# Create backup only
.\scripts\setup-mcp.ps1 -BackupOnly
```

### Linux/Mac (Bash)

```bash
# Standard installation
./scripts/setup-mcp.sh

# Preview changes without applying
./scripts/setup-mcp.sh --dry-run

# Create backup only
./scripts/setup-mcp.sh --backup-only
```

## What Gets Configured

The scripts add the following MCP server to your Claude Desktop configuration:

**memory-triple-layer**: Triple-layer memory system with semantic search
- Storage location: `~/.claude/memory-data`
- Package: `@modelcontextprotocol/server-memory`
- Auto-installed via npx

## Script Features

### Safety Features

1. **Automatic Backup**
   - Creates timestamped backup before any changes
   - Location: `~/.claude/backups/claude_desktop_config_YYYYMMDD-HHMMSS.json`
   - Preserves all existing configuration

2. **JSON Validation**
   - Validates existing config before reading
   - Validates generated config before writing
   - Prevents corruption of configuration file

3. **Idempotent Operation**
   - Safe to run multiple times
   - Updates existing servers instead of duplicating
   - No harm if already configured

4. **Dry Run Mode**
   - Preview changes before applying
   - See exactly what will be modified
   - No risk testing

### Error Handling

- Clear error messages for common issues
- Validation at each step
- Rollback capability (restore from backup)
- Exit codes for scripting integration

## Configuration Location

**Windows**: `C:\Users\<username>\.claude\claude_desktop_config.json`

**Linux/Mac**: `~/.claude/claude_desktop_config.json`

## Requirements

### PowerShell Script
- Windows PowerShell 5.1 or later
- PowerShell Core 7+ (cross-platform)
- No external dependencies

### Bash Script
- Bash 4.0 or later
- One of the following for JSON manipulation:
  - `jq` (recommended, install via package manager)
  - `python3` (fallback option)

**Install jq**:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# Red Hat/CentOS
sudo yum install jq
```

## Usage Examples

### Example 1: First-time Setup

```powershell
# Windows
.\scripts\setup-mcp.ps1
```

Output:
```
=== MCP Configuration Setup ===
Target config: C:\Users\username\.claude\claude_desktop_config.json

Config file not found, will create new one
Created directory: C:\Users\username\.claude
Adding MCP server 'memory-triple-layer'...
Created memory storage directory: C:\Users\username\.claude\memory-data

--- Configuration Preview ---
{
  "mcpServers": {
    "memory-triple-layer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_STORAGE_PATH": "${HOME}/.claude/memory-data"
      }
    }
  }
}

Configuration saved to: C:\Users\username\.claude\claude_desktop_config.json

=== Setup Complete ===

Next Steps:
1. Restart Claude Desktop application
2. MCP servers will be available automatically
3. Memory storage location: C:\Users\username\.claude\memory-data
```

### Example 2: Updating Existing Configuration

```powershell
# Windows
.\scripts\setup-mcp.ps1
```

Output:
```
=== MCP Configuration Setup ===
Target config: C:\Users\username\.claude\claude_desktop_config.json

Backup created: C:\Users\username\.claude\backups\claude_desktop_config_20251119-143022.json
MCP server 'memory-triple-layer' already exists, updating...

--- Configuration Preview ---
{
  "mcpServers": {
    "memory-triple-layer": { ... },
    "other-server": { ... }
  }
}

Configuration saved to: C:\Users\username\.claude\claude_desktop_config.json

=== Setup Complete ===

Next Steps:
1. Restart Claude Desktop application
2. MCP servers will be available automatically
3. Memory storage location: C:\Users\username\.claude\memory-data

Backup location: C:\Users\username\.claude\backups\claude_desktop_config_20251119-143022.json
```

### Example 3: Dry Run (Preview Only)

```bash
# Linux/Mac
./scripts/setup-mcp.sh --dry-run
```

Output:
```
=== MCP Configuration Setup ===
Target config: /home/username/.claude/claude_desktop_config.json

Backup created: /home/username/.claude/backups/claude_desktop_config_20251119-143022.json
Adding MCP server 'memory-triple-layer'...

--- Configuration Preview ---
{
  "mcpServers": {
    "memory-triple-layer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_STORAGE_PATH": "${HOME}/.claude/memory-data"
      }
    }
  }
}

[DRY RUN] No changes written to disk
Run without --dry-run to apply changes
```

### Example 4: Backup Only

```powershell
# Create backup without making changes
.\scripts\setup-mcp.ps1 -BackupOnly
```

## Troubleshooting

### Issue: Invalid JSON Error

**Problem**: Existing config file has syntax errors

**Solution**:
1. Use dry-run mode to see the error
2. Manually fix JSON syntax or delete corrupted file
3. Run script again

```powershell
# Check for issues
.\scripts\setup-mcp.ps1 -DryRun

# If corrupted, restore from backup
cp ~/.claude/backups/claude_desktop_config_TIMESTAMP.json ~/.claude/claude_desktop_config.json
```

### Issue: Permission Denied

**Problem**: Script cannot write to configuration directory

**Solution** (Windows):
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\setup-mcp.ps1
```

**Solution** (Linux/Mac):
```bash
# Ensure script is executable
chmod +x scripts/setup-mcp.sh

# Check directory permissions
ls -la ~/.claude/
```

### Issue: jq Not Found (Linux/Mac)

**Problem**: Bash script requires jq or python3

**Solution**:
```bash
# Install jq (recommended)
sudo apt-get install jq   # Ubuntu/Debian
brew install jq           # macOS

# Or use Python fallback (no action needed if python3 installed)
python3 --version
```

## Verification

After running the script and restarting Claude Desktop:

1. **Check MCP Server Status**:
   ```
   Ask Claude: "List available MCP servers"
   ```

2. **Test Memory Operations**:
   ```
   Ask Claude: "Store a test memory: Hello from automated setup"
   Ask Claude: "Retrieve memories related to setup"
   ```

3. **Verify Storage Directory**:
   ```powershell
   # Windows
   dir $env:USERPROFILE\.claude\memory-data

   # Linux/Mac
   ls -la ~/.claude/memory-data
   ```

## Rollback

To restore previous configuration:

```powershell
# Windows - Find latest backup
Get-ChildItem $env:USERPROFILE\.claude\backups\ | Sort-Object LastWriteTime -Descending | Select-Object -First 1

# Restore backup
Copy-Item "~/.claude/backups/claude_desktop_config_TIMESTAMP.json" "~/.claude/claude_desktop_config.json"
```

```bash
# Linux/Mac - Find latest backup
ls -lt ~/.claude/backups/ | head -n 2

# Restore backup
cp ~/.claude/backups/claude_desktop_config_TIMESTAMP.json ~/.claude/claude_desktop_config.json
```

## Integration with CI/CD

The scripts can be integrated into automation pipelines:

```yaml
# Example GitHub Actions workflow
- name: Setup MCP Configuration
  run: |
    ./scripts/setup-mcp.sh --dry-run
    ./scripts/setup-mcp.sh
  shell: bash
```

Exit codes:
- `0`: Success
- `1`: Error (invalid JSON, permission denied, etc.)

## Advanced Usage

### Custom MCP Servers

To add additional MCP servers, edit the script:

**PowerShell** (`scripts/setup-mcp.ps1`):
```powershell
$mcpConfig = @{
    "memory-triple-layer" = @{ ... }
    "custom-server" = @{
        "command" = "node"
        "args" = @("/path/to/server.js")
        "env" = @{
            "CUSTOM_VAR" = "value"
        }
    }
}
```

**Bash** (`scripts/setup-mcp.sh`):
```bash
# Modify add_mcp_server function to add multiple servers
```

### Environment Variables

Override default paths:

```powershell
# Windows
$env:CLAUDE_CONFIG_PATH = "C:\custom\path\config.json"
.\scripts\setup-mcp.ps1
```

```bash
# Linux/Mac
export CLAUDE_CONFIG_PATH="$HOME/custom/path/config.json"
./scripts/setup-mcp.sh
```

## Support

**Documentation**: See `terminal-manager/README.md` for full system documentation

**Issues**: Report problems via GitHub Issues or project maintainer

**Manual Configuration**: If automated setup fails, refer to `MCP-SETUP-GUIDE.md` for manual steps
