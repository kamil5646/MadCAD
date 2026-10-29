// Planar arrangement of sketch lines, arcs and circles. Curves are split wherever they
// cross or touch, and every bounded face of the resulting graph becomes a region, the way
// Fusion offers each closed area of a sketch as a profile. Nested, unconnected geometry
// (a circle inside a rectangle) becomes a hole of the smallest region around it.

const TAU = Math.PI * 2;

const subtract = (first, second) => [first[0] - second[0], first[1] - second[1]];
const length = (vector) => Math.hypot(vector[0], vector[1]);
const distance = (first, second) => length(subtract(first, second));

function arcFrame(edge) {
  const radius = distance(edge.center, edge.start);
  const startAngle = Math.atan2(edge.start[1] - edge.center[1], edge.start[0] - edge.center[0]);
  const endAngle = Math.atan2(edge.end[1] - edge.center[1], edge.end[0] - edge.center[0]);
  let sweep = endAngle - startAngle;
  if (edge.direction === 'cw') { while (sweep >= 0) sweep -= TAU; } else { while (sweep <= 0) sweep += TAU; }
  return { radius, startAngle, sweep };
}

function frameOf(edge) {
  if (edge.type === 'line') return { length: distance(edge.start, edge.end) };
  if (edge.type === 'arc') return arcFrame(edge);
  return { radius: edge.radius, startAngle: 0, sweep: TAU };
}

export function edgePointAt(edge, t) {
  if (edge.type === 'line') return [edge.start[0] + (edge.end[0] - edge.start[0]) * t, edge.start[1] + (edge.end[1] - edge.start[1]) * t];
  const frame = edge.frame || frameOf(edge);
  const angle = frame.startAngle + frame.sweep * t;
  return [edge.center[0] + Math.cos(angle) * frame.radius, edge.center[1] + Math.sin(angle) * frame.radius];
}

// Parameter of a point known to lie on the curve (line: 0..1, arc: 0..1 along its sweep,
// circle: 0..1 counter-clockwise from +X).
function parameterOf(edge, point) {
  if (edge.type === 'line') {
    const vector = subtract(edge.end, edge.start);
    const squared = vector[0] ** 2 + vector[1] ** 2;
    return squared ? ((point[0] - edge.start[0]) * vector[0] + (point[1] - edge.start[1]) * vector[1]) / squared : 0;
  }
  const frame = edge.frame;
  let angle = Math.atan2(point[1] - edge.center[1], point[0] - edge.center[0]) - frame.startAngle;
  if (frame.sweep > 0) { while (angle < 0) angle += TAU; while (angle >= TAU) angle -= TAU; } else { while (angle > 0) angle -= TAU; while (angle <= -TAU) angle += TAU; }
  const t = angle / frame.sweep;
  if (edge.type === 'circle') return t % 1;
  // Past the end of an arc, report the nearer side: a point just before the start is
  // slightly negative, not almost a full turn.
  const wrapped = (angle - TAU * Math.sign(frame.sweep)) / frame.sweep;
  return t > 1 && -wrapped < t - 1 ? wrapped : t;
}

function parameterTolerance(edge, tolerance) {
  if (edge.type === 'line') return tolerance / Math.max(edge.frame.length, tolerance);
  return tolerance / Math.max(Math.abs(edge.frame.sweep) * edge.frame.radius, tolerance);
}

function circleOf(edge) {
  return { center: edge.center, radius: edge.frame.radius };
}

function lineLineIntersections(first, second, tolerance) {
  const r = subtract(first.end, first.start);
  const s = subtract(second.end, second.start);
  const denominator = r[0] * s[1] - r[1] * s[0];
  const offset = subtract(second.start, first.start);
  if (Math.abs(denominator) <= tolerance * Math.max(length(r), length(s))) {
    const collinear = Math.abs(offset[0] * r[1] - offset[1] * r[0]) <= tolerance * length(r);
    if (!collinear) return { points: [] };
    const values = [parameterOf(first, second.start), parameterOf(first, second.end)].sort((a, b) => a - b);
    const overlap = Math.min(1, values[1]) - Math.max(0, values[0]);
    if (overlap * first.frame.length > tolerance) return { points: [], overlap: true };
    return { points: [second.start, second.end] };
  }
  const t = (offset[0] * s[1] - offset[1] * s[0]) / denominator;
  return { points: [[first.start[0] + r[0] * t, first.start[1] + r[1] * t]] };
}

function lineCircleIntersections(line, circle, tolerance) {
  const direction = subtract(line.end, line.start);
  const offset = subtract(line.start, circle.center);
  const a = direction[0] ** 2 + direction[1] ** 2;
  const b = 2 * (offset[0] * direction[0] + offset[1] * direction[1]);
  const c = offset[0] ** 2 + offset[1] ** 2 - circle.radius ** 2;
  let discriminant = b * b - 4 * a * c;
  // A line within tolerance of tangent touches the circle once.
  const gap = Math.abs(Math.abs((offset[0] * direction[1] - offset[1] * direction[0]) / Math.sqrt(a)) - circle.radius);
  if (discriminant < 0 && gap <= tolerance) discriminant = 0;
  if (discriminant < 0) return { points: [] };
  const root = Math.sqrt(discriminant);
  const values = discriminant === 0 ? [-b / (2 * a)] : [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  return { points: values.map((t) => [line.start[0] + direction[0] * t, line.start[1] + direction[1] * t]) };
}

function circleCircleIntersections(first, second, tolerance) {
  const between = distance(first.center, second.center);
  if (between <= tolerance) return Math.abs(first.radius - second.radius) <= tolerance ? { points: [], concentric: true } : { points: [] };
  if (between > first.radius + second.radius + tolerance || between < Math.abs(first.radius - second.radius) - tolerance) return { points: [] };
  const along = (first.radius ** 2 - second.radius ** 2 + between ** 2) / (2 * between);
  const height = Math.sqrt(Math.max(0, first.radius ** 2 - along ** 2));
  const unit = [(second.center[0] - first.center[0]) / between, (second.center[1] - first.center[1]) / between];
  const base = [first.center[0] + unit[0] * along, first.center[1] + unit[1] * along];
  if (height <= tolerance) return { points: [base] };
  return { points: [[base[0] - unit[1] * height, base[1] + unit[0] * height], [base[0] + unit[1] * height, base[1] - unit[0] * height]] };
}

function curveOverlap(first, second, tolerance) {
  // Two arcs or circles on the same circle overlap when one's middle lies on the other.
  for (const [a, b] of [[first, second], [second, first]]) {
    const middle = edgePointAt(a, 0.5);
    const t = parameterOf(b, middle);
    const slack = parameterTolerance(b, tolerance);
    if (b.type === 'circle' || (t > slack && t < 1 - slack)) return true;
  }
  return false;
}

function intersections(first, second, tolerance) {
  let result;
  if (first.type === 'line' && second.type === 'line') result = lineLineIntersections(first, second, tolerance);
  else if (first.type === 'line') result = lineCircleIntersections(first, circleOf(second), tolerance);
  else if (second.type === 'line') result = lineCircleIntersections(second, circleOf(first), tolerance);
  else {
    result = circleCircleIntersections(circleOf(first), circleOf(second), tolerance);
    if (result.concentric) return { points: [], overlap: curveOverlap(first, second, tolerance) };
  }
  if (result.overlap) return result;
  const points = result.points.filter((point) => [first, second].every((edge) => {
    if (edge.type === 'circle') return true;
    const t = parameterOf(edge, point);
    const slack = parameterTolerance(edge, tolerance);
    return t >= -slack && t <= 1 + slack;
  }));
  return { points };
}

function sampleCount(edge, t0, t1) {
  if (edge.type === 'line') return 1;
  return Math.max(4, Math.ceil(Math.abs((t1 - t0) * edge.frame.sweep) / (Math.PI / 48)));
}

function signedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    area += point[0] * next[1] - next[0] * point[1];
  }
  return area / 2;
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const prior = polygon[previous];
    if ((current[1] > point[1]) !== (prior[1] > point[1])
      && point[0] < ((prior[0] - current[0]) * (point[1] - current[1])) / ((prior[1] - current[1]) || Number.EPSILON) + current[0]) inside = !inside;
  }
  return inside;
}

// edges: { id, type: 'line'|'arc'|'circle', start, end, center, direction, radius }.
// Returns regions [{ outer: loop, holes: [loop] }] where a loop is
// { steps: [{ edge, reversed, range: [t0, t1] | null }], points }, plus open ends and overlaps.
export function arrangeSketchRegions(inputEdges, tolerance = 1e-6) {
  const edges = inputEdges.map((edge) => ({ ...edge, frame: frameOf(edge) }));
  const splits = edges.map((edge) => (edge.type === 'circle' ? [] : [0, 1]));
  const overlaps = [];
  for (let first = 0; first < edges.length; first += 1) {
    for (let second = first + 1; second < edges.length; second += 1) {
      const result = intersections(edges[first], edges[second], tolerance);
      if (result.overlap) {
        overlaps.push([edges[first].id, edges[second].id]);
        continue;
      }
      for (const point of result.points) {
        splits[first].push(parameterOf(edges[first], point));
        splits[second].push(parameterOf(edges[second], point));
      }
    }
  }

  const nodes = [];
  const nodeAt = (point) => {
    let node = nodes.find((candidate) => distance(candidate.point, point) <= tolerance * 10);
    if (!node) {
      node = { id: nodes.length, point, outgoing: [] };
      nodes.push(node);
    }
    return node.id;
  };

  let pieces = [];
  edges.forEach((edge, index) => {
    const slack = parameterTolerance(edge, tolerance);
    const values = splits[index]
      .map((value) => (edge.type === 'circle' ? ((value % 1) + 1) % 1 : Math.min(1, Math.max(0, value))))
      .sort((a, b) => a - b)
      .filter((value, at, all) => at === 0 || value - all[at - 1] > slack);
    if (edge.type === 'circle') {
      if (values.length > 1 && 1 - values.at(-1) + values[0] <= slack) values.pop();
      const stops = values.length ? values : [0];
      stops.forEach((t0, at) => {
        const t1 = at + 1 < stops.length ? stops[at + 1] : stops[0] + 1;
        pieces.push({ edge, t0, t1 });
      });
    } else {
      for (let at = 0; at + 1 < values.length; at += 1) pieces.push({ edge, t0: values[at], t1: values[at + 1] });
    }
  });
  pieces = pieces.map((piece) => ({ ...piece, a: nodeAt(edgePointAt(piece.edge, piece.t0)), b: nodeAt(edgePointAt(piece.edge, piece.t1)) }))
    .filter((piece) => piece.a !== piece.b || piece.edge.type === 'circle');

  // Open ends are reported, then dangling chains are dropped so they cannot block a face.
  const degree = new Map();
  const bump = (id, delta) => degree.set(id, (degree.get(id) || 0) + delta);
  pieces.forEach((piece) => { bump(piece.a, 1); bump(piece.b, 1); });
  const openEnds = nodes.filter((node) => degree.get(node.id) === 1).map((node) => ({ point: node.point, entityIds: pieces.filter((piece) => piece.a === node.id || piece.b === node.id).map((piece) => piece.edge.id) }));
  let alive = pieces;
  for (;;) {
    const dangling = alive.filter((piece) => piece.a !== piece.b && (degree.get(piece.a) === 1 || degree.get(piece.b) === 1));
    if (!dangling.length) break;
    dangling.forEach((piece) => { bump(piece.a, -1); bump(piece.b, -1); });
    alive = alive.filter((piece) => !dangling.includes(piece));
  }

  const halfEdges = [];
  alive.forEach((piece, index) => {
    const span = piece.t1 - piece.t0;
    const step = 0.01 * span;
    const forward = subtract(edgePointAt(piece.edge, piece.t0 + step), edgePointAt(piece.edge, piece.t0));
    const backward = subtract(edgePointAt(piece.edge, piece.t1 - step), edgePointAt(piece.edge, piece.t1));
    halfEdges.push({ id: index * 2, piece, from: piece.a, to: piece.b, reversed: false, angle: Math.atan2(forward[1], forward[0]) });
    halfEdges.push({ id: index * 2 + 1, piece, from: piece.b, to: piece.a, reversed: true, angle: Math.atan2(backward[1], backward[0]) });
  });
  halfEdges.forEach((half) => nodes[half.from].outgoing.push(half));
  nodes.forEach((node) => node.outgoing.sort((first, second) => first.angle - second.angle));

  // Walk each face: from the twin at the arrival node take the next edge clockwise,
  // which keeps the face on the left, so bounded faces come out counter-clockwise.
  const visited = new Set();
  const faces = [];
  for (const start of halfEdges) {
    if (visited.has(start.id)) continue;
    const loop = [];
    let current = start;
    let guard = 0;
    while (current && !visited.has(current.id) && guard < halfEdges.length + 1) {
      visited.add(current.id);
      loop.push(current);
      const twin = halfEdges[current.id ^ 1];
      const around = nodes[current.to].outgoing;
      const index = around.indexOf(twin);
      current = around[(index - 1 + around.length) % around.length];
      guard += 1;
    }
    const points = [];
    for (const half of loop) {
      const { edge, t0, t1 } = half.piece;
      const count = sampleCount(edge, t0, t1);
      const samples = Array.from({ length: count + 1 }, (_, at) => edgePointAt(edge, t0 + ((t1 - t0) * at) / count));
      if (half.reversed) samples.reverse();
      points.push(...(points.length ? samples.slice(1) : samples));
    }
    if (points.length > 2 && distance(points[0], points.at(-1)) <= tolerance * 10) points.pop();
    faces.push({ halves: loop, points, area: signedArea(points) });
  }

  const component = nodes.map((node) => node.id);
  const root = (id) => (component[id] === id ? id : (component[id] = root(component[id])));
  alive.forEach((piece) => { component[root(piece.a)] = root(piece.b); });
  const minimumArea = tolerance * tolerance * 100;
  const toLoop = (face) => ({
    steps: face.halves.map((half) => {
      const { edge, t0, t1 } = half.piece;
      const full = edge.type === 'circle' ? t1 - t0 >= 1 - 1e-12 : t0 <= 1e-12 && t1 >= 1 - 1e-12;
      return { edge: inputEdges[edges.indexOf(edge)], reversed: half.reversed, range: full ? null : [t0, t1] };
    }),
    points: face.points,
  });
  const regions = faces.filter((face) => face.area > minimumArea).map((face) => ({
    face, component: root(face.halves[0].from), area: face.area, outer: toLoop(face), holes: [],
  }));
  const outerFaces = faces.filter((face) => face.area < -minimumArea);
  for (const outer of outerFaces) {
    const owner = root(outer.halves[0].from);
    const probe = outer.points[0];
    const container = regions
      .filter((region) => region.component !== owner && pointInPolygon(probe, region.face.points))
      .sort((first, second) => first.area - second.area)[0];
    if (container) container.holes.push(toLoop(outer));
  }
  return {
    regions: regions.map(({ outer, holes, area }) => ({ outer, holes, area })),
    openEnds,
    overlaps,
  };
}

// Applies a stored [t0, t1] range to a resolved full segment (evaluator side).
export function trimResolvedSegment(segment, range) {
  if (!range) return segment;
  const [t0, t1] = range;
  if (segment.type === 'line') {
    const at = (t) => [segment.start[0] + (segment.end[0] - segment.start[0]) * t, segment.start[1] + (segment.end[1] - segment.start[1]) * t];
    return { ...segment, start: at(t0), end: at(t1) };
  }
  if (segment.type === 'arc') {
    const edge = { type: 'arc', center: segment.center, start: segment.start, end: segment.end, direction: segment.direction };
    edge.frame = frameOf(edge);
    return { ...segment, start: edgePointAt(edge, t0), end: edgePointAt(edge, t1) };
  }
  if (segment.type === 'circle') {
    const edge = { type: 'circle', center: segment.center, radius: segment.radius, frame: { radius: segment.radius, startAngle: 0, sweep: TAU } };
    return { type: 'arc', id: segment.id, center: segment.center, start: edgePointAt(edge, t0), end: edgePointAt(edge, t1), direction: 'ccw' };
  }
  throw new Error('Fragment profilu może pochodzić tylko z linii, łuku albo okręgu.');
}
