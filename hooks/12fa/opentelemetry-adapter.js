#!/usr/bin/env node

/**
 * OpenTelemetry Adapter
 * Adapter for OpenTelemetry export with span creation and trace context propagation
 * Compatible with OpenTelemetry specification
 */

const fs = require('fs');
const path = require('path');
const { getLogger } = require('./structured-logger');
const { getManager: getCorrelationManager } = require('./correlation-id-manager');

/**
 * Span Status codes (OpenTelemetry compatible)
 */
const SpanStatus = {
  UNSET: 0,
  OK: 1,
  ERROR: 2
};

/**
 * Span Kind (OpenTelemetry compatible)
 */
const SpanKind = {
  INTERNAL: 0,
  SERVER: 1,
  CLIENT: 2,
  PRODUCER: 3,
  CONSUMER: 4
};

/**
 * Trace Exporter types
 */
const ExporterType = {
  CONSOLE: 'console',
  FILE: 'file',
  HTTP: 'http',
  OTLP: 'otlp'
};

/**
 * OpenTelemetry Span class
 */
class Span {
  constructor(name, options = {}) {
    this.name = name;
    this.traceId = options.traceId || getCorrelationManager().generate();
    this.spanId = options.spanId || getCorrelationManager().generate('short');
    this.parentSpanId = options.parentSpanId || null;
    this.kind = options.kind || SpanKind.INTERNAL;
    this.startTime = Date.now();
    this.endTime = null;
    this.status = { code: SpanStatus.UNSET };
    this.attributes = options.attributes || {};
    this.events = [];
    this.links = options.links || [];
  }

  /**
   * Set attribute on span
   */
  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  /**
   * Set multiple attributes
   */
  setAttributes(attributes) {
    Object.assign(this.attributes, attributes);
    return this;
  }

  /**
   * Add event to span
   */
  addEvent(name, attributes = {}) {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
    return this;
  }

  /**
   * Set status
   */
  setStatus(code, message) {
    this.status = { code, message };
    return this;
  }

  /**
   * Record exception
   */
  recordException(error) {
    this.addEvent('exception', {
      'exception.type': error.name || 'Error',
      'exception.message': error.message,
      'exception.stacktrace': error.stack
    });
    this.setStatus(SpanStatus.ERROR, error.message);
    return this;
  }

  /**
   * End span
   */
  end(endTime) {
    this.endTime = endTime || Date.now();
    return this;
  }

  /**
   * Get duration in milliseconds
   */
  getDuration() {
    if (!this.endTime) {
      return null;
    }
    return this.endTime - this.startTime;
  }

  /**
   * Convert to OpenTelemetry format
   */
  toOTelFormat() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      startTimeUnixNano: this.startTime * 1000000,
      endTimeUnixNano: this.endTime ? this.endTime * 1000000 : null,
      status: this.status,
      attributes: this.attributes,
      events: this.events.map(e => ({
        ...e,
        timeUnixNano: e.timestamp * 1000000
      })),
      links: this.links
    };
  }

  /**
   * Convert to structured log format
   */
  toLogFormat() {
    return {
      trace_id: this.traceId,
      span_id: this.spanId,
      parent_span_id: this.parentSpanId,
      operation: this.name,
      duration_ms: this.getDuration(),
      status: this.status.code === SpanStatus.OK ? 'success' :
              this.status.code === SpanStatus.ERROR ? 'error' : 'unknown',
      ...this.attributes
    };
  }
}

/**
 * Trace Context Manager
 */
class TraceContext {
  constructor() {
    this.activeSpans = new Map();
    this.correlationManager = getCorrelationManager();
  }

  /**
   * Create root span
   */
  createSpan(name, options = {}) {
    const span = new Span(name, options);
    this.activeSpans.set(span.spanId, span);
    return span;
  }

  /**
   * Create child span
   */
  createChildSpan(parentSpan, name, options = {}) {
    const span = new Span(name, {
      ...options,
      traceId: parentSpan.traceId,
      parentSpanId: parentSpan.spanId
    });
    this.activeSpans.set(span.spanId, span);
    return span;
  }

  /**
   * Get active span
   */
  getActiveSpan(spanId) {
    return this.activeSpans.get(spanId);
  }

  /**
   * End span and remove from active
   */
  endSpan(span) {
    span.end();
    this.activeSpans.delete(span.spanId);
    return span;
  }

  /**
   * Extract trace context from headers (W3C Trace Context format)
   */
  extractFromHeaders(headers) {
    const traceparent = headers['traceparent'];

    if (!traceparent) {
      return null;
    }

    // Parse W3C traceparent: version-traceId-spanId-flags
    const parts = traceparent.split('-');

    if (parts.length !== 4) {
      return null;
    }

    return {
      traceId: parts[1],
      spanId: parts[2],
      flags: parts[3]
    };
  }

  /**
   * Inject trace context into headers (W3C Trace Context format)
   */
  injectIntoHeaders(span, headers = {}) {
    headers['traceparent'] = `00-${span.traceId}-${span.spanId}-01`;

    // Add tracestate if present
    if (span.attributes.tracestate) {
      headers['tracestate'] = span.attributes.tracestate;
    }

    return headers;
  }

  /**
   * Propagate context across agent boundaries
   */
  propagateContext(span, targetAgentId) {
    const contextKey = `agent-${targetAgentId}-trace`;
    this.correlationManager.set(contextKey, span.traceId);

    return {
      traceId: span.traceId,
      parentSpanId: span.spanId
    };
  }
}

/**
 * Trace Exporter
 */
class TraceExporter {
  constructor(config = {}) {
    this.config = {
      type: config.type || ExporterType.CONSOLE,
      endpoint: config.endpoint || null,
      outputFile: config.outputFile || path.join(process.cwd(), 'logs', 'traces.json'),
      batchSize: config.batchSize || 10,
      exportInterval: config.exportInterval || 5000,
      ...config
    };

    this.buffer = [];
    this.logger = getLogger();

    // Start batch export timer if needed
    if (this.config.batchSize > 1) {
      this.startBatchExport();
    }
  }

  /**
   * Export span
   */
  export(span) {
    const otelSpan = span.toOTelFormat();

    if (this.config.batchSize > 1) {
      this.buffer.push(otelSpan);

      if (this.buffer.length >= this.config.batchSize) {
        this.flush();
      }
    } else {
      this.exportSingle(otelSpan);
    }
  }

  /**
   * Export single span
   */
  exportSingle(otelSpan) {
    switch (this.config.type) {
      case ExporterType.CONSOLE:
        this.exportToConsole(otelSpan);
        break;
      case ExporterType.FILE:
        this.exportToFile(otelSpan);
        break;
      case ExporterType.HTTP:
      case ExporterType.OTLP:
        this.exportToHttp(otelSpan);
        break;
    }
  }

  /**
   * Export to console
   */
  exportToConsole(span) {
    this.logger.info('Trace span completed', span);
  }

  /**
   * Export to file
   */
  exportToFile(span) {
    try {
      const dir = path.dirname(this.config.outputFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.appendFileSync(
        this.config.outputFile,
        JSON.stringify(span) + '\n',
        'utf8'
      );
    } catch (error) {
      this.logger.error('Failed to export span to file', { error });
    }
  }

  /**
   * Export to HTTP endpoint
   */
  async exportToHttp(span) {
    if (!this.config.endpoint) {
      this.logger.warn('No HTTP endpoint configured for trace export');
      return;
    }

    try {
      // Note: Requires http/https module for actual implementation
      this.logger.debug('Would export to HTTP endpoint', {
        endpoint: this.config.endpoint,
        spanId: span.spanId
      });
    } catch (error) {
      this.logger.error('Failed to export span to HTTP', { error });
    }
  }

  /**
   * Flush buffered spans
   */
  flush() {
    if (this.buffer.length === 0) {
      return;
    }

    const spans = [...this.buffer];
    this.buffer = [];

    for (const span of spans) {
      this.exportSingle(span);
    }
  }

  /**
   * Start batch export timer
   */
  startBatchExport() {
    setInterval(() => {
      this.flush();
    }, this.config.exportInterval);
  }

  /**
   * Shutdown exporter
   */
  shutdown() {
    this.flush();
  }
}

/**
 * OpenTelemetry Adapter main class
 */
class OpenTelemetryAdapter {
  constructor(config = {}) {
    this.traceContext = new TraceContext();
    this.exporter = new TraceExporter(config);
    this.logger = getLogger();
  }

  /**
   * Start span
   */
  startSpan(name, options = {}) {
    const span = options.parent
      ? this.traceContext.createChildSpan(options.parent, name, options)
      : this.traceContext.createSpan(name, options);

    this.logger.debug('Span started', span.toLogFormat());
    return span;
  }

  /**
   * End span
   */
  endSpan(span) {
    this.traceContext.endSpan(span);

    if (span.status.code === SpanStatus.UNSET) {
      span.setStatus(SpanStatus.OK);
    }

    this.logger.info('Span completed', span.toLogFormat());
    this.exporter.export(span);

    return span;
  }

  /**
   * Execute function with automatic span
   */
  async trace(name, fn, options = {}) {
    const span = this.startSpan(name, options);

    try {
      const result = await fn(span);
      span.setStatus(SpanStatus.OK);
      return result;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      this.endSpan(span);
    }
  }

  /**
   * Get trace context
   */
  getContext() {
    return this.traceContext;
  }

  /**
   * Get exporter
   */
  getExporter() {
    return this.exporter;
  }

  /**
   * Shutdown adapter
   */
  shutdown() {
    this.exporter.shutdown();
  }
}

/**
 * Create singleton instance
 */
let defaultAdapter = null;

function getAdapter(config) {
  if (config) {
    return new OpenTelemetryAdapter(config);
  }

  if (!defaultAdapter) {
    defaultAdapter = new OpenTelemetryAdapter();
  }

  return defaultAdapter;
}

module.exports = {
  OpenTelemetryAdapter,
  Span,
  TraceContext,
  TraceExporter,
  SpanStatus,
  SpanKind,
  ExporterType,
  getAdapter
};
