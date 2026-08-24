import { describe, expect, it } from 'vitest';
import { createDocument, openDocument, validateDocument } from './document.js';
import { createNamedView, deleteNamedView, renameNamedView } from './named-views.js';

const camera = { position: [120, -90, 80], target: [5, 4, 3], up: [0, 0, 1] };

describe('named views', () => {
  it('creates, renames, reopens and deletes an exact camera', () => {
    const document = createDocument('Widoki');
    const view = createNamedView(document, { name: 'Montaż', camera });
    expect(view.camera).toEqual(camera);
    renameNamedView(document, view.id, 'Montaż prawy');
    const reopened = openDocument(JSON.parse(JSON.stringify(document))).document;
    expect(reopened.namedViews[0].name).toBe('Montaż prawy');
    expect(validateDocument(reopened).valid).toBe(true);
    expect(deleteNamedView(reopened, view.id).id).toBe(view.id);
  });

  it('rejects duplicate names and invalid cameras without partial state', () => {
    const document = createDocument('Widoki błędne');
    createNamedView(document, { name: 'Detal', camera });
    expect(() => createNamedView(document, { name: 'detal', camera })).toThrow(/już istnieje/);
    expect(() => createNamedView(document, { name: 'Błąd', camera: { ...camera, position: camera.target } })).toThrow(/musi różnić/);
    expect(document.namedViews).toHaveLength(1);
  });
});
