import { createId } from './ids.js';

export const DOCUMENT_SCHEMA_VERSION = 2;

export function createParameter(name, expression, unit = 'mm', label = name) {
  return { id: createId('param'), name, label, expression: String(expression), unit };
}

export function createRectangleProfile({ name = 'Prostokąt', width = 'szerokosc', height = 'glebokosc', x = 0, y = 0 } = {}) {
  return {
    id: createId('profile'),
    name,
    type: 'rectangle',
    construction: false,
    geometry: { width: String(width), height: String(height), x: String(x), y: String(y) }
  };
}

export function createCircleProfile({ name = 'Okrąg', diameter = 'srednicaOtworu', x = 0, y = 0 } = {}) {
  return {
    id: createId('profile'),
    name,
    type: 'circle',
    construction: false,
    geometry: { diameter: String(diameter), x: String(x), y: String(y) }
  };
}

export function createSketch({ name = 'Szkic', plane = 'XY', profiles = [] } = {}) {
  return { id: createId('sketch'), name, type: 'sketch', plane, visible: true, profiles };
}

export function createFeature(type, options = {}) {
  const names = { extrude: 'Wyciągnięcie', hole: 'Otwór', fillet: 'Zaokrąglenie', chamfer: 'Fazowanie' };
  return {
    id: createId('feature'),
    name: options.name || names[type] || 'Operacja',
    type,
    suppressed: false,
    ...options,
  };
}

export function createDocument(name = 'Nowy projekt') {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: createId('document'),
    name,
    units: 'mm',
    parameters: [],
    sketches: [],
    features: [],
    print: { bedWidth: 220, bedDepth: 220, bedHeight: 250, material: 'PLA' },
    metadata: { createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() }
  };
}

export function createStarterDocument() {
  const document = createDocument('Uchwyt testowy');
  document.parameters = [
    createParameter('szerokosc', 60, 'mm', 'Szerokość'),
    createParameter('glebokosc', 40, 'mm', 'Głębokość'),
    createParameter('wysokosc', 8, 'mm', 'Wysokość'),
    createParameter('srednicaOtworu', 8, 'mm', 'Średnica otworu'),
  ];
  const rectangle = createRectangleProfile();
  const circle = createCircleProfile();
  const sketch = createSketch({ name: 'Szkic podstawy', profiles: [rectangle, circle] });
  const base = createFeature('extrude', {
    name: 'Podstawa',
    sketchId: sketch.id,
    profileIds: [rectangle.id],
    distance: 'wysokosc',
    operation: 'new',
  });
  const hole = createFeature('hole', {
    name: 'Otwór centralny',
    targetBodyId: `body-${base.id}`,
    sketchId: sketch.id,
    profileId: circle.id,
    diameter: 'srednicaOtworu',
    depth: 'wysokosc',
  });
  document.sketches = [sketch];
  document.features = [base, hole];
  return document;
}

export function cloneDocument(document) {
  return structuredClone(document);
}

export function touchDocument(document) {
  document.metadata.modifiedAt = new Date().toISOString();
  return document;
}

export function findProfile(document, profileId) {
  for (const sketch of document.sketches) {
    const profile = sketch.profiles.find((item) => item.id === profileId);
    if (profile) return { sketch, profile };
  }
  return null;
}

export function validateDocument(document) {
  const errors = [];
  if (!document || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) errors.push('Nieobsługiwana wersja dokumentu.');
  if (!document?.name?.trim()) errors.push('Projekt musi mieć nazwę.');
  const parameterNames = new Set();
  for (const parameter of document?.parameters || []) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(parameter.name)) errors.push(`Nieprawidłowa nazwa parametru: ${parameter.name}`);
    if (parameterNames.has(parameter.name)) errors.push(`Powtórzony parametr: ${parameter.name}`);
    parameterNames.add(parameter.name);
  }
  return { valid: errors.length === 0, errors };
}
