import { describe, expect, it } from 'vitest';
import { createFeature, createStarterDocument } from './document.js';
import {
  deleteTimelineFeatureCascade,
  dependentTimelineFeatureIds,
  moveTimelineFeature,
  renameTimelineFeature,
  setTimelineFeatureSuppressed,
} from './timeline-operations.js';

describe('timeline operations', () => {
  it('prevents moving a dependent feature before its body producer', () => {
    const document = createStarterDocument();
    const result = moveTimelineFeature(document, document.features[1].id, -1);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('brył');
  });

  it('moves independent features and keeps the source immutable', () => {
    const document = createStarterDocument();
    const primitive = createFeature('primitive', { primitiveType: 'box' });
    document.features.push(primitive);
    const result = moveTimelineFeature(document, primitive.id, -1);
    expect(result.ok).toBe(true);
    expect(result.features[1].id).toBe(primitive.id);
    expect(document.features[2].id).toBe(primitive.id);
  });

  it('finds and removes downstream features together with owned references', () => {
    const document = createStarterDocument();
    const [base, hole] = document.features;
    document.components.push({ id: 'component-1', name: 'Korpus', type: 'part', partNumber: 'P-1', description: '', material: '', quantity: 1, origin: { x: 0, y: 0, z: 0 }, bodyIds: [`body-${base.id}`], sketchIds: [], componentIds: [] });
    document.references.push({ id: 'reference-base-face', kind: 'topology', topologyKind: 'face', topologyId: 'face-1', bodyId: `body-${base.id}`, ownerFeatureId: base.id });
    expect(dependentTimelineFeatureIds(document, base.id)).toEqual([base.id, hole.id]);
    const result = deleteTimelineFeatureCascade(document, base.id);
    expect(result.deletedFeatureIds).toEqual([base.id, hole.id]);
    expect(result.deletedReferenceIds).toEqual(['reference-base-face']);
    expect(result.deletedBodyIds).toEqual([`body-${base.id}`, `body-${hole.id}`]);
    expect(document.components[0].bodyIds).toEqual([]);
    expect(document.features).toHaveLength(0);
    expect(document.references).toHaveLength(0);
  });

  it('renames and suppresses features', () => {
    const document = createStarterDocument();
    const featureId = document.features[0].id;
    expect(renameTimelineFeature(document, featureId, '  Korpus   główny  ')).toBe(true);
    expect(setTimelineFeatureSuppressed(document, featureId, true)).toBe(true);
    expect(document.features[0]).toMatchObject({ name: 'Korpus główny', suppressed: true });
  });
});
