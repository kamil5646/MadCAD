import { describe, expect, it } from 'vitest';
import { resolveReferenceSketchIds, resolveVisibleSketchId } from './sketch-visibility.js';

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

  it('podczas edycji zachowuje wcześniejsze niepuste szkice jako kontekst', () => {
    expect(resolveReferenceSketchIds({
      activeSketchId: 'sketch-3',
      sketches: [
        { id: 'sketch-1', entities: [{ id: 'line-1', type: 'line' }] },
        { id: 'sketch-2', entities: [{ id: 'point-1', type: 'point' }] },
        { id: 'sketch-3', entities: [{ id: 'line-2', type: 'line' }] },
      ],
    })).toEqual(['sketch-1']);
  });
});
