import { cast, getOC } from 'replicad';
import { drawingSectionKey, uniqueDrawingSegments } from './drawing-projections.js';
import { viewCoordinates } from './drawing-sheets.js';

// PDF/DXF use curves of the actual B-Rep section, never display triangles.
// Curve flattening targets 0.001 mm chord error for line-based drawing formats.
export function flattenDrawingCurve(point, tolerance = 0.001, linear = false) {
  const segments = [];
  const refine = (a, b, first, last, depth) => {
    const middle = point((a + b) / 2);
    const error = Math.hypot(middle[0] - (first[0] + last[0]) / 2, middle[1] - (first[1] + last[1]) / 2);
    if (!linear && error > tolerance) {
      if (depth >= 16) throw new Error('Przekrój przekroczył limit dokładności krzywej.');
      refine(a, (a + b) / 2, first, middle, depth + 1);
      refine((a + b) / 2, b, middle, last, depth + 1);
    } else if (Math.hypot(last[0] - first[0], last[1] - first[1]) > 1e-9) {
      if (segments.length >= 32768) throw new Error('Przekrój przekroczył limit segmentów krzywej.');
      segments.push([first, last]);
    }
  };
  const steps = linear ? 1 : 8;
  for (let index = 0; index < steps; index += 1) refine(index / steps, (index + 1) / steps, point(index / steps), point((index + 1) / steps), 0);
  return segments;
}

export function sectionCurveSegments(pointAt, orientation, tolerance = 0.001, linear = false) {
  return flattenDrawingCurve((parameter) => viewCoordinates(pointAt(parameter), orientation).slice(0, 2), tolerance, linear);
}

export function projectExactSections(kernelBodies, views, tolerance = 0.001) {
  const projections = {};
  const oc = getOC();
  for (const view of views) {
    const selected = kernelBodies.filter((body) => !view.bodyIds?.length || view.bodyIds.includes(body.id));
    if (selected.some((body) => !body.shape || body.representation === 'mesh-import')) throw new Error('Dokładny przekrój wymaga bryły B-Rep.');
    const bounds = selected.flatMap((body) => {
      const box = body.shape.boundingBox;
      try {
        const [min, max] = box.bounds;
        return [min[0], max[0]].flatMap((x) => [min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z) => viewCoordinates([x, y, z], view.orientation)[2])));
      } finally { box.delete(); }
    });
    const segments = [];
    if (bounds.length) {
      const min = Math.min(...bounds);
      const depth = min + (Math.max(...bounds) - min) * Math.max(0.05, Math.min(0.95, Number(view.sectionPosition) || 0.5));
      const normal = view.orientation === 'top' ? [0, 0, 1] : view.orientation === 'right' ? [1, 0, 0] : view.orientation === 'isometric' ? [-1, 1, -1].map((value) => value / Math.sqrt(3)) : [0, 1, 0];
      const plane = new oc.gp_Pln_4(...normal, -depth);
      try {
        for (const body of selected) {
          const operation = new oc.BRepAlgoAPI_Section_5(body.shape.wrapped, plane, true);
          let shape;
          try {
            if (!operation.IsDone()) throw new Error('Kernel nie ukończył dokładnego przekroju B-Rep.');
            const raw = operation.Shape();
            try { shape = cast(raw); } finally { raw.delete(); }
            for (const edge of shape.edges) {
              try {
                segments.push(...sectionCurveSegments((parameter) => {
                  const vector = edge.pointAt(parameter);
                  try { return [vector.x, vector.y, vector.z]; } finally { vector.delete(); }
                }, view.orientation, tolerance, edge.geomType === 'LINE'));
              } finally { edge.delete(); }
            }
          } finally { shape?.delete(); operation.delete(); }
        }
      } finally { plane.delete(); }
    }
    projections[drawingSectionKey(view)] = { segments: uniqueDrawingSegments(segments), tolerance };
  }
  return projections;
}
