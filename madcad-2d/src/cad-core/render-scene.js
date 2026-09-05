export const RENDER_ENVIRONMENT_PRESETS = Object.freeze({
  studio: Object.freeze({ id: 'studio', name: 'Studio', background: '#202936', ambientIntensity: 1.8, keyIntensity: 3.1, fillIntensity: 0.9, keyAzimuth: 135, keyElevation: 52, exposure: 1 }),
  workshop: Object.freeze({ id: 'workshop', name: 'Warsztat', background: '#35383d', ambientIntensity: 1.35, keyIntensity: 2.7, fillIntensity: 0.65, keyAzimuth: 120, keyElevation: 38, exposure: 0.95 }),
  daylight: Object.freeze({ id: 'daylight', name: 'Światło dzienne', background: '#b9cad8', ambientIntensity: 2.2, keyIntensity: 3.8, fillIntensity: 1.1, keyAzimuth: 155, keyElevation: 62, exposure: 1.05 }),
  night: Object.freeze({ id: 'night', name: 'Noc', background: '#101722', ambientIntensity: 0.85, keyIntensity: 2.5, fillIntensity: 0.45, keyAzimuth: 210, keyElevation: 30, exposure: 0.82 }),
});

export const DEFAULT_RENDER_SCENE = Object.freeze({
  preset: 'studio',
  background: RENDER_ENVIRONMENT_PRESETS.studio.background,
  ambientIntensity: RENDER_ENVIRONMENT_PRESETS.studio.ambientIntensity,
  keyIntensity: RENDER_ENVIRONMENT_PRESETS.studio.keyIntensity,
  fillIntensity: RENDER_ENVIRONMENT_PRESETS.studio.fillIntensity,
  keyAzimuth: RENDER_ENVIRONMENT_PRESETS.studio.keyAzimuth,
  keyElevation: RENDER_ENVIRONMENT_PRESETS.studio.keyElevation,
  exposure: RENDER_ENVIRONMENT_PRESETS.studio.exposure,
  shadows: true,
  ground: true,
  decals: Object.freeze([]),
});

const finite = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;

function normalizeRenderDecal(decal) {
  if (!decal || typeof decal !== 'object' || typeof decal.id !== 'string' || !decal.id.trim() || typeof decal.bodyId !== 'string' || !decal.bodyId.trim() || typeof decal.faceId !== 'string' || !decal.faceId.trim() || typeof decal.imageData !== 'string' || !DECAL_DATA_PATTERN.test(decal.imageData)) return null;
  return {
    id: decal.id,
    name: String(decal.name || 'Naklejka').trim().slice(0, 80) || 'Naklejka',
    bodyId: decal.bodyId,
    faceId: decal.faceId,
    imageData: decal.imageData,
    opacity: finite(decal.opacity, 1, 0.05, 1),
    scale: finite(decal.scale, 0.55, 0.1, 1),
    offsetU: finite(decal.offsetU, 0, -0.75, 0.75),
    offsetV: finite(decal.offsetV, 0, -0.75, 0.75),
    rotation: finite(decal.rotation, 0, -180, 180),
    visible: decal.visible === undefined ? true : Boolean(decal.visible),
  };
}

export function renderEnvironmentPreset(preset = 'studio') {
  return RENDER_ENVIRONMENT_PRESETS[preset] || RENDER_ENVIRONMENT_PRESETS.studio;
}

export function normalizeRenderScene(scene = {}) {
  const preset = renderEnvironmentPreset(scene.preset);
  return {
    preset: preset.id,
    background: color(scene.background, preset.background),
    ambientIntensity: finite(scene.ambientIntensity, preset.ambientIntensity, 0, 8),
    keyIntensity: finite(scene.keyIntensity, preset.keyIntensity, 0, 12),
    fillIntensity: finite(scene.fillIntensity, preset.fillIntensity, 0, 8),
    keyAzimuth: finite(scene.keyAzimuth, preset.keyAzimuth, -360, 360),
    keyElevation: finite(scene.keyElevation, preset.keyElevation, -10, 90),
    exposure: finite(scene.exposure, preset.exposure, 0.25, 3),
    shadows: scene.shadows === undefined ? true : Boolean(scene.shadows),
    ground: scene.ground === undefined ? true : Boolean(scene.ground),
    decals: Array.isArray(scene.decals) ? scene.decals.map(normalizeRenderDecal).filter(Boolean) : [],
  };
}

export function isRenderSceneValid(scene) {
  if (!scene || typeof scene !== 'object' || !Array.isArray(scene.decals)) return false;
  const normalized = normalizeRenderScene(scene);
  for (const [key, value] of Object.entries(normalized)) {
    if (key === 'decals') continue;
    if (scene[key] !== value) return false;
  }
  if (scene.decals.length !== normalized.decals.length) return false;
  return normalized.decals.every((decal, index) => Object.entries(decal).every(([key, value]) => scene.decals[index]?.[key] === value));
}

export function createRenderDecal(document, options) {
  if (!options?.bodyId || !options?.faceId) throw new Error('Wybierz jedną ścianę dla naklejki.');
  if (typeof options.imageData !== 'string' || !DECAL_DATA_PATTERN.test(options.imageData)) throw new Error('Naklejka wymaga obrazu PNG, JPEG albo WebP.');
  const decal = normalizeRenderDecal({ id: createId('decal'), ...options });
  if (!decal) throw new Error('Nie udało się przygotować naklejki.');
  document.renderScene = normalizeRenderScene(document.renderScene);
  document.renderScene.decals.push(decal);
  return decal;
}

export function updateRenderDecal(document, decalId, patch) {
  document.renderScene = normalizeRenderScene(document.renderScene);
  const index = document.renderScene.decals.findIndex((decal) => decal.id === decalId);
  if (index < 0) throw new Error('Nie znaleziono naklejki.');
  const updated = normalizeRenderDecal({ ...document.renderScene.decals[index], ...patch });
  if (!updated) throw new Error('Nieprawidłowe ustawienia naklejki.');
  document.renderScene.decals[index] = updated;
  return updated;
}

export function deleteRenderDecal(document, decalId) {
  document.renderScene = normalizeRenderScene(document.renderScene);
  const index = document.renderScene.decals.findIndex((decal) => decal.id === decalId);
  if (index < 0) throw new Error('Nie znaleziono naklejki.');
  return document.renderScene.decals.splice(index, 1)[0];
}

export function ensureDocumentRenderScene(document) {
  document.renderScene = normalizeRenderScene(document.renderScene);
  return document;
}
import { createId } from './ids.js';

export const MAX_RENDER_DECAL_BYTES = 2 * 1024 * 1024;
const DECAL_DATA_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
