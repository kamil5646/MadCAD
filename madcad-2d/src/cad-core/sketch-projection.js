import { createSketchLine, createSketchPoint } from './sketch-model.js';
import { createTopologyReference } from './topology-references.js';
import { refreshDetectedSketchProfiles } from './sketch-topology.js';

function localPoint(point, plane) {
  if (!Array.isArray(point) || point.length !== 3) throw new Error('Projektowany punkt nie ma współrzędnych 3D.');
  if (plane === 'XZ') return [point[0], point[2]];
  if (plane === 'YZ') return [point[1], point[2]];
  return [point[0], point[1]];
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
