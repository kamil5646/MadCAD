import { describe, expect, it, vi } from 'vitest';
import { attachDrawingProjections, drawingProjectionGroups, drawingProjectionGroupKey, drawingSectionKey, prepareDrawingExport, uniqueDrawingSegments, validateDrawingSources } from './drawing-projections.js';
import { projectDrawingView } from './drawing-sheets.js';

const bodies = [{ id: 'a' }, { id: 'b' }];
const projection = { visible: [[[0, 0], [10, 0]]], hidden: [[[2, 0], [4, 0]]] };
const orientations = Object.fromEntries(['front', 'top', 'right', 'isometric'].map((key) => [key, projection]));

describe('exact drawing exports', () => {
  it('removes coincident projected front/back edges regardless of direction', () => {
    expect(uniqueDrawingSegments([[[0, 0], [10, 0]], [[10, 0], [0, 0]], [[0, 1], [10, 1]]])).toHaveLength(2);
  });
  it('awaits the kernel instead of exporting the preview fallback', async () => {
    let finish;
    const project = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const exportReady = vi.fn();
    const pending = prepareDrawingExport({ bodies: [bodies[0]], revision: 1, getCurrentRevision: () => 1, project, groups: [] }).then(exportReady);
    expect(exportReady).not.toHaveBeenCalled();
    finish({ a: orientations });
    await pending;
    expect(exportReady.mock.calls[0][0][0].drawingProjections.front).toEqual(projection);
  });
  it('rejects stale models and kernel failures', async () => {
    const options = { bodies: [bodies[0]], revision: 1, getCurrentRevision: () => 2, project: async () => ({ a: orientations }), groups: [] };
    await expect(prepareDrawingExport(options)).rejects.toThrow('Model zmienił się');
    await expect(prepareDrawingExport({ ...options, getCurrentRevision: () => 1, project: async () => { throw new Error('kernel failed'); } })).rejects.toThrow('kernel failed');
    await expect(prepareDrawingExport({ ...options, getCurrentRevision: () => 1, project: async () => ({}) })).rejects.toThrow('dokładnego rzutu');
  });
  it('uses a compound projection only for its exact selection of bodies', () => {
    const groups = drawingProjectionGroups([{ views: [{ bodyIds: ['b', 'a'] }, { bodyIds: ['a'] }, { type: 'sketch' }, {}] }], bodies);
    expect(groups).toEqual([['a', 'b']]);
    const data = { a: orientations, b: orientations, __groups: { [drawingProjectionGroupKey(['b', 'a'])]: orientations } };
    const attached = attachDrawingProjections(bodies, data);
    expect(projectDrawingView({ orientation: 'front' }, attached).segments).toHaveLength(1);
    expect(projectDrawingView({ orientation: 'front', bodyIds: ['a'] }, attached).segments).toHaveLength(1);
    expect(projectDrawingView({ orientation: 'front' }, attached).hiddenSegments).toEqual(projection.hidden);
  });
  it('rejects a pending revision before requesting projections and checks again after awaiting', async () => {
    let revision = null;
    const project = vi.fn(async () => { revision = 2; return { a: orientations }; });
    const options = { bodies: [bodies[0]], revision: 1, getCurrentRevision: () => revision, project, groups: [] };
    await expect(prepareDrawingExport(options)).rejects.toThrow('przebudowa');
    expect(project).not.toHaveBeenCalled();
    revision = 1;
    await expect(prepareDrawingExport(options)).rejects.toThrow('Model zmienił się');
  });
  it('requires exact section data instead of accepting an ordinary projection', async () => {
    const view = { type: 'section', orientation: 'front', sectionPosition: 0.5, bodyIds: ['a'] };
    const options = { bodies: [bodies[0]], revision: 1, getCurrentRevision: () => 1, project: async () => ({ a: orientations }), groups: [], sections: [view] };
    await expect(prepareDrawingExport(options)).rejects.toThrow('przekroju B-Rep');
    await expect(prepareDrawingExport({ ...options, project: async () => ({ a: orientations, __sections: { [drawingSectionKey(view)]: { segments: [] } } }) })).resolves.toHaveLength(1);
  });
  it('rejects every unresolved requested body rather than intersecting it with surviving bodies', async () => {
    const project = vi.fn(async () => ({ a: orientations }));
    await expect(prepareDrawingExport({ bodies: [bodies[0]], revision: 1, getCurrentRevision: () => 1, project, groups: [], views: [{ bodyIds: ['a', 'deleted-after-join'] }] })).rejects.toThrow('nieistniejącej bryły');
    expect(project).not.toHaveBeenCalled();
    expect(() => validateDrawingSources([{}], [])).toThrow('nieistniejącej bryły');
    expect(() => validateDrawingSources([{ bodyIds: ['a'] }], bodies)).not.toThrow();
  });
  it('rejects missing sketch sources too, including sketch-only sheets', () => {
    expect(() => validateDrawingSources([{ type: 'sketch', sketchId: 'gone' }], [], [])).toThrow('nieistniejącego szkicu');
    expect(() => validateDrawingSources([{ type: 'sketch', sketchId: 's' }], [], [{ id: 's' }])).not.toThrow();
  });
  it('does not let an unused mesh block a B-Rep sheet, but rejects a mesh source', async () => {
    const options = { bodies: [{ id: 'a' }, { id: 'mesh', representation: 'mesh-import' }], revision: 1, getCurrentRevision: () => 1, project: async () => ({ a: orientations }), groups: [], requiredBodyIds: ['a'] };
    await expect(prepareDrawingExport(options)).resolves.toHaveLength(2);
    await expect(prepareDrawingExport({ ...options, requiredBodyIds: ['mesh'] })).rejects.toThrow('B-Rep');
    await expect(prepareDrawingExport({ ...options, groups: [['a', 'mesh']] })).rejects.toThrow('wspólnego rzutu');
  });
});
