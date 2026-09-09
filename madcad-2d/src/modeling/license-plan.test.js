import { describe, expect, it } from 'vitest';
import { COMMERCIAL_TRIAL_DAYS, describeLicensePlan, loadLicensePlan, saveLicensePlan, selectLicensePlan } from './license-plan.js';

describe('license plan', () => {
  it('defaults to unlimited personal use and starts a commercial trial only once', () => {
    const start = Date.UTC(2026, 8, 9);
    const personal = loadLicensePlan({ getItem: () => null }, start);
    expect(describeLicensePlan(personal, start)).toMatchObject({ mode: 'personal', label: 'Osobista', expired: false });
    const trial = selectLicensePlan(personal, 'commercial-trial', start);
    expect(describeLicensePlan(trial, start)).toMatchObject({ daysRemaining: COMMERCIAL_TRIAL_DAYS, expired: false });
    const returned = selectLicensePlan(selectLicensePlan(trial, 'personal', start + 10), 'commercial-trial', start + 20);
    expect(returned.trialStartedAt).toBe(start);
  });

  it('expires evaluation after 40 days and records purchase confirmation without a key', () => {
    const start = Date.UTC(2026, 8, 9);
    const trial = selectLicensePlan(null, 'commercial-trial', start);
    expect(describeLicensePlan(trial, start + 40 * 24 * 60 * 60 * 1000)).toMatchObject({ daysRemaining: 0, expired: true });
    const licensed = selectLicensePlan(trial, 'commercial-licensed', start + 41);
    expect(describeLicensePlan(licensed, start + 42)).toMatchObject({ label: 'Komercyjna', expired: false });
    expect(licensed.commercialConfirmedAt).toBe(start + 41);
  });

  it('round-trips local state and tolerates unavailable storage', () => {
    let raw = '';
    const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
    const plan = selectLicensePlan(null, 'commercial-trial', 1234);
    expect(saveLicensePlan(plan, storage)).toBe(true);
    expect(loadLicensePlan(storage, 5678)).toMatchObject({ mode: 'commercial-trial', trialStartedAt: 1234 });
    expect(saveLicensePlan(plan, { setItem: () => { throw new Error('blocked'); } })).toBe(false);
    expect(loadLicensePlan({ getItem: () => '{broken' }, 5678)).toMatchObject({ mode: 'personal' });
  });
});
