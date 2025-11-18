# MCP Setup Guide

## Overview

This guide explains how to set up and configure all 6 Model Context Protocol (MCP) servers for the Terminal Manager dashboard.

**Supported MCPs:**
1. Memory MCP - Vector search and semantic memory storage
2. Connascence Analyzer - Code quality and coupling detection
3. Claude Flow - Swarm coordination and task orchestration
4. Ruv Swarm - Advanced multi-agent coordination (planned)
5. Flow Nexus - Cloud deployment platform (planned)
6. Playwright - Browser automation (planned)

---

## Architecture

### MCP Communication Flow

```
Frontend Dashboard
    |
    v
Backend API (FastAPI)
    |
    v
MCP Proxy Service (stdio)
    |
    +---> Memory MCP (Python)
    +---> Connascence Analyzer (Python)
    +---> Claude Flow (Node.js)
    +---> Ruv Swarm (Rust/WASM)
    +---> Flow Nexus (Cloud API)
    +---> Playwright (Node.js)
```

### Components

1. **MCP Proxy Service** (`app/services/mcp_proxy.py`)
   - Manages stdio connections to MCP servers
   - Handles JSON-RPC communication
   - Provides tool discovery and invocation

2. **MCP Client** (`app/services/mcp_client.py`)
   - Connection pooling
   - Retry logic with exponential backoff
   - Health monitoring
   - Timeout handling

3. **Health Router** (`app/routers/health.py`)
   - Health check endpoints
   - Manual reconnection API
   - System-wide health monitoring

---

## Installation

### 1. Memory MCP

**Purpose:** Vector search and semantic memory storage with triple-layer architecture (L1: Projects, L2: Tasks, L3: Micro-facts)

**Installation:**
```bash
cd C:/Users/17175/Desktop/memory-mcp-triple-system
python -m venv venv-memory
venv-memory\Scripts\activate
pip install -e .
```

**Configuration in `claude_desktop_config.json`:**
```json
{
  "mcpServers": {
    "memory-mcp": {
      "command": "C:\\Users\\17175\\Desktop\\memory-mcp-triple-system\\venv-memory\\Scripts\\python.exe",
      "args": ["-m", "memory_mcp.server"]
    }
  }
}
```

**Available Tools:**
- `memory_store` - Store data with metadata
- `vector_search` - Semantic search with mode-aware context
- `memory_retrieve` - Get stored memories by key
- `memory_delete` - Remove memories

**Test Command:**
```python
from app.services.mcp_client import MCPClient

client = MCPClient('memory-mcp')
await client.connect()
result = await client.call('memory_store', {
    'text': 'Test memory storage',
    'metadata': {'layer': 'L2', 'project': 'test'}
})
print(result)
```

---

### 2. Connascence Analyzer

**Purpose:** Code quality analysis detecting God Objects, Parameter Bombs, cyclomatic complexity, and other code smells

**Installation:**
```bash
cd C:/Users/17175/Desktop/connascence
python -m venv venv-connascence
venv-connascence\Scripts\activate
pip install -e .
```

**Configuration:**
```json
{
  "mcpServers": {
    "connascence-analyzer": {
      "command": "C:\\Users\\17175\\Desktop\\connascence\\venv-connascence\\Scripts\\python.exe",
      "args": ["-m", "connascence_analyzer.mcp_server"]
    }
  }
}
```

**Available Tools:**
- `analyze_workspace` - Full workspace analysis
- `analyze_file` - Single file analysis
- `get_violations` - Retrieve detected violations
- `suggest_fixes` - Get fix suggestions

**Detection Capabilities:**
1. God Objects (>15 methods)
2. Parameter Bombs (>6 parameters)
3. Cyclomatic Complexity (>10)
4. Deep Nesting (>4 levels)
5. Long Functions (>50 lines)
6. Magic Literals

**Test Command:**
```python
from app.services.mcp_client import MCPClient

client = MCPClient('connascence')
await client.connect()
result = await client.call('analyze_workspace', {
    'path': 'C:/Users/17175/backend'
})
print(f"Violations: {result['total_violations']}")
```

---

### 3. Claude Flow

**Purpose:** Multi-agent swarm coordination with SPARC methodology support

**Installation:**
```bash
npm install -g claude-flow@alpha
```

**Configuration:**
```json
{
  "mcpServers": {
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"]
    }
  }
}
```

**Available Tools:**
- `agents` - Manage agents (list, create, delete)
- `swarm_init` - Initialize swarm topology
- `task_orchestrate` - Distribute tasks across agents
- `sparc_run` - Execute SPARC methodology stages

**Swarm Topologies:**
- `mesh` - Peer-to-peer all-to-all
- `hierarchical` - Tree-based hierarchy
- `ring` - Circular coordination
- `star` - Centralized hub-and-spoke

**Test Command:**
```python
from app.services.mcp_client import MCPClient

client = MCPClient('claude-flow')
await client.connect()
result = await client.call('agents', {
    'action': 'list'
})
print(f"Available agents: {len(result)}")
```

---

### 4. Ruv Swarm (Planned)

**Purpose:** High-performance multi-agent coordination with Rust/WASM backend

**Installation:**
```bash
npm install -g ruv-swarm
```

**Configuration:**
```json
{
  "mcpServers": {
    "ruv-swarm": {
      "command": "npx",
      "args": ["ruv-swarm", "mcp", "start"]
    }
  }
}
```

---

### 5. Flow Nexus (Planned)

**Purpose:** Cloud deployment platform for distributed AI workflows

**Configuration:**
```json
{
  "mcpServers": {
    "flow-nexus": {
      "command": "npx",
      "args": ["flow-nexus@latest", "mcp", "start"]
    }
  }
}
```

---

### 6. Playwright (Planned)

**Purpose:** Browser automation for UI testing and web scraping

**Installation:**
```bash
npm install -g @playwright/test
```

**Configuration:**
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-playwright"]
    }
  }
}
```

---

## Backend Integration

### MCP Proxy Service

The MCP Proxy Service manages all MCP server connections via stdio:

**Features:**
- Automatic server startup/shutdown
- JSON-RPC communication
- Tool discovery and caching
- Request/response handling

**Usage:**
```python
from app.services.mcp_proxy import get_mcp_proxy_service

service = get_mcp_proxy_service()

# Start server
await service.start_server('memory-mcp')

# Call tool
result = await service.call_tool('memory_store', {
    'text': 'Example data',
    'metadata': {'test': True}
})

# Stop server
await service.stop_server('memory-mcp')
```

---

### MCP Client with Retry Logic

The enhanced MCP Client provides connection pooling and retry logic:

**Features:**
- Exponential backoff (3 retries default)
- Connection health monitoring
- Timeout handling (10s default)
- Auto-reconnection

**Usage:**
```python
from app.services.mcp_client import MCPClient, MCPRetryPolicy

# Custom retry policy
retry_policy = MCPRetryPolicy(
    max_retries=5,
    initial_delay=1.0,
    max_delay=30.0,
    exponential_base=2.0
)

client = MCPClient('memory-mcp', timeout=15.0, retry_policy=retry_policy)

# Connect with retry
await client.connect()

# Call with automatic retry on failure
result = await client.call('memory_store', {'text': 'data'})

# Check health
health = client.get_health()
print(f"Status: {health.status}")
print(f"Response time: {health.response_time_ms}ms")
print(f"Error count: {health.error_count}")
```

---

## API Endpoints

### Health Check

**GET `/api/v1/health/mcps`**

Returns health status for all MCP servers:

```json
{
  "success": true,
  "all_connected": false,
  "mcps": {
    "memory-mcp": {
      "name": "memory-mcp",
      "status": "connected",
      "last_check": "2025-01-17T10:30:00Z",
      "last_success": "2025-01-17T10:30:00Z",
      "error_count": 0,
      "response_time_ms": 45.2,
      "running": true,
      "pid": 12345,
      "tools_count": 4
    },
    "connascence-analyzer": {
      "name": "connascence-analyzer",
      "status": "disconnected",
      "last_check": "2025-01-17T10:30:00Z",
      "error_count": 0,
      "running": false
    }
  },
  "total": 6,
  "connected": 2,
  "disconnected": 3,
  "error": 1,
  "timestamp": "2025-01-17T10:30:00Z"
}
```

---

### Manual Reconnect

**POST `/api/v1/health/mcps/{mcp_name}/reconnect`**

Manually reconnect to specific MCP server:

```bash
curl -X POST http://localhost:8000/api/v1/health/mcps/memory-mcp/reconnect \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

**Response:**
```json
{
  "success": true,
  "server_name": "memory-mcp",
  "status": "connected",
  "message": "Successfully reconnected to memory-mcp",
  "timestamp": "2025-01-17T10:31:00Z"
}
```

---

### Reconnect All

**POST `/api/v1/health/mcps/reconnect-all`**

Reconnect to all MCP servers:

```bash
curl -X POST http://localhost:8000/api/v1/health/mcps/reconnect-all
```

**Response:**
```json
{
  "success": true,
  "results": {
    "memory-mcp": {
      "success": true,
      "status": "connected",
      "timestamp": "2025-01-17T10:32:00Z"
    },
    "connascence-analyzer": {
      "success": false,
      "status": "error",
      "error": "Server not installed",
      "timestamp": "2025-01-17T10:32:00Z"
    }
  },
  "total": 6,
  "successful": 2,
  "failed": 4,
  "timestamp": "2025-01-17T10:32:00Z"
}
```

---

## Frontend Integration

### MCP Status Component

The `MCPStatusIndicator` component displays real-time MCP health:

**Features:**
- Real-time status updates (30s interval)
- Manual refresh button
- Per-server reconnect
- Reconnect all
- Error display
- Response time metrics

**Usage in Dashboard:**
```tsx
import MCPStatusIndicator from './components/MCPStatusIndicator';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <MCPStatusIndicator />
    </div>
  );
}
```

---

## Troubleshooting

### MCP Not Connecting

**Symptoms:**
- Status shows "disconnected" or "error"
- Backend logs show "Failed to start server"

**Solutions:**

1. **Verify MCP is installed:**
   ```bash
   # Memory MCP
   C:\Users\17175\Desktop\memory-mcp-triple-system\venv-memory\Scripts\python.exe -m memory_mcp.server --version

   # Connascence
   C:\Users\17175\Desktop\connascence\venv-connascence\Scripts\python.exe -m connascence_analyzer.mcp_server --version

   # Claude Flow
   npx claude-flow@alpha --version
   ```

2. **Check paths in `mcp_proxy.py`:**
   - Verify Python interpreter paths
   - Verify module names
   - Check for typos

3. **Test standalone:**
   ```bash
   # Memory MCP
   C:\Users\17175\Desktop\memory-mcp-triple-system\venv-memory\Scripts\python.exe -m memory_mcp.server
   # Should output JSON-RPC messages
   ```

---

### High Error Count

**Symptoms:**
- `error_count` increasing
- Slow response times
- Timeout errors

**Solutions:**

1. **Increase timeout:**
   ```python
   client = MCPClient('memory-mcp', timeout=30.0)
   ```

2. **Adjust retry policy:**
   ```python
   retry_policy = MCPRetryPolicy(
       max_retries=5,
       initial_delay=2.0,
       max_delay=60.0
   )
   ```

3. **Check MCP server logs:**
   - Memory MCP: Check for ChromaDB errors
   - Connascence: Check for Python exceptions
   - Claude Flow: Check npm logs

---

### Tools Not Available

**Symptoms:**
- `tools_count` is 0
- Tool calls fail with "Tool not found"

**Solutions:**

1. **Restart MCP server:**
   ```python
   await service.stop_server('memory-mcp')
   await asyncio.sleep(2.0)
   await service.start_server('memory-mcp')
   ```

2. **Check initialization response:**
   - Verify JSON-RPC initialize request succeeds
   - Check tools/list response

3. **Verify MCP protocol version:**
   - Ensure MCP server supports protocol version "2024-11-05"

---

### Memory MCP Specific Issues

**ChromaDB Connection Errors:**

```python
# Check ChromaDB data directory
import os
data_dir = os.path.expanduser("~/.memory-mcp-triple/data")
print(f"ChromaDB data: {os.path.exists(data_dir)}")
```

**Fix:**
```bash
# Recreate ChromaDB directory
rm -rf ~/.memory-mcp-triple/data
mkdir -p ~/.memory-mcp-triple/data
```

---

### Connascence Analyzer Specific Issues

**Python Dependencies:**

```bash
cd C:/Users/17175/Desktop/connascence
venv-connascence\Scripts\activate
pip install -r requirements.txt
```

**AST Parsing Errors:**

- Ensure target code is valid Python
- Check for syntax errors
- Verify Python version compatibility

---

## Testing

### Integration Tests

Run comprehensive MCP integration tests:

```bash
cd C:/Users/17175/backend
pytest tests/test_mcp_integration.py -v
```

**Test Coverage:**
- Connection management
- Tool invocation
- Error handling
- Retry logic
- Health monitoring
- Server lifecycle

---

### Manual Testing

**1. Test Memory MCP:**
```bash
curl -X POST http://localhost:8000/api/v1/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "memory_store",
    "arguments": {
      "text": "Test memory",
      "metadata": {"test": true}
    }
  }'
```

**2. Test Connascence Analyzer:**
```bash
curl -X POST http://localhost:8000/api/v1/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "analyze_workspace",
    "arguments": {
      "path": "C:/Users/17175/backend"
    }
  }'
```

**3. Test Claude Flow:**
```bash
curl -X POST http://localhost:8000/api/v1/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "agents",
    "arguments": {
      "action": "list"
    }
  }'
```

---

## Performance Optimization

### Connection Pooling

Use the global connection pool for efficiency:

```python
from app.services.mcp_client import get_mcp_client_pool

pool = get_mcp_client_pool()

# Reuse clients
client1 = pool.get_client('memory-mcp')
client2 = pool.get_client('memory-mcp')  # Same instance

# Connect all at startup
await pool.connect_all()

# Health monitoring
await pool.start_health_monitoring()
```

### Caching

Tools are cached after discovery:

```python
# First call: Fetches from MCP server
tools = service.get_all_tools()

# Subsequent calls: Returns from cache
tools = service.get_all_tools()  # Instant
```

### Timeout Tuning

Adjust timeouts based on tool complexity:

```python
# Quick operations (vector search)
client = MCPClient('memory-mcp', timeout=5.0)

# Slow operations (workspace analysis)
client = MCPClient('connascence', timeout=60.0)
```

---

## Security Considerations

1. **Stdio Communication**
   - MCPs run as subprocesses
   - No network exposure
   - Isolated per-user

2. **Path Validation**
   - Verify absolute paths
   - Prevent directory traversal
   - Sanitize user input

3. **Resource Limits**
   - Set timeouts on all operations
   - Limit concurrent MCP processes
   - Monitor memory usage

4. **Error Handling**
   - Never expose raw errors to frontend
   - Log sensitive info server-side only
   - Use generic error messages

---

## Next Steps

1. **Implement Remaining MCPs:**
   - Ruv Swarm
   - Flow Nexus
   - Playwright

2. **Add Metrics:**
   - Request latency histograms
   - Error rate tracking
   - Tool usage analytics

3. **Enhanced Monitoring:**
   - Prometheus metrics export
   - Grafana dashboards
   - Alert rules

4. **Production Deployment:**
   - Docker containers for MCPs
   - Kubernetes orchestration
   - Load balancing

---

## References

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Memory MCP Documentation](C:/Users/17175/Desktop/memory-mcp-triple-system/README.md)
- [Connascence Analyzer Documentation](C:/Users/17175/Desktop/connascence/README.md)
- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow)
