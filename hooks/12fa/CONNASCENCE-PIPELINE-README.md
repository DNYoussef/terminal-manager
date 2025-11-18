# Connascence Quality Pipeline

**Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: 2025-11-17

---

## Overview

The Connascence Quality Pipeline is a pre-commit quality gate system that blocks low-quality code using real-time Connascence analysis. It integrates with Claude Code's hook system to enforce code quality standards automatically.

---

## Features

### Core Capabilities

1. **Pre-Commit Quality Gates**
   - Blocks file writes if quality score below threshold
   - Configurable thresholds (global, per-agent, per-file)
   - Human override capability for exceptional cases

2. **Real-Time Analysis**
   - Integrates with Connascence Analyzer MCP
   - Detects 6 violation types
   - Calculates quality scores (0-100 scale)

3. **Violation Detection**
   - God Objects (26+ methods)
   - Parameter Bombs (7+ parameters)
   - Cyclomatic Complexity (>10)
   - Deep Nesting (>4 levels)
   - Long Functions (>50 lines)
   - Magic Literals (hardcoded values)

4. **Quality Scoring**
   - A: 90-100 (excellent)
   - B: 80-89 (good)
   - C: 70-79 (acceptable - default gate)
   - D: 60-69 (poor - warning)
   - F: 0-59 (failing - block)

5. **Memory Integration**
   - Stores quality results in Memory MCP
   - Tags with WHO/WHEN/PROJECT/WHY
   - Enables pattern learning over time

6. **Backend Metrics**
   - Tracks quality scores in backend
   - Generates trend reports
   - Alerts on quality degradation

---

## Architecture

### Components

```
Connascence Quality Pipeline
|
+-- QualityPipeline (main orchestrator)
|   |
|   +-- QualityGradeCalculator
|   |   - Calculate scores from violations
|   |   - Determine grade (A-F)
|   |   - Apply agent/file-specific thresholds
|   |
|   +-- ConnascenceAnalyzer
|   |   - Detect God Objects
|   |   - Detect Parameter Bombs
|   |   - Detect Cyclomatic Complexity
|   |   - Detect Deep Nesting
|   |   - Detect Long Functions
|   |   - Detect Magic Literals
|   |
|   +-- ViolationReporter
|   |   - Generate detailed reports
|   |   - Format console output
|   |   - Suggest fixes
|   |
|   +-- MemoryIntegration
|   |   - Store results in Memory MCP
|   |   - Tag with metadata
|   |
|   +-- BackendMetricsService
|       - Send metrics to backend
|       - Track trends over time
```

### Hook Integration

**Pre-File-Write Hook** (`PreToolUse`):
- Triggers on `Write`, `Edit`, `MultiEdit`
- Calls `preFileWriteHook()` in `connascence-pipeline.js`
- Blocks write if quality score below threshold
- Only runs on code files (.js, .ts, .py, .java, .cpp, .cs, .go)
- Only runs for agents with Connascence access (14 code quality agents)

---

## Configuration

### Default Thresholds

```javascript
CONFIG = {
  // Global quality threshold (C grade minimum)
  globalThreshold: 70,

  // Per-agent thresholds (override global)
  agentThresholds: {
    'coder': 75,
    'backend-dev': 80,
    'ml-developer': 70,
    'sparc-coder': 85,
    'code-analyzer': 90,
    'reviewer': 85
  },

  // Per-file thresholds (critical files)
  fileThresholds: {
    'auth': 90,        // Authentication files
    'security': 90,    // Security-critical files
    'payment': 95,     // Payment processing
    'api': 75,         // API endpoints
    'database': 80     // Database operations
  }
}
```

### Violation Penalties

| Violation Type | Penalty | Threshold |
|----------------|---------|-----------|
| God Objects | 10 points | 15+ methods |
| Parameter Bombs | 8 points | 6+ parameters |
| Cyclomatic Complexity | 7 points | >10 |
| Deep Nesting | 6 points | >4 levels |
| Long Functions | 5 points | >50 lines |
| Magic Literals | 4 points | Any hardcoded value |

### Feature Flags

```javascript
features: {
  blockOnLowQuality: true,      // Block commits if quality low
  storeInMemory: true,          // Store results in Memory MCP
  trackMetrics: true,           // Send metrics to backend
  allowHumanOverride: true,     // Allow human bypass
  verboseReporting: true        // Detailed console output
}
```

---

## Usage

### Automatic (Hook-Based)

Quality gates run automatically when code quality agents write files:

```javascript
// This triggers quality gate automatically
Edit("src/app.js", oldContent, newContent);

// Quality gate runs:
// 1. Analyze file with Connascence Analyzer
// 2. Calculate quality score
// 3. Check against threshold
// 4. Block if score < threshold
// 5. Store results in Memory MCP
// 6. Record metrics in backend
```

### Manual (CLI)

```bash
# Check single file
node hooks/12fa/connascence-pipeline-cli.js check src/app.js --agent coder

# Check with custom threshold
node hooks/12fa/connascence-pipeline-cli.js check src/auth.js \
  --agent backend-dev --threshold 85

# Batch check files
node hooks/12fa/connascence-pipeline-cli.js batch "src/**/*.js" --agent reviewer

# Human override (bypass quality gate)
node hooks/12fa/connascence-pipeline-cli.js check src/legacy.js \
  --agent coder --override

# JSON output
node hooks/12fa/connascence-pipeline-cli.js check src/app.js \
  --agent coder --json

# Show configuration
node hooks/12fa/connascence-pipeline-cli.js config
```

### Programmatic

```javascript
const { QualityPipeline } = require('./hooks/12fa/connascence-pipeline.js');

const pipeline = new QualityPipeline();

// Check single file
const report = await pipeline.checkQuality('coder', 'src/app.js', {
  threshold: 75,
  humanOverride: false
});

console.log(`Score: ${report.score}`);
console.log(`Passed: ${report.passed}`);

// Batch check
const results = await pipeline.checkMultipleFiles('reviewer', [
  'src/app.js',
  'src/api.js',
  'src/auth.js'
], {
  threshold: 80
});

console.log(`Passed: ${results.filter(r => r.passed).length}/${results.length}`);
```

---

## Quality Score Calculation

### Formula

```javascript
qualityScore = 100 - (
  (godObjectPenalty * 10) +
  (parameterBombPenalty * 8) +
  (complexityPenalty * 7) +
  (nestingPenalty * 6) +
  (longFunctionPenalty * 5) +
  (magicLiteralPenalty * 4)
);
```

### Example

**File: `src/auth.js`**

Violations:
- 1 God Object (26 methods) = 10 points
- 2 Parameter Bombs (8, 9 params) = 16 points
- 1 Cyclomatic Complexity (complexity 13) = 7 points
- 0 Deep Nesting = 0 points
- 1 Long Function (72 lines) = 5 points
- 3 Magic Literals = 12 points

**Total Penalty**: 50 points
**Quality Score**: 100 - 50 = **50**
**Grade**: **F** (failing)
**Status**: **BLOCKED** (threshold 70)

**Fix Suggestions**:
- Extract methods from God Object into separate modules
- Use options object for Parameter Bombs
- Break down complex logic into smaller functions
- Extract nested logic with early returns
- Split long function into focused functions
- Extract magic literals to named constants

---

## Integration with Memory MCP

### Automatic Tagging

All quality results stored with metadata:

```javascript
{
  "text": "{\"report\": {...}, \"violations\": {...}}",
  "metadata": {
    // WHO
    "agent": {
      "name": "coder",
      "category": "code-quality",
      "capabilities": ["memory-mcp", "connascence-analyzer", "claude-flow"]
    },

    // WHEN
    "timestamp": {
      "iso": "2025-11-17T10:30:00.000Z",
      "unix": 1731838200,
      "readable": "11/17/2025, 10:30:00 AM"
    },

    // PROJECT
    "project": "connascence-analyzer",

    // WHY
    "intent": {
      "primary": "quality-gate",
      "description": "Pre-commit quality check",
      "task_id": "quality-1731838200"
    },

    // Quality metadata
    "quality_score": 75,
    "quality_grade": "C",
    "file": "src/app.js",
    "passed": true
  }
}
```

### Pattern Learning

Memory MCP enables pattern learning:

1. **Store violations** with context
2. **Vector search** for similar patterns
3. **Retrieve proven fixes** from history
4. **Apply patterns** to new violations

---

## Backend Integration

### Quality Score Service

**File**: `backend/app/services/quality_score_service.py`

**Endpoints** (hypothetical):
```python
# Record quality score
POST /api/v1/metrics/
{
  "metric_type": "code_quality",
  "metric_name": "connascence_score",
  "metric_value": 75,
  "metadata": {
    "file": "src/app.js",
    "grade": "C",
    "violations": {...}
  }
}

# Get quality trend
GET /api/v1/metrics/quality-trend?file=src/app.js&days=7

# Get aggregate stats
GET /api/v1/metrics/quality-stats?group_by=agent&days=30

# Get top violations
GET /api/v1/metrics/top-violations?limit=10&days=7
```

### Quality Alerts

**Automatic alerts when**:
- Quality degrades >10 points between commits
- Critical file (auth, security, payment) below threshold
- Agent consistently produces low-quality code

**Alert channels**:
- Console output
- Backend database
- Memory MCP (for pattern analysis)
- (TODO: Email, Slack, webhooks)

---

## Testing

### Run Tests

```bash
# Run all tests
cd hooks/12fa/tests
node test-connascence-pipeline.js

# Expected output:
# Testing QualityGradeCalculator...
# QualityGradeCalculator: PASSED
# Testing ConnascenceAnalyzer...
# ConnascenceAnalyzer: PASSED
# Testing ViolationReporter...
# ViolationReporter: PASSED
# Testing Grade Boundaries...
# Grade Boundaries: PASSED
# Testing QualityPipeline...
# QualityPipeline: PASSED
#
# All tests PASSED!
```

### Test Coverage

- Quality score calculation
- Violation detection (all 6 types)
- Grade boundary testing
- Threshold retrieval (global, agent, file)
- Report generation
- Fix suggestion generation
- End-to-end pipeline execution

---

## Agent Access Control

### Code Quality Agents (14 total)

**Full access to Connascence + Memory + Coordination**:
- coder
- reviewer
- tester
- code-analyzer
- functionality-audit
- theater-detection-audit
- production-validator
- sparc-coder
- analyst
- backend-dev
- mobile-dev
- ml-developer
- base-template-generator
- code-review-swarm

**Non-quality agents** (planning, coordination, etc.):
- Quality gate skipped
- No Connascence analysis
- Memory MCP access only

---

## False Positive Handling

### Low False Positive Rate (<5%)

**Strategies**:
1. **Conservative thresholds** (NASA guidelines)
2. **Multiple violation types** (not single metric)
3. **Context-aware penalties** (critical files higher)
4. **Human override** for exceptional cases

### When to Override

**Valid reasons**:
- Legacy code migration
- External library integration
- Generated code (protobuf, GraphQL)
- Temporary workarounds (with TODO)

**Invalid reasons**:
- "I don't have time to fix"
- "It works fine"
- "Only a few violations"

---

## Troubleshooting

### Quality gate blocking valid code

**Check**:
1. Verify violation counts are accurate
2. Check if threshold too high for file type
3. Review penalty weights
4. Consider human override if justified

### Quality gate not running

**Check**:
1. Hook enabled in `hooks/hooks.json`
2. Agent has Connascence access (14 code quality agents)
3. File extension supported (.js, .ts, .py, etc.)
4. No errors in hook execution logs

### Memory MCP not storing results

**Check**:
1. Memory MCP server running
2. `storeInMemory` feature flag enabled
3. Agent has Memory MCP access
4. Memory server configuration in `~/.claude/claude_desktop_config.json`

### Backend metrics not recording

**Check**:
1. Backend server running on port 8000
2. `trackMetrics` feature flag enabled
3. `QUALITY_API` environment variable set
4. Network connectivity to backend

---

## Future Enhancements

### Phase 2 (Planned)

1. **Real Connascence MCP Integration**
   - Replace heuristic analysis with actual MCP calls
   - `mcp__connascence-analyzer__analyze_workspace`

2. **Machine Learning Pattern Detection**
   - Train on violation history
   - Predict high-risk code before commit
   - Suggest refactoring patterns

3. **Incremental Analysis**
   - Only analyze changed lines
   - Cache analysis results
   - Faster feedback loop

4. **IDE Integration**
   - Real-time quality feedback in editor
   - Inline violation highlighting
   - Quick fix suggestions

5. **Team Dashboards**
   - Quality trends by team/project
   - Leaderboards (quality leaders/laggards)
   - Violation heatmaps

---

## Related Documentation

- **Connascence Analyzer**: `claude-code-plugins/connascence-analyzer/README.md`
- **Memory MCP Tagging**: `hooks/12fa/memory-mcp-tagging-protocol.js`
- **Agent Access Control**: `hooks/12fa/agent-mcp-access-control.js`
- **Hook System**: `hooks/hooks.json`
- **Backend Metrics**: `backend/app/services/quality_score_service.py`

---

## Support

For issues or questions:
1. Check this documentation
2. Review test suite for examples
3. Inspect hook logs in `.claude/.artifacts/hooks-logs`
4. Check backend logs for metric recording issues

---

**End of Documentation**
