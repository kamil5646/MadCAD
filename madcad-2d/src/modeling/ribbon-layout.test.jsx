import { describe, expect, it } from 'vitest';
import { calculateVisibleRibbonGroups } from './ModelingWorkspace.jsx';

describe('responsive ribbon layout', () => {
  it('keeps every regular group visible when all groups fit', () => {
    expect(calculateVisibleRibbonGroups([120, 180, 90], 390, [2])).toEqual({
      visible: [0, 1],
      hidden: [],
    });
  });

  it('reserves space for the sticky group and moves a contiguous tail into overflow', () => {
    expect(calculateVisibleRibbonGroups([180, 220, 160, 92], 520, [3], 78)).toEqual({
      visible: [0],
      hidden: [1, 2],
    });
  });

  it('moves every regular group into overflow when only the sticky action fits', () => {
    expect(calculateVisibleRibbonGroups([240, 180, 92], 260, [2], 78)).toEqual({
      visible: [],
      hidden: [0, 1],
    });
  });
});
