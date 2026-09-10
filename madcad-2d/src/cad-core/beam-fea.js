import { ENGINEERING_MATERIALS } from './static-screening.js';

const AXIS_INDEX = Object.freeze({ x: 0, y: 1, z: 2 });

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < size; pivot += 1) {
    let selected = pivot;
    for (let row = pivot + 1; row < size; row += 1) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[selected][pivot])) selected = row;
    if (Math.abs(augmented[selected][pivot]) < 1e-12) throw new Error('Macierz sztywności jest osobliwa. Sprawdź podpory i przekrój.');
    [augmented[pivot], augmented[selected]] = [augmented[selected], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    for (let column = pivot; column <= size; column += 1) augmented[pivot][column] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= size; column += 1) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map((row) => row[size]);
}

function multiply(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createBeamFeaReportCsv(result, projectName = 'MadCAD') {
  if (!result?.material || !Array.isArray(result.loadCases)) throw new Error('Brak poprawnego wyniku MES do eksportu.');
  const rows = [
    ['Sekcja', 'Parametr', 'Wartość', 'Jednostka'],
    ['Projekt', 'Nazwa', projectName, ''],
    ['Model', 'Materiał', result.material.name, ''],
    ['Model', 'Długość', result.length, 'mm'],
    ['Model', 'Przekrój', `${result.sectionWidth} × ${result.sectionHeight}`, 'mm'],
    ['Obciążenie', 'Typ', result.loadType, ''],
    ['Obciążenie', 'Siła skupiona', result.force, 'N'],
    ['Obciążenie', 'Obciążenie liniowe', result.distributedForce, 'N/mm'],
    ['Wynik', 'Maksymalne naprężenie', result.maximumStress, 'MPa'],
    ['Wynik', 'Ugięcie końca', result.tipDeflection, 'mm'],
    ['Wynik', 'Współczynnik bezpieczeństwa', result.safetyFactor, ''],
    ['Wynik', 'Wymagany współczynnik', result.requiredSafetyFactor, ''],
    ['Wynik', 'Przypadek krytyczny', result.criticalLoadCase?.name || '', ''],
    ...result.loadCases.map((loadCase) => ['Scenariusz', loadCase.name, loadCase.factor, `FoS ${loadCase.safetyFactor}`]),
  ];
  return `sep=;\n${rows.map((row) => row.map(csvCell).join(';')).join('\n')}\n`;
}

export function calculateCantileverBeamFea(body, options = {}) {
  const material = ENGINEERING_MATERIALS[options.materialId || 's235'];
  if (!material) throw new Error('Wybierz obsługiwany materiał.');
  if (body?.bodyKind === 'surface') throw new Error('MES belki wymaga bryły, nie powierzchni.');
  const bounds = body?.metrics?.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 2 || !bounds.every((point) => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite))) throw new Error('Bryła nie ma poprawnych wymiarów granicznych.');
  const spanAxis = String(options.spanAxis || 'x').toLowerCase();
  const loadAxis = String(options.loadAxis || 'z').toLowerCase();
  if (!(spanAxis in AXIS_INDEX) || !(loadAxis in AXIS_INDEX) || spanAxis === loadAxis) throw new Error('Oś długości i kierunek siły muszą być różne.');
  const loadType = ['distributed', 'combined'].includes(options.loadType) ? options.loadType : 'tip';
  const force = Number(options.force);
  if (!Number.isFinite(force) || force <= 0 || force > 1e9) throw new Error(loadType === 'distributed' ? 'Obciążenie liniowe musi być dodatnie i nie większe niż 1 GN/mm.' : 'Siła musi być dodatnia i nie większa niż 1 GN.');
  const distributedForce = loadType === 'combined' ? Number(options.distributedForce) : loadType === 'distributed' ? force : 0;
  if (!Number.isFinite(distributedForce) || distributedForce < 0 || distributedForce > 1e9 || (loadType !== 'tip' && distributedForce === 0)) throw new Error('Obciążenie liniowe musi być dodatnie i nie większe niż 1 GN/mm.');
  const loadPositionPercent = loadType !== 'distributed' ? Number(options.loadPositionPercent ?? 100) : 100;
  if (!Number.isFinite(loadPositionPercent) || loadPositionPercent <= 0 || loadPositionPercent > 100) throw new Error('Położenie siły musi być większe od 0% i nie większe niż 100% długości.');
  const elementCount = Number(options.elementCount);
  if (!Number.isInteger(elementCount) || elementCount < 1 || elementCount > 100) throw new Error('Liczba elementów MES musi być całkowita od 1 do 100.');
  const requiredSafetyFactor = Number(options.requiredSafetyFactor ?? 2);
  if (!Number.isFinite(requiredSafetyFactor) || requiredSafetyFactor < 1 || requiredSafetyFactor > 10) throw new Error('Wymagany współczynnik bezpieczeństwa musi wynosić od 1 do 10.');
  const defaultLoadCaseDefinitions = [
    { id: 'base', name: 'Bazowy', factor: Number(options.baseLoadFactor ?? 1) },
    { id: 'working', name: 'Roboczy', factor: Number(options.workingLoadFactor ?? 1.25) },
    { id: 'overload', name: 'Przeciążenie', factor: Number(options.overloadLoadFactor ?? 1.5) },
  ];
  const loadCaseDefinitions = Array.isArray(options.loadCases) ? options.loadCases.map((loadCase, index) => ({
    id: String(loadCase?.id || `case-${index + 1}`),
    name: String(loadCase?.name || '').trim(),
    factor: Number(loadCase?.factor),
  })) : defaultLoadCaseDefinitions;
  if (loadCaseDefinitions.length < 1 || loadCaseDefinitions.length > 8) throw new Error('Analiza wymaga od 1 do 8 scenariuszy obciążenia.');
  if (loadCaseDefinitions.some(({ name }) => !name || name.length > 40)) throw new Error('Nazwa scenariusza musi mieć od 1 do 40 znaków.');
  if (new Set(loadCaseDefinitions.map(({ id }) => id)).size !== loadCaseDefinitions.length || new Set(loadCaseDefinitions.map(({ name }) => name.toLocaleLowerCase('pl-PL'))).size !== loadCaseDefinitions.length) throw new Error('Scenariusze muszą mieć unikalne nazwy i identyfikatory.');
  if (loadCaseDefinitions.some(({ factor }) => !Number.isFinite(factor) || factor < 0.1 || factor > 10)) throw new Error('Współczynniki scenariuszy muszą wynosić od 0,1 do 10.');
  const dimensions = bounds[1].map((value, index) => value - bounds[0][index]);
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Bryła musi mieć trzy dodatnie wymiary.');
  const spanIndex = AXIS_INDEX[spanAxis];
  const loadIndex = AXIS_INDEX[loadAxis];
  const widthIndex = [0, 1, 2].find((index) => index !== spanIndex && index !== loadIndex);
  const length = dimensions[spanIndex];
  const sectionHeight = dimensions[loadIndex];
  const sectionWidth = dimensions[widthIndex];
  const secondMoment = sectionWidth * sectionHeight ** 3 / 12;
  const elementLength = length / elementCount;
  const dofCount = (elementCount + 1) * 2;
  const stiffness = Array.from({ length: dofCount }, () => Array(dofCount).fill(0));
  const load = Array(dofCount).fill(0);
  const scale = material.elasticModulus * secondMoment / elementLength ** 3;
  const local = [
    [12, 6 * elementLength, -12, 6 * elementLength],
    [6 * elementLength, 4 * elementLength ** 2, -6 * elementLength, 2 * elementLength ** 2],
    [-12, -6 * elementLength, 12, -6 * elementLength],
    [6 * elementLength, 2 * elementLength ** 2, -6 * elementLength, 4 * elementLength ** 2],
  ].map((row) => row.map((value) => value * scale));
  const equivalentLoads = [];
  const loadPosition = length * loadPositionPercent / 100;
  const pointLoadElement = Math.min(elementCount - 1, Math.floor(loadPosition / elementLength));
  for (let element = 0; element < elementCount; element += 1) {
    const indices = [element * 2, element * 2 + 1, element * 2 + 2, element * 2 + 3];
    for (let row = 0; row < 4; row += 1) for (let column = 0; column < 4; column += 1) stiffness[indices[row]][indices[column]] += local[row][column];
    const equivalent = [0, 0, 0, 0];
    if (distributedForce > 0) {
      const distributedEquivalent = [-distributedForce * elementLength / 2, -distributedForce * elementLength ** 2 / 12, -distributedForce * elementLength / 2, distributedForce * elementLength ** 2 / 12];
      distributedEquivalent.forEach((value, index) => { equivalent[index] += value; });
    }
    if (loadType !== 'distributed' && element === pointLoadElement) {
      const ratio = (loadPosition - element * elementLength) / elementLength;
      const shape = [1 - 3 * ratio ** 2 + 2 * ratio ** 3, elementLength * (ratio - 2 * ratio ** 2 + ratio ** 3), 3 * ratio ** 2 - 2 * ratio ** 3, elementLength * (-(ratio ** 2) + ratio ** 3)];
      shape.forEach((value, index) => { equivalent[index] += -force * value; });
    }
    equivalentLoads.push(equivalent);
    equivalent.forEach((value, index) => { load[indices[index]] += value; });
  }
  const freeIndices = Array.from({ length: dofCount - 2 }, (_, index) => index + 2);
  const reducedStiffness = freeIndices.map((row) => freeIndices.map((column) => stiffness[row][column]));
  const reducedLoad = freeIndices.map((index) => load[index]);
  const freeDisplacements = solveLinearSystem(reducedStiffness, reducedLoad);
  const displacement = Array(dofCount).fill(0);
  freeIndices.forEach((index, offset) => { displacement[index] = freeDisplacements[offset]; });
  const reactions = multiply(stiffness, displacement).map((value, index) => value - load[index]);
  let maximumMoment = 0;
  const bendingMoments = [];
  const shearForces = [];
  for (let element = 0; element < elementCount; element += 1) {
    const indices = [element * 2, element * 2 + 1, element * 2 + 2, element * 2 + 3];
    const endForces = multiply(local, indices.map((index) => displacement[index])).map((value, index) => value - equivalentLoads[element][index]);
    maximumMoment = Math.max(maximumMoment, Math.abs(endForces[1]), Math.abs(endForces[3]));
    if (element === 0) bendingMoments.push({ x: 0, moment: Math.abs(endForces[1]) });
    bendingMoments.push({ x: (element + 1) * elementLength, moment: Math.abs(endForces[3]) });
    shearForces.push(
      { x: element * elementLength, shear: Math.abs(endForces[0]) },
      { x: (element + 1) * elementLength, shear: Math.abs(endForces[2]) },
    );
  }
  const tipDeflection = Math.abs(displacement[dofCount - 2]);
  const analyticalDeflection = distributedForce * length ** 4 / (8 * material.elasticModulus * secondMoment)
    + (loadType !== 'distributed' ? force * loadPosition ** 2 * (3 * length - loadPosition) / (6 * material.elasticModulus * secondMoment) : 0);
  const maximumStress = maximumMoment * sectionHeight / 2 / secondMoment;
  const bendingStresses = bendingMoments.map((node) => {
    const stress = node.moment * sectionHeight / 2 / secondMoment;
    return { x: node.x, stress, utilizationPercent: stress / material.yieldStrength * 100, exceedsYield: stress > material.yieldStrength };
  });
  const utilizationPercent = maximumStress / material.yieldStrength * 100;
  const yieldExceededNodeCount = bendingStresses.filter((node) => node.exceedsYield).length;
  const safetyFactor = maximumStress > 0 ? material.yieldStrength / maximumStress : Infinity;
  const meetsSafetyTarget = safetyFactor >= requiredSafetyFactor;
  const safetyMarginPercent = (safetyFactor / requiredSafetyFactor - 1) * 100;
  const loadCases = loadCaseDefinitions.map((loadCase) => {
    const caseSafetyFactor = safetyFactor / loadCase.factor;
    return {
      ...loadCase,
      totalLoad: (distributedForce * length + (loadType !== 'distributed' ? force : 0)) * loadCase.factor,
      tipDeflection: tipDeflection * loadCase.factor,
      maximumStress: maximumStress * loadCase.factor,
      safetyFactor: caseSafetyFactor,
      meetsSafetyTarget: caseSafetyFactor >= requiredSafetyFactor,
      status: caseSafetyFactor >= requiredSafetyFactor ? 'safe' : caseSafetyFactor >= 1 ? 'warning' : 'failed',
    };
  });
  const criticalLoadCase = loadCases.reduce((critical, loadCase) => loadCase.safetyFactor < critical.safetyFactor ? loadCase : critical);
  return {
    bodyId: body.id,
    material,
    spanAxis,
    loadAxis,
    loadType,
    loadPositionPercent,
    loadPosition,
    force,
    distributedForce,
    totalLoad: distributedForce * length + (loadType !== 'distributed' ? force : 0),
    elementCount,
    nodeCount: elementCount + 1,
    length,
    sectionWidth,
    sectionHeight,
    secondMoment,
    tipDeflection,
    analyticalDeflection,
    convergenceError: analyticalDeflection ? Math.abs(tipDeflection - analyticalDeflection) / analyticalDeflection * 100 : 0,
    maximumMoment,
    maximumStress,
    utilizationPercent,
    yieldExceededNodeCount,
    safetyFactor,
    requiredSafetyFactor,
    meetsSafetyTarget,
    safetyMarginPercent,
    loadCases,
    criticalLoadCase,
    reactionForce: Math.abs(reactions[0]),
    reactionMoment: Math.abs(reactions[1]),
    bendingMoments,
    bendingStresses,
    shearForces,
    nodalDeflections: Array.from({ length: elementCount + 1 }, (_, node) => ({ x: node * elementLength, displacement: displacement[node * 2], rotation: displacement[node * 2 + 1] })),
    status: meetsSafetyTarget ? 'safe' : safetyFactor >= 1 ? 'warning' : 'failed',
    limitations: [
      `Liniowy MES Eulera-Bernoulliego dla prostej belki o stałym prostokątnym przekroju z obwiedni bryły i ${loadType === 'combined' ? 'kombinacji siły skupionej z obciążeniem rozłożonym' : loadType === 'distributed' ? 'równomiernym obciążeniu rozłożonym' : 'sile skupionej'}.`,
      'Nie odwzorowuje lokalnej geometrii, otworów, karbów, kontaktów, plastyczności, wyboczenia ani dużych przemieszczeń.',
      'Wynik jest walidowany rozwiązaniem analitycznym tego samego przypadku, ale nie zastępuje analizy dowolnej bryły 3D.',
    ],
  };
}
