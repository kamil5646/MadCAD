const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const { atomicWriteTextFile } = require('./atomic-file.cjs');
const { readRecoverableTextFile, validateJsonText } = require('./recovery-file.cjs');

const SNAPSHOT_MANIFEST_VERSION = 1;
const MAX_PROJECT_SNAPSHOTS = 20;
const MAX_PROJECT_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const MAX_PROJECT_SNAPSHOTS_TOTAL_BYTES = 256 * 1024 * 1024;
const SNAPSHOT_ID_PATTERN = /^snapshot-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function manifestPath(directory) {
  return path.join(directory, 'manifest.json');
}

function snapshotPath(directory, snapshotId) {
  if (!SNAPSHOT_ID_PATTERN.test(snapshotId)) throw new Error('Nieprawidłowe ID punktu zapisu.');
  return path.join(directory, `${snapshotId}.madcad`);
}

function emptyManifest() {
  return { version: SNAPSHOT_MANIFEST_VERSION, snapshots: [] };
}

function normalizeManifest(value) {
  if (!value || value.version !== SNAPSHOT_MANIFEST_VERSION || !Array.isArray(value.snapshots)) return emptyManifest();
  const snapshots = value.snapshots.filter((item) => item && SNAPSHOT_ID_PATTERN.test(item.id || '')).map((item) => ({
    id: item.id,
    name: String(item.name || '').slice(0, 80),
    description: String(item.description || '').slice(0, 240),
    createdAt: String(item.createdAt || ''),
    documentName: String(item.documentName || '').slice(0, 160),
    documentModifiedAt: String(item.documentModifiedAt || ''),
    schemaVersion: Number(item.schemaVersion) || 0,
    featureCount: Math.max(0, Number(item.featureCount) || 0),
    sketchCount: Math.max(0, Number(item.sketchCount) || 0),
    size: Math.max(0, Number(item.size) || 0),
  }));
  return { version: SNAPSHOT_MANIFEST_VERSION, snapshots };
}

async function readSnapshotManifest(directory, { fileSystem = fs } = {}) {
  const filePath = manifestPath(directory);
  try {
    const recovered = await readRecoverableTextFile(filePath, { fileSystem, validate: validateJsonText });
    if (!recovered.exists) return { manifest: emptyManifest(), recovered: false, warning: '' };
    return {
      manifest: normalizeManifest(JSON.parse(recovered.text)),
      recovered: recovered.recovered,
      warning: recovered.recovered ? 'Manifest punktów zapisu odzyskano z kopii zapasowej.' : '',
    };
  } catch (error) {
    error.message = `Nie udało się odczytać listy punktów zapisu. ${error.message}`;
    throw error;
  }
}

function snapshotMetadata({ id, name, description, createdAt, text }) {
  const document = JSON.parse(text);
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Punkt zapisu nie zawiera dokumentu MadCAD.');
  return {
    id,
    name,
    description,
    createdAt,
    documentName: String(document.name || 'Bez nazwy').slice(0, 160),
    documentModifiedAt: String(document.metadata?.modifiedAt || ''),
    schemaVersion: Number(document.schemaVersion) || 0,
    featureCount: Array.isArray(document.features) ? document.features.length : 0,
    sketchCount: Array.isArray(document.sketches) ? document.sketches.length : 0,
    size: Buffer.byteLength(text, 'utf8'),
  };
}

async function listProjectSnapshots(directory, options = {}) {
  const result = await readSnapshotManifest(directory, options);
  return { ...result, snapshots: [...result.manifest.snapshots].sort((first, second) => second.createdAt.localeCompare(first.createdAt)) };
}

async function createProjectSnapshot(directory, { name, description = '', text }, { fileSystem = fs, now = () => new Date().toISOString(), id = `snapshot-${crypto.randomUUID()}` } = {}) {
  const size = Buffer.byteLength(text, 'utf8');
  if (size > MAX_PROJECT_SNAPSHOT_BYTES) throw new Error('Projekt przekracza limit pojedynczego punktu zapisu.');
  const item = snapshotMetadata({ id, name, description, createdAt: now(), text });
  await fileSystem.mkdir(directory, { recursive: true });
  const current = await readSnapshotManifest(directory, { fileSystem });
  const retained = [...current.manifest.snapshots, item].sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const removed = [];
  let totalBytes = retained.reduce((sum, entry) => sum + entry.size, 0);
  while (retained.length > MAX_PROJECT_SNAPSHOTS || totalBytes > MAX_PROJECT_SNAPSHOTS_TOTAL_BYTES) {
    const oldest = retained.shift();
    if (!oldest || oldest.id === item.id) throw new Error('Brak miejsca na nowy punkt zapisu w dozwolonym limicie.');
    totalBytes -= oldest.size;
    removed.push(oldest);
  }
  await atomicWriteTextFile(snapshotPath(directory, item.id), text, { backup: false, fileSystem });
  await atomicWriteTextFile(manifestPath(directory), JSON.stringify({ version: SNAPSHOT_MANIFEST_VERSION, snapshots: retained }, null, 2), { backup: true, fileSystem });
  await Promise.all(removed.map((entry) => fileSystem.rm(snapshotPath(directory, entry.id), { force: true }).catch(() => {})));
  return { item, removedIds: removed.map((entry) => entry.id) };
}

async function readProjectSnapshot(directory, snapshotId, { fileSystem = fs } = {}) {
  const current = await readSnapshotManifest(directory, { fileSystem });
  const item = current.manifest.snapshots.find((entry) => entry.id === snapshotId);
  if (!item) throw new Error('Nie znaleziono punktu zapisu.');
  const text = await fileSystem.readFile(snapshotPath(directory, snapshotId), 'utf8');
  validateJsonText(text);
  return { item, text };
}

async function deleteProjectSnapshot(directory, snapshotId, { fileSystem = fs } = {}) {
  const current = await readSnapshotManifest(directory, { fileSystem });
  const item = current.manifest.snapshots.find((entry) => entry.id === snapshotId);
  if (!item) throw new Error('Nie znaleziono punktu zapisu.');
  const snapshots = current.manifest.snapshots.filter((entry) => entry.id !== snapshotId);
  await atomicWriteTextFile(manifestPath(directory), JSON.stringify({ version: SNAPSHOT_MANIFEST_VERSION, snapshots }, null, 2), { backup: true, fileSystem });
  await fileSystem.rm(snapshotPath(directory, snapshotId), { force: true });
  return { item };
}

module.exports = {
  MAX_PROJECT_SNAPSHOTS,
  MAX_PROJECT_SNAPSHOT_BYTES,
  MAX_PROJECT_SNAPSHOTS_TOTAL_BYTES,
  SNAPSHOT_ID_PATTERN,
  createProjectSnapshot,
  deleteProjectSnapshot,
  listProjectSnapshots,
  readProjectSnapshot,
};
