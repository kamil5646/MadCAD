import { describe, expect, it } from 'vitest';
import { movedSupportFaceIndex, stretchedEdgeIndex, translatedFaceIndex } from './topology-fallback.js';

const plane = (center, normal, area) => ({ geometry: 'PLANE', center, normal, area });
const line = (first, second) => ({ geometry: 'LINE', endpoints: [first, second], length: Math.hypot(...second.map((value, axis) => value - first[axis])) });

describe('translatedFaceIndex', () => {
  const top = plane([22, -38, 40], [0, 0, 1], 812);

  it('follows the top face of an extrude whose height changed', () => {
    const faces = [plane([22, -38, 0], [0, 0, -1], 812), plane([22, -38, 50], [0, 0, 1], 812), plane([8, -38, 25], [-1, 0, 0], 1450)];
    expect(translatedFaceIndex(top, faces)).toBe(1);
  });

  it('refuses an in-plane shift, a different area or a flipped normal', () => {
    expect(translatedFaceIndex(top, [plane([23, -38, 50], [0, 0, 1], 812)])).toBe(-1);
    expect(translatedFaceIndex(top, [plane([22, -38, 50], [0, 0, 1], 900)])).toBe(-1);
    expect(translatedFaceIndex(top, [plane([22, -38, 50], [0, 0, -1], 812)])).toBe(-1);
  });

  it('refuses to guess between two stacked candidates', () => {
    expect(translatedFaceIndex(top, [plane([22, -38, 50], [0, 0, 1], 812), plane([22, -38, 60], [0, 0, 1], 812)])).toBe(-1);
  });

  it('follows a cylinder that slid along its axis', () => {
    const hole = { geometry: 'CYLINDRE', axisOrigin: [5, 5, 30], axisDirection: [0, 0, 1], radius: 3 };
    expect(translatedFaceIndex(hole, [{ ...hole, axisOrigin: [5, 5, 40] }])).toBe(0);
    expect(translatedFaceIndex(hole, [{ ...hole, axisOrigin: [6, 5, 40] }])).toBe(-1);
    expect(translatedFaceIndex(hole, [{ ...hole, axisOrigin: [5, 5, 40], radius: 4 }])).toBe(-1);
  });
});

describe('stretchedEdgeIndex', () => {
  const vertical = line([36, -53, 0], [36, -53, 30]);

  it('follows a vertical box edge that grew from its base', () => {
    const edges = [line([8, -53, 0], [8, -53, 40]), line([36, -53, 0], [36, -53, 40]), line([8, -53, 40], [36, -53, 40])];
    expect(stretchedEdgeIndex(vertical, edges)).toBe(1);
  });

  it('refuses edges that share no endpoint or leave the line', () => {
    expect(stretchedEdgeIndex(vertical, [line([36, -53, 5], [36, -53, 40])])).toBe(-1);
    expect(stretchedEdgeIndex(vertical, [line([36, -53, 0], [36, -50, 40])])).toBe(-1);
  });

  it('ignores curved references', () => {
    expect(stretchedEdgeIndex({ geometry: 'CIRCLE', endpoints: [[0, 0, 0], [0, 0, 0]] }, [line([0, 0, 0], [0, 0, 1])])).toBe(-1);
  });
});

describe('movedSupportFaceIndex', () => {
  const support = plane([22, -38, 30], [0, 0, 1], 812);

  it('tolerates a hole cut into the moved face', () => {
    const faces = [plane([-56, 1, 10], [0, 0, 1], 2400), plane([21.4, -38.3, 40], [0, 0, 1], 740)];
    expect(movedSupportFaceIndex(support, faces)).toBe(1);
  });

  it('refuses two equally close faces and respects excluded faces', () => {
    const faces = [plane([22, -38, 40], [0, 0, 1], 812), plane([22, -38, 10], [0, 0, 1], 812)];
    expect(movedSupportFaceIndex(support, faces)).toBe(-1);
    expect(movedSupportFaceIndex(support, faces, new Set([1]))).toBe(0);
  });
});
