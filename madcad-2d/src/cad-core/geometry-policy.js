export const GEOMETRY_POLICY = Object.freeze({
  units: 'mm',
  linearTolerance: 1e-7,
  angularTolerance: 1e-9,
  profileJoinTolerance: 1e-5,
  selectionTolerancePixels: 8,
  displayMesh: Object.freeze({ linearTolerance: 0.08, angularTolerance: 0.2 }),
  exportMesh: Object.freeze({ linearTolerance: 0.05, angularTolerance: 0.15 }),
});

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isZeroLength(value, tolerance = GEOMETRY_POLICY.linearTolerance) {
  return isFiniteNumber(value) && Math.abs(value) <= tolerance;
}

export function isPositiveLength(value, tolerance = GEOMETRY_POLICY.linearTolerance) {
  return isFiniteNumber(value) && value > tolerance;
}

export function nearlyEqual(left, right, tolerance = GEOMETRY_POLICY.linearTolerance) {
  return isFiniteNumber(left) && isFiniteNumber(right) && Math.abs(left - right) <= tolerance;
}

export function quantizeGeometryValue(value, tolerance = GEOMETRY_POLICY.linearTolerance) {
  if (!isFiniteNumber(value)) throw new Error('Wartość geometrii musi być skończoną liczbą.');
  if (!(tolerance > 0)) throw new Error('Tolerancja geometrii musi być większa od zera.');
  return Math.round(value / tolerance) * tolerance;
}
