const { contextBridge } = require('electron');

const snapshots = [];
const texts = new Map();
let counter = 0;

contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  isDesktop: true,
  appLanguage: 'pl',
  projectSnapshotList: async () => ({ ok: true, snapshots: [...snapshots] }),
  projectSnapshotCreate: async ({ name, description, text }) => {
    counter += 1;
    const document = JSON.parse(text);
    const id = `snapshot-11111111-1111-4111-8111-${String(counter).padStart(12, '0')}`;
    const snapshot = {
      id,
      name,
      description,
      createdAt: `2026-08-24T12:${String(counter).padStart(2, '0')}:00.000Z`,
      documentName: document.name,
      documentModifiedAt: document.metadata?.modifiedAt || '',
      schemaVersion: document.schemaVersion,
      featureCount: document.features?.length || 0,
      sketchCount: document.sketches?.length || 0,
      size: Buffer.byteLength(text, 'utf8'),
    };
    snapshots.unshift(snapshot);
    texts.set(id, text);
    return { ok: true, snapshot, removedIds: [] };
  },
  projectSnapshotRead: async ({ id }) => ({ ok: true, snapshot: snapshots.find((item) => item.id === id), text: texts.get(id) }),
  projectSnapshotDelete: async ({ id }) => {
    const index = snapshots.findIndex((item) => item.id === id);
    const [snapshot] = snapshots.splice(index, 1);
    texts.delete(id);
    return { ok: true, snapshot };
  },
});
