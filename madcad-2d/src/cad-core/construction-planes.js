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

export function resolveConstructionPlane(plane, parameters = []) {
  if (plane?.kind !== 'construction-plane' || plane.planeType !== 'offset') throw new Error('Nieobsługiwany typ płaszczyzny konstrukcyjnej.');
  const frame = BASE_PLANE_FRAMES[plane.basePlane];
  if (!frame) throw new Error(`Nieobsługiwana płaszczyzna bazowa: ${plane.basePlane}.`);
  const resolved = Array.isArray(parameters) ? resolveParameters(parameters) : { valid: true, values: parameters, errors: {} };
  if (!resolved.valid) throw new Error(Object.values(resolved.errors)[0] || 'Nie udało się rozwiązać parametrów płaszczyzny.');
  const offsetValue = evaluateExpression(plane.offset, resolved.values);
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
