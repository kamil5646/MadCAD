import { evaluateExpression, resolveParameters } from './expressions.js';
import { resolveConstructionPlane } from './construction-planes.js';
import { frameFromNormal, resolveSketchFrame } from './sketch-frame.js';

const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
const subtract = (left, right) => left.map((value, index) => value - right[index]);
const add = (left, right) => left.map((value, index) => value + right[index]);

function sourceSketchFrame(document, sketch, values) {
  if (sketch.support?.kind === 'construction-plane') {
    const plane = document.references.find((reference) => reference.id === sketch.support.referenceId);
    if (plane) return resolveConstructionPlane(plane, values);
  }
  return resolveSketchFrame({ ...sketch, planeOffset: evaluateExpression(sketch.planeOffset || 0, values) });
}

function transformBetweenFrames(before, after, vector) {
  return before.u.map((_, index) => after.u[index] * dot(vector, before.u)
    + after.v[index] * dot(vector, before.v)
    + after.normal[index] * dot(vector, before.normal));
}

function sideFaceShift(previousSource, nextSource, before, after, valuesBefore, valuesAfter, plane) {
  if (dot(before.u, after.u) < 0.999999 || dot(before.v, after.v) < 0.999999
    || dot(before.normal, after.normal) < 0.999999) return null;
  const nextPoints = new Map(nextSource.entities?.filter((entity) => entity.type === 'point').map((entity) => [entity.id, entity]));
  const coordinate = (entity, frame, values) => add(frame.origin, frame.u.map((value, axis) => value * evaluateExpression(entity.geometry.x, values)
    + frame.v[axis] * evaluateExpression(entity.geometry.y, values)));
  const planeCoordinate = dot(plane.center, plane.normal);
  const shifts = [];
  for (const entity of previousSource.entities || []) {
    if (entity.type !== 'point' || !nextPoints.has(entity.id)) continue;
    const oldPoint = coordinate(entity, before, valuesBefore);
    if (Math.abs(dot(oldPoint, plane.normal) - planeCoordinate) > 1e-4) continue;
    const newPoint = coordinate(nextPoints.get(entity.id), after, valuesAfter);
    shifts.push(dot(subtract(newPoint, oldPoint), plane.normal));
  }
  if (shifts.length < 2 || shifts.some((value) => !Number.isFinite(value) || Math.abs(value - shifts[0]) > 1e-4)) return null;
  return shifts[0];
}

// Keep planar end and unchanged-orientation side supports on one-sided
// extrusions during a single document-history transaction. Other topology
// changes still need geometric reference resolution and repair.
export function moveTrackedFaceSketchSupports(previous, next) {
  const previousParameters = resolveParameters(previous.parameters);
  const nextParameters = resolveParameters(next.parameters);
  if (!previousParameters.valid || !nextParameters.valid) return 0;
  const originalSupportPlanes = new Map(next.references.map((reference) => [reference.id, {
    normal: reference.descriptor?.normal,
    center: reference.descriptor?.center,
  }]));
  const movedReferences = new Set();
  let moved = 0;
  for (const sketch of next.sketches) {
    if (sketch.support?.kind !== 'face') continue;
    const reference = next.references.find((item) => item.id === sketch.support.referenceId);
    const originalPlane = originalSupportPlanes.get(reference?.id);
    const previousFeature = previous.features.find((item) => item.id === reference?.sourceFeatureId);
    const nextFeature = next.features.find((item) => item.id === reference?.sourceFeatureId);
    if (!previousFeature || !nextFeature || previousFeature.type !== 'extrude' || nextFeature.type !== 'extrude'
      || previousFeature.operation !== 'new' || nextFeature.operation !== 'new'
      || previousFeature.extent !== 'one-side' || nextFeature.extent !== 'one-side'
      || previousFeature.sketchId !== nextFeature.sketchId || reference?.descriptor?.geometry !== 'PLANE') continue;
    const previousSource = previous.sketches.find((item) => item.id === previousFeature.sketchId);
    const nextSource = next.sketches.find((item) => item.id === nextFeature.sketchId);
    if (!previousSource || !nextSource || !Array.isArray(originalPlane?.normal)
      || !Array.isArray(originalPlane?.center)) continue;
    try {
      const before = sourceSketchFrame(previous, previousSource, previousParameters.values);
      const after = sourceSketchFrame(next, nextSource, nextParameters.values);
      const normal = before.normal;
      if (Math.abs(dot(normal, originalPlane.normal)) < 0.01) {
        const displacement = sideFaceShift(previousSource, nextSource, before, after,
          previousParameters.values, nextParameters.values, originalPlane);
        if (displacement === null || Math.abs(displacement) < 1e-9) continue;
        const shift = originalPlane.normal.map((value) => value * displacement);
        const supportedFrame = resolveSketchFrame({ ...sketch, planeOffset: evaluateExpression(sketch.planeOffset || 0, nextParameters.values) });
        if (dot(supportedFrame.normal, originalPlane.normal) < 0.999999) continue;
        if (sketch.frame) sketch.frame = { ...sketch.frame, origin: add(sketch.frame.origin, shift) };
        else sketch.planeOffset = String(evaluateExpression(sketch.planeOffset || 0, nextParameters.values) + displacement);
        if (!movedReferences.has(reference.id)) {
          for (const key of ['center', 'centerOfMass']) {
            if (Array.isArray(reference.descriptor[key])) reference.descriptor[key] = add(reference.descriptor[key], shift);
          }
          movedReferences.add(reference.id);
        }
        moved += 1;
        continue;
      }
      if (dot(normal, originalPlane.normal) < 0.99) continue;
      const endPosition = (frame, feature, values) => frame.origin.map((value, index) => value + frame.normal[index]
        * (evaluateExpression(feature.startOffset || 0, values) + evaluateExpression(feature.distance, values)));
      const previousEnd = endPosition(before, previousFeature, previousParameters.values);
      const nextEnd = endPosition(after, nextFeature, nextParameters.values);
      if (Math.abs(dot(subtract(originalPlane.center, previousEnd), normal)) > 1e-4) continue;
      const shift = subtract(nextEnd, previousEnd);
      const changedOrientation = dot(before.u, after.u) < 0.999999 || dot(before.v, after.v) < 0.999999 || dot(before.normal, after.normal) < 0.999999;
      if (shift.some((value) => !Number.isFinite(value)) || (!changedOrientation && Math.hypot(...shift) < 1e-9)) continue;
      const supportedFrame = resolveSketchFrame({ ...sketch, planeOffset: evaluateExpression(sketch.planeOffset || 0, nextParameters.values) });
      if (dot(supportedFrame.normal, normal) < 0.999999) continue;
      const transformPoint = (point) => add(nextEnd, transformBetweenFrames(before, after, subtract(point, previousEnd)));
      if (sketch.frame || changedOrientation) {
        sketch.frame = changedOrientation
          ? {
            origin: transformPoint(supportedFrame.origin),
            normal: transformBetweenFrames(before, after, supportedFrame.normal),
            u: transformBetweenFrames(before, after, supportedFrame.u),
            v: transformBetweenFrames(before, after, supportedFrame.v),
          }
          : { ...sketch.frame, origin: add(sketch.frame.origin, shift) };
      } else {
        const alongNormal = dot(shift, normal);
        if (Math.hypot(...shift.map((value, index) => value - normal[index] * alongNormal)) > 1e-6) continue;
        sketch.planeOffset = String(evaluateExpression(sketch.planeOffset || 0, nextParameters.values) + alongNormal);
      }
      if (!movedReferences.has(reference.id)) {
        for (const key of ['center', 'centerOfMass']) {
          if (Array.isArray(reference.descriptor[key])) {
            reference.descriptor[key] = changedOrientation
              ? transformPoint(reference.descriptor[key])
              : add(reference.descriptor[key], shift);
          }
        }
        if (changedOrientation) reference.descriptor.normal = transformBetweenFrames(before, after, originalPlane.normal);
        movedReferences.add(reference.id);
      }
      moved += 1;
    } catch {
      // Leave invalid expressions to normal document validation; do not guess
      // a new support location from a partially evaluated feature.
    }
  }
  return moved;
}

export function placeSketchesOnReassignedFace(document, referenceId, descriptor) {
  if (descriptor?.geometry !== 'PLANE' || !Array.isArray(descriptor.center) || !Array.isArray(descriptor.normal)) return 0;
  const normal = descriptor.normal;
  const dominant = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const axisAligned = normal.every((value, index) => index === dominant || Math.abs(value) <= 1e-6);
  let placed = 0;
  for (const sketch of document.sketches) {
    if (sketch.support?.kind !== 'face' || sketch.support.referenceId !== referenceId) continue;
    sketch.plane = dominant === 0 ? 'YZ' : dominant === 1 ? 'XZ' : 'XY';
    sketch.planeOffset = String(dominant === 1 ? -descriptor.center[1] : descriptor.center[dominant]);
    if (axisAligned) delete sketch.frame;
    else sketch.frame = frameFromNormal(descriptor.center, normal);
    placed += 1;
  }
  return placed;
}
