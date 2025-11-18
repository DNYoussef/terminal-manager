/**
 * Bash Command Validator
 * 12FA Quick Win #3: Policy-based bash command allowlist
 *
 * Validates bash commands against security policies before execution
 * Blocks dangerous operations while allowing safe development commands
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class BashValidator {
  constructor() {
    this.policy = null;
    this.activePolicy = 'strict';
    this.agentType = null;
    this.violations = [];
    this.startTime = Date.now();
  }

  /**
   * Load policy from YAML file
   */
  loadPolicy(policyPath = null) {
    const defaultPath = path.join(process.cwd(), 'policies', 'bash-allowlist-default.yml');
    const projectPath = path.join(process.cwd(), '.claude-flow', 'bash-allowlist.yml');

    let policyFile = policyPath || projectPath;

    // Fallback to default if project policy doesn't exist
    if (!fs.existsSync(policyFile)) {
      policyFile = defaultPath;
    }

    if (!fs.existsSync(policyFile)) {
      throw new Error(`Policy file not found: ${policyFile}`);
    }

    try {
      const fileContents = fs.readFileSync(policyFile, 'utf8');
      this.policy = yaml.load(fileContents);
      this.activePolicy = this.policy.default_policy || 'strict';

      return {
        success: true,
        policyFile,
        version: this.policy.version,
        defaultPolicy: this.activePolicy
      };
    } catch (error) {
      throw new Error(`Failed to load policy: ${error.message}`);
    }
  }

  /**
   * Set agent type to apply agent-specific overrides
   */
  setAgentType(agentType) {
    this.agentType = agentType;

    // Apply agent override if exists
    if (this.policy?.agent_overrides?.[agentType]) {
      const override = this.policy.agent_overrides[agentType];
      if (override.policy) {
        this.activePolicy = override.policy;
      }
    }
  }

  /**
   * Get active policy configuration
   */
  getActivePolicyConfig() {
    if (!this.policy) {
      throw new Error('Policy not loaded. Call loadPolicy() first.');
    }

    const baseConfig = this.policy[this.activePolicy];

    // Apply agent overrides
    if (this.agentType && this.policy.agent_overrides?.[this.agentType]) {
      const override = this.policy.agent_overrides[this.agentType];

      return {
        ...baseConfig,
        allowed_commands: [
          ...(baseConfig.allowed_commands || []),
          ...(override.allowed_additional || [])
        ],
        blocked_commands: [
          ...(baseConfig.blocked_commands || []),
          ...(override.additional_blocked_commands || [])
        ],
        blocked_patterns: [
          ...(baseConfig.blocked_patterns || []),
          ...(override.additional_blocked_patterns || [])
        ]
      };
    }

    return baseConfig;
  }

  /**
   * Extract base command from command string
   */
  extractBaseCommand(commandString) {
    // Remove leading/trailing whitespace
    const trimmed = commandString.trim();

    // Extract first command (before pipes, semicolons, etc.)
    const baseCmd = trimmed.split(/[|;&]/)[0].trim();

    // Get just the command name (first word)
    const cmdName = baseCmd.split(/\s+/)[0];

    return {
      full: trimmed,
      base: baseCmd,
      name: cmdName
    };
  }

  /**
   * Check if command is explicitly allowed
   */
  isCommandAllowed(command) {
    const config = this.getActivePolicyConfig();
    const { base, name } = this.extractBaseCommand(command);

    // Check exact command match
    if (config.allowed_commands?.includes(name)) {
      return { allowed: true, reason: 'Exact command match' };
    }

    // Check base command match (e.g., "git status")
    if (config.allowed_commands?.includes(base)) {
      return { allowed: true, reason: 'Base command match' };
    }

    // Check for wildcard patterns
    for (const allowed of config.allowed_commands || []) {
      if (allowed.includes('*')) {
        const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        if (pattern.test(base)) {
          return { allowed: true, reason: `Pattern match: ${allowed}` };
        }
      }
    }

    return { allowed: false, reason: 'Command not in allowlist' };
  }

  /**
   * Check if command is explicitly blocked
   */
  isCommandBlocked(command) {
    const config = this.getActivePolicyConfig();
    const { full, base, name } = this.extractBaseCommand(command);

    // Check exact blocked command
    if (config.blocked_commands?.includes(name)) {
      return { blocked: true, reason: `Blocked command: ${name}` };
    }

    // Check base command
    if (config.blocked_commands?.includes(base)) {
      return { blocked: true, reason: `Blocked command: ${base}` };
    }

    // Check blocked patterns
    for (const pattern of config.blocked_patterns || []) {
      try {
        const regex = new RegExp(pattern);
        if (regex.test(full)) {
          return {
            blocked: true,
            reason: `Matches blocked pattern: ${pattern}`,
            pattern
          };
        }
      } catch (error) {
        console.warn(`Invalid regex pattern: ${pattern}`, error);
      }
    }

    return { blocked: false };
  }

  /**
   * Validate command against policy
   */
  validate(command, options = {}) {
    const validationStart = Date.now();

    // Check command length
    const maxLength = this.policy?.validation?.max_command_length || 4096;
    if (command.length > maxLength) {
      return this.createViolation(command, 'COMMAND_TOO_LONG', {
        length: command.length,
        maxLength
      });
    }

    // Check if blocked
    const blockedCheck = this.isCommandBlocked(command);
    if (blockedCheck.blocked) {
      return this.createViolation(command, 'BLOCKED_COMMAND', {
        reason: blockedCheck.reason,
        pattern: blockedCheck.pattern
      });
    }

    // Check if allowed (only for strict and moderate policies)
    if (this.activePolicy === 'strict' || this.activePolicy === 'moderate') {
      const allowedCheck = this.isCommandAllowed(command);
      if (!allowedCheck.allowed) {
        return this.createViolation(command, 'NOT_ALLOWED', {
          reason: allowedCheck.reason
        });
      }
    }

    // Command is valid
    const validationTime = Date.now() - validationStart;

    return {
      valid: true,
      command,
      policy: this.activePolicy,
      agentType: this.agentType,
      validationTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create violation record
   */
  createViolation(command, violationType, details = {}) {
    const violation = {
      valid: false,
      command,
      violationType,
      policy: this.activePolicy,
      agentType: this.agentType,
      details,
      timestamp: new Date().toISOString(),
      message: this.getViolationMessage(violationType, command, details)
    };

    this.violations.push(violation);
    this.logViolation(violation);

    return violation;
  }

  /**
   * Get human-readable violation message
   */
  getViolationMessage(type, command, details) {
    const { base } = this.extractBaseCommand(command);

    switch (type) {
      case 'BLOCKED_COMMAND':
        return `❌ BLOCKED: Command "${base}" is explicitly blocked.\n` +
               `Reason: ${details.reason}\n` +
               `Policy: ${this.activePolicy}\n` +
               `This command poses security risks and cannot be executed.`;

      case 'NOT_ALLOWED':
        return `❌ NOT ALLOWED: Command "${base}" is not in the allowlist.\n` +
               `Reason: ${details.reason}\n` +
               `Policy: ${this.activePolicy}\n` +
               `Only explicitly allowed commands can be executed in ${this.activePolicy} mode.`;

      case 'COMMAND_TOO_LONG':
        return `❌ COMMAND TOO LONG: Command exceeds maximum length.\n` +
               `Length: ${details.length} characters (max: ${details.maxLength})\n` +
               `This may indicate a buffer overflow attack.`;

      default:
        return `❌ VALIDATION FAILED: ${type}`;
    }
  }

  /**
   * Log violation to file
   */
  logViolation(violation) {
    if (!this.policy?.monitoring?.log_violations) {
      return;
    }

    const logFile = this.policy.monitoring.log_file || 'logs/bash-violations.log';
    const logDir = path.dirname(logFile);

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logEntry = {
      ...violation,
      sessionId: process.env.CLAUDE_FLOW_SESSION_ID || 'unknown',
      pid: process.pid
    };

    fs.appendFileSync(
      logFile,
      JSON.stringify(logEntry) + '\n',
      'utf8'
    );
  }

  /**
   * Get violation statistics
   */
  getViolationStats() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentViolations = this.violations.filter(v =>
      new Date(v.timestamp).getTime() > oneMinuteAgo
    );

    return {
      total: this.violations.length,
      lastMinute: recentViolations.length,
      byType: this.violations.reduce((acc, v) => {
        acc[v.violationType] = (acc[v.violationType] || 0) + 1;
        return acc;
      }, {}),
      uptime: now - this.startTime
    };
  }

  /**
   * Check if violation rate exceeds threshold
   */
  isViolationRateHigh() {
    const stats = this.getViolationStats();
    const threshold = this.policy?.monitoring?.alert_threshold || 5;

    return stats.lastMinute >= threshold;
  }

  /**
   * Export metrics to file
   */
  exportMetrics() {
    if (!this.policy?.monitoring?.export_metrics) {
      return;
    }

    const metricsFile = this.policy.monitoring.metrics_file ||
                       'metrics/bash-policy-metrics.json';
    const metricsDir = path.dirname(metricsFile);

    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    const metrics = {
      timestamp: new Date().toISOString(),
      policy: this.activePolicy,
      agentType: this.agentType,
      stats: this.getViolationStats(),
      violations: this.violations,
      version: this.policy.version
    };

    fs.writeFileSync(
      metricsFile,
      JSON.stringify(metrics, null, 2),
      'utf8'
    );
  }
}

// Export singleton instance
module.exports = new BashValidator();
