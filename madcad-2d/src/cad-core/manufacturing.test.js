import { describe, expect, it } from 'vitest';
import {
  calculateAdaptiveToolpath,
  calculateContourToolpath,
  calculatePocketToolpath,
  analyzeManufacturingProgram,
  analyzeToolpathSafety,
  createContourOperation,
  createAdaptiveOperation,
  createGrblGcode,
  createMachineGcode,
  createManufacturingSetup,
  createPocketOperation,
  extractTopBoundaryLoops,
  offsetClosedContour,
  simulateMaterialRemoval,
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
  faceGroups: [
    { topologyId: 'bottom-face', start: 0, count: 6 },
    { topologyId: 'top-face', start: 6, count: 6 },
    { topologyId: 'side-face', start: 12, count: 6 },
  ],
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
    expect(output.text).not.toContain(' M6');
  });

  it('emits controller-specific safe headers for LinuxCNC and Mach3', () => {
    const setup = createManufacturingSetup({ bodyId: box.id });
    const operation = createContourOperation({ targetDepth: 1 });
    const linuxCnc = createMachineGcode(setup, operation, [box], { postProcessorId: 'linuxcnc' });
    expect(linuxCnc.extension).toBe('ngc');
    expect(linuxCnc.text).toMatch(/^%\n/);
    expect(linuxCnc.text).toContain('G64 P0.01');
    expect(linuxCnc.text).toContain('T2 M6');
    expect(linuxCnc.text).toContain('\nM2\n%');
    const mach3 = createMachineGcode(setup, operation, [box], { postProcessorId: 'mach3' });
    expect(mach3.extension).toBe('tap');
    expect(mach3.text).toContain('G80');
    expect(mach3.text).toContain('\nM30\n');
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

  it('creates constant-load adaptive rings with a ramped entry', () => {
    const setup = createManufacturingSetup({ bodyId: box.id });
    const operation = createAdaptiveOperation({ targetDepth: 2, maxStepdown: 1, optimalLoad: 0.3, toolId: 'flat-6' });
    setup.operations.push(operation);
    const toolpath = calculateAdaptiveToolpath(setup, operation, [box]);
    expect(toolpath.valid).toBe(true);
    expect(toolpath.layerCount).toBe(2);
    expect(toolpath.ringCount).toBeGreaterThan(2);
    expect(toolpath.segments.some((segment) => segment.kind === 'plunge' && segment.to[2] === 10)).toBe(true);
    const firstLayerCuts = toolpath.segments.filter((segment) => segment.kind === 'cut' && segment.to[2] <= 10 && segment.to[2] >= 9);
    expect(firstLayerCuts.some((segment) => segment.to[2] > 9 && segment.to[2] < 10)).toBe(true);
    expect(createGrblGcode(setup, operation, [box]).text).toContain('Adaptacyjne 2D');
  });

  it('keeps an associative XY sketch profile as the machining boundary', () => {
    const document = {
      parameters: [{ name: 'W', expression: '20' }],
      sketches: [{
        id: 'sketch-cam',
        space: '2d',
        plane: 'XY',
        planeOffset: '10',
        profiles: [{ id: 'profile-cam', type: 'rectangle', geometry: { x: '20', y: '10', width: 'W', height: '10' } }],
      }],
    };
    const setup = createManufacturingSetup({ bodyId: box.id });
    const operation = createPocketOperation({ boundarySketchId: 'sketch-cam', boundaryProfileId: 'profile-cam', targetDepth: 1 });
    const toolpath = calculatePocketToolpath(setup, operation, [box], document);
    expect(toolpath.valid).toBe(true);
    const cuts = toolpath.segments.filter((segment) => segment.kind === 'cut');
    expect(Math.min(...cuts.flatMap((segment) => [segment.from[0], segment.to[0]]))).toBeGreaterThanOrEqual(13);
    expect(Math.max(...cuts.flatMap((segment) => [segment.from[0], segment.to[0]]))).toBeLessThanOrEqual(27);
    document.parameters[0].expression = '12';
    const updated = calculatePocketToolpath(setup, operation, [box], document);
    expect(updated.cuttingDistance).toBeLessThan(toolpath.cuttingDistance);
    document.sketches[0].profiles = [];
    expect(calculatePocketToolpath(setup, operation, [box], document).warnings.join(' ')).toContain('już nie istnieje');
  });

  it('blocks unsafe rapid motion and aggregates a setup time/removal report', () => {
    const setup = createManufacturingSetup({ bodyId: box.id });
    const operation = createPocketOperation({ targetDepth: 2 });
    setup.operations.push(operation);
    const toolpath = calculatePocketToolpath(setup, operation, [box]);
    const unsafe = structuredClone(toolpath);
    unsafe.segments.push({ kind: 'rapid', from: [5, 5, 9], to: [20, 5, 9] });
    expect(analyzeToolpathSafety(unsafe).some((issue) => issue.code === 'RAPID_IN_STOCK')).toBe(true);
    const report = analyzeManufacturingProgram(setup, [box]);
    expect(report.valid).toBe(true);
    expect(report.operations).toHaveLength(1);
    expect(report.durationMinutes).toBeGreaterThan(0);
    expect(report.estimatedRemovedVolume).toBeGreaterThan(0);
    expect(report.estimatedRemovalPercent).toBeGreaterThan(0);
  });

  it('rejects a safe plane that is below the stock top', () => {
    const setup = createManufacturingSetup({ bodyId: box.id, wcsOrigin: 'model-origin', safeHeight: 5 });
    expect(analyzeManufacturingProgram(setup, [box]).setupIssues.join(' ')).toContain('Płaszczyzna bezpieczna');
  });

  it('simulates progressive material removal and tracks the cutter', () => {
    const setup = createManufacturingSetup({ bodyId: box.id, stock: { topOffset: 2 } });
    setup.operations.push(createPocketOperation({ targetDepth: 2, maxStepdown: 1 }));
    const start = simulateMaterialRemoval(setup, [box], null, 0, 20);
    const halfway = simulateMaterialRemoval(setup, [box], null, 0.5, 20);
    const finished = simulateMaterialRemoval(setup, [box], null, 1, 20);
    expect(start.removedVolume).toBe(0);
    expect(halfway.removedVolume).toBeGreaterThan(0);
    expect(finished.removedVolume).toBeGreaterThanOrEqual(halfway.removedVolume);
    expect(finished.columns.length).toBeGreaterThan(0);
    expect(finished.cutter.position).toHaveLength(3);
    expect(finished.processedSegments).toBe(finished.totalSegments);
  });

  it('uses a persistent selected horizontal face and rejects a vertical face', () => {
    expect(extractTopBoundaryLoops(box, 'top-face')[0]).toHaveLength(4);
    expect(extractTopBoundaryLoops(box, 'side-face')).toEqual([]);
    const setup = createManufacturingSetup({ bodyId: box.id });
    const selectedTop = createContourOperation({ targetDepth: 1, boundaryFaceId: 'top-face' });
    expect(calculateContourToolpath(setup, selectedTop, [box]).valid).toBe(true);
    const selectedSide = createContourOperation({ targetDepth: 1, boundaryFaceId: 'side-face' });
    const result = calculateContourToolpath(setup, selectedSide, [box]);
    expect(result.valid).toBe(false);
    expect(result.warnings.join(' ')).toContain('nie jest pozioma');
  });
});
