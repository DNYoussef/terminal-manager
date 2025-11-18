#!/usr/bin/env node

/**
 * Post-Edit Hook
 *
 * Executes after file edit operations to track changes, validate edits, and maintain audit trail.
 * Integrates with structured logging and OpenTelemetry for comprehensive observability.
 *
 * Usage:
 *   This hook is automatically invoked after file edits in Claude Code.
 *
 * Environment Variables:
 *   CLAUDE_FLOW_AGENT_TYPE - Agent type for context
 *   NODE_ENV - Environment (development, production, test)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getLogger } = require('./structured-logger');
const { getOrCreate, propagate } = require('./correlation-id-manager');
const { getAdapter } = require('./opentelemetry-adapter');

// Initialize structured logger and telemetry
const logger = getLogger();
const otelAdapter = getAdapter();

/**
 * Main hook execution
 */
async function postEditHook(context) {
  const startTime = Date.now();

  // Generate or retrieve correlation ID
  const correlationId = getOrCreate('post-edit-hook', 'prefixed');

  // Start OpenTelemetry span
  const span = otelAdapter.startSpan('post-edit-hook', {
    attributes: {
      'hook.type': 'post-edit',
      'file.path': context?.filePath || 'unknown',
      'agent.id': context?.agentId || 'unknown',
      'edit.type': context?.editType || 'unknown'
    }
  });

  logger.info('Post-edit hook started', {
    trace_id: correlationId,
    span_id: span.spanId,
    file_path: context?.filePath,
    agent_id: context?.agentId,
    operation: 'post-edit-processing'
  });

  try {
    const filePath = context?.filePath;

    if (!filePath) {
      throw new Error('No file path provided');
    }

    // Get file stats
    const fileStats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;

    const editInfo = {
      filePath,
      agentId: context?.agentId,
      agentType: context?.agentType || process.env.CLAUDE_FLOW_AGENT_TYPE,
      editType: context?.editType || 'modify',
      linesBefore: context?.linesBefore || 0,
      linesAfter: context?.linesAfter || 0,
      bytesBefore: context?.bytesBefore || 0,
      bytesAfter: fileStats ? fileStats.size : 0,
      timestamp: new Date().toISOString()
    };

    // Calculate changes
    const linesChanged = Math.abs(editInfo.linesAfter - editInfo.linesBefore);
    const bytesChanged = Math.abs(editInfo.bytesAfter - editInfo.bytesBefore);

    // Add edit attributes to span
    span.setAttributes({
      'file.size': editInfo.bytesAfter,
      'file.lines_changed': linesChanged,
      'file.bytes_changed': bytesChanged,
      'edit.type': editInfo.editType
    });

    // Calculate file hash for integrity tracking
    let fileHash = null;
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');
      span.setAttribute('file.hash', fileHash.substring(0, 16));
    }

    logger.info('File edit processed', {
      trace_id: correlationId,
      span_id: span.spanId,
      file_path: filePath,
      lines_changed: linesChanged,
      bytes_changed: bytesChanged,
      file_hash: fileHash ? fileHash.substring(0, 16) : null
    });

    span.addEvent('file-edited', {
      'lines.changed': linesChanged,
      'bytes.changed': bytesChanged
    });

    // Propagate correlation ID for related operations
    propagate('post-edit-hook', `file-edit-${path.basename(filePath)}`);

    // Store edit information in memory
    if (context?.memoryStore) {
      await context.memoryStore({
        key: `12fa/edits/${Date.now()}-${path.basename(filePath)}`,
        value: JSON.stringify({
          ...editInfo,
          linesChanged,
          bytesChanged,
          fileHash,
          trace_id: correlationId,
          span_id: span.spanId
        })
      });

      logger.debug('Edit information stored in memory', {
        trace_id: correlationId,
        span_id: span.spanId
      });
    }

    // Update edit metrics
    await updateEditMetrics(editInfo, linesChanged, bytesChanged, correlationId, span.spanId);

    const hookDuration = Date.now() - startTime;
    span.setAttribute('duration_ms', hookDuration);
    otelAdapter.endSpan(span);

    return {
      success: true,
      editInfo: {
        ...editInfo,
        linesChanged,
        bytesChanged,
        fileHash
      },
      hookDuration,
      trace_id: correlationId,
      span_id: span.spanId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Post-edit hook execution failed', {
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
 * Update edit metrics in persistent storage
 */
async function updateEditMetrics(editInfo, linesChanged, bytesChanged, correlationId, spanId) {
  try {
    const metricsPath = path.join(__dirname, '../../logs/12fa/edit-metrics.json');

    let metrics = {
      totalEdits: 0,
      totalLinesChanged: 0,
      totalBytesChanged: 0,
      filesByType: {},
      editsByAgent: {},
      lastEdit: null
    };

    // Load existing metrics
    if (fs.existsSync(metricsPath)) {
      const data = fs.readFileSync(metricsPath, 'utf8');
      metrics = JSON.parse(data);
    }

    // Update metrics
    metrics.totalEdits++;
    metrics.totalLinesChanged += linesChanged;
    metrics.totalBytesChanged += bytesChanged;
    metrics.lastEdit = new Date().toISOString();

    // Track by file type
    const fileExt = path.extname(editInfo.filePath) || 'no-extension';
    if (!metrics.filesByType[fileExt]) {
      metrics.filesByType[fileExt] = { count: 0, linesChanged: 0, bytesChanged: 0 };
    }
    metrics.filesByType[fileExt].count++;
    metrics.filesByType[fileExt].linesChanged += linesChanged;
    metrics.filesByType[fileExt].bytesChanged += bytesChanged;

    // Track by agent
    const agentId = editInfo.agentId || 'unknown';
    if (!metrics.editsByAgent[agentId]) {
      metrics.editsByAgent[agentId] = { count: 0, linesChanged: 0, bytesChanged: 0 };
    }
    metrics.editsByAgent[agentId].count++;
    metrics.editsByAgent[agentId].linesChanged += linesChanged;
    metrics.editsByAgent[agentId].bytesChanged += bytesChanged;

    // Save metrics
    const metricsDir = path.dirname(metricsPath);
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), 'utf8');

    logger.debug('Edit metrics updated', {
      trace_id: correlationId,
      span_id: spanId,
      total_edits: metrics.totalEdits,
      total_lines: metrics.totalLinesChanged
    });

  } catch (error) {
    logger.error('Failed to update edit metrics', {
      trace_id: correlationId,
      span_id: spanId,
      error: error.message
    });
  }
}

/**
 * Get edit metrics
 */
function getEditMetrics() {
  try {
    const metricsPath = path.join(__dirname, '../../logs/12fa/edit-metrics.json');

    if (fs.existsSync(metricsPath)) {
      const data = fs.readFileSync(metricsPath, 'utf8');
      return JSON.parse(data);
    }

    return null;
  } catch (error) {
    logger.error('Failed to get edit metrics', { error: error.message });
    return null;
  }
}

/**
 * CLI interface for testing
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: post-edit.hook.js [command]');
    console.log('\nCommands:');
    console.log('  test <filepath>         - Run test with sample edit');
    console.log('  metrics                 - Show edit metrics');
    console.log('\nExample:');
    console.log('  node post-edit.hook.js test example.js');
    console.log('  node post-edit.hook.js metrics');
    process.exit(0);
  }

  const command = args[0];

  if (command === 'test') {
    const filePath = args[1] || __filename;

    const context = {
      filePath,
      agentId: 'test-agent',
      agentType: 'coder',
      editType: 'modify',
      linesBefore: 100,
      linesAfter: 120,
      bytesBefore: 5000
    };

    const result = await postEditHook(context);
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);

  } else if (command === 'metrics') {
    const metrics = getEditMetrics();
    console.log('Edit Metrics:');
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
  postEditHook,
  getEditMetrics
};
