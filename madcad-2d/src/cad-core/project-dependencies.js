import { buildDependencyGraph } from './dependency-graph.js';

export const PROJECT_DEPENDENCY_KINDS = Object.freeze(['parameter', 'sketch', 'profile', 'sketch-entity', 'reference', 'feature', 'body', 'component', 'linked-project', 'document']);

const KIND_ORDER = new Map(PROJECT_DEPENDENCY_KINDS.map((kind, index) => [kind, index]));

function compareNodes(left, right) {
  return (KIND_ORDER.get(left.kind) ?? 99) - (KIND_ORDER.get(right.kind) ?? 99)
    || String(left.label || '').localeCompare(String(right.label || ''), 'pl')
    || String(left.id || '').localeCompare(String(right.id || ''));
}

function navigationTarget(node) {
  if (!node) return null;
  if (node.kind === 'parameter') return { kind: 'settings', id: node.id, parameterName: node.name || '' };
  if (node.kind === 'sketch') return { kind: 'sketch', id: node.id };
  if (node.kind === 'profile' || node.kind === 'sketch-entity') return { kind: 'sketch', id: node.sketchId || '', childId: node.id, childKind: node.kind };
  if (node.kind === 'feature') return { kind: 'feature', id: node.id };
  if (node.kind === 'body') return { kind: 'body', id: node.id };
  if (node.kind === 'component') return { kind: 'component', id: node.id };
  if (node.kind === 'linked-project') return { kind: 'component', id: node.linkedComponentId || '', linkedProjectId: node.id };
  if (node.kind === 'reference') {
    const kind = node.referenceKind === 'construction-axis' ? 'constructionAxis' : node.referenceKind === 'construction-point' ? 'constructionPoint' : node.referenceKind === 'construction-plane' ? 'constructionPlane' : 'document';
    return { kind, id: kind === 'document' ? '' : node.id };
  }
  return { kind: 'document', id: node.id };
}

function relation(edge, node, depth = 1) {
  return { id: node.id, kind: node.kind, label: node.label || node.id, relation: edge.kind, depth, target: navigationTarget(node) };
}

function traverse(sourceId, adjacency, nodeMap) {
  const queue = [{ id: sourceId, depth: 0 }];
  const visited = new Set([sourceId]);
  const result = [];
  while (queue.length) {
    const current = queue.shift();
    for (const edge of adjacency.get(current.id) || []) {
      const nextId = edge.nextId;
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      const node = nodeMap.get(nextId);
      if (!node) continue;
      const depth = current.depth + 1;
      result.push(relation(edge, node, depth));
      queue.push({ id: nextId, depth });
    }
  }
  return result.sort((left, right) => left.depth - right.depth || compareNodes(left, right));
}

export function dependencyNodeIdForSelection(selection, document) {
  if (!selection) return document?.id || '';
  if (selection.kind === 'document') return document?.id || selection.id || '';
  if (selection.kind === 'settings') return document?.parameters?.find((parameter) => parameter.name === selection.parameterName)?.id || document?.id || '';
  if (selection.kind === 'componentInstance') return selection.componentId || document?.componentInstances?.find((item) => item.id === selection.id)?.componentId || document?.id || '';
  if (['face', 'edge', 'vertex'].includes(selection.kind)) return selection.bodyId || document?.id || '';
  if (selection.kind === 'sketchEntities') return selection.ids?.[0] || selection.sketchId || document?.id || '';
  if (selection.kind === 'sketchPoint') return selection.id || selection.sketchId || document?.id || '';
  if (selection.kind === 'sketchConstraint') return selection.sketchId || document?.id || '';
  return selection.id || document?.id || '';
}

export function inspectProjectDependencies(document, selectedId, serializedGraph = null) {
  const graph = serializedGraph || buildDependencyGraph(document).toJSON();
  const nodes = (graph.nodes || []).filter((node) => PROJECT_DEPENDENCY_KINDS.includes(node.kind)).sort(compareNodes);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const selected = nodeMap.get(selectedId) || nodeMap.get(document?.id) || nodes[0] || null;
  if (!selected) return { selected: null, nodes: [], uses: [], usedBy: [], upstream: [], affected: [], counts: { uses: 0, usedBy: 0, upstream: 0, affected: 0 } };

  const relevantEdges = (graph.edges || []).filter((edge) => edge.kind !== 'contains' && nodeMap.has(edge.from) && nodeMap.has(edge.to));
  const forward = new Map();
  const reverse = new Map();
  for (const edge of relevantEdges) {
    if (!forward.has(edge.from)) forward.set(edge.from, []);
    if (!reverse.has(edge.to)) reverse.set(edge.to, []);
    forward.get(edge.from).push({ ...edge, nextId: edge.to });
    reverse.get(edge.to).push({ ...edge, nextId: edge.from });
  }
  const uses = (reverse.get(selected.id) || []).map((edge) => relation(edge, nodeMap.get(edge.from))).sort(compareNodes);
  const usedBy = (forward.get(selected.id) || []).map((edge) => relation(edge, nodeMap.get(edge.to))).sort(compareNodes);
  const upstream = traverse(selected.id, reverse, nodeMap);
  const affected = traverse(selected.id, forward, nodeMap);
  return {
    selected: { ...selected, target: navigationTarget(selected) },
    nodes: nodes.map((node) => ({ ...node, target: navigationTarget(node) })),
    uses,
    usedBy,
    upstream,
    affected,
    counts: { uses: uses.length, usedBy: usedBy.length, upstream: upstream.length, affected: affected.length },
  };
}
