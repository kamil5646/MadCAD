import { describe, expect, it } from 'vitest';
import { inspectTopologyReferences, rebindMovedFaceSupportReferences, reassignTopologyReference } from './topology-references.js';

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

  it('leaves the reference lost when the support did not follow the face', () => {
    const { document, bodies } = moved();
    document.references[0].descriptor.center = [25, 0, 7.5];
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual([]);
    expect(document.references[0].topologyId).toBe('face-1');
  });

  it('does not guess between two matching faces or steal a claimed face', () => {
    const { document, bodies } = moved();
    bodies[0].topology.faces.push({ id: 'face-twin', descriptor: { geometry: 'PLANE', center: [30, 0, 7.5], normal: [1, 0, 0], area: 10 } });
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual([]);

    bodies[0].topology.faces.pop();
    document.references.push({ id: 'other', kind: 'topology', topologyKind: 'face', topologyId: 'face-moved', bodyId: 'body-1', descriptor: null });
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual([]);
  });

  it('ignores references that no sketch uses as support', () => {
    const { document, bodies } = moved();
    document.sketches = [];
    expect(rebindMovedFaceSupportReferences(document, bodies)).toEqual([]);
  });
});
