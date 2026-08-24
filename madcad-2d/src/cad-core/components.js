import { createId } from './ids.js';

export const COMPONENT_TYPES = Object.freeze(['part', 'assembly']);

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value))];
}

function finiteCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizedOrigin(origin) {
  return {
    x: finiteCoordinate(origin?.x),
    y: finiteCoordinate(origin?.y),
    z: finiteCoordinate(origin?.z),
  };
}

function normalizedQuantity(value) {
  const quantity = Math.trunc(Number(value));
  return Math.max(1, Math.min(9999, Number.isFinite(quantity) ? quantity : 1));
}

function normalizedComponent(component, index = 0) {
  const componentIds = uniqueStrings(component?.componentIds);
  const bodyIds = uniqueStrings(component?.bodyIds);
  const type = COMPONENT_TYPES.includes(component?.type)
    ? component.type
    : componentIds.length ? 'assembly' : 'part';
  return {
    ...component,
    name: String(component?.name || `Komponent ${index + 1}`).trim().slice(0, 80) || `Komponent ${index + 1}`,
    type,
    partNumber: String(component?.partNumber || `MC-${String(index + 1).padStart(3, '0')}`).trim().slice(0, 60),
    description: String(component?.description || '').trim().slice(0, 240),
    material: String(component?.material || '').trim().slice(0, 80),
    quantity: normalizedQuantity(component?.quantity),
    origin: normalizedOrigin(component?.origin),
    bodyIds,
    sketchIds: uniqueStrings(component?.sketchIds),
    componentIds: type === 'assembly' ? componentIds : [],
  };
}

export function ensureDocumentComponents(document) {
  if (!document || typeof document !== 'object') return document;
  if (!Array.isArray(document.components)) document.components = [];
  document.components = document.components.map(normalizedComponent);
  return document;
}

function uniqueComponentName(document, requestedName, excludedId = '') {
  const base = String(requestedName || 'Komponent').trim().slice(0, 80) || 'Komponent';
  const used = new Set((document.components || [])
    .filter((component) => component.id !== excludedId)
    .map((component) => component.name.toLocaleLowerCase()));
  if (!used.has(base.toLocaleLowerCase())) return base;
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base} ${suffix}`.slice(0, 80);
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('Nie można utworzyć unikalnej nazwy komponentu.');
}

function nextPartNumber(document) {
  const used = new Set((document.components || []).map((component) => component.partNumber).filter(Boolean));
  for (let index = 1; index < 100000; index += 1) {
    const candidate = `MC-${String(index).padStart(3, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  return `MC-${Date.now()}`;
}

export function componentParentMap(components = []) {
  const parents = new Map();
  for (const component of components) {
    for (const childId of component.componentIds || []) if (!parents.has(childId)) parents.set(childId, component.id);
  }
  return parents;
}

export function componentDescendantIds(components = [], componentId) {
  const byId = new Map(components.map((component) => [component.id, component]));
  const descendants = new Set();
  const visit = (id) => {
    for (const childId of byId.get(id)?.componentIds || []) {
      if (descendants.has(childId)) continue;
      descendants.add(childId);
      visit(childId);
    }
  };
  visit(componentId);
  return descendants;
}

export function componentTree(components = []) {
  const byId = new Map(components.map((component) => [component.id, component]));
  const parents = componentParentMap(components);
  const build = (component, visited = new Set()) => {
    if (!component || visited.has(component.id)) return null;
    const nextVisited = new Set(visited).add(component.id);
    return {
      ...component,
      children: (component.componentIds || []).map((id) => build(byId.get(id), nextVisited)).filter(Boolean),
    };
  };
  return components.filter((component) => !parents.has(component.id)).map((component) => build(component)).filter(Boolean);
}

export function createComponent(document, {
  name,
  type = 'part',
  partNumber,
  description = '',
  material = '',
  quantity = 1,
  origin = { x: 0, y: 0, z: 0 },
  bodyIds = [],
  sketchIds = [],
  componentIds = [],
  parentId = '',
} = {}) {
  ensureDocumentComponents(document);
  const normalizedType = type === 'assembly' ? 'assembly' : 'part';
  const component = normalizedComponent({
    id: createId('component'),
    name: uniqueComponentName(document, name || (normalizedType === 'assembly' ? 'Złożenie' : 'Komponent')),
    type: normalizedType,
    partNumber: String(partNumber || nextPartNumber(document)).trim(),
    description,
    material,
    quantity,
    origin,
    bodyIds,
    sketchIds,
    componentIds: normalizedType === 'assembly' ? componentIds : [],
  }, document.components.length);
  document.components.push(component);
  if (component.bodyIds.length) assignBodiesToComponent(document, component.id, component.bodyIds);
  if (parentId) moveComponent(document, component.id, parentId);
  return component;
}

export function updateComponent(document, componentId, patch = {}) {
  ensureDocumentComponents(document);
  const index = document.components.findIndex((component) => component.id === componentId);
  if (index < 0) throw new Error('Nie znaleziono komponentu.');
  const current = document.components[index];
  const type = patch.type === undefined ? current.type : patch.type === 'assembly' ? 'assembly' : 'part';
  if (type === 'part' && current.componentIds.length) throw new Error('Komponent zawierający podkomponenty musi pozostać złożeniem.');
  const next = normalizedComponent({
    ...current,
    ...patch,
    id: current.id,
    name: patch.name === undefined ? current.name : uniqueComponentName(document, patch.name, current.id),
    type,
    componentIds: type === 'assembly' ? current.componentIds : [],
  }, index);
  document.components[index] = next;
  return next;
}

export function assignBodiesToComponent(document, componentId, bodyIds = []) {
  ensureDocumentComponents(document);
  const component = document.components.find((item) => item.id === componentId);
  if (!component) throw new Error('Nie znaleziono komponentu.');
  const assigned = uniqueStrings(bodyIds);
  for (const item of document.components) item.bodyIds = item.id === componentId
    ? assigned
    : item.bodyIds.filter((bodyId) => !assigned.includes(bodyId));
  component.bodyIds = assigned;
  return component;
}

export function moveComponent(document, componentId, parentId = '') {
  ensureDocumentComponents(document);
  const component = document.components.find((item) => item.id === componentId);
  if (!component) throw new Error('Nie znaleziono przenoszonego komponentu.');
  if (parentId === componentId) throw new Error('Komponent nie może być własnym rodzicem.');
  const descendants = componentDescendantIds(document.components, componentId);
  if (parentId && descendants.has(parentId)) throw new Error('Nie można przenieść komponentu do jego podkomponentu.');
  for (const item of document.components) item.componentIds = item.componentIds.filter((id) => id !== componentId);
  if (!parentId) return component;
  const parent = document.components.find((item) => item.id === parentId);
  if (!parent) throw new Error('Nie znaleziono złożenia docelowego.');
  parent.type = 'assembly';
  parent.componentIds = uniqueStrings([...parent.componentIds, componentId]);
  return component;
}

export function deleteComponent(document, componentId, { cascade = false } = {}) {
  ensureDocumentComponents(document);
  const component = document.components.find((item) => item.id === componentId);
  if (!component) throw new Error('Nie znaleziono komponentu.');
  const removedIds = cascade
    ? new Set([componentId, ...componentDescendantIds(document.components, componentId)])
    : new Set([componentId]);
  const parentId = componentParentMap(document.components).get(componentId);
  const promotedIds = cascade ? [] : component.componentIds.filter((id) => !removedIds.has(id));
  document.components = document.components
    .filter((item) => !removedIds.has(item.id))
    .map((item) => ({
      ...item,
      componentIds: uniqueStrings([
        ...item.componentIds.filter((id) => !removedIds.has(id)),
        ...(item.id === parentId ? promotedIds : []),
      ]),
    }));
  return [...removedIds];
}

export function componentBomEntries(components = []) {
  const roots = componentTree(components);
  const entries = [];
  const visit = (component, inheritedQuantity = 1) => {
    const quantity = inheritedQuantity * normalizedQuantity(component.quantity);
    if (component.type === 'part' || component.bodyIds?.length) entries.push({ ...component, effectiveQuantity: quantity });
    for (const child of component.children || []) visit(child, quantity);
  };
  roots.forEach((component) => visit(component));
  return entries;
}
