#!/usr/bin/env node
/**
 * Visibility Pipeline - Hooks → Backend Integration
 * Logs task completion events to backend for real-time visibility
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const LOG_DIR = path.join(__dirname, '../../logs');

async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists
  }
}

async function logToFile(event, data) {
  await ensureLogDir();
  const timestamp = new Date().toISOString();
  const logFile = path.join(LOG_DIR, `visibility-${timestamp.split('T')[0]}.log`);
  const logEntry = JSON.stringify({ timestamp, event, ...data }, null, 2);
  await fs.appendFile(logFile, logEntry + '\n', 'utf8');
}

async function sendToBackend(event, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      event_type: event,
      timestamp: new Date().toISOString(),
      data
    });

    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[Visibility] Event logged to backend: ${event}`);
          resolve({ success: true, status: res.statusCode });
        } else {
          reject(new Error(`Backend error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  const [event, taskId, agentType, durationMs] = process.argv.slice(2);

  if (!event) {
    console.error('Usage: node visibility-pipeline.js <event> <task-id> <agent-type> <duration>');
    process.exit(1);
  }

  const eventData = {
    task_id: taskId || 'unknown',
    agent_type: agentType || 'unknown',
    duration_ms: parseInt(durationMs) || 0,
    source: 'hooks-pipeline'
  };

  try {
    await sendToBackend(event, eventData);
  } catch (err) {
    console.warn(`[Visibility] Backend unavailable, logging to file: ${err.message}`);
    await logToFile(event, eventData);
  }

  console.log(`[Visibility] Event processed: ${event}`);
  process.exit(0);
}

main().catch(err => {
  console.error(`[Visibility] Fatal error: ${err.message}`);
  process.exit(1);
});
