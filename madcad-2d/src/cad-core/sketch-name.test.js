import { describe, expect, it } from 'vitest';
import { nextSketchName } from './document.js';

describe('nextSketchName', () => {
  it('starts at 1 and fills the first free number', () => {
    expect(nextSketchName([])).toBe('Szkic 1');
    expect(nextSketchName([{ name: 'Szkic 1' }, { name: 'Szkic 2' }])).toBe('Szkic 3');
    expect(nextSketchName([{ name: 'Szkic 2' }])).toBe('Szkic 1');
  });

  it('does not reuse the name of a remaining sketch after a deletion', () => {
    const afterDelete = [{ name: 'Szkic 2' }, { name: 'Szkic 3' }];
    expect(nextSketchName(afterDelete)).toBe('Szkic 1');
    expect(nextSketchName([{ name: 'Szkic 1' }, { name: 'Szkic 3' }])).toBe('Szkic 2');
  });

  it('numbers 3D sketches separately from planar ones', () => {
    const sketches = [{ name: 'Szkic 1' }, { name: 'Szkic 3D 1', space: '3d' }];
    expect(nextSketchName(sketches, 'Szkic 3D', '3d')).toBe('Szkic 3D 2');
    expect(nextSketchName(sketches)).toBe('Szkic 2');
  });
});
