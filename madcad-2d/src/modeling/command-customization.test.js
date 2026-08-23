import { describe, expect, it } from 'vitest';
import {
  COMMAND_CUSTOMIZATION_KEY,
  createDefaultCommandCustomization,
  loadCommandCustomization,
  saveCommandCustomization,
  validateCommandCustomization,
} from './command-customization.js';
import { commandSuggestions, parseCommandLineInput } from './command-controller.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe('command customization', () => {
  it('uses Autodesk defaults and accepts a unique alias and direct key', () => {
    const customization = createDefaultCommandCustomization();
    customization.commands.Linia = { alias: 'XL', shortcut: 'G' };
    const validation = validateCommandCustomization(customization);
    expect(validation.valid).toBe(true);
    expect(parseCommandLineInput('xl', validation.customization)).toMatchObject({ type: 'command', command: { label: 'Linia' } });
    expect(commandSuggestions('x', 6, validation.customization)[0]).toMatchObject({ command: 'XL', shortcut: 'G', label: 'Linia' });
  });

  it('rejects duplicate aliases, duplicate keys and reserved names', () => {
    const customization = createDefaultCommandCustomization();
    customization.commands.Linia.alias = 'P';
    customization.commands.Linia.shortcut = 'R';
    const validation = validateCommandCustomization(customization);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('Alias „P”');
    expect(validation.errors.join(' ')).toContain('Klawisz „R”');
  });

  it('persists valid settings and falls back safely after corrupt storage', () => {
    const storage = memoryStorage();
    const customization = createDefaultCommandCustomization();
    customization.commands.Okrąg = { alias: 'KOLO', shortcut: 'K' };
    saveCommandCustomization(customization, storage);
    expect(loadCommandCustomization(storage).commands.Okrąg).toEqual({ alias: 'KOLO', shortcut: 'K' });
    storage.setItem(COMMAND_CUSTOMIZATION_KEY, '{bad json');
    expect(loadCommandCustomization(storage).commands.Okrąg.alias).toBe('C');
  });
});
