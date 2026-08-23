import { createId } from './ids.js';

export const DEFAULT_LAYER_ID = 'layer-0';
export const BY_LAYER = 'by-layer';

export const LINE_TYPES = Object.freeze([
  { id: 'continuous', label: 'Ciągła', dashSize: 0, gapSize: 0 },
  { id: 'dashed', label: 'Kreskowa', dashSize: 3.2, gapSize: 1.6 },
  { id: 'center', label: 'Osiowa', dashSize: 6, gapSize: 1.4 },
  { id: 'dashdot', label: 'Kreska-kropka', dashSize: 4.5, gapSize: 1.1 },
]);

export const LINE_WEIGHTS = Object.freeze([0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1]);

const LINE_TYPE_IDS = new Set(LINE_TYPES.map((item) => item.id));

export function createLayer({
  id = createId('layer'),
  name = 'Nowa warstwa',
  color = '#74cef0',
  lineType = 'continuous',
  lineWeight = 0.25,
  visible = true,
  locked = false,
  printable = true,
} = {}) {
  return { id, name, color, lineType, lineWeight, visible, locked, printable };
}

export function createDefaultLayer() {
  return createLayer({ id: DEFAULT_LAYER_ID, name: '0', color: '#74cef0' });
}

export function normalizeEntityLayerStyle(entity, fallbackLayerId = DEFAULT_LAYER_ID) {
  return {
    ...entity,
    layerId: typeof entity?.layerId === 'string' && entity.layerId ? entity.layerId : fallbackLayerId,
    color: entity?.color || BY_LAYER,
    lineType: entity?.lineType || BY_LAYER,
    lineWeight: entity?.lineWeight ?? BY_LAYER,
  };
}

export function ensureDocumentLayers(document) {
  if (!document || typeof document !== 'object') return document;
  const sourceLayers = Array.isArray(document.layers) && document.layers.length
    ? document.layers
    : [createDefaultLayer()];
  document.layers = sourceLayers.map((layer, index) => createLayer({
    ...layer,
    id: layer?.id || (index === 0 ? DEFAULT_LAYER_ID : createId('layer')),
    name: layer?.name || (index === 0 ? '0' : `Warstwa ${index}`),
  }));
  const layerIds = new Set(document.layers.map((layer) => layer.id));
  document.activeLayerId = layerIds.has(document.activeLayerId)
    ? document.activeLayerId
    : document.layers[0].id;
  for (const sketch of document.sketches || []) {
    if (!Array.isArray(sketch?.entities)) continue;
    sketch.entities = sketch.entities.map((entity) => normalizeEntityLayerStyle(
      entity,
      layerIds.has(entity?.layerId) ? entity.layerId : document.activeLayerId,
    ));
  }
  return document;
}

export function resolveEntityAppearance(document, entity) {
  const layers = Array.isArray(document?.layers) && document.layers.length
    ? document.layers
    : [createDefaultLayer()];
  const layer = layers.find((item) => item.id === entity?.layerId) || layers[0];
  return {
    layer,
    color: entity?.color && entity.color !== BY_LAYER ? entity.color : layer.color,
    lineType: entity?.lineType && entity.lineType !== BY_LAYER ? entity.lineType : layer.lineType,
    lineWeight: entity?.lineWeight !== undefined && entity.lineWeight !== BY_LAYER ? Number(entity.lineWeight) : layer.lineWeight,
    visible: layer.visible,
    locked: layer.locked,
    printable: layer.printable,
  };
}

export function assignEntitiesToLayer(document, sketchId, entityIds, layerId) {
  if (!document?.layers?.some((layer) => layer.id === layerId)) throw new Error('Nie znaleziono wybranej warstwy.');
  const sketch = document.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono szkicu.');
  const selected = new Set(entityIds || []);
  let changed = 0;
  sketch.entities = sketch.entities.map((entity) => {
    if (!selected.has(entity.id)) return entity;
    changed += 1;
    return { ...entity, layerId };
  });
  return changed;
}

export function deleteLayer(document, layerId, replacementLayerId = DEFAULT_LAYER_ID) {
  if (layerId === DEFAULT_LAYER_ID) throw new Error('Warstwy 0 nie można usunąć.');
  if (!document?.layers?.some((layer) => layer.id === layerId)) return 0;
  const replacement = document.layers.find((layer) => layer.id === replacementLayerId)
    || document.layers.find((layer) => layer.id !== layerId);
  if (!replacement) throw new Error('Dokument musi zawierać co najmniej jedną warstwę.');
  let reassigned = 0;
  for (const sketch of document.sketches || []) {
    sketch.entities = (sketch.entities || []).map((entity) => {
      if (entity.layerId !== layerId) return entity;
      reassigned += 1;
      return { ...entity, layerId: replacement.id };
    });
  }
  document.layers = document.layers.filter((layer) => layer.id !== layerId);
  if (document.activeLayerId === layerId) document.activeLayerId = replacement.id;
  return reassigned;
}

export function lineTypeDefinition(lineType) {
  return LINE_TYPES.find((item) => item.id === lineType) || LINE_TYPES[0];
}

export function isSupportedLineType(value) {
  return LINE_TYPE_IDS.has(value);
}
