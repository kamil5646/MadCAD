import { describe, expect, it } from 'vitest';
import { moveTrackedFaceSketchSupports, placeSketchesOnReassignedFace } from './face-sketch-support.js';
import { frameFromNormal } from './sketch-frame.js';
import { createAnglePlane, resolveConstructionPlane } from './construction-planes.js';

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
    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(1);
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
    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(0);
    expect(next.sketches[1].planeOffset).toBe('15');
  });

  it('moves a side-face sketch with the matching source-profile edge', () => {
    const previous = fixture();
    previous.sketches[0].entities = [
      { id: 'left-bottom', type: 'point', geometry: { x: '-25', y: '-12' } },
      { id: 'right-bottom', type: 'point', geometry: { x: '25', y: '-12' } },
      { id: 'right-top', type: 'point', geometry: { x: '25', y: '12' } },
      { id: 'left-top', type: 'point', geometry: { x: '-25', y: '12' } },
    ];
    previous.sketches[1].plane = 'YZ';
    previous.sketches[1].planeOffset = '25';
    previous.references[0].descriptor.normal = [1, 0, 0];
    previous.references[0].descriptor.center = [25, 0, 7.5];
    previous.references[0].descriptor.centerOfMass = [25, 0, 7.5];
    const next = structuredClone(previous);
    for (const entity of next.sketches[0].entities) entity.geometry.x = String(Number(entity.geometry.x) * 1.2);

    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(1);
    expect(next.sketches[1].planeOffset).toBe('30');
    expect(next.references[0].descriptor.center).toEqual([30, 0, 7.5]);
    expect(next.references[0].descriptor.centerOfMass).toEqual([30, 0, 7.5]);
  });

  it('does not guess a new side face when its source edge tilts', () => {
    const previous = fixture();
    previous.sketches[0].entities = [
      { id: 'bottom', type: 'point', geometry: { x: '25', y: '-12' } },
      { id: 'top', type: 'point', geometry: { x: '25', y: '12' } },
    ];
    previous.sketches[1].plane = 'YZ';
    previous.sketches[1].planeOffset = '25';
    previous.references[0].descriptor.normal = [1, 0, 0];
    previous.references[0].descriptor.center = [25, 0, 7.5];
    const next = structuredClone(previous);
    next.sketches[0].entities[0].geometry.x = '30';

    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(0);
    expect(next.sketches[1].planeOffset).toBe('25');
  });

  it('moves a shared side-face reference only once', () => {
    const previous = fixture();
    previous.sketches[0].entities = [
      { id: 'bottom', type: 'point', geometry: { x: '25', y: '-12' } },
      { id: 'top', type: 'point', geometry: { x: '25', y: '12' } },
    ];
    previous.sketches[1].plane = 'YZ';
    previous.sketches[1].planeOffset = '25';
    previous.sketches.push({ id: 'second', plane: 'YZ', planeOffset: '25', support: { kind: 'face', referenceId: 'top' } });
    previous.references[0].descriptor.normal = [1, 0, 0];
    previous.references[0].descriptor.center = [25, 0, 7.5];
    const next = structuredClone(previous);
    for (const entity of next.sketches[0].entities) entity.geometry.x = '30';

    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(2);
    expect(next.sketches[1].planeOffset).toBe('30');
    expect(next.sketches[2].planeOffset).toBe('30');
    expect(next.references[0].descriptor.center).toEqual([30, 0, 7.5]);
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

    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(1);
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
    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(2);
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
    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(1);
    expect(next.sketches[1].planeOffset).toBe('20');
  });

  it('leaves an unrelated support to geometric reference repair', () => {
    const previous = fixture();
    const next = structuredClone(previous);
    next.features[0].distance = '20';
    previous.references[0].descriptor.center = [0, 0, 0];
    next.references[0].descriptor.center = [0, 0, 0];
    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(0);
    expect(next.sketches[1].planeOffset).toBe('15');

  });

  it('rotates an end-face sketch and its reference with the source sketch frame', () => {
    const previous = fixture();
    const next = structuredClone(previous);
    const normal = [0, -Math.SQRT1_2, Math.SQRT1_2];
    next.sketches[0].frame = frameFromNormal([0, 0, 0], normal);
    next.features[0].distance = '20';

    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(1);
    expect(next.sketches[1].frame.normal[1]).toBeCloseTo(normal[1], 8);
    expect(next.sketches[1].frame.normal[2]).toBeCloseTo(normal[2], 8);
    expect(next.sketches[1].frame.origin[1]).toBeCloseTo(normal[1] * 20, 8);
    expect(next.sketches[1].frame.origin[2]).toBeCloseTo(normal[2] * 20, 8);
    expect(next.references[0].descriptor.normal[1]).toBeCloseTo(normal[1], 8);
    expect(next.references[0].descriptor.center).toEqual(next.sketches[1].frame.origin);
  });

  it('follows an edited angled construction plane', () => {
    const previous = fixture();
    const plane = createAnglePlane({ angle: '30', offset: '0' });
    const firstFrame = resolveConstructionPlane(plane);
    const firstEnd = firstFrame.origin.map((value, axis) => value + firstFrame.normal[axis] * 15);
    previous.references.push(plane);
    previous.sketches[0].support = { kind: 'construction-plane', referenceId: plane.id };
    previous.sketches[1].frame = frameFromNormal(firstEnd, firstFrame.normal);
    previous.references[0].descriptor.normal = firstFrame.normal;
    previous.references[0].descriptor.center = firstEnd;
    previous.references[0].descriptor.centerOfMass = firstEnd;
    const next = structuredClone(previous);
    next.references[1].angle = '60';
    const finalFrame = resolveConstructionPlane(next.references[1]);
    const finalEnd = finalFrame.origin.map((value, axis) => value + finalFrame.normal[axis] * 15);

    expect(moveTrackedFaceSketchSupports(previous, next)).toBe(1);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(next.sketches[1].frame.origin[axis]).toBeCloseTo(finalEnd[axis], 8);
      expect(next.sketches[1].frame.normal[axis]).toBeCloseTo(finalFrame.normal[axis], 8);
      expect(next.references[0].descriptor.center[axis]).toBeCloseTo(finalEnd[axis], 8);
    }
    expect(next.sketches[1].support).toEqual(previous.sketches[1].support);
  });

  it('updates the sketch plane when a lost face reference is reassigned', () => {
    const document = fixture();
    expect(placeSketchesOnReassignedFace(document, 'top', { geometry: 'PLANE', center: [0, 0, 20], normal: [0, 0, 1] })).toBe(1);
    expect(document.sketches[1].planeOffset).toBe('20');
    expect(document.sketches[1].plane).toBe('XY');
    expect(document.sketches[0].planeOffset).toBe('0');
  });
});
