import { createId } from './ids.js';

export const MAX_NAMED_VIEWS = 50;

function finiteVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(Number(item)))) throw new Error(`${label} musi zawierać trzy skończone współrzędne.`);
  return value.map((item) => Number(Number(item).toFixed(9)));
}

export function normalizeNamedViewCamera(camera) {
  const position = finiteVector(camera?.position, 'Pozycja kamery');
  const target = finiteVector(camera?.target, 'Cel kamery');
  const up = finiteVector(camera?.up, 'Wektor góry kamery');
  const distance = Math.hypot(...position.map((value, index) => value - target[index]));
  if (distance <= 1e-7) throw new Error('Pozycja kamery musi różnić się od punktu celu.');
  if (Math.hypot(...up) <= 1e-7) throw new Error('Wektor góry kamery nie może być zerowy.');
  return { position, target, up };
}

export function ensureDocumentNamedViews(document) {
  if (!Array.isArray(document.namedViews)) document.namedViews = [];
  return document;
}

export function createNamedView(document, { name, camera }) {
  ensureDocumentNamedViews(document);
  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('Podaj nazwę zapisanego widoku.');
  if (normalizedName.length > 60) throw new Error('Nazwa zapisanego widoku może mieć maksymalnie 60 znaków.');
  if (document.namedViews.length >= MAX_NAMED_VIEWS) throw new Error(`Projekt może zawierać maksymalnie ${MAX_NAMED_VIEWS} zapisanych widoków.`);
  if (document.namedViews.some((view) => view.name.localeCompare(normalizedName, undefined, { sensitivity: 'base' }) === 0)) throw new Error(`Widok „${normalizedName}” już istnieje.`);
  const view = { id: createId('named-view'), name: normalizedName, camera: normalizeNamedViewCamera(camera) };
  document.namedViews.push(view);
  return view;
}

export function renameNamedView(document, viewId, name) {
  ensureDocumentNamedViews(document);
  const view = document.namedViews.find((item) => item.id === viewId);
  if (!view) throw new Error('Nie znaleziono zapisanego widoku.');
  const normalizedName = String(name || '').trim();
  if (!normalizedName || normalizedName.length > 60) throw new Error('Nazwa widoku musi mieć od 1 do 60 znaków.');
  if (document.namedViews.some((item) => item.id !== viewId && item.name.localeCompare(normalizedName, undefined, { sensitivity: 'base' }) === 0)) throw new Error(`Widok „${normalizedName}” już istnieje.`);
  view.name = normalizedName;
  return view;
}

export function deleteNamedView(document, viewId) {
  ensureDocumentNamedViews(document);
  const index = document.namedViews.findIndex((view) => view.id === viewId);
  if (index < 0) throw new Error('Nie znaleziono zapisanego widoku.');
  return document.namedViews.splice(index, 1)[0];
}
