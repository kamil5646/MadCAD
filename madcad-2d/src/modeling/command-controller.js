const COMMAND_DEFINITIONS = Object.freeze([
  { shortcut: 'L', label: 'Linia', aliases: ['L', 'LINE', 'LINIA'] },
  { shortcut: 'PL', label: 'Polilinia', aliases: ['PL', 'PLINE', 'POLYLINE', 'POLILINIA'] },
  { shortcut: 'R', label: 'Prostokąt', aliases: ['R', 'REC', 'RECTANG', 'RECTANGLE', 'PROSTOKAT', 'PROSTOKĄT'] },
  { shortcut: 'C', label: 'Okrąg', aliases: ['C', 'CIRCLE', 'OKRAG', 'OKRĄG'] },
  { shortcut: 'T', label: 'Trim', aliases: ['T', 'TR', 'TRIM', 'PRZYTNIJ'] },
  { shortcut: 'EX', label: 'Extend', aliases: ['EX', 'EXTEND', 'PRZEDLUZ', 'PRZEDŁUŻ'] },
  { shortcut: 'BR', label: 'Break', aliases: ['BR', 'BREAK', 'PODZIEL'] },
  { shortcut: 'O', label: 'Offset', aliases: ['O', 'OFFSET', 'ODSUN'] },
  { shortcut: 'F', label: 'Fillet', aliases: ['F', 'FILLET', 'ZAOKRAGLIJ', 'ZAOKRĄGLIJ'] },
  { shortcut: 'CHA', label: 'Faza', aliases: ['CHA', 'CHAMFER', 'FAZA', 'FAZUJ'] },
  { shortcut: 'M', label: 'Przesuń', aliases: ['M', 'MOVE', 'PRZESUN', 'PRZESUŃ'] },
  { shortcut: 'P', label: 'Project', aliases: ['P', 'PROJECT', 'RZUTUJ'] },
  { shortcut: 'E', label: 'Wyciągnij', aliases: ['E', 'EXTRUDE', 'WYCIAGNIJ', 'WYCIĄGNIJ'] },
  { shortcut: 'I', label: 'Zmierz', aliases: ['I', 'DI', 'DIST', 'MEASURE', 'ZMIERZ'] },
  { shortcut: 'DEL', label: 'Usuń', aliases: ['DEL', 'DELETE', 'ERASE', 'USUN', 'USUŃ'] },
]);

const COMMAND_LOOKUP = new Map(COMMAND_DEFINITIONS.flatMap((definition) => (
  definition.aliases.map((alias) => [alias, definition])
)));

const ACTIVE_COMMAND_LABELS = Object.freeze({
  line: 'LINIA',
  polyline: 'POLILINIA',
  rectangle: 'PROSTOKĄT',
  circle: 'OKRĄG',
  arc: 'ŁUK',
  polygon: 'WIELOKĄT',
  ellipse: 'ELIPSA',
  slot: 'SLOT',
  spline: 'SPLINE',
  conic: 'CONIC',
  point: 'PUNKT',
  trimSketch: 'TRIM',
  extendSketch: 'EXTEND',
  breakSketch: 'BREAK',
  moveSketch: 'PRZESUŃ',
  offsetSketch: 'OFFSET',
  cornerSketch: 'NAROŻNIK',
  transformSketch: 'TRANSFORMUJ',
  patternSketch: 'SZYK',
  extrude: 'WYCIĄGNIJ',
  measure: 'ZMIERZ',
  parameters: 'PARAMETRY',
});

export function normalizeCommandText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pl-PL');
}

export function resolveCommandAlias(value) {
  return COMMAND_LOOKUP.get(normalizeCommandText(value)) || null;
}

export function parseCommandLineInput(value) {
  const normalized = normalizeCommandText(value);
  if (!normalized) return { type: 'empty', raw: '' };
  if (['ESC', 'ESCAPE', 'CANCEL', 'ANULUJ'].includes(normalized)) return { type: 'cancel', raw: normalized };
  if (/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(normalized)) {
    return { type: 'number', raw: normalized, value: Number(normalized.replace(',', '.')) };
  }
  const command = resolveCommandAlias(normalized);
  if (command) return { type: 'command', raw: normalized, command };
  return { type: 'unknown', raw: normalized };
}

export function describeActiveCommand(command) {
  if (!command?.type) return 'Gotowe';
  const name = ACTIVE_COMMAND_LABELS[command.type] || command.type;
  if ((command.type === 'line' || command.type === 'polyline') && command.lastPoint) {
    return `${name}: wskaż następny punkt lub wpisz długość`;
  }
  if (command.type === 'line' || command.type === 'polyline') return `${name}: wskaż pierwszy punkt`;
  return `${name}: ustaw parametry i zatwierdź Enterem`;
}

export function commandSuggestions(value, limit = 6) {
  const normalized = normalizeCommandText(value);
  if (!normalized) return [];
  return COMMAND_DEFINITIONS
    .filter((definition) => definition.aliases.some((alias) => alias.startsWith(normalized)))
    .slice(0, limit)
    .map(({ shortcut, label, aliases }) => ({ shortcut, label, command: aliases[1] || aliases[0] }));
}

export { COMMAND_DEFINITIONS };
