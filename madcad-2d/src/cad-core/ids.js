let sequence = 0;

export function createId(prefix = 'item') {
  sequence += 1;
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}-${sequence.toString(36)}`;
}
