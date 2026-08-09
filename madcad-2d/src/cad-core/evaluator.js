import { evaluateExpression, resolveParameters } from './expressions.js';
import { findProfile, validateDocument } from './document.js';
import { buildDependencyGraph } from './dependency-graph.js';
import { GEOMETRY_POLICY, isPositiveLength } from './geometry-policy.js';
import { createTextProfile } from './text-profile.js';
import { BASE_PLANE_FRAMES, resolveConstructionPlane } from './construction-planes.js';
import { resolveConstructionAxis } from './construction-axes.js';

export const FEATURE_STATUS = Object.freeze({
  OK: 'ok',
  WARNING: 'warning',
  ERROR: 'error',
  SUPPRESSED: 'suppressed',
  STALE: 'stale',
});

function positive(value, label) {
  if (!isPositiveLength(value)) throw new Error(`${label} musi być większe od ${GEOMETRY_POLICY.linearTolerance} mm.`);
  return value;
}

function extrudeToObjectDistance(document, profiles, startOffsetValue, targetReferenceId, parameters) {
  const target = document.references.find((reference) => reference.id === targetReferenceId);
  if (!target) throw new Error('Nie znaleziono obiektu docelowego wyciągnięcia.');
  const source = profiles[0];
  const sourceFrame = BASE_PLANE_FRAMES[source?.plane || 'XY'];
  if (!sourceFrame) throw new Error('Nieobsługiwana płaszczyzna źródłowa wyciągnięcia.');
  const targetFrame = target.kind === 'construction-plane'
    ? resolveConstructionPlane(target, parameters)
    : target.kind === 'topology' && target.topologyKind === 'face' && target.descriptor?.geometry === 'PLANE'
      ? { origin: target.descriptor.center, normal: target.descriptor.normal }
      : null;
  if (!targetFrame?.origin || !targetFrame?.normal) throw new Error('Obiektem docelowym musi być płaszczyzna konstrukcyjna albo planarna ściana.');
  const parallel = Math.abs(sourceFrame.normal.reduce((sum, value, index) => sum + value * targetFrame.normal[index], 0));
  if (Math.abs(1 - parallel) > GEOMETRY_POLICY.angularTolerance) {
    throw new Error('Docelowa płaszczyzna wyciągnięcia musi być równoległa do płaszczyzny szkicu.');
  }
  const sourceOrigin = sourceFrame.origin.map((value, index) => value + sourceFrame.normal[index] * (source.planeOffset + startOffsetValue));
  const distance = targetFrame.origin.reduce((sum, value, index) => sum + ((value - sourceOrigin[index]) * sourceFrame.normal[index]), 0);
  return positive(distance, 'Odległość do obiektu docelowego');
}

function resolveClosedProfile(profile, parameters, sketch) {
  if (!sketch) throw new Error(`Profil ${profile.id} nie ma szkicu źródłowego.`);
  const entityMap = new Map(sketch.entities.map((entity) => [entity.id, entity]));
  const readPoint = (pointId) => {
    const point = entityMap.get(pointId);
    if (point?.type !== 'point') throw new Error(`Nie znaleziono punktu ${pointId} profilu ${profile.id}.`);
    return [evaluateExpression(point.geometry.x, parameters), evaluateExpression(point.geometry.y, parameters)];
  };
  const resolveLoop = (loop) => (loop.entityIds || []).map((entityId, entityIndex) => {
    const entity = entityMap.get(entityId);
    const reversed = loop.entityDirections?.[entityIndex] === -1;
    if (entity?.type === 'line') {
      const first = readPoint(entity.pointIds[0]);
      const second = readPoint(entity.pointIds[1]);
      const start = reversed ? second : first;
      const end = reversed ? first : second;
      positive(Math.hypot(end[0] - start[0], end[1] - start[1]), 'Długość linii');
      return { type: 'line', id: entity.id, start, end };
    }
    if (entity?.type === 'arc') {
      const center = readPoint(entity.pointIds[0]);
      const first = readPoint(entity.pointIds[1]);
      const second = readPoint(entity.pointIds[2]);
      const start = reversed ? second : first;
      const end = reversed ? first : second;
      positive(Math.hypot(start[0] - center[0], start[1] - center[1]), 'Promień łuku');
      const direction = reversed ? (entity.geometry.direction === 'cw' ? 'ccw' : 'cw') : entity.geometry.direction;
      return { type: 'arc', id: entity.id, center, start, end, direction };
    }
    if (entity?.type === 'ellipticalArc') {
      const center = readPoint(entity.pointIds[0]);
      const first = readPoint(entity.pointIds[1]);
      const second = readPoint(entity.pointIds[2]);
      const start = reversed ? second : first;
      const end = reversed ? first : second;
      const majorRadius = positive(evaluateExpression(entity.geometry.majorRadius, parameters), 'Promień główny łuku eliptycznego');
      const minorRadius = positive(evaluateExpression(entity.geometry.minorRadius, parameters), 'Promień boczny łuku eliptycznego');
      const rotation = evaluateExpression(entity.geometry.rotation || '0', parameters);
      const startAngle = evaluateExpression(reversed ? entity.geometry.endAngle : entity.geometry.startAngle, parameters);
      const endAngle = evaluateExpression(reversed ? entity.geometry.startAngle : entity.geometry.endAngle, parameters);
      const direction = reversed ? (entity.geometry.direction === 'cw' ? 'ccw' : 'cw') : entity.geometry.direction;
      let sweepAngle = endAngle - startAngle;
      if (direction === 'cw' && sweepAngle >= 0) sweepAngle -= 360;
      if (direction !== 'cw' && sweepAngle <= 0) sweepAngle += 360;
      return { type: 'ellipticalArc', id: entity.id, center, start, end, majorRadius, minorRadius, rotation, startAngle, endAngle, direction, longAxis: Math.abs(sweepAngle) > 180, sweep: direction === 'ccw' };
    }
    if (entity?.type === 'spline') {
      const splinePoints = (entity.pointIds || []).map(readPoint);
      const points = reversed ? [...splinePoints].reverse() : splinePoints;
      if (points.length < 2) throw new Error(`Spline ${entity.id} ma za mało punktów.`);
      const mode = entity.geometry?.mode === 'control' ? 'control' : 'fit';
      const beziers = [];
      if (mode === 'control') {
        beziers.push({ end: points.at(-1), controls: points.slice(1, -1) });
      } else {
        for (let index = 0; index < points.length - 1; index += 1) {
          const p0 = points[Math.max(0, index - 1)];
          const p1 = points[index];
          const p2 = points[index + 1];
          const p3 = points[Math.min(points.length - 1, index + 2)];
          beziers.push({
            end: p2,
            controls: [
              [p1[0] + ((p2[0] - p0[0]) / 6), p1[1] + ((p2[1] - p0[1]) / 6)],
              [p2[0] - ((p3[0] - p1[0]) / 6), p2[1] - ((p3[1] - p1[1]) / 6)],
            ],
          });
        }
      }
      return { type: 'spline', id: entity.id, mode, points, start: points[0], end: points.at(-1), beziers };
    }
    if (entity?.type === 'conic') {
      const conicPoints = (entity.pointIds || []).map(readPoint);
      const points = reversed ? [...conicPoints].reverse() : conicPoints;
      if (points.length !== 3) throw new Error(`Krzywa conic ${entity.id} wymaga trzech punktów.`);
      const rho = positive(evaluateExpression(entity.geometry?.rho || '1', parameters), 'Parametr rho');
      return {
        type: 'conic',
        id: entity.id,
        points,
        start: points[0],
        control: points[1],
        end: points[2],
        rho,
        continuity: entity.geometry?.continuity || 'free',
      };
    }
    if (entity?.type === 'circle' && (loop.entityIds || []).length === 1) {
      const center = readPoint(entity.pointIds[0]);
      const radius = positive(evaluateExpression(entity.geometry.radius, parameters), 'Promień okręgu');
      return { type: 'circle', id: entity.id, center, radius, start: [center[0] + radius, center[1]], end: [center[0] + radius, center[1]] };
    }
    if (entity?.type === 'ellipse' && (loop.entityIds || []).length === 1) {
      const center = readPoint(entity.pointIds[0]);
      const majorRadius = positive(evaluateExpression(entity.geometry.majorRadius, parameters), 'Promień główny elipsy');
      const minorRadius = positive(evaluateExpression(entity.geometry.minorRadius, parameters), 'Promień boczny elipsy');
      const rotation = evaluateExpression(entity.geometry.rotation || '0', parameters);
      return { type: 'ellipse', id: entity.id, center, majorRadius, minorRadius, rotation, start: [center[0] + majorRadius, center[1]], end: [center[0] + majorRadius, center[1]] };
    }
    throw new Error(`Nieobsługiwana encja ${entityId} w profilu ${profile.id}.`);
  });
  const segments = resolveLoop(profile);
  const holes = (profile.innerLoops || []).map((loop) => ({ segments: resolveLoop(loop) }));
  const points = segments.map((segment) => segment.start);
  const boundsPoints = segments.flatMap((segment) => {
    if (segment.type === 'circle') return [[segment.center[0] - segment.radius, segment.center[1] - segment.radius], [segment.center[0] + segment.radius, segment.center[1] + segment.radius]];
    if (segment.type === 'ellipse') {
      const radius = Math.max(segment.majorRadius, segment.minorRadius);
      return [[segment.center[0] - radius, segment.center[1] - radius], [segment.center[0] + radius, segment.center[1] + radius]];
    }
    return [segment.start, segment.end];
  });
  const xs = boundsPoints.map((point) => point[0]);
  const ys = boundsPoints.map((point) => point[1]);
  return {
    ...profile,
    geometry: {
      points,
      segments,
      holes: holes.map((hole) => ({ ...hole, points: hole.segments.map((segment) => segment.start) })),
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
  };
}

export function resolveProfile(profile, parameters, sketch = null) {
  const read = (value) => evaluateExpression(value, parameters);
  if (profile.type === 'rectangle') {
    return {
      ...profile,
      geometry: {
        width: positive(read(profile.geometry.width), 'Szerokość'),
        height: positive(read(profile.geometry.height), 'Wysokość'),
        x: read(profile.geometry.x),
        y: read(profile.geometry.y),
      }
    };
  }
  if (profile.type === 'circle') {
    return {
      ...profile,
      geometry: {
        diameter: positive(read(profile.geometry.diameter), 'Średnica'),
        x: read(profile.geometry.x),
        y: read(profile.geometry.y),
      }
    };
  }
  if (profile.type === 'closed') return resolveClosedProfile(profile, parameters, sketch);
  throw new Error(`Nieobsługiwany profil: ${profile.type}`);
}

function resolveOpenChainProfile(sketch, entityIds, parameters, featureId, operationName = 'Thin Extrude') {
  if (!sketch) throw new Error(`${operationName} nie ma szkicu źródłowego.`);
  const entityMap = new Map(sketch.entities.map((entity) => [entity.id, entity]));
  const readPoint = (pointId) => {
    const point = entityMap.get(pointId);
    if (point?.type !== 'point') throw new Error(`Nie znaleziono punktu ${pointId} otwartego łańcucha.`);
    return [evaluateExpression(point.geometry.x, parameters), evaluateExpression(point.geometry.y, parameters)];
  };
  const lines = entityIds.map((entityId) => entityMap.get(entityId));
  if (lines.some((entity) => entity?.type !== 'line')) throw new Error(`${operationName} obsługuje obecnie wyłącznie ścieżki z linii.`);
  const incidents = new Map();
  lines.forEach((line) => line.pointIds.forEach((pointId) => {
    if (!incidents.has(pointId)) incidents.set(pointId, []);
    incidents.get(pointId).push(line);
  }));
  if ([...incidents.values()].some((items) => items.length > 2)) throw new Error(`Ścieżka ${operationName} nie może mieć rozgałęzień.`);
  const endpoints = [...incidents.entries()].filter(([, items]) => items.length === 1).map(([pointId]) => pointId).sort((left, right) => {
    const first = readPoint(left); const second = readPoint(right);
    return first[0] - second[0] || first[1] - second[1] || left.localeCompare(right);
  });
  if (endpoints.length !== 2) throw new Error(`${operationName} wymaga jednego ciągłego łańcucha otwartego z dwoma końcami.`);
  const ordered = [];
  const remaining = new Set(lines.map((line) => line.id));
  let currentPointId = endpoints[0];
  while (remaining.size) {
    const line = (incidents.get(currentPointId) || []).find((candidate) => remaining.has(candidate.id));
    if (!line) throw new Error(`Wybrane linie nie tworzą jednej ciągłej ścieżki ${operationName}.`);
    const nextPointId = line.pointIds[0] === currentPointId ? line.pointIds[1] : line.pointIds[0];
    ordered.push({ line, startPointId: currentPointId, endPointId: nextPointId });
    remaining.delete(line.id);
    currentPointId = nextPointId;
  }
  if (currentPointId !== endpoints[1]) throw new Error(`Wybrane linie nie tworzą jednej otwartej ścieżki ${operationName}.`);
  const segments = ordered.map(({ line, startPointId, endPointId }) => ({ type: 'line', id: line.id, start: readPoint(startPointId), end: readPoint(endPointId) }));
  segments.forEach((segment) => positive(Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]), 'Długość linii otwartego łańcucha'));
  return { id: `open-${featureId}`, name: 'Otwarty łańcuch', type: 'open', geometry: { segments, points: [segments[0].start, ...segments.map((segment) => segment.end)], holes: [] } };
}

export function prepareDocument(document) {
  const validation = validateDocument(document);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const parameterResult = resolveParameters(document.parameters);
  if (!parameterResult.valid) {
    const message = Object.entries(parameterResult.errors).map(([name, error]) => `${name}: ${error}`).join(' ');
    throw new Error(message);
  }

  const dependencyGraph = buildDependencyGraph(document);
  const features = document.features.map((feature) => {
    if (feature.suppressed) return { ...feature, status: FEATURE_STATUS.SUPPRESSED, diagnostics: [] };
    if (feature.type === 'extrude') {
      const extent = feature.extent || 'one-side';
      const sourceSketch = document.sketches.find((sketch) => sketch.id === feature.sketchId);
      const profiles = feature.openEntityIds?.length
        ? [{ ...resolveOpenChainProfile(sourceSketch, feature.openEntityIds, parameterResult.values, feature.id), plane: sourceSketch?.plane || 'XY', planeOffset: evaluateExpression(sourceSketch?.planeOffset || 0, parameterResult.values) }]
        : feature.profileIds.map((profileId) => {
          const match = findProfile(document, profileId);
          if (!match) throw new Error(`Nie znaleziono profilu ${profileId}.`);
          return { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
        });
      const startOffsetValue = evaluateExpression(feature.startOffset ?? 0, parameterResult.values);
      const distanceValue = extent === 'to-object'
        ? extrudeToObjectDistance(document, profiles, startOffsetValue, feature.targetReferenceId, parameterResult.values)
        : positive(evaluateExpression(feature.distance, parameterResult.values), 'Odległość wyciągnięcia');
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        extent,
        startOffsetValue,
        distanceValue,
        wallThicknessValue: feature.thin ? positive(evaluateExpression(feature.wallThickness, parameterResult.values), 'Grubość ścianki') : null,
        targetObjectReference: extent === 'to-object' ? document.references.find((reference) => reference.id === feature.targetReferenceId) : null,
        secondDistanceValue: extent === 'two-sides'
          ? positive(evaluateExpression(feature.secondDistance ?? feature.distance, parameterResult.values), 'Odległość drugiej strony')
          : 0,
        profiles,
      };
    }
    if (feature.type === 'revolve') {
      const match = findProfile(document, feature.profileIds[0]);
      if (!match) throw new Error(`Nie znaleziono profilu ${feature.profileIds[0]}.`);
      const profile = { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
      const baseAxes = {
        X_AXIS: { id: 'X_AXIS', origin: [0, 0, 0], direction: [1, 0, 0] },
        Y_AXIS: { id: 'Y_AXIS', origin: [0, 0, 0], direction: [0, 1, 0] },
        Z_AXIS: { id: 'Z_AXIS', origin: [0, 0, 0], direction: [0, 0, 1] },
      };
      const axisReference = document.references.find((reference) => reference.id === feature.axisId);
      const axis = baseAxes[feature.axisId] || resolveConstructionAxis(axisReference, document.references, parameterResult.values);
      const angleValue = evaluateExpression(feature.angle, parameterResult.values);
      if (Math.abs(angleValue) <= GEOMETRY_POLICY.angularTolerance || Math.abs(angleValue) > 360) throw new Error('Kąt Revolve musi należeć do zakresu -360°–360° i być różny od zera.');
      const frame = BASE_PLANE_FRAMES[profile.plane];
      const planeOrigin = frame.origin.map((value, index) => value + frame.normal[index] * profile.planeOffset);
      const directionNormal = Math.abs(frame.normal.reduce((sum, value, index) => sum + value * axis.direction[index], 0));
      const originDistance = Math.abs(frame.normal.reduce((sum, value, index) => sum + value * (axis.origin[index] - planeOrigin[index]), 0));
      if (directionNormal > GEOMETRY_POLICY.angularTolerance || originDistance > GEOMETRY_POLICY.linearTolerance) throw new Error('Oś Revolve musi leżeć w płaszczyźnie szkicu.');
      return { ...feature, status: 'ready', diagnostics: [], profile, axis: { origin: axis.origin, direction: axis.direction }, angleValue };
    }
    if (feature.type === 'sweep') {
      const match = findProfile(document, feature.profileIds[0]);
      const pathSketch = document.sketches.find((sketch) => sketch.id === feature.pathSketchId);
      if (!match || !pathSketch) throw new Error('Nie znaleziono profilu albo ścieżki Sweep.');
      const profile = { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
      const path = { ...resolveOpenChainProfile(pathSketch, feature.pathEntityIds, parameterResult.values, feature.id, 'Sweep'), plane: pathSketch.plane || 'XY', planeOffset: evaluateExpression(pathSketch.planeOffset || 0, parameterResult.values) };
      return { ...feature, status: 'ready', diagnostics: [], profile, path };
    }
    if (feature.type === 'hole') {
      const holeType = feature.holeType || 'simple';
      const extent = feature.extent || 'distance';
      const diameterValue = positive(evaluateExpression(feature.diameter, parameterResult.values), 'Średnica otworu');
      const depthValue = extent === 'through-all' ? 1_000_000 : positive(evaluateExpression(feature.depth, parameterResult.values), 'Głębokość otworu');
      const counterboreDiameterValue = holeType === 'counterbore' ? positive(evaluateExpression(feature.counterboreDiameter, parameterResult.values), 'Średnica Counterbore') : null;
      const counterboreDepthValue = holeType === 'counterbore' ? positive(evaluateExpression(feature.counterboreDepth, parameterResult.values), 'Głębokość Counterbore') : null;
      const countersinkDiameterValue = holeType === 'countersink' ? positive(evaluateExpression(feature.countersinkDiameter, parameterResult.values), 'Średnica Countersink') : null;
      const countersinkAngleValue = holeType === 'countersink' ? evaluateExpression(feature.countersinkAngle, parameterResult.values) : null;
      const threadMode = feature.threadMode || 'none';
      const threadDiameterValue = threadMode !== 'none' ? positive(evaluateExpression(feature.threadDiameter, parameterResult.values), 'Średnica gwintu') : null;
      const threadPitchValue = threadMode !== 'none' ? positive(evaluateExpression(feature.threadPitch, parameterResult.values), 'Skok gwintu') : null;
      const threadLengthValue = threadMode !== 'none' ? positive(evaluateExpression(feature.threadLength, parameterResult.values), 'Długość gwintu') : null;
      const clearanceProfile = feature.clearanceProfile || 'nominal';
      const clearanceValue = clearanceProfile === 'fff' ? positive(evaluateExpression(feature.clearance, parameterResult.values), 'Luz promieniowy FFF') : 0;
      const effectiveDiameterValue = diameterValue + (2 * clearanceValue);
      if (counterboreDiameterValue !== null && counterboreDiameterValue <= diameterValue) throw new Error('Średnica Counterbore musi być większa od średnicy otworu.');
      if (countersinkDiameterValue !== null && countersinkDiameterValue <= diameterValue) throw new Error('Średnica Countersink musi być większa od średnicy otworu.');
      if (countersinkAngleValue !== null && (countersinkAngleValue <= 0 || countersinkAngleValue >= 180)) throw new Error('Kąt Countersink musi należeć do zakresu 0–180°.');
      if (threadDiameterValue !== null && threadDiameterValue <= effectiveDiameterValue) throw new Error('Średnica gwintu musi być większa od wykonawczej średnicy otworu bazowego.');
      if (threadMode === 'modeled' && (threadLengthValue / threadPitchValue) > 200) throw new Error('Modelowany gwint może mieć najwyżej 200 zwojów.');
      if (feature.placement === 'face-edges') {
        return {
          ...feature,
          status: 'ready',
          diagnostics: [],
          topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
          firstOffsetValue: positive(evaluateExpression(feature.firstOffset, parameterResult.values), 'Odległość od pierwszej krawędzi'),
          secondOffsetValue: positive(evaluateExpression(feature.secondOffset, parameterResult.values), 'Odległość od drugiej krawędzi'),
          holeType, extent, diameterValue, effectiveDiameterValue, clearanceProfile, clearanceValue, depthValue, counterboreDiameterValue, counterboreDepthValue, countersinkDiameterValue, countersinkAngleValue, threadMode, threadDiameterValue, threadPitchValue, threadLengthValue,
        };
      }
      let profile;
      let plane;
      if (feature.pointId) {
        const sketch = document.sketches.find((item) => item.id === feature.sketchId);
        const point = sketch?.entities.find((entity) => entity.id === feature.pointId && entity.type === 'point');
        if (!point) throw new Error(`Nie znaleziono punktu otworu ${feature.pointId}.`);
        profile = { id: feature.pointId, type: 'point', geometry: { x: evaluateExpression(point.geometry.x, parameterResult.values), y: evaluateExpression(point.geometry.y, parameterResult.values) } };
        plane = sketch.plane || 'XY';
      } else {
        const match = findProfile(document, feature.profileId);
        if (!match) throw new Error(`Nie znaleziono profilu otworu ${feature.profileId}.`);
        profile = resolveProfile(match.profile, parameterResult.values, match.sketch);
        plane = match.sketch.plane || 'XY';
      }
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        profile: { ...profile, plane, planeOffset: evaluateExpression((document.sketches.find((item) => item.id === feature.sketchId)?.planeOffset) || 0, parameterResult.values) },
        holeType, extent, diameterValue, effectiveDiameterValue, clearanceProfile, clearanceValue, depthValue, counterboreDiameterValue, counterboreDepthValue, countersinkDiameterValue, countersinkAngleValue, threadMode, threadDiameterValue, threadPitchValue, threadLengthValue,
      };
    }
    if (feature.type === 'boolean') {
      return { ...feature, status: 'ready', diagnostics: [] };
    }
    if (feature.type === 'primitive') {
      const read = (value, label, requirePositive = false) => {
        const result = evaluateExpression(value ?? 0, parameterResult.values);
        return requirePositive ? positive(result, label) : result;
      };
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        position: [read(feature.x, 'Położenie X'), read(feature.y, 'Położenie Y'), read(feature.z, 'Położenie Z')],
        ...(feature.primitiveType === 'box' ? {
          widthValue: read(feature.width, 'Szerokość', true),
          depthValue: read(feature.depth, 'Głębokość', true),
          heightValue: read(feature.height, 'Wysokość', true),
        } : {}),
        ...(['cylinder', 'sphere'].includes(feature.primitiveType) ? { radiusValue: read(feature.radius, 'Promień', true) } : {}),
        ...(feature.primitiveType === 'cylinder' ? { heightValue: read(feature.height, 'Wysokość', true) } : {}),
        ...(feature.primitiveType === 'torus' ? {
          majorRadiusValue: read(feature.majorRadius, 'Promień główny', true),
          minorRadiusValue: read(feature.minorRadius, 'Promień przekroju', true),
        } : {}),
      };
    }
    if (feature.type === 'importedModel') return { ...feature, status: 'ready', diagnostics: [] };
    if (feature.type === 'transform') {
      const read = (value) => evaluateExpression(value ?? 0, parameterResult.values);
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        translation: [read(feature.x), read(feature.y), read(feature.z)],
        angleValue: read(feature.angle),
        origin: [read(feature.originX), read(feature.originY), read(feature.originZ)],
      };
    }
    if (feature.type === 'offsetFace') {
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
        distanceValue: evaluateExpression(feature.distance, parameterResult.values),
      };
    }
    if (feature.type === 'textSolid') {
      const read = (value, label, requirePositive = false) => {
        const result = evaluateExpression(value ?? 0, parameterResult.values);
        return requirePositive ? positive(result, label) : result;
      };
      const fontSizeValue = read(feature.fontSize, 'Rozmiar tekstu', true);
      const x = read(feature.x, 'Położenie X');
      const y = read(feature.y, 'Położenie Y');
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        fontSizeValue,
        depthValue: read(feature.depth, 'Głębokość tekstu', true),
        position: [x, y, read(feature.z, 'Położenie Z')],
        profile: createTextProfile(feature.text, fontSizeValue, x, y),
      };
    }
    if (feature.type === 'fillet' || feature.type === 'chamfer') {
      const valueKey = feature.type === 'fillet' ? 'radius' : 'distance';
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
        sizeValue: positive(evaluateExpression(feature[valueKey], parameterResult.values), feature.type === 'fillet' ? 'Promień' : 'Odległość fazy'),
      };
    }
    if (feature.type === 'shell') {
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
        thicknessValue: positive(evaluateExpression(feature.thickness, parameterResult.values), 'Grubość Shell'),
      };
    }
    if (feature.type === 'draft') {
      const angleValue = evaluateExpression(feature.angle, parameterResult.values);
      if (Math.abs(angleValue) <= 1e-9 || Math.abs(angleValue) >= 89) throw new Error('Kąt Draft musi być różny od zera i mniejszy niż 89°.');
      const basePlane = BASE_PLANE_FRAMES[feature.neutralPlaneId];
      const constructionPlane = document.references.find((reference) => reference.id === feature.neutralPlaneId && reference.kind === 'construction-plane');
      const neutralPlane = basePlane || resolveConstructionPlane(constructionPlane, parameterResult.values);
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
        angleValue,
        neutralPlane: { origin: [...neutralPlane.origin], normal: [...neutralPlane.normal] },
      };
    }
    if (feature.type === 'splitBody') {
      const basePlane = BASE_PLANE_FRAMES[feature.planeId];
      const constructionPlane = document.references.find((reference) => reference.id === feature.planeId && reference.kind === 'construction-plane');
      const splitPlane = basePlane || resolveConstructionPlane(constructionPlane, parameterResult.values);
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        splitPlane: { origin: [...splitPlane.origin], normal: [...splitPlane.normal], u: [...splitPlane.u], v: [...splitPlane.v] },
      };
    }
    if (feature.type === 'splitFace') {
      const match = findProfile(document, feature.profileId);
      if (!match) throw new Error(`Nie znaleziono profilu Split Face ${feature.profileId}.`);
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        profile: { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) },
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
      };
    }
    if (feature.type === 'deleteFace') {
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
      };
    }
    if (feature.type === 'replaceFace') {
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
      };
    }
    throw new Error(`Nieobsługiwana operacja: ${feature.type}`);
  });

  return { parameters: parameterResult.values, features, dependencyGraph };
}
