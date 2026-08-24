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
