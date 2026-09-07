export const ENGINEERING_MATERIALS = Object.freeze({
  s235: Object.freeze({ id: 's235', name: 'Stal S235', elasticModulus: 210000, yieldStrength: 235, density: 7.85 }),
  s355: Object.freeze({ id: 's355', name: 'Stal S355', elasticModulus: 210000, yieldStrength: 355, density: 7.85 }),
  aluminum6061: Object.freeze({ id: 'aluminum6061', name: 'Aluminium 6061-T6', elasticModulus: 69000, yieldStrength: 276, density: 2.70 }),
  abs: Object.freeze({ id: 'abs', name: 'ABS — orientacyjnie', elasticModulus: 2100, yieldStrength: 35, density: 1.04 }),
  petg: Object.freeze({ id: 'petg', name: 'PETG — orientacyjnie', elasticModulus: 2000, yieldStrength: 45, density: 1.27 }),
});

const AXIS_INDEX = Object.freeze({ x: 0, y: 1, z: 2 });

export function calculateCantileverScreening(body, options = {}) {
  const material = ENGINEERING_MATERIALS[options.materialId || 's235'];
  if (!material) throw new Error('Wybierz obsługiwany materiał.');
  if (body?.bodyKind === 'surface') throw new Error('Analiza wymaga bryły, nie powierzchni.');
  const bounds = body?.metrics?.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 2 || !bounds.every((point) => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite))) throw new Error('Bryła nie ma poprawnych wymiarów granicznych.');
  const spanAxis = String(options.spanAxis || 'x').toLowerCase();
  const loadAxis = String(options.loadAxis || 'z').toLowerCase();
  if (!(spanAxis in AXIS_INDEX) || !(loadAxis in AXIS_INDEX) || spanAxis === loadAxis) throw new Error('Oś długości i kierunek siły muszą być różne.');
  const force = Number(options.force);
  if (!Number.isFinite(force) || force <= 0 || force > 1e9) throw new Error('Siła musi być dodatnia i nie większa niż 1 GN.');
  const dimensions = bounds[1].map((value, axis) => value - bounds[0][axis]);
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Bryła musi mieć trzy dodatnie wymiary.');
  const spanIndex = AXIS_INDEX[spanAxis];
  const loadIndex = AXIS_INDEX[loadAxis];
  const widthIndex = [0, 1, 2].find((axis) => axis !== spanIndex && axis !== loadIndex);
  const length = dimensions[spanIndex];
  const sectionHeight = dimensions[loadIndex];
  const sectionWidth = dimensions[widthIndex];
  const secondMoment = sectionWidth * sectionHeight ** 3 / 12;
  const bendingMoment = force * length;
  const maximumStress = bendingMoment * sectionHeight / 2 / secondMoment;
  const tipDeflection = force * length ** 3 / (3 * material.elasticModulus * secondMoment);
  const safetyFactor = maximumStress > 0 ? material.yieldStrength / maximumStress : Infinity;
  const volume = Number(body.metrics?.volume);
  const mass = Number.isFinite(volume) && volume >= 0 ? volume / 1000 * material.density : null;
  const slenderness = length / Math.min(sectionWidth, sectionHeight);
  return {
    bodyId: body.id,
    material,
    force,
    spanAxis,
    loadAxis,
    fixedEnd: options.fixedEnd === 'max' ? 'max' : 'min',
    dimensions,
    length,
    sectionWidth,
    sectionHeight,
    secondMoment,
    maximumStress,
    tipDeflection,
    safetyFactor,
    mass,
    slenderness,
    status: safetyFactor >= 2 ? 'safe' : safetyFactor >= 1 ? 'warning' : 'failed',
    limitations: [
      'Model belki wspornikowej o stałym, prostokątnym przekroju wyznaczonym z obwiedni bryły.',
      'Nie uwzględnia otworów, karbów, kontaktów, plastyczności, wyboczenia ani anizotropii druku 3D.',
      slenderness < 5 ? 'Bryła jest krótka względem przekroju; teoria belkowa może istotnie zaniżać ugięcie.' : 'Wynik służy do wstępnego doboru, nie do odbioru konstrukcji.',
    ],
  };
}
