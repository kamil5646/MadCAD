// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('updates the next release body along with product metadata without rewriting history', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'madcad-version-test-'));
  const app = path.join(temporary, 'madcad-2d');
  const files = ['package.json', 'package-lock.json', 'README.md', 'FIRST_PART.md', 'src/App.test.jsx', 'src/modeling/AppDialogs.jsx', 'src/modeling/i18n.js', 'server/seohost/madcad-site/index.html', '../README.md', '../docs/index.html', '../.github/workflows/release.yml', 'scripts/set-release-version.cjs', 'CHANGELOG.md'];
  try {
    for (const file of files) {
      const target = path.resolve(app, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.resolve(root, file), target);
    }
    const originalChangelog = fs.readFileSync(path.join(app, 'CHANGELOG.md'), 'utf8');
    execFileSync(process.execPath, [path.join(app, 'scripts/set-release-version.cjs'), '6.5.30']);
    expect(JSON.parse(fs.readFileSync(path.join(app, 'package.json'))).version).toBe('6.5.30');
    const workflow = fs.readFileSync(path.join(temporary, '.github/workflows/release.yml'), 'utf8');
    expect(workflow).toContain('CAD 2D/3D — 6.5.30');
    expect(workflow).not.toContain(`CAD 2D/3D — ${version}`);
    expect(fs.readFileSync(path.join(app, 'CHANGELOG.md'), 'utf8')).toBe(originalChangelog);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
