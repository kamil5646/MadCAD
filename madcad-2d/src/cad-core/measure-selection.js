const EPSILON = 1e-9;

function subtract(left, right) {
  return left.map((value, index) => value - right[index]);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + (value * right[index]), 0);
}

function magnitude(vector) {
  return Math.hypot(...vector);
}

function normalize(vector) {
  const length = magnitude(vector);
  return length > EPSILON ? vector.map((value) => value / length) : null;
}

function midpoint(points) {
  if (!points?.length) return null;
  return points[0].map((_value, axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
}

function findRecord(body, item) {
  if (item.kind === 'body') return { kind: 'body', point: body.metrics?.centerOfMass, metrics: body.metrics };
  const collection = item.kind === 'face' ? body.topology?.faces : item.kind === 'edge' ? body.topology?.edges : body.topology?.vertices;
  const descriptor = collection?.find((record) => record.id === item.id)?.descriptor;
  if (!descriptor) return null;
  if (item.kind === 'vertex') return { kind: item.kind, descriptor, point: descriptor.point };
  if (item.kind === 'face') return { kind: item.kind, descriptor, point: descriptor.centerOfMass || descriptor.center, direction: normalize(descriptor.normal || []) };
  return {
    kind: item.kind,
    descriptor,
    point: descriptor.center || midpoint(descriptor.endpoints),
    direction: descriptor.geometry === 'LINE' ? normalize(subtract(descriptor.endpoints[1], descriptor.endpoints[0])) : null,
  };
}

function selectionItems(selection) {
  if (!selection) return [];
  return (selection.items?.length ? selection.items : [selection]).filter((item) => ['body', 'face', 'edge', 'vertex'].includes(item.kind)).slice(-2);
}

function pointToSegmentDistance(point, endpoints) {
  const segment = subtract(endpoints[1], endpoints[0]);
  const lengthSquared = dot(segment, segment);
  if (lengthSquared <= EPSILON) return magnitude(subtract(point, endpoints[0]));
  const parameter = Math.max(0, Math.min(1, dot(subtract(point, endpoints[0]), segment) / lengthSquared));
  const closest = endpoints[0].map((value, axis) => value + (parameter * segment[axis]));
  return magnitude(subtract(point, closest));
}

function distanceBetween(first, second) {
  if (first.kind === 'vertex' && second.kind === 'face') return Math.abs(dot(subtract(first.point, second.point), second.direction));
  if (first.kind === 'face' && second.kind === 'vertex') return distanceBetween(second, first);
  if (first.kind === 'vertex' && second.kind === 'edge' && second.descriptor.geometry === 'LINE') return pointToSegmentDistance(first.point, second.descriptor.endpoints);
  if (first.kind === 'edge' && first.descriptor.geometry === 'LINE' && second.kind === 'vertex') return distanceBetween(second, first);
  if (first.kind === 'face' && second.kind === 'face' && Math.abs(dot(first.direction, second.direction)) > 1 - 1e-6) {
    return Math.abs(dot(subtract(first.point, second.point), first.direction));
  }
  return magnitude(subtract(first.point, second.point));
}

function angleBetween(first, second) {
  if (!first.direction || !second.direction) return null;
  const cosine = Math.min(1, Math.max(-1, Math.abs(dot(first.direction, second.direction))));
  return Math.acos(cosine) * 180 / Math.PI;
}

export function measureSelection(bodies, selection) {
  const selected = selectionItems(selection).map((item) => {
    const body = bodies.find((candidate) => candidate.id === (item.bodyId || item.id));
    const resolved = body ? findRecord(body, item) : null;
    return resolved ? { ...resolved, id: item.id, bodyId: body.id } : null;
  }).filter(Boolean);
  if (!selected.length) return { selectionCount: 0 };

  const first = selected[0];
  const result = { selectionCount: selected.length, kind: first.kind, position: first.point || null };
  if (first.kind === 'body') {
    result.volume = first.metrics?.volume;
    result.area = first.metrics?.area;
    result.dimensions = first.metrics?.dimensions;
  } else if (first.kind === 'face') {
    result.area = first.descriptor.area;
    result.normal = first.descriptor.normal;
  } else if (first.kind === 'edge') {
    result.length = first.descriptor.length;
    if (first.descriptor.geometry === 'CIRCLE') {
      result.radius = first.descriptor.radius;
      result.diameter = first.descriptor.diameter;
    }
  }

  if (selected.length === 2 && first.point && selected[1].point) {
    result.distance = distanceBetween(first, selected[1]);
    result.delta = subtract(selected[1].point, first.point);
    result.angle = angleBetween(first, selected[1]);
  }
  return result;
}
