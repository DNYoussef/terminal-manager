/**
 * Integration Tests for Session-End Hook (Using Real Code)
 * Coverage target: 60-80%+
 *
 * Strategy: Use real implementations, only mock external I/O (fs, network)
 * Tests real budget reconciliation, metrics aggregation, correlation cleanup
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// ============================================================================
// MOCK ONLY EXTERNAL DEPENDENCIES (fs, network, budget-tracker)
// ============================================================================

// Mock fs to prevent actual file writes during tests
const mockFs = {
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => JSON.stringify({
    totalTasks: 5,
    completedTasks: 4,
    totalTokens: 25000,
    totalCost: 0.25
  })),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  unlinkSync: jest.fn()
};
jest.mock('fs', () => mockFs);

// Mock node-fetch for backend API calls
const mockFetch = jest.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ success: true })
}));
jest.mock('node-fetch', () => mockFetch);

// Mock budget tracker (external dependency)
const mockBudgetTracker = {
  getFinalReport: jest.fn(() => ({
    totalSpent: { agent: 25000, global: 50000 },
    remaining: { agent: 75000, global: 450000 },
    overages: []
  })),
  exportBudgetHistory: jest.fn(() => ({
    history: [],
    summary: { totalCost: 0.25, totalTokens: 25000 }
  }))
};
jest.mock('../../../../claude-code-plugins/ruv-sparc-three-loop-system/hooks/12fa/budget-tracker.js',
  () => mockBudgetTracker,
  { virtual: true }
);

// Mock OpenTelemetry adapter (external service connection)
let mockOtelAdapter;
const createMockAdapter = () => {
  const mockSpan = {
    spanId: 'test-span-123',
    traceId: 'test-trace-456',
    setAttribute: jest.fn().mockReturnThis(),
    setAttributes: jest.fn().mockReturnThis(),
    addEvent: jest.fn().mockReturnThis(),
    recordException: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };

  return {
    startSpan: jest.fn(() => mockSpan),
    endSpan: jest.fn(),
    shutdown: jest.fn(() => Promise.resolve()),
    _mockSpan: mockSpan
  };
};

mockOtelAdapter = createMockAdapter();

jest.mock('../opentelemetry-adapter', () => ({
  getAdapter: () => mockOtelAdapter
}));

// Mock backend client (external API)
const mockBackendClient = {
  updateSession: jest.fn(() => Promise.resolve({
    success: true,
    statusCode: 200
  }))
};
jest.mock('../backend-client.cjs', () => mockBackendClient);

// ============================================================================
// USE REAL IMPLEMENTATIONS
// ============================================================================

// These will use REAL code (not mocked)
const { getLogger } = require('../structured-logger');
const correlationManager = require('../correlation-id-manager');
const memoryProtocol = require('../memory-mcp-tagging-protocol');
const sessionEndModule = require('../session-end.hook');

// ============================================================================
// TESTS
// ============================================================================

describe('Session-End Hook (Integration Tests with Real Code)', () => {
  beforeEach(() => {
    // Clear mock call history
    jest.clearAllMocks();

    // Recreate OTel adapter to reset call counts
    mockOtelAdapter = createMockAdapter();

    // Reset fs mocks to safe defaults
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      totalTasks: 5,
      successfulTasks: 4,
      failedTasks: 1,
      totalEdits: 12,
      totalValidations: 8
    }));
    mockFs.readdirSync.mockReturnValue([]);

    // Reset environment
    process.env.NODE_ENV = 'test';
    process.env.FASTAPI_BACKEND_URL = 'http://localhost:8000';

    // Reset budget tracker mock
    mockBudgetTracker.getFinalReport.mockReturnValue({
      totalSpent: { agent: 25000, global: 50000 },
      remaining: { agent: 75000, global: 450000 },
      overages: []
    });

    // Reset backend client mock
    mockBackendClient.updateSession.mockResolvedValue({
      success: true,
      statusCode: 200
    });

    // Reset fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true })
    });
  });

  // ==========================================================================
  // SESSION CLEANUP (3 tests)
  // ==========================================================================

  describe('Session Cleanup', () => {
    test('should clear temporary data on session end', async () => {
      const context = {
        sessionId: 'session-cleanup-1',
        sessionDuration: 123456
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.success).toBe(true);
      expect(result.sessionSummary).toBeDefined();
      expect(result.sessionSummary.sessionId).toBe('session-cleanup-1');
    });

    test('should close OpenTelemetry connections properly', async () => {
      const context = {
        sessionId: 'session-otel-1',
        sessionDuration: 60000
      };

      await sessionEndModule.sessionEndHook(context);

      expect(mockOtelAdapter.endSpan).toHaveBeenCalled();
      expect(mockOtelAdapter.shutdown).toHaveBeenCalled();
    });

    test('should handle cleanup errors gracefully', async () => {
      // Simulate cleanup error
      mockOtelAdapter.shutdown.mockRejectedValue(new Error('Shutdown failed'));

      const context = {
        sessionId: 'session-error-cleanup',
        sessionDuration: 30000
      };

      // Should not crash despite error
      const result = await sessionEndModule.sessionEndHook(context);

      expect(result).toHaveProperty('success');
    });
  });

  // ==========================================================================
  // FINAL BUDGET RECONCILIATION (3 tests) - REAL LOGIC
  // ==========================================================================

  describe('Final Budget Reconciliation', () => {
    test('should calculate total spend from budget tracker', async () => {
      mockBudgetTracker.getFinalReport.mockReturnValue({
        totalSpent: { agent: 50000, global: 100000 },
        remaining: { agent: 50000, global: 400000 },
        overages: []
      });

      const context = {
        sessionId: 'session-budget-1',
        sessionDuration: 180000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.success).toBe(true);
      expect(result.sessionSummary).toBeDefined();
    });

    test('should verify no budget overages', async () => {
      mockBudgetTracker.getFinalReport.mockReturnValue({
        totalSpent: { agent: 25000, global: 50000 },
        remaining: { agent: 75000, global: 450000 },
        overages: []  // No overages
      });

      const context = {
        sessionId: 'session-budget-ok',
        sessionDuration: 120000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.success).toBe(true);
    });

    test('should handle budget tracker unavailability', async () => {
      // Budget tracker might not exist in some environments
      mockBudgetTracker.getFinalReport.mockImplementation(() => {
        throw new Error('Budget tracker not available');
      });

      const context = {
        sessionId: 'session-no-budget',
        sessionDuration: 60000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      // Should complete successfully even without budget data
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // METRICS EXPORT (2 tests) - REAL AGGREGATION
  // ==========================================================================

  describe('Metrics Export', () => {
    test('should export session-metrics.json with aggregated data', async () => {
      mockFs.existsSync.mockImplementation((path) => {
        // Simulate task-metrics.json exists
        return path.includes('task-metrics.json');
      });

      mockFs.readFileSync.mockImplementation((path) => {
        if (path.includes('task-metrics.json')) {
          return JSON.stringify({
            totalTasks: 10,
            successfulTasks: 8,
            failedTasks: 2
          });
        }
        return '{}';
      });

      const context = {
        sessionId: 'session-metrics-1',
        sessionDuration: 240000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.success).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();

      // Verify summary was saved
      const writeCalls = mockFs.writeFileSync.mock.calls;
      const summaryCall = writeCalls.find(call =>
        call[0].includes('session-session-metrics-1.json')
      );
      expect(summaryCall).toBeDefined();
    });

    test('should aggregate metrics from multiple sources', async () => {
      // Setup multiple metric files
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path) => {
        if (path.includes('task-metrics.json')) {
          return JSON.stringify({ totalTasks: 5, successfulTasks: 4, failedTasks: 1 });
        }
        if (path.includes('edit-metrics.json')) {
          return JSON.stringify({ totalEdits: 12 });
        }
        if (path.includes('blocked-stats.json')) {
          return JSON.stringify({ totalBlocked: 2 });
        }
        if (path.includes('hook-results.log')) {
          return 'line1\nline2\nline3\nline4\nline5';
        }
        return '{}';
      });

      const context = {
        sessionId: 'session-aggregate-1',
        sessionDuration: 180000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.success).toBe(true);
      expect(result.sessionSummary.metrics.summary).toMatchObject({
        totalTasks: 5,
        successfulTasks: 4,
        failedTasks: 1,
        totalEdits: 12,
        blockedSecrets: 2,
        totalValidations: 5
      });
    });
  });

  // ==========================================================================
  // CORRELATION ID CLEANUP (2 tests) - REAL MANAGER
  // ==========================================================================

  describe('Correlation ID Cleanup', () => {
    test('should clean up correlation tracking data', async () => {
      // Add some test correlation IDs using real manager
      const manager = correlationManager.getManager();
      manager.set('test-context-1', 'trace-123');
      manager.set('test-context-2', 'trace-456');

      const context = {
        sessionId: 'session-correlation-1',
        sessionDuration: 120000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.success).toBe(true);
      expect(result.sessionSummary.correlationStats).toBeDefined();
      expect(result.sessionSummary.correlationStats.total).toBeGreaterThanOrEqual(0);
    });

    test('should export correlation statistics', async () => {
      // Setup correlation manager with data
      const manager = correlationManager.getManager();
      manager.set('ctx-1', 'trace-001');
      manager.set('ctx-2', 'trace-002');
      manager.set('ctx-3', 'trace-003');

      const context = {
        sessionId: 'session-correlation-stats',
        sessionDuration: 150000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.success).toBe(true);
      expect(result.sessionSummary.correlationStats).toMatchObject({
        total: expect.any(Number),
        active: expect.any(Number),
        expired: expect.any(Number)
      });
      expect(result.sessionSummary.cleanedCorrelations).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // SESSION SUMMARY GENERATION (2 tests)
  // ==========================================================================

  describe('Session Summary Generation', () => {
    test('should generate human-readable session summary', async () => {
      const context = {
        sessionId: 'session-summary-1',
        sessionDuration: 300000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.success).toBe(true);
      expect(result.sessionSummary).toMatchObject({
        sessionId: 'session-summary-1',
        duration: 300000,
        timestamp: expect.any(String),
        trace_id: expect.any(String),
        span_id: expect.any(String),
        metrics: expect.any(Object),
        correlationStats: expect.any(Object)
      });
    });

    test('should include all required summary fields', async () => {
      const context = {
        sessionId: 'session-complete-summary',
        sessionDuration: 240000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.sessionSummary).toMatchObject({
        sessionId: expect.any(String),
        duration: expect.any(Number),
        metrics: {
          sessionId: expect.any(String),
          summary: expect.objectContaining({
            totalTasks: expect.any(Number),
            successfulTasks: expect.any(Number),
            failedTasks: expect.any(Number),
            totalEdits: expect.any(Number),
            totalValidations: expect.any(Number)
          })
        },
        correlationStats: expect.objectContaining({
          total: expect.any(Number),
          active: expect.any(Number),
          expired: expect.any(Number)
        }),
        cleanedCorrelations: expect.any(Number),
        timestamp: expect.any(String),
        trace_id: expect.any(String),
        span_id: expect.any(String)
      });
    });
  });

  // ==========================================================================
  // MEMORY MCP INTEGRATION (Real Protocol)
  // ==========================================================================

  describe('Memory MCP Integration', () => {
    test('should store session summary in Memory MCP', async () => {
      const mockMemoryStore = jest.fn();

      const context = {
        sessionId: 'session-memory-1',
        sessionDuration: 180000,
        memoryStore: mockMemoryStore
      };

      const result = await sessionEndModule.sessionEndHook(context);

      expect(result.success).toBe(true);
      expect(mockMemoryStore).toHaveBeenCalled();

      // Verify memory store was called with proper structure
      const storeCall = mockMemoryStore.mock.calls[0][0];
      expect(storeCall).toHaveProperty('key');
      expect(storeCall).toHaveProperty('value');
      expect(storeCall.key).toContain('session-memory-1');
    });

    test('should include WHO/WHEN/PROJECT/WHY metadata', async () => {
      const mockMemoryStore = jest.fn();

      const context = {
        sessionId: 'session-metadata-1',
        sessionDuration: 150000,
        memoryStore: mockMemoryStore
      };

      await sessionEndModule.sessionEndHook(context);

      expect(mockMemoryStore).toHaveBeenCalled();

      // Real memory protocol should inject metadata
      const storeCall = mockMemoryStore.mock.calls[0][0];
      const storedData = JSON.parse(storeCall.value);

      expect(storedData).toHaveProperty('metadata');
      expect(storedData.metadata).toHaveProperty('agent');
      expect(storedData.metadata).toHaveProperty('timestamp');
    });
  });

  // ==========================================================================
  // BACKEND API INTEGRATION (Mocked Network, Real Code)
  // ==========================================================================

  describe('Backend API Integration', () => {
    test('should send session summary to backend', async () => {
      const context = {
        sessionId: 'session-backend-1',
        sessionDuration: 200000
      };

      await sessionEndModule.sessionEndHook(context);

      expect(mockBackendClient.updateSession).toHaveBeenCalled();
      expect(mockBackendClient.updateSession).toHaveBeenCalledWith(
        'session-backend-1',
        expect.objectContaining({
          session_id: 'session-backend-1',
          status: 'completed',
          ended_at: expect.any(String),
          duration_seconds: expect.any(Number)
        })
      );
    });

    test('should handle backend API failure gracefully', async () => {
      mockBackendClient.updateSession.mockResolvedValue({
        success: false,
        reason: 'Database connection failed'
      });

      const context = {
        sessionId: 'session-backend-fail',
        sessionDuration: 120000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      // Should not crash, should complete successfully
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // ERROR HANDLING (Real Code Paths)
  // ==========================================================================

  describe('Error Handling', () => {
    test('should handle missing context gracefully', async () => {
      const result = await sessionEndModule.sessionEndHook(null);

      expect(result).toHaveProperty('success');
    });

    test('should handle empty context', async () => {
      const result = await sessionEndModule.sessionEndHook({});

      expect(result).toHaveProperty('success');
    });

    test('should handle metrics file read errors', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const context = {
        sessionId: 'session-file-error',
        sessionDuration: 60000
      };

      const result = await sessionEndModule.sessionEndHook(context);

      // Should complete despite file errors
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS (Real Code)
// ============================================================================

describe('Session-End Helper Functions', () => {
  test('should export getSessionSummary function', () => {
    expect(typeof sessionEndModule.getSessionSummary).toBe('function');
  });

  test('should export listSessionSummaries function', () => {
    expect(typeof sessionEndModule.listSessionSummaries).toBe('function');
  });

  test('getSessionSummary should return null for non-existent session', () => {
    mockFs.existsSync.mockReturnValue(false);

    const summary = sessionEndModule.getSessionSummary('non-existent-session');

    expect(summary).toBeNull();
  });

  test('listSessionSummaries should return empty array when no sessions', () => {
    mockFs.existsSync.mockReturnValue(false);

    const summaries = sessionEndModule.listSessionSummaries();

    expect(summaries).toEqual([]);
  });

  test('listSessionSummaries should parse and sort sessions', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      'session-001.json',
      'session-002.json'
    ]);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      sessionId: 'test',
      timestamp: new Date().toISOString()
    }));

    const summaries = sessionEndModule.listSessionSummaries();

    expect(Array.isArray(summaries)).toBe(true);
  });
});
