const EPSILON = 1e-8;

const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
const cross = (left, right) => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
];

function vector3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => !Number.isFinite(Number(entry)))) {
    throw new Error(`${label} musi zawierać trzy skończone współrzędne.`);
  }
  return value.map(Number);
}

function normalize(value, label) {
  const vector = vector3(value, label);
  const length = Math.hypot(...vector);
  if (length <= EPSILON) throw new Error(`${label} nie może mieć zerowej długości.`);
  return vector.map((entry) => entry / length);
}

export function frameFromNormal(origin, normal, preferredDirection = [0, 0, 1]) {
  const resolvedOrigin = vector3(origin, 'Początek ramy szkicu');
  const resolvedNormal = normalize(normal, 'Normalna ramy szkicu');
  let preferred = normalize(preferredDirection, 'Preferowany kierunek ramy szkicu');
  if (Math.abs(dot(preferred, resolvedNormal)) > 0.96) preferred = Math.abs(resolvedNormal[2]) < 0.96 ? [0, 0, 1] : [0, 1, 0];
  const projected = preferred.map((value, index) => value - resolvedNormal[index] * dot(preferred, resolvedNormal));
  const u = normalize(projected, 'Kierunek X ramy szkicu');
  const v = normalize(cross(resolvedNormal, u), 'Kierunek Y ramy szkicu');
  return { origin: resolvedOrigin, normal: resolvedNormal, u, v };
}

export function normalizeSketchFrame(frame) {
  if (!frame || typeof frame !== 'object') throw new Error('Rama szkicu musi być obiektem.');
  const origin = vector3(frame.origin, 'Początek ramy szkicu');
  const normal = normalize(frame.normal, 'Normalna ramy szkicu');
  const rawU = normalize(frame.u, 'Kierunek X ramy szkicu');
  const projectedU = rawU.map((value, index) => value - normal[index] * dot(rawU, normal));
  const u = normalize(projectedU, 'Kierunek X ramy szkicu');
  let v = normalize(cross(normal, u), 'Kierunek Y ramy szkicu');
  if (frame.v && dot(v, normalize(frame.v, 'Kierunek Y ramy szkicu')) < 0) v = v.map((value) => -value);
  const handedness = dot(cross(u, v), normal);
  if (handedness < 0) v = v.map((value) => -value);
  return { origin, normal, u, v };
}

export function baseSketchFrame(plane = 'XY', planeOffset = 0) {
  const offset = Number(planeOffset) || 0;
  if (plane === 'XZ') return { origin: [0, -offset, 0], normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] };
  if (plane === 'YZ') return { origin: [offset, 0, 0], normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] };
  return { origin: [0, 0, offset], normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
}

export function resolveSketchFrame(sketchOrProfile = {}) {
  return sketchOrProfile.frame
    ? normalizeSketchFrame(sketchOrProfile.frame)
    : baseSketchFrame(sketchOrProfile.plane || 'XY', sketchOrProfile.planeOffset || 0);
}

export function mapSketchPoint(frame, x, y, elevation = 0) {
  const resolved = normalizeSketchFrame(frame);
  return resolved.origin.map((value, index) => value + resolved.u[index] * x + resolved.v[index] * y + resolved.normal[index] * elevation);
}

export function projectWorldPoint(frame, point) {
  const resolved = normalizeSketchFrame(frame);
  const relative = vector3(point, 'Punkt świata').map((value, index) => value - resolved.origin[index]);
  return [dot(relative, resolved.u), dot(relative, resolved.v), dot(relative, resolved.normal)];
}
