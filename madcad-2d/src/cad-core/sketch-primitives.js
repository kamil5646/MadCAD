import {
  createSketchArc,
  createSketchCircleEntity,
  createSketchEntity,
  createSketchLine,
  createSketchPoint,
} from './sketch-model.js';

const EPSILON = 1e-7;

function point(value) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((coordinate) => !Number.isFinite(Number(coordinate)))) throw new Error('Figura wymaga punktu [x, y].');
  return value.map(Number);
}

function distance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function requireLength(value, label) {
  const number = Number(value);
  if (!(number > EPSILON)) throw new Error(`${label} musi być większe od zera.`);
  return number;
}

function pointEntity(coordinate) {
  return createSketchPoint({ x: coordinate[0].toFixed(6), y: coordinate[1].toFixed(6) });
}

function closedLines(coordinates) {
  const points = coordinates.map(pointEntity);
  const lines = points.map((entry, index) => createSketchLine({ startPointId: entry.id, endPointId: points[(index + 1) % points.length].id }));
  return { points, curves: lines, entities: [...points, ...lines] };
}

export function arcThroughThreePoints(startValue, middleValue, endValue) {
  const start = point(startValue);
  const middle = point(middleValue);
  const end = point(endValue);
  const determinant = 2 * (start[0] * (middle[1] - end[1]) + middle[0] * (end[1] - start[1]) + end[0] * (start[1] - middle[1]));
  if (Math.abs(determinant) <= EPSILON) throw new Error('Trzy punkty łuku nie mogą być współliniowe.');
  const startSquared = (start[0] ** 2) + (start[1] ** 2);
  const middleSquared = (middle[0] ** 2) + (middle[1] ** 2);
  const endSquared = (end[0] ** 2) + (end[1] ** 2);
  const center = [
    (startSquared * (middle[1] - end[1]) + middleSquared * (end[1] - start[1]) + endSquared * (start[1] - middle[1])) / determinant,
    (startSquared * (end[0] - middle[0]) + middleSquared * (start[0] - end[0]) + endSquared * (middle[0] - start[0])) / determinant,
  ];
  const cross = ((middle[0] - start[0]) * (end[1] - middle[1])) - ((middle[1] - start[1]) * (end[0] - middle[0]));
  return arcCenterStartEnd(center, start, end, cross >= 0 ? 'ccw' : 'cw');
}

export function arcCenterStartEnd(centerValue, startValue, endValue, direction = 'ccw') {
  const centerCoordinate = point(centerValue);
  const startCoordinate = point(startValue);
  const endCoordinate = point(endValue);
  const radius = distance(centerCoordinate, startCoordinate);
  if (!(radius > EPSILON) || Math.abs(distance(centerCoordinate, endCoordinate) - radius) > 1e-5) throw new Error('Początek i koniec łuku muszą leżeć na tym samym promieniu.');
  const center = pointEntity(centerCoordinate);
  const start = pointEntity(startCoordinate);
  const end = pointEntity(endCoordinate);
  const arc = createSketchArc({ centerPointId: center.id, startPointId: start.id, endPointId: end.id, direction });
  return { points: [center, start, end], curves: [arc], entities: [center, start, end, arc] };
}

export function rectangleTwoPoints(firstValue, oppositeValue) {
  const first = point(firstValue);
  const opposite = point(oppositeValue);
  if (distance(first, opposite) <= EPSILON) throw new Error('Prostokąt wymaga dwóch różnych narożników.');
  return closedLines([first, [opposite[0], first[1]], opposite, [first[0], opposite[1]]]);
}

export function rectangleFromCenter(centerValue, widthValue, heightValue, rotationDegrees = 0) {
  const center = point(centerValue);
  const width = requireLength(widthValue, 'Szerokość');
  const height = requireLength(heightValue, 'Wysokość');
  const angle = Number(rotationDegrees) * Math.PI / 180;
  const ux = [Math.cos(angle), Math.sin(angle)];
  const uy = [-Math.sin(angle), Math.cos(angle)];
  const corner = (xSign, ySign) => [
    center[0] + (xSign * ux[0] * width / 2) + (ySign * uy[0] * height / 2),
    center[1] + (xSign * ux[1] * width / 2) + (ySign * uy[1] * height / 2),
  ];
  return closedLines([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]);
}

export function rectangleThreePoints(firstValue, secondValue, thirdValue) {
  const first = point(firstValue);
  const second = point(secondValue);
  const third = point(thirdValue);
  const width = requireLength(distance(first, second), 'Pierwszy bok');
  const unit = [(second[0] - first[0]) / width, (second[1] - first[1]) / width];
  const normal = [-unit[1], unit[0]];
  const height = ((third[0] - first[0]) * normal[0]) + ((third[1] - first[1]) * normal[1]);
  if (Math.abs(height) <= EPSILON) throw new Error('Trzeci punkt musi wyznaczać wysokość prostokąta.');
  const offset = [normal[0] * height, normal[1] * height];
  return closedLines([first, second, [second[0] + offset[0], second[1] + offset[1]], [first[0] + offset[0], first[1] + offset[1]]]);
}

export function circleCenterRadius(centerValue, radiusValue) {
  const centerCoordinate = point(centerValue);
  const radius = requireLength(radiusValue, 'Promień');
  const center = pointEntity(centerCoordinate);
  const circle = createSketchCircleEntity({ centerPointId: center.id, radius: radius.toFixed(6) });
  return { points: [center], curves: [circle], entities: [center, circle] };
}

export function circleTwoPoints(firstValue, secondValue) {
  const first = point(firstValue);
  const second = point(secondValue);
  return circleCenterRadius([(first[0] + second[0]) / 2, (first[1] + second[1]) / 2], requireLength(distance(first, second), 'Średnica') / 2);
}

export function circleThreePoints(firstValue, secondValue, thirdValue) {
  const arc = arcThroughThreePoints(firstValue, secondValue, thirdValue);
  const [center, start] = arc.points;
  return circleCenterRadius([Number(center.geometry.x), Number(center.geometry.y)], distance([Number(center.geometry.x), Number(center.geometry.y)], [Number(start.geometry.x), Number(start.geometry.y)]));
}

export function regularPolygon({ center: centerValue, radius: radiusValue, sides = 6, rotation = 0, circumscribed = false } = {}) {
  const center = point(centerValue);
  const count = Math.max(3, Math.min(256, Math.round(Number(sides) || 0)));
  let radius = requireLength(radiusValue, 'Promień wielokąta');
  if (circumscribed) radius /= Math.cos(Math.PI / count);
  const startAngle = Number(rotation) * Math.PI / 180;
  return closedLines(Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (index * Math.PI * 2 / count);
    return [center[0] + (Math.cos(angle) * radius), center[1] + (Math.sin(angle) * radius)];
  }));
}

export function polygonFromEdge(firstValue, secondValue, sides = 6, outward = 1) {
  const first = point(firstValue);
  const second = point(secondValue);
  const count = Math.max(3, Math.min(256, Math.round(Number(sides) || 0)));
  const edge = requireLength(distance(first, second), 'Krawędź wielokąta');
  const radius = edge / (2 * Math.sin(Math.PI / count));
  const midpoint = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
  const unit = [(second[0] - first[0]) / edge, (second[1] - first[1]) / edge];
  const apothem = edge / (2 * Math.tan(Math.PI / count));
  const center = [midpoint[0] - (unit[1] * apothem * Math.sign(outward || 1)), midpoint[1] + (unit[0] * apothem * Math.sign(outward || 1))];
  const rotation = Math.atan2(first[1] - center[1], first[0] - center[0]) * 180 / Math.PI;
  return regularPolygon({ center, radius, sides: count, rotation });
}

export function ellipseFromCenter(centerValue, majorRadiusValue, minorRadiusValue, rotation = 0) {
  const centerCoordinate = point(centerValue);
  const majorRadius = requireLength(majorRadiusValue, 'Promień główny elipsy');
  const minorRadius = requireLength(minorRadiusValue, 'Promień boczny elipsy');
  const center = pointEntity(centerCoordinate);
  const ellipse = createSketchEntity('ellipse', {
    pointIds: [center.id],
    geometry: { majorRadius: String(majorRadius), minorRadius: String(minorRadius), rotation: String(Number(rotation) || 0) },
    expressionKeys: ['majorRadius', 'minorRadius', 'rotation'],
  });
  return { points: [center], curves: [ellipse], entities: [center, ellipse] };
}

function ellipsePoint(center, majorRadius, minorRadius, rotationDegrees, parameterDegrees) {
  const rotation = rotationDegrees * Math.PI / 180;
  const parameter = parameterDegrees * Math.PI / 180;
  const x = Math.cos(parameter) * majorRadius;
  const y = Math.sin(parameter) * minorRadius;
  return [center[0] + (x * Math.cos(rotation)) - (y * Math.sin(rotation)), center[1] + (x * Math.sin(rotation)) + (y * Math.cos(rotation))];
}

export function ellipticalArcFromCenter(centerValue, majorRadiusValue, minorRadiusValue, startAngleValue, endAngleValue, rotationValue = 0, direction = 'ccw') {
  const centerCoordinate = point(centerValue);
  const majorRadius = requireLength(majorRadiusValue, 'Promień główny elipsy');
  const minorRadius = requireLength(minorRadiusValue, 'Promień boczny elipsy');
  const startAngle = Number(startAngleValue);
  const endAngle = Number(endAngleValue);
  const rotation = Number(rotationValue) || 0;
  if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle) || Math.abs(startAngle - endAngle) <= EPSILON) throw new Error('Łuk eliptyczny wymaga dwóch różnych kątów.');
  if (!['cw', 'ccw'].includes(direction)) throw new Error('Kierunek łuku eliptycznego musi mieć wartość cw albo ccw.');
  const center = pointEntity(centerCoordinate);
  const start = pointEntity(ellipsePoint(centerCoordinate, majorRadius, minorRadius, rotation, startAngle));
  const end = pointEntity(ellipsePoint(centerCoordinate, majorRadius, minorRadius, rotation, endAngle));
  const arc = createSketchEntity('ellipticalArc', {
    pointIds: [center.id, start.id, end.id],
    geometry: { majorRadius: String(majorRadius), minorRadius: String(minorRadius), rotation: String(rotation), startAngle: String(startAngle), endAngle: String(endAngle), direction },
    expressionKeys: ['majorRadius', 'minorRadius', 'rotation', 'startAngle', 'endAngle'],
  });
  return { points: [center, start, end], curves: [arc], entities: [center, start, end, arc] };
}

export function slotCenterToCenter(firstCenterValue, secondCenterValue, widthValue) {
  const firstCenter = point(firstCenterValue);
  const secondCenter = point(secondCenterValue);
  const width = requireLength(widthValue, 'Szerokość slotu');
  const centerDistance = requireLength(distance(firstCenter, secondCenter), 'Odległość środków slotu');
  const unit = [(secondCenter[0] - firstCenter[0]) / centerDistance, (secondCenter[1] - firstCenter[1]) / centerDistance];
  const normal = [-unit[1], unit[0]];
  const radius = width / 2;
  const firstTop = [firstCenter[0] + (normal[0] * radius), firstCenter[1] + (normal[1] * radius)];
  const secondTop = [secondCenter[0] + (normal[0] * radius), secondCenter[1] + (normal[1] * radius)];
  const secondBottom = [secondCenter[0] - (normal[0] * radius), secondCenter[1] - (normal[1] * radius)];
  const firstBottom = [firstCenter[0] - (normal[0] * radius), firstCenter[1] - (normal[1] * radius)];
  const points = [firstCenter, secondCenter, firstTop, secondTop, secondBottom, firstBottom].map(pointEntity);
  const [firstCenterPoint, secondCenterPoint, firstTopPoint, secondTopPoint, secondBottomPoint, firstBottomPoint] = points;
  const curves = [
    createSketchLine({ startPointId: firstTopPoint.id, endPointId: secondTopPoint.id }),
    createSketchArc({ centerPointId: secondCenterPoint.id, startPointId: secondTopPoint.id, endPointId: secondBottomPoint.id, direction: 'cw' }),
    createSketchLine({ startPointId: secondBottomPoint.id, endPointId: firstBottomPoint.id }),
    createSketchArc({ centerPointId: firstCenterPoint.id, startPointId: firstBottomPoint.id, endPointId: firstTopPoint.id, direction: 'cw' }),
  ];
  return { points, curves, entities: [...points, ...curves] };
}

export function slotThreePoints(firstCenterValue, secondCenterValue, widthPointValue) {
  const firstCenter = point(firstCenterValue);
  const secondCenter = point(secondCenterValue);
  const widthPoint = point(widthPointValue);
  const centerDistance = requireLength(distance(firstCenter, secondCenter), 'Odległość środków slotu');
  const normal = [-(secondCenter[1] - firstCenter[1]) / centerDistance, (secondCenter[0] - firstCenter[0]) / centerDistance];
  const halfWidth = Math.abs(((widthPoint[0] - firstCenter[0]) * normal[0]) + ((widthPoint[1] - firstCenter[1]) * normal[1]));
  return slotCenterToCenter(firstCenter, secondCenter, requireLength(halfWidth, 'Odległość trzeciego punktu od osi slotu') * 2);
}

export function slotOverall(firstEndValue, secondEndValue, widthValue) {
  const firstEnd = point(firstEndValue);
  const secondEnd = point(secondEndValue);
  const width = requireLength(widthValue, 'Szerokość slotu');
  const overall = requireLength(distance(firstEnd, secondEnd), 'Długość slotu');
  if (overall <= width) throw new Error('Długość całkowita slotu musi być większa od szerokości.');
  const unit = [(secondEnd[0] - firstEnd[0]) / overall, (secondEnd[1] - firstEnd[1]) / overall];
  const firstCenter = [firstEnd[0] + (unit[0] * width / 2), firstEnd[1] + (unit[1] * width / 2)];
  const secondCenter = [secondEnd[0] - (unit[0] * width / 2), secondEnd[1] - (unit[1] * width / 2)];
  return slotCenterToCenter(firstCenter, secondCenter, width);
}

export function slotArc({ center: centerValue, radius: radiusValue, width: widthValue, startAngle: startAngleValue = 0, endAngle: endAngleValue = 90, direction = 'ccw' } = {}) {
  const centerCoordinate = point(centerValue);
  const radius = requireLength(radiusValue, 'Promień osi slotu');
  const width = requireLength(widthValue, 'Szerokość slotu');
  if (width >= radius * 2) throw new Error('Szerokość slotu po łuku musi być mniejsza od jego średnicy osiowej.');
  const startAngle = Number(startAngleValue);
  const endAngle = Number(endAngleValue);
  if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle) || Math.abs(startAngle - endAngle) <= EPSILON) throw new Error('Slot po łuku wymaga dwóch różnych kątów.');
  if (!['cw', 'ccw'].includes(direction)) throw new Error('Kierunek slotu musi mieć wartość cw albo ccw.');
  const polar = (radialDistance, angleDegrees) => {
    const angle = angleDegrees * Math.PI / 180;
    return [centerCoordinate[0] + Math.cos(angle) * radialDistance, centerCoordinate[1] + Math.sin(angle) * radialDistance];
  };
  const halfWidth = width / 2;
  const coordinates = [
    centerCoordinate,
    polar(radius, startAngle),
    polar(radius, endAngle),
    polar(radius + halfWidth, startAngle),
    polar(radius + halfWidth, endAngle),
    polar(radius - halfWidth, endAngle),
    polar(radius - halfWidth, startAngle),
  ];
  const points = coordinates.map(pointEntity);
  const [center, startCapCenter, endCapCenter, outerStart, outerEnd, innerEnd, innerStart] = points;
  const reverseDirection = direction === 'cw' ? 'ccw' : 'cw';
  const curves = [
    createSketchArc({ centerPointId: center.id, startPointId: outerStart.id, endPointId: outerEnd.id, direction }),
    createSketchArc({ centerPointId: endCapCenter.id, startPointId: outerEnd.id, endPointId: innerEnd.id, direction }),
    createSketchArc({ centerPointId: center.id, startPointId: innerEnd.id, endPointId: innerStart.id, direction: reverseDirection }),
    createSketchArc({ centerPointId: startCapCenter.id, startPointId: innerStart.id, endPointId: outerStart.id, direction }),
  ];
  return { points, curves, entities: [...points, ...curves] };
}

function splineFromPoints(pointValues, mode) {
  if (!Array.isArray(pointValues) || pointValues.length < (mode === 'control' ? 3 : 2)) throw new Error(mode === 'control' ? 'Spline kontrolny wymaga co najmniej trzech punktów.' : 'Spline dopasowany wymaga co najmniej dwóch punktów.');
  const points = pointValues.map((coordinate) => pointEntity(point(coordinate)));
  const spline = createSketchEntity('spline', {
    pointIds: points.map((entry) => entry.id),
    geometry: { mode, closed: false },
    expressionKeys: [],
  });
  return { points, curves: [spline], entities: [...points, spline] };
}

export function fitPointSpline(pointValues) {
  return splineFromPoints(pointValues, 'fit');
}

export function controlPointSpline(pointValues) {
  return splineFromPoints(pointValues, 'control');
}

export function conicThroughControlPoint(startValue, controlValue, endValue, rho = 1, continuity = 'free') {
  const weight = Number(rho);
  if (!(weight > 0) || !Number.isFinite(weight)) throw new Error('Parametr rho krzywej conic musi być dodatnią liczbą.');
  if (!['free', 'tangent', 'curvature'].includes(continuity)) throw new Error('Nieobsługiwany tryb ciągłości krzywej conic.');
  const points = [startValue, controlValue, endValue].map((coordinate) => pointEntity(point(coordinate)));
  if (points.some((entry) => !Number.isFinite(Number(entry.geometry.x)) || !Number.isFinite(Number(entry.geometry.y)))) throw new Error('Punkty krzywej conic muszą mieć poprawne współrzędne.');
  const conic = createSketchEntity('conic', {
    pointIds: points.map((entry) => entry.id),
    geometry: { rho: String(weight), continuity },
    expressionKeys: ['rho'],
  });
  return { points, curves: [conic], entities: [...points, conic] };
}
