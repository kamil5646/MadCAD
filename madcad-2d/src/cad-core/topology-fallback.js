// Fallback matching for topology references after an upstream edit moved the
// geometry. Exact descriptor matching fails as soon as a dimension changes (the
// top face of a 40 mm extrude is no longer at z=40 when it becomes 50 mm), which
// broke every feature downstream. These rules accept only a candidate that is
// unambiguous; anything else stays lost and goes through the repair workflow.

const LINEAR = 1e-4;
const ANGULAR = 1e-7;

const subtract = (first, second) => first.map((value, axis) => Number(value) - Number(second[axis] || 0));
const dot = (first, second) => first.reduce((sum, value, axis) => sum + Number(value) * Number(second[axis] || 0), 0);
const length = (vector) => Math.hypot(...vector);
const isPoint = (value) => Array.isArray(value) && value.length >= 3 && value.every((entry) => Number.isFinite(Number(entry)));

function unit(vector) {
  if (!isPoint(vector)) return null;
  const size = length(vector);
  return size > 1e-12 ? vector.map((value) => Number(value) / size) : null;
}

function perpendicularOffset(offset, direction) {
  const along = dot(offset, direction);
  return length(offset.map((value, axis) => value - direction[axis] * along));
}

function relativeDifference(first, second) {
  return Math.abs(Number(first) - Number(second)) / Math.max(Math.abs(Number(first)), Math.abs(Number(second)), 1);
}

function single(indices) {
  return indices.length === 1 ? indices[0] : -1;
}

// A planar face that only slid along its own normal (same direction, same area,
// no in-plane shift), or a cylinder that only slid along its axis.
export function translatedFaceIndex(expected, descriptors) {
  if (!expected || !Array.isArray(descriptors)) return -1;
  if (expected.geometry === 'PLANE') {
    const normal = unit(expected.normal);
    if (!normal || !isPoint(expected.center) || !(Number(expected.area) > 0)) return -1;
    return single(descriptors.flatMap((candidate, index) => {
      if (candidate?.geometry !== 'PLANE' || !isPoint(candidate.center)) return [];
      const candidateNormal = unit(candidate.normal);
      if (!candidateNormal || 1 - dot(normal, candidateNormal) > ANGULAR) return [];
      if (relativeDifference(expected.area, candidate.area) > 1e-6) return [];
      return perpendicularOffset(subtract(candidate.center, expected.center), normal) <= LINEAR ? [index] : [];
    }));
  }
  if (expected.geometry === 'CYLINDRE') {
    const axis = unit(expected.axisDirection);
    if (!axis || !isPoint(expected.axisOrigin) || !(Number(expected.radius) > 0)) return -1;
    return single(descriptors.flatMap((candidate, index) => {
      if (candidate?.geometry !== 'CYLINDRE' || !isPoint(candidate.axisOrigin)) return [];
      const candidateAxis = unit(candidate.axisDirection);
      if (!candidateAxis || 1 - Math.abs(dot(axis, candidateAxis)) > ANGULAR) return [];
      if (Math.abs(Number(expected.radius) - Number(candidate.radius)) > LINEAR) return [];
      return perpendicularOffset(subtract(candidate.axisOrigin, expected.axisOrigin), axis) <= LINEAR ? [index] : [];
    }));
  }
  return -1;
}

// A straight edge that kept one endpoint and grew or shrank along its own line
// (the vertical edge of a box whose height changed).
export function stretchedEdgeIndex(expected, descriptors) {
  if (expected?.geometry !== 'LINE' || !Array.isArray(expected.endpoints) || expected.endpoints.length !== 2) return -1;
  const [first, second] = expected.endpoints;
  if (!isPoint(first) || !isPoint(second)) return -1;
  const direction = unit(subtract(second, first));
  if (!direction) return -1;
  return single(descriptors.flatMap((candidate, index) => {
    if (candidate?.geometry !== 'LINE' || !Array.isArray(candidate.endpoints) || candidate.endpoints.length !== 2) return [];
    const ends = candidate.endpoints;
    if (!ends.every(isPoint)) return [];
    const candidateDirection = unit(subtract(ends[1], ends[0]));
    if (!candidateDirection || 1 - Math.abs(dot(direction, candidateDirection)) > ANGULAR) return [];
    const sharesEndpoint = ends.some((end) => length(subtract(end, first)) <= LINEAR || length(subtract(end, second)) <= LINEAR);
    if (!sharesEndpoint) return [];
    return ends.every((end) => perpendicularOffset(subtract(end, first), direction) <= LINEAR) ? [index] : [];
  }));
}

// Sketch support: the face a sketch sits on moved along its normal. Later
// features may have cut the face (a hole changes its area and centroid), so the
// area is ignored and a small in-plane centroid shift is tolerated; the nearest
// candidate must be clearly nearer than any other.
export function movedSupportFaceIndex(expected, descriptors, excluded = new Set()) {
  if (expected?.geometry !== 'PLANE') return -1;
  const normal = unit(expected.normal);
  if (!normal || !isPoint(expected.center) || !(Number(expected.area) > 0)) return -1;
  const limit = 0.25 * Math.sqrt(Number(expected.area));
  const matches = descriptors.flatMap((candidate, index) => {
    if (excluded.has(index) || candidate?.geometry !== 'PLANE' || !isPoint(candidate.center)) return [];
    const candidateNormal = unit(candidate.normal);
    if (!candidateNormal || 1 - dot(normal, candidateNormal) > ANGULAR) return [];
    const inPlane = perpendicularOffset(subtract(candidate.center, expected.center), normal);
    return inPlane <= limit ? [{ index, inPlane }] : [];
  }).sort((left, right) => left.inPlane - right.inPlane);
  if (!matches.length) return -1;
  if (matches.length > 1 && !(matches[0].inPlane * 2 < matches[1].inPlane)) return -1;
  return matches[0].index;
}
