const crypto = require('crypto');
const fs = require('fs/promises');
const { atomicWriteTextFile } = require('./atomic-file.cjs');

const LICENSE_STATE_SCHEMA = 2;
const DEFAULT_OFFLINE_DAYS = 30;
const MAX_CLOCK_ROLLBACK_MS = 5 * 60 * 1000;

function cleanText(value, maxLength = 160) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Podaj poprawny adres e-mail.');
  return email;
}

function normalizeCredentials(payload, { registration = false } = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const email = normalizeEmail(source.email);
  const password = typeof source.password === 'string' ? source.password : '';
  if (password.length < 10 || password.length > 200) throw new Error('Hasło musi mieć od 10 do 200 znaków.');
  const displayName = cleanText(source.displayName, 120);
  if (registration && displayName.length < 2) throw new Error('Podaj nazwę użytkownika lub firmy.');
  return { email, password, ...(registration ? { displayName } : {}) };
}

function normalizeState(value, now = Date.now()) {
  const source = value && typeof value === 'object' ? value : {};
  const installationId = /^[a-f0-9-]{36}$/i.test(source.installationId || '') ? source.installationId : crypto.randomUUID();
  return {
    schemaVersion: LICENSE_STATE_SCHEMA,
    installationId,
    protectedToken: cleanText(source.protectedToken, 8192),
    account: source.account && typeof source.account === 'object' ? {
      email: cleanText(source.account.email, 254).toLowerCase(),
      displayName: cleanText(source.account.displayName, 120),
      emailVerified: Boolean(source.account.emailVerified),
    } : null,
    entitlement: source.entitlement && typeof source.entitlement === 'object' ? {
      plan: ['personal', 'commercial-trial', 'commercial'].includes(source.entitlement.plan) ? source.entitlement.plan : 'personal',
      startsAt: cleanText(source.entitlement.startsAt, 40),
      expiresAt: cleanText(source.entitlement.expiresAt, 40),
      seats: Math.max(1, Math.min(1000, Number(source.entitlement.seats) || 1)),
      licenseId: cleanText(source.entitlement.licenseId, 120),
    } : null,
    lastServerCheckAt: Number.isFinite(source.lastServerCheckAt) ? source.lastServerCheckAt : null,
    offlineUntil: Number.isFinite(source.offlineUntil) ? source.offlineUntil : null,
    lastSeenAt: Number.isFinite(source.lastSeenAt) ? Math.max(source.lastSeenAt, 0) : now,
  };
}

function entitlementActive(entitlement, now) {
  if (!entitlement || !['commercial-trial', 'commercial'].includes(entitlement.plan)) return false;
  const startsAt = Date.parse(entitlement.startsAt || '');
  const expiresAt = Date.parse(entitlement.expiresAt || '');
  if (Number.isFinite(startsAt) && now < startsAt) return false;
  return !Number.isFinite(expiresAt) || now < expiresAt;
}

function publicStatus(state, now = Date.now(), connection = 'offline') {
  const clockRollback = now + MAX_CLOCK_ROLLBACK_MS < state.lastSeenAt;
  const entitlement = state.entitlement;
  const serverLeaseActive = !clockRollback && Number.isFinite(state.offlineUntil) && now <= state.offlineUntil;
  const active = serverLeaseActive && entitlementActive(entitlement, now);
  const mode = active ? entitlement.plan : 'personal';
  const expiresAt = mode === 'personal' ? null : entitlement.expiresAt || null;
  const millisecondsRemaining = expiresAt ? Math.max(0, Date.parse(expiresAt) - now) : null;
  return {
    mode,
    signedIn: Boolean(state.account && state.protectedToken),
    account: state.account,
    installationId: state.installationId,
    licenseId: active ? entitlement.licenseId : '',
    seats: active ? entitlement.seats : null,
    expiresAt,
    daysRemaining: millisecondsRemaining === null ? null : Math.ceil(millisecondsRemaining / 86400000),
    lastServerCheckAt: state.lastServerCheckAt,
    offlineUntil: state.offlineUntil,
    connection,
    needsOnlineCheck: Boolean(state.account && !serverLeaseActive),
    clockRollback,
  };
}

function createLicenseClient({ statePath, request, protectToken, unprotectToken, now = () => Date.now(), appVersion = '0.0.0' }) {
  if (!statePath || typeof request !== 'function') throw new Error('Niepełna konfiguracja klienta licencji.');
  let operation = Promise.resolve();

  async function readState() {
    try {
      return normalizeState(JSON.parse(await fs.readFile(statePath, 'utf8')), now());
    } catch (_error) {
      return normalizeState(null, now());
    }
  }

  async function writeState(value) {
    const state = normalizeState(value, now());
    state.lastSeenAt = Math.max(state.lastSeenAt, now());
    await atomicWriteTextFile(statePath, JSON.stringify(state, null, 2));
    return state;
  }

  function queue(action) {
    const result = operation.then(action, action);
    operation = result.catch(() => {});
    return result;
  }

  async function tokenFrom(state) {
    if (!state.protectedToken) return '';
    try { return await unprotectToken(state.protectedToken); } catch (_error) { return ''; }
  }

  async function applyServerResponse(state, response, token = '') {
    if (!response || response.ok !== true || !response.account || !response.entitlement) {
      throw new Error(cleanText(response?.error, 300) || 'Serwer licencji zwrócił nieprawidłową odpowiedź.');
    }
    const checkedAt = now();
    const offlineDays = Math.max(1, Math.min(90, Number(response.offlineDays) || DEFAULT_OFFLINE_DAYS));
    return writeState({
      ...state,
      protectedToken: token ? await protectToken(token) : state.protectedToken,
      account: response.account,
      entitlement: response.entitlement,
      lastServerCheckAt: checkedAt,
      offlineUntil: checkedAt + offlineDays * 86400000,
      lastSeenAt: checkedAt,
    });
  }

  async function authenticate(action, payload) {
    return queue(async () => {
      const state = await readState();
      const credentials = normalizeCredentials(payload, { registration: action === 'register' });
      const response = await request(`/auth/${action}`, { ...credentials, installationId: state.installationId, appVersion });
      const next = await applyServerResponse(state, response, cleanText(response.sessionToken, 4096));
      return { ok: true, status: publicStatus(next, now(), 'online') };
    });
  }

  async function refresh() {
    return queue(async () => {
      const state = await readState();
      const token = await tokenFrom(state);
      if (!token) return { ok: true, status: publicStatus(await writeState(state), now(), 'offline') };
      try {
        const response = await request('/license/status', { sessionToken: token, installationId: state.installationId, appVersion });
        const next = await applyServerResponse(state, response);
        return { ok: true, status: publicStatus(next, now(), 'online') };
      } catch (error) {
        const next = await writeState(error?.statusCode === 401 ? { installationId: state.installationId, lastSeenAt: now() } : state);
        const status = publicStatus(next, now(), 'offline');
        return { ok: error?.statusCode === 401 ? false : status.mode !== 'personal' || !status.needsOnlineCheck, status, error: cleanText(error.message, 300) || 'Brak połączenia z serwerem licencji.' };
      }
    });
  }

  async function startTrial() {
    return queue(async () => {
      const state = await readState();
      const token = await tokenFrom(state);
      if (!token) throw new Error('Zaloguj się, aby rozpocząć ocenę komercyjną.');
      const response = await request('/license/start-trial', { sessionToken: token, installationId: state.installationId, appVersion });
      const next = await applyServerResponse(state, response);
      return { ok: true, status: publicStatus(next, now(), 'online') };
    });
  }

  async function logout() {
    return queue(async () => {
      const state = await readState();
      const token = await tokenFrom(state);
      if (token) await request('/auth/logout', { sessionToken: token }).catch(() => {});
      const next = await writeState({ installationId: state.installationId, lastSeenAt: now() });
      return { ok: true, status: publicStatus(next, now(), 'offline') };
    });
  }

  async function requestPasswordReset(payload) {
    return queue(async () => {
      const email = normalizeEmail(payload?.email);
      const response = await request('/auth/request-reset', { email, appVersion });
      return { ok: response?.ok === true, message: cleanText(response?.message, 300) };
    });
  }

  async function resetPassword(payload) {
    return queue(async () => {
      const credentials = normalizeCredentials(payload);
      const resetToken = cleanText(payload?.resetToken, 160);
      if (resetToken.length < 32) throw new Error('Wklej pełny kod odzyskiwania z wiadomości e-mail.');
      const response = await request('/auth/reset-password', { ...credentials, resetToken, appVersion });
      return { ok: response?.ok === true, message: cleanText(response?.message, 300) };
    });
  }

  async function resendVerification() {
    return queue(async () => {
      const state = await readState();
      const token = await tokenFrom(state);
      if (!token) throw new Error('Zaloguj się, aby potwierdzić adres e-mail.');
      const response = await request('/auth/resend-verification', { sessionToken: token, appVersion });
      return { ok: response?.ok === true, message: cleanText(response?.message, 300), status: publicStatus(state, now(), 'online') };
    });
  }

  async function verifyEmail(payload) {
    return queue(async () => {
      const state = await readState();
      const token = await tokenFrom(state);
      if (!token) throw new Error('Zaloguj się, aby potwierdzić adres e-mail.');
      const verificationToken = cleanText(payload?.verificationToken, 160);
      if (verificationToken.length < 32) throw new Error('Wklej pełny kod potwierdzający z wiadomości e-mail.');
      const response = await request('/auth/verify-email', { sessionToken: token, verificationToken, appVersion });
      const next = await writeState({ ...state, account: response.account || { ...state.account, emailVerified: true } });
      return { ok: true, message: cleanText(response?.message, 300), status: publicStatus(next, now(), 'online') };
    });
  }

  return {
    getStatus: refresh,
    login: (payload) => authenticate('login', payload),
    register: (payload) => authenticate('register', payload),
    startTrial,
    logout,
    requestPasswordReset,
    resetPassword,
    resendVerification,
    verifyEmail,
    _readState: readState,
  };
}

module.exports = {
  DEFAULT_OFFLINE_DAYS,
  LICENSE_STATE_SCHEMA,
  createLicenseClient,
  normalizeCredentials,
  normalizeState,
  publicStatus,
};
