import React, { useEffect, useRef, useState } from 'react';
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

export default function ModelViewport({ bodies, selectedBodyId, onSelectBody, bed, showBed }) {
  const hostRef = useRef(null);
  const selectRef = useRef(onSelectBody);
  const [view, setView] = useState('iso');
  selectRef.current = onSelectBody;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#151a1f');
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100000);
    camera.up.set(0, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x26313b, 2.05));
    const key = new THREE.DirectionalLight(0xffffff, 2.65);
    key.position.set(260, -220, 360);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ccfff, 0.85);
    fill.position.set(-180, 100, 120);
    scene.add(fill);

    const gridSize = Math.max(200, bed?.bedWidth || 220, bed?.bedDepth || 220);
    const grid = new THREE.GridHelper(gridSize, Math.round(gridSize / 10), 0x60717e, 0x313b43);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.02;
    scene.add(grid);

    let plate;
    if (showBed) {
      const plateGeometry = new THREE.PlaneGeometry(bed.bedWidth, bed.bedDepth);
      const plateMaterial = new THREE.MeshStandardMaterial({
        color: 0x24313a,
        roughness: 0.92,
        metalness: 0.05,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      plate = new THREE.Mesh(plateGeometry, plateMaterial);
      plate.position.z = -0.12;
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
        color: selected ? '#78d5f3' : body.color,
        metalness: 0.07,
        roughness: 0.58,
        emissive: selected ? '#123d4d' : '#000000',
        emissiveIntensity: selected ? 0.8 : 0,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.bodyId = body.id;
      modelGroup.add(mesh);
      pickables.push(mesh);

      if (body.lines.length) {
        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setAttribute('position', new THREE.BufferAttribute(body.lines, 3));
        const edgeMaterial = new THREE.LineBasicMaterial({ color: selected ? 0xdff8ff : 0x18303c, transparent: true, opacity: 0.78 });
        modelGroup.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
      }
    }
    scene.add(modelGroup);

    const modelBox = bodies.length ? new THREE.Box3().setFromObject(modelGroup) : null;
    const center = modelBox ? modelBox.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);
    const size = modelBox ? modelBox.getSize(new THREE.Vector3()) : new THREE.Vector3(80, 60, 20);
    const radius = Math.max(size.x, size.y, size.z, 35);
    const direction = VIEW_DIRECTIONS[view] || VIEW_DIRECTIONS.iso;
    camera.position.set(
      center.x + direction[0] * radius,
      center.y + direction[1] * radius,
      center.z + direction[2] * radius,
    );
    controls.target.copy(center);
    controls.update();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
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
      if (plate) disposeObject(plate);
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [bodies, selectedBodyId, bed, showBed, view]);

  return (
    <div className="model-viewport" ref={hostRef}>
      <div className="view-controls" aria-label="Widok modelu">
        <button className={view === 'iso' ? 'active' : ''} onClick={() => setView('iso')} type="button">Izometria</button>
        <button className={view === 'top' ? 'active' : ''} onClick={() => setView('top')} type="button">Góra</button>
        <button className={view === 'front' ? 'active' : ''} onClick={() => setView('front')} type="button">Przód</button>
        <button className={view === 'right' ? 'active' : ''} onClick={() => setView('right')} type="button">Prawo</button>
      </div>
      <div className="viewport-hint">LPM: obrót · kółko: zoom · PPM: przesunięcie</div>
    </div>
  );
}
