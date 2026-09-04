import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkerRecoveryPolicy } from './worker-runtime.js';

const MAX_WORKER_RESTARTS = 3;

function engineError(message, code = 'CAD_ENGINE_ERROR') {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function useCadEngine(document, { quality = 'display' } = {}) {
  const workerRef = useRef(null);
  const requestsRef = useRef(new Map());
  const requestIdRef = useRef(0);
  const revisionRef = useRef(0);
  const recoveryPolicyRef = useRef(new WorkerRecoveryPolicy({ maxAttempts: MAX_WORKER_RESTARTS }));
  const [workerGeneration, setWorkerGeneration] = useState(0);
  const [state, setState] = useState({
    status: 'loading',
    bodies: [],
    timeline: [],
    dependencyGraph: { nodes: [], edges: [] },
    revision: 0,
    cache: { entries: 0, bytes: 0 },
    diagnostics: [],
    analysis: { collisions: [], collisionStatus: 'not-run', candidatePairs: 0, exactPairs: 0 },
    performance: null,
    error: '',
    evaluatedDocument: null,
  });

  const rejectPending = useCallback((error) => {
    for (const request of requestsRef.current.values()) request.reject(error);
    requestsRef.current.clear();
  }, []);

  useEffect(() => {
    let disposed = false;
    let restartTimer = null;
    const worker = new Worker(new URL('./cad-worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    setState((current) => ({
      ...current,
      ...(current.evaluatedDocument?.id !== document.id ? {
        bodies: [],
        timeline: [],
        dependencyGraph: { nodes: [], edges: [] },
        evaluatedDocument: null,
        analysis: { collisions: [], collisionStatus: 'not-run', candidatePairs: 0, exactPairs: 0 },
        performance: null,
        cache: { entries: 0, bytes: 0 },
        diagnostics: [],
      } : {}),
      status: workerGeneration === 0 ? 'loading' : 'recovering',
      error: workerGeneration === 0 ? '' : 'Odtwarzanie silnika CAD po awarii…',
    }));

    const onMessage = (event) => {
      const request = requestsRef.current.get(event.data.id);
      if (!request) return;
      requestsRef.current.delete(event.data.id);
      if (event.data.ok) {
        recoveryPolicyRef.current.recordSuccess();
        request.resolve(event.data.result);
      } else {
        const error = engineError(event.data.error || 'Błąd silnika CAD.', event.data.code);
        error.canceled = Boolean(event.data.canceled);
        request.reject(error);
      }
    };

    const onFatalWorkerError = (event) => {
      if (disposed) return;
      const message = event?.message || 'Worker CAD zakończył działanie.';
      const crash = engineError(message, 'WORKER_CRASH');
      rejectPending(crash);
      workerRef.current = null;
      const recovery = recoveryPolicyRef.current.recordCrash();
      const attempt = recovery.attempt;
      if (!recovery.shouldRestart) {
        setState((current) => ({
          ...current,
          status: 'error',
          error: `Nie udało się odtworzyć silnika CAD po ${MAX_WORKER_RESTARTS} próbach. ${message}`,
          diagnostics: [...current.diagnostics, { code: 'WORKER_CRASH', message, attempt }],
        }));
        return;
      }
      setState((current) => ({
        ...current,
        status: 'recovering',
        error: `Silnik CAD uległ awarii. Próba odtworzenia ${attempt}/${MAX_WORKER_RESTARTS}…`,
        diagnostics: [...current.diagnostics, { code: 'WORKER_CRASH', message, attempt }],
      }));
      restartTimer = window.setTimeout(() => setWorkerGeneration((generation) => generation + 1), recovery.delayMs);
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onFatalWorkerError);
    worker.addEventListener('messageerror', onFatalWorkerError);
    return () => {
      disposed = true;
      if (restartTimer) window.clearTimeout(restartTimer);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onFatalWorkerError);
      worker.removeEventListener('messageerror', onFatalWorkerError);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      rejectPending(engineError('Silnik CAD został zatrzymany.', 'WORKER_STOPPED'));
    };
  }, [document.id, rejectPending, workerGeneration]);

  const send = useCallback((message) => new Promise((resolve, reject) => {
    if (!workerRef.current) {
      reject(engineError('Silnik CAD nie jest jeszcze gotowy.', 'WORKER_NOT_READY'));
      return;
    }
    requestIdRef.current += 1;
    const id = requestIdRef.current;
    requestsRef.current.set(id, { resolve, reject, revision: message.revision });
    workerRef.current.postMessage({ ...message, id });
  }), []);

  useEffect(() => {
    let active = true;
    revisionRef.current += 1;
    const revision = revisionRef.current;
    const timeout = window.setTimeout(async () => {
      setState((current) => ({ ...current, status: 'computing', revision, error: '' }));
      try {
        const result = await send({ type: 'evaluate', document, revision, quality });
        if (active && result.revision === revision) {
          setState((current) => ({ ...current, status: 'ready', error: '', ...result, evaluatedDocument: document }));
        }
      } catch (error) {
        if (!active || error.code === 'STALE_REVISION' || error.code === 'WORKER_STOPPED' || error.code === 'WORKER_CRASH') return;
        setState((current) => ({
          ...current,
          status: 'error',
          error: error.message,
          diagnostics: [...current.diagnostics, { code: error.code, message: error.message, revision }],
        }));
      }
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [document, quality, send, workerGeneration]);

  const exportModel = useCallback(async (format, { validateRoundTrip = false } = {}) => {
    const revision = revisionRef.current;
    const result = await send({ type: 'export', format, document, revision, validateRoundTrip });
    if (result.revision !== revision) throw engineError('Silnik zwrócił eksport z innej rewizji dokumentu.', 'EXPORT_REVISION_MISMATCH');
    return validateRoundTrip ? result : result.buffers;
  }, [document, send]);

  const exportExternalDocument = useCallback(async (externalDocument, format = 'step') => {
    const result = await send({ type: 'export-document', format, document: externalDocument });
    return result.buffers;
  }, [send]);

  const analyzeCollisions = useCallback(async () => {
    const revision = revisionRef.current;
    setState((current) => ({
      ...current,
      analysis: { ...current.analysis, collisionStatus: 'running' },
    }));
    const result = await send({ type: 'analyze-collisions', document, revision });
    if (result.revision !== revision || revisionRef.current !== revision) throw engineError('Silnik zwrócił analizę z innej rewizji dokumentu.', 'ANALYSIS_REVISION_MISMATCH');
    setState((current) => ({ ...current, analysis: result.analysis, performance: result.performance }));
    return result.analysis;
  }, [document, send]);

  const restartWorkerForTest = useCallback(() => {
    if (!workerRef.current) throw engineError('Silnik CAD nie jest gotowy do testu odtwarzania.', 'WORKER_NOT_READY');
    const crash = engineError('Kontrolowana awaria workera w teście desktopowym.', 'WORKER_CRASH');
    rejectPending(crash);
    const recovery = recoveryPolicyRef.current.recordCrash();
    setState((current) => ({
      ...current,
      status: 'recovering',
      error: crash.message,
      diagnostics: [...current.diagnostics, { code: crash.code, message: crash.message, attempt: recovery.attempt }],
    }));
    setWorkerGeneration((generation) => generation + 1);
  }, [rejectPending]);

  return { ...state, analyzeCollisions, exportExternalDocument, exportModel, restartWorkerForTest };
}
