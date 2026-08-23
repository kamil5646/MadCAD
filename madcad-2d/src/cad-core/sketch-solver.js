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
  'tangent',
  'equal',
  'collinear',
  'symmetry',
  'coordinateX',
  'coordinateY',
  'arcLength',
  'curvature',
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

function matrixNullspace(matrix, columnCount, tolerance = 1e-9) {
  if (!columnCount) return [];
  const work = matrix.length ? matrix.map((row) => [...row]) : [];
  const pivotColumns = [];
  let pivotRow = 0;
  for (let column = 0; column < columnCount && pivotRow < work.length; column += 1) {
    let bestRow = pivotRow;
    for (let row = pivotRow + 1; row < work.length; row += 1) {
      if (Math.abs(work[row][column]) > Math.abs(work[bestRow][column])) bestRow = row;
    }
    if (Math.abs(work[bestRow]?.[column] || 0) <= tolerance) continue;
    [work[pivotRow], work[bestRow]] = [work[bestRow], work[pivotRow]];
    const divisor = work[pivotRow][column];
    for (let index = 0; index < columnCount; index += 1) work[pivotRow][index] /= divisor;
    for (let row = 0; row < work.length; row += 1) {
      if (row === pivotRow) continue;
      const factor = work[row][column];
      if (Math.abs(factor) <= tolerance) continue;
      for (let index = 0; index < columnCount; index += 1) work[row][index] -= factor * work[pivotRow][index];
    }
    pivotColumns.push(column);
    pivotRow += 1;
  }
  const pivotSet = new Set(pivotColumns);
  return Array.from({ length: columnCount }, (_, column) => column).filter((column) => !pivotSet.has(column)).map((freeColumn) => {
    const vector = Array(columnCount).fill(0);
    vector[freeColumn] = 1;
    pivotColumns.forEach((pivotColumn, row) => { vector[pivotColumn] = -(work[row]?.[freeColumn] || 0); });
    return vector;
  });
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
  const numericalRows = (involvedPoints, residualFunctions) => {
    const uniquePoints = [...new Map(involvedPoints.map((point) => [point.id, point])).values()];
    const coordinates = new Map(uniquePoints.map((point) => [point.id, { x: pointValue(point, 'x'), y: pointValue(point, 'y') }]));
    const get = (pointId) => coordinates.get(pointId);
    return residualFunctions.map((residualFunction) => {
      const residual = residualFunction(get);
      const row = makeRow();
      for (const point of uniquePoints) {
        for (const axis of ['x', 'y']) {
          const column = variableColumns.get(`${point.id}:${axis}`);
          if (column === undefined) continue;
          const coordinateValue = coordinates.get(point.id);
          const original = coordinateValue[axis];
          const step = 1e-6 * Math.max(1, Math.abs(original));
          coordinateValue[axis] = original + step;
          row[column] = (residualFunction(get) - residual) / step;
          coordinateValue[axis] = original;
        }
      }
      return { row, residual };
    });
  };

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

  if (constraint.type === 'coordinateX' || constraint.type === 'coordinateY') {
    const selectedPoints = referencedEntities(constraint.entityIds, entityMap, 'point');
    if (selectedPoints.length !== 1) return { supported: true, error: `Wiązanie ${constraint.type} wymaga dokładnie jednego punktu.` };
    const target = evaluateExpression(constraint.value, values);
    const axis = constraint.type === 'coordinateX' ? 'x' : 'y';
    const row = makeRow();
    coefficient(row, selectedPoints[0].id, axis, 1);
    return { supported: true, rows: [{ row, residual: pointValue(selectedPoints[0], axis) - target }] };
  }

  if (constraint.type === 'arcLength') {
    const arcs = referencedEntities(constraint.entityIds, entityMap, 'arc');
    if (arcs.length !== 1) return { supported: true, error: 'Wymiar długości łuku wymaga dokładnie jednego łuku.' };
    const arcPoints = arcs[0].pointIds.map((pointId) => entityMap.get(pointId));
    if (arcPoints.some((point) => point?.type !== 'point')) return { supported: true, error: 'Łuk nie ma kompletu punktów.' };
    const target = evaluateExpression(constraint.value, values);
    if (!(target > GEOMETRY_POLICY.linearTolerance)) return { supported: true, error: 'Długość łuku musi być dodatnia.' };
    const residual = (get) => {
      const [center, start, end] = arcPoints.map((point) => get(point.id));
      const radius = Math.hypot(start.x - center.x, start.y - center.y);
      let sweep = Math.atan2(end.y - center.y, end.x - center.x) - Math.atan2(start.y - center.y, start.x - center.x);
      if (arcs[0].geometry.direction === 'cw') { while (sweep >= 0) sweep -= Math.PI * 2; }
      else { while (sweep <= 0) sweep += Math.PI * 2; }
      return radius * Math.abs(sweep) - target;
    };
    return { supported: true, rows: numericalRows(arcPoints, [residual]) };
  }

  if (constraint.type === 'collinear') {
    const lines = referencedEntities(constraint.entityIds, entityMap, 'line');
    if (lines.length !== 2) return { supported: true, error: 'Wiązanie collinear wymaga dokładnie dwóch linii.' };
    const linePoints = lines.map((line) => line.pointIds.map((pointId) => entityMap.get(pointId)));
    if (linePoints.some((pair) => pair.some((point) => point?.type !== 'point'))) return { supported: true, error: 'Wiązanie collinear wskazuje niepełną linię.' };
    const allPoints = linePoints.flat();
    const direction = (get, pair) => {
      const start = get(pair[0].id); const end = get(pair[1].id);
      return [end.x - start.x, end.y - start.y];
    };
    const residuals = [
      (get) => {
        const first = direction(get, linePoints[0]); const second = direction(get, linePoints[1]);
        const denominator = Math.hypot(...first) * Math.hypot(...second);
        return denominator > GEOMETRY_POLICY.linearTolerance ? ((first[0] * second[1]) - (first[1] * second[0])) / denominator : 1;
      },
      (get) => {
        const first = direction(get, linePoints[0]);
        const start = get(linePoints[0][0].id); const other = get(linePoints[1][0].id);
        const length = Math.hypot(...first);
        return length > GEOMETRY_POLICY.linearTolerance ? ((first[0] * (other.y - start.y)) - (first[1] * (other.x - start.x))) / length : 1;
      },
    ];
    return { supported: true, rows: numericalRows(allPoints, residuals) };
  }

  if (constraint.type === 'symmetry') {
    const selectedPoints = referencedEntities(constraint.entityIds, entityMap, 'point');
    const axes = referencedEntities(constraint.entityIds, entityMap, 'line');
    if (selectedPoints.length !== 2 || axes.length !== 1) return { supported: true, error: 'Wiązanie symmetry wymaga dwóch punktów i jednej linii osi.' };
    const axisPoints = axes[0].pointIds.map((pointId) => entityMap.get(pointId));
    if (axisPoints.some((point) => point?.type !== 'point')) return { supported: true, error: 'Oś więzu symmetry jest niepełna.' };
    const residuals = [
      (get) => {
        const first = get(selectedPoints[0].id); const second = get(selectedPoints[1].id);
        const axisStart = get(axisPoints[0].id); const axisEnd = get(axisPoints[1].id);
        const dx = axisEnd.x - axisStart.x; const dy = axisEnd.y - axisStart.y; const length = Math.hypot(dx, dy);
        const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
        return length > GEOMETRY_POLICY.linearTolerance ? (dx * (midpoint.y - axisStart.y) - dy * (midpoint.x - axisStart.x)) / length : 1;
      },
      (get) => {
        const first = get(selectedPoints[0].id); const second = get(selectedPoints[1].id);
        const axisStart = get(axisPoints[0].id); const axisEnd = get(axisPoints[1].id);
        const dx = axisEnd.x - axisStart.x; const dy = axisEnd.y - axisStart.y; const length = Math.hypot(dx, dy);
        return length > GEOMETRY_POLICY.linearTolerance ? ((second.x - first.x) * dx + (second.y - first.y) * dy) / length : 1;
      },
    ];
    return { supported: true, rows: numericalRows([...selectedPoints, ...axisPoints], residuals) };
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

  if (constraint.type === 'equal') {
    const lines = referencedEntities(constraint.entityIds, entityMap, 'line');
    const circles = referencedEntities(constraint.entityIds, entityMap, 'circle');
    const row = makeRow();
    if (lines.length === 2 && circles.length === 0) {
      const lengths = lines.map((line, lineIndex) => {
        const [start, end] = line.pointIds.map((pointId) => entityMap.get(pointId));
        if (start?.type !== 'point' || end?.type !== 'point') return null;
        const dx = pointValue(end, 'x') - pointValue(start, 'x');
        const dy = pointValue(end, 'y') - pointValue(start, 'y');
        const length = Math.hypot(dx, dy);
        if (length <= GEOMETRY_POLICY.linearTolerance) return null;
        const sign = lineIndex === 0 ? -1 : 1;
        coefficient(row, start.id, 'x', sign * -dx / length);
        coefficient(row, start.id, 'y', sign * -dy / length);
        coefficient(row, end.id, 'x', sign * dx / length);
        coefficient(row, end.id, 'y', sign * dy / length);
        return length;
      });
      if (lengths.some((length) => length === null)) return { supported: true, error: 'Wiązanie equal nie obsługuje linii o zerowej długości.' };
      return { supported: true, rows: [{ row, residual: lengths[1] - lengths[0] }] };
    }
    if (circles.length === 2 && lines.length === 0) {
      circles.forEach((circle, index) => {
        const column = variableColumns.get(`${circle.id}:radius`);
        if (column !== undefined) row[column] += index === 0 ? -1 : 1;
      });
      const radii = circles.map((circle) => evaluateExpression(circle.geometry.radius, values));
      return { supported: true, rows: [{ row, residual: radii[1] - radii[0] }] };
    }
    return { supported: true, error: 'Wiązanie equal wymaga dwóch linii albo dwóch okręgów.' };
  }

  if (constraint.type === 'tangent') {
    const lines = referencedEntities(constraint.entityIds, entityMap, 'line');
    const circles = referencedEntities(constraint.entityIds, entityMap, 'circle');
    const row = makeRow();
    if (lines.length === 1 && circles.length === 1) {
      const line = lines[0];
      const circle = circles[0];
      const [start, end] = line.pointIds.map((pointId) => entityMap.get(pointId));
      const center = entityMap.get(circle.pointIds[0]);
      if ([start, end, center].some((point) => point?.type !== 'point')) return { supported: true, error: 'Wiązanie tangent wskazuje niepełną geometrię.' };
      const ax = pointValue(start, 'x');
      const ay = pointValue(start, 'y');
      const bx = pointValue(end, 'x');
      const by = pointValue(end, 'y');
      const cx = pointValue(center, 'x');
      const cy = pointValue(center, 'y');
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx, dy);
      if (length <= GEOMETRY_POLICY.linearTolerance) return { supported: true, error: 'Wiązanie tangent nie obsługuje linii o zerowej długości.' };
      const cross = dx * (cy - ay) - dy * (cx - ax);
      const signedDistance = cross / length;
      const side = signedDistance < 0 ? -1 : 1;
      const crossGradients = [by - cy, cx - bx, cy - ay, ax - cx, -dy, dx];
      const lengthGradients = [-dx / length, -dy / length, dx / length, dy / length, 0, 0];
      const variables = [[start, 'x'], [start, 'y'], [end, 'x'], [end, 'y'], [center, 'x'], [center, 'y']];
      variables.forEach(([point, axis], index) => coefficient(row, point.id, axis, side * ((crossGradients[index] / length) - ((cross * lengthGradients[index]) / (length * length)))));
      const radiusColumn = variableColumns.get(`${circle.id}:radius`);
      if (radiusColumn !== undefined) row[radiusColumn] -= 1;
      const radius = evaluateExpression(circle.geometry.radius, values);
      return { supported: true, rows: [{ row, residual: Math.abs(signedDistance) - radius }] };
    }
    if (lines.length === 0 && circles.length === 2) {
      const centers = circles.map((circle) => entityMap.get(circle.pointIds[0]));
      if (centers.some((point) => point?.type !== 'point')) return { supported: true, error: 'Wiązanie tangent wskazuje okrąg bez środka.' };
      const dx = pointValue(centers[1], 'x') - pointValue(centers[0], 'x');
      const dy = pointValue(centers[1], 'y') - pointValue(centers[0], 'y');
      const distance = Math.hypot(dx, dy);
      const direction = distance > GEOMETRY_POLICY.linearTolerance ? [dx / distance, dy / distance] : [1, 0];
      coefficient(row, centers[0].id, 'x', -direction[0]);
      coefficient(row, centers[0].id, 'y', -direction[1]);
      coefficient(row, centers[1].id, 'x', direction[0]);
      coefficient(row, centers[1].id, 'y', direction[1]);
      circles.forEach((circle) => {
        const column = variableColumns.get(`${circle.id}:radius`);
        if (column !== undefined) row[column] -= 1;
      });
      const target = circles.reduce((sum, circle) => sum + evaluateExpression(circle.geometry.radius, values), 0);
      return { supported: true, rows: [{ row, residual: distance - target }] };
    }
    return { supported: true, error: 'Wiązanie tangent wymaga linii i okręgu albo dwóch okręgów.' };
  }

  if (constraint.type === 'curvature') {
    const arcs = referencedEntities(constraint.entityIds, entityMap, 'arc');
    if (arcs.length !== 2) return { supported: true, error: 'Wiązanie curvature wymaga dokładnie dwóch łuków.' };
    const sharedPointIds = arcs[0].pointIds.slice(1).filter((pointId) => arcs[1].pointIds.slice(1).includes(pointId));
    if (sharedPointIds.length !== 1) return { supported: true, error: 'Łuki curvature muszą mieć dokładnie jeden wspólny koniec.' };
    const centers = arcs.map((arc) => entityMap.get(arc.pointIds[0]));
    if (centers.some((point) => point?.type !== 'point')) return { supported: true, error: 'Łuk curvature nie ma punktu środka.' };
    return {
      supported: true,
      rows: ['x', 'y'].map((axis) => {
        const row = makeRow();
        coefficient(row, centers[0].id, axis, -1);
        coefficient(row, centers[1].id, axis, 1);
        return { row, residual: pointValue(centers[1], axis) - pointValue(centers[0], axis) };
      }),
    };
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
  const variableEntries = [...variableColumns.entries()].sort((first, second) => first[1] - second[1]).map(([key, column]) => {
    const separator = key.lastIndexOf(':');
    const entityId = key.slice(0, separator);
    const axis = key.slice(separator + 1);
    return { key, column, entityId, axis, kind: axis === 'radius' ? 'scalar' : 'point' };
  });
  const freedomModes = matrixNullspace(jacobian, variableColumns.size).map((vector, index) => ({
    id: `dof-${index + 1}`,
    variables: variableEntries.filter((entry) => Math.abs(vector[entry.column]) > 1e-7).map((entry) => ({
      kind: entry.kind,
      entityId: entry.entityId,
      axis: entry.axis,
      contribution: vector[entry.column],
    })),
  }));
  const freeVariableKeys = new Set(freedomModes.flatMap((mode) => mode.variables.map((variable) => `${variable.entityId}:${variable.axis}`)));
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
      variables: explicitlyFixed.has(point.id) ? [] : ['x', 'y'].filter((axis) => freeVariableKeys.has(`${point.id}:${axis}`)),
    })),
    scalars: entities.filter((entity) => entity.type === 'circle').map((circle) => ({
      entityId: circle.id,
      key: 'radius',
      fixed: fixedEntityIds.has(circle.id) || !freeVariableKeys.has(`${circle.id}:radius`),
    })),
    freedomModes,
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
  const lineLength = (line) => {
    const start = coordinates.get(line.pointIds[0]);
    const end = coordinates.get(line.pointIds[1]);
    return Math.hypot(end.x - start.x, end.y - start.y);
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
  const translateLineToLine = (targetLine, sourceLine) => {
    const [sourceStart, sourceEnd] = sourceLine.pointIds.map((id) => coordinates.get(id));
    const [targetStartId, targetEndId] = targetLine.pointIds;
    const targetStart = coordinates.get(targetStartId);
    const targetEnd = coordinates.get(targetEndId);
    const dx = sourceEnd.x - sourceStart.x;
    const dy = sourceEnd.y - sourceStart.y;
    const length = Math.hypot(dx, dy);
    if (length <= tolerance) return 0;
    const normal = [-dy / length, dx / length];
    const midpoint = [(targetStart.x + targetEnd.x) / 2, (targetStart.y + targetEnd.y) / 2];
    const offset = ((midpoint[0] - sourceStart.x) * normal[0]) + ((midpoint[1] - sourceStart.y) * normal[1]);
    let delta = 0;
    for (const [id, point] of [[targetStartId, targetStart], [targetEndId, targetEnd]]) {
      if (fixedPointIds.has(id)) continue;
      point.x -= normal[0] * offset;
      point.y -= normal[1] * offset;
      delta = Math.max(delta, Math.abs(offset));
    }
    return delta;
  };
  const reflectAcrossLine = (point, axisStart, axisEnd) => {
    const dx = axisEnd.x - axisStart.x;
    const dy = axisEnd.y - axisStart.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= tolerance * tolerance) return { ...point };
    const projection = ((point.x - axisStart.x) * dx + (point.y - axisStart.y) * dy) / lengthSquared;
    const foot = { x: axisStart.x + projection * dx, y: axisStart.y + projection * dy };
    return { x: (2 * foot.x) - point.x, y: (2 * foot.y) - point.y };
  };
  const setSymmetricPoints = (firstId, secondId, axisLine) => {
    const first = coordinates.get(firstId);
    const second = coordinates.get(secondId);
    const [axisStart, axisEnd] = axisLine.pointIds.map((id) => coordinates.get(id));
    if (!first || !second || !axisStart || !axisEnd) return 0;
    const firstFixed = fixedPointIds.has(firstId);
    const secondFixed = fixedPointIds.has(secondId);
    if (firstFixed && secondFixed) return 0;
    if (firstFixed || secondFixed) {
      const source = firstFixed ? first : second;
      const target = firstFixed ? second : first;
      const reflected = reflectAcrossLine(source, axisStart, axisEnd);
      const delta = Math.hypot(target.x - reflected.x, target.y - reflected.y);
      target.x = reflected.x; target.y = reflected.y;
      return delta;
    }
    const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const projectedMidpoint = reflectAcrossLine(midpoint, axisStart, axisEnd);
    projectedMidpoint.x = (projectedMidpoint.x + midpoint.x) / 2;
    projectedMidpoint.y = (projectedMidpoint.y + midpoint.y) / 2;
    const dx = axisEnd.x - axisStart.x; const dy = axisEnd.y - axisStart.y; const length = Math.hypot(dx, dy);
    if (length <= tolerance) return 0;
    const normal = [-dy / length, dx / length];
    const halfDistance = Math.hypot(second.x - first.x, second.y - first.y) / 2;
    const sign = ((second.x - first.x) * normal[0] + (second.y - first.y) * normal[1]) < 0 ? -1 : 1;
    const nextFirst = { x: projectedMidpoint.x - normal[0] * halfDistance * sign, y: projectedMidpoint.y - normal[1] * halfDistance * sign };
    const nextSecond = { x: projectedMidpoint.x + normal[0] * halfDistance * sign, y: projectedMidpoint.y + normal[1] * halfDistance * sign };
    const delta = Math.max(Math.hypot(first.x - nextFirst.x, first.y - nextFirst.y), Math.hypot(second.x - nextSecond.x, second.y - nextSecond.y));
    Object.assign(first, nextFirst); Object.assign(second, nextSecond);
    return delta;
  };
  const setPointCoordinate = (pointId, axis, target) => {
    if (fixedPointIds.has(pointId)) return 0;
    const point = coordinates.get(pointId);
    const delta = Math.abs(point[axis] - target);
    point[axis] = target;
    return delta;
  };
  const setArcLength = (arc, targetLength) => {
    const [centerId, startId, endId] = arc.pointIds;
    const center = coordinates.get(centerId); const start = coordinates.get(startId); const end = coordinates.get(endId);
    if (!center || !start || !end) return 0;
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    let sweep = endAngle - startAngle;
    if (arc.geometry.direction === 'cw') { while (sweep >= 0) sweep -= Math.PI * 2; }
    else { while (sweep <= 0) sweep += Math.PI * 2; }
    const targetRadius = targetLength / Math.abs(sweep);
    let delta = 0;
    for (const [pointId, point, angle] of [[startId, start, startAngle], [endId, end, endAngle]]) {
      if (fixedPointIds.has(pointId)) continue;
      const next = { x: center.x + Math.cos(angle) * targetRadius, y: center.y + Math.sin(angle) * targetRadius };
      delta = Math.max(delta, Math.hypot(point.x - next.x, point.y - next.y));
      Object.assign(point, next);
    }
    return delta;
  };

  let converged = false;
  let iterations = 0;
  for (iterations = 1; iterations <= maximumIterations; iterations += 1) {
    let maximumDelta = 0;
    for (const constraint of sketch?.constraints || []) {
      if (constraint.type === 'coordinateX' || constraint.type === 'coordinateY') {
        const points = referencedEntities(constraint.entityIds, entityMap, 'point');
        if (points.length === 1) maximumDelta = Math.max(maximumDelta, setPointCoordinate(points[0].id, constraint.type === 'coordinateX' ? 'x' : 'y', evaluateExpression(constraint.value, values)));
        continue;
      }
      if (constraint.type === 'arcLength') {
        const arcs = referencedEntities(constraint.entityIds, entityMap, 'arc');
        if (arcs.length === 1) maximumDelta = Math.max(maximumDelta, setArcLength(arcs[0], evaluateExpression(constraint.value, values)));
        continue;
      }
      if (constraint.type === 'collinear') {
        const lines = referencedEntities(constraint.entityIds, entityMap, 'line');
        if (lines.length !== 2) continue;
        const secondMovable = lines[1].pointIds.every((pointId) => !fixedPointIds.has(pointId));
        const target = secondMovable ? lines[1] : lines[0];
        const source = secondMovable ? lines[0] : lines[1];
        const targetAngle = lineAngle(source) + (Math.cos(lineAngle(target) - lineAngle(source)) < 0 ? Math.PI : 0);
        maximumDelta = Math.max(maximumDelta, setLineAngle(target, targetAngle), translateLineToLine(target, source));
        continue;
      }
      if (constraint.type === 'symmetry') {
        const points = referencedEntities(constraint.entityIds, entityMap, 'point');
        const axes = referencedEntities(constraint.entityIds, entityMap, 'line');
        if (points.length === 2 && axes.length === 1) maximumDelta = Math.max(maximumDelta, setSymmetricPoints(points[0].id, points[1].id, axes[0]));
        continue;
      }
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
      if (constraint.type === 'equal') {
        const lines = referencedEntities(constraint.entityIds, entityMap, 'line');
        const circles = referencedEntities(constraint.entityIds, entityMap, 'circle');
        if (lines.length === 2 && circles.length === 0) {
          const secondPoints = lines[1].pointIds.map((pointId) => entityMap.get(pointId));
          const firstPoints = lines[0].pointIds.map((pointId) => entityMap.get(pointId));
          const secondMovable = secondPoints.some((point) => !fixedPointIds.has(point.id));
          maximumDelta = Math.max(maximumDelta, secondMovable
            ? setDistance(secondPoints[0], secondPoints[1], lineLength(lines[0]))
            : setDistance(firstPoints[0], firstPoints[1], lineLength(lines[1])));
        } else if (circles.length === 2 && lines.length === 0) {
          const targetCircle = fixedEntityIds.has(circles[1].id) ? circles[0] : circles[1];
          const sourceCircle = targetCircle === circles[1] ? circles[0] : circles[1];
          if (!fixedEntityIds.has(targetCircle.id)) {
            const nextRadius = radii.get(sourceCircle.id);
            maximumDelta = Math.max(maximumDelta, Math.abs(radii.get(targetCircle.id) - nextRadius));
            radii.set(targetCircle.id, nextRadius);
          }
        }
        continue;
      }
      if (constraint.type === 'tangent') {
        const lines = referencedEntities(constraint.entityIds, entityMap, 'line');
        const circles = referencedEntities(constraint.entityIds, entityMap, 'circle');
        if (lines.length === 1 && circles.length === 1) {
          const [startId, endId] = lines[0].pointIds;
          const start = coordinates.get(startId);
          const end = coordinates.get(endId);
          const centerId = circles[0].pointIds[0];
          const center = coordinates.get(centerId);
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.hypot(dx, dy);
          if (length <= tolerance) continue;
          const normal = [-dy / length, dx / length];
          const signedDistance = ((center.x - start.x) * normal[0]) + ((center.y - start.y) * normal[1]);
          const targetSigned = (signedDistance < 0 ? -1 : 1) * radii.get(circles[0].id);
          const correction = targetSigned - signedDistance;
          if (!fixedPointIds.has(centerId)) {
            center.x += normal[0] * correction;
            center.y += normal[1] * correction;
            maximumDelta = Math.max(maximumDelta, Math.abs(correction));
          } else if (!fixedEntityIds.has(circles[0].id)) {
            maximumDelta = Math.max(maximumDelta, Math.abs(radii.get(circles[0].id) - Math.abs(signedDistance)));
            radii.set(circles[0].id, Math.abs(signedDistance));
          } else if (!fixedPointIds.has(startId) && !fixedPointIds.has(endId)) {
            start.x -= normal[0] * correction;
            start.y -= normal[1] * correction;
            end.x -= normal[0] * correction;
            end.y -= normal[1] * correction;
            maximumDelta = Math.max(maximumDelta, Math.abs(correction));
          }
        } else if (lines.length === 0 && circles.length === 2) {
          const centers = circles.map((circle) => entityMap.get(circle.pointIds[0]));
          maximumDelta = Math.max(maximumDelta, setDistance(centers[0], centers[1], radii.get(circles[0].id) + radii.get(circles[1].id)));
        }
        continue;
      }
      if (constraint.type === 'curvature') {
        const arcs = referencedEntities(constraint.entityIds, entityMap, 'arc');
        if (arcs.length !== 2) continue;
        const centers = arcs.map((arc) => coordinates.get(arc.pointIds[0]));
        const centerIds = arcs.map((arc) => arc.pointIds[0]);
        if (centers.some((point) => !point)) continue;
        const firstMovable = !fixedPointIds.has(centerIds[0]);
        const secondMovable = !fixedPointIds.has(centerIds[1]);
        const distance = Math.hypot(centers[1].x - centers[0].x, centers[1].y - centers[0].y);
        if (secondMovable) Object.assign(centers[1], centers[0]);
        else if (firstMovable) Object.assign(centers[0], centers[1]);
        maximumDelta = Math.max(maximumDelta, (firstMovable || secondMovable) ? distance : 0);
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
