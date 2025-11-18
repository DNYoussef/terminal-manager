# Structured Logging System v2.0

Production-grade structured logging with agent context, correlation IDs, RBAC integration, and comprehensive observability.

## Overview

The Structured Logging System provides:
- **Agent Context**: Every log includes agent identity from Agent Reality Map
- **Correlation IDs**: Track operations across multiple agents and hooks
- **RBAC Integration**: Log all authorization decisions
- **Performance Metrics**: Track execution time, tokens, cost, memory
- **Multiple Transports**: Console, file, database, memory
- **Log Rotation**: Automatic daily rotation with compression
- **Query API**: REST endpoints for searching and filtering logs
- **Dashboard Integration**: Real-time log viewer in frontend

## Architecture

```
User Request
    |
    v
Agent (with identity) -> Structured Logger
    |                         |
    |                         +-> Console Transport (development)
    |                         +-> File Transport (production)
    |                         +-> Memory Transport (dashboard)
    |                         +-> Database Transport (critical errors)
    |
    v
Log Entry with Full Context:
  - Agent identity
  - Correlation ID
  - RBAC decision
  - Performance metrics
  - Error details
```

## Log Entry Schema

```javascript
{
  timestamp: "2025-11-17T20:30:45.123Z",
  level: "INFO" | "WARN" | "ERROR" | "FATAL" | "DEBUG",
  message: "Agent completed task successfully",

  // Agent Context (from Agent Reality Map)
  agent: {
    agent_id: "uuid-v4",
    name: "backend-dev",
    role: "developer",
    category: "delivery"
  },

  // Execution Context
  execution: {
    correlation_id: "uuid-v4",  // Trace across multiple agents
    session_id: "uuid-v4",      // User session
    task_id: "AUTH-123",        // Specific task
    operation: "file_write",    // What was being done
    target: "src/api/users.js"  // What was being operated on
  },

  // Performance Metrics
  metrics: {
    execution_time_ms: 1234,
    tokens_used: 5678,
    cost_usd: 0.12,
    memory_mb: 245
  },

  // RBAC Context (from RBAC Engine)
  rbac: {
    decision: "allowed" | "denied" | "requires_approval",
    permission_checked: "Write",
    reason: null | string
  },

  // Error Details (if error)
  error: {
    name: "PermissionDeniedError",
    message: "Agent not authorized for operation",
    stack: "...",
    code: "RBAC_DENIED"
  },

  // Quality Context (from Quality Score Service)
  quality: {
    score: 85,
    grade: "B",
    violations: []
  }
}
```

## Usage

### Basic Logging

```javascript
const { getLogger } = require('./utils/structured-logger');

const logger = getLogger();

logger.debug('Debug information');
logger.info('Operation started');
logger.warn('Deprecated API used');
logger.error('Operation failed', { error: new Error('Details') });
logger.fatal('System critical failure');
```

### With Agent Context

```javascript
const agentIdentity = {
  agent_id: 'agent-123',
  name: 'backend-dev',
  role: 'developer',
  category: 'delivery'
};

const agentLogger = logger.withAgent(agentIdentity);
agentLogger.info('Agent started task');
```

### With Correlation ID

```javascript
const correlationId = 'trace-abc-123';
const correlatedLogger = logger.withCorrelationId(correlationId);

correlatedLogger.info('Step 1: Initialize');
correlatedLogger.info('Step 2: Process');
correlatedLogger.info('Step 3: Complete');

// Later, query all logs for this correlation ID
const trace = logger.queryLogs({ correlation_id: correlationId });
```

### With Performance Metrics

```javascript
const startTime = Date.now();

// ... perform operation ...

const metrics = {
  execution_time_ms: Date.now() - startTime,
  tokens_used: 1234,
  cost_usd: 0.05
};

logger.withMetrics(metrics).info('Operation completed');
```

### Combined Context

```javascript
const contextLogger = logger
  .withAgent(agentIdentity)
  .withCorrelationId(correlationId)
  .withMetrics(metrics);

contextLogger.info('Complete operation', {
  operation: 'file_write',
  target: 'src/api/users.js',
  rbac: { decision: 'allowed', permission_checked: 'Write' }
});
```

## Integration Points

### 1. RBAC Engine Integration

```javascript
const { getLogger } = require('./utils/structured-logger');

async function checkPermission(agent, permission, target) {
  const logger = getLogger().withAgent(agent);

  const decision = await rbacEngine.check(agent, permission, target);

  logger.info('RBAC decision', {
    operation: 'rbac_check',
    target: target,
    rbac: {
      decision: decision.allowed ? 'allowed' : 'denied',
      permission_checked: permission,
      reason: decision.reason
    }
  });

  return decision;
}
```

### 2. Hook Integration

```javascript
// pre-task.hook.js
const { getLogger } = require('./utils/structured-logger');
const { getOrCreate } = require('./correlation-id-manager');

async function preTask(agentIdentity, taskDescription) {
  const correlationId = getOrCreate(taskDescription);

  const logger = getLogger()
    .withAgent(agentIdentity)
    .withCorrelationId(correlationId);

  logger.info('Task started', {
    operation: 'pre_task',
    task_id: taskDescription
  });

  // ... rest of hook logic ...
}
```

### 3. Error Handling

```javascript
try {
  await performOperation();
} catch (error) {
  logger.error('Operation failed', {
    error: error,
    operation: 'perform_operation',
    target: 'some/file.js',
    rbac: { decision: 'allowed', permission_checked: 'Execute' }
  });

  throw error;
}
```

## Backend API

### Query Logs

```bash
# Get logs with filters
GET /api/v1/logs/query?level=ERROR&agent_name=backend-dev&limit=50

# Get logs by correlation ID
GET /api/v1/logs/correlation/{correlation_id}

# Get recent errors
GET /api/v1/logs/errors/recent?hours=24&limit=50
```

### Export Logs

```bash
# Export as JSON
GET /api/v1/logs/export?filename=hooks-2025-11-17.log&format=json

# Export as CSV
GET /api/v1/logs/export?filename=hooks-2025-11-17.log&format=csv
```

### Log Rotation

```bash
# Manually trigger rotation
POST /api/v1/logs/rotate

# Get rotation stats
GET /api/v1/logs/stats
```

## Log Rotation

### Automatic Rotation

Logs rotate automatically when:
- **Daily**: New file created at midnight
- **Size**: File exceeds 100MB
- **Age**: Files older than 30 days are deleted

### Compression

Old log files are automatically compressed with gzip:
```
hooks-2025-11-16.log -> hooks-2025-11-16.log.gz
```

### Cleanup

Files older than 30 days are automatically deleted during rotation.

## Performance

### Benchmarks

- **Logging Overhead**: <0.01ms per entry
- **Memory Buffer**: Last 1000 entries (O(1) access)
- **File Write**: Async, non-blocking
- **Query Performance**: <50ms for 10,000 entries

### Optimization Tips

1. **Use appropriate log levels**:
   - DEBUG: Development only
   - INFO: Normal operations
   - WARN: Potential issues
   - ERROR: Failures that need attention
   - FATAL: Critical system failures

2. **Batch log queries**:
   ```javascript
   // Bad: Query multiple times
   const logs1 = logger.queryLogs({ level: 'ERROR' });
   const logs2 = logger.queryLogs({ agent_name: 'backend-dev' });

   // Good: Use broader query with filtering
   const logs = logger.queryLogs({ limit: 1000 });
   const errors = logs.filter(l => l.level === 'ERROR');
   const agentLogs = logs.filter(l => l.agent.name === 'backend-dev');
   ```

3. **Use correlation IDs** to trace operations instead of querying by timestamp.

## Frontend Integration

### Log Viewer Component

```tsx
import LogViewer from './components/logging/LogViewer';

function Dashboard() {
  return (
    <div>
      <LogViewer apiBaseUrl="http://localhost:8000/api/v1" />
    </div>
  );
}
```

### Features

- **Real-time filtering**: By level, agent, correlation ID
- **Search**: Free-text search across all fields
- **Export**: Download logs as JSON or CSV
- **Copy to clipboard**: Quick copying of log entries
- **Details modal**: View full log entry with formatting

## Configuration

### Logger Configuration

```javascript
const logger = new StructuredLogger({
  level: 'INFO',                          // Minimum level to log
  transports: ['console', 'file', 'memory'], // Active transports
  prettyPrint: false,                     // JSON pretty-print (dev only)
  includeStack: true                      // Include stack traces in errors
});
```

### File Transport Configuration

```javascript
const fileTransport = new FileTransport({
  directory: 'logs',      // Log directory
  filename: 'hooks',      // Base filename
  maxSizeMB: 100,         // Max file size before rotation
  maxFiles: 30,           // Max number of files to keep
  compress: true          // Compress rotated files
});
```

### Environment Variables

```bash
# Log level (default: INFO)
LOG_LEVEL=DEBUG

# Log directory (default: ./logs)
LOG_DIR=/var/log/hooks

# Enable pretty-print (default: false in production)
LOG_PRETTY_PRINT=true
```

## Troubleshooting

### Logs Not Appearing

1. **Check log level**: Ensure logger level allows the message
   ```javascript
   logger.config.level = 'DEBUG'; // Allow all logs
   ```

2. **Check transports**: Verify transports are enabled
   ```javascript
   logger.config.transports; // Should include 'console' or 'file'
   ```

3. **Check permissions**: Ensure write access to log directory
   ```bash
   ls -la logs/
   ```

### Log File Growing Too Large

1. **Manually trigger rotation**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/logs/rotate
   ```

2. **Reduce retention period**:
   ```javascript
   fileTransport.config.maxFiles = 7; // Keep only 7 days
   ```

3. **Increase rotation size**:
   ```javascript
   fileTransport.config.maxSizeMB = 50; // Rotate at 50MB
   ```

### Performance Issues

1. **Reduce log level in production**:
   ```javascript
   logger.config.level = 'WARN'; // Only warnings and errors
   ```

2. **Disable memory transport** if not using dashboard:
   ```javascript
   logger.config.transports = ['console', 'file'];
   ```

3. **Disable stack traces** for non-critical logs:
   ```javascript
   logger.config.includeStack = false;
   ```

## Testing

Run comprehensive test suite:

```bash
node hooks/12fa/tests/test-structured-logger.js
```

Tests cover:
- Basic logging functionality
- Agent context integration
- Correlation ID tracking
- RBAC context logging
- Performance metrics
- Error handling
- Log filtering
- Child logger inheritance
- Log statistics
- Memory buffer limits
- Query limits
- Performance benchmarks
- Time range filtering

## Best Practices

1. **Always use correlation IDs** for multi-step operations
2. **Include agent context** in all logs
3. **Log RBAC decisions** for audit trails
4. **Capture performance metrics** for slow operations
5. **Use appropriate log levels** (don't log everything as ERROR)
6. **Include operation and target** for file operations
7. **Use child loggers** for inherited context
8. **Query by correlation ID** instead of timestamps when tracing
9. **Export critical logs** for compliance and auditing
10. **Monitor log rotation** to prevent disk space issues

## Security Considerations

1. **Secrets Redaction**: Use `secrets-redaction.js` before logging
2. **PII Protection**: Never log sensitive user data
3. **Access Control**: Restrict log file access to authorized users
4. **Audit Logs**: RBAC decisions are automatically logged
5. **Retention**: Logs older than 30 days are automatically deleted

## Future Enhancements

- [ ] Elasticsearch integration for log aggregation
- [ ] Real-time log streaming via WebSockets
- [ ] Advanced log analysis with ML
- [ ] Automated anomaly detection
- [ ] Custom alert rules and notifications
- [ ] Log replay for debugging
- [ ] Integration with OpenTelemetry for distributed tracing

## Support

For issues or questions:
- Check troubleshooting section above
- Review test cases in `test-structured-logger.js`
- Consult backend API documentation at `/docs`

## Version History

### v2.0.0 (2025-11-17)
- Initial production release
- Agent Reality Map integration
- RBAC context logging
- Performance metrics tracking
- Multiple transport support
- Log rotation and compression
- Backend REST API
- Frontend log viewer
- Comprehensive test suite
