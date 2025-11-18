/**
 * Verification Script: Connascence Quality Pipeline
 *
 * Verifies all components of the quality pipeline are correctly installed and configured.
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function checkmark() { return `${GREEN}✓${RESET}`; }
function cross() { return `${RED}✗${RESET}`; }
function warn() { return `${YELLOW}!${RESET}`; }

console.log('\n=== Connascence Quality Pipeline Verification ===\n');

let passed = 0;
let failed = 0;
let warnings = 0;

// 1. Check core files exist
console.log('1. Checking core files...');

const coreFiles = [
  'hooks/12fa/connascence-pipeline.js',
  'hooks/12fa/connascence-pipeline-cli.js',
  'hooks/12fa/tests/test-connascence-pipeline.js',
  'hooks/12fa/CONNASCENCE-PIPELINE-README.md',
  'backend/app/services/quality_score_service.py'
];

coreFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`   ${checkmark()} ${file}`);
    passed++;
  } else {
    console.log(`   ${cross()} ${file} - MISSING`);
    failed++;
  }
});

// 2. Check hook configuration
console.log('\n2. Checking hook configuration...');

const hooksPath = path.join(process.cwd(), 'hooks/hooks.json');
if (fs.existsSync(hooksPath)) {
  const hooksConfig = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

  // Check for pre-file-write-quality hook
  const preToolHooks = hooksConfig.hooks.PreToolUse || [];
  const qualityHook = preToolHooks.find(h => h.name === 'pre-file-write-quality');

  if (qualityHook) {
    console.log(`   ${checkmark()} pre-file-write-quality hook found`);

    if (qualityHook.enabled) {
      console.log(`   ${checkmark()} Hook is enabled`);
      passed++;
    } else {
      console.log(`   ${warn()} Hook is disabled`);
      warnings++;
    }

    if (qualityHook.continueOnError === false) {
      console.log(`   ${checkmark()} Hook blocks on error (quality gate enforced)`);
      passed++;
    } else {
      console.log(`   ${warn()} Hook continues on error (quality gate not enforced)`);
      warnings++;
    }
  } else {
    console.log(`   ${cross()} pre-file-write-quality hook not found`);
    failed++;
  }

  // Check for quality category
  const categories = hooksConfig.hookCategories || {};
  if (categories.quality) {
    console.log(`   ${checkmark()} 'quality' hook category exists`);
    passed++;
  } else {
    console.log(`   ${warn()} 'quality' hook category missing`);
    warnings++;
  }
} else {
  console.log(`   ${cross()} hooks/hooks.json not found`);
  failed++;
}

// 3. Check module dependencies
console.log('\n3. Checking module dependencies...');

try {
  const { QualityPipeline, CONFIG } = require('./connascence-pipeline.js');
  console.log(`   ${checkmark()} connascence-pipeline.js loads correctly`);

  // Check CONFIG structure
  if (CONFIG.globalThreshold) {
    console.log(`   ${checkmark()} CONFIG.globalThreshold = ${CONFIG.globalThreshold}`);
    passed++;
  }

  if (CONFIG.agentThresholds) {
    console.log(`   ${checkmark()} CONFIG.agentThresholds (${Object.keys(CONFIG.agentThresholds).length} agents)`);
    passed++;
  }

  if (CONFIG.fileThresholds) {
    console.log(`   ${checkmark()} CONFIG.fileThresholds (${Object.keys(CONFIG.fileThresholds).length} patterns)`);
    passed++;
  }

  // Check QualityPipeline class
  const pipeline = new QualityPipeline();
  console.log(`   ${checkmark()} QualityPipeline instantiates correctly`);
  passed++;

} catch (error) {
  console.log(`   ${cross()} Failed to load module: ${error.message}`);
  failed++;
}

// 4. Check Memory MCP integration
console.log('\n4. Checking Memory MCP integration...');

try {
  const { taggedMemoryStore } = require('./memory-mcp-tagging-protocol.js');
  console.log(`   ${checkmark()} memory-mcp-tagging-protocol.js loads correctly`);

  // Test tagging
  const tagged = taggedMemoryStore('coder', 'Test content', {
    intent: 'quality-gate',
    quality_score: 75
  });

  if (tagged.metadata.quality_score === 75) {
    console.log(`   ${checkmark()} Memory MCP tagging works correctly`);
    passed++;
  }
} catch (error) {
  console.log(`   ${cross()} Memory MCP integration failed: ${error.message}`);
  failed++;
}

// 5. Check agent access control
console.log('\n5. Checking agent access control...');

try {
  const { AGENT_TOOL_ACCESS } = require('./memory-mcp-tagging-protocol.js');

  // Count code quality agents
  const codeQualityAgents = Object.entries(AGENT_TOOL_ACCESS)
    .filter(([agent, config]) => config.category === 'code-quality')
    .length;

  console.log(`   ${checkmark()} Code quality agents: ${codeQualityAgents}`);

  if (codeQualityAgents === 14) {
    console.log(`   ${checkmark()} Expected 14 code quality agents`);
    passed++;
  } else {
    console.log(`   ${warn()} Expected 14, found ${codeQualityAgents}`);
    warnings++;
  }

  // Check coder has Connascence access
  const coderAccess = AGENT_TOOL_ACCESS.coder;
  if (coderAccess && coderAccess.mcpServers.includes('connascence-analyzer')) {
    console.log(`   ${checkmark()} 'coder' agent has Connascence access`);
    passed++;
  } else {
    console.log(`   ${cross()} 'coder' agent missing Connascence access`);
    failed++;
  }
} catch (error) {
  console.log(`   ${cross()} Agent access control check failed: ${error.message}`);
  failed++;
}

// 6. Run test suite
console.log('\n6. Running test suite...');

try {
  const { runTests } = require('./tests/test-connascence-pipeline.js');

  console.log('   Running tests (this may take a moment)...');

  runTests().then(() => {
    console.log(`   ${checkmark()} All tests passed`);
    passed++;

    printSummary();
  }).catch(error => {
    console.log(`   ${cross()} Test suite failed: ${error.message}`);
    failed++;

    printSummary();
  });
} catch (error) {
  console.log(`   ${cross()} Could not run test suite: ${error.message}`);
  failed++;

  printSummary();
}

function printSummary() {
  console.log('\n=== Verification Summary ===\n');

  console.log(`${GREEN}Passed:${RESET} ${passed}`);
  console.log(`${YELLOW}Warnings:${RESET} ${warnings}`);
  console.log(`${RED}Failed:${RESET} ${failed}`);

  if (failed === 0 && warnings === 0) {
    console.log(`\n${GREEN}All checks passed! Quality pipeline is ready.${RESET}\n`);
  } else if (failed === 0) {
    console.log(`\n${YELLOW}Verification passed with warnings. Review warnings above.${RESET}\n`);
  } else {
    console.log(`\n${RED}Verification failed. Fix errors above before using.${RESET}\n`);
    process.exit(1);
  }
}
