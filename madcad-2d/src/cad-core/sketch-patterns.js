import { evaluateExpression, resolveParameters } from './expressions.js';
import { createSketchArc, createSketchCircleEntity, createSketchLine, createSketchPoint } from './sketch-model.js';
import { refreshDetectedSketchProfiles } from './sketch-topology.js';

const SUPPORTED_TYPES = new Set(['point', 'line', 'arc', 'circle']);

function valuesFor(document) {
  const resolved = resolveParameters(document?.parameters || []);
  if (!resolved.valid) throw new Error(Object.values(resolved.errors).join(' '));
  return resolved.values;
}

function numeric(value, values, label) {
  const result = evaluateExpression(value, values);
  if (!Number.isFinite(result)) throw new Error(`${label} wymaga skończonej wartości.`);
  return result;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 100) throw new Error(`${label} musi być liczbą całkowitą od 1 do 100.`);
  return number;
}

export function parseSkippedPatternOccurrences(value) {
  if (Array.isArray(value)) return [...new Set(value.map(Number))].sort((left, right) => left - right);
  if (!String(value || '').trim()) return [];
  const result = new Set();
  for (const token of String(value).split(',').map((item) => item.trim()).filter(Boolean)) {
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const first = Number(range[1]); const last = Number(range[2]);
      if (last < first || last - first > 100) throw new Error(`Nieprawidłowy zakres pominięć: ${token}.`);
      for (let index = first; index <= last; index += 1) result.add(index);
      continue;
    }
    if (!/^\d+$/.test(token)) throw new Error(`Nieprawidłowy numer wystąpienia: ${token}.`);
    result.add(Number(token));
  }
  return [...result].sort((left, right) => left - right);
}

function sourceSelection(sketch, selectedIds) {
  const selected = new Set(selectedIds || []);
  const entities = (sketch.entities || []).filter((entity) => selected.has(entity.id));
  if (!entities.length) throw new Error('Wybierz geometrię szkicu do szyku.');
  if (entities.some((entity) => !SUPPORTED_TYPES.has(entity.type))) throw new Error('Szyk obsługuje obecnie punkty, linie, łuki i okręgi.');
  if (entities.some((entity) => entity.fixed || entity.role === 'projected')) throw new Error('Geometria ustalona lub rzutowana nie może być źródłem szyku.');
  const pointIds = new Set(entities.flatMap((entity) => entity.type === 'point' ? [entity.id] : (entity.pointIds || [])));
  const points = [...pointIds].map((pointId) => sketch.entities.find((entity) => entity.id === pointId && entity.type === 'point'));
  if (points.some((point) => !point)) throw new Error('Szyk wskazuje brakujący punkt szkicu.');
  if (points.some((point) => point.fixed || point.role === 'projected')) throw new Error('Geometria ustalona lub rzutowana nie może być źródłem szyku.');
  return { entities, points };
}

function appendOccurrence(sketch, source, values, transform, occurrenceIndex) {
  const pointMap = new Map();
  for (const point of source.points) {
    const coordinates = transform([
      evaluateExpression(point.geometry.x, values),
      evaluateExpression(point.geometry.y, values),
    ]);
    if (!coordinates.every(Number.isFinite)) throw new Error('Szyk utworzył nieprawidłową współrzędną.');
    pointMap.set(point.id, createSketchPoint({ x: coordinates[0], y: coordinates[1], role: point.role }));
  }
  const createdEntities = [];
  for (const entity of source.entities) {
    if (entity.type === 'point') continue;
    let copy;
    if (entity.type === 'line') copy = createSketchLine({ startPointId: pointMap.get(entity.pointIds[0]).id, endPointId: pointMap.get(entity.pointIds[1]).id, role: entity.role });
    else if (entity.type === 'arc') copy = createSketchArc({ centerPointId: pointMap.get(entity.pointIds[0]).id, startPointId: pointMap.get(entity.pointIds[1]).id, endPointId: pointMap.get(entity.pointIds[2]).id, direction: entity.geometry.direction, role: entity.role });
    else if (entity.type === 'circle') copy = createSketchCircleEntity({ centerPointId: pointMap.get(entity.pointIds[0]).id, radius: evaluateExpression(entity.geometry.radius, values), role: entity.role });
    createdEntities.push(copy);
  }
  const standalonePoints = source.entities.filter((entity) => entity.type === 'point').map((entity) => pointMap.get(entity.id));
  const createdPoints = [...pointMap.values()];
  sketch.entities.push(...createdPoints, ...createdEntities);
  return {
    occurrenceIndex,
    entityIds: [...standalonePoints.map((point) => point.id), ...createdEntities.map((entity) => entity.id)],
    pointIds: createdPoints.map((point) => point.id),
  };
}

function applyPattern(document, sketchId, selectedIds, occurrenceTransforms, skippedOccurrences, label) {
  const sketch = document?.sketches?.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono szkicu do szyku.');
  const working = structuredClone(sketch);
  const source = sourceSelection(working, selectedIds);
  const values = valuesFor(document);
  const skipped = new Set(parseSkippedPatternOccurrences(skippedOccurrences));
  const total = occurrenceTransforms.length + 1;
  if (skipped.has(1)) throw new Error('Wystąpienie 1 jest geometrią źródłową i nie może zostać pominięte.');
  if ([...skipped].some((index) => !Number.isInteger(index) || index < 1 || index > total)) throw new Error(`Numery pominięć muszą mieścić się w zakresie 2–${total}.`);
  const occurrences = occurrenceTransforms
    .map((transform, index) => ({ transform, occurrenceIndex: index + 2 }))
    .filter((entry) => !skipped.has(entry.occurrenceIndex))
    .map((entry) => appendOccurrence(working, source, values, entry.transform, entry.occurrenceIndex));
  if (!occurrences.length) throw new Error('Szyk musi utworzyć co najmniej jedną kopię.');
  refreshDetectedSketchProfiles(working, document.parameters);
  const createdEntityIds = occurrences.flatMap((entry) => entry.entityIds);
  const invalid = (working.diagnostics || []).find((item) => ['SELF_INTERSECTION', 'OVERLAPPING_SEGMENTS', 'ZERO_LENGTH_SEGMENT'].includes(item.code)
    && item.entityIds?.some((entityId) => createdEntityIds.includes(entityId)));
  if (invalid) throw new Error(`${label} został odrzucony: ${invalid.message}`);
  Object.assign(sketch, working);
  return {
    occurrences,
    skippedOccurrences: [...skipped],
    createdEntityIds,
    createdPointIds: occurrences.flatMap((entry) => entry.pointIds),
    profileIds: sketch.profiles.filter((profile) => profile.entityIds?.some((entityId) => createdEntityIds.includes(entityId))).map((profile) => profile.id),
  };
}

export function rectangularSketchPattern(document, sketchId, selectedIds, options = {}) {
  const values = valuesFor(document);
  const columns = positiveInteger(options.columns ?? 2, 'Liczba kolumn');
  const rows = positiveInteger(options.rows ?? 1, 'Liczba wierszy');
  if (columns * rows < 2 || columns * rows > 100) throw new Error('Szyk prostokątny wymaga od 2 do 100 wystąpień.');
  const spacingX = numeric(options.spacingX ?? 10, values, 'Odstęp X');
  const spacingY = numeric(options.spacingY ?? 10, values, 'Odstęp Y');
  const transforms = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (row === 0 && column === 0) continue;
      transforms.push(([x, y]) => [x + column * spacingX, y + row * spacingY]);
    }
  }
  return applyPattern(document, sketchId, selectedIds, transforms, options.skippedOccurrences, 'Szyk prostokątny');
}

export function circularSketchPattern(document, sketchId, selectedIds, options = {}) {
  const values = valuesFor(document);
  const count = positiveInteger(options.count ?? 4, 'Liczba wystąpień');
  if (count < 2) throw new Error('Szyk kołowy wymaga co najmniej dwóch wystąpień.');
  const centerX = numeric(options.centerX ?? 0, values, 'Środek X');
  const centerY = numeric(options.centerY ?? 0, values, 'Środek Y');
  const totalAngle = numeric(options.totalAngle ?? 360, values, 'Kąt całkowity');
  if (Math.abs(totalAngle) < 1e-7 || Math.abs(totalAngle) > 360) throw new Error('Kąt całkowity musi być różny od zera i nie większy niż 360°.');
  const closed = Math.abs(Math.abs(totalAngle) - 360) < 1e-7;
  const step = totalAngle / (closed ? count : count - 1);
  const transforms = Array.from({ length: count - 1 }, (_, index) => {
    const radians = step * (index + 1) * Math.PI / 180;
    const cosine = Math.cos(radians); const sine = Math.sin(radians);
    return ([x, y]) => [
      centerX + (x - centerX) * cosine - (y - centerY) * sine,
      centerY + (x - centerX) * sine + (y - centerY) * cosine,
    ];
  });
  return applyPattern(document, sketchId, selectedIds, transforms, options.skippedOccurrences, 'Szyk kołowy');
}
