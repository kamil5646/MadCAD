import { createId } from './ids.js';
import { evaluateExpression, listExpressionIdentifiers, resolveParameters } from './expressions.js';
import { GEOMETRY_POLICY } from './geometry-policy.js';
import {
  BY_LAYER,
  LINE_WEIGHTS,
  createDefaultLayer,
  ensureDocumentLayers,
  isSupportedLineType,
} from './layers.js';
import { ensureDocumentBlocks } from './blocks.js';
import { COMPONENT_TYPES, DEFAULT_INSTANCE_TRANSFORM, ensureDocumentComponents } from './components.js';
import { JOINT_AXES, JOINT_TYPES, ensureDocumentJoints } from './assembly-joints.js';
import { ensureDocumentAssemblyMotion } from './assembly-motion.js';
import { ensureDocumentLinkedProjects } from './linked-projects.js';
import { MAX_NAMED_VIEWS, ensureDocumentNamedViews, normalizeNamedViewCamera } from './named-views.js';
import { validateHoleStandard } from './hole-standards.js';
import { DRAWING_ANNOTATION_TYPES, DRAWING_PAGE_SIZES, DRAWING_TABLE_TYPES, DRAWING_VIEW_ALIGNMENTS, DRAWING_VIEW_ORIENTATIONS, DRAWING_VIEW_TYPES, ensureDocumentDrawings } from './drawing-sheets.js';
import {
  SKETCH_ENTITY_ROLES,
  SKETCH_ENTITY_TYPES,
  SKETCH_DIMENSION_TYPES,
  boundaryPointIds,
  normalizeSketchModel,
} from './sketch-model.js';

export const DOCUMENT_SCHEMA_VERSION = 15;
export const MIN_MIGRATABLE_SCHEMA_VERSION = 2;

const SUPPORTED_PLANES = new Set(['XY', 'XZ', 'YZ']);
const FEATURE_TYPES = new Set(['extrude', 'sheetBase', 'sheetFlange', 'sheetHem', 'sheetRip', 'sheetUnfold', 'sheetRefold', 'surfacePatch', 'surfaceExtrude', 'surfaceRevolve', 'surfaceSweep', 'surfaceLoft', 'surfaceOffset', 'surfaceStitch', 'surfaceTrim', 'surfaceExtend', 'thickenSurface', 'revolve', 'sweep', 'loft', 'rib', 'coil', 'pipe', 'pattern', 'boolean', 'hole', 'fillet', 'chamfer', 'shell', 'draft', 'splitBody', 'splitFace', 'deleteFace', 'replaceFace', 'primitive', 'transform', 'offsetFace', 'textSolid', 'importedModel']);
const PROFILE_TYPES = new Set(['rectangle', 'circle', 'closed']);
const ENTITY_TYPES = new Set(SKETCH_ENTITY_TYPES);
const ENTITY_ROLES = new Set(SKETCH_ENTITY_ROLES);
const DIMENSION_TYPES = new Set(SKETCH_DIMENSION_TYPES);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readSchemaVersion(document) {
  const version = document?.schemaVersion;
  return Number.isInteger(version) && version > 0 ? version : null;
}

function ensureV3Collections(document) {
  if (document.bodies === undefined) document.bodies = [];
  if (document.components === undefined) document.components = [];
  if (document.references === undefined) document.references = [];
  if (Array.isArray(document.sketches)) {
    document.sketches = document.sketches.map((sketch) => {
      if (!isRecord(sketch)) return sketch;
      return {
        ...sketch,
        entities: sketch.entities === undefined ? [] : sketch.entities,
        constraints: sketch.constraints === undefined ? [] : sketch.constraints,
        dimensions: sketch.dimensions === undefined ? [] : sketch.dimensions,
      };
    });
  }
  return document;
}

export function ensureDocumentTimeline(document) {
  if (typeof document.timelineRollbackFeatureId !== 'string') document.timelineRollbackFeatureId = '';
  if (!Array.isArray(document.featureGroups)) document.featureGroups = [];
  document.featureGroups = document.featureGroups.map((group, index) => ({
    ...group,
    id: typeof group?.id === 'string' && group.id ? group.id : createId('feature-group'),
    name: String(group?.name || `Grupa ${index + 1}`).trim().slice(0, 80) || `Grupa ${index + 1}`,
    featureIds: [...new Set(Array.isArray(group?.featureIds) ? group.featureIds.filter((id) => typeof id === 'string' && id) : [])],
    collapsed: Boolean(group?.collapsed),
  }));
  return document;
}

function migrateV2ToV3(source, now) {
  const migrated = ensureV3Collections(cloneDocument(source));
  migrated.schemaVersion = 3;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: 2,
    migratedAt: now,
    modifiedAt: now,
  };
  return migrated;
}

function migrateV3ToV4(source, now) {
  const migrated = ensureV3Collections(cloneDocument(source));
  migrated.schemaVersion = 4;
  migrated.sketches = migrated.sketches.map(normalizeSketchModel);
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 3,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 3, to: 4, at: now },
    ],
  };
  return migrated;
}

function migrateV4ToV5(source, now) {
  const migrated = ensureDocumentDrawings(ensureV3Collections(cloneDocument(source)));
  migrated.schemaVersion = 5;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 4,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 4, to: 5, at: now },
    ],
  };
  return migrated;
}

function migrateV5ToV6(source, now) {
  const migrated = ensureDocumentDrawings(ensureV3Collections(cloneDocument(source)));
  migrated.schemaVersion = 6;
  migrated.drawings = migrated.drawings.map((sheet) => isRecord(sheet) ? {
    ...sheet,
    views: Array.isArray(sheet.views) ? sheet.views.map((view) => isRecord(view) ? { type: 'base', ...view } : view) : sheet.views,
  } : sheet);
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 5,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 5, to: 6, at: now },
    ],
  };
  return migrated;
}

function migrateV6ToV7(source, now) {
  const migrated = ensureDocumentDrawings(ensureV3Collections(cloneDocument(source)));
  migrated.schemaVersion = 7;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 6,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 6, to: 7, at: now },
    ],
  };
  return migrated;
}

function migrateV7ToV8(source, now) {
  const migrated = ensureDocumentDrawings(ensureV3Collections(cloneDocument(source)));
  migrated.schemaVersion = 8;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 7,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 7, to: 8, at: now },
    ],
  };
  return migrated;
}

function migrateV8ToV9(source, now) {
  const migrated = ensureDocumentDrawings(ensureV3Collections(cloneDocument(source)));
  migrated.schemaVersion = 9;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 8,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 8, to: 9, at: now },
    ],
  };
  return migrated;
}

function migrateV9ToV10(source, now) {
  const migrated = ensureDocumentComponents(ensureDocumentDrawings(ensureV3Collections(cloneDocument(source))));
  migrated.schemaVersion = 10;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 9,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 9, to: 10, at: now },
    ],
  };
  return migrated;
}

function migrateV10ToV11(source, now) {
  const working = ensureDocumentDrawings(ensureV3Collections(cloneDocument(source)));
  if (!Array.isArray(working.componentInstances) || (!working.componentInstances.length && working.components?.length)) delete working.componentInstances;
  const migrated = ensureDocumentComponents(working);
  migrated.schemaVersion = 11;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 10,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 10, to: 11, at: now },
    ],
  };
  return migrated;
}

function migrateV11ToV12(source, now) {
  const migrated = ensureDocumentJoints(ensureDocumentDrawings(ensureV3Collections(cloneDocument(source))));
  migrated.schemaVersion = 12;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 11,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 11, to: 12, at: now },
    ],
  };
  return migrated;
}

function migrateV12ToV13(source, now) {
  const migrated = ensureDocumentAssemblyMotion(ensureDocumentJoints(ensureDocumentDrawings(ensureV3Collections(cloneDocument(source)))));
  migrated.schemaVersion = 13;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 12,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 12, to: 13, at: now },
    ],
  };
  return migrated;
}

function migrateV13ToV14(source, now) {
  const migrated = ensureDocumentTimeline(ensureDocumentAssemblyMotion(ensureDocumentJoints(ensureDocumentDrawings(ensureV3Collections(cloneDocument(source))))));
  migrated.schemaVersion = 14;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 13,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 13, to: 14, at: now },
    ],
  };
  return migrated;
}

function migrateV14ToV15(source, now) {
  const migrated = ensureDocumentLinkedProjects(ensureDocumentTimeline(ensureDocumentAssemblyMotion(ensureDocumentJoints(ensureDocumentDrawings(ensureV3Collections(cloneDocument(source)))))));
  migrated.schemaVersion = 15;
  migrated.metadata = {
    ...(isRecord(migrated.metadata) ? migrated.metadata : {}),
    migratedFromVersion: migrated.metadata?.migratedFromVersion ?? 14,
    migratedAt: now,
    modifiedAt: now,
    migrationHistory: [
      ...(Array.isArray(migrated.metadata?.migrationHistory) ? migrated.metadata.migrationHistory : []),
      { from: 14, to: 15, at: now },
    ],
  };
  return migrated;
}

const MIGRATIONS = new Map([
  [2, migrateV2ToV3],
  [3, migrateV3ToV4],
  [4, migrateV4ToV5],
  [5, migrateV5ToV6],
  [6, migrateV6ToV7],
  [7, migrateV7ToV8],
  [8, migrateV8ToV9],
  [9, migrateV9ToV10],
  [10, migrateV10ToV11],
  [11, migrateV11ToV12],
  [12, migrateV12ToV13],
  [13, migrateV13ToV14],
  [14, migrateV14ToV15],
]);

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

export function createSketch({ name = 'Szkic', plane = 'XY', planeOffset = '0', support = null, entities = [], profiles = [], constraints = [], dimensions = [], blockInstances = [] } = {}) {
  return normalizeSketchModel({
    id: createId('sketch'),
    name,
    type: 'sketch',
    plane,
    planeOffset: String(planeOffset),
    ...(support ? { support: structuredClone(support) } : {}),
    visible: true,
    entities,
    profiles,
    constraints,
    dimensions,
    blockInstances,
  });
}

export function createFeature(type, options = {}) {
  const names = { extrude: 'Wyciągnięcie', sheetBase: 'Baza blachowa', sheetFlange: 'Kołnierz blachy', sheetHem: 'Zawinięcie blachy', sheetRip: 'Szczelina blachy', sheetUnfold: 'Rozwinięcie blachy', sheetRefold: 'Ponowne zagięcie blachy', surfacePatch: 'Patch', surfaceExtrude: 'Wyciągnięcie powierzchni', surfaceRevolve: 'Obrót powierzchni', surfaceSweep: 'Powierzchnia po ścieżce', surfaceLoft: 'Powierzchnia przejściowa', surfaceOffset: 'Odsunięcie powierzchni', surfaceStitch: 'Zszycie powierzchni', surfaceTrim: 'Przycięcie powierzchni', surfaceExtend: 'Przedłużenie powierzchni', thickenSurface: 'Pogrubienie powierzchni', revolve: 'Revolve', sweep: 'Sweep', loft: 'Loft', rib: 'Rib/Web', coil: 'Coil', pipe: 'Pipe', pattern: 'Pattern', boolean: 'Boolean', hole: 'Otwór', fillet: 'Zaokrąglenie', chamfer: 'Fazowanie', shell: 'Shell', draft: 'Draft', splitBody: 'Split Body', splitFace: 'Split Face', deleteFace: 'Delete Face + Heal', replaceFace: 'Replace Face', primitive: 'Prymityw', transform: 'Transformacja', offsetFace: 'Offset Face', textSolid: 'Tekst 3D', importedModel: 'Model importowany' };
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
    timelineRollbackFeatureId: '',
    featureGroups: [],
    linkedProjects: [],
    namedViews: [],
    bodies: [],
    components: [],
    componentInstances: [],
    rigidGroups: [],
    joints: [],
    motionLinks: [],
    contactSets: [],
    assemblyConfigurations: [],
    activeAssemblyConfigurationId: '',
    references: [],
    blocks: [],
    drawings: [],
    layers: [createDefaultLayer()],
    activeLayerId: 'layer-0',
    print: {
      profileId: 'creality-ender3', bedWidth: 220, bedDepth: 220, bedHeight: 250, material: 'PLA',
      positionX: 0, positionY: 0, positionZ: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scale: 1, copies: 1, copySpacing: 10,
      orientationAxis: [0, 0, 1], orientationAngle: 0,
      nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2, overhangAngle: 45,
      slicer: 'bambu',
    },
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
  for (const sketch of document?.sketches || []) {
    const profile = sketch.profiles.find((item) => item.id === profileId);
    if (profile) return { sketch, profile };
  }
  return null;
}

export function migrateDocument(source, { now = new Date().toISOString() } = {}) {
  if (!isRecord(source)) throw new Error('Dokument musi być obiektem JSON.');
  const sourceVersion = readSchemaVersion(source);
  if (!sourceVersion) throw new Error('Dokument nie zawiera prawidłowego numeru schemaVersion.');
  if (sourceVersion > DOCUMENT_SCHEMA_VERSION) {
    throw new Error(`Projekt używa nowszego formatu v${sourceVersion}; bieżąca wersja obsługuje v${DOCUMENT_SCHEMA_VERSION}.`);
  }
  if (sourceVersion < MIN_MIGRATABLE_SCHEMA_VERSION) {
    throw new Error(`Brak bezpiecznej ścieżki migracji formatu v${sourceVersion}.`);
  }

  let document = cloneDocument(source);
  let version = sourceVersion;
  while (version < DOCUMENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS.get(version);
    if (!migration) throw new Error(`Brak migracji formatu v${version} -> v${version + 1}.`);
    document = migration(document, now);
    version = readSchemaVersion(document);
  }
  return ensureDocumentNamedViews(ensureDocumentLinkedProjects(ensureDocumentTimeline(ensureDocumentAssemblyMotion(ensureDocumentJoints(ensureDocumentDrawings(ensureDocumentBlocks(ensureDocumentLayers(document))))))));
}

function projectFutureDocument(source) {
  const projected = ensureDocumentNamedViews(ensureDocumentLinkedProjects(ensureDocumentTimeline(ensureDocumentAssemblyMotion(ensureDocumentJoints(ensureDocumentDrawings(ensureDocumentBlocks(ensureDocumentLayers(ensureV3Collections(cloneDocument(source))))))))));
  projected.schemaVersion = DOCUMENT_SCHEMA_VERSION;
  projected.metadata = {
    ...(isRecord(projected.metadata) ? projected.metadata : {}),
    openedFromNewerVersion: source.schemaVersion,
  };
  return projected;
}

export function openDocument(source, options = {}) {
  if (!isRecord(source)) throw new Error('Dokument musi być obiektem JSON.');
  const sourceVersion = readSchemaVersion(source);
  if (!sourceVersion) throw new Error('Dokument nie zawiera prawidłowego numeru schemaVersion.');

  if (sourceVersion > DOCUMENT_SCHEMA_VERSION) {
    const projected = projectFutureDocument(source);
    const validation = validateDocument(projected);
    if (!validation.valid) {
      throw new Error(`Projekt v${sourceVersion} nie jest zgodny nawet w trybie podglądu. ${validation.errors.join(' ')}`);
    }
    return {
      document: projected,
      originalDocument: cloneDocument(source),
      sourceVersion,
      migrated: false,
      readOnly: true,
      warning: `Projekt ma nowszy format v${sourceVersion}. Otworzono zgodną część tylko do odczytu; zapis jest zablokowany.`,
    };
  }

  const document = migrateDocument(source, options);
  const validation = validateDocument(document);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return {
    document,
    originalDocument: null,
    sourceVersion,
    migrated: sourceVersion !== DOCUMENT_SCHEMA_VERSION,
    readOnly: false,
    warning: sourceVersion === DOCUMENT_SCHEMA_VERSION
      ? ''
      : `Projekt został bezpiecznie zmigrowany z v${sourceVersion} do v${DOCUMENT_SCHEMA_VERSION}.`,
  };
}

export function validateDocument(document) {
  const issues = [];
  const add = (path, message, code = 'INVALID') => issues.push({ path, message, code });
  const requireArray = (owner, key, path = key) => {
    if (!Array.isArray(owner?.[key])) {
      add(path, 'Wymagana jest tablica.', 'TYPE');
      return [];
    }
    return owner[key];
  };

  if (!isRecord(document)) {
    add('$', 'Dokument musi być obiektem JSON.', 'TYPE');
    return { valid: false, errors: issues.map((issue) => `${issue.path}: ${issue.message}`), issues };
  }
  if (document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
    add('schemaVersion', `Oczekiwano wersji ${DOCUMENT_SCHEMA_VERSION}.`, 'VERSION');
  }
  if (typeof document.id !== 'string' || !document.id.trim()) add('id', 'Dokument musi mieć niepuste ID.', 'REQUIRED');
  if (typeof document.name !== 'string' || !document.name.trim()) add('name', 'Projekt musi mieć nazwę.', 'REQUIRED');
  if (document.units !== 'mm') add('units', 'Bieżąca wersja obsługuje jednostkę dokumentu „mm”.', 'UNSUPPORTED');

  const parameters = requireArray(document, 'parameters');
  const sketches = requireArray(document, 'sketches');
  const features = requireArray(document, 'features');
  const featureGroups = requireArray(document, 'featureGroups');
  const linkedProjects = requireArray(document, 'linkedProjects');
  const namedViews = document.namedViews === undefined ? [] : requireArray(document, 'namedViews');
  const bodies = requireArray(document, 'bodies');
  const components = requireArray(document, 'components');
  const componentInstances = requireArray(document, 'componentInstances');
  const rigidGroups = requireArray(document, 'rigidGroups');
  const joints = requireArray(document, 'joints');
  const motionLinks = requireArray(document, 'motionLinks');
  const contactSets = requireArray(document, 'contactSets');
  const assemblyConfigurations = requireArray(document, 'assemblyConfigurations');
  const references = requireArray(document, 'references');
  const layers = requireArray(document, 'layers');
  const blocks = requireArray(document, 'blocks');
  const drawings = requireArray(document, 'drawings');
  if (!isRecord(document.print)) add('print', 'Wymagane są ustawienia druku.', 'TYPE');
  if (!isRecord(document.metadata)) add('metadata', 'Wymagane są metadane dokumentu.', 'TYPE');

  const allIds = new Map();
  const registerId = (value, path) => {
    if (typeof value !== 'string' || !value.trim()) {
      add(path, 'Wymagane jest niepuste ID.', 'REQUIRED');
      return;
    }
    if (allIds.has(value)) add(path, `ID „${value}” jest już użyte w ${allIds.get(value)}.`, 'DUPLICATE_ID');
    else allIds.set(value, path);
  };
  registerId(document.id, 'id');

  const linkedProjectIds = new Set();
  linkedProjects.forEach((link, index) => {
    const base = `linkedProjects[${index}]`;
    if (!isRecord(link)) {
      add(base, 'Łącze projektu musi być obiektem.', 'TYPE');
      return;
    }
    registerId(link.id, `${base}.id`);
    if (typeof link.id === 'string' && link.id) linkedProjectIds.add(link.id);
    if (typeof link.relativePath !== 'string' || !link.relativePath || link.relativePath.length > 1024 || link.relativePath.includes('\0')) add(`${base}.relativePath`, 'Łącze wymaga bezpiecznej ścieżki względnej.', 'FORMAT');
    if (typeof link.fileName !== 'string' || !link.fileName.toLowerCase().endsWith('.madcad')) add(`${base}.fileName`, 'Łącze wymaga nazwy pliku .madcad.', 'FORMAT');
    if (typeof link.sourceDocumentId !== 'string' || !link.sourceDocumentId) add(`${base}.sourceDocumentId`, 'Łącze wymaga ID dokumentu źródłowego.', 'REQUIRED');
    if (!Number.isInteger(link.sourceSchemaVersion) || link.sourceSchemaVersion < MIN_MIGRATABLE_SCHEMA_VERSION) add(`${base}.sourceSchemaVersion`, 'Łącze wymaga prawidłowej wersji schematu źródła.', 'VALUE');
    if (!/^[0-9a-f]{64}$/i.test(link.sourceHash || '')) add(`${base}.sourceHash`, 'Łącze wymaga sumy SHA-256 źródła.', 'FORMAT');
    if (!Array.isArray(link.proxyFeatureIds) || !link.proxyFeatureIds.length) add(`${base}.proxyFeatureIds`, 'Łącze wymaga co najmniej jednej operacji proxy.', 'REQUIRED');
  });

  const namedViewNames = new Set();
  if (namedViews.length > MAX_NAMED_VIEWS) add('namedViews', `Projekt może zawierać maksymalnie ${MAX_NAMED_VIEWS} zapisanych widoków.`, 'LIMIT');
  namedViews.forEach((view, index) => {
    const base = `namedViews[${index}]`;
    if (!isRecord(view)) {
      add(base, 'Zapisany widok musi być obiektem.', 'TYPE');
      return;
    }
    registerId(view.id, `${base}.id`);
    const name = typeof view.name === 'string' ? view.name.trim() : '';
    if (!name || name.length > 60) add(`${base}.name`, 'Nazwa zapisanego widoku musi mieć od 1 do 60 znaków.', 'FORMAT');
    else if (namedViewNames.has(name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa zapisanego widoku: ${name}`, 'DUPLICATE');
    else namedViewNames.add(name.toLocaleLowerCase());
    try { normalizeNamedViewCamera(view.camera); } catch (error) { add(`${base}.camera`, error.message, 'VALUE'); }
  });

  const layerIds = new Set();
  const layerNames = new Set();
  layers.forEach((layer, index) => {
    const base = `layers[${index}]`;
    if (!isRecord(layer)) {
      add(base, 'Warstwa musi być obiektem.', 'TYPE');
      return;
    }
    registerId(layer.id, `${base}.id`);
    if (typeof layer.id === 'string') layerIds.add(layer.id);
    if (typeof layer.name !== 'string' || !layer.name.trim()) add(`${base}.name`, 'Warstwa wymaga nazwy.', 'REQUIRED');
    else if (layerNames.has(layer.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa warstwy: ${layer.name}`, 'DUPLICATE');
    else layerNames.add(layer.name.toLocaleLowerCase());
    if (!/^#[0-9a-f]{6}$/i.test(layer.color || '')) add(`${base}.color`, 'Kolor warstwy musi mieć zapis #RRGGBB.', 'FORMAT');
    if (!isSupportedLineType(layer.lineType)) add(`${base}.lineType`, `Nieobsługiwany typ linii: ${layer.lineType ?? ''}.`, 'UNSUPPORTED');
    if (!LINE_WEIGHTS.includes(Number(layer.lineWeight))) add(`${base}.lineWeight`, `Nieobsługiwana grubość linii: ${layer.lineWeight ?? ''}.`, 'UNSUPPORTED');
    for (const key of ['visible', 'locked', 'printable']) if (typeof layer[key] !== 'boolean') add(`${base}.${key}`, 'Wymagana jest wartość logiczna.', 'TYPE');
  });
  if (!layers.length) add('layers', 'Dokument musi zawierać co najmniej jedną warstwę.', 'REQUIRED');
  if (!layerIds.has(document.activeLayerId)) add('activeLayerId', 'Aktywna warstwa musi istnieć w dokumencie.', 'BROKEN_REFERENCE');

  const blockIds = new Set();
  const blockNames = new Set();
  blocks.forEach((block, index) => {
    const base = `blocks[${index}]`;
    if (!isRecord(block)) {
      add(base, 'Definicja bloku musi być obiektem.', 'TYPE');
      return;
    }
    registerId(block.id, `${base}.id`);
    if (typeof block.id === 'string') blockIds.add(block.id);
    if (typeof block.name !== 'string' || !block.name.trim()) add(`${base}.name`, 'Blok wymaga nazwy.', 'REQUIRED');
    else if (blockNames.has(block.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa bloku: ${block.name}`, 'DUPLICATE');
    else blockNames.add(block.name.toLocaleLowerCase());
    if (!Array.isArray(block.basePoint) || block.basePoint.length !== 2 || block.basePoint.some((value) => !Number.isFinite(Number(value)))) add(`${base}.basePoint`, 'Punkt bazowy bloku wymaga dwóch liczb.', 'TYPE');
    const templateEntities = requireArray(block, 'entities', `${base}.entities`);
    requireArray(block, 'constraints', `${base}.constraints`);
    requireArray(block, 'dimensions', `${base}.dimensions`);
    const attributes = requireArray(block, 'attributeDefinitions', `${base}.attributeDefinitions`);
    const templateIds = new Set();
    templateEntities.forEach((entity, entityIndex) => {
      if (!isRecord(entity) || typeof entity.id !== 'string' || !entity.id) add(`${base}.entities[${entityIndex}]`, 'Encja definicji bloku wymaga ID.', 'REQUIRED');
      else if (templateIds.has(entity.id)) add(`${base}.entities[${entityIndex}].id`, 'Powtórzone ID encji definicji bloku.', 'DUPLICATE');
      else templateIds.add(entity.id);
    });
    const attributeTags = new Set();
    attributes.forEach((attribute, attributeIndex) => {
      const attributeBase = `${base}.attributeDefinitions[${attributeIndex}]`;
      if (!isRecord(attribute)) add(attributeBase, 'Atrybut bloku musi być obiektem.', 'TYPE');
      else if (!/^[A-Z_][A-Z0-9_]*$/.test(attribute.tag || '')) add(`${attributeBase}.tag`, 'Nieprawidłowy tag atrybutu.', 'FORMAT');
      else if (attributeTags.has(attribute.tag)) add(`${attributeBase}.tag`, `Powtórzony tag: ${attribute.tag}`, 'DUPLICATE');
      else attributeTags.add(attribute.tag);
    });
  });

  const parameterNames = new Set();
  parameters.forEach((parameter, index) => {
    const base = `parameters[${index}]`;
    if (!isRecord(parameter)) {
      add(base, 'Parametr musi być obiektem.', 'TYPE');
      return;
    }
    registerId(parameter.id, `${base}.id`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(parameter.name || '')) add(`${base}.name`, `Nieprawidłowa nazwa parametru: ${parameter.name ?? ''}`, 'FORMAT');
    if (parameterNames.has(parameter.name)) add(`${base}.name`, `Powtórzony parametr: ${parameter.name}`, 'DUPLICATE');
    parameterNames.add(parameter.name);
    if (typeof parameter.expression !== 'string' && typeof parameter.expression !== 'number') add(`${base}.expression`, 'Wyrażenie musi być tekstem albo liczbą.', 'TYPE');
    if (typeof parameter.unit !== 'string' || !parameter.unit) add(`${base}.unit`, 'Parametr musi mieć jednostkę.', 'REQUIRED');
  });
  const resolvedParameterResult = resolveParameters(parameters.filter(isRecord));
  const resolvedParameterValues = resolvedParameterResult.valid ? resolvedParameterResult.values : {};

  const sketchIds = new Set();
  const profileOwners = new Map();
  const entityOwners = new Map();
  sketches.forEach((sketch, sketchIndex) => {
    const base = `sketches[${sketchIndex}]`;
    if (!isRecord(sketch)) {
      add(base, 'Szkic musi być obiektem.', 'TYPE');
      return;
    }
    registerId(sketch.id, `${base}.id`);
    if (typeof sketch.id === 'string') sketchIds.add(sketch.id);
    if (sketch.type !== 'sketch') add(`${base}.type`, 'Typ szkicu musi mieć wartość „sketch”.', 'VALUE');
    if (!SUPPORTED_PLANES.has(sketch.plane)) add(`${base}.plane`, `Nieobsługiwana płaszczyzna: ${sketch.plane ?? ''}.`, 'UNSUPPORTED');
    if (typeof sketch.planeOffset !== 'string' && typeof sketch.planeOffset !== 'number' && sketch.planeOffset !== undefined) add(`${base}.planeOffset`, 'Odsunięcie płaszczyzny szkicu musi być wyrażeniem albo liczbą.', 'TYPE');
    if (sketch.support !== undefined && (!isRecord(sketch.support) || !['face', 'construction-plane'].includes(sketch.support.kind) || typeof sketch.support.referenceId !== 'string' || !sketch.support.referenceId)) add(`${base}.support`, 'Podpora szkicu wymaga trwałej referencji do ściany albo płaszczyzny.', 'TYPE');
    const profiles = requireArray(sketch, 'profiles', `${base}.profiles`);
    const entities = requireArray(sketch, 'entities', `${base}.entities`);
    const constraints = requireArray(sketch, 'constraints', `${base}.constraints`);
    const dimensions = requireArray(sketch, 'dimensions', `${base}.dimensions`);
    const blockInstances = requireArray(sketch, 'blockInstances', `${base}.blockInstances`);
    const entityIds = new Set();
    const entityMap = new Map();
    entities.forEach((entity, entityIndex) => {
      const entityBase = `${base}.entities[${entityIndex}]`;
      if (!isRecord(entity)) {
        add(entityBase, 'Encja szkicu musi być obiektem.', 'TYPE');
        return;
      }
      registerId(entity.id, `${entityBase}.id`);
      if (typeof entity.id === 'string') {
        entityIds.add(entity.id);
        entityMap.set(entity.id, entity);
        entityOwners.set(entity.id, { sketchId: sketch.id, type: entity.type });
      }
      if (typeof entity.type !== 'string' || !entity.type.trim()) add(`${entityBase}.type`, 'Encja musi mieć typ.', 'REQUIRED');
      else if (!ENTITY_TYPES.has(entity.type)) add(`${entityBase}.type`, `Nieobsługiwany typ encji: ${entity.type}.`, 'UNSUPPORTED');
      if (!ENTITY_ROLES.has(entity.role)) add(`${entityBase}.role`, `Nieobsługiwana rola encji: ${entity.role ?? ''}.`, 'UNSUPPORTED');
      if (!layerIds.has(entity.layerId)) add(`${entityBase}.layerId`, `Nie znaleziono warstwy „${entity.layerId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (entity.color !== BY_LAYER && !/^#[0-9a-f]{6}$/i.test(entity.color || '')) add(`${entityBase}.color`, 'Kolor encji musi mieć wartość ByLayer albo #RRGGBB.', 'FORMAT');
      if (entity.lineType !== BY_LAYER && !isSupportedLineType(entity.lineType)) add(`${entityBase}.lineType`, `Nieobsługiwany typ linii: ${entity.lineType ?? ''}.`, 'UNSUPPORTED');
      if (entity.lineWeight !== BY_LAYER && !LINE_WEIGHTS.includes(Number(entity.lineWeight))) add(`${entityBase}.lineWeight`, `Nieobsługiwana grubość linii: ${entity.lineWeight ?? ''}.`, 'UNSUPPORTED');
      if (typeof entity.fixed !== 'boolean') add(`${entityBase}.fixed`, 'Pole fixed musi być logiczne.', 'TYPE');
      if (!Array.isArray(entity.pointIds)) add(`${entityBase}.pointIds`, 'Encja musi zawierać tablicę stabilnych referencji punktów.', 'TYPE');
      if (!isRecord(entity.geometry)) add(`${entityBase}.geometry`, 'Encja musi zawierać geometrię.', 'TYPE');
      if (!Array.isArray(entity.expressionKeys)) add(`${entityBase}.expressionKeys`, 'Encja musi wskazywać pola zależne od parametrów.', 'TYPE');
      else entity.expressionKeys.forEach((key, expressionIndex) => {
        const value = entity.geometry?.[key];
        if (typeof value !== 'string' && typeof value !== 'number') {
          add(`${entityBase}.expressionKeys[${expressionIndex}]`, `Pole geometrii „${key}” nie istnieje.`, 'BROKEN_REFERENCE');
          return;
        }
        try {
          for (const parameterName of listExpressionIdentifiers(value)) {
            if (!parameterNames.has(parameterName)) add(`${entityBase}.geometry.${key}`, `Nie znaleziono parametru „${parameterName}”.`, 'BROKEN_REFERENCE');
          }
        } catch (error) {
          add(`${entityBase}.geometry.${key}`, error.message, 'FORMAT');
        }
      });
      if (entity.role === 'projected' && (typeof entity.sourceReferenceId !== 'string' || !entity.sourceReferenceId.trim())) {
        add(`${entityBase}.sourceReferenceId`, 'Geometria projected wymaga referencji źródłowej.', 'BROKEN_REFERENCE');
      }
      const pointCount = Array.isArray(entity.pointIds) ? entity.pointIds.length : 0;
      if (entity.type === 'point') {
        if (pointCount !== 0) add(`${entityBase}.pointIds`, 'Punkt nie może odwoływać się do innych punktów.', 'VALUE');
        for (const coordinate of ['x', 'y']) {
          if (typeof entity.geometry?.[coordinate] !== 'string' && typeof entity.geometry?.[coordinate] !== 'number') {
            add(`${entityBase}.geometry.${coordinate}`, `Punkt wymaga współrzędnej ${coordinate}.`, 'REQUIRED');
          }
        }
      }
      if (entity.type === 'line' && pointCount !== 2) add(`${entityBase}.pointIds`, 'Linia wymaga dwóch końców.', 'VALUE');
      if (entity.type === 'arc' && pointCount !== 3) add(`${entityBase}.pointIds`, 'Łuk wymaga centrum, początku i końca.', 'VALUE');
      if (entity.type === 'arc' && !['cw', 'ccw'].includes(entity.geometry?.direction)) add(`${entityBase}.geometry.direction`, 'Kierunek łuku musi mieć wartość cw albo ccw.', 'VALUE');
      if (entity.type === 'circle') {
        if (pointCount !== 1) add(`${entityBase}.pointIds`, 'Okrąg wymaga punktu środka.', 'VALUE');
        if (typeof entity.geometry?.radius !== 'string' && typeof entity.geometry?.radius !== 'number') add(`${entityBase}.geometry.radius`, 'Okrąg wymaga promienia.', 'REQUIRED');
      }
    });
    const pointCoordinate = (pointId) => {
      const point = entityMap.get(pointId);
      if (point?.type !== 'point') return null;
      try {
        const numeric = (value) => {
          const direct = Number(value);
          return Number.isFinite(direct) ? direct : evaluateExpression(value, resolvedParameterValues);
        };
        const coordinate = [numeric(point.geometry?.x), numeric(point.geometry?.y)];
        return coordinate.every(Number.isFinite) ? coordinate : null;
      } catch {
        return null;
      }
    };
    const boundaryPointsMatch = (firstPointId, secondPointId) => {
      if (firstPointId === secondPointId) return true;
      const first = pointCoordinate(firstPointId);
      const second = pointCoordinate(secondPointId);
      if (first && second) return Math.hypot(first[0] - second[0], first[1] - second[1]) <= GEOMETRY_POLICY.profileJoinTolerance;
      const firstPoint = entityMap.get(firstPointId);
      const secondPoint = entityMap.get(secondPointId);
      return firstPoint?.type === 'point'
        && secondPoint?.type === 'point'
        && String(firstPoint.geometry?.x).trim() === String(secondPoint.geometry?.x).trim()
        && String(firstPoint.geometry?.y).trim() === String(secondPoint.geometry?.y).trim();
    };
    const blockInstanceIds = new Set();
    blockInstances.forEach((instance, instanceIndex) => {
      const instanceBase = `${base}.blockInstances[${instanceIndex}]`;
      if (!isRecord(instance)) {
        add(instanceBase, 'Wystąpienie bloku musi być obiektem.', 'TYPE');
        return;
      }
      registerId(instance.id, `${instanceBase}.id`);
      if (typeof instance.id === 'string') blockInstanceIds.add(instance.id);
      if (!blockIds.has(instance.blockId)) add(`${instanceBase}.blockId`, `Nie znaleziono definicji bloku „${instance.blockId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!Array.isArray(instance.insertionPoint) || instance.insertionPoint.length !== 2 || instance.insertionPoint.some((value) => !Number.isFinite(Number(value)))) add(`${instanceBase}.insertionPoint`, 'Punkt wstawienia bloku wymaga dwóch liczb.', 'TYPE');
      if (!Number.isFinite(Number(instance.rotation))) add(`${instanceBase}.rotation`, 'Obrót bloku musi być liczbą.', 'TYPE');
      if (!(Number(instance.scale) > 0)) add(`${instanceBase}.scale`, 'Skala bloku musi być dodatnia.', 'VALUE');
      if (!Array.isArray(instance.entityIds) || !instance.entityIds.length) add(`${instanceBase}.entityIds`, 'Wystąpienie bloku wymaga geometrii.', 'REQUIRED');
      if (!isRecord(instance.attributes)) add(`${instanceBase}.attributes`, 'Atrybuty wystąpienia muszą być obiektem.', 'TYPE');
    });
    blockInstances.forEach((instance, instanceIndex) => (instance.entityIds || []).forEach((entityId, entityIndex) => {
      if (!entityIds.has(entityId)) add(`${base}.blockInstances[${instanceIndex}].entityIds[${entityIndex}]`, `Nie znaleziono encji bloku „${entityId}”.`, 'BROKEN_REFERENCE');
      const entity = entityMap.get(entityId);
      if (entity?.blockInstanceId !== instance.id) add(`${base}.blockInstances[${instanceIndex}].entityIds[${entityIndex}]`, 'Encja nie wskazuje zgodnego wystąpienia bloku.', 'VALUE');
    }));
    entities.forEach((entity, entityIndex) => {
      if (entity.blockInstanceId !== undefined && !blockInstanceIds.has(entity.blockInstanceId)) add(`${base}.entities[${entityIndex}].blockInstanceId`, `Nie znaleziono wystąpienia bloku „${entity.blockInstanceId}”.`, 'BROKEN_REFERENCE');
      if (entity.blockDefinitionId !== undefined && !blockIds.has(entity.blockDefinitionId)) add(`${base}.entities[${entityIndex}].blockDefinitionId`, `Nie znaleziono definicji bloku „${entity.blockDefinitionId}”.`, 'BROKEN_REFERENCE');
    });
    entities.forEach((entity, entityIndex) => {
      if (!Array.isArray(entity?.pointIds)) return;
      entity.pointIds.forEach((pointId, pointIndex) => {
        const point = entityMap.get(pointId);
        if (!point) add(`${base}.entities[${entityIndex}].pointIds[${pointIndex}]`, `Nie znaleziono punktu „${pointId ?? ''}”.`, 'BROKEN_REFERENCE');
        else if (point.type !== 'point') add(`${base}.entities[${entityIndex}].pointIds[${pointIndex}]`, `Encja „${pointId}” nie jest punktem.`, 'TYPE');
      });
      if (new Set(entity.pointIds).size !== entity.pointIds.length) add(`${base}.entities[${entityIndex}].pointIds`, 'Referencje punktów encji nie mogą się powtarzać.', 'DUPLICATE');
    });
    const validateEntityReferences = (owner, ownerBase) => {
      const referencedIds = Array.isArray(owner.entityIds)
        ? owner.entityIds
        : typeof owner.entityId === 'string'
          ? [owner.entityId]
          : [];
      referencedIds.forEach((entityId, referenceIndex) => {
        if (!entityIds.has(entityId)) add(`${ownerBase}.entityIds[${referenceIndex}]`, `Nie znaleziono encji szkicu „${entityId}”.`, 'BROKEN_REFERENCE');
      });
    };
    const constraintIds = new Set();
    constraints.forEach((constraint, constraintIndex) => {
      const constraintBase = `${base}.constraints[${constraintIndex}]`;
      if (!isRecord(constraint)) {
        add(constraintBase, 'Wiązanie musi być obiektem.', 'TYPE');
        return;
      }
      registerId(constraint.id, `${constraintBase}.id`);
      if (typeof constraint.id === 'string') constraintIds.add(constraint.id);
      if (typeof constraint.type !== 'string' || !constraint.type.trim()) add(`${constraintBase}.type`, 'Wiązanie musi mieć typ.', 'REQUIRED');
      if (constraint.automatic !== undefined && typeof constraint.automatic !== 'boolean') add(`${constraintBase}.automatic`, 'Flaga automatycznego więzu musi być wartością logiczną.', 'TYPE');
      validateEntityReferences(constraint, constraintBase);
      if (constraint.value !== undefined) {
        if (typeof constraint.value !== 'string' && typeof constraint.value !== 'number') add(`${constraintBase}.value`, 'Wartość więzu musi być wyrażeniem tekstowym albo liczbą.', 'TYPE');
        else {
          try {
            for (const parameterName of listExpressionIdentifiers(constraint.value)) {
              if (!parameterNames.has(parameterName)) add(`${constraintBase}.value`, `Nie znaleziono parametru „${parameterName}”.`, 'BROKEN_REFERENCE');
            }
          } catch (error) {
            add(`${constraintBase}.value`, error.message, 'FORMAT');
          }
        }
      }
    });
    dimensions.forEach((dimension, dimensionIndex) => {
      const dimensionBase = `${base}.dimensions[${dimensionIndex}]`;
      if (!isRecord(dimension)) {
        add(dimensionBase, 'Wymiar musi być obiektem.', 'TYPE');
        return;
      }
      registerId(dimension.id, `${dimensionBase}.id`);
      if (typeof dimension.type !== 'string' || !dimension.type.trim()) add(`${dimensionBase}.type`, 'Wymiar musi mieć typ.', 'REQUIRED');
      else if (!DIMENSION_TYPES.has(dimension.type) && dimension.type !== 'length') add(`${dimensionBase}.type`, `Nieobsługiwany typ wymiaru: ${dimension.type}.`, 'UNSUPPORTED');
      validateEntityReferences(dimension, dimensionBase);
      if (dimension.expression !== undefined) {
        if (typeof dimension.expression !== 'string' && typeof dimension.expression !== 'number') add(`${dimensionBase}.expression`, 'Wartość wymiaru musi być wyrażeniem tekstowym albo liczbą.', 'TYPE');
        else {
          try {
            for (const parameterName of listExpressionIdentifiers(dimension.expression)) {
              if (!parameterNames.has(parameterName)) add(`${dimensionBase}.expression`, `Nie znaleziono parametru „${parameterName}”.`, 'BROKEN_REFERENCE');
            }
          } catch (error) {
            add(`${dimensionBase}.expression`, error.message, 'FORMAT');
          }
        }
      }
      if (dimension.driving !== undefined && typeof dimension.driving !== 'boolean') add(`${dimensionBase}.driving`, 'Pole driving musi być logiczne.', 'TYPE');
      if (dimension.constraintId !== undefined && !constraintIds.has(dimension.constraintId)) add(`${dimensionBase}.constraintId`, `Nie znaleziono więzu „${dimension.constraintId ?? ''}”.`, 'BROKEN_REFERENCE');
    });
    profiles.forEach((profile, profileIndex) => {
      const profileBase = `${base}.profiles[${profileIndex}]`;
      if (!isRecord(profile)) {
        add(profileBase, 'Profil musi być obiektem.', 'TYPE');
        return;
      }
      registerId(profile.id, `${profileBase}.id`);
      if (typeof profile.id === 'string') profileOwners.set(profile.id, sketch.id);
      if (!PROFILE_TYPES.has(profile.type)) add(`${profileBase}.type`, `Nieobsługiwany profil: ${profile.type ?? ''}.`, 'UNSUPPORTED');
      if ((profile.type === 'rectangle' || profile.type === 'circle') && !isRecord(profile.geometry)) add(`${profileBase}.geometry`, 'Profil prymitywu musi zawierać zgodny cache geometrii.', 'TYPE');
      if (profile.closed !== true) add(`${profileBase}.closed`, 'Profil bryłowy musi być zamknięty.', 'VALUE');
      if (typeof profile.source !== 'string' || !profile.source.trim()) add(`${profileBase}.source`, 'Profil musi wskazywać źródło wykrycia.', 'REQUIRED');
      const validateProfileLoop = (loop, loopBase) => {
        if (!Array.isArray(loop.entityIds) || !loop.entityIds.length) {
          add(`${loopBase}.entityIds`, 'Pętla profilu musi odwoływać się do encji brzegowych.', 'REQUIRED');
          return;
        }
        loop.entityIds.forEach((entityId, entityIndex) => {
          if (!entityIds.has(entityId)) add(`${loopBase}.entityIds[${entityIndex}]`, `Nie znaleziono encji szkicu „${entityId}”.`, 'BROKEN_REFERENCE');
          else if (['construction', 'centerline'].includes(entityMap.get(entityId)?.role)) add(`${loopBase}.entityIds[${entityIndex}]`, 'Geometria konstrukcyjna nie może tworzyć profilu.', 'VALUE');
        });
        if (loop.entityDirections !== undefined && (!Array.isArray(loop.entityDirections) || loop.entityDirections.length !== loop.entityIds.length || loop.entityDirections.some((value) => ![-1, 1].includes(value)))) {
          add(`${loopBase}.entityDirections`, 'Kierunki pętli muszą odpowiadać krawędziom i mieć wartość -1 albo 1.', 'VALUE');
        }
        if (loop.entityIds.length === 1 && ['circle', 'ellipse'].includes(entityMap.get(loop.entityIds[0])?.type)) return;
        const endpoints = loop.entityIds.map((entityId, entityIndex) => {
          const pair = boundaryPointIds(entityMap.get(entityId));
          return loop.entityDirections?.[entityIndex] === -1 ? [...pair].reverse() : pair;
        });
        endpoints.forEach((pair, entityIndex) => {
          if (pair.length !== 2) add(`${loopBase}.entityIds[${entityIndex}]`, 'Profil zamknięty może zawierać tylko linie, łuki, pojedynczy okrąg albo elipsę.', 'TYPE');
          const next = endpoints[(entityIndex + 1) % endpoints.length];
          if (pair.length === 2 && next?.length === 2 && !boundaryPointsMatch(pair[1], next[0])) add(`${loopBase}.entityIds[${entityIndex}]`, 'Segment nie łączy się z następną krawędzią profilu.', 'BROKEN_REFERENCE');
        });
      };
      validateProfileLoop(profile, profileBase);
      if (profile.innerLoops !== undefined && !Array.isArray(profile.innerLoops)) add(`${profileBase}.innerLoops`, 'Otwory profilu muszą być tablicą pętli.', 'TYPE');
      (profile.innerLoops || []).forEach((loop, loopIndex) => {
        const loopBase = `${profileBase}.innerLoops[${loopIndex}]`;
        if (!isRecord(loop)) add(loopBase, 'Otwór profilu musi być obiektem.', 'TYPE');
        else validateProfileLoop(loop, loopBase);
      });
    });
  });

  const bodyIds = new Set();
  const surfaceBodyIds = new Set();
  const sheetBodyIds = new Set();
  const unfoldedSheetBodyIds = new Set();
  bodies.forEach((body, index) => {
    const base = `bodies[${index}]`;
    if (!isRecord(body)) {
      add(base, 'Bryła musi być obiektem.', 'TYPE');
      return;
    }
    registerId(body.id, `${base}.id`);
    if (typeof body.id === 'string') bodyIds.add(body.id);
  });

  const componentIds = new Set();
  components.forEach((component, index) => {
    const base = `components[${index}]`;
    if (!isRecord(component)) add(base, 'Komponent musi być obiektem.', 'TYPE');
    else {
      registerId(component.id, `${base}.id`);
      if (typeof component.id === 'string' && component.id) componentIds.add(component.id);
    }
  });
  references.forEach((reference, index) => {
    const base = `references[${index}]`;
    if (!isRecord(reference)) add(base, 'Referencja musi być obiektem.', 'TYPE');
    else {
      registerId(reference.id, `${base}.id`);
      if (reference.kind === 'topology') {
        if (!['face', 'edge', 'vertex'].includes(reference.topologyKind)) add(`${base}.topologyKind`, 'Referencja topologii wymaga typu face, edge albo vertex.', 'VALUE');
        if (typeof reference.topologyId !== 'string' || !reference.topologyId) add(`${base}.topologyId`, 'Referencja topologii wymaga trwałego ID.', 'REQUIRED');
        if (typeof reference.bodyId !== 'string' || !reference.bodyId) add(`${base}.bodyId`, 'Referencja topologii wymaga ID bryły.', 'REQUIRED');
      } else if (reference.kind === 'construction-plane') {
        if (!['offset', 'midplane', 'three-points', 'angle', 'tangent', 'path'].includes(reference.planeType)) add(`${base}.planeType`, 'Nieobsługiwany typ płaszczyzny konstrukcyjnej.', 'UNSUPPORTED');
        if (['offset', 'midplane', 'angle'].includes(reference.planeType) && !SUPPORTED_PLANES.has(reference.basePlane)) add(`${base}.basePlane`, `Nieobsługiwana płaszczyzna bazowa: ${reference.basePlane ?? ''}.`, 'UNSUPPORTED');
        if (typeof reference.name !== 'string' || !reference.name.trim()) add(`${base}.name`, 'Płaszczyzna konstrukcyjna wymaga nazwy.', 'REQUIRED');
        if (reference.planeType === 'offset' && typeof reference.offset !== 'string' && typeof reference.offset !== 'number') add(`${base}.offset`, 'Odległość płaszczyzny musi być wyrażeniem albo liczbą.', 'TYPE');
        if (reference.planeType === 'midplane' && [reference.firstOffset, reference.secondOffset].some((value) => typeof value !== 'string' && typeof value !== 'number')) add(`${base}.firstOffset`, 'Płaszczyzna środkowa wymaga dwóch położeń.', 'TYPE');
        if (reference.planeType === 'three-points' && (!Array.isArray(reference.points) || reference.points.length !== 3 || reference.points.some((point) => !Array.isArray(point) || point.length !== 3))) add(`${base}.points`, 'Płaszczyzna wymaga trzech punktów 3D.', 'TYPE');
        if (reference.planeType === 'angle' && (!['u', 'v'].includes(reference.rotationAxis) || [reference.angle, reference.offset].some((value) => typeof value !== 'string' && typeof value !== 'number'))) add(`${base}.angle`, 'Płaszczyzna pod kątem wymaga osi U/V, kąta i odsunięcia.', 'TYPE');
        if (reference.planeType === 'tangent' && (!['sphere', 'cylinder'].includes(reference.surfaceType) || ![reference.center, reference.point, reference.axis].every((vector) => Array.isArray(vector) && vector.length === 3))) add(`${base}.point`, 'Płaszczyzna styczna wymaga powierzchni oraz trzech wektorów 3D.', 'TYPE');
        if (reference.planeType === 'path' && ![reference.point, reference.direction].every((vector) => Array.isArray(vector) && vector.length === 3)) add(`${base}.direction`, 'Płaszczyzna ścieżki wymaga punktu i kierunku 3D.', 'TYPE');
        if (typeof reference.visible !== 'boolean') add(`${base}.visible`, 'Widoczność płaszczyzny musi być wartością logiczną.', 'TYPE');
      } else if (reference.kind === 'construction-axis') {
        if (!['edge', 'cylinder', 'two-points', 'plane-intersection', 'plane-normal'].includes(reference.axisType)) add(`${base}.axisType`, 'Nieobsługiwany typ osi konstrukcyjnej.', 'UNSUPPORTED');
        if (typeof reference.name !== 'string' || !reference.name.trim()) add(`${base}.name`, 'Oś konstrukcyjna wymaga nazwy.', 'REQUIRED');
        if (['edge', 'two-points'].includes(reference.axisType) && (!Array.isArray(reference.points) || reference.points.length !== 2 || reference.points.some((point) => !Array.isArray(point) || point.length !== 3))) add(`${base}.points`, 'Oś wymaga dwóch punktów 3D.', 'TYPE');
        if (reference.axisType === 'cylinder' && (![reference.origin, reference.direction].every((vector) => Array.isArray(vector) && vector.length === 3))) add(`${base}.direction`, 'Oś walca wymaga środka i kierunku 3D.', 'TYPE');
        if (reference.axisType === 'plane-intersection' && (!Array.isArray(reference.planeIds) || reference.planeIds.length !== 2 || reference.planeIds.some((id) => typeof id !== 'string' || !id))) add(`${base}.planeIds`, 'Oś przecięcia wymaga dwóch ID płaszczyzn.', 'TYPE');
        if (reference.axisType === 'plane-normal' && (!reference.planeId || !Array.isArray(reference.origin) || reference.origin.length !== 3)) add(`${base}.planeId`, 'Oś normalna wymaga płaszczyzny i punktu 3D.', 'REQUIRED');
        if (typeof reference.visible !== 'boolean') add(`${base}.visible`, 'Widoczność osi musi być wartością logiczną.', 'TYPE');
      } else if (reference.kind === 'construction-point') {
        if (!['vertex', 'center', 'intersection', 'midpoint', 'on-axis'].includes(reference.pointType)) add(`${base}.pointType`, 'Nieobsługiwany typ punktu konstrukcyjnego.', 'UNSUPPORTED');
        if (typeof reference.name !== 'string' || !reference.name.trim()) add(`${base}.name`, 'Punkt konstrukcyjny wymaga nazwy.', 'REQUIRED');
        if (['vertex', 'center'].includes(reference.pointType) && (!Array.isArray(reference.position) || reference.position.length !== 3)) add(`${base}.position`, 'Punkt wymaga położenia 3D.', 'TYPE');
        if (reference.pointType === 'intersection' && (!reference.axisId || !reference.planeId)) add(`${base}.axisId`, 'Punkt przecięcia wymaga osi i płaszczyzny.', 'REQUIRED');
        if (reference.pointType === 'midpoint' && (!Array.isArray(reference.points) || reference.points.length !== 2 || reference.points.some((point) => !Array.isArray(point) || point.length !== 3))) add(`${base}.points`, 'Punkt środkowy wymaga dwóch punktów 3D.', 'TYPE');
        if (reference.pointType === 'on-axis' && (!reference.axisId || (typeof reference.distance !== 'string' && typeof reference.distance !== 'number'))) add(`${base}.axisId`, 'Punkt na osi wymaga osi i odległości.', 'REQUIRED');
        if (typeof reference.visible !== 'boolean') add(`${base}.visible`, 'Widoczność punktu musi być wartością logiczną.', 'TYPE');
      }
    }
  });
  const referenceIds = new Set(references.filter(isRecord).map((reference) => reference.id));
  sketches.forEach((sketch, index) => {
    if (sketch?.support?.referenceId && !referenceIds.has(sketch.support.referenceId)) add(`sketches[${index}].support.referenceId`, `Nie znaleziono podpory szkicu „${sketch.support.referenceId}”.`, 'BROKEN_REFERENCE');
    (sketch?.entities || []).forEach((entity, entityIndex) => {
      if (entity?.projectionReferenceId && !referenceIds.has(entity.projectionReferenceId)) add(`sketches[${index}].entities[${entityIndex}].projectionReferenceId`, `Nie znaleziono źródła Project „${entity.projectionReferenceId}”.`, 'BROKEN_REFERENCE');
    });
  });
  references.forEach((reference, index) => {
    if (!isRecord(reference) || reference.kind !== 'construction-axis' || reference.axisType !== 'plane-intersection' || !Array.isArray(reference.planeIds)) return;
    reference.planeIds.forEach((planeId, planeIndex) => {
      if (!referenceIds.has(planeId)) add(`references[${index}].planeIds[${planeIndex}]`, `Nie znaleziono płaszczyzny „${planeId}”.`, 'BROKEN_REFERENCE');
    });
  });
  references.forEach((reference, index) => {
    if (!isRecord(reference) || reference.kind !== 'construction-axis' || reference.axisType !== 'plane-normal') return;
    if (!referenceIds.has(reference.planeId)) add(`references[${index}].planeId`, `Nie znaleziono płaszczyzny „${reference.planeId}”.`, 'BROKEN_REFERENCE');
  });
  references.forEach((reference, index) => {
    if (!isRecord(reference) || reference.kind !== 'construction-point' || reference.pointType !== 'intersection') return;
    if (!referenceIds.has(reference.axisId)) add(`references[${index}].axisId`, `Nie znaleziono osi „${reference.axisId}”.`, 'BROKEN_REFERENCE');
    if (!referenceIds.has(reference.planeId)) add(`references[${index}].planeId`, `Nie znaleziono płaszczyzny „${reference.planeId}”.`, 'BROKEN_REFERENCE');
  });
  references.forEach((reference, index) => {
    if (!isRecord(reference) || reference.kind !== 'construction-point' || reference.pointType !== 'on-axis') return;
    if (!referenceIds.has(reference.axisId)) add(`references[${index}].axisId`, `Nie znaleziono osi „${reference.axisId}”.`, 'BROKEN_REFERENCE');
  });

  features.forEach((feature, featureIndex) => {
    const base = `features[${featureIndex}]`;
    if (!isRecord(feature)) {
      add(base, 'Operacja musi być obiektem.', 'TYPE');
      return;
    }
    registerId(feature.id, `${base}.id`);
    if (!FEATURE_TYPES.has(feature.type)) add(`${base}.type`, `Nieobsługiwana operacja: ${feature.type ?? ''}.`, 'UNSUPPORTED');
    if (typeof feature.suppressed !== 'boolean') add(`${base}.suppressed`, 'Pole suppressed musi być logiczne.', 'TYPE');
    if (feature.referenceIds !== undefined) {
      if (!Array.isArray(feature.referenceIds)) add(`${base}.referenceIds`, 'Referencje topologii operacji muszą być tablicą.', 'TYPE');
      else feature.referenceIds.forEach((referenceId, referenceIndex) => {
        if (!referenceIds.has(referenceId)) add(`${base}.referenceIds[${referenceIndex}]`, `Nie znaleziono referencji „${referenceId}”.`, 'BROKEN_REFERENCE');
      });
    }

    if (feature.type === 'surfacePatch') {
      if (!sketchIds.has(feature.sketchId)) add(`${base}.sketchId`, `Nie znaleziono szkicu „${feature.sketchId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.profileIds) || feature.profileIds.length !== 1) add(`${base}.profileIds`, 'Patch wymaga dokładnie jednego zamkniętego profilu.', 'REQUIRED');
      else if (!profileOwners.has(feature.profileIds[0]) || profileOwners.get(feature.profileIds[0]) !== feature.sketchId) add(`${base}.profileIds[0]`, 'Profil Patch musi należeć do wskazanego szkicu.', 'BROKEN_REFERENCE');
      const bodyId = `body-${feature.id}`;
      bodyIds.add(bodyId);
      surfaceBodyIds.add(bodyId);
    }

    if (feature.type === 'surfaceExtrude') {
      if (!sketchIds.has(feature.sketchId)) add(`${base}.sketchId`, `Nie znaleziono szkicu „${feature.sketchId ?? ''}”.`, 'BROKEN_REFERENCE');
      const hasOpenChain = Array.isArray(feature.openEntityIds) && feature.openEntityIds.length > 0;
      if (hasOpenChain) feature.openEntityIds.forEach((entityId, entityIndex) => {
        const owner = entityOwners.get(entityId);
        if (!owner) add(`${base}.openEntityIds[${entityIndex}]`, `Nie znaleziono encji „${entityId}”.`, 'BROKEN_REFERENCE');
        else if (owner.sketchId !== feature.sketchId) add(`${base}.openEntityIds[${entityIndex}]`, `Encja „${entityId}” nie należy do szkicu „${feature.sketchId}”.`, 'BROKEN_REFERENCE');
        else if (owner.type !== 'line') add(`${base}.openEntityIds[${entityIndex}]`, 'Otwarte wyciągnięcie powierzchni obsługuje obecnie połączone linie.', 'UNSUPPORTED');
      });
      else if (!Array.isArray(feature.profileIds) || feature.profileIds.length !== 1) add(`${base}.profileIds`, 'Wyciągnięcie powierzchni wymaga jednego zamkniętego profilu albo otwartego łańcucha.', 'REQUIRED');
      else if (!profileOwners.has(feature.profileIds[0]) || profileOwners.get(feature.profileIds[0]) !== feature.sketchId) add(`${base}.profileIds[0]`, 'Profil powierzchni musi należeć do wskazanego szkicu.', 'BROKEN_REFERENCE');
      if (typeof feature.distance !== 'string' && typeof feature.distance !== 'number') add(`${base}.distance`, 'Wyciągnięcie powierzchni wymaga parametrycznej odległości.', 'TYPE');
      const bodyId = `body-${feature.id}`;
      bodyIds.add(bodyId);
      surfaceBodyIds.add(bodyId);
    }

    if (feature.type === 'surfaceRevolve') {
      if (!sketchIds.has(feature.sketchId)) add(`${base}.sketchId`, `Nie znaleziono szkicu „${feature.sketchId ?? ''}”.`, 'BROKEN_REFERENCE');
      const hasOpenChain = Array.isArray(feature.openEntityIds) && feature.openEntityIds.length > 0;
      if (hasOpenChain) feature.openEntityIds.forEach((entityId, entityIndex) => {
        const owner = entityOwners.get(entityId);
        if (!owner) add(`${base}.openEntityIds[${entityIndex}]`, `Nie znaleziono encji „${entityId}”.`, 'BROKEN_REFERENCE');
        else if (owner.sketchId !== feature.sketchId) add(`${base}.openEntityIds[${entityIndex}]`, `Encja „${entityId}” nie należy do szkicu „${feature.sketchId}”.`, 'BROKEN_REFERENCE');
        else if (owner.type !== 'line') add(`${base}.openEntityIds[${entityIndex}]`, 'Otwarty obrót powierzchni obsługuje obecnie połączone linie.', 'UNSUPPORTED');
      });
      else if (!Array.isArray(feature.profileIds) || feature.profileIds.length !== 1) add(`${base}.profileIds`, 'Obrót powierzchni wymaga jednego zamkniętego profilu albo otwartego łańcucha.', 'REQUIRED');
      else if (!profileOwners.has(feature.profileIds[0]) || profileOwners.get(feature.profileIds[0]) !== feature.sketchId) add(`${base}.profileIds[0]`, 'Profil obrotu powierzchni musi należeć do wskazanego szkicu.', 'BROKEN_REFERENCE');
      const axisReference = references.find((reference) => reference.id === feature.axisId);
      if (!['X_AXIS', 'Y_AXIS', 'Z_AXIS'].includes(feature.axisId) && axisReference?.kind !== 'construction-axis') add(`${base}.axisId`, `Nie znaleziono osi obrotu „${feature.axisId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (typeof feature.angle !== 'string' && typeof feature.angle !== 'number') add(`${base}.angle`, 'Obrót powierzchni wymaga parametrycznego kąta.', 'TYPE');
      const bodyId = `body-${feature.id}`;
      bodyIds.add(bodyId);
      surfaceBodyIds.add(bodyId);
    }

    if (feature.type === 'surfaceSweep') {
      if (!sketchIds.has(feature.sketchId) || !sketchIds.has(feature.pathSketchId)) add(`${base}.sketchId`, 'Surface Sweep wymaga szkicu profilu i osobnego szkicu ścieżki.', 'BROKEN_REFERENCE');
      if (feature.sketchId === feature.pathSketchId) add(`${base}.pathSketchId`, 'Profil i ścieżka Surface Sweep muszą należeć do różnych szkiców.', 'VALUE');
      const hasOpenChain = Array.isArray(feature.openEntityIds) && feature.openEntityIds.length > 0;
      if (hasOpenChain) feature.openEntityIds.forEach((entityId, entityIndex) => {
        const owner = entityOwners.get(entityId);
        if (!owner || owner.sketchId !== feature.sketchId || owner.type !== 'line') add(`${base}.openEntityIds[${entityIndex}]`, 'Otwarty profil Surface Sweep musi składać się z połączonych linii szkicu źródłowego.', 'UNSUPPORTED');
      });
      else if (!Array.isArray(feature.profileIds) || feature.profileIds.length !== 1 || profileOwners.get(feature.profileIds[0]) !== feature.sketchId) add(`${base}.profileIds`, 'Surface Sweep wymaga jednego zamkniętego profilu albo otwartego łańcucha.', 'REQUIRED');
      if (!Array.isArray(feature.pathEntityIds) || !feature.pathEntityIds.length) add(`${base}.pathEntityIds`, 'Surface Sweep wymaga ciągłej ścieżki z linii.', 'REQUIRED');
      else feature.pathEntityIds.forEach((entityId, entityIndex) => {
        const owner = entityOwners.get(entityId);
        if (!owner || owner.sketchId !== feature.pathSketchId || owner.type !== 'line') add(`${base}.pathEntityIds[${entityIndex}]`, 'Ścieżka Surface Sweep musi składać się z linii wskazanego szkicu.', 'UNSUPPORTED');
      });
      const bodyId = `body-${feature.id}`;
      bodyIds.add(bodyId);
      surfaceBodyIds.add(bodyId);
    }

    if (feature.type === 'surfaceLoft') {
      if (!Array.isArray(feature.profileIds) || feature.profileIds.length !== 2) add(`${base}.profileIds`, 'Surface Loft wymaga dokładnie dwóch zamkniętych profili.', 'REQUIRED');
      if (!Array.isArray(feature.sketchIds) || feature.sketchIds.length !== 2) add(`${base}.sketchIds`, 'Surface Loft wymaga dwóch osobnych szkiców.', 'REQUIRED');
      else {
        if (feature.sketchIds[0] === feature.sketchIds[1]) add(`${base}.sketchIds`, 'Profile Surface Loft muszą należeć do osobnych szkiców.', 'VALUE');
        feature.profileIds?.forEach((profileId, index) => {
          if (!profileOwners.has(profileId) || profileOwners.get(profileId) !== feature.sketchIds[index]) add(`${base}.profileIds[${index}]`, 'Profil Surface Loft musi należeć do odpowiadającego mu szkicu.', 'BROKEN_REFERENCE');
        });
      }
      if (feature.sketchId !== feature.sketchIds?.[0]) add(`${base}.sketchId`, 'Pierwszy szkic Surface Loft musi być szkicem źródłowym.', 'VALUE');
      if (!['smooth', 'ruled'].includes(feature.loftMode || 'smooth')) add(`${base}.loftMode`, 'Nieobsługiwany tryb Surface Loft.', 'UNSUPPORTED');
      const bodyId = `body-${feature.id}`;
      bodyIds.add(bodyId);
      surfaceBodyIds.add(bodyId);
    }

    if (feature.type === 'surfaceOffset') {
      if (!surfaceBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Surface Offset wymaga istniejącej powierzchni.', 'BROKEN_REFERENCE');
      if (typeof feature.distance !== 'string' && typeof feature.distance !== 'number') add(`${base}.distance`, 'Surface Offset wymaga parametrycznej odległości.', 'TYPE');
    }

    if (feature.type === 'surfaceStitch') {
      const targetBodyIds = Array.isArray(feature.targetBodyIds) ? [...new Set(feature.targetBodyIds)] : [];
      if (targetBodyIds.length < 2) add(`${base}.targetBodyIds`, 'Stitch wymaga co najmniej dwóch powierzchni.', 'REQUIRED');
      if (targetBodyIds.length !== (feature.targetBodyIds || []).length) add(`${base}.targetBodyIds`, 'Lista powierzchni Stitch zawiera duplikaty.', 'DUPLICATE_ID');
      targetBodyIds.forEach((bodyId, bodyIndex) => {
        if (!surfaceBodyIds.has(bodyId)) add(`${base}.targetBodyIds[${bodyIndex}]`, `Nie znaleziono powierzchni „${bodyId}”.`, 'BROKEN_REFERENCE');
      });
      if (typeof feature.tolerance !== 'string' && typeof feature.tolerance !== 'number') add(`${base}.tolerance`, 'Stitch wymaga parametrycznej tolerancji.', 'TYPE');
      targetBodyIds.forEach((bodyId) => surfaceBodyIds.delete(bodyId));
      const bodyId = `body-${feature.id}`;
      bodyIds.add(bodyId);
      surfaceBodyIds.add(bodyId);
    }

    if (feature.type === 'surfaceTrim') {
      if (!surfaceBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Surface Trim wymaga istniejącej powierzchni.', 'BROKEN_REFERENCE');
      if (!bodyIds.has(feature.toolBodyId) || surfaceBodyIds.has(feature.toolBodyId)) add(`${base}.toolBodyId`, 'Surface Trim wymaga istniejącej bryły tnącej.', 'BROKEN_REFERENCE');
      if (feature.targetBodyId === feature.toolBodyId) add(`${base}.toolBodyId`, 'Powierzchnia i bryła tnąca muszą być różnymi obiektami.', 'VALUE');
      if (feature.keepTool === false) bodyIds.delete(feature.toolBodyId);
    }

    if (feature.type === 'surfaceExtend') {
      if (!surfaceBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Surface Extend wymaga istniejącej powierzchni.', 'BROKEN_REFERENCE');
      if (typeof feature.distance !== 'string' && typeof feature.distance !== 'number') add(`${base}.distance`, 'Surface Extend wymaga parametrycznej odległości.', 'TYPE');
      if (!Array.isArray(feature.referenceIds) || feature.referenceIds.length !== 1) add(`${base}.referenceIds`, 'Surface Extend wymaga dokładnie jednej krawędzi powierzchni.', 'REQUIRED');
      else {
        const edgeReference = references.find((reference) => reference.id === feature.referenceIds[0]);
        if (edgeReference?.kind !== 'topology' || edgeReference.topologyKind !== 'edge' || edgeReference.bodyId !== feature.targetBodyId) add(`${base}.referenceIds[0]`, 'Surface Extend wymaga trwałej referencji krawędzi wybranej powierzchni.', 'UNSUPPORTED');
      }
    }

    if (feature.type === 'thickenSurface') {
      if (!surfaceBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Pogrubienie wymaga wcześniejszej powierzchni Patch, Surface Extrude, Surface Revolve, Surface Sweep albo Surface Loft.', 'BROKEN_REFERENCE');
      if (typeof feature.thickness !== 'string' && typeof feature.thickness !== 'number') add(`${base}.thickness`, 'Pogrubienie wymaga parametrycznej grubości.', 'TYPE');
      if (!['one-side', 'symmetric'].includes(feature.side || 'one-side')) add(`${base}.side`, 'Nieobsługiwana strona pogrubienia powierzchni.', 'UNSUPPORTED');
      surfaceBodyIds.delete(feature.targetBodyId);
    }

    if (feature.type === 'sheetBase') {
      if (!sketchIds.has(feature.sketchId)) add(`${base}.sketchId`, `Nie znaleziono szkicu „${feature.sketchId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.profileIds) || feature.profileIds.length !== 1) add(`${base}.profileIds`, 'Baza blachowa wymaga dokładnie jednego zamkniętego profilu.', 'REQUIRED');
      else if (!profileOwners.has(feature.profileIds[0]) || profileOwners.get(feature.profileIds[0]) !== feature.sketchId) add(`${base}.profileIds[0]`, 'Profil bazy blachowej musi należeć do wskazanego szkicu.', 'BROKEN_REFERENCE');
      if (typeof feature.thickness !== 'string' && typeof feature.thickness !== 'number') add(`${base}.thickness`, 'Baza blachowa wymaga parametrycznej grubości.', 'TYPE');
      if (typeof feature.bendRadius !== 'string' && typeof feature.bendRadius !== 'number') add(`${base}.bendRadius`, 'Reguła blachy wymaga promienia gięcia.', 'TYPE');
      if (typeof feature.kFactor !== 'string' && typeof feature.kFactor !== 'number') add(`${base}.kFactor`, 'Reguła blachy wymaga współczynnika K.', 'TYPE');
      if (!['one-side', 'symmetric'].includes(feature.side || 'one-side')) add(`${base}.side`, 'Nieobsługiwana strona bazy blachowej.', 'UNSUPPORTED');
      const bodyId = `body-${feature.id}`;
      bodyIds.add(bodyId);
      sheetBodyIds.add(bodyId);
    }

    if (feature.type === 'sheetFlange') {
      if (!sheetBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Kołnierz wymaga wcześniejszej bryły blachowej.', 'BROKEN_REFERENCE');
      if (!feature.suppressed && unfoldedSheetBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Kołnierz można dodać dopiero po ponownym zagięciu blachy.', 'SEQUENCE');
      if (!Array.isArray(feature.referenceIds) || feature.referenceIds.length !== 1) add(`${base}.referenceIds`, 'Kołnierz wymaga dokładnie jednej prostej krawędzi blachy.', 'REQUIRED');
      else {
        const edgeReference = references.find((reference) => reference.id === feature.referenceIds[0]);
        if (edgeReference?.kind !== 'topology' || edgeReference.topologyKind !== 'edge' || edgeReference.bodyId !== feature.targetBodyId || edgeReference.descriptor?.geometry !== 'LINE') add(`${base}.referenceIds[0]`, 'Kołnierz wymaga trwałej referencji prostej krawędzi wybranej blachy.', 'UNSUPPORTED');
      }
      if (typeof feature.length !== 'string' && typeof feature.length !== 'number') add(`${base}.length`, 'Kołnierz wymaga parametrycznej długości.', 'TYPE');
      if (typeof feature.angle !== 'string' && typeof feature.angle !== 'number') add(`${base}.angle`, 'Kołnierz wymaga parametrycznego kąta.', 'TYPE');
      if (typeof feature.bendRadius !== 'string' && typeof feature.bendRadius !== 'number') add(`${base}.bendRadius`, 'Kołnierz wymaga promienia gięcia.', 'TYPE');
      if (typeof feature.reverse !== 'boolean') add(`${base}.reverse`, 'Kierunek kołnierza musi być wartością logiczną.', 'TYPE');
    }

    if (feature.type === 'sheetHem' || feature.type === 'sheetRip') {
      const label = feature.type === 'sheetHem' ? 'Zawinięcie' : 'Szczelina';
      if (!sheetBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `${label} wymaga wcześniejszej bryły blachowej.`, 'BROKEN_REFERENCE');
      if (!feature.suppressed && unfoldedSheetBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `${label} można dodać dopiero po ponownym zagięciu blachy.`, 'SEQUENCE');
      if (!Array.isArray(feature.referenceIds) || feature.referenceIds.length !== 1) add(`${base}.referenceIds`, `${label} wymaga dokładnie jednej prostej krawędzi blachy.`, 'REQUIRED');
      else {
        const edgeReference = references.find((reference) => reference.id === feature.referenceIds[0]);
        if (edgeReference?.kind !== 'topology' || edgeReference.topologyKind !== 'edge' || edgeReference.bodyId !== feature.targetBodyId || edgeReference.descriptor?.geometry !== 'LINE') add(`${base}.referenceIds[0]`, `${label} wymaga trwałej referencji prostej krawędzi wybranej blachy.`, 'UNSUPPORTED');
      }
      if (typeof feature.gap !== 'string' && typeof feature.gap !== 'number') add(`${base}.gap`, `${label} wymaga parametrycznej szerokości szczeliny.`, 'TYPE');
      if (feature.type === 'sheetHem' && typeof feature.length !== 'string' && typeof feature.length !== 'number') add(`${base}.length`, 'Zawinięcie wymaga parametrycznej długości zakładki.', 'TYPE');
      if (feature.type === 'sheetHem' && typeof feature.reverse !== 'boolean') add(`${base}.reverse`, 'Kierunek zawinięcia musi być wartością logiczną.', 'TYPE');
    }

    if (feature.type === 'sheetUnfold' || feature.type === 'sheetRefold') {
      const label = feature.type === 'sheetUnfold' ? 'Rozwinięcie' : 'Ponowne zagięcie';
      if (!sheetBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `${label} wymaga wcześniejszej bryły blachowej.`, 'BROKEN_REFERENCE');
      if (feature.suppressed) {
        // Wyłączona operacja nie zmienia bieżącego stanu blachy na osi czasu.
      } else if (feature.type === 'sheetUnfold') {
        if (unfoldedSheetBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Blacha jest już rozwinięta.', 'SEQUENCE');
        unfoldedSheetBodyIds.add(feature.targetBodyId);
      } else {
        if (!unfoldedSheetBodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Ponowne zagięcie wymaga wcześniejszego rozwinięcia.', 'SEQUENCE');
        unfoldedSheetBodyIds.delete(feature.targetBodyId);
      }
    }

    if (feature.type === 'extrude') {
      if (!sketchIds.has(feature.sketchId)) add(`${base}.sketchId`, `Nie znaleziono szkicu „${feature.sketchId ?? ''}”.`, 'BROKEN_REFERENCE');
      const hasOpenChain = feature.thin && Array.isArray(feature.openEntityIds) && feature.openEntityIds.length > 0;
      if (hasOpenChain) feature.openEntityIds.forEach((entityId, entityIndex) => {
        const owner = entityOwners.get(entityId);
        if (!owner) add(`${base}.openEntityIds[${entityIndex}]`, `Nie znaleziono encji „${entityId}”.`, 'BROKEN_REFERENCE');
        else if (owner.sketchId !== feature.sketchId) add(`${base}.openEntityIds[${entityIndex}]`, `Encja „${entityId}” nie należy do szkicu „${feature.sketchId}”.`, 'BROKEN_REFERENCE');
        else if (owner.type !== 'line') add(`${base}.openEntityIds[${entityIndex}]`, 'Otwarty Thin Extrude obsługuje obecnie połączone linie.', 'UNSUPPORTED');
      });
      else if (!Array.isArray(feature.profileIds) || !feature.profileIds.length) add(`${base}.profileIds`, 'Wyciągnięcie wymaga co najmniej jednego profilu albo otwartego łańcucha Thin Extrude.', 'REQUIRED');
      else feature.profileIds.forEach((profileId, profileIndex) => {
        if (!profileOwners.has(profileId)) add(`${base}.profileIds[${profileIndex}]`, `Nie znaleziono profilu „${profileId}”.`, 'BROKEN_REFERENCE');
        else if (profileOwners.get(profileId) !== feature.sketchId) add(`${base}.profileIds[${profileIndex}]`, `Profil „${profileId}” nie należy do szkicu „${feature.sketchId}”.`, 'BROKEN_REFERENCE');
      });
      if (!['new', 'join', 'cut', 'intersect'].includes(feature.operation)) add(`${base}.operation`, `Nieobsługiwana operacja: ${feature.operation ?? ''}.`, 'UNSUPPORTED');
      const extent = feature.extent || 'one-side';
      if (!['one-side', 'two-sides', 'symmetric', 'through-all', 'to-object'].includes(extent)) add(`${base}.extent`, `Nieobsługiwany zakres wyciągnięcia: ${extent}.`, 'UNSUPPORTED');
      if (extent === 'through-all' && !['cut', 'intersect'].includes(feature.operation)) add(`${base}.extent`, 'Through All jest dostępne dla Cut i Intersect.', 'UNSUPPORTED');
      if (extent === 'two-sides' && feature.secondDistance === undefined) add(`${base}.secondDistance`, 'Wyciągnięcie na dwie strony wymaga drugiej odległości.', 'REQUIRED');
      if (extent === 'to-object') {
        const targetReference = references.find((reference) => reference.id === feature.targetReferenceId);
        if (!targetReference) add(`${base}.targetReferenceId`, `Nie znaleziono obiektu docelowego „${feature.targetReferenceId ?? ''}”.`, 'BROKEN_REFERENCE');
        else if (targetReference.kind !== 'construction-plane' && !(targetReference.kind === 'topology' && targetReference.topologyKind === 'face' && targetReference.descriptor?.geometry === 'PLANE')) add(`${base}.targetReferenceId`, 'Obiektem docelowym musi być płaszczyzna konstrukcyjna albo planarna ściana.', 'UNSUPPORTED');
        else if (targetReference.kind === 'topology' && ![targetReference.descriptor?.center, targetReference.descriptor?.normal].every((vector) => Array.isArray(vector) && vector.length === 3 && vector.every((value) => Number.isFinite(value)))) add(`${base}.targetReferenceId`, 'Planarna ściana docelowa wymaga prawidłowego środka i normalnej 3D.', 'TYPE');
      }
      if (feature.startOffset !== undefined && typeof feature.startOffset !== 'string' && typeof feature.startOffset !== 'number') add(`${base}.startOffset`, 'Odsunięcie początku wyciągnięcia musi być wyrażeniem albo liczbą.', 'TYPE');
      if (feature.thin !== undefined && typeof feature.thin !== 'boolean') add(`${base}.thin`, 'Tryb cienkościenny musi być wartością logiczną.', 'TYPE');
      if (feature.thin) {
        if (typeof feature.wallThickness !== 'string' && typeof feature.wallThickness !== 'number') add(`${base}.wallThickness`, 'Thin Extrude wymaga parametrycznej grubości ścianki.', 'TYPE');
        if (!['inside', 'outside', 'symmetric'].includes(feature.wallSide)) add(`${base}.wallSide`, 'Nieobsługiwana strona grubości Thin Extrude.', 'UNSUPPORTED');
        if (hasOpenChain && !['butt', 'square'].includes(feature.endCap || 'butt')) add(`${base}.endCap`, 'Nieobsługiwane zakończenie otwartego Thin Extrude.', 'UNSUPPORTED');
      }
      if (feature.operation === 'new') bodyIds.add(`body-${feature.id}`);
      else if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono wcześniejszej bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
    }

    if (feature.type === 'revolve') {
      if (!sketchIds.has(feature.sketchId)) add(`${base}.sketchId`, `Nie znaleziono szkicu „${feature.sketchId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.profileIds) || feature.profileIds.length !== 1) add(`${base}.profileIds`, 'Revolve wymaga dokładnie jednego zamkniętego profilu.', 'REQUIRED');
      else if (!profileOwners.has(feature.profileIds[0]) || profileOwners.get(feature.profileIds[0]) !== feature.sketchId) add(`${base}.profileIds[0]`, 'Profil Revolve musi należeć do wskazanego szkicu.', 'BROKEN_REFERENCE');
      const axisReference = references.find((reference) => reference.id === feature.axisId);
      if (!['X_AXIS', 'Y_AXIS', 'Z_AXIS'].includes(feature.axisId) && axisReference?.kind !== 'construction-axis') add(`${base}.axisId`, `Nie znaleziono osi obrotu „${feature.axisId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (typeof feature.angle !== 'string' && typeof feature.angle !== 'number') add(`${base}.angle`, 'Revolve wymaga parametrycznego kąta.', 'TYPE');
      if (!['new', 'join', 'cut', 'intersect'].includes(feature.operation)) add(`${base}.operation`, `Nieobsługiwana operacja Revolve: ${feature.operation ?? ''}.`, 'UNSUPPORTED');
      if (feature.operation === 'new') bodyIds.add(`body-${feature.id}`);
      else if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono wcześniejszej bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
    }

    if (feature.type === 'sweep') {
      if (!sketchIds.has(feature.sketchId) || !sketchIds.has(feature.pathSketchId)) add(`${base}.sketchId`, 'Sweep wymaga szkicu profilu i osobnego szkicu ścieżki.', 'BROKEN_REFERENCE');
      if (feature.sketchId === feature.pathSketchId) add(`${base}.pathSketchId`, 'Profil i ścieżka Sweep muszą należeć do różnych szkiców.', 'VALUE');
      if (!Array.isArray(feature.profileIds) || feature.profileIds.length !== 1 || profileOwners.get(feature.profileIds[0]) !== feature.sketchId) add(`${base}.profileIds`, 'Sweep wymaga jednego zamkniętego profilu.', 'REQUIRED');
      if (!Array.isArray(feature.pathEntityIds) || !feature.pathEntityIds.length) add(`${base}.pathEntityIds`, 'Sweep wymaga ciągłej ścieżki z linii szkicu.', 'REQUIRED');
      else feature.pathEntityIds.forEach((entityId, index) => {
        const owner = entityOwners.get(entityId);
        if (!owner || owner.sketchId !== feature.pathSketchId || owner.type !== 'line') add(`${base}.pathEntityIds[${index}]`, 'Ścieżka Sweep musi składać się z linii wskazanego szkicu.', 'UNSUPPORTED');
      });
      if (!['new', 'join', 'cut', 'intersect'].includes(feature.operation)) add(`${base}.operation`, `Nieobsługiwana operacja Sweep: ${feature.operation ?? ''}.`, 'UNSUPPORTED');
      if (feature.operation === 'new') bodyIds.add(`body-${feature.id}`);
      else if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Nie znaleziono bryły docelowej Sweep.', 'BROKEN_REFERENCE');
    }

    if (feature.type === 'loft') {
      if (!Array.isArray(feature.profileIds) || feature.profileIds.length < 2) add(`${base}.profileIds`, 'Loft wymaga co najmniej dwóch zamkniętych profili.', 'REQUIRED');
      if (!Array.isArray(feature.sketchIds) || feature.sketchIds.length !== feature.profileIds?.length) add(`${base}.sketchIds`, 'Loft wymaga szkicu dla każdego profilu.', 'REQUIRED');
      else {
        if (new Set(feature.sketchIds).size !== feature.sketchIds.length) add(`${base}.sketchIds`, 'Każdy profil Loft musi należeć do osobnego szkicu.', 'VALUE');
        feature.profileIds?.forEach((profileId, index) => {
          if (!profileOwners.has(profileId) || profileOwners.get(profileId) !== feature.sketchIds[index]) add(`${base}.profileIds[${index}]`, 'Profil Loft musi należeć do odpowiadającego mu szkicu.', 'BROKEN_REFERENCE');
        });
      }
      if (feature.sketchId !== feature.sketchIds?.[0]) add(`${base}.sketchId`, 'Pierwszy szkic Loft musi być szkicem źródłowym.', 'VALUE');
      if (!['smooth', 'ruled'].includes(feature.loftMode || 'smooth')) add(`${base}.loftMode`, 'Nieobsługiwany tryb Loft.', 'UNSUPPORTED');
      if (!['new', 'join', 'cut', 'intersect'].includes(feature.operation)) add(`${base}.operation`, `Nieobsługiwana operacja Loft: ${feature.operation ?? ''}.`, 'UNSUPPORTED');
      if (feature.operation === 'new') bodyIds.add(`body-${feature.id}`);
      else if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Nie znaleziono bryły docelowej Loft.', 'BROKEN_REFERENCE');
    }

    if (feature.type === 'rib') {
      if (!sketchIds.has(feature.sketchId)) add(`${base}.sketchId`, 'Rib/Web wymaga szkicu źródłowego.', 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.openEntityIds) || !feature.openEntityIds.length) add(`${base}.openEntityIds`, 'Rib/Web wymaga otwartego łańcucha linii.', 'REQUIRED');
      else feature.openEntityIds.forEach((entityId, index) => {
        const owner = entityOwners.get(entityId);
        if (!owner || owner.sketchId !== feature.sketchId || owner.type !== 'line') add(`${base}.openEntityIds[${index}]`, 'Rib/Web obsługuje połączone linie wskazanego szkicu.', 'UNSUPPORTED');
      });
      if (!['rib', 'web'].includes(feature.ribMode || 'web')) add(`${base}.ribMode`, 'Nieobsługiwany typ Rib/Web.', 'UNSUPPORTED');
      if (typeof feature.thickness !== 'string' && typeof feature.thickness !== 'number') add(`${base}.thickness`, 'Rib/Web wymaga parametrycznej grubości.', 'TYPE');
      if (typeof feature.depth !== 'string' && typeof feature.depth !== 'number') add(`${base}.depth`, 'Rib/Web wymaga parametrycznego zasięgu.', 'TYPE');
      if (!['inside', 'outside', 'symmetric'].includes(feature.wallSide || 'symmetric')) add(`${base}.wallSide`, 'Nieobsługiwana strona Rib/Web.', 'UNSUPPORTED');
      if (typeof feature.reverse !== 'boolean') add(`${base}.reverse`, 'Kierunek Rib/Web musi być wartością logiczną.', 'TYPE');
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Rib/Web wymaga wcześniejszej bryły docelowej.', 'BROKEN_REFERENCE');
    }

    if (feature.type === 'coil') {
      const axisReference = references.find((reference) => reference.id === feature.axisId);
      if (!['X_AXIS', 'Y_AXIS', 'Z_AXIS'].includes(feature.axisId) && axisReference?.kind !== 'construction-axis') add(`${base}.axisId`, 'Coil wymaga osi bazowej albo konstrukcyjnej.', 'BROKEN_REFERENCE');
      for (const [key, label] of [['coilDiameter', 'średnicy'], ['wireDiameter', 'średnicy przekroju'], ['pitch', 'skoku'], ['turns', 'liczby zwojów']]) if (typeof feature[key] !== 'string' && typeof feature[key] !== 'number') add(`${base}.${key}`, `Coil wymaga parametrycznej ${label}.`, 'TYPE');
      if (!['right', 'left'].includes(feature.handedness || 'right')) add(`${base}.handedness`, 'Nieobsługiwany kierunek Coil.', 'UNSUPPORTED');
      if (!['new', 'join', 'cut', 'intersect'].includes(feature.operation)) add(`${base}.operation`, 'Nieobsługiwana operacja Coil.', 'UNSUPPORTED');
      if (feature.operation === 'new') bodyIds.add(`body-${feature.id}`);
      else if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Nie znaleziono bryły docelowej Coil.', 'BROKEN_REFERENCE');
    }

    if (feature.type === 'pipe') {
      if (!sketchIds.has(feature.pathSketchId)) add(`${base}.pathSketchId`, 'Pipe wymaga szkicu ścieżki.', 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.pathEntityIds) || !feature.pathEntityIds.length) add(`${base}.pathEntityIds`, 'Pipe wymaga otwartego łańcucha linii.', 'REQUIRED');
      else feature.pathEntityIds.forEach((entityId, index) => {
        const owner = entityOwners.get(entityId);
        if (!owner || owner.sketchId !== feature.pathSketchId || owner.type !== 'line') add(`${base}.pathEntityIds[${index}]`, 'Pipe obsługuje połączone linie wskazanego szkicu.', 'UNSUPPORTED');
      });
      for (const [key, label] of [['outsideDiameter', 'średnicy zewnętrznej'], ['wallThickness', 'grubości ścianki']]) if (typeof feature[key] !== 'string' && typeof feature[key] !== 'number') add(`${base}.${key}`, `Pipe wymaga parametrycznej ${label}.`, 'TYPE');
      if (!['new', 'join', 'cut', 'intersect'].includes(feature.operation)) add(`${base}.operation`, 'Nieobsługiwana operacja Pipe.', 'UNSUPPORTED');
      if (feature.operation === 'new') bodyIds.add(`body-${feature.id}`);
      else if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Nie znaleziono bryły docelowej Pipe.', 'BROKEN_REFERENCE');
    }

    if (feature.type === 'pattern') {
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, 'Pattern wymaga wcześniejszej bryły docelowej.', 'BROKEN_REFERENCE');
      if (!['rectangular', 'circular', 'path'].includes(feature.patternType)) add(`${base}.patternType`, 'Nieobsługiwany typ Pattern.', 'UNSUPPORTED');
      if (feature.patternType === 'rectangular') for (const key of ['countX', 'countY', 'spacingX', 'spacingY']) if (typeof feature[key] !== 'string' && typeof feature[key] !== 'number') add(`${base}.${key}`, 'Pattern prostokątny wymaga parametrycznych ilości i odstępów.', 'TYPE');
      if (feature.patternType === 'circular') {
        const axisReference = references.find((reference) => reference.id === feature.axisId);
        if (!['X_AXIS', 'Y_AXIS', 'Z_AXIS'].includes(feature.axisId) && axisReference?.kind !== 'construction-axis') add(`${base}.axisId`, 'Pattern kołowy wymaga osi.', 'BROKEN_REFERENCE');
        for (const key of ['occurrences', 'totalAngle']) if (typeof feature[key] !== 'string' && typeof feature[key] !== 'number') add(`${base}.${key}`, 'Pattern kołowy wymaga liczby wystąpień i kąta.', 'TYPE');
      }
      if (feature.patternType === 'path') {
        if (!sketchIds.has(feature.pathSketchId)) add(`${base}.pathSketchId`, 'Pattern po ścieżce wymaga szkicu.', 'BROKEN_REFERENCE');
        if (!Array.isArray(feature.pathEntityIds) || !feature.pathEntityIds.length) add(`${base}.pathEntityIds`, 'Pattern po ścieżce wymaga łańcucha linii.', 'REQUIRED');
        if (typeof feature.occurrences !== 'string' && typeof feature.occurrences !== 'number') add(`${base}.occurrences`, 'Pattern po ścieżce wymaga liczby wystąpień.', 'TYPE');
      }
    }

    if (feature.type === 'primitive') {
      if (!['box', 'cylinder', 'sphere', 'torus'].includes(feature.primitiveType)) add(`${base}.primitiveType`, `Nieobsługiwany prymityw: ${feature.primitiveType ?? ''}.`, 'UNSUPPORTED');
      bodyIds.add(`body-${feature.id}`);
    }

    if (feature.type === 'importedModel') {
      if (!['step', 'stl'].includes(feature.importFormat)) add(`${base}.importFormat`, 'Import kernela obsługuje STEP albo STL.', 'UNSUPPORTED');
      if (!['step', 'stl', '3mf'].includes(feature.originalFormat)) add(`${base}.originalFormat`, 'Nieobsługiwany format źródłowy.', 'UNSUPPORTED');
      if (typeof feature.dataBase64 !== 'string' || !feature.dataBase64.length) add(`${base}.dataBase64`, 'Brak danych modelu importowanego.', 'REQUIRED');
      if (!Number.isFinite(Number(feature.unitScale)) || Number(feature.unitScale) <= 0) add(`${base}.unitScale`, 'Skala jednostki musi być dodatnia.', 'VALUE');
      if (feature.linkedProjectId !== undefined && !linkedProjectIds.has(feature.linkedProjectId)) add(`${base}.linkedProjectId`, 'Operacja proxy wskazuje brakujące łącze projektu.', 'BROKEN_REFERENCE');
      bodyIds.add(`body-${feature.id}`);
    }

    if (feature.type === 'textSolid') {
      if (typeof feature.text !== 'string' || !feature.text.trim()) add(`${base}.text`, 'Tekst 3D nie może być pusty.', 'REQUIRED');
      if (feature.text?.length > 80) add(`${base}.text`, 'Tekst 3D może mieć najwyżej 80 znaków.', 'VALUE');
      if (!['new', 'emboss', 'deboss'].includes(feature.operation)) add(`${base}.operation`, `Nieobsługiwana operacja tekstu: ${feature.operation ?? ''}.`, 'UNSUPPORTED');
      if (feature.operation === 'new') bodyIds.add(`body-${feature.id}`);
      else if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły docelowej „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (feature.placement === 'face') {
        const faceReference = references.find((reference) => reference.id === feature.referenceIds?.[0]);
        if (faceReference?.kind !== 'topology' || faceReference.topologyKind !== 'face' || faceReference.descriptor?.geometry !== 'PLANE') add(`${base}.referenceIds`, 'Emboss/Deboss na powierzchni wymaga trwałej referencji planarnej ściany.', 'BROKEN_REFERENCE');
      }
    }

    if (feature.type === 'transform') {
      if (!['move', 'rotate'].includes(feature.mode)) add(`${base}.mode`, `Nieobsługiwana transformacja: ${feature.mode ?? ''}.`, 'UNSUPPORTED');
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
    }

    if (feature.type === 'boolean') {
      if (!['union', 'subtract', 'intersect'].includes(feature.operation)) add(`${base}.operation`, `Nieobsługiwana operacja Boolean: ${feature.operation ?? ''}.`, 'UNSUPPORTED');
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły bazowej „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!bodyIds.has(feature.toolBodyId)) add(`${base}.toolBodyId`, `Nie znaleziono bryły narzędziowej „${feature.toolBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (feature.targetBodyId === feature.toolBodyId) add(`${base}.toolBodyId`, 'Boolean wymaga dwóch różnych brył.', 'VALUE');
      if (bodyIds.has(feature.toolBodyId) && feature.toolBodyId !== feature.targetBodyId) bodyIds.delete(feature.toolBodyId);
    }

    if (feature.type === 'hole') {
      const holeType = feature.holeType || 'simple';
      const holeExtent = feature.extent || 'distance';
      const threadMode = feature.threadMode || 'none';
      const clearanceProfile = feature.clearanceProfile || 'nominal';
      if (!['simple', 'counterbore', 'countersink'].includes(holeType)) add(`${base}.holeType`, `Nieobsługiwany typ otworu: ${holeType}.`, 'UNSUPPORTED');
      if (!['distance', 'through-all'].includes(holeExtent)) add(`${base}.extent`, `Nieobsługiwany zakres otworu: ${holeExtent}.`, 'UNSUPPORTED');
      if (holeExtent === 'distance' && feature.depth === undefined) add(`${base}.depth`, 'Otwór Distance wymaga głębokości.', 'REQUIRED');
      if (holeType === 'counterbore' && (feature.counterboreDiameter === undefined || feature.counterboreDepth === undefined)) add(`${base}.counterboreDiameter`, 'Counterbore wymaga średnicy i głębokości pogłębienia.', 'REQUIRED');
      if (holeType === 'countersink' && (feature.countersinkDiameter === undefined || feature.countersinkAngle === undefined)) add(`${base}.countersinkDiameter`, 'Countersink wymaga średnicy i kąta pogłębienia.', 'REQUIRED');
      if (!['none', 'cosmetic', 'modeled'].includes(threadMode)) add(`${base}.threadMode`, `Nieobsługiwany tryb gwintu: ${threadMode}.`, 'UNSUPPORTED');
      if (threadMode !== 'none' && (feature.threadDiameter === undefined || feature.threadPitch === undefined || feature.threadLength === undefined)) add(`${base}.threadDiameter`, 'Gwint wymaga średnicy, skoku i długości.', 'REQUIRED');
      if (threadMode !== 'none' && !['right', 'left'].includes(feature.threadDirection)) add(`${base}.threadDirection`, 'Kierunek gwintu musi być prawy albo lewy.', 'UNSUPPORTED');
      if (!['nominal', 'fff'].includes(clearanceProfile)) add(`${base}.clearanceProfile`, `Nieobsługiwany profil luzu: ${clearanceProfile}.`, 'UNSUPPORTED');
      if (clearanceProfile === 'fff' && feature.clearance === undefined) add(`${base}.clearance`, 'Profil FFF wymaga luzu promieniowego.', 'REQUIRED');
      for (const error of validateHoleStandard(feature)) add(`${base}.${error.field}`, error.message, 'VALUE');
      if (feature.placement === 'face-edges') {
        if (!Array.isArray(feature.referenceIds) || feature.referenceIds.length !== 3) add(`${base}.referenceIds`, 'Otwór od krawędzi wymaga jednej ściany i dwóch krawędzi.', 'REQUIRED');
      } else {
        if (!sketchIds.has(feature.sketchId)) add(`${base}.sketchId`, `Nie znaleziono szkicu „${feature.sketchId ?? ''}”.`, 'BROKEN_REFERENCE');
        if (feature.pointId) {
          const owner = entityOwners.get(feature.pointId);
          if (!owner || owner.type !== 'point') add(`${base}.pointId`, `Nie znaleziono punktu „${feature.pointId}”.`, 'BROKEN_REFERENCE');
          else if (owner.sketchId !== feature.sketchId) add(`${base}.pointId`, `Punkt „${feature.pointId}” nie należy do szkicu „${feature.sketchId}”.`, 'BROKEN_REFERENCE');
        } else {
          if (!profileOwners.has(feature.profileId)) add(`${base}.profileId`, `Nie znaleziono profilu „${feature.profileId ?? ''}”.`, 'BROKEN_REFERENCE');
          else if (profileOwners.get(feature.profileId) !== feature.sketchId) add(`${base}.profileId`, `Profil „${feature.profileId}” nie należy do szkicu „${feature.sketchId}”.`, 'BROKEN_REFERENCE');
        }
      }
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono wcześniejszej bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
    }

    if (['fillet', 'chamfer', 'shell'].includes(feature.type) && !bodyIds.has(feature.targetBodyId)) {
      add(`${base}.targetBodyId`, `Nie znaleziono wcześniejszej bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
    }
    if (feature.type === 'shell' && (!Array.isArray(feature.referenceIds) || !feature.referenceIds.length)) {
      add(`${base}.referenceIds`, 'Shell wymaga co najmniej jednej usuwanej ściany.', 'REQUIRED');
    }
    if (feature.type === 'draft') {
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.referenceIds) || !feature.referenceIds.length) add(`${base}.referenceIds`, 'Draft wymaga co najmniej jednej wskazanej ściany.', 'REQUIRED');
      if (typeof feature.angle !== 'string' && typeof feature.angle !== 'number') add(`${base}.angle`, 'Draft wymaga parametrycznego kąta.', 'TYPE');
      const neutralPlane = references.find((reference) => reference.id === feature.neutralPlaneId);
      if (!SUPPORTED_PLANES.has(feature.neutralPlaneId) && neutralPlane?.kind !== 'construction-plane') add(`${base}.neutralPlaneId`, `Nie znaleziono płaszczyzny neutralnej „${feature.neutralPlaneId ?? ''}”.`, 'BROKEN_REFERENCE');
    }
    if (feature.type === 'splitBody') {
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      const splitPlane = references.find((reference) => reference.id === feature.planeId);
      if (!SUPPORTED_PLANES.has(feature.planeId) && splitPlane?.kind !== 'construction-plane') add(`${base}.planeId`, `Nie znaleziono płaszczyzny podziału „${feature.planeId ?? ''}”.`, 'BROKEN_REFERENCE');
      bodyIds.add(`body-${feature.id}`);
    }
    if (feature.type === 'splitFace') {
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      const ownerSketchId = profileOwners.get(feature.profileId);
      if (!ownerSketchId) add(`${base}.profileId`, `Nie znaleziono profilu „${feature.profileId ?? ''}”.`, 'BROKEN_REFERENCE');
      else if (ownerSketchId !== feature.sketchId) add(`${base}.profileId`, `Profil „${feature.profileId}” nie należy do szkicu „${feature.sketchId ?? ''}”.`, 'BROKEN_REFERENCE');
      const sketch = document.sketches.find((item) => item.id === feature.sketchId);
      if (sketch?.support?.kind !== 'face') add(`${base}.sketchId`, 'Split Face wymaga szkicu założonego na planarnej ścianie.', 'UNSUPPORTED');
      if (!Array.isArray(feature.referenceIds) || feature.referenceIds.length !== 1) add(`${base}.referenceIds`, 'Split Face wymaga dokładnie jednej referencji ściany.', 'REQUIRED');
      else {
        const faceReference = references.find((reference) => reference.id === feature.referenceIds[0]);
        if (faceReference?.kind !== 'topology' || faceReference.topologyKind !== 'face' || faceReference.descriptor?.geometry !== 'PLANE') add(`${base}.referenceIds[0]`, 'Split Face wymaga trwałej referencji planarnej ściany.', 'UNSUPPORTED');
        else if (faceReference.bodyId !== feature.targetBodyId) add(`${base}.targetBodyId`, 'Dzielona ściana musi należeć do bryły docelowej Split Face.', 'VALUE');
        if (sketch?.support?.referenceId !== feature.referenceIds[0]) add(`${base}.referenceIds[0]`, 'Profil Split Face musi należeć do szkicu na dzielonej ścianie.', 'VALUE');
      }
    }
    if (feature.type === 'deleteFace') {
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.referenceIds) || !feature.referenceIds.length) add(`${base}.referenceIds`, 'Delete Face + Heal wymaga co najmniej jednej referencji ściany.', 'REQUIRED');
      else feature.referenceIds.forEach((referenceId, referenceIndex) => {
        const faceReference = references.find((reference) => reference.id === referenceId);
        if (faceReference?.kind !== 'topology' || faceReference.topologyKind !== 'face') add(`${base}.referenceIds[${referenceIndex}]`, 'Delete Face + Heal wymaga trwałych referencji ścian.', 'UNSUPPORTED');
        else if (faceReference.bodyId !== feature.targetBodyId) add(`${base}.referenceIds[${referenceIndex}]`, 'Usuwana ściana musi należeć do bryły docelowej.', 'VALUE');
      });
    }
    if (feature.type === 'replaceFace') {
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.referenceIds) || feature.referenceIds.length !== 2) add(`${base}.referenceIds`, 'Replace Face wymaga ściany zastępowanej i powierzchni docelowej.', 'REQUIRED');
      else {
        const sourceReference = references.find((reference) => reference.id === feature.referenceIds[0]);
        const destinationReference = references.find((reference) => reference.id === feature.referenceIds[1]);
        for (const [index, reference] of [sourceReference, destinationReference].entries()) {
          if (reference?.kind !== 'topology' || reference.topologyKind !== 'face' || reference.descriptor?.geometry !== 'PLANE') add(`${base}.referenceIds[${index}]`, 'Replace Face wymaga dwóch trwałych referencji planarnych ścian.', 'UNSUPPORTED');
        }
        if (sourceReference?.bodyId !== feature.targetBodyId) add(`${base}.referenceIds[0]`, 'Pierwsza ściana musi należeć do modyfikowanej bryły.', 'VALUE');
        if (!destinationReference?.bodyId || destinationReference.bodyId === feature.targetBodyId || !bodyIds.has(destinationReference.bodyId)) add(`${base}.referenceIds[1]`, 'Powierzchnia docelowa musi należeć do innej istniejącej bryły.', 'VALUE');
        if (feature.referenceIds[0] === feature.referenceIds[1]) add(`${base}.referenceIds`, 'Ściana zastępowana i powierzchnia docelowa muszą być różne.', 'VALUE');
      }
    }
    if (feature.type === 'offsetFace') {
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.referenceIds) || feature.referenceIds.length !== 1) add(`${base}.referenceIds`, 'Offset Face wymaga dokładnie jednej planarnej ściany.', 'REQUIRED');
    }
  });

  const timelineFeatureIds = new Set(features.filter(isRecord).map((feature) => feature.id));
  if (typeof document.timelineRollbackFeatureId !== 'string') add('timelineRollbackFeatureId', 'Marker rollback musi być identyfikatorem tekstowym.', 'TYPE');
  else if (document.timelineRollbackFeatureId && !timelineFeatureIds.has(document.timelineRollbackFeatureId)) add('timelineRollbackFeatureId', 'Marker rollback wskazuje brakującą operację.', 'BROKEN_REFERENCE');
  const groupedFeatureIds = new Set();
  const featureGroupNames = new Set();
  featureGroups.forEach((group, groupIndex) => {
    const base = `featureGroups[${groupIndex}]`;
    if (!isRecord(group)) {
      add(base, 'Grupa historii musi być obiektem.', 'TYPE');
      return;
    }
    registerId(group.id, `${base}.id`);
    if (typeof group.name !== 'string' || !group.name.trim()) add(`${base}.name`, 'Grupa historii wymaga nazwy.', 'REQUIRED');
    else if (featureGroupNames.has(group.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa grupy historii: ${group.name}`, 'DUPLICATE');
    else featureGroupNames.add(group.name.toLocaleLowerCase());
    const members = requireArray(group, 'featureIds', `${base}.featureIds`);
    if (!members.length) add(`${base}.featureIds`, 'Grupa historii wymaga co najmniej jednej operacji.', 'VALUE');
    if (new Set(members).size !== members.length) add(`${base}.featureIds`, 'Operacja może wystąpić w grupie tylko raz.', 'DUPLICATE');
    const indices = [];
    members.forEach((featureId, memberIndex) => {
      const featureIndex = features.findIndex((feature) => feature?.id === featureId);
      if (featureIndex < 0) add(`${base}.featureIds[${memberIndex}]`, `Nie znaleziono operacji „${featureId}”.`, 'BROKEN_REFERENCE');
      else indices.push(featureIndex);
      if (groupedFeatureIds.has(featureId)) add(`${base}.featureIds[${memberIndex}]`, 'Operacja należy już do innej grupy historii.', 'DUPLICATE');
      else groupedFeatureIds.add(featureId);
    });
    if (indices.some((index, position) => position > 0 && index <= indices[position - 1])) add(`${base}.featureIds`, 'Kolejność operacji grupy musi odpowiadać osi czasu.', 'VALUE');
    indices.sort((first, second) => first - second);
    if (indices.some((index, position) => position > 0 && index !== indices[position - 1] + 1)) add(`${base}.featureIds`, 'Operacje grupy historii muszą być ciągłe.', 'VALUE');
    if (typeof group.collapsed !== 'boolean') add(`${base}.collapsed`, 'Stan zwinięcia grupy musi być logiczny.', 'TYPE');
  });
  const rollbackGroup = featureGroups.find((group) => isRecord(group) && Array.isArray(group.featureIds) && group.featureIds.includes(document.timelineRollbackFeatureId));
  if (rollbackGroup && rollbackGroup.featureIds.at(-1) !== document.timelineRollbackFeatureId) add('timelineRollbackFeatureId', 'Marker rollback należący do grupy musi znajdować się za jej ostatnią operacją.', 'VALUE');

  const componentNames = new Set();
  const componentPartNumbers = new Set();
  const componentParents = new Map();
  const bodyOwners = new Map();
  components.forEach((component, index) => {
    if (!isRecord(component)) return;
    const base = `components[${index}]`;
    if (typeof component.name !== 'string' || !component.name.trim()) add(`${base}.name`, 'Komponent wymaga nazwy.', 'REQUIRED');
    else if (componentNames.has(component.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa komponentu: ${component.name}`, 'DUPLICATE');
    else componentNames.add(component.name.toLocaleLowerCase());
    if (!COMPONENT_TYPES.includes(component.type)) add(`${base}.type`, 'Typ komponentu musi mieć wartość part albo assembly.', 'UNSUPPORTED');
    if (typeof component.partNumber !== 'string' || !component.partNumber.trim()) add(`${base}.partNumber`, 'Komponent wymaga numeru części.', 'REQUIRED');
    else if (componentPartNumbers.has(component.partNumber.toLocaleLowerCase())) add(`${base}.partNumber`, `Powtórzony numer części: ${component.partNumber}`, 'DUPLICATE');
    else componentPartNumbers.add(component.partNumber.toLocaleLowerCase());
    if (typeof component.description !== 'string') add(`${base}.description`, 'Opis komponentu musi być tekstem.', 'TYPE');
    if (typeof component.material !== 'string') add(`${base}.material`, 'Materiał komponentu musi być tekstem.', 'TYPE');
    if (component.appearance !== undefined) {
      if (!isRecord(component.appearance)) add(`${base}.appearance`, 'Wygląd komponentu musi być obiektem.', 'TYPE');
      else {
        if (typeof component.appearance.preset !== 'string') add(`${base}.appearance.preset`, 'Preset wyglądu musi być tekstem.', 'TYPE');
        if (typeof component.appearance.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(component.appearance.color)) add(`${base}.appearance.color`, 'Kolor wyglądu musi mieć format #RRGGBB.', 'FORMAT');
        for (const property of ['metalness', 'roughness']) if (!Number.isFinite(Number(component.appearance[property])) || Number(component.appearance[property]) < 0 || Number(component.appearance[property]) > 1) add(`${base}.appearance.${property}`, `${property} musi mieścić się w zakresie 0–1.`, 'VALUE');
      }
    }
    if (!Number.isInteger(Number(component.quantity)) || Number(component.quantity) < 1 || Number(component.quantity) > 9999) add(`${base}.quantity`, 'Ilość komponentu musi mieścić się między 1 i 9999.', 'VALUE');
    if (!isRecord(component.origin) || ['x', 'y', 'z'].some((axis) => !Number.isFinite(Number(component.origin?.[axis])))) add(`${base}.origin`, 'Początek komponentu wymaga liczbowych współrzędnych X, Y i Z.', 'TYPE');
    if (component.linkedProjectId && !linkedProjectIds.has(component.linkedProjectId)) add(`${base}.linkedProjectId`, 'Komponent wskazuje brakujące łącze projektu.', 'BROKEN_REFERENCE');
    const ownedBodyIds = requireArray(component, 'bodyIds', `${base}.bodyIds`);
    const ownedSketchIds = requireArray(component, 'sketchIds', `${base}.sketchIds`);
    const childIds = requireArray(component, 'componentIds', `${base}.componentIds`);
    if (new Set(ownedBodyIds).size !== ownedBodyIds.length) add(`${base}.bodyIds`, 'Bryła może wystąpić w komponencie tylko raz.', 'DUPLICATE');
    if (new Set(ownedSketchIds).size !== ownedSketchIds.length) add(`${base}.sketchIds`, 'Szkic może wystąpić w komponencie tylko raz.', 'DUPLICATE');
    if (new Set(childIds).size !== childIds.length) add(`${base}.componentIds`, 'Podkomponent może wystąpić w złożeniu tylko raz.', 'DUPLICATE');
    if (component.type === 'part' && childIds.length) add(`${base}.componentIds`, 'Część nie może zawierać podkomponentów; użyj typu assembly.', 'VALUE');
    ownedBodyIds.forEach((bodyId, bodyIndex) => {
      if (!bodyIds.has(bodyId)) add(`${base}.bodyIds[${bodyIndex}]`, `Nie znaleziono bryły „${bodyId}”.`, 'BROKEN_REFERENCE');
      else if (bodyOwners.has(bodyId)) add(`${base}.bodyIds[${bodyIndex}]`, `Bryła „${bodyId}” należy już do komponentu „${bodyOwners.get(bodyId)}”.`, 'DUPLICATE');
      else bodyOwners.set(bodyId, component.id);
    });
    ownedSketchIds.forEach((sketchId, sketchIndex) => {
      if (!sketchIds.has(sketchId)) add(`${base}.sketchIds[${sketchIndex}]`, `Nie znaleziono szkicu „${sketchId}”.`, 'BROKEN_REFERENCE');
    });
    childIds.forEach((childId, childIndex) => {
      if (!componentIds.has(childId)) add(`${base}.componentIds[${childIndex}]`, `Nie znaleziono podkomponentu „${childId}”.`, 'BROKEN_REFERENCE');
      else if (childId === component.id) add(`${base}.componentIds[${childIndex}]`, 'Komponent nie może być własnym podkomponentem.', 'CYCLIC_REFERENCE');
      else if (componentParents.has(childId)) add(`${base}.componentIds[${childIndex}]`, `Podkomponent ma już rodzica „${componentParents.get(childId)}”.`, 'DUPLICATE');
      else componentParents.set(childId, component.id);
    });
  });
  componentIds.forEach((componentId) => {
    const visited = new Set([componentId]);
    let parentId = componentParents.get(componentId);
    while (parentId) {
      if (visited.has(parentId)) {
        add('components', 'Struktura komponentów zawiera cykliczną zależność.', 'CYCLIC_REFERENCE');
        break;
      }
      visited.add(parentId);
      parentId = componentParents.get(parentId);
    }
  });

  linkedProjects.forEach((link, index) => {
    if (!isRecord(link)) return;
    const base = `linkedProjects[${index}]`;
    if (!componentIds.has(link.linkedComponentId)) add(`${base}.linkedComponentId`, 'Łącze wskazuje brakujący komponent.', 'BROKEN_REFERENCE');
    (link.proxyFeatureIds || []).forEach((featureId, featureIndex) => {
      const feature = features.find((item) => item?.id === featureId);
      if (!feature) add(`${base}.proxyFeatureIds[${featureIndex}]`, 'Łącze wskazuje brakującą operację proxy.', 'BROKEN_REFERENCE');
      else if (feature.type !== 'importedModel' || feature.linkedProjectId !== link.id) add(`${base}.proxyFeatureIds[${featureIndex}]`, 'Operacja proxy nie należy do tego łącza.', 'VALUE');
    });
    const component = components.find((item) => item?.id === link.linkedComponentId);
    if (component && component.linkedProjectId !== link.id) add(`${base}.linkedComponentId`, 'Komponent nie wskazuje zgodnego łącza projektu.', 'VALUE');
  });

  const instanceIds = new Set();
  const instanceParents = new Map();
  const instanceNames = new Set();
  componentInstances.forEach((instance, index) => {
    const base = `componentInstances[${index}]`;
    if (!isRecord(instance)) {
      add(base, 'Wystąpienie komponentu musi być obiektem.', 'TYPE');
      return;
    }
    registerId(instance.id, `${base}.id`);
    if (typeof instance.id === 'string' && instance.id) instanceIds.add(instance.id);
    if (!componentIds.has(instance.componentId)) add(`${base}.componentId`, `Nie znaleziono komponentu „${instance.componentId ?? ''}”.`, 'BROKEN_REFERENCE');
    if (typeof instance.name !== 'string' || !instance.name.trim()) add(`${base}.name`, 'Wystąpienie wymaga nazwy.', 'REQUIRED');
    else if (instanceNames.has(instance.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa wystąpienia: ${instance.name}`, 'DUPLICATE');
    else instanceNames.add(instance.name.toLocaleLowerCase());
    if (typeof instance.parentInstanceId !== 'string') add(`${base}.parentInstanceId`, 'Rodzic wystąpienia musi być identyfikatorem tekstowym.', 'TYPE');
    else if (instance.parentInstanceId) instanceParents.set(instance.id, instance.parentInstanceId);
    if (!isRecord(instance.transform) || Object.keys(DEFAULT_INSTANCE_TRANSFORM).some((key) => !Number.isFinite(Number(instance.transform?.[key])))) {
      add(`${base}.transform`, 'Transformacja wystąpienia wymaga liczbowej pozycji i obrotu XYZ.', 'TYPE');
    }
    if (typeof instance.grounded !== 'boolean') add(`${base}.grounded`, 'Stan Ground musi być wartością logiczną.', 'TYPE');
    if (typeof instance.visible !== 'boolean') add(`${base}.visible`, 'Widoczność wystąpienia musi być wartością logiczną.', 'TYPE');
    if (typeof instance.primary !== 'boolean') add(`${base}.primary`, 'Znacznik głównego wystąpienia musi być wartością logiczną.', 'TYPE');
  });
  componentInstances.forEach((instance, index) => {
    if (!isRecord(instance) || !instance.parentInstanceId) return;
    const base = `componentInstances[${index}]`;
    if (!instanceIds.has(instance.parentInstanceId)) add(`${base}.parentInstanceId`, `Nie znaleziono nadrzędnego wystąpienia „${instance.parentInstanceId}”.`, 'BROKEN_REFERENCE');
    else if (instance.parentInstanceId === instance.id) add(`${base}.parentInstanceId`, 'Wystąpienie nie może być własnym rodzicem.', 'CYCLIC_REFERENCE');
    else {
      const parent = componentInstances.find((item) => item?.id === instance.parentInstanceId);
      const parentComponent = components.find((component) => component?.id === parent?.componentId);
      if (parentComponent?.type !== 'assembly') add(`${base}.parentInstanceId`, 'Rodzicem wystąpienia musi być złożenie.', 'VALUE');
    }
    let ancestor = componentInstances.find((item) => item?.id === instance.parentInstanceId);
    const visitedAncestors = new Set();
    while (ancestor && !visitedAncestors.has(ancestor.id)) {
      if (ancestor.componentId === instance.componentId) {
        add(`${base}.componentId`, 'Złożenie nie może rekurencyjnie zawierać wystąpienia własnej definicji.', 'CYCLIC_REFERENCE');
        break;
      }
      visitedAncestors.add(ancestor.id);
      ancestor = componentInstances.find((item) => item?.id === ancestor.parentInstanceId);
    }
  });
  instanceIds.forEach((instanceId) => {
    const visited = new Set([instanceId]);
    let parentId = instanceParents.get(instanceId);
    while (parentId) {
      if (visited.has(parentId)) {
        add('componentInstances', 'Drzewo wystąpień zawiera cykliczną zależność.', 'CYCLIC_REFERENCE');
        break;
      }
      visited.add(parentId);
      parentId = instanceParents.get(parentId);
    }
  });
  const primaryComponents = new Set();
  componentInstances.forEach((instance, index) => {
    if (!isRecord(instance) || !instance.primary) return;
    if (primaryComponents.has(instance.componentId)) add(`componentInstances[${index}].primary`, 'Komponent może mieć tylko jedno główne wystąpienie.', 'DUPLICATE');
    else primaryComponents.add(instance.componentId);
  });

  const rigidMemberIds = new Set();
  const rigidGroupNames = new Set();
  rigidGroups.forEach((group, index) => {
    const base = `rigidGroups[${index}]`;
    if (!isRecord(group)) {
      add(base, 'Grupa sztywna musi być obiektem.', 'TYPE');
      return;
    }
    registerId(group.id, `${base}.id`);
    if (typeof group.name !== 'string' || !group.name.trim()) add(`${base}.name`, 'Grupa sztywna wymaga nazwy.', 'REQUIRED');
    else if (rigidGroupNames.has(group.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa grupy sztywnej: ${group.name}`, 'DUPLICATE');
    else rigidGroupNames.add(group.name.toLocaleLowerCase());
    const members = requireArray(group, 'instanceIds', `${base}.instanceIds`);
    if (members.length < 2) add(`${base}.instanceIds`, 'Grupa sztywna wymaga co najmniej dwóch wystąpień.', 'VALUE');
    if (new Set(members).size !== members.length) add(`${base}.instanceIds`, 'Wystąpienie może pojawić się w grupie tylko raz.', 'DUPLICATE');
    const parents = new Set();
    members.forEach((instanceId, memberIndex) => {
      if (!instanceIds.has(instanceId)) add(`${base}.instanceIds[${memberIndex}]`, `Nie znaleziono wystąpienia „${instanceId}”.`, 'BROKEN_REFERENCE');
      else {
        if (rigidMemberIds.has(instanceId)) add(`${base}.instanceIds[${memberIndex}]`, 'Wystąpienie należy już do innej grupy sztywnej.', 'DUPLICATE');
        rigidMemberIds.add(instanceId);
        parents.add(componentInstances.find((instance) => instance.id === instanceId)?.parentInstanceId || '');
      }
    });
    if (parents.size > 1) add(`${base}.instanceIds`, 'Elementy grupy sztywnej muszą mieć tego samego rodzica.', 'VALUE');
  });

  const jointNames = new Set();
  const jointMovingInstances = new Set();
  const jointReferenceByMoving = new Map();
  joints.forEach((joint, index) => {
    const base = `joints[${index}]`;
    if (!isRecord(joint)) {
      add(base, 'Joint musi być obiektem.', 'TYPE');
      return;
    }
    registerId(joint.id, `${base}.id`);
    if (typeof joint.name !== 'string' || !joint.name.trim()) add(`${base}.name`, 'Joint wymaga nazwy.', 'REQUIRED');
    else if (jointNames.has(joint.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa jointa: ${joint.name}`, 'DUPLICATE');
    else jointNames.add(joint.name.toLocaleLowerCase());
    if (!JOINT_TYPES.includes(joint.type)) add(`${base}.type`, 'Typ jointa musi mieć wartość rigid, revolute albo slider.', 'UNSUPPORTED');
    if (!instanceIds.has(joint.referenceInstanceId)) add(`${base}.referenceInstanceId`, `Nie znaleziono wystąpienia bazowego „${joint.referenceInstanceId ?? ''}”.`, 'BROKEN_REFERENCE');
    if (!instanceIds.has(joint.movingInstanceId)) add(`${base}.movingInstanceId`, `Nie znaleziono wystąpienia ruchomego „${joint.movingInstanceId ?? ''}”.`, 'BROKEN_REFERENCE');
    if (joint.referenceInstanceId === joint.movingInstanceId) add(`${base}.movingInstanceId`, 'Joint nie może łączyć wystąpienia z nim samym.', 'CYCLIC_REFERENCE');
    const reference = componentInstances.find((instance) => instance?.id === joint.referenceInstanceId);
    const moving = componentInstances.find((instance) => instance?.id === joint.movingInstanceId);
    if (reference && moving && reference.parentInstanceId !== moving.parentInstanceId) add(base, 'Łączone wystąpienia muszą mieć tego samego rodzica.', 'VALUE');
    if (moving?.grounded) add(`${base}.movingInstanceId`, 'Ruchome wystąpienie jointa nie może mieć Ground.', 'VALUE');
    if (rigidGroups.some((group) => group?.instanceIds?.includes(joint.movingInstanceId))) add(`${base}.movingInstanceId`, 'Ruchome wystąpienie jointa nie może należeć do Rigid Group.', 'VALUE');
    if (jointMovingInstances.has(joint.movingInstanceId)) add(`${base}.movingInstanceId`, 'Wystąpienie ma już joint sterujący położeniem.', 'DUPLICATE');
    else if (typeof joint.movingInstanceId === 'string') {
      jointMovingInstances.add(joint.movingInstanceId);
      jointReferenceByMoving.set(joint.movingInstanceId, joint.referenceInstanceId);
    }
    if (!JOINT_AXES.includes(joint.axis)) add(`${base}.axis`, 'Oś jointa musi mieć wartość x, y albo z.', 'UNSUPPORTED');
    if (!isRecord(joint.axisReference)
      || joint.axisReference.kind !== 'component-origin-axis'
      || joint.axisReference.instanceId !== joint.referenceInstanceId
      || joint.axisReference.axis !== joint.axis) add(`${base}.axisReference`, 'Joint wymaga trwałej referencji osi początku komponentu bazowego.', 'BROKEN_REFERENCE');
    if (!isRecord(joint.anchor) || ['x', 'y', 'z'].some((axis) => !Number.isFinite(Number(joint.anchor?.[axis])))) add(`${base}.anchor`, 'Punkt jointa wymaga liczbowych współrzędnych XYZ.', 'TYPE');
    if (!isRecord(joint.limits)
      || typeof joint.limits.enabled !== 'boolean'
      || !Number.isFinite(Number(joint.limits.min))
      || !Number.isFinite(Number(joint.limits.max))) add(`${base}.limits`, 'Limity jointa wymagają stanu oraz liczbowego minimum i maksimum.', 'TYPE');
    else {
      if (Number(joint.limits.min) > Number(joint.limits.max)) add(`${base}.limits`, 'Minimalny limit jointa nie może przekraczać maksymalnego.', 'VALUE');
      if (joint.limits.enabled && (Number(joint.value) < Number(joint.limits.min) || Number(joint.value) > Number(joint.limits.max))) add(`${base}.value`, 'Wartość jointa wykracza poza aktywne limity.', 'VALUE');
    }
    if (!Number.isFinite(Number(joint.value))) add(`${base}.value`, 'Wartość jointa musi być liczbą.', 'TYPE');
    if (!isRecord(joint.restTransform) || Object.keys(DEFAULT_INSTANCE_TRANSFORM).some((key) => !Number.isFinite(Number(joint.restTransform?.[key])))) add(`${base}.restTransform`, 'Położenie spoczynkowe jointa wymaga pozycji i obrotu XYZ.', 'TYPE');
    if (typeof joint.enabled !== 'boolean') add(`${base}.enabled`, 'Stan jointa musi być wartością logiczną.', 'TYPE');
  });
  jointMovingInstances.forEach((instanceId) => {
    const visited = new Set([instanceId]);
    let referenceId = jointReferenceByMoving.get(instanceId);
    while (referenceId) {
      if (visited.has(referenceId)) {
        add('joints', 'Graf jointów zawiera cykl kinematyczny.', 'CYCLIC_REFERENCE');
        break;
      }
      visited.add(referenceId);
      referenceId = jointReferenceByMoving.get(referenceId);
    }
  });

  const motionLinkNames = new Set();
  const linkedTargets = new Set();
  const motionTargetsBySource = new Map();
  motionLinks.forEach((link, index) => {
    const base = `motionLinks[${index}]`;
    if (!isRecord(link)) {
      add(base, 'Motion Link musi być obiektem.', 'TYPE');
      return;
    }
    registerId(link.id, `${base}.id`);
    if (typeof link.name !== 'string' || !link.name.trim()) add(`${base}.name`, 'Motion Link wymaga nazwy.', 'REQUIRED');
    else if (motionLinkNames.has(link.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa Motion Link: ${link.name}`, 'DUPLICATE');
    else motionLinkNames.add(link.name.toLocaleLowerCase());
    if (!joints.some((joint) => joint?.id === link.sourceJointId)) add(`${base}.sourceJointId`, 'Nie znaleziono źródłowego jointa.', 'BROKEN_REFERENCE');
    if (!joints.some((joint) => joint?.id === link.targetJointId)) add(`${base}.targetJointId`, 'Nie znaleziono docelowego jointa.', 'BROKEN_REFERENCE');
    if (link.sourceJointId === link.targetJointId) add(`${base}.targetJointId`, 'Motion Link nie może sterować samym sobą.', 'CYCLIC_REFERENCE');
    if (linkedTargets.has(link.targetJointId)) add(`${base}.targetJointId`, 'Docelowy joint ma więcej niż jeden Motion Link.', 'DUPLICATE');
    else linkedTargets.add(link.targetJointId);
    if (!Number.isFinite(Number(link.ratio))) add(`${base}.ratio`, 'Przełożenie Motion Link musi być liczbą.', 'TYPE');
    if (!Number.isFinite(Number(link.offset))) add(`${base}.offset`, 'Odsunięcie Motion Link musi być liczbą.', 'TYPE');
    if (typeof link.enabled !== 'boolean') add(`${base}.enabled`, 'Stan Motion Link musi być wartością logiczną.', 'TYPE');
    if (!motionTargetsBySource.has(link.sourceJointId)) motionTargetsBySource.set(link.sourceJointId, []);
    motionTargetsBySource.get(link.sourceJointId).push(link.targetJointId);
  });
  const visitMotionLink = (jointId, path = new Set()) => {
    if (path.has(jointId)) {
      add('motionLinks', 'Graf Motion Link zawiera cykl sterowania.', 'CYCLIC_REFERENCE');
      return;
    }
    const nextPath = new Set(path).add(jointId);
    for (const targetId of motionTargetsBySource.get(jointId) || []) visitMotionLink(targetId, nextPath);
  };
  motionTargetsBySource.forEach((unused, sourceJointId) => visitMotionLink(sourceJointId));

  const contactSetNames = new Set();
  const contactPairs = new Set();
  contactSets.forEach((contactSet, index) => {
    const base = `contactSets[${index}]`;
    if (!isRecord(contactSet)) {
      add(base, 'Contact Set musi być obiektem.', 'TYPE');
      return;
    }
    registerId(contactSet.id, `${base}.id`);
    if (typeof contactSet.name !== 'string' || !contactSet.name.trim()) add(`${base}.name`, 'Contact Set wymaga nazwy.', 'REQUIRED');
    else if (contactSetNames.has(contactSet.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa Contact Set: ${contactSet.name}`, 'DUPLICATE');
    else contactSetNames.add(contactSet.name.toLocaleLowerCase());
    if (!instanceIds.has(contactSet.firstInstanceId)) add(`${base}.firstInstanceId`, 'Nie znaleziono pierwszego wystąpienia Contact Set.', 'BROKEN_REFERENCE');
    if (!instanceIds.has(contactSet.secondInstanceId)) add(`${base}.secondInstanceId`, 'Nie znaleziono drugiego wystąpienia Contact Set.', 'BROKEN_REFERENCE');
    if (contactSet.firstInstanceId === contactSet.secondInstanceId) add(`${base}.secondInstanceId`, 'Contact Set wymaga dwóch różnych wystąpień.', 'VALUE');
    const pairKey = [contactSet.firstInstanceId, contactSet.secondInstanceId].sort().join(':');
    if (contactPairs.has(pairKey)) add(base, 'Para wystąpień ma więcej niż jeden Contact Set.', 'DUPLICATE');
    else contactPairs.add(pairKey);
    if (typeof contactSet.enabled !== 'boolean') add(`${base}.enabled`, 'Stan Contact Set musi być wartością logiczną.', 'TYPE');
  });

  const configurationNames = new Set();
  const configurationIds = new Set();
  assemblyConfigurations.forEach((configuration, index) => {
    const base = `assemblyConfigurations[${index}]`;
    if (!isRecord(configuration)) {
      add(base, 'Konfiguracja złożenia musi być obiektem.', 'TYPE');
      return;
    }
    registerId(configuration.id, `${base}.id`);
    configurationIds.add(configuration.id);
    if (typeof configuration.name !== 'string' || !configuration.name.trim()) add(`${base}.name`, 'Konfiguracja wymaga nazwy.', 'REQUIRED');
    else if (configurationNames.has(configuration.name.toLocaleLowerCase())) add(`${base}.name`, `Powtórzona nazwa konfiguracji: ${configuration.name}`, 'DUPLICATE');
    else configurationNames.add(configuration.name.toLocaleLowerCase());
    if (typeof configuration.description !== 'string') add(`${base}.description`, 'Opis konfiguracji musi być tekstem.', 'TYPE');
    if (!Array.isArray(configuration.instanceStates)) add(`${base}.instanceStates`, 'Konfiguracja wymaga stanów wystąpień.', 'TYPE');
    else {
      const stateIds = new Set();
      configuration.instanceStates.forEach((state, stateIndex) => {
        const stateBase = `${base}.instanceStates[${stateIndex}]`;
        if (!isRecord(state)) return add(stateBase, 'Stan wystąpienia musi być obiektem.', 'TYPE');
        if (!instanceIds.has(state.instanceId)) add(`${stateBase}.instanceId`, 'Stan wskazuje brakujące wystąpienie.', 'BROKEN_REFERENCE');
        if (stateIds.has(state.instanceId)) add(`${stateBase}.instanceId`, 'Wystąpienie jest zapisane w konfiguracji więcej niż raz.', 'DUPLICATE');
        stateIds.add(state.instanceId);
        if (!isRecord(state.transform) || Object.keys(DEFAULT_INSTANCE_TRANSFORM).some((key) => !Number.isFinite(Number(state.transform?.[key])))) add(`${stateBase}.transform`, 'Stan wymaga pozycji i obrotu XYZ.', 'TYPE');
        if (typeof state.grounded !== 'boolean' || typeof state.visible !== 'boolean') add(stateBase, 'Stan widoczności i Ground musi być logiczny.', 'TYPE');
        if (state.grounded && joints.some((joint) => joint?.movingInstanceId === state.instanceId)) add(`${stateBase}.grounded`, 'Konfiguracja nie może uziemiać ruchomego wystąpienia jointa.', 'VALUE');
      });
    }
    if (!Array.isArray(configuration.jointStates)) add(`${base}.jointStates`, 'Konfiguracja wymaga stanów jointów.', 'TYPE');
    else {
      const stateIds = new Set();
      configuration.jointStates.forEach((state, stateIndex) => {
        const stateBase = `${base}.jointStates[${stateIndex}]`;
        if (!isRecord(state)) return add(stateBase, 'Stan jointa musi być obiektem.', 'TYPE');
        if (!joints.some((joint) => joint?.id === state.jointId)) add(`${stateBase}.jointId`, 'Stan wskazuje brakujący joint.', 'BROKEN_REFERENCE');
        if (stateIds.has(state.jointId)) add(`${stateBase}.jointId`, 'Joint jest zapisany w konfiguracji więcej niż raz.', 'DUPLICATE');
        stateIds.add(state.jointId);
        if (!Number.isFinite(Number(state.value))) add(`${stateBase}.value`, 'Wartość jointa musi być liczbą.', 'TYPE');
        if (typeof state.enabled !== 'boolean') add(`${stateBase}.enabled`, 'Stan jointa musi być logiczny.', 'TYPE');
      });
    }
  });
  if (typeof document.activeAssemblyConfigurationId !== 'string') add('activeAssemblyConfigurationId', 'Aktywna konfiguracja musi być identyfikatorem tekstowym.', 'TYPE');
  else if (document.activeAssemblyConfigurationId && !configurationIds.has(document.activeAssemblyConfigurationId)) add('activeAssemblyConfigurationId', 'Nie znaleziono aktywnej konfiguracji.', 'BROKEN_REFERENCE');

  drawings.forEach((sheet, sheetIndex) => {
    const base = `drawings[${sheetIndex}]`;
    if (!isRecord(sheet)) {
      add(base, 'Arkusz dokumentacji musi być obiektem.', 'TYPE');
      return;
    }
    registerId(sheet.id, `${base}.id`);
    if (typeof sheet.name !== 'string' || !sheet.name.trim()) add(`${base}.name`, 'Arkusz wymaga nazwy.', 'REQUIRED');
    if (!DRAWING_PAGE_SIZES[sheet.pageSize]) add(`${base}.pageSize`, `Nieobsługiwany format arkusza: ${sheet.pageSize ?? ''}.`, 'UNSUPPORTED');
    if (!['landscape', 'portrait'].includes(sheet.orientation)) add(`${base}.orientation`, 'Orientacja arkusza musi być pozioma albo pionowa.', 'UNSUPPORTED');
    if (!isRecord(sheet.titleBlock)) add(`${base}.titleBlock`, 'Arkusz wymaga konfiguracji tabliczki rysunkowej.', 'TYPE');
    const views = requireArray(sheet, 'views', `${base}.views`);
    const annotations = requireArray(sheet, 'annotations', `${base}.annotations`);
    const revisions = requireArray(sheet, 'revisions', `${base}.revisions`);
    const tables = requireArray(sheet, 'tables', `${base}.tables`);
    const viewIds = new Set(views.filter(isRecord).map((view) => view.id).filter((id) => typeof id === 'string' && id));
    const viewIndexById = new Map(views.map((view, index) => [view?.id, index]).filter(([id]) => typeof id === 'string' && id));
    const viewParents = new Map();
    views.forEach((view, viewIndex) => {
      const viewBase = `${base}.views[${viewIndex}]`;
      if (!isRecord(view)) {
        add(viewBase, 'Widok rysunkowy musi być obiektem.', 'TYPE');
        return;
      }
      registerId(view.id, `${viewBase}.id`);
      if (!DRAWING_VIEW_TYPES.includes(view.type)) add(`${viewBase}.type`, `Nieobsługiwany typ widoku: ${view.type ?? ''}.`, 'UNSUPPORTED');
      if (!DRAWING_VIEW_ORIENTATIONS.includes(view.orientation)) add(`${viewBase}.orientation`, `Nieobsługiwana orientacja widoku: ${view.orientation ?? ''}.`, 'UNSUPPORTED');
      if (view.type === 'sketch') {
        if (typeof view.sketchId !== 'string' || !view.sketchId) add(`${viewBase}.sketchId`, 'Widok szkicu wymaga szkicu źródłowego.', 'REQUIRED');
        else if (!sketchIds.has(view.sketchId)) add(`${viewBase}.sketchId`, 'Widok odwołuje się do brakującego szkicu.', 'REFERENCE');
      } else if (!Array.isArray(view.bodyIds) || !view.bodyIds.length) add(`${viewBase}.bodyIds`, 'Widok wymaga co najmniej jednej bryły.', 'REQUIRED');
      else view.bodyIds.forEach((bodyId, bodyIndex) => {
        if (typeof bodyId !== 'string' || !bodyId) add(`${viewBase}.bodyIds[${bodyIndex}]`, 'Referencja bryły musi być niepustym ID.', 'TYPE');
      });
      if (!(Number(view.scale) > 0)) add(`${viewBase}.scale`, 'Skala widoku musi być dodatnia.', 'VALUE');
      if (!Number.isFinite(Number(view.x)) || !Number.isFinite(Number(view.y))) add(viewBase, 'Położenie widoku na arkuszu musi być liczbowe.', 'TYPE');
      if (!['base', 'sketch'].includes(view.type)) {
        if (typeof view.parentViewId !== 'string' || !viewParents.has(view.parentViewId) && !viewIds.has(view.parentViewId)) add(`${viewBase}.parentViewId`, 'Widok pochodny wymaga istniejącego widoku nadrzędnego na tym samym arkuszu.', 'BROKEN_REFERENCE');
        else if (view.parentViewId === view.id) add(`${viewBase}.parentViewId`, 'Widok nie może być własnym rodzicem.', 'CYCLIC_REFERENCE');
        else if (viewIndexById.get(view.parentViewId) >= viewIndex) add(`${viewBase}.parentViewId`, 'Widok nadrzędny musi występować przed widokiem pochodnym.', 'ORDER');
        else viewParents.set(view.id, view.parentViewId);
        if (!DRAWING_VIEW_ALIGNMENTS.includes(view.alignment)) add(`${viewBase}.alignment`, 'Nieobsługiwane wyrównanie widoku.', 'UNSUPPORTED');
      }
      if (view.type === 'projected' && !['right', 'left', 'top', 'bottom'].includes(view.projectionDirection)) add(`${viewBase}.projectionDirection`, 'Nieobsługiwany kierunek rzutu pochodnego.', 'UNSUPPORTED');
      if (view.type === 'section') {
        if (!['vertical', 'horizontal'].includes(view.sectionAxis)) add(`${viewBase}.sectionAxis`, 'Oś przekroju musi być pionowa albo pozioma.', 'UNSUPPORTED');
        if (!(Number(view.sectionPosition) >= 0.05 && Number(view.sectionPosition) <= 0.95)) add(`${viewBase}.sectionPosition`, 'Położenie linii przekroju musi mieścić się między 5% i 95%.', 'VALUE');
        if (!(Number(view.hatchSpacing) >= 1 && Number(view.hatchSpacing) <= 20)) add(`${viewBase}.hatchSpacing`, 'Odstęp kreskowania musi mieścić się między 1 i 20 mm.', 'VALUE');
      }
      if (view.type === 'detail') {
        if (!Array.isArray(view.detailCenter) || view.detailCenter.length !== 2 || view.detailCenter.some((value) => !(Number(value) >= 0 && Number(value) <= 1))) add(`${viewBase}.detailCenter`, 'Środek detalu wymaga dwóch współrzędnych względnych 0–1.', 'VALUE');
        if (!(Number(view.detailRadius) >= 0.05 && Number(view.detailRadius) <= 0.5)) add(`${viewBase}.detailRadius`, 'Promień detalu musi mieścić się między 5% i 50%.', 'VALUE');
        if (!(Number(view.magnification) >= 1.1 && Number(view.magnification) <= 10)) add(`${viewBase}.magnification`, 'Powiększenie detalu musi mieścić się między 1,1× i 10×.', 'VALUE');
      }
    });
    for (const viewId of viewParents.keys()) {
      const visited = new Set([viewId]);
      let parentId = viewParents.get(viewId);
      while (parentId && viewParents.has(parentId)) {
        if (visited.has(parentId)) {
          add(`${base}.views`, 'Widoki pochodne zawierają cykliczną zależność.', 'CYCLIC_REFERENCE');
          break;
        }
        visited.add(parentId);
        parentId = viewParents.get(parentId);
      }
    }
    annotations.forEach((annotation, annotationIndex) => {
      const annotationBase = `${base}.annotations[${annotationIndex}]`;
      if (!isRecord(annotation)) {
        add(annotationBase, 'Adnotacja rysunkowa musi być obiektem.', 'TYPE');
        return;
      }
      registerId(annotation.id, `${annotationBase}.id`);
      if (!DRAWING_ANNOTATION_TYPES.includes(annotation.type)) add(`${annotationBase}.type`, `Nieobsługiwany typ adnotacji: ${annotation.type ?? ''}.`, 'UNSUPPORTED');
      if (typeof annotation.viewId !== 'string' || !viewIds.has(annotation.viewId)) add(`${annotationBase}.viewId`, 'Adnotacja wymaga istniejącego widoku na tym samym arkuszu.', 'BROKEN_REFERENCE');
      if (annotation.type === 'linear-dimension') {
        if (!['horizontal', 'vertical'].includes(annotation.axis)) add(`${annotationBase}.axis`, 'Wymiar musi być poziomy albo pionowy.', 'UNSUPPORTED');
        if (!Number.isFinite(Number(annotation.offset)) || Math.abs(Number(annotation.offset)) > 100) add(`${annotationBase}.offset`, 'Odsunięcie wymiaru musi mieścić się między -100 i 100 mm.', 'VALUE');
        if (!Number.isInteger(Number(annotation.precision)) || Number(annotation.precision) < 0 || Number(annotation.precision) > 4) add(`${annotationBase}.precision`, 'Dokładność wymiaru musi mieścić się między 0 i 4 miejscami.', 'VALUE');
        if (!['none', 'symmetric', 'deviation'].includes(annotation.toleranceMode)) add(`${annotationBase}.toleranceMode`, 'Nieobsługiwany zapis tolerancji.', 'UNSUPPORTED');
        if (Number(annotation.upperTolerance) < 0 || Number(annotation.lowerTolerance) < 0) add(annotationBase, 'Tolerancje nie mogą być ujemne.', 'VALUE');
      }
      if (annotation.type === 'centerline') {
        if (!['horizontal', 'vertical'].includes(annotation.axis)) add(`${annotationBase}.axis`, 'Oś musi być pozioma albo pionowa.', 'UNSUPPORTED');
        if (!Number.isFinite(Number(annotation.offset)) || Math.abs(Number(annotation.offset)) > 1) add(`${annotationBase}.offset`, 'Położenie osi musi mieścić się między -1 i 1.', 'VALUE');
      }
      if (annotation.type === 'center-mark' || annotation.type === 'hole-note' || annotation.type === 'balloon') {
        if (!Array.isArray(annotation.center) || annotation.center.length !== 2 || annotation.center.some((value) => !(Number(value) >= 0 && Number(value) <= 1))) add(`${annotationBase}.center`, 'Położenie znacznika wymaga dwóch współrzędnych względnych 0–1.', 'VALUE');
      }
      if (annotation.type === 'center-mark' && !(Number(annotation.size) >= 2 && Number(annotation.size) <= 20)) add(`${annotationBase}.size`, 'Rozmiar znacznika środka musi mieścić się między 2 i 20 mm.', 'VALUE');
      if (annotation.type === 'hole-note') {
        if (!Array.isArray(annotation.labelOffset) || annotation.labelOffset.length !== 2 || annotation.labelOffset.some((value) => !Number.isFinite(Number(value)))) add(`${annotationBase}.labelOffset`, 'Odnośnik opisu otworu wymaga dwóch liczbowych współrzędnych.', 'TYPE');
        if (!['model', 'manual'].includes(annotation.diameterSource)) add(`${annotationBase}.diameterSource`, 'Źródło średnicy musi wskazywać model albo wartość ręczną.', 'UNSUPPORTED');
        if (!['hole', 'thread'].includes(annotation.noteMode)) add(`${annotationBase}.noteMode`, 'Opis musi dotyczyć otworu albo gwintu.', 'UNSUPPORTED');
        if (annotation.diameterSource === 'manual' && !(Number(annotation.diameter) > 0)) add(`${annotationBase}.diameter`, 'Ręczna średnica otworu musi być dodatnia.', 'VALUE');
        if (!Number.isInteger(Number(annotation.quantity)) || Number(annotation.quantity) < 1 || Number(annotation.quantity) > 99) add(`${annotationBase}.quantity`, 'Liczba otworów musi mieścić się między 1 i 99.', 'VALUE');
        if (annotation.noteMode === 'thread' && (typeof annotation.threadDesignation !== 'string' || !annotation.threadDesignation.trim())) add(`${annotationBase}.threadDesignation`, 'Opis gwintu wymaga oznaczenia, np. M8×1.25.', 'REQUIRED');
        if (annotation.noteMode === 'thread' && (typeof annotation.threadClass !== 'string' || !annotation.threadClass.trim())) add(`${annotationBase}.threadClass`, 'Opis gwintu wymaga klasy tolerancji.', 'REQUIRED');
      }
      if (annotation.type === 'feature-control-frame') {
        if (!Array.isArray(annotation.center) || annotation.center.length !== 2 || annotation.center.some((value) => !(Number(value) >= 0 && Number(value) <= 1))) add(`${annotationBase}.center`, 'Położenie ramki tolerancji wymaga dwóch współrzędnych względnych 0–1.', 'VALUE');
        if (!Array.isArray(annotation.labelOffset) || annotation.labelOffset.length !== 2 || annotation.labelOffset.some((value) => !Number.isFinite(Number(value)))) add(`${annotationBase}.labelOffset`, 'Odnośnik ramki tolerancji wymaga dwóch liczbowych współrzędnych.', 'TYPE');
        if (!['position', 'flatness', 'parallelism', 'perpendicularity', 'circularity'].includes(annotation.symbol)) add(`${annotationBase}.symbol`, 'Nieobsługiwany symbol tolerancji geometrycznej.', 'UNSUPPORTED');
        if (!(Number(annotation.tolerance) > 0 && Number(annotation.tolerance) <= 100)) add(`${annotationBase}.tolerance`, 'Tolerancja geometryczna musi być dodatnia i nie większa niż 100 mm.', 'VALUE');
        if (typeof annotation.datum !== 'string' || annotation.datum.length > 8) add(`${annotationBase}.datum`, 'Baza tolerancji musi być krótkim tekstem.', 'TYPE');
      }
      if (annotation.type === 'balloon') {
        if (!Array.isArray(annotation.labelOffset) || annotation.labelOffset.length !== 2 || annotation.labelOffset.some((value) => !Number.isFinite(Number(value)))) add(`${annotationBase}.labelOffset`, 'Odnośnik oznaczenia pozycji wymaga dwóch liczbowych współrzędnych.', 'TYPE');
        if (typeof annotation.bodyId !== 'string' || !annotation.bodyId) add(`${annotationBase}.bodyId`, 'Oznaczenie pozycji wymaga ID bryły.', 'REQUIRED');
        else {
          const ownerView = views.find((view) => view?.id === annotation.viewId);
          if (ownerView && !ownerView.bodyIds?.includes(annotation.bodyId)) add(`${annotationBase}.bodyId`, 'Oznaczona bryła nie należy do wskazanego widoku.', 'BROKEN_REFERENCE');
        }
        if (!Number.isInteger(Number(annotation.itemNumber)) || Number(annotation.itemNumber) < 1 || Number(annotation.itemNumber) > 999) add(`${annotationBase}.itemNumber`, 'Numer pozycji musi mieścić się między 1 i 999.', 'VALUE');
      }
    });
    revisions.forEach((revision, revisionIndex) => {
      const revisionBase = `${base}.revisions[${revisionIndex}]`;
      if (!isRecord(revision)) {
        add(revisionBase, 'Rewizja musi być obiektem.', 'TYPE');
        return;
      }
      registerId(revision.id, `${revisionBase}.id`);
      if (typeof revision.code !== 'string' || !revision.code.trim()) add(`${revisionBase}.code`, 'Rewizja wymaga oznaczenia.', 'REQUIRED');
      if (typeof revision.description !== 'string') add(`${revisionBase}.description`, 'Opis rewizji musi być tekstem.', 'TYPE');
      if (typeof revision.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(revision.date)) add(`${revisionBase}.date`, 'Data rewizji musi mieć format RRRR-MM-DD.', 'VALUE');
    });
    tables.forEach((table, tableIndex) => {
      const tableBase = `${base}.tables[${tableIndex}]`;
      if (!isRecord(table)) {
        add(tableBase, 'Tabela rysunkowa musi być obiektem.', 'TYPE');
        return;
      }
      registerId(table.id, `${tableBase}.id`);
      if (!DRAWING_TABLE_TYPES.includes(table.type)) add(`${tableBase}.type`, 'Nieobsługiwany typ tabeli rysunkowej.', 'UNSUPPORTED');
      if (!Number.isFinite(Number(table.x)) || !Number.isFinite(Number(table.y))) add(tableBase, 'Położenie tabeli musi być liczbowe.', 'TYPE');
      if (table.type === 'hole-table' && (typeof table.viewId !== 'string' || !viewIds.has(table.viewId))) add(`${tableBase}.viewId`, 'Tabela otworów wymaga istniejącego widoku.', 'BROKEN_REFERENCE');
    });
  });

  const errors = issues.map((issue) => `${issue.path}: ${issue.message}`);
  return { valid: errors.length === 0, errors, issues };
}
