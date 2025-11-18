# Memory MCP v2.0 - Quick Start Guide

**For developers integrating Agent Reality Map metadata into their agents**

---

## Basic Usage (v1.0 - Still Supported)

```javascript
const { taggedMemoryStore } = require('./memory-mcp-tagging-protocol.js');

// Simple tagging (v1.0)
const tagged = taggedMemoryStore('coder', 'Implemented feature X', {
  task_id: 'TASK-123',
  intent: 'implementation'
});

// Tagged object has WHO/WHEN/PROJECT/WHY metadata
```

---

## Enhanced Usage (v2.0 - Recommended)

```javascript
const { taggedMemoryStoreV2 } = require('./memory-mcp-tagging-protocol.js');

// Full Agent Reality Map compliance
const tagged = taggedMemoryStoreV2('coder', 'Implemented auth feature', {
  // Context you provide
  task_id: 'AUTH-123',
  intent: 'implementation',

  // Quality metrics (from Connascence analyzer)
  quality: {
    score: 85,
    violations: ['CoP: 8 params in validateUser()']
  },

  // Artifacts tracking
  files_created: ['src/auth.js', 'tests/auth.test.js'],
  files_modified: ['src/app.js'],
  tools_used: ['Write', 'Edit', 'Bash'],
  apis_called: ['github', 'memory-mcp'],

  // Performance tracking
  execution_time_ms: 1500,
  success: true,
  error: null
});

// Metadata automatically includes:
// - IDENTITY: Agent UUID, role, RBAC level (from agent registry)
// - BUDGET: Token usage, cost, remaining budget (from budget tracker)
// - QUALITY: Letter grade calculated from score (85 = "B")
// - ARTIFACTS: Your provided file/tool/API tracking
// - PERFORMANCE: Your provided execution metrics
```

---

## Minimal v2.0 Usage (Auto-populated)

If you don't provide quality/artifacts/performance, they default to safe values:

```javascript
const tagged = taggedMemoryStoreV2('coder', 'Quick task', {
  task_id: 'QUICK-123'
});

// Automatically includes:
// - IDENTITY: Loaded from agent registry
// - BUDGET: Live data from budget tracker
// - QUALITY: { score: 0, grade: "N/A", violations: [] }
// - ARTIFACTS: { files_created: [], files_modified: [], tools_used: [], apis_called: [] }
// - PERFORMANCE: { execution_time_ms: 0, success: true, error: null }
```

---

## Python Backend Usage

```python
from app.services.memory_mcp_client import MemoryMCPClient

client = MemoryMCPClient()

# Store with v2.0 metadata
result = client.store_v2('coder', 'Implemented feature', {
    'quality': {
        'connascence_score': 85,
        'violations': []
    },
    'artifacts': {
        'files_created': ['src/feature.js'],
        'tools_used': ['Write', 'Edit']
    },
    'performance': {
        'execution_time_ms': 1500,
        'success': True
    }
})

# Search with filters
results = client.search('feature implementation', filters={
    'role': 'developer',
    'min_quality_score': 80,
    'success_only': True
})
```

---

## When to Use v1.0 vs v2.0

### Use v1.0 (`taggedMemoryStore`) when:
- Quick prototyping
- No quality/performance tracking needed
- Backward compatibility required
- Simple logging use case

### Use v2.0 (`taggedMemoryStoreV2`) when:
- Agent Reality Map compliance needed
- Budget enforcement active
- Quality gates in use
- Performance monitoring required
- Audit trail important
- Production environments

---

## Common Patterns

### Pattern 1: Track Code Quality

```javascript
const { taggedMemoryStoreV2 } = require('./memory-mcp-tagging-protocol.js');

// After Connascence analysis
const connascenceResults = runConnascenceAnalysis('src/feature.js');

const tagged = taggedMemoryStoreV2('coder', 'Code quality check', {
  quality: {
    score: connascenceResults.overallScore,  // 0-100
    violations: connascenceResults.violations  // Array of violations
  },
  files_modified: ['src/feature.js']
});
// Grade automatically calculated (85 = "B")
```

### Pattern 2: Track Budget Usage

```javascript
// Budget automatically tracked if budget tracker available
const startTime = Date.now();

// ... do work ...

const tagged = taggedMemoryStoreV2('coder', 'Completed task', {
  performance: {
    execution_time_ms: Date.now() - startTime,
    success: true
  }
});

// Budget metadata automatically included from budget tracker
```

### Pattern 3: Track Artifacts

```javascript
const filesCreated = [];
const filesModified = [];
const toolsUsed = new Set();

// Track as you work
await Write('src/new.js', content);
filesCreated.push('src/new.js');
toolsUsed.add('Write');

await Edit('src/existing.js', oldStr, newStr);
filesModified.push('src/existing.js');
toolsUsed.add('Edit');

// Tag with artifacts
const tagged = taggedMemoryStoreV2('coder', 'Built feature', {
  files_created: filesCreated,
  files_modified: filesModified,
  tools_used: Array.from(toolsUsed)
});
```

### Pattern 4: Error Tracking

```javascript
try {
  // ... risky operation ...

  const tagged = taggedMemoryStoreV2('coder', 'Operation succeeded', {
    performance: {
      execution_time_ms: elapsed,
      success: true,
      error: null
    }
  });
} catch (err) {
  const tagged = taggedMemoryStoreV2('coder', 'Operation failed', {
    performance: {
      execution_time_ms: elapsed,
      success: false,
      error: err.message
    }
  });
}
```

---

## Vector Search Filters

```python
# Filter by role
results = client.search(query, filters={'role': 'developer'})

# Filter by budget status
results = client.search(query, filters={'budget_status': 'ok'})

# Filter by quality
results = client.search(query, filters={
    'min_quality_score': 80,
    'quality_grade': 'A'
})

# Filter by success
results = client.search(query, filters={'success_only': True})

# Combine filters
results = client.search(query, filters={
    'role': 'developer',
    'min_quality_score': 70,
    'success_only': True,
    'budget_status': 'ok'
})
```

---

## Graceful Degradation

v2.0 works even if dependencies unavailable:

```javascript
// Budget tracker not available?
// - BUDGET metadata uses defaults: { tokens_used: 0, cost_usd: 0, ... }

// Agent identity registry not available?
// - IDENTITY metadata uses defaults: { agent_id: null, role: 'developer', ... }

// You don't provide quality/artifacts/performance?
// - Safe defaults used: { score: 0, grade: "N/A", files_created: [], ... }
```

---

## Migration Path (v1.0 → v2.0)

### Step 1: Dual API Period
Keep using v1.0, test v2.0 in parallel:

```javascript
const v1Tagged = taggedMemoryStore('coder', content);        // Keep existing
const v2Tagged = taggedMemoryStoreV2('coder', content);      // Test new
```

### Step 2: Gradual Adoption
Add v2.0 fields incrementally:

```javascript
// Week 1: Add quality tracking
const tagged = taggedMemoryStoreV2('coder', content, {
  quality: { score: 85 }
});

// Week 2: Add artifacts tracking
const tagged = taggedMemoryStoreV2('coder', content, {
  quality: { score: 85 },
  files_created: ['src/new.js']
});

// Week 3: Add performance tracking
const tagged = taggedMemoryStoreV2('coder', content, {
  quality: { score: 85 },
  files_created: ['src/new.js'],
  execution_time_ms: 1500
});
```

### Step 3: Full v2.0
Use all Agent Reality Map fields:

```javascript
const tagged = taggedMemoryStoreV2('coder', content, {
  quality: { score: 85, violations: [] },
  files_created: ['src/new.js'],
  files_modified: ['src/app.js'],
  tools_used: ['Write', 'Edit'],
  apis_called: ['github'],
  execution_time_ms: 1500,
  success: true
});
```

---

## Troubleshooting

### "Budget tracker not available"
- Budget metadata will use defaults (tokens_used: 0, cost_usd: 0)
- No impact on functionality, just missing live budget data

### "Agent identity registry not available"
- Identity metadata will use defaults (agent_id: null, role: 'developer')
- No impact on functionality, just missing agent UUID

### "Quality grade showing N/A"
- Provide `quality: { score: 85 }` in context
- Grade auto-calculated from score (85 = "B")

### "Artifacts not tracking"
- Provide file/tool/API tracking in context:
  ```javascript
  files_created: ['src/new.js'],
  tools_used: ['Write', 'Edit']
  ```

---

## Testing

Run test suite to verify v2.0 integration:

```bash
node hooks/12fa/utils/test-memory-mcp-integration.js
```

Expected output:
- 20 tests total
- 14 v1.0 tests (budget persistence)
- 6 v2.0 tests (Agent Reality Map)

All tests should pass with graceful degradation if dependencies unavailable.

---

## Reference

**Full Schema**: See `MEMORY-MCP-V2-SUMMARY.md`
**API Docs**: See `memory-mcp-tagging-protocol.js` JSDoc comments
**Agent Registry**: `agents/identity/agent-identity-registry.json`
**Budget Tracker**: `hooks/12fa/utils/budget-tracker.js`

---

**Questions?** Check the test suite for working examples of all v2.0 features.
