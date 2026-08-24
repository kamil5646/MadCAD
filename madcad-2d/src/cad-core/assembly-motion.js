import { setJointValue } from './assembly-joints.js';
import { DEFAULT_INSTANCE_TRANSFORM, ensureDocumentComponents } from './components.js';
import { createId } from './ids.js';

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedTransform(transform) {
  return Object.fromEntries(Object.keys(DEFAULT_INSTANCE_TRANSFORM).map((key) => [key, finiteNumber(transform?.[key])]));
}

function normalizedInstanceState(state) {
  return {
    instanceId: typeof state?.instanceId === 'string' ? state.instanceId : '',
    transform: normalizedTransform(state?.transform),
    grounded: Boolean(state?.grounded),
    visible: state?.visible !== false,
  };
}

function normalizedJointState(state) {
  return {
    jointId: typeof state?.jointId === 'string' ? state.jointId : '',
    value: finiteNumber(state?.value),
    enabled: state?.enabled !== false,
  };
}

function normalizedConfiguration(configuration, index = 0) {
  return {
    ...configuration,
    id: typeof configuration?.id === 'string' && configuration.id ? configuration.id : createId('assembly-configuration'),
    name: String(configuration?.name || `Konfiguracja ${index + 1}`).trim().slice(0, 80) || `Konfiguracja ${index + 1}`,
    description: String(configuration?.description || '').trim().slice(0, 240),
    instanceStates: (Array.isArray(configuration?.instanceStates) ? configuration.instanceStates : []).map(normalizedInstanceState),
    jointStates: (Array.isArray(configuration?.jointStates) ? configuration.jointStates : []).map(normalizedJointState),
  };
}

function normalizedContactSet(contactSet, index = 0) {
  return {
    ...contactSet,
    id: typeof contactSet?.id === 'string' && contactSet.id ? contactSet.id : createId('contact-set'),
    name: String(contactSet?.name || `Contact Set ${index + 1}`).trim().slice(0, 80) || `Contact Set ${index + 1}`,
    firstInstanceId: typeof contactSet?.firstInstanceId === 'string' ? contactSet.firstInstanceId : '',
    secondInstanceId: typeof contactSet?.secondInstanceId === 'string' ? contactSet.secondInstanceId : '',
    enabled: contactSet?.enabled !== false,
  };
}

export function ensureDocumentAssemblyMotion(document) {
  ensureDocumentComponents(document);
  if (!Array.isArray(document.contactSets)) document.contactSets = [];
  document.contactSets = document.contactSets.map(normalizedContactSet);
  if (!Array.isArray(document.assemblyConfigurations)) document.assemblyConfigurations = [];
  document.assemblyConfigurations = document.assemblyConfigurations.map(normalizedConfiguration);
  if (typeof document.activeAssemblyConfigurationId !== 'string') document.activeAssemblyConfigurationId = '';
  if (document.activeAssemblyConfigurationId && !document.assemblyConfigurations.some((item) => item.id === document.activeAssemblyConfigurationId)) document.activeAssemblyConfigurationId = '';
  return document;
}

function uniqueContactSetName(document, requestedName = '', excludedId = '') {
  const base = String(requestedName || `Contact Set ${document.contactSets.length + 1}`).trim().slice(0, 80) || 'Contact Set';
  const used = new Set(document.contactSets.filter((item) => item.id !== excludedId).map((item) => item.name.toLocaleLowerCase()));
  if (!used.has(base.toLocaleLowerCase())) return base;
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base} ${suffix}`.slice(0, 80);
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('Nie można utworzyć unikalnej nazwy Contact Set.');
}

function validateContactPair(document, firstInstanceId, secondInstanceId, excludedId = '') {
  if (!document.componentInstances.some((instance) => instance.id === firstInstanceId)) throw new Error('Nie znaleziono pierwszego wystąpienia Contact Set.');
  if (!document.componentInstances.some((instance) => instance.id === secondInstanceId)) throw new Error('Nie znaleziono drugiego wystąpienia Contact Set.');
  if (firstInstanceId === secondInstanceId) throw new Error('Contact Set wymaga dwóch różnych wystąpień.');
  const duplicate = document.contactSets.some((contactSet) => contactSet.id !== excludedId
    && ((contactSet.firstInstanceId === firstInstanceId && contactSet.secondInstanceId === secondInstanceId)
      || (contactSet.firstInstanceId === secondInstanceId && contactSet.secondInstanceId === firstInstanceId)));
  if (duplicate) throw new Error('Ta para wystąpień ma już Contact Set.');
}

export function createContactSet(document, { name = '', firstInstanceId = '', secondInstanceId = '', enabled = true } = {}) {
  ensureDocumentAssemblyMotion(document);
  validateContactPair(document, firstInstanceId, secondInstanceId);
  const contactSet = normalizedContactSet({
    id: createId('contact-set'),
    name: uniqueContactSetName(document, name),
    firstInstanceId,
    secondInstanceId,
    enabled,
  }, document.contactSets.length);
  document.contactSets.push(contactSet);
  return contactSet;
}

export function updateContactSet(document, contactSetId, patch = {}) {
  ensureDocumentAssemblyMotion(document);
  const index = document.contactSets.findIndex((item) => item.id === contactSetId);
  if (index < 0) throw new Error('Nie znaleziono Contact Set.');
  const current = document.contactSets[index];
  const next = normalizedContactSet({
    ...current,
    ...patch,
    id: current.id,
    name: patch.name === undefined ? current.name : uniqueContactSetName(document, patch.name, current.id),
  }, index);
  validateContactPair(document, next.firstInstanceId, next.secondInstanceId, current.id);
  document.contactSets[index] = next;
  return next;
}

export function deleteContactSet(document, contactSetId) {
  ensureDocumentAssemblyMotion(document);
  const index = document.contactSets.findIndex((item) => item.id === contactSetId);
  if (index < 0) throw new Error('Nie znaleziono Contact Set.');
  return document.contactSets.splice(index, 1)[0];
}

function captureConfigurationState(document) {
  return {
    instanceStates: document.componentInstances.map((instance) => ({
      instanceId: instance.id,
      transform: normalizedTransform(instance.transform),
      grounded: instance.grounded,
      visible: instance.visible,
    })),
    jointStates: (document.joints || []).map((joint) => ({ jointId: joint.id, value: joint.value, enabled: joint.enabled })),
  };
}

function uniqueConfigurationName(document, requestedName = '', excludedId = '') {
  const base = String(requestedName || `Konfiguracja ${document.assemblyConfigurations.length + 1}`).trim().slice(0, 80) || 'Konfiguracja';
  const used = new Set(document.assemblyConfigurations.filter((item) => item.id !== excludedId).map((item) => item.name.toLocaleLowerCase()));
  if (!used.has(base.toLocaleLowerCase())) return base;
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base} ${suffix}`.slice(0, 80);
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('Nie można utworzyć unikalnej nazwy konfiguracji.');
}

export function createAssemblyConfiguration(document, { name = '', description = '' } = {}) {
  ensureDocumentAssemblyMotion(document);
  const state = captureConfigurationState(document);
  const configuration = normalizedConfiguration({
    id: createId('assembly-configuration'),
    name: uniqueConfigurationName(document, name),
    description,
    ...state,
  }, document.assemblyConfigurations.length);
  document.assemblyConfigurations.push(configuration);
  document.activeAssemblyConfigurationId = configuration.id;
  return configuration;
}

export function updateAssemblyConfiguration(document, configurationId, patch = {}) {
  ensureDocumentAssemblyMotion(document);
  const index = document.assemblyConfigurations.findIndex((item) => item.id === configurationId);
  if (index < 0) throw new Error('Nie znaleziono konfiguracji złożenia.');
  const current = document.assemblyConfigurations[index];
  const next = normalizedConfiguration({
    ...current,
    ...patch,
    id: current.id,
    name: patch.name === undefined ? current.name : uniqueConfigurationName(document, patch.name, current.id),
    description: patch.description === undefined ? current.description : patch.description,
    ...(patch.captureCurrent ? captureConfigurationState(document) : {}),
  }, index);
  document.assemblyConfigurations[index] = next;
  return next;
}

export function applyAssemblyConfiguration(document, configurationId) {
  ensureDocumentAssemblyMotion(document);
  const configuration = document.assemblyConfigurations.find((item) => item.id === configurationId);
  if (!configuration) throw new Error('Nie znaleziono konfiguracji złożenia.');
  const instanceById = new Map(document.componentInstances.map((instance) => [instance.id, instance]));
  const jointById = new Map((document.joints || []).map((joint) => [joint.id, joint]));
  for (const state of configuration.instanceStates) {
    const instance = instanceById.get(state.instanceId);
    if (!instance) continue;
    instance.transform = normalizedTransform(state.transform);
    instance.visible = state.visible;
    instance.grounded = state.grounded;
  }
  for (const state of configuration.jointStates) {
    const joint = jointById.get(state.jointId);
    if (joint) joint.enabled = state.enabled;
  }
  const linkedTargets = new Set((document.motionLinks || []).filter((link) => link.enabled).map((link) => link.targetJointId));
  for (const state of configuration.jointStates.filter((item) => !linkedTargets.has(item.jointId))) {
    if (jointById.has(state.jointId)) setJointValue(document, state.jointId, state.value, { clamp: true });
  }
  document.activeAssemblyConfigurationId = configuration.id;
  return configuration;
}

export function deleteAssemblyConfiguration(document, configurationId) {
  ensureDocumentAssemblyMotion(document);
  const index = document.assemblyConfigurations.findIndex((item) => item.id === configurationId);
  if (index < 0) throw new Error('Nie znaleziono konfiguracji złożenia.');
  const deleted = document.assemblyConfigurations.splice(index, 1)[0];
  if (document.activeAssemblyConfigurationId === configurationId) document.activeAssemblyConfigurationId = '';
  return deleted;
}

function quaternionFromEuler(transform) {
  const half = Math.PI / 360;
  const x = finiteNumber(transform?.rotationX) * half;
  const y = finiteNumber(transform?.rotationY) * half;
  const z = finiteNumber(transform?.rotationZ) * half;
  const c1 = Math.cos(x); const c2 = Math.cos(y); const c3 = Math.cos(z);
  const s1 = Math.sin(x); const s2 = Math.sin(y); const s3 = Math.sin(z);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

function transformMatrix(transform) {
  const q = quaternionFromEuler(transform);
  const xx = q.x * q.x; const yy = q.y * q.y; const zz = q.z * q.z;
  const xy = q.x * q.y; const xz = q.x * q.z; const yz = q.y * q.z;
  const wx = q.w * q.x; const wy = q.w * q.y; const wz = q.w * q.z;
  return [
    1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), finiteNumber(transform?.x),
    2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx), finiteNumber(transform?.y),
    2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy), finiteNumber(transform?.z),
    0, 0, 0, 1,
  ];
}

function multiplyMatrix(first, second) {
  const result = Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let inner = 0; inner < 4; inner += 1) result[row * 4 + column] += first[row * 4 + inner] * second[inner * 4 + column];
    }
  }
  return result;
}

function transformPoint(matrix, point) {
  return [
    matrix[0] * point[0] + matrix[1] * point[1] + matrix[2] * point[2] + matrix[3],
    matrix[4] * point[0] + matrix[5] * point[1] + matrix[6] * point[2] + matrix[7],
    matrix[8] * point[0] + matrix[9] * point[1] + matrix[10] * point[2] + matrix[11],
  ];
}

function worldMatrices(instances) {
  const byId = new Map(instances.map((instance) => [instance.id, instance]));
  const cache = new Map();
  const resolve = (instance, visited = new Set()) => {
    if (cache.has(instance.id)) return cache.get(instance.id);
    if (visited.has(instance.id)) return transformMatrix(instance.transform);
    const parent = byId.get(instance.parentInstanceId);
    const local = transformMatrix(instance.transform);
    const world = parent ? multiplyMatrix(resolve(parent, new Set(visited).add(instance.id)), local) : local;
    cache.set(instance.id, world);
    return world;
  };
  instances.forEach((instance) => resolve(instance));
  return cache;
}

function validBounds(body) {
  const bounds = body?.metrics?.bounds || body?.bounds;
  return Array.isArray(bounds) && bounds.length === 2 && bounds.every((point) => Array.isArray(point) && point.length === 3 && point.every((value) => Number.isFinite(Number(value)))) ? bounds : null;
}

function transformedBounds(bounds, matrix) {
  const corners = [];
  for (const x of [bounds[0][0], bounds[1][0]]) for (const y of [bounds[0][1], bounds[1][1]]) for (const z of [bounds[0][2], bounds[1][2]]) corners.push(transformPoint(matrix, [x, y, z]));
  return [0, 1, 2].reduce((result, axis) => {
    const values = corners.map((point) => point[axis]);
    result[0][axis] = Math.min(...values);
    result[1][axis] = Math.max(...values);
    return result;
  }, [[0, 0, 0], [0, 0, 0]]);
}

export function assemblyOccurrenceBounds(document, bodies = []) {
  ensureDocumentComponents(document);
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const componentById = new Map(document.components.map((component) => [component.id, component]));
  const matrices = worldMatrices(document.componentInstances);
  const results = [];
  for (const instance of document.componentInstances.filter((item) => item.visible)) {
    const component = componentById.get(instance.componentId);
    const bodyBounds = (component?.bodyIds || []).map((bodyId) => validBounds(bodyById.get(bodyId))).filter(Boolean);
    if (!bodyBounds.length) continue;
    const localBounds = bodyBounds.reduce((union, bounds) => [
      union[0].map((value, axis) => Math.min(value, bounds[0][axis])),
      union[1].map((value, axis) => Math.max(value, bounds[1][axis])),
    ]);
    results.push({ instanceId: instance.id, componentId: instance.componentId, name: instance.name, bounds: transformedBounds(localBounds, matrices.get(instance.id)) });
  }
  return results;
}

function subtract(first, second) {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function dot(first, second) {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function cross(first, second) {
  return [first[1] * second[2] - first[2] * second[1], first[2] * second[0] - first[0] * second[2], first[0] * second[1] - first[1] * second[0]];
}

function squaredLength(vector) {
  return dot(vector, vector);
}

function triangleAxes(triangle) {
  const edges = [subtract(triangle[1], triangle[0]), subtract(triangle[2], triangle[1]), subtract(triangle[0], triangle[2])];
  return { edges, normal: cross(edges[0], edges[1]) };
}

function trianglesIntersect(first, second, tolerance) {
  const firstAxes = triangleAxes(first);
  const secondAxes = triangleAxes(second);
  if (squaredLength(firstAxes.normal) <= tolerance ** 2 || squaredLength(secondAxes.normal) <= tolerance ** 2) return false;
  const axes = [firstAxes.normal, secondAxes.normal];
  for (const firstEdge of firstAxes.edges) {
    axes.push(cross(firstAxes.normal, firstEdge));
    for (const secondEdge of secondAxes.edges) axes.push(cross(firstEdge, secondEdge));
  }
  for (const secondEdge of secondAxes.edges) axes.push(cross(secondAxes.normal, secondEdge));
  for (const axis of axes) {
    if (squaredLength(axis) <= tolerance ** 2) continue;
    const firstProjection = first.map((point) => dot(point, axis));
    const secondProjection = second.map((point) => dot(point, axis));
    if (Math.max(...firstProjection) < Math.min(...secondProjection) - tolerance || Math.max(...secondProjection) < Math.min(...firstProjection) - tolerance) return false;
  }
  return true;
}

function rayIntersectsTriangle(origin, direction, triangle, tolerance) {
  const edge1 = subtract(triangle[1], triangle[0]);
  const edge2 = subtract(triangle[2], triangle[0]);
  const p = cross(direction, edge2);
  const determinant = dot(edge1, p);
  if (Math.abs(determinant) <= tolerance) return null;
  const inverse = 1 / determinant;
  const t = subtract(origin, triangle[0]);
  const u = dot(t, p) * inverse;
  if (u < -tolerance || u > 1 + tolerance) return null;
  const q = cross(t, edge1);
  const v = dot(direction, q) * inverse;
  if (v < -tolerance || u + v > 1 + tolerance) return null;
  const distance = dot(edge2, q) * inverse;
  return distance > tolerance ? distance : null;
}

function pointInsideMesh(point, triangles, tolerance) {
  const direction = [1, 0.371390676, 0.173205081];
  const distances = triangles.map((triangle) => rayIntersectsTriangle(point, direction, triangle, tolerance)).filter((distance) => distance !== null).sort((a, b) => a - b);
  const unique = distances.filter((distance, index) => index === 0 || Math.abs(distance - distances[index - 1]) > tolerance * 10);
  return unique.length % 2 === 1;
}

function occurrenceTriangleMeshes(document, bodies) {
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const componentById = new Map(document.components.map((component) => [component.id, component]));
  const matrices = worldMatrices(document.componentInstances);
  const meshes = new Map();
  for (const instance of document.componentInstances.filter((item) => item.visible)) {
    const component = componentById.get(instance.componentId);
    const matrix = matrices.get(instance.id);
    const triangles = [];
    let complete = true;
    for (const bodyId of component?.bodyIds || []) {
      const body = bodyById.get(bodyId);
      if (!body?.vertices?.length || !body?.triangles?.length) {
        complete = false;
        continue;
      }
      const vertices = [];
      for (let index = 0; index < body.vertices.length; index += 3) vertices.push(transformPoint(matrix, [body.vertices[index], body.vertices[index + 1], body.vertices[index + 2]]));
      for (let index = 0; index < body.triangles.length; index += 3) triangles.push([vertices[body.triangles[index]], vertices[body.triangles[index + 1]], vertices[body.triangles[index + 2]]]);
    }
    meshes.set(instance.id, { triangles, complete: complete && triangles.length > 0 });
  }
  return meshes;
}

function exactMeshCollision(firstMesh, secondMesh, tolerance, maxTriangleTests) {
  if (!firstMesh?.complete || !secondMesh?.complete) return null;
  if (firstMesh.triangles.length * secondMesh.triangles.length > maxTriangleTests) return null;
  for (const firstTriangle of firstMesh.triangles) {
    for (const secondTriangle of secondMesh.triangles) if (trianglesIntersect(firstTriangle, secondTriangle, tolerance)) return true;
  }
  const firstPoint = firstMesh.triangles[0]?.[0];
  const secondPoint = secondMesh.triangles[0]?.[0];
  return Boolean((firstPoint && pointInsideMesh(firstPoint, secondMesh.triangles, tolerance)) || (secondPoint && pointInsideMesh(secondPoint, firstMesh.triangles, tolerance)));
}

export function detectAssemblyCollisions(document, bodies = [], { tolerance = 1e-7, maxExactTriangleTests = 250000 } = {}) {
  ensureDocumentAssemblyMotion(document);
  const occurrences = assemblyOccurrenceBounds(document, bodies);
  const triangleMeshes = occurrenceTriangleMeshes(document, bodies);
  const collisions = [];
  let broadPhasePairs = 0;
  let exactPairs = 0;
  for (let firstIndex = 0; firstIndex < occurrences.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < occurrences.length; secondIndex += 1) {
      const first = occurrences[firstIndex];
      const second = occurrences[secondIndex];
      const overlap = [0, 1, 2].map((axis) => Math.min(first.bounds[1][axis], second.bounds[1][axis]) - Math.max(first.bounds[0][axis], second.bounds[0][axis]));
      if (overlap.some((depth) => depth <= tolerance)) continue;
      broadPhasePairs += 1;
      const exact = exactMeshCollision(triangleMeshes.get(first.instanceId), triangleMeshes.get(second.instanceId), tolerance, maxExactTriangleTests);
      if (exact === false) continue;
      if (exact === true) exactPairs += 1;
      const contactSet = document.contactSets.find((item) => item.enabled
        && ((item.firstInstanceId === first.instanceId && item.secondInstanceId === second.instanceId)
          || (item.firstInstanceId === second.instanceId && item.secondInstanceId === first.instanceId)));
      collisions.push({
        firstInstanceId: first.instanceId,
        secondInstanceId: second.instanceId,
        firstName: first.name,
        secondName: second.name,
        overlap,
        overlapVolume: overlap[0] * overlap[1] * overlap[2],
        status: exact === true ? 'exact' : 'broad-phase',
        contactSetId: contactSet?.id || '',
      });
    }
  }
  const contactSets = document.contactSets.map((contactSet) => {
    const collision = collisions.find((item) => item.contactSetId === contactSet.id);
    return {
      ...contactSet,
      status: !contactSet.enabled ? 'disabled' : collision?.status || 'clear',
      overlapVolume: collision?.overlapVolume || 0,
    };
  });
  return { status: collisions.some((collision) => collision.status === 'broad-phase') ? 'partial' : 'complete', occurrences: occurrences.length, checkedPairs: occurrences.length * (occurrences.length - 1) / 2, broadPhasePairs, exactPairs, activeContactPairs: contactSets.filter((item) => item.status === 'exact' || item.status === 'broad-phase').length, contactSets, collisions };
}
