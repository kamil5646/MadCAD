import { describe, expect, it } from 'vitest';
import { createSketch } from './document.js';
import { createSketchConstraint, createSketchLine, createSketchPoint } from './sketch-model.js';
import { analyzeSketchConstraints } from './sketch-solver.js';
import { describeSketchDegreesOfFreedom } from './sketch-freedom-diagnostics.js';

describe('under-constrained sketch diagnostics', () => {
  it('turns nullspace modes into actionable point and translation descriptions', () => {
    const start = createSketchPoint({ x: 0, y: 0 });
    const end = createSketchPoint({ x: 20, y: 0 });
    const line = createSketchLine({ startPointId: start.id, endPointId: end.id });
    const sketch = createSketch({ entities: [start, end, line], constraints: [createSketchConstraint('horizontal', [line.id])] });
    const result = describeSketchDegreesOfFreedom(sketch, analyzeSketchConstraints(sketch));
    expect(result.total).toBe(3);
    expect(result.modes).toHaveLength(3);
    expect(result.modes.some((mode) => mode.label.includes('Przesunięcie po osi Y'))).toBe(true);
    expect(result.affectedPointIds).toEqual(expect.arrayContaining([start.id, end.id]));
    expect(result.suggestions.join(' ')).toContain('długość');
  });
});

