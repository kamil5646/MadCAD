import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import atomicFile from '../electron/atomic-file.cjs';
import {
  DOCUMENT_SCHEMA_VERSION,
  createDocument,
  createFeature,
  createParameter,
  createRectangleProfile,
  createSketch,
  createStarterDocument,
  openDocument,
  validateDocument,
} from '../src/cad-core/document.js';
import { buildDependencyGraph } from '../src/cad-core/dependency-graph.js';
import { evaluateExpression, listExpressionIdentifiers, resolveParameters } from '../src/cad-core/expressions.js';
import { FEATURE_STATUS, prepareDocument } from '../src/cad-core/evaluator.js';
import { evaluateFeatureHistory } from '../src/cad-core/feature-history.js';
import { executeFeatureTransaction } from '../src/cad-core/feature-transaction.js';
import { GEOMETRY_POLICY, isPositiveLength, nearlyEqual } from '../src/cad-core/geometry-policy.js';
import { assignStableTopologyIds } from '../src/cad-core/topology-naming.js';
import { RevisionCache, SerialTaskQueue, WorkerRecoveryPolicy, isStaleRevision } from '../src/cad-core/worker-runtime.js';
import {
  addDrivingSketchDimension,
  createDetectedProfile,
  createSketchArc,
  createSketchCircleEntity,
  createSketchConstraint,
  createSketchDimension,
  createSketchEntity,
  createSketchLine,
  createSketchPoint,
  createTangentArcContinuation,
  deleteSketchSelection,
  translateSketchSelection,
  upsertSketchProfile,
} from '../src/cad-core/sketch-model.js';
import { analyzeSketchConstraints, applySketchConstraintSolution, solveSketchConstraints, SKETCH_SOLVER_STATUS } from '../src/cad-core/sketch-solver.js';
import { collectSketchSnapCandidates, snapSketchPoint } from '../src/cad-core/sketch-snap.js';
import { breakSketchEntity, chamferSketchLines, extendSketchEntity, filletSketchLines, offsetSketchEntities, offsetSketchProfile, trimSketchEntity } from '../src/cad-core/sketch-modifiers.js';
import { copySketchSelection, mirrorSketchSelection, rotateSketchSelection, scaleSketchSelection } from '../src/cad-core/sketch-transforms.js';
import { edgeGroupVertices, topologyIdForFaceIndex, topologySelectionFromIntersection } from '../src/cad-core/brep-picking.js';
import { createTopologyReference, inspectTopologyReferences, reassignTopologyReference } from '../src/cad-core/topology-references.js';
import { createMidplane, createOffsetPlane, createThreePointPlane, resolveConstructionPlane, resolveConstructionPlanes } from '../src/cad-core/construction-planes.js';
import { createCylinderAxis, createEdgeAxis, createPlaneIntersectionAxis, createTwoPointAxis, resolveConstructionAxis, resolveConstructionAxes } from '../src/cad-core/construction-axes.js';
import { createCenterPoint, createIntersectionPoint, createVertexPoint, resolveConstructionPoint, resolveConstructionPoints } from '../src/cad-core/construction-points.js';
import { detectSketchProfiles, refreshDetectedSketchProfiles } from '../src/cad-core/sketch-topology.js';
import {
  arcCenterStartEnd,
  arcThroughThreePoints,
  circleCenterRadius,
  circleThreePoints,
  circleTwoPoints,
  conicThroughControlPoint,
  ellipticalArcFromCenter,
  ellipseFromCenter,
  fitPointSpline,
  polygonFromEdge,
  rectangleFromCenter,
  rectangleThreePoints,
  rectangleTwoPoints,
  regularPolygon,
  controlPointSpline,
  slotCenterToCenter,
  slotArc,
  slotOverall,
  slotThreePoints,
} from '../src/cad-core/sketch-primitives.js';

const { atomicWriteTextFile } = atomicFile;

test('bezpiecznie oblicza wyrażenia parametryczne', () => {
  assert.equal(evaluateExpression('szerokosc / 2 + 3', { szerokosc: 60 }), 33);
  assert.equal(evaluateExpression('(8 + 2) * 4', {}), 40);
  assert.throws(() => evaluateExpression('globalThis.alert(1)', {}), /Niedozwolony znak|Nieznany parametr/);
  assert.throws(() => evaluateExpression('10 / 0', {}), /Dzielenie przez zero/);
});

test('wykrywa identyfikatory wyrażeń i stosuje jedną politykę tolerancji', () => {
  assert.deepEqual(listExpressionIdentifiers('szerokosc / 2 + luz + szerokosc'), ['szerokosc', 'luz']);
  assert.equal(isPositiveLength(GEOMETRY_POLICY.linearTolerance / 2), false);
  assert.equal(isPositiveLength(1), true);
  assert.equal(nearlyEqual(10, 10 + GEOMETRY_POLICY.linearTolerance / 2), true);
});

test('rozwiązuje parametry zależne niezależnie od kolejności', () => {
  const result = resolveParameters([
    { name: 'polowa', expression: 'baza / 2' },
    { name: 'baza', expression: '80' },
  ]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.values, { baza: 80, polowa: 40 });
  assert.deepEqual(result.errors, {});
});

test('wykrywa cykliczne zależności parametrów', () => {
  const result = resolveParameters([
    { name: 'a', expression: 'b + 1' },
    { name: 'b', expression: 'a + 1' },
  ]);
  assert.equal(result.valid, false);
  assert.match(result.errors.a, /Nieznany parametr|cykliczna/);
});

test('przygotowuje historię modelu startowego dla jądra CAD', () => {
  const document = createStarterDocument();
  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document);
  assert.equal(prepared.features.length, 2);
  assert.equal(prepared.features[0].distanceValue, 8);
  assert.equal(prepared.features[0].profiles[0].geometry.width, 60);
  assert.equal(prepared.features[1].diameterValue, 8);
});

test('graf zależności wyznacza elementy dotknięte zmianą parametru', () => {
  const document = createStarterDocument();
  const graph = buildDependencyGraph(document);
  const heightParameter = document.parameters.find((parameter) => parameter.name === 'wysokosc');
  const baseFeature = document.features[0];
  const holeFeature = document.features[1];
  const baseBodyId = `body-${baseFeature.id}`;
  const affected = new Set(graph.affectedBy(heightParameter.id));

  assert.ok(affected.has(baseFeature.id));
  assert.ok(affected.has(holeFeature.id));
  assert.ok(affected.has(baseBodyId));
  assert.equal(graph.producerOfBody(baseBodyId), baseFeature.id);
  assert.ok(graph.toJSON().edges.some((edge) => edge.from === baseFeature.id && edge.to === baseBodyId && edge.kind === 'produces'));
});

test('transakcja operacji zachowuje ostatni poprawny model po błędzie', () => {
  const originalBody = { id: 'body-base', shape: { version: 1 } };
  const bodyMap = new Map([[originalBody.id, originalBody]]);
  const bodyOrder = [originalBody.id];
  const transaction = executeFeatureTransaction(
    { id: 'feature-failing' },
    bodyMap,
    bodyOrder,
    (_feature, draftMap, draftOrder) => {
      draftMap.get(originalBody.id).shape = { version: 2 };
      draftOrder.push('body-partial');
      throw new Error('Kontrolowany błąd kernela.');
    },
  );

  assert.equal(transaction.committed, false);
  assert.equal(transaction.error.message, 'Kontrolowany błąd kernela.');
  assert.equal(transaction.bodyMap, bodyMap);
  assert.equal(transaction.bodyOrder, bodyOrder);
  assert.equal(bodyMap.get(originalBody.id).shape.version, 1);
  assert.deepEqual(bodyOrder, ['body-base']);
});

test('historia nadaje stany ok, warning, error, stale i suppressed bez częściowego wyniku', () => {
  const features = [
    { id: 'feature-ok', name: 'Poprawna', status: 'ready' },
    { id: 'feature-warning', name: 'Ostrzeżenie', status: 'ready' },
    { id: 'feature-error', name: 'Błędna', status: 'ready' },
    { id: 'feature-stale', name: 'Nieprzeliczona', status: 'ready' },
    { id: 'feature-suppressed', name: 'Wyłączona', status: FEATURE_STATUS.SUPPRESSED },
  ];
  const history = evaluateFeatureHistory(features, (feature, bodyMap, bodyOrder) => {
    if (feature.id === 'feature-error') {
      bodyMap.set('body-partial', { id: 'body-partial' });
      bodyOrder.push('body-partial');
      throw new Error('Błąd kontrolowany.');
    }
    bodyMap.set(`body-${feature.id}`, { id: `body-${feature.id}` });
    bodyOrder.push(`body-${feature.id}`);
    return feature.id === 'feature-warning'
      ? { diagnostics: [{ level: 'warning', code: 'TEST_WARNING', message: 'Kontrolowane ostrzeżenie.' }] }
      : { diagnostics: [] };
  });

  assert.deepEqual(history.timeline.map((item) => item.status), [
    FEATURE_STATUS.OK,
    FEATURE_STATUS.WARNING,
    FEATURE_STATUS.ERROR,
    FEATURE_STATUS.STALE,
    FEATURE_STATUS.SUPPRESSED,
  ]);
  assert.equal(history.bodyMap.has('body-partial'), false);
  assert.deepEqual(history.bodyOrder, ['body-feature-ok', 'body-feature-warning']);
  assert.equal(history.timeline[2].diagnostics[0].code, 'KERNEL_OPERATION_FAILED');
  assert.equal(history.timeline[3].diagnostics[0].code, 'UPSTREAM_FEATURE_FAILED');
});

test('trwałe nazwy topologii przeżywają zmianę kolejności i szum tolerancji', () => {
  const descriptors = [
    { surface: 'plane', center: [0, 0, 0], area: 100 },
    { surface: 'cylinder', center: [5, 0, 0], radius: 2, area: 40 },
  ];
  const initial = assignStableTopologyIds('feature-base', 'face', descriptors);
  const rebuilt = assignStableTopologyIds('feature-base', 'face', [
    { ...descriptors[1], radius: 2 + GEOMETRY_POLICY.linearTolerance / 4 },
    descriptors[0],
  ], initial);

  assert.equal(rebuilt[0].id, initial[1].id);
  assert.equal(rebuilt[1].id, initial[0].id);

  const changed = assignStableTopologyIds('feature-base', 'face', [
    { ...descriptors[1], radius: 2.01 },
  ], initial);
  assert.notEqual(changed[0].id, initial[1].id);
});

test('picking B-Rep mapuje trójkąty i segmenty na trwałe ID topologii', () => {
  const faceGroups = [
    { start: 0, count: 6, topologyId: 'face-stable-a' },
    { start: 6, count: 3, topologyId: 'face-stable-b' },
  ];
  assert.equal(topologyIdForFaceIndex(faceGroups, 0), 'face-stable-a');
  assert.equal(topologyIdForFaceIndex(faceGroups, 1), 'face-stable-a');
  assert.equal(topologyIdForFaceIndex(faceGroups, 2), 'face-stable-b');
  assert.equal(topologyIdForFaceIndex(faceGroups, 3), null);
  const lines = Float32Array.from([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0]);
  assert.deepEqual([...edgeGroupVertices(lines, { start: 2, count: 2 })], [1, 0, 0, 1, 1, 0]);

  assert.deepEqual(topologySelectionFromIntersection({
    faceIndex: 2,
    object: { userData: { bodyId: 'body-a', sourceFeatureId: 'feature-a', faceGroups } },
  }), { kind: 'face', id: 'face-stable-b', bodyId: 'body-a', sourceFeatureId: 'feature-a' });
  assert.deepEqual(topologySelectionFromIntersection({
    object: { userData: { bodyId: 'body-a', sourceFeatureId: 'feature-a', topologyKind: 'edge', topologyId: 'edge-stable-a' } },
  }), { kind: 'edge', id: 'edge-stable-a', bodyId: 'body-a', sourceFeatureId: 'feature-a' });
  assert.deepEqual(topologySelectionFromIntersection({
    object: { userData: { bodyId: 'body-a', sourceFeatureId: 'feature-a', topologyKind: 'vertex', topologyId: 'vertex-stable-a' } },
  }), { kind: 'vertex', id: 'vertex-stable-a', bodyId: 'body-a', sourceFeatureId: 'feature-a' });
});

test('utracona referencja topologii wskazuje feature źródłowy i pozwala na ponowne przypisanie', () => {
  const document = createDocument('Naprawa referencji');
  const source = createFeature('extrude', { name: 'Bryła źródłowa', sketchId: 'sketch-a', profileIds: ['profile-a'], distance: '10', operation: 'new' });
  const owner = createFeature('fillet', { name: 'Operacja zależna', targetBodyId: `body-${source.id}`, radius: '1' });
  document.features.push(source, owner);
  const body = {
    id: `body-${source.id}`,
    sourceFeatureId: source.id,
    topology: {
      faces: [],
      edges: [{ id: 'edge-current', descriptor: { endpoints: [[0, 0, 0], [10, 0, 0]] } }],
      vertices: [],
    },
  };
  const reference = createTopologyReference({
    selection: { kind: 'edge', id: 'edge-lost', bodyId: body.id, sourceFeatureId: source.id },
    ownerFeatureId: owner.id,
    descriptor: { endpoints: [[0, 0, 0], [9, 0, 0]] },
  });
  document.references.push(reference);
  const [lost] = inspectTopologyReferences(document, [body]);
  assert.equal(lost.status, 'lost');
  assert.equal(lost.sourceFeature.name, 'Bryła źródłowa');
  assert.equal(lost.ownerFeature.name, 'Operacja zależna');
  assert.equal(lost.candidates[0].id, 'edge-current');

  document.references[0] = reassignTopologyReference(reference, lost.candidates[0], lost.candidates[0].descriptor);
  const [resolved] = inspectTopologyReferences(document, [body]);
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.reference.topologyId, 'edge-current');
  assert.ok(resolved.reference.repairedAt);
});

test('offset plane ma trwałe ID, nazwę, widoczność i parametryczne położenie na XY, XZ i YZ', () => {
  const parameters = [{ id: 'param-offset', name: 'odsuniecie', label: 'Odsunięcie', expression: '12.5', unit: 'mm' }];
  const expected = {
    XY: [0, 0, 12.5],
    XZ: [0, -12.5, 0],
    YZ: [12.5, 0, 0],
  };
  for (const basePlane of Object.keys(expected)) {
    const plane = createOffsetPlane({ name: `Płaszczyzna ${basePlane}`, basePlane, offset: 'odsuniecie', visible: basePlane !== 'XZ' });
    const resolved = resolveConstructionPlane(plane, parameters);
    assert.match(plane.id, /^plane-/);
    assert.equal(resolved.name, `Płaszczyzna ${basePlane}`);
    assert.equal(resolved.visible, basePlane !== 'XZ');
    assert.deepEqual(resolved.origin, expected[basePlane]);
    assert.equal(resolved.offsetValue, 12.5);
  }
  const invalid = createOffsetPlane({ offset: 'brakujacy' });
  assert.equal(resolveConstructionPlanes([invalid], parameters)[0].status, 'error');
});

test('midplane wyznacza połowę dwóch położeń, a plane przez trzy punkty odrzuca współliniowość', () => {
  const parameters = [{ id: 'param-gap', name: 'rozstaw', label: 'Rozstaw', expression: '20', unit: 'mm' }];
  const midplane = resolveConstructionPlane(createMidplane({ basePlane: 'XY', firstOffset: '-4', secondOffset: 'rozstaw' }), parameters);
  assert.equal(midplane.offsetValue, 8);
  assert.deepEqual(midplane.origin, [0, 0, 8]);

  const threePoint = resolveConstructionPlane(createThreePointPlane({ points: [[0, 0, 2], [10, 0, 2], [0, 10, 2]] }), parameters);
  assert.deepEqual(threePoint.origin, [10 / 3, 10 / 3, 2]);
  assert.deepEqual(threePoint.normal, [0, 0, 1]);
  assert.throws(() => resolveConstructionPlane(createThreePointPlane({ points: [[0, 0, 0], [1, 1, 1], [2, 2, 2]] }), parameters), /zerowej długości/);
});

test('osie konstrukcyjne rozwiązują krawędź, walec, dwa punkty i przecięcie płaszczyzn', () => {
  const parameters = [createParameter('H', '12')];
  const edge = createEdgeAxis({ points: [[1, 2, 3], [11, 2, 3]], topologyId: 'edge-1', bodyId: 'body-1' });
  const cylinder = createCylinderAxis({ origin: ['H / 2', 0, 0], direction: [0, 0, -5], topologyId: 'face-1', bodyId: 'body-1' });
  const throughPoints = createTwoPointAxis({ points: [[0, 0, 0], [0, 'H', 'H']] });
  assert.deepEqual(resolveConstructionAxis(edge, [], parameters).direction, [1, 0, 0]);
  assert.deepEqual(resolveConstructionAxis(cylinder, [], parameters).origin, [6, 0, 0]);
  assert.deepEqual(resolveConstructionAxis(cylinder, [], parameters).direction, [0, 0, -1]);
  const liveBody = { id: 'body-1', topology: { edges: [{ id: 'edge-1', descriptor: { endpoints: [[2, 3, 4], [2, 13, 4]] } }], faces: [{ id: 'face-1', descriptor: { axisOrigin: [8, 9, 10], axisDirection: [1, 0, 0] } }] } };
  assert.deepEqual(resolveConstructionAxis(edge, [], parameters, [liveBody]).direction, [0, 1, 0]);
  assert.deepEqual(resolveConstructionAxis(cylinder, [], parameters, [liveBody]).origin, [8, 9, 10]);
  assert.throws(() => resolveConstructionAxis(edge, [], parameters, [{ ...liveBody, topology: { edges: [], faces: [] } }]), /Utracono źródłową krawędź/);
  const diagonal = resolveConstructionAxis(throughPoints, [], parameters).direction;
  assert.ok(Math.abs(diagonal[1] - Math.SQRT1_2) < 1e-12 && Math.abs(diagonal[2] - Math.SQRT1_2) < 1e-12);

  const xFive = createOffsetPlane({ name: 'X=5', basePlane: 'YZ', offset: '5' });
  const zThree = createOffsetPlane({ name: 'Z=3', basePlane: 'XY', offset: '3' });
  const intersection = createPlaneIntersectionAxis({ planeIds: [xFive.id, zThree.id] });
  const resolved = resolveConstructionAxis(intersection, [xFive, zThree, intersection], parameters);
  assert.deepEqual(resolved.origin.map((value) => Object.is(value, -0) ? 0 : value), [5, 0, 3]);
  assert.deepEqual(resolved.direction, [0, -1, 0]);
  assert.equal(resolveConstructionAxes([xFive, zThree, intersection], parameters)[0].status, 'ok');
  assert.throws(() => resolveConstructionAxis(createTwoPointAxis({ points: [[1, 1, 1], [1, 1, 1]] })), /zerowej długości/);
  assert.throws(() => resolveConstructionAxis(createPlaneIntersectionAxis({ planeIds: [xFive.id, createOffsetPlane({ basePlane: 'YZ', offset: '9' }).id] }), [xFive]), /Nie znaleziono/);
});

test('punkty konstrukcyjne śledzą wierzchołek, centrum i przecięcie osi z płaszczyzną', () => {
  const vertex = createVertexPoint({ position: ['2 + 3', 4, 5], topologyId: 'vertex-1', bodyId: 'body-1' });
  const center = createCenterPoint({ position: [1, 2, 3], topologyId: 'edge-1', bodyId: 'body-1', topologyKind: 'edge' });
  assert.deepEqual(resolveConstructionPoint(vertex).position, [5, 4, 5]);
  const body = { id: 'body-1', topology: { vertices: [{ id: 'vertex-1', descriptor: { point: [7, 8, 9] } }], edges: [{ id: 'edge-1', descriptor: { endpoints: [[0, 2, 4], [10, 6, 8]] } }], faces: [] } };
  assert.deepEqual(resolveConstructionPoint(vertex, [], [], [body]).position, [7, 8, 9]);
  assert.deepEqual(resolveConstructionPoint(center, [], [], [body]).position, [5, 4, 6]);

  const axis = createTwoPointAxis({ points: [[5, 6, -10], [5, 6, 10]] });
  const plane = createOffsetPlane({ basePlane: 'XY', offset: '3' });
  const intersection = createIntersectionPoint({ axisId: axis.id, planeId: plane.id });
  assert.deepEqual(resolveConstructionPoint(intersection, [axis, plane, intersection]).position, [5, 6, 3]);
  assert.equal(resolveConstructionPoints([axis, plane, intersection])[0].status, 'ok');
  const parallel = createTwoPointAxis({ points: [[0, 0, 2], [10, 0, 2]] });
  assert.throws(() => resolveConstructionPoint(createIntersectionPoint({ axisId: parallel.id, planeId: plane.id }), [parallel, plane]), /równoległa/);
});

test('kolejka workera zachowuje kolejność, a cache rewizji ma limit i LRU', async () => {
  const queue = new SerialTaskQueue();
  const order = [];
  await Promise.all([
    queue.enqueue(async () => {
      order.push('a-start');
      await Promise.resolve();
      order.push('a-end');
    }),
    queue.enqueue(async () => { order.push('b'); }),
  ]);
  assert.deepEqual(order, ['a-start', 'a-end', 'b']);

  const evicted = [];
  const cache = new RevisionCache({ maxEntries: 2, maxBytes: 10, onEvict: (_value, revision) => evicted.push(revision) });
  cache.set(1, { name: 'one' }, 4);
  cache.set(2, { name: 'two' }, 4);
  assert.equal(cache.get(1).name, 'one');
  cache.set(3, { name: 'three' }, 4);
  assert.equal(cache.get(2), null);
  assert.deepEqual(evicted, [2]);
  assert.deepEqual(cache.stats, { entries: 2, bytes: 8 });
  assert.equal(isStaleRevision(4, 5), true);
  assert.equal(isStaleRevision(5, 5), false);
});

test('polityka odtwarzania workera ma limit prób i reset po sukcesie', () => {
  const policy = new WorkerRecoveryPolicy({ maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 15 });
  assert.deepEqual(policy.recordCrash(), { attempt: 1, shouldRestart: true, delayMs: 10 });
  assert.deepEqual(policy.recordCrash(), { attempt: 2, shouldRestart: true, delayMs: 15 });
  assert.deepEqual(policy.recordCrash(), { attempt: 3, shouldRestart: false, delayMs: 15 });
  policy.recordSuccess();
  assert.deepEqual(policy.recordCrash(), { attempt: 1, shouldRestart: true, delayMs: 10 });
});

test('migruje rzeczywisty fixture dokumentu v2 do bieżącego schematu bez utraty geometrii', async () => {
  const raw = await readFile(new URL('./fixtures/document-v2.madcad', import.meta.url), 'utf8');
  const source = JSON.parse(raw);
  const sourceSnapshot = structuredClone(source);
  const migratedAt = '2026-08-04T12:00:00.000Z';
  const opened = openDocument(source, { now: migratedAt });

  assert.equal(opened.migrated, true);
  assert.equal(opened.readOnly, false);
  assert.equal(opened.sourceVersion, 2);
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(source, sourceSnapshot, 'migracja nie może zmieniać źródłowego obiektu v2');
  assert.equal(opened.document.sketches[0].entities.length, 10);
  assert.equal(opened.document.sketches[0].profiles[0].entityIds.length, 4);
  assert.equal(opened.document.sketches[0].profiles[1].entityIds.length, 1);
  assert.deepEqual(opened.document.sketches[0].constraints, []);
  assert.deepEqual(opened.document.sketches[0].dimensions, []);
  assert.deepEqual(opened.document.bodies, []);
  assert.deepEqual(opened.document.components, []);
  assert.deepEqual(opened.document.references, []);
  assert.equal(opened.document.metadata.migratedFromVersion, 2);
  assert.equal(opened.document.metadata.migratedAt, migratedAt);
  assert.equal(validateDocument(opened.document).valid, true);

  const prepared = prepareDocument(opened.document);
  assert.equal(prepared.features.length, 2);
  assert.equal(prepared.features[0].profiles[0].geometry.width, 60);
  assert.equal(prepared.features[0].distanceValue, 8);
  assert.equal(prepared.features[1].diameterValue, 8);

  const reopened = openDocument(JSON.parse(JSON.stringify(opened.document)));
  assert.equal(reopened.migrated, false);
  assert.deepEqual(reopened.document, opened.document);
});

test('otwiera zgodny dokument z nowszej wersji wyłącznie do odczytu', () => {
  const future = createStarterDocument();
  future.schemaVersion = DOCUMENT_SCHEMA_VERSION + 1;
  future.futureWorkspace = { enabled: true };

  const opened = openDocument(future);
  assert.equal(opened.readOnly, true);
  assert.equal(opened.migrated, false);
  assert.equal(opened.sourceVersion, DOCUMENT_SCHEMA_VERSION + 1);
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.equal(opened.document.futureWorkspace.enabled, true);
  assert.equal(opened.originalDocument.schemaVersion, DOCUMENT_SCHEMA_VERSION + 1);
  assert.match(opened.warning, /tylko do odczytu/i);
  assert.equal(validateDocument(opened.document).valid, true);
});

test('walidacja wskazuje dokładną ścieżkę zerwanej referencji i duplikatu ID', () => {
  const document = createStarterDocument();
  document.features[0].profileIds[0] = 'profile-missing';
  document.sketches[0].profiles[0].id = document.sketches[0].id;
  document.sketches[0].constraints.push({
    id: 'constraint-broken-reference',
    type: 'coincident',
    entityIds: ['entity-missing'],
  });

  const validation = validateDocument(document);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.path === 'features[0].profileIds[0]' && issue.code === 'BROKEN_REFERENCE'));
  assert.ok(validation.issues.some((issue) => issue.path === 'sketches[0].profiles[0].id' && issue.code === 'DUPLICATE_ID'));
  assert.ok(validation.issues.some((issue) => issue.path === 'sketches[0].constraints[0].entityIds[0]' && issue.code === 'BROKEN_REFERENCE'));
});

test('round-trip .madcad zachowuje dokument bez utraty danych', () => {
  const source = createStarterDocument();
  const serialized = JSON.stringify(source);
  const opened = openDocument(JSON.parse(serialized));

  assert.equal(opened.migrated, false);
  assert.equal(opened.readOnly, false);
  assert.deepEqual(opened.document, source);
  assert.equal(JSON.stringify(opened.document), serialized);
});

test('deterministyczny fuzz odrzuca zera i skrajne błędy, a zachowuje poprawne wymiary', () => {
  let state = 0x4d414443;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  for (let index = 0; index < 100; index += 1) {
    const left = 1 + Math.floor(random() * 100000);
    const right = 1 + Math.floor(random() * 100000);
    const divisor = 1 + Math.floor(random() * 1000);
    const expression = `${left} + ${right} * 2 / ${divisor}`;
    assert.equal(evaluateExpression(expression), left + ((right * 2) / divisor));

    const document = createStarterDocument();
    const exponent = -4 + (random() * 10);
    const width = 10 ** exponent;
    document.parameters.find((parameter) => parameter.name === 'szerokosc').expression = String(width);
    const prepared = prepareDocument(document);
    assert.equal(prepared.features[0].profiles[0].geometry.width, width);
  }

  for (const invalidWidth of ['0', String(GEOMETRY_POLICY.linearTolerance / 2), '-1', '1e309', 'brakujacy']) {
    const document = createStarterDocument();
    document.parameters.find((parameter) => parameter.name === 'szerokosc').expression = invalidWidth;
    assert.throws(() => prepareDocument(document));
  }
});

test('duży dokument mieści się w budżecie przygotowania historii', () => {
  const document = createDocument('Test wydajności');
  for (let index = 0; index < 200; index += 1) {
    const profile = createRectangleProfile({
      name: `Profil ${index + 1}`,
      width: String(10 + (index % 20)),
      height: String(10 + (index % 15)),
      x: String(index * 2),
      y: '0',
    });
    const sketch = createSketch({ name: `Szkic ${index + 1}`, profiles: [profile] });
    const feature = createFeature('extrude', {
      name: `Bryła ${index + 1}`,
      sketchId: sketch.id,
      profileIds: [profile.id],
      distance: '5',
      operation: 'new',
    });
    document.sketches.push(sketch);
    document.features.push(feature);
  }

  const startedAt = performance.now();
  const prepared = prepareDocument(document);
  const durationMs = performance.now() - startedAt;
  assert.equal(prepared.features.length, 200);
  assert.ok(
    durationMs < GEOMETRY_POLICY.performanceBudgets.prepareLargeMs,
    `Przygotowanie dużego dokumentu trwało ${durationMs.toFixed(1)} ms.`,
  );
});

test('mały i średni dokument mieszczą się w osobnych budżetach wydajności', () => {
  const scenarios = [
    { name: 'mały', featureCount: 10, budget: GEOMETRY_POLICY.performanceBudgets.prepareSmallMs },
    { name: 'średni', featureCount: 75, budget: GEOMETRY_POLICY.performanceBudgets.prepareMediumMs },
  ];
  for (const scenario of scenarios) {
    const document = createDocument(`Model ${scenario.name}`);
    for (let index = 0; index < scenario.featureCount; index += 1) {
      const profile = createRectangleProfile({ width: '20', height: '12', x: String(index * 2), y: '0' });
      const sketch = createSketch({ name: `Szkic ${index + 1}`, profiles: [profile] });
      document.sketches.push(sketch);
      document.features.push(createFeature('extrude', {
        name: `Bryła ${index + 1}`,
        sketchId: sketch.id,
        profileIds: [profile.id],
        distance: '5',
        operation: 'new',
      }));
    }
    const startedAt = performance.now();
    prepareDocument(document);
    const durationMs = performance.now() - startedAt;
    assert.ok(durationMs < scenario.budget, `${scenario.name}: ${durationMs.toFixed(1)} ms >= ${scenario.budget} ms`);
  }
});

test('model szkicu obsługuje punkty, linie, łuki, okręgi i wszystkie role geometrii', () => {
  const document = createDocument('Kontrakt encji szkicu');
  const center = createSketchPoint({ x: 0, y: 0, fixed: true });
  const start = createSketchPoint({ x: 10, y: 0 });
  const end = createSketchPoint({ x: 0, y: 10 });
  const line = createSketchLine({ startPointId: start.id, endPointId: end.id });
  const construction = createSketchLine({ startPointId: center.id, endPointId: start.id, role: 'construction' });
  const centerline = createSketchLine({ startPointId: center.id, endPointId: end.id, role: 'centerline' });
  const arc = createSketchArc({ centerPointId: center.id, startPointId: start.id, endPointId: end.id, direction: 'ccw' });
  const circle = createSketchCircleEntity({
    centerPointId: center.id,
    radius: 'promien',
    role: 'projected',
    sourceReferenceId: 'face:external:1',
  });
  document.parameters.push({ id: 'param-radius', name: 'promien', label: 'Promień', expression: '5', unit: 'mm' });
  document.sketches.push(createSketch({ entities: [center, start, end, line, construction, centerline, arc, circle] }));

  const validation = validateDocument(document);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(document.sketches[0].entities.find((entity) => entity.id === center.id).fixed, true);
  assert.deepEqual(new Set(document.sketches[0].entities.map((entity) => entity.role)), new Set(['standard', 'construction', 'centerline', 'projected']));
  assert.deepEqual(line.pointIds, [start.id, end.id]);
  assert.deepEqual(arc.pointIds, [center.id, start.id, end.id]);

  const brokenParameter = structuredClone(document);
  brokenParameter.sketches[0].entities.find((entity) => entity.type === 'circle').geometry.radius = 'nieistniejacyParametr';
  const brokenValidation = validateDocument(brokenParameter);
  assert.ok(brokenValidation.issues.some((issue) => issue.code === 'BROKEN_REFERENCE' && issue.path.endsWith('.geometry.radius')));
});

test('solver szkicu wyznacza stopnie swobody, fixed, pełne związanie i konflikt', () => {
  const start = createSketchPoint({ x: 0, y: 0 });
  const end = createSketchPoint({ x: 20, y: 0 });
  const line = createSketchLine({ startPointId: start.id, endPointId: end.id });
  const horizontal = createSketchConstraint('horizontal', [line.id]);
  const sketch = createSketch({ entities: [start, end, line], constraints: [horizontal] });

  const under = analyzeSketchConstraints(sketch);
  assert.equal(under.status, SKETCH_SOLVER_STATUS.UNDER_CONSTRAINED);
  assert.equal(under.variableCount, 4);
  assert.equal(under.rank, 1);
  assert.equal(under.degreesOfFreedom, 3);
  assert.equal(under.solved, true);

  sketch.entities.find((entity) => entity.id === start.id).fixed = true;
  sketch.entities.find((entity) => entity.id === end.id).fixed = true;
  const fully = analyzeSketchConstraints(sketch);
  assert.equal(fully.status, SKETCH_SOLVER_STATUS.FULLY_CONSTRAINED);
  assert.equal(fully.degreesOfFreedom, 0);
  assert.ok(fully.points.every((point) => point.fixed));

  sketch.entities.find((entity) => entity.id === end.id).geometry.y = '5';
  const conflict = analyzeSketchConstraints(sketch);
  assert.equal(conflict.status, SKETCH_SOLVER_STATUS.CONFLICT);
  assert.ok(conflict.diagnostics.some((entry) => entry.code === 'CONFLICTING_FIXED_GEOMETRY' && entry.constraintIds.includes(horizontal.id)));
});

test('solver rozpoznaje nadmiarowy więz i nie zgaduje nieobsługiwanej relacji', () => {
  const first = createSketchPoint({ x: 0, y: 0 });
  const second = createSketchPoint({ x: 10, y: 0 });
  const line = createSketchLine({ startPointId: first.id, endPointId: second.id });
  const firstHorizontal = createSketchConstraint('horizontal', [line.id]);
  const duplicateHorizontal = createSketchConstraint('horizontal', [first.id, second.id]);
  const parallel = createSketchConstraint('parallel', [line.id]);
  const sketch = createSketch({ entities: [first, second, line], constraints: [firstHorizontal, duplicateHorizontal, parallel] });
  const result = analyzeSketchConstraints(sketch);

  assert.equal(result.status, SKETCH_SOLVER_STATUS.OVER_CONSTRAINED);
  assert.equal(result.degreesOfFreedom, 3);
  assert.ok(result.diagnostics.some((entry) => entry.code === 'REDUNDANT_CONSTRAINTS'));
  assert.ok(result.diagnostics.some((entry) => entry.code === 'UNSUPPORTED_CONSTRAINT' && entry.constraintIds.includes(parallel.id)));
});

test('solver projektuje coincident, horizontal i vertical bez zmiany trwałych ID', () => {
  const fixedOrigin = createSketchPoint({ x: 0, y: 0, fixed: true });
  const horizontalEnd = createSketchPoint({ x: 20, y: 7 });
  const coincidentPoint = createSketchPoint({ x: 24, y: -3 });
  const verticalEnd = createSketchPoint({ x: 9, y: 30 });
  const horizontalLine = createSketchLine({ startPointId: fixedOrigin.id, endPointId: horizontalEnd.id });
  const verticalLine = createSketchLine({ startPointId: coincidentPoint.id, endPointId: verticalEnd.id });
  const sketch = createSketch({
    entities: [fixedOrigin, horizontalEnd, coincidentPoint, verticalEnd, horizontalLine, verticalLine],
    constraints: [
      createSketchConstraint('horizontal', [horizontalLine.id]),
      createSketchConstraint('coincident', [horizontalEnd.id, coincidentPoint.id]),
      createSketchConstraint('vertical', [verticalLine.id]),
    ],
  });
  const original = structuredClone(sketch);
  const solution = solveSketchConstraints(sketch);

  assert.equal(solution.converged, true);
  assert.equal(solution.solved, true);
  assert.equal(solution.status, SKETCH_SOLVER_STATUS.UNDER_CONSTRAINED);
  assert.deepEqual(sketch, original, 'obliczenie rozwiązania nie mutuje dokumentu');
  applySketchConstraintSolution(sketch, solution);
  const points = new Map(sketch.entities.filter((entity) => entity.type === 'point').map((point) => [point.id, point]));
  assert.ok(Math.abs(Number(points.get(horizontalEnd.id).geometry.y)) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(Number(points.get(coincidentPoint.id).geometry.x) - Number(points.get(horizontalEnd.id).geometry.x)) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(Number(points.get(coincidentPoint.id).geometry.y)) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(Number(points.get(verticalEnd.id).geometry.x) - Number(points.get(coincidentPoint.id).geometry.x)) <= GEOMETRY_POLICY.linearTolerance);
  assert.deepEqual(sketch.entities.map((entity) => entity.id), original.entities.map((entity) => entity.id));
});

test('solver utrzymuje wymiar distance z parametru dokumentu', () => {
  const origin = createSketchPoint({ x: 0, y: 0, fixed: true });
  const end = createSketchPoint({ x: 8, y: 6 });
  const line = createSketchLine({ startPointId: origin.id, endPointId: end.id });
  const distanceConstraint = createSketchConstraint('distance', [line.id], { value: 'dlugosc' });
  const sketch = createSketch({ entities: [origin, end, line], constraints: [distanceConstraint] });
  const solution = solveSketchConstraints(sketch, [{ name: 'dlugosc', expression: '20' }]);

  assert.equal(solution.converged, true);
  assert.equal(solution.solved, true);
  assert.equal(solution.degreesOfFreedom, 1);
  const update = solution.updates.find((entry) => entry.pointId === end.id);
  assert.ok(Math.abs(Math.hypot(update.x, update.y) - 20) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(update.x - 16) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(update.y - 12) <= GEOMETRY_POLICY.linearTolerance);
  const document = createDocument('Parametryczny więz odległości');
  document.parameters.push({ id: 'param-distance', name: 'dlugosc', label: 'Długość', expression: '20', unit: 'mm' });
  document.sketches.push(sketch);
  assert.equal(validateDocument(document).valid, true);
  const broken = structuredClone(document);
  broken.sketches[0].constraints[0].value = 'brakujacyParametr';
  assert.ok(validateDocument(broken).issues.some((issue) => issue.path.endsWith('.constraints[0].value') && issue.code === 'BROKEN_REFERENCE'));
});

test('solver utrzymuje kąt między liniami w stopniach', () => {
  const origin = createSketchPoint({ x: 0, y: 0, fixed: true });
  const referenceEnd = createSketchPoint({ x: 10, y: 0, fixed: true });
  const angledEnd = createSketchPoint({ x: 8, y: 6 });
  const reference = createSketchLine({ startPointId: origin.id, endPointId: referenceEnd.id });
  const angled = createSketchLine({ startPointId: origin.id, endPointId: angledEnd.id });
  const angle = createSketchConstraint('angle', [reference.id, angled.id], { value: 'kat' });
  const sketch = createSketch({ entities: [origin, referenceEnd, angledEnd, reference, angled], constraints: [angle] });
  const originalIds = sketch.entities.map((entity) => entity.id);
  const solution = solveSketchConstraints(sketch, [{ name: 'kat', expression: '90' }]);

  assert.equal(solution.converged, true);
  assert.equal(solution.solved, true);
  assert.equal(solution.degreesOfFreedom, 1);
  applySketchConstraintSolution(sketch, solution);
  const update = sketch.entities.find((entity) => entity.id === angledEnd.id);
  assert.ok(Math.abs(Number(update.geometry.x)) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(Number(update.geometry.y) - 10) <= GEOMETRY_POLICY.linearTolerance);
  assert.deepEqual(sketch.entities.map((entity) => entity.id), originalIds);
});

test('solver steruje promieniem i średnicą okręgu jako osobnym stopniem swobody', () => {
  const center = createSketchPoint({ x: 0, y: 0, fixed: true });
  const circle = createSketchCircleEntity({ centerPointId: center.id, radius: 5 });
  const radius = createSketchConstraint('radius', [circle.id], { value: 'promien' });
  const sketch = createSketch({ entities: [center, circle], constraints: [radius] });
  const solution = solveSketchConstraints(sketch, [{ name: 'promien', expression: '8' }]);

  assert.equal(solution.converged, true);
  assert.equal(solution.solved, true);
  assert.equal(solution.status, SKETCH_SOLVER_STATUS.FULLY_CONSTRAINED);
  assert.equal(solution.variableCount, 1);
  assert.equal(solution.rank, 1);
  applySketchConstraintSolution(sketch, solution);
  assert.equal(sketch.entities.find((entity) => entity.id === circle.id).geometry.radius, '8');

  const diameterSketch = structuredClone(sketch);
  diameterSketch.constraints = [createSketchConstraint('diameter', [circle.id], { value: '20' })];
  const diameterSolution = solveSketchConstraints(diameterSketch);
  assert.equal(diameterSolution.solved, true);
  assert.equal(diameterSolution.entityUpdates.find((entry) => entry.entityId === circle.id).geometry.radius, '10');
});

test('wymiary poziomy, pionowy i aligned tworzą spójne sterujące więzy', () => {
  const origin = createSketchPoint({ x: 0, y: 0, fixed: true });
  const end = createSketchPoint({ x: 3, y: 4 });
  const line = createSketchLine({ startPointId: origin.id, endPointId: end.id });
  const sketch = createSketch({ entities: [origin, end, line] });
  const horizontal = addDrivingSketchDimension(sketch, 'horizontal', [line.id], { expression: 'szerokosc' });
  const vertical = addDrivingSketchDimension(sketch, 'vertical', [line.id], { expression: 'wysokosc' });
  const solution = solveSketchConstraints(sketch, [
    { name: 'szerokosc', expression: '12' },
    { name: 'wysokosc', expression: '9' },
  ]);

  assert.equal(horizontal.constraint.type, 'distanceX');
  assert.equal(vertical.constraint.type, 'distanceY');
  assert.equal(horizontal.dimension.constraintId, horizontal.constraint.id);
  assert.equal(solution.status, SKETCH_SOLVER_STATUS.FULLY_CONSTRAINED);
  assert.equal(solution.solved, true);
  const update = solution.updates.find((entry) => entry.pointId === end.id);
  assert.ok(Math.abs(update.x - 12) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(update.y - 9) <= GEOMETRY_POLICY.linearTolerance);

  const document = createDocument('Wymiary sterujące');
  document.parameters.push(
    { id: 'param-width', name: 'szerokosc', label: 'Szerokość', expression: '12', unit: 'mm' },
    { id: 'param-height', name: 'wysokosc', label: 'Wysokość', expression: '9', unit: 'mm' },
  );
  document.sketches.push(sketch);
  assert.equal(validateDocument(document).valid, true);

  const alignedSketch = createSketch({ entities: [structuredClone(origin), structuredClone(end), structuredClone(line)] });
  const aligned = addDrivingSketchDimension(alignedSketch, 'aligned', [line.id], { expression: '15' });
  assert.equal(aligned.constraint.type, 'distance');
  assert.equal(solveSketchConstraints(alignedSketch).solved, true);

  const orphaned = structuredClone(document);
  orphaned.sketches[0].dimensions[0].constraintId = 'constraint-missing';
  assert.ok(validateDocument(orphaned).issues.some((issue) => issue.path.endsWith('.dimensions[0].constraintId') && issue.code === 'BROKEN_REFERENCE'));
  assert.throws(() => createSketchDimension('unsupported', [line.id]), /Nieobsługiwany typ wymiaru/);
});

test('diagnostyka wskazuje minimalny zestaw sprzecznych więzów', () => {
  const origin = createSketchPoint({ x: 0, y: 0, fixed: true });
  const end = createSketchPoint({ x: 10, y: 0 });
  const line = createSketchLine({ startPointId: origin.id, endPointId: end.id });
  const horizontal = createSketchConstraint('horizontal', [line.id]);
  const widthTen = createSketchConstraint('distanceX', [line.id], { value: '10' });
  const widthTwenty = createSketchConstraint('distanceX', [line.id], { value: '20' });
  const sketch = createSketch({ entities: [origin, end, line], constraints: [horizontal, widthTen, widthTwenty] });
  const analysis = analyzeSketchConstraints(sketch);

  assert.equal(analysis.status, SKETCH_SOLVER_STATUS.CONFLICT);
  assert.deepEqual(new Set(analysis.conflictConstraintIds), new Set([widthTen.id, widthTwenty.id]));
  assert.equal(analysis.conflictConstraintIds.includes(horizontal.id), false);
  assert.ok(analysis.diagnostics.some((entry) => entry.code === 'CONFLICTING_CONSTRAINTS'
    && entry.constraintIds.length === 2
    && entry.constraintIds.includes(widthTen.id)
    && entry.constraintIds.includes(widthTwenty.id)));
});

test('w pełni związany wspornik przebudowuje bryłę i zachowuje ID po zmianie dwóch wymiarów oraz ponownym otwarciu', () => {
  const document = createDocument('Parametryczny wspornik');
  const points = [
    createSketchPoint({ x: 0, y: 0, fixed: true }),
    createSketchPoint({ x: 40, y: 0 }),
    createSketchPoint({ x: 40, y: 30 }),
    createSketchPoint({ x: 0, y: 30 }),
  ];
  const lines = points.map((point, index) => createSketchLine({
    startPointId: point.id,
    endPointId: points[(index + 1) % points.length].id,
  }));
  const sketch = createSketch({ entities: [...points, ...lines], constraints: [
    createSketchConstraint('horizontal', [lines[0].id]),
    createSketchConstraint('vertical', [lines[1].id]),
    createSketchConstraint('horizontal', [lines[2].id]),
    createSketchConstraint('vertical', [lines[3].id]),
  ] });
  const width = addDrivingSketchDimension(sketch, 'horizontal', [points[0].id, points[1].id], { expression: '40' });
  const height = addDrivingSketchDimension(sketch, 'vertical', [points[0].id, points[3].id], { expression: '30' });
  refreshDetectedSketchProfiles(sketch);
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '5', operation: 'new' }));
  const stableIds = {
    entities: sketch.entities.map((entity) => entity.id),
    profile: sketch.profiles[0].id,
    feature: document.features[0].id,
  };
  assert.equal(analyzeSketchConstraints(sketch).status, SKETCH_SOLVER_STATUS.FULLY_CONSTRAINED);
  assert.equal(prepareDocument(document).features[0].profiles[0].geometry.width, 40);
  assert.equal(prepareDocument(document).features[0].profiles[0].geometry.height, 30);

  width.constraint.value = '60';
  width.dimension.expression = '60';
  let solution = solveSketchConstraints(sketch);
  assert.equal(solution.solved, true);
  applySketchConstraintSolution(sketch, solution);
  refreshDetectedSketchProfiles(sketch);
  height.constraint.value = '25';
  height.dimension.expression = '25';
  solution = solveSketchConstraints(sketch);
  assert.equal(solution.solved, true);
  applySketchConstraintSolution(sketch, solution);
  refreshDetectedSketchProfiles(sketch);

  assert.equal(analyzeSketchConstraints(sketch).status, SKETCH_SOLVER_STATUS.FULLY_CONSTRAINED);
  assert.deepEqual(sketch.entities.map((entity) => entity.id), stableIds.entities);
  assert.equal(sketch.profiles[0].id, stableIds.profile);
  assert.equal(document.features[0].id, stableIds.feature);
  assert.equal(document.features[0].profileIds[0], stableIds.profile);
  const prepared = prepareDocument(document);
  assert.ok(Math.abs(prepared.features[0].profiles[0].geometry.width - 60) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(prepared.features[0].profiles[0].geometry.height - 25) <= GEOMETRY_POLICY.linearTolerance);

  const reopened = openDocument(JSON.parse(JSON.stringify(document))).document;
  assert.equal(validateDocument(reopened).valid, true);
  assert.deepEqual(reopened.sketches[0].entities.map((entity) => entity.id), stableIds.entities);
  assert.equal(reopened.sketches[0].profiles[0].id, stableIds.profile);
  assert.equal(reopened.features[0].id, stableIds.feature);
  assert.ok(Math.abs(prepareDocument(reopened).features[0].profiles[0].geometry.width - 60) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(prepareDocument(reopened).features[0].profiles[0].geometry.height - 25) <= GEOMETRY_POLICY.linearTolerance);
});

test('solver utrzymuje equal dla linii i okręgów', () => {
  const a0 = createSketchPoint({ x: 0, y: 0, fixed: true });
  const a1 = createSketchPoint({ x: 10, y: 0, fixed: true });
  const b0 = createSketchPoint({ x: 20, y: 0, fixed: true });
  const b1 = createSketchPoint({ x: 23, y: 4 });
  const firstLine = createSketchLine({ startPointId: a0.id, endPointId: a1.id });
  const secondLine = createSketchLine({ startPointId: b0.id, endPointId: b1.id });
  const lineSketch = createSketch({ entities: [a0, a1, b0, b1, firstLine, secondLine], constraints: [createSketchConstraint('equal', [firstLine.id, secondLine.id])] });
  const lineSolution = solveSketchConstraints(lineSketch);
  assert.equal(lineSolution.solved, true);
  const lineEnd = lineSolution.updates.find((entry) => entry.pointId === b1.id);
  assert.ok(Math.abs(Math.hypot(lineEnd.x - 20, lineEnd.y) - 10) <= GEOMETRY_POLICY.linearTolerance);

  const c0 = createSketchPoint({ x: 0, y: 0 });
  const c1 = createSketchPoint({ x: 20, y: 0, fixed: true });
  const firstCircle = createSketchCircleEntity({ centerPointId: c0.id, radius: 5, fixed: true });
  const secondCircle = createSketchCircleEntity({ centerPointId: c1.id, radius: 8 });
  const circleSketch = createSketch({ entities: [c0, c1, firstCircle, secondCircle], constraints: [createSketchConstraint('equal', [firstCircle.id, secondCircle.id])] });
  const circleSolution = solveSketchConstraints(circleSketch);
  assert.equal(circleSolution.solved, true);
  assert.equal(circleSolution.status, SKETCH_SOLVER_STATUS.FULLY_CONSTRAINED);
  assert.equal(circleSolution.entityUpdates.find((entry) => entry.entityId === secondCircle.id).geometry.radius, '5');
});

test('solver utrzymuje styczność linii z okręgiem oraz dwóch okręgów', () => {
  const lineStart = createSketchPoint({ x: -10, y: 0, fixed: true });
  const lineEnd = createSketchPoint({ x: 10, y: 0, fixed: true });
  const center = createSketchPoint({ x: 0, y: 8 });
  const line = createSketchLine({ startPointId: lineStart.id, endPointId: lineEnd.id });
  const circle = createSketchCircleEntity({ centerPointId: center.id, radius: 5 });
  const lineCircleSketch = createSketch({ entities: [lineStart, lineEnd, center, line, circle], constraints: [createSketchConstraint('tangent', [line.id, circle.id])] });
  const lineCircleSolution = solveSketchConstraints(lineCircleSketch);
  assert.equal(lineCircleSolution.solved, true);
  assert.ok(Math.abs(lineCircleSolution.updates.find((entry) => entry.pointId === center.id).y - 5) <= GEOMETRY_POLICY.linearTolerance);

  const firstCenter = createSketchPoint({ x: 0, y: 0, fixed: true });
  const secondCenter = createSketchPoint({ x: 10, y: 0 });
  const firstCircle = createSketchCircleEntity({ centerPointId: firstCenter.id, radius: 5, fixed: true });
  const secondCircle = createSketchCircleEntity({ centerPointId: secondCenter.id, radius: 3 });
  const circleSketch = createSketch({ entities: [firstCenter, secondCenter, firstCircle, secondCircle], constraints: [createSketchConstraint('tangent', [firstCircle.id, secondCircle.id])] });
  const circleSolution = solveSketchConstraints(circleSketch);
  assert.equal(circleSolution.solved, true);
  const movedCenter = circleSolution.updates.find((entry) => entry.pointId === secondCenter.id);
  assert.ok(Math.abs(Math.hypot(movedCenter.x, movedCenter.y) - 8) <= GEOMETRY_POLICY.linearTolerance);
});

test('Trim usuwa wskazany środkowy fragment linii i bezpiecznie czyści zależności', () => {
  const document = createDocument('Trim linii');
  const points = [[0, 0], [20, 0], [20, 10], [0, 10]].map(([x, y]) => createSketchPoint({ x, y }));
  const boundary = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
  const sketch = createSketch({ entities: [...points, ...boundary] });
  refreshDetectedSketchProfiles(sketch);
  const profileId = sketch.profiles[0].id;
  const feature = createFeature('extrude', { sketchId: sketch.id, profileIds: [profileId], distance: '5', operation: 'new' });
  const lowerA = createSketchPoint({ x: 5, y: -5 });
  const upperA = createSketchPoint({ x: 5, y: 5 });
  const lowerB = createSketchPoint({ x: 15, y: -5 });
  const upperB = createSketchPoint({ x: 15, y: 5 });
  sketch.entities.push(lowerA, upperA, lowerB, upperB,
    createSketchLine({ startPointId: lowerA.id, endPointId: upperA.id, role: 'construction' }),
    createSketchLine({ startPointId: lowerB.id, endPointId: upperB.id, role: 'construction' }));
  const horizontal = createSketchConstraint('horizontal', [boundary[0].id]);
  sketch.constraints.push(horizontal);
  const dimension = createSketchDimension('aligned', [boundary[0].id], { expression: '20', constraintId: horizontal.id });
  sketch.dimensions.push(dimension);
  document.sketches.push(sketch);
  document.features.push(feature);

  const result = trimSketchEntity(document, sketch.id, boundary[0].id, [10, 0]);
  const lines = sketch.entities.filter((entity) => entity.type === 'line' && entity.role === 'standard');
  const pointMap = new Map(sketch.entities.filter((entity) => entity.type === 'point').map((point) => [point.id, point]));
  const retained = lines.find((line) => line.id === boundary[0].id);
  const continuation = lines.find((line) => result.createdEntityIds.includes(line.id));

  assert.ok(retained);
  assert.ok(continuation);
  assert.ok(Math.abs(Number(pointMap.get(retained.pointIds[1]).geometry.x) - 5) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(Number(pointMap.get(continuation.pointIds[0]).geometry.x) - 15) <= GEOMETRY_POLICY.linearTolerance);
  assert.deepEqual(result.removedConstraintIds, [horizontal.id]);
  assert.deepEqual(result.removedDimensionIds, [dimension.id]);
  assert.deepEqual(result.removedProfileIds, [profileId]);
  assert.deepEqual(result.removedFeatureIds, [feature.id]);
  assert.equal(document.features.length, 0);
});

test('Trim dzieli łuk na dwa trwałe fragmenty i odrzuca brak ograniczającego przecięcia bez mutacji', () => {
  const document = createDocument('Trim łuku');
  const center = createSketchPoint({ x: 0, y: 0 });
  const start = createSketchPoint({ x: 10, y: 0 });
  const end = createSketchPoint({ x: -10, y: 0 });
  const arc = createSketchArc({ centerPointId: center.id, startPointId: start.id, endPointId: end.id, direction: 'ccw' });
  const cutterPoints = [[5, 0], [5, 15], [-5, 0], [-5, 15]].map(([x, y]) => createSketchPoint({ x, y }));
  const cutters = [
    createSketchLine({ startPointId: cutterPoints[0].id, endPointId: cutterPoints[1].id, role: 'construction' }),
    createSketchLine({ startPointId: cutterPoints[2].id, endPointId: cutterPoints[3].id, role: 'construction' }),
  ];
  const sketch = createSketch({ entities: [center, start, end, ...cutterPoints, arc, ...cutters] });
  document.sketches.push(sketch);
  const result = trimSketchEntity(document, sketch.id, arc.id, [0, 10]);
  const arcs = sketch.entities.filter((entity) => entity.type === 'arc');
  assert.equal(arcs.length, 2);
  assert.equal(arcs.some((entity) => entity.id === arc.id), true);
  assert.equal(arcs.some((entity) => result.createdEntityIds.includes(entity.id)), true);

  const isolatedDocument = createDocument('Trim bez przecięcia');
  const isolatedStart = createSketchPoint({ x: 0, y: 0 });
  const isolatedEnd = createSketchPoint({ x: 10, y: 0 });
  const isolatedLine = createSketchLine({ startPointId: isolatedStart.id, endPointId: isolatedEnd.id });
  const isolatedSketch = createSketch({ entities: [isolatedStart, isolatedEnd, isolatedLine] });
  isolatedDocument.sketches.push(isolatedSketch);
  const before = structuredClone(isolatedDocument);
  assert.throws(() => trimSketchEntity(isolatedDocument, isolatedSketch.id, isolatedLine.id, [5, 0]), /Brak przecięcia/);
  assert.deepEqual(isolatedDocument, before);
});

test('Break dzieli linię w profilu bez utraty ID profilu i zależnej operacji', () => {
  const document = createDocument('Break profilu');
  const points = [[0, 0], [20, 0], [20, 10], [0, 10]].map(([x, y]) => createSketchPoint({ x, y }));
  const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
  const sketch = createSketch({ entities: [...points, ...lines] });
  refreshDetectedSketchProfiles(sketch);
  const profileId = sketch.profiles[0].id;
  const feature = createFeature('extrude', { sketchId: sketch.id, profileIds: [profileId], distance: '4', operation: 'new' });
  const horizontal = createSketchConstraint('horizontal', [lines[0].id]);
  sketch.constraints.push(horizontal);
  document.sketches.push(sketch);
  document.features.push(feature);

  const result = breakSketchEntity(document, sketch.id, lines[0].id, [8, 1]);
  assert.equal(sketch.entities.some((entity) => entity.id === lines[0].id), true);
  assert.equal(sketch.entities.some((entity) => entity.id === result.continuationEntityId), true);
  assert.equal(sketch.profiles.length, 1);
  assert.equal(sketch.profiles[0].id, profileId);
  assert.equal(document.features[0].id, feature.id);
  assert.equal(document.features[0].profileIds[0], profileId);
  assert.deepEqual(result.removedConstraintIds, [horizontal.id]);
  assert.equal(validateDocument(document).valid, true);
});

test('Extend przedłuża wskazany koniec linii i łuku do najbliższej geometrii', () => {
  const lineDocument = createDocument('Extend linii');
  const start = createSketchPoint({ x: 0, y: 0 });
  const end = createSketchPoint({ x: 10, y: 0 });
  const cutterStart = createSketchPoint({ x: 20, y: -5 });
  const cutterEnd = createSketchPoint({ x: 20, y: 5 });
  const line = createSketchLine({ startPointId: start.id, endPointId: end.id });
  const cutter = createSketchLine({ startPointId: cutterStart.id, endPointId: cutterEnd.id, role: 'construction' });
  const lineSketch = createSketch({ entities: [start, end, cutterStart, cutterEnd, line, cutter], constraints: [createSketchConstraint('horizontal', [line.id])] });
  lineDocument.sketches.push(lineSketch);
  const lineResult = extendSketchEntity(lineDocument, lineSketch.id, line.id, [9, 0]);
  const extendedEnd = lineSketch.entities.find((entity) => entity.id === lineResult.pointId);
  assert.equal(lineResult.extendedEndpoint, 'end');
  assert.ok(Math.abs(Number(extendedEnd.geometry.x) - 20) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(Number(extendedEnd.geometry.y)) <= GEOMETRY_POLICY.linearTolerance);
  assert.equal(lineSketch.entities.find((entity) => entity.id === line.id).id, line.id);
  assert.equal(lineSketch.constraints.length, 0);

  const arcDocument = createDocument('Extend łuku');
  const center = createSketchPoint({ x: 0, y: 0 });
  const arcStart = createSketchPoint({ x: 10, y: 0 });
  const arcEnd = createSketchPoint({ x: 0, y: 10 });
  const boundaryStart = createSketchPoint({ x: -10, y: -5 });
  const boundaryEnd = createSketchPoint({ x: -10, y: 5 });
  const arc = createSketchArc({ centerPointId: center.id, startPointId: arcStart.id, endPointId: arcEnd.id, direction: 'ccw' });
  const boundary = createSketchLine({ startPointId: boundaryStart.id, endPointId: boundaryEnd.id, role: 'construction' });
  const arcSketch = createSketch({ entities: [center, arcStart, arcEnd, boundaryStart, boundaryEnd, arc, boundary] });
  arcDocument.sketches.push(arcSketch);
  const arcResult = extendSketchEntity(arcDocument, arcSketch.id, arc.id, [0, 9]);
  const nextEnd = arcSketch.entities.find((entity) => entity.id === arcResult.pointId);
  assert.equal(arcResult.extendedEndpoint, 'end');
  assert.ok(Math.abs(Number(nextEnd.geometry.x) + 10) <= GEOMETRY_POLICY.linearTolerance);
  assert.ok(Math.abs(Number(nextEnd.geometry.y)) <= GEOMETRY_POLICY.linearTolerance);

  const isolated = createDocument('Extend bez celu');
  const isolatedStart = createSketchPoint({ x: 0, y: 0 });
  const isolatedEnd = createSketchPoint({ x: 5, y: 0 });
  const isolatedLine = createSketchLine({ startPointId: isolatedStart.id, endPointId: isolatedEnd.id });
  const isolatedSketch = createSketch({ entities: [isolatedStart, isolatedEnd, isolatedLine] });
  isolated.sketches.push(isolatedSketch);
  const before = structuredClone(isolated);
  assert.throws(() => extendSketchEntity(isolated, isolatedSketch.id, isolatedLine.id, [5, 0]), /Brak geometrii/);
  assert.deepEqual(isolated, before);
});

test('Offset tworzy równoległą linię i ciągły łańcuch z narożnikiem miter', () => {
  const document = createDocument('Offset łańcucha');
  const points = [[0, 0], [10, 0], [10, 10]].map(([x, y]) => createSketchPoint({ x, y }));
  const lines = [
    createSketchLine({ startPointId: points[0].id, endPointId: points[1].id }),
    createSketchLine({ startPointId: points[1].id, endPointId: points[2].id }),
  ];
  const sketch = createSketch({ entities: [...points, ...lines] });
  document.sketches.push(sketch);

  const result = offsetSketchEntities(document, sketch.id, lines.map((line) => line.id), '2');
  const createdLines = result.createdEntityIds.map((id) => sketch.entities.find((entity) => entity.id === id));
  const pointMap = new Map(sketch.entities.filter((entity) => entity.type === 'point').map((point) => [point.id, point]));
  const coordinates = createdLines.map((line) => line.pointIds.map((id) => {
    const point = pointMap.get(id);
    return [Number(Number(point.geometry.x).toFixed(8)), Number(Number(point.geometry.y).toFixed(8))];
  }));

  assert.equal(result.closed, false);
  assert.equal(createdLines.length, 2);
  assert.deepEqual(coordinates, [[[0, 2], [8, 2]], [[8, 2], [8, 10]]]);
  assert.equal(createdLines[0].pointIds[1], createdLines[1].pointIds[0]);
  assert.deepEqual(points.map((point) => [Number(point.geometry.x), Number(point.geometry.y)]), [[0, 0], [10, 0], [10, 10]]);
});

test('Offset profilu zachowuje źródło i wykrywa nową zamkniętą pętlę', () => {
  const document = createDocument('Offset profilu');
  const points = [[0, 0], [20, 0], [20, 10], [0, 10]].map(([x, y]) => createSketchPoint({ x, y }));
  const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
  const sketch = createSketch({ entities: [...points, ...lines] });
  refreshDetectedSketchProfiles(sketch);
  document.sketches.push(sketch);
  const profileId = sketch.profiles[0].id;

  const result = offsetSketchProfile(document, sketch.id, profileId, '2');
  const createdLines = result.createdEntityIds.map((id) => sketch.entities.find((entity) => entity.id === id));
  const pointMap = new Map(sketch.entities.filter((entity) => entity.type === 'point').map((point) => [point.id, point]));
  const createdCoordinates = new Set(createdLines.flatMap((line) => line.pointIds.map((id) => {
    const point = pointMap.get(id);
    return `${Number(point.geometry.x)},${Number(point.geometry.y)}`;
  })));

  assert.equal(result.closed, true);
  assert.equal(createdLines.length, 4);
  assert.deepEqual(createdCoordinates, new Set(['2,2', '18,2', '18,8', '2,8']));
  assert.ok(result.profileIds.length >= 1);
  assert.equal(lines.every((line) => sketch.entities.some((entity) => entity.id === line.id)), true);
  assert.equal(validateDocument(document).valid, true);
  const reopened = openDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(reopened.readOnly, false);
  assert.deepEqual(reopened.document.sketches[0].entities.map((entity) => entity.id), sketch.entities.map((entity) => entity.id));
  assert.deepEqual(reopened.document.sketches[0].profiles.map((profile) => profile.id), sketch.profiles.map((profile) => profile.id));
});

test('Offset okręgu i łuku zmienia promień parametrycznie, a błąd nie mutuje dokumentu', () => {
  const document = createDocument('Offset krzywych');
  document.parameters.push({ id: 'parameter-offset', name: 'luz', expression: '2', unit: 'mm', label: 'Luz' });
  const center = createSketchPoint({ x: 0, y: 0 });
  const circle = createSketchCircleEntity({ centerPointId: center.id, radius: 5 });
  const arcCenter = createSketchPoint({ x: 20, y: 0 });
  const arcStart = createSketchPoint({ x: 25, y: 0 });
  const arcEnd = createSketchPoint({ x: 20, y: 5 });
  const arc = createSketchArc({ centerPointId: arcCenter.id, startPointId: arcStart.id, endPointId: arcEnd.id, direction: 'ccw' });
  const sketch = createSketch({ entities: [center, circle, arcCenter, arcStart, arcEnd, arc] });
  document.sketches.push(sketch);

  const circleResult = offsetSketchEntities(document, sketch.id, [circle.id], 'luz');
  const offsetCircle = sketch.entities.find((entity) => entity.id === circleResult.createdEntityIds[0]);
  assert.equal(offsetCircle.geometry.radius, '7');
  const arcResult = offsetSketchEntities(document, sketch.id, [arc.id], '-luz');
  const offsetArc = sketch.entities.find((entity) => entity.id === arcResult.createdEntityIds[0]);
  const offsetArcPoints = offsetArc.pointIds.map((id) => sketch.entities.find((entity) => entity.id === id));
  assert.deepEqual(offsetArcPoints.map((point) => [Number(point.geometry.x), Number(point.geometry.y)]), [[20, 0], [23, 0], [20, 3]]);

  const before = structuredClone(document);
  assert.throws(() => offsetSketchEntities(document, sketch.id, [circle.id], '-5'), /niedodatni promień/);
  assert.deepEqual(document, before);
});

test('Sketch Fillet skraca dwie linie, tworzy styczny łuk i zachowuje profil z operacją', () => {
  const document = createDocument('Fillet szkicu');
  const points = [[0, 0], [20, 0], [20, 10], [0, 10]].map(([x, y]) => createSketchPoint({ x, y }));
  const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
  const constraint = createSketchConstraint('horizontal', [lines[0].id]);
  const dimension = createSketchDimension('aligned', [lines[0].id], { expression: '20', constraintId: constraint.id });
  const sketch = createSketch({ entities: [...points, ...lines], constraints: [constraint], dimensions: [dimension] });
  refreshDetectedSketchProfiles(sketch);
  const profileId = sketch.profiles[0].id;
  const feature = createFeature('extrude', { sketchId: sketch.id, profileIds: [profileId], distance: '5', operation: 'new' });
  document.sketches.push(sketch);
  document.features.push(feature);

  const result = filletSketchLines(document, sketch.id, [lines[0].id, lines[1].id], '2');
  const connector = sketch.entities.find((entity) => entity.id === result.connectorEntityId);
  const pointMap = new Map(sketch.entities.filter((entity) => entity.type === 'point').map((point) => [point.id, point]));

  assert.equal(connector.type, 'arc');
  assert.deepEqual(result.removedConstraintIds, [constraint.id]);
  assert.deepEqual(result.removedDimensionIds, [dimension.id]);
  assert.equal(sketch.entities.some((entity) => entity.id === points[1].id), false);
  const retainedLines = lines.slice(0, 2).map((line) => sketch.entities.find((entity) => entity.id === line.id));
  assert.deepEqual(retainedLines.map((line) => line.pointIds.map((id) => {
    const point = pointMap.get(id);
    return [Number(Number(point.geometry.x).toFixed(8)), Number(Number(point.geometry.y).toFixed(8))];
  })), [[[0, 0], [18, 0]], [[20, 2], [20, 10]]]);
  assert.equal(sketch.profiles.length, 1);
  assert.equal(sketch.profiles[0].id, profileId);
  assert.equal(sketch.profiles[0].entityIds.includes(connector.id), true);
  assert.equal(document.features[0].id, feature.id);
  assert.equal(document.features[0].profileIds[0], profileId);
  assert.equal(validateDocument(document).valid, true);
});

test('Sketch Chamfer tworzy fazę, obsługuje parametr i odrzuca za duży wymiar bez mutacji', () => {
  const document = createDocument('Chamfer szkicu');
  document.parameters.push({ id: 'parameter-faza', name: 'faza', expression: '3', unit: 'mm', label: 'Faza' });
  const points = [[0, 0], [20, 0], [20, 10]].map(([x, y]) => createSketchPoint({ x, y }));
  const lines = [
    createSketchLine({ startPointId: points[0].id, endPointId: points[1].id }),
    createSketchLine({ startPointId: points[1].id, endPointId: points[2].id }),
  ];
  const sketch = createSketch({ entities: [...points, ...lines] });
  document.sketches.push(sketch);

  const result = chamferSketchLines(document, sketch.id, lines.map((line) => line.id), 'faza');
  const connector = sketch.entities.find((entity) => entity.id === result.connectorEntityId);
  const pointMap = new Map(sketch.entities.filter((entity) => entity.type === 'point').map((point) => [point.id, point]));
  assert.equal(connector.type, 'line');
  assert.deepEqual(connector.pointIds.map((id) => {
    const point = pointMap.get(id);
    return [Number(point.geometry.x), Number(point.geometry.y)];
  }), [[17, 0], [20, 3]]);

  const before = structuredClone(document);
  assert.throws(() => chamferSketchLines(document, sketch.id, [lines[0].id, connector.id], '50'), /za duży/);
  assert.deepEqual(document, before);
});

test('Rotate zachowuje ID profilu, a Mirror odwraca kierunek łuku', () => {
  const document = createDocument('Rotate i Mirror');
  const points = [[0, 0], [10, 0], [10, 5], [0, 5]].map(([x, y]) => createSketchPoint({ x, y }));
  const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
  const horizontal = createSketchConstraint('horizontal', [lines[0].id]);
  const sketch = createSketch({ entities: [...points, ...lines], constraints: [horizontal] });
  refreshDetectedSketchProfiles(sketch);
  const profileId = sketch.profiles[0].id;
  document.sketches.push(sketch);

  const rotated = rotateSketchSelection(document, sketch.id, lines.map((line) => line.id), { centerX: 0, centerY: 0, angle: 90 });
  const rotatedPoints = points.map((source) => sketch.entities.find((entity) => entity.id === source.id));
  assert.deepEqual(rotatedPoints.map((point) => [Number(Number(point.geometry.x).toFixed(8)), Number(Number(point.geometry.y).toFixed(8))]), [[0, 0], [0, 10], [-5, 10], [-5, 0]]);
  assert.equal(sketch.profiles[0].id, profileId);
  assert.deepEqual(rotated.removedConstraintIds, [horizontal.id]);

  const center = createSketchPoint({ x: 20, y: 0 });
  const start = createSketchPoint({ x: 25, y: 0 });
  const end = createSketchPoint({ x: 20, y: 5 });
  const arc = createSketchArc({ centerPointId: center.id, startPointId: start.id, endPointId: end.id, direction: 'ccw' });
  sketch.entities.push(center, start, end, arc);
  mirrorSketchSelection(document, sketch.id, [arc.id], { originX: 20, originY: 0, angle: 90 });
  const mirroredArc = sketch.entities.find((entity) => entity.id === arc.id);
  const mirroredStart = sketch.entities.find((entity) => entity.id === start.id);
  assert.equal(mirroredArc.geometry.direction, 'cw');
  assert.deepEqual([Number(Number(mirroredStart.geometry.x).toFixed(8)), Number(Number(mirroredStart.geometry.y).toFixed(8))], [15, 0]);
});

test('Copy tworzy niezależny profil, a Scale zmienia okrąg i respektuje blokujący wymiar', () => {
  const document = createDocument('Copy i Scale');
  const points = [[0, 0], [10, 0], [10, 5], [0, 5]].map(([x, y]) => createSketchPoint({ x, y }));
  const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
  const sketch = createSketch({ entities: [...points, ...lines] });
  refreshDetectedSketchProfiles(sketch);
  document.sketches.push(sketch);

  const copied = copySketchSelection(document, sketch.id, lines.map((line) => line.id), { dx: 20, dy: 3 });
  assert.equal(copied.createdEntityIds.length, 4);
  assert.equal(copied.createdPointIds.length, 4);
  assert.equal(sketch.profiles.length, 2);
  assert.equal(copied.profileIds.length, 1);
  assert.equal(new Set([...points.map((point) => point.id), ...copied.createdPointIds]).size, 8);

  const center = createSketchPoint({ x: 50, y: 0 });
  const circle = createSketchCircleEntity({ centerPointId: center.id, radius: 4 });
  sketch.entities.push(center, circle);
  scaleSketchSelection(document, sketch.id, [circle.id], { centerX: 0, centerY: 0, factor: 2 });
  const scaledCenter = sketch.entities.find((entity) => entity.id === center.id);
  const scaledCircle = sketch.entities.find((entity) => entity.id === circle.id);
  assert.deepEqual([Number(scaledCenter.geometry.x), Number(scaledCenter.geometry.y), Number(scaledCircle.geometry.radius)], [100, 0, 8]);

  const radiusConstraint = createSketchConstraint('radius', [circle.id], { value: '8' });
  const radiusDimension = createSketchDimension('radius', [circle.id], { expression: '8', constraintId: radiusConstraint.id });
  sketch.constraints.push(radiusConstraint);
  sketch.dimensions.push(radiusDimension);
  const before = structuredClone(document);
  assert.throws(() => scaleSketchSelection(document, sketch.id, [circle.id], { centerX: 0, centerY: 0, factor: 1.5 }), /zablokowany przez wymiar/);
  assert.deepEqual(document, before);
});

test('kontrakt encji jest rozszerzalny bez zmiany formatu dokumentu', () => {
  const document = createDocument('Przyszłe encje');
  const futureTypes = ['ellipse', 'ellipticalArc', 'spline', 'conic', 'slot', 'polygon', 'text'];
  const entities = futureTypes.map((type) => createSketchEntity(type, {
    geometry: { contractVersion: 1, payload: `${type}-definition` },
  }));
  document.sketches.push(createSketch({ entities }));

  const validation = validateDocument(document);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.deepEqual(document.sketches[0].entities.map((entity) => entity.type), futureTypes);
});

test('edycja prymitywu zachowuje stabilne ID końców i oddzielny profil', () => {
  const document = createDocument('Stabilne końce');
  const original = createRectangleProfile({ width: '40', height: '30', x: '0', y: '0' });
  const sketch = createSketch({ profiles: [original] });
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', {
    sketchId: sketch.id,
    profileIds: [original.id],
    distance: '5',
    operation: 'new',
  }));
  const originalBoundaryIds = [...sketch.profiles[0].entityIds];
  const originalPointIds = sketch.entities.filter((entity) => entity.type === 'point').map((entity) => entity.id);

  const edited = createRectangleProfile({ width: '80', height: '25', x: '4', y: '2' });
  edited.id = original.id;
  upsertSketchProfile(sketch, edited);

  assert.deepEqual(sketch.profiles[0].entityIds, originalBoundaryIds);
  assert.deepEqual(sketch.entities.filter((entity) => entity.type === 'point').map((entity) => entity.id), originalPointIds);
  assert.equal(sketch.profiles[0].geometry.width, '80');
  assert.equal(validateDocument(document).valid, true);
  assert.equal(prepareDocument(document).features[0].profiles[0].geometry.width, 80);
  const graph = buildDependencyGraph(document).toJSON();
  assert.ok(graph.edges.some((edge) => edge.from === originalBoundaryIds[0] && edge.to === original.id && edge.kind === 'bounds'));
});

test('migracja v3 i round-trip v4 zachowują encje, profile, relacje i historię', () => {
  const current = createStarterDocument();
  const legacy = structuredClone(current);
  legacy.schemaVersion = 3;
  legacy.sketches.forEach((sketch) => {
    sketch.entities = [];
    sketch.profiles.forEach((profile) => {
      delete profile.entityIds;
      delete profile.closed;
      delete profile.source;
    });
  });
  delete legacy.metadata.migrationHistory;

  const migrated = openDocument(legacy, { now: '2026-08-04T18:00:00.000Z' });
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.sourceVersion, 3);
  assert.equal(migrated.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.equal(migrated.document.sketches[0].entities.length, 10);
  const firstLine = migrated.document.sketches[0].profiles[0].entityIds[0];
  migrated.document.sketches[0].constraints.push({ id: 'constraint-r1', type: 'horizontal', entityIds: [firstLine] });
  migrated.document.sketches[0].dimensions.push({ id: 'dimension-r1', type: 'length', entityIds: [firstLine], expression: 'szerokosc' });
  assert.equal(validateDocument(migrated.document).valid, true);

  const reopened = openDocument(JSON.parse(JSON.stringify(migrated.document)));
  assert.deepEqual(reopened.document.sketches, migrated.document.sketches);
  assert.deepEqual(reopened.document.features, migrated.document.features);
  assert.deepEqual(reopened.document.parameters, migrated.document.parameters);

  const broken = structuredClone(reopened.document);
  const referencedPointId = broken.sketches[0].entities.find((entity) => entity.type === 'line').pointIds[0];
  broken.sketches[0].entities = broken.sketches[0].entities.filter((entity) => entity.id !== referencedPointId);
  const brokenValidation = validateDocument(broken);
  assert.ok(brokenValidation.issues.some((issue) => issue.code === 'BROKEN_REFERENCE' && issue.path.includes('.pointIds[')));
});

test('zamknięta polilinia L tworzy profil i operację bez prostokąta', () => {
  const document = createDocument('Profil L');
  const coordinates = [[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]];
  const points = coordinates.map(([x, y]) => createSketchPoint({ x, y }));
  const lines = points.map((point, index) => createSketchLine({
    startPointId: point.id,
    endPointId: points[(index + 1) % points.length].id,
  }));
  const sketch = createSketch({ entities: [...points, ...lines] });
  const profile = createDetectedProfile(sketch, lines.map((line) => line.id), { name: 'Profil L' });
  sketch.profiles.push(profile);
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', {
    name: 'Wyciągnięcie L',
    sketchId: sketch.id,
    profileIds: [profile.id],
    distance: '8',
    operation: 'new',
  }));

  assert.equal(profile.type, 'closed');
  assert.equal(document.sketches[0].profiles.some((item) => item.type === 'rectangle'), false);
  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document);
  assert.equal(prepared.features[0].profiles[0].geometry.segments.length, 6);
  assert.deepEqual(prepared.features[0].profiles[0].geometry.points[3], [10, 10]);
});

test('kontynuacja łukiem zachowuje styczność do poprzedniego segmentu', () => {
  const continuation = createTangentArcContinuation({
    startPointId: 'point-start',
    endPointId: 'point-end',
    start: [10, 0],
    end: [20, 10],
    tangent: [1, 0],
  });
  assert.deepEqual(continuation.center, [10, 10]);
  assert.equal(continuation.arc.type, 'arc');
  assert.equal(continuation.arc.geometry.direction, 'ccw');
  assert.ok(Math.abs(continuation.endTangent[0]) < 1e-12);
  assert.ok(Math.abs(continuation.endTangent[1] - 1) < 1e-12);
  assert.throws(() => createTangentArcContinuation({
    startPointId: 'point-start',
    endPointId: 'point-end',
    start: [0, 0],
    end: [10, 0],
    tangent: [1, 0],
  }), /skończonego łuku/);
});

test('przesunięcie wierzchołka zachowuje ID i aktualizuje profil zależny', () => {
  const document = createDocument('Edycja L');
  const coordinates = [[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]];
  const points = coordinates.map(([x, y]) => createSketchPoint({ x, y }));
  const lines = points.map((point, index) => createSketchLine({
    startPointId: point.id,
    endPointId: points[(index + 1) % points.length].id,
  }));
  const sketch = createSketch({ entities: [...points, ...lines] });
  const profile = createDetectedProfile(sketch, lines.map((line) => line.id), { name: 'Profil L' });
  sketch.profiles.push(profile);
  const horizontal = createSketchConstraint('horizontal', [lines[2].id]);
  const dimension = createSketchDimension('aligned', [lines[2].id], { expression: '20', constraintId: horizontal.id });
  sketch.constraints.push(horizontal);
  sketch.dimensions.push(dimension);
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', {
    sketchId: sketch.id,
    profileIds: [profile.id],
    distance: '8',
    operation: 'new',
  }));

  const pointId = points[3].id;
  translateSketchSelection(sketch, [pointId], { dx: 5, dy: 0 }, document.parameters);

  assert.equal(sketch.entities.find((entity) => entity.id === pointId).geometry.x, '15');
  assert.equal(sketch.profiles[0].geometry.points[3].x, '15');
  assert.equal(sketch.constraints.length, 0);
  assert.equal(sketch.dimensions.length, 0);
  assert.equal(validateDocument(document).valid, true);
  assert.deepEqual(prepareDocument(document).features[0].profiles[0].geometry.points[3], [15, 10]);
});

test('usunięcie punktu usuwa zależny profil i operację bez zerwanych referencji', () => {
  const document = createDocument('Usuwanie zależności');
  const points = [[0, 0], [20, 0], [20, 20], [0, 20]].map(([x, y]) => createSketchPoint({ x, y }));
  const lines = points.map((point, index) => createSketchLine({
    startPointId: point.id,
    endPointId: points[(index + 1) % points.length].id,
  }));
  const sketch = createSketch({ entities: [...points, ...lines] });
  const profile = createDetectedProfile(sketch, lines.map((line) => line.id));
  sketch.profiles.push(profile);
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', {
    sketchId: sketch.id,
    profileIds: [profile.id],
    distance: '5',
    operation: 'new',
  }));

  const removed = deleteSketchSelection(document, sketch.id, [points[0].id]);

  assert.ok(removed.entityIds.includes(points[0].id));
  assert.equal(removed.profileIds.length, 1);
  assert.equal(removed.featureIds.length, 1);
  assert.equal(document.features.length, 0);
  assert.equal(sketch.profiles.length, 0);
  assert.equal(validateDocument(document).valid, true);
});

test('snap szkicu rozpoznaje punkty charakterystyczne, przecięcia, styczność i najbliższą geometrię', () => {
  const endpointStart = createSketchPoint({ x: 0, y: 0 });
  const endpointEnd = createSketchPoint({ x: 20, y: 0 });
  const crossingStart = createSketchPoint({ x: 10, y: -10 });
  const crossingEnd = createSketchPoint({ x: 10, y: 10 });
  const center = createSketchPoint({ x: 40, y: 0 });
  const sketch = createSketch({ entities: [
    endpointStart,
    endpointEnd,
    crossingStart,
    crossingEnd,
    center,
    createSketchLine({ startPointId: endpointStart.id, endPointId: endpointEnd.id }),
    createSketchLine({ startPointId: crossingStart.id, endPointId: crossingEnd.id }),
    createSketchCircleEntity({ centerPointId: center.id, radius: 5 }),
  ] });

  const types = new Set(collectSketchSnapCandidates(sketch, [9, 1], { anchor: [30, 0] }).map((entry) => entry.type));
  for (const type of ['endpoint', 'midpoint', 'center', 'quadrant', 'intersection', 'tangent', 'nearest', 'grid', 'horizontal', 'vertical', 'alignment']) {
    assert.ok(types.has(type), `Brak kandydata snap: ${type}`);
  }
  assert.equal(snapSketchPoint(sketch, [0.4, 0.2], { pixelsPerUnit: 10, thresholdPx: 12 }).type, 'endpoint');
  assert.equal(snapSketchPoint(sketch, [10.3, 0.2], { pixelsPerUnit: 10, thresholdPx: 12 }).type, 'intersection');
  assert.equal(snapSketchPoint(sketch, [40.4, 0.2], { pixelsPerUnit: 10, thresholdPx: 12 }).type, 'center');
  assert.equal(snapSketchPoint(sketch, [45.3, 0.2], { pixelsPerUnit: 10, thresholdPx: 12 }).type, 'quadrant');

  const isolatedLine = createSketch({ entities: [endpointStart, endpointEnd, createSketchLine({ startPointId: endpointStart.id, endPointId: endpointEnd.id })] });
  assert.equal(snapSketchPoint(isolatedLine, [10.2, 0.4], { pixelsPerUnit: 10, thresholdPx: 12 }).type, 'midpoint');
  const diagonalEnd = createSketchPoint({ x: 20, y: 20 });
  const diagonal = createSketch({ entities: [endpointStart, diagonalEnd, createSketchLine({ startPointId: endpointStart.id, endPointId: diagonalEnd.id })] });
  assert.equal(snapSketchPoint(diagonal, [6, 7], { pixelsPerUnit: 10, thresholdPx: 12 }).type, 'nearest');

  const tangentCenter = createSketchPoint({ x: 0, y: 0 });
  const tangentSketch = createSketch({ entities: [tangentCenter, createSketchCircleEntity({ centerPointId: tangentCenter.id, radius: 5 })] });
  assert.equal(snapSketchPoint(tangentSketch, [-2.45, 4.25], { anchor: [-10, 0], pixelsPerUnit: 10, thresholdPx: 12 }).type, 'tangent');
});

test('prowadnice obejmują poziom, pion, wyrównanie i przedłużenie, a Alt wyłącza snap', () => {
  const empty = createSketch();
  const horizontal = snapSketchPoint(empty, [6, 0.6], { anchor: [0, 0], pixelsPerUnit: 10, thresholdPx: 12 });
  assert.equal(horizontal.type, 'horizontal');
  assert.deepEqual(horizontal.point, [6, 0]);
  const vertical = snapSketchPoint(empty, [0.6, 6], { anchor: [0, 0], pixelsPerUnit: 10, thresholdPx: 12 });
  assert.equal(vertical.type, 'vertical');

  const alignmentPoint = createSketchPoint({ x: 4, y: 8 });
  const aligned = snapSketchPoint(createSketch({ entities: [alignmentPoint] }), [4.5, 2], { pixelsPerUnit: 10, thresholdPx: 12 });
  assert.equal(aligned.type, 'alignment');
  assert.deepEqual(aligned.point, [4, 2]);

  const start = createSketchPoint({ x: 0, y: 0 });
  const end = createSketchPoint({ x: 10, y: 0 });
  const extension = snapSketchPoint(createSketch({ entities: [start, end, createSketchLine({ startPointId: start.id, endPointId: end.id })] }), [12, 0.5], { pixelsPerUnit: 10, thresholdPx: 12 });
  assert.equal(extension.type, 'extension');
  assert.deepEqual(extension.point, [12, 0]);
  assert.equal(extension.guides[0].kind, 'extension');

  const disabled = snapSketchPoint(empty, [2.2, 3.2], { disabled: true, gridSize: 1, pixelsPerUnit: 10, thresholdPx: 12 });
  assert.equal(disabled.snapped, false);
  assert.deepEqual(disabled.point, [2.2, 3.2]);
});

test('próg snap pozostaje stały w pikselach CSS przy różnym zoomie i DPI', () => {
  const start = createSketchPoint({ x: 0, y: 0 });
  const end = createSketchPoint({ x: 20, y: 0 });
  const sketch = createSketch({ entities: [start, end, createSketchLine({ startPointId: start.id, endPointId: end.id })] });
  for (const { pixelsPerUnit, devicePixelRatio } of [
    { pixelsPerUnit: 2, devicePixelRatio: 1 },
    { pixelsPerUnit: 8, devicePixelRatio: 2 },
    { pixelsPerUnit: 20, devicePixelRatio: 3 },
  ]) {
    const tenCssPixels = 10 / pixelsPerUnit;
    const inside = snapSketchPoint(sketch, [tenCssPixels, 0], { pixelsPerUnit, devicePixelRatio, thresholdPx: 12 });
    const outside = snapSketchPoint(sketch, [13 / pixelsPerUnit, 0], { pixelsPerUnit, devicePixelRatio, thresholdPx: 12, gridSize: 0 });
    assert.equal(inside.type, 'endpoint');
    assert.notEqual(outside.type, 'endpoint');
  }
});

function sketchFromLoops(loops) {
  const entities = [];
  for (const coordinates of loops) {
    const points = coordinates.map(([x, y]) => createSketchPoint({ x, y }));
    const lines = points.map((point, index) => createSketchLine({
      startPointId: point.id,
      endPointId: points[(index + 1) % points.length].id,
    }));
    entities.push(...points, ...lines);
  }
  return createSketch({ entities });
}

test('graf topologii wykrywa dowolny profil L i sześciokąt', () => {
  const shapeL = sketchFromLoops([[[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]]]);
  const detectedL = detectSketchProfiles(shapeL);
  assert.equal(detectedL.diagnostics.length, 0);
  assert.equal(detectedL.profiles.length, 1);
  assert.equal(detectedL.profiles[0].entityIds.length, 6);
  assert.equal(detectedL.graph.vertices.every((vertex) => vertex.degree === 2), true);

  const hexagon = sketchFromLoops([[[0, 10], [8.66, 5], [8.66, -5], [0, -10], [-8.66, -5], [-8.66, 5]]]);
  const detectedHexagon = detectSketchProfiles(hexagon);
  assert.equal(detectedHexagon.diagnostics.length, 0);
  assert.equal(detectedHexagon.profiles.length, 1);
  assert.equal(detectedHexagon.profiles[0].entityIds.length, 6);
});

test('zagnieżdżone pętle tworzą otwór i osobną wyspę zgodnie z parzystością', () => {
  const sketch = sketchFromLoops([
    [[0, 0], [40, 0], [40, 40], [0, 40]],
    [[10, 10], [30, 10], [30, 30], [10, 30]],
    [[16, 16], [24, 16], [24, 24], [16, 24]],
  ]);
  const result = detectSketchProfiles(sketch);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.profiles.length, 2);
  const outer = result.profiles.find((profile) => profile.innerLoops.length === 1);
  const island = result.profiles.find((profile) => profile !== outer);
  assert.ok(outer);
  assert.equal(outer.entityIds.length, 4);
  assert.equal(outer.innerLoops[0].entityIds.length, 4);
  assert.equal(outer.geometry.holes.length, 1);
  assert.equal(island.innerLoops.length, 0);
  assert.deepEqual(result.graph.loops.map((loop) => loop.depth).sort(), [0, 1, 2]);
});

test('profil z otworem przechodzi walidację, zależności i przygotowanie kernela na XY, XZ i YZ', () => {
  for (const plane of ['XY', 'XZ', 'YZ']) {
    const sketch = sketchFromLoops([
      [[0, 0], [40, 0], [40, 30], [0, 30]],
      [[10, 8], [30, 8], [30, 22], [10, 22]],
    ]);
    sketch.plane = plane;
    const detected = detectSketchProfiles(sketch);
    sketch.profiles = detected.profiles;
    const document = createDocument(`Profil z otworem ${plane}`);
    document.sketches.push(sketch);
    document.features.push(createFeature('extrude', {
      sketchId: sketch.id,
      profileIds: [sketch.profiles[0].id],
      distance: '6',
      operation: 'new',
    }));

    assert.equal(validateDocument(document).valid, true, validateDocument(document).errors.join('\n'));
    const prepared = prepareDocument(document);
    assert.equal(prepared.features[0].profiles[0].plane, plane);
    assert.equal(prepared.features[0].profiles[0].geometry.segments.length, 4);
    assert.equal(prepared.features[0].profiles[0].geometry.holes.length, 1);
    assert.equal(prepared.features[0].profiles[0].geometry.holes[0].segments.length, 4);
    const graph = buildDependencyGraph(document).toJSON();
    assert.equal(graph.edges.filter((edge) => edge.kind === 'bounds-hole').length, 4);
    assert.deepEqual(openDocument(JSON.parse(JSON.stringify(document))).document.sketches[0].profiles, sketch.profiles);
  }
});

test('okrąg wewnętrzny jest poprawnym otworem dowolnego profilu', () => {
  const sketch = sketchFromLoops([[[0, 0], [40, 0], [40, 40], [0, 40]]]);
  const center = createSketchPoint({ x: 20, y: 20 });
  const circle = createSketchCircleEntity({ centerPointId: center.id, radius: 6 });
  sketch.entities.push(center, circle);
  const result = detectSketchProfiles(sketch);
  assert.equal(result.profiles.length, 1);
  assert.deepEqual(result.profiles[0].innerLoops[0].entityIds, [circle.id]);
  sketch.profiles = result.profiles;
  const document = createDocument('Otwór okrągły');
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: [result.profiles[0].id], distance: '5', operation: 'new' }));
  assert.equal(validateDocument(document).valid, true, validateDocument(document).errors.join('\n'));
  const hole = prepareDocument(document).features[0].profiles[0].geometry.holes[0].segments[0];
  assert.equal(hole.type, 'circle');
  assert.equal(hole.radius, 6);
});

test('diagnostyka odrzuca przerwę, samoprzecięcie, nakładanie i zerowy segment', () => {
  const gapPoints = [[0, 0], [20, 0], [20, 20], [0, 20]].map(([x, y]) => createSketchPoint({ x, y }));
  const gapSketch = createSketch({ entities: [
    ...gapPoints,
    createSketchLine({ startPointId: gapPoints[0].id, endPointId: gapPoints[1].id }),
    createSketchLine({ startPointId: gapPoints[1].id, endPointId: gapPoints[2].id }),
    createSketchLine({ startPointId: gapPoints[2].id, endPointId: gapPoints[3].id }),
  ] });
  const gap = detectSketchProfiles(gapSketch);
  assert.equal(gap.profiles.length, 0);
  assert.ok(gap.diagnostics.some((entry) => entry.code === 'GAP' && entry.point));

  const crossing = sketchFromLoops([[[0, 0], [20, 20], [0, 20], [20, 0]]]);
  const crossingResult = detectSketchProfiles(crossing);
  assert.equal(crossingResult.profiles.length, 0);
  assert.ok(crossingResult.diagnostics.some((entry) => entry.code === 'SELF_INTERSECTION'));

  const overlapStart = createSketchPoint({ x: 0, y: 0 });
  const overlapMiddle = createSketchPoint({ x: 10, y: 0 });
  const overlapEnd = createSketchPoint({ x: 20, y: 0 });
  const zero = createSketchPoint({ x: 30, y: 0 });
  const invalid = createSketch({ entities: [
    overlapStart,
    overlapMiddle,
    overlapEnd,
    zero,
    createSketchLine({ startPointId: overlapStart.id, endPointId: overlapEnd.id }),
    createSketchLine({ startPointId: overlapMiddle.id, endPointId: overlapEnd.id }),
    createSketchLine({ startPointId: zero.id, endPointId: zero.id }),
  ] });
  const invalidResult = detectSketchProfiles(invalid);
  assert.ok(invalidResult.diagnostics.some((entry) => entry.code === 'OVERLAP'));
  assert.ok(invalidResult.diagnostics.some((entry) => entry.code === 'ZERO_LENGTH'));
});

test('konstruktory łuków, prostokątów i okręgów zachowują dokładną geometrię', () => {
  const arc3 = arcThroughThreePoints([10, 0], [0, 10], [-10, 0]);
  assert.equal(arc3.curves[0].type, 'arc');
  assert.equal(Number(arc3.points[0].geometry.x).toFixed(6), '0.000000');
  assert.equal(Number(arc3.points[0].geometry.y).toFixed(6), '0.000000');
  assert.throws(() => arcThroughThreePoints([0, 0], [5, 0], [10, 0]), /współliniowe/);
  assert.equal(arcCenterStartEnd([0, 0], [5, 0], [0, 5]).curves[0].geometry.direction, 'ccw');

  for (const rectangle of [
    rectangleTwoPoints([0, 0], [20, 10]),
    rectangleFromCenter([0, 0], 20, 10, 30),
    rectangleThreePoints([0, 0], [20, 0], [0, 10]),
  ]) {
    assert.equal(rectangle.curves.length, 4);
    assert.equal(detectSketchProfiles(createSketch({ entities: rectangle.entities })).profiles.length, 1);
  }
  assert.equal(Number(circleTwoPoints([-5, 0], [5, 0]).curves[0].geometry.radius), 5);
  assert.equal(Number(circleThreePoints([5, 0], [0, 5], [-5, 0]).curves[0].geometry.radius), 5);
});

test('wielokąty, elipsa i sloty mają rozszerzalny kontrakt encji', () => {
  const hexagon = regularPolygon({ center: [0, 0], radius: 10, sides: 6 });
  const edgeHexagon = polygonFromEdge([0, 0], [10, 0], 6);
  assert.equal(hexagon.curves.length, 6);
  assert.equal(edgeHexagon.curves.length, 6);
  assert.equal(detectSketchProfiles(createSketch({ entities: hexagon.entities })).profiles.length, 1);

  const ellipse = ellipseFromCenter([2, 3], 12, 5, 25);
  assert.equal(ellipse.curves[0].type, 'ellipse');
  assert.deepEqual(ellipse.curves[0].expressionKeys, ['majorRadius', 'minorRadius', 'rotation']);
  const ellipseSketch = createSketch({ entities: ellipse.entities });
  const ellipseDetection = detectSketchProfiles(ellipseSketch);
  assert.equal(ellipseDetection.profiles.length, 1);
  ellipseSketch.profiles = ellipseDetection.profiles;
  const ellipseDocument = createDocument('Elipsa');
  ellipseDocument.sketches.push(ellipseSketch);
  ellipseDocument.features.push(createFeature('extrude', { sketchId: ellipseSketch.id, profileIds: [ellipseSketch.profiles[0].id], distance: '4', operation: 'new' }));
  const ellipseSegment = prepareDocument(ellipseDocument).features[0].profiles[0].geometry.segments[0];
  assert.equal(ellipseSegment.type, 'ellipse');
  assert.equal(ellipseSegment.majorRadius, 12);

  const ellipticalArc = ellipticalArcFromCenter([0, 0], 10, 5, 0, 180, 20, 'ccw');
  const closingLine = createSketchLine({ startPointId: ellipticalArc.points[2].id, endPointId: ellipticalArc.points[1].id });
  const ellipticalArcSketch = createSketch({ entities: [...ellipticalArc.entities, closingLine] });
  const ellipticalArcDetection = detectSketchProfiles(ellipticalArcSketch);
  assert.equal(ellipticalArc.curves[0].type, 'ellipticalArc');
  assert.equal(ellipticalArcDetection.diagnostics.length, 0);
  assert.equal(ellipticalArcDetection.profiles.length, 1);
  ellipticalArcSketch.profiles = ellipticalArcDetection.profiles;
  const ellipticalArcDocument = createDocument('Łuk eliptyczny');
  ellipticalArcDocument.sketches.push(ellipticalArcSketch);
  ellipticalArcDocument.features.push(createFeature('extrude', { sketchId: ellipticalArcSketch.id, profileIds: [ellipticalArcSketch.profiles[0].id], distance: '2', operation: 'new' }));
  assert.ok(prepareDocument(ellipticalArcDocument).features[0].profiles[0].geometry.segments.some((segment) => segment.type === 'ellipticalArc'));

  for (const slot of [slotCenterToCenter([0, 0], [30, 0], 10), slotOverall([0, 0], [40, 0], 10), slotThreePoints([0, 0], [30, 0], [0, 5]), slotArc({ center: [0, 0], radius: 30, width: 8, startAngle: 10, endAngle: 120 })]) {
    assert.equal(slot.curves.length, 4);
    assert.ok(slot.curves.every((curve) => ['line', 'arc'].includes(curve.type)));
    const detected = detectSketchProfiles(createSketch({ entities: slot.entities }));
    assert.equal(detected.diagnostics.length, 0);
    assert.equal(detected.profiles.length, 1);
  }
});

test('wspornik łączy proste boki, łuk, slot i dwa otwory w jeden profil mechaniczny', () => {
  const lowerLeft = createSketchPoint({ x: -40, y: -25 });
  const lowerArc = createSketchPoint({ x: 20, y: -25 });
  const arcCenter = createSketchPoint({ x: 20, y: 0 });
  const upperArc = createSketchPoint({ x: 20, y: 25 });
  const upperLeft = createSketchPoint({ x: -40, y: 25 });
  const outline = [
    createSketchLine({ startPointId: lowerLeft.id, endPointId: lowerArc.id }),
    createSketchArc({ centerPointId: arcCenter.id, startPointId: lowerArc.id, endPointId: upperArc.id, direction: 'ccw' }),
    createSketchLine({ startPointId: upperArc.id, endPointId: upperLeft.id }),
    createSketchLine({ startPointId: upperLeft.id, endPointId: lowerLeft.id }),
  ];
  const slot = slotCenterToCenter([-12, 0], [8, 0], 8);
  const firstHole = circleCenterRadius([-25, -12], 4);
  const secondHole = circleCenterRadius([-25, 12], 4);
  const sketch = createSketch({ entities: [lowerLeft, lowerArc, arcCenter, upperArc, upperLeft, ...outline, ...slot.entities, ...firstHole.entities, ...secondHole.entities] });
  const detection = detectSketchProfiles(sketch);
  assert.equal(detection.diagnostics.length, 0);
  assert.equal(detection.profiles.length, 1);
  assert.equal(detection.profiles[0].innerLoops.length, 3);
  sketch.profiles = detection.profiles;
  const document = createDocument('Wspornik mechaniczny');
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '6', operation: 'new' }));
  const prepared = prepareDocument(document);
  assert.ok(prepared.features[0].profiles[0].geometry.segments.some((segment) => segment.type === 'arc'));
  assert.equal(prepared.features[0].profiles[0].geometry.holes.length, 3);
});

test('spline przez punkty dopasowania i kontrolne tworzy edytowalny profil B-Rep', () => {
  for (const spline of [fitPointSpline([[0, 0], [8, 12], [16, 8], [24, 0]]), controlPointSpline([[0, 0], [6, 14], [18, 14], [24, 0]])]) {
    const closingLine = createSketchLine({ startPointId: spline.points.at(-1).id, endPointId: spline.points[0].id });
    const sketch = createSketch({ entities: [...spline.entities, closingLine] });
    const detection = detectSketchProfiles(sketch);
    assert.equal(detection.diagnostics.length, 0);
    assert.equal(detection.profiles.length, 1);
    sketch.profiles = detection.profiles;
    const document = createDocument(`Spline ${spline.curves[0].geometry.mode}`);
    document.sketches.push(sketch);
    document.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '3', operation: 'new' }));
    const prepared = prepareDocument(document);
    const segment = prepared.features[0].profiles[0].geometry.segments.find((entry) => entry.type === 'spline');
    assert.ok(segment);
    assert.ok(segment.beziers.length >= 1);
    const controlPoint = spline.points[1];
    const previousX = Number(controlPoint.geometry.x);
    translateSketchSelection(sketch, [controlPoint.id], { dx: 2, dy: -1 });
    assert.equal(Number(sketch.entities.find((entity) => entity.id === controlPoint.id).geometry.x), previousX + 2);
  }
});

test('conic zachowuje rho, ciągłość i dokładną krzywą racjonalną w profilu', () => {
  const conic = conicThroughControlPoint([-12, 0], [0, 14], [12, 0], Math.SQRT1_2, 'tangent');
  const closingLine = createSketchLine({ startPointId: conic.points[2].id, endPointId: conic.points[0].id });
  const sketch = createSketch({ entities: [...conic.entities, closingLine] });
  const detection = detectSketchProfiles(sketch);
  assert.equal(detection.diagnostics.length, 0);
  assert.equal(detection.profiles.length, 1);
  assert.equal(conic.curves[0].geometry.continuity, 'tangent');
  assert.equal(Number(conic.curves[0].geometry.rho), Math.SQRT1_2);
  sketch.profiles = detection.profiles;
  const document = createDocument('Conic racjonalny');
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '3', operation: 'new' }));
  const segment = prepareDocument(document).features[0].profiles[0].geometry.segments.find((entry) => entry.type === 'conic');
  assert.ok(segment);
  assert.equal(segment.rho, Math.SQRT1_2);
  assert.equal(segment.continuity, 'tangent');
  assert.deepEqual(segment.control, [0, 14]);
  assert.throws(() => conicThroughControlPoint([0, 0], [1, 1], [2, 0], 0), /rho/);
});

test('diagnostyka krzywych raportuje zakres krzywizny i samoprzecięcie jednej spline', () => {
  const conic = conicThroughControlPoint([-12, 0], [0, 14], [12, 0], 0.8, 'curvature');
  const conicResult = detectSketchProfiles(createSketch({ entities: conic.entities }));
  const conicAnalysis = conicResult.graph.curveAnalyses.find((entry) => entry.entityId === conic.curves[0].id);
  assert.ok(conicAnalysis.curvature.maxAbsolute > 0);
  assert.equal(conicAnalysis.singular, false);
  assert.deepEqual(conicAnalysis.selfIntersections, []);

  const loopingSpline = controlPointSpline([[0, 0], [20, 20], [-20, 20], [5, 0]]);
  const loopResult = detectSketchProfiles(createSketch({ entities: loopingSpline.entities }));
  assert.ok(loopResult.diagnostics.some((entry) => entry.code === 'SELF_INTERSECTION' && entry.entityIds.includes(loopingSpline.curves[0].id)));
  assert.ok(loopResult.graph.curveAnalyses[0].selfIntersections.length > 0);
});

test('punkt szkicu jest trwałą referencją osi otworu i elementem grafu zależności', () => {
  const document = createDocument('Otwór z punktu');
  const baseProfile = createRectangleProfile({ width: 40, height: 30, x: 0, y: 0 });
  const baseSketch = createSketch({ name: 'Baza', profiles: [baseProfile] });
  const referencePoint = createSketchPoint({ x: 7, y: -4 });
  const pointSketch = createSketch({ name: 'Pozycja otworu', entities: [referencePoint] });
  document.sketches.push(baseSketch, pointSketch);
  const extrusion = createFeature('extrude', { sketchId: baseSketch.id, profileIds: [baseSketch.profiles[0].id], distance: '10', operation: 'new' });
  const hole = createFeature('hole', { targetBodyId: `body-${extrusion.id}`, sketchId: pointSketch.id, pointId: referencePoint.id, diameter: '6', depth: '10' });
  document.features.push(extrusion, hole);
  assert.equal(validateDocument(document).valid, true);
  const preparedHole = prepareDocument(document).features[1];
  assert.deepEqual(preparedHole.profile.geometry, { x: 7, y: -4 });
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === referencePoint.id && edge.to === hole.id));
});

test('zapis atomowy zachowuje poprzednią poprawną wersję jako .bak', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'madcad-atomic-'));
  const targetPath = join(directory, 'projekt.madcad');
  try {
    await writeFile(targetPath, 'wersja-poprzednia', 'utf8');
    const result = await atomicWriteTextFile(targetPath, 'wersja-nowa', { backup: true });

    assert.equal(await readFile(targetPath, 'utf8'), 'wersja-nowa');
    assert.equal(await readFile(`${targetPath}.bak`, 'utf8'), 'wersja-poprzednia');
    assert.equal(result.filePath, targetPath);
    assert.equal(result.backupPath, `${targetPath}.bak`);

    await atomicWriteTextFile(targetPath, 'wersja-najnowsza', { backup: true });
    assert.equal(await readFile(targetPath, 'utf8'), 'wersja-najnowsza');
    assert.equal(await readFile(`${targetPath}.bak`, 'utf8'), 'wersja-nowa');
    assert.equal((await readdir(directory)).some((name) => name.endsWith('.tmp')), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
