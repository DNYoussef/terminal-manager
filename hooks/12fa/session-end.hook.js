#!/usr/bin/env node

/**
 * Session-End Hook
 *
 * Executes when a Claude Code session ends to aggregate metrics, export logs, and cleanup resources.
 * Integrates with structured logging and OpenTelemetry for comprehensive observability.
 *
 * Usage:
 *   This hook is automatically invoked when a Claude Code session ends.
 *
 * Environment Variables:
 *   CLAUDE_FLOW_AGENT_TYPE - Agent type for context
 *   NODE_ENV - Environment (development, production, test)
 */

const fs = require('fs');
const path = require('path');
const { getLogger } = require('./structured-logger');
const { getOrCreate, getManager } = require('./correlation-id-manager');
const { getAdapter } = require('./opentelemetry-adapter');

// Initialize structured logger and telemetry
const logger = getLogger();
const otelAdapter = getAdapter();

/**
 * Main hook execution
 */
async function sessionEndHook(context) {
  const startTime = Date.now();

  // Generate session correlation ID
  const sessionId = context?.sessionId || `session-${Date.now()}`;
  const correlationId = getOrCreate('session-end-hook', 'prefixed');

  // Start OpenTelemetry span
  const span = otelAdapter.startSpan('session-end-hook', {
    attributes: {
      'hook.type': 'session-end',
      'session.id': sessionId,
      'session.duration': context?.sessionDuration || 0
    }
  });

  logger.info('Session-end hook started', {
    trace_id: correlationId,
    span_id: span.spanId,
    session_id: sessionId,
    operation: 'session-cleanup'
  });

  try {
    // Aggregate session metrics
    const sessionMetrics = await aggregateSessionMetrics(sessionId, correlationId, span.spanId);

    logger.info('Session metrics aggregated', {
      trace_id: correlationId,
      span_id: span.spanId,
      session_id: sessionId,
      ...sessionMetrics.summary
    });

    span.setAttributes({
      'session.tasks': sessionMetrics.summary.totalTasks,
      'session.edits': sessionMetrics.summary.totalEdits,
      'session.validations': sessionMetrics.summary.totalValidations
    });

    // Export correlation ID statistics
    const correlationManager = getManager();
    const correlationStats = correlationManager.getStats();

    logger.info('Correlation ID statistics', {
      trace_id: correlationId,
      span_id: span.spanId,
      ...correlationStats
    });

    span.addEvent('correlation-stats', {
      'correlation.total': correlationStats.total,
      'correlation.active': correlationStats.active,
      'correlation.expired': correlationStats.expired
    });

    // Clean up expired correlation IDs
    const cleanedCount = correlationManager.cleanExpired();

    if (cleanedCount > 0) {
      logger.info('Cleaned expired correlation IDs', {
        trace_id: correlationId,
        span_id: span.spanId,
        cleaned_count: cleanedCount
      });

      span.addEvent('correlation-cleanup', {
        'cleaned.count': cleanedCount
      });
    }

    // Export session summary
    const sessionSummary = {
      sessionId,
      duration: context?.sessionDuration || 0,
      metrics: sessionMetrics,
      correlationStats,
      cleanedCorrelations: cleanedCount,
      timestamp: new Date().toISOString(),
      trace_id: correlationId,
      span_id: span.spanId
    };

    // Save session summary
    await saveSessionSummary(sessionSummary);

    logger.info('Session summary saved', {
      trace_id: correlationId,
      span_id: span.spanId,
      session_id: sessionId
    });

    // Shutdown OpenTelemetry adapter to flush spans
    logger.info('Flushing OpenTelemetry traces', {
      trace_id: correlationId,
      span_id: span.spanId
    });

    const hookDuration = Date.now() - startTime;
    span.setAttribute('duration_ms', hookDuration);
    span.addEvent('session-ended');
    otelAdapter.endSpan(span);

    // Flush remaining spans
    otelAdapter.shutdown();

    return {
      success: true,
      sessionSummary,
      hookDuration,
      trace_id: correlationId,
      span_id: span.spanId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Session-end hook execution failed', {
      trace_id: correlationId,
      span_id: span.spanId,
      error: error.message,
      status: 'error'
    });

    span.recordException(error);
    otelAdapter.endSpan(span);

    return {
      success: false,
      error: error.message,
      stack: error.stack,
      trace_id: correlationId,
      span_id: span.spanId,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Aggregate metrics from all hooks during the session
 */
async function aggregateSessionMetrics(sessionId, correlationId, spanId) {
  const logsDir = path.join(__dirname, '../../logs/12fa');

  const metrics = {
    sessionId,
    summary: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalEdits: 0,
      totalValidations: 0,
      blockedCommands: 0,
      blockedSecrets: 0
    },
    taskMetrics: null,
    editMetrics: null,
    validationMetrics: null,
    blockedStats: null
  };

  try {
    // Load task metrics
    const taskMetricsPath = path.join(logsDir, 'task-metrics.json');
    if (fs.existsSync(taskMetricsPath)) {
      const data = fs.readFileSync(taskMetricsPath, 'utf8');
      metrics.taskMetrics = JSON.parse(data);
      metrics.summary.totalTasks = metrics.taskMetrics.totalTasks || 0;
      metrics.summary.successfulTasks = metrics.taskMetrics.successfulTasks || 0;
      metrics.summary.failedTasks = metrics.taskMetrics.failedTasks || 0;
    }

    // Load edit metrics
    const editMetricsPath = path.join(logsDir, 'edit-metrics.json');
    if (fs.existsSync(editMetricsPath)) {
      const data = fs.readFileSync(editMetricsPath, 'utf8');
      metrics.editMetrics = JSON.parse(data);
      metrics.summary.totalEdits = metrics.editMetrics.totalEdits || 0;
    }

    // Load blocked stats
    const blockedStatsPath = path.join(logsDir, 'blocked-stats.json');
    if (fs.existsSync(blockedStatsPath)) {
      const data = fs.readFileSync(blockedStatsPath, 'utf8');
      metrics.blockedStats = JSON.parse(data);
      metrics.summary.blockedSecrets = metrics.blockedStats.totalBlocked || 0;
    }

    // Count validation logs (approximate from log files)
    const hookResultsPath = path.join(logsDir, 'hook-results.log');
    if (fs.existsSync(hookResultsPath)) {
      const data = fs.readFileSync(hookResultsPath, 'utf8');
      const lines = data.split('\n').filter(line => line.trim());
      metrics.summary.totalValidations = lines.length;
    }

    logger.debug('Session metrics aggregated', {
      trace_id: correlationId,
      span_id: spanId,
      session_id: sessionId,
      ...metrics.summary
    });

  } catch (error) {
    logger.error('Failed to aggregate session metrics', {
      trace_id: correlationId,
      span_id: spanId,
      error: error.message
    });
  }

  return metrics;
}

/**
 * Save session summary to file
 */
async function saveSessionSummary(sessionSummary) {
  try {
    const summaryDir = path.join(__dirname, '../../logs/12fa/sessions');
    if (!fs.existsSync(summaryDir)) {
      fs.mkdirSync(summaryDir, { recursive: true });
    }

    const summaryPath = path.join(
      summaryDir,
      `session-${sessionSummary.sessionId}.json`
    );

    fs.writeFileSync(summaryPath, JSON.stringify(sessionSummary, null, 2), 'utf8');

    logger.debug('Session summary saved', {
      trace_id: sessionSummary.trace_id,
      span_id: sessionSummary.span_id,
      summary_path: summaryPath
    });

  } catch (error) {
    logger.error('Failed to save session summary', {
      trace_id: sessionSummary.trace_id,
      span_id: sessionSummary.span_id,
      error: error.message
    });
  }
}

/**
 * Get session summary
 */
function getSessionSummary(sessionId) {
  try {
    const summaryPath = path.join(
      __dirname,
      '../../logs/12fa/sessions',
      `session-${sessionId}.json`
    );

    if (fs.existsSync(summaryPath)) {
      const data = fs.readFileSync(summaryPath, 'utf8');
      return JSON.parse(data);
    }

    return null;
  } catch (error) {
    logger.error('Failed to get session summary', { error: error.message });
    return null;
  }
}

/**
 * List all session summaries
 */
function listSessionSummaries() {
  try {
    const summaryDir = path.join(__dirname, '../../logs/12fa/sessions');

    if (!fs.existsSync(summaryDir)) {
      return [];
    }

    const files = fs.readdirSync(summaryDir);
    const summaries = files
      .filter(file => file.startsWith('session-') && file.endsWith('.json'))
      .map(file => {
        const data = fs.readFileSync(path.join(summaryDir, file), 'utf8');
        return JSON.parse(data);
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return summaries;
  } catch (error) {
    logger.error('Failed to list session summaries', { error: error.message });
    return [];
  }
}

/**
 * CLI interface for testing
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: session-end.hook.js [command]');
    console.log('\nCommands:');
    console.log('  test [session-id]       - Run test session end');
    console.log('  get <session-id>        - Get specific session summary');
    console.log('  list                    - List all session summaries');
    console.log('\nExample:');
    console.log('  node session-end.hook.js test');
    console.log('  node session-end.hook.js get session-123');
    console.log('  node session-end.hook.js list');
    process.exit(0);
  }

  const command = args[0];

  if (command === 'test') {
    const sessionId = args[1] || `test-session-${Date.now()}`;

    const context = {
      sessionId,
      sessionDuration: 123456
    };

    const result = await sessionEndHook(context);
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);

  } else if (command === 'get') {
    const sessionId = args[1];

    if (!sessionId) {
      console.error('Error: Session ID required');
      process.exit(1);
    }

    const summary = getSessionSummary(sessionId);
    if (summary) {
      console.log('Session Summary:');
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.error('Session not found');
      process.exit(1);
    }

  } else if (command === 'list') {
    const summaries = listSessionSummaries();
    console.log(`Found ${summaries.length} sessions:\n`);
    summaries.forEach(summary => {
      console.log(`Session: ${summary.sessionId}`);
      console.log(`  Time: ${summary.timestamp}`);
      console.log(`  Tasks: ${summary.metrics.summary.totalTasks}`);
      console.log(`  Edits: ${summary.metrics.summary.totalEdits}`);
      console.log(`  Duration: ${summary.duration}ms`);
      console.log();
    });

  } else {
    console.error('Unknown command:', command);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use as module
module.exports = {
  sessionEndHook,
  getSessionSummary,
  listSessionSummaries
};
