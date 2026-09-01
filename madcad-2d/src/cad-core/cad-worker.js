import opencascade from 'replicad-opencascadejs';
import opencascadeWasm from 'replicad-opencascadejs/src/replicad_single.wasm?url';
import manifoldModule from 'manifold-3d';
import manifoldWasm from 'manifold-3d/manifold.wasm?url';
import {
  addHolesInFace,
  Curve2D,
  FaceFinder,
  Plane,
  Vector,
  cast,
  compoundShapes,
  drawCircle,
  drawEllipse,
  draw,
  drawRectangle,
  getOC,
  importSTEP,
  importSTLAsMesh,
  makeAx1,
  makeAx2,
  makeBox,
  makeCylinder,
  makeOffset,
  makePolygon,
  makeSolid,
  makeSphere,
  sketchHelix,
  measureShapeSurfaceProperties,
  measureShapeVolumeProperties,
  setOC,
  setManifold,
} from 'replicad';
import { FEATURE_STATUS, prepareDocument } from './evaluator.js';
import { evaluateFeatureHistory } from './feature-history.js';
import { GEOMETRY_POLICY } from './geometry-policy.js';
import { resolveFaceEdgeHolePlacement } from './face-edge-hole.js';
import { assignStableTopologyIds } from './topology-naming.js';
import { RevisionCache, SerialTaskQueue, estimateMeshBytes, isStaleRevision } from './worker-runtime.js';
import { calculatePrintLayout, normalizePrintLayout } from './print-layout.js';
import { createThreeMfArchive } from './three-mf.js';
import { boundsOverlap } from './geometry-inspection.js';
import { parseStlMesh } from './model-import.js';
import { inspectMesh } from './mesh-tools.js';

let kernelPromise;
let manifoldPromise;
let latestRequestedRevision = 0;
const requestQueue = new SerialTaskQueue();
const revisionCache = new RevisionCache({
  maxEntries: GEOMETRY_POLICY.cache.maxRevisions,
  maxBytes: GEOMETRY_POLICY.cache.maxMeshBytes,
  onEvict: (entry) => {
    for (const body of entry?.kernelBodies || []) body.shape?.delete?.();
  },
});
const topologyHistory = new Map();

async function ensureKernel() {
  if (!kernelPromise) {
    kernelPromise = opencascade({ locateFile: () => opencascadeWasm }).then((oc) => {
      setOC(oc);
      return oc;
    });
  }
  return kernelPromise;
}

async function ensureMeshKernel() {
  await ensureKernel();
  if (!manifoldPromise) {
    manifoldPromise = manifoldModule({ locateFile: () => manifoldWasm }).then((manifold) => {
      setManifold(manifold);
      return manifold;
    });
  }
  return manifoldPromise;
}

function rawMeshMetrics(vertices, triangles) {
  const bounds = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  const normals = new Array(vertices.length).fill(0);
  const weightedCenter = [0, 0, 0];
  let signedVolume = 0;
  let area = 0;
  for (let index = 0; index < vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      bounds[0][axis] = Math.min(bounds[0][axis], vertices[index + axis]);
      bounds[1][axis] = Math.max(bounds[1][axis], vertices[index + axis]);
    }
  }
  for (let index = 0; index < triangles.length; index += 3) {
    const first = triangles[index] * 3;
    const second = triangles[index + 1] * 3;
    const third = triangles[index + 2] * 3;
    const ax = vertices[first]; const ay = vertices[first + 1]; const az = vertices[first + 2];
    const bx = vertices[second]; const by = vertices[second + 1]; const bz = vertices[second + 2];
    const cx = vertices[third]; const cy = vertices[third + 1]; const cz = vertices[third + 2];
    const ab = [bx - ax, by - ay, bz - az];
    const ac = [cx - ax, cy - ay, cz - az];
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const crossLength = Math.hypot(...cross);
    area += crossLength / 2;
    const normal = crossLength > 0 ? cross.map((value) => value / crossLength) : [0, 0, 1];
    for (const offset of [first, second, third]) {
      normals[offset] = normal[0];
      normals[offset + 1] = normal[1];
      normals[offset + 2] = normal[2];
    }
    const tetrahedronVolume = (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    signedVolume += tetrahedronVolume;
    weightedCenter[0] += tetrahedronVolume * (ax + bx + cx) / 4;
    weightedCenter[1] += tetrahedronVolume * (ay + by + cy) / 4;
    weightedCenter[2] += tetrahedronVolume * (az + bz + cz) / 4;
  }
  const centerOfMass = Math.abs(signedVolume) > GEOMETRY_POLICY.linearTolerance ** 3
    ? weightedCenter.map((value) => value / signedVolume)
    : bounds[0].map((value, axis) => (value + bounds[1][axis]) / 2);
  return { area, bounds, centerOfMass, normals, volume: Math.abs(signedVolume) };
}

class RawMeshShape {
  constructor(vertices, triangles) {
    this.vertices = Array.from(vertices);
    this.triangles = Array.from(triangles);
    this.metrics = rawMeshMetrics(this.vertices, this.triangles);
  }

  clone() { return new RawMeshShape(this.vertices, this.triangles); }

  mapVertices(transform) {
    const vertices = this.vertices.slice();
    for (let index = 0; index < vertices.length; index += 3) {
      const point = transform([vertices[index], vertices[index + 1], vertices[index + 2]]);
      vertices[index] = point[0];
      vertices[index + 1] = point[1];
      vertices[index + 2] = point[2];
    }
    return new RawMeshShape(vertices, this.triangles);
  }

  translate(x, y = 0, z = 0) {
    const vector = Array.isArray(x) ? x : [x, y, z];
    return this.mapVertices((point) => point.map((value, axis) => value + vector[axis]));
  }

  scale(factor, center = [0, 0, 0]) {
    return this.mapVertices((point) => point.map((value, axis) => center[axis] + (value - center[axis]) * factor));
  }

  rotate(angle, position = [0, 0, 0], direction = [0, 0, 1]) {
    const radians = angle * Math.PI / 180;
    const length = Math.hypot(...direction) || 1;
    const axis = direction.map((value) => value / length);
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return this.mapVertices((point) => {
      const vector = point.map((value, index) => value - position[index]);
      const dot = vector.reduce((total, value, index) => total + value * axis[index], 0);
      const cross = [axis[1] * vector[2] - axis[2] * vector[1], axis[2] * vector[0] - axis[0] * vector[2], axis[0] * vector[1] - axis[1] * vector[0]];
      return vector.map((value, index) => position[index] + value * cosine + cross[index] * sine + axis[index] * dot * (1 - cosine));
    });
  }

  mesh() { return { vertices: this.vertices, triangles: this.triangles, normals: this.metrics.normals }; }
  volume() { return this.metrics.volume; }
  surfaceArea() { return this.metrics.area; }
  numTri() { return this.triangles.length / 3; }
  numVert() { return this.vertices.length / 3; }
  numEdge() { return this.triangles.length; }
  get isEmpty() { return !this.triangles.length; }
  fuse() { throw new Error('Otwarta siatka STL/3MF nie obsługuje operacji Boolean.'); }
  cut() { throw new Error('Otwarta siatka STL/3MF nie obsługuje operacji Boolean.'); }
  intersect() { throw new Error('Otwarta siatka STL/3MF nie obsługuje operacji Boolean.'); }
  delete() {}

  blobSTL() {
    const buffer = new ArrayBuffer(84 + this.numTri() * 50);
    const view = new DataView(buffer);
    view.setUint32(80, this.numTri(), true);
    for (let triangle = 0; triangle < this.numTri(); triangle += 1) {
      const output = 84 + triangle * 50;
      const vertexIndices = this.triangles.slice(triangle * 3, triangle * 3 + 3);
      const normalOffset = vertexIndices[0] * 3;
      for (let axis = 0; axis < 3; axis += 1) view.setFloat32(output + axis * 4, this.metrics.normals[normalOffset + axis], true);
      vertexIndices.forEach((vertexIndex, pointIndex) => {
        for (let axis = 0; axis < 3; axis += 1) view.setFloat32(output + 12 + pointIndex * 12 + axis * 4, this.vertices[vertexIndex * 3 + axis], true);
      });
    }
    return new Blob([buffer], { type: 'model/stl' });
  }
}

function rationalConicCurve(segment) {
  const oc = getOC();
  const poles = new oc.TColgp_Array1OfPnt2d_2(1, 3);
  const weights = new oc.TColStd_Array1OfReal_2(1, 3);
  const points = [segment.start, segment.control, segment.end].map(([x, y]) => new oc.gp_Pnt2d_3(x, y));
  points.forEach((point, index) => poles.SetValue(index + 1, point));
  weights.SetValue(1, 1);
  weights.SetValue(2, segment.rho);
  weights.SetValue(3, 1);
  const bezier = new oc.Geom2d_BezierCurve_2(poles, weights);
  const curve = new Curve2D(new oc.Handle_Geom2d_Curve_2(bezier));
  points.forEach((point) => point.delete());
  poles.delete();
  weights.delete();
  return curve;
}

function drawingForSegments(segments, profileId) {
  const [first, ...rest] = segments;
  if (!first) throw new Error(`Profil ${profileId} nie zawiera segmentów.`);
  if (first.type === 'circle' && !rest.length) return drawCircle(first.radius).translate(...first.center);
  if (first.type === 'ellipse' && !rest.length) return drawEllipse(first.majorRadius, first.minorRadius).rotate(first.rotation).translate(...first.center);
  const arcMidpoint = (segment) => {
    let startAngle = Math.atan2(segment.start[1] - segment.center[1], segment.start[0] - segment.center[0]);
    let endAngle = Math.atan2(segment.end[1] - segment.center[1], segment.end[0] - segment.center[0]);
    if (segment.direction === 'cw' && endAngle >= startAngle) endAngle -= Math.PI * 2;
    if (segment.direction !== 'cw' && endAngle <= startAngle) endAngle += Math.PI * 2;
    const radius = Math.hypot(segment.start[0] - segment.center[0], segment.start[1] - segment.center[1]);
    const angle = (startAngle + endAngle) / 2;
    return [segment.center[0] + Math.cos(angle) * radius, segment.center[1] + Math.sin(angle) * radius];
  };
  const pen = draw(first.start);
  for (const segment of [first, ...rest]) {
    if (segment.type === 'arc') pen.threePointsArcTo(segment.end, arcMidpoint(segment));
    else if (segment.type === 'ellipticalArc') pen.ellipseTo(segment.end, segment.majorRadius, segment.minorRadius, segment.rotation, segment.longAxis, segment.sweep);
    else if (segment.type === 'spline') segment.beziers.forEach((bezier) => pen.bezierCurveTo(bezier.end, bezier.controls));
    else if (segment.type === 'conic') {
      pen.pendingCurves.push(rationalConicCurve(segment));
      pen.pointer = segment.end;
    }
    else pen.lineTo(segment.end);
  }
  return pen.done();
}

function drawingForProfile(profile) {
  const { geometry } = profile;
  if (profile.type === 'rectangle') {
    return drawRectangle(geometry.width, geometry.height).translate(geometry.x, geometry.y);
  }
  if (profile.type === 'circle') {
    return drawCircle(geometry.diameter / 2).translate(geometry.x, geometry.y);
  }
  if (profile.type === 'closed') {
    return drawingForSegments(geometry.segments, profile.id);
  }
  throw new Error(`Nieobsługiwany profil: ${profile.type}`);
}

const PROFILE_PLANE_NORMALS = { XY: [0, 0, 1], XZ: [0, -1, 0], YZ: [1, 0, 0] };

function vectorSubtract(left, right) {
  return left.map((value, index) => value - right[index]);
}

function vectorAdd(left, right) {
  return left.map((value, index) => value + right[index]);
}

function vectorScale(vector, scale) {
  return vector.map((value) => value * scale);
}

function vectorDot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function vectorCross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function vectorNormalized(vector) {
  const length = Math.hypot(...vector);
  if (length <= GEOMETRY_POLICY.linearTolerance) throw new Error('Nie można wyznaczyć kierunku z zerowego wektora.');
  return vectorScale(vector, 1 / length);
}

function sheetProfileCenter(sheetMetal) {
  const profile = sheetMetal.baseProfile;
  const x = Number(profile?.geometry?.x || 0);
  const y = Number(profile?.geometry?.y || 0);
  const offset = Number(sheetMetal.midPlaneOffset ?? profile?.planeOffset ?? 0);
  if (profile?.plane === 'XZ') return [x, -offset, y];
  if (profile?.plane === 'YZ') return [offset, x, y];
  return [x, y, offset];
}

function planarPatchForProfile(profile) {
  const plane = profile.plane || 'XY';
  const planeOffset = Number(profile.planeOffset || 0);
  const outerSketch = drawingForProfile(profile).sketchOnPlane(plane, planeOffset);
  const face = outerSketch.face();
  const holeWires = (profile.geometry.holes || []).map((hole) => {
    const sketch = drawingForSegments(hole.segments, profile.id).sketchOnPlane(plane, planeOffset);
    const wire = sketch.wire.clone();
    sketch.delete();
    return wire;
  });
  if (!holeWires.length) return face;
  const patchedFace = addHolesInFace(face, holeWires);
  face.delete();
  holeWires.forEach((wire) => wire.delete());
  return patchedFace;
}

function prismWireSurface(drawing, plane, planeOffset, distance) {
  const sketch = drawing.sketchOnPlane(plane, planeOffset);
  const wire = sketch.wire.clone();
  const vector = new Vector(PROFILE_PLANE_NORMALS[plane].map((value) => value * distance));
  const builder = new (getOC().BRepPrimAPI_MakePrism_1)(wire.wrapped, vector.wrapped, true, true);
  const shape = cast(builder.Shape());
  builder.delete();
  vector.delete();
  wire.delete();
  sketch.delete();
  return shape;
}

function extrudedSurfaceForProfile(profile, distance) {
  const plane = profile.plane || 'XY';
  const planeOffset = Number(profile.planeOffset || 0);
  if (profile.type === 'open') return prismWireSurface(drawingForSegments(profile.geometry.segments, profile.id), plane, planeOffset, distance);
  const surfaces = [prismWireSurface(drawingForProfile(profile), plane, planeOffset, distance)];
  for (const hole of profile.geometry.holes || []) surfaces.push(prismWireSurface(drawingForSegments(hole.segments, profile.id), plane, planeOffset, distance));
  return surfaces.length === 1 ? surfaces[0] : compoundShapes(surfaces);
}

function revolveWireSurface(drawing, plane, planeOffset, axis, angle) {
  const sketch = drawing.sketchOnPlane(plane, planeOffset);
  const wire = sketch.wire.clone();
  const revolutionAxis = makeAx1(axis.origin, axis.direction);
  const builder = new (getOC().BRepPrimAPI_MakeRevol_1)(wire.wrapped, revolutionAxis, angle * Math.PI / 180, true);
  const shape = cast(builder.Shape());
  builder.delete();
  revolutionAxis.delete();
  wire.delete();
  sketch.delete();
  return shape;
}

function revolvedSurfaceForProfile(profile, axis, angle) {
  const plane = profile.plane || 'XY';
  const planeOffset = Number(profile.planeOffset || 0);
  if (profile.type === 'open') return revolveWireSurface(drawingForSegments(profile.geometry.segments, profile.id), plane, planeOffset, axis, angle);
  const surfaces = [revolveWireSurface(drawingForProfile(profile), plane, planeOffset, axis, angle)];
  for (const hole of profile.geometry.holes || []) surfaces.push(revolveWireSurface(drawingForSegments(hole.segments, profile.id), plane, planeOffset, axis, angle));
  return surfaces.length === 1 ? surfaces[0] : compoundShapes(surfaces);
}

function prismShape(shape, direction, distance, startOffset = 0) {
  const moved = Math.abs(startOffset) > GEOMETRY_POLICY.linearTolerance
    ? shape.clone().translate(direction.map((value) => value * startOffset))
    : shape;
  const vector = new Vector(direction.map((value) => value * distance));
  const builder = new (getOC().BRepPrimAPI_MakePrism_1)(moved.wrapped, vector.wrapped, true, true);
  const result = cast(builder.Shape());
  builder.delete();
  vector.delete();
  if (moved !== shape) moved.delete();
  return result;
}

function thickenGenericSurface(shape, feature) {
  const symmetric = feature.side === 'symmetric';
  const offsetDirection = feature.reverse ? -1 : 1;
  const base = symmetric ? makeOffset(shape, -feature.thicknessValue / 2) : shape;
  const builder = new (getOC().BRepOffsetAPI_MakeThickSolid)();
  try {
    builder.MakeThickSolidBySimple(base.wrapped, feature.thicknessValue * (symmetric ? 1 : offsetDirection));
    const result = cast(builder.Shape());
    if (measureShapeVolumeProperties(result).volume < 0) result.wrapped.Reverse();
    const faces = result.faces;
    const hasFaces = faces.length > 0;
    faces.forEach((face) => face.delete());
    if (!hasFaces) {
      result.delete();
      throw new Error('Nie udało się utworzyć ścian pogrubienia.');
    }
    return result;
  } finally {
    builder.delete();
    if (base !== shape) base.delete();
  }
}

function thickenSurfaceBody(target, feature) {
  if (target.surfaceSourceType === 'patch') {
    const direction = PROFILE_PLANE_NORMALS[target.surfaceProfile.plane || 'XY'];
    const distance = feature.thicknessValue * (feature.reverse ? -1 : 1);
    return prismShape(target.shape, direction, distance, feature.side === 'symmetric' ? -distance / 2 : 0);
  }
  if (target.surfaceSourceType === 'extrude') {
    const wallSide = feature.side === 'symmetric' ? 'symmetric' : (feature.reverse ? 'inside' : 'outside');
    const drawing = target.surfaceProfile.type === 'open'
      ? openChainStrip(target.surfaceProfile, { wallThicknessValue: feature.thicknessValue, wallSide, endCap: 'butt', surfaceOffset: target.surfaceOffsetDistance })
      : thinDrawingForProfile(target.surfaceProfile, { wallThicknessValue: feature.thicknessValue, wallSide, surfaceOffset: target.surfaceOffsetDistance });
    let shape = drawing.sketchOnPlane(target.surfaceProfile.plane || 'XY', Number(target.surfaceProfile.planeOffset || 0)).extrude(target.surfaceDistance);
    for (const transform of target.surfaceTransforms || []) {
      shape = transform.mode === 'move'
        ? shape.translate(...transform.translation)
        : shape.rotate(transform.angle, transform.origin, [0, 0, 1]);
    }
    return shape;
  }
  if (target.surfaceSourceType === 'revolve') {
    const wallSide = feature.side === 'symmetric' ? 'symmetric' : (feature.reverse ? 'inside' : 'outside');
    const drawing = target.surfaceProfile.type === 'open'
      ? openChainStrip(target.surfaceProfile, { wallThicknessValue: feature.thicknessValue, wallSide, endCap: 'butt', surfaceOffset: target.surfaceOffsetDistance })
      : thinDrawingForProfile(target.surfaceProfile, { wallThicknessValue: feature.thicknessValue, wallSide, surfaceOffset: target.surfaceOffsetDistance });
    let shape = drawing.sketchOnPlane(target.surfaceProfile.plane || 'XY', Number(target.surfaceProfile.planeOffset || 0)).revolve(target.surfaceAxis.direction, { origin: target.surfaceAxis.origin, angle: target.surfaceAngle });
    for (const transform of target.surfaceTransforms || []) {
      shape = transform.mode === 'move'
        ? shape.translate(...transform.translation)
        : shape.rotate(transform.angle, transform.origin, [0, 0, 1]);
    }
    return shape;
  }
  if (target.surfaceSourceType === 'sweep') {
    const wallSide = feature.side === 'symmetric' ? 'symmetric' : (feature.reverse ? 'inside' : 'outside');
    const drawing = target.surfaceProfile.type === 'open'
      ? openChainStrip(target.surfaceProfile, { wallThicknessValue: feature.thicknessValue, wallSide, endCap: 'butt', surfaceOffset: target.surfaceOffsetDistance })
      : thinDrawingForProfile(target.surfaceProfile, { wallThicknessValue: feature.thicknessValue, wallSide, surfaceOffset: target.surfaceOffsetDistance });
    let shape = sweepDrawing(drawing, target.surfacePath);
    for (const transform of target.surfaceTransforms || []) {
      shape = transform.mode === 'move'
        ? shape.translate(...transform.translation)
        : shape.rotate(transform.angle, transform.origin, [0, 0, 1]);
    }
    return shape;
  }
  if (target.surfaceSourceType === 'loft') {
    const wallSide = feature.side === 'symmetric' ? 'symmetric' : (feature.reverse ? 'inside' : 'outside');
    let shape = thickenLoftProfiles(target.surfaceProfiles, target.surfaceLoftMode, feature.thicknessValue, wallSide, target.surfaceOffsetDistance);
    for (const transform of target.surfaceTransforms || []) {
      shape = transform.mode === 'move'
        ? shape.translate(...transform.translation)
        : shape.rotate(transform.angle, transform.origin, [0, 0, 1]);
    }
    return shape;
  }
  return thickenGenericSurface(target.shape, feature);
}

const THROUGH_ALL_DISTANCE = 1_000_000;

function matchingTranslatedPlanarFaceIndex(reference, descriptors, sourceNormal) {
  const expected = reference?.descriptor;
  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  descriptors.forEach((descriptor, index) => {
    if (expected?.geometry !== 'PLANE' || descriptor?.geometry !== 'PLANE' || !expected.center || !descriptor.center || !expected.normal || !descriptor.normal) return;
    const normalDistance = descriptorPointDistance(expected.normal, descriptor.normal);
    const delta = descriptor.center.map((value, axis) => value - expected.center[axis]);
    const axial = delta.reduce((sum, value, axis) => sum + value * sourceNormal[axis], 0);
    const lateralDistance = Math.hypot(...delta.map((value, axis) => value - axial * sourceNormal[axis]));
    const areaScale = Math.max(Math.abs(Number(expected.area || 0)), Math.abs(Number(descriptor.area || 0)), 1);
    const areaDifference = Math.abs(Number(expected.area || 0) - Number(descriptor.area || 0)) / areaScale;
    const score = lateralDistance + normalDistance + areaDifference + (Math.abs(axial) * 1e-9);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  if (bestIndex < 0 || bestScore > 1e-4) throw new Error(`Nie odnaleziono planarnej ściany docelowej „${reference?.label || reference?.topologyId}”.`);
  return bestIndex;
}

function extrusionSpan(feature, bodyMap) {
  const startOffset = Number(feature.startOffsetValue || 0);
  if (feature.extent === 'to-object' && feature.targetObjectReference?.kind === 'topology') {
    const reference = feature.targetObjectReference;
    const target = bodyMap.get(reference.bodyId);
    if (!target) throw new Error('Docelowa ściana wyciągnięcia musi należeć do wcześniejszej bryły.');
    const faces = target.shape.faces;
    try {
      const sourceNormal = { XY: [0, 0, 1], XZ: [0, -1, 0], YZ: [1, 0, 0] }[feature.profiles[0]?.plane || 'XY'];
      const descriptors = faces.map((face) => faceDescriptor(face));
      const descriptor = descriptors[matchingTranslatedPlanarFaceIndex(reference, descriptors, sourceNormal)];
      const parallel = Math.abs(sourceNormal.reduce((sum, value, index) => sum + value * descriptor.normal[index], 0));
      if (Math.abs(1 - parallel) > GEOMETRY_POLICY.angularTolerance) throw new Error('Docelowa ściana wyciągnięcia musi być równoległa do płaszczyzny szkicu.');
      const targetCoordinate = descriptor.center.reduce((sum, value, index) => sum + value * sourceNormal[index], 0);
      const sourceCoordinate = Number(feature.profiles[0]?.planeOffset || 0) + startOffset;
      const distance = targetCoordinate - sourceCoordinate;
      if (!(distance > GEOMETRY_POLICY.linearTolerance)) throw new Error('Obiekt docelowy musi leżeć przed początkiem wyciągnięcia.');
      return { startDelta: startOffset, distance };
    } finally {
      faces.forEach((face) => face.delete());
    }
  }
  if (feature.extent === 'two-sides') return { startDelta: startOffset - feature.secondDistanceValue, distance: feature.distanceValue + feature.secondDistanceValue };
  if (feature.extent === 'symmetric') return { startDelta: startOffset - feature.distanceValue / 2, distance: feature.distanceValue };
  if (feature.extent === 'through-all') return { startDelta: startOffset - THROUGH_ALL_DISTANCE / 2, distance: THROUGH_ALL_DISTANCE };
  return { startDelta: startOffset, distance: feature.distanceValue };
}

function openChainStrip(profile, feature) {
  const points = profile.geometry.points;
  const directions = points.slice(0, -1).map((point, index) => {
    const delta = [points[index + 1][0] - point[0], points[index + 1][1] - point[1]];
    const length = Math.hypot(...delta);
    if (length <= GEOMETRY_POLICY.linearTolerance) throw new Error('Otwarty Thin Extrude zawiera odcinek o zerowej długości.');
    return delta.map((value) => value / length);
  });
  const normals = directions.map(([x, y]) => [-y, x]);
  const offsetPolyline = (distance) => points.map((point, index) => {
    if (index === 0) return point.map((value, axis) => value + normals[0][axis] * distance);
    if (index === points.length - 1) return point.map((value, axis) => value + normals.at(-1)[axis] * distance);
    const firstOrigin = point.map((value, axis) => value + normals[index - 1][axis] * distance);
    const secondOrigin = point.map((value, axis) => value + normals[index][axis] * distance);
    const firstDirection = directions[index - 1];
    const secondDirection = directions[index];
    const determinant = (firstDirection[0] * secondDirection[1]) - (firstDirection[1] * secondDirection[0]);
    if (Math.abs(determinant) <= GEOMETRY_POLICY.angularTolerance) return firstOrigin.map((value, axis) => (value + secondOrigin[axis]) / 2);
    const delta = [secondOrigin[0] - firstOrigin[0], secondOrigin[1] - firstOrigin[1]];
    const alongFirst = ((delta[0] * secondDirection[1]) - (delta[1] * secondDirection[0])) / determinant;
    return firstOrigin.map((value, axis) => value + firstDirection[axis] * alongFirst);
  });
  const thickness = feature.wallThicknessValue;
  const baseOffset = Number(feature.surfaceOffset || 0);
  const [leftDistance, rightDistance] = feature.wallSide === 'outside'
    ? [baseOffset + thickness, baseOffset]
    : feature.wallSide === 'inside'
      ? [baseOffset, baseOffset - thickness]
      : [baseOffset + thickness / 2, baseOffset - thickness / 2];
  const left = offsetPolyline(leftDistance);
  const right = offsetPolyline(rightDistance);
  if (feature.endCap === 'square') {
    const extension = thickness / 2;
    for (const polyline of [left, right]) {
      polyline[0] = polyline[0].map((value, axis) => value - directions[0][axis] * extension);
      polyline[polyline.length - 1] = polyline.at(-1).map((value, axis) => value + directions.at(-1)[axis] * extension);
    }
  }
  const polygon = [...left, ...right.reverse()];
  const pen = draw(polygon[0]);
  polygon.slice(1).forEach((point) => pen.lineTo(point));
  return pen.close();
}

function thinDrawingForProfile(profile, feature) {
  if (profile.type === 'open') return openChainStrip(profile, feature);
  const baseDrawing = drawingForProfile(profile);
  const drawing = feature.surfaceOffset ? baseDrawing.offset(feature.surfaceOffset, { lineJoinType: 'miter' }) : baseDrawing;
  const thickness = feature.wallThicknessValue;
  const offset = (distance) => drawing.offset(distance, { lineJoinType: 'miter' });
  if (feature.wallSide === 'outside') return offset(thickness).cut(drawing);
  if (feature.wallSide === 'inside') return drawing.cut(offset(-thickness));
  return offset(thickness / 2).cut(offset(-thickness / 2));
}

function extrudeProfile(profile, span, feature) {
  const plane = profile.plane || 'XY';
  const planeOffset = Number(profile.planeOffset || 0) + span.startDelta;
  let shape = (feature.thin ? thinDrawingForProfile(profile, feature) : drawingForProfile(profile)).sketchOnPlane(plane, planeOffset).extrude(span.distance);
  for (const hole of profile.geometry.holes || []) {
    const cutter = drawingForSegments(hole.segments, profile.id).sketchOnPlane(plane, planeOffset).extrude(span.distance);
    shape = shape.cut(cutter);
  }
  return shape;
}

function revolveProfile(profile, axis, angle) {
  const plane = profile.plane || 'XY';
  const planeOffset = Number(profile.planeOffset || 0);
  let shape = drawingForProfile(profile).sketchOnPlane(plane, planeOffset).revolve(axis.direction, { origin: axis.origin, angle });
  for (const hole of profile.geometry.holes || []) {
    const cutter = drawingForSegments(hole.segments, profile.id).sketchOnPlane(plane, planeOffset).revolve(axis.direction, { origin: axis.origin, angle });
    shape = shape.cut(cutter);
  }
  return shape;
}

function sweepDrawing(profileDrawing, path) {
  const [first, ...rest] = path.geometry.points;
  const spinePen = draw(first);
  rest.forEach((point) => spinePen.lineTo(point));
  const spine = spinePen.done().sketchOnPlane(path.plane || 'XY', Number(path.planeOffset || 0));
  return spine.sweepSketch((plane) => profileDrawing.sketchOnPlane(plane), { transitionMode: 'round' });
}

function surfaceSweepDrawing(profileDrawing, path) {
  const [first, ...rest] = path.geometry.points;
  const spinePen = draw(first);
  rest.forEach((point) => spinePen.lineTo(point));
  const spine = spinePen.done().sketchOnPlane(path.plane || 'XY', Number(path.planeOffset || 0));
  const startPoint = spine.wire.startPoint;
  const tangent = spine.wire.tangentAt(1e-9);
  const normal = tangent.multiply(-1).normalize();
  const defaultDirection = spine.defaultDirection;
  const crossDirection = normal.cross(defaultDirection);
  const xDir = crossDirection.multiply(-1);
  const profilePlane = new Plane(startPoint, xDir, normal);
  const profileSketch = profileDrawing.sketchOnPlane(profilePlane);
  const builder = new (getOC().BRepOffsetAPI_MakePipe_1)(spine.wire.wrapped, profileSketch.wire.wrapped);
  const shape = cast(builder.Shape());
  builder.delete();
  profileSketch.delete();
  profilePlane.delete();
  xDir.delete();
  crossDirection.delete();
  normal.delete();
  tangent.delete();
  startPoint.delete();
  spine.delete();
  return shape;
}

function sweptSurfaceForProfile(profile, path) {
  if (profile.type === 'open') return surfaceSweepDrawing(drawingForSegments(profile.geometry.segments, profile.id), path);
  const surfaces = [surfaceSweepDrawing(drawingForProfile(profile), path)];
  for (const hole of profile.geometry.holes || []) surfaces.push(surfaceSweepDrawing(drawingForSegments(hole.segments, profile.id), path));
  return surfaces.length === 1 ? surfaces[0] : compoundShapes(surfaces);
}

function sweepProfile(profile, path) {
  let shape = sweepDrawing(drawingForProfile(profile), path);
  for (const hole of profile.geometry.holes || []) shape = shape.cut(sweepDrawing(drawingForSegments(hole.segments, profile.id), path));
  return shape;
}

function loftProfiles(profiles, loftMode) {
  const loftDrawings = (drawings) => {
    const sketches = drawings.map((drawing, index) => drawing.sketchOnPlane(profiles[index].plane || 'XY', Number(profiles[index].planeOffset || 0)));
    return sketches[0].loftWith(sketches.slice(1), { ruled: loftMode === 'ruled' });
  };
  let shape = loftDrawings(profiles.map((profile) => drawingForProfile(profile)));
  const holeCount = profiles[0].geometry.holes?.length || 0;
  for (let holeIndex = 0; holeIndex < holeCount; holeIndex += 1) {
    const cutter = loftDrawings(profiles.map((profile) => drawingForSegments(profile.geometry.holes[holeIndex].segments, profile.id)));
    shape = shape.cut(cutter);
  }
  return shape;
}

function surfaceLoftProfiles(profiles, loftMode) {
  const loftDrawings = (drawings) => {
    const sketches = drawings.map((drawing, index) => drawing.sketchOnPlane(profiles[index].plane || 'XY', Number(profiles[index].planeOffset || 0)));
    return sketches[0].loftWith(sketches.slice(1), { ruled: loftMode === 'ruled' }, true);
  };
  const surfaces = [loftDrawings(profiles.map((profile) => drawingForProfile(profile)))];
  const holeCount = profiles[0].geometry.holes?.length || 0;
  for (let holeIndex = 0; holeIndex < holeCount; holeIndex += 1) surfaces.push(loftDrawings(profiles.map((profile) => drawingForSegments(profile.geometry.holes[holeIndex].segments, profile.id))));
  return surfaces.length === 1 ? surfaces[0] : compoundShapes(surfaces);
}

function thickenLoftProfiles(profiles, loftMode, thickness, wallSide, surfaceOffset = 0) {
  const [outerDistance, innerDistance] = wallSide === 'outside'
    ? [surfaceOffset + thickness, surfaceOffset]
    : wallSide === 'inside'
      ? [surfaceOffset, surfaceOffset - thickness]
      : [surfaceOffset + thickness / 2, surfaceOffset - thickness / 2];
  const loftBand = (drawings) => {
    const loftAtOffset = (distance) => {
      const sketches = drawings.map((drawing, index) => (distance ? drawing.offset(distance, { lineJoinType: 'miter' }) : drawing).sketchOnPlane(profiles[index].plane || 'XY', Number(profiles[index].planeOffset || 0)));
      return sketches[0].loftWith(sketches.slice(1), { ruled: loftMode === 'ruled' });
    };
    return loftAtOffset(outerDistance).cut(loftAtOffset(innerDistance));
  };
  const solids = [loftBand(profiles.map((profile) => drawingForProfile(profile)))];
  const holeCount = profiles[0].geometry.holes?.length || 0;
  for (let holeIndex = 0; holeIndex < holeCount; holeIndex += 1) solids.push(loftBand(profiles.map((profile) => drawingForSegments(profile.geometry.holes[holeIndex].segments, profile.id))));
  return solids.length === 1 ? solids[0] : compoundShapes(solids);
}

function stitchSurfaceShapes(shapes, tolerance) {
  const oc = getOC();
  const sewing = new oc.BRepBuilderAPI_Sewing(tolerance, true, true, true, false);
  const progress = new oc.Message_ProgressRange_1();
  try {
    shapes.forEach((shape) => sewing.Add(shape.wrapped));
    sewing.Perform(progress);
    const freeEdges = Number(sewing.NbFreeEdges());
    const stitched = cast(sewing.SewedShape());
    if (stitched.wrapped.ShapeType() !== oc.TopAbs_ShapeEnum.TopAbs_SHELL) {
      stitched.delete();
      throw new Error('Wybrane powierzchnie nie tworzą jednego połączonego płaszcza.');
    }
    if (freeEdges > 0) return { shape: stitched, bodyKind: 'surface', freeEdges };
    const solid = makeSolid([stitched]);
    stitched.delete();
    return { shape: solid, bodyKind: 'solid', freeEdges: 0 };
  } finally {
    progress.delete();
    sewing.delete();
  }
}

function facetedBrepFromMesh(mesh, tolerance = GEOMETRY_POLICY.linearTolerance) {
  const report = inspectMesh(mesh, tolerance);
  if (report.degenerateTriangles || report.duplicateTriangles) throw new Error('Konwersja B-Rep wymaga wcześniejszego oczyszczenia trójkątów zerowych i powtórzonych.');
  if (report.boundaryEdges) throw new Error(`Konwersja B-Rep wymaga zamkniętej siatki; wykryto ${report.boundaryEdges} otwartych krawędzi.`);
  if (report.nonManifoldEdges) throw new Error(`Konwersja B-Rep wymaga siatki manifold; wykryto ${report.nonManifoldEdges} krawędzi niemanifold.`);
  if (report.inconsistentEdges) throw new Error(`Konwersja B-Rep wymaga spójnej orientacji; wykryto ${report.inconsistentEdges} niespójnych krawędzi.`);
  if (report.triangleCount > 2500) throw new Error(`Kontrolowana konwersja B-Rep obsługuje do 2 500 trójkątów; bieżąca siatka ma ${report.triangleCount.toLocaleString('pl-PL')}. Najpierw użyj Redukcji.`);
  const faces = [];
  try {
    for (let offset = 0; offset < mesh.triangles.length; offset += 3) {
      const vertices = mesh.triangles.slice(offset, offset + 3).map((index) => mesh.vertices.slice(index * 3, index * 3 + 3));
      faces.push(makePolygon(vertices));
    }
    const stitched = stitchSurfaceShapes(faces, Math.max(tolerance, 1e-5));
    if (stitched.bodyKind !== 'solid') {
      stitched.shape.delete?.();
      throw new Error(`OpenCascade nie domknął płaszcza; pozostało ${stitched.freeEdges} wolnych krawędzi.`);
    }
    return stitched.shape;
  } finally {
    faces.forEach((face) => face.delete?.());
  }
}

function trimSurfaceWithSolid(surface, tool) {
  const oc = getOC();
  const progress = new oc.Message_ProgressRange_1();
  const cutter = new oc.BRepAlgoAPI_Cut_3(surface.wrapped, tool.wrapped, progress);
  let result;
  try {
    cutter.Build(progress);
    if (!cutter.IsDone()) throw new Error('OpenCascade nie ukończył przycinania powierzchni.');
    cutter.SimplifyResult(true, true, GEOMETRY_POLICY.linearTolerance);
    result = cast(cutter.Shape());
    const faces = result.faces;
    const hasFaces = faces.length > 0;
    faces.forEach((face) => face.delete());
    const sourceArea = measureShapeSurfaceProperties(surface).area;
    const resultArea = measureShapeSurfaceProperties(result).area;
    if (!hasFaces || resultArea <= GEOMETRY_POLICY.linearTolerance ** 2) throw new Error('Bryła tnąca usunęła całą powierzchnię.');
    if (sourceArea - resultArea <= GEOMETRY_POLICY.linearTolerance ** 2) throw new Error('Bryła tnąca nie przecina wybranej powierzchni.');
    return result;
  } catch (error) {
    result?.delete?.();
    throw error;
  } finally {
    cutter.delete();
    progress.delete();
  }
}

function extendPlanarSurfaceEdge(surface, reference, distance) {
  const oc = getOC();
  const faces = surface.faces;
  const edges = surface.edges;
  const pointHandles = [];
  const edgeBuilders = [];
  let wireBuilder;
  let faceBuilder;
  let strip;
  let progress;
  let fuser;
  let result;
  try {
    if (faces.length !== 1 || faces[0].geomType !== 'PLANE') throw new Error('Surface Extend obsługuje obecnie pojedynczą planarną powierzchnię.');
    const descriptors = edges.map((edge) => edgeDescriptor(edge));
    const descriptor = descriptors[matchingEdgeIndex(reference, descriptors)];
    if (descriptor.geometry !== 'LINE' || descriptor.closed) throw new Error('Surface Extend wymaga prostej, otwartej krawędzi powierzchni.');
    const [start, end] = descriptor.endpoints;
    const edgeVector = end.map((value, axis) => value - start[axis]);
    const edgeLength = Math.hypot(...edgeVector);
    if (edgeLength <= GEOMETRY_POLICY.linearTolerance) throw new Error('Wybrana krawędź jest zbyt krótka do przedłużenia.');
    const direction = edgeVector.map((value) => value / edgeLength);
    const center = faces[0].center.toTuple();
    const normal = faces[0].normalAt(center).toTuple();
    let outward = [
      normal[1] * direction[2] - normal[2] * direction[1],
      normal[2] * direction[0] - normal[0] * direction[2],
      normal[0] * direction[1] - normal[1] * direction[0],
    ];
    const midpoint = start.map((value, axis) => (value + end[axis]) / 2);
    const inward = center.map((value, axis) => value - midpoint[axis]);
    if (outward.reduce((sum, value, axis) => sum + value * inward[axis], 0) > 0) outward = outward.map((value) => -value);
    const outwardLength = Math.hypot(...outward) || 1;
    outward = outward.map((value) => value * distance / outwardLength);
    const extendedStart = start.map((value, axis) => value + outward[axis]);
    const extendedEnd = end.map((value, axis) => value + outward[axis]);
    const points = [start, end, extendedEnd, extendedStart].map((coordinates) => {
      const point = new oc.gp_Pnt_3(...coordinates);
      pointHandles.push(point);
      return point;
    });
    for (let index = 0; index < 4; index += 1) edgeBuilders.push(new oc.BRepBuilderAPI_MakeEdge_3(points[index], points[(index + 1) % 4]));
    wireBuilder = new oc.BRepBuilderAPI_MakeWire_5(...edgeBuilders.map((builder) => builder.Edge()));
    if (!wireBuilder.IsDone()) throw new Error('OpenCascade nie utworzył obrysu przedłużenia.');
    faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(wireBuilder.Wire(), true);
    if (!faceBuilder.IsDone()) throw new Error('OpenCascade nie utworzył płata przedłużenia.');
    strip = cast(faceBuilder.Face());
    progress = new oc.Message_ProgressRange_1();
    fuser = new oc.BRepAlgoAPI_Fuse_3(surface.wrapped, strip.wrapped, progress);
    fuser.Build(progress);
    if (!fuser.IsDone()) throw new Error('OpenCascade nie połączył przedłużenia z powierzchnią.');
    fuser.SimplifyResult(true, true, GEOMETRY_POLICY.linearTolerance);
    result = cast(fuser.Shape());
    const sourceArea = measureShapeSurfaceProperties(surface).area;
    const resultArea = measureShapeSurfaceProperties(result).area;
    const expectedIncrease = edgeLength * distance;
    if (Math.abs((resultArea - sourceArea) - expectedIncrease) > Math.max(1e-5, expectedIncrease * 1e-6)) throw new Error('Surface Extend nie utworzył oczekiwanego płata powierzchni.');
    const stitched = stitchSurfaceShapes([result], GEOMETRY_POLICY.linearTolerance * 10);
    if (stitched.bodyKind !== 'surface') {
      stitched.shape.delete?.();
      throw new Error('Surface Extend nie zachował otwartego płaszcza powierzchni.');
    }
    result.delete?.();
    result = stitched.shape;
    return result;
  } catch (error) {
    result?.delete?.();
    throw error;
  } finally {
    faces.forEach((face) => face.delete());
    edges.forEach((edge) => edge.delete());
    fuser?.delete();
    progress?.delete();
    strip?.delete();
    faceBuilder?.delete();
    wireBuilder?.delete();
    edgeBuilders.forEach((builder) => builder.delete());
    pointHandles.forEach((point) => point.delete());
  }
}

function ribProfile(feature) {
  const inPlaneThickness = feature.ribMode === 'rib' ? feature.depthValue : feature.thicknessValue;
  const normalDistance = feature.ribMode === 'rib' ? feature.thicknessValue : feature.depthValue;
  const drawing = openChainStrip(feature.profile, { wallThicknessValue: inPlaneThickness, wallSide: feature.wallSide, endCap: 'butt' });
  return drawing.sketchOnPlane(feature.profile.plane || 'XY', Number(feature.profile.planeOffset || 0)).extrude(feature.reverse ? -normalDistance : normalDistance);
}

function coilShape(feature) {
  const spine = sketchHelix(
    feature.pitchValue,
    feature.heightValue,
    feature.coilDiameterValue / 2,
    feature.axis.origin,
    feature.axis.direction,
    feature.handedness === 'left',
  );
  return spine.sweepSketch(
    (plane) => drawCircle(feature.wireDiameterValue / 2).sketchOnPlane(plane),
    { transitionMode: 'round' },
  );
}

function pipeShape(feature) {
  const sweepCircle = (radius) => {
    const [first, ...rest] = feature.path.geometry.points;
    const spinePen = draw(first);
    rest.forEach((point) => spinePen.lineTo(point));
    const spine = spinePen.done().sketchOnPlane(feature.path.plane || 'XY', Number(feature.path.planeOffset || 0));
    return spine.sweepSketch((plane) => drawCircle(radius).sketchOnPlane(plane), { transitionMode: 'round' });
  };
  return sweepCircle(feature.outsideDiameterValue / 2).cut(sweepCircle(feature.insideDiameterValue / 2));
}

function patternTranslations(feature) {
  if (feature.patternType === 'rectangular') {
    const values = [];
    for (let row = 0; row < feature.countYValue; row += 1) for (let column = 0; column < feature.countXValue; column += 1) if (row || column) values.push([column * feature.spacingXValue, row * feature.spacingYValue, 0]);
    return values;
  }
  const frame = { XY: { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] }, XZ: { u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] }, YZ: { u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] } }[feature.path.plane || 'XY'];
  const points = feature.path.geometry.points;
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) lengths.push(lengths.at(-1) + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
  const total = lengths.at(-1);
  const sample = (distance) => {
    let segment = 1;
    while (segment < lengths.length - 1 && lengths[segment] < distance) segment += 1;
    const span = lengths[segment] - lengths[segment - 1];
    const ratio = span ? (distance - lengths[segment - 1]) / span : 0;
    return points[segment - 1].map((value, axis) => value + ((points[segment][axis] - value) * ratio));
  };
  const first = sample(0);
  return Array.from({ length: feature.occurrencesValue - 1 }, (_value, index) => sample(total * (index + 1) / (feature.occurrencesValue - 1))).map((point) => {
    const dx = point[0] - first[0]; const dy = point[1] - first[1];
    return frame.u.map((value, axis) => (value * dx) + (frame.v[axis] * dy));
  });
}

function combineShapes(shapes) {
  if (!shapes.length) throw new Error('Operacja nie zawiera żadnego profilu.');
  return shapes.slice(1).reduce((result, shape) => result.fuse(shape), shapes[0]);
}

function makeCone(firstRadius, secondRadius, height, location, direction) {
  const plane = new Plane(location, null, direction);
  const shape = drawCircle(firstRadius).sketchOnPlane(plane).extrude(height, {
    extrusionDirection: direction,
    extrusionProfile: { profile: 'linear', endFactor: secondRadius / firstRadius },
  });
  plane.delete();
  return shape;
}

function runFeature(feature, bodyMap, bodyOrder) {
  if (feature.status === FEATURE_STATUS.SUPPRESSED || feature.status === FEATURE_STATUS.ROLLED_BACK) return;

  if (feature.type === 'surfacePatch') {
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, {
      id: bodyId,
      name: feature.name,
      sourceFeatureId: feature.id,
      representation: 'brep',
      bodyKind: 'surface',
      surfaceSourceType: 'patch',
      surfaceProfile: feature.profile,
      shape: planarPatchForProfile(feature.profile),
    });
    bodyOrder.push(bodyId);
    return;
  }

  if (feature.type === 'surfaceExtrude') {
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, {
      id: bodyId,
      name: feature.name,
      sourceFeatureId: feature.id,
      representation: 'brep',
      bodyKind: 'surface',
      surfaceSourceType: 'extrude',
      surfaceProfile: feature.profile,
      surfaceDistance: feature.distanceValue,
      shape: extrudedSurfaceForProfile(feature.profile, feature.distanceValue),
    });
    bodyOrder.push(bodyId);
    return;
  }

  if (feature.type === 'surfaceRevolve') {
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, {
      id: bodyId,
      name: feature.name,
      sourceFeatureId: feature.id,
      representation: 'brep',
      bodyKind: 'surface',
      surfaceSourceType: 'revolve',
      surfaceProfile: feature.profile,
      surfaceAxis: feature.axis,
      surfaceAngle: feature.angleValue,
      shape: revolvedSurfaceForProfile(feature.profile, feature.axis, feature.angleValue),
    });
    bodyOrder.push(bodyId);
    return;
  }

  if (feature.type === 'surfaceSweep') {
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, {
      id: bodyId,
      name: feature.name,
      sourceFeatureId: feature.id,
      representation: 'brep',
      bodyKind: 'surface',
      surfaceSourceType: 'sweep',
      surfaceProfile: feature.profile,
      surfacePath: feature.path,
      shape: sweptSurfaceForProfile(feature.profile, feature.path),
    });
    bodyOrder.push(bodyId);
    return;
  }

  if (feature.type === 'surfaceLoft') {
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, {
      id: bodyId,
      name: feature.name,
      sourceFeatureId: feature.id,
      representation: 'brep',
      bodyKind: 'surface',
      surfaceSourceType: 'loft',
      surfaceProfiles: feature.profiles,
      surfaceLoftMode: feature.loftMode,
      shape: surfaceLoftProfiles(feature.profiles, feature.loftMode),
    });
    bodyOrder.push(bodyId);
    return;
  }

  if (feature.type === 'surfaceOffset') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target || target.bodyKind !== 'surface') throw new Error(`Nie znaleziono powierzchni dla ${feature.name}.`);
    if (Math.abs(feature.distanceValue) <= GEOMETRY_POLICY.linearTolerance) return;
    const sourceShape = target.shape;
    target.shape = makeOffset(sourceShape, feature.distanceValue);
    sourceShape.delete?.();
    target.surfaceOffsetDistance = Number(target.surfaceOffsetDistance || 0) + feature.distanceValue;
    target.name = feature.name;
    target.sourceFeatureId = feature.id;
    return;
  }

  if (feature.type === 'surfaceTrim') {
    const target = bodyMap.get(feature.targetBodyId);
    const tool = bodyMap.get(feature.toolBodyId);
    if (!target || target.bodyKind !== 'surface') throw new Error(`Surface Trim „${feature.name}” wymaga istniejącej powierzchni.`);
    if (!tool || tool.bodyKind === 'surface') throw new Error(`Surface Trim „${feature.name}” wymaga bryły tnącej.`);
    const sourceShape = target.shape;
    target.shape = trimSurfaceWithSolid(sourceShape, tool.shape);
    sourceShape.delete?.();
    target.surfaceSourceType = 'trim';
    target.name = feature.name;
    target.sourceFeatureId = feature.id;
    if (feature.keepTool === false) {
      tool.shape.delete?.();
      bodyMap.delete(tool.id);
      const index = bodyOrder.indexOf(tool.id);
      if (index >= 0) bodyOrder.splice(index, 1);
    }
    return;
  }

  if (feature.type === 'surfaceExtend') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target || target.bodyKind !== 'surface') throw new Error(`Surface Extend „${feature.name}” wymaga istniejącej powierzchni.`);
    const sourceShape = target.shape;
    target.shape = extendPlanarSurfaceEdge(sourceShape, feature.topologyReferences?.[0], feature.distanceValue);
    sourceShape.delete?.();
    target.surfaceSourceType = 'extend';
    target.name = feature.name;
    target.sourceFeatureId = feature.id;
    return;
  }

  if (feature.type === 'surfaceStitch') {
    const targets = [...new Set(feature.targetBodyIds)].map((bodyId) => bodyMap.get(bodyId));
    if (targets.some((target) => !target || target.bodyKind !== 'surface')) throw new Error(`Stitch „${feature.name}” wymaga istniejących powierzchni.`);
    const result = stitchSurfaceShapes(targets.map((target) => target.shape), feature.toleranceValue);
    for (const target of targets) {
      target.shape.delete?.();
      bodyMap.delete(target.id);
      const index = bodyOrder.indexOf(target.id);
      if (index >= 0) bodyOrder.splice(index, 1);
    }
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, {
      id: bodyId,
      name: feature.name,
      sourceFeatureId: feature.id,
      representation: 'brep',
      bodyKind: result.bodyKind,
      surfaceSourceType: result.bodyKind === 'surface' ? 'stitch' : undefined,
      surfaceFreeEdges: result.freeEdges,
      shape: result.shape,
    });
    bodyOrder.push(bodyId);
    return;
  }

  if (feature.type === 'thickenSurface') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target || target.bodyKind !== 'surface') throw new Error(`Nie znaleziono powierzchni dla ${feature.name}.`);
    const sourceShape = target.shape;
    target.shape = thickenSurfaceBody(target, feature);
    sourceShape.delete?.();
    target.bodyKind = 'solid';
    target.name = feature.name;
    target.sourceFeatureId = feature.id;
    delete target.surfaceSourceType;
    delete target.surfaceProfile;
    delete target.surfaceDistance;
    delete target.surfaceAxis;
    delete target.surfaceAngle;
    delete target.surfacePath;
    delete target.surfaceProfiles;
    delete target.surfaceLoftMode;
    delete target.surfaceOffsetDistance;
    delete target.surfaceFreeEdges;
    delete target.surfaceTransforms;
    return;
  }

  if (feature.type === 'importedModel') {
    if (!feature.importedShape) throw new Error(`Nie załadowano geometrii ${feature.name}.`);
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, {
      id: bodyId,
      name: feature.name,
      sourceFeatureId: feature.id,
      representation: feature.importFormat === 'step' || feature.representationMode === 'brep-faceted' ? 'brep' : 'mesh-import',
      meshBooleanCapable: feature.importFormat === 'step' || feature.representationMode === 'brep-faceted' || feature.meshBooleanCapable !== false,
      shape: feature.importedShape,
    });
    bodyOrder.push(bodyId);
    return;
  }

  if (feature.type === 'primitive') {
    const [x, y, z] = feature.position;
    let shape;
    if (feature.primitiveType === 'box') shape = makeBox([x, y, z], [x + feature.widthValue, y + feature.depthValue, z + feature.heightValue]);
    else if (feature.primitiveType === 'cylinder') shape = makeCylinder(feature.radiusValue, feature.heightValue, [x, y, z], [0, 0, 1]);
    else if (feature.primitiveType === 'sphere') shape = makeSphere(feature.radiusValue).translate(x, y, z);
    else if (feature.primitiveType === 'torus') {
      if (feature.minorRadiusValue >= feature.majorRadiusValue) throw new Error('Promień przekroju Torus musi być mniejszy od promienia głównego.');
      const axis = makeAx2([x, y, z], [0, 0, 1]);
      const builder = new (getOC().BRepPrimAPI_MakeTorus_5)(axis, feature.majorRadiusValue, feature.minorRadiusValue);
      shape = cast(builder.Shape());
      builder.delete();
      axis.delete();
    } else throw new Error(`Nieobsługiwany prymityw: ${feature.primitiveType}.`);
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: 'brep', shape });
    bodyOrder.push(bodyId);
    return;
  }

  if (feature.type === 'textSolid') {
    let tool;
    if (feature.placement === 'face') {
      const descriptor = feature.topologyReferences?.[0]?.descriptor;
      const normal = descriptor?.normal;
      const origin = descriptor?.center;
      if (!origin || !normal) throw new Error('Utracono planarną powierzchnię Emboss/Deboss.');
      const helper = Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const xDirection = [helper[1] * normal[2] - helper[2] * normal[1], helper[2] * normal[0] - helper[0] * normal[2], helper[0] * normal[1] - helper[1] * normal[0]];
      const plane = new Plane(origin, xDirection, normal);
      const distance = feature.operation === 'deboss' ? -feature.depthValue : feature.depthValue;
      tool = combineShapes(feature.profile.rectangles.map((rectangle) => drawRectangle(rectangle.width, rectangle.height).translate(rectangle.x + (rectangle.width / 2), rectangle.y + (rectangle.height / 2)).sketchOnPlane(plane).extrude(distance)));
      plane.delete();
    } else {
      const z = feature.operation === 'deboss' ? feature.position[2] - feature.depthValue : feature.position[2];
      tool = combineShapes(feature.profile.rectangles.map((rectangle) => makeBox([rectangle.x, rectangle.y, z], [rectangle.x + rectangle.width, rectangle.y + rectangle.height, z + feature.depthValue])));
    }
    const bodyId = `body-${feature.id}`;
    if (feature.operation === 'new') {
      bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: 'brep', shape: tool });
      bodyOrder.push(bodyId);
      return;
    }
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    if (feature.operation === 'emboss') target.shape = target.shape.fuse(tool);
    else if (feature.operation === 'deboss') target.shape = target.shape.cut(tool);
    else throw new Error(`Nieobsługiwana operacja tekstu: ${feature.operation}.`);
    return;
  }

  if (feature.type === 'transform') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    if (feature.mode === 'move') target.shape = target.shape.translate(...feature.translation);
    else if (feature.mode === 'rotate') target.shape = target.shape.rotate(feature.angleValue, feature.origin, [0, 0, 1]);
    else throw new Error(`Nieobsługiwana transformacja: ${feature.mode}.`);
    if (target.bodyKind === 'surface') {
      target.surfaceTransforms = [...(target.surfaceTransforms || []), feature.mode === 'move'
        ? { mode: 'move', translation: feature.translation }
        : { mode: 'rotate', angle: feature.angleValue, origin: feature.origin }];
    }
    return;
  }

  if (feature.type === 'offsetFace') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    if (Math.abs(feature.distanceValue) <= GEOMETRY_POLICY.linearTolerance) return;
    const faces = target.shape.faces;
    try {
      const descriptors = faces.map((face) => faceDescriptor(face));
      const faceIndex = matchingFaceIndex(feature.topologyReferences?.[0], descriptors);
      const face = faces[faceIndex];
      if (face.geomType !== 'PLANE') throw new Error('Offset Face obsługuje obecnie wyłącznie ściany planarne.');
      const center = face.center.toTuple();
      const normal = face.normalAt(center).toTuple();
      const vector = new Vector(normal.map((value) => value * feature.distanceValue));
      const builder = new (getOC().BRepPrimAPI_MakePrism_1)(face.wrapped, vector.wrapped, true, true);
      const tool = cast(builder.Shape());
      target.shape = feature.distanceValue > 0 ? target.shape.fuse(tool) : target.shape.cut(tool);
      tool.delete();
      builder.delete();
      vector.delete();
    } finally {
      faces.forEach((face) => face.delete());
    }
    return;
  }

  if (feature.type === 'revolve') {
    const tool = revolveProfile(feature.profile, feature.axis, feature.angleValue);
    const bodyId = `body-${feature.id}`;
    if (feature.operation === 'new' || !feature.targetBodyId) {
      bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: 'brep', shape: tool });
      bodyOrder.push(bodyId);
      return;
    }
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    if (feature.operation === 'join') target.shape = target.shape.fuse(tool);
    else if (feature.operation === 'cut') target.shape = target.shape.cut(tool);
    else if (feature.operation === 'intersect') target.shape = target.shape.intersect(tool);
    else throw new Error(`Nieobsługiwana operacja Revolve: ${feature.operation}.`);
    return;
  }

  if (feature.type === 'sweep') {
    const tool = sweepProfile(feature.profile, feature.path);
    const bodyId = `body-${feature.id}`;
    if (feature.operation === 'new' || !feature.targetBodyId) {
      bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: 'brep', shape: tool });
      bodyOrder.push(bodyId);
      return;
    }
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    if (feature.operation === 'join') target.shape = target.shape.fuse(tool);
    else if (feature.operation === 'cut') target.shape = target.shape.cut(tool);
    else if (feature.operation === 'intersect') target.shape = target.shape.intersect(tool);
    else throw new Error(`Nieobsługiwana operacja Sweep: ${feature.operation}.`);
    return;
  }

  if (feature.type === 'loft') {
    const tool = loftProfiles(feature.profiles, feature.loftMode);
    const bodyId = `body-${feature.id}`;
    if (feature.operation === 'new' || !feature.targetBodyId) {
      bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: 'brep', shape: tool });
      bodyOrder.push(bodyId);
      return;
    }
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    if (feature.operation === 'join') target.shape = target.shape.fuse(tool);
    else if (feature.operation === 'cut') target.shape = target.shape.cut(tool);
    else if (feature.operation === 'intersect') target.shape = target.shape.intersect(tool);
    else throw new Error(`Nieobsługiwana operacja Loft: ${feature.operation}.`);
    return;
  }

  if (feature.type === 'rib') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    target.shape = target.shape.fuse(ribProfile(feature));
    return;
  }

  if (feature.type === 'coil') {
    const tool = coilShape(feature);
    const bodyId = `body-${feature.id}`;
    if (feature.operation === 'new' || !feature.targetBodyId) {
      bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: 'brep', shape: tool });
      bodyOrder.push(bodyId);
      return;
    }
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    if (feature.operation === 'join') target.shape = target.shape.fuse(tool);
    else if (feature.operation === 'cut') target.shape = target.shape.cut(tool);
    else if (feature.operation === 'intersect') target.shape = target.shape.intersect(tool);
    else throw new Error(`Nieobsługiwana operacja Coil: ${feature.operation}.`);
    return;
  }

  if (feature.type === 'pipe') {
    const tool = pipeShape(feature);
    const bodyId = `body-${feature.id}`;
    if (feature.operation === 'new' || !feature.targetBodyId) {
      bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: 'brep', shape: tool });
      bodyOrder.push(bodyId);
      return;
    }
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    if (feature.operation === 'join') target.shape = target.shape.fuse(tool);
    else if (feature.operation === 'cut') target.shape = target.shape.cut(tool);
    else if (feature.operation === 'intersect') target.shape = target.shape.intersect(tool);
    else throw new Error(`Nieobsługiwana operacja Pipe: ${feature.operation}.`);
    return;
  }

  if (feature.type === 'pattern') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    const seed = target.shape.clone();
    if (feature.patternType === 'circular') {
      const denominator = Math.abs(feature.totalAngleValue) === 360 ? feature.occurrencesValue : Math.max(1, feature.occurrencesValue - 1);
      for (let index = 1; index < feature.occurrencesValue; index += 1) target.shape = target.shape.fuse(seed.clone().rotate((feature.totalAngleValue * index) / denominator, feature.axis.origin, feature.axis.direction));
    } else {
      for (const translation of patternTranslations(feature)) target.shape = target.shape.fuse(seed.clone().translate(translation));
    }
    if (target.manufacturingHoles?.length) {
      const occurrenceCount = feature.patternType === 'rectangular'
        ? feature.countXValue * feature.countYValue
        : feature.occurrencesValue;
      target.manufacturingHoles = target.manufacturingHoles.map((hole) => ({
        ...hole,
        quantity: hole.quantity * occurrenceCount,
      }));
    }
    return;
  }

  if (feature.type === 'sheetBase') {
    const startDelta = feature.side === 'symmetric' ? -feature.thicknessValue / 2 : feature.reverse ? -feature.thicknessValue : 0;
    const shape = extrudeProfile(feature.profile, { startDelta, distance: feature.thicknessValue }, { thin: false });
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, {
      id: bodyId,
      name: feature.name,
      sourceFeatureId: feature.id,
      representation: 'brep',
      shape,
      sheetMetal: {
        thickness: feature.thicknessValue,
        bendRadius: feature.bendRadiusValue,
        kFactor: feature.kFactorValue,
        side: feature.side,
        reverse: feature.reverse,
        baseProfile: feature.profile,
        midPlaneOffset: Number(feature.profile.planeOffset || 0) + startDelta + feature.thicknessValue / 2,
        bends: [],
      },
    });
    bodyOrder.push(bodyId);
    return;
  }

  if (feature.type === 'sheetFlange') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target?.sheetMetal) throw new Error(`Nie znaleziono bryły blachowej dla ${feature.name}.`);
    const reference = feature.topologyReferences[0];
    const descriptor = reference?.descriptor;
    if (descriptor?.geometry !== 'LINE' || !Array.isArray(descriptor.endpoints) || descriptor.endpoints.length !== 2) throw new Error('Kołnierz wymaga jednej prostej krawędzi blachy.');

    const normal = PROFILE_PLANE_NORMALS[target.sheetMetal.baseProfile?.plane || 'XY'];
    const edgeDirection = vectorNormalized(vectorSubtract(descriptor.endpoints[1], descriptor.endpoints[0]));
    if (Math.abs(vectorDot(edgeDirection, normal)) > GEOMETRY_POLICY.angularTolerance) throw new Error('Wybrana krawędź nie leży w płaszczyźnie bazowej blachy.');
    const midPlaneOffset = Number(target.sheetMetal.midPlaneOffset ?? target.sheetMetal.baseProfile?.planeOffset ?? 0);
    const projectToMidPlane = (point) => vectorSubtract(point, vectorScale(normal, vectorDot(point, normal) - midPlaneOffset));
    const start = projectToMidPlane(descriptor.endpoints[0]);
    const end = projectToMidPlane(descriptor.endpoints[1]);
    const angle = feature.angleValue * Math.PI / 180;
    let transverse = vectorNormalized(vectorCross(edgeDirection, normal));
    const edgeCenter = vectorScale(vectorAdd(start, end), 0.5);
    if (vectorDot(transverse, vectorSubtract(edgeCenter, sheetProfileCenter(target.sheetMetal))) < 0) transverse = vectorScale(transverse, -1);
    const bendNormal = feature.reverse ? vectorScale(normal, -1) : normal;
    const thickness = target.sheetMetal.thickness;
    const midRadius = feature.bendRadiusValue + thickness / 2;
    const outerRadius = feature.bendRadiusValue + thickness;
    const innerRadius = feature.bendRadiusValue;
    const arcPoint = (radius, arcAngle) => [radius * Math.sin(arcAngle), midRadius - radius * Math.cos(arcAngle)];
    const outerEnd = arcPoint(outerRadius, angle);
    const innerEnd = arcPoint(innerRadius, angle);
    const outerFar = [outerEnd[0] + Math.cos(angle) * feature.lengthValue, outerEnd[1] + Math.sin(angle) * feature.lengthValue];
    const innerFar = [innerEnd[0] + Math.cos(angle) * feature.lengthValue, innerEnd[1] + Math.sin(angle) * feature.lengthValue];
    const crossSection = draw([0, -thickness / 2])
      .threePointsArcTo(outerEnd, arcPoint(outerRadius, angle / 2))
      .lineTo(outerFar)
      .lineTo(innerFar)
      .lineTo(innerEnd)
      .threePointsArcTo([0, thickness / 2], arcPoint(innerRadius, angle / 2))
      .close();
    const sectionNormal = vectorNormalized(vectorCross(transverse, bendNormal));
    const sectionPlane = new Plane(start, transverse, sectionNormal);
    const sectionSketch = crossSection.sketchOnPlane(sectionPlane);
    const flangeShape = sectionSketch.extrude(Math.hypot(...vectorSubtract(end, start)), { extrusionDirection: edgeDirection });
    const fusedShape = target.shape.fuse(flangeShape);
    sectionPlane.delete();
    flangeShape.delete();
    target.shape = fusedShape;
    target.sheetMetal = {
      ...target.sheetMetal,
      bends: [
        ...(target.sheetMetal.bends || []),
        {
          featureId: feature.id,
          referenceId: reference.id,
          length: feature.lengthValue,
          angle: feature.angleValue,
          bendRadius: feature.bendRadiusValue,
          reverse: feature.reverse,
          neutralAllowance: (feature.bendRadiusValue + target.sheetMetal.kFactor * target.sheetMetal.thickness) * angle,
        },
      ],
    };
    return;
  }

  if (feature.type === 'extrude') {
    const span = extrusionSpan(feature, bodyMap);
    const tool = combineShapes(feature.profiles.map((profile) => extrudeProfile(profile, span, feature)));
    const bodyId = `body-${feature.id}`;
    if (feature.operation === 'new' || !feature.targetBodyId) {
      bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: 'brep', shape: tool });
      bodyOrder.push(bodyId);
      return;
    }

    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły docelowej dla ${feature.name}.`);
    if (feature.operation === 'join') target.shape = target.shape.fuse(tool);
    else if (feature.operation === 'cut') target.shape = target.shape.cut(tool);
    else if (feature.operation === 'intersect') target.shape = target.shape.intersect(tool);
    else throw new Error(`Nieobsługiwana operacja bryłowa: ${feature.operation}`);
    return;
  }

  if (feature.type === 'hole') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    let placement;
    if (feature.placement === 'face-edges') {
      const [faceReference, firstEdgeReference, secondEdgeReference] = feature.topologyReferences || [];
      const faces = target.shape.faces;
      const edges = target.shape.edges;
      try {
        const faceDescriptors = faces.map((face) => faceDescriptor(face));
        const edgeDescriptors = edges.map((edge) => edgeDescriptor(edge));
        placement = resolveFaceEdgeHolePlacement(
          faceDescriptors[matchingFaceIndex(faceReference, faceDescriptors)],
          edgeDescriptors[matchingEdgeIndex(firstEdgeReference, edgeDescriptors)],
          edgeDescriptors[matchingEdgeIndex(secondEdgeReference, edgeDescriptors)],
          feature.firstOffsetValue,
          feature.secondOffsetValue,
        );
      } finally {
        faces.forEach((face) => face.delete());
        edges.forEach((edge) => edge.delete());
      }
    } else {
      const { x, y } = feature.profile.geometry;
      const plane = feature.profile.plane || 'XY';
      const planeOffset = Number(feature.profile.planeOffset || 0);
      const outside = plane === 'XZ'
        ? [x, 1 - planeOffset, y]
        : plane === 'YZ'
          ? [planeOffset - 1, x, y]
          : [x, y, planeOffset - 1];
      const direction = plane === 'XZ' ? [0, -1, 0] : plane === 'YZ' ? [1, 0, 0] : [0, 0, 1];
      placement = { position: outside.map((value, axis) => value + direction[axis]), direction };
    }
    const outside = placement.position.map((value, axis) => value - placement.direction[axis]);
    const usesConicalPreparation = feature.pipePreparation === 'conical' && feature.threadTaperValue > 0;
    const mainHoleLength = feature.depthValue + 2;
    const entryDiameter = feature.effectiveDiameterValue + (usesConicalPreparation ? feature.threadTaperValue : 0);
    const endDiameter = feature.effectiveDiameterValue - (usesConicalPreparation ? feature.threadTaperValue * (feature.depthValue + 1) : 0);
    if (endDiameter <= 0) throw new Error('Głębokość stożkowego otworu jest zbyt duża dla wybranej średnicy.');
    const cutters = [usesConicalPreparation
      ? makeCone(entryDiameter / 2, endDiameter / 2, mainHoleLength, outside, placement.direction)
      : makeCylinder(feature.effectiveDiameterValue / 2, mainHoleLength, outside, placement.direction)];
    if (feature.holeType === 'counterbore') {
      cutters.push(makeCylinder(feature.counterboreDiameterValue / 2, feature.counterboreDepthValue + 1, outside, placement.direction));
    } else if (feature.holeType === 'countersink') {
      const mainRadius = feature.effectiveDiameterValue / 2;
      const sinkRadius = feature.countersinkDiameterValue / 2;
      const tangent = Math.tan((feature.countersinkAngleValue * Math.PI / 180) / 2);
      const sinkDepth = (sinkRadius - mainRadius) / tangent;
      const epsilon = 0.001;
      const coneOrigin = placement.position.map((value, axis) => value - (placement.direction[axis] * epsilon));
      cutters.push(makeCone(sinkRadius + (epsilon * tangent), mainRadius, sinkDepth + epsilon, coneOrigin, placement.direction));
    }
    if (feature.threadMode === 'modeled') {
      const threadDepth = Math.min(feature.threadPitchValue * 0.3, feature.threadDiameterValue * 0.08);
      const turns = Math.max(1, Math.floor(feature.threadLengthValue / feature.threadPitchValue));
      const grooveWidth = Math.min(feature.threadPitchValue * 0.25, threadDepth);
      const grooveEpsilon = Math.min(0.01, grooveWidth * 0.05);
      const grooves = Array.from({ length: turns }, (_unused, index) => {
        const phase = feature.threadDirection === 'left' ? 0.65 : 0.35;
        const offset = Math.min(feature.threadLengthValue, (index + phase) * feature.threadPitchValue);
        const localBaseRadius = (feature.effectiveDiameterValue - (feature.threadTaperValue * offset)) / 2;
        const grooveRadius = Math.min(feature.threadDiameterValue / 2, localBaseRadius + threadDepth);
        const origin = placement.position.map((value, axis) => value + (placement.direction[axis] * (offset - (grooveWidth / 2) - grooveEpsilon)));
        return makeCylinder(grooveRadius, grooveWidth + (grooveEpsilon * 2), origin, placement.direction);
      });
      cutters.push(...grooves);
    }
    // Cut the main hole and modeled thread grooves as one fused tool so the
    // target B-Rep is rebuilt only once for the complete hole operation.
    target.shape = target.shape.cut(combineShapes(cutters));
    target.manufacturingHoles = [...(target.manufacturingHoles || []), {
      featureId: feature.id,
      diameter: feature.effectiveDiameterValue,
      quantity: 1,
      holeType: feature.holeType,
      through: feature.extent === 'through-all',
      holeStandard: feature.holeStandard || 'custom',
      holeApplication: feature.holeApplication || 'custom',
      standardSize: feature.standardSize || null,
      clearanceClass: feature.clearanceClass || null,
      threadDesignation: feature.threadDesignation || null,
      threadClass: feature.threadClass || null,
      threadInspection: feature.threadInspection || null,
      pipePreparation: feature.pipePreparation || null,
      threadTaper: feature.threadTaperValue || 0,
      diameterToleranceLower: feature.diameterToleranceLowerValue,
      diameterToleranceUpper: feature.diameterToleranceUpperValue,
    }];
    return;
  }

  if (feature.type === 'boolean') {
    const target = bodyMap.get(feature.targetBodyId);
    const tool = bodyMap.get(feature.toolBodyId);
    if (!target || !tool || target.id === tool.id) throw new Error(`Boolean ${feature.name} wymaga dwóch różnych brył.`);
    if (target.representation !== tool.representation || target.meshBooleanCapable === false || tool.meshBooleanCapable === false) {
      throw new Error('Boolean wymaga dwóch zgodnych brył B-Rep albo dwóch zamkniętych siatek manifold.');
    }
    if (feature.operation === 'union') target.shape = target.shape.fuse(tool.shape);
    else if (feature.operation === 'subtract') target.shape = target.shape.cut(tool.shape);
    else if (feature.operation === 'intersect') target.shape = target.shape.intersect(tool.shape);
    else throw new Error(`Nieobsługiwana operacja Boolean: ${feature.operation}.`);
    bodyMap.delete(tool.id);
    const toolIndex = bodyOrder.indexOf(tool.id);
    if (toolIndex >= 0) bodyOrder.splice(toolIndex, 1);
    return;
  }

  if (feature.type === 'fillet' || feature.type === 'chamfer') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    const selectedHashes = selectedEdgeHashes(target.shape, feature.topologyReferences || []);
    const radius = selectedHashes.size
      ? (edge) => selectedHashes.has(edge.hashCode) ? feature.sizeValue : null
      : feature.sizeValue;
    target.shape = feature.type === 'fillet'
      ? target.shape.fillet(radius)
      : target.shape.chamfer(radius);
    return;
  }

  if (feature.type === 'shell') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    const selectedHashes = selectedFaceHashes(target.shape, feature.topologyReferences || []);
    if (!selectedHashes.size) throw new Error('Shell wymaga co najmniej jednej usuwanej ściany.');
    target.shape = target.shape.shell({
      thickness: feature.thicknessValue,
      filter: new FaceFinder().when(({ element }) => selectedHashes.has(element.hashCode)),
    });
    return;
  }

  if (feature.type === 'draft') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    const faces = target.shape.faces;
    const oc = getOC();
    let origin;
    let direction;
    let neutralPlane;
    let drafter;
    let progress;
    try {
      const descriptors = faces.map((face) => faceDescriptor(face));
      const indices = new Set((feature.topologyReferences || []).map((reference) => matchingFaceIndex(reference, descriptors)));
      if (!indices.size) throw new Error('Draft wymaga co najmniej jednej wskazanej ściany.');
      origin = new oc.gp_Pnt_3(...feature.neutralPlane.origin);
      direction = new oc.gp_Dir_4(...feature.neutralPlane.normal);
      neutralPlane = new oc.gp_Pln_3(origin, direction);
      drafter = new oc.BRepOffsetAPI_DraftAngle_2(target.shape.wrapped);
      for (const index of indices) {
        drafter.Add(faces[index].wrapped, direction, feature.angleValue * Math.PI / 180, neutralPlane, false);
        if (!drafter.AddDone()) throw new Error(`OpenCascade odrzucił ścianę Draft (status ${drafter.Status()}).`);
      }
      progress = new oc.Message_ProgressRange_1();
      drafter.Build(progress);
      if (!drafter.IsDone()) throw new Error(`OpenCascade nie zbudował Draft (status ${drafter.Status()}).`);
      target.shape = cast(drafter.Shape());
    } finally {
      progress?.delete();
      drafter?.delete();
      neutralPlane?.delete();
      direction?.delete();
      origin?.delete();
      faces.forEach((face) => face.delete());
    }
    return;
  }

  if (feature.type === 'splitBody') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    const source = target.shape;
    const boundingBox = source.boundingBox;
    const { origin, normal, u, v } = feature.splitPlane;
    const dot = (first, second) => first.reduce((sum, value, axis) => sum + value * second[axis], 0);
    const relative = (point) => point.map((value, axis) => value - origin[axis]);
    let positiveTool;
    let negativeTool;
    let positiveHalf;
    let negativeHalf;
    let positivePlane;
    let negativePlane;
    try {
      const [minimum, maximum] = boundingBox.bounds;
      const corners = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => [
        x ? maximum[0] : minimum[0],
        y ? maximum[1] : minimum[1],
        z ? maximum[2] : minimum[2],
      ])));
      const projected = corners.map((corner) => {
        const vector = relative(corner);
        return [dot(vector, u), dot(vector, v), dot(vector, normal)];
      });
      const range = (axis) => [Math.min(...projected.map((point) => point[axis])), Math.max(...projected.map((point) => point[axis]))];
      const [minU, maxU] = range(0);
      const [minV, maxV] = range(1);
      const [minN, maxN] = range(2);
      if (minN >= -GEOMETRY_POLICY.linearTolerance || maxN <= GEOMETRY_POLICY.linearTolerance) {
        throw new Error('Płaszczyzna Split Body musi przecinać wnętrze bryły i pozostawić materiał po obu stronach.');
      }
      const margin = Math.max(maxU - minU, maxV - minV, maxN - minN, 1) + 1;
      const rectangle = () => drawRectangle((maxU - minU) + (2 * margin), (maxV - minV) + (2 * margin)).translate((minU + maxU) / 2, (minV + maxV) / 2);
      positivePlane = new Plane(origin, u, normal);
      positiveTool = rectangle().sketchOnPlane(positivePlane).extrude(maxN + margin, { extrusionDirection: normal });
      negativePlane = new Plane(origin, u, normal);
      negativeTool = rectangle().sketchOnPlane(negativePlane).extrude(Math.abs(minN) + margin, { extrusionDirection: normal.map((value) => -value) });
      positiveHalf = source.intersect(positiveTool);
      negativeHalf = source.intersect(negativeTool);
      const positiveProperties = measureShapeVolumeProperties(positiveHalf);
      const negativeProperties = measureShapeVolumeProperties(negativeHalf);
      try {
        if (positiveProperties.volume <= GEOMETRY_POLICY.linearTolerance || negativeProperties.volume <= GEOMETRY_POLICY.linearTolerance) {
          throw new Error('Split Body nie utworzył dwóch niepustych brył.');
        }
      } finally {
        positiveProperties.delete();
        negativeProperties.delete();
      }
      target.shape = positiveHalf;
      const resultBodyId = `body-${feature.id}`;
      bodyMap.set(resultBodyId, { id: resultBodyId, name: `${feature.name} B`, sourceFeatureId: feature.id, representation: 'brep', shape: negativeHalf });
      if (!bodyOrder.includes(resultBodyId)) bodyOrder.push(resultBodyId);
      positiveHalf = null;
      negativeHalf = null;
      source.delete();
    } finally {
      boundingBox.delete();
      positiveTool?.delete();
      negativeTool?.delete();
      positiveHalf?.delete();
      negativeHalf?.delete();
      positivePlane?.delete();
      negativePlane?.delete();
    }
    return;
  }

  if (feature.type === 'splitFace') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    const source = target.shape;
    const faces = source.faces;
    const boundingBox = source.boundingBox;
    const sourceNormals = { XY: [0, 0, 1], XZ: [0, -1, 0], YZ: [1, 0, 0] };
    let tool;
    let result;
    let fuser;
    let progress;
    let sourceProperties;
    let resultProperties;
    try {
      const descriptors = faces.map((face) => faceDescriptor(face));
      const faceDescriptorValue = descriptors[matchingFaceIndex(feature.topologyReferences?.[0], descriptors)];
      if (faceDescriptorValue.geometry !== 'PLANE') throw new Error('Split Face obsługuje wyłącznie ściany planarne.');
      const sourceNormal = sourceNormals[feature.profile.plane || 'XY'];
      const alignment = faceDescriptorValue.normal.reduce((sum, value, axis) => sum + value * sourceNormal[axis], 0);
      if (Math.abs(Math.abs(alignment) - 1) > GEOMETRY_POLICY.angularTolerance) throw new Error('Profil Split Face musi leżeć na dzielonej ścianie.');
      const dimensions = boundingBox.bounds[1].map((value, axis) => value - boundingBox.bounds[0][axis]).filter((value) => value > GEOMETRY_POLICY.linearTolerance);
      const depth = Math.max(GEOMETRY_POLICY.linearTolerance * 100, Math.min(...dimensions) * 0.05);
      tool = extrudeProfile(feature.profile, { startDelta: 0, distance: -Math.sign(alignment) * depth }, feature);
      sourceProperties = measureShapeVolumeProperties(source);
      progress = new (getOC().Message_ProgressRange_1)();
      fuser = new (getOC().BRepAlgoAPI_Fuse_3)(source.wrapped, tool.wrapped, progress);
      fuser.Build(progress);
      if (!fuser.IsDone()) throw new Error('OpenCascade nie utworzył podziału ściany.');
      result = cast(fuser.Shape());
      const resultFaces = result.faces;
      resultProperties = measureShapeVolumeProperties(result);
      try {
        const volumeTolerance = Math.max(GEOMETRY_POLICY.linearTolerance, Math.abs(sourceProperties.volume) * 1e-9);
        if (Math.abs(resultProperties.volume - sourceProperties.volume) > volumeTolerance) throw new Error('Split Face zmienił objętość bryły zamiast wyłącznie jej topologię.');
        if (resultFaces.length <= faces.length) throw new Error('Profil nie utworzył nowego regionu na dzielonej ścianie.');
      } finally {
        resultFaces.forEach((face) => face.delete());
      }
      target.shape = result;
      result = null;
      source.delete();
    } finally {
      faces.forEach((face) => face.delete());
      boundingBox.delete();
      result?.delete();
      tool?.delete();
      fuser?.delete();
      progress?.delete();
      resultProperties?.delete();
      sourceProperties?.delete();
    }
    return;
  }

  if (feature.type === 'deleteFace') {
    const target = bodyMap.get(feature.targetBodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    const source = target.shape;
    const faces = source.faces;
    const edges = source.edges;
    let upgrader;
    let result;
    let sourceProperties;
    let resultProperties;
    try {
      const descriptors = faces.map((face) => faceDescriptor(face));
      const selectedIndices = new Set((feature.topologyReferences || []).map((reference) => matchingFaceIndex(reference, descriptors)));
      if (!selectedIndices.size) throw new Error('Delete Face + Heal wymaga co najmniej jednej wskazanej ściany.');
      const mergeEdgeHashes = new Set();
      for (const index of selectedIndices) {
        const faceEdges = faces[index].edges;
        try {
          faceEdges.forEach((edge) => mergeEdgeHashes.add(edge.hashCode));
        } finally {
          faceEdges.forEach((edge) => edge.delete());
        }
      }
      const oc = getOC();
      upgrader = new oc.ShapeUpgrade_UnifySameDomain_2(source.wrapped, true, true, false);
      upgrader.SetLinearTolerance(GEOMETRY_POLICY.linearTolerance);
      upgrader.SetAngularTolerance(GEOMETRY_POLICY.angularTolerance);
      edges.filter((edge) => !mergeEdgeHashes.has(edge.hashCode)).forEach((edge) => upgrader.KeepShape(edge.wrapped));
      upgrader.Build();
      result = cast(upgrader.Shape());
      const resultFaces = result.faces;
      sourceProperties = measureShapeVolumeProperties(source);
      resultProperties = measureShapeVolumeProperties(result);
      try {
        const volumeTolerance = Math.max(GEOMETRY_POLICY.linearTolerance, Math.abs(sourceProperties.volume) * 1e-9);
        if (Math.abs(resultProperties.volume - sourceProperties.volume) > volumeTolerance) throw new Error('Delete Face + Heal zmienił objętość bryły.');
        if (resultFaces.length >= faces.length) throw new Error('Wskazany region nie ma sąsiedniej ściany na tej samej powierzchni do bezpiecznego scalenia.');
      } finally {
        resultFaces.forEach((face) => face.delete());
      }
      target.shape = result;
      result = null;
      source.delete();
    } finally {
      faces.forEach((face) => face.delete());
      edges.forEach((edge) => edge.delete());
      result?.delete();
      resultProperties?.delete();
      sourceProperties?.delete();
      upgrader?.delete();
    }
    return;
  }

  if (feature.type === 'replaceFace') {
    const target = bodyMap.get(feature.targetBodyId);
    const [sourceReference, destinationReference] = feature.topologyReferences || [];
    const destination = bodyMap.get(destinationReference?.bodyId);
    if (!target) throw new Error(`Nie znaleziono bryły dla ${feature.name}.`);
    if (!destination || destination === target) throw new Error('Replace Face wymaga powierzchni docelowej należącej do innej bryły.');
    const sourceFaces = target.shape.faces;
    const destinationFaces = destination.shape.faces;
    let builder;
    let tool;
    let vector;
    try {
      const sourceDescriptors = sourceFaces.map((face) => faceDescriptor(face));
      const destinationDescriptors = destinationFaces.map((face) => faceDescriptor(face));
      const sourceFace = sourceFaces[matchingFaceIndex(sourceReference, sourceDescriptors)];
      const destinationFace = destinationFaces[matchingFaceIndex(destinationReference, destinationDescriptors)];
      if (sourceFace.geomType !== 'PLANE' || destinationFace.geomType !== 'PLANE') throw new Error('Replace Face obsługuje obecnie wyłącznie dwie ściany planarne.');
      const sourceCenter = sourceFace.center.toTuple();
      const destinationCenter = destinationFace.center.toTuple();
      const sourceNormal = sourceFace.normalAt(sourceCenter).toTuple();
      const destinationNormal = destinationFace.normalAt(destinationCenter).toTuple();
      const alignment = Math.abs(sourceNormal.reduce((sum, value, index) => sum + value * destinationNormal[index], 0));
      if (1 - alignment > GEOMETRY_POLICY.angularTolerance) throw new Error('Powierzchnia docelowa Replace Face musi być równoległa do zastępowanej ściany.');
      const distance = sourceNormal.reduce((sum, value, index) => sum + value * (destinationCenter[index] - sourceCenter[index]), 0);
      if (Math.abs(distance) <= GEOMETRY_POLICY.linearTolerance) throw new Error('Powierzchnia docelowa Replace Face pokrywa się z zastępowaną ścianą.');
      vector = new Vector(sourceNormal.map((value) => value * distance));
      builder = new (getOC().BRepPrimAPI_MakePrism_1)(sourceFace.wrapped, vector.wrapped, true, true);
      tool = cast(builder.Shape());
      target.shape = distance > 0 ? target.shape.fuse(tool) : target.shape.cut(tool);
      const resultFaces = target.shape.faces;
      try {
        const reachesDestination = resultFaces.some((face) => {
          if (face.geomType !== 'PLANE') return false;
          const center = face.center.toTuple();
          const normal = face.normalAt(center).toTuple();
          const parallel = Math.abs(normal.reduce((sum, value, index) => sum + value * destinationNormal[index], 0));
          const planeDistance = Math.abs(destinationNormal.reduce((sum, value, index) => sum + value * (center[index] - destinationCenter[index]), 0));
          return 1 - parallel <= GEOMETRY_POLICY.angularTolerance && planeDistance <= GEOMETRY_POLICY.linearTolerance * 10;
        });
        if (!reachesDestination) throw new Error('Replace Face nie utworzył poprawnej ściany na powierzchni docelowej.');
      } finally {
        resultFaces.forEach((face) => face.delete());
      }
    } finally {
      sourceFaces.forEach((face) => face.delete());
      destinationFaces.forEach((face) => face.delete());
      tool?.delete();
      builder?.delete();
      vector?.delete();
    }
  }
}

function descriptorPointDistance(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second)) return Number.POSITIVE_INFINITY;
  return Math.hypot(...first.map((value, axis) => Number(value) - Number(second[axis] || 0)));
}

function edgeReferenceDistance(reference, descriptor) {
  const expected = reference?.descriptor;
  if (!expected?.endpoints || !descriptor?.endpoints) return Number.POSITIVE_INFINITY;
  const direct = descriptorPointDistance(expected.endpoints[0], descriptor.endpoints[0]) + descriptorPointDistance(expected.endpoints[1], descriptor.endpoints[1]);
  const reverse = descriptorPointDistance(expected.endpoints[0], descriptor.endpoints[1]) + descriptorPointDistance(expected.endpoints[1], descriptor.endpoints[0]);
  return Math.min(direct, reverse) + Math.abs(Number(expected.length || 0) - Number(descriptor.length || 0));
}

function selectedEdgeHashes(shape, references) {
  if (!references.length) return new Set();
  const edges = shape.edges;
  try {
    const descriptors = edges.map((edge) => edgeDescriptor(edge));
    const hashes = new Set();
    for (const reference of references) {
      const bestIndex = matchingEdgeIndex(reference, descriptors);
      hashes.add(edges[bestIndex].hashCode);
    }
    return hashes;
  } finally {
    edges.forEach((edge) => edge.delete());
  }
}

function matchingEdgeIndex(reference, descriptors) {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  descriptors.forEach((descriptor, index) => {
    const distance = edgeReferenceDistance(reference, descriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  if (bestIndex < 0 || bestDistance > 1e-4) throw new Error(`Nie odnaleziono wskazanej krawędzi „${reference?.label || reference?.topologyId}”.`);
  return bestIndex;
}

function faceReferenceDistance(reference, descriptor) {
  const expected = reference?.descriptor;
  if (!expected?.center || !descriptor?.center || expected.geometry !== descriptor.geometry) return Number.POSITIVE_INFINITY;
  const centerDistance = descriptorPointDistance(expected.center, descriptor.center);
  const normalDistance = expected.normal && descriptor.normal
    ? Math.min(descriptorPointDistance(expected.normal, descriptor.normal), descriptorPointDistance(expected.normal, descriptor.normal.map((value) => -value)))
    : 0;
  return centerDistance + normalDistance;
}

function matchingFaceIndex(reference, descriptors) {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  descriptors.forEach((descriptor, index) => {
    const distance = faceReferenceDistance(reference, descriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  if (bestIndex < 0 || bestDistance > 1e-4) throw new Error(`Nie odnaleziono wskazanej ściany „${reference?.label || reference?.topologyId}”.`);
  return bestIndex;
}

function selectedFaceHashes(shape, references) {
  if (!references.length) return new Set();
  const faces = shape.faces;
  try {
    const descriptors = faces.map((face) => faceDescriptor(face));
    const hashes = new Set();
    for (const reference of references) {
      const bestIndex = matchingFaceIndex(reference, descriptors);
      hashes.add(faces[bestIndex].hashCode);
    }
    return hashes;
  } finally {
    faces.forEach((face) => face.delete());
  }
}

function faceDescriptor(face) {
  let properties;
  try {
    const center = face.center.toTuple();
    properties = measureShapeSurfaceProperties(face);
    const descriptor = {
      geometry: face.geomType,
      center,
      area: properties.area,
      centerOfMass: [...properties.centerOfMass],
      normal: face.normalAt(center).toTuple(),
      orientation: face.orientation,
    };
    if (descriptor.geometry === 'CYLINDRE') {
      const adaptor = face._geomAdaptor();
      const cylinder = adaptor.Cylinder();
      const axis = cylinder.Axis();
      const location = axis.Location();
      const direction = axis.Direction();
      descriptor.axisOrigin = [location.X(), location.Y(), location.Z()];
      descriptor.axisDirection = [direction.X(), direction.Y(), direction.Z()];
      descriptor.radius = cylinder.Radius();
      direction.delete();
      location.delete();
      axis.delete();
      cylinder.delete();
      adaptor.delete();
    } else if (descriptor.geometry === 'SPHERE') {
      const adaptor = face._geomAdaptor();
      const sphere = adaptor.Sphere();
      descriptor.radius = sphere.Radius();
      sphere.delete();
      adaptor.delete();
    } else if (descriptor.geometry === 'TORUS') {
      const adaptor = face._geomAdaptor();
      const torus = adaptor.Torus();
      descriptor.majorRadius = torus.MajorRadius();
      descriptor.minorRadius = torus.MinorRadius();
      descriptor.radius = descriptor.minorRadius;
      torus.delete();
      adaptor.delete();
    }
    return descriptor;
  } catch (_error) {
    return { geometry: 'UNKNOWN_FACE' };
  } finally {
    properties?.delete();
  }
}

function edgeDescriptor(edge) {
  let adaptor;
  let circle;
  let circleCenter;
  try {
    const start = edge.startPoint.toTuple();
    const end = edge.endPoint.toTuple();
    const ordered = [start, end].sort((left, right) => {
      for (let axis = 0; axis < 3; axis += 1) {
        if (left[axis] !== right[axis]) return left[axis] - right[axis];
      }
      return 0;
    });
    const descriptor = {
      geometry: edge.geomType,
      endpoints: ordered,
      length: edge.length,
      closed: edge.isClosed,
    };
    if (descriptor.geometry === 'CIRCLE') {
      adaptor = edge._geomAdaptor();
      circle = adaptor.Circle();
      circleCenter = circle.Location();
      descriptor.center = [circleCenter.X(), circleCenter.Y(), circleCenter.Z()];
      descriptor.radius = circle.Radius();
      descriptor.diameter = descriptor.radius * 2;
    }
    return descriptor;
  } catch (_error) {
    return { geometry: 'UNKNOWN_EDGE' };
  } finally {
    circleCenter?.delete();
    circle?.delete();
    adaptor?.delete();
  }
}

function measureBodyShape(shape) {
  const surface = measureShapeSurfaceProperties(shape);
  const volume = measureShapeVolumeProperties(shape);
  const boundingBox = shape.boundingBox;
  try {
    const bounds = boundingBox.bounds.map((point) => [...point]);
    return {
      volume: volume.volume,
      area: surface.area,
      centerOfMass: [...volume.centerOfMass],
      bounds,
      dimensions: [
        bounds[1][0] - bounds[0][0],
        bounds[1][1] - bounds[0][1],
        bounds[1][2] - bounds[0][2],
      ],
      faceCount: shape.faces.length,
      edgeCount: shape.edges.length,
    };
  } finally {
    surface.delete();
    volume.delete();
    boundingBox.delete();
  }
}

function measureMeshShape(shape, sourceMesh = null) {
  const mesh = sourceMesh || shape.mesh();
  const bounds = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = mesh.vertices[index + axis];
      bounds[0][axis] = Math.min(bounds[0][axis], value);
      bounds[1][axis] = Math.max(bounds[1][axis], value);
    }
  }
  let signedVolume = 0;
  const weightedCenter = [0, 0, 0];
  for (let index = 0; index < mesh.triangles.length; index += 3) {
    const first = mesh.triangles[index] * 3;
    const second = mesh.triangles[index + 1] * 3;
    const third = mesh.triangles[index + 2] * 3;
    const ax = mesh.vertices[first];
    const ay = mesh.vertices[first + 1];
    const az = mesh.vertices[first + 2];
    const bx = mesh.vertices[second];
    const by = mesh.vertices[second + 1];
    const bz = mesh.vertices[second + 2];
    const cx = mesh.vertices[third];
    const cy = mesh.vertices[third + 1];
    const cz = mesh.vertices[third + 2];
    const tetrahedronVolume = (
      ax * (by * cz - bz * cy)
      - ay * (bx * cz - bz * cx)
      + az * (bx * cy - by * cx)
    ) / 6;
    signedVolume += tetrahedronVolume;
    weightedCenter[0] += tetrahedronVolume * (ax + bx + cx) / 4;
    weightedCenter[1] += tetrahedronVolume * (ay + by + cy) / 4;
    weightedCenter[2] += tetrahedronVolume * (az + bz + cz) / 4;
  }
  const centerOfMass = Math.abs(signedVolume) > GEOMETRY_POLICY.linearTolerance ** 3
    ? weightedCenter.map((value) => value / signedVolume)
    : bounds[0].map((value, axis) => (value + bounds[1][axis]) / 2);
  return {
    volume: shape.volume(),
    area: shape.surfaceArea(),
    centerOfMass,
    bounds,
    dimensions: bounds[0].map((value, axis) => bounds[1][axis] - value),
    faceCount: shape.numTri(),
    edgeCount: shape.numEdge(),
    minimumRadius: null,
  };
}

function meshBody(body, index, quality = 'display') {
  const startedAt = performance.now();
  if (body.representation === 'mesh-import') {
    const mesh = body.shape.mesh();
    const renderBody = {
      id: body.id,
      name: body.name,
      sourceFeatureId: body.sourceFeatureId,
      bodyKind: body.bodyKind || 'solid',
      representation: 'mesh-import',
      manufacturingHoles: body.manufacturingHoles || [],
      meshBooleanCapable: body.meshBooleanCapable !== false,
      color: ['#55b7db', '#81c784', '#ffb95c', '#c49cff'][index % 4],
      vertices: Float32Array.from(mesh.vertices),
      normals: Float32Array.from(mesh.normals),
      triangles: Uint32Array.from(mesh.triangles),
      lines: new Float32Array(),
      faceGroups: [],
      edgeGroups: [],
      topology: { faces: [], edges: [], vertices: [] },
      metrics: measureMeshShape(body.shape, mesh),
    };
    renderBody.bounds = renderBody.metrics.bounds;
    return {
      renderBody,
      topologyState: { faces: [], edges: [], vertices: [] },
      performance: {
        bodyId: body.id,
        durationMs: performance.now() - startedAt,
        triangleCount: renderBody.triangles.length / 3,
      },
    };
  }
  const meshPolicy = quality === 'preview' ? GEOMETRY_POLICY.previewMesh : GEOMETRY_POLICY.displayMesh;
  const mesh = body.shape.mesh({
    tolerance: meshPolicy.linearTolerance,
    angularTolerance: meshPolicy.angularTolerance,
  });
  const edges = body.shape.meshEdges({
    tolerance: meshPolicy.linearTolerance,
    angularTolerance: meshPolicy.angularTolerance,
  });
  const shapeFaces = body.shape.faces;
  const shapeEdges = body.shape.edges;
  const previousTopology = topologyHistory.get(body.id) || { faces: [], edges: [], vertices: [] };
  const faces = assignStableTopologyIds(body.id, 'face', shapeFaces.map(faceDescriptor), previousTopology.faces)
    .map((record, faceIndex) => ({ ...record, sourceHash: shapeFaces[faceIndex].hashCode }));
  const stableEdges = assignStableTopologyIds(body.id, 'edge', shapeEdges.map(edgeDescriptor), previousTopology.edges)
    .map((record, edgeIndex) => ({ ...record, sourceHash: shapeEdges[edgeIndex].hashCode }));
  const vertexDescriptors = [...new Map(stableEdges.flatMap((edge) => (edge.descriptor.endpoints || []).map((point) => [JSON.stringify(point), { point }]))).values()];
  const stableVertices = assignStableTopologyIds(body.id, 'vertex', vertexDescriptors, previousTopology.vertices);
  const faceIds = new Map(faces.map((face) => [face.sourceHash, face.id]));
  const edgeIds = new Map(stableEdges.map((edge) => [edge.sourceHash, edge.id]));
  const renderBody = {
    id: body.id,
    name: body.name,
    sourceFeatureId: body.sourceFeatureId,
    bodyKind: body.bodyKind || 'solid',
    representation: body.representation || 'brep',
    manufacturingHoles: body.manufacturingHoles || [],
    sheetMetal: body.sheetMetal || null,
    color: ['#55b7db', '#81c784', '#ffb95c', '#c49cff'][index % 4],
    vertices: Float32Array.from(mesh.vertices),
    normals: Float32Array.from(mesh.normals),
    triangles: Uint32Array.from(mesh.triangles),
    lines: Float32Array.from(edges.lines),
    faceGroups: mesh.faceGroups.map((group) => ({
      start: group.start,
      count: group.count,
      sourceHash: group.faceId,
      topologyId: faceIds.get(group.faceId) || null,
    })),
    edgeGroups: edges.edgeGroups.map((group) => ({
      start: group.start,
      count: group.count,
      sourceHash: group.edgeId,
      topologyId: edgeIds.get(group.edgeId) || null,
    })),
    topology: {
      faces: faces.map(({ sourceHash, ...face }) => ({ ...face, sourceHash })),
      edges: stableEdges.map(({ sourceHash, ...edge }) => ({ ...edge, sourceHash })),
      vertices: stableVertices,
    },
    metrics: measureBodyShape(body.shape),
  };
  const topologyRadii = [...faces, ...stableEdges].map((record) => record.descriptor?.radius).filter((radius) => Number.isFinite(radius) && radius > 0);
  renderBody.metrics.minimumRadius = topologyRadii.length ? Math.min(...topologyRadii) : null;
  renderBody.bounds = renderBody.metrics.bounds;
  return {
    renderBody,
    topologyState: { faces, edges: stableEdges, vertices: stableVertices },
    performance: {
      bodyId: body.id,
      durationMs: performance.now() - startedAt,
      triangleCount: renderBody.triangles.length / 3,
    },
  };
}

async function evaluateRevision(document, quality) {
  const totalStartedAt = performance.now();
  const kernelStartedAt = performance.now();
  await ensureKernel();
  const kernelMs = performance.now() - kernelStartedAt;
  const prepareStartedAt = performance.now();
  const prepared = prepareDocument(document);
  const prepareMs = performance.now() - prepareStartedAt;
  const importStartedAt = performance.now();
  const features = [];
  for (const feature of prepared.features) {
    if (feature.type !== 'importedModel' || feature.status === FEATURE_STATUS.SUPPRESSED || feature.status === FEATURE_STATUS.ROLLED_BACK) {
      features.push(feature);
      continue;
    }
    const bytes = Uint8Array.from(atob(feature.dataBase64), (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: feature.importFormat === 'step' ? 'model/step' : 'model/stl' });
    let importedShape;
    let meshBooleanCapable = true;
    if (feature.importFormat === 'step') importedShape = await importSTEP(blob);
    else if (feature.representationMode === 'brep-faceted') importedShape = facetedBrepFromMesh(parseStlMesh(bytes));
    else {
      try {
        await ensureMeshKernel();
        importedShape = await importSTLAsMesh(blob);
      } catch (_error) {
        const parsedMesh = parseStlMesh(bytes);
        importedShape = new RawMeshShape(parsedMesh.vertices, parsedMesh.triangles);
        meshBooleanCapable = false;
      }
    }
    const unitScale = Number(feature.unitScale) || 1;
    if (Math.abs(unitScale - 1) > 1e-12) {
      const unscaledShape = importedShape;
      importedShape = importedShape.scale(unitScale, [0, 0, 0]);
      unscaledShape.delete?.();
    }
    features.push({ ...feature, importedShape, meshBooleanCapable });
  }
  const importMs = performance.now() - importStartedAt;
  const historyStartedAt = performance.now();
  const history = evaluateFeatureHistory(features, runFeature);
  const historyMs = performance.now() - historyStartedAt;
  const { bodyMap, bodyOrder, timeline } = history;

  const kernelBodies = bodyOrder.filter((id) => bodyMap.has(id)).map((id) => bodyMap.get(id));
  const meshStartedAt = performance.now();
  const meshedBodies = kernelBodies.map((body, index) => meshBody(body, index, quality));
  const meshMs = performance.now() - meshStartedAt;
  return {
    kernelBodies,
    renderBodies: meshedBodies.map((entry) => entry.renderBody),
    topologyByBody: new Map(meshedBodies.map((entry, index) => [kernelBodies[index].id, entry.topologyState])),
    timeline,
    parameters: prepared.parameters,
    dependencyGraph: prepared.dependencyGraph.toJSON(),
    quality,
    analysis: { collisions: [], collisionStatus: 'not-run', candidatePairs: 0, exactPairs: 0 },
    performance: {
      totalMs: performance.now() - totalStartedAt,
      kernelMs,
      prepareMs,
      importMs,
      historyMs,
      meshMs,
      collisionMs: 0,
      bodies: meshedBodies.map((entry) => entry.performance),
    },
  };
}

function analyzeBodyCollisions(kernelBodies, renderBodies) {
  const collisionStartedAt = performance.now();
  const collisions = [];
  let candidatePairs = 0;
  let exactPairs = 0;
  let skippedPairs = 0;
  for (let first = 0; first < kernelBodies.length; first += 1) {
    for (let second = first + 1; second < kernelBodies.length; second += 1) {
      candidatePairs += 1;
      if (!boundsOverlap(renderBodies[first]?.bounds, renderBodies[second]?.bounds, GEOMETRY_POLICY.linearTolerance)) continue;
      if (kernelBodies[first].representation !== kernelBodies[second].representation
        || kernelBodies[first].meshBooleanCapable === false
        || kernelBodies[second].meshBooleanCapable === false) {
        skippedPairs += 1;
        continue;
      }
      exactPairs += 1;
      let common;
      let volume;
      try {
        common = kernelBodies[first].shape.intersect(kernelBodies[second].shape);
        const volumeValue = kernelBodies[first].representation === 'mesh-import' ? common.volume() : (volume = measureShapeVolumeProperties(common)).volume;
        if (volumeValue > GEOMETRY_POLICY.linearTolerance ** 3) collisions.push({ firstBodyId: kernelBodies[first].id, secondBodyId: kernelBodies[second].id, volume: volumeValue });
      } finally {
        volume?.delete();
        common?.delete();
      }
    }
  }
  return {
    collisions,
    collisionStatus: skippedPairs ? 'partial' : 'complete',
    candidatePairs,
    exactPairs,
    skippedPairs,
    collisionMs: performance.now() - collisionStartedAt,
  };
}

function transferableBuffers(bodies) {
  return bodies.flatMap((body) => [
    body.vertices.buffer,
    body.normals.buffer,
    body.triangles.buffer,
    body.lines.buffer,
  ]);
}

function cloneRenderBodies(bodies) {
  return bodies.map((body) => ({
    ...body,
    vertices: Float32Array.from(body.vertices),
    normals: Float32Array.from(body.normals),
    triangles: Uint32Array.from(body.triangles),
    lines: Float32Array.from(body.lines),
  }));
}

function commitTopology(topologyByBody) {
  for (const [bodyId, topology] of topologyByBody) topologyHistory.set(bodyId, topology);
}

function createRevisionError(revision) {
  const error = new Error(`Wynik rewizji ${revision} jest nieaktualny; oczekiwana rewizja to ${latestRequestedRevision}.`);
  error.code = 'STALE_REVISION';
  return error;
}

async function resolveRevision(document, revision, quality = 'display') {
  if (!Number.isInteger(revision) || revision < 1) {
    const error = new Error('Żądanie silnika CAD nie zawiera prawidłowej rewizji dokumentu.');
    error.code = 'INVALID_REVISION';
    throw error;
  }
  if (isStaleRevision(revision, latestRequestedRevision)) throw createRevisionError(revision);
  const cached = revisionCache.get(revision);
  if (cached) return cached;

  const evaluated = await evaluateRevision(document, quality);
  if (isStaleRevision(revision, latestRequestedRevision)) throw createRevisionError(revision);
  commitTopology(evaluated.topologyByBody);
  revisionCache.set(revision, evaluated, estimateMeshBytes(evaluated.renderBodies));
  return evaluated;
}

function relativeDifference(left, right) {
  const scale = Math.max(Math.abs(left), Math.abs(right), GEOMETRY_POLICY.linearTolerance);
  return Math.abs(left - right) / scale;
}

function compareRoundTrip(source, imported, tolerance) {
  const volumeDifference = relativeDifference(source.volume, imported.volume);
  const areaDifference = relativeDifference(source.area, imported.area);
  const dimensionDifferences = source.dimensions.map((value, index) => relativeDifference(value, imported.dimensions[index]));
  const dimensionAbsoluteDifferences = source.dimensions.map((value, index) => Math.abs(value - imported.dimensions[index]));
  return {
    valid: volumeDifference <= tolerance
      && areaDifference <= tolerance
      && dimensionAbsoluteDifferences.every((difference) => difference <= GEOMETRY_POLICY.roundTrip.boundsAbsoluteTolerance),
    tolerance,
    boundsAbsoluteTolerance: GEOMETRY_POLICY.roundTrip.boundsAbsoluteTolerance,
    source,
    imported,
    differences: {
      volume: volumeDifference,
      area: areaDifference,
      dimensions: dimensionDifferences,
      dimensionsAbsolute: dimensionAbsoluteDifferences,
    },
  };
}

async function validateExportRoundTrip(kernelBodies, blobs, format) {
  const tolerance = format === 'step'
    ? GEOMETRY_POLICY.roundTrip.stepRelativeTolerance
    : GEOMETRY_POLICY.roundTrip.stlRelativeTolerance;
  const results = [];
  for (let index = 0; index < blobs.length; index += 1) {
    let imported;
    if (format === 'step') imported = await importSTEP(blobs[index]);
    else {
      const mesh = parseStlMesh(new Uint8Array(await blobs[index].arrayBuffer()));
      imported = new RawMeshShape(mesh.vertices, mesh.triangles);
    }
    try {
      const sourceMetrics = kernelBodies[index].representation === 'mesh-import'
        ? measureMeshShape(kernelBodies[index].shape)
        : measureBodyShape(kernelBodies[index].shape);
      const importedMetrics = format === 'step' ? measureBodyShape(imported) : measureMeshShape(imported);
      results.push(compareRoundTrip(sourceMetrics, importedMetrics, tolerance));
    } finally {
      imported.delete?.();
    }
  }
  return results;
}

function preparePrintBodies(kernelBodies, renderBodies, print) {
  if (kernelBodies.some((body) => body.bodyKind === 'surface')) throw new Error('Druk 3D wymaga bryły zamkniętej. Użyj Pogrub na każdej powierzchni przed przejściem do WYTWARZAJ.');
  const layoutResult = calculatePrintLayout(renderBodies, print);
  const layout = normalizePrintLayout(print);
  return layoutResult.instances.flatMap(({ index, offsetX }) => kernelBodies.map((body) => {
    let shape = body.shape.clone().scale(layout.scale, [0, 0, 0]);
    if (Math.abs(layout.orientationAngle) > 1e-9) shape = shape.rotate(layout.orientationAngle, [0, 0, 0], layout.orientationAxis);
    if (Math.abs(layout.rotationX) > 1e-9) shape = shape.rotate(layout.rotationX, [0, 0, 0], [1, 0, 0]);
    if (Math.abs(layout.rotationY) > 1e-9) shape = shape.rotate(layout.rotationY, [0, 0, 0], [0, 1, 0]);
    if (Math.abs(layout.rotationZ) > 1e-9) shape = shape.rotate(layout.rotationZ, [0, 0, 0], [0, 0, 1]);
    shape = shape.translate(layout.positionX + offsetX, layout.positionY, layout.positionZ);
    return { ...body, id: `${body.id}-print-${index + 1}`, shape };
  }));
}

async function exportBodies(kernelBodies, format, validateRoundTrip = false) {
  if (!kernelBodies.length) throw new Error('Brak bryły do eksportu.');
  if (!['step', 'stl', '3mf'].includes(format)) throw new Error(`Nieobsługiwany format eksportu: ${format}.`);
  if (format !== 'step' && kernelBodies.some((body) => body.bodyKind === 'surface')) throw new Error('STL i 3MF wymagają zamkniętej bryły. Pogrub powierzchnię albo eksportuj ją jako STEP.');
  if (format === 'step' && kernelBodies.some((body) => body.representation === 'mesh-import')) {
    throw new Error('Eksport STEP wymaga dokładnej bryły B-Rep. Zaimportowany STL/3MF można zapisać jako STL lub 3MF.');
  }
  if (format === '3mf') {
    const meshes = kernelBodies.map(({ name, shape }) => ({ name, ...shape.mesh({ tolerance: GEOMETRY_POLICY.exportMesh.linearTolerance, angularTolerance: GEOMETRY_POLICY.exportMesh.angularTolerance }) }));
    const archive = createThreeMfArchive(meshes);
    return { buffers: [archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength)], roundTrip: [] };
  }
  const blobs = await Promise.all(kernelBodies.map(({ shape }) => (
    format === 'step'
      ? shape.blobSTEP()
      : shape.blobSTL({
        tolerance: GEOMETRY_POLICY.exportMesh.linearTolerance,
        angularTolerance: GEOMETRY_POLICY.exportMesh.angularTolerance,
        binary: true,
      })
  )));
  const roundTrip = validateRoundTrip ? await validateExportRoundTrip(kernelBodies, blobs, format) : [];
  return { buffers: await Promise.all(blobs.map((blob) => blob.arrayBuffer())), roundTrip };
}

async function handleMessage(data) {
  const { id, type, document, format, revision, quality = 'display', validateRoundTrip = false } = data;
  if (type === 'evaluate') {
    const evaluated = await resolveRevision(document, revision, quality);
    const bodies = cloneRenderBodies(evaluated.renderBodies);
    const result = {
      revision,
      quality: evaluated.quality,
      bodies,
      timeline: evaluated.timeline,
      parameters: evaluated.parameters,
      dependencyGraph: evaluated.dependencyGraph,
      cache: revisionCache.stats,
      analysis: evaluated.analysis,
      performance: evaluated.performance,
    };
    self.postMessage({ id, ok: true, type, result }, transferableBuffers(bodies));
    return;
  }
  if (type === 'analyze-collisions') {
    const evaluated = await resolveRevision(document, revision, 'display');
    if (evaluated.analysis.collisionStatus === 'not-run') {
      const collisionResult = analyzeBodyCollisions(evaluated.kernelBodies, evaluated.renderBodies);
      evaluated.analysis = collisionResult;
      evaluated.performance = { ...evaluated.performance, collisionMs: collisionResult.collisionMs };
    }
    self.postMessage({ id, ok: true, type, result: { revision, analysis: evaluated.analysis, performance: evaluated.performance } });
    return;
  }
  if (type === 'export') {
    const evaluated = await resolveRevision(document, revision, 'display');
    const printBodies = preparePrintBodies(evaluated.kernelBodies, evaluated.renderBodies, document.print);
    try {
      const exported = await exportBodies(printBodies, format, validateRoundTrip);
      self.postMessage({ id, ok: true, type, result: { format, revision, ...exported } }, exported.buffers);
    } finally {
      printBodies.forEach((body) => body.shape.delete?.());
    }
    return;
  }
  if (type === 'export-document') {
    const evaluated = await evaluateRevision(document, 'display');
    try {
      const exported = await exportBodies(evaluated.kernelBodies, format, false);
      self.postMessage({ id, ok: true, type, result: { format, buffers: exported.buffers } }, exported.buffers);
    } finally {
      evaluated.kernelBodies.forEach((body) => body.shape.delete?.());
    }
    return;
  }
  const error = new Error(`Nieznane polecenie: ${type}`);
  error.code = 'UNKNOWN_COMMAND';
  throw error;
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'evaluate' && Number.isInteger(data.revision)) {
    latestRequestedRevision = Math.max(latestRequestedRevision, data.revision);
  }
  requestQueue.enqueue(() => handleMessage(data)).catch((error) => {
    self.postMessage({
      id: data.id,
      ok: false,
      type: data.type,
      code: error?.code || 'CAD_ENGINE_ERROR',
      canceled: error?.code === 'STALE_REVISION',
      error: error?.message || String(error),
    });
  });
});
