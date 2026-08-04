import { createId } from './ids.js';

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
  return {
    id: options.id || createId('entity'),
    type,
    role,
    fixed: Boolean(options.fixed),
    pointIds: [...(options.pointIds || [])],
    geometry: { ...(options.geometry || {}) },
    expressionKeys: [...(options.expressionKeys || DEFAULT_EXPRESSION_KEYS[type] || [])],
    ...(role === 'projected' ? { sourceReferenceId: options.sourceReferenceId || null } : {}),
  };
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
  };
  for (const profile of sketch.profiles || []) upsertSketchProfile(normalized, profile);
  return normalized;
}
