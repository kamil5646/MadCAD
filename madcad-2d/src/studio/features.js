// Builds the timeline features behind the solid commands. A command keeps its form
// values as strings; buildFeature turns them into the stored feature for preview and OK.
import { createFeature, FEATURE_TYPE_NAMES } from '../cad-core/document.js';
import { evaluateExpression, resolveParameters } from '../cad-core/expressions.js';

export const FEATURE_LABELS = Object.freeze({
  extrude: 'Wyciągnięcie',
  revolve: 'Obrót',
  fillet: 'Zaokrąglenie',
  chamfer: 'Fazowanie',
  shell: 'Skorupa',
  hole: 'Otwór',
});

export const OPERATIONS = Object.freeze([
  { id: 'join', label: 'Dołącz' },
  { id: 'cut', label: 'Wytnij' },
  { id: 'new', label: 'Nowa bryła' },
]);

export function featureLabel(feature) {
  return FEATURE_LABELS[feature.type] || FEATURE_TYPE_NAMES[feature.type] || 'Operacja';
}

export function nextFeatureName(features, base) {
  const used = new Set(features.map((feature) => feature.name));
  let index = 1;
  while (used.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

export function revolveAxes(plane) {
  if (plane === 'XZ') return [{ id: 'X_AXIS', label: 'Oś X' }, { id: 'Z_AXIS', label: 'Oś Z' }];
  if (plane === 'YZ') return [{ id: 'Y_AXIS', label: 'Oś Y' }, { id: 'Z_AXIS', label: 'Oś Z' }];
  return [{ id: 'Y_AXIS', label: 'Oś Y' }, { id: 'X_AXIS', label: 'Oś X' }];
}

const NUMERIC_FIELDS = Object.freeze({ extrude: [['distance', 'Odległość']], revolve: [['angle', 'Kąt']], fillet: [['size', 'Promień']], chamfer: [['size', 'Odległość']], shell: [['thickness', 'Grubość']] });

// Returns a readable problem with the form values, or '' when the preview can run.
export function commandProblem(command, parameters) {
  const resolved = resolveParameters(parameters);
  for (const [key, label] of NUMERIC_FIELDS[command.type] || []) {
    if (command.type === 'extrude' && key === 'distance' && command.extent === 'through-all') continue;
    let value;
    try {
      value = evaluateExpression(command[key], resolved.values);
    } catch {
      return `${label}: wpisz liczbę.`;
    }
    if (!Number.isFinite(value) || value <= 0) return `${label} musi być większa od zera.`;
  }
  return '';
}

export function buildFeature(command, { features, firstBodyId }) {
  const name = command.name || nextFeatureName(features, FEATURE_LABELS[command.type]);
  const targetBodyId = command.operation === 'new' ? null : (command.targetBodyId || firstBodyId);
  let feature;
  if (command.type === 'extrude') {
    const through = command.extent === 'through-all';
    feature = createFeature('extrude', {
      name,
      sketchId: command.sketchId,
      profileIds: command.profileIds,
      distance: command.flip && !through ? `-(${command.distance})` : command.distance,
      secondDistance: command.distance,
      startOffset: '0',
      extent: command.extent,
      operation: command.operation,
      targetBodyId,
    });
  } else if (command.type === 'revolve') {
    feature = createFeature('revolve', {
      name,
      sketchId: command.sketchId,
      profileIds: command.profileIds,
      axisId: command.axisId,
      angle: command.angle,
      operation: command.operation,
      targetBodyId,
    });
  } else if (command.type === 'fillet' || command.type === 'chamfer') {
    feature = createFeature(command.type, {
      name,
      targetBodyId: command.targetBodyId,
      referenceIds: command.references.map((reference) => reference.id),
      ...(command.type === 'fillet' ? { radius: command.size } : { distance: command.size }),
    });
  } else if (command.type === 'shell') {
    feature = createFeature('shell', {
      name,
      targetBodyId: command.targetBodyId,
      referenceIds: command.references.map((reference) => reference.id),
      thickness: command.thickness,
    });
  } else return null;
  if (command.featureId) feature.id = command.featureId;
  return feature;
}

// Reopens a stored feature as an editable command.
export function commandFromFeature(feature, document) {
  const references = (feature.referenceIds || []).map((id) => document.references.find((reference) => reference.id === id)).filter(Boolean);
  const base = { editId: feature.id, featureId: feature.id, name: feature.name };
  if (feature.type === 'extrude' && !feature.openEntityIds?.length) {
    const distance = String(feature.distance ?? '10');
    const flip = /^-\((.*)\)$/.exec(distance);
    return {
      ...base, type: 'extrude', sketchId: feature.sketchId, profileIds: [...feature.profileIds],
      distance: flip ? flip[1] : distance.replace(/^-/, ''), flip: Boolean(flip) || distance.startsWith('-'),
      extent: ['one-side', 'symmetric', 'through-all'].includes(feature.extent) ? feature.extent : 'one-side',
      operation: feature.operation || 'join', targetBodyId: feature.targetBodyId,
    };
  }
  if (feature.type === 'revolve') {
    return { ...base, type: 'revolve', sketchId: feature.sketchId, profileIds: [...feature.profileIds], axisId: feature.axisId, angle: String(feature.angle ?? '360'), operation: feature.operation || 'join', targetBodyId: feature.targetBodyId };
  }
  if (feature.type === 'fillet' || feature.type === 'chamfer') {
    return { ...base, type: feature.type, targetBodyId: feature.targetBodyId, references, size: String(feature.type === 'fillet' ? feature.radius : feature.distance) };
  }
  if (feature.type === 'shell') {
    return { ...base, type: 'shell', targetBodyId: feature.targetBodyId, references, thickness: String(feature.thickness ?? '2') };
  }
  return null;
}
