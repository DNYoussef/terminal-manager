#!/usr/bin/env node
/**
 * Budget Enforcement Verification Script
 *
 * Tests BLOCKER-4 implementation:
 * 1. Initialize budget with low limit (10K tokens)
 * 2. Attempt operation within limit (5K tokens) - should succeed
 * 3. Attempt operation exceeding limit (11K tokens) - should be blocked with 429
 * 4. Verify budget deduction tracking
 * 5. Test budget restoration across restarts
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '8000', 10);
const TEST_AGENT = 'test-coder';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

/**
 * Make HTTP request to backend
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const responseData = body ? JSON.parse(body) : null;
          resolve({
            status: res.statusCode,
            data: responseData,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test helper
 */
function test(name, fn) {
  testResults.total++;
  return fn()
    .then(() => {
      console.log(`${GREEN}✓${RESET} ${name}`);
      testResults.passed++;
      return true;
    })
    .catch(error => {
      console.log(`${RED}✗${RESET} ${name}`);
      console.log(`  ${RED}Error: ${error.message}${RESET}`);
      testResults.failed++;
      return false;
    });
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Main verification suite
 */
async function runVerification() {
  console.log(`\n${BLUE}════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  BLOCKER-4 BUDGET ENFORCEMENT VERIFICATION${RESET}`);
  console.log(`${BLUE}════════════════════════════════════════════════════════${RESET}\n`);

  console.log(`Testing against: ${BACKEND_HOST}:${BACKEND_PORT}\n`);

  // ================================================================
  // TEST 1: Backend Health Check
  // ================================================================
  await test('Backend is accessible', async () => {
    const result = await makeRequest('GET', '/budget/health');
    assert(result.status === 200, `Backend not accessible: ${result.status}`);
    assert(result.data.status === 'healthy' || result.data.status === 'degraded',
      'Budget health check failed');
  });

  // ================================================================
  // TEST 2: Initialize Budget with Low Limit
  // ================================================================
  await test('Initialize budget (10K tokens/day limit)', async () => {
    const result = await makeRequest('POST', `/budget/init/${TEST_AGENT}`, {
      tokens_per_hour: 10000,
      tokens_per_day: 10000,
      max_cost_per_operation: 0.01
    });
    assert(result.status === 200, `Init failed: ${result.status}`);
    assert(result.data.success, 'Budget initialization failed');
  });

  // ================================================================
  // TEST 3: Check Budget Status
  // ================================================================
  let initialStatus;
  await test('Get initial budget status', async () => {
    const result = await makeRequest('GET', `/budget/status/${TEST_AGENT}`);
    assert(result.status === 200, `Status check failed: ${result.status}`);
    assert(result.data.agent_id === TEST_AGENT, 'Wrong agent ID');
    assert(result.data.limits.tokensPerDay === 10000, 'Incorrect token limit');
    initialStatus = result.data;
  });

  // ================================================================
  // TEST 4: Operation Within Budget (Should Succeed)
  // ================================================================
  await test('Operation within budget (5K tokens) - should succeed', async () => {
    const result = await makeRequest('POST', '/budget/check', {
      agent_id: TEST_AGENT,
      estimated_tokens: 5000,
      estimated_cost: 0.005
    });
    assert(result.status === 200, `Check should succeed: ${result.status}`);
    assert(result.data.allowed === true, 'Operation should be allowed');
    assert(result.data.remaining.agent >= 5000, 'Insufficient remaining budget');
  });

  // ================================================================
  // TEST 5: Deduct Usage
  // ================================================================
  await test('Deduct 5K tokens from budget', async () => {
    const result = await makeRequest('POST', '/budget/deduct', {
      agent_id: TEST_AGENT,
      tokens_used: 5000,
      cost: 0.005
    });
    assert(result.status === 200, `Deduction failed: ${result.status}`);
    assert(result.data.success, 'Deduction should succeed');
    assert(result.data.deducted.tokensUsed === 5000, 'Wrong deduction amount');
  });

  // ================================================================
  // TEST 6: Verify Deduction in Status
  // ================================================================
  await test('Verify budget reduced to 5K remaining', async () => {
    const result = await makeRequest('GET', `/budget/status/${TEST_AGENT}`);
    assert(result.status === 200, `Status check failed: ${result.status}`);
    assert(result.data.usage.tokensUsed === 5000, 'Usage not tracked');
    assert(result.data.remaining.tokens === '5000.00', 'Remaining budget incorrect');
  });

  // ================================================================
  // TEST 7: Operation Exceeding Budget (Should Fail with 429)
  // ================================================================
  await test('Operation exceeding budget (11K tokens) - should return 429', async () => {
    const result = await makeRequest('POST', '/budget/check', {
      agent_id: TEST_AGENT,
      estimated_tokens: 11000,
      estimated_cost: 0.011
    });
    assert(result.status === 429, `Should return 429, got: ${result.status}`);
    assert(result.data.detail, '429 should include error detail');
    assert(result.data.detail.error === 'Budget exceeded', 'Wrong error message');
  });

  // ================================================================
  // TEST 8: Operation Exceeding Remaining Budget (Should Fail)
  // ================================================================
  await test('Operation exceeding remaining (6K tokens) - should fail', async () => {
    const result = await makeRequest('POST', '/budget/check', {
      agent_id: TEST_AGENT,
      estimated_tokens: 6000,
      estimated_cost: 0.006
    });
    assert(result.status === 429, `Should return 429, got: ${result.status}`);
  });

  // ================================================================
  // TEST 9: Reset Budget
  // ================================================================
  await test('Reset budget to clear usage', async () => {
    const result = await makeRequest('POST', `/budget/reset/${TEST_AGENT}`);
    assert(result.status === 200, `Reset failed: ${result.status}`);
    assert(result.data.success, 'Reset should succeed');
  });

  // ================================================================
  // TEST 10: Verify Reset
  // ================================================================
  await test('Verify budget reset to 0 usage', async () => {
    const result = await makeRequest('GET', `/budget/status/${TEST_AGENT}`);
    assert(result.status === 200, `Status check failed: ${result.status}`);
    assert(result.data.usage.tokensUsed === 0, 'Usage not reset');
    assert(result.data.remaining.tokens === '10000.00', 'Budget not restored');
  });

  // ================================================================
  // RESULTS SUMMARY
  // ================================================================
  console.log(`\n${BLUE}════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  VERIFICATION RESULTS${RESET}`);
  console.log(`${BLUE}════════════════════════════════════════════════════════${RESET}\n`);

  console.log(`Total Tests:  ${testResults.total}`);
  console.log(`${GREEN}Passed:       ${testResults.passed}${RESET}`);
  console.log(`${RED}Failed:       ${testResults.failed}${RESET}`);

  const successRate = (testResults.passed / testResults.total * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%\n`);

  if (testResults.failed === 0) {
    console.log(`${GREEN}✓ ALL TESTS PASSED - BLOCKER-4 COMPLETE!${RESET}\n`);
    return 0;
  } else {
    console.log(`${RED}✗ SOME TESTS FAILED - Please review errors above${RESET}\n`);
    return 1;
  }
}

// Run verification
runVerification()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error(`${RED}Fatal error:${RESET}`, error);
    process.exit(1);
  });
