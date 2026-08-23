import { createId } from './ids.js';
import { evaluateExpression, resolveParameters } from './expressions.js';
import { normalizeEntityLayerStyle } from './layers.js';

export const SKETCH_ENTITY_TYPES = Object.freeze([
  'point',
  'line',
  'arc',
  'circle',
  'ellipse',
  'ellipticalArc',
  'spline',
  'conic',
  'slot',
  'polygon',
  'text',
]);

export const SKETCH_ENTITY_ROLES = Object.freeze([
  'standard',
  'construction',
  'centerline',
  'projected',
]);

export const SKETCH_DIMENSION_TYPES = Object.freeze([
  'horizontal',
  'vertical',
  'aligned',
  'angle',
  'radius',
  'diameter',
  'ordinateX',
  'ordinateY',
  'arcLength',
]);

const ENTITY_TYPE_SET = new Set(SKETCH_ENTITY_TYPES);
const ENTITY_ROLE_SET = new Set(SKETCH_ENTITY_ROLES);
const DEFAULT_EXPRESSION_KEYS = Object.freeze({ point: ['x', 'y'], circle: ['radius'] });

function expression(value, fallback = 0) {
  return String(value ?? fallback);
}

function commonEntity(type, options = {}) {
  if (!ENTITY_TYPE_SET.has(type)) throw new Error(`Nieobsługiwany typ encji szkicu: ${type}.`);
  const role = options.role || (options.construction ? 'construction' : 'standard');
  if (!ENTITY_ROLE_SET.has(role)) throw new Error(`Nieobsługiwana rola encji szkicu: ${role}.`);
  return normalizeEntityLayerStyle({
    id: options.id || createId('entity'),
    type,
    role,
    fixed: Boolean(options.fixed),
    pointIds: [...(options.pointIds || [])],
    geometry: { ...(options.geometry || {}) },
    expressionKeys: [...(options.expressionKeys || DEFAULT_EXPRESSION_KEYS[type] || [])],
    layerId: options.layerId,
    color: options.color,
    lineType: options.lineType,
    lineWeight: options.lineWeight,
    ...(options.blockDefinitionId ? { blockDefinitionId: options.blockDefinitionId } : {}),
    ...(options.blockInstanceId ? { blockInstanceId: options.blockInstanceId } : {}),
    ...(options.blockSourceEntityId ? { blockSourceEntityId: options.blockSourceEntityId } : {}),
    ...(role === 'projected' ? { sourceReferenceId: options.sourceReferenceId || null } : {}),
  }, options.layerId);
}

export function createSketchEntity(type, options = {}) {
  return commonEntity(type, options);
}

export function createSketchPoint({ x = 0, y = 0, ...options } = {}) {
  return commonEntity('point', { ...options, pointIds: [], geometry: { x: expression(x), y: expression(y) } });
}

export function createSketchLine({ startPointId, endPointId, ...options } = {}) {
  return commonEntity('line', { ...options, pointIds: [startPointId, endPointId], geometry: {} });
}

export function createSketchArc({ centerPointId, startPointId, endPointId, direction = 'ccw', ...options } = {}) {
  return commonEntity('arc', {
    ...options,
    pointIds: [centerPointId, startPointId, endPointId],
    geometry: { direction },
  });
}

export function createSketchCircleEntity({ centerPointId, radius = 5, ...options } = {}) {
  return commonEntity('circle', {
    ...options,
    pointIds: [centerPointId],
    geometry: { radius: expression(radius, 5) },
  });
}

export function createSketchConstraint(type, entityIds, options = {}) {
  if (typeof type !== 'string' || !type.trim()) throw new Error('Wiązanie szkicu wymaga typu.');
  if (!Array.isArray(entityIds) || !entityIds.length) throw new Error('Wiązanie szkicu wymaga referencji do encji.');
  return {
    id: options.id || createId('constraint'),
    type,
    entityIds: [...entityIds],
    ...(options.value !== undefined ? { value: String(options.value) } : {}),
    ...(options.driving !== undefined ? { driving: Boolean(options.driving) } : {}),
  };
}

const DIMENSION_CONSTRAINT_TYPES = Object.freeze({
  horizontal: 'distanceX',
  vertical: 'distanceY',
  aligned: 'distance',
  angle: 'angle',
  radius: 'radius',
  diameter: 'diameter',
  ordinateX: 'coordinateX',
  ordinateY: 'coordinateY',
  arcLength: 'arcLength',
});

export function createSketchDimension(type, entityIds, options = {}) {
  if (!SKETCH_DIMENSION_TYPES.includes(type)) throw new Error(`Nieobsługiwany typ wymiaru szkicu: ${type}.`);
  if (!Array.isArray(entityIds) || !entityIds.length) throw new Error('Wymiar szkicu wymaga referencji do encji.');
  return {
    id: options.id || createId('dimension'),
    type,
    entityIds: [...entityIds],
    expression: expression(options.expression ?? options.value, 1),
    driving: options.driving !== false,
    ...(options.constraintId ? { constraintId: options.constraintId } : {}),
    ...(options.position ? { position: [...options.position] } : {}),
  };
}

export function addDrivingSketchDimension(sketch, type, entityIds, options = {}) {
  if (!SKETCH_DIMENSION_TYPES.includes(type)) throw new Error(`Nieobsługiwany typ wymiaru szkicu: ${type}.`);
  const value = options.expression ?? options.value ?? 1;
  const constraint = createSketchConstraint(DIMENSION_CONSTRAINT_TYPES[type], entityIds, {
    value,
    driving: true,
  });
  const dimension = createSketchDimension(type, entityIds, { ...options, expression: value, driving: true, constraintId: constraint.id });
  sketch.constraints = [...(sketch.constraints || []), constraint];
  sketch.dimensions = [...(sketch.dimensions || []), dimension];
  return { dimension, constraint };
}

export function boundaryPointIds(entity) {
  if (entity?.type === 'line') return [entity.pointIds?.[0], entity.pointIds?.[1]];
  if (entity?.type === 'arc' || entity?.type === 'ellipticalArc') return [entity.pointIds?.[1], entity.pointIds?.[2]];
  if (entity?.type === 'spline' || entity?.type === 'conic') return [entity.pointIds?.[0], entity.pointIds?.at(-1)];
  return [];
}

function numericCoordinate(point, axis) {
  const value = Number(point?.geometry?.[axis]);
  return Number.isFinite(value) ? value : 0;
}

export function createDetectedProfile(sketch, segmentIds, { name = 'Profil zamknięty' } = {}) {
  const entities = segmentIds.map((id) => entityById(sketch, id));
  if (entities.some((entity) => !entity)) throw new Error('Profil zawiera brakującą encję.');
  const endpoints = entities.map(boundaryPointIds);
  if (endpoints.some((pair) => pair.length !== 2)) throw new Error('Profil może zawierać tylko linie i łuki.');
  for (let index = 0; index < endpoints.length; index += 1) {
    const next = endpoints[(index + 1) % endpoints.length];
    if (endpoints[index][1] !== next[0]) throw new Error('Segmenty profilu nie tworzą ciągłej zamkniętej pętli.');
  }
  if (entities.length < 2) throw new Error('Profil wymaga co najmniej dwóch segmentów.');
  const pointIds = endpoints.map(([startPointId]) => startPointId);
  const points = pointIds.map((id) => entityById(sketch, id));
  const coordinates = points.map((point) => ({
    x: numericCoordinate(point, 'x'),
    y: numericCoordinate(point, 'y'),
  }));
  const minX = Math.min(...coordinates.map((point) => point.x));
  const maxX = Math.max(...coordinates.map((point) => point.x));
  const minY = Math.min(...coordinates.map((point) => point.y));
  const maxY = Math.max(...coordinates.map((point) => point.y));
  return {
    id: createId('profile'),
    name,
    type: 'closed',
    entityIds: [...segmentIds],
    closed: true,
    source: 'detected',
    geometry: {
      x: String((minX + maxX) / 2),
      y: String((minY + maxY) / 2),
      width: String(maxX - minX),
      height: String(maxY - minY),
      points: coordinates.map((point) => ({ x: String(point.x), y: String(point.y) })),
    },
  };
}

function resolvedValues(parameters) {
  if (!Array.isArray(parameters)) return parameters || {};
  const result = resolveParameters(parameters);
  if (!result.valid) throw new Error(Object.values(result.errors).join(' '));
  return result.values;
}

function evaluatedCoordinate(point, axis, parameters) {
  return evaluateExpression(point.geometry[axis], parameters);
}

export function sketchSelectionPointIds(sketch, selectedIds) {
  const selected = new Set(selectedIds || []);
  const points = new Set();
  for (const entity of sketch.entities || []) {
    if (!selected.has(entity.id)) continue;
    if (entity.type === 'point') points.add(entity.id);
    else for (const pointId of entity.pointIds || []) points.add(pointId);
  }
  return [...points];
}

export function synchronizeSketchProfiles(sketch, parameters = []) {
  const values = resolvedValues(parameters);
  const entityMap = new Map((sketch.entities || []).map((entity) => [entity.id, entity]));
  const readPoint = (pointId) => {
    const point = entityMap.get(pointId);
    if (point?.type !== 'point') return null;
    return {
      x: evaluatedCoordinate(point, 'x', values),
      y: evaluatedCoordinate(point, 'y', values),
    };
  };
  const boundsGeometry = (points) => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: String((minX + maxX) / 2),
      y: String((minY + maxY) / 2),
      width: String(maxX - minX),
      height: String(maxY - minY),
      points: points.map((point) => ({ x: String(point.x), y: String(point.y) })),
    };
  };

  for (const profile of sketch.profiles || []) {
    if (profile.type === 'circle') {
      const circle = entityMap.get(profile.entityIds?.[0]);
      const center = circle?.type === 'circle' ? readPoint(circle.pointIds?.[0]) : null;
      if (!center) continue;
      profile.geometry = {
        ...profile.geometry,
        x: String(center.x),
        y: String(center.y),
        diameter: String(evaluateExpression(circle.geometry.radius, values) * 2),
      };
      continue;
    }
    const segments = (profile.entityIds || []).map((id) => entityMap.get(id)).filter(Boolean);
    const pointIds = profile.type === 'closed'
      ? segments.map((entity) => boundaryPointIds(entity)[0])
      : [...new Set(segments.flatMap((entity) => entity.pointIds || []))];
    const points = pointIds.map(readPoint).filter(Boolean);
    if (points.length) profile.geometry = { ...profile.geometry, ...boundsGeometry(points) };
  }
  return sketch;
}

export function translateSketchSelection(sketch, selectedIds, { dx = 0, dy = 0 } = {}, parameters = []) {
  const deltaX = Number(dx);
  const deltaY = Number(dy);
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) throw new Error('Przesunięcie szkicu wymaga prawidłowych wartości X i Y.');
  const selected = new Set(selectedIds || []);
  const selectedEntities = (sketch.entities || []).filter((entity) => selected.has(entity.id));
  if (!selectedEntities.length) throw new Error('Wybierz punkt lub segment do przesunięcia.');
  if (selectedEntities.some((entity) => entity.fixed || entity.role === 'projected')) {
    throw new Error('Geometria ustalona lub rzutowana nie może być przeciągana.');
  }
  const values = resolvedValues(parameters);
  const pointIds = new Set(sketchSelectionPointIds(sketch, selectedIds));
  for (const point of sketch.entities || []) {
    if (point.type !== 'point' || !pointIds.has(point.id)) continue;
    if (point.fixed || point.role === 'projected') throw new Error('Geometria ustalona lub rzutowana nie może być przeciągana.');
    point.geometry.x = String(evaluatedCoordinate(point, 'x', values) + deltaX);
    point.geometry.y = String(evaluatedCoordinate(point, 'y', values) + deltaY);
  }
  for (const instance of sketch.blockInstances || []) {
    if (!instance.entityIds.every((entityId) => selected.has(entityId))) continue;
    instance.insertionPoint = [Number(instance.insertionPoint?.[0] || 0) + deltaX, Number(instance.insertionPoint?.[1] || 0) + deltaY];
  }
  const touchedIds = new Set([
    ...selectedEntities.map((entity) => entity.id),
    ...pointIds,
    ...(sketch.entities || []).filter((entity) => entity.pointIds?.some((pointId) => pointIds.has(pointId))).map((entity) => entity.id),
  ]);
  const removedConstraintIds = new Set((sketch.constraints || []).filter((constraint) => constraint.entityIds?.some((id) => touchedIds.has(id))).map((constraint) => constraint.id));
  sketch.constraints = (sketch.constraints || []).filter((constraint) => !removedConstraintIds.has(constraint.id));
  sketch.dimensions = (sketch.dimensions || []).filter((dimension) => !dimension.entityIds?.some((id) => touchedIds.has(id)) && !removedConstraintIds.has(dimension.constraintId));
  synchronizeSketchProfiles(sketch, values);
  return [...pointIds];
}

export function deleteSketchSelection(document, sketchId, selectedIds) {
  const sketch = (document.sketches || []).find((item) => item.id === sketchId);
  if (!sketch) throw new Error(`Nie znaleziono szkicu ${sketchId}.`);
  const selected = new Set(selectedIds || []);
  for (const instance of sketch.blockInstances || []) {
    if (instance.entityIds.some((entityId) => selected.has(entityId))) instance.entityIds.forEach((entityId) => selected.add(entityId));
  }
  const selectedPoints = new Set((sketch.entities || [])
    .filter((entity) => selected.has(entity.id) && entity.type === 'point')
    .map((entity) => entity.id));
  const removedEntityIds = new Set(selected);
  for (const entity of sketch.entities || []) {
    if ((entity.pointIds || []).some((pointId) => selectedPoints.has(pointId))) removedEntityIds.add(entity.id);
  }
  if (!removedEntityIds.size) return { entityIds: [], profileIds: [], featureIds: [] };
  const removedProfileIds = new Set((sketch.profiles || [])
    .filter((profile) => (profile.entityIds || []).some((entityId) => removedEntityIds.has(entityId)))
    .map((profile) => profile.id));
  sketch.entities = (sketch.entities || []).filter((entity) => !removedEntityIds.has(entity.id));
  sketch.blockInstances = (sketch.blockInstances || []).filter((instance) => !instance.entityIds.some((entityId) => removedEntityIds.has(entityId)));
  sketch.profiles = (sketch.profiles || []).filter((profile) => !removedProfileIds.has(profile.id));
  sketch.constraints = (sketch.constraints || []).filter((constraint) => !(constraint.entityIds || []).some((id) => removedEntityIds.has(id)));
  sketch.dimensions = (sketch.dimensions || []).filter((dimension) => !(dimension.entityIds || []).some((id) => removedEntityIds.has(id)));

  const removedFeatureIds = new Set();
  const removedBodyIds = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const feature of document.features || []) {
      if (removedFeatureIds.has(feature.id)) continue;
      const referencesRemovedProfile = (feature.profileIds || []).some((id) => removedProfileIds.has(id))
        || removedProfileIds.has(feature.profileId);
      if (!referencesRemovedProfile && !removedBodyIds.has(feature.targetBodyId)) continue;
      removedFeatureIds.add(feature.id);
      if (feature.type === 'extrude' && feature.operation === 'new') removedBodyIds.add(`body-${feature.id}`);
      changed = true;
    }
  }
  document.features = (document.features || []).filter((feature) => !removedFeatureIds.has(feature.id));
  return {
    entityIds: [...removedEntityIds],
    profileIds: [...removedProfileIds],
    featureIds: [...removedFeatureIds],
  };
}

export function createTangentArcContinuation({ startPointId, endPointId, start, end, tangent }) {
  const tangentLength = Math.hypot(tangent?.[0] || 0, tangent?.[1] || 0);
  if (!(tangentLength > 0)) throw new Error('Łuk styczny wymaga prawidłowego kierunku poprzedniego segmentu.');
  const unitTangent = [tangent[0] / tangentLength, tangent[1] / tangentLength];
  const chord = [end[0] - start[0], end[1] - start[1]];
  const normal = [-unitTangent[1], unitTangent[0]];
  const denominator = 2 * ((chord[0] * normal[0]) + (chord[1] * normal[1]));
  if (Math.abs(denominator) <= 1e-7) throw new Error('Punkt końcowy nie wyznacza skończonego łuku stycznego.');
  const signedRadius = ((chord[0] ** 2) + (chord[1] ** 2)) / denominator;
  const center = [start[0] + (normal[0] * signedRadius), start[1] + (normal[1] * signedRadius)];
  const centerPoint = createSketchPoint({ x: center[0].toFixed(3), y: center[1].toFixed(3) });
  const direction = signedRadius > 0 ? 'ccw' : 'cw';
  const arc = createSketchArc({ centerPointId: centerPoint.id, startPointId, endPointId, direction });
  const radial = [end[0] - center[0], end[1] - center[1]];
  const radius = Math.hypot(...radial);
  const endTangent = direction === 'ccw'
    ? [-radial[1] / radius, radial[0] / radius]
    : [radial[1] / radius, -radial[0] / radius];
  return { center, centerPoint, arc, endTangent };
}

export function normalizeSketchEntity(entity) {
  const pointIds = Array.isArray(entity?.pointIds)
    ? entity.pointIds
    : entity?.type === 'line'
      ? [entity.startPointId, entity.endPointId]
      : entity?.type === 'arc'
        ? [entity.centerPointId, entity.startPointId, entity.endPointId]
        : entity?.type === 'circle'
          ? [entity.centerPointId]
          : [];
  return commonEntity(entity.type, {
    ...entity,
    id: entity.id,
    role: entity.role || (entity.construction ? 'construction' : 'standard'),
    fixed: entity.fixed,
    pointIds,
    geometry: entity.geometry || {},
    expressionKeys: entity.expressionKeys || DEFAULT_EXPRESSION_KEYS[entity.type] || [],
  });
}

function entityById(sketch, entityId) {
  return sketch.entities.find((entity) => entity.id === entityId) || null;
}

function updatePoint(point, x, y) {
  point.type = 'point';
  point.pointIds = [];
  point.geometry = { x: expression(x), y: expression(y) };
  point.expressionKeys = ['x', 'y'];
  point.role ||= 'standard';
  point.fixed = Boolean(point.fixed);
}

function rectangleExpressions(geometry) {
  const x = expression(geometry.x);
  const y = expression(geometry.y);
  const width = expression(geometry.width, 40);
  const height = expression(geometry.height, 30);
  return [
    { x: `(${x}) - (${width}) / 2`, y: `(${y}) - (${height}) / 2` },
    { x: `(${x}) + (${width}) / 2`, y: `(${y}) - (${height}) / 2` },
    { x: `(${x}) + (${width}) / 2`, y: `(${y}) + (${height}) / 2` },
    { x: `(${x}) - (${width}) / 2`, y: `(${y}) + (${height}) / 2` },
  ];
}

function reusableRectangle(sketch, profile) {
  if (!Array.isArray(profile.entityIds) || profile.entityIds.length !== 4) return null;
  const lines = profile.entityIds.map((id) => entityById(sketch, id));
  if (lines.some((line) => line?.type !== 'line' || line.pointIds?.length !== 2)) return null;
  const pointIds = [...new Set(lines.flatMap((line) => line.pointIds))];
  if (pointIds.length !== 4) return null;
  const points = pointIds.map((id) => entityById(sketch, id));
  if (points.some((point) => point?.type !== 'point')) return null;
  return { lines, points };
}

function materializeRectangle(sketch, profile) {
  const corners = rectangleExpressions(profile.geometry || {});
  let reusable = reusableRectangle(sketch, profile);
  if (!reusable) {
    const points = corners.map((corner) => createSketchPoint(corner));
    const lines = points.map((point, index) => createSketchLine({
      startPointId: point.id,
      endPointId: points[(index + 1) % points.length].id,
    }));
    sketch.entities.push(...points, ...lines);
    reusable = { points, lines };
  } else {
    reusable.points.forEach((point, index) => updatePoint(point, corners[index].x, corners[index].y));
  }
  profile.entityIds = reusable.lines.map((line) => line.id);
}

function reusableCircle(sketch, profile) {
  if (!Array.isArray(profile.entityIds) || profile.entityIds.length !== 1) return null;
  const circle = entityById(sketch, profile.entityIds[0]);
  const center = circle?.type === 'circle' && circle.pointIds?.length === 1
    ? entityById(sketch, circle.pointIds[0])
    : null;
  return center?.type === 'point' ? { circle, center } : null;
}

function materializeCircle(sketch, profile) {
  const geometry = profile.geometry || {};
  let reusable = reusableCircle(sketch, profile);
  if (!reusable) {
    const center = createSketchPoint({ x: geometry.x, y: geometry.y });
    const circle = createSketchCircleEntity({
      centerPointId: center.id,
      radius: `(${expression(geometry.diameter, 10)}) / 2`,
    });
    sketch.entities.push(center, circle);
    reusable = { center, circle };
  } else {
    updatePoint(reusable.center, geometry.x, geometry.y);
    reusable.circle.geometry = { radius: `(${expression(geometry.diameter, 10)}) / 2` };
    reusable.circle.expressionKeys = ['radius'];
  }
  profile.entityIds = [reusable.circle.id];
}

export function materializePrimitiveProfile(sketch, sourceProfile) {
  const profile = {
    ...sourceProfile,
    geometry: { ...(sourceProfile.geometry || {}) },
    entityIds: [...(sourceProfile.entityIds || [])],
    closed: true,
    source: sourceProfile.source || 'primitive',
  };
  if (profile.type === 'rectangle') materializeRectangle(sketch, profile);
  else if (profile.type === 'circle') materializeCircle(sketch, profile);
  return profile;
}

export function upsertSketchProfile(sketch, sourceProfile) {
  const index = sketch.profiles.findIndex((profile) => profile.id === sourceProfile.id);
  const previous = index >= 0 ? sketch.profiles[index] : null;
  const candidate = {
    ...sourceProfile,
    entityIds: sourceProfile.entityIds?.length ? sourceProfile.entityIds : (previous?.entityIds || []),
  };
  const profile = materializePrimitiveProfile(sketch, candidate);
  if (index >= 0) sketch.profiles[index] = profile;
  else sketch.profiles.push(profile);
  return profile;
}

export function normalizeSketchModel(sketch) {
  const normalized = {
    ...sketch,
    entities: (sketch.entities || []).map(normalizeSketchEntity),
    profiles: [],
    constraints: [...(sketch.constraints || [])],
    dimensions: [...(sketch.dimensions || [])],
    blockInstances: [...(sketch.blockInstances || [])],
  };
  for (const profile of sketch.profiles || []) upsertSketchProfile(normalized, profile);
  return normalized;
}
