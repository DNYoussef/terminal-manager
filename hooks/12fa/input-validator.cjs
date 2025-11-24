/**
 * Input Validation Middleware
 *
 * Validates and sanitizes all hook inputs to prevent:
 * - XSS attacks
 * - SQL injection
 * - Path traversal
 * - Command injection
 * - Data corruption
 */

const path = require('path');

// Validation rules
const RULES = {
  taskId: /^[a-zA-Z0-9\-_]{1,64}$/,
  agentId: /^[a-zA-Z0-9\-_]{1,64}$/,
  agentType: /^[a-zA-Z0-9\-_]{1,32}$/,
  sessionId: /^[a-zA-Z0-9\-_]{1,64}$/,
  traceId: /^[a-zA-Z0-9\-_]{1,128}$/,
  description: /^[\w\s\-.,!?()]{1,1000}$/,  // Alphanumeric + common punctuation
  fileName: /^[a-zA-Z0-9\-_.\/]{1,256}$/
};

// Allowed directories for file operations
const ALLOWED_DIRS = [
  '/src',
  '/tests',
  '/docs',
  '/scripts',
  '/config',
  '/logs',
  '/hooks'
];

/**
 * Sanitize string - remove special characters
 */
function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  // Remove control characters
  let sanitized = str.replace(/[\x00-\x1F\x7F]/g, '');

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate task ID
 */
function validateTaskId(taskId) {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('taskId is required and must be a string');
  }

  if (!RULES.taskId.test(taskId)) {
    throw new Error('Invalid taskId format. Only alphanumeric, hyphens, and underscores allowed (max 64 chars)');
  }

  return taskId;
}

/**
 * Validate agent ID/type
 */
function validateAgentId(agentId, fieldName = 'agentId') {
  if (!agentId || typeof agentId !== 'string') {
    throw new Error(`${fieldName} is required and must be a string`);
  }

  if (!RULES.agentId.test(agentId)) {
    throw new Error(`Invalid ${fieldName} format. Only alphanumeric, hyphens, and underscores allowed (max 64 chars)`);
  }

  return agentId;
}

/**
 * Validate agent type
 */
function validateAgentType(agentType) {
  const validTypes = [
    'coder', 'tester', 'reviewer', 'planner', 'researcher',
    'backend-dev', 'frontend-dev', 'database-design-specialist',
    'system-architect', 'cicd-engineer', 'orchestrator', 'unknown'
  ];

  if (!agentType || typeof agentType !== 'string') {
    throw new Error('agentType is required and must be a string');
  }

  const sanitized = sanitizeString(agentType, 32);

  if (!RULES.agentType.test(sanitized)) {
    throw new Error('Invalid agentType format');
  }

  // Warn if not in known types (but don't fail - allow extensibility)
  if (!validTypes.includes(sanitized)) {
    console.warn(`[Validator] Unknown agent type: ${sanitized}`);
  }

  return sanitized;
}

/**
 * Validate file path - prevent traversal
 */
function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath is required and must be a string');
  }

  // Normalize path
  const normalized = path.normalize(filePath);

  // Check for path traversal attempts
  if (normalized.includes('..')) {
    throw new Error('Path traversal detected in filePath');
  }

  // Check if path starts with allowed directory
  const isAllowed = ALLOWED_DIRS.some(dir =>
    normalized.startsWith(dir) ||
    normalized.startsWith(path.join(process.cwd(), dir))
  );

  if (!isAllowed) {
    throw new Error(`File path not in allowed directories. Must start with: ${ALLOWED_DIRS.join(', ')}`);
  }

  return normalized;
}

/**
 * Validate task context (used in post-task.hook.js)
 */
function validateTaskContext(context) {
  if (!context || typeof context !== 'object') {
    throw new Error('Context is required and must be an object');
  }

  const validated = {
    taskId: validateTaskId(context.taskId),
    agentId: context.agentId ? validateAgentId(context.agentId) : 'unknown',
    agentType: validateAgentType(context.agentType || 'unknown'),
    status: ['completed', 'success', 'failed', 'error'].includes(context.status)
      ? context.status
      : 'unknown',
    duration: typeof context.duration === 'number' ? Math.max(0, context.duration) : 0,
    error: context.error ? sanitizeString(context.error.toString(), 500) : null,
    output: context.output ? sanitizeString(context.output.toString(), 1000) : null,
    filesModified: Array.isArray(context.filesModified)
      ? context.filesModified.map(f => sanitizeString(f, 256)).slice(0, 100)
      : [],
    commandsExecuted: typeof context.commandsExecuted === 'number'
      ? Math.max(0, context.commandsExecuted)
      : 0
  };

  return validated;
}

/**
 * Validate edit context (used in post-edit.hook.js)
 */
function validateEditContext(context) {
  if (!context || typeof context !== 'object') {
    throw new Error('Context is required and must be an object');
  }

  const validated = {
    filePath: validateFilePath(context.filePath),
    agentId: context.agentId ? validateAgentId(context.agentId) : 'unknown',
    agentType: validateAgentType(context.agentType || 'unknown'),
    editType: ['create', 'modify', 'delete'].includes(context.editType)
      ? context.editType
      : 'modify',
    linesBefore: typeof context.linesBefore === 'number' ? Math.max(0, context.linesBefore) : 0,
    linesAfter: typeof context.linesAfter === 'number' ? Math.max(0, context.linesAfter) : 0,
    bytesBefore: typeof context.bytesBefore === 'number' ? Math.max(0, context.bytesBefore) : 0
  };

  return validated;
}

/**
 * Validate session context (used in session-end.hook.js)
 */
function validateSessionContext(context) {
  if (!context || typeof context !== 'object') {
    throw new Error('Context is required and must be an object');
  }

  const validated = {
    sessionId: context.sessionId && RULES.sessionId.test(context.sessionId)
      ? context.sessionId
      : `session-${Date.now()}`,
    sessionDuration: typeof context.sessionDuration === 'number'
      ? Math.max(0, context.sessionDuration)
      : 0
  };

  return validated;
}

module.exports = {
  sanitizeString,
  validateTaskId,
  validateAgentId,
  validateAgentType,
  validateFilePath,
  validateTaskContext,
  validateEditContext,
  validateSessionContext,
  ALLOWED_DIRS
};
