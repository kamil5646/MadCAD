import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index.js';

function createMockKv() {
  const store = new Map();
  return {
    async get(key, options) {
      const raw = store.has(key) ? store.get(key) : null;
      if (raw === null) return null;
      if (options && options.type === 'json') return JSON.parse(raw);
      return raw;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

function createEnv(overrides = {}) {
  return {
    LICENSE_REGISTRY_KV: createMockKv(),
    ALLOWED_ORIGIN: 'https://kamil5646.github.io',
    ADMIN_TOKEN: 'test-admin-token',
    ...overrides,
  };
}

function request(path, init = {}) {
  return new Request(`https://worker.example${path}`, init);
}

describe('license registry worker', () => {
  let env;

  beforeEach(() => {
    env = createEnv();
  });

  it('responds to /healthz', async () => {
    const res = await worker.fetch(request('/healthz'), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('madcad-license-registry');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await worker.fetch(request('/unknown'), env);
    expect(res.status).toBe(404);
  });

  it('answers CORS preflight with 204 and allow-origin header', async () => {
    const res = await worker.fetch(
      request('/v1/license-registry', {
        method: 'OPTIONS',
        headers: { Origin: 'https://kamil5646.github.io' },
      }),
      env
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://kamil5646.github.io');
  });

  it('rejects GET /v1/license-registry POST without admin auth', async () => {
    const res = await worker.fetch(
      request('/v1/license-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'allowlist', tokens: [] }),
      }),
      env
    );
    expect(res.status).toBe(401);
  });

  it('accepts admin POST /v1/license-registry with a valid bearer token', async () => {
    const res = await worker.fetch(
      request('/v1/license-registry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-admin-token',
        },
        body: JSON.stringify({ mode: 'allowlist', tokens: [] }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tokenCount).toBe(0);
  });

  it('issues a private token and then verifies it successfully', async () => {
    const issueRes = await worker.fetch(
      request('/v1/license-tokens/issue-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: 'Jan Kowalski',
          email: 'jan@example.com',
          purpose: 'testing',
          deviceId: 'device-1234567',
        }),
      }),
      env
    );
    expect(issueRes.status).toBe(200);
    const issueBody = await issueRes.json();
    expect(issueBody.ok).toBe(true);
    expect(typeof issueBody.token).toBe('string');

    const verifyRes = await worker.fetch(
      request('/v1/license-tokens/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: issueBody.token, deviceId: 'device-1234567' }),
      }),
      env
    );
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.ok).toBe(true);
    expect(verifyBody.payload.email).toBe('jan@example.com');
  });

  it('rejects verification of a malformed token', async () => {
    const res = await worker.fetch(
      request('/v1/license-tokens/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'not-a-real-token' }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it('rejects issue-private when required fields are missing', async () => {
    const res = await worker.fetch(
      request('/v1/license-tokens/issue-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName: 'Jan' }),
      }),
      env
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
