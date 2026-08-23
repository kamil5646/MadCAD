import { buildDependencyGraph } from './dependency-graph.js';
import { validateDocument } from './document.js';

function featureIdSet(document) {
  return new Set((document.features || []).map((feature) => feature.id));
}

export function dependentTimelineFeatureIds(document, featureId) {
  const featureIds = featureIdSet(document);
  const graph = buildDependencyGraph(document);
  const collected = new Set([featureId]);
  let changed = true;

  while (changed) {
    changed = false;
    const ownedReferenceIds = (document.references || [])
      .filter((reference) => collected.has(reference.ownerFeatureId))
      .map((reference) => reference.id);
    for (const id of graph.affectedBy([...collected, ...ownedReferenceIds])) {
      if (!featureIds.has(id) || collected.has(id)) continue;
      collected.add(id);
      changed = true;
    }
  }

  return (document.features || []).map((feature) => feature.id).filter((id) => collected.has(id));
}

export function deleteTimelineFeatureCascade(document, featureId) {
  const deletedFeatureIds = dependentTimelineFeatureIds(document, featureId);
  if (!deletedFeatureIds.includes(featureId)) return { deletedFeatureIds: [], deletedReferenceIds: [] };
  const deletedSet = new Set(deletedFeatureIds);
  const deletedReferenceIds = (document.references || [])
    .filter((reference) => deletedSet.has(reference.ownerFeatureId))
    .map((reference) => reference.id);
  const deletedReferenceSet = new Set(deletedReferenceIds);
  document.features = (document.features || []).filter((feature) => !deletedSet.has(feature.id));
  document.references = (document.references || []).filter((reference) => !deletedReferenceSet.has(reference.id));
  return { deletedFeatureIds, deletedReferenceIds };
}

export function moveTimelineFeature(document, featureId, delta) {
  const fromIndex = (document.features || []).findIndex((feature) => feature.id === featureId);
  const toIndex = fromIndex + Math.sign(Number(delta) || 0);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= document.features.length) {
    return { ok: false, reason: 'Operacja jest już na skraju historii.', fromIndex, toIndex: fromIndex };
  }
  const candidate = structuredClone(document);
  const [feature] = candidate.features.splice(fromIndex, 1);
  candidate.features.splice(toIndex, 0, feature);
  const validation = validateDocument(candidate);
  if (!validation.valid) {
    return {
      ok: false,
      reason: validation.issues.find((issue) => issue.code === 'BROKEN_REFERENCE')?.message
        || validation.errors[0]
        || 'Zmiana kolejności narusza zależności modelu.',
      fromIndex,
      toIndex,
    };
  }
  return { ok: true, features: candidate.features, fromIndex, toIndex };
}

export function renameTimelineFeature(document, featureId, nextName) {
  const feature = (document.features || []).find((item) => item.id === featureId);
  const normalized = String(nextName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!feature || !normalized) return false;
  feature.name = normalized;
  return true;
}

export function setTimelineFeatureSuppressed(document, featureId, suppressed) {
  const feature = (document.features || []).find((item) => item.id === featureId);
  if (!feature) return false;
  feature.suppressed = Boolean(suppressed);
  return true;
}
