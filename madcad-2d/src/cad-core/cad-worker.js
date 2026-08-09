import opencascade from 'replicad-opencascadejs';
import opencascadeWasm from 'replicad-opencascadejs/src/replicad_single.wasm?url';
import {
  Curve2D,
  FaceFinder,
  Plane,
  Vector,
  cast,
  drawCircle,
  drawEllipse,
  draw,
  drawRectangle,
  getOC,
  importSTEP,
  importSTL,
  makeAx2,
  makeBox,
  makeCylinder,
  makeSphere,
  measureShapeSurfaceProperties,
  measureShapeVolumeProperties,
  setOC,
} from 'replicad';
import { FEATURE_STATUS, prepareDocument } from './evaluator.js';
import { evaluateFeatureHistory } from './feature-history.js';
import { GEOMETRY_POLICY } from './geometry-policy.js';
import { resolveFaceEdgeHolePlacement } from './face-edge-hole.js';
import { assignStableTopologyIds } from './topology-naming.js';
import { RevisionCache, SerialTaskQueue, estimateMeshBytes, isStaleRevision } from './worker-runtime.js';
import { calculatePrintLayout, normalizePrintLayout } from './print-layout.js';
import { createThreeMfArchive } from './three-mf.js';

let kernelPromise;
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
  const [leftDistance, rightDistance] = feature.wallSide === 'outside'
    ? [thickness, 0]
    : feature.wallSide === 'inside'
      ? [0, -thickness]
      : [thickness / 2, -thickness / 2];
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
  const drawing = drawingForProfile(profile);
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

function sweepProfile(profile, path) {
  const sweepDrawing = (profileDrawing) => {
    const [first, ...rest] = path.geometry.points;
    const spinePen = draw(first);
    rest.forEach((point) => spinePen.lineTo(point));
    const spine = spinePen.done().sketchOnPlane(path.plane || 'XY', Number(path.planeOffset || 0));
    return spine.sweepSketch((plane) => profileDrawing.sketchOnPlane(plane), { transitionMode: 'round' });
  };
  let shape = sweepDrawing(drawingForProfile(profile));
  for (const hole of profile.geometry.holes || []) shape = shape.cut(sweepDrawing(drawingForSegments(hole.segments, profile.id)));
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
  if (feature.status === FEATURE_STATUS.SUPPRESSED) return;

  if (feature.type === 'importedModel') {
    if (!feature.importedShape) throw new Error(`Nie załadowano geometrii ${feature.name}.`);
    const bodyId = `body-${feature.id}`;
    bodyMap.set(bodyId, { id: bodyId, name: feature.name, sourceFeatureId: feature.id, representation: feature.importFormat === 'step' ? 'brep' : 'mesh-import', shape: feature.importedShape });
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
    const z = feature.operation === 'deboss' ? feature.position[2] - feature.depthValue : feature.position[2];
    const tool = combineShapes(feature.profile.rectangles.map((rectangle) => makeBox(
      [rectangle.x, rectangle.y, z],
      [rectangle.x + rectangle.width, rectangle.y + rectangle.height, z + feature.depthValue],
    )));
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
    const cutters = [makeCylinder(feature.effectiveDiameterValue / 2, feature.depthValue + 2, outside, placement.direction)];
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
    target.shape = target.shape.cut(combineShapes(cutters));
    if (feature.threadMode === 'modeled') {
      const threadDepth = Math.min(feature.threadPitchValue * 0.3, feature.threadDiameterValue * 0.08);
      const turns = Math.max(1, Math.floor(feature.threadLengthValue / feature.threadPitchValue));
      const grooveRadius = Math.min(feature.threadDiameterValue / 2, (feature.effectiveDiameterValue / 2) + threadDepth);
      const grooveWidth = Math.min(feature.threadPitchValue * 0.25, threadDepth);
      const grooves = Array.from({ length: turns }, (_unused, index) => {
        const phase = feature.threadDirection === 'left' ? 0.65 : 0.35;
        const offset = Math.min(feature.threadLengthValue, (index + phase) * feature.threadPitchValue);
        const origin = placement.position.map((value, axis) => value + (placement.direction[axis] * (offset - (grooveWidth / 2))));
        return makeCylinder(grooveRadius, grooveWidth, origin, placement.direction);
      });
      for (const groove of grooves) target.shape = target.shape.cut(groove);
    }
    return;
  }

  if (feature.type === 'boolean') {
    const target = bodyMap.get(feature.targetBodyId);
    const tool = bodyMap.get(feature.toolBodyId);
    if (!target || !tool || target.id === tool.id) throw new Error(`Boolean ${feature.name} wymaga dwóch różnych brył.`);
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

function meshBody(body, index, quality = 'display') {
  const startedAt = performance.now();
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
    representation: 'mesh',
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
  const features = await Promise.all(prepared.features.map(async (feature) => {
    if (feature.type !== 'importedModel' || feature.status === FEATURE_STATUS.SUPPRESSED) return feature;
    const bytes = Uint8Array.from(atob(feature.dataBase64), (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: feature.importFormat === 'step' ? 'model/step' : 'model/stl' });
    let importedShape = feature.importFormat === 'step' ? await importSTEP(blob) : await importSTL(blob);
    const unitScale = Number(feature.unitScale) || 1;
    if (Math.abs(unitScale - 1) > 1e-12) importedShape = importedShape.scale(unitScale, [0, 0, 0]);
    return { ...feature, importedShape };
  }));
  const importMs = performance.now() - importStartedAt;
  const historyStartedAt = performance.now();
  const history = evaluateFeatureHistory(features, runFeature);
  const historyMs = performance.now() - historyStartedAt;
  const { bodyMap, bodyOrder, timeline } = history;

  const kernelBodies = bodyOrder.filter((id) => bodyMap.has(id)).map((id) => bodyMap.get(id));
  const meshStartedAt = performance.now();
  const meshedBodies = kernelBodies.map((body, index) => meshBody(body, index, quality));
  const meshMs = performance.now() - meshStartedAt;
  const collisionStartedAt = performance.now();
  const collisions = [];
  for (let first = 0; first < kernelBodies.length; first += 1) {
    for (let second = first + 1; second < kernelBodies.length; second += 1) {
      let common;
      let volume;
      try {
        common = kernelBodies[first].shape.intersect(kernelBodies[second].shape);
        volume = measureShapeVolumeProperties(common);
        if (volume.volume > GEOMETRY_POLICY.linearTolerance ** 3) collisions.push({ firstBodyId: kernelBodies[first].id, secondBodyId: kernelBodies[second].id, volume: volume.volume });
      } finally {
        volume?.delete();
        common?.delete();
      }
    }
  }
  const collisionMs = performance.now() - collisionStartedAt;
  return {
    kernelBodies,
    renderBodies: meshedBodies.map((entry) => entry.renderBody),
    topologyByBody: new Map(meshedBodies.map((entry, index) => [kernelBodies[index].id, entry.topologyState])),
    timeline,
    parameters: prepared.parameters,
    dependencyGraph: prepared.dependencyGraph.toJSON(),
    quality,
    analysis: { collisions },
    performance: {
      totalMs: performance.now() - totalStartedAt,
      kernelMs,
      prepareMs,
      importMs,
      historyMs,
      meshMs,
      collisionMs,
      bodies: meshedBodies.map((entry) => entry.performance),
    },
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
  return Promise.all(blobs.map(async (blob, index) => {
    const imported = format === 'step' ? await importSTEP(blob) : await importSTL(blob);
    try {
      return compareRoundTrip(measureBodyShape(kernelBodies[index].shape), measureBodyShape(imported), tolerance);
    } finally {
      imported.delete?.();
    }
  }));
}

function preparePrintBodies(kernelBodies, renderBodies, print) {
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
