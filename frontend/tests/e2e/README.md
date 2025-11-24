# Agent Reality Map Dashboard - E2E Test Suite

Comprehensive end-to-end testing for the Agent Reality Map dashboard using Playwright.

## Test Files

### 1. dashboard.spec.ts
Main dashboard functionality tests:
- Page load performance (<2s)
- Navigation across all main pages
- Agent Registry display and functionality
- Activity Feed real-time updates
- Resource Monitors metrics
- Quality Metrics dashboard
- Backend integration

### 2. performance.spec.ts
Performance and load time tests:
- Initial load time benchmarks
- API response time testing
- WebSocket connection speed
- Search and filter performance
- Large dataset rendering
- Memory leak detection
- Chart rendering performance
- Lighthouse-style metrics (FCP, etc.)

### 3. accessibility.spec.ts
WCAG 2.1 AA compliance tests:
- Automated accessibility scanning (axe-core)
- Heading hierarchy validation
- Keyboard navigation
- Form label associations
- Image alt text
- Color contrast
- ARIA roles and attributes
- Focus indicators
- Screen reader compatibility

### 4. integration.spec.ts
Backend-frontend integration tests:
- API connectivity validation
- Data flow verification (backend -> frontend)
- Real-time event propagation
- WebSocket functionality
- CRUD operations
- Error handling
- Multi-client synchronization
- Database constraint enforcement

## Prerequisites

### Backend
Backend must be running on port 8000:
```bash
cd backend
uvicorn app.main:app --reload
```

Verify: http://localhost:8000/health should return `{"status":"healthy"}`

### Frontend
Frontend must be running on port 3000:
```bash
cd frontend
npm run dev
```

Verify: http://localhost:3000 should load

## Installation

Install Playwright and dependencies:
```bash
cd frontend
npm install -D @playwright/test
npx playwright install chromium

# Optional: For accessibility tests
npm install -D @axe-core/playwright
```

## Running Tests

### All Tests
```bash
npm run test:e2e
```

### Specific Test Suites
```bash
npm run test:e2e:dashboard      # Dashboard functionality
npm run test:e2e:performance    # Performance tests
npm run test:e2e:accessibility  # Accessibility tests
npm run test:e2e:integration    # Integration tests
```

### Headed Mode (See Browser)
```bash
npm run test:e2e:headed
```

### Debug Mode
```bash
npm run test:e2e:debug
```

### View Test Report
```bash
npm run test:e2e:report
```

### Using Scripts (Bash/PowerShell)

**Bash:**
```bash
./scripts/run-e2e-tests.sh                 # All tests
./scripts/run-e2e-tests.sh dashboard       # Dashboard only
./scripts/run-e2e-tests.sh performance     # Performance only
./scripts/run-e2e-tests.sh accessibility   # Accessibility only
./scripts/run-e2e-tests.sh integration     # Integration only
./scripts/run-e2e-tests.sh headed          # Headed mode
./scripts/run-e2e-tests.sh debug           # Debug mode
```

**PowerShell:**
```powershell
.\scripts\run-e2e-tests.ps1                 # All tests
.\scripts\run-e2e-tests.ps1 dashboard       # Dashboard only
.\scripts\run-e2e-tests.ps1 performance     # Performance only
.\scripts\run-e2e-tests.ps1 accessibility   # Accessibility only
.\scripts\run-e2e-tests.ps1 integration     # Integration only
.\scripts\run-e2e-tests.ps1 headed          # Headed mode
.\scripts\run-e2e-tests.ps1 debug           # Debug mode
```

## Test Configuration

Configuration file: `frontend/playwright.config.ts`

### Browsers Tested
- Chromium (Desktop Chrome)
- Firefox (Desktop)
- WebKit (Desktop Safari)
- Mobile Chrome (Pixel 5 emulation)
- Mobile Safari (iPhone 12 emulation)

### Timeouts
- Default test timeout: 30 seconds
- Web server startup timeout: 120 seconds

### Reporters
- HTML report (interactive)
- JSON report (machine-readable)
- List report (console output)

## Test Coverage

### Dashboard Tests (50+ tests)
- [x] Page load performance
- [x] Navigation functionality
- [x] Agent Registry display
- [x] Agent search and filtering
- [x] Agent details modal
- [x] Activity Feed real-time updates
- [x] WebSocket connectivity
- [x] Resource usage metrics
- [x] Budget monitoring
- [x] Quality score display
- [x] Violation breakdown
- [x] Backend API integration

### Performance Tests (15+ tests)
- [x] Initial load <2s
- [x] Page navigation speed
- [x] API response times <1s
- [x] WebSocket connection <5s
- [x] Search responsiveness
- [x] Scroll performance
- [x] Chart rendering
- [x] Memory leak detection
- [x] First Contentful Paint <1.5s
- [x] Network bottleneck detection

### Accessibility Tests (20+ tests)
- [x] WCAG 2.1 AA compliance
- [x] Heading hierarchy
- [x] Keyboard navigation
- [x] Form labels
- [x] Image alt text
- [x] Color contrast
- [x] ARIA roles
- [x] Focus visibility
- [x] Skip links
- [x] Screen reader announcements
- [x] Modal focus trapping
- [x] Table structure

### Integration Tests (15+ tests)
- [x] Backend health check
- [x] Agent CRUD operations
- [x] Event ingestion flow
- [x] Quality metrics sync
- [x] Resource usage sync
- [x] WebSocket real-time updates
- [x] Multi-client synchronization
- [x] Error handling
- [x] Pagination
- [x] Filtering
- [x] CORS configuration
- [x] Database constraints

## Success Criteria

### Must Pass
- All dashboard functionality tests pass
- Page load time <2 seconds
- API response times <1 second
- WebSocket connection <5 seconds
- Zero critical accessibility violations
- Backend-frontend data consistency
- Real-time updates working

### Performance Targets
- First Contentful Paint: <1.5s
- DOM Content Loaded: <2s
- Full Page Load: <5s
- API Response Time: <1s
- WebSocket Connection: <5s
- Search Response: <1s

### Accessibility Targets
- WCAG 2.1 AA compliance: 100%
- Critical violations: 0
- Serious violations: <5
- Keyboard navigation: 100% functional
- Screen reader compatibility: Full support

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      # Start backend
      - name: Start Backend
        run: |
          cd backend
          uvicorn app.main:app &

      # Run tests
      - name: Run E2E Tests
        run: |
          cd frontend
          npm install
          npx playwright install chromium
          npm run test:e2e

      # Upload results
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Backend Not Running
```
Error: Backend is not running on port 8000
```
**Solution:** Start backend with `cd backend && uvicorn app.main:app --reload`

### Frontend Not Running
```
Error: Frontend is not running on port 3000
```
**Solution:** Start frontend with `cd frontend && npm run dev`

### Playwright Not Installed
```
Error: Executable doesn't exist
```
**Solution:** Run `npx playwright install chromium`

### Test Failures
1. Check backend and frontend are both running
2. Verify database is accessible
3. Check console for errors: `npm run test:e2e:headed`
4. Run in debug mode: `npm run test:e2e:debug`

### Performance Test Failures
- Ensure no other heavy processes running
- Close unnecessary browser tabs
- Check network connectivity
- Run tests on dedicated test machine

### Accessibility Test Failures
- Install axe-core: `npm install -D @axe-core/playwright`
- Check for missing alt text on images
- Verify ARIA labels on interactive elements
- Test with actual screen reader for validation

## Best Practices

### Writing New Tests
1. Use descriptive test names
2. Include setup in `beforeEach`
3. Add cleanup in `afterEach`
4. Use data-testid attributes for reliable selection
5. Wait for elements explicitly
6. Handle errors gracefully

### Test Organization
```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup
  });

  test('should do something specific', async ({ page }) => {
    // Test implementation
  });
});
```

### Selectors Priority
1. `data-testid` attributes (most reliable)
2. ARIA roles and labels
3. Text content
4. CSS selectors (least reliable)

### Waiting Strategies
```typescript
// Wait for selector
await page.waitForSelector('[data-testid="element"]');

// Wait for network idle
await page.waitForLoadState('networkidle');

// Custom timeout
await page.waitForTimeout(1000);
```

## Maintenance

### Regular Tasks
- [ ] Update Playwright monthly: `npm update @playwright/test`
- [ ] Review and update test data
- [ ] Monitor test execution times
- [ ] Address flaky tests immediately
- [ ] Keep screenshots for visual regression

### Test Health Metrics
- Pass rate: >95%
- Flakiness: <5%
- Execution time: <10 minutes
- Coverage: >80%

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## Support

For issues or questions:
1. Check this documentation
2. Review test logs: `playwright-report/`
3. Run in debug mode: `npm run test:e2e:debug`
4. Check Playwright docs: https://playwright.dev/
