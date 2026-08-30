import { describe, expect, it } from 'vitest';
import { mergeResumableSketches, resolveReferenceSketchIds, resolveResumableSketch, resolveResumableSketches, resolveVisibleSketchId } from './sketch-visibility.js';

describe('resolveVisibleSketchId', () => {
  it('zachowuje aktywny albo zaznaczony szkic', () => {
    expect(resolveVisibleSketchId({ activeSketchId: 'active', selection: { sketchId: 'selected' } })).toBe('active');
    expect(resolveVisibleSketchId({ selection: { kind: 'profile', sketchId: 'selected' } })).toBe('selected');
  });

  it('pokazuje ostatni szkic po otwarciu lub odzyskaniu projektu bez bryły', () => {
    expect(resolveVisibleSketchId({
      sketches: [{ id: 'sketch-1' }, { id: 'sketch-2' }],
      bodyCount: 0,
    })).toBe('sketch-2');
  });

  it('nie nakłada niezaznaczonego szkicu na istniejącą bryłę', () => {
    expect(resolveVisibleSketchId({ sketches: [{ id: 'sketch-1' }], bodyCount: 1 })).toBeNull();
  });

  it('podczas edycji zachowuje wcześniejsze niepuste szkice jako kontekst', () => {
    expect(resolveReferenceSketchIds({
      activeSketchId: 'sketch-3',
      sketches: [
        { id: 'sketch-1', entities: [{ id: 'line-1', type: 'line' }] },
        { id: 'sketch-2', entities: [{ id: 'point-1', type: 'point' }] },
        { id: 'sketch-3', entities: [{ id: 'line-2', type: 'line' }] },
      ],
    })).toEqual(['sketch-1']);
  });

  it('kontynuuje ostatni szkic na tej samej bazowej płaszczyźnie przed utworzeniem bryły', () => {
    const sketches = [
      { id: 'sketch-xy-old', plane: 'XY', planeOffset: '0' },
      { id: 'sketch-yz', plane: 'YZ', planeOffset: '0' },
      { id: 'sketch-xy-new', plane: 'XY', planeOffset: '0' },
    ];
    expect(resolveResumableSketch({ plane: 'XY', sketches })?.id).toBe('sketch-xy-new');
    expect(resolveResumableSketch({ plane: 'XZ', sketches })).toBeNull();
    expect(resolveResumableSketch({ plane: 'XY', sketches, bodyCount: 1 })).toBeNull();
    expect(resolveResumableSketch({ plane: 'XY', sketches, featureCount: 1 })).toBeNull();
    expect(resolveResumableSketches({ plane: 'XY', sketches }).map((sketch) => sketch.id)).toEqual(['sketch-xy-old', 'sketch-xy-new']);
  });

  it('scala rozdzielone szkice tej samej płaszczyzny i zachowuje zależne dane 2D', () => {
    const document = {
      sketches: [
        { id: 'sketch-old', plane: 'XY', planeOffset: '0', entities: [{ id: 'line-old' }], profiles: [{ id: 'profile-old' }], constraints: [{ id: 'constraint-old' }], dimensions: [{ id: 'dimension-old' }], blockInstances: [{ id: 'block-instance-old' }] },
        { id: 'sketch-yz', plane: 'YZ', planeOffset: '0', entities: [{ id: 'line-yz' }], profiles: [], constraints: [], dimensions: [], blockInstances: [] },
        { id: 'sketch-new', plane: 'XY', planeOffset: '0', entities: [{ id: 'line-new' }], profiles: [{ id: 'profile-new' }], constraints: [{ id: 'constraint-new' }], dimensions: [{ id: 'dimension-new' }], blockInstances: [{ id: 'block-instance-new' }] },
      ],
      features: [],
      bodies: [],
      components: [{ id: 'component-1', sketchIds: ['sketch-old', 'sketch-new', 'sketch-yz'] }],
      drawings: [{ id: 'sheet-1', views: [{ id: 'view-1', sketchId: 'sketch-old' }] }],
    };

    const result = mergeResumableSketches(document, 'XY');

    expect(result).toMatchObject({ sketch: { id: 'sketch-new' }, mergedCount: 1, mergedSketchIds: ['sketch-old'] });
    expect(document.sketches.map((sketch) => sketch.id)).toEqual(['sketch-yz', 'sketch-new']);
    expect(result.sketch.entities.map((entity) => entity.id)).toEqual(['line-old', 'line-new']);
    expect(result.sketch.constraints.map((constraint) => constraint.id)).toEqual(['constraint-old', 'constraint-new']);
    expect(result.sketch.dimensions.map((dimension) => dimension.id)).toEqual(['dimension-old', 'dimension-new']);
    expect(result.sketch.blockInstances.map((instance) => instance.id)).toEqual(['block-instance-old', 'block-instance-new']);
    expect(result.sketch.profiles).toEqual([]);
    expect(document.components[0].sketchIds).toEqual(['sketch-new', 'sketch-yz']);
    expect(document.drawings[0].views[0].sketchId).toBe('sketch-new');
  });

  it('nie scala szkiców użytych już przez historię modelu', () => {
    const document = {
      sketches: [{ id: 'sketch-1', plane: 'XY', entities: [] }, { id: 'sketch-2', plane: 'XY', entities: [] }],
      features: [{ id: 'feature-1' }],
      bodies: [],
    };
    expect(mergeResumableSketches(document, 'XY')).toEqual({ sketch: null, mergedCount: 0, mergedSketchIds: [] });
    expect(document.sketches).toHaveLength(2);
  });
});
