import { GEOMETRY_POLICY, quantizeGeometryValue } from './geometry-policy.js';

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashText(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function normalizeDescriptor(descriptor, tolerance) {
  if (Array.isArray(descriptor)) return descriptor.map((value) => normalizeDescriptor(value, tolerance));
  if (typeof descriptor === 'number') return quantizeGeometryValue(descriptor, tolerance);
  if (descriptor && typeof descriptor === 'object') {
    return Object.fromEntries(Object.entries(descriptor)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, normalizeDescriptor(value, tolerance)]));
  }
  return descriptor;
}

export function createTopologySignature(descriptor, tolerance = GEOMETRY_POLICY.linearTolerance) {
  return stableStringify(normalizeDescriptor(descriptor, tolerance));
}

export function createTopologyId(featureId, kind, descriptor, occurrence = 0) {
  if (!featureId || !kind) throw new Error('Trwałe ID topologii wymaga featureId i rodzaju elementu.');
  const signature = createTopologySignature(descriptor);
  return `${kind}-${featureId}-${hashText(signature)}-${occurrence}`;
}

export function assignStableTopologyIds(featureId, kind, descriptors, previous = []) {
  const previousBySignature = new Map();
  for (const item of previous) {
    const signature = item.signature || createTopologySignature(item.descriptor);
    if (!previousBySignature.has(signature)) previousBySignature.set(signature, []);
    previousBySignature.get(signature).push(item.id);
  }

  const occurrences = new Map();
  return descriptors.map((descriptor) => {
    const signature = createTopologySignature(descriptor);
    const occurrence = occurrences.get(signature) || 0;
    occurrences.set(signature, occurrence + 1);
    const reusableIds = previousBySignature.get(signature) || [];
    const id = reusableIds[occurrence] || createTopologyId(featureId, kind, descriptor, occurrence);
    return { id, kind, signature, descriptor };
  });
}
