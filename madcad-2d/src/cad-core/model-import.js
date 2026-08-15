// Base64 adds roughly 33%. Keeping the imported payload below 45 MiB leaves
// room for document metadata inside the 64 MiB crash-recovery autosave limit.
export const MAX_MODEL_IMPORT_BYTES = 45 * 1024 * 1024;

const UNIT_ALIASES = new Map([
  ['millimeter', 'millimeter'],
  ['millimetre', 'millimeter'],
  ['centimeter', 'centimeter'],
  ['centimetre', 'centimeter'],
  ['inch', 'inch'],
  ['meter', 'meter'],
  ['metre', 'meter'],
  ['micron', 'micron'],
  ['micrometer', 'micron'],
  ['micrometre', 'micron'],
  ['foot', 'foot'],
]);

export function normalizeModelUnit(unit, fallback = 'millimeter') {
  return UNIT_ALIASES.get(String(unit || '').trim().toLowerCase()) || fallback;
}

export function formatModelFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 ** 2)).toFixed(value < 10 * 1024 ** 2 ? 1 : 0)} MB`;
}

function inspectStep(bytes) {
  const header = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
  if (!/ISO-10303-21\s*;/i.test(header)) throw new Error('Plik nie zawiera prawidłowego nagłówka STEP (ISO-10303-21).');
  return { triangleCount: null, importMode: 'brep' };
}

function inspectStl(bytes) {
  if (bytes.byteLength >= 84) {
    const triangleCount = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true);
    const expectedBytes = 84 + triangleCount * 50;
    if (triangleCount > 0 && expectedBytes === bytes.byteLength) return { triangleCount, importMode: 'mesh' };
  }
  const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));
  if (!/^\s*solid\b/i.test(prefix) || !/\bfacet\s+normal\b/i.test(prefix) || !/\bvertex\b/i.test(prefix)) {
    throw new Error('Plik nie zawiera prawidłowej siatki STL.');
  }
  return { triangleCount: null, importMode: 'mesh' };
}

export function parseStlMesh(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength >= 84) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const triangleCount = view.getUint32(80, true);
    if (triangleCount > 0 && 84 + triangleCount * 50 <= bytes.byteLength) {
      const vertices = new Array(triangleCount * 9);
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const sourceOffset = 84 + triangle * 50 + 12;
        for (let coordinate = 0; coordinate < 9; coordinate += 1) vertices[triangle * 9 + coordinate] = view.getFloat32(sourceOffset + coordinate * 4, true);
      }
      return { vertices, triangles: Array.from({ length: triangleCount * 3 }, (_, index) => index) };
    }
  }
  const text = new TextDecoder().decode(bytes);
  const vertices = [];
  const vertexPattern = /\bvertex\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  let match;
  while ((match = vertexPattern.exec(text))) vertices.push(Number(match[1]), Number(match[2]), Number(match[3]));
  if (!vertices.length || vertices.length % 9) throw new Error('Plik STL nie zawiera pełnych trójkątów.');
  return { vertices, triangles: Array.from({ length: vertices.length / 3 }, (_, index) => index) };
}

export function inspectModelImportBuffer(data, format, maximumBytes = MAX_MODEL_IMPORT_BYTES) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const normalizedFormat = String(format || '').toLowerCase() === 'stp' ? 'step' : String(format || '').toLowerCase();
  if (!['step', 'stl', '3mf'].includes(normalizedFormat)) throw new Error('Import obsługuje wyłącznie pliki STEP, STL i 3MF.');
  if (!bytes.byteLength) throw new Error('Wybrany plik jest pusty.');
  if (bytes.byteLength > maximumBytes) {
    throw new Error(`Plik ma ${formatModelFileSize(bytes.byteLength)}. Maksymalny rozmiar importu to ${formatModelFileSize(maximumBytes)}.`);
  }
  if (normalizedFormat === 'step') return { format: normalizedFormat, bytes: bytes.byteLength, ...inspectStep(bytes) };
  if (normalizedFormat === 'stl') return { format: normalizedFormat, bytes: bytes.byteLength, ...inspectStl(bytes) };
  if (bytes.byteLength < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Plik 3MF nie jest prawidłowym archiwum ZIP.');
  return { format: normalizedFormat, bytes: bytes.byteLength, triangleCount: null, importMode: 'mesh' };
}
