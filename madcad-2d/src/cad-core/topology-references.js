import { createId } from './ids.js';

export const TOPOLOGY_REFERENCE_KIND = 'topology';
export const TOPOLOGY_KINDS = Object.freeze(['face', 'edge', 'vertex']);

function topologyRecords(body, kind) {
  const key = kind === 'face' ? 'faces' : kind === 'edge' ? 'edges' : 'vertices';
  return body?.topology?.[key] || [];
}

function descriptorDistance(referenceDescriptor, candidateDescriptor) {
  if (!referenceDescriptor || !candidateDescriptor) return Number.POSITIVE_INFINITY;
  const referencePoint = referenceDescriptor.center || referenceDescriptor.point || referenceDescriptor.endpoints?.flatMap((point) => point).slice(0, 3);
  const candidatePoint = candidateDescriptor.center || candidateDescriptor.point || candidateDescriptor.endpoints?.flatMap((point) => point).slice(0, 3);
  if (!referencePoint || !candidatePoint) return Number.POSITIVE_INFINITY;
  return Math.hypot(...referencePoint.map((value, axis) => Number(value) - Number(candidatePoint[axis] || 0)));
}

function vectorAngle(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length < 3 || second.length < 3) return null;
  const firstLength = Math.hypot(...first);
  const secondLength = Math.hypot(...second);
  if (!firstLength || !secondLength) return null;
  const dot = first.reduce((sum, value, index) => sum + Number(value) * Number(second[index] || 0), 0) / (firstLength * secondLength);
  return Math.acos(Math.max(-1, Math.min(1, Math.abs(dot)))) * 180 / Math.PI;
}

function relativeDifference(first, second) {
  const left = Number(first);
  const right = Number(second);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1) * 100;
}

export function describeTopologyCandidate(referenceDescriptor, candidateDescriptor) {
  const distance = descriptorDistance(referenceDescriptor, candidateDescriptor);
  const geometryMatch = !referenceDescriptor?.geometry || !candidateDescriptor?.geometry || referenceDescriptor.geometry === candidateDescriptor.geometry;
  const sizeDifference = relativeDifference(
    referenceDescriptor?.area ?? referenceDescriptor?.length ?? referenceDescriptor?.radius,
    candidateDescriptor?.area ?? candidateDescriptor?.length ?? candidateDescriptor?.radius,
  );
  const orientationDifference = vectorAngle(
    referenceDescriptor?.normal ?? referenceDescriptor?.axisDirection,
    candidateDescriptor?.normal ?? candidateDescriptor?.axisDirection,
  );
  let score = 100;
  if (!geometryMatch) score -= 35;
  if (Number.isFinite(distance)) score -= Math.min(40, distance * 4);
  else score -= 25;
  if (sizeDifference !== null) score -= Math.min(20, sizeDifference * 0.4);
  if (orientationDifference !== null) score -= Math.min(20, orientationDifference * 0.5);
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    distance,
    geometryMatch,
    sizeDifference,
    orientationDifference,
    score,
    confidence: score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low',
  };
}

export function createTopologyReference({ selection, ownerFeatureId = null, descriptor = null, label = null }) {
  if (!selection || !TOPOLOGY_KINDS.includes(selection.kind) || !selection.id || !selection.bodyId) {
    throw new Error('Referencja topologii wymaga wskazanej ściany, krawędzi albo wierzchołka.');
  }
  return {
    id: createId('reference'),
    kind: TOPOLOGY_REFERENCE_KIND,
    topologyKind: selection.kind,
    topologyId: selection.id,
    bodyId: selection.bodyId,
    sourceFeatureId: selection.sourceFeatureId || null,
    ownerFeatureId,
    label: label || `${selection.kind}:${selection.id}`,
    descriptor: descriptor ? structuredClone(descriptor) : null,
  };
}

export function topologySelectionForRecord(body, kind, record) {
  return {
    kind,
    id: record.id,
    bodyId: body.id,
    sourceFeatureId: body.sourceFeatureId || null,
  };
}

export function inspectTopologyReferences(document, bodies) {
  const bodyMap = new Map((bodies || []).map((body) => [body.id, body]));
  const featureMap = new Map((document?.features || []).map((feature) => [feature.id, feature]));
  return (document?.references || []).filter((reference) => reference.kind === TOPOLOGY_REFERENCE_KIND && reference.scope !== 'feature-input').map((reference) => {
    const body = bodyMap.get(reference.bodyId);
    const records = topologyRecords(body, reference.topologyKind);
    const resolvedRecord = records.find((record) => record.id === reference.topologyId) || null;
    const candidateBodies = body ? [body] : [...bodyMap.values()];
    const candidates = candidateBodies.flatMap((candidateBody) => topologyRecords(candidateBody, reference.topologyKind).map((record) => ({
      ...topologySelectionForRecord(candidateBody, reference.topologyKind, record),
      descriptor: record.descriptor,
      ...describeTopologyCandidate(reference.descriptor, record.descriptor),
    }))).sort((left, right) => right.score - left.score || left.distance - right.distance || left.id.localeCompare(right.id));
    return {
      reference,
      status: resolvedRecord ? 'resolved' : 'lost',
      resolvedRecord,
      sourceFeature: featureMap.get(reference.sourceFeatureId) || null,
      ownerFeature: featureMap.get(reference.ownerFeatureId) || null,
      reason: resolvedRecord
        ? null
        : body
          ? `Nie znaleziono ${reference.topologyKind} o trwałym ID „${reference.topologyId}”.`
          : `Nie znaleziono bryły źródłowej „${reference.bodyId}”.`,
      candidates,
    };
  });
}

export function reassignTopologyReference(reference, selection, descriptor = null) {
  if (!reference || reference.kind !== TOPOLOGY_REFERENCE_KIND) throw new Error('Nieprawidłowa referencja topologii.');
  if (!selection || selection.kind !== reference.topologyKind || !selection.id || !selection.bodyId) {
    throw new Error(`Wybierz element typu ${reference.topologyKind}, aby ponownie przypisać referencję.`);
  }
  return {
    ...reference,
    topologyId: selection.id,
    bodyId: selection.bodyId,
    sourceFeatureId: selection.sourceFeatureId || reference.sourceFeatureId || null,
    descriptor: descriptor ? structuredClone(descriptor) : reference.descriptor || null,
    repairedAt: new Date().toISOString(),
  };
}
