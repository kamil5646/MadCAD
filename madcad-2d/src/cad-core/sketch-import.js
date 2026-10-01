import { createSketchArc, createSketchCircleEntity, createSketchEntity, createSketchLine, createSketchPoint } from './sketch-model.js';
import { refreshDetectedSketchProfiles } from './sketch-topology.js';

export const SKETCH_IMPORT_UNITS = Object.freeze({
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  meter: 1000,
  micron: 0.001,
  foot: 304.8,
  yard: 914.4,
  mile: 1609344,
  kilometer: 1000000,
  decimeter: 100,
  mil: 0.0254,
  microinch: 0.0000254,
});

// AutoCAD $INSUNITS codes; 0 (unitless) and unknown codes fall back to millimeters.
const DXF_INSUNITS = Object.freeze({
  1: 'inch', 2: 'foot', 3: 'mile', 4: 'millimeter', 5: 'centimeter', 6: 'meter', 7: 'kilometer',
  8: 'microinch', 9: 'mil', 10: 'yard', 13: 'micron', 14: 'decimeter',
});

function number(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Nieprawidłowa wartość ${label}.`);
  return parsed;
}

function builder(scale, flipY = false, diagnostics = []) {
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
      if (first.id === last.id) {
        diagnostics.push({ code: 'ZERO_LENGTH_SKIPPED', status: 'skipped', message: 'Pominięto odcinek o zerowej długości.' });
        return;
      }
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
    ellipse(center, majorRadius, minorRadius, rotationDegrees) {
      const centerPoint = point(center);
      entities.push(createSketchEntity('ellipse', {
        pointIds: [centerPoint.id],
        geometry: { majorRadius: String(majorRadius * scale), minorRadius: String(minorRadius * scale), rotation: String(rotationDegrees) },
        expressionKeys: ['majorRadius', 'minorRadius', 'rotation'],
      }));
    },
    ellipticalArc(center, majorRadius, minorRadius, rotationDegrees, startDegrees, endDegrees) {
      const rotation = rotationDegrees * Math.PI / 180;
      const onEllipse = (parameterDegrees) => {
        const parameter = parameterDegrees * Math.PI / 180;
        const x = Math.cos(parameter) * majorRadius;
        const y = Math.sin(parameter) * minorRadius;
        return [center[0] + x * Math.cos(rotation) - y * Math.sin(rotation), center[1] + x * Math.sin(rotation) + y * Math.cos(rotation)];
      };
      const centerPoint = point(center);
      const startPoint = point(onEllipse(startDegrees));
      const endPoint = point(onEllipse(endDegrees));
      entities.push(createSketchEntity('ellipticalArc', {
        pointIds: [centerPoint.id, startPoint.id, endPoint.id],
        geometry: { majorRadius: String(majorRadius * scale), minorRadius: String(minorRadius * scale), rotation: String(rotationDegrees), startAngle: String(startDegrees), endAngle: String(endDegrees), direction: 'ccw' },
        expressionKeys: ['majorRadius', 'minorRadius', 'rotation', 'startAngle', 'endAngle'],
      }));
    },
    spline(coordinates, mode = 'fit') {
      const splinePoints = coordinates.map(point);
      if (new Set(splinePoints.map((entry) => entry.id)).size < 2) return;
      entities.push(createSketchEntity('spline', { pointIds: splinePoints.map((entry) => entry.id), geometry: { mode, closed: false }, expressionKeys: [] }));
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
      diagnostics.push({ code: 'SVG_PATH_UNSUPPORTED', status: 'skipped', message: `Pominięto ścieżkę z poleceniem ${command}.` });
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
  for (const match of String(text).matchAll(/<(line|rect|circle|polyline|polygon|path|ellipse|text|use|image)\b([^>]*)\/?\s*>/gi)) {
    const type = match[1].toLowerCase();
    const attr = attributes(match[2]);
    if (['ellipse', 'text', 'use', 'image'].includes(type)) {
      diagnostics.push({ code: 'SVG_ELEMENT_UNSUPPORTED', status: 'skipped', message: `Pominięto nieobsługiwany element SVG: ${type}.` });
      continue;
    }
    if (attr.transform) {
      diagnostics.push({ code: 'SVG_TRANSFORM_UNSUPPORTED', status: 'skipped', message: `Pominięto ${type} z transformacją SVG.` });
      continue;
    }
    if (type === 'line') target.line([attr.x1 || 0, attr.y1 || 0], [attr.x2 || 0, attr.y2 || 0]);
    else if (type === 'rect') {
      const x = number(attr.x || 0, 'x'); const y = number(attr.y || 0, 'y');
      const width = number(attr.width, 'szerokości'); const height = number(attr.height, 'wysokości');
      [[x, y], [x + width, y], [x + width, y + height], [x, y + height]].forEach((point, index, list) => target.line(point, list[(index + 1) % list.length]));
      if (attr.rx || attr.ry) diagnostics.push({ code: 'SVG_ROUNDED_RECT', status: 'changed', message: 'Zaokrąglenie prostokąta SVG uproszczono do ostrych narożników.' });
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
  return DXF_INSUNITS[code] || 'millimeter';
}

function first(entity, code, fallback = undefined) {
  return entity.find(([group]) => group === code)?.[1] ?? fallback;
}

function num(values, code, fallback = 0) {
  const value = Number(first(values, code));
  return Number.isFinite(value) ? value : fallback;
}

// 2D affine transforms as [a, b, c, d, tx, ty]: x' = a*x + c*y + tx, y' = b*x + d*y + ty.
const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);
const OCS_FLIP_X = Object.freeze([-1, 0, 0, 1, 0, 0]);

function applyMatrix(m, [x, y]) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function multiplyMatrix(outer, inner) {
  return [
    outer[0] * inner[0] + outer[2] * inner[1], outer[1] * inner[0] + outer[3] * inner[1],
    outer[0] * inner[2] + outer[2] * inner[3], outer[1] * inner[2] + outer[3] * inner[3],
    outer[0] * inner[4] + outer[2] * inner[5] + outer[4], outer[1] * inner[4] + outer[3] * inner[5] + outer[5],
  ];
}

function determinant(m) { return m[0] * m[3] - m[1] * m[2]; }

function isSimilarity(m) {
  const scaleX = Math.hypot(m[0], m[1]);
  const scaleY = Math.hypot(m[2], m[3]);
  return scaleX > 1e-12 && Math.abs(scaleX - scaleY) <= 1e-9 * Math.max(scaleX, scaleY, 1) && Math.abs(m[0] * m[2] + m[1] * m[3]) <= 1e-9 * scaleX * scaleY;
}

function insertMatrix(position, scaleX, scaleY, rotationDegrees, base) {
  const angle = rotationDegrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotateScale = [cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, 0, 0];
  return multiplyMatrix([1, 0, 0, 1, position[0], position[1]], multiplyMatrix(rotateScale, [1, 0, 0, 1, -base[0], -base[1]]));
}

const radiansToDegrees = (value) => value * 180 / Math.PI;

function emitArc(target, diagnostics, center, radius, startDegrees, endDegrees, m) {
  const polar = (degrees) => [center[0] + Math.cos(degrees * Math.PI / 180) * radius, center[1] + Math.sin(degrees * Math.PI / 180) * radius];
  if (!isSimilarity(m)) {
    // Non-uniform scaling turns an arc into an ellipse arc; keep it as short chords.
    let sweep = endDegrees - startDegrees;
    while (sweep <= 0) sweep += 360;
    const steps = Math.max(8, Math.ceil(sweep / 7.5));
    const sampled = Array.from({ length: steps + 1 }, (_, index) => applyMatrix(m, polar(startDegrees + sweep * index / steps)));
    sampled.slice(1).forEach((end, index) => target.line(sampled[index], end));
    diagnostics.push({ code: 'DXF_NONUNIFORM_SCALE_APPROXIMATED', status: 'changed', message: 'Łuk w bloku o nierównych skalach XY zastąpiono odcinkami.' });
    return;
  }
  const mappedCenter = applyMatrix(m, center);
  const mappedStart = applyMatrix(m, polar(startDegrees));
  const mappedEnd = applyMatrix(m, polar(endDegrees));
  const mappedRadius = Math.hypot(mappedStart[0] - mappedCenter[0], mappedStart[1] - mappedCenter[1]);
  let startAngle = radiansToDegrees(Math.atan2(mappedStart[1] - mappedCenter[1], mappedStart[0] - mappedCenter[0]));
  let endAngle = radiansToDegrees(Math.atan2(mappedEnd[1] - mappedCenter[1], mappedEnd[0] - mappedCenter[0]));
  // A reflection reverses the sweep, so the same arc runs counter-clockwise from end to start.
  if (determinant(m) < 0) [startAngle, endAngle] = [endAngle, startAngle];
  target.arc(mappedCenter, mappedRadius, startAngle, endAngle);
}

function emitCircle(target, diagnostics, center, radius, m) {
  if (!isSimilarity(m)) {
    emitArc(target, diagnostics, center, radius, 0, 360, m);
    return;
  }
  target.circle(applyMatrix(m, center), radius * Math.sqrt(Math.abs(determinant(m))));
}

function emitBulgeSegment(target, diagnostics, from, to, bulge, m) {
  if (Math.abs(bulge) < 1e-9) {
    target.line(applyMatrix(m, from), applyMatrix(m, to));
    return;
  }
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return;
  const included = 4 * Math.atan(bulge);
  const radius = chord / (2 * Math.sin(Math.abs(included) / 2));
  const offset = (chord / 2) / Math.tan(included / 2);
  const center = [(from[0] + to[0]) / 2 - dy / chord * offset, (from[1] + to[1]) / 2 + dx / chord * offset];
  const angleOf = (coordinate) => radiansToDegrees(Math.atan2(coordinate[1] - center[1], coordinate[0] - center[0]));
  if (bulge > 0) emitArc(target, diagnostics, center, radius, angleOf(from), angleOf(to), m);
  else emitArc(target, diagnostics, center, radius, angleOf(to), angleOf(from), m);
}

function emitPolyline(target, diagnostics, vertices, closed, m) {
  for (let index = 0; index + 1 < vertices.length; index += 1) emitBulgeSegment(target, diagnostics, vertices[index].point, vertices[index + 1].point, vertices[index].bulge, m);
  if (closed && vertices.length > 2) emitBulgeSegment(target, diagnostics, vertices.at(-1).point, vertices[0].point, vertices.at(-1).bulge, m);
}

function lwPolylineVertices(values) {
  const vertices = [];
  for (const [code, value] of values) {
    if (code === 10) vertices.push({ point: [Number(value), 0], bulge: 0 });
    else if (code === 20 && vertices.length) vertices.at(-1).point[1] = Number(value);
    else if (code === 42 && vertices.length) vertices.at(-1).bulge = Number(value) || 0;
  }
  return vertices;
}

function ocsMatrix(values, m) {
  return num(values, 230, 1) < 0 ? multiplyMatrix(m, OCS_FLIP_X) : m;
}

function emitEllipse(target, diagnostics, values, m) {
  if (!isSimilarity(m)) {
    diagnostics.push({ code: 'DXF_ELLIPSE_TRANSFORM_UNSUPPORTED', status: 'skipped', message: 'Pominięto elipsę w bloku o nierównych skalach XY.' });
    return;
  }
  const center = [num(values, 10), num(values, 20)];
  const major = [num(values, 11), num(values, 21)];
  const majorLength = Math.hypot(major[0], major[1]);
  const ratio = num(values, 40, 1);
  if (!(majorLength > 1e-12) || !(ratio > 0) || ratio > 1 + 1e-9) throw new Error('Nieprawidłowe osie elipsy.');
  const factor = Math.sqrt(Math.abs(determinant(m)));
  const mappedCenter = applyMatrix(m, center);
  const mappedMajor = [m[0] * major[0] + m[2] * major[1], m[1] * major[0] + m[3] * major[1]];
  const rotation = radiansToDegrees(Math.atan2(mappedMajor[1], mappedMajor[0]));
  const majorRadius = majorLength * factor;
  const minorRadius = majorRadius * ratio;
  let start = radiansToDegrees(num(values, 41, 0));
  let end = radiansToDegrees(num(values, 42, Math.PI * 2));
  if (Math.abs(end - start) >= 360 - 1e-6 || Math.abs(end - start) < 1e-9) {
    target.ellipse(mappedCenter, majorRadius, minorRadius, rotation);
    return;
  }
  if (determinant(m) < 0) [start, end] = [-end, -start];
  while (end <= start) end += 360;
  target.ellipticalArc(mappedCenter, majorRadius, minorRadius, rotation, start, end);
}

function emitSpline(target, diagnostics, values, m) {
  const flags = num(values, 70, 0);
  const fit = [];
  const control = [];
  for (let index = 0; index < values.length; index += 1) {
    const [code, value] = values[index];
    if (code === 11 || code === 10) {
      const y = values.slice(index + 1).find(([group]) => group === code + 10)?.[1];
      (code === 11 ? fit : control).push([Number(value), Number(y)]);
    }
  }
  const source = fit.length >= 2 ? fit : control;
  if (source.length < 2 || source.some((coordinate) => coordinate.some((value) => !Number.isFinite(value)))) throw new Error('Spline nie ma poprawnych punktów.');
  const points = source.map((coordinate) => applyMatrix(m, coordinate));
  if ((flags & 1) && points.length > 2) points.push(points[0]);
  target.spline(points, fit.length >= 2 ? 'fit' : 'control');
  if (fit.length < 2) diagnostics.push({ code: 'DXF_SPLINE_APPROXIMATED', status: 'changed', message: 'Spline DXF z punktami kontrolnymi został odtworzony jako spline kontrolny; węzły i wagi mogą dawać nieco inny kształt.' });
}

function splitDxfSections(pairs) {
  const sections = new Map();
  for (let index = 0; index < pairs.length; index += 1) {
    if (pairs[index][0] !== 0 || pairs[index][1] !== 'SECTION' || pairs[index + 1]?.[0] !== 2) continue;
    const body = [];
    let cursor = index + 2;
    while (cursor < pairs.length && !(pairs[cursor][0] === 0 && pairs[cursor][1] === 'ENDSEC')) body.push(pairs[cursor++]);
    sections.set(pairs[index + 1][1], body);
    index = cursor;
  }
  return sections;
}

function groupEntities(body) {
  const list = [];
  let current = null;
  for (const pair of body || []) {
    if (pair[0] === 0) {
      if (current) list.push(current);
      current = { type: pair[1], pairs: [] };
    } else if (current) current.pairs.push(pair);
  }
  if (current) list.push(current);
  return list;
}

function nestPolylines(list) {
  const nested = [];
  let open = null;
  for (const entity of list) {
    if (entity.type === 'POLYLINE') { open = { ...entity, vertices: [] }; nested.push(open); } else if (entity.type === 'VERTEX' && open) open.vertices.push(entity);
    else if (entity.type === 'SEQEND') open = null;
    // Vertices outside a POLYLINE (some converters repeat them after SEQEND) carry no extra geometry.
    else if (entity.type === 'VERTEX') continue;
    else { open = null; nested.push(entity); }
  }
  return nested;
}

function dxfBlocks(sections) {
  const blocks = new Map();
  let current = null;
  for (const entity of groupEntities(sections.get('BLOCKS'))) {
    if (entity.type === 'BLOCK') {
      current = { name: first(entity.pairs, 2, ''), base: [num(entity.pairs, 10), num(entity.pairs, 20)], entities: [] };
      blocks.set(current.name, current);
    } else if (entity.type === 'ENDBLK') current = null;
    else if (current) current.entities.push(entity);
  }
  for (const block of blocks.values()) block.entities = nestPolylines(block.entities);
  return blocks;
}

function hiddenDxfLayers(sections) {
  const hidden = new Set();
  for (const entity of groupEntities(sections.get('TABLES'))) {
    if (entity.type !== 'LAYER') continue;
    if ((num(entity.pairs, 70, 0) & 1) || num(entity.pairs, 62, 1) < 0) hidden.add(first(entity.pairs, 2, ''));
  }
  return hidden;
}

const MAX_DXF_INSERT_DEPTH = 8;
const MAX_DXF_INSERT_COPIES = 2000;

function parseDxf(pairs, target, diagnostics) {
  const sections = splitDxfSections(pairs);
  const blocks = dxfBlocks(sections);
  const hiddenLayers = hiddenDxfLayers(sections);
  const skipped = new Map();
  const invalid = new Map();
  const hidden = new Map();
  let insertCopies = 0;
  const count = (map, type) => map.set(type, (map.get(type) || 0) + 1);

  const emit = (entity, m, depth) => {
    const values = entity.pairs;
    if (hiddenLayers.has(first(values, 8, '0'))) { count(hidden, entity.type); return; }
    try {
      if (entity.type === 'LINE') target.line(applyMatrix(m, [num(values, 10), num(values, 20)]), applyMatrix(m, [num(values, 11), num(values, 21)]));
      else if (entity.type === 'CIRCLE') emitCircle(target, diagnostics, [num(values, 10), num(values, 20)], num(values, 40), ocsMatrix(values, m));
      else if (entity.type === 'ARC') emitArc(target, diagnostics, [num(values, 10), num(values, 20)], num(values, 40), num(values, 50), num(values, 51), ocsMatrix(values, m));
      else if (entity.type === 'LWPOLYLINE') emitPolyline(target, diagnostics, lwPolylineVertices(values), Boolean(num(values, 70, 0) & 1), ocsMatrix(values, m));
      else if (entity.type === 'POLYLINE') {
        const flags = num(values, 70, 0);
        if (flags & (8 | 16 | 32 | 64)) { count(skipped, 'POLYLINE 3D/siatka'); return; }
        const vertices = entity.vertices
          .filter((vertex) => !(num(vertex.pairs, 70, 0) & 16))
          .map((vertex) => ({ point: [num(vertex.pairs, 10), num(vertex.pairs, 20)], bulge: num(vertex.pairs, 42, 0) }));
        emitPolyline(target, diagnostics, vertices, Boolean(flags & 1), ocsMatrix(values, m));
      } else if (entity.type === 'ELLIPSE') emitEllipse(target, diagnostics, values, m);
      else if (entity.type === 'SPLINE') emitSpline(target, diagnostics, values, m);
      else if (entity.type === 'INSERT') {
        const block = blocks.get(first(values, 2, ''));
        if (!block) { count(invalid, 'INSERT bez definicji bloku'); return; }
        if (depth >= MAX_DXF_INSERT_DEPTH) { count(invalid, 'INSERT zbyt głęboko zagnieżdżony'); return; }
        const columns = Math.max(1, Math.round(num(values, 70, 1)));
        const rows = Math.max(1, Math.round(num(values, 71, 1)));
        const position = [num(values, 10), num(values, 20)];
        const placementMatrix = ocsMatrix(values, m);
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            if (++insertCopies > MAX_DXF_INSERT_COPIES) { count(invalid, 'INSERT ponad limit kopii'); return; }
            const rotation = num(values, 50, 0);
            const cos = Math.cos(rotation * Math.PI / 180);
            const sin = Math.sin(rotation * Math.PI / 180);
            const dx = column * num(values, 44, 0);
            const dy = row * num(values, 45, 0);
            const origin = [position[0] + dx * cos - dy * sin, position[1] + dx * sin + dy * cos];
            const local = insertMatrix(origin, num(values, 41, 1), num(values, 42, num(values, 41, 1)), rotation, block.base);
            const blockMatrix = multiplyMatrix(placementMatrix, local);
            for (const child of block.entities) emit(child, blockMatrix, depth + 1);
          }
        }
      } else count(skipped, entity.type);
    } catch (error) {
      count(invalid, `${entity.type}: ${error.message}`);
    }
  };

  for (const entity of nestPolylines(groupEntities(sections.get('ENTITIES')))) emit(entity, IDENTITY, 0);
  for (const [type, total] of skipped) diagnostics.push({ code: 'DXF_ENTITY_UNSUPPORTED', status: 'skipped', message: `Pominięto nieobsługiwane encje DXF typu ${type}: ${total}.` });
  for (const [reason, total] of invalid) diagnostics.push({ code: 'DXF_ENTITY_INVALID', status: 'skipped', message: `Pominięto uszkodzone encje DXF (${reason}): ${total}.` });
  for (const [type, total] of hidden) diagnostics.push({ code: 'DXF_LAYER_HIDDEN', status: 'skipped', message: `Pominięto encje ${type} z wyłączonych lub zamrożonych warstw: ${total}.` });
}

function repairReport(diagnostics, curveCount, profileCount) {
  const entries = diagnostics.map((entry, index) => ({
    id: `import-${index + 1}`,
    status: entry.status || (String(entry.code || '').includes('UNSUPPORTED') ? 'skipped' : 'warning'),
    code: entry.code || 'IMPORT_DIAGNOSTIC',
    message: entry.message || 'Import wymaga sprawdzenia.',
  }));
  return {
    imported: curveCount,
    profiles: profileCount,
    changed: entries.filter((entry) => entry.status === 'changed').length,
    skipped: entries.filter((entry) => entry.status === 'skipped').length,
    warnings: entries.filter((entry) => entry.status === 'warning').length,
    entries,
  };
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
  if (/^AutoCAD Binary DXF/.test(text)) throw new Error('Binarny plik DXF nie jest obsługiwany. Zapisz go w CAD jako tekstowy DXF albo DWG.');
  const inspected = inspectSketchImport(text, format);
  const automatic = options.sourceUnit === 'auto' || !options.sourceUnit;
  const sourceUnit = automatic ? inspected.detectedUnit : options.sourceUnit;
  const scale = automatic ? inspected.autoScale : SKETCH_IMPORT_UNITS[sourceUnit];
  if (!scale) throw new Error('Nieobsługiwana jednostka importu szkicu.');
  const diagnostics = [];
  const target = builder(scale, inspected.format === 'svg', diagnostics);
  if (inspected.format === 'svg') parseSvg(text, target, diagnostics);
  else parseDxf(dxfPairs(text), target, diagnostics);
  const curves = target.entities.filter((entity) => entity.type !== 'point');
  if (!curves.length) throw new Error('Plik nie zawiera obsługiwanej geometrii szkicu.');
  const sketch = { entities: target.entities, profiles: [], constraints: [], dimensions: [] };
  const topology = refreshDetectedSketchProfiles(sketch);
  const combinedDiagnostics = [...diagnostics, ...(topology.diagnostics || []).map((entry) => ({ ...entry, status: entry.status || 'warning' }))];
  return {
    format: inspected.format,
    detectedUnit: inspected.detectedUnit,
    sourceUnit,
    scale,
    entities: sketch.entities,
    profiles: sketch.profiles,
    diagnostics: combinedDiagnostics,
    repairReport: repairReport(combinedDiagnostics, curves.length, sketch.profiles.length),
    curveCount: curves.length,
  };
}
