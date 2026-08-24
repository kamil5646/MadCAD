export const PROJECT_DIFF_STATES = Object.freeze(['added', 'removed', 'modified', 'unchanged']);

export const PROJECT_DIFF_CATEGORIES = Object.freeze([
  { id: 'parameters', label: 'Parametry', collection: 'parameters' },
  { id: 'sketches', label: 'Szkice', collection: 'sketches' },
  { id: 'features', label: 'Operacje', collection: 'features' },
  { id: 'components', label: 'Komponenty', collection: 'components' },
  { id: 'linkedProjects', label: 'Linki projektów', collection: 'linkedProjects' },
]);

function textFingerprint(value) {
  let hash = 2166136261;
  const source = String(value || '');
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function comparable(value, key = '') {
  if (key === 'dataBase64') return { fingerprint: textFingerprint(value) };
  if (Array.isArray(value)) return value.map((item) => comparable(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter((item) => !['modifiedAt', 'refreshedAt', 'sourceModifiedAt'].includes(item)).map((item) => [item, comparable(value[item], item)]));
  }
  return value;
}

function serialized(value) {
  return JSON.stringify(comparable(value));
}

function itemId(item, category, index) {
  if (typeof item?.id === 'string' && item.id) return item.id;
  if (category === 'parameters' && typeof item?.name === 'string' && item.name) return `name:${item.name}`;
  return `index:${index}`;
}

function itemLabel(item, category, index) {
  if (typeof item?.name === 'string' && item.name) return item.name;
  if (category === 'linkedProjects') return item?.sourceName || item?.fileName || `Link ${index + 1}`;
  return `${PROJECT_DIFF_CATEGORIES.find((entry) => entry.id === category)?.label || category} ${index + 1}`;
}

function changedFields(before, after) {
  return [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter((key) => key !== 'id' && serialized(before?.[key]) !== serialized(after?.[key]))
    .sort();
}

function compareCollection(beforeItems, afterItems, category) {
  const beforeMap = new Map((beforeItems || []).map((item, index) => [itemId(item, category, index), { item, index }]));
  const afterMap = new Map((afterItems || []).map((item, index) => [itemId(item, category, index), { item, index }]));
  const ids = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
  return ids.map((id) => {
    const before = beforeMap.get(id);
    const after = afterMap.get(id);
    const state = !before ? 'added' : !after ? 'removed' : serialized(before.item) === serialized(after.item) ? 'unchanged' : 'modified';
    const source = after || before;
    return {
      id,
      category,
      label: itemLabel(source.item, category, source.index),
      state,
      changedFields: state === 'modified' ? changedFields(before.item, after.item) : [],
      before: before?.item || null,
      after: after?.item || null,
    };
  });
}

export function compareProjectDocuments(beforeDocument, afterDocument) {
  if (!beforeDocument || typeof beforeDocument !== 'object' || !afterDocument || typeof afterDocument !== 'object') throw new Error('Porównanie wymaga dwóch dokumentów projektu.');
  const categories = PROJECT_DIFF_CATEGORIES.map((category) => {
    const items = compareCollection(beforeDocument[category.collection], afterDocument[category.collection], category.id);
    return {
      ...category,
      items,
      counts: Object.fromEntries(PROJECT_DIFF_STATES.map((state) => [state, items.filter((item) => item.state === state).length])),
    };
  });
  const items = categories.flatMap((category) => category.items);
  const counts = Object.fromEntries(PROJECT_DIFF_STATES.map((state) => [state, items.filter((item) => item.state === state).length]));
  return {
    before: { id: beforeDocument.id || '', name: beforeDocument.name || 'Projekt bazowy', schemaVersion: Number(beforeDocument.schemaVersion) || 0 },
    after: { id: afterDocument.id || '', name: afterDocument.name || 'Projekt bieżący', schemaVersion: Number(afterDocument.schemaVersion) || 0 },
    categories,
    counts,
    changed: counts.added + counts.removed + counts.modified,
  };
}
