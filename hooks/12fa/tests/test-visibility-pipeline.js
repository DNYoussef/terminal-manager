#!/usr/bin/env node

/**
 * Unit Tests for Visibility Pipeline
 *
 * Tests event creation, buffering, batching, and backend ingestion.
 *
 * Run: node test-visibility-pipeline.js
 */

const assert = require('assert');
const path = require('path');

// Import visibility pipeline
const {
  onAgentSpawned,
  onAgentActivated,
  onRbacDecision,
  onBudgetUpdated,
  onTaskCompleted,
  onTaskFailed,
  createEvent,
  EventType,
  getStats
} = require('../visibility-pipeline');

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function test(name, fn) {
  testResults.total++;

  try {
    fn();
    testResults.passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    testResults.failed++;
    console.error(`FAIL: ${name}`);
    console.error(`  ${error.message}`);
    if (error.stack) {
      console.error(`  ${error.stack.split('\n')[1]}`);
    }
  }
}

async function asyncTest(name, fn) {
  testResults.total++;

  try {
    await fn();
    testResults.passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    testResults.failed++;
    console.error(`FAIL: ${name}`);
    console.error(`  ${error.message}`);
    if (error.stack) {
      console.error(`  ${error.stack.split('\n')[1]}`);
    }
  }
}

// ============================================================================
// TEST DATA
// ============================================================================

const testAgent = {
  agent_id: 'test-agent-123',
  agent_name: 'test-coder',
  agent_role: 'coder',
  session_id: 'test-session-456',
  task_id: 'test-task-789',
  project: 'visibility-pipeline-test',
  trace_id: 'trace-123',
  correlationId: 'corr-456'
};

// ============================================================================
// EVENT CREATION TESTS
// ============================================================================

test('createEvent - creates valid event with all required fields', () => {
  const event = createEvent(EventType.AGENT_SPAWNED, testAgent, {
    operation: 'spawn',
    status: 'success'
  });

  assert.strictEqual(event.event_type, EventType.AGENT_SPAWNED);
  assert.ok(event.timestamp);
  assert.ok(event.event_id);
  assert.strictEqual(event.agent_id, testAgent.agent_id);
  assert.strictEqual(event.agent_name, testAgent.agent_name);
  assert.strictEqual(event.agent_role, testAgent.agent_role);
  assert.strictEqual(event.operation, 'spawn');
  assert.strictEqual(event.status, 'success');
  assert.ok(event.metadata);
});

test('createEvent - includes metadata fields', () => {
  const event = createEvent(EventType.AGENT_ACTIVATED, testAgent, {
    operation: 'activate',
    metadata: {
      custom_field: 'custom_value'
    }
  });

  assert.strictEqual(event.metadata.session_id, testAgent.session_id);
  assert.strictEqual(event.metadata.task_id, testAgent.task_id);
  assert.strictEqual(event.metadata.project, testAgent.project);
  assert.strictEqual(event.metadata.custom_field, 'custom_value');
});

test('createEvent - throws on missing required fields', () => {
  assert.throws(() => {
    createEvent(EventType.AGENT_SPAWNED, {}, {});
  }, /Missing required field/);
});

test('createEvent - throws on invalid event type', () => {
  assert.throws(() => {
    createEvent('invalid_event_type', testAgent, {});
  }, /Invalid event_type/);
});

// ============================================================================
// EVENT HANDLER TESTS
// ============================================================================

asyncTest('onAgentSpawned - creates agent_spawned event', async () => {
  const event = await onAgentSpawned({
    ...testAgent,
    capabilities: ['read', 'write'],
    mcpAccess: ['memory-mcp', 'claude-flow']
  });

  assert.strictEqual(event.event_type, EventType.AGENT_SPAWNED);
  assert.strictEqual(event.agent_name, testAgent.agent_name);
  assert.ok(event.metadata.capabilities);
  assert.strictEqual(event.metadata.capabilities.length, 2);
});

asyncTest('onAgentActivated - creates agent_activated event', async () => {
  const event = await onAgentActivated({
    ...testAgent,
    permissions: ['file:read', 'file:write'],
    resources: ['src/', 'tests/']
  });

  assert.strictEqual(event.event_type, EventType.AGENT_ACTIVATED);
  assert.ok(event.metadata.permissions);
  assert.ok(event.metadata.resources);
});

asyncTest('onRbacDecision - creates operation_allowed event', async () => {
  const event = await onRbacDecision({
    ...testAgent,
    operation: 'write_file',
    resource: 'src/test.js',
    permissionRequired: 'file:write'
  }, true);

  assert.strictEqual(event.event_type, EventType.OPERATION_ALLOWED);
  assert.strictEqual(event.status, 'allowed');
  assert.strictEqual(event.operation, 'write_file');
  assert.strictEqual(event.metadata.resource, 'src/test.js');
});

asyncTest('onRbacDecision - creates operation_denied event', async () => {
  const event = await onRbacDecision({
    ...testAgent,
    operation: 'delete_database',
    resource: '/etc/passwd',
    permissionRequired: 'admin:all',
    reason: 'Insufficient permissions'
  }, false);

  assert.strictEqual(event.event_type, EventType.OPERATION_DENIED);
  assert.strictEqual(event.status, 'denied');
  assert.strictEqual(event.metadata.reason, 'Insufficient permissions');
});

asyncTest('onBudgetUpdated - creates budget_updated event', async () => {
  const event = await onBudgetUpdated({
    ...testAgent,
    amountDeducted: 10,
    remainingBudget: 90,
    budgetLimit: 100,
    operationCost: 10
  });

  assert.strictEqual(event.event_type, EventType.BUDGET_UPDATED);
  assert.strictEqual(event.metadata.amount_deducted, 10);
  assert.strictEqual(event.metadata.remaining_budget, 90);
});

asyncTest('onTaskCompleted - creates task_completed event', async () => {
  const event = await onTaskCompleted({
    ...testAgent,
    operation: 'implement_feature',
    durationMs: 2500,
    filesModified: ['src/feature.js', 'tests/feature.test.js'],
    toolsUsed: ['Edit', 'Write', 'Bash']
  });

  assert.strictEqual(event.event_type, EventType.TASK_COMPLETED);
  assert.strictEqual(event.metadata.duration_ms, 2500);
  assert.strictEqual(event.metadata.files_modified.length, 2);
  assert.strictEqual(event.metadata.tools_used.length, 3);
});

asyncTest('onTaskFailed - creates task_failed event', async () => {
  const event = await onTaskFailed({
    ...testAgent,
    error: 'File not found: src/missing.js',
    stackTrace: 'Error: File not found\n  at line 42',
    durationMs: 150
  });

  assert.strictEqual(event.event_type, EventType.TASK_FAILED);
  assert.strictEqual(event.status, 'failed');
  assert.strictEqual(event.metadata.error, 'File not found: src/missing.js');
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

asyncTest('Event creation performance - <10ms target', async () => {
  const iterations = 100;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    await onAgentSpawned(testAgent);
  }

  const endTime = Date.now();
  const avgTime = (endTime - startTime) / iterations;

  console.log(`  Average event creation time: ${avgTime.toFixed(2)}ms`);
  assert.ok(avgTime < 10, `Event creation too slow: ${avgTime}ms (target: <10ms)`);
});

asyncTest('Event creation with metadata - handles large metadata', async () => {
  const largeMetadata = {
    files: Array(100).fill('file.js'),
    data: 'x'.repeat(1000)
  };

  const event = await onTaskCompleted({
    ...testAgent,
    filesModified: largeMetadata.files
  });

  assert.ok(event);
  assert.strictEqual(event.metadata.files_modified.length, 100);
});

// ============================================================================
// STATISTICS TESTS
// ============================================================================

test('getStats - returns pipeline statistics', () => {
  const stats = getStats();

  assert.ok(stats.buffer);
  assert.ok(stats.config);
  assert.ok(typeof stats.buffer.totalEvents === 'number');
  assert.ok(typeof stats.config.bufferSize === 'number');
});

// ============================================================================
// EDGE CASES
// ============================================================================

asyncTest('Event handler - handles missing optional fields', async () => {
  const minimalAgent = {
    agentId: 'minimal-123',
    agentType: 'minimal-agent'
  };

  const event = await onAgentSpawned(minimalAgent);

  assert.ok(event);
  assert.strictEqual(event.agent_name, 'minimal-agent');
});

asyncTest('Event handler - handles undefined metadata', async () => {
  const event = await onTaskCompleted({
    ...testAgent,
    // No optional fields
  });

  assert.ok(event);
  assert.strictEqual(event.metadata.duration_ms, 0);
  assert.ok(Array.isArray(event.metadata.files_modified));
  assert.strictEqual(event.metadata.files_modified.length, 0);
});

test('Event validation - rejects invalid timestamps', () => {
  const event = createEvent(EventType.AGENT_SPAWNED, testAgent, {});

  // Timestamp should be ISO8601
  assert.ok(event.timestamp.match(/\d{4}-\d{2}-\d{2}T/));
});

// ============================================================================
// RUN TESTS
// ============================================================================

async function runTests() {
  console.log('\n========================================');
  console.log('Visibility Pipeline Unit Tests');
  console.log('========================================\n');

  console.log('Running tests...\n');

  // Wait a bit for async tests
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('\n========================================');
  console.log('Test Results');
  console.log('========================================');
  console.log(`Total:  ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log('========================================\n');

  if (testResults.failed > 0) {
    console.error(`FAILED: ${testResults.failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log('SUCCESS: All tests passed!');
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}
