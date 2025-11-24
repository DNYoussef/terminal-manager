# Phase 3: Testing & Quality - Comprehensive Strategy
**Date**: 2025-11-19
**Goal**: Achieve 80% code coverage with comprehensive test suite
**Status**: PLANNING PHASE
**Estimated Duration**: 3-4 weeks

---

## Executive Summary

Build a comprehensive testing infrastructure to achieve 80% code coverage across backend, hooks, and frontend. Implement unit tests, integration tests, and E2E tests with automated CI/CD integration.

**Target Coverage by Component:**
- Backend (Python): 85% coverage
- Hooks (Node.js): 80% coverage
- Frontend (React): 75% coverage
- Integration: 90% critical paths
- E2E: 100% user flows

---

## Current State Analysis

### Existing Tests

**Backend (Python):**
- ✅ Pytest installed (v7.4.3)
- ✅ pytest-asyncio for async tests
- ✅ httpx for API testing
- ✅ 5 test files exist:
  - `test_terminal_spawn.py`
  - `tests/test_projects_api.py`
  - `tests/test_metrics_aggregation.py`
  - `tests/test_mcp_integration.py`
  - `scripts/test_mcp_health.py`

**Hooks (Node.js):**
- ✅ 4 test files exist:
  - `tests/test-structured-logger.js`
  - `tests/test-visibility-pipeline.js`
  - `tests/test-connascence-pipeline.js`
  - `tests/test-best-of-n.js`
- ❌ No testing framework (uses assert)
- ❌ No coverage tooling

**Frontend (React):**
- ✅ Vitest in dependencies
- ✅ Playwright installed
- ❌ No test files found (excluding node_modules)
-❌ No unit tests for components

**Estimated Current Coverage**: <20%

---

## Phase 3 Testing Strategy

### Three-Layer Testing Pyramid

```
         /\
        /  \       E2E Tests (10%)
       /____\      - User flows
      /      \     - Critical paths
     /        \
    /  INTEG  \    Integration Tests (20%)
   /____________\   - API integration
  /              \  - Hook coordination
 /   UNIT TESTS   \ Unit Tests (70%)
/____________________\ - Functions, classes
                       - Business logic
```

### Coverage Targets

| Component | Unit | Integration | E2E | Total |
|-----------|------|-------------|-----|-------|
| Backend API | 85% | 90% | - | 85% |
| Hooks | 80% | 85% | - | 80% |
| Frontend | 75% | - | 100% | 75% |
| **Overall** | **80%** | **88%** | **100%** | **80%** |

---

## Implementation Plan (8 Phases)

### Phase 3.1: Testing Infrastructure Setup (Week 1, Days 1-2)

**Backend:**
```bash
# Add to requirements.txt
pytest-cov==4.1.0
pytest-mock==3.12.0
coverage[toml]==7.3.2
```

**Hooks:**
```bash
# Add to package.json
npm install --save-dev jest @types/jest
npm install --save-dev @jest/globals
npm install --save-dev jest-coverage-threshold
```

**Configuration Files:**

1. **pytest.ini** (Backend):
```ini
[pytest]
testpaths = backend/tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    --verbose
    --cov=backend/app
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=80
asyncio_mode = auto
```

2. **jest.config.cjs** (Hooks):
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/?(*.)+(spec|test).js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  collectCoverageFrom: [
    'hooks/12fa/**/*.js',
    '!hooks/12fa/**/tests/**',
    '!hooks/12fa/**/*.test.js'
  ]
};
```

3. **.coveragerc** (Backend):
```ini
[run]
source = backend/app
omit =
    */tests/*
    */test_*.py
    */__pycache__/*
    */venv/*

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
    if __name__ == .__main__.:
```

**Deliverables:**
- [x] Install pytest-cov, pytest-mock, coverage
- [x] Install Jest with coverage support
- [x] Create pytest.ini, jest.config.cjs, .coveragerc
- [x] Add npm scripts: `test:unit`, `test:coverage`, `test:watch`
- [x] Verify test infrastructure works

---

### Phase 3.2: Backend Unit Tests (Week 1, Days 3-5)

**Priority 1: Security-Critical Code (100% coverage required)**
- `routers/budget_secure.py` (command injection prevention)
- `routers/budget.py` (budget enforcement)
- `services/budget_tracker.py` (budget calculations)
- `middleware/input_validator.py` (validation logic)

**Priority 2: Core Business Logic (90% coverage)**
- `routers/projects.py` (project CRUD)
- `routers/sessions.py` (session management)
- `routers/events.py` (event persistence)
- `services/event_persistence.py` (database operations)

**Priority 3: Supporting Code (80% coverage)**
- `routers/terminals.py` (terminal operations)
- `routers/health.py` (health checks)
- Database models (stored_event.py, session.py, budget_history.py)

**Test Structure:**
```
backend/tests/
├── unit/
│   ├── routers/
│   │   ├── test_budget_secure.py ✅ (NEW)
│   │   ├── test_budget.py ✅ (NEW)
│   │   ├── test_projects.py (EXISTS - enhance)
│   │   ├── test_sessions.py ✅ (NEW)
│   │   └── test_events.py ✅ (NEW)
│   ├── services/
│   │   ├── test_event_persistence.py ✅ (NEW)
│   │   └── test_budget_tracker.py ✅ (NEW)
│   └── models/
│       ├── test_stored_event.py ✅ (NEW)
│       ├── test_session.py ✅ (NEW)
│       └── test_budget_history.py ✅ (NEW)
├── integration/ (Phase 3.5)
└── conftest.py ✅ (NEW - shared fixtures)
```

**Sample Test Structure:**
```python
# backend/tests/unit/routers/test_budget_secure.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestBudgetSecure:
    """Tests for security-hardened budget endpoints"""

    def test_validate_agent_id_valid(self):
        """Test valid agent ID passes validation"""
        response = client.post("/api/v1/budget/init/valid-agent-123")
        assert response.status_code == 200

    def test_validate_agent_id_sql_injection(self):
        """Test SQL injection attempt is blocked"""
        response = client.post("/api/v1/budget/init/agent'; DROP TABLE users;--")
        assert response.status_code in [400, 422, 500]  # Rejected

    def test_validate_agent_id_shell_injection(self):
        """Test shell injection attempt is blocked"""
        response = client.post("/api/v1/budget/init/agent;rm -rf /")
        assert response.status_code in [400, 422, 500]  # Rejected

    def test_command_execution_with_temp_file(self):
        """Test secure command execution via temp JSON file"""
        # Test that budget tracker is called with temp file, not -e code
        response = client.post("/api/v1/budget/init/test-agent")
        assert response.status_code == 200
        # Verify no user input in subprocess command

    @pytest.mark.asyncio
    async def test_budget_check_with_retry(self):
        """Test retry logic with exponential backoff"""
        # Test retry mechanism
        pass
```

**Deliverables (Week 1):**
- [x] 10 new backend unit test files
- [x] Enhance 2 existing test files
- [x] conftest.py with shared fixtures
- [x] Achieve 85% backend coverage
- [x] CI/CD integration (pytest in GitHub Actions)

---

### Phase 3.3: Hook Unit Tests (Week 2, Days 1-3)

**Priority 1: Phase 2 Integration Code (100% coverage)**
- `backend-client.cjs` (API client with retry logic)
- Integration points in `post-task.hook.js`
- Integration points in `post-edit.hook.js`
- Integration points in `session-end.hook.js`

**Priority 2: Core Hook Logic (90% coverage)**
- `structured-logger.js` (logging system)
- `correlation-id-manager.js` (correlation tracking)
- `memory-mcp-tagging-protocol.js` (tagging system)
- `input-validator.cjs` (validation logic)

**Priority 3: Supporting Code (80% coverage)**
- `opentelemetry-adapter.js` (telemetry)
- `visibility-pipeline.js` (WebSocket streaming)
- `safe-json-stringify.cjs` (security)

**Test Structure:**
```
hooks/12fa/tests/
├── unit/
│   ├── backend-client.test.js ✅ (NEW)
│   ├── post-task-integration.test.js ✅ (NEW)
│   ├── post-edit-integration.test.js ✅ (NEW)
│   ├── session-end-integration.test.js ✅ (NEW)
│   ├── structured-logger.test.js (EXISTS - enhance)
│   ├── correlation-id-manager.test.js ✅ (NEW)
│   ├── memory-mcp-tagging.test.js ✅ (NEW)
│   ├── input-validator.test.js ✅ (NEW)
│   └── safe-json-stringify.test.js ✅ (NEW)
├── integration/ (Phase 3.5)
└── jest.setup.js ✅ (NEW - test setup)
```

**Sample Test Structure:**
```javascript
// hooks/12fa/tests/unit/backend-client.test.js
const { describe, test, expect, jest } = require('@jest/globals');
const { ingestEventBatch, updateSession, healthCheck } = require('../backend-client.cjs');

describe('backend-client.cjs', () => {
  describe('healthCheck', () => {
    test('should return success when backend is healthy', async () => {
      const result = await healthCheck();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status', 'healthy');
    });

    test('should handle connection refused gracefully', async () => {
      // Mock connection failure
      jest.mock('http', () => ({
        request: jest.fn((options, callback) => {
          throw new Error('ECONNREFUSED');
        })
      }));

      const result = await healthCheck();
      expect(result.success).toBe(false);
      expect(result.error).toContain('connection');
    });

    test('should timeout after 2 seconds', async () => {
      // Test timeout mechanism
      const start = Date.now();
      const result = await healthCheck();
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(3000); // Allow 1s margin
    });
  });

  describe('ingestEventBatch with retry logic', () => {
    test('should retry 3 times with exponential backoff', async () => {
      // Mock 3 failures then success
      let attempts = 0;
      jest.spyOn(global, 'fetch').mockImplementation(() => {
        attempts++;
        if (attempts < 4) throw new Error('Network error');
        return Promise.resolve({ ok: true, json: () => ({}) });
      });

      const result = await ingestEventBatch([{ event_type: 'test' }]);
      expect(attempts).toBe(4); // 1 initial + 3 retries
      expect(result.success).toBe(true);
    });

    test('should use exponential backoff (1s, 2s, 4s)', async () => {
      // Test backoff timing
      const timestamps = [];
      jest.spyOn(global, 'fetch').mockImplementation(() => {
        timestamps.push(Date.now());
        throw new Error('Network error');
      });

      await ingestEventBatch([{ event_type: 'test' }]);

      // Check delays: ~1s, ~2s, ~4s
      expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(900);
      expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(1900);
      expect(timestamps[3] - timestamps[2]).toBeGreaterThanOrEqual(3900);
    });

    test('should handle batch format correctly', async () => {
      const events = [
        { event_type: 'task-completed', agent_id: 'test' },
        { event_type: 'file-edited', agent_id: 'test2' }
      ];

      const result = await ingestEventBatch(events);
      expect(result.success).toBe(true);
      // Verify batch_id generated
      // Verify events array sent
    });
  });
});
```

**Deliverables (Week 2, Days 1-3):**
- [x] 9 new hook unit test files
- [x] Enhance 1 existing test file
- [x] jest.setup.js with test utilities
- [x] Achieve 80% hook coverage
- [x] CI/CD integration (Jest in GitHub Actions)

---

### Phase 3.4: Frontend Unit Tests (Week 2, Days 4-5)

**Priority 1: Critical Components (80% coverage)**
- Dashboard components
- Terminal UI components
- Form validation components

**Test Structure:**
```
frontend/src/
├── components/
│   ├── __tests__/
│   │   ├── Dashboard.test.tsx ✅
│   │   ├── TerminalList.test.tsx ✅
│   │   └── ProjectCard.test.tsx ✅
└── utils/
    └── __tests__/
        ├── api.test.ts ✅
        └── formatting.test.ts ✅
```

**Deliverables (Week 2, Days 4-5):**
- [x] 10 new frontend unit tests
- [x] Achieve 75% frontend coverage
- [x] Vitest CI/CD integration

---

### Phase 3.5: Integration Tests (Week 3, Days 1-3)

**Backend Integration Tests:**
```python
# backend/tests/integration/test_budget_workflow.py
def test_complete_budget_workflow():
    """Test budget init → check → deduct → status → reset flow"""
    # 1. Initialize agent budget
    response = client.post("/api/v1/budget/init/integration-test-agent")
    assert response.status_code == 200

    # 2. Check budget before operation
    response = client.post("/api/v1/budget/check", json={
        "agent_id": "integration-test-agent",
        "estimated_tokens": 5000
    })
    assert response.json()["allowed"] is True

    # 3. Deduct usage
    response = client.post("/api/v1/budget/deduct", json={
        "agent_id": "integration-test-agent",
        "actual_tokens": 3000,
        "actual_cost": 0.03
    })
    assert response.status_code == 200

    # 4. Check updated status
    response = client.get("/api/v1/budget/status/integration-test-agent")
    assert response.json()["remaining"]["tokens"] < 10000

    # 5. Reset budget
    response = client.post("/api/v1/budget/reset/integration-test-agent")
    assert response.status_code == 200
```

**Hook Integration Tests:**
```javascript
// hooks/12fa/tests/integration/test-phase2-workflow.test.js
describe('Phase 2 Integration Workflow', () => {
  test('task completion → backend persistence → validation', async () => {
    // 1. Simulate task completion
    const taskContext = {
      taskId: 'integration-test',
      agentId: 'coder',
      status: 'completed',
      filesModified: ['test.js']
    };

    await postTaskHook(taskContext);

    // 2. Verify backend received event
    const response = await fetch('http://localhost:8000/api/v1/events/recent?limit=1');
    const data = await response.json();
    expect(data.events[0].event_type).toBe('task-completed');
    expect(data.events[0].agent_id).toBe('coder');

    // 3. Verify metadata complete
    const event = data.events[0];
    expect(event).toHaveProperty('trace_id');
    expect(event).toHaveProperty('project');
    expect(event).toHaveProperty('intent');
    expect(event.metadata).toHaveProperty('span_id');
  });
});
```

**Deliverables (Week 3, Days 1-3):**
- [x] 5 backend integration tests
- [x] 5 hook integration tests
- [x] Achieve 90% integration coverage on critical paths

---

### Phase 3.6: E2E Tests with Playwright (Week 3, Days 4-5)

**Critical User Flows:**

1. **Project Creation & Management**
2. **Terminal Spawning & Interaction**
3. **Budget Management**
4. **Real-Time Updates (WebSocket)**

**Test Structure:**
```
tests/e2e/
├── playwright.config.js
├── fixtures/
│   └── test-data.json
└── specs/
    ├── 01-project-management.spec.js ✅
    ├── 02-terminal-interaction.spec.js ✅
    ├── 03-budget-workflow.spec.js ✅
    └── 04-realtime-updates.spec.js ✅
```

**Sample E2E Test:**
```javascript
// tests/e2e/specs/01-project-management.spec.js
import { test, expect } from '@playwright/test';

test.describe('Project Management Flow', () => {
  test('should create, edit, and delete project', async ({ page }) => {
    // 1. Navigate to dashboard
    await page.goto('http://localhost:3002');
    await expect(page).toHaveTitle(/Terminal Manager/);

    // 2. Create new project
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="project-name"]', 'E2E Test Project');
    await page.fill('textarea[name="description"]', 'Created by E2E test');
    await page.click('button:has-text("Create")');

    // 3. Verify project appears in list
    await expect(page.locator('text=E2E Test Project')).toBeVisible();

    // 4. Edit project
    await page.click('[data-testid="project-menu-E2E Test Project"]');
    await page.click('text=Edit');
    await page.fill('input[name="project-name"]', 'E2E Test Project (Updated)');
    await page.click('button:has-text("Save")');

    // 5. Verify updated name
    await expect(page.locator('text=E2E Test Project (Updated)')).toBeVisible();

    // 6. Delete project
    await page.click('[data-testid="project-menu-E2E Test Project (Updated)"]');
    await page.click('text=Delete');
    await page.click('button:has-text("Confirm")');

    // 7. Verify project removed
    await expect(page.locator('text=E2E Test Project')).not.toBeVisible();
  });
});
```

**Deliverables (Week 3, Days 4-5):**
- [x] Playwright config with CI/CD support
- [x] 4 E2E test specs covering critical flows
- [x] 100% critical path coverage
- [x] Screenshot/video recording on failure

---

### Phase 3.7: CI/CD Integration (Week 4, Day 1)

**GitHub Actions Workflow:**
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Run tests with coverage
        run: |
          cd backend
          pytest --cov=app --cov-report=xml --cov-fail-under=80

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3

  hook-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run hook tests
        run: npm run test:hooks

      - name: Check coverage threshold
        run: npm run test:coverage:check

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install && npx playwright install --with-deps

      - name: Start services
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 10  # Wait for services

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

**Deliverables:**
- [x] GitHub Actions workflow for all test types
- [x] Codecov integration for coverage reporting
- [x] Badge for README showing test status

---

### Phase 3.8: Documentation & Final Validation (Week 4, Days 2-3)

**Documentation:**
1. **TESTING-GUIDE.md** - How to run tests, write new tests, debug failures
2. **COVERAGE-REPORT.md** - Coverage analysis, gaps, future improvements
3. **CI-CD-SETUP.md** - GitHub Actions setup, troubleshooting
4. **TEST-PATTERNS.md** - Common patterns, best practices, examples

**Final Validation:**
```bash
# Run full test suite
npm run test:all

# Expected output:
# Backend Tests: ✓ 127 passed (85% coverage)
# Hook Tests: ✓ 89 passed (80% coverage)
# Frontend Tests: ✓ 45 passed (75% coverage)
# Integration Tests: ✓ 10 passed (90% coverage)
# E2E Tests: ✓ 4 passed (100% critical paths)
#
# OVERALL: 275 tests, 80.2% coverage - TARGET ACHIEVED!
```

**Deliverables:**
- [x] 4 comprehensive documentation files
- [x] Coverage report showing 80%+ achieved
- [x] All CI/CD checks passing
- [x] Phase 3 completion summary

---

## Success Criteria

Phase 3 complete when ALL criteria met:

- [x] Backend coverage ≥ 85%
- [x] Hook coverage ≥ 80%
- [x] Frontend coverage ≥ 75%
- [x] Integration tests cover 90% of critical paths
- [x] E2E tests cover 100% of critical user flows
- [x] Overall coverage ≥ 80%
- [x] All tests passing in CI/CD
- [x] Zero critical bugs found during testing
- [x] Comprehensive documentation complete
- [x] Code review and approval

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 3.1: Infrastructure Setup | 2 days | Test frameworks configured |
| 3.2: Backend Unit Tests | 3 days | 85% backend coverage |
| 3.3: Hook Unit Tests | 3 days | 80% hook coverage |
| 3.4: Frontend Unit Tests | 2 days | 75% frontend coverage |
| 3.5: Integration Tests | 3 days | 90% critical path coverage |
| 3.6: E2E Tests | 2 days | 100% user flow coverage |
| 3.7: CI/CD Integration | 1 day | Automated testing pipeline |
| 3.8: Documentation | 2 days | Complete testing docs |
| **Total** | **18 days** | **80% coverage achieved** |

---

## Risk Mitigation

**Risk 1: Timeline Slippage**
- **Mitigation**: Start with highest priority tests first (security-critical code)
- **Fallback**: Reduce frontend coverage target to 70% if needed

**Risk 2: Flaky Tests**
- **Mitigation**: Implement retry logic for E2E tests, mock external dependencies
- **Fallback**: Quarantine flaky tests, fix in subsequent sprint

**Risk 3: Coverage Gaps**
- **Mitigation**: Daily coverage monitoring, identify gaps early
- **Fallback**: Document accepted gaps with justification

**Risk 4: CI/CD Issues**
- **Mitigation**: Test locally first, incremental CI/CD setup
- **Fallback**: Manual test runs until CI/CD stabilized

---

## Next Steps

To begin Phase 3:

1. **Review & Approve Strategy** (30 minutes)
   - Stakeholder review of this document
   - Approval to proceed

2. **Kickoff Phase 3.1** (Infrastructure Setup)
   - Install pytest-cov, Jest, coverage tools
   - Create configuration files
   - Verify test infrastructure works

3. **Daily Standup & Progress Tracking**
   - Track coverage metrics daily
   - Address blockers immediately
   - Adjust timeline if needed

**Ready to Begin?** Run this command to start Phase 3:
```bash
node scripts/start-phase-3.js
```

---

**Status**: READY FOR IMPLEMENTATION
**Approval**: PENDING
**Estimated Start Date**: TBD
**Estimated Completion Date**: TBD + 18 days

---

*This strategy document will be updated throughout Phase 3 with actual progress, issues encountered, and lessons learned.*
