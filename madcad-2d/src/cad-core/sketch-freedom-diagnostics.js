import { SKETCH_SOLVER_STATUS } from './sketch-solver.js';

function entityNumberMap(sketch, type) {
  return new Map((sketch?.entities || []).filter((entity) => entity.type === type).map((entity, index) => [entity.id, index + 1]));
}

function axisLabel(axis) {
  return axis === 'x' ? 'X' : axis === 'y' ? 'Y' : 'promień';
}

export function describeSketchDegreesOfFreedom(sketch, analysis) {
  if (!analysis || analysis.status !== SKETCH_SOLVER_STATUS.UNDER_CONSTRAINED || !analysis.degreesOfFreedom) {
    return { total: 0, modes: [], affectedPointIds: [], suggestions: [] };
  }
  const pointNumbers = entityNumberMap(sketch, 'point');
  const circleNumbers = entityNumberMap(sketch, 'circle');
  const modes = (analysis.freedomModes || []).map((mode, index) => {
    const pointVariables = mode.variables.filter((variable) => variable.kind === 'point');
    const scalarVariables = mode.variables.filter((variable) => variable.kind === 'scalar');
    const axes = new Set(pointVariables.map((variable) => variable.axis));
    const pointIds = [...new Set(pointVariables.map((variable) => variable.entityId))];
    let label;
    if (scalarVariables.length === 1 && !pointVariables.length) {
      const variable = scalarVariables[0];
      label = `Okrąg ${circleNumbers.get(variable.entityId) || ''} — ${axisLabel(variable.axis)}`.replace('  ', ' ');
    } else if (pointIds.length > 1 && axes.size === 1) {
      label = `Przesunięcie po osi ${axisLabel([...axes][0])}`;
    } else if (pointIds.length === 1) {
      label = `Punkt ${pointNumbers.get(pointIds[0]) || ''} — ${[...axes].map(axisLabel).join(' i ')}`.replace('  ', ' ');
    } else {
      label = `Ruch geometrii ${index + 1}: ${pointVariables.slice(0, 3).map((variable) => `P${pointNumbers.get(variable.entityId) || '?'} ${axisLabel(variable.axis)}`).join(', ')}`;
    }
    return { id: mode.id || `dof-${index + 1}`, label, pointIds, variables: mode.variables };
  });
  const affectedPointIds = [...new Set(modes.flatMap((mode) => mode.pointIds))];
  const suggestions = [];
  if (affectedPointIds.length) suggestions.push('Unieruchom punkt bazowy albo nadaj mu wymiary X i Y.');
  const affectedSet = new Set(affectedPointIds);
  if ((sketch?.entities || []).some((entity) => entity.type === 'line' && entity.pointIds?.some((pointId) => affectedSet.has(pointId)))) suggestions.push('Dodaj długość, kąt albo więz kierunkowy do swobodnych linii.');
  if (modes.some((mode) => mode.variables.some((variable) => variable.axis === 'radius'))) suggestions.push('Nadaj promień lub średnicę swobodnemu okręgowi.');
  return { total: analysis.degreesOfFreedom, modes, affectedPointIds, suggestions };
}

