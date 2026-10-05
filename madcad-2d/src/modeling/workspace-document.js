import { useCallback, useMemo, useState } from 'react';
import { cloneDocument, openDocument, touchDocument } from '../cad-core/document.js';

export function useDocumentHistory(initialDocument) {
  // `generation` changes only when a different document replaces the current one
  // (open, new, recovery), never on edits, undo or redo.
  const [history, setHistory] = useState({ past: [], present: initialDocument, future: [], generation: 0 });
  const commit = useCallback((mutator) => {
    setHistory((current) => {
      const next = cloneDocument(current.present);
      mutator(next);
      touchDocument(next);
      return { ...current, past: [...current.past.slice(-59), current.present], present: next, future: [] };
    });
  }, []);
  const replace = useCallback((document) => setHistory((current) => ({ past: [], present: document, future: [], generation: current.generation + 1 })), []);
  const synchronize = useCallback((mutator) => setHistory((current) => {
    const next = cloneDocument(current.present);
    mutator(next);
    touchDocument(next);
    return { ...current, present: next };
  }), []);
  const undo = useCallback(() => setHistory((current) => current.past.length ? {
    ...current,
    past: current.past.slice(0, -1),
    present: current.past.at(-1),
    future: [current.present, ...current.future],
  } : current), []);
  const redo = useCallback(() => setHistory((current) => current.future.length ? {
    ...current,
    past: [...current.past, current.present],
    present: current.future[0],
    future: current.future.slice(1),
  } : current), []);
  return useMemo(() => ({
    document: history.present,
    generation: history.generation,
    commit,
    replace,
    synchronize,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }), [commit, history.future.length, history.generation, history.past.length, history.present, redo, replace, synchronize, undo]);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeName(value) {
  return value.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'model';
}

export function prepareProjectSave(document) {
  const text = JSON.stringify(document, null, 2);
  return {
    text,
    snapshot: JSON.stringify(document),
    defaultName: `${safeName(document.name)}.madcad`,
    filters: [{ name: 'Projekt MadCAD', extensions: ['madcad'] }, { name: 'JSON', extensions: ['json'] }],
  };
}

export async function readProjectFile(file) {
  if (!file?.text) throw new Error('Nie wybrano pliku projektu.');
  const opened = openDocument(JSON.parse(await file.text()));
  return { ...opened, filePath: file.path || file.name || '' };
}
