export function resolveVisibleSketchId({ activeSketchId = null, selection = null, sketches = [], bodyCount = 0, featureCount = 0 } = {}) {
  if (activeSketchId) return activeSketchId;
  if (selection?.sketchId) return selection.sketchId;
  if (selection?.kind === 'sketch') return selection.id;
  if (bodyCount === 0 && featureCount === 0) return sketches.at(-1)?.id || null;
  return null;
}

export function resolveReferenceSketchIds({ activeSketchId = null, sketches = [] } = {}) {
  if (!activeSketchId) return [];
  return sketches
    .filter((sketch) => sketch.id !== activeSketchId
      && (sketch.entities || []).some((entity) => entity.type !== 'point'))
    .map((sketch) => sketch.id);
}

export function resolveResumableSketch({ plane = 'XY', sketches = [], bodyCount = 0, featureCount = 0 } = {}) {
  return resolveResumableSketches({ plane, sketches, bodyCount, featureCount }).at(-1) || null;
}

export function resolveResumableSketches({ plane = 'XY', sketches = [], bodyCount = 0, featureCount = 0 } = {}) {
  if (bodyCount > 0 || featureCount > 0) return [];
  return sketches.filter((sketch) => {
    if ((sketch.plane || 'XY') !== plane || sketch.support) return false;
    const offset = Number(sketch.planeOffset || 0);
    return Number.isFinite(offset) && Math.abs(offset) <= 1e-7;
  });
}

export function mergeResumableSketches(document, plane = 'XY') {
  const candidates = resolveResumableSketches({
    plane,
    sketches: document?.sketches || [],
    bodyCount: document?.bodies?.length || 0,
    featureCount: document?.features?.length || 0,
  });
  const target = candidates.at(-1) || null;
  if (!target || candidates.length === 1) {
    return { sketch: target, mergedCount: 0, mergedSketchIds: [] };
  }

  const candidateIds = new Set(candidates.map((sketch) => sketch.id));
  const mergedSketchIds = candidates.filter((sketch) => sketch.id !== target.id).map((sketch) => sketch.id);
  target.entities = candidates.flatMap((sketch) => sketch.entities || []);
  target.constraints = candidates.flatMap((sketch) => sketch.constraints || []);
  target.dimensions = candidates.flatMap((sketch) => sketch.dimensions || []);
  target.blockInstances = candidates.flatMap((sketch) => sketch.blockInstances || []);
  target.profiles = [];
  document.sketches = document.sketches.filter((sketch) => !candidateIds.has(sketch.id) || sketch.id === target.id);

  for (const component of document.components || []) {
    if (!(component.sketchIds || []).some((sketchId) => candidateIds.has(sketchId))) continue;
    component.sketchIds = [...new Set((component.sketchIds || []).map((sketchId) => candidateIds.has(sketchId) ? target.id : sketchId))];
  }
  for (const sheet of document.drawings || []) {
    for (const view of sheet.views || []) {
      if (candidateIds.has(view.sketchId)) view.sketchId = target.id;
    }
  }

  return { sketch: target, mergedCount: mergedSketchIds.length, mergedSketchIds };
}
