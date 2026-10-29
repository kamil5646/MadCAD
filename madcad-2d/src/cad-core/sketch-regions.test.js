import { describe, expect, it } from 'vitest';
import { createDocument, createFeature, createSketch, validateDocument } from './document.js';
import { prepareDocument } from './evaluator.js';
import { refreshDetectedSketchProfiles } from './sketch-topology.js';
import { arrangeSketchRegions, trimResolvedSegment } from './sketch-regions.js';
import { circleCenterRadius, rectangleTwoPoints } from './sketch-primitives.js';
import { createSketchLine, createSketchPoint } from './sketch-model.js';

const line = (id, start, end) => ({ id, type: 'line', start, end });
const rectangle = (prefix, [x0, y0], [x1, y1]) => [
  line(`${prefix}1`, [x0, y0], [x1, y0]),
  line(`${prefix}2`, [x1, y0], [x1, y1]),
  line(`${prefix}3`, [x1, y1], [x0, y1]),
  line(`${prefix}4`, [x0, y1], [x0, y0]),
];
const areas = (result) => result.regions.map((region) => Number(region.area.toFixed(3))).sort((a, b) => a - b);

describe('arrangeSketchRegions', () => {
  it('splits two overlapping rectangles into three areas', () => {
    const result = arrangeSketchRegions([...rectangle('a', [0, 0], [20, 20]), ...rectangle('b', [10, 10], [30, 30])]);
    expect(areas(result)).toEqual([100, 300, 300]);
    expect(result.openEnds).toHaveLength(0);
  });

  it('cuts a circle into two halves with a line through its centre', () => {
    const result = arrangeSketchRegions([{ id: 'c', type: 'circle', center: [0, 0], radius: 10 }, line('l', [-15, 0], [15, 0])]);
    expect(result.regions).toHaveLength(2);
    result.regions.forEach((region) => expect(region.area).toBeCloseTo(Math.PI * 50, 0));
    expect(result.openEnds).toHaveLength(2);
  });

  it('splits a rectangle with a line ending on two of its sides (T-junctions)', () => {
    expect(areas(arrangeSketchRegions([...rectangle('r', [0, 0], [40, 20]), line('t', [10, 0], [10, 20])]))).toEqual([200, 600]);
  });

  it('makes a nested circle a hole of the area around it and an area of its own', () => {
    const result = arrangeSketchRegions([...rectangle('r', [0, 0], [40, 40]), { id: 'c', type: 'circle', center: [20, 20], radius: 5 }]);
    expect(result.regions).toHaveLength(2);
    const plate = result.regions.find((region) => region.holes.length);
    expect(plate.holes[0].steps.map((step) => step.edge.id)).toEqual(['c']);
  });

  it('reports collinear overlapping lines instead of guessing', () => {
    expect(arrangeSketchRegions([line('a', [0, 0], [20, 0]), line('b', [10, 0], [30, 0])]).overlaps).toEqual([['a', 'b']]);
  });
});

describe('ranged profile loops', () => {
  it('trims a circle piece into an arc', () => {
    const arc = trimResolvedSegment({ type: 'circle', id: 'c', center: [0, 0], radius: 10 }, [0, 0.25]);
    expect(arc.type).toBe('arc');
    expect(arc.start[0]).toBeCloseTo(10);
    expect(arc.end[1]).toBeCloseTo(10);
  });

  it('turns crossing sketch geometry into valid extrudable profiles', () => {
    const sketch = createSketch({ name: 'Krzyż' });
    sketch.entities.push(...rectangleTwoPoints([0, 0], [20, 20]).entities, ...circleCenterRadius([20, 20], 8).entities);
    const start = createSketchPoint({ x: -5, y: 10 });
    const end = createSketchPoint({ x: 30, y: 10 });
    sketch.entities.push(start, end, createSketchLine({ startPointId: start.id, endPointId: end.id }));
    refreshDetectedSketchProfiles(sketch, []);
    expect(sketch.profiles.length).toBeGreaterThanOrEqual(4);
    const document = createDocument('Obszary');
    document.sketches.push(sketch);
    document.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: sketch.profiles.map((profile) => profile.id), distance: '5', operation: 'new' }));
    expect(validateDocument(document).errors).toEqual([]);
    const prepared = prepareDocument(document).features[0];
    expect(prepared.profiles.every((profile) => profile.geometry.segments.length >= 2)).toBe(true);
  });
});
