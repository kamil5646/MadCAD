import { describe, expect, it } from 'vitest';
import { moveEndFaceSketchSupports, placeSketchesOnReassignedFace } from './face-sketch-support.js';

function fixture() {
  return {
    parameters: [],
    features: [{ id: 'base', type: 'extrude', operation: 'new', extent: 'one-side', sketchId: 'source', startOffset: '0', distance: '15' }],
    sketches: [
      { id: 'source', plane: 'XY', planeOffset: '0' },
      { id: 'dependent', plane: 'XY', planeOffset: '15', support: { kind: 'face', referenceId: 'top' } },
    ],
    references: [{ id: 'top', sourceFeatureId: 'base', descriptor: { geometry: 'PLANE', normal: [0, 0, 1], center: [0, 0, 15], centerOfMass: [0, 0, 15] } }],
  };
}

describe('face-supported sketch tracking', () => {
  it('moves the end-face sketch and its reference with the source extrusion in one transaction', () => {
    const previous = fixture();
    const next = structuredClone(previous);
    next.features[0].distance = '20';
    expect(moveEndFaceSketchSupports(previous, next)).toBe(1);
    expect(next.sketches[1].planeOffset).toBe('20');
    expect(next.references[0].descriptor.center).toEqual([0, 0, 20]);
    expect(next.references[0].descriptor.centerOfMass).toEqual([0, 0, 20]);
    expect(previous.sketches[1].planeOffset).toBe('15');
  });

  it('does not move a side face when only the extrusion length changes', () => {
    const previous = fixture();
    previous.references[0].descriptor.normal = [1, 0, 0];
    const next = structuredClone(previous);
    next.features[0].distance = '20';
    expect(moveEndFaceSketchSupports(previous, next)).toBe(0);
    expect(next.sketches[1].planeOffset).toBe('15');
  });

  it('updates the sketch plane when a lost face reference is reassigned', () => {
    const document = fixture();
    expect(placeSketchesOnReassignedFace(document, 'top', { geometry: 'PLANE', center: [0, 0, 20], normal: [0, 0, 1] })).toBe(1);
    expect(document.sketches[1].planeOffset).toBe('20');
    expect(document.sketches[1].plane).toBe('XY');
    expect(document.sketches[0].planeOffset).toBe('0');
  });
});
