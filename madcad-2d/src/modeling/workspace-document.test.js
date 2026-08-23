import { describe, expect, it } from 'vitest';
import { createDocument } from '../cad-core/document.js';
import { prepareProjectSave, readProjectFile } from './workspace-document.js';

describe('workspace document services', () => {
  it('builds one canonical desktop and browser save payload', () => {
    const document = createDocument('Mój projekt CAD');
    const prepared = prepareProjectSave(document);
    expect(prepared.defaultName).toBe('M-j-projekt-CAD.madcad');
    expect(JSON.parse(prepared.text).id).toBe(document.id);
    expect(JSON.parse(prepared.snapshot).name).toBe(document.name);
    expect(prepared.filters[0]).toEqual({ name: 'Projekt MadCAD', extensions: ['madcad'] });
  });

  it('reads, validates and normalizes a selected project file', async () => {
    const document = createDocument('Fixture');
    const opened = await readProjectFile({ name: 'fixture.madcad', text: async () => JSON.stringify(document) });
    expect(opened.document.name).toBe('Fixture');
    expect(opened.filePath).toBe('fixture.madcad');
    expect(opened.readOnly).toBe(false);
  });
});
