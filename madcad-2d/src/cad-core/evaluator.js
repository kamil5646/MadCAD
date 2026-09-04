import { evaluateExpression, resolveParameters } from './expressions.js';
import { findProfile, validateDocument } from './document.js';
import { buildDependencyGraph } from './dependency-graph.js';
import { GEOMETRY_POLICY, isPositiveLength } from './geometry-policy.js';
import { createTextProfile } from './text-profile.js';
import { BASE_PLANE_FRAMES, resolveConstructionPlane } from './construction-planes.js';
import { resolveConstructionAxis } from './construction-axes.js';
import { FORM_CONTROL_EDGES, bridgeFormFaces, createBoxControlCage, fillFormHoles, formControlSymmetryPairs, insertFormEdgeLoop, symmetricFormFaceIndexes } from './subdivision-form.js';

export const FEATURE_STATUS = Object.freeze({
  OK: 'ok',
  WARNING: 'warning',
  ERROR: 'error',
  SUPPRESSED: 'suppressed',
  ROLLED_BACK: 'rolled-back',
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
    return [
      evaluateExpression(point.geometry.x, parameters),
      evaluateExpression(point.geometry.y, parameters),
      ...(sketch.space === '3d' ? [evaluateExpression(point.geometry.z, parameters)] : []),
    ];
  };
  const curves = entityIds.map((entityId) => entityMap.get(entityId));
  const supportedTypes = sketch.space === '3d' ? ['line', 'arc3d', 'spline3d', 'bspline3d'] : ['line'];
  if (curves.some((entity) => !supportedTypes.includes(entity?.type))) throw new Error(`${operationName} wymaga ciągłej ścieżki z obsługiwanych krzywych.`);
  const incidents = new Map();
  curves.forEach((curve) => [curve.pointIds[0], curve.pointIds.at(-1)].forEach((pointId) => {
    if (!incidents.has(pointId)) incidents.set(pointId, []);
    incidents.get(pointId).push(curve);
  }));
  if ([...incidents.values()].some((items) => items.length > 2)) throw new Error(`Ścieżka ${operationName} nie może mieć rozgałęzień.`);
  const endpoints = [...incidents.entries()].filter(([, items]) => items.length === 1).map(([pointId]) => pointId).sort((left, right) => {
    const first = readPoint(left); const second = readPoint(right);
    return first[0] - second[0] || first[1] - second[1] || (first[2] || 0) - (second[2] || 0) || left.localeCompare(right);
  });
  if (endpoints.length !== 2) throw new Error(`${operationName} wymaga jednego ciągłego łańcucha otwartego z dwoma końcami.`);
  const ordered = [];
  const remaining = new Set(curves.map((curve) => curve.id));
  let currentPointId = endpoints[0];
  while (remaining.size) {
    const curve = (incidents.get(currentPointId) || []).find((candidate) => remaining.has(candidate.id));
    if (!curve) throw new Error(`Wybrane krzywe nie tworzą jednej ciągłej ścieżki ${operationName}.`);
    const nextPointId = curve.pointIds[0] === currentPointId ? curve.pointIds.at(-1) : curve.pointIds[0];
    ordered.push({ curve, startPointId: currentPointId, endPointId: nextPointId, reversed: curve.pointIds[0] !== currentPointId });
    remaining.delete(curve.id);
    currentPointId = nextPointId;
  }
  if (currentPointId !== endpoints[1]) throw new Error(`Wybrane krzywe nie tworzą jednej otwartej ścieżki ${operationName}.`);
  const vector = (curve, prefix) => ['X', 'Y', 'Z'].map((axis) => evaluateExpression(curve.geometry[`${prefix}${axis}`], parameters));
  const segments = ordered.map(({ curve, startPointId, endPointId, reversed }) => {
    const start = readPoint(startPointId);
    const end = readPoint(endPointId);
    if (curve.type === 'arc3d') return { type: 'arc3d', id: curve.id, start, through: vector(curve, 'through'), end };
    if (curve.type === 'spline3d') {
      const controls = [vector(curve, 'control1'), vector(curve, 'control2')];
      positive(evaluateExpression(curve.geometry.handleLength ?? '1', parameters), 'Długość uchwytu spline 3D');
      return { type: 'spline3d', id: curve.id, start, controls: reversed ? controls.reverse() : controls, end };
    }
    if (curve.type === 'bspline3d') {
      const bspline = structuredClone(curve.geometry.bspline);
      const sourceStart = bspline.startPoint;
      const sourceDirectionReversed = Array.isArray(sourceStart)
        && Math.hypot(...start.map((value, axis) => value - sourceStart[axis])) > Math.hypot(...end.map((value, axis) => value - sourceStart[axis]));
      const samples = structuredClone(curve.geometry.samples || []);
      return { type: 'bspline3d', id: curve.id, start, end, bspline, reversed: sourceDirectionReversed, samples: sourceDirectionReversed ? samples.reverse() : samples };
    }
    return { type: 'line', id: curve.id, start, end };
  });
  segments.forEach((segment) => positive(Math.hypot(...segment.end.map((value, axis) => value - segment.start[axis])), 'Długość krzywej otwartego łańcucha'));
  const subtract = (left, right) => left.map((value, axis) => value - right[axis]);
  const add = (left, right) => left.map((value, axis) => value + right[axis]);
  const scale = (vectorValue, factor) => vectorValue.map((value) => value * factor);
  const dot = (left, right) => left.reduce((sum, value, axis) => sum + value * right[axis], 0);
  const cross = (left, right) => [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
  const normalized = (vectorValue) => {
    const length = Math.hypot(...vectorValue);
    return scale(vectorValue, 1 / length);
  };
  const sampleArc = (segment, divisions = 48) => {
    const firstChord = subtract(segment.through, segment.start);
    const secondChord = subtract(segment.end, segment.start);
    const normalVector = cross(firstChord, secondChord);
    const denominator = 2 * dot(normalVector, normalVector);
    if (denominator <= GEOMETRY_POLICY.linearTolerance ** 2) throw new Error('Łuk 3D wymaga trzech niewspółliniowych punktów.');
    const center = add(segment.start, scale(add(
      scale(cross(secondChord, normalVector), dot(firstChord, firstChord)),
      scale(cross(normalVector, firstChord), dot(secondChord, secondChord)),
    ), 1 / denominator));
    const xAxis = normalized(subtract(segment.start, center));
    const normal = normalized(normalVector);
    const yAxis = cross(normal, xAxis);
    const angleOf = (point) => {
      const relative = subtract(point, center);
      const angle = Math.atan2(dot(relative, yAxis), dot(relative, xAxis));
      return angle < 0 ? angle + (2 * Math.PI) : angle;
    };
    const throughAngle = angleOf(segment.through);
    let endAngle = angleOf(segment.end);
    if (throughAngle > endAngle) endAngle += 2 * Math.PI;
    const radius = Math.hypot(...subtract(segment.start, center));
    return Array.from({ length: divisions + 1 }, (_unused, index) => {
      const angle = endAngle * (index / divisions);
      return add(center, add(scale(xAxis, radius * Math.cos(angle)), scale(yAxis, radius * Math.sin(angle))));
    });
  };
  const sampleSpline = (segment, divisions = 64) => Array.from({ length: divisions + 1 }, (_unused, index) => {
    const t = index / divisions;
    const oneMinusT = 1 - t;
    return segment.start.map((value, axis) => (
      (oneMinusT ** 3) * value
      + 3 * (oneMinusT ** 2) * t * segment.controls[0][axis]
      + 3 * oneMinusT * (t ** 2) * segment.controls[1][axis]
      + (t ** 3) * segment.end[axis]
    ));
  });
  const sampleSegment = (segment) => {
    if (segment.type === 'arc3d') return sampleArc(segment);
    if (segment.type === 'spline3d') return sampleSpline(segment);
    if (segment.type === 'bspline3d') return segment.samples?.length ? segment.samples : [segment.start, segment.end];
    return [segment.start, segment.end];
  };
  const sampledPoints = segments.flatMap((segment, index) => sampleSegment(segment).slice(index ? 1 : 0));
  return { id: `open-${featureId}`, name: 'Otwarty łańcuch', type: 'open', space: sketch.space || '2d', geometry: { segments, points: sampledPoints, holes: [] } };
}

function resolveRevolveAxis(document, feature, profile, parameters, operationName = 'Revolve') {
  const baseAxes = {
    X_AXIS: { id: 'X_AXIS', origin: [0, 0, 0], direction: [1, 0, 0] },
    Y_AXIS: { id: 'Y_AXIS', origin: [0, 0, 0], direction: [0, 1, 0] },
    Z_AXIS: { id: 'Z_AXIS', origin: [0, 0, 0], direction: [0, 0, 1] },
  };
  const axisReference = document.references.find((reference) => reference.id === feature.axisId);
  const axis = baseAxes[feature.axisId] || resolveConstructionAxis(axisReference, document.references, parameters);
  const angleValue = evaluateExpression(feature.angle, parameters);
  if (Math.abs(angleValue) <= GEOMETRY_POLICY.angularTolerance || Math.abs(angleValue) > 360) throw new Error(`Kąt ${operationName} musi należeć do zakresu -360°–360° i być różny od zera.`);
  const frame = BASE_PLANE_FRAMES[profile.plane];
  const planeOrigin = frame.origin.map((value, index) => value + frame.normal[index] * profile.planeOffset);
  const directionNormal = Math.abs(frame.normal.reduce((sum, value, index) => sum + value * axis.direction[index], 0));
  const originDistance = Math.abs(frame.normal.reduce((sum, value, index) => sum + value * (axis.origin[index] - planeOrigin[index]), 0));
  if (directionNormal > GEOMETRY_POLICY.angularTolerance || originDistance > GEOMETRY_POLICY.linearTolerance) throw new Error(`Oś ${operationName} musi leżeć w płaszczyźnie szkicu.`);
  return { axis: { origin: axis.origin, direction: axis.direction }, angleValue };
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
  const rollbackIndex = document.timelineRollbackFeatureId
    ? document.features.findIndex((feature) => feature.id === document.timelineRollbackFeatureId)
    : document.features.length - 1;
  const features = document.features.map((feature, featureIndex) => {
    if (featureIndex > rollbackIndex) return { ...feature, status: FEATURE_STATUS.ROLLED_BACK, diagnostics: [] };
    if (feature.suppressed) return { ...feature, status: FEATURE_STATUS.SUPPRESSED, diagnostics: [] };
    if (feature.type === 'surfacePatch') {
      const match = findProfile(document, feature.profileIds[0]);
      if (!match) throw new Error(`Nie znaleziono profilu Patch ${feature.profileIds[0]}.`);
      const profile = { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
      return { ...feature, status: 'ready', diagnostics: [], profile };
    }
    if (feature.type === 'surfaceExtrude') {
      const sourceSketch = document.sketches.find((sketch) => sketch.id === feature.sketchId);
      const profile = feature.openEntityIds?.length
        ? { ...resolveOpenChainProfile(sourceSketch, feature.openEntityIds, parameterResult.values, feature.id, 'Wyciągnięcie powierzchni'), plane: sourceSketch?.plane || 'XY', planeOffset: evaluateExpression(sourceSketch?.planeOffset || 0, parameterResult.values) }
        : (() => {
          const match = findProfile(document, feature.profileIds[0]);
          if (!match) throw new Error(`Nie znaleziono profilu powierzchni ${feature.profileIds[0]}.`);
          return { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
        })();
      const distanceValue = evaluateExpression(feature.distance, parameterResult.values);
      if (Math.abs(distanceValue) <= GEOMETRY_POLICY.linearTolerance) throw new Error('Odległość wyciągnięcia powierzchni musi być różna od zera.');
      return { ...feature, status: 'ready', diagnostics: [], profile, distanceValue };
    }
    if (feature.type === 'surfaceRevolve') {
      const sourceSketch = document.sketches.find((sketch) => sketch.id === feature.sketchId);
      const profile = feature.openEntityIds?.length
        ? { ...resolveOpenChainProfile(sourceSketch, feature.openEntityIds, parameterResult.values, feature.id, 'Obrót powierzchni'), plane: sourceSketch?.plane || 'XY', planeOffset: evaluateExpression(sourceSketch?.planeOffset || 0, parameterResult.values) }
        : (() => {
          const match = findProfile(document, feature.profileIds[0]);
          if (!match) throw new Error(`Nie znaleziono profilu obrotu powierzchni ${feature.profileIds[0]}.`);
          return { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
        })();
      const { axis, angleValue } = resolveRevolveAxis(document, feature, profile, parameterResult.values, 'obrotu powierzchni');
      return { ...feature, status: 'ready', diagnostics: [], profile, axis, angleValue };
    }
    if (feature.type === 'surfaceSweep') {
      const sourceSketch = document.sketches.find((sketch) => sketch.id === feature.sketchId);
      const pathSketch = document.sketches.find((sketch) => sketch.id === feature.pathSketchId);
      const profile = feature.openEntityIds?.length
        ? { ...resolveOpenChainProfile(sourceSketch, feature.openEntityIds, parameterResult.values, feature.id, 'Surface Sweep'), plane: sourceSketch?.plane || 'XY', planeOffset: evaluateExpression(sourceSketch?.planeOffset || 0, parameterResult.values) }
        : (() => {
          const match = findProfile(document, feature.profileIds[0]);
          if (!match) throw new Error(`Nie znaleziono profilu Surface Sweep ${feature.profileIds[0]}.`);
          return { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
        })();
      const path = { ...resolveOpenChainProfile(pathSketch, feature.pathEntityIds, parameterResult.values, feature.id, 'Surface Sweep'), plane: pathSketch?.plane || 'XY', planeOffset: evaluateExpression(pathSketch?.planeOffset || 0, parameterResult.values) };
      return { ...feature, status: 'ready', diagnostics: [], profile, path };
    }
    if (feature.type === 'surfaceLoft') {
      const profiles = feature.profileIds.map((profileId) => {
        const match = findProfile(document, profileId);
        if (!match) throw new Error(`Nie znaleziono profilu Surface Loft ${profileId}.`);
        return { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
      });
      if (new Set(profiles.map((profile) => profile.plane)).size !== 1) throw new Error('Profile Surface Loft muszą leżeć na równoległych płaszczyznach szkicu.');
      if (Math.abs(Number(profiles[0].planeOffset || 0) - Number(profiles[1].planeOffset || 0)) <= GEOMETRY_POLICY.linearTolerance) throw new Error('Profile Surface Loft muszą leżeć na różnych płaszczyznach.');
      const holeCounts = new Set(profiles.map((profile) => profile.geometry.holes?.length || 0));
      if (holeCounts.size !== 1) throw new Error('Profile Surface Loft muszą mieć tę samą liczbę otworów.');
      return { ...feature, status: 'ready', diagnostics: [], profiles, loftMode: feature.loftMode || 'smooth' };
    }
    if (feature.type === 'surfaceOffset') return { ...feature, status: 'ready', diagnostics: [], distanceValue: evaluateExpression(feature.distance, parameterResult.values) };
    if (feature.type === 'surfaceStitch') return { ...feature, status: 'ready', diagnostics: [], toleranceValue: positive(evaluateExpression(feature.tolerance, parameterResult.values), 'Tolerancja Stitch') };
    if (feature.type === 'surfaceTrim') return { ...feature, status: 'ready', diagnostics: [], keepTool: feature.keepTool !== false };
    if (feature.type === 'surfaceExtend') return { ...feature, status: 'ready', diagnostics: [], distanceValue: positive(evaluateExpression(feature.distance, parameterResult.values), 'Odległość Surface Extend'), topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean) };
    if (feature.type === 'thickenSurface') {
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        thicknessValue: positive(evaluateExpression(feature.thickness, parameterResult.values), 'Grubość powierzchni'),
        side: feature.side || 'one-side',
        reverse: Boolean(feature.reverse),
      };
    }
    if (feature.type === 'sheetBase') {
      const match = findProfile(document, feature.profileIds[0]);
      if (!match) throw new Error(`Nie znaleziono profilu bazy blachowej ${feature.profileIds[0]}.`);
      const profile = { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
      const thicknessValue = positive(evaluateExpression(feature.thickness, parameterResult.values), 'Grubość blachy');
      const bendRadiusValue = positive(evaluateExpression(feature.bendRadius, parameterResult.values), 'Promień gięcia');
      const kFactorValue = evaluateExpression(feature.kFactor, parameterResult.values);
      if (!Number.isFinite(kFactorValue) || kFactorValue < 0 || kFactorValue > 1) throw new Error('Współczynnik K musi należeć do zakresu 0–1.');
      return { ...feature, status: 'ready', diagnostics: [], profile, thicknessValue, bendRadiusValue, kFactorValue, side: feature.side || 'one-side', reverse: Boolean(feature.reverse) };
    }
    if (feature.type === 'sheetFlange') {
      const lengthValue = positive(evaluateExpression(feature.length, parameterResult.values), 'Długość kołnierza');
      const angleValue = evaluateExpression(feature.angle, parameterResult.values);
      const bendRadiusValue = positive(evaluateExpression(feature.bendRadius, parameterResult.values), 'Promień gięcia');
      if (!Number.isFinite(angleValue) || angleValue <= 0 || angleValue >= 180) throw new Error('Kąt kołnierza musi należeć do zakresu 0–180° bez wartości granicznych.');
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        lengthValue,
        angleValue,
        bendRadiusValue,
        reverse: Boolean(feature.reverse),
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
      };
    }
    if (feature.type === 'sheetHem') {
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        lengthValue: positive(evaluateExpression(feature.length, parameterResult.values), 'Długość zawinięcia'),
        gapValue: positive(evaluateExpression(feature.gap, parameterResult.values), 'Szczelina zawinięcia'),
        reverse: Boolean(feature.reverse),
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
      };
    }
    if (feature.type === 'sheetRip') {
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        gapValue: positive(evaluateExpression(feature.gap, parameterResult.values), 'Szerokość szczeliny'),
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
      };
    }
    if (feature.type === 'sheetUnfold' || feature.type === 'sheetRefold') {
      return { ...feature, status: 'ready', diagnostics: [] };
    }
    if (feature.type === 'plasticBoss') {
      const outerDiameterValue = positive(evaluateExpression(feature.outerDiameter, parameterResult.values), 'Średnica zewnętrzna Boss');
      const holeDiameterValue = evaluateExpression(feature.holeDiameter, parameterResult.values);
      if (!Number.isFinite(holeDiameterValue) || holeDiameterValue < 0) throw new Error('Średnica otworu Boss nie może być ujemna.');
      if (holeDiameterValue >= outerDiameterValue) throw new Error('Otwór Boss musi być mniejszy od średnicy zewnętrznej.');
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        outerDiameterValue,
        holeDiameterValue,
        heightValue: positive(evaluateExpression(feature.height, parameterResult.values), 'Wysokość Boss'),
        holeDepthValue: positive(evaluateExpression(feature.holeDepth, parameterResult.values), 'Głębokość otworu Boss'),
        offsetXValue: evaluateExpression(feature.offsetX, parameterResult.values),
        offsetYValue: evaluateExpression(feature.offsetY, parameterResult.values),
        reverse: Boolean(feature.reverse),
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
      };
    }
    if (feature.type === 'plasticSnapFit') {
      const lengthValue = positive(evaluateExpression(feature.length, parameterResult.values), 'Długość ramienia Snap-fit');
      const hookLengthValue = positive(evaluateExpression(feature.hookLength, parameterResult.values), 'Długość zaczepu Snap-fit');
      const clearanceValue = evaluateExpression(feature.clearance, parameterResult.values);
      if (!Number.isFinite(clearanceValue) || clearanceValue < 0) throw new Error('Prześwit pod ramieniem Snap-fit nie może być ujemny.');
      if (hookLengthValue >= lengthValue) throw new Error('Zaczep Snap-fit musi być krótszy od ramienia.');
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        lengthValue,
        widthValue: positive(evaluateExpression(feature.width, parameterResult.values), 'Szerokość Snap-fit'),
        thicknessValue: positive(evaluateExpression(feature.thickness, parameterResult.values), 'Grubość ramienia Snap-fit'),
        clearanceValue,
        hookLengthValue,
        hookHeightValue: positive(evaluateExpression(feature.hookHeight, parameterResult.values), 'Wysokość zaczepu Snap-fit'),
        offsetXValue: evaluateExpression(feature.offsetX, parameterResult.values),
        offsetYValue: evaluateExpression(feature.offsetY, parameterResult.values),
        reverse: Boolean(feature.reverse),
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
      };
    }
    if (feature.type === 'plasticGrille') {
      const ribCountValue = evaluateExpression(feature.ribCount, parameterResult.values);
      if (!Number.isInteger(ribCountValue) || ribCountValue < 2 || ribCountValue > 100) throw new Error('Liczba żeber Grille musi być liczbą całkowitą od 2 do 100.');
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        ribCountValue,
        ribWidthValue: positive(evaluateExpression(feature.ribWidth, parameterResult.values), 'Szerokość żebra Grille'),
        gapValue: positive(evaluateExpression(feature.gap, parameterResult.values), 'Prześwit Grille'),
        lengthValue: positive(evaluateExpression(feature.length, parameterResult.values), 'Długość szczelin Grille'),
        depthValue: positive(evaluateExpression(feature.depth, parameterResult.values), 'Głębokość Grille'),
        offsetXValue: evaluateExpression(feature.offsetX, parameterResult.values),
        offsetYValue: evaluateExpression(feature.offsetY, parameterResult.values),
        reverse: Boolean(feature.reverse),
        topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
      };
    }
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
      const { axis, angleValue } = resolveRevolveAxis(document, feature, profile, parameterResult.values);
      return { ...feature, status: 'ready', diagnostics: [], profile, axis, angleValue };
    }
    if (feature.type === 'sweep') {
      const match = findProfile(document, feature.profileIds[0]);
      const pathSketch = document.sketches.find((sketch) => sketch.id === feature.pathSketchId);
      if (!match || !pathSketch) throw new Error('Nie znaleziono profilu albo ścieżki Sweep.');
      const profile = { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
      const path = { ...resolveOpenChainProfile(pathSketch, feature.pathEntityIds, parameterResult.values, feature.id, 'Sweep'), plane: pathSketch.plane || 'XY', planeOffset: evaluateExpression(pathSketch.planeOffset || 0, parameterResult.values) };
      return { ...feature, status: 'ready', diagnostics: [], profile, path };
    }
    if (feature.type === 'loft') {
      const profiles = feature.profileIds.map((profileId) => {
        const match = findProfile(document, profileId);
        if (!match) throw new Error(`Nie znaleziono profilu Loft ${profileId}.`);
        return { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
      });
      if (new Set(profiles.map((profile) => profile.plane)).size !== 1) throw new Error('Profile Loft muszą leżeć na równoległych płaszczyznach szkicu.');
      const offsets = profiles.map((profile) => Number(profile.planeOffset || 0));
      if (offsets.some((offset, index) => offsets.some((other, otherIndex) => otherIndex > index && Math.abs(offset - other) <= GEOMETRY_POLICY.linearTolerance))) throw new Error('Profile Loft muszą leżeć na różnych płaszczyznach.');
      profiles.sort((left, right) => Number(left.planeOffset || 0) - Number(right.planeOffset || 0));
      const holeCounts = new Set(profiles.map((profile) => profile.geometry.holes?.length || 0));
      if (holeCounts.size !== 1) throw new Error('Wszystkie profile Loft muszą mieć tę samą liczbę otworów.');
      return { ...feature, status: 'ready', diagnostics: [], profiles, loftMode: feature.loftMode || 'smooth' };
    }
    if (feature.type === 'rib') {
      const sourceSketch = document.sketches.find((sketch) => sketch.id === feature.sketchId);
      const profile = { ...resolveOpenChainProfile(sourceSketch, feature.openEntityIds, parameterResult.values, feature.id, 'Rib/Web'), plane: sourceSketch?.plane || 'XY', planeOffset: evaluateExpression(sourceSketch?.planeOffset || 0, parameterResult.values) };
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        profile,
        ribMode: feature.ribMode || 'web',
        thicknessValue: positive(evaluateExpression(feature.thickness, parameterResult.values), 'Grubość Rib/Web'),
        depthValue: positive(evaluateExpression(feature.depth, parameterResult.values), 'Zasięg Rib/Web'),
      };
    }
    if (feature.type === 'coil') {
      const baseAxes = {
        X_AXIS: { id: 'X_AXIS', origin: [0, 0, 0], direction: [1, 0, 0] },
        Y_AXIS: { id: 'Y_AXIS', origin: [0, 0, 0], direction: [0, 1, 0] },
        Z_AXIS: { id: 'Z_AXIS', origin: [0, 0, 0], direction: [0, 0, 1] },
      };
      const axisReference = document.references.find((reference) => reference.id === feature.axisId);
      const axis = baseAxes[feature.axisId] || resolveConstructionAxis(axisReference, document.references, parameterResult.values);
      const coilDiameterValue = positive(evaluateExpression(feature.coilDiameter, parameterResult.values), 'Średnica Coil');
      const wireDiameterValue = positive(evaluateExpression(feature.wireDiameter, parameterResult.values), 'Średnica przekroju Coil');
      const pitchValue = positive(evaluateExpression(feature.pitch, parameterResult.values), 'Skok Coil');
      const turnsValue = evaluateExpression(feature.turns, parameterResult.values);
      if (!Number.isFinite(turnsValue) || turnsValue <= 0 || turnsValue > 200) throw new Error('Liczba zwojów Coil musi należeć do zakresu 0–200.');
      if (wireDiameterValue >= coilDiameterValue) throw new Error('Średnica przekroju Coil musi być mniejsza od średnicy Coil.');
      if (pitchValue + GEOMETRY_POLICY.linearTolerance < wireDiameterValue) throw new Error('Skok Coil nie może być mniejszy od średnicy przekroju.');
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        axis: { origin: axis.origin, direction: axis.direction },
        coilDiameterValue,
        wireDiameterValue,
        pitchValue,
        turnsValue,
        heightValue: pitchValue * turnsValue,
        handedness: feature.handedness || 'right',
      };
    }
    if (feature.type === 'pipe') {
      const pathSketch = document.sketches.find((sketch) => sketch.id === feature.pathSketchId);
      const path = { ...resolveOpenChainProfile(pathSketch, feature.pathEntityIds, parameterResult.values, feature.id, 'Pipe'), plane: pathSketch?.plane || 'XY', planeOffset: evaluateExpression(pathSketch?.planeOffset || 0, parameterResult.values) };
      const outsideDiameterValue = positive(evaluateExpression(feature.outsideDiameter, parameterResult.values), 'Średnica zewnętrzna Pipe');
      const wallThicknessValue = positive(evaluateExpression(feature.wallThickness, parameterResult.values), 'Grubość ścianki Pipe');
      if ((2 * wallThicknessValue) >= outsideDiameterValue) throw new Error('Podwójna grubość ścianki Pipe musi być mniejsza od średnicy zewnętrznej.');
      return { ...feature, status: 'ready', diagnostics: [], path, outsideDiameterValue, wallThicknessValue, insideDiameterValue: outsideDiameterValue - (2 * wallThicknessValue) };
    }
    if (feature.type === 'pattern') {
      const integer = (expression, label) => {
        const value = evaluateExpression(expression, parameterResult.values);
        if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error(`${label} musi być liczbą całkowitą 1–100.`);
        return value;
      };
      if (feature.patternType === 'rectangular') return { ...feature, status: 'ready', diagnostics: [], countXValue: integer(feature.countX, 'Kolumny Pattern'), countYValue: integer(feature.countY, 'Wiersze Pattern'), spacingXValue: evaluateExpression(feature.spacingX, parameterResult.values), spacingYValue: evaluateExpression(feature.spacingY, parameterResult.values) };
      if (feature.patternType === 'circular') {
        const baseAxes = { X_AXIS: { origin: [0, 0, 0], direction: [1, 0, 0] }, Y_AXIS: { origin: [0, 0, 0], direction: [0, 1, 0] }, Z_AXIS: { origin: [0, 0, 0], direction: [0, 0, 1] } };
        const axisReference = document.references.find((reference) => reference.id === feature.axisId);
        const axis = baseAxes[feature.axisId] || resolveConstructionAxis(axisReference, document.references, parameterResult.values);
        const totalAngleValue = evaluateExpression(feature.totalAngle, parameterResult.values);
        if (!Number.isFinite(totalAngleValue) || Math.abs(totalAngleValue) <= GEOMETRY_POLICY.angularTolerance || Math.abs(totalAngleValue) > 360) throw new Error('Kąt Pattern musi należeć do zakresu -360°–360°.');
        return { ...feature, status: 'ready', diagnostics: [], occurrencesValue: integer(feature.occurrences, 'Wystąpienia Pattern'), totalAngleValue, axis: { origin: axis.origin, direction: axis.direction } };
      }
      const pathSketch = document.sketches.find((sketch) => sketch.id === feature.pathSketchId);
      const path = { ...resolveOpenChainProfile(pathSketch, feature.pathEntityIds, parameterResult.values, feature.id, 'Pattern'), plane: pathSketch?.plane || 'XY', planeOffset: evaluateExpression(pathSketch?.planeOffset || 0, parameterResult.values) };
      return { ...feature, status: 'ready', diagnostics: [], occurrencesValue: integer(feature.occurrences, 'Wystąpienia Pattern'), path };
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
      const threadTaperValue = threadMode !== 'none' ? evaluateExpression(feature.threadTaper || 0, parameterResult.values) : 0;
      const hasToleranceLower = feature.diameterToleranceLower !== undefined && String(feature.diameterToleranceLower).trim() !== '';
      const hasToleranceUpper = feature.diameterToleranceUpper !== undefined && String(feature.diameterToleranceUpper).trim() !== '';
      const diameterToleranceLowerValue = hasToleranceLower ? evaluateExpression(feature.diameterToleranceLower, parameterResult.values) : null;
      const diameterToleranceUpperValue = hasToleranceUpper ? evaluateExpression(feature.diameterToleranceUpper, parameterResult.values) : null;
      const clearanceProfile = feature.clearanceProfile || 'nominal';
      const clearanceValue = clearanceProfile === 'fff' ? positive(evaluateExpression(feature.clearance, parameterResult.values), 'Luz promieniowy FFF') : 0;
      const effectiveDiameterValue = diameterValue + (2 * clearanceValue);
      if (counterboreDiameterValue !== null && counterboreDiameterValue <= diameterValue) throw new Error('Średnica Counterbore musi być większa od średnicy otworu.');
      if (countersinkDiameterValue !== null && countersinkDiameterValue <= diameterValue) throw new Error('Średnica Countersink musi być większa od średnicy otworu.');
      if (countersinkAngleValue !== null && (countersinkAngleValue <= 0 || countersinkAngleValue >= 180)) throw new Error('Kąt Countersink musi należeć do zakresu 0–180°.');
      if (threadDiameterValue !== null && threadDiameterValue <= effectiveDiameterValue) throw new Error('Średnica gwintu musi być większa od wykonawczej średnicy otworu bazowego.');
      if (threadTaperValue < 0 || threadTaperValue > 0.25) throw new Error('Stożek średnicy gwintu musi należeć do zakresu 0–1:4.');
      if (hasToleranceLower !== hasToleranceUpper) throw new Error('Podaj obie odchyłki średnicy albo pozostaw obie puste.');
      if (diameterToleranceLowerValue !== null && diameterToleranceLowerValue > diameterToleranceUpperValue) throw new Error('Dolna odchyłka średnicy nie może być większa od górnej.');
      if (threadMode === 'modeled' && (threadLengthValue / threadPitchValue) > 200) throw new Error('Modelowany gwint może mieć najwyżej 200 zwojów.');
      if (feature.placement === 'face-edges') {
        return {
          ...feature,
          status: 'ready',
          diagnostics: [],
          topologyReferences: (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean),
          firstOffsetValue: positive(evaluateExpression(feature.firstOffset, parameterResult.values), 'Odległość od pierwszej krawędzi'),
          secondOffsetValue: positive(evaluateExpression(feature.secondOffset, parameterResult.values), 'Odległość od drugiej krawędzi'),
          holeType, extent, diameterValue, effectiveDiameterValue, clearanceProfile, clearanceValue, depthValue, counterboreDiameterValue, counterboreDepthValue, countersinkDiameterValue, countersinkAngleValue, threadMode, threadDiameterValue, threadPitchValue, threadLengthValue, threadTaperValue, diameterToleranceLowerValue, diameterToleranceUpperValue,
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
        holeType, extent, diameterValue, effectiveDiameterValue, clearanceProfile, clearanceValue, depthValue, counterboreDiameterValue, counterboreDepthValue, countersinkDiameterValue, countersinkAngleValue, threadMode, threadDiameterValue, threadPitchValue, threadLengthValue, threadTaperValue, diameterToleranceLowerValue, diameterToleranceUpperValue,
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
    if (feature.type === 'formBody') {
      const read = (value, label, requirePositive = false) => {
        const result = evaluateExpression(value ?? 0, parameterResult.values);
        return requirePositive ? positive(result, label) : result;
      };
      const subdivisionsValue = read(feature.subdivisions, 'Poziom wygładzenia Form');
      if (!Number.isInteger(subdivisionsValue) || subdivisionsValue < 1 || subdivisionsValue > 3) throw new Error('Poziom wygładzenia Form musi być liczbą całkowitą od 1 do 3.');
      const controlOffsets = Array.from({ length: 8 }, (_unused, pointIndex) => Array.from({ length: 3 }, (_axis, axisIndex) => read(feature.controlOffsets?.[pointIndex]?.[axisIndex] ?? '0', `Przesunięcie punktu Form ${pointIndex + 1}`)));
      const insertEdgeEnabled = feature.insertEdgeEnabled === true;
      const insertEdgeIndex = Number(feature.insertEdgeIndex ?? 0);
      const insertEdgePositionValue = read(feature.insertEdgePosition ?? '0.5', 'Położenie Insert Edge');
      if (insertEdgeEnabled && (!Number.isInteger(insertEdgeIndex) || insertEdgeIndex < 0 || insertEdgeIndex > 11)) throw new Error('Insert Edge wymaga krawędzi klatki od 1 do 12.');
      if (insertEdgeEnabled && (insertEdgePositionValue <= 0.05 || insertEdgePositionValue >= 0.95)) throw new Error('Położenie Insert Edge musi być większe od 0,05 i mniejsze od 0,95.');
      const insertEdgeAxis = [1, 0, 1, 0, 0, 1, 0, 1, 2, 2, 2, 2][insertEdgeIndex];
      if (insertEdgeEnabled && { x: 0, y: 1, z: 2 }[feature.symmetry] === insertEdgeAxis && Math.abs(insertEdgePositionValue - 0.5) > 1e-9) throw new Error('Pętla biegnąca wzdłuż osi symetrii musi pozostać w położeniu 0,5.');
      const insertEdgeOffsets = Array.from({ length: insertEdgeEnabled ? 4 : 0 }, (_unused, pointIndex) => Array.from({ length: 3 }, (_axis, axisIndex) => read(feature.insertEdgeOffsets?.[pointIndex]?.[axisIndex] ?? '0', `Przesunięcie punktu Insert Edge ${pointIndex + 1}`)));
      const bridgeEnabled = feature.bridgeEnabled === true;
      const bridgeFirstFace = Number(feature.bridgeFirstFace ?? 0);
      const bridgeSecondFace = Number(feature.bridgeSecondFace ?? 1);
      const bridgeInsetValue = read(feature.bridgeInset ?? '0.45', 'Wcięcie Bridge');
      let topologyCage = createBoxControlCage(2, 2, 2);
      if (insertEdgeEnabled) topologyCage = insertFormEdgeLoop(topologyCage, FORM_CONTROL_EDGES[insertEdgeIndex], insertEdgePositionValue);
      const firstBridgePoint = topologyCage.vertices.length;
      if (bridgeEnabled) topologyCage = bridgeFormFaces(topologyCage, bridgeFirstFace, bridgeSecondFace, bridgeInsetValue);
      const bridgeOffsets = Array.from({ length: bridgeEnabled ? 8 : 0 }, (_unused, pointIndex) => Array.from({ length: 3 }, (_axis, axisIndex) => read(feature.bridgeOffsets?.[pointIndex]?.[axisIndex] ?? '0', `Przesunięcie punktu Bridge ${pointIndex + 1}`)));
      const bridge = { enabled: bridgeEnabled, firstFaceIndex: bridgeFirstFace, secondFaceIndex: bridgeSecondFace, inset: bridgeInsetValue };
      if (bridgeEnabled && feature.symmetry && feature.symmetry !== 'none') {
        const symmetryPairs = formControlSymmetryPairs({ enabled: insertEdgeEnabled, edgeIndex: insertEdgeIndex, position: insertEdgePositionValue }, feature.symmetry, bridge);
        if (symmetryPairs.slice(firstBridgePoint, firstBridgePoint + 8).some((pointIndex) => !Number.isInteger(pointIndex))) throw new Error('Przy aktywnej symetrii ściany Bridge muszą tworzyć parę symetryczną.');
      }
      const fillHoleEnabled = feature.fillHoleEnabled === true;
      const fillHoleFace = Number(feature.fillHoleFace ?? 0);
      const topologySymmetryPairs = feature.symmetry && feature.symmetry !== 'none'
        ? formControlSymmetryPairs({ enabled: insertEdgeEnabled, edgeIndex: insertEdgeIndex, position: insertEdgePositionValue }, feature.symmetry, bridge)
        : null;
      const fillHoleFaceIndexes = fillHoleEnabled ? symmetricFormFaceIndexes(topologyCage, topologySymmetryPairs, fillHoleFace) : [];
      const fillHoleOffsets = Array.from({ length: fillHoleFaceIndexes.length }, (_unused, pointIndex) => Array.from({ length: 3 }, (_axis, axisIndex) => read(feature.fillHoleOffsets?.[pointIndex]?.[axisIndex] ?? '0', `Przesunięcie punktu Fill Hole ${pointIndex + 1}`)));
      if (fillHoleEnabled) fillFormHoles(topologyCage, fillHoleFaceIndexes, fillHoleOffsets);
      const fillHole = { enabled: fillHoleEnabled, faceIndex: fillHoleFace, faceIndexes: fillHoleFaceIndexes };
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        widthValue: read(feature.width, 'Szerokość Form', true),
        depthValue: read(feature.depth, 'Głębokość Form', true),
        heightValue: read(feature.height, 'Wysokość Form', true),
        subdivisionsValue,
        controlOffsets,
        insertEdge: { enabled: insertEdgeEnabled, edgeIndex: insertEdgeIndex, position: insertEdgePositionValue },
        insertEdgeOffsets,
        bridge,
        bridgeOffsets,
        fillHole,
        fillHoleOffsets,
        position: [read(feature.x, 'Położenie X'), read(feature.y, 'Położenie Y'), read(feature.z, 'Położenie Z')],
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
      const faceReference = feature.placement === 'face' ? document.references.find((reference) => reference.id === feature.referenceIds?.[0]) : null;
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        fontSizeValue,
        depthValue: read(feature.depth, 'Głębokość tekstu', true),
        position: [x, y, read(feature.z, 'Położenie Z')],
        profile: createTextProfile(feature.text, fontSizeValue, x, y),
        topologyReferences: faceReference ? [faceReference] : [],
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
