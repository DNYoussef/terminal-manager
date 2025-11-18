/**
 * Memory MCP Tagging Protocol v2.0 - Agent Reality Map Compliance
 *
 * Automatically injects metadata tags for all Memory MCP write operations.
 * All agents must tag writes with: WHO, WHEN, PROJECT, WHY, IDENTITY, BUDGET, QUALITY, ARTIFACTS, PERFORMANCE
 *
 * NEW in v2.0 (Agent Reality Map Integration):
 * - IDENTITY: Agent UUID, role, capabilities, RBAC level
 * - BUDGET: Token usage, cost tracking, remaining budget, budget status
 * - QUALITY: Connascence scores, code quality grades, violations
 * - ARTIFACTS: Files created/modified, tools used, APIs called
 * - PERFORMANCE: Execution time, success rate, error details
 *
 * CRITICAL RULES:
 * - NO UNICODE - ASCII only (Rule #1 from CRITICAL-RULES.md)
 * - All operations batched (Rule #2)
 * - Work only in designated folders (Rule #3)
 *
 * @version 2.0.0
 * @module memory-mcp-tagging-protocol
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Try to load budget tracker for budget metadata (graceful degradation)
let budgetTracker, budgetTrackerAvailable;
try {
  budgetTracker = require('./utils/budget-tracker.js');
  budgetTrackerAvailable = true;
} catch (err) {
  budgetTrackerAvailable = false;
  console.warn('[Memory MCP Tagging v2.0] Budget tracker not available - budget metadata disabled');
}

// Try to load agent identity registry (graceful degradation)
let agentIdentityRegistry, identityRegistryAvailable;
try {
  // Load agent identities from JSON registry (created by bootstrap-agent-security.js)
  const identityPath = path.join(__dirname, '../../agents/identity/agent-identity-registry.json');
  if (fs.existsSync(identityPath)) {
    agentIdentityRegistry = JSON.parse(fs.readFileSync(identityPath, 'utf-8'));
    identityRegistryAvailable = true;
  } else {
    identityRegistryAvailable = false;
  }
} catch (err) {
  identityRegistryAvailable = false;
  console.warn('[Memory MCP Tagging v2.0] Agent identity registry not available - identity metadata disabled');
}

// Memory MCP namespaces for Agent Reality Map
const MEMORY_NAMESPACES = {
  AGENT_IDENTITIES: 'agent-reality-map/identities',
  AGENT_BUDGETS: 'agent-reality-map/budgets',
  AGENT_PERMISSIONS: 'agent-reality-map/permissions',
  AGENT_AUDIT_TRAILS: 'agent-reality-map/audit-trails',
  AGENT_QUALITY: 'agent-reality-map/quality',
  AGENT_ARTIFACTS: 'agent-reality-map/artifacts'
};

/**
 * Agent Access Control Matrix (from agent-mcp-access-control.js)
 */
const AGENT_TOOL_ACCESS = {
  // Code Quality Agents (14) - Get Connascence + Memory + Coordination
  'coder': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'reviewer': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'tester': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'code-analyzer': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'functionality-audit': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'theater-detection-audit': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'production-validator': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'sparc-coder': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'analyst': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'backend-dev': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'mobile-dev': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'ml-developer': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'base-template-generator': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },
  'code-review-swarm': { mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'], category: 'code-quality' },

  // Planning Agents (23) - Get Memory + Coordination only (NO Connascence)
  'planner': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'researcher': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'system-architect': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'specification': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'pseudocode': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'architecture': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'refinement': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'hierarchical-coordinator': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'mesh-coordinator': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'adaptive-coordinator': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'collective-intelligence-coordinator': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'swarm-memory-manager': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'byzantine-coordinator': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'raft-manager': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'gossip-coordinator': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'consensus-builder': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'crdt-synchronizer': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'quorum-manager': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'security-manager': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'perf-analyzer': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'performance-benchmarker': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'task-orchestrator': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },
  'memory-coordinator': { mcpServers: ['memory-mcp', 'claude-flow'], category: 'planning' },

  // Default fallback
  'default': { mcpServers: ['memory-mcp'], category: 'general' }
};

/**
 * Simple Intent Analyzer
 * Maps common patterns to intent categories
 */
class IntentAnalyzer {
  constructor() {
    this.patterns = {
      implementation: /implement|create|build|add|write/i,
      bugfix: /fix|bug|error|issue|problem/i,
      refactor: /refactor|improve|optimize|clean/i,
      testing: /test|verify|validate|check/i,
      documentation: /document|doc|readme|comment/i,
      analysis: /analyze|review|inspect|examine/i,
      planning: /plan|design|architect|spec/i,
      research: /research|investigate|explore|study/i
    };
  }

  analyze(content) {
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    const matches = [];
    for (const [intent, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(content)) {
        matches.push(intent);
      }
    }

    return matches.length > 0 ? matches[0] : 'general';
  }
}

const intentAnalyzer = new IntentAnalyzer();

/**
 * Detect project from working directory or content
 */
function detectProject(cwd = process.cwd(), content = '') {
  const cwdLower = cwd.toLowerCase();

  if (cwdLower.includes('connascence')) return 'connascence-analyzer';
  if (cwdLower.includes('memory-mcp')) return 'memory-mcp-triple-system';
  if (cwdLower.includes('claude-flow')) return 'claude-flow';

  // Try to detect from content
  if (typeof content === 'string') {
    if (content.toLowerCase().includes('connascence')) return 'connascence-analyzer';
    if (content.toLowerCase().includes('memory')) return 'memory-mcp-triple-system';
  }

  return 'unknown-project';
}

/**
 * Get agent identity metadata from registry
 * @param {string} agent - Agent name
 * @returns {object|null} Identity metadata or null if not found
 */
function getAgentIdentity(agent) {
  if (!identityRegistryAvailable || !agentIdentityRegistry) {
    return null;
  }

  // Look up agent in registry
  const identity = agentIdentityRegistry[agent];
  if (!identity) {
    return null;
  }

  return {
    agent_id: identity.agent_id,
    role: identity.role,
    capabilities: identity.capabilities || [],
    rbac_level: getRBACLevel(identity.role)
  };
}

/**
 * Get RBAC level from role (1-10 scale)
 * @param {string} role - RBAC role
 * @returns {number} RBAC level
 */
function getRBACLevel(role) {
  const levels = {
    'admin': 10,
    'coordinator': 8,
    'developer': 8,
    'backend': 7,
    'security': 7,
    'database': 7,
    'reviewer': 6,
    'frontend': 6,
    'tester': 6,
    'analyst': 5
  };
  return levels[role] || 5;
}

/**
 * Get budget metadata for agent
 * @param {string} agent - Agent name
 * @returns {object|null} Budget metadata or null if not available
 */
function getBudgetMetadata(agent) {
  if (!budgetTrackerAvailable || !budgetTracker) {
    return null;
  }

  try {
    const status = budgetTracker.getBudgetStatus(agent);
    if (!status) {
      return null;
    }

    return {
      tokens_used: status.session.tokens_used,
      cost_usd: status.daily.cost_used,
      remaining_budget: status.daily.cost_limit - status.daily.cost_used,
      budget_status: status.session.allowed ? 'ok' : 'limit'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Calculate quality score from context
 * @param {object} context - User context with quality data
 * @returns {object|null} Quality metadata or null if not available
 */
function getQualityMetadata(context) {
  if (!context.quality) {
    return null;
  }

  // Convert connascence score (0-100) to letter grade
  const getGrade = (score) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  return {
    connascence_score: context.quality.score || 0,
    code_quality_grade: getGrade(context.quality.score || 0),
    violations: context.quality.violations || []
  };
}

/**
 * Get artifact metadata from context
 * @param {object} context - User context with artifact data
 * @returns {object} Artifact metadata
 */
function getArtifactMetadata(context) {
  return {
    files_created: context.files_created || [],
    files_modified: context.files_modified || [],
    tools_used: context.tools_used || [],
    apis_called: context.apis_called || []
  };
}

/**
 * Get performance metadata from context
 * @param {object} context - User context with performance data
 * @returns {object} Performance metadata
 */
function getPerformanceMetadata(context) {
  return {
    execution_time_ms: context.execution_time_ms || 0,
    success: context.success !== undefined ? context.success : true,
    error: context.error || null
  };
}

/**
 * Create enriched metadata for Memory MCP writes (v1.0 - backward compatible)
 *
 * Required fields: who, when, project, why
 */
function createEnrichedMetadata(agent, content, context = {}) {
  const metadata = {
    // WHO: Agent information
    agent: {
      name: agent || 'unknown-agent',
      category: AGENT_TOOL_ACCESS[agent]?.category || 'general',
      capabilities: AGENT_TOOL_ACCESS[agent]?.mcpServers || ['memory-mcp']
    },

    // WHEN: Timestamp information
    timestamp: {
      iso: new Date().toISOString(),
      unix: Math.floor(Date.now() / 1000),
      readable: new Date().toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    },

    // PROJECT: Detected project
    project: context.project || detectProject(process.cwd(), content),

    // WHY: Intent analysis
    intent: {
      primary: context.intent || intentAnalyzer.analyze(content),
      description: context.description || 'Auto-detected from content',
      task_id: context.task_id || null
    },

    // Additional context
    context: {
      session_id: context.session_id || null,
      parent_task: context.parent_task || null,
      swarm_id: context.swarm_id || null,
      working_directory: process.cwd()
    }
  };

  return metadata;
}

/**
 * Create Agent Reality Map compliant metadata (v2.0 - enhanced)
 *
 * Extends v1.0 with: IDENTITY, BUDGET, QUALITY, ARTIFACTS, PERFORMANCE
 */
function createAgentRealityMapMetadata(agent, content, context = {}) {
  // Start with v1.0 metadata for backward compatibility
  const baseMetadata = createEnrichedMetadata(agent, content, context);

  // Add Agent Reality Map extensions
  const identity = getAgentIdentity(agent);
  const budget = getBudgetMetadata(agent);
  const quality = getQualityMetadata(context);
  const artifacts = getArtifactMetadata(context);
  const performance = getPerformanceMetadata(context);

  return {
    ...baseMetadata,

    // IDENTITY: Agent UUID, role, capabilities, RBAC level
    identity: identity || {
      agent_id: null,
      role: 'developer',
      capabilities: [],
      rbac_level: 5
    },

    // BUDGET: Token usage, cost, remaining budget, status
    budget: budget || {
      tokens_used: 0,
      cost_usd: 0,
      remaining_budget: 0,
      budget_status: 'unknown'
    },

    // QUALITY: Connascence scores, code quality grades, violations
    quality: quality || {
      connascence_score: 0,
      code_quality_grade: 'N/A',
      violations: []
    },

    // ARTIFACTS: Files created/modified, tools used, APIs called
    artifacts: artifacts,

    // PERFORMANCE: Execution time, success rate, error details
    performance: performance
  };
}

/**
 * Wrap Memory MCP store operation with automatic tagging (v1.0 - backward compatible)
 */
function taggedMemoryStore(agent, content, userMetadata = {}) {
  const enrichedMetadata = createEnrichedMetadata(agent, content, userMetadata);

  return {
    text: content,
    metadata: {
      ...enrichedMetadata,
      ...userMetadata,  // User metadata can override defaults
      // Ensure core fields always present
      _tagged_at: enrichedMetadata.timestamp.iso,
      _agent: enrichedMetadata.agent.name,
      _project: enrichedMetadata.project,
      _intent: enrichedMetadata.intent.primary
    }
  };
}

/**
 * Wrap Memory MCP store with Agent Reality Map compliance (v2.0 - enhanced)
 *
 * Use this for Agent Reality Map integration with full metadata tracking
 */
function taggedMemoryStoreV2(agent, content, userMetadata = {}) {
  const enrichedMetadata = createAgentRealityMapMetadata(agent, content, userMetadata);

  return {
    text: content,
    metadata: {
      ...enrichedMetadata,
      ...userMetadata,  // User metadata can override defaults

      // Core fields (v1.0 compatibility)
      _tagged_at: enrichedMetadata.timestamp.iso,
      _agent: enrichedMetadata.agent.name,
      _project: enrichedMetadata.project,
      _intent: enrichedMetadata.intent.primary,

      // Agent Reality Map fields (v2.0)
      _agent_id: enrichedMetadata.identity.agent_id,
      _role: enrichedMetadata.identity.role,
      _rbac_level: enrichedMetadata.identity.rbac_level,
      _budget_status: enrichedMetadata.budget.budget_status,
      _quality_grade: enrichedMetadata.quality.code_quality_grade,
      _success: enrichedMetadata.performance.success,

      // Version tag
      _schema_version: '2.0'
    }
  };
}

/**
 * Batch memory writes with tagging
 */
function batchTaggedMemoryWrites(agent, writes) {
  return writes.map(write => {
    const content = typeof write === 'string' ? write : write.content || write.text;
    const metadata = typeof write === 'object' ? write.metadata : {};

    return taggedMemoryStore(agent, content, metadata);
  });
}

/**
 * Generate MCP tool call with tagging
 */
function generateMemoryMCPCall(agent, content, metadata = {}) {
  const tagged = taggedMemoryStore(agent, content, metadata);

  return {
    tool: 'memory_store',
    server: 'memory-mcp',
    arguments: tagged
  };
}

/**
 * Validate agent has access to Memory MCP
 */
function validateAgentAccess(agent, server = 'memory-mcp') {
  const access = AGENT_TOOL_ACCESS[agent] || AGENT_TOOL_ACCESS.default;
  return access.mcpServers.includes(server);
}

/**
 * Hook integration: Auto-tag on post-edit
 */
function hookAutoTag(hookEvent) {
  const { agent, file, operation, content } = hookEvent;

  if (!validateAgentAccess(agent, 'memory-mcp')) {
    return null;
  }

  const metadata = {
    operation: operation || 'file-edit',
    file: file,
    intent: intentAnalyzer.analyze(`${operation} ${file}`)
  };

  return taggedMemoryStore(agent, content, metadata);
}

module.exports = {
  // v1.0 API (backward compatible)
  AGENT_TOOL_ACCESS,
  IntentAnalyzer,
  intentAnalyzer,
  detectProject,
  createEnrichedMetadata,
  taggedMemoryStore,
  batchTaggedMemoryWrites,
  generateMemoryMCPCall,
  validateAgentAccess,
  hookAutoTag,

  // v2.0 API (Agent Reality Map)
  MEMORY_NAMESPACES,
  createAgentRealityMapMetadata,
  taggedMemoryStoreV2,
  getAgentIdentity,
  getBudgetMetadata,
  getQualityMetadata,
  getArtifactMetadata,
  getPerformanceMetadata,
  getRBACLevel,

  // Utilities
  budgetTrackerAvailable,
  identityRegistryAvailable
};
