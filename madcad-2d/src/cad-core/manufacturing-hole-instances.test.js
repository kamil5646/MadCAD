import { describe, expect, it } from 'vitest';
import { expandPatternedHoleInstances } from './manufacturing-hole-instances.js';

const hole = {
  position: [10, 0, 8],
  direction: [0, 0, -1],
  depth: 8,
  instances: [{ position: [10, 0, 8], direction: [0, 0, -1], depth: 8 }],
};

describe('manufacturing hole instances', () => {
  it('copies positions for rectangular and path translations without changing the drilling axis', () => {
    const instances = expandPatternedHoleInstances(hole, { patternType: 'rectangular' }, [[20, 0, 0], [0, 15, 0], [20, 15, 0]]);
    expect(instances.map((instance) => instance.position)).toEqual([[10, 0, 8], [30, 0, 8], [10, 15, 8], [30, 15, 8]]);
    expect(instances.every((instance) => instance.direction[2] === -1)).toBe(true);
  });

  it('rotates positions and axes around the requested circular-pattern axis', () => {
    const instances = expandPatternedHoleInstances(hole, {
      patternType: 'circular',
      occurrencesValue: 4,
      totalAngleValue: 360,
      axis: { origin: [0, 0, 0], direction: [0, 0, 1] },
    });
    expect(instances).toHaveLength(4);
    expect(instances[1].position[0]).toBeCloseTo(0);
    expect(instances[1].position[1]).toBeCloseTo(10);
    expect(instances[2].position[0]).toBeCloseTo(-10);
    expect(instances[3].position[1]).toBeCloseTo(-10);
    expect(instances.every((instance) => instance.direction[2] === -1)).toBe(true);
  });
});
