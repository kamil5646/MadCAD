import { evaluateExpression, resolveParameters } from './expressions.js';
import { findProfile, validateDocument } from './document.js';
import { buildDependencyGraph } from './dependency-graph.js';
import { GEOMETRY_POLICY, isPositiveLength } from './geometry-policy.js';

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
      const profiles = feature.profileIds.map((profileId) => {
        const match = findProfile(document, profileId);
        if (!match) throw new Error(`Nie znaleziono profilu ${profileId}.`);
        return { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY', planeOffset: evaluateExpression(match.sketch.planeOffset || 0, parameterResult.values) };
      });
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        extent,
        distanceValue: positive(evaluateExpression(feature.distance, parameterResult.values), 'Odległość wyciągnięcia'),
        secondDistanceValue: extent === 'two-sides'
          ? positive(evaluateExpression(feature.secondDistance ?? feature.distance, parameterResult.values), 'Odległość drugiej strony')
          : 0,
        profiles,
      };
    }
    if (feature.type === 'hole') {
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
        diameterValue: positive(evaluateExpression(feature.diameter, parameterResult.values), 'Średnica otworu'),
        depthValue: positive(evaluateExpression(feature.depth, parameterResult.values), 'Głębokość otworu'),
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
    throw new Error(`Nieobsługiwana operacja: ${feature.type}`);
  });

  return { parameters: parameterResult.values, features, dependencyGraph };
}
