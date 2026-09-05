import { createProjectedSketchBSpline3D, createSketchArc3D, createSketchLine, createSketchPoint, createSketchPoint3D } from './sketch-model.js';
import { createTopologyReference } from './topology-references.js';
import { refreshDetectedSketchProfiles } from './sketch-topology.js';

function localPoint(point, sketch) {
  if (!Array.isArray(point) || point.length !== 3) throw new Error('Projektowany punkt nie ma współrzędnych 3D.');
  if (sketch.space === '3d') return [...point];
  if (sketch.plane === 'XZ') return [point[0], point[2]];
  if (sketch.plane === 'YZ') return [point[1], point[2]];
  return [point[0], point[1]];
}

function topologyRecords(body, kind) {
  const key = kind === 'edge' ? 'edges' : kind === 'vertex' ? 'vertices' : 'faces';
  return body?.topology?.[key] || [];
}

function resolvedRecord(reference, bodies) {
  const body = (bodies || []).find((candidate) => candidate.id === reference.bodyId);
  return topologyRecords(body, reference.topologyKind).find((record) => record.id === reference.topologyId) || null;
}

function setPointCoordinates(point, coordinates) {
  const axes = coordinates.length === 3 ? ['x', 'y', 'z'] : ['x', 'y'];
  const changed = axes.some((axis, index) => String(point.geometry[axis]) !== String(coordinates[index]));
  if (!changed) return false;
  axes.forEach((axis, index) => { point.geometry[axis] = String(coordinates[index]); });
  return changed;
}

function findOrCreatePoint(sketch, coordinates, referenceId) {
  const existing = sketch.entities.find((entity) => entity.type === 'point' && entity.role === 'projected'
    && Math.hypot(...coordinates.map((value, index) => Number(entity.geometry[['x', 'y', 'z'][index]]) - value)) <= 1e-9);
  if (existing) return existing;
  const point = (sketch.space === '3d' ? createSketchPoint3D : createSketchPoint)({
    x: coordinates[0], y: coordinates[1], ...(sketch.space === '3d' ? { z: coordinates[2] } : {}),
    role: 'projected',
    fixed: true,
    sourceReferenceId: referenceId,
  });
  point.projectionReferenceId = referenceId;
  sketch.entities.push(point);
  return point;
}

function spatialEdgeType(descriptor) {
  if (descriptor?.geometry === 'LINE') return 'line';
  if (descriptor?.geometry === 'CIRCLE' && !descriptor.closed) return 'arc3d';
  if (descriptor?.geometry === 'BSPLINE_CURVE' && !descriptor.closed && descriptor.bspline) return 'bspline3d';
  return null;
}

function referenceForSelection(document, selection) {
  return (document.references || []).find((reference) => reference.kind === 'topology'
    && reference.topologyKind === selection.kind
    && reference.topologyId === selection.id
    && reference.bodyId === selection.bodyId) || null;
}

function projectedEntityForReference(sketch, referenceId) {
  return sketch.entities.find((entity) => entity.role === 'projected'
    && (entity.projectionReferenceId === referenceId || entity.sourceReferenceId === referenceId)) || null;
}

export function projectTopologyToSketch(document, sketchId, sources = []) {
  const sketch = document.sketches.find((candidate) => candidate.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono aktywnego szkicu dla Project.');
  if (!Array.isArray(sources) || !sources.length) throw new Error('Project wymaga wybranego punktu albo krawędzi.');
  for (const source of sources) {
    if (!['vertex', 'edge'].includes(source.selection?.kind)) throw new Error('Project obsługuje wierzchołki i krawędzie.');
    if (source.selection.kind === 'vertex') {
      localPoint(source.descriptor?.point, sketch);
      continue;
    }
    if (sketch.space === '3d' && !spatialEdgeType(source.descriptor)) throw new Error('Ścieżka skojarzona 3D obsługuje proste krawędzie oraz otwarte łuki i B-spline modelu.');
    const endpoints = source.descriptor?.endpoints;
    if (!Array.isArray(endpoints) || endpoints.length !== 2) throw new Error('Projektowana krawędź nie ma dwóch końców.');
    endpoints.forEach((point) => localPoint(point, sketch));
    if (sketch.space === '3d' && spatialEdgeType(source.descriptor) === 'arc3d') localPoint(source.descriptor?.midpoint, sketch);
    if (sketch.space === '3d' && spatialEdgeType(source.descriptor) === 'bspline3d' && (!Array.isArray(source.descriptor.samples) || source.descriptor.samples.length < 2)) throw new Error('B-spline źródłowa nie ma danych podglądu krzywej.');
  }
  const createdEntityIds = [];
  const createdReferenceIds = [];
  for (const source of sources) {
    let reference = referenceForSelection(document, source.selection);
    const existingEntity = reference ? projectedEntityForReference(sketch, reference.id) : null;
    if (existingEntity) {
      createdEntityIds.push(existingEntity.id);
      continue;
    }
    if (!reference) {
      reference = createTopologyReference({ selection: source.selection, descriptor: source.descriptor, label: `Project — ${source.selection.kind}` });
      document.references.push(reference);
      createdReferenceIds.push(reference.id);
    }
    if (source.selection.kind === 'vertex') {
      const point = findOrCreatePoint(sketch, localPoint(source.descriptor?.point, sketch), reference.id);
      createdEntityIds.push(point.id);
      continue;
    }
    const endpoints = source.descriptor?.endpoints;
    const localEndpoints = endpoints.map((point) => localPoint(point, sketch));
    if (Math.hypot(...localEndpoints[1].map((value, axis) => value - localEndpoints[0][axis])) <= 1e-9) {
      const point = findOrCreatePoint(sketch, localEndpoints[0], reference.id);
      createdEntityIds.push(point.id);
      continue;
    }
    const points = localEndpoints.map((point) => findOrCreatePoint(sketch, point, reference.id));
    const spatialType = sketch.space === '3d' ? spatialEdgeType(source.descriptor) : 'line';
    const through = spatialType === 'arc3d' ? localPoint(source.descriptor.midpoint, sketch) : null;
    const curve = spatialType === 'arc3d'
      ? createSketchArc3D({
        startPointId: points[0].id,
        endPointId: points[1].id,
        throughX: through[0],
        throughY: through[1],
        throughZ: through[2],
        role: 'projected',
        fixed: true,
        sourceReferenceId: reference.id,
        surfaceFaceIds: source.descriptor.surfaceFaceIds,
      })
      : spatialType === 'bspline3d'
        ? createProjectedSketchBSpline3D({
          startPointId: points[0].id,
          endPointId: points[1].id,
          bspline: source.descriptor.bspline,
          samples: source.descriptor.samples,
          role: 'projected',
          fixed: true,
          sourceReferenceId: reference.id,
          surfaceFaceIds: source.descriptor.surfaceFaceIds,
        })
      : createSketchLine({
        startPointId: points[0].id,
        endPointId: points[1].id,
        role: 'projected',
        fixed: true,
        sourceReferenceId: reference.id,
        surfaceFaceIds: source.descriptor.surfaceFaceIds,
      });
    curve.projectionReferenceId = reference.id;
    sketch.entities.push(curve);
    createdEntityIds.push(curve.id);
  }
  if (sketch.space !== '3d') refreshDetectedSketchProfiles(sketch, document.parameters);
  return {
    createdEntityIds,
    createdReferenceIds,
    surfaceFaceIds: [...new Set(sources.flatMap((source) => source.descriptor?.surfaceFaceIds || []))],
  };
}

export function createSurfaceProjectedSketchPath(document, sketchId, { selection, descriptor, sourceEntityIds = [] } = {}) {
  const sketch = document.sketches.find((candidate) => candidate.id === sketchId);
  if (!sketch || sketch.space !== '3d') throw new Error('Project to Surface wymaga aktywnego szkicu 3D.');
  if (selection?.kind !== 'face' || !selection.id || !selection.bodyId) throw new Error('Project to Surface wymaga wybranej ściany modelu.');
  if (descriptor?.geometry !== 'BSPLINE_CURVE' || !descriptor.bspline || !Array.isArray(descriptor.samples) || descriptor.samples.length < 2) throw new Error('Project to Surface nie otrzymał poprawnej krzywej wynikowej.');
  const reference = createTopologyReference({ selection, descriptor: { surface: true }, label: 'Project to Surface — ściana' });
  document.references.push(reference);
  const endpoints = descriptor.endpoints.map((point) => findOrCreatePoint(sketch, localPoint(point, sketch), reference.id));
  const curve = createProjectedSketchBSpline3D({
    startPointId: endpoints[0].id,
    endPointId: endpoints[1].id,
    bspline: descriptor.bspline,
    samples: descriptor.samples,
    role: 'projected',
    fixed: true,
    sourceReferenceId: reference.id,
    surfaceFaceIds: [selection.id],
    surfaceProjection: { sourceSketchId: sketchId, sourceEntityIds: [...sourceEntityIds], faceReferenceId: reference.id },
  });
  curve.projectionReferenceId = reference.id;
  sketch.entities.push(curve);
  return { createdEntityId: curve.id, createdReferenceId: reference.id };
}

export function updateSurfaceProjectedSketchPath(document, entityId, descriptor) {
  const sketch = document.sketches.find((candidate) => candidate.entities.some((entity) => entity.id === entityId));
  const curve = sketch?.entities.find((entity) => entity.id === entityId && entity.type === 'bspline3d' && entity.surfaceProjection);
  if (!curve || descriptor?.geometry !== 'BSPLINE_CURVE' || !descriptor.bspline || !Array.isArray(descriptor.samples) || descriptor.samples.length < 2) return false;
  const sameGeometry = JSON.stringify(curve.geometry.bspline) === JSON.stringify(descriptor.bspline)
    && JSON.stringify(curve.geometry.samples) === JSON.stringify(descriptor.samples)
    && JSON.stringify(curve.surfaceFaceIds || []) === JSON.stringify(descriptor.surfaceFaceIds || []);
  if (sameGeometry) return false;
  const entityMap = new Map(sketch.entities.map((entity) => [entity.id, entity]));
  descriptor.endpoints.forEach((coordinates, index) => {
    const point = entityMap.get(curve.pointIds[index]);
    if (point?.type === 'point') setPointCoordinates(point, localPoint(coordinates, sketch));
  });
  curve.geometry.bspline = structuredClone(descriptor.bspline);
  curve.geometry.samples = structuredClone(descriptor.samples);
  curve.surfaceFaceIds = [...new Set(descriptor.surfaceFaceIds || [])];
  return true;
}

export function synchronizeProjectedGeometry(document, bodies = []) {
  const referenceMap = new Map((document.references || [])
    .filter((reference) => reference.kind === 'topology')
    .map((reference) => [reference.id, reference]));
  const usedReferenceIds = new Set((document.sketches || []).flatMap((sketch) => (sketch.entities || [])
    .filter((entity) => entity.role === 'projected')
    .map((entity) => entity.projectionReferenceId || entity.sourceReferenceId)
    .filter(Boolean)));
  const records = new Map();
  const lostReferenceIds = [];
  const updatedReferenceIds = [];
  for (const referenceId of usedReferenceIds) {
    const reference = referenceMap.get(referenceId);
    const record = reference ? resolvedRecord(reference, bodies) : null;
    records.set(referenceId, record);
    if (!record) {
      lostReferenceIds.push(referenceId);
      continue;
    }
    if (JSON.stringify(reference.descriptor) !== JSON.stringify(record.descriptor)) {
      reference.descriptor = structuredClone(record.descriptor);
      updatedReferenceIds.push(referenceId);
    }
  }

  const updatedEntityIds = new Set();
  for (const sketch of document.sketches || []) {
    const entityMap = new Map((sketch.entities || []).map((entity) => [entity.id, entity]));
    const projectedCurves = (sketch.entities || []).filter((entity) => ['line', 'arc3d', 'bspline3d'].includes(entity.type) && entity.role === 'projected');
    const projectedCurvePointIds = new Set(projectedCurves.flatMap((curve) => curve.pointIds || []));

    for (const point of (sketch.entities || []).filter((entity) => entity.type === 'point' && entity.role === 'projected' && !projectedCurvePointIds.has(entity.id))) {
      const referenceId = point.projectionReferenceId || point.sourceReferenceId;
      const record = records.get(referenceId);
      const worldPoint = record?.descriptor?.point || record?.descriptor?.endpoints?.[0];
      if (worldPoint && setPointCoordinates(point, localPoint(worldPoint, sketch))) updatedEntityIds.add(point.id);
    }

    for (const curve of projectedCurves) {
      const referenceId = curve.projectionReferenceId || curve.sourceReferenceId;
      const descriptor = records.get(referenceId)?.descriptor;
      const endpoints = descriptor?.endpoints;
      if (!Array.isArray(endpoints) || endpoints.length !== 2) continue;
      const localEndpoints = endpoints.map((point) => localPoint(point, sketch));
      if (Math.hypot(...localEndpoints[1].map((value, axis) => value - localEndpoints[0][axis])) <= 1e-9) continue;
      curve.pointIds.forEach((pointId, index) => {
        const point = entityMap.get(pointId);
        if (point?.type === 'point' && setPointCoordinates(point, localEndpoints[index])) updatedEntityIds.add(point.id);
      });
      let curveChanged = curve.pointIds.some((pointId) => updatedEntityIds.has(pointId));
      const surfaceFaceIds = Array.isArray(descriptor?.surfaceFaceIds) ? [...new Set(descriptor.surfaceFaceIds)] : [];
      if (JSON.stringify(curve.surfaceFaceIds || []) !== JSON.stringify(surfaceFaceIds)) {
        if (surfaceFaceIds.length) curve.surfaceFaceIds = surfaceFaceIds;
        else delete curve.surfaceFaceIds;
        curveChanged = true;
      }
      if (curve.type === 'arc3d' && Array.isArray(descriptor?.midpoint)) {
        const through = localPoint(descriptor.midpoint, sketch);
        ['X', 'Y', 'Z'].forEach((axis, index) => {
          if (String(curve.geometry[`through${axis}`]) === String(through[index])) return;
          curve.geometry[`through${axis}`] = String(through[index]);
          curveChanged = true;
        });
      }
      if (curve.type === 'bspline3d' && descriptor?.bspline && Array.isArray(descriptor.samples)) {
        if (JSON.stringify(curve.geometry.bspline) !== JSON.stringify(descriptor.bspline) || JSON.stringify(curve.geometry.samples) !== JSON.stringify(descriptor.samples)) {
          curve.geometry.bspline = structuredClone(descriptor.bspline);
          curve.geometry.samples = structuredClone(descriptor.samples);
          curveChanged = true;
        }
      }
      if (curveChanged) updatedEntityIds.add(curve.id);
    }
    if (sketch.space !== '3d' && (sketch.entities || []).some((entity) => updatedEntityIds.has(entity.id))) refreshDetectedSketchProfiles(sketch, document.parameters);
  }

  return {
    updatedEntityIds: [...updatedEntityIds],
    updatedReferenceIds,
    lostReferenceIds,
  };
}
