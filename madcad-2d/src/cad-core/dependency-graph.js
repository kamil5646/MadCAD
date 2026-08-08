import { listExpressionIdentifiers } from './expressions.js';

function expressionDependencies(value) {
  if (typeof value !== 'string') return [];
  try {
    return listExpressionIdentifiers(value);
  } catch (_error) {
    return [];
  }
}

function featureExpressions(feature) {
  if (feature.type === 'extrude') return [feature.distance];
  if (feature.type === 'hole') return [feature.diameter, feature.depth];
  if (feature.type === 'fillet') return [feature.radius];
  if (feature.type === 'chamfer') return [feature.distance];
  return [];
}

export function buildDependencyGraph(document) {
  const nodes = new Map();
  const edges = [];
  const edgeKeys = new Set();
  const parameterIdsByName = new Map();
  const bodyProducerById = new Map();

  const addNode = (id, kind, label = id, metadata = {}) => {
    if (!id || nodes.has(id)) return;
    nodes.set(id, { id, kind, label, ...metadata });
  };
  const addEdge = (from, to, kind) => {
    if (!from || !to || !nodes.has(from) || !nodes.has(to)) return;
    const key = `${from}\u0000${to}\u0000${kind}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, kind });
  };

  addNode(document.id, 'document', document.name);
  for (const parameter of document.parameters || []) {
    addNode(parameter.id, 'parameter', parameter.label || parameter.name, { name: parameter.name });
    parameterIdsByName.set(parameter.name, parameter.id);
    addEdge(document.id, parameter.id, 'contains');
  }
  for (const parameter of document.parameters || []) {
    for (const name of expressionDependencies(parameter.expression)) {
      addEdge(parameterIdsByName.get(name), parameter.id, 'drives');
    }
  }

  for (const sketch of document.sketches || []) {
    addNode(sketch.id, 'sketch', sketch.name, { plane: sketch.plane });
    addEdge(document.id, sketch.id, 'contains');
    for (const profile of sketch.profiles || []) {
      addNode(profile.id, 'profile', profile.name, { profileType: profile.type, sketchId: sketch.id });
      addEdge(sketch.id, profile.id, 'contains');
      for (const value of Object.values(profile.geometry || {})) {
        for (const name of expressionDependencies(value)) addEdge(parameterIdsByName.get(name), profile.id, 'drives');
      }
    }
    for (const entity of sketch.entities || []) {
      addNode(entity.id, 'sketch-entity', entity.name || entity.type, { sketchId: sketch.id });
      addEdge(sketch.id, entity.id, 'contains');
      const expressionValues = Array.isArray(entity.expressionKeys)
        ? entity.expressionKeys.map((key) => entity.geometry?.[key])
        : Object.values(entity.geometry || {});
      for (const value of expressionValues) {
        for (const name of expressionDependencies(value)) addEdge(parameterIdsByName.get(name), entity.id, 'drives');
      }
    }
    for (const profile of sketch.profiles || []) {
      for (const entityId of profile.entityIds || []) addEdge(entityId, profile.id, 'bounds');
      for (const loop of profile.innerLoops || []) {
        for (const entityId of loop.entityIds || []) addEdge(entityId, profile.id, 'bounds-hole');
      }
    }
  }

  for (const body of document.bodies || []) {
    addNode(body.id, 'body', body.name || body.id, { persisted: true });
    addEdge(document.id, body.id, 'contains');
  }

  for (const reference of document.references || []) {
    addNode(reference.id, 'reference', reference.label || reference.topologyId || reference.id, {
      referenceKind: reference.kind,
      topologyKind: reference.topologyKind,
      topologyId: reference.topologyId,
      bodyId: reference.bodyId,
    });
    addEdge(document.id, reference.id, 'contains');
    if (reference.kind === 'construction-plane') {
      const expressions = reference.planeType === 'midplane'
        ? [reference.firstOffset, reference.secondOffset]
        : reference.planeType === 'three-points'
          ? (reference.points || []).flat()
          : [reference.offset];
      for (const expression of expressions) for (const name of expressionDependencies(expression)) addEdge(parameterIdsByName.get(name), reference.id, 'drives');
    } else if (reference.kind === 'construction-axis') {
      const expressions = reference.axisType === 'cylinder'
        ? [...(reference.origin || []), ...(reference.direction || [])]
        : ['edge', 'two-points'].includes(reference.axisType)
          ? (reference.points || []).flat()
          : [];
      for (const expression of expressions) for (const name of expressionDependencies(expression)) addEdge(parameterIdsByName.get(name), reference.id, 'drives');
      for (const planeId of reference.planeIds || []) addEdge(planeId, reference.id, 'intersects');
    } else if (reference.kind === 'construction-point') {
      for (const expression of reference.position || []) for (const name of expressionDependencies(expression)) addEdge(parameterIdsByName.get(name), reference.id, 'drives');
      addEdge(reference.axisId, reference.id, 'intersects');
      addEdge(reference.planeId, reference.id, 'intersects');
    }
  }

  for (const feature of document.features || []) {
    addNode(feature.id, 'feature', feature.name, { featureType: feature.type });
    addEdge(document.id, feature.id, 'contains');
    if (feature.sketchId) addEdge(feature.sketchId, feature.id, 'references');
    for (const profileId of feature.profileIds || []) addEdge(profileId, feature.id, 'references');
    if (feature.profileId) addEdge(feature.profileId, feature.id, 'references');
    if (feature.pointId) addEdge(feature.pointId, feature.id, 'references');
    for (const referenceId of feature.referenceIds || []) addEdge(referenceId, feature.id, 'references-topology');
    for (const value of featureExpressions(feature)) {
      for (const name of expressionDependencies(value)) addEdge(parameterIdsByName.get(name), feature.id, 'drives');
    }

    if (feature.targetBodyId) addEdge(feature.targetBodyId, feature.id, 'modifies');
    if (feature.type === 'extrude' && feature.operation === 'new') {
      const bodyId = `body-${feature.id}`;
      addNode(bodyId, 'body', feature.name, { persisted: false, producerFeatureId: feature.id });
      bodyProducerById.set(bodyId, feature.id);
      addEdge(feature.id, bodyId, 'produces');
    } else if (feature.targetBodyId) {
      addEdge(feature.id, feature.targetBodyId, 'updates');
    }
  }

  for (const component of document.components || []) {
    addNode(component.id, 'component', component.name || component.id);
    addEdge(document.id, component.id, 'contains');
    for (const sketchId of component.sketchIds || []) addEdge(sketchId, component.id, 'owned-by');
    for (const bodyId of component.bodyIds || []) addEdge(bodyId, component.id, 'owned-by');
    for (const childId of component.componentIds || []) addEdge(childId, component.id, 'owned-by');
  }

  const dependents = new Map();
  for (const edge of edges) {
    if (!dependents.has(edge.from)) dependents.set(edge.from, new Set());
    if (edge.kind !== 'contains') dependents.get(edge.from).add(edge.to);
  }

  return {
    nodes: [...nodes.values()],
    edges,
    affectedBy(sourceIds) {
      const queue = [...new Set(Array.isArray(sourceIds) ? sourceIds : [sourceIds])];
      const affected = new Set();
      while (queue.length) {
        const current = queue.shift();
        for (const dependent of dependents.get(current) || []) {
          if (affected.has(dependent)) continue;
          affected.add(dependent);
          queue.push(dependent);
        }
      }
      return [...affected];
    },
    producerOfBody(bodyId) {
      return bodyProducerById.get(bodyId) || null;
    },
    toJSON() {
      return { nodes: [...nodes.values()], edges: [...edges] };
    },
  };
}
