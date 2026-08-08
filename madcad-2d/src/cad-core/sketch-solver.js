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
  'distanceX',
  'distanceY',
  'angle',
  'radius',
  'diameter',
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

function equationsAreInconsistent(equations) {
  if (!equations.length) return false;
  const coefficientRank = matrixRank(equations.map((equation) => equation.row));
  const augmentedRank = matrixRank(equations.map((equation) => [...equation.row, -equation.residual]));
  return augmentedRank > coefficientRank;
}

function minimalConflictSet(equations) {
  if (!equationsAreInconsistent(equations)) return [];
  let constraintIds = [...new Set(equations.map((equation) => equation.constraintId))];
  for (const constraintId of [...constraintIds]) {
    const candidateIds = constraintIds.filter((id) => id !== constraintId);
    const candidate = equations.filter((equation) => candidateIds.includes(equation.constraintId));
    if (candidate.length && equationsAreInconsistent(candidate)) constraintIds = candidateIds;
  }
  return constraintIds;
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

function referencedEntities(entityIds, entityMap, type) {
  return (entityIds || []).map((entityId) => entityMap.get(entityId)).filter((entity) => entity?.type === type);
}

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
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

  if (constraint.type === 'distanceX' || constraint.type === 'distanceY') {
    if (points.length !== 2) return { supported: true, error: `Wiązanie ${constraint.type} wymaga dokładnie dwóch punktów.` };
    const target = evaluateExpression(constraint.value, values);
    const axis = constraint.type === 'distanceX' ? 'x' : 'y';
    const row = makeRow();
    coefficient(row, points[0].id, axis, -1);
    coefficient(row, points[1].id, axis, 1);
    return { supported: true, rows: [{ row, residual: pointValue(points[1], axis) - pointValue(points[0], axis) - target }] };
  }

  if (constraint.type === 'angle') {
    const lines = referencedEntities(constraint.entityIds, entityMap, 'line');
    if (lines.length !== 2) return { supported: true, error: 'Wiązanie angle wymaga dokładnie dwóch linii.' };
    const linePoints = lines.map((line) => line.pointIds.map((pointId) => entityMap.get(pointId)));
    if (linePoints.some((pair) => pair.length !== 2 || pair.some((point) => point?.type !== 'point'))) {
      return { supported: true, error: 'Wiązanie angle wskazuje linię bez kompletu punktów.' };
    }
    const target = evaluateExpression(constraint.value, values) * Math.PI / 180;
    const row = makeRow();
    const angles = linePoints.map(([start, end], lineIndex) => {
      const dx = pointValue(end, 'x') - pointValue(start, 'x');
      const dy = pointValue(end, 'y') - pointValue(start, 'y');
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= GEOMETRY_POLICY.linearTolerance ** 2) return null;
      const sign = lineIndex === 0 ? -1 : 1;
      coefficient(row, start.id, 'x', sign * dy / lengthSquared);
      coefficient(row, start.id, 'y', sign * -dx / lengthSquared);
      coefficient(row, end.id, 'x', sign * -dy / lengthSquared);
      coefficient(row, end.id, 'y', sign * dx / lengthSquared);
      return Math.atan2(dy, dx);
    });
    if (angles.some((angle) => angle === null)) return { supported: true, error: 'Wiązanie angle nie obsługuje linii o zerowej długości.' };
    return { supported: true, rows: [{ row, residual: normalizeAngle(angles[1] - angles[0] - target) }] };
  }

  if (constraint.type === 'radius' || constraint.type === 'diameter') {
    const circles = referencedEntities(constraint.entityIds, entityMap, 'circle');
    if (circles.length !== 1) return { supported: true, error: `Wiązanie ${constraint.type} wymaga dokładnie jednego okręgu.` };
    const target = evaluateExpression(constraint.value, values);
    if (!(target > GEOMETRY_POLICY.linearTolerance)) return { supported: true, error: `Wiązanie ${constraint.type} wymaga dodatniej wartości.` };
    const circle = circles[0];
    const multiplier = constraint.type === 'diameter' ? 2 : 1;
    const row = makeRow();
    const column = variableColumns.get(`${circle.id}:radius`);
    if (column !== undefined) row[column] = multiplier;
    const radius = evaluateExpression(circle.geometry.radius, values);
    return { supported: true, rows: [{ row, residual: radius * multiplier - target }] };
  }

  if (constraint.type === 'fixed') return { supported: true, rows: [] };
  return { supported: false, rows: [] };
}

export function analyzeSketchConstraints(sketch, parameters = []) {
  const values = parameterValues(parameters);
  const entities = sketch?.entities || [];
  const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
  const explicitlyFixed = new Set();
  const fixedEntityIds = new Set();
  for (const entity of entities) {
    if (!entity.fixed && entity.role !== 'projected') continue;
    fixedEntityIds.add(entity.id);
    if (entity.type === 'point') explicitlyFixed.add(entity.id);
    else for (const pointId of entity.pointIds || []) explicitlyFixed.add(pointId);
  }
  for (const constraint of sketch?.constraints || []) {
    if (constraint.type !== 'fixed') continue;
    (constraint.entityIds || []).forEach((entityId) => fixedEntityIds.add(entityId));
    referencedPoints(constraint.entityIds, entityMap).forEach((point) => explicitlyFixed.add(point.id));
  }

  const points = entities.filter((entity) => entity.type === 'point');
  const variableColumns = new Map();
  for (const point of points) {
    if (explicitlyFixed.has(point.id)) continue;
    variableColumns.set(`${point.id}:x`, variableColumns.size);
    variableColumns.set(`${point.id}:y`, variableColumns.size);
  }
  for (const circle of entities.filter((entity) => entity.type === 'circle')) {
    if (!fixedEntityIds.has(circle.id)) variableColumns.set(`${circle.id}:radius`, variableColumns.size);
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
  const conflictConstraintIds = minimalConflictSet(equations);
  if (conflictConstraintIds.length) diagnostics.push({
    code: 'CONFLICTING_CONSTRAINTS',
    severity: 'error',
    constraintIds: conflictConstraintIds,
    message: `Najmniejszy wykryty konflikt obejmuje ${conflictConstraintIds.length} ${conflictConstraintIds.length === 1 ? 'wiązanie' : 'wiązania'}.`,
  });
  const redundantEquationCount = Math.max(0, activeEquations.length - rank);
  if (redundantEquationCount) diagnostics.push({
    code: 'REDUNDANT_CONSTRAINTS',
    severity: 'error',
    constraintIds: [...new Set(activeEquations.map((entry) => entry.constraintId))],
    message: `Układ zawiera ${redundantEquationCount} nadmiarowych równań więzów.`,
  });

  let status = SKETCH_SOLVER_STATUS.UNDER_CONSTRAINED;
  if (conflictConstraintIds.length || immovableConflicts.length || diagnostics.some((entry) => entry.code === 'INVALID_CONSTRAINT')) status = SKETCH_SOLVER_STATUS.CONFLICT;
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
    scalars: entities.filter((entity) => entity.type === 'circle').map((circle) => ({
      entityId: circle.id,
      key: 'radius',
      fixed: fixedEntityIds.has(circle.id),
    })),
    constraints: constraintStates,
    conflictConstraintIds,
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
  const fixedEntityIds = new Set();
  for (const entity of entities) {
    if (!entity.fixed && entity.role !== 'projected') continue;
    fixedEntityIds.add(entity.id);
    if (entity.type === 'point') fixedPointIds.add(entity.id);
    else for (const pointId of entity.pointIds || []) fixedPointIds.add(pointId);
  }
  for (const constraint of sketch?.constraints || []) {
    if (constraint.type !== 'fixed') continue;
    (constraint.entityIds || []).forEach((entityId) => fixedEntityIds.add(entityId));
    referencedPoints(constraint.entityIds, entityMap).forEach((point) => fixedPointIds.add(point.id));
  }
  const coordinates = new Map(entities.filter((entity) => entity.type === 'point').map((point) => [point.id, {
    x: coordinate(point, 'x', values),
    y: coordinate(point, 'y', values),
  }]));
  const radii = new Map(entities.filter((entity) => entity.type === 'circle').map((circle) => [circle.id, evaluateExpression(circle.geometry.radius, values)]));

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
  const setAxisDistance = (first, second, axis, target) => {
    const firstCoordinate = coordinates.get(first.id);
    const secondCoordinate = coordinates.get(second.id);
    const firstFixed = fixedPointIds.has(first.id);
    const secondFixed = fixedPointIds.has(second.id);
    if (firstFixed && secondFixed) return 0;
    const correction = target - (secondCoordinate[axis] - firstCoordinate[axis]);
    const firstShare = firstFixed ? 0 : secondFixed ? 1 : 0.5;
    const secondShare = secondFixed ? 0 : firstFixed ? 1 : 0.5;
    if (!firstFixed) firstCoordinate[axis] -= correction * firstShare;
    if (!secondFixed) secondCoordinate[axis] += correction * secondShare;
    return Math.abs(correction) * Math.max(firstShare, secondShare);
  };
  const lineAngle = (line) => {
    const start = coordinates.get(line.pointIds[0]);
    const end = coordinates.get(line.pointIds[1]);
    return Math.atan2(end.y - start.y, end.x - start.x);
  };
  const setLineAngle = (line, targetAngle) => {
    const [startId, endId] = line.pointIds;
    const start = coordinates.get(startId);
    const end = coordinates.get(endId);
    const startFixed = fixedPointIds.has(startId);
    const endFixed = fixedPointIds.has(endId);
    if (!start || !end || (startFixed && endFixed)) return 0;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length <= tolerance) return 0;
    const dx = Math.cos(targetAngle) * length;
    const dy = Math.sin(targetAngle) * length;
    if (startFixed) {
      const delta = Math.hypot(end.x - (start.x + dx), end.y - (start.y + dy));
      end.x = start.x + dx;
      end.y = start.y + dy;
      return delta;
    }
    if (endFixed) {
      const delta = Math.hypot(start.x - (end.x - dx), start.y - (end.y - dy));
      start.x = end.x - dx;
      start.y = end.y - dy;
      return delta;
    }
    const midpoint = [(start.x + end.x) / 2, (start.y + end.y) / 2];
    const nextStart = [midpoint[0] - dx / 2, midpoint[1] - dy / 2];
    const nextEnd = [midpoint[0] + dx / 2, midpoint[1] + dy / 2];
    const delta = Math.max(Math.hypot(start.x - nextStart[0], start.y - nextStart[1]), Math.hypot(end.x - nextEnd[0], end.y - nextEnd[1]));
    [start.x, start.y] = nextStart;
    [end.x, end.y] = nextEnd;
    return delta;
  };

  let converged = false;
  let iterations = 0;
  for (iterations = 1; iterations <= maximumIterations; iterations += 1) {
    let maximumDelta = 0;
    for (const constraint of sketch?.constraints || []) {
      if (constraint.type === 'angle') {
        const lines = referencedEntities(constraint.entityIds, entityMap, 'line');
        if (lines.length !== 2) continue;
        const target = evaluateExpression(constraint.value, values) * Math.PI / 180;
        const secondMovable = lines[1].pointIds.some((pointId) => !fixedPointIds.has(pointId));
        maximumDelta = Math.max(maximumDelta, secondMovable
          ? setLineAngle(lines[1], lineAngle(lines[0]) + target)
          : setLineAngle(lines[0], lineAngle(lines[1]) - target));
        continue;
      }
      if (constraint.type === 'radius' || constraint.type === 'diameter') {
        const circles = referencedEntities(constraint.entityIds, entityMap, 'circle');
        if (circles.length !== 1 || fixedEntityIds.has(circles[0].id)) continue;
        const target = evaluateExpression(constraint.value, values) / (constraint.type === 'diameter' ? 2 : 1);
        const current = radii.get(circles[0].id);
        maximumDelta = Math.max(maximumDelta, Math.abs(current - target));
        radii.set(circles[0].id, target);
        continue;
      }
      if (!['coincident', 'horizontal', 'vertical', 'distance', 'distanceX', 'distanceY'].includes(constraint.type)) continue;
      const points = referencedPoints(constraint.entityIds, entityMap);
      if (points.length !== 2) continue;
      if (constraint.type === 'horizontal' || constraint.type === 'coincident') maximumDelta = Math.max(maximumDelta, moveAxisTogether(points[0], points[1], 'y'));
      if (constraint.type === 'vertical' || constraint.type === 'coincident') maximumDelta = Math.max(maximumDelta, moveAxisTogether(points[0], points[1], 'x'));
      if (constraint.type === 'distance') maximumDelta = Math.max(maximumDelta, setDistance(points[0], points[1], evaluateExpression(constraint.value, values)));
      if (constraint.type === 'distanceX') maximumDelta = Math.max(maximumDelta, setAxisDistance(points[0], points[1], 'x', evaluateExpression(constraint.value, values)));
      if (constraint.type === 'distanceY') maximumDelta = Math.max(maximumDelta, setAxisDistance(points[0], points[1], 'y', evaluateExpression(constraint.value, values)));
    }
    if (maximumDelta <= tolerance) {
      converged = true;
      break;
    }
  }

  const updates = [...coordinates.entries()].map(([pointId, point]) => ({ pointId, x: point.x, y: point.y }));
  const entityUpdates = [...radii.entries()].map(([entityId, radius]) => ({ entityId, geometry: { radius: String(radius) } }));
  const solvedSketch = {
    ...sketch,
    entities: entities.map((entity) => {
      if (entity.type === 'point' && coordinates.has(entity.id)) return { ...entity, geometry: { ...entity.geometry, x: String(coordinates.get(entity.id).x), y: String(coordinates.get(entity.id).y) } };
      if (entity.type === 'circle' && radii.has(entity.id)) return { ...entity, geometry: { ...entity.geometry, radius: String(radii.get(entity.id)) } };
      return entity;
    }),
  };
  const analysis = analyzeSketchConstraints(solvedSketch, parameters);
  return { ...analysis, converged, iterations: Math.min(iterations, maximumIterations), updates, entityUpdates };
}

export function applySketchConstraintSolution(sketch, solution) {
  if (!solution?.converged || solution.status === SKETCH_SOLVER_STATUS.CONFLICT) throw new Error('Nie można zastosować nierozwiązanego albo konfliktowego wyniku solvera.');
  const updates = new Map((solution.updates || []).map((entry) => [entry.pointId, entry]));
  const entityUpdates = new Map((solution.entityUpdates || []).map((entry) => [entry.entityId, entry]));
  for (const entity of sketch.entities || []) {
    const update = updates.get(entity.id);
    if (entity.type === 'point' && update) entity.geometry = { ...entity.geometry, x: String(update.x), y: String(update.y) };
    const entityUpdate = entityUpdates.get(entity.id);
    if (entityUpdate) entity.geometry = { ...entity.geometry, ...entityUpdate.geometry };
  }
  return sketch;
}
