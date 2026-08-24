function finiteVector(vector) {
  return [0, 1, 2].map((index) => Number.isFinite(Number(vector?.[index])) ? Number(vector[index]) : 0);
}

export function calculateExplodedOffsets(occurrences = [], amount = 0, spacing = 1) {
  const factor = Math.max(0, Math.min(1, Number(amount) || 0));
  const distance = Math.max(0, Number(spacing) || 0) * factor;
  const normalized = occurrences
    .filter((occurrence) => typeof occurrence?.id === 'string' && occurrence.id)
    .map((occurrence) => ({ id: occurrence.id, position: finiteVector(occurrence.position) }))
    .sort((first, second) => first.id.localeCompare(second.id));
  if (!normalized.length || distance === 0) return Object.fromEntries(normalized.map((occurrence) => [occurrence.id, [0, 0, 0]]));
  const center = normalized.reduce((sum, occurrence) => sum.map((value, index) => value + occurrence.position[index]), [0, 0, 0]).map((value) => value / normalized.length);
  return Object.fromEntries(normalized.map((occurrence, index) => {
    let direction = occurrence.position.map((value, axis) => value - center[axis]);
    let length = Math.hypot(...direction);
    if (length < 1e-9) {
      const angle = (index / Math.max(1, normalized.length)) * Math.PI * 2;
      direction = [Math.cos(angle), Math.sin(angle), ((index % 3) - 1) * 0.28];
      length = Math.hypot(...direction);
    }
    return [occurrence.id, direction.map((value) => (value / length) * distance)];
  }));
}
