import { describe, expect, it } from 'vitest';
import { inspectTopologyReferences, rebindMovedFaceSupportReferences, reassignTopologyReference } from './topology-references.js';

const follow = (document) => ({ followMovedIds: new Set(document.references.map((reference) => reference.id)) });

function fixture() {
  const descriptor = { geometry: 'PLANE', center: [25, 0, 7.5], normal: [1, 0, 0], area: 360 };
  return {
    document: {
      features: [{ id: 'base', name: 'Wyciągnięcie' }],
      sketches: [{ id: 'side', support: { kind: 'face', referenceId: 'support' } }],
      references: [{ id: 'support', kind: 'topology', topologyKind: 'face', topologyId: 'face-1', bodyId: 'body-1', sourceFeatureId: 'base', descriptor }],
    },
    bodies: [{ id: 'body-1', topology: { faces: [{ id: 'face-1', descriptor: structuredClone(descriptor) }] } }],
  };
}

describe('face sketch reference inspection', () => {
  it('flags a moved plane even when the face keeps its topology ID', () => {
    const { document, bodies } = fixture();
    bodies[0].topology.faces[0].descriptor.center[0] = 30;

    const [state] = inspectTopologyReferences(document, bodies);
    expect(state.status).toBe('lost');
    expect(state.reason).toContain('zachowała ID');
    expect(state.candidates[0].id).toBe('face-1');

    document.references[0] = reassignTopologyReference(document.references[0], state.candidates[0], state.candidates[0].descriptor);
    expect(inspectTopologyReferences(document, bodies)[0].status).toBe('resolved');
  });

  it('does not flag tangential center movement on the same plane', () => {
    const { document, bodies } = fixture();
    bodies[0].topology.faces[0].descriptor.center[1] = 3;
    expect(inspectTopologyReferences(document, bodies)[0].status).toBe('resolved');
  });

  it('flags rotated support planes but leaves unrelated topology references alone', () => {
    const { document, bodies } = fixture();
    bodies[0].topology.faces[0].descriptor.normal = [0, 1, 0];
    expect(inspectTopologyReferences(document, bodies)[0].status).toBe('lost');

    document.sketches[0].support = null;
    expect(inspectTopologyReferences(document, bodies)[0].status).toBe('resolved');
  });
});

describe('rebinding moved face support references', () => {
  function moved() {
    const { document, bodies } = fixture();
    document.references[0].descriptor.center = [30, 0, 7.5];
    bodies[0].topology.faces = [{ id: 'face-moved', descriptor: { geometry: 'PLANE', center: [30, 0, 7.5], normal: [1, 0, 0], area: 432 } }];
    return { document, bodies };
  }

  it('rebinds a tracked support to the single rebuilt coplanar face', () => {
    const { document, bodies } = moved();
    expect(inspectTopologyReferences(document, bodies)[0].status).toBe('lost');
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual(['support']);
    expect(document.references[0].topologyId).toBe('face-moved');
    expect(inspectTopologyReferences(document, bodies)[0].status).toBe('resolved');
  });

  it('leaves the reference lost when the moved face is not parallel to the sketch', () => {
    const { document, bodies } = moved();
    document.references[0].descriptor.center = [25, 0, 7.5];
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual([]);
    expect(document.references[0].topologyId).toBe('face-1');
  });

  it('moves the sketch with a face that slid along its normal after an upstream edit', () => {
    const { document, bodies } = moved();
    document.sketches[0].plane = 'YZ';
    document.sketches[0].planeOffset = '25';
    document.references[0].descriptor.center = [25, 0, 7.5];
    expect(rebindMovedFaceSupportReferences(structuredClone(document), bodies)).toEqual([]);
    expect(rebindMovedFaceSupportReferences(document, bodies, follow(document))).toEqual(['support']);
    expect(document.references[0].topologyId).toBe('face-moved');
    expect(document.sketches[0].planeOffset).toBe('30');
    expect(inspectTopologyReferences(document, bodies)[0].status).toBe('resolved');
  });

  it('moves every sketch that follows the same moved face', () => {
    const descriptor = { geometry: 'PLANE', center: [0, 0, 30], normal: [0, 0, 1], area: 400 };
    const document = {
      features: [],
      sketches: ['a', 'b'].map((id) => ({ id, plane: 'XY', planeOffset: '30', support: { kind: 'face', referenceId: `r-${id}` } })),
      references: ['a', 'b'].map((id) => ({ id: `r-${id}`, kind: 'topology', topologyKind: 'face', topologyId: 'old', bodyId: 'b', descriptor: structuredClone(descriptor) })),
    };
    const bodies = [{ id: 'b', topology: { faces: [{ id: 'new', descriptor: { ...descriptor, center: [0, 0, 40] } }] } }];
    expect(rebindMovedFaceSupportReferences(document, bodies, follow(document))).toEqual(['r-a', 'r-b']);
    expect(document.sketches.map((sketch) => sketch.planeOffset)).toEqual(['40', '40']);
  });

  it('follows a face moved on a -Y plane and refuses a parametric offset', () => {
    const descriptor = { geometry: 'PLANE', center: [0, -10, 5], normal: [0, -1, 0], area: 100 };
    const make = (planeOffset) => ({
      document: {
        features: [],
        sketches: [{ id: 's', plane: 'XZ', planeOffset, support: { kind: 'face', referenceId: 'r' } }],
        references: [{ id: 'r', kind: 'topology', topologyKind: 'face', topologyId: 'old', bodyId: 'b', descriptor }],
      },
      bodies: [{ id: 'b', topology: { faces: [{ id: 'new', descriptor: { ...descriptor, center: [0, -14, 5], area: 80 } }] } }],
    });
    const numeric = make('10');
    expect(rebindMovedFaceSupportReferences(numeric.document, numeric.bodies, follow(numeric.document))).toEqual(['r']);
    expect(numeric.document.sketches[0].planeOffset).toBe('14');
    const parametric = make('depth');
    expect(rebindMovedFaceSupportReferences(parametric.document, parametric.bodies, follow(parametric.document))).toEqual([]);
  });

  it('does not guess between two matching faces or steal a claimed face', () => {
    const { document, bodies } = moved();
    bodies[0].topology.faces.push({ id: 'face-twin', descriptor: { geometry: 'PLANE', center: [30, 0, 7.5], normal: [1, 0, 0], area: 10 } });
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual([]);

    bodies[0].topology.faces.pop();
    document.references.push({ id: 'other', kind: 'topology', topologyKind: 'face', topologyId: 'face-moved', bodyId: 'body-1', descriptor: null });
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual([]);
  });

  it('rebinds when the rebuilt face only shifted inside its plane, e.g. after a cut through it', () => {
    const { document, bodies } = moved();
    bodies[0].topology.faces[0].descriptor.center = [30, -0.21, 7.8];
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual(['support']);
    expect(document.references[0].topologyId).toBe('face-moved');
  });

  it('picks the nearest of several coplanar faces only when it is clearly nearest', () => {
    const { document, bodies } = moved();
    bodies[0].topology.faces.push({ id: 'face-far', descriptor: { geometry: 'PLANE', center: [30, 20, 7.5], normal: [1, 0, 0], area: 50 } });
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual(['support']);
    expect(document.references[0].topologyId).toBe('face-moved');

    const ambiguous = moved();
    ambiguous.bodies[0].topology.faces[0].descriptor.center = [30, 4, 7.5];
    ambiguous.bodies[0].topology.faces.push({ id: 'face-twin', descriptor: { geometry: 'PLANE', center: [30, -4, 7.5], normal: [1, 0, 0], area: 50 } });
    expect(rebindMovedFaceSupportReferences(ambiguous.document, ambiguous.bodies)).toEqual([]);
  });

  it('ignores references that no sketch uses as support', () => {
    const { document, bodies } = moved();
    document.sketches = [];
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual([]);
  });
});
