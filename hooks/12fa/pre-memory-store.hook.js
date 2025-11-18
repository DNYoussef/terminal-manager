#!/usr/bin/env node

/**
 * Pre-Memory-Store Hook
 *
 * Validates all memory writes to ensure no secrets are stored.
 * Integrates with mcp__claude-flow__memory_store operations.
 *
 * Part of 12-Factor App compliance (Quick Win #2).
 */

const { validateNoSecrets, getRedactorInstance } = require('./secrets-redaction');
const fs = require('fs');
const path = require('path');
const { getLogger } = require('./structured-logger');
const { getOrCreate, propagate } = require('./correlation-id-manager');
const { getAdapter } = require('./opentelemetry-adapter');

// Initialize structured logger and telemetry
const logger = getLogger();
const otelAdapter = getAdapter();

/**
 * Hook entry point
 */
async function preMemoryStoreHook(args) {
  const { key, value, options = {} } = args;
  const startTime = Date.now();

  // Generate or retrieve correlation ID
  const correlationId = getOrCreate('pre-memory-store-hook', 'prefixed');

  // Start OpenTelemetry span
  const span = otelAdapter.startSpan('pre-memory-store-hook', {
    attributes: {
      'hook.type': 'pre-memory-store',
      'memory.key': key,
      'value.length': typeof value === 'string' ? value.length : JSON.stringify(value).length
    }
  });

  // Propagate correlation ID for downstream operations
  propagate('pre-memory-store-hook', `memory-store-${key}`);

  logger.info('Pre-memory-store hook started', {
    trace_id: correlationId,
    span_id: span.spanId,
    memory_key: key,
    operation: 'secrets-validation'
  });

  try {
    // Validate no secrets present
    validateNoSecrets(key, value);

    logger.info('Memory validation passed - no secrets detected', {
      trace_id: correlationId,
      span_id: span.spanId,
      memory_key: key,
      status: 'passed'
    });

    span.setAttribute('validation.result', 'passed');
    span.addEvent('no-secrets-detected');

    const duration = Date.now() - startTime;
    span.setAttribute('duration_ms', duration);
    otelAdapter.endSpan(span);

    return {
      success: true,
      key,
      value,
      validated: true,
      trace_id: correlationId,
      span_id: span.spanId,
      duration_ms: duration
    };

  } catch (error) {
    logger.error('Memory validation failed - secrets detected', {
      trace_id: correlationId,
      span_id: span.spanId,
      memory_key: key,
      error: error.message,
      status: 'blocked'
    });

    span.setAttribute('validation.result', 'blocked');
    span.addEvent('secrets-detected', {
      'error.message': error.message
    });
    span.recordException(error);

    // Store blocked attempt stats
    await updateBlockedStats(key, error.message, correlationId, span.spanId);

    const duration = Date.now() - startTime;
    span.setAttribute('duration_ms', duration);
    otelAdapter.endSpan(span);

    // Re-throw to prevent storage
    error.trace_id = correlationId;
    error.span_id = span.spanId;
    throw error;
  }
}

/**
 * Update blocked attempt statistics in memory
 */
async function updateBlockedStats(key, error, correlationId, spanId) {
  try {
    const statsPath = path.join(__dirname, '../../logs/12fa/blocked-stats.json');

    let stats = {
      totalBlocked: 0,
      lastBlocked: null,
      blockedKeys: {}
    };

    // Load existing stats
    if (fs.existsSync(statsPath)) {
      const data = fs.readFileSync(statsPath, 'utf8');
      stats = JSON.parse(data);
    }

    // Update stats with correlation tracking
    stats.totalBlocked++;
    stats.lastBlocked = new Date().toISOString();
    stats.blockedKeys[key] = {
      count: (stats.blockedKeys[key]?.count || 0) + 1,
      lastAttempt: new Date().toISOString(),
      lastError: error,
      trace_id: correlationId,
      span_id: spanId
    };

    // Save stats
    const statsDir = path.dirname(statsPath);
    if (!fs.existsSync(statsDir)) {
      fs.mkdirSync(statsDir, { recursive: true });
    }

    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8');

  } catch (error) {
    console.error('Failed to update blocked stats:', error.message);
  }
}

/**
 * Get current statistics
 */
function getStats() {
  try {
    const statsPath = path.join(__dirname, '../../logs/12fa/blocked-stats.json');

    if (fs.existsSync(statsPath)) {
      const data = fs.readFileSync(statsPath, 'utf8');
      return JSON.parse(data);
    }

    return {
      totalBlocked: 0,
      lastBlocked: null,
      blockedKeys: {}
    };
  } catch (error) {
    console.error('Failed to get stats:', error.message);
    return null;
  }
}

/**
 * CLI interface for manual validation
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node pre-memory-store.hook.js [command]');
    console.log('Commands:');
    console.log('  validate <key> <value>  - Validate a key-value pair');
    console.log('  stats                   - Show blocked attempt statistics');
    console.log('  test                    - Run validation tests');
    process.exit(0);
  }

  const command = args[0];

  if (command === 'validate') {
    const key = args[1];
    const value = args[2];

    if (!key || !value) {
      console.error('Error: Key and value required');
      process.exit(1);
    }

    preMemoryStoreHook({ key, value })
      .then(result => {
        console.log('✅ Validation passed:', result);
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
      });

  } else if (command === 'stats') {
    const stats = getStats();
    console.log('Blocked Attempt Statistics:');
    console.log(JSON.stringify(stats, null, 2));

    const redactor = getRedactorInstance();
    const violationStats = redactor.getViolationStats();
    console.log('\nViolation Statistics:');
    console.log(JSON.stringify(violationStats, null, 2));

  } else if (command === 'test') {
    runValidationTests();
  } else {
    console.error('Unknown command:', command);
    process.exit(1);
  }
}

/**
 * Run validation tests
 */
async function runValidationTests() {
  console.log('Running validation tests...\n');

  const tests = [
    {
      name: 'Should detect Anthropic API key',
      key: 'test/api-key',
      value: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqr',
      shouldFail: true
    },
    {
      name: 'Should detect GitHub token',
      key: 'test/github-token',
      value: 'ghp_1234567890abcdefghijklmnopqrstuv',
      shouldFail: true
    },
    {
      name: 'Should allow normal data',
      key: 'test/normal-data',
      value: JSON.stringify({ name: 'test', value: 123 }),
      shouldFail: false
    },
    {
      name: 'Should allow test keys',
      key: 'test/fake-key',
      value: 'test-key-12345',
      shouldFail: false
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await preMemoryStoreHook({ key: test.key, value: test.value });

      if (test.shouldFail) {
        console.log(`❌ FAILED: ${test.name} - Expected failure but passed`);
        failed++;
      } else {
        console.log(`✅ PASSED: ${test.name}`);
        passed++;
      }
    } catch (error) {
      if (test.shouldFail) {
        console.log(`✅ PASSED: ${test.name} - Correctly blocked`);
        passed++;
      } else {
        console.log(`❌ FAILED: ${test.name} - Unexpected error: ${error.message}`);
        failed++;
      }
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

module.exports = {
  preMemoryStoreHook,
  getStats,
  validateNoSecrets
};
