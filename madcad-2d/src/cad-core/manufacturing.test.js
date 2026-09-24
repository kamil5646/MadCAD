import { describe, expect, it } from 'vitest';
import {
  calculateAdaptiveToolpath,
  calculateContourToolpath,
  calculateCounterboreToolpath,
  calculateCut2dToolpath,
  calculateDrillingToolpath,
  calculateManufacturingSetup,
  calculateOperationToolpath,
  calculateSpotDrillingToolpath,
  calculateTappingToolpath,
  calculatePocketToolpath,
  calculateTurningToolpath,
  analyzeManufacturingProgram,
  analyzeHoleMachiningCompleteness,
  analyzeToolpathSafety,
  createContourOperation,
  createCounterboreOperation,
  createCut2dOperation,
  createCustomCamTool,
  createDrillingOperation,
  createFacingOperation,
  duplicateManufacturingOperation,
  createAdaptiveOperation,
  createGrblGcode,
  createMachineGcode,
  createManufacturingProgramGcode,
  createManufacturingFixture,
  createManufacturingOperationGroup,
  createManufacturingOperationTemplate,
  createManufacturingSetupSheet,
  createManufacturingSetup,
  createPocketOperation,
  createSpotDrillingOperation,
  createTurningOperation,
  createTappingOperation,
  ensureDocumentManufacturing,
  extractTopBoundaryLoops,
  instantiateManufacturingOperationTemplate,
  offsetClosedContour,
  optimizeManufacturingOperationOrder,
  moveManufacturingOperation,
  deleteManufacturingOperationGroup,
  simulateMaterialRemoval,
  validateManufacturing,
  validateManufacturingOperationOrder,
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

const drilledBox = {
  ...box,
  manufacturingHoles: [{
    featureId: 'hole-main',
    diameter: 5,
    quantity: 2,
    through: true,
    position: [10, 5, 10],
    direction: [0, 0, -1],
    depth: 10,
    instances: [
      { position: [10, 5, 10], direction: [0, 0, -1], depth: 10 },
      { position: [30, 15, 10], direction: [0, 0, -1], depth: 10 },
    ],
  }],
};

describe('CAM contour operations', () => {
  it('detects a swept tool crossing the fixture zone and blocks NC export', () => {
    const operation = createContourOperation({ targetDepth: 1, toolId: 'flat-3' });
    const setup = createManufacturingSetup({ bodyId: box.id, operations: [operation] });
    const baseline = calculateContourToolpath(setup, operation, [box]);
    const segment = baseline.segments.find((item) => item.kind === 'cut' && Math.hypot(...item.to.map((value, axis) => value - item.from[axis])) > 1);
    expect(segment).toBeDefined();
    const middle = segment.from.map((value, axis) => (value + segment.to[axis]) / 2);
    setup.fixtures = [createManufacturingFixture({ name: 'Szczęka lewa', enabled: true, bounds: [middle.map((value) => value - 0.1), middle.map((value) => value + 0.1)], clearance: 0.5 })];
    const collision = calculateContourToolpath(setup, operation, [box]);
    expect(analyzeToolpathSafety(collision)).toContainEqual(expect.objectContaining({ code: 'FIXTURE_COLLISION' }));
    expect(analyzeManufacturingProgram(setup, [box]).valid).toBe(false);
    expect(() => createMachineGcode(setup, operation, [box])).toThrow(/Szczęka lewa/);
    expect(() => createManufacturingProgramGcode(setup, [box])).toThrow(/zablokowany/);
    setup.fixtures.push(createManufacturingFixture({ name: 'Szczęka prawa', enabled: true, bounds: [middle.map((value) => value - 0.1), middle.map((value) => value + 0.1)], clearance: 0.5 }));
    expect(analyzeToolpathSafety(calculateContourToolpath(setup, operation, [box])).filter((issue) => issue.code === 'FIXTURE_COLLISION')).toHaveLength(2);
    setup.fixtures[0].bounds = [[100, 100, 100], [110, 110, 110]];
    setup.fixtures[1].enabled = false;
    expect(analyzeToolpathSafety(calculateContourToolpath(setup, operation, [box]))).toEqual([]);
    expect(createManufacturingSetupSheet(setup, [box]).html).toContain('Szczęka lewa XYZ: 100.00 / 100.00 / 100.00 — 110.00 / 110.00 / 110.00 mm; odstęp 0.50 mm.');
    expect(validateManufacturing({ setups: [setup], activeSetupId: setup.id })).toEqual([]);
    setup.fixtures[0].bounds[1][0] = 90;
    expect(validateManufacturing({ setups: [setup], activeSetupId: setup.id }).some((issue) => issue.path.endsWith('fixtures[0].bounds'))).toBe(true);
  });
  it('drills recognized model holes with safe pecks, simulation data, and portable G-code', () => {
    const setup = createManufacturingSetup({ bodyId: drilledBox.id, stock: { sideOffset: 2, topOffset: 2, bottomOffset: 0 }, safeHeight: 5 });
    const operation = createDrillingOperation({ toolId: 'drill-5', peckDepth: 3, retractHeight: 1, breakthroughDepth: 0.2, feedRate: 120 });
    setup.operations.push(operation);
    const toolpath = calculateDrillingToolpath(setup, operation, [drilledBox]);
    expect(toolpath.valid).toBe(true);
    expect(toolpath.holeCount).toBe(2);
    expect(toolpath.peckCount).toBe(10);
    expect(toolpath.segments.filter((segment) => segment.kind === 'plunge')).toHaveLength(10);
    expect(toolpath.segments.filter((segment) => segment.kind === 'plunge').at(-1).to[2]).toBeCloseTo(-0.2);
    expect(analyzeToolpathSafety(toolpath)).toEqual([]);
    expect(validateManufacturing({ setups: [setup], activeSetupId: setup.id })).toEqual([]);
    const output = createGrblGcode(setup, operation, [drilledBox], { projectName: 'Wiercenie test' });
    expect(output.text).toContain('; Wiercenie test');
    expect(output.text).toContain('Wiertło kręte Ø5');
    expect(output.text).toContain('G1 X-10 Y-5 Z-3 F120');
    expect(output.text).toContain('G1 X10 Y5 Z-12.2');
    const simulation = simulateMaterialRemoval(setup, [drilledBox], null, 1, 20);
    expect(simulation.valid).toBe(true);
    expect(simulation.columns.length).toBeGreaterThan(0);
  });

  it('uses G81/G82/G83 on capable controllers and explicit safe fallback on GRBL', () => {
    const setup = createManufacturingSetup({ bodyId: drilledBox.id, stock: { sideOffset: 2, topOffset: 2, bottomOffset: 0 }, safeHeight: 5 });
    const normal = createDrillingOperation({ toolId: 'drill-5', cycleType: 'normal', feedRate: 120, postProcessorId: 'linuxcnc' });
    const normalPath = calculateDrillingToolpath(setup, normal, [drilledBox]);
    expect(normalPath.peckCount).toBe(2);
    expect(normalPath.segments.filter((segment) => segment.kind === 'plunge')).toHaveLength(2);
    const linuxCnc = createMachineGcode(setup, normal, [drilledBox]);
    expect(linuxCnc.text).toContain('G81 X-10 Y-5 Z-12.2 R1 F120');
    expect(linuxCnc.text).toContain('G80');

    const dwell = createDrillingOperation({ toolId: 'drill-5', cycleType: 'dwell', dwellSeconds: 1.25, feedRate: 120, postProcessorId: 'mach3' });
    expect(createMachineGcode(setup, dwell, [drilledBox]).text).toContain('G82 X-10 Y-5 Z-12.2 R1 P1.25 F120');
    const grblFallback = createGrblGcode(setup, dwell, [drilledBox]);
    expect(grblFallback.text).not.toContain('G82');
    expect(grblFallback.text.match(/G4 P1.25/g)).toHaveLength(2);

    const peck = createDrillingOperation({ toolId: 'drill-5', cycleType: 'peck', peckDepth: 3, postProcessorId: 'linuxcnc' });
    expect(createMachineGcode(setup, peck, [drilledBox]).text).toContain('G83 X-10 Y-5 Z-12.2 R1 Q3 F120');
  });

  it('stores project tools, uses a custom drill, and protects tapping from a drilling cycle', () => {
    const drill = createCustomCamTool({ name: 'Wiertło produkcyjne Ø4,8', type: 'twist-drill', diameter: 4.8, fluteLength: 30, stickout: 40, holderDiameter: 12, flutes: 2 });
    const tap = createCustomCamTool({ name: 'Gwintownik M5', type: 'tap', diameter: 5, pitch: 0.8, fluteLength: 20, stickout: 35, holderDiameter: 12, flutes: 3 });
    const document = ensureDocumentManufacturing({ manufacturing: { setups: [], activeSetupId: '', tools: [drill, tap] } });
    const setup = createManufacturingSetup({ bodyId: drilledBox.id });
    const operation = createDrillingOperation({ toolId: drill.id, cycleType: 'normal' });
    setup.operations.push(operation);
    document.manufacturing.setups.push(setup);
    document.manufacturing.activeSetupId = setup.id;
    const toolpath = calculateDrillingToolpath(setup, operation, [drilledBox], document);
    expect(toolpath.valid).toBe(true);
    expect(toolpath.tool.name).toBe('Wiertło produkcyjne Ø4,8');
    expect(createMachineGcode(setup, operation, [drilledBox], { document })).toHaveProperty('toolpath.tool.id', drill.id);
    expect(validateManufacturing(document.manufacturing)).toEqual([]);

    const tappingInDrill = calculateDrillingToolpath(setup, { ...operation, toolId: tap.id }, [drilledBox], document);
    expect(tappingInDrill.valid).toBe(false);
    expect(tappingInDrill.warnings.join(' ')).toContain('Gwintownik wymaga cyklu gwintowania');
  });

  it('taps a matching pilot hole with pitch-derived feed and synchronized G84', () => {
    const tap = createCustomCamTool({ name: 'Gwintownik M8 × 1,25', type: 'tap', diameter: 8, pitch: 1.25, fluteLength: 30, stickout: 40, holderDiameter: 12, flutes: 3 });
    const pilotBody = { ...drilledBox, manufacturingHoles: drilledBox.manufacturingHoles.map((hole) => ({ ...hole, diameter: 6.8 })) };
    const document = ensureDocumentManufacturing({ manufacturing: { setups: [], activeSetupId: '', tools: [tap] } });
    const setup = createManufacturingSetup({ bodyId: pilotBody.id, stock: { sideOffset: 2, topOffset: 2, bottomOffset: 0 }, safeHeight: 5 });
    const operation = createTappingOperation({ toolId: tap.id, spindleRpm: 500, bottomClearance: 1, postProcessorId: 'linuxcnc' });
    setup.operations.push(operation);
    document.manufacturing.setups.push(setup);
    document.manufacturing.activeSetupId = setup.id;
    const toolpath = calculateTappingToolpath(setup, operation, [pilotBody], document);
    expect(toolpath.valid).toBe(true);
    expect(toolpath.operation.feedRate).toBe(625);
    expect(toolpath.segments.filter((segment) => segment.kind === 'tap-down')).toHaveLength(2);
    expect(toolpath.segments.filter((segment) => segment.kind === 'tap-up')).toHaveLength(2);
    expect(analyzeToolpathSafety(toolpath)).toEqual([]);
    const output = createMachineGcode(setup, operation, [pilotBody], { document });
    expect(output.text).toContain('T100 M6');
    expect(output.text).toContain('G84 X-10 Y-5 Z-11 R1 F625');
    expect(output.text).toContain('G80');
    expect(() => createMachineGcode(setup, operation, [pilotBody], { document, postProcessorId: 'grbl' })).toThrow(/G84/);
    const wrongPilot = calculateTappingToolpath(setup, operation, [drilledBox], document);
    expect(wrongPilot.valid).toBe(false);
    expect(wrongPilot.warnings.join(' ')).toContain('oczekiwane wiertło');
    expect(validateManufacturing(document.manufacturing)).toEqual([]);
  });

  it('spot drills recognized holes to a geometry-derived cone depth', () => {
    const spotDrill = createCustomCamTool({ name: 'Nawiertak 90° Ø12', type: 'spot-drill', diameter: 12, pointAngle: 90, fluteLength: 20, stickout: 30, holderDiameter: 12, flutes: 2 });
    const document = ensureDocumentManufacturing({ manufacturing: { setups: [], activeSetupId: '', tools: [spotDrill] } });
    const setup = createManufacturingSetup({ bodyId: drilledBox.id, stock: { sideOffset: 2, topOffset: 0, bottomOffset: 0 }, safeHeight: 5 });
    const operation = createSpotDrillingOperation({ toolId: spotDrill.id, targetDiameter: 7, retractHeight: 1, feedRate: 90, postProcessorId: 'linuxcnc' });
    setup.operations.push(operation);
    document.manufacturing.setups.push(setup);
    document.manufacturing.activeSetupId = setup.id;
    const toolpath = calculateSpotDrillingToolpath(setup, operation, [drilledBox], document);
    expect(toolpath.valid).toBe(true);
    expect(toolpath.holeCount).toBe(2);
    expect(toolpath.holes[0].coneDepth).toBeCloseTo(1, 8);
    expect(toolpath.holes[0].targetZ).toBeCloseTo(9, 8);
    expect(toolpath.segments.filter((segment) => segment.kind === 'plunge')).toHaveLength(2);
    expect(analyzeToolpathSafety(toolpath)).toEqual([]);
    expect(createMachineGcode(setup, operation, [drilledBox], { document }).text).toContain('Nawiertak 90° Ø12');
    expect(validateManufacturing(document.manufacturing)).toEqual([]);
    expect(calculateSpotDrillingToolpath(setup, { ...operation, targetDiameter: 13 }, [drilledBox], document).warnings.join(' ')).toContain('przekracza średnicę nawiertaka');
    expect(calculateSpotDrillingToolpath(setup, { ...operation, targetDiameter: 5 }, [drilledBox], document).warnings.join(' ')).toContain('musi być większa niż otwór');
  });

  it('counterbores recognized holes in safe axial layers', () => {
    const counterboreBody = { ...drilledBox, manufacturingHoles: drilledBox.manufacturingHoles.map((hole) => ({ ...hole, diameter: 8 })) };
    const setup = createManufacturingSetup({ bodyId: counterboreBody.id, stock: { sideOffset: 2, topOffset: 0, bottomOffset: 0 }, safeHeight: 5 });
    const operation = createCounterboreOperation({ toolId: 'flat-6', targetDiameter: 14, targetDepth: 3, maxStepdown: 1, feedRate: 300, plungeRate: 100 });
    setup.operations.push(operation);
    const toolpath = calculateCounterboreToolpath(setup, operation, [counterboreBody]);
    expect(toolpath.valid).toBe(true);
    expect(toolpath.holeCount).toBe(2);
    expect(toolpath.layerCount).toBe(3);
    expect(toolpath.segments.filter((segment) => segment.kind === 'plunge')).toHaveLength(6);
    expect(toolpath.segments.filter((segment) => segment.kind === 'cut').length).toBeGreaterThan(100);
    expect(toolpath.estimatedRemovedVolume).toBeCloseTo(Math.PI / 4 * (14 ** 2 - 8 ** 2) * 3 * 2, 8);
    expect(analyzeToolpathSafety(toolpath)).toEqual([]);
    expect(createMachineGcode(setup, operation, [counterboreBody]).text).toContain('Pogłębianie walcowe');
    expect(validateManufacturing({ setups: [setup], activeSetupId: setup.id, tools: [] })).toEqual([]);
    expect(calculateCounterboreToolpath(setup, { ...operation, toolId: 'flat-3', targetDiameter: 3 }, [counterboreBody]).warnings.join(' ')).toContain('większa niż frez');
    expect(calculateCounterboreToolpath(setup, { ...operation, targetDepth: 11 }, [counterboreBody]).warnings.join(' ')).toContain('przekracza głębokość otworu');
  });

  it('reports missing and incorrectly ordered hole machining stages', () => {
    const counterboreBody = { ...drilledBox, manufacturingHoles: drilledBox.manufacturingHoles.map((hole) => ({ ...hole, diameter: 8, holeType: 'counterbore' })) };
    const setup = createManufacturingSetup({ bodyId: counterboreBody.id });
    const drill = createDrillingOperation({ toolId: 'drill-8' });
    const counterbore = createCounterboreOperation({ toolId: 'flat-6', targetDiameter: 14, targetDepth: 2 });
    setup.operations.push(counterbore, drill);
    const wrongOrder = analyzeManufacturingProgram(setup, [counterboreBody]);
    expect(wrongOrder.valid).toBe(false);
    expect(wrongOrder.holeCompleteness.entries[0].missingStages).toEqual([]);
    expect(wrongOrder.holeCompleteness.entries[0].orderingIssues.join(' ')).toContain('wiercenie powinno poprzedzać pogłębianie');
    setup.operations = [drill];
    const missing = analyzeManufacturingProgram(setup, [counterboreBody]);
    expect(missing.holeCompleteness.entries[0].missingStages).toEqual(['counterbore']);
    setup.operations = [drill, counterbore];
    const complete = analyzeManufacturingProgram(setup, [counterboreBody]);
    expect(complete.valid).toBe(true);
    expect(complete.holeCompleteness).toMatchObject({ complete: true, groupCount: 1, completeGroupCount: 1, totalHoleCount: 2, completeHoleCount: 2 });
    expect(analyzeHoleMachiningCompleteness(setup, counterboreBody, complete.operations).entries[0].plannedStages).toEqual(['drill', 'counterbore']);
  });

  it('orders operations by manufacturing dependencies and then minimizes tool changes', () => {
    const drill = createDrillingOperation({ name: 'Wiercenie', toolId: 'drill-8', holeFeatureIds: ['hole-main'] });
    const spot = createSpotDrillingOperation({ name: 'Nawiertanie', toolId: 'spot-tool', holeFeatureIds: ['hole-main'] });
    const counterbore = createCounterboreOperation({ name: 'Pogłębienie', toolId: 'flat-6', holeFeatureIds: ['hole-main'] });
    const contour = createContourOperation({ name: 'Kontur', toolId: 'flat-6' });
    const setup = createManufacturingSetup({ bodyId: drilledBox.id });
    setup.operations = [contour, counterbore, drill, spot];
    const result = optimizeManufacturingOperationOrder(setup, drilledBox);
    expect(result.operations.map((operation) => operation.type)).toEqual(['spot', 'drill', 'counterbore', 'contour']);
    expect(result.changed).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.toolChangesAfter).toBeLessThanOrEqual(result.toolChangesBefore);
    const stable = optimizeManufacturingOperationOrder({ ...setup, operations: result.operations }, drilledBox);
    expect(stable.changed).toBe(false);
  });

  it('rejects oversized drills and non-Z hole axes instead of exporting unsafe paths', () => {
    const setup = createManufacturingSetup({ bodyId: drilledBox.id });
    const oversized = createDrillingOperation({ toolId: 'drill-6' });
    expect(calculateDrillingToolpath(setup, oversized, [drilledBox]).warnings.join(' ')).toContain('większe niż otwór');
    const angledBody = {
      ...drilledBox,
      manufacturingHoles: [{ ...drilledBox.manufacturingHoles[0], quantity: 1, instances: [{ position: [10, 5, 10], direction: [1, 0, -1], depth: 10 }] }],
    };
    const angled = calculateDrillingToolpath(setup, createDrillingOperation(), [angledBody]);
    expect(angled.valid).toBe(false);
    expect(angled.warnings.join(' ')).toContain('równoległe do osi Z');
  });

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

  it('exports one safe program for the complete setup without duplicate headers or tool changes', () => {
    const setup = createManufacturingSetup({ bodyId: box.id, name: 'Korpus produkcyjny', workOffset: 'G55' });
    setup.operations.push(
      createPocketOperation({ name: 'Kieszeń główna', targetDepth: 1, toolId: 'flat-6', postProcessorId: 'linuxcnc' }),
      createContourOperation({ name: 'Kontur końcowy', targetDepth: 1, toolId: 'flat-6', postProcessorId: 'linuxcnc' }),
    );
    const output = createManufacturingProgramGcode(setup, [box], { projectName: 'Program testowy', postProcessorId: 'linuxcnc' });
    expect(output.operationCount).toBe(2);
    expect(output.postProcessor).toBe('linuxcnc');
    expect(output.text).toMatch(/^%\n/);
    expect(output.text.match(/\nG21\n/g)).toHaveLength(1);
    expect(output.text.match(/T2 M6/g)).toHaveLength(1);
    expect(output.text.match(/\nG55\n/g)).toHaveLength(1);
    expect(output.text).toContain('(Kieszeń główna | Frez palcowy płaski Ø6)');
    expect(output.text).toContain('(Kontur końcowy | Frez palcowy płaski Ø6)');
    expect(output.text.match(/\nM2\n/g)).toHaveLength(1);
    expect(output.text).toMatch(/\nM5\nM2\n%\n$/);
  });

  it('duplicates operations and permits only manual moves that preserve technological dependencies', () => {
    const setup = createManufacturingSetup({ bodyId: drilledBox.id });
    const face = createFacingOperation({ name: 'Planowanie bazowe' });
    const drill = createDrillingOperation({ name: 'Wiercenie produkcyjne', holeFeatureIds: ['hole-main'] });
    const contour = createContourOperation({ name: 'Kontur końcowy' });
    setup.operations.push(face, drill, contour);
    const duplicate = duplicateManufacturingOperation(setup, drill.id);
    expect(duplicate.operation.id).not.toBe(drill.id);
    expect(duplicate.operation.name).toBe('Wiercenie produkcyjne — kopia');
    expect(duplicate.operations[2].holeFeatureIds).toEqual(['hole-main']);
    const movedUp = moveManufacturingOperation({ ...setup, operations: duplicate.operations }, duplicate.operation.id, 'up', drilledBox);
    expect(movedUp.changed).toBe(true);
    expect(movedUp.operations[1].id).toBe(duplicate.operation.id);
    const blockedFace = moveManufacturingOperation({ ...setup, operations: movedUp.operations }, face.id, 'down', drilledBox);
    expect(blockedFace.changed).toBe(false);
    expect(blockedFace.warnings.join(' ')).toContain('zależność technologiczną');
    const blockedContour = moveManufacturingOperation({ ...setup, operations: movedUp.operations }, contour.id, 'up', drilledBox);
    expect(blockedContour.changed).toBe(false);
    expect(validateManufacturingOperationOrder({ ...setup, operations: movedUp.operations }, drilledBox).valid).toBe(true);
  });

  it('organizes operations in persistent folders without changing execution order', () => {
    const roughing = createManufacturingOperationGroup({ name: 'Zgrubne' });
    const finishing = createManufacturingOperationGroup({ name: 'Wykańczające', collapsed: true });
    const setup = createManufacturingSetup({
      bodyId: box.id,
      operationGroups: [roughing, finishing],
      operations: [
        { ...createPocketOperation({ name: 'Kieszeń' }), groupId: roughing.id },
        { ...createContourOperation({ name: 'Kontur' }), groupId: finishing.id },
      ],
    });
    expect(setup.operationGroups).toEqual([roughing, finishing]);
    expect(setup.operations.map((operation) => operation.groupId)).toEqual([roughing.id, finishing.id]);
    const removed = deleteManufacturingOperationGroup(setup, roughing.id);
    expect(removed.changed).toBe(true);
    expect(removed.operationGroups.map((group) => group.id)).toEqual([finishing.id]);
    expect(removed.operations.map((operation) => operation.groupId)).toEqual(['', finishing.id]);
    expect(removed.operations.map((operation) => operation.name)).toEqual(['Kieszeń', 'Kontur']);
    expect(validateManufacturing({ setups: [removed], activeSetupId: removed.id, tools: [], operationTemplates: [] })).toEqual([]);
  });

  it('stores reusable operation templates without model geometry and applies them to compatible setups', () => {
    const source = createPocketOperation({ name: 'Kieszeń aluminium', toolId: 'flat-6', targetDepth: 4, boundaryFaceId: 'face-top' });
    const template = createManufacturingOperationTemplate(source, { name: 'Kieszeń Al Ø6' });
    expect(template.name).toBe('Kieszeń Al Ø6');
    expect(template.operation.id).toBe('');
    expect(template.operation.boundaryFaceId).toBe('');
    expect(template.operation.targetDepth).toBe(4);
    const setup = createManufacturingSetup({ bodyId: box.id, operations: [source] });
    const instance = instantiateManufacturingOperationTemplate(template, setup);
    expect(instance.id).not.toBe(source.id);
    expect(instance.name).toBe('Kieszeń aluminium 2');
    expect(instance.targetDepth).toBe(4);
    expect(instance.boundaryFaceId).toBe('');
    expect(() => instantiateManufacturingOperationTemplate(template, createManufacturingSetup({ bodyId: box.id, machineId: 'lathe-300' }))).toThrow(/nie pasuje/);
    const document = ensureDocumentManufacturing({ manufacturing: { setups: [setup], activeSetupId: setup.id, tools: [], operationTemplates: [template] } });
    expect(document.manufacturing.operationTemplates).toHaveLength(1);
    expect(validateManufacturing(document.manufacturing)).toEqual([]);
  });

  it('creates a printable and escaped setup sheet from the verified CAM program', () => {
    const setup = createManufacturingSetup({ bodyId: box.id, name: 'Setup produkcyjny', workOffset: 'G56' });
    setup.operations.push(
      createPocketOperation({ name: 'Kieszeń <A>', targetDepth: 1, toolId: 'flat-6' }),
      createContourOperation({ name: 'Kontur końcowy', targetDepth: 1, toolId: 'flat-6' }),
    );
    const sheet = createManufacturingSetupSheet(setup, [box], { projectName: 'Korpus & uchwyt' });
    expect(sheet.report.valid).toBe(true);
    expect(sheet.operationCount).toBe(2);
    expect(sheet.toolCount).toBe(1);
    expect(sheet.html).toContain('<h1>Arkusz ustawczy CAM</h1>');
    expect(sheet.html).toContain('Korpus &amp; uchwyt');
    expect(sheet.html).toContain('Kieszeń &lt;A&gt;');
    expect(sheet.html).toContain('Półfabrykat X × Y × Z');
    expect(sheet.html).toContain('<span>Układ roboczy</span><strong>G56</strong>');
    expect(sheet.html).toContain('Kontrola przed uruchomieniem');
    expect(sheet.html).not.toContain('Korpus & uchwyt');
  });

  it('creates compensated 2D cutting paths and laser/plasma programs', () => {
    const laserSetup = createManufacturingSetup({ bodyId: box.id, machineId: 'laser-600' });
    const laserOperation = createCut2dOperation({ kerfWidth: 0.2, leadIn: 3, passes: 2, powerPercent: 70 });
    laserSetup.operations.push(laserOperation);
    const toolpath = calculateCut2dToolpath(laserSetup, laserOperation, [box]);
    expect(laserSetup.operationKind).toBe('cut-2d');
    expect(toolpath.valid).toBe(true);
    expect(toolpath.layerCount).toBe(2);
    expect(toolpath.segments.filter((segment) => segment.kind === 'cut')).toHaveLength(10);
    expect(analyzeToolpathSafety(toolpath).some((issue) => issue.code === 'RAPID_IN_STOCK')).toBe(false);
    expect(validateManufacturing({ setups: [laserSetup], activeSetupId: laserSetup.id })).toEqual([]);
    const laser = createMachineGcode(laserSetup, laserOperation, [box]);
    expect(laser.postProcessor).toBe('grbl-laser');
    expect(laser.text).toContain('M4 S700');
    expect(laser.text).toContain('\nM5\n');
    const plasmaSetup = createManufacturingSetup({ bodyId: box.id, machineId: 'plasma-1250' });
    const plasmaOperation = createCut2dOperation({ postProcessorId: 'linuxcnc-plasma' });
    const plasma = createMachineGcode(plasmaSetup, plasmaOperation, [box]);
    expect(plasma.text).toMatch(/^%\n/);
    expect(plasma.text).toContain('\nM3\nG4 P0.5\n');
    expect(plasma.text).toContain('\nM2\n%');
  });

  it('creates face and outside turning passes with diameter-mode LinuxCNC code', () => {
    const setup = createManufacturingSetup({ bodyId: box.id, machineId: 'lathe-300' });
    const facing = createTurningOperation('turn-face', { stockDiameter: 24, targetDiameter: 20, axialLength: 40, maxDepthOfCut: 1 });
    const profile = createTurningOperation('turn-profile', { stockDiameter: 24, targetDiameter: 20, axialLength: 30, maxDepthOfCut: 1, feedRate: 0.25 });
    setup.operations.push(facing, profile);
    const facePath = calculateTurningToolpath(setup, facing, [box]);
    const profilePath = calculateTurningToolpath(setup, profile, [box]);
    expect(setup.operationKind).toBe('turning-2axis');
    expect(facePath.valid).toBe(true);
    expect(facePath.passCount).toBe(2);
    expect(profilePath.valid).toBe(true);
    expect(profilePath.passCount).toBe(2);
    expect(validateManufacturing({ setups: [setup], activeSetupId: setup.id })).toEqual([]);
    const output = createMachineGcode(setup, profile, [box]);
    expect(output.postProcessor).toBe('linuxcnc-turn');
    expect(output.text).toContain('\nG18\nG95\n');
    expect(output.text).toContain('\nT1 M6\n');
    expect(output.text).toContain('G1 X22 Z-30 F0.25');
    expect(output.text).toContain('G1 X20 Z-30');
    expect(output.text).toContain('\nM5\nM2\n%');
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

  it('reuses calculated toolpaths without changing the multi-operation simulation', () => {
    const setup = createManufacturingSetup({ bodyId: box.id, stock: { topOffset: 2 } });
    setup.operations.push(createPocketOperation({ targetDepth: 2, maxStepdown: 1 }));
    setup.operations.push(createFacingOperation({ maxStepdown: 1 }));
    const toolpaths = setup.operations.map((operation) => calculateOperationToolpath(setup, operation, [box]));
    const report = analyzeManufacturingProgram(setup, [box], null, toolpaths);
    expect(report).toEqual(analyzeManufacturingProgram(setup, [box]));
    expect(analyzeManufacturingProgram(setup, [box], null, [...toolpaths].reverse())).toEqual(report);
    const precomputed = { setupResult: calculateManufacturingSetup(setup, [box]), toolpaths, report };
    for (const progress of [0, 0.25, 0.5, 1]) {
      expect(simulateMaterialRemoval(setup, [box], null, progress, 20, precomputed))
        .toEqual(simulateMaterialRemoval(setup, [box], null, progress, 20));
    }
  });

  it('advances through 150k CAM segments without building a flattened entry list', () => {
    const setup = createManufacturingSetup({ bodyId: box.id, stock: { topOffset: 2 } });
    const operation = createFacingOperation();
    setup.operations.push(operation);
    const segment = { kind: 'rapid', from: [0, 0, 12], to: [1, 0, 12] };
    const toolpath = { valid: true, operation, tool: { diameter: 6 }, segments: Array(150000).fill(segment) };
    const precomputed = {
      setupResult: calculateManufacturingSetup(setup, [box]),
      toolpaths: [toolpath],
      report: { valid: true, operations: [{ id: operation.id }], setupIssues: [] },
    };
    const result = simulateMaterialRemoval(setup, [box], null, 0.5, 12, precomputed);
    expect(result.totalSegments).toBe(150000);
    expect(result.processedSegments).toBe(75000);
    expect(result.cutter).toEqual({ position: [1, 0, 12], diameter: 6, operationId: operation.id });
    expect(result.removedVolume).toBe(0);
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
