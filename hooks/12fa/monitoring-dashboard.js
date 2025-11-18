#!/usr/bin/env node

/**
 * Secrets Redaction Monitoring Dashboard
 *
 * Real-time monitoring and visualization of secret detection metrics.
 * Part of 12-Factor App compliance (Quick Win #2).
 */

const fs = require('fs');
const path = require('path');
const { getRedactorInstance } = require('./secrets-redaction');
const { getStats: getHookStats } = require('./pre-memory-store.hook');
const { getInstance: getMCPIntegration } = require('./mcp-memory-integration');

class MonitoringDashboard {
  constructor() {
    this.logsDir = path.join(__dirname, '../../logs/12fa');
    this.redactor = getRedactorInstance();
    this.mcpIntegration = getMCPIntegration();
    this.refreshInterval = 5000; // 5 seconds
  }

  /**
   * Start monitoring dashboard
   */
  start(options = {}) {
    const { continuous = false, refresh = 5000 } = options;
    this.refreshInterval = refresh;

    console.clear();
    this.renderDashboard();

    if (continuous) {
      setInterval(() => {
        console.clear();
        this.renderDashboard();
      }, this.refreshInterval);
    }
  }

  /**
   * Render complete dashboard
   */
  renderDashboard() {
    const width = 80;

    this.printHeader(width);
    this.printOverview(width);
    this.printViolationStats(width);
    this.printPerformanceMetrics(width);
    this.printRecentBlocked(width);
    this.printTopPatterns(width);
    this.printRecommendations(width);
    this.printFooter(width);
  }

  /**
   * Print dashboard header
   */
  printHeader(width) {
    console.log('═'.repeat(width));
    console.log(this.centerText('🔒 SECRETS REDACTION MONITORING DASHBOARD', width));
    console.log(this.centerText(`Last Updated: ${new Date().toLocaleString()}`, width));
    console.log('═'.repeat(width));
    console.log();
  }

  /**
   * Print overview section
   */
  printOverview(width) {
    const violationStats = this.redactor.getViolationStats();
    const hookStats = this.getBlockedStats();
    const mcpStats = this.mcpIntegration.getStats();

    console.log('📊 OVERVIEW');
    console.log('─'.repeat(width));
    console.log();

    const overviewData = [
      ['Total Memory Store Calls', mcpStats.totalCalls || 0],
      ['Secrets Detected', violationStats.total || 0],
      ['Operations Blocked', hookStats.totalBlocked || 0],
      ['Operations Passed', (mcpStats.passed || 0)],
      ['Block Rate', mcpStats.blockRate || '0%'],
      ['Status', this.getSystemStatus(violationStats.total, mcpStats.totalCalls)]
    ];

    overviewData.forEach(([label, value]) => {
      const statusEmoji = this.getStatusEmoji(label, value);
      console.log(`  ${statusEmoji} ${label.padEnd(30)} ${this.formatValue(value)}`);
    });

    console.log();
  }

  /**
   * Print violation statistics
   */
  printViolationStats(width) {
    const stats = this.redactor.getViolationStats();

    console.log('🚨 VIOLATIONS BY SEVERITY');
    console.log('─'.repeat(width));
    console.log();

    if (Object.keys(stats.bySeverity).length === 0) {
      console.log('  ✅ No violations detected');
    } else {
      const severityOrder = ['critical', 'high', 'medium', 'low'];

      severityOrder.forEach(severity => {
        const count = stats.bySeverity[severity] || 0;
        if (count > 0) {
          const bar = this.createProgressBar(count, stats.total, 40);
          const emoji = severity === 'critical' ? '🔴' :
                       severity === 'high' ? '🟠' :
                       severity === 'medium' ? '🟡' : '🟢';

          console.log(`  ${emoji} ${severity.toUpperCase().padEnd(10)} ${count.toString().padStart(4)} ${bar}`);
        }
      });
    }

    console.log();
  }

  /**
   * Print performance metrics
   */
  printPerformanceMetrics(width) {
    const mcpStats = this.mcpIntegration.getStats();

    console.log('⚡ PERFORMANCE METRICS');
    console.log('─'.repeat(width));
    console.log();

    const metrics = [
      ['Average Latency', mcpStats.averageLatency || '0ms', this.getLatencyStatus(mcpStats.averageLatency)],
      ['P95 Latency', mcpStats.p95Latency || '0ms', this.getLatencyStatus(mcpStats.p95Latency)],
      ['P99 Latency', mcpStats.p99Latency || '0ms', this.getLatencyStatus(mcpStats.p99Latency)],
      ['Performance Status', this.getPerformanceStatus(mcpStats.averageLatency), '']
    ];

    metrics.forEach(([label, value, status]) => {
      const statusIcon = status || '';
      console.log(`  ${label.padEnd(30)} ${value.toString().padStart(10)} ${statusIcon}`);
    });

    console.log();
  }

  /**
   * Print recent blocked attempts
   */
  printRecentBlocked(width) {
    const stats = this.redactor.getViolationStats();

    console.log('📋 RECENT BLOCKED ATTEMPTS (Last 5)');
    console.log('─'.repeat(width));
    console.log();

    if (stats.recent.length === 0) {
      console.log('  ✅ No recent violations');
    } else {
      const recentViolations = stats.recent.slice(-5).reverse();

      recentViolations.forEach((violation, index) => {
        const time = new Date(violation.timestamp).toLocaleTimeString();
        const detection = violation.detections[0];

        console.log(`  ${index + 1}. [${time}] ${violation.key}`);
        console.log(`     ⚠️  ${detection.description} (${detection.severity})`);
      });
    }

    console.log();
  }

  /**
   * Print top detected patterns
   */
  printTopPatterns(width) {
    const stats = this.redactor.getViolationStats();

    console.log('🔍 TOP DETECTED PATTERNS');
    console.log('─'.repeat(width));
    console.log();

    if (Object.keys(stats.byPattern).length === 0) {
      console.log('  ✅ No patterns detected');
    } else {
      const sortedPatterns = Object.entries(stats.byPattern)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      sortedPatterns.forEach(([pattern, count], index) => {
        const bar = this.createProgressBar(count, stats.total, 30);
        console.log(`  ${index + 1}. ${pattern.padEnd(30)} ${count.toString().padStart(4)} ${bar}`);
      });
    }

    console.log();
  }

  /**
   * Print recommendations
   */
  printRecommendations(width) {
    const stats = this.redactor.getViolationStats();
    const mcpStats = this.mcpIntegration.getStats();

    console.log('💡 RECOMMENDATIONS');
    console.log('─'.repeat(width));
    console.log();

    const recommendations = [];

    // High block rate
    const blockRate = parseInt(mcpStats.blockRate) || 0;
    if (blockRate > 10) {
      recommendations.push('⚠️  High block rate detected - Review secrets management practices');
    }

    // Performance issues
    const avgLatency = parseFloat(mcpStats.averageLatency) || 0;
    if (avgLatency > 8) {
      recommendations.push('⚠️  Performance degrading - Consider optimizing patterns');
    }

    // Recent violations
    if (stats.recent.length > 10) {
      recommendations.push('⚠️  Multiple violations detected - Consider security training');
    }

    // Critical severity
    if (stats.bySeverity.critical > 0) {
      recommendations.push('🔴 Critical secrets detected - Immediate action required');
    }

    // Repeated keys
    const blockedStats = this.getBlockedStats();
    const repeatedKeys = Object.entries(blockedStats.blockedKeys || {})
      .filter(([, data]) => data.count > 2);

    if (repeatedKeys.length > 0) {
      recommendations.push('🔁 Repeated attempts on same keys - Investigate root cause');
    }

    if (recommendations.length === 0) {
      console.log('  ✅ System operating normally - No recommendations');
    } else {
      recommendations.forEach(rec => {
        console.log(`  ${rec}`);
      });
    }

    console.log();
  }

  /**
   * Print footer
   */
  printFooter(width) {
    console.log('═'.repeat(width));
    console.log(this.centerText('Press Ctrl+C to exit', width));
    console.log('═'.repeat(width));
  }

  /**
   * Get blocked stats from file
   */
  getBlockedStats() {
    try {
      const statsPath = path.join(this.logsDir, 'blocked-stats.json');

      if (fs.existsSync(statsPath)) {
        const data = fs.readFileSync(statsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      // Ignore errors
    }

    return {
      totalBlocked: 0,
      lastBlocked: null,
      blockedKeys: {}
    };
  }

  /**
   * Utility: Center text
   */
  centerText(text, width) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  /**
   * Utility: Format value
   */
  formatValue(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  }

  /**
   * Utility: Get status emoji
   */
  getStatusEmoji(label, value) {
    if (label.includes('Block') && value > 0) return '🚫';
    if (label.includes('Passed')) return '✅';
    if (label.includes('Status') && value.includes('SECURE')) return '🛡️';
    return '📌';
  }

  /**
   * Utility: Get system status
   */
  getSystemStatus(violations, totalCalls) {
    if (violations === 0) return '🛡️ SECURE';
    if (violations > 10) return '⚠️ HIGH RISK';
    return '⚠️ MONITORING';
  }

  /**
   * Utility: Create progress bar
   */
  createProgressBar(value, total, width) {
    const percentage = total > 0 ? (value / total) : 0;
    const filled = Math.round(percentage * width);
    const empty = width - filled;

    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${(percentage * 100).toFixed(1)}%`;
  }

  /**
   * Utility: Get latency status
   */
  getLatencyStatus(latency) {
    const ms = parseFloat(latency) || 0;
    if (ms < 5) return '✅';
    if (ms < 10) return '⚠️';
    return '❌';
  }

  /**
   * Utility: Get performance status
   */
  getPerformanceStatus(avgLatency) {
    const ms = parseFloat(avgLatency) || 0;
    if (ms < 5) return '✅ Excellent';
    if (ms < 10) return '⚠️ Good';
    return '❌ Needs Optimization';
  }

  /**
   * Generate JSON report
   */
  generateReport() {
    const violationStats = this.redactor.getViolationStats();
    const hookStats = this.getBlockedStats();
    const mcpStats = this.mcpIntegration.getStats();

    const report = {
      timestamp: new Date().toISOString(),
      overview: {
        totalCalls: mcpStats.totalCalls || 0,
        secretsDetected: violationStats.total || 0,
        operationsBlocked: hookStats.totalBlocked || 0,
        operationsPassed: mcpStats.passed || 0,
        blockRate: mcpStats.blockRate || '0%'
      },
      violations: {
        bySeverity: violationStats.bySeverity,
        byPattern: violationStats.byPattern,
        recent: violationStats.recent
      },
      performance: {
        averageLatency: mcpStats.averageLatency,
        p95Latency: mcpStats.p95Latency,
        p99Latency: mcpStats.p99Latency
      },
      blockedKeys: hookStats.blockedKeys
    };

    return report;
  }

  /**
   * Export report to file
   */
  exportReport(outputPath) {
    const report = this.generateReport();
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`✅ Report exported to: ${outputPath}`);
  }
}

/**
 * CLI interface
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'dashboard';

  const dashboard = new MonitoringDashboard();

  switch (command) {
    case 'dashboard':
    case 'watch':
      dashboard.start({ continuous: command === 'watch' });
      break;

    case 'report':
      dashboard.start({ continuous: false });
      break;

    case 'export':
      const outputPath = args[1] || path.join(__dirname, '../../logs/12fa/monitoring-report.json');
      dashboard.exportReport(outputPath);
      break;

    case 'json':
      console.log(JSON.stringify(dashboard.generateReport(), null, 2));
      break;

    case 'help':
    default:
      console.log('Usage: node monitoring-dashboard.js [command]');
      console.log('Commands:');
      console.log('  dashboard  - Show one-time dashboard snapshot (default)');
      console.log('  watch      - Continuous monitoring (refreshes every 5s)');
      console.log('  report     - Show dashboard once and exit');
      console.log('  export [path] - Export report to JSON file');
      console.log('  json       - Output report as JSON');
      process.exit(0);
  }
}

module.exports = {
  MonitoringDashboard
};
