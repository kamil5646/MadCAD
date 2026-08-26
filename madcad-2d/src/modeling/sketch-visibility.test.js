import { describe, expect, it } from 'vitest';
import { resolveVisibleSketchId } from './sketch-visibility.js';

describe('resolveVisibleSketchId', () => {
  it('zachowuje aktywny albo zaznaczony szkic', () => {
    expect(resolveVisibleSketchId({ activeSketchId: 'active', selection: { sketchId: 'selected' } })).toBe('active');
    expect(resolveVisibleSketchId({ selection: { kind: 'profile', sketchId: 'selected' } })).toBe('selected');
  });

  it('pokazuje ostatni szkic po otwarciu lub odzyskaniu projektu bez bryły', () => {
    expect(resolveVisibleSketchId({
      sketches: [{ id: 'sketch-1' }, { id: 'sketch-2' }],
      bodyCount: 0,
    })).toBe('sketch-2');
  });

  it('nie nakłada niezaznaczonego szkicu na istniejącą bryłę', () => {
    expect(resolveVisibleSketchId({ sketches: [{ id: 'sketch-1' }], bodyCount: 1 })).toBeNull();
  });
});
