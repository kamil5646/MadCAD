import { describe, expect, it } from 'vitest';
import { createSolidFeaBenchmarkBox, createSolidFeaHolePlate, runSolidFeaBenchmarks } from './solid-fea-benchmarks.js';

describe('independent solid FEA benchmarks', () => {
  it('uses a closed analytical prism with stable topology faces', () => {
    const body = createSolidFeaBenchmarkBox(80, 20, 15);
    expect(body.metrics.volume).toBe(24000);
    expect(body.faceGroups.map((face) => face.topologyId)).toEqual(['z-min', 'z-max', 'y-min', 'x-max', 'y-max', 'x-min']);
  });

  it('builds a closed plate with a resolved central hole', () => {
    const body = createSolidFeaHolePlate();
    expect(body.metrics.volume).toBeCloseTo((60 * 30 - Math.PI * 25) * 6, 8);
    expect(body.triangles).toHaveLength(48 * 24);
  });

  it('passes analytical axial, cantilever, scaling, equilibrium and support gates', () => {
    const report = runSolidFeaBenchmarks();
    expect(report.passed, JSON.stringify(report.checks, null, 2)).toBe(true);
    expect(report.checks).toHaveLength(14);
    expect(report.axial.errors.displacementPercent).toBeLessThan(2);
    expect(report.bending.errors.displacementPercent).toBeLessThan(12);
    expect(report.hole.stressErrorPercent).toBeLessThan(25);
    expect(report.hole.volumeImprovementPercent).toBeGreaterThan(80);
    expect(report.hole.adaptiveStress).toBeGreaterThan(report.hole.uniformStress);
  }, 15000);
});
