/**
 * Dark Mode Implementation Verification Script
 * Tests all aspects of the theme system
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function checkFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  const exists = fs.existsSync(fullPath);
  const status = exists ? 'PASS' : 'FAIL';
  const color = exists ? 'green' : 'red';

  log(`  [${status}] ${filePath}`, color);

  if (exists) {
    const stats = fs.statSync(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    log(`        Size: ${sizeKB} KB`, 'cyan');
  }

  return exists;
}

function checkFileContent(filePath, requiredStrings) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    log(`  [FAIL] File not found: ${filePath}`, 'red');
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  let allFound = true;

  requiredStrings.forEach(str => {
    const found = content.includes(str);
    const status = found ? 'PASS' : 'FAIL';
    const color = found ? 'green' : 'red';
    log(`    [${status}] Contains: "${str}"`, color);
    if (!found) allFound = false;
  });

  return allFound;
}

function countVariables(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    return 0;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const matches = content.match(/--color-[a-z-]+:/g);

  return matches ? matches.length : 0;
}

function main() {
  log('\n=== DARK MODE IMPLEMENTATION VERIFICATION ===\n', 'cyan');

  // Test 1: File Creation
  log('Test 1: File Creation', 'yellow');
  const files = [
    'src/contexts/ThemeContext.tsx',
    'src/components/ThemeToggle.tsx',
    'src/styles/theme.css'
  ];

  const filesExist = files.every(checkFile);
  log('');

  // Test 2: Theme Context
  log('Test 2: Theme Context Implementation', 'yellow');
  const contextChecks = checkFileContent('src/contexts/ThemeContext.tsx', [
    'type Theme',
    'light',
    'dark',
    'system',
    'ThemeProvider',
    'useTheme',
    'localStorage',
    'terminal-manager-theme',
    'window.matchMedia',
    'prefers-color-scheme: dark',
    'data-theme'
  ]);
  log('');

  // Test 3: Theme Toggle Component
  log('Test 3: Theme Toggle Component', 'yellow');
  const toggleChecks = checkFileContent('src/components/ThemeToggle.tsx', [
    'Sun',
    'Moon',
    'Monitor',
    'useTheme',
    'handleToggle',
    'aria-label',
    'Light',
    'Dark',
    'System'
  ]);
  log('');

  // Test 4: Theme CSS
  log('Test 4: Theme CSS Variables', 'yellow');
  const lightVars = countVariables('src/styles/theme.css');
  log(`  [INFO] Theme variables defined: ${lightVars}`, 'cyan');

  const themeChecks = checkFileContent('src/styles/theme.css', [
    '[data-theme="dark"]',
    '[data-theme="light"]',
    '--color-bg-primary',
    '--color-text-primary',
    '--color-border',
    'transition',
    'color-scheme'
  ]);
  log('');

  // Test 5: App Integration
  log('Test 5: App.tsx Integration', 'yellow');
  const appChecks = checkFileContent('src/App.tsx', [
    'ThemeProvider',
    'ThemeToggle',
    'import { ThemeProvider }',
    'import { ThemeToggle }'
  ]);
  log('');

  // Test 6: CSS Import
  log('Test 6: CSS Import Chain', 'yellow');
  const cssChecks = checkFileContent('src/index.css', [
    '@import \'./styles/theme.css\'',
    '@import \'./styles/design-tokens.css\''
  ]);
  log('');

  // Test 7: Build Output
  log('Test 7: Build Output', 'yellow');
  const distExists = fs.existsSync(path.join(__dirname, 'dist'));
  log(`  [${distExists ? 'PASS' : 'FAIL'}] dist/ directory exists`, distExists ? 'green' : 'red');

  if (distExists) {
    const indexExists = fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
    log(`  [${indexExists ? 'PASS' : 'FAIL'}] dist/index.html exists`, indexExists ? 'green' : 'red');

    const assetsDir = path.join(__dirname, 'dist', 'assets');
    if (fs.existsSync(assetsDir)) {
      const assets = fs.readdirSync(assetsDir);
      log(`  [INFO] Assets generated: ${assets.length} files`, 'cyan');

      const cssFiles = assets.filter(f => f.endsWith('.css'));
      const jsFiles = assets.filter(f => f.endsWith('.js'));

      log(`        CSS files: ${cssFiles.length}`, 'cyan');
      log(`        JS files: ${jsFiles.length}`, 'cyan');
    }
  }
  log('');

  // Summary
  log('=== SUMMARY ===', 'yellow');
  const allPassed = filesExist && contextChecks && toggleChecks && themeChecks && appChecks && cssChecks && distExists;

  if (allPassed) {
    log('All checks passed! Dark mode implementation is complete.', 'green');
  } else {
    log('Some checks failed. Review the output above.', 'red');
  }

  log('\n=== NEXT STEPS ===', 'cyan');
  log('1. Start dev server: npm run dev', 'blue');
  log('2. Open browser: http://localhost:5173', 'blue');
  log('3. Click the theme toggle button in the navigation bar', 'blue');
  log('4. Verify theme cycles: Light -> Dark -> System', 'blue');
  log('5. Reload page to test persistence', 'blue');
  log('6. Change OS theme to test system preference', 'blue');
  log('');

  process.exit(allPassed ? 0 : 1);
}

main();
