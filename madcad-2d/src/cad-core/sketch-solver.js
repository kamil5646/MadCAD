import { evaluateExpression, resolveParameters } from './expressions.js';
import { GEOMETRY_POLICY } from './geometry-policy.js';

export const SKETCH_SOLVER_STATUS = Object.freeze({
  UNDER_CONSTRAINED: 'under-constrained',
  FULLY_CONSTRAINED: 'fully-constrained',
  CONFLICT: 'conflict',
  OVER_CONSTRAINED: 'over-constrained',
});

export const SUPPORTED_SKETCH_CONSTRAINTS = Object.freeze([
  'fixed',
  'coincident',
  'horizontal',
  'vertical',
  'distance',
]);

function parameterValues(parameters) {
  if (!Array.isArray(parameters)) return parameters || {};
  const result = resolveParameters(parameters);
  if (!result.valid) throw new Error(Object.values(result.errors).join(' '));
  return result.values;
}

function coordinate(point, axis, values) {
  return evaluateExpression(point.geometry[axis], values);
}

function matrixRank(matrix, tolerance = 1e-9) {
  if (!matrix.length || !matrix[0]?.length) return 0;
  const work = matrix.map((row) => [...row]);
  let rank = 0;
  for (let column = 0; column < work[0].length && rank < work.length; column += 1) {
    let pivot = rank;
    for (let row = rank + 1; row < work.length; row += 1) {
      if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    }
    if (Math.abs(work[pivot][column]) <= tolerance) continue;
    [work[rank], work[pivot]] = [work[pivot], work[rank]];
    const divisor = work[rank][column];
    for (let index = column; index < work[rank].length; index += 1) work[rank][index] /= divisor;
    for (let row = 0; row < work.length; row += 1) {
      if (row === rank) continue;
      const factor = work[row][column];
      if (Math.abs(factor) <= tolerance) continue;
      for (let index = column; index < work[row].length; index += 1) work[row][index] -= factor * work[rank][index];
    }
    rank += 1;
  }
  return rank;
}

function referencedPoints(entityIds, entityMap) {
  const points = [];
  for (const entityId of entityIds || []) {
    const entity = entityMap.get(entityId);
    if (entity?.type === 'point') points.push(entity);
    else for (const pointId of entity?.pointIds || []) {
      const point = entityMap.get(pointId);
      if (point?.type === 'point') points.push(point);
    }
  }
  return [...new Map(points.map((point) => [point.id, point])).values()];
}

function rowForConstraint(constraint, entityMap, variableColumns, values) {
  const points = referencedPoints(constraint.entityIds, entityMap);
  const makeRow = () => Array(variableColumns.size).fill(0);
  const coefficient = (row, pointId, axis, value) => {
    const column = variableColumns.get(`${pointId}:${axis}`);
    if (column !== undefined) row[column] += value;
  };
  const pointValue = (point, axis) => coordinate(point, axis, values);

  if (constraint.type === 'horizontal' || constraint.type === 'vertical') {
    if (points.length !== 2) return { supported: true, error: 'Wiązanie wymaga dokładnie dwóch punktów.' };
    const axis = constraint.type === 'horizontal' ? 'y' : 'x';
    const row = makeRow();
    coefficient(row, points[0].id, axis, -1);
    coefficient(row, points[1].id, axis, 1);
    return { supported: true, rows: [{ row, residual: pointValue(points[1], axis) - pointValue(points[0], axis) }] };
  }

  if (constraint.type === 'coincident') {
    if (points.length !== 2) return { supported: true, error: 'Wiązanie coincident wymaga dokładnie dwóch punktów.' };
    return {
      supported: true,
      rows: ['x', 'y'].map((axis) => {
        const row = makeRow();
        coefficient(row, points[0].id, axis, -1);
        coefficient(row, points[1].id, axis, 1);
        return { row, residual: pointValue(points[1], axis) - pointValue(points[0], axis) };
      }),
    };
  }

  if (constraint.type === 'distance') {
    if (points.length !== 2) return { supported: true, error: 'Wiązanie distance wymaga dokładnie dwóch punktów.' };
    const target = evaluateExpression(constraint.value, values);
    if (!(target > GEOMETRY_POLICY.linearTolerance)) return { supported: true, error: 'Wiązanie distance wymaga dodatniej wartości.' };
    const dx = pointValue(points[1], 'x') - pointValue(points[0], 'x');
    const dy = pointValue(points[1], 'y') - pointValue(points[0], 'y');
    const length = Math.hypot(dx, dy);
    const direction = length > GEOMETRY_POLICY.linearTolerance ? [dx / length, dy / length] : [1, 0];
    const row = makeRow();
    coefficient(row, points[0].id, 'x', -direction[0]);
    coefficient(row, points[0].id, 'y', -direction[1]);
    coefficient(row, points[1].id, 'x', direction[0]);
    coefficient(row, points[1].id, 'y', direction[1]);
    return { supported: true, rows: [{ row, residual: length - target }] };
  }

  if (constraint.type === 'fixed') return { supported: true, rows: [] };
  return { supported: false, rows: [] };
}

export function analyzeSketchConstraints(sketch, parameters = []) {
  const values = parameterValues(parameters);
  const entities = sketch?.entities || [];
  const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
  const explicitlyFixed = new Set();
  for (const entity of entities) {
    if (!entity.fixed && entity.role !== 'projected') continue;
    if (entity.type === 'point') explicitlyFixed.add(entity.id);
    else for (const pointId of entity.pointIds || []) explicitlyFixed.add(pointId);
  }
  for (const constraint of sketch?.constraints || []) {
    if (constraint.type !== 'fixed') continue;
    referencedPoints(constraint.entityIds, entityMap).forEach((point) => explicitlyFixed.add(point.id));
  }

  const points = entities.filter((entity) => entity.type === 'point');
  const variableColumns = new Map();
  for (const point of points) {
    if (explicitlyFixed.has(point.id)) continue;
    variableColumns.set(`${point.id}:x`, variableColumns.size);
    variableColumns.set(`${point.id}:y`, variableColumns.size);
  }

  const equations = [];
  const constraintStates = [];
  const diagnostics = [];
  const residualTolerance = GEOMETRY_POLICY.linearTolerance;
  for (const constraint of sketch?.constraints || []) {
    const result = rowForConstraint(constraint, entityMap, variableColumns, values);
    if (!result.supported) {
      constraintStates.push({ id: constraint.id, type: constraint.type, supported: false, satisfied: false, residual: null });
      diagnostics.push({ code: 'UNSUPPORTED_CONSTRAINT', severity: 'warning', constraintIds: [constraint.id], message: `Solver MVP nie obsługuje jeszcze więzu ${constraint.type}.` });
      continue;
    }
    if (result.error) {
      constraintStates.push({ id: constraint.id, type: constraint.type, supported: true, satisfied: false, residual: null });
      diagnostics.push({ code: 'INVALID_CONSTRAINT', severity: 'error', constraintIds: [constraint.id], message: result.error });
      continue;
    }
    const residual = result.rows?.length ? Math.max(...result.rows.map((entry) => Math.abs(entry.residual))) : 0;
    constraintStates.push({ id: constraint.id, type: constraint.type, supported: true, satisfied: residual <= residualTolerance, residual });
    (result.rows || []).forEach((entry) => equations.push({ ...entry, constraintId: constraint.id }));
  }

  const activeEquations = equations.filter((equation) => equation.row.some((value) => Math.abs(value) > 1e-12));
  const jacobian = activeEquations.map((equation) => equation.row);
  const rank = matrixRank(jacobian);
  const degreesOfFreedom = Math.max(0, variableColumns.size - rank);
  const immovableConflicts = equations.filter((equation) => equation.row.every((value) => Math.abs(value) <= 1e-12) && Math.abs(equation.residual) > residualTolerance);
  if (immovableConflicts.length) diagnostics.push({
    code: 'CONFLICTING_FIXED_GEOMETRY',
    severity: 'error',
    constraintIds: [...new Set(immovableConflicts.map((entry) => entry.constraintId))],
    message: 'Wiązania wymagają przesunięcia geometrii, która jest unieruchomiona.',
  });
  const redundantEquationCount = Math.max(0, activeEquations.length - rank);
  if (redundantEquationCount) diagnostics.push({
    code: 'REDUNDANT_CONSTRAINTS',
    severity: 'error',
    constraintIds: [...new Set(activeEquations.map((entry) => entry.constraintId))],
    message: `Układ zawiera ${redundantEquationCount} nadmiarowych równań więzów.`,
  });

  let status = SKETCH_SOLVER_STATUS.UNDER_CONSTRAINED;
  if (immovableConflicts.length || diagnostics.some((entry) => entry.code === 'INVALID_CONSTRAINT')) status = SKETCH_SOLVER_STATUS.CONFLICT;
  else if (redundantEquationCount) status = SKETCH_SOLVER_STATUS.OVER_CONSTRAINED;
  else if (degreesOfFreedom === 0) status = SKETCH_SOLVER_STATUS.FULLY_CONSTRAINED;

  return {
    status,
    solved: constraintStates.filter((entry) => entry.supported).every((entry) => entry.satisfied),
    degreesOfFreedom,
    variableCount: variableColumns.size,
    equationCount: equations.length,
    rank,
    points: points.map((point) => ({
      id: point.id,
      fixed: explicitlyFixed.has(point.id),
      variables: explicitlyFixed.has(point.id) ? [] : ['x', 'y'],
    })),
    constraints: constraintStates,
    diagnostics,
  };
}

export function solveSketchConstraints(sketch, parameters = [], options = {}) {
  const values = parameterValues(parameters);
  const maximumIterations = Math.max(1, Number(options.maximumIterations) || 32);
  const tolerance = Number(options.tolerance) || GEOMETRY_POLICY.linearTolerance;
  const entities = sketch?.entities || [];
  const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
  const fixedPointIds = new Set();
  for (const entity of entities) {
    if (!entity.fixed && entity.role !== 'projected') continue;
    if (entity.type === 'point') fixedPointIds.add(entity.id);
    else for (const pointId of entity.pointIds || []) fixedPointIds.add(pointId);
  }
  for (const constraint of sketch?.constraints || []) {
    if (constraint.type !== 'fixed') continue;
    referencedPoints(constraint.entityIds, entityMap).forEach((point) => fixedPointIds.add(point.id));
  }
  const coordinates = new Map(entities.filter((entity) => entity.type === 'point').map((point) => [point.id, {
    x: coordinate(point, 'x', values),
    y: coordinate(point, 'y', values),
  }]));

  const initialAnalysis = analyzeSketchConstraints(sketch, parameters);
  if (initialAnalysis.status === SKETCH_SOLVER_STATUS.CONFLICT) {
    return { ...initialAnalysis, converged: false, iterations: 0, updates: [] };
  }

  const moveAxisTogether = (first, second, axis) => {
    const firstCoordinate = coordinates.get(first.id);
    const secondCoordinate = coordinates.get(second.id);
    const firstFixed = fixedPointIds.has(first.id);
    const secondFixed = fixedPointIds.has(second.id);
    if (firstFixed && secondFixed) return 0;
    const target = firstFixed ? firstCoordinate[axis] : secondFixed ? secondCoordinate[axis] : (firstCoordinate[axis] + secondCoordinate[axis]) / 2;
    let delta = 0;
    if (!firstFixed) {
      delta = Math.max(delta, Math.abs(firstCoordinate[axis] - target));
      firstCoordinate[axis] = target;
    }
    if (!secondFixed) {
      delta = Math.max(delta, Math.abs(secondCoordinate[axis] - target));
      secondCoordinate[axis] = target;
    }
    return delta;
  };
  const setDistance = (first, second, target) => {
    const firstCoordinate = coordinates.get(first.id);
    const secondCoordinate = coordinates.get(second.id);
    const firstFixed = fixedPointIds.has(first.id);
    const secondFixed = fixedPointIds.has(second.id);
    if (firstFixed && secondFixed) return 0;
    const dx = secondCoordinate.x - firstCoordinate.x;
    const dy = secondCoordinate.y - firstCoordinate.y;
    const length = Math.hypot(dx, dy);
    const direction = length > tolerance ? [dx / length, dy / length] : [1, 0];
    const correction = target - length;
    const firstShare = firstFixed ? 0 : secondFixed ? 1 : 0.5;
    const secondShare = secondFixed ? 0 : firstFixed ? 1 : 0.5;
    if (!firstFixed) {
      firstCoordinate.x -= direction[0] * correction * firstShare;
      firstCoordinate.y -= direction[1] * correction * firstShare;
    }
    if (!secondFixed) {
      secondCoordinate.x += direction[0] * correction * secondShare;
      secondCoordinate.y += direction[1] * correction * secondShare;
    }
    return Math.abs(correction) * Math.max(firstShare, secondShare);
  };

  let converged = false;
  let iterations = 0;
  for (iterations = 1; iterations <= maximumIterations; iterations += 1) {
    let maximumDelta = 0;
    for (const constraint of sketch?.constraints || []) {
      if (!['coincident', 'horizontal', 'vertical', 'distance'].includes(constraint.type)) continue;
      const points = referencedPoints(constraint.entityIds, entityMap);
      if (points.length !== 2) continue;
      if (constraint.type === 'horizontal' || constraint.type === 'coincident') maximumDelta = Math.max(maximumDelta, moveAxisTogether(points[0], points[1], 'y'));
      if (constraint.type === 'vertical' || constraint.type === 'coincident') maximumDelta = Math.max(maximumDelta, moveAxisTogether(points[0], points[1], 'x'));
      if (constraint.type === 'distance') maximumDelta = Math.max(maximumDelta, setDistance(points[0], points[1], evaluateExpression(constraint.value, values)));
    }
    if (maximumDelta <= tolerance) {
      converged = true;
      break;
    }
  }

  const updates = [...coordinates.entries()].map(([pointId, point]) => ({ pointId, x: point.x, y: point.y }));
  const solvedSketch = {
    ...sketch,
    entities: entities.map((entity) => entity.type === 'point' && coordinates.has(entity.id)
      ? { ...entity, geometry: { ...entity.geometry, x: String(coordinates.get(entity.id).x), y: String(coordinates.get(entity.id).y) } }
      : entity),
  };
  const analysis = analyzeSketchConstraints(solvedSketch, parameters);
  return { ...analysis, converged, iterations: Math.min(iterations, maximumIterations), updates };
}

export function applySketchConstraintSolution(sketch, solution) {
  if (!solution?.converged || solution.status === SKETCH_SOLVER_STATUS.CONFLICT) throw new Error('Nie można zastosować nierozwiązanego albo konfliktowego wyniku solvera.');
  const updates = new Map((solution.updates || []).map((entry) => [entry.pointId, entry]));
  for (const entity of sketch.entities || []) {
    const update = updates.get(entity.id);
    if (entity.type !== 'point' || !update) continue;
    entity.geometry = { ...entity.geometry, x: String(update.x), y: String(update.y) };
  }
  return sketch;
}
