import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectModelImportBuffer, parseStlMesh } from './model-import.js';
import { parseSketchImport } from './sketch-import.js';

const fixturePath = (name) => path.join(process.cwd(), 'tests', 'fixtures', 'external', name);

describe('external CAD and slicer compatibility fixtures', () => {
  it.each([
    ['autocad-2013-rectangle.dxf', 5, 1],
    ['fusion-sketch-mm.dxf', 4, 1],
  ])('imports %s with millimeter geometry and a closed profile', async (file, curves, profiles) => {
    const imported = parseSketchImport(await readFile(fixturePath(file), 'utf8'), 'dxf');
    expect(imported.sourceUnit).toBe('millimeter');
    expect(imported.curveCount).toBe(curves);
    expect(imported.profiles).toHaveLength(profiles);
  });

  it('accepts the documented FreeCAD/OpenCascade STEP envelope as exact CAD', async () => {
    const bytes = await readFile(fixturePath('freecad-step-envelope.step'));
    expect(inspectModelImportBuffer(bytes, 'step')).toMatchObject({ format: 'step', importMode: 'brep' });
  });

  it('accepts an ASCII STL compatible with PrusaSlicer, Cura and Bambu Studio', async () => {
    const bytes = await readFile(fixturePath('slicer-tetrahedron-ascii.stl'));
    expect(inspectModelImportBuffer(bytes, 'stl')).toMatchObject({ format: 'stl', importMode: 'mesh' });
    const mesh = parseStlMesh(bytes);
    expect(mesh.triangles).toHaveLength(12);
    expect(Math.max(...mesh.vertices)).toBe(20);
  });
});
