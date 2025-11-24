#!/usr/bin/env node
/**
 * Unified Backend Client for Hook Integration
 * Provides consistent API calling with retry logic, timeouts, and graceful degradation
 *
 * Phase 2: Context Preservation Infrastructure
 * Used by all hooks to send events to backend for database persistence
 */

const http = require('http');

// Configuration from environment or defaults
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '8000', 10);
const BACKEND_TIMEOUT = parseInt(process.env.BACKEND_TIMEOUT || '5000', 10);
const MAX_RETRIES = parseInt(process.env.BACKEND_MAX_RETRIES || '3', 10);
const INITIAL_BACKOFF_MS = 1000;
const ENABLE_BACKEND_PERSISTENCE = process.env.ENABLE_BACKEND_PERSISTENCE !== 'false'; // Default: enabled

/**
 * Make HTTP request to backend
 */
function makeRequest(options, data, timeout = BACKEND_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({
              statusCode: res.statusCode,
              body: body ? JSON.parse(body) : null
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              body: body
            });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Call backend API with retry logic and exponential backoff
 */
async function callBackendAPI(endpoint, data, options = {}) {
  // Check if backend persistence is disabled
  if (!ENABLE_BACKEND_PERSISTENCE) {
    console.log('[Backend] Persistence disabled via ENABLE_BACKEND_PERSISTENCE=false');
    return { success: false, reason: 'disabled', data: null };
  }

  const method = options.method || 'POST';
  const timeout = options.timeout || BACKEND_TIMEOUT;
  const retries = options.retries !== undefined ? options.retries : MAX_RETRIES;

  const requestOptions = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: endpoint,
    method: method,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };

  let lastError = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = await makeRequest(requestOptions, data, timeout);

      if (attempt > 1) {
        console.log(`[Backend] Success on attempt ${attempt} for ${endpoint}`);
      }

      return {
        success: true,
        statusCode: result.statusCode,
        data: result.body,
        attempt: attempt
      };

    } catch (error) {
      lastError = error;

      if (attempt <= retries) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.warn(`[Backend] Attempt ${attempt}/${retries + 1} failed for ${endpoint}: ${error.message}`);
        console.warn(`[Backend] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  // All retries exhausted
  console.error(`[Backend] All ${retries + 1} attempts failed for ${endpoint}`);
  console.error(`[Backend] Final error: ${lastError.message}`);

  return {
    success: false,
    error: lastError.message,
    attempt: retries + 1
  };
}

/**
 * Ingest event to backend (POST /api/v1/events/ingest)
 */
async function ingestEvent(eventData) {
  return callBackendAPI('/api/v1/events/ingest', eventData);
}

/**
 * Send batch of events to backend
 */
async function ingestEventBatch(events) {
  return callBackendAPI('/api/v1/events/ingest/batch', { events });
}

/**
 * Update session in backend (POST /api/v1/sessions/{session_id})
 */
async function updateSession(sessionId, sessionData) {
  return callBackendAPI(`/api/v1/sessions/${sessionId}`, sessionData, { method: 'POST' });
}

/**
 * Get session summary from backend
 */
async function getSessionSummary(sessionId) {
  return callBackendAPI(`/api/v1/sessions/${sessionId}`, null, { method: 'GET' });
}

/**
 * Health check - verify backend is reachable
 */
async function healthCheck() {
  return callBackendAPI('/health', null, {
    method: 'GET',
    timeout: 2000,
    retries: 0
  });
}

/**
 * Test connectivity and log result
 */
async function testConnection() {
  console.log(`[Backend] Testing connection to ${BACKEND_HOST}:${BACKEND_PORT}...`);
  const result = await healthCheck();

  if (result.success) {
    console.log('[Backend] Connection successful');
    return true;
  } else {
    console.warn('[Backend] Connection failed:', result.error);
    return false;
  }
}

/**
 * Get backend configuration
 */
function getConfig() {
  return {
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    timeout: BACKEND_TIMEOUT,
    maxRetries: MAX_RETRIES,
    initialBackoffMs: INITIAL_BACKOFF_MS,
    persistenceEnabled: ENABLE_BACKEND_PERSISTENCE
  };
}

module.exports = {
  callBackendAPI,
  ingestEvent,
  ingestEventBatch,
  updateSession,
  getSessionSummary,
  healthCheck,
  testConnection,
  getConfig
};

// CLI test interface
if (require.main === module) {
  (async () => {
    console.log('Backend Client Configuration:');
    console.log(JSON.stringify(getConfig(), null, 2));
    console.log();

    // Test connection
    const connected = await testConnection();

    if (connected) {
      console.log('\nTesting event ingestion...');
      const testEvent = {
        event_type: 'test',
        agent_id: 'backend-client-test',
        timestamp: new Date().toISOString(),
        metadata: {
          test: true,
          source: 'backend-client.js'
        }
      };

      const result = await ingestEvent(testEvent);
      console.log('Ingestion result:', JSON.stringify(result, null, 2));

      process.exit(result.success ? 0 : 1);
    } else {
      console.error('\nBackend unreachable - events will be logged to files only');
      process.exit(1);
    }
  })();
}
