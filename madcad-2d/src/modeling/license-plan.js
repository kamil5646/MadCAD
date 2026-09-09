export const LICENSE_PLAN_STORAGE_KEY = 'madcad:license-plan:v1';
export const COMMERCIAL_TRIAL_DAYS = 40;

const DAY_MS = 24 * 60 * 60 * 1000;
const MODES = new Set(['personal', 'commercial-trial', 'commercial-licensed']);

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normalizeLicensePlan(value, now = Date.now()) {
  const parsed = value && typeof value === 'object' ? value : {};
  const commercialHolder = cleanText(parsed.commercialHolder, 120);
  const commercialReference = cleanText(parsed.commercialReference, 120);
  const requestedMode = MODES.has(parsed.mode) ? parsed.mode : 'personal';
  const mode = requestedMode === 'commercial-licensed' && (!commercialHolder || !commercialReference) ? 'personal' : requestedMode;
  return {
    mode,
    trialStartedAt: Number.isFinite(parsed.trialStartedAt) ? parsed.trialStartedAt : null,
    commercialConfirmedAt: Number.isFinite(parsed.commercialConfirmedAt) ? parsed.commercialConfirmedAt : null,
    commercialHolder,
    commercialReference,
    updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : now,
  };
}

export function selectLicensePlan(current, mode, now = Date.now()) {
  const normalized = normalizeLicensePlan(current, now);
  if (!MODES.has(mode)) return normalized;
  if (mode === 'commercial-licensed' && (!normalized.commercialHolder || !normalized.commercialReference)) return normalized;
  return {
    ...normalized,
    mode,
    trialStartedAt: mode === 'commercial-trial' && normalized.trialStartedAt === null ? now : normalized.trialStartedAt,
    commercialConfirmedAt: mode === 'commercial-licensed' ? normalized.commercialConfirmedAt || now : normalized.commercialConfirmedAt,
    updatedAt: now,
  };
}

export function confirmCommercialLicense(current, details, now = Date.now()) {
  const normalized = normalizeLicensePlan(current, now);
  const commercialHolder = cleanText(details?.holder, 120);
  const commercialReference = cleanText(details?.reference, 120);
  if (!commercialHolder || !commercialReference) return normalized;
  return {
    ...normalized,
    mode: 'commercial-licensed',
    commercialHolder,
    commercialReference,
    commercialConfirmedAt: now,
    updatedAt: now,
  };
}

export function describeLicensePlan(value, now = Date.now()) {
  const plan = normalizeLicensePlan(value, now);
  if (plan.mode === 'commercial-licensed') return { ...plan, label: 'Komercyjna', detail: `${plan.commercialHolder} · ${plan.commercialReference}`, expired: false, daysRemaining: null };
  if (plan.mode === 'commercial-trial') {
    const elapsed = Math.max(0, now - (plan.trialStartedAt || now));
    const daysRemaining = Math.max(0, COMMERCIAL_TRIAL_DAYS - Math.floor(elapsed / DAY_MS));
    return {
      ...plan,
      label: daysRemaining > 0 ? `Ocena komercyjna · ${daysRemaining} dni` : 'Ocena komercyjna wygasła',
      detail: daysRemaining > 0 ? 'Pełna funkcjonalność w okresie oceny' : 'Dalszy użytek komercyjny wymaga zakupu',
      expired: daysRemaining === 0,
      daysRemaining,
    };
  }
  return { ...plan, label: 'Osobista', detail: 'Tylko użytek prywatny, edukacyjny i niezarobkowy', expired: false, daysRemaining: null };
}

export function loadLicensePlan(storage = window.localStorage, now = Date.now()) {
  try {
    return normalizeLicensePlan(JSON.parse(storage.getItem(LICENSE_PLAN_STORAGE_KEY) || 'null'), now);
  } catch (_error) {
    return normalizeLicensePlan(null, now);
  }
}

export function saveLicensePlan(plan, storage = window.localStorage) {
  try {
    storage.setItem(LICENSE_PLAN_STORAGE_KEY, JSON.stringify(normalizeLicensePlan(plan)));
    return true;
  } catch (_error) {
    return false;
  }
}
