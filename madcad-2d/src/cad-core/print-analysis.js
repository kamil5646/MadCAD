import { calculatePrintLayout, normalizePrintLayout, transformPrintDirection } from './print-layout.js';

const WELD_TOLERANCE = 1e-5;
const DEGENERATE_AREA = 1e-10;

function point(vertices, index) {
  return [vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return length > 1e-12 ? vector.map((value) => value / length) : [0, 0, 0];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function faceForTriangle(body, triangleIndex) {
  const indexOffset = triangleIndex * 3;
  const group = (body.faceGroups || []).find((entry) => indexOffset >= entry.start && indexOffset < entry.start + entry.count);
  return group?.topologyId || null;
}

function faceSelection(body, faceId = null) {
  return faceId ? { kind: 'face', id: faceId, bodyId: body.id, sourceFeatureId: body.sourceFeatureId } : { kind: 'body', id: body.id };
}

function meshDiagnostics(body, print, overhangAngle) {
  const welded = new Map();
  const weldedIds = [];
  for (let index = 0; index < body.vertices.length / 3; index += 1) {
    const vertex = point(body.vertices, index);
    const key = vertex.map((value) => Math.round(value / WELD_TOLERANCE)).join(':');
    if (!welded.has(key)) welded.set(key, welded.size);
    weldedIds[index] = welded.get(key);
  }
  const edges = new Map();
  const degenerateTriangles = [];
  const flippedTriangles = [];
  const overhangFaces = new Set();
  const overhangTriangles = [];
  for (let offset = 0; offset < body.triangles.length; offset += 3) {
    const triangleIndex = offset / 3;
    const indices = [body.triangles[offset], body.triangles[offset + 1], body.triangles[offset + 2]];
    const vertices = indices.map((index) => point(body.vertices, index));
    const rawNormal = cross(subtract(vertices[1], vertices[0]), subtract(vertices[2], vertices[0]));
    const doubledArea = Math.hypot(...rawNormal);
    if (doubledArea <= DEGENERATE_AREA) degenerateTriangles.push(triangleIndex);
    const triangleNormal = normalize(rawNormal);
    if (body.normals?.length === body.vertices.length && doubledArea > DEGENERATE_AREA) {
      const averageNormal = normalize(indices.reduce((sum, index) => [sum[0] + body.normals[index * 3], sum[1] + body.normals[index * 3 + 1], sum[2] + body.normals[index * 3 + 2]], [0, 0, 0]));
      if (dot(triangleNormal, averageNormal) < 0.25) flippedTriangles.push(triangleIndex);
    }
    const printNormal = transformPrintDirection(triangleNormal, print);
    if (printNormal[2] < -Math.sin(overhangAngle * Math.PI / 180)) {
      overhangTriangles.push(triangleIndex);
      const faceId = faceForTriangle(body, triangleIndex);
      if (faceId) overhangFaces.add(faceId);
    }
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      const from = weldedIds[indices[edgeIndex]];
      const to = weldedIds[indices[(edgeIndex + 1) % 3]];
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      const record = edges.get(key) || { count: 0, balance: 0 };
      record.count += 1;
      record.balance += from < to ? 1 : -1;
      edges.set(key, record);
    }
  }
  const boundaryEdges = [...edges.values()].filter((edge) => edge.count === 1).length;
  const nonManifoldEdges = [...edges.values()].filter((edge) => edge.count > 2).length;
  const inconsistentEdges = [...edges.values()].filter((edge) => edge.count === 2 && edge.balance !== 0).length;
  return { boundaryEdges, nonManifoldEdges, inconsistentEdges, degenerateTriangles, flippedTriangles, overhangTriangles, overhangFaces: [...overhangFaces] };
}

function approximateMinimumThickness(body, scale) {
  const planes = (body.topology?.faces || []).filter((face) => face.descriptor?.geometry === 'PLANE' && Array.isArray(face.descriptor.normal) && Array.isArray(face.descriptor.centerOfMass || face.descriptor.center));
  let best = null;
  let faces = null;
  for (let first = 0; first < planes.length; first += 1) {
    for (let second = first + 1; second < planes.length; second += 1) {
      const a = planes[first].descriptor;
      const b = planes[second].descriptor;
      const parallel = dot(normalize(a.normal), normalize(b.normal));
      if (parallel > -0.985) continue;
      const separation = Math.abs(dot(subtract(b.centerOfMass || b.center, a.centerOfMass || a.center), normalize(a.normal))) * scale;
      if (separation > 1e-6 && (best === null || separation < best)) {
        best = separation;
        faces = [planes[first].id, planes[second].id];
      }
    }
  }
  return { value: best, faces };
}

export function analyzePrintability(bodies = [], print = {}) {
  const layout = normalizePrintLayout(print);
  const settings = {
    nozzleDiameter: Math.max(0.05, Number(print.nozzleDiameter) || 0.4),
    minimumWallThickness: Math.max(0.05, Number(print.minimumWallThickness) || 0.8),
    minimumHoleDiameter: Math.max(0.05, Number(print.minimumHoleDiameter) || 2),
    overhangAngle: Math.max(0, Math.min(89, Number(print.overhangAngle) || 45)),
  };
  const issues = [];
  const bodyResults = bodies.map((body) => {
    const mesh = meshDiagnostics(body, print, settings.overhangAngle);
    if (mesh.boundaryEdges || mesh.nonManifoldEdges) issues.push({ code: 'MANIFOLD', severity: 'error', bodyId: body.id, selection: faceSelection(body), message: `${body.name}: siatka ma ${mesh.boundaryEdges} krawędzi otwartych i ${mesh.nonManifoldEdges} krawędzi niemanifold.`, risk: 'Slicer może pominąć lub błędnie naprawić fragment modelu.' });
    if (mesh.inconsistentEdges || mesh.flippedTriangles.length) issues.push({ code: 'NORMALS', severity: 'error', bodyId: body.id, selection: faceSelection(body, faceForTriangle(body, mesh.flippedTriangles[0])), message: `${body.name}: wykryto niespójne kierunki normalnych.`, risk: 'Wnętrze i zewnętrze modelu może zostać rozpoznane odwrotnie.' });
    if (mesh.degenerateTriangles.length) issues.push({ code: 'DEGENERATE', severity: 'warning', bodyId: body.id, selection: faceSelection(body, faceForTriangle(body, mesh.degenerateTriangles[0])), message: `${body.name}: ${mesh.degenerateTriangles.length} trójkątów ma zerowe lub śladowe pole.`, risk: 'Siatka może powodować artefakty ścieżki.' });
    if (mesh.overhangTriangles.length) issues.push({ code: 'OVERHANG', severity: 'warning', bodyId: body.id, selection: faceSelection(body, mesh.overhangFaces[0]), message: `${body.name}: ${mesh.overhangTriangles.length} trójkątów przekracza próg nawisu ${settings.overhangAngle}°.`, risk: 'Te powierzchnie mogą wymagać podpór lub innej orientacji.' });
    const thickness = approximateMinimumThickness(body, layout.scale);
    if (thickness.value !== null && thickness.value < settings.minimumWallThickness) issues.push({ code: 'THIN_WALL', severity: 'warning', bodyId: body.id, selection: faceSelection(body, thickness.faces?.[0]), message: `${body.name}: przybliżona grubość ${thickness.value.toFixed(2)} mm jest mniejsza niż ${settings.minimumWallThickness.toFixed(2)} mm.`, risk: 'Ścianka może zostać pominięta albo wydrukowana jako pojedyncza linia.' });
    const smallHoles = (body.topology?.faces || []).filter((face) => face.descriptor?.geometry === 'CYLINDRE' && Number(face.descriptor.radius) * 2 * layout.scale < settings.minimumHoleDiameter);
    if (smallHoles.length) issues.push({ code: 'SMALL_HOLE', severity: 'warning', bodyId: body.id, selection: faceSelection(body, smallHoles[0].id), message: `${body.name}: ${smallHoles.length} powierzchni cylindrycznych ma średnicę poniżej ${settings.minimumHoleDiameter.toFixed(2)} mm.`, risk: 'Mały otwór może wyjść zwężony albo całkowicie się zamknąć.' });
    return { bodyId: body.id, ...mesh, minimumThickness: thickness.value, smallHoleCount: smallHoles.length };
  });
  const bed = calculatePrintLayout(bodies, print);
  const fitsBed = Boolean(bodies.length)
    && bed.min[0] >= -Number(print.bedWidth) / 2 && bed.max[0] <= Number(print.bedWidth) / 2
    && bed.min[1] >= -Number(print.bedDepth) / 2 && bed.max[1] <= Number(print.bedDepth) / 2
    && bed.min[2] >= -0.001 && bed.max[2] <= Number(print.bedHeight);
  if (bodies.length && !fitsBed) issues.push({ code: 'BED_BOUNDS', severity: 'error', selection: { kind: 'document' }, message: 'Układ części wykracza poza objętość roboczą drukarki.', risk: 'Slicer nie umieści całego układu na wybranym stole.' });
  return { bodyCount: bodies.length, settings, bodyResults, bed, fitsBed, issues, errorCount: issues.filter((issue) => issue.severity === 'error').length, warningCount: issues.filter((issue) => issue.severity === 'warning').length };
}

