/**
 * Permission Checker with In-Memory Cache
 * Provides fast RBAC permission validation with 1-minute TTL cache
 *
 * Performance target: <0.1ms for cached permission checks
 * Cache strategy: In-memory LRU with automatic expiration
 */

const crypto = require('crypto');

class PermissionCache {
  constructor(ttlMinutes = 1) {
    this.cache = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.maxSize = 1000; // LRU eviction threshold
  }

  /**
   * Generate cache key for permission check
   * @param {string} agentId - Agent identifier
   * @param {string} operation - Operation being checked (e.g., 'read:file', 'execute:bash')
   * @returns {string} Cache key
   */
  _getCacheKey(agentId, operation) {
    return `${agentId}:${operation}`;
  }

  /**
   * Get cached permission result
   * @param {string} agentId - Agent identifier
   * @param {string} operation - Operation being checked
   * @returns {boolean|null} Permission result or null if cache miss
   */
  get(agentId, operation) {
    const key = this._getCacheKey(agentId, operation);
    const entry = this.cache.get(key);

    if (!entry) {
      return null; // Cache miss
    }

    const now = Date.now();
    if (now >= entry.expiresAt) {
      // Expired - remove from cache
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.lastAccess = now;
    return entry.allowed;
  }

  /**
   * Set cached permission result
   * @param {string} agentId - Agent identifier
   * @param {string} operation - Operation being checked
   * @param {boolean} allowed - Permission result
   */
  set(agentId, operation, allowed) {
    const key = this._getCacheKey(agentId, operation);
    const now = Date.now();

    this.cache.set(key, {
      allowed,
      expiresAt: now + this.ttlMs,
      lastAccess: now
    });

    // LRU eviction if cache too large
    if (this.cache.size > this.maxSize) {
      this._evictOldest();
    }
  }

  /**
   * Invalidate cache for specific agent (e.g., after permission update)
   * @param {string} agentId - Agent identifier
   */
  invalidateAgent(agentId) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${agentId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let activeEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now >= entry.expiresAt) {
        expiredEntries++;
      } else {
        activeEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs
    };
  }

  /**
   * Evict oldest entries (LRU)
   * @private
   */
  _evictOldest() {
    const entriesToEvict = Math.floor(this.maxSize * 0.1); // Evict 10%
    const entries = Array.from(this.cache.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.lastAccess - b.lastAccess);

    for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
      this.cache.delete(entries[i].key);
    }
  }
}

// Global cache instance
const permissionCache = new PermissionCache(1); // 1-minute TTL

/**
 * Check if agent has permission for operation (with caching)
 * @param {string} agentId - Agent identifier
 * @param {string} operation - Operation to check
 * @param {object} rbacRules - RBAC rules for agent (from database/registry)
 * @returns {boolean} Whether operation is allowed
 */
function checkPermission(agentId, operation, rbacRules) {
  const startTime = process.hrtime.bigint();

  // Check cache first
  const cachedResult = permissionCache.get(agentId, operation);
  if (cachedResult !== null) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    console.log(`[PermissionCache] HIT for ${agentId}:${operation} (${durationMs.toFixed(3)}ms)`);
    return cachedResult;
  }

  // Cache miss - perform actual permission check
  const allowed = _performPermissionCheck(operation, rbacRules);

  // Store in cache
  permissionCache.set(agentId, operation, allowed);

  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1_000_000;
  console.log(`[PermissionCache] MISS for ${agentId}:${operation} (${durationMs.toFixed(3)}ms)`);

  return allowed;
}

/**
 * Actual permission checking logic (uncached)
 * @param {string} operation - Operation to check
 * @param {object} rbacRules - RBAC rules
 * @returns {boolean} Whether operation is allowed
 * @private
 */
function _performPermissionCheck(operation, rbacRules) {
  if (!rbacRules) {
    return false; // Default deny
  }

  const [action, resource] = operation.split(':');

  // Check allowed_tools
  if (rbacRules.allowed_tools) {
    if (rbacRules.allowed_tools.includes('*')) {
      return true; // Wildcard access
    }
    if (rbacRules.allowed_tools.includes(resource)) {
      return true;
    }
  }

  // Check path_scopes for file operations
  if (action === 'read' || action === 'write' || action === 'execute') {
    if (rbacRules.path_scopes) {
      // Simple prefix matching for demonstration
      // In production, use proper path resolution
      for (const scope of rbacRules.path_scopes) {
        if (resource.startsWith(scope)) {
          return true;
        }
      }
    }
  }

  // Check api_access for API operations
  if (action === 'api' && rbacRules.api_access) {
    if (rbacRules.api_access.includes('*')) {
      return true;
    }
    if (rbacRules.api_access.includes(resource)) {
      return true;
    }
  }

  return false; // Default deny
}

module.exports = {
  checkPermission,
  invalidateAgentPermissions: (agentId) => permissionCache.invalidateAgent(agentId),
  clearPermissionCache: () => permissionCache.clear(),
  getPermissionCacheStats: () => permissionCache.getStats(),
  permissionCache // Export for testing
};
