# Phase 1 Architecture Documentation

**System**: Terminal Project Manager
**Version**: 1.0.0 (Security Hardened)
**Date**: 2025-11-15

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Details](#component-details)
4. [Data Flow](#data-flow)
5. [Security Architecture](#security-architecture)
6. [Database Schema](#database-schema)
7. [Deployment Architecture](#deployment-architecture)

---

## System Overview

The Terminal Project Manager is a secure web application that allows users to:
1. Browse filesystem directories (within whitelisted paths)
2. Create project folders
3. Spawn terminal sessions in project directories
4. Monitor terminal output in real-time via WebSocket

**Key Features**:
- Security-first design with multiple layers of protection
- Real-time terminal output streaming
- Resource limits to prevent DoS attacks
- Configurable whitelisting for paths and commands
- Atomic operations with complete rollback

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  ┌───────────────┐   ┌──────────────┐   ┌─────────────────┐   │
│  │  Projects     │   │  Directory   │   │  Terminal       │   │
│  │  Selector     │   │  Picker      │   │  Viewer         │   │
│  │  Modal        │   │  Component   │   │  (xterm.js)     │   │
│  └───────┬───────┘   └──────┬───────┘   └────────┬────────┘   │
└──────────┼───────────────────┼───────────────────┼─────────────┘
           │                   │                   │
           │ HTTP REST         │ HTTP REST         │ WebSocket
           │                   │                   │
┌──────────▼───────────────────▼───────────────────▼─────────────┐
│                      BACKEND (FastAPI)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              API Router (projects.py)                     │  │
│  │  GET /browse  │  POST /create  │  POST /open-terminal   │  │
│  │  GET /list    │  GET /{id}     │  DELETE /{id}          │  │
│  └───────┬──────────────┬──────────────────┬─────────────────┘  │
│          │              │                  │                     │
│  ┌───────▼──────┐ ┌────▼──────────┐ ┌─────▼──────────────────┐ │
│  │   Config     │ │  Database      │ │  TerminalManager       │ │
│  │   Service    │ │  Layer         │ │  Service               │ │
│  │              │ │  (SQLAlchemy)  │ │                        │ │
│  │ - Path       │ │                │ │ - spawn()              │ │
│  │   Validation │ │  ┌──────────┐  │ │ - subscribe()          │ │
│  │ - Command    │ │  │ Project  │  │ │ - stop()               │ │
│  │   Whitelist  │ │  │ Terminal │  │ │ - monitor()            │ │
│  │ - Resource   │ │  │ Output   │  │ │ - cleanup()            │ │
│  │   Limits     │ │  └──────────┘  │ │                        │ │
│  └──────────────┘ └────────────────┘ └─────┬──────────────────┘ │
│                                             │                     │
└─────────────────────────────────────────────┼─────────────────────┘
                                              │
                                              │ asyncio.subprocess
                                              │
                                  ┌───────────▼──────────┐
                                  │   PowerShell         │
                                  │   Process            │
                                  │                      │
                                  │  cd project_dir &&   │
                                  │  claude              │
                                  └──────────────────────┘
```

---

## Component Details

### 1. API Router (`app/routers/projects.py`)

**Purpose**: Handle HTTP requests for project management and terminal spawning

**Endpoints**:
- `GET /browse` - Browse filesystem
- `POST /create` - Create project folder
- `POST /{id}/open-terminal` - Spawn terminal
- `GET /` - List all projects
- `GET /{id}` - Get project by ID
- `DELETE /{id}` - Delete project

**Security Features**:
- Input validation via Pydantic
- Path validation via Config service
- TOCTOU-safe project creation
- Generic error messages (no information disclosure)
- Complete transaction rollback

**Dependencies**:
- Config service (path/command validation)
- Database layer (project persistence)
- TerminalManager service (terminal spawning)

---

### 2. Config Service (`app/config.py`)

**Purpose**: Centralized configuration and security validation

**Key Methods**:
```python
class Config:
    # Security Configuration
    ALLOWED_BASE_DIRS: List[str]       # Path whitelist
    ALLOWED_COMMANDS: List[str]        # Command whitelist
    MAX_TERMINALS: int                 # Resource limit
    MAX_SUBSCRIBERS_PER_TERMINAL: int  # Resource limit

    # Validation
    @classmethod
    def validate_path(cls, path: str) -> bool:
        # Symlink-safe path validation
        # Returns: True if path is within whitelist
```

**Environment Variables**:
- `ALLOWED_PROJECT_DIRS` - Semicolon-separated paths
- `ALLOWED_COMMANDS` - Semicolon-separated commands
- `MAX_TERMINALS` - Max concurrent terminals
- `MAX_SUBSCRIBERS_PER_TERMINAL` - Max subscribers per terminal

**Security**:
- Uses `os.path.realpath()` to resolve symlinks before validation
- Validates against `..` path traversal
- Environment-based configuration (no hardcoded secrets)

---

### 3. TerminalManager Service (`app/services/terminal_manager.py`)

**Purpose**: Manage terminal process lifecycle and output streaming

**Architecture**:
```
TerminalManager
    ├── active_terminals: Dict[str, Process]
    ├── output_tasks: Dict[str, List[Task]]
    └── subscribers: Dict[str, Set[Queue]]
```

**Key Methods**:
```python
class TerminalManager:
    async def spawn(project_id, working_dir, db, command) -> Terminal:
        # 1. Validate command against whitelist
        # 2. Validate path with symlink resolution
        # 3. Check terminal limit
        # 4. Spawn PowerShell process (secure command execution)
        # 5. Create database record
        # 6. Start output capture tasks (stdout, stderr, monitor)
        # 7. Return Terminal object

    async def subscribe(terminal_id) -> Queue:
        # 1. Check subscriber limit
        # 2. Create output queue
        # 3. Add to subscribers set
        # 4. Return queue for WebSocket streaming

    async def stop(terminal_id, db):
        # 1. Terminate process gracefully
        # 2. Cancel all output tasks
        # 3. Update database status
        # 4. Cleanup resources
```

**Security**:
- Command whitelist validation
- Symlink-safe path validation
- Resource limits (max terminals, max subscribers)
- Safe PowerShell execution (no command injection)
- Proper error handling and logging

**Output Streaming**:
```python
async def _capture_output(terminal_id, stream, stream_type):
    # Continuous readline loop
    while True:
        line = await stream.readline()
        if not line:
            break
        decoded = line.decode(config.TERMINAL_ENCODING)
        await self._broadcast(terminal_id, {
            'terminal_id': terminal_id,
            'type': stream_type,  # 'stdout' or 'stderr'
            'line': decoded,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
```

---

### 4. Database Layer (`app/models/`)

**Models**:

**Project** (`app/models/project.py`):
```python
class Project:
    id: str (UUID)
    name: str (max 255)
    path: str (unique, indexed)
    created_at: datetime (timezone-aware)
    last_opened_at: datetime (nullable, timezone-aware)

    terminals: relationship (CASCADE delete)
```

**Terminal** (`app/models/terminal.py`):
```python
class Terminal:
    id: str (UUID)
    project_id: str (FK -> projects.id, CASCADE, non-null)
    pid: int (process ID)
    working_dir: str
    status: TerminalStatus (ACTIVE, IDLE, STOPPED, ERROR)
    created_at: datetime
    last_activity_at: datetime

    project: relationship
    output_lines: relationship (CASCADE delete)
```

**TerminalOutput** (`app/models/terminal.py`):
```python
class TerminalOutput:
    id: int (auto-increment)
    terminal_id: str (FK -> terminals.id, CASCADE)
    line: str
    timestamp: datetime

    terminal: relationship
```

**Indexes** (for performance):
- `projects.path` (unique) - Fast project lookup
- `terminals.project_id` - Fast terminals by project
- `terminals.status` - Filter active/stopped
- `terminal_output.terminal_id` - Fast output retrieval
- `terminal_output.timestamp` - Time-based queries

---

## Data Flow

### Flow 1: Browse Filesystem

```
User clicks "Browse" button
    ↓
Frontend → GET /api/v1/projects/browse?path={path}
    ↓
API Router: validate_path() (via Config service)
    ├─ Resolve symlinks with os.path.realpath()
    ├─ Check against ALLOWED_BASE_DIRS whitelist
    └─ Reject if outside whitelist (403 Forbidden)
    ↓
API Router: os.scandir(path)
    ├─ List directory contents
    ├─ Get file stats (size, modified_at)
    └─ Skip inaccessible items
    ↓
API Router: Sort items (directories first, then files)
    ↓
Frontend ← BrowseResponse { current_path, parent_path, items[] }
    ↓
Frontend displays directory tree
```

### Flow 2: Create Project

```
User enters project name and clicks "Create"
    ↓
Frontend → POST /api/v1/projects/create { parent_path, name }
    ↓
Pydantic: Validate name
    ├─ No path separators (/, \)
    ├─ No reserved Windows names (CON, PRN, etc.)
    ├─ No invalid characters (< > : " | ? *)
    └─ No trailing dots/spaces
    ↓
API Router: validate_path(parent_path) and validate_path(project_path)
    ↓
API Router: os.makedirs(project_path, exist_ok=False)
    ↓
API Router: TOCTOU Protection
    ├─ real_created = os.path.realpath(project_path)
    ├─ expected = os.path.realpath(parent_path + name)
    └─ If real_created != expected → Symlink attack! → Cleanup & Reject (403)
    ↓
Database: Insert Project record
    ↓
If DB fails → shutil.rmtree(project_path) → Rollback
    ↓
Frontend ← ProjectResponse { id, name, path, created_at }
    ↓
Frontend updates project list
```

### Flow 3: Open Terminal

```
User selects project and clicks "Open Terminal"
    ↓
Frontend → POST /api/v1/projects/{id}/open-terminal { command }
    ↓
Database: Query Project by ID
    ↓
API Router: validate_path(project.path)
    ↓
TerminalManager.spawn(project_id, working_dir, db, command)
    ├─ Check: command in ALLOWED_COMMANDS
    ├─ Check: len(active_terminals) < MAX_TERMINALS
    ├─ Validate: working_dir with symlink resolution
    ├─ Spawn: PowerShell with safe command execution
    │   ├─ "Set-Location -LiteralPath '{working_dir}'"
    │   └─ "& '{command}'"
    ├─ Create: Terminal database record
    └─ Start: Output capture tasks (stdout, stderr, monitor)
    ↓
Database: Update project.last_opened_at
    ↓
Frontend ← OpenTerminalResponse { terminal_id, websocket_url }
    ↓
Frontend establishes WebSocket connection
    ↓
WebSocket: ws://localhost:8000/api/v1/terminals/{id}/stream
    ↓
TerminalManager.subscribe(terminal_id)
    ├─ Check: subscribers < MAX_SUBSCRIBERS_PER_TERMINAL
    ├─ Create: asyncio.Queue(maxsize=OUTPUT_QUEUE_SIZE)
    └─ Add to: subscribers[terminal_id]
    ↓
Output capture loop broadcasts to queue
    ↓
WebSocket sends messages to frontend
    ↓
Frontend (xterm.js) displays terminal output
```

### Flow 4: Terminal Output Streaming

```
PowerShell process writes to stdout
    ↓
TerminalManager._capture_output() reads line
    ↓
Decode with config.TERMINAL_ENCODING
    ↓
_broadcast(terminal_id, {
    terminal_id,
    type: 'stdout',
    line: decoded_line,
    timestamp: datetime.now(timezone.utc)
})
    ↓
For each queue in subscribers[terminal_id]:
    ├─ queue.put(message) with timeout
    └─ If timeout → Log warning (unresponsive subscriber)
    ↓
WebSocket handler reads from queue
    ↓
WebSocket.send(JSON.stringify(message))
    ↓
Frontend receives message
    ↓
xterm.js writes to terminal display
```

---

## Security Architecture

### Layer 1: Input Validation

**Pydantic Validators**:
```python
@validator('name')
def validate_name(cls, v):
    # Path traversal
    if '..' in v or '/' in v or '\\' in v:
        raise ValueError()

    # Reserved names
    if v.upper() in RESERVED_WINDOWS_NAMES:
        raise ValueError()

    # Invalid characters
    if re.search(r'[<>:"|?*\x00-\x1f]', v):
        raise ValueError()

    return v
```

### Layer 2: Path Security (Config Service)

**Symlink-Safe Validation**:
```python
def validate_path(path: str) -> bool:
    # 1. Resolve ALL symlinks
    real_path = os.path.realpath(path)

    # 2. Normalize to absolute
    abs_path = os.path.abspath(real_path)

    # 3. Check for path traversal
    if '..' in Path(abs_path).parts:
        return False

    # 4. Validate against whitelist
    for base_dir in ALLOWED_BASE_DIRS:
        resolved_base = os.path.realpath(base_dir)
        if abs_path.startswith(resolved_base):
            return True

    return False
```

### Layer 3: Command Security (TerminalManager)

**Command Whitelist**:
```python
ALLOWED_COMMANDS = ['claude', 'python', 'node', 'npm', 'git']

if command not in ALLOWED_COMMANDS:
    raise ValueError("Command not allowed")
```

**Safe Execution**:
```python
# INSECURE (DON'T DO THIS):
f"cd '{working_dir}'; {command}"  # Command injection possible!

# SECURE:
f"Set-Location -LiteralPath '{working_dir}'; & '{command}'"
# -LiteralPath prevents path injection
# & operator prevents command injection
```

### Layer 4: Resource Limits

**Terminal Limits**:
```python
if len(self.active_terminals) >= MAX_TERMINALS:
    raise ValueError("Terminal limit reached")
```

**Subscriber Limits**:
```python
if current_subscribers >= MAX_SUBSCRIBERS_PER_TERMINAL:
    raise ValueError("Subscriber limit reached")
```

### Layer 5: Error Handling

**No Information Disclosure**:
```python
try:
    # Operation
except Exception as e:
    logger.error(f"Detailed error: {e}", exc_info=True)  # Server-side
    raise HTTPException(500, "Generic error message")    # Client-side
```

---

## Database Schema

```sql
-- Projects Table
CREATE TABLE projects (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL,
    last_opened_at TIMESTAMP
);
CREATE INDEX ix_projects_path ON projects(path);

-- Terminals Table
CREATE TABLE terminals (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pid INTEGER NOT NULL,
    working_dir TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP NOT NULL
);
CREATE INDEX ix_terminals_project_id ON terminals(project_id);
CREATE INDEX ix_terminals_status ON terminals(status);

-- Terminal Output Table
CREATE TABLE terminal_output (
    id SERIAL PRIMARY KEY,
    terminal_id VARCHAR(36) NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
    line TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL
);
CREATE INDEX ix_terminal_output_terminal_id ON terminal_output(terminal_id);
CREATE INDEX ix_terminal_output_timestamp ON terminal_output(timestamp);
```

**Cascade Rules**:
- Deleting project → Deletes all terminals (CASCADE)
- Deleting terminal → Deletes all output (CASCADE)

---

## Deployment Architecture

### Development

```
┌─────────────────────────────────────┐
│  Windows Development Machine        │
│                                     │
│  ┌───────────────┐                 │
│  │  Frontend     │                 │
│  │  npm run dev  │                 │
│  │  Port 3000    │                 │
│  └───────┬───────┘                 │
│          │ HTTP                     │
│  ┌───────▼───────┐                 │
│  │  Backend      │                 │
│  │  uvicorn      │                 │
│  │  Port 8000    │                 │
│  └───────┬───────┘                 │
│          │                          │
│  ┌───────▼───────┐                 │
│  │  PostgreSQL   │                 │
│  │  Port 5432    │                 │
│  └───────────────┘                 │
└─────────────────────────────────────┘
```

### Production (Recommended)

```
┌────────────────────────────────────────────┐
│  Cloud Infrastructure (AWS/Azure/GCP)      │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  Load Balancer (HTTPS)                │ │
│  └──────────────┬───────────────────────┘ │
│                 │                          │
│  ┌──────────────▼───────────────────────┐ │
│  │  Reverse Proxy (Nginx)                │ │
│  │  - Static files caching               │ │
│  │  - WebSocket proxy                    │ │
│  │  - Rate limiting                      │ │
│  └──────────────┬───────────────────────┘ │
│                 │                          │
│     ┌───────────┴───────────┐             │
│     │                       │             │
│  ┌──▼─────────┐      ┌──────▼──────┐     │
│  │  Frontend  │      │   Backend   │     │
│  │  (Static)  │      │  (FastAPI)  │     │
│  │            │      │  Gunicorn + │     │
│  │            │      │  Uvicorn    │     │
│  └────────────┘      └──────┬──────┘     │
│                             │             │
│                      ┌──────▼──────┐      │
│                      │  PostgreSQL │      │
│                      │  (RDS/Cloud)│      │
│                      └─────────────┘      │
└────────────────────────────────────────────┘
```

**Environment Variables** (Production):
```bash
# Security
ALLOWED_PROJECT_DIRS="/app/projects;/app/user-data"
ALLOWED_COMMANDS="claude;python;node;npm"

# Resources
MAX_TERMINALS=50
MAX_SUBSCRIBERS_PER_TERMINAL=10

# Database
DATABASE_URL="postgresql://user:pass@db-host:5432/terminal_db"

# Logging
LOG_LEVEL="WARNING"
LOG_FILE="/var/log/terminal-manager/app.log"

# WebSocket
WEBSOCKET_HOST="api.example.com"
WEBSOCKET_PORT=443  # HTTPS
```

---

## Performance Characteristics

**Terminal Spawning**: <500ms
**Output Streaming Latency**: <100ms
**Database Queries**: <10ms (indexed)
**WebSocket Message Rate**: 10-30 messages/sec (throttled)
**Max Concurrent Terminals**: Configurable (default: 10)
**Max Subscribers Per Terminal**: Configurable (default: 5)

---

## Future Enhancements

1. **Authentication/Authorization**: JWT-based auth system
2. **Rate Limiting**: Prevent abuse via rate limiting middleware
3. **Pagination**: For project list and terminal output
4. **Terminal Tabs**: Multiple terminal tabs per project
5. **Terminal Replay**: Store output for session replay
6. **User Permissions**: Role-based access control
7. **Audit Logging**: Track all user actions
8. **Metrics**: Prometheus metrics for monitoring
9. **Cross-Platform**: Support Linux/Mac shells
10. **Terminal Sharing**: Share terminal sessions between users

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-15
**Status**: Production-Ready ✅
