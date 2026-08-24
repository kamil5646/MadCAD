import { describe, expect, it } from 'vitest';
import {
  ISO_METRIC_THREAD_SIZES,
  applyHoleStandard,
  metricTapDrillDiameter,
  validateHoleStandard,
} from './hole-standards.js';

describe('standard metric holes and threads', () => {
  it('contains deterministic common ISO metric sizes without duplicate designations', () => {
    expect(ISO_METRIC_THREAD_SIZES).toHaveLength(16);
    expect(new Set(ISO_METRIC_THREAD_SIZES.map((size) => size.id)).size).toBe(16);
    expect(ISO_METRIC_THREAD_SIZES.find((size) => size.id === 'M8')).toMatchObject({ nominalDiameter: 8, coarsePitch: 1.25, clearance: { fine: 8.4, medium: 9, coarse: 10 } });
  });

  it('applies close, normal and large ISO 273 clearance series', () => {
    expect(applyHoleStandard({}, 'clearance-fine', 'M8')).toMatchObject({ holeStandard: 'iso-273', standardSize: 'M8', clearanceClass: 'fine', diameter: '8.4', threadMode: 'none' });
    expect(applyHoleStandard({}, 'clearance-medium', 'M8').diameter).toBe('9');
    expect(applyHoleStandard({}, 'clearance-coarse', 'M8').diameter).toBe('10');
  });

  it('derives a tap drill and designation from nominal diameter and selected pitch', () => {
    expect(metricTapDrillDiameter('M8', 1.25)).toBe(6.75);
    expect(applyHoleStandard({ threadMode: 'none' }, 'tapped', 'M8')).toMatchObject({ holeStandard: 'iso-metric', standardSize: 'M8', diameter: '6.75', threadMode: 'cosmetic', threadDiameter: '8', threadPitch: '1.25', threadClass: '6H', threadDesignation: 'M8×1.25' });
    expect(applyHoleStandard({ threadMode: 'modeled', threadClass: '5H' }, 'tapped', 'M8', 1)).toMatchObject({ diameter: '7', threadMode: 'modeled', threadPitch: '1', threadClass: '5H', threadDesignation: 'M8×1' });
  });

  it('rejects inconsistent standard metadata while leaving custom holes unrestricted', () => {
    expect(validateHoleStandard({ holeStandard: 'custom' })).toEqual([]);
    expect(validateHoleStandard({ holeStandard: 'iso-metric', holeApplication: 'tapped', standardSize: 'M8', diameter: '6.8', threadDiameter: '8', threadPitch: '0.8', threadClass: '4H', threadDesignation: 'M8×1' }).map((error) => error.field)).toEqual(['threadClass', 'threadPitch']);
    expect(validateHoleStandard({ holeStandard: 'iso-metric', holeApplication: 'tapped', standardSize: 'M8', diameter: '6.75', threadDiameter: '8', threadPitch: '1.25', threadClass: '6H', threadDesignation: 'M8×1' }).map((error) => error.field)).toEqual(['threadDesignation']);
    expect(validateHoleStandard({ holeStandard: 'iso-273', holeApplication: 'clearance', standardSize: 'M8', clearanceClass: 'medium', diameter: '8.5' }).map((error) => error.field)).toEqual(['diameter']);
    expect(() => applyHoleStandard({}, 'clearance-unknown', 'M8')).toThrow(/seria/);
  });
});
