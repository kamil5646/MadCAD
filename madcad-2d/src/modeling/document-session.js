import { createStarterDocument, openDocument } from '../cad-core/document.js';

export const AUTOSAVE_KEY = 'madcad:modeling-document:v4';
export const AUTOSAVE_BACKUP_KEY = `${AUTOSAVE_KEY}:backup`;

function parseCandidate(raw, source) {
  if (!raw) return null;
  const opened = openDocument(JSON.parse(raw));
  return {
    ...opened,
    recovered: true,
    recoverySource: source,
  };
}

export function loadInitialDocument(storage = window.localStorage) {
  const primary = storage.getItem(AUTOSAVE_KEY);
  if (primary) {
    try {
      return parseCandidate(primary, 'local-primary');
    } catch (primaryError) {
      const backup = storage.getItem(AUTOSAVE_BACKUP_KEY);
      if (backup) {
        try {
          const recovered = parseCandidate(backup, 'local-backup');
          return {
            ...recovered,
            warning: `Główny autozapis był uszkodzony. Odzyskano poprzednią wersję z kopii lokalnej. ${recovered.warning || ''}`.trim(),
          };
        } catch (_backupError) {
          return {
            document: createStarterDocument(),
            readOnly: false,
            warning: `Nie udało się odtworzyć autozapisu: ${primaryError.message}. Utworzono bezpieczny dokument startowy.`,
            sourceVersion: null,
            originalDocument: null,
            recovered: false,
            recoverySource: null,
          };
        }
      }
      return {
        document: createStarterDocument(),
        readOnly: false,
        warning: `Nie udało się odtworzyć autozapisu: ${primaryError.message}. Utworzono bezpieczny dokument startowy.`,
        sourceVersion: null,
        originalDocument: null,
        recovered: false,
        recoverySource: null,
      };
    }
  }

  const backup = storage.getItem(AUTOSAVE_BACKUP_KEY);
  if (backup) {
    try {
      const recovered = parseCandidate(backup, 'local-backup');
      return {
        ...recovered,
        warning: `Odzyskano projekt z lokalnej kopii autozapisu. ${recovered.warning || ''}`.trim(),
      };
    } catch (_error) {
      // Uszkodzona osierocona kopia nie powinna blokować uruchomienia aplikacji.
    }
  }

  return {
    document: createStarterDocument(),
    readOnly: false,
    warning: '',
    sourceVersion: null,
    originalDocument: null,
    recovered: false,
    recoverySource: null,
  };
}

export function writeLocalAutosave(serializedDocument, storage = window.localStorage) {
  const text = String(serializedDocument || '');
  if (!text) throw new Error('Autozapis nie może być pusty.');
  const previous = storage.getItem(AUTOSAVE_KEY);
  if (previous && previous !== text) storage.setItem(AUTOSAVE_BACKUP_KEY, previous);
  storage.setItem(AUTOSAVE_KEY, text);
}

export function clearLocalAutosave(storage = window.localStorage) {
  storage.removeItem(AUTOSAVE_KEY);
  storage.removeItem(AUTOSAVE_BACKUP_KEY);
}

export function documentModifiedAt(document) {
  const value = Date.parse(document?.metadata?.modifiedAt || '');
  return Number.isFinite(value) ? value : 0;
}
