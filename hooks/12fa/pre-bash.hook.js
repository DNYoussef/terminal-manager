#!/usr/bin/env node

/**
 * Pre-Bash Hook
 * 12FA Quick Win #3: Bash Command Allowlist
 *
 * Intercepts bash commands before execution and validates against security policy.
 * Blocks dangerous commands while allowing safe development operations.
 *
 * Usage:
 *   This hook is automatically invoked before any Bash tool call in Claude Code.
 *
 * Environment Variables:
 *   CLAUDE_FLOW_AGENT_TYPE - Agent type for policy overrides
 *   CLAUDE_FLOW_POLICY - Override default policy (strict|moderate|permissive)
 *   CLAUDE_FLOW_POLICY_FILE - Custom policy file path
 */

const validator = require('./bash-validator');
const fs = require('fs');
const path = require('path');
const { getLogger } = require('./structured-logger');
const { getOrCreate } = require('./correlation-id-manager');
const { getAdapter } = require('./opentelemetry-adapter');

// Initialize structured logger and telemetry
const logger = getLogger();
const otelAdapter = getAdapter();

/**
 * Main hook execution
 */
async function preBashHook(context) {
  const startTime = Date.now();

  // Generate or retrieve correlation ID
  const correlationId = getOrCreate('pre-bash-hook', 'prefixed');

  // Start OpenTelemetry span
  const span = otelAdapter.startSpan('pre-bash-hook', {
    attributes: {
      'hook.type': 'pre-bash',
      'agent.id': context?.agentId || 'unknown',
      'command.length': (context?.command || '').length
    }
  });

  try {
    logger.info('Pre-bash hook started', {
      trace_id: correlationId,
      span_id: span.spanId,
      agent_id: context?.agentId,
      operation: 'pre-bash-validation'
    });

    // Load policy
    const policyFile = process.env.CLAUDE_FLOW_POLICY_FILE || null;
    const loadResult = validator.loadPolicy(policyFile);

    logger.debug('Policy loaded', {
      trace_id: correlationId,
      span_id: span.spanId,
      policy_file: loadResult.policyFile,
      version: loadResult.version,
      default_policy: loadResult.defaultPolicy
    });

    // Set agent type if provided
    const agentType = process.env.CLAUDE_FLOW_AGENT_TYPE ||
                     context?.agentType ||
                     'unknown';

    validator.setAgentType(agentType);
    span.setAttribute('agent.type', agentType);

    logger.debug('Agent type configured', {
      trace_id: correlationId,
      span_id: span.spanId,
      agent_type: agentType
    });

    // Override policy if specified
    if (process.env.CLAUDE_FLOW_POLICY) {
      validator.activePolicy = process.env.CLAUDE_FLOW_POLICY;
      span.setAttribute('policy.override', validator.activePolicy);

      logger.info('Policy override applied', {
        trace_id: correlationId,
        span_id: span.spanId,
        policy_override: validator.activePolicy
      });
    }

    // Extract command from context
    const command = context?.command || context?.bashCommand || '';

    if (!command) {
      logger.error('No command provided to validate', {
        trace_id: correlationId,
        span_id: span.spanId,
        status: 'error'
      });

      span.setStatus(2, 'No command provided');
      otelAdapter.endSpan(span);

      return {
        success: false,
        error: 'No command provided to validate',
        timestamp: new Date().toISOString(),
        trace_id: correlationId
      };
    }

    span.setAttribute('command.preview', command.substring(0, 100));

    logger.info('Validating bash command', {
      trace_id: correlationId,
      span_id: span.spanId,
      command_length: command.length,
      command_preview: command.substring(0, 100)
    });

    // Validate command
    const validation = validator.validate(command);

    if (!validation.valid) {
      // Command is blocked
      logger.warn('Command blocked by security policy', {
        trace_id: correlationId,
        span_id: span.spanId,
        validation_message: validation.message,
        policy: validation.policy,
        blocked_reason: validation.reason
      });

      span.setAttribute('validation.result', 'blocked');
      span.addEvent('command-blocked', {
        reason: validation.reason,
        policy: validation.policy
      });

      // Check if violation rate is high
      if (validator.isViolationRateHigh()) {
        logger.error('High violation rate detected', {
          trace_id: correlationId,
          span_id: span.spanId,
          severity: 'high',
          alert_type: 'security_incident'
        });

        span.addEvent('high-violation-rate', {
          'alert.severity': 'high',
          'incident.type': 'security'
        });
      }

      // Export metrics
      validator.exportMetrics();

      const duration = Date.now() - startTime;
      span.setAttribute('duration_ms', duration);
      otelAdapter.endSpan(span);

      return {
        success: false,
        blocked: true,
        violation: validation,
        executionTime: duration,
        timestamp: new Date().toISOString(),
        trace_id: correlationId,
        span_id: span.spanId
      };
    }

    // Command is allowed
    logger.info('Command validated successfully', {
      trace_id: correlationId,
      span_id: span.spanId,
      policy: validation.policy,
      validation_time: validation.validationTime
    });

    span.setAttribute('validation.result', 'allowed');
    span.setAttribute('validation.policy', validation.policy);
    span.addEvent('command-allowed');

    // Store validation result in memory for audit
    if (context?.memoryStore) {
      await context.memoryStore({
        key: `12fa/validations/${Date.now()}`,
        value: JSON.stringify({
          ...validation,
          trace_id: correlationId,
          span_id: span.spanId
        })
      });
    }

    const duration = Date.now() - startTime;
    span.setAttribute('duration_ms', duration);
    otelAdapter.endSpan(span);

    return {
      success: true,
      allowed: true,
      validation,
      executionTime: duration,
      timestamp: new Date().toISOString(),
      trace_id: correlationId,
      span_id: span.spanId
    };

  } catch (error) {
    logger.error('Hook execution failed', {
      trace_id: correlationId,
      span_id: span.spanId,
      error: error.message,
      status: 'error'
    });

    span.recordException(error);
    otelAdapter.endSpan(span);

    // Fail-secure: block command on error
    return {
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      trace_id: correlationId,
      span_id: span.spanId
    };
  }
}

/**
 * CLI interface for testing
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: pre-bash.hook.js <command>');
    console.log('\nExample:');
    console.log('  node pre-bash.hook.js "ls -la"');
    console.log('  node pre-bash.hook.js "rm -rf /"');
    console.log('\nEnvironment Variables:');
    console.log('  CLAUDE_FLOW_AGENT_TYPE - Set agent type (e.g., researcher, coder)');
    console.log('  CLAUDE_FLOW_POLICY - Override policy (strict|moderate|permissive)');
    console.log('  CLAUDE_FLOW_POLICY_FILE - Custom policy file path');
    process.exit(1);
  }

  const command = args.join(' ');

  const context = {
    command,
    agentType: process.env.CLAUDE_FLOW_AGENT_TYPE,
    timestamp: new Date().toISOString()
  };

  const result = await preBashHook(context);

  console.log('\n' + '='.repeat(80));
  console.log('RESULT:', JSON.stringify(result, null, 2));
  console.log('='.repeat(80));

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use as module
module.exports = preBashHook;
