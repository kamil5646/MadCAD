import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDotDashed,
  Copy,
  Cylinder,
  FileBox,
  FileDown,
  FilePlus2,
  FolderOpen,
  Frame,
  Grid2X2,
  HardDriveDownload,
  Hexagon,
  Home,
  Layers3,
  Lock,
  Maximize2,
  Minus,
  MousePointer2,
  Move,
  Move3d,
  PanelLeftClose,
  PencilRuler,
  Printer,
  Redo2,
  Rotate3d,
  RotateCw,
  Ruler,
  Save,
  ScanSearch,
  Scissors,
  Settings2,
  Shapes,
  SkipBack,
  Square,
  StepBack,
  StepForward,
  Triangle,
  Undo2,
  Variable,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  cloneDocument,
  createCircleProfile,
  createDocument,
  createFeature,
  createParameter,
  createRectangleProfile,
  createSketch,
  createStarterDocument,
  touchDocument,
  validateDocument,
} from '../cad-core/document.js';
import { useCadEngine } from '../cad-core/useCadEngine.js';
import ModelViewport from './ModelViewport.jsx';
import './modeling.css';

const AUTOSAVE_KEY = 'madcad:modeling-document:v4';

const MAIN_TABS = [
  { id: 'solid', label: 'BRYŁA' },
  { id: 'surface', label: 'POWIERZCHNIA', disabled: true },
  { id: 'mesh', label: 'SIATKA', disabled: true },
  { id: 'sheet', label: 'KONSTRUKCJA BLACHOWA', disabled: true },
  { id: 'tools', label: 'NARZĘDZIA' },
  { id: 'print', label: 'DRUK 3D' },
];

const PLANE_LABELS = { XY: 'Góra (XY)', XZ: 'Przód (XZ)', YZ: 'Prawo (YZ)' };

function loadInitialDocument() {
  try {
    const saved = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return createStarterDocument();
    const loaded = JSON.parse(saved);
    return validateDocument(loaded).valid ? loaded : createStarterDocument();
  } catch {
    return createStarterDocument();
  }
}

function useDocumentHistory(initialDocument) {
  const [history, setHistory] = useState({ past: [], present: initialDocument, future: [] });
  const commit = (mutator) => {
    setHistory((current) => {
      const next = cloneDocument(current.present);
      mutator(next);
      touchDocument(next);
      return { past: [...current.past.slice(-59), current.present], present: next, future: [] };
    });
  };
  const replace = (document) => setHistory({ past: [], present: document, future: [] });
  const undo = () => setHistory((current) => current.past.length ? {
    past: current.past.slice(0, -1),
    present: current.past.at(-1),
    future: [current.present, ...current.future],
  } : current);
  const redo = () => setHistory((current) => current.future.length ? {
    past: [...current.past, current.present],
    present: current.future[0],
    future: current.future.slice(1),
  } : current);
  return {
    document: history.present,
    commit,
    replace,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(value) {
  return value.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'model';
}

function ToolButton({ icon: Icon, label, onClick, disabled = false, primary = false, compact = false, title }) {
  return (
    <button
      className={`ribbon-tool ${primary ? 'primary' : ''} ${compact ? 'compact' : ''}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
    >
      <span className="ribbon-icon" aria-hidden="true"><Icon size={compact ? 18 : 25} strokeWidth={1.55} /></span>
      <span className="ribbon-label">{label}</span>
    </button>
  );
}

function RibbonGroup({ label, children, end = false }) {
  return (
    <div className={`ribbon-group ${end ? 'ribbon-group-end' : ''}`}>
      <div className="ribbon-tools">{children}</div>
      <span className="ribbon-group-label">{label}</span>
    </div>
  );
}

function ProjectBrowser({ document, bodies, selection, activeSketchId, onSelect }) {
  const [expanded, setExpanded] = useState({ origin: true, sketches: true, bodies: true });
  const toggle = (key) => setExpanded((current) => ({ ...current, [key]: !current[key] }));
  return (
    <aside className="model-browser" aria-label="Przeglądarka projektu">
      <div className="browser-heading"><strong>PRZEGLĄDARKA</strong><button type="button" title="Zwiń przeglądarkę"><PanelLeftClose size={14} /></button></div>
      <button className={`tree-row tree-root ${selection?.kind === 'document' ? 'selected' : ''}`} type="button" onClick={() => onSelect({ kind: 'document', id: document.id })}>
        <ChevronDown size={13} /><FileBox size={14} /><strong>{document.name || 'Bez nazwy'}</strong>
      </button>
      <button className="tree-row tree-child" type="button" onClick={() => onSelect({ kind: 'settings', id: document.id })}>
        <span /><Settings2 size={14} /><span>Ustawienia dokumentu</span><small>mm</small>
      </button>

      <button className="tree-row tree-child tree-folder" type="button" onClick={() => toggle('origin')}>
        {expanded.origin ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Layers3 size={14} /><span>Początek</span>
      </button>
      {expanded.origin && (
        <div className="tree-nested">
          {Object.entries(PLANE_LABELS).map(([plane, label]) => (
            <button key={plane} className="tree-row tree-grandchild" type="button" onClick={() => onSelect({ kind: 'plane', id: plane })}>
              <span /><Frame size={13} /><span>{label}</span>
            </button>
          ))}
        </div>
      )}

      <button className="tree-row tree-child tree-folder" type="button" onClick={() => toggle('sketches')}>
        {expanded.sketches ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Szkice</span><small>{document.sketches.length}</small>
      </button>
      {expanded.sketches && document.sketches.map((sketch) => (
        <React.Fragment key={sketch.id}>
          <button
            className={`tree-row tree-grandchild ${selection?.kind === 'sketch' && selection.id === sketch.id ? 'selected' : ''} ${activeSketchId === sketch.id ? 'editing' : ''}`}
            type="button"
            onClick={() => onSelect({ kind: 'sketch', id: sketch.id })}
          >
            <span /><PencilRuler size={13} /><span>{sketch.name}</span><small>{sketch.plane}</small>
          </button>
          {sketch.profiles.map((profile) => (
            <button
              className={`tree-row tree-profile ${selection?.kind === 'profile' && selection.id === profile.id ? 'selected' : ''}`}
              key={profile.id}
              type="button"
              onClick={() => onSelect({ kind: 'profile', id: profile.id, sketchId: sketch.id })}
            >
              <span />{profile.type === 'circle' ? <Circle size={12} /> : <Square size={12} />}<span>{profile.name}</span>
            </button>
          ))}
        </React.Fragment>
      ))}

      <button className="tree-row tree-child tree-folder" type="button" onClick={() => toggle('bodies')}>
        {expanded.bodies ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Bryły</span><small>{bodies.length}</small>
      </button>
      {expanded.bodies && bodies.map((body) => (
        <button
          className={`tree-row tree-grandchild ${selection?.kind === 'body' && selection.id === body.id ? 'selected' : ''}`}
          key={body.id}
          type="button"
          onClick={() => onSelect({ kind: 'body', id: body.id })}
        >
          <span /><Box size={13} /><span>{body.name}</span><i className="body-color" style={{ background: body.color }} />
        </button>
      ))}
    </aside>
  );
}

function Field({ label, value, onChange, suffix = '', type = 'text', disabled = false, autoFocus = false }) {
  return (
    <label className="command-field">
      <span>{label}</span>
      <div className="command-input-wrap">
        <input autoFocus={autoFocus} type={type} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} disabled={disabled} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function CommandDialog({ command, profileName, onChange, onConfirm, onCancel }) {
  if (!command || command.type === 'plane' || command.type === 'parameters') return null;
  const isRectangle = command.type === 'rectangle';
  const isCircle = command.type === 'circle';
  const isExtrude = command.type === 'extrude';
  const isHole = command.type === 'hole';
  const isFillet = command.type === 'fillet';
  const title = isRectangle ? 'Prostokąt ze środka' : isCircle ? 'Okrąg ze środka' : isExtrude ? 'Wyciągnięcie' : isHole ? 'Otwór' : isFillet ? 'Zaokrąglenie' : 'Fazowanie';
  return (
    <section className="command-dialog" aria-label={title}>
      <header><strong>{title}</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        {(isRectangle || isCircle) && <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} />}
        {isRectangle && (
          <>
            <Field label="Szerokość" value={command.width} onChange={(width) => onChange({ width })} suffix="mm" autoFocus />
            <Field label="Wysokość" value={command.height} onChange={(height) => onChange({ height })} suffix="mm" />
            <Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" />
            <Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" />
          </>
        )}
        {isCircle && (
          <>
            <Field label="Średnica" value={command.diameter} onChange={(diameter) => onChange({ diameter })} suffix="mm" autoFocus />
            <Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" />
            <Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" />
          </>
        )}
        {(isExtrude || isHole) && <Field label="Profil" value={profileName} disabled />}
        {isExtrude && (
          <>
            <Field label="Odległość" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus />
            <label className="command-field">
              <span>Operacja</span>
              <select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}>
                <option value="new">Nowa bryła</option>
                <option value="join">Połącz</option>
                <option value="cut">Wytnij</option>
                <option value="intersect">Część wspólna</option>
              </select>
            </label>
            <label className="command-field"><span>Kierunek</span><select disabled><option>Jedna strona</option></select></label>
          </>
        )}
        {isHole && (
          <>
            <Field label="Średnica" value={command.diameter} onChange={(diameter) => onChange({ diameter })} suffix="mm" autoFocus />
            <Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" />
          </>
        )}
        {(isFillet || command.type === 'chamfer') && (
          <Field label={isFillet ? 'Promień' : 'Odległość'} value={command.size} onChange={(size) => onChange({ size })} suffix="mm" autoFocus />
        )}
        <div className="command-preview-note"><span className="preview-dot" />{isRectangle || isCircle ? 'Kliknij środek i drugi punkt na płótnie albo wpisz dokładne wymiary.' : 'Podgląd jest przeliczany na dokładnej bryle B-Rep.'}</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> OK</button></footer>
    </section>
  );
}

function PlanePicker({ onPick, onCancel }) {
  return (
    <section className="plane-picker" aria-label="Wybierz płaszczyznę szkicu">
      <header><div><strong>Wybierz płaszczyznę szkicu</strong><span>Wskaż jedną z płaszczyzn początku.</span></div><button type="button" onClick={onCancel} title="Anuluj"><X size={17} /></button></header>
      <div className="plane-options">
        {Object.entries(PLANE_LABELS).map(([plane, label]) => (
          <button key={plane} type="button" onClick={() => onPick(plane)}>
            <Frame size={28} strokeWidth={1.25} /><strong>{plane}</strong><span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ParametersDialog({ document, commit, onClose }) {
  const add = () => {
    let number = document.parameters.length + 1;
    while (document.parameters.some((item) => item.name === `parametr${number}`)) number += 1;
    commit((next) => next.parameters.push(createParameter(`parametr${number}`, 10, 'mm', `Parametr ${number}`)));
  };
  return (
    <section className="parameters-dialog" aria-label="Parametry użytkownika">
      <header><div><strong>Parametry</strong><span>Steruj wymiarami modelu z jednego miejsca.</span></div><button type="button" onClick={onClose} title="Zamknij"><X size={16} /></button></header>
      <div className="parameter-table">
        <div className="parameter-head"><span>Nazwa</span><span>Wyrażenie</span><span>Jednostka</span></div>
        {document.parameters.map((parameter) => (
          <div className="parameter-row" key={parameter.id}>
            <input value={parameter.label} aria-label="Etykieta parametru" onChange={(event) => commit((next) => { next.parameters.find((item) => item.id === parameter.id).label = event.target.value; })} />
            <input value={parameter.expression} aria-label={`Wyrażenie ${parameter.label}`} onChange={(event) => commit((next) => { next.parameters.find((item) => item.id === parameter.id).expression = event.target.value; })} />
            <span>{parameter.unit}</span>
          </div>
        ))}
        {!document.parameters.length && <p className="empty-parameters">Brak parametrów użytkownika.</p>}
      </div>
      <footer><button className="secondary" type="button" onClick={add}>Dodaj parametr</button><button className="confirm" type="button" onClick={onClose}><Check size={14} /> Gotowe</button></footer>
    </section>
  );
}

function SketchPalette({ options, onChange, onFinish }) {
  const items = [
    ['grid', 'Siatka szkicu'],
    ['snap', 'Przyciąganie'],
    ['profiles', 'Profile'],
    ['points', 'Punkty'],
    ['dimensions', 'Wymiary'],
    ['constraints', 'Wiązania'],
    ['construction', 'Geometrie konstrukcyjne'],
    ['sketch3d', 'Szkic 3D'],
  ];
  return (
    <aside className="sketch-palette">
      <header><strong>PALETA SZKICU</strong><Settings2 size={13} /></header>
      <div className="sketch-palette-body">
        <h3>Opcje</h3>
        {items.map(([key, label]) => (
          <label key={key}><span>{label}</span><input type="checkbox" checked={Boolean(options[key])} onChange={(event) => onChange(key, event.target.checked)} /></label>
        ))}
      </div>
      <footer><button type="button" onClick={onFinish}>Zakończ szkic</button></footer>
    </aside>
  );
}

function PrintPanel({ document, bodies, engine, commit, onExport, onClose }) {
  const bounds = useMemo(() => {
    if (!bodies.length) return [0, 0, 0];
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    bodies.forEach((body) => body.bounds.forEach((point, pointIndex) => point.forEach((value, axis) => {
      if (pointIndex === 0) min[axis] = Math.min(min[axis], value);
      else max[axis] = Math.max(max[axis], value);
    })));
    return max.map((value, axis) => value - min[axis]);
  }, [bodies]);
  const fits = Boolean(bodies.length) && bounds[0] <= document.print.bedWidth && bounds[1] <= document.print.bedDepth && bounds[2] <= document.print.bedHeight;
  const update = (key, value) => commit((next) => { next.print[key] = Math.max(1, Number(value) || 1); });
  return (
    <aside className="print-panel print-inspector">
      <header><div><strong>DRUK 3D</strong><span>Sprawdź model i wyeksportuj siatkę.</span></div><button type="button" onClick={onClose} title="Zamknij"><X size={16} /></button></header>
      <div className="print-section">
        <h3>Objętość robocza</h3>
        <Field type="number" label="Szerokość X" value={document.print.bedWidth} suffix="mm" onChange={(value) => update('bedWidth', value)} />
        <Field type="number" label="Głębokość Y" value={document.print.bedDepth} suffix="mm" onChange={(value) => update('bedDepth', value)} />
        <Field type="number" label="Wysokość Z" value={document.print.bedHeight} suffix="mm" onChange={(value) => update('bedHeight', value)} />
      </div>
      <div className="print-section print-summary">
        <h3>Kontrola modelu</h3>
        <dl><div><dt>Bryły</dt><dd>{bodies.length}</dd></div><div><dt>Rozmiar</dt><dd>{bounds.map((value) => value.toFixed(1)).join(' × ')} mm</dd></div></dl>
        <p className={fits ? 'check-ok' : 'check-warning'}>{!bodies.length ? 'Najpierw utwórz bryłę.' : fits ? 'Model mieści się na stole drukarki.' : 'Model przekracza obszar drukarki.'}</p>
      </div>
      <div className="print-actions">
        <button type="button" onClick={() => onExport('stl')} disabled={!bodies.length || engine.status !== 'ready'}><HardDriveDownload size={16} /> Eksportuj STL</button>
        <button className="secondary" type="button" onClick={() => onExport('step')} disabled={!bodies.length || engine.status !== 'ready'}>Eksportuj STEP</button>
      </div>
    </aside>
  );
}

function featureIcon(type, size = 16) {
  if (type === 'hole') return <Cylinder size={size} />;
  if (type === 'fillet') return <CircleDotDashed size={size} />;
  if (type === 'chamfer') return <Triangle size={size} />;
  return <Box size={size} />;
}

export default function ModelingWorkspace({ onClose }) {
  const history = useDocumentHistory(loadInitialDocument());
  const { document, commit } = history;
  const [workspace, setWorkspace] = useState('solid');
  const [selection, setSelection] = useState({ kind: 'document', id: document.id });
  const [activeSketchId, setActiveSketchId] = useState(null);
  const [command, setCommand] = useState(null);
  const [sketchOptions, setSketchOptions] = useState({ grid: true, snap: true, profiles: true, points: true, dimensions: true, constraints: true, construction: true, sketch3d: false });
  const [notice, setNotice] = useState('Gotowe. Wybierz „Utwórz szkic”, aby rozpocząć modelowanie.');
  const fileInputRef = useRef(null);

  const selectedProfileMatch = document.sketches
    .flatMap((sketch) => sketch.profiles.map((profile) => ({ sketch, profile })))
    .find(({ profile }) => selection?.kind === 'profile' && profile.id === selection.id);
  const selectedProfile = selectedProfileMatch?.profile;
  const firstBodyId = `body-${document.features.find((feature) => feature.type === 'extrude' && feature.operation === 'new')?.id || ''}`;

  const previewDocument = useMemo(() => {
    if (!command?.previewFeature) return document;
    const next = cloneDocument(document);
    if (command.editId) {
      const index = next.features.findIndex((feature) => feature.id === command.editId);
      if (index >= 0) next.features[index] = command.previewFeature;
    } else {
      next.features.push(command.previewFeature);
    }
    return next;
  }, [document, command]);
  const engine = useCadEngine(previewDocument);
  const actualBodyIds = useMemo(() => new Set(document.features.filter((feature) => feature.type === 'extrude' && feature.operation === 'new').map((feature) => `body-${feature.id}`)), [document.features]);
  const actualBodies = command?.previewFeature ? engine.bodies.filter((body) => actualBodyIds.has(body.id)) : engine.bodies;
  const targetBodyId = selection?.kind === 'body' ? selection.id : (engine.bodies[0]?.id || firstBodyId || null);

  useEffect(() => {
    const timeout = window.setTimeout(() => window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(document)), 300);
    return () => window.clearTimeout(timeout);
  }, [document]);

  useEffect(() => {
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (!verifyMode) return undefined;
    window.__madcadVerifyExport = engine.exportModel;
    return () => { delete window.__madcadVerifyExport; };
  }, [engine.exportModel]);

  const updateCommand = (patch) => {
    setCommand((current) => {
      const next = { ...current, ...patch };
      if (next.type === 'extrude') {
        next.previewFeature = createFeature('extrude', {
          name: current.previewFeature?.name || `Wyciągnięcie ${document.features.length + 1}`,
          sketchId: selectedProfileMatch?.sketch.id,
          profileIds: [selectedProfile.id],
          distance: next.distance,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'hole') {
        next.previewFeature = createFeature('hole', {
          name: current.previewFeature?.name || `Otwór ${document.features.length + 1}`,
          targetBodyId,
          sketchId: selectedProfileMatch?.sketch.id,
          profileId: selectedProfile.id,
          diameter: next.diameter,
          depth: next.depth,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'fillet' || next.type === 'chamfer') {
        next.previewFeature = createFeature(next.type, {
          name: current.previewFeature?.name || `${next.type === 'fillet' ? 'Zaokrąglenie' : 'Fazowanie'} ${document.features.length + 1}`,
          targetBodyId,
          ...(next.type === 'fillet' ? { radius: next.size } : { distance: next.size }),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      return next;
    });
  };

  const startSketch = () => {
    setWorkspace('sketch');
    setCommand({ type: 'plane' });
    setNotice('Wybierz płaszczyznę szkicu.');
  };

  const pickPlane = (plane) => {
    const sketch = createSketch({ name: `Szkic ${document.sketches.length + 1}`, plane });
    commit((next) => next.sketches.push(sketch));
    setActiveSketchId(sketch.id);
    setSelection({ kind: 'sketch', id: sketch.id });
    setCommand(null);
    setWorkspace('sketch');
    setNotice(`Edytujesz ${sketch.name} na płaszczyźnie ${plane}.`);
  };

  const editSketch = (sketchId) => {
    const sketch = document.sketches.find((item) => item.id === sketchId);
    if (!sketch) return;
    setActiveSketchId(sketch.id);
    setSelection({ kind: 'sketch', id: sketch.id });
    setWorkspace('sketch');
    setCommand(null);
    setNotice(`Edytujesz ${sketch.name}.`);
  };

  const finishSketch = () => {
    const sketch = document.sketches.find((item) => item.id === activeSketchId);
    const lastProfile = sketch?.profiles.at(-1);
    setActiveSketchId(null);
    setWorkspace('solid');
    setCommand(null);
    if (lastProfile) setSelection({ kind: 'profile', id: lastProfile.id, sketchId: sketch.id });
    setNotice('Szkic zakończony. Wybierz profil i użyj operacji bryłowej.');
  };

  const openProfileCommand = (type, profile = null) => {
    if (!activeSketchId) {
      startSketch();
      return;
    }
    if (type === 'rectangle') {
      setCommand({ type, editId: profile?.id || null, name: profile?.name || `Prostokąt ${document.sketches.flatMap((item) => item.profiles).length + 1}`, width: profile?.geometry.width || '40', height: profile?.geometry.height || '30', x: profile?.geometry.x || '0', y: profile?.geometry.y || '0' });
    } else {
      setCommand({ type, editId: profile?.id || null, name: profile?.name || `Okrąg ${document.sketches.flatMap((item) => item.profiles).length + 1}`, diameter: profile?.geometry.diameter || '10', x: profile?.geometry.x || '0', y: profile?.geometry.y || '0' });
    }
    setNotice('Ustaw wymiary profilu. Podgląd na płótnie aktualizuje się na bieżąco.');
  };

  const confirmProfile = () => {
    const profile = command.type === 'rectangle'
      ? createRectangleProfile({ name: command.name, width: command.width, height: command.height, x: command.x, y: command.y })
      : createCircleProfile({ name: command.name, diameter: command.diameter, x: command.x, y: command.y });
    if (command.editId) profile.id = command.editId;
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      if (command.editId) {
        const index = sketch.profiles.findIndex((item) => item.id === command.editId);
        sketch.profiles[index] = profile;
      } else sketch.profiles.push(profile);
    });
    setSelection({ kind: 'profile', id: profile.id, sketchId: activeSketchId });
    setCommand(null);
    setNotice(`${profile.name} dodany do szkicu.`);
  };

  const openExtrude = () => {
    if (!selectedProfile || activeSketchId) {
      setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz zamknięty profil w przeglądarce.');
      return;
    }
    const operation = engine.bodies.length ? 'join' : 'new';
    setCommand({ type: 'extrude', distance: '10', operation, previewFeature: null });
    window.setTimeout(() => updateCommand({ distance: '10', operation }), 0);
    setNotice('Podgląd wyciągnięcia jest aktywny. Potwierdź operację przyciskiem OK.');
  };

  const openHole = () => {
    if (!selectedProfile || selectedProfile.type !== 'circle' || !targetBodyId || activeSketchId) {
      setNotice('Zakończ szkic, wybierz profil okręgu oraz bryłę docelową.');
      return;
    }
    setCommand({ type: 'hole', diameter: selectedProfile.geometry.diameter, depth: '10', previewFeature: null });
    window.setTimeout(() => updateCommand({ diameter: selectedProfile.geometry.diameter, depth: '10' }), 0);
  };

  const openEdgeCommand = (type) => {
    if (!targetBodyId || activeSketchId) {
      setNotice('Wybierz bryłę docelową.');
      return;
    }
    setCommand({ type, size: '1', previewFeature: null });
    window.setTimeout(() => updateCommand({ size: '1' }), 0);
  };

  const confirmFeature = () => {
    if (!command?.previewFeature) return;
    commit((next) => {
      if (command.editId) {
        const index = next.features.findIndex((feature) => feature.id === command.editId);
        next.features[index] = command.previewFeature;
      } else next.features.push(command.previewFeature);
    });
    setSelection({ kind: 'feature', id: command.previewFeature.id });
    setWorkspace('solid');
    setCommand(null);
    setNotice('Operacja została dodana do parametrycznej osi czasu.');
  };

  const editSelection = () => {
    if (selection?.kind === 'sketch') return editSketch(selection.id);
    if (selection?.kind === 'profile') return openProfileCommand(selectedProfile.type, selectedProfile);
    if (selection?.kind !== 'feature') return;
    const feature = document.features.find((item) => item.id === selection.id);
    if (!feature) return;
    const profile = document.sketches.flatMap((sketch) => sketch.profiles).find((item) => feature.profileIds?.includes(item.id) || feature.profileId === item.id);
    if (profile) setSelection({ kind: 'profile', id: profile.id });
    if (feature.type === 'extrude') setCommand({ type: 'extrude', editId: feature.id, distance: feature.distance, operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'hole') setCommand({ type: 'hole', editId: feature.id, diameter: feature.diameter, depth: feature.depth, previewFeature: feature });
    else setCommand({ type: feature.type, editId: feature.id, size: feature.type === 'fillet' ? feature.radius : feature.distance, previewFeature: feature });
  };

  const createNew = () => {
    const blank = createDocument('Bez nazwy');
    history.replace(blank);
    setSelection({ kind: 'document', id: blank.id });
    setActiveSketchId(null);
    setCommand(null);
    setWorkspace('solid');
    setNotice('Nowy pusty projekt. Utwórz pierwszy szkic.');
  };

  const saveProject = async () => {
    const payload = JSON.stringify(document, null, 2);
    if (window.desktopApp?.saveTextFile) {
      const result = await window.desktopApp.saveTextFile({ defaultName: `${safeName(document.name)}.madcad`, text: payload, filters: [{ name: 'Projekt MadCAD', extensions: ['madcad'] }, { name: 'JSON', extensions: ['json'] }] });
      setNotice(result?.ok ? `Zapisano projekt: ${result.filePath}` : result?.canceled ? 'Anulowano zapis.' : `Nie udało się zapisać: ${result?.error || 'nieznany błąd'}`);
    } else {
      downloadBlob(new Blob([payload], { type: 'application/json' }), `${safeName(document.name)}.madcad`);
      setNotice('Zapisano projekt MadCAD.');
    }
  };

  const openProject = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const loaded = JSON.parse(await file.text());
      const validation = validateDocument(loaded);
      if (!validation.valid) throw new Error(validation.errors.join(' '));
      history.replace(loaded);
      setSelection({ kind: 'document', id: loaded.id });
      setActiveSketchId(null);
      setCommand(null);
      setWorkspace('solid');
      setNotice(`Otwarto projekt ${loaded.name}.`);
    } catch (error) {
      setNotice(`Nie udało się otworzyć projektu: ${error.message}`);
    }
  };

  const exportModel = async (format) => {
    setNotice(`Przygotowywanie pliku ${format.toUpperCase()}…`);
    try {
      const buffers = await engine.exportModel(format);
      buffers.forEach((buffer, index) => downloadBlob(new Blob([buffer], { type: format === 'stl' ? 'model/stl' : 'model/step' }), `${safeName(document.name)}${buffers.length > 1 ? `-${index + 1}` : ''}.${format === 'step' ? 'step' : 'stl'}`));
      setNotice(`Wyeksportowano ${format.toUpperCase()} z dokładnej bryły B-Rep.`);
    } catch (error) {
      setNotice(`Eksport nie powiódł się: ${error.message}`);
    }
  };

  const switchWorkspace = (id) => {
    if (id === 'tools') {
      setCommand({ type: 'parameters' });
      setWorkspace('solid');
      return;
    }
    setCommand(null);
    setActiveSketchId(null);
    setWorkspace(id);
    setNotice(id === 'print' ? 'Sprawdź gabaryty i przygotuj plik do druku 3D.' : 'Obszar modelowania bryłowego.');
  };

  const timelineStatus = new Map(engine.timeline?.map((item) => [item.id, item]));
  const sketch = document.sketches.find((item) => item.id === activeSketchId);
  const draftProfile = command?.type === 'rectangle'
    ? { type: 'rectangle', geometry: { width: command.width, height: command.height, x: command.x, y: command.y } }
    : command?.type === 'circle'
      ? { type: 'circle', geometry: { diameter: command.diameter, x: command.x, y: command.y } }
      : null;

  return (
    <section className="modeling-shell" aria-label="Modelowanie parametryczne MadCAD">
      <header className="modeling-titlebar">
        <div className="app-menu"><div className="brand-mark">M</div><button type="button" title="Strona główna"><Home size={16} /></button><button type="button" title="Panel danych"><Grid2X2 size={16} /></button><button type="button" title="Nowy projekt" onClick={createNew}><FilePlus2 size={16} /></button><button type="button" title="Otwórz projekt" onClick={() => fileInputRef.current?.click()}><FolderOpen size={16} /></button><button type="button" title="Zapisz" onClick={saveProject}><Save size={16} /></button></div>
        <input ref={fileInputRef} hidden type="file" accept=".madcad,.json,application/json" onChange={openProject} />
        <div className="document-tab"><Box size={15} /><input value={document.name} aria-label="Nazwa projektu" onChange={(event) => commit((next) => { next.name = event.target.value; })} /><span>*</span><button type="button" title="Zamknij dokument"><X size={13} /></button></div>
        <div className="title-actions"><button type="button" disabled={!history.canUndo} onClick={history.undo} title="Cofnij"><Undo2 size={15} /></button><button type="button" disabled={!history.canRedo} onClick={history.redo} title="Ponów"><Redo2 size={15} /></button><button type="button" title="Dokumentacja 2D" onClick={onClose}><AppWindow size={15} /><span>Dokumentacja</span></button></div>
      </header>

      <section className="command-area">
        <div className="workspace-switcher"><button type="button"><span>PROJEKT</span><ChevronDown size={13} /></button></div>
        <div className="command-ribbon">
          <nav className="workspace-tabs" aria-label="Obszary robocze">
            {activeSketchId ? <button className="active" type="button">SZKICUJ</button> : MAIN_TABS.map((item) => <button key={item.id} className={workspace === item.id ? 'active' : ''} type="button" disabled={item.disabled} onClick={() => switchWorkspace(item.id)}>{item.label}</button>)}
          </nav>
          <div className="modeling-ribbon">
            {activeSketchId ? (
              <>
                <RibbonGroup label="UTWÓRZ"><ToolButton icon={Square} label="Prostokąt" onClick={() => openProfileCommand('rectangle')} primary /><ToolButton icon={Circle} label="Okrąg" onClick={() => openProfileCommand('circle')} /><ToolButton icon={Minus} label="Linia" disabled /><ToolButton icon={Hexagon} label="Wielokąt" disabled /></RibbonGroup>
                <RibbonGroup label="ZMIANA"><ToolButton icon={Scissors} label="Przytnij" disabled /><ToolButton icon={Move} label="Przesuń" disabled /><ToolButton icon={RotateCw} label="Obróć" disabled /><ToolButton icon={Copy} label="Odsuń" disabled /></RibbonGroup>
                <RibbonGroup label="WIĄZANIA"><ToolButton icon={Ruler} label="Wymiar" disabled /><ToolButton icon={Lock} label="Ustal" disabled /><ToolButton icon={Settings2} label="Wiązania" disabled /></RibbonGroup>
                <RibbonGroup label="SZKIC" end><ToolButton icon={Check} label="Zakończ szkic" onClick={finishSketch} primary /></RibbonGroup>
              </>
            ) : workspace === 'print' ? (
              <>
                <RibbonGroup label="PRZYGOTUJ"><ToolButton icon={Printer} label="Kontrola druku" primary onClick={() => setWorkspace('print')} /><ToolButton icon={Ruler} label="Wymiary" disabled /></RibbonGroup>
                <RibbonGroup label="EKSPORT"><ToolButton icon={HardDriveDownload} label="STL" onClick={() => exportModel('stl')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={FileBox} label="STEP" onClick={() => exportModel('step')} disabled={!engine.bodies.length || engine.status !== 'ready'} /></RibbonGroup>
              </>
            ) : (
              <>
                <RibbonGroup label="UTWÓRZ"><ToolButton icon={PencilRuler} label="Utwórz szkic" onClick={startSketch} primary /><ToolButton icon={Box} label="Wyciągnij" onClick={openExtrude} disabled={!selectedProfile} /><ToolButton icon={Cylinder} label="Otwór" onClick={openHole} disabled={selectedProfile?.type !== 'circle' || !engine.bodies.length} /></RibbonGroup>
                <RibbonGroup label="ZMIANA"><ToolButton icon={CircleDotDashed} label="Zaokrąglij" onClick={() => openEdgeCommand('fillet')} disabled={!engine.bodies.length} /><ToolButton icon={Triangle} label="Fazuj" onClick={() => openEdgeCommand('chamfer')} disabled={!engine.bodies.length} /><ToolButton icon={PencilRuler} label="Edytuj" onClick={editSelection} disabled={!['sketch', 'profile', 'feature'].includes(selection?.kind)} /></RibbonGroup>
                <RibbonGroup label="KONSTRUKCJA"><ToolButton icon={Layers3} label="Płaszczyzna" disabled /><ToolButton icon={Variable} label="Parametry" onClick={() => setCommand({ type: 'parameters' })} /></RibbonGroup>
                <RibbonGroup label="SPRAWDŹ"><ToolButton icon={Ruler} label="Zmierz" disabled /><ToolButton icon={ScanSearch} label="Analiza" disabled /></RibbonGroup>
                <RibbonGroup label="WSTAW"><ToolButton icon={Upload} label="Otwórz" onClick={() => fileInputRef.current?.click()} /><ToolButton icon={Layers3} label="Komponent" disabled /></RibbonGroup>
                <RibbonGroup label="WYBIERZ"><ToolButton icon={MousePointer2} label="Wybierz" onClick={() => setSelection({ kind: 'document', id: document.id })} /></RibbonGroup>
                <RibbonGroup label="EKSPORT" end><ToolButton icon={FileDown} label="STL" onClick={() => exportModel('stl')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={Printer} label="Druk 3D" onClick={() => switchWorkspace('print')} /></RibbonGroup>
              </>
            )}
          </div>
        </div>
      </section>

      <div className={`modeling-content ${workspace === 'print' ? 'with-print-panel' : ''}`}>
        <ProjectBrowser document={document} bodies={engine.bodies} selection={selection} activeSketchId={activeSketchId} onSelect={setSelection} />
        <main className="modeling-stage">
          <ModelViewport
            bodies={engine.bodies}
            sketches={document.sketches}
            activeSketchId={activeSketchId}
            draftProfile={draftProfile}
            draftType={command?.type === 'rectangle' || command?.type === 'circle' ? command.type : null}
            onDraftChange={updateCommand}
            parameters={document.parameters}
            showGrid={!activeSketchId || sketchOptions.grid}
            selectedBodyId={selection?.kind === 'body' ? selection.id : null}
            onSelectBody={(id) => setSelection(id ? { kind: 'body', id } : { kind: 'document', id: document.id })}
            bed={document.print}
            showBed={workspace === 'print'}
          />
          <div className={`engine-status ${engine.status}`}><span />{engine.status === 'ready' ? `${command?.previewFeature ? 'Podgląd' : 'Model'} gotowy · ${engine.bodies.length} ${engine.bodies.length === 1 ? 'bryła' : 'brył'}` : engine.status === 'computing' ? 'Przeliczanie historii…' : engine.status === 'loading' ? 'Uruchamianie OpenCascade…' : engine.error}</div>
          {!document.sketches.length && !engine.bodies.length && !command && (
            <div className="empty-canvas"><PencilRuler size={28} /><strong>Zacznij od szkicu</strong><span>Wybierz płaszczyznę, narysuj zamknięty profil i wyciągnij go w bryłę.</span><button type="button" onClick={startSketch}>Utwórz szkic</button></div>
          )}
          {command?.type === 'plane' && <PlanePicker onPick={pickPlane} onCancel={() => { setCommand(null); setWorkspace('solid'); }} />}
          <CommandDialog command={command} profileName={selectedProfile?.name || ''} onChange={updateCommand} onConfirm={command?.type === 'rectangle' || command?.type === 'circle' ? confirmProfile : confirmFeature} onCancel={() => setCommand(null)} />
          {command?.type === 'parameters' && <ParametersDialog document={document} commit={commit} onClose={() => setCommand(null)} />}
          {activeSketchId && <SketchPalette options={sketchOptions} onChange={(key, value) => setSketchOptions((current) => ({ ...current, [key]: value }))} onFinish={finishSketch} />}
        </main>
        {workspace === 'print' && <PrintPanel document={document} bodies={engine.bodies} engine={engine} commit={commit} onExport={exportModel} onClose={() => switchWorkspace('solid')} />}
      </div>

      <footer className="modeling-footer">
        <div className="notice" role="status"><span className={`status-dot ${engine.status}`} />{engine.error || notice}</div>
        <div className="timeline" aria-label="Parametryczna oś czasu">
          <div className="timeline-controls"><button type="button" title="Przejdź na początek"><SkipBack size={14} /></button><button type="button" title="Poprzednia operacja"><StepBack size={14} /></button><button type="button" title="Następna operacja"><StepForward size={14} /></button></div>
          <span className="timeline-start" />
          {document.features.map((feature, index) => {
            const result = timelineStatus.get(feature.id);
            return (
              <button key={feature.id} className={`timeline-item ${selection?.kind === 'feature' && selection.id === feature.id ? 'selected' : ''} ${result?.status || ''}`} type="button" onClick={() => setSelection({ kind: 'feature', id: feature.id })} onDoubleClick={editSelection} title={`${index + 1}. ${feature.name}${result?.error ? ` — ${result.error}` : ''}`}>
                {featureIcon(feature.type, 16)}<span>{index + 1}</span>
              </button>
            );
          })}
          <span className="timeline-end" />
        </div>
      </footer>
    </section>
  );
}
