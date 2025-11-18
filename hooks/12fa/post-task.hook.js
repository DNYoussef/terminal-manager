#!/usr/bin/env node

/**
 * Post-Task Hook
 *
 * Executes after task completion to log results, metrics, and propagate context.
 * Integrates with structured logging and OpenTelemetry for comprehensive observability.
 *
 * Usage:
 *   This hook is automatically invoked after task completion in Claude Code.
 *
 * Environment Variables:
 *   CLAUDE_FLOW_AGENT_TYPE - Agent type for context
 *   NODE_ENV - Environment (development, production, test)
 */

const fs = require('fs');
const path = require('path');
const { getLogger } = require('./structured-logger');
const { getOrCreate, propagate, get } = require('./correlation-id-manager');
const { getAdapter } = require('./opentelemetry-adapter');

// Initialize structured logger and telemetry
const logger = getLogger();
const otelAdapter = getAdapter();

/**
 * Main hook execution
 */
async function postTaskHook(context) {
  const startTime = Date.now();

  // Retrieve or create correlation ID (should exist from pre-task)
  const correlationId = getOrCreate('post-task-hook', 'prefixed');

  // Try to get pre-task correlation ID for continuity
  const preTaskCorrelationId = get('pre-task-hook');
  const actualCorrelationId = preTaskCorrelationId || correlationId;

  // Start OpenTelemetry span
  const span = otelAdapter.startSpan('post-task-hook', {
    attributes: {
      'hook.type': 'post-task',
      'task.id': context?.taskId || 'unknown',
      'agent.id': context?.agentId || 'unknown',
      'agent.type': context?.agentType || process.env.CLAUDE_FLOW_AGENT_TYPE || 'unknown',
      'task.status': context?.status || 'unknown'
    }
  });

  logger.info('Post-task hook started', {
    trace_id: actualCorrelationId,
    span_id: span.spanId,
    task_id: context?.taskId,
    agent_id: context?.agentId,
    agent_type: context?.agentType,
    operation: 'post-task-processing'
  });

  try {
    // Extract task results
    const taskResult = {
      taskId: context?.taskId,
      agentId: context?.agentId,
      agentType: context?.agentType,
      status: context?.status || 'completed',
      duration: context?.duration,
      error: context?.error,
      output: context?.output,
      filesModified: context?.filesModified || [],
      commandsExecuted: context?.commandsExecuted || 0,
      timestamp: new Date().toISOString()
    };

    // Add task attributes to span
    span.setAttributes({
      'task.status': taskResult.status,
      'task.duration': taskResult.duration || 0,
      'task.files_modified': taskResult.filesModified.length,
      'task.commands_executed': taskResult.commandsExecuted
    });

    // Log task completion
    if (taskResult.status === 'completed' || taskResult.status === 'success') {
      logger.info('Task completed successfully', {
        trace_id: actualCorrelationId,
        span_id: span.spanId,
        ...taskResult
      });

      span.setAttribute('task.result', 'success');
      span.addEvent('task-completed', {
        'task.files': taskResult.filesModified.length,
        'task.commands': taskResult.commandsExecuted
      });
    } else if (taskResult.status === 'failed' || taskResult.error) {
      logger.error('Task failed', {
        trace_id: actualCorrelationId,
        span_id: span.spanId,
        error: taskResult.error,
        ...taskResult
      });

      span.setAttribute('task.result', 'failed');
      span.addEvent('task-failed', {
        'error.message': taskResult.error?.message || 'Unknown error'
      });

      if (taskResult.error) {
        span.recordException(taskResult.error);
      }
    } else {
      logger.warn('Task completed with unknown status', {
        trace_id: actualCorrelationId,
        span_id: span.spanId,
        ...taskResult
      });

      span.setAttribute('task.result', 'unknown');
    }

    // Propagate correlation ID for next task
    if (context?.nextTaskId) {
      propagate('post-task-hook', `pre-task-${context.nextTaskId}`);

      logger.debug('Correlation ID propagated to next task', {
        trace_id: actualCorrelationId,
        span_id: span.spanId,
        next_task_id: context.nextTaskId
      });
    }

    // Store task results in memory for audit
    if (context?.memoryStore) {
      await context.memoryStore({
        key: `12fa/tasks/${taskResult.taskId}/result`,
        value: JSON.stringify({
          ...taskResult,
          trace_id: actualCorrelationId,
          span_id: span.spanId
        })
      });

      logger.debug('Task results stored in memory', {
        trace_id: actualCorrelationId,
        span_id: span.spanId,
        memory_key: `12fa/tasks/${taskResult.taskId}/result`
      });
    }

    // Calculate metrics
    const hookDuration = Date.now() - startTime;
    span.setAttribute('duration_ms', hookDuration);

    // Update task metrics file
    await updateTaskMetrics(taskResult, actualCorrelationId, span.spanId);

    otelAdapter.endSpan(span);

    return {
      success: true,
      taskResult,
      hookDuration,
      trace_id: actualCorrelationId,
      span_id: span.spanId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Post-task hook execution failed', {
      trace_id: actualCorrelationId,
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
      trace_id: actualCorrelationId,
      span_id: span.spanId,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Update task metrics in persistent storage
 */
async function updateTaskMetrics(taskResult, correlationId, spanId) {
  try {
    const metricsPath = path.join(__dirname, '../../logs/12fa/task-metrics.json');

    let metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalDuration: 0,
      averageDuration: 0,
      lastTask: null,
      tasks: {}
    };

    // Load existing metrics
    if (fs.existsSync(metricsPath)) {
      const data = fs.readFileSync(metricsPath, 'utf8');
      metrics = JSON.parse(data);
    }

    // Update metrics
    metrics.totalTasks++;
    if (taskResult.status === 'completed' || taskResult.status === 'success') {
      metrics.successfulTasks++;
    } else if (taskResult.status === 'failed') {
      metrics.failedTasks++;
    }

    if (taskResult.duration) {
      metrics.totalDuration += taskResult.duration;
      metrics.averageDuration = metrics.totalDuration / metrics.totalTasks;
    }

    metrics.lastTask = new Date().toISOString();
    metrics.tasks[taskResult.taskId] = {
      ...taskResult,
      trace_id: correlationId,
      span_id: spanId
    };

    // Save metrics
    const metricsDir = path.dirname(metricsPath);
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), 'utf8');

    logger.debug('Task metrics updated', {
      trace_id: correlationId,
      span_id: spanId,
      total_tasks: metrics.totalTasks,
      success_rate: (metrics.successfulTasks / metrics.totalTasks * 100).toFixed(2) + '%'
    });

  } catch (error) {
    logger.error('Failed to update task metrics', {
      trace_id: correlationId,
      span_id: spanId,
      error: error.message
    });
  }
}

/**
 * Get task metrics
 */
function getTaskMetrics() {
  try {
    const metricsPath = path.join(__dirname, '../../logs/12fa/task-metrics.json');

    if (fs.existsSync(metricsPath)) {
      const data = fs.readFileSync(metricsPath, 'utf8');
      return JSON.parse(data);
    }

    return null;
  } catch (error) {
    logger.error('Failed to get task metrics', { error: error.message });
    return null;
  }
}

/**
 * CLI interface for testing
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: post-task.hook.js [command]');
    console.log('\nCommands:');
    console.log('  test                    - Run test with sample task');
    console.log('  metrics                 - Show task metrics');
    console.log('\nExample:');
    console.log('  node post-task.hook.js test');
    console.log('  node post-task.hook.js metrics');
    process.exit(0);
  }

  const command = args[0];

  if (command === 'test') {
    const context = {
      taskId: 'test-task-' + Date.now(),
      agentId: 'test-agent',
      agentType: 'coder',
      status: 'completed',
      duration: 1234,
      filesModified: ['file1.js', 'file2.js'],
      commandsExecuted: 5
    };

    const result = await postTaskHook(context);
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);

  } else if (command === 'metrics') {
    const metrics = getTaskMetrics();
    console.log('Task Metrics:');
    console.log(JSON.stringify(metrics, null, 2));
    process.exit(0);

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
  postTaskHook,
  getTaskMetrics
};
