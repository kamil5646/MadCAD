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
  DOCUMENT_SCHEMA_VERSION,
  cloneDocument,
  createCircleProfile,
  createDocument,
  createFeature,
  createParameter,
  createRectangleProfile,
  createSketch,
  createStarterDocument,
  openDocument,
  touchDocument,
} from '../cad-core/document.js';
import {
  createDetectedProfile,
  createSketchLine,
  createSketchPoint,
  createTangentArcContinuation,
  upsertSketchProfile,
} from '../cad-core/sketch-model.js';
import { useCadEngine } from '../cad-core/useCadEngine.js';
import ModelViewport from './ModelViewport.jsx';
import './modeling.css';

const AUTOSAVE_KEY = 'madcad:modeling-document:v4';

const MAIN_TABS = [
  { id: 'solid', label: 'BRYŁA' },
  { id: 'tools', label: 'NARZĘDZIA' },
  { id: 'print', label: 'DRUK 3D' },
];

const PLANE_LABELS = { XY: 'Góra (XY)', XZ: 'Przód (XZ)', YZ: 'Prawo (YZ)' };

const TOOL_DESCRIPTIONS = {
  'Utwórz szkic': 'Wybierz płaszczyznę i rozpocznij rysowanie profilu 2D.',
  'Prostokąt': 'Narysuj prostokątny profil, klikając środek i punkt rozmiaru.',
  'Okrąg': 'Narysuj okrąg, klikając środek i punkt promienia.',
  'Linia': 'Utwórz pojedynczy segment przez dwa punkty albo przez dokładną długość i kąt.',
  'Polilinia': 'Rysuj ciąg segmentów; kliknij punkt początkowy, aby zamknąć profil.',
  'Łuk styczny': 'Kontynuuj polilinię łukiem stycznym do poprzedniego segmentu.',
  'Zakończ szkic': 'Zamknij edycję szkicu i wróć do modelowania bryły.',
  'Wyciągnij': 'Wyciągnij zaznaczony profil w bryłę; możesz też przeciągnąć niebieską strzałkę.',
  'Otwór': 'Wytnij cylindryczny otwór z zaznaczonego profilu okręgu.',
  'Zaokrąglij': 'Zaokrąglij krawędzie zaznaczonej bryły podanym promieniem.',
  'Fazuj': 'Zetnij ostre krawędzie zaznaczonej bryły podaną odległością.',
  'Edytuj': 'Otwórz parametry zaznaczonego szkicu, profilu lub kroku historii.',
  'Parametry': 'Dodaj i zmień nazwane wymiary sterujące modelem.',
  'Otwórz': 'Wczytaj zapisany projekt MadCAD z dysku.',
  'Wybierz': 'Wyczyść zaznaczenie i wróć do trybu wyboru obiektów.',
  'STL': 'Eksportuj siatkę gotową do programu przygotowującego druk 3D.',
  'STEP': 'Eksportuj dokładną bryłę B-Rep do wymiany z innymi programami CAD.',
  'Druk 3D': 'Otwórz kontrolę gabarytów i ustawień eksportu do druku 3D.',
  'Kontrola druku': 'Sprawdź, czy model mieści się na stole drukarki.',
};

function loadInitialDocument() {
  try {
    const saved = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return { document: createStarterDocument(), readOnly: false, warning: '', sourceVersion: null };
    return openDocument(JSON.parse(saved));
  } catch (error) {
    return {
      document: createStarterDocument(),
      readOnly: false,
      warning: `Nie udało się odtworzyć autozapisu: ${error.message}. Utworzono bezpieczny dokument startowy.`,
      sourceVersion: null,
    };
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

function ToolButton({ icon: Icon, label, onClick, disabled = false, primary = false, compact = false, title, description }) {
  const help = description || title || TOOL_DESCRIPTIONS[label] || label;
  return (
    <button
      className={`ribbon-tool ${primary ? 'primary' : ''} ${compact ? 'compact' : ''}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={help}
      aria-label={`${label}. ${help}`}
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

function ProjectBrowser({ document, bodies, selection, activeSketchId, onSelect, onClose }) {
  const [expanded, setExpanded] = useState({ origin: true, sketches: true, bodies: true });
  const toggle = (key) => setExpanded((current) => ({ ...current, [key]: !current[key] }));
  return (
    <aside className="model-browser" aria-label="Przeglądarka projektu">
      <div className="browser-heading"><strong>PRZEGLĄDARKA</strong><button type="button" title="Zwiń przeglądarkę" onClick={onClose}><PanelLeftClose size={14} /></button></div>
      <button className={`tree-row tree-root ${selection?.kind === 'document' ? 'selected' : ''}`} type="button" title="Zaznacz cały dokument projektu." onClick={() => onSelect({ kind: 'document', id: document.id })}>
        <ChevronDown size={13} /><FileBox size={14} /><strong>{document.name || 'Bez nazwy'}</strong>
      </button>
      <button className="tree-row tree-child" type="button" title="Otwórz nazwane parametry sterujące wymiarami modelu." onClick={() => onSelect({ kind: 'settings', id: document.id })}>
        <span /><Settings2 size={14} /><span>Parametry modelu</span><small>mm</small>
      </button>

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj płaszczyzny początku układu." onClick={() => toggle('origin')}>
        {expanded.origin ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Layers3 size={14} /><span>Początek</span>
      </button>
      {expanded.origin && (
        <div className="tree-nested">
          {Object.entries(PLANE_LABELS).map(([plane, label]) => (
            <button key={plane} className="tree-row tree-grandchild" type="button" title={`Zaznacz płaszczyznę ${plane} jako bazę szkicu.`} onClick={() => onSelect({ kind: 'plane', id: plane })}>
              <span /><Frame size={13} /><span>{label}</span>
            </button>
          ))}
        </div>
      )}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj szkice i ich profile." onClick={() => toggle('sketches')}>
        {expanded.sketches ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Szkice</span><small>{document.sketches.length}</small>
      </button>
      {expanded.sketches && document.sketches.map((sketch) => (
        <React.Fragment key={sketch.id}>
          <button
            className={`tree-row tree-grandchild ${selection?.kind === 'sketch' && selection.id === sketch.id ? 'selected' : ''} ${activeSketchId === sketch.id ? 'editing' : ''}`}
            type="button"
            title={`Zaznacz ${sketch.name}; użyj Edytuj, aby wrócić do szkicu.`}
            onClick={() => onSelect({ kind: 'sketch', id: sketch.id })}
          >
            <span /><PencilRuler size={13} /><span>{sketch.name}</span><small>{sketch.plane}</small>
          </button>
          {sketch.profiles.map((profile) => (
            <button
              className={`tree-row tree-profile ${selection?.kind === 'profile' && selection.id === profile.id ? 'selected' : ''}`}
              key={profile.id}
              type="button"
              title={`Zaznacz ${profile.name}; przeciągnij strzałkę lub użyj Wyciągnij.`}
              onClick={() => onSelect({ kind: 'profile', id: profile.id, sketchId: sketch.id })}
            >
              <span />{profile.type === 'circle' ? <Circle size={12} /> : <Square size={12} />}<span>{profile.name}</span>
            </button>
          ))}
        </React.Fragment>
      ))}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj utworzone bryły." onClick={() => toggle('bodies')}>
        {expanded.bodies ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Bryły</span><small>{bodies.length}</small>
      </button>
      {expanded.bodies && bodies.map((body) => (
        <button
          className={`tree-row tree-grandchild ${selection?.kind === 'body' && selection.id === body.id ? 'selected' : ''}`}
          key={body.id}
          type="button"
          title={`Zaznacz bryłę ${body.name} do dalszych operacji.`}
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

function CommandDialog({ command, profileName, onChange, onConfirm, onCancel, onUndoSegment, onFinishPath }) {
  if (!command || command.type === 'plane' || command.type === 'parameters') return null;
  const isRectangle = command.type === 'rectangle';
  const isCircle = command.type === 'circle';
  const isExtrude = command.type === 'extrude';
  const isHole = command.type === 'hole';
  const isFillet = command.type === 'fillet';
  const isSketchPath = command.type === 'line' || command.type === 'polyline';
  const title = isRectangle ? 'Prostokąt ze środka' : isCircle ? 'Okrąg ze środka' : isExtrude ? 'Wyciągnięcie' : isHole ? 'Otwór' : isFillet ? 'Zaokrąglenie' : command.type === 'line' ? 'Linia' : command.type === 'polyline' ? 'Polilinia' : 'Fazowanie';
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
        {isSketchPath && (
          <>
            <Field label="Długość" value={command.length} onChange={(length) => onChange({ length })} suffix="mm" autoFocus />
            <Field label="Kąt" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" />
            <label className="command-field">
              <span>Segment</span>
              <select value={command.segmentMode} onChange={(event) => onChange({ segmentMode: event.target.value })}>
                <option value="line">Linia</option>
                <option value="tangentArc" disabled={!command.segmentIds.length}>Łuk styczny</option>
              </select>
            </label>
          </>
        )}
        <div className="command-preview-note"><span className="preview-dot" />{isSketchPath ? 'Klikaj punkty na płótnie lub dodaj następny punkt dokładną długością i kątem.' : isRectangle || isCircle ? 'Kliknij środek i drugi punkt na płótnie albo wpisz dokładne wymiary.' : isExtrude ? 'Przeciągnij niebieską strzałkę na modelu albo wpisz dokładną odległość.' : 'Podgląd jest przeliczany na dokładnej bryle B-Rep.'}</div>
      </div>
      {isSketchPath ? (
        <footer><button className="secondary" type="button" onClick={onUndoSegment} disabled={!command.pointIds.length}>Cofnij segment</button><button className="secondary" type="button" onClick={onFinishPath}>Zakończ</button><button className="confirm" type="button" onClick={onConfirm} disabled={!command.lastPoint}><Check size={14} /> Dodaj dokładnie</button></footer>
      ) : (
        <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> OK</button></footer>
      )}
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

function PrintPanel({ document, bodies, engine, commit, onExport, onClose, readOnly = false }) {
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
        <Field type="number" label="Szerokość X" value={document.print.bedWidth} suffix="mm" onChange={(value) => update('bedWidth', value)} disabled={readOnly} />
        <Field type="number" label="Głębokość Y" value={document.print.bedDepth} suffix="mm" onChange={(value) => update('bedDepth', value)} disabled={readOnly} />
        <Field type="number" label="Wysokość Z" value={document.print.bedHeight} suffix="mm" onChange={(value) => update('bedHeight', value)} disabled={readOnly} />
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
  const [initialOpen] = useState(loadInitialDocument);
  const history = useDocumentHistory(initialOpen.document);
  const { document } = history;
  const [documentAccess, setDocumentAccess] = useState({
    readOnly: Boolean(initialOpen.readOnly),
    sourceVersion: initialOpen.sourceVersion,
    originalDocument: initialOpen.originalDocument || null,
  });
  const [workspace, setWorkspace] = useState('solid');
  const [selection, setSelection] = useState({ kind: 'document', id: document.id });
  const [activeSketchId, setActiveSketchId] = useState(null);
  const [command, setCommand] = useState(null);
  const [browserOpen, setBrowserOpen] = useState(true);
  const [sketchOptions, setSketchOptions] = useState({ grid: true, snap: true, profiles: true, points: true, dimensions: true, constraints: true, construction: true, sketch3d: false });
  const [notice, setNotice] = useState(initialOpen.warning || 'Gotowe. Wybierz „Utwórz szkic”, aby rozpocząć modelowanie.');
  const fileInputRef = useRef(null);
  const readOnly = documentAccess.readOnly;
  const readOnlyNotice = () => setNotice(`Projekt v${documentAccess.sourceVersion} jest otwarty tylko do odczytu. Utwórz nowy projekt albo otwórz obsługiwaną wersję, aby edytować.`);
  const commit = (mutator) => {
    if (readOnly) {
      readOnlyNotice();
      return;
    }
    history.commit(mutator);
  };

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
  const engine = useCadEngine(previewDocument, { quality: command?.previewFeature ? 'preview' : 'display' });
  const actualBodyIds = useMemo(() => new Set(document.features.filter((feature) => feature.type === 'extrude' && feature.operation === 'new').map((feature) => `body-${feature.id}`)), [document.features]);
  const actualBodies = command?.previewFeature ? engine.bodies.filter((body) => actualBodyIds.has(body.id)) : engine.bodies;
  const targetBodyId = selection?.kind === 'body' ? selection.id : (engine.bodies[0]?.id || firstBodyId || null);

  useEffect(() => {
    if (readOnly) return undefined;
    const timeout = window.setTimeout(() => window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(document)), 300);
    return () => window.clearTimeout(timeout);
  }, [document, readOnly]);

  useEffect(() => {
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (!verifyMode) return undefined;
    window.__madcadVerifyExport = engine.exportModel;
    window.__madcadVerifyRestartWorker = engine.restartWorkerForTest;
    return () => {
      delete window.__madcadVerifyExport;
      delete window.__madcadVerifyRestartWorker;
    };
  }, [engine.exportModel, engine.restartWorkerForTest]);

  useEffect(() => {
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (!verifyMode) return undefined;
    window.__madcadVerifyEngineState = {
      status: engine.status,
      revision: engine.revision,
      cache: engine.cache,
      bodies: engine.bodies,
      timeline: engine.timeline,
      diagnostics: engine.diagnostics,
    };
    return () => { delete window.__madcadVerifyEngineState; };
  }, [engine.status, engine.revision, engine.cache, engine.bodies, engine.timeline, engine.diagnostics]);

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
    if (readOnly) return readOnlyNotice();
    setWorkspace('sketch');
    setCommand({ type: 'plane' });
    setNotice('Wybierz płaszczyznę szkicu.');
  };

  const pickPlane = (plane) => {
    if (readOnly) return readOnlyNotice();
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
    if (readOnly) return readOnlyNotice();
    if (profile && !['rectangle', 'circle'].includes(type)) {
      setNotice('Profil z segmentów edytuje się przez jego punkty i krawędzie; zaznaczanie segmentów wchodzi w R1.3.');
      return;
    }
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

  const openSketchPath = (type) => {
    if (readOnly) return readOnlyNotice();
    if (!activeSketchId) {
      startSketch();
      return;
    }
    setCommand({
      type,
      pointIds: [],
      segmentIds: [],
      auxiliaryPointIds: [],
      points: [],
      tangents: [],
      firstPoint: null,
      lastPoint: null,
      lastTangent: null,
      length: '20',
      angle: '0',
      segmentMode: 'line',
    });
    setNotice(type === 'line' ? 'Wskaż początek i koniec linii.' : 'Klikaj kolejne punkty polilinii; kliknij początek, aby zamknąć profil.');
  };

  const finishSketchPath = () => {
    if (command?.type !== 'line' && command?.type !== 'polyline') return;
    if (!command.segmentIds.length && command.pointIds.length === 1) {
      const pendingPointId = command.pointIds[0];
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        sketch.entities = sketch.entities.filter((entity) => entity.id !== pendingPointId);
      });
    }
    setCommand(null);
    setNotice(command.segmentIds.length ? 'Zakończono rysowanie ścieżki.' : 'Anulowano pustą ścieżkę.');
  };

  const appendSketchPoint = (coordinates) => {
    if (command?.type !== 'line' && command?.type !== 'polyline') return;
    const point = coordinates.map((value) => Number(value));
    if (point.some((value) => !Number.isFinite(value))) {
      setNotice('Punkt szkicu musi mieć prawidłowe współrzędne.');
      return;
    }
    const activeSketch = document.sketches.find((sketch) => sketch.id === activeSketchId);
    if (!activeSketch) return;

    if (!command.lastPoint) {
      const start = createSketchPoint({ x: point[0].toFixed(3), y: point[1].toFixed(3) });
      commit((next) => next.sketches.find((sketch) => sketch.id === activeSketchId).entities.push(start));
      setCommand((current) => ({ ...current, pointIds: [start.id], points: [point], firstPoint: point, lastPoint: point }));
      setNotice('Punkt początkowy ustawiony. Wskaż koniec segmentu.');
      return;
    }

    const start = command.lastPoint;
    const distance = Math.hypot(point[0] - start[0], point[1] - start[1]);
    const closes = command.type === 'polyline'
      && command.segmentIds.length >= 2
      && Math.hypot(point[0] - command.firstPoint[0], point[1] - command.firstPoint[1]) <= 2;
    if (!closes && distance <= 1e-7) {
      setNotice('Koniec segmentu musi różnić się od początku.');
      return;
    }

    const targetPoint = closes ? null : createSketchPoint({ x: point[0].toFixed(3), y: point[1].toFixed(3) });
    const targetPointId = closes ? command.pointIds[0] : targetPoint.id;
    const end = closes ? command.firstPoint : point;
    let segment;
    let auxiliaryPoint = null;
    let endTangent;
    if (command.segmentMode === 'tangentArc' && command.lastTangent) {
      try {
        const continuation = createTangentArcContinuation({
          startPointId: command.pointIds.at(-1),
          endPointId: targetPointId,
          start,
          end,
          tangent: command.lastTangent,
        });
        auxiliaryPoint = continuation.centerPoint;
        segment = continuation.arc;
        endTangent = continuation.endTangent;
      } catch (error) {
        setNotice(`${error.message} Wybierz punkt poza kierunkiem stycznej.`);
        return;
      }
    } else {
      segment = createSketchLine({ startPointId: command.pointIds.at(-1), endPointId: targetPointId });
      const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
      endTangent = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
    }

    let detectedProfile = null;
    if (closes) {
      const detectionSketch = structuredClone(activeSketch);
      if (targetPoint) detectionSketch.entities.push(targetPoint);
      if (auxiliaryPoint) detectionSketch.entities.push(auxiliaryPoint);
      detectionSketch.entities.push(segment);
      detectedProfile = createDetectedProfile(detectionSketch, [...command.segmentIds, segment.id], {
        name: `Profil ${document.sketches.flatMap((item) => item.profiles).length + 1}`,
      });
    }
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      if (targetPoint) sketch.entities.push(targetPoint);
      if (auxiliaryPoint) sketch.entities.push(auxiliaryPoint);
      sketch.entities.push(segment);
      if (detectedProfile) sketch.profiles.push(detectedProfile);
    });

    if (closes) {
      setSelection({ kind: 'profile', id: detectedProfile.id, sketchId: activeSketchId });
      setCommand(null);
      setNotice('Polilinia zamknięta. Utworzono profil gotowy do wyciągnięcia.');
      return;
    }
    if (command.type === 'line') {
      setCommand(null);
      setNotice('Linia została dodana.');
      return;
    }
    setCommand((current) => ({
      ...current,
      pointIds: [...current.pointIds, targetPoint.id],
      segmentIds: [...current.segmentIds, segment.id],
      auxiliaryPointIds: [...current.auxiliaryPointIds, auxiliaryPoint?.id || null],
      points: [...current.points, point],
      tangents: [...current.tangents, endTangent],
      lastPoint: point,
      lastTangent: endTangent,
      segmentMode: 'line',
    }));
    setNotice('Segment dodany. Kliknij kolejny punkt, wybierz łuk styczny albo zamknij profil.');
  };

  const confirmExactSketchSegment = () => {
    if (!command?.lastPoint) {
      setNotice('Najpierw wskaż punkt początkowy na szkicu.');
      return;
    }
    const length = Number(command.length);
    const angle = Number(command.angle);
    if (!(length > 0) || !Number.isFinite(angle)) {
      setNotice('Długość musi być dodatnia, a kąt musi być liczbą.');
      return;
    }
    const radians = angle * Math.PI / 180;
    appendSketchPoint([command.lastPoint[0] + (Math.cos(radians) * length), command.lastPoint[1] + (Math.sin(radians) * length)]);
  };

  const undoSketchSegment = () => {
    if (command?.type !== 'polyline' && command?.type !== 'line') return;
    const segmentId = command.segmentIds.at(-1);
    const pointId = command.pointIds.at(-1);
    const auxiliaryPointId = command.auxiliaryPointIds.at(-1);
    if (!segmentId) {
      if (!pointId) return;
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        sketch.entities = sketch.entities.filter((entity) => entity.id !== pointId);
      });
      setCommand((current) => ({ ...current, pointIds: [], points: [], firstPoint: null, lastPoint: null }));
      return;
    }
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      const removed = new Set([segmentId, pointId, auxiliaryPointId].filter(Boolean));
      sketch.entities = sketch.entities.filter((entity) => !removed.has(entity.id));
    });
    setCommand((current) => ({
      ...current,
      pointIds: current.pointIds.slice(0, -1),
      segmentIds: current.segmentIds.slice(0, -1),
      auxiliaryPointIds: current.auxiliaryPointIds.slice(0, -1),
      points: current.points.slice(0, -1),
      tangents: current.tangents.slice(0, -1),
      lastPoint: current.points.at(-2) || current.firstPoint,
      lastTangent: current.tangents.at(-2) || null,
      segmentMode: 'line',
    }));
    setNotice('Cofnięto ostatni segment bez wychodzenia z polilinii.');
  };

  useEffect(() => {
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (!verifyMode) return undefined;
    window.__madcadVerifySketchPoint = appendSketchPoint;
    window.__madcadVerifyDocumentState = {
      schemaVersion: document.schemaVersion,
      sketches: document.sketches.map((sketch) => ({
        id: sketch.id,
        entities: sketch.entities.length,
        profiles: sketch.profiles.length,
      })),
      features: document.features.length,
      command: command ? {
        type: command.type,
        points: command.points?.length || 0,
        segments: command.segmentIds?.length || 0,
      } : null,
    };
    return () => {
      delete window.__madcadVerifySketchPoint;
      delete window.__madcadVerifyDocumentState;
    };
  }, [document, command]);

  const confirmProfile = () => {
    if (readOnly) return readOnlyNotice();
    const profile = command.type === 'rectangle'
      ? createRectangleProfile({ name: command.name, width: command.width, height: command.height, x: command.x, y: command.y })
      : createCircleProfile({ name: command.name, diameter: command.diameter, x: command.x, y: command.y });
    if (command.editId) profile.id = command.editId;
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      upsertSketchProfile(sketch, profile);
    });
    setSelection({ kind: 'profile', id: profile.id, sketchId: activeSketchId });
    setCommand(null);
    setNotice(`${profile.name} dodany do szkicu.`);
  };

  const openExtrude = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) {
      setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz zamknięty profil w przeglądarce.');
      return;
    }
    beginOrUpdateExtrude(10);
    setNotice('Podgląd wyciągnięcia jest aktywny. Potwierdź operację przyciskiem OK.');
  };

  const beginOrUpdateExtrude = (distance) => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) return;
    setCommand((current) => {
      const editing = current?.type === 'extrude' ? current : null;
      const operation = editing?.operation || (engine.bodies.length ? 'join' : 'new');
      const next = {
        ...(editing || {}),
        type: 'extrude',
        distance: String(distance),
        operation,
      };
      next.previewFeature = createFeature('extrude', {
        name: editing?.previewFeature?.name || `Wyciągnięcie ${document.features.length + 1}`,
        sketchId: selectedProfileMatch?.sketch.id,
        profileIds: [selectedProfile.id],
        distance: next.distance,
        operation,
        targetBodyId: operation === 'new' ? null : targetBodyId,
      });
      if (editing?.previewFeature?.id) next.previewFeature.id = editing.previewFeature.id;
      if (editing?.editId) next.editId = editing.editId;
      return next;
    });
    setNotice(`Wyciągnięcie ustawione przeciągnięciem: ${Number(distance).toFixed(1)} mm. Kliknij OK, aby zapisać operację.`);
  };

  const openHole = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || selectedProfile.type !== 'circle' || !targetBodyId || activeSketchId) {
      setNotice('Zakończ szkic, wybierz profil okręgu oraz bryłę docelową.');
      return;
    }
    setCommand({ type: 'hole', diameter: selectedProfile.geometry.diameter, depth: '10', previewFeature: null });
    window.setTimeout(() => updateCommand({ diameter: selectedProfile.geometry.diameter, depth: '10' }), 0);
  };

  const openEdgeCommand = (type) => {
    if (readOnly) return readOnlyNotice();
    if (!targetBodyId || activeSketchId) {
      setNotice('Wybierz bryłę docelową.');
      return;
    }
    setCommand({ type, size: '1', previewFeature: null });
    window.setTimeout(() => updateCommand({ size: '1' }), 0);
  };

  const confirmFeature = () => {
    if (readOnly) return readOnlyNotice();
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
    if (readOnly) return readOnlyNotice();
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
    setDocumentAccess({ readOnly: false, sourceVersion: DOCUMENT_SCHEMA_VERSION, originalDocument: null });
    setSelection({ kind: 'document', id: blank.id });
    setActiveSketchId(null);
    setCommand(null);
    setWorkspace('solid');
    setNotice('Nowy pusty projekt. Utwórz pierwszy szkic.');
  };

  const saveProject = async () => {
    if (readOnly) return readOnlyNotice();
    const payload = JSON.stringify(document, null, 2);
    if (window.desktopApp?.saveTextFile) {
      const result = await window.desktopApp.saveTextFile({
        defaultName: `${safeName(document.name)}.madcad`,
        text: payload,
        filters: [{ name: 'Projekt MadCAD', extensions: ['madcad'] }, { name: 'JSON', extensions: ['json'] }],
        atomic: true,
        createBackup: true,
      });
      setNotice(result?.ok ? `Zapisano projekt atomowo: ${result.filePath}${result.backupPath ? ' · poprzednia wersja: .bak' : ''}` : result?.canceled ? 'Anulowano zapis.' : `Nie udało się zapisać: ${result?.error || 'nieznany błąd'}`);
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
      const opened = openDocument(JSON.parse(await file.text()));
      history.replace(opened.document);
      setDocumentAccess({ readOnly: opened.readOnly, sourceVersion: opened.sourceVersion, originalDocument: opened.originalDocument });
      setSelection({ kind: 'document', id: opened.document.id });
      setActiveSketchId(null);
      setCommand(null);
      setWorkspace('solid');
      setNotice(`${opened.warning ? `${opened.warning} ` : ''}Otwarto projekt ${opened.document.name}.`);
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
      if (readOnly) return readOnlyNotice();
      setCommand({ type: 'parameters' });
      setWorkspace('solid');
      return;
    }
    setCommand(null);
    setActiveSketchId(null);
    setWorkspace(id);
    setNotice(id === 'print' ? 'Sprawdź gabaryty i przygotuj plik do druku 3D.' : 'Obszar modelowania bryłowego.');
  };

  const selectTimelineStep = (direction) => {
    if (!document.features.length) return;
    const currentIndex = selection?.kind === 'feature'
      ? document.features.findIndex((feature) => feature.id === selection.id)
      : -1;
    const nextIndex = direction === 'start'
      ? 0
      : direction === 'previous'
        ? Math.max(0, currentIndex < 0 ? document.features.length - 1 : currentIndex - 1)
        : Math.min(document.features.length - 1, currentIndex + 1);
    const feature = document.features[nextIndex];
    setSelection({ kind: 'feature', id: feature.id });
    setNotice(`${nextIndex + 1}. ${feature.name}`);
  };

  const handleBrowserSelection = (nextSelection) => {
    if (nextSelection.kind === 'settings') {
      setCommand({ type: 'parameters' });
      setNotice('Parametry modelu sterują wymiarami szkiców i operacji.');
      return;
    }
    if (nextSelection.kind === 'plane') {
      if (readOnly) {
        setSelection(nextSelection);
        readOnlyNotice();
        return;
      }
      pickPlane(nextSelection.id);
      return;
    }
    setSelection(nextSelection);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && command) {
        event.preventDefault();
        if (command.type === 'line' || command.type === 'polyline') finishSketchPath();
        else setCommand(null);
        return;
      }
      if (event.key === 'Enter' && (command?.type === 'line' || command?.type === 'polyline')) {
        event.preventDefault();
        finishSketchPath();
        return;
      }
      if (event.key === 'Enter' && command?.previewFeature) {
        event.preventDefault();
        confirmFeature();
        return;
      }
      if (event.ctrlKey && command?.type === 'polyline' && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undoSketchSegment();
        return;
      }
      if (event.ctrlKey && !command && !readOnly && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
        event.preventDefault();
        if (event.key.toLowerCase() === 'y' || event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'e' && selectedProfile && !activeSketchId && !readOnly) {
        event.preventDefault();
        openExtrude();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [command, selectedProfile, activeSketchId, readOnly, history]);

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
        <div className="app-menu"><div className="brand-mark">M</div><button type="button" title="Dokumentacja" onClick={onClose}><Home size={16} /></button><button className={browserOpen ? 'active' : ''} type="button" title="Pokaż lub ukryj przeglądarkę" onClick={() => setBrowserOpen((open) => !open)}><Grid2X2 size={16} /></button><button type="button" title="Nowy projekt" onClick={createNew}><FilePlus2 size={16} /></button><button type="button" title="Otwórz projekt" onClick={() => fileInputRef.current?.click()}><FolderOpen size={16} /></button><button type="button" title={readOnly ? 'Zapis jest zablokowany dla projektu z nowszej wersji.' : 'Zapisz'} disabled={readOnly} onClick={saveProject}><Save size={16} /></button></div>
        <input ref={fileInputRef} hidden type="file" accept=".madcad,.json,application/json" onChange={openProject} />
        <div className="document-tab"><Box size={15} /><input value={document.name} aria-label="Nazwa projektu" disabled={readOnly} onChange={(event) => commit((next) => { next.name = event.target.value; })} />{readOnly ? <span className="read-only-badge">TYLKO ODCZYT · v{documentAccess.sourceVersion}</span> : <span>*</span>}<button type="button" title="Zamknij dokument" onClick={onClose}><X size={13} /></button></div>
        <div className="title-actions"><button type="button" disabled={readOnly || !history.canUndo} onClick={history.undo} title="Cofnij"><Undo2 size={15} /></button><button type="button" disabled={readOnly || !history.canRedo} onClick={history.redo} title="Ponów"><Redo2 size={15} /></button><button type="button" title="Dokumentacja 2D" onClick={onClose}><AppWindow size={15} /><span>Dokumentacja</span></button></div>
      </header>

      <section className="command-area">
        <div className="workspace-switcher"><div className="workspace-label"><span>PROJEKT</span></div></div>
        <div className="command-ribbon">
          <nav className="workspace-tabs" aria-label="Obszary robocze">
            {activeSketchId ? <button className="active" type="button" title="Aktywny obszar edycji szkicu 2D.">SZKICUJ</button> : MAIN_TABS.map((item) => <button key={item.id} className={workspace === item.id ? 'active' : ''} type="button" title={item.id === 'solid' ? 'Modelowanie bryłowe i operacje na profilach.' : item.id === 'tools' ? 'Parametry i narzędzia dokumentu.' : 'Kontrola modelu oraz eksport do druku 3D.'} onClick={() => switchWorkspace(item.id)}>{item.label}</button>)}
          </nav>
          <div className="modeling-ribbon">
            {activeSketchId ? (
              <>
                <RibbonGroup label="UTWÓRZ"><ToolButton icon={Minus} label="Linia" onClick={() => openSketchPath('line')} primary disabled={readOnly} /><ToolButton icon={Move} label="Polilinia" onClick={() => openSketchPath('polyline')} disabled={readOnly} /><ToolButton icon={RotateCw} label="Łuk styczny" onClick={() => setCommand((current) => current?.type === 'polyline' ? { ...current, segmentMode: 'tangentArc' } : current)} disabled={readOnly || command?.type !== 'polyline' || !command.segmentIds.length} /><ToolButton icon={Square} label="Prostokąt" onClick={() => openProfileCommand('rectangle')} disabled={readOnly} /><ToolButton icon={Circle} label="Okrąg" onClick={() => openProfileCommand('circle')} disabled={readOnly} /></RibbonGroup>
                <RibbonGroup label="SZKIC" end><ToolButton icon={Check} label="Zakończ szkic" onClick={finishSketch} primary /></RibbonGroup>
              </>
            ) : workspace === 'print' ? (
              <>
                <RibbonGroup label="PRZYGOTUJ"><ToolButton icon={Printer} label="Kontrola druku" primary onClick={() => setWorkspace('print')} /></RibbonGroup>
                <RibbonGroup label="EKSPORT"><ToolButton icon={HardDriveDownload} label="STL" onClick={() => exportModel('stl')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={FileBox} label="STEP" onClick={() => exportModel('step')} disabled={!engine.bodies.length || engine.status !== 'ready'} /></RibbonGroup>
              </>
            ) : (
              <>
                <RibbonGroup label="UTWÓRZ"><ToolButton icon={PencilRuler} label="Utwórz szkic" onClick={startSketch} primary disabled={readOnly} /><ToolButton icon={Box} label="Wyciągnij" onClick={openExtrude} disabled={readOnly || !selectedProfile} /><ToolButton icon={Cylinder} label="Otwór" onClick={openHole} disabled={readOnly || selectedProfile?.type !== 'circle' || !engine.bodies.length} /></RibbonGroup>
                <RibbonGroup label="ZMIANA"><ToolButton icon={CircleDotDashed} label="Zaokrąglij" onClick={() => openEdgeCommand('fillet')} disabled={readOnly || !engine.bodies.length} /><ToolButton icon={Triangle} label="Fazuj" onClick={() => openEdgeCommand('chamfer')} disabled={readOnly || !engine.bodies.length} /><ToolButton icon={PencilRuler} label="Edytuj" onClick={editSelection} disabled={readOnly || !['sketch', 'profile', 'feature'].includes(selection?.kind)} /></RibbonGroup>
                <RibbonGroup label="KONSTRUKCJA"><ToolButton icon={Variable} label="Parametry" onClick={() => setCommand({ type: 'parameters' })} disabled={readOnly} /></RibbonGroup>
                <RibbonGroup label="WSTAW"><ToolButton icon={Upload} label="Otwórz" onClick={() => fileInputRef.current?.click()} /></RibbonGroup>
                <RibbonGroup label="WYBIERZ"><ToolButton icon={MousePointer2} label="Wybierz" onClick={() => setSelection({ kind: 'document', id: document.id })} /></RibbonGroup>
                <RibbonGroup label="EKSPORT" end><ToolButton icon={FileDown} label="STL" onClick={() => exportModel('stl')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={Printer} label="Druk 3D" onClick={() => switchWorkspace('print')} /></RibbonGroup>
              </>
            )}
          </div>
        </div>
      </section>

      <div className={`modeling-content ${workspace === 'print' ? 'with-print-panel' : ''} ${browserOpen ? '' : 'without-browser'}`}>
        {browserOpen && <ProjectBrowser document={document} bodies={engine.bodies} selection={selection} activeSketchId={activeSketchId} onSelect={handleBrowserSelection} onClose={() => setBrowserOpen(false)} />}
        <main className="modeling-stage">
          <ModelViewport
            bodies={engine.bodies}
            sketches={document.sketches}
            activeSketchId={activeSketchId}
            draftProfile={draftProfile}
            draftType={command?.type === 'rectangle' || command?.type === 'circle' ? command.type : null}
            onDraftChange={readOnly ? undefined : updateCommand}
            sketchTool={command?.type === 'line' || command?.type === 'polyline' ? command.type : null}
            polylineDraft={command?.type === 'line' || command?.type === 'polyline' ? { lastPoint: command.lastPoint } : null}
            onSketchPoint={readOnly ? undefined : appendSketchPoint}
            parameters={document.parameters}
            showGrid={!activeSketchId || sketchOptions.grid}
            selectedBodyId={selection?.kind === 'body' ? selection.id : null}
            onSelectBody={(id) => setSelection(id ? { kind: 'body', id } : { kind: 'document', id: document.id })}
            selectedProfile={selectedProfile}
            selectedProfilePlane={selectedProfileMatch?.sketch.plane || 'XY'}
            directExtrudeDistance={command?.type === 'extrude' ? command.distance : 0}
            onDirectExtrude={readOnly ? undefined : beginOrUpdateExtrude}
            snapEnabled={sketchOptions.snap}
            bed={document.print}
            showBed={workspace === 'print'}
          />
          <div className={`engine-status ${engine.status}`}><span />{engine.status === 'ready' ? `${command?.previewFeature ? 'Podgląd' : 'Model'} gotowy · ${engine.bodies.length} ${engine.bodies.length === 1 ? 'bryła' : 'brył'}` : engine.status === 'computing' ? 'Przeliczanie historii…' : engine.status === 'loading' ? 'Uruchamianie OpenCascade…' : engine.error}</div>
          {!document.sketches.length && !engine.bodies.length && !command && !readOnly && (
            <div className="empty-canvas"><PencilRuler size={28} /><strong>Zacznij od szkicu</strong><span>Wybierz płaszczyznę, narysuj zamknięty profil i wyciągnij go w bryłę.</span><button type="button" onClick={startSketch}>Utwórz szkic</button></div>
          )}
          {command?.type === 'plane' && <PlanePicker onPick={pickPlane} onCancel={() => { setCommand(null); setWorkspace('solid'); }} />}
          <CommandDialog
            command={command}
            profileName={selectedProfile?.name || ''}
            onChange={updateCommand}
            onConfirm={command?.type === 'rectangle' || command?.type === 'circle' ? confirmProfile : command?.type === 'line' || command?.type === 'polyline' ? confirmExactSketchSegment : confirmFeature}
            onCancel={command?.type === 'line' || command?.type === 'polyline' ? finishSketchPath : () => setCommand(null)}
            onUndoSegment={undoSketchSegment}
            onFinishPath={finishSketchPath}
          />
          {command?.type === 'parameters' && <ParametersDialog document={document} commit={commit} onClose={() => setCommand(null)} />}
          {activeSketchId && <SketchPalette options={sketchOptions} onChange={(key, value) => setSketchOptions((current) => ({ ...current, [key]: value }))} onFinish={finishSketch} />}
        </main>
        {workspace === 'print' && <PrintPanel document={document} bodies={engine.bodies} engine={engine} commit={commit} onExport={exportModel} onClose={() => switchWorkspace('solid')} readOnly={readOnly} />}
      </div>

      <footer className="modeling-footer">
        <div className="notice" role="status"><span className={`status-dot ${engine.status}`} />{engine.error || notice}</div>
        <div className="timeline" aria-label="Parametryczna oś czasu">
          <div className="timeline-controls"><button type="button" title="Zaznacz pierwszy krok parametrycznej historii." onClick={() => selectTimelineStep('start')}><SkipBack size={14} /></button><button type="button" title="Zaznacz poprzednią operację w historii." onClick={() => selectTimelineStep('previous')}><StepBack size={14} /></button><button type="button" title="Zaznacz następną operację w historii." onClick={() => selectTimelineStep('next')}><StepForward size={14} /></button></div>
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
