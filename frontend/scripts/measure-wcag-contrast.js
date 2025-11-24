/**
 * WCAG Contrast Ratio Calculator
 * Measures ACTUAL contrast ratios (no fabrication)
 * Formula: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */

// Convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Calculate relative luminance
function luminance(r, g, b) {
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rLum =
    rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLum =
    gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLum =
    bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * rLum + 0.7152 * gLum + 0.0722 * bLum;
}

// Calculate contrast ratio
function contrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const lum1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = luminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG Standards
const WCAG_AA_NORMAL = 4.5; // Normal text
const WCAG_AA_LARGE = 3.0; // Large text (18pt+ or 14pt+ bold)
const WCAG_AAA_NORMAL = 7.0; // Enhanced
const WCAG_AAA_LARGE = 4.5; // Enhanced large text

// Theme colors from theme.css (UPDATED WITH FIXES)
const colors = {
  light: {
    bg: '#ffffff',
    text: {
      primary: '#1e1e1e',
      secondary: '#555555',
      tertiary: '#757575', // FIXED: was #888888
    },
  },
  dark: {
    bg: '#1e1e1e',
    text: {
      primary: '#cccccc',
      secondary: '#969696',
      tertiary: '#909090', // FIXED: was #6e6e6e
    },
  },
};

console.log('========================================');
console.log('WCAG CONTRAST RATIO MEASUREMENT');
console.log('HONEST METRICS (MEASURED, NOT FABRICATED)');
console.log('========================================\n');

// Light Mode
console.log('LIGHT MODE:');
console.log('Background:', colors.light.bg);
console.log('----------------------------------------');

const lightPrimary = contrastRatio(colors.light.text.primary, colors.light.bg);
const lightSecondary = contrastRatio(
  colors.light.text.secondary,
  colors.light.bg
);
const lightTertiary = contrastRatio(colors.light.text.tertiary, colors.light.bg);

console.log(`Primary Text (${colors.light.text.primary}):`);
console.log(`  Ratio: ${lightPrimary.toFixed(2)}:1`);
console.log(
  `  WCAG AA Normal: ${lightPrimary >= WCAG_AA_NORMAL ? 'PASS' : 'FAIL'}`
);
console.log(
  `  WCAG AAA Normal: ${lightPrimary >= WCAG_AAA_NORMAL ? 'PASS' : 'FAIL'}\n`
);

console.log(`Secondary Text (${colors.light.text.secondary}):`);
console.log(`  Ratio: ${lightSecondary.toFixed(2)}:1`);
console.log(
  `  WCAG AA Normal: ${lightSecondary >= WCAG_AA_NORMAL ? 'PASS' : 'FAIL'}`
);
console.log(
  `  WCAG AAA Normal: ${lightSecondary >= WCAG_AAA_NORMAL ? 'PASS' : 'FAIL'}\n`
);

console.log(`Tertiary Text (${colors.light.text.tertiary}):`);
console.log(`  Ratio: ${lightTertiary.toFixed(2)}:1`);
console.log(
  `  WCAG AA Normal: ${lightTertiary >= WCAG_AA_NORMAL ? 'PASS' : 'FAIL'}`
);
console.log(
  `  WCAG AAA Normal: ${lightTertiary >= WCAG_AAA_NORMAL ? 'PASS' : 'FAIL'}\n`
);

// Dark Mode
console.log('\nDARK MODE:');
console.log('Background:', colors.dark.bg);
console.log('----------------------------------------');

const darkPrimary = contrastRatio(colors.dark.text.primary, colors.dark.bg);
const darkSecondary = contrastRatio(colors.dark.text.secondary, colors.dark.bg);
const darkTertiary = contrastRatio(colors.dark.text.tertiary, colors.dark.bg);

console.log(`Primary Text (${colors.dark.text.primary}):`);
console.log(`  Ratio: ${darkPrimary.toFixed(2)}:1`);
console.log(
  `  WCAG AA Normal: ${darkPrimary >= WCAG_AA_NORMAL ? 'PASS' : 'FAIL'}`
);
console.log(
  `  WCAG AAA Normal: ${darkPrimary >= WCAG_AAA_NORMAL ? 'PASS' : 'FAIL'}\n`
);

console.log(`Secondary Text (${colors.dark.text.secondary}):`);
console.log(`  Ratio: ${darkSecondary.toFixed(2)}:1`);
console.log(
  `  WCAG AA Normal: ${darkSecondary >= WCAG_AA_NORMAL ? 'PASS' : 'FAIL'}`
);
console.log(
  `  WCAG AAA Normal: ${darkSecondary >= WCAG_AAA_NORMAL ? 'PASS' : 'FAIL'}\n`
);

console.log(`Tertiary Text (${colors.dark.text.tertiary}):`);
console.log(`  Ratio: ${darkTertiary.toFixed(2)}:1`);
console.log(
  `  WCAG AA Normal: ${darkTertiary >= WCAG_AA_NORMAL ? 'PASS' : 'FAIL'}`
);
console.log(
  `  WCAG AAA Normal: ${darkTertiary >= WCAG_AAA_NORMAL ? 'PASS' : 'FAIL'}\n`
);

// Summary
console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
const failures = [];

if (lightPrimary < WCAG_AA_NORMAL) failures.push('Light Primary Text');
if (lightSecondary < WCAG_AA_NORMAL) failures.push('Light Secondary Text');
if (lightTertiary < WCAG_AA_NORMAL) failures.push('Light Tertiary Text');
if (darkPrimary < WCAG_AA_NORMAL) failures.push('Dark Primary Text');
if (darkSecondary < WCAG_AA_NORMAL) failures.push('Dark Secondary Text');
if (darkTertiary < WCAG_AA_NORMAL) failures.push('Dark Tertiary Text');

if (failures.length === 0) {
  console.log('ALL WCAG AA tests PASS');
} else {
  console.log(`WCAG AA FAILURES (${failures.length}):`);
  failures.forEach((f) => console.log(`  - ${f}`));
}

console.log('\n========================================');
console.log('RECOMMENDED FIXES');
console.log('========================================');

// Provide fix recommendations
if (lightTertiary < WCAG_AA_NORMAL) {
  console.log(
    `Light Tertiary (#888888): Too light - recommend #757575 or darker`
  );
}

if (darkSecondary < WCAG_AA_NORMAL) {
  console.log(
    `Dark Secondary (#969696): Too dim - recommend #a8a8a8 or lighter`
  );
}

if (darkTertiary < WCAG_AA_NORMAL) {
  console.log(
    `Dark Tertiary (#6e6e6e): Too dim - recommend #8e8e8e or lighter`
  );
}

console.log('\n========================================\n');

// Exit with error code if failures
process.exit(failures.length > 0 ? 1 : 0);
