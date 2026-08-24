import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectModelImportBuffer, parseStlMesh } from './model-import.js';
import { parseSketchImport } from './sketch-import.js';
import { inspectThreeMfArchive } from './three-mf.js';

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

  it('reads the production-extension 3MF emitted by Bambu Studio 2.8.2', async () => {
    const encoded = await readFile(fixturePath('bambu-studio-2.8.2-tetrahedron.3mf.b64'), 'utf8');
    const bytes = Buffer.from(encoded.replace(/\s+/g, ''), 'base64');
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe('56af580d355b7c3f27922cbfa8e1f38c63d671c43f5a9831aed2646eba7b0b60');
    expect(inspectModelImportBuffer(bytes, '3mf')).toMatchObject({ format: '3mf', importMode: 'mesh' });
    expect(inspectThreeMfArchive(bytes)).toEqual({ unit: 'millimeter', objectCount: 1, triangleCount: 4, modelFileCount: 2 });
  });
});
