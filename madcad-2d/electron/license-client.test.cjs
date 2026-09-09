const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createLicenseClient, normalizeCredentials, publicStatus } = require('./license-client.cjs');

test('validates named-user credentials before sending them', () => {
  assert.deepEqual(normalizeCredentials({ email: ' USER@example.com ', password: 'very-secure', displayName: ' Firma ' }, { registration: true }), { email: 'user@example.com', password: 'very-secure', displayName: 'Firma' });
  assert.throws(() => normalizeCredentials({ email: 'bad', password: 'very-secure' }), /e-mail/);
  assert.throws(() => normalizeCredentials({ email: 'u@example.com', password: 'short' }), /10/);
});

test('keeps personal use available and accepts server-controlled trial and commercial plans', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-license-client-'));
  let timestamp = Date.UTC(2026, 8, 9);
  let plan = 'personal';
  const calls = [];
  const request = async (route, payload) => {
    calls.push({ route, payload });
    if (route === '/auth/login') return { ok: true, sessionToken: 'server-token', account: { email: payload.email, displayName: 'Kamil' }, entitlement: { plan, startsAt: '', expiresAt: '', seats: 1, licenseId: '' }, offlineDays: 30 };
    if (route === '/license/start-trial') {
      plan = 'commercial-trial';
      return { ok: true, account: { email: 'u@example.com', displayName: 'Kamil' }, entitlement: { plan, startsAt: new Date(timestamp).toISOString(), expiresAt: new Date(timestamp + 40 * 86400000).toISOString(), seats: 1, licenseId: 'trial-1' }, offlineDays: 30 };
    }
    return { ok: true, account: { email: 'u@example.com', displayName: 'Kamil' }, entitlement: { plan, startsAt: '', expiresAt: '', seats: 1, licenseId: '' }, offlineDays: 30 };
  };
  const client = createLicenseClient({ statePath: path.join(root, 'state.json'), request, protectToken: async (value) => `protected:${value}`, unprotectToken: async (value) => value.slice(10), now: () => timestamp, appVersion: '6.4.7' });
  const anonymous = await client.getStatus();
  assert.equal(anonymous.status.mode, 'personal');
  const login = await client.login({ email: 'u@example.com', password: 'very-secure' });
  assert.equal(login.status.signedIn, true);
  assert.equal((await client._readState()).protectedToken, 'protected:server-token');
  const trial = await client.startTrial();
  assert.equal(trial.status.mode, 'commercial-trial');
  assert.equal(trial.status.daysRemaining, 40);
  timestamp += 31 * 86400000;
  const offline = publicStatus(await client._readState(), timestamp, 'offline');
  assert.equal(offline.mode, 'personal');
  assert.equal(offline.needsOnlineCheck, true);
  assert.equal(calls.some(({ payload }) => payload.password === 'very-secure'), true);
  await fs.rm(root, { recursive: true, force: true });
});

test('rejects clock rollback and clears cached entitlement on logout', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-license-clock-'));
  let timestamp = Date.UTC(2026, 8, 9);
  const client = createLicenseClient({
    statePath: path.join(root, 'state.json'),
    request: async (route, payload) => route === '/auth/login'
      ? { ok: true, sessionToken: 'token', account: { email: payload.email, displayName: 'User' }, entitlement: { plan: 'commercial', startsAt: '', expiresAt: '', seats: 1, licenseId: 'commercial-1' }, offlineDays: 30 }
      : { ok: true },
    protectToken: async (value) => value,
    unprotectToken: async (value) => value,
    now: () => timestamp,
  });
  assert.equal((await client.login({ email: 'u@example.com', password: 'very-secure' })).status.mode, 'commercial');
  timestamp -= 86400000;
  const rollback = publicStatus(await client._readState(), timestamp);
  assert.equal(rollback.mode, 'personal');
  assert.equal(rollback.clockRollback, true);
  assert.equal((await client.logout()).status.signedIn, false);
  await fs.rm(root, { recursive: true, force: true });
});

test('clears a rejected server session instead of extending its offline lease', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-license-expired-session-'));
  let rejectSession = false;
  const client = createLicenseClient({
    statePath: path.join(root, 'state.json'),
    request: async (route, payload) => {
      if (rejectSession) { const error = new Error('Sesja wygasła.'); error.statusCode = 401; throw error; }
      return { ok: true, sessionToken: 'token', account: { email: payload.email, displayName: 'User' }, entitlement: { plan: 'commercial', startsAt: '', expiresAt: '', seats: 1, licenseId: 'commercial-1' }, offlineDays: 30 };
    },
    protectToken: async (value) => value,
    unprotectToken: async (value) => value,
  });
  await client.login({ email: 'test@example.com', password: 'correct-horse' });
  rejectSession = true;
  const result = await client.getStatus();
  assert.equal(result.ok, false);
  assert.equal(result.status.mode, 'personal');
  assert.equal(result.status.signedIn, false);
  await fs.rm(root, { recursive: true, force: true });
});

test('requests and confirms password recovery without changing local entitlement', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-license-password-reset-'));
  const calls = [];
  const client = createLicenseClient({
    statePath: path.join(root, 'state.json'),
    request: async (route, payload) => { calls.push({ route, payload }); return { ok: true, message: 'OK' }; },
    protectToken: async (value) => value,
    unprotectToken: async (value) => value,
  });
  assert.equal((await client.requestPasswordReset({ email: ' USER@example.com ' })).ok, true);
  assert.equal((await client.resetPassword({ email: 'user@example.com', password: 'new-secure-password', resetToken: 'a'.repeat(43) })).ok, true);
  assert.deepEqual(calls.map(({ route }) => route), ['/auth/request-reset', '/auth/reset-password']);
  assert.equal(calls[0].payload.email, 'user@example.com');
  assert.equal((await client._readState()).account, null);
  assert.rejects(() => client.resetPassword({ email: 'user@example.com', password: 'new-secure-password', resetToken: 'short' }), /pełny kod/i);
  await fs.rm(root, { recursive: true, force: true });
});
