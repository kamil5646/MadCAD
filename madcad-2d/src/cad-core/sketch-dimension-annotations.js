import { evaluateExpression, resolveParameters } from './expressions.js';

// Drawable annotations for the driving dimensions of a sketch: extension and
// dimension lines with arrowheads plus a label anchor, all in sketch-local 2D
// coordinates. The viewport maps them onto the sketch plane.

const NUMERIC_LITERAL = /^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

function safeNumber(expression, values) {
  try {
    const value = evaluateExpression(expression, values);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function formatDimensionValue(value) {
  if (!Number.isFinite(value)) return '?';
  const rounded = Math.round(value * 100) / 100;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function labelText(type, value, expression) {
  const number = formatDimensionValue(type === 'horizontal' || type === 'vertical' ? Math.abs(value) : value);
  const prefix = { radius: 'R', diameter: 'Ø', arcLength: '⌒ ', ordinateX: 'X ', ordinateY: 'Y ' }[type] || '';
  const suffix = type === 'angle' ? '°' : '';
  const text = `${prefix}${number}${suffix}`;
  const source = String(expression ?? '').trim();
  return source && !NUMERIC_LITERAL.test(source) ? `fx: ${text}` : text;
}

function arrowhead(tip, toward, size) {
  const dx = toward[0] - tip[0];
  const dy = toward[1] - tip[1];
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) return [];
  const ux = dx / length;
  const uy = dy / length;
  const back = [tip[0] + (ux * size), tip[1] + (uy * size)];
  const wing = size * 0.35;
  return [
    [tip, [back[0] - (uy * wing), back[1] + (ux * wing)]],
    [tip, [back[0] + (uy * wing), back[1] - (ux * wing)]],
  ];
}

function sketchCentroid(points) {
  if (!points.length) return [0, 0];
  const sum = points.reduce((total, point) => [total[0] + point[0], total[1] + point[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

function linearAnnotation(type, first, second, centroid, offset, arrow) {
  let direction;
  if (type === 'horizontal') direction = [1, 0];
  else if (type === 'vertical') direction = [0, 1];
  else {
    const length = Math.hypot(second[0] - first[0], second[1] - first[1]);
    if (length <= 1e-9) return null;
    direction = [(second[0] - first[0]) / length, (second[1] - first[1]) / length];
  }
  let normal = [-direction[1], direction[0]];
  const middle = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
  // Place the dimension on the side facing away from the rest of the sketch.
  if (((middle[0] - centroid[0]) * normal[0]) + ((middle[1] - centroid[1]) * normal[1]) < 0) normal = [-normal[0], -normal[1]];
  const along = (point) => (point[0] * direction[0]) + (point[1] * direction[1]);
  const across = (point) => (point[0] * normal[0]) + (point[1] * normal[1]);
  const level = Math.max(across(first), across(second)) + offset;
  const onLine = (point) => {
    const t = along(point);
    return [(direction[0] * t) + (normal[0] * level), (direction[1] * t) + (normal[1] * level)];
  };
  const start = onLine(first);
  const end = onLine(second);
  const overshoot = offset * 0.2;
  const extension = (point, foot) => [point, [foot[0] + (normal[0] * overshoot), foot[1] + (normal[1] * overshoot)]];
  return {
    segments: [extension(first, start), extension(second, end), [start, end], ...arrowhead(start, end, arrow), ...arrowhead(end, start, arrow)],
    label: [((start[0] + end[0]) / 2) + (normal[0] * offset * 0.45), ((start[1] + end[1]) / 2) + (normal[1] * offset * 0.45)],
  };
}

function radialAnnotation(type, center, radius, offset, arrow) {
  if (!(radius > 0)) return null;
  const angle = Math.PI / 4;
  const unit = [Math.cos(angle), Math.sin(angle)];
  const rim = [center[0] + (unit[0] * radius), center[1] + (unit[1] * radius)];
  const outside = [rim[0] + (unit[0] * offset), rim[1] + (unit[1] * offset)];
  const start = type === 'diameter' ? [center[0] - (unit[0] * radius), center[1] - (unit[1] * radius)] : center;
  return {
    segments: [[start, outside], ...arrowhead(rim, center, arrow), ...(type === 'diameter' ? arrowhead(start, center, arrow) : [])],
    label: [outside[0] + (unit[0] * offset * 0.4), outside[1] + (unit[1] * offset * 0.4)],
  };
}

export function sketchDimensionAnnotations(sketch, parameters = [], options = {}) {
  const dimensions = sketch?.dimensions || [];
  if (!dimensions.length) return [];
  const resolved = resolveParameters(parameters || []);
  const values = resolved.values || {};
  const entities = new Map((sketch.entities || []).map((entity) => [entity.id, entity]));
  const pointOf = (id) => {
    const entity = entities.get(id);
    if (entity?.type !== 'point') return null;
    const x = safeNumber(entity.geometry?.x, values);
    const y = safeNumber(entity.geometry?.y, values);
    return x === null || y === null ? null : [x, y];
  };
  const allPoints = (sketch.entities || []).filter((entity) => entity.type === 'point').map((entity) => pointOf(entity.id)).filter(Boolean);
  const centroid = sketchCentroid(allPoints);
  const xs = allPoints.map((point) => point[0]);
  const ys = allPoints.map((point) => point[1]);
  const diagonal = allPoints.length ? Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) : 0;
  const offset = options.offset ?? Math.min(40, Math.max(4, diagonal * 0.12));
  const arrow = options.arrow ?? offset * 0.3;
  const constraints = new Map((sketch.constraints || []).map((constraint) => [constraint.id, constraint]));
  const annotations = [];

  for (const dimension of dimensions) {
    const constraint = constraints.get(dimension.constraintId);
    const expression = constraint?.value ?? dimension.expression;
    const value = safeNumber(expression, values);
    if (value === null) continue;
    const ids = dimension.entityIds || [];
    let shape = null;
    if (['horizontal', 'vertical', 'aligned'].includes(dimension.type)) {
      const line = ids.length === 1 ? entities.get(ids[0]) : null;
      const pointIds = line?.type === 'line' ? line.pointIds : ids;
      const [first, second] = (pointIds || []).slice(0, 2).map(pointOf);
      if (first && second) shape = linearAnnotation(dimension.type, first, second, centroid, offset, arrow);
    } else if (dimension.type === 'radius' || dimension.type === 'diameter') {
      const curve = entities.get(ids[0]);
      const center = pointOf(curve?.pointIds?.[0]);
      const start = pointOf(curve?.pointIds?.[1]);
      const radius = curve?.type === 'circle' ? safeNumber(curve.geometry?.radius, values) : center && start ? Math.hypot(start[0] - center[0], start[1] - center[1]) : null;
      if (center) shape = radialAnnotation(dimension.type, center, radius, offset, arrow);
    } else if (dimension.type === 'ordinateX' || dimension.type === 'ordinateY') {
      const point = pointOf(ids[0]);
      if (point) {
        const foot = dimension.type === 'ordinateX' ? [point[0], 0] : [0, point[1]];
        shape = { segments: [[foot, point]], label: [(foot[0] + point[0]) / 2, (foot[1] + point[1]) / 2] };
      }
    } else {
      // Angle and arc length: label at the first referenced geometry.
      const entity = entities.get(ids[0]);
      const anchors = (entity?.pointIds || [ids[0]]).map(pointOf).filter(Boolean);
      if (anchors.length) shape = { segments: [], label: sketchCentroid(anchors) };
    }
    if (!shape) continue;
    annotations.push({
      dimensionId: dimension.id,
      constraintId: dimension.constraintId || null,
      type: dimension.type,
      value,
      text: labelText(dimension.type, value, expression),
      segments: shape.segments,
      label: shape.label,
    });
  }
  return annotations;
}
