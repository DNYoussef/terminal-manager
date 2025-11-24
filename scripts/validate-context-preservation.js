#!/usr/bin/env node
/**
 * Context Preservation Validation Script
 * Measures actual percentage of events with full WHO/WHEN/PROJECT/WHY metadata
 *
 * Target: 95% of events fully tagged with:
 * - WHO: agent_id, agent_type
 * - WHEN: timestamp
 * - PROJECT: project field
 * - WHY: intent field
 * - CORRELATION: trace_id
 */

const http = require('http');

// Configuration
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '8000', 10);
const SAMPLE_SIZE = parseInt(process.env.SAMPLE_SIZE || '100', 10);

/**
 * Make HTTP request to backend
 */
function httpRequest(options) {
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
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Get recent events from backend
 */
async function getRecentEvents(limit = SAMPLE_SIZE) {
  try {
    const result = await httpRequest({
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: `/api/v1/events/recent?limit=${limit}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return result.body.events || result.body || [];
  } catch (error) {
    console.error('Failed to fetch events from backend:', error.message);
    console.error('Make sure backend is running on', `${BACKEND_HOST}:${BACKEND_PORT}`);
    return [];
  }
}

/**
 * Check if event has complete metadata
 */
function validateEventMetadata(event) {
  const metadata = event.metadata || event.event_metadata || {};

  const checks = {
    hasWHO: !!(event.agent_id && event.agent_type),
    hasWHEN: !!event.timestamp,
    hasPROJECT: !!event.project,
    hasWHY: !!event.intent,
    hasCorrelation: !!(metadata.trace_id || event.trace_id)
  };

  const score = Object.values(checks).filter(Boolean).length;

  return {
    ...checks,
    score,
    isFullyTagged: score === 5
  };
}

/**
 * Main validation function
 */
async function validateContextPreservation() {
  console.log('===============================================');
  console.log('  Context Preservation Validation');
  console.log('  Target: 95% of events fully tagged');
  console.log('===============================================\n');

  console.log(`Fetching ${SAMPLE_SIZE} recent events from backend...`);
  const events = await getRecentEvents(SAMPLE_SIZE);

  if (events.length === 0) {
    console.error('\nNo events found. Possible reasons:');
    console.error('1. Backend not running');
    console.error('2. No events have been ingested yet');
    console.error('3. Database connection issue');
    process.exit(1);
  }

  console.log(`Analyzing ${events.length} events...\n`);

  // Analyze each event
  let fullyTagged = 0;
  let partiallyTagged = 0;
  let untagged = 0;

  const categoryBreakdown = {
    WHO: 0,
    WHEN: 0,
    PROJECT: 0,
    WHY: 0,
    CORRELATION: 0
  };

  const eventTypeCounts = {};

  for (const event of events) {
    const validation = validateEventMetadata(event);

    if (validation.isFullyTagged) {
      fullyTagged++;
    } else if (validation.score >= 3) {
      partiallyTagged++;
    } else {
      untagged++;
    }

    // Track category coverage
    if (validation.hasWHO) categoryBreakdown.WHO++;
    if (validation.hasWHEN) categoryBreakdown.WHEN++;
    if (validation.hasPROJECT) categoryBreakdown.PROJECT++;
    if (validation.hasWHY) categoryBreakdown.WHY++;
    if (validation.hasCorrelation) categoryBreakdown.CORRELATION++;

    // Track event types
    const eventType = event.event_type || 'unknown';
    eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
  }

  const percentage = (fullyTagged / events.length) * 100;

  // Results
  console.log('===============================================');
  console.log('  RESULTS');
  console.log('===============================================\n');

  console.log('Overall Context Preservation:');
  console.log(`  Total Events: ${events.length}`);
  console.log(`  Fully Tagged (5/5): ${fullyTagged} (${percentage.toFixed(1)}%)`);
  console.log(`  Partially Tagged (3-4/5): ${partiallyTagged}`);
  console.log(`  Untagged (<3/5): ${untagged}\n`);

  console.log('Category Coverage:');
  Object.entries(categoryBreakdown).forEach(([category, count]) => {
    const pct = ((count / events.length) * 100).toFixed(1);
    console.log(`  ${category}: ${count}/${events.length} (${pct}%)`);
  });

  console.log('\nEvent Type Distribution:');
  Object.entries(eventTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  console.log('\n===============================================');
  console.log(`  TARGET: 95% | ACTUAL: ${percentage.toFixed(1)}%`);

  if (percentage >= 95) {
    console.log('  STATUS: TARGET ACHIEVED!');
    console.log('===============================================\n');
    return true;
  } else {
    console.log(`  STATUS: BELOW TARGET (need ${(95 - percentage).toFixed(1)}% more)`);
    console.log('===============================================\n');
    return false;
  }
}

/**
 * Run validation
 */
async function main() {
  try {
    const passed = await validateContextPreservation();
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error('Validation error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { validateContextPreservation, getRecentEvents, validateEventMetadata };
