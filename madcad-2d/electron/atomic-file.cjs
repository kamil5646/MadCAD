const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');

async function pathExists(filePath, fileSystem = fs) {
  try {
    await fileSystem.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function syncExistingFile(filePath, fileSystem = fs) {
  const handle = await fileSystem.open(filePath, 'r+');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeAndSync(filePath, text, fileSystem = fs) {
  const handle = await fileSystem.open(filePath, 'w', 0o600);
  try {
    await handle.writeFile(String(text), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicWriteTextFile(filePath, text, { backup = true, fileSystem = fs } = {}) {
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

  await fileSystem.mkdir(directory, { recursive: true });
  try {
    await writeAndSync(temporaryPath, text, fileSystem);
    previousFileExisted = await pathExists(targetPath, fileSystem);

    if (backup && previousFileExisted) {
      await fileSystem.copyFile(targetPath, temporaryBackupPath);
      await syncExistingFile(temporaryBackupPath, fileSystem);
      await fileSystem.rename(temporaryBackupPath, backupPath);
    }

    await fileSystem.rename(temporaryPath, targetPath);
    return {
      filePath: targetPath,
      backupPath: backup && previousFileExisted ? backupPath : null,
    };
  } finally {
    await fileSystem.rm(temporaryPath, { force: true }).catch(() => {});
    await fileSystem.rm(temporaryBackupPath, { force: true }).catch(() => {});
  }
}

module.exports = { atomicWriteTextFile };
