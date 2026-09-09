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
  ].map((check) => ({ ...check, passed: Number.isFinite(check.value) && check.value <= check.limit }));

  return {
    passed: checks.every((check) => check.passed),
    checks,
    axial: { expected: axialExpected, actual: { displacement: axial.maximumDisplacement, stress: axial.maximumStress }, errors: axialErrors, nodes: axial.nodeCount, elements: axial.elementCount },
    bending: { expected: bendingExpected, actual: { displacement: bending.maximumDisplacement, stress: bending.maximumStress }, errors: bendingErrors, nodes: bending.nodeCount, elements: bending.elementCount },
    scaling: scalingErrors,
  };
}
