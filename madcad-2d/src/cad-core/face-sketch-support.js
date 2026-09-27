import { evaluateExpression, resolveParameters } from './expressions.js';

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
