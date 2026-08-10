import { createId } from './ids.js';
import { evaluateExpression, resolveParameters } from './expressions.js';

export const BASE_PLANE_FRAMES = Object.freeze({
  XY: { origin: [0, 0, 0], normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  XZ: { origin: [0, 0, 0], normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  YZ: { origin: [0, 0, 0], normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
});

export function createOffsetPlane({ name = 'Płaszczyzna odsunięta', basePlane = 'XY', offset = '10', visible = true } = {}) {
  if (!BASE_PLANE_FRAMES[basePlane]) throw new Error(`Nieobsługiwana płaszczyzna bazowa: ${basePlane}.`);
  return {
    id: createId('plane'),
    kind: 'construction-plane',
    planeType: 'offset',
    name,
    basePlane,
    offset: String(offset),
    visible: Boolean(visible),
  };
}

export function createMidplane({ name = 'Płaszczyzna środkowa', basePlane = 'XY', firstOffset = '0', secondOffset = '10', visible = true } = {}) {
  if (!BASE_PLANE_FRAMES[basePlane]) throw new Error(`Nieobsługiwana płaszczyzna bazowa: ${basePlane}.`);
  return {
    id: createId('plane'),
    kind: 'construction-plane',
    planeType: 'midplane',
    name,
    basePlane,
    firstOffset: String(firstOffset),
    secondOffset: String(secondOffset),
    visible: Boolean(visible),
  };
}

export function createThreePointPlane({ name = 'Płaszczyzna przez trzy punkty', points = [[0, 0, 0], [10, 0, 0], [0, 10, 0]], visible = true } = {}) {
  if (!Array.isArray(points) || points.length !== 3 || points.some((point) => !Array.isArray(point) || point.length !== 3)) {
    throw new Error('Płaszczyzna przez trzy punkty wymaga dokładnie trzech punktów 3D.');
  }
  return {
    id: createId('plane'),
    kind: 'construction-plane',
    planeType: 'three-points',
    name,
    points: points.map((point) => point.map(String)),
    visible: Boolean(visible),
  };
}

function vectorExpressions(values, label) {
  if (!Array.isArray(values) || values.length !== 3) throw new Error(`${label} wymaga trzech współrzędnych.`);
  return values.map(String);
}

export function createAnglePlane({ name = 'Płaszczyzna pod kątem', basePlane = 'XY', rotationAxis = 'u', angle = '45', offset = '0', visible = true } = {}) {
  if (!BASE_PLANE_FRAMES[basePlane]) throw new Error(`Nieobsługiwana płaszczyzna bazowa: ${basePlane}.`);
  if (!['u', 'v'].includes(rotationAxis)) throw new Error('Oś obrotu płaszczyzny musi mieć wartość u albo v.');
  return { id: createId('plane'), kind: 'construction-plane', planeType: 'angle', name, basePlane, rotationAxis, angle: String(angle), offset: String(offset), visible: Boolean(visible) };
}

export function createTangentPlane({ name = 'Płaszczyzna styczna', surfaceType = 'sphere', center = [0, 0, 0], point = [10, 0, 0], axis = [0, 0, 1], visible = true } = {}) {
  if (!['sphere', 'cylinder'].includes(surfaceType)) throw new Error('Płaszczyzna styczna obsługuje powierzchnię sferyczną albo walcową.');
  return { id: createId('plane'), kind: 'construction-plane', planeType: 'tangent', name, surfaceType, center: vectorExpressions(center, 'Środek powierzchni'), point: vectorExpressions(point, 'Punkt styczności'), axis: vectorExpressions(axis, 'Oś powierzchni'), visible: Boolean(visible) };
}

export function createPathPlane({ name = 'Płaszczyzna na ścieżce', point = [0, 0, 0], direction = [1, 0, 0], visible = true } = {}) {
  return { id: createId('plane'), kind: 'construction-plane', planeType: 'path', name, point: vectorExpressions(point, 'Punkt ścieżki'), direction: vectorExpressions(direction, 'Kierunek ścieżki'), visible: Boolean(visible) };
}

function normalized(vector, label) {
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
  return first.reduce((sum, value, index) => sum + value * second[index], 0);
}

function rotated(vector, axis, angle) {
  const cosine = Math.cos(angle); const sine = Math.sin(angle); const projection = dot(axis, vector);
  const perpendicular = cross(axis, vector);
  return vector.map((value, index) => value * cosine + perpendicular[index] * sine + axis[index] * projection * (1 - cosine));
}

function evaluatedVector(vector, values) {
  return vector.map((value) => evaluateExpression(value, values));
}

function frameFromNormal(origin, normal, preferred = [0, 0, 1]) {
  const normalizedNormal = normalized(normal, 'Normalna płaszczyzny');
  const reference = Math.abs(dot(normalizedNormal, preferred)) > 0.95 ? [0, 1, 0] : preferred;
  const u = normalized(cross(reference, normalizedNormal), 'Pierwszy kierunek płaszczyzny');
  const v = normalized(cross(normalizedNormal, u), 'Drugi kierunek płaszczyzny');
  return { origin, normal: normalizedNormal, u, v };
}

export function resolveConstructionPlane(plane, parameters = []) {
  if (plane?.kind !== 'construction-plane') throw new Error('Nieobsługiwany typ płaszczyzny konstrukcyjnej.');
  const resolved = Array.isArray(parameters) ? resolveParameters(parameters) : { valid: true, values: parameters, errors: {} };
  if (!resolved.valid) throw new Error(Object.values(resolved.errors)[0] || 'Nie udało się rozwiązać parametrów płaszczyzny.');
  if (plane.planeType === 'three-points') {
    const points = plane.points.map((point) => point.map((value) => evaluateExpression(value, resolved.values)));
    const firstAxis = points[1].map((value, axis) => value - points[0][axis]);
    const secondAxis = points[2].map((value, axis) => value - points[0][axis]);
    const u = normalized(firstAxis, 'Pierwszy kierunek płaszczyzny');
    const normal = normalized(cross(firstAxis, secondAxis), 'Iloczyn kierunków płaszczyzny');
    const v = normalized(cross(normal, u), 'Drugi kierunek płaszczyzny');
    return {
      ...plane,
      resolvedPoints: points,
      origin: [0, 1, 2].map((axis) => (points[0][axis] + points[1][axis] + points[2][axis]) / 3),
      normal,
      u,
      v,
    };
  }
  if (plane.planeType === 'tangent') {
    const center = evaluatedVector(plane.center, resolved.values);
    const point = evaluatedVector(plane.point, resolved.values);
    let normal = point.map((value, index) => value - center[index]);
    if (plane.surfaceType === 'cylinder') {
      const axis = normalized(evaluatedVector(plane.axis, resolved.values), 'Oś walca');
      const axial = dot(normal, axis);
      normal = normal.map((value, index) => value - axis[index] * axial);
    }
    return { ...plane, centerValue: center, pointValue: point, ...frameFromNormal(point, normal) };
  }
  if (plane.planeType === 'path') {
    const point = evaluatedVector(plane.point, resolved.values);
    const direction = evaluatedVector(plane.direction, resolved.values);
    return { ...plane, pointValue: point, directionValue: normalized(direction, 'Kierunek ścieżki'), ...frameFromNormal(point, direction) };
  }
  const frame = BASE_PLANE_FRAMES[plane.basePlane];
  if (!frame) throw new Error(`Nieobsługiwana płaszczyzna bazowa: ${plane.basePlane}.`);
  const offsetValue = plane.planeType === 'midplane'
    ? (evaluateExpression(plane.firstOffset, resolved.values) + evaluateExpression(plane.secondOffset, resolved.values)) / 2
    : evaluateExpression(plane.offset, resolved.values);
  if (!Number.isFinite(offsetValue)) throw new Error('Odległość płaszczyzny musi być skończoną liczbą.');
  if (plane.planeType === 'angle') {
    const radians = evaluateExpression(plane.angle, resolved.values) * Math.PI / 180;
    if (!Number.isFinite(radians)) throw new Error('Kąt płaszczyzny musi być skończoną liczbą.');
    const rotationAxis = plane.rotationAxis === 'v' ? frame.v : frame.u;
    return {
      ...plane,
      offsetValue,
      angleValue: radians * 180 / Math.PI,
      origin: frame.origin.map((value, axis) => value + frame.normal[axis] * offsetValue),
      normal: normalized(rotated(frame.normal, rotationAxis, radians), 'Normalna płaszczyzny'),
      u: normalized(rotated(frame.u, rotationAxis, radians), 'Pierwszy kierunek płaszczyzny'),
      v: normalized(rotated(frame.v, rotationAxis, radians), 'Drugi kierunek płaszczyzny'),
    };
  }
  return {
    ...plane,
    offsetValue,
    origin: frame.origin.map((value, axis) => value + (frame.normal[axis] * offsetValue)),
    normal: [...frame.normal],
    u: [...frame.u],
    v: [...frame.v],
  };
}

export function resolveConstructionPlanes(references, parameters = []) {
  return (references || []).filter((reference) => reference.kind === 'construction-plane').map((plane) => {
    try {
      return { ...resolveConstructionPlane(plane, parameters), status: 'ok', error: null };
    } catch (error) {
      return { ...plane, status: 'error', error: error.message };
    }
  });
}
