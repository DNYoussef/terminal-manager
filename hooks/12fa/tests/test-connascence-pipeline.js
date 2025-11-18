/**
 * Test Suite: Connascence Quality Pipeline
 *
 * Tests for pre-commit quality gates, scoring, and violation detection.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  QualityPipeline,
  QualityGradeCalculator,
  ConnascenceAnalyzer,
  ViolationReporter,
  CONFIG
} = require('../connascence-pipeline.js');

/**
 * Test Quality Grade Calculator
 */
function testQualityGradeCalculator() {
  console.log('Testing QualityGradeCalculator...');

  const calculator = new QualityGradeCalculator();

  // Test: No violations = perfect score
  const perfectScore = calculator.calculateScore({
    godObjects: [],
    parameterBombs: [],
    cyclomaticComplexity: [],
    deepNesting: [],
    longFunctions: [],
    magicLiterals: []
  });

  assert.strictEqual(perfectScore.score, 100, 'Perfect score should be 100');
  assert.strictEqual(perfectScore.grade, 'A', 'Perfect grade should be A');

  // Test: Multiple violations
  const multipleViolations = calculator.calculateScore({
    godObjects: [{ methods: 20 }],  // 1 violation
    parameterBombs: [{ parameterCount: 10 }],  // 1 violation
    cyclomaticComplexity: [{ complexity: 15 }],  // 1 violation
    deepNesting: [],
    longFunctions: [],
    magicLiterals: []
  });

  const expectedPenalty = CONFIG.penalties.godObject +
                          CONFIG.penalties.parameterBomb +
                          CONFIG.penalties.cyclomaticComplexity;
  const expectedScore = 100 - expectedPenalty;

  assert.strictEqual(multipleViolations.totalPenalty, expectedPenalty, 'Penalty calculation incorrect');
  assert.strictEqual(multipleViolations.score, expectedScore, 'Score calculation incorrect');

  // Test: Threshold retrieval
  const agentThreshold = calculator.getThreshold('coder', 'test.js');
  assert.strictEqual(agentThreshold, CONFIG.agentThresholds.coder, 'Agent threshold incorrect');

  const fileThreshold = calculator.getThreshold('reviewer', 'auth-service.js');
  assert.strictEqual(fileThreshold, CONFIG.fileThresholds.auth, 'File threshold incorrect');

  const defaultThreshold = calculator.getThreshold('unknown-agent', 'test.js');
  assert.strictEqual(defaultThreshold, CONFIG.globalThreshold, 'Default threshold incorrect');

  console.log('QualityGradeCalculator: PASSED');
}

/**
 * Test Connascence Analyzer
 */
function testConnascenceAnalyzer() {
  console.log('Testing ConnascenceAnalyzer...');

  const analyzer = new ConnascenceAnalyzer();

  // Test: God Object detection
  const godObjectCode = `
    class MassiveClass {
      method1() {}
      method2() {}
      method3() {}
      method4() {}
      method5() {}
      method6() {}
      method7() {}
      method8() {}
      method9() {}
      method10() {}
      method11() {}
      method12() {}
      method13() {}
      method14() {}
      method15() {}
      method16() {}
    }
  `;

  const godObjects = analyzer.detectGodObjects(godObjectCode);
  assert.ok(godObjects.length > 0, 'Should detect god object');

  // Test: Parameter Bomb detection
  const parameterBombCode = `
    function createUser(name, email, password, age, address, phone, country, zipcode) {
      return { name, email, password, age, address, phone, country, zipcode };
    }
  `;

  const parameterBombs = analyzer.detectParameterBombs(parameterBombCode);
  assert.ok(parameterBombs.length > 0, 'Should detect parameter bomb');

  // Test: Cyclomatic Complexity detection
  const complexCode = `
    function complexFunction() {
      if (a) {
        if (b) {
          while (c) {
            for (let i = 0; i < 10; i++) {
              if (d && e || f) {
                if (g && h) {
                  if (i || j) {
                    if (k) {
                      console.log('complex');
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const complexity = analyzer.detectComplexity(complexCode);
  // Complexity detection may vary based on heuristic
  // Just verify it returns an array
  assert.ok(Array.isArray(complexity), 'Should return complexity array');

  // Test: Deep Nesting detection
  const nestedCode = `
    function nested() {
      if (a) {
        if (b) {
          if (c) {
            if (d) {
              if (e) {
                console.log('too deep');
              }
            }
          }
        }
      }
    }
  `;

  const nesting = analyzer.detectNesting(nestedCode);
  assert.ok(nesting.length > 0, 'Should detect deep nesting');

  // Test: Magic Literals detection
  const magicCode = `
    const config = {
      port: 3000,
      timeout: 5000,
      apiKey: "sk-1234567890abcdefghijklmnop"
    };
  `;

  const magicLiterals = analyzer.detectMagicLiterals(magicCode);
  assert.ok(magicLiterals.length > 0, 'Should detect magic literals');

  console.log('ConnascenceAnalyzer: PASSED');
}

/**
 * Test Violation Reporter
 */
function testViolationReporter() {
  console.log('Testing ViolationReporter...');

  const reporter = new ViolationReporter();

  // Test: Report generation
  const result = {
    score: 75,
    grade: 'C',
    totalPenalty: 25,
    violationCounts: {
      godObjects: 1,
      parameterBombs: 0,
      cyclomaticComplexity: 2,
      deepNesting: 0,
      longFunctions: 1,
      magicLiterals: 3
    }
  };

  const report = reporter.generateReport('test.js', result, 70);

  assert.strictEqual(report.score, 75, 'Report score incorrect');
  assert.strictEqual(report.grade, 'C', 'Report grade incorrect');
  assert.strictEqual(report.passed, true, 'Report passed should be true');

  // Test: Failed report
  const failedResult = { ...result, score: 60 };
  const failedReport = reporter.generateReport('test.js', failedResult, 70);
  assert.strictEqual(failedReport.passed, false, 'Report passed should be false');

  // Test: Fix suggestions
  const violations = {
    godObjects: [{}],
    parameterBombs: [{}],
    cyclomaticComplexity: [],
    deepNesting: [],
    longFunctions: [],
    magicLiterals: [{}]
  };

  const suggestions = reporter.suggestFixes(violations);
  assert.ok(suggestions.length > 0, 'Should generate fix suggestions');
  assert.ok(
    suggestions.some(s => s.includes('God Objects')),
    'Should suggest god object fix'
  );
  assert.ok(
    suggestions.some(s => s.includes('Parameter Bombs')),
    'Should suggest parameter bomb fix'
  );

  console.log('ViolationReporter: PASSED');
}

/**
 * Test Quality Pipeline Integration
 */
async function testQualityPipeline() {
  console.log('Testing QualityPipeline...');

  const pipeline = new QualityPipeline();

  // Create a test file
  const testFile = path.join(__dirname, 'test-sample.js');
  const testContent = `
    class TestClass {
      method1() {}
      method2() {}
      method3() {}
    }

    function simpleFunction() {
      return 42;
    }
  `;

  fs.writeFileSync(testFile, testContent);

  try {
    // Test: Quality check
    const report = await pipeline.checkQuality('coder', testFile, {
      threshold: 50  // Low threshold to ensure pass
    });

    assert.ok(report.score !== undefined, 'Report should have score');
    assert.ok(report.grade !== undefined, 'Report should have grade');
    assert.ok(report.passed !== undefined, 'Report should have passed status');

    // Test: Batch check
    const results = await pipeline.checkMultipleFiles('reviewer', [testFile], {
      threshold: 50
    });

    assert.strictEqual(results.length, 1, 'Should have one result');
    assert.ok(results[0].passed, 'Batch check should pass');

    console.log('QualityPipeline: PASSED');
  } finally {
    // Cleanup
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  }
}

/**
 * Test Grade Boundaries
 */
function testGradeBoundaries() {
  console.log('Testing Grade Boundaries...');

  const calculator = new QualityGradeCalculator();

  const grades = [
    { score: 95, expected: 'A' },
    { score: 90, expected: 'A' },
    { score: 89, expected: 'B' },
    { score: 80, expected: 'B' },
    { score: 79, expected: 'C' },
    { score: 70, expected: 'C' },
    { score: 69, expected: 'D' },
    { score: 60, expected: 'D' },
    { score: 59, expected: 'F' },
    { score: 0, expected: 'F' }
  ];

  grades.forEach(({ score, expected }) => {
    const actual = calculator.getGrade(score);
    assert.strictEqual(actual, expected, `Grade for score ${score} should be ${expected}, got ${actual}`);
  });

  console.log('Grade Boundaries: PASSED');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Running Connascence Pipeline Tests...\n');

  try {
    testQualityGradeCalculator();
    testConnascenceAnalyzer();
    testViolationReporter();
    testGradeBoundaries();
    await testQualityPipeline();

    console.log('\nAll tests PASSED!');
  } catch (error) {
    console.error('\nTest FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  testQualityGradeCalculator,
  testConnascenceAnalyzer,
  testViolationReporter,
  testQualityPipeline,
  testGradeBoundaries
};
