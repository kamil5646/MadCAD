import { describe, expect, it } from 'vitest';
import { calculateExplodedOffsets } from './exploded-view.js';

describe('exploded view', () => {
  it('moves occurrences away from their shared center without changing input positions', () => {
    const occurrences = [{ id: 'right', position: [10, 0, 0] }, { id: 'left', position: [-10, 0, 0] }];
    const offsets = calculateExplodedOffsets(occurrences, 0.5, 40);
    expect(offsets.left).toEqual([-20, 0, 0]);
    expect(offsets.right).toEqual([20, 0, 0]);
    expect(occurrences[0].position).toEqual([10, 0, 0]);
  });

  it('uses deterministic radial directions for coincident occurrences and clamps the amount', () => {
    const offsets = calculateExplodedOffsets([{ id: 'a', position: [0, 0, 0] }, { id: 'b', position: [0, 0, 0] }], 2, 25);
    expect(Math.hypot(...offsets.a)).toBeCloseTo(25);
    expect(Math.hypot(...offsets.b)).toBeCloseTo(25);
    expect(offsets.a).not.toEqual(offsets.b);
    expect(calculateExplodedOffsets([{ id: 'a' }], 0, 25).a).toEqual([0, 0, 0]);
  });
});
