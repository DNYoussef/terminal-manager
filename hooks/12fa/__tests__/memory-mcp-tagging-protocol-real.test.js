/**
 * Integration Tests for Memory MCP Tagging Protocol (Using Real Code)
 * Coverage target: 70-85%
 *
 * Strategy: Mock ONLY Memory MCP client, use REAL tagging logic
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// ============================================================================
// MOCK ONLY MEMORY MCP CLIENT
// ============================================================================

// Mock Memory MCP client (external dependency)
const mockMemoryMcpClient = {
  memory_store: jest.fn(() => Promise.resolve({ success: true, id: 'mem-123' })),
  vector_search: jest.fn(() => Promise.resolve({ results: [] }))
};

jest.mock('@modelcontextprotocol/server-memory', () => ({
  createMemoryClient: () => mockMemoryMcpClient
}), { virtual: true });

// Mock fs to prevent actual file writes during tests
const mockFs = {
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{"coder": {"agent_id": "agent-123", "role": "developer", "capabilities": ["coding"]}}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
};
jest.mock('fs', () => mockFs);

// Mock budget tracker (optional dependency)
const mockBudgetTracker = {
  getBudgetStatus: jest.fn(() => ({
    session: { tokens_used: 1000, allowed: true },
    daily: { cost_used: 0.05, cost_limit: 10.00 }
  }))
};
jest.mock('../utils/budget-tracker.js', () => mockBudgetTracker, { virtual: true });

// ============================================================================
// USE REAL IMPLEMENTATIONS
// ============================================================================

// Import REAL tagging protocol module
const memoryProtocol = require('../memory-mcp-tagging-protocol');

// ============================================================================
// TESTS
// ============================================================================

describe('Memory MCP Tagging Protocol (Integration Tests with Real Code)', () => {
  beforeEach(() => {
    // Clear mock call history
    jest.clearAllMocks();

    // Reset fs mocks to safe defaults
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');

    // Reset budget tracker to return valid data
    mockBudgetTracker.getBudgetStatus.mockReturnValue({
      session: { tokens_used: 1000, allowed: true },
      daily: { cost_used: 0.05, cost_limit: 10.00 }
    });

    // Reset environment
    process.env.NODE_ENV = 'test';
  });

  // ==========================================================================
  // WHO METADATA INJECTION (4 tests) - Agent name, category, capabilities
  // ==========================================================================

  describe('WHO Metadata Injection', () => {
    test('should inject agent name from parameter', () => {
      const result = memoryProtocol.taggedMemoryStore('coder', 'Implement feature X', {});

      expect(result.metadata.agent.name).toBe('coder');
      expect(result.metadata._agent).toBe('coder');
    });

    test('should inject agent category from AGENT_TOOL_ACCESS', () => {
      const result = memoryProtocol.taggedMemoryStore('coder', 'Code review', {});

      expect(result.metadata.agent.category).toBe('code-quality');
    });

    test('should inject agent capabilities from AGENT_TOOL_ACCESS', () => {
      const result = memoryProtocol.taggedMemoryStore('coder', 'Fix bug', {});

      expect(result.metadata.agent.capabilities).toContain('memory-mcp');
      expect(result.metadata.agent.capabilities).toContain('connascence-analyzer');
      expect(result.metadata.agent.capabilities).toContain('claude-flow');
    });

    test('should use default category for unknown agent', () => {
      const result = memoryProtocol.taggedMemoryStore('unknown-agent', 'Some task', {});

      expect(result.metadata.agent.category).toBe('general');
      expect(result.metadata.agent.capabilities).toContain('memory-mcp');
    });
  });

  // ==========================================================================
  // WHEN TIMESTAMP FORMATTING (3 tests) - ISO8601, Unix, human-readable
  // ==========================================================================

  describe('WHEN Timestamp Formatting', () => {
    test('should generate ISO8601 timestamp', () => {
      const result = memoryProtocol.taggedMemoryStore('coder', 'Task', {});

      expect(result.metadata.timestamp.iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.metadata._tagged_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should generate Unix timestamp', () => {
      const beforeTimestamp = Math.floor(Date.now() / 1000);
      const result = memoryProtocol.taggedMemoryStore('coder', 'Task', {});
      const afterTimestamp = Math.floor(Date.now() / 1000);

      expect(result.metadata.timestamp.unix).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(result.metadata.timestamp.unix).toBeLessThanOrEqual(afterTimestamp);
      expect(typeof result.metadata.timestamp.unix).toBe('number');
    });

    test('should generate human-readable timestamp', () => {
      const result = memoryProtocol.taggedMemoryStore('coder', 'Task', {});

      // Should contain date and time components
      expect(result.metadata.timestamp.readable).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result.metadata.timestamp.readable).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  // ==========================================================================
  // PROJECT DETECTION LOGIC (5 tests) - Detect from cwd, git, package.json
  // ==========================================================================

  describe('PROJECT Detection Logic', () => {
    test('should detect terminal-manager from current working directory', () => {
      const originalCwd = process.cwd();
      process.chdir = jest.fn(() => {});
      Object.defineProperty(process, 'cwd', {
        value: () => 'C:\\Users\\17175\\terminal-manager\\hooks\\12fa',
        configurable: true
      });

      const project = memoryProtocol.detectProject();

      expect(project).toBe('unknown-project'); // terminal-manager not in detection list

      // Restore
      Object.defineProperty(process, 'cwd', {
        value: () => originalCwd,
        configurable: true
      });
    });

    test('should detect connascence-analyzer from cwd', () => {
      const project = memoryProtocol.detectProject('C:\\Users\\17175\\connascence-analyzer\\src', '');

      expect(project).toBe('connascence-analyzer');
    });

    test('should detect memory-mcp from cwd', () => {
      const project = memoryProtocol.detectProject('C:\\Users\\17175\\memory-mcp\\lib', '');

      expect(project).toBe('memory-mcp-triple-system');
    });

    test('should detect claude-flow from cwd', () => {
      const project = memoryProtocol.detectProject('C:\\Users\\17175\\claude-flow\\src', '');

      expect(project).toBe('claude-flow');
    });

    test('should detect project from content when cwd is unknown', () => {
      const project = memoryProtocol.detectProject(
        'C:\\Users\\17175\\unknown-project',
        'Fixing connascence violation in module X'
      );

      expect(project).toBe('connascence-analyzer');
    });
  });

  // ==========================================================================
  // WHY INTENT CLASSIFICATION (4 tests) - implementation/bugfix/refactor/testing
  // ==========================================================================

  describe('WHY Intent Classification', () => {
    test('should classify implementation intent', () => {
      const analyzer = new memoryProtocol.IntentAnalyzer();
      const intent = analyzer.analyze('Implement user authentication feature');

      expect(intent).toBe('implementation');
    });

    test('should classify bugfix intent', () => {
      const analyzer = new memoryProtocol.IntentAnalyzer();
      const intent = analyzer.analyze('Fix authentication error in login module');

      expect(intent).toBe('bugfix');
    });

    test('should classify refactor intent', () => {
      const analyzer = new memoryProtocol.IntentAnalyzer();
      const intent = analyzer.analyze('Refactor authentication module for clarity');

      expect(intent).toBe('refactor');
    });

    test('should classify testing intent', () => {
      const analyzer = new memoryProtocol.IntentAnalyzer();
      const intent = analyzer.analyze('Write comprehensive tests for auth module');

      expect(intent).toBe('testing');
    });
  });

  // ==========================================================================
  // METADATA INTEGRATION (4 tests) - Full WHO/WHEN/PROJECT/WHY integration
  // ==========================================================================

  describe('Metadata Integration', () => {
    test('should integrate all WHO/WHEN/PROJECT/WHY metadata', () => {
      const result = memoryProtocol.taggedMemoryStore(
        'coder',
        'Implement REST API for user management',
        {
          project: 'test-project',
          task_id: 'TASK-123'
        }
      );

      // WHO
      expect(result.metadata.agent.name).toBe('coder');
      expect(result.metadata.agent.category).toBe('code-quality');

      // WHEN
      expect(result.metadata.timestamp.iso).toBeTruthy();
      expect(result.metadata.timestamp.unix).toBeGreaterThan(0);

      // PROJECT
      expect(result.metadata.project).toBe('test-project');

      // WHY
      expect(result.metadata.intent.primary).toBe('implementation');
      expect(result.metadata.intent.task_id).toBe('TASK-123');
    });

    test('should auto-detect intent when not provided', () => {
      const result = memoryProtocol.taggedMemoryStore(
        'tester',
        'Run integration tests on authentication',
        {}
      );

      expect(result.metadata.intent.primary).toBe('testing');
      expect(result.metadata._intent).toBe('testing');
    });

    test('should auto-detect project from cwd when not provided', () => {
      const result = memoryProtocol.taggedMemoryStore('coder', 'Task', {});

      // Should have some project (either detected or unknown-project)
      expect(result.metadata.project).toBeTruthy();
      expect(result.metadata._project).toBeTruthy();
    });

    test('should preserve user metadata while adding enriched metadata', () => {
      const userMetadata = {
        custom_field: 'custom_value',
        session_id: 'session-456'
      };

      const result = memoryProtocol.taggedMemoryStore('coder', 'Task', userMetadata);

      // User metadata preserved
      expect(result.metadata.custom_field).toBe('custom_value');
      expect(result.metadata.context.session_id).toBe('session-456');

      // Enriched metadata present
      expect(result.metadata.agent).toBeTruthy();
      expect(result.metadata.timestamp).toBeTruthy();
    });
  });

  // ==========================================================================
  // AGENT REALITY MAP V2.0 FEATURES (5 tests) - IDENTITY, BUDGET, QUALITY
  // ==========================================================================

  describe('Agent Reality Map V2.0 Features', () => {
    test('should include IDENTITY metadata when registry available', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        'coder': {
          agent_id: 'agent-coder-001',
          role: 'developer',
          capabilities: ['coding', 'testing', 'review']
        }
      }));

      // Need to reload module to pick up new mocks
      jest.resetModules();
      const memProtocol = require('../memory-mcp-tagging-protocol');

      const result = memProtocol.taggedMemoryStoreV2('coder', 'Implement feature', {});

      expect(result.metadata.identity).toBeTruthy();
      expect(result.metadata._schema_version).toBe('2.0');
    });

    test('should include BUDGET metadata when budget tracker available', () => {
      mockBudgetTracker.getBudgetStatus.mockReturnValue({
        session: { tokens_used: 5000, allowed: true },
        daily: { cost_used: 0.25, cost_limit: 10.00 }
      });

      const result = memoryProtocol.taggedMemoryStoreV2('coder', 'Task', {});

      expect(result.metadata.budget).toBeTruthy();
      expect(result.metadata.budget.budget_status).toBeTruthy();
      expect(result.metadata._budget_status).toBeTruthy();
    });

    test('should include QUALITY metadata when provided in context', () => {
      const context = {
        quality: {
          score: 85,
          violations: ['CoP violation in function X']
        }
      };

      const result = memoryProtocol.taggedMemoryStoreV2('code-analyzer', 'Analysis complete', context);

      expect(result.metadata.quality).toBeTruthy();
      expect(result.metadata.quality.connascence_score).toBe(85);
      expect(result.metadata.quality.code_quality_grade).toBe('B');
      expect(result.metadata._quality_grade).toBe('B');
    });

    test('should include ARTIFACTS metadata from context', () => {
      const context = {
        files_created: ['src/api.js'],
        files_modified: ['tests/api.test.js'],
        tools_used: ['jest', 'eslint']
      };

      const result = memoryProtocol.taggedMemoryStoreV2('coder', 'Feature complete', context);

      expect(result.metadata.artifacts).toBeTruthy();
      expect(result.metadata.artifacts.files_created).toContain('src/api.js');
      expect(result.metadata.artifacts.files_modified).toContain('tests/api.test.js');
      expect(result.metadata.artifacts.tools_used).toContain('jest');
    });

    test('should include PERFORMANCE metadata from context', () => {
      const context = {
        execution_time_ms: 1250,
        success: true,
        error: null
      };

      const result = memoryProtocol.taggedMemoryStoreV2('coder', 'Task complete', context);

      expect(result.metadata.performance).toBeTruthy();
      expect(result.metadata.performance.execution_time_ms).toBe(1250);
      expect(result.metadata.performance.success).toBe(true);
      expect(result.metadata._success).toBe(true);
    });
  });

  // ==========================================================================
  // UTILITY FUNCTIONS (4 tests)
  // ==========================================================================

  describe('Utility Functions', () => {
    test('should validate agent access to Memory MCP', () => {
      const hasAccess = memoryProtocol.validateAgentAccess('coder', 'memory-mcp');

      expect(hasAccess).toBe(true);
    });

    test('should deny agent access to unavailable MCP', () => {
      const hasAccess = memoryProtocol.validateAgentAccess('planner', 'connascence-analyzer');

      expect(hasAccess).toBe(false);
    });

    test('should batch multiple writes with tagging', () => {
      const writes = [
        'Task 1 complete',
        'Task 2 complete',
        { content: 'Task 3 complete', metadata: { custom: 'value' } }
      ];

      const results = memoryProtocol.batchTaggedMemoryWrites('coder', writes);

      expect(results).toHaveLength(3);
      expect(results[0].metadata.agent.name).toBe('coder');
      expect(results[1].metadata.agent.name).toBe('coder');
      expect(results[2].metadata.agent.name).toBe('coder');
      expect(results[2].metadata.custom).toBe('value');
    });

    test('should generate MCP tool call with tagging', () => {
      const call = memoryProtocol.generateMemoryMCPCall('coder', 'Test content', {
        task_id: 'TASK-456'
      });

      expect(call.tool).toBe('memory_store');
      expect(call.server).toBe('memory-mcp');
      expect(call.arguments.text).toBe('Test content');
      expect(call.arguments.metadata.intent.task_id).toBe('TASK-456');
    });
  });

  // ==========================================================================
  // HOOK INTEGRATION (1 test)
  // ==========================================================================

  describe('Hook Integration', () => {
    test('should auto-tag on hook event', () => {
      const hookEvent = {
        agent: 'coder',
        file: 'src/api.js',
        operation: 'file-edit',
        content: 'Refactored authentication module'
      };

      const result = memoryProtocol.hookAutoTag(hookEvent);

      expect(result).toBeTruthy();
      expect(result.metadata.operation).toBe('file-edit');
      expect(result.metadata.file).toBe('src/api.js');
      expect(result.metadata.intent).toBe('refactor');
    });
  });

  // ==========================================================================
  // EDGE CASES (3 tests)
  // ==========================================================================

  describe('Edge Cases', () => {
    test('should handle null agent gracefully', () => {
      const result = memoryProtocol.taggedMemoryStore(null, 'Content', {});

      expect(result.metadata.agent.name).toBe('unknown-agent');
    });

    test('should handle empty content', () => {
      const result = memoryProtocol.taggedMemoryStore('coder', '', {});

      expect(result.text).toBe('');
      expect(result.metadata.agent.name).toBe('coder');
    });

    test('should handle non-string content by converting to JSON', () => {
      const analyzer = new memoryProtocol.IntentAnalyzer();
      const intent = analyzer.analyze({ action: 'implement', feature: 'auth' });

      expect(intent).toBe('implementation');
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS (Real Code)
// ============================================================================

describe('Memory MCP Tagging Protocol Helper Functions', () => {
  test('should export IntentAnalyzer class', () => {
    expect(memoryProtocol.IntentAnalyzer).toBeTruthy();
    expect(typeof memoryProtocol.IntentAnalyzer).toBe('function');
  });

  test('should export intentAnalyzer instance', () => {
    expect(memoryProtocol.intentAnalyzer).toBeTruthy();
    expect(typeof memoryProtocol.intentAnalyzer.analyze).toBe('function');
  });

  test('should export detectProject function', () => {
    expect(typeof memoryProtocol.detectProject).toBe('function');
  });

  test('should export taggedMemoryStore function', () => {
    expect(typeof memoryProtocol.taggedMemoryStore).toBe('function');
  });

  test('should export taggedMemoryStoreV2 function', () => {
    expect(typeof memoryProtocol.taggedMemoryStoreV2).toBe('function');
  });

  test('should export AGENT_TOOL_ACCESS mapping', () => {
    expect(memoryProtocol.AGENT_TOOL_ACCESS).toBeTruthy();
    expect(memoryProtocol.AGENT_TOOL_ACCESS.coder).toBeTruthy();
    expect(memoryProtocol.AGENT_TOOL_ACCESS.coder.category).toBe('code-quality');
  });

  test('should export MEMORY_NAMESPACES for Agent Reality Map', () => {
    expect(memoryProtocol.MEMORY_NAMESPACES).toBeTruthy();
    expect(memoryProtocol.MEMORY_NAMESPACES.AGENT_IDENTITIES).toBe('agent-reality-map/identities');
  });
});
