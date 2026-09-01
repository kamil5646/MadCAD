import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { strToU8, zipSync } from 'three/examples/jsm/libs/fflate.module.js';
import atomicFile from '../electron/atomic-file.cjs';
import slicerLaunch from '../electron/slicer-launch.cjs';
import securityPolicy from '../electron/security-policy.cjs';
import ipcPolicy from '../electron/ipc-policy.cjs';
import recoveryFile from '../electron/recovery-file.cjs';
import projectSnapshotStore from '../electron/project-snapshots.cjs';
import packAndGo from '../electron/pack-and-go.cjs';
import windowBounds from '../electron/window-bounds.cjs';
import updatePolicy from '../electron/update-policy.cjs';
import dwgConverter from '../electron/dwg-converter.cjs';
import * as fsPromises from 'node:fs/promises';
import {
  DOCUMENT_SCHEMA_VERSION,
  createDocument,
  createFeature,
  createParameter,
  createCircleProfile,
  createRectangleProfile,
  createSketch,
  createStarterDocument,
  openDocument,
  validateDocument,
} from '../src/cad-core/document.js';
import { buildDependencyGraph } from '../src/cad-core/dependency-graph.js';
import {
  assignBodiesToComponent,
  componentBomEntries,
  componentDescendantIds,
  componentParentMap,
  componentTree,
  componentInstanceTree,
  createComponentInstance,
  createComponent,
  createRigidGroup,
  deleteComponent,
  deleteComponentInstance,
  deleteRigidGroup,
  duplicateComponentInstance,
  moveComponent,
  updateComponent,
  updateComponentInstance,
} from '../src/cad-core/components.js';
import { createAssemblyJoint, createMotionLink, deleteAssemblyJoint, deleteMotionLink, setJointValue, updateAssemblyJoint, updateMotionLink } from '../src/cad-core/assembly-joints.js';
import { createLinkedProject, linkedProjectState } from '../src/cad-core/linked-projects.js';
import { compareProjectDocuments } from '../src/cad-core/project-diff.js';
import { createProjectHealthReport, formatProjectBytes } from '../src/cad-core/project-health.js';
import { dependencyNodeIdForSelection, inspectProjectDependencies } from '../src/cad-core/project-dependencies.js';
import { buildProjectSearchIndex, normalizeProjectSearchText, searchProject, searchProjectIndex } from '../src/cad-core/project-search.js';
import { createNamedView, deleteNamedView, renameNamedView } from '../src/cad-core/named-views.js';
import { applyAssemblyConfiguration, createAssemblyConfiguration, createContactSet, deleteAssemblyConfiguration, deleteContactSet, detectAssemblyCollisions, updateAssemblyConfiguration, updateContactSet } from '../src/cad-core/assembly-motion.js';
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
  pruneDanglingSketchRelations,
  translateSketchSelection,
  upsertSketchProfile,
} from '../src/cad-core/sketch-model.js';
import { analyzeSketchConstraints, applySketchConstraintSolution, solveSketchConstraints, SKETCH_SOLVER_STATUS } from '../src/cad-core/sketch-solver.js';
import { collectSketchSnapCandidates, composeSketchSnapContext, snapSketchPoint } from '../src/cad-core/sketch-snap.js';
import { breakSketchEntity, chamferSketchLines, extendSketchEntity, filletSketchLines, offsetSketchEntities, offsetSketchProfile, trimSketchEntity } from '../src/cad-core/sketch-modifiers.js';
import { copySketchSelection, mirrorSketchSelection, rotateSketchSelection, scaleSketchSelection } from '../src/cad-core/sketch-transforms.js';
import { circularSketchPattern, parseSkippedPatternOccurrences, pathSketchPattern, rectangularSketchPattern } from '../src/cad-core/sketch-patterns.js';
import { edgeGroupVertices, topologyIdForFaceIndex, topologySelectionFromIntersection } from '../src/cad-core/brep-picking.js';
import { createTopologyReference, inspectTopologyReferences, reassignTopologyReference } from '../src/cad-core/topology-references.js';
import { createAnglePlane, createMidplane, createOffsetPlane, createPathPlane, createTangentPlane, createThreePointPlane, resolveConstructionPlane, resolveConstructionPlanes } from '../src/cad-core/construction-planes.js';
import { createCylinderAxis, createEdgeAxis, createPlaneIntersectionAxis, createPlaneNormalAxis, createTwoPointAxis, resolveConstructionAxis, resolveConstructionAxes } from '../src/cad-core/construction-axes.js';
import { createCenterPoint, createIntersectionPoint, createMidpointPoint, createPointOnAxis, createVertexPoint, resolveConstructionPoint, resolveConstructionPoints } from '../src/cad-core/construction-points.js';
import { projectTopologyToSketch, synchronizeProjectedGeometry } from '../src/cad-core/sketch-projection.js';
import { detectSketchProfiles, refreshDetectedSketchProfiles } from '../src/cad-core/sketch-topology.js';
import { createTextProfile } from '../src/cad-core/text-profile.js';
import { resolveFaceEdgeHolePlacement } from '../src/cad-core/face-edge-hole.js';
import { applyHoleStandard } from '../src/cad-core/hole-standards.js';
import { measureSelection } from '../src/cad-core/measure-selection.js';
import { calculateMassProperties } from '../src/cad-core/mass-properties.js';
import { DRAFT_DIRECTIONS, analyzeDraftAngles, analyzeWallThickness, boundsOverlap, summarizeGeometryInspection } from '../src/cad-core/geometry-inspection.js';
import { applyPrinterProfile, PRINTER_PROFILES } from '../src/cad-core/printer-profiles.js';
import { calculatePrintLayout, normalizePrintLayout, orientationForBedFace, transformPrintPoint } from '../src/cad-core/print-layout.js';
import { createThreeMfArchive, inspectThreeMfArchive } from '../src/cad-core/three-mf.js';
import { formatModelFileSize, inspectModelImportBuffer, normalizeModelUnit, parseStlMesh } from '../src/cad-core/model-import.js';
import { analyzePrintability } from '../src/cad-core/print-analysis.js';
import { inspectSketchImport, parseSketchImport } from '../src/cad-core/sketch-import.js';
import {
  createBalloonDrawingAnnotation,
  createBaseDrawingView,
  createCenterMarkDrawingAnnotation,
  createCenterlineDrawingAnnotation,
  createDetailDrawingView,
  createDrawingRevision,
  createDrawingSheet,
  createDrawingTable,
  createFeatureControlFrameDrawingAnnotation,
  createHoleNoteDrawingAnnotation,
  createLinearDrawingDimension,
  createProjectedDrawingView,
  createSectionDrawingView,
  createSketchDrawingView,
  drawingBomItemNumber,
  drawingSheetHtml,
  drawingSheetDxf,
  drawingSheetScene,
  projectDrawingView,
  recommendedDrawingScale,
  recommendedSketchDrawingScale,
} from '../src/cad-core/drawing-sheets.js';
import {
  BY_LAYER,
  DEFAULT_LAYER_ID,
  assignEntitiesToLayer,
  createLayer,
  deleteLayer,
  ensureDocumentLayers,
  resolveEntityAppearance,
} from '../src/cad-core/layers.js';
import {
  addBlockAttributeDefinition,
  createBlockDefinition,
  deleteBlockDefinition,
  deleteBlockInstance,
  explodeBlockInstance,
  insertBlockInstance,
  updateBlockInstanceAttributes,
} from '../src/cad-core/blocks.js';
import { calculateExplodedOffsets } from '../src/cad-core/exploded-view.js';
import { resolveModelingLanguage, translateModelingText } from '../src/modeling/i18n.js';
import { tutorialForLanguage } from '../src/modeling/tutorial-content.js';
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

test('widok rozstrzelony wyznacza deterministyczne przesunięcia bez zmiany położeń złożenia', () => {
  const occurrences = [{ id: 'left', position: [-10, 0, 0] }, { id: 'right', position: [10, 0, 0] }];
  assert.deepEqual(calculateExplodedOffsets(occurrences, 0.5, 40), { left: [-20, 0, 0], right: [20, 0, 0] });
  assert.deepEqual(occurrences[0].position, [-10, 0, 0]);
  const coincident = calculateExplodedOffsets([{ id: 'a' }, { id: 'b' }], 1, 25);
  assert.ok(Math.abs(Math.hypot(...coincident.a) - 25) < 1e-9);
  assert.notDeepEqual(coincident.a, coincident.b);
  assert.deepEqual(calculateExplodedOffsets([{ id: 'a' }], 0, 25), { a: [0, 0, 0] });
});

test('komponenty budują bezpieczną hierarchię części i złożeń z własnością brył', () => {
  const document = createDocument('Złożenie');
  const firstFeature = createFeature('primitive', { primitiveType: 'box' });
  const secondFeature = createFeature('primitive', { primitiveType: 'cylinder' });
  document.features.push(firstFeature, secondFeature);
  const firstBodyId = `body-${firstFeature.id}`;
  const secondBodyId = `body-${secondFeature.id}`;
  const frame = createComponent(document, { name: 'Rama', partNumber: 'MC-RAMA', material: 'S235', bodyIds: [firstBodyId] });
  const pin = createComponent(document, { name: 'Sworzeń', partNumber: 'MC-SWORZEN', quantity: 2, bodyIds: [secondBodyId], origin: { x: 10, y: 0, z: 4 } });
  const assembly = createComponent(document, { name: 'Wspornik', type: 'assembly', partNumber: 'MC-ZL-001' });
  moveComponent(document, frame.id, assembly.id);
  moveComponent(document, pin.id, assembly.id);

  assert.equal(componentParentMap(document.components).get(frame.id), assembly.id);
  assert.deepEqual(componentDescendantIds(document.components, assembly.id), new Set([frame.id, pin.id]));
  assert.deepEqual(componentTree(document.components).map((item) => item.id), [assembly.id]);
  assert.deepEqual(componentBomEntries(document.components).map((item) => [item.partNumber, item.effectiveQuantity]), [['MC-RAMA', 1], ['MC-SWORZEN', 2]]);
  assert.equal(validateDocument(document).valid, true);

  assignBodiesToComponent(document, frame.id, [firstBodyId, secondBodyId]);
  assert.deepEqual(document.components.find((item) => item.id === frame.id).bodyIds, [firstBodyId, secondBodyId]);
  assert.deepEqual(document.components.find((item) => item.id === pin.id).bodyIds, []);
  const updatedFrame = updateComponent(document, frame.id, { material: 'S355', quantity: 3, origin: { x: 1, y: 2, z: 3 } });
  assert.equal(updatedFrame.material, 'S355');
  assert.deepEqual(updatedFrame.origin, { x: 1, y: 2, z: 3 });
  assert.equal(validateDocument(document).valid, true);
});

test('komponenty blokują cykle, promują dzieci przy usunięciu i obsługują cascade', () => {
  const document = createDocument('Usuwanie złożenia');
  const root = createComponent(document, { name: 'Główne', type: 'assembly', partNumber: 'A-001' });
  const nested = createComponent(document, { name: 'Podzłożenie', type: 'assembly', partNumber: 'A-002', parentId: root.id });
  const part = createComponent(document, { name: 'Część', partNumber: 'P-001', parentId: nested.id });
  assert.throws(() => moveComponent(document, root.id, part.id), /podkomponentu/);
  const rootOccurrenceId = document.componentInstances.find((instance) => instance.componentId === root.id).id;
  assert.deepEqual(deleteComponent(document, nested.id), [nested.id]);
  assert.deepEqual(document.components.find((item) => item.id === root.id).componentIds, [part.id]);
  assert.equal(document.componentInstances.find((instance) => instance.componentId === part.id).parentInstanceId, rootOccurrenceId);
  assert.deepEqual(deleteComponent(document, root.id, { cascade: true }).sort(), [part.id, root.id].sort());
  assert.deepEqual(document.components, []);
});

test('migracja v9 uzupełnia komponent i główne wystąpienie w bieżącym schemacie', () => {
  const legacy = createDocument('Migracja komponentów');
  legacy.schemaVersion = 9;
  legacy.components.push({ id: 'legacy-component', name: 'Korpus', partNumber: 'K-1', material: 'Aluminium', quantity: 2, bodyIds: [] });
  const opened = openDocument(legacy, { now: '2026-08-24T12:00:00.000Z' });
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(opened.document.components[0], {
    id: 'legacy-component', name: 'Korpus', type: 'part', partNumber: 'K-1', description: '', material: 'Aluminium', quantity: 2,
    appearance: { preset: 'cad', color: '#5aaed0', metalness: 0.08, roughness: 0.56 },
    origin: { x: 0, y: 0, z: 0 }, bodyIds: [], sketchIds: [], componentIds: [], linkedProjectId: '',
  });
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 9 && entry.to === 10));
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 10 && entry.to === 11));
  assert.equal(opened.document.componentInstances.length, 1);
  assert.equal(opened.document.componentInstances[0].componentId, 'legacy-component');
  assert.equal(opened.document.componentInstances[0].primary, true);
});

test('wystąpienia komponentów mają niezależne transformacje, Ground i bezpieczne drzewo', () => {
  const document = createDocument('Wystąpienia');
  const assembly = createComponent(document, { name: 'Rama', type: 'assembly', partNumber: 'A-100' });
  const part = createComponent(document, { name: 'Śruba', partNumber: 'P-100', parentId: assembly.id });
  const assemblyOccurrence = document.componentInstances.find((instance) => instance.componentId === assembly.id);
  const first = document.componentInstances.find((instance) => instance.componentId === part.id);
  const second = createComponentInstance(document, { componentId: part.id, parentInstanceId: assemblyOccurrence.id, transform: { x: 30, y: 4, z: 2, rotationZ: 90 } });
  assert.equal(componentInstanceTree(document)[0].children.length, 2);
  assert.deepEqual(componentBomEntries(document.components, document.componentInstances).map((item) => [item.partNumber, item.effectiveQuantity]), [['P-100', 2]]);
  assert.equal(second.transform.x, 30);
  assert.throws(() => updateComponentInstance(document, first.id, { parentInstanceId: first.id }), /własnym rodzicem/);
  updateComponentInstance(document, second.id, { grounded: true });
  assert.throws(() => updateComponentInstance(document, second.id, { transform: { x: 40 } }), /Uziemionego/);
  assert.equal(validateDocument(document).valid, true);
});

test('Rigid Group przesuwa członków razem, blokuje ruch przez Ground i daje się rozwiązać', () => {
  const document = createDocument('Grupa sztywna');
  const assembly = createComponent(document, { name: 'Zespół', type: 'assembly', partNumber: 'A-200' });
  const part = createComponent(document, { name: 'Kołek', partNumber: 'P-200', parentId: assembly.id });
  const parent = document.componentInstances.find((instance) => instance.componentId === assembly.id);
  const first = document.componentInstances.find((instance) => instance.componentId === part.id);
  const second = duplicateComponentInstance(document, first.id, { parentInstanceId: parent.id, transform: { x: 20 } });
  const group = createRigidGroup(document, [first.id, second.id], 'Para kołków');
  assert.throws(() => updateComponentInstance(document, first.id, { parentInstanceId: '' }), /rozwiąż grupę sztywną/);
  updateComponentInstance(document, first.id, { transform: { x: 5, rotationZ: 15 } });
  assert.equal(document.componentInstances.find((instance) => instance.id === first.id).transform.x, 5);
  assert.equal(document.componentInstances.find((instance) => instance.id === second.id).transform.x, 25);
  assert.equal(document.componentInstances.find((instance) => instance.id === second.id).transform.rotationZ, 15);
  updateComponentInstance(document, second.id, { grounded: true });
  assert.throws(() => updateComponentInstance(document, first.id, { transform: { y: 10 } }), /grupy sztywnej/);
  assert.equal(deleteRigidGroup(document, group.id).id, group.id);
  updateComponentInstance(document, first.id, { transform: { y: 10 } });
  assert.equal(document.componentInstances.find((instance) => instance.id === first.id).transform.y, 10);
  assert.equal(validateDocument(document).valid, true);
});

test('migracja v10 tworzy wystąpienia zgodne z hierarchią definicji', () => {
  const legacy = createDocument('Migracja wystąpień');
  legacy.schemaVersion = 10;
  delete legacy.componentInstances;
  delete legacy.rigidGroups;
  legacy.components = [
    { id: 'assembly-v10', name: 'Zespół', type: 'assembly', partNumber: 'A-10', description: '', material: '', quantity: 1, origin: { x: 0, y: 0, z: 0 }, bodyIds: [], sketchIds: [], componentIds: ['part-v10'] },
    { id: 'part-v10', name: 'Detal', type: 'part', partNumber: 'P-10', description: '', material: '', quantity: 1, origin: { x: 0, y: 0, z: 0 }, bodyIds: [], sketchIds: [], componentIds: [] },
  ];
  const opened = openDocument(legacy, { now: '2026-08-24T13:00:00.000Z' });
  const tree = componentInstanceTree(opened.document);
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].componentId, 'assembly-v10');
  assert.equal(tree[0].children[0].componentId, 'part-v10');
  assert.equal(validateDocument(opened.document).valid, true);
});

test('joint revolute i slider steruje transformacją względem trwałej osi oraz respektuje limity', () => {
  const document = createDocument('Kinematyka');
  const assembly = createComponent(document, { name: 'Mechanizm', type: 'assembly', partNumber: 'A-J1' });
  const base = createComponent(document, { name: 'Podstawa jointa', partNumber: 'P-J1', parentId: assembly.id });
  const arm = createComponent(document, { name: 'Ramię jointa', partNumber: 'P-J2', parentId: assembly.id });
  const baseOccurrence = document.componentInstances.find((instance) => instance.componentId === base.id);
  const armOccurrence = document.componentInstances.find((instance) => instance.componentId === arm.id);
  updateComponentInstance(document, baseOccurrence.id, { grounded: true });
  const joint = createAssemblyJoint(document, {
    name: 'Obrót ramienia', type: 'revolute', referenceInstanceId: baseOccurrence.id, movingInstanceId: armOccurrence.id,
    axis: 'z', limits: { enabled: true, min: -45, max: 45 }, value: 30,
  });
  assert.deepEqual(joint.axisReference, { kind: 'component-origin-axis', instanceId: baseOccurrence.id, axis: 'z' });
  assert.equal(document.componentInstances.find((instance) => instance.id === armOccurrence.id).transform.rotationZ, 30);
  assert.throws(() => setJointValue(document, joint.id, 60), /zakresie/);
  setJointValue(document, joint.id, 60, { clamp: true });
  assert.equal(document.joints[0].value, 45);
  assert.throws(() => updateComponentInstance(document, armOccurrence.id, { transform: { x: 5 } }), /steruje joint/);
  updateAssemblyJoint(document, joint.id, { type: 'slider', axis: 'x', limits: { enabled: true, min: 0, max: 100 }, value: 25 });
  assert.equal(document.componentInstances.find((instance) => instance.id === armOccurrence.id).transform.x, 25);
  assert.equal(document.componentInstances.find((instance) => instance.id === armOccurrence.id).transform.rotationZ, 0);
  assert.throws(() => updateAssemblyJoint(document, joint.id, { limits: { min: 120, max: 20 } }), /Minimalny limit/);
  assert.equal(validateDocument(document).valid, true);
  assert.equal(deleteAssemblyJoint(document, joint.id).id, joint.id);
});

test('joint rigid blokuje ręczny ruch, graf odrzuca cykl, a usunięcie wystąpienia czyści joint', () => {
  const document = createDocument('Bezpieczne jointy');
  const assembly = createComponent(document, { name: 'Zespół jointów', type: 'assembly', partNumber: 'A-J2' });
  const parts = ['A', 'B', 'C'].map((name) => createComponent(document, { name: `Detal ${name}`, partNumber: `P-J${name}`, parentId: assembly.id }));
  const [first, second, third] = parts.map((part) => document.componentInstances.find((instance) => instance.componentId === part.id));
  const rigid = createAssemblyJoint(document, { type: 'rigid', referenceInstanceId: first.id, movingInstanceId: second.id });
  assert.equal(rigid.value, 0);
  assert.throws(() => updateComponentInstance(document, second.id, { transform: { y: 10 } }), /steruje joint/);
  const revolute = createAssemblyJoint(document, { type: 'revolute', referenceInstanceId: second.id, movingInstanceId: third.id });
  assert.throws(() => updateAssemblyJoint(document, revolute.id, { name: rigid.name }), /unikalna/);
  assert.throws(() => updateAssemblyJoint(document, revolute.id, { enabled: 'tak' }), /logiczną/);
  assert.throws(() => createAssemblyJoint(document, { type: 'slider', referenceInstanceId: third.id, movingInstanceId: first.id }), /cykl kinematyczny/);
  deleteComponentInstance(document, second.id);
  assert.equal(document.joints.length, 0);
  assert.equal(validateDocument(document).valid, true);
});

test('migracja v11 dodaje pustą kolekcję jointów w bieżącym schemacie', () => {
  const legacy = createDocument('Migracja jointów');
  legacy.schemaVersion = 11;
  delete legacy.joints;
  const opened = openDocument(legacy, { now: '2026-08-24T14:00:00.000Z' });
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(opened.document.joints, []);
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 11 && entry.to === 12));
});

test('Motion Link przekazuje ruch z przełożeniem i blokuje cykle oraz wielu sterujących', () => {
  const document = createDocument('Motion Links');
  const assembly = createComponent(document, { name: 'Przekładnia', type: 'assembly', partNumber: 'A-ML' });
  const parts = ['Napęd', 'Koło', 'Wskaźnik'].map((name, index) => createComponent(document, { name, partNumber: `P-ML${index + 1}`, parentId: assembly.id }));
  const [driveOccurrence, wheelOccurrence, indicatorOccurrence] = parts.map((part) => document.componentInstances.find((instance) => instance.componentId === part.id));
  const drive = createAssemblyJoint(document, { name: 'Napęd wejściowy', type: 'revolute', referenceInstanceId: wheelOccurrence.id, movingInstanceId: driveOccurrence.id, limits: { enabled: true, min: -180, max: 180 } });
  const wheel = createAssemblyJoint(document, { name: 'Koło wyjściowe', type: 'revolute', referenceInstanceId: indicatorOccurrence.id, movingInstanceId: wheelOccurrence.id, limits: { enabled: true, min: -360, max: 360 } });
  const link = createMotionLink(document, { name: 'Przełożenie 2:1', sourceJointId: drive.id, targetJointId: wheel.id, ratio: -2, offset: 10 });
  setJointValue(document, drive.id, 25);
  assert.equal(document.joints.find((joint) => joint.id === wheel.id).value, -40);
  assert.equal(document.componentInstances.find((instance) => instance.id === wheelOccurrence.id).transform.rotationZ, -40);
  assert.throws(() => createMotionLink(document, { sourceJointId: wheel.id, targetJointId: drive.id }), /cykl/);
  assert.throws(() => createMotionLink(document, { sourceJointId: drive.id, targetJointId: wheel.id }), /już Motion Link/);
  updateMotionLink(document, link.id, { ratio: 0.5, offset: 5 });
  assert.equal(document.joints.find((joint) => joint.id === wheel.id).value, 17.5);
  assert.equal(validateDocument(document).valid, true);
  assert.equal(deleteMotionLink(document, link.id).id, link.id);
});

test('konfiguracje złożenia zapisują widoczność, położenie i ruch bez kopiowania geometrii', () => {
  const document = createDocument('Konfiguracje');
  const assembly = createComponent(document, { name: 'Zespół', type: 'assembly', partNumber: 'A-CFG' });
  const base = createComponent(document, { name: 'Baza konfiguracji', partNumber: 'P-CFG1', parentId: assembly.id });
  const arm = createComponent(document, { name: 'Ramię konfiguracji', partNumber: 'P-CFG2', parentId: assembly.id });
  const baseOccurrence = document.componentInstances.find((instance) => instance.componentId === base.id);
  const armOccurrence = document.componentInstances.find((instance) => instance.componentId === arm.id);
  const joint = createAssemblyJoint(document, { type: 'revolute', referenceInstanceId: baseOccurrence.id, movingInstanceId: armOccurrence.id, limits: { enabled: true, min: 0, max: 90 }, value: 15 });
  const folded = createAssemblyConfiguration(document, { name: 'Złożone', description: 'Pozycja transportowa' });
  setJointValue(document, joint.id, 70);
  document.componentInstances.find((instance) => instance.id === armOccurrence.id).visible = false;
  const service = createAssemblyConfiguration(document, { name: 'Serwisowe' });
  applyAssemblyConfiguration(document, folded.id);
  assert.equal(document.joints[0].value, 15);
  assert.equal(document.componentInstances.find((instance) => instance.id === armOccurrence.id).visible, true);
  setJointValue(document, joint.id, 20);
  assert.equal(document.activeAssemblyConfigurationId, '');
  applyAssemblyConfiguration(document, folded.id);
  updateAssemblyConfiguration(document, folded.id, { description: 'Gotowe do transportu', captureCurrent: true });
  assert.equal(document.assemblyConfigurations.find((item) => item.id === folded.id).description, 'Gotowe do transportu');
  assert.equal(document.components.length, 3);
  assert.equal(document.assemblyConfigurations.length, 2);
  assert.equal(deleteAssemblyConfiguration(document, service.id).id, service.id);
  assert.equal(validateDocument(document).valid, true);
});

test('kontrola kolizji złożenia uwzględnia transformacje wystąpień i zagnieżdżenie', () => {
  const document = createDocument('Kolizje ruchu');
  const assembly = createComponent(document, { name: 'Zespół kolizji', type: 'assembly', partNumber: 'A-COL' });
  const part = createComponent(document, { name: 'Kostka', partNumber: 'P-COL', parentId: assembly.id, bodyIds: ['body-box'] });
  const first = document.componentInstances.find((instance) => instance.componentId === part.id);
  const second = duplicateComponentInstance(document, first.id, { transform: { x: 5 } });
  const bodies = [{
    id: 'body-box',
    metrics: { bounds: [[0, 0, 0], [10, 10, 10]] },
    vertices: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10],
    triangles: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7],
  }];
  const contactSet = createContactSet(document, { name: 'Kostki robocze', firstInstanceId: first.id, secondInstanceId: second.id });
  const collision = detectAssemblyCollisions(document, bodies);
  assert.equal(collision.occurrences, 2);
  assert.equal(collision.collisions.length, 1);
  assert.equal(collision.collisions[0].overlapVolume, 500);
  assert.equal(collision.collisions[0].status, 'exact');
  assert.equal(collision.exactPairs, 1);
  assert.equal(collision.activeContactPairs, 1);
  assert.equal(collision.collisions[0].contactSetId, contactSet.id);
  assert.equal(collision.contactSets[0].status, 'exact');
  const selectedCollision = detectAssemblyCollisions(document, bodies, { instanceIds: [second.id, first.id, second.id] });
  assert.deepEqual(selectedCollision.selectedInstanceIds, [second.id, first.id]);
  assert.equal(selectedCollision.checkedPairs, 1);
  assert.equal(selectedCollision.collisions[0].status, 'exact');
  assert.throws(() => detectAssemblyCollisions(document, bodies, { instanceIds: [first.id] }), /co najmniej dwóch/);
  assert.throws(() => detectAssemblyCollisions(document, bodies, { instanceIds: [first.id, 'missing'] }), /Nie znaleziono wszystkich/);
  assert.throws(() => detectAssemblyCollisions(document, bodies, { instanceIds: 'all' }), /musi być tablicą/);
  const boundedCollision = detectAssemblyCollisions(document, bodies, { maxExactTriangleTests: 1 });
  assert.equal(boundedCollision.status, 'partial');
  assert.equal(boundedCollision.collisions[0].status, 'broad-phase');
  updateContactSet(document, contactSet.id, { enabled: false, name: 'Kontakt wyłączony' });
  assert.equal(detectAssemblyCollisions(document, bodies).contactSets[0].status, 'disabled');
  assert.throws(() => createContactSet(document, { firstInstanceId: second.id, secondInstanceId: first.id }), /już Contact Set/);
  updateContactSet(document, contactSet.id, { enabled: true });
  updateComponentInstance(document, second.id, { transform: { x: 20 } });
  const separated = detectAssemblyCollisions(document, bodies);
  assert.equal(separated.collisions.length, 0);
  assert.equal(separated.contactSets[0].status, 'clear');
  assert.equal(deleteContactSet(document, contactSet.id).id, contactSet.id);
});

test('migracja v12 dodaje Motion Links i konfiguracje w bieżącym schemacie', () => {
  const legacy = createDocument('Migracja ruchu złożenia');
  legacy.schemaVersion = 12;
  delete legacy.motionLinks;
  delete legacy.contactSets;
  delete legacy.assemblyConfigurations;
  delete legacy.activeAssemblyConfigurationId;
  const opened = openDocument(legacy, { now: '2026-08-24T16:00:00.000Z' });
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(opened.document.motionLinks, []);
  assert.deepEqual(opened.document.contactSets, []);
  assert.deepEqual(opened.document.assemblyConfigurations, []);
  assert.equal(opened.document.activeAssemblyConfigurationId, '');
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 12 && entry.to === 13));
});

test('migracja v13 dodaje trwały rollback i grupy historii w bieżącym schemacie', () => {
  const legacy = createDocument('Migracja osi czasu');
  legacy.schemaVersion = 13;
  delete legacy.timelineRollbackFeatureId;
  delete legacy.featureGroups;
  const opened = openDocument(legacy, { now: '2026-08-24T16:30:00.000Z' });
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.equal(opened.document.timelineRollbackFeatureId, '');
  assert.deepEqual(opened.document.featureGroups, []);
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 13 && entry.to === 14));
  assert.equal(validateDocument(opened.document).valid, true);
});

test('migracja v14 dodaje linkowane projekty, a rekord łącza zachowuje proxy geometrii', () => {
  const legacy = createStarterDocument();
  legacy.schemaVersion = 14;
  delete legacy.linkedProjects;
  const opened = openDocument(legacy, { now: '2026-08-24T17:00:00.000Z' });
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(opened.document.linkedProjects, []);

  const document = createDocument('Złożenie linkowane');
  const feature = createFeature('importedModel', {
    name: 'Korpus źródłowy',
    importFormat: 'step',
    originalFormat: 'step',
    dataBase64: 'U1RFUA==',
    unitScale: 1,
  });
  document.features.push(feature);
  const component = createComponent(document, { name: 'Korpus linkowany', bodyIds: [`body-${feature.id}`] });
  const link = createLinkedProject({
    relativePath: '../części/korpus.madcad',
    fileName: 'korpus.madcad',
    sourceDocumentId: 'document-source',
    sourceName: 'Korpus',
    sourceSchemaVersion: DOCUMENT_SCHEMA_VERSION,
    sourceHash: 'a'.repeat(64),
    linkedComponentId: component.id,
    proxyFeatureIds: [feature.id],
    refreshedAt: '2026-08-24T17:00:00.000Z',
  });
  feature.linkedProjectId = link.id;
  document.components.find((item) => item.id === component.id).linkedProjectId = link.id;
  document.linkedProjects.push(link);
  assert.equal(validateDocument(document).valid, true);
  assert.equal(linkedProjectState(link, { hash: link.sourceHash }), 'current');
  assert.equal(linkedProjectState(link, { hash: 'b'.repeat(64) }), 'changed');
  assert.equal(linkedProjectState(link, { missing: true }), 'missing');
});

test('warstwy zapewniają ByLayer, aktywną warstwę i bezpieczne przenoszenie geometrii', () => {
  const document = createDocument('Warstwy');
  const pointA = createSketchPoint({ x: 0, y: 0 });
  const pointB = createSketchPoint({ x: 20, y: 0 });
  const line = createSketchLine({ startPointId: pointA.id, endPointId: pointB.id });
  const sketch = createSketch({ entities: [pointA, pointB, line] });
  document.sketches.push(sketch);
  const centerLayer = createLayer({ name: 'Osie', color: '#ff8800', lineType: 'center', lineWeight: 0.35, locked: true });
  document.layers.push(centerLayer);
  document.activeLayerId = centerLayer.id;
  assert.equal(assignEntitiesToLayer(document, sketch.id, [line.id], centerLayer.id), 1);
  const storedLine = sketch.entities.find((entity) => entity.id === line.id);
  assert.deepEqual(resolveEntityAppearance(document, storedLine), {
    layer: centerLayer,
    color: '#ff8800',
    lineType: 'center',
    lineWeight: 0.35,
    visible: true,
    locked: true,
    printable: true,
  });
  storedLine.color = '#33aa44';
  storedLine.lineType = 'dashed';
  storedLine.lineWeight = 0.5;
  const overridden = resolveEntityAppearance(document, storedLine);
  assert.equal(overridden.color, '#33aa44');
  assert.equal(overridden.lineType, 'dashed');
  assert.equal(overridden.lineWeight, 0.5);
  assert.equal(deleteLayer(document, centerLayer.id), 1);
  assert.equal(sketch.entities.find((entity) => entity.id === line.id).layerId, DEFAULT_LAYER_ID);
  assert.equal(document.activeLayerId, DEFAULT_LAYER_ID);
  assert.equal(validateDocument(document).valid, true);
});

test('normalizacja bieżącego dokumentu uzupełnia warstwę 0 i właściwości ByLayer', () => {
  const legacy = createDocument('Starszy zapis bez warstw');
  const point = createSketchPoint({ x: 2, y: 4 });
  legacy.sketches.push(createSketch({ entities: [point] }));
  delete legacy.layers;
  delete legacy.activeLayerId;
  delete legacy.sketches[0].entities[0].layerId;
  delete legacy.sketches[0].entities[0].color;
  delete legacy.sketches[0].entities[0].lineType;
  delete legacy.sketches[0].entities[0].lineWeight;
  ensureDocumentLayers(legacy);
  assert.equal(legacy.layers[0].id, DEFAULT_LAYER_ID);
  assert.equal(legacy.sketches[0].entities[0].layerId, DEFAULT_LAYER_ID);
  assert.equal(legacy.sketches[0].entities[0].color, BY_LAYER);
  assert.equal(legacy.sketches[0].entities[0].lineType, BY_LAYER);
  assert.equal(legacy.sketches[0].entities[0].lineWeight, BY_LAYER);
  assert.equal(validateDocument(legacy).valid, true);
});

test('blok 2D zachowuje definicję, atrybuty, transformację wystąpienia i eksplozję', () => {
  const document = createDocument('Bloki');
  const pointA = createSketchPoint({ x: 0, y: 0 });
  const pointB = createSketchPoint({ x: 20, y: 0 });
  const line = createSketchLine({ startPointId: pointA.id, endPointId: pointB.id });
  const sketch = createSketch({ entities: [pointA, pointB, line] });
  document.sketches.push(sketch);
  const created = createBlockDefinition(document, sketch.id, [line.id], { name: 'Oś 20', basePoint: [0, 0] });
  assert.equal(document.blocks.length, 1);
  assert.equal(sketch.blockInstances.length, 1);
  assert.ok(sketch.entities.find((entity) => entity.id === line.id).blockInstanceId);
  addBlockAttributeDefinition(document, created.block.id, { tag: 'NUMER', prompt: 'Numer elementu', defaultValue: 'A-01' });
  assert.equal(created.instance.attributes.NUMER, 'A-01');

  const inserted = insertBlockInstance(document, sketch.id, created.block.id, { insertionPoint: [100, 50], rotation: 90, scale: 2 });
  updateBlockInstanceAttributes(document, sketch.id, inserted.instance.id, { NUMER: 'A-02', NIEZNANY: 'x' });
  assert.deepEqual(inserted.instance.attributes, { NUMER: 'A-02' });
  const insertedPoints = inserted.entities.filter((entity) => entity.type === 'point');
  const coordinates = insertedPoints.map((point) => [evaluateExpression(point.geometry.x), evaluateExpression(point.geometry.y)]);
  assert.deepEqual(coordinates, [[100, 50], [100, 90]]);
  assert.equal(validateDocument(document).valid, true);

  const reopened = openDocument(JSON.parse(JSON.stringify(document))).document;
  const reopenedInstance = reopened.sketches[0].blockInstances.find((instance) => instance.id === inserted.instance.id);
  assert.equal(reopenedInstance.attributes.NUMER, 'A-02');
  assert.equal(reopened.sketches[0].entities.filter((entity) => entity.blockInstanceId === inserted.instance.id).length, 3);
  assert.equal(explodeBlockInstance(reopened, sketch.id, inserted.instance.id).length, 3);
  assert.equal(reopened.sketches[0].entities.some((entity) => entity.blockInstanceId === inserted.instance.id), false);
  assert.equal(validateDocument(reopened).valid, true);
});

test('biblioteka bloków chroni używaną definicję i usuwa ją po usunięciu wystąpienia', () => {
  const document = createDocument('Biblioteka bloków');
  const pointA = createSketchPoint({ x: 0, y: 0 });
  const pointB = createSketchPoint({ x: 10, y: 0 });
  const line = createSketchLine({ startPointId: pointA.id, endPointId: pointB.id });
  const sketch = createSketch({ entities: [pointA, pointB, line] });
  document.sketches.push(sketch);
  const { block, instance } = createBlockDefinition(document, sketch.id, [line.id], { name: 'Linia 10' });
  assert.throws(() => deleteBlockDefinition(document, block.id), /używanej/);
  assert.equal(deleteBlockInstance(document, sketch.id, instance.id).entityIds.length, 3);
  assert.equal(deleteBlockDefinition(document, block.id), true);
  assert.equal(document.blocks.length, 0);
  assert.equal(validateDocument(document).valid, true);
});

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

test('historia nie wykonuje operacji wyłączonych ani cofniętych', () => {
  const executed = [];
  const features = [
    { id: 'feature-ready', name: 'Aktywna', status: 'ready' },
    { id: 'feature-suppressed', name: 'Wyłączona', status: FEATURE_STATUS.SUPPRESSED },
    { id: 'feature-rolled-back', name: 'Cofnięta', status: FEATURE_STATUS.ROLLED_BACK },
  ];
  const history = evaluateFeatureHistory(features, (feature) => {
    executed.push(feature.id);
    return { diagnostics: [] };
  });
  assert.deepEqual(executed, ['feature-ready']);
  assert.deepEqual(history.timeline.map((item) => item.status), [
    FEATURE_STATUS.OK,
    FEATURE_STATUS.SUPPRESSED,
    FEATURE_STATUS.ROLLED_BACK,
  ]);
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
  assert.equal(lost.candidates[0].confidence, 'high');
  assert.ok(lost.candidates[0].score >= 80);
  assert.ok(lost.candidates[0].distance <= 1);

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

test('płaszczyzny angle, tangent i path tworzą ortonormalne parametryczne układy', () => {
  const parameters = [createParameter('kat', '30', { name: 'kat' })];
  const angle = resolveConstructionPlane(createAnglePlane({ basePlane: 'XY', rotationAxis: 'u', angle: 'kat', offset: '5' }), parameters);
  assert.ok(Math.abs(angle.origin[2] - 5) < 1e-9);
  assert.ok(Math.abs(angle.normal[1] + 0.5) < 1e-9);
  assert.ok(Math.abs(angle.normal[2] - Math.sqrt(3) / 2) < 1e-9);
  assert.ok(Math.abs(angle.normal.reduce((sum, value, index) => sum + value * angle.u[index], 0)) < 1e-9);

  const sphere = resolveConstructionPlane(createTangentPlane({ surfaceType: 'sphere', center: [0, 0, 0], point: [0, 5, 0] }));
  assert.deepEqual(sphere.origin, [0, 5, 0]);
  assert.deepEqual(sphere.normal.map((value) => Number(value.toFixed(8))), [0, 1, 0]);
  const cylinder = resolveConstructionPlane(createTangentPlane({ surfaceType: 'cylinder', center: [0, 0, 0], point: [3, 0, 7], axis: [0, 0, 1] }));
  assert.deepEqual(cylinder.normal.map((value) => Number(value.toFixed(8))), [1, 0, 0]);

  const path = resolveConstructionPlane(createPathPlane({ point: ['2', '3', '4'], direction: [1, 1, 0] }));
  assert.deepEqual(path.origin, [2, 3, 4]);
  assert.ok(Math.abs(path.normal[0] - Math.SQRT1_2) < 1e-9 && Math.abs(path.normal[1] - Math.SQRT1_2) < 1e-9);
  assert.throws(() => resolveConstructionPlane(createPathPlane({ direction: [0, 0, 0] })), /zerowej długości/);
  assert.throws(() => resolveConstructionPlane(createTangentPlane({ center: [0, 0, 0], point: [0, 0, 0] })), /zerowej długości/);
});

test('osie konstrukcyjne rozwiązują krawędź, walec, dwa punkty, przecięcie i normalną płaszczyzny', () => {
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
  const normal = resolveConstructionAxis(createPlaneNormalAxis({ planeId: zThree.id, origin: ['H', 2, 3] }), [zThree], parameters);
  assert.deepEqual(normal.origin, [12, 2, 3]);
  assert.deepEqual(normal.direction, [0, 0, 1]);
  assert.equal(resolveConstructionAxes([xFive, zThree, intersection], parameters)[0].status, 'ok');
  assert.throws(() => resolveConstructionAxis(createTwoPointAxis({ points: [[1, 1, 1], [1, 1, 1]] })), /zerowej długości/);
  assert.throws(() => resolveConstructionAxis(createPlaneIntersectionAxis({ planeIds: [xFive.id, createOffsetPlane({ basePlane: 'YZ', offset: '9' }).id] }), [xFive]), /Nie znaleziono/);
  assert.throws(() => resolveConstructionAxis(createPlaneNormalAxis({ planeId: 'missing' }), [zThree]), /Nie znaleziono/);
});

test('punkty konstrukcyjne śledzą wierzchołek, centrum, środek, oś i przecięcie', () => {
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
  const midpoint = createMidpointPoint({ points: [[0, 2, 4], ['10', '6', '8']] });
  assert.deepEqual(resolveConstructionPoint(midpoint).position, [5, 4, 6]);
  const onAxis = createPointOnAxis({ axisId: axis.id, distance: 'H / 2' });
  assert.deepEqual(resolveConstructionPoint(onAxis, [axis], [createParameter('H', '12')]).position, [5, 6, -4]);
  assert.equal(resolveConstructionPoints([axis, plane, intersection])[0].status, 'ok');
  const parallel = createTwoPointAxis({ points: [[0, 0, 2], [10, 0, 2]] });
  assert.throws(() => resolveConstructionPoint(createIntersectionPoint({ axisId: parallel.id, planeId: plane.id }), [parallel, plane]), /równoległa/);
  assert.throws(() => resolveConstructionPoint(createPointOnAxis({ axisId: 'missing' })), /Nie znaleziono/);
});

test('dokument i graf zależności akceptują rozszerzone płaszczyzny, osie i punkty', () => {
  const document = createDocument('Rozszerzona konstrukcja');
  const angle = createAnglePlane({ angle: 'A', offset: 'H' });
  const tangent = createTangentPlane({ center: [0, 0, 0], point: ['R', 0, 0] });
  const path = createPathPlane({ point: [0, 'H', 0], direction: [1, 1, 0] });
  const normal = createPlaneNormalAxis({ planeId: angle.id, origin: [0, 0, 'H'] });
  const midpoint = createMidpointPoint({ points: [[0, 0, 0], ['H', 0, 0]] });
  const onAxis = createPointOnAxis({ axisId: normal.id, distance: 'H / 2' });
  document.parameters.push(createParameter('A', '30'), createParameter('H', '12'), createParameter('R', '5'));
  document.references.push(angle, tangent, path, normal, midpoint, onAxis);
  assert.equal(validateDocument(document).valid, true);
  const graph = buildDependencyGraph(document);
  assert.ok(graph.edges.some((edge) => edge.from === angle.id && edge.to === normal.id && edge.kind === 'normal-to'));
  assert.ok(graph.edges.some((edge) => edge.from === normal.id && edge.to === onAxis.id));

  const broken = structuredClone(document);
  broken.references.find((reference) => reference.id === normal.id).planeId = 'missing-plane';
  broken.references.find((reference) => reference.id === onAxis.id).axisId = 'missing-axis';
  const issues = validateDocument(broken).issues;
  assert.ok(issues.some((issue) => issue.path.endsWith('.planeId') && issue.code === 'BROKEN_REFERENCE'));
  assert.ok(issues.some((issue) => issue.path.endsWith('.axisId') && issue.code === 'BROKEN_REFERENCE'));
});

test('szkic na planarnej ścianie zachowuje podporę i odsunięcie w przygotowaniu kernela', () => {
  const document = createDocument('Szkic na ścianie');
  const support = createTopologyReference({ selection: { kind: 'face', id: 'face-top', bodyId: 'body-base', sourceFeatureId: 'feature-base' }, descriptor: { geometry: 'PLANE', center: [0, 0, 12], normal: [0, 0, 1] } });
  const profile = createRectangleProfile({ width: 8, height: 6 });
  const sketch = createSketch({ name: 'Szkic na górze', plane: 'XY', planeOffset: '12', support: { kind: 'face', referenceId: support.id }, profiles: [profile] });
  document.references.push(support);
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: [profile.id], distance: '3', operation: 'new' }));
  const prepared = prepareDocument(document);
  assert.equal(prepared.features[0].profiles[0].planeOffset, 12);
  assert.equal(buildDependencyGraph(document).edges.some((edge) => edge.from === support.id && edge.to === sketch.id && edge.kind === 'supports'), true);
  const broken = structuredClone(document);
  broken.references = [];
  assert.equal(validateDocument(broken).issues.some((issue) => issue.path.endsWith('support.referenceId') && issue.code === 'BROKEN_REFERENCE'), true);
});

test('Patch, Surface Extrude, Surface Revolve, Surface Sweep, Surface Loft, Surface Offset, Stitch, Surface Trim, Surface Extend i Thicken zachowują szkic, zależności i rozdział powierzchnia-bryła', () => {
  const patchDocument = createDocument('Powierzchnia Patch');
  const patchProfile = createRectangleProfile({ width: '40', height: '20' });
  const patchSketch = createSketch({ name: 'Obrys powierzchni', profiles: [patchProfile] });
  const patch = createFeature('surfacePatch', { sketchId: patchSketch.id, profileIds: [patchProfile.id] });
  const thicken = createFeature('thickenSurface', { targetBodyId: `body-${patch.id}`, thickness: '2.5', side: 'symmetric', reverse: false });
  patchDocument.sketches.push(patchSketch);
  patchDocument.features.push(patch, thicken);
  assert.equal(validateDocument(patchDocument).valid, true);
  const preparedPatch = prepareDocument(patchDocument);
  assert.equal(preparedPatch.features[0].profile.geometry.width, 40);
  assert.equal(preparedPatch.features[1].thicknessValue, 2.5);
  assert.equal(preparedPatch.features[1].side, 'symmetric');
  const patchGraph = buildDependencyGraph(patchDocument);
  assert.equal(patchGraph.producerOfBody(`body-${patch.id}`), patch.id);
  assert.ok(patchGraph.affectedBy(patchProfile.id).includes(thicken.id));

  const extrudeDocument = createDocument('Powierzchnia wyciągnięta');
  const extrudeProfile = createCircleProfile({ diameter: '18' });
  const extrudeSketch = createSketch({ name: 'Profil walcowy', profiles: [extrudeProfile] });
  const surfaceExtrude = createFeature('surfaceExtrude', { sketchId: extrudeSketch.id, profileIds: [extrudeProfile.id], distance: '-25' });
  const moveSurface = createFeature('transform', { targetBodyId: `body-${surfaceExtrude.id}`, mode: 'move', x: '35', y: '0', z: '0', angle: '0', originX: '0', originY: '0', originZ: '0' });
  const thickenExtrude = createFeature('thickenSurface', { targetBodyId: `body-${surfaceExtrude.id}`, thickness: '2', side: 'one-side', reverse: false });
  extrudeDocument.sketches.push(extrudeSketch);
  extrudeDocument.features.push(surfaceExtrude, moveSurface, thickenExtrude);
  assert.equal(validateDocument(extrudeDocument).valid, true);
  const preparedExtrudeDocument = prepareDocument(extrudeDocument);
  const preparedExtrude = preparedExtrudeDocument.features[0];
  assert.equal(preparedExtrude.distanceValue, -25);
  assert.equal(preparedExtrude.profile.geometry.diameter, 18);
  assert.deepEqual(preparedExtrudeDocument.features[1].translation, [35, 0, 0]);
  assert.equal(preparedExtrudeDocument.features[2].thicknessValue, 2);
  assert.ok(buildDependencyGraph(extrudeDocument).affectedBy(extrudeProfile.id).includes(thickenExtrude.id));

  const revolveDocument = createDocument('Powierzchnia obrotowa');
  const start = createSketchPoint({ x: '12', y: '-10' });
  const end = createSketchPoint({ x: '12', y: '10' });
  const line = createSketchLine({ startPointId: start.id, endPointId: end.id });
  const revolveSketch = createSketch({ name: 'Tworząca powierzchni', plane: 'XY', entities: [start, end, line] });
  const surfaceRevolve = createFeature('surfaceRevolve', { sketchId: revolveSketch.id, profileIds: [], openEntityIds: [line.id], axisId: 'Y_AXIS', angle: '270' });
  const thickenRevolve = createFeature('thickenSurface', { targetBodyId: `body-${surfaceRevolve.id}`, thickness: '1.5', side: 'symmetric', reverse: false });
  revolveDocument.sketches.push(revolveSketch);
  revolveDocument.features.push(surfaceRevolve, thickenRevolve);
  assert.equal(validateDocument(revolveDocument).valid, true);
  const preparedRevolve = prepareDocument(revolveDocument);
  assert.equal(preparedRevolve.features[0].profile.type, 'open');
  assert.deepEqual(preparedRevolve.features[0].axis.direction, [0, 1, 0]);
  assert.equal(preparedRevolve.features[0].angleValue, 270);
  assert.equal(preparedRevolve.features[1].thicknessValue, 1.5);
  const revolveGraph = buildDependencyGraph(revolveDocument);
  assert.equal(revolveGraph.producerOfBody(`body-${surfaceRevolve.id}`), surfaceRevolve.id);
  assert.ok(revolveGraph.affectedBy(line.id).includes(thickenRevolve.id));

  const sweepDocument = createDocument('Powierzchnia po ścieżce');
  const profileStart = createSketchPoint({ x: 0, y: '-6' });
  const profileEnd = createSketchPoint({ x: 0, y: '6' });
  const profileLine = createSketchLine({ startPointId: profileStart.id, endPointId: profileEnd.id });
  const sweepProfileSketch = createSketch({ name: 'Otwarty profil', plane: 'XY', entities: [profileStart, profileEnd, profileLine] });
  const pathStart = createSketchPoint({ x: 0, y: 0 });
  const pathEnd = createSketchPoint({ x: 30, y: 0 });
  const pathLine = createSketchLine({ startPointId: pathStart.id, endPointId: pathEnd.id });
  const sweepPathSketch = createSketch({ name: 'Ścieżka', plane: 'XY', entities: [pathStart, pathEnd, pathLine] });
  const surfaceSweep = createFeature('surfaceSweep', { sketchId: sweepProfileSketch.id, profileIds: [], openEntityIds: [profileLine.id], pathSketchId: sweepPathSketch.id, pathEntityIds: [pathLine.id] });
  const thickenSweep = createFeature('thickenSurface', { targetBodyId: `body-${surfaceSweep.id}`, thickness: '1', side: 'one-side', reverse: false });
  sweepDocument.sketches.push(sweepProfileSketch, sweepPathSketch);
  sweepDocument.features.push(surfaceSweep, thickenSweep);
  assert.equal(validateDocument(sweepDocument).valid, true);
  const preparedSweep = prepareDocument(sweepDocument);
  assert.equal(preparedSweep.features[0].profile.type, 'open');
  assert.deepEqual(preparedSweep.features[0].path.geometry.points, [[0, 0], [30, 0]]);
  assert.equal(preparedSweep.features[1].thicknessValue, 1);
  const sweepGraph = buildDependencyGraph(sweepDocument);
  assert.equal(sweepGraph.producerOfBody(`body-${surfaceSweep.id}`), surfaceSweep.id);
  assert.ok(sweepGraph.affectedBy(pathLine.id).includes(thickenSweep.id));

  const loftDocument = createDocument('Powierzchnia przejściowa');
  const lowerProfile = createRectangleProfile({ name: 'Dolny profil', width: 24, height: 16, x: 0, y: 0 });
  const upperProfile = createRectangleProfile({ name: 'Górny profil', width: 12, height: 8, x: 3, y: 2 });
  const lowerSketch = createSketch({ name: 'Dolny szkic', plane: 'XY', planeOffset: '0', profiles: [lowerProfile] });
  const upperSketch = createSketch({ name: 'Górny szkic', plane: 'XY', planeOffset: '20', profiles: [upperProfile] });
  const surfaceLoft = createFeature('surfaceLoft', { sketchId: lowerSketch.id, sketchIds: [lowerSketch.id, upperSketch.id], profileIds: [lowerProfile.id, upperProfile.id], loftMode: 'smooth' });
  const offsetLoft = createFeature('surfaceOffset', { targetBodyId: `body-${surfaceLoft.id}`, distance: '2' });
  const thickenLoft = createFeature('thickenSurface', { targetBodyId: `body-${surfaceLoft.id}`, thickness: '1.5', side: 'symmetric', reverse: false });
  loftDocument.sketches.push(lowerSketch, upperSketch);
  loftDocument.features.push(surfaceLoft, offsetLoft, thickenLoft);
  assert.equal(validateDocument(loftDocument).valid, true);
  const preparedLoft = prepareDocument(loftDocument);
  assert.equal(preparedLoft.features[0].profiles.length, 2);
  assert.equal(preparedLoft.features[0].profiles[1].planeOffset, 20);
  assert.equal(preparedLoft.features[1].distanceValue, 2);
  assert.equal(preparedLoft.features[2].thicknessValue, 1.5);
  const loftGraph = buildDependencyGraph(loftDocument);
  assert.equal(loftGraph.producerOfBody(`body-${surfaceLoft.id}`), surfaceLoft.id);
  assert.ok(loftGraph.affectedBy(upperProfile.id).includes(thickenLoft.id));

  const stitchDocument = createDocument('Zszywanie powierzchni');
  const firstStitchProfile = createRectangleProfile({ width: 20, height: 10 });
  const secondStitchProfile = createRectangleProfile({ width: 20, height: 10 });
  const firstStitchSketch = createSketch({ plane: 'XY', planeOffset: '0', profiles: [firstStitchProfile] });
  const secondStitchSketch = createSketch({ plane: 'XY', planeOffset: '10', profiles: [secondStitchProfile] });
  const firstPatch = createFeature('surfacePatch', { sketchId: firstStitchSketch.id, profileIds: [firstStitchProfile.id] });
  const secondPatch = createFeature('surfacePatch', { sketchId: secondStitchSketch.id, profileIds: [secondStitchProfile.id] });
  const stitch = createFeature('surfaceStitch', { targetBodyIds: [`body-${firstPatch.id}`, `body-${secondPatch.id}`], tolerance: '0.01' });
  stitchDocument.sketches.push(firstStitchSketch, secondStitchSketch);
  stitchDocument.features.push(firstPatch, secondPatch, stitch);
  assert.equal(validateDocument(stitchDocument).valid, true);
  assert.equal(prepareDocument(stitchDocument).features[2].toleranceValue, 0.01);
  const stitchGraph = buildDependencyGraph(stitchDocument);
  assert.equal(stitchGraph.producerOfBody(`body-${stitch.id}`), stitch.id);
  assert.ok(stitchGraph.affectedBy(firstPatch.id).includes(stitch.id));

  const trimDocument = createDocument('Przycinanie powierzchni');
  const trimProfile = createRectangleProfile({ width: 48, height: 32 });
  const trimSketch = createSketch({ plane: 'XY', profiles: [trimProfile] });
  const trimPatch = createFeature('surfacePatch', { sketchId: trimSketch.id, profileIds: [trimProfile.id] });
  const trimTool = createFeature('primitive', { primitiveType: 'box', x: '0', y: '-20', z: '-5', width: '30', depth: '40', height: '10' });
  const trim = createFeature('surfaceTrim', { targetBodyId: `body-${trimPatch.id}`, toolBodyId: `body-${trimTool.id}`, keepTool: true });
  const thickenTrim = createFeature('thickenSurface', { targetBodyId: `body-${trimPatch.id}`, thickness: '2', side: 'one-side', reverse: false });
  trimDocument.sketches.push(trimSketch);
  trimDocument.features.push(trimPatch, trimTool, trim, thickenTrim);
  assert.equal(validateDocument(trimDocument).valid, true);
  assert.equal(prepareDocument(trimDocument).features[2].keepTool, true);
  const trimGraph = buildDependencyGraph(trimDocument);
  assert.ok(trimGraph.affectedBy(trimPatch.id).includes(trim.id));
  assert.ok(trimGraph.affectedBy(trimTool.id).includes(trim.id));
  assert.ok(trimGraph.affectedBy(trim.id).includes(thickenTrim.id));

  const extendDocument = createDocument('Przedłużanie powierzchni');
  const extendProfile = createRectangleProfile({ width: 48, height: 32 });
  const extendSketch = createSketch({ plane: 'XY', profiles: [extendProfile] });
  const extendPatch = createFeature('surfacePatch', { sketchId: extendSketch.id, profileIds: [extendProfile.id] });
  const extendBodyId = `body-${extendPatch.id}`;
  const extendEdge = { ...createTopologyReference({ selection: { kind: 'edge', id: 'edge-right', bodyId: extendBodyId, sourceFeatureId: extendPatch.id }, descriptor: { geometry: 'LINE', endpoints: [[24, -16, 0], [24, 16, 0]], length: 32, closed: false }, label: 'Surface Extend — krawędź' }), scope: 'feature-input' };
  const extend = createFeature('surfaceExtend', { targetBodyId: extendBodyId, distance: '10', referenceIds: [extendEdge.id] });
  extendDocument.sketches.push(extendSketch);
  extendDocument.references.push(extendEdge);
  extendDocument.features.push(extendPatch, extend);
  assert.equal(validateDocument(extendDocument).valid, true);
  assert.equal(prepareDocument(extendDocument).features[1].distanceValue, 10);
  assert.ok(buildDependencyGraph(extendDocument).affectedBy(extendEdge.id).includes(extend.id));
});

test('Extrude przygotowuje odsunięty start, Join, Cut i Intersect z jedną, dwiema, symetryczną oraz Through All', () => {
  const document = createDocument('Zakresy Extrude');
  document.parameters.push(createParameter('start', '2'));
  const profile = createRectangleProfile({ width: 20, height: 10 });
  const sketch = createSketch({ profiles: [profile] });
  const base = createFeature('extrude', { sketchId: sketch.id, profileIds: [profile.id], distance: '8', startOffset: 'start', extent: 'one-side', operation: 'new' });
  const targetBodyId = `body-${base.id}`;
  const twoSides = createFeature('extrude', { sketchId: sketch.id, profileIds: [profile.id], distance: '5', secondDistance: '3', extent: 'two-sides', operation: 'join', targetBodyId });
  const symmetric = createFeature('extrude', { sketchId: sketch.id, profileIds: [profile.id], distance: '6', extent: 'symmetric', operation: 'cut', targetBodyId });
  const throughAll = createFeature('extrude', { sketchId: sketch.id, profileIds: [profile.id], distance: '1', extent: 'through-all', operation: 'intersect', targetBodyId });
  document.sketches.push(sketch);
  document.features.push(base, twoSides, symmetric, throughAll);

  const prepared = prepareDocument(document);
  assert.deepEqual(prepared.features.map((feature) => feature.extent), ['one-side', 'two-sides', 'symmetric', 'through-all']);
  assert.equal(prepared.features[1].distanceValue, 5);
  assert.equal(prepared.features[0].startOffsetValue, 2);
  assert.equal(prepared.features[1].secondDistanceValue, 3);
  assert.equal(prepared.features[2].distanceValue, 6);
  assert.equal(validateDocument(document).valid, true);
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === document.parameters[0].id && edge.to === base.id && edge.kind === 'drives'));

  const invalid = structuredClone(document);
  invalid.features[0].extent = 'through-all';
  assert.ok(validateDocument(invalid).issues.some((issue) => issue.path.endsWith('.extent')));
});

test('baza blachowa zachowuje grubość, promień gięcia, współczynnik K i profil źródłowy', () => {
  const document = createDocument('Blacha bazowa');
  const profile = createRectangleProfile({ width: '100', height: '60' });
  const sketch = createSketch({ name: 'Obrys blachy', profiles: [profile] });
  const base = createFeature('sheetBase', { sketchId: sketch.id, profileIds: [profile.id], thickness: '1.5', bendRadius: '2', kFactor: '0.42', side: 'symmetric', reverse: false });
  document.sketches.push(sketch);
  document.features.push(base);
  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[0];
  assert.equal(prepared.thicknessValue, 1.5);
  assert.equal(prepared.bendRadiusValue, 2);
  assert.equal(prepared.kFactorValue, 0.42);
  assert.equal(prepared.profile.geometry.width, 100);
  assert.equal(buildDependencyGraph(document).producerOfBody(`body-${base.id}`), base.id);

  const invalid = structuredClone(document);
  invalid.features[0].kFactor = '1.2';
  assert.throws(() => prepareDocument(invalid), /zakresu 0–1/);
});

test('kołnierz blachy dziedziczy bryłę bazową i przygotowuje kąt, długość oraz trwałą krawędź', () => {
  const document = createDocument('Kołnierz blachy');
  document.parameters.push(createParameter('wysokosc', '18'));
  const profile = createRectangleProfile({ width: '80', height: '40' });
  const sketch = createSketch({ name: 'Obrys blachy', profiles: [profile] });
  const base = createFeature('sheetBase', { sketchId: sketch.id, profileIds: [profile.id], thickness: '2', bendRadius: '3', kFactor: '0.45', side: 'symmetric', reverse: false });
  const bodyId = `body-${base.id}`;
  const edge = { ...createTopologyReference({ selection: { kind: 'edge', id: 'edge-sheet', bodyId, sourceFeatureId: base.id }, descriptor: { geometry: 'LINE', endpoints: [[40, -20, 1], [40, 20, 1]], length: 40, closed: false }, label: 'Kołnierz blachy — krawędź' }), scope: 'feature-input' };
  const flange = createFeature('sheetFlange', { targetBodyId: bodyId, referenceIds: [edge.id], length: 'wysokosc', angle: '90', bendRadius: '3', reverse: false });
  document.sketches.push(sketch);
  document.references.push(edge);
  document.features.push(base, flange);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.equal(prepared.lengthValue, 18);
  assert.equal(prepared.angleValue, 90);
  assert.equal(prepared.bendRadiusValue, 3);
  assert.equal(prepared.topologyReferences[0].id, edge.id);
  const graph = buildDependencyGraph(document);
  assert.ok(graph.edges.some((relation) => relation.from === bodyId && relation.to === flange.id && relation.kind === 'modifies'));
  assert.ok(graph.edges.some((relation) => relation.from === document.parameters[0].id && relation.to === flange.id && relation.kind === 'drives'));

  const invalid = structuredClone(document);
  invalid.features[1].angle = '180';
  assert.throws(() => prepareDocument(invalid), /zakresu 0–180/);
});

test('Hem i Rip przygotowują zawinięcie 180 stopni oraz kontrolowaną szczelinę tej samej blachy', () => {
  const document = createDocument('Hem i Rip');
  const profile = createRectangleProfile({ width: '80', height: '40' });
  const sketch = createSketch({ profiles: [profile] });
  const base = createFeature('sheetBase', { sketchId: sketch.id, profileIds: [profile.id], thickness: '2', bendRadius: '3', kFactor: '0.45', side: 'symmetric', reverse: false });
  const bodyId = `body-${base.id}`;
  const hemEdge = { ...createTopologyReference({ selection: { kind: 'edge', id: 'edge-hem', bodyId, sourceFeatureId: base.id }, descriptor: { geometry: 'LINE', endpoints: [[-40, -20, 1], [-40, 20, 1]], length: 40, closed: false }, label: 'Zawinięcie blachy — krawędź' }), scope: 'feature-input' };
  const ripEdge = { ...createTopologyReference({ selection: { kind: 'edge', id: 'edge-rip', bodyId, sourceFeatureId: base.id }, descriptor: { geometry: 'LINE', endpoints: [[-40, -20, -1], [40, -20, -1]], length: 80, closed: false }, label: 'Szczelina blachy — krawędź' }), scope: 'feature-input' };
  const hem = createFeature('sheetHem', { targetBodyId: bodyId, referenceIds: [hemEdge.id], length: '8', gap: '0.5', reverse: false });
  const rip = createFeature('sheetRip', { targetBodyId: bodyId, referenceIds: [ripEdge.id], gap: '1' });
  document.sketches.push(sketch);
  document.references.push(hemEdge, ripEdge);
  document.features.push(base, hem, rip);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document);
  assert.equal(prepared.features[1].lengthValue, 8);
  assert.equal(prepared.features[1].gapValue, 0.5);
  assert.equal(prepared.features[2].gapValue, 1);
  assert.equal(prepared.features[1].topologyReferences[0].id, hemEdge.id);
  assert.equal(prepared.features[2].topologyReferences[0].id, ripEdge.id);

  const invalid = structuredClone(document);
  invalid.features[1].gap = '0';
  assert.throws(() => prepareDocument(invalid), /Szczelina zawinięcia/);
});

test('Rozwiń i Zagnij ponownie pilnują kolejności parametrycznej blachy', () => {
  const document = createDocument('Rozwinięcie blachy');
  const profile = createRectangleProfile({ width: '60', height: '30' });
  const sketch = createSketch({ profiles: [profile] });
  const base = createFeature('sheetBase', { sketchId: sketch.id, profileIds: [profile.id], thickness: '2', bendRadius: '3', kFactor: '0.45', side: 'symmetric', reverse: false });
  const bodyId = `body-${base.id}`;
  const edge = { ...createTopologyReference({ selection: { kind: 'edge', id: 'edge-flat', bodyId, sourceFeatureId: base.id }, descriptor: { geometry: 'LINE', endpoints: [[-30, -15, 1], [-30, 15, 1]], length: 30, closed: false }, label: 'Kołnierz blachy — krawędź' }), scope: 'feature-input' };
  const flange = createFeature('sheetFlange', { targetBodyId: bodyId, referenceIds: [edge.id], length: '12', angle: '90', bendRadius: '3', reverse: false });
  const unfold = createFeature('sheetUnfold', { targetBodyId: bodyId });
  const refold = createFeature('sheetRefold', { targetBodyId: bodyId });
  document.sketches.push(sketch);
  document.references.push(edge);
  document.features.push(base, flange, unfold, refold);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document);
  assert.deepEqual(prepared.features.slice(2).map((feature) => feature.type), ['sheetUnfold', 'sheetRefold']);
  assert.equal(buildDependencyGraph(document).edges.some((relation) => relation.from === bodyId && relation.to === unfold.id && relation.kind === 'modifies'), true);

  const duplicateUnfold = structuredClone(document);
  duplicateUnfold.features.splice(3, 0, createFeature('sheetUnfold', { targetBodyId: bodyId }));
  assert.equal(validateDocument(duplicateUnfold).issues.some((issue) => issue.code === 'SEQUENCE' && issue.message.includes('już rozwinięta')), true);

  const missingUnfold = structuredClone(document);
  missingUnfold.features.splice(2, 1);
  assert.equal(validateDocument(missingUnfold).issues.some((issue) => issue.code === 'SEQUENCE' && issue.message.includes('wymaga wcześniejszego rozwinięcia')), true);
});

test('Boss tworzy parametryczny słupek z otworem na trwałej planarnej ścianie', () => {
  const document = createDocument('Plastic Boss');
  document.parameters.push(createParameter('boss_h', '8'));
  const base = createFeature('primitive', { primitiveType: 'box', x: '-20', y: '-15', z: '0', width: '40', depth: '30', height: '4' });
  const bodyId = `body-${base.id}`;
  const face = { ...createTopologyReference({ selection: { kind: 'face', id: 'top-face', bodyId, sourceFeatureId: base.id }, descriptor: { geometry: 'PLANE', center: [0, 0, 4], normal: [0, 0, 1], area: 1200 }, label: 'Boss — powierzchnia bazowa' }), scope: 'feature-input' };
  const boss = createFeature('plasticBoss', { targetBodyId: bodyId, referenceIds: [face.id], outerDiameter: '12', holeDiameter: '4', height: 'boss_h', holeDepth: '3', offsetX: '5', offsetY: '-2', reverse: false });
  document.references.push(face);
  document.features.push(base, boss);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.equal(prepared.outerDiameterValue, 12);
  assert.equal(prepared.holeDiameterValue, 4);
  assert.equal(prepared.heightValue, 8);
  assert.equal(prepared.holeDepthValue, 3);
  assert.equal(prepared.offsetXValue, 5);
  assert.equal(prepared.offsetYValue, -2);
  assert.equal(prepared.topologyReferences[0].id, face.id);
  const graph = buildDependencyGraph(document);
  assert.ok(graph.edges.some((edge) => edge.from === bodyId && edge.to === boss.id && edge.kind === 'modifies'));
  assert.ok(graph.affectedBy(document.parameters[0].id).includes(boss.id));

  const invalid = structuredClone(document);
  invalid.features[1].holeDiameter = '12';
  assert.throws(() => prepareDocument(invalid), /mniejszy/);
});

test('Snap-fit tworzy parametryczne ramię z zaczepem na trwałej planarnej ścianie', () => {
  const document = createDocument('Plastic Snap-fit');
  document.parameters.push(createParameter('arm_l', '24'));
  const base = createFeature('primitive', { primitiveType: 'box', x: '-20', y: '-15', z: '0', width: '40', depth: '30', height: '4' });
  const bodyId = `body-${base.id}`;
  const face = { ...createTopologyReference({ selection: { kind: 'face', id: 'top-face', bodyId, sourceFeatureId: base.id }, descriptor: { geometry: 'PLANE', center: [0, 0, 4], normal: [0, 0, 1], area: 1200 }, label: 'Snap-fit — powierzchnia bazowa' }), scope: 'feature-input' };
  const snapFit = createFeature('plasticSnapFit', { targetBodyId: bodyId, referenceIds: [face.id], length: 'arm_l', width: '8', thickness: '2', clearance: '1.5', hookLength: '5', hookHeight: '3', offsetX: '-4', offsetY: '2', reverse: false });
  document.references.push(face);
  document.features.push(base, snapFit);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.equal(prepared.lengthValue, 24);
  assert.equal(prepared.widthValue, 8);
  assert.equal(prepared.thicknessValue, 2);
  assert.equal(prepared.clearanceValue, 1.5);
  assert.equal(prepared.hookLengthValue, 5);
  assert.equal(prepared.hookHeightValue, 3);
  assert.equal(prepared.offsetXValue, -4);
  assert.equal(prepared.offsetYValue, 2);
  assert.equal(prepared.topologyReferences[0].id, face.id);
  const graph = buildDependencyGraph(document);
  assert.ok(graph.edges.some((edge) => edge.from === bodyId && edge.to === snapFit.id && edge.kind === 'modifies'));
  assert.ok(graph.affectedBy(document.parameters[0].id).includes(snapFit.id));

  const invalid = structuredClone(document);
  invalid.features[1].hookLength = '24';
  assert.throws(() => prepareDocument(invalid), /krótszy/);
});

test('Extrude To Object kończy się dokładnie na równoległej płaszczyźnie konstrukcyjnej', () => {
  const document = createDocument('Extrude To Object');
  document.parameters.push(createParameter('cel', '12'));
  const profile = createRectangleProfile({ width: 20, height: 10 });
  const sketch = createSketch({ plane: 'XY', planeOffset: '2', profiles: [profile] });
  const target = createOffsetPlane({ name: 'Koniec', basePlane: 'XY', offset: 'cel' });
  const feature = createFeature('extrude', { sketchId: sketch.id, profileIds: [profile.id], distance: '1', startOffset: '1', extent: 'to-object', targetReferenceId: target.id, operation: 'new' });
  document.sketches.push(sketch);
  document.references.push(target);
  document.features.push(feature);

  const prepared = prepareDocument(document);
  assert.equal(prepared.features[0].distanceValue, 9);
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === target.id && edge.to === feature.id && edge.kind === 'to-object'));

  const angled = structuredClone(document);
  angled.references[0] = createAnglePlane({ name: 'Ukośna', basePlane: 'XY', angle: '30', offset: '12' });
  angled.features[0].targetReferenceId = angled.references[0].id;
  assert.throws(() => prepareDocument(angled), /musi być równoległa/);

  const broken = structuredClone(document);
  broken.features[0].targetReferenceId = 'missing-plane';
  assert.ok(validateDocument(broken).issues.some((issue) => issue.path.endsWith('.targetReferenceId') && issue.code === 'BROKEN_REFERENCE'));

  const faceDocument = structuredClone(document);
  const face = createTopologyReference({ selection: { kind: 'face', id: 'face-top', bodyId: 'body-previous' }, descriptor: { geometry: 'PLANE', center: [0, 0, 10], normal: [0, 0, 1] }, label: 'Górna ściana' });
  faceDocument.references = [face];
  faceDocument.features[0].targetReferenceId = face.id;
  assert.equal(prepareDocument(faceDocument).features[0].distanceValue, 7);
  assert.equal(validateDocument(faceDocument).valid, true);

  const curvedFace = structuredClone(faceDocument);
  curvedFace.references[0].descriptor.geometry = 'CYLINDRE';
  assert.ok(validateDocument(curvedFace).issues.some((issue) => issue.path.endsWith('.targetReferenceId') && issue.code === 'UNSUPPORTED'));
});

test('Revolve przygotowuje zamknięty profil dla osi bazowej i konstrukcyjnej', () => {
  const document = createDocument('Revolve');
  const profile = createRectangleProfile({ x: 5, y: -2, width: 5, height: 4 });
  const sketch = createSketch({ name: 'Przekrój obrotowy', plane: 'XY', profiles: [profile] });
  const axis = createTwoPointAxis({ name: 'Oś Y', points: [[0, -10, 0], [0, 10, 0]] });
  const revolve = createFeature('revolve', { sketchId: sketch.id, profileIds: [profile.id], axisId: axis.id, angle: '360', operation: 'new' });
  document.sketches.push(sketch);
  document.references.push(axis);
  document.features.push(revolve);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[0];
  assert.deepEqual(prepared.axis, { origin: [0, -10, 0], direction: [0, 1, 0] });
  assert.equal(prepared.angleValue, 360);
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === axis.id && edge.to === revolve.id && edge.kind === 'revolve-axis'));

  const baseAxis = structuredClone(document);
  baseAxis.features[0].axisId = 'Y_AXIS';
  assert.equal(prepareDocument(baseAxis).features[0].axis.direction[1], 1);
  const perpendicular = structuredClone(document);
  perpendicular.features[0].axisId = 'Z_AXIS';
  assert.throws(() => prepareDocument(perpendicular), /płaszczyźnie szkicu/);
});

test('Sweep przygotowuje profil i ciągłą ścieżkę osobnego szkicu', () => {
  const document = createDocument('Sweep');
  const profile = createCircleProfile({ diameter: 4, x: 0, y: 0 });
  const profileSketch = createSketch({ name: 'Profil Sweep', plane: 'YZ', profiles: [profile] });
  const first = createSketchPoint({ x: 0, y: 0 });
  const second = createSketchPoint({ x: 20, y: 0 });
  const line = createSketchLine({ startPointId: first.id, endPointId: second.id });
  const pathSketch = createSketch({ name: 'Ścieżka Sweep', plane: 'XY', entities: [first, second, line] });
  const sweep = createFeature('sweep', { sketchId: profileSketch.id, profileIds: [profile.id], pathSketchId: pathSketch.id, pathEntityIds: [line.id], operation: 'new' });
  document.sketches.push(profileSketch, pathSketch);
  document.features.push(sweep);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[0];
  assert.equal(prepared.profile.geometry.diameter, 4);
  assert.deepEqual(prepared.path.geometry.points, [[0, 0], [20, 0]]);
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === line.id && edge.to === sweep.id && edge.kind === 'sweep-path'));

  const disconnected = structuredClone(document);
  const third = createSketchPoint({ x: 30, y: 10 });
  const fourth = createSketchPoint({ x: 40, y: 10 });
  const extra = createSketchLine({ startPointId: third.id, endPointId: fourth.id });
  disconnected.sketches[1].entities.push(third, fourth, extra);
  disconnected.features[0].pathEntityIds.push(extra.id);
  assert.throws(() => prepareDocument(disconnected), /jednego ciągłego łańcucha/);
});

test('Loft przygotowuje uporządkowane profile z osobnych równoległych szkiców', () => {
  const document = createDocument('Loft');
  const bottom = createCircleProfile({ diameter: 8, x: 0, y: 0 });
  const top = createCircleProfile({ diameter: 4, x: 1, y: 0 });
  const bottomSketch = createSketch({ name: 'Dolny profil Loft', plane: 'XY', planeOffset: '0', profiles: [bottom] });
  const topSketch = createSketch({ name: 'Górny profil Loft', plane: 'XY', planeOffset: '10', profiles: [top] });
  const loft = createFeature('loft', { sketchId: topSketch.id, sketchIds: [topSketch.id, bottomSketch.id], profileIds: [top.id, bottom.id], loftMode: 'smooth', operation: 'new' });
  document.sketches.push(bottomSketch, topSketch);
  document.features.push(loft);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[0];
  assert.deepEqual(prepared.profiles.map((profile) => profile.planeOffset), [0, 10]);
  assert.deepEqual(prepared.profiles.map((profile) => profile.geometry.diameter), [8, 4]);
  assert.equal(prepared.loftMode, 'smooth');
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === bottomSketch.id && edge.to === loft.id && edge.kind === 'loft-section-sketch'));

  const coincident = structuredClone(document);
  coincident.sketches[1].planeOffset = '0';
  assert.throws(() => prepareDocument(coincident), /różnych płaszczyznach/);
  const perpendicular = structuredClone(document);
  perpendicular.sketches[1].plane = 'YZ';
  assert.throws(() => prepareDocument(perpendicular), /równoległych płaszczyznach/);
});

test('Thin Extrude przygotowuje parametryczną grubość wewnętrzną, zewnętrzną i symetryczną', () => {
  for (const wallSide of ['inside', 'outside', 'symmetric']) {
    const document = createDocument(`Thin Extrude ${wallSide}`);
    document.parameters.push(createParameter('scianka', '2'));
    const profile = createRectangleProfile({ width: 20, height: 10 });
    const sketch = createSketch({ profiles: [profile] });
    const feature = createFeature('extrude', { sketchId: sketch.id, profileIds: [profile.id], distance: '8', operation: 'new', thin: true, wallThickness: 'scianka', wallSide });
    document.sketches.push(sketch);
    document.features.push(feature);
    const prepared = prepareDocument(document).features[0];
    assert.equal(prepared.wallThicknessValue, 2);
    assert.equal(prepared.wallSide, wallSide);
    assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === document.parameters[0].id && edge.to === feature.id && edge.kind === 'drives'));
  }

  const invalid = createDocument('Niepoprawny Thin Extrude');
  const profile = createRectangleProfile({ width: 20, height: 10 });
  const sketch = createSketch({ profiles: [profile] });
  invalid.sketches.push(sketch);
  invalid.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: [profile.id], distance: '8', operation: 'new', thin: true, wallThickness: '2', wallSide: 'left' }));
  assert.ok(validateDocument(invalid).issues.some((issue) => issue.path.endsWith('.wallSide')));
});

test('Thin Extrude porządkuje otwarty łańcuch linii i waliduje zakończenia', () => {
  const document = createDocument('Otwarty Thin Extrude');
  const first = createSketchPoint({ x: '0', y: '0' });
  const corner = createSketchPoint({ x: '20', y: '0' });
  const last = createSketchPoint({ x: '20', y: '10' });
  const horizontal = createSketchLine({ startPointId: first.id, endPointId: corner.id });
  const vertical = createSketchLine({ startPointId: corner.id, endPointId: last.id });
  const sketch = createSketch({ entities: [first, corner, last, horizontal, vertical] });
  const feature = createFeature('extrude', { sketchId: sketch.id, profileIds: [], openEntityIds: [vertical.id, horizontal.id], distance: '8', operation: 'new', thin: true, wallThickness: '2', wallSide: 'symmetric', endCap: 'square' });
  document.sketches.push(sketch);
  document.features.push(feature);

  const prepared = prepareDocument(document).features[0];
  assert.equal(prepared.profiles[0].type, 'open');
  assert.deepEqual(prepared.profiles[0].geometry.points, [[0, 0], [20, 0], [20, 10]]);
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === horizontal.id && edge.to === feature.id && edge.kind === 'references-open-chain'));

  const branched = structuredClone(document);
  const branchEnd = createSketchPoint({ x: '20', y: '-10' });
  const branch = createSketchLine({ startPointId: corner.id, endPointId: branchEnd.id });
  branched.sketches[0].entities.push(branchEnd, branch);
  branched.features[0].openEntityIds.push(branch.id);
  assert.throws(() => prepareDocument(branched), /nie może mieć rozgałęzień/);

  const invalidCap = structuredClone(document);
  invalidCap.features[0].endCap = 'round';
  assert.ok(validateDocument(invalidCap).issues.some((issue) => issue.path.endsWith('.endCap')));
});

test('Rib/Web przygotowuje parametryczne wzmocnienie z otwartego łańcucha', () => {
  const document = createDocument('Rib Web');
  const base = createFeature('primitive', { primitiveType: 'box', x: '-10', y: '-10', z: '0', width: '20', depth: '20', height: '5' });
  const first = createSketchPoint({ x: -8, y: 0 });
  const second = createSketchPoint({ x: 8, y: 0 });
  const line = createSketchLine({ startPointId: first.id, endPointId: second.id });
  const sketch = createSketch({ name: 'Profil Rib Web', plane: 'XY', planeOffset: '5', entities: [first, second, line] });
  const rib = createFeature('rib', { sketchId: sketch.id, openEntityIds: [line.id], targetBodyId: `body-${base.id}`, ribMode: 'web', thickness: '2', depth: '5', wallSide: 'symmetric', reverse: false });
  document.sketches.push(sketch);
  document.features.push(base, rib);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.equal(prepared.ribMode, 'web');
  assert.equal(prepared.thicknessValue, 2);
  assert.equal(prepared.depthValue, 5);
  assert.deepEqual(prepared.profile.geometry.points, [[-8, 0], [8, 0]]);
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === line.id && edge.to === rib.id && edge.kind === 'references-open-chain'));

  const ribMode = structuredClone(document);
  ribMode.features[1].ribMode = 'rib';
  assert.equal(prepareDocument(ribMode).features[1].ribMode, 'rib');
  const disconnected = structuredClone(document);
  const third = createSketchPoint({ x: 20, y: 5 });
  const fourth = createSketchPoint({ x: 25, y: 5 });
  const extra = createSketchLine({ startPointId: third.id, endPointId: fourth.id });
  disconnected.sketches[0].entities.push(third, fourth, extra);
  disconnected.features[1].openEntityIds.push(extra.id);
  assert.throws(() => prepareDocument(disconnected), /ciągłego łańcucha/);
});

test('Coil przygotowuje parametryczną helisę na osi bazowej lub konstrukcyjnej', () => {
  const document = createDocument('Coil');
  const diameter = createParameter('srednicaSpirali', '12', 'mm');
  const axis = createTwoPointAxis({ points: [[2, 3, 0], [2, 3, 20]] });
  const coil = createFeature('coil', { axisId: axis.id, coilDiameter: 'srednicaSpirali', wireDiameter: '2', pitch: '4', turns: '3.5', handedness: 'left', operation: 'new' });
  document.parameters.push(diameter);
  document.references.push(axis);
  document.features.push(coil);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[0];
  assert.equal(prepared.coilDiameterValue, 12);
  assert.equal(prepared.wireDiameterValue, 2);
  assert.equal(prepared.pitchValue, 4);
  assert.equal(prepared.turnsValue, 3.5);
  assert.equal(prepared.heightValue, 14);
  assert.equal(prepared.handedness, 'left');
  assert.deepEqual(prepared.axis, { origin: [2, 3, 0], direction: [0, 0, 1] });
  const graph = buildDependencyGraph(document);
  assert.equal(graph.producerOfBody(`body-${coil.id}`), coil.id);
  assert.ok(graph.edges.some((edge) => edge.from === axis.id && edge.to === coil.id && edge.kind === 'coil-axis'));
  assert.ok(graph.edges.some((edge) => edge.from === diameter.id && edge.to === coil.id && edge.kind === 'drives'));

  const overlapping = structuredClone(document);
  overlapping.features[0].pitch = '1';
  assert.throws(() => prepareDocument(overlapping), /nie może być mniejszy/);
  const excessive = structuredClone(document);
  excessive.features[0].turns = '201';
  assert.throws(() => prepareDocument(excessive), /0–200/);
});

test('Pipe przygotowuje pusty przekrój rurowy na ciągłej ścieżce', () => {
  const document = createDocument('Pipe');
  const first = createSketchPoint({ x: 0, y: 0 });
  const corner = createSketchPoint({ x: 20, y: 0 });
  const last = createSketchPoint({ x: 20, y: 10 });
  const horizontal = createSketchLine({ startPointId: first.id, endPointId: corner.id });
  const vertical = createSketchLine({ startPointId: corner.id, endPointId: last.id });
  const sketch = createSketch({ entities: [first, corner, last, horizontal, vertical] });
  const pipe = createFeature('pipe', { pathSketchId: sketch.id, pathEntityIds: [vertical.id, horizontal.id], outsideDiameter: '6', wallThickness: '1', operation: 'new' });
  document.sketches.push(sketch);
  document.features.push(pipe);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[0];
  assert.deepEqual(prepared.path.geometry.points, [[0, 0], [20, 0], [20, 10]]);
  assert.equal(prepared.outsideDiameterValue, 6);
  assert.equal(prepared.wallThicknessValue, 1);
  assert.equal(prepared.insideDiameterValue, 4);
  const graph = buildDependencyGraph(document);
  assert.equal(graph.producerOfBody(`body-${pipe.id}`), pipe.id);
  assert.ok(graph.edges.some((edge) => edge.from === horizontal.id && edge.to === pipe.id && edge.kind === 'pipe-path'));

  const solid = structuredClone(document);
  solid.features[0].wallThickness = '3';
  assert.throws(() => prepareDocument(solid), /Podwójna grubość/);
});

test('Pattern bryły przygotowuje tryb prostokątny, kołowy i po ścieżce', () => {
  const document = createDocument('Pattern');
  const box = createFeature('primitive', { primitiveType: 'box', x: '5', y: '0', z: '0', width: '2', depth: '2', height: '2' });
  const rectangular = createFeature('pattern', { targetBodyId: `body-${box.id}`, patternType: 'rectangular', countX: '3', countY: '2', spacingX: '10', spacingY: '8' });
  document.features.push(box, rectangular);
  let prepared = prepareDocument(document).features[1];
  assert.equal(prepared.countXValue, 3);
  assert.equal(prepared.countYValue, 2);
  assert.equal(prepared.spacingXValue, 10);

  const circular = structuredClone(document);
  Object.assign(circular.features[1], { patternType: 'circular', axisId: 'Z_AXIS', occurrences: '4', totalAngle: '360' });
  prepared = prepareDocument(circular).features[1];
  assert.equal(prepared.occurrencesValue, 4);
  assert.deepEqual(prepared.axis.direction, [0, 0, 1]);

  const first = createSketchPoint({ x: 0, y: 0 });
  const second = createSketchPoint({ x: 30, y: 0 });
  const line = createSketchLine({ startPointId: first.id, endPointId: second.id });
  const sketch = createSketch({ entities: [first, second, line] });
  const path = structuredClone(document);
  path.sketches.push(sketch);
  Object.assign(path.features[1], { patternType: 'path', pathSketchId: sketch.id, pathEntityIds: [line.id], occurrences: '4' });
  prepared = prepareDocument(path).features[1];
  assert.equal(prepared.occurrencesValue, 4);
  assert.deepEqual(prepared.path.geometry.points, [[0, 0], [30, 0]]);
  assert.ok(buildDependencyGraph(path).edges.some((edge) => edge.from === line.id && edge.to === rectangular.id));

  const excessive = structuredClone(document);
  excessive.features[1].countX = '101';
  assert.throws(() => prepareDocument(excessive), /1–100/);
});

test('Boolean wymaga dwóch brył, konsumuje narzędzie i zapisuje zależności Union/Subtract/Intersect', () => {
  for (const operation of ['union', 'subtract', 'intersect']) {
    const document = createDocument(`Boolean ${operation}`);
    const firstProfile = createRectangleProfile({ width: 20, height: 10 });
    const secondProfile = createCircleProfile({ diameter: 8 });
    const firstSketch = createSketch({ profiles: [firstProfile] });
    const secondSketch = createSketch({ profiles: [secondProfile] });
    const first = createFeature('extrude', { sketchId: firstSketch.id, profileIds: [firstProfile.id], distance: '8', operation: 'new' });
    const second = createFeature('extrude', { sketchId: secondSketch.id, profileIds: [secondProfile.id], distance: '8', operation: 'new' });
    const boolean = createFeature('boolean', { operation, targetBodyId: `body-${first.id}`, toolBodyId: `body-${second.id}` });
    document.sketches.push(firstSketch, secondSketch);
    document.features.push(first, second, boolean);
    assert.equal(validateDocument(document).valid, true);
    assert.equal(prepareDocument(document).features[2].operation, operation);
    const edges = buildDependencyGraph(document).edges;
    assert.ok(edges.some((edge) => edge.from === boolean.targetBodyId && edge.to === boolean.id && edge.kind === 'modifies'));
    assert.ok(edges.some((edge) => edge.from === boolean.toolBodyId && edge.to === boolean.id && edge.kind === 'consumes'));
  }

  const broken = createDocument('Boolean uszkodzony');
  broken.features.push(createFeature('boolean', { operation: 'union', targetBodyId: 'body-a', toolBodyId: 'body-a' }));
  assert.ok(validateDocument(broken).issues.some((issue) => issue.path.endsWith('.toolBodyId')));
});

test('Shell wymaga wskazanej ściany i przygotowuje parametryczną grubość dla kernela', () => {
  const document = createDocument('Shell');
  const profile = createRectangleProfile({ width: 20, height: 10 });
  const sketch = createSketch({ profiles: [profile] });
  const base = createFeature('extrude', { sketchId: sketch.id, profileIds: [profile.id], distance: '8', operation: 'new' });
  const faceReference = {
    ...createTopologyReference({
      selection: { kind: 'face', id: 'face-top', bodyId: `body-${base.id}`, sourceFeatureId: base.id },
      descriptor: { geometry: 'PLANE', center: [0, 0, 8], normal: [0, 0, 1], orientation: 'forward' },
      label: 'Shell — usuwana ściana 1',
    }),
    scope: 'feature-input',
  };
  const shell = createFeature('shell', { targetBodyId: `body-${base.id}`, referenceIds: [faceReference.id], thickness: '1.5' });
  document.sketches.push(sketch);
  document.references.push(faceReference);
  document.features.push(base, shell);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.equal(prepared.thicknessValue, 1.5);
  assert.equal(prepared.topologyReferences[0].id, faceReference.id);
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === faceReference.id && edge.to === shell.id && edge.kind === 'references-topology'));

  const missingFace = structuredClone(document);
  missingFace.features[1].referenceIds = [];
  assert.ok(validateDocument(missingFace).issues.some((issue) => issue.path.endsWith('.referenceIds') && issue.code === 'REQUIRED'));
});

test('Draft przygotowuje wskazane ściany, kąt i parametryczną płaszczyznę neutralną', () => {
  const document = createDocument('Draft');
  const angle = createParameter('katDraft', '4', 'deg');
  const box = createFeature('primitive', { primitiveType: 'box', x: '0', y: '0', z: '0', width: '20', depth: '10', height: '12' });
  const bodyId = `body-${box.id}`;
  const faceReference = {
    ...createTopologyReference({ selection: { kind: 'face', id: 'side', bodyId }, descriptor: { geometry: 'PLANE', center: [20, 5, 6], normal: [1, 0, 0] }, label: 'Draft — ściana 1' }),
    scope: 'feature-input',
  };
  const neutralPlane = createOffsetPlane({ name: 'Neutralna', basePlane: 'XY', offset: '2' });
  const draft = createFeature('draft', { targetBodyId: bodyId, referenceIds: [faceReference.id], neutralPlaneId: neutralPlane.id, angle: 'katDraft' });
  document.parameters.push(angle);
  document.references.push(faceReference, neutralPlane);
  document.features.push(box, draft);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.equal(prepared.angleValue, 4);
  assert.deepEqual(prepared.neutralPlane, { origin: [0, 0, 2], normal: [0, 0, 1] });
  assert.equal(prepared.topologyReferences[0].id, faceReference.id);
  const graph = buildDependencyGraph(document);
  assert.ok(graph.edges.some((edge) => edge.from === faceReference.id && edge.to === draft.id && edge.kind === 'references-topology'));
  assert.ok(graph.edges.some((edge) => edge.from === neutralPlane.id && edge.to === draft.id && edge.kind === 'neutral-plane'));
  assert.ok(graph.edges.some((edge) => edge.from === angle.id && edge.to === draft.id && edge.kind === 'drives'));

  const zeroAngle = structuredClone(document);
  zeroAngle.features[1].angle = '0';
  assert.throws(() => prepareDocument(zeroAngle), /różny od zera/);
  const missingPlane = structuredClone(document);
  missingPlane.features[1].neutralPlaneId = 'missing-plane';
  assert.ok(validateDocument(missingPlane).issues.some((issue) => issue.path.endsWith('.neutralPlaneId')));
});

test('Split Body przygotowuje płaszczyznę konstrukcyjną i produkuje drugą trwałą bryłę', () => {
  const document = createDocument('Split Body');
  const box = createFeature('primitive', { primitiveType: 'box', x: '-10', y: '-8', z: '-6', width: '20', depth: '16', height: '12' });
  const plane = createOffsetPlane({ name: 'Podział parametryczny', basePlane: 'XY', offset: '2' });
  const split = createFeature('splitBody', { targetBodyId: `body-${box.id}`, planeId: plane.id });
  document.references.push(plane);
  document.features.push(box, split);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.deepEqual(prepared.splitPlane, { origin: [0, 0, 2], normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] });
  const graph = buildDependencyGraph(document);
  assert.equal(graph.producerOfBody(`body-${split.id}`), split.id);
  assert.ok(graph.edges.some((edge) => edge.from === plane.id && edge.to === split.id && edge.kind === 'split-plane'));
  assert.ok(graph.edges.some((edge) => edge.from === `body-${box.id}` && edge.to === split.id && edge.kind === 'modifies'));

  const missingPlane = structuredClone(document);
  missingPlane.features[1].planeId = 'missing-plane';
  assert.ok(validateDocument(missingPlane).issues.some((issue) => issue.path.endsWith('.planeId') && issue.code === 'BROKEN_REFERENCE'));
});

test('Split Face wiąże profil szkicu z trwałą referencją planarnej ściany', () => {
  const document = createDocument('Split Face');
  const box = createFeature('primitive', { primitiveType: 'box', x: '-10', y: '-10', z: '0', width: '20', depth: '20', height: '10' });
  const bodyId = `body-${box.id}`;
  const support = createTopologyReference({ selection: { kind: 'face', id: 'top', bodyId, sourceFeatureId: box.id }, descriptor: { geometry: 'PLANE', center: [0, 0, 10], normal: [0, 0, 1], area: 400 }, label: 'Górna ściana' });
  const profile = createCircleProfile({ name: 'Region', diameter: '8', x: '0', y: '0' });
  const sketch = createSketch({ name: 'Profil podziału', plane: 'XY', planeOffset: '10', support: { kind: 'face', referenceId: support.id }, profiles: [profile] });
  const split = createFeature('splitFace', { targetBodyId: bodyId, sketchId: sketch.id, profileId: profile.id, referenceIds: [support.id] });
  document.references.push(support);
  document.sketches.push(sketch);
  document.features.push(box, split);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.equal(prepared.profile.geometry.diameter, 8);
  assert.equal(prepared.profile.planeOffset, 10);
  assert.equal(prepared.topologyReferences[0].id, support.id);
  const graph = buildDependencyGraph(document);
  assert.ok(graph.edges.some((edge) => edge.from === profile.id && edge.to === split.id && edge.kind === 'references'));
  assert.ok(graph.edges.some((edge) => edge.from === support.id && edge.to === split.id && edge.kind === 'references-topology'));

  const mismatched = structuredClone(document);
  mismatched.features[1].referenceIds = ['missing-face'];
  assert.ok(validateDocument(mismatched).issues.some((issue) => issue.path.includes('.referenceIds')));
});

test('Delete Face + Heal zachowuje trwałe referencje regionów tej samej bryły', () => {
  const document = createDocument('Delete Face + Heal');
  const box = createFeature('primitive', { primitiveType: 'box', x: '-10', y: '-10', z: '0', width: '20', depth: '20', height: '10' });
  const bodyId = `body-${box.id}`;
  const region = { ...createTopologyReference({ selection: { kind: 'face', id: 'split-region', bodyId, sourceFeatureId: box.id }, descriptor: { geometry: 'PLANE', center: [0, 0, 10], normal: [0, 0, 1], area: Math.PI * 4 ** 2 }, label: 'Region do scalenia' }), scope: 'feature-input' };
  const heal = createFeature('deleteFace', { targetBodyId: bodyId, referenceIds: [region.id] });
  document.references.push(region);
  document.features.push(box, heal);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.equal(prepared.topologyReferences[0].id, region.id);
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === region.id && edge.to === heal.id && edge.kind === 'references-topology'));

  const foreignBody = structuredClone(document);
  foreignBody.features[1].targetBodyId = 'body-foreign';
  assert.ok(validateDocument(foreignBody).issues.some((issue) => issue.path.endsWith('.targetBodyId')));
});

test('Replace Face wiąże planarną ścianę z powierzchnią docelową innej bryły', () => {
  const document = createDocument('Replace Face');
  const source = createFeature('primitive', { primitiveType: 'box', width: '10', depth: '10', height: '10' });
  const destination = createFeature('primitive', { primitiveType: 'box', x: '20', z: '15', width: '10', depth: '10', height: '2' });
  const sourceBodyId = `body-${source.id}`;
  const destinationBodyId = `body-${destination.id}`;
  const sourceFace = { ...createTopologyReference({ selection: { kind: 'face', id: 'source-top', bodyId: sourceBodyId, sourceFeatureId: source.id }, descriptor: { geometry: 'PLANE', center: [5, 5, 10], normal: [0, 0, 1] }, label: 'Ściana zastępowana' }), scope: 'feature-input' };
  const destinationFace = { ...createTopologyReference({ selection: { kind: 'face', id: 'destination-bottom', bodyId: destinationBodyId, sourceFeatureId: destination.id }, descriptor: { geometry: 'PLANE', center: [25, 5, 15], normal: [0, 0, -1] }, label: 'Powierzchnia docelowa' }), scope: 'feature-input' };
  const replace = createFeature('replaceFace', { targetBodyId: sourceBodyId, referenceIds: [sourceFace.id, destinationFace.id] });
  document.references.push(sourceFace, destinationFace);
  document.features.push(source, destination, replace);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[2];
  assert.deepEqual(prepared.topologyReferences.map((reference) => reference.id), [sourceFace.id, destinationFace.id]);
  assert.ok(buildDependencyGraph(document).edges.some((edge) => edge.from === destinationFace.id && edge.to === replace.id && edge.kind === 'references-topology'));

  const sameBody = structuredClone(document);
  const replacementReference = sameBody.references.find((reference) => reference.id === destinationFace.id);
  replacementReference.bodyId = sourceBodyId;
  assert.ok(validateDocument(sameBody).issues.some((issue) => issue.path.endsWith('.referenceIds[1]')));
});

test('Box, Cylinder, Sphere i Torus przygotowują parametryczne bryły oraz osobne ciała', () => {
  const document = createDocument('Prymitywy');
  const primitives = [
    createFeature('primitive', { primitiveType: 'box', x: '1', y: '2', z: '3', width: '10', depth: '12', height: '14' }),
    createFeature('primitive', { primitiveType: 'cylinder', x: '20', y: '0', z: '0', radius: '5', height: '10' }),
    createFeature('primitive', { primitiveType: 'sphere', x: '40', y: '0', z: '0', radius: '6' }),
    createFeature('primitive', { primitiveType: 'torus', x: '60', y: '0', z: '0', majorRadius: '12', minorRadius: '3' }),
  ];
  document.features.push(...primitives);
  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features;
  assert.deepEqual(prepared[0].position, [1, 2, 3]);
  assert.deepEqual([prepared[0].widthValue, prepared[0].depthValue, prepared[0].heightValue], [10, 12, 14]);
  assert.deepEqual([prepared[1].radiusValue, prepared[1].heightValue], [5, 10]);
  assert.equal(prepared[2].radiusValue, 6);
  assert.deepEqual([prepared[3].majorRadiusValue, prepared[3].minorRadiusValue], [12, 3]);
  const graph = buildDependencyGraph(document);
  assert.equal(primitives.every((feature) => graph.producerOfBody(`body-${feature.id}`) === feature.id), true);
});

test('Text tworzy przenośny profil i obsługuje Extrude, Emboss oraz Deboss', () => {
  const profile = createTextProfile('MĄD-1', 7, 2, 3);
  assert.ok(profile.rectangles.length > 0);
  assert.ok(profile.area > 0);
  assert.deepEqual([profile.width, profile.height], [29, 7]);
  assert.ok(profile.rectangles.every((rectangle) => rectangle.width > 0 && rectangle.height > 0));

  const document = createDocument('Tekst 3D');
  const base = createFeature('primitive', { primitiveType: 'box', x: '0', y: '0', z: '0', width: '40', depth: '20', height: '5' });
  const faceReference = createTopologyReference({ selection: { kind: 'face', id: 'top-face', bodyId: `body-${base.id}`, sourceFeatureId: base.id }, descriptor: { geometry: 'PLANE', center: [20, 10, 5], normal: [0, 0, 1], orientation: 'forward' }, label: 'Powierzchnia tekstu' });
  const newText = createFeature('textSolid', { text: 'HI', fontSize: '7', depth: '2', x: '2', y: '2', z: '8', operation: 'new' });
  const emboss = createFeature('textSolid', { text: 'A', fontSize: '7', depth: '2', x: '-10', y: '-5', z: '5', operation: 'emboss', placement: 'face', referenceIds: [faceReference.id], targetBodyId: `body-${base.id}` });
  const deboss = createFeature('textSolid', { text: 'B', fontSize: '7', depth: '2', x: '20', y: '2', z: '5', operation: 'deboss', targetBodyId: `body-${base.id}` });
  document.references.push(faceReference);
  document.features.push(base, newText, emboss, deboss);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features;
  assert.equal(prepared[1].profile.text, 'HI');
  assert.deepEqual(prepared[1].position, [2, 2, 8]);
  assert.equal(prepared[1].depthValue, 2);
  assert.equal(prepared[2].topologyReferences[0].id, faceReference.id);
  const graph = buildDependencyGraph(document);
  assert.equal(graph.producerOfBody(`body-${newText.id}`), newText.id);
  assert.ok(graph.edges.some((edge) => edge.from === `body-${base.id}` && edge.to === emboss.id && edge.kind === 'modifies'));

  const broken = structuredClone(document);
  broken.features[1].text = '   ';
  broken.features[2].operation = 'invalid';
  assert.ok(validateDocument(broken).issues.some((issue) => issue.path.endsWith('.text') && issue.code === 'REQUIRED'));
  assert.ok(validateDocument(broken).issues.some((issue) => issue.path.endsWith('.operation') && issue.code === 'UNSUPPORTED'));
});

test('wspólny manipulator ma parametryczne operacje Move, Rotate i Offset Face', () => {
  const document = createDocument('Manipulacja bezpośrednia');
  const box = createFeature('primitive', { primitiveType: 'box', x: '0', y: '0', z: '0', width: '10', depth: '12', height: '14' });
  const bodyId = `body-${box.id}`;
  const faceReference = {
    ...createTopologyReference({ selection: { kind: 'face', id: 'top', bodyId }, descriptor: { geometry: 'PLANE', center: [5, 6, 14], normal: [0, 0, 1] }, label: 'Offset Face — ściana' }),
    scope: 'feature-input',
  };
  const move = createFeature('transform', { targetBodyId: bodyId, mode: 'move', x: '5', y: '2', z: '-1', angle: '0', originX: '0', originY: '0', originZ: '0' });
  const rotate = createFeature('transform', { targetBodyId: bodyId, mode: 'rotate', x: '0', y: '0', z: '0', angle: '90', originX: '0', originY: '0', originZ: '0' });
  const offset = createFeature('offsetFace', { targetBodyId: bodyId, referenceIds: [faceReference.id], distance: '2' });
  document.references.push(faceReference);
  document.features.push(box, move, rotate, offset);
  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features;
  assert.deepEqual(prepared[1].translation, [5, 2, -1]);
  assert.equal(prepared[2].angleValue, 90);
  assert.equal(prepared[3].distanceValue, 2);
  assert.equal(prepared[3].topologyReferences[0].id, faceReference.id);
});

test('otwór na ścianie zachowuje parametryczne odległości od dwóch krawędzi', () => {
  const faceDescriptor = { geometry: 'PLANE', center: [20, 15, 10], normal: [0, 0, 1] };
  const firstEdgeDescriptor = { geometry: 'LINE', endpoints: [[0, 0, 10], [40, 0, 10]], length: 40 };
  const secondEdgeDescriptor = { geometry: 'LINE', endpoints: [[0, 0, 10], [0, 30, 10]], length: 30 };
  const placement = resolveFaceEdgeHolePlacement(faceDescriptor, firstEdgeDescriptor, secondEdgeDescriptor, 6, 8);
  assert.deepEqual(placement.position, [8, 6, 10]);
  assert.deepEqual(placement.direction, [0, 0, -1]);

  const document = createDocument('Otwór od krawędzi');
  const base = createFeature('primitive', { primitiveType: 'box', x: '0', y: '0', z: '0', width: '40', depth: '30', height: '10' });
  const bodyId = `body-${base.id}`;
  const selections = [
    { kind: 'face', id: 'top-face', bodyId },
    { kind: 'edge', id: 'bottom-edge', bodyId },
    { kind: 'edge', id: 'left-edge', bodyId },
  ];
  const references = [faceDescriptor, firstEdgeDescriptor, secondEdgeDescriptor].map((descriptor, index) => ({
    ...createTopologyReference({ selection: selections[index], descriptor, label: `Pozycjonowanie otworu ${index + 1}` }),
    scope: 'feature-input',
  }));
  const hole = createFeature('hole', {
    placement: 'face-edges', targetBodyId: bodyId, referenceIds: references.map((reference) => reference.id),
    firstOffset: '6', secondOffset: '8', holeType: 'counterbore', extent: 'through-all', diameter: '5', depth: '10', counterboreDiameter: '9', counterboreDepth: '3', threadMode: 'cosmetic', threadDiameter: '6', threadPitch: '1', threadLength: '8', threadDirection: 'right', clearanceProfile: 'fff', clearance: '0.2',
  });
  document.references.push(...references);
  document.features.push(base, hole);

  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features[1];
  assert.deepEqual([prepared.firstOffsetValue, prepared.secondOffsetValue, prepared.diameterValue, prepared.depthValue], [6, 8, 5, 1_000_000]);
  assert.deepEqual([prepared.holeType, prepared.extent, prepared.counterboreDiameterValue, prepared.counterboreDepthValue], ['counterbore', 'through-all', 9, 3]);
  assert.deepEqual([prepared.threadMode, prepared.threadDiameterValue, prepared.threadPitchValue, prepared.threadLengthValue], ['cosmetic', 6, 1, 8]);
  assert.deepEqual([prepared.diameter, prepared.diameterValue, prepared.effectiveDiameterValue, prepared.clearanceProfile, prepared.clearanceValue], ['5', 5, 5.4, 'fff', 0.2]);
  assert.deepEqual(prepared.topologyReferences.map((reference) => reference.id), references.map((reference) => reference.id));
  assert.equal(buildDependencyGraph(document).edges.filter((edge) => edge.to === hole.id && edge.kind === 'references-topology').length, 3);
  assert.throws(() => resolveFaceEdgeHolePlacement(faceDescriptor, firstEdgeDescriptor, { ...secondEdgeDescriptor, endpoints: [[1, 1, 10], [1, 20, 10]] }, 6, 8), /wspólny narożnik/);

  const countersinkDocument = structuredClone(document);
  Object.assign(countersinkDocument.features[1], { holeType: 'countersink', extent: 'distance', depth: '10', countersinkDiameter: '10', countersinkAngle: '90', threadMode: 'modeled', threadDirection: 'left' });
  const countersink = prepareDocument(countersinkDocument).features[1];
  assert.deepEqual([countersink.countersinkDiameterValue, countersink.countersinkAngleValue, countersink.depthValue], [10, 90, 10]);
  assert.deepEqual([countersink.threadMode, countersink.threadDiameterValue, countersink.threadPitchValue, countersink.threadLengthValue, countersink.threadDirection], ['modeled', 6, 1, 8, 'left']);
});

test('standardowy otwór ISO zachowuje rozmiar, pasowanie i klasę gwintu po round-trip', () => {
  const document = createStarterDocument();
  const hole = document.features.find((feature) => feature.type === 'hole');
  Object.assign(hole, {
    ...applyHoleStandard({ threadMode: 'none', threadClass: '6H' }, 'tapped', 'M8', 1.25),
    threadLength: '8',
    threadDirection: 'right',
  });
  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features.find((feature) => feature.id === hole.id);
  assert.deepEqual([prepared.diameterValue, prepared.threadDiameterValue, prepared.threadPitchValue, prepared.threadClass, prepared.threadDesignation], [6.75, 8, 1.25, '6H', 'M8×1.25']);

  const reopened = openDocument(JSON.parse(JSON.stringify(document))).document;
  assert.deepEqual(
    ['holeStandard', 'holeApplication', 'standardSize', 'threadClass', 'threadDesignation'].map((key) => reopened.features.find((feature) => feature.id === hole.id)[key]),
    ['iso-metric', 'tapped', 'M8', '6H', 'M8×1.25'],
  );

  Object.assign(hole, applyHoleStandard(hole, 'clearance-medium', 'M10'));
  assert.equal(prepareDocument(document).features.find((feature) => feature.id === hole.id).diameterValue, 11);
});

test('stożkowy gwint NPT zachowuje geometrię 1:16, kontrolę i tolerancję produkcyjną po round-trip', () => {
  const document = createStarterDocument();
  const hole = document.features.find((feature) => feature.type === 'hole');
  Object.assign(hole, {
    ...applyHoleStandard({ threadMode: 'modeled', pipePreparation: 'conical', diameterToleranceLower: '-0.05', diameterToleranceUpper: '0.1' }, 'npt-tapped', 'npt-1-8'),
    threadDirection: 'right',
  });
  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document).features.find((feature) => feature.id === hole.id);
  assert.deepEqual(
    [prepared.diameterValue, prepared.threadDiameterValue, prepared.threadPitchValue, prepared.threadTaperValue, prepared.diameterToleranceLowerValue, prepared.diameterToleranceUpperValue],
    [8.74, 10.24, 0.940741, 0.0625, -0.05, 0.1],
  );
  const reopenedHole = openDocument(JSON.parse(JSON.stringify(document))).document.features.find((feature) => feature.id === hole.id);
  assert.deepEqual(
    ['holeStandard', 'standardSize', 'pipePreparation', 'threadDesignation', 'threadInspection', 'diameterToleranceLower', 'diameterToleranceUpper'].map((key) => reopenedHole[key]),
    ['asme-b1.20.1', 'npt-1-8', 'conical', '1/8-27 NPT', 'sprawdzian ASME B1.20.1', '-0.05', '0.1'],
  );
});

test('Measure zwraca długość, odległość, kąt, promień, średnicę, pole i pozycję zaznaczenia', () => {
  const body = {
    id: 'body-a',
    metrics: { volume: 6000, area: 2200, centerOfMass: [5, 10, 15], dimensions: [10, 20, 30] },
    topology: {
      faces: [{ id: 'face-a', descriptor: { geometry: 'PLANE', area: 200, center: [5, 10, 0], centerOfMass: [5, 10, 0], normal: [0, 0, 1] } }],
      edges: [
        { id: 'circle-a', descriptor: { geometry: 'CIRCLE', length: 8 * Math.PI, center: [5, 5, 0], radius: 4, diameter: 8, endpoints: [[9, 5, 0], [9, 5, 0]] } },
        { id: 'line-x', descriptor: { geometry: 'LINE', length: 10, endpoints: [[0, 0, 0], [10, 0, 0]] } },
        { id: 'line-y', descriptor: { geometry: 'LINE', length: 10, endpoints: [[0, 5, 0], [0, 15, 0]] } },
      ],
      vertices: [
        { id: 'vertex-a', descriptor: { point: [0, 0, 5] } },
        { id: 'vertex-b', descriptor: { point: [3, 4, 5] } },
      ],
    },
  };

  assert.deepEqual(measureSelection([body], { kind: 'body', id: body.id }), {
    selectionCount: 1, kind: 'body', position: [5, 10, 15], volume: 6000, area: 2200, dimensions: [10, 20, 30],
  });
  assert.deepEqual(measureSelection([body], { kind: 'face', id: 'face-a', bodyId: body.id }), {
    selectionCount: 1, kind: 'face', position: [5, 10, 0], area: 200, normal: [0, 0, 1],
  });
  const circle = measureSelection([body], { kind: 'edge', id: 'circle-a', bodyId: body.id });
  assert.deepEqual([circle.length, circle.radius, circle.diameter, circle.position], [8 * Math.PI, 4, 8, [5, 5, 0]]);
  const vertices = measureSelection([body], { items: [{ kind: 'vertex', id: 'vertex-a', bodyId: body.id }, { kind: 'vertex', id: 'vertex-b', bodyId: body.id }] });
  assert.deepEqual([vertices.distance, vertices.delta], [5, [3, 4, 0]]);
  const lines = measureSelection([body], { items: [{ kind: 'edge', id: 'line-x', bodyId: body.id }, { kind: 'edge', id: 'line-y', bodyId: body.id }] });
  assert.equal(lines.angle, 90);
  const vertexToFace = measureSelection([body], { items: [{ kind: 'vertex', id: 'vertex-a', bodyId: body.id }, { kind: 'face', id: 'face-a', bodyId: body.id }] });
  assert.equal(vertexToFace.distance, 5);
});

test('właściwości masowe sumują bryły i ważą środek masy objętością', () => {
  const result = calculateMassProperties([
    { metrics: { volume: 1000, area: 600, centerOfMass: [0, 0, 0] } },
    { metrics: { volume: 3000, area: 1200, centerOfMass: [8, 4, 2] } },
  ], 1.24);
  assert.deepEqual(result, { bodyCount: 2, volume: 4000, area: 1800, density: 1.24, mass: 4.96, centerOfMass: [6, 3, 1.5] });
  assert.throws(() => calculateMassProperties([], 0), /Gęstość/);
});

test('analiza geometrii wybiera minimalny promień i zachowuje dokładne pary kolizji', () => {
  const result = summarizeGeometryInspection([
    { metrics: { minimumRadius: 5 } },
    { metrics: { minimumRadius: 3 } },
    { metrics: { minimumRadius: null } },
  ], { collisions: [{ firstBodyId: 'a', secondBodyId: 'b', volume: 12 }] });
  assert.deepEqual(result, {
    bodyCount: 3,
    minimumRadius: 3,
    collisions: [{ firstBodyId: 'a', secondBodyId: 'b', volume: 12 }],
    collisionStatus: 'not-run',
    skippedPairs: 0,
  });
  assert.equal(summarizeGeometryInspection([], { collisionStatus: 'partial', skippedPairs: 2 }).skippedPairs, 2);
  const draft = analyzeDraftAngles([{
    id: 'draft-body',
    triangles: Uint32Array.from([0, 1, 2]),
    normals: Float32Array.from([0, 0, 1, 1, 0, 0, 0, 0, -1]),
    faceGroups: [
      { topologyId: 'positive', start: 0, count: 1 },
      { topologyId: 'neutral', start: 1, count: 1 },
      { topologyId: 'negative', start: 2, count: 1 },
    ],
  }], { direction: DRAFT_DIRECTIONS['z-positive'], tolerance: 0.5 });
  assert.deepEqual(draft.faces.map((face) => face.classification), ['positive', 'neutral', 'negative']);
  assert.deepEqual(draft.counts, { positive: 1, neutral: 1, negative: 1, mixed: 0 });
  const thickness = analyzeWallThickness([{
    id: 'shell-body',
    topology: { faces: [
      { id: 'outer', descriptor: { geometry: 'PLANE', center: [0, 0, 2], normal: [0, 0, 1] } },
      { id: 'inner', descriptor: { geometry: 'PLANE', center: [0, 0, 0], normal: [0, 0, -1] } },
    ] },
    faceGroups: [{ topologyId: 'outer' }, { topologyId: 'inner' }],
  }], { target: 2, tolerance: 0.2 });
  assert.deepEqual(thickness.faces.map((face) => face.classification), ['nominal', 'nominal']);
  assert.equal(thickness.minimum, 2);
  assert.deepEqual(thickness.counts, { thin: 0, nominal: 2, thick: 0, unknown: 0 });
});

test('broad-phase kolizji odrzuca rozłączne AABB i zachowuje stykające się granice', () => {
  assert.equal(boundsOverlap([[0, 0, 0], [10, 10, 10]], [[20, 0, 0], [30, 10, 10]]), false);
  assert.equal(boundsOverlap([[0, 0, 0], [10, 10, 10]], [[10, 2, 2], [12, 8, 8]]), true);
  assert.equal(boundsOverlap(null, [[10, 2, 2], [12, 8, 8]]), true);
});

test('profile Bambu, Prusa i Creality ustawiają stół, a profil własny zachowuje wymiary', () => {
  assert.deepEqual(PRINTER_PROFILES.map((profile) => profile.id), ['bambu-x1-p1', 'prusa-mk4', 'creality-ender3']);
  assert.deepEqual(applyPrinterProfile({ material: 'PLA' }, 'prusa-mk4'), { material: 'PLA', profileId: 'prusa-mk4', bedWidth: 250, bedDepth: 210, bedHeight: 220 });
  assert.deepEqual(applyPrinterProfile({ material: 'PETG', bedWidth: 300, bedDepth: 300, bedHeight: 400 }, 'custom'), { material: 'PETG', profileId: 'custom', bedWidth: 300, bedDepth: 300, bedHeight: 400 });
});

test('Project tworzy zablokowany punkt, krawędź i zamkniętą pętlę z trwałymi linkami', () => {
  const document = createDocument('Project');
  const sketch = createSketch({ plane: 'XY', planeOffset: '8' });
  document.sketches.push(sketch);
  const vertex = { selection: { kind: 'vertex', id: 'vertex-a', bodyId: 'body-a' }, descriptor: { point: [2, 3, 8] } };
  const edges = [[[0, 0, 8], [10, 0, 8]], [[10, 0, 8], [10, 10, 8]], [[10, 10, 8], [0, 10, 8]], [[0, 10, 8], [0, 0, 8]]]
    .map((endpoints, index) => ({ selection: { kind: 'edge', id: `edge-${index}`, bodyId: 'body-a' }, descriptor: { endpoints } }));
  const result = projectTopologyToSketch(document, sketch.id, [vertex, ...edges]);
  assert.equal(result.createdReferenceIds.length, 5);
  assert.equal(sketch.entities.filter((entity) => entity.role === 'projected' && entity.fixed).length, 9);
  assert.equal(sketch.profiles.length, 1);
  assert.equal(validateDocument(document).valid, true);
  assert.equal(sketch.entities.every((entity) => entity.role !== 'projected' || entity.sourceReferenceId), true);
  assert.equal(sketch.entities.every((entity) => !entity.projectionReferenceId || document.references.some((reference) => reference.id === entity.projectionReferenceId)), true);

  const movedBody = {
    id: 'body-a',
    topology: {
      faces: [],
      vertices: [{ id: 'vertex-a', descriptor: { point: [4, 5, 8] } }],
      edges: edges.map((edge) => ({
        id: edge.selection.id,
        descriptor: { endpoints: edge.descriptor.endpoints.map(([x, y, z]) => [x + 1, y + 2, z]) },
      })),
    },
  };
  const synchronized = synchronizeProjectedGeometry(document, [movedBody]);
  const standalone = sketch.entities.find((entity) => entity.type === 'point' && entity.projectionReferenceId === result.createdReferenceIds[0]);
  const firstLine = sketch.entities.find((entity) => entity.type === 'line' && entity.projectionReferenceId === result.createdReferenceIds[1]);
  assert.deepEqual([standalone.geometry.x, standalone.geometry.y], ['4', '5']);
  assert.deepEqual(firstLine.pointIds.map((pointId) => {
    const point = sketch.entities.find((entity) => entity.id === pointId);
    return [point.geometry.x, point.geometry.y];
  }), [['1', '2'], ['11', '2']]);
  assert.ok(synchronized.updatedEntityIds.includes(firstLine.id));
  assert.equal(sketch.profiles.length, 1);

  movedBody.topology.edges.pop();
  const lost = synchronizeProjectedGeometry(document, [movedBody]);
  assert.ok(lost.lostReferenceIds.includes(result.createdReferenceIds.at(-1)));
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
  assert.deepEqual(opened.document.drawings, []);
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

test('arkusz techniczny zapisuje skojarzony widok i rzutuje rzeczywiste krawędzie modelu', () => {
  const document = createDocument('Korpus <test>');
  const sheet = createDrawingSheet({ name: 'Rysunek wykonawczy', pageSize: 'A3', orientation: 'landscape' });
  const body = {
    id: 'body-part',
    lines: Float32Array.from([
      0, 0, 0, 100, 0, 0,
      100, 0, 0, 100, 0, 50,
      100, 0, 50, 0, 0, 50,
      0, 0, 50, 0, 0, 0,
    ]),
    metrics: { bounds: [[0, 0, 0], [100, 20, 50]] },
  };
  const scale = recommendedDrawingScale(sheet, [body], 'front');
  const view = createBaseDrawingView({ bodyIds: [body.id], orientation: 'front', scale, sheet });
  sheet.views.push(view);
  document.drawings.push(sheet);

  assert.equal(validateDocument(document).valid, true);
  assert.equal(projectDrawingView(view, [body]).segments.length, 4);
  assert.equal(drawingSheetScene(sheet, [body]).views[0].segments.length, 4);
  const html = drawingSheetHtml(sheet, [body], { documentName: document.name });
  assert.match(html, /<line/);
  assert.match(html, /Korpus &lt;test&gt;/);

  const reopened = openDocument(JSON.parse(JSON.stringify(document)));
  assert.deepEqual(reopened.document.drawings, document.drawings);
});

test('arkusz techniczny drukuje parametryczny szkic 2D bez tworzenia bryły 3D', () => {
  const document = createDocument('Płyta 2D');
  const points = [
    createSketchPoint({ x: 0, y: 0 }), createSketchPoint({ x: 80, y: 0 }),
    createSketchPoint({ x: 80, y: 40 }), createSketchPoint({ x: 0, y: 40 }),
  ];
  const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
  const center = createSketchPoint({ x: 40, y: 20 });
  const circle = createSketchCircleEntity({ centerPointId: center.id, radius: 5 });
  const sketch = createSketch({ name: 'Obrys płyty', entities: [...points, center, ...lines, circle] });
  document.sketches.push(sketch);
  const sheet = createDrawingSheet({ name: 'Rysunek 2D' });
  const scale = recommendedSketchDrawingScale(sheet, sketch, document.parameters, document.layers);
  const view = createSketchDrawingView({ sketchId: sketch.id, name: sketch.name, scale, sheet });
  sheet.views.push(view);
  document.drawings.push(sheet);

  assert.equal(document.bodies.length, 0);
  assert.equal(validateDocument(document).valid, true);
  const options = { sketches: document.sketches, parameters: document.parameters, layers: document.layers };
  const scene = drawingSheetScene(sheet, [], options);
  assert.equal(scene.views[0].modelWidth, 80);
  assert.equal(scene.views[0].modelHeight, 40);
  assert.ok(scene.views[0].segments.length > 60, 'okrąg i obrys muszą być widoczne na arkuszu');
  assert.match(drawingSheetHtml(sheet, [], { documentName: document.name, ...options }), /class="geometry sketch"/);
  assert.match(drawingSheetDxf(sheet, [], options), /\nLINE\n8\nGEOMETRY\n/);

  sketch.entities.find((entity) => entity.id === points[1].id).geometry.x = '100';
  assert.equal(drawingSheetScene(sheet, [], options).views[0].modelWidth, 100, 'widok aktualizuje się po zmianie szkicu');
  const reopened = openDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(reopened.document.drawings[0].views[0].sketchId, sketch.id);
});

test('rzuty pochodne, przekrój i detal zachowują relację, wyrównanie i aktualną geometrię modelu', () => {
  const document = createDocument('Korpus z dokumentacją');
  const sheet = createDrawingSheet({ pageSize: 'A3' });
  const body = {
    id: 'body-drawing-v6',
    vertices: Float32Array.from([
      0, 0, 0, 40, 0, 0, 40, 20, 0, 0, 20, 0,
      0, 0, 30, 40, 0, 30, 40, 20, 30, 0, 20, 30,
    ]),
    triangles: Uint32Array.from([
      0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
      0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2,
      2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
    ]),
    lines: Float32Array.from([
      0, 0, 0, 40, 0, 0, 40, 0, 0, 40, 20, 0, 40, 20, 0, 0, 20, 0, 0, 20, 0, 0, 0, 0,
      0, 0, 30, 40, 0, 30, 40, 0, 30, 40, 20, 30, 40, 20, 30, 0, 20, 30, 0, 20, 30, 0, 0, 30,
      0, 0, 0, 0, 0, 30, 40, 0, 0, 40, 0, 30, 40, 20, 0, 40, 20, 30, 0, 20, 0, 0, 20, 30,
    ]),
    metrics: { bounds: [[0, 0, 0], [40, 20, 30]] },
  };
  const base = createBaseDrawingView({ bodyIds: [body.id], orientation: 'front', scale: 1, x: 90, y: 80, sheet });
  const projected = createProjectedDrawingView({ parentView: base, direction: 'right' });
  const section = createSectionDrawingView({ parentView: base });
  const detail = createDetailDrawingView({ parentView: base, center: [0.25, 0.25], radius: 0.3, magnification: 2 });
  sheet.views.push(base, projected, section, detail);
  document.drawings.push(sheet);

  const scene = drawingSheetScene(sheet, [body]);
  assert.equal(scene.views[1].y, base.y, 'rzut poziomy pozostaje wyrównany do rodzica');
  assert.equal(scene.views[2].x, base.x, 'przekrój pozostaje wyrównany do rodzica');
  assert.ok(scene.views[2].segments.length >= 4, 'przekrój korzysta z przecięcia trójkątów');
  assert.ok(scene.views[2].hatchSegments.length > 0, 'zamknięty przekrój ma kreskowanie');
  assert.ok(scene.views[3].segments.length > 0 && scene.views[3].detailRadiusSheet > 0, 'detal wycina i powiększa geometrię');
  assert.deepEqual(scene.annotations.map((annotation) => annotation.type), ['section-line', 'detail-callout']);
  assert.equal(validateDocument(document).valid, true);
  assert.match(drawingSheetHtml(sheet, [body]), /section-callout/);
  assert.match(drawingSheetHtml(sheet, [body]), /detail-callout/);

  const tallerBody = { ...body, lines: Float32Array.from([...body.lines].map((value, index) => index % 3 === 2 ? value * 2 : value)), metrics: { bounds: [[0, 0, 0], [40, 20, 60]] } };
  assert.equal(drawingSheetScene(sheet, [tallerBody]).views[0].modelHeight, 60, 'widok aktualizuje się po przebudowie bryły');
  assert.deepEqual(openDocument(JSON.parse(JSON.stringify(document))).document.drawings, document.drawings);
});

test('skojarzone wymiary, osie, znaczniki środka i opis otworu aktualizują się z widokiem modelu', () => {
  const document = createDocument('Adnotacje rysunkowe');
  const sheet = createDrawingSheet();
  const body = {
    id: 'body-annotations',
    lines: Float32Array.from([
      0, 0, 0, 40, 0, 0, 40, 0, 0, 40, 0, 30,
      40, 0, 30, 0, 0, 30, 0, 0, 30, 0, 0, 0,
    ]),
    metrics: { bounds: [[0, 0, 0], [40, 20, 30]], minimumRadius: 4 },
    topology: { faces: [{ descriptor: { geometry: 'CYLINDRE', radius: 4 } }] },
  };
  const view = createBaseDrawingView({ bodyIds: [body.id], x: 80, y: 60, sheet });
  sheet.views.push(view);
  const horizontal = createLinearDrawingDimension({ viewId: view.id, precision: 1, toleranceMode: 'symmetric', upperTolerance: 0.2, lowerTolerance: 0.2 });
  const vertical = createLinearDrawingDimension({ viewId: view.id, axis: 'vertical', precision: 0 });
  sheet.annotations.push(
    horizontal,
    vertical,
    createCenterlineDrawingAnnotation({ viewId: view.id }),
    createCenterMarkDrawingAnnotation({ viewId: view.id }),
    createHoleNoteDrawingAnnotation({ viewId: view.id, precision: 1, quantity: 2 }),
    createHoleNoteDrawingAnnotation({ viewId: view.id, noteMode: 'thread', threadDesignation: 'M8×1.25', threadClass: '6H' }),
  );
  document.drawings.push(sheet);

  const scene = drawingSheetScene(sheet, [body]);
  assert.deepEqual(scene.annotations.slice(-6).map((annotation) => annotation.type), ['linear-dimension', 'linear-dimension', 'centerline', 'center-mark', 'hole-note', 'hole-note']);
  assert.equal(scene.annotations.find((annotation) => annotation.id === horizontal.id).text, '40.0 ±0.2');
  assert.equal(scene.annotations.find((annotation) => annotation.type === 'hole-note').text, '2× ⌀8.0 THRU');
  assert.equal(scene.annotations.find((annotation) => annotation.noteMode === 'thread').text, 'M8×1.25 - 6H THRU');
  assert.equal(validateDocument(document).valid, true);
  assert.match(drawingSheetHtml(sheet, [body]), /drawing-linear-dimension/);
  assert.match(drawingSheetHtml(sheet, [body]), /2× ⌀8\.0 THRU/);

  const widerBody = { ...body, lines: Float32Array.from([...body.lines].map((value, index) => index % 3 === 0 ? value * 2 : value)), metrics: { ...body.metrics, bounds: [[0, 0, 0], [80, 20, 30]] } };
  assert.equal(drawingSheetScene(sheet, [widerBody]).annotations.find((annotation) => annotation.id === horizontal.id).text, '80.0 ±0.2');
  assert.deepEqual(openDocument(JSON.parse(JSON.stringify(document))).document.drawings, document.drawings);
});

test('migracja v4 dodaje kolekcję arkuszy bez zmiany istniejącego modelu', () => {
  const legacy = createStarterDocument();
  legacy.schemaVersion = 4;
  delete legacy.drawings;
  const featureSnapshot = structuredClone(legacy.features);
  const opened = openDocument(legacy, { now: '2026-08-24T01:00:00.000Z' });
  assert.equal(opened.sourceVersion, 4);
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(opened.document.drawings, []);
  assert.deepEqual(opened.document.features, featureSnapshot);
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 4 && entry.to === 5));
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 5 && entry.to === 6));
});

test('migracja v5 zachowuje istniejące widoki bazowe i dodaje kolekcje dokumentacji w bieżącym schemacie', () => {
  const legacy = createDocument('Dokumentacja v5');
  const sheet = createDrawingSheet();
  sheet.views.push(createBaseDrawingView({ bodyIds: ['body-v5'], sheet }));
  legacy.drawings.push(sheet);
  legacy.schemaVersion = 5;
  const opened = openDocument(legacy, { now: '2026-08-24T03:30:00.000Z' });
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.equal(opened.document.drawings[0].views[0].type, 'base');
  assert.deepEqual(opened.document.drawings[0].annotations, []);
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 5 && entry.to === 6));
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 6 && entry.to === 7));
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 7 && entry.to === 8));
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 8 && entry.to === 9));
});

test('migracja v6 dodaje adnotacje arkusza bez zmiany widoków', () => {
  const legacy = createDocument('Dokumentacja v6');
  const sheet = createDrawingSheet();
  sheet.views.push(createBaseDrawingView({ bodyIds: ['body-v6'], sheet }));
  delete sheet.annotations;
  legacy.drawings.push(sheet);
  legacy.schemaVersion = 6;
  const views = structuredClone(sheet.views);
  const opened = openDocument(legacy, { now: '2026-08-24T06:00:00.000Z' });
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(opened.document.drawings[0].views, views);
  assert.deepEqual(opened.document.drawings[0].annotations, []);
  assert.equal(validateDocument(opened.document).valid, true);
});

test('migracja v7 dodaje tabliczkę i rewizje, a GD&T oraz DXF zachowują geometrię arkusza', () => {
  const legacy = createDocument('Dokumentacja v7');
  const sheet = createDrawingSheet();
  const body = { id: 'body-v7', lines: Float32Array.from([0, 0, 0, 30, 0, 0, 30, 0, 0, 30, 0, 20]), metrics: { bounds: [[0, 0, 0], [30, 10, 20]] } };
  const view = createBaseDrawingView({ bodyIds: [body.id], sheet });
  sheet.views.push(view);
  delete sheet.titleBlock;
  delete sheet.revisions;
  legacy.drawings.push(sheet);
  legacy.schemaVersion = 7;
  const opened = openDocument(legacy, { now: '2026-08-24T07:00:00.000Z' });
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(opened.document.drawings[0].revisions, []);
  assert.equal(opened.document.drawings[0].titleBlock.revision, 'A');

  const currentSheet = opened.document.drawings[0];
  currentSheet.titleBlock = { ...currentSheet.titleBlock, title: 'Korpus', partNumber: 'MC-001', material: 'S235', author: 'KK' };
  currentSheet.revisions.push(createDrawingRevision({ code: 'A', description: 'Wydanie', author: 'KK', date: '2026-08-24' }));
  currentSheet.annotations.push(createFeatureControlFrameDrawingAnnotation({ viewId: view.id, symbol: 'perpendicularity', tolerance: 0.05, datum: 'A' }));
  assert.equal(validateDocument(opened.document).valid, true);
  const scene = drawingSheetScene(currentSheet, [body]);
  assert.deepEqual(scene.annotations.at(-1).cells, ['⊥', '⌀0.05', 'A']);
  assert.match(drawingSheetHtml(currentSheet, [body]), /MC-001/);
  const dxf = drawingSheetDxf(currentSheet, [body]);
  assert.match(dxf, /\$INSUNITS\n70\n4/);
  assert.match(dxf, /0\nLINE/);
  assert.match(dxf, /0\nTEXT/);
  assert.match(dxf, /0\nEOF/);
});

test('migracja v8 dodaje tabele, a BOM, balony i tabela otworów pozostają skojarzone z modelem', () => {
  const legacy = createDocument('Dokumentacja v8');
  const sheet = createDrawingSheet();
  const body = {
    id: 'body-v8',
    name: 'Korpus',
    partNumber: 'MC-100',
    material: 'S235',
    lines: Float32Array.from([0, 0, 0, 40, 0, 0, 40, 0, 0, 40, 0, 30]),
    metrics: { bounds: [[0, 0, 0], [40, 20, 30]] },
    topology: { faces: [
      { descriptor: { geometry: 'CYLINDRE', radius: 4, orientation: 'REVERSED' } },
      { descriptor: { geometry: 'CYLINDRE', radius: 4, orientation: 'REVERSED' } },
      { descriptor: { geometry: 'CYLINDRE', radius: 2, orientation: 'REVERSED' } },
    ] },
  };
  const view = createBaseDrawingView({ bodyIds: [body.id], x: 90, y: 70, sheet });
  sheet.views.push(view);
  delete sheet.tables;
  legacy.drawings.push(sheet);
  legacy.schemaVersion = 8;

  const opened = openDocument(legacy, { now: '2026-08-24T08:00:00.000Z' });
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(opened.document.drawings[0].tables, []);
  assert.ok(opened.document.metadata.migrationHistory.some((entry) => entry.from === 8 && entry.to === 9));

  const currentSheet = opened.document.drawings[0];
  currentSheet.annotations.push(createBalloonDrawingAnnotation({ viewId: view.id, bodyId: body.id, itemNumber: 1 }));
  currentSheet.tables.push(createDrawingTable({ type: 'bom', sheet: currentSheet }));
  currentSheet.tables.push(createDrawingTable({ type: 'hole-table', viewId: view.id, sheet: currentSheet }));
  currentSheet.tables.push(createDrawingTable({ type: 'bend-table', sheet: currentSheet }));
  body.sheetMetal = {
    thickness: 2,
    bendRadius: 3,
    bends: [{ featureId: 'bend-1', angle: 90, bendRadius: 3, neutralAllowance: 6.126 }],
    hems: [{ featureId: 'hem-1', gap: 0.5, neutralAllowance: 3.613 }],
    flatSegments: [
      { featureId: 'bend-1', type: 'flange', frame: { edgeLength: 40 }, developmentLength: 16.126 },
      { featureId: 'hem-1', type: 'hem', frame: { edgeLength: 40 }, developmentLength: 9.613 },
    ],
  };
  opened.document.bodies.push({ id: body.id });
  createComponent(opened.document, { name: 'Korpus', partNumber: 'MC-100', material: 'S235', quantity: 2, bodyIds: [body.id] });

  assert.equal(validateDocument(opened.document).valid, true);
  const scene = drawingSheetScene(currentSheet, [body], { components: opened.document.components });
  assert.equal(scene.annotations.at(-1).type, 'balloon');
  assert.equal(scene.annotations.at(-1).text, '1');
  assert.deepEqual(scene.tables[0].rows, [['1', 'MC-100', 'Korpus', '2', 'S235']]);
  assert.equal(drawingBomItemNumber(body.id, [body], opened.document.components), 1);
  assert.deepEqual(scene.tables[1].rows, [['1', '⌀4', '1', 'Otwór walcowy'], ['2', '⌀8', '2', 'Otwór walcowy']]);
  assert.deepEqual(scene.tables[2].rows, [['1', 'Korpus', 'Kołnierz', '90°', '3', '40', '6.126'], ['2', 'Korpus', 'Hem', '180°', '0.25', '40', '3.613']]);
  const standardizedHoleBody = { ...body, manufacturingHoles: [{ diameter: 6.75, quantity: 1, holeStandard: 'iso-metric', holeApplication: 'tapped', standardSize: 'M8', threadDesignation: 'M8×1.25', threadClass: '6H', through: true }] };
  assert.deepEqual(drawingSheetScene(currentSheet, [standardizedHoleBody], { components: opened.document.components }).tables[1].rows, [['1', 'M8×1.25 - 6H', '1', 'Gwint wewnętrzny · wiertło ⌀6.75 · przelotowy']]);
  const pipeHoleBody = { ...body, manufacturingHoles: [{ diameter: 8.74, quantity: 1, holeStandard: 'asme-b1.20.1', holeApplication: 'npt-tapped', standardSize: 'npt-1-8', threadDesignation: '1/8-27 NPT', threadInspection: 'sprawdzian ASME B1.20.1', threadTaper: 0.0625, pipePreparation: 'conical', diameterToleranceLower: -0.05, diameterToleranceUpper: 0.1 }] };
  assert.deepEqual(drawingSheetScene(currentSheet, [pipeHoleBody], { components: opened.document.components }).tables[1].rows, [['1', '1/8-27 NPT', '1', '⌀8.74 +0.1/-0.05 · 1:16 · sprawdzian ASME B1.20.1']]);
  const inferredHoleBody = { ...body, topology: { faces: [] }, metrics: { ...body.metrics, minimumRadius: 3 } };
  assert.deepEqual(drawingSheetScene(currentSheet, [inferredHoleBody], { components: opened.document.components }).tables[1].rows, [['1', '⌀6', '1', 'Otwór walcowy']]);
  const html = drawingSheetHtml(currentSheet, [body], { components: opened.document.components });
  assert.match(html, /ZESTAWIENIE CZĘŚCI/);
  assert.match(html, /TABELA OTWORÓW/);
  assert.match(html, /TABELA GIĘĆ/);
  assert.match(html, /drawing-balloon/);
  const dxf = drawingSheetDxf(currentSheet, [body], { components: opened.document.components });
  assert.match(dxf, /8\nBALLOON/);
  assert.match(dxf, /8\nTABLE/);
  assert.match(dxf, /TABELA GIĘĆ/);
  assert.deepEqual(openDocument(JSON.parse(JSON.stringify(opened.document))).document.drawings, opened.document.drawings);
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

test('zapisane widoki zachowują dokładną kamerę, unikalne nazwy i round-trip', () => {
  const document = createDocument('Named Views');
  const camera = { position: [120, -90, 80], target: [5, 4, 3], up: [0, 0, 1] };
  const view = createNamedView(document, { name: 'Montaż', camera });
  renameNamedView(document, view.id, 'Montaż prawy');
  assert.deepEqual(openDocument(JSON.parse(JSON.stringify(document))).document.namedViews[0].camera, camera);
  assert.throws(() => createNamedView(document, { name: 'montaż PRAWY', camera }), /już istnieje/);
  assert.throws(() => createNamedView(document, { name: 'Błędny', camera: { ...camera, target: camera.position } }), /musi różnić/);
  assert.equal(deleteNamedView(document, view.id).id, view.id);
  assert.equal(validateDocument(document).valid, true);
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

test('picking dużej siatki mieści się w budżecie i mapuje właściwe ściany', () => {
  const groupCount = 4096;
  const pickCount = 100000;
  const faceGroups = Array.from({ length: groupCount }, (_, index) => ({
    start: index * 6,
    count: 6,
    topologyId: `face-${index}`,
  }));
  let checksum = 0;
  const startedAt = performance.now();
  for (let index = 0; index < pickCount; index += 1) {
    const faceIndex = (index * 7919) % (groupCount * 2);
    const topologyId = topologyIdForFaceIndex(faceGroups, faceIndex);
    checksum += Number(topologyId.slice(5));
  }
  const durationMs = performance.now() - startedAt;
  assert.ok(checksum > 0);
  assert.ok(
    durationMs < GEOMETRY_POLICY.performanceBudgets.pickingBatchMs,
    `Picking ${pickCount} trafień trwał ${durationMs.toFixed(1)} ms.`,
  );
});

test('interfejs modelowania rozpoznaje PL/EN i tłumaczy także dynamiczny stan silnika', () => {
  assert.equal(resolveModelingLanguage('en-US', 'pl'), 'en');
  assert.equal(resolveModelingLanguage('pl-PL', 'en'), 'pl');
  assert.equal(resolveModelingLanguage('', 'en'), 'en');
  assert.equal(translateModelingText('  Utwórz szkic  ', 'en'), '  Create sketch  ');
  assert.equal(translateModelingText('Model gotowy · 1 bryła', 'en'), 'Model ready · 1 body');
  assert.equal(translateModelingText('Korpus · 1 szk. · 3 oper. · 5 KB', 'en'), 'Korpus · 1 sk. · 3 feat. · 5 KB');
  assert.equal(translateModelingText('Otwarty łańcuch (3)', 'en'), 'Open chain (3)');
  assert.equal(translateModelingText('Przeliczanie historii…', 'en'), 'Recomputing history…');
  assert.equal(translateModelingText('A4 · poziomo · 1 wid.', 'en'), 'A4 · landscape · 1 view');
  assert.equal(translateModelingText('Widok bazowy, Przód, skala 2:1', 'en'), 'Base view, Front, scale 2:1');
  assert.equal(translateModelingText('78% metal · 30% chropowatości', 'en'), '78% metal · 30% roughness');
  assert.equal(translateModelingText('Skojarzony z modelem i widokiem nadrzędnym', 'en'), 'Associated with model and parent view');
  assert.equal(
    translateModelingText('Linia. Utwórz pojedynczy segment przez dwa punkty albo przez dokładną długość i kąt. Skrót: L ↵.', 'en'),
    'Line. Create one segment from two points or from an exact length and angle. Shortcut: L ↵.',
  );
  assert.equal(translateModelingText('Utwórz szkic', 'pl'), 'Utwórz szkic');
  for (const label of [
    'DOKUMENTACJA',
    'Dokumentacja techniczna',
    'Utwórz pierwszy arkusz techniczny',
    'Widok bazowy',
    'Widok rzutowany',
    'Przekrój',
    'Detal',
    'Kierunek rzutu',
    'Wyrównanie',
    'Eksport PDF',
    'Automatyczne więzy',
    'Pozostałe stopnie swobody',
    'Raport naprawy importu',
    'Komponenty i złożenia',
    'Nowa część',
    'Nowe złożenie',
    'Zaznacz część Rama. Numer: MC-001.',
    'Pominięto nieobsługiwany element SVG: text.',
  ]) assert.notEqual(translateModelingText(label, 'en'), label, `Brak tłumaczenia: ${label}`);
});

test('okno wraca na dostępny monitor po odłączeniu ekranu i zachowuje ujemne współrzędne', () => {
  const displays = [
    { primary: true, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { primary: false, workArea: { x: -2560, y: 0, width: 2560, height: 1400 } },
  ];
  assert.deepEqual(
    windowBounds.normalizeWindowBounds({ x: -2200, y: 80, width: 1400, height: 900 }, displays),
    { x: -2200, y: 80, width: 1400, height: 900 },
  );
  assert.deepEqual(
    windowBounds.normalizeWindowBounds({ x: 5000, y: 4000, width: 1680, height: 980 }, [displays[0]]),
    { x: 120, y: 30, width: 1680, height: 980 },
  );
  assert.deepEqual(
    windowBounds.normalizeWindowBounds({ x: 0, y: 0, width: 2400, height: 1600 }, [{ primary: true, workArea: { x: 0, y: 0, width: 1024, height: 700 } }]),
    { x: 0, y: 0, width: 1024, height: 700 },
  );
});

test('kanały aktualizacji respektują semver, zaufane hosty i integralność SHA-256', () => {
  const releases = [
    { tag_name: 'v6.1.0-alpha.2', draft: false },
    { tag_name: 'v6.1.0-beta.1', draft: false },
    { tag_name: 'v6.0.1', draft: false },
    { tag_name: 'v9.0.0', draft: true },
  ];
  assert.equal(updatePolicy.selectLatestRelease(releases, 'stable', '6.0.0')?.version.raw, '6.0.1');
  assert.equal(updatePolicy.selectLatestRelease(releases, 'beta', '6.0.0')?.version.raw, '6.1.0-beta.1');
  assert.equal(updatePolicy.selectLatestRelease(releases, 'alpha', '6.0.0-alpha.1')?.version.raw, '6.1.0-beta.1');
  assert.equal(updatePolicy.compareVersions('6.0.0', '6.0.0-beta.9'), 1);
  assert.equal(updatePolicy.normalizeChannel('', '6.0.0-alpha.1'), 'alpha');
  assert.equal(updatePolicy.isTrustedUpdateUrl('https://github.com/kamil5646/MadCAD/releases/download/v6/MadCAD.zip'), true);
  assert.equal(updatePolicy.isTrustedUpdateUrl('https://example.com/MadCAD.zip'), false);
  const payload = Buffer.from('signed package bytes');
  const hash = updatePolicy.sha256Buffer(payload);
  assert.equal(updatePolicy.parseChecksumFile(`${hash}  MadCAD.zip\n`, 'MadCAD.zip'), hash);
  assert.equal(updatePolicy.verifyBufferChecksum(payload, hash), true);
  assert.equal(updatePolicy.verifyBufferChecksum(Buffer.from('tampered'), hash), false);
  const assets = [
    { name: 'MadCAD-6.2.0-mac-arm64.zip', browser_download_url: 'https://github.com/kamil5646/MadCAD/releases/download/v6.2.0/MadCAD-6.2.0-mac-arm64.zip' },
    { name: 'MadCAD-6.2.0-mac-arm64.zip.sha256', browser_download_url: 'https://github.com/kamil5646/MadCAD/releases/download/v6.2.0/MadCAD-6.2.0-mac-arm64.zip.sha256' },
    { name: 'MadCAD-6.2.0-mac-x64.zip', browser_download_url: 'https://github.com/kamil5646/MadCAD/releases/download/v6.2.0/MadCAD-6.2.0-mac-x64.zip' },
    { name: 'MadCAD-6.2.0-win-x64-portable.exe', browser_download_url: 'https://github.com/kamil5646/MadCAD/releases/download/v6.2.0/MadCAD-6.2.0-win-x64-portable.exe' },
    { name: 'MadCAD-6.2.0-win-x64.exe', browser_download_url: 'https://github.com/kamil5646/MadCAD/releases/download/v6.2.0/MadCAD-6.2.0-win-x64.exe' },
    { name: 'MadCAD-6.2.0-linux-x86_64.AppImage', browser_download_url: 'https://github.com/kamil5646/MadCAD/releases/download/v6.2.0/MadCAD-6.2.0-linux-x86_64.AppImage' },
  ];
  assert.equal(updatePolicy.selectReleaseAsset(assets, 'darwin', 'arm64')?.name, 'MadCAD-6.2.0-mac-arm64.zip');
  assert.equal(updatePolicy.selectReleaseAsset(assets, 'darwin', 'x64')?.name, 'MadCAD-6.2.0-mac-x64.zip');
  assert.equal(updatePolicy.selectReleaseAsset(assets, 'win32', 'x64')?.name, 'MadCAD-6.2.0-win-x64.exe');
  assert.equal(updatePolicy.selectReleaseAsset(assets, 'linux', 'x64')?.name, 'MadCAD-6.2.0-linux-x86_64.AppImage');
  assert.equal(updatePolicy.selectChecksumAsset(assets, 'MadCAD-6.2.0-mac-arm64.zip')?.name, 'MadCAD-6.2.0-mac-arm64.zip.sha256');
  assert.equal(updatePolicy.selectReleaseAsset([{ ...assets[0], browser_download_url: 'https://example.com/fake.zip' }], 'darwin', 'arm64'), null);
});

test('samouczek PL/EN prowadzi do eksportu i jawnie wymienia znane ograniczenia', () => {
  for (const language of ['pl', 'en']) {
    const tutorial = tutorialForLanguage(language);
    assert.equal(tutorial.steps.length, 8);
    assert.ok(tutorial.steps.at(-1)[1].includes(language === 'en' ? 'export' : 'wyeksportuj'));
    assert.ok(tutorial.limitations.length >= 5);
    assert.ok(tutorial.limitations.some((item) => item.includes('STEP')));
    assert.ok(!tutorial.limitations.some((item) => item.includes('Linux')));
  }
});

test('import SVG tworzy profil szkicu, skaluje cale i odwraca oś Y', () => {
  const svg = '<svg width="2in" height="1in" viewBox="0 0 2 1"><rect x="0" y="0" width="2" height="1"/><circle cx="1" cy="0.5" r="0.2"/></svg>';
  assert.equal(inspectSketchImport(svg, 'svg').detectedUnit, 'inch');
  const imported = parseSketchImport(svg, 'svg', { sourceUnit: 'auto' });
  assert.equal(imported.scale, 25.4);
  assert.equal(imported.curveCount, 5);
  assert.equal(imported.profiles.length, 1);
  assert.equal(imported.profiles[0].innerLoops.length, 1);
  const coordinates = imported.entities.filter((entity) => entity.type === 'point').map((entity) => Number(entity.geometry.y));
  assert.equal(Math.min(...coordinates), -25.4);
});

test('automatyczna skala SVG uwzględnia relację fizycznego rozmiaru do viewBox', () => {
  const imported = parseSketchImport('<svg width="100mm" height="50mm" viewBox="0 0 200 100"><path d="M 0 0 H 200 V 100 H 0 Z"/></svg>', 'svg');
  assert.equal(imported.scale, 0.5);
  const xs = imported.entities.filter((entity) => entity.type === 'point').map((entity) => Number(entity.geometry.x));
  assert.equal(Math.max(...xs), 100);
});

test('raport importu jawnie rozdziela elementy zmienione i pominięte', () => {
  const imported = parseSketchImport('<svg width="40mm" height="20mm"><rect x="0" y="0" width="20" height="10" rx="2"/><path d="M 0 0 C 1 1 2 2 3 3"/><text x="2" y="2">opis</text></svg>', 'svg');
  assert.equal(imported.repairReport.imported, 4);
  assert.equal(imported.repairReport.changed, 1);
  assert.equal(imported.repairReport.skipped, 2);
  assert.ok(imported.repairReport.entries.some((entry) => entry.status === 'changed' && entry.code === 'SVG_ROUNDED_RECT'));
  assert.ok(imported.repairReport.entries.some((entry) => entry.status === 'skipped' && entry.code === 'SVG_PATH_UNSUPPORTED'));
  assert.ok(imported.repairReport.entries.some((entry) => entry.status === 'skipped' && entry.code === 'SVG_ELEMENT_UNSUPPORTED'));
});

test('import DXF obsługuje jednostki, LINE, zamkniętą LWPOLYLINE, CIRCLE i ARC', () => {
  const dxf = ['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES','0','LINE','10','0','20','0','11','5','21','0','0','LWPOLYLINE','70','1','10','0','20','0','10','10','20','0','10','10','20','10','10','0','20','10','0','CIRCLE','10','4','20','4','40','2','0','ARC','10','20','20','20','40','5','50','0','51','90','0','ENDSEC','0','EOF'].join('\n');
  const imported = parseSketchImport(dxf, '.dxf');
  assert.equal(imported.detectedUnit, 'millimeter');
  assert.equal(imported.curveCount, 7);
  assert.ok(imported.profiles.length >= 1);
  assert.ok(imported.entities.some((entity) => entity.type === 'circle'));
  assert.ok(imported.entities.some((entity) => entity.type === 'arc'));
});

test('import DXF pomija geometrię definicji BLOCKS poza sekcją ENTITIES', () => {
  const dxf = ['0','SECTION','2','BLOCKS','0','LINE','10','0','20','0','11','100','21','0','0','ENDSEC','0','SECTION','2','ENTITIES','0','LINE','10','0','20','0','11','5','21','0','0','ENDSEC','0','EOF'].join('\n');
  const imported = parseSketchImport(dxf, 'dxf');
  assert.equal(imported.curveCount, 1);
});

test('import szkicu odrzuca pusty plik, nieznany format i plik bez geometrii', () => {
  assert.throws(() => parseSketchImport('', 'svg'), /pusty/i);
  assert.throws(() => inspectSketchImport('<svg/>', 'pdf'), /SVG albo DXF/i);
  assert.throws(() => parseSketchImport('<svg><text>abc</text></svg>', 'svg'), /geometrii/i);
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
  assert.equal(under.freedomModes.length, 3);
  assert.ok(under.freedomModes.some((mode) => mode.variables.some((variable) => variable.entityId === start.id && variable.axis === 'x')));

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

test('wymiary ordinate X/Y sterują bezwzględną pozycją punktu', () => {
  const point = createSketchPoint({ x: 3, y: 4 });
  const sketch = createSketch({ entities: [point] });
  addDrivingSketchDimension(sketch, 'ordinateX', [point.id], { expression: '12' });
  addDrivingSketchDimension(sketch, 'ordinateY', [point.id], { expression: '-7' });
  const solution = solveSketchConstraints(sketch);
  assert.equal(solution.converged, true);
  applySketchConstraintSolution(sketch, solution);
  assert.equal(Number(sketch.entities[0].geometry.x), 12);
  assert.equal(Number(sketch.entities[0].geometry.y), -7);
  assert.deepEqual(sketch.dimensions.map((dimension) => dimension.type), ['ordinateX', 'ordinateY']);
});

test('wymiar długości łuku steruje promieniem bez zmiany kąta', () => {
  const center = createSketchPoint({ x: 0, y: 0, fixed: true });
  const start = createSketchPoint({ x: 10, y: 0 });
  const end = createSketchPoint({ x: 0, y: 10 });
  const arc = createSketchArc({ centerPointId: center.id, startPointId: start.id, endPointId: end.id, direction: 'ccw' });
  const sketch = createSketch({ entities: [center, start, end, arc] });
  addDrivingSketchDimension(sketch, 'arcLength', [arc.id], { expression: String(Math.PI * 10) });
  const solution = solveSketchConstraints(sketch);
  assert.equal(solution.converged, true);
  applySketchConstraintSolution(sketch, solution);
  const solvedStart = sketch.entities.find((entity) => entity.id === start.id);
  const solvedEnd = sketch.entities.find((entity) => entity.id === end.id);
  assert.ok(Math.abs(Number(solvedStart.geometry.x) - 20) < 1e-6);
  assert.ok(Math.abs(Number(solvedEnd.geometry.y) - 20) < 1e-6);
});

test('wymiary ordinate i długości łuku odrzucają konflikt oraz niedodatnią wartość', () => {
  const fixedPoint = createSketchPoint({ x: 3, y: 4, fixed: true });
  const ordinateSketch = createSketch({ entities: [fixedPoint] });
  addDrivingSketchDimension(ordinateSketch, 'ordinateX', [fixedPoint.id], { expression: '12' });
  const ordinateSolution = solveSketchConstraints(ordinateSketch);
  assert.equal(ordinateSolution.status, SKETCH_SOLVER_STATUS.CONFLICT);
  assert.equal(ordinateSolution.converged, false);
  assert.equal(Number(fixedPoint.geometry.x), 3);

  const center = createSketchPoint({ x: 0, y: 0 });
  const start = createSketchPoint({ x: 10, y: 0 });
  const end = createSketchPoint({ x: 0, y: 10 });
  const arc = createSketchArc({ centerPointId: center.id, startPointId: start.id, endPointId: end.id });
  const arcSketch = createSketch({ entities: [center, start, end, arc] });
  addDrivingSketchDimension(arcSketch, 'arcLength', [arc.id], { expression: '0' });
  const arcSolution = solveSketchConstraints(arcSketch);
  assert.equal(arcSolution.status, SKETCH_SOLVER_STATUS.CONFLICT);
  assert.ok(arcSolution.diagnostics.some((entry) => entry.code === 'INVALID_CONSTRAINT' && entry.message.includes('dodatnia')));
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

test('solver collinear ustawia dwie linie na jednej prostej i zachowuje więz po round-trip', () => {
  const points = [
    createSketchPoint({ x: 0, y: 0, fixed: true }), createSketchPoint({ x: 10, y: 0, fixed: true }),
    createSketchPoint({ x: 2, y: 4 }), createSketchPoint({ x: 8, y: 6 }),
  ];
  const lines = [createSketchLine({ startPointId: points[0].id, endPointId: points[1].id }), createSketchLine({ startPointId: points[2].id, endPointId: points[3].id })];
  const constraint = createSketchConstraint('collinear', lines.map((line) => line.id));
  const sketch = createSketch({ entities: [...points, ...lines], constraints: [constraint] });
  const solution = solveSketchConstraints(sketch);
  assert.equal(solution.converged, true);
  applySketchConstraintSolution(sketch, solution);
  const moved = sketch.entities.filter((entity) => [points[2].id, points[3].id].includes(entity.id));
  assert.ok(moved.every((point) => Math.abs(Number(point.geometry.y)) < 1e-7));
  const document = createDocument('Collinear');
  document.sketches.push(sketch);
  const reopened = openDocument(JSON.parse(JSON.stringify(document))).document;
  assert.equal(reopened.sketches[0].constraints[0].type, 'collinear');
});

test('solver symmetry odbija dwa punkty względem osi i wykrywa konflikt geometrii stałej', () => {
  const axisPoints = [createSketchPoint({ x: 0, y: -10, fixed: true }), createSketchPoint({ x: 0, y: 10, fixed: true })];
  const axis = createSketchLine({ startPointId: axisPoints[0].id, endPointId: axisPoints[1].id });
  const points = [createSketchPoint({ x: -2, y: 1, fixed: true }), createSketchPoint({ x: 5, y: 4 })];
  const constraint = createSketchConstraint('symmetry', [points[0].id, points[1].id, axis.id]);
  const sketch = createSketch({ entities: [...axisPoints, axis, ...points], constraints: [constraint] });
  const solution = solveSketchConstraints(sketch);
  assert.equal(solution.converged, true);
  applySketchConstraintSolution(sketch, solution);
  const reflected = sketch.entities.find((entity) => entity.id === points[1].id);
  assert.ok(Math.abs(Number(reflected.geometry.x) - 2) < 1e-7);
  assert.ok(Math.abs(Number(reflected.geometry.y) - 1) < 1e-7);

  const conflicting = createSketch({ entities: [...axisPoints, axis, { ...points[0], fixed: true }, { ...points[1], fixed: true }], constraints: [constraint] });
  assert.equal(analyzeSketchConstraints(conflicting).status, SKETCH_SOLVER_STATUS.CONFLICT);
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

test('solver curvature utrzymuje wspólny okrąg dwóch połączonych łuków i wykrywa konflikt', () => {
  const firstCenter = createSketchPoint({ x: 0, y: 0, fixed: true });
  const secondCenter = createSketchPoint({ x: 2, y: 1 });
  const start = createSketchPoint({ x: -10, y: 0 });
  const joint = createSketchPoint({ x: 10, y: 0 });
  const end = createSketchPoint({ x: 0, y: 10 });
  const firstArc = createSketchArc({ centerPointId: firstCenter.id, startPointId: start.id, endPointId: joint.id, direction: 'ccw' });
  const secondArc = createSketchArc({ centerPointId: secondCenter.id, startPointId: joint.id, endPointId: end.id, direction: 'ccw' });
  const constraint = createSketchConstraint('curvature', [firstArc.id, secondArc.id]);
  const sketch = createSketch({ entities: [firstCenter, secondCenter, start, joint, end, firstArc, secondArc], constraints: [constraint] });
  const solution = solveSketchConstraints(sketch);
  assert.equal(solution.solved, true);
  const movedCenter = solution.updates.find((entry) => entry.pointId === secondCenter.id);
  assert.ok(Math.hypot(movedCenter.x, movedCenter.y) <= GEOMETRY_POLICY.linearTolerance);
  applySketchConstraintSolution(sketch, solution);
  const document = { ...createDocument('Curvature'), sketches: [sketch] };
  assert.equal(validateDocument(document).valid, true);
  assert.equal(openDocument(JSON.parse(JSON.stringify(document))).document.sketches[0].constraints[0].type, 'curvature');

  const fixedSecondCenter = { ...secondCenter, fixed: true };
  const conflicting = createSketch({ entities: [firstCenter, fixedSecondCenter, start, joint, end, firstArc, secondArc], constraints: [constraint] });
  assert.equal(analyzeSketchConstraints(conflicting).status, SKETCH_SOLVER_STATUS.CONFLICT);
  const separateEnd = createSketchPoint({ x: 10, y: 1 });
  const separateArc = createSketchArc({ centerPointId: secondCenter.id, startPointId: separateEnd.id, endPointId: end.id });
  const invalid = createSketch({ entities: [firstCenter, secondCenter, start, joint, end, separateEnd, firstArc, separateArc], constraints: [createSketchConstraint('curvature', [firstArc.id, separateArc.id])] });
  assert.match(analyzeSketchConstraints(invalid).diagnostics[0].message, /wspólny koniec/);
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

test('szyk prostokątny kopiuje profile i pomija wskazane wystąpienia', () => {
  const document = createDocument('Szyk prostokątny');
  const points = [[0, 0], [4, 0], [4, 3], [0, 3]].map(([x, y]) => createSketchPoint({ x, y }));
  const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
  const sketch = createSketch({ entities: [...points, ...lines] });
  refreshDetectedSketchProfiles(sketch);
  document.sketches.push(sketch);

  const result = rectangularSketchPattern(document, sketch.id, lines.map((line) => line.id), {
    columns: 3,
    rows: 2,
    spacingX: 10,
    spacingY: 8,
    skippedOccurrences: '3',
  });
  assert.deepEqual(result.occurrences.map((entry) => entry.occurrenceIndex), [2, 4, 5, 6]);
  assert.equal(result.createdEntityIds.length, 16);
  assert.equal(result.createdPointIds.length, 16);
  assert.equal(sketch.profiles.length, 5);
  const copiedPoints = result.occurrences[0].pointIds.map((id) => sketch.entities.find((entity) => entity.id === id));
  assert.deepEqual(copiedPoints.map((point) => [Number(point.geometry.x), Number(point.geometry.y)]), [[10, 0], [14, 0], [14, 3], [10, 3]]);
});

test('szyk kołowy rozkłada geometrię po kącie i waliduje pominięcia', () => {
  const document = createDocument('Szyk kołowy');
  const start = createSketchPoint({ x: 10, y: 0 });
  const end = createSketchPoint({ x: 14, y: 0 });
  const line = createSketchLine({ startPointId: start.id, endPointId: end.id });
  const sketch = createSketch({ entities: [start, end, line] });
  document.sketches.push(sketch);

  const result = circularSketchPattern(document, sketch.id, [line.id], { count: 4, centerX: 0, centerY: 0, totalAngle: 360, skippedOccurrences: [3] });
  assert.deepEqual(result.occurrences.map((entry) => entry.occurrenceIndex), [2, 4]);
  const secondStart = sketch.entities.find((entity) => entity.id === result.occurrences[0].pointIds[0]);
  assert.ok(Math.abs(Number(secondStart.geometry.x)) < 1e-8);
  assert.ok(Math.abs(Number(secondStart.geometry.y) - 10) < 1e-8);
  assert.deepEqual(parseSkippedPatternOccurrences('2, 4-6, 4'), [2, 4, 5, 6]);

  const before = structuredClone(document);
  assert.throws(() => circularSketchPattern(document, sketch.id, [line.id], { count: 4, skippedOccurrences: '1' }), /źródłową/);
  assert.deepEqual(document, before);
  assert.throws(() => rectangularSketchPattern(document, sketch.id, [line.id], { columns: 1, rows: 1 }), /od 2 do 100/);
});

test('szyk po ścieżce rozstawia kopie równo i orientuje je do linii oraz łuku', () => {
  const document = createDocument('Szyk po ścieżce');
  const source = createSketchPoint({ x: 0, y: 0 });
  const pathStart = createSketchPoint({ x: 0, y: 0, role: 'construction' });
  const pathEnd = createSketchPoint({ x: 30, y: 0, role: 'construction' });
  const pathLine = createSketchLine({ startPointId: pathStart.id, endPointId: pathEnd.id, role: 'construction' });
  const sketch = createSketch({ entities: [source, pathStart, pathEnd, pathLine] });
  document.sketches.push(sketch);
  const lineResult = pathSketchPattern(document, sketch.id, [source.id], { pathEntityId: pathLine.id, count: 4, orientToPath: true, skippedOccurrences: '3' });
  assert.deepEqual(lineResult.occurrences.map((entry) => entry.occurrenceIndex), [2, 4]);
  assert.deepEqual(lineResult.occurrences.map((entry) => {
    const point = sketch.entities.find((entity) => entity.id === entry.entityIds[0]);
    return [Number(point.geometry.x), Number(point.geometry.y)];
  }), [[10, 0], [30, 0]]);

  const arcCenter = createSketchPoint({ x: 0, y: 0, role: 'construction' });
  const arcStart = createSketchPoint({ x: 10, y: 0, role: 'construction' });
  const arcEnd = createSketchPoint({ x: 0, y: 10, role: 'construction' });
  const pathArc = createSketchArc({ centerPointId: arcCenter.id, startPointId: arcStart.id, endPointId: arcEnd.id, role: 'construction' });
  const markerStart = createSketchPoint({ x: 10, y: 0 });
  const markerEnd = createSketchPoint({ x: 12, y: 0 });
  const marker = createSketchLine({ startPointId: markerStart.id, endPointId: markerEnd.id });
  sketch.entities.push(arcCenter, arcStart, arcEnd, pathArc, markerStart, markerEnd, marker);
  const arcResult = pathSketchPattern(document, sketch.id, [marker.id], { pathEntityId: pathArc.id, count: 3, anchorX: 10, anchorY: 0, orientToPath: true });
  const lastPoints = arcResult.occurrences.at(-1).pointIds.map((id) => sketch.entities.find((entity) => entity.id === id));
  assert.ok(Math.abs(Number(lastPoints[0].geometry.x)) < 1e-8 && Math.abs(Number(lastPoints[0].geometry.y) - 10) < 1e-8);
  assert.ok(Math.abs(Number(lastPoints[1].geometry.x)) < 1e-8 && Math.abs(Number(lastPoints[1].geometry.y) - 12) < 1e-8);
  assert.throws(() => pathSketchPattern(document, sketch.id, [pathLine.id], { pathEntityId: pathLine.id, count: 3 }), /jednocześnie/);
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

test('migracja v3 i round-trip bieżącego schematu zachowują encje, profile, relacje i historię', () => {
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

test('czyszczenie relacji usuwa więzy i wymiary wskazujące nieistniejącą geometrię', () => {
  const point = createSketchPoint({ x: 0, y: 0 });
  const sketch = createSketch({ entities: [point] });
  const valid = createSketchConstraint('fixed', [point.id]);
  const broken = createSketchConstraint('horizontal', ['missing-line']);
  sketch.constraints.push(valid, broken);
  sketch.dimensions.push(createSketchDimension('aligned', ['missing-line'], { expression: '10', constraintId: broken.id }));
  const result = pruneDanglingSketchRelations(sketch);
  assert.deepEqual(result.removedConstraintIds, [broken.id]);
  assert.equal(result.removedDimensionIds.length, 1);
  assert.deepEqual(sketch.constraints.map((constraint) => constraint.id), [valid.id]);
  assert.equal(sketch.dimensions.length, 0);
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

test('nowy szkic korzysta ze snapu i przecięć wcześniejszego szkicu na tej samej płaszczyźnie', () => {
  const referenceStart = createSketchPoint({ x: 0, y: 0 });
  const referenceEnd = createSketchPoint({ x: 20, y: 0 });
  const referenceLine = createSketchLine({ startPointId: referenceStart.id, endPointId: referenceEnd.id });
  const referenceSketch = createSketch({ plane: 'XY', planeOffset: 5, entities: [referenceStart, referenceEnd, referenceLine] });
  const activeStart = createSketchPoint({ x: 10, y: -10 });
  const activeEnd = createSketchPoint({ x: 10, y: 10 });
  const activeSketch = createSketch({ plane: 'XY', planeOffset: 5, entities: [activeStart, activeEnd, createSketchLine({ startPointId: activeStart.id, endPointId: activeEnd.id })] });

  const context = composeSketchSnapContext(activeSketch, [referenceSketch]);
  assert.ok(context.referenceEntityIds.includes(referenceLine.id));
  assert.equal(snapSketchPoint(context.sketch, [0.4, 0.2], { pixelsPerUnit: 10, thresholdPx: 12 }).type, 'endpoint');
  assert.equal(snapSketchPoint(context.sketch, [10.3, 0.2], { pixelsPerUnit: 10, thresholdPx: 12 }).type, 'intersection');

  const otherPlane = composeSketchSnapContext(activeSketch, [{ ...referenceSketch, plane: 'YZ' }]);
  const otherOffset = composeSketchSnapContext(activeSketch, [{ ...referenceSketch, planeOffset: 7 }]);
  assert.deepEqual(otherPlane.referenceEntityIds, []);
  assert.deepEqual(otherOffset.referenceEntityIds, []);
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

test('wyciąganie przyjmuje profil z osobnymi punktami końcowymi w tych samych współrzędnych', () => {
  const points = [
    createSketchPoint({ x: 0, y: 0 }),
    createSketchPoint({ x: 30, y: 0 }),
    createSketchPoint({ x: 30, y: 0 }),
    createSketchPoint({ x: 10, y: 20 }),
    createSketchPoint({ x: 10, y: 20 }),
    createSketchPoint({ x: 0, y: 0 }),
  ];
  const lines = [
    createSketchLine({ startPointId: points[0].id, endPointId: points[1].id }),
    createSketchLine({ startPointId: points[2].id, endPointId: points[3].id }),
    createSketchLine({ startPointId: points[4].id, endPointId: points[5].id }),
  ];
  const sketch = createSketch({ entities: [...points, ...lines] });
  const detection = detectSketchProfiles(sketch);
  assert.equal(detection.diagnostics.length, 0);
  assert.equal(detection.profiles.length, 1);
  sketch.profiles = detection.profiles;

  const document = createDocument('Trójkąt z kursora');
  document.sketches.push(sketch);
  document.features.push(createFeature('extrude', {
    sketchId: sketch.id,
    profileIds: [sketch.profiles[0].id],
    distance: '12',
    operation: 'new',
  }));

  const validation = validateDocument(document);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  const prepared = prepareDocument(document);
  assert.equal(prepared.features[0].profiles[0].geometry.segments.length, 3);
  assert.equal(prepared.features[0].distanceValue, 12);
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

test('układ druku normalizuje wartości i rozstawia obrócone kopie bez nakładania', () => {
  const normalized = normalizePrintLayout({ scale: 0, copies: 2.6, copySpacing: -4, orientationAxis: [0, 0, 0] });
  assert.equal(normalized.copies, 3);
  assert.equal(normalized.copySpacing, 0);
  assert.ok(normalized.scale > 0);
  assert.deepEqual(normalized.orientationAxis, [0, 0, 1]);

  const result = calculatePrintLayout([{ bounds: [[-5, -10, 0], [5, 10, 2]] }], {
    rotationZ: 90,
    scale: 2,
    copies: 2,
    copySpacing: 4,
    positionX: -3,
    positionY: 7,
    positionZ: 1,
  });
  assert.deepEqual(result.dimensions.map((value) => Math.round(value)), [84, 20, 4]);
  assert.equal(Math.round(result.pitch), 44);
  assert.deepEqual(result.min.map((value) => Math.round(value)), [-23, -3, 1]);
});

test('orientacja druku kieruje normalną zaznaczonej ściany do stołu', () => {
  const orientation = orientationForBedFace([1, 0, 0]);
  const transformed = transformPrintPoint([1, 0, 0], {
    orientationAxis: orientation.axis,
    orientationAngle: orientation.angle,
  });
  assert.ok(Math.abs(transformed[0]) < 1e-9);
  assert.ok(Math.abs(transformed[1]) < 1e-9);
  assert.ok(Math.abs(transformed[2] + 1) < 1e-9);
  assert.deepEqual(orientationForBedFace([0, 0, -1]), { axis: [0, 0, 1], angle: 0 });
  assert.deepEqual(orientationForBedFace([0, 0, 1]), { axis: [1, 0, 0], angle: 180 });
});

test('eksport 3MF zapisuje milimetry, obiekty i trójkąty w poprawnym archiwum', () => {
  const archive = createThreeMfArchive([{
    name: 'Trójkąt',
    vertices: [0, 0, 0, 10, 0, 0, 0, 10, 0],
    triangles: [0, 1, 2],
  }]);
  const inspection = inspectThreeMfArchive(archive);
  assert.equal(inspection.unit, 'millimeter');
  assert.equal(inspection.objectCount, 1);
  assert.equal(inspection.triangleCount, 1);
  assert.ok(archive.byteLength > 300);
});

test('inspekcja 3MF odczytuje zewnętrzne modele produkcyjne Bambu Studio', () => {
  const main = '<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"><resources><object id="2" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1"/></components></object></resources><build><item objectid="2"/></build></model>';
  const object = '<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="20" y="0" z="0"/><vertex x="0" y="20" z="0"/><vertex x="0" y="0" z="20"/></vertices><triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="1" v2="2" v3="3"/><triangle v1="2" v2="0" v3="3"/></triangles></mesh></object></resources><build/></model>';
  const archive = zipSync({ '3D/3dmodel.model': strToU8(main), '3D/Objects/object_1.model': strToU8(object) });
  assert.deepEqual(inspectThreeMfArchive(archive), { unit: 'millimeter', objectCount: 1, triangleCount: 4, modelFileCount: 2 });
});

test('kontrola importu 3D rozpoznaje STEP, binarny STL i archiwum 3MF przed uruchomieniem silnika', () => {
  const step = new TextEncoder().encode('ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;');
  assert.deepEqual(inspectModelImportBuffer(step, 'stp'), {
    format: 'step', bytes: step.byteLength, triangleCount: null, importMode: 'brep',
  });

  const stl = new Uint8Array(84 + 50);
  new DataView(stl.buffer).setUint32(80, 1, true);
  assert.deepEqual(inspectModelImportBuffer(stl, 'stl'), {
    format: 'stl', bytes: stl.byteLength, triangleCount: 1, importMode: 'mesh',
  });
  const parsedBinary = parseStlMesh(stl);
  assert.equal(parsedBinary.vertices.length, 9);
  assert.deepEqual(parsedBinary.triangles, [0, 1, 2]);

  const asciiStl = new TextEncoder().encode('solid open\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid open');
  assert.deepEqual(parseStlMesh(asciiStl), { vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0], triangles: [0, 1, 2] });

  const archive = createThreeMfArchive([{
    vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    triangles: [0, 1, 2],
  }]);
  assert.equal(inspectModelImportBuffer(archive, '3mf').importMode, 'mesh');
  assert.throws(() => inspectModelImportBuffer(new Uint8Array([1, 2, 3]), '3mf'), /archiwum ZIP/i);
  assert.throws(() => inspectModelImportBuffer(step, 'step', 10), /Maksymalny rozmiar/i);
});

test('import 3D normalizuje jednostki 3MF i czytelnie pokazuje rozmiar pliku', () => {
  assert.equal(normalizeModelUnit('micrometer'), 'micron');
  assert.equal(normalizeModelUnit('metre'), 'meter');
  assert.equal(normalizeModelUnit('foot'), 'foot');
  assert.equal(normalizeModelUnit('nieznana'), 'millimeter');
  assert.equal(formatModelFileSize(1536), '1.5 KB');
  assert.equal(formatModelFileSize(5 * 1024 * 1024), '5.0 MB');
});

test('dokument przechowuje import STEP/STL/3MF z jawną skalą jednostki', () => {
  const document = createDocument('Import');
  document.features.push(createFeature('importedModel', {
    importFormat: 'stl',
    originalFormat: '3mf',
    dataBase64: 'AA==',
    sourceUnit: 'inch',
    unitScale: 25.4,
  }));
  assert.equal(validateDocument(document).valid, true);
  assert.equal(prepareDocument(document).features[0].unitScale, 25.4);
  const broken = structuredClone(document);
  broken.features[0].unitScale = 0;
  assert.equal(validateDocument(broken).valid, false);
});

test('analiza druku odróżnia zamkniętą siatkę od otwartej i wskazuje problem', () => {
  const tetrahedron = {
    id: 'body-tetra', name: 'Tetra', sourceFeatureId: 'feature-tetra',
    vertices: Float32Array.from([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
    normals: new Float32Array(),
    triangles: Uint32Array.from([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
    bounds: [[0, 0, 0], [10, 10, 10]],
    faceGroups: [0, 1, 2, 3].map((index) => ({ start: index * 3, count: 3, topologyId: `face-${index}` })),
    topology: { faces: [] },
  };
  const print = { bedWidth: 220, bedDepth: 220, bedHeight: 250, minimumWallThickness: 0.8, minimumHoleDiameter: 2, overhangAngle: 45 };
  const closed = analyzePrintability([tetrahedron], print);
  assert.equal(closed.bodyResults[0].boundaryEdges, 0);
  assert.equal(closed.bodyResults[0].nonManifoldEdges, 0);
  assert.equal(closed.issues.some((issue) => issue.code === 'MANIFOLD'), false);
  assert.equal(closed.issues.some((issue) => issue.code === 'OVERHANG'), true);

  const open = analyzePrintability([{ ...tetrahedron, triangles: Uint32Array.from([0, 2, 1]) }], print);
  assert.equal(open.bodyResults[0].boundaryEdges, 3);
  assert.equal(open.issues.find((issue) => issue.code === 'MANIFOLD').selection.id, 'body-tetra');
});

test('analiza druku wykrywa trójkąt zdegenerowany, mały otwór i przekroczenie stołu', () => {
  const body = {
    id: 'body-risk', name: 'Ryzyko', sourceFeatureId: 'feature-risk',
    vertices: Float32Array.from([0, 0, 0, 1, 0, 0, 2, 0, 0]), normals: new Float32Array(), triangles: Uint32Array.from([0, 1, 2]),
    bounds: [[0, 0, 0], [300, 1, 1]], faceGroups: [{ start: 0, count: 3, topologyId: 'face-degenerate' }],
    topology: { faces: [{ id: 'face-hole', descriptor: { geometry: 'CYLINDRE', radius: 0.4 } }] },
  };
  const result = analyzePrintability([body], { bedWidth: 220, bedDepth: 220, bedHeight: 250, minimumHoleDiameter: 2 });
  assert.ok(result.issues.some((issue) => issue.code === 'DEGENERATE' && issue.selection.id === 'face-degenerate'));
  assert.ok(result.issues.some((issue) => issue.code === 'SMALL_HOLE' && issue.selection.id === 'face-hole'));
  assert.ok(result.issues.some((issue) => issue.code === 'BED_BOUNDS'));
});

test('przekazanie do slicera waliduje program, rozmiar i bezpieczną nazwę STL', () => {
  const normalized = slicerLaunch.normalizeSlicerPayload({
    slicer: 'bambu',
    files: [{ name: '../../Uchwyt testowy.stl', data: new Uint8Array(84) }],
  });
  assert.equal(normalized.slicer, 'bambu');
  assert.equal(normalized.files[0].name, 'Uchwyt-testowy.stl');
  assert.equal(normalized.files[0].bytes.byteLength, 84);
  assert.throws(() => slicerLaunch.normalizeSlicerPayload({ slicer: 'nieznany', files: [{ name: 'a.stl', data: new Uint8Array(84) }] }), /Nieobsługiwany/);
  assert.throws(() => slicerLaunch.normalizeSlicerPayload({ slicer: 'cura', files: [{ name: 'a.stl', data: new Uint8Array(20) }] }), /pusty/);
  assert.ok(slicerLaunch.windowsCandidates('prusa', { ProgramFiles: 'C:\\Program Files' }).some((candidate) => candidate.toLowerCase().includes('prusa-slicer.exe')));
});

test('polityka Electron przepuszcza tylko HTTPS i nawigację wewnątrz aplikacji', () => {
  assert.equal(securityPolicy.normalizeExternalUrl('https://example.com/help'), 'https://example.com/help');
  assert.equal(securityPolicy.normalizeExternalUrl('http://example.com/help'), null);
  assert.equal(securityPolicy.normalizeExternalUrl('file:///etc/passwd'), null);
  assert.equal(securityPolicy.normalizeExternalUrl('javascript:alert(1)'), null);
  assert.equal(securityPolicy.normalizeExternalUrl('https://user:secret@example.com'), null);
  assert.equal(securityPolicy.isTrustedAppNavigation('file:///Applications/MadCAD/index.html', 'file:///Applications/MadCAD/index.html#model'), true);
  assert.equal(securityPolicy.isTrustedAppNavigation('file:///tmp/other.html', 'file:///Applications/MadCAD/index.html'), false);
  assert.equal(securityPolicy.isTrustedAppNavigation('http://localhost:5173/model', 'http://localhost:5173/', 'http://localhost:5173'), true);
  assert.equal(securityPolicy.isTrustedIpcUrl('file:///Applications/MadCAD/dist/index.html?verify=1', 'file:///Applications/MadCAD/dist/index.html'), true);
  assert.equal(securityPolicy.isTrustedIpcUrl('file:///tmp/attacker.html', 'file:///Applications/MadCAD/dist/index.html'), false);
  assert.equal(securityPolicy.isTrustedIpcUrl('http://localhost:5173/model', 'file:///Applications/MadCAD/dist/index.html', 'http://localhost:5173'), true);
  assert.equal(securityPolicy.isTrustedIpcUrl('https://example.com/', 'file:///Applications/MadCAD/dist/index.html', 'http://localhost:5173'), false);
});

test('lokalny import DWG wybiera LibreDWG lub ODA i buduje bezpieczne argumenty', () => {
  assert.equal(dwgConverter.converterKind('/usr/bin/dwg2dxf'), 'libredwg');
  assert.equal(dwgConverter.converterKind('/usr/bin/dwgread'), 'libredwg');
  assert.equal(dwgConverter.converterKind('C:\\Program Files\\ODA\\ODAFileConverter.exe'), 'oda');
  assert.ok(dwgConverter.pathCandidates('darwin', { PATH: '/bin' }).includes('/opt/homebrew/bin/dwg2dxf'));
  assert.ok(dwgConverter.pathCandidates('linux', { PATH: '/bin' }).includes('/usr/bin/dwg2dxf'));
  assert.ok(dwgConverter.pathCandidates('win32', { PATH: 'C:\\Tools', ProgramFiles: 'C:\\Program Files' }).some((candidate) => candidate.endsWith('dwg2dxf.exe')));
  const libre = dwgConverter.buildConverterInvocation(
    { kind: 'libredwg', executablePath: '/usr/bin/dwg2dxf' },
    '/tmp/input/model.dwg',
    '/tmp/output/model.dxf',
    '/tmp/input',
    '/tmp/output',
  );
  assert.deepEqual(libre.args, ['--overwrite', '--minimal', '--as', 'r2013', '--file', '/tmp/output/model.dxf', '/tmp/input/model.dwg']);
  const reader = dwgConverter.buildConverterInvocation(
    { kind: 'libredwg', executablePath: '/usr/bin/dwgread' },
    '/tmp/input/model.dwg',
    '/tmp/output/model.dxf',
    '/tmp/input',
    '/tmp/output',
  );
  assert.deepEqual(reader.args, ['--format', 'DXF', '--file', '/tmp/output/model.dxf', '/tmp/input/model.dwg']);
  const oda = dwgConverter.buildConverterInvocation(
    { kind: 'oda', executablePath: '/Applications/ODAFileConverter' },
    '/tmp/input/model.dwg',
    '/tmp/output/model.dxf',
    '/tmp/input',
    '/tmp/output',
  );
  assert.deepEqual(oda.args, ['/tmp/input', '/tmp/output', 'ACAD2018', 'DXF', '0', '1', '*.dwg']);
});

test('polityka IPC ogranicza nazwy, filtry, konwersje i podgląd wydruku', () => {
  const save = ipcPolicy.normalizeSaveTextPayload({
    text: 'projekt',
    defaultName: '../../projekt.step',
    filters: [{ name: 'STEP', extensions: ['step', '.stp'] }],
    atomic: true,
    targetPath: '/tmp/projekt.madcad',
  });
  assert.equal(save.defaultName, 'projekt.step');
  assert.deepEqual(save.filters[0].extensions, ['step', 'stp']);
  assert.equal(save.atomic, true);
  assert.equal(save.targetPath, normalize('/tmp/projekt.madcad'));
  assert.throws(() => ipcPolicy.normalizeSaveTextPayload({ text: 'x', filters: [{ name: 'Zły', extensions: ['../exe'] }] }), /rozszerzenie/i);
  assert.throws(() => ipcPolicy.normalizeSaveTextPayload({ text: 'x', targetPath: 'projekt.madcad' }), /bezwzględny/i);
  assert.throws(() => ipcPolicy.normalizeSaveTextPayload({ text: 'x', targetPath: '/tmp/projekt.step' }), /\.madcad/i);
  assert.throws(() => ipcPolicy.normalizeAutosavePayload({ text: '' }), /pusty/i);
  const snapshot = ipcPolicy.normalizeProjectSnapshotCreatePayload({ name: '  Przed otworami  ', description: ' wersja bazowa ', text: '{"schemaVersion":14}' });
  assert.deepEqual(snapshot, { name: 'Przed otworami', description: 'wersja bazowa', text: '{"schemaVersion":14}' });
  assert.equal(ipcPolicy.normalizeProjectSnapshotIdPayload({ id: 'snapshot-12345678-1234-4123-8123-123456789abc' }).id, 'snapshot-12345678-1234-4123-8123-123456789abc');
  assert.throws(() => ipcPolicy.normalizeProjectSnapshotIdPayload({ id: '../manifest.json' }), /ID/i);
  const linked = ipcPolicy.normalizeLinkedProjectReadPayload({ baseProjectPath: '/tmp/złożenie/main.madcad', relativePath: '../części/korpus.madcad' });
  assert.equal(linked.resolvedPath, resolve('/tmp/części/korpus.madcad'));
  assert.throws(() => ipcPolicy.normalizeLinkedProjectReadPayload({ baseProjectPath: '/tmp/main.madcad', relativePath: '/etc/passwd' }), /względną/i);
  assert.throws(() => ipcPolicy.normalizeLinkedProjectBasePayload({ baseProjectPath: '/tmp/main.json' }), /nadrzędny/i);
  assert.throws(() => ipcPolicy.normalizeCadConversionPayload({ mode: 'dwg-to-dxf', sourcePath: '/tmp/model.exe' }), /DWG/i);
  assert.equal(ipcPolicy.normalizeCadConversionPayload({ mode: 'dxf-text-to-dwg', dxfText: '0\nEOF', defaultName: '../part' }).defaultName, 'part.dwg');
  const preview = ipcPolicy.securePrintPreviewHtml('<!doctype html><html><head></head><body><script>print()</script></body></html>');
  assert.match(preview, /Content-Security-Policy/);
  assert.match(preview, /connect-src 'none'/);
  const pdf = ipcPolicy.normalizePdfExportPayload({ html: '<!doctype html><html><body>arkusz</body></html>', defaultName: '../../korpus', pageSize: 'A3', orientation: 'landscape' });
  assert.deepEqual({ defaultName: pdf.defaultName, pageSize: pdf.pageSize, orientation: pdf.orientation }, { defaultName: 'korpus.pdf', pageSize: 'A3', orientation: 'landscape' });
});

test('okna Electron i preload utrzymują sandbox oraz jedną bramę IPC', async () => {
  const [mainSource, preloadSource] = await Promise.all([
    readFile(new URL('../electron/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../electron/preload.js', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(mainSource, /sandbox:\s*false/);
  assert.equal((mainSource.match(/sandbox:\s*true/g) || []).length, 3);
  assert.equal((mainSource.match(/registerTrustedIpcHandler\('madcad:/g) || []).length, 20);
  assert.match(preloadSource, /openProjectFile/);
  assert.match(preloadSource, /packAndGoProject/);
  assert.doesNotMatch(mainSource, /install-oda-addon|convert-cad-file|get-oda-status|choose-oda|open-oda/);
  assert.match(mainSource, /import-dwg-sketch/);
  assert.equal((mainSource.match(/ipcMain\.handle\(/g) || []).length, 1);
  assert.match(mainSource, /queueAutosaveOperation/);
  assert.match(mainSource, /response\.on\('error', failDownload\)/);
  assert.doesNotMatch(preloadSource, /require\(['"](?:os|crypto|fs|child_process)['"]\)/);
  assert.doesNotMatch(preloadSource, /verifyLicenseSignature/);
  assert.doesNotMatch(preloadSource, /installOdaAddon|convertCadFile|getOdaStatus|chooseOdaConverterPath|openOdaDownload/);
});

test('Pack & Go zbiera graf linków, przepisuje ścieżki i zapisuje manifest integralności', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'madcad-pack-and-go-'));
  try {
    const leafPath = join(directory, 'korpus.madcad');
    const childPath = join(directory, 'podzespol.madcad');
    const rootPath = join(directory, 'maszyna.madcad');
    const destination = join(directory, 'Maszyna-Pack-and-Go');
    const leaf = createDocument('Korpus');
    const leafText = JSON.stringify(leaf, null, 2);
    await writeFile(leafPath, leafText, 'utf8');
    const child = createDocument('Podzespół');
    child.linkedProjects.push({ relativePath: 'korpus.madcad', fileName: 'korpus.madcad', sourceDocumentId: leaf.id, sourceHash: packAndGo.sha256(leafText) });
    const childText = JSON.stringify(child, null, 2);
    await writeFile(childPath, childText, 'utf8');
    const root = createDocument('Maszyna');
    root.linkedProjects.push({ relativePath: 'podzespol.madcad', fileName: 'podzespol.madcad', sourceDocumentId: child.id, sourceHash: packAndGo.sha256(childText) });
    await writeFile(rootPath, JSON.stringify(root, null, 2), 'utf8');

    const result = await packAndGo.createPackAndGo(rootPath, destination, {
      now: () => '2026-08-24T12:00:00.000Z',
      randomId: () => 'test',
    });
    assert.equal(result.manifest.files.length, 3);
    assert.equal(result.manifest.rootProject, 'maszyna.madcad');
    const manifest = JSON.parse(await readFile(join(destination, 'madcad-pack.json'), 'utf8'));
    for (const file of manifest.files) {
      const text = await readFile(join(destination, ...file.path.split('/')), 'utf8');
      assert.equal(packAndGo.sha256(text), file.sha256);
    }
    const packedRoot = JSON.parse(await readFile(join(destination, manifest.rootProject), 'utf8'));
    const packedChildPath = join(destination, packedRoot.linkedProjects[0].relativePath);
    const packedChildText = await readFile(packedChildPath, 'utf8');
    assert.equal(packAndGo.sha256(packedChildText), packedRoot.linkedProjects[0].sourceHash);
    const packedChild = JSON.parse(packedChildText);
    const packedLeafPath = join(dirname(packedChildPath), packedChild.linkedProjects[0].relativePath);
    assert.equal(packAndGo.sha256(await readFile(packedLeafPath, 'utf8')), packedChild.linkedProjects[0].sourceHash);
    await assert.rejects(() => packAndGo.createPackAndGo(rootPath, destination), /już istnieje/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Pack & Go odrzuca brak, zmianę źródła i cykl bez częściowej paczki', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'madcad-pack-errors-'));
  try {
    const rootPath = join(directory, 'root.madcad');
    const childPath = join(directory, 'child.madcad');
    const root = createDocument('Root');
    const child = createDocument('Child');
    root.linkedProjects.push({ relativePath: 'missing.madcad', fileName: 'missing.madcad', sourceDocumentId: 'missing', sourceHash: '0'.repeat(64) });
    await writeFile(rootPath, JSON.stringify(root), 'utf8');
    await assert.rejects(() => packAndGo.createPackAndGo(rootPath, join(directory, 'missing-pack')), /Brakuje/i);

    root.linkedProjects[0] = { relativePath: 'child.madcad', fileName: 'child.madcad', sourceDocumentId: child.id, sourceHash: '0'.repeat(64) };
    await writeFile(rootPath, JSON.stringify(root), 'utf8');
    await writeFile(childPath, JSON.stringify(child), 'utf8');
    await assert.rejects(() => packAndGo.createPackAndGo(rootPath, join(directory, 'changed-pack')), /zmienił się/i);

    child.linkedProjects.push({ relativePath: 'root.madcad', fileName: 'root.madcad', sourceDocumentId: root.id, sourceHash: '0'.repeat(64) });
    root.linkedProjects[0].sourceHash = packAndGo.sha256(JSON.stringify(child));
    await writeFile(rootPath, JSON.stringify(root), 'utf8');
    await writeFile(childPath, JSON.stringify(child), 'utf8');
    await assert.rejects(() => packAndGo.createPackAndGo(rootPath, join(directory, 'cycle-pack')), /cykl/i);
    assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith('-pack')), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('porównanie projektu klasyfikuje zmiany strukturalne i ignoruje znaczniki czasu', () => {
  const before = createDocument('Maszyna v1');
  const parameter = createParameter('szerokosc', '20 mm');
  before.parameters.push(parameter);
  const retainedFeature = createFeature('primitive', { name: 'Korpus', primitiveType: 'box', width: '20', depth: '10', height: '5' });
  const removedFeature = createFeature('primitive', { name: 'Usuwany', primitiveType: 'sphere', radius: '3' });
  before.features.push(retainedFeature, removedFeature);
  const after = structuredClone(before);
  after.name = 'Maszyna v2';
  after.metadata.modifiedAt = '2099-01-01T00:00:00.000Z';
  after.parameters[0].expression = '30 mm';
  after.features = [{ ...retainedFeature, width: '30' }, createFeature('primitive', { name: 'Dodany', primitiveType: 'cylinder', radius: '4', height: '8' })];
  after.linkedProjects.push({ id: 'linked-project-test', sourceName: 'Silnik', fileName: 'silnik.madcad' });

  const diff = compareProjectDocuments(before, after);
  assert.equal(diff.changed, 5);
  assert.deepEqual(diff.counts, { added: 2, removed: 1, modified: 2, unchanged: 0 });
  assert.deepEqual(diff.categories.find((category) => category.id === 'parameters').items[0].changedFields, ['expression']);
  assert.deepEqual(diff.categories.find((category) => category.id === 'features').items.find((item) => item.state === 'modified').changedFields, ['width']);
  assert.equal(diff.categories.find((category) => category.id === 'components').items.length, 0);
});

test('porównanie proxy STEP wykrywa zmianę danych także przy identycznym rozmiarze', () => {
  const before = createDocument('Proxy A');
  const feature = createFeature('importedModel', { name: 'Proxy', originalFormat: 'step', dataBase64: 'AAAA', unitScale: 1 });
  before.features.push(feature);
  const after = structuredClone(before);
  after.features[0].dataBase64 = 'BBBB';
  const diff = compareProjectDocuments(before, after);
  const item = diff.categories.find((category) => category.id === 'features').items[0];
  assert.equal(item.state, 'modified');
  assert.deepEqual(item.changedFields, ['dataBase64']);
});

test('raport kondycji potwierdza zdrowy projekt i podaje metryki bez modyfikowania dokumentu', () => {
  const document = createStarterDocument();
  const before = structuredClone(document);
  const report = createProjectHealthReport({
    document,
    timeline: document.features.map((feature) => ({ id: feature.id, status: 'ok', diagnostics: [] })),
    serializedBytes: 1536,
    bodyCount: 1,
  });
  assert.equal(report.status, 'healthy');
  assert.equal(report.score, 100);
  assert.deepEqual(report.counts, { critical: 0, warning: 0, info: 0, total: 0 });
  assert.equal(report.metrics.serializedSize, '2 KB');
  assert.equal(report.metrics.bodyCount, 1);
  assert.equal(report.checks.every((check) => check.passed), true);
  assert.deepEqual(document, before);
});

test('raport kondycji łączy historię, B-Rep, linki, silnik i rozmiar z priorytetami', () => {
  const document = createDocument('Diagnostyka');
  const failed = createFeature('primitive', { name: 'Uszkodzona bryła', primitiveType: 'box', width: '10', depth: '10', height: '10' });
  const suppressed = createFeature('primitive', { name: 'Opcjonalny detal', primitiveType: 'sphere', radius: '2' });
  document.features.push(failed, suppressed);
  document.linkedProjects.push({ id: 'linked-source', sourceName: 'Silnik', fileName: 'silnik.madcad', relativePath: 'parts/silnik.madcad', linkedComponentId: 'component-engine' });
  const report = createProjectHealthReport({
    document,
    validation: { valid: true, issues: [], errors: [] },
    timeline: [
      { id: failed.id, status: 'error', error: 'Kernel odmówił operacji.' },
      { id: suppressed.id, status: 'suppressed', diagnostics: [] },
    ],
    lostReferences: [{ reference: { id: 'reference-lost', label: 'Górna ściana', ownerFeatureId: failed.id }, reason: 'Nie znaleziono trwałego ID.' }],
    linkedProjectStatuses: { 'linked-source': { state: 'changed' } },
    engineDiagnostics: [{ code: 'WORKER_CRASH', message: 'Worker został odtworzony.', attempt: 1 }],
    serializedBytes: 33 * 1024 * 1024,
  });
  assert.equal(report.status, 'critical');
  assert.deepEqual(report.counts, { critical: 2, warning: 3, info: 1, total: 6 });
  assert.equal(report.score, 25);
  assert.equal(report.issues.find((issue) => issue.code === 'FEATURE_ERROR').target.id, failed.id);
  assert.equal(report.issues.find((issue) => issue.code === 'LINK_SOURCE_CHANGED').target.id, 'component-engine');
  assert.equal(report.issues.find((issue) => issue.code === 'TOPOLOGY_REFERENCE_LOST').target.referenceId, 'reference-lost');
  assert.equal(report.issues.some((issue) => issue.code === 'DOCUMENT_SIZE_HIGH'), true);
});

test('raport kondycji mapuje błędy walidacji na obiekty i klasyfikuje brakujące linki', () => {
  const document = createDocument('Cele raportu');
  const sketch = createSketch({ name: 'Szkic celu' });
  document.sketches.push(sketch);
  document.linkedProjects.push({ id: 'linked-missing', sourceName: 'Podzespół', relativePath: '../podzespol.madcad', linkedComponentId: 'component-missing' });
  const report = createProjectHealthReport({
    document,
    validation: { valid: false, errors: [], issues: [{ path: 'sketches[0].plane', code: 'UNSUPPORTED', message: 'Nieznana płaszczyzna.' }] },
    linkedProjectStatuses: { 'linked-missing': { state: 'missing', error: 'Plik nie istnieje.' } },
    engineStatus: 'error',
    engineError: 'Nie można przeliczyć dokumentu.',
    serializedBytes: 65 * 1024 * 1024,
  });
  assert.equal(report.issues.find((issue) => issue.code === 'UNSUPPORTED').target.id, sketch.id);
  assert.equal(report.issues.find((issue) => issue.code === 'LINK_SOURCE_MISSING').target.id, 'component-missing');
  assert.equal(report.issues.some((issue) => issue.code === 'ENGINE_ERROR'), true);
  assert.equal(report.issues.some((issue) => issue.code === 'DOCUMENT_SIZE_CRITICAL'), true);
  assert.equal(formatProjectBytes(10 * 1024 * 1024), '10.0 MB');
  assert.doesNotThrow(() => JSON.stringify(report));
});

test('Gdzie używane pokazuje bezpośrednich użytkowników szkicu i pełny wpływ zmiany', () => {
  const document = createStarterDocument();
  const sketch = document.sketches[0];
  const inspection = inspectProjectDependencies(document, sketch.id);
  assert.equal(inspection.selected.id, sketch.id);
  assert.deepEqual(inspection.usedBy.map((item) => item.id).sort(), document.features.map((feature) => feature.id).sort());
  assert.equal(inspection.affected.some((item) => item.kind === 'body' && item.depth === 2), true);
  assert.equal(inspection.uses.length, 0);
  assert.equal(inspection.counts.usedBy, 2);
  assert.equal(inspection.nodes.some((node) => node.kind === 'parameter'), true);
  assert.equal(inspection.usedBy.every((item) => item.target.kind === 'feature'), true);
});

test('Gdzie używane rozróżnia wejścia operacji od transytywnych zależności nadrzędnych', () => {
  const document = createStarterDocument();
  const feature = document.features[0];
  const inspection = inspectProjectDependencies(document, feature.id);
  assert.equal(inspection.uses.some((item) => item.kind === 'sketch'), true);
  assert.equal(inspection.uses.some((item) => item.kind === 'parameter'), true);
  assert.equal(inspection.upstream.some((item) => item.kind === 'sketch-entity'), true);
  assert.equal(inspection.affected.some((item) => item.kind === 'body'), true);
  assert.equal(dependencyNodeIdForSelection({ kind: 'face', id: 'face-1', bodyId: 'body-test' }, document), 'body-test');
});

test('graf zależności obejmuje linkowany projekt, komponent i stabilne proxy', () => {
  const document = createDocument('Zespół linkowany');
  const proxy = createFeature('importedModel', { name: 'Proxy silnika', originalFormat: 'step', dataBase64: 'AA==', unitScale: 1, linkedProjectId: 'linked-engine' });
  document.features.push(proxy);
  const component = createComponent(document, { name: 'Silnik', type: 'part', bodyIds: [`body-${proxy.id}`] });
  document.linkedProjects.push({ id: 'linked-engine', sourceName: 'Silnik źródłowy', relativePath: 'silnik.madcad', linkedComponentId: component.id, proxyFeatureIds: [proxy.id] });
  const inspection = inspectProjectDependencies(document, 'linked-engine');
  assert.equal(inspection.selected.kind, 'linked-project');
  assert.deepEqual(new Set(inspection.usedBy.map((item) => item.id)), new Set([component.id, proxy.id]));
  assert.equal(inspection.selected.target.kind, 'component');
  assert.equal(inspection.selected.target.id, component.id);
  assert.equal(inspectProjectDependencies(document, 'nie-istnieje').selected.id, document.id);
});

test('globalne Idź do indeksuje główne obiekty projektu i zachowuje cele nawigacji', () => {
  const document = createStarterDocument();
  const component = createComponent(document, { name: 'Zespół napędowy', type: 'assembly', partNumber: 'ASM-01' });
  const instance = createComponentInstance(document, { componentId: component.id, name: 'Napęd główny' });
  const sheet = createDrawingSheet({ name: 'Rysunek wykonawczy', pageSize: 'A3' });
  const plane = createOffsetPlane({ name: 'Płaszczyzna montażowa', basePlane: 'XY', offset: '10' });
  document.drawings.push(sheet);
  document.references.push(plane);
  document.linkedProjects.push({ id: 'linked-search', sourceName: 'Przekładnia zewnętrzna', fileName: 'przekladnia.madcad', linkedComponentId: component.id });
  const index = buildProjectSearchIndex(document);
  assert.equal(index.find((item) => item.id === document.parameters[0].id).target.kind, 'settings');
  assert.equal(index.find((item) => item.id === instance.id).target.kind, 'componentInstance');
  assert.equal(index.find((item) => item.id === sheet.id).target.kind, 'drawingSheet');
  assert.equal(index.find((item) => item.id === plane.id).target.kind, 'constructionPlane');
  assert.equal(index.find((item) => item.id === 'linked-search').target.id, component.id);
  assert.equal(index.some((item) => item.kind === 'body'), true);
});

test('globalne Idź do wyszukuje bez polskich znaków, po typie i preferuje dokładną nazwę', () => {
  const document = createStarterDocument();
  const before = JSON.stringify(document);
  const byName = searchProject(document, 'otwor centralny');
  assert.equal(byName[0].label, 'Otwór centralny');
  assert.equal(byName[0].kind, 'feature');
  const byType = searchProject(document, 'parametr srednica');
  assert.equal(byType[0].kind, 'parameter');
  assert.equal(byType[0].label.toLocaleLowerCase('pl').includes('średnica'), true);
  assert.equal(normalizeProjectSearchText('  Płaszczyzna–ŁÓDŹ  '), 'plaszczyzna lodz');
  assert.equal(searchProjectIndex(buildProjectSearchIndex(document), '', { limit: 2 }).length, 2);
  assert.deepEqual(searchProjectIndex(buildProjectSearchIndex(document), 'nieistniejacy'), []);
  assert.deepEqual(searchProject(null, 'cokolwiek'), []);
  assert.equal(JSON.stringify(document), before);
});

test('nazwane punkty zapisu projektu są atomowe, limitowane i możliwe do przywrócenia', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'madcad-project-snapshots-'));
  try {
    const ids = [];
    for (let index = 0; index < 21; index += 1) {
      const id = `snapshot-00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
      ids.push(id);
      const document = createDocument(`Projekt ${index}`);
      document.features.push(createFeature('primitive', { primitiveType: 'box', width: '10', depth: '10', height: '10' }));
      const created = await projectSnapshotStore.createProjectSnapshot(directory, {
        name: `Wersja ${index}`,
        description: index === 20 ? 'Gotowa do otworów' : '',
        text: JSON.stringify(document),
      }, { id, now: () => `2026-08-24T${String(index).padStart(2, '0')}:00:00.000Z` });
      if (index === 20) assert.deepEqual(created.removedIds, [ids[0]]);
    }
    const listed = await projectSnapshotStore.listProjectSnapshots(directory);
    assert.equal(listed.snapshots.length, projectSnapshotStore.MAX_PROJECT_SNAPSHOTS);
    assert.equal(listed.snapshots[0].name, 'Wersja 20');
    assert.equal(listed.snapshots[0].featureCount, 1);
    assert.equal(listed.snapshots.some((item) => item.id === ids[0]), false);
    const opened = await projectSnapshotStore.readProjectSnapshot(directory, ids[20]);
    assert.equal(JSON.parse(opened.text).name, 'Projekt 20');
    assert.equal(opened.item.description, 'Gotowa do otworów');
    await projectSnapshotStore.deleteProjectSnapshot(directory, ids[20]);
    assert.equal((await projectSnapshotStore.listProjectSnapshots(directory)).snapshots.length, 19);
    await assert.rejects(() => projectSnapshotStore.readProjectSnapshot(directory, '../manifest.json'), /ID|znaleziono/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('uszkodzony autozapis jest odzyskiwany z poprawnej kopii .bak', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'madcad-recovery-'));
  const targetPath = join(directory, 'session.json');
  try {
    await writeFile(targetPath, '{uszkodzony', 'utf8');
    await writeFile(`${targetPath}.bak`, JSON.stringify({ revision: 7, valid: true }), 'utf8');
    const recovered = await recoveryFile.readRecoverableTextFile(targetPath, { validate: recoveryFile.validateJsonText });
    assert.equal(recovered.recovered, true);
    assert.equal(JSON.parse(recovered.text).revision, 7);
    assert.match(recovered.primaryError, /JSON|position|property/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('brak miejsca podczas zapisu nie narusza ostatniej poprawnej wersji', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'madcad-full-disk-'));
  const targetPath = join(directory, 'project.madcad');
  try {
    await writeFile(targetPath, 'ostatnia-poprawna', 'utf8');
    const simulatedFullDisk = {
      ...fsPromises,
      open: async (filePath, ...args) => {
        if (String(filePath).endsWith('.tmp')) {
          const error = new Error('no space left on device');
          error.code = 'ENOSPC';
          throw error;
        }
        return fsPromises.open(filePath, ...args);
      },
    };
    await assert.rejects(() => atomicWriteTextFile(targetPath, 'niedokończona', { fileSystem: simulatedFullDisk }), (error) => error.code === 'ENOSPC');
    assert.equal(await readFile(targetPath, 'utf8'), 'ostatnia-poprawna');
    assert.equal((await readdir(directory)).some((name) => name.endsWith('.tmp')), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
