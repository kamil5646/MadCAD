import { createId } from './ids.js';
import { DEFAULT_INSTANCE_TRANSFORM, ensureDocumentComponents } from './components.js';

export const JOINT_TYPES = Object.freeze(['rigid', 'revolute', 'slider']);
export const JOINT_AXES = Object.freeze(['x', 'y', 'z']);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedTransform(transform) {
  return Object.fromEntries(Object.keys(DEFAULT_INSTANCE_TRANSFORM).map((key) => [key, finiteNumber(transform?.[key])]));
}

function normalizedLimits(limits) {
  const min = finiteNumber(limits?.min, -90);
  const max = finiteNumber(limits?.max, 90);
  return { enabled: limits?.enabled !== false, min: Math.min(min, max), max: Math.max(min, max) };
}

function normalizedAnchor(anchor) {
  return { x: finiteNumber(anchor?.x), y: finiteNumber(anchor?.y), z: finiteNumber(anchor?.z) };
}

function normalizedJoint(joint, index = 0) {
  const type = JOINT_TYPES.includes(joint?.type) ? joint.type : 'rigid';
  return {
    ...joint,
    id: typeof joint?.id === 'string' && joint.id ? joint.id : createId('joint'),
    name: String(joint?.name || `Joint ${index + 1}`).trim().slice(0, 80) || `Joint ${index + 1}`,
    type,
    referenceInstanceId: typeof joint?.referenceInstanceId === 'string' ? joint.referenceInstanceId : '',
    movingInstanceId: typeof joint?.movingInstanceId === 'string' ? joint.movingInstanceId : '',
    axis: JOINT_AXES.includes(joint?.axis) ? joint.axis : 'z',
    axisReference: {
      kind: 'component-origin-axis',
      instanceId: typeof joint?.axisReference?.instanceId === 'string' ? joint.axisReference.instanceId : String(joint?.referenceInstanceId || ''),
      axis: JOINT_AXES.includes(joint?.axisReference?.axis) ? joint.axisReference.axis : JOINT_AXES.includes(joint?.axis) ? joint.axis : 'z',
    },
    anchor: normalizedAnchor(joint?.anchor),
    limits: normalizedLimits(joint?.limits),
    value: finiteNumber(joint?.value),
    restTransform: normalizedTransform(joint?.restTransform),
    enabled: joint?.enabled !== false,
  };
}

function normalizedMotionLink(link, index = 0) {
  return {
    ...link,
    id: typeof link?.id === 'string' && link.id ? link.id : createId('motion-link'),
    name: String(link?.name || `Motion Link ${index + 1}`).trim().slice(0, 80) || `Motion Link ${index + 1}`,
    sourceJointId: typeof link?.sourceJointId === 'string' ? link.sourceJointId : '',
    targetJointId: typeof link?.targetJointId === 'string' ? link.targetJointId : '',
    ratio: finiteNumber(link?.ratio, 1),
    offset: finiteNumber(link?.offset),
    enabled: link?.enabled !== false,
  };
}

export function ensureDocumentJoints(document) {
  ensureDocumentComponents(document);
  if (!Array.isArray(document.joints)) document.joints = [];
  document.joints = document.joints.map(normalizedJoint);
  if (!Array.isArray(document.motionLinks)) document.motionLinks = [];
  document.motionLinks = document.motionLinks.map(normalizedMotionLink);
  return document;
}

function uniqueJointName(document, requestedName = '') {
  const base = String(requestedName || `Joint ${document.joints.length + 1}`).trim().slice(0, 80) || 'Joint';
  const used = new Set(document.joints.map((joint) => joint.name.toLocaleLowerCase()));
  if (!used.has(base.toLocaleLowerCase())) return base;
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base} ${suffix}`.slice(0, 80);
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('Nie można utworzyć unikalnej nazwy jointa.');
}

function jointInstances(document, referenceInstanceId, movingInstanceId) {
  const reference = document.componentInstances.find((instance) => instance.id === referenceInstanceId);
  const moving = document.componentInstances.find((instance) => instance.id === movingInstanceId);
  if (!reference || !moving) throw new Error('Joint wymaga dwóch istniejących wystąpień.');
  if (reference.id === moving.id) throw new Error('Joint nie może łączyć wystąpienia z nim samym.');
  if (reference.parentInstanceId !== moving.parentInstanceId) throw new Error('Łączone wystąpienia muszą należeć do tego samego złożenia.');
  if (moving.grounded) throw new Error('Ruchome wystąpienie nie może mieć włączonego Ground.');
  if (document.rigidGroups.some((group) => group.instanceIds.includes(moving.id))) throw new Error('Najpierw usuń ruchome wystąpienie z Rigid Group.');
  return { reference, moving };
}

function assertJointGraph(document, referenceInstanceId, movingInstanceId, excludedJointId = '') {
  if (document.joints.some((joint) => joint.id !== excludedJointId && joint.movingInstanceId === movingInstanceId)) {
    throw new Error('Ruchome wystąpienie ma już joint sterujący jego położeniem.');
  }
  const referenceByMoving = new Map(document.joints
    .filter((joint) => joint.id !== excludedJointId)
    .map((joint) => [joint.movingInstanceId, joint.referenceInstanceId]));
  referenceByMoving.set(movingInstanceId, referenceInstanceId);
  const visited = new Set([movingInstanceId]);
  let cursor = referenceInstanceId;
  while (cursor) {
    if (visited.has(cursor)) throw new Error('Joint utworzyłby cykl kinematyczny.');
    visited.add(cursor);
    cursor = referenceByMoving.get(cursor) || '';
  }
}

function axisDelta(axis, value) {
  return {
    x: axis === 'x' ? value : 0,
    y: axis === 'y' ? value : 0,
    z: axis === 'z' ? value : 0,
  };
}

export function jointDrivenTransform(joint, value = joint?.value) {
  const base = normalizedTransform(joint?.restTransform);
  if (!joint?.enabled || joint?.type === 'rigid') return base;
  const delta = axisDelta(joint.axis, finiteNumber(value));
  if (joint.type === 'slider') return {
    ...base,
    x: base.x + delta.x,
    y: base.y + delta.y,
    z: base.z + delta.z,
  };
  return {
    ...base,
    rotationX: base.rotationX + delta.x,
    rotationY: base.rotationY + delta.y,
    rotationZ: base.rotationZ + delta.z,
  };
}

export function setJointValue(document, jointId, value, { clamp = false } = {}) {
  ensureDocumentJoints(document);
  const planned = new Map();
  const plan = (plannedJointId, plannedValue, path = new Set()) => {
    if (path.has(plannedJointId)) throw new Error('Motion Link utworzył cykl sterowania jointami.');
    const joint = document.joints.find((item) => item.id === plannedJointId);
    if (!joint) throw new Error('Nie znaleziono jointa.');
    jointInstances(document, joint.referenceInstanceId, joint.movingInstanceId);
    let nextValue = finiteNumber(plannedValue);
    if (joint.type === 'rigid') nextValue = 0;
    if (joint.limits.enabled && (nextValue < joint.limits.min || nextValue > joint.limits.max)) {
      if (!clamp) throw new Error(`Wartość jointa musi mieścić się w zakresie ${joint.limits.min}–${joint.limits.max}.`);
      nextValue = Math.max(joint.limits.min, Math.min(joint.limits.max, nextValue));
    }
    planned.set(plannedJointId, nextValue);
    const nextPath = new Set(path).add(plannedJointId);
    for (const link of document.motionLinks.filter((item) => item.enabled && item.sourceJointId === plannedJointId)) {
      plan(link.targetJointId, nextValue * link.ratio + link.offset, nextPath);
    }
  };
  plan(jointId, value);
  for (const [plannedJointId, plannedValue] of planned) {
    const joint = document.joints.find((item) => item.id === plannedJointId);
    const moving = document.componentInstances.find((instance) => instance.id === joint.movingInstanceId);
    joint.value = plannedValue;
    moving.transform = jointDrivenTransform(joint, plannedValue);
  }
  if (typeof document.activeAssemblyConfigurationId === 'string') document.activeAssemblyConfigurationId = '';
  return document.joints.find((item) => item.id === jointId);
}

export function createAssemblyJoint(document, {
  name = '',
  type = 'rigid',
  referenceInstanceId,
  movingInstanceId,
  axis = 'z',
  anchor = { x: 0, y: 0, z: 0 },
  limits,
  value = 0,
} = {}) {
  ensureDocumentJoints(document);
  if (!JOINT_TYPES.includes(type)) throw new Error('Nieobsługiwany typ jointa.');
  if (!JOINT_AXES.includes(axis)) throw new Error('Oś jointa musi mieć wartość X, Y albo Z.');
  const { moving } = jointInstances(document, referenceInstanceId, movingInstanceId);
  assertJointGraph(document, referenceInstanceId, movingInstanceId);
  const defaultLimits = type === 'slider' ? { enabled: true, min: 0, max: 100 } : { enabled: true, min: -90, max: 90 };
  if (limits && finiteNumber(limits.min, defaultLimits.min) > finiteNumber(limits.max, defaultLimits.max)) throw new Error('Minimalny limit jointa nie może przekraczać maksymalnego.');
  const joint = normalizedJoint({
    id: createId('joint'),
    name: uniqueJointName(document, name),
    type,
    referenceInstanceId,
    movingInstanceId,
    axis,
    axisReference: { kind: 'component-origin-axis', instanceId: referenceInstanceId, axis },
    anchor,
    limits: limits || defaultLimits,
    value,
    restTransform: moving.transform,
    enabled: true,
  }, document.joints.length);
  document.joints.push(joint);
  setJointValue(document, joint.id, value, { clamp: true });
  return document.joints.find((item) => item.id === joint.id);
}

export function updateAssemblyJoint(document, jointId, patch = {}) {
  ensureDocumentJoints(document);
  const index = document.joints.findIndex((joint) => joint.id === jointId);
  if (index < 0) throw new Error('Nie znaleziono jointa.');
  const current = document.joints[index];
  const requestedName = patch.name === undefined ? current.name : String(patch.name || '').trim().slice(0, 80) || current.name;
  if (document.joints.some((joint) => joint.id !== jointId && joint.name.toLocaleLowerCase() === requestedName.toLocaleLowerCase())) throw new Error('Nazwa jointa musi być unikalna.');
  if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean') throw new Error('Stan jointa musi być wartością logiczną.');
  const type = patch.type === undefined ? current.type : patch.type;
  const axis = patch.axis === undefined ? current.axis : patch.axis;
  if (!JOINT_TYPES.includes(type)) throw new Error('Nieobsługiwany typ jointa.');
  if (!JOINT_AXES.includes(axis)) throw new Error('Oś jointa musi mieć wartość X, Y albo Z.');
  const referenceInstanceId = patch.referenceInstanceId === undefined ? current.referenceInstanceId : patch.referenceInstanceId;
  const movingInstanceId = patch.movingInstanceId === undefined ? current.movingInstanceId : patch.movingInstanceId;
  const { moving } = jointInstances(document, referenceInstanceId, movingInstanceId);
  assertJointGraph(document, referenceInstanceId, movingInstanceId, jointId);
  const rawLimits = patch.limits === undefined ? current.limits : { ...current.limits, ...patch.limits };
  if (finiteNumber(rawLimits.min) > finiteNumber(rawLimits.max)) throw new Error('Minimalny limit jointa nie może przekraczać maksymalnego.');
  const limits = normalizedLimits(rawLimits);
  const referencesChanged = referenceInstanceId !== current.referenceInstanceId || movingInstanceId !== current.movingInstanceId;
  const next = normalizedJoint({
    ...current,
    ...patch,
    id: current.id,
    name: requestedName,
    type,
    axis,
    referenceInstanceId,
    movingInstanceId,
    axisReference: { kind: 'component-origin-axis', instanceId: referenceInstanceId, axis },
    anchor: patch.anchor === undefined ? current.anchor : { ...current.anchor, ...patch.anchor },
    limits,
    restTransform: referencesChanged || patch.captureRest ? moving.transform : current.restTransform,
    value: type === 'rigid' || patch.captureRest ? 0 : patch.value === undefined ? current.value : patch.value,
  }, index);
  document.joints[index] = next;
  return setJointValue(document, next.id, next.value, { clamp: true });
}

export function deleteAssemblyJoint(document, jointId) {
  ensureDocumentJoints(document);
  const index = document.joints.findIndex((joint) => joint.id === jointId);
  if (index < 0) throw new Error('Nie znaleziono jointa.');
  const deleted = document.joints.splice(index, 1)[0];
  document.motionLinks = document.motionLinks.filter((link) => link.sourceJointId !== jointId && link.targetJointId !== jointId);
  if (Array.isArray(document.assemblyConfigurations)) {
    document.assemblyConfigurations = document.assemblyConfigurations.map((configuration) => ({
      ...configuration,
      jointStates: (configuration.jointStates || []).filter((state) => state.jointId !== jointId),
    }));
  }
  if (typeof document.activeAssemblyConfigurationId === 'string') document.activeAssemblyConfigurationId = '';
  return deleted;
}

export function removeJointsForInstances(document, instanceIds) {
  ensureDocumentJoints(document);
  const removed = new Set(instanceIds);
  const deletedIds = document.joints.filter((joint) => removed.has(joint.referenceInstanceId) || removed.has(joint.movingInstanceId)).map((joint) => joint.id);
  document.joints = document.joints.filter((joint) => !deletedIds.includes(joint.id));
  document.motionLinks = document.motionLinks.filter((link) => !deletedIds.includes(link.sourceJointId) && !deletedIds.includes(link.targetJointId));
  return deletedIds;
}

function assertMotionLinkGraph(document, sourceJointId, targetJointId, excludedLinkId = '') {
  if (sourceJointId === targetJointId) throw new Error('Motion Link nie może łączyć jointa z nim samym.');
  if (!document.joints.some((joint) => joint.id === sourceJointId) || !document.joints.some((joint) => joint.id === targetJointId)) throw new Error('Motion Link wymaga dwóch istniejących jointów.');
  if (document.motionLinks.some((link) => link.id !== excludedLinkId && link.targetJointId === targetJointId)) throw new Error('Docelowy joint ma już Motion Link sterujący jego wartością.');
  const targetsBySource = new Map();
  for (const link of document.motionLinks.filter((item) => item.id !== excludedLinkId)) {
    if (!targetsBySource.has(link.sourceJointId)) targetsBySource.set(link.sourceJointId, []);
    targetsBySource.get(link.sourceJointId).push(link.targetJointId);
  }
  if (!targetsBySource.has(sourceJointId)) targetsBySource.set(sourceJointId, []);
  targetsBySource.get(sourceJointId).push(targetJointId);
  const visit = (jointId, path = new Set()) => {
    if (path.has(jointId)) throw new Error('Motion Link utworzyłby cykl sterowania jointami.');
    const nextPath = new Set(path).add(jointId);
    for (const nextId of targetsBySource.get(jointId) || []) visit(nextId, nextPath);
  };
  visit(sourceJointId);
}

export function createMotionLink(document, { name = '', sourceJointId, targetJointId, ratio = 1, offset = 0 } = {}) {
  ensureDocumentJoints(document);
  assertMotionLinkGraph(document, sourceJointId, targetJointId);
  if (!Number.isFinite(Number(ratio)) || !Number.isFinite(Number(offset))) throw new Error('Motion Link wymaga liczbowego przełożenia i odsunięcia.');
  const link = normalizedMotionLink({ id: createId('motion-link'), name, sourceJointId, targetJointId, ratio, offset, enabled: true }, document.motionLinks.length);
  if (document.motionLinks.some((item) => item.name.toLocaleLowerCase() === link.name.toLocaleLowerCase())) link.name = `${link.name} ${document.motionLinks.length + 1}`.slice(0, 80);
  document.motionLinks.push(link);
  setJointValue(document, sourceJointId, document.joints.find((joint) => joint.id === sourceJointId).value, { clamp: true });
  return link;
}

export function updateMotionLink(document, linkId, patch = {}) {
  ensureDocumentJoints(document);
  const index = document.motionLinks.findIndex((link) => link.id === linkId);
  if (index < 0) throw new Error('Nie znaleziono Motion Link.');
  const current = document.motionLinks[index];
  const sourceJointId = patch.sourceJointId === undefined ? current.sourceJointId : patch.sourceJointId;
  const targetJointId = patch.targetJointId === undefined ? current.targetJointId : patch.targetJointId;
  const ratio = patch.ratio === undefined ? current.ratio : Number(patch.ratio);
  const offset = patch.offset === undefined ? current.offset : Number(patch.offset);
  if (!Number.isFinite(ratio) || !Number.isFinite(offset)) throw new Error('Motion Link wymaga liczbowego przełożenia i odsunięcia.');
  if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean') throw new Error('Stan Motion Link musi być wartością logiczną.');
  assertMotionLinkGraph(document, sourceJointId, targetJointId, linkId);
  const name = patch.name === undefined ? current.name : String(patch.name || '').trim().slice(0, 80) || current.name;
  if (document.motionLinks.some((link) => link.id !== linkId && link.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('Nazwa Motion Link musi być unikalna.');
  const next = normalizedMotionLink({ ...current, ...patch, id: current.id, name, sourceJointId, targetJointId, ratio, offset }, index);
  document.motionLinks[index] = next;
  if (next.enabled) setJointValue(document, sourceJointId, document.joints.find((joint) => joint.id === sourceJointId).value, { clamp: true });
  return next;
}

export function deleteMotionLink(document, linkId) {
  ensureDocumentJoints(document);
  const index = document.motionLinks.findIndex((link) => link.id === linkId);
  if (index < 0) throw new Error('Nie znaleziono Motion Link.');
  return document.motionLinks.splice(index, 1)[0];
}
