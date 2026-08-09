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
  if (feature.type === 'extrude') return [feature.distance, feature.secondDistance, feature.startOffset, feature.wallThickness];
  if (feature.type === 'revolve') return [feature.angle];
  if (feature.type === 'hole') return [feature.diameter, feature.depth, feature.firstOffset, feature.secondOffset, feature.counterboreDiameter, feature.counterboreDepth, feature.countersinkDiameter, feature.countersinkAngle, feature.threadDiameter, feature.threadPitch, feature.threadLength, feature.clearance];
  if (feature.type === 'fillet') return [feature.radius];
  if (feature.type === 'chamfer') return [feature.distance];
  if (feature.type === 'shell') return [feature.thickness];
  if (feature.type === 'draft') return [feature.angle];
  if (feature.type === 'primitive') return [feature.x, feature.y, feature.z, feature.width, feature.depth, feature.height, feature.radius, feature.majorRadius, feature.minorRadius];
  if (feature.type === 'transform') return [feature.x, feature.y, feature.z, feature.angle, feature.originX, feature.originY, feature.originZ];
  if (feature.type === 'offsetFace') return [feature.distance];
  if (feature.type === 'textSolid') return [feature.fontSize, feature.depth, feature.x, feature.y, feature.z];
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
          : reference.planeType === 'angle'
            ? [reference.angle, reference.offset]
            : reference.planeType === 'tangent'
              ? [...(reference.center || []), ...(reference.point || []), ...(reference.axis || [])]
              : reference.planeType === 'path'
                ? [...(reference.point || []), ...(reference.direction || [])]
                : [reference.offset];
      for (const expression of expressions) for (const name of expressionDependencies(expression)) addEdge(parameterIdsByName.get(name), reference.id, 'drives');
    } else if (reference.kind === 'construction-axis') {
      const expressions = reference.axisType === 'cylinder'
        ? [...(reference.origin || []), ...(reference.direction || [])]
        : ['edge', 'two-points'].includes(reference.axisType)
          ? (reference.points || []).flat()
          : reference.axisType === 'plane-normal'
            ? (reference.origin || [])
            : [];
      for (const expression of expressions) for (const name of expressionDependencies(expression)) addEdge(parameterIdsByName.get(name), reference.id, 'drives');
      for (const planeId of reference.planeIds || []) addEdge(planeId, reference.id, 'intersects');
      addEdge(reference.planeId, reference.id, 'normal-to');
    } else if (reference.kind === 'construction-point') {
      const expressions = reference.pointType === 'midpoint' ? (reference.points || []).flat() : [...(reference.position || []), reference.distance];
      for (const expression of expressions) for (const name of expressionDependencies(expression)) addEdge(parameterIdsByName.get(name), reference.id, 'drives');
      addEdge(reference.axisId, reference.id, 'intersects');
      addEdge(reference.planeId, reference.id, 'intersects');
    }
  }
  for (const sketch of document.sketches || []) addEdge(sketch.support?.referenceId, sketch.id, 'supports');
  for (const sketch of document.sketches || []) for (const entity of sketch.entities || []) addEdge(entity.projectionReferenceId, entity.id, 'projects');

  for (const feature of document.features || []) {
    addNode(feature.id, 'feature', feature.name, { featureType: feature.type });
    addEdge(document.id, feature.id, 'contains');
    if (feature.sketchId) addEdge(feature.sketchId, feature.id, 'references');
    for (const profileId of feature.profileIds || []) addEdge(profileId, feature.id, 'references');
    for (const entityId of feature.openEntityIds || []) addEdge(entityId, feature.id, 'references-open-chain');
    if (feature.profileId) addEdge(feature.profileId, feature.id, 'references');
    if (feature.pointId) addEdge(feature.pointId, feature.id, 'references');
    for (const referenceId of feature.referenceIds || []) addEdge(referenceId, feature.id, 'references-topology');
    if (feature.type === 'draft' && !['XY', 'XZ', 'YZ'].includes(feature.neutralPlaneId)) addEdge(feature.neutralPlaneId, feature.id, 'neutral-plane');
    if (feature.type === 'splitBody' && !['XY', 'XZ', 'YZ'].includes(feature.planeId)) addEdge(feature.planeId, feature.id, 'split-plane');
    if (feature.type === 'extrude' && feature.extent === 'to-object') addEdge(feature.targetReferenceId, feature.id, 'to-object');
    if (feature.type === 'revolve' && !['X_AXIS', 'Y_AXIS', 'Z_AXIS'].includes(feature.axisId)) addEdge(feature.axisId, feature.id, 'revolve-axis');
    for (const value of featureExpressions(feature)) {
      for (const name of expressionDependencies(value)) addEdge(parameterIdsByName.get(name), feature.id, 'drives');
    }

    if (feature.targetBodyId) addEdge(feature.targetBodyId, feature.id, 'modifies');
    if (feature.toolBodyId) addEdge(feature.toolBodyId, feature.id, 'consumes');
    if (((feature.type === 'extrude' || feature.type === 'revolve') && feature.operation === 'new') || feature.type === 'primitive' || feature.type === 'importedModel' || feature.type === 'splitBody' || (feature.type === 'textSolid' && feature.operation === 'new')) {
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
