import { createId } from './ids.js';
import { deleteSketchSelection } from './sketch-model.js';

function expression(value, fallback = 0) {
  return String(value ?? fallback);
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} musi być liczbą.`);
  return number;
}

function uniqueBlockName(document, requestedName) {
  const name = String(requestedName || '').trim();
  if (!name) throw new Error('Blok wymaga nazwy.');
  if ((document.blocks || []).some((block) => block.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error(`Blok „${name}” już istnieje.`);
  }
  return name;
}

function cloneTemplateEntity(entity, entityIdMap, basePoint) {
  const templateId = createId('block-entity');
  entityIdMap.set(entity.id, templateId);
  const clone = structuredClone(entity);
  clone.id = templateId;
  clone.sourceEntityId = entity.id;
  delete clone.blockDefinitionId;
  delete clone.blockInstanceId;
  delete clone.blockSourceEntityId;
  if (clone.type === 'point') {
    clone.geometry.x = `(${expression(clone.geometry.x)}) - (${basePoint[0]})`;
    clone.geometry.y = `(${expression(clone.geometry.y)}) - (${basePoint[1]})`;
  }
  return clone;
}

function transformTemplateEntity(template, entityIdMap, { insertionPoint, rotation, scale, layerId, blockId, instanceId }) {
  const entity = structuredClone(template);
  entity.id = entityIdMap.get(template.id);
  entity.pointIds = (template.pointIds || []).map((pointId) => entityIdMap.get(pointId));
  entity.layerId = layerId || entity.layerId;
  entity.blockDefinitionId = blockId;
  entity.blockInstanceId = instanceId;
  entity.blockSourceEntityId = template.id;
  delete entity.sourceEntityId;
  if (entity.type === 'point') {
    const radians = rotation * Math.PI / 180;
    const cosine = Number(Math.cos(radians).toFixed(12));
    const sine = Number(Math.sin(radians).toFixed(12));
    const localX = expression(entity.geometry.x);
    const localY = expression(entity.geometry.y);
    entity.geometry.x = `(${insertionPoint[0]}) + (${scale}) * ((${localX}) * (${cosine}) - (${localY}) * (${sine}))`;
    entity.geometry.y = `(${insertionPoint[1]}) + (${scale}) * ((${localX}) * (${sine}) + (${localY}) * (${cosine}))`;
  } else {
    for (const key of ['radius', 'majorRadius', 'minorRadius', 'width', 'height', 'size']) {
      if (entity.geometry?.[key] !== undefined) entity.geometry[key] = `(${expression(entity.geometry[key])}) * (${scale})`;
    }
    if (entity.geometry?.rotation !== undefined) entity.geometry.rotation = `(${expression(entity.geometry.rotation)}) + (${rotation})`;
  }
  return entity;
}

export function ensureDocumentBlocks(document) {
  if (!document || typeof document !== 'object') return document;
  if (!Array.isArray(document.blocks)) document.blocks = [];
  document.blocks = document.blocks.map((block) => ({
    ...block,
    entities: Array.isArray(block?.entities) ? block.entities : [],
    constraints: Array.isArray(block?.constraints) ? block.constraints : [],
    dimensions: Array.isArray(block?.dimensions) ? block.dimensions : [],
    attributeDefinitions: Array.isArray(block?.attributeDefinitions) ? block.attributeDefinitions : [],
  }));
  for (const sketch of document.sketches || []) {
    if (!Array.isArray(sketch.blockInstances)) sketch.blockInstances = [];
    sketch.blockInstances = sketch.blockInstances.map((instance) => ({
      ...instance,
      insertionPoint: Array.isArray(instance?.insertionPoint) ? instance.insertionPoint : [0, 0],
      rotation: Number(instance?.rotation) || 0,
      scale: Number(instance?.scale) || 1,
      entityIds: Array.isArray(instance?.entityIds) ? instance.entityIds : [],
      attributes: instance?.attributes && typeof instance.attributes === 'object' ? instance.attributes : {},
    }));
  }
  return document;
}

export function createBlockDefinition(document, sketchId, selectedIds, {
  name,
  basePoint = [0, 0],
  attributeDefinitions = [],
} = {}) {
  ensureDocumentBlocks(document);
  const sketch = document.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono aktywnego szkicu.');
  const selected = new Set(selectedIds || []);
  const selectedCurves = sketch.entities.filter((entity) => selected.has(entity.id) && entity.type !== 'point');
  for (const entity of selectedCurves) for (const pointId of entity.pointIds || []) selected.add(pointId);
  const entities = sketch.entities.filter((entity) => selected.has(entity.id));
  if (!entities.length || !selectedCurves.length) throw new Error('Blok wymaga co najmniej jednego zaznaczonego segmentu.');
  const sharedOutside = sketch.entities.find((entity) => !selected.has(entity.id) && entity.pointIds?.some((pointId) => selected.has(pointId)));
  if (sharedOutside) throw new Error('Granica bloku współdzieli punkt z niezaznaczoną geometrią. Zaznacz cały połączony fragment.');
  const normalizedBasePoint = [finiteNumber(basePoint[0], 'Bazowy X'), finiteNumber(basePoint[1], 'Bazowy Y')];
  const block = {
    id: createId('block'),
    name: uniqueBlockName(document, name),
    basePoint: normalizedBasePoint,
    entities: [],
    constraints: [],
    dimensions: [],
    attributeDefinitions: attributeDefinitions.map((attribute) => ({
      id: attribute.id || createId('block-attribute'),
      tag: String(attribute.tag || '').trim().toUpperCase(),
      prompt: String(attribute.prompt || attribute.tag || '').trim(),
      defaultValue: String(attribute.defaultValue || ''),
    })).filter((attribute) => attribute.tag),
  };
  const templateIdMap = new Map();
  block.entities = entities.map((entity) => cloneTemplateEntity(entity, templateIdMap, normalizedBasePoint));
  block.entities.forEach((entity) => { entity.pointIds = entity.pointIds.map((pointId) => templateIdMap.get(pointId)); });
  const entityIds = new Set(entities.map((entity) => entity.id));
  const constraintIdMap = new Map();
  block.constraints = (sketch.constraints || []).filter((constraint) => constraint.entityIds?.every((id) => entityIds.has(id))).map((constraint) => {
    const clone = structuredClone(constraint);
    const id = createId('block-constraint');
    constraintIdMap.set(constraint.id, id);
    clone.id = id;
    clone.entityIds = clone.entityIds.map((idValue) => templateIdMap.get(idValue));
    return clone;
  });
  block.dimensions = (sketch.dimensions || []).filter((dimension) => dimension.entityIds?.every((id) => entityIds.has(id))).map((dimension) => {
    const clone = structuredClone(dimension);
    clone.id = createId('block-dimension');
    clone.entityIds = dimension.entityIds.map((idValue) => templateIdMap.get(idValue));
    if (dimension.constraintId && constraintIdMap.has(dimension.constraintId)) clone.constraintId = constraintIdMap.get(dimension.constraintId);
    else delete clone.constraintId;
    return clone;
  });
  document.blocks.push(block);
  const instance = {
    id: createId('block-instance'),
    blockId: block.id,
    insertionPoint: normalizedBasePoint,
    rotation: 0,
    scale: 1,
    entityIds: entities.map((entity) => entity.id),
    attributes: Object.fromEntries(block.attributeDefinitions.map((attribute) => [attribute.tag, attribute.defaultValue])),
  };
  sketch.blockInstances.push(instance);
  for (const entity of entities) {
    entity.blockDefinitionId = block.id;
    entity.blockInstanceId = instance.id;
    entity.blockSourceEntityId = templateIdMap.get(entity.id);
  }
  return { block, instance, entityIds: [...entityIds] };
}

export function insertBlockInstance(document, sketchId, blockId, {
  insertionPoint = [0, 0],
  rotation = 0,
  scale = 1,
  layerId = document.activeLayerId,
  attributes = {},
} = {}) {
  ensureDocumentBlocks(document);
  const sketch = document.sketches?.find((item) => item.id === sketchId);
  const block = document.blocks.find((item) => item.id === blockId);
  if (!sketch) throw new Error('Nie znaleziono aktywnego szkicu.');
  if (!block) throw new Error('Nie znaleziono definicji bloku.');
  const point = [finiteNumber(insertionPoint[0], 'Punkt wstawienia X'), finiteNumber(insertionPoint[1], 'Punkt wstawienia Y')];
  const numericRotation = finiteNumber(rotation, 'Obrót');
  const numericScale = finiteNumber(scale, 'Skala');
  if (!(numericScale > 0)) throw new Error('Skala bloku musi być dodatnia.');
  const instanceId = createId('block-instance');
  const entityIdMap = new Map(block.entities.map((entity) => [entity.id, createId('entity')]));
  const entities = block.entities.map((entity) => transformTemplateEntity(entity, entityIdMap, {
    insertionPoint: point,
    rotation: numericRotation,
    scale: numericScale,
    layerId,
    blockId,
    instanceId,
  }));
  const constraintIdMap = new Map();
  const constraints = block.constraints.map((constraint) => {
    const id = createId('constraint');
    constraintIdMap.set(constraint.id, id);
    return { ...structuredClone(constraint), id, entityIds: constraint.entityIds.map((entityId) => entityIdMap.get(entityId)) };
  });
  const dimensions = block.dimensions.map((dimension) => {
    const clone = structuredClone(dimension);
    clone.id = createId('dimension');
    clone.entityIds = dimension.entityIds.map((entityId) => entityIdMap.get(entityId));
    if (dimension.constraintId && constraintIdMap.has(dimension.constraintId)) clone.constraintId = constraintIdMap.get(dimension.constraintId);
    else delete clone.constraintId;
    return clone;
  });
  const instance = {
    id: instanceId,
    blockId,
    insertionPoint: point,
    rotation: numericRotation,
    scale: numericScale,
    entityIds: entities.map((entity) => entity.id),
    attributes: Object.fromEntries(block.attributeDefinitions.map((attribute) => [attribute.tag, String(attributes[attribute.tag] ?? attribute.defaultValue)])),
  };
  sketch.entities.push(...entities);
  sketch.constraints.push(...constraints);
  sketch.dimensions.push(...dimensions);
  sketch.blockInstances.push(instance);
  return { instance, entities, constraints, dimensions };
}

export function addBlockAttributeDefinition(document, blockId, { tag, prompt = '', defaultValue = '' } = {}) {
  const block = document.blocks?.find((item) => item.id === blockId);
  if (!block) throw new Error('Nie znaleziono definicji bloku.');
  const normalizedTag = String(tag || '').trim().toUpperCase();
  if (!/^[A-Z_][A-Z0-9_]*$/.test(normalizedTag)) throw new Error('Tag atrybutu może zawierać litery, cyfry i podkreślenia.');
  if (block.attributeDefinitions.some((attribute) => attribute.tag === normalizedTag)) throw new Error(`Atrybut ${normalizedTag} już istnieje.`);
  const definition = { id: createId('block-attribute'), tag: normalizedTag, prompt: String(prompt || normalizedTag), defaultValue: String(defaultValue) };
  block.attributeDefinitions.push(definition);
  for (const sketch of document.sketches || []) for (const instance of sketch.blockInstances || []) {
    if (instance.blockId === blockId) instance.attributes[normalizedTag] = definition.defaultValue;
  }
  return definition;
}

export function updateBlockInstanceAttributes(document, sketchId, instanceId, patch) {
  const sketch = document.sketches?.find((item) => item.id === sketchId);
  const instance = sketch?.blockInstances?.find((item) => item.id === instanceId);
  if (!instance) throw new Error('Nie znaleziono wystąpienia bloku.');
  const block = document.blocks.find((item) => item.id === instance.blockId);
  const allowed = new Set(block.attributeDefinitions.map((attribute) => attribute.tag));
  for (const [tag, value] of Object.entries(patch || {})) if (allowed.has(tag)) instance.attributes[tag] = String(value);
  return instance;
}

export function explodeBlockInstance(document, sketchId, instanceId) {
  const sketch = document.sketches?.find((item) => item.id === sketchId);
  const instance = sketch?.blockInstances?.find((item) => item.id === instanceId);
  if (!instance) throw new Error('Nie znaleziono wystąpienia bloku.');
  const entityIds = new Set(instance.entityIds);
  for (const entity of sketch.entities) if (entityIds.has(entity.id)) {
    delete entity.blockDefinitionId;
    delete entity.blockInstanceId;
    delete entity.blockSourceEntityId;
  }
  sketch.blockInstances = sketch.blockInstances.filter((item) => item.id !== instanceId);
  return [...entityIds];
}

export function deleteBlockInstance(document, sketchId, instanceId) {
  const sketch = document.sketches?.find((item) => item.id === sketchId);
  const instance = sketch?.blockInstances?.find((item) => item.id === instanceId);
  if (!instance) return { entityIds: [], profileIds: [], featureIds: [] };
  sketch.blockInstances = sketch.blockInstances.filter((item) => item.id !== instanceId);
  return deleteSketchSelection(document, sketchId, instance.entityIds);
}

export function deleteBlockDefinition(document, blockId) {
  const used = (document.sketches || []).some((sketch) => sketch.blockInstances?.some((instance) => instance.blockId === blockId));
  if (used) throw new Error('Nie można usunąć definicji używanej przez wystąpienia. Najpierw usuń albo rozbij wystąpienia.');
  const before = document.blocks?.length || 0;
  document.blocks = (document.blocks || []).filter((block) => block.id !== blockId);
  return before !== document.blocks.length;
}
