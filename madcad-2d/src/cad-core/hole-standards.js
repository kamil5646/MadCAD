const SIZE_ROWS = [
  ['M1', 1, 0.25, [0.2, 0.25]], ['M1.1', 1.1, 0.25, [0.2, 0.25]], ['M1.2', 1.2, 0.25, [0.2, 0.25]],
  ['M1.4', 1.4, 0.3, [0.2, 0.3]], ['M1.6', 1.6, 0.35, [0.2, 0.35]], ['M1.8', 1.8, 0.35, [0.2, 0.35]],
  ['M2', 2, 0.4, [0.25, 0.4], [2.2, 2.4, 2.6]], ['M2.2', 2.2, 0.45, [0.25, 0.45]],
  ['M2.5', 2.5, 0.45, [0.35, 0.45], [2.7, 2.9, 3.1]], ['M3', 3, 0.5, [0.35, 0.5], [3.2, 3.4, 3.6]],
  ['M3.5', 3.5, 0.6, [0.35, 0.6], [3.7, 3.9, 4.2]], ['M4', 4, 0.7, [0.5, 0.7], [4.3, 4.5, 4.8]],
  ['M4.5', 4.5, 0.75, [0.5, 0.75]], ['M5', 5, 0.8, [0.5, 0.8], [5.3, 5.5, 5.8]],
  ['M6', 6, 1, [0.5, 0.75, 1], [6.4, 6.6, 7]], ['M7', 7, 1, [0.75, 1]],
  ['M8', 8, 1.25, [0.75, 1, 1.25], [8.4, 9, 10]], ['M9', 9, 1.25, [0.75, 1, 1.25]],
  ['M10', 10, 1.5, [0.75, 1, 1.25, 1.5], [10.5, 11, 12]], ['M11', 11, 1.5, [0.75, 1, 1.5]],
  ['M12', 12, 1.75, [1, 1.25, 1.5, 1.75], [13, 13.5, 14.5]], ['M14', 14, 2, [1, 1.25, 1.5, 2], [15, 15.5, 16.5]],
  ['M15', 15, 1.5, [1, 1.5]], ['M16', 16, 2, [1, 1.5, 2], [17, 17.5, 18.5]],
  ['M18', 18, 2.5, [1, 1.5, 2, 2.5], [19, 20, 21]], ['M20', 20, 2.5, [1, 1.5, 2, 2.5], [21, 22, 24]],
  ['M22', 22, 2.5, [1, 1.5, 2, 2.5], [23, 24, 26]], ['M24', 24, 3, [1, 1.5, 2, 3], [25, 26, 28]],
  ['M27', 27, 3, [1, 1.5, 2, 3]], ['M30', 30, 3.5, [1, 1.5, 2, 3.5]], ['M33', 33, 3.5, [1.5, 2, 3, 3.5]],
  ['M36', 36, 4, [1.5, 2, 3, 4]], ['M39', 39, 4, [1.5, 2, 3, 4]], ['M42', 42, 4.5, [1.5, 2, 3, 4, 4.5]],
  ['M45', 45, 4.5, [1.5, 2, 3, 4.5]], ['M48', 48, 5, [1.5, 2, 3, 4, 5]], ['M52', 52, 5, [1.5, 2, 3, 4, 5]],
  ['M56', 56, 5.5, [1.5, 2, 3, 4, 5.5]],
];

export const ISO_METRIC_THREAD_SIZES = Object.freeze(SIZE_ROWS.map(([id, nominalDiameter, coarsePitch, pitches, clearance]) => Object.freeze({
  id, nominalDiameter, coarsePitch, pitches: Object.freeze([...pitches]),
  clearance: clearance ? Object.freeze({ fine: clearance[0], medium: clearance[1], coarse: clearance[2] }) : null,
})));
export const ISO_CLEARANCE_THREAD_SIZES = Object.freeze(ISO_METRIC_THREAD_SIZES.filter((size) => size.clearance));
export const ISO_CLEARANCE_CLASSES = Object.freeze(['fine', 'medium', 'coarse']);
export const ISO_INTERNAL_THREAD_CLASSES = Object.freeze(['5H', '6H', '7H']);

const NPT_ROWS = [
  ['1/16', 7.9, 27, 6.15, 6.39, 9.29, 10.7], ['1/8', 10.24, 27, 8.4, 8.74, 9.32, 10.8],
  ['1/4', 13.62, 18, 11.1, 11.36, 13.52, 15.6], ['3/8', 17.06, 18, 14.3, 14.8, 13.83, 16],
  ['1/2', 21.22, 14, 17.9, 18.32, 18.07, 20.8], ['3/4', 26.57, 14, 23.3, 23.67, 18.55, 21.3],
  ['1', 33.23, 11.5, 29, 29.69, 22.29, 25.6], ['1 1/4', 41.99, 11.5, 37.7, 38.45, 22.8, 26.1],
  ['1 1/2', 48.05, 11.5, 43.7, 44.52, 22.8, 26.1], ['2', 60.09, 11.5, 55.6, 56.56, 23.2, 26.5],
  ['2 1/2', 72.7, 8, 66.3, 67.62, 31.75, 36.3], ['3', 88.61, 8, 82.3, 83.52, 33.74, 38.5],
];
const BSPT_ROWS = [
  ['1/8', 9.73, 28, 8.4], ['1/4', 13.16, 19, 11.2], ['3/8', 16.66, 19, 14.8],
  ['1/2', 20.96, 14, 18.3], ['3/4', 26.44, 14, 23.8], ['1', 33.25, 11, 30],
  ['1 1/4', 41.91, 11, 38.5], ['1 1/2', 47.8, 11, 44.5], ['2', 59.61, 11, 56],
  ['2 1/2', 75.18, 11, 71.4], ['3', 87.88, 11, 84],
];

function pipeSize(family, row) {
  const [nominal, majorDiameter, tpi, cylindricalDrill, conicalDrill = cylindricalDrill, recommendedThreadLength = null, minimumBottomDepth = null] = row;
  return Object.freeze({
    id: `${family}-${nominal.replaceAll(' ', '_').replace('/', '-')}`, family, nominal, majorDiameter, tpi,
    pitch: Number((25.4 / tpi).toFixed(6)), cylindricalDrill, conicalDrill, recommendedThreadLength, minimumBottomDepth,
    taper: 1 / 16, profileAngle: family === 'npt' ? 60 : 55,
  });
}

export const NPT_THREAD_SIZES = Object.freeze(NPT_ROWS.map((row) => pipeSize('npt', row)));
export const BSPT_THREAD_SIZES = Object.freeze(BSPT_ROWS.map((row) => pipeSize('bspt', row)));
export const PIPE_THREAD_SIZES = Object.freeze([...NPT_THREAD_SIZES, ...BSPT_THREAD_SIZES]);

export function findMetricThreadSize(sizeId) {
  return ISO_METRIC_THREAD_SIZES.find((size) => size.id === sizeId) || null;
}

export function findPipeThreadSize(sizeId, family) {
  return PIPE_THREAD_SIZES.find((size) => size.id === sizeId && (!family || size.family === family)) || null;
}

function numberText(value, precision = 3) {
  return String(Number(Number(value).toFixed(precision)));
}

export function metricTapDrillDiameter(sizeId, pitch) {
  const size = findMetricThreadSize(sizeId);
  const numericPitch = Number(pitch);
  if (!size || !size.pitches.includes(numericPitch)) throw new Error('Nieobsługiwany rozmiar albo skok gwintu metrycznego.');
  return Number((size.nominalDiameter - numericPitch).toFixed(3));
}

function toleranceFields(command) {
  return { diameterToleranceLower: command.diameterToleranceLower ?? '', diameterToleranceUpper: command.diameterToleranceUpper ?? '' };
}

function applyPipeThreadStandard(command, family, sizeId) {
  const sizes = family === 'npt' ? NPT_THREAD_SIZES : BSPT_THREAD_SIZES;
  const size = findPipeThreadSize(sizeId, family) || sizes[family === 'npt' ? 1 : 0];
  const pipePreparation = command.pipePreparation === 'cylindrical' ? 'cylindrical' : 'conical';
  const isNpt = family === 'npt';
  return {
    holeStandard: isNpt ? 'asme-b1.20.1' : 'iso-7-1', holeApplication: `${family}-tapped`, standardSize: size.id,
    clearanceClass: command.clearanceClass || 'medium', diameter: numberText(pipePreparation === 'conical' ? size.conicalDrill : size.cylindricalDrill),
    pipePreparation, threadMode: command.threadMode === 'modeled' ? 'modeled' : 'cosmetic', threadDiameter: numberText(size.majorDiameter),
    threadPitch: numberText(size.pitch, 6), threadTaper: numberText(size.taper, 6), threadProfileAngle: numberText(size.profileAngle),
    threadClass: '', threadInspection: isNpt ? 'sprawdzian ASME B1.20.1' : 'sprawdzian ISO 7-2',
    threadDesignation: isNpt ? `${size.nominal}-${numberText(size.tpi)} NPT` : `Rc ${size.nominal}`,
    extent: 'distance', depth: size.minimumBottomDepth ? numberText(size.minimumBottomDepth) : (command.depth || '10'),
    threadLength: size.recommendedThreadLength ? numberText(size.recommendedThreadLength) : (command.threadLength || '10'),
    clearanceProfile: 'nominal', clearance: '0', ...toleranceFields(command),
  };
}

export function applyHoleStandard(command, application, sizeId = command.standardSize || 'M6', requestedPitch) {
  if (application === 'custom') return { holeStandard: 'custom', holeApplication: 'custom', threadTaper: '0', threadProfileAngle: '60' };
  if (application === 'npt-tapped') return applyPipeThreadStandard(command, 'npt', sizeId);
  if (application === 'bspt-tapped') return applyPipeThreadStandard(command, 'bspt', sizeId);
  const size = findMetricThreadSize(sizeId) || (findPipeThreadSize(sizeId) ? findMetricThreadSize('M6') : null);
  if (!size) throw new Error(`Nieobsługiwany rozmiar gwintu: ${sizeId}.`);
  if (application.startsWith('clearance-')) {
    const clearanceClass = application.slice('clearance-'.length);
    if (!ISO_CLEARANCE_CLASSES.includes(clearanceClass)) throw new Error(`Nieobsługiwana seria otworu przejściowego: ${clearanceClass}.`);
    if (!size.clearance) throw new Error(`Rozmiar ${size.id} nie ma wbudowanych danych ISO 273.`);
    return { holeStandard: 'iso-273', holeApplication: 'clearance', standardSize: size.id, clearanceClass,
      diameter: numberText(size.clearance[clearanceClass]), threadMode: 'none', threadTaper: '0', clearanceProfile: 'nominal', clearance: '0', ...toleranceFields(command) };
  }
  if (application !== 'tapped') throw new Error(`Nieobsługiwane zastosowanie otworu: ${application}.`);
  const pitch = size.pitches.includes(Number(requestedPitch)) ? Number(requestedPitch) : size.coarsePitch;
  return {
    holeStandard: 'iso-metric', holeApplication: 'tapped', standardSize: size.id, clearanceClass: command.clearanceClass || 'medium',
    diameter: numberText(metricTapDrillDiameter(size.id, pitch)), threadMode: command.threadMode === 'modeled' ? 'modeled' : 'cosmetic',
    threadDiameter: numberText(size.nominalDiameter), threadPitch: numberText(pitch), threadTaper: '0', threadProfileAngle: '60',
    threadClass: ISO_INTERNAL_THREAD_CLASSES.includes(command.threadClass) ? command.threadClass : '6H', threadInspection: '',
    threadDesignation: `${size.id}×${numberText(pitch)}`, clearanceProfile: 'nominal', clearance: '0', ...toleranceFields(command),
  };
}

function validateManufacturingTolerance(feature, errors) {
  const hasLower = feature.diameterToleranceLower !== undefined && String(feature.diameterToleranceLower).trim() !== '';
  const hasUpper = feature.diameterToleranceUpper !== undefined && String(feature.diameterToleranceUpper).trim() !== '';
  if (hasLower !== hasUpper) errors.push({ field: hasLower ? 'diameterToleranceUpper' : 'diameterToleranceLower', message: 'Podaj obie odchyłki średnicy albo pozostaw obie puste.' });
  if (hasLower && hasUpper && Number.isFinite(Number(feature.diameterToleranceLower)) && Number.isFinite(Number(feature.diameterToleranceUpper)) && Number(feature.diameterToleranceLower) > Number(feature.diameterToleranceUpper)) errors.push({ field: 'diameterToleranceLower', message: 'Dolna odchyłka średnicy nie może być większa od górnej.' });
}

export function validateHoleStandard(feature) {
  const standard = feature.holeStandard || 'custom';
  const errors = [];
  validateManufacturingTolerance(feature, errors);
  if (standard === 'custom') return errors;
  if ((feature.clearanceProfile || 'nominal') !== 'nominal') errors.push({ field: 'clearanceProfile', message: 'Standardowy otwór nie może jednocześnie używać korekty FFF.' });
  if (standard === 'asme-b1.20.1' || standard === 'iso-7-1') {
    const family = standard === 'asme-b1.20.1' ? 'npt' : 'bspt';
    const size = findPipeThreadSize(feature.standardSize, family);
    if (!size) errors.push({ field: 'standardSize', message: 'Nieobsługiwany rozmiar gwintu rurowego.' });
    if (feature.holeApplication !== `${family}-tapped`) errors.push({ field: 'holeApplication', message: 'Rodzina gwintu rurowego nie odpowiada wybranemu standardowi.' });
    if (!['conical', 'cylindrical'].includes(feature.pipePreparation)) errors.push({ field: 'pipePreparation', message: 'Wybierz stożkowe albo walcowe przygotowanie otworu.' });
    if (feature.extent !== 'distance') errors.push({ field: 'extent', message: 'Gwint stożkowy wymaga jawnej głębokości otworu.' });
    if (size) {
      const expectedDrill = feature.pipePreparation === 'cylindrical' ? size.cylindricalDrill : size.conicalDrill;
      if (Math.abs(Number(feature.diameter) - expectedDrill) > 1e-9) errors.push({ field: 'diameter', message: 'Średnica przygotowania nie odpowiada wybranemu rozmiarowi i metodzie.' });
      if (Math.abs(Number(feature.threadDiameter) - size.majorDiameter) > 1e-9) errors.push({ field: 'threadDiameter', message: 'Średnica nominalna gwintu rurowego jest niespójna.' });
      if (Math.abs(Number(feature.threadPitch) - Number(numberText(size.pitch, 6))) > 1e-9) errors.push({ field: 'threadPitch', message: 'Liczba zwojów na cal nie odpowiada wybranemu rozmiarowi.' });
      if (Math.abs(Number(feature.threadTaper) - size.taper) > 1e-9) errors.push({ field: 'threadTaper', message: 'Gwint rurowy wymaga stożka 1:16.' });
      const expectedDesignation = family === 'npt' ? `${size.nominal}-${numberText(size.tpi)} NPT` : `Rc ${size.nominal}`;
      if (feature.threadDesignation !== expectedDesignation) errors.push({ field: 'threadDesignation', message: 'Oznaczenie gwintu rurowego jest niespójne.' });
    }
    return errors;
  }
  const size = findMetricThreadSize(feature.standardSize);
  if (!size) errors.push({ field: 'standardSize', message: 'Nieobsługiwany rozmiar standardowego otworu.' });
  if (standard === 'iso-273') {
    if (feature.holeApplication !== 'clearance') errors.push({ field: 'holeApplication', message: 'ISO 273 wymaga zastosowania przejściowego.' });
    if (!ISO_CLEARANCE_CLASSES.includes(feature.clearanceClass)) errors.push({ field: 'clearanceClass', message: 'Nieobsługiwana seria luzu ISO 273.' });
    const expectedDiameter = size?.clearance?.[feature.clearanceClass];
    if (expectedDiameter === undefined) errors.push({ field: 'standardSize', message: 'Wybrany rozmiar nie ma wbudowanej wartości ISO 273.' });
    else if (Math.abs(Number(feature.diameter) - expectedDiameter) > 1e-9) errors.push({ field: 'diameter', message: `Średnica ${size.id} nie odpowiada wybranej serii ISO 273.` });
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
