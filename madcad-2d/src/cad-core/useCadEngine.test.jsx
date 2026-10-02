import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCadEngine } from './useCadEngine.js';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('rejects drawing export during the debounce even when the previous state is ready', async () => {
  vi.useFakeTimers();
  const messages = [];
  class TestWorker {
    listeners = new Map();
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type) { this.listeners.delete(type); }
    terminate() {}
    postMessage(message) {
      messages.push(message);
      queueMicrotask(() => this.listeners.get('message')?.({ data: {
        id: message.id, ok: true, result: message.type === 'evaluate'
          ? { revision: message.revision, bodies: [{ id: 'a' }] }
          : { revision: message.revision, projections: {} },
      } }));
    }
  }
  vi.stubGlobal('Worker', TestWorker);
  const initial = { id: 'project', features: [{ distance: 10 }] };
  const { result, rerender } = renderHook(({ document }) => useCadEngine(document), { initialProps: { document: initial } });
  await act(async () => { await vi.advanceTimersByTimeAsync(121); });
  expect(result.current.status).toBe('ready');
  expect(result.current.isCurrent).toBe(true);
  const previousRevision = result.current.revision;
  rerender({ document: { ...initial, features: [{ distance: 20 }] } });
  expect(result.current.status).toBe('ready');
  expect(result.current.revision).toBe(previousRevision);
  expect(result.current.getCurrentRevision()).toBeNull();
  expect(result.current.isCurrent).toBe(false);
  await expect(result.current.projectDrawingViews(['front'])).rejects.toThrow('przebudowy');
  expect(messages.filter((message) => message.type === 'project-drawing')).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(121); });
  expect(result.current.isCurrent).toBe(true);
  await expect(result.current.projectDrawingViews(['front'])).resolves.toEqual({});
});
