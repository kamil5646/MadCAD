'use strict';

const crypto = require('crypto');

const CHANNELS = Object.freeze(['stable', 'beta', 'alpha']);
const TRUSTED_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);

function parseVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta)(?:[.-](\d+))?)?$/i);
  if (!match) return null;
  return {
    raw: String(value).trim().replace(/^v/i, ''),
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    channel: match[4] ? match[4].toLowerCase() : 'stable',
    sequence: Number(match[5] || 0),
  };
}

function normalizeChannel(value, fallbackVersion = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (CHANNELS.includes(normalized)) return normalized;
  return parseVersion(fallbackVersion)?.channel || 'stable';
}

function compareVersions(leftValue, rightValue) {
  const left = typeof leftValue === 'object' ? leftValue : parseVersion(leftValue);
  const right = typeof rightValue === 'object' ? rightValue : parseVersion(rightValue);
  if (!left || !right) return 0;
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }
  const rank = { alpha: 0, beta: 1, stable: 2 };
  if (rank[left.channel] !== rank[right.channel]) return rank[left.channel] > rank[right.channel] ? 1 : -1;
  if (left.sequence !== right.sequence) return left.sequence > right.sequence ? 1 : -1;
  return 0;
}

function channelAccepts(channel, version) {
  const normalized = normalizeChannel(channel);
  const parsed = typeof version === 'object' ? version : parseVersion(version);
  if (!parsed) return false;
  if (normalized === 'stable') return parsed.channel === 'stable';
  if (normalized === 'beta') return parsed.channel === 'stable' || parsed.channel === 'beta';
  return true;
}

function selectLatestRelease(releases, channel, currentVersion) {
  const current = parseVersion(currentVersion);
  return (Array.isArray(releases) ? releases : [])
    .filter((release) => release && !release.draft)
    .map((release) => ({ release, version: parseVersion(release.tag_name || release.name) }))
    .filter((entry) => entry.version && channelAccepts(channel, entry.version))
    .filter((entry) => !current || compareVersions(entry.version, current) > 0)
    .sort((left, right) => compareVersions(right.version, left.version))[0] || null;
}

function isTrustedUpdateUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && TRUSTED_DOWNLOAD_HOSTS.has(url.hostname.toLowerCase());
  } catch (_error) {
    return false;
  }
}

function parseChecksumFile(text, assetName) {
  const expectedName = String(assetName || '').trim();
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+[*]?(.+)$/i);
    if (match && match[2].trim() === expectedName) return match[1].toLowerCase();
  }
  return null;
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function verifyBufferChecksum(buffer, expectedHash) {
  const expected = String(expectedHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;
  const actual = sha256Buffer(buffer);
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

module.exports = {
  CHANNELS,
  channelAccepts,
  compareVersions,
  isTrustedUpdateUrl,
  normalizeChannel,
  parseChecksumFile,
  parseVersion,
  selectLatestRelease,
  sha256Buffer,
  verifyBufferChecksum,
};
