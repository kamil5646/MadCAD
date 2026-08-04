import { useCallback, useEffect, useRef, useState } from 'react';

export function useCadEngine(document) {
  const workerRef = useRef(null);
  const requestsRef = useRef(new Map());
  const requestIdRef = useRef(0);
  const [state, setState] = useState({ status: 'loading', bodies: [], timeline: [], error: '' });

  useEffect(() => {
    const worker = new Worker(new URL('./cad-worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.addEventListener('message', (event) => {
      const request = requestsRef.current.get(event.data.id);
      if (!request) return;
      requestsRef.current.delete(event.data.id);
      if (event.data.ok) request.resolve(event.data.result);
      else request.reject(new Error(event.data.error));
    });
    worker.addEventListener('error', (event) => {
      setState((current) => ({ ...current, status: 'error', error: event.message || 'Błąd silnika CAD.' }));
    });
    return () => {
      worker.terminate();
      workerRef.current = null;
      for (const request of requestsRef.current.values()) request.reject(new Error('Silnik CAD został zatrzymany.'));
      requestsRef.current.clear();
    };
  }, []);

  const send = useCallback((message) => new Promise((resolve, reject) => {
    if (!workerRef.current) {
      reject(new Error('Silnik CAD nie jest jeszcze gotowy.'));
      return;
    }
    requestIdRef.current += 1;
    const id = requestIdRef.current;
    requestsRef.current.set(id, { resolve, reject });
    workerRef.current.postMessage({ ...message, id });
  }), []);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(async () => {
      setState((current) => ({ ...current, status: 'computing', error: '' }));
      try {
        const result = await send({ type: 'evaluate', document });
        if (active) setState({ status: 'ready', error: '', ...result });
      } catch (error) {
        if (active) setState((current) => ({ ...current, status: 'error', error: error.message }));
      }
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [document, send]);

  const exportModel = useCallback(async (format) => {
    const result = await send({ type: 'export', format });
    return result.buffers;
  }, [send]);

  return { ...state, exportModel };
}
