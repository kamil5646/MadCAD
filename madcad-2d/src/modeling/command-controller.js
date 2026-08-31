const COMMAND_DEFINITIONS = Object.freeze([
  { category: 'RYSUJ 2D', shortcut: 'L', label: 'Linia', toolLabel: 'Linia', aliases: ['L', 'LINE', 'LINIA'] },
  { category: 'RYSUJ 2D', shortcut: 'PL', label: 'Polilinia', toolLabel: 'Polilinia', aliases: ['PL', 'PLINE', 'POLYLINE', 'POLILINIA'] },
  { category: 'RYSUJ 2D', shortcut: 'R', label: 'Prostokąt', toolLabel: 'Prostokąt', aliases: ['R', 'REC', 'RECTANG', 'RECTANGLE', 'PROSTOKAT', 'PROSTOKĄT'] },
  { category: 'RYSUJ 2D', shortcut: 'C', label: 'Okrąg', toolLabel: 'Okrąg', aliases: ['C', 'CIRCLE', 'OKRAG', 'OKRĄG'] },
  { category: 'RYSUJ 2D', shortcut: 'A', label: 'Łuk', toolLabel: 'Łuk', aliases: ['A', 'ARC', 'LUK', 'ŁUK'] },
  { category: 'RYSUJ 2D', shortcut: 'POL', label: 'Wielokąt', toolLabel: 'Wielokąt', aliases: ['POL', 'POLYGON', 'WIELOKAT', 'WIELOKĄT'] },
  { category: 'RYSUJ 2D', shortcut: 'EL', label: 'Elipsa', toolLabel: 'Elipsa', aliases: ['EL', 'ELLIPSE', 'ELIPSA'] },
  { category: 'RYSUJ 2D', shortcut: 'SL', label: 'Slot', toolLabel: 'Slot', aliases: ['SL', 'SLOT', 'ROWEK'] },
  { category: 'RYSUJ 2D', shortcut: 'SPL', label: 'Spline', toolLabel: 'Spline', aliases: ['SPL', 'SPLINE', 'KRZYWA'] },
  { category: 'RYSUJ 2D', shortcut: 'POINT', label: 'Punkt', toolLabel: 'Punkt', aliases: ['POINT', 'PUNKT'] },

  { category: 'EDYTUJ 2D', shortcut: 'T', label: 'Trim', toolLabel: 'Trim', aliases: ['T', 'TR', 'TRIM', 'PRZYTNIJ'] },
  { category: 'EDYTUJ 2D', shortcut: 'EX', label: 'Extend', toolLabel: 'Extend', aliases: ['EX', 'EXTEND', 'PRZEDLUZ', 'PRZEDŁUŻ'] },
  { category: 'EDYTUJ 2D', shortcut: 'BR', label: 'Break', toolLabel: 'Break', aliases: ['BR', 'BREAK', 'PODZIEL'] },
  { category: 'EDYTUJ 2D', shortcut: 'O', label: 'Offset', toolLabel: 'Offset', aliases: ['O', 'OFFSET', 'ODSUN'] },
  { category: 'EDYTUJ 2D', shortcut: 'F', label: 'Fillet szkicu', toolLabel: 'Fillet szkicu', aliases: ['F', 'FILLET', 'ZAOKRAGLIJ', 'ZAOKRĄGLIJ'] },
  { category: 'EDYTUJ 2D', shortcut: 'CHA', label: 'Faza szkicu', toolLabel: 'Faza szkicu', aliases: ['CHA', 'CHAMFER', 'FAZA', 'FAZUJ'] },
  { category: 'EDYTUJ 2D', shortcut: 'M', label: 'Przesuń', toolLabel: 'Przesuń', aliases: ['M', 'MOVE', 'PRZESUN', 'PRZESUŃ'] },
  { category: 'EDYTUJ 2D', shortcut: 'TRF', label: 'Transformuj', toolLabel: 'Transformuj', aliases: ['TRF', 'TRANSFORM', 'TRANSFORMUJ'] },
  { category: 'EDYTUJ 2D', shortcut: 'AR', label: 'Szyk szkicu', toolLabel: 'Szyk szkicu', aliases: ['AR', 'ARRAY', 'SZYK'] },
  { category: 'EDYTUJ 2D', shortcut: 'P', label: 'Project', toolLabel: 'Project', aliases: ['P', 'PROJECT', 'RZUTUJ'] },
  { category: 'EDYTUJ 2D', shortcut: 'DEL', label: 'Usuń', toolLabel: 'Usuń', aliases: ['DEL', 'DELETE', 'ERASE', 'USUN', 'USUŃ'] },

  { category: 'MODELUJ 3D', shortcut: 'E', label: 'Wyciągnij', toolLabel: 'Wyciągnij', aliases: ['E', 'EXTRUDE', 'WYCIAGNIJ', 'WYCIĄGNIJ'] },
  { category: 'POWIERZCHNIE', shortcut: 'PA', label: 'Patch', toolLabel: 'Patch', aliases: ['PA', 'PATCH', 'WYPELNIJPOWIERZCHNIE'] },
  { category: 'POWIERZCHNIE', shortcut: 'SE', label: 'Surface Extrude', toolLabel: 'Surface Extrude', aliases: ['SE', 'SURFACEEXTRUDE', 'WYCIAGNIJPOWIERZCHNIE'] },
  { category: 'POWIERZCHNIE', shortcut: 'SR', label: 'Surface Revolve', toolLabel: 'Surface Revolve', aliases: ['SR', 'SURFACEREVOLVE', 'OBROCPOWIERZCHNIE'] },
  { category: 'POWIERZCHNIE', shortcut: 'TH', label: 'Thicken', toolLabel: 'Thicken', aliases: ['TH', 'THICKEN', 'POGRUB'] },
  { category: 'MODELUJ 3D', shortcut: 'REV', label: 'Revolve', toolLabel: 'Revolve', aliases: ['REV', 'REVOLVE', 'OBROT'] },
  { category: 'MODELUJ 3D', shortcut: 'SW', label: 'Sweep', toolLabel: 'Sweep', aliases: ['SW', 'SWEEP', 'PRZECIAGNIJ'] },
  { category: 'MODELUJ 3D', shortcut: 'LO', label: 'Loft', toolLabel: 'Loft', aliases: ['LO', 'LOFT'] },
  { category: 'MODELUJ 3D', shortcut: 'PP', label: 'Press Pull', toolLabel: 'Press Pull', aliases: ['PP', 'PRESSPULL', 'PRESSPULL3D'] },
  { category: 'MODELUJ 3D', shortcut: 'BOX', label: 'Prymityw', toolLabel: 'Prymityw', aliases: ['BOX', 'PRIMITIVE', 'PRYMITYW'] },
  { category: 'MODELUJ 3D', shortcut: 'COIL', label: 'Coil', toolLabel: 'Coil', aliases: ['COIL', 'SPIRALA'] },
  { category: 'MODELUJ 3D', shortcut: 'TXT', label: 'Tekst 3D', toolLabel: 'Tekst 3D', aliases: ['TXT', 'TEXT3D', 'TEKST3D'] },
  { category: 'MODELUJ 3D', shortcut: 'BO', label: 'Boolean', toolLabel: 'Boolean', aliases: ['BO', 'BOOLEAN', 'BOOL'] },
  { category: 'MODELUJ 3D', shortcut: 'H', label: 'Otwór', toolLabel: 'Otwór', aliases: ['H', 'HOLE', 'OTWOR', 'OTWÓR'] },

  { category: 'MODYFIKUJ 3D', shortcut: 'FE', label: 'Zaokrąglij', toolLabel: 'Zaokrąglij', aliases: ['FE', 'FILLETEDGE', 'ZAOKRAGLIJ3D'] },
  { category: 'MODYFIKUJ 3D', shortcut: 'CH3', label: 'Fazuj', toolLabel: 'Fazuj', aliases: ['CH3', 'CHAMFEREDGE', 'FAZUJ3D'] },
  { category: 'MODYFIKUJ 3D', shortcut: 'SH', label: 'Shell', toolLabel: 'Shell', aliases: ['SH', 'SHELL', 'POWLOKA'] },
  { category: 'MODYFIKUJ 3D', shortcut: 'DR', label: 'Draft', toolLabel: 'Draft', aliases: ['DR', 'DRAFT', 'POCHYL'] },
  { category: 'MODYFIKUJ 3D', shortcut: 'SB', label: 'Split Body', toolLabel: 'Split Body', aliases: ['SB', 'SPLITBODY', 'PODZIELBRYLE'] },
  { category: 'MODYFIKUJ 3D', shortcut: 'SF', label: 'Split Face', toolLabel: 'Split Face', aliases: ['SF', 'SPLITFACE', 'PODZIELSCIANE'] },
  { category: 'MODYFIKUJ 3D', shortcut: 'DF', label: 'Delete Face + Heal', toolLabel: 'Delete Face + Heal', aliases: ['DF', 'DELETEFACE', 'USUNSCIANE'] },
  { category: 'MODYFIKUJ 3D', shortcut: 'RF', label: 'Replace Face', toolLabel: 'Replace Face', aliases: ['RF', 'REPLACEFACE', 'ZASTAPSCIANE'] },
  { category: 'MODYFIKUJ 3D', shortcut: 'OF', label: 'Offset Face', toolLabel: 'Offset Face', aliases: ['OF', 'OFFSETFACE', 'ODSUNSCIANE'] },
  { category: 'MODYFIKUJ 3D', shortcut: '3M', label: 'Przesuń bryłę', toolLabel: 'Przesuń bryłę', aliases: ['3M', '3DMOVE', 'PRZESUNBRYLE'] },
  { category: 'MODYFIKUJ 3D', shortcut: '3R', label: 'Obróć bryłę', toolLabel: 'Obróć bryłę', aliases: ['3R', '3DROTATE', 'OBROCBRYLE'] },
  { category: 'MODYFIKUJ 3D', shortcut: 'ED', label: 'Edytuj', toolLabel: 'Edytuj', aliases: ['ED', 'EDIT', 'EDYTUJ'] },

  { category: 'SPRAWDŹ', shortcut: 'I', label: 'Zmierz', toolLabel: 'Zmierz', aliases: ['I', 'DI', 'DIST', 'MEASURE', 'ZMIERZ'] },
  { category: 'SPRAWDŹ', shortcut: 'SEC', label: 'Przekrój', toolLabel: 'Przekrój', aliases: ['SEC', 'SECTION', 'PRZEKROJ', 'PRZEKRÓJ'] },
  { category: 'SPRAWDŹ', shortcut: 'MP', label: 'Masa', toolLabel: 'Masa', aliases: ['MP', 'MASSPROP', 'MASA'] },
  { category: 'SPRAWDŹ', shortcut: 'AN', label: 'Analiza', toolLabel: 'Analiza', aliases: ['AN', 'ANALYZE', 'ANALIZA'] },
  { category: 'SPRAWDŹ', shortcut: 'PAR', label: 'Parametry', toolLabel: 'Parametry', aliases: ['PAR', 'PARAMETERS', 'PARAMETRY'] },
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
  surfacePatch: 'PATCH',
  surfaceExtrude: 'SURFACE EXTRUDE',
  surfaceRevolve: 'SURFACE REVOLVE',
  thickenSurface: 'THICKEN',
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
