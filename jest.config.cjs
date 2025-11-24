/**
 * Jest Configuration for Terminal Manager Hooks
 * Phase 3.1: Testing Infrastructure Setup
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.test.cjs',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js',
    '**/?(*.)+(spec|test).cjs'
  ],

  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/frontend/node_modules/',
    '/backend/',
    '/dist/',
    '/build/',
    '/.git/'
  ],

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Coverage thresholds (Phase 3 target: 80%)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'hooks/12fa/**/*.js',
    'hooks/12fa/**/*.cjs',
    '!hooks/12fa/**/tests/**',
    '!hooks/12fa/**/*.test.js',
    '!hooks/12fa/**/*.test.cjs',
    '!hooks/12fa/**/*.spec.js',
    '!hooks/12fa/**/node_modules/**',
    '!**/dist/**',
    '!**/build/**'
  ],

  // Module resolution
  moduleFileExtensions: ['js', 'cjs', 'json'],

  // Transform configuration (if needed for ES modules)
  transform: {},

  // Setup files
  setupFilesAfterEnv: [],

  // Timeout for tests
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Coverage path mapping
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/.coverage/',
    '/coverage/'
  ],

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' > ',
        usePathForSuiteName: true
      }
    ]
  ],

  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined,

  // Fail fast on first error (useful for CI)
  bail: 0,

  // Maximum number of workers
  maxWorkers: '50%',

  // Cache directory
  cacheDirectory: '.jest-cache'
};
