import { evaluateExpression, resolveParameters } from './expressions.js';
import { frameFromNormal, resolveSketchFrame } from './sketch-frame.js';

const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);

// Keep a sketch on the end cap of a one-sided extrusion when that extrusion
// changes in the same document-history transaction. Rotations and other
// topology changes still need geometric reference resolution and repair.
export function moveEndFaceSketchSupports(previous, next) {
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
      const sourceFrame = (source, values) => resolveSketchFrame({ ...source, planeOffset: evaluateExpression(source.planeOffset || 0, values) });
      const before = sourceFrame(previousSource, previousParameters.values);
      const after = sourceFrame(nextSource, nextParameters.values);
      const normal = before.normal;
      if (dot(normal, after.normal) < 0.999999 || dot(normal, originalPlane.normal) < 0.99) continue;
      const endPosition = (frame, feature, values) => frame.origin.map((value, index) => value + frame.normal[index]
        * (evaluateExpression(feature.startOffset || 0, values) + evaluateExpression(feature.distance, values)));
      const previousEnd = endPosition(before, previousFeature, previousParameters.values);
      const nextEnd = endPosition(after, nextFeature, nextParameters.values);
      if (Math.abs(dot(originalPlane.center.map((value, index) => value - previousEnd[index]), normal)) > 1e-4) continue;
      const shift = nextEnd.map((value, index) => value - previousEnd[index]);
      if (shift.some((value) => !Number.isFinite(value)) || Math.hypot(...shift) < 1e-9) continue;
      if (sketch.frame) sketch.frame.origin = sketch.frame.origin.map((value, index) => value + shift[index]);
      else {
        if (dot(resolveSketchFrame(sketch).normal, normal) < 0.999999) continue;
        const alongNormal = dot(shift, normal);
        if (Math.hypot(...shift.map((value, index) => value - normal[index] * alongNormal)) > 1e-6) continue;
        sketch.planeOffset = String(evaluateExpression(sketch.planeOffset || 0, nextParameters.values) + alongNormal);
      }
      if (!movedReferences.has(reference.id)) {
        for (const key of ['center', 'centerOfMass']) {
          if (Array.isArray(reference.descriptor[key])) {
            reference.descriptor[key] = reference.descriptor[key].map((value, index) => value + shift[index]);
          }
        }
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
