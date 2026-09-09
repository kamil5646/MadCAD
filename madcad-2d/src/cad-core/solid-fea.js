import { ENGINEERING_MATERIALS } from './static-screening.js';

const AXES = Object.freeze({ x: 0, y: 1, z: 2 });
const EPSILON = 1e-9;

function invert4(matrix) {
  const augmented = matrix.map((row, index) => [...row, ...Array.from({ length: 4 }, (_, column) => Number(index === column))]);
  for (let pivot = 0; pivot < 4; pivot += 1) {
    let selected = pivot;
    for (let row = pivot + 1; row < 4; row += 1) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[selected][pivot])) selected = row;
    if (Math.abs(augmented[selected][pivot]) < 1e-14) throw new Error('Siatka MES zawiera zdegenerowany czworościan.');
    [augmented[pivot], augmented[selected]] = [augmented[selected], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    for (let column = 0; column < 8; column += 1) augmented[pivot][column] /= divisor;
    for (let row = 0; row < 4; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = 0; column < 8; column += 1) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map((row) => row.slice(4));
}

function determinant3(a, b, c) {
  return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
}

function tetraData(points, material) {
  const [p0, p1, p2, p3] = points;
  const volume = Math.abs(determinant3(
    p1.map((value, axis) => value - p0[axis]),
    p2.map((value, axis) => value - p0[axis]),
    p3.map((value, axis) => value - p0[axis]),
  )) / 6;
  if (volume < 1e-12) throw new Error('Siatka MES zawiera czworościan o zerowej objętości.');
  const inverse = invert4(points.map((point) => [1, ...point]));
  const gradients = Array.from({ length: 4 }, (_, node) => [inverse[1][node], inverse[2][node], inverse[3][node]]);
  const b = Array.from({ length: 6 }, () => Array(12).fill(0));
  gradients.forEach(([dx, dy, dz], node) => {
    const offset = node * 3;
    b[0][offset] = dx;
    b[1][offset + 1] = dy;
    b[2][offset + 2] = dz;
    b[3][offset] = dy; b[3][offset + 1] = dx;
    b[4][offset + 1] = dz; b[4][offset + 2] = dy;
    b[5][offset] = dz; b[5][offset + 2] = dx;
  });
  const young = material.elasticModulus;
  const poisson = Number.isFinite(material.poissonRatio) ? material.poissonRatio : 0.3;
  const factor = young / ((1 + poisson) * (1 - 2 * poisson));
  const d = [
    [1 - poisson, poisson, poisson, 0, 0, 0],
    [poisson, 1 - poisson, poisson, 0, 0, 0],
    [poisson, poisson, 1 - poisson, 0, 0, 0],
    [0, 0, 0, (1 - 2 * poisson) / 2, 0, 0],
    [0, 0, 0, 0, (1 - 2 * poisson) / 2, 0],
    [0, 0, 0, 0, 0, (1 - 2 * poisson) / 2],
  ].map((row) => row.map((value) => value * factor));
  const db = d.map((row) => Array.from({ length: 12 }, (_, column) => row.reduce((sum, value, index) => sum + value * b[index][column], 0)));
  const stiffness = Array.from({ length: 12 }, (_, row) => Array.from({ length: 12 }, (_, column) => volume * b.reduce((sum, values, index) => sum + values[row] * db[index][column], 0)));
  return { volume, b, d, stiffness };
}

function rayIntersectsTriangle(point, a, b, c) {
  const edge1 = b.map((value, index) => value - a[index]);
  const edge2 = c.map((value, index) => value - a[index]);
  const h = [0, -edge2[2], edge2[1]];
  const determinant = edge1[0] * h[0] + edge1[1] * h[1] + edge1[2] * h[2];
  if (Math.abs(determinant) < 1e-12) return false;
  const inverse = 1 / determinant;
  const s = point.map((value, index) => value - a[index]);
  const u = inverse * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]);
  if (u < 0 || u > 1) return false;
  const q = [s[1] * edge1[2] - s[2] * edge1[1], s[2] * edge1[0] - s[0] * edge1[2], s[0] * edge1[1] - s[1] * edge1[0]];
  const v = inverse * q[0];
  if (v < 0 || u + v > 1) return false;
  const distance = inverse * (edge2[0] * q[0] + edge2[1] * q[1] + edge2[2] * q[2]);
  return distance > EPSILON;
}

function pointInsideMesh(point, vertices, triangles) {
  const shifted = [point[0], point[1] + 1.371e-7, point[2] + 2.113e-7];
  let intersections = 0;
  for (let index = 0; index < triangles.length; index += 3) {
    const triangle = [triangles[index], triangles[index + 1], triangles[index + 2]].map((vertexIndex) => [vertices[vertexIndex * 3], vertices[vertexIndex * 3 + 1], vertices[vertexIndex * 3 + 2]]);
    if (rayIntersectsTriangle(shifted, ...triangle)) intersections += 1;
  }
  return intersections % 2 === 1;
}

export function createSolidFeaMesh(body, targetCells = 6) {
  const bounds = body?.metrics?.bounds;
  const vertices = Array.from(body?.vertices || []);
  const triangles = Array.from(body?.triangles || []);
  if (!Array.isArray(bounds) || bounds.length !== 2 || vertices.length < 12 || triangles.length < 12) throw new Error('MES bryły 3D wymaga zamkniętej bryły z poprawną siatką powierzchniową.');
  const maximumCells = Number(targetCells);
  if (!Number.isInteger(maximumCells) || maximumCells < 2 || maximumCells > 16) throw new Error('Gęstość siatki musi wynosić od 2 do 16 komórek na najdłuższej osi.');
  const dimensions = bounds[1].map((value, axis) => value - bounds[0][axis]);
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Bryła musi mieć trzy dodatnie wymiary.');
  const longest = Math.max(...dimensions);
  const minimumCrossSectionCells = maximumCells >= 8 ? 6 : maximumCells >= 6 ? 4 : 2;
  const counts = dimensions.map((dimension) => Math.max(minimumCrossSectionCells, Math.round(maximumCells * dimension / longest)));
  const steps = dimensions.map((dimension, axis) => dimension / counts[axis]);
  const gridIndex = (i, j, k) => i + (counts[0] + 1) * (j + (counts[1] + 1) * k);
  const gridNodes = [];
  for (let k = 0; k <= counts[2]; k += 1) for (let j = 0; j <= counts[1]; j += 1) for (let i = 0; i <= counts[0]; i += 1) gridNodes.push([bounds[0][0] + i * steps[0], bounds[0][1] + j * steps[1], bounds[0][2] + k * steps[2]]);
  const cubeTetrahedra = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]];
  const tetrahedra = [];
  const used = new Set();
  for (let k = 0; k < counts[2]; k += 1) for (let j = 0; j < counts[1]; j += 1) for (let i = 0; i < counts[0]; i += 1) {
    const center = [bounds[0][0] + (i + 0.5) * steps[0], bounds[0][1] + (j + 0.5) * steps[1], bounds[0][2] + (k + 0.5) * steps[2]];
    if (!pointInsideMesh(center, vertices, triangles)) continue;
    const cube = [gridIndex(i, j, k), gridIndex(i + 1, j, k), gridIndex(i, j + 1, k), gridIndex(i + 1, j + 1, k), gridIndex(i, j, k + 1), gridIndex(i + 1, j, k + 1), gridIndex(i, j + 1, k + 1), gridIndex(i + 1, j + 1, k + 1)];
    cubeTetrahedra.forEach((local) => {
      const tetrahedron = local.map((index) => cube[index]);
      tetrahedra.push(tetrahedron);
      tetrahedron.forEach((node) => used.add(node));
    });
  }
  if (!tetrahedra.length) throw new Error('Nie udało się utworzyć objętościowej siatki MES. Zwiększ gęstość albo napraw bryłę.');
  const compact = new Map([...used].sort((a, b) => a - b).map((oldIndex, index) => [oldIndex, index]));
  const compactTetrahedra = tetrahedra.map((tetrahedron) => tetrahedron.map((oldIndex) => compact.get(oldIndex)));
  const faceUse = new Map();
  compactTetrahedra.forEach((tetrahedron) => {
    [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]].forEach((local) => {
      const face = local.map((index) => tetrahedron[index]);
      const key = [...face].sort((a, b) => a - b).join(':');
      const current = faceUse.get(key);
      faceUse.set(key, current ? { ...current, count: current.count + 1 } : { nodes: face, count: 1 });
    });
  });
  const result = {
    nodes: [...compact.keys()].map((oldIndex) => gridNodes[oldIndex]),
    tetrahedra: compactTetrahedra,
    boundaryTriangles: [...faceUse.values()].filter((face) => face.count === 1).map((face) => face.nodes),
    cellCounts: counts,
    cellSize: steps,
  };
  return result;
}

function triangleArea(points) {
  const first = points[1].map((value, axis) => value - points[0][axis]);
  const second = points[2].map((value, axis) => value - points[0][axis]);
  return Math.hypot(first[1] * second[2] - first[2] * second[1], first[2] * second[0] - first[0] * second[2], first[0] * second[1] - first[1] * second[0]) / 2;
}

function pointOnTriangle(point, triangle, tolerance) {
  const [a, b, c] = triangle;
  const v0 = c.map((value, axis) => value - a[axis]);
  const v1 = b.map((value, axis) => value - a[axis]);
  const v2 = point.map((value, axis) => value - a[axis]);
  const normal = [v1[1] * v0[2] - v1[2] * v0[1], v1[2] * v0[0] - v1[0] * v0[2], v1[0] * v0[1] - v1[1] * v0[0]];
  const normalLength = Math.hypot(...normal);
  if (normalLength < EPSILON || Math.abs(dot(v2, normal)) / normalLength > tolerance) return false;
  const dot00 = dot(v0, v0); const dot01 = dot(v0, v1); const dot02 = dot(v0, v2); const dot11 = dot(v1, v1); const dot12 = dot(v1, v2);
  const denominator = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denominator) < EPSILON) return false;
  const u = (dot11 * dot02 - dot01 * dot12) / denominator;
  const v = (dot00 * dot12 - dot01 * dot02) / denominator;
  return u >= -tolerance && v >= -tolerance && u + v <= 1 + tolerance;
}

function topologyFaceTriangles(body, faceId) {
  const group = (body.faceGroups || []).find((item) => item.topologyId === faceId);
  if (!group) return [];
  const vertices = Array.from(body.vertices || []);
  const indices = Array.from(body.triangles || []).slice(group.start, group.start + group.count);
  const triangles = [];
  for (let index = 0; index < indices.length; index += 3) triangles.push([indices[index], indices[index + 1], indices[index + 2]].map((vertexIndex) => [vertices[vertexIndex * 3], vertices[vertexIndex * 3 + 1], vertices[vertexIndex * 3 + 2]]));
  return triangles;
}

function selectBoundaryTriangles(body, mesh, selector, tolerance) {
  if (selector.faceId) {
    const surface = topologyFaceTriangles(body, selector.faceId);
    if (!surface.length) throw new Error(`Nie odnaleziono wskazanej ściany ${selector.faceId} w siatce bryły.`);
    return mesh.boundaryTriangles.filter((triangle) => {
      const center = [0, 1, 2].map((axis) => triangle.reduce((sum, node) => sum + mesh.nodes[node][axis], 0) / 3);
      return surface.some((sourceTriangle) => pointOnTriangle(center, sourceTriangle, tolerance));
    });
  }
  return mesh.boundaryTriangles.filter((triangle) => triangle.every((node) => Math.abs(mesh.nodes[node][selector.axis] - selector.coordinate) <= tolerance));
}

function dot(first, second) { return first.reduce((sum, value, index) => sum + value * second[index], 0); }

function conjugateGradient(rows, load, tolerance = 1e-8, maximumIterations = 5000) {
  const multiply = (vector) => rows.map((row) => [...row].reduce((sum, [column, value]) => sum + value * vector[column], 0));
  const solution = Array(load.length).fill(0);
  let residual = [...load];
  const diagonal = rows.map((row, index) => Math.abs(row.get(index) || 0) > EPSILON ? row.get(index) : 1);
  let preconditioned = residual.map((value, index) => value / diagonal[index]);
  let direction = [...preconditioned];
  let scalar = dot(residual, preconditioned);
  const target = Math.max(tolerance, Math.sqrt(dot(load, load)) * tolerance);
  let iteration = 0;
  for (; iteration < maximumIterations && Math.sqrt(dot(residual, residual)) > target; iteration += 1) {
    const product = multiply(direction);
    const denominator = dot(direction, product);
    if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-24) throw new Error('Solver MES utracił zbieżność. Sprawdź podparcie i spójność bryły.');
    const alpha = scalar / denominator;
    solution.forEach((_, index) => { solution[index] += alpha * direction[index]; residual[index] -= alpha * product[index]; });
    preconditioned = residual.map((value, index) => value / diagonal[index]);
    const nextScalar = dot(residual, preconditioned);
    const beta = nextScalar / scalar;
    direction = preconditioned.map((value, index) => value + beta * direction[index]);
    scalar = nextScalar;
  }
  const residualNorm = Math.sqrt(dot(residual, residual));
  if (residualNorm > target * 10) throw new Error('Solver MES nie osiągnął wymaganej zbieżności. Zmniejsz gęstość siatki albo sprawdź geometrię.');
  return { solution, iterationCount: iteration, residualNorm };
}

function vonMises(stress) {
  const [sx, sy, sz, txy, tyz, txz] = stress;
  return Math.sqrt(0.5 * ((sx - sy) ** 2 + (sy - sz) ** 2 + (sz - sx) ** 2) + 3 * (txy ** 2 + tyz ** 2 + txz ** 2));
}

export function calculateSolidFea(body, options = {}) {
  const material = ENGINEERING_MATERIALS[options.materialId || 's235'];
  if (!material) throw new Error('Wybierz obsługiwany materiał.');
  if (body?.bodyKind === 'surface') throw new Error('MES bryły 3D nie obsługuje otwartych powierzchni.');
  const supportAxis = String(options.supportAxis || 'x').toLowerCase();
  const loadAxis = String(options.loadAxis || 'z').toLowerCase();
  if (!(supportAxis in AXES) || !(loadAxis in AXES)) throw new Error('Wybierz poprawną oś podparcia i obciążenia.');
  const supportSide = options.supportSide === 'max' ? 'max' : 'min';
  const loadSide = options.loadSide === 'min' ? 'min' : 'max';
  const force = Number(options.force ?? 1000);
  if (!Number.isFinite(force) || force <= 0 || force > 1e9) throw new Error('Siła musi być dodatnia i nie większa niż 1 GN.');
  const mesh = createSolidFeaMesh(body, Number(options.meshDensity ?? 6));
  const supportIndex = AXES[supportAxis];
  const loadIndex = AXES[loadAxis];
  const bounds = body.metrics.bounds;
  const supportCoordinate = bounds[supportSide === 'min' ? 0 : 1][supportIndex];
  const loadCoordinate = bounds[loadSide === 'min' ? 0 : 1][supportIndex];
  const tolerance = Math.max(...mesh.cellSize) * 0.05 + 1e-7;
  const supportBoundary = selectBoundaryTriangles(body, mesh, { faceId: options.supportFaceId, axis: supportIndex, coordinate: supportCoordinate }, tolerance);
  const loadBoundary = selectBoundaryTriangles(body, mesh, { faceId: options.loadFaceId, axis: supportIndex, coordinate: loadCoordinate }, tolerance);
  const fixedNodes = new Set(supportBoundary.flat());
  const loadedNodes = [...new Set(loadBoundary.flat())].filter((index) => !fixedNodes.has(index));
  if (fixedNodes.size < 3) throw new Error('Utwierdzenie nie obejmuje wystarczającej liczby węzłów.');
  if (!loadedNodes.length) throw new Error('Nie znaleziono węzłów na obciążanej stronie bryły.');
  const fixedDofs = new Set([...fixedNodes].flatMap((node) => [node * 3, node * 3 + 1, node * 3 + 2]));
  const freeDofs = Array.from({ length: mesh.nodes.length * 3 }, (_, index) => index).filter((index) => !fixedDofs.has(index));
  const reducedIndex = new Map(freeDofs.map((dof, index) => [dof, index]));
  const rows = freeDofs.map(() => new Map());
  const load = Array(freeDofs.length).fill(0);
  const elementData = [];
  let meshVolume = 0;
  mesh.tetrahedra.forEach((tetrahedron) => {
    const data = tetraData(tetrahedron.map((node) => mesh.nodes[node]), material);
    meshVolume += data.volume;
    elementData.push(data);
    const dofs = tetrahedron.flatMap((node) => [node * 3, node * 3 + 1, node * 3 + 2]);
    dofs.forEach((rowDof, localRow) => {
      const row = reducedIndex.get(rowDof);
      if (row === undefined) return;
      dofs.forEach((columnDof, localColumn) => {
        const column = reducedIndex.get(columnDof);
        if (column === undefined) return;
        rows[row].set(column, (rows[row].get(column) || 0) + data.stiffness[localRow][localColumn]);
      });
    });
  });
  const loadWeights = new Map();
  loadBoundary.forEach((triangle) => {
    const areaShare = triangleArea(triangle.map((node) => mesh.nodes[node])) / 3;
    triangle.forEach((node) => { if (!fixedNodes.has(node)) loadWeights.set(node, (loadWeights.get(node) || 0) + areaShare); });
  });
  const totalWeight = [...loadWeights.values()].reduce((sum, value) => sum + value, 0);
  if (!(totalWeight > 0)) throw new Error('Obciążana ściana nie ma dodatniego pola siatki MES.');
  loadWeights.forEach((weight, node) => { load[reducedIndex.get(node * 3 + loadIndex)] += -force * weight / totalWeight; });
  const solved = conjugateGradient(rows, load);
  const displacement = Array(mesh.nodes.length * 3).fill(0);
  freeDofs.forEach((dof, index) => { displacement[dof] = solved.solution[index]; });
  const nodalStressSum = Array(mesh.nodes.length).fill(0);
  const nodalStressCount = Array(mesh.nodes.length).fill(0);
  const elementStresses = mesh.tetrahedra.map((tetrahedron, elementIndex) => {
    const data = elementData[elementIndex];
    const localDisplacement = tetrahedron.flatMap((node) => displacement.slice(node * 3, node * 3 + 3));
    const strain = data.b.map((row) => dot(row, localDisplacement));
    const stress = data.d.map((row) => dot(row, strain));
    const equivalent = vonMises(stress);
    tetrahedron.forEach((node) => { nodalStressSum[node] += equivalent; nodalStressCount[node] += 1; });
    return equivalent;
  });
  const nodes = mesh.nodes.map((position, index) => {
    const vector = displacement.slice(index * 3, index * 3 + 3);
    return { position, displacement: vector, magnitude: Math.hypot(...vector), stress: nodalStressCount[index] ? nodalStressSum[index] / nodalStressCount[index] : 0, fixed: fixedNodes.has(index), loaded: loadedNodes.includes(index) };
  });
  const maximumDisplacement = Math.max(...nodes.map((node) => node.magnitude));
  const maximumStress = Math.max(...elementStresses);
  const safetyFactor = maximumStress > 0 ? material.yieldStrength / maximumStress : Infinity;
  const supportReaction = [0, 0, 0];
  mesh.tetrahedra.forEach((tetrahedron, elementIndex) => {
    const dofs = tetrahedron.flatMap((node) => [node * 3, node * 3 + 1, node * 3 + 2]);
    const localDisplacement = dofs.map((dof) => displacement[dof]);
    const internal = elementData[elementIndex].stiffness.map((row) => dot(row, localDisplacement));
    dofs.forEach((dof, localIndex) => {
      if (fixedDofs.has(dof)) supportReaction[dof % 3] += internal[localIndex];
    });
  });
  const result = {
    bodyId: body.id,
    material,
    supportAxis,
    supportSide,
    supportFaceId: options.supportFaceId || null,
    loadAxis,
    loadSide,
    loadFaceId: options.loadFaceId || null,
    force,
    meshDensity: Number(options.meshDensity ?? 6),
    nodes,
    tetrahedra: mesh.tetrahedra,
    cellCounts: mesh.cellCounts,
    nodeCount: nodes.length,
    elementCount: mesh.tetrahedra.length,
    fixedNodeCount: fixedNodes.size,
    loadedNodeCount: loadedNodes.length,
    meshVolume,
    sourceVolume: Number(body.metrics?.volume) || null,
    volumeErrorPercent: body.metrics?.volume ? Math.abs(meshVolume - body.metrics.volume) / body.metrics.volume * 100 : null,
    maximumDisplacement,
    maximumStress,
    safetyFactor,
    status: safetyFactor >= 2 ? 'safe' : safetyFactor >= 1 ? 'warning' : 'failed',
    iterationCount: solved.iterationCount,
    residualNorm: solved.residualNorm,
    supportReaction,
    equilibriumErrorPercent: Math.abs(Math.abs(supportReaction[loadIndex]) - force) / force * 100,
    limitations: [
      'Liniowa sprężystość małych odkształceń; materiał jest jednorodny i izotropowy.',
      'Objętość jest aproksymowana regularną siatką czworościenną. Kontroluj błąd objętości i wykonaj analizę z co najmniej dwiema gęstościami.',
      'To etap beta: nie obejmuje kontaktu, plastyczności, wyboczenia, dużych przemieszczeń ani certyfikacji obliczeń.',
    ],
  };
  if (options.convergenceStudy !== false) {
    const comparisonDensity = result.meshDensity > 2 ? result.meshDensity - 1 : 3;
    try {
      const comparison = calculateSolidFea(body, { ...options, meshDensity: comparisonDensity, convergenceStudy: false });
      const displacementChangePercent = maximumDisplacement > 0 ? Math.abs(maximumDisplacement - comparison.maximumDisplacement) / maximumDisplacement * 100 : 0;
      const stressChangePercent = maximumStress > 0 ? Math.abs(maximumStress - comparison.maximumStress) / maximumStress * 100 : 0;
      result.convergence = {
        comparisonDensity,
        comparisonNodeCount: comparison.nodeCount,
        displacementChangePercent,
        stressChangePercent,
        status: Math.max(displacementChangePercent, stressChangePercent) <= 10 ? 'converged' : 'refine',
      };
    } catch (error) {
      result.convergence = { comparisonDensity, status: 'unavailable', error: error.message };
    }
  }
  const verificationChecks = {
    volume: result.volumeErrorPercent == null || result.volumeErrorPercent <= 5,
    equilibrium: result.equilibriumErrorPercent <= 0.001,
    solver: result.residualNorm / result.force <= 1e-8,
    convergence: result.convergence?.status === 'converged',
  };
  result.verification = {
    benchmarkVersion: '2026-09-09',
    checks: verificationChecks,
    status: Object.values(verificationChecks).every(Boolean) ? 'verified' : 'review',
  };
  return result;
}
