import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

describe('license reminder mode', () => {
  it('starts hidden and provides an explicit continue button', () => {
    const indexHtmlPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'index.html'
    );
    const html = readFileSync(indexHtmlPath, 'utf8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const overlay = doc.getElementById('licenseOverlay');
    const closeButton = doc.getElementById('licenseCloseBtn');
    const heading = doc.querySelector('.license-header-row h2');

    expect(overlay).not.toBeNull();
    expect(overlay?.hidden).toBe(true);
    expect(overlay?.getAttribute('aria-hidden')).toBe('true');
    expect(closeButton).not.toBeNull();
    expect(closeButton?.textContent).toMatch(/Kontynuuj używanie/i);
    expect(heading?.textContent).toMatch(/Wersja niezarejestrowana/i);
  });
});
