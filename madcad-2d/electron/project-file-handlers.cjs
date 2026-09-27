const path = require('path');
const fs = require('fs/promises');
const { atomicWriteTextFile } = require('./atomic-file.cjs');
const { normalizeSaveTextPayload } = require('./ipc-policy.cjs');
const { validateJsonText } = require('./recovery-file.cjs');

function defaultErrorMessage(error, fallbackPl, fallbackEn, translate) {
  if (error?.code === 'ENOSPC') return translate('Brak wolnego miejsca na dysku. Ostatnia poprawna wersja pliku nie została zmieniona.', 'The disk is full. The last valid file version was not changed.');
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return translate('Brak uprawnień do zapisu w wybranym miejscu.', 'Permission denied for the selected location.');
  return error?.message ? String(error.message) : translate(fallbackPl, fallbackEn);
}

async function saveProjectTextFile(payload, { dialog, ownerWindow = null, language = 'pl', translate = (pl, en) => language === 'en' ? en : pl, errorMessage = null, fileSystem = fs, writeAtomic = atomicWriteTextFile } = {}) {
  const describeError = errorMessage || ((error, pl, en) => defaultErrorMessage(error, pl, en, translate));
  try {
    const normalized = normalizeSaveTextPayload(payload, language);
    let filePath = normalized.targetPath;
    if (filePath) {
      const existingFile = await fileSystem.stat(filePath).catch(() => null);
      if (!existingFile?.isFile()) filePath = '';
    }
    if (!filePath) {
      const result = await dialog.showSaveDialog(ownerWindow, {
        title: translate('Zapisz plik', 'Save file'),
        defaultPath: normalized.defaultName,
        filters: normalized.filters,
        properties: ['createDirectory', 'showOverwriteConfirmation'],
      });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      filePath = result.filePath;
    }
    const writeResult = normalized.atomic
      ? await writeAtomic(filePath, normalized.text, { backup: normalized.createBackup })
      : (await fileSystem.writeFile(filePath, normalized.text, 'utf8'), { filePath, backupPath: null });
    return { ok: true, canceled: false, ...writeResult };
  } catch (error) {
    return { ok: false, canceled: false, error: describeError(error, 'Nieznany błąd zapisu', 'Unknown save error') };
  }
}

async function openProjectTextFile({ dialog, ownerWindow = null, translate = (pl) => pl, errorMessage = null, fileSystem = fs, maxBytes = 64 * 1024 * 1024 } = {}) {
  const describeError = errorMessage || ((error, pl, en) => defaultErrorMessage(error, pl, en, translate));
  try {
    const selection = await dialog.showOpenDialog(ownerWindow, {
      title: translate('Otwórz projekt MadCAD', 'Open a MadCAD project'),
      buttonLabel: translate('Otwórz', 'Open'),
      filters: [{ name: 'MadCAD', extensions: ['madcad', 'json'] }],
      properties: ['openFile'],
    });
    if (selection.canceled || !selection.filePaths?.[0]) return { ok: false, canceled: true };
    const filePath = path.normalize(selection.filePaths[0]);
    const extension = path.extname(filePath).toLowerCase();
    if (!['.madcad', '.json'].includes(extension)) throw new Error(translate('Wybierz plik .madcad albo .json.', 'Choose a .madcad or .json file.'));
    const stats = await fileSystem.stat(filePath);
    if (!stats.isFile()) throw new Error(translate('Wybrana ścieżka nie wskazuje pliku.', 'The selected path does not point to a file.'));
    if (stats.size > maxBytes) throw new Error(translate('Projekt przekracza limit 64 MiB.', 'The project exceeds the 64 MiB limit.'));
    const text = await fileSystem.readFile(filePath, 'utf8');
    validateJsonText(text);
    return { ok: true, canceled: false, filePath, text };
  } catch (error) {
    return { ok: false, canceled: false, error: describeError(error, 'Nie udało się otworzyć projektu.', 'Failed to open the project.') };
  }
}

module.exports = { saveProjectTextFile, openProjectTextFile };
