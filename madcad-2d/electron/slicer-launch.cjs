const path = require('path');

const MAX_SLICER_FILE_BYTES = 512 * 1024 * 1024;
const SLICER_DEFINITIONS = Object.freeze({
  bambu: { label: 'Bambu Studio', mac: ['BambuStudio', 'Bambu Studio'], windows: ['Bambu Studio/bambu-studio.exe'], linux: ['bambu-studio'] },
  prusa: { label: 'PrusaSlicer', mac: ['PrusaSlicer'], windows: ['Prusa3D/PrusaSlicer/prusa-slicer.exe', 'PrusaSlicer/prusa-slicer.exe'], linux: ['prusa-slicer'] },
  cura: { label: 'UltiMaker Cura', mac: ['UltiMaker Cura', 'Cura'], windows: ['UltiMaker Cura/UltiMaker-Cura.exe', 'Ultimaker Cura/Cura.exe'], linux: ['ultimaker-cura', 'cura'] },
});

function sanitizeSlicerFileName(value, fallback = 'madcad-model.stl') {
  const base = path.basename(String(value || '')).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const withExtension = base.toLowerCase().endsWith('.stl') ? base : `${base || 'madcad-model'}.stl`;
  return withExtension || fallback;
}

function normalizeSlicerPayload(payload) {
  const slicer = String(payload?.slicer || '').toLowerCase();
  if (!SLICER_DEFINITIONS[slicer]) throw new Error('Nieobsługiwany program tnący.');
  if (!Array.isArray(payload?.files) || !payload.files.length || payload.files.length > 100) throw new Error('Przekazanie do slicera wymaga od 1 do 100 plików STL.');
  const files = payload.files.map((file, index) => {
    const data = file?.data;
    const bytes = data instanceof Uint8Array
      ? data
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : null;
    if (!bytes || bytes.byteLength < 84) throw new Error(`Plik STL ${index + 1} jest pusty albo nieprawidłowy.`);
    if (bytes.byteLength > MAX_SLICER_FILE_BYTES) throw new Error(`Plik STL ${index + 1} przekracza limit 512 MB.`);
    return { name: sanitizeSlicerFileName(file.name, `madcad-model-${index + 1}.stl`), bytes };
  });
  return { slicer, definition: SLICER_DEFINITIONS[slicer], files };
}

function windowsCandidates(slicer, environment = process.env) {
  const definition = SLICER_DEFINITIONS[slicer];
  if (!definition) return [];
  const roots = [environment.ProgramFiles, environment['ProgramFiles(x86)'], environment.LOCALAPPDATA].filter(Boolean);
  return roots.flatMap((root) => definition.windows.map((relative) => path.join(root, relative)));
}

module.exports = { MAX_SLICER_FILE_BYTES, SLICER_DEFINITIONS, normalizeSlicerPayload, sanitizeSlicerFileName, windowsCandidates };

