const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function syncExistingFile(filePath) {
  const handle = await fs.open(filePath, 'r+');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeAndSync(filePath, text) {
  const handle = await fs.open(filePath, 'w', 0o600);
  try {
    await handle.writeFile(String(text), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicWriteTextFile(filePath, text, { backup = true } = {}) {
  const targetPath = path.resolve(String(filePath || ''));
  if (!filePath || targetPath === path.parse(targetPath).root) {
    throw new Error('Nieprawidłowa ścieżka pliku docelowego.');
  }

  const directory = path.dirname(targetPath);
  const suffix = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const temporaryPath = path.join(directory, `.${path.basename(targetPath)}.${suffix}.tmp`);
  const backupPath = `${targetPath}.bak`;
  const temporaryBackupPath = `${backupPath}.${suffix}.tmp`;
  let previousFileExisted = false;

  await fs.mkdir(directory, { recursive: true });
  try {
    await writeAndSync(temporaryPath, text);
    previousFileExisted = await pathExists(targetPath);

    if (backup && previousFileExisted) {
      await fs.copyFile(targetPath, temporaryBackupPath);
      await syncExistingFile(temporaryBackupPath);
      await fs.rename(temporaryBackupPath, backupPath);
    }

    await fs.rename(temporaryPath, targetPath);
    return {
      filePath: targetPath,
      backupPath: backup && previousFileExisted ? backupPath : null,
    };
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    await fs.rm(temporaryBackupPath, { force: true }).catch(() => {});
  }
}

module.exports = { atomicWriteTextFile };
