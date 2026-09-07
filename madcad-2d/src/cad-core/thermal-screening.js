export const THERMAL_MATERIALS = Object.freeze({
  s235: Object.freeze({ id: 's235', name: 'Stal konstrukcyjna', conductivity: 50, expansion: 12e-6, maxServiceTemperature: 250 }),
  s355: Object.freeze({ id: 's355', name: 'Stal S355', conductivity: 50, expansion: 12e-6, maxServiceTemperature: 300 }),
  aluminum6061: Object.freeze({ id: 'aluminum6061', name: 'Aluminium 6061-T6', conductivity: 167, expansion: 23.6e-6, maxServiceTemperature: 150 }),
  abs: Object.freeze({ id: 'abs', name: 'ABS — orientacyjnie', conductivity: 0.18, expansion: 90e-6, maxServiceTemperature: 80 }),
  petg: Object.freeze({ id: 'petg', name: 'PETG — orientacyjnie', conductivity: 0.20, expansion: 68e-6, maxServiceTemperature: 70 }),
});

const AXIS_INDEX = Object.freeze({ x: 0, y: 1, z: 2 });

export function calculateThermalScreening(body, options = {}) {
  const material = THERMAL_MATERIALS[options.materialId || 's235'];
  if (!material) throw new Error('Wybierz obsługiwany materiał.');
  if (body?.bodyKind === 'surface') throw new Error('Analiza wymaga bryły, nie powierzchni.');
  const bounds = body?.metrics?.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 2 || !bounds.every((point) => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite))) throw new Error('Bryła nie ma poprawnych wymiarów granicznych.');
  const axis = String(options.axis || 'x').toLowerCase();
  if (!(axis in AXIS_INDEX)) throw new Error('Wybierz poprawny kierunek przepływu ciepła.');
  const hotTemperature = Number(options.hotTemperature);
  const coldTemperature = Number(options.coldTemperature);
  if (![hotTemperature, coldTemperature].every(Number.isFinite)) throw new Error('Temperatury muszą być liczbami.');
  if (hotTemperature < -273.15 || coldTemperature < -273.15) throw new Error('Temperatura nie może być niższa od zera bezwzględnego.');
  if (hotTemperature === coldTemperature) throw new Error('Strony ciepła i chłodu muszą mieć różne temperatury.');
  const dimensions = bounds[1].map((value, index) => value - bounds[0][index]);
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Bryła musi mieć trzy dodatnie wymiary.');
  const axisIndex = AXIS_INDEX[axis];
  const areaAxes = [0, 1, 2].filter((index) => index !== axisIndex);
  const pathLength = dimensions[axisIndex];
  const area = dimensions[areaAxes[0]] * dimensions[areaAxes[1]];
  const deltaTemperature = Math.abs(hotTemperature - coldTemperature);
  const thermalResistance = (pathLength / 1000) / (material.conductivity * area / 1e6);
  const heatFlow = deltaTemperature / thermalResistance;
  const heatFlux = heatFlow / (area / 1e6);
  const freeExpansion = material.expansion * deltaTemperature * pathLength;
  const maximumTemperature = Math.max(hotTemperature, coldTemperature);
  return {
    bodyId: body.id,
    material,
    axis,
    dimensions,
    pathLength,
    area,
    hotTemperature,
    coldTemperature,
    deltaTemperature,
    thermalResistance,
    heatFlow,
    heatFlux,
    freeExpansion,
    maximumTemperature,
    status: maximumTemperature <= material.maxServiceTemperature ? 'safe' : 'warning',
    limitations: [
      'Model jednowymiarowego, ustalonego przewodzenia przez pełny przekrój wyznaczony z obwiedni bryły.',
      'Nie uwzględnia otworów, kontaktów, konwekcji, promieniowania, źródeł ciepła ani zmian właściwości materiału.',
      'Wynik służy do wstępnego porównania wariantów, nie zastępuje walidowanej analizy termicznej MES.',
    ],
  };
}
