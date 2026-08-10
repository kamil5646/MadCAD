export function calculateMassProperties(bodies, density = 1.24) {
  const densityValue = Number(density);
  if (!Number.isFinite(densityValue) || densityValue <= 0) throw new Error('Gęstość musi być dodatnią liczbą.');
  const measurable = bodies.filter((body) => Number.isFinite(body.metrics?.volume) && body.metrics.volume >= 0);
  const volume = measurable.reduce((sum, body) => sum + body.metrics.volume, 0);
  const area = measurable.reduce((sum, body) => sum + (body.metrics.area || 0), 0);
  const centerOfMass = volume > 0
    ? [0, 1, 2].map((axis) => measurable.reduce((sum, body) => sum + ((body.metrics.centerOfMass?.[axis] || 0) * body.metrics.volume), 0) / volume)
    : [0, 0, 0];
  return {
    bodyCount: measurable.length,
    volume,
    area,
    density: densityValue,
    mass: (volume / 1000) * densityValue,
    centerOfMass,
  };
}
