const fs = require('fs/promises');

async function readCandidate(filePath, fileSystem, validate) {
  try {
    const [text, stat] = await Promise.all([fileSystem.readFile(filePath, 'utf8'), fileSystem.stat(filePath)]);
    validate(text);
    return { ok: true, text, updatedAt: stat?.mtime?.toISOString?.() || null };
  } catch (error) {
    return { ok: false, error };
  }
}

async function readRecoverableTextFile(filePath, { fileSystem = fs, validate = () => true } = {}) {
  const primary = await readCandidate(filePath, fileSystem, validate);
  if (primary.ok) return { exists: true, recovered: false, filePath, ...primary };
  const backupPath = `${filePath}.bak`;
  const backup = await readCandidate(backupPath, fileSystem, validate);
  if (backup.ok) return { exists: true, recovered: true, filePath, backupPath, primaryError: primary.error?.message || String(primary.error), ...backup };
  if (primary.error?.code === 'ENOENT' && backup.error?.code === 'ENOENT') return { exists: false, recovered: false, filePath, backupPath };
  const error = new Error(`Nie udało się odczytać poprawnego autozapisu ani kopii zapasowej. Główny: ${primary.error?.message || primary.error}. Kopia: ${backup.error?.message || backup.error}.`);
  error.code = 'RECOVERY_FAILED';
  throw error;
}

function validateJsonText(text) {
  JSON.parse(text);
  return true;
}

module.exports = { readRecoverableTextFile, validateJsonText };

