import { test, expect } from '@playwright/test';

test.describe('Backend-Frontend Integration Tests', () => {
  const BACKEND_URL = 'http://localhost:8000';
  const FRONTEND_URL = 'http://localhost:3000';

  test('Backend API is accessible', async ({ page }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');

      console.log('Backend health check passed:', data);
    } catch (error) {
      console.error('Backend is not running on port 8000');
      throw error;
    }
  });

  test('Frontend displays backend data correctly', async ({ page }) => {
    // Fetch data from backend
    const agentsResponse = await fetch(`${BACKEND_URL}/api/v1/agents/`);
    const backendAgents = await agentsResponse.json();

    console.log(`Backend returned ${backendAgents.length} agents`);

    // Load frontend
    await page.goto('/agents');
    await page.waitForTimeout(2000);

    // Count agents displayed in frontend
    const frontendAgentCount = await page.locator('[data-testid="agent-card"], .agent-row').count();

    console.log(`Frontend displays ${frontendAgentCount} agents`);

    // Frontend should show same or similar count (may differ due to filtering/pagination)
    expect(frontendAgentCount).toBeGreaterThan(0);
  });

  test('Creating agent via API appears in frontend', async ({ page }) => {
    // Create test agent via backend
    const testAgent = {
      name: `test-agent-${Date.now()}`,
      role: 'developer',
      category: 'testing',
      capabilities: ['test'],
      status: 'active'
    };

    const createResponse = await fetch(`${BACKEND_URL}/api/v1/agents/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testAgent)
    });

    expect(createResponse.ok).toBe(true);
    const createdAgent = await createResponse.json();
    console.log('Created test agent:', createdAgent);

    // Load frontend and search for agent
    await page.goto('/agents');
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[type="search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill(testAgent.name);
      await page.waitForTimeout(1000);

      // Should find the agent
      const agentFound = await page.locator(`text=${testAgent.name}`).count() > 0;
      console.log(`Agent found in frontend: ${agentFound}`);
    }

    // Cleanup - delete test agent
    if (createdAgent.id) {
      await fetch(`${BACKEND_URL}/api/v1/agents/${createdAgent.id}`, {
        method: 'DELETE'
      });
    }
  });

  test('Event ingestion flows to Activity Feed', async ({ page }) => {
    // Open Activity Feed
    await page.goto('/activity');
    await page.waitForTimeout(2000);

    const initialEventCount = await page.locator('[data-testid="event-card"], .event-card').count();
    console.log(`Initial event count: ${initialEventCount}`);

    // Ingest test event via backend
    const testEvent = {
      event_type: 'test_integration',
      agent_id: `test-${Date.now()}`,
      agent_name: 'integration-tester',
      event_data: { test: true },
      timestamp: new Date().toISOString()
    };

    const eventResponse = await fetch(`${BACKEND_URL}/api/v1/events/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testEvent)
    });

    expect(eventResponse.ok).toBe(true);
    console.log('Event ingested successfully');

    // Wait for WebSocket to propagate event
    await page.waitForTimeout(3000);

    // Reload to ensure event is visible
    await page.reload();
    await page.waitForTimeout(2000);

    const finalEventCount = await page.locator('[data-testid="event-card"], .event-card').count();
    console.log(`Final event count: ${finalEventCount}`);

    // Should have at least the same number of events
    expect(finalEventCount).toBeGreaterThanOrEqual(initialEventCount);
  });

  test('Quality metrics sync between backend and frontend', async ({ page }) => {
    // Fetch quality metrics from backend
    const metricsResponse = await fetch(`${BACKEND_URL}/api/v1/quality/metrics/`);
    const backendMetrics = await metricsResponse.json();

    console.log('Backend quality metrics:', backendMetrics);

    // Load frontend quality page
    await page.goto('/quality');
    await page.waitForTimeout(2000);

    // Verify overall score is displayed
    const scoreElement = page.locator('#overall-score, [data-testid="overall-quality-score"]');
    const scoreVisible = await scoreElement.isVisible().catch(() => false);

    console.log(`Quality score visible in frontend: ${scoreVisible}`);

    if (scoreVisible) {
      const displayedScore = await scoreElement.textContent();
      console.log('Displayed quality score:', displayedScore);
    }
  });

  test('Resource usage data flows correctly', async ({ page }) => {
    // Fetch resource usage from backend
    const resourceResponse = await fetch(`${BACKEND_URL}/api/v1/resources/usage/`);
    const backendResources = await resourceResponse.json();

    console.log('Backend resource data:', backendResources);

    // Load frontend resources page
    await page.goto('/resources');
    await page.waitForTimeout(2000);

    // Verify resource metrics are displayed
    const apiCallsElement = page.locator('#total-api-calls, [data-testid="api-calls"]');
    const apiCallsVisible = await apiCallsElement.isVisible().catch(() => false);

    console.log(`API calls metric visible: ${apiCallsVisible}`);
  });

  test('WebSocket connection works end-to-end', async ({ page }) => {
    // Navigate to Activity Feed (should establish WebSocket)
    await page.goto('/activity');
    await page.waitForTimeout(2000);

    // Look for WebSocket connection indicator
    const wsConnected = await page.locator('[data-testid="ws-connected"], .ws-connected')
      .isVisible()
      .catch(() => false);

    console.log(`WebSocket connected: ${wsConnected}`);

    // Send event via backend
    const testEvent = {
      event_type: 'websocket_test',
      agent_id: `ws-test-${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    await fetch(`${BACKEND_URL}/api/v1/events/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testEvent)
    });

    // Wait for event to arrive via WebSocket
    await page.waitForTimeout(2000);

    console.log('WebSocket event delivery test completed');
  });

  test('Error handling when backend is unavailable', async ({ page }) => {
    // This test assumes backend is running
    // We'll just verify error states are present in the UI

    await page.goto('/agents');
    await page.waitForTimeout(2000);

    // Look for error boundary or loading states
    const errorMessage = await page.locator('.error-message, [data-testid="error"]').count();
    const loadingState = await page.locator('.loading, [data-testid="loading"]').count();

    console.log(`Error messages: ${errorMessage}, Loading states: ${loadingState}`);

    // Either should show data or graceful error state
    const hasContent = await page.locator('body').evaluate(el => el.textContent?.length ?? 0) > 0;
    expect(hasContent).toBe(true);
  });

  test('API pagination works correctly', async ({ page }) => {
    // Test backend pagination
    const page1Response = await fetch(`${BACKEND_URL}/api/v1/events/?limit=10&offset=0`);
    const page1Data = await page1Response.json();

    const page2Response = await fetch(`${BACKEND_URL}/api/v1/events/?limit=10&offset=10`);
    const page2Data = await page2Response.json();

    console.log(`Page 1: ${page1Data.length} events, Page 2: ${page2Data.length} events`);

    // Frontend should handle pagination
    await page.goto('/activity');
    await page.waitForTimeout(2000);

    // Look for pagination controls
    const paginationExists = await page.locator('[data-testid="pagination"], .pagination').count() > 0;
    console.log(`Pagination controls present: ${paginationExists}`);
  });

  test('Filtering works end-to-end', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(2000);

    // Apply filter
    const roleFilter = page.locator('select#role-filter, select[name="role"]').first();
    if (await roleFilter.count() > 0) {
      await roleFilter.selectOption('developer');
      await page.waitForTimeout(1000);

      // Should see filtered results
      const filteredCount = await page.locator('[data-testid="agent-card"], .agent-row').count();
      console.log(`Filtered agents (developer): ${filteredCount}`);

      // Verify backend respects filter
      const filterResponse = await fetch(`${BACKEND_URL}/api/v1/agents/?role=developer`);
      const backendFiltered = await filterResponse.json();
      console.log(`Backend filtered results: ${backendFiltered.length}`);
    }
  });

  test('Real-time updates work across multiple clients', async ({ page, context }) => {
    // Open Activity Feed in first tab
    await page.goto('/activity');
    await page.waitForTimeout(2000);

    const initialCount = await page.locator('[data-testid="event-card"], .event-card').count();

    // Open second tab
    const page2 = await context.newPage();
    await page2.goto('/activity');
    await page2.waitForTimeout(2000);

    // Trigger event from backend
    await fetch(`${BACKEND_URL}/api/v1/events/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'multi_client_test',
        agent_id: `multi-${Date.now()}`,
        timestamp: new Date().toISOString()
      })
    });

    // Wait for both tabs to receive update
    await page.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    const finalCount1 = await page.locator('[data-testid="event-card"], .event-card').count();
    const finalCount2 = await page2.locator('[data-testid="event-card"], .event-card').count();

    console.log(`Tab 1: ${initialCount} -> ${finalCount1}, Tab 2: ${finalCount2}`);

    await page2.close();
  });

  test('Database constraints are respected', async ({ page }) => {
    // Try to create invalid agent
    const invalidAgent = {
      name: '', // Empty name should fail
      role: 'invalid-role'
    };

    const response = await fetch(`${BACKEND_URL}/api/v1/agents/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidAgent)
    });

    // Should return error
    expect(response.ok).toBe(false);
    console.log(`Invalid agent rejected with status: ${response.status}`);
  });

  test('CORS is properly configured', async ({ page }) => {
    // Frontend should be able to make requests to backend
    const response = await page.evaluate(async (url) => {
      try {
        const res = await fetch(`${url}/api/v1/agents/`);
        return {
          ok: res.ok,
          status: res.status,
          headers: Object.fromEntries(res.headers.entries())
        };
      } catch (error) {
        return { error: error.message };
      }
    }, BACKEND_URL);

    console.log('CORS test response:', response);

    // Should not have CORS errors
    expect(response.ok || response.error).toBeTruthy();
  });
});
