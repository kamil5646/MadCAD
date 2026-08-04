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
  selectedProfile,
  selectedProfilePlane = 'XY',
  directExtrudeDistance = 0,
  onDirectExtrude,
  snapEnabled = true,
  bed,
  showBed,
}) {
  const hostRef = useRef(null);
  const directHandleRef = useRef(null);
  const directEventRef = useRef({});
  const directDragRef = useRef(null);
  const selectRef = useRef(onSelectBody);
  const draftChangeRef = useRef(onDraftChange);
  const directRef = useRef({});
  const [view, setView] = useState('iso');
  const [navigationMode, setNavigationMode] = useState('orbit');
  const [zoomScale, setZoomScale] = useState(1);
  const [dragLabel, setDragLabel] = useState(null);
  const activeSketch = sketches.find((sketch) => sketch.id === activeSketchId);
  const activePlane = activeSketch?.plane || 'XY';
  const directEnabled = Boolean(selectedProfile && !activeSketchId);
  selectRef.current = onSelectBody;
  draftChangeRef.current = onDraftChange;
  directRef.current = {
    distance: numericValue(directExtrudeDistance, parameters),
    onCommit: onDirectExtrude,
    snapEnabled,
  };

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

    const directGroup = new THREE.Group();
    const directPickables = [];
    let directHead = null;
    let updateDirectVisual = null;
    let ghostPreview = null;
    if (directEnabled) {
      const normal = selectedProfilePlane === 'XZ'
        ? new THREE.Vector3(0, -1, 0)
        : selectedProfilePlane === 'YZ'
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 0, 1);
      const profileX = numericValue(selectedProfile.geometry.x, parameters);
      const profileY = numericValue(selectedProfile.geometry.y, parameters);
      const center = new THREE.Vector3(...mapPlanePoint(profileX, profileY, selectedProfilePlane, 0.12));

      addSketchLine(directGroup, selectedProfile, parameters, selectedProfilePlane, true);

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
    camera.position.set(center.x + direction[0] * radius * 1.7 * zoomScale, center.y + direction[1] * radius * 1.7 * zoomScale, center.z + direction[2] * radius * 1.7 * zoomScale);
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
      const fromDirectOverlay = event.currentTarget === directHandleElement;
      const directHit = fromDirectOverlay ? { object: directHead } : (directPickables.length ? raycaster.intersectObjects(directPickables, false)[0] : null);
      if (new URLSearchParams(window.location.search).has('verify')) {
        window.__madcadPointerLog = { down: true, directHit: Boolean(directHit), x: event.clientX, y: event.clientY, pickables: directPickables.length };
      }
      if (directHit && updateDirectVisual) {
        event.preventDefault();
        event.stopPropagation();
        controls.enabled = false;
        const profileX = numericValue(selectedProfile.geometry.x, parameters);
        const profileY = numericValue(selectedProfile.geometry.y, parameters);
        const origin = new THREE.Vector3(...mapPlanePoint(profileX, profileY, selectedProfilePlane, 0.12));
        const normal = selectedProfilePlane === 'XZ'
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
          startDistance: Math.max(0, directRef.current.distance || 0),
          value: Math.max(0, directRef.current.distance || 0),
          screenAxis,
          pixelsPerUnit,
        };
        try { event.currentTarget?.setPointerCapture?.(event.pointerId); } catch { /* Synthetic verification events have no native pointer capture. */ }
        renderer.domElement.style.cursor = 'ns-resize';
        setDragLabel({ value: directDragRef.current.value, x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 12 });
        return;
      }
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
    const onPointerMove = (event) => {
      const directDrag = directDragRef.current;
      if (!directDrag || !updateDirectVisual) return;
      event.preventDefault();
      const delta = new THREE.Vector2(event.clientX - directDrag.startX, event.clientY - directDrag.startY);
      const raw = directDrag.startDistance + delta.dot(directDrag.screenAxis) / directDrag.pixelsPerUnit;
      const step = directRef.current.snapEnabled && !event.altKey ? 1 : 0.1;
      const value = Math.max(0.1, Math.round(raw / step) * step);
      directDrag.value = value;
      updateDirectVisual(value, true);
      const rect = renderer.domElement.getBoundingClientRect();
      setDragLabel({ value, x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 12 });
      if (window.__madcadPointerLog) window.__madcadPointerLog.moveValue = value;
    };
    const onPointerUp = (event) => {
      if (window.__madcadPointerLog) window.__madcadPointerLog.upCalled = true;
      const directDrag = directDragRef.current;
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
    const directHandleElement = directHandleRef.current;
    directEventRef.current = { down: onPointerDown, move: onPointerMove, up: onPointerUp };

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
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
      directEventRef.current = {};
      controls.dispose();
      disposeObject(modelGroup);
      disposeObject(sketchGroup);
      disposeObject(directGroup);
      if (plate) disposeObject(plate);
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
      delete window.__madcadDirectHandlePoint;
    };
  }, [bodies, selectedBodyId, bed, showBed, showGrid, view, activeSketchId, activePlane, activeSketch, draftProfile, draftType, parameters, directEnabled, selectedProfile?.id, selectedProfilePlane, navigationMode, zoomScale]);

  return (
    <div className={`model-viewport ${activeSketchId ? 'sketch-view' : ''}`} ref={hostRef}>
      <div className="view-cube" aria-label="Kostka widoku">
        <button className="cube-top" type="button" title="Ustaw kamerę prostopadle do płaszczyzny XY." onClick={() => setView('top')}>GÓRA</button>
        <button className="cube-main" type="button" onClick={() => setView('iso')} title="Widok izometryczny"><Box size={34} strokeWidth={1.2} /></button>
        <button className="cube-front" type="button" title="Ustaw kamerę na widok z przodu." onClick={() => setView('front')}>PRZÓD</button>
        <button className="cube-right" type="button" title="Ustaw kamerę na widok z prawej strony." onClick={() => setView('right')}>PRAWO</button>
      </div>
      <div className="axis-indicator" aria-hidden="true"><span className="axis-x">X</span><span className="axis-y">Y</span><span className="axis-z">Z</span></div>
      {directEnabled && (
        <div
          ref={directHandleRef}
          className="direct-handle-hit"
          title="Przeciągnij strzałkę, aby ustawić odległość wyciągnięcia."
          aria-label="Przeciągnij wyciągnięcie"
          onPointerDown={(event) => directEventRef.current.down?.(event)}
          onPointerMove={(event) => directEventRef.current.move?.(event)}
          onPointerUp={(event) => directEventRef.current.up?.(event)}
          onPointerCancel={(event) => directEventRef.current.up?.(event)}
        />
      )}
      <div className="navigation-bar" aria-label="Nawigacja widoku">
        <button className={navigationMode === 'orbit' ? 'active' : ''} type="button" title="Orbita: przeciągnij lewym przyciskiem, aby obracać widok." onClick={() => { setNavigationMode('orbit'); setView('iso'); }}><Orbit size={16} /></button>
        <button className={navigationMode === 'pan' ? 'active' : ''} type="button" title="Przesuwanie: przeciągnij lewym przyciskiem, aby przesunąć widok." onClick={() => setNavigationMode((mode) => mode === 'pan' ? 'orbit' : 'pan')}><Move3d size={16} /></button>
        <button type="button" title="Powiększ model w bieżącym widoku." onClick={() => setZoomScale((scale) => Math.max(0.35, scale * 0.78))}><ZoomIn size={16} /></button>
        <button type="button" title="Dopasuj cały model do dostępnego obszaru." onClick={() => { setZoomScale(1); setView(activeSketchId ? (activePlane === 'XZ' ? 'front' : activePlane === 'YZ' ? 'right' : 'top') : 'iso'); }}><Maximize2 size={16} /></button>
      </div>
      {directEnabled && <div className="direct-extrude-hint">Przeciągnij niebieską strzałkę, aby wyciągnąć profil</div>}
      {dragLabel && <div className="direct-dimension" style={{ left: dragLabel.x, top: dragLabel.y }}>{dragLabel.value.toFixed(1)} mm</div>}
      {activeSketchId && <div className="sketch-plane-badge"><PencilRulerIcon /> Szkic · {activePlane}</div>}
      {activeSketchId && draftType && <div className="sketch-pointer-hint">Kliknij środek, a następnie punkt rozmiaru</div>}
    </div>
  );
}

function PencilRulerIcon() {
  return <span className="sketch-badge-mark" aria-hidden="true"><Square size={12} /></span>;
}
