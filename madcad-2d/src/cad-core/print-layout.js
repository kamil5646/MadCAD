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

function triangleData(bodies = []) {
  const triangles = [];
  bodies.forEach((body) => {
    const vertices = body?.vertices;
    const indices = body?.triangles;
    if (!vertices?.length || !indices?.length) return;
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
      const points = [indices[offset], indices[offset + 1], indices[offset + 2]].map((index) => [
        Number(vertices[index * 3]), Number(vertices[index * 3 + 1]), Number(vertices[index * 3 + 2]),
      ]);
      if (points.some((point) => point.some((value) => !Number.isFinite(value)))) continue;
      const first = points[0];
      const ab = points[1].map((value, axis) => value - first[axis]);
      const ac = points[2].map((value, axis) => value - first[axis]);
      const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      const doubledArea = Math.hypot(...cross);
      if (doubledArea <= EPSILON) continue;
      triangles.push({ points, normal: cross.map((value) => value / doubledArea), area: doubledArea / 2 });
    }
  });
  return triangles;
}

function orientationCandidates(triangles, limit = 24) {
  const grouped = new Map();
  triangles.forEach(({ normal, area }) => {
    const key = normal.map((value) => Math.round(value * 20)).join(':');
    const current = grouped.get(key) || { normal: [0, 0, 0], area: 0 };
    current.normal = current.normal.map((value, axis) => value + normal[axis] * area);
    current.area += area;
    grouped.set(key, current);
  });
  [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0]].forEach((normal) => {
    const key = normal.map((value) => Math.round(value * 20)).join(':');
    if (!grouped.has(key)) grouped.set(key, { normal, area: 0 });
  });
  return [...grouped.values()]
    .sort((a, b) => b.area - a.area)
    .slice(0, limit)
    .map(({ normal }) => normalizeVector(normal));
}

function evaluatePrintOrientation(triangles, print, normal) {
  const orientation = orientationForBedFace(normal);
  const rawLayout = {
    ...print,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    orientationAxis: orientation.axis,
    orientationAngle: orientation.angle,
  };
  const transformed = triangles.map((triangle) => ({
    ...triangle,
    points: triangle.points.map((point) => transformPrintPoint(point, rawLayout)),
  }));
  const cloud = transformed.flatMap((triangle) => triangle.points);
  const bounds = unionPoints(cloud);
  const tolerance = Math.max(0.01, Math.max(...bounds.dimensions) * 1e-5);
  const overhangLimit = -Math.sin(Math.max(0, Math.min(89, Number(print.overhangAngle) || 45)) * Math.PI / 180);
  let baseArea = 0;
  let overhangArea = 0;
  transformed.forEach((triangle) => {
    const normalAfter = rotateAroundAxis(triangle.normal, orientation.axis, orientation.angle);
    const onBed = triangle.points.every((point) => Math.abs(point[2] - bounds.min[2]) <= tolerance);
    if (onBed && normalAfter[2] < -0.95) baseArea += triangle.area;
    else if (normalAfter[2] < overhangLimit) overhangArea += triangle.area;
  });
  const normalized = normalizePrintLayout(print);
  const areaScale = normalized.scale ** 2;
  baseArea *= areaScale;
  overhangArea *= areaScale;
  const pitch = bounds.dimensions[0] + normalized.copySpacing;
  const totalWidth = bounds.dimensions[0] + Math.max(0, normalized.copies - 1) * pitch;
  const totalDepth = bounds.dimensions[1];
  const fitsBed = totalWidth <= Number(print.bedWidth) + tolerance
    && totalDepth <= Number(print.bedDepth) + tolerance
    && bounds.dimensions[2] <= Number(print.bedHeight) + tolerance;
  const layout = {
    ...rawLayout,
    positionX: -(bounds.min[0] + bounds.max[0] + Math.max(0, normalized.copies - 1) * pitch) / 2,
    positionY: -(bounds.min[1] + bounds.max[1]) / 2,
    positionZ: -bounds.min[2],
  };
  return {
    layout,
    normal,
    fitsBed,
    baseArea,
    overhangArea,
    height: bounds.dimensions[2],
    dimensions: [totalWidth, totalDepth, bounds.dimensions[2]],
    score: (fitsBed ? 0 : 1e12) + overhangArea * 100 + bounds.dimensions[2] - baseArea * 2,
  };
}

export function recommendPrintOrientation(bodies = [], print = {}) {
  const triangles = triangleData(bodies);
  if (!triangles.length) return null;
  const candidates = orientationCandidates(triangles).map((normal) => evaluatePrintOrientation(triangles, print, normal));
  candidates.sort((a, b) => a.score - b.score || b.baseArea - a.baseArea || a.height - b.height);
  return { ...candidates[0], candidateCount: candidates.length };
}
