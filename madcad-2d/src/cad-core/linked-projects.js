import { createId } from './ids.js';

export const LINKED_PROJECT_STATES = Object.freeze(['current', 'changed', 'missing', 'error', 'checking']);

function text(value, max) {
  return String(value || '').trim().slice(0, max);
}

function uniqueStrings(value) {
  return [...new Set(Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item) : [])];
}

export function normalizeLinkedProject(link, index = 0) {
  return {
    ...link,
    id: text(link?.id, 100) || createId('linked-project'),
    relativePath: text(link?.relativePath, 1024),
    fileName: text(link?.fileName, 255) || `projekt-${index + 1}.madcad`,
    sourceDocumentId: text(link?.sourceDocumentId, 100),
    sourceName: text(link?.sourceName, 160) || `Projekt linkowany ${index + 1}`,
    sourceSchemaVersion: Math.max(0, Math.trunc(Number(link?.sourceSchemaVersion) || 0)),
    sourceHash: text(link?.sourceHash, 64).toLowerCase(),
    sourceModifiedAt: text(link?.sourceModifiedAt, 64),
    linkedComponentId: text(link?.linkedComponentId, 100),
    proxyFeatureIds: uniqueStrings(link?.proxyFeatureIds),
    refreshedAt: text(link?.refreshedAt, 64),
  };
}

export function ensureDocumentLinkedProjects(document) {
  if (!document || typeof document !== 'object') return document;
  if (!Array.isArray(document.linkedProjects)) document.linkedProjects = [];
  document.linkedProjects = document.linkedProjects.map(normalizeLinkedProject);
  return document;
}

export function createLinkedProject(options = {}) {
  return normalizeLinkedProject({ id: createId('linked-project'), ...options });
}

export function linkedProjectState(link, resolved) {
  if (!resolved) return 'checking';
  if (resolved.missing) return 'missing';
  if (resolved.error) return 'error';
  return resolved.hash === link.sourceHash ? 'current' : 'changed';
}
