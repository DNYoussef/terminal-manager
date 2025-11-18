#!/usr/bin/env node

/**
 * Tests for Structured Logger v2.0
 * Validates agent context, correlation IDs, RBAC integration, and performance
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { StructuredLogger, getLogger, queryLogs, getStats, LOG_LEVELS } = require('../utils/structured-logger');

// Test configuration
const TEST_LOG_DIR = path.join(__dirname, 'test-logs');
const TEST_CONFIG = {
  level: 'DEBUG',
  transports: ['memory'],  // Only memory for testing
  prettyPrint: false
};

/**
 * Setup test environment
 */
function setupTests() {
  // Clean test log directory
  if (fs.existsSync(TEST_LOG_DIR)) {
    fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_LOG_DIR, { recursive: true });

  // Clear singleton logger
  const logger = getLogger();
  logger.clearMemory();
}

/**
 * Cleanup test environment
 */
function cleanupTests() {
  // Remove test logs
  if (fs.existsSync(TEST_LOG_DIR)) {
    fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
  }
}

/**
 * Test: Basic logging functionality
 */
function testBasicLogging() {
  console.log('Test: Basic logging functionality');

  const logger = new StructuredLogger(TEST_CONFIG);

  // Test each log level
  logger.debug('Debug message');
  logger.info('Info message');
  logger.warn('Warning message');
  logger.error('Error message');
  logger.fatal('Fatal message');

  const logs = logger.queryLogs();
  assert.strictEqual(logs.length, 5, 'Should have 5 log entries');

  // Verify log levels
  assert.strictEqual(logs[0].level, 'DEBUG');
  assert.strictEqual(logs[1].level, 'INFO');
  assert.strictEqual(logs[2].level, 'WARN');
  assert.strictEqual(logs[3].level, 'ERROR');
  assert.strictEqual(logs[4].level, 'FATAL');

  console.log('  PASSED: Basic logging works');
}

/**
 * Test: Agent context integration
 */
function testAgentContext() {
  console.log('Test: Agent context integration');

  const logger = new StructuredLogger(TEST_CONFIG);

  const agentIdentity = {
    agent_id: 'agent-123',
    name: 'backend-dev',
    role: 'developer',
    category: 'delivery'
  };

  const agentLogger = logger.withAgent(agentIdentity);
  agentLogger.info('Agent completed task');

  const logs = logger.queryLogs();
  const lastLog = logs[logs.length - 1];

  assert.strictEqual(lastLog.agent.agent_id, 'agent-123');
  assert.strictEqual(lastLog.agent.name, 'backend-dev');
  assert.strictEqual(lastLog.agent.role, 'developer');
  assert.strictEqual(lastLog.agent.category, 'delivery');

  console.log('  PASSED: Agent context is properly integrated');
}

/**
 * Test: Correlation ID tracking
 */
function testCorrelationIds() {
  console.log('Test: Correlation ID tracking');

  const logger = new StructuredLogger(TEST_CONFIG);

  const correlationId = 'trace-abc-123';
  const correlatedLogger = logger.withCorrelationId(correlationId);

  correlatedLogger.info('Step 1: Initialize');
  correlatedLogger.info('Step 2: Process');
  correlatedLogger.info('Step 3: Complete');

  const logs = logger.queryLogs({ correlation_id: correlationId });
  assert.strictEqual(logs.length, 3, 'Should find all 3 correlated logs');

  logs.forEach(log => {
    assert.strictEqual(log.execution.correlation_id, correlationId);
  });

  console.log('  PASSED: Correlation IDs work across multiple logs');
}

/**
 * Test: RBAC context integration
 */
function testRBACContext() {
  console.log('Test: RBAC context integration');

  const logger = new StructuredLogger(TEST_CONFIG);

  const rbacContext = {
    decision: 'allowed',
    permission_checked: 'Write',
    reason: null
  };

  logger.info('File write operation', {
    operation: 'file_write',
    target: 'src/api/users.js',
    rbac: rbacContext
  });

  const logs = logger.queryLogs();
  const lastLog = logs[logs.length - 1];

  assert.strictEqual(lastLog.rbac.decision, 'allowed');
  assert.strictEqual(lastLog.rbac.permission_checked, 'Write');

  console.log('  PASSED: RBAC context is properly logged');
}

/**
 * Test: Performance metrics
 */
function testPerformanceMetrics() {
  console.log('Test: Performance metrics');

  const logger = new StructuredLogger(TEST_CONFIG);

  const metrics = {
    execution_time_ms: 1234,
    tokens_used: 5678,
    cost_usd: 0.12,
    memory_mb: 245
  };

  logger.withMetrics(metrics).info('Operation completed');

  const logs = logger.queryLogs();
  const lastLog = logs[logs.length - 1];

  assert.strictEqual(lastLog.metrics.execution_time_ms, 1234);
  assert.strictEqual(lastLog.metrics.tokens_used, 5678);
  assert.strictEqual(lastLog.metrics.cost_usd, 0.12);

  console.log('  PASSED: Performance metrics are captured');
}

/**
 * Test: Error handling and stack traces
 */
function testErrorHandling() {
  console.log('Test: Error handling and stack traces');

  const logger = new StructuredLogger(TEST_CONFIG);

  const testError = new Error('Test error message');
  testError.code = 'TEST_ERROR';

  logger.error('Operation failed', {
    error: testError,
    operation: 'test_operation'
  });

  const logs = logger.queryLogs({ level: 'ERROR' });
  const errorLog = logs[logs.length - 1];

  assert.strictEqual(errorLog.error.name, 'Error');
  assert.strictEqual(errorLog.error.message, 'Test error message');
  assert.strictEqual(errorLog.error.code, 'TEST_ERROR');
  assert.ok(errorLog.error.stack, 'Stack trace should be included');

  console.log('  PASSED: Errors are properly logged with stack traces');
}

/**
 * Test: Log filtering
 */
function testLogFiltering() {
  console.log('Test: Log filtering');

  const logger = new StructuredLogger(TEST_CONFIG);

  // Create logs with different contexts
  logger.withAgent({ name: 'agent-1' }).info('Agent 1 message');
  logger.withAgent({ name: 'agent-2' }).warn('Agent 2 warning');
  logger.withAgent({ name: 'agent-1' }).error('Agent 1 error');

  // Filter by agent
  const agent1Logs = logger.queryLogs({ agent_name: 'agent-1' });
  assert.strictEqual(agent1Logs.length, 2, 'Should find 2 logs from agent-1');

  // Filter by level
  const errorLogs = logger.queryLogs({ level: 'ERROR' });
  assert.strictEqual(errorLogs.length, 1, 'Should find 1 error log');

  console.log('  PASSED: Log filtering works correctly');
}

/**
 * Test: Time range filtering
 */
function testTimeRangeFiltering() {
  console.log('Test: Time range filtering');

  const logger = new StructuredLogger(TEST_CONFIG);

  const startTime = new Date();
  logger.info('Before delay');

  // Small delay
  const delayMs = 100;
  const endTime = new Date(startTime.getTime() + delayMs);

  setTimeout(() => {
    logger.info('After delay');

    const allLogs = logger.queryLogs();
    assert.strictEqual(allLogs.length, 2, 'Should have 2 total logs');

    const beforeLogs = logger.queryLogs({
      end_time: endTime.toISOString()
    });
    assert.strictEqual(beforeLogs.length, 1, 'Should find 1 log before delay');

    console.log('  PASSED: Time range filtering works');
  }, delayMs + 50);
}

/**
 * Test: Child logger inheritance
 */
function testChildLoggerInheritance() {
  console.log('Test: Child logger inheritance');

  const logger = new StructuredLogger(TEST_CONFIG);

  const parent = logger
    .withAgent({ name: 'parent-agent' })
    .withCorrelationId('parent-trace-123');

  const child = parent.withContext({ session_id: 'session-456' });

  child.info('Child logger message');

  const logs = logger.queryLogs();
  const lastLog = logs[logs.length - 1];

  assert.strictEqual(lastLog.agent.name, 'parent-agent');
  assert.strictEqual(lastLog.execution.correlation_id, 'parent-trace-123');
  assert.strictEqual(lastLog.execution.session_id, 'session-456');

  console.log('  PASSED: Child logger inherits parent context');
}

/**
 * Test: Log statistics
 */
function testLogStats() {
  console.log('Test: Log statistics');

  const logger = new StructuredLogger(TEST_CONFIG);

  logger.info('Info 1');
  logger.info('Info 2');
  logger.error('Error 1');
  logger.withAgent({ name: 'agent-1' }).info('Agent 1');
  logger.withAgent({ name: 'agent-2' }).warn('Agent 2');

  const stats = logger.getStats();

  assert.strictEqual(stats.total, 5, 'Should have 5 total logs');
  assert.strictEqual(stats.by_level.INFO, 3, 'Should have 3 INFO logs');
  assert.strictEqual(stats.by_level.ERROR, 1, 'Should have 1 ERROR log');
  assert.strictEqual(stats.by_agent['agent-1'], 1, 'Should have 1 log from agent-1');

  console.log('  PASSED: Log statistics are accurate');
}

/**
 * Test: Memory buffer limits
 */
function testMemoryBufferLimits() {
  console.log('Test: Memory buffer limits');

  const logger = new StructuredLogger(TEST_CONFIG);

  // Log more than buffer size (1000)
  for (let i = 0; i < 1500; i++) {
    logger.info(`Log entry ${i}`);
  }

  const logs = logger.queryLogs({ limit: 2000 });
  assert.ok(logs.length <= 1000, 'Memory buffer should be limited to 1000 entries');

  console.log('  PASSED: Memory buffer respects size limits');
}

/**
 * Test: Query result limits
 */
function testQueryLimits() {
  console.log('Test: Query result limits');

  const logger = new StructuredLogger(TEST_CONFIG);

  // Create 50 logs
  for (let i = 0; i < 50; i++) {
    logger.info(`Log ${i}`);
  }

  const limitedLogs = logger.queryLogs({ limit: 10 });
  assert.strictEqual(limitedLogs.length, 10, 'Should respect query limit');

  console.log('  PASSED: Query limits work correctly');
}

/**
 * Test: Performance (logging overhead)
 */
function testPerformance() {
  console.log('Test: Performance (logging overhead)');

  const logger = new StructuredLogger(TEST_CONFIG);

  const iterations = 1000;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    logger.info(`Performance test ${i}`, {
      agent: { name: 'test-agent' },
      correlation_id: 'perf-test',
      metrics: { iteration: i }
    });
  }

  const endTime = Date.now();
  const totalTimeMs = endTime - startTime;
  const avgTimeMs = totalTimeMs / iterations;

  console.log(`  Total time: ${totalTimeMs}ms for ${iterations} logs`);
  console.log(`  Average time per log: ${avgTimeMs.toFixed(3)}ms`);

  assert.ok(avgTimeMs < 5, 'Logging overhead should be less than 5ms per entry');

  console.log('  PASSED: Performance is within acceptable limits');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n=== Structured Logger Tests ===\n');

  try {
    setupTests();

    // Run tests
    testBasicLogging();
    testAgentContext();
    testCorrelationIds();
    testRBACContext();
    testPerformanceMetrics();
    testErrorHandling();
    testLogFiltering();
    testChildLoggerInheritance();
    testLogStats();
    testMemoryBufferLimits();
    testQueryLimits();
    testPerformance();

    // Async test
    await new Promise(resolve => {
      testTimeRangeFiltering();
      setTimeout(resolve, 200);
    });

    console.log('\n=== All Tests Passed! ===\n');

  } catch (error) {
    console.error('\nTEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);

  } finally {
    cleanupTests();
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  setupTests,
  cleanupTests
};
