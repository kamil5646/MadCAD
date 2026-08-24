import { describe, expect, it } from 'vitest';
import { createFeature, createStarterDocument, validateDocument } from './document.js';
import { FEATURE_STATUS, prepareDocument } from './evaluator.js';
import {
  createTimelineFeatureGroup,
  deleteTimelineFeatureGroup,
  deleteTimelineFeatureCascade,
  dependentTimelineFeatureIds,
  insertTimelineFeature,
  moveTimelineFeature,
  renameTimelineFeature,
  setTimelineRollback,
  setTimelineFeatureSuppressed,
  updateTimelineFeatureGroup,
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

  it('rolls the evaluated history back and inserts the next feature at the marker', () => {
    const document = createStarterDocument();
    const [base, hole] = document.features;
    const tail = createFeature('primitive', { primitiveType: 'box', width: 10, depth: 10, height: 10 });
    document.features.push(tail);

    expect(setTimelineRollback(document, base.id)).toBe(0);
    expect(prepareDocument(document).features.map((feature) => feature.status)).toEqual([
      'ready',
      FEATURE_STATUS.ROLLED_BACK,
      FEATURE_STATUS.ROLLED_BACK,
    ]);

    const inserted = createFeature('primitive', { primitiveType: 'cylinder', radius: 5, height: 10 });
    expect(insertTimelineFeature(document, inserted)).toMatchObject({ feature: inserted, index: 1 });
    expect(document.features.map((feature) => feature.id)).toEqual([base.id, inserted.id, hole.id, tail.id]);
    expect(document.timelineRollbackFeatureId).toBe(inserted.id);
    expect(prepareDocument(document).features.map((feature) => feature.status)).toEqual([
      'ready',
      'ready',
      FEATURE_STATUS.ROLLED_BACK,
      FEATURE_STATUS.ROLLED_BACK,
    ]);
  });

  it('creates contiguous groups, treats their end as rollback boundary, and ungroups without deleting features', () => {
    const document = createStarterDocument();
    const [base, hole] = document.features;
    setTimelineRollback(document, base.id);
    const group = createTimelineFeatureGroup(document, [hole.id, base.id], 'Korpus');
    expect(group).toMatchObject({ name: 'Korpus', featureIds: [base.id, hole.id], collapsed: false });
    expect(document.timelineRollbackFeatureId).toBe(hole.id);
    expect(() => createTimelineFeatureGroup(document, [base.id], 'Druga')).toThrow(/należy już/);
    expect(moveTimelineFeature(document, hole.id, -1).ok).toBe(false);

    updateTimelineFeatureGroup(document, group.id, { name: '  Korpus główny  ', collapsed: true });
    expect(group).toMatchObject({ name: 'Korpus główny', collapsed: true });
    expect(setTimelineRollback(document, base.id)).toBe(1);
    expect(document.timelineRollbackFeatureId).toBe(hole.id);
    document.timelineRollbackFeatureId = base.id;
    expect(validateDocument(document).issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'timelineRollbackFeatureId', code: 'VALUE' })]));
    setTimelineRollback(document, base.id);

    const inserted = createFeature('primitive', { primitiveType: 'box', width: 10, depth: 10, height: 10 });
    expect(insertTimelineFeature(document, inserted).index).toBe(2);
    expect(group.featureIds).toEqual([base.id, hole.id]);
    expect(deleteTimelineFeatureGroup(document, group.id)).toEqual(group);
    expect(document.featureGroups).toEqual([]);
    expect(document.features).toHaveLength(3);
  });

  it('cleans groups and moves a deleted rollback marker to the preceding surviving feature', () => {
    const document = createStarterDocument();
    const independent = createFeature('primitive', { primitiveType: 'box' });
    document.features.push(independent);
    const [base, hole] = document.features;
    createTimelineFeatureGroup(document, [base.id, hole.id], 'Korpus');
    setTimelineRollback(document, hole.id);

    deleteTimelineFeatureCascade(document, base.id);
    expect(document.features.map((feature) => feature.id)).toEqual([independent.id]);
    expect(document.featureGroups).toEqual([]);
    expect(document.timelineRollbackFeatureId).toBe('');
  });
});
