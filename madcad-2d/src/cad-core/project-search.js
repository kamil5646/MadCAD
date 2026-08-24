export const PROJECT_SEARCH_KINDS = Object.freeze(['parameter', 'sketch', 'feature', 'body', 'component', 'component-instance', 'drawing', 'linked-project', 'reference', 'document']);

const KIND_ORDER = new Map(PROJECT_SEARCH_KINDS.map((kind, index) => [kind, index]));
const KIND_KEYWORDS = Object.freeze({
  parameter: 'parametr parameter wymiar variable',
  sketch: 'szkic sketch 2d',
  feature: 'operacja feature historia timeline 3d',
  body: 'bryla body solid korpus',
  component: 'komponent component czesc part zlozenie assembly',
  'component-instance': 'wystapienie occurrence instance komponent',
  drawing: 'arkusz drawing sheet dokumentacja 2d',
  'linked-project': 'projekt linkowany linked external source',
  reference: 'konstrukcja reference plane axis point plaszczyzna os punkt',
  document: 'dokument document projekt project',
});

export function normalizeProjectSearchText(value) {
  return String(value || '').replace(/[łŁ]/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pl').replace(/[^a-z0-9]+/g, ' ').trim();
}

function bodyProducer(feature) {
  return ((['extrude', 'revolve', 'sweep', 'loft', 'coil', 'pipe'].includes(feature.type) && feature.operation === 'new')
    || feature.type === 'primitive'
    || feature.type === 'importedModel'
    || feature.type === 'splitBody'
    || (feature.type === 'textSolid' && feature.operation === 'new'));
}

function compareItems(left, right) {
  return (KIND_ORDER.get(left.kind) ?? 99) - (KIND_ORDER.get(right.kind) ?? 99)
    || left.label.localeCompare(right.label, 'pl')
    || left.id.localeCompare(right.id);
}

function addItem(items, seen, item) {
  if (!item.id || seen.has(item.id)) return;
  seen.add(item.id);
  const label = String(item.label || item.id);
  items.push({ ...item, label, searchText: normalizeProjectSearchText(`${label} ${item.secondary || ''} ${KIND_KEYWORDS[item.kind] || item.kind}`) });
}

function referenceTarget(reference) {
  const kind = reference.kind === 'construction-axis' ? 'constructionAxis' : reference.kind === 'construction-point' ? 'constructionPoint' : reference.kind === 'construction-plane' ? 'constructionPlane' : 'document';
  return { kind, id: kind === 'document' ? '' : reference.id };
}

export function buildProjectSearchIndex(document) {
  const items = [];
  const seen = new Set();
  addItem(items, seen, { id: document?.id || '', kind: 'document', label: document?.name || 'Projekt', secondary: 'Projekt', target: { kind: 'document', id: document?.id || '' } });
  for (const parameter of document?.parameters || []) addItem(items, seen, { id: parameter.id, kind: 'parameter', label: parameter.label || parameter.name, secondary: `${parameter.name} ${parameter.expression || ''}`, target: { kind: 'settings', id: parameter.id, parameterName: parameter.name } });
  for (const sketch of document?.sketches || []) addItem(items, seen, { id: sketch.id, kind: 'sketch', label: sketch.name, secondary: sketch.plane || '', target: { kind: 'sketch', id: sketch.id } });
  for (const feature of document?.features || []) {
    addItem(items, seen, { id: feature.id, kind: 'feature', label: feature.name, secondary: feature.type, target: { kind: 'feature', id: feature.id } });
    if (bodyProducer(feature)) addItem(items, seen, { id: `body-${feature.id}`, kind: 'body', label: feature.name, secondary: feature.type, target: { kind: 'body', id: `body-${feature.id}` } });
  }
  for (const body of document?.bodies || []) addItem(items, seen, { id: body.id, kind: 'body', label: body.name || body.id, secondary: 'body', target: { kind: 'body', id: body.id } });
  for (const component of document?.components || []) addItem(items, seen, { id: component.id, kind: 'component', label: component.name, secondary: `${component.type || ''} ${component.partNumber || ''}`, target: { kind: 'component', id: component.id } });
  for (const instance of document?.componentInstances || []) addItem(items, seen, { id: instance.id, kind: 'component-instance', label: instance.name, secondary: instance.componentId || '', target: { kind: 'componentInstance', id: instance.id, componentId: instance.componentId } });
  for (const sheet of document?.drawings || []) addItem(items, seen, { id: sheet.id, kind: 'drawing', label: sheet.name, secondary: `${sheet.size || ''} ${sheet.orientation || ''}`, target: { kind: 'drawingSheet', id: sheet.id } });
  for (const link of document?.linkedProjects || []) addItem(items, seen, { id: link.id, kind: 'linked-project', label: link.sourceName || link.fileName || link.id, secondary: `${link.fileName || ''} ${link.relativePath || ''}`, target: { kind: 'component', id: link.linkedComponentId || '', linkedProjectId: link.id } });
  for (const reference of document?.references || []) addItem(items, seen, { id: reference.id, kind: 'reference', label: reference.name || reference.label || reference.id, secondary: `${reference.kind || ''} ${reference.planeType || reference.axisType || reference.pointType || ''}`, target: referenceTarget(reference) });
  return items.sort(compareItems);
}

function itemScore(item, normalizedQuery, tokens) {
  const label = normalizeProjectSearchText(item.label);
  let score = label === normalizedQuery ? 1000 : label.startsWith(normalizedQuery) ? 700 : label.includes(normalizedQuery) ? 450 : 0;
  for (const token of tokens) {
    if (!item.searchText.includes(token)) return -1;
    if (label === token) score += 220;
    else if (label.startsWith(token)) score += 120;
    else if (label.includes(token)) score += 70;
    else score += 25;
  }
  return score - Math.min(50, label.length / 4);
}

export function searchProjectIndex(index, query, { limit = 30 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const normalizedQuery = normalizeProjectSearchText(query);
  if (!normalizedQuery) return (index || []).slice(0, safeLimit).map((item) => ({ ...item, score: 0 }));
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return (index || []).map((item) => ({ ...item, score: itemScore(item, normalizedQuery, tokens) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || compareItems(left, right))
    .slice(0, safeLimit);
}

export function searchProject(document, query, options) {
  return searchProjectIndex(buildProjectSearchIndex(document), query, options);
}
