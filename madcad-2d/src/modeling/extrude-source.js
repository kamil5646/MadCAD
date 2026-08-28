function standardLineEntities(sketch) {
  return (sketch?.entities || []).filter((entity) => entity.type === 'line'
    && entity.role !== 'construction'
    && entity.role !== 'projected'
    && Array.isArray(entity.pointIds)
    && entity.pointIds.length === 2);
}

function isSingleOpenChain(lines) {
  if (!lines.length) return false;
  const adjacency = new Map();
  for (const line of lines) {
    const [first, second] = line.pointIds;
    if (!adjacency.has(first)) adjacency.set(first, []);
    if (!adjacency.has(second)) adjacency.set(second, []);
    adjacency.get(first).push(second);
    adjacency.get(second).push(first);
  }
  if ([...adjacency.values()].some((neighbors) => neighbors.length > 2)) return false;
  if ([...adjacency.values()].filter((neighbors) => neighbors.length === 1).length !== 2) return false;
  const visited = new Set();
  const queue = [adjacency.keys().next().value];
  while (queue.length) {
    const pointId = queue.shift();
    if (visited.has(pointId)) continue;
    visited.add(pointId);
    queue.push(...adjacency.get(pointId));
  }
  return visited.size === adjacency.size;
}

export function resolveExtrudeSource({ sketches = [], selection = null } = {}) {
  const selectedSketchId = selection?.sketchId || (selection?.kind === 'sketch' ? selection.id : null);
  const orderedSketches = [
    sketches.find((sketch) => sketch.id === selectedSketchId),
    ...[...sketches].reverse(),
  ].filter(Boolean).filter((sketch, index, entries) => entries.findIndex((candidate) => candidate.id === sketch.id) === index);

  if (selection?.kind === 'profile') {
    for (const sketch of orderedSketches) {
      const profile = (sketch.profiles || []).find((candidate) => candidate.id === selection.id);
      if (profile) return { kind: 'profile', sketch, profile };
    }
  }

  for (const sketch of orderedSketches) {
    const profile = sketch.profiles?.at(-1);
    if (profile) return { kind: 'profile', sketch, profile };
    const lines = standardLineEntities(sketch);
    if (isSingleOpenChain(lines)) return { kind: 'open-chain', sketch, entityIds: lines.map((line) => line.id) };
    if ((sketch.entities || []).length) return { kind: 'incomplete', sketch };
  }
  return { kind: 'none' };
}
