import { createId } from './ids.js';
import { evaluateExpression, resolveParameters } from './expressions.js';
import { resolveConstructionPlane } from './construction-planes.js';

function vectorExpressions(values, label) {
  if (!Array.isArray(values) || values.length !== 3) throw new Error(`${label} wymaga trzech współrzędnych.`);
  return values.map(String);
}

function normalize(vector, label) {
  const length = Math.hypot(...vector);
  if (!(length > 1e-9)) throw new Error(`${label} nie może mieć zerowej długości.`);
  return vector.map((value) => value / length);
}

function cross(first, second) {
  return [
    (first[1] * second[2]) - (first[2] * second[1]),
    (first[2] * second[0]) - (first[0] * second[2]),
    (first[0] * second[1]) - (first[1] * second[0]),
  ];
}

function dot(first, second) {
  return first.reduce((sum, value, axis) => sum + (value * second[axis]), 0);
}

function baseAxis(axisType, name, visible) {
  return { id: createId('axis'), kind: 'construction-axis', axisType, name, visible: Boolean(visible) };
}

export function createEdgeAxis({ name = 'Oś z krawędzi', points = [[0, 0, 0], [10, 0, 0]], topologyId = null, bodyId = null, visible = true } = {}) {
  if (!Array.isArray(points) || points.length !== 2) throw new Error('Oś z krawędzi wymaga dwóch końców krawędzi.');
  return { ...baseAxis('edge', name, visible), points: points.map((point) => vectorExpressions(point, 'Koniec krawędzi')), topologyId, bodyId };
}

export function createCylinderAxis({ name = 'Oś walca', origin = [0, 0, 0], direction = [0, 0, 1], topologyId = null, bodyId = null, visible = true } = {}) {
  return { ...baseAxis('cylinder', name, visible), origin: vectorExpressions(origin, 'Środek walca'), direction: vectorExpressions(direction, 'Kierunek osi walca'), topologyId, bodyId };
}

export function createTwoPointAxis({ name = 'Oś przez dwa punkty', points = [[0, 0, 0], [0, 0, 10]], visible = true } = {}) {
  if (!Array.isArray(points) || points.length !== 2) throw new Error('Oś przez dwa punkty wymaga dokładnie dwóch punktów.');
  return { ...baseAxis('two-points', name, visible), points: points.map((point) => vectorExpressions(point, 'Punkt osi')) };
}

export function createPlaneIntersectionAxis({ name = 'Oś przecięcia płaszczyzn', planeIds = [], visible = true } = {}) {
  if (!Array.isArray(planeIds) || planeIds.length !== 2 || planeIds.some((id) => typeof id !== 'string' || !id)) {
    throw new Error('Oś przecięcia wymaga dwóch płaszczyzn konstrukcyjnych.');
  }
  return { ...baseAxis('plane-intersection', name, visible), planeIds: [...planeIds] };
}

function resolvedVector(values, parameterValues) {
  return values.map((value) => evaluateExpression(value, parameterValues));
}

function topologyRecord(axis, bodies, kind) {
  if (!axis.topologyId || !axis.bodyId || !bodies?.length) return null;
  const body = bodies.find((candidate) => candidate.id === axis.bodyId);
  const key = kind === 'edge' ? 'edges' : 'faces';
  const record = body?.topology?.[key]?.find((candidate) => candidate.id === axis.topologyId);
  if (!record) throw new Error(`Utracono źródłową ${kind === 'edge' ? 'krawędź' : 'ścianę walcową'} osi.`);
  return record;
}

export function resolveConstructionAxis(axis, references = [], parameters = [], bodies = []) {
  if (axis?.kind !== 'construction-axis') throw new Error('Nieobsługiwany typ osi konstrukcyjnej.');
  const resolved = Array.isArray(parameters) ? resolveParameters(parameters) : { valid: true, values: parameters, errors: {} };
  if (!resolved.valid) throw new Error(Object.values(resolved.errors)[0] || 'Nie udało się rozwiązać parametrów osi.');
  if (axis.axisType === 'plane-intersection') {
    const planes = axis.planeIds.map((id) => references.find((reference) => reference.id === id && reference.kind === 'construction-plane'));
    if (planes.some((plane) => !plane)) throw new Error('Nie znaleziono jednej z płaszczyzn osi przecięcia.');
    const [first, second] = planes.map((plane) => resolveConstructionPlane(plane, resolved.values));
    const directionVector = cross(first.normal, second.normal);
    const denominator = dot(directionVector, directionVector);
    if (!(denominator > 1e-12)) throw new Error('Wybrane płaszczyzny są równoległe i nie wyznaczają osi.');
    const firstDistance = dot(first.normal, first.origin);
    const secondDistance = dot(second.normal, second.origin);
    const weighted = first.normal.map((_value, index) => (firstDistance * second.normal[index]) - (secondDistance * first.normal[index]));
    return { ...axis, origin: cross(weighted, directionVector).map((value) => value / denominator), direction: normalize(directionVector, 'Kierunek przecięcia') };
  }
  if (axis.axisType === 'cylinder') {
    const record = topologyRecord(axis, bodies, 'face');
    const origin = record?.descriptor?.axisOrigin || axis.origin;
    const direction = record?.descriptor?.axisDirection || axis.direction;
    return { ...axis, origin: resolvedVector(origin, resolved.values), direction: normalize(resolvedVector(direction, resolved.values), 'Kierunek osi walca') };
  }
  if (axis.axisType === 'edge' || axis.axisType === 'two-points') {
    const record = axis.axisType === 'edge' ? topologyRecord(axis, bodies, 'edge') : null;
    const sourcePoints = record?.descriptor?.endpoints || axis.points;
    const points = sourcePoints.map((point) => resolvedVector(point, resolved.values));
    return { ...axis, resolvedPoints: points, origin: points[0], direction: normalize(points[1].map((value, index) => value - points[0][index]), 'Oś przez dwa punkty') };
  }
  throw new Error(`Nieobsługiwany wariant osi: ${axis.axisType ?? ''}.`);
}

export function resolveConstructionAxes(references, parameters = [], bodies = []) {
  return (references || []).filter((reference) => reference.kind === 'construction-axis').map((axis) => {
    try {
      return { ...resolveConstructionAxis(axis, references, parameters, bodies), status: 'ok', error: null };
    } catch (error) {
      return { ...axis, status: 'error', error: error.message };
    }
  });
}
