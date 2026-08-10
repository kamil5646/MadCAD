const SAFE_EXTERNAL_PROTOCOLS = new Set(['https:']);

function normalizeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (!SAFE_EXTERNAL_PROTOCOLS.has(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch (_error) {
    return null;
  }
}

function isTrustedAppNavigation(target, current, developmentOrigin = '') {
  try {
    const next = new URL(String(target || ''));
    const active = new URL(String(current || ''));
    if (next.protocol === 'file:' && active.protocol === 'file:' && next.pathname === active.pathname) return true;
    if (developmentOrigin && next.origin === developmentOrigin && active.origin === developmentOrigin) return true;
    return next.href === active.href;
  } catch (_error) {
    return false;
  }
}

function isTrustedIpcUrl(value, appEntryUrl, developmentOrigin = '') {
  try {
    const sender = new URL(String(value || ''));
    if (developmentOrigin && sender.origin === developmentOrigin) return true;
    const entry = new URL(String(appEntryUrl || ''));
    return sender.protocol === 'file:' && entry.protocol === 'file:' && sender.pathname === entry.pathname;
  } catch (_error) {
    return false;
  }
}

module.exports = { SAFE_EXTERNAL_PROTOCOLS, isTrustedAppNavigation, isTrustedIpcUrl, normalizeExternalUrl };
