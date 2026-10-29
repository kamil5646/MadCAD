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
  pattern: 'Szyk',
  mirror: 'Lustro',
});

// Features whose tool Pattern and Mirror can repeat.
export const REPEATABLE_TYPES = Object.freeze(['extrude', 'revolve', 'hole']);

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

const NUMERIC_FIELDS = Object.freeze({
  extrude: [['distance', 'Odległość']],
  revolve: [['angle', 'Kąt']],
  fillet: [['size', 'Promień']],
  chamfer: [['size', 'Odległość']],
  shell: [['thickness', 'Grubość']],
  hole: [['diameter', 'Średnica'], ['depth', 'Głębokość']],
  pattern: [['countX', 'Ilość', true], ['spacingX', 'Odstęp'], ['countY', 'Rzędy', true], ['spacingY', 'Odstęp rzędów'], ['occurrences', 'Ilość', true], ['totalAngle', 'Kąt']],
});

const SKIPPED_FIELDS = (command) => new Set([
  ...(command.type === 'extrude' && command.extent === 'through-all' ? ['distance'] : []),
  ...(command.type === 'hole' && command.extent === 'through-all' ? ['depth'] : []),
  ...(command.type === 'pattern' && command.patternType === 'circular' ? ['countX', 'spacingX', 'countY', 'spacingY'] : []),
  ...(command.type === 'pattern' && command.patternType !== 'circular' ? ['occurrences', 'totalAngle'] : []),
  ...(command.type === 'pattern' && command.patternType !== 'circular' && String(command.countY).trim() === '1' ? ['spacingY'] : []),
]);

// Returns a readable problem with the form values, or '' when the preview can run.
export function commandProblem(command, parameters) {
  const resolved = resolveParameters(parameters);
  const skipped = SKIPPED_FIELDS(command);
  for (const [key, label, integer] of NUMERIC_FIELDS[command.type] || []) {
    if (skipped.has(key)) continue;
    let value;
    try {
      value = evaluateExpression(command[key], resolved.values);
    } catch {
      return `${label}: wpisz liczbę.`;
    }
    if (integer && (!Number.isInteger(value) || value < 1 || value > 100)) return `${label}: liczba całkowita 1–100.`;
    if (!integer && key !== 'totalAngle' && (!Number.isFinite(value) || value <= 0)) return `${label} musi być większa od zera.`;
    if (key === 'totalAngle' && (!Number.isFinite(value) || value === 0 || Math.abs(value) > 360)) return 'Kąt: od -360° do 360°, różny od zera.';
  }
  if (command.type === 'hole' && !command.pointIds?.length) return 'Brak punktów otworów w szkicu.';
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
  } else if (command.type === 'hole') {
    const diameter = String(command.diameter);
    feature = createFeature('hole', {
      name,
      sketchId: command.sketchId,
      pointIds: command.pointIds,
      targetBodyId: command.targetBodyId,
      holeType: command.holeType,
      extent: command.extent,
      diameter,
      depth: command.depth,
      counterboreDiameter: `(${diameter}) * 1.8`,
      counterboreDepth: `(${diameter}) * 0.6`,
      countersinkDiameter: `(${diameter}) * 2`,
      countersinkAngle: '90',
      threadMode: 'none',
      clearanceProfile: 'nominal',
      intoMaterial: true,
    });
  } else if (command.type === 'pattern') {
    feature = createFeature('pattern', {
      name,
      targetBodyId: command.targetBodyId,
      sourceFeatureIds: command.sourceId === 'body' ? [] : [command.sourceId],
      patternType: command.patternType,
      plane: command.plane,
      countX: command.countX,
      spacingX: command.spacingX,
      countY: command.countY,
      spacingY: String(command.countY).trim() === '1' ? '0' : command.spacingY,
      occurrences: command.occurrences,
      totalAngle: command.totalAngle,
      axisId: command.axisId,
    });
  } else if (command.type === 'mirror') {
    feature = createFeature('mirror', {
      name,
      targetBodyId: command.targetBodyId,
      sourceFeatureIds: command.sourceId === 'body' ? [] : [command.sourceId],
      plane: command.plane,
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
  if (feature.type === 'hole' && feature.pointIds?.length) {
    return { ...base, type: 'hole', sketchId: feature.sketchId, pointIds: [...feature.pointIds], targetBodyId: feature.targetBodyId, holeType: feature.holeType || 'simple', extent: feature.extent || 'through-all', diameter: String(feature.diameter), depth: String(feature.depth ?? '10') };
  }
  if (feature.type === 'pattern' && ['rectangular', 'circular'].includes(feature.patternType)) {
    return {
      ...base, type: 'pattern', targetBodyId: feature.targetBodyId, sourceId: feature.sourceFeatureIds?.[0] || 'body', patternType: feature.patternType,
      plane: feature.plane || 'XY', countX: String(feature.countX ?? '3'), spacingX: String(feature.spacingX ?? '20'), countY: String(feature.countY ?? '1'), spacingY: String(feature.spacingY ?? '20'),
      occurrences: String(feature.occurrences ?? '6'), totalAngle: String(feature.totalAngle ?? '360'), axisId: feature.axisId || 'Z_AXIS',
    };
  }
  if (feature.type === 'mirror') {
    return { ...base, type: 'mirror', targetBodyId: feature.targetBodyId, sourceId: feature.sourceFeatureIds?.[0] || 'body', plane: feature.plane || 'YZ' };
  }
  return null;
}
