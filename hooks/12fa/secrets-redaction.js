/**
 * Secrets Redaction Module
 *
 * Detects and prevents storage of secrets in memory system.
 * Part of 12-Factor App compliance (Quick Win #2).
 */

const fs = require('fs');
const path = require('path');

class SecretsRedactor {
  constructor(patternsPath = null) {
    this.patternsPath = patternsPath || path.join(__dirname, 'secrets-patterns.json');
    this.patterns = [];
    this.whitelistedPatterns = [];
    this.config = {};
    this.violationLog = [];
    this.loadPatterns();
  }

  /**
   * Load secret patterns from configuration file
   */
  loadPatterns() {
    try {
      const data = fs.readFileSync(this.patternsPath, 'utf8');
      const config = JSON.parse(data);

      // Compile regex patterns for performance
      this.patterns = config.patterns.map(pattern => ({
        ...pattern,
        compiledRegex: new RegExp(pattern.regex, 'gi')
      }));

      // Compile whitelist patterns
      this.whitelistedPatterns = (config.whitelisted_patterns || []).map(
        pattern => new RegExp(pattern, 'i')
      );

      this.config = config.config || {};

      return true;
    } catch (error) {
      console.error('Failed to load secrets patterns:', error.message);
      throw new Error(`Secrets redaction initialization failed: ${error.message}`);
    }
  }

  /**
   * Reload patterns from file (useful for dynamic updates)
   */
  reloadPatterns() {
    this.patterns = [];
    this.whitelistedPatterns = [];
    this.loadPatterns();
  }

  /**
   * Check if value is whitelisted (test data, examples, etc.)
   */
  isWhitelisted(value) {
    if (typeof value !== 'string') {
      value = JSON.stringify(value);
    }

    return this.whitelistedPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Scan value for secrets
   * @param {string|object} value - Value to scan
   * @returns {Array} Array of detected secrets
   */
  scanForSecrets(value) {
    const startTime = Date.now();
    const detections = [];

    // Convert to string for scanning
    let scanValue = value;
    if (typeof value === 'object') {
      scanValue = JSON.stringify(value, null, 2);
    } else if (typeof value !== 'string') {
      scanValue = String(value);
    }

    // Check size limit
    if (this.config.max_scan_size && scanValue.length > this.config.max_scan_size) {
      throw new Error(`Value exceeds maximum scan size of ${this.config.max_scan_size} bytes`);
    }

    // Skip if whitelisted
    if (this.isWhitelisted(scanValue)) {
      return detections;
    }

    // Scan against all patterns
    for (const pattern of this.patterns) {
      const matches = scanValue.match(pattern.compiledRegex);

      if (matches && matches.length > 0) {
        detections.push({
          name: pattern.name,
          severity: pattern.severity,
          description: pattern.description,
          recommendation: pattern.recommendation,
          matchCount: matches.length,
          // Only include first match snippet (redacted)
          sample: this.redactMatch(matches[0])
        });
      }
    }

    // Check performance timeout
    const scanTime = Date.now() - startTime;
    if (this.config.performance_timeout_ms && scanTime > this.config.performance_timeout_ms) {
      console.warn(`Secret scan exceeded timeout: ${scanTime}ms > ${this.config.performance_timeout_ms}ms`);
    }

    return detections;
  }

  /**
   * Redact a matched secret for logging
   */
  redactMatch(match) {
    if (match.length <= 8) {
      return '***REDACTED***';
    }
    return match.substring(0, 4) + '***REDACTED***' + match.substring(match.length - 4);
  }

  /**
   * Validate that no secrets are present in value
   * @param {string} key - Memory key
   * @param {any} value - Value to validate
   * @throws {Error} If secrets are detected
   * @returns {boolean} True if validation passes
   */
  validateNoSecrets(key, value) {
    const detections = this.scanForSecrets(value);

    if (detections.length > 0) {
      // Log violation
      const violation = {
        timestamp: new Date().toISOString(),
        key,
        detections: detections.map(d => ({
          name: d.name,
          severity: d.severity,
          description: d.description
        })),
        blocked: this.config.block_on_detection
      };

      this.violationLog.push(violation);

      // Audit if enabled
      if (this.config.audit_violations) {
        this.auditViolation(violation);
      }

      // Block if configured
      if (this.config.block_on_detection) {
        const errorMessage = this.formatErrorMessage(detections);
        throw new Error(errorMessage);
      }

      return false;
    }

    return true;
  }

  /**
   * Format user-friendly error message
   */
  formatErrorMessage(detections) {
    const criticalCount = detections.filter(d => d.severity === 'critical').length;
    const highCount = detections.filter(d => d.severity === 'high').length;

    let message = '🔒 SECRET DETECTED - Storage blocked for security!\n\n';
    message += `Found ${detections.length} potential secret(s):\n`;

    detections.forEach((detection, index) => {
      message += `\n${index + 1}. ${detection.description}\n`;
      message += `   Severity: ${detection.severity.toUpperCase()}\n`;
      message += `   ✅ ${detection.recommendation}\n`;
    });

    message += '\n📚 Best Practice: Store secrets in environment variables or secure vaults.\n';
    message += '   Never commit secrets to version control or memory storage.\n';

    return message;
  }

  /**
   * Audit violation to log file
   */
  auditViolation(violation) {
    try {
      const logDir = path.join(__dirname, '../../logs/12fa');
      const logFile = path.join(logDir, 'secrets-violations.log');

      // Create log directory if it doesn't exist
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append to log file
      const logEntry = JSON.stringify(violation) + '\n';
      fs.appendFileSync(logFile, logEntry, 'utf8');
    } catch (error) {
      console.error('Failed to audit violation:', error.message);
    }
  }

  /**
   * Get violation statistics
   */
  getViolationStats() {
    const stats = {
      total: this.violationLog.length,
      bySeverity: {},
      byPattern: {},
      recent: this.violationLog.slice(-10)
    };

    this.violationLog.forEach(violation => {
      violation.detections.forEach(detection => {
        // Count by severity
        stats.bySeverity[detection.severity] =
          (stats.bySeverity[detection.severity] || 0) + 1;

        // Count by pattern name
        stats.byPattern[detection.name] =
          (stats.byPattern[detection.name] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * Clear violation log
   */
  clearViolationLog() {
    this.violationLog = [];
  }

  /**
   * Add custom pattern at runtime
   */
  addCustomPattern(pattern) {
    const compiledPattern = {
      ...pattern,
      compiledRegex: new RegExp(pattern.regex, 'gi')
    };
    this.patterns.push(compiledPattern);
  }

  /**
   * Redact secrets from value (replace with [REDACTED])
   */
  redactSecrets(value) {
    let redactedValue = value;

    if (typeof value === 'object') {
      redactedValue = JSON.stringify(value, null, 2);
    } else if (typeof value !== 'string') {
      redactedValue = String(value);
    }

    for (const pattern of this.patterns) {
      redactedValue = redactedValue.replace(pattern.compiledRegex, '[REDACTED]');
    }

    return redactedValue;
  }
}

// Export singleton instance
let instance = null;

function getRedactorInstance(patternsPath = null) {
  if (!instance) {
    instance = new SecretsRedactor(patternsPath);
  }
  return instance;
}

module.exports = {
  SecretsRedactor,
  getRedactorInstance,
  validateNoSecrets: (key, value) => {
    return getRedactorInstance().validateNoSecrets(key, value);
  },
  scanForSecrets: (value) => {
    return getRedactorInstance().scanForSecrets(value);
  },
  redactSecrets: (value) => {
    return getRedactorInstance().redactSecrets(value);
  }
};
