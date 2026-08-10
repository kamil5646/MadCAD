import { createSketchArc, createSketchCircleEntity, createSketchLine, createSketchPoint } from './sketch-model.js';
import { evaluateExpression, resolveParameters } from './expressions.js';
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

function parameterValues(parameters) {
  if (!Array.isArray(parameters)) return parameters || {};
  const resolved = resolveParameters(parameters);
  if (!resolved.valid) throw new Error(Object.values(resolved.errors).join(' '));
  return resolved.values;
}

function numericDistance(value, parameters) {
  const distanceValue = evaluateExpression(value, parameterValues(parameters));
  if (!Number.isFinite(distanceValue) || Math.abs(distanceValue) <= EPSILON) throw new Error('Offset wymaga niezerowej, skończonej odległości.');
  return distanceValue;
}

function numericPositiveSize(value, parameters, label) {
  const size = evaluateExpression(value, parameterValues(parameters));
  if (!Number.isFinite(size) || size <= EPSILON) throw new Error(`${label} wymaga dodatniego, skończonego wymiaru.`);
  return size;
}

function lineIntersection(firstStart, firstEnd, secondStart, secondEnd) {
  const firstDirection = [firstEnd[0] - firstStart[0], firstEnd[1] - firstStart[1]];
  const secondDirection = [secondEnd[0] - secondStart[0], secondEnd[1] - secondStart[1]];
  const denominator = (firstDirection[0] * secondDirection[1]) - (firstDirection[1] * secondDirection[0]);
  if (Math.abs(denominator) <= EPSILON) return [(firstEnd[0] + secondStart[0]) / 2, (firstEnd[1] + secondStart[1]) / 2];
  const delta = [secondStart[0] - firstStart[0], secondStart[1] - firstStart[1]];
  const parameter = ((delta[0] * secondDirection[1]) - (delta[1] * secondDirection[0])) / denominator;
  return [firstStart[0] + (firstDirection[0] * parameter), firstStart[1] + (firstDirection[1] * parameter)];
}

function orderedLineChain(lines) {
  const lineById = new Map(lines.map((line) => [line.id, line]));
  const adjacency = new Map();
  for (const line of lines) {
    for (const pointId of line.pointIds) adjacency.set(pointId, [...(adjacency.get(pointId) || []), line.id]);
  }
  if ([...adjacency.values()].some((ids) => ids.length > 2)) throw new Error('Offset łańcucha nie obsługuje rozgałęzienia.');
  const endpoints = [...adjacency.entries()].filter(([, ids]) => ids.length === 1).map(([pointId]) => pointId);
  if (![0, 2].includes(endpoints.length)) throw new Error('Wybrane linie nie tworzą jednego łańcucha.');
  const startPointId = endpoints[0] || lines[0].pointIds[0];
  const unused = new Set(lineById.keys());
  const ordered = [];
  let currentPointId = startPointId;
  while (unused.size) {
    const nextId = (adjacency.get(currentPointId) || []).find((lineId) => unused.has(lineId));
    if (!nextId) throw new Error('Wybrane linie nie tworzą ciągłego łańcucha.');
    const line = lineById.get(nextId);
    const reversed = line.pointIds[1] === currentPointId;
    const endPointId = reversed ? line.pointIds[0] : line.pointIds[1];
    ordered.push({ entity: line, startPointId: currentPointId, endPointId });
    unused.delete(nextId);
    currentPointId = endPointId;
  }
  const closed = currentPointId === startPointId;
  if (!closed && endpoints.length !== 2) throw new Error('Łańcuch Offset ma nieprawidłowe zakończenie.');
  return { ordered, closed };
}

function offsetLineChain(sketch, curvesById, lines, distanceValue, role) {
  const { ordered, closed } = orderedLineChain(lines);
  const shifted = ordered.map(({ entity, startPointId, endPointId }) => {
    const curve = curvesById.get(entity.id);
    const forward = entity.pointIds[0] === startPointId;
    const start = forward ? curve.start : curve.end;
    const end = forward ? curve.end : curve.start;
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) throw new Error('Offset nie obsługuje linii o zerowej długości.');
    const normal = [-dy / length, dx / length];
    return {
      start: [start[0] + (normal[0] * distanceValue), start[1] + (normal[1] * distanceValue)],
      end: [end[0] + (normal[0] * distanceValue), end[1] + (normal[1] * distanceValue)],
    };
  });
  const vertices = [];
  if (closed) {
    for (let index = 0; index < shifted.length; index += 1) {
      const previous = shifted[(index - 1 + shifted.length) % shifted.length];
      const current = shifted[index];
      vertices.push(lineIntersection(previous.start, previous.end, current.start, current.end));
    }
  } else {
    vertices.push(shifted[0].start);
    for (let index = 1; index < shifted.length; index += 1) vertices.push(lineIntersection(shifted[index - 1].start, shifted[index - 1].end, shifted[index].start, shifted[index].end));
    vertices.push(shifted.at(-1).end);
  }
  if (vertices.some((vertex) => !vertex.every(Number.isFinite))) throw new Error('Offset utworzył nieprawidłowe przecięcie narożnika.');
  const points = vertices.map(([x, y]) => createSketchPoint({ x, y, role }));
  const createdLines = ordered.map((_, index) => createSketchLine({
    startPointId: points[index].id,
    endPointId: points[(index + 1) % points.length].id,
    role,
  }));
  sketch.entities.push(...points, ...createdLines);
  return { points, entities: createdLines, closed };
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

function buildOffset(sketch, entityIds, distanceValue, parameters, options = {}) {
  const geometry = sketchCurveGeometry(sketch, parameters);
  const uniqueIds = [...new Set(entityIds || [])];
  if (!uniqueIds.length) throw new Error('Offset wymaga co najmniej jednej krzywej.');
  const entities = uniqueIds.map((entityId) => geometry.map.get(entityId));
  if (entities.some((entity) => !entity)) throw new Error('Offset wskazuje brakującą encję szkicu.');
  if (entities.some((entity) => !['line', 'arc', 'circle'].includes(entity.type))) throw new Error('Offset obsługuje linie, łuki i okręgi.');
  const role = options.role || (entities.every((entity) => entity.role === entities[0].role) ? entities[0].role : 'standard');
  const curvesById = new Map(geometry.curves.map((curve) => [curve.id, curve]));
  let created;
  if (entities.every((entity) => entity.type === 'line')) {
    created = offsetLineChain(sketch, curvesById, entities, distanceValue, role);
  } else if (entities.length === 1 && entities[0].type === 'circle') {
    const curve = curvesById.get(entities[0].id);
    const radius = curve.radius + distanceValue;
    if (radius <= EPSILON) throw new Error('Offset okręgu daje niedodatni promień.');
    const center = createSketchPoint({ x: curve.center[0], y: curve.center[1], role });
    const circle = createSketchCircleEntity({ centerPointId: center.id, radius, role });
    sketch.entities.push(center, circle);
    created = { points: [center], entities: [circle], closed: true };
  } else if (entities.length === 1 && entities[0].type === 'arc') {
    const curve = curvesById.get(entities[0].id);
    const radius = curve.radius + distanceValue;
    if (radius <= EPSILON) throw new Error('Offset łuku daje niedodatni promień.');
    const radialPoint = (point) => {
      const vector = [point[0] - curve.center[0], point[1] - curve.center[1]];
      const length = Math.hypot(...vector);
      return [curve.center[0] + ((vector[0] / length) * radius), curve.center[1] + ((vector[1] / length) * radius)];
    };
    const center = createSketchPoint({ x: curve.center[0], y: curve.center[1], role });
    const start = createSketchPoint({ x: radialPoint(curve.start)[0], y: radialPoint(curve.start)[1], role });
    const end = createSketchPoint({ x: radialPoint(curve.end)[0], y: radialPoint(curve.end)[1], role });
    const arc = createSketchArc({ centerPointId: center.id, startPointId: start.id, endPointId: end.id, direction: curve.direction, role });
    sketch.entities.push(center, start, end, arc);
    created = { points: [center, start, end], entities: [arc], closed: false };
  } else {
    throw new Error('Mieszany Offset łańcucha łuków i linii nie jest jeszcze obsługiwany; wybierz pojedynczy łuk albo łańcuch linii.');
  }

  refreshDetectedSketchProfiles(sketch, parameters);
  const createdIds = new Set(created.entities.map((entity) => entity.id));
  const blockingDiagnostics = (sketch.diagnostics || []).filter((diagnostic) => ['SELF_INTERSECTION', 'OVERLAPPING_SEGMENTS', 'ZERO_LENGTH_SEGMENT'].includes(diagnostic.code)
    && diagnostic.entityIds?.some((entityId) => createdIds.has(entityId)));
  if (blockingDiagnostics.length) throw new Error(`Offset został odrzucony: ${blockingDiagnostics[0].message}`);
  const profileIds = sketch.profiles.filter((profile) => profile.entityIds.some((entityId) => createdIds.has(entityId))
    || (profile.innerLoops || []).some((loop) => loop.entityIds?.some((entityId) => createdIds.has(entityId)))).map((profile) => profile.id);
  return {
    distance: distanceValue,
    sourceEntityIds: uniqueIds,
    createdEntityIds: created.entities.map((entity) => entity.id),
    createdPointIds: created.points.map((point) => point.id),
    profileIds,
    closed: created.closed,
  };
}

export function offsetSketchEntities(document, sketchId, entityIds, distanceExpression, options = {}) {
  const sketch = document?.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono szkicu do wykonania Offset.');
  const distanceValue = numericDistance(distanceExpression, document.parameters);
  const workingSketch = structuredClone(sketch);
  const result = buildOffset(workingSketch, entityIds, distanceValue, document.parameters, options);
  Object.assign(sketch, workingSketch);
  return result;
}

export function offsetSketchProfile(document, sketchId, profileId, distanceExpression, options = {}) {
  const sketch = document?.sketches?.find((item) => item.id === sketchId);
  const profile = sketch?.profiles?.find((item) => item.id === profileId);
  if (!profile) throw new Error('Nie znaleziono profilu do wykonania Offset.');
  return offsetSketchEntities(document, sketchId, profile.entityIds, distanceExpression, options);
}

function preserveCornerProfileLineage(sketch, parameters, previousProfiles, sourceEntityIds, connectorId) {
  refreshDetectedSketchProfiles(sketch, parameters);
  const sourceSet = new Set(sourceEntityIds);
  for (const previous of previousProfiles) {
    if (!sourceEntityIds.every((entityId) => previous.entityIds?.includes(entityId))) continue;
    const expected = new Set([...(previous.entityIds || []), connectorId]);
    const replacement = sketch.profiles.find((profile) => profile.entityIds.length === expected.size
      && profile.entityIds.every((entityId) => expected.has(entityId)));
    if (replacement) {
      replacement.id = previous.id;
      replacement.name = previous.name || replacement.name;
      sourceSet.clear();
    }
  }
  if (sourceSet.size && previousProfiles.some((profile) => sourceEntityIds.every((entityId) => profile.entityIds?.includes(entityId)))) {
    throw new Error('Modyfikacja narożnika przerwała istniejący profil. Operacja została anulowana.');
  }
}

function buildCornerModification(sketch, sourceEntityIds, size, parameters, mode) {
  const uniqueIds = [...new Set(sourceEntityIds || [])];
  if (uniqueIds.length !== 2) throw new Error(`${mode === 'fillet' ? 'Fillet' : 'Chamfer'} wymaga dokładnie dwóch linii.`);
  const lines = uniqueIds.map((entityId) => sketch.entities.find((entity) => entity.id === entityId));
  if (lines.some((entity) => entity?.type !== 'line')) throw new Error('Modyfikacja narożnika obsługuje dwie linie szkicu.');
  const sharedPointIds = lines[0].pointIds.filter((pointId) => lines[1].pointIds.includes(pointId));
  if (sharedPointIds.length !== 1) throw new Error('Wybrane linie muszą mieć dokładnie jeden wspólny narożnik.');
  const cornerPointId = sharedPointIds[0];
  const pointMap = new Map(sketch.entities.filter((entity) => entity.type === 'point').map((point) => [point.id, point]));
  const coordinate = (pointId) => {
    const point = pointMap.get(pointId);
    if (!point) throw new Error('Narożnik wskazuje brakujący punkt.');
    return [evaluateExpression(point.geometry.x, parameterValues(parameters)), evaluateExpression(point.geometry.y, parameterValues(parameters))];
  };
  const corner = coordinate(cornerPointId);
  const otherPointIds = lines.map((line) => line.pointIds.find((pointId) => pointId !== cornerPointId));
  const vectors = otherPointIds.map((pointId) => {
    const other = coordinate(pointId);
    const vector = [other[0] - corner[0], other[1] - corner[1]];
    const length = Math.hypot(...vector);
    if (length <= EPSILON) throw new Error('Modyfikacja narożnika nie obsługuje linii o zerowej długości.');
    return { unit: [vector[0] / length, vector[1] / length], length };
  });
  const dot = Math.max(-1, Math.min(1, (vectors[0].unit[0] * vectors[1].unit[0]) + (vectors[0].unit[1] * vectors[1].unit[1])));
  const angle = Math.acos(dot);
  if (angle <= 1e-5 || Math.PI - angle <= 1e-5) throw new Error('Modyfikacja wymaga wyraźnego, niekoliniowego narożnika.');
  const setback = mode === 'fillet' ? size / Math.tan(angle / 2) : size;
  if (!Number.isFinite(setback) || setback >= Math.min(...vectors.map((vector) => vector.length)) - EPSILON) {
    throw new Error(`${mode === 'fillet' ? 'Promień Fillet' : 'Odległość Chamfer'} jest za duży dla wybranych linii.`);
  }

  const tangentCoordinates = vectors.map(({ unit }) => [corner[0] + (unit[0] * setback), corner[1] + (unit[1] * setback)]);
  const role = lines[0].role === lines[1].role ? lines[0].role : 'standard';
  const tangentPoints = tangentCoordinates.map(([x, y]) => createSketchPoint({ x, y, role }));
  lines.forEach((line, index) => {
    line.pointIds[line.pointIds.indexOf(cornerPointId)] = tangentPoints[index].id;
  });
  let connector;
  const createdPoints = [...tangentPoints];
  if (mode === 'fillet') {
    const bisector = [vectors[0].unit[0] + vectors[1].unit[0], vectors[0].unit[1] + vectors[1].unit[1]];
    const bisectorLength = Math.hypot(...bisector);
    const centerDistance = size / Math.sin(angle / 2);
    const centerCoordinate = [corner[0] + ((bisector[0] / bisectorLength) * centerDistance), corner[1] + ((bisector[1] / bisectorLength) * centerDistance)];
    const center = createSketchPoint({ x: centerCoordinate[0], y: centerCoordinate[1], role });
    const firstRadius = [tangentCoordinates[0][0] - centerCoordinate[0], tangentCoordinates[0][1] - centerCoordinate[1]];
    const secondRadius = [tangentCoordinates[1][0] - centerCoordinate[0], tangentCoordinates[1][1] - centerCoordinate[1]];
    const cross = (firstRadius[0] * secondRadius[1]) - (firstRadius[1] * secondRadius[0]);
    connector = createSketchArc({ centerPointId: center.id, startPointId: tangentPoints[0].id, endPointId: tangentPoints[1].id, direction: cross >= 0 ? 'ccw' : 'cw', role });
    createdPoints.push(center);
  } else {
    connector = createSketchLine({ startPointId: tangentPoints[0].id, endPointId: tangentPoints[1].id, role });
  }
  sketch.entities.push(...createdPoints, connector);

  const relationChanges = uniqueIds.reduce((changes, entityId) => {
    const removed = removeBrokenRelations(sketch, entityId);
    changes.removedConstraintIds.push(...removed.removedConstraintIds);
    changes.removedDimensionIds.push(...removed.removedDimensionIds);
    return changes;
  }, { removedConstraintIds: [], removedDimensionIds: [] });
  const cornerRelations = removeBrokenRelations(sketch, cornerPointId);
  relationChanges.removedConstraintIds.push(...cornerRelations.removedConstraintIds);
  relationChanges.removedDimensionIds.push(...cornerRelations.removedDimensionIds);
  relationChanges.removedConstraintIds = [...new Set(relationChanges.removedConstraintIds)];
  relationChanges.removedDimensionIds = [...new Set(relationChanges.removedDimensionIds)];
  if (!sketch.entities.some((entity) => entity.id !== cornerPointId && entity.pointIds?.includes(cornerPointId))) {
    sketch.entities = sketch.entities.filter((entity) => entity.id !== cornerPointId);
  }
  return { connector, tangentPoints, cornerPointId, ...relationChanges };
}

function modifySketchCorner(document, sketchId, sourceEntityIds, sizeExpression, mode) {
  const sketch = document?.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono szkicu do modyfikacji narożnika.');
  const label = mode === 'fillet' ? 'Fillet' : 'Chamfer';
  const size = numericPositiveSize(sizeExpression, document.parameters, label);
  const workingSketch = structuredClone(sketch);
  const previousProfiles = (workingSketch.profiles || []).map((profile) => structuredClone(profile));
  const result = buildCornerModification(workingSketch, sourceEntityIds, size, document.parameters, mode);
  preserveCornerProfileLineage(workingSketch, document.parameters, previousProfiles, sourceEntityIds, result.connector.id);
  const diagnostic = (workingSketch.diagnostics || []).find((item) => ['SELF_INTERSECTION', 'OVERLAPPING_SEGMENTS', 'ZERO_LENGTH_SEGMENT'].includes(item.code)
    && item.entityIds?.some((entityId) => entityId === result.connector.id || sourceEntityIds.includes(entityId)));
  if (diagnostic) throw new Error(`${label} został odrzucony: ${diagnostic.message}`);
  Object.assign(sketch, workingSketch);
  return {
    mode,
    size,
    sourceEntityIds: [...sourceEntityIds],
    connectorEntityId: result.connector.id,
    connectorType: result.connector.type,
    createdPointIds: result.tangentPoints.map((point) => point.id),
    removedPointId: result.cornerPointId,
    removedConstraintIds: result.removedConstraintIds,
    removedDimensionIds: result.removedDimensionIds,
  };
}

export function filletSketchLines(document, sketchId, lineIds, radiusExpression) {
  return modifySketchCorner(document, sketchId, lineIds, radiusExpression, 'fillet');
}

export function chamferSketchLines(document, sketchId, lineIds, distanceExpression) {
  return modifySketchCorner(document, sketchId, lineIds, distanceExpression, 'chamfer');
}
