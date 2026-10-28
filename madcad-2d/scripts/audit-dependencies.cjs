// `npm audit --audit-level=high` with a short, explicit list of accepted advisories.
// An entry is allowed only while it has no upstream fix, names why it does not reach
// MadCAD users and has an expiry date; after that date the audit fails again.
const { execFileSync } = require('node:child_process');

const ACCEPTED = [
  {
    id: 'GHSA-ch52-4w7c-c8xp',
    packages: ['http-cache-semantics'],
    reason: 'Only reached through electron-builder -> @electron/get -> got, which downloads Electron at build time. '
      + 'The advisory concerns shared HTTP caches serving several users; nothing in the shipped app uses it. No patched version exists yet.',
    expires: '2026-10-31',
  },
];

const BLOCKING = new Set(['high', 'critical']);
const today = new Date().toISOString().slice(0, 10);

let output;
try {
  output = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  // npm audit exits non-zero whenever it finds anything; the JSON is still on stdout.
  output = error.stdout;
  if (!output) throw error;
}

let report;
try {
  report = JSON.parse(output);
} catch {
  console.error(`[audit] npm audit did not return a report:\n${String(output).slice(0, 2000)}`);
  process.exit(1);
}
// A registry or network failure also exits non-zero with JSON on stdout, but
// without a vulnerability report; treat it as a failed audit, never a pass.
if (report.error || !report.vulnerabilities || typeof report.vulnerabilities !== 'object' || !report.metadata?.vulnerabilities) {
  console.error(`[audit] npm audit failed: ${JSON.stringify(report.error || report).slice(0, 2000)}`);
  process.exit(1);
}
const advisories = new Map();
for (const [name, entry] of Object.entries(report.vulnerabilities || {})) {
  for (const via of entry.via || []) {
    if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue;
    const id = String(via.url || '').split('/').pop() || `${name}:${via.source}`;
    advisories.set(id, { id, name, title: via.title, severity: via.severity });
  }
}

const failures = [];
for (const advisory of advisories.values()) {
  const accepted = ACCEPTED.find((item) => item.id === advisory.id && item.packages.includes(advisory.name));
  if (!accepted) failures.push(`${advisory.severity} ${advisory.id} ${advisory.name}: ${advisory.title}`);
  else if (accepted.expires < today) failures.push(`${advisory.id} acceptance expired on ${accepted.expires}; update the dependency or review the exception.`);
  else console.log(`[audit] accepted until ${accepted.expires}: ${advisory.id} ${advisory.name} — ${accepted.reason}`);
}

if (failures.length) {
  console.error(`[audit] ${failures.length} blocking advisory(ies):\n${failures.map((line) => `  - ${line}`).join('\n')}`);
  process.exit(1);
}
console.log(`[audit] no unaccepted high or critical advisories (${advisories.size} accepted).`);
