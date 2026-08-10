const EPSILON = 1e-9;

export const DEFAULT_PRINT_LAYOUT = Object.freeze({
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scale: 1,
  copies: 1,
  copySpacing: 10,
  orientationAxis: [0, 0, 1],
  orientationAngle: 0,
});

function finite(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeVector(vector, fallback = [0, 0, 1]) {
  if (!Array.isArray(vector) || vector.length !== 3) return [...fallback];
  const values = vector.map(Number);
  const length = Math.hypot(...values);
  return Number.isFinite(length) && length > EPSILON ? values.map((value) => value / length) : [...fallback];
}

export function normalizePrintLayout(print = {}) {
  return {
    positionX: finite(print.positionX, DEFAULT_PRINT_LAYOUT.positionX),
    positionY: finite(print.positionY, DEFAULT_PRINT_LAYOUT.positionY),
    positionZ: finite(print.positionZ, DEFAULT_PRINT_LAYOUT.positionZ),
    rotationX: finite(print.rotationX, DEFAULT_PRINT_LAYOUT.rotationX),
    rotationY: finite(print.rotationY, DEFAULT_PRINT_LAYOUT.rotationY),
    rotationZ: finite(print.rotationZ, DEFAULT_PRINT_LAYOUT.rotationZ),
    scale: Math.max(EPSILON, finite(print.scale, DEFAULT_PRINT_LAYOUT.scale)),
    copies: Math.max(1, Math.min(100, Math.round(finite(print.copies, DEFAULT_PRINT_LAYOUT.copies)))),
    copySpacing: Math.max(0, finite(print.copySpacing, DEFAULT_PRINT_LAYOUT.copySpacing)),
    orientationAxis: normalizeVector(print.orientationAxis),
    orientationAngle: finite(print.orientationAngle, DEFAULT_PRINT_LAYOUT.orientationAngle),
  };
}

export function orientationForBedFace(normal) {
  const source = normalizeVector(normal);
  const target = [0, 0, -1];
  const dot = Math.max(-1, Math.min(1, source[0] * target[0] + source[1] * target[1] + source[2] * target[2]));
  if (dot > 1 - EPSILON) return { axis: [0, 0, 1], angle: 0 };
  if (dot < -1 + EPSILON) return { axis: [1, 0, 0], angle: 180 };
  const axis = normalizeVector([
    source[1] * target[2] - source[2] * target[1],
    source[2] * target[0] - source[0] * target[2],
    source[0] * target[1] - source[1] * target[0],
  ]);
  return { axis, angle: Math.acos(dot) * 180 / Math.PI };
}

function rotateAroundAxis(point, axis, angleDegrees) {
  const angle = angleDegrees * Math.PI / 180;
  if (Math.abs(angle) <= EPSILON) return [...point];
  const [x, y, z] = point;
  const [u, v, w] = normalizeVector(axis);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const dot = u * x + v * y + w * z;
  return [
    x * cosine + (v * z - w * y) * sine + u * dot * (1 - cosine),
    y * cosine + (w * x - u * z) * sine + v * dot * (1 - cosine),
    z * cosine + (u * y - v * x) * sine + w * dot * (1 - cosine),
  ];
}

export function transformPrintPoint(point, print = {}, copyOffsetX = 0) {
  const layout = normalizePrintLayout(print);
  let transformed = point.map((value) => Number(value) * layout.scale);
  transformed = rotateAroundAxis(transformed, layout.orientationAxis, layout.orientationAngle);
  transformed = rotateAroundAxis(transformed, [1, 0, 0], layout.rotationX);
  transformed = rotateAroundAxis(transformed, [0, 1, 0], layout.rotationY);
  transformed = rotateAroundAxis(transformed, [0, 0, 1], layout.rotationZ);
  return [
    transformed[0] + layout.positionX + copyOffsetX,
    transformed[1] + layout.positionY,
    transformed[2] + layout.positionZ,
  ];
}

export function transformPrintDirection(direction, print = {}) {
  const layout = normalizePrintLayout(print);
  let transformed = rotateAroundAxis(normalizeVector(direction), layout.orientationAxis, layout.orientationAngle);
  transformed = rotateAroundAxis(transformed, [1, 0, 0], layout.rotationX);
  transformed = rotateAroundAxis(transformed, [0, 1, 0], layout.rotationY);
  transformed = rotateAroundAxis(transformed, [0, 0, 1], layout.rotationZ);
  return normalizeVector(transformed);
}

function corners(bounds) {
  const [min, max] = bounds;
  return [min[0], max[0]].flatMap((x) => [min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z) => [x, y, z])));
}

function unionPoints(points) {
  if (!points.length) return { min: [0, 0, 0], max: [0, 0, 0], dimensions: [0, 0, 0] };
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  points.forEach((point) => point.forEach((value, axis) => {
    min[axis] = Math.min(min[axis], value);
    max[axis] = Math.max(max[axis], value);
  }));
  return { min, max, dimensions: max.map((value, axis) => value - min[axis]) };
}

export function calculatePrintLayout(bodies = [], print = {}) {
  const layout = normalizePrintLayout(print);
  const basePoints = bodies.flatMap((body) => corners(body.bounds).map((point) => transformPrintPoint(point, { ...layout, positionX: 0, positionY: 0, positionZ: 0 }, 0)));
  const base = unionPoints(basePoints);
  const pitch = base.dimensions[0] + layout.copySpacing;
  const instances = Array.from({ length: layout.copies }, (_, index) => ({ index, offsetX: index * pitch }));
  const points = instances.flatMap(({ offsetX }) => basePoints.map((point) => [
    point[0] + layout.positionX + offsetX,
    point[1] + layout.positionY,
    point[2] + layout.positionZ,
  ]));
  return { ...unionPoints(points), layout, pitch, instances };
}
