'use strict';

const fs = require('fs/promises');
const fsRaw = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const MAX_DWG_BYTES = 512 * 1024 * 1024;
const MAX_DXF_BYTES = 64 * 1024 * 1024;

function converterKind(executablePath) {
  return /(?:dwg2dxf|dwgread)(?:\.exe)?$/i.test(path.basename(String(executablePath || ''))) ? 'libredwg' : 'oda';
}

function pathCandidates(platform = process.platform, environment = process.env, savedPath = '') {
  const candidates = [savedPath, environment.MADCAD_DWG_CONVERTER_PATH, environment.ODA_CONVERTER_PATH];
  const pathDirectories = String(environment.PATH || '').split(path.delimiter).filter(Boolean);
  for (const directory of pathDirectories) {
    candidates.push(path.join(directory, platform === 'win32' ? 'dwgread.exe' : 'dwgread'));
    candidates.push(path.join(directory, platform === 'win32' ? 'dwg2dxf.exe' : 'dwg2dxf'));
    candidates.push(path.join(directory, platform === 'win32' ? 'ODAFileConverter.exe' : 'ODAFileConverter'));
  }
  if (platform === 'darwin') {
    candidates.push(
      '/opt/homebrew/bin/dwgread',
      '/opt/homebrew/bin/dwg2dxf',
      '/usr/local/bin/dwgread',
      '/usr/local/bin/dwg2dxf',
      '/Applications/ODA File Converter.app/Contents/MacOS/ODAFileConverter',
      '/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter',
    );
  } else if (platform === 'win32') {
    for (const root of [environment.ProgramFiles, environment['ProgramFiles(x86)'], environment.LOCALAPPDATA].filter(Boolean)) {
      candidates.push(
        path.join(root, 'LibreDWG', 'bin', 'dwgread.exe'),
        path.join(root, 'LibreDWG', 'bin', 'dwg2dxf.exe'),
        path.join(root, 'ODA', 'ODAFileConverter', 'ODAFileConverter.exe'),
        path.join(root, 'ODA', 'ODA File Converter', 'ODAFileConverter.exe'),
        path.join(root, 'Open Design Alliance', 'ODAFileConverter', 'ODAFileConverter.exe'),
      );
    }
  } else {
    candidates.push('/usr/bin/dwgread', '/usr/local/bin/dwgread', '/usr/bin/dwg2dxf', '/usr/local/bin/dwg2dxf', '/usr/bin/ODAFileConverter', '/usr/local/bin/ODAFileConverter');
  }
  return [...new Set(candidates.map((item) => String(item || '').trim()).filter(Boolean))];
}

async function normalizeConverterPath(candidatePath, platform = process.platform) {
  const candidate = String(candidatePath || '').trim();
  if (!candidate) return null;
  if (platform === 'darwin' && candidate.toLowerCase().endsWith('.app')) {
    return path.join(candidate, 'Contents', 'MacOS', 'ODAFileConverter');
  }
  try {
    const stat = await fs.stat(candidate);
    if (!stat.isDirectory()) return candidate;
    const names = platform === 'win32'
      ? ['dwgread.exe', 'dwg2dxf.exe', 'ODAFileConverter.exe']
      : ['dwgread', 'dwg2dxf', 'ODAFileConverter'];
    const queue = [{ directory: candidate, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      const entries = await fs.readdir(current.directory, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.isFile() && names.some((name) => entry.name.toLowerCase() === name.toLowerCase())) {
          return path.join(current.directory, entry.name);
        }
      }
      if (current.depth < 3) {
        for (const entry of entries) {
          if (entry.isDirectory()) queue.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
        }
      }
    }
  } catch (_error) {
    return candidate;
  }
  return candidate;
}

async function isUsableConverter(candidatePath, platform = process.platform) {
  const normalized = await normalizeConverterPath(candidatePath, platform);
  if (!normalized) return false;
  try {
    const stat = await fs.stat(normalized);
    if (!stat.isFile()) return false;
    if (platform !== 'win32') await fs.access(normalized, fsRaw.constants.X_OK);
    return true;
  } catch (_error) {
    return false;
  }
}

async function resolveConverter(options = {}) {
  const platform = options.platform || process.platform;
  for (const candidate of pathCandidates(platform, options.environment || process.env, options.savedPath || '')) {
    const executablePath = await normalizeConverterPath(candidate, platform);
    if (await isUsableConverter(executablePath, platform)) {
      return { executablePath, kind: converterKind(executablePath) };
    }
  }
  return null;
}

function buildConverterInvocation(converter, sourcePath, outputPath, inputDirectory, outputDirectory) {
  if (converter.kind === 'libredwg') {
    const isDwgRead = /dwgread(?:\.exe)?$/i.test(path.basename(converter.executablePath));
    return {
      executable: converter.executablePath,
      args: isDwgRead
        ? ['--format', 'DXF', '--file', outputPath, sourcePath]
        : ['--overwrite', '--minimal', '--as', 'r2013', '--file', outputPath, sourcePath],
    };
  }
  return {
    executable: converter.executablePath,
    args: [inputDirectory, outputDirectory, 'ACAD2018', 'DXF', '0', '1', '*.dwg'],
  };
}

async function findDxf(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findDxf(fullPath);
      if (nested) return nested;
    } else if (entry.name.toLowerCase().endsWith('.dxf')) {
      return fullPath;
    }
  }
  return null;
}

async function convertDwgToDxf(converter, sourcePath, temporaryRoot) {
  const sourceStat = await fs.stat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.size < 6 || sourceStat.size > MAX_DWG_BYTES) {
    throw new Error('Plik DWG jest pusty, nieprawidłowy albo przekracza limit 512 MB.');
  }
  const inputDirectory = path.join(temporaryRoot, 'input');
  const outputDirectory = path.join(temporaryRoot, 'output');
  await fs.mkdir(inputDirectory, { recursive: true });
  await fs.mkdir(outputDirectory, { recursive: true });
  const safeBaseName = path.basename(sourcePath).replace(/[^a-z0-9_. -]/gi, '-');
  const localSource = path.join(inputDirectory, safeBaseName.toLowerCase().endsWith('.dwg') ? safeBaseName : `${safeBaseName}.dwg`);
  const expectedOutput = path.join(outputDirectory, `${path.parse(localSource).name}.dxf`);
  await fs.copyFile(sourcePath, localSource);
  const invocation = buildConverterInvocation(converter, localSource, expectedOutput, inputDirectory, outputDirectory);
  await execFileAsync(invocation.executable, invocation.args, { timeout: 120_000, windowsHide: true });
  const outputPath = await findDxf(outputDirectory);
  if (!outputPath) throw new Error('Konwerter DWG nie utworzył pliku DXF.');
  const outputStat = await fs.stat(outputPath);
  if (!outputStat.isFile() || outputStat.size < 8 || outputStat.size > MAX_DXF_BYTES) {
    throw new Error('Wynik DXF jest pusty albo przekracza limit 64 MB.');
  }
  return fs.readFile(outputPath, 'utf8');
}

module.exports = {
  MAX_DWG_BYTES,
  MAX_DXF_BYTES,
  buildConverterInvocation,
  converterKind,
  convertDwgToDxf,
  isUsableConverter,
  normalizeConverterPath,
  pathCandidates,
  resolveConverter,
};
