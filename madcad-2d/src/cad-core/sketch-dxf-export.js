import { aciFromHex } from './aci-colors.js';
import { DEFAULT_LAYER_ID, BY_LAYER } from './layers.js';
import { sampleSketchEdge, sketchExportCurves } from './sketch-topology.js';

// Writes a sketch as an AutoCAD R12 ("AC1009") ASCII DXF. R12 is the most widely
// readable DXF flavour (AutoCAD, LibreCAD, laser/CNC software) and needs no handles
// or object tables. Lines, circles and arcs stay exact; ellipses, splines and conics
// are written as finely sampled polylines because R12 has no native entity for them.

const SAMPLE_DENSITY = 4;
const LINE_TYPES = Object.freeze({
  continuous: { name: 'CONTINUOUS', description: 'Solid line', pattern: [] },
  dashed: { name: 'DASHED', description: 'Dashed __ __ __', pattern: [0.5, -0.25] },
  center: { name: 'CENTER', description: 'Center ____ _ ____ _', pattern: [1.25, -0.25, 0.25, -0.25] },
  dashdot: { name: 'DASHDOT', description: 'Dash dot __ . __ .', pattern: [0.5, -0.25, 0, -0.25] },
});

const number = (value) => (Math.abs(value) < 1e-12 ? '0' : Number(value.toFixed(9)).toString());
const degrees = (radians) => ((radians * 180 / Math.PI) % 360 + 360) % 360;

export function dxfLayerName(name, fallback = '0') {
  const cleaned = String(name ?? '').replace(/[<>/\\":;?*|=`,]/g, '_').trim().slice(0, 255);
  return cleaned || fallback;
}

export const nearestAciColor = aciFromHex;

function pairs(...items) { return items.map(String).join('\n'); }

export function dxfLineTypeTable(used) {
  const records = [...used].map((id) => LINE_TYPES[id] || LINE_TYPES.continuous).map((type) => {
    const total = type.pattern.reduce((sum, item) => sum + Math.abs(item), 0);
    return pairs('0', 'LTYPE', '2', type.name, '70', '0', '3', type.description, '72', '65', '73', type.pattern.length, '40', number(total), ...type.pattern.flatMap((item) => ['49', number(item)]));
  });
  return pairs('0', 'TABLE', '2', 'LTYPE', '70', records.length) + '\n' + records.join('\n') + '\n0\nENDTAB';
}

export function sketchDxf(sketch, { parameters = [], layers = [], includeConstruction = false, unitsCode = 4 } = {}) {
  const curves = sketchExportCurves(sketch, parameters, { includeConstruction });
  if (!curves.length) throw new Error('Szkic nie zawiera geometrii do eksportu.');
  const layerById = new Map((layers || []).map((layer) => [layer.id, layer]));
  const usedLayers = new Map();
  const usedLineTypes = new Set(['continuous']);
  const skipped = { conic: 0 };
  const entities = [];
  const stats = { lines: 0, circles: 0, arcs: 0, polylines: 0 };

  const style = (entity) => {
    const layer = layerById.get(entity.layerId) || (entity.layerId && entity.layerId !== DEFAULT_LAYER_ID ? null : layerById.get(DEFAULT_LAYER_ID));
    const name = dxfLayerName(layer?.name, '0');
    if (!usedLayers.has(name)) {
      usedLayers.set(name, { name, color: nearestAciColor(layer?.color), lineType: LINE_TYPES[layer?.lineType] ? layer.lineType : 'continuous', hidden: layer ? layer.visible === false : false });
      usedLineTypes.add(usedLayers.get(name).lineType);
    }
    const attributes = ['8', name];
    if (entity.lineType && entity.lineType !== BY_LAYER && LINE_TYPES[entity.lineType]) { usedLineTypes.add(entity.lineType); attributes.push('6', LINE_TYPES[entity.lineType].name); }
    if (entity.color && entity.color !== BY_LAYER) attributes.push('62', nearestAciColor(entity.color));
    return attributes;
  };

  const polyline = (entity, points, closed) => {
    const attributes = style(entity);
    entities.push(pairs('0', 'POLYLINE', ...attributes, '66', '1', '10', '0', '20', '0', '30', '0', '70', closed ? '1' : '0'));
    for (const [x, y] of points) entities.push(pairs('0', 'VERTEX', '8', attributes[1], '10', number(x), '20', number(y), '30', '0'));
    entities.push(pairs('0', 'SEQEND', '8', attributes[1]));
    stats.polylines += 1;
  };

  for (const { entity, edge } of curves) {
    if (edge.type === 'line') {
      entities.push(pairs('0', 'LINE', ...style(entity), '10', number(edge.start[0]), '20', number(edge.start[1]), '30', '0', '11', number(edge.end[0]), '21', number(edge.end[1]), '31', '0'));
      stats.lines += 1;
    } else if (edge.type === 'circle') {
      if (!(edge.radius > 0)) continue;
      entities.push(pairs('0', 'CIRCLE', ...style(entity), '10', number(edge.center[0]), '20', number(edge.center[1]), '30', '0', '40', number(edge.radius)));
      stats.circles += 1;
    } else if (edge.type === 'arc') {
      const radius = Math.hypot(edge.start[0] - edge.center[0], edge.start[1] - edge.center[1]);
      if (!(radius > 0)) continue;
      const angleOf = (point) => degrees(Math.atan2(point[1] - edge.center[1], point[0] - edge.center[0]));
      // DXF arcs always run counter-clockwise, so a clockwise arc swaps its end points.
      const [from, to] = edge.direction === 'cw' ? [edge.end, edge.start] : [edge.start, edge.end];
      entities.push(pairs('0', 'ARC', ...style(entity), '10', number(edge.center[0]), '20', number(edge.center[1]), '30', '0', '40', number(radius), '50', number(angleOf(from)), '51', number(angleOf(to))));
      stats.arcs += 1;
    } else if (edge.type === 'ellipse') {
      polyline(entity, sampleSketchEdge(edge, SAMPLE_DENSITY).slice(0, -1), true);
    } else if (['ellipticalArc', 'spline', 'conic'].includes(edge.type)) {
      polyline(entity, sampleSketchEdge(edge, SAMPLE_DENSITY), false);
    }
  }
  if (!usedLayers.size) usedLayers.set('0', { name: '0', color: 7, lineType: 'continuous', hidden: false });
  else if (![...usedLayers.keys()].includes('0')) usedLayers.set('0', { name: '0', color: 7, lineType: 'continuous', hidden: false });

  const layerRecords = [...usedLayers.values()].map((layer) => pairs('0', 'LAYER', '2', layer.name, '70', '0', '62', layer.hidden ? -layer.color : layer.color, '6', LINE_TYPES[layer.lineType].name));
  const text = [
    pairs('0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', unitsCode, '0', 'ENDSEC'),
    pairs('0', 'SECTION', '2', 'TABLES'),
    dxfLineTypeTable(usedLineTypes),
    pairs('0', 'TABLE', '2', 'LAYER', '70', layerRecords.length),
    layerRecords.join('\n'),
    '0\nENDTAB\n0\nENDSEC',
    pairs('0', 'SECTION', '2', 'ENTITIES'),
    entities.join('\n'),
    '0\nENDSEC\n0\nEOF',
  ].join('\n') + '\n';
  return { text, stats: { ...stats, layers: usedLayers.size, skipped } };
}
