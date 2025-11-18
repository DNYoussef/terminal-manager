/**
 * Pre-Task Hook: Validate Agent Selection Against Registry
 *
 * This hook runs before every Task invocation to ensure:
 * 1. The agent exists in the 203-agent registry
 * 2. The agent is a specialized agent, not a generic one
 * 3. The agent capabilities match the task requirements
 *
 * If validation fails, the hook logs a warning and suggests alternatives.
 *
 * Integration:
 *   Add to hooks.json:
 *   {
 *     "pre-task": "node hooks/validate-agent-selection.js"
 *   }
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const AGENTS_BASE_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME,
  'claude-code-plugins',
  'ruv-sparc-three-loop-system',
  'agents'
);

// Generic agents that should have specialized alternatives
const GENERIC_AGENTS = [
  'coder',
  'tester',
  'reviewer',
  'researcher',
  'analyst',
  'coordinator',
  'optimizer',
  'specialist'
];

// Category mappings for suggestions
const CATEGORY_SUGGESTIONS = {
  backend: 'delivery/development/backend',
  frontend: 'delivery/development/frontend',
  database: 'platforms/data/database',
  testing: 'quality/testing',
  devops: 'operations/devops',
  security: 'security',
  documentation: 'tooling/documentation',
  ml: 'platforms/ai-ml',
  research: 'research'
};

/**
 * Parse agent name from environment or arguments
 */
function getAgentName() {
  // Check environment variable (set by Task tool)
  if (process.env.TASK_AGENT) {
    return process.env.TASK_AGENT;
  }

  // Check command line arguments
  const args = process.argv.slice(2);
  if (args.length > 0 && args[0].startsWith('--agent=')) {
    return args[0].split('=')[1];
  }

  return null;
}

/**
 * Check if agent exists in registry
 */
function agentExistsInRegistry(agentName) {
  const pattern = path.join(AGENTS_BASE_PATH, '**', `*${agentName}*.md`);
  const matches = glob.sync(pattern);

  return matches.filter(m => !m.endsWith('README.md'));
}

/**
 * Check if agent is generic (should use specialized alternative)
 */
function isGenericAgent(agentName) {
  return GENERIC_AGENTS.includes(agentName.toLowerCase());
}

/**
 * Get category from task description (if available)
 */
function inferCategory(taskDescription) {
  if (!taskDescription) return null;

  const lower = taskDescription.toLowerCase();

  if (lower.includes('api') || lower.includes('backend') || lower.includes('express')) {
    return 'backend';
  }
  if (lower.includes('react') || lower.includes('frontend') || lower.includes('ui')) {
    return 'frontend';
  }
  if (lower.includes('database') || lower.includes('sql') || lower.includes('schema')) {
    return 'database';
  }
  if (lower.includes('test') || lower.includes('testing')) {
    return 'testing';
  }
  if (lower.includes('deploy') || lower.includes('docker') || lower.includes('kubernetes')) {
    return 'devops';
  }
  if (lower.includes('security') || lower.includes('auth') || lower.includes('vulnerability')) {
    return 'security';
  }
  if (lower.includes('documentation') || lower.includes('docs')) {
    return 'documentation';
  }
  if (lower.includes('ml') || lower.includes('machine learning') || lower.includes('neural')) {
    return 'ml';
  }
  if (lower.includes('research') || lower.includes('analysis')) {
    return 'research';
  }

  return null;
}

/**
 * Find specialized alternatives for generic agent
 */
function findSpecializedAlternatives(agentName, taskDescription) {
  const category = inferCategory(taskDescription);
  const alternatives = [];

  if (category && CATEGORY_SUGGESTIONS[category]) {
    const categoryPath = path.join(AGENTS_BASE_PATH, CATEGORY_SUGGESTIONS[category]);

    if (fs.existsSync(categoryPath)) {
      const pattern = path.join(categoryPath, '**', '*.md');
      const matches = glob.sync(pattern).filter(m => !m.endsWith('README.md'));

      for (const match of matches.slice(0, 3)) {
        const name = path.basename(match, '.md');
        const relativePath = path.relative(AGENTS_BASE_PATH, match).replace(/\\/g, '/');
        alternatives.push({
          name,
          path: relativePath
        });
      }
    }
  }

  return alternatives;
}

/**
 * Main validation logic
 */
function validateAgentSelection() {
  console.log('=== Agent Selection Validation Hook ===\n');

  const agentName = getAgentName();
  const taskDescription = process.env.TASK_DESCRIPTION || '';

  if (!agentName) {
    console.log('No agent specified in this invocation. Skipping validation.\n');
    return { valid: true };
  }

  console.log(`Agent Name: ${agentName}`);
  console.log(`Task: ${taskDescription || 'No description provided'}\n`);

  // Check 1: Agent exists in registry
  const matches = agentExistsInRegistry(agentName);

  if (matches.length === 0) {
    console.warn(`WARNING: Agent "${agentName}" not found in registry!`);
    console.warn(`Registry path: ${AGENTS_BASE_PATH}\n`);

    // Check if it's a generic agent
    if (isGenericAgent(agentName)) {
      console.warn(`"${agentName}" is a GENERIC agent. Consider using a specialized alternative:`);

      const alternatives = findSpecializedAlternatives(agentName, taskDescription);

      if (alternatives.length > 0) {
        console.warn('\nSuggested specialized agents:');
        alternatives.forEach((alt, i) => {
          console.warn(`  ${i + 1}. ${alt.name} (${alt.path})`);
        });
      } else {
        console.warn('No specialized alternatives found for this task.');
        console.warn('Consider browsing the registry manually:');
        console.warn(`  Read("${AGENTS_BASE_PATH}/README.md")`);
      }

      console.warn('\nTip: Use Skill("agent-selector") to find the best specialized agent.\n');
    } else {
      console.warn(`Agent may be misspelled or not yet in registry.`);
      console.warn(`Search registry: Glob("${AGENTS_BASE_PATH}/**/*${agentName}*.md")\n`);
    }

    return { valid: false, warning: 'Agent not found in registry' };
  }

  // Check 2: Multiple matches (ambiguous)
  if (matches.length > 1) {
    console.log(`Found ${matches.length} potential matches:`);
    matches.forEach((match, i) => {
      const relativePath = path.relative(AGENTS_BASE_PATH, match).replace(/\\/g, '/');
      console.log(`  ${i + 1}. ${relativePath}`);
    });
    console.log('\nUsing first match. Consider being more specific.\n');
  }

  // Success
  const selectedAgent = matches[0];
  const relativePath = path.relative(AGENTS_BASE_PATH, selectedAgent).replace(/\\/g, '/');

  console.log(`VALIDATED: Agent found in registry`);
  console.log(`Path: ${relativePath}`);

  // Check if generic even though it exists
  if (isGenericAgent(agentName)) {
    console.warn(`\nNOTE: "${agentName}" exists but is a GENERIC agent.`);
    console.warn(`Consider using a more specialized agent for better results.`);

    const alternatives = findSpecializedAlternatives(agentName, taskDescription);
    if (alternatives.length > 0) {
      console.warn('Suggested specialized alternatives:');
      alternatives.forEach((alt, i) => {
        console.warn(`  ${i + 1}. ${alt.name} (${alt.path})`);
      });
    }
  }

  console.log('\n=== Validation Complete ===\n');

  return {
    valid: true,
    agent: agentName,
    path: relativePath,
    isGeneric: isGenericAgent(agentName)
  };
}

// Run validation
if (require.main === module) {
  try {
    const result = validateAgentSelection();
    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.error('Hook error:', error.message);
    process.exit(1);
  }
}

module.exports = { validateAgentSelection, isGenericAgent, findSpecializedAlternatives };
