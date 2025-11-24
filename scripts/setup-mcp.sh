#!/bin/bash
# MCP Configuration Setup Script
# Automates the process of adding MCP servers to Claude Desktop configuration
# Usage: ./scripts/setup-mcp.sh [--dry-run] [--backup-only]

set -e

# Configuration
CONFIG_PATH="$HOME/.claude/claude_desktop_config.json"
BACKUP_DIR="$HOME/.claude/backups"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_PATH="$BACKUP_DIR/claude_desktop_config_$TIMESTAMP.json"
MEMORY_DATA_DIR="$HOME/.claude/memory-data"

# Parse arguments
DRY_RUN=false
BACKUP_ONLY=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --backup-only)
            BACKUP_ONLY=true
            shift
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Usage: $0 [--dry-run] [--backup-only]"
            exit 1
            ;;
    esac
done

# Color output functions
color_output() {
    local color=$1
    local message=$2
    case $color in
        red)     echo -e "\033[0;31m$message\033[0m" ;;
        green)   echo -e "\033[0;32m$message\033[0m" ;;
        yellow)  echo -e "\033[0;33m$message\033[0m" ;;
        cyan)    echo -e "\033[0;36m$message\033[0m" ;;
        white)   echo -e "\033[0;37m$message\033[0m" ;;
        *)       echo "$message" ;;
    esac
}

# Check if jq is available
has_jq() {
    command -v jq >/dev/null 2>&1
}

# Validate JSON
validate_json() {
    local json_string=$1
    if has_jq; then
        echo "$json_string" | jq empty >/dev/null 2>&1
        return $?
    else
        # Basic validation without jq
        python3 -c "import json; json.loads('''$json_string''')" >/dev/null 2>&1
        return $?
    fi
}

# Backup existing config
backup_config() {
    if [ ! -f "$CONFIG_PATH" ]; then
        color_output yellow "No existing config to backup"
        return 1
    fi

    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    color_output green "Created backup directory: $BACKUP_DIR"

    # Copy config to backup
    cp "$CONFIG_PATH" "$BACKUP_PATH"
    color_output green "Backup created: $BACKUP_PATH"
    return 0
}

# Create new config structure
create_new_config() {
    echo '{
  "mcpServers": {}
}'
}

# Get existing config
get_existing_config() {
    if [ ! -f "$CONFIG_PATH" ]; then
        color_output yellow "Config file not found, will create new one"
        create_new_config
        return
    fi

    local config_content=$(cat "$CONFIG_PATH")

    if [ -z "$config_content" ]; then
        color_output yellow "Config file is empty, creating new config"
        create_new_config
        return
    fi

    if ! validate_json "$config_content"; then
        color_output red "ERROR: Existing config has invalid JSON syntax"
        color_output red "Please fix the JSON syntax manually or delete the file"
        exit 1
    fi

    echo "$config_content"
}

# Add MCP server to config
add_mcp_server() {
    local config=$1
    local server_name="memory-triple-layer"

    if has_jq; then
        # Use jq for manipulation
        echo "$config" | jq --arg name "$server_name" \
            '.mcpServers[$name] = {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-memory"],
                "env": {
                    "MEMORY_STORAGE_PATH": "${HOME}/.claude/memory-data"
                }
            }'
    else
        # Fallback to Python
        python3 <<EOF
import json
import sys

config = json.loads('''$config''')

if 'mcpServers' not in config:
    config['mcpServers'] = {}

config['mcpServers']['$server_name'] = {
    'command': 'npx',
    'args': ['-y', '@modelcontextprotocol/server-memory'],
    'env': {
        'MEMORY_STORAGE_PATH': '\${HOME}/.claude/memory-data'
    }
}

print(json.dumps(config, indent=2))
EOF
    fi
}

# Check if server already exists
server_exists() {
    local config=$1
    local server_name="memory-triple-layer"

    if has_jq; then
        echo "$config" | jq -e ".mcpServers[\"$server_name\"]" >/dev/null 2>&1
    else
        python3 -c "import json; config = json.loads('''$config'''); exit(0 if '$server_name' in config.get('mcpServers', {}) else 1)"
    fi
}

# Save config
save_config() {
    local config=$1

    # Ensure .claude directory exists
    mkdir -p "$(dirname "$CONFIG_PATH")"
    color_output green "Created directory: $(dirname "$CONFIG_PATH")"

    # Ensure memory-data directory exists
    mkdir -p "$MEMORY_DATA_DIR"
    color_output green "Created memory storage directory: $MEMORY_DATA_DIR"

    # Validate JSON before writing
    if ! validate_json "$config"; then
        color_output red "ERROR: Generated JSON is invalid"
        exit 1
    fi

    # Write to file
    echo "$config" > "$CONFIG_PATH"
    color_output green "Configuration saved to: $CONFIG_PATH"
}

# Main execution
color_output cyan "\n=== MCP Configuration Setup ==="
color_output cyan "Target config: $CONFIG_PATH\n"

# Check for jq
if ! has_jq; then
    color_output yellow "Note: jq not found, using Python for JSON manipulation"
    if ! command -v python3 >/dev/null 2>&1; then
        color_output red "ERROR: Neither jq nor python3 found. Please install one of them."
        exit 1
    fi
fi

# Backup existing config
BACKUP_CREATED=false
if backup_config; then
    BACKUP_CREATED=true
fi

if [ "$BACKUP_ONLY" = true ]; then
    color_output cyan "\nBackup completed. Exiting (backup-only mode)"
    exit 0
fi

# Read existing config
config=$(get_existing_config)

# Check if server already exists
if server_exists "$config"; then
    color_output yellow "MCP server 'memory-triple-layer' already exists, updating..."
    updated_config=$(add_mcp_server "$config")
else
    color_output green "Adding MCP server 'memory-triple-layer'..."
    updated_config=$(add_mcp_server "$config")
fi

# Display preview
color_output cyan "\n--- Configuration Preview ---"
color_output white "$updated_config"

if [ "$DRY_RUN" = true ]; then
    color_output yellow "\n[DRY RUN] No changes written to disk"
    color_output yellow "Run without --dry-run to apply changes"
    exit 0
fi

# Save configuration
save_config "$updated_config"

color_output green "\n=== Setup Complete ==="
color_output cyan "\nNext Steps:"
color_output white "1. Restart Claude Desktop application"
color_output white "2. MCP servers will be available automatically"
color_output white "3. Memory storage location: $MEMORY_DATA_DIR"

if [ "$BACKUP_CREATED" = true ]; then
    color_output yellow "\nBackup location: $BACKUP_PATH"
fi
