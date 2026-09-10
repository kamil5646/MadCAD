import { calculateSolidFea } from './solid-fea.js';

function percentError(actual, expected) {
  return Math.abs(actual - expected) / Math.abs(expected) * 100;
}

export function createSolidFeaBenchmarkBox(length = 40, width = 10, height = 10) {
  const vertices = [0, 0, 0, length, 0, 0, length, width, 0, 0, width, 0, 0, 0, height, length, 0, height, length, width, height, 0, width, height];
  const triangles = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
  return {
    id: `benchmark-box-${length}-${width}-${height}`,
    bodyKind: 'solid',
    vertices,
    triangles,
    faceGroups: [
      { topologyId: 'z-min', start: 0, count: 6 },
      { topologyId: 'z-max', start: 6, count: 6 },
      { topologyId: 'y-min', start: 12, count: 6 },
      { topologyId: 'x-max', start: 18, count: 6 },
      { topologyId: 'y-max', start: 24, count: 6 },
      { topologyId: 'x-min', start: 30, count: 6 },
    ],
    metrics: { bounds: [[0, 0, 0], [length, width, height]], volume: length * width * height },
  };
}

export function createSolidFeaHolePlate(length = 60, width = 30, thickness = 6, radius = 5, segments = 48) {
  const vertices = [];
  const rings = [];
  for (const z of [0, thickness]) {
    const outer = []; const inner = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = index / segments * Math.PI * 2;
      const cosine = Math.cos(angle); const sine = Math.sin(angle);
      const outerScale = Math.min(Math.abs(cosine) > 1e-9 ? length / 2 / Math.abs(cosine) : Infinity, Math.abs(sine) > 1e-9 ? width / 2 / Math.abs(sine) : Infinity);
      outer.push(vertices.length / 3); vertices.push(outerScale * cosine, outerScale * sine, z);
      inner.push(vertices.length / 3); vertices.push(radius * cosine, radius * sine, z);
    }
    rings.push({ outer, inner });
  }
  const triangles = [];
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments; const bottom = rings[0]; const top = rings[1];
    triangles.push(
      bottom.outer[index], bottom.inner[next], bottom.outer[next], bottom.outer[index], bottom.inner[index], bottom.inner[next],
      top.outer[index], top.outer[next], top.inner[next], top.outer[index], top.inner[next], top.inner[index],
      bottom.outer[index], bottom.outer[next], top.outer[next], bottom.outer[index], top.outer[next], top.outer[index],
      bottom.inner[index], top.inner[next], bottom.inner[next], bottom.inner[index], top.inner[index], top.inner[next],
    );
  }
  return {
    id: 'benchmark-hole-plate', bodyKind: 'solid', vertices, triangles,
    metrics: { bounds: [[-length / 2, -width / 2, 0], [length / 2, width / 2, thickness]], volume: (length * width - Math.PI * radius ** 2) * thickness },
  };
}

function solveBox(body, loadAxis, force, meshDensity, materialId = 's235') {
  return calculateSolidFea(body, {
    materialId,
    supportFaceId: 'x-min',
    loadFaceId: 'x-max',
    supportAxis: 'x',
    loadAxis,
    force,
    meshDensity,
    convergenceStudy: false,
  });
}

export function runSolidFeaBenchmarks() {
  const body = createSolidFeaBenchmarkBox();
  const youngSteel = 210000;
  const force = 1000;
  const area = 100;
  const secondMoment = 10 * 10 ** 3 / 12;

  const axial = solveBox(body, 'x', force, 8);
  const axialExpected = {
    displacement: force * 40 / (youngSteel * area),
    stress: force / area,
  };
  const axialErrors = {
    displacementPercent: percentError(axial.maximumDisplacement, axialExpected.displacement),
    stressPercent: percentError(axial.maximumStress, axialExpected.stress),
  };

  const bending = solveBox(body, 'z', force, 16);
  const bendingExpected = {
    displacement: force * 40 ** 3 / (3 * youngSteel * secondMoment),
    stress: force * 40 * 5 / secondMoment,
  };
  const bendingErrors = {
    displacementPercent: percentError(bending.maximumDisplacement, bendingExpected.displacement),
    stressPercent: percentError(bending.maximumStress, bendingExpected.stress),
  };

  const doubledLoad = solveBox(body, 'x', force * 2, 8);
  const aluminum = solveBox(body, 'x', force, 8, 'aluminum6061');
  const scalingErrors = {
    loadDisplacementPercent: percentError(doubledLoad.maximumDisplacement / axial.maximumDisplacement, 2),
    loadStressPercent: percentError(doubledLoad.maximumStress / axial.maximumStress, 2),
    modulusDisplacementPercent: percentError(aluminum.maximumDisplacement / axial.maximumDisplacement, youngSteel / 69000),
    modulusStressPercent: percentError(aluminum.maximumStress / axial.maximumStress, 1),
  };

  const holeBody = createSolidFeaHolePlate();
  const holeForce = 18000;
  const holeUniform = calculateSolidFea(holeBody, { materialId: 's235', supportAxis: 'x', supportSide: 'min', loadAxis: 'x', loadSide: 'max', force: holeForce, meshDensity: 8, adaptiveMesh: false, convergenceStudy: false });
  const holeAdaptive = calculateSolidFea(holeBody, { materialId: 's235', supportAxis: 'x', supportSide: 'min', loadAxis: 'x', loadSide: 'max', force: holeForce, meshDensity: 8, adaptiveMesh: true, convergenceStudy: false });
  const holeNominalGrossStress = holeForce / (30 * 6);
  const holeReferenceStress = holeNominalGrossStress * 3;
  const holeStressErrorPercent = percentError(holeAdaptive.maximumStress, holeReferenceStress);
  const holeVolumeImprovementPercent = (1 - holeAdaptive.volumeErrorPercent / holeUniform.volumeErrorPercent) * 100;

  const checks = [
    { id: 'axial-displacement', value: axialErrors.displacementPercent, limit: 2 },
    { id: 'axial-stress', value: axialErrors.stressPercent, limit: 5 },
    { id: 'bending-displacement', value: bendingErrors.displacementPercent, limit: 12 },
    { id: 'bending-stress', value: bendingErrors.stressPercent, limit: 20 },
    { id: 'force-displacement-linearity', value: scalingErrors.loadDisplacementPercent, limit: 0.01 },
    { id: 'force-stress-linearity', value: scalingErrors.loadStressPercent, limit: 0.01 },
    { id: 'young-modulus-scaling', value: scalingErrors.modulusDisplacementPercent, limit: 1 },
    { id: 'material-independent-axial-stress', value: scalingErrors.modulusStressPercent, limit: 1 },
    { id: 'axial-force-equilibrium', value: axial.equilibriumErrorPercent, limit: 0.001 },
    { id: 'bending-force-equilibrium', value: bending.equilibriumErrorPercent, limit: 0.001 },
    { id: 'fixed-boundary-zero', value: Math.max(...bending.nodes.filter((node) => node.fixed).map((node) => node.magnitude)), limit: 1e-12 },
    { id: 'hole-stress-concentration', value: holeStressErrorPercent, limit: 25 },
    { id: 'hole-adaptive-volume-improvement', value: 100 - holeVolumeImprovementPercent, limit: 20 },
    { id: 'hole-feature-planes', value: holeAdaptive.adaptation.addedPlaneCount >= 8 ? 0 : 1, limit: 0 },
  ].map((check) => ({ ...check, passed: Number.isFinite(check.value) && check.value <= check.limit }));

  return {
    passed: checks.every((check) => check.passed),
    checks,
    axial: { expected: axialExpected, actual: { displacement: axial.maximumDisplacement, stress: axial.maximumStress }, errors: axialErrors, nodes: axial.nodeCount, elements: axial.elementCount },
    bending: { expected: bendingExpected, actual: { displacement: bending.maximumDisplacement, stress: bending.maximumStress }, errors: bendingErrors, nodes: bending.nodeCount, elements: bending.elementCount },
    scaling: scalingErrors,
    hole: {
      referenceStress: holeReferenceStress,
      adaptiveStress: holeAdaptive.maximumStress,
      uniformStress: holeUniform.maximumStress,
      stressErrorPercent: holeStressErrorPercent,
      uniformVolumeErrorPercent: holeUniform.volumeErrorPercent,
      adaptiveVolumeErrorPercent: holeAdaptive.volumeErrorPercent,
      volumeImprovementPercent: holeVolumeImprovementPercent,
      addedPlaneCount: holeAdaptive.adaptation.addedPlaneCount,
      nodes: holeAdaptive.nodeCount,
      elements: holeAdaptive.elementCount,
    },
  };
}
