import { describe, expect, it } from 'vitest';
import {
  alternateModifierPressed,
  formatShortcut,
  multipleSelectionLabel,
  primaryModifierPressed,
} from './platform-shortcuts.js';

describe('platform shortcuts', () => {
  it('uses Command on macOS and Control elsewhere', () => {
    expect(primaryModifierPressed({ metaKey: true }, 'darwin')).toBe(true);
    expect(primaryModifierPressed({ ctrlKey: true }, 'darwin')).toBe(false);
    expect(primaryModifierPressed({ ctrlKey: true }, 'win32')).toBe(true);
    expect(primaryModifierPressed({ metaKey: true }, 'win32')).toBe(false);
  });

  it('renders native shortcut labels', () => {
    expect(formatShortcut('CTRL+Z', 'darwin')).toBe('⌘ Z');
    expect(formatShortcut('CTRL+SHIFT+Z', 'darwin')).toBe('⌘ ⇧ Z');
    expect(formatShortcut('CTRL+ENTER', 'win32')).toBe('Ctrl+Enter');
    expect(formatShortcut('ALT', 'darwin')).toBe('⌥ Option');
    expect(formatShortcut('DEL', 'darwin')).toBe('⌫');
    expect(multipleSelectionLabel('darwin')).toBe('⌘/Shift');
  });

  it('recognizes the physical Option key through altKey', () => {
    expect(alternateModifierPressed({ altKey: true })).toBe(true);
    expect(alternateModifierPressed({ altKey: false })).toBe(false);
  });
});
