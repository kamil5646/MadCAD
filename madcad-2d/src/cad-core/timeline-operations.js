import { buildDependencyGraph } from './dependency-graph.js';
import { validateDocument } from './document.js';
import { createId } from './ids.js';

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
  if (!deletedFeatureIds.includes(featureId)) return { deletedFeatureIds: [], deletedReferenceIds: [], deletedBodyIds: [], deletedDrawingViewIds: [] };
  const deletedSet = new Set(deletedFeatureIds);
  const rollbackIndexBefore = (document.features || []).findIndex((feature) => feature.id === document.timelineRollbackFeatureId);
  const rollbackFallbackId = rollbackIndexBefore < 0
    ? ''
    : (document.features || []).slice(0, rollbackIndexBefore).filter((feature) => !deletedSet.has(feature.id)).at(-1)?.id || '';
  const deletedBodyIds = deletedFeatureIds.map((id) => `body-${id}`);
  const deletedBodySet = new Set(deletedBodyIds);
  const deletedReferenceIds = (document.references || [])
    .filter((reference) => deletedSet.has(reference.ownerFeatureId))
    .map((reference) => reference.id);
  const deletedReferenceSet = new Set(deletedReferenceIds);
  document.features = (document.features || []).filter((feature) => !deletedSet.has(feature.id));
  document.featureGroups = (document.featureGroups || []).map((group) => ({
    ...group,
    featureIds: group.featureIds.filter((id) => !deletedSet.has(id)),
  })).filter((group) => group.featureIds.length);
  if (deletedSet.has(document.timelineRollbackFeatureId)) {
    document.timelineRollbackFeatureId = rollbackFallbackId;
  }
  document.references = (document.references || []).filter((reference) => !deletedReferenceSet.has(reference.id));
  document.bodies = (document.bodies || []).filter((body) => !deletedBodySet.has(body.id));
  document.components = (document.components || []).map((component) => ({
    ...component,
    bodyIds: (component.bodyIds || []).filter((bodyId) => !deletedBodySet.has(bodyId)),
  }));
  const deletedDrawingViewIds = new Set();
  for (const sheet of document.drawings || []) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const view of sheet.views || []) {
        const bodyIds = (view.bodyIds || []).filter((bodyId) => !deletedBodySet.has(bodyId));
        const parentDeleted = view.parentViewId && deletedDrawingViewIds.has(view.parentViewId);
        if (!bodyIds.length || parentDeleted) {
          if (!deletedDrawingViewIds.has(view.id)) changed = true;
          deletedDrawingViewIds.add(view.id);
        } else view.bodyIds = bodyIds;
      }
    }
    sheet.views = (sheet.views || []).filter((view) => !deletedDrawingViewIds.has(view.id));
    sheet.annotations = (sheet.annotations || []).filter((annotation) => !deletedDrawingViewIds.has(annotation.viewId)
      && !(annotation.type === 'balloon' && deletedBodySet.has(annotation.bodyId)));
    sheet.tables = (sheet.tables || []).filter((table) => table.type !== 'hole-table' || !deletedDrawingViewIds.has(table.viewId));
  }
  return { deletedFeatureIds, deletedReferenceIds, deletedBodyIds, deletedDrawingViewIds: [...deletedDrawingViewIds] };
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

export function timelineRollbackIndex(document) {
  if (!document.timelineRollbackFeatureId) return (document.features || []).length - 1;
  return (document.features || []).findIndex((feature) => feature.id === document.timelineRollbackFeatureId);
}

export function setTimelineRollback(document, featureId = '') {
  if (featureId && !(document.features || []).some((feature) => feature.id === featureId)) throw new Error('Nie znaleziono operacji dla markera rollback.');
  const containingGroup = (document.featureGroups || []).find((group) => group.featureIds.includes(featureId));
  document.timelineRollbackFeatureId = containingGroup?.featureIds.at(-1) || featureId;
  return timelineRollbackIndex(document);
}

export function insertTimelineFeature(document, feature) {
  if (!feature?.id) throw new Error('Wstawiana operacja wymaga ID.');
  if ((document.features || []).some((item) => item.id === feature.id)) throw new Error('Operacja o tym ID już istnieje.');
  const hadRollback = Boolean(document.timelineRollbackFeatureId);
  const rollbackIndex = timelineRollbackIndex(document);
  const containingGroup = (document.featureGroups || []).find((group) => group.featureIds.includes(document.timelineRollbackFeatureId));
  const insertionIndex = containingGroup
    ? Math.max(...containingGroup.featureIds.map((id) => document.features.findIndex((featureItem) => featureItem.id === id))) + 1
    : rollbackIndex + 1;
  const candidate = structuredClone(document);
  candidate.features.splice(insertionIndex, 0, feature);
  candidate.timelineRollbackFeatureId = hadRollback ? feature.id : '';
  const validation = validateDocument(candidate);
  if (!validation.valid) throw new Error(validation.errors[0] || 'Nie można wstawić operacji w tym miejscu historii.');
  document.features = candidate.features;
  document.timelineRollbackFeatureId = hadRollback ? feature.id : '';
  return { feature, index: insertionIndex };
}

function uniqueFeatureGroupName(document, requestedName = '', excludedId = '') {
  const base = String(requestedName || `Grupa ${(document.featureGroups || []).length + 1}`).trim().replace(/\s+/g, ' ').slice(0, 80) || 'Grupa';
  const used = new Set((document.featureGroups || []).filter((group) => group.id !== excludedId).map((group) => group.name.toLocaleLowerCase()));
  if (!used.has(base.toLocaleLowerCase())) return base;
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base} ${suffix}`.slice(0, 80);
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('Nie można utworzyć unikalnej nazwy grupy historii.');
}

export function createTimelineFeatureGroup(document, featureIds, name = '', groupId = createId('feature-group')) {
  const ids = [...new Set(Array.isArray(featureIds) ? featureIds : [])];
  if (!ids.length) throw new Error('Grupa historii wymaga co najmniej jednej operacji.');
  const indices = ids.map((id) => (document.features || []).findIndex((feature) => feature.id === id));
  if (indices.some((index) => index < 0)) throw new Error('Grupa historii wskazuje brakującą operację.');
  const ordered = indices.map((index, position) => ({ index, id: ids[position] })).sort((first, second) => first.index - second.index);
  if (ordered.some((item, position) => position > 0 && item.index !== ordered[position - 1].index + 1)) throw new Error('Grupowane operacje muszą być ciągłe na osi czasu.');
  if ((document.featureGroups || []).some((group) => group.featureIds.some((id) => ids.includes(id)))) throw new Error('Jedna z operacji należy już do grupy historii.');
  if (typeof groupId !== 'string' || !groupId.trim()) throw new Error('Grupa historii wymaga ID.');
  if ((document.featureGroups || []).some((group) => group.id === groupId)) throw new Error('Grupa historii o tym ID już istnieje.');
  const group = { id: groupId, name: uniqueFeatureGroupName(document, name), featureIds: ordered.map((item) => item.id), collapsed: false };
  (document.featureGroups ||= []).push(group);
  if (group.featureIds.includes(document.timelineRollbackFeatureId)) document.timelineRollbackFeatureId = group.featureIds.at(-1);
  return group;
}

export function updateTimelineFeatureGroup(document, groupId, patch = {}) {
  const group = (document.featureGroups || []).find((item) => item.id === groupId);
  if (!group) throw new Error('Nie znaleziono grupy historii.');
  if (patch.name !== undefined) group.name = uniqueFeatureGroupName(document, patch.name, groupId);
  if (patch.collapsed !== undefined) group.collapsed = Boolean(patch.collapsed);
  return group;
}

export function deleteTimelineFeatureGroup(document, groupId) {
  const index = (document.featureGroups || []).findIndex((group) => group.id === groupId);
  if (index < 0) throw new Error('Nie znaleziono grupy historii.');
  return document.featureGroups.splice(index, 1)[0];
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
