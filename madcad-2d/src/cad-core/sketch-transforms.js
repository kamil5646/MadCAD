import { evaluateExpression, resolveParameters } from './expressions.js';
import { createSketchArc, createSketchCircleEntity, createSketchLine, createSketchPoint } from './sketch-model.js';
import { refreshDetectedSketchProfiles } from './sketch-topology.js';

const EPSILON = 1e-7;
const SUPPORTED_TYPES = new Set(['point', 'line', 'arc', 'circle']);

function parameterValues(parameters) {
  if (!Array.isArray(parameters)) return parameters || {};
  const resolved = resolveParameters(parameters);
  if (!resolved.valid) throw new Error(Object.values(resolved.errors).join(' '));
  return resolved.values;
}

function numeric(value, parameters, label) {
  const result = evaluateExpression(value, parameterValues(parameters));
  if (!Number.isFinite(result)) throw new Error(`${label} wymaga skończonej wartości.`);
  return result;
}

function selectionData(sketch, selectedIds) {
  const selected = new Set(selectedIds || []);
  const entities = (sketch.entities || []).filter((entity) => selected.has(entity.id));
  if (!entities.length) throw new Error('Wybierz geometrię szkicu do transformacji.');
  if (entities.some((entity) => !SUPPORTED_TYPES.has(entity.type))) throw new Error('Transformacja obsługuje obecnie punkty, linie, łuki i okręgi.');
  if (entities.some((entity) => entity.fixed || entity.role === 'projected')) throw new Error('Geometria ustalona lub rzutowana nie może być transformowana.');
  const pointIds = new Set(entities.flatMap((entity) => entity.type === 'point' ? [entity.id] : (entity.pointIds || [])));
  const points = [...pointIds].map((pointId) => sketch.entities.find((entity) => entity.id === pointId && entity.type === 'point'));
  if (points.some((point) => !point)) throw new Error('Transformacja wskazuje brakujący punkt szkicu.');
  if (points.some((point) => point.fixed || point.role === 'projected')) throw new Error('Geometria ustalona lub rzutowana nie może być transformowana.');
  return { entities, points, pointIds, selected };
}

function cleanTouchedRelations(sketch, touchedIds) {
  const touched = new Set(touchedIds);
  const removedConstraintIds = (sketch.constraints || []).filter((constraint) => constraint.entityIds?.some((id) => touched.has(id))).map((constraint) => constraint.id);
  const removedConstraints = new Set(removedConstraintIds);
  const removedDimensionIds = (sketch.dimensions || []).filter((dimension) => dimension.entityIds?.some((id) => touched.has(id)) || removedConstraints.has(dimension.constraintId)).map((dimension) => dimension.id);
  sketch.constraints = (sketch.constraints || []).filter((constraint) => !removedConstraints.has(constraint.id));
  const removedDimensions = new Set(removedDimensionIds);
  sketch.dimensions = (sketch.dimensions || []).filter((dimension) => !removedDimensions.has(dimension.id));
  return { removedConstraintIds, removedDimensionIds };
}

function assertNoBlockingDimensions(sketch, touchedIds) {
  const touched = new Set(touchedIds);
  const constraintIds = new Set((sketch.constraints || []).filter((constraint) => constraint.entityIds?.some((id) => touched.has(id))).map((constraint) => constraint.id));
  if ((sketch.dimensions || []).some((dimension) => dimension.entityIds?.some((id) => touched.has(id)) || constraintIds.has(dimension.constraintId))) {
    throw new Error('Scale jest zablokowany przez wymiar zaznaczonej geometrii. Usuń wymiar albo użyj jego edycji parametrycznej.');
  }
}

function pointCoordinates(point, values) {
  return [evaluateExpression(point.geometry.x, values), evaluateExpression(point.geometry.y, values)];
}

function assertValidResult(sketch, parameters, touchedEntityIds, label) {
  refreshDetectedSketchProfiles(sketch, parameters);
  const touched = new Set(touchedEntityIds);
  const diagnostic = (sketch.diagnostics || []).find((item) => ['SELF_INTERSECTION', 'OVERLAPPING_SEGMENTS', 'ZERO_LENGTH_SEGMENT'].includes(item.code)
    && item.entityIds?.some((entityId) => touched.has(entityId)));
  if (diagnostic) throw new Error(`${label} został odrzucony: ${diagnostic.message}`);
}

function transformInPlace(document, sketchId, selectedIds, pointTransform, options) {
  const sketch = document?.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono szkicu do transformacji.');
  const workingSketch = structuredClone(sketch);
  const data = selectionData(workingSketch, selectedIds);
  const connectedEntityIds = workingSketch.entities.filter((entity) => entity.pointIds?.some((pointId) => data.pointIds.has(pointId))).map((entity) => entity.id);
  const touchedIds = [...new Set([...data.entities.map((entity) => entity.id), ...data.pointIds, ...connectedEntityIds])];
  if (options.blockDimensions) assertNoBlockingDimensions(workingSketch, touchedIds);
  const values = parameterValues(document.parameters);
  for (const point of data.points) {
    const [x, y] = pointTransform(pointCoordinates(point, values));
    if (![x, y].every(Number.isFinite)) throw new Error(`${options.label} utworzył nieprawidłową współrzędną.`);
    point.geometry.x = String(x);
    point.geometry.y = String(y);
  }
  if (options.flipArcs) {
    for (const entity of data.entities) {
      if (entity.type === 'arc') entity.geometry.direction = entity.geometry.direction === 'cw' ? 'ccw' : 'cw';
    }
  }
  if (options.circleScale) {
    for (const entity of data.entities) {
      if (entity.type === 'circle') entity.geometry.radius = String(evaluateExpression(entity.geometry.radius, values) * options.circleScale);
    }
  }
  const relationChanges = cleanTouchedRelations(workingSketch, touchedIds);
  assertValidResult(workingSketch, document.parameters, data.entities.filter((entity) => entity.type !== 'point').map((entity) => entity.id), options.label);
  Object.assign(sketch, workingSketch);
  return {
    transformedEntityIds: data.entities.map((entity) => entity.id),
    transformedPointIds: [...data.pointIds],
    ...relationChanges,
  };
}

export function rotateSketchSelection(document, sketchId, selectedIds, { centerX = 0, centerY = 0, angle = 0 } = {}) {
  const cx = numeric(centerX, document.parameters, 'Rotate');
  const cy = numeric(centerY, document.parameters, 'Rotate');
  const radians = numeric(angle, document.parameters, 'Rotate') * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return transformInPlace(document, sketchId, selectedIds, ([x, y]) => [
    cx + ((x - cx) * cosine) - ((y - cy) * sine),
    cy + ((x - cx) * sine) + ((y - cy) * cosine),
  ], { label: 'Rotate' });
}

export function mirrorSketchSelection(document, sketchId, selectedIds, { originX = 0, originY = 0, angle = 90 } = {}) {
  const ox = numeric(originX, document.parameters, 'Mirror');
  const oy = numeric(originY, document.parameters, 'Mirror');
  const radians = numeric(angle, document.parameters, 'Mirror') * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return transformInPlace(document, sketchId, selectedIds, ([x, y]) => {
    const dx = x - ox;
    const dy = y - oy;
    const along = (dx * cosine) + (dy * sine);
    const perpendicular = (-dx * sine) + (dy * cosine);
    return [ox + (along * cosine) + (perpendicular * sine), oy + (along * sine) - (perpendicular * cosine)];
  }, { label: 'Mirror', flipArcs: true });
}

export function scaleSketchSelection(document, sketchId, selectedIds, { centerX = 0, centerY = 0, factor = 1 } = {}) {
  const cx = numeric(centerX, document.parameters, 'Scale');
  const cy = numeric(centerY, document.parameters, 'Scale');
  const scale = numeric(factor, document.parameters, 'Scale');
  if (scale <= EPSILON) throw new Error('Scale wymaga dodatniego współczynnika większego od zera.');
  const result = transformInPlace(document, sketchId, selectedIds, ([x, y]) => [cx + ((x - cx) * scale), cy + ((y - cy) * scale)], { label: 'Scale', blockDimensions: true, circleScale: scale });
  return { ...result, factor: scale };
}

export function copySketchSelection(document, sketchId, selectedIds, { dx = 0, dy = 0 } = {}) {
  const sketch = document?.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono szkicu do kopiowania.');
  const offsetX = numeric(dx, document.parameters, 'Copy');
  const offsetY = numeric(dy, document.parameters, 'Copy');
  const workingSketch = structuredClone(sketch);
  const data = selectionData(workingSketch, selectedIds);
  const values = parameterValues(document.parameters);
  const pointMap = new Map();
  for (const point of data.points) {
    const [x, y] = pointCoordinates(point, values);
    pointMap.set(point.id, createSketchPoint({ x: x + offsetX, y: y + offsetY, role: point.role }));
  }
  const createdEntities = [];
  for (const entity of data.entities) {
    if (entity.type === 'point') continue;
    let copy;
    if (entity.type === 'line') copy = createSketchLine({ startPointId: pointMap.get(entity.pointIds[0]).id, endPointId: pointMap.get(entity.pointIds[1]).id, role: entity.role });
    else if (entity.type === 'arc') copy = createSketchArc({ centerPointId: pointMap.get(entity.pointIds[0]).id, startPointId: pointMap.get(entity.pointIds[1]).id, endPointId: pointMap.get(entity.pointIds[2]).id, direction: entity.geometry.direction, role: entity.role });
    else if (entity.type === 'circle') copy = createSketchCircleEntity({ centerPointId: pointMap.get(entity.pointIds[0]).id, radius: evaluateExpression(entity.geometry.radius, values), role: entity.role });
    createdEntities.push(copy);
  }
  const copiedStandalonePoints = data.entities.filter((entity) => entity.type === 'point').map((entity) => pointMap.get(entity.id));
  const createdPoints = [...new Set(pointMap.values())];
  workingSketch.entities.push(...createdPoints, ...createdEntities);
  assertValidResult(workingSketch, document.parameters, createdEntities.map((entity) => entity.id), 'Copy');
  Object.assign(sketch, workingSketch);
  return {
    createdEntityIds: [...copiedStandalonePoints.map((point) => point.id), ...createdEntities.map((entity) => entity.id)],
    createdPointIds: createdPoints.map((point) => point.id),
    profileIds: sketch.profiles.filter((profile) => profile.entityIds?.some((entityId) => createdEntities.some((entity) => entity.id === entityId))).map((profile) => profile.id),
  };
}
