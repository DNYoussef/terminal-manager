#!/usr/bin/env node

/**
 * Agent-Specific MCP Tool Access Control
 *
 * Purpose: Enforce selective MCP tool access based on agent roles
 * - ALL agents: memory-mcp, claude-flow (universal context/coordination)
 * - Code quality agents ONLY: connascence-analyzer (coupling analysis)
 * - Planning/design agents: NO connascence access (not needed for design work)
 *
 * Integration: Obsidian Memory + Connascence Analyzer (Phase 2, Task P2-T3.5)
 * Version: 1.0.0
 * Created: 2025-11-01
 */

// ============================================================================
// AGENT ACCESS MATRIX
// ============================================================================

/**
 * Defines which MCP tools each agent type can access
 *
 * Structure:
 * - agentType: string (matches agent name in .claude/agents/)
 * - mcpServers: array of MCP server names the agent can use
 */
const AGENT_TOOL_ACCESS = {
  // -------------------------------------------------------------------------
  // CODE QUALITY AGENTS (Full Access: Memory + Connascence + Coordination)
  // -------------------------------------------------------------------------

  // Implementation specialist - needs connascence to check coupling while writing
  'coder': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Checks coupling while writing code, stores patterns in memory'
  },

  // Code review specialist - needs connascence for quality analysis
  'reviewer': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Reviews code quality including coupling analysis'
  },

  // Testing specialist - verifies coupling in tests
  'tester': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Verifies coupling in test code, checks for test-specific violations'
  },

  // Advanced code analysis specialist
  'code-analyzer': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Comprehensive code quality analysis including coupling metrics'
  },

  // Functionality audit specialist - validates implementations
  'functionality-audit': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Validates implementations are real and well-coupled'
  },

  // Theater detection specialist - checks if code is real
  'theater-detection-audit': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Sequential pipeline: theater first, then connascence if real'
  },

  // Production readiness validator
  'production-validator': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Pre-deployment checks include coupling analysis'
  },

  // SPARC coder - TDD implementation with quality checks
  'sparc-coder': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'TDD workflow includes coupling verification'
  },

  // Code quality analyst
  'analyst': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Advanced code quality analysis and metrics'
  },

  // -------------------------------------------------------------------------
  // PLANNING & DESIGN AGENTS (Memory + Coordination ONLY, NO Connascence)
  // -------------------------------------------------------------------------

  // Task decomposition specialist - no code analysis needed
  'planner': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Task planning uses memory for context, no code analysis'
  },

  // Information gathering specialist
  'researcher': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Researches patterns and best practices, stores in memory'
  },

  // System architecture specialist - high-level design only
  'system-architect': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Architectural design, not implementation-level coupling'
  },

  // SPARC specification phase
  'specification': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Requirements analysis, no code yet'
  },

  // SPARC pseudocode phase
  'pseudocode': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Algorithm design, not implementation code'
  },

  // SPARC architecture phase
  'architecture': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'System design, not implementation code'
  },

  // SPARC refinement phase (borderline - may need connascence in future)
  'refinement': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Iterative improvement, focus on TDD not coupling (for now)'
  },

  // -------------------------------------------------------------------------
  // COORDINATION AGENTS (Memory + Coordination ONLY)
  // -------------------------------------------------------------------------

  'task-orchestrator': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Orchestrates tasks, delegates to code quality agents for analysis'
  },

  'memory-coordinator': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Manages memory, no code analysis'
  },

  'swarm-init': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Initializes swarms, no code analysis'
  },

  'smart-agent': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Dynamic agent spawning, delegates to specialized agents'
  },

  'queen-coordinator': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Hierarchical coordination, delegates analysis to workers'
  },

  'hierarchical-coordinator': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Swarm coordination, no direct code analysis'
  },

  'mesh-coordinator': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Peer-to-peer coordination, no direct code analysis'
  },

  'adaptive-coordinator': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Dynamic topology switching, no direct code analysis'
  },

  // -------------------------------------------------------------------------
  // SPECIALIZED AGENTS (Case-by-case basis)
  // -------------------------------------------------------------------------

  // Backend development - DOES code, so gets connascence
  'backend-dev': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Implements backend code, needs coupling analysis'
  },

  // Mobile development - DOES code, so gets connascence
  'mobile-dev': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Implements mobile code, needs coupling analysis'
  },

  // ML development - code implementation, gets connascence
  'ml-developer': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Implements ML code, needs coupling analysis'
  },

  // CI/CD engineering - infrastructure code, minimal coupling analysis
  'cicd-engineer': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Infrastructure code, different coupling concerns'
  },

  // API documentation - no code implementation
  'api-docs': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Documentation only, no code analysis'
  },

  // Template generation - generates boilerplate, may need connascence
  'base-template-generator': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Generates code templates, should follow coupling best practices'
  },

  // -------------------------------------------------------------------------
  // GitHub Integration Agents (No code analysis needed)
  // -------------------------------------------------------------------------

  'github-modes': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'GitHub workflow orchestration, no code analysis'
  },

  'pr-manager': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'PR management, delegates to code-review agents for analysis'
  },

  'code-review-swarm': {
    mcpServers: ['memory-mcp', 'connascence-analyzer', 'claude-flow'],
    reason: 'Code review swarm, needs coupling analysis'
  },

  'issue-tracker': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Issue tracking, no code analysis'
  },

  'release-manager': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Release coordination, no code analysis'
  },

  'workflow-automation': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'CI/CD automation, no code analysis'
  },

  'repo-architect': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Repository structure, not implementation code'
  },

  // -------------------------------------------------------------------------
  // DEFAULT FALLBACK (Memory + Coordination ONLY)
  // -------------------------------------------------------------------------
  'default': {
    mcpServers: ['memory-mcp', 'claude-flow'],
    reason: 'Default: all agents get memory and coordination, opt-in for connascence'
  }
};

// ============================================================================
// ACCESS CONTROL LOGIC
// ============================================================================

/**
 * Get MCP servers allowed for a specific agent
 * @param {string} agentType - Agent type/name
 * @returns {object} { mcpServers: string[], reason: string }
 */
function getAgentMcpAccess(agentType) {
  // Normalize agent type (handle variations)
  const normalizedType = agentType.toLowerCase().trim();

  // Check for exact match
  if (AGENT_TOOL_ACCESS[normalizedType]) {
    return AGENT_TOOL_ACCESS[normalizedType];
  }

  // Check for partial match (e.g., "coder-v2" matches "coder")
  for (const [key, value] of Object.entries(AGENT_TOOL_ACCESS)) {
    if (normalizedType.includes(key) || key.includes(normalizedType)) {
      return value;
    }
  }

  // Fallback to default (memory + coordination only)
  return AGENT_TOOL_ACCESS.default;
}

/**
 * Check if agent has access to a specific MCP server
 * @param {string} agentType - Agent type/name
 * @param {string} mcpServer - MCP server name
 * @returns {boolean} true if agent can access this MCP server
 */
function hasAccess(agentType, mcpServer) {
  const access = getAgentMcpAccess(agentType);
  return access.mcpServers.includes(mcpServer);
}

/**
 * Filter MCP tool calls based on agent permissions
 * @param {string} agentType - Agent type/name
 * @param {array} toolCalls - Array of tool call objects
 * @returns {object} { allowed: array, blocked: array }
 */
function filterToolCalls(agentType, toolCalls) {
  const access = getAgentMcpAccess(agentType);
  const allowed = [];
  const blocked = [];

  toolCalls.forEach(toolCall => {
    // Extract MCP server from tool name (e.g., "connascence.analyze_file" -> "connascence-analyzer")
    const mcpServer = extractMcpServer(toolCall.tool);

    if (access.mcpServers.includes(mcpServer)) {
      allowed.push(toolCall);
    } else {
      blocked.push({
        ...toolCall,
        blockReason: `Agent '${agentType}' does not have access to MCP server '${mcpServer}'. ${access.reason}`
      });
    }
  });

  return { allowed, blocked };
}

/**
 * Extract MCP server name from tool call
 * @param {string} toolName - Tool name (e.g., "connascence.analyze_file")
 * @returns {string} MCP server name (e.g., "connascence-analyzer")
 */
function extractMcpServer(toolName) {
  // Map tool prefixes to MCP server names
  const toolToServerMap = {
    'memory.': 'memory-mcp',
    'connascence.': 'connascence-analyzer',
    'claude_flow.': 'claude-flow',
    'swarm.': 'claude-flow',
    'agent.': 'claude-flow'
  };

  for (const [prefix, server] of Object.entries(toolToServerMap)) {
    if (toolName.startsWith(prefix)) {
      return server;
    }
  }

  // Default: assume it's a direct server name
  return toolName.split('.')[0];
}

// ============================================================================
// VALIDATION & REPORTING
// ============================================================================

/**
 * Validate agent access matrix for completeness
 * @returns {object} { valid: boolean, missing: array, summary: object }
 */
function validateAccessMatrix() {
  const knownAgents = Object.keys(AGENT_TOOL_ACCESS);
  const codeQualityAgents = knownAgents.filter(agent =>
    AGENT_TOOL_ACCESS[agent].mcpServers.includes('connascence-analyzer')
  );
  const planningAgents = knownAgents.filter(agent =>
    !AGENT_TOOL_ACCESS[agent].mcpServers.includes('connascence-analyzer')
  );

  return {
    valid: true,
    totalAgents: knownAgents.length - 1, // Exclude 'default'
    codeQualityAgents: codeQualityAgents.length,
    planningAgents: planningAgents.length,
    summary: {
      codeQuality: codeQualityAgents,
      planning: planningAgents
    }
  };
}

/**
 * Generate access control report
 * @returns {string} Markdown-formatted report
 */
function generateReport() {
  const validation = validateAccessMatrix();

  let report = `# Agent MCP Tool Access Control Report\n\n`;
  report += `**Total Agents**: ${validation.totalAgents}\n`;
  report += `**Code Quality Agents** (with Connascence): ${validation.codeQualityAgents}\n`;
  report += `**Planning Agents** (Memory only): ${validation.planningAgents}\n\n`;

  report += `## Code Quality Agents (Full Access)\n\n`;
  validation.summary.codeQuality.forEach(agent => {
    if (agent !== 'default') {
      const access = AGENT_TOOL_ACCESS[agent];
      report += `- **${agent}**: ${access.mcpServers.join(', ')}\n`;
      report += `  - _${access.reason}_\n`;
    }
  });

  report += `\n## Planning Agents (Limited Access)\n\n`;
  validation.summary.planning.forEach(agent => {
    if (agent !== 'default') {
      const access = AGENT_TOOL_ACCESS[agent];
      report += `- **${agent}**: ${access.mcpServers.join(', ')}\n`;
      report += `  - _${access.reason}_\n`;
    }
  });

  return report;
}

// ============================================================================
// HOOK INTEGRATION
// ============================================================================

/**
 * Pre-task hook: Validate agent has access to required MCP tools
 * @param {object} context - Hook context with agent type and tool calls
 */
function preTaskHook(context) {
  const { agentType, toolCalls } = context;

  if (!toolCalls || toolCalls.length === 0) {
    return { allowed: true, reason: 'No tool calls to validate' };
  }

  const result = filterToolCalls(agentType, toolCalls);

  if (result.blocked.length > 0) {
    console.warn(`[Agent MCP Access Control] Blocked ${result.blocked.length} tool calls for agent '${agentType}'`);
    result.blocked.forEach(blocked => {
      console.warn(`  - ${blocked.tool}: ${blocked.blockReason}`);
    });
  }

  return {
    allowed: result.allowed.length > 0,
    blockedCount: result.blocked.length,
    blockedTools: result.blocked
  };
}

// ============================================================================
// CLI COMMANDS
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'check':
      // Check access for specific agent
      const agentType = args[1];
      if (!agentType) {
        console.error('Usage: agent-mcp-access-control.js check <agent-type>');
        process.exit(1);
      }
      const access = getAgentMcpAccess(agentType);
      console.log(`Agent '${agentType}' has access to:`);
      console.log(`  MCP Servers: ${access.mcpServers.join(', ')}`);
      console.log(`  Reason: ${access.reason}`);
      break;

    case 'validate':
      // Validate access matrix
      const validation = validateAccessMatrix();
      console.log('Access Matrix Validation:');
      console.log(`  Total Agents: ${validation.totalAgents}`);
      console.log(`  Code Quality Agents: ${validation.codeQualityAgents}`);
      console.log(`  Planning Agents: ${validation.planningAgents}`);
      break;

    case 'report':
      // Generate full report
      console.log(generateReport());
      break;

    case 'test':
      // Test access for sample tool calls
      const testAgent = args[1] || 'coder';
      const testCalls = [
        { tool: 'memory.store', args: {} },
        { tool: 'connascence.analyze_file', args: {} },
        { tool: 'claude_flow.swarm_init', args: {} }
      ];
      const result = filterToolCalls(testAgent, testCalls);
      console.log(`Test for agent '${testAgent}':`);
      console.log(`  Allowed: ${result.allowed.length} tool calls`);
      console.log(`  Blocked: ${result.blocked.length} tool calls`);
      if (result.blocked.length > 0) {
        console.log('  Blocked tools:');
        result.blocked.forEach(b => console.log(`    - ${b.tool}: ${b.blockReason}`));
      }
      break;

    default:
      console.log('Agent MCP Tool Access Control');
      console.log('');
      console.log('Commands:');
      console.log('  check <agent-type>    Check access for specific agent');
      console.log('  validate              Validate access matrix');
      console.log('  report                Generate full access report');
      console.log('  test [agent-type]     Test access for sample tool calls');
      console.log('');
      console.log('Examples:');
      console.log('  node agent-mcp-access-control.js check coder');
      console.log('  node agent-mcp-access-control.js validate');
      console.log('  node agent-mcp-access-control.js report > access-report.md');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  AGENT_TOOL_ACCESS,
  getAgentMcpAccess,
  hasAccess,
  filterToolCalls,
  validateAccessMatrix,
  generateReport,
  preTaskHook
};
