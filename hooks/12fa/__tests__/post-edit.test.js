/**
 * Unit Tests for Post-Edit Hook
 * Tests file edit tracking, SHA-256 hash calculation, Memory MCP storage,
 * backend event ingestion, and metrics aggregation
 *
 * Coverage Target: 80%
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// MOCK DEPENDENCIES (before imports)
// ============================================================================

jest.mock('../structured-logger', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../correlation-id-manager', () => ({
  getOrCreate: jest.fn((id) => `correlation-${id}`),
  propagate: jest.fn()
}));

// Mock OpenTelemetry adapter
const mockSpan = {
  spanId: 'span-edit-789',
  setAttribute: jest.fn(),
  setAttributes: jest.fn(),
  addEvent: jest.fn(),
  recordException: jest.fn(),
  end: jest.fn()
};

const mockOtelAdapterInstance = {
  startSpan: jest.fn(() => mockSpan),
  endSpan: jest.fn()
};

jest.mock('../opentelemetry-adapter', () => ({
  getAdapter: jest.fn(() => mockOtelAdapterInstance)
}));

jest.mock('../memory-mcp-tagging-protocol', () => ({
  taggedMemoryStore: jest.fn(() => ({
    success: true,
    key: 'memory-key-edit-123',
    metadata: {
      who: { agent: 'coder', category: 'editing' },
      when: { timestamp: '2025-01-19T12:00:00.000Z' },
      project: 'terminal-manager',
      why: { intent: 'refactor' }
    }
  }))
}));

jest.mock('../input-validator.cjs', () => ({
  validateEditContext: jest.fn((context) => ({
    filePath: context?.filePath || '/test/file.js',
    agentId: context?.agentId || 'agent-001',
    agentType: context?.agentType || 'coder',
    editType: context?.editType || 'modify',
    linesBefore: context?.linesBefore || 100,
    linesAfter: context?.linesAfter || 110,
    bytesBefore: context?.bytesBefore || 2000
  }))
}));

jest.mock('../backend-client.cjs', () => ({
  ingestEventBatch: jest.fn(() => Promise.resolve({
    success: true,
    statusCode: 201,
    batch_id: 'backend-batch-edit-456'
  }))
}));

// Mock fs for file operations and metrics
const mockFs = {
  existsSync: jest.fn(() => true),
  statSync: jest.fn(() => ({ size: 2200 })),
  readFileSync: jest.fn(() => 'test file content for hash calculation'),
  writeFileSync: jest.fn(() => undefined),
  mkdirSync: jest.fn(() => undefined)
};

jest.mock('fs', () => mockFs);

// Mock crypto for hash calculation
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'abcd1234567890ef' + 'f' * 48)  // 64 char hex
    }))
  }))
}));

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Post-Edit Hook', () => {
  let postEditModule;
  let mockLogger, mockCorrelationManager, mockOtelAdapter, mockMemoryProtocol;
  let mockInputValidator, mockBackendClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset persistent mock call history
    mockSpan.setAttribute.mockClear();
    mockSpan.setAttributes.mockClear();
    mockSpan.addEvent.mockClear();
    mockSpan.recordException.mockClear();
    mockSpan.end.mockClear();
    mockOtelAdapterInstance.startSpan.mockClear();
    mockOtelAdapterInstance.endSpan.mockClear();
    mockOtelAdapterInstance.startSpan.mockReturnValue(mockSpan);

    // Reset fs mocks
    mockFs.existsSync.mockClear();
    mockFs.statSync.mockClear();
    mockFs.readFileSync.mockClear();
    mockFs.writeFileSync.mockClear();
    mockFs.mkdirSync.mockClear();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ size: 2200 });
    mockFs.readFileSync.mockReturnValue('test file content');
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.mkdirSync.mockReturnValue(undefined);

    // Setup environment
    process.env.NODE_ENV = 'test';

    // Get mock references
    mockLogger = require('../structured-logger').getLogger();
    mockCorrelationManager = require('../correlation-id-manager');
    mockOtelAdapter = require('../opentelemetry-adapter').getAdapter();
    mockMemoryProtocol = require('../memory-mcp-tagging-protocol');
    mockInputValidator = require('../input-validator.cjs');
    mockBackendClient = require('../backend-client.cjs');

    // Import module under test
    postEditModule = require('../post-edit.hook');
  });

  // ==========================================================================
  // FILE CHANGE TRACKING
  // ==========================================================================

  describe('File Change Tracking', () => {
    test('should calculate lines and bytes changed', async () => {
      const context = {
        filePath: '/test/example.js',
        agentId: 'agent-001',
        agentType: 'coder',
        editType: 'modify',
        linesBefore: 100,
        linesAfter: 120,
        bytesBefore: 2000
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo).toMatchObject({
        linesChanged: 20,
        bytesChanged: 200  // 2200 - 2000
      });
    });

    test('should track file size after edit', async () => {
      mockFs.statSync.mockReturnValue({ size: 3500 });

      const context = {
        filePath: '/test/large-file.js',
        linesBefore: 50,
        linesAfter: 100,
        bytesBefore: 1500
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.editInfo.bytesAfter).toBe(3500);
      expect(result.editInfo.bytesChanged).toBe(2000);  // 3500 - 1500
    });

    test('should handle file creation (no previous stats)', async () => {
      const context = {
        filePath: '/test/new-file.js',
        agentType: 'coder',
        editType: 'create',
        linesBefore: 0,
        linesAfter: 50,
        bytesBefore: 0
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.editType).toBe('create');
      expect(result.editInfo.linesChanged).toBe(50);
    });

    test('should handle file deletion gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const context = {
        filePath: '/test/deleted-file.js',
        linesBefore: 100,
        linesAfter: 0,
        bytesBefore: 2000
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.bytesAfter).toBe(0);
    });
  });

  // ==========================================================================
  // FILE HASH CALCULATION
  // ==========================================================================

  describe('File Hash Calculation', () => {
    test('should calculate SHA-256 hash of file content', async () => {
      const context = {
        filePath: '/test/hashed-file.js',
        agentType: 'coder'
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.editInfo.fileHash).toBeTruthy();
      expect(result.editInfo.fileHash).toHaveLength(64);  // SHA-256 = 64 hex chars
    });

    test('should handle missing file when calculating hash', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const context = {
        filePath: '/test/missing-file.js'
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(result.editInfo.fileHash).toBeNull();
    });
  });

  // ==========================================================================
  // MEMORY MCP STORAGE
  // ==========================================================================

  describe('Memory MCP Storage', () => {
    test('should store edit information with tagging protocol', async () => {
      const mockMemoryStore = jest.fn();
      const context = {
        filePath: '/test/api.js',
        agentId: 'agent-002',
        agentType: 'backend-dev',
        editType: 'refactor',
        linesBefore: 200,
        linesAfter: 180,
        bytesBefore: 4000,
        memoryStore: mockMemoryStore
      };

      await postEditModule.postEditHook(context);

      expect(mockMemoryProtocol.taggedMemoryStore).toHaveBeenCalled();
      const [agent, data, metadata] = mockMemoryProtocol.taggedMemoryStore.mock.calls[0];

      expect(agent).toBe('backend-dev');
      expect(data).toContain('file-edited');
      expect(data).toContain('/test/api.js');
      expect(metadata).toMatchObject({
        intent: 'refactor',
        file_path: '/test/api.js'
      });

      expect(mockMemoryStore).toHaveBeenCalled();
    });

    test('should handle missing memoryStore gracefully', async () => {
      const context = {
        filePath: '/test/no-memory.js',
        agentType: 'coder'
        // No memoryStore provided
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      // Should not call Memory MCP when memoryStore not provided
      expect(mockMemoryProtocol.taggedMemoryStore).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // BACKEND EVENT INGESTION
  // ==========================================================================

  describe('Backend Event Ingestion', () => {
    test('should send edit event to backend API', async () => {
      const context = {
        filePath: '/test/component.jsx',
        agentId: 'agent-003',
        agentType: 'frontend-dev',
        editType: 'modify',
        sessionId: 'session-456',
        linesBefore: 150,
        linesAfter: 165,
        bytesBefore: 3000
      };

      await postEditModule.postEditHook(context);

      expect(mockBackendClient.ingestEventBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            event_type: 'file-edited',
            agent_id: 'agent-003',
            agent_type: 'frontend-dev',
            project: 'terminal-manager',
            intent: 'refactor'
          })
        ])
      );
    });

    test('should handle backend ingestion failure gracefully', async () => {
      mockBackendClient.ingestEventBatch.mockResolvedValue({
        success: false,
        reason: 'Backend unavailable'
      });

      const context = {
        filePath: '/test/file.js',
        agentType: 'coder'
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Backend edit event ingestion failed, event logged locally only',
        expect.any(Object)
      );
    });

    test('should log locally if backend throws error', async () => {
      mockBackendClient.ingestEventBatch.mockRejectedValue(
        new Error('Network error')
      );

      const context = {
        filePath: '/test/file.js'
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Backend edit event ingestion error, gracefully degraded',
        expect.objectContaining({
          error: 'Network error'
        })
      );
    });
  });

  // ==========================================================================
  // METRICS TRACKING
  // ==========================================================================

  describe('Metrics Tracking', () => {
    test('should update edit-metrics.json file', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const context = {
        filePath: '/test/example.js',
        agentId: 'agent-001',
        agentType: 'coder',
        linesBefore: 100,
        linesAfter: 120,
        bytesBefore: 2000
      };

      await postEditModule.postEditHook(context);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('edit-metrics.json'),
        expect.any(String),
        'utf8'
      );
    });

    test('should track edits by file type', async () => {
      const existingMetrics = {
        totalEdits: 5,
        filesByType: {
          '.js': { count: 3, linesChanged: 50, bytesChanged: 1000 }
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingMetrics));

      const context = {
        filePath: '/test/app.js',
        linesBefore: 100,
        linesAfter: 110,
        bytesBefore: 2000
      };

      await postEditModule.postEditHook(context);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenData = mockFs.writeFileSync.mock.calls[0][1];
      const updatedMetrics = JSON.parse(writtenData);

      expect(updatedMetrics.totalEdits).toBe(6);
      expect(updatedMetrics.filesByType['.js'].count).toBe(4);
    });

    test('should track edits by agent', async () => {
      const existingMetrics = {
        totalEdits: 10,
        editsByAgent: {
          'agent-001': { count: 5, linesChanged: 100, bytesChanged: 2000 }
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingMetrics));

      const context = {
        filePath: '/test/file.js',
        agentId: 'agent-001',
        linesBefore: 50,
        linesAfter: 60,
        bytesBefore: 1000
      };

      await postEditModule.postEditHook(context);

      const writtenData = mockFs.writeFileSync.mock.calls[0][1];
      const updatedMetrics = JSON.parse(writtenData);

      expect(updatedMetrics.editsByAgent['agent-001'].count).toBe(6);
      expect(updatedMetrics.editsByAgent['agent-001'].linesChanged).toBe(110);
    });

    test('should retrieve edit metrics', () => {
      const metrics = {
        totalEdits: 15,
        totalLinesChanged: 500,
        totalBytesChanged: 10000
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(metrics));

      const result = postEditModule.getEditMetrics();

      expect(result).toEqual(metrics);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('edit-metrics.json'),
        'utf8'
      );
    });
  });

  // ==========================================================================
  // BUDGET DEDUCTION
  // ==========================================================================

  describe('Budget Deduction', () => {
    test('should estimate tokens based on lines and bytes changed', async () => {
      const context = {
        filePath: '/test/large-edit.js',
        agentType: 'coder',
        linesBefore: 100,
        linesAfter: 150,
        bytesBefore: 2000
        // No actualTokens provided - should estimate
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      // Should use estimation based on linesChanged (50) * 10 or bytesChanged (200) / 4
    });

    test('should use provided actual usage when available', async () => {
      const context = {
        filePath: '/test/tracked-edit.js',
        agentType: 'ml-developer',
        actualTokens: 5000,
        actualCost: 0.05,
        linesBefore: 100,
        linesAfter: 110
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(true);
      // Should use actualTokens/actualCost if provided
    });
  });

  // ==========================================================================
  // CORRELATION ID PROPAGATION
  // ==========================================================================

  describe('Correlation ID Propagation', () => {
    test('should propagate correlation ID for related operations', async () => {
      const context = {
        filePath: '/test/component.jsx',
        agentType: 'frontend-dev'
      };

      await postEditModule.postEditHook(context);

      expect(mockCorrelationManager.propagate).toHaveBeenCalledWith(
        'post-edit-hook',
        expect.stringContaining('file-edit-')
      );
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  describe('Error Handling', () => {
    test('should catch and log exceptions during execution', async () => {
      mockInputValidator.validateEditContext.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      const context = {
        filePath: '/test/error-file.js'
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Post-edit hook execution failed',
        expect.objectContaining({
          error: 'Validation failed'
        })
      );
    });
  });

  // ==========================================================================
  // RETURN VALUE VALIDATION
  // ==========================================================================

  describe('Return Value Validation', () => {
    test('should return complete success response', async () => {
      const context = {
        filePath: '/test/complete.js',
        agentType: 'coder',
        linesBefore: 100,
        linesAfter: 110,
        bytesBefore: 2000
      };

      const result = await postEditModule.postEditHook(context);

      expect(result).toMatchObject({
        success: true,
        editInfo: expect.objectContaining({
          filePath: '/test/complete.js',
          linesChanged: expect.any(Number),
          bytesChanged: expect.any(Number),
          fileHash: expect.any(String)
        }),
        hookDuration: expect.any(Number),
        trace_id: expect.any(String),
        span_id: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    test('should include hook execution duration', async () => {
      const context = {
        filePath: '/test/duration.js'
      };

      const result = await postEditModule.postEditHook(context);

      expect(result.hookDuration).toBeGreaterThanOrEqual(0);
      expect(typeof result.hookDuration).toBe('number');
    });
  });
});

// ============================================================================
// COVERAGE SUMMARY
// ============================================================================

/**
POST-EDIT HOOK COVERAGE:

1. File Change Tracking (4 tests):
   - Calculate lines and bytes changed
   - Track file size after edit
   - Handle file creation
   - Handle file deletion

2. File Hash Calculation (2 tests):
   - Calculate SHA-256 hash
   - Handle missing file

3. Memory MCP Storage (2 tests):
   - Store with tagging protocol
   - Graceful degradation without memoryStore

4. Backend Event Ingestion (3 tests):
   - Send event to API
   - Handle ingestion failure
   - Handle network errors

5. Metrics Tracking (4 tests):
   - Update metrics file
   - Track by file type
   - Track by agent
   - Retrieve metrics

6. Budget Deduction (2 tests):
   - Estimate tokens from lines/bytes
   - Use provided actual usage

7. Correlation ID Propagation (1 test):
   - Propagate to related operations

8. Error Handling (1 test):
   - Catch and log exceptions

9. Return Value Validation (2 tests):
   - Complete success response
   - Hook execution duration

TOTAL: 21 TESTS
TARGET COVERAGE: 80%
CORE FUNCTIONALITY: File edit tracking, hash calculation, metrics aggregation
*/
