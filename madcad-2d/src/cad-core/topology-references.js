import { createId } from './ids.js';
import { resolveSketchFrame } from './sketch-frame.js';
import { movedSupportFaceIndex } from './topology-fallback.js';

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

function facePlaneDrift(referenceDescriptor, candidateDescriptor) {
  if (referenceDescriptor?.geometry !== 'PLANE' || candidateDescriptor?.geometry !== 'PLANE'
    || !Array.isArray(referenceDescriptor.center) || !Array.isArray(candidateDescriptor.center)
    || !Array.isArray(referenceDescriptor.normal) || !Array.isArray(candidateDescriptor.normal)) return false;
  const normal = referenceDescriptor.normal;
  const normalLength = Math.hypot(...normal);
  const candidateLength = Math.hypot(...candidateDescriptor.normal);
  if (!normalLength || !candidateLength) return false;
  const alignment = normal.reduce((sum, value, axis) => sum + value * candidateDescriptor.normal[axis], 0) / (normalLength * candidateLength);
  const distance = Math.abs(normal.reduce((sum, value, axis) => sum
    + value * (candidateDescriptor.center[axis] - referenceDescriptor.center[axis]), 0)) / normalLength;
  return alignment < 0.99999 || distance > 1e-3;
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
  const sketchSupportIds = new Set((document?.sketches || []).filter((sketch) => sketch.support?.kind === 'face')
    .map((sketch) => sketch.support.referenceId));
  return (document?.references || []).filter((reference) => reference.kind === TOPOLOGY_REFERENCE_KIND && reference.scope !== 'feature-input').map((reference) => {
    const body = bodyMap.get(reference.bodyId);
    const records = topologyRecords(body, reference.topologyKind);
    const resolvedRecord = records.find((record) => record.id === reference.topologyId) || null;
    const staleSketchPlane = Boolean(resolvedRecord && sketchSupportIds.has(reference.id)
      && facePlaneDrift(reference.descriptor, resolvedRecord.descriptor));
    const candidateBodies = body ? [body] : [...bodyMap.values()];
    const candidates = candidateBodies.flatMap((candidateBody) => topologyRecords(candidateBody, reference.topologyKind).map((record) => ({
      ...topologySelectionForRecord(candidateBody, reference.topologyKind, record),
      descriptor: record.descriptor,
      ...describeTopologyCandidate(reference.descriptor, record.descriptor),
    }))).sort((left, right) => right.score - left.score || left.distance - right.distance || left.id.localeCompare(right.id));
    return {
      reference,
      status: resolvedRecord && !staleSketchPlane ? 'resolved' : 'lost',
      resolvedRecord,
      sourceFeature: featureMap.get(reference.sourceFeatureId) || null,
      ownerFeature: featureMap.get(reference.ownerFeatureId) || null,
      reason: staleSketchPlane
        ? 'Ściana zachowała ID, ale zmieniła położenie lub kierunek płaszczyzny szkicu.'
        : resolvedRecord
          ? null
          : body
            ? `Nie znaleziono ${reference.topologyKind} o trwałym ID „${reference.topologyId}”.`
            : `Nie znaleziono bryły źródłowej „${reference.bodyId}”.`,
      candidates,
    };
  });
}

// Face-supported sketches are moved together with their source feature before
// the kernel rebuilds the model, so the face they sit on gets a new persistent
// ID. Rebind such a reference to the rebuilt face when exactly one coplanar
// candidate sits where the tracked descriptor says it should be; anything
// ambiguous stays lost and goes through the repair workflow.
// `followMovedIds` lists references that resolved before the current edit;
// only those may follow a face that slid along its normal. A drift that is
// already present when a file is opened goes through the repair workflow.
export function rebindMovedFaceSupportReferences(document, bodies, { followMovedIds = null } = {}) {
  const supportIds = new Set((document?.sketches || []).filter((sketch) => sketch.support?.kind === 'face')
    .map((sketch) => sketch.support.referenceId));
  if (!supportIds.size) return [];
  const rebound = [];
  for (const state of inspectTopologyReferences(document, bodies)) {
    const { reference } = state;
    if (state.status !== 'lost' || state.resolvedRecord || reference.topologyKind !== 'face'
      || !supportIds.has(reference.id) || !state.candidates.some((candidate) => candidate.bodyId === reference.bodyId)) continue;
    const claimed = new Set(document.references
      .filter((other) => other.id !== reference.id && other.kind === TOPOLOGY_REFERENCE_KIND && other.bodyId === reference.bodyId)
      .map((other) => other.topologyId));
    // A sketch only needs the plane, so in-plane centroid shifts (a cut through
    // the face, a changed outline) must not block the rebind. Among several
    // coplanar faces take the nearest one only when it is clearly the nearest.
    const matches = state.candidates.filter((candidate) => candidate.bodyId === reference.bodyId
      && candidate.descriptor?.geometry === 'PLANE' && reference.descriptor?.geometry === 'PLANE'
      && !claimed.has(candidate.id) && !facePlaneDrift(reference.descriptor, candidate.descriptor))
      .sort((left, right) => left.distance - right.distance);
    if (!matches.length) {
      if (!followMovedIds?.has(reference.id)) continue;
      // The face slid along its normal because an upstream dimension changed
      // (Extrude 40 -> 50 lifts a face-on-face sketch by 10 mm). Follow it only
      // when one face of this body is the obvious successor.
      const bodyCandidates = state.candidates.filter((candidate) => candidate.bodyId === reference.bodyId);
      const excluded = new Set(bodyCandidates.flatMap((candidate, index) => (claimed.has(candidate.id) ? [index] : [])));
      const index = movedSupportFaceIndex(reference.descriptor, bodyCandidates.map((candidate) => candidate.descriptor), excluded);
      if (index < 0 || !moveSupportedSketches(document, reference, bodyCandidates[index].descriptor)) continue;
      reference.topologyId = bodyCandidates[index].id;
      reference.descriptor = structuredClone(bodyCandidates[index].descriptor);
      rebound.push(reference.id);
      continue;
    }
    if (matches.length > 1 && !(matches[0].distance < matches[1].distance && matches[0].distance * 2 <= matches[1].distance)) continue;
    reference.topologyId = matches[0].id;
    reference.descriptor = structuredClone(matches[0].descriptor);
    rebound.push(reference.id);
  }
  return rebound;
}

// Shift every sketch on `reference` along its own normal so it lies on the
// plane of `descriptor`. All-or-nothing: returns false and changes nothing when
// a sketch is not parallel to the face or uses a parametric offset.
function moveSupportedSketches(document, reference, descriptor) {
  const faceNormal = descriptor.normal;
  const faceNormalLength = Math.hypot(...faceNormal);
  if (!faceNormalLength) return false;
  const moves = [];
  for (const sketch of document.sketches || []) {
    if (sketch.support?.kind !== 'face' || sketch.support.referenceId !== reference.id) continue;
    let frame;
    try { frame = resolveSketchFrame(sketch); } catch { return false; }
    const alignment = frame.normal.reduce((sum, value, axis) => sum + value * faceNormal[axis], 0) / faceNormalLength;
    if (Math.abs(alignment) < 1 - 1e-6) return false;
    const distance = frame.normal.reduce((sum, value, axis) => sum + value * (descriptor.center[axis] - frame.origin[axis]), 0);
    if (sketch.frame) {
      moves.push(() => { sketch.frame = { ...sketch.frame, origin: sketch.frame.origin.map((value, axis) => value + frame.normal[axis] * distance) }; });
      continue;
    }
    const offset = Number(sketch.planeOffset || 0);
    if (!Number.isFinite(offset)) return false;
    // Offset sign differs per base plane (XZ uses -Y), so measure it.
    const step = resolveSketchFrame({ plane: sketch.plane, planeOffset: offset + 1 }).origin
      .reduce((sum, value, axis) => sum + (value - frame.origin[axis]) * frame.normal[axis], 0);
    if (Math.abs(Math.abs(step) - 1) > 1e-9) return false;
    moves.push(() => { sketch.planeOffset = String(Number((offset + distance / step).toFixed(9))); });
  }
  if (!moves.length) return false;
  moves.forEach((move) => move());
  return true;
}

// Identifies a support reference together with the face position it recorded,
// so a reference loaded with a different (stale) position is not mistaken for
// one that was resolved a moment ago.
export function supportReferenceKey(reference) {
  const descriptor = reference?.descriptor;
  const round = (values) => (Array.isArray(values) ? values.map((value) => Number(value).toFixed(6)).join(',') : '');
  return `${reference?.id}|${round(descriptor?.center)}|${round(descriptor?.normal)}`;
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
