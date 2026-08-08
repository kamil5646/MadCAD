import { createId } from './ids.js';
import { evaluateExpression, resolveParameters } from './expressions.js';
import { resolveConstructionAxis } from './construction-axes.js';
import { resolveConstructionPlane } from './construction-planes.js';

function coordinates(values, label = 'Punkt') {
  if (!Array.isArray(values) || values.length !== 3) throw new Error(`${label} wymaga trzech współrzędnych.`);
  return values.map(String);
}

function basePoint(pointType, name, visible) {
  return { id: createId('construction-point'), kind: 'construction-point', pointType, name, visible: Boolean(visible) };
}

export function createVertexPoint({ name = 'Punkt na wierzchołku', position = [0, 0, 0], topologyId = null, bodyId = null, visible = true } = {}) {
  return { ...basePoint('vertex', name, visible), position: coordinates(position), topologyId, bodyId, topologyKind: 'vertex' };
}

export function createCenterPoint({ name = 'Punkt środka', position = [0, 0, 0], topologyId = null, bodyId = null, topologyKind = 'face', visible = true } = {}) {
  if (!['face', 'edge'].includes(topologyKind)) throw new Error('Środek można powiązać ze ścianą albo krawędzią.');
  return { ...basePoint('center', name, visible), position: coordinates(position), topologyId, bodyId, topologyKind };
}

export function createIntersectionPoint({ name = 'Punkt przecięcia', axisId = '', planeId = '', visible = true } = {}) {
  if (!axisId || !planeId) throw new Error('Punkt przecięcia wymaga osi i płaszczyzny.');
  return { ...basePoint('intersection', name, visible), axisId, planeId, visible: Boolean(visible) };
}

function topologyPosition(point, bodies) {
  if (!point.topologyId || !point.bodyId || !bodies?.length) return null;
  const body = bodies.find((candidate) => candidate.id === point.bodyId);
  const key = point.topologyKind === 'vertex' ? 'vertices' : point.topologyKind === 'edge' ? 'edges' : 'faces';
  const record = body?.topology?.[key]?.find((candidate) => candidate.id === point.topologyId);
  if (!record) throw new Error('Utracono źródłową topologię punktu konstrukcyjnego.');
  if (point.topologyKind === 'vertex') return record.descriptor?.point;
  if (point.topologyKind === 'edge' && record.descriptor?.endpoints?.length === 2) {
    return record.descriptor.endpoints[0].map((value, axis) => (value + record.descriptor.endpoints[1][axis]) / 2);
  }
  return record.descriptor?.axisOrigin || record.descriptor?.center;
}

export function resolveConstructionPoint(point, references = [], parameters = [], bodies = []) {
  if (point?.kind !== 'construction-point') throw new Error('Nieobsługiwany typ punktu konstrukcyjnego.');
  const resolved = Array.isArray(parameters) ? resolveParameters(parameters) : { valid: true, values: parameters, errors: {} };
  if (!resolved.valid) throw new Error(Object.values(resolved.errors)[0] || 'Nie udało się rozwiązać parametrów punktu.');
  if (point.pointType === 'intersection') {
    const axis = references.find((reference) => reference.id === point.axisId && reference.kind === 'construction-axis');
    const plane = references.find((reference) => reference.id === point.planeId && reference.kind === 'construction-plane');
    if (!axis || !plane) throw new Error('Nie znaleziono osi albo płaszczyzny punktu przecięcia.');
    const resolvedAxis = resolveConstructionAxis(axis, references, resolved.values, bodies);
    const resolvedPlane = resolveConstructionPlane(plane, resolved.values);
    const denominator = resolvedPlane.normal.reduce((sum, value, index) => sum + (value * resolvedAxis.direction[index]), 0);
    if (Math.abs(denominator) <= 1e-12) throw new Error('Oś jest równoległa do płaszczyzny i nie wyznacza jednego punktu.');
    const distance = resolvedPlane.normal.reduce((sum, value, index) => sum + (value * (resolvedPlane.origin[index] - resolvedAxis.origin[index])), 0) / denominator;
    return { ...point, position: resolvedAxis.origin.map((value, index) => value + (resolvedAxis.direction[index] * distance)) };
  }
  if (!['vertex', 'center'].includes(point.pointType)) throw new Error(`Nieobsługiwany wariant punktu: ${point.pointType ?? ''}.`);
  const source = topologyPosition(point, bodies) || point.position;
  if (!source) throw new Error('Źródło punktu nie zawiera położenia.');
  return { ...point, position: source.map((value) => evaluateExpression(value, resolved.values)) };
}

export function resolveConstructionPoints(references, parameters = [], bodies = []) {
  return (references || []).filter((reference) => reference.kind === 'construction-point').map((point) => {
    try {
      return { ...resolveConstructionPoint(point, references, parameters, bodies), status: 'ok', error: null };
    } catch (error) {
      return { ...point, status: 'error', error: error.message };
    }
  });
}
