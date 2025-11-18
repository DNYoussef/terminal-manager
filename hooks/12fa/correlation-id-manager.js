#!/usr/bin/env node

/**
 * Correlation ID Manager
 * Manages correlation IDs for request tracking across agent boundaries
 * Supports UUID v4 and custom formats
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Correlation ID formats
 */
const ID_FORMATS = {
  UUID_V4: 'uuid_v4',
  SHORT: 'short',
  PREFIXED: 'prefixed',
  CUSTOM: 'custom'
};

/**
 * Correlation ID Manager Class
 */
class CorrelationIdManager {
  constructor(config = {}) {
    this.config = {
      format: config.format || ID_FORMATS.UUID_V4,
      prefix: config.prefix || 'trace',
      memoryPath: config.memoryPath || path.join(process.cwd(), '.swarm', 'correlation.db'),
      ttlMs: config.ttlMs || 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };

    this.cache = new Map();
    this.loadFromMemory();
  }

  /**
   * Generate UUID v4
   */
  generateUuidV4() {
    return crypto.randomUUID();
  }

  /**
   * Generate short ID (12 chars)
   */
  generateShortId() {
    return crypto.randomBytes(6).toString('hex');
  }

  /**
   * Generate prefixed ID
   */
  generatePrefixedId() {
    const shortId = this.generateShortId();
    return `${this.config.prefix}-${shortId}`;
  }

  /**
   * Generate correlation ID based on format
   */
  generate(format) {
    const idFormat = format || this.config.format;

    switch (idFormat) {
      case ID_FORMATS.UUID_V4:
        return this.generateUuidV4();
      case ID_FORMATS.SHORT:
        return this.generateShortId();
      case ID_FORMATS.PREFIXED:
        return this.generatePrefixedId();
      default:
        return this.generateUuidV4();
    }
  }

  /**
   * Get or create correlation ID for context
   */
  getOrCreate(contextKey, format) {
    // Check cache first
    if (this.cache.has(contextKey)) {
      const cached = this.cache.get(contextKey);

      // Check if expired
      if (Date.now() - cached.timestamp < this.config.ttlMs) {
        return cached.id;
      }

      // Remove expired
      this.cache.delete(contextKey);
    }

    // Generate new ID
    const id = this.generate(format);

    // Store in cache
    this.cache.set(contextKey, {
      id,
      timestamp: Date.now()
    });

    // Persist to memory
    this.saveToMemory();

    return id;
  }

  /**
   * Get correlation ID if exists
   */
  get(contextKey) {
    if (this.cache.has(contextKey)) {
      const cached = this.cache.get(contextKey);

      // Check if expired
      if (Date.now() - cached.timestamp < this.config.ttlMs) {
        return cached.id;
      }

      // Remove expired
      this.cache.delete(contextKey);
    }

    return null;
  }

  /**
   * Set correlation ID for context
   */
  set(contextKey, correlationId) {
    this.cache.set(contextKey, {
      id: correlationId,
      timestamp: Date.now()
    });

    this.saveToMemory();
  }

  /**
   * Propagate correlation ID to child context
   */
  propagate(parentContextKey, childContextKey, generateIfMissing = true) {
    const parentId = this.get(parentContextKey);

    if (parentId) {
      this.set(childContextKey, parentId);
      return parentId;
    }

    if (generateIfMissing) {
      const newId = this.generate();
      this.set(parentContextKey, newId);
      this.set(childContextKey, newId);
      return newId;
    }

    return null;
  }

  /**
   * Create child span ID
   */
  createChildSpan(parentSpanId) {
    const childId = this.generateShortId();
    return {
      spanId: `${parentSpanId}.${childId}`,
      parentSpanId
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.config.ttlMs) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.saveToMemory();
    }

    return cleanedCount;
  }

  /**
   * Load correlation IDs from persistent memory
   */
  loadFromMemory() {
    try {
      if (fs.existsSync(this.config.memoryPath)) {
        const data = fs.readFileSync(this.config.memoryPath, 'utf8');
        const stored = JSON.parse(data);

        // Restore cache
        for (const [key, value] of Object.entries(stored)) {
          this.cache.set(key, value);
        }

        // Clean expired immediately after load
        this.cleanExpired();
      }
    } catch (error) {
      // Silent fail - will start fresh
      console.error('Failed to load correlation memory:', error.message);
    }
  }

  /**
   * Save correlation IDs to persistent memory
   */
  saveToMemory() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.config.memoryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert Map to object for JSON
      const stored = {};
      for (const [key, value] of this.cache.entries()) {
        stored[key] = value;
      }

      fs.writeFileSync(
        this.config.memoryPath,
        JSON.stringify(stored, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save correlation memory:', error.message);
    }
  }

  /**
   * Clear all correlation IDs
   */
  clear() {
    this.cache.clear();

    try {
      if (fs.existsSync(this.config.memoryPath)) {
        fs.unlinkSync(this.config.memoryPath);
      }
    } catch (error) {
      console.error('Failed to clear correlation memory:', error.message);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;

    for (const [, value] of this.cache.entries()) {
      if (now - value.timestamp < this.config.ttlMs) {
        activeCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      total: this.cache.size,
      active: activeCount,
      expired: expiredCount,
      ttlMs: this.config.ttlMs
    };
  }

  /**
   * Export correlation map for debugging
   */
  export() {
    const exported = {};

    for (const [key, value] of this.cache.entries()) {
      exported[key] = {
        ...value,
        expired: Date.now() - value.timestamp >= this.config.ttlMs
      };
    }

    return exported;
  }
}

/**
 * Create singleton instance
 */
let defaultManager = null;

function getManager(config) {
  if (config) {
    return new CorrelationIdManager(config);
  }

  if (!defaultManager) {
    defaultManager = new CorrelationIdManager();
  }

  return defaultManager;
}

/**
 * Convenience methods
 */
function generate(format) {
  return getManager().generate(format);
}

function getOrCreate(contextKey, format) {
  return getManager().getOrCreate(contextKey, format);
}

function get(contextKey) {
  return getManager().get(contextKey);
}

function set(contextKey, correlationId) {
  return getManager().set(contextKey, correlationId);
}

function propagate(parentContextKey, childContextKey, generateIfMissing) {
  return getManager().propagate(parentContextKey, childContextKey, generateIfMissing);
}

function createChildSpan(parentSpanId) {
  return getManager().createChildSpan(parentSpanId);
}

module.exports = {
  CorrelationIdManager,
  ID_FORMATS,
  getManager,
  generate,
  getOrCreate,
  get,
  set,
  propagate,
  createChildSpan
};
