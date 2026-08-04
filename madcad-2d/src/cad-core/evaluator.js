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
  const segments = profile.entityIds.map((entityId) => {
    const entity = entityMap.get(entityId);
    if (entity?.type === 'line') {
      const start = readPoint(entity.pointIds[0]);
      const end = readPoint(entity.pointIds[1]);
      positive(Math.hypot(end[0] - start[0], end[1] - start[1]), 'Długość linii');
      return { type: 'line', id: entity.id, start, end };
    }
    if (entity?.type === 'arc') {
      const center = readPoint(entity.pointIds[0]);
      const start = readPoint(entity.pointIds[1]);
      const end = readPoint(entity.pointIds[2]);
      positive(Math.hypot(start[0] - center[0], start[1] - center[1]), 'Promień łuku');
      return { type: 'arc', id: entity.id, center, start, end, direction: entity.geometry.direction };
    }
    throw new Error(`Nieobsługiwana encja ${entityId} w profilu ${profile.id}.`);
  });
  const points = segments.map((segment) => segment.start);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    ...profile,
    geometry: {
      points,
      segments,
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
      const profiles = feature.profileIds.map((profileId) => {
        const match = findProfile(document, profileId);
        if (!match) throw new Error(`Nie znaleziono profilu ${profileId}.`);
        return { ...resolveProfile(match.profile, parameterResult.values, match.sketch), plane: match.sketch.plane || 'XY' };
      });
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        distanceValue: positive(evaluateExpression(feature.distance, parameterResult.values), 'Odległość wyciągnięcia'),
        profiles,
      };
    }
    if (feature.type === 'hole') {
      const match = findProfile(document, feature.profileId);
      if (!match) throw new Error(`Nie znaleziono profilu otworu ${feature.profileId}.`);
      const profile = resolveProfile(match.profile, parameterResult.values, match.sketch);
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        profile: { ...profile, plane: match.sketch.plane || 'XY' },
        diameterValue: positive(evaluateExpression(feature.diameter, parameterResult.values), 'Średnica otworu'),
        depthValue: positive(evaluateExpression(feature.depth, parameterResult.values), 'Głębokość otworu'),
      };
    }
    if (feature.type === 'fillet' || feature.type === 'chamfer') {
      const valueKey = feature.type === 'fillet' ? 'radius' : 'distance';
      return {
        ...feature,
        status: 'ready',
        diagnostics: [],
        sizeValue: positive(evaluateExpression(feature[valueKey], parameterResult.values), feature.type === 'fillet' ? 'Promień' : 'Odległość fazy'),
      };
    }
    throw new Error(`Nieobsługiwana operacja: ${feature.type}`);
  });

  return { parameters: parameterResult.values, features, dependencyGraph };
}
