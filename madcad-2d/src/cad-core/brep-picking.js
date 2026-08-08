export function topologyIdForFaceIndex(faceGroups, faceIndex) {
  if (!Number.isInteger(faceIndex) || faceIndex < 0) return null;
  const indexOffset = faceIndex * 3;
  const groups = faceGroups || [];
  let low = 0;
  let high = groups.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const group = groups[middle];
    if (indexOffset < group.start) high = middle - 1;
    else if (indexOffset >= group.start + group.count) low = middle + 1;
    else return group.topologyId || null;
  }
  return null;
}

export function edgeGroupVertices(lines, group) {
  if (!lines || !group || !Number.isInteger(group.start) || !Number.isInteger(group.count) || group.start < 0 || group.count <= 0) return new Float32Array();
  return lines.slice(group.start * 3, (group.start + group.count) * 3);
}

export function topologySelectionFromIntersection(intersection) {
  const object = intersection?.object;
  if (!object?.userData?.bodyId) return null;
  if (object.userData.topologyKind === 'edge' && object.userData.topologyId) {
    return { kind: 'edge', id: object.userData.topologyId, bodyId: object.userData.bodyId, sourceFeatureId: object.userData.sourceFeatureId || null };
  }
  if (object.userData.topologyKind === 'vertex' && object.userData.topologyId) {
    return { kind: 'vertex', id: object.userData.topologyId, bodyId: object.userData.bodyId, sourceFeatureId: object.userData.sourceFeatureId || null };
  }
  const topologyId = topologyIdForFaceIndex(object.userData.faceGroups, intersection.faceIndex);
  if (topologyId) return { kind: 'face', id: topologyId, bodyId: object.userData.bodyId, sourceFeatureId: object.userData.sourceFeatureId || null };
  return { kind: 'body', id: object.userData.bodyId, bodyId: object.userData.bodyId, sourceFeatureId: object.userData.sourceFeatureId || null };
}
