import { createSketchLine, createSketchPoint } from './sketch-model.js';
import { createTopologyReference } from './topology-references.js';
import { refreshDetectedSketchProfiles } from './sketch-topology.js';

function localPoint(point, plane) {
  if (!Array.isArray(point) || point.length !== 3) throw new Error('Projektowany punkt nie ma współrzędnych 3D.');
  if (plane === 'XZ') return [point[0], point[2]];
  if (plane === 'YZ') return [point[1], point[2]];
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
  const nextX = String(coordinates[0]);
  const nextY = String(coordinates[1]);
  if (String(point.geometry.x) === nextX && String(point.geometry.y) === nextY) return false;
  point.geometry.x = nextX;
  point.geometry.y = nextY;
  return true;
}

function findOrCreatePoint(sketch, coordinates, referenceId) {
  const existing = sketch.entities.find((entity) => entity.type === 'point' && entity.role === 'projected'
    && Math.hypot(Number(entity.geometry.x) - coordinates[0], Number(entity.geometry.y) - coordinates[1]) <= 1e-9);
  if (existing) return existing;
  const point = createSketchPoint({
    x: coordinates[0],
    y: coordinates[1],
    role: 'projected',
    fixed: true,
    sourceReferenceId: referenceId,
  });
  point.projectionReferenceId = referenceId;
  sketch.entities.push(point);
  return point;
}

export function projectTopologyToSketch(document, sketchId, sources = []) {
  const sketch = document.sketches.find((candidate) => candidate.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono aktywnego szkicu dla Project.');
  if (!Array.isArray(sources) || !sources.length) throw new Error('Project wymaga wybranego punktu albo krawędzi.');
  const createdEntityIds = [];
  const createdReferenceIds = [];
  for (const source of sources) {
    if (!['vertex', 'edge'].includes(source.selection?.kind)) throw new Error('Project obsługuje wierzchołki i krawędzie.');
    const reference = createTopologyReference({ selection: source.selection, descriptor: source.descriptor, label: `Project — ${source.selection.kind}` });
    document.references.push(reference);
    createdReferenceIds.push(reference.id);
    if (source.selection.kind === 'vertex') {
      const point = findOrCreatePoint(sketch, localPoint(source.descriptor?.point, sketch.plane), reference.id);
      createdEntityIds.push(point.id);
      continue;
    }
    const endpoints = source.descriptor?.endpoints;
    if (!Array.isArray(endpoints) || endpoints.length !== 2) throw new Error('Projektowana krawędź nie ma dwóch końców.');
    const localEndpoints = endpoints.map((point) => localPoint(point, sketch.plane));
    if (Math.hypot(localEndpoints[1][0] - localEndpoints[0][0], localEndpoints[1][1] - localEndpoints[0][1]) <= 1e-9) {
      const point = findOrCreatePoint(sketch, localEndpoints[0], reference.id);
      createdEntityIds.push(point.id);
      continue;
    }
    const points = localEndpoints.map((point) => findOrCreatePoint(sketch, point, reference.id));
    const duplicate = sketch.entities.find((entity) => entity.type === 'line' && entity.role === 'projected'
      && ((entity.pointIds[0] === points[0].id && entity.pointIds[1] === points[1].id) || (entity.pointIds[0] === points[1].id && entity.pointIds[1] === points[0].id)));
    if (duplicate) continue;
    const line = createSketchLine({
      startPointId: points[0].id,
      endPointId: points[1].id,
      role: 'projected',
      fixed: true,
      sourceReferenceId: reference.id,
    });
    line.projectionReferenceId = reference.id;
    sketch.entities.push(line);
    createdEntityIds.push(line.id);
  }
  refreshDetectedSketchProfiles(sketch, document.parameters);
  return { createdEntityIds, createdReferenceIds };
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
    const projectedLines = (sketch.entities || []).filter((entity) => entity.type === 'line' && entity.role === 'projected');
    const projectedLinePointIds = new Set(projectedLines.flatMap((line) => line.pointIds || []));

    for (const point of (sketch.entities || []).filter((entity) => entity.type === 'point' && entity.role === 'projected' && !projectedLinePointIds.has(entity.id))) {
      const referenceId = point.projectionReferenceId || point.sourceReferenceId;
      const record = records.get(referenceId);
      const worldPoint = record?.descriptor?.point || record?.descriptor?.endpoints?.[0];
      if (worldPoint && setPointCoordinates(point, localPoint(worldPoint, sketch.plane))) updatedEntityIds.add(point.id);
    }

    for (const line of projectedLines) {
      const referenceId = line.projectionReferenceId || line.sourceReferenceId;
      const endpoints = records.get(referenceId)?.descriptor?.endpoints;
      if (!Array.isArray(endpoints) || endpoints.length !== 2) continue;
      const localEndpoints = endpoints.map((point) => localPoint(point, sketch.plane));
      if (Math.hypot(localEndpoints[1][0] - localEndpoints[0][0], localEndpoints[1][1] - localEndpoints[0][1]) <= 1e-9) continue;
      line.pointIds.forEach((pointId, index) => {
        const point = entityMap.get(pointId);
        if (point?.type === 'point' && setPointCoordinates(point, localEndpoints[index])) updatedEntityIds.add(point.id);
      });
      if (line.pointIds.some((pointId) => updatedEntityIds.has(pointId))) updatedEntityIds.add(line.id);
    }
    if ((sketch.entities || []).some((entity) => updatedEntityIds.has(entity.id))) refreshDetectedSketchProfiles(sketch, document.parameters);
  }

  return {
    updatedEntityIds: [...updatedEntityIds],
    updatedReferenceIds,
    lostReferenceIds,
  };
}
