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

export function resolveProfile(profile, parameters) {
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
        return { ...resolveProfile(match.profile, parameterResult.values), plane: match.sketch.plane || 'XY' };
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
      const profile = resolveProfile(match.profile, parameterResult.values);
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
