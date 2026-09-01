export function boundsOverlap(firstBounds, secondBounds, tolerance = 1e-7) {
  if (!Array.isArray(firstBounds) || firstBounds.length !== 2 || !Array.isArray(secondBounds) || secondBounds.length !== 2) return true;
  return [0, 1, 2].every((axis) => {
    const firstMin = Number(firstBounds[0]?.[axis]);
    const firstMax = Number(firstBounds[1]?.[axis]);
    const secondMin = Number(secondBounds[0]?.[axis]);
    const secondMax = Number(secondBounds[1]?.[axis]);
    if (![firstMin, firstMax, secondMin, secondMax].every(Number.isFinite)) return true;
    return firstMax >= secondMin - tolerance && secondMax >= firstMin - tolerance;
  });
}

export const DRAFT_DIRECTIONS = Object.freeze({
  'x-positive': Object.freeze([1, 0, 0]),
  'x-negative': Object.freeze([-1, 0, 0]),
  'y-positive': Object.freeze([0, 1, 0]),
  'y-negative': Object.freeze([0, -1, 0]),
  'z-positive': Object.freeze([0, 0, 1]),
  'z-negative': Object.freeze([0, 0, -1]),
});

export const DRAFT_CLASS_COLORS = Object.freeze({
  positive: '#52c878',
  neutral: '#f0c75e',
  negative: '#ef6a6a',
  mixed: '#a985e8',
});

export const THICKNESS_CLASS_COLORS = Object.freeze({
  thin: '#ef6a6a',
  nominal: '#52c878',
  thick: '#5aa9e6',
  unknown: '#8895a7',
});

function unitVector(vector) {
  const values = [0, 1, 2].map((axis) => Number(vector?.[axis]));
  const length = Math.hypot(...values);
  if (!values.every(Number.isFinite) || length <= 1e-12) throw new Error('Kierunek analizy pochylenia musi być niezerowym wektorem XYZ.');
  return values.map((value) => value / length);
}

function signedDraftAngle(normal, pullDirection) {
  const normalized = unitVector(normal);
  const dot = Math.max(-1, Math.min(1, normalized.reduce((sum, value, axis) => sum + value * pullDirection[axis], 0)));
  return Math.asin(dot) * 180 / Math.PI;
}

function faceNormalAngles(body, faceGroup, pullDirection) {
  const angles = [];
  const end = Math.min(body.triangles?.length || 0, faceGroup.start + faceGroup.count);
  for (let index = faceGroup.start; index < end; index += 1) {
    const vertexIndex = Number(body.triangles[index]);
    const offset = vertexIndex * 3;
    const normal = [body.normals?.[offset], body.normals?.[offset + 1], body.normals?.[offset + 2]];
    if (normal.every(Number.isFinite)) angles.push(signedDraftAngle(normal, pullDirection));
  }
  if (!angles.length) {
    const descriptor = body.topology?.faces?.find((face) => face.id === faceGroup.topologyId)?.descriptor;
    if (descriptor?.normal) angles.push(signedDraftAngle(descriptor.normal, pullDirection));
  }
  return angles;
}

export function analyzeDraftAngles(bodies, { direction = DRAFT_DIRECTIONS['z-positive'], tolerance = 0.5 } = {}) {
  const pullDirection = unitVector(direction);
  const threshold = Number(tolerance);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 45) throw new Error('Tolerancja pochylenia musi mieścić się w zakresie 0–45°.');
  const faces = [];
  for (const body of bodies || []) {
    for (const faceGroup of body.faceGroups || []) {
      const angles = faceNormalAngles(body, faceGroup, pullDirection);
      if (!angles.length) continue;
      const minimumAngle = Math.min(...angles);
      const maximumAngle = Math.max(...angles);
      const classification = minimumAngle > threshold
        ? 'positive'
        : maximumAngle < -threshold
          ? 'negative'
          : minimumAngle >= -threshold && maximumAngle <= threshold
            ? 'neutral'
            : 'mixed';
      faces.push({
        bodyId: body.id,
        faceId: faceGroup.topologyId,
        minimumAngle,
        maximumAngle,
        classification,
        color: DRAFT_CLASS_COLORS[classification],
      });
    }
  }
  const counts = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  faces.forEach((face) => { counts[face.classification] += 1; });
  return { direction: pullDirection, tolerance: threshold, faces, counts, unsupportedBodies: (bodies || []).filter((body) => !(body.faceGroups || []).length).map((body) => body.id) };
}

function dot(first, second) {
  return first.reduce((sum, value, axis) => sum + value * second[axis], 0);
}

function subtract(first, second) {
  return first.map((value, axis) => value - second[axis]);
}

function planarThickness(descriptor, candidates) {
  if (!descriptor || descriptor.geometry !== 'PLANE' || !descriptor.center || !descriptor.normal) return null;
  const normal = unitVector(descriptor.normal);
  const distances = candidates
    .filter((candidate) => candidate !== descriptor && candidate.geometry === 'PLANE' && candidate.center && candidate.normal)
    .filter((candidate) => dot(normal, unitVector(candidate.normal)) < -0.98)
    .map((candidate) => Math.abs(dot(subtract(candidate.center, descriptor.center), normal)))
    .filter((distance) => distance > 1e-6);
  return distances.length ? Math.min(...distances) : null;
}

function cylindricalThickness(descriptor, candidates) {
  if (!descriptor || descriptor.geometry !== 'CYLINDRE' || !Number.isFinite(Number(descriptor.radius)) || !descriptor.axisDirection) return null;
  const axis = unitVector(descriptor.axisDirection);
  const distances = candidates
    .filter((candidate) => candidate !== descriptor && candidate.geometry === 'CYLINDRE' && Number.isFinite(Number(candidate.radius)) && candidate.axisDirection)
    .filter((candidate) => Math.abs(dot(axis, unitVector(candidate.axisDirection))) > 0.98)
    .filter((candidate) => !descriptor.axisOrigin || !candidate.axisOrigin || Math.hypot(...subtract(candidate.axisOrigin, descriptor.axisOrigin)) < 1e-3)
    .map((candidate) => Math.abs(Number(candidate.radius) - Number(descriptor.radius)))
    .filter((distance) => distance > 1e-6);
  return distances.length ? Math.min(...distances) : null;
}

export function analyzeWallThickness(bodies, { target = 2, tolerance = 0.25 } = {}) {
  const targetValue = Number(target);
  const toleranceValue = Number(tolerance);
  if (!Number.isFinite(targetValue) || targetValue <= 0) throw new Error('Docelowa grubość musi być dodatnia.');
  if (!Number.isFinite(toleranceValue) || toleranceValue < 0 || toleranceValue >= targetValue) throw new Error('Tolerancja grubości musi być nieujemna i mniejsza od wartości docelowej.');
  const faces = [];
  const unsupportedBodies = [];
  for (const body of bodies || []) {
    const descriptors = (body.topology?.faces || []).map((face) => face.descriptor).filter(Boolean);
    let supported = 0;
    for (const faceGroup of body.faceGroups || []) {
      const descriptor = body.topology?.faces?.find((face) => face.id === faceGroup.topologyId)?.descriptor;
      const thickness = planarThickness(descriptor, descriptors) ?? cylindricalThickness(descriptor, descriptors);
      const classification = thickness === null
        ? 'unknown'
        : thickness < targetValue - toleranceValue
          ? 'thin'
          : thickness > targetValue + toleranceValue
            ? 'thick'
            : 'nominal';
      if (thickness !== null) supported += 1;
      faces.push({ bodyId: body.id, faceId: faceGroup.topologyId, thickness, classification, color: THICKNESS_CLASS_COLORS[classification] });
    }
    if (!supported) unsupportedBodies.push(body.id);
  }
  const counts = { thin: 0, nominal: 0, thick: 0, unknown: 0 };
  faces.forEach((face) => { counts[face.classification] += 1; });
  const measured = faces.map((face) => face.thickness).filter(Number.isFinite);
  return {
    target: targetValue,
    tolerance: toleranceValue,
    faces,
    counts,
    minimum: measured.length ? Math.min(...measured) : null,
    maximum: measured.length ? Math.max(...measured) : null,
    unsupportedBodies,
    method: 'opposing-surfaces',
  };
}

export function summarizeGeometryInspection(bodies, analysis = {}) {
  const radii = bodies.map((body) => body.metrics?.minimumRadius).filter((radius) => Number.isFinite(radius) && radius > 0);
  return {
    bodyCount: bodies.length,
    minimumRadius: radii.length ? Math.min(...radii) : null,
    collisions: (analysis.collisions || []).map((collision) => ({ ...collision })),
    collisionStatus: analysis.collisionStatus || 'not-run',
    skippedPairs: Number(analysis.skippedPairs) || 0,
  };
}
