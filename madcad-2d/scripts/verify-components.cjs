const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-components.png');
const appearanceScreenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-component-appearance.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function clickByText(window, selector, text) {
  return window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.trim().includes(${JSON.stringify(text)}));
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

async function setInput(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw new Error('Brak pola: ' + ${JSON.stringify(selector)});
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

async function setSelect(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => {
    const select = document.querySelector(${JSON.stringify(selector)});
    if (!select) throw new Error('Brak listy: ' + ${JSON.stringify(selector)});
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-components-verifier-${Date.now()}` } });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'fixture modelu');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyIds?.length >= 2`, 'bryły fixture');
    await window.webContents.executeJavaScript(`(() => { const bodyId = window.__madcadVerifyDocumentState.bodyIds[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: bodyId, bodyId }); })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'zaznaczona bryła');

    if (!(await clickByText(window, '.ribbon-tool, .ribbon-overflow-menu button', 'Nowa część'))) throw new Error('Nie znaleziono polecenia Nowa część.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.components?.length === 1 && window.__madcadVerifyDocumentState.components[0].bodyIds.length === 1 && document.querySelector('.component-panel')`, 'część z bryły');
    const partId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.components[0].id`);
    await setInput(window, 'input[aria-label="Nazwa komponentu"]', 'Rama główna');
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(partId)})?.name === 'Rama główna'`, 'nazwa części');
    await setInput(window, 'input[aria-label="Numer części komponentu"]', 'MC-RAMA-001');
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(partId)})?.partNumber === 'MC-RAMA-001'`, 'numer części');
    await setInput(window, 'input[aria-label="Materiał komponentu"]', 'S355');
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(partId)})?.material === 'S355'`, 'materiał części');
    await setSelect(window, 'select[aria-label="Preset wyglądu komponentu"]', 'brass');
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(partId)})?.appearance?.preset === 'brass'`, 'preset wyglądu części');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(partId)})?.appearance?.preset === 'cad'`, 'undo wyglądu części');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(partId)})?.appearance?.preset === 'brass'`, 'redo wyglądu części');
    await window.webContents.executeJavaScript(`document.querySelector('.component-appearance-preview')?.scrollIntoView({ block: 'center' })`);
    await fs.writeFile(appearanceScreenshotPath, (await window.webContents.capturePage()).toPNG());

    if (!(await clickByText(window, '.component-toolbar button', 'Nowe złożenie'))) throw new Error('Nie znaleziono tworzenia złożenia.');
    await waitFor(window, `window.__madcadVerifyDocumentState.components.length === 2 && window.__madcadVerifyDocumentState.selection.kind === 'component'`, 'nowe złożenie');
    await waitFor(window, `window.__madcadModelVisualState?.some((item) => item.bodyId === window.__madcadVerifyDocumentState.bodyIds[0] && item.color === '#c49a49' && item.metalness === 0.78 && item.roughness === 0.3)`, 'wygląd części w widoku 3D');
    const assemblyId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.components.find((item) => item.type === 'assembly').id`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.component-list > button')].find((button) => button.textContent.includes('Rama główna')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(partId)}`, 'ponowne zaznaczenie części');
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('select[aria-label="Złożenie nadrzędne"]');
      select.value = ${JSON.stringify(assemblyId)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(assemblyId)})?.componentIds.includes(${JSON.stringify(partId)})`, 'hierarchia złożenia');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `!window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(assemblyId)})?.componentIds.includes(${JSON.stringify(partId)})`, 'undo hierarchii');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(assemblyId)})?.componentIds.includes(${JSON.stringify(partId)})`, 'redo hierarchii');

    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.component-occurrences > button')].find((button) => button.textContent.includes('Rama główna')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.selection.kind === 'componentInstance'`, 'główne wystąpienie części');
    if (!(await clickByText(window, '.component-instance-properties .component-actions button', 'Powiel'))) throw new Error('Nie znaleziono polecenia Powiel wystąpienie.');
    await waitFor(window, `window.__madcadVerifyDocumentState.componentInstances.length === 3 && window.__madcadVerifyDocumentState.selection.kind === 'componentInstance'`, 'powielone wystąpienie');
    const duplicateId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.selection.id`);
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('select[aria-label="Drugie wystąpienie grupy sztywnej"]');
      const option = [...select.options].find((item) => item.value);
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `!document.querySelector('.component-rigid-group button')?.disabled`, 'wybrany członek grupy');
    if (!(await clickByText(window, '.component-rigid-group button', 'Utwórz grupę sztywną'))) throw new Error('Nie znaleziono tworzenia Rigid Group.');
    await waitFor(window, `window.__madcadVerifyDocumentState.rigidGroups.length === 1`, 'Rigid Group');
    await setInput(window, 'input[aria-label="Położenie X"]', '45');
    await waitFor(window, `window.__madcadVerifyDocumentState.componentInstances.find((item) => item.id === ${JSON.stringify(duplicateId)})?.transform.x === 45`, 'wspólny ruch grupy');
    await window.webContents.executeJavaScript(`document.querySelector('.component-instance-toggles input[type="checkbox"]')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.componentInstances.find((item) => item.id === ${JSON.stringify(duplicateId)})?.grounded === true`, 'Ground wystąpienia');

    if (!(await clickByText(window, '.component-rigid-group button', 'Rozwiąż'))) throw new Error('Nie znaleziono rozwiązania Rigid Group.');
    await waitFor(window, `window.__madcadVerifyDocumentState.rigidGroups.length === 0`, 'rozwiązana Rigid Group');
    await window.webContents.executeJavaScript(`document.querySelector('.component-instance-toggles input[type="checkbox"]')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.componentInstances.find((item) => item.id === ${JSON.stringify(duplicateId)})?.grounded === false`, 'wyłączony Ground');
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('select[aria-label="Bazowe wystąpienie jointa"]');
      const option = [...select.options].find((item) => item.value);
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `!document.querySelector('.component-joint-create button')?.disabled`, 'bazowe wystąpienie jointa');
    if (!(await clickByText(window, '.component-joint-create button', 'Utwórz joint'))) throw new Error('Nie znaleziono tworzenia jointa.');
    await waitFor(window, `window.__madcadVerifyDocumentState.joints.length === 1 && window.__madcadVerifyDocumentState.selection.kind === 'joint'`, 'joint revolute');
    const jointId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.joints[0].id`);
    await setInput(window, 'input[aria-label="Maksymalny limit jointa"]', '60');
    await waitFor(window, `window.__madcadVerifyDocumentState.joints[0].limits.max === 60`, 'maksymalny limit jointa');
    await setInput(window, 'input[aria-label="Numeryczna wartość jointa"]', '35');
    await waitFor(window, `window.__madcadVerifyDocumentState.joints[0].value === 35 && window.__madcadVerifyDocumentState.componentInstances.find((item) => item.id === ${JSON.stringify(duplicateId)})?.transform.rotationZ === 35`, 'ruch jointa');
    await waitFor(window, `window.__madcadJointVisualState?.some((item) => item.id === ${JSON.stringify(jointId)} && item.type === 'revolute')`, 'znacznik jointa w widoku 3D');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.joints[0].value === 0`, 'undo ruchu jointa');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.joints[0].value === 35`, 'redo ruchu jointa');
    await waitFor(window, `document.querySelector('input[aria-label="Numeryczna wartość jointa"]')?.value === '35' && [...document.querySelectorAll('.component-joint-list button')].some((button) => button.textContent.includes('35'))`, 'odświeżone sterowanie jointa');

    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.component-occurrences > button')].find((button) => button.textContent.includes('Rama główna') && !button.textContent.includes(':2')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.selection.kind === 'componentInstance' && window.__madcadVerifyDocumentState.selection.id !== ${JSON.stringify(duplicateId)}`, 'bazowe wystąpienie dla drugiego jointa');
    if (!(await clickByText(window, '.component-instance-properties .component-actions button', 'Powiel'))) throw new Error('Nie znaleziono drugiego powielenia wystąpienia.');
    await waitFor(window, `window.__madcadVerifyDocumentState.componentInstances.length === 4 && window.__madcadVerifyDocumentState.selection.kind === 'componentInstance'`, 'trzecie wystąpienie części');
    const sliderOccurrenceId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.selection.id`);
    await setSelect(window, 'select[aria-label="Typ nowego jointa"]', 'slider');
    await setSelect(window, 'select[aria-label="Oś nowego jointa"]', 'x');
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('select[aria-label="Bazowe wystąpienie jointa"]');
      const option = [...select.options].find((item) => item.value && item.value !== ${JSON.stringify(sliderOccurrenceId)});
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    if (!(await clickByText(window, '.component-joint-create button', 'Utwórz joint'))) throw new Error('Nie znaleziono tworzenia drugiego jointa.');
    await waitFor(window, `window.__madcadVerifyDocumentState.joints.length === 2 && window.__madcadVerifyDocumentState.selection.kind === 'joint'`, 'joint slider');
    const sliderJointId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.selection.id`);
    await setSelect(window, 'select[aria-label="Źródłowy joint Motion Link"]', jointId);
    await setSelect(window, 'select[aria-label="Docelowy joint Motion Link"]', sliderJointId);
    await setInput(window, 'input[aria-label="Przełożenie Motion Link"]', '0.5');
    if (!(await clickByText(window, '.component-motion-create button', 'Utwórz Motion Link'))) throw new Error('Nie znaleziono tworzenia Motion Link.');
    await waitFor(window, `window.__madcadVerifyDocumentState.motionLinks.length === 1 && window.__madcadVerifyDocumentState.joints.find((item) => item.id === ${JSON.stringify(sliderJointId)})?.value === 17.5`, 'Motion Link 0.5×');
    await setInput(window, 'input[aria-label="Nazwa nowej konfiguracji"]', 'Robocza');
    if (!(await clickByText(window, '.component-configuration-create button', 'Zapisz nową'))) throw new Error('Nie znaleziono zapisu konfiguracji.');
    await waitFor(window, `window.__madcadVerifyDocumentState.assemblyConfigurations.length === 1`, 'konfiguracja Robocza');
    const workingConfigurationId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.activeAssemblyConfigurationId`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.component-joint-list button')].find((button) => button.textContent.includes('Joint 1')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(jointId)}`, 'źródłowy joint Motion Link');
    await setInput(window, 'input[aria-label="Numeryczna wartość jointa"]', '50');
    await waitFor(window, `window.__madcadVerifyDocumentState.joints.find((item) => item.id === ${JSON.stringify(jointId)})?.value === 50 && window.__madcadVerifyDocumentState.joints.find((item) => item.id === ${JSON.stringify(sliderJointId)})?.value === 25`, 'ruch połączonych jointów');
    await setInput(window, 'input[aria-label="Nazwa nowej konfiguracji"]', 'Rozłożona');
    await clickByText(window, '.component-configuration-create button', 'Zapisz nową');
    await waitFor(window, `window.__madcadVerifyDocumentState.assemblyConfigurations.length === 2`, 'konfiguracja Rozłożona');
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="Aktywuj konfigurację Robocza"]').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.activeAssemblyConfigurationId === ${JSON.stringify(workingConfigurationId)} && window.__madcadVerifyDocumentState.joints.find((item) => item.id === ${JSON.stringify(jointId)})?.value === 35 && window.__madcadVerifyDocumentState.joints.find((item) => item.id === ${JSON.stringify(sliderJointId)})?.value === 17.5`, 'przywrócona konfiguracja Robocza');
    await waitFor(window, `window.__madcadVerifyDocumentState.assemblyCollisions.length >= 1`, 'wizualna kontrola kolizji');
    const interferencePair = await window.webContents.executeJavaScript(`(() => {
      const collision = window.__madcadVerifyDocumentState.assemblyCollisions.find((item) => item.status === 'exact');
      return [collision.firstInstanceId, collision.secondInstanceId];
    })()`);
    await setSelect(window, 'select[aria-label="Pierwsze wystąpienie analizy Interference"]', interferencePair[0]);
    await setSelect(window, 'select[aria-label="Drugie wystąpienie analizy Interference"]', interferencePair[1]);
    if (!(await clickByText(window, '.component-interference button', 'Analizuj parę'))) throw new Error('Nie znaleziono analizy Interference.');
    await waitFor(window, `document.querySelector('.component-interference-result')?.textContent.includes('POTWIERDZONA KOLIZJA')`, 'Interference wybranej pary');
    await setSelect(window, 'select[aria-label="Pierwsze wystąpienie Contact Set"]', duplicateId);
    await setSelect(window, 'select[aria-label="Drugie wystąpienie Contact Set"]', sliderOccurrenceId);
    if (!(await clickByText(window, '.component-contact-create button', 'Utwórz Contact Set'))) throw new Error('Nie znaleziono tworzenia Contact Set.');
    await waitFor(window, `window.__madcadVerifyDocumentState.contactSets.length === 1 && window.__madcadVerifyDocumentState.assemblyCollisions.some((item) => item.contactSetId === window.__madcadVerifyDocumentState.contactSets[0].id)`, 'aktywny Contact Set');
    await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.component-panel');
      const target = document.querySelector('.component-contact-sets');
      const panelRect = panel.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      panel.scrollTop += targetRect.top - panelRect.top - 12;
    })()`);
    await waitFor(window, `(() => {
      const panel = document.querySelector('.component-panel').getBoundingClientRect();
      const target = document.querySelector('.component-contact-sets').getBoundingClientRect();
      return target.top >= panel.top && target.top < panel.bottom;
    })()`, 'widoczna sekcja Contact Sets');

    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    const result = await window.webContents.executeJavaScript(`(() => {
      const state = window.__madcadVerifyDocumentState;
      const panel = document.querySelector('.component-panel').getBoundingClientRect();
      const assembly = state.components.find((item) => item.type === 'assembly');
      const part = state.components.find((item) => item.type === 'part');
      return {
        schemaVersion: state.schemaVersion,
        components: state.components.length,
        assemblyChildren: assembly.componentIds.length,
        partNumber: part.partNumber,
        material: part.material,
        appearance: part.appearance,
        ownedBodies: part.bodyIds.length,
        instances: state.componentInstances.length,
        rigidGroups: state.rigidGroups.length,
        joints: state.joints.length,
        jointType: state.joints[0]?.type,
        jointAxis: state.joints[0]?.axis,
        jointValue: state.joints[0]?.value,
        jointMax: state.joints[0]?.limits.max,
        jointVisuals: window.__madcadJointVisualState?.length || 0,
        motionLinks: state.motionLinks.length,
        motionRatio: state.motionLinks[0]?.ratio,
        contactSets: state.contactSets.length,
        activeContactCollisions: state.assemblyCollisions.filter((item) => item.contactSetId).length,
        configurations: state.assemblyConfigurations.length,
        activeConfiguration: state.assemblyConfigurations.find((item) => item.id === state.activeAssemblyConfigurationId)?.name,
        sliderValue: state.joints.find((item) => item.id === ${JSON.stringify(sliderJointId)})?.value,
        sliderX: state.componentInstances.find((item) => item.id === ${JSON.stringify(sliderOccurrenceId)})?.transform.x,
        assemblyCollisions: state.assemblyCollisions.length,
        exactCollisions: state.assemblyCollisions.filter((item) => item.status === 'exact').length,
        interferenceStatus: document.querySelector('.component-interference')?.classList.contains('exact') ? 'exact' : 'missing',
        interferenceBounds: document.querySelector('.component-interference-result small')?.textContent || '',
        grounded: state.componentInstances.find((item) => item.id === ${JSON.stringify(duplicateId)})?.grounded,
        duplicateX: state.componentInstances.find((item) => item.id === ${JSON.stringify(duplicateId)})?.transform.x,
        duplicateRotationZ: state.componentInstances.find((item) => item.id === ${JSON.stringify(duplicateId)})?.transform.rotationZ,
        rigidMateX: state.componentInstances.find((item) => item.componentId === part.id && item.id !== ${JSON.stringify(duplicateId)})?.transform.x,
        browserRows: document.querySelectorAll('.tree-component').length,
        browserJointRows: document.querySelectorAll('.tree-joint').length,
        browserMotionRows: document.querySelectorAll('.tree-motion-link').length,
        browserContactRows: document.querySelectorAll('.tree-contact-set').length,
        browserConfigurationRows: document.querySelectorAll('.tree-configuration').length,
        panelInsideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    if (result.schemaVersion !== 15 || result.components !== 2 || result.assemblyChildren !== 1 || result.partNumber !== 'MC-RAMA-001' || result.material !== 'S355' || result.appearance?.preset !== 'brass' || result.appearance?.color !== '#c49a49' || result.ownedBodies !== 1 || result.instances !== 4 || result.rigidGroups !== 0 || result.joints !== 2 || result.jointType !== 'revolute' || result.jointAxis !== 'z' || result.jointValue !== 35 || result.jointMax !== 60 || result.jointVisuals !== 2 || result.motionLinks !== 1 || result.motionRatio !== 0.5 || result.contactSets !== 1 || result.activeContactCollisions !== 1 || result.configurations !== 2 || result.activeConfiguration !== 'Robocza' || result.sliderValue !== 17.5 || result.sliderX !== 62.5 || result.assemblyCollisions < 1 || result.exactCollisions < 1 || result.interferenceStatus !== 'exact' || !result.interferenceBounds.includes('Nakładanie obwiedni:') || result.grounded || result.duplicateX !== 45 || result.duplicateRotationZ !== 35 || result.rigidMateX !== 25 || result.browserRows !== 4 || result.browserJointRows !== 2 || result.browserMotionRows !== 1 || result.browserContactRows !== 1 || result.browserConfigurationRows !== 2 || !result.panelInsideViewport || result.horizontalOverflow) {
      throw new Error(`Niepoprawny przepływ komponentów: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, appearanceScreenshotPath, ...result }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
