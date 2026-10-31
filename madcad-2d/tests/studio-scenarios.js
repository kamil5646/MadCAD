// Core workflow scenarios run inside the renderer (verify mode). Each scenario builds a
// document with the same helpers the toolbar uses, loads it and checks the engine result.
import { createDocument, createSketch } from '../src/cad-core/document.js';
import { createTopologyReference } from '../src/cad-core/topology-references.js';
import { insertTimelineFeature } from '../src/cad-core/timeline-operations.js';
import { addDimension, addLine, addPoint, addShape, dimensionForSelection, holePointIds } from '../src/studio/sketch-actions.js';
import { buildFeature } from '../src/studio/features.js';
import { profileArea } from '../src/modeling/extrude-source.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluate(document) {
  window.__madcadStudioLoad(structuredClone(document));
  await wait(50);
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    const state = window.__madcadStudio;
    if (state.document.id === document.id && state.engine.current && ['ready', 'error'].includes(state.engine.status)) return state.engine;
    await wait(40);
  }
  throw new Error('Silnik nie przeliczył dokumentu w 30 s.');
}

function sketchOn(document, plane = 'XY', extra = {}) {
  const sketch = createSketch({ name: `Szkic ${document.sketches.length + 1}`, plane, ...extra });
  document.sketches.push(sketch);
  return sketch;
}

function feature(document, command) {
  const firstBodyId = `body-${document.features.find((item) => ['extrude', 'revolve'].includes(item.type) && item.operation === 'new')?.id || ''}`;
  const built = buildFeature(command, { features: document.features, firstBodyId });
  for (const reference of command.references || []) document.references.push({ ...reference, ownerFeatureId: built.id });
  insertTimelineFeature(document, built);
  return built;
}

function profileOf(sketch, predicate = () => true) {
  const profile = sketch.profiles.filter(predicate).sort((first, second) => profileArea(second) - profileArea(first))[0];
  if (!profile) throw new Error(`${sketch.name}: brak zamkniętego profilu (${sketch.profiles.length}).`);
  return profile;
}

function extrude(document, sketch, options = {}) {
  return feature(document, { type: 'extrude', sketchId: sketch.id, profileIds: [options.profile?.id || profileOf(sketch).id], distance: '10', extent: 'one-side', flip: false, operation: 'new', ...options, profile: undefined });
}

function reference(engine, body, kind, predicate) {
  const records = kind === 'edge' ? body.topology.edges : body.topology.faces;
  const picked = records.filter((record) => predicate(record.descriptor));
  return picked.map((record) => ({ ...createTopologyReference({ selection: { kind, id: record.id, bodyId: body.id }, descriptor: { ...record.descriptor, bodyBounds: body.bounds } }), scope: 'feature-input' }));
}

const verticalEdge = (descriptor) => descriptor.geometry === 'LINE' && Math.abs(descriptor.endpoints[0][0] - descriptor.endpoints[1][0]) < 1e-6 && Math.abs(descriptor.endpoints[0][1] - descriptor.endpoints[1][1]) < 1e-6;
const topFace = (z) => (descriptor) => descriptor.geometry === 'PLANE' && Math.abs(descriptor.normal[2] - 1) < 1e-6 && Math.abs(descriptor.center[2] - z) < 1e-6;

function expectOk(engine, label, bodies = 1) {
  const failed = (engine.timeline || []).filter((entry) => !['ok', 'warning'].includes(entry.status));
  if (engine.status !== 'ready') throw new Error(`${label}: silnik ${engine.status} ${engine.error}`);
  if (failed.length) throw new Error(`${label}: ${failed.map((entry) => `${entry.status} ${entry.error || entry.diagnostics?.[0]?.message || ''}`).join('; ')}`);
  if (engine.bodies !== bodies) throw new Error(`${label}: brył ${engine.bodies}, oczekiwano ${bodies}`);
}

function volume(engine) {
  return engine.bodyData.reduce((sum, body) => sum + (body.metrics?.volume || 0), 0);
}

function near(actual, expected, label, tolerance = 0.5) {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`${label}: ${actual.toFixed(2)} zamiast ${expected.toFixed(2)}`);
}

function box(width = 40, depth = 30, height = '10') {
  const document = createDocument('Test');
  const sketch = sketchOn(document);
  addShape(document, sketch.id, 'rectangle', [[-width / 2, -depth / 2], [width / 2, depth / 2]]);
  const base = extrude(document, sketch, { distance: height });
  return { document, sketch, base };
}

export const SCENARIOS = {
  async 'prostokąt → wyciągnięcie'() {
    const { document } = box();
    const engine = await evaluate(document);
    expectOk(engine, 'box');
    near(volume(engine), 40 * 30 * 10, 'objętość');
  },
  async 'odwrócony kierunek i symetrycznie'() {
    const { document, base } = box();
    base.distance = '-(10)';
    let engine = await evaluate(document);
    expectOk(engine, 'flip');
    if (engine.bodyData[0].bounds[1][2] > 1e-6) throw new Error('Odwrócone wyciągnięcie poszło w górę.');
    base.extent = 'symmetric';
    base.distance = '10';
    engine = await evaluate(document);
    expectOk(engine, 'symmetric');
    near(engine.bodyData[0].bounds[1][2], 5, 'symetria');
  },
  async 'prostokąt z otworem (okrąg w środku)'() {
    const document = createDocument('Test');
    const sketch = sketchOn(document);
    addShape(document, sketch.id, 'rectangle', [[-20, -15], [20, 15]]);
    addShape(document, sketch.id, 'circle', [[0, 0], [5, 0]]);
    const outer = profileOf(sketch, (profile) => profile.innerLoops?.length);
    extrude(document, sketch, { profile: outer });
    const engine = await evaluate(document);
    expectOk(engine, 'otwór');
    near(volume(engine), 40 * 30 * 10 - Math.PI * 25 * 10, 'objętość z otworem', 2);
  },
  async 'wycięcie na wylot ze szkicu na ścianie'() {
    const { document } = box();
    let engine = await evaluate(document);
    const body = engine.bodyData[0];
    const face = reference(engine, body, 'face', topFace(10))[0];
    const record = body.topology.faces.find((item) => item.id === face.topologyId);
    document.references.push(face);
    const sketch = sketchOn(document, 'XY', { planeOffset: '10', support: { kind: 'face', referenceId: face.id } });
    addShape(document, sketch.id, 'circle', [[record.descriptor.center[0], record.descriptor.center[1]], [record.descriptor.center[0] + 4, record.descriptor.center[1]]]);
    extrude(document, sketch, { extent: 'through-all', operation: 'cut', targetBodyId: body.id });
    engine = await evaluate(document);
    expectOk(engine, 'cut');
    near(volume(engine), 12000 - Math.PI * 16 * 10, 'objętość po wycięciu', 2);
  },
  async 'nadlew na ścianie idzie za zmianą wysokości'() {
    const { document, base } = box();
    let engine = await evaluate(document);
    const body = engine.bodyData[0];
    const face = reference(engine, body, 'face', topFace(10))[0];
    document.references.push(face);
    const sketch = sketchOn(document, 'XY', { planeOffset: '10', support: { kind: 'face', referenceId: face.id } });
    addShape(document, sketch.id, 'circle', [[0, 0], [5, 0]]);
    extrude(document, sketch, { operation: 'join', distance: '5', targetBodyId: body.id });
    engine = await evaluate(document);
    expectOk(engine, 'boss');
    near(engine.bodyData[0].bounds[1][2], 15, 'wysokość z nadlewem');
    document.features.find((item) => item.id === base.id).distance = '20';
    engine = await evaluate(document);
    expectOk(engine, 'boss po zmianie');
    near(engine.bodyData[0].bounds[1][2], 25, 'nadlew na nowej ścianie');
  },
  async 'nadlew na nadlewie po zmianie wysokości i szerokości'() {
    const document = createDocument('Test');
    const base = sketchOn(document);
    addShape(document, base.id, 'rectangle', [[0, 0], [40, 30]]);
    const bottom = base.entities.filter((entity) => entity.type === 'line')[0];
    const widthId = addDimension(document, base.id, dimensionForSelection(document, base.id, [bottom.id]), '40').id;
    const baseFeature = extrude(document, base, {});
    let engine = await evaluate(document);
    const onFace = (z, center, radius, distance) => {
      const body = engine.bodyData[0];
      const face = reference(engine, body, 'face', topFace(z))[0];
      document.references.push(face);
      const sketch = sketchOn(document, 'XY', { planeOffset: String(z), support: { kind: 'face', referenceId: face.id } });
      addShape(document, sketch.id, 'circle', [center, [center[0] + radius, center[1]]]);
      extrude(document, sketch, { operation: 'join', distance: String(distance), targetBodyId: body.id });
    };
    onFace(10, [20, 15], 8, 5);
    engine = await evaluate(document);
    onFace(15, [20, 15], 3, 4);
    engine = await evaluate(document);
    expectOk(engine, 'dwa nadlewy');
    near(engine.bodyData[0].bounds[1][2], 19, 'wysokość z dwoma nadlewami');
    document.features.find((item) => item.id === baseFeature.id).distance = '12';
    const { setConstraintValue } = await import('../src/studio/sketch-actions.js');
    setConstraintValue(document, base.id, widthId, '60');
    engine = await evaluate(document);
    expectOk(engine, 'po zmianach');
    near(engine.bodyData[0].bounds[1][2], 21, 'nadlewy poszły za ścianą');
  },
  async 'otwory w punktach na ścianie, szyk i lustro'() {
    const { document } = box(60, 30);
    let engine = await evaluate(document);
    const body = engine.bodyData[0];
    const face = reference(engine, body, 'face', topFace(10))[0];
    document.references.push(face);
    const sketch = sketchOn(document, 'XY', { planeOffset: '10', support: { kind: 'face', referenceId: face.id } });
    addPoint(document, sketch.id, [-20, 0]);
    addPoint(document, sketch.id, [-20, 8]);
    const hole = feature(document, { type: 'hole', sketchId: sketch.id, pointIds: holePointIds(sketch), targetBodyId: body.id, holeType: 'simple', extent: 'through-all', diameter: '4', depth: '10' });
    engine = await evaluate(document);
    expectOk(engine, 'otwory');
    const plate = 60 * 30 * 10;
    const drilled = Math.PI * 4 * 10;
    near(volume(engine), plate - 2 * drilled, 'objętość z 2 otworami', 3);
    feature(document, { type: 'pattern', targetBodyId: body.id, sourceId: hole.id, patternType: 'rectangular', plane: 'XY', countX: '3', spacingX: '15', countY: '1', spacingY: '0' });
    engine = await evaluate(document);
    expectOk(engine, 'szyk otworów');
    near(volume(engine), plate - 6 * drilled, 'objętość po szyku', 5);
    feature(document, { type: 'mirror', targetBodyId: body.id, sourceId: hole.id, plane: 'XZ' });
    engine = await evaluate(document);
    expectOk(engine, 'lustro otworów');
    near(volume(engine), plate - 7 * drilled, 'objętość po lustrze (1 otwór się pokrywa)', 5);
  },
  async 'otwór z pogłębieniem na płaszczyźnie bazowej idzie w głąb'() {
    const { document } = box();
    let engine = await evaluate(document);
    const sketch = sketchOn(document, 'XY');
    addPoint(document, sketch.id, [0, 0]);
    feature(document, { type: 'hole', sketchId: sketch.id, pointIds: holePointIds(sketch), targetBodyId: engine.bodyData[0].id, holeType: 'counterbore', extent: 'distance', diameter: '5', depth: '6' });
    engine = await evaluate(document);
    expectOk(engine, 'pogłębienie');
    if (volume(engine) > 12000 - Math.PI * 6.25 * 6 + 1) throw new Error('Otwór nie wszedł w materiał.');
  },
  async 'szyk kołowy nadlewu i lustro całej bryły'() {
    const document = createDocument('Test');
    const base = sketchOn(document);
    addShape(document, base.id, 'circle', [[0, 0], [30, 0]]);
    extrude(document, base, { distance: '5' });
    let engine = await evaluate(document);
    const body = engine.bodyData[0];
    const boss = sketchOn(document);
    addShape(document, boss.id, 'circle', [[20, 0], [23, 0]]);
    const bossFeature = extrude(document, boss, { operation: 'join', distance: '15', targetBodyId: body.id });
    feature(document, { type: 'pattern', targetBodyId: body.id, sourceId: bossFeature.id, patternType: 'circular', occurrences: '6', totalAngle: '360', axisId: 'Z_AXIS' });
    engine = await evaluate(document);
    expectOk(engine, 'szyk kołowy');
    near(volume(engine), Math.PI * 900 * 5 + 6 * Math.PI * 9 * 10, 'objętość z 6 nadlewami', 20);
    feature(document, { type: 'mirror', targetBodyId: body.id, sourceId: 'body', plane: 'XY' });
    engine = await evaluate(document);
    expectOk(engine, 'lustro bryły');
    near(engine.bodyData[0].bounds[0][2], -15, 'dół lustra');
  },
  async 'obrót 360° i 180°'() {
    const document = createDocument('Test');
    const sketch = sketchOn(document, 'XZ');
    addShape(document, sketch.id, 'rectangle', [[10, 0], [20, 15]]);
    const revolve = feature(document, { type: 'revolve', sketchId: sketch.id, profileIds: [profileOf(sketch).id], axisId: 'Z_AXIS', angle: '360', operation: 'new' });
    let engine = await evaluate(document);
    expectOk(engine, 'revolve');
    near(volume(engine), Math.PI * (400 - 100) * 15, 'objętość pierścienia', 20);
    revolve.angle = '180';
    engine = await evaluate(document);
    expectOk(engine, 'revolve 180');
  },
  async 'zaokrąglenie 4 pionowych krawędzi i zmiana wysokości'() {
    const { document, base } = box();
    let engine = await evaluate(document);
    const body = engine.bodyData[0];
    feature(document, { type: 'fillet', targetBodyId: body.id, references: reference(engine, body, 'edge', verticalEdge), size: '3' });
    engine = await evaluate(document);
    expectOk(engine, 'fillet');
    document.features.find((item) => item.id === base.id).distance = '25';
    engine = await evaluate(document);
    expectOk(engine, 'fillet po zmianie');
    near(engine.bodyData[0].bounds[1][2], 25, 'wysokość');
  },
  async 'zaokrąglenie po zmianie szerokości (wymiar szkicu)'() {
    const document = createDocument('Test');
    const sketch = sketchOn(document);
    addShape(document, sketch.id, 'rectangle', [[0, 0], [40, 30]]);
    const bottom = sketch.entities.filter((entity) => entity.type === 'line')[0];
    const dimension = dimensionForSelection(document, sketch.id, [bottom.id]);
    const constraintId = addDimension(document, sketch.id, dimension, '40').id;
    extrude(document, sketch, {});
    let engine = await evaluate(document);
    const body = engine.bodyData[0];
    feature(document, { type: 'fillet', targetBodyId: body.id, references: reference(engine, body, 'edge', verticalEdge), size: '2' });
    engine = await evaluate(document);
    expectOk(engine, 'fillet');
    const { setConstraintValue } = await import('../src/studio/sketch-actions.js');
    setConstraintValue(document, sketch.id, constraintId, '60');
    engine = await evaluate(document);
    expectOk(engine, 'fillet po zmianie wymiaru');
    near(engine.bodyData[0].bounds[1][0] - engine.bodyData[0].bounds[0][0], 60, 'szerokość');
  },
  async 'fazowanie i skorupa'() {
    const { document } = box();
    let engine = await evaluate(document);
    let body = engine.bodyData[0];
    feature(document, { type: 'chamfer', targetBodyId: body.id, references: reference(engine, body, 'edge', verticalEdge), size: '2' });
    engine = await evaluate(document);
    expectOk(engine, 'chamfer');
    body = engine.bodyData[0];
    feature(document, { type: 'shell', targetBodyId: body.id, references: reference(engine, body, 'face', topFace(10)), thickness: '1.5' });
    engine = await evaluate(document);
    expectOk(engine, 'shell');
  },
  async 'trójkąt z wpisanych długości domyka się mimo przesunięć solvera'() {
    const document = createDocument('Test');
    const sketch = sketchOn(document);
    const first = addLine(document, sketch.id, [-95, 39], [3.9, 24.3]);
    addDimension(document, sketch.id, { type: 'aligned', entityIds: [first.id] }, '100');
    // Clicks snap to the drifted corners but land rounded to 0.001 mm, as in the viewport.
    const corner = (id) => sketch.entities.find((entity) => entity.id === id).geometry;
    const start = corner(first.pointIds[0]);
    const end = corner(first.pointIds[1]);
    const rounded = (point) => [Number(Number(point.x).toFixed(3)), Number(Number(point.y).toFixed(3))];
    addLine(document, sketch.id, rounded(start), [-38, -43.2]);
    addLine(document, sketch.id, [-38, -43.2], rounded(end));
    if (sketch.profiles.length !== 1) throw new Error(`Obszarów ${sketch.profiles.length}, oczekiwano 1.`);
    extrude(document, sketch, {});
    const engine = await evaluate(document);
    expectOk(engine, 'trójkąt');
  },
  async 'kontur z linii i łuku'() {
    const document = createDocument('Test');
    const sketch = sketchOn(document);
    addLine(document, sketch.id, [0, 0], [40, 0]);
    addLine(document, sketch.id, [40, 0], [40, 20]);
    addShape(document, sketch.id, 'arc', [[40, 20], [0, 20], [20, 35]]);
    addLine(document, sketch.id, [0, 20], [0, 0]);
    extrude(document, sketch, {});
    const engine = await evaluate(document);
    expectOk(engine, 'linie + łuk');
  },
  async 'dwa osobne prostokąty → dwie bryły'() {
    const document = createDocument('Test');
    const sketch = sketchOn(document);
    addShape(document, sketch.id, 'rectangle', [[0, 0], [10, 10]]);
    addShape(document, sketch.id, 'rectangle', [[20, 0], [30, 10]]);
    if (sketch.profiles.length !== 2) throw new Error(`Profili ${sketch.profiles.length}, oczekiwano 2.`);
    feature(document, { type: 'extrude', sketchId: sketch.id, profileIds: sketch.profiles.map((profile) => profile.id), distance: '5', extent: 'one-side', operation: 'new' });
    const engine = await evaluate(document);
    expectOk(engine, 'dwa profile', engine.bodies);
    near(volume(engine), 2 * 500, 'objętość');
  },
  async 'nakładające się prostokąty'() {
    const document = createDocument('Test');
    const sketch = sketchOn(document);
    addShape(document, sketch.id, 'rectangle', [[0, 0], [20, 20]]);
    addShape(document, sketch.id, 'rectangle', [[10, 10], [30, 30]]);
    if (sketch.profiles.length !== 3) throw new Error(`Obszarów ${sketch.profiles.length}, oczekiwano 3.`);
    // All three areas together give the union of both rectangles; the overlap alone is 10×10.
    feature(document, { type: 'extrude', sketchId: sketch.id, profileIds: sketch.profiles.map((profile) => profile.id), distance: '10', extent: 'one-side', operation: 'new' });
    let engine = await evaluate(document);
    expectOk(engine, 'nakładające razem', engine.bodies);
    near(volume(engine), (400 + 400 - 100) * 10, 'objętość sumy');
    const overlap = sketch.profiles.find((profile) => Math.abs(Number(profile.geometry.width) - 10) < 1e-6 && Math.abs(Number(profile.geometry.height) - 10) < 1e-6);
    document.features[0].profileIds = [overlap.id];
    engine = await evaluate(document);
    expectOk(engine, 'część wspólna');
    near(volume(engine), 100 * 10, 'objętość części wspólnej');
  },
  async 'linia przecina okrąg → dwa półkola'() {
    const document = createDocument('Test');
    const sketch = sketchOn(document);
    addShape(document, sketch.id, 'circle', [[0, 0], [10, 0]]);
    addLine(document, sketch.id, [-15, 0], [15, 0]);
    if (sketch.profiles.length !== 2) throw new Error(`Obszarów ${sketch.profiles.length}, oczekiwano 2.`);
    extrude(document, sketch, { profile: sketch.profiles[0] });
    const engine = await evaluate(document);
    expectOk(engine, 'półkole');
    near(volume(engine), Math.PI * 100 / 2 * 10, 'objętość półwalca', 5);
  },
  async 'linia dotyka boku (T) dzieli prostokąt'() {
    const document = createDocument('Test');
    const sketch = sketchOn(document);
    addShape(document, sketch.id, 'rectangle', [[0, 0], [40, 20]]);
    addLine(document, sketch.id, [10, 0], [10, 20]);
    if (sketch.profiles.length !== 2) throw new Error(`Obszarów ${sketch.profiles.length}, oczekiwano 2.`);
    extrude(document, sketch, {});
    const engine = await evaluate(document);
    expectOk(engine, 'T');
    near(volume(engine), 30 * 20 * 10, 'większa część');
  },
};

export async function runScenarios(names = Object.keys(SCENARIOS)) {
  const results = [];
  for (const name of names) {
    const startedAt = Date.now();
    try {
      await SCENARIOS[name]();
      results.push({ name, ok: true, ms: Date.now() - startedAt });
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
    }
  }
  return results;
}
