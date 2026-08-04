import React, { useEffect, useRef, useState } from 'react';
import { Box, Maximize2, Move3d, Orbit, Square, ZoomIn } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const VIEW_DIRECTIONS = {
  iso: [1.25, -1.45, 1.15],
  top: [0, 0, 2],
  front: [0, -2, 0],
  right: [2, 0, 0],
};

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
  const parameter = parameters.find((item) => item.name === value);
  const parameterValue = Number(parameter?.expression);
  return Number.isFinite(parameterValue) ? parameterValue : 10;
}

function mapPlanePoint(x, y, plane, z = 0.04) {
  if (plane === 'XZ') return [x, -z, y];
  if (plane === 'YZ') return [z, x, y];
  return [x, y, z];
}

function profilePoints(profile, parameters, plane) {
  const x = numericValue(profile.geometry.x, parameters);
  const y = numericValue(profile.geometry.y, parameters);
  if (profile.type === 'rectangle') {
    const halfWidth = numericValue(profile.geometry.width, parameters) / 2;
    const halfHeight = numericValue(profile.geometry.height, parameters) / 2;
    return [
      mapPlanePoint(x - halfWidth, y - halfHeight, plane),
      mapPlanePoint(x + halfWidth, y - halfHeight, plane),
      mapPlanePoint(x + halfWidth, y + halfHeight, plane),
      mapPlanePoint(x - halfWidth, y + halfHeight, plane),
      mapPlanePoint(x - halfWidth, y - halfHeight, plane),
    ];
  }
  const radius = numericValue(profile.geometry.diameter, parameters) / 2;
  return Array.from({ length: 73 }, (_, index) => {
    const angle = (index / 72) * Math.PI * 2;
    return mapPlanePoint(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, plane);
  });
}

function addSketchLine(group, profile, parameters, plane, draft = false) {
  const points = profilePoints(profile, parameters, plane).flat();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({
    color: draft ? 0x49d7ff : 0x93d9f2,
    transparent: true,
    opacity: draft ? 1 : 0.92,
  });
  group.add(new THREE.Line(geometry, material));
}

function configureGrid(grid, plane) {
  if (plane === 'XY') grid.rotation.x = Math.PI / 2;
  else if (plane === 'YZ') grid.rotation.z = Math.PI / 2;
}

export default function ModelViewport({
  bodies,
  sketches = [],
  activeSketchId,
  draftProfile,
  draftType,
  onDraftChange,
  parameters = [],
  showGrid = true,
  selectedBodyId,
  onSelectBody,
  bed,
  showBed,
}) {
  const hostRef = useRef(null);
  const selectRef = useRef(onSelectBody);
  const draftChangeRef = useRef(onDraftChange);
  const [view, setView] = useState('iso');
  const activeSketch = sketches.find((sketch) => sketch.id === activeSketchId);
  const activePlane = activeSketch?.plane || 'XY';
  selectRef.current = onSelectBody;
  draftChangeRef.current = onDraftChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#2c333e');
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100000);
    camera.up.set(0, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
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
    configureGrid(grid, activeSketchId ? activePlane : 'XY');
    grid.position.z = activePlane === 'XY' ? -0.03 : 0;
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
    const pickables = [];
    for (const body of bodies) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(body.vertices, 3));
      if (body.normals.length) geometry.setAttribute('normal', new THREE.BufferAttribute(body.normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(body.triangles, 1));
      geometry.computeBoundingSphere();
      const selected = body.id === selectedBodyId;
      const material = new THREE.MeshStandardMaterial({
        color: selected ? '#72c9eb' : body.color,
        metalness: 0.08,
        roughness: 0.56,
        emissive: selected ? '#10394a' : '#000000',
        emissiveIntensity: selected ? 0.7 : 0,
        transparent: Boolean(activeSketchId),
        opacity: activeSketchId ? 0.38 : 1,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.bodyId = body.id;
      modelGroup.add(mesh);
      pickables.push(mesh);

      if (body.lines.length) {
        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setAttribute('position', new THREE.BufferAttribute(body.lines, 3));
        const edgeMaterial = new THREE.LineBasicMaterial({ color: selected ? 0xe4f8ff : 0x26333b, transparent: true, opacity: activeSketchId ? 0.34 : 0.72 });
        modelGroup.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
      }
    }
    scene.add(modelGroup);

    const sketchGroup = new THREE.Group();
    if (activeSketch) {
      const axisLength = gridSize / 2;
      const xAxisGeometry = new THREE.BufferGeometry();
      xAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
        ...mapPlanePoint(-axisLength, 0, activePlane, 0.06),
        ...mapPlanePoint(axisLength, 0, activePlane, 0.06),
      ], 3));
      sketchGroup.add(new THREE.Line(xAxisGeometry, new THREE.LineBasicMaterial({ color: 0xd85b61, transparent: true, opacity: 0.9 })));
      const yAxisGeometry = new THREE.BufferGeometry();
      yAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
        ...mapPlanePoint(0, -axisLength, activePlane, 0.06),
        ...mapPlanePoint(0, axisLength, activePlane, 0.06),
      ], 3));
      sketchGroup.add(new THREE.Line(yAxisGeometry, new THREE.LineBasicMaterial({ color: 0x54c978, transparent: true, opacity: 0.9 })));
      activeSketch.profiles.forEach((profile) => addSketchLine(sketchGroup, profile, parameters, activePlane));
      if (draftProfile) addSketchLine(sketchGroup, draftProfile, parameters, activePlane, true);
      scene.add(sketchGroup);
    }

    const modelBox = bodies.length ? new THREE.Box3().setFromObject(modelGroup) : null;
    const center = modelBox ? modelBox.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);
    if (activeSketch) center.set(0, 0, 0);
    const size = modelBox ? modelBox.getSize(new THREE.Vector3()) : new THREE.Vector3(80, 60, 20);
    const radius = Math.max(size.x, size.y, size.z, 55);
    const sketchView = activePlane === 'XZ' ? 'front' : activePlane === 'YZ' ? 'right' : 'top';
    const direction = VIEW_DIRECTIONS[activeSketch ? sketchView : view] || VIEW_DIRECTIONS.iso;
    camera.position.set(center.x + direction[0] * radius * 1.7, center.y + direction[1] * radius * 1.7, center.z + direction[2] * radius * 1.7);
    controls.target.copy(center);
    controls.enableRotate = !activeSketch;
    controls.update();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let sketchStart = null;
    const sketchPlane = activePlane === 'XZ'
      ? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      : activePlane === 'YZ'
        ? new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)
        : new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const localPoint = (point) => activePlane === 'XZ' ? [point.x, point.z] : activePlane === 'YZ' ? [point.y, point.z] : [point.x, point.y];
    const onPointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (activeSketch && draftType) {
        const worldPoint = raycaster.ray.intersectPlane(sketchPlane, new THREE.Vector3());
        if (!worldPoint) return;
        const point = localPoint(worldPoint);
        if (!sketchStart) {
          sketchStart = point;
          return;
        }
        const deltaX = point[0] - sketchStart[0];
        const deltaY = point[1] - sketchStart[1];
        const rounded = (value) => Math.max(0.1, Math.round(Math.abs(value) * 10) / 10).toString();
        draftChangeRef.current?.(draftType === 'rectangle'
          ? { x: sketchStart[0].toFixed(1), y: sketchStart[1].toFixed(1), width: rounded(deltaX * 2), height: rounded(deltaY * 2) }
          : { x: sketchStart[0].toFixed(1), y: sketchStart[1].toFixed(1), diameter: rounded(Math.hypot(deltaX, deltaY) * 2) });
        sketchStart = null;
        return;
      }
      if (activeSketch) return;
      const hit = raycaster.intersectObjects(pickables, false)[0];
      selectRef.current?.(hit?.object?.userData?.bodyId || null);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
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
      controls.dispose();
      disposeObject(modelGroup);
      disposeObject(sketchGroup);
      if (plate) disposeObject(plate);
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [bodies, selectedBodyId, bed, showBed, showGrid, view, activeSketchId, activePlane, activeSketch, draftProfile, draftType, parameters]);

  return (
    <div className={`model-viewport ${activeSketchId ? 'sketch-view' : ''}`} ref={hostRef}>
      <div className="view-cube" aria-label="Kostka widoku">
        <button className="cube-top" type="button" onClick={() => setView('top')}>GÓRA</button>
        <button className="cube-main" type="button" onClick={() => setView('iso')} title="Widok izometryczny"><Box size={34} strokeWidth={1.2} /></button>
        <button className="cube-front" type="button" onClick={() => setView('front')}>PRZÓD</button>
        <button className="cube-right" type="button" onClick={() => setView('right')}>PRAWO</button>
      </div>
      <div className="axis-indicator" aria-hidden="true"><span className="axis-x">X</span><span className="axis-y">Y</span><span className="axis-z">Z</span></div>
      <div className="navigation-bar" aria-label="Nawigacja widoku">
        <button type="button" title="Orbita" onClick={() => setView('iso')}><Orbit size={16} /></button>
        <button type="button" title="Przesuń"><Move3d size={16} /></button>
        <button type="button" title="Powiększ"><ZoomIn size={16} /></button>
        <button type="button" title="Dopasuj" onClick={() => setView(activeSketchId ? (activePlane === 'XZ' ? 'front' : activePlane === 'YZ' ? 'right' : 'top') : 'iso')}><Maximize2 size={16} /></button>
      </div>
      {activeSketchId && <div className="sketch-plane-badge"><PencilRulerIcon /> Szkic · {activePlane}</div>}
      {activeSketchId && draftType && <div className="sketch-pointer-hint">Kliknij środek, a następnie punkt rozmiaru</div>}
    </div>
  );
}

function PencilRulerIcon() {
  return <span className="sketch-badge-mark" aria-hidden="true"><Square size={12} /></span>;
}
