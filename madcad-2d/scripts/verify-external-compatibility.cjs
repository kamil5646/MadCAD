const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { app, BrowserWindow } = require('electron');
const dwgConverter = require('../electron/dwg-converter.cjs');

const execFileAsync = promisify(execFile);
const root = path.join(__dirname, '..');
const artifactPath = path.join(root, 'artifacts', 'external-compatibility-report.json');
const freeCadCommit = '46f7684bfa2c6814a1a22ef43013924f7eb2b860';
const freeCadUrl = `https://raw.githubusercontent.com/FreeCAD/FreeCAD/${freeCadCommit}/data/tests/Step/as1-ac-214_small.stp`;
const freeCadSha256 = '80c8ace7c72ed12d02ab45f8471528c192990781dbb6e4afe975058c6197ca45';
const recordedBambuSha256 = '56af580d355b7c3f27922cbfa8e1f38c63d671c43f5a9831aed2646eba7b0b60';

async function waitFor(window, expression, label, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function importModel(window, bytes, fileName, expectedBodies, expectedDialog = {}) {
  const encoded = Buffer.from(bytes).toString('base64');
  await window.webContents.executeJavaScript(`(async () => {
    const raw = atob(${JSON.stringify(encoded)});
    const data = Uint8Array.from(raw, (character) => character.charCodeAt(0));
    const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.3mf'));
    const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof input[key]?.onChange !== 'function') throw new Error('Brak wejścia importu 3D.');
    await input[key].onChange({ target: { files: [new File([data], ${JSON.stringify(fileName)})], value: '' } });
  })()`);
  await waitFor(window, `document.querySelector('.import-model-dialog .confirm')`, `okno importu ${fileName}`);
  const dialog = await window.webContents.executeJavaScript(`[...document.querySelectorAll('.import-model-dialog .command-field')].map((field) => ({ label: field.firstElementChild?.textContent || '', value: field.querySelector('input, select')?.value || '' }))`);
  for (const [label, expected] of Object.entries(expectedDialog)) {
    if (!dialog.some((field) => field.label === label && String(field.value).includes(String(expected)))) throw new Error(`Import ${fileName}: pole ${label} nie zawiera ${expected}: ${JSON.stringify(dialog)}`);
  }
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.import-model-dialog .confirm');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === ${expectedBodies}`, `geometria ${fileName}`, 90000);
  return dialog;
}

app.whenReady().then(async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-external-compatibility-'));
  const window = new BrowserWindow({ width: 1500, height: 900, show: false, webPreferences: { partition: `madcad-external-${Date.now()}` } });
  let exitCode = 0;
  try {
    const [{ inspectThreeMfArchive }, { parseSketchImport }] = await Promise.all([
      import(pathToFileURL(path.join(root, 'src', 'cad-core', 'three-mf.js')).href),
      import(pathToFileURL(path.join(root, 'src', 'cad-core', 'sketch-import.js')).href),
    ]);
    const result = { generatedAt: new Date().toISOString(), platform: `${process.platform}-${process.arch}`, checks: {} };

    const autoCadDxf = await fs.readFile(path.join(root, 'tests', 'fixtures', 'external', 'autocad-2013-rectangle.dxf'), 'utf8');
    const fusionDxf = await fs.readFile(path.join(root, 'tests', 'fixtures', 'external', 'fusion-sketch-mm.dxf'), 'utf8');
    for (const [id, text] of [['autocadDxf', autoCadDxf], ['fusionDxf', fusionDxf]]) {
      const parsed = parseSketchImport(text, 'dxf');
      result.checks[id] = { status: 'passed', sourceUnit: parsed.sourceUnit, curves: parsed.curveCount, profiles: parsed.profiles.length };
    }
    process.stdout.write('[external] DXF AutoCAD/Fusion: OK\n');

    const converter = await dwgConverter.resolveConverter();
    let dwgAdd = null;
    for (const candidate of ['/opt/homebrew/bin/dwgadd', '/usr/local/bin/dwgadd']) {
      if (await fs.access(candidate).then(() => true, () => false)) { dwgAdd = candidate; break; }
    }
    if (converter && dwgAdd) {
      const dwgPath = path.join(temporaryRoot, 'libredwg-r2000.dwg');
      await execFileAsync(dwgAdd, ['--as', 'r2000', '--file', dwgPath, path.join(root, 'tests', 'fixtures', 'simple-dwg-source.add')], { timeout: 30000 });
      const dxfText = await dwgConverter.convertDwgToDxf(converter, dwgPath, path.join(temporaryRoot, 'dwg-conversion'));
      const parsed = parseSketchImport(dxfText, 'dxf');
      result.checks.libreDwg = { status: 'passed', converter: converter.executablePath, kind: converter.kind, curves: parsed.curveCount, profiles: parsed.profiles.length };
    } else result.checks.libreDwg = { status: 'not-installed' };
    process.stdout.write(`[external] LibreDWG: ${result.checks.libreDwg.status}\n`);

    const freeCadResponse = await fetch(freeCadUrl);
    if (!freeCadResponse.ok) throw new Error(`Nie pobrano fixture FreeCAD: HTTP ${freeCadResponse.status}.`);
    const freeCadStep = Buffer.from(await freeCadResponse.arrayBuffer());
    const downloadedFreeCadSha256 = crypto.createHash('sha256').update(freeCadStep).digest('hex');
    if (downloadedFreeCadSha256 !== freeCadSha256) throw new Error(`Fixture FreeCAD ma nieoczekiwany SHA-256: ${downloadedFreeCadSha256}.`);
    result.checks.freeCadStep = { status: 'downloaded', source: freeCadUrl, commit: freeCadCommit, bytes: freeCadStep.length, sha256: downloadedFreeCadSha256 };
    process.stdout.write('[external] FreeCAD STEP: pobrano przypięty fixture\n');

    const bambuExecutable = process.platform === 'darwin' ? '/Applications/BambuStudio.app/Contents/MacOS/BambuStudio' : '';
    const bundledBambuBase64 = await fs.readFile(path.join(root, 'tests', 'fixtures', 'external', 'bambu-studio-2.8.2-tetrahedron.3mf.b64'), 'utf8');
    let bambuThreeMf = Buffer.from(bundledBambuBase64.replace(/\s+/g, ''), 'base64');
    let liveGenerated = false;
    if (process.env.MADCAD_BAMBU_3MF_FIXTURE) {
      bambuThreeMf = await fs.readFile(process.env.MADCAD_BAMBU_3MF_FIXTURE);
    } else if (process.env.MADCAD_LIVE_BAMBU === '1' && bambuExecutable && await fs.access(bambuExecutable).then(() => true, () => false)) {
      const outputName = 'bambu-studio-roundtrip.3mf';
      await execFileAsync(bambuExecutable, ['--debug', '2', '--export-3mf', outputName, '--outputdir', temporaryRoot, path.join(root, 'tests', 'fixtures', 'external', 'slicer-tetrahedron-ascii.stl')], { timeout: 30000 });
      bambuThreeMf = await fs.readFile(path.join(temporaryRoot, outputName));
      liveGenerated = true;
    }
    const inspection = inspectThreeMfArchive(bambuThreeMf);
    const bambuSha256 = crypto.createHash('sha256').update(bambuThreeMf).digest('hex');
    if (!liveGenerated && !process.env.MADCAD_BAMBU_3MF_FIXTURE && bambuSha256 !== recordedBambuSha256) throw new Error(`Zapisany fixture Bambu Studio ma nieoczekiwany SHA-256: ${bambuSha256}.`);
    if (inspection.objectCount !== 1 || inspection.triangleCount !== 4 || inspection.modelFileCount < 2) throw new Error(`Niepoprawna inspekcja 3MF Bambu Studio: ${JSON.stringify(inspection)}`);
    result.checks.bambuStudio = { status: 'passed', source: liveGenerated ? 'live-cli' : process.env.MADCAD_BAMBU_3MF_FIXTURE ? 'provided-fixture' : 'recorded-cli-output', version: '02.08.02.61', executableInstalled: Boolean(bambuExecutable && await fs.access(bambuExecutable).then(() => true, () => false)), bytes: bambuThreeMf.length, sha256: bambuSha256, ...inspection };
    process.stdout.write(`[external] Bambu Studio: ${result.checks.bambuStudio.status}\n`);

    await window.loadFile(path.join(root, 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && document.querySelector('.modeling-shell')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    const initialBodies = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.length`);
    const freeCadDialog = await importModel(window, freeCadStep, 'freecad-as1-ac-214-small.stp', initialBodies + 1, { Format: 'STEP', Tryb: 'Dokładna geometria B-Rep' });
    result.checks.freeCadStep = { ...result.checks.freeCadStep, status: 'passed', dialog: freeCadDialog };
    process.stdout.write('[external] FreeCAD STEP -> MadCAD B-Rep: OK\n');
    const bambuDialog = await importModel(window, bambuThreeMf, 'bambu-studio-roundtrip.3mf', initialBodies + 2, { Format: '3MF', Obiekty: '1', 'Trójkąty': '4', 'Wykryta jedn.': 'Milimetry' });
    const body = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies.at(-1); return { representation: body.representation, triangles: body.triangles.length / 3, dimensions: body.metrics.dimensions, volume: body.metrics.volume }; })()`);
    if (body.representation !== 'mesh-import' || body.triangles !== 4 || body.dimensions.some((value) => Math.abs(value - 20) > 0.01) || body.volume <= 0) throw new Error(`Niepoprawna geometria Bambu 3MF: ${JSON.stringify(body)}`);
    result.checks.bambuStudio = { ...result.checks.bambuStudio, body, dialog: bambuDialog };
    process.stdout.write('[external] Bambu Studio 3MF -> MadCAD mesh: OK\n');

    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ ok: true, artifactPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    window.destroy();
    await fs.rm(temporaryRoot, { recursive: true, force: true });
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
