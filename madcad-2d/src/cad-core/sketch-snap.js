import { evaluateExpression, resolveParameters } from './expressions.js';

export const DEFAULT_SNAP_THRESHOLD_PX = 12;

const SNAP_PRIORITY = Object.freeze({
  endpoint: 0,
  center: 1,
  intersection: 2,
  quadrant: 3,
  midpoint: 4,
  tangent: 5,
  horizontal: 6,
  vertical: 6,
  extension: 7,
  alignment: 8,
  nearest: 9,
  grid: 10,
});

const SNAP_LABELS = Object.freeze({
  endpoint: 'Koniec',
  center: 'Środek',
  intersection: 'Przecięcie',
  quadrant: 'Kwadrant',
  midpoint: 'Środek odcinka',
  tangent: 'Styczność',
  horizontal: 'Poziomo',
  vertical: 'Pionowo',
  alignment: 'Wyrównanie',
  extension: 'Przedłużenie',
  nearest: 'Najbliższy',
  grid: 'Siatka',
});

const EPSILON = 1e-7;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function resolvedValues(parameters) {
  if (!Array.isArray(parameters)) return parameters || {};
  const result = resolveParameters(parameters);
  return result.valid ? result.values : {};
}

function numeric(value, parameters) {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  try {
    return evaluateExpression(value, parameters);
  } catch (_error) {
    return 0;
  }
}

function arcAngleContains(curve, point) {
  if (curve.kind !== 'arc') return true;
  const startAngle = Math.atan2(curve.start[1] - curve.center[1], curve.start[0] - curve.center[0]);
  let endAngle = Math.atan2(curve.end[1] - curve.center[1], curve.end[0] - curve.center[0]);
  let pointAngle = Math.atan2(point[1] - curve.center[1], point[0] - curve.center[0]);
  if (curve.direction === 'cw') {
    if (endAngle >= startAngle) endAngle -= Math.PI * 2;
    while (pointAngle > startAngle) pointAngle -= Math.PI * 2;
    return pointAngle >= endAngle - EPSILON;
  }
  if (endAngle <= startAngle) endAngle += Math.PI * 2;
  while (pointAngle < startAngle) pointAngle += Math.PI * 2;
  return pointAngle <= endAngle + EPSILON;
}

function pointOnLine(point, line, includeExtension = false) {
  const dx = line.end[0] - line.start[0];
  const dy = line.end[1] - line.start[1];
  const lengthSquared = (dx * dx) + (dy * dy);
  if (lengthSquared <= EPSILON) return null;
  const rawT = (((point[0] - line.start[0]) * dx) + ((point[1] - line.start[1]) * dy)) / lengthSquared;
  const t = includeExtension ? rawT : clamp(rawT, 0, 1);
  return { point: [line.start[0] + (t * dx), line.start[1] + (t * dy)], t: rawT };
}

function nearestOnCurve(point, curve) {
  if (curve.kind === 'line') return pointOnLine(point, curve)?.point || null;
  const vector = [point[0] - curve.center[0], point[1] - curve.center[1]];
  const length = Math.hypot(...vector);
  if (length <= EPSILON) return null;
  const candidate = [
    curve.center[0] + ((vector[0] / length) * curve.radius),
    curve.center[1] + ((vector[1] / length) * curve.radius),
  ];
  return arcAngleContains(curve, candidate) ? candidate : null;
}

function lineLineIntersections(first, second) {
  const a = first.start;
  const b = first.end;
  const c = second.start;
  const d = second.end;
  const denominator = ((a[0] - b[0]) * (c[1] - d[1])) - ((a[1] - b[1]) * (c[0] - d[0]));
  if (Math.abs(denominator) <= EPSILON) return [];
  const crossA = (a[0] * b[1]) - (a[1] * b[0]);
  const crossC = (c[0] * d[1]) - (c[1] * d[0]);
  const point = [
    ((crossA * (c[0] - d[0])) - ((a[0] - b[0]) * crossC)) / denominator,
    ((crossA * (c[1] - d[1])) - ((a[1] - b[1]) * crossC)) / denominator,
  ];
  const onFirst = pointOnLine(point, first)?.point;
  const onSecond = pointOnLine(point, second)?.point;
  return onFirst && onSecond && distance(point, onFirst) <= EPSILON && distance(point, onSecond) <= EPSILON ? [point] : [];
}

function lineCircleIntersections(line, circle) {
  const direction = [line.end[0] - line.start[0], line.end[1] - line.start[1]];
  const offset = [line.start[0] - circle.center[0], line.start[1] - circle.center[1]];
  const a = (direction[0] ** 2) + (direction[1] ** 2);
  if (a <= EPSILON) return [];
  const b = 2 * ((offset[0] * direction[0]) + (offset[1] * direction[1]));
  const c = (offset[0] ** 2) + (offset[1] ** 2) - (circle.radius ** 2);
  const discriminant = (b ** 2) - (4 * a * c);
  if (discriminant < -EPSILON) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [...new Set([(-b - root) / (2 * a), (-b + root) / (2 * a)])]
    .filter((t) => t >= -EPSILON && t <= 1 + EPSILON)
    .map((t) => [line.start[0] + (t * direction[0]), line.start[1] + (t * direction[1])])
    .filter((point) => arcAngleContains(circle, point));
}

function circleCircleIntersections(first, second) {
  const delta = [second.center[0] - first.center[0], second.center[1] - first.center[1]];
  const centerDistance = Math.hypot(...delta);
  if (centerDistance <= EPSILON || centerDistance > first.radius + second.radius + EPSILON || centerDistance < Math.abs(first.radius - second.radius) - EPSILON) return [];
  const along = ((first.radius ** 2) - (second.radius ** 2) + (centerDistance ** 2)) / (2 * centerDistance);
  const height = Math.sqrt(Math.max(0, (first.radius ** 2) - (along ** 2)));
  const base = [first.center[0] + ((delta[0] * along) / centerDistance), first.center[1] + ((delta[1] * along) / centerDistance)];
  const perpendicular = [-(delta[1] / centerDistance), delta[0] / centerDistance];
  const points = height <= EPSILON
    ? [base]
    : [
      [base[0] + (perpendicular[0] * height), base[1] + (perpendicular[1] * height)],
      [base[0] - (perpendicular[0] * height), base[1] - (perpendicular[1] * height)],
    ];
  return points.filter((point) => arcAngleContains(first, point) && arcAngleContains(second, point));
}

function curveIntersections(first, second) {
  if (first.kind === 'line' && second.kind === 'line') return lineLineIntersections(first, second);
  if (first.kind === 'line') return lineCircleIntersections(first, second);
  if (second.kind === 'line') return lineCircleIntersections(second, first);
  return circleCircleIntersections(first, second);
}

export function intersectSketchCurves(first, second) {
  return curveIntersections(first, second);
}

function tangentPoints(anchor, curve) {
  if (!anchor || curve.kind === 'line') return [];
  const delta = [anchor[0] - curve.center[0], anchor[1] - curve.center[1]];
  const lengthSquared = (delta[0] ** 2) + (delta[1] ** 2);
  const radiusSquared = curve.radius ** 2;
  if (lengthSquared <= radiusSquared + EPSILON) return [];
  const baseScale = radiusSquared / lengthSquared;
  const offsetScale = (curve.radius * Math.sqrt(lengthSquared - radiusSquared)) / lengthSquared;
  const base = [curve.center[0] + (delta[0] * baseScale), curve.center[1] + (delta[1] * baseScale)];
  const offset = [-delta[1] * offsetScale, delta[0] * offsetScale];
  return [
    [base[0] + offset[0], base[1] + offset[1]],
    [base[0] - offset[0], base[1] - offset[1]],
  ].filter((point) => arcAngleContains(curve, point));
}

function sketchGeometry(sketch, parameters) {
  const values = resolvedValues(parameters);
  const entities = sketch?.entities || [];
  const map = new Map(entities.map((entity) => [entity.id, entity]));
  const points = new Map();
  for (const entity of entities) {
    if (entity.type !== 'point') continue;
    points.set(entity.id, [numeric(entity.geometry?.x, values), numeric(entity.geometry?.y, values)]);
  }
  const curves = [];
  for (const entity of entities) {
    if (entity.type === 'line') {
      const start = points.get(entity.pointIds?.[0]);
      const end = points.get(entity.pointIds?.[1]);
      if (start && end) curves.push({ id: entity.id, kind: 'line', start, end });
    } else if (entity.type === 'circle') {
      const center = points.get(entity.pointIds?.[0]);
      const radius = numeric(entity.geometry?.radius, values);
      if (center && radius > EPSILON) curves.push({ id: entity.id, kind: 'circle', center, radius });
    } else if (entity.type === 'arc') {
      const center = points.get(entity.pointIds?.[0]);
      const start = points.get(entity.pointIds?.[1]);
      const end = points.get(entity.pointIds?.[2]);
      if (center && start && end) curves.push({ id: entity.id, kind: 'arc', center, start, end, radius: distance(center, start), direction: entity.geometry?.direction || 'ccw' });
    }
  }
  return { entities, map, points, curves };
}

export function sketchCurveGeometry(sketch, parameters = []) {
  return sketchGeometry(sketch, resolvedValues(parameters));
}

export function composeSketchSnapContext(activeSketch, referenceSketches = [], parameters = []) {
  if (!activeSketch) return { sketch: activeSketch, referenceEntityIds: [] };
  const values = resolvedValues(parameters);
  const activePlane = activeSketch.plane || 'XY';
  const activeOffset = numeric(activeSketch.planeOffset || 0, values);
  const activeEntityIds = new Set((activeSketch.entities || []).map((entity) => entity.id));
  const referenceEntityIds = [];
  const referenceEntities = [];

  for (const sketch of referenceSketches) {
    if (!sketch || sketch.id === activeSketch.id || (sketch.plane || 'XY') !== activePlane) continue;
    const referenceOffset = numeric(sketch.planeOffset || 0, values);
    if (Math.abs(referenceOffset - activeOffset) > EPSILON) continue;
    for (const entity of sketch.entities || []) {
      if (activeEntityIds.has(entity.id)) continue;
      referenceEntities.push(entity);
      referenceEntityIds.push(entity.id);
    }
  }

  return {
    sketch: referenceEntities.length
      ? { ...activeSketch, entities: [...(activeSketch.entities || []), ...referenceEntities] }
      : activeSketch,
    referenceEntityIds,
  };
}

function candidate(type, point, options = {}) {
  return {
    type,
    point,
    label: SNAP_LABELS[type],
    priority: SNAP_PRIORITY[type],
    entityIds: options.entityIds || [],
    guides: options.guides || [],
  };
}

export function collectSketchSnapCandidates(sketch, point, options = {}) {
  const { parameters = [], anchor = null, gridSize = 1, excludePointIds = [] } = options;
  const excluded = new Set(excludePointIds);
  const geometry = sketchGeometry(sketch, parameters);
  const result = [];
  const endpointIds = new Set();
  const centerIds = new Set();

  for (const curve of geometry.curves) {
    const entity = geometry.map.get(curve.id);
    if (curve.kind === 'line') entity.pointIds.forEach((id) => endpointIds.add(id));
    else if (curve.kind === 'arc') {
      endpointIds.add(entity.pointIds[1]);
      endpointIds.add(entity.pointIds[2]);
      centerIds.add(entity.pointIds[0]);
    } else centerIds.add(entity.pointIds[0]);
  }
  for (const pointId of endpointIds) {
    if (!excluded.has(pointId) && geometry.points.has(pointId)) result.push(candidate('endpoint', geometry.points.get(pointId), { entityIds: [pointId] }));
  }
  for (const pointId of centerIds) {
    if (!excluded.has(pointId) && geometry.points.has(pointId)) result.push(candidate('center', geometry.points.get(pointId), { entityIds: [pointId] }));
  }

  for (const curve of geometry.curves) {
    if (curve.kind === 'line') {
      result.push(candidate('midpoint', [(curve.start[0] + curve.end[0]) / 2, (curve.start[1] + curve.end[1]) / 2], { entityIds: [curve.id] }));
      const nearest = nearestOnCurve(point, curve);
      if (nearest) result.push(candidate('nearest', nearest, { entityIds: [curve.id] }));
      const extension = pointOnLine(point, curve, true);
      if (extension && (extension.t < 0 || extension.t > 1)) {
        result.push(candidate('extension', extension.point, {
          entityIds: [curve.id],
          guides: [{ kind: 'extension', from: curve.start, to: extension.point }],
        }));
      }
    } else {
      const quadrantAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
      for (const angle of quadrantAngles) {
        const quadrant = [curve.center[0] + (Math.cos(angle) * curve.radius), curve.center[1] + (Math.sin(angle) * curve.radius)];
        if (arcAngleContains(curve, quadrant)) result.push(candidate('quadrant', quadrant, { entityIds: [curve.id] }));
      }
      const nearest = nearestOnCurve(point, curve);
      if (nearest) result.push(candidate('nearest', nearest, { entityIds: [curve.id] }));
      for (const tangent of tangentPoints(anchor, curve)) result.push(candidate('tangent', tangent, { entityIds: [curve.id] }));
    }
  }

  for (let first = 0; first < geometry.curves.length; first += 1) {
    for (let second = first + 1; second < geometry.curves.length; second += 1) {
      for (const intersection of curveIntersections(geometry.curves[first], geometry.curves[second])) {
        result.push(candidate('intersection', intersection, { entityIds: [geometry.curves[first].id, geometry.curves[second].id] }));
      }
    }
  }

  if (anchor) {
    result.push(candidate('horizontal', [point[0], anchor[1]], { guides: [{ kind: 'horizontal', coordinate: anchor[1] }] }));
    result.push(candidate('vertical', [anchor[0], point[1]], { guides: [{ kind: 'vertical', coordinate: anchor[0] }] }));
  }
  for (const [pointId, coordinate] of geometry.points) {
    if (excluded.has(pointId)) continue;
    result.push(candidate('alignment', [coordinate[0], point[1]], { entityIds: [pointId], guides: [{ kind: 'vertical', coordinate: coordinate[0] }] }));
    result.push(candidate('alignment', [point[0], coordinate[1]], { entityIds: [pointId], guides: [{ kind: 'horizontal', coordinate: coordinate[1] }] }));
  }
  if (Number(gridSize) > 0) {
    result.push(candidate('grid', [Math.round(point[0] / gridSize) * gridSize, Math.round(point[1] / gridSize) * gridSize]));
  }
  return result;
}

export function snapSketchPoint(sketch, point, options = {}) {
  const rawPoint = [Number(point?.[0]) || 0, Number(point?.[1]) || 0];
  if (options.disabled) return { snapped: false, type: null, label: null, point: rawPoint, distancePx: 0, guides: [] };
  const pixelsPerUnit = Math.max(EPSILON, Number(options.pixelsPerUnit) || 1);
  const thresholdPx = Math.max(1, Number(options.thresholdPx) || DEFAULT_SNAP_THRESHOLD_PX);
  const candidates = collectSketchSnapCandidates(sketch, rawPoint, options)
    .map((entry) => ({ ...entry, distancePx: distance(rawPoint, entry.point) * pixelsPerUnit }))
    .filter((entry) => entry.distancePx <= thresholdPx + EPSILON)
    .sort((first, second) => first.priority - second.priority || first.distancePx - second.distancePx);
  const best = candidates[0];
  return best ? { ...best, snapped: true } : { snapped: false, type: null, label: null, point: rawPoint, distancePx: 0, guides: [] };
}
