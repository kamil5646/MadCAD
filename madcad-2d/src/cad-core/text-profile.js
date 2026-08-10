const GLYPHS = Object.freeze({
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01111/10000/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '11111/00100/00100/00100/00100/00100/11111',
  J: '00111/00010/00010/00010/10010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  0: '01110/10001/10011/10101/11001/10001/01110',
  1: '00100/01100/00100/00100/00100/00100/01110',
  2: '01110/10001/00001/00010/00100/01000/11111',
  3: '11110/00001/00001/01110/00001/00001/11110',
  4: '00010/00110/01010/10010/11111/00010/00010',
  5: '11111/10000/10000/11110/00001/00001/11110',
  6: '01110/10000/10000/11110/10001/10001/01110',
  7: '11111/00001/00010/00100/01000/01000/01000',
  8: '01110/10001/10001/01110/10001/10001/01110',
  9: '01110/10001/10001/01111/00001/00001/01110',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '.': '00000/00000/00000/00000/00000/01100/01100',
  '_': '00000/00000/00000/00000/00000/00000/11111',
  '?': '01110/10001/00001/00010/00100/00000/00100',
});

const GLYPH_COLUMNS = 5;
const GLYPH_ROWS = 7;
const GLYPH_ADVANCE = 6;
const LINE_ADVANCE = 9;

function normalizedCharacter(character) {
  if (character === ' ') return ' ';
  const normalized = character.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace('Ł', 'L');
  return GLYPHS[normalized] ? normalized : '?';
}

function rowRuns(row) {
  const runs = [];
  let start = -1;
  for (let column = 0; column <= GLYPH_COLUMNS; column += 1) {
    const filled = column < GLYPH_COLUMNS && row[column] === '1';
    if (filled && start < 0) start = column;
    if (!filled && start >= 0) {
      runs.push([start, column]);
      start = -1;
    }
  }
  return runs;
}

function glyphRectangles(pattern, originX, originY, cell) {
  const rows = pattern.split('/').reverse();
  const rectangles = [];
  let active = new Map();
  rows.forEach((row, rowIndex) => {
    const next = new Map();
    for (const [start, end] of rowRuns(row)) {
      const key = `${start}:${end}`;
      const rectangle = active.get(key) || {
        x: originX + (start * cell),
        y: originY + (rowIndex * cell),
        width: (end - start) * cell,
        height: 0,
      };
      rectangle.height += cell;
      next.set(key, rectangle);
    }
    for (const [key, rectangle] of active) if (!next.has(key)) rectangles.push(rectangle);
    active = next;
  });
  rectangles.push(...active.values());
  return rectangles;
}

export function createTextProfile(text, fontSize, x = 0, y = 0) {
  const source = String(text ?? '');
  if (!source.trim()) throw new Error('Tekst nie może być pusty.');
  if (source.length > 80) throw new Error('Tekst może mieć najwyżej 80 znaków.');
  if (!Number.isFinite(fontSize) || fontSize <= 0) throw new Error('Rozmiar tekstu musi być dodatni.');
  const lines = source.replace(/\r/g, '').split('\n');
  if (lines.length > 6) throw new Error('Tekst może mieć najwyżej 6 wierszy.');

  const cell = fontSize / GLYPH_ROWS;
  const rectangles = [];
  let maxColumns = 0;
  lines.forEach((line, lineIndex) => {
    maxColumns = Math.max(maxColumns, line.length ? (line.length * GLYPH_ADVANCE) - 1 : 0);
    const baselineY = y + ((lines.length - lineIndex - 1) * LINE_ADVANCE * cell);
    [...line].forEach((character, characterIndex) => {
      const glyph = normalizedCharacter(character);
      if (glyph === ' ') return;
      rectangles.push(...glyphRectangles(GLYPHS[glyph], x + (characterIndex * GLYPH_ADVANCE * cell), baselineY, cell));
    });
  });
  if (!rectangles.length) throw new Error('Tekst nie zawiera znaków możliwych do wyciągnięcia.');

  return {
    text: source,
    cell,
    width: maxColumns * cell,
    height: ((lines.length - 1) * LINE_ADVANCE * cell) + fontSize,
    area: rectangles.reduce((sum, rectangle) => sum + (rectangle.width * rectangle.height), 0),
    rectangles,
  };
}
