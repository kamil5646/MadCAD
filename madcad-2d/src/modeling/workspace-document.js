import { useCallback, useMemo, useState } from 'react';
import { cloneDocument, touchDocument } from '../cad-core/document.js';

export function useDocumentHistory(initialDocument) {
  const [history, setHistory] = useState({ past: [], present: initialDocument, future: [] });
  const commit = useCallback((mutator) => {
    setHistory((current) => {
      const next = cloneDocument(current.present);
      mutator(next);
      touchDocument(next);
      return { past: [...current.past.slice(-59), current.present], present: next, future: [] };
    });
  }, []);
  const replace = useCallback((document) => setHistory({ past: [], present: document, future: [] }), []);
  const synchronize = useCallback((mutator) => setHistory((current) => {
    const next = cloneDocument(current.present);
    mutator(next);
    touchDocument(next);
    return { ...current, present: next };
  }), []);
  const undo = useCallback(() => setHistory((current) => current.past.length ? {
    past: current.past.slice(0, -1),
    present: current.past.at(-1),
    future: [current.present, ...current.future],
  } : current), []);
  const redo = useCallback(() => setHistory((current) => current.future.length ? {
    past: [...current.past, current.present],
    present: current.future[0],
    future: current.future.slice(1),
  } : current), []);
  return useMemo(() => ({
    document: history.present,
    commit,
    replace,
    synchronize,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }), [commit, history.future.length, history.past.length, history.present, redo, replace, synchronize, undo]);
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

