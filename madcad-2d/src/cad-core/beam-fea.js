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

export function calculateCantileverBeamFea(body, options = {}) {
  const material = ENGINEERING_MATERIALS[options.materialId || 's235'];
  if (!material) throw new Error('Wybierz obsługiwany materiał.');
  if (body?.bodyKind === 'surface') throw new Error('MES belki wymaga bryły, nie powierzchni.');
  const bounds = body?.metrics?.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 2 || !bounds.every((point) => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite))) throw new Error('Bryła nie ma poprawnych wymiarów granicznych.');
  const spanAxis = String(options.spanAxis || 'x').toLowerCase();
  const loadAxis = String(options.loadAxis || 'z').toLowerCase();
  if (!(spanAxis in AXIS_INDEX) || !(loadAxis in AXIS_INDEX) || spanAxis === loadAxis) throw new Error('Oś długości i kierunek siły muszą być różne.');
  const loadType = options.loadType === 'distributed' ? 'distributed' : 'tip';
  const force = Number(options.force);
  if (!Number.isFinite(force) || force <= 0 || force > 1e9) throw new Error(loadType === 'distributed' ? 'Obciążenie liniowe musi być dodatnie i nie większe niż 1 GN/mm.' : 'Siła musi być dodatnia i nie większa niż 1 GN.');
  const loadPositionPercent = loadType === 'tip' ? Number(options.loadPositionPercent ?? 100) : 100;
  if (!Number.isFinite(loadPositionPercent) || loadPositionPercent <= 0 || loadPositionPercent > 100) throw new Error('Położenie siły musi być większe od 0% i nie większe niż 100% długości.');
  const elementCount = Number(options.elementCount);
  if (!Number.isInteger(elementCount) || elementCount < 1 || elementCount > 100) throw new Error('Liczba elementów MES musi być całkowita od 1 do 100.');
  const requiredSafetyFactor = Number(options.requiredSafetyFactor ?? 2);
  if (!Number.isFinite(requiredSafetyFactor) || requiredSafetyFactor < 1 || requiredSafetyFactor > 10) throw new Error('Wymagany współczynnik bezpieczeństwa musi wynosić od 1 do 10.');
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
    let equivalent = [0, 0, 0, 0];
    if (loadType === 'distributed') equivalent = [-force * elementLength / 2, -force * elementLength ** 2 / 12, -force * elementLength / 2, force * elementLength ** 2 / 12];
    else if (element === pointLoadElement) {
      const ratio = (loadPosition - element * elementLength) / elementLength;
      const shape = [1 - 3 * ratio ** 2 + 2 * ratio ** 3, elementLength * (ratio - 2 * ratio ** 2 + ratio ** 3), 3 * ratio ** 2 - 2 * ratio ** 3, elementLength * (-(ratio ** 2) + ratio ** 3)];
      equivalent = shape.map((value) => -force * value);
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
  const analyticalDeflection = loadType === 'distributed'
    ? force * length ** 4 / (8 * material.elasticModulus * secondMoment)
    : force * loadPosition ** 2 * (3 * length - loadPosition) / (6 * material.elasticModulus * secondMoment);
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
  return {
    bodyId: body.id,
    material,
    spanAxis,
    loadAxis,
    loadType,
    loadPositionPercent,
    loadPosition,
    force,
    totalLoad: loadType === 'distributed' ? force * length : force,
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
    reactionForce: Math.abs(reactions[0]),
    reactionMoment: Math.abs(reactions[1]),
    bendingMoments,
    bendingStresses,
    shearForces,
    nodalDeflections: Array.from({ length: elementCount + 1 }, (_, node) => ({ x: node * elementLength, displacement: displacement[node * 2], rotation: displacement[node * 2 + 1] })),
    status: meetsSafetyTarget ? 'safe' : safetyFactor >= 1 ? 'warning' : 'failed',
    limitations: [
      `Liniowy MES Eulera-Bernoulliego dla prostej belki o stałym prostokątnym przekroju z obwiedni bryły i ${loadType === 'distributed' ? 'równomiernym obciążeniu rozłożonym' : 'sile skupionej na końcu'}.`,
      'Nie odwzorowuje lokalnej geometrii, otworów, karbów, kontaktów, plastyczności, wyboczenia ani dużych przemieszczeń.',
      'Wynik jest walidowany rozwiązaniem analitycznym tego samego przypadku, ale nie zastępuje analizy dowolnej bryły 3D.',
    ],
  };
}
