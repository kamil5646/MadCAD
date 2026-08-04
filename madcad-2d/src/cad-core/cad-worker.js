import opencascade from 'replicad-opencascadejs';
import opencascadeWasm from 'replicad-opencascadejs/src/replicad_single.wasm?url';
import { drawCircle, drawRectangle, makeCylinder, setOC } from 'replicad';
import { FEATURE_STATUS, prepareDocument } from './evaluator.js';
import { evaluateFeatureHistory } from './feature-history.js';
import { GEOMETRY_POLICY } from './geometry-policy.js';

let kernelPromise;
let lastBodies = [];

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

function meshBody(body, index) {
  const mesh = body.shape.mesh({
    tolerance: GEOMETRY_POLICY.displayMesh.linearTolerance,
    angularTolerance: GEOMETRY_POLICY.displayMesh.angularTolerance,
  });
  const edges = body.shape.meshEdges({
    tolerance: GEOMETRY_POLICY.displayMesh.linearTolerance,
    angularTolerance: GEOMETRY_POLICY.displayMesh.angularTolerance,
  });
  return {
    id: body.id,
    name: body.name,
    sourceFeatureId: body.sourceFeatureId,
    representation: 'mesh',
    color: ['#55b7db', '#81c784', '#ffb95c', '#c49cff'][index % 4],
    vertices: Float32Array.from(mesh.vertices),
    normals: Float32Array.from(mesh.normals),
    triangles: Uint32Array.from(mesh.triangles),
    lines: Float32Array.from(edges.lines),
    bounds: body.shape.boundingBox.bounds,
  };
}

async function evaluate(document) {
  await ensureKernel();
  const prepared = prepareDocument(document);
  const history = evaluateFeatureHistory(prepared.features, runFeature);
  const { bodyMap, bodyOrder, timeline } = history;

  lastBodies = bodyOrder.filter((id) => bodyMap.has(id)).map((id) => bodyMap.get(id));
  const bodies = lastBodies.map(meshBody);
  return { bodies, timeline, parameters: prepared.parameters, dependencyGraph: prepared.dependencyGraph.toJSON() };
}

function transferableBuffers(bodies) {
  return bodies.flatMap((body) => [
    body.vertices.buffer,
    body.normals.buffer,
    body.triangles.buffer,
    body.lines.buffer,
  ]);
}

async function exportBodies(format) {
  if (!lastBodies.length) throw new Error('Brak bryły do eksportu.');
  const blobs = await Promise.all(lastBodies.map(({ shape }) => (
    format === 'step'
      ? shape.blobSTEP()
      : shape.blobSTL({
        tolerance: GEOMETRY_POLICY.exportMesh.linearTolerance,
        angularTolerance: GEOMETRY_POLICY.exportMesh.angularTolerance,
        binary: true,
      })
  )));
  return Promise.all(blobs.map((blob) => blob.arrayBuffer()));
}

self.addEventListener('message', async (event) => {
  const { id, type, document, format } = event.data;
  try {
    if (type === 'evaluate') {
      const result = await evaluate(document);
      self.postMessage({ id, ok: true, type, result }, transferableBuffers(result.bodies));
      return;
    }
    if (type === 'export') {
      const buffers = await exportBodies(format);
      self.postMessage({ id, ok: true, type, result: { format, buffers } }, buffers);
      return;
    }
    throw new Error(`Nieznane polecenie: ${type}`);
  } catch (error) {
    self.postMessage({ id, ok: false, type, error: error?.message || String(error) });
  }
});
