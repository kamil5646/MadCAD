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
  const frame = BASE_PLANE_FRAMES[plane.basePlane];
  if (!frame) throw new Error(`Nieobsługiwana płaszczyzna bazowa: ${plane.basePlane}.`);
  const offsetValue = plane.planeType === 'midplane'
    ? (evaluateExpression(plane.firstOffset, resolved.values) + evaluateExpression(plane.secondOffset, resolved.values)) / 2
    : evaluateExpression(plane.offset, resolved.values);
  if (!Number.isFinite(offsetValue)) throw new Error('Odległość płaszczyzny musi być skończoną liczbą.');
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
