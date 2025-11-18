#!/usr/bin/env node

/**
 * Post-Task Hook (Enhanced with Backend Integration)
 *
 * Executes after task completion to log results, metrics, and propagate context.
 * Features:
 * - Memory MCP integration with full tagging protocol
 * - FastAPI backend notification for centralized tracking
 * - WebSocket broadcasting for real-time updates
 * - Structured logging and OpenTelemetry instrumentation
 *
 * Environment Variables:
 *   FASTAPI_BACKEND_URL - FastAPI backend URL (default: http://localhost:8000)
 *   CLAUDE_FLOW_AGENT_TYPE - Agent type for context
 */

const fs = require('fs');
const path = require('path');
const { getLogger } = require('./structured-logger');
const { getOrCreate, propagate, get } = require('./correlation-id-manager');
const { getAdapter } = require('./opentelemetry-adapter');
const { taggedMemoryStore } = require('./memory-mcp-tagging-protocol');

const logger = getLogger();
const otelAdapter = getAdapter();

/**
 * Call FastAPI backend endpoint
 */
async function callBackendAPI(endpoint, data) {
  try {
    const backendUrl = process.env.FASTAPI_BACKEND_URL || 'http://localhost:8000';
    const url = `${backendUrl}/api/v1/hooks/${endpoint}`;

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.warn('Backend API unavailable', { endpoint, error: error.message });
    return null;
  }
}

async function postTaskHook(context) {
  const startTime = Date.now();
  const correlationId = get(`pre-task-${context?.taskId}`) || getOrCreate('post-task-hook', 'prefixed');

  const span = otelAdapter.startSpan('post-task-hook', {
    attributes: {
      'hook.type': 'post-task',
      'task.id': context?.taskId || 'unknown',
      'task.status': context?.status || 'unknown'
    }
  });

  logger.info('Post-task hook started', {
    trace_id: correlationId,
    span_id: span.spanId,
    task_id: context?.taskId
  });

  try {
    const taskResult = {
      taskId: context?.taskId,
      agentId: context?.agentId,
      agentType: context?.agentType || process.env.CLAUDE_FLOW_AGENT_TYPE || 'coder',
      status: context?.status || 'completed',
      duration: context?.duration,
      error: context?.error,
      output: context?.output,
      filesModified: context?.filesModified || [],
      commandsExecuted: context?.commandsExecuted || 0,
      timestamp: new Date().toISOString()
    };

    span.setAttributes({
      'task.status': taskResult.status,
      'task.duration': taskResult.duration || 0,
      'task.files_modified': taskResult.filesModified.length
    });

    // Store in Memory MCP with tagging
    const memoryData = taggedMemoryStore(
      taskResult.agentType,
      JSON.stringify({
        event: 'task-completed',
        ...taskResult,
        trace_id: correlationId,
        span_id: span.spanId
      }),
      {
        task_id: taskResult.taskId,
        intent: taskResult.status === 'completed' ? 'implementation' : 'bugfix',
        description: 'Post-task completion and result logging'
      }
    );

    if (context?.memoryStore) {
      await context.memoryStore({
        key: `12fa/tasks/${taskResult.taskId}/result`,
        value: JSON.stringify(memoryData)
      });
    }

    // Call FastAPI backend
    const backendResponse = await callBackendAPI('post-task', {
      task_id: taskResult.taskId,
      agent_id: taskResult.agentId || 'unknown',
      agent_type: taskResult.agentType,
      status: taskResult.status,
      duration: taskResult.duration,
      error: taskResult.error?.message || taskResult.error,
      output: taskResult.output,
      files_modified: taskResult.filesModified,
      commands_executed: taskResult.commandsExecuted,
      trace_id: correlationId,
      span_id: span.spanId
    });

    if (backendResponse) {
      logger.debug('Backend notified', { backend_response: backendResponse });
    }

    // Update metrics
    await updateTaskMetrics(taskResult, correlationId, span.spanId);

    const hookDuration = Date.now() - startTime;
    span.setAttribute('duration_ms', hookDuration);
    otelAdapter.endSpan(span);

    logger.info('Post-task hook completed', {
      trace_id: correlationId,
      task_status: taskResult.status,
      duration_ms: hookDuration
    });

    return {
      success: true,
      taskResult,
      hookDuration,
      trace_id: correlationId,
      span_id: span.spanId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Post-task hook failed', {
      trace_id: correlationId,
      error: error.message
    });

    span.recordException(error);
    otelAdapter.endSpan(span);

    return {
      success: false,
      error: error.message,
      trace_id: correlationId,
      timestamp: new Date().toISOString()
    };
  }
}

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

    if (fs.existsSync(metricsPath)) {
      metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    }

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

    const metricsDir = path.dirname(metricsPath);
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), 'utf8');

  } catch (error) {
    logger.error('Failed to update task metrics', { error: error.message });
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: post-task-enhanced.js test');
    process.exit(0);
  }

  if (args[0] === 'test') {
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
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { postTaskHook };
