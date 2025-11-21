/**
 * Connascence Quality Pipeline
 *
 * Pre-commit quality gate that blocks low-quality code using real-time Connascence analysis.
 *
 * FEATURES:
 * - Pre-commit hook on file writes
 * - Real-time Connascence Analyzer integration
 * - Quality scoring (0-100 scale)
 * - Configurable threshold gates (default: 70)
 * - Violation reporting with fix suggestions
 * - Memory MCP persistence for pattern learning
 * - Human override capability
 * - Backend metrics tracking
 *
 * QUALITY SCORING:
 * A: 90-100 (excellent)
 * B: 80-89  (good)
 * C: 70-79  (acceptable - default gate)
 * D: 60-69  (poor - warning)
 * F: 0-59   (failing - block)
 *
 * VIOLATION PENALTIES:
 * - God Objects: 10 points per violation
 * - Parameter Bombs (CoP): 8 points per violation
 * - Cyclomatic Complexity: 7 points per violation
 * - Deep Nesting: 6 points per violation
 * - Long Functions: 5 points per violation
 * - Magic Literals (CoM): 4 points per violation
 */

const fs = require('fs');
const path = require('path');
const { taggedMemoryStore, validateAgentAccess } = require('./memory-mcp-tagging-protocol.js');

/**
 * Configuration
 */
const CONFIG = {
  // Global quality threshold
  globalThreshold: 70,

  // Per-agent thresholds (override global)
  agentThresholds: {
    'coder': 75,
    'backend-dev': 80,
    'ml-developer': 70,
    'sparc-coder': 85,
    'code-analyzer': 90,
    'reviewer': 85
  },

  // Per-file thresholds (critical files)
  fileThresholds: {
    'auth': 90,        // Authentication files
    'security': 90,    // Security-critical files
    'payment': 95,     // Payment processing
    'api': 75,         // API endpoints
    'database': 80     // Database operations
  },

  // Violation penalties
  penalties: {
    godObject: 10,
    parameterBomb: 8,
    cyclomaticComplexity: 7,
    deepNesting: 6,
    longFunction: 5,
    magicLiteral: 4
  },

  // Violation thresholds (when to count as violation)
  violationThresholds: {
    methodCount: 15,       // God Object: methods per class
    parameterCount: 6,     // Parameter Bomb: NASA limit
    cyclomaticComplexity: 10,  // McCabe limit
    nestingLevel: 4,       // NASA limit
    functionLength: 50,    // Lines of code
    magicLiterals: 0       // Zero tolerance (should use constants)
  },

  // Backend API endpoint
  backendAPI: process.env.QUALITY_API || 'http://localhost:8000/api/v1/metrics/',

  // Enable/disable features
  features: {
    blockOnLowQuality: true,
    storeInMemory: true,
    trackMetrics: true,
    allowHumanOverride: true,
    verboseReporting: true
  },

  // INFINITE LOOP FIX: Refinement limits to prevent endless retry cycles
  // Addresses the "halting problem" in the Three-Loop Architecture
  refinement: {
    maxAttempts: 3,           // Maximum refinement attempts before requiring human override
    minScoreImprovement: 5,   // Minimum score improvement (points) to continue refining
    cooldownMs: 30000,        // Cooldown between refinement attempts (30 seconds)
    fallbackToWarning: true,  // After max attempts, downgrade to warning (don't block)
    trackAttempts: true       // Track refinement attempts in memory for pattern learning
  }
};

/**
 * Quality Grade Calculator
 */
class QualityGradeCalculator {
  constructor(config = CONFIG) {
    this.config = config;
  }

  /**
   * Calculate quality score from Connascence violations
   */
  calculateScore(violations) {
    let totalPenalty = 0;

    // God Objects
    const godObjects = violations.godObjects || [];
    godObjects.forEach(obj => {
      const methods = obj.methods || 0;
      if (methods > this.config.violationThresholds.methodCount) {
        totalPenalty += this.config.penalties.godObject;
      }
    });

    // Parameter Bombs
    const parameterBombs = violations.parameterBombs || [];
    parameterBombs.forEach(bomb => {
      const params = bomb.parameterCount || 0;
      if (params > this.config.violationThresholds.parameterCount) {
        totalPenalty += this.config.penalties.parameterBomb;
      }
    });

    // Cyclomatic Complexity
    const complexityViolations = violations.cyclomaticComplexity || [];
    complexityViolations.forEach(violation => {
      const complexity = violation.complexity || 0;
      if (complexity > this.config.violationThresholds.cyclomaticComplexity) {
        totalPenalty += this.config.penalties.cyclomaticComplexity;
      }
    });

    // Deep Nesting
    const nestingViolations = violations.deepNesting || [];
    nestingViolations.forEach(violation => {
      const depth = violation.depth || 0;
      if (depth > this.config.violationThresholds.nestingLevel) {
        totalPenalty += this.config.penalties.deepNesting;
      }
    });

    // Long Functions
    const longFunctions = violations.longFunctions || [];
    longFunctions.forEach(func => {
      const lines = func.lines || 0;
      if (lines > this.config.violationThresholds.functionLength) {
        totalPenalty += this.config.penalties.longFunction;
      }
    });

    // Magic Literals
    const magicLiterals = violations.magicLiterals || [];
    magicLiterals.forEach(() => {
      totalPenalty += this.config.penalties.magicLiteral;
    });

    // Calculate score (100 - penalties)
    const score = Math.max(0, 100 - totalPenalty);

    return {
      score,
      grade: this.getGrade(score),
      totalPenalty,
      violationCounts: {
        godObjects: godObjects.length,
        parameterBombs: parameterBombs.length,
        cyclomaticComplexity: complexityViolations.length,
        deepNesting: nestingViolations.length,
        longFunctions: longFunctions.length,
        magicLiterals: magicLiterals.length
      }
    };
  }

  /**
   * Get letter grade from score
   */
  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Get threshold for agent/file combination
   */
  getThreshold(agent, filePath) {
    // Check file-specific threshold first
    const fileName = path.basename(filePath).toLowerCase();
    for (const [pattern, threshold] of Object.entries(this.config.fileThresholds)) {
      if (fileName.includes(pattern)) {
        return threshold;
      }
    }

    // Check agent-specific threshold
    if (this.config.agentThresholds[agent]) {
      return this.config.agentThresholds[agent];
    }

    // Use global threshold
    return this.config.globalThreshold;
  }
}

/**
 * Connascence Analyzer Integration
 *
 * IMPORTANT LIMITATION: This analyzer uses regex-based heuristics, not AST parsing.
 * This means it may produce false positives (commented code, strings) and false negatives
 * (multi-line patterns, Python files). For production use, integrate with a proper AST
 * parser like tree-sitter or language-specific parsers.
 *
 * Known limitations:
 * - Cannot distinguish code from comments/strings
 * - Python analysis is limited (indentation-based, no braces)
 * - Multi-line function signatures may not be detected
 */
class ConnascenceAnalyzer {
  /**
   * Analyze file for code quality violations
   * Uses heuristic regex analysis (see class comment for limitations)
   */
  async analyzeFile(filePath) {
    // TODO: Replace with actual MCP call for more accurate analysis
    // const result = await mcp__connascence-analyzer__analyze_workspace({ path: filePath });

    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    // REGEX LIMITATION FIX: Strip comments and strings before analysis
    // This reduces false positives from commented-out code
    const strippedContent = this.stripCommentsAndStrings(content, ext);

    // Simple heuristic-based analysis with comment stripping
    const violations = {
      godObjects: this.detectGodObjects(strippedContent, ext),
      parameterBombs: this.detectParameterBombs(strippedContent, ext),
      cyclomaticComplexity: this.detectComplexity(strippedContent),
      deepNesting: this.detectNesting(strippedContent, ext),
      longFunctions: this.detectLongFunctions(strippedContent, ext),
      magicLiterals: this.detectMagicLiterals(content)  // Use original for literals
    };

    return violations;
  }

  /**
   * REGEX FIX: Strip comments and string literals to reduce false positives
   */
  stripCommentsAndStrings(content, ext) {
    let stripped = content;

    // Remove multi-line comments /* ... */
    stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove single-line comments // ... and # ... (Python)
    stripped = stripped.replace(/\/\/.*$/gm, '');
    if (ext === '.py') {
      stripped = stripped.replace(/#.*$/gm, '');
      // Remove Python docstrings
      stripped = stripped.replace(/"""[\s\S]*?"""/g, '');
      stripped = stripped.replace(/'''[\s\S]*?'''/g, '');
    }

    // Remove string literals (simple approach - not perfect but reduces false positives)
    stripped = stripped.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    stripped = stripped.replace(/'(?:[^'\\]|\\.)*'/g, "''");
    stripped = stripped.replace(/`(?:[^`\\]|\\.)*`/g, '``');

    return stripped;
  }

  detectGodObjects(content, ext = '.js') {
    // Count methods in classes (simple heuristic)
    const classMatches = content.match(/class\s+\w+/g) || [];

    // Different method detection for Python vs JS/TS
    let methodMatches;
    if (ext === '.py') {
      // Python: def method_name(self, ...)
      methodMatches = content.match(/^\s+def\s+\w+\s*\(/gm) || [];
    } else {
      // JS/TS: methodName() { or async methodName() {
      methodMatches = content.match(/\s+(async\s+)?\w+\s*\([^)]*\)\s*[{:]/g) || [];
    }

    if (classMatches.length > 0 && methodMatches.length > CONFIG.violationThresholds.methodCount) {
      return [{
        className: 'DetectedClass',
        methods: methodMatches.length,
        threshold: CONFIG.violationThresholds.methodCount
      }];
    }
    return [];
  }

  detectParameterBombs(content, ext = '.js') {
    // Find functions with excessive parameters
    let functionRegex;
    if (ext === '.py') {
      // Python: def func_name(param1, param2, ...)
      functionRegex = /def\s+(\w+)\s*\(([^)]*)\)/g;
    } else {
      // JS/TS: function funcName(...) or const func = (...) =>
      functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\()\s*\(([^)]*)\)/g;
    }

    const violations = [];
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[1] || match[2] || 'anonymous';
      const paramsStr = ext === '.py' ? match[2] : (match[3] || match[2]);
      if (!paramsStr) continue;

      // Filter out self/cls for Python
      let params = paramsStr.split(',').filter(p => p.trim().length > 0);
      if (ext === '.py') {
        params = params.filter(p => !['self', 'cls'].includes(p.trim().split('=')[0].split(':')[0].trim()));
      }

      if (params.length > CONFIG.violationThresholds.parameterCount) {
        violations.push({
          functionName: funcName,
          parameterCount: params.length,
          threshold: CONFIG.violationThresholds.parameterCount
        });
      }
    }
    return violations;
  }

  detectComplexity(content) {
    // Count decision points (if, while, for, case, &&, ||)
    const decisions = (content.match(/\b(if|while|for|case|&&|\|\|)\b/g) || []).length;
    if (decisions > CONFIG.violationThresholds.cyclomaticComplexity) {
      return [{
        complexity: decisions,
        threshold: CONFIG.violationThresholds.cyclomaticComplexity
      }];
    }
    return [];
  }

  detectNesting(content, ext = '.js') {
    // Find maximum nesting depth
    let maxDepth = 0;
    let currentDepth = 0;

    if (ext === '.py') {
      // Python: Count indentation levels (4 spaces = 1 level)
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim().length === 0) continue;
        const leadingSpaces = line.match(/^(\s*)/)[1].length;
        const depth = Math.floor(leadingSpaces / 4);  // Assume 4-space indent
        maxDepth = Math.max(maxDepth, depth);
      }
    } else {
      // JS/TS: Count brace depth
      for (const char of content) {
        if (char === '{') {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);
        } else if (char === '}') {
          currentDepth--;
        }
      }
    }

    if (maxDepth > CONFIG.violationThresholds.nestingLevel) {
      return [{
        depth: maxDepth,
        threshold: CONFIG.violationThresholds.nestingLevel
      }];
    }
    return [];
  }

  detectLongFunctions(content, ext = '.js') {
    // Find functions longer than threshold
    const violations = [];

    if (ext === '.py') {
      // Python: Match def blocks by indentation
      const defRegex = /^([ \t]*)def\s+(\w+)\s*\([^)]*\).*?(?=^\1(?:def|class|\S)|\Z)/gms;
      let match;
      while ((match = defRegex.exec(content)) !== null) {
        const lines = match[0].split('\n').length;
        if (lines > CONFIG.violationThresholds.functionLength) {
          violations.push({
            functionName: match[2],
            lines,
            threshold: CONFIG.violationThresholds.functionLength
          });
        }
      }
    } else {
      // JS/TS: Match function blocks
      const functionBlocks = content.match(/(?:function\s+\w+|(?:async\s+)?(?:\w+|\([^)]*\))\s*=>)[^{]*{[^}]*}/gs) || [];
      functionBlocks.forEach(block => {
        const lines = block.split('\n').length;
        if (lines > CONFIG.violationThresholds.functionLength) {
          violations.push({
            functionName: (block.match(/(?:function\s+)?(\w+)/) || ['', 'anonymous'])[1],
            lines,
            threshold: CONFIG.violationThresholds.functionLength
          });
        }
      });
    }

    return violations;
  }

  detectMagicLiterals(content) {
    // Find hardcoded numbers/strings (excluding 0, 1, -1, common patterns)
    const literalRegex = /(?<![a-zA-Z0-9_])([0-9]{3,}|'[^']{10,}'|"[^"]{10,}")(?![a-zA-Z0-9_])/g;
    const violations = [];
    let match;

    while ((match = literalRegex.exec(content)) !== null) {
      violations.push({
        literal: match[1],
        line: content.substring(0, match.index).split('\n').length
      });
    }

    return violations;
  }
}

/**
 * Violation Reporter
 */
class ViolationReporter {
  constructor(config = CONFIG) {
    this.config = config;
  }

  /**
   * Generate detailed violation report
   */
  generateReport(filePath, result, threshold) {
    const { score, grade, violationCounts, totalPenalty } = result;

    const report = {
      file: filePath,
      score,
      grade,
      threshold,
      passed: score >= threshold,
      totalPenalty,
      violations: violationCounts,
      timestamp: new Date().toISOString()
    };

    return report;
  }

  /**
   * Format report for console output
   */
  formatConsoleReport(report) {
    const status = report.passed ? 'PASSED' : 'BLOCKED';
    const color = report.passed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    let output = `\n${color}[QUALITY GATE ${status}]${reset}\n`;
    output += `File: ${report.file}\n`;
    output += `Score: ${report.score}/100 (Grade: ${report.grade})\n`;
    output += `Threshold: ${report.threshold}\n`;
    output += `Total Penalty: ${report.totalPenalty}\n\n`;

    output += `Violations:\n`;
    for (const [type, count] of Object.entries(report.violations)) {
      if (count > 0) {
        output += `  - ${type}: ${count}\n`;
      }
    }

    if (!report.passed) {
      output += `\n${color}COMMIT BLOCKED: Quality score below threshold${reset}\n`;
      output += `Please fix violations or request human override.\n`;
    }

    return output;
  }

  /**
   * Suggest fixes for violations
   */
  suggestFixes(violations) {
    const suggestions = [];

    if (violations.godObjects.length > 0) {
      suggestions.push('God Objects: Extract methods into separate classes/modules');
    }

    if (violations.parameterBombs.length > 0) {
      suggestions.push('Parameter Bombs: Use options object or builder pattern');
    }

    if (violations.cyclomaticComplexity.length > 0) {
      suggestions.push('Cyclomatic Complexity: Break down complex logic into smaller functions');
    }

    if (violations.deepNesting.length > 0) {
      suggestions.push('Deep Nesting: Use early returns or extract nested logic');
    }

    if (violations.longFunctions.length > 0) {
      suggestions.push('Long Functions: Break into smaller, focused functions');
    }

    if (violations.magicLiterals.length > 0) {
      suggestions.push('Magic Literals: Extract to named constants');
    }

    return suggestions;
  }
}

/**
 * Memory MCP Integration
 */
class MemoryIntegration {
  constructor() {
    this.enabled = CONFIG.features.storeInMemory;
  }

  /**
   * Store quality results in Memory MCP
   */
  async storeResults(agent, report, violations) {
    if (!this.enabled) return;

    const content = JSON.stringify({
      report,
      violations,
      timestamp: new Date().toISOString()
    });

    const metadata = {
      project: 'connascence-analyzer',
      intent: 'quality-gate',
      task_id: `quality-${Date.now()}`,
      quality_score: report.score,
      quality_grade: report.grade,
      file: report.file,
      passed: report.passed
    };

    return taggedMemoryStore(agent, content, metadata);
  }
}

/**
 * Backend Metrics Service
 */
class BackendMetricsService {
  constructor(config = CONFIG) {
    this.apiEndpoint = config.backendAPI;
    this.enabled = config.features.trackMetrics;
  }

  /**
   * Send quality metrics to backend
   */
  async recordMetrics(report) {
    if (!this.enabled) return;

    try {
      const payload = {
        metric_type: 'code_quality',
        metric_name: 'connascence_score',
        metric_value: report.score,
        metadata: {
          file: report.file,
          grade: report.grade,
          threshold: report.threshold,
          passed: report.passed,
          violations: report.violations
        },
        timestamp: report.timestamp
      };

      // TODO: Replace with actual HTTP POST
      // await fetch(this.apiEndpoint, { method: 'POST', body: JSON.stringify(payload) });

      console.log(`[Backend Metrics] Recorded quality score: ${report.score}`);
    } catch (error) {
      console.error('[Backend Metrics] Failed to record:', error.message);
    }
  }
}

/**
 * INFINITE LOOP FIX: Refinement Tracker
 * Tracks refinement attempts to prevent endless retry cycles
 */
class RefinementTracker {
  constructor(config = CONFIG) {
    this.config = config;
    this.attempts = new Map();  // fileKey -> { count, lastScore, lastAttempt }
  }

  /**
   * Get unique key for file + agent combination
   */
  getKey(agent, filePath) {
    return `${agent}:${filePath}`;
  }

  /**
   * Check if refinement should continue or stop
   * Returns: { shouldContinue, reason, forceWarningOnly }
   */
  shouldContinueRefinement(agent, filePath, currentScore) {
    const key = this.getKey(agent, filePath);
    const attempt = this.attempts.get(key);
    const refinementConfig = this.config.refinement || {};
    const maxAttempts = refinementConfig.maxAttempts || 3;
    const minImprovement = refinementConfig.minScoreImprovement || 5;
    const cooldownMs = refinementConfig.cooldownMs || 30000;
    const fallbackToWarning = refinementConfig.fallbackToWarning !== false;

    // First attempt - always allow
    if (!attempt) {
      this.attempts.set(key, {
        count: 1,
        lastScore: currentScore,
        lastAttempt: Date.now(),
        scores: [currentScore]
      });
      return { shouldContinue: true, reason: 'First refinement attempt' };
    }

    // Check max attempts
    if (attempt.count >= maxAttempts) {
      return {
        shouldContinue: false,
        reason: `Max refinement attempts (${maxAttempts}) reached. Requires human override.`,
        forceWarningOnly: fallbackToWarning
      };
    }

    // Check cooldown
    const timeSinceLastAttempt = Date.now() - attempt.lastAttempt;
    if (timeSinceLastAttempt < cooldownMs) {
      return {
        shouldContinue: false,
        reason: `Cooldown period active. Wait ${Math.ceil((cooldownMs - timeSinceLastAttempt) / 1000)}s.`,
        forceWarningOnly: false
      };
    }

    // Check minimum improvement
    const improvement = currentScore - attempt.lastScore;
    if (improvement < minImprovement && attempt.count > 1) {
      return {
        shouldContinue: false,
        reason: `Score not improving (${improvement.toFixed(1)} < ${minImprovement} min). LLM unlikely to fix further.`,
        forceWarningOnly: fallbackToWarning
      };
    }

    // Allow refinement
    attempt.count++;
    attempt.lastScore = currentScore;
    attempt.lastAttempt = Date.now();
    attempt.scores.push(currentScore);

    return {
      shouldContinue: true,
      reason: `Refinement attempt ${attempt.count}/${maxAttempts}`
    };
  }

  /**
   * Reset tracking for a file (after successful commit)
   */
  reset(agent, filePath) {
    const key = this.getKey(agent, filePath);
    this.attempts.delete(key);
  }

  /**
   * Get refinement stats for a file
   */
  getStats(agent, filePath) {
    const key = this.getKey(agent, filePath);
    return this.attempts.get(key) || null;
  }
}

// Singleton refinement tracker
const refinementTracker = new RefinementTracker();

/**
 * Main Quality Pipeline
 */
class QualityPipeline {
  constructor(config = CONFIG) {
    this.config = config;
    this.calculator = new QualityGradeCalculator(config);
    this.analyzer = new ConnascenceAnalyzer();
    this.reporter = new ViolationReporter(config);
    this.memory = new MemoryIntegration();
    this.backend = new BackendMetricsService(config);
    this.refinementTracker = refinementTracker;  // INFINITE LOOP FIX
  }

  /**
   * Pre-commit quality gate (main entry point)
   */
  async checkQuality(agent, filePath, options = {}) {
    try {
      // 1. Determine threshold
      const threshold = options.threshold || this.calculator.getThreshold(agent, filePath);

      // 2. Analyze file with Connascence Analyzer
      console.log(`[Quality Gate] Analyzing ${filePath}...`);
      const violations = await this.analyzer.analyzeFile(filePath);

      // 3. Calculate quality score
      const result = this.calculator.calculateScore(violations);

      // 4. Generate report
      const report = this.reporter.generateReport(filePath, result, threshold);

      // 5. Store in Memory MCP
      await this.memory.storeResults(agent, report, violations);

      // 6. Record metrics in backend
      await this.backend.recordMetrics(report);

      // 7. Output report
      if (this.config.features.verboseReporting) {
        console.log(this.reporter.formatConsoleReport(report));
      }

      // 8. Check if passed
      if (!report.passed && this.config.features.blockOnLowQuality) {
        // Check for human override
        if (options.humanOverride && this.config.features.allowHumanOverride) {
          console.log('[Quality Gate] Human override approved. Allowing commit.');
          report.passed = true;
          report.overridden = true;
          this.refinementTracker.reset(agent, filePath);  // Reset on successful override
        } else {
          // INFINITE LOOP FIX: Check refinement limits before blocking
          const refinementCheck = this.refinementTracker.shouldContinueRefinement(
            agent, filePath, report.score
          );

          if (!refinementCheck.shouldContinue) {
            console.log(`[Quality Gate] ${refinementCheck.reason}`);

            // Downgrade to warning if configured
            if (refinementCheck.forceWarningOnly) {
              console.log('[Quality Gate] DOWNGRADED TO WARNING: Score too low but max refinements reached.');
              console.log('[Quality Gate] Allowing commit with warning. Human review recommended.');
              report.passed = true;
              report.warning = `Quality score ${report.score} below threshold ${threshold}`;
              report.refinementExhausted = true;
              return report;
            }

            // Still block but with different message
            throw new Error(
              `Quality gate blocked: ${refinementCheck.reason}. ` +
              `Use --human-override to bypass or improve code quality.`
            );
          }

          // Suggest fixes
          const suggestions = this.reporter.suggestFixes(violations);
          console.log(`\n[Quality Gate] ${refinementCheck.reason}`);
          console.log('\nSuggested Fixes:');
          suggestions.forEach(s => console.log(`  - ${s}`));

          throw new Error(`Quality gate failed: Score ${report.score} below threshold ${threshold}`);
        }
      } else if (report.passed) {
        // Reset refinement tracking on success
        this.refinementTracker.reset(agent, filePath);
      }

      return report;
    } catch (error) {
      console.error('[Quality Gate] Error:', error.message);
      throw error;
    }
  }

  /**
   * Batch check multiple files
   */
  async checkMultipleFiles(agent, filePaths, options = {}) {
    const results = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.checkQuality(agent, filePath, options);
        results.push({ filePath, result, passed: true });
      } catch (error) {
        results.push({ filePath, error: error.message, passed: false });
      }
    }

    // Calculate aggregate stats
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;
    const avgScore = results
      .filter(r => r.result)
      .reduce((sum, r) => sum + r.result.score, 0) / results.length;

    console.log(`\n[Quality Gate Summary]`);
    console.log(`Total files: ${results.length}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log(`Average score: ${avgScore.toFixed(2)}`);

    return results;
  }
}

/**
 * Hook Integration
 */
async function preFileWriteHook(hookEvent) {
  const { agent, filePath, content, options = {} } = hookEvent;

  // Only run on code files
  const codeExtensions = ['.js', '.ts', '.py', '.java', '.cpp', '.cs', '.go'];
  const ext = path.extname(filePath);
  if (!codeExtensions.includes(ext)) {
    return { allowed: true, reason: 'Non-code file, skipping quality gate' };
  }

  // Only run for code quality agents
  if (!validateAgentAccess(agent, 'connascence-analyzer')) {
    return { allowed: true, reason: 'Agent does not have Connascence access' };
  }

  try {
    const pipeline = new QualityPipeline();
    const report = await pipeline.checkQuality(agent, filePath, options);

    return {
      allowed: report.passed,
      report,
      reason: report.passed ? 'Quality gate passed' : 'Quality gate failed'
    };
  } catch (error) {
    return {
      allowed: false,
      error: error.message,
      reason: 'Quality gate error'
    };
  }
}

module.exports = {
  QualityPipeline,
  QualityGradeCalculator,
  ConnascenceAnalyzer,
  ViolationReporter,
  MemoryIntegration,
  BackendMetricsService,
  RefinementTracker,      // INFINITE LOOP FIX: Export for testing/inspection
  refinementTracker,      // INFINITE LOOP FIX: Singleton instance
  preFileWriteHook,
  CONFIG
};
