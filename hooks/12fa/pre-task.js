#!/usr/bin/env node

/**
 * Pre-Task Hook
 *
 * Executes before task execution to auto-assign agents, initialize session, and prepare resources.
 * Integrates with Memory MCP tagging protocol for WHO/WHEN/PROJECT/WHY tracking.
 *
 * Features:
 * - Auto-assign agent by task type (research → researcher, code → coder, test → tester)
 * - Log to Memory MCP with full metadata tagging
 * - Start session timer and initialize correlation ID
 * - Call FastAPI backend endpoint for centralized tracking
 * - WebSocket notification for real-time updates
 *
 * Usage:
 *   This hook is automatically invoked before task execution in Claude Code.
 *
 * Environment Variables:
 *   CLAUDE_FLOW_AGENT_TYPE - Agent type for context
 *   FASTAPI_BACKEND_URL - FastAPI backend URL (default: http://localhost:8000)
 *   NODE_ENV - Environment (development, production, test)
 */

const fs = require('fs');
const path = require('path');
const { getLogger } = require('./structured-logger');
const { getOrCreate, propagate } = require('./correlation-id-manager');
const { getAdapter } = require('./opentelemetry-adapter');
const { taggedMemoryStore, detectProject } = require('./memory-mcp-tagging-protocol');

// BLOCKER-4: Import budget tracker for pre-check validation
let budgetTracker, budgetCheckEnabled;
try {
  budgetTracker = require('../../../../claude-code-plugins/ruv-sparc-three-loop-system/hooks/12fa/budget-tracker.js');
  budgetCheckEnabled = true;
  console.log('[PreTask] Budget enforcement enabled');
} catch (err) {
  budgetCheckEnabled = false;
  console.warn('[PreTask] Budget tracker not available - operations will not be rate-limited');
}

// Initialize structured logger and telemetry
const logger = getLogger();
const otelAdapter = getAdapter();

/**
 * Agent auto-assignment mapping
 * Maps task type keywords to appropriate agent types
 */
const TASK_TYPE_TO_AGENT = {
  research: 'researcher',
  analyze: 'analyst',
  code: 'coder',
  implement: 'coder',
  build: 'coder',
  test: 'tester',
  validate: 'tester',
  review: 'reviewer',
  audit: 'reviewer',
  design: 'system-architect',
  architect: 'system-architect',
  plan: 'planner',
  database: 'database-design-specialist',
  api: 'api-designer',
  debug: 'coder',
  fix: 'coder',
  refactor: 'coder',
  optimize: 'perf-analyzer',
  performance: 'perf-analyzer',
  security: 'security-manager',
  deploy: 'cicd-engineer',
  documentation: 'technical-writing-agent',
  ml: 'ml-developer',
  frontend: 'react-developer',
  backend: 'backend-dev',
  mobile: 'mobile-dev'
};

/**
 * Auto-assign agent based on task description
 */
function autoAssignAgent(taskDescription) {
  if (!taskDescription) {
    return 'coder'; // Default fallback
  }

  const lowerDesc = taskDescription.toLowerCase();

  // Check for keyword matches
  for (const [keyword, agentType] of Object.entries(TASK_TYPE_TO_AGENT)) {
    if (lowerDesc.includes(keyword)) {
      return agentType;
    }
  }

  // Default to coder if no match
  return 'coder';
}

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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.warn('Failed to call backend API', {
      endpoint,
      error: error.message,
      // Don't fail the hook if backend is unavailable
      note: 'Continuing without backend integration'
    });
    return null;
  }
}

/**
 * Main hook execution
 */
async function preTaskHook(context) {
  const startTime = Date.now();

  // Generate correlation ID for this task
  const taskId = context?.taskId || `task-${Date.now()}`;
  const correlationId = getOrCreate(`pre-task-${taskId}`, 'prefixed');

  // Start OpenTelemetry span
  const span = otelAdapter.startSpan('pre-task-hook', {
    attributes: {
      'hook.type': 'pre-task',
      'task.id': taskId,
      'task.description': context?.description || 'unknown'
    }
  });

  logger.info('Pre-task hook started', {
    trace_id: correlationId,
    span_id: span.spanId,
    task_id: taskId,
    task_description: context?.description,
    operation: 'pre-task-processing'
  });

  try {
    // Auto-assign agent based on task type
    const assignedAgent = context?.agentType || autoAssignAgent(context?.description);

    const taskInfo = {
      taskId,
      description: context?.description || '',
      assignedAgent,
      project: detectProject(process.cwd(), context?.description),
      startTime: new Date().toISOString(),
      sessionId: context?.sessionId || `session-${Date.now()}`,
      parentTask: context?.parentTask || null,
      swarmId: context?.swarmId || null
    };

    span.setAttributes({
      'task.assigned_agent': assignedAgent,
      'task.project': taskInfo.project,
      'task.session_id': taskInfo.sessionId
    });

    logger.info('Agent auto-assigned', {
      trace_id: correlationId,
      span_id: span.spanId,
      task_id: taskId,
      assigned_agent: assignedAgent,
      project: taskInfo.project
    });

    // BLOCKER-4: Check budget before allowing task to proceed
    if (budgetCheckEnabled) {
      const budgetCheck = budgetTracker.checkBudget(assignedAgent, {
        estimatedTokens: context?.estimatedTokens || 10000,  // Default estimate
        estimatedCost: context?.estimatedCost || 0.01
      });

      if (!budgetCheck.allowed) {
        logger.error('Task blocked: Budget exceeded', {
          trace_id: correlationId,
          span_id: span.spanId,
          task_id: taskId,
          assigned_agent: assignedAgent,
          reason: budgetCheck.reason,
          remaining: budgetCheck.remaining
        });

        span.setAttribute('task.blocked', true);
        span.setAttribute('task.block_reason', budgetCheck.reason);
        span.addEvent('task-blocked-budget-exceeded', {
          'budget.reason': budgetCheck.reason,
          'budget.remaining.global': budgetCheck.remaining.global,
          'budget.remaining.agent': budgetCheck.remaining.agent
        });

        otelAdapter.endSpan(span);

        return {
          success: false,
          blocked: true,
          reason: budgetCheck.reason,
          budgetStatus: budgetCheck,
          trace_id: correlationId,
          span_id: span.spanId,
          timestamp: new Date().toISOString(),
          httpStatus: 429  // Too Many Requests
        };
      }

      logger.info('Budget check passed', {
        trace_id: correlationId,
        span_id: span.spanId,
        task_id: taskId,
        assigned_agent: assignedAgent,
        remaining_tokens: budgetCheck.remaining.agent
      });

      span.setAttribute('budget.check_time', budgetCheck.checkTime);
      span.setAttribute('budget.remaining.agent', budgetCheck.remaining.agent);
    }

    // Store in Memory MCP with full tagging
    const memoryData = taggedMemoryStore(assignedAgent, JSON.stringify({
      event: 'task-started',
      ...taskInfo,
      trace_id: correlationId,
      span_id: span.spanId
    }), {
      task_id: taskId,
      intent: 'planning',
      description: 'Pre-task initialization and agent assignment',
      session_id: taskInfo.sessionId,
      swarm_id: taskInfo.swarmId
    });

    // Call Memory MCP if available
    if (context?.memoryStore) {
      await context.memoryStore({
        key: `12fa/tasks/${taskId}/pre-task`,
        value: JSON.stringify(memoryData)
      });

      logger.debug('Task info stored in Memory MCP', {
        trace_id: correlationId,
        span_id: span.spanId,
        memory_key: `12fa/tasks/${taskId}/pre-task`
      });
    }

    // Call FastAPI backend endpoint
    const backendResponse = await callBackendAPI('pre-task', {
      task_id: taskId,
      assigned_agent: assignedAgent,
      description: context?.description,
      project: taskInfo.project,
      session_id: taskInfo.sessionId,
      trace_id: correlationId,
      span_id: span.spanId,
      metadata: memoryData.metadata
    });

    if (backendResponse) {
      logger.debug('Backend API notified', {
        trace_id: correlationId,
        span_id: span.spanId,
        backend_response: backendResponse
      });
    }

    // Propagate correlation ID for task execution
    propagate(`pre-task-${taskId}`, `task-${taskId}`);

    // Store session metadata
    await storeSessionMetadata(taskInfo, correlationId, span.spanId);

    const hookDuration = Date.now() - startTime;
    span.setAttribute('duration_ms', hookDuration);
    otelAdapter.endSpan(span);

    return {
      success: true,
      taskInfo,
      assignedAgent,
      hookDuration,
      trace_id: correlationId,
      span_id: span.spanId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Pre-task hook execution failed', {
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
 * Store session metadata for later retrieval
 */
async function storeSessionMetadata(taskInfo, correlationId, spanId) {
  try {
    const sessionPath = path.join(__dirname, '../../logs/12fa/sessions');

    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const sessionFile = path.join(sessionPath, `${taskInfo.sessionId}.json`);

    const sessionData = {
      sessionId: taskInfo.sessionId,
      taskId: taskInfo.taskId,
      assignedAgent: taskInfo.assignedAgent,
      project: taskInfo.project,
      startTime: taskInfo.startTime,
      trace_id: correlationId,
      span_id: spanId,
      description: taskInfo.description,
      parentTask: taskInfo.parentTask,
      swarmId: taskInfo.swarmId
    };

    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');

    logger.debug('Session metadata stored', {
      trace_id: correlationId,
      span_id: spanId,
      session_id: taskInfo.sessionId,
      session_file: sessionFile
    });

  } catch (error) {
    logger.error('Failed to store session metadata', {
      trace_id: correlationId,
      span_id: spanId,
      error: error.message
    });
  }
}

/**
 * CONTEXT POISONING FIX: Context Summarization
 *
 * Summarizes large log entries before feeding them back to LLM context.
 * Prevents exponential context growth and hallucination from verbose logs.
 *
 * @param {object} data - Raw session/log data
 * @param {object} options - Summarization options
 * @returns {object} Summarized data safe for context injection
 */
function summarizeContext(data, options = {}) {
  const {
    maxOutputLength = 500,     // Max chars for output/stderr fields
    maxErrorLength = 200,      // Max chars for error messages
    maxFilesModified = 10,     // Max files to include in list
    maxLogEntries = 5,         // Max log entries to include
    excludeFields = ['raw_output', 'full_trace', 'debug_data']  // Fields to exclude entirely
  } = options;

  if (!data || typeof data !== 'object') {
    return data;
  }

  const summarized = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip excluded fields entirely
    if (excludeFields.includes(key)) {
      summarized[key] = '[EXCLUDED_FROM_CONTEXT]';
      continue;
    }

    // Truncate string fields that could be large
    if (typeof value === 'string') {
      if (['output', 'stdout', 'stderr', 'stdout_log', 'stderr_log'].includes(key)) {
        summarized[key] = value.length > maxOutputLength
          ? value.substring(0, maxOutputLength) + `... [TRUNCATED: ${value.length} total chars]`
          : value;
      } else if (['error', 'error_message', 'exception'].includes(key)) {
        summarized[key] = value.length > maxErrorLength
          ? value.substring(0, maxErrorLength) + '... [TRUNCATED]'
          : value;
      } else {
        summarized[key] = value;
      }
      continue;
    }

    // Limit array lengths
    if (Array.isArray(value)) {
      if (['files_modified', 'files_created', 'artifacts'].includes(key)) {
        summarized[key] = value.length > maxFilesModified
          ? [...value.slice(0, maxFilesModified), `... and ${value.length - maxFilesModified} more`]
          : value;
      } else if (['logs', 'entries', 'history'].includes(key)) {
        summarized[key] = value.length > maxLogEntries
          ? [...value.slice(0, maxLogEntries), { _note: `${value.length - maxLogEntries} entries omitted` }]
          : value;
      } else {
        // Recursively summarize array items
        summarized[key] = value.map(item =>
          typeof item === 'object' ? summarizeContext(item, options) : item
        );
      }
      continue;
    }

    // Recursively handle nested objects
    if (typeof value === 'object' && value !== null) {
      summarized[key] = summarizeContext(value, options);
      continue;
    }

    // Pass through primitives unchanged
    summarized[key] = value;
  }

  return summarized;
}

/**
 * Get session metadata with context summarization
 *
 * CONTEXT POISONING FIX: Summarizes log data before returning to prevent
 * massive JSON blobs from polluting the LLM context window.
 */
function getSessionMetadata(sessionId, summarize = true) {
  try {
    const sessionFile = path.join(__dirname, '../../logs/12fa/sessions', `${sessionId}.json`);

    if (fs.existsSync(sessionFile)) {
      const data = fs.readFileSync(sessionFile, 'utf8');
      const parsed = JSON.parse(data);

      // CONTEXT POISONING FIX: Apply summarization by default
      if (summarize) {
        return summarizeContext(parsed);
      }

      return parsed;
    }

    return null;
  } catch (error) {
    logger.error('Failed to get session metadata', {
      session_id: sessionId,
      error: error.message
    });
    return null;
  }
}

/**
 * CLI interface for testing
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: pre-task.js [command]');
    console.log('\nCommands:');
    console.log('  test <description>      - Run test with task description');
    console.log('  session <sessionId>     - Get session metadata');
    console.log('\nExample:');
    console.log('  node pre-task.js test "Implement authentication API"');
    console.log('  node pre-task.js session session-123456');
    process.exit(0);
  }

  const command = args[0];

  if (command === 'test') {
    const description = args[1] || 'Test task execution';

    const context = {
      taskId: 'test-task-' + Date.now(),
      description,
      sessionId: 'test-session-' + Date.now()
    };

    const result = await preTaskHook(context);
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);

  } else if (command === 'session') {
    const sessionId = args[1];

    if (!sessionId) {
      console.error('Error: sessionId required');
      process.exit(1);
    }

    const metadata = getSessionMetadata(sessionId);
    console.log('Session Metadata:');
    console.log(JSON.stringify(metadata, null, 2));
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
  preTaskHook,
  getSessionMetadata,
  autoAssignAgent,
  summarizeContext,  // CONTEXT POISONING FIX: Export for use in other hooks
  TASK_TYPE_TO_AGENT
};
