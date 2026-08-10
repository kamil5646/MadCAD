import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

// Regression test for the "license na razie w kosz" change: the license
// activation gate is disabled by commenting out the #licenseOverlay markup
// in index.html. cad-engine.js relies on `document.getElementById(
// "licenseOverlay")` returning null to permanently unlock the app at boot
// (see initializeLicenseManager()). If someone accidentally reintroduces a
// live #licenseOverlay element (or breaks the HTML comment), the app would
// silently start requiring a license again - this test guards against that.
describe('license gate disabled', () => {
  it('index.html has no live #licenseOverlay element', () => {
    const indexHtmlPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'index.html'
    );
    const html = readFileSync(indexHtmlPath, 'utf8');
    const dom = new JSDOM(html);
    expect(dom.window.document.getElementById('licenseOverlay')).toBeNull();
  });
});
