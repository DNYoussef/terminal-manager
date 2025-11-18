#!/usr/bin/env node

/**
 * Structured Logging Integration Examples
 * Demonstrates how to use structured logging in hooks with agent context,
 * correlation IDs, RBAC decisions, and performance metrics.
 */

const { getLogger } = require('../utils/structured-logger');
const { getOrCreate } = require('../correlation-id-manager');

/**
 * Example 1: Basic hook with agent context
 */
async function examplePreTaskHook(agentIdentity, taskDescription) {
  console.log('\n=== Example 1: Pre-Task Hook ===\n');

  // Get correlation ID for this task
  const correlationId = getOrCreate(taskDescription);

  // Create logger with agent context and correlation ID
  const logger = getLogger()
    .withAgent(agentIdentity)
    .withCorrelationId(correlationId);

  logger.info('Task started', {
    operation: 'pre_task',
    task_id: taskDescription,
    metadata: {
      hook: 'pre-task',
      version: '2.0'
    }
  });

  // Simulate task processing
  const startTime = Date.now();

  // ... hook logic here ...

  const executionTime = Date.now() - startTime;

  logger.withMetrics({
    execution_time_ms: executionTime
  }).info('Task initialization complete');

  console.log(`Logged with correlation ID: ${correlationId}`);
}

/**
 * Example 2: RBAC integration with logging
 */
async function exampleRBACCheck(agentIdentity, permission, target) {
  console.log('\n=== Example 2: RBAC Check with Logging ===\n');

  const logger = getLogger().withAgent(agentIdentity);

  // Simulate RBAC check
  const decision = {
    allowed: true,
    reason: null
  };

  // Log the RBAC decision
  logger.info('RBAC permission check', {
    operation: 'rbac_check',
    target: target,
    rbac: {
      decision: decision.allowed ? 'allowed' : 'denied',
      permission_checked: permission,
      reason: decision.reason
    }
  });

  console.log(`RBAC decision logged: ${decision.allowed ? 'ALLOWED' : 'DENIED'}`);
  return decision;
}

/**
 * Example 3: Error handling with full context
 */
async function exampleErrorHandling(agentIdentity, operation) {
  console.log('\n=== Example 3: Error Handling ===\n');

  const correlationId = getOrCreate(operation);
  const logger = getLogger()
    .withAgent(agentIdentity)
    .withCorrelationId(correlationId);

  try {
    logger.info('Starting risky operation', {
      operation: operation,
      target: 'some/file.js'
    });

    // Simulate an error
    throw new Error('Simulated failure for demonstration');

  } catch (error) {
    // Log error with full context
    logger.error('Operation failed', {
      error: error,
      operation: operation,
      target: 'some/file.js',
      rbac: {
        decision: 'allowed',
        permission_checked: 'Execute',
        reason: null
      }
    });

    console.log('Error logged with stack trace and context');
  }
}

/**
 * Example 4: Performance tracking across multiple steps
 */
async function examplePerformanceTracking(agentIdentity) {
  console.log('\n=== Example 4: Performance Tracking ===\n');

  const correlationId = getOrCreate('multi-step-operation');
  const baseLogger = getLogger()
    .withAgent(agentIdentity)
    .withCorrelationId(correlationId);

  // Step 1
  const step1Start = Date.now();
  baseLogger.info('Step 1: Initialize');
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work
  const step1Time = Date.now() - step1Start;

  baseLogger.withMetrics({
    execution_time_ms: step1Time,
    step: 1
  }).info('Step 1 complete');

  // Step 2
  const step2Start = Date.now();
  baseLogger.info('Step 2: Process');
  await new Promise(resolve => setTimeout(resolve, 75)); // Simulate work
  const step2Time = Date.now() - step2Start;

  baseLogger.withMetrics({
    execution_time_ms: step2Time,
    step: 2
  }).info('Step 2 complete');

  // Step 3
  const step3Start = Date.now();
  baseLogger.info('Step 3: Finalize');
  await new Promise(resolve => setTimeout(resolve, 25)); // Simulate work
  const step3Time = Date.now() - step3Start;

  baseLogger.withMetrics({
    execution_time_ms: step3Time,
    step: 3
  }).info('Step 3 complete');

  // Total
  const totalTime = step1Time + step2Time + step3Time;
  baseLogger.withMetrics({
    execution_time_ms: totalTime,
    total_steps: 3
  }).info('Multi-step operation complete');

  console.log(`Total execution time: ${totalTime}ms`);
  console.log(`Query logs with correlation_id: ${correlationId}`);
}

/**
 * Example 5: File operation with RBAC and metrics
 */
async function exampleFileOperation(agentIdentity, filepath, content) {
  console.log('\n=== Example 5: File Operation with Full Context ===\n');

  const correlationId = getOrCreate(`write-${filepath}`);
  const logger = getLogger()
    .withAgent(agentIdentity)
    .withCorrelationId(correlationId);

  // Check RBAC permission
  const rbacDecision = {
    allowed: true,
    reason: null
  };

  logger.info('RBAC check for file write', {
    operation: 'rbac_check',
    target: filepath,
    rbac: {
      decision: 'allowed',
      permission_checked: 'Write',
      reason: null
    }
  });

  if (!rbacDecision.allowed) {
    logger.error('File write denied', {
      operation: 'file_write',
      target: filepath,
      rbac: {
        decision: 'denied',
        permission_checked: 'Write',
        reason: 'Agent not authorized'
      }
    });
    return;
  }

  // Perform file write
  const startTime = Date.now();

  // Simulate file write
  await new Promise(resolve => setTimeout(resolve, 100));

  const executionTime = Date.now() - startTime;

  logger.withMetrics({
    execution_time_ms: executionTime,
    file_size_bytes: content.length
  }).info('File written successfully', {
    operation: 'file_write',
    target: filepath,
    rbac: {
      decision: 'allowed',
      permission_checked: 'Write',
      reason: null
    }
  });

  console.log(`File operation logged with correlation ID: ${correlationId}`);
}

/**
 * Example 6: Quality integration
 */
async function exampleQualityCheck(agentIdentity, code) {
  console.log('\n=== Example 6: Quality Check Integration ===\n');

  const logger = getLogger().withAgent(agentIdentity);

  // Simulate quality check
  const qualityScore = {
    score: 85,
    grade: 'B',
    violations: [
      { type: 'complexity', severity: 'medium' }
    ]
  };

  logger.info('Code quality check completed', {
    operation: 'quality_check',
    target: 'src/api/users.js',
    quality: qualityScore
  });

  console.log(`Quality score: ${qualityScore.score} (${qualityScore.grade})`);
}

/**
 * Example 7: Querying logs
 */
async function exampleQueryLogs() {
  console.log('\n=== Example 7: Querying Logs ===\n');

  const logger = getLogger();

  // Query all logs
  const allLogs = logger.queryLogs({ limit: 20 });
  console.log(`Total logs: ${allLogs.length}`);

  // Query by level
  const errorLogs = logger.queryLogs({ level: 'ERROR' });
  console.log(`Error logs: ${errorLogs.length}`);

  // Query by agent
  const agentLogs = logger.queryLogs({ agent_name: 'backend-dev' });
  console.log(`Logs from backend-dev: ${agentLogs.length}`);

  // Get statistics
  const stats = logger.getStats();
  console.log('\nLog Statistics:');
  console.log(`  Total: ${stats.total}`);
  console.log(`  By Level:`, stats.by_level);
  console.log(`  By Agent:`, stats.by_agent);
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('\n========================================');
  console.log('Structured Logging Integration Examples');
  console.log('========================================');

  const agentIdentity = {
    agent_id: 'agent-example-123',
    name: 'backend-dev',
    role: 'developer',
    category: 'delivery'
  };

  try {
    // Example 1: Basic hook
    await examplePreTaskHook(agentIdentity, 'Build REST API');

    // Example 2: RBAC check
    await exampleRBACCheck(agentIdentity, 'Write', 'src/api/users.js');

    // Example 3: Error handling
    await exampleErrorHandling(agentIdentity, 'risky_operation');

    // Example 4: Performance tracking
    await examplePerformanceTracking(agentIdentity);

    // Example 5: File operation
    await exampleFileOperation(agentIdentity, 'src/api/users.js', 'console.log("Hello");');

    // Example 6: Quality check
    await exampleQualityCheck(agentIdentity, 'function test() {}');

    // Example 7: Query logs
    await exampleQueryLogs();

    console.log('\n========================================');
    console.log('All Examples Complete!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\nExample failed:', error.message);
    process.exit(1);
  }
}

// Run examples if called directly
if (require.main === module) {
  runExamples();
}

module.exports = {
  examplePreTaskHook,
  exampleRBACCheck,
  exampleErrorHandling,
  examplePerformanceTracking,
  exampleFileOperation,
  exampleQualityCheck,
  exampleQueryLogs
};
