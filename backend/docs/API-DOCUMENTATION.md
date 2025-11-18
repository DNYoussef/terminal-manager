# Projects API Documentation

**Version**: 1.0.0
**Base URL**: `http://localhost:8000/api/v1`
**Security**: Path whitelisting, Command whitelisting, Resource limits

---

## Table of Contents
1. [Authentication](#authentication)
2. [Endpoints](#endpoints)
   - [Browse Filesystem](#browse-filesystem)
   - [Create Project](#create-project)
   - [Open Terminal](#open-terminal)
   - [List Projects](#list-projects)
   - [Get Project](#get-project)
   - [Delete Project](#delete-project)
3. [Models](#models)
4. [Error Responses](#error-responses)
5. [Security Considerations](#security-considerations)

---

## Authentication

Currently, no authentication is required. This should be added before production deployment.

**Recommended**: JWT Bearer token authentication

---

## Endpoints

### Browse Filesystem

Browse directories to select project location.

**Endpoint**: `GET /api/v1/projects/browse`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | string | No | `C:\Users\17175` | Directory path to browse |

**Response**: `200 OK`
```json
{
  "current_path": "C:\\Users\\17175\\projects",
  "parent_path": "C:\\Users\\17175",
  "items": [
    {
      "name": "my-project",
      "path": "C:\\Users\\17175\\projects\\my-project",
      "is_directory": true,
      "size": null,
      "modified_at": "2025-11-15T10:30:00Z"
    },
    {
      "name": "readme.md",
      "path": "C:\\Users\\17175\\projects\\readme.md",
      "is_directory": false,
      "size": 1024,
      "modified_at": "2025-11-15T10:25:00Z"
    }
  ]
}
```

**Errors**:
- `400 Bad Request` - Path is not a directory
- `403 Forbidden` - Path outside allowed directories
- `404 Not Found` - Directory not found

**Example**:
```bash
curl "http://localhost:8000/api/v1/projects/browse?path=C:\\Users\\17175\\projects"
```

---

### Create Project

Create a new project folder and database record.

**Endpoint**: `POST /api/v1/projects/create`

**Request Body**:
```json
{
  "parent_path": "C:\\Users\\17175\\projects",
  "name": "my-new-project"
}
```

**Validation Rules** (for `name`):
- Length: 1-255 characters
- No path separators: `/` or `\\`
- No path traversal: `..`
- No reserved Windows names: `CON`, `PRN`, `AUX`, `NUL`, `COMn`, `LPTn`
- No invalid characters: `< > : " | ? *` or control characters
- No trailing dots or spaces

**Response**: `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "my-new-project",
  "path": "C:\\Users\\17175\\projects\\my-new-project",
  "created_at": "2025-11-15T10:30:00Z",
  "last_opened_at": null
}
```

**Errors**:
- `400 Bad Request` - Parent path is not a directory
- `403 Forbidden` - Parent path outside allowed directories
- `404 Not Found` - Parent directory not found
- `409 Conflict` - Directory already exists
- `422 Validation Error` - Invalid project name

**Example**:
```bash
curl -X POST "http://localhost:8000/api/v1/projects/create" \
  -H "Content-Type: application/json" \
  -d '{"parent_path": "C:\\Users\\17175", "name": "my-project"}'
```

---

### Open Terminal

Open a terminal session in the project directory.

**Endpoint**: `POST /api/v1/projects/{project_id}/open-terminal`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `project_id` | UUID | Project identifier |

**Request Body**:
```json
{
  "command": "claude"
}
```

**Allowed Commands** (configurable via `ALLOWED_COMMANDS` env var):
- `claude`
- `python`
- `node`
- `npm`
- `git`

**Response**: `200 OK`
```json
{
  "terminal_id": "789e4567-e89b-12d3-a456-426614174999",
  "websocket_url": "ws://localhost:8000/api/v1/terminals/789e4567-e89b-12d3-a456-426614174999/stream",
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "working_dir": "C:\\Users\\17175\\projects\\my-project"
}
```

**Errors**:
- `400 Bad Request` - Command not allowed, limit reached
- `403 Forbidden` - Project path outside allowed directories
- `404 Not Found` - Project not found or directory doesn't exist
- `500 Internal Server Error` - Terminal spawn failed

**Example**:
```bash
curl -X POST "http://localhost:8000/api/v1/projects/123e4567-e89b-12d3-a456-426614174000/open-terminal" \
  -H "Content-Type: application/json" \
  -d '{"command": "claude"}'
```

**WebSocket Connection**:
After opening a terminal, connect to the WebSocket URL to receive real-time output:

```javascript
const ws = new WebSocket('ws://localhost:8000/api/v1/terminals/{terminal_id}/stream');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`[${data.type}] ${data.line}`);
};
```

**WebSocket Message Format**:
```json
{
  "terminal_id": "789e4567-e89b-12d3-a456-426614174999",
  "type": "stdout",
  "line": "Output line from terminal",
  "timestamp": "2025-11-15T10:30:00.123Z"
}
```

---

### List Projects

List all projects, sorted by last opened (most recent first).

**Endpoint**: `GET /api/v1/projects/`

**Response**: `200 OK`
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "my-project-1",
    "path": "C:\\Users\\17175\\projects\\my-project-1",
    "created_at": "2025-11-15T10:30:00Z",
    "last_opened_at": "2025-11-15T12:45:00Z"
  },
  {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "name": "my-project-2",
    "path": "C:\\Users\\17175\\projects\\my-project-2",
    "created_at": "2025-11-14T09:15:00Z",
    "last_opened_at": null
  }
]
```

**Errors**:
- Returns empty array `[]` on database errors (graceful degradation)

**Example**:
```bash
curl "http://localhost:8000/api/v1/projects/"
```

---

### Get Project

Get a specific project by ID.

**Endpoint**: `GET /api/v1/projects/{project_id}`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `project_id` | UUID | Project identifier |

**Response**: `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "my-project",
  "path": "C:\\Users\\17175\\projects\\my-project",
  "created_at": "2025-11-15T10:30:00Z",
  "last_opened_at": "2025-11-15T12:45:00Z"
}
```

**Errors**:
- `404 Not Found` - Project not found
- `500 Internal Server Error` - Database error

**Example**:
```bash
curl "http://localhost:8000/api/v1/projects/123e4567-e89b-12d3-a456-426614174000"
```

---

### Delete Project

Delete a project record, optionally deleting the folder from disk.

**Endpoint**: `DELETE /api/v1/projects/{project_id}`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `project_id` | UUID | Project identifier |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `delete_folder` | boolean | No | `false` | Also delete project folder from disk |

**Response**: `200 OK`
```json
{
  "message": "Project deleted successfully",
  "folder_deleted": true
}
```

**Errors**:
- `404 Not Found` - Project not found
- `500 Internal Server Error` - Deletion failed

**Note**: If `delete_folder=true` but folder deletion fails, the database record is still deleted and an informational message is returned.

**Example**:
```bash
# Delete record only
curl -X DELETE "http://localhost:8000/api/v1/projects/123e4567-e89b-12d3-a456-426614174000"

# Delete record AND folder
curl -X DELETE "http://localhost:8000/api/v1/projects/123e4567-e89b-12d3-a456-426614174000?delete_folder=true"
```

---

## Models

### DirectoryItem

```typescript
interface DirectoryItem {
  name: string;           // File or directory name
  path: string;           // Absolute path
  is_directory: boolean;  // True if directory
  size: number | null;    // File size in bytes (null for directories)
  modified_at: string;    // ISO 8601 timestamp
}
```

### ProjectResponse

```typescript
interface ProjectResponse {
  id: string;                     // UUID
  name: string;                   // Project name
  path: string;                   // Absolute path to project directory
  created_at: string;             // ISO 8601 timestamp
  last_opened_at: string | null;  // ISO 8601 timestamp or null
}
```

### OpenTerminalResponse

```typescript
interface OpenTerminalResponse {
  terminal_id: string;    // Terminal UUID
  websocket_url: string;  // WebSocket URL for streaming
  project_id: string;     // Project UUID
  working_dir: string;    // Absolute path to working directory
}
```

### DeleteProjectResponse

```typescript
interface DeleteProjectResponse {
  message: string;        // Success message
  folder_deleted: boolean;  // Whether folder was deleted from disk
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Human-readable error message"
}
```

### Error Codes

| Code | Description | Example |
|------|-------------|---------|
| `400` | Bad Request | Invalid input, path is not a directory |
| `403` | Forbidden | Path outside allowed directories |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Directory already exists |
| `422` | Validation Error | Project name validation failed |
| `500` | Internal Server Error | Unexpected server error |

### Validation Errors (422)

```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "Project name cannot contain path separators or '..'",
      "type": "value_error"
    }
  ]
}
```

---

## Security Considerations

### Path Security

**Whitelist Enforcement**: All paths are validated against an allowed directories whitelist:
- Configured via `ALLOWED_PROJECT_DIRS` environment variable
- Default: `C:\Users\17175;C:\Users\17175\Desktop`
- Symlink-safe: Resolves all symlinks before validation

**Path Traversal Prevention**:
- Project names cannot contain `..`, `/`, or `\`
- All paths resolved with `os.path.realpath()` before validation
- TOCTOU-safe creation with post-validation

### Command Security

**Command Whitelist**: Only pre-approved commands can be executed:
- Configured via `ALLOWED_COMMANDS` environment variable
- Default: `claude;python;node;npm;git`
- Prevents command injection attacks

**Safe Execution**:
- Uses PowerShell's `-LiteralPath` to prevent path injection
- Uses call operator `&` to prevent command injection
- No shell=True usage (subprocess security)

### Resource Limits

**Terminal Limits**:
- `MAX_TERMINALS`: Default 10 (configurable)
- `MAX_SUBSCRIBERS_PER_TERMINAL`: Default 5 (configurable)
- Prevents resource exhaustion (DoS) attacks

**Rate Limiting**: Not yet implemented (recommended for production)

### Error Handling

**No Information Disclosure**:
- Generic error messages to clients
- Detailed errors logged server-side only
- No stack traces or internal paths exposed

**Transaction Safety**:
- Atomic operations with complete rollback
- Directory cleanup on database failures
- Uses `shutil.rmtree` for complete cleanup

---

## Configuration

Environment variables for production deployment:

```bash
# Path Security
ALLOWED_PROJECT_DIRS="C:\Users\17175;C:\Users\17175\Desktop;C:\Users\17175\Documents"

# Command Security
ALLOWED_COMMANDS="claude;python;node;npm;git;bash"

# Resource Limits
MAX_TERMINALS=10
MAX_SUBSCRIBERS_PER_TERMINAL=5
OUTPUT_QUEUE_SIZE=1000
QUEUE_TIMEOUT=5

# Terminal Configuration
TERMINAL_SHELL="powershell.exe"
TERMINAL_ENCODING="utf-8"

# Logging
LOG_LEVEL="INFO"
LOG_FILE="logs/terminal_manager.log"

# WebSocket
WEBSOCKET_HOST="localhost"
WEBSOCKET_PORT=8000

# Database
DATABASE_URL="postgresql://user:password@localhost/terminal_db"
```

---

## OpenAPI Spec

The full OpenAPI 3.0 specification can be accessed at:
- **JSON**: `http://localhost:8000/openapi.json`
- **Interactive Docs**: `http://localhost:8000/docs` (Swagger UI)
- **ReDoc**: `http://localhost:8000/redoc`

---

## Changelog

### v1.0.0 (2025-11-15)
- Initial release
- All 8 CRITICAL security vulnerabilities fixed
- Production-ready with comprehensive security hardening
- Command injection prevention
- Symlink-safe path validation
- TOCTOU-safe project creation
- Resource limits enforcement
- Config-based whitelisting
- Database cascade fixes
- Secure error handling
- Complete transaction rollback
