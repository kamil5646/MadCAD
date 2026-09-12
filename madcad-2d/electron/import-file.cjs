const path = require('path');

const MAX_IMPORT_BYTES = 512 * 1024 * 1024;

const IMPORT_DEFINITIONS = Object.freeze({
  model: {
    title: ['Importuj model 3D', 'Import a 3D model'],
    buttonLabel: ['Importuj', 'Import'],
    filterName: 'STEP, STL, 3MF',
    extensions: ['step', 'stp', 'stl', '3mf'],
  },
  sketch: {
    title: ['Importuj geometrię szkicu', 'Import sketch geometry'],
    buttonLabel: ['Importuj', 'Import'],
    filterName: 'SVG, DXF',
    extensions: ['svg', 'dxf'],
  },
});

async function selectImportFile({ kind, dialog, fileSystem, ownerWindow = null, translate = (pl) => pl }) {
  const definition = IMPORT_DEFINITIONS[kind];
  if (!definition) throw new Error(translate('Nieprawidłowy rodzaj importu.', 'Invalid import kind.'));
  const selection = await dialog.showOpenDialog(ownerWindow, {
    title: translate(...definition.title),
    buttonLabel: translate(...definition.buttonLabel),
    filters: [{ name: definition.filterName, extensions: definition.extensions }],
    properties: ['openFile'],
  });
  if (selection.canceled || !selection.filePaths?.[0]) return { ok: false, canceled: true };

  const filePath = path.normalize(selection.filePaths[0]);
  const extension = path.extname(filePath).slice(1).toLowerCase();
  if (!definition.extensions.includes(extension)) {
    throw new Error(translate(
      `Wybierz plik ${definition.extensions.map((value) => `.${value}`).join(', ')}.`,
      `Choose a ${definition.extensions.map((value) => `.${value}`).join(', ')} file.`,
    ));
  }
  const stats = await fileSystem.stat(filePath);
  if (!stats.isFile()) throw new Error(translate('Wybrana ścieżka nie wskazuje pliku.', 'The selected path does not point to a file.'));
  if (!stats.size) throw new Error(translate('Wybrany plik jest pusty.', 'The selected file is empty.'));
  if (stats.size > MAX_IMPORT_BYTES) throw new Error(translate('Plik importu przekracza limit 512 MiB.', 'The import file exceeds the 512 MiB limit.'));
  const bytes = await fileSystem.readFile(filePath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return {
    ok: true,
    canceled: false,
    fileName: path.basename(filePath),
    format: extension === 'stp' ? 'step' : extension,
    bytes: arrayBuffer,
  };
}

module.exports = { IMPORT_DEFINITIONS, MAX_IMPORT_BYTES, selectImportFile };
