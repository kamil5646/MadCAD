import { evaluateExpression, resolveParameters } from './expressions.js';
import { frameFromNormal } from './sketch-frame.js';

const PLANE_NORMALS = Object.freeze({ XY: [0, 0, 1], XZ: [0, -1, 0], YZ: [1, 0, 0] });

// Keep a sketch on the end cap of an axis-aligned, one-sided extrusion when
// that extrusion changes in the same document-history transaction. Other
// topology changes still need geometric reference resolution and repair.
export function moveEndFaceSketchSupports(previous, next) {
  const previousParameters = resolveParameters(previous.parameters);
  const nextParameters = resolveParameters(next.parameters);
  if (!previousParameters.valid || !nextParameters.valid) return 0;
  let moved = 0;
  for (const sketch of next.sketches) {
    if (sketch.support?.kind !== 'face' || sketch.frame) continue;
    const reference = next.references.find((item) => item.id === sketch.support.referenceId);
    const previousFeature = previous.features.find((item) => item.id === reference?.sourceFeatureId);
    const nextFeature = next.features.find((item) => item.id === reference?.sourceFeatureId);
    if (!previousFeature || !nextFeature || previousFeature.type !== 'extrude' || nextFeature.type !== 'extrude'
      || previousFeature.operation !== 'new' || nextFeature.operation !== 'new'
      || previousFeature.extent !== 'one-side' || nextFeature.extent !== 'one-side'
      || previousFeature.sketchId !== nextFeature.sketchId || reference?.descriptor?.geometry !== 'PLANE') continue;
    const previousSource = previous.sketches.find((item) => item.id === previousFeature.sketchId);
    const nextSource = next.sketches.find((item) => item.id === nextFeature.sketchId);
    const normal = PLANE_NORMALS[previousSource?.plane];
    if (!normal || nextSource?.plane !== previousSource.plane || previousSource.frame || nextSource.frame
      || !Array.isArray(reference.descriptor.normal)
      || normal.reduce((sum, value, index) => sum + value * reference.descriptor.normal[index], 0) < 0.99) continue;
    try {
      const endPosition = (source, feature, values) => evaluateExpression(source.planeOffset || 0, values)
        + evaluateExpression(feature.startOffset || 0, values)
        + evaluateExpression(feature.distance, values);
      const delta = endPosition(nextSource, nextFeature, nextParameters.values)
        - endPosition(previousSource, previousFeature, previousParameters.values);
      if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) continue;
      sketch.planeOffset = String(evaluateExpression(sketch.planeOffset || 0, nextParameters.values) + delta);
      for (const key of ['center', 'centerOfMass']) {
        if (Array.isArray(reference.descriptor[key])) {
          reference.descriptor[key] = reference.descriptor[key].map((value, index) => value + normal[index] * delta);
        }
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
