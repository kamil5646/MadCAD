export const drawingProjectionGroupKey = (ids) => JSON.stringify([...new Set(ids)].sort());

export function uniqueDrawingSegments(segments) {
  const seen = new Set();
  return segments.filter((segment) => {
    const key = segment.map((point) => point.map((value) => Math.round(value * 1e7)).join(',')).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function drawingProjectionGroups(sheets, bodies) {
  const groups = new Map();
  for (const sheet of sheets || []) {
    for (const view of sheet.views || []) {
      if (view.type === 'sketch') continue;
      const ids = bodies.filter((body) => !view.bodyIds?.length || view.bodyIds.includes(body.id)).map((body) => body.id);
      if (ids.length > 1) groups.set(drawingProjectionGroupKey(ids), ids);
    }
  }
  return [...groups.values()];
}

export function attachDrawingProjections(bodies, data) {
  return bodies.map((body) => ({ ...body, drawingProjections: data[body.id], drawingGroupProjections: data.__groups }));
}

// Never export the transient tessellation fallback or a projection of an older model.
export async function prepareDrawingExport({ bodies, revision, getCurrentRevision, project, groups, requiredBodyIds }) {
  const data = await project(['front', 'top', 'right', 'isometric'], groups);
  if (getCurrentRevision() !== revision) throw new Error('Model zmienił się podczas przygotowania rysunku. Ponów eksport.');
  for (const body of bodies) {
    if (requiredBodyIds && !requiredBodyIds.includes(body.id)) continue;
    if (body.representation === 'mesh-import') throw new Error('Dokładny rysunek wymaga bryły B-Rep. Najpierw zamień siatkę na B-Rep.');
    if (['front', 'top', 'right', 'isometric'].some((orientation) => !data[body.id]?.[orientation])) throw new Error('Nie udało się obliczyć dokładnego rzutu bryły. Eksport został zatrzymany.');
  }
  for (const ids of groups || []) {
    if (['front', 'top', 'right', 'isometric'].some((orientation) => !data.__groups?.[drawingProjectionGroupKey(ids)]?.[orientation])) throw new Error('Nie udało się obliczyć wspólnego rzutu brył. Eksport został zatrzymany.');
  }
  return attachDrawingProjections(bodies, data);
}
