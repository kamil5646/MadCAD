import { describe, expect, it } from 'vitest';
import { DEFAULT_LICENSE_STATUS, describeLicensePlan, normalizeLicenseStatus } from './license-plan.js';

describe('server-controlled license status', () => {
  it('defaults to a blocked personal plan until an account is verified', () => {
    expect(normalizeLicenseStatus(null)).toEqual(DEFAULT_LICENSE_STATUS);
    expect(describeLicensePlan(null)).toMatchObject({ mode: 'personal', label: 'Wymagane konto', accessAllowed: false, expired: true });
  });

  it('accepts only entitlement states returned by the desktop service', () => {
    expect(describeLicensePlan({ mode: 'commercial-trial', daysRemaining: 17, accessAllowed: true }).label).toContain('17 dni');
    expect(describeLicensePlan({ mode: 'commercial', accessAllowed: true })).toMatchObject({ label: 'Komercyjna' });
    expect(describeLicensePlan({ mode: 'commercial-licensed' })).toMatchObject({ mode: 'personal' });
  });

  it('requires an online refresh after an expired lease or clock rollback', () => {
    expect(describeLicensePlan({ signedIn: true, needsOnlineCheck: true }).expired).toBe(true);
    expect(describeLicensePlan({ signedIn: true, clockRollback: true }).detail).toContain('internetem');
  });
});
