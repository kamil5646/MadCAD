const REGISTRY_KEY = "license-registry-v1";
const PAYPAL_ORDER_KEY_PREFIX = "paypal-order-v1:";
const TOKEN_PREFIX = "M2D2";
const VALID_TOKEN_HASH = /^[a-f0-9]{24,128}$/;
const VALID_TOKEN_FORMAT = /^M2D[0-9]+\.[A-Za-z0-9_-]{8,512}(?:\.[A-Za-z0-9_-]{8,1200})?$/;
const ALLOWED_STATUSES = new Set(["active", "revoked", "blocked", "disabled", "deleted", "inactive"]);
const MAX_TOKENS = 50000;
const PAYPAL_PENDING_TTL_SECONDS = 2 * 24 * 60 * 60;
const PAYPAL_CAPTURED_TTL_SECONDS = 30 * 24 * 60 * 60;

const paypalTokenCache = {
  token: "",
  expiresAt: 0,
  apiBase: ""
};

function buildCorsHeaders(env, request) {
  const requestOrigin = request.headers.get("Origin") || "";
  const allowedOrigins = String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  let origin = "*";
  if (requestOrigin && requestOrigin !== "null") {
    if (allowedOrigins.length === 0) {
      origin = requestOrigin;
    } else if (allowedOrigins.includes(requestOrigin)) {
      origin = requestOrigin;
    } else {
      origin = allowedOrigins[0];
    }
  } else if (allowedOrigins.length > 0) {
    origin = "*";
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, init, corsHeaders) {
  const headers = new Headers(init && init.headers ? init.headers : undefined);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  if (corsHeaders) {
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  }
  return new Response(JSON.stringify(data, null, 2), {
    status: (init && init.status) || 200,
    headers
  });
}

function constantTimeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function getAdminBearerToken(request) {
  const auth = String(request.headers.get("Authorization") || "").trim();
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return auth.slice(7).trim();
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 200);
}

function normalizeScope(value) {
  const scope = String(value || "private").trim().toLowerCase();
  return scope === "commercial" ? "commercial" : "private";
}

function normalizeIsoDate(value, fallbackIso) {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallbackIso;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackIso;
  }
  return parsed.toISOString();
}

function normalizeOptionalIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
}

function ensureRegistryShape(payload) {
  const nowIso = new Date().toISOString();
  const mode = String(payload && payload.mode ? payload.mode : "allowlist").trim().toLowerCase();
  const safeMode = mode === "denylist" ? "denylist" : "allowlist";
  const sourceTokens = Array.isArray(payload && payload.tokens) ? payload.tokens : [];

  const seen = new Set();
  const tokens = sourceTokens
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const tokenHash = normalizeText(entry.tokenHash || entry.hash || "", 128).toLowerCase();
      const statusRaw = normalizeText(entry.status || "active", 20).toLowerCase();
      const status = ALLOWED_STATUSES.has(statusRaw) ? statusRaw : "active";
      if (!VALID_TOKEN_HASH.test(tokenHash) || seen.has(tokenHash)) {
        return null;
      }
      seen.add(tokenHash);
      const issuedAt = normalizeIsoDate(entry.issuedAt, nowIso);
      return {
        tokenHash,
        status,
        reason: normalizeText(entry.reason || "", 240),
        scope: normalizeScope(entry.scope),
        ownerName: normalizeText(entry.ownerName || "", 120),
        email: normalizeEmail(entry.email || ""),
        purpose: normalizeText(entry.purpose || "", 200),
        deviceId: normalizeText(entry.deviceId || "", 200),
        plan: normalizeText(entry.plan || "", 60),
        expiresAt: normalizeOptionalIsoDate(entry.expiresAt),
        paymentProvider: normalizeText(entry.paymentProvider || "", 30),
        paymentRef: normalizeText(entry.paymentRef || "", 120),
        source: normalizeText(entry.source || "", 30),
        issuedAt,
        updatedAt: normalizeIsoDate(entry.updatedAt, nowIso)
      };
    })
    .filter(Boolean)
    .slice(0, MAX_TOKENS);

  return {
    version: 1,
    mode: safeMode,
    updatedAt: normalizeIsoDate(payload && payload.updatedAt, nowIso),
    tokens
  };
}

function defaultRegistry() {
  return {
    version: 1,
    mode: "allowlist",
    updatedAt: new Date().toISOString(),
    tokens: []
  };
}

async function readRegistry(env) {
  const stored = await env.LICENSE_REGISTRY_KV.get(REGISTRY_KEY, { type: "json" });
  if (!stored || typeof stored !== "object") {
    return defaultRegistry();
  }
  return ensureRegistryShape(stored);
}

async function writeRegistry(env, registry) {
  const normalized = ensureRegistryShape(registry);
  normalized.updatedAt = new Date().toISOString();
  await env.LICENSE_REGISTRY_KV.put(REGISTRY_KEY, JSON.stringify(normalized));
  return normalized;
}

async function sha256Hex(text) {
  const value = String(text || "");
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomTokenPart() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function requireAdminAuth(request, env, corsHeaders) {
  const expectedToken = String(env.ADMIN_TOKEN || "").trim();
  if (!expectedToken) {
    return json({ ok: false, error: "ADMIN_TOKEN is not configured" }, { status: 500 }, corsHeaders);
  }
  const providedToken = getAdminBearerToken(request);
  if (!providedToken || !constantTimeEqual(providedToken, expectedToken)) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 }, corsHeaders);
  }
  return null;
}

function findTokenEntry(registry, tokenHash) {
  return Array.isArray(registry.tokens)
    ? registry.tokens.find((entry) => String(entry.tokenHash || "") === String(tokenHash || "")) || null
    : null;
}

function getPayPalApiBase(env) {
  const configured = String(env.PAYPAL_API_BASE || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "https://api-m.paypal.com";
}

function readPayPalConfig(env) {
  const clientId = String(env.PAYPAL_CLIENT_ID || "").trim();
  const secret = String(env.PAYPAL_SECRET || "").trim();
  const enabled = Boolean(clientId && secret);
  const amountDefault = String(env.PAYPAL_COMMERCIAL_AMOUNT || "99.00").trim();
  const currencyDefault = String(env.PAYPAL_CURRENCY || "USD").trim().toUpperCase();
  const durationDaysRaw = Number.parseInt(String(env.PAYPAL_COMMERCIAL_DURATION_DAYS || "").trim(), 10);
  const durationDays = Number.isFinite(durationDaysRaw) && durationDaysRaw > 0 ? durationDaysRaw : 0;
  return {
    enabled,
    clientId,
    secret,
    apiBase: getPayPalApiBase(env),
    amountDefault,
    currencyDefault,
    returnUrl: String(env.PAYPAL_RETURN_URL || "").trim(),
    cancelUrl: String(env.PAYPAL_CANCEL_URL || "").trim(),
    durationDays
  };
}

function parseMoney(value, fallback) {
  const input = String(value || fallback || "").trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(input)) {
    return "";
  }
  const numeric = Number.parseFloat(input);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }
  return numeric.toFixed(2);
}

async function requestPayPalAccessToken(env) {
  const cfg = readPayPalConfig(env);
  if (!cfg.enabled) {
    throw new Error("PayPal is not configured");
  }
  const now = Date.now();
  if (
    paypalTokenCache.token &&
    paypalTokenCache.apiBase === cfg.apiBase &&
    paypalTokenCache.expiresAt > now + 30000
  ) {
    return paypalTokenCache.token;
  }

  const basic = btoa(`${cfg.clientId}:${cfg.secret}`);
  const response = await fetch(`${cfg.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }
  if (!response.ok || !payload || !payload.access_token) {
    const err = payload && payload.error_description ? payload.error_description : `HTTP ${response.status}`;
    throw new Error(`PayPal auth failed: ${err}`);
  }
  const expiresIn = Number.parseInt(String(payload.expires_in || "0"), 10);
  paypalTokenCache.token = String(payload.access_token);
  paypalTokenCache.apiBase = cfg.apiBase;
  paypalTokenCache.expiresAt = now + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 300000);
  return paypalTokenCache.token;
}

async function paypalApiJson(env, path, init) {
  const cfg = readPayPalConfig(env);
  const token = await requestPayPalAccessToken(env);
  const reqInit = init && typeof init === "object" ? init : {};
  const method = String(reqInit.method || "GET").toUpperCase();
  const response = await fetch(`${cfg.apiBase}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(reqInit.headers || {})
    },
    body: reqInit.body !== undefined ? JSON.stringify(reqInit.body) : undefined
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }
  if (!response.ok) {
    const details = payload && payload.details && payload.details[0] && payload.details[0].description
      ? String(payload.details[0].description)
      : payload && payload.message
        ? String(payload.message)
        : `HTTP ${response.status}`;
    throw new Error(`PayPal API error: ${details}`);
  }
  return payload || {};
}

async function issueLicenseToken(env, payload) {
  const scope = normalizeScope(payload && payload.scope);
  const ownerName = normalizeText(payload && payload.ownerName, 120);
  const email = normalizeEmail(payload && payload.email);
  const purpose = normalizeText(payload && payload.purpose, 200);
  const deviceId = normalizeText(payload && payload.deviceId, 200);
  const plan = normalizeText(payload && payload.plan, 60);
  const expiresAt = normalizeOptionalIsoDate(payload && payload.expiresAt);
  const paymentProvider = normalizeText(payload && payload.paymentProvider, 30);
  const paymentRef = normalizeText(payload && payload.paymentRef, 120);
  const source = normalizeText(payload && payload.source, 30);
  const reason = normalizeText(payload && payload.reason, 240) || "Token aktywny";

  if (!ownerName) {
    throw new Error("ownerName is required");
  }
  if (!email || !email.includes("@")) {
    throw new Error("valid email is required");
  }
  if (!deviceId || deviceId.length < 8) {
    throw new Error("valid deviceId is required");
  }
  if (scope === "private" && !purpose) {
    throw new Error("purpose is required");
  }

  const token = `${TOKEN_PREFIX}.${randomTokenPart()}`;
  const tokenHash = await sha256Hex(token);
  const nowIso = new Date().toISOString();

  const registry = await readRegistry(env);
  const entry = {
    tokenHash,
    status: "active",
    reason,
    scope,
    ownerName,
    email,
    purpose,
    deviceId,
    plan,
    expiresAt,
    paymentProvider,
    paymentRef,
    source,
    issuedAt: nowIso,
    updatedAt: nowIso
  };
  const filtered = Array.isArray(registry.tokens)
    ? registry.tokens.filter((item) => String(item.tokenHash || "") !== tokenHash)
    : [];
  registry.tokens = [entry, ...filtered].slice(0, MAX_TOKENS);
  await writeRegistry(env, registry);

  return {
    token,
    payload: {
      v: 2,
      scope,
      ownerName,
      email,
      purpose,
      deviceId,
      plan,
      expiresAt,
      issuedAt: nowIso,
      paymentProvider,
      paymentRef,
      source
    }
  };
}

function getPayPalOrderKey(orderId) {
  return `${PAYPAL_ORDER_KEY_PREFIX}${String(orderId || "").trim()}`;
}

function makeExpiresAtFromDurationDays(durationDays) {
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return "";
  }
  const date = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

async function handleIssuePrivateToken(request, env, corsHeaders) {
  let payload = null;
  try {
    payload = await request.json();
  } catch (_error) {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 }, corsHeaders);
  }

  const ownerName = normalizeText(payload && payload.ownerName, 120);
  const email = normalizeEmail(payload && payload.email);
  const purpose = normalizeText(payload && payload.purpose, 200);
  const deviceId = normalizeText(payload && payload.deviceId, 200);

  if (!ownerName) {
    return json({ ok: false, error: "ownerName is required" }, { status: 400 }, corsHeaders);
  }
  if (!email || !email.includes("@")) {
    return json({ ok: false, error: "valid email is required" }, { status: 400 }, corsHeaders);
  }
  if (!purpose) {
    return json({ ok: false, error: "purpose is required" }, { status: 400 }, corsHeaders);
  }
  if (!deviceId || deviceId.length < 8) {
    return json({ ok: false, error: "valid deviceId is required" }, { status: 400 }, corsHeaders);
  }

  let issued = null;
  try {
    issued = await issueLicenseToken(env, {
      scope: "private",
      ownerName,
      email,
      purpose,
      deviceId,
      reason: "Token aktywny",
      source: "self-service"
    });
  } catch (error) {
    return json({ ok: false, error: String(error && error.message ? error.message : "issue failed") }, { status: 400 }, corsHeaders);
  }

  return json(
    {
      ok: true,
      token: issued.token,
      payload: issued.payload
    },
    { status: 200 },
    corsHeaders
  );
}

async function handlePayPalCreateOrder(request, env, corsHeaders) {
  const cfg = readPayPalConfig(env);
  if (!cfg.enabled) {
    return json({ ok: false, error: "PayPal is not configured" }, { status: 503 }, corsHeaders);
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch (_error) {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 }, corsHeaders);
  }

  const ownerName = normalizeText(payload && payload.ownerName, 120);
  const email = normalizeEmail(payload && payload.email);
  const purpose = normalizeText(payload && payload.purpose, 200);
  const deviceId = normalizeText(payload && payload.deviceId, 200);
  const plan = normalizeText(payload && payload.plan, 60) || "commercial";
  const amount = parseMoney(payload && payload.amount, cfg.amountDefault);
  const currency = normalizeText(payload && payload.currency, 6).toUpperCase() || cfg.currencyDefault;

  if (!ownerName) {
    return json({ ok: false, error: "ownerName is required" }, { status: 400 }, corsHeaders);
  }
  if (!email || !email.includes("@")) {
    return json({ ok: false, error: "valid email is required" }, { status: 400 }, corsHeaders);
  }
  if (!deviceId || deviceId.length < 8) {
    return json({ ok: false, error: "valid deviceId is required" }, { status: 400 }, corsHeaders);
  }
  if (!amount) {
    return json({ ok: false, error: "valid amount is required" }, { status: 400 }, corsHeaders);
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return json({ ok: false, error: "valid currency is required" }, { status: 400 }, corsHeaders);
  }

  const orderBody = {
    intent: "CAPTURE",
    purchase_units: [
      {
        description: "MadCAD commercial license",
        amount: {
          currency_code: currency,
          value: amount
        },
        custom_id: "madcad-commercial"
      }
    ],
    application_context: {
      user_action: "PAY_NOW",
      shipping_preference: "NO_SHIPPING"
    }
  };
  if (cfg.returnUrl && cfg.cancelUrl) {
    orderBody.application_context.return_url = cfg.returnUrl;
    orderBody.application_context.cancel_url = cfg.cancelUrl;
  }

  let order = null;
  try {
    order = await paypalApiJson(env, "/v2/checkout/orders", {
      method: "POST",
      body: orderBody
    });
  } catch (error) {
    return json(
      { ok: false, error: String(error && error.message ? error.message : "PayPal order failed") },
      { status: 502 },
      corsHeaders
    );
  }

  const orderId = normalizeText(order && order.id, 80);
  const approveUrl = Array.isArray(order && order.links)
    ? String((order.links.find((link) => link && link.rel === "approve") || {}).href || "").trim()
    : "";
  if (!orderId || !approveUrl) {
    return json({ ok: false, error: "Invalid PayPal create-order response" }, { status: 502 }, corsHeaders);
  }

  const nowIso = new Date().toISOString();
  const orderRecord = {
    status: "pending",
    createdAt: nowIso,
    ownerName,
    email,
    purpose,
    deviceId,
    plan,
    amount,
    currency
  };
  await env.LICENSE_REGISTRY_KV.put(
    getPayPalOrderKey(orderId),
    JSON.stringify(orderRecord),
    { expirationTtl: PAYPAL_PENDING_TTL_SECONDS }
  );

  return json(
    {
      ok: true,
      orderId,
      approveUrl,
      amount,
      currency
    },
    { status: 200 },
    corsHeaders
  );
}

async function handlePayPalCaptureOrder(request, env, corsHeaders) {
  const cfg = readPayPalConfig(env);
  if (!cfg.enabled) {
    return json({ ok: false, error: "PayPal is not configured" }, { status: 503 }, corsHeaders);
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch (_error) {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 }, corsHeaders);
  }
  const orderId = normalizeText(payload && payload.orderId, 80);
  if (!/^[A-Z0-9-]{10,80}$/.test(orderId)) {
    return json({ ok: false, error: "valid orderId is required" }, { status: 400 }, corsHeaders);
  }

  const key = getPayPalOrderKey(orderId);
  const stored = await env.LICENSE_REGISTRY_KV.get(key, { type: "json" });
  if (!stored || typeof stored !== "object") {
    return json({ ok: false, error: "Order not found or expired" }, { status: 404 }, corsHeaders);
  }
  if (String(stored.status || "").toLowerCase() === "captured" && stored.token) {
    return json(
      {
        ok: true,
        orderId,
        token: String(stored.token),
        payload: stored.payload && typeof stored.payload === "object" ? stored.payload : {}
      },
      { status: 200 },
      corsHeaders
    );
  }

  let capture = null;
  try {
    capture = await paypalApiJson(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      body: {}
    });
  } catch (error) {
    return json(
      { ok: false, error: String(error && error.message ? error.message : "PayPal capture failed") },
      { status: 502 },
      corsHeaders
    );
  }

  const status = normalizeText(capture && capture.status, 40).toUpperCase();
  if (status !== "COMPLETED") {
    return json({ ok: false, error: `Order status is ${status || "unknown"}` }, { status: 409 }, corsHeaders);
  }
  const purchaseUnit = Array.isArray(capture && capture.purchase_units) ? capture.purchase_units[0] : null;
  const captureItem = purchaseUnit && purchaseUnit.payments && Array.isArray(purchaseUnit.payments.captures)
    ? purchaseUnit.payments.captures[0]
    : null;
  const paidAmount = normalizeText(
    captureItem && captureItem.amount && captureItem.amount.value
      ? captureItem.amount.value
      : purchaseUnit && purchaseUnit.amount && purchaseUnit.amount.value
        ? purchaseUnit.amount.value
        : "",
    40
  );
  const paidCurrency = normalizeText(
    captureItem && captureItem.amount && captureItem.amount.currency_code
      ? captureItem.amount.currency_code
      : purchaseUnit && purchaseUnit.amount && purchaseUnit.amount.currency_code
        ? purchaseUnit.amount.currency_code
        : "",
    8
  ).toUpperCase();
  if (stored.amount && paidAmount && stored.amount !== paidAmount) {
    return json({ ok: false, error: "Captured amount mismatch" }, { status: 409 }, corsHeaders);
  }
  if (stored.currency && paidCurrency && stored.currency !== paidCurrency) {
    return json({ ok: false, error: "Captured currency mismatch" }, { status: 409 }, corsHeaders);
  }

  let issued = null;
  try {
    issued = await issueLicenseToken(env, {
      scope: "commercial",
      ownerName: normalizeText(stored.ownerName, 120),
      email: normalizeEmail(stored.email),
      purpose: normalizeText(stored.purpose || "commercial-license", 200),
      deviceId: normalizeText(stored.deviceId, 200),
      plan: normalizeText(stored.plan || "commercial", 60),
      expiresAt: makeExpiresAtFromDurationDays(cfg.durationDays),
      paymentProvider: "paypal",
      paymentRef: normalizeText(captureItem && captureItem.id ? captureItem.id : orderId, 120),
      source: "paypal",
      reason: "Token aktywny (PayPal)"
    });
  } catch (error) {
    return json(
      { ok: false, error: String(error && error.message ? error.message : "Token issue failed") },
      { status: 500 },
      corsHeaders
    );
  }

  const nextRecord = {
    ...stored,
    status: "captured",
    capturedAt: new Date().toISOString(),
    token: issued.token,
    payload: issued.payload
  };
  await env.LICENSE_REGISTRY_KV.put(
    key,
    JSON.stringify(nextRecord),
    { expirationTtl: PAYPAL_CAPTURED_TTL_SECONDS }
  );

  return json(
    {
      ok: true,
      orderId,
      token: issued.token,
      payload: issued.payload
    },
    { status: 200 },
    corsHeaders
  );
}

async function handleVerifyToken(request, env, corsHeaders) {
  let payload = null;
  try {
    payload = await request.json();
  } catch (_error) {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 }, corsHeaders);
  }

  const token = normalizeText(payload && payload.token, 320);
  const deviceId = normalizeText(payload && payload.deviceId, 200);
  if (!VALID_TOKEN_FORMAT.test(token)) {
    return json({ ok: false, error: "Invalid token format" }, { status: 400 }, corsHeaders);
  }

  const tokenHash = await sha256Hex(token);
  const registry = await readRegistry(env);
  const entry = findTokenEntry(registry, tokenHash);

  if (!entry) {
    return json({ ok: false, error: "Token not found" }, { status: 404 }, corsHeaders);
  }
  if (String(entry.status || "").toLowerCase() !== "active") {
    return json({ ok: false, error: "Token is not active" }, { status: 403 }, corsHeaders);
  }
  if (entry.deviceId && deviceId && entry.deviceId !== deviceId) {
    return json({ ok: false, error: "Token is bound to a different device" }, { status: 403 }, corsHeaders);
  }

  return json(
    {
      ok: true,
      tokenHash,
      payload: {
        v: 2,
        scope: normalizeScope(entry.scope),
        ownerName: normalizeText(entry.ownerName, 120),
        email: normalizeEmail(entry.email),
        purpose: normalizeText(entry.purpose, 200),
        deviceId: normalizeText(entry.deviceId || deviceId, 200),
        issuedAt: normalizeIsoDate(entry.issuedAt, new Date().toISOString())
      }
    },
    { status: 200 },
    corsHeaders
  );
}

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(env, request);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/healthz") {
      return json({ ok: true, service: "madcad-license-registry" }, { status: 200 }, corsHeaders);
    }

    if (url.pathname === "/v1/license-tokens/issue-private" && request.method === "POST") {
      return handleIssuePrivateToken(request, env, corsHeaders);
    }

    if (url.pathname === "/v1/paypal/create-order" && request.method === "POST") {
      return handlePayPalCreateOrder(request, env, corsHeaders);
    }

    if (url.pathname === "/v1/paypal/capture-order" && request.method === "POST") {
      return handlePayPalCaptureOrder(request, env, corsHeaders);
    }

    if (url.pathname === "/v1/license-tokens/verify" && request.method === "POST") {
      return handleVerifyToken(request, env, corsHeaders);
    }

    if (url.pathname === "/v1/license-registry") {
      if (request.method === "GET") {
        const registry = await readRegistry(env);
        return json(registry, { status: 200 }, corsHeaders);
      }

      if (request.method === "POST") {
        const authError = requireAdminAuth(request, env, corsHeaders);
        if (authError) {
          return authError;
        }

        let payload = null;
        try {
          payload = await request.json();
        } catch (_error) {
          return json({ ok: false, error: "Invalid JSON body" }, { status: 400 }, corsHeaders);
        }

        const normalized = await writeRegistry(env, payload);
        return json(
          { ok: true, updatedAt: normalized.updatedAt, tokenCount: normalized.tokens.length },
          { status: 200 },
          corsHeaders
        );
      }

      return json({ ok: false, error: "Method not allowed" }, { status: 405 }, corsHeaders);
    }

    return json({ ok: false, error: "Not found" }, { status: 404 }, corsHeaders);
  }
};
