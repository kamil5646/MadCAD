import { describe, expect, it } from 'vitest';
import {
  BSPT_THREAD_SIZES,
  ISO_METRIC_THREAD_SIZES,
  NPT_THREAD_SIZES,
  applyHoleStandard,
  metricTapDrillDiameter,
  validateHoleStandard,
} from './hole-standards.js';

describe('standard metric holes and threads', () => {
  it('contains deterministic common ISO metric sizes without duplicate designations', () => {
    expect(ISO_METRIC_THREAD_SIZES).toHaveLength(38);
    expect(new Set(ISO_METRIC_THREAD_SIZES.map((size) => size.id)).size).toBe(38);
    expect(ISO_METRIC_THREAD_SIZES.find((size) => size.id === 'M8')).toMatchObject({ nominalDiameter: 8, coarsePitch: 1.25, clearance: { fine: 8.4, medium: 9, coarse: 10 } });
    expect(ISO_METRIC_THREAD_SIZES.at(0)).toMatchObject({ id: 'M1', coarsePitch: 0.25 });
    expect(ISO_METRIC_THREAD_SIZES.at(-1)).toMatchObject({ id: 'M56', coarsePitch: 5.5 });
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

  it('applies NPT and BSPT internal tapered pipe-thread presets', () => {
    expect(NPT_THREAD_SIZES).toHaveLength(12);
    expect(BSPT_THREAD_SIZES).toHaveLength(11);
    const npt = applyHoleStandard({}, 'npt-tapped', 'npt-1-8');
    expect(npt).toMatchObject({ holeStandard: 'asme-b1.20.1', standardSize: 'npt-1-8', diameter: '8.74', depth: '10.8', threadLength: '9.32', threadDiameter: '10.24', threadPitch: '0.940741', threadTaper: '0.0625', threadProfileAngle: '60', threadDesignation: '1/8-27 NPT', extent: 'distance' });
    expect(validateHoleStandard(npt)).toEqual([]);
    const bspt = applyHoleStandard({}, 'bspt-tapped', 'bspt-3-4');
    expect(bspt).toMatchObject({ holeStandard: 'iso-7-1', diameter: '23.8', threadPitch: '1.814286', threadProfileAngle: '55', threadDesignation: 'Rc 3/4' });
    expect(validateHoleStandard(bspt)).toEqual([]);
    expect(validateHoleStandard({ ...npt, threadTaper: '0', diameter: '8.4' }).map((error) => error.field)).toEqual(['diameter', 'threadTaper']);
  });

  it('accepts a complete explicit manufacturing tolerance and rejects a partial or inverted pair', () => {
    expect(validateHoleStandard({ holeStandard: 'custom', diameterToleranceLower: '-0.05', diameterToleranceUpper: '0.1' })).toEqual([]);
    expect(validateHoleStandard({ holeStandard: 'custom', diameterToleranceLower: '-0.05' }).map((error) => error.field)).toEqual(['diameterToleranceUpper']);
    expect(validateHoleStandard({ holeStandard: 'custom', diameterToleranceLower: '0.1', diameterToleranceUpper: '-0.1' }).map((error) => error.field)).toEqual(['diameterToleranceLower']);
  });
});
