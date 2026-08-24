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

export function ensureDocumentJoints(document) {
  ensureDocumentComponents(document);
  if (!Array.isArray(document.joints)) document.joints = [];
  document.joints = document.joints.map(normalizedJoint);
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
  const joint = document.joints.find((item) => item.id === jointId);
  if (!joint) throw new Error('Nie znaleziono jointa.');
  const { moving } = jointInstances(document, joint.referenceInstanceId, joint.movingInstanceId);
  let nextValue = finiteNumber(value);
  if (joint.type === 'rigid') nextValue = 0;
  if (joint.limits.enabled && (nextValue < joint.limits.min || nextValue > joint.limits.max)) {
    if (!clamp) throw new Error(`Wartość jointa musi mieścić się w zakresie ${joint.limits.min}–${joint.limits.max}.`);
    nextValue = Math.max(joint.limits.min, Math.min(joint.limits.max, nextValue));
  }
  joint.value = nextValue;
  moving.transform = jointDrivenTransform(joint, nextValue);
  return joint;
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
  return document.joints.splice(index, 1)[0];
}

export function removeJointsForInstances(document, instanceIds) {
  ensureDocumentJoints(document);
  const removed = new Set(instanceIds);
  const deletedIds = document.joints.filter((joint) => removed.has(joint.referenceInstanceId) || removed.has(joint.movingInstanceId)).map((joint) => joint.id);
  document.joints = document.joints.filter((joint) => !deletedIds.includes(joint.id));
  return deletedIds;
}
