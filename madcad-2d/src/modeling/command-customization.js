import { COMMAND_DEFINITIONS, normalizeCommandText } from './command-controller.js';

export const COMMAND_CUSTOMIZATION_KEY = 'madcad:command-customization:v1';

function defaultCommandEntry(definition) {
  const directShortcut = definition.shortcut.length === 1 || definition.shortcut === 'DEL' ? definition.shortcut : '';
  return { alias: definition.shortcut, shortcut: directShortcut };
}

export function createDefaultCommandCustomization() {
  return {
    version: 1,
    commands: Object.fromEntries(COMMAND_DEFINITIONS.map((definition) => [definition.label, defaultCommandEntry(definition)])),
  };
}

export function normalizeCommandCustomization(source) {
  const defaults = createDefaultCommandCustomization();
  const commands = {};
  for (const definition of COMMAND_DEFINITIONS) {
    const candidate = source?.commands?.[definition.label] || {};
    commands[definition.label] = {
      alias: normalizeCommandText(candidate.alias || defaults.commands[definition.label].alias),
      shortcut: normalizeCommandText(candidate.shortcut || ''),
    };
  }
  return { version: 1, commands };
}

export function validateCommandCustomization(source) {
  const customization = normalizeCommandCustomization(source);
  const errors = [];
  const aliases = new Map();
  const shortcuts = new Map();
  for (const definition of COMMAND_DEFINITIONS) {
    const entry = customization.commands[definition.label];
    if (!/^[\p{L}0-9_]{1,16}$/u.test(entry.alias)) errors.push(`${definition.label}: alias może zawierać litery, cyfry i podkreślenia.`);
    if (['ESC', 'ESCAPE', 'ENTER', 'ANULUJ'].includes(entry.alias)) errors.push(`${definition.label}: alias „${entry.alias}” jest zarezerwowany.`);
    if (aliases.has(entry.alias)) errors.push(`Alias „${entry.alias}” jest już przypisany do ${aliases.get(entry.alias)}.`);
    else aliases.set(entry.alias, definition.label);
    const builtInOwner = COMMAND_DEFINITIONS.find((candidate) => candidate.label !== definition.label && candidate.aliases.includes(entry.alias));
    if (builtInOwner) errors.push(`Alias „${entry.alias}” jest wbudowaną nazwą polecenia ${builtInOwner.label}.`);
    if (entry.shortcut) {
      if (!/^(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|DEL)$/.test(entry.shortcut)) errors.push(`${definition.label}: klawisz musi być pojedynczą literą, cyfrą, F1–F12 albo DEL.`);
      if (shortcuts.has(entry.shortcut)) errors.push(`Klawisz „${entry.shortcut}” jest już przypisany do ${shortcuts.get(entry.shortcut)}.`);
      else shortcuts.set(entry.shortcut, definition.label);
    }
  }
  return { valid: errors.length === 0, errors, customization };
}

export function loadCommandCustomization(storage = window.localStorage) {
  try {
    const raw = storage.getItem(COMMAND_CUSTOMIZATION_KEY);
    if (!raw) return createDefaultCommandCustomization();
    const validation = validateCommandCustomization(JSON.parse(raw));
    return validation.valid ? validation.customization : createDefaultCommandCustomization();
  } catch (_error) {
    return createDefaultCommandCustomization();
  }
}

export function saveCommandCustomization(customization, storage = window.localStorage) {
  const validation = validateCommandCustomization(customization);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  storage.setItem(COMMAND_CUSTOMIZATION_KEY, JSON.stringify(validation.customization));
  return validation.customization;
}

export function commandCustomizationRows(customization) {
  const normalized = normalizeCommandCustomization(customization);
  return COMMAND_DEFINITIONS.map((definition) => ({
    label: definition.label,
    toolLabel: definition.toolLabel,
    builtInAliases: definition.aliases,
    ...normalized.commands[definition.label],
  }));
}

export function customizationForTool(customization, toolLabel) {
  const definition = COMMAND_DEFINITIONS.find((candidate) => candidate.toolLabel === toolLabel);
  if (!definition) return null;
  const entry = normalizeCommandCustomization(customization).commands[definition.label];
  return { ...entry, label: definition.label };
}
