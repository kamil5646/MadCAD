import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

const DEFAULT_HEIGHT = 10;
const DEFAULT_BED_SIZE = 220;

function read2DSource() {
  if (typeof window.__madcadGet3DSource !== 'function') {
    return { version: 1, units: 'mm', entities: [] };
  }
  try {
    return window.__madcadGet3DSource();
  } catch (error) {
    console.error('Nie udało się odczytać geometrii 2D:', error);
    return { version: 1, units: 'mm', entities: [] };
  }
}

function entityToShape(entity) {
  const shape = new THREE.Shape();

  if (entity.type === 'rect') {
    const x1 = Number(entity.x) || 0;
    const y1 = -(Number(entity.y) || 0);
    const x2 = x1 + (Number(entity.w) || 0);
    const y2 = y1 - (Number(entity.h) || 0);
    if (Math.abs(x2 - x1) < 0.001 || Math.abs(y2 - y1) < 0.001) return null;
    shape.moveTo(x1, y1);
    shape.lineTo(x2, y1);
    shape.lineTo(x2, y2);
    shape.lineTo(x1, y2);
    shape.closePath();
    return shape;
  }

  if (entity.type === 'circle') {
    const radius = Math.abs(Number(entity.r) || 0);
    if (radius < 0.001) return null;
    shape.absarc(Number(entity.cx) || 0, -(Number(entity.cy) || 0), radius, 0, Math.PI * 2, false);
    return shape;
  }

  if (entity.type === 'fillRegion' && Array.isArray(entity.points) && entity.points.length >= 3) {
    const points = entity.points.map((point) => ({
      x: Number(point.x) || 0,
      y: -(Number(point.y) || 0)
    }));
    shape.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      shape.lineTo(points[index].x, points[index].y);
    }
    shape.closePath();
    return shape;
  }

  return null;
}

function buildModel(entities, height) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x2fb8e6,
    metalness: 0.08,
    roughness: 0.62,
    side: THREE.DoubleSide
  });

  for (const entity of entities) {
    const shape = entityToShape(entity);
    if (!shape) continue;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments: 64,
      steps: 1
    });
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({ color: 0x102431, transparent: true, opacity: 0.72 })
    );
    mesh.add(edges);
    group.add(mesh);
  }

  if (group.children.length > 0) {
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.set(-center.x, -center.y, -box.min.z);
  }
  return group;
}

function disposeModel(group) {
  const materials = new Set();
  group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach((material) => materials.add(material));
    }
  });
  materials.forEach((material) => material.dispose());
}

function getModelStats(entities, height) {
  const model = buildModel(entities, height);
  if (model.children.length === 0) {
    disposeModel(model);
    return { count: 0, width: 0, depth: 0, height: 0 };
  }
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const stats = { count: model.children.length, width: size.x, depth: size.y, height: size.z };
  disposeModel(model);
  return stats;
}

function downloadStl(entities, height) {
  const model = buildModel(entities, height);
  if (model.children.length === 0) return false;
  model.updateMatrixWorld(true);
  const data = new STLExporter().parse(model, { binary: true });
  const blob = new Blob([data], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'madcad-model-3d.stl';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  disposeModel(model);
  return true;
}

function ModelViewport({ entities, height, bedWidth, bedDepth }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10161d);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100000);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.HemisphereLight(0xeaf7ff, 0x26313a, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(300, -240, 420);
    scene.add(keyLight);

    const plateGeometry = new THREE.PlaneGeometry(bedWidth, bedDepth);
    const plateMaterial = new THREE.MeshStandardMaterial({
      color: 0x24313b,
      roughness: 0.92,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    const plate = new THREE.Mesh(plateGeometry, plateMaterial);
    plate.position.z = -0.35;
    scene.add(plate);

    const gridSize = Math.max(bedWidth, bedDepth);
    const grid = new THREE.GridHelper(gridSize, Math.max(4, Math.round(gridSize / 10)), 0x5a7180, 0x344650);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.2;
    scene.add(grid);

    const model = buildModel(entities, height);
    scene.add(model);

    const box = model.children.length > 0 ? new THREE.Box3().setFromObject(model) : null;
    const size = box ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(bedWidth, bedDepth, 20);
    const radius = Math.max(size.x, size.y, size.z, 40);
    camera.position.set(radius * 1.25, -radius * 1.45, radius * 1.15);
    controls.target.set(0, 0, Math.max(0, size.z * 0.35));
    controls.update();

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const viewportHeight = Math.max(1, host.clientHeight);
      renderer.setSize(width, viewportHeight, false);
      camera.aspect = width / viewportHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeModel(model);
      plateGeometry.dispose();
      plateMaterial.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [entities, height, bedWidth, bedDepth]);

  return <div className="print3d-viewport" ref={hostRef} />;
}

export default function Print3DWorkspace({ onClose }) {
  const [source, setSource] = useState(() => read2DSource());
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [bedWidth, setBedWidth] = useState(DEFAULT_BED_SIZE);
  const [bedDepth, setBedDepth] = useState(DEFAULT_BED_SIZE);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [message, setMessage] = useState('');

  const printableEntities = useMemo(() => {
    const entities = Array.isArray(source.entities) ? source.entities : [];
    return selectedOnly ? entities.filter((entity) => entity.selected) : entities;
  }, [source, selectedOnly]);

  const stats = useMemo(
    () => getModelStats(printableEntities, height),
    [printableEntities, height]
  );
  const exceedsBed = stats.width > bedWidth || stats.depth > bedDepth;

  const refresh = () => {
    setSource(read2DSource());
    setMessage('Odświeżono geometrię z widoku 2D.');
  };

  const exportModel = () => {
    if (!downloadStl(printableEntities, height)) {
      setMessage('Brak zamkniętych figur do eksportu. Użyj prostokąta, okręgu lub wypełnionego obszaru.');
      return;
    }
    setMessage('Wyeksportowano STL w milimetrach.');
  };

  return (
    <section className="printing-3d-shell" aria-label="Przygotowanie modelu do druku 3D">
      <header className="print3d-header">
        <div>
          <p className="print3d-eyebrow">MadCAD · ten sam projekt</p>
          <h1>Przygotowanie do druku 3D</h1>
        </div>
        <div className="print3d-header-actions">
          <button type="button" onClick={refresh}>Odśwież z 2D</button>
          <button type="button" className="print3d-back" onClick={onClose}>Wróć do 2D</button>
        </div>
      </header>

      <div className="print3d-layout">
        <aside className="print3d-panel">
          <div className="print3d-panel-section">
            <h2>Bryła</h2>
            <label>
              <span>Wysokość wyciągnięcia [mm]</span>
              <input
                type="number"
                min="0.2"
                max="1000"
                step="0.2"
                value={height}
                onChange={(event) => setHeight(Math.max(0.2, Number(event.target.value) || DEFAULT_HEIGHT))}
              />
            </label>
            <label className="print3d-check">
              <input
                type="checkbox"
                checked={selectedOnly}
                onChange={(event) => setSelectedOnly(event.target.checked)}
              />
              <span>Tylko zaznaczone figury 2D</span>
            </label>
            <p className="print3d-note">
              Obsługiwane: prostokąty, okręgi i zamknięte obszary utworzone narzędziem wypełnienia.
            </p>
          </div>

          <div className="print3d-panel-section">
            <h2>Stół drukarki</h2>
            <div className="print3d-input-row">
              <label>
                <span>Szerokość [mm]</span>
                <input type="number" min="20" value={bedWidth} onChange={(event) => setBedWidth(Math.max(20, Number(event.target.value) || DEFAULT_BED_SIZE))} />
              </label>
              <label>
                <span>Głębokość [mm]</span>
                <input type="number" min="20" value={bedDepth} onChange={(event) => setBedDepth(Math.max(20, Number(event.target.value) || DEFAULT_BED_SIZE))} />
              </label>
            </div>
          </div>

          <div className="print3d-panel-section print3d-stats">
            <h2>Kontrola modelu</h2>
            <dl>
              <div><dt>Bryły</dt><dd>{stats.count}</dd></div>
              <div><dt>Rozmiar X</dt><dd>{stats.width.toFixed(1)} mm</dd></div>
              <div><dt>Rozmiar Y</dt><dd>{stats.depth.toFixed(1)} mm</dd></div>
              <div><dt>Rozmiar Z</dt><dd>{stats.height.toFixed(1)} mm</dd></div>
            </dl>
            {stats.count === 0 && <p className="print3d-warning">Brak zamkniętych figur do wyciągnięcia.</p>}
            {exceedsBed && <p className="print3d-warning">Model przekracza zadany obszar stołu drukarki.</p>}
            {!exceedsBed && stats.count > 0 && <p className="print3d-success">Model mieści się na zadanym stole.</p>}
          </div>

          <button type="button" className="print3d-export" disabled={stats.count === 0} onClick={exportModel}>
            Eksportuj STL
          </button>
          {message && <p className="print3d-message" role="status">{message}</p>}
        </aside>

        <main className="print3d-stage">
          <ModelViewport entities={printableEntities} height={height} bedWidth={bedWidth} bedDepth={bedDepth} />
          <div className="print3d-help">LPM: obrót · kółko: zoom · PPM: przesunięcie</div>
        </main>
      </div>
    </section>
  );
}
