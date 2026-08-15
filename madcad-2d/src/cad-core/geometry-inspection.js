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
