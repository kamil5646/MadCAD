import { describe, expect, it } from 'vitest';
import { calculateSolidFea, createSolidFeaMesh } from './solid-fea.js';

function boxBody(length = 40, width = 10, height = 10) {
  const vertices = [0, 0, 0, length, 0, 0, length, width, 0, 0, width, 0, 0, 0, height, length, 0, height, length, width, height, 0, width, height];
  const triangles = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
  return { id: 'box', bodyKind: 'solid', vertices, triangles, faceGroups: [{ topologyId: 'bottom', start: 0, count: 6 }, { topologyId: 'top', start: 6, count: 6 }, { topologyId: 'front', start: 12, count: 6 }, { topologyId: 'x-max', start: 18, count: 6 }, { topologyId: 'back', start: 24, count: 6 }, { topologyId: 'x-min', start: 30, count: 6 }], metrics: { bounds: [[0, 0, 0], [length, width, height]], volume: length * width * height } };
}

describe('solid 3D finite elements', () => {
  it('creates a conforming tetrahedral volume mesh for a closed box', () => {
    const mesh = createSolidFeaMesh(boxBody(), 4);
    expect(mesh.cellCounts).toEqual([4, 2, 2]);
    expect(mesh.tetrahedra).toHaveLength(96);
    expect(mesh.nodes).toHaveLength(45);
  });

  it('solves a restrained solid and returns displacement and von Mises stress', () => {
    const result = calculateSolidFea(boxBody(), { materialId: 's235', supportAxis: 'x', supportSide: 'min', loadAxis: 'z', loadSide: 'max', force: 1000, meshDensity: 6 });
    expect(result.nodeCount).toBeGreaterThan(20);
    expect(result.elementCount).toBeGreaterThan(20);
    expect(result.fixedNodeCount).toBeGreaterThanOrEqual(4);
    expect(result.loadedNodeCount).toBeGreaterThanOrEqual(4);
    expect(result.maximumDisplacement).toBeGreaterThan(0);
    expect(result.maximumStress).toBeGreaterThan(0);
    expect(result.meshVolume).toBeCloseTo(4000, 6);
    expect(result.volumeErrorPercent).toBeCloseTo(0, 8);
    expect(result.nodes.filter((node) => node.fixed).every((node) => node.magnitude === 0)).toBe(true);
    expect(result.residualNorm).toBeLessThan(1e-3);
    expect(result.supportReaction[2]).toBeCloseTo(1000, 4);
    expect(result.equilibriumErrorPercent).toBeLessThan(1e-4);
    expect(result.convergence.comparisonDensity).toBe(5);
    expect(result.convergence.displacementChangePercent).toBeGreaterThanOrEqual(0);
    expect(result.verification.benchmarkVersion).toBe('2026-09-09');
    expect(result.verification.checks.equilibrium).toBe(true);
    expect(['verified', 'review']).toContain(result.verification.status);
  });

  it('matches the analytical axial response of a prismatic bar within the coarse-mesh tolerance', () => {
    const result = calculateSolidFea(boxBody(), { materialId: 's235', supportAxis: 'x', loadAxis: 'x', force: 1000, meshDensity: 6 });
    const analyticalDisplacement = 1000 * 40 / (210000 * 100);
    expect(Math.abs(result.maximumDisplacement - analyticalDisplacement) / analyticalDisplacement).toBeLessThan(0.05);
    expect(Math.abs(result.maximumStress - 10) / 10).toBeLessThan(0.07);
    expect(result.equilibriumErrorPercent).toBeLessThan(1e-4);
  });

  it('uses exact selected topology faces for support and surface load', () => {
    const result = calculateSolidFea(boxBody(), { materialId: 's235', supportFaceId: 'x-min', loadFaceId: 'x-max', supportAxis: 'z', loadAxis: 'x', force: 1000, meshDensity: 5 });
    expect(result.supportFaceId).toBe('x-min');
    expect(result.loadFaceId).toBe('x-max');
    expect(result.fixedNodeCount).toBeGreaterThanOrEqual(9);
    expect(result.loadedNodeCount).toBeGreaterThanOrEqual(9);
    expect(result.supportReaction[0]).toBeCloseTo(1000, 4);
  });

  it('rejects an unsupported or under-resolved model instead of returning invented results', () => {
    expect(() => calculateSolidFea({ bodyKind: 'surface' })).toThrow(/powierzchni/);
    expect(() => createSolidFeaMesh(boxBody(), 1)).toThrow(/od 2 do 16/);
    expect(() => createSolidFeaMesh(boxBody(), 17)).toThrow(/od 2 do 16/);
  });
});
