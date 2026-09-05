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
});

const finite = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;

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
  };
}

export function ensureDocumentRenderScene(document) {
  document.renderScene = normalizeRenderScene(document.renderScene);
  return document;
}
