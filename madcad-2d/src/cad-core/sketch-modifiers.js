import { createSketchArc, createSketchLine, createSketchPoint } from './sketch-model.js';
import { intersectSketchCurves, sketchCurveGeometry } from './sketch-snap.js';
import { refreshDetectedSketchProfiles } from './sketch-topology.js';

const EPSILON = 1e-7;

function distance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function lineParameter(curve, point) {
  const dx = curve.end[0] - curve.start[0];
  const dy = curve.end[1] - curve.start[1];
  const lengthSquared = (dx * dx) + (dy * dy);
  return lengthSquared > EPSILON ? (((point[0] - curve.start[0]) * dx) + ((point[1] - curve.start[1]) * dy)) / lengthSquared : 0;
}

function arcSweep(curve) {
  const start = Math.atan2(curve.start[1] - curve.center[1], curve.start[0] - curve.center[0]);
  let end = Math.atan2(curve.end[1] - curve.center[1], curve.end[0] - curve.center[0]);
  if (curve.direction === 'cw') {
    if (end >= start) end -= Math.PI * 2;
  } else if (end <= start) end += Math.PI * 2;
  return { start, sweep: end - start };
}

function arcParameter(curve, point) {
  const { start, sweep } = arcSweep(curve);
  let angle = Math.atan2(point[1] - curve.center[1], point[0] - curve.center[0]);
  if (sweep < 0) while (angle > start) angle -= Math.PI * 2;
  else while (angle < start) angle += Math.PI * 2;
  return (angle - start) / sweep;
}

function curvePoint(curve, parameter) {
  if (curve.kind === 'line') return [
    curve.start[0] + ((curve.end[0] - curve.start[0]) * parameter),
    curve.start[1] + ((curve.end[1] - curve.start[1]) * parameter),
  ];
  const { start, sweep } = arcSweep(curve);
  const angle = start + (sweep * parameter);
  return [curve.center[0] + (Math.cos(angle) * curve.radius), curve.center[1] + (Math.sin(angle) * curve.radius)];
}

function nearestParameter(curve, point) {
  if (curve.kind === 'line') return Math.max(0, Math.min(1, lineParameter(curve, point)));
  return Math.max(0, Math.min(1, arcParameter(curve, point)));
}

function removeBrokenRelations(sketch, entityId) {
  const removedConstraintIds = (sketch.constraints || []).filter((constraint) => constraint.entityIds?.includes(entityId)).map((constraint) => constraint.id);
  const removedConstraintSet = new Set(removedConstraintIds);
  sketch.constraints = (sketch.constraints || []).filter((constraint) => !removedConstraintSet.has(constraint.id));
  const removedDimensionIds = (sketch.dimensions || []).filter((dimension) => dimension.entityIds?.includes(entityId) || removedConstraintSet.has(dimension.constraintId)).map((dimension) => dimension.id);
  const removedDimensionSet = new Set(removedDimensionIds);
  sketch.dimensions = (sketch.dimensions || []).filter((dimension) => !removedDimensionSet.has(dimension.id));
  return { removedConstraintIds, removedDimensionIds };
}

function replaceEndpoint(sketch, entity, index, coordinate) {
  const point = createSketchPoint({ x: coordinate[0], y: coordinate[1] });
  sketch.entities.push(point);
  entity.pointIds[index] = point.id;
  return point;
}

export function trimSketchEntity(document, sketchId, targetEntityId, pickPoint) {
  const sketch = document?.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono szkicu do przycięcia.');
  const geometry = sketchCurveGeometry(sketch, document.parameters);
  const target = geometry.curves.find((curve) => curve.id === targetEntityId);
  const targetEntity = geometry.map.get(targetEntityId);
  if (!target || !['line', 'arc'].includes(target.kind) || !targetEntity) throw new Error('Trim obsługuje obecnie linie i łuki szkicu.');
  if (!Array.isArray(pickPoint) || pickPoint.length !== 2 || pickPoint.some((value) => !Number.isFinite(Number(value)))) throw new Error('Trim wymaga punktu wskazania na krzywej.');

  const parameterFor = target.kind === 'line' ? lineParameter : arcParameter;
  const intersections = geometry.curves
    .filter((curve) => curve.id !== target.id)
    .flatMap((curve) => intersectSketchCurves(target, curve))
    .map((point) => ({ point, parameter: parameterFor(target, point) }))
    .filter((entry) => entry.parameter > EPSILON && entry.parameter < 1 - EPSILON)
    .sort((first, second) => first.parameter - second.parameter)
    .filter((entry, index, entries) => index === 0 || distance(entry.point, entries[index - 1].point) > EPSILON);
  if (!intersections.length) throw new Error('Brak przecięcia ograniczającego Trim.');

  const parameters = [0, ...intersections.map((entry) => entry.parameter), 1];
  const picked = nearestParameter(target, [Number(pickPoint[0]), Number(pickPoint[1])]);
  let intervalIndex = parameters.findIndex((value, index) => index < parameters.length - 1 && picked >= value - EPSILON && picked <= parameters[index + 1] + EPSILON);
  if (intervalIndex < 0) intervalIndex = parameters.length - 2;
  const lower = parameters[intervalIndex];
  const upper = parameters[intervalIndex + 1];
  const lowerPoint = curvePoint(target, lower);
  const upperPoint = curvePoint(target, upper);
  const originalPointIds = [...targetEntity.pointIds];
  const createdEntityIds = [];
  const createdPointIds = [];

  if (lower <= EPSILON) {
    const point = replaceEndpoint(sketch, targetEntity, target.kind === 'line' ? 0 : 1, upperPoint);
    createdPointIds.push(point.id);
  } else if (upper >= 1 - EPSILON) {
    const point = replaceEndpoint(sketch, targetEntity, target.kind === 'line' ? 1 : 2, lowerPoint);
    createdPointIds.push(point.id);
  } else {
    const lowerBoundary = replaceEndpoint(sketch, targetEntity, target.kind === 'line' ? 1 : 2, lowerPoint);
    const upperBoundary = createSketchPoint({ x: upperPoint[0], y: upperPoint[1] });
    sketch.entities.push(upperBoundary);
    const continuation = target.kind === 'line'
      ? createSketchLine({ startPointId: upperBoundary.id, endPointId: originalPointIds[1], role: targetEntity.role })
      : createSketchArc({ centerPointId: originalPointIds[0], startPointId: upperBoundary.id, endPointId: originalPointIds[2], direction: targetEntity.geometry.direction, role: targetEntity.role });
    sketch.entities.push(continuation);
    createdPointIds.push(lowerBoundary.id, upperBoundary.id);
    createdEntityIds.push(continuation.id);
  }

  const relationChanges = removeBrokenRelations(sketch, targetEntityId);
  const previousProfileIds = new Set((sketch.profiles || []).map((profile) => profile.id));
  refreshDetectedSketchProfiles(sketch, document.parameters);
  const remainingProfileIds = new Set(sketch.profiles.map((profile) => profile.id));
  const removedProfileIds = [...previousProfileIds].filter((profileId) => !remainingProfileIds.has(profileId));
  const removedProfileSet = new Set(removedProfileIds);
  const removedFeatureIds = (document.features || []).filter((feature) => (feature.profileIds || []).some((profileId) => removedProfileSet.has(profileId)) || removedProfileSet.has(feature.profileId)).map((feature) => feature.id);
  const removedFeatureSet = new Set(removedFeatureIds);
  document.features = (document.features || []).filter((feature) => !removedFeatureSet.has(feature.id));

  return {
    targetEntityId,
    keptEntityIds: [targetEntityId, ...createdEntityIds],
    createdEntityIds,
    createdPointIds,
    removedProfileIds,
    removedFeatureIds,
    ...relationChanges,
  };
}
