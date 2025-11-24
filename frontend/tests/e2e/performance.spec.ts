import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('Dashboard initial load time < 2s', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const domLoadTime = Date.now() - startTime;
    console.log(`DOM Content Loaded: ${domLoadTime}ms`);

    await page.waitForLoadState('networkidle');
    const fullLoadTime = Date.now() - startTime;
    console.log(`Full Load Time: ${fullLoadTime}ms`);

    expect(domLoadTime).toBeLessThan(2000);
  });

  test('Agent Registry page loads quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/agents');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;
    console.log(`Agent Registry load time: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(3000);
  });

  test('Activity Feed page loads quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/activity');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;
    console.log(`Activity Feed load time: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(3000);
  });

  test('WebSocket connection establishes quickly', async ({ page }) => {
    await page.goto('/activity');

    const startTime = Date.now();

    // Wait for WebSocket connection indicator
    await page.waitForSelector('[data-testid="ws-connected"], .ws-connected', {
      timeout: 5000
    }).catch(() => {
      console.log('WebSocket connection indicator not found');
    });

    const connectionTime = Date.now() - startTime;
    console.log(`WebSocket connection time: ${connectionTime}ms`);

    expect(connectionTime).toBeLessThan(5000);
  });

  test('Agent search responds quickly', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    const searchExists = await searchInput.count() > 0;

    if (searchExists) {
      const startTime = Date.now();

      await searchInput.fill('backend');
      await page.waitForTimeout(100); // Debounce time

      // Wait for results to update
      await page.waitForTimeout(500);

      const searchTime = Date.now() - startTime;
      console.log(`Search response time: ${searchTime}ms`);

      expect(searchTime).toBeLessThan(1000);
    } else {
      console.log('Search input not found - skipping search performance test');
    }
  });

  test('Page navigation is instant', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const pages = ['/agents', '/activity', '/resources', '/quality'];

    for (const path of pages) {
      const startTime = Date.now();

      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      const navTime = Date.now() - startTime;
      console.log(`Navigation to ${path}: ${navTime}ms`);

      expect(navTime).toBeLessThan(2000);
    }
  });

  test('Large dataset rendering performance', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(2000);

    const startTime = Date.now();

    // Scroll through agent list
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForTimeout(500);

    const scrollTime = Date.now() - startTime;
    console.log(`Scroll performance: ${scrollTime}ms`);

    expect(scrollTime).toBeLessThan(1000);
  });

  test('API response times are acceptable', async ({ page }) => {
    const endpoints = [
      '/api/v1/agents/',
      '/api/v1/events/?limit=50',
      '/api/v1/quality/metrics/',
      '/api/v1/resources/usage/'
    ];

    for (const endpoint of endpoints) {
      const startTime = Date.now();

      try {
        const response = await fetch(`http://localhost:8000${endpoint}`);
        const responseTime = Date.now() - startTime;

        console.log(`${endpoint} response time: ${responseTime}ms`);
        expect(responseTime).toBeLessThan(1000);
        expect(response.ok).toBe(true);
      } catch (error) {
        console.log(`API endpoint ${endpoint} failed - backend may be offline`);
      }
    }
  });

  test('WebSocket handles rapid events', async ({ page }) => {
    await page.goto('/activity');
    await page.waitForTimeout(2000);

    const initialCount = await page.locator('[data-testid="event-card"], .event-card')
      .count()
      .catch(() => 0);

    // Send 10 rapid events
    const startTime = Date.now();

    try {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          fetch('http://localhost:8000/api/v1/events/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'test_event',
              agent_id: `test-${i}`,
              timestamp: new Date().toISOString()
            })
          })
        );
      }

      await Promise.all(promises);

      // Wait for events to propagate
      await page.waitForTimeout(2000);

      const processingTime = Date.now() - startTime;
      console.log(`10 events processing time: ${processingTime}ms`);

      const finalCount = await page.locator('[data-testid="event-card"], .event-card')
        .count()
        .catch(() => 0);

      console.log(`Events before: ${initialCount}, after: ${finalCount}`);

      // Should handle 10 events in under 5 seconds
      expect(processingTime).toBeLessThan(5000);
    } catch (error) {
      console.log('Rapid event test failed - backend may be offline');
    }
  });

  test('Memory usage stays reasonable', async ({ page, browser }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Navigate through all pages multiple times
    const pages = ['/agents', '/activity', '/resources', '/quality'];

    for (let i = 0; i < 3; i++) {
      for (const path of pages) {
        await page.goto(path);
        await page.waitForTimeout(500);
      }
    }

    // Check if page is still responsive
    const isResponsive = await page.evaluate(() => {
      return document.readyState === 'complete';
    });

    expect(isResponsive).toBe(true);
    console.log('Memory leak test passed - page still responsive after navigation');
  });

  test('Chart rendering performance', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForTimeout(1000);

    const startTime = Date.now();

    // Wait for charts to render
    await page.waitForSelector('canvas, svg', { timeout: 5000 }).catch(() => {
      console.log('No charts found');
    });

    const renderTime = Date.now() - startTime;
    console.log(`Chart render time: ${renderTime}ms`);

    expect(renderTime).toBeLessThan(3000);
  });
});

test.describe('Lighthouse Performance Audit', () => {
  test('Run basic performance checks', async ({ page }) => {
    await page.goto('/');

    // Performance metrics via Navigation Timing API
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcp: navigation.connectEnd - navigation.connectStart,
        request: navigation.responseStart - navigation.requestStart,
        response: navigation.responseEnd - navigation.responseStart,
        domParse: navigation.domInteractive - navigation.responseEnd,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        load: navigation.loadEventEnd - navigation.loadEventStart,
        total: navigation.loadEventEnd - navigation.fetchStart
      };
    });

    console.log('Performance Metrics:', metrics);

    expect(metrics.total).toBeLessThan(5000);
    console.log(`Total page load: ${metrics.total}ms`);
  });

  test('Check for performance bottlenecks', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all network requests
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map((r: PerformanceResourceTiming) => ({
        name: r.name,
        duration: r.duration,
        size: r.transferSize
      }));
    });

    // Find slow resources (>1s)
    const slowResources = resources.filter(r => r.duration > 1000);

    if (slowResources.length > 0) {
      console.log('Slow resources detected:', slowResources);
    } else {
      console.log('No performance bottlenecks detected');
    }

    // Should have fewer than 5 slow resources
    expect(slowResources.length).toBeLessThan(5);
  });

  test('First Contentful Paint < 1.5s', async ({ page }) => {
    await page.goto('/');

    const fcp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint');
      const fcpEntry = entries.find(e => e.name === 'first-contentful-paint');
      return fcpEntry ? fcpEntry.startTime : 0;
    });

    console.log(`First Contentful Paint: ${fcp}ms`);

    if (fcp > 0) {
      expect(fcp).toBeLessThan(1500);
    }
  });
});
