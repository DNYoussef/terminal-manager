#!/usr/bin/env node

/**
 * Enhanced Structured Logger v2.0
 * Production-grade logging with agent context, correlation IDs, RBAC, and performance metrics
 * Supports multiple transports (console, file, database, memory)
 * Compatible with Agent Reality Map and RBAC Engine
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Log levels with severity ordering
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

/**
 * Transport types
 */
const TRANSPORTS = {
  CONSOLE: 'console',
  FILE: 'file',
  DATABASE: 'database',
  MEMORY: 'memory'
};

/**
 * In-memory log buffer for dashboard
 */
class MemoryTransport {
  constructor(maxLogs = 1000) {
    this.maxLogs = maxLogs;
    this.logs = [];
  }

  write(entry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }
  }

  query(filters = {}) {
    let results = [...this.logs];

    // Filter by level
    if (filters.level) {
      const levelValue = LOG_LEVELS[filters.level.toUpperCase()];
      results = results.filter(log => LOG_LEVELS[log.level] >= levelValue);
    }

    // Filter by agent
    if (filters.agent_name) {
      results = results.filter(log => log.agent?.name === filters.agent_name);
    }

    // Filter by correlation ID
    if (filters.correlation_id) {
      results = results.filter(log => log.execution?.correlation_id === filters.correlation_id);
    }

    // Filter by time range
    if (filters.start_time) {
      const startTime = new Date(filters.start_time).getTime();
      results = results.filter(log => new Date(log.timestamp).getTime() >= startTime);
    }

    if (filters.end_time) {
      const endTime = new Date(filters.end_time).getTime();
      results = results.filter(log => new Date(log.timestamp).getTime() <= endTime);
    }

    // Limit results
    const limit = filters.limit || 100;
    return results.slice(-limit);
  }

  clear() {
    this.logs = [];
  }

  getStats() {
    const stats = {
      total: this.logs.length,
      by_level: {},
      by_agent: {}
    };

    this.logs.forEach(log => {
      // Count by level
      stats.by_level[log.level] = (stats.by_level[log.level] || 0) + 1;

      // Count by agent
      if (log.agent?.name) {
        stats.by_agent[log.agent.name] = (stats.by_agent[log.agent.name] || 0) + 1;
      }
    });

    return stats;
  }
}

/**
 * File rotation transport
 */
class FileTransport {
  constructor(config = {}) {
    this.config = {
      directory: config.directory || path.join(process.cwd(), 'logs'),
      filename: config.filename || 'hooks',
      maxSizeMB: config.maxSizeMB || 100,
      maxFiles: config.maxFiles || 30,
      compress: config.compress !== false,
      ...config
    };

    this.ensureDirectory();
    this.currentFile = this.getCurrentLogFile();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.config.directory)) {
      fs.mkdirSync(this.config.directory, { recursive: true });
    }
  }

  getCurrentLogFile() {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.config.directory, `${this.config.filename}-${date}.log`);
  }

  shouldRotate() {
    try {
      const stats = fs.statSync(this.currentFile);
      const sizeMB = stats.size / (1024 * 1024);
      return sizeMB >= this.config.maxSizeMB;
    } catch (error) {
      return false; // File doesn't exist yet
    }
  }

  rotate() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = this.currentFile.replace('.log', `-${timestamp}.log`);

    try {
      fs.renameSync(this.currentFile, rotatedFile);

      // Compress if enabled
      if (this.config.compress) {
        this.compressFile(rotatedFile);
      }

      // Clean old files
      this.cleanOldFiles();
    } catch (error) {
      console.error('Log rotation failed:', error.message);
    }
  }

  compressFile(filepath) {
    // Simple compression placeholder (would use gzip in production)
    // For now, just mark as compressed
    const compressedPath = filepath + '.gz';
    try {
      fs.renameSync(filepath, compressedPath);
    } catch (error) {
      console.error('Compression failed:', error.message);
    }
  }

  cleanOldFiles() {
    try {
      const files = fs.readdirSync(this.config.directory)
        .filter(f => f.startsWith(this.config.filename))
        .map(f => ({
          name: f,
          path: path.join(this.config.directory, f),
          mtime: fs.statSync(path.join(this.config.directory, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Keep only maxFiles
      files.slice(this.config.maxFiles).forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error('Failed to delete old log:', error.message);
        }
      });
    } catch (error) {
      console.error('Clean old files failed:', error.message);
    }
  }

  write(formattedEntry) {
    // Check if need to rotate
    const newFile = this.getCurrentLogFile();
    if (newFile !== this.currentFile) {
      this.currentFile = newFile;
    }

    if (this.shouldRotate()) {
      this.rotate();
    }

    try {
      fs.appendFileSync(this.currentFile, formattedEntry + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write log:', error.message);
    }
  }
}

/**
 * Enhanced Structured Logger
 */
class StructuredLogger {
  constructor(config = {}) {
    this.config = {
      level: config.level || 'INFO',
      transports: config.transports || [TRANSPORTS.CONSOLE, TRANSPORTS.FILE, TRANSPORTS.MEMORY],
      prettyPrint: config.prettyPrint !== undefined ? config.prettyPrint : (process.env.NODE_ENV === 'development'),
      includeStack: config.includeStack !== false,
      ...config
    };

    // Initialize transports
    this.memoryTransport = new MemoryTransport(1000);
    this.fileTransport = new FileTransport({
      directory: path.join(process.cwd(), 'logs'),
      filename: 'hooks',
      maxSizeMB: 100,
      maxFiles: 30
    });

    // Context inheritance
    this.inheritedContext = {};
  }

  /**
   * Create structured log entry with full context
   */
  createLogEntry(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: message,

      // Agent Context (from Agent Reality Map)
      agent: context.agent || this.inheritedContext.agent || {
        agent_id: context.agent_id || this.inheritedContext.agent_id || null,
        name: context.agent_name || this.inheritedContext.agent_name || 'unknown',
        role: context.agent_role || this.inheritedContext.agent_role || null,
        category: context.agent_category || this.inheritedContext.agent_category || null
      },

      // Execution Context
      execution: {
        correlation_id: context.correlation_id || this.inheritedContext.correlation_id || this.generateId(),
        session_id: context.session_id || this.inheritedContext.session_id || null,
        task_id: context.task_id || this.inheritedContext.task_id || null,
        operation: context.operation || null,
        target: context.target || null
      },

      // Performance Metrics
      metrics: { ...this.inheritedContext.metrics, ...context.metrics } || {},

      // RBAC Context
      rbac: context.rbac || null,

      // Quality Context
      quality: context.quality || null
    };

    // Add error details if present
    if (context.error) {
      entry.error = {
        name: context.error.name || 'Error',
        message: context.error.message || String(context.error),
        code: context.error.code || null,
        ...(this.config.includeStack && context.error.stack ? { stack: context.error.stack } : {})
      };
    }

    // Add custom metadata
    if (context.metadata) {
      entry.metadata = context.metadata;
    }

    return entry;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Check if should log based on level
   */
  shouldLog(level) {
    const configLevel = LOG_LEVELS[this.config.level.toUpperCase()] || LOG_LEVELS.INFO;
    const messageLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
    return messageLevel >= configLevel;
  }

  /**
   * Format log entry for output
   */
  formatLogEntry(entry) {
    if (this.config.prettyPrint) {
      return JSON.stringify(entry, null, 2);
    }
    return JSON.stringify(entry);
  }

  /**
   * Write to enabled transports
   */
  writeToTransports(entry, formatted) {
    const { transports } = this.config;

    // Console transport
    if (transports.includes(TRANSPORTS.CONSOLE)) {
      const colorized = this.colorizeConsole(entry.level, formatted);
      console.log(colorized);
    }

    // File transport
    if (transports.includes(TRANSPORTS.FILE)) {
      this.fileTransport.write(formatted);
    }

    // Memory transport
    if (transports.includes(TRANSPORTS.MEMORY)) {
      this.memoryTransport.write(entry);
    }

    // Database transport (for critical errors only)
    if (transports.includes(TRANSPORTS.DATABASE) && (entry.level === 'ERROR' || entry.level === 'FATAL')) {
      this.writeToDB(entry);
    }
  }

  /**
   * Colorize console output
   */
  colorizeConsole(level, message) {
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      FATAL: '\x1b[35m'  // Magenta
    };
    const reset = '\x1b[0m';
    return `${colors[level] || ''}${message}${reset}`;
  }

  /**
   * Write to database (placeholder for integration)
   */
  async writeToDB(entry) {
    // TODO: Integrate with backend database
    // For now, just write to a separate critical.log file
    const criticalLog = path.join(process.cwd(), 'logs', 'critical.log');
    try {
      fs.appendFileSync(criticalLog, JSON.stringify(entry) + '\n', 'utf8');
    } catch (error) {
      // Silent fail to avoid infinite loop
    }
  }

  /**
   * Main log method
   */
  log(level, message, context = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context);
    const formatted = this.formatLogEntry(entry);
    this.writeToTransports(entry, formatted);

    return entry;
  }

  /**
   * Convenience methods
   */
  debug(message, context = {}) {
    return this.log('DEBUG', message, context);
  }

  info(message, context = {}) {
    return this.log('INFO', message, context);
  }

  warn(message, context = {}) {
    return this.log('WARN', message, context);
  }

  error(message, context = {}) {
    return this.log('ERROR', message, context);
  }

  fatal(message, context = {}) {
    return this.log('FATAL', message, context);
  }

  /**
   * Create child logger with inherited context
   */
  withAgent(agentIdentity) {
    const child = new StructuredLogger(this.config);
    child.inheritedContext = {
      ...this.inheritedContext,
      agent: {
        agent_id: agentIdentity.agent_id,
        name: agentIdentity.name,
        role: agentIdentity.role,
        category: agentIdentity.category
      }
    };
    child.memoryTransport = this.memoryTransport;
    child.fileTransport = this.fileTransport;
    return child;
  }

  withCorrelationId(correlationId) {
    const child = new StructuredLogger(this.config);
    child.inheritedContext = {
      ...this.inheritedContext,
      correlation_id: correlationId
    };
    child.memoryTransport = this.memoryTransport;
    child.fileTransport = this.fileTransport;
    return child;
  }

  withMetrics(metrics) {
    const child = new StructuredLogger(this.config);
    child.inheritedContext = {
      ...this.inheritedContext,
      metrics: { ...this.inheritedContext.metrics, ...metrics }
    };
    child.memoryTransport = this.memoryTransport;
    child.fileTransport = this.fileTransport;
    return child;
  }

  withContext(context) {
    const child = new StructuredLogger(this.config);
    child.inheritedContext = {
      ...this.inheritedContext,
      ...context
    };
    child.memoryTransport = this.memoryTransport;
    child.fileTransport = this.fileTransport;
    return child;
  }

  /**
   * Query memory logs
   */
  queryLogs(filters = {}) {
    return this.memoryTransport.query(filters);
  }

  /**
   * Get memory stats
   */
  getStats() {
    return this.memoryTransport.getStats();
  }

  /**
   * Clear memory logs
   */
  clearMemory() {
    this.memoryTransport.clear();
  }
}

/**
 * Singleton instance
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
 * Convenience exports
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

function fatal(message, context) {
  return getLogger().fatal(message, context);
}

function queryLogs(filters) {
  return getLogger().queryLogs(filters);
}

function getStats() {
  return getLogger().getStats();
}

module.exports = {
  StructuredLogger,
  getLogger,
  debug,
  info,
  warn,
  error,
  fatal,
  queryLogs,
  getStats,
  LOG_LEVELS,
  TRANSPORTS
};
