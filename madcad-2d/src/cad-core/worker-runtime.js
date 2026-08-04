export class SerialTaskQueue {
  constructor() {
    this.tail = Promise.resolve();
  }

  enqueue(task) {
    const run = this.tail.then(task, task);
    this.tail = run.catch(() => {});
    return run;
  }
}

export function estimateMeshBytes(bodies = []) {
  return bodies.reduce((total, body) => total
    + (body.vertices?.byteLength || 0)
    + (body.normals?.byteLength || 0)
    + (body.triangles?.byteLength || 0)
    + (body.lines?.byteLength || 0), 0);
}

export class RevisionCache {
  constructor({ maxEntries = 3, maxBytes = 192 * 1024 * 1024, onEvict = null } = {}) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.entries = new Map();
    this.totalBytes = 0;
    this.onEvict = typeof onEvict === 'function' ? onEvict : null;
  }

  get(revision) {
    const entry = this.entries.get(revision);
    if (!entry) return null;
    this.entries.delete(revision);
    this.entries.set(revision, entry);
    return entry.value;
  }

  set(revision, value, byteSize = 0) {
    if (this.entries.has(revision)) {
      this.totalBytes -= this.entries.get(revision).byteSize;
      this.entries.delete(revision);
    }
    this.entries.set(revision, { value, byteSize: Math.max(0, Number(byteSize) || 0) });
    this.totalBytes += Math.max(0, Number(byteSize) || 0);
    this.evict();
  }

  evict() {
    while (this.entries.size > this.maxEntries || (this.totalBytes > this.maxBytes && this.entries.size > 1)) {
      const oldestRevision = this.entries.keys().next().value;
      if (oldestRevision === undefined) break;
      const oldest = this.entries.get(oldestRevision);
      this.entries.delete(oldestRevision);
      this.totalBytes -= oldest.byteSize;
      this.onEvict?.(oldest.value, oldestRevision);
    }
  }

  clear() {
    if (this.onEvict) {
      for (const [revision, entry] of this.entries) this.onEvict(entry.value, revision);
    }
    this.entries.clear();
    this.totalBytes = 0;
  }

  get stats() {
    return { entries: this.entries.size, bytes: this.totalBytes };
  }
}

export function isStaleRevision(revision, latestRequestedRevision) {
  return Number.isInteger(revision) && revision < latestRequestedRevision;
}

export class WorkerRecoveryPolicy {
  constructor({ maxAttempts = 3, baseDelayMs = 250, maxDelayMs = 750 } = {}) {
    this.maxAttempts = maxAttempts;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.attempts = 0;
  }

  recordCrash() {
    this.attempts += 1;
    return {
      attempt: this.attempts,
      shouldRestart: this.attempts <= this.maxAttempts,
      delayMs: Math.min(this.baseDelayMs * this.attempts, this.maxDelayMs),
    };
  }

  recordSuccess() {
    this.attempts = 0;
  }
}
