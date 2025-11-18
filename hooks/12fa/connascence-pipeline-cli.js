#!/usr/bin/env node
/**
 * Connascence Pipeline CLI
 *
 * Command-line interface for quality gate operations.
 *
 * USAGE:
 *   node connascence-pipeline-cli.js check <file> --agent <agent> [options]
 *   node connascence-pipeline-cli.js batch <pattern> --agent <agent> [options]
 *   node connascence-pipeline-cli.js config [options]
 *
 * EXAMPLES:
 *   Check single file:
 *     node connascence-pipeline-cli.js check src/app.js --agent coder
 *
 *   Check with custom threshold:
 *     node connascence-pipeline-cli.js check src/auth.js --agent backend-dev --threshold 85
 *
 *   Batch check files (use quotes):
 *     node connascence-pipeline-cli.js batch src --agent reviewer
 *
 *   Human override:
 *     node connascence-pipeline-cli.js check src/legacy.js --agent coder --override
 *
 *   Show configuration:
 *     node connascence-pipeline-cli.js config
 */

const fs = require('fs');
const path = require('path');
const { QualityPipeline, CONFIG } = require('./connascence-pipeline.js');

// Simple glob implementation (avoid external dependency)
function simpleGlob(pattern) {
  const baseDir = pattern.split('*')[0].replace(/\/$/, '') || '.';
  const files = [];

  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  if (fs.existsSync(baseDir)) {
    walk(baseDir);
  }

  // Simple pattern matching
  const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
  return files.filter(f => regex.test(f));
}

/**
 * Parse command-line arguments
 */
function parseArgs(args) {
  const parsed = {
    command: args[2] || 'help',
    file: null,
    pattern: null,
    agent: null,
    threshold: null,
    override: false,
    verbose: false,
    json: false
  };

  for (let i = 3; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--agent':
        parsed.agent = next;
        i++;
        break;
      case '--threshold':
        parsed.threshold = parseInt(next, 10);
        i++;
        break;
      case '--override':
        parsed.override = true;
        break;
      case '--verbose':
        parsed.verbose = true;
        break;
      case '--json':
        parsed.json = true;
        break;
      default:
        if (!arg.startsWith('--')) {
          if (parsed.command === 'check' && !parsed.file) {
            parsed.file = arg;
          } else if (parsed.command === 'batch' && !parsed.pattern) {
            parsed.pattern = arg;
          }
        }
    }
  }

  return parsed;
}

/**
 * Check single file
 */
async function checkFile(args) {
  if (!args.file) {
    console.error('Error: File path required');
    console.error('Usage: node connascence-pipeline-cli.js check <file> --agent <agent>');
    process.exit(1);
  }

  if (!args.agent) {
    console.error('Error: Agent required');
    console.error('Usage: node connascence-pipeline-cli.js check <file> --agent <agent>');
    process.exit(1);
  }

  if (!fs.existsSync(args.file)) {
    console.error(`Error: File not found: ${args.file}`);
    process.exit(1);
  }

  const pipeline = new QualityPipeline();

  try {
    const report = await pipeline.checkQuality(args.agent, args.file, {
      threshold: args.threshold,
      humanOverride: args.override
    });

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('\n=== Quality Gate Report ===');
      console.log(`File: ${report.file}`);
      console.log(`Score: ${report.score}/100`);
      console.log(`Grade: ${report.grade}`);
      console.log(`Threshold: ${report.threshold}`);
      console.log(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);

      if (report.overridden) {
        console.log('(Human override applied)');
      }

      console.log('\nViolations:');
      for (const [type, count] of Object.entries(report.violations)) {
        if (count > 0) {
          console.log(`  ${type}: ${count}`);
        }
      }
    }

    process.exit(report.passed ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Batch check files
 */
async function batchCheck(args) {
  if (!args.pattern) {
    console.error('Error: File pattern required');
    console.error('Usage: node connascence-pipeline-cli.js batch <pattern> --agent <agent>');
    process.exit(1);
  }

  if (!args.agent) {
    console.error('Error: Agent required');
    console.error('Usage: node connascence-pipeline-cli.js batch <pattern> --agent <agent>');
    process.exit(1);
  }

  // Find files matching pattern
  const files = simpleGlob(args.pattern);

  if (files.length === 0) {
    console.error(`Error: No files found matching pattern: ${args.pattern}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} files matching pattern\n`);

  const pipeline = new QualityPipeline();

  try {
    const results = await pipeline.checkMultipleFiles(args.agent, files, {
      threshold: args.threshold,
      humanOverride: args.override
    });

    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log('\n=== Batch Quality Gate Report ===');

      results.forEach((result, index) => {
        const status = result.passed ? '[PASS]' : '[FAIL]';
        const score = result.result ? result.result.score : 'N/A';
        const grade = result.result ? result.result.grade : 'N/A';

        console.log(`${index + 1}. ${status} ${result.filePath}`);
        console.log(`   Score: ${score}/100 (${grade})`);

        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      });

      const passedCount = results.filter(r => r.passed).length;
      const failedCount = results.length - passedCount;
      const avgScore = results
        .filter(r => r.result)
        .reduce((sum, r) => sum + r.result.score, 0) / results.length;

      console.log(`\nSummary:`);
      console.log(`  Total: ${results.length}`);
      console.log(`  Passed: ${passedCount}`);
      console.log(`  Failed: ${failedCount}`);
      console.log(`  Average Score: ${avgScore.toFixed(2)}`);
    }

    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Show configuration
 */
function showConfig() {
  console.log('=== Connascence Pipeline Configuration ===\n');

  console.log('Global Threshold:', CONFIG.globalThreshold);

  console.log('\nAgent Thresholds:');
  for (const [agent, threshold] of Object.entries(CONFIG.agentThresholds)) {
    console.log(`  ${agent}: ${threshold}`);
  }

  console.log('\nFile Thresholds:');
  for (const [pattern, threshold] of Object.entries(CONFIG.fileThresholds)) {
    console.log(`  ${pattern}: ${threshold}`);
  }

  console.log('\nViolation Penalties:');
  for (const [type, penalty] of Object.entries(CONFIG.penalties)) {
    console.log(`  ${type}: ${penalty}`);
  }

  console.log('\nViolation Thresholds:');
  for (const [type, threshold] of Object.entries(CONFIG.violationThresholds)) {
    console.log(`  ${type}: ${threshold}`);
  }

  console.log('\nFeatures:');
  for (const [feature, enabled] of Object.entries(CONFIG.features)) {
    console.log(`  ${feature}: ${enabled}`);
  }

  console.log('\nBackend API:', CONFIG.backendAPI);
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
Connascence Pipeline CLI

USAGE:
  node connascence-pipeline-cli.js <command> [options]

COMMANDS:
  check <file>      Check quality of a single file
  batch <pattern>   Check quality of multiple files
  config            Show current configuration
  help              Show this help message

OPTIONS:
  --agent <name>       Agent name (required for check/batch)
  --threshold <num>    Custom quality threshold (0-100)
  --override           Allow human override
  --verbose            Verbose output
  --json               Output as JSON

EXAMPLES:
  # Check single file
  node connascence-pipeline-cli.js check src/app.js --agent coder

  # Check with custom threshold
  node connascence-pipeline-cli.js check src/auth.js --agent backend-dev --threshold 85

  # Batch check files
  node connascence-pipeline-cli.js batch "src/**/*.js" --agent reviewer

  # Human override
  node connascence-pipeline-cli.js check src/legacy.js --agent coder --override

  # JSON output
  node connascence-pipeline-cli.js check src/app.js --agent coder --json

QUALITY GRADES:
  A: 90-100 (excellent)
  B: 80-89  (good)
  C: 70-79  (acceptable - default gate)
  D: 60-69  (poor - warning)
  F: 0-59   (failing - block)

For more information, see hooks/12fa/CONNASCENCE-PIPELINE-README.md
`);
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(process.argv);

  switch (args.command) {
    case 'check':
      await checkFile(args);
      break;
    case 'batch':
      await batchCheck(args);
      break;
    case 'config':
      showConfig();
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

// Run CLI
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, checkFile, batchCheck, showConfig, showHelp };
