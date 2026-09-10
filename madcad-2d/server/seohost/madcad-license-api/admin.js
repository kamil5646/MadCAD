/* global document, fetch */
(() => {
  'use strict';
  const tokenInput = document.querySelector('#adminToken');
  const usersRoot = document.querySelector('#users');
  const status = document.querySelector('#status');

  function element(name, text, className) {
    const node = document.createElement(name);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  async function request(route, payload = {}) {
    const adminToken = tokenInput.value.trim();
    if (adminToken.length < 32) throw new Error('Podaj pełny sekret administratora.');
    const response = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ ...payload, adminToken }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.error || `Serwer zwrócił HTTP ${response.status}.`);
    return result;
  }

  function actionButton(label, className, action) {
    const button = element('button', label, className);
    button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await action(); await loadUsers(); } catch (error) { setStatus(error.message, true); } finally { button.disabled = false; }
    });
    return button;
  }

  function renderUser(user) {
    const card = element('article');
    const head = element('div', undefined, 'account-head');
    const identity = element('div', undefined, 'identity');
    identity.append(element('strong', user.displayName || user.email), element('small', user.email));
    const plan = element('div', undefined, 'plan');
    plan.append(element('strong', user.entitlement?.plan || 'personal'), element('small', `Stanowiska: ${user.entitlement?.seats || 1}`));
    head.append(identity, plan);
    const actions = element('div', undefined, 'actions');
    const seats = document.createElement('input');
    seats.type = 'number'; seats.min = '1'; seats.max = '1000'; seats.value = String(user.entitlement?.seats || 1); seats.setAttribute('aria-label', `Liczba stanowisk ${user.email}`);
    const expiry = document.createElement('input');
    expiry.type = 'date'; expiry.setAttribute('aria-label', `Data wygaśnięcia ${user.email}`);
    actions.append(seats, expiry,
      actionButton('Nadaj komercyjną', 'primary', () => request('admin/grant-commercial', { email: user.email, seats: Number(seats.value), expiresAt: expiry.value ? `${expiry.value}T23:59:59Z` : '' })),
      actionButton('Cofnij komercyjną', 'danger', () => request('admin/revoke-commercial', { email: user.email })));
    const devices = element('div', undefined, 'devices');
    for (const device of user.devices || []) {
      const row = element('div', undefined, 'device');
      row.append(element('code', `${device.installationId} · ${device.lastPlan}${device.revoked ? ' · cofnięte' : ''}`));
      if (!device.revoked) row.append(actionButton('Zwolnij urządzenie', 'danger', () => request('admin/revoke-device', { email: user.email, installationId: device.installationId })));
      devices.append(row);
    }
    card.append(head, actions, devices);
    return card;
  }

  async function loadUsers() {
    setStatus('Pobieranie kont…');
    try {
      const result = await request('admin/users');
      usersRoot.replaceChildren(...(result.users?.length ? result.users.map(renderUser) : [element('p', 'Brak zarejestrowanych kont.', 'empty')]));
      setStatus(`Konta: ${result.users?.length || 0}.`);
    } catch (error) {
      usersRoot.replaceChildren();
      setStatus(error.message, true);
    }
  }

  document.querySelector('#connectBtn').addEventListener('click', loadUsers);
  document.querySelector('#refreshBtn').addEventListener('click', loadUsers);
  tokenInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadUsers(); });
})();
