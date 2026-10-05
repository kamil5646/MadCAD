import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards against the interface offering the same command twice or under two
// names (e.g. "Wyciągnij" next to "Naciśnij / wyciągnij" doing the same thing).
const source = fs.readFileSync(path.join(__dirname, 'ModelingWorkspace.jsx'), 'utf8');
const compact = (value) => value.replace(/\s+/g, '');

function displayNamesByLabel() {
  const names = new Map();
  const add = (label, display) => {
    if (!names.has(label)) names.set(label, new Set());
    names.get(label).add(display || label);
  };
  for (const match of source.matchAll(/label="([^"]+)"(?:\s+displayLabel="([^"]+)")?/g)) add(match[1], match[2]);
  for (const match of source.matchAll(/label: '([^']+)'(?:, displayLabel: '([^']+)')?/g)) add(match[1], match[2]);
  return names;
}

function adaptiveShelves() {
  return [...source.matchAll(/adaptiveContext = \{([\s\S]*?)\n {6}\};/g)].map((match) => {
    const block = match[1];
    return {
      block,
      actions: [...block.matchAll(/label: '([^']+)'(?:, displayLabel: '([^']+)')?, onClick: (.*?)(?:, (?:primary|danger|disabled)\b|\s*\})/g)]
        .map((action) => ({ name: action[2] || action[1], handler: compact(action[3]) })),
    };
  });
}

describe('interface naming', () => {
  it('shows every command under a single name', () => {
    // Two entry points into different import flows share an internal label on purpose.
    const allowed = new Set(['Importuj model']);
    const inconsistent = [...displayNamesByLabel()].filter(([label, names]) => names.size > 1 && !allowed.has(label))
      .map(([label, names]) => `${label}: ${[...names].join(' / ')}`);
    expect(inconsistent).toEqual([]);
  });

  it('does not offer the same command twice in one context shelf', () => {
    for (const shelf of adaptiveShelves()) {
      const handlers = shelf.actions.map((action) => action.handler);
      const repeated = handlers.filter((handler, index) => handlers.indexOf(handler) !== index);
      expect(repeated, shelf.actions.map((action) => action.name).join(', ')).toEqual([]);
    }
  });

  it('does not give two different commands the same name in one context shelf', () => {
    for (const shelf of adaptiveShelves()) {
      const byName = new Map();
      for (const action of shelf.actions) {
        if (!byName.has(action.name)) byName.set(action.name, new Set());
        byName.get(action.name).add(action.handler);
      }
      const clashes = [...byName].filter(([, handlers]) => handlers.size > 1).map(([name]) => name);
      expect(clashes).toEqual([]);
    }
  });

  it('has a single extrude command for profiles and faces', () => {
    expect(source).not.toContain('Naciśnij / wyciągnij');
    expect(source).not.toMatch(/openPressPull/);
  });
});
