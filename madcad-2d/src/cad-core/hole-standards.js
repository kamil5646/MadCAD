const SIZE_ROWS = [
  ['M2', 2, 0.4, [0.25, 0.4], [2.2, 2.4, 2.6]],
  ['M2.5', 2.5, 0.45, [0.35, 0.45], [2.7, 2.9, 3.1]],
  ['M3', 3, 0.5, [0.35, 0.5], [3.2, 3.4, 3.6]],
  ['M3.5', 3.5, 0.6, [0.35, 0.6], [3.7, 3.9, 4.2]],
  ['M4', 4, 0.7, [0.5, 0.7], [4.3, 4.5, 4.8]],
  ['M5', 5, 0.8, [0.5, 0.8], [5.3, 5.5, 5.8]],
  ['M6', 6, 1, [0.5, 0.75, 1], [6.4, 6.6, 7]],
  ['M8', 8, 1.25, [0.75, 1, 1.25], [8.4, 9, 10]],
  ['M10', 10, 1.5, [0.75, 1, 1.25, 1.5], [10.5, 11, 12]],
  ['M12', 12, 1.75, [1, 1.25, 1.5, 1.75], [13, 13.5, 14.5]],
  ['M14', 14, 2, [1, 1.25, 1.5, 2], [15, 15.5, 16.5]],
  ['M16', 16, 2, [1, 1.5, 2], [17, 17.5, 18.5]],
  ['M18', 18, 2.5, [1, 1.5, 2, 2.5], [19, 20, 21]],
  ['M20', 20, 2.5, [1, 1.5, 2, 2.5], [21, 22, 24]],
  ['M22', 22, 2.5, [1, 1.5, 2, 2.5], [23, 24, 26]],
  ['M24', 24, 3, [1, 1.5, 2, 3], [25, 26, 28]],
];

export const ISO_METRIC_THREAD_SIZES = Object.freeze(SIZE_ROWS.map(([id, nominalDiameter, coarsePitch, pitches, clearance]) => Object.freeze({
  id,
  nominalDiameter,
  coarsePitch,
  pitches: Object.freeze([...pitches]),
  clearance: Object.freeze({ fine: clearance[0], medium: clearance[1], coarse: clearance[2] }),
})));

export const ISO_CLEARANCE_CLASSES = Object.freeze(['fine', 'medium', 'coarse']);
export const ISO_INTERNAL_THREAD_CLASSES = Object.freeze(['5H', '6H', '7H']);

export function findMetricThreadSize(sizeId) {
  return ISO_METRIC_THREAD_SIZES.find((size) => size.id === sizeId) || null;
}

function numberText(value) {
  return String(Number(Number(value).toFixed(3)));
}

export function metricTapDrillDiameter(sizeId, pitch) {
  const size = findMetricThreadSize(sizeId);
  const numericPitch = Number(pitch);
  if (!size || !size.pitches.includes(numericPitch)) throw new Error('Nieobsługiwany rozmiar albo skok gwintu metrycznego.');
  return Number((size.nominalDiameter - numericPitch).toFixed(3));
}

export function applyHoleStandard(command, application, sizeId = command.standardSize || 'M6', requestedPitch) {
  if (application === 'custom') {
    return { holeStandard: 'custom', holeApplication: 'custom' };
  }
  const size = findMetricThreadSize(sizeId);
  if (!size) throw new Error(`Nieobsługiwany rozmiar gwintu: ${sizeId}.`);
  if (application.startsWith('clearance-')) {
    const clearanceClass = application.slice('clearance-'.length);
    if (!ISO_CLEARANCE_CLASSES.includes(clearanceClass)) throw new Error(`Nieobsługiwana seria otworu przejściowego: ${clearanceClass}.`);
    return {
      holeStandard: 'iso-273',
      holeApplication: 'clearance',
      standardSize: size.id,
      clearanceClass,
      diameter: numberText(size.clearance[clearanceClass]),
      threadMode: 'none',
      clearanceProfile: 'nominal',
      clearance: '0',
    };
  }
  if (application !== 'tapped') throw new Error(`Nieobsługiwane zastosowanie otworu: ${application}.`);
  const pitch = size.pitches.includes(Number(requestedPitch)) ? Number(requestedPitch) : size.coarsePitch;
  return {
    holeStandard: 'iso-metric',
    holeApplication: 'tapped',
    standardSize: size.id,
    clearanceClass: command.clearanceClass || 'medium',
    diameter: numberText(metricTapDrillDiameter(size.id, pitch)),
    threadMode: command.threadMode === 'modeled' ? 'modeled' : 'cosmetic',
    threadDiameter: numberText(size.nominalDiameter),
    threadPitch: numberText(pitch),
    threadClass: ISO_INTERNAL_THREAD_CLASSES.includes(command.threadClass) ? command.threadClass : '6H',
    threadDesignation: `${size.id}×${numberText(pitch)}`,
    clearanceProfile: 'nominal',
    clearance: '0',
  };
}

export function validateHoleStandard(feature) {
  const standard = feature.holeStandard || 'custom';
  if (standard === 'custom') return [];
  const errors = [];
  const size = findMetricThreadSize(feature.standardSize);
  if (!size) errors.push({ field: 'standardSize', message: 'Nieobsługiwany rozmiar standardowego otworu.' });
  if ((feature.clearanceProfile || 'nominal') !== 'nominal') errors.push({ field: 'clearanceProfile', message: 'Standardowy otwór nie może jednocześnie używać korekty FFF.' });
  if (standard === 'iso-273') {
    if (feature.holeApplication !== 'clearance') errors.push({ field: 'holeApplication', message: 'ISO 273 wymaga zastosowania przejściowego.' });
    if (!ISO_CLEARANCE_CLASSES.includes(feature.clearanceClass)) errors.push({ field: 'clearanceClass', message: 'Nieobsługiwana seria luzu ISO 273.' });
    const expectedDiameter = size?.clearance?.[feature.clearanceClass];
    if (expectedDiameter !== undefined && Math.abs(Number(feature.diameter) - expectedDiameter) > 1e-9) errors.push({ field: 'diameter', message: `Średnica ${size.id} nie odpowiada wybranej serii ISO 273.` });
  } else if (standard === 'iso-metric') {
    if (feature.holeApplication !== 'tapped') errors.push({ field: 'holeApplication', message: 'Gwint ISO metryczny wymaga otworu gwintowanego.' });
    if (!ISO_INTERNAL_THREAD_CLASSES.includes(feature.threadClass)) errors.push({ field: 'threadClass', message: 'Nieobsługiwana klasa tolerancji gwintu wewnętrznego.' });
    if (size && !size.pitches.includes(Number(feature.threadPitch))) errors.push({ field: 'threadPitch', message: `Skok nie należy do profilu ${size.id}.` });
    if (size && Math.abs(Number(feature.threadDiameter) - size.nominalDiameter) > 1e-9) errors.push({ field: 'threadDiameter', message: `Średnica gwintu nie odpowiada profilowi ${size.id}.` });
    if (size && size.pitches.includes(Number(feature.threadPitch)) && Math.abs(Number(feature.diameter) - metricTapDrillDiameter(size.id, feature.threadPitch)) > 1e-9) errors.push({ field: 'diameter', message: `Średnica wiertła nie odpowiada profilowi ${size.id}.` });
    if (size && size.pitches.includes(Number(feature.threadPitch)) && feature.threadDesignation !== `${size.id}×${numberText(feature.threadPitch)}`) errors.push({ field: 'threadDesignation', message: 'Oznaczenie gwintu nie odpowiada wybranemu rozmiarowi i skokowi.' });
  } else errors.push({ field: 'holeStandard', message: `Nieobsługiwany standard otworu: ${standard}.` });
  return errors;
}
