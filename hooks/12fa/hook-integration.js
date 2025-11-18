#!/usr/bin/env node

/**
 * Hook Integration System
 * 12FA Quick Win #3: Automatic bash command validation
 *
 * This module provides the integration layer between Claude Code's Bash tool
 * and the bash command allowlist policy enforcement system.
 *
 * Features:
 * - Automatic interception of ALL Bash tool calls
 * - Policy-based validation before execution
 * - Agent-specific permission management
 * - Comprehensive audit logging
 * - Performance monitoring (<5ms overhead)
 */

const preBashHook = require('./pre-bash.hook');
const validator = require('./bash-validator');
const fs = require('fs');
const path = require('path');

class HookIntegration {
  constructor() {
    this.enabled = true;
    this.stats = {
      totalCommands: 0,
      blockedCommands: 0,
      allowedCommands: 0,
      totalValidationTime: 0,
      startTime: Date.now()
    };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `bash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize hook system
   */
  async initialize(options = {}) {
    console.log('🔧 Initializing Bash Command Allowlist Hook System');

    try {
      // Load policy
      const policyFile = options.policyFile ||
                        process.env.CLAUDE_FLOW_POLICY_FILE ||
                        null;

      const loadResult = validator.loadPolicy(policyFile);

      console.log('✓ Policy loaded successfully');
      console.log(`  File: ${loadResult.policyFile}`);
      console.log(`  Version: ${loadResult.version}`);
      console.log(`  Default Policy: ${loadResult.defaultPolicy}`);

      // Set up environment
      process.env.CLAUDE_FLOW_SESSION_ID = this.sessionId;

      // Create log directories
      this.ensureDirectories();

      return {
        success: true,
        sessionId: this.sessionId,
        policy: loadResult
      };

    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const dirs = ['logs', 'metrics'];

    dirs.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  /**
   * Intercept and validate bash command
   */
  async interceptCommand(command, options = {}) {
    const startTime = Date.now();
    this.stats.totalCommands++;

    if (!this.enabled) {
      return {
        allowed: true,
        reason: 'Hook system disabled'
      };
    }

    try {
      // Build context
      const context = {
        command,
        agentType: options.agentType ||
                  process.env.CLAUDE_FLOW_AGENT_TYPE ||
                  'unknown',
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        metadata: options.metadata || {}
      };

      // Run pre-bash hook
      const result = await preBashHook(context);

      // Update statistics
      const validationTime = Date.now() - startTime;
      this.stats.totalValidationTime += validationTime;

      if (result.success && result.allowed) {
        this.stats.allowedCommands++;

        return {
          allowed: true,
          validation: result.validation,
          validationTime,
          sessionId: this.sessionId
        };
      } else {
        this.stats.blockedCommands++;

        // Log blocking event
        this.logBlockedCommand(command, result, context);

        return {
          allowed: false,
          blocked: true,
          violation: result.violation,
          message: result.violation?.message,
          validationTime,
          sessionId: this.sessionId
        };
      }

    } catch (error) {
      console.error('❌ Command interception failed:', error.message);

      // Fail-secure: block command on error
      this.stats.blockedCommands++;

      return {
        allowed: false,
        error: true,
        message: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Log blocked command for audit trail
   */
  logBlockedCommand(command, result, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      command,
      agentType: context.agentType,
      violation: result.violation,
      policy: validator.activePolicy,
      blocked: true
    };

    // Write to violations log
    const logFile = path.join(process.cwd(), 'logs', 'blocked-commands.log');
    fs.appendFileSync(
      logFile,
      JSON.stringify(logEntry) + '\n',
      'utf8'
    );

    // Also export to validator's log
    validator.exportMetrics();
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    const uptime = Date.now() - this.stats.startTime;
    const avgValidationTime = this.stats.totalCommands > 0
      ? this.stats.totalValidationTime / this.stats.totalCommands
      : 0;

    return {
      sessionId: this.sessionId,
      uptime: `${(uptime / 1000).toFixed(2)}s`,
      totalCommands: this.stats.totalCommands,
      allowedCommands: this.stats.allowedCommands,
      blockedCommands: this.stats.blockedCommands,
      blockRate: this.stats.totalCommands > 0
        ? `${((this.stats.blockedCommands / this.stats.totalCommands) * 100).toFixed(2)}%`
        : '0%',
      avgValidationTime: `${avgValidationTime.toFixed(2)}ms`,
      performanceMet: avgValidationTime < 5,
      policy: validator.activePolicy,
      enabled: this.enabled
    };
  }

  /**
   * Generate integration report
   */
  generateReport() {
    const stats = this.getStatistics();
    const violations = validator.getViolationStats();

    const report = {
      title: 'Bash Command Allowlist Integration Report',
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,

      summary: {
        status: stats.blockedCommands === 0 ? 'SECURE' : 'VIOLATIONS_DETECTED',
        totalCommands: stats.totalCommands,
        allowedCommands: stats.allowedCommands,
        blockedCommands: stats.blockedCommands,
        blockRate: stats.blockRate
      },

      performance: {
        averageValidationTime: stats.avgValidationTime,
        requirementMet: stats.performanceMet,
        requirement: '<5ms per validation'
      },

      policy: {
        activePolicy: stats.policy,
        policyFile: validator.policy?.version ?
          `bash-allowlist-default.yml v${validator.policy.version}` :
          'Unknown'
      },

      violations: {
        total: violations.total,
        lastMinute: violations.lastMinute,
        byType: violations.byType,
        highViolationRate: validator.isViolationRateHigh()
      },

      recommendations: this.generateRecommendations(stats, violations)
    };

    return report;
  }

  /**
   * Generate recommendations based on statistics
   */
  generateRecommendations(stats, violations) {
    const recommendations = [];

    if (stats.blockedCommands > 0) {
      recommendations.push({
        level: 'WARNING',
        message: `${stats.blockedCommands} commands were blocked`,
        action: 'Review blocked commands log for potential security incidents'
      });
    }

    if (!stats.performanceMet) {
      recommendations.push({
        level: 'ATTENTION',
        message: `Validation time (${stats.avgValidationTime}) exceeds 5ms target`,
        action: 'Consider optimizing policy patterns or caching'
      });
    }

    if (violations.total === 0 && stats.totalCommands > 50) {
      recommendations.push({
        level: 'SUCCESS',
        message: 'All commands passed validation',
        action: 'System is operating securely'
      });
    }

    if (validator.isViolationRateHigh()) {
      recommendations.push({
        level: 'CRITICAL',
        message: 'High violation rate detected',
        action: 'Investigate for misconfiguration or security incident'
      });
    }

    return recommendations;
  }

  /**
   * Export report to file
   */
  exportReport(filename = null) {
    const report = this.generateReport();

    const reportFile = filename ||
      path.join(process.cwd(), 'metrics', `integration-report-${this.sessionId}.json`);

    fs.writeFileSync(
      reportFile,
      JSON.stringify(report, null, 2),
      'utf8'
    );

    console.log(`\n📊 Report exported to: ${reportFile}`);
    return reportFile;
  }

  /**
   * Print report to console
   */
  printReport() {
    const report = this.generateReport();

    console.log('\n' + '='.repeat(80));
    console.log('  ' + report.title);
    console.log('='.repeat(80));

    console.log('\n📋 SUMMARY');
    console.log(`  Status: ${report.summary.status}`);
    console.log(`  Total Commands: ${report.summary.totalCommands}`);
    console.log(`  Allowed: ${report.summary.allowedCommands} (${
      report.summary.totalCommands > 0
        ? ((report.summary.allowedCommands / report.summary.totalCommands) * 100).toFixed(1)
        : 0
    }%)`);
    console.log(`  Blocked: ${report.summary.blockedCommands} (${report.summary.blockRate})`);

    console.log('\n⚡ PERFORMANCE');
    console.log(`  Average Validation: ${report.performance.averageValidationTime}`);
    console.log(`  Requirement Met: ${report.performance.requirementMet ? '✅ Yes' : '❌ No'}`);
    console.log(`  Target: ${report.performance.requirement}`);

    console.log('\n🔒 POLICY');
    console.log(`  Active Policy: ${report.policy.activePolicy}`);
    console.log(`  Policy File: ${report.policy.policyFile}`);

    if (report.violations.total > 0) {
      console.log('\n⚠️  VIOLATIONS');
      console.log(`  Total: ${report.violations.total}`);
      console.log(`  Last Minute: ${report.violations.lastMinute}`);
      console.log(`  By Type:`);
      Object.entries(report.violations.byType).forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      report.recommendations.forEach(rec => {
        const icon = rec.level === 'CRITICAL' ? '🔴' :
                    rec.level === 'WARNING' ? '⚠️' :
                    rec.level === 'ATTENTION' ? '🔵' : '✅';
        console.log(`  ${icon} [${rec.level}] ${rec.message}`);
        console.log(`     Action: ${rec.action}`);
      });
    }

    console.log('\n' + '='.repeat(80));
  }
}

// Export singleton instance
const hookIntegration = new HookIntegration();

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('Usage: node hook-integration.js <command> [args]');
    console.log('\nCommands:');
    console.log('  init              - Initialize hook system');
    console.log('  test <command>    - Test command validation');
    console.log('  stats             - Show current statistics');
    console.log('  report            - Generate and display report');
    console.log('  export [file]     - Export report to file');
    process.exit(1);
  }

  switch (command) {
    case 'init':
      const initResult = await hookIntegration.initialize();
      console.log('\nInitialization Result:', JSON.stringify(initResult, null, 2));
      break;

    case 'test':
      const testCmd = args.slice(1).join(' ');
      if (!testCmd) {
        console.error('Error: No command provided to test');
        process.exit(1);
      }

      await hookIntegration.initialize();
      const result = await hookIntegration.interceptCommand(testCmd);

      console.log('\nValidation Result:');
      console.log(JSON.stringify(result, null, 2));
      break;

    case 'stats':
      const stats = hookIntegration.getStatistics();
      console.log('\nCurrent Statistics:');
      console.log(JSON.stringify(stats, null, 2));
      break;

    case 'report':
      await hookIntegration.initialize();
      hookIntegration.printReport();
      break;

    case 'export':
      await hookIntegration.initialize();
      const exportFile = args[1] || null;
      hookIntegration.exportReport(exportFile);
      hookIntegration.printReport();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use as module
module.exports = hookIntegration;
