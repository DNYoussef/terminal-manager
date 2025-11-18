# Memory MCP Tagging Protocol v2.0 - API Reference

**Complete API documentation for JavaScript and Python implementations**

---

## JavaScript API (`memory-mcp-tagging-protocol.js`)

### v1.0 API (Backward Compatible)

#### `taggedMemoryStore(agent, content, userMetadata)`

Create tagged memory with v1.0 metadata (WHO/WHEN/PROJECT/WHY).

**Parameters**:
- `agent` (string): Agent name ('coder', 'reviewer', etc.)
- `content` (string): Content to store
- `userMetadata` (object, optional): Additional metadata

**Returns**: `{ text: string, metadata: object }`

**Example**:
```javascript
const tagged = taggedMemoryStore('coder', 'Implemented feature', {
  task_id: 'TASK-123',
  intent: 'implementation'
});
```

---

#### `createEnrichedMetadata(agent, content, context)`

Build v1.0 metadata structure.

**Parameters**:
- `agent` (string): Agent name
- `content` (string): Content text
- `context` (object): User-provided context

**Returns**: Metadata object with WHO/WHEN/PROJECT/WHY fields

---

#### `batchTaggedMemoryWrites(agent, writes)`

Batch multiple memory writes with tagging.

**Parameters**:
- `agent` (string): Agent name
- `writes` (array): Array of { content, metadata } objects

**Returns**: Array of tagged objects

---

#### `generateMemoryMCPCall(agent, content, metadata)`

Generate MCP tool call structure.

**Parameters**:
- `agent` (string): Agent name
- `content` (string): Content to store
- `metadata` (object): Additional metadata

**Returns**: `{ tool: 'memory_store', server: 'memory-mcp', arguments: {...} }`

---

#### `validateAgentAccess(agent, server)`

Check if agent has access to MCP server.

**Parameters**:
- `agent` (string): Agent name
- `server` (string): MCP server name (default: 'memory-mcp')

**Returns**: `boolean`

---

#### `hookAutoTag(hookEvent)`

Auto-tag on post-edit hook events.

**Parameters**:
- `hookEvent` (object): `{ agent, file, operation, content }`

**Returns**: Tagged object or null if no access

---

### v2.0 API (Agent Reality Map)

#### `taggedMemoryStoreV2(agent, content, userMetadata)`

Create tagged memory with v2.0 metadata (v1.0 + IDENTITY/BUDGET/QUALITY/ARTIFACTS/PERFORMANCE).

**Parameters**:
- `agent` (string): Agent name
- `content` (string): Content to store
- `userMetadata` (object): Agent Reality Map metadata

**User Metadata Schema**:
```javascript
{
  // Optional overrides
  task_id: 'TASK-123',
  intent: 'implementation',

  // Quality tracking
  quality: {
    score: 85,              // Connascence score (0-100)
    violations: []          // Array of violation strings
  },

  // Artifact tracking
  files_created: ['src/new.js'],
  files_modified: ['src/app.js'],
  tools_used: ['Write', 'Edit'],
  apis_called: ['github', 'memory-mcp'],

  // Performance tracking
  execution_time_ms: 1500,
  success: true,
  error: null
}
```

**Returns**: `{ text: string, metadata: object }`

**Example**:
```javascript
const tagged = taggedMemoryStoreV2('coder', 'Implemented auth', {
  quality: { score: 85, violations: [] },
  files_created: ['src/auth.js'],
  execution_time_ms: 1500,
  success: true
});

console.log(tagged.metadata.identity.agent_id);  // UUID from registry
console.log(tagged.metadata.budget.cost_usd);    // Live budget data
console.log(tagged.metadata.quality.code_quality_grade);  // "B" (from score 85)
console.log(tagged.metadata._schema_version);    // "2.0"
```

---

#### `createAgentRealityMapMetadata(agent, content, context)`

Build v2.0 metadata structure.

**Parameters**:
- `agent` (string): Agent name
- `content` (string): Content text
- `context` (object): User context with quality/artifacts/performance

**Returns**: Metadata object with all v2.0 fields

---

#### `getAgentIdentity(agent)`

Lookup agent identity from registry.

**Parameters**:
- `agent` (string): Agent name

**Returns**: `{ agent_id, role, capabilities, rbac_level }` or `null`

**Example**:
```javascript
const identity = getAgentIdentity('coder');
// {
//   agent_id: '62af40bf-feed-4249-9e71-759b938f530c',
//   role: 'developer',
//   capabilities: ['coding', 'api-design'],
//   rbac_level: 8
// }
```

---

#### `getBudgetMetadata(agent)`

Get live budget status for agent.

**Parameters**:
- `agent` (string): Agent name

**Returns**: `{ tokens_used, cost_usd, remaining_budget, budget_status }` or `null`

**Example**:
```javascript
const budget = getBudgetMetadata('coder');
// {
//   tokens_used: 5000,
//   cost_usd: 0.075,
//   remaining_budget: 29.925,
//   budget_status: 'ok'  // 'ok' | 'warning' | 'limit'
// }
```

---

#### `getQualityMetadata(context)`

Calculate quality metadata from context.

**Parameters**:
- `context` (object): Must have `quality: { score, violations }`

**Returns**: `{ connascence_score, code_quality_grade, violations }` or `null`

**Example**:
```javascript
const quality = getQualityMetadata({
  quality: { score: 85, violations: ['CoP: 8 params'] }
});
// {
//   connascence_score: 85,
//   code_quality_grade: 'B',
//   violations: ['CoP: 8 params']
// }
```

---

#### `getArtifactMetadata(context)`

Extract artifact metadata from context.

**Parameters**:
- `context` (object): May have files_created, files_modified, tools_used, apis_called

**Returns**: `{ files_created, files_modified, tools_used, apis_called }`

**Example**:
```javascript
const artifacts = getArtifactMetadata({
  files_created: ['src/auth.js'],
  tools_used: ['Write', 'Edit']
});
// {
//   files_created: ['src/auth.js'],
//   files_modified: [],
//   tools_used: ['Write', 'Edit'],
//   apis_called: []
// }
```

---

#### `getPerformanceMetadata(context)`

Extract performance metadata from context.

**Parameters**:
- `context` (object): May have execution_time_ms, success, error

**Returns**: `{ execution_time_ms, success, error }`

**Example**:
```javascript
const performance = getPerformanceMetadata({
  execution_time_ms: 1500,
  success: true
});
// {
//   execution_time_ms: 1500,
//   success: true,
//   error: null
// }
```

---

#### `getRBACLevel(role)`

Map RBAC role to permission level (1-10).

**Parameters**:
- `role` (string): RBAC role name

**Returns**: `number` (1-10)

**Mapping**:
| Role | Level |
|------|-------|
| admin | 10 |
| coordinator | 8 |
| developer | 8 |
| backend | 7 |
| security | 7 |
| database | 7 |
| reviewer | 6 |
| frontend | 6 |
| tester | 6 |
| analyst | 5 |

**Example**:
```javascript
const level = getRBACLevel('developer');  // 8
```

---

### Constants

#### `AGENT_TOOL_ACCESS`

Agent-to-MCP server access control matrix.

**Structure**:
```javascript
{
  'coder': { mcpServers: ['memory-mcp', 'connascence-analyzer'], category: 'code-quality' },
  'reviewer': { mcpServers: ['memory-mcp', 'connascence-analyzer'], category: 'code-quality' },
  'planner': { mcpServers: ['memory-mcp'], category: 'planning' }
}
```

---

#### `MEMORY_NAMESPACES`

Agent Reality Map namespaces for Memory MCP.

**Structure**:
```javascript
{
  AGENT_IDENTITIES: 'agent-reality-map/identities',
  AGENT_BUDGETS: 'agent-reality-map/budgets',
  AGENT_PERMISSIONS: 'agent-reality-map/permissions',
  AGENT_AUDIT_TRAILS: 'agent-reality-map/audit-trails',
  AGENT_QUALITY: 'agent-reality-map/quality',
  AGENT_ARTIFACTS: 'agent-reality-map/artifacts'
}
```

---

### Utilities

#### `budgetTrackerAvailable`

Boolean indicating if budget tracker is loaded.

**Type**: `boolean`

---

#### `identityRegistryAvailable`

Boolean indicating if agent identity registry is loaded.

**Type**: `boolean`

---

## Python API (`memory_mcp_client.py`)

### Class: `MemoryMCPClient`

#### `__init__(server_path=None)`

Initialize Memory MCP client.

**Parameters**:
- `server_path` (str, optional): Path to Memory MCP server (auto-detected if None)

**Example**:
```python
client = MemoryMCPClient()
```

---

#### `store(agent, content, metadata=None)`

Store content with v1.0 metadata.

**Parameters**:
- `agent` (str): Agent name
- `content` (str): Content to store
- `metadata` (dict, optional): Additional metadata

**Returns**: `dict` with storage confirmation

**Example**:
```python
result = client.store('coder', 'Implemented feature', {
    'project': 'terminal-manager',
    'intent': 'implementation',
    'task_id': 'TASK-123'
})
```

---

#### `store_v2(agent, content, metadata=None)`

Store content with v2.0 Agent Reality Map metadata.

**Parameters**:
- `agent` (str): Agent name
- `content` (str): Content to store
- `metadata` (dict): Agent Reality Map metadata

**Metadata Schema**:
```python
{
    # Identity (optional, auto-loaded if available)
    'identity': {
        'agent_id': 'uuid',
        'role': 'developer',
        'capabilities': ['coding', 'api-design'],
        'rbac_level': 8
    },

    # Budget (optional, auto-loaded if available)
    'budget': {
        'tokens_used': 5000,
        'cost_usd': 0.075,
        'remaining_budget': 29.925,
        'budget_status': 'ok'
    },

    # Quality tracking
    'quality': {
        'connascence_score': 85,
        'code_quality_grade': 'B',
        'violations': []
    },

    # Artifact tracking
    'artifacts': {
        'files_created': ['src/auth.js'],
        'files_modified': ['src/app.js'],
        'tools_used': ['Write', 'Edit'],
        'apis_called': ['github']
    },

    # Performance tracking
    'performance': {
        'execution_time_ms': 1500,
        'success': True,
        'error': None
    }
}
```

**Returns**: `dict` with storage confirmation + schema_version: "2.0"

**Example**:
```python
result = client.store_v2('coder', 'Implemented auth', {
    'quality': {
        'connascence_score': 85,
        'violations': []
    },
    'artifacts': {
        'files_created': ['src/auth.js']
    },
    'performance': {
        'execution_time_ms': 1500,
        'success': True
    }
})

print(result['schema_version'])  # "2.0"
```

---

#### `search(query, limit=None, mode=None, filters=None)`

Semantic search with mode-aware configuration and Agent Reality Map filters.

**Parameters**:
- `query` (str): Natural language query
- `limit` (int, optional): Max results (auto from mode if None)
- `mode` (str, optional): 'execution' | 'planning' | 'brainstorming' (auto-detected if None)
- `filters` (dict, optional): Agent Reality Map filters

**Filter Schema**:
```python
{
    # Identity filters
    'role': 'developer',              # Filter by RBAC role
    'agent_id': 'uuid',               # Filter by specific agent UUID
    'rbac_level_min': 6,              # Minimum permission level

    # Budget filters
    'budget_status': 'ok',            # 'ok' | 'warning' | 'limit'

    # Quality filters
    'quality_grade': 'A',             # 'A' | 'B' | 'C' | 'D' | 'F'
    'min_quality_score': 80,          # Minimum connascence score (0-100)

    # Performance filters
    'success_only': True              # Only successful operations
}
```

**Returns**: `list` of matching results with scores

**Example**:
```python
# Auto-detect mode from query
results = client.search('auth implementation')

# Override mode
results = client.search('auth implementation', mode='execution')

# Apply filters
results = client.search('auth implementation', filters={
    'role': 'developer',
    'min_quality_score': 80,
    'success_only': True
})

# Combine all parameters
results = client.search(
    query='auth implementation',
    limit=10,
    mode='execution',
    filters={
        'role': 'developer',
        'quality_grade': 'A',
        'budget_status': 'ok'
    }
)
```

---

### Private Methods

#### `_build_metadata(agent, content, user_metadata)`

Build v1.0 metadata (WHO/WHEN/PROJECT/WHY).

---

#### `_build_metadata_v2(agent, content, user_metadata)`

Build v2.0 metadata (v1.0 + Agent Reality Map extensions).

---

#### `_build_search_filters(filters)`

Convert filter dict to Memory MCP search filter format.

---

#### `_detect_mode(query)`

Auto-detect interaction mode from query keywords.

**Returns**: `'execution'` | `'planning'` | `'brainstorming'`

---

#### `_get_mode_config(mode)`

Get search configuration for interaction mode.

**Returns**:
```python
{
    'limit': 5,          # execution: 5, planning: 20, brainstorming: 30
    'threshold': 0.85    # execution: 0.85, planning: 0.65, brainstorming: 0.50
}
```

---

#### `_get_agent_category(agent)`

Map agent to category (code-quality, planning, general).

---

## Quality Grade Calculation

Connascence score (0-100) maps to letter grades:

| Score Range | Grade |
|-------------|-------|
| 90-100 | A |
| 80-89 | B |
| 70-79 | C |
| 60-69 | D |
| 0-59 | F |

**Implementation**:
```javascript
function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
```

---

## Budget Status Values

| Status | Meaning |
|--------|---------|
| `ok` | Within budget limits |
| `warning` | Approaching limits (80-95%) |
| `limit` | Budget exceeded |
| `unknown` | Budget tracker unavailable |

---

## Error Handling

### JavaScript

All v2.0 functions gracefully degrade:
- Missing budget tracker: Uses default budget metadata
- Missing identity registry: Uses default identity metadata
- Missing context fields: Uses safe defaults

No exceptions thrown for missing dependencies.

### Python

All methods handle missing data:
- Missing metadata keys: Default values used
- Invalid filter keys: Ignored silently
- MCP server unavailable: Returns empty results

---

## Performance Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| `taggedMemoryStore` | <20ms | <15ms |
| `taggedMemoryStoreV2` | <25ms | <18ms |
| `getAgentIdentity` | <5ms | <3ms |
| `getBudgetMetadata` | <10ms | <8ms |
| `getQualityMetadata` | <1ms | <1ms |

---

## Version Detection

Check schema version in metadata:

```javascript
const tagged = taggedMemoryStoreV2('coder', 'content');
if (tagged.metadata._schema_version === '2.0') {
  // v2.0 metadata available
}
```

```python
result = client.store_v2('coder', 'content')
if result.get('schema_version') == '2.0':
    # v2.0 metadata available
```

---

## Migration Checklist

Upgrading from v1.0 to v2.0:

- [ ] Replace `taggedMemoryStore` with `taggedMemoryStoreV2`
- [ ] Add quality tracking: `quality: { score, violations }`
- [ ] Add artifact tracking: `files_created, files_modified, tools_used`
- [ ] Add performance tracking: `execution_time_ms, success, error`
- [ ] Update tests to check `_schema_version === "2.0"`
- [ ] Verify backward compatibility (v1.0 still works)
- [ ] Update search filters to use Agent Reality Map fields

---

## Complete Example (JavaScript)

```javascript
const {
  taggedMemoryStoreV2,
  getAgentIdentity,
  getBudgetMetadata
} = require('./memory-mcp-tagging-protocol.js');

// Track full task lifecycle
const startTime = Date.now();
const filesCreated = [];
const filesModified = [];

try {
  // Do work
  await Write('src/auth.js', authCode);
  filesCreated.push('src/auth.js');

  await Edit('src/app.js', oldStr, newStr);
  filesModified.push('src/app.js');

  // Run quality check
  const connascenceResults = await runConnascenceAnalysis();

  // Tag with full metadata
  const tagged = taggedMemoryStoreV2('coder', 'Implemented auth feature', {
    task_id: 'AUTH-123',
    quality: {
      score: connascenceResults.overallScore,
      violations: connascenceResults.violations
    },
    files_created: filesCreated,
    files_modified: filesModified,
    tools_used: ['Write', 'Edit'],
    apis_called: ['github', 'connascence-analyzer'],
    execution_time_ms: Date.now() - startTime,
    success: true,
    error: null
  });

  // Verify metadata
  console.log('Agent ID:', tagged.metadata.identity.agent_id);
  console.log('Budget remaining:', tagged.metadata.budget.remaining_budget);
  console.log('Quality grade:', tagged.metadata.quality.code_quality_grade);
  console.log('Schema version:', tagged.metadata._schema_version);  // "2.0"

} catch (err) {
  // Tag failure
  const tagged = taggedMemoryStoreV2('coder', 'Auth implementation failed', {
    task_id: 'AUTH-123',
    execution_time_ms: Date.now() - startTime,
    success: false,
    error: err.message
  });
}
```

---

## Complete Example (Python)

```python
from app.services.memory_mcp_client import MemoryMCPClient
import time

client = MemoryMCPClient()

# Track task lifecycle
start_time = time.time()
files_created = []
files_modified = []

try:
    # Do work
    write_file('src/auth.py', auth_code)
    files_created.append('src/auth.py')

    edit_file('src/app.py', old_str, new_str)
    files_modified.append('src/app.py')

    # Run quality check
    connascence_results = run_connascence_analysis()

    # Store with v2.0 metadata
    result = client.store_v2('coder', 'Implemented auth feature', {
        'quality': {
            'connascence_score': connascence_results['overall_score'],
            'violations': connascence_results['violations']
        },
        'artifacts': {
            'files_created': files_created,
            'files_modified': files_modified,
            'tools_used': ['Write', 'Edit'],
            'apis_called': ['github', 'connascence-analyzer']
        },
        'performance': {
            'execution_time_ms': int((time.time() - start_time) * 1000),
            'success': True,
            'error': None
        }
    })

    # Verify metadata
    print('Schema version:', result['schema_version'])  # "2.0"

    # Search with filters
    results = client.search('auth implementation', filters={
        'role': 'developer',
        'min_quality_score': 80,
        'success_only': True
    })

except Exception as err:
    # Store failure
    result = client.store_v2('coder', 'Auth implementation failed', {
        'performance': {
            'execution_time_ms': int((time.time() - start_time) * 1000),
            'success': False,
            'error': str(err)
        }
    })
```

---

**For more examples, see**: `USAGE-GUIDE-V2.md` and test suite `test-memory-mcp-integration.js`
