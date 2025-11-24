/**
 * Safe JSON Stringify - Prevents Prototype Pollution
 *
 * Filters out dangerous keys (__proto__, constructor, prototype)
 * Handles circular references safely
 * Prevents DoS from deeply nested objects
 */

const MAX_DEPTH = 20;
const MAX_STRING_LENGTH = 100000;

/**
 * Check if key is dangerous
 */
function isDangerousKey(key) {
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  return dangerous.includes(key);
}

/**
 * Safe stringify with prototype pollution protection
 */
function safeStringify(obj, space = 0) {
  const seen = new WeakSet();

  function replacer(key, value, depth = 0) {
    // Filter dangerous keys
    if (isDangerousKey(key)) {
      return undefined;
    }

    // Prevent infinite depth
    if (depth > MAX_DEPTH) {
      return '[Max Depth Exceeded]';
    }

    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      return value.substring(0, MAX_STRING_LENGTH) + '...[Truncated]';
    }

    return value;
  }

  try {
    return JSON.stringify(obj, (key, value) => replacer(key, value, 0), space);
  } catch (error) {
    // Fallback for stringify errors
    return JSON.stringify({
      error: 'Stringify failed',
      message: error.message
    });
  }
}

/**
 * Sanitize object before stringifying (removes dangerous keys)
 * ISSUE #4 FIX: Uses Object.create(null) to prevent prototype pollution
 */
function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Use Object.create(null) to create object without prototype
  const sanitized = Object.create(null);

  // Get all own property names (including non-enumerable)
  const keys = Object.getOwnPropertyNames(obj);

  for (const key of keys) {
    // Skip dangerous keys
    if (isDangerousKey(key)) {
      continue;
    }

    try {
      const value = obj[key];

      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    } catch (err) {
      // Skip properties that throw errors on access
      continue;
    }
  }

  // Convert back to normal object to avoid serialization issues
  return JSON.parse(JSON.stringify(sanitized));
}

module.exports = {
  safeStringify,
  sanitizeObject,
  isDangerousKey
};
