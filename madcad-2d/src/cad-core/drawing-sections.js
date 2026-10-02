import { cast, getOC } from 'replicad';
import { drawingSectionKey, uniqueDrawingSegments } from './drawing-projections.js';
import { viewCoordinates } from './drawing-sheets.js';

// PDF/DXF use curves of the actual B-Rep section, never display triangles.
// Curve flattening targets 0.001 mm chord error for line-based drawing formats.
export function flattenDrawingCurve(point, tolerance = 0.001, linear = false) {
  const samples = new Map();
  const sample = (parameter) => {
    if (!samples.has(parameter)) {
      const value = point(parameter);
      if (!value.every(Number.isFinite)) throw new Error('Kernel zwrócił nieprawidłowy punkt krzywej rysunku.');
      samples.set(parameter, value);
    }
    return samples.get(parameter);
  };
  const segments = [];
  const refine = (a, b, first, last, depth) => {
    const middle = linear ? null : sample((a + b) / 2);
    const error = linear ? 0 : Math.max(...[0.25, 0.5, 0.75].map((ratio) => {
      const probe = sample(a + (b - a) * ratio);
      return Math.hypot(probe[0] - (first[0] + (last[0] - first[0]) * ratio), probe[1] - (first[1] + (last[1] - first[1]) * ratio));
    }));
    // Quarter points catch S-shaped spans whose midpoint lies on the chord.
    if (error > tolerance / 2) {
      if (depth >= 16) throw new Error('Krzywa rysunku przekroczyła limit dokładności.');
      refine(a, (a + b) / 2, first, middle, depth + 1);
      refine((a + b) / 2, b, middle, last, depth + 1);
    } else if (Math.hypot(last[0] - first[0], last[1] - first[1]) > 1e-9) {
      if (segments.length >= 32768) throw new Error('Krzywa rysunku przekroczyła limit segmentów.');
      segments.push([first, last]);
    }
  };
  const steps = linear ? 1 : 8;
  for (let index = 0; index < steps; index += 1) refine(index / steps, (index + 1) / steps, sample(index / steps), sample((index + 1) / steps), 0);
  return segments;
}

export function sectionCurveSegments(pointAt, orientation, tolerance = 0.001, linear = false) {
  return flattenDrawingCurve((parameter) => viewCoordinates(pointAt(parameter), orientation).slice(0, 2), tolerance, linear);
}

export function kernelDrawingCurveSegments(edge, projectPoint, tolerance, projectionScale = 1) {
  if (edge.geomType === 'LINE') return flattenDrawingCurve((parameter) => {
    const vector = edge.pointAt(parameter);
    try { return projectPoint([vector.x, vector.y, vector.z]); } finally { vector.delete(); }
  }, tolerance, true);
  const oc = getOC();
  const adaptor = new oc.BRepAdaptor_Curve_2(edge.wrapped);
  let discretizer;
  try {
    // Kernel deflection follows the curve's geometry/knot spans, not a few JS probes.
    discretizer = new oc.GCPnts_TangentialDeflection_2(adaptor, 0.05, tolerance / (2 * Math.max(1, projectionScale)), 2, 1e-10, 1e-10);
    const count = discretizer.NbPoints();
    if (count < 2 || count > 32769) throw new Error('Kernel przekroczył limit punktów krzywej rysunku.');
    const points = [];
    for (let index = 1; index <= count; index += 1) {
      const point = discretizer.Value(index);
      try {
        const projected = projectPoint([point.X(), point.Y(), point.Z()]);
        if (!projected.every(Number.isFinite)) throw new Error('Kernel zwrócił nieprawidłową krzywą rysunku.');
        points.push(projected);
      } finally { point.delete(); }
    }
    return points.slice(1).map((point, index) => [points[index], point]).filter(([first, last]) => Math.hypot(last[0] - first[0], last[1] - first[1]) > 1e-9);
  } finally { discretizer?.delete(); adaptor.delete(); }
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
                segments.push(...kernelDrawingCurveSegments(edge, (point) => viewCoordinates(point, view.orientation).slice(0, 2), tolerance, view.orientation === 'isometric' ? Math.sqrt(1.5) : 1));
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
