#!/usr/bin/env node

/**
 * Post-Edit Hook (Enhanced with Auto-Format and WebSocket)
 *
 * Executes after file edit operations.
 * Features:
 * - Auto-format code using Prettier (if available)
 * - Memory MCP integration with full tagging
 * - FastAPI backend notification
 * - WebSocket broadcasting for real-time updates
 * - File integrity tracking (SHA256 hash)
 *
 * Environment Variables:
 *   FASTAPI_BACKEND_URL - FastAPI backend URL
 *   AUTO_FORMAT_ENABLED - Enable auto-formatting (default: true)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { getLogger } = require('./structured-logger');
const { getOrCreate, propagate } = require('./correlation-id-manager');
const { getAdapter } = require('./opentelemetry-adapter');
const { taggedMemoryStore } = require('./memory-mcp-tagging-protocol');

const logger = getLogger();
const otelAdapter = getAdapter();

/**
 * Auto-format code file
 */
function autoFormatFile(filePath) {
  if (process.env.AUTO_FORMAT_ENABLED === 'false') {
    return false;
  }

  const ext = path.extname(filePath);
  const formattableExts = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.css', '.scss', '.html'];

  if (!formattableExts.includes(ext)) {
    return false;
  }

  try {
    // Try Prettier first
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore' });
    logger.debug('File auto-formatted with Prettier', { file_path: filePath });
    return true;
  } catch (error) {
    logger.debug('Prettier not available, skipping format', { file_path: filePath });
    return false;
  }
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

async function postEditHook(context) {
  const startTime = Date.now();
  const correlationId = getOrCreate('post-edit-hook', 'prefixed');

  const span = otelAdapter.startSpan('post-edit-hook', {
    attributes: {
      'hook.type': 'post-edit',
      'file.path': context?.filePath || 'unknown',
      'edit.type': context?.editType || 'unknown'
    }
  });

  logger.info('Post-edit hook started', {
    trace_id: correlationId,
    span_id: span.spanId,
    file_path: context?.filePath
  });

  try {
    const filePath = context?.filePath;

    if (!filePath) {
      throw new Error('No file path provided');
    }

    // Auto-format the file
    const wasFormatted = autoFormatFile(filePath);

    // Get updated file stats
    const fileStats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    const fileContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');

    // Count lines in file
    const linesAfter = fileContent.split('\n').length;

    const editInfo = {
      filePath,
      agentId: context?.agentId || 'unknown',
      agentType: context?.agentType || process.env.CLAUDE_FLOW_AGENT_TYPE || 'coder',
      editType: context?.editType || 'modify',
      linesBefore: context?.linesBefore || 0,
      linesAfter: linesAfter,
      bytesBefore: context?.bytesBefore || 0,
      bytesAfter: fileStats ? fileStats.size : 0,
      fileHash: fileHash.substring(0, 16),
      wasFormatted,
      timestamp: new Date().toISOString()
    };

    const linesChanged = Math.abs(editInfo.linesAfter - editInfo.linesBefore);
    const bytesChanged = Math.abs(editInfo.bytesAfter - editInfo.bytesBefore);

    span.setAttributes({
      'file.size': editInfo.bytesAfter,
      'file.lines_changed': linesChanged,
      'file.formatted': wasFormatted
    });

    logger.info('File edit processed', {
      trace_id: correlationId,
      file_path: filePath,
      lines_changed: linesChanged,
      bytes_changed: bytesChanged,
      was_formatted: wasFormatted
    });

    // Store in Memory MCP with tagging
    const memoryData = taggedMemoryStore(
      editInfo.agentType,
      JSON.stringify({
        event: 'file-edited',
        ...editInfo,
        linesChanged,
        bytesChanged,
        trace_id: correlationId,
        span_id: span.spanId
      }),
      {
        intent: 'implementation',
        description: `File edit: ${path.basename(filePath)}`
      }
    );

    if (context?.memoryStore) {
      await context.memoryStore({
        key: `12fa/edits/${Date.now()}-${path.basename(filePath)}`,
        value: JSON.stringify(memoryData)
      });
    }

    // Call FastAPI backend
    const backendResponse = await callBackendAPI('post-edit', {
      file_path: filePath,
      agent_id: editInfo.agentId,
      agent_type: editInfo.agentType,
      edit_type: editInfo.editType,
      lines_before: editInfo.linesBefore,
      lines_after: editInfo.linesAfter,
      bytes_before: editInfo.bytesBefore,
      bytes_after: editInfo.bytesAfter,
      file_hash: editInfo.fileHash,
      trace_id: correlationId,
      span_id: span.spanId
    });

    if (backendResponse) {
      logger.debug('Backend notified', { backend_response: backendResponse });
    }

    // Update edit metrics
    await updateEditMetrics(editInfo, linesChanged, bytesChanged, correlationId, span.spanId);

    const hookDuration = Date.now() - startTime;
    span.setAttribute('duration_ms', hookDuration);
    otelAdapter.endSpan(span);

    return {
      success: true,
      editInfo: { ...editInfo, linesChanged, bytesChanged },
      hookDuration,
      trace_id: correlationId,
      span_id: span.spanId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Post-edit hook failed', {
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

    if (fs.existsSync(metricsPath)) {
      metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    }

    metrics.totalEdits++;
    metrics.totalLinesChanged += linesChanged;
    metrics.totalBytesChanged += bytesChanged;
    metrics.lastEdit = new Date().toISOString();

    const fileExt = path.extname(editInfo.filePath) || 'no-extension';
    if (!metrics.filesByType[fileExt]) {
      metrics.filesByType[fileExt] = { count: 0, linesChanged: 0, bytesChanged: 0 };
    }
    metrics.filesByType[fileExt].count++;
    metrics.filesByType[fileExt].linesChanged += linesChanged;
    metrics.filesByType[fileExt].bytesChanged += bytesChanged;

    const agentId = editInfo.agentId || 'unknown';
    if (!metrics.editsByAgent[agentId]) {
      metrics.editsByAgent[agentId] = { count: 0, linesChanged: 0, bytesChanged: 0 };
    }
    metrics.editsByAgent[agentId].count++;
    metrics.editsByAgent[agentId].linesChanged += linesChanged;
    metrics.editsByAgent[agentId].bytesChanged += bytesChanged;

    const metricsDir = path.dirname(metricsPath);
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), 'utf8');

  } catch (error) {
    logger.error('Failed to update edit metrics', { error: error.message });
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: post-edit-enhanced.js test <filepath>');
    process.exit(0);
  }

  if (args[0] === 'test') {
    const filePath = args[1] || __filename;

    const context = {
      filePath,
      agentId: 'test-agent',
      agentType: 'coder',
      editType: 'modify',
      linesBefore: 100,
      bytesBefore: 5000
    };

    const result = await postEditHook(context);
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

module.exports = { postEditHook };
