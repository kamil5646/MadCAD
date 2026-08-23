import { evaluateExpression, resolveParameters } from './expressions.js';
import { createSketchConstraint } from './sketch-model.js';

const DEFAULT_ANGLE_TOLERANCE = 4;
const DEFAULT_COINCIDENCE_TOLERANCE = 1e-5;

function resolvedParameterValues(parameters) {
  if (!Array.isArray(parameters)) return parameters || {};
  const resolved = resolveParameters(parameters);
  return resolved.valid ? resolved.values : {};
}

function pointCoordinates(point, values) {
  if (!point || point.type !== 'point') return null;
  try {
    return [
      evaluateExpression(point.geometry.x, values),
      evaluateExpression(point.geometry.y, values),
    ];
  } catch (_error) {
    return null;
  }
}

function angularDistance(first, second) {
  const difference = Math.abs((((first - second) % 180) + 180) % 180);
  return Math.min(difference, 180 - difference);
}

export function inferLineConstraintSuggestion(start, end, options = {}) {
  if (!Array.isArray(start) || !Array.isArray(end)) return null;
  const deltaX = Number(end[0]) - Number(start[0]);
  const deltaY = Number(end[1]) - Number(start[1]);
  if (![deltaX, deltaY].every(Number.isFinite) || Math.hypot(deltaX, deltaY) <= 1e-7) return null;
  const tolerance = Math.max(0, Number(options.angularToleranceDegrees) || DEFAULT_ANGLE_TOLERANCE);
  const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
  const horizontalDistance = angularDistance(angle, 0);
  const verticalDistance = angularDistance(angle, 90);
  if (horizontalDistance <= tolerance && horizontalDistance <= verticalDistance) {
    return {
      type: 'horizontal',
      label: 'Poziomo',
      code: 'H',
      angleDistance: horizontalDistance,
      adjustedEnd: [Number(end[0]), Number(start[1])],
    };
  }
  if (verticalDistance <= tolerance) {
    return {
      type: 'vertical',
      label: 'Pionowo',
      code: 'V',
      angleDistance: verticalDistance,
      adjustedEnd: [Number(start[0]), Number(end[1])],
    };
  }
  return null;
}

function hasConstraint(sketch, type, entityIds) {
  const expected = [...entityIds].sort().join('|');
  return (sketch.constraints || []).some((constraint) => constraint.type === type && [...(constraint.entityIds || [])].sort().join('|') === expected);
}

export function addAutomaticConstraintsForLine(sketch, lineId, parameters = [], options = {}) {
  const line = sketch?.entities?.find((entity) => entity.id === lineId && entity.type === 'line');
  if (!line || line.pointIds?.length !== 2) return [];
  const values = resolvedParameterValues(parameters);
  const entityMap = new Map((sketch.entities || []).map((entity) => [entity.id, entity]));
  const start = pointCoordinates(entityMap.get(line.pointIds[0]), values);
  const end = pointCoordinates(entityMap.get(line.pointIds[1]), values);
  if (!start || !end) return [];

  const added = [];
  const directional = inferLineConstraintSuggestion(start, end, options);
  if (directional && !hasConstraint(sketch, directional.type, [line.id])) {
    added.push(createSketchConstraint(directional.type, [line.id], { automatic: true }));
  }

  const endpoint = entityMap.get(line.pointIds[1]);
  const coincidenceTolerance = Math.max(0, Number(options.coincidenceTolerance) || DEFAULT_COINCIDENCE_TOLERANCE);
  const matchingPoint = (sketch.entities || []).find((candidate) => {
    if (candidate.type !== 'point' || line.pointIds.includes(candidate.id)) return false;
    const coordinates = pointCoordinates(candidate, values);
    return coordinates && Math.hypot(coordinates[0] - end[0], coordinates[1] - end[1]) <= coincidenceTolerance;
  });
  if (endpoint && matchingPoint && !hasConstraint(sketch, 'coincident', [endpoint.id, matchingPoint.id])) {
    added.push(createSketchConstraint('coincident', [endpoint.id, matchingPoint.id], { automatic: true }));
  }

  sketch.constraints = [...(sketch.constraints || []), ...added];
  return added;
}

