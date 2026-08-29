const path = require('path');
const { app, BrowserWindow } = require('electron');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

function axValue(node, field) {
  return String(node?.[field]?.value || '').trim();
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-assistive-verifier-${Date.now()}` },
  });
  window.setContentSize(1440, 837);
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog') && document.querySelector('.engine-status.ready')`, 'gotowy interfejs CAD', 45000);
    await window.webContents.executeJavaScript(`document.querySelector('.app-help-menu summary')?.click()`);
    await waitFor(window, `document.querySelector('.app-help-menu')?.open`, 'otwarte menu pomocy');

    window.webContents.debugger.attach('1.3');
    await window.webContents.debugger.sendCommand('Accessibility.enable');
    const { nodes } = await window.webContents.debugger.sendCommand('Accessibility.getFullAXTree', { depth: -1 });
    const interactiveRoles = new Set(['button', 'checkbox', 'combobox', 'link', 'slider', 'tab', 'textbox']);
    const interactive = nodes.filter((node) => interactiveRoles.has(axValue(node, 'role')) && !node.ignored);
    const unnamed = interactive.filter((node) => !axValue(node, 'name')).map((node) => ({ role: axValue(node, 'role'), nodeId: node.nodeId }));
    const names = interactive.map((node) => axValue(node, 'name')).filter(Boolean);
    const requiredNames = ['Pokaż lub ukryj przeglądarkę', 'Nowy projekt', 'Otwórz projekt', 'Język interfejsu', 'Samouczek pierwszego projektu CAD'];
    const missingRequiredNames = requiredNames.filter((name) => !names.includes(name));

    await window.webContents.executeJavaScript(`document.body.focus()`);
    const focusSequence = [];
    for (let index = 0; index < 14; index += 1) {
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
      await new Promise((resolve) => setTimeout(resolve, 30));
      focusSequence.push(await window.webContents.executeJavaScript(`(() => {
        const element = document.activeElement;
        const rect = element?.getBoundingClientRect?.();
        return {
          tag: element?.tagName || '',
          name: element?.getAttribute?.('aria-label') || element?.getAttribute?.('title') || element?.textContent?.trim().slice(0, 80) || '',
          visible: Boolean(rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth),
        };
      })()`));
    }
    const distinctFocusNames = [...new Set(focusSequence.filter((item) => item.visible && item.name).map((item) => item.name))];
    const roles = nodes.reduce((counts, node) => {
      const role = axValue(node, 'role');
      if (role && !node.ignored) counts[role] = (counts[role] || 0) + 1;
      return counts;
    }, {});
    await window.webContents.executeJavaScript(`(() => {
      const trigger = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Utwórz szkic'));
      if (!trigger) throw new Error('Brak przycisku Utwórz szkic');
      trigger.focus();
      trigger.click();
    })()`);
    await waitFor(window, `document.querySelector('.plane-picker[role="dialog"][aria-modal="true"]')`, 'modal wyboru płaszczyzny');
    const planeDialogInitial = await window.webContents.executeJavaScript(`(() => {
      const dialog = document.querySelector('.plane-picker');
      return {
        name: dialog?.getAttribute('aria-labelledby') ? document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent.trim() : '',
        focusInside: Boolean(dialog?.contains(document.activeElement)),
        activeText: document.activeElement?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      };
    })()`);
    await window.webContents.executeJavaScript(`document.querySelector('.plane-picker header button')?.focus()`);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab', modifiers: ['shift'] });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab', modifiers: ['shift'] });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const planeDialogWrappedFocus = await window.webContents.executeJavaScript(`document.activeElement?.textContent?.replace(/\\s+/g, ' ').trim() || ''`);
    await window.webContents.executeJavaScript(`document.querySelector('.plane-picker header button')?.click()`);
    await waitFor(window, `!document.querySelector('.plane-picker')`, 'zamknięcie modalu wyboru płaszczyzny');
    const planeDialogRestoredFocus = await window.webContents.executeJavaScript(`document.activeElement?.textContent?.replace(/\\s+/g, ' ').trim() || ''`);
    const result = {
      axNodes: nodes.length,
      interactiveControls: interactive.length,
      unnamed,
      missingRequiredNames,
      roles,
      focusSequence,
      distinctFocusNames,
      planeDialog: {
        initial: planeDialogInitial,
        wrappedFocus: planeDialogWrappedFocus,
        restoredFocus: planeDialogRestoredFocus,
      },
    };
    if (unnamed.length
      || missingRequiredNames.length
      || (roles.toolbar || 0) < 2
      || (roles.tab || 0) < 1
      || distinctFocusNames.length < 8
      || focusSequence.some((item) => item.name && !item.visible)
      || planeDialogInitial.name !== 'Wybierz płaszczyznę szkicu'
      || !planeDialogInitial.focusInside
      || !planeDialogInitial.activeText.includes('XY')
      || !planeDialogWrappedFocus.includes('YZ')
      || !planeDialogRestoredFocus.includes('Utwórz szkic')) {
      throw new Error(`Interfejs nie przeszedł testu technologii asystujących: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    window.webContents.debugger.detach();
    app.exit(0);
  } catch (error) {
    if (window.webContents.debugger.isAttached()) window.webContents.debugger.detach();
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
