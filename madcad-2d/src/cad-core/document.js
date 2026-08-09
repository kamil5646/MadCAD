import { createId } from './ids.js';
import { listExpressionIdentifiers } from './expressions.js';
import {
  SKETCH_ENTITY_ROLES,
  SKETCH_ENTITY_TYPES,
  SKETCH_DIMENSION_TYPES,
  boundaryPointIds,
  normalizeSketchModel,
} from './sketch-model.js';

export const DOCUMENT_SCHEMA_VERSION = 4;
export const MIN_MIGRATABLE_SCHEMA_VERSION = 2;

const SUPPORTED_PLANES = new Set(['XY', 'XZ', 'YZ']);
const FEATURE_TYPES = new Set(['extrude', 'boolean', 'hole', 'fillet', 'chamfer', 'shell', 'draft', 'splitBody', 'splitFace', 'primitive', 'transform', 'offsetFace', 'textSolid', 'importedModel']);
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

const MIGRATIONS = new Map([
  [2, migrateV2ToV3],
  [3, migrateV3ToV4],
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

export function createSketch({ name = 'Szkic', plane = 'XY', planeOffset = '0', support = null, entities = [], profiles = [], constraints = [], dimensions = [] } = {}) {
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
  });
}

export function createFeature(type, options = {}) {
  const names = { extrude: 'Wyciągnięcie', boolean: 'Boolean', hole: 'Otwór', fillet: 'Zaokrąglenie', chamfer: 'Fazowanie', shell: 'Shell', draft: 'Draft', splitBody: 'Split Body', splitFace: 'Split Face', primitive: 'Prymityw', transform: 'Transformacja', offsetFace: 'Offset Face', textSolid: 'Tekst 3D', importedModel: 'Model importowany' };
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
    bodies: [],
    components: [],
    references: [],
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
  return document;
}

function projectFutureDocument(source) {
  const projected = ensureV3Collections(cloneDocument(source));
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
  const bodies = requireArray(document, 'bodies');
  const components = requireArray(document, 'components');
  const references = requireArray(document, 'references');
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
          if (pair.length === 2 && next?.length === 2 && pair[1] !== next[0]) add(`${loopBase}.entityIds[${entityIndex}]`, 'Segment nie łączy się z następną krawędzią profilu.', 'BROKEN_REFERENCE');
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
  bodies.forEach((body, index) => {
    const base = `bodies[${index}]`;
    if (!isRecord(body)) {
      add(base, 'Bryła musi być obiektem.', 'TYPE');
      return;
    }
    registerId(body.id, `${base}.id`);
    if (typeof body.id === 'string') bodyIds.add(body.id);
  });

  components.forEach((component, index) => {
    const base = `components[${index}]`;
    if (!isRecord(component)) add(base, 'Komponent musi być obiektem.', 'TYPE');
    else registerId(component.id, `${base}.id`);
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

    if (feature.type === 'primitive') {
      if (!['box', 'cylinder', 'sphere', 'torus'].includes(feature.primitiveType)) add(`${base}.primitiveType`, `Nieobsługiwany prymityw: ${feature.primitiveType ?? ''}.`, 'UNSUPPORTED');
      bodyIds.add(`body-${feature.id}`);
    }

    if (feature.type === 'importedModel') {
      if (!['step', 'stl'].includes(feature.importFormat)) add(`${base}.importFormat`, 'Import kernela obsługuje STEP albo STL.', 'UNSUPPORTED');
      if (!['step', 'stl', '3mf'].includes(feature.originalFormat)) add(`${base}.originalFormat`, 'Nieobsługiwany format źródłowy.', 'UNSUPPORTED');
      if (typeof feature.dataBase64 !== 'string' || !feature.dataBase64.length) add(`${base}.dataBase64`, 'Brak danych modelu importowanego.', 'REQUIRED');
      if (!Number.isFinite(Number(feature.unitScale)) || Number(feature.unitScale) <= 0) add(`${base}.unitScale`, 'Skala jednostki musi być dodatnia.', 'VALUE');
      bodyIds.add(`body-${feature.id}`);
    }

    if (feature.type === 'textSolid') {
      if (typeof feature.text !== 'string' || !feature.text.trim()) add(`${base}.text`, 'Tekst 3D nie może być pusty.', 'REQUIRED');
      if (feature.text?.length > 80) add(`${base}.text`, 'Tekst 3D może mieć najwyżej 80 znaków.', 'VALUE');
      if (!['new', 'emboss', 'deboss'].includes(feature.operation)) add(`${base}.operation`, `Nieobsługiwana operacja tekstu: ${feature.operation ?? ''}.`, 'UNSUPPORTED');
      if (feature.operation === 'new') bodyIds.add(`body-${feature.id}`);
      else if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły docelowej „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
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
    if (feature.type === 'offsetFace') {
      if (!bodyIds.has(feature.targetBodyId)) add(`${base}.targetBodyId`, `Nie znaleziono bryły „${feature.targetBodyId ?? ''}”.`, 'BROKEN_REFERENCE');
      if (!Array.isArray(feature.referenceIds) || feature.referenceIds.length !== 1) add(`${base}.referenceIds`, 'Offset Face wymaga dokładnie jednej planarnej ściany.', 'REQUIRED');
    }
  });

  const errors = issues.map((issue) => `${issue.path}: ${issue.message}`);
  return { valid: errors.length === 0, errors, issues };
}
