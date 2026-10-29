// Pure document edits behind the sketch tools. Each function mutates the document
// it receives (a draft clone from useDocumentHistory) and throws a readable error.
import { createSketchConstraint, createSketchLine, createSketchPoint, addDrivingSketchDimension, translateSketchSelection } from '../cad-core/sketch-model.js';
import { arcThroughThreePoints, circleCenterRadius, rectangleTwoPoints } from '../cad-core/sketch-primitives.js';
import { refreshDetectedSketchProfiles } from '../cad-core/sketch-topology.js';
import { addAutomaticConstraintsForLine } from '../cad-core/sketch-constraint-suggestions.js';
import { applySketchConstraintSolution, solveSketchConstraints, SKETCH_SOLVER_STATUS } from '../cad-core/sketch-solver.js';
import { evaluateExpression, resolveParameters } from '../cad-core/expressions.js';

const POINT_MERGE_TOLERANCE = 1e-4;

export function findSketch(document, sketchId) {
  const sketch = document.sketches.find((item) => item.id === sketchId);
  if (!sketch) throw new Error('Nie znaleziono aktywnego szkicu.');
  return sketch;
}

function parameterValues(document) {
  const resolved = resolveParameters(document.parameters);
  if (!resolved.valid) throw new Error('Parametry projektu zawierają błędy.');
  return resolved.values;
}

export function pointCoordinates(point, values) {
  return [evaluateExpression(point.geometry.x, values), evaluateExpression(point.geometry.y, values)];
}

// Reuse an existing point at the click position so touching lines share one
// vertex and close profiles without extra coincident constraints.
function pointAt(sketch, [x, y], values) {
  return sketch.entities.find((entity) => {
    if (entity.type !== 'point' || entity.role === 'construction') return false;
    const [px, py] = pointCoordinates(entity, values);
    return Math.hypot(px - x, py - y) <= POINT_MERGE_TOLERANCE;
  }) || null;
}

function solveOrThrow(sketch, parameters) {
  const solution = solveSketchConstraints(sketch, parameters);
  if (!solution.converged || !solution.solved || solution.status === SKETCH_SOLVER_STATUS.CONFLICT) {
    throw new Error(solution.diagnostics?.[0]?.message || 'Nie da się tego ustawić — więzy się wykluczają.');
  }
  applySketchConstraintSolution(sketch, solution);
}

export function addLine(document, sketchId, start, end) {
  if (Math.hypot(end[0] - start[0], end[1] - start[1]) <= 1e-7) throw new Error('Koniec linii musi różnić się od początku.');
  const sketch = findSketch(document, sketchId);
  const values = parameterValues(document);
  const startPoint = pointAt(sketch, start, values) || createSketchPoint({ x: start[0].toFixed(3), y: start[1].toFixed(3) });
  const endPoint = pointAt(sketch, end, values) || createSketchPoint({ x: end[0].toFixed(3), y: end[1].toFixed(3) });
  if (startPoint.id === endPoint.id) throw new Error('Koniec linii musi różnić się od początku.');
  for (const point of [startPoint, endPoint]) if (!sketch.entities.includes(point)) sketch.entities.push(point);
  const line = createSketchLine({ startPointId: startPoint.id, endPointId: endPoint.id });
  sketch.entities.push(line);
  addAutomaticConstraintsForLine(sketch, line.id, document.parameters);
  refreshDetectedSketchProfiles(sketch, document.parameters);
  return line;
}

export function addShape(document, sketchId, type, points) {
  const sketch = findSketch(document, sketchId);
  let shape;
  if (type === 'rectangle') shape = rectangleTwoPoints(points[0], points[1]);
  else if (type === 'circle') {
    const radius = Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]);
    if (radius <= 1e-6) throw new Error('Promień okręgu musi być większy od zera.');
    shape = circleCenterRadius(points[0], radius);
  } else if (type === 'arc') shape = arcThroughThreePoints(points[0], points[2], points[1]);
  else throw new Error(`Nieznana figura: ${type}.`);
  // Snap the new shape onto existing endpoints so lines and arcs form one profile.
  const values = parameterValues(document);
  const replaced = new Map();
  for (const entity of shape.entities) {
    if (entity.type !== 'point' || type === 'circle') continue;
    const existing = pointAt(sketch, pointCoordinates(entity, values), values);
    if (existing) replaced.set(entity.id, existing.id);
  }
  const centerId = type === 'arc' ? shape.curves[0].pointIds[0] : null;
  replaced.delete(centerId);
  for (const curve of shape.curves) curve.pointIds = curve.pointIds.map((id) => replaced.get(id) || id);
  sketch.entities.push(...shape.entities.filter((entity) => !replaced.has(entity.id)));
  if (type === 'rectangle') {
    sketch.constraints.push(...shape.curves.map((line, index) => createSketchConstraint(index % 2 ? 'vertical' : 'horizontal', [line.id], { automatic: true })));
  }
  refreshDetectedSketchProfiles(sketch, document.parameters);
  return shape.curves.map((curve) => curve.id);
}

export const CONSTRAINTS = Object.freeze([
  { id: 'horizontal', label: 'Poziomo', hint: 'Zaznacz linię albo dwa punkty.' },
  { id: 'vertical', label: 'Pionowo', hint: 'Zaznacz linię albo dwa punkty.' },
  { id: 'coincident', label: 'Połącz punkty', hint: 'Zaznacz dwa punkty.' },
  { id: 'parallel', label: 'Równolegle', hint: 'Zaznacz dwie linie.' },
  { id: 'perpendicular', label: 'Prostopadle', hint: 'Zaznacz dwie linie.' },
  { id: 'equal', label: 'Równe', hint: 'Zaznacz dwie linie albo dwa okręgi.' },
  { id: 'tangent', label: 'Styczne', hint: 'Zaznacz linię i okrąg.' },
  { id: 'fixed', label: 'Zablokuj', hint: 'Zaznacz geometrię do zablokowania.' },
]);

function countTypes(entities, type) {
  return entities.filter((entity) => entity.type === type).length;
}

export function constraintAvailable(id, entities) {
  const count = entities.length;
  if (id === 'horizontal' || id === 'vertical') return (count === 1 && countTypes(entities, 'line') === 1) || (count === 2 && countTypes(entities, 'point') === 2);
  if (id === 'coincident') return count === 2 && countTypes(entities, 'point') === 2;
  if (id === 'parallel' || id === 'perpendicular') return count === 2 && countTypes(entities, 'line') === 2;
  if (id === 'equal') return count === 2 && (countTypes(entities, 'line') === 2 || countTypes(entities, 'circle') === 2);
  if (id === 'tangent') return count === 2 && countTypes(entities, 'line') === 1 && (countTypes(entities, 'circle') === 1 || countTypes(entities, 'arc') === 1);
  if (id === 'fixed') return count > 0;
  return false;
}

function lineAngle(sketch, line, values) {
  const [start, end] = line.pointIds.map((id) => pointCoordinates(sketch.entities.find((entity) => entity.id === id), values));
  return Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
}

// Parallel and perpendicular are angle constraints; the target picks the nearest
// equivalent angle so the second line does not flip around.
function angleTarget(sketch, lineIds, base, values) {
  const [first, second] = lineIds.map((id) => sketch.entities.find((entity) => entity.id === id));
  const current = lineAngle(sketch, second, values) - lineAngle(sketch, first, values);
  const options = base === 0 ? [0, 180, -180] : [90, -90, 270, -270];
  return options.reduce((best, option) => (Math.abs(option - current) < Math.abs(best - current) ? option : best));
}

export function addConstraint(document, sketchId, type, entityIds) {
  const sketch = findSketch(document, sketchId);
  const values = parameterValues(document);
  const constraint = type === 'parallel' || type === 'perpendicular'
    ? createSketchConstraint('angle', entityIds, { value: angleTarget(sketch, entityIds, type === 'parallel' ? 0 : 90, values), driving: true })
    : createSketchConstraint(type, entityIds);
  sketch.constraints.push(constraint);
  solveOrThrow(sketch, document.parameters);
  refreshDetectedSketchProfiles(sketch, document.parameters);
  return constraint;
}

// Picks the dimension that matches the selection the way Fusion does: a line gets its
// length, two points their distance, a circle its diameter, an arc its radius.
export function dimensionForSelection(document, sketchId, entityIds) {
  const sketch = findSketch(document, sketchId);
  const values = parameterValues(document);
  const entities = entityIds.map((id) => sketch.entities.find((entity) => entity.id === id)).filter(Boolean);
  const point = (id) => pointCoordinates(sketch.entities.find((entity) => entity.id === id), values);
  const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (entities.length === 1 && entities[0].type === 'line') {
    return { type: 'aligned', entityIds, value: distance(point(entities[0].pointIds[0]), point(entities[0].pointIds[1])), label: 'Długość' };
  }
  if (entities.length === 2 && entities.every((entity) => entity.type === 'point')) {
    return { type: 'aligned', entityIds, value: distance(point(entities[0].id), point(entities[1].id)), label: 'Odległość' };
  }
  if (entities.length === 1 && entities[0].type === 'circle') {
    return { type: 'diameter', entityIds, value: evaluateExpression(entities[0].geometry.radius, values) * 2, label: 'Średnica' };
  }
  if (entities.length === 1 && entities[0].type === 'arc') {
    const [center, start] = entities[0].pointIds.map(point);
    return { type: 'radius', entityIds, value: distance(center, start), label: 'Promień' };
  }
  if (entities.length === 2 && entities.every((entity) => entity.type === 'line')) {
    const angle = Math.abs(lineAngle(sketch, entities[1], values) - lineAngle(sketch, entities[0], values)) % 180;
    return { type: 'angle', entityIds, value: angle, label: 'Kąt' };
  }
  return null;
}

export function addDimension(document, sketchId, dimension, expression) {
  const sketch = findSketch(document, sketchId);
  const created = addDrivingSketchDimension(sketch, dimension.type, dimension.entityIds, { expression: String(expression) });
  solveOrThrow(sketch, document.parameters);
  refreshDetectedSketchProfiles(sketch, document.parameters);
  return created.constraint;
}

export function setConstraintValue(document, sketchId, constraintId, value) {
  const sketch = findSketch(document, sketchId);
  const constraint = sketch.constraints.find((item) => item.id === constraintId);
  if (!constraint) throw new Error('Nie znaleziono wymiaru.');
  constraint.value = String(value);
  for (const dimension of sketch.dimensions || []) {
    if (dimension.constraintId === constraintId) dimension.expression = String(value);
  }
  solveOrThrow(sketch, document.parameters);
  refreshDetectedSketchProfiles(sketch, document.parameters);
}

export function moveEntities(document, sketchId, entityIds, dx, dy) {
  const sketch = findSketch(document, sketchId);
  translateSketchSelection(sketch, entityIds, { dx, dy }, document.parameters);
  refreshDetectedSketchProfiles(sketch, document.parameters);
}

// Runs an edit on a throwaway copy first so a failing solver never leaves a half-applied
// change in undo history.
export function tryEdit(document, edit) {
  const checked = structuredClone(document);
  return edit(checked);
}
