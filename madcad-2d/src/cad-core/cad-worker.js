import opencascade from 'replicad-opencascadejs';
import opencascadeWasm from 'replicad-opencascadejs/src/replicad_single.wasm?url';
import {
  drawCircle,
  draw,
  drawRectangle,
  importSTEP,
  importSTL,
  makeCylinder,
  measureShapeSurfaceProperties,
  measureShapeVolumeProperties,
  setOC,
} from 'replicad';
import { FEATURE_STATUS, prepareDocument } from './evaluator.js';
import { evaluateFeatureHistory } from './feature-history.js';
import { GEOMETRY_POLICY } from './geometry-policy.js';
import { assignStableTopologyIds } from './topology-naming.js';
import { RevisionCache, SerialTaskQueue, estimateMeshBytes, isStaleRevision } from './worker-runtime.js';

let kernelPromise;
let latestRequestedRevision = 0;
const requestQueue = new SerialTaskQueue();
const revisionCache = new RevisionCache({
  maxEntries: GEOMETRY_POLICY.cache.maxRevisions,
  maxBytes: GEOMETRY_POLICY.cache.maxMeshBytes,
  onEvict: (entry) => {
    for (const body of entry?.kernelBodies || []) body.shape?.delete?.();
  },
});
const topologyHistory = new Map();

async function ensureKernel() {
  if (!kernelPromise) {
    kernelPromise = opencascade({ locateFile: () => opencascadeWasm }).then((oc) => {
      setOC(oc);
      return oc;
    });
  }
  return kernelPromise;
}

function drawingForProfile(profile) {
  const { geometry } = profile;
  if (profile.type === 'rectangle') {
    return drawRectangle(geometry.width, geometry.height).translate(geometry.x, geometry.y);
  }
  if (profile.type === 'circle') {
    return drawCircle(geometry.diameter / 2).translate(geometry.x, geometry.y);
  }
  if (profile.type === 'closed') {
    const [first, ...segments] = geometry.segments;
    if (!first) throw new Error(`Profil ${profile.id} nie zawiera segmentów.`);
    const pen = draw(first.start);
    const ordered = [first, ...segments];
    for (const segment of ordered) {
      if (segment.type === 'arc') pen.tangentArcTo(segment.end);
      else pen.lineTo(segment.end);
    }
    return pen.done();
  }
  throw new Error(`Nieobsługiwany profil: ${profile.type}`);
}

function extrudeProfile(profile, distance) {
  return drawingForProfile(profile).sketchOnPlane(profile.plane || 'XY').extrude(distance);
}

function combineShapes(shapes) {
  if (!shapes.length) throw new Error('Operacja nie zawiera żadnego profilu.');
  return shapes.slice(1).reduce((result, shape) => result.fuse(shape), shapes[0]);
}

function runFeature(feature, bodyMap, bodyOrder) {
  if (feature.status === FEATURE_STATUS.SUPPRESSED) return;

  if (feature.type === 'extrude') {
    const tool = combineShapes(feature.profiles.map((profile) => extrudeProfile(profile, feature.distanceValue)));
    const bodyId = `body-${feature.id}`;
    if (feature.operation === 'new' || !feature.targetBodyId) {
      bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: 'brep', shape: tool });
      bodyOrder.push(bodyId);
      return;
    }

    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    if (feature.operation === 'join') target.shape = target.shape.fuse(tool);
    else if (feature.operation === 'cut') target.shape = target.shape.cut(tool);
    else if (feature.operation === 'intersect') target.shape = target.shape.intersect(tool);
    else throw new Error(`Nieobsługiwana operacja bryłowa: ${feature.operation}`);
    return;
  }

  if (feature.type === 'hole') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    const { x, y } = feature.profile.geometry;
    const plane = feature.profile.plane || 'XY';
    const placement = plane === 'XZ'
      ? { origin: [x, 1, y], direction: [0, -1, 0] }
      : plane === 'YZ'
        ? { origin: [-1, x, y], direction: [1, 0, 0] }
        : { origin: [x, y, -1], direction: [0, 0, 1] };
    const cutter = makeCylinder(feature.diameterValue / 2, feature.depthValue + 2, placement.origin, placement.direction);
    target.shape = target.shape.cut(cutter);
    return;
  }

  if (feature.type === 'fillet' || feature.type === 'chamfer') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    target.shape = feature.type === 'fillet'
      ? target.shape.fillet(feature.sizeValue)
      : target.shape.chamfer(feature.sizeValue);
  }
}

function faceDescriptor(face) {
  try {
    const center = face.center.toTuple();
    return {
      geometry: face.geomType,
      center,
      normal: face.normalAt(center).toTuple(),
      orientation: face.orientation,
    };
  } catch (_error) {
    return { geometry: 'UNKNOWN_FACE' };
  }
}

function edgeDescriptor(edge) {
  try {
    const start = edge.startPoint.toTuple();
    const end = edge.endPoint.toTuple();
    const ordered = [start, end].sort((left, right) => {
      for (let axis = 0; axis < 3; axis += 1) {
        if (left[axis] !== right[axis]) return left[axis] - right[axis];
      }
      return 0;
    });
    return {
      geometry: edge.geomType,
      endpoints: ordered,
      length: edge.length,
      closed: edge.isClosed,
    };
  } catch (_error) {
    return { geometry: 'UNKNOWN_EDGE' };
  }
}

function measureBodyShape(shape) {
  const surface = measureShapeSurfaceProperties(shape);
  const volume = measureShapeVolumeProperties(shape);
  const boundingBox = shape.boundingBox;
  try {
    const bounds = boundingBox.bounds.map((point) => [...point]);
    return {
      volume: volume.volume,
      area: surface.area,
      centerOfMass: [...volume.centerOfMass],
      bounds,
      dimensions: [
        bounds[1][0] - bounds[0][0],
        bounds[1][1] - bounds[0][1],
        bounds[1][2] - bounds[0][2],
      ],
      faceCount: shape.faces.length,
      edgeCount: shape.edges.length,
    };
  } finally {
    surface.delete();
    volume.delete();
    boundingBox.delete();
  }
}

function meshBody(body, index, quality = 'display') {
  const meshPolicy = quality === 'preview' ? GEOMETRY_POLICY.previewMesh : GEOMETRY_POLICY.displayMesh;
  const mesh = body.shape.mesh({
    tolerance: meshPolicy.linearTolerance,
    angularTolerance: meshPolicy.angularTolerance,
  });
  const edges = body.shape.meshEdges({
    tolerance: meshPolicy.linearTolerance,
    angularTolerance: meshPolicy.angularTolerance,
  });
  const shapeFaces = body.shape.faces;
  const shapeEdges = body.shape.edges;
  const previousTopology = topologyHistory.get(body.id) || { faces: [], edges: [] };
  const faces = assignStableTopologyIds(body.id, 'face', shapeFaces.map(faceDescriptor), previousTopology.faces)
    .map((record, faceIndex) => ({ ...record, sourceHash: shapeFaces[faceIndex].hashCode }));
  const stableEdges = assignStableTopologyIds(body.id, 'edge', shapeEdges.map(edgeDescriptor), previousTopology.edges)
    .map((record, edgeIndex) => ({ ...record, sourceHash: shapeEdges[edgeIndex].hashCode }));
  const faceIds = new Map(faces.map((face) => [face.sourceHash, face.id]));
  const edgeIds = new Map(stableEdges.map((edge) => [edge.sourceHash, edge.id]));
  const renderBody = {
    id: body.id,
    name: body.name,
    sourceFeatureId: body.sourceFeatureId,
    representation: 'mesh',
    color: ['#55b7db', '#81c784', '#ffb95c', '#c49cff'][index % 4],
    vertices: Float32Array.from(mesh.vertices),
    normals: Float32Array.from(mesh.normals),
    triangles: Uint32Array.from(mesh.triangles),
    lines: Float32Array.from(edges.lines),
    faceGroups: mesh.faceGroups.map((group) => ({
      start: group.start,
      count: group.count,
      sourceHash: group.faceId,
      topologyId: faceIds.get(group.faceId) || null,
    })),
    edgeGroups: edges.edgeGroups.map((group) => ({
      start: group.start,
      count: group.count,
      sourceHash: group.edgeId,
      topologyId: edgeIds.get(group.edgeId) || null,
    })),
    topology: {
      faces: faces.map(({ sourceHash, ...face }) => ({ ...face, sourceHash })),
      edges: stableEdges.map(({ sourceHash, ...edge }) => ({ ...edge, sourceHash })),
    },
    metrics: measureBodyShape(body.shape),
  };
  renderBody.bounds = renderBody.metrics.bounds;
  return { renderBody, topologyState: { faces, edges: stableEdges } };
}

async function evaluateRevision(document, quality) {
  await ensureKernel();
  const prepared = prepareDocument(document);
  const history = evaluateFeatureHistory(prepared.features, runFeature);
  const { bodyMap, bodyOrder, timeline } = history;

  const kernelBodies = bodyOrder.filter((id) => bodyMap.has(id)).map((id) => bodyMap.get(id));
  const meshedBodies = kernelBodies.map((body, index) => meshBody(body, index, quality));
  return {
    kernelBodies,
    renderBodies: meshedBodies.map((entry) => entry.renderBody),
    topologyByBody: new Map(meshedBodies.map((entry, index) => [kernelBodies[index].id, entry.topologyState])),
    timeline,
    parameters: prepared.parameters,
    dependencyGraph: prepared.dependencyGraph.toJSON(),
    quality,
  };
}

function transferableBuffers(bodies) {
  return bodies.flatMap((body) => [
    body.vertices.buffer,
    body.normals.buffer,
    body.triangles.buffer,
    body.lines.buffer,
  ]);
}

function cloneRenderBodies(bodies) {
  return bodies.map((body) => ({
    ...body,
    vertices: Float32Array.from(body.vertices),
    normals: Float32Array.from(body.normals),
    triangles: Uint32Array.from(body.triangles),
    lines: Float32Array.from(body.lines),
  }));
}

function commitTopology(topologyByBody) {
  for (const [bodyId, topology] of topologyByBody) topologyHistory.set(bodyId, topology);
}

function createRevisionError(revision) {
  const error = new Error(`Wynik rewizji ${revision} jest nieaktualny; oczekiwana rewizja to ${latestRequestedRevision}.`);
  error.code = 'STALE_REVISION';
  return error;
}

async function resolveRevision(document, revision, quality = 'display') {
  if (!Number.isInteger(revision) || revision < 1) {
    const error = new Error('Żądanie silnika CAD nie zawiera prawidłowej rewizji dokumentu.');
    error.code = 'INVALID_REVISION';
    throw error;
  }
  if (isStaleRevision(revision, latestRequestedRevision)) throw createRevisionError(revision);
  const cached = revisionCache.get(revision);
  if (cached) return cached;

  const evaluated = await evaluateRevision(document, quality);
  if (isStaleRevision(revision, latestRequestedRevision)) throw createRevisionError(revision);
  commitTopology(evaluated.topologyByBody);
  revisionCache.set(revision, evaluated, estimateMeshBytes(evaluated.renderBodies));
  return evaluated;
}

function relativeDifference(left, right) {
  const scale = Math.max(Math.abs(left), Math.abs(right), GEOMETRY_POLICY.linearTolerance);
  return Math.abs(left - right) / scale;
}

function compareRoundTrip(source, imported, tolerance) {
  const volumeDifference = relativeDifference(source.volume, imported.volume);
  const areaDifference = relativeDifference(source.area, imported.area);
  const dimensionDifferences = source.dimensions.map((value, index) => relativeDifference(value, imported.dimensions[index]));
  const dimensionAbsoluteDifferences = source.dimensions.map((value, index) => Math.abs(value - imported.dimensions[index]));
  return {
    valid: volumeDifference <= tolerance
      && areaDifference <= tolerance
      && dimensionAbsoluteDifferences.every((difference) => difference <= GEOMETRY_POLICY.roundTrip.boundsAbsoluteTolerance),
    tolerance,
    boundsAbsoluteTolerance: GEOMETRY_POLICY.roundTrip.boundsAbsoluteTolerance,
    source,
    imported,
    differences: {
      volume: volumeDifference,
      area: areaDifference,
      dimensions: dimensionDifferences,
      dimensionsAbsolute: dimensionAbsoluteDifferences,
    },
  };
}

async function validateExportRoundTrip(kernelBodies, blobs, format) {
  const tolerance = format === 'step'
    ? GEOMETRY_POLICY.roundTrip.stepRelativeTolerance
    : GEOMETRY_POLICY.roundTrip.stlRelativeTolerance;
  return Promise.all(blobs.map(async (blob, index) => {
    const imported = format === 'step' ? await importSTEP(blob) : await importSTL(blob);
    try {
      return compareRoundTrip(measureBodyShape(kernelBodies[index].shape), measureBodyShape(imported), tolerance);
    } finally {
      imported.delete?.();
    }
  }));
}

async function exportBodies(kernelBodies, format, validateRoundTrip = false) {
  if (!kernelBodies.length) throw new Error('Brak bryły do eksportu.');
  if (format !== 'step' && format !== 'stl') throw new Error(`Nieobsługiwany format eksportu: ${format}.`);
  const blobs = await Promise.all(kernelBodies.map(({ shape }) => (
    format === 'step'
      ? shape.blobSTEP()
      : shape.blobSTL({
        tolerance: GEOMETRY_POLICY.exportMesh.linearTolerance,
        angularTolerance: GEOMETRY_POLICY.exportMesh.angularTolerance,
        binary: true,
      })
  )));
  const roundTrip = validateRoundTrip ? await validateExportRoundTrip(kernelBodies, blobs, format) : [];
  return { buffers: await Promise.all(blobs.map((blob) => blob.arrayBuffer())), roundTrip };
}

async function handleMessage(data) {
  const { id, type, document, format, revision, quality = 'display', validateRoundTrip = false } = data;
  if (type === 'evaluate') {
    const evaluated = await resolveRevision(document, revision, quality);
    const bodies = cloneRenderBodies(evaluated.renderBodies);
    const result = {
      revision,
      quality: evaluated.quality,
      bodies,
      timeline: evaluated.timeline,
      parameters: evaluated.parameters,
      dependencyGraph: evaluated.dependencyGraph,
      cache: revisionCache.stats,
    };
    self.postMessage({ id, ok: true, type, result }, transferableBuffers(bodies));
    return;
  }
  if (type === 'export') {
    const evaluated = await resolveRevision(document, revision, 'display');
    const exported = await exportBodies(evaluated.kernelBodies, format, validateRoundTrip);
    self.postMessage({ id, ok: true, type, result: { format, revision, ...exported } }, exported.buffers);
    return;
  }
  const error = new Error(`Nieznane polecenie: ${type}`);
  error.code = 'UNKNOWN_COMMAND';
  throw error;
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'evaluate' && Number.isInteger(data.revision)) {
    latestRequestedRevision = Math.max(latestRequestedRevision, data.revision);
  }
  requestQueue.enqueue(() => handleMessage(data)).catch((error) => {
    self.postMessage({
      id: data.id,
      ok: false,
      type: data.type,
      code: error?.code || 'CAD_ENGINE_ERROR',
      canceled: error?.code === 'STALE_REVISION',
      error: error?.message || String(error),
    });
  });
});
