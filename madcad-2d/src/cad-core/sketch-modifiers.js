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

function removeLostProfileFeatures(document, previousProfileIds, sketch) {
  const remainingProfileIds = new Set(sketch.profiles.map((profile) => profile.id));
  const removedProfileIds = [...previousProfileIds].filter((profileId) => !remainingProfileIds.has(profileId));
  const removedProfileSet = new Set(removedProfileIds);
  const removedFeatureIds = (document.features || []).filter((feature) => (feature.profileIds || []).some((profileId) => removedProfileSet.has(profileId)) || removedProfileSet.has(feature.profileId)).map((feature) => feature.id);
  const removedFeatureSet = new Set(removedFeatureIds);
  document.features = (document.features || []).filter((feature) => !removedFeatureSet.has(feature.id));
  return { removedProfileIds, removedFeatureIds };
}

function refreshProfilesWithSplitLineage(sketch, parameters, previousProfiles, targetEntityId, continuationId) {
  refreshDetectedSketchProfiles(sketch, parameters);
  for (const previous of previousProfiles) {
    if (!(previous.entityIds || []).includes(targetEntityId)) continue;
    const expected = new Set(previous.entityIds.flatMap((entityId) => entityId === targetEntityId ? [targetEntityId, continuationId] : [entityId]));
    const replacement = sketch.profiles.find((profile) => profile.entityIds.length === expected.size && profile.entityIds.every((entityId) => expected.has(entityId)));
    if (replacement) {
      replacement.id = previous.id;
      replacement.name = previous.name || replacement.name;
    }
  }
}

function extendedLineIntersections(target, curves) {
  const dx = target.end[0] - target.start[0];
  const dy = target.end[1] - target.start[1];
  const length = Math.hypot(dx, dy);
  if (length <= EPSILON) return [];
  const scale = Math.max(1000, ...curves.flatMap((curve) => curve.kind === 'line'
    ? [distance(curve.start, target.start), distance(curve.end, target.start)]
    : [distance(curve.center, target.start) + curve.radius])) * 4;
  const direction = [dx / length, dy / length];
  const extended = {
    kind: 'line',
    start: [target.start[0] - (direction[0] * scale), target.start[1] - (direction[1] * scale)],
    end: [target.end[0] + (direction[0] * scale), target.end[1] + (direction[1] * scale)],
  };
  return curves.flatMap((curve) => intersectSketchCurves(extended, curve));
}

function uniqueParameterizedPoints(curve, points) {
  const parameterFor = curve.kind === 'line' ? lineParameter : arcParameter;
  return points.map((point) => ({ point, parameter: parameterFor(curve, point) }))
    .sort((first, second) => first.parameter - second.parameter)
    .filter((entry, index, entries) => index === 0 || distance(entry.point, entries[index - 1].point) > EPSILON);
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
  const { removedProfileIds, removedFeatureIds } = removeLostProfileFeatures(document, previousProfileIds, sketch);

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

export function breakSketchEntity(document, sketchId, targetEntityId, breakPoint) {
  const sketch = document?.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono szkicu do podziału.');
  const geometry = sketchCurveGeometry(sketch, document.parameters);
  const target = geometry.curves.find((curve) => curve.id === targetEntityId);
  const targetEntity = geometry.map.get(targetEntityId);
  if (!target || !['line', 'arc'].includes(target.kind) || !targetEntity) throw new Error('Break obsługuje obecnie linie i łuki szkicu.');
  if (!Array.isArray(breakPoint) || breakPoint.length !== 2 || breakPoint.some((value) => !Number.isFinite(Number(value)))) throw new Error('Break wymaga punktu podziału.');
  const parameter = nearestParameter(target, [Number(breakPoint[0]), Number(breakPoint[1])]);
  if (parameter <= EPSILON || parameter >= 1 - EPSILON) throw new Error('Punkt Break musi leżeć wewnątrz krzywej.');

  const coordinate = curvePoint(target, parameter);
  const splitPoint = createSketchPoint({ x: coordinate[0], y: coordinate[1] });
  const originalPointIds = [...targetEntity.pointIds];
  const continuation = target.kind === 'line'
    ? createSketchLine({ startPointId: splitPoint.id, endPointId: originalPointIds[1], role: targetEntity.role })
    : createSketchArc({ centerPointId: originalPointIds[0], startPointId: splitPoint.id, endPointId: originalPointIds[2], direction: targetEntity.geometry.direction, role: targetEntity.role });
  targetEntity.pointIds[target.kind === 'line' ? 1 : 2] = splitPoint.id;
  sketch.entities.push(splitPoint, continuation);
  const relationChanges = removeBrokenRelations(sketch, targetEntityId);
  const previousProfiles = (sketch.profiles || []).map((profile) => ({ ...profile, entityIds: [...(profile.entityIds || [])] }));
  const previousProfileIds = new Set(previousProfiles.map((profile) => profile.id));
  refreshProfilesWithSplitLineage(sketch, document.parameters, previousProfiles, targetEntityId, continuation.id);
  const profileChanges = removeLostProfileFeatures(document, previousProfileIds, sketch);
  return {
    targetEntityId,
    continuationEntityId: continuation.id,
    splitPointId: splitPoint.id,
    keptEntityIds: [targetEntityId, continuation.id],
    ...relationChanges,
    ...profileChanges,
  };
}

export function extendSketchEntity(document, sketchId, targetEntityId, pickPoint) {
  const sketch = document?.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono szkicu do przedłużenia.');
  const geometry = sketchCurveGeometry(sketch, document.parameters);
  const target = geometry.curves.find((curve) => curve.id === targetEntityId);
  const targetEntity = geometry.map.get(targetEntityId);
  if (!target || !['line', 'arc'].includes(target.kind) || !targetEntity) throw new Error('Extend obsługuje obecnie linie i łuki szkicu.');
  if (!Array.isArray(pickPoint) || pickPoint.length !== 2 || pickPoint.some((value) => !Number.isFinite(Number(value)))) throw new Error('Extend wymaga wskazania końca krzywej.');
  const extendStart = distance([Number(pickPoint[0]), Number(pickPoint[1])], target.start) < distance([Number(pickPoint[0]), Number(pickPoint[1])], target.end);
  const otherCurves = geometry.curves.filter((curve) => curve.id !== targetEntityId);
  const rawIntersections = target.kind === 'line'
    ? extendedLineIntersections(target, otherCurves)
    : otherCurves.flatMap((curve) => intersectSketchCurves({ kind: 'circle', center: target.center, radius: target.radius }, curve));
  let candidates = uniqueParameterizedPoints(target, rawIntersections).filter((entry) => entry.parameter < -EPSILON || entry.parameter > 1 + EPSILON);
  if (target.kind === 'line') {
    candidates = candidates.filter((entry) => extendStart ? entry.parameter < 0 : entry.parameter > 1)
      .sort((first, second) => extendStart ? second.parameter - first.parameter : first.parameter - second.parameter);
  } else {
    const fullTurnParameter = (Math.PI * 2) / Math.abs(arcSweep(target).sweep);
    candidates = candidates.filter((entry) => entry.parameter > 1 + EPSILON && entry.parameter < fullTurnParameter - EPSILON)
      .sort((first, second) => extendStart
        ? (fullTurnParameter - first.parameter) - (fullTurnParameter - second.parameter)
        : (first.parameter - 1) - (second.parameter - 1));
  }
  if (!candidates.length) throw new Error('Brak geometrii, do której można wykonać Extend.');

  const selected = candidates[0].point;
  const endpointIndex = target.kind === 'line' ? (extendStart ? 0 : 1) : (extendStart ? 1 : 2);
  const previousPointId = targetEntity.pointIds[endpointIndex];
  const point = replaceEndpoint(sketch, targetEntity, endpointIndex, selected);
  const relationChanges = removeBrokenRelations(sketch, targetEntityId);
  const previousProfileIds = new Set((sketch.profiles || []).map((profile) => profile.id));
  refreshDetectedSketchProfiles(sketch, document.parameters);
  const profileChanges = removeLostProfileFeatures(document, previousProfileIds, sketch);
  return {
    targetEntityId,
    extendedEndpoint: extendStart ? 'start' : 'end',
    previousPointId,
    pointId: point.id,
    point: selected,
    ...relationChanges,
    ...profileChanges,
  };
}
