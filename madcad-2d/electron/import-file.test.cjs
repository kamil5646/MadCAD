const assert = require('node:assert/strict');
const test = require('node:test');
const { MAX_IMPORT_BYTES, selectImportFile } = require('./import-file.cjs');

function fixture({ canceled = false, filePath = '/tmp/model.step', size = 4, isFile = true } = {}) {
  return {
    dialog: { showOpenDialog: async () => ({ canceled, filePaths: canceled ? [] : [filePath] }) },
    fileSystem: {
      stat: async () => ({ size, isFile: () => isFile }),
      readFile: async () => Buffer.from([1, 2, 3, 4]),
    },
  };
}

test('returns model bytes without exposing an arbitrary path', async () => {
  const result = await selectImportFile({ kind: 'model', ...fixture() });
  assert.equal(result.ok, true);
  assert.equal(result.fileName, 'model.step');
  assert.equal(result.format, 'step');
  assert.equal(result.filePath, undefined);
  assert.deepEqual([...new Uint8Array(result.bytes)], [1, 2, 3, 4]);
});

test('normalizes STP and accepts sketch formats', async () => {
  const stp = await selectImportFile({ kind: 'model', ...fixture({ filePath: '/tmp/part.stp' }) });
  const dxf = await selectImportFile({ kind: 'sketch', ...fixture({ filePath: '/tmp/profile.dxf' }) });
  assert.equal(stp.format, 'step');
  assert.equal(dxf.format, 'dxf');
});

test('accepts every supported model and sketch extension', async () => {
  for (const extension of ['step', 'stp', 'stl', '3mf']) {
    const result = await selectImportFile({ kind: 'model', ...fixture({ filePath: `/tmp/model.${extension}` }) });
    assert.equal(result.ok, true);
    assert.equal(result.format, extension === 'stp' ? 'step' : extension);
  }
  for (const extension of ['svg', 'dxf']) {
    const result = await selectImportFile({ kind: 'sketch', ...fixture({ filePath: `/tmp/sketch.${extension}` }) });
    assert.equal(result.ok, true);
    assert.equal(result.format, extension);
  }
});

test('cancel is silent and does not read a file', async () => {
  let read = false;
  const source = fixture({ canceled: true });
  source.fileSystem.readFile = async () => { read = true; return Buffer.alloc(1); };
  assert.deepEqual(await selectImportFile({ kind: 'model', ...source }), { ok: false, canceled: true });
  assert.equal(read, false);
});

test('rejects wrong extensions, empty files, folders and oversized files', async () => {
  await assert.rejects(selectImportFile({ kind: 'model', ...fixture({ filePath: '/tmp/model.obj' }) }), /Wybierz plik/);
  await assert.rejects(selectImportFile({ kind: 'model', ...fixture({ size: 0 }) }), /pusty/);
  await assert.rejects(selectImportFile({ kind: 'model', ...fixture({ isFile: false }) }), /nie wskazuje pliku/);
  await assert.rejects(selectImportFile({ kind: 'model', ...fixture({ size: MAX_IMPORT_BYTES + 1 }) }), /512 MiB/);
});
