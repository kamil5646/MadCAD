import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircleDot, Crosshair, Diamond, Grid2X2, Magnet, Maximize2, Move3d, Orbit, Square, Trash2, Triangle, ZoomIn } from 'lucide-react';
import * as THREE from 'three';
import { calculatePrintLayout } from '../cad-core/print-layout.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { evaluateExpression, resolveParameters } from '../cad-core/expressions.js';
import { analyzeSketchConstraints, SKETCH_SOLVER_STATUS } from '../cad-core/sketch-solver.js';
import { DEFAULT_SNAP_THRESHOLD_PX, snapSketchPoint } from '../cad-core/sketch-snap.js';
import { edgeGroupVertices, topologySelectionFromIntersection } from '../cad-core/brep-picking.js';

const VIEW_DIRECTIONS = {
  iso: [1.25, -1.45, 1.15],
  top: [0, 0, 2],
  front: [0, -2, 0],
  right: [2, 0, 0],
};

const SNAP_ICONS = Object.freeze({
  endpoint: Square,
  center: CircleDot,
  intersection: Crosshair,
  quadrant: Diamond,
  midpoint: Triangle,
  tangent: CircleDot,
  horizontal: Crosshair,
  vertical: Crosshair,
  alignment: Crosshair,
  extension: Crosshair,
  nearest: Magnet,
  grid: Grid2X2,
});

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose();
  });
}

function numericValue(value, parameters) {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  try {
    const resolved = resolveParameters(parameters);
    return evaluateExpression(value, resolved.values);
  } catch (_error) {
    return 10;
  }
}

function mapPlanePoint(x, y, plane, z = 0.04, planeOffset = 0) {
  if (plane === 'XZ') return [x, -planeOffset - z, y];
  if (plane === 'YZ') return [planeOffset + z, x, y];
  return [x, y, planeOffset + z];
}

function profilePoints(profile, parameters, plane, planeOffset = 0) {
  return profileLocalPoints(profile, parameters).map((point) => mapPlanePoint(point[0], point[1], plane, 0.04, planeOffset));
}

function profileLocalPoints(profile, parameters) {
  const x = numericValue(profile.geometry.x, parameters);
  const y = numericValue(profile.geometry.y, parameters);
  if (profile.type === 'rectangle') {
    const halfWidth = numericValue(profile.geometry.width, parameters) / 2;
    const halfHeight = numericValue(profile.geometry.height, parameters) / 2;
    return [
      [x - halfWidth, y - halfHeight],
      [x + halfWidth, y - halfHeight],
      [x + halfWidth, y + halfHeight],
      [x - halfWidth, y + halfHeight],
      [x - halfWidth, y - halfHeight],
    ];
  }
  if (profile.type === 'closed') {
    const points = (profile.geometry.points || []).map((point) => [
      numericValue(point.x, parameters),
      numericValue(point.y, parameters),
    ]);
    return points.length ? [...points, points[0]] : [];
  }
  const radius = numericValue(profile.geometry.diameter, parameters) / 2;
  return Array.from({ length: 73 }, (_, index) => {
    const angle = (index / 72) * Math.PI * 2;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
  });
}

function addSketchProfiles(group, sketch, parameters, plane, { selectedProfileId = null, visible = true, planeOffset = 0 } = {}) {
  const pickables = [];
  if (!visible) return { pickables };
  for (const profile of sketch.profiles || []) {
    const outer = profileLocalPoints(profile, parameters);
    if (outer.length < 4) continue;
    const shape = new THREE.Shape();
    outer.slice(0, -1).forEach((point, index) => (index ? shape.lineTo(...point) : shape.moveTo(...point)));
    shape.closePath();
    for (const hole of profile.geometry?.holes || []) {
      const points = (hole.points || []).map((point) => [numericValue(point.x, parameters), numericValue(point.y, parameters)]);
      if (points.length < 3) continue;
      const path = new THREE.Path();
      points.forEach((point, index) => (index ? path.lineTo(...point) : path.moveTo(...point)));
      path.closePath();
      shape.holes.push(path);
    }
    const geometry = new THREE.ShapeGeometry(shape);
    const position = geometry.getAttribute('position');
    for (let index = 0; index < position.count; index += 1) {
      const mapped = mapPlanePoint(position.getX(index), position.getY(index), plane, 0.035, planeOffset);
      position.setXYZ(index, ...mapped);
    }
    position.needsUpdate = true;
    geometry.computeBoundingSphere();
    const selected = profile.id === selectedProfileId;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: selected ? 0xffc857 : 0x45b9dc,
      transparent: true,
      opacity: selected ? 0.28 : 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    mesh.renderOrder = 1;
    mesh.userData = { sketchProfileId: profile.id, baseColor: selected ? 0xffc857 : 0x45b9dc };
    group.add(mesh);
    pickables.push(mesh);
  }
  return { pickables };
}

function sketchPoint(entityMap, pointId, parameters) {
  const point = entityMap.get(pointId);
  if (point?.type !== 'point') return null;
  return [numericValue(point.geometry.x, parameters), numericValue(point.geometry.y, parameters)];
}

function arcPoints(center, start, end, direction, steps = 32) {
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  let endAngle = Math.atan2(end[1] - center[1], end[0] - center[0]);
  if (direction === 'ccw' && endAngle <= startAngle) endAngle += Math.PI * 2;
  if (direction === 'cw' && endAngle >= startAngle) endAngle -= Math.PI * 2;
  const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = startAngle + ((endAngle - startAngle) * index) / steps;
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
  });
}

function sketchEntityColor(entity, selected = false, error = false) {
  if (error || entity.error) return 0xff5e66;
  if (selected) return 0xffc857;
  if (entity.role === 'projected') return 0xc388e8;
  if (entity.role === 'construction' || entity.role === 'centerline') return 0x7893a2;
  if (entity.fixed) return 0x67d987;
  return 0x74cef0;
}

function sketchEntityState(entity, selected, error = false) {
  if (error || entity.error) return 'error';
  if (selected) return 'selected';
  if (entity.role === 'projected') return 'projected';
  if (entity.role === 'construction' || entity.role === 'centerline') return 'construction';
  if (entity.fixed) return 'fully-constrained';
  return 'under-constrained';
}

function addSketchEntities(group, sketch, parameters, plane, {
  selectedIds = [],
  errorIds = [],
  showPoints = true,
  showConstruction = true,
  showProjected = true,
  planeOffset = 0,
} = {}) {
  const entityMap = new Map(sketch.entities.map((entity) => [entity.id, entity]));
  const selected = new Set(selectedIds);
  const errors = new Set(errorIds);
  const roleVisible = (entity) => (showConstruction || !['construction', 'centerline'].includes(entity.role))
    && (showProjected || entity.role !== 'projected');
  const visibleCurves = sketch.entities.filter((entity) => entity.type !== 'point' && roleVisible(entity));
  const allReferencedPointIds = new Set(sketch.entities.flatMap((entity) => entity.pointIds || []));
  const visibleReferencedPointIds = new Set(visibleCurves.flatMap((entity) => entity.pointIds || []));
  const coordinates = new Map();
  const entries = [];
  const pickables = [];
  for (const entity of sketch.entities) {
    if (entity.type !== 'point') continue;
    const coordinate = sketchPoint(entityMap, entity.id, parameters);
    if (coordinate) coordinates.set(entity.id, coordinate);
  }
  const readPoint = (pointId, overrides) => overrides?.get(pointId) || coordinates.get(pointId) || null;
  const localPointsFor = (entity, overrides) => {
    if (entity.type === 'line') return entity.pointIds.map((pointId) => readPoint(pointId, overrides)).filter(Boolean);
    if (entity.type === 'circle') {
      const center = readPoint(entity.pointIds[0], overrides);
      const radius = numericValue(entity.geometry.radius, parameters);
      return center ? Array.from({ length: 73 }, (_, index) => {
        const angle = (index / 72) * Math.PI * 2;
        return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
      }) : [];
    }
    if (entity.type === 'ellipse') {
      const center = readPoint(entity.pointIds[0], overrides);
      const majorRadius = numericValue(entity.geometry.majorRadius, parameters);
      const minorRadius = numericValue(entity.geometry.minorRadius, parameters);
      const rotation = numericValue(entity.geometry.rotation || 0, parameters) * Math.PI / 180;
      return center ? Array.from({ length: 73 }, (_, index) => {
        const angle = (index / 72) * Math.PI * 2;
        const x = Math.cos(angle) * majorRadius;
        const y = Math.sin(angle) * minorRadius;
        return [center[0] + (x * Math.cos(rotation)) - (y * Math.sin(rotation)), center[1] + (x * Math.sin(rotation)) + (y * Math.cos(rotation))];
      }) : [];
    }
    if (entity.type === 'ellipticalArc') {
      const center = readPoint(entity.pointIds[0], overrides);
      const majorRadius = numericValue(entity.geometry.majorRadius, parameters);
      const minorRadius = numericValue(entity.geometry.minorRadius, parameters);
      const rotation = numericValue(entity.geometry.rotation || 0, parameters) * Math.PI / 180;
      let startAngle = numericValue(entity.geometry.startAngle, parameters) * Math.PI / 180;
      let endAngle = numericValue(entity.geometry.endAngle, parameters) * Math.PI / 180;
      if (entity.geometry.direction === 'cw' && endAngle >= startAngle) endAngle -= Math.PI * 2;
      if (entity.geometry.direction !== 'cw' && endAngle <= startAngle) endAngle += Math.PI * 2;
      return center ? Array.from({ length: 49 }, (_, index) => {
        const parameter = startAngle + ((endAngle - startAngle) * index) / 48;
        const x = Math.cos(parameter) * majorRadius;
        const y = Math.sin(parameter) * minorRadius;
        return [center[0] + (x * Math.cos(rotation)) - (y * Math.sin(rotation)), center[1] + (x * Math.sin(rotation)) + (y * Math.cos(rotation))];
      }) : [];
    }
    if (entity.type === 'spline') {
      const splinePoints = entity.pointIds.map((pointId) => readPoint(pointId, overrides)).filter(Boolean);
      const bezierPoint = (points, parameter) => {
        let level = points.map((entry) => [...entry]);
        while (level.length > 1) level = level.slice(0, -1).map((entry, index) => [entry[0] + ((level[index + 1][0] - entry[0]) * parameter), entry[1] + ((level[index + 1][1] - entry[1]) * parameter)]);
        return level[0];
      };
      if (entity.geometry.mode === 'control') return Array.from({ length: 65 }, (_, index) => bezierPoint(splinePoints, index / 64));
      const sampled = [];
      for (let index = 0; index < splinePoints.length - 1; index += 1) {
        const p0 = splinePoints[Math.max(0, index - 1)];
        const p1 = splinePoints[index];
        const p2 = splinePoints[index + 1];
        const p3 = splinePoints[Math.min(splinePoints.length - 1, index + 2)];
        const controls = [p1, [p1[0] + ((p2[0] - p0[0]) / 6), p1[1] + ((p2[1] - p0[1]) / 6)], [p2[0] - ((p3[0] - p1[0]) / 6), p2[1] - ((p3[1] - p1[1]) / 6)], p2];
        for (let step = index ? 1 : 0; step <= 16; step += 1) sampled.push(bezierPoint(controls, step / 16));
      }
      return sampled;
    }
    if (entity.type === 'conic') {
      const [start, control, end] = entity.pointIds.map((pointId) => readPoint(pointId, overrides));
      const rho = numericValue(entity.geometry.rho || 1, parameters);
      if (!start || !control || !end || !(rho > 0)) return [];
      return Array.from({ length: 65 }, (_, index) => {
        const t = index / 64;
        const inverse = 1 - t;
        const denominator = (inverse * inverse) + (2 * rho * inverse * t) + (t * t);
        return [
          ((inverse * inverse * start[0]) + (2 * rho * inverse * t * control[0]) + (t * t * end[0])) / denominator,
          ((inverse * inverse * start[1]) + (2 * rho * inverse * t * control[1]) + (t * t * end[1])) / denominator,
        ];
      });
    }
    if (entity.type === 'arc') {
      const [center, start, end] = entity.pointIds.map((pointId) => readPoint(pointId, overrides));
      return center && start && end ? arcPoints(center, start, end, entity.geometry.direction) : [];
    }
    return [];
  };

  for (const entity of visibleCurves) {
    const localPoints = localPointsFor(entity);
    if (localPoints.length < 2) continue;
    const hasError = errors.has(entity.id) || (entity.type === 'line'
      ? Math.hypot(localPoints[1][0] - localPoints[0][0], localPoints[1][1] - localPoints[0][1]) <= 1e-7
      : entity.type === 'circle'
        ? !(numericValue(entity.geometry.radius, parameters) > 0)
        : entity.type === 'arc' || entity.type === 'ellipticalArc'
          ? Math.hypot(localPoints[0][0] - localPoints.at(-1)[0], localPoints[0][1] - localPoints.at(-1)[1]) <= 1e-7
          : false);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(localPoints.flatMap((point) => mapPlanePoint(point[0], point[1], plane, 0.12, planeOffset)), 3));
    const baseColor = sketchEntityColor(entity, selected.has(entity.id), hasError);
    const material = new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.96 });
    const line = new THREE.Line(geometry, material);
    line.userData = { sketchEntityId: entity.id, sketchEntityType: entity.type, sketchState: sketchEntityState(entity, selected.has(entity.id), hasError), baseColor };
    group.add(line);
    entries.push({ entity, object: line });
    pickables.push(line);
  }

  if (showPoints) {
    for (const entity of sketch.entities) {
      if (entity.type !== 'point' || !coordinates.has(entity.id) || !roleVisible(entity)) continue;
      if (allReferencedPointIds.has(entity.id) && !visibleReferencedPointIds.has(entity.id)) continue;
      const hasError = errors.has(entity.id);
      const baseColor = sketchEntityColor(entity, selected.has(entity.id), hasError);
      const point = new THREE.Mesh(
        new THREE.SphereGeometry(selected.has(entity.id) ? 1.25 : 0.9, 14, 10),
        new THREE.MeshBasicMaterial({ color: baseColor, depthTest: false }),
      );
      point.position.set(...mapPlanePoint(...coordinates.get(entity.id), plane, 0.18, planeOffset));
      point.renderOrder = 5;
      point.userData = { sketchEntityId: entity.id, sketchEntityType: 'point', sketchState: sketchEntityState(entity, selected.has(entity.id), hasError), baseColor };
      group.add(point);
      entries.push({ entity, object: point });
      pickables.unshift(point);
    }
  }

  const update = (overrides = null) => {
    for (const entry of entries) {
      if (entry.entity.type === 'point') {
        const point = readPoint(entry.entity.id, overrides);
        if (point) entry.object.position.set(...mapPlanePoint(...point, plane, 0.18, planeOffset));
        continue;
      }
      const localPoints = localPointsFor(entry.entity, overrides);
      entry.object.geometry.setAttribute('position', new THREE.Float32BufferAttribute(
        localPoints.flatMap((point) => mapPlanePoint(point[0], point[1], plane, 0.12, planeOffset)),
        3,
      ));
      entry.object.geometry.computeBoundingSphere();
    }
  };
  return { coordinates, entries, pickables, update };
}

function addSketchLine(group, profile, parameters, plane, draft = false, planeOffset = 0) {
  const points = profilePoints(profile, parameters, plane, planeOffset).flat();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({
    color: draft ? 0x49d7ff : 0x93d9f2,
    transparent: true,
    opacity: draft ? 1 : 0.92,
  });
  group.add(new THREE.Line(geometry, material));
}

function configureGrid(grid, plane, planeOffset = 0) {
  if (plane === 'XY') grid.rotation.x = Math.PI / 2;
  else if (plane === 'YZ') grid.rotation.z = Math.PI / 2;
  if (plane === 'XY') grid.position.z = planeOffset;
  else if (plane === 'XZ') grid.position.y = -planeOffset;
  else grid.position.x = planeOffset;
}

export default function ModelViewport({
  bodies,
  sketches = [],
  activeSketchId,
  draftProfile,
  draftType,
  onDraftChange,
  sketchTool,
  sketchToolPrompt,
  polylineDraft,
  onSketchPoint,
  onSketchPointerMove,
  onSketchFinish,
  sketchDynamicLength = '',
  selectedSketchEntityIds = [],
  lostProjectedEntityIds = [],
  selectedSketchConstraintId = null,
  onSketchSelection,
  onSketchConstraintSelection,
  onSketchConstraintValueChange,
  onDeleteSketchSelection,
  sketchModifierMode = null,
  onSketchModify,
  onSketchProfileSelection,
  onSketchMove,
  showSketchPoints = true,
  showSketchProfiles = true,
  showSketchConstraints = true,
  showSketchDimensions = true,
  showConstructionGeometry = true,
  showProjectedGeometry = true,
  sliceModel = false,
  sectionAnalysis = null,
  parameters = [],
  showGrid = true,
  selectedBodyId,
  selectedBodyIds = [],
  onSelectBody,
  selectedTopologyIds = [],
  onSelectTopology,
  constructionPlanes = [],
  constructionAxes = [],
  constructionPoints = [],
  selectedConstructionId = null,
  selectedConstructionAxisId = null,
  selectedConstructionPointId = null,
  selectedProfile,
  selectedProfilePlane = 'XY',
  selectedProfilePlaneOffset = 0,
  directExtrudeDistance = 0,
  onDirectExtrude,
  directManipulator = null,
  snapEnabled = true,
  snapThresholdPx = DEFAULT_SNAP_THRESHOLD_PX,
  bed,
  showBed,
  printLayout,
}) {
  const hostRef = useRef(null);
  const optionKeyLabel = window.desktopApp?.platform === 'darwin' ? '⌥ Option' : 'Alt';
  const directHandleRef = useRef(null);
  const directEventRef = useRef({});
  const directDragRef = useRef(null);
  const sketchInteractionRef = useRef({ activeSketchId: null, start: null, drag: null, box: null });
  const selectRef = useRef(onSelectBody);
  const topologySelectRef = useRef(onSelectTopology);
  const draftChangeRef = useRef(onDraftChange);
  const sketchPointRef = useRef(onSketchPoint);
  const sketchPointerMoveRef = useRef(onSketchPointerMove);
  const sketchSelectionRef = useRef(onSketchSelection);
  const sketchProfileSelectionRef = useRef(onSketchProfileSelection);
  const sketchMoveRef = useRef(onSketchMove);
  const sketchModifyRef = useRef(onSketchModify);
  const directRef = useRef({});
  const [view, setView] = useState('iso');
  const [navigationMode, setNavigationMode] = useState('orbit');
  const [zoomScale, setZoomScale] = useState(1);
  const [dragLabel, setDragLabel] = useState(null);
  const [sketchDragLabel, setSketchDragLabel] = useState(null);
  const [sketchDynamicLabel, setSketchDynamicLabel] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [snapFeedback, setSnapFeedback] = useState(null);
  const [selectionFilter, setSelectionFilter] = useState('auto');
  const selectedTopologySet = useMemo(() => new Set(selectedTopologyIds), [selectedTopologyIds]);
  const selectedBodySet = useMemo(() => new Set(selectedBodyIds.length ? selectedBodyIds : [selectedBodyId].filter(Boolean)), [selectedBodyId, selectedBodyIds]);
  const activeSketch = sketches.find((sketch) => sketch.id === activeSketchId);
  const activePlane = activeSketch?.plane || 'XY';
  const activePlaneOffset = numericValue(activeSketch?.planeOffset || 0, parameters);
  useEffect(() => {
    if (!activeSketchId || !sketchTool || !snapEnabled) setSnapFeedback(null);
  }, [activeSketchId, sketchTool, snapEnabled]);
  const solverAnalysis = useMemo(() => {
    if (!activeSketch) return null;
    try {
      return analyzeSketchConstraints(activeSketch, parameters);
    } catch (error) {
      return { status: SKETCH_SOLVER_STATUS.CONFLICT, degreesOfFreedom: null, diagnostics: [{ message: error.message }], conflictConstraintIds: [] };
    }
  }, [activeSketch, parameters]);
  const isEmptySketch = Boolean(activeSketch && (activeSketch.entities || []).length === 0);
  useEffect(() => {
    if (!activeSketchId && selectionFilter === 'profile') setSelectionFilter('auto');
  }, [activeSketchId, selectionFilter]);
  if (sketchInteractionRef.current.activeSketchId !== activeSketchId) {
    sketchInteractionRef.current = { activeSketchId, start: null, drag: null, box: null };
  }
  const directEnabled = Boolean((selectedProfile || directManipulator) && !activeSketchId);
  selectRef.current = onSelectBody;
  topologySelectRef.current = onSelectTopology;
  draftChangeRef.current = onDraftChange;
  sketchPointRef.current = onSketchPoint;
  sketchPointerMoveRef.current = onSketchPointerMove;
  sketchSelectionRef.current = onSketchSelection;
  sketchProfileSelectionRef.current = onSketchProfileSelection;
  sketchMoveRef.current = onSketchMove;
  sketchModifyRef.current = onSketchModify;
  directRef.current = {
    distance: directManipulator ? numericValue(directManipulator.value, parameters) : numericValue(directExtrudeDistance, parameters),
    onCommit: directManipulator?.onCommit || onDirectExtrude,
    min: directManipulator?.min ?? 0.1,
    max: directManipulator?.max ?? Number.POSITIVE_INFINITY,
    origin: directManipulator?.origin || null,
    axis: directManipulator?.axis || null,
    kind: directManipulator?.kind || 'extrude',
    snapEnabled,
    snapThresholdPx,
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#2c333e');
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100000);
    camera.up.set(0, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.outline = 'none';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = Boolean((activeSketch && sliceModel) || sectionAnalysis?.enabled);
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = navigationMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

    scene.add(new THREE.HemisphereLight(0xf1f7fb, 0x28323d, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(260, -220, 360);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ccfff, 0.72);
    fill.position.set(-180, 100, 120);
    scene.add(fill);

    const gridSize = Math.max(800, bed?.bedWidth || 220, bed?.bedDepth || 220);
    const grid = new THREE.GridHelper(gridSize, Math.round(gridSize / 10), 0x737e8b, 0x4b5562);
    configureGrid(grid, activeSketchId ? activePlane : 'XY', activeSketchId ? activePlaneOffset : 0);
    grid.visible = showGrid;
    scene.add(grid);

    let plate;
    if (showBed) {
      const plateGeometry = new THREE.PlaneGeometry(bed.bedWidth, bed.bedDepth);
      const plateMaterial = new THREE.MeshStandardMaterial({ color: 0x384b55, roughness: 0.9, metalness: 0.04, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
      plate = new THREE.Mesh(plateGeometry, plateMaterial);
      plate.position.z = -0.1;
      scene.add(plate);
    }

    const modelGroup = new THREE.Group();
    const sketchSlicePlane = activeSketch && sliceModel
      ? activePlane === 'XZ'
        ? new THREE.Plane(new THREE.Vector3(0, -1, 0), -activePlaneOffset)
        : activePlane === 'YZ'
          ? new THREE.Plane(new THREE.Vector3(1, 0, 0), -activePlaneOffset)
          : new THREE.Plane(new THREE.Vector3(0, 0, 1), -activePlaneOffset)
      : null;
    const sectionNormal = sectionAnalysis?.plane === 'XZ'
      ? new THREE.Vector3(0, 1, 0)
      : sectionAnalysis?.plane === 'YZ'
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 0, 1);
    if (sectionAnalysis?.flip) sectionNormal.negate();
    const sectionOffset = Number(sectionAnalysis?.offset) || 0;
    const sectionPlane = sectionAnalysis?.enabled
      ? new THREE.Plane(sectionNormal, -sectionNormal.dot(
        sectionAnalysis.plane === 'XZ'
          ? new THREE.Vector3(0, sectionOffset, 0)
          : sectionAnalysis.plane === 'YZ'
            ? new THREE.Vector3(sectionOffset, 0, 0)
            : new THREE.Vector3(0, 0, sectionOffset),
      ))
      : null;
    const clippingPlanes = [sketchSlicePlane, sectionPlane].filter(Boolean);
    const pickables = [];
    const facePickables = [];
    const edgePickables = [];
    const vertexPickables = [];
    const faceHighlights = new Map();
    for (const body of bodies) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(body.vertices, 3));
      if (body.normals.length) geometry.setAttribute('normal', new THREE.BufferAttribute(body.normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(body.triangles, 1));
      geometry.computeBoundingSphere();
      const selected = selectedBodySet.has(body.id);
      const material = new THREE.MeshStandardMaterial({
        color: selected ? '#72c9eb' : body.color,
        metalness: 0.08,
        roughness: 0.56,
        emissive: selected ? '#10394a' : '#000000',
        emissiveIntensity: selected ? 0.7 : 0,
        transparent: Boolean(activeSketchId),
        opacity: activeSketchId ? 0.38 : 1,
        side: THREE.DoubleSide,
        clippingPlanes,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { bodyId: body.id, sourceFeatureId: body.sourceFeatureId, faceGroups: body.faceGroups };
      modelGroup.add(mesh);
      pickables.push(mesh);
      facePickables.push(mesh);

      for (const faceGroup of body.faceGroups || []) {
        const highlightGeometry = new THREE.BufferGeometry();
        highlightGeometry.setAttribute('position', geometry.getAttribute('position'));
        if (geometry.getAttribute('normal')) highlightGeometry.setAttribute('normal', geometry.getAttribute('normal'));
        highlightGeometry.setIndex(Array.from(body.triangles.slice(faceGroup.start, faceGroup.start + faceGroup.count)));
        const highlight = new THREE.Mesh(highlightGeometry, new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, clippingPlanes }));
        highlight.renderOrder = 3;
        highlight.visible = selectedTopologySet.has(faceGroup.topologyId);
        modelGroup.add(highlight);
        faceHighlights.set(faceGroup.topologyId, highlight);
      }

      for (const edgeGroup of body.edgeGroups || []) {
        const vertices = edgeGroupVertices(body.lines, edgeGroup);
        if (!vertices.length) continue;
        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const edgeSelected = selectedTopologySet.has(edgeGroup.topologyId);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: edgeSelected ? 0xffc857 : (selected ? 0xe4f8ff : 0x26333b), transparent: true, opacity: activeSketchId ? 0.34 : edgeSelected ? 1 : 0.72, clippingPlanes });
        const edgeObject = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        edgeObject.userData = { bodyId: body.id, sourceFeatureId: body.sourceFeatureId, topologyKind: 'edge', topologyId: edgeGroup.topologyId, baseColor: edgeSelected ? 0xffc857 : (selected ? 0xe4f8ff : 0x26333b) };
        modelGroup.add(edgeObject);
        pickables.push(edgeObject);
        edgePickables.push(edgeObject);
      }

      for (const vertex of body.topology?.vertices || []) {
        const point = vertex.descriptor?.point;
        if (!Array.isArray(point) || point.length !== 3) continue;
        const vertexGeometry = new THREE.BufferGeometry();
        vertexGeometry.setAttribute('position', new THREE.Float32BufferAttribute(point, 3));
        const vertexSelected = selectedTopologySet.has(vertex.id);
        const vertexObject = new THREE.Points(vertexGeometry, new THREE.PointsMaterial({ color: vertexSelected ? 0xffc857 : 0xe8f8ff, size: vertexSelected ? 9 : 6, sizeAttenuation: false, transparent: true, opacity: selectionFilter === 'vertex' || vertexSelected ? 1 : 0, clippingPlanes }));
        vertexObject.visible = selectionFilter === 'vertex' || vertexSelected;
        vertexObject.userData = { bodyId: body.id, sourceFeatureId: body.sourceFeatureId, topologyKind: 'vertex', topologyId: vertex.id, baseColor: vertexSelected ? 0xffc857 : 0xe8f8ff };
        modelGroup.add(vertexObject);
        pickables.push(vertexObject);
        vertexPickables.push(vertexObject);
      }
    }
    if (showBed) {
      const printResult = calculatePrintLayout(bodies, printLayout);
      const degrees = Math.PI / 180;
      const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...printResult.layout.orientationAxis), printResult.layout.orientationAngle * degrees);
      const rotateX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), printResult.layout.rotationX * degrees);
      const rotateY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), printResult.layout.rotationY * degrees);
      const rotateZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), printResult.layout.rotationZ * degrees);
      const rotation = rotateZ.clone().multiply(rotateY).multiply(rotateX).multiply(orientation);
      printResult.instances.forEach(({ index, offsetX }) => {
        const instance = index === 0 ? modelGroup : modelGroup.clone(true);
        instance.scale.setScalar(printResult.layout.scale);
        instance.quaternion.copy(rotation);
        instance.position.set(printResult.layout.positionX + offsetX, printResult.layout.positionY, printResult.layout.positionZ);
        scene.add(instance);
      });
      if (new URLSearchParams(window.location.search).has('verify')) window.__madcadPrintLayoutState = printResult;
    } else scene.add(modelGroup);

    const sectionGroup = new THREE.Group();
    if (sectionAnalysis?.enabled) {
      const sectionGeometry = new THREE.PlaneGeometry(gridSize * 0.82, gridSize * 0.82);
      const sectionMaterial = new THREE.MeshBasicMaterial({ color: 0x5de1ff, transparent: true, opacity: 0.075, side: THREE.DoubleSide, depthWrite: false });
      const sectionSurface = new THREE.Mesh(sectionGeometry, sectionMaterial);
      if (sectionAnalysis.plane === 'XZ') {
        sectionSurface.rotation.x = Math.PI / 2;
        sectionSurface.position.y = sectionOffset;
      } else if (sectionAnalysis.plane === 'YZ') {
        sectionSurface.rotation.y = Math.PI / 2;
        sectionSurface.position.x = sectionOffset;
      } else sectionSurface.position.z = sectionOffset;
      sectionSurface.renderOrder = 4;
      sectionGroup.add(sectionSurface);
      scene.add(sectionGroup);
    }
    if (new URLSearchParams(window.location.search).has('verify')) {
      window.__madcadSectionViewState = {
        enabled: Boolean(sectionAnalysis?.enabled),
        plane: sectionAnalysis?.plane || null,
        offset: sectionOffset,
        flip: Boolean(sectionAnalysis?.flip),
        clippingPlanes: clippingPlanes.length,
      };
    }

    const directGroup = new THREE.Group();
    const directPickables = [];
    let directHead = null;
    let updateDirectVisual = null;
    let ghostPreview = null;
    if (directEnabled) {
      const normal = directManipulator?.axis
        ? new THREE.Vector3(...directManipulator.axis).normalize()
        : selectedProfilePlane === 'XZ'
        ? new THREE.Vector3(0, -1, 0)
        : selectedProfilePlane === 'YZ'
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 0, 1);
      const profileX = selectedProfile ? numericValue(selectedProfile.geometry.x, parameters) : 0;
      const profileY = selectedProfile ? numericValue(selectedProfile.geometry.y, parameters) : 0;
      const center = directManipulator?.origin
        ? new THREE.Vector3(...directManipulator.origin)
        : new THREE.Vector3(...mapPlanePoint(profileX, profileY, selectedProfilePlane, 0.12, selectedProfilePlaneOffset));

      if (selectedProfile) addSketchLine(directGroup, selectedProfile, parameters, selectedProfilePlane, true, selectedProfilePlaneOffset);

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 1, 18),
        new THREE.MeshStandardMaterial({ color: 0x23c8f2, emissive: 0x087d9d, emissiveIntensity: 0.65, roughness: 0.38 }),
      );
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(2.5, 5, 24),
        new THREE.MeshStandardMaterial({ color: 0x5de1ff, emissive: 0x0c8daf, emissiveIntensity: 0.8, roughness: 0.3 }),
      );
      directHead = head;
      const hitTarget = new THREE.Mesh(
        new THREE.CylinderGeometry(3.6, 3.6, 1, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      const orientFromY = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      shaft.quaternion.copy(orientFromY);
      head.quaternion.copy(orientFromY);
      hitTarget.quaternion.copy(orientFromY);
      shaft.userData.directHandle = true;
      head.userData.directHandle = true;
      hitTarget.userData.directHandle = true;
      directPickables.push(shaft, head, hitTarget);
      directGroup.add(shaft, head, hitTarget);

      const removeGhost = () => {
        if (!ghostPreview) return;
        directGroup.remove(ghostPreview);
        disposeObject(ghostPreview);
        ghostPreview = null;
      };

      const makeGhost = (distance) => {
        removeGhost();
        if (!selectedProfile) return;
        const depth = Math.max(0.1, Math.abs(distance));
        const material = new THREE.MeshStandardMaterial({
          color: 0x53d9f7,
          emissive: 0x0b6074,
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.34,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        let geometry;
        let mesh;
        if (selectedProfile.type === 'circle') {
          const radius = numericValue(selectedProfile.geometry.diameter, parameters) / 2;
          geometry = new THREE.CylinderGeometry(radius, radius, 1, 64);
          mesh = new THREE.Mesh(geometry, material);
          mesh.quaternion.copy(orientFromY);
          mesh.scale.y = depth;
        } else if (selectedProfile.type === 'closed') {
          const centerX = numericValue(selectedProfile.geometry.x, parameters);
          const centerY = numericValue(selectedProfile.geometry.y, parameters);
          const points = (selectedProfile.geometry.points || []).map((point) => [
            numericValue(point.x, parameters) - centerX,
            numericValue(point.y, parameters) - centerY,
          ]);
          const shape = new THREE.Shape();
          points.forEach((point, index) => (index ? shape.lineTo(...point) : shape.moveTo(...point)));
          shape.closePath();
          geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
          geometry.translate(0, 0, -depth / 2);
          mesh = new THREE.Mesh(geometry, material);
          const basis = selectedProfilePlane === 'XZ'
            ? new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), normal)
            : selectedProfilePlane === 'YZ'
              ? new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), normal)
              : new THREE.Matrix4().identity();
          mesh.quaternion.setFromRotationMatrix(basis);
        } else {
          const width = numericValue(selectedProfile.geometry.width, parameters);
          const height = numericValue(selectedProfile.geometry.height, parameters);
          geometry = new THREE.BoxGeometry(width, height, 1);
          mesh = new THREE.Mesh(geometry, material);
          const basis = selectedProfilePlane === 'XZ'
            ? new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), normal)
            : selectedProfilePlane === 'YZ'
              ? new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), normal)
              : new THREE.Matrix4().identity();
          mesh.quaternion.setFromRotationMatrix(basis);
          mesh.scale.z = depth;
        }
        mesh.position.copy(center).addScaledVector(normal, distance / 2);
        mesh.renderOrder = 2;
        ghostPreview = mesh;
        directGroup.add(mesh);
      };

      updateDirectVisual = (distance, showGhost = false) => {
        const direction = distance < 0 ? normal.clone().negate() : normal;
        const faceDistance = Math.abs(distance);
        const faceCenter = center.clone().addScaledVector(direction, faceDistance);
        const handleLength = 12;
        shaft.scale.y = 8;
        shaft.position.copy(faceCenter).addScaledVector(direction, 5.5);
        head.position.copy(faceCenter).addScaledVector(direction, handleLength);
        if (distance < 0) {
          const reverse = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
          shaft.quaternion.copy(reverse);
          head.quaternion.copy(reverse);
          hitTarget.quaternion.copy(reverse);
        } else {
          shaft.quaternion.copy(orientFromY);
          head.quaternion.copy(orientFromY);
          hitTarget.quaternion.copy(orientFromY);
        }
        hitTarget.scale.y = 18;
        hitTarget.position.copy(faceCenter).addScaledVector(direction, 6);
        if (showGhost) makeGhost(distance);
        else removeGhost();
      };
      updateDirectVisual(directRef.current.distance || 0, false);
      scene.add(directGroup);
    }

    const sketchGroup = new THREE.Group();
    let sketchPreviewLine = null;
    let sketchRender = null;
    let sketchProfileRender = null;
    if (activeSketch) {
      const axisLength = gridSize / 2;
      const xAxisGeometry = new THREE.BufferGeometry();
      xAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
        ...mapPlanePoint(-axisLength, 0, activePlane, 0.06, activePlaneOffset),
        ...mapPlanePoint(axisLength, 0, activePlane, 0.06, activePlaneOffset),
      ], 3));
      sketchGroup.add(new THREE.Line(xAxisGeometry, new THREE.LineBasicMaterial({ color: 0xd85b61, transparent: true, opacity: 0.9 })));
      const yAxisGeometry = new THREE.BufferGeometry();
      yAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
        ...mapPlanePoint(0, -axisLength, activePlane, 0.06, activePlaneOffset),
        ...mapPlanePoint(0, axisLength, activePlane, 0.06, activePlaneOffset),
      ], 3));
      sketchGroup.add(new THREE.Line(yAxisGeometry, new THREE.LineBasicMaterial({ color: 0x54c978, transparent: true, opacity: 0.9 })));
      sketchProfileRender = addSketchProfiles(sketchGroup, activeSketch, parameters, activePlane, {
        selectedProfileId: selectedProfile?.id,
        visible: showSketchProfiles,
        planeOffset: activePlaneOffset,
      });
      sketchRender = addSketchEntities(sketchGroup, activeSketch, parameters, activePlane, {
        selectedIds: selectedSketchEntityIds,
        errorIds: lostProjectedEntityIds,
        showPoints: showSketchPoints,
        showConstruction: showConstructionGeometry,
        showProjected: showProjectedGeometry,
        planeOffset: activePlaneOffset,
      });
      if (draftProfile) addSketchLine(sketchGroup, draftProfile, parameters, activePlane, true, activePlaneOffset);
      if (sketchTool && polylineDraft?.lastPoint) {
        const previewGeometry = new THREE.BufferGeometry();
        const start = mapPlanePoint(polylineDraft.lastPoint[0], polylineDraft.lastPoint[1], activePlane, 0.09, activePlaneOffset);
        previewGeometry.setAttribute('position', new THREE.Float32BufferAttribute([...start, ...start], 3));
        sketchPreviewLine = new THREE.Line(
          previewGeometry,
          new THREE.LineDashedMaterial({ color: 0x5de1ff, dashSize: 3, gapSize: 1.5, transparent: true, opacity: 0.95 }),
        );
        sketchPreviewLine.computeLineDistances();
        sketchGroup.add(sketchPreviewLine);
      }
      scene.add(sketchGroup);
    }

    const modelBox = bodies.length ? new THREE.Box3().setFromObject(modelGroup) : null;
    const center = modelBox ? modelBox.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);
    if (activeSketch) center.set(...mapPlanePoint(0, 0, activePlane, 0, activePlaneOffset));
    const size = modelBox ? modelBox.getSize(new THREE.Vector3()) : new THREE.Vector3(80, 60, 20);
    const radius = Math.max(size.x, size.y, size.z, 55);
    const constructionGroup = new THREE.Group();
    const planeSize = Math.max(60, radius * 1.15);
    for (const plane of constructionPlanes) {
      if (!plane.visible || plane.status !== 'ok') continue;
      const origin = new THREE.Vector3(...plane.origin);
      const u = new THREE.Vector3(...plane.u).multiplyScalar(planeSize / 2);
      const v = new THREE.Vector3(...plane.v).multiplyScalar(planeSize / 2);
      const corners = [
        origin.clone().sub(u).sub(v),
        origin.clone().add(u).sub(v),
        origin.clone().add(u).add(v),
        origin.clone().sub(u).add(v),
      ];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((point) => point.toArray()), 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      const selected = plane.id === selectedConstructionId;
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: selected ? 0xffc857 : 0x6bc8eb,
        transparent: true,
        opacity: selected ? 0.23 : 0.11,
        side: THREE.DoubleSide,
        depthWrite: false,
      }));
      mesh.renderOrder = 1;
      mesh.userData = { constructionId: plane.id };
      const outlineGeometry = new THREE.BufferGeometry();
      outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([...corners, corners[0]].flatMap((point) => point.toArray()), 3));
      const outline = new THREE.Line(outlineGeometry, new THREE.LineDashedMaterial({ color: selected ? 0xffc857 : 0x69b8d7, dashSize: 4, gapSize: 2, transparent: true, opacity: selected ? 1 : 0.75 }));
      outline.computeLineDistances();
      constructionGroup.add(mesh, outline);
    }
    const axisLength = Math.max(80, radius * 1.6);
    for (const axis of constructionAxes) {
      if (!axis.visible || axis.status !== 'ok') continue;
      const origin = new THREE.Vector3(...axis.origin);
      const direction = new THREE.Vector3(...axis.direction).normalize().multiplyScalar(axisLength / 2);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        ...origin.clone().sub(direction).toArray(),
        ...origin.clone().add(direction).toArray(),
      ], 3));
      const selected = axis.id === selectedConstructionAxisId;
      const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: selected ? 0xffc857 : 0xd58cff, dashSize: 5, gapSize: 2, transparent: true, opacity: selected ? 1 : 0.88 }));
      line.computeLineDistances();
      line.userData = { constructionAxisId: axis.id };
      const centerMarker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.8, radius * 0.012), 12, 8), new THREE.MeshBasicMaterial({ color: selected ? 0xffc857 : 0xd58cff }));
      centerMarker.position.copy(origin);
      constructionGroup.add(line, centerMarker);
    }
    for (const point of constructionPoints) {
      if (!point.visible || point.status !== 'ok') continue;
      const selected = point.id === selectedConstructionPointId;
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(1.25, radius * (selected ? 0.022 : 0.017)), 18, 12),
        new THREE.MeshBasicMaterial({ color: selected ? 0xffc857 : 0x6ee7a8, depthTest: false }),
      );
      marker.position.set(...point.position);
      marker.renderOrder = 4;
      marker.userData = { constructionPointId: point.id };
      constructionGroup.add(marker);
    }
    scene.add(constructionGroup);
    if (new URLSearchParams(window.location.search).has('verify')) {
      window.__madcadConstructionPlaneState = constructionPlanes.map((plane) => ({ id: plane.id, name: plane.name, status: plane.status, visible: plane.visible, origin: plane.origin, normal: plane.normal }));
      window.__madcadConstructionAxisState = constructionAxes.map((axis) => ({ id: axis.id, name: axis.name, axisType: axis.axisType, status: axis.status, visible: axis.visible, origin: axis.origin, direction: axis.direction }));
      window.__madcadConstructionPointState = constructionPoints.map((point) => ({ id: point.id, name: point.name, pointType: point.pointType, status: point.status, visible: point.visible, position: point.position }));
    }
    const sketchView = activePlane === 'XZ' ? 'front' : activePlane === 'YZ' ? 'right' : 'top';
    const direction = VIEW_DIRECTIONS[activeSketch ? sketchView : view] || VIEW_DIRECTIONS.iso;
    camera.up.set(0, 0, 1);
    if ((activeSketch ? sketchView : view) === 'top') camera.up.set(0, 1, 0);
    camera.position.set(center.x + direction[0] * radius * 1.7 * zoomScale, center.y + direction[1] * radius * 1.7 * zoomScale, center.z + direction[2] * radius * 1.7 * zoomScale);
    controls.target.copy(center);
    controls.enableRotate = !activeSketch;
    controls.update();

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 1.6;
    const pointer = new THREE.Vector2();
    const sketchInteraction = sketchInteractionRef.current;
    let hoveredSketchObject = null;
    let hoveredModel = null;
    let modelPickCycle = { x: NaN, y: NaN, index: 0 };
    let modelSelectionBox = null;
    const sketchPlane = activePlane === 'XZ'
      ? new THREE.Plane(new THREE.Vector3(0, 1, 0), activePlaneOffset)
      : activePlane === 'YZ'
        ? new THREE.Plane(new THREE.Vector3(1, 0, 0), -activePlaneOffset)
        : new THREE.Plane(new THREE.Vector3(0, 0, 1), -activePlaneOffset);
    const localPoint = (point) => activePlane === 'XZ' ? [point.x, point.z] : activePlane === 'YZ' ? [point.y, point.z] : [point.x, point.y];
    const setRayFromEvent = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return rect;
    };
    const screenPoint = (coordinate, rect) => {
      const projected = new THREE.Vector3(...mapPlanePoint(coordinate[0], coordinate[1], activePlane, 0.2, activePlaneOffset)).project(camera);
      return [((projected.x + 1) * rect.width) / 2, ((1 - projected.y) * rect.height) / 2];
    };
    const pixelsPerSketchUnit = (coordinate, rect) => {
      const origin = screenPoint(coordinate, rect);
      const xOffset = screenPoint([coordinate[0] + 1, coordinate[1]], rect);
      const yOffset = screenPoint([coordinate[0], coordinate[1] + 1], rect);
      return Math.max(0.001, (Math.hypot(xOffset[0] - origin[0], xOffset[1] - origin[1]) + Math.hypot(yOffset[0] - origin[0], yOffset[1] - origin[1])) / 2);
    };
    const updateSnapFeedback = (result, rect) => {
      if (!result?.snapped) {
        setSnapFeedback(null);
        return;
      }
      const [x, y] = screenPoint(result.point, rect);
      const guides = (result.guides || []).map((guide) => {
        if (guide.kind === 'horizontal') return { x1: 0, y1: y, x2: rect.width, y2: y };
        if (guide.kind === 'vertical') return { x1: x, y1: 0, x2: x, y2: rect.height };
        if (guide.from && guide.to) {
          const from = screenPoint(guide.from, rect);
          const to = screenPoint(guide.to, rect);
          return { x1: from[0], y1: from[1], x2: to[0], y2: to[1] };
        }
        return null;
      }).filter(Boolean);
      setSnapFeedback({
        x,
        y,
        label: result.label,
        type: result.type,
        guides,
        placement: `${x > rect.width - 170 ? 'left' : 'right'} ${y > rect.height - 70 ? 'above' : 'below'}`,
      });
    };
    const resolveSnap = (event, rawPoint, rect, options = {}) => {
      const result = snapSketchPoint(activeSketch, rawPoint, {
        parameters,
        anchor: options.anchor || null,
        excludePointIds: options.excludePointIds || [],
        gridSize: 1,
        pixelsPerUnit: pixelsPerSketchUnit(rawPoint, rect),
        thresholdPx: directRef.current.snapThresholdPx,
        disabled: !directRef.current.snapEnabled || event.altKey,
      });
      updateSnapFeedback(result, rect);
      return result;
    };
    const pickSketchEntity = (event = null) => {
      const hits = sketchRender ? raycaster.intersectObjects(sketchRender.pickables, false) : [];
      const hit = hits.find((entry) => entry.object.userData.sketchEntityType === 'point') || hits[0] || null;
      if (hit || !event || !sketchRender) return hit;
      const rect = renderer.domElement.getBoundingClientRect();
      const fallback = sketchRender.entries
        .filter((entry) => entry.entity.type === 'point')
        .map((entry) => {
          const projected = entry.object.getWorldPosition(new THREE.Vector3()).project(camera);
          const x = rect.left + ((projected.x + 1) * rect.width) / 2;
          const y = rect.top + ((1 - projected.y) * rect.height) / 2;
          return { object: entry.object, distance: Math.hypot(event.clientX - x, event.clientY - y) };
        })
        .sort((first, second) => first.distance - second.distance)[0];
      return fallback?.distance <= Math.max(10, directRef.current.snapThresholdPx) ? fallback : null;
    };
    const pickSketchProfile = () => sketchProfileRender
      ? raycaster.intersectObjects(sketchProfileRender.pickables, false)[0] || null
      : null;
    const selectionMode = (event) => event.ctrlKey ? 'toggle' : event.shiftKey ? 'add' : 'replace';
    const movingPointIds = (entityIds) => {
      const selected = new Set(entityIds);
      const ids = new Set();
      for (const entity of activeSketch?.entities || []) {
        if (!selected.has(entity.id)) continue;
        if (entity.type === 'point') ids.add(entity.id);
        else for (const pointId of entity.pointIds || []) ids.add(pointId);
      }
      return [...ids];
    };
    const setSketchHover = (object) => {
      if (hoveredSketchObject === object) return;
      if (hoveredSketchObject?.material?.color) hoveredSketchObject.material.color.setHex(hoveredSketchObject.userData.baseColor);
      hoveredSketchObject = object;
      if (hoveredSketchObject?.material?.color) hoveredSketchObject.material.color.setHex(0xf4fbff);
      if (!sketchInteraction.drag && !sketchInteraction.box && activeSketch && !sketchTool && !draftType) {
        renderer.domElement.style.cursor = object ? 'pointer' : 'crosshair';
      }
    };
    const setModelHover = (hit) => {
      if (hoveredModel?.kind === 'face') {
        const highlight = faceHighlights.get(hoveredModel.id);
        if (highlight) highlight.visible = selectedTopologySet.has(hoveredModel.id);
      } else if (hoveredModel?.object?.material?.color) {
        hoveredModel.object.material.color.setHex(hoveredModel.object.userData.baseColor);
      }
      const topology = topologySelectionFromIntersection(hit);
      hoveredModel = topology && topology.kind !== 'body' ? { ...topology, object: hit.object } : null;
      if (new URLSearchParams(window.location.search).has('verify')) window.__madcadModelHover = hoveredModel ? { kind: hoveredModel.kind, id: hoveredModel.id } : null;
      if (hoveredModel?.kind === 'face') {
        const highlight = faceHighlights.get(hoveredModel.id);
        if (highlight) highlight.visible = true;
      } else if (hoveredModel?.object?.material?.color) hoveredModel.object.material.color.setHex(0xf4fbff);
      if (!activeSketch && !directDragRef.current) renderer.domElement.style.cursor = hoveredModel ? 'pointer' : 'grab';
    };
    const modelCandidates = () => selectionFilter === 'body' || selectionFilter === 'face'
      ? facePickables
      : selectionFilter === 'edge'
        ? edgePickables
        : selectionFilter === 'vertex'
          ? vertexPickables
          : pickables;
    const pickModel = (event, cycle = false) => {
      const hits = raycaster.intersectObjects(modelCandidates(), false);
      if (!hits.length) return null;
      const unique = [];
      const keys = new Set();
      for (const hit of hits) {
        const topology = topologySelectionFromIntersection(hit);
        const key = topology ? `${topology.kind}:${topology.id}` : null;
        if (!key || keys.has(key)) continue;
        keys.add(key);
        unique.push(hit);
      }
      const samePoint = Math.hypot(event.clientX - modelPickCycle.x, event.clientY - modelPickCycle.y) <= 3;
      const index = cycle && samePoint ? (modelPickCycle.index + 1) % Math.max(1, unique.length) : 0;
      modelPickCycle = { x: event.clientX, y: event.clientY, index };
      return unique[index] || unique[0];
    };
    const boxSelectedIds = (box) => {
      if (!sketchRender) return [];
      const rect = renderer.domElement.getBoundingClientRect();
      const left = Math.min(box.startX, box.endX);
      const right = Math.max(box.startX, box.endX);
      const top = Math.min(box.startY, box.endY);
      const bottom = Math.max(box.startY, box.endY);
      const crossing = box.endX < box.startX;
      const ids = new Set();
      for (const entry of sketchRender.entries) {
        let screenPoints;
        if (entry.entity.type === 'point') {
          const point = entry.object.getWorldPosition(new THREE.Vector3()).project(camera);
          screenPoints = [[rect.left + (point.x + 1) * rect.width / 2, rect.top + (1 - point.y) * rect.height / 2]];
        } else {
          const position = entry.object.geometry.getAttribute('position');
          entry.object.updateMatrixWorld(true);
          screenPoints = Array.from({ length: position.count }, (_, index) => {
            const point = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(entry.object.matrixWorld).project(camera);
            return [rect.left + (point.x + 1) * rect.width / 2, rect.top + (1 - point.y) * rect.height / 2];
          });
        }
        const inside = screenPoints.every(([x, y]) => x >= left && x <= right && y >= top && y <= bottom);
        const minX = Math.min(...screenPoints.map((point) => point[0]));
        const maxX = Math.max(...screenPoints.map((point) => point[0]));
        const minY = Math.min(...screenPoints.map((point) => point[1]));
        const maxY = Math.max(...screenPoints.map((point) => point[1]));
        const intersects = maxX >= left && minX <= right && maxY >= top && minY <= bottom;
        if (inside || (crossing && intersects)) ids.add(entry.entity.id);
      }
      return [...ids];
    };
    const projectedPoints = (object, vertexIndices = null) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const position = object.geometry?.getAttribute('position');
      if (!position) return [];
      object.updateMatrixWorld(true);
      const indices = vertexIndices || Array.from({ length: position.count }, (_, index) => index);
      return indices.map((index) => {
        const point = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld).project(camera);
        return [rect.left + ((point.x + 1) * rect.width) / 2, rect.top + ((1 - point.y) * rect.height) / 2];
      });
    };
    const boxContainsPoints = (box, points) => {
      if (!points.length) return false;
      const left = Math.min(box.startX, box.endX);
      const right = Math.max(box.startX, box.endX);
      const top = Math.min(box.startY, box.endY);
      const bottom = Math.max(box.startY, box.endY);
      const inside = points.every(([x, y]) => x >= left && x <= right && y >= top && y <= bottom);
      if (inside) return true;
      if (box.endX >= box.startX) return false;
      const minX = Math.min(...points.map((point) => point[0]));
      const maxX = Math.max(...points.map((point) => point[0]));
      const minY = Math.min(...points.map((point) => point[1]));
      const maxY = Math.max(...points.map((point) => point[1]));
      return maxX >= left && minX <= right && maxY >= top && minY <= bottom;
    };
    const boxSelectedModelTopology = (box) => {
      const selections = [];
      const add = (selection) => {
        if (selection && !selections.some((entry) => entry.kind === selection.kind && entry.id === selection.id)) selections.push(selection);
      };
      if (selectionFilter === 'auto' || selectionFilter === 'body') {
        for (const object of facePickables) {
          if (!boxContainsPoints(box, projectedPoints(object))) continue;
          add({ kind: 'body', id: object.userData.bodyId, bodyId: object.userData.bodyId, sourceFeatureId: object.userData.sourceFeatureId || null });
        }
        return selections;
      }
      if (selectionFilter === 'face') {
        for (const object of facePickables) {
          const index = object.geometry.getIndex();
          for (const group of object.userData.faceGroups || []) {
            const vertexIndices = [...new Set(Array.from({ length: group.count }, (_, offset) => index.getX(group.start + offset)))];
            if (!boxContainsPoints(box, projectedPoints(object, vertexIndices))) continue;
            add({ kind: 'face', id: group.topologyId, bodyId: object.userData.bodyId, sourceFeatureId: object.userData.sourceFeatureId || null });
          }
        }
      } else {
        const candidates = selectionFilter === 'edge' ? edgePickables : vertexPickables;
        for (const object of candidates) {
          if (!boxContainsPoints(box, projectedPoints(object))) continue;
          add({ kind: object.userData.topologyKind, id: object.userData.topologyId, bodyId: object.userData.bodyId, sourceFeatureId: object.userData.sourceFeatureId || null });
        }
      }
      return selections;
    };
    const onPointerDown = (event) => {
      const rect = setRayFromEvent(event);
      const fromDirectOverlay = event.currentTarget === directHandleElement;
      const directHit = fromDirectOverlay ? { object: directHead } : (directPickables.length ? raycaster.intersectObjects(directPickables, false)[0] : null);
      if (new URLSearchParams(window.location.search).has('verify')) {
        window.__madcadPointerLog = { down: true, directHit: Boolean(directHit), x: event.clientX, y: event.clientY, pickables: directPickables.length };
      }
      if (directHit && updateDirectVisual) {
        event.preventDefault();
        event.stopPropagation();
        controls.enabled = false;
        const profileX = selectedProfile ? numericValue(selectedProfile.geometry.x, parameters) : 0;
        const profileY = selectedProfile ? numericValue(selectedProfile.geometry.y, parameters) : 0;
        const origin = directRef.current.origin
          ? new THREE.Vector3(...directRef.current.origin)
          : new THREE.Vector3(...mapPlanePoint(profileX, profileY, selectedProfilePlane, 0.12, selectedProfilePlaneOffset));
        const normal = directRef.current.axis
          ? new THREE.Vector3(...directRef.current.axis).normalize()
          : selectedProfilePlane === 'XZ'
          ? new THREE.Vector3(0, -1, 0)
          : selectedProfilePlane === 'YZ'
            ? new THREE.Vector3(1, 0, 0)
            : new THREE.Vector3(0, 0, 1);
        const projectedStart = origin.clone().project(camera);
        const projectedEnd = origin.clone().addScaledVector(normal, 10).project(camera);
        const screenAxis = new THREE.Vector2(
          (projectedEnd.x - projectedStart.x) * rect.width / 2,
          -(projectedEnd.y - projectedStart.y) * rect.height / 2,
        );
        const pixelsPerUnit = Math.max(0.2, screenAxis.length() / 10);
        screenAxis.normalize();
        directDragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          startDistance: directRef.current.distance || 0,
          value: directRef.current.distance || 0,
          screenAxis,
          pixelsPerUnit,
        };
        try { event.currentTarget?.setPointerCapture?.(event.pointerId); } catch { /* Synthetic verification events have no native pointer capture. */ }
        renderer.domElement.style.cursor = 'ns-resize';
        setDragLabel({ value: directDragRef.current.value, x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 12 });
        return;
      }
      if (activeSketch && sketchTool) {
        const worldPoint = raycaster.ray.intersectPlane(sketchPlane, new THREE.Vector3());
        if (!worldPoint) return;
        event.preventDefault();
        renderer.domElement.focus({ preventScroll: true });
        const point = resolveSnap(event, localPoint(worldPoint), rect, { anchor: polylineDraft?.lastPoint }).point;
        const roundedPoint = [Number(point[0].toFixed(3)), Number(point[1].toFixed(3))];
        sketchPointerMoveRef.current?.(roundedPoint);
        sketchPointRef.current?.(roundedPoint);
        return;
      }
      if (activeSketch && draftType) {
        const worldPoint = raycaster.ray.intersectPlane(sketchPlane, new THREE.Vector3());
        if (!worldPoint) return;
        const point = resolveSnap(event, localPoint(worldPoint), rect, { anchor: sketchInteraction.start }).point;
        if (!sketchInteraction.start) {
          sketchInteraction.start = point;
          setSnapFeedback(null);
          return;
        }
        const deltaX = point[0] - sketchInteraction.start[0];
        const deltaY = point[1] - sketchInteraction.start[1];
        const rounded = (value) => Math.max(0.1, Math.round(Math.abs(value) * 10) / 10).toString();
        draftChangeRef.current?.(draftType === 'rectangle'
          ? { x: sketchInteraction.start[0].toFixed(1), y: sketchInteraction.start[1].toFixed(1), width: rounded(deltaX * 2), height: rounded(deltaY * 2) }
          : { x: sketchInteraction.start[0].toFixed(1), y: sketchInteraction.start[1].toFixed(1), diameter: rounded(Math.hypot(deltaX, deltaY) * 2) });
        sketchInteraction.start = null;
        setSnapFeedback(null);
        return;
      }
      if (activeSketch && sketchModifierMode === 'project') {
        const hit = raycaster.intersectObjects([...vertexPickables, ...edgePickables], false)[0];
        const topology = hit ? topologySelectionFromIntersection(hit) : null;
        if (!topology || !['vertex', 'edge'].includes(topology.kind)) return;
        event.preventDefault();
        topologySelectRef.current?.(topology, selectionMode(event));
        return;
      }
      if (activeSketch && sketchModifierMode && sketchRender) {
        const worldPoint = raycaster.ray.intersectPlane(sketchPlane, new THREE.Vector3());
        const hit = pickSketchEntity(event);
        if (!worldPoint || !hit) return;
        event.preventDefault();
        sketchModifyRef.current?.({ mode: sketchModifierMode, entityId: hit.object.userData.sketchEntityId, point: localPoint(worldPoint) });
        return;
      }
      if (activeSketch && sketchRender) {
        const worldPoint = raycaster.ray.intersectPlane(sketchPlane, new THREE.Vector3());
        const hit = selectionFilter === 'profile' ? null : pickSketchEntity(event);
        const profileHit = selectionFilter === 'profile' || !hit ? pickSketchProfile() : null;
        if (!worldPoint) return;
        event.preventDefault();
        controls.enabled = false;
        try { renderer.domElement.setPointerCapture?.(event.pointerId); } catch { /* Pointer capture is optional in synthetic tests. */ }
        if (hit) {
          const hitId = hit.object.userData.sketchEntityId;
          const existing = selectedSketchEntityIds.includes(hitId) && !event.ctrlKey && !event.shiftKey;
          const entityIds = existing ? [...selectedSketchEntityIds] : [hitId];
          sketchInteraction.drag = {
            hitId,
            entityIds,
            pointIds: movingPointIds(entityIds),
            mode: selectionMode(event),
            startClientX: event.clientX,
            startClientY: event.clientY,
            start: localPoint(worldPoint),
            dx: 0,
            dy: 0,
            moved: false,
          };
          setSketchHover(null);
        } else {
          sketchInteraction.box = {
            startX: event.clientX,
            startY: event.clientY,
            endX: event.clientX,
            endY: event.clientY,
            mode: selectionMode(event),
            profileId: profileHit?.object?.userData?.sketchProfileId || null,
          };
          setSelectionBox({ left: event.clientX - rect.left, top: event.clientY - rect.top, width: 0, height: 0, crossing: false });
        }
        return;
      }
      if (activeSketch) return;
      const hit = pickModel(event, event.altKey);
      if (event.shiftKey && !hit) {
        event.preventDefault();
        controls.enabled = false;
        try { renderer.domElement.setPointerCapture?.(event.pointerId); } catch { /* Pointer capture is optional in synthetic tests. */ }
        modelSelectionBox = {
          startX: event.clientX,
          startY: event.clientY,
          endX: event.clientX,
          endY: event.clientY,
          mode: selectionMode(event),
        };
        setSelectionBox({ left: event.clientX - rect.left, top: event.clientY - rect.top, width: 0, height: 0, crossing: false });
        return;
      }
      const topologySelection = topologySelectionFromIntersection(hit);
      if (topologySelection && selectionFilter === 'body') {
        topologySelection.kind = 'body';
        topologySelection.id = topologySelection.bodyId;
      }
      if (topologySelection && topologySelectRef.current) topologySelectRef.current(topologySelection, selectionMode(event));
      else selectRef.current?.(topologySelection?.bodyId || null);
    };
    const onPointerMove = (event) => {
      const directDrag = directDragRef.current;
      if (directDrag && updateDirectVisual) {
        event.preventDefault();
        const delta = new THREE.Vector2(event.clientX - directDrag.startX, event.clientY - directDrag.startY);
        const raw = directDrag.startDistance + delta.dot(directDrag.screenAxis) / directDrag.pixelsPerUnit;
        const step = directRef.current.snapEnabled && !event.altKey ? 1 : 0.1;
        const value = Math.min(directRef.current.max, Math.max(directRef.current.min, Math.round(raw / step) * step));
        directDrag.value = value;
        updateDirectVisual(value, true);
        const rect = renderer.domElement.getBoundingClientRect();
        setDragLabel({ value, x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 12 });
        if (window.__madcadPointerLog) window.__madcadPointerLog.moveValue = value;
        return;
      }
      if (modelSelectionBox) {
        event.preventDefault();
        const rect = renderer.domElement.getBoundingClientRect();
        modelSelectionBox.endX = event.clientX;
        modelSelectionBox.endY = event.clientY;
        setSelectionBox({
          left: Math.min(modelSelectionBox.startX, modelSelectionBox.endX) - rect.left,
          top: Math.min(modelSelectionBox.startY, modelSelectionBox.endY) - rect.top,
          width: Math.abs(modelSelectionBox.endX - modelSelectionBox.startX),
          height: Math.abs(modelSelectionBox.endY - modelSelectionBox.startY),
          crossing: modelSelectionBox.endX < modelSelectionBox.startX,
        });
        return;
      }
      if (sketchInteraction.drag && sketchRender) {
        event.preventDefault();
        const sketchDrag = sketchInteraction.drag;
        const rect = setRayFromEvent(event);
        const worldPoint = raycaster.ray.intersectPlane(sketchPlane, new THREE.Vector3());
        if (!worldPoint) return;
        const current = localPoint(worldPoint);
        const referencePointId = sketchDrag.pointIds[0];
        const referencePoint = sketchRender.coordinates.get(referencePointId);
        const rawDx = current[0] - sketchDrag.start[0];
        const rawDy = current[1] - sketchDrag.start[1];
        const snappedReference = referencePoint
          ? resolveSnap(event, [referencePoint[0] + rawDx, referencePoint[1] + rawDy], rect, { excludePointIds: sketchDrag.pointIds }).point
          : current;
        const step = directRef.current.snapEnabled && !event.altKey && !referencePoint ? 1 : 0.1;
        const dx = referencePoint ? snappedReference[0] - referencePoint[0] : Math.round(rawDx / step) * step;
        const dy = referencePoint ? snappedReference[1] - referencePoint[1] : Math.round(rawDy / step) * step;
        sketchDrag.dx = dx;
        sketchDrag.dy = dy;
        sketchDrag.moved = Math.hypot(event.clientX - sketchDrag.startClientX, event.clientY - sketchDrag.startClientY) >= 3;
        const overrides = new Map(sketchDrag.pointIds.map((pointId) => {
          const point = sketchRender.coordinates.get(pointId);
          return [pointId, point ? [point[0] + dx, point[1] + dy] : null];
        }).filter(([, point]) => point));
        sketchRender.update(overrides);
        setSketchDragLabel({ dx, dy, x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 28 });
        renderer.domElement.style.cursor = 'move';
        return;
      }
      if (!activeSketch && !directDrag) {
        setRayFromEvent(event);
        setModelHover(pickModel(event, false));
      }
      if (sketchInteraction.box) {
        event.preventDefault();
        const sketchBox = sketchInteraction.box;
        const rect = renderer.domElement.getBoundingClientRect();
        sketchBox.endX = event.clientX;
        sketchBox.endY = event.clientY;
        setSelectionBox({
          left: Math.min(sketchBox.startX, sketchBox.endX) - rect.left,
          top: Math.min(sketchBox.startY, sketchBox.endY) - rect.top,
          width: Math.abs(sketchBox.endX - sketchBox.startX),
          height: Math.abs(sketchBox.endY - sketchBox.startY),
          crossing: sketchBox.endX < sketchBox.startX,
        });
        return;
      }
      if (activeSketch && sketchTool) {
        const rect = setRayFromEvent(event);
        const worldPoint = raycaster.ray.intersectPlane(sketchPlane, new THREE.Vector3());
        if (!worldPoint) return;
        const point = resolveSnap(event, localPoint(worldPoint), rect, { anchor: polylineDraft?.lastPoint }).point;
        const roundedPoint = [Number(point[0].toFixed(3)), Number(point[1].toFixed(3))];
        sketchPointerMoveRef.current?.(roundedPoint);
        if (sketchPreviewLine && polylineDraft?.lastPoint) {
          const deltaX = point[0] - polylineDraft.lastPoint[0];
          const deltaY = point[1] - polylineDraft.lastPoint[1];
          setSketchDynamicLabel({
            x: event.clientX - rect.left + 16,
            y: event.clientY - rect.top - 12,
            distance: Math.hypot(deltaX, deltaY),
            angle: Math.atan2(deltaY, deltaX) * 180 / Math.PI,
          });
          const position = sketchPreviewLine.geometry.getAttribute('position');
          const mapped = mapPlanePoint(point[0], point[1], activePlane, 0.09, activePlaneOffset);
          position.setXYZ(1, ...mapped);
          position.needsUpdate = true;
          sketchPreviewLine.computeLineDistances();
        }
        return;
      }
      if (activeSketch && draftType) {
        const rect = setRayFromEvent(event);
        const worldPoint = raycaster.ray.intersectPlane(sketchPlane, new THREE.Vector3());
        if (worldPoint) resolveSnap(event, localPoint(worldPoint), rect, { anchor: sketchInteraction.start });
        return;
      }
      if (activeSketch && sketchRender && !sketchTool && !draftType) {
        setSnapFeedback(null);
        setRayFromEvent(event);
        setSketchHover(pickSketchEntity(event)?.object || null);
      }
    };
    const onPointerUp = (event) => {
      if (window.__madcadPointerLog) window.__madcadPointerLog.upCalled = true;
      const directDrag = directDragRef.current;
      if (modelSelectionBox) {
        event.preventDefault();
        const finished = modelSelectionBox;
        modelSelectionBox = null;
        controls.enabled = true;
        try { renderer.domElement.releasePointerCapture?.(event.pointerId); } catch { /* Pointer capture may already be released. */ }
        const moved = Math.hypot(finished.endX - finished.startX, finished.endY - finished.startY) >= 3;
        const selections = moved ? boxSelectedModelTopology(finished) : [];
        selections.forEach((selection, index) => topologySelectRef.current?.(selection, index ? 'add' : finished.mode));
        setSelectionBox(null);
        renderer.domElement.style.cursor = navigationMode === 'pan' ? 'move' : 'grab';
        return;
      }
      if (sketchInteraction.drag) {
        event.preventDefault();
        const finished = sketchInteraction.drag;
        sketchInteraction.drag = null;
        controls.enabled = true;
        try { renderer.domElement.releasePointerCapture?.(event.pointerId); } catch { /* Pointer capture may already be released. */ }
        setSketchDragLabel(null);
        setSnapFeedback(null);
        renderer.domElement.style.cursor = 'crosshair';
        if (finished.moved && (Math.abs(finished.dx) > 1e-9 || Math.abs(finished.dy) > 1e-9)) {
          if (!selectedSketchEntityIds.includes(finished.hitId)) sketchSelectionRef.current?.(finished.entityIds, finished.mode);
          sketchMoveRef.current?.({ ids: finished.entityIds, dx: finished.dx, dy: finished.dy });
        } else {
          sketchRender?.update();
          sketchSelectionRef.current?.([finished.hitId], finished.mode);
        }
        return;
      }
      if (sketchInteraction.box) {
        event.preventDefault();
        const finished = sketchInteraction.box;
        sketchInteraction.box = null;
        controls.enabled = true;
        try { renderer.domElement.releasePointerCapture?.(event.pointerId); } catch { /* Pointer capture may already be released. */ }
        const moved = Math.hypot(finished.endX - finished.startX, finished.endY - finished.startY) >= 3;
        const ids = moved ? boxSelectedIds(finished) : [];
        if (!moved && finished.profileId) sketchProfileSelectionRef.current?.(finished.profileId);
        else sketchSelectionRef.current?.(ids, finished.mode, { crossing: finished.endX < finished.startX });
        setSelectionBox(null);
        setSnapFeedback(null);
        renderer.domElement.style.cursor = 'crosshair';
        return;
      }
      if (!directDrag) {
        if (window.__madcadPointerLog) window.__madcadPointerLog.upWithoutDrag = true;
        return;
      }
      event.preventDefault();
      const value = directDrag.value;
      directDragRef.current = null;
      controls.enabled = true;
      try { event.currentTarget?.releasePointerCapture?.(event.pointerId); } catch { /* Pointer capture may already be released. */ }
      renderer.domElement.style.cursor = navigationMode === 'pan' ? 'move' : 'grab';
      setDragLabel(null);
      updateDirectVisual?.(value, false);
      directRef.current.onCommit?.(Number(value.toFixed(1)));
      if (window.__madcadPointerLog) window.__madcadPointerLog.committed = value;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    const onPointerLeave = () => {
      if (!sketchInteraction.drag && !sketchInteraction.box) setSnapFeedback(null);
      setSketchDynamicLabel(null);
      setModelHover(null);
    };
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    const directHandleElement = directHandleRef.current;
    directEventRef.current = { down: onPointerDown, move: onPointerMove, up: onPointerUp };

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      controls.update();
      camera.updateMatrixWorld(true);
      if (directHead && new URLSearchParams(window.location.search).has('verify')) {
        directGroup.updateMatrixWorld(true);
        const point = directHead.getWorldPosition(new THREE.Vector3()).project(camera);
        const rect = renderer.domElement.getBoundingClientRect();
        window.__madcadDirectHandlePoint = {
          x: Math.round(rect.left + (point.x + 1) * rect.width / 2),
          y: Math.round(rect.top + (1 - point.y) * rect.height / 2),
        };
      }
      if (directHead && directHandleElement) {
        directGroup.updateMatrixWorld(true);
        const point = directHead.getWorldPosition(new THREE.Vector3()).project(camera);
        directHandleElement.style.left = `${(point.x + 1) * width / 2}px`;
        directHandleElement.style.top = `${(1 - point.y) * height / 2}px`;
      }
      if (sketchRender && new URLSearchParams(window.location.search).has('verify')) {
        sketchGroup.updateMatrixWorld(true);
        const rect = renderer.domElement.getBoundingClientRect();
        const screenPoints = {};
        for (const entry of sketchRender.entries) {
          let worldPoint;
          if (entry.entity.type === 'point') worldPoint = entry.object.getWorldPosition(new THREE.Vector3());
          else {
            const position = entry.object.geometry.getAttribute('position');
            worldPoint = new THREE.Vector3();
            for (let index = 0; index < position.count; index += 1) worldPoint.add(new THREE.Vector3().fromBufferAttribute(position, index));
            worldPoint.multiplyScalar(1 / Math.max(1, position.count)).applyMatrix4(entry.object.matrixWorld);
          }
          const point = worldPoint.project(camera);
          screenPoints[entry.entity.id] = {
            type: entry.entity.type,
            state: entry.object.userData.sketchState,
            x: Math.round(rect.left + (point.x + 1) * rect.width / 2),
            y: Math.round(rect.top + (1 - point.y) * rect.height / 2),
          };
        }
        window.__madcadSketchEntityScreenPoints = screenPoints;
        window.__madcadSketchLocalToScreen = (x, y) => {
          const point = new THREE.Vector3(...mapPlanePoint(Number(x), Number(y), activePlane, 0.2, activePlaneOffset)).project(camera);
          return {
            x: Math.round(rect.left + ((point.x + 1) * rect.width) / 2),
            y: Math.round(rect.top + ((1 - point.y) * rect.height) / 2),
          };
        };
        window.__madcadVerifySketchBoxSelection = (box, mode = 'replace') => {
          const ids = boxSelectedIds(box);
          sketchSelectionRef.current?.(ids, mode, { crossing: box.endX < box.startX });
          return ids;
        };
        window.__madcadSketchVisibilityState = {
          entityIds: sketchRender.entries.map((entry) => entry.entity.id),
          profileCount: sketchProfileRender?.pickables?.length || 0,
          showSketchProfiles,
          showSketchConstraints,
          showSketchDimensions,
          showConstructionGeometry,
          showProjectedGeometry,
          sliceModel,
        };
      }
      if (!activeSketch && bodies.length && new URLSearchParams(window.location.search).has('verify')) {
        modelGroup.updateMatrixWorld(true);
        const bodyBounds = {};
        const topologyPoints = {};
        for (const object of facePickables) {
          const points = projectedPoints(object);
          if (points.length) bodyBounds[object.userData.bodyId] = {
            left: Math.min(...points.map((point) => point[0])),
            right: Math.max(...points.map((point) => point[0])),
            top: Math.min(...points.map((point) => point[1])),
            bottom: Math.max(...points.map((point) => point[1])),
          };
          const index = object.geometry.getIndex();
          for (const group of object.userData.faceGroups || []) {
            const vertexIndices = [...new Set(Array.from({ length: group.count }, (_, offset) => index.getX(group.start + offset)))];
            const facePoints = projectedPoints(object, vertexIndices);
            if (!facePoints.length) continue;
            topologyPoints[group.topologyId] = {
              kind: 'face',
              x: facePoints.reduce((total, point) => total + point[0], 0) / facePoints.length,
              y: facePoints.reduce((total, point) => total + point[1], 0) / facePoints.length,
            };
          }
        }
        for (const object of [...edgePickables, ...vertexPickables]) {
          const points = projectedPoints(object);
          if (!points.length) continue;
          topologyPoints[object.userData.topologyId] = {
            kind: object.userData.topologyKind,
            x: points.reduce((total, point) => total + point[0], 0) / points.length,
            y: points.reduce((total, point) => total + point[1], 0) / points.length,
          };
        }
        window.__madcadModelScreenState = { bodyBounds, topologyPoints };
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      directEventRef.current = {};
      controls.dispose();
      disposeObject(modelGroup);
      disposeObject(sketchGroup);
      disposeObject(directGroup);
      disposeObject(constructionGroup);
      disposeObject(sectionGroup);
      if (plate) disposeObject(plate);
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
      delete window.__madcadDirectHandlePoint;
      delete window.__madcadSketchEntityScreenPoints;
      delete window.__madcadSketchLocalToScreen;
      delete window.__madcadVerifySketchBoxSelection;
      delete window.__madcadSketchVisibilityState;
      delete window.__madcadModelScreenState;
      delete window.__madcadModelHover;
      delete window.__madcadConstructionPlaneState;
      delete window.__madcadConstructionAxisState;
      delete window.__madcadConstructionPointState;
      delete window.__madcadSectionViewState;
    };
  // Scalar projections intentionally keep the expensive Three.js scene lifecycle stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodies, selectedBodySet, selectedTopologySet, selectionFilter, constructionPlanes, constructionAxes, constructionPoints, selectedConstructionId, selectedConstructionAxisId, selectedConstructionPointId, bed, showBed, showGrid, view, activeSketchId, activePlane, activeSketch, draftProfile, draftType, sketchTool, polylineDraft, parameters, directEnabled, selectedProfile?.id, selectedProfilePlane, selectedProfilePlaneOffset, directManipulator?.kind, directManipulator?.origin?.join(','), directManipulator?.axis?.join(','), navigationMode, zoomScale, selectedSketchEntityIds, lostProjectedEntityIds, showSketchPoints, showSketchProfiles, showSketchConstraints, showSketchDimensions, showConstructionGeometry, showProjectedGeometry, sliceModel, sectionAnalysis?.enabled, sectionAnalysis?.plane, sectionAnalysis?.offset, sectionAnalysis?.flip, snapThresholdPx, sketchModifierMode]);

  return (
    <div
      className={`model-viewport ${activeSketchId ? 'sketch-view' : ''}`}
      ref={hostRef}
      onContextMenu={(event) => {
        if (!activeSketchId || !sketchTool) return;
        event.preventDefault();
        onSketchFinish?.();
      }}
    >
      <div className="view-cube" role="toolbar" aria-label="Kostka widoku">
        <button className="cube-top" type="button" title="Ustaw kamerę prostopadle do płaszczyzny XY." onClick={() => setView('top')}>GÓRA</button>
        <button className="cube-main" type="button" onClick={() => setView('iso')} title="Widok izometryczny"><Box size={34} strokeWidth={1.2} /></button>
        <button className="cube-front" type="button" title="Ustaw kamerę na widok z przodu." onClick={() => setView('front')}>PRZÓD</button>
        <button className="cube-right" type="button" title="Ustaw kamerę na widok z prawej strony." onClick={() => setView('right')}>PRAWO</button>
      </div>
      <div className="axis-indicator" aria-hidden="true"><span className="axis-x">X</span><span className="axis-y">Y</span><span className="axis-z">Z</span></div>
      {!activeSketchId && bodies.length > 0 && <div className="selection-filter-bar" role="toolbar" aria-label="Filtr wyboru geometrii">
        {[
          ['auto', 'Auto'],
          ['body', 'Bryła'],
          ['face', 'Ściana'],
          ['edge', 'Krawędź'],
          ['vertex', 'Wierzchołek'],
          ['profile', 'Profil'],
        ].filter(([id]) => id !== 'profile').map(([id, label]) => <button key={id} className={selectionFilter === id ? 'active' : ''} type="button" title={`Filtr wyboru: ${label}`} onClick={() => setSelectionFilter(id)}>{label}</button>)}
      </div>}
      {!activeSketchId && bodies.length > 0 && <div className="model-selection-hint">{`Ctrl/Shift: wiele · ${optionKeyLabel}+klik: przełącz · Shift+przeciągnij tło: obszar`}</div>}
      {directEnabled && (
        <div
          ref={directHandleRef}
          className="direct-handle-hit"
          title={directManipulator?.hint || 'Przeciągnij strzałkę, aby ustawić odległość wyciągnięcia.'}
          aria-label={directManipulator?.label || 'Przeciągnij wyciągnięcie'}
          onPointerDown={(event) => directEventRef.current.down?.(event)}
          onPointerMove={(event) => directEventRef.current.move?.(event)}
          onPointerUp={(event) => directEventRef.current.up?.(event)}
          onPointerCancel={(event) => directEventRef.current.up?.(event)}
        />
      )}
      <div className="navigation-bar" role="toolbar" aria-label="Nawigacja widoku">
        <button className={navigationMode === 'orbit' ? 'active' : ''} type="button" title="Orbita: przeciągnij lewym przyciskiem, aby obracać widok." onClick={() => { setNavigationMode('orbit'); setView('iso'); }}><Orbit size={16} /></button>
        <button className={navigationMode === 'pan' ? 'active' : ''} type="button" title="Przesuwanie: przeciągnij lewym przyciskiem, aby przesunąć widok." onClick={() => setNavigationMode((mode) => mode === 'pan' ? 'orbit' : 'pan')}><Move3d size={16} /></button>
        <button type="button" title="Powiększ model w bieżącym widoku." onClick={() => setZoomScale((scale) => Math.max(0.35, scale * 0.78))}><ZoomIn size={16} /></button>
        <button type="button" title="Dopasuj cały model do dostępnego obszaru." onClick={() => { setZoomScale(1); setView(activeSketchId ? (activePlane === 'XZ' ? 'front' : activePlane === 'YZ' ? 'right' : 'top') : 'iso'); }}><Maximize2 size={16} /></button>
      </div>
      {directEnabled && <div className="direct-extrude-hint">{directManipulator?.hint || 'Przeciągnij niebieską strzałkę, aby wyciągnąć profil'}</div>}
      {dragLabel && <div className="direct-dimension" style={{ left: dragLabel.x, top: dragLabel.y }}>{dragLabel.value.toFixed(1)} mm</div>}
      {sketchDragLabel && <div className="sketch-drag-dimension" style={{ left: sketchDragLabel.x, top: sketchDragLabel.y }}>ΔX {sketchDragLabel.dx.toFixed(1)} · ΔY {sketchDragLabel.dy.toFixed(1)} mm</div>}
      {sketchDynamicLabel && activeSketchId && ['line', 'polyline'].includes(sketchTool) && polylineDraft?.lastPoint && (
        <div className={`sketch-dynamic-input ${sketchDynamicLength ? 'typing' : ''}`} style={{ left: sketchDynamicLabel.x, top: sketchDynamicLabel.y }} role="status">
          <strong>{sketchDynamicLength || sketchDynamicLabel.distance.toFixed(2)}</strong>
          <span>mm</span>
          <small>{sketchDynamicLabel.angle.toFixed(1)}°</small>
        </div>
      )}
      {snapFeedback && (() => {
        const SnapIcon = SNAP_ICONS[snapFeedback.type] || Crosshair;
        return (
        <>
          <svg className="sketch-snap-guides" aria-hidden="true">
            {snapFeedback.guides.map((guide, index) => <line key={`${snapFeedback.type}-${index}`} {...guide} />)}
          </svg>
          <div className={`sketch-snap-marker ${snapFeedback.type} ${snapFeedback.placement}`} style={{ left: snapFeedback.x, top: snapFeedback.y }} data-snap-type={snapFeedback.type} role="status" aria-live="polite" aria-label={`Snap: ${snapFeedback.label}`}><i><SnapIcon size={13} strokeWidth={2.4} /></i><span><b>SNAP</b>{snapFeedback.label}</span></div>
        </>
        );
      })()}
      {activeSketchId && selectedSketchEntityIds.length > 0 && onDeleteSketchSelection && (
        <div className="sketch-selection-actions" role="toolbar" aria-label="Akcje zaznaczenia szkicu">
          <span>{selectedSketchEntityIds.length === 1 ? '1 element zaznaczony' : `${selectedSketchEntityIds.length} elementy zaznaczone`}</span>
          <button type="button" title={`Usuń zaznaczenie (${window.desktopApp?.platform === 'darwin' ? '⌫' : 'Delete'})`} onClick={onDeleteSketchSelection}><Trash2 size={14} /> Usuń <kbd>{window.desktopApp?.platform === 'darwin' ? '⌫' : 'Del'}</kbd></button>
        </div>
      )}
      {selectionBox && <div className={`sketch-selection-box ${selectionBox.crossing ? 'crossing' : 'inside'}`} style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }} />}
      {activeSketch?.diagnostics?.length > 0 && (
        <div className="sketch-diagnostics" role="status">
          <strong>Obrys wymaga poprawy</strong>
          {activeSketch.diagnostics.slice(0, 3).map((entry, index) => <span key={`${entry.code}-${index}`}>{entry.message}</span>)}
          {activeSketch.diagnostics.length > 3 && <small>+{activeSketch.diagnostics.length - 3} kolejnych problemów</small>}
        </div>
      )}
      {solverAnalysis && (
        <div className={`sketch-solver-status ${isEmptySketch ? 'empty' : solverAnalysis.status}`} role="status">
          <i />
          <strong>{isEmptySketch ? 'Pusty szkic' : solverAnalysis.status === SKETCH_SOLVER_STATUS.FULLY_CONSTRAINED ? 'W pełni związany' : solverAnalysis.status === SKETCH_SOLVER_STATUS.CONFLICT ? 'Konflikt więzów' : solverAnalysis.status === SKETCH_SOLVER_STATUS.OVER_CONSTRAINED ? 'Nadmiar więzów' : 'Niedowiązany'}</strong>
          <span>{isEmptySketch ? 'Dodaj geometrię' : solverAnalysis.degreesOfFreedom === null ? '—' : `${solverAnalysis.degreesOfFreedom} DOF`}</span>
        </div>
      )}
      {activeSketchId && activeSketch?.constraints?.length > 0 && (showSketchConstraints || showSketchDimensions) && (
        <div className="sketch-constraint-badges" aria-label="Wiązania szkicu">
          {activeSketch.constraints.filter((constraint) => {
            const isDimension = activeSketch.dimensions?.some((dimension) => dimension.constraintId === constraint.id);
            return isDimension ? showSketchDimensions : showSketchConstraints;
          }).map((constraint) => {
            const labels = { fixed: 'F', coincident: '●', horizontal: 'H', vertical: 'V', distance: '↔', distanceX: 'X', distanceY: 'Y', angle: '∠', radius: 'R', diameter: 'Ø', tangent: 'T', equal: '=', collinear: 'C', symmetry: 'S', curvature: 'κ', coordinateX: 'OX', coordinateY: 'OY', arcLength: '⌒' };
            const conflicting = solverAnalysis?.conflictConstraintIds?.includes(constraint.id);
            return <button key={constraint.id} className={`${selectedSketchConstraintId === constraint.id ? 'selected' : ''} ${conflicting ? 'conflict' : ''}`} type="button" title={`${constraint.type}${constraint.value !== undefined ? `: ${constraint.value}` : ''}`} onClick={() => onSketchConstraintSelection?.(constraint.id)}>{labels[constraint.type] || '?'}</button>;
          })}
        </div>
      )}
      {showSketchDimensions && selectedSketchConstraintId && activeSketch?.constraints?.some((constraint) => constraint.id === selectedSketchConstraintId && constraint.value !== undefined) && (
        <form className="sketch-constraint-editor" key={`${selectedSketchConstraintId}:${activeSketch.constraints.find((constraint) => constraint.id === selectedSketchConstraintId)?.value}`} onSubmit={(event) => {
          event.preventDefault();
          onSketchConstraintValueChange?.(selectedSketchConstraintId, new FormData(event.currentTarget).get('constraintValue'));
        }}>
          <label>Wartość więzu</label>
          <input name="constraintValue" defaultValue={activeSketch.constraints.find((constraint) => constraint.id === selectedSketchConstraintId)?.value} aria-label="Wartość wybranego więzu" autoFocus />
          <button type="submit">Zastosuj</button>
        </form>
      )}
      {activeSketchId && <div className="sketch-plane-badge"><PencilRulerIcon /> Szkic · {activePlane}</div>}
      {activeSketchId && sliceModel && <div className="sketch-slice-badge">Slice · przekrój na {activePlane}</div>}
      {activeSketchId && draftType && <div className="sketch-pointer-hint">Kliknij środek, a następnie punkt rozmiaru</div>}
      {activeSketchId && sketchModifierMode && <div className="sketch-pointer-hint">{sketchModifierMode === 'trim' ? 'Trim · kliknij fragment do usunięcia' : sketchModifierMode === 'extend' ? 'Extend · kliknij koniec do przedłużenia' : sketchModifierMode === 'project' ? 'Project · kliknij punkt lub krawędź modelu, potem ponownie Project' : 'Break · kliknij miejsce podziału'} · Escape kończy</div>}
      {activeSketchId && sketchTool && <div className="sketch-pointer-hint">{`${sketchToolPrompt || 'Klikaj kolejne punkty'} · ${optionKeyLabel} chwilowo wyłącza snap · ${sketchTool === 'line' && polylineDraft?.lastPoint ? 'Wpisz długość i Enter albo kliknij koniec' : 'Enter lub prawy przycisk kończy'} · Escape anuluje`}</div>}
      {activeSketchId && !sketchTool && !draftType && !sketchModifierMode && <div className="sketch-pointer-hint">Kliknij lub przeciągnij geometrię · Ctrl/Shift wybiera wiele · przeciągnij tło, aby wybrać oknem</div>}
    </div>
  );
}

function PencilRulerIcon() {
  return <span className="sketch-badge-mark" aria-hidden="true"><Square size={12} /></span>;
}
