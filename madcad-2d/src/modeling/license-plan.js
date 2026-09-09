export const DEFAULT_LICENSE_STATUS = Object.freeze({
  mode: 'personal', signedIn: false, account: null, installationId: '', licenseId: '', seats: null,
  expiresAt: null, daysRemaining: null, lastServerCheckAt: null, offlineUntil: null,
  connection: 'offline', needsOnlineCheck: false, clockRollback: false,
});

const MODES = new Set(['personal', 'commercial-trial', 'commercial']);

export function normalizeLicenseStatus(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...DEFAULT_LICENSE_STATUS,
    ...source,
    mode: MODES.has(source.mode) ? source.mode : 'personal',
    signedIn: Boolean(source.signedIn),
    account: source.account && typeof source.account === 'object' ? source.account : null,
  };
}

export function describeLicensePlan(value) {
  const status = normalizeLicenseStatus(value);
  if (status.mode === 'commercial') {
    return { ...status, label: 'Komercyjna', detail: status.expiresAt ? `Ważna do ${new Date(status.expiresAt).toLocaleDateString('pl-PL')}` : 'Aktywna licencja firmowa', expired: false };
  }
  if (status.mode === 'commercial-trial') {
    return { ...status, label: `Ocena komercyjna · ${Math.max(0, status.daysRemaining || 0)} dni`, detail: 'Pełna funkcjonalność w okresie oceny', expired: false };
  }
  if (status.clockRollback) return { ...status, label: 'Osobista', detail: 'Zaloguj się online, aby ponownie sprawdzić datę licencji', expired: true };
  if (status.needsOnlineCheck) return { ...status, label: 'Osobista', detail: 'Wymagane ponowne sprawdzenie licencji online', expired: true };
  return { ...status, label: 'Osobista', detail: 'Tylko użytek prywatny, edukacyjny i niezarobkowy', expired: false };
}
