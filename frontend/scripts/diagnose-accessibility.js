/**
 * Accessibility Diagnostic Tool
 * Identifies exact DOM elements failing WCAG color contrast
 */

import { chromium } from '@playwright/test';
import { injectAxe } from 'axe-playwright';

async function diagnoseAccessibility() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pages = [
    { name: 'homepage', url: 'http://localhost:3002/' },
    { name: 'agents', url: 'http://localhost:3002/agents' },
    { name: 'activity', url: 'http://localhost:3002/activity' },
    { name: 'resources', url: 'http://localhost:3002/resources' },
    { name: 'quality', url: 'http://localhost:3002/quality' },
  ];

  console.log('========================================');
  console.log('ACCESSIBILITY DIAGNOSTIC REPORT');
  console.log('Finding exact elements with contrast issues');
  console.log('========================================\n');

  for (const pageInfo of pages) {
    console.log(`\n[${pageInfo.name.toUpperCase()}]`);
    console.log(`URL: ${pageInfo.url}`);
    console.log('----------------------------------------');

    await page.goto(pageInfo.url);
    await page.waitForTimeout(2000); // Wait for page load

    // Inject axe-core
    await injectAxe(page);

    // Run accessibility scan
    const results = await page.evaluate(async () => {
      const axe = window.axe;
      const results = await axe.run({
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      return results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        nodes: violation.nodes.map((node) => ({
          html: node.html,
          target: node.target,
          failureSummary: node.failureSummary,
          // Get computed colors
          fg: node.any[0]?.data?.fgColor,
          bg: node.any[0]?.data?.bgColor,
          contrast: node.any[0]?.data?.contrastRatio,
          expected: node.any[0]?.data?.expectedContrastRatio,
        })),
      }));
    });

    if (results.length === 0) {
      console.log('✅ NO VIOLATIONS\n');
      continue;
    }

    results.forEach((violation) => {
      console.log(`\n❌ ${violation.id} (${violation.impact})`);
      console.log(`   ${violation.description}\n`);

      violation.nodes.forEach((node, idx) => {
        console.log(`   Element ${idx + 1}:`);
        console.log(`   HTML: ${node.html.substring(0, 100)}...`);
        console.log(`   Selector: ${node.target.join(' ')}`);
        console.log(`   Foreground: ${node.fg}`);
        console.log(`   Background: ${node.bg}`);
        console.log(
          `   Contrast: ${node.contrast?.toFixed(2)} (needs ${node.expected})`
        );
        console.log(`   ${node.failureSummary}\n`);
      });
    });
  }

  console.log('\n========================================');
  console.log('SCAN COMPLETE');
  console.log('========================================\n');

  await browser.close();
}

diagnoseAccessibility().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
