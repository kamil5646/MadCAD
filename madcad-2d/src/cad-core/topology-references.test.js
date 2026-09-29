import { describe, expect, it } from 'vitest';
import { inspectTopologyReferences, reassignTopologyReference } from './topology-references.js';

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
