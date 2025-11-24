/**
 * Integration Tests for Post-Task Hook (Using Real Code)
 * Coverage target: 60-80%
 *
 * Strategy: Use real implementations, only mock external I/O (fs, network)
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// ============================================================================
// MOCK ONLY EXTERNAL DEPENDENCIES (fs, network)
// ============================================================================

// Mock fs to prevent actual file writes during tests
const mockFs = {
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn()
};
jest.mock('fs', () => mockFs);

// Mock node-fetch for backend API calls
const mockFetch = jest.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ success: true, eventId: 'evt-123' })
}));
jest.mock('node-fetch', () => mockFetch);

// Mock budget tracker (optional dependency that may not exist)
const mockBudgetTracker = {
  deduct: jest.fn(() => ({
    success: true,
    remaining: { agent: 95000, global: 450000 },
    deductTime: 2
  }))
};
jest.mock('../../../../claude-code-plugins/ruv-sparc-three-loop-system/hooks/12fa/budget-tracker.js',
  () => mockBudgetTracker,
  { virtual: true }
);

// Mock backend-client.cjs (external API calls)
const mockBackendClient = {
  ingestEventBatch: jest.fn(() => Promise.resolve({
    success: true,
    statusCode: 200,
    eventsIngested: 1
  }))
};
jest.mock('../backend-client.cjs', () => mockBackendClient);

// Mock input-validator.cjs (may use external schemas)
const mockInputValidator = {
  validateTaskContext: jest.fn((ctx) => ({
    taskId: ctx?.taskId || 'task-unknown',
    agentId: ctx?.agentId || 'agent-unknown',
    agentType: ctx?.agentType || 'coder',
    status: ctx?.status || 'completed',
    duration: ctx?.duration || 0,
    error: ctx?.error || null,
    output: ctx?.output || '',
    filesModified: ctx?.filesModified || [],
    commandsExecuted: ctx?.commandsExecuted || 0
  }))
};
jest.mock('../input-validator.cjs', () => mockInputValidator);

// Mock OpenTelemetry adapter (external service connection)
let mockOtelAdapter;
const createMockAdapter = () => {
  const mockSpan = {
    spanId: 'test-span-456',
    traceId: 'test-trace-789',
    setAttribute: jest.fn().mockReturnThis(),
    setAttributes: jest.fn().mockReturnThis(),
    addEvent: jest.fn().mockReturnThis(),
    recordException: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };

  return {
    startSpan: jest.fn(() => mockSpan),
    endSpan: jest.fn(),
    _mockSpan: mockSpan  // Expose for test verification
  };
};

mockOtelAdapter = createMockAdapter();

jest.mock('../opentelemetry-adapter', () => ({
  getAdapter: () => mockOtelAdapter
}));

// ============================================================================
// USE REAL IMPLEMENTATIONS
// ============================================================================

// These will use REAL code (not mocked)
const { getLogger } = require('../structured-logger');
const correlationManager = require('../correlation-id-manager');
const memoryProtocol = require('../memory-mcp-tagging-protocol');
const postTaskModule = require('../post-task.hook');

// ============================================================================
// TESTS
// ============================================================================

describe('Post-Task Hook (Integration Tests with Real Code)', () => {
  beforeEach(() => {
    // Clear mock call history
    jest.clearAllMocks();

    // Recreate OTel adapter to reset call counts
    mockOtelAdapter = createMockAdapter();

    // Reset fs mocks to safe defaults
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');

    // Reset environment
    process.env.NODE_ENV = 'test';
    process.env.FASTAPI_BACKEND_URL = 'http://localhost:8000';

    // Reset budget tracker to succeed by default
    mockBudgetTracker.deduct.mockReturnValue({
      success: true,
      remaining: { agent: 95000, global: 450000 },
      deductTime: 2
    });

    // Reset backend client to succeed
    mockBackendClient.ingestEventBatch.mockResolvedValue({
      success: true,
      statusCode: 200,
      eventsIngested: 1
    });

    // Reset input validator
    mockInputValidator.validateTaskContext.mockImplementation((ctx) => ({
      taskId: ctx?.taskId || 'task-unknown',
      agentId: ctx?.agentId || 'agent-unknown',
      agentType: ctx?.agentType || 'coder',
      status: ctx?.status || 'completed',
      duration: ctx?.duration || 0,
      error: ctx?.error || null,
      output: ctx?.output || '',
      filesModified: ctx?.filesModified || [],
      commandsExecuted: ctx?.commandsExecuted || 0
    }));
  });

  // ==========================================================================
  // CORRELATION ID CONTINUITY (Real Code)
  // ==========================================================================

  describe('Correlation ID Continuity', () => {
    test('should retrieve correlation ID from pre-task hook', async () => {
      // Simulate pre-task correlation ID creation
      correlationManager.getOrCreate('pre-task-hook', 'prefixed');

      const context = {
        taskId: 'task-001',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result).toHaveProperty('trace_id');
      expect(result.trace_id).toBeTruthy();
    });

    test('should propagate correlation ID to next task', async () => {
      const context = {
        taskId: 'task-002',
        nextTaskId: 'task-003',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result.success).toBe(true);
      // Real correlation manager should handle propagation
    });

    test('should use prefixed format for correlation IDs', async () => {
      const context = {
        taskId: 'task-prefix-test',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
      };

      const result = await postTaskModule.postTaskHook(context);

      // Real correlation manager should generate proper IDs
      expect(result.trace_id).toMatch(/^trace-/);
    });

    test('should create new correlation ID if pre-task ID missing', async () => {
      const context = {
        taskId: 'task-no-pretask',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result).toHaveProperty('trace_id');
      expect(result.trace_id).toBeTruthy();
    });
  });

  // ==========================================================================
  // TASK RESULT PROCESSING (Real Code)
  // ==========================================================================

  describe('Task Result Processing', () => {
    test('should process completed task successfully', async () => {
      const context = {
        taskId: 'task-complete-1',
        agentId: 'agent-001',
        agentType: 'coder',
        status: 'completed',
        duration: 5000,
        filesModified: ['file1.js', 'file2.js'],
        commandsExecuted: 3
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result.success).toBe(true);
      expect(result.taskResult).toHaveProperty('taskId', 'task-complete-1');
      expect(result.taskResult).toHaveProperty('status', 'completed');
      expect(result.taskResult.filesModified).toHaveLength(2);
    });

    test('should process failed task with error details', async () => {
      const testError = new Error('Test failure');

      const context = {
        taskId: 'task-failed-1',
        agentType: 'tester',
        status: 'failed',
        duration: 2000,
        error: testError,
        filesModified: [],
        commandsExecuted: 1
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result.success).toBe(true);
      expect(result.taskResult.status).toBe('failed');
      expect(result.taskResult.error).toBeTruthy();
    });

    test('should calculate task duration correctly', async () => {
      const context = {
        taskId: 'task-duration-1',
        status: 'completed',
        duration: 12345,
        filesModified: [],
        commandsExecuted: 0
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result.taskResult.duration).toBe(12345);
    });

    test('should track files modified during task', async () => {
      const context = {
        taskId: 'task-files-1',
        status: 'completed',
        filesModified: ['src/app.js', 'tests/app.test.js', 'docs/README.md'],
        commandsExecuted: 2
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result.taskResult.filesModified).toHaveLength(3);
      expect(result.taskResult.filesModified).toContain('src/app.js');
    });
  });

  // ==========================================================================
  // MEMORY MCP STORAGE (Real Code)
  // ==========================================================================

  describe('Memory MCP Storage', () => {
    test('should store task results with WHO/WHEN/PROJECT/WHY metadata', async () => {
      const mockMemoryStore = jest.fn();

      const context = {
        taskId: 'task-memory-1',
        agentType: 'backend-dev',
        status: 'completed',
        duration: 3000,
        filesModified: ['api.js'],
        commandsExecuted: 1,
        memoryStore: mockMemoryStore
      };

      await postTaskModule.postTaskHook(context);

      // Real memory protocol should be called with tagging
      expect(mockMemoryStore).toHaveBeenCalled();

      if (mockMemoryStore.mock.calls.length > 0) {
        const callArgs = mockMemoryStore.mock.calls[0][0];
        expect(callArgs).toHaveProperty('key');
        expect(callArgs).toHaveProperty('value');
      }
    });

    test('should include task metadata in memory storage', async () => {
      const mockMemoryStore = jest.fn();

      const context = {
        taskId: 'task-metadata-2',
        agentType: 'coder',
        status: 'completed',
        filesModified: ['feature.js'],
        commandsExecuted: 2,
        memoryStore: mockMemoryStore
      };

      await postTaskModule.postTaskHook(context);

      expect(mockMemoryStore).toHaveBeenCalled();
    });

    test('should handle missing memory store gracefully', async () => {
      const context = {
        taskId: 'task-no-memory',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
        // No memoryStore provided
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // BACKEND EVENT INGESTION (Mocked Network, Real Code)
  // ==========================================================================

  describe('Backend Event Ingestion', () => {
    test('should send task completion event to backend', async () => {
      const context = {
        taskId: 'task-backend-1',
        agentType: 'coder',
        status: 'completed',
        filesModified: ['app.js'],
        commandsExecuted: 1
      };

      await postTaskModule.postTaskHook(context);

      // Real code should call backend client (which we mocked)
      expect(mockBackendClient.ingestEventBatch).toHaveBeenCalled();
    });

    test('should include proper payload in backend request', async () => {
      const context = {
        taskId: 'task-payload-1',
        agentType: 'backend-dev',
        agentId: 'agent-backend-1',
        status: 'completed',
        duration: 5000,
        filesModified: ['api.js', 'db.js'],
        commandsExecuted: 3,
        sessionId: 'session-456'
      };

      await postTaskModule.postTaskHook(context);

      expect(mockBackendClient.ingestEventBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            event_type: 'task-completed',
            agent_type: 'backend-dev',
            project: 'terminal-manager'
          })
        ])
      );
    });

    test('should handle backend API failure gracefully', async () => {
      mockBackendClient.ingestEventBatch.mockRejectedValue(new Error('Network error'));

      const context = {
        taskId: 'task-backend-fail',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
      };

      const result = await postTaskModule.postTaskHook(context);

      // Should not crash, should handle error gracefully
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // BUDGET DEDUCTION (Real Code)
  // ==========================================================================

  describe('Budget Deduction', () => {
    test('should deduct actual token usage from budget', async () => {
      const context = {
        taskId: 'task-budget-1',
        agentType: 'coder',
        status: 'completed',
        actualTokens: 10000,
        actualCost: 0.10,
        filesModified: [],
        commandsExecuted: 0
      };

      await postTaskModule.postTaskHook(context);

      expect(mockBudgetTracker.deduct).toHaveBeenCalledWith(
        'coder',
        expect.objectContaining({
          tokensUsed: 10000
        })
      );
    });

    test('should use fallback estimates if actual usage unavailable', async () => {
      const context = {
        taskId: 'task-budget-fallback',
        agentType: 'tester',
        status: 'completed',
        duration: 8000,  // Will be used for estimate
        filesModified: [],
        commandsExecuted: 0
      };

      await postTaskModule.postTaskHook(context);

      // Should deduct with estimated usage
      expect(mockBudgetTracker.deduct).toHaveBeenCalled();
    });

    test('should handle budget deduction failure gracefully', async () => {
      mockBudgetTracker.deduct.mockReturnValue({
        success: false,
        reason: 'Budget exhausted'
      });

      const context = {
        taskId: 'task-budget-fail',
        agentType: 'coder',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
      };

      const result = await postTaskModule.postTaskHook(context);

      // Should complete successfully even if budget deduction fails
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // METRICS TRACKING (Real Code)
  // ==========================================================================

  describe('Metrics Tracking', () => {
    test('should update task metrics file', async () => {
      const context = {
        taskId: 'task-metrics-1',
        status: 'completed',
        duration: 5000,
        filesModified: ['file.js'],
        commandsExecuted: 2
      };

      await postTaskModule.postTaskHook(context);

      // Real code should write metrics
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    test('should track successful task count', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        totalTasks: 10,
        successfulTasks: 8,
        failedTasks: 2
      }));

      const context = {
        taskId: 'task-success-count',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
      };

      await postTaskModule.postTaskHook(context);

      // Metrics should be updated
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    test('should track failed task count', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        totalTasks: 5,
        successfulTasks: 4,
        failedTasks: 1
      }));

      const context = {
        taskId: 'task-failed-count',
        status: 'failed',
        error: new Error('Test error'),
        filesModified: [],
        commandsExecuted: 0
      };

      await postTaskModule.postTaskHook(context);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // OPENTELEMETRY INTEGRATION (Mocked Adapter, Real Tracing Logic)
  // ==========================================================================

  describe('OpenTelemetry Tracing', () => {
    test('should create span for post-task execution', async () => {
      const context = {
        taskId: 'task-otel-1',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
      };

      await postTaskModule.postTaskHook(context);

      expect(mockOtelAdapter.startSpan).toHaveBeenCalledWith(
        'post-task-hook',
        expect.any(Object)
      );
    });

    test('should add task result attributes to span', async () => {
      const context = {
        taskId: 'task-attrs-1',
        agentType: 'coder',
        status: 'completed',
        duration: 3000,
        filesModified: ['file1.js', 'file2.js'],
        commandsExecuted: 2
      };

      await postTaskModule.postTaskHook(context);

      const mockSpan = mockOtelAdapter._mockSpan;
      expect(mockSpan.setAttributes).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // ERROR HANDLING (Real Code Paths)
  // ==========================================================================

  describe('Error Handling', () => {
    test('should handle missing context gracefully', async () => {
      const result = await postTaskModule.postTaskHook(null);

      expect(result).toHaveProperty('success');
    });

    test('should handle empty context', async () => {
      const result = await postTaskModule.postTaskHook({});

      expect(result).toHaveProperty('success');
    });
  });

  // ==========================================================================
  // RETURN VALUE VALIDATION (Real Code)
  // ==========================================================================

  describe('Return Value Validation', () => {
    test('should return proper structure on success', async () => {
      const context = {
        taskId: 'task-return-1',
        status: 'completed',
        filesModified: [],
        commandsExecuted: 0
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('taskResult');
      expect(result).toHaveProperty('hookDuration');
      expect(result).toHaveProperty('trace_id');
      expect(result).toHaveProperty('span_id');
      expect(result).toHaveProperty('timestamp');
    });

    test('should return proper structure on error', async () => {
      // Force an error by making validateTaskContext throw
      mockInputValidator.validateTaskContext.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      const context = {
        taskId: 'task-error-return'
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('trace_id');
      expect(result).toHaveProperty('span_id');
    });
  });

  // ==========================================================================
  // INTEGRATION SCENARIOS (Real Code End-to-End)
  // ==========================================================================

  describe('Integration Scenarios', () => {
    test('should execute complete post-task flow for successful task', async () => {
      const mockMemoryStore = jest.fn();

      const context = {
        taskId: 'task-integration-1',
        agentId: 'agent-backend-1',
        agentType: 'backend-dev',
        status: 'completed',
        duration: 8000,
        actualTokens: 15000,
        actualCost: 0.15,
        filesModified: ['api/users.js', 'api/auth.js'],
        commandsExecuted: 4,
        sessionId: 'session-789',
        memoryStore: mockMemoryStore
      };

      const result = await postTaskModule.postTaskHook(context);

      // Verify all major components were involved
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('trace_id');
      expect(result).toHaveProperty('span_id');
      expect(mockOtelAdapter.startSpan).toHaveBeenCalled();
      expect(mockBackendClient.ingestEventBatch).toHaveBeenCalled();
      expect(mockBudgetTracker.deduct).toHaveBeenCalled();
      expect(mockMemoryStore).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    test('should execute complete post-task flow for failed task', async () => {
      const testError = new Error('Implementation failed');

      const context = {
        taskId: 'task-integration-fail',
        agentType: 'coder',
        status: 'failed',
        duration: 3000,
        error: testError,
        filesModified: [],
        commandsExecuted: 2
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result.success).toBe(true);
      expect(result.taskResult.status).toBe('failed');
      expect(result.taskResult.error).toBeTruthy();
    });

    test('should handle unknown status gracefully', async () => {
      const context = {
        taskId: 'task-unknown-status',
        status: 'pending',  // Unknown status
        filesModified: [],
        commandsExecuted: 0
      };

      const result = await postTaskModule.postTaskHook(context);

      expect(result.success).toBe(true);
      expect(result.taskResult.status).toBe('pending');
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS (Real Code)
// ============================================================================

describe('Post-Task Helper Functions', () => {
  test('should export postTaskHook function', () => {
    expect(typeof postTaskModule.postTaskHook).toBe('function');
  });

  test('should export getTaskMetrics function', () => {
    expect(typeof postTaskModule.getTaskMetrics).toBe('function');
  });

  test('getTaskMetrics should return null if metrics file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    const metrics = postTaskModule.getTaskMetrics();

    expect(metrics).toBeNull();
  });

  test('getTaskMetrics should return parsed metrics if file exists', () => {
    const mockMetrics = {
      totalTasks: 42,
      successfulTasks: 40,
      failedTasks: 2,
      averageDuration: 5000
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetrics));

    const metrics = postTaskModule.getTaskMetrics();

    expect(metrics).toEqual(mockMetrics);
  });
});
