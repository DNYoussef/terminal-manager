# Integration Test Template - Real Code Pattern

Use this template when creating new integration tests for hooks or middleware.

---

## File Naming Convention

**Pattern**: `[module-name]-real.test.js`

**Examples**:
- `pre-task-real.test.js`
- `post-task-real.test.js`
- `memory-mcp-tagging-protocol-real.test.js`

---

## Template Code

```javascript
/**
 * Integration Tests for [Module Name]
 * Coverage target: [60-80%]
 *
 * Strategy: Real code with external I/O mocking only
 *
 * Test Categories:
 * 1. [Category 1] ([X] tests) - [Description]
 * 2. [Category 2] ([X] tests) - [Description]
 * 3. Error Handling ([X] tests) - Graceful degradation
 * 4. Helper Functions ([X] tests) - Utility validation
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// ============================================================================
// MOCK ONLY EXTERNAL DEPENDENCIES (fs, network, external services)
// ============================================================================

// Mock fs to prevent actual file writes during tests
const mockFs = {
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  statSync: jest.fn(() => ({ size: 1000 }))
};
jest.mock('fs', () => mockFs);

// Mock node-fetch for network requests
const mockFetch = jest.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ success: true })
}));
jest.mock('node-fetch', () => mockFetch);

// Mock optional dependencies (may not exist)
const mockOptionalDep = {
  method: jest.fn(() => ({ success: true, data: {} }))
};
jest.mock('../../../../path/to/optional-dependency.js',
  () => mockOptionalDep,
  { virtual: true }
);

// Mock external services (OpenTelemetry, monitoring, etc.)
const mockSpan = {
  spanId: 'test-span-123',
  traceId: 'test-trace-456',
  setAttribute: jest.fn().mockReturnThis(),
  setAttributes: jest.fn().mockReturnThis(),
  addEvent: jest.fn().mockReturnThis(),
  recordException: jest.fn().mockReturnThis(),
  end: jest.fn().mockReturnThis()
};

const mockExternalService = {
  startSpan: jest.fn(() => mockSpan),
  endSpan: jest.fn()
};

jest.mock('../external-service', () => ({
  getService: () => mockExternalService
}));

// ============================================================================
// USE REAL IMPLEMENTATIONS (internal modules - NO MOCKS)
// ============================================================================

const { getLogger } = require('../structured-logger');  // REAL
const correlationManager = require('../correlation-id-manager');  // REAL
const memoryProtocol = require('../memory-mcp-tagging-protocol');  // REAL
const moduleUnderTest = require('../[module-name]');  // REAL

// ============================================================================
// TESTS
// ============================================================================

describe('[Module Name] (Integration Tests with Real Code)', () => {
  beforeEach(() => {
    // Clear mock call history (but keep mock implementations)
    jest.clearAllMocks();

    // Reset mock return values to safe defaults
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.statSync.mockReturnValue({ size: 1000 });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true })
    });

    mockOptionalDep.method.mockReturnValue({
      success: true,
      data: {}
    });

    // Reset environment variables
    process.env.NODE_ENV = 'test';
    process.env.BACKEND_URL = 'http://localhost:8000';
  });

  afterEach(() => {
    // Cleanup if needed
  });

  // ==========================================================================
  // CATEGORY 1: [Primary Functionality] (40% of tests)
  // ==========================================================================

  describe('[Primary Functionality]', () => {
    test('should [perform primary function]', async () => {
      const input = {
        // Test input
      };

      const result = await moduleUnderTest.primaryFunction(input);

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    test('should [handle valid input]', async () => {
      const input = { valid: true };

      const result = await moduleUnderTest.process(input);

      expect(result).toBeDefined();
      // Add specific assertions
    });

    test('should [validate business logic]', async () => {
      // Test real business logic behavior
      const result = await moduleUnderTest.businessLogic();

      expect(result).toMatchObject({
        // Expected structure
      });
    });
  });

  // ==========================================================================
  // CATEGORY 2: [Integration Points] (30% of tests)
  // ==========================================================================

  describe('[Integration Points]', () => {
    test('should integrate with external service', async () => {
      await moduleUnderTest.callExternalService();

      // Verify external service was called
      expect(mockExternalService.startSpan).toHaveBeenCalled();
    });

    test('should write to file system', async () => {
      const data = { test: 'data' };

      await moduleUnderTest.saveData(data);

      // Verify file operations
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    test('should call backend API', async () => {
      await moduleUnderTest.sendToBackend({ data: 'test' });

      // Verify network call
      expect(mockFetch).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/'),
        expect.any(Object)
      );
    });

    test('should use Memory MCP with proper tagging', async () => {
      const mockMemoryStore = jest.fn();

      const context = {
        data: 'test',
        memoryStore: mockMemoryStore
      };

      await moduleUnderTest.storeInMemory(context);

      // Verify Memory MCP integration
      expect(mockMemoryStore).toHaveBeenCalled();

      const callArgs = mockMemoryStore.mock.calls[0][0];
      expect(callArgs).toHaveProperty('metadata');
      expect(callArgs.metadata).toHaveProperty('WHO');
      expect(callArgs.metadata).toHaveProperty('WHEN');
      expect(callArgs.metadata).toHaveProperty('PROJECT');
      expect(callArgs.metadata).toHaveProperty('WHY');
    });
  });

  // ==========================================================================
  // CATEGORY 3: [Error Handling] (15% of tests)
  // ==========================================================================

  describe('Error Handling', () => {
    test('should handle missing input gracefully', async () => {
      const result = await moduleUnderTest.process(null);

      expect(result).toHaveProperty('success');
      // Should not throw, should handle gracefully
    });

    test('should handle empty input', async () => {
      const result = await moduleUnderTest.process({});

      expect(result).toBeDefined();
    });

    test('should handle external service failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await moduleUnderTest.callExternalService();

      // Should not crash, should return error state
      expect(result).toHaveProperty('error');
    });

    test('should handle file system errors', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = await moduleUnderTest.saveData({ test: 'data' });

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // CATEGORY 4: [Helper Functions] (15% of tests)
  // ==========================================================================

  describe('Helper Functions', () => {
    test('should export primary function', () => {
      expect(typeof moduleUnderTest.primaryFunction).toBe('function');
    });

    test('should export utility functions', () => {
      expect(typeof moduleUnderTest.helperFunction).toBe('function');
    });

    test('should validate input correctly', () => {
      const isValid = moduleUnderTest.validate({ valid: true });

      expect(isValid).toBe(true);
    });

    test('should format data correctly', () => {
      const formatted = moduleUnderTest.format({ raw: 'data' });

      expect(formatted).toHaveProperty('formatted');
    });
  });

  // ==========================================================================
  // INTEGRATION SCENARIOS (Real End-to-End Flows)
  // ==========================================================================

  describe('Integration Scenarios', () => {
    test('should execute complete workflow end-to-end', async () => {
      const mockMemoryStore = jest.fn();

      const context = {
        // Complete context
        id: 'test-123',
        data: 'test data',
        memoryStore: mockMemoryStore
      };

      const result = await moduleUnderTest.completeWorkflow(context);

      // Verify all integration points were involved
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(mockExternalService.startSpan).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
      expect(mockMemoryStore).toHaveBeenCalled();
    });

    test('should maintain correlation across operations', async () => {
      const context = {
        correlationId: 'test-correlation-123'
      };

      const result = await moduleUnderTest.process(context);

      expect(result).toHaveProperty('correlationId');
      expect(result.correlationId).toBe('test-correlation-123');
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS (if module exports utilities)
// ============================================================================

describe('[Module Name] Helper Functions', () => {
  test('should export expected functions', () => {
    expect(moduleUnderTest).toHaveProperty('primaryFunction');
    expect(moduleUnderTest).toHaveProperty('helperFunction');
  });

  test('should have correct function signatures', () => {
    expect(moduleUnderTest.primaryFunction.length).toBe(1);  // Expects 1 argument
  });
});
```

---

## Checklist Before Submitting

Use this checklist to ensure your tests follow the standard:

### Mocking Strategy ✅
- [ ] Only mock external I/O (fs, network, database)
- [ ] Use REAL implementations for internal modules
- [ ] Mock optional dependencies with `{ virtual: true }`
- [ ] No mocking of business logic

### Test Structure ✅
- [ ] Tests organized into 4 categories (Core 40%, Integration 30%, Error 15%, Helpers 15%)
- [ ] Each test has clear description
- [ ] beforeEach resets mocks to safe defaults
- [ ] Tests validate real behavior, not mock calls

### Assertions ✅
- [ ] Assert on return values and side effects
- [ ] Avoid asserting on mock.toHaveBeenCalled() as primary validation
- [ ] Test integration flows end-to-end
- [ ] Include error handling tests

### Code Quality ✅
- [ ] NO UNICODE (Windows-compatible)
- [ ] Clear variable names
- [ ] Comments explain "why" not "what"
- [ ] Follows project style guide

### Documentation ✅
- [ ] File header documents strategy and test categories
- [ ] Comments explain discovered behavior vs assumptions
- [ ] Tests serve as documentation of expected behavior

### Coverage ✅
- [ ] Target 60-80% coverage (not 100%)
- [ ] Critical paths covered
- [ ] Error paths covered
- [ ] Integration points validated

---

## Example: Completed Test

See `hooks/12fa/__tests__/pre-task-real.test.js` for a complete example following this template.

**Key features of the example**:
- 27 tests across 4 categories
- Mock only fs, node-fetch, budget-tracker, OpenTelemetry
- Use REAL structured-logger, correlation-id-manager, memory-mcp-tagging-protocol
- Discovered 2 real bugs (review→coder, plan→system-architect)
- 400 LOC (vs 670 LOC for mock-heavy version)
- 44% pass rate but catches real behavior

---

**Remember**: The goal is to test real code behavior, not mock behavior. Lower pass rates that catch real bugs are better than 100% pass rates that ship bugs.
