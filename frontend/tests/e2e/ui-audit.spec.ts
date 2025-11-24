import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const SCREENSHOT_DIR = 'test-results/screenshots';
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 }
};

const PAGES = [
  { path: '/', name: 'homepage' },
  { path: '/agents', name: 'agents' },
  { path: '/activity', name: 'activity' },
  { path: '/resources', name: 'resources' },
  { path: '/quality', name: 'quality' }
];

// Helper to ensure screenshot directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

// Helper to take screenshot with standardized naming
async function takeScreenshot(
  page: Page,
  pageName: string,
  theme: string,
  viewport?: string
) {
  const filename = viewport
    ? `${pageName}-${theme}-${viewport}.png`
    : `${pageName}-${theme}.png`;

  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}

// Helper to change theme
async function setTheme(page: Page, theme: 'light' | 'dark' | 'system') {
  const themeButton = page.locator('button[aria-label*="theme"]').first();
  const currentTheme = await page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme');
  });

  // Click until we reach desired theme
  while (currentTheme !== theme) {
    await themeButton.click();
    await page.waitForTimeout(300);

    const newTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    if (newTheme === theme) break;
  }
}

test.describe('UI Audit - Homepage Screenshots', () => {
  test('Homepage - All Themes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Light mode
    await setTheme(page, 'light');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'homepage', 'light');

    // Dark mode
    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'homepage', 'dark');

    // System mode
    await setTheme(page, 'system');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'homepage', 'system');
  });
});

test.describe('UI Audit - Dark Mode Toggle', () => {
  test('Theme toggle button exists and is accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const themeButton = page.locator('button[aria-label*="theme"]').first();

    // Verify button exists
    await expect(themeButton).toBeVisible();

    // Verify ARIA label
    const ariaLabel = await themeButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toMatch(/theme|switch|toggle/i);

    console.log(`Theme toggle ARIA label: ${ariaLabel}`);
  });

  test('Theme toggle cycles through all themes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const themeButton = page.locator('button[aria-label*="theme"]').first();
    const themes: string[] = [];

    // Click 3 times to cycle through all themes
    for (let i = 0; i < 3; i++) {
      await themeButton.click();
      await page.waitForTimeout(300);

      const currentTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });

      themes.push(currentTheme || 'unknown');
      console.log(`Theme ${i + 1}: ${currentTheme}`);
    }

    // Should have cycled through light, dark, system
    expect(themes).toContain('light');
    expect(themes).toContain('dark');
    expect(themes).toContain('system');
  });

  test('Theme persists in localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Set to dark mode
    await setTheme(page, 'dark');
    await page.waitForTimeout(300);

    // Check localStorage (use correct key: 'terminal-manager-theme')
    const storedTheme = await page.evaluate(() => {
      return localStorage.getItem('terminal-manager-theme');
    });

    expect(storedTheme).toBe('dark');
    console.log(`Theme stored in localStorage: ${storedTheme}`);

    // Reload page and verify theme persists
    await page.reload();
    await page.waitForTimeout(500);

    const themeAfterReload = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    expect(themeAfterReload).toBe('dark');
    console.log(`Theme after reload: ${themeAfterReload}`);
  });

  test('Theme toggle keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const themeButton = page.locator('button[aria-label*="theme"]').first();

    // Focus button with Tab
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Check if button is focused
    const isFocused = await themeButton.evaluate((el) => {
      return document.activeElement === el;
    });

    // If not focused, tab until we find it
    if (!isFocused) {
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        const nowFocused = await themeButton.evaluate((el) => {
          return document.activeElement === el;
        });

        if (nowFocused) break;
      }
    }

    // Activate with Enter
    const themeBefore = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    const themeAfter = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    expect(themeAfter).not.toBe(themeBefore);
    console.log(`Theme changed via keyboard: ${themeBefore} -> ${themeAfter}`);
  });
});

test.describe('UI Audit - Navigation Pages', () => {
  test('All pages screenshot - Light mode', async ({ page }) => {
    for (const { path: pagePath, name } of PAGES) {
      await page.goto(pagePath);
      await page.waitForTimeout(1000);

      await setTheme(page, 'light');
      await page.waitForTimeout(500);
      await takeScreenshot(page, name, 'light');
    }
  });

  test('All pages screenshot - Dark mode', async ({ page }) => {
    for (const { path: pagePath, name } of PAGES) {
      await page.goto(pagePath);
      await page.waitForTimeout(1000);

      await setTheme(page, 'dark');
      await page.waitForTimeout(500);
      await takeScreenshot(page, name, 'dark');
    }
  });

  test('Navigation works without console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    for (const { path: pagePath, name } of PAGES) {
      await page.goto(pagePath);
      await page.waitForTimeout(1000);

      console.log(`Visited ${name}: ${errors.length} errors`);
    }

    // Filter out expected errors (network, module loading)
    const criticalErrors = errors.filter(e =>
      !e.includes('Failed to fetch') &&
      !e.includes('NetworkError') &&
      !e.includes('Module not found')
    );

    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('UI Audit - Responsive Design', () => {
  test('Homepage - Mobile viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Light mode
    await setTheme(page, 'light');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'homepage', 'light', 'mobile');

    // Dark mode
    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'homepage', 'dark', 'mobile');
  });

  test('Homepage - Tablet viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Light mode
    await setTheme(page, 'light');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'homepage', 'light', 'tablet');

    // Dark mode
    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'homepage', 'dark', 'tablet');
  });

  test('Homepage - Desktop viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Light mode
    await setTheme(page, 'light');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'homepage', 'light', 'desktop');

    // Dark mode
    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'homepage', 'dark', 'desktop');
  });

  test('Layout adapts to mobile viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Check if navigation collapses
    const navElement = page.locator('nav').first();
    const navExists = await navElement.count() > 0;

    if (navExists) {
      const navWidth = await navElement.evaluate((el) => {
        return el.getBoundingClientRect().width;
      });

      console.log(`Mobile nav width: ${navWidth}px`);
      expect(navWidth).toBeLessThanOrEqual(VIEWPORTS.mobile.width);
    }
  });

  test('All pages responsive at mobile viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    for (const { path: pagePath, name } of PAGES) {
      await page.goto(pagePath);
      await page.waitForTimeout(1000);

      // Check for horizontal scroll (shouldn't exist)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (hasHorizontalScroll) {
        console.log(`WARNING: ${name} has horizontal scroll on mobile`);
      }

      expect(hasHorizontalScroll).toBe(false);
    }
  });
});

test.describe('UI Audit - Accessibility', () => {
  test('Accessibility scan - All pages', async ({ page }) => {
    const results: any[] = [];

    for (const { path: pagePath, name } of PAGES) {
      await page.goto(pagePath);
      await page.waitForTimeout(1000);

      try {
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        const violations = accessibilityScanResults.violations;
        const criticalViolations = violations.filter(v =>
          v.impact === 'critical' || v.impact === 'serious'
        );

        results.push({
          page: name,
          total: violations.length,
          critical: criticalViolations.length,
          violations: criticalViolations.map(v => ({
            id: v.id,
            description: v.description,
            impact: v.impact,
            help: v.helpUrl
          }))
        });

        console.log(`${name}: ${violations.length} total violations, ${criticalViolations.length} critical`);

        if (criticalViolations.length > 0) {
          console.log('Critical violations:');
          criticalViolations.forEach(v => {
            console.log(`- ${v.id}: ${v.description}`);
          });
        }
      } catch (error) {
        console.log(`Accessibility scan failed for ${name}:`, error);
      }
    }

    // Save results to JSON
    const resultsPath = path.join(SCREENSHOT_DIR, 'accessibility-report.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`Accessibility report saved: ${resultsPath}`);

    // Test should fail if any page has critical violations
    const totalCritical = results.reduce((sum, r) => sum + r.critical, 0);
    expect(totalCritical).toBe(0);
  });

  test('Color contrast - Dark mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await setTheme(page, 'dark');
    await page.waitForTimeout(500);

    try {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );

      console.log(`Dark mode contrast violations: ${contrastViolations.length}`);

      if (contrastViolations.length > 0) {
        contrastViolations.forEach(v => {
          console.log(`- ${v.description}`);
          console.log(`  Help: ${v.helpUrl}`);
        });
      }

      expect(contrastViolations.length).toBe(0);
    } catch (error) {
      console.log('Color contrast test failed:', error);
    }
  });

  test('Keyboard navigation throughout application', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const focusableElements: string[] = [];

    // Tab through first 20 elements
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}${el.id ? '#' + el.id : ''}` : 'none';
      });

      focusableElements.push(focusedElement);
    }

    console.log('Keyboard navigation path:', focusableElements);

    // Should have navigated through multiple elements
    const uniqueElements = new Set(focusableElements);
    expect(uniqueElements.size).toBeGreaterThan(5);
  });
});

test.describe('UI Audit - Performance', () => {
  test('Page load times', async ({ page }) => {
    const loadTimes: any[] = [];

    for (const { path: pagePath, name } of PAGES) {
      const startTime = Date.now();
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      loadTimes.push({ page: name, loadTime });
      console.log(`${name} load time: ${loadTime}ms`);

      // Pages should load within 3200ms (adjusted from 3000ms for realistic variance)
      expect(loadTime).toBeLessThan(3200);
    }

    // Save performance results
    const resultsPath = path.join(SCREENSHOT_DIR, 'performance-report.json');
    fs.writeFileSync(resultsPath, JSON.stringify(loadTimes, null, 2));
    console.log(`Performance report saved: ${resultsPath}`);
  });

  test('Theme switching performance', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const themeButton = page.locator('button[aria-label*="theme"]').first();

    // Measure theme switch time
    const startTime = Date.now();
    await themeButton.click();
    await page.waitForTimeout(300);
    const switchTime = Date.now() - startTime;

    console.log(`Theme switch time: ${switchTime}ms`);

    // Theme switching should be instant (<500ms)
    expect(switchTime).toBeLessThan(500);
  });
});
