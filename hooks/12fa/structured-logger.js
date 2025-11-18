#!/usr/bin/env node

/**
 * Structured Logger
 * OpenTelemetry-compatible structured logging utility
 * Supports JSON output, correlation IDs, and multiple log levels
 */

const fs = require('fs');
const path = require('path');

/**
 * Log levels in order of severity
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Structured Logger Class
 */
class StructuredLogger {
  constructor(config = {}) {
    this.config = {
      level: config.level || 'INFO',
      outputFormat: config.outputFormat || 'json',
      outputDestination: config.outputDestination || 'console',
      outputFile: config.outputFile || path.join(process.cwd(), 'logs', 'hooks.log'),
      includeStack: config.includeStack !== false,
      prettyPrint: config.prettyPrint || false,
      ...config
    };

    // Load config from file if available
    this.loadConfig();

    // Ensure log directory exists
    if (this.config.outputDestination === 'file' || this.config.outputDestination === 'both') {
      const logDir = path.dirname(this.config.outputFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  /**
   * Load configuration from file
   */
  loadConfig() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'logging-config.json');
      if (fs.existsSync(configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const env = process.env.NODE_ENV || 'development';

        // Merge environment-specific config
        if (fileConfig[env]) {
          this.config = { ...this.config, ...fileConfig[env] };
        } else if (fileConfig.default) {
          this.config = { ...this.config, ...fileConfig.default };
        }
      }
    } catch (error) {
      // Fallback to defaults if config load fails
      console.error('Failed to load logging config, using defaults:', error.message);
    }
  }

  /**
   * Check if log level should be output
   */
  shouldLog(level) {
    const configLevel = LOG_LEVELS[this.config.level.toUpperCase()] || LOG_LEVELS.INFO;
    const messageLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
    return messageLevel >= configLevel;
  }

  /**
   * Create structured log entry
   */
  createLogEntry(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: message,
      trace_id: context.trace_id || context.traceId || context.correlationId || 'unknown',
      span_id: context.span_id || context.spanId || this.generateSpanId(),
      ...this.extractContext(context)
    };

    // Add parent span if available
    if (context.parent_span_id || context.parentSpanId) {
      entry.parent_span_id = context.parent_span_id || context.parentSpanId;
    }

    // Add duration if available
    if (context.duration_ms !== undefined) {
      entry.duration_ms = context.duration_ms;
    }

    // Add status
    entry.status = context.status || (level === 'ERROR' ? 'error' : 'success');

    // Add error information if present
    if (context.error) {
      entry.error = {
        message: context.error.message || String(context.error),
        ...(this.config.includeStack && context.error.stack ? { stack: context.error.stack } : {})
      };
    }

    return entry;
  }

  /**
   * Extract context fields
   */
  extractContext(context) {
    const extracted = {};

    // Standard fields
    if (context.agent_id || context.agentId) {
      extracted.agent_id = context.agent_id || context.agentId;
    }
    if (context.agent_type || context.agentType) {
      extracted.agent_type = context.agent_type || context.agentType;
    }
    if (context.operation) {
      extracted.operation = context.operation;
    }

    // Metadata - collect all non-standard fields
    const standardFields = [
      'trace_id', 'traceId', 'span_id', 'spanId', 'parent_span_id', 'parentSpanId',
      'agent_id', 'agentId', 'agent_type', 'agentType', 'operation', 'duration_ms',
      'status', 'error', 'correlationId'
    ];

    const metadata = {};
    for (const [key, value] of Object.entries(context)) {
      if (!standardFields.includes(key) && value !== undefined) {
        metadata[key] = value;
      }
    }

    if (Object.keys(metadata).length > 0) {
      extracted.metadata = metadata;
    }

    return extracted;
  }

  /**
   * Generate span ID
   */
  generateSpanId() {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format log entry for output
   */
  formatLogEntry(entry) {
    if (this.config.outputFormat === 'json') {
      return this.config.prettyPrint
        ? JSON.stringify(entry, null, 2)
        : JSON.stringify(entry);
    }

    // Plain text format for debugging
    const parts = [
      entry.timestamp,
      `[${entry.level}]`,
      entry.message,
      `(trace: ${entry.trace_id})`,
    ];

    if (entry.agent_id) {
      parts.push(`agent: ${entry.agent_id}`);
    }

    if (entry.duration_ms !== undefined) {
      parts.push(`${entry.duration_ms}ms`);
    }

    return parts.join(' ');
  }

  /**
   * Write log entry to destination
   */
  writeLog(formattedEntry) {
    const output = formattedEntry + '\n';

    if (this.config.outputDestination === 'console' || this.config.outputDestination === 'both') {
      process.stdout.write(output);
    }

    if (this.config.outputDestination === 'file' || this.config.outputDestination === 'both') {
      try {
        // Ensure directory exists before writing (in case it was deleted)
        const logDir = path.dirname(this.config.outputFile);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }

        fs.appendFileSync(this.config.outputFile, output, 'utf8');
      } catch (error) {
        console.error('Failed to write to log file:', error.message);
      }
    }
  }

  /**
   * Log message with level
   */
  log(level, message, context = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context);
    const formatted = this.formatLogEntry(entry);
    this.writeLog(formatted);

    return entry;
  }

  /**
   * Log DEBUG level
   */
  debug(message, context = {}) {
    return this.log('DEBUG', message, context);
  }

  /**
   * Log INFO level
   */
  info(message, context = {}) {
    return this.log('INFO', message, context);
  }

  /**
   * Log WARN level
   */
  warn(message, context = {}) {
    return this.log('WARN', message, context);
  }

  /**
   * Log ERROR level
   */
  error(message, context = {}) {
    return this.log('ERROR', message, context);
  }

  /**
   * Create child logger with inherited context
   */
  child(inheritedContext = {}) {
    const childLogger = new StructuredLogger(this.config);
    childLogger.inheritedContext = { ...this.inheritedContext, ...inheritedContext };
    return childLogger;
  }

  /**
   * Merge inherited context with log context
   */
  mergeContext(context) {
    return { ...this.inheritedContext, ...context };
  }

  /**
   * Override log methods to include inherited context
   */
  _wrapLogMethod(method) {
    return (message, context = {}) => {
      return method.call(this, message, this.mergeContext(context));
    };
  }
}

// Add inherited context support
const originalLog = StructuredLogger.prototype.log;
StructuredLogger.prototype.log = function(level, message, context = {}) {
  const mergedContext = { ...this.inheritedContext, ...context };
  return originalLog.call(this, level, message, mergedContext);
};

/**
 * Create singleton logger instance
 */
let defaultLogger = null;

function getLogger(config) {
  if (config) {
    return new StructuredLogger(config);
  }

  if (!defaultLogger) {
    defaultLogger = new StructuredLogger();
  }

  return defaultLogger;
}

/**
 * Convenience methods on module
 */
function debug(message, context) {
  return getLogger().debug(message, context);
}

function info(message, context) {
  return getLogger().info(message, context);
}

function warn(message, context) {
  return getLogger().warn(message, context);
}

function error(message, context) {
  return getLogger().error(message, context);
}

module.exports = {
  StructuredLogger,
  getLogger,
  debug,
  info,
  warn,
  error,
  LOG_LEVELS
};
