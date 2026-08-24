const path = require('path');

const MAX_SAVE_TEXT_BYTES = 128 * 1024 * 1024;
const MAX_AUTOSAVE_TEXT_BYTES = 64 * 1024 * 1024;
const MAX_CAD_TEXT_BYTES = 64 * 1024 * 1024;
const MAX_PRINT_HTML_BYTES = 8_000_000;
const PRINT_PREVIEW_CSP = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

function assertPlainObject(value, label = 'payload') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Nieprawidłowy ${label}.`);
  }
  return value;
}

function limitedString(value, { label, max, min = 0, trim = false } = {}) {
  if (typeof value !== 'string') throw new Error(`${label || 'Tekst'} ma nieprawidłowy typ.`);
  const normalized = trim ? value.trim() : value;
  if (normalized.length < min) throw new Error(`${label || 'Tekst'} jest pusty.`);
  if (Buffer.byteLength(normalized, 'utf8') > max) throw new Error(`${label || 'Tekst'} przekracza limit.`);
  return normalized;
}

function safeFileName(value, fallback, extension = '') {
  const source = typeof value === 'string' ? value.trim() : '';
  let name = path.basename(source || fallback).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-').slice(0, 160);
  if (!name) name = fallback;
  if (extension && path.extname(name).toLowerCase() !== extension.toLowerCase()) {
    name = `${name.replace(/\.[^.]+$/, '')}${extension}`;
  }
  return name;
}

function normalizeSaveFilters(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 12) throw new Error('Nieprawidłowe filtry zapisu.');
  return value.map((filter) => {
    assertPlainObject(filter, 'filtr zapisu');
    const name = limitedString(filter.name, { label: 'Nazwa filtra', min: 1, max: 80, trim: true });
    if (!Array.isArray(filter.extensions) || filter.extensions.length < 1 || filter.extensions.length > 12) {
      throw new Error('Nieprawidłowe rozszerzenia filtra.');
    }
    const extensions = filter.extensions.map((extension) => {
      const normalized = String(extension || '').trim().toLowerCase().replace(/^\./, '');
      if (!/^[a-z0-9]{1,12}$/.test(normalized)) throw new Error('Nieprawidłowe rozszerzenie pliku.');
      return normalized;
    });
    return { name, extensions };
  });
}

function normalizeSaveTextPayload(payload, language = 'pl') {
  const source = assertPlainObject(payload);
  return {
    text: limitedString(source.text, { label: 'Plik', max: MAX_SAVE_TEXT_BYTES }),
    defaultName: safeFileName(source.defaultName, language === 'en' ? 'drawing.txt' : 'rysunek.txt'),
    filters: normalizeSaveFilters(source.filters),
    atomic: source.atomic === true,
    createBackup: source.createBackup !== false,
  };
}

function normalizeAutosavePayload(payload) {
  const source = assertPlainObject(payload);
  return {
    text: limitedString(source.text, { label: 'Autozapis', min: 1, max: MAX_AUTOSAVE_TEXT_BYTES }),
  };
}

function normalizePrintPreviewPayload(payload, language = 'pl') {
  const source = assertPlainObject(payload);
  return {
    html: limitedString(source.html, { label: 'Podgląd wydruku', min: 32, max: MAX_PRINT_HTML_BYTES }),
    title: typeof source.title === 'string' && source.title.trim()
      ? limitedString(source.title, { label: 'Tytuł podglądu', min: 1, max: 160, trim: true })
      : language === 'en' ? 'MadCAD - print' : 'MadCAD - wydruk',
  };
}

function normalizePdfExportPayload(payload, language = 'pl') {
  const preview = normalizePrintPreviewPayload(payload, language);
  const source = assertPlainObject(payload);
  return {
    ...preview,
    defaultName: safeFileName(source.defaultName, language === 'en' ? 'drawing.pdf' : 'rysunek.pdf', '.pdf'),
    pageSize: ['A4', 'A3'].includes(source.pageSize) ? source.pageSize : 'A4',
    orientation: source.orientation === 'portrait' ? 'portrait' : 'landscape',
  };
}

function securePrintPreviewHtml(html) {
  const csp = `<meta http-equiv="Content-Security-Policy" content="${PRINT_PREVIEW_CSP}">`;
  return /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${csp}`)
    : `${csp}${html}`;
}

function normalizeCadConversionPayload(payload, language = 'pl') {
  const source = assertPlainObject(payload);
  const mode = String(source.mode || '');
  if (mode === 'dwg-to-dxf') {
    const sourcePath = limitedString(source.sourcePath, { label: 'Ścieżka DWG', min: 1, max: 4096, trim: true });
    if (path.extname(sourcePath).toLowerCase() !== '.dwg') throw new Error('Plik wejściowy musi mieć rozszerzenie DWG.');
    return { mode, sourcePath };
  }
  if (mode === 'dxf-text-to-dwg') {
    return {
      mode,
      dxfText: limitedString(source.dxfText, { label: 'Dane DXF', min: 1, max: MAX_CAD_TEXT_BYTES }),
      defaultName: safeFileName(source.defaultName, language === 'en' ? 'drawing.dwg' : 'rysunek.dwg', '.dwg'),
    };
  }
  throw new Error('Nieobsługiwany tryb konwersji CAD.');
}

module.exports = {
  MAX_AUTOSAVE_TEXT_BYTES,
  MAX_CAD_TEXT_BYTES,
  MAX_PRINT_HTML_BYTES,
  MAX_SAVE_TEXT_BYTES,
  normalizeAutosavePayload,
  normalizeCadConversionPayload,
  normalizePdfExportPayload,
  normalizePrintPreviewPayload,
  normalizeSaveFilters,
  normalizeSaveTextPayload,
  safeFileName,
  securePrintPreviewHtml,
};
