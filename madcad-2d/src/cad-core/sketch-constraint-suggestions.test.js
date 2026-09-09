import { describe, expect, it } from 'vitest';
import { createSketchLine, createSketchPoint } from './sketch-model.js';
import { addAutomaticConstraintsForLine, allowsDirectionalConstraintSuggestion, inferLineConstraintSuggestion } from './sketch-constraint-suggestions.js';

describe('automatic sketch constraint suggestions', () => {
  it('recognizes horizontal and vertical intent and adjusts only the free axis', () => {
    expect(inferLineConstraintSuggestion([0, 0], [20, 0.8])).toMatchObject({ type: 'horizontal', code: 'H', adjustedEnd: [20, 0] });
    expect(inferLineConstraintSuggestion([3, 4], [3.2, 30])).toMatchObject({ type: 'vertical', code: 'V', adjustedEnd: [3, 30] });
    expect(inferLineConstraintSuggestion([0, 0], [20, 8])).toBeNull();
  });

  it('adds directional and coincident constraints once', () => {
    const start = createSketchPoint({ x: 0, y: 0 });
    const end = createSketchPoint({ x: 20, y: 0 });
    const existing = createSketchPoint({ x: 20, y: 0 });
    const line = createSketchLine({ startPointId: start.id, endPointId: end.id });
    const sketch = { entities: [start, end, existing, line], constraints: [] };
    const first = addAutomaticConstraintsForLine(sketch, line.id);
    const second = addAutomaticConstraintsForLine(sketch, line.id);
    expect(first.map((constraint) => constraint.type)).toEqual(['horizontal', 'coincident']);
    expect(first.every((constraint) => constraint.automatic)).toBe(true);
    expect(second).toEqual([]);
    expect(sketch.constraints).toHaveLength(2);
  });

  it('keeps directional suggestions visible for axis and grid snaps only', () => {
    expect(allowsDirectionalConstraintSuggestion(null)).toBe(true);
    expect(allowsDirectionalConstraintSuggestion({ snapped: false, type: null })).toBe(true);
    expect(allowsDirectionalConstraintSuggestion({ snapped: true, type: 'horizontal' })).toBe(true);
    expect(allowsDirectionalConstraintSuggestion({ snapped: true, type: 'vertical' })).toBe(true);
    expect(allowsDirectionalConstraintSuggestion({ snapped: true, type: 'grid' })).toBe(true);
    expect(allowsDirectionalConstraintSuggestion({ snapped: true, type: 'endpoint' })).toBe(false);
    expect(allowsDirectionalConstraintSuggestion({ snapped: true, type: 'intersection' })).toBe(false);
  });
});
