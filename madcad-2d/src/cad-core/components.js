import { createId } from './ids.js';

export const COMPONENT_TYPES = Object.freeze(['part', 'assembly']);
export const DEFAULT_INSTANCE_TRANSFORM = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
});

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

function normalizedTransform(transform) {
  return Object.fromEntries(Object.keys(DEFAULT_INSTANCE_TRANSFORM).map((key) => [key, finiteCoordinate(transform?.[key])]));
}

function normalizedInstance(instance, index = 0) {
  return {
    ...instance,
    id: typeof instance?.id === 'string' && instance.id ? instance.id : createId('occurrence'),
    componentId: typeof instance?.componentId === 'string' ? instance.componentId : '',
    parentInstanceId: typeof instance?.parentInstanceId === 'string' ? instance.parentInstanceId : '',
    name: String(instance?.name || `Wystąpienie ${index + 1}`).trim().slice(0, 80) || `Wystąpienie ${index + 1}`,
    transform: normalizedTransform(instance?.transform),
    grounded: Boolean(instance?.grounded),
    visible: instance?.visible !== false,
    primary: Boolean(instance?.primary),
  };
}

function normalizedRigidGroup(group, index = 0) {
  return {
    ...group,
    id: typeof group?.id === 'string' && group.id ? group.id : createId('rigid-group'),
    name: String(group?.name || `Grupa sztywna ${index + 1}`).trim().slice(0, 80) || `Grupa sztywna ${index + 1}`,
    instanceIds: uniqueStrings(group?.instanceIds),
  };
}

function createLegacyInstances(components) {
  const byId = new Map(components.map((component) => [component.id, component]));
  const parents = componentParentMap(components);
  const instances = [];
  const visit = (componentId, parentInstanceId = '') => {
    const component = byId.get(componentId);
    if (!component) return;
    const instance = normalizedInstance({
      id: createId('occurrence'),
      componentId,
      parentInstanceId,
      name: component.name,
      primary: true,
    }, instances.length);
    instances.push(instance);
    for (const childId of component.componentIds || []) visit(childId, instance.id);
  };
  components.filter((component) => !parents.has(component.id)).forEach((component) => visit(component.id));
  return instances;
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
    linkedProjectId: typeof component?.linkedProjectId === 'string' ? component.linkedProjectId : '',
  };
}

export function ensureDocumentComponents(document) {
  if (!document || typeof document !== 'object') return document;
  if (!Array.isArray(document.components)) document.components = [];
  document.components = document.components.map(normalizedComponent);
  if (!Array.isArray(document.componentInstances)) document.componentInstances = createLegacyInstances(document.components);
  else document.componentInstances = document.componentInstances.map(normalizedInstance);
  if (!Array.isArray(document.rigidGroups)) document.rigidGroups = [];
  document.rigidGroups = document.rigidGroups.map(normalizedRigidGroup);
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

export function componentInstanceParentMap(instances = []) {
  return new Map(instances.filter((instance) => instance.parentInstanceId).map((instance) => [instance.id, instance.parentInstanceId]));
}

export function componentInstanceDescendantIds(instances = [], instanceId) {
  const children = new Map();
  for (const instance of instances) {
    if (!children.has(instance.parentInstanceId)) children.set(instance.parentInstanceId, []);
    children.get(instance.parentInstanceId).push(instance.id);
  }
  const descendants = new Set();
  const visit = (id) => {
    for (const childId of children.get(id) || []) {
      if (descendants.has(childId)) continue;
      descendants.add(childId);
      visit(childId);
    }
  };
  visit(instanceId);
  return descendants;
}

export function componentInstanceTree(document) {
  const componentList = Array.isArray(document?.components) ? document.components : [];
  const instanceList = Array.isArray(document?.componentInstances) ? document.componentInstances : [];
  const components = new Map(componentList.map((component) => [component.id, component]));
  const byId = new Map(instanceList.map((instance) => [instance.id, instance]));
  const children = new Map();
  for (const instance of instanceList) {
    if (!children.has(instance.parentInstanceId)) children.set(instance.parentInstanceId, []);
    children.get(instance.parentInstanceId).push(instance);
  }
  const build = (instance, visited = new Set()) => {
    if (!instance || visited.has(instance.id)) return null;
    const nextVisited = new Set(visited).add(instance.id);
    return {
      ...instance,
      component: components.get(instance.componentId) || null,
      children: (children.get(instance.id) || []).map((child) => build(byId.get(child.id), nextVisited)).filter(Boolean),
    };
  };
  return (children.get('') || []).map((instance) => build(instance)).filter(Boolean);
}

function primaryInstance(document, componentId) {
  return document.componentInstances.find((instance) => instance.componentId === componentId && instance.primary)
    || document.componentInstances.find((instance) => instance.componentId === componentId)
    || null;
}

function uniqueInstanceName(document, component, requestedName = '') {
  const base = String(requestedName || component?.name || 'Wystąpienie').trim().slice(0, 80) || 'Wystąpienie';
  const used = new Set(document.componentInstances.map((instance) => instance.name.toLocaleLowerCase()));
  if (!used.has(base.toLocaleLowerCase())) return base;
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base}:${suffix}`.slice(0, 80);
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('Nie można utworzyć unikalnej nazwy wystąpienia.');
}

function assertInstanceParent(document, componentId, parentInstanceId, instanceId = '') {
  if (!parentInstanceId) return;
  if (parentInstanceId === instanceId) throw new Error('Wystąpienie nie może być własnym rodzicem.');
  const parent = document.componentInstances.find((instance) => instance.id === parentInstanceId);
  if (!parent) throw new Error('Nie znaleziono nadrzędnego wystąpienia.');
  const parentComponent = document.components.find((component) => component.id === parent.componentId);
  if (parentComponent?.type !== 'assembly') throw new Error('Wystąpienia można umieszczać tylko wewnątrz złożenia.');
  if (instanceId && componentInstanceDescendantIds(document.componentInstances, instanceId).has(parentInstanceId)) {
    throw new Error('Nie można utworzyć cyklu w drzewie wystąpień.');
  }
  let cursor = parent;
  const visited = new Set();
  while (cursor && !visited.has(cursor.id)) {
    if (cursor.componentId === componentId) throw new Error('Złożenie nie może zawierać rekurencyjnego wystąpienia własnej definicji.');
    visited.add(cursor.id);
    cursor = document.componentInstances.find((instance) => instance.id === cursor.parentInstanceId);
  }
}

export function createComponentInstance(document, {
  componentId,
  parentInstanceId = '',
  name = '',
  transform = DEFAULT_INSTANCE_TRANSFORM,
  grounded = false,
  visible = true,
  primary = false,
} = {}) {
  ensureDocumentComponents(document);
  const component = document.components.find((item) => item.id === componentId);
  if (!component) throw new Error('Nie znaleziono definicji komponentu.');
  assertInstanceParent(document, componentId, parentInstanceId);
  const instance = normalizedInstance({
    id: createId('occurrence'),
    componentId,
    parentInstanceId,
    name: uniqueInstanceName(document, component, name),
    transform,
    grounded,
    visible,
    primary,
  }, document.componentInstances.length);
  document.componentInstances.push(instance);
  if (typeof document.activeAssemblyConfigurationId === 'string') document.activeAssemblyConfigurationId = '';
  return instance;
}

export function updateComponentInstance(document, instanceId, patch = {}) {
  ensureDocumentComponents(document);
  const instance = document.componentInstances.find((item) => item.id === instanceId);
  if (!instance) throw new Error('Nie znaleziono wystąpienia komponentu.');
  const parentInstanceId = patch.parentInstanceId === undefined ? instance.parentInstanceId : String(patch.parentInstanceId || '');
  assertInstanceParent(document, instance.componentId, parentInstanceId, instance.id);
  const nextTransform = patch.transform === undefined ? instance.transform : normalizedTransform({ ...instance.transform, ...patch.transform });
  const transformChanged = Object.keys(DEFAULT_INSTANCE_TRANSFORM).some((key) => nextTransform[key] !== instance.transform[key]);
  const drivingJoint = (document.joints || []).find((joint) => joint.enabled !== false && joint.movingInstanceId === instance.id);
  if (drivingJoint && transformChanged) throw new Error(`Położeniem wystąpienia steruje joint „${drivingJoint.name}”. Zmień wartość jointa.`);
  if (drivingJoint && patch.grounded === true) throw new Error('Ruchomego wystąpienia sterowanego jointem nie można uziemić.');
  const group = document.rigidGroups.find((item) => item.instanceIds.includes(instance.id));
  if (group && parentInstanceId !== instance.parentInstanceId) throw new Error('Najpierw rozwiąż grupę sztywną, aby zmienić jej złożenie nadrzędne.');
  if (transformChanged && (instance.grounded || group?.instanceIds.some((id) => document.componentInstances.find((item) => item.id === id)?.grounded))) {
    throw new Error('Uziemionego wystąpienia ani jego grupy sztywnej nie można przesunąć.');
  }
  if (transformChanged && group) {
    const delta = Object.fromEntries(Object.keys(DEFAULT_INSTANCE_TRANSFORM).map((key) => [key, nextTransform[key] - instance.transform[key]]));
    for (const member of document.componentInstances.filter((item) => group.instanceIds.includes(item.id))) {
      member.transform = normalizedTransform(Object.fromEntries(Object.keys(DEFAULT_INSTANCE_TRANSFORM).map((key) => [key, member.transform[key] + delta[key]])));
    }
  } else instance.transform = nextTransform;
  const stateChanged = transformChanged
    || parentInstanceId !== instance.parentInstanceId
    || (patch.grounded !== undefined && Boolean(patch.grounded) !== instance.grounded)
    || (patch.visible !== undefined && Boolean(patch.visible) !== instance.visible);
  Object.assign(instance, {
    parentInstanceId,
    name: patch.name === undefined ? instance.name : String(patch.name || '').trim().slice(0, 80) || instance.name,
    grounded: patch.grounded === undefined ? instance.grounded : Boolean(patch.grounded),
    visible: patch.visible === undefined ? instance.visible : Boolean(patch.visible),
  });
  if (stateChanged && typeof document.activeAssemblyConfigurationId === 'string') document.activeAssemblyConfigurationId = '';
  return instance;
}

export function duplicateComponentInstance(document, instanceId, { parentInstanceId, transform } = {}) {
  ensureDocumentComponents(document);
  const source = document.componentInstances.find((instance) => instance.id === instanceId);
  if (!source) throw new Error('Nie znaleziono wystąpienia do powielenia.');
  const children = document.componentInstances.filter((instance) => instance.parentInstanceId === source.id);
  const duplicate = createComponentInstance(document, {
    componentId: source.componentId,
    parentInstanceId: parentInstanceId === undefined ? source.parentInstanceId : parentInstanceId,
    transform: transform || { ...source.transform, x: source.transform.x + 20 },
    name: source.name,
    visible: source.visible,
  });
  for (const child of children) duplicateComponentInstance(document, child.id, { parentInstanceId: duplicate.id, transform: child.transform });
  return duplicate;
}

function cleanupAssemblyStateForInstances(document, removedIds) {
  const removedJointIds = new Set((document.joints || [])
    .filter((joint) => removedIds.has(joint.referenceInstanceId) || removedIds.has(joint.movingInstanceId))
    .map((joint) => joint.id));
  if (Array.isArray(document.joints)) document.joints = document.joints.filter((joint) => !removedJointIds.has(joint.id));
  if (Array.isArray(document.motionLinks)) document.motionLinks = document.motionLinks.filter((link) => !removedJointIds.has(link.sourceJointId) && !removedJointIds.has(link.targetJointId));
  if (Array.isArray(document.contactSets)) document.contactSets = document.contactSets.filter((contactSet) => !removedIds.has(contactSet.firstInstanceId) && !removedIds.has(contactSet.secondInstanceId));
  if (Array.isArray(document.assemblyConfigurations)) {
    document.assemblyConfigurations = document.assemblyConfigurations.map((configuration) => ({
      ...configuration,
      instanceStates: (configuration.instanceStates || []).filter((state) => !removedIds.has(state.instanceId)),
      jointStates: (configuration.jointStates || []).filter((state) => !removedJointIds.has(state.jointId)),
    }));
  }
}

export function deleteComponentInstance(document, instanceId, { cascade = true } = {}) {
  ensureDocumentComponents(document);
  const instance = document.componentInstances.find((item) => item.id === instanceId);
  if (!instance) throw new Error('Nie znaleziono wystąpienia komponentu.');
  const removedIds = cascade
    ? new Set([instanceId, ...componentInstanceDescendantIds(document.componentInstances, instanceId)])
    : new Set([instanceId]);
  document.componentInstances = document.componentInstances
    .filter((item) => !removedIds.has(item.id))
    .map((item) => !cascade && item.parentInstanceId === instanceId ? { ...item, parentInstanceId: instance.parentInstanceId } : item);
  document.rigidGroups = document.rigidGroups
    .map((group) => ({ ...group, instanceIds: group.instanceIds.filter((id) => !removedIds.has(id)) }))
    .filter((group) => group.instanceIds.length >= 2);
  cleanupAssemblyStateForInstances(document, removedIds);
  if (typeof document.activeAssemblyConfigurationId === 'string') document.activeAssemblyConfigurationId = '';
  return [...removedIds];
}

export function createRigidGroup(document, instanceIds, name = '') {
  ensureDocumentComponents(document);
  const ids = uniqueStrings(instanceIds);
  if (ids.length < 2) throw new Error('Grupa sztywna wymaga co najmniej dwóch wystąpień.');
  if (ids.some((id) => !document.componentInstances.some((instance) => instance.id === id))) throw new Error('Grupa sztywna zawiera nieistniejące wystąpienie.');
  const parents = new Set(ids.map((id) => document.componentInstances.find((instance) => instance.id === id).parentInstanceId));
  if (parents.size !== 1) throw new Error('Elementy grupy sztywnej muszą mieć to samo złożenie nadrzędne.');
  if (document.rigidGroups.some((group) => group.instanceIds.some((id) => ids.includes(id)))) throw new Error('Wystąpienie może należeć tylko do jednej grupy sztywnej.');
  if ((document.joints || []).some((joint) => ids.includes(joint.movingInstanceId))) throw new Error('Wystąpienie sterowane jointem nie może należeć do Rigid Group.');
  const group = normalizedRigidGroup({ id: createId('rigid-group'), name, instanceIds: ids }, document.rigidGroups.length);
  document.rigidGroups.push(group);
  return group;
}

export function deleteRigidGroup(document, groupId) {
  ensureDocumentComponents(document);
  const index = document.rigidGroups.findIndex((group) => group.id === groupId);
  if (index < 0) throw new Error('Nie znaleziono grupy sztywnej.');
  return document.rigidGroups.splice(index, 1)[0];
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
  createInstance = true,
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
  if (createInstance && !primaryInstance(document, component.id)) {
    const parentOccurrence = parentId ? primaryInstance(document, parentId) : null;
    createComponentInstance(document, {
      componentId: component.id,
      parentInstanceId: parentOccurrence?.id || '',
      name: component.name,
      primary: true,
    });
  }
  return component;
}

export function updateComponent(document, componentId, patch = {}) {
  ensureDocumentComponents(document);
  const index = document.components.findIndex((component) => component.id === componentId);
  if (index < 0) throw new Error('Nie znaleziono komponentu.');
  const current = document.components[index];
  const type = patch.type === undefined ? current.type : patch.type === 'assembly' ? 'assembly' : 'part';
  const hasOccurrenceChildren = document.componentInstances.some((instance) => instance.componentId === componentId
    && document.componentInstances.some((child) => child.parentInstanceId === instance.id));
  if (type === 'part' && (current.componentIds.length || hasOccurrenceChildren)) throw new Error('Komponent zawierający podkomponenty musi pozostać złożeniem.');
  const next = normalizedComponent({
    ...current,
    ...patch,
    id: current.id,
    name: patch.name === undefined ? current.name : uniqueComponentName(document, patch.name, current.id),
    type,
    componentIds: type === 'assembly' ? current.componentIds : [],
  }, index);
  document.components[index] = next;
  const occurrence = primaryInstance(document, componentId);
  if (occurrence && patch.name !== undefined) occurrence.name = next.name;
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
  const occurrence = primaryInstance(document, componentId);
  if (!parentId) {
    if (occurrence) occurrence.parentInstanceId = '';
    return component;
  }
  const parent = document.components.find((item) => item.id === parentId);
  if (!parent) throw new Error('Nie znaleziono złożenia docelowego.');
  parent.type = 'assembly';
  parent.componentIds = uniqueStrings([...parent.componentIds, componentId]);
  const parentOccurrence = primaryInstance(document, parentId);
  if (occurrence && parentOccurrence) occurrence.parentInstanceId = parentOccurrence.id;
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
  const sourceInstances = document.componentInstances;
  const removedInstanceIds = new Set(sourceInstances.filter((instance) => removedIds.has(instance.componentId)).map((instance) => instance.id));
  const survivingParent = (parentInstanceId) => {
    let parentId = parentInstanceId;
    const visited = new Set();
    while (parentId && removedInstanceIds.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      parentId = sourceInstances.find((instance) => instance.id === parentId)?.parentInstanceId || '';
    }
    return parentId;
  };
  document.componentInstances = sourceInstances
    .filter((instance) => !removedInstanceIds.has(instance.id))
    .map((instance) => removedInstanceIds.has(instance.parentInstanceId) ? { ...instance, parentInstanceId: survivingParent(instance.parentInstanceId) } : instance);
  document.rigidGroups = document.rigidGroups
    .map((group) => ({ ...group, instanceIds: group.instanceIds.filter((id) => !removedInstanceIds.has(id)) }))
    .filter((group) => group.instanceIds.length >= 2);
  cleanupAssemblyStateForInstances(document, removedInstanceIds);
  if (typeof document.activeAssemblyConfigurationId === 'string') document.activeAssemblyConfigurationId = '';
  return [...removedIds];
}

export function componentBomEntries(components = [], instances = []) {
  if (instances.length) {
    const document = ensureDocumentComponents({ components, componentInstances: instances, rigidGroups: [] });
    const entries = new Map();
    const visit = (instance, inheritedQuantity = 1) => {
      const component = instance.component;
      if (!component) return;
      const quantity = inheritedQuantity * normalizedQuantity(component.quantity);
      if (component.type === 'part' || component.bodyIds?.length) {
        const current = entries.get(component.id);
        if (current) current.effectiveQuantity += quantity;
        else entries.set(component.id, { ...component, effectiveQuantity: quantity });
      }
      for (const child of instance.children || []) visit(child, quantity);
    };
    componentInstanceTree(document).forEach((instance) => visit(instance));
    return [...entries.values()];
  }
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
