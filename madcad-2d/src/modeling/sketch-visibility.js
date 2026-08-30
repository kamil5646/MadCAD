export function resolveVisibleSketchId({ activeSketchId = null, selection = null, sketches = [], bodyCount = 0 } = {}) {
  if (activeSketchId) return activeSketchId;
  if (selection?.sketchId) return selection.sketchId;
  if (selection?.kind === 'sketch') return selection.id;
  if (bodyCount === 0) return sketches.at(-1)?.id || null;
  return null;
}

export function resolveReferenceSketchIds({ activeSketchId = null, sketches = [] } = {}) {
  if (!activeSketchId) return [];
  return sketches
    .filter((sketch) => sketch.id !== activeSketchId
      && (sketch.entities || []).some((entity) => entity.type !== 'point'))
    .map((sketch) => sketch.id);
}
