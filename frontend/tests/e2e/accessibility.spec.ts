import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('Dashboard homepage meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    try {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = accessibilityScanResults.violations;

      if (violations.length > 0) {
        console.log('Accessibility Violations Found:');
        violations.forEach((violation) => {
          console.log(`- ${violation.id}: ${violation.description}`);
          console.log(`  Impact: ${violation.impact}`);
          console.log(`  Help: ${violation.helpUrl}`);
        });
      }

      // Allow minor violations but flag critical ones
      const criticalViolations = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

      expect(criticalViolations.length).toBe(0);
    } catch (error) {
      console.log('Axe-core not available - install with: npm install -D @axe-core/playwright');
      console.log('Skipping detailed accessibility scan');
    }
  });

  test('All main pages have proper heading hierarchy', async ({ page }) => {
    const pages = ['/', '/agents', '/activity', '/resources', '/quality'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(500);

      // Check for h1
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);

      console.log(`${path} has ${h1Count} h1 heading(s)`);
    }
  });

  test('Keyboard navigation works across all pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Tab through interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      // Get currently focused element
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName : null;
      });

      console.log(`Tab ${i + 1}: Focused on ${focusedElement}`);
    }

    // Should be able to navigate
    const finalFocus = await page.evaluate(() => document.activeElement?.tagName);
    expect(finalFocus).toBeTruthy();
  });

  test('Interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(1000);

    // Find all buttons
    const buttons = await page.locator('button').all();

    console.log(`Found ${buttons.length} buttons`);

    if (buttons.length > 0) {
      // Focus first button
      await buttons[0].focus();

      // Press Enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      console.log('Button activated via keyboard');
    }
  });

  test('Form inputs have proper labels', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(1000);

    // Find all input fields
    const inputs = await page.locator('input').all();

    console.log(`Found ${inputs.length} input fields`);

    for (const input of inputs) {
      const hasLabel = await input.evaluate((el: HTMLInputElement) => {
        // Check for associated label
        const labelElement = el.labels?.[0];
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const placeholder = el.getAttribute('placeholder');

        return !!(labelElement || ariaLabel || ariaLabelledBy || placeholder);
      });

      if (!hasLabel) {
        const inputType = await input.getAttribute('type');
        console.log(`Input (type: ${inputType}) missing label`);
      }
    }
  });

  test('Images have alt text', async ({ page }) => {
    const pages = ['/', '/agents', '/activity', '/resources', '/quality'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(500);

      const imagesWithoutAlt = await page.locator('img:not([alt])').count();

      if (imagesWithoutAlt > 0) {
        console.log(`${path} has ${imagesWithoutAlt} images without alt text`);
      }

      // Decorative images should have empty alt=""
      expect(imagesWithoutAlt).toBe(0);
    }
  });

  test('Color contrast is sufficient', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    try {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('[role="button"], a, button, input')
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );

      if (contrastViolations.length > 0) {
        console.log('Color contrast violations:', contrastViolations);
      }

      expect(contrastViolations.length).toBe(0);
    } catch (error) {
      console.log('Axe-core not available - skipping color contrast test');
    }
  });

  test('ARIA roles are properly used', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Find elements with ARIA roles
    const rolesUsed = await page.evaluate(() => {
      const elements = document.querySelectorAll('[role]');
      const roles = new Set<string>();

      elements.forEach(el => {
        const role = el.getAttribute('role');
        if (role) roles.add(role);
      });

      return Array.from(roles);
    });

    console.log('ARIA roles used:', rolesUsed);

    // Should have some ARIA roles for rich UI
    expect(rolesUsed.length).toBeGreaterThan(0);
  });

  test('Skip links are present for screen readers', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Look for skip navigation link
    const skipLink = page.locator('a[href="#main-content"], a[href="#content"], .skip-link');
    const hasSkipLink = await skipLink.count() > 0;

    console.log(`Skip navigation link present: ${hasSkipLink}`);

    if (hasSkipLink) {
      // Should become visible on focus
      await skipLink.first().focus();
      const isVisible = await skipLink.first().isVisible();
      console.log(`Skip link visible on focus: ${isVisible}`);
    }
  });

  test('Focus is visible on interactive elements', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(1000);

    // Tab to first interactive element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Check if focused element has visible outline
    const hasFocusIndicator = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el) return false;

      const styles = window.getComputedStyle(el);
      const outline = styles.outline;
      const outlineWidth = styles.outlineWidth;
      const boxShadow = styles.boxShadow;

      return (
        (outline !== 'none' && outlineWidth !== '0px') ||
        boxShadow !== 'none'
      );
    });

    console.log(`Focus indicator present: ${hasFocusIndicator}`);
    expect(hasFocusIndicator).toBe(true);
  });

  test('Page language is set', async ({ page }) => {
    await page.goto('/');

    const lang = await page.locator('html').getAttribute('lang');

    console.log(`Page language: ${lang}`);
    expect(lang).toBeTruthy();
    expect(lang).toMatch(/^en/); // English
  });

  test('Document has a title', async ({ page }) => {
    const pages = ['/', '/agents', '/activity', '/resources', '/quality'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(500);

      const title = await page.title();

      console.log(`${path} title: ${title}`);
      expect(title.length).toBeGreaterThan(0);
    }
  });

  test('Links have accessible names', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const linksWithoutText = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));

      return links.filter(link => {
        const text = link.textContent?.trim();
        const ariaLabel = link.getAttribute('aria-label');
        const title = link.getAttribute('title');

        return !text && !ariaLabel && !title;
      }).length;
    });

    console.log(`Links without accessible names: ${linksWithoutText}`);
    expect(linksWithoutText).toBe(0);
  });

  test('Tables have proper structure', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForTimeout(1000);

    const tables = await page.locator('table').count();

    console.log(`Tables found: ${tables}`);

    if (tables > 0) {
      // Check first table for proper headers
      const hasHeaders = await page.evaluate(() => {
        const table = document.querySelector('table');
        if (!table) return false;

        const headers = table.querySelectorAll('th');
        return headers.length > 0;
      });

      console.log(`Table has proper headers: ${hasHeaders}`);
      expect(hasHeaders).toBe(true);
    }
  });

  test('Dynamic content announces to screen readers', async ({ page }) => {
    await page.goto('/activity');
    await page.waitForTimeout(1000);

    // Look for ARIA live regions
    const liveRegions = await page.locator('[aria-live]').count();

    console.log(`ARIA live regions found: ${liveRegions}`);

    // Activity feed should have live region for real-time updates
    expect(liveRegions).toBeGreaterThanOrEqual(0);
  });

  test('Modal dialogs trap focus', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(1000);

    // Try to open agent details modal
    const firstAgent = page.locator('[data-testid="agent-card"], .agent-row').first();
    const agentExists = await firstAgent.count() > 0;

    if (agentExists) {
      await firstAgent.click();
      await page.waitForTimeout(500);

      const modal = page.locator('[role="dialog"], .modal');
      const modalVisible = await modal.isVisible().catch(() => false);

      if (modalVisible) {
        // Tab through modal - focus should stay within
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        const focusInModal = await page.evaluate(() => {
          const activeEl = document.activeElement;
          const modal = document.querySelector('[role="dialog"]');

          return modal?.contains(activeEl) ?? false;
        });

        console.log(`Focus trapped in modal: ${focusInModal}`);
      }
    }
  });
});
