export function summarizeGeometryInspection(bodies, analysis = {}) {
  const radii = bodies.map((body) => body.metrics?.minimumRadius).filter((radius) => Number.isFinite(radius) && radius > 0);
  return {
    bodyCount: bodies.length,
    minimumRadius: radii.length ? Math.min(...radii) : null,
    collisions: (analysis.collisions || []).map((collision) => ({ ...collision })),
  };
}
