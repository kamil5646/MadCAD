function rotateVectorAroundAxis(vector, axis, angleDegrees) {
  const length = Math.hypot(...axis) || 1;
  const unit = axis.map((value) => value / length);
  const angle = angleDegrees * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const dot = vector.reduce((sum, value, index) => sum + value * unit[index], 0);
  const cross = [
    unit[1] * vector[2] - unit[2] * vector[1],
    unit[2] * vector[0] - unit[0] * vector[2],
    unit[0] * vector[1] - unit[1] * vector[0],
  ];
  return vector.map((value, index) => (value * cosine) + (cross[index] * sine) + (unit[index] * dot * (1 - cosine)));
}

export function expandPatternedHoleInstances(hole, feature, translations = []) {
  const source = Array.isArray(hole.instances) && hole.instances.length
    ? hole.instances
    : hole.position && hole.direction
      ? [{ position: hole.position, direction: hole.direction, depth: hole.depth }]
      : [];
  if (!source.length) return [];
  if (feature.patternType === 'circular') {
    const denominator = Math.abs(feature.totalAngleValue) === 360 ? feature.occurrencesValue : Math.max(1, feature.occurrencesValue - 1);
    return source.flatMap((instance) => Array.from({ length: feature.occurrencesValue }, (_unused, index) => {
      const angle = feature.totalAngleValue * index / denominator;
      const relative = instance.position.map((value, axis) => value - feature.axis.origin[axis]);
      const rotated = rotateVectorAroundAxis(relative, feature.axis.direction, angle);
      return {
        ...instance,
        position: rotated.map((value, axis) => value + feature.axis.origin[axis]),
        direction: rotateVectorAroundAxis(instance.direction, feature.axis.direction, angle),
      };
    }));
  }
  return source.flatMap((instance) => [[0, 0, 0], ...translations].map((translation) => ({
    ...instance,
    position: instance.position.map((value, axis) => value + translation[axis]),
    direction: [...instance.direction],
  })));
}
