import { createSketchArc, createSketchCircleEntity, createSketchLine, createSketchPoint } from './sketch-model.js';
import { refreshDetectedSketchProfiles } from './sketch-topology.js';

export const SKETCH_IMPORT_UNITS = Object.freeze({
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  meter: 1000,
  micron: 0.001,
});

function number(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Nieprawidłowa wartość ${label}.`);
  return parsed;
}

function builder(scale, flipY = false) {
  const entities = [];
  const points = new Map();
  const coordinate = ([x, y]) => [number(x, 'X') * scale, number(y, 'Y') * scale * (flipY ? -1 : 1)];
  const point = (raw) => {
    const [x, y] = coordinate(raw);
    const key = `${Math.round(x * 1e7)}:${Math.round(y * 1e7)}`;
    if (points.has(key)) return points.get(key);
    const entity = createSketchPoint({ x, y });
    points.set(key, entity);
    entities.push(entity);
    return entity;
  };
  return {
    entities,
    line(start, end) {
      const first = point(start);
      const last = point(end);
      if (first.id === last.id) return;
      entities.push(createSketchLine({ startPointId: first.id, endPointId: last.id }));
    },
    circle(center, radius) {
      const centerPoint = point(center);
      entities.push(createSketchCircleEntity({ centerPointId: centerPoint.id, radius: number(radius, 'promienia') * scale }));
    },
    arc(center, radius, startAngle, endAngle) {
      const radians = (degrees) => number(degrees, 'kąta') * Math.PI / 180;
      const centerValue = coordinate(center);
      const scaledRadius = number(radius, 'promienia') * scale;
      const start = [centerValue[0] + Math.cos(radians(startAngle)) * scaledRadius, centerValue[1] + Math.sin(radians(startAngle)) * scaledRadius];
      const end = [centerValue[0] + Math.cos(radians(endAngle)) * scaledRadius, centerValue[1] + Math.sin(radians(endAngle)) * scaledRadius];
      const centerPoint = point([centerValue[0] / scale, centerValue[1] / scale * (flipY ? -1 : 1)]);
      const startPoint = point([start[0] / scale, start[1] / scale * (flipY ? -1 : 1)]);
      const endPoint = point([end[0] / scale, end[1] / scale * (flipY ? -1 : 1)]);
      entities.push(createSketchArc({ centerPointId: centerPoint.id, startPointId: startPoint.id, endPointId: endPoint.id, direction: flipY ? 'cw' : 'ccw' }));
    },
  };
}

function attributes(source) {
  const result = {};
  for (const match of String(source || '').matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1].toLowerCase()] = match[2];
  return result;
}

function coordinateList(value) {
  const values = String(value || '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (values.length < 2 || values.length % 2) throw new Error('Lista punktów SVG jest nieprawidłowa.');
  return Array.from({ length: values.length / 2 }, (_, index) => [values[index * 2], values[index * 2 + 1]]);
}

function importSvgPath(data, target, diagnostics) {
  const tokens = String(data || '').match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) || [];
  let index = 0;
  let command = '';
  let current = [0, 0];
  let start = null;
  const read = () => number(tokens[index++], 'ścieżki SVG');
  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    if (!command) throw new Error('Ścieżka SVG nie rozpoczyna się poleceniem.');
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    if (upper === 'Z') {
      if (start && (current[0] !== start[0] || current[1] !== start[1])) target.line(current, start);
      current = start || current;
      command = '';
      continue;
    }
    if (!['M', 'L', 'H', 'V'].includes(upper)) {
      diagnostics.push({ code: 'SVG_PATH_UNSUPPORTED', message: `Pominięto ścieżkę z poleceniem ${command}.` });
      return;
    }
    let next;
    if (upper === 'H') next = [read(), current[1]];
    else if (upper === 'V') next = [current[0], read()];
    else next = [read(), read()];
    if (relative) next = [next[0] + (upper === 'V' ? 0 : current[0]), next[1] + (upper === 'H' ? 0 : current[1])];
    if (upper === 'M') {
      current = next;
      start = next;
      command = relative ? 'l' : 'L';
    } else {
      target.line(current, next);
      current = next;
    }
  }
}

function inspectSvgUnit(text) {
  const svg = String(text).match(/<svg\b([^>]*)>/i);
  const attr = svg ? attributes(svg[1]) : {};
  const unitFor = (value) => /in\s*$/i.test(value) ? 'inch' : /cm\s*$/i.test(value) ? 'centimeter' : /mm\s*$/i.test(value) ? 'millimeter' : /m\s*$/i.test(value) ? 'meter' : null;
  const detectedUnit = unitFor(attr.width || '') || unitFor(attr.height || '') || 'millimeter';
  const viewBox = String(attr.viewbox || '').trim().split(/[\s,]+/).map(Number);
  const physical = (value) => {
    const numeric = Number.parseFloat(value);
    const unit = unitFor(value) || detectedUnit;
    return Number.isFinite(numeric) ? numeric * (SKETCH_IMPORT_UNITS[unit] || 1) : null;
  };
  let autoScale = SKETCH_IMPORT_UNITS[detectedUnit];
  if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    const physicalWidth = physical(attr.width);
    const physicalHeight = physical(attr.height);
    const scaleX = physicalWidth === null ? Number.NaN : physicalWidth / viewBox[2];
    const scaleY = physicalHeight === null ? Number.NaN : physicalHeight / viewBox[3];
    if (Number.isFinite(scaleX) && Number.isFinite(scaleY) && Math.abs(scaleX - scaleY) > Math.max(scaleX, scaleY) * 1e-6) {
      throw new Error('SVG ma niejednorodną skalę viewBox; ustaw zgodne proporcje width/height.');
    }
    autoScale = Number.isFinite(scaleX) ? scaleX : Number.isFinite(scaleY) ? scaleY : autoScale;
  }
  return { detectedUnit, autoScale };
}

function parseSvg(text, target, diagnostics) {
  for (const match of String(text).matchAll(/<(line|rect|circle|polyline|polygon|path)\b([^>]*)\/?\s*>/gi)) {
    const type = match[1].toLowerCase();
    const attr = attributes(match[2]);
    if (attr.transform) {
      diagnostics.push({ code: 'SVG_TRANSFORM_UNSUPPORTED', message: `Pominięto ${type} z transformacją SVG.` });
      continue;
    }
    if (type === 'line') target.line([attr.x1 || 0, attr.y1 || 0], [attr.x2 || 0, attr.y2 || 0]);
    else if (type === 'rect') {
      const x = number(attr.x || 0, 'x'); const y = number(attr.y || 0, 'y');
      const width = number(attr.width, 'szerokości'); const height = number(attr.height, 'wysokości');
      [[x, y], [x + width, y], [x + width, y + height], [x, y + height]].forEach((point, index, list) => target.line(point, list[(index + 1) % list.length]));
      if (attr.rx || attr.ry) diagnostics.push({ code: 'SVG_ROUNDED_RECT', message: 'Zaokrąglenie prostokąta SVG uproszczono do ostrych narożników.' });
    } else if (type === 'circle') target.circle([attr.cx || 0, attr.cy || 0], attr.r);
    else if (type === 'polyline' || type === 'polygon') {
      const points = coordinateList(attr.points);
      points.slice(1).forEach((point, index) => target.line(points[index], point));
      if (type === 'polygon') target.line(points.at(-1), points[0]);
    } else importSvgPath(attr.d, target, diagnostics);
  }
}

function dxfPairs(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const pairs = [];
  for (let index = 0; index + 1 < lines.length; index += 2) pairs.push([Number(lines[index].trim()), lines[index + 1].trim()]);
  return pairs;
}

function detectedDxfUnit(pairs) {
  const index = pairs.findIndex(([code, value]) => code === 9 && value === '$INSUNITS');
  const code = index >= 0 ? Number(pairs.slice(index + 1, index + 5).find(([group]) => group === 70)?.[1]) : 4;
  return ({ 1: 'inch', 4: 'millimeter', 5: 'centimeter', 6: 'meter', 13: 'micron' })[code] || 'millimeter';
}

function first(entity, code, fallback = undefined) {
  return entity.find(([group]) => group === code)?.[1] ?? fallback;
}

function parseDxf(pairs, target, diagnostics) {
  const entities = [];
  let current = null;
  let inEntities = false;
  for (let pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
    const pair = pairs[pairIndex];
    if (pair[0] === 0 && pair[1] === 'SECTION' && pairs[pairIndex + 1]?.[0] === 2) {
      if (current) entities.push(current);
      current = null;
      inEntities = pairs[pairIndex + 1][1] === 'ENTITIES';
      pairIndex += 1;
      continue;
    }
    if (pair[0] === 0 && pair[1] === 'ENDSEC') {
      if (current) entities.push(current);
      current = null;
      inEntities = false;
      continue;
    }
    if (!inEntities) continue;
    if (pair[0] === 0) {
      if (current) entities.push(current);
      current = { type: pair[1], pairs: [] };
    } else if (current) current.pairs.push(pair);
  }
  if (current) entities.push(current);
  for (const entity of entities) {
    const values = entity.pairs;
    if (entity.type === 'LINE') target.line([first(values, 10), first(values, 20)], [first(values, 11), first(values, 21)]);
    else if (entity.type === 'CIRCLE') target.circle([first(values, 10), first(values, 20)], first(values, 40));
    else if (entity.type === 'ARC') target.arc([first(values, 10), first(values, 20)], first(values, 40), first(values, 50), first(values, 51));
    else if (entity.type === 'LWPOLYLINE') {
      const points = [];
      for (let index = 0; index < values.length; index += 1) {
        if (values[index][0] === 10) points.push([values[index][1], values.slice(index + 1).find(([code]) => code === 20)?.[1]]);
      }
      points.slice(1).forEach((point, index) => target.line(points[index], point));
      if ((Number(first(values, 70, 0)) & 1) && points.length > 2) target.line(points.at(-1), points[0]);
      if (values.some(([code, value]) => code === 42 && Number(value))) diagnostics.push({ code: 'DXF_BULGE_UNSUPPORTED', message: 'Łuki bulge w polilinii DXF zostały zastąpione odcinkami.' });
    }
  }
}

export function inspectSketchImport(text, format) {
  const normalized = String(format || '').toLowerCase().replace(/^\./, '');
  if (normalized === 'svg') return { format: 'svg', ...inspectSvgUnit(text) };
  if (normalized === 'dxf') {
    const detectedUnit = detectedDxfUnit(dxfPairs(text));
    return { format: 'dxf', detectedUnit, autoScale: SKETCH_IMPORT_UNITS[detectedUnit] };
  }
  throw new Error('Import szkicu obsługuje pliki SVG albo DXF.');
}

export function parseSketchImport(text, format, options = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Plik importu szkicu jest pusty.');
  if (text.length > 32 * 1024 * 1024) throw new Error('Plik importu szkicu przekracza limit 32 MB.');
  const inspected = inspectSketchImport(text, format);
  const automatic = options.sourceUnit === 'auto' || !options.sourceUnit;
  const sourceUnit = automatic ? inspected.detectedUnit : options.sourceUnit;
  const scale = automatic ? inspected.autoScale : SKETCH_IMPORT_UNITS[sourceUnit];
  if (!scale) throw new Error('Nieobsługiwana jednostka importu szkicu.');
  const diagnostics = [];
  const target = builder(scale, inspected.format === 'svg');
  if (inspected.format === 'svg') parseSvg(text, target, diagnostics);
  else parseDxf(dxfPairs(text), target, diagnostics);
  const curves = target.entities.filter((entity) => entity.type !== 'point');
  if (!curves.length) throw new Error('Plik nie zawiera obsługiwanej geometrii szkicu.');
  const sketch = { entities: target.entities, profiles: [], constraints: [], dimensions: [] };
  const topology = refreshDetectedSketchProfiles(sketch);
  return {
    format: inspected.format,
    detectedUnit: inspected.detectedUnit,
    sourceUnit,
    scale,
    entities: sketch.entities,
    profiles: sketch.profiles,
    diagnostics: [...diagnostics, ...(topology.diagnostics || [])],
    curveCount: curves.length,
  };
}
