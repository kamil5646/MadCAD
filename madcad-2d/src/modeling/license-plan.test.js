import { describe, expect, it } from 'vitest';
import { DEFAULT_LICENSE_STATUS, describeLicensePlan, normalizeLicenseStatus } from './license-plan.js';

describe('server-controlled license status', () => {
  it('defaults to private personal use without an account', () => {
    expect(normalizeLicenseStatus(null)).toEqual(DEFAULT_LICENSE_STATUS);
    expect(describeLicensePlan(null)).toMatchObject({ mode: 'personal', label: 'Osobista', expired: false });
  });

  it('accepts only entitlement states returned by the desktop service', () => {
    expect(describeLicensePlan({ mode: 'commercial-trial', daysRemaining: 17 }).label).toContain('17 dni');
    expect(describeLicensePlan({ mode: 'commercial' })).toMatchObject({ label: 'Komercyjna' });
    expect(describeLicensePlan({ mode: 'commercial-licensed' })).toMatchObject({ mode: 'personal' });
  });

  it('requires an online refresh after an expired lease or clock rollback', () => {
    expect(describeLicensePlan({ needsOnlineCheck: true }).expired).toBe(true);
    expect(describeLicensePlan({ clockRollback: true }).detail).toContain('online');
  });
});
