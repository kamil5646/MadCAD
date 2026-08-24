const COMMAND_DEFINITIONS = Object.freeze([
  { shortcut: 'L', label: 'Linia', toolLabel: 'Linia', aliases: ['L', 'LINE', 'LINIA'] },
  { shortcut: 'PL', label: 'Polilinia', toolLabel: 'Polilinia', aliases: ['PL', 'PLINE', 'POLYLINE', 'POLILINIA'] },
  { shortcut: 'R', label: 'Prostokąt', toolLabel: 'Prostokąt', aliases: ['R', 'REC', 'RECTANG', 'RECTANGLE', 'PROSTOKAT', 'PROSTOKĄT'] },
  { shortcut: 'C', label: 'Okrąg', toolLabel: 'Okrąg', aliases: ['C', 'CIRCLE', 'OKRAG', 'OKRĄG'] },
  { shortcut: 'T', label: 'Trim', toolLabel: 'Trim', aliases: ['T', 'TR', 'TRIM', 'PRZYTNIJ'] },
  { shortcut: 'EX', label: 'Extend', toolLabel: 'Extend', aliases: ['EX', 'EXTEND', 'PRZEDLUZ', 'PRZEDŁUŻ'] },
  { shortcut: 'BR', label: 'Break', toolLabel: 'Break', aliases: ['BR', 'BREAK', 'PODZIEL'] },
  { shortcut: 'O', label: 'Offset', toolLabel: 'Offset', aliases: ['O', 'OFFSET', 'ODSUN'] },
  { shortcut: 'F', label: 'Fillet', toolLabel: 'Fillet szkicu', aliases: ['F', 'FILLET', 'ZAOKRAGLIJ', 'ZAOKRĄGLIJ'] },
  { shortcut: 'CHA', label: 'Faza', toolLabel: 'Faza szkicu', aliases: ['CHA', 'CHAMFER', 'FAZA', 'FAZUJ'] },
  { shortcut: 'M', label: 'Przesuń', toolLabel: 'Przesuń', aliases: ['M', 'MOVE', 'PRZESUN', 'PRZESUŃ'] },
  { shortcut: 'P', label: 'Project', toolLabel: 'Project', aliases: ['P', 'PROJECT', 'RZUTUJ'] },
  { shortcut: 'E', label: 'Wyciągnij', toolLabel: 'Wyciągnij', aliases: ['E', 'EXTRUDE', 'WYCIAGNIJ', 'WYCIĄGNIJ'] },
  { shortcut: 'I', label: 'Zmierz', toolLabel: 'Zmierz', aliases: ['I', 'DI', 'DIST', 'MEASURE', 'ZMIERZ'] },
  { shortcut: 'DEL', label: 'Usuń', toolLabel: 'Usuń', aliases: ['DEL', 'DELETE', 'ERASE', 'USUN', 'USUŃ'] },
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
  geometryInspection: 'ANALIZA GEOMETRII',
  parameters: 'PARAMETRY',
});

export function normalizeCommandText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pl-PL');
}

function customDefinition(value, customization) {
  const normalized = normalizeCommandText(value);
  if (!normalized || !customization?.commands) return null;
  const match = COMMAND_DEFINITIONS.find((definition) => normalizeCommandText(customization.commands[definition.label]?.alias) === normalized);
  return match || null;
}

export function resolveCommandAlias(value, customization = null) {
  return customDefinition(value, customization) || COMMAND_LOOKUP.get(normalizeCommandText(value)) || null;
}

export function parseCommandLineInput(value, customization = null) {
  const normalized = normalizeCommandText(value);
  if (!normalized) return { type: 'empty', raw: '' };
  if (['ESC', 'ESCAPE', 'CANCEL', 'ANULUJ'].includes(normalized)) return { type: 'cancel', raw: normalized };
  if (/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(normalized)) {
    return { type: 'number', raw: normalized, value: Number(normalized.replace(',', '.')) };
  }
  const command = resolveCommandAlias(normalized, customization);
  if (command) return { type: 'command', raw: normalized, command };
  return { type: 'unknown', raw: normalized };
}

export function planCommandLineSubmission(value, { command = null, customization = null } = {}) {
  const parsed = parseCommandLineInput(value, customization);
  if (parsed.type === 'cancel') return { action: 'cancel', parsed };
  if (parsed.type === 'empty') return { action: 'confirm-active', parsed };
  if (parsed.type === 'number') {
    const acceptsLength = ['line', 'polyline'].includes(command?.type) && Boolean(command?.lastPoint);
    if (!acceptsLength) return { action: 'number-unavailable', parsed };
    if (!(parsed.value > 0)) return { action: 'invalid-length', parsed };
    return { action: 'confirm-segment-length', parsed, length: parsed.value };
  }
  if (parsed.type === 'command') {
    return {
      action: 'execute-command',
      parsed,
      shortcut: customization?.commands?.[parsed.command.label]?.alias || parsed.command.shortcut,
    };
  }
  return { action: 'unknown-command', parsed };
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

export function commandSuggestions(value, limit = 6, customization = null) {
  const normalized = normalizeCommandText(value);
  if (!normalized) return [];
  return COMMAND_DEFINITIONS
    .filter((definition) => {
      const customAlias = normalizeCommandText(customization?.commands?.[definition.label]?.alias);
      return customAlias.startsWith(normalized) || definition.aliases.some((alias) => alias.startsWith(normalized));
    })
    .slice(0, limit)
    .map(({ shortcut, label, aliases }) => ({
      shortcut: customization?.commands?.[label]?.shortcut || shortcut,
      label,
      command: customization?.commands?.[label]?.alias || aliases[1] || aliases[0],
    }));
}

export { COMMAND_DEFINITIONS };
