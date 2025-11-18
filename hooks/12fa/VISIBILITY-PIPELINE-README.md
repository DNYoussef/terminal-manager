# Visibility Pipeline - Hook Pipelines Stream 1 Task 1

## Overview

The Visibility Pipeline connects Phase 2 RBAC hooks to the Phase 3 dashboard via WebSocket streaming, enabling real-time monitoring of agent activities, permissions, and operations.

## Architecture

```
Phase 2 Hooks → Visibility Pipeline → Backend API → WebSocket → Dashboard
```

### Components

1. **Visibility Pipeline** (`hooks/12fa/visibility-pipeline.js`)
   - Event capture from Phase 2 hooks
   - Event validation and formatting
   - Buffering and batch processing
   - Backend API integration

2. **Backend Event Router** (`backend/app/routers/events.py`)
   - Event ingestion endpoint (`POST /api/v1/events/ingest`)
   - WebSocket streaming endpoints
   - Event storage and retrieval
   - Real-time broadcasting

3. **WebSocket Connection Manager** (`backend/app/websocket/connection_manager.py`)
   - Connection lifecycle management
   - User-based routing
   - Broadcast capabilities
   - Health monitoring

## Event Types

The pipeline captures and broadcasts the following event types:

| Event Type | Source Hook | Description |
|------------|-------------|-------------|
| `agent_spawned` | pre-identity-verify | Agent created and identity verified |
| `agent_activated` | pre-permission-check | Agent permissions validated |
| `operation_allowed` | RBAC decision | Operation permitted by RBAC |
| `operation_denied` | RBAC decision | Operation blocked by RBAC |
| `budget_updated` | post-budget-deduct | Agent budget deducted |
| `task_started` | pre-task | Task execution began |
| `task_completed` | post-audit-trail | Task completed successfully |
| `task_failed` | post-audit-trail | Task failed with error |

## Event Schema

All events follow this standardized schema:

```javascript
{
  event_type: "agent_activated" | "operation_allowed" | ...,
  timestamp: "2025-11-17T10:30:00.000Z",
  event_id: "uuid-v4",
  agent_id: "agent-uuid",
  agent_name: "coder",
  agent_role: "worker",
  operation: "write_file",
  status: "success" | "failure" | "denied",
  metadata: {
    session_id: "session-uuid",
    task_id: "task-uuid",
    project: "visibility-pipeline",
    trace_id: "trace-uuid",
    // Event-specific fields
  }
}
```

## Integration Points

### Phase 2 RBAC Hooks

The visibility pipeline integrates with existing Phase 2 hooks:

```javascript
// In post-audit-trail hook
const { onTaskCompleted } = require('./visibility-pipeline');

async function postAuditTrail(hookContext) {
  // Existing audit logic...

  // Broadcast to visibility pipeline
  await onTaskCompleted({
    agent_id: hookContext.agentId,
    agent_name: hookContext.agentType,
    operation: hookContext.operation,
    durationMs: hookContext.duration,
    filesModified: hookContext.filesModified
  });
}
```

### Phase 3 Backend API

Events are sent to the backend ingestion endpoint:

```bash
POST http://localhost:8000/api/v1/events/ingest
Content-Type: application/json

{
  "events": [...],
  "batch_id": "uuid",
  "timestamp": "2025-11-17T10:30:00.000Z"
}
```

### Dashboard WebSocket Connection

Dashboard connects to receive real-time events:

```javascript
// Dashboard client
const ws = new WebSocket('ws://localhost:8000/api/v1/agents/activity/stream?user_id=1');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'agent_event') {
    // Update dashboard UI
    updateAgentActivity(data.event);
  }
};
```

## Performance Characteristics

### Targets

- Event processing: **<10ms**
- WebSocket broadcast: **<50ms**
- Throughput: **100 events/sec**

### Optimization Strategies

1. **Event Buffering**
   - Buffer size: 100 events
   - Flush interval: 100ms
   - Prevents API overload

2. **Batch Processing**
   - Events sent in batches
   - Reduces HTTP overhead
   - Improves throughput

3. **Retry Logic**
   - Max retries: 3
   - Exponential backoff
   - Prevents event loss

## Usage

### Start Visibility Pipeline

The pipeline auto-starts when imported as a module:

```javascript
const visibilityPipeline = require('./visibility-pipeline');
// Batch flusher automatically started
```

### Capture Events

Use event handler functions in hooks:

```javascript
const {
  onAgentSpawned,
  onAgentActivated,
  onRbacDecision,
  onBudgetUpdated,
  onTaskCompleted,
  onTaskFailed
} = require('./visibility-pipeline');

// In pre-identity-verify hook
await onAgentSpawned({
  agent_id: 'agent-123',
  agent_name: 'coder',
  capabilities: ['read', 'write']
});

// In RBAC decision hook
await onRbacDecision({
  agent_id: 'agent-123',
  operation: 'write_file',
  resource: 'src/app.js',
  permissionRequired: 'file:write'
}, true); // allowed = true
```

### WebSocket Streaming

#### Agent Activity Stream (Dashboard)

```bash
ws://localhost:8000/api/v1/agents/activity/stream?user_id=1
```

#### General Event Stream

```bash
ws://localhost:8000/api/v1/events/stream?user_id=1
```

### Retrieve Events

Get recent events via REST API:

```bash
# All recent events (last 100)
GET http://localhost:8000/api/v1/events/recent

# Filter by event type
GET http://localhost:8000/api/v1/events/recent?event_type=agent_spawned&limit=50

# Event statistics
GET http://localhost:8000/api/v1/events/stats
```

## Testing

### Run Unit Tests

```bash
cd hooks/12fa/tests
node test-visibility-pipeline.js
```

### Run Integration Test

```bash
cd hooks/12fa
node visibility-pipeline.js test
```

### Test Backend Ingestion

```bash
# Start backend server
cd backend
uvicorn app.main:app --reload

# Send test event
curl -X POST http://localhost:8000/api/v1/events/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "event_type": "agent_spawned",
      "timestamp": "2025-11-17T10:30:00.000Z",
      "event_id": "test-123",
      "agent_id": "agent-456",
      "agent_name": "test-coder",
      "agent_role": "coder",
      "operation": "spawn",
      "status": "success",
      "metadata": {}
    }],
    "batch_id": "batch-789",
    "timestamp": "2025-11-17T10:30:00.000Z"
  }'
```

### Test WebSocket Streaming

```bash
# Install wscat
npm install -g wscat

# Connect to event stream
wscat -c ws://localhost:8000/api/v1/events/stream?user_id=1

# Connect to agent activity stream
wscat -c ws://localhost:8000/api/v1/agents/activity/stream?user_id=1
```

## Monitoring

### Pipeline Statistics

```bash
node visibility-pipeline.js stats
```

Output:
```json
{
  "buffer": {
    "totalEvents": 150,
    "flushedBatches": 3,
    "droppedEvents": 0
  },
  "config": {
    "bufferSize": 100,
    "batchInterval": 100,
    "performanceTargets": {
      "eventProcessing": 10,
      "websocketBroadcast": 50,
      "maxEventsPerSecond": 100
    }
  }
}
```

### Connection Manager Statistics

```bash
curl http://localhost:8000/api/v1/events/health
```

Output:
```json
{
  "status": "healthy",
  "active_connections": 5,
  "total_events_stored": 1250,
  "connection_stats": {
    "total_connections": 15,
    "total_disconnections": 10,
    "messages_sent": 3200,
    "errors": 0,
    "active_connections": 5,
    "unique_users": 3
  }
}
```

## Configuration

### Environment Variables

```bash
# Backend API URL
FASTAPI_BACKEND_URL=http://localhost:8000

# Node environment
NODE_ENV=development
```

### Hook Configuration

Edit `hooks/hooks.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "name": "post-task-visibility",
        "description": "Broadcast task completion events",
        "command": "node",
        "args": [
          "hooks/12fa/visibility-pipeline.js",
          "task-completed",
          "${TASK_ID}",
          "${AGENT_TYPE}",
          "${DURATION_MS}"
        ],
        "matcher": {
          "toolNames": ["Task"]
        },
        "enabled": true,
        "continueOnError": true
      }
    ]
  }
}
```

## Troubleshooting

### Events Not Appearing in Dashboard

1. Check backend server running: `curl http://localhost:8000/health`
2. Verify WebSocket connection: `wscat -c ws://localhost:8000/api/v1/events/stream`
3. Check event ingestion: `curl http://localhost:8000/api/v1/events/stats`
4. Review pipeline stats: `node visibility-pipeline.js stats`

### High Event Loss

1. Check buffer size (increase if needed)
2. Verify backend API response time
3. Check network connectivity
4. Review dropped events count in stats

### Slow Event Processing

1. Profile event creation time
2. Check backend API latency
3. Verify batch size optimization
4. Monitor WebSocket broadcast time

## Success Criteria

- ✅ All agent events captured and broadcasted
- ✅ Dashboard receives real-time updates
- ✅ No event loss under load (100 events/sec)
- ✅ Event processing <10ms
- ✅ WebSocket broadcast <50ms
- ✅ Tests passing (100% coverage)

## Next Steps

- **Stream 1 Task 2**: Permission gates integration
- **Stream 1 Task 3**: Budget tracking visualization
- **Stream 1 Task 4**: Audit trail streaming

## References

- Phase 2 RBAC Hooks: `hooks/12fa/agent-mcp-access-control.js`
- Backend API: `backend/app/main.py`
- WebSocket Broadcaster: `backend/app/websocket/notification_broadcaster.py`
- Hook Configuration: `hooks/hooks.json`
