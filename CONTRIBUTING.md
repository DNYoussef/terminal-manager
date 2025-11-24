# Contributing to Terminal Manager

Thank you for contributing to Terminal Manager! This document outlines our development practices and testing standards.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Testing Standards](#testing-standards)
4. [Development Workflow](#development-workflow)
5. [Pull Request Process](#pull-request-process)
6. [Code Style](#code-style)

---

## Code of Conduct

Be respectful, collaborative, and constructive in all interactions.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Git
- PostgreSQL (for backend development)

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/terminal-manager.git
cd terminal-manager

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run tests to verify setup
npm test
```

---

## Testing Standards

### Philosophy: Real Code Over Mocks

This project follows the **"Real Code Over Mocks"** testing methodology, validated in Phase 3.3 with 220 tests and 91% coverage achieved.

**Core Principle**: Only mock external I/O. Use real implementations for all internal business logic.

### Why This Matters

Real code testing has been proven superior across 7 metrics:
- ✅ 15x higher coverage (91% vs 6%)
- ✅ 60% less test code
- ✅ Catches real bugs (2 bugs discovered in Phase 3.3)
- ✅ Easier to maintain
- ✅ Easier to debug
- ✅ Tests actual behavior, not mock behavior
- ✅ Higher confidence in test results

### What to Mock, What to Keep Real

**✅ MOCK: External I/O Only**
- File system (`fs` module)
- Network requests (`node-fetch`, `axios`)
- External services (OpenTelemetry, monitoring)
- Database connections
- Optional dependencies

**🚫 NEVER MOCK: Internal Business Logic**
- Business logic modules
- Utilities and helpers
- Configuration
- Internal services

### Test File Template

Use the template in `hooks/12fa/__tests__/TESTING-TEMPLATE.md` for all new tests.

**File naming**: `[module-name]-real.test.js`

**Structure**:
1. Mock only external I/O (file system, network, external services)
2. Use REAL implementations for internal modules
3. Organize tests into 4 categories:
   - Core Functionality (40%)
   - Integration Points (30%)
   - Error Handling (15%)
   - Helper Functions (15%)

### Example Test

```javascript
// Mock ONLY external I/O
const mockFs = {
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn()
};
jest.mock('fs', () => mockFs);

// Use REAL implementations
const { getLogger } = require('../structured-logger');  // REAL
const moduleUnderTest = require('../module-name');  // REAL

describe('Module Name', () => {
  test('should perform real function', async () => {
    const result = await moduleUnderTest.realFunction();

    // Assert on real behavior, not mock calls
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:hooks

# Run with coverage
npm run test:hooks:coverage

# Run in watch mode
npm run test:hooks:watch
```

### Coverage Targets

- **Critical modules** (auth, payments): 80%+
- **Standard modules** (utilities): 60-80%
- **Integration points** (hooks, middleware): 70%+

**Pass Rate Philosophy**: Target 60-80% pass rates, not 100%. Lower pass rates that catch real bugs are better than 100% pass rates that ship bugs.

### Full Testing Guidelines

See `docs/TESTING-GUIDELINES.md` for comprehensive testing standards.

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow code style guidelines
- Write tests using real code methodology
- Update documentation as needed

### 3. Run Tests Locally

```bash
# Run tests
npm test

# Check coverage
npm run test:hooks:coverage

# Lint code
npm run lint
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: Add your feature description"
```

**Commit Message Format**:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions or updates
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

---

## Pull Request Process

### PR Checklist

- [ ] Tests added for new functionality
- [ ] Tests follow "real code over mocks" methodology
- [ ] All tests pass locally
- [ ] Coverage targets met (60-80%)
- [ ] Documentation updated
- [ ] Code follows style guide
- [ ] Commit messages follow format
- [ ] PR description explains changes

### PR Review Criteria

1. **Functionality**: Does the code work as intended?
2. **Testing**: Are there comprehensive tests using real code?
3. **Coverage**: Does coverage meet targets?
4. **Code Quality**: Is the code maintainable and readable?
5. **Documentation**: Are changes documented?

### After Review

- Address reviewer feedback
- Update tests if needed
- Maintain real code testing approach
- Re-request review after changes

---

## Code Style

### General Principles

- **Clarity over cleverness**: Write code that's easy to understand
- **Real code over mocks**: Test real behavior, not mock behavior
- **Windows compatibility**: NO UNICODE, use Windows-compatible paths
- **Documentation**: Comment the "why", not the "what"

### JavaScript Style

- Use `const` and `let`, avoid `var`
- Use async/await over raw Promises
- Prefer explicit returns
- Use meaningful variable names
- Limit function length to 50 lines
- Maximum cyclomatic complexity: 10

### File Organization

```
project-root/
├── src/              # Source code
├── tests/            # Test files
│   └── [module]-real.test.js
├── docs/             # Documentation
├── hooks/            # Hook implementations
│   └── 12fa/
│       ├── __tests__/  # Hook tests
│       └── *.js        # Hook files
├── scripts/          # Utility scripts
└── config/           # Configuration files
```

### Naming Conventions

- **Files**: kebab-case (`module-name.js`)
- **Variables**: camelCase (`variableName`)
- **Constants**: UPPER_SNAKE_CASE (`CONSTANT_VALUE`)
- **Classes**: PascalCase (`ClassName`)
- **Tests**: `[module-name]-real.test.js`

---

## Additional Resources

### Documentation

- **Testing Guidelines**: `docs/TESTING-GUIDELINES.md`
- **Test Template**: `hooks/12fa/__tests__/TESTING-TEMPLATE.md`
- **Phase 3.3 Summary**: `docs/PHASE-3.3-COMPLETE.md`

### Examples

- **Reference Test**: `hooks/12fa/__tests__/pre-task-real.test.js` (27 tests, 400 LOC)
- **High Coverage**: `hooks/12fa/__tests__/memory-mcp-tagging-protocol-real.test.js` (91% coverage)

### Getting Help

- Open an issue for questions
- Review existing tests for examples
- Check documentation for guidelines

---

## License

[Your License Here]

---

**Remember**: We prioritize **bug detection** over **pass rates**. Tests should validate real behavior and catch real bugs. Real code tests with 60% pass rates that discover issues are better than mock tests with 100% pass rates that ship bugs.

Thank you for contributing! 🎉
