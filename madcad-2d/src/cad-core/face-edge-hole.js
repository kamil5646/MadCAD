const TOLERANCE = 1e-5;

const subtract = (a, b) => a.map((value, index) => value - b[index]);
const add = (a, b) => a.map((value, index) => value + b[index]);
const scale = (vector, factor) => vector.map((value) => {
  const result = value * factor;
  return Math.abs(result) < Number.EPSILON ? 0 : result;
});
const dot = (a, b) => a.reduce((sum, value, index) => sum + (value * b[index]), 0);
const length = (vector) => Math.hypot(...vector);
const cross = (a, b) => [
  (a[1] * b[2]) - (a[2] * b[1]),
  (a[2] * b[0]) - (a[0] * b[2]),
  (a[0] * b[1]) - (a[1] * b[0]),
];

function normalized(vector, label) {
  const magnitude = length(vector);
  if (magnitude <= TOLERANCE) throw new Error(`${label} ma zerowy kierunek.`);
  return scale(vector, 1 / magnitude);
}

function closestCorner(firstEndpoints, secondEndpoints) {
  let best = null;
  firstEndpoints.forEach((first, firstIndex) => secondEndpoints.forEach((second, secondIndex) => {
    const distance = length(subtract(first, second));
    if (!best || distance < best.distance) best = { first, second, firstIndex, secondIndex, distance };
  }));
  if (!best || best.distance > TOLERANCE) throw new Error('Wskazane krawędzie muszą mieć wspólny narożnik.');
  return { ...best, point: scale(add(best.first, best.second), 0.5) };
}

export function resolveFaceEdgeHolePlacement(face, firstEdge, secondEdge, firstOffset, secondOffset) {
  if (face?.geometry !== 'PLANE' || !Array.isArray(face.center) || !Array.isArray(face.normal)) {
    throw new Error('Otwór od krawędzi wymaga planarnej ściany.');
  }
  if (!Array.isArray(firstEdge?.endpoints) || !Array.isArray(secondEdge?.endpoints)) {
    throw new Error('Otwór od krawędzi wymaga dwóch liniowych krawędzi.');
  }
  if (![firstOffset, secondOffset].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Odległości otworu od krawędzi muszą być dodatnie.');
  }

  const corner = closestCorner(firstEdge.endpoints, secondEdge.endpoints);
  const firstOther = firstEdge.endpoints[1 - corner.firstIndex];
  const secondOther = secondEdge.endpoints[1 - corner.secondIndex];
  const firstDirection = normalized(subtract(firstOther, corner.point), 'Pierwsza krawędź');
  const secondDirection = normalized(subtract(secondOther, corner.point), 'Druga krawędź');
  const normal = normalized(face.normal, 'Normalna ściany');
  if (Math.abs(dot(firstDirection, normal)) > TOLERANCE || Math.abs(dot(secondDirection, normal)) > TOLERANCE) {
    throw new Error('Wskazane krawędzie nie leżą na wybranej ścianie.');
  }
  if (Math.abs(dot(firstDirection, secondDirection)) > TOLERANCE) {
    throw new Error('Wskazane krawędzie muszą być prostopadłe.');
  }

  const towardCenter = subtract(face.center, corner.point);
  const inwardFor = (edgeDirection) => {
    const candidate = normalized(cross(normal, edgeDirection), 'Kierunek odsunięcia');
    return dot(candidate, towardCenter) >= 0 ? candidate : scale(candidate, -1);
  };
  const firstInward = inwardFor(firstDirection);
  const secondInward = inwardFor(secondDirection);
  const position = add(add(corner.point, scale(firstInward, firstOffset)), scale(secondInward, secondOffset));
  return {
    corner: corner.point,
    position,
    normal,
    direction: scale(normal, -1),
    firstInward,
    secondInward,
  };
}
