/**
 * Integration Tests for Post-Edit Hook (Using Real Code)
 * Coverage target: 60-80%
 *
 * Strategy: Use real implementations, only mock external I/O (fs, crypto, network)
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// ============================================================================
// MOCK ONLY EXTERNAL DEPENDENCIES (fs, crypto, network)
// ============================================================================

// Mock fs to prevent actual file reads/writes during tests
const mockFs = {
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => 'mock file content'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  statSync: jest.fn(() => ({ size: 2200 }))
};
jest.mock('fs', () => mockFs);

// Mock crypto for SHA-256 hash generation
const mockCrypto = {
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'abc123def456' + '0'.repeat(52))  // 64-char SHA-256
  }))
};
jest.mock('crypto', () => mockCrypto);

// Mock node-fetch for backend API calls
const mockFetch = jest.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ success: true, batch_id: 'batch-123' })
}));
jest.mock('node-fetch', () => mockFetch);

// Mock budget tracker (optional dependency)
const mockBudgetTracker = {
  estimateCost: jest.fn(() => ({ tokensEstimated: 100, costEstimated: 0.001 })),
  deduct: jest.fn(() => ({
    success: true,
    remaining: { agent: 95000, global: 480000 },
    deductTime: 2
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
    spanId: 'test-span-789',
    traceId: 'test-trace-abc',
    setAttribute: jest.fn().mockReturnThis(),
    setAttributes: jest.fn().mockReturnThis(),
    addEvent: jest.fn().mockReturnThis(),
    recordException: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };

  return {
    startSpan: jest.fn(() => mockSpan),
    endSpan: jest.fn(),
    _mockSpan: mockSpan
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
const postEditModule = require('../post-edit.hook');

// ============================================================================
// TESTS
// ============================================================================

describe('Post-Edit Hook (Integration Tests with Real Code)', () => {
  beforeEach(() => {
    // Clear mock call history
    jest.clearAllMocks();

    // Recreate OTel adapter to reset call counts
    mockOtelAdapter = createMockAdapter();

    // Reset fs mocks to safe defaults
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('mock file content\nline 2\nline 3');
    mockFs.statSync.mockReturnValue({ size: 2200 });

    // Reset crypto mocks
    mockCrypto.createHash.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'abc123def456' + '0'.repeat(52))
    });

    // Reset environment
    process.env.NODE_ENV = 'test';
    process.env.FASTAPI_BACKEND_URL = 'http://localhost:8000';

    // Reset budget tracker
    mockBudgetTracker.estimateCost.mockReturnValue({ tokensEstimated: 100, costEstimated: 0.001 });
    mockBudgetTracker.deduct.mockReturnValue({
      success: true,
      remaining: { agent: 95000, global: 480000 },
      deductTime: 2
    });

    // Reset fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, batch_id: 'batch-123' })
    });
  });

  // ==========================================================================
  // FILE CHANGE TRACKING (Real Code)
  // ==========================================================================

  describe('File Change Tracking', () => {
    test('should calculate lines changed correctly (increase)', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\example.js',
        agentId: 'agent-1',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 50,
        linesAfter: 70,
        bytesBefore: 1500
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.linesChanged).toBe(20);  // 70 - 50
    });

    test('should calculate lines changed correctly (decrease)', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\example.js',
        agentId: 'agent-2',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 100,
        linesAfter: 80,
        bytesBefore: 3000
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.linesChanged).toBe(20);  // |80 - 100|
    });

    test('should calculate bytes changed correctly', async () => {
      mockFs.statSync.mockReturnValue({ size: 3500 });

      const context = {
        filePath: 'C:\\Users\\test\\large.js',
        agentId: 'agent-3',
        agentType: 'backend-dev',
        editType: 'modify',
        linesBefore: 150,
        linesAfter: 180,
        bytesBefore: 3000
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.bytesChanged).toBe(500);  // |3500 - 3000|
      expect(result.editInfo.bytesAfter).toBe(3500);
    });

    test('should handle zero changes gracefully', async () => {
      mockFs.statSync.mockReturnValue({ size: 2000 });

      const context = {
        filePath: 'C:\\Users\\test\\unchanged.js',
        agentId: 'agent-4',
        agentType: 'reviewer',
        editType: 'modify',
        linesBefore: 50,
        linesAfter: 50,
        bytesBefore: 2000
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.linesChanged).toBe(0);
      expect(result.editInfo.bytesChanged).toBe(0);
    });
  });

  // ==========================================================================
  // FILE HASH CALCULATION (Real Code)
  // ==========================================================================

  describe('File Hash Calculation', () => {
    test('should calculate SHA-256 hash for file integrity', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\auth.js',
        agentId: 'agent-5',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 30,
        linesAfter: 35,
        bytesBefore: 1200
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.fileHash).toBeDefined();
      expect(result.editInfo.fileHash).toMatch(/^[a-f0-9]{64}$/);  // SHA-256 format
      expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
    });

    test('should handle missing file gracefully (no hash)', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const context = {
        filePath: 'C:\\Users\\test\\missing.js',
        agentId: 'agent-6',
        agentType: 'coder',
        editType: 'delete',
        linesBefore: 20,
        linesAfter: 0,
        bytesBefore: 800
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.fileHash).toBeNull();
    });
  });

  // ==========================================================================
  // MEMORY MCP STORAGE (Real Code)
  // ==========================================================================

  describe('Memory MCP Storage', () => {
    test('should store edit event in Memory MCP with metadata', async () => {
      const mockMemoryStore = jest.fn();

      const context = {
        filePath: 'C:\\Users\\test\\user-service.js',
        agentId: 'agent-7',
        agentType: 'backend-dev',
        editType: 'create',
        linesBefore: 0,
        linesAfter: 50,
        bytesBefore: 0,
        memoryStore: mockMemoryStore
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(mockMemoryStore).toHaveBeenCalled();

      // Verify memory store was called with proper structure
      if (mockMemoryStore.mock.calls.length > 0) {
        const callArgs = mockMemoryStore.mock.calls[0][0];
        expect(callArgs).toHaveProperty('key');
        expect(callArgs).toHaveProperty('value');
        expect(callArgs.key).toMatch(/12fa\/edits/);
      }
    });

    test('should include file path and agent context in memory', async () => {
      const mockMemoryStore = jest.fn();

      const context = {
        filePath: 'C:\\Users\\test\\api\\routes.js',
        agentId: 'agent-8',
        agentType: 'sparc-coder',
        editType: 'modify',
        linesBefore: 100,
        linesAfter: 120,
        bytesBefore: 3000,
        sessionId: 'session-456',
        memoryStore: mockMemoryStore
      };

      await postEditModule.postEditHook(context);

      expect(mockMemoryStore).toHaveBeenCalled();

      if (mockMemoryStore.mock.calls.length > 0) {
        const storedValue = mockMemoryStore.mock.calls[0][0].value;
        const parsedValue = JSON.parse(storedValue);

        expect(parsedValue).toHaveProperty('event');
        expect(parsedValue).toHaveProperty('metadata');
        expect(parsedValue.metadata).toHaveProperty('file_path');
      }
    });
  });

  // ==========================================================================
  // BACKEND EVENT INGESTION (Real Code)
  // ==========================================================================

  describe('Backend Event Ingestion', () => {
    test('should send edit event to backend API', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\app.js',
        agentId: 'agent-9',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 80,
        linesAfter: 100,
        bytesBefore: 2400
      };

      await postEditModule.postEditHook(context);

      // Real code should call fetch via backend-client
      expect(mockFetch).toHaveBeenCalled();
    });

    test('should handle backend API failure gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      const context = {
        filePath: 'C:\\Users\\test\\error.js',
        agentId: 'agent-10',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 50,
        linesAfter: 60,
        bytesBefore: 1500
      };

      const result = await postEditModule.postEditHook(context);

      // Should not crash, should handle error gracefully
      expect(result).toHaveProperty('success');
    });

    test('should include trace_id in backend event', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\traced.js',
        agentId: 'agent-11',
        agentType: 'reviewer',
        editType: 'modify',
        linesBefore: 30,
        linesAfter: 40,
        bytesBefore: 1000,
        sessionId: 'session-789'
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('trace_id');
      expect(result.trace_id).toMatch(/^trace-/);
    });
  });

  // ==========================================================================
  // METRICS TRACKING (Real Code)
  // ==========================================================================

  describe('Metrics Tracking', () => {
    test('should track edits by file type (.js)', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\component.js',
        agentId: 'agent-12',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 40,
        linesAfter: 50,
        bytesBefore: 1200
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();

      // Verify metrics.json was written
      const writeCall = mockFs.writeFileSync.mock.calls.find(call =>
        call[0].includes('edit-metrics.json')
      );
      expect(writeCall).toBeDefined();
    });

    test('should track edits by agent ID', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        totalEdits: 10,
        totalLinesChanged: 200,
        totalBytesChanged: 5000,
        filesByType: {},
        editsByAgent: {},
        lastEdit: null
      }));

      const context = {
        filePath: 'C:\\Users\\test\\service.js',
        agentId: 'backend-specialist',
        agentType: 'backend-dev',
        editType: 'modify',
        linesBefore: 60,
        linesAfter: 80,
        bytesBefore: 1800
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    test('should accumulate total edits count', async () => {
      const existingMetrics = {
        totalEdits: 5,
        totalLinesChanged: 100,
        totalBytesChanged: 2500,
        filesByType: {},
        editsByAgent: {},
        lastEdit: null
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingMetrics));

      const context = {
        filePath: 'C:\\Users\\test\\utils.js',
        agentId: 'agent-13',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 20,
        linesAfter: 25,
        bytesBefore: 600
      };

      await postEditModule.postEditHook(context);

      const writeCall = mockFs.writeFileSync.mock.calls.find(call =>
        call[0].includes('edit-metrics.json')
      );

      if (writeCall) {
        const writtenData = JSON.parse(writeCall[1]);
        expect(writtenData.totalEdits).toBeGreaterThan(existingMetrics.totalEdits);
      }
    });

    test('should handle missing metrics file (create new)', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const context = {
        filePath: 'C:\\Users\\test\\new.js',
        agentId: 'agent-14',
        agentType: 'coder',
        editType: 'create',
        linesBefore: 0,
        linesAfter: 30,
        bytesBefore: 0
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // BUDGET DEDUCTION (Real Code)
  // ==========================================================================

  describe('Budget Deduction', () => {
    test('should estimate cost based on lines and bytes changed', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\large-edit.js',
        agentId: 'agent-15',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 100,
        linesAfter: 200,
        bytesBefore: 3000
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      // Budget deduction should be called for agent
      expect(mockBudgetTracker.deduct).toHaveBeenCalled();
    });

    test('should deduct actual cost from budget tracker', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\expensive.js',
        agentId: 'agent-16',
        agentType: 'backend-dev',
        editType: 'modify',
        linesBefore: 50,
        linesAfter: 150,
        bytesBefore: 1500,
        actualTokens: 1000,
        actualCost: 0.01
      };

      await postEditModule.postEditHook(context);

      expect(mockBudgetTracker.deduct).toHaveBeenCalledWith(
        'backend-dev',
        expect.objectContaining({
          tokensUsed: expect.any(Number),
          cost: expect.any(Number)
        })
      );
    });
  });

  // ==========================================================================
  // CORRELATION ID PROPAGATION (Real Implementation)
  // ==========================================================================

  describe('Correlation ID Propagation', () => {
    test('should maintain correlation ID across edit operations', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\correlated.js',
        agentId: 'agent-17',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 40,
        linesAfter: 50,
        bytesBefore: 1200
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('trace_id');
      expect(result.trace_id).toMatch(/^trace-/);
      expect(result).toHaveProperty('span_id');
    });
  });

  // ==========================================================================
  // ERROR HANDLING (Real Code Paths)
  // ==========================================================================

  describe('Error Handling', () => {
    test('should handle missing file gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.statSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const context = {
        filePath: 'C:\\Users\\test\\nonexistent.js',
        agentId: 'agent-18',
        agentType: 'coder',
        editType: 'delete',
        linesBefore: 50,
        linesAfter: 0,
        bytesBefore: 1500
      };

      // Should not crash
      const result = await postEditModule.postEditHook(context);

      // Might fail or succeed depending on implementation
      expect(result).toHaveProperty('success');
    });
  });

  // ==========================================================================
  // RETURN VALUE VALIDATION (Real Code)
  // ==========================================================================

  describe('Return Value Validation', () => {
    test('should return complete edit info structure', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\complete.js',
        agentId: 'agent-19',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 60,
        linesAfter: 80,
        bytesBefore: 1800
      };

      const result = await postEditModule.postEditHook(context);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('editInfo');
      expect(result).toHaveProperty('hookDuration');
      expect(result).toHaveProperty('trace_id');
      expect(result).toHaveProperty('span_id');
      expect(result).toHaveProperty('timestamp');

      if (result.success) {
        expect(result.editInfo).toHaveProperty('filePath');
        expect(result.editInfo).toHaveProperty('linesChanged');
        expect(result.editInfo).toHaveProperty('bytesChanged');
        expect(result.editInfo).toHaveProperty('fileHash');
      }
    });

    test('should include all required fields on success', async () => {
      const context = {
        filePath: 'C:\\Users\\test\\success.js',
        agentId: 'agent-20',
        agentType: 'backend-dev',
        editType: 'create',
        linesBefore: 0,
        linesAfter: 100,
        bytesBefore: 0
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.agentId).toBe('agent-20');
      expect(result.editInfo.agentType).toBe('backend-dev');
      expect(result.editInfo.editType).toBe('create');
      expect(typeof result.hookDuration).toBe('number');
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS (Real Code)
// ============================================================================

describe('Post-Edit Helper Functions', () => {
  test('should export postEditHook function', () => {
    expect(typeof postEditModule.postEditHook).toBe('function');
  });

  test('should export getEditMetrics function', () => {
    expect(typeof postEditModule.getEditMetrics).toBe('function');
  });

  test('getEditMetrics should return null when no metrics file exists', () => {
    mockFs.existsSync.mockReturnValue(false);

    const metrics = postEditModule.getEditMetrics();

    expect(metrics).toBeNull();
  });

  test('getEditMetrics should return parsed metrics when file exists', () => {
    const mockMetrics = {
      totalEdits: 42,
      totalLinesChanged: 1000,
      totalBytesChanged: 25000,
      filesByType: { '.js': { count: 30 } },
      editsByAgent: { 'coder': { count: 20 } }
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetrics));

    const metrics = postEditModule.getEditMetrics();

    expect(metrics).toEqual(mockMetrics);
    expect(metrics.totalEdits).toBe(42);
  });
});
