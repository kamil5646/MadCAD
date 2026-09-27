import { describe, expect, it } from 'vitest';
import { moveEndFaceSketchSupports, placeSketchesOnReassignedFace } from './face-sketch-support.js';
import { frameFromNormal } from './sketch-frame.js';

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

  it('moves a sketch on an angled extrusion end face with its stable local axes', () => {
    const previous = fixture();
    const normal = [0, -Math.SQRT1_2, Math.SQRT1_2];
    previous.sketches[0].frame = frameFromNormal([2, 3, 4], normal);
    const previousEnd = previous.sketches[0].frame.origin.map((value, index) => value + normal[index] * 15);
    previous.sketches[1].frame = frameFromNormal(previousEnd, normal);
    previous.references[0].descriptor.normal = normal;
    previous.references[0].descriptor.center = previousEnd;
    previous.references[0].descriptor.centerOfMass = previousEnd;
    const next = structuredClone(previous);
    next.features[0].distance = '20';

    expect(moveEndFaceSketchSupports(previous, next)).toBe(1);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(next.sketches[1].frame.origin[axis]).toBeCloseTo(previousEnd[axis] + normal[axis] * 5, 8);
      expect(next.references[0].descriptor.center[axis]).toBeCloseTo(previousEnd[axis] + normal[axis] * 5, 8);
    }
    expect(next.sketches[1].frame.u).toEqual(previous.sketches[1].frame.u);
    expect(next.sketches[1].frame.v).toEqual(previous.sketches[1].frame.v);
  });

  it('moves two sketches sharing one face reference without shifting that reference twice', () => {
    const previous = fixture();
    previous.sketches.push({ id: 'second-dependent', plane: 'XY', planeOffset: '15', support: { kind: 'face', referenceId: 'top' } });
    const next = structuredClone(previous);
    next.features[0].distance = '20';
    expect(moveEndFaceSketchSupports(previous, next)).toBe(2);
    expect(next.sketches[1].planeOffset).toBe('20');
    expect(next.sketches[2].planeOffset).toBe('20');
    expect(next.references[0].descriptor.center).toEqual([0, 0, 20]);
  });

  it('tracks a driving parameter change, not only a literal extrusion edit', () => {
    const previous = fixture();
    previous.parameters = [{ name: 'height', expression: '15' }];
    previous.features[0].distance = 'height';
    const next = structuredClone(previous);
    next.parameters[0].expression = '20';
    expect(moveEndFaceSketchSupports(previous, next)).toBe(1);
    expect(next.sketches[1].planeOffset).toBe('20');
  });

  it('leaves an unrelated or rotated support to geometric reference repair', () => {
    const previous = fixture();
    const next = structuredClone(previous);
    next.features[0].distance = '20';
    previous.references[0].descriptor.center = [0, 0, 0];
    next.references[0].descriptor.center = [0, 0, 0];
    expect(moveEndFaceSketchSupports(previous, next)).toBe(0);
    expect(next.sketches[1].planeOffset).toBe('15');

    const rotated = structuredClone(fixture());
    rotated.features[0].distance = '20';
    rotated.sketches[0].frame = frameFromNormal([0, 0, 0], [0, -Math.SQRT1_2, Math.SQRT1_2]);
    expect(moveEndFaceSketchSupports(fixture(), rotated)).toBe(0);
  });

  it('updates the sketch plane when a lost face reference is reassigned', () => {
    const document = fixture();
    expect(placeSketchesOnReassignedFace(document, 'top', { geometry: 'PLANE', center: [0, 0, 20], normal: [0, 0, 1] })).toBe(1);
    expect(document.sketches[1].planeOffset).toBe('20');
    expect(document.sketches[1].plane).toBe('XY');
    expect(document.sketches[0].planeOffset).toBe('0');
  });
});
