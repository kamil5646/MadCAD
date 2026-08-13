import { describe, expect, it } from 'vitest';
import { createDocument } from '../cad-core/document.js';
import {
  AUTOSAVE_BACKUP_KEY,
  AUTOSAVE_KEY,
  clearLocalAutosave,
  hasUnsavedSession,
  loadInitialDocument,
  writeLocalAutosave,
} from './document-session.js';

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe('document session persistence', () => {
  it('rotates the previous local autosave into a backup and clears both copies', () => {
    const storage = memoryStorage();
    const first = JSON.stringify(createDocument('Pierwszy'));
    const second = JSON.stringify(createDocument('Drugi'));

    writeLocalAutosave(first, storage);
    writeLocalAutosave(second, storage);

    expect(storage.getItem(AUTOSAVE_KEY)).toBe(second);
    expect(storage.getItem(AUTOSAVE_BACKUP_KEY)).toBe(first);
    clearLocalAutosave(storage);
    expect(storage.getItem(AUTOSAVE_KEY)).toBeNull();
    expect(storage.getItem(AUTOSAVE_BACKUP_KEY)).toBeNull();
  });

  it('recovers the backup when the primary snapshot is corrupted', () => {
    const backup = createDocument('Odzyskany');
    const storage = memoryStorage({
      [AUTOSAVE_KEY]: '{uszkodzony',
      [AUTOSAVE_BACKUP_KEY]: JSON.stringify(backup),
    });

    const opened = loadInitialDocument(storage);

    expect(opened.document.name).toBe('Odzyskany');
    expect(opened.recovered).toBe(true);
    expect(opened.recoverySource).toBe('local-backup');
    expect(opened.warning).toMatch(/Odzyskano poprzednią wersję/);
  });

  it('preserves recovered read-only sessions until the user explicitly discards them', () => {
    expect(hasUnsavedSession({ readOnly: true, savedDocumentText: null, serializedDocument: '{"projected":true}' })).toBe(true);
    expect(hasUnsavedSession({ readOnly: true, savedDocumentText: '{"saved":true}', serializedDocument: '{"projected":true}' })).toBe(false);
    expect(hasUnsavedSession({ readOnly: false, savedDocumentText: '{"saved":true}', serializedDocument: '{"changed":true}' })).toBe(true);
  });
});
