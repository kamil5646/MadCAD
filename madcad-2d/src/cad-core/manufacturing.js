import { createId } from './ids.js';

export const CAM_MACHINE_PRESETS = Object.freeze({
  'desktop-3018': Object.freeze({ id: 'desktop-3018', name: 'Frezarka biurkowa 3018', kind: 'mill-3axis', travel: [300, 180, 45], maxSpindleRpm: 10000 }),
  'mill-500': Object.freeze({ id: 'mill-500', name: 'Frezarka 3-osiowa 500', kind: 'mill-3axis', travel: [500, 400, 350], maxSpindleRpm: 12000 }),
  'mill-1000': Object.freeze({ id: 'mill-1000', name: 'Frezarka 3-osiowa 1000', kind: 'mill-3axis', travel: [1000, 600, 600], maxSpindleRpm: 18000 }),
});

export const CAM_WCS_ORIGINS = Object.freeze([
  Object.freeze({ id: 'stock-top-center', name: 'Środek górnej powierzchni półfabrykatu' }),
  Object.freeze({ id: 'stock-top-front-left', name: 'Lewy przedni narożnik półfabrykatu' }),
  Object.freeze({ id: 'model-origin', name: 'Początek układu modelu' }),
]);

const finiteNonNegative = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

export function normalizeManufacturingSetup(setup = {}, index = 0) {
  const machineId = CAM_MACHINE_PRESETS[setup.machineId] ? setup.machineId : 'mill-500';
  const wcsOrigin = CAM_WCS_ORIGINS.some((item) => item.id === setup.wcsOrigin) ? setup.wcsOrigin : 'stock-top-center';
  return {
    id: typeof setup.id === 'string' && setup.id ? setup.id : createId('cam-setup'),
    name: String(setup.name || `Setup ${index + 1}`).trim().slice(0, 80) || `Setup ${index + 1}`,
    operationKind: 'mill-3axis',
    bodyId: typeof setup.bodyId === 'string' ? setup.bodyId : '',
    machineId,
    stock: {
      sideOffset: finiteNonNegative(setup.stock?.sideOffset, 2),
      topOffset: finiteNonNegative(setup.stock?.topOffset, 2),
      bottomOffset: finiteNonNegative(setup.stock?.bottomOffset, 0),
    },
    wcsOrigin,
    safeHeight: finiteNonNegative(setup.safeHeight, 5),
  };
}

export function ensureDocumentManufacturing(document) {
  if (!document.manufacturing || typeof document.manufacturing !== 'object' || Array.isArray(document.manufacturing)) {
    document.manufacturing = { setups: [], activeSetupId: '' };
  }
  if (!Array.isArray(document.manufacturing.setups)) document.manufacturing.setups = [];
  document.manufacturing.setups = document.manufacturing.setups.map(normalizeManufacturingSetup);
  if (typeof document.manufacturing.activeSetupId !== 'string') document.manufacturing.activeSetupId = '';
  if (!document.manufacturing.setups.some((setup) => setup.id === document.manufacturing.activeSetupId)) {
    document.manufacturing.activeSetupId = document.manufacturing.setups[0]?.id || '';
  }
  return document;
}

export function createManufacturingSetup(options = {}) {
  return normalizeManufacturingSetup({ ...options, id: createId('cam-setup') });
}

export function calculateManufacturingSetup(setup, bodies = []) {
  const normalized = normalizeManufacturingSetup(setup);
  const machine = CAM_MACHINE_PRESETS[normalized.machineId];
  const body = bodies.find((item) => item.id === normalized.bodyId);
  if (!body) return { valid: false, machine, body: null, warnings: ['Wybierz istniejącą bryłę do obróbki.'] };
  const bounds = body.bounds || body.metrics?.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 2 || bounds.flat().length !== 6 || bounds.flat().some((value) => !Number.isFinite(Number(value)))) {
    return { valid: false, machine, body, warnings: ['Silnik CAD nie zwrócił prawidłowych granic wybranej bryły.'] };
  }
  const minimum = bounds[0].map(Number);
  const maximum = bounds[1].map(Number);
  const side = normalized.stock.sideOffset;
  const stockBounds = [
    [minimum[0] - side, minimum[1] - side, minimum[2] - normalized.stock.bottomOffset],
    [maximum[0] + side, maximum[1] + side, maximum[2] + normalized.stock.topOffset],
  ];
  const dimensions = stockBounds[1].map((value, axis) => value - stockBounds[0][axis]);
  let origin;
  if (normalized.wcsOrigin === 'model-origin') origin = [0, 0, 0];
  else if (normalized.wcsOrigin === 'stock-top-front-left') origin = [stockBounds[0][0], stockBounds[0][1], stockBounds[1][2]];
  else origin = [(stockBounds[0][0] + stockBounds[1][0]) / 2, (stockBounds[0][1] + stockBounds[1][1]) / 2, stockBounds[1][2]];
  const warnings = [];
  const exceededAxes = dimensions.map((value, axis) => value > machine.travel[axis] ? ['X', 'Y', 'Z'][axis] : null).filter(Boolean);
  if (exceededAxes.length) warnings.push(`Półfabrykat przekracza przesuw maszyny w osi ${exceededAxes.join(', ')}.`);
  if (dimensions.some((value) => value <= 0)) warnings.push('Półfabrykat musi mieć dodatnie wymiary.');
  return {
    valid: warnings.length === 0,
    machine,
    body,
    stockBounds,
    dimensions,
    origin,
    clearancePlaneZ: origin[2] + normalized.safeHeight,
    warnings,
  };
}

export function validateManufacturing(manufacturing) {
  const issues = [];
  if (!manufacturing || typeof manufacturing !== 'object' || Array.isArray(manufacturing)) return [{ path: 'manufacturing', message: 'Wymagane są dane wytwarzania.', code: 'TYPE' }];
  if (!Array.isArray(manufacturing.setups)) return [{ path: 'manufacturing.setups', message: 'Setupy CAM muszą być tablicą.', code: 'TYPE' }];
  const ids = new Set();
  const names = new Set();
  manufacturing.setups.forEach((setup, index) => {
    const base = `manufacturing.setups[${index}]`;
    if (!setup || typeof setup !== 'object' || Array.isArray(setup)) { issues.push({ path: base, message: 'Setup CAM musi być obiektem.', code: 'TYPE' }); return; }
    if (typeof setup.id !== 'string' || !setup.id) issues.push({ path: `${base}.id`, message: 'Setup CAM wymaga ID.', code: 'REQUIRED' });
    else if (ids.has(setup.id)) issues.push({ path: `${base}.id`, message: 'ID setupu CAM jest powtórzone.', code: 'DUPLICATE_ID' });
    else ids.add(setup.id);
    const name = typeof setup.name === 'string' ? setup.name.trim() : '';
    if (!name) issues.push({ path: `${base}.name`, message: 'Setup CAM wymaga nazwy.', code: 'REQUIRED' });
    else if (names.has(name.toLocaleLowerCase())) issues.push({ path: `${base}.name`, message: 'Nazwa setupu CAM jest powtórzona.', code: 'DUPLICATE' });
    else names.add(name.toLocaleLowerCase());
    if (setup.operationKind !== 'mill-3axis') issues.push({ path: `${base}.operationKind`, message: 'Obsługiwane jest frezowanie 3-osiowe.', code: 'UNSUPPORTED' });
    if (typeof setup.bodyId !== 'string') issues.push({ path: `${base}.bodyId`, message: 'Identyfikator bryły musi być tekstem.', code: 'TYPE' });
    if (!CAM_MACHINE_PRESETS[setup.machineId]) issues.push({ path: `${base}.machineId`, message: 'Nieznany profil obrabiarki.', code: 'UNSUPPORTED' });
    if (!CAM_WCS_ORIGINS.some((item) => item.id === setup.wcsOrigin)) issues.push({ path: `${base}.wcsOrigin`, message: 'Nieznany początek układu WCS.', code: 'UNSUPPORTED' });
    for (const key of ['sideOffset', 'topOffset', 'bottomOffset']) if (!Number.isFinite(Number(setup.stock?.[key])) || Number(setup.stock[key]) < 0) issues.push({ path: `${base}.stock.${key}`, message: 'Naddatek musi być liczbą nieujemną.', code: 'VALUE' });
    if (!Number.isFinite(Number(setup.safeHeight)) || Number(setup.safeHeight) < 0) issues.push({ path: `${base}.safeHeight`, message: 'Wysokość bezpieczna musi być liczbą nieujemną.', code: 'VALUE' });
  });
  if (typeof manufacturing.activeSetupId !== 'string') issues.push({ path: 'manufacturing.activeSetupId', message: 'Aktywny setup musi być identyfikatorem tekstowym.', code: 'TYPE' });
  else if (manufacturing.activeSetupId && !ids.has(manufacturing.activeSetupId)) issues.push({ path: 'manufacturing.activeSetupId', message: 'Aktywny setup CAM nie istnieje.', code: 'BROKEN_REFERENCE' });
  return issues;
}
