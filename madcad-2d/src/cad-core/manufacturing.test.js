import { describe, expect, it } from 'vitest';
import {
  calculateContourToolpath,
  calculatePocketToolpath,
  createContourOperation,
  createGrblGcode,
  createManufacturingSetup,
  createPocketOperation,
  extractTopBoundaryLoops,
  offsetClosedContour,
  validateManufacturing,
} from './manufacturing.js';

const box = {
  id: 'body-box',
  name: 'Korpus',
  bounds: [[0, 0, 0], [40, 20, 10]],
  vertices: new Float32Array([
    0, 0, 0, 40, 0, 0, 40, 20, 0, 0, 20, 0,
    0, 0, 10, 40, 0, 10, 40, 20, 10, 0, 20, 10,
  ]),
  triangles: new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
  ]),
};

describe('CAM contour operations', () => {
  it('extracts the true closed top boundary and offsets it outside', () => {
    const loops = extractTopBoundaryLoops(box);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
    const offset = offsetClosedContour(loops[0], 3);
    const xs = offset.map((point) => point[0]);
    const ys = offset.map((point) => point[1]);
    expect(Math.min(...xs)).toBeCloseTo(-3);
    expect(Math.max(...xs)).toBeCloseTo(43);
    expect(Math.min(...ys)).toBeCloseTo(-3);
    expect(Math.max(...ys)).toBeCloseTo(23);
  });

  it('creates layered contour toolpaths and dispatches them to GRBL export', () => {
    const setup = createManufacturingSetup({ bodyId: box.id, stock: { sideOffset: 2, topOffset: 2, bottomOffset: 0 } });
    const operation = createContourOperation({ targetDepth: 3, maxStepdown: 1, toolId: 'flat-6' });
    setup.operations.push(operation);
    const toolpath = calculateContourToolpath(setup, operation, [box]);
    expect(toolpath.valid).toBe(true);
    expect(toolpath.layerCount).toBe(3);
    expect(toolpath.contourPointCount).toBe(4);
    expect(toolpath.segments.filter((segment) => segment.kind === 'cut')).toHaveLength(12);
    expect(validateManufacturing({ setups: [setup], activeSetupId: setup.id })).toEqual([]);
    const output = createGrblGcode(setup, operation, [box], { projectName: 'Kontur test' });
    expect(output.text).toContain('; Kontur test');
    expect(output.text).toContain('G1 X-23 Y-13 Z-3');
    expect(output.text).toContain('M30');
  });

  it('rejects a cut deeper than the tool flute', () => {
    const setup = createManufacturingSetup({ bodyId: box.id });
    const operation = createContourOperation({ targetDepth: 21, toolId: 'flat-6' });
    expect(calculateContourToolpath(setup, operation, [box]).warnings.join(' ')).toContain('długość ostrza');
  });

  it('clears a pocket with scanlines kept inside the compensated boundary', () => {
    const setup = createManufacturingSetup({ bodyId: box.id });
    const operation = createPocketOperation({ targetDepth: 2, maxStepdown: 1, stepover: 0.5, toolId: 'flat-6' });
    setup.operations.push(operation);
    const toolpath = calculatePocketToolpath(setup, operation, [box]);
    expect(toolpath.valid).toBe(true);
    expect(toolpath.layerCount).toBe(2);
    expect(toolpath.rowCount).toBeGreaterThanOrEqual(5);
    const cuts = toolpath.segments.filter((segment) => segment.kind === 'cut');
    expect(cuts.length).toBe(toolpath.rowCount * 2);
    for (const segment of cuts) {
      expect(segment.from[0]).toBeGreaterThanOrEqual(3);
      expect(segment.to[0]).toBeLessThanOrEqual(37);
      expect(segment.from[1]).toBeGreaterThanOrEqual(3);
      expect(segment.to[1]).toBeLessThanOrEqual(17);
    }
    expect(createGrblGcode(setup, operation, [box]).text).toContain('Kieszeń 2D');
  });
});
