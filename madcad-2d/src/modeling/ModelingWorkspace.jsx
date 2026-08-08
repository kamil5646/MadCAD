import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow,
  AlertTriangle,
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
  CircleHelp,
  Eye,
  EyeOff,
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
  Type,
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
  addDrivingSketchDimension,
  createSketchArc,
  createSketchConstraint,
  createSketchLine,
  createSketchPoint,
  createTangentArcContinuation,
  deleteSketchSelection,
  translateSketchSelection,
  upsertSketchProfile,
} from '../cad-core/sketch-model.js';
import {
  arcCenterStartEnd,
  arcThroughThreePoints,
  circleCenterRadius,
  circleThreePoints,
  circleTwoPoints,
  conicThroughControlPoint,
  ellipticalArcFromCenter,
  ellipseFromCenter,
  fitPointSpline,
  polygonFromEdge,
  rectangleFromCenter,
  rectangleThreePoints,
  rectangleTwoPoints,
  regularPolygon,
  controlPointSpline,
  slotCenterToCenter,
  slotArc,
  slotOverall,
  slotThreePoints,
} from '../cad-core/sketch-primitives.js';
import { refreshDetectedSketchProfiles } from '../cad-core/sketch-topology.js';
import { breakSketchEntity, chamferSketchLines, extendSketchEntity, filletSketchLines, offsetSketchEntities, offsetSketchProfile, trimSketchEntity } from '../cad-core/sketch-modifiers.js';
import { copySketchSelection, mirrorSketchSelection, rotateSketchSelection, scaleSketchSelection } from '../cad-core/sketch-transforms.js';
import { applySketchConstraintSolution, solveSketchConstraints, SKETCH_SOLVER_STATUS } from '../cad-core/sketch-solver.js';
import { useCadEngine } from '../cad-core/useCadEngine.js';
import { createTopologyReference, inspectTopologyReferences, reassignTopologyReference } from '../cad-core/topology-references.js';
import { createMidplane, createOffsetPlane, createThreePointPlane, resolveConstructionPlane, resolveConstructionPlanes } from '../cad-core/construction-planes.js';
import { createCylinderAxis, createEdgeAxis, createPlaneIntersectionAxis, createTwoPointAxis, resolveConstructionAxis, resolveConstructionAxes } from '../cad-core/construction-axes.js';
import { createCenterPoint, createIntersectionPoint, createVertexPoint, resolveConstructionPoint, resolveConstructionPoints } from '../cad-core/construction-points.js';
import { projectTopologyToSketch, synchronizeProjectedGeometry } from '../cad-core/sketch-projection.js';
import { resolveFaceEdgeHolePlacement } from '../cad-core/face-edge-hole.js';
import { measureSelection } from '../cad-core/measure-selection.js';
import { calculateMassProperties } from '../cad-core/mass-properties.js';
import { summarizeGeometryInspection } from '../cad-core/geometry-inspection.js';
import { applyPrinterProfile, PRINTER_PROFILES } from '../cad-core/printer-profiles.js';
import { calculatePrintLayout, orientationForBedFace } from '../cad-core/print-layout.js';
import { inspectThreeMfArchive } from '../cad-core/three-mf.js';
import { analyzePrintability } from '../cad-core/print-analysis.js';
import { inspectSketchImport, parseSketchImport } from '../cad-core/sketch-import.js';
import { observeModelingLocalization, resolveModelingLanguage } from './i18n.js';
import { tutorialForLanguage } from './tutorial-content.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
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
  'Łuk': 'Utwórz dokładny łuk przez trzy punkty albo przez środek, początek i koniec.',
  'Wielokąt': 'Utwórz regularny wielokąt wpisany, opisany albo z zadanej krawędzi.',
  'Elipsa': 'Utwórz dokładną, obróconą elipsę z dwóch promieni.',
  'Slot': 'Utwórz zamknięty slot przez środki łuków albo długość całkowitą.',
  'Spline': 'Utwórz krzywą przez punkty dopasowania albo punkty kontrolne.',
  'Punkt': 'Dodaj punkt referencyjny otworu albo punkt konstrukcyjny.',
  'Linia': 'Utwórz pojedynczy segment przez dwa punkty albo przez dokładną długość i kąt.',
  'Polilinia': 'Rysuj ciąg segmentów; kliknij punkt początkowy, aby zamknąć profil.',
  'Łuk styczny': 'Kontynuuj polilinię łukiem stycznym do poprzedniego segmentu.',
  'Przesuń': 'Przesuń zaznaczone punkty lub segmenty przeciągnięciem albo dokładnym ΔX i ΔY.',
  'Offset': 'Utwórz równoległą kopię zaznaczonej krzywej, łańcucha lub profilu; znak odległości wybiera stronę.',
  'Fillet szkicu': 'Zaokrąglij wspólny narożnik dokładnie dwóch zaznaczonych linii.',
  'Faza szkicu': 'Zetnij wspólny narożnik dokładnie dwóch zaznaczonych linii.',
  'Transformuj': 'Obróć, skopiuj, odbij lub przeskaluj zaznaczoną geometrię szkicu.',
  'Project': 'Przenieś wskazane wierzchołki i krawędzie modelu do szkicu jako trwale powiązaną geometrię.',
  'Usuń': 'Usuń zaznaczoną geometrię oraz bezpiecznie zależne profile i operacje.',
  'Zakończ szkic': 'Zamknij edycję szkicu i wróć do modelowania bryły.',
  'Wyciągnij': 'Wyciągnij zaznaczony profil w bryłę; możesz też przeciągnąć niebieską strzałkę.',
  'Boolean': 'Połącz, odejmij albo pozostaw część wspólną dwóch wskazanych brył.',
  'Otwór': 'Wytnij cylindryczny otwór z zaznaczonego profilu okręgu.',
  'Zaokrąglij': 'Zaokrąglij krawędzie zaznaczonej bryły podanym promieniem.',
  'Fazuj': 'Zetnij ostre krawędzie zaznaczonej bryły podaną odległością.',
  'Edytuj': 'Otwórz parametry zaznaczonego szkicu, profilu lub kroku historii.',
  'Parametry': 'Dodaj i zmień nazwane wymiary sterujące modelem.',
  'Płaszczyzna offset': 'Utwórz nazwaną płaszczyznę konstrukcyjną w parametrycznej odległości od XY, XZ albo YZ.',
  'Midplane': 'Utwórz płaszczyznę dokładnie pośrodku dwóch równoległych położeń.',
  'Plane 3 punkty': 'Utwórz płaszczyznę przechodzącą przez trzy niewspółliniowe punkty 3D.',
  'Oś z krawędzi': 'Utwórz trwałą oś z wybranej prostej krawędzi albo jej końców.',
  'Oś walca': 'Utwórz oś walca lub cylindrycznej ściany ze środka i kierunku.',
  'Oś 2 punkty': 'Utwórz parametryczną oś przechodzącą przez dwa punkty 3D.',
  'Oś przecięcia': 'Utwórz oś na linii przecięcia dwóch nazwanych płaszczyzn konstrukcyjnych.',
  'Punkt wierzchołka': 'Utwórz punkt śledzący trwały wierzchołek bryły albo dokładne współrzędne.',
  'Punkt centrum': 'Utwórz punkt w centrum wybranej krawędzi, ściany lub walca.',
  'Punkt przecięcia': 'Utwórz punkt w dokładnym przecięciu osi konstrukcyjnej z płaszczyzną.',
  'Otwórz': 'Wczytaj zapisany projekt MadCAD z dysku.',
  'Wybierz': 'Wyczyść zaznaczenie i wróć do trybu wyboru obiektów.',
  'STL': 'Eksportuj siatkę gotową do programu przygotowującego druk 3D.',
  'STEP': 'Eksportuj dokładną bryłę B-Rep do wymiany z innymi programami CAD.',
  'Druk 3D': 'Otwórz kontrolę gabarytów i ustawień eksportu do druku 3D.',
  'Kontrola druku': 'Sprawdź, czy model mieści się na stole drukarki.',
  'Zmierz': 'Pokaż dokładne wymiary zaznaczonej bryły, ściany, krawędzi, wierzchołka albo pary elementów.',
  'Przekrój': 'Włącz interaktywną płaszczyznę przekroju bez zmiany historii modelu.',
  'Masa': 'Oblicz objętość, pole, masę i środek masy dla zadanej gęstości materiału.',
  'Analiza': 'Sprawdź minimalny promień oraz dokładne kolizje pomiędzy bryłami.',
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
  const synchronize = (mutator) => setHistory((current) => {
    const next = cloneDocument(current.present);
    mutator(next);
    touchDocument(next);
    return { ...current, present: next };
  });
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
    synchronize,
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

function FirstPartTutorial({ onClose }) {
  const content = tutorialForLanguage(window.document.documentElement.lang);
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div className="tutorial-backdrop">
      <section className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="firstPartTutorialTitle">
        <header><div><strong id="firstPartTutorialTitle">{content.title}</strong><span>{content.intro}</span></div><button type="button" title={content.close} aria-label={content.close} onClick={onClose} autoFocus><X size={17} /></button></header>
        <div className="tutorial-body">
          <ol>{content.steps.map(([title, description]) => <li key={title}><strong>{title}</strong><span>{description}</span></li>)}</ol>
          <aside><h3><AlertTriangle size={16} />{content.limitationsTitle}</h3><ul>{content.limitations.map((item) => <li key={item}>{item}</li>)}</ul></aside>
        </div>
      </section>
    </div>
  );
}

function ProjectBrowser({ document, bodies, selection, activeSketchId, onSelect, onToggleReference, onClose }) {
  const [expanded, setExpanded] = useState({ origin: true, construction: true, sketches: true, bodies: true });
  const toggle = (key) => setExpanded((current) => ({ ...current, [key]: !current[key] }));
  const constructionReferences = document.references.filter((reference) => ['construction-plane', 'construction-axis', 'construction-point'].includes(reference.kind));
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

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj geometrię konstrukcyjną." onClick={() => toggle('construction')}>
        {expanded.construction ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Frame size={14} /><span>Konstrukcja</span><small>{constructionReferences.length}</small>
      </button>
      {expanded.construction && constructionReferences.map((reference) => (
        <div className="tree-reference-row" key={reference.id}>
          <button className={`tree-row tree-grandchild ${selection?.kind === (reference.kind === 'construction-axis' ? 'constructionAxis' : reference.kind === 'construction-point' ? 'constructionPoint' : 'constructionPlane') && selection.id === reference.id ? 'selected' : ''}`} type="button" title={`Zaznacz ${reference.name}.`} onClick={() => onSelect({ kind: reference.kind === 'construction-axis' ? 'constructionAxis' : reference.kind === 'construction-point' ? 'constructionPoint' : 'constructionPlane', id: reference.id })}>
            <span />{reference.kind === 'construction-axis' ? <Minus size={13} /> : reference.kind === 'construction-point' ? <CircleDotDashed size={13} /> : <Frame size={13} />}<span>{reference.name}</span><small>{reference.kind === 'construction-axis' ? 'OŚ' : reference.kind === 'construction-point' ? 'PKT' : (reference.basePlane || '3P')}</small>
          </button>
          <button className="tree-reference-visibility" type="button" title={reference.visible ? `Ukryj ${reference.name}` : `Pokaż ${reference.name}`} onClick={() => onToggleReference(reference.id)}>{reference.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
        </div>
      ))}

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

function TopologyReferenceRepairPanel({ items, selection, onReassign }) {
  if (!items.length) return null;
  const selectedItem = selection?.items?.at(-1) || selection;
  return (
    <aside className="reference-repair-panel" role="alert" aria-label="Naprawa utraconych referencji">
      <header><AlertTriangle size={16} /><div><strong>Utracona referencja</strong><span>{items.length === 1 ? '1 element wymaga przypisania' : `${items.length} elementy wymagają przypisania`}</span></div></header>
      {items.slice(0, 3).map((item) => {
        const canUseSelection = selectedItem && selectedItem.kind === item.reference.topologyKind && selectedItem.id;
        return (
          <section key={item.reference.id}>
            <strong>{item.ownerFeature?.name || item.reference.label || 'Operacja zależna'}</strong>
            <span>Źródło: {item.sourceFeature?.name || item.reference.sourceFeatureId || 'nieznane'}</span>
            <small>{item.reason}</small>
            <div>
              <button type="button" disabled={!canUseSelection} onClick={() => onReassign(item.reference.id, selectedItem)}>Przypisz zaznaczenie</button>
              {item.candidates.slice(0, 2).map((candidate, index) => (
                <button className="secondary" key={candidate.id} type="button" onClick={() => onReassign(item.reference.id, candidate, candidate.descriptor)}>{`Kandydat ${index + 1}`}</button>
              ))}
            </div>
          </section>
        );
      })}
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

const MEASURE_NUMBER = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 4 });

function measureValue(value, unit = '') {
  return `${MEASURE_NUMBER.format(value)}${unit ? ` ${unit}` : ''}`;
}

function measureVector(vector, unit = 'mm') {
  return vector?.map((value) => MEASURE_NUMBER.format(value)).join('; ') + (unit ? ` ${unit}` : '');
}

function MeasurePanel({ measurement, onClose }) {
  const rows = [];
  if (measurement?.length !== undefined) rows.push(['Długość', measureValue(measurement.length, 'mm')]);
  if (measurement?.distance !== undefined) rows.push(['Odległość', measureValue(measurement.distance, 'mm')]);
  if (measurement?.angle !== null && measurement?.angle !== undefined) rows.push(['Kąt', measureValue(measurement.angle, '°')]);
  if (measurement?.radius !== undefined) rows.push(['Promień', measureValue(measurement.radius, 'mm')]);
  if (measurement?.diameter !== undefined) rows.push(['Średnica', measureValue(measurement.diameter, 'mm')]);
  if (measurement?.area !== undefined) rows.push(['Pole', measureValue(measurement.area, 'mm²')]);
  if (measurement?.volume !== undefined) rows.push(['Objętość', measureValue(measurement.volume, 'mm³')]);
  if (measurement?.position) rows.push(['Pozycja X; Y; Z', measureVector(measurement.position)]);
  if (measurement?.delta) rows.push(['ΔX; ΔY; ΔZ', measureVector(measurement.delta)]);
  if (measurement?.dimensions) rows.push(['Gabaryt X; Y; Z', measureVector(measurement.dimensions)]);
  return (
    <aside className="measure-panel" aria-label="Wynik pomiaru">
      <header><div><Ruler size={16} /><strong>Measure</strong></div><button type="button" title="Zamknij pomiar" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        {!measurement?.selectionCount && <p>Zaznacz bryłę, ścianę, krawędź lub wierzchołek. Ctrl/Shift wybiera drugi element.</p>}
        {rows.map(([label, value]) => <div className="measure-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
    </aside>
  );
}

function SectionPanel({ analysis, onChange, onClose }) {
  return (
    <aside className="measure-panel section-panel" aria-label="Section Analysis">
      <header><div><ScanSearch size={16} /><strong>Section Analysis</strong></div><button type="button" title="Zamknij przekrój" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        <label className="command-field"><span>Płaszczyzna</span><select value={analysis.plane} onChange={(event) => onChange({ plane: event.target.value })}><option value="XY">XY</option><option value="XZ">XZ</option><option value="YZ">YZ</option></select></label>
        <Field label="Przesunięcie" value={analysis.offset} onChange={(offset) => onChange({ offset })} suffix="mm" />
        <label className="section-toggle"><input type="checkbox" checked={analysis.flip} onChange={(event) => onChange({ flip: event.target.checked })} /><span>Odwróć stronę przekroju</span></label>
        <p>Widok jest przycinany wyłącznie analitycznie. Historia i geometria projektu pozostają bez zmian.</p>
      </div>
    </aside>
  );
}

function MassPropertiesPanel({ density, result, error, onDensityChange, onClose }) {
  return (
    <aside className="measure-panel mass-properties-panel" aria-label="Właściwości masowe">
      <header><div><Box size={16} /><strong>Właściwości masowe</strong></div><button type="button" title="Zamknij właściwości masowe" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        <Field label="Gęstość" value={density} onChange={onDensityChange} suffix="g/cm³" />
        {error && <p className="measure-error">{error}</p>}
        {result && <>
          <div className="measure-row"><span>Bryły</span><strong>{result.bodyCount}</strong></div>
          <div className="measure-row"><span>Objętość</span><strong>{measureValue(result.volume, 'mm³')}</strong></div>
          <div className="measure-row"><span>Pole</span><strong>{measureValue(result.area, 'mm²')}</strong></div>
          <div className="measure-row"><span>Masa</span><strong>{measureValue(result.mass, 'g')}</strong></div>
          <div className="measure-row"><span>Środek masy</span><strong>{measureVector(result.centerOfMass)}</strong></div>
        </>}
      </div>
    </aside>
  );
}

function GeometryInspectionPanel({ result, onClose }) {
  return (
    <aside className="measure-panel geometry-inspection-panel" aria-label="Analiza geometrii">
      <header><div><ScanSearch size={16} /><strong>Analiza geometrii</strong></div><button type="button" title="Zamknij analizę geometrii" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        <div className="measure-row"><span>Bryły</span><strong>{result.bodyCount}</strong></div>
        <div className="measure-row"><span>Min. promień</span><strong>{result.minimumRadius === null ? 'Brak powierzchni krzywoliniowych' : measureValue(result.minimumRadius, 'mm')}</strong></div>
        <div className="measure-row"><span>Kolizje</span><strong>{result.collisions.length}</strong></div>
        {result.collisions.map((collision) => <div className="collision-row" key={`${collision.firstBodyId}:${collision.secondBodyId}`}><span>{collision.firstBodyId} ↔ {collision.secondBodyId}</span><strong>{measureValue(collision.volume, 'mm³')}</strong></div>)}
        {!result.collisions.length && <p>Nie wykryto wspólnej objętości pomiędzy bryłami.</p>}
      </div>
    </aside>
  );
}

const IMPORT_UNIT_OPTIONS = [
  ['auto', 'Automatycznie / z pliku'],
  ['millimeter', 'Milimetry (mm)'],
  ['centimeter', 'Centymetry (cm)'],
  ['inch', 'Cale (in)'],
  ['meter', 'Metry (m)'],
  ['micron', 'Mikrometry (µm)'],
];

function ImportModelDialog({ draft, onChange, onConfirm, onCancel }) {
  if (!draft) return null;
  return (
    <section className="command-dialog import-model-dialog" aria-label="Import modelu 3D">
      <header><strong>Import modelu 3D</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        <Field label="Plik" value={draft.fileName} disabled />
        <Field label="Format" value={draft.originalFormat.toUpperCase()} disabled />
        <label className="command-field"><span>Jednostka źródłowa</span><select value={draft.sourceUnit} onChange={(event) => onChange({ sourceUnit: event.target.value })}>{IMPORT_UNIT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="command-preview-note"><span className="preview-dot" />Model zostanie przeliczony do milimetrów. STEP zachowuje dokładną geometrię; STL i 3MF są importowane jako siatka.</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> Importuj</button></footer>
    </section>
  );
}

function ImportSketchDialog({ draft, onChange, onConfirm, onCancel }) {
  if (!draft) return null;
  return (
    <section className="command-dialog import-sketch-dialog" aria-label="Import SVG lub DXF do szkicu">
      <header><strong>Import geometrii szkicu</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        <Field label="Plik" value={draft.fileName} disabled />
        <Field label="Format" value={draft.format.toUpperCase()} disabled />
        <Field label="Wykryta jednostka" value={IMPORT_UNIT_OPTIONS.find(([value]) => value === draft.detectedUnit)?.[1] || draft.detectedUnit} disabled />
        <label className="command-field"><span>Jednostka źródłowa</span><select value={draft.sourceUnit} onChange={(event) => onChange({ sourceUnit: event.target.value })}>{IMPORT_UNIT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="command-preview-note"><span className="preview-dot" />Linie, polilinie, prostokąty, okręgi i łuki zostaną dodane do aktywnego szkicu w milimetrach. Zamknięte pętle utworzą profile.</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> Importuj do szkicu</button></footer>
    </section>
  );
}

function CommandDialog({ command, profileName, onChange, onConfirm, onCancel, onUndoSegment, onFinishPath }) {
  if (!command || command.type === 'plane' || command.type === 'parameters' || command.type === 'measure' || command.type === 'sectionAnalysis' || command.type === 'massProperties' || command.type === 'geometryInspection' || ['trimSketch', 'extendSketch', 'breakSketch', 'projectSketch'].includes(command.type)) return null;
  const isRectangle = command.type === 'rectangle';
  const isCircle = command.type === 'circle';
  const isArc = command.type === 'arc';
  const isPolygon = command.type === 'polygon';
  const isEllipse = command.type === 'ellipse';
  const isSlot = command.type === 'slot';
  const isSpline = command.type === 'spline';
  const isConic = command.type === 'conic';
  const isPoint = command.type === 'point';
  const isMechanicalShape = isRectangle || isCircle || isArc || isPolygon || isEllipse || isSlot || isSpline || isConic;
  const isExtrude = command.type === 'extrude';
  const isBoolean = command.type === 'boolean';
  const isPrimitive = command.type === 'primitive';
  const isTransform = command.type === 'transform';
  const isOffsetFace = command.type === 'offsetFace';
  const isTextSolid = command.type === 'textSolid';
  const isHole = command.type === 'hole';
  const isFillet = command.type === 'fillet';
  const isShell = command.type === 'shell';
  const isSketchPath = command.type === 'line' || command.type === 'polyline';
  const isSketchMove = command.type === 'moveSketch';
  const isSketchOffset = command.type === 'offsetSketch';
  const isSketchCorner = command.type === 'cornerSketch';
  const isSketchTransform = command.type === 'transformSketch';
  const isOffsetPlane = command.type === 'offsetPlane';
  const isMidplane = command.type === 'midplanePlane';
  const isThreePointPlane = command.type === 'threePointPlane';
  const isConstructionPlane = isOffsetPlane || isMidplane || isThreePointPlane;
  const isConstructionAxis = command.type === 'constructionAxis';
  const axisTitles = { edge: 'Oś z krawędzi', cylinder: 'Oś walca', 'two-points': 'Oś przez dwa punkty', 'plane-intersection': 'Oś przecięcia płaszczyzn' };
  const isConstructionPoint = command.type === 'constructionPoint';
  const pointTitles = { vertex: 'Punkt na wierzchołku', center: 'Punkt środka', intersection: 'Punkt przecięcia' };
  const title = isRectangle ? 'Prostokąt' : isCircle ? 'Okrąg' : isArc ? 'Łuk' : isPolygon ? 'Wielokąt regularny' : isEllipse ? 'Elipsa' : isSlot ? 'Slot' : isSpline ? 'Spline' : isConic ? 'Krzywa conic' : isPoint ? 'Punkt szkicu' : isExtrude ? 'Wyciągnięcie' : isBoolean ? 'Boolean' : isPrimitive ? 'Prymityw 3D' : isTransform ? (command.mode === 'rotate' ? 'Obróć bryłę' : 'Przesuń bryłę') : isOffsetFace ? 'Offset Face' : isTextSolid ? 'Tekst 3D' : isHole ? 'Otwór' : isFillet ? 'Zaokrąglenie' : isShell ? 'Shell' : command.type === 'line' ? 'Linia' : command.type === 'polyline' ? 'Polilinia' : isSketchMove ? 'Przesuń geometrię' : isSketchOffset ? 'Offset szkicu' : isSketchCorner ? (command.mode === 'fillet' ? 'Fillet szkicu' : 'Chamfer szkicu') : isSketchTransform ? 'Transformuj szkic' : isOffsetPlane ? 'Płaszczyzna odsunięta' : isMidplane ? 'Płaszczyzna środkowa' : isThreePointPlane ? 'Płaszczyzna przez trzy punkty' : isConstructionAxis ? axisTitles[command.axisType] : isConstructionPoint ? pointTitles[command.pointType] : 'Fazowanie';
  return (
    <section className="command-dialog" aria-label={title}>
      <header><strong>{title}</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        {isMechanicalShape && <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} />}
        {(isRectangle || isCircle || isArc || isPolygon || isEllipse || isSlot || isSpline) && (
          <label className="command-field">
            <span>Metoda</span>
            <select value={command.definition} onChange={(event) => onChange({ definition: event.target.value })} disabled={Boolean(command.editId)}>
              {isRectangle && <><option value="center">Środek i wymiary</option><option value="twoPoints">Dwa narożniki</option><option value="threePoints">Trzy punkty</option></>}
              {isCircle && <><option value="centerRadius">Środek i średnica</option><option value="twoPoints">Dwa punkty średnicy</option><option value="threePoints">Trzy punkty</option></>}
              {isArc && <><option value="threePoints">Trzy punkty</option><option value="centerStartEnd">Środek, początek, koniec</option></>}
              {isPolygon && <><option value="inscribed">Wpisany</option><option value="circumscribed">Opisany</option><option value="edge">Z krawędzi</option></>}
              {isEllipse && <><option value="full">Pełna elipsa</option><option value="arc">Łuk eliptyczny</option></>}
              {isSlot && <><option value="centerToCenter">Środek–środek</option><option value="overall">Długość całkowita</option><option value="threePoints">Trzy punkty</option><option value="arc">Po łuku</option></>}
              {isSpline && <><option value="fit">Punkty dopasowania</option><option value="control">Punkty kontrolne</option></>}
            </select>
          </label>
        )}
        {isRectangle && (
          <>
            {command.definition === 'center' ? <><Field label="Szerokość" value={command.width} onChange={(width) => onChange({ width })} suffix="mm" autoFocus /><Field label="Wysokość" value={command.height} onChange={(height) => onChange({ height })} suffix="mm" /><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Obrót" value={command.rotation} onChange={(rotation) => onChange({ rotation })} suffix="°" /></> : <><Field label="Punkt 1 X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Punkt 1 Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Punkt 2 X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Punkt 2 Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" />{command.definition === 'threePoints' && <><Field label="Punkt 3 X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Punkt 3 Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" /></>}</>}
          </>
        )}
        {isCircle && (
          <>
            {command.definition === 'centerRadius' ? <><Field label="Średnica" value={command.diameter} onChange={(diameter) => onChange({ diameter })} suffix="mm" autoFocus /><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /></> : <><Field label="Punkt 1 X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Punkt 1 Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Punkt 2 X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Punkt 2 Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" />{command.definition === 'threePoints' && <><Field label="Punkt 3 X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Punkt 3 Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" /></>}</>}
          </>
        )}
        {isArc && <><Field label={command.definition === 'centerStartEnd' ? 'Środek X' : 'Początek X'} value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label={command.definition === 'centerStartEnd' ? 'Środek Y' : 'Początek Y'} value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label={command.definition === 'centerStartEnd' ? 'Początek X' : 'Punkt łuku X'} value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label={command.definition === 'centerStartEnd' ? 'Początek Y' : 'Punkt łuku Y'} value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" /><Field label="Koniec X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Koniec Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" />{command.definition === 'centerStartEnd' && <label className="command-field"><span>Kierunek</span><select value={command.direction} onChange={(event) => onChange({ direction: event.target.value })}><option value="ccw">Przeciwnie do wskazówek</option><option value="cw">Zgodnie ze wskazówkami</option></select></label>}</>}
        {isPolygon && <>{command.definition === 'edge' ? <><Field label="Krawędź P1 X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Krawędź P1 Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Krawędź P2 X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Krawędź P2 Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" /></> : <><Field label="Promień" value={command.radius} onChange={(radius) => onChange({ radius })} suffix="mm" autoFocus /><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Obrót" value={command.rotation} onChange={(rotation) => onChange({ rotation })} suffix="°" /></>}<Field label="Liczba boków" value={command.sides} onChange={(sides) => onChange({ sides })} /></>}
        {isEllipse && <><Field label="Promień główny" value={command.majorRadius} onChange={(majorRadius) => onChange({ majorRadius })} suffix="mm" autoFocus /><Field label="Promień boczny" value={command.minorRadius} onChange={(minorRadius) => onChange({ minorRadius })} suffix="mm" /><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Obrót" value={command.rotation} onChange={(rotation) => onChange({ rotation })} suffix="°" />{command.definition === 'arc' && <><Field label="Kąt początku" value={command.startAngle} onChange={(startAngle) => onChange({ startAngle })} suffix="°" /><Field label="Kąt końca" value={command.endAngle} onChange={(endAngle) => onChange({ endAngle })} suffix="°" /><label className="command-field"><span>Kierunek</span><select value={command.direction} onChange={(event) => onChange({ direction: event.target.value })}><option value="ccw">Przeciwnie do wskazówek</option><option value="cw">Zgodnie ze wskazówkami</option></select></label></>}</>}
        {isSlot && <>{command.definition === 'arc' ? <><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" autoFocus /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Promień osi" value={command.radius} onChange={(radius) => onChange({ radius })} suffix="mm" /><Field label="Kąt początku" value={command.startAngle} onChange={(startAngle) => onChange({ startAngle })} suffix="°" /><Field label="Kąt końca" value={command.endAngle} onChange={(endAngle) => onChange({ endAngle })} suffix="°" /><label className="command-field"><span>Kierunek</span><select value={command.direction} onChange={(event) => onChange({ direction: event.target.value })}><option value="ccw">Przeciwnie do wskazówek</option><option value="cw">Zgodnie ze wskazówkami</option></select></label></> : <><Field label="Punkt 1 X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Punkt 1 Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Punkt 2 X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Punkt 2 Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" />{command.definition === 'threePoints' && <><Field label="Punkt szerokości X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Punkt szerokości Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" /></>}</>}{command.definition !== 'threePoints' && <Field label="Szerokość" value={command.width} onChange={(width) => onChange({ width })} suffix="mm" />}</>}
        {isSpline && <Field label="Punkty X,Y" value={command.pointsText} onChange={(pointsText) => onChange({ pointsText })} autoFocus />}
        {isConic && <><Field label="Początek X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Początek Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Kontrola X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Kontrola Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" /><Field label="Koniec X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Koniec Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" /><Field label="Rho" value={command.rho} onChange={(rho) => onChange({ rho })} /><label className="command-field"><span>Ciągłość</span><select value={command.continuity} onChange={(event) => onChange({ continuity: event.target.value })}><option value="free">Swobodna (G0)</option><option value="tangent">Styczna (G1)</option><option value="curvature">Krzywizna (G2)</option></select></label></>}
        {isPoint && <><Field label="X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" autoFocus /><Field label="Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><label className="command-field"><span>Rola</span><select value={command.role} onChange={(event) => onChange({ role: event.target.value })}><option value="standard">Referencja otworu</option><option value="construction">Konstrukcyjny</option></select></label></>}
        {(isExtrude || (isHole && command.placement !== 'face-edges')) && <Field label="Profil" value={profileName} disabled />}
        {isExtrude && (
          <>
            {command.extent !== 'through-all' && <Field label={command.extent === 'symmetric' ? 'Długość całkowita' : 'Odległość'} value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus />}
            {command.extent === 'two-sides' && <Field label="Druga strona" value={command.secondDistance} onChange={(secondDistance) => onChange({ secondDistance })} suffix="mm" />}
            <label className="command-field">
              <span>Operacja</span>
              <select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}>
                <option value="new">Nowa bryła</option>
                <option value="join">Połącz</option>
                <option value="cut">Wytnij</option>
                <option value="intersect">Część wspólna</option>
              </select>
            </label>
            <label className="command-field"><span>Kierunek</span><select value={command.extent} onChange={(event) => onChange({ extent: event.target.value })}><option value="one-side">Jedna strona</option><option value="two-sides">Dwie strony</option><option value="symmetric">Symetrycznie</option><option value="through-all" disabled={!['cut', 'intersect'].includes(command.operation)}>Through All</option></select></label>
          </>
        )}
        {isBoolean && (
          <>
            <Field label="Bryła bazowa" value={command.targetName || command.targetBodyId} disabled />
            <Field label="Bryła narzędziowa" value={command.toolName || command.toolBodyId} disabled />
            <label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="union">Union</option><option value="subtract">Subtract</option><option value="intersect">Intersect</option></select></label>
          </>
        )}
        {isPrimitive && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} />
            <label className="command-field"><span>Typ</span><select value={command.primitiveType} onChange={(event) => onChange({ primitiveType: event.target.value })}><option value="box">Box</option><option value="cylinder">Cylinder</option><option value="sphere">Sphere</option><option value="torus">Torus</option></select></label>
            {command.primitiveType === 'box' && <><Field label="Szerokość" value={command.width} onChange={(width) => onChange({ width })} suffix="mm" autoFocus /><Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" /><Field label="Wysokość" value={command.height} onChange={(height) => onChange({ height })} suffix="mm" /></>}
            {command.primitiveType === 'cylinder' && <><Field label="Promień" value={command.radius} onChange={(radius) => onChange({ radius })} suffix="mm" autoFocus /><Field label="Wysokość" value={command.height} onChange={(height) => onChange({ height })} suffix="mm" /></>}
            {command.primitiveType === 'sphere' && <Field label="Promień" value={command.radius} onChange={(radius) => onChange({ radius })} suffix="mm" autoFocus />}
            {command.primitiveType === 'torus' && <><Field label="Promień główny" value={command.majorRadius} onChange={(majorRadius) => onChange({ majorRadius })} suffix="mm" autoFocus /><Field label="Promień przekroju" value={command.minorRadius} onChange={(minorRadius) => onChange({ minorRadius })} suffix="mm" /></>}
            <Field label="Położenie X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" />
            <Field label="Położenie Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" />
            <Field label="Położenie Z" value={command.z} onChange={(z) => onChange({ z })} suffix="mm" />
          </>
        )}
        {isTransform && (command.mode === 'move' ? <><Field label="Przesunięcie X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" autoFocus /><Field label="Przesunięcie Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Przesunięcie Z" value={command.z} onChange={(z) => onChange({ z })} suffix="mm" /></> : <><Field label="Kąt Z" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" autoFocus /><Field label="Środek X" value={command.originX} onChange={(originX) => onChange({ originX })} suffix="mm" /><Field label="Środek Y" value={command.originY} onChange={(originY) => onChange({ originY })} suffix="mm" /><Field label="Środek Z" value={command.originZ} onChange={(originZ) => onChange({ originZ })} suffix="mm" /></>)}
        {isOffsetFace && <><Field label="Ściana" value={command.faceLabel || '1 wskazana'} disabled /><Field label="Odległość" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus /></>}
        {isTextSolid && <><Field label="Tekst" value={command.text} onChange={(text) => onChange({ text })} autoFocus /><Field label="Rozmiar" value={command.fontSize} onChange={(fontSize) => onChange({ fontSize })} suffix="mm" /><Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" /><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="emboss" disabled={!command.targetBodyId}>Emboss — wypukły</option><option value="deboss" disabled={!command.targetBodyId}>Deboss — wklęsły</option></select></label><Field label="Położenie X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Położenie Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label={command.operation === 'new' ? 'Położenie Z' : 'Powierzchnia Z'} value={command.z} onChange={(z) => onChange({ z })} suffix="mm" /></>}
        {isHole && (
          <>
            {command.placement === 'face-edges' && <><Field label="Pozycjonowanie" value="Ściana + 2 krawędzie" disabled /><Field label="Od krawędzi 1" value={command.firstOffset} onChange={(firstOffset) => onChange({ firstOffset })} suffix="mm" autoFocus /><Field label="Od krawędzi 2" value={command.secondOffset} onChange={(secondOffset) => onChange({ secondOffset })} suffix="mm" /></>}
            <label className="command-field"><span>Typ otworu</span><select value={command.holeType} onChange={(event) => onChange({ holeType: event.target.value })}><option value="simple">Prosty</option><option value="counterbore">Counterbore</option><option value="countersink">Countersink</option></select></label>
            <Field label="Średnica" value={command.diameter} onChange={(diameter) => onChange({ diameter })} suffix="mm" autoFocus />
            <label className="command-field"><span>Zakres</span><select value={command.extent} onChange={(event) => onChange({ extent: event.target.value })}><option value="distance">Distance</option><option value="through-all">Through All</option></select></label>
            {command.extent === 'distance' && <Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" />}
            {command.holeType === 'counterbore' && <><Field label="Średnica Counterbore" value={command.counterboreDiameter} onChange={(counterboreDiameter) => onChange({ counterboreDiameter })} suffix="mm" /><Field label="Głębokość Counterbore" value={command.counterboreDepth} onChange={(counterboreDepth) => onChange({ counterboreDepth })} suffix="mm" /></>}
            {command.holeType === 'countersink' && <><Field label="Średnica Countersink" value={command.countersinkDiameter} onChange={(countersinkDiameter) => onChange({ countersinkDiameter })} suffix="mm" /><Field label="Kąt Countersink" value={command.countersinkAngle} onChange={(countersinkAngle) => onChange({ countersinkAngle })} suffix="°" /></>}
            <label className="command-field"><span>Gwint</span><select value={command.threadMode} onChange={(event) => onChange({ threadMode: event.target.value })}><option value="none">Brak</option><option value="cosmetic">Kosmetyczny</option><option value="modeled">Modelowany</option></select></label>
            {command.threadMode !== 'none' && <><Field label="Średnica gwintu" value={command.threadDiameter} onChange={(threadDiameter) => onChange({ threadDiameter })} suffix="mm" /><Field label="Skok gwintu" value={command.threadPitch} onChange={(threadPitch) => onChange({ threadPitch })} suffix="mm" /><Field label="Długość gwintu" value={command.threadLength} onChange={(threadLength) => onChange({ threadLength })} suffix="mm" /><label className="command-field"><span>Kierunek gwintu</span><select value={command.threadDirection} onChange={(event) => onChange({ threadDirection: event.target.value })}><option value="right">Prawy</option><option value="left">Lewy</option></select></label></>}
            <label className="command-field"><span>Profil luzu</span><select value={command.clearanceProfile} onChange={(event) => onChange({ clearanceProfile: event.target.value })}><option value="nominal">Nominalny</option><option value="fff">FFF</option></select></label>
            {command.clearanceProfile === 'fff' && <Field label="Luz promieniowy FFF" value={command.clearance} onChange={(clearance) => onChange({ clearance })} suffix="mm" />}
          </>
        )}
        {(isFillet || command.type === 'chamfer') && (
          <Field label={isFillet ? 'Promień' : 'Odległość'} value={command.size} onChange={(size) => onChange({ size })} suffix="mm" autoFocus />
        )}
        {isShell && <><Field label="Usuwane ściany" value={`${command.faceCount || 0}`} disabled /><Field label="Grubość" value={command.thickness} onChange={(thickness) => onChange({ thickness })} suffix="mm" autoFocus /></>}
        {isConstructionPlane && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} autoFocus />
            {!isThreePointPlane && <label className="command-field"><span>Płaszczyzna bazowa</span><select value={command.basePlane} onChange={(event) => onChange({ basePlane: event.target.value })}><option value="XY">Góra (XY)</option><option value="XZ">Przód (XZ)</option><option value="YZ">Prawo (YZ)</option></select></label>}
            {isOffsetPlane && <Field label="Odległość" value={command.offset} onChange={(offset) => onChange({ offset })} suffix="mm" />}
            {isMidplane && <><Field label="Położenie A" value={command.firstOffset} onChange={(firstOffset) => onChange({ firstOffset })} suffix="mm" /><Field label="Położenie B" value={command.secondOffset} onChange={(secondOffset) => onChange({ secondOffset })} suffix="mm" /></>}
            {isThreePointPlane && <>{[1, 2, 3].map((index) => <React.Fragment key={index}><Field label={`Punkt ${index} X`} value={command[`x${index}`]} onChange={(value) => onChange({ [`x${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Y`} value={command[`y${index}`]} onChange={(value) => onChange({ [`y${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Z`} value={command[`z${index}`]} onChange={(value) => onChange({ [`z${index}`]: value })} suffix="mm" /></React.Fragment>)}</>}
            <label className="command-field"><span>Widoczna</span><select value={command.visible ? 'yes' : 'no'} onChange={(event) => onChange({ visible: event.target.value === 'yes' })}><option value="yes">Tak</option><option value="no">Nie</option></select></label>
          </>
        )}
        {isConstructionAxis && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} autoFocus />
            {['edge', 'two-points'].includes(command.axisType) && <>{[1, 2].map((index) => <React.Fragment key={index}><Field label={`Punkt ${index} X`} value={command[`x${index}`]} onChange={(value) => onChange({ [`x${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Y`} value={command[`y${index}`]} onChange={(value) => onChange({ [`y${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Z`} value={command[`z${index}`]} onChange={(value) => onChange({ [`z${index}`]: value })} suffix="mm" /></React.Fragment>)}</>}
            {command.axisType === 'cylinder' && <>{['X', 'Y', 'Z'].map((axis, index) => <Field key={`origin-${axis}`} label={`Środek ${axis}`} value={command[`origin${index}`]} onChange={(value) => onChange({ [`origin${index}`]: value })} suffix="mm" />)}{['X', 'Y', 'Z'].map((axis, index) => <Field key={`direction-${axis}`} label={`Kierunek ${axis}`} value={command[`direction${index}`]} onChange={(value) => onChange({ [`direction${index}`]: value })} />)}</>}
            {command.axisType === 'plane-intersection' && <><label className="command-field"><span>Płaszczyzna A</span><select value={command.planeId1} onChange={(event) => onChange({ planeId1: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label><label className="command-field"><span>Płaszczyzna B</span><select value={command.planeId2} onChange={(event) => onChange({ planeId2: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></>}
            <label className="command-field"><span>Widoczna</span><select value={command.visible ? 'yes' : 'no'} onChange={(event) => onChange({ visible: event.target.value === 'yes' })}><option value="yes">Tak</option><option value="no">Nie</option></select></label>
          </>
        )}
        {isConstructionPoint && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} autoFocus />
            {['vertex', 'center'].includes(command.pointType) && <>{['X', 'Y', 'Z'].map((axis, index) => <Field key={axis} label={axis} value={command[`position${index}`]} onChange={(value) => onChange({ [`position${index}`]: value })} suffix="mm" />)}</>}
            {command.pointType === 'intersection' && <><label className="command-field"><span>Oś</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><label className="command-field"><span>Płaszczyzna</span><select value={command.planeId} onChange={(event) => onChange({ planeId: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></>}
            <label className="command-field"><span>Widoczny</span><select value={command.visible ? 'yes' : 'no'} onChange={(event) => onChange({ visible: event.target.value === 'yes' })}><option value="yes">Tak</option><option value="no">Nie</option></select></label>
          </>
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
        {isSketchMove && (
          <>
            <Field label="Przesunięcie X" value={command.dx} onChange={(dx) => onChange({ dx })} suffix="mm" autoFocus />
            <Field label="Przesunięcie Y" value={command.dy} onChange={(dy) => onChange({ dy })} suffix="mm" />
          </>
        )}
        {isSketchOffset && (
          <>
            <Field label="Odległość" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus />
            <p className="command-hint">Wartość dodatnia przesuwa w lewo od kierunku krzywej, ujemna — na drugą stronę.</p>
          </>
        )}
        {isSketchCorner && <Field label={command.mode === 'fillet' ? 'Promień' : 'Odległość'} value={command.size} onChange={(size) => onChange({ size })} suffix="mm" autoFocus />}
        {isSketchTransform && (
          <>
            <label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="rotate">Rotate</option><option value="copy">Copy</option><option value="mirror">Mirror</option><option value="scale">Scale</option></select></label>
            {command.operation === 'copy' ? <><Field label="Kopia ΔX" value={command.dx} onChange={(dx) => onChange({ dx })} suffix="mm" autoFocus /><Field label="Kopia ΔY" value={command.dy} onChange={(dy) => onChange({ dy })} suffix="mm" /></> : command.operation === 'mirror' ? <><label className="command-field"><span>Oś odbicia</span><select value={command.axis} onChange={(event) => onChange({ axis: event.target.value })}><option value="vertical">Pionowa X</option><option value="horizontal">Pozioma Y</option></select></label><Field label="Położenie osi" value={command.axisOffset} onChange={(axisOffset) => onChange({ axisOffset })} suffix="mm" autoFocus /></> : <><Field label="Środek X" value={command.centerX} onChange={(centerX) => onChange({ centerX })} suffix="mm" autoFocus /><Field label="Środek Y" value={command.centerY} onChange={(centerY) => onChange({ centerY })} suffix="mm" />{command.operation === 'rotate' ? <Field label="Kąt obrotu" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" /> : <Field label="Skala" value={command.factor} onChange={(factor) => onChange({ factor })} />}</>}
          </>
        )}
        <div className="command-preview-note"><span className="preview-dot" />{isSketchPath ? 'Klikaj punkty na płótnie lub dodaj następny punkt dokładną długością i kątem.' : isSketchMove ? 'Wpisz dokładne przesunięcie zaznaczenia w osiach szkicu.' : isSketchOffset ? 'Operacja powstanie dopiero po zatwierdzeniu; Anuluj nie zmienia szkicu.' : isSketchCorner ? 'Oryginalne linie zachowają ID; zerwane więzy zostaną jawnie usunięte.' : isSketchTransform ? 'Transformacja jest transakcyjna; Scale odrzuca geometrię z blokującym wymiarem.' : isConstructionPlane ? 'Współrzędne i odległości mogą być liczbami albo wyrażeniami z parametrów modelu.' : isPoint ? 'Punkt zwykły może wyznaczać oś otworu; konstrukcyjny służy tylko jako referencja.' : isMechanicalShape ? 'Wpisz dokładne dane konstrukcyjne; po zatwierdzeniu powstanie edytowalna geometria szkicu.' : isExtrude ? 'Przeciągnij niebieską strzałkę na modelu albo wpisz dokładną odległość.' : 'Podgląd jest przeliczany na dokładnej bryle B-Rep.'}</div>
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
    ['projected', 'Geometria Project'],
    ['slice', 'Slice modelu'],
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
        <label className="sketch-snap-threshold">
          <span>Próg snap <output>{options.snapDistance}px</output></span>
          <input type="range" min="4" max="24" step="1" value={options.snapDistance} disabled={!options.snap} onChange={(event) => onChange('snapDistance', Number(event.target.value))} />
        </label>
        <div className="sketch-state-legend" aria-label="Legenda stanów geometrii szkicu">
          <h3>Stany geometrii</h3>
          <span><i className="under" /> Niedowiązana</span>
          <span><i className="fixed" /> W pełni związana</span>
          <span><i className="construction" /> Konstrukcyjna</span>
          <span><i className="projected" /> Rzutowana</span>
          <span><i className="selected" /> Zaznaczona</span>
          <span><i className="error" /> Błąd geometrii</span>
        </div>
      </div>
      <footer><button type="button" onClick={onFinish}>Zakończ szkic</button></footer>
    </aside>
  );
}

function PrintPanel({ document, bodies, engine, selectedFace, commit, onSelectIssue, onExport, onSendToSlicer, onClose, readOnly = false }) {
  const layoutResult = useMemo(() => calculatePrintLayout(bodies, document.print), [bodies, document.print]);
  const printAnalysis = useMemo(() => analyzePrintability(bodies, document.print), [bodies, document.print]);
  const bounds = layoutResult.dimensions;
  const fits = printAnalysis.fitsBed;
  const updateBed = (key, value) => commit((next) => { next.print[key] = Math.max(1, Number(value) || 1); next.print.profileId = 'custom'; });
  const updateLayout = (key, value) => commit((next) => {
    const parsed = Number(value);
    if (key === 'scale') next.print[key] = Math.max(0.01, Number.isFinite(parsed) ? parsed : 1);
    else if (key === 'copies') next.print[key] = Math.max(1, Math.min(100, Math.round(Number.isFinite(parsed) ? parsed : 1)));
    else if (key === 'copySpacing') next.print[key] = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
    else next.print[key] = Number.isFinite(parsed) ? parsed : 0;
  });
  const updateAnalysis = (key, value) => commit((next) => {
    const parsed = Number(value);
    next.print[key] = key === 'overhangAngle'
      ? Math.max(0, Math.min(89, Number.isFinite(parsed) ? parsed : 45))
      : Math.max(0.05, Number.isFinite(parsed) ? parsed : 0.4);
  });
  const selectProfile = (profileId) => commit((next) => { next.print = applyPrinterProfile(next.print, profileId); });
  const orientToSelectedFace = () => commit((next) => {
    const orientation = orientationForBedFace(selectedFace.normal);
    const candidate = {
      ...next.print,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      positionZ: 0,
      orientationAxis: orientation.axis,
      orientationAngle: orientation.angle,
    };
    const result = calculatePrintLayout(bodies, candidate);
    next.print = { ...candidate, positionZ: -result.min[2] };
  });
  const resetLayout = () => commit((next) => {
    Object.assign(next.print, {
      positionX: 0, positionY: 0, positionZ: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scale: 1, copies: 1, copySpacing: 10,
      orientationAxis: [0, 0, 1], orientationAngle: 0,
    });
  });
  return (
    <aside className="print-panel print-inspector">
      <header><div><strong>DRUK 3D</strong><span>Sprawdź model i wyeksportuj siatkę.</span></div><button type="button" onClick={onClose} title="Zamknij"><X size={16} /></button></header>
      <div className="print-section">
        <h3>Objętość robocza</h3>
        <label className="command-field"><span>Profil drukarki</span><select value={document.print.profileId || 'custom'} onChange={(event) => selectProfile(event.target.value)} disabled={readOnly}>{PRINTER_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}<option value="custom">Własny</option></select></label>
        <Field type="number" label="Szerokość X" value={document.print.bedWidth} suffix="mm" onChange={(value) => updateBed('bedWidth', value)} disabled={readOnly} />
        <Field type="number" label="Głębokość Y" value={document.print.bedDepth} suffix="mm" onChange={(value) => updateBed('bedDepth', value)} disabled={readOnly} />
        <Field type="number" label="Wysokość Z" value={document.print.bedHeight} suffix="mm" onChange={(value) => updateBed('bedHeight', value)} disabled={readOnly} />
      </div>
      <div className="print-section">
        <h3>Układ części</h3>
        <div className="print-field-grid">
          <Field type="number" label="Pozycja X" value={document.print.positionX ?? 0} suffix="mm" onChange={(value) => updateLayout('positionX', value)} disabled={readOnly} />
          <Field type="number" label="Pozycja Y" value={document.print.positionY ?? 0} suffix="mm" onChange={(value) => updateLayout('positionY', value)} disabled={readOnly} />
          <Field type="number" label="Pozycja Z" value={document.print.positionZ ?? 0} suffix="mm" onChange={(value) => updateLayout('positionZ', value)} disabled={readOnly} />
          <Field type="number" label="Obrót X" value={document.print.rotationX ?? 0} suffix="°" onChange={(value) => updateLayout('rotationX', value)} disabled={readOnly} />
          <Field type="number" label="Obrót Y" value={document.print.rotationY ?? 0} suffix="°" onChange={(value) => updateLayout('rotationY', value)} disabled={readOnly} />
          <Field type="number" label="Obrót Z" value={document.print.rotationZ ?? 0} suffix="°" onChange={(value) => updateLayout('rotationZ', value)} disabled={readOnly} />
          <Field type="number" label="Skala" value={document.print.scale ?? 1} suffix="×" onChange={(value) => updateLayout('scale', value)} disabled={readOnly} />
          <Field type="number" label="Kopie" value={document.print.copies ?? 1} suffix="szt." onChange={(value) => updateLayout('copies', value)} disabled={readOnly} />
          <Field type="number" label="Odstęp" value={document.print.copySpacing ?? 10} suffix="mm" onChange={(value) => updateLayout('copySpacing', value)} disabled={readOnly} />
        </div>
        <div className="print-layout-actions">
          <button type="button" disabled={readOnly || !selectedFace} onClick={orientToSelectedFace}>Połóż ścianą na stole</button>
          <button type="button" disabled={readOnly} onClick={resetLayout}>Resetuj układ</button>
        </div>
        <small>{selectedFace ? 'Zaznaczona płaska ściana jest gotowa do orientacji.' : 'Zaznacz płaską ścianę modelu, aby oprzeć ją na stole.'}</small>
      </div>
      <div className="print-section print-summary">
        <h3>Kontrola modelu</h3>
        <dl><div><dt>Bryły</dt><dd>{bodies.length}</dd></div><div><dt>Kopie</dt><dd>{layoutResult.layout.copies}</dd></div><div><dt>Rozmiar układu</dt><dd>{bounds.map((value) => value.toFixed(1)).join(' × ')} mm</dd></div></dl>
        <p className={fits ? 'check-ok' : 'check-warning'}>{!bodies.length ? 'Najpierw utwórz bryłę.' : fits ? 'Model mieści się na stole drukarki.' : 'Model przekracza obszar drukarki.'}</p>
      </div>
      <div className="print-section print-analysis-section">
        <h3>Analiza drukowalności</h3>
        <div className="print-field-grid">
          <Field type="number" label="Dysza" value={document.print.nozzleDiameter ?? 0.4} suffix="mm" onChange={(value) => updateAnalysis('nozzleDiameter', value)} disabled={readOnly} />
          <Field type="number" label="Min. ścianka" value={document.print.minimumWallThickness ?? 0.8} suffix="mm" onChange={(value) => updateAnalysis('minimumWallThickness', value)} disabled={readOnly} />
          <Field type="number" label="Min. otwór" value={document.print.minimumHoleDiameter ?? 2} suffix="mm" onChange={(value) => updateAnalysis('minimumHoleDiameter', value)} disabled={readOnly} />
          <Field type="number" label="Próg nawisu" value={document.print.overhangAngle ?? 45} suffix="°" onChange={(value) => updateAnalysis('overhangAngle', value)} disabled={readOnly} />
        </div>
        <div className="print-analysis-summary"><strong>{printAnalysis.errorCount} błędów · {printAnalysis.warningCount} ostrzeżeń</strong><span>Wynik opisuje ryzyko technologiczne, nie gwarantuje udanego wydruku.</span></div>
        <div className="print-issues">
          {printAnalysis.issues.map((issue, index) => <button type="button" className={issue.severity} key={`${issue.code}-${issue.bodyId || 'layout'}-${index}`} onClick={() => onSelectIssue(issue.selection)}><AlertTriangle size={13} /><span><strong>{issue.message}</strong><small>{issue.risk}</small></span></button>)}
          {bodies.length > 0 && !printAnalysis.issues.length && <p className="check-ok">Nie wykryto problemów przy bieżących progach analizy.</p>}
        </div>
      </div>
      <div className="print-actions">
        <button type="button" onClick={() => onExport('stl')} disabled={!bodies.length || engine.status !== 'ready'}><HardDriveDownload size={16} /> Eksportuj STL</button>
        <button className="secondary" type="button" onClick={() => onExport('step')} disabled={!bodies.length || engine.status !== 'ready'}>Eksportuj STEP</button>
        <button className="secondary" type="button" onClick={() => onExport('3mf')} disabled={!bodies.length || engine.status !== 'ready'}>Eksportuj 3MF</button>
        <label className="command-field slicer-field"><span>Program tnący</span><select value={document.print.slicer || 'bambu'} onChange={(event) => commit((next) => { next.print.slicer = event.target.value; })} disabled={readOnly}><option value="bambu">Bambu Studio</option><option value="prusa">PrusaSlicer</option><option value="cura">UltiMaker Cura</option></select></label>
        <button className="send-slicer" type="button" onClick={() => onSendToSlicer(document.print.slicer || 'bambu')} disabled={!bodies.length || engine.status !== 'ready'}><Printer size={16} /> Otwórz STL w slicerze</button>
      </div>
    </aside>
  );
}

function featureIcon(type, size = 16) {
  if (type === 'boolean') return <Shapes size={size} />;
  if (type === 'hole') return <Cylinder size={size} />;
  if (type === 'fillet') return <CircleDotDashed size={size} />;
  if (type === 'chamfer') return <Triangle size={size} />;
  if (type === 'shell') return <Layers3 size={size} />;
  if (type === 'primitive') return <Box size={size} />;
  if (type === 'transform') return <Move3d size={size} />;
  if (type === 'offsetFace') return <Layers3 size={size} />;
  if (type === 'textSolid') return <Type size={size} />;
  if (type === 'importedModel') return <Upload size={size} />;
  return <Box size={size} />;
}

export default function ModelingWorkspace({ onClose }) {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  useEffect(() => {
    const root = window.document.querySelector('.modeling-shell');
    const language = resolveModelingLanguage(window.document.documentElement.lang, window.desktopApp?.appLanguage);
    return observeModelingLocalization(root, language);
  }, []);
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
  const [sectionAnalysis, setSectionAnalysis] = useState(null);
  const [browserOpen, setBrowserOpen] = useState(true);
  const [sketchOptions, setSketchOptions] = useState({ grid: true, snap: true, snapDistance: 12, profiles: true, points: true, dimensions: true, constraints: true, construction: true, projected: true, slice: false, sketch3d: false });
  const [notice, setNotice] = useState(initialOpen.warning || 'Gotowe. Wybierz „Utwórz szkic”, aby rozpocząć modelowanie.');
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);
  const sketchImportInputRef = useRef(null);
  const [importDraft, setImportDraft] = useState(null);
  const [sketchImportDraft, setSketchImportDraft] = useState(null);
  const readOnly = documentAccess.readOnly;
  useEffect(() => {
    if (command?.type !== 'sectionAnalysis' && sectionAnalysis) setSectionAnalysis(null);
  }, [command?.type, sectionAnalysis]);
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
  const selectedProfileBoundaryEntity = selectedProfile?.entityIds?.length === 1
    ? selectedProfileMatch?.sketch.entities.find((entity) => entity.id === selectedProfile.entityIds[0])
    : null;
  const isCircularProfile = selectedProfile?.type === 'circle' || selectedProfileBoundaryEntity?.type === 'circle';
  const selectedCircleDiameter = selectedProfile?.geometry?.diameter
    || (selectedProfileBoundaryEntity?.type === 'circle'
      ? (Number.isFinite(Number(selectedProfileBoundaryEntity.geometry.radius)) ? String(Number(selectedProfileBoundaryEntity.geometry.radius) * 2) : `(${selectedProfileBoundaryEntity.geometry.radius}) * 2`)
      : '10');
  const selectedSketchPointMatch = selection?.kind === 'sketchPoint'
    ? document.sketches.map((sketch) => {
      const point = sketch.entities.find((entity) => entity.id === selection.id && entity.type === 'point');
      const isIndependent = point && !sketch.entities.some((entity) => entity.id !== point.id && entity.pointIds?.includes(point.id));
      return { sketch, point: isIndependent ? point : null };
    }).find((entry) => entry.point)
    : null;
  const hasHoleReference = isCircularProfile || Boolean(selectedSketchPointMatch);
  const selectedSketchEntityIds = selection?.kind === 'sketchEntities' && selection.sketchId === activeSketchId
    ? selection.ids
    : [];
  const selectedSketchConstraintId = selection?.kind === 'sketchConstraint' && selection.sketchId === activeSketchId
    ? selection.id
    : null;
  const selectedSketchEntities = (document.sketches.find((item) => item.id === activeSketchId)?.entities || [])
    .filter((entity) => selectedSketchEntityIds.includes(entity.id));
  const canAddCollinear = selectedSketchEntities.length === 2 && selectedSketchEntities.every((entity) => entity.type === 'line');
  const canAddSymmetry = selectedSketchEntities.filter((entity) => entity.type === 'point').length === 2
    && selectedSketchEntities.filter((entity) => entity.type === 'line').length === 1
    && selectedSketchEntities.length === 3;
  const selectedTopologyIds = useMemo(() => (
    selection?.items || (['face', 'edge', 'vertex'].includes(selection?.kind) ? [selection] : [])
  ).filter((item) => ['face', 'edge', 'vertex'].includes(item.kind)).map((item) => item.id), [selection]);
  const selectedBodyIds = useMemo(() => (
    selection?.items || (selection?.kind === 'body' ? [selection] : [])
  ).filter((item) => item.kind === 'body').map((item) => item.id), [selection]);
  const selectedEdgeItems = useMemo(() => (
    selection?.items || (selection?.kind === 'edge' ? [selection] : [])
  ).filter((item) => item.kind === 'edge' && item.bodyId), [selection]);
  const selectedFaceItems = useMemo(() => (
    selection?.items || (selection?.kind === 'face' ? [selection] : [])
  ).filter((item) => item.kind === 'face' && item.bodyId), [selection]);
  const hasFaceEdgeHoleReference = selectedFaceItems.length === 1
    && selectedEdgeItems.length === 2
    && selectedEdgeItems.every((item) => item.bodyId === selectedFaceItems[0].bodyId);
  const constructionPlanes = useMemo(() => resolveConstructionPlanes(document.references, document.parameters), [document.references, document.parameters]);
  const firstBodyId = `body-${document.features.find((feature) => feature.type === 'extrude' && feature.operation === 'new')?.id || ''}`;

  const previewDocument = useMemo(() => {
    if (!command?.previewFeature) return document;
    const next = cloneDocument(document);
    for (const reference of command.topologyReferences || []) {
      if (!next.references.some((item) => item.id === reference.id)) next.references.push({ ...reference, ownerFeatureId: command.previewFeature.id });
    }
    if (command.editId) {
      const index = next.features.findIndex((feature) => feature.id === command.editId);
      if (index >= 0) next.features[index] = command.previewFeature;
    } else {
      next.features.push(command.previewFeature);
    }
    return next;
  }, [document, command]);
  const engine = useCadEngine(previewDocument, { quality: command?.previewFeature ? 'preview' : 'display' });
  const measurement = useMemo(() => measureSelection(engine.bodies, selection), [engine.bodies, selection]);
  const massBodies = useMemo(() => {
    const ids = new Set((selection?.items || [selection]).map((item) => item?.bodyId || (item?.kind === 'body' ? item.id : null)).filter(Boolean));
    return ids.size ? engine.bodies.filter((body) => ids.has(body.id)) : engine.bodies;
  }, [engine.bodies, selection]);
  const massProperties = useMemo(() => {
    if (command?.type !== 'massProperties') return null;
    try {
      return { result: calculateMassProperties(massBodies, command.density), error: '' };
    } catch (error) {
      return { result: null, error: error.message };
    }
  }, [command?.type, command?.density, massBodies]);
  const geometryInspection = useMemo(() => summarizeGeometryInspection(engine.bodies, engine.analysis), [engine.bodies, engine.analysis]);
  const selectedPrintFace = useMemo(() => {
    if (selectedFaceItems.length !== 1) return null;
    const selected = selectedFaceItems[0];
    const descriptor = engine.bodies.find((body) => body.id === selected.bodyId)?.topology?.faces?.find((face) => face.id === selected.id)?.descriptor;
    return descriptor?.geometry === 'PLANE' && Array.isArray(descriptor.normal) ? descriptor : null;
  }, [engine.bodies, selectedFaceItems]);
  const constructionAxes = useMemo(() => resolveConstructionAxes(document.references, document.parameters, engine.bodies), [document.references, document.parameters, engine.bodies]);
  const constructionPoints = useMemo(() => resolveConstructionPoints(document.references, document.parameters, engine.bodies), [document.references, document.parameters, engine.bodies]);
  const actualBodyIds = useMemo(() => new Set(document.features.filter((feature) => (feature.type === 'extrude' && feature.operation === 'new') || feature.type === 'primitive' || feature.type === 'importedModel' || (feature.type === 'textSolid' && feature.operation === 'new')).map((feature) => `body-${feature.id}`)), [document.features]);
  const actualBodies = command?.previewFeature ? engine.bodies.filter((body) => actualBodyIds.has(body.id)) : engine.bodies;
  const targetBodyId = selection?.kind === 'body' ? selection.id : (selection?.bodyId || engine.bodies[0]?.id || firstBodyId || null);
  const topologyReferenceStates = useMemo(() => inspectTopologyReferences(document, actualBodies), [document, actualBodies]);
  const lostTopologyReferences = engine.status === 'ready' && !command?.previewFeature ? topologyReferenceStates.filter((item) => item.status === 'lost') : [];
  const lostReferenceOwnerIds = useMemo(() => new Set(lostTopologyReferences.map((item) => item.reference.ownerFeatureId).filter(Boolean)), [lostTopologyReferences]);
  const lostProjectedEntityIds = useMemo(() => {
    const lostIds = new Set(lostTopologyReferences.map((item) => item.reference.id));
    return document.sketches.flatMap((sketch) => sketch.entities
      .filter((entity) => entity.role === 'projected' && lostIds.has(entity.projectionReferenceId || entity.sourceReferenceId))
      .map((entity) => entity.id));
  }, [document.sketches, lostTopologyReferences]);

  useEffect(() => {
    if (readOnly || command?.previewFeature || engine.status !== 'ready' || engine.evaluatedDocument !== document) return;
    const probe = cloneDocument(document);
    const result = synchronizeProjectedGeometry(probe, actualBodies);
    if (!result.updatedEntityIds.length && !result.updatedReferenceIds.length) return;
    history.synchronize((next) => synchronizeProjectedGeometry(next, actualBodies));
    setNotice(`Project odświeżony automatycznie · ${result.updatedEntityIds.length} ${result.updatedEntityIds.length === 1 ? 'element' : 'elementów'}.`);
  }, [document, actualBodies, command?.previewFeature, engine.status, engine.evaluatedDocument, history, readOnly]);

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
      performance: engine.performance,
    };
    return () => { delete window.__madcadVerifyEngineState; };
  }, [engine.status, engine.revision, engine.cache, engine.bodies, engine.timeline, engine.diagnostics, engine.performance]);

  const updateCommand = (patch) => {
    setCommand((current) => {
      const next = { ...current, ...patch };
      if (next.type === 'extrude') {
        if (next.extent === 'through-all' && !['cut', 'intersect'].includes(next.operation)) next.extent = 'one-side';
        next.previewFeature = createFeature('extrude', {
          name: current.previewFeature?.name || `Wyciągnięcie ${document.features.length + 1}`,
          sketchId: selectedProfileMatch?.sketch.id,
          profileIds: [selectedProfile.id],
          distance: next.distance,
          secondDistance: next.secondDistance,
          extent: next.extent,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'hole') {
        next.previewFeature = next.placement === 'face-edges'
          ? createFeature('hole', {
            name: current.previewFeature?.name || `Otwór ${document.features.length + 1}`,
            placement: 'face-edges',
            targetBodyId: next.targetBodyId,
            referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
            firstOffset: next.firstOffset,
            secondOffset: next.secondOffset,
            holeType: next.holeType, extent: next.extent, diameter: next.diameter, depth: next.depth,
            counterboreDiameter: next.counterboreDiameter, counterboreDepth: next.counterboreDepth,
            countersinkDiameter: next.countersinkDiameter, countersinkAngle: next.countersinkAngle,
            threadMode: next.threadMode, threadDiameter: next.threadDiameter, threadPitch: next.threadPitch, threadLength: next.threadLength, threadDirection: next.threadDirection,
            clearanceProfile: next.clearanceProfile, clearance: next.clearance,
          })
          : createFeature('hole', {
            name: current.previewFeature?.name || `Otwór ${document.features.length + 1}`,
            targetBodyId,
            sketchId: selectedSketchPointMatch?.sketch.id || selectedProfileMatch?.sketch.id,
            ...(selectedSketchPointMatch ? { pointId: selectedSketchPointMatch.point.id } : { profileId: selectedProfile.id }),
            holeType: next.holeType, extent: next.extent, diameter: next.diameter, depth: next.depth,
            counterboreDiameter: next.counterboreDiameter, counterboreDepth: next.counterboreDepth,
            countersinkDiameter: next.countersinkDiameter, countersinkAngle: next.countersinkAngle,
            threadMode: next.threadMode, threadDiameter: next.threadDiameter, threadPitch: next.threadPitch, threadLength: next.threadLength, threadDirection: next.threadDirection,
            clearanceProfile: next.clearanceProfile, clearance: next.clearance,
          });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'boolean') {
        next.previewFeature = createFeature('boolean', {
          name: current.previewFeature?.name || `Boolean ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId,
          toolBodyId: next.toolBodyId,
          operation: next.operation,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'primitive') {
        next.previewFeature = createFeature('primitive', {
          name: next.name,
          primitiveType: next.primitiveType,
          x: next.x, y: next.y, z: next.z,
          width: next.width, depth: next.depth, height: next.height,
          radius: next.radius, majorRadius: next.majorRadius, minorRadius: next.minorRadius,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'textSolid') {
        next.previewFeature = createFeature('textSolid', {
          name: current.previewFeature?.name || `Tekst 3D ${document.features.length + 1}`,
          text: next.text,
          fontSize: next.fontSize,
          depth: next.depth,
          x: next.x, y: next.y, z: next.z,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : next.targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'transform') {
        next.previewFeature = createFeature('transform', {
          name: current.previewFeature?.name || `${next.mode === 'rotate' ? 'Obrót' : 'Przesunięcie'} ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId || targetBodyId,
          mode: next.mode,
          x: next.x, y: next.y, z: next.z,
          angle: next.angle,
          originX: next.originX, originY: next.originY, originZ: next.originZ,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'offsetFace') {
        next.previewFeature = createFeature('offsetFace', {
          name: current.previewFeature?.name || `Offset Face ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId || targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
          distance: next.distance,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'fillet' || next.type === 'chamfer') {
        next.previewFeature = createFeature(next.type, {
          name: current.previewFeature?.name || `${next.type === 'fillet' ? 'Zaokrąglenie' : 'Fazowanie'} ${document.features.length + 1}`,
          targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
          ...(next.type === 'fillet' ? { radius: next.size } : { distance: next.size }),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'shell') {
        next.previewFeature = createFeature('shell', {
          name: current.previewFeature?.name || `Shell ${document.features.length + 1}`,
          targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
          thickness: next.thickness,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      return next;
    });
  };

  const startSketch = () => {
    if (readOnly) return readOnlyNotice();
    if (selection?.kind === 'constructionPlane') {
      const supportPlane = constructionPlanes.find((plane) => plane.id === selection.id);
      if (!supportPlane || supportPlane.status !== 'ok') {
        setNotice('Wybrana płaszczyzna konstrukcyjna ma błąd i nie może być podporą szkicu.');
        return;
      }
      const normal = supportPlane.normal;
      const dominant = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
      if (normal.some((value, index) => index !== dominant && Math.abs(value) > 1e-6)) {
        setNotice('Obrócone płaszczyzny konstrukcyjne wymagają ramy UCS; wybierz obecnie płaszczyznę równoległą do XY, XZ albo YZ.');
        return;
      }
      const plane = dominant === 0 ? 'YZ' : dominant === 1 ? 'XZ' : 'XY';
      const planeOffset = dominant === 1 ? -supportPlane.origin[1] : supportPlane.origin[dominant];
      const sketch = createSketch({ name: `Szkic ${document.sketches.length + 1}`, plane, planeOffset, support: { kind: 'construction-plane', referenceId: supportPlane.id } });
      commit((next) => next.sketches.push(sketch));
      setActiveSketchId(sketch.id);
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
      setWorkspace('sketch');
      setNotice(`Edytujesz ${sketch.name} na płaszczyźnie ${supportPlane.name}.`);
      return;
    }
    const selectedFace = (selection?.items || (selection?.kind === 'face' ? [selection] : [])).find((item) => item.kind === 'face');
    if (selectedFace) {
      const body = engine.bodies.find((candidate) => candidate.id === selectedFace.bodyId);
      const face = body?.topology?.faces?.find((candidate) => candidate.id === selectedFace.id);
      if (face?.descriptor?.geometry !== 'PLANE') {
        setNotice('Szkic można założyć bezpośrednio tylko na płaskiej ścianie.');
        return;
      }
      const normal = face.descriptor.normal || [0, 0, 1];
      const dominant = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
      if (normal.some((value, index) => index !== dominant && Math.abs(value) > 1e-6)) {
        setNotice('Obrócone ściany planarne będą obsługiwane przez ramę UCS; ta ściana nie jest równoległa do XY, XZ ani YZ.');
        return;
      }
      const plane = dominant === 0 ? 'YZ' : dominant === 1 ? 'XZ' : 'XY';
      const center = face.descriptor.center || [0, 0, 0];
      const planeOffset = dominant === 1 ? -center[1] : center[dominant];
      const reference = createTopologyReference({ selection: selectedFace, descriptor: face.descriptor, label: `Podpora szkicu ${document.sketches.length + 1}` });
      const sketch = createSketch({ name: `Szkic ${document.sketches.length + 1}`, plane, planeOffset, support: { kind: 'face', referenceId: reference.id } });
      commit((next) => { next.references.push(reference); next.sketches.push(sketch); });
      setActiveSketchId(sketch.id);
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
      setWorkspace('sketch');
      setNotice(`Edytujesz ${sketch.name} bezpośrednio na ścianie modelu (${plane}, odsunięcie ${planeOffset.toFixed(3)} mm).`);
      return;
    }
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
    const selectedPoint = selectedSketchEntityIds.length === 1
      ? sketch?.entities.find((entity) => entity.id === selectedSketchEntityIds[0]
        && entity.type === 'point'
        && entity.role === 'standard'
        && !sketch.entities.some((candidate) => candidate.id !== entity.id && candidate.pointIds?.includes(entity.id)))
      : null;
    setActiveSketchId(null);
    setWorkspace('solid');
    setCommand(null);
    if (selectedPoint) setSelection({ kind: 'sketchPoint', id: selectedPoint.id, sketchId: sketch.id });
    else if (lastProfile) setSelection({ kind: 'profile', id: lastProfile.id, sketchId: sketch.id });
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
      setCommand({ type, definition: 'center', editId: profile?.id || null, name: profile?.name || `Prostokąt ${document.sketches.flatMap((item) => item.profiles).length + 1}`, width: profile?.geometry.width || '40', height: profile?.geometry.height || '30', x: profile?.geometry.x || '0', y: profile?.geometry.y || '0', rotation: '0', x1: '-20', y1: '-15', x2: '20', y2: '15', x3: '20', y3: '15' });
    } else {
      setCommand({ type, definition: 'centerRadius', editId: profile?.id || null, name: profile?.name || `Okrąg ${document.sketches.flatMap((item) => item.profiles).length + 1}`, diameter: profile?.geometry.diameter || '10', x: profile?.geometry.x || '0', y: profile?.geometry.y || '0', x1: '-5', y1: '0', x2: '5', y2: '0', x3: '0', y3: '5' });
    }
    setNotice('Ustaw wymiary profilu. Podgląd na płótnie aktualizuje się na bieżąco.');
  };

  const openMechanicalShape = (type) => {
    if (readOnly) return readOnlyNotice();
    if (!activeSketchId) {
      startSketch();
      return;
    }
    const number = document.sketches.flatMap((item) => item.profiles).length + 1;
    if (type === 'arc') setCommand({ type, definition: 'threePoints', name: `Łuk ${number}`, x1: '-10', y1: '0', x2: '0', y2: '10', x3: '10', y3: '0', direction: 'ccw' });
    if (type === 'polygon') setCommand({ type, definition: 'inscribed', name: `Wielokąt ${number}`, sides: '6', radius: '15', x: '0', y: '0', rotation: '0', x1: '-10', y1: '0', x2: '10', y2: '0' });
    if (type === 'ellipse') setCommand({ type, definition: 'full', name: `Elipsa ${number}`, majorRadius: '20', minorRadius: '10', x: '0', y: '0', rotation: '0', startAngle: '0', endAngle: '180', direction: 'ccw' });
    if (type === 'slot') setCommand({ type, definition: 'centerToCenter', name: `Slot ${number}`, x1: '-15', y1: '0', x2: '15', y2: '0', x3: '-15', y3: '5', x: '0', y: '0', radius: '25', startAngle: '0', endAngle: '90', direction: 'ccw', width: '10' });
    if (type === 'spline') setCommand({ type, definition: 'fit', name: `Spline ${number}`, pointsText: '-20,0; -8,15; 8,-15; 20,0' });
    if (type === 'conic') setCommand({ type, name: `Conic ${number}`, x1: '-20', y1: '0', x2: '0', y2: '20', x3: '20', y3: '0', rho: '0.7071067812', continuity: 'tangent' });
    if (type === 'point') setCommand({ type, x: '0', y: '0', role: 'standard' });
    setNotice('Ustaw dokładne dane konstrukcyjne figury i zatwierdź operację.');
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
        refreshDetectedSketchProfiles(sketch, next.parameters);
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

    const detectionSketch = structuredClone(activeSketch);
    if (targetPoint) detectionSketch.entities.push(targetPoint);
    if (auxiliaryPoint) detectionSketch.entities.push(auxiliaryPoint);
    detectionSketch.entities.push(segment);
    const topology = refreshDetectedSketchProfiles(detectionSketch, document.parameters);
    const detectedProfile = topology.profiles.find((profile) => profile.entityIds.includes(segment.id)) || null;
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      if (targetPoint) sketch.entities.push(targetPoint);
      if (auxiliaryPoint) sketch.entities.push(auxiliaryPoint);
      sketch.entities.push(segment);
      sketch.profiles = structuredClone(detectionSketch.profiles);
      sketch.diagnostics = structuredClone(detectionSketch.diagnostics || []);
    });

    if (closes) {
      setSelection(detectedProfile ? { kind: 'profile', id: detectedProfile.id, sketchId: activeSketchId } : { kind: 'sketch', id: activeSketchId });
      setCommand(null);
      setNotice(detectedProfile
        ? `Polilinia zamknięta. Utworzono profil${detectedProfile.innerLoops?.length ? ` z ${detectedProfile.innerLoops.length} otworem` : ''} gotowy do wyciągnięcia.`
        : topology.diagnostics[0]?.message || 'Obrys jest zamknięty, ale nie tworzy poprawnego profilu.');
      return;
    }
    if (command.type === 'line') {
      setCommand(null);
      if (detectedProfile) {
        setSelection({ kind: 'profile', id: detectedProfile.id, sketchId: activeSketchId });
        setNotice('Linia zamknęła obrys. Utworzono profil gotowy do wyciągnięcia.');
      } else setNotice('Linia została dodana.');
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
        refreshDetectedSketchProfiles(sketch, next.parameters);
      });
      setCommand((current) => ({ ...current, pointIds: [], points: [], firstPoint: null, lastPoint: null }));
      return;
    }
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      const removed = new Set([segmentId, pointId, auxiliaryPointId].filter(Boolean));
      sketch.entities = sketch.entities.filter((entity) => !removed.has(entity.id));
      refreshDetectedSketchProfiles(sketch, next.parameters);
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

  const handleSketchSelection = (ids, mode = 'replace', details = {}) => {
    const candidates = [...new Set(ids || [])];
    setSelection((current) => {
      const existing = current?.kind === 'sketchEntities' && current.sketchId === activeSketchId ? current.ids : [];
      let nextIds;
      if (mode === 'add') nextIds = [...new Set([...existing, ...candidates])];
      else if (mode === 'toggle') {
        const next = new Set(existing);
        candidates.forEach((id) => next.has(id) ? next.delete(id) : next.add(id));
        nextIds = [...next];
      } else nextIds = candidates;
      return nextIds.length
        ? { kind: 'sketchEntities', sketchId: activeSketchId, ids: nextIds }
        : { kind: 'sketch', id: activeSketchId };
    });
    if (candidates.length) {
      setNotice(`${details.crossing ? 'Wybór przecinający' : 'Zaznaczenie'}: ${candidates.length} ${candidates.length === 1 ? 'element' : 'elementy'}. Ctrl/Shift dodaje kolejne.`);
    } else setNotice('Wyczyszczono zaznaczenie szkicu.');
  };

  const handleTopologySelection = (topology, mode = 'replace') => {
    if (!topology) {
      setSelection({ kind: 'document', id: document.id });
      return;
    }
    const item = topology.kind === 'body'
      ? { kind: 'body', id: topology.bodyId, bodyId: topology.bodyId, sourceFeatureId: topology.sourceFeatureId }
      : { kind: topology.kind, id: topology.id, bodyId: topology.bodyId, sourceFeatureId: topology.sourceFeatureId };
    setSelection((current) => {
      if (mode === 'replace') return { ...item, items: [item] };
      const existing = current?.items || (['body', 'face', 'edge', 'vertex'].includes(current?.kind) ? [current] : []);
      const key = `${item.kind}:${item.id}`;
      const hasItem = existing.some((entry) => `${entry.kind}:${entry.id}` === key);
      const items = mode === 'toggle' && hasItem
        ? existing.filter((entry) => `${entry.kind}:${entry.id}` !== key)
        : hasItem ? existing : [...existing, item];
      if (!items.length) return { kind: 'document', id: document.id };
      return { ...items.at(-1), items };
    });
    const label = topology.kind === 'face' ? 'Ściana' : topology.kind === 'edge' ? 'Krawędź' : topology.kind === 'vertex' ? 'Wierzchołek' : 'Bryła';
    setNotice(`${label} zaznaczona przez trwałe ID: ${topology.id}.${mode === 'replace' ? '' : ' Ctrl/Shift utrzymuje wybór wielokrotny.'}`);
  };

  const repairTopologyReference = (referenceId, topology, descriptor = null) => {
    if (readOnly) return readOnlyNotice();
    try {
      commit((next) => {
        const index = next.references.findIndex((reference) => reference.id === referenceId);
        if (index < 0) throw new Error('Nie znaleziono referencji do naprawy.');
        next.references[index] = reassignTopologyReference(next.references[index], topology, descriptor);
        synchronizeProjectedGeometry(next, actualBodies);
      });
      setSelection({ kind: topology.kind, id: topology.id, bodyId: topology.bodyId, sourceFeatureId: topology.sourceFeatureId, items: [topology] });
      setNotice('Referencja została ponownie przypisana i historia modelu jest przeliczana.');
    } catch (error) {
      setNotice(`Nie udało się naprawić referencji: ${error.message}`);
    }
  };

  const toggleConstructionVisibility = (referenceId) => {
    if (readOnly) return readOnlyNotice();
    commit((next) => {
      const reference = next.references.find((item) => item.id === referenceId && ['construction-plane', 'construction-axis', 'construction-point'].includes(item.kind));
      if (reference) reference.visible = !reference.visible;
    });
  };

  const moveSketchEntities = ({ ids = selectedSketchEntityIds, dx = 0, dy = 0 } = {}) => {
    if (readOnly) return readOnlyNotice();
    if (!activeSketchId || !ids.length) {
      setNotice('Wybierz punkt lub segment szkicu do przesunięcia.');
      return false;
    }
    try {
      const checked = cloneDocument(document);
      translateSketchSelection(
        checked.sketches.find((item) => item.id === activeSketchId),
        ids,
        { dx, dy },
        checked.parameters,
      );
      refreshDetectedSketchProfiles(checked.sketches.find((item) => item.id === activeSketchId), checked.parameters);
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        translateSketchSelection(sketch, ids, { dx, dy }, next.parameters);
        refreshDetectedSketchProfiles(sketch, next.parameters);
      });
      setNotice(`Przesunięto ${ids.length} ${ids.length === 1 ? 'element' : 'elementy'}: ΔX ${Number(dx).toFixed(1)} mm, ΔY ${Number(dy).toFixed(1)} mm.`);
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
    }
  };

  const addSelectedSketchConstraint = (type) => {
    if (readOnly) return readOnlyNotice();
    const valid = type === 'collinear' ? canAddCollinear : type === 'symmetry' ? canAddSymmetry : false;
    if (!activeSketchId || !valid) {
      setNotice(type === 'collinear' ? 'Współliniowość wymaga zaznaczenia dwóch linii.' : 'Symetria wymaga zaznaczenia dwóch punktów i jednej linii osi.');
      return;
    }
    const constraint = createSketchConstraint(type, selectedSketchEntityIds);
    const applyConstraint = (next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      sketch.constraints.push(constraint);
      const solution = solveSketchConstraints(sketch, next.parameters);
      if (!solution.converged || !solution.solved || solution.status === SKETCH_SOLVER_STATUS.CONFLICT) {
        throw new Error(solution.diagnostics?.[0]?.message || 'Solver nie znalazł poprawnego rozwiązania.');
      }
      applySketchConstraintSolution(sketch, solution);
      refreshDetectedSketchProfiles(sketch, next.parameters);
    };
    try {
      const checked = cloneDocument(document);
      applyConstraint(checked);
      commit(applyConstraint);
      setSelection({ kind: 'sketchConstraint', id: constraint.id, sketchId: activeSketchId });
      setNotice(type === 'collinear' ? 'Dodano więz współliniowości. Cofnij przywraca poprzednią geometrię.' : 'Dodano więz symetrii względem wskazanej osi. Cofnij przywraca poprzednią geometrię.');
    } catch (error) {
      setNotice(`Nie dodano więzu: ${error.message}`);
    }
  };

  const openSketchMove = () => {
    if (!selectedSketchEntityIds.length) {
      setNotice('Najpierw zaznacz punkt lub segment szkicu.');
      return;
    }
    setCommand({ type: 'moveSketch', dx: '0', dy: '0' });
    setNotice('Wpisz dokładne przesunięcie w osiach aktywnego szkicu.');
  };

  const confirmSketchMove = () => {
    if (moveSketchEntities({ ids: selectedSketchEntityIds, dx: command.dx, dy: command.dy })) setCommand(null);
  };

  const activeOffsetProfile = selection?.kind === 'profile' && selectedProfileMatch?.sketch.id === activeSketchId
    ? selectedProfile
    : null;

  const openSketchOffset = () => {
    if (!selectedSketchEntityIds.length && !activeOffsetProfile) {
      setNotice('Najpierw zaznacz krzywą, ciągły łańcuch albo profil szkicu.');
      return;
    }
    setCommand({ type: 'offsetSketch', distance: '2' });
    setNotice('Wpisz odległość Offset. Zmień znak, aby wybrać przeciwną stronę.');
  };

  const confirmSketchOffset = () => {
    const applyOffset = (next) => activeOffsetProfile
      ? offsetSketchProfile(next, activeSketchId, activeOffsetProfile.id, command.distance)
      : offsetSketchEntities(next, activeSketchId, selectedSketchEntityIds, command.distance);
    try {
      const checked = cloneDocument(document);
      const result = applyOffset(checked);
      commit(applyOffset);
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: result.createdEntityIds });
      setCommand(null);
      setNotice(`Offset utworzył ${result.createdEntityIds.length} ${result.createdEntityIds.length === 1 ? 'krzywą' : 'krzywe'} w odległości ${result.distance} mm. Cofnij przywraca stan.`);
    } catch (error) {
      setNotice(`Offset nie został wykonany: ${error.message}`);
    }
  };

  const openSketchCorner = (mode) => {
    if (selectedSketchEntityIds.length !== 2) {
      setNotice(`${mode === 'fillet' ? 'Fillet' : 'Chamfer'} wymaga zaznaczenia dokładnie dwóch linii ze wspólnym narożnikiem.`);
      return;
    }
    setCommand({ type: 'cornerSketch', mode, size: '2' });
    setNotice(`Wpisz ${mode === 'fillet' ? 'promień zaokrąglenia' : 'odległość fazy'} narożnika.`);
  };

  const confirmSketchCorner = () => {
    const operation = command.mode === 'fillet' ? filletSketchLines : chamferSketchLines;
    const applyCorner = (next) => operation(next, activeSketchId, selectedSketchEntityIds, command.size);
    try {
      const checked = cloneDocument(document);
      const result = applyCorner(checked);
      commit(applyCorner);
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: [result.connectorEntityId] });
      setCommand(null);
      setNotice(`${command.mode === 'fillet' ? 'Fillet' : 'Chamfer'} szkicu wykonany${result.removedConstraintIds.length ? `; usunięto ${result.removedConstraintIds.length} zerwanych więzów` : ''}. Cofnij przywraca cały narożnik.`);
    } catch (error) {
      setNotice(`${command.mode === 'fillet' ? 'Fillet' : 'Chamfer'} szkicu nie został wykonany: ${error.message}`);
    }
  };

  const openSketchTransform = () => {
    if (!selectedSketchEntityIds.length) {
      setNotice('Najpierw zaznacz geometrię szkicu do transformacji.');
      return;
    }
    setCommand({ type: 'transformSketch', operation: 'rotate', centerX: '0', centerY: '0', angle: '90', dx: '10', dy: '0', axis: 'vertical', axisOffset: '0', factor: '2' });
    setNotice('Wybierz Rotate, Copy, Mirror albo Scale i wpisz dokładne wartości.');
  };

  const confirmSketchTransform = () => {
    const applyTransform = (next) => {
      if (command.operation === 'copy') return copySketchSelection(next, activeSketchId, selectedSketchEntityIds, { dx: command.dx, dy: command.dy });
      if (command.operation === 'mirror') return mirrorSketchSelection(next, activeSketchId, selectedSketchEntityIds, command.axis === 'vertical'
        ? { originX: command.axisOffset, originY: 0, angle: 90 }
        : { originX: 0, originY: command.axisOffset, angle: 0 });
      if (command.operation === 'scale') return scaleSketchSelection(next, activeSketchId, selectedSketchEntityIds, { centerX: command.centerX, centerY: command.centerY, factor: command.factor });
      return rotateSketchSelection(next, activeSketchId, selectedSketchEntityIds, { centerX: command.centerX, centerY: command.centerY, angle: command.angle });
    };
    try {
      const checked = cloneDocument(document);
      const result = applyTransform(checked);
      commit(applyTransform);
      const resultIds = result.createdEntityIds || result.transformedEntityIds;
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: resultIds });
      setCommand(null);
      const label = command.operation[0].toUpperCase() + command.operation.slice(1);
      setNotice(`${label} wykonany dla ${resultIds.length} ${resultIds.length === 1 ? 'elementu' : 'elementów'}${result.removedConstraintIds?.length ? `; usunięto ${result.removedConstraintIds.length} zerwanych więzów` : ''}. Cofnij przywraca stan.`);
    } catch (error) {
      setNotice(`Transformacja nie została wykonana: ${error.message}`);
    }
  };

  const projectSelectedTopology = () => {
    if (readOnly) return readOnlyNotice();
    const selected = (selection?.items || (['edge', 'vertex'].includes(selection?.kind) ? [selection] : [])).filter((item) => ['edge', 'vertex'].includes(item.kind));
    if (command?.type !== 'projectSketch' || !selected.length) {
      setCommand({ type: 'projectSketch' });
      setNotice('Project: kliknij wierzchołek albo krawędź modelu. Ctrl/Shift dodaje kolejne; ponownie wybierz Project, aby zatwierdzić.');
      return;
    }
    try {
      const sources = selected.map((item) => {
        const body = engine.bodies.find((candidate) => candidate.id === item.bodyId);
        const records = item.kind === 'edge' ? body?.topology?.edges : body?.topology?.vertices;
        const record = records?.find((candidate) => candidate.id === item.id);
        if (!record) throw new Error(`Nie znaleziono źródła ${item.kind}.`);
        return { selection: { ...item, sourceFeatureId: item.sourceFeatureId || body.sourceFeatureId }, descriptor: record.descriptor };
      });
      let result;
      commit((next) => { result = projectTopologyToSketch(next, activeSketchId, sources); });
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: result.createdEntityIds });
      setCommand(null);
      setNotice(`Project utworzył ${result.createdEntityIds.length} elementów z ${result.createdReferenceIds.length} trwałych referencji.`);
    } catch (error) {
      setNotice(`Project nie został wykonany: ${error.message}`);
    }
  };

  const deleteSelectedSketchEntities = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId && selectedSketchConstraintId) {
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        sketch.constraints = (sketch.constraints || []).filter((constraint) => constraint.id !== selectedSketchConstraintId);
        sketch.dimensions = (sketch.dimensions || []).filter((dimension) => dimension.constraintId !== selectedSketchConstraintId);
      });
      setSelection({ kind: 'sketch', id: activeSketchId });
      setNotice('Usunięto więz i powiązany wymiar. Cofnij przywraca cały stan.');
      return;
    }
    if (!activeSketchId || !selectedSketchEntityIds.length) {
      setNotice('Wybierz geometrię albo badge więzu do usunięcia.');
      return;
    }
    const checked = cloneDocument(document);
    const result = deleteSketchSelection(checked, activeSketchId, selectedSketchEntityIds);
    commit((next) => {
      deleteSketchSelection(next, activeSketchId, selectedSketchEntityIds);
      refreshDetectedSketchProfiles(next.sketches.find((item) => item.id === activeSketchId), next.parameters);
    });
    setSelection({ kind: 'sketch', id: activeSketchId });
    setCommand(null);
    setNotice(`Usunięto ${result.entityIds.length} encji${result.profileIds.length ? `, ${result.profileIds.length} zależny profil` : ''}${result.featureIds.length ? ` i ${result.featureIds.length} zależną operację` : ''}. Cofnij przywraca cały stan.`);
  };

  const updateSketchConstraintValue = (constraintId, value) => {
    if (readOnly) return readOnlyNotice();
    const applyValue = (next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      const constraint = sketch?.constraints?.find((item) => item.id === constraintId);
      if (!constraint) throw new Error('Nie znaleziono wybranego więzu.');
      constraint.value = String(value);
      for (const dimension of sketch.dimensions || []) {
        if (dimension.constraintId === constraintId) dimension.expression = String(value);
      }
      const solution = solveSketchConstraints(sketch, next.parameters);
      if (!solution.converged || !solution.solved || solution.status === SKETCH_SOLVER_STATUS.CONFLICT) {
        throw new Error(solution.diagnostics?.[0]?.message || 'Solver nie znalazł poprawnego rozwiązania.');
      }
      applySketchConstraintSolution(sketch, solution);
      refreshDetectedSketchProfiles(sketch, next.parameters);
    };
    try {
      const checked = cloneDocument(document);
      applyValue(checked);
      commit(applyValue);
      setNotice(`Zmieniono wartość więzu na ${value}. Szkic i zależny model zostaną przeliczone.`);
    } catch (error) {
      setNotice(`Nie zmieniono więzu: ${error.message}`);
    }
  };

  const modifySketchAtPoint = ({ mode, entityId, point }) => {
    if (readOnly) return readOnlyNotice();
    try {
      const checked = cloneDocument(document);
      const operation = mode === 'extend' ? extendSketchEntity : mode === 'break' ? breakSketchEntity : trimSketchEntity;
      const result = operation(checked, activeSketchId, entityId, point);
      commit((next) => operation(next, activeSketchId, entityId, point));
      setSelection({ kind: 'sketch', id: activeSketchId });
      const label = mode === 'extend' ? 'Extend' : mode === 'break' ? 'Break' : 'Trim';
      setNotice(`${label} wykonany${result.removedConstraintIds.length ? `; usunięto ${result.removedConstraintIds.length} zerwanych więzów` : ''}${result.removedFeatureIds.length ? ` i ${result.removedFeatureIds.length} zależną operację` : ''}. Cofnij przywraca stan.`);
    } catch (error) {
      const label = mode === 'extend' ? 'Extend' : mode === 'break' ? 'Break' : 'Trim';
      setNotice(`${label} nie został wykonany: ${error.message}`);
    }
  };

  useEffect(() => {
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (!verifyMode) return undefined;
    window.__madcadVerifySketchPoint = appendSketchPoint;
    window.__madcadVerifySketchSelection = handleSketchSelection;
    window.__madcadVerifyTopologySelection = handleTopologySelection;
    window.__madcadVerifyCreateLostTopologyReference = () => {
      const body = engine.bodies[0];
      const edge = body?.topology?.edges?.[0];
      if (!body || !edge) throw new Error('Brak topologii do testu utraconej referencji.');
      const ownerFeatureId = document.features.at(-1)?.id || body.sourceFeatureId;
      const reference = createTopologyReference({
        selection: { kind: 'edge', id: `${edge.id}-lost`, bodyId: body.id, sourceFeatureId: body.sourceFeatureId },
        ownerFeatureId,
        descriptor: edge.descriptor,
        label: 'Kontrolowana utracona krawędź',
      });
      history.commit((next) => { next.references.push(reference); });
      return reference.id;
    };
    window.__madcadVerifyBreakProjectedReference = () => {
      const projected = document.sketches.flatMap((sketch) => sketch.entities)
        .find((entity) => entity.type === 'line' && entity.role === 'projected' && entity.projectionReferenceId);
      if (!projected) throw new Error('Brak geometrii Project do testu utraconej referencji.');
      history.commit((next) => {
        const reference = next.references.find((item) => item.id === projected.projectionReferenceId);
        if (!reference) throw new Error('Brak źródła Project do kontrolowanego zerwania.');
        reference.topologyId = `${reference.topologyId}-lost`;
      });
      return { entityId: projected.id, referenceId: projected.projectionReferenceId };
    };
    window.__madcadVerifyMoveSketch = moveSketchEntities;
    window.__madcadVerifyDeleteSketch = deleteSelectedSketchEntities;
    window.__madcadVerifyLoadTopologyFixture = (plane = 'XY') => {
      const fixture = createDocument(`Topologia ${plane}`);
      const loopEntities = (coordinates) => {
        const points = coordinates.map(([x, y]) => createSketchPoint({ x, y }));
        const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
        return [...points, ...lines];
      };
      const sketch = createSketch({
        name: `Profil z otworem ${plane}`,
        plane,
        entities: [
          ...loopEntities([[0, 0], [40, 0], [40, 30], [0, 30]]),
          ...loopEntities([[10, 8], [30, 8], [30, 22], [10, 22]]),
        ],
      });
      refreshDetectedSketchProfiles(sketch, fixture.parameters);
      fixture.sketches.push(sketch);
      fixture.features.push(createFeature('extrude', {
        name: `Wyciągnięcie z otworem ${plane}`,
        sketchId: sketch.id,
        profileIds: [sketch.profiles[0].id],
        distance: '6',
        operation: 'new',
      }));
      history.replace(fixture);
      setActiveSketchId(null);
      setWorkspace('solid');
      setSelection({ kind: 'document', id: fixture.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadMechanicalFixture = (kind = 'ellipse') => {
      const fixture = createDocument(`Figura mechaniczna ${kind}`);
      let shape;
      if (kind === 'bracket') {
        const lowerLeft = createSketchPoint({ x: -40, y: -25 });
        const lowerArc = createSketchPoint({ x: 20, y: -25 });
        const arcCenter = createSketchPoint({ x: 20, y: 0 });
        const upperArc = createSketchPoint({ x: 20, y: 25 });
        const upperLeft = createSketchPoint({ x: -40, y: 25 });
        const outline = [
          createSketchLine({ startPointId: lowerLeft.id, endPointId: lowerArc.id }),
          createSketchArc({ centerPointId: arcCenter.id, startPointId: lowerArc.id, endPointId: upperArc.id, direction: 'ccw' }),
          createSketchLine({ startPointId: upperArc.id, endPointId: upperLeft.id }),
          createSketchLine({ startPointId: upperLeft.id, endPointId: lowerLeft.id }),
        ];
        const slot = slotCenterToCenter([-12, 0], [8, 0], 8);
        const firstHole = circleCenterRadius([-25, -12], 4);
        const secondHole = circleCenterRadius([-25, 12], 4);
        shape = { entities: [lowerLeft, lowerArc, arcCenter, upperArc, upperLeft, ...outline, ...slot.entities, ...firstHole.entities, ...secondHole.entities] };
      } else if (kind === 'ellipse') shape = ellipseFromCenter([0, 0], 20, 10, 25);
      else if (kind === 'spline') {
        shape = fitPointSpline([[0, 0], [8, 12], [16, 8], [24, 0]]);
        shape.entities.push(createSketchLine({ startPointId: shape.points.at(-1).id, endPointId: shape.points[0].id }));
      } else if (kind === 'conic') {
        shape = conicThroughControlPoint([-14, 0], [0, 18], [14, 0], Math.SQRT1_2, 'tangent');
        shape.entities.push(createSketchLine({ startPointId: shape.points[2].id, endPointId: shape.points[0].id }));
      } else if (kind === 'ellipticalArc') {
        shape = ellipticalArcFromCenter([0, 0], 20, 10, 0, 180, 0, 'ccw');
        shape.entities.push(createSketchLine({ startPointId: shape.points[2].id, endPointId: shape.points[1].id }));
      } else if (kind === 'slotArc') shape = slotArc({ center: [0, 0], radius: 25, width: 10, startAngle: 0, endAngle: 90, direction: 'ccw' });
      else shape = slotCenterToCenter([-15, 0], [15, 0], 10);
      const sketch = createSketch({ name: `Szkic ${kind}`, plane: 'XY', entities: shape.entities });
      refreshDetectedSketchProfiles(sketch, fixture.parameters);
      fixture.sketches.push(sketch);
      fixture.features.push(createFeature('extrude', { name: `Wyciągnięcie ${kind}`, sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '3', operation: 'new' }));
      history.replace(fixture);
      setActiveSketchId(null);
      setWorkspace('solid');
      setSelection({ kind: 'document', id: fixture.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadParametricBracketFixture = () => {
      const fixture = createDocument('W pełni związany wspornik');
      const points = [
        createSketchPoint({ x: 0, y: 0, fixed: true }),
        createSketchPoint({ x: 40, y: 0 }),
        createSketchPoint({ x: 40, y: 30 }),
        createSketchPoint({ x: 0, y: 30 }),
      ];
      const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
      const sketch = createSketch({ name: 'Szkic wspornika', plane: 'XY', entities: [...points, ...lines], constraints: [
        createSketchConstraint('horizontal', [lines[0].id]),
        createSketchConstraint('vertical', [lines[1].id]),
        createSketchConstraint('horizontal', [lines[2].id]),
        createSketchConstraint('vertical', [lines[3].id]),
      ] });
      const width = addDrivingSketchDimension(sketch, 'horizontal', [points[0].id, points[1].id], { expression: '40' });
      const height = addDrivingSketchDimension(sketch, 'vertical', [points[0].id, points[3].id], { expression: '30' });
      refreshDetectedSketchProfiles(sketch, fixture.parameters);
      const feature = createFeature('extrude', { name: 'Bryła wspornika', sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '5', operation: 'new' });
      fixture.sketches.push(sketch);
      fixture.features.push(feature);
      window.__madcadParametricBracketIds = {
        sketchId: sketch.id,
        entityIds: sketch.entities.map((entity) => entity.id),
        profileId: sketch.profiles[0].id,
        featureId: feature.id,
        widthConstraintId: width.constraint.id,
        heightConstraintId: height.constraint.id,
      };
      history.replace(fixture);
      setActiveSketchId(sketch.id);
      setWorkspace('solid');
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadConstraintFixture = () => {
      const fixture = createDocument('Więzy P1');
      const sourcePoints = [createSketchPoint({ x: 0, y: 0 }), createSketchPoint({ x: 10, y: 0 })];
      const targetPoints = [createSketchPoint({ x: 2, y: 3 }), createSketchPoint({ x: 8, y: 5 })];
      const sourceLine = createSketchLine({ startPointId: sourcePoints[0].id, endPointId: sourcePoints[1].id, fixed: true });
      const targetLine = createSketchLine({ startPointId: targetPoints[0].id, endPointId: targetPoints[1].id });
      const axisPoints = [createSketchPoint({ x: 0, y: -10 }), createSketchPoint({ x: 0, y: 10 })];
      const axisLine = createSketchLine({ startPointId: axisPoints[0].id, endPointId: axisPoints[1].id, fixed: true });
      const symmetryPoints = [createSketchPoint({ x: -3, y: 2, fixed: true }), createSketchPoint({ x: 5, y: 4 })];
      const sketch = createSketch({ name: 'Szkic więzów P1', plane: 'XY', entities: [...sourcePoints, ...targetPoints, sourceLine, targetLine, ...axisPoints, axisLine, ...symmetryPoints] });
      fixture.sketches.push(sketch);
      window.__madcadConstraintFixtureIds = {
        collinear: [sourceLine.id, targetLine.id],
        symmetry: [symmetryPoints[0].id, symmetryPoints[1].id, axisLine.id],
        targetPointIds: targetPoints.map((point) => point.id),
        reflectedPointId: symmetryPoints[1].id,
      };
      history.replace(fixture);
      setActiveSketchId(sketch.id);
      setWorkspace('sketch');
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
    };
    window.__madcadVerifyUpdateConstraint = updateSketchConstraintValue;
    window.__madcadVerifyReopenAutosave = () => {
      const raw = window.localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) throw new Error('Brak autozapisu do ponownego otwarcia.');
      const opened = openDocument(JSON.parse(raw));
      history.replace(opened.document);
      setActiveSketchId(null);
      setSelection({ kind: 'document', id: opened.document.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadPointHoleFixture = () => {
      const fixture = createDocument('Otwór z punktu');
      const baseProfile = createRectangleProfile({ width: 40, height: 30, x: 0, y: 0 });
      const baseSketch = createSketch({ name: 'Baza punktu', plane: 'XY', profiles: [baseProfile] });
      const referencePoint = createSketchPoint({ x: 7, y: -4 });
      const pointSketch = createSketch({ name: 'Punkt otworu', plane: 'XY', entities: [referencePoint] });
      const extrusion = createFeature('extrude', { name: 'Baza', sketchId: baseSketch.id, profileIds: [baseSketch.profiles[0].id], distance: '10', operation: 'new' });
      const hole = createFeature('hole', { name: 'Otwór z punktu', targetBodyId: `body-${extrusion.id}`, sketchId: pointSketch.id, pointId: referencePoint.id, diameter: '6', depth: '10' });
      fixture.sketches.push(baseSketch, pointSketch);
      fixture.features.push(extrusion, hole);
      history.replace(fixture);
      setActiveSketchId(null);
      setWorkspace('solid');
      setSelection({ kind: 'sketchPoint', id: referencePoint.id, sketchId: pointSketch.id });
      setCommand(null);
    };
    window.__madcadVerifyDocumentState = {
      schemaVersion: document.schemaVersion,
      sketches: document.sketches.map((sketch) => ({
        id: sketch.id,
        plane: sketch.plane,
        planeOffset: sketch.planeOffset,
        support: sketch.support,
        entities: sketch.entities.length,
        entityData: sketch.entities.map((entity) => ({ id: entity.id, type: entity.type, role: entity.role, fixed: entity.fixed, projectionReferenceId: entity.projectionReferenceId, pointIds: entity.pointIds, geometry: entity.geometry })),
        profiles: sketch.profiles.length,
        profileIds: sketch.profiles.map((profile) => profile.id),
        constraints: sketch.constraints.map((constraint) => ({ id: constraint.id, type: constraint.type, value: constraint.value })),
        dimensions: sketch.dimensions.map((dimension) => ({ id: dimension.id, constraintId: dimension.constraintId, expression: dimension.expression })),
      })),
      features: document.features.length,
      featureIds: document.features.map((feature) => feature.id),
      featureData: document.features.map((feature) => ({ id: feature.id, type: feature.type, operation: feature.operation, placement: feature.placement, holeType: feature.holeType, extent: feature.extent, distance: feature.distance, depth: feature.depth, diameter: feature.diameter, clearanceProfile: feature.clearanceProfile, clearance: feature.clearance, secondDistance: feature.secondDistance, firstOffset: feature.firstOffset, secondOffset: feature.secondOffset, counterboreDiameter: feature.counterboreDiameter, counterboreDepth: feature.counterboreDepth, countersinkDiameter: feature.countersinkDiameter, countersinkAngle: feature.countersinkAngle, threadMode: feature.threadMode, threadDiameter: feature.threadDiameter, threadPitch: feature.threadPitch, threadLength: feature.threadLength, threadDirection: feature.threadDirection, referenceIds: feature.referenceIds, targetBodyId: feature.targetBodyId, toolBodyId: feature.toolBodyId, mode: feature.mode, x: feature.x, y: feature.y, z: feature.z, angle: feature.angle })),
      references: document.references.map((reference) => ({ id: reference.id, kind: reference.kind, planeType: reference.planeType, axisType: reference.axisType, pointType: reference.pointType, name: reference.name, basePlane: reference.basePlane, offset: reference.offset, firstOffset: reference.firstOffset, secondOffset: reference.secondOffset, points: reference.points, position: reference.position, origin: reference.origin, direction: reference.direction, planeIds: reference.planeIds, planeId: reference.planeId, axisId: reference.axisId, visible: reference.visible, topologyId: reference.topologyId, topologyKind: reference.topologyKind, bodyId: reference.bodyId, sourceFeatureId: reference.sourceFeatureId, ownerFeatureId: reference.ownerFeatureId })),
      selection: selection?.kind === 'sketchEntities'
        ? { kind: selection.kind, ids: selection.ids }
        : { kind: selection?.kind, id: selection?.id, items: selection?.items?.map((item) => ({ kind: item.kind, id: item.id })) || [] },
      command: command ? {
        type: command.type,
        previewThreadMode: command.previewFeature?.threadMode,
        previewThreadDirection: command.previewFeature?.threadDirection,
        previewClearanceProfile: command.previewFeature?.clearanceProfile,
        points: command.points?.length || 0,
        segments: command.segmentIds?.length || 0,
        measurement: command.type === 'measure' ? measurement : null,
        sectionAnalysis: command.type === 'sectionAnalysis' ? sectionAnalysis : null,
        massProperties: command.type === 'massProperties' ? massProperties : null,
        geometryInspection: command.type === 'geometryInspection' ? geometryInspection : null,
      } : null,
    };
    return () => {
      delete window.__madcadVerifySketchPoint;
      delete window.__madcadVerifySketchSelection;
      delete window.__madcadVerifyTopologySelection;
      delete window.__madcadVerifyCreateLostTopologyReference;
      delete window.__madcadVerifyBreakProjectedReference;
      delete window.__madcadVerifyMoveSketch;
      delete window.__madcadVerifyDeleteSketch;
      delete window.__madcadVerifyLoadTopologyFixture;
      delete window.__madcadVerifyLoadMechanicalFixture;
      delete window.__madcadVerifyLoadParametricBracketFixture;
      delete window.__madcadVerifyLoadConstraintFixture;
      delete window.__madcadVerifyUpdateConstraint;
      delete window.__madcadVerifyReopenAutosave;
      delete window.__madcadVerifyLoadPointHoleFixture;
      delete window.__madcadVerifyDocumentState;
    };
  }, [document, command, selection, activeSketchId, engine.bodies, measurement, sectionAnalysis, massProperties, geometryInspection]);

  const confirmProfile = () => {
    if (readOnly) return readOnlyNotice();
    if (!command.editId) return confirmMechanicalShape();
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

  const confirmMechanicalShape = () => {
    if (readOnly) return readOnlyNotice();
    const coordinate = (x, y) => [Number(x), Number(y)];
    let shape;
    try {
      if (command.type === 'rectangle') {
        if (command.definition === 'twoPoints') shape = rectangleTwoPoints(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2));
        else if (command.definition === 'threePoints') shape = rectangleThreePoints(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2), coordinate(command.x3, command.y3));
        else shape = rectangleFromCenter(coordinate(command.x, command.y), command.width, command.height, command.rotation);
      } else if (command.type === 'circle') {
        if (command.definition === 'twoPoints') shape = circleTwoPoints(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2));
        else if (command.definition === 'threePoints') shape = circleThreePoints(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2), coordinate(command.x3, command.y3));
        else shape = circleCenterRadius(coordinate(command.x, command.y), Number(command.diameter) / 2);
      } else if (command.type === 'arc') {
        shape = command.definition === 'centerStartEnd'
          ? arcCenterStartEnd(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2), coordinate(command.x3, command.y3), command.direction)
          : arcThroughThreePoints(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2), coordinate(command.x3, command.y3));
      } else if (command.type === 'polygon') {
        shape = command.definition === 'edge'
          ? polygonFromEdge(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2), command.sides)
          : regularPolygon({ center: coordinate(command.x, command.y), radius: command.radius, sides: command.sides, rotation: command.rotation, circumscribed: command.definition === 'circumscribed' });
      } else if (command.type === 'ellipse') {
        shape = command.definition === 'arc'
          ? ellipticalArcFromCenter(coordinate(command.x, command.y), command.majorRadius, command.minorRadius, command.startAngle, command.endAngle, command.rotation, command.direction)
          : ellipseFromCenter(coordinate(command.x, command.y), command.majorRadius, command.minorRadius, command.rotation);
      } else if (command.type === 'slot') {
        if (command.definition === 'arc') shape = slotArc({ center: coordinate(command.x, command.y), radius: command.radius, width: command.width, startAngle: command.startAngle, endAngle: command.endAngle, direction: command.direction });
        else if (command.definition === 'threePoints') shape = slotThreePoints(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2), coordinate(command.x3, command.y3));
        else shape = command.definition === 'overall' ? slotOverall(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2), command.width) : slotCenterToCenter(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2), command.width);
      } else if (command.type === 'spline') {
        const points = command.pointsText.split(';').map((entry) => entry.split(',').map((value) => Number(value.trim())));
        if (points.some((entry) => entry.length !== 2 || entry.some((value) => !Number.isFinite(value)))) throw new Error('Punkty spline wpisz jako x,y; x,y; …');
        shape = command.definition === 'control' ? controlPointSpline(points) : fitPointSpline(points);
      } else if (command.type === 'conic') {
        shape = conicThroughControlPoint(coordinate(command.x1, command.y1), coordinate(command.x2, command.y2), coordinate(command.x3, command.y3), command.rho, command.continuity);
      }
      if (!shape || shape.entities.some((entity) => entity.type === 'point' && (!Number.isFinite(Number(entity.geometry.x)) || !Number.isFinite(Number(entity.geometry.y))))) throw new Error('Współrzędne figury muszą być liczbami.');
    } catch (error) {
      setNotice(`Nie można utworzyć figury: ${error.message}`);
      return;
    }
    const curveIds = shape.curves.map((entity) => entity.id);
    const curveIdSet = new Set(curveIds);
    const shapeName = command.name?.trim() || 'Figura szkicu';
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      sketch.entities.push(...shape.entities);
      const result = refreshDetectedSketchProfiles(sketch, next.parameters);
      const createdProfile = result.profiles.find((profile) => profile.entityIds.length === curveIds.length && profile.entityIds.every((id) => curveIdSet.has(id)));
      if (createdProfile) createdProfile.name = shapeName;
    });
    setSelection({ kind: 'sketchEntities', ids: curveIds, sketchId: activeSketchId });
    setCommand(null);
    setNotice(`${shapeName} utworzono jako dokładną geometrię szkicu.`);
  };

  const confirmSketchPoint = () => {
    const x = Number(command.x);
    const y = Number(command.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setNotice('Punkt wymaga prawidłowych współrzędnych X i Y.');
      return;
    }
    const point = createSketchPoint({ x: String(x), y: String(y), role: command.role });
    commit((next) => next.sketches.find((item) => item.id === activeSketchId).entities.push(point));
    setSelection({ kind: 'sketchEntities', ids: [point.id], sketchId: activeSketchId });
    setCommand(null);
    setNotice(command.role === 'construction' ? 'Dodano punkt konstrukcyjny.' : 'Dodano punkt referencyjny gotowy do utworzenia otworu.');
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
        secondDistance: editing?.secondDistance || '10',
        extent: editing?.extent || 'one-side',
        operation,
      };
      next.previewFeature = createFeature('extrude', {
        name: editing?.previewFeature?.name || `Wyciągnięcie ${document.features.length + 1}`,
        sketchId: selectedProfileMatch?.sketch.id,
        profileIds: [selectedProfile.id],
        distance: next.distance,
        secondDistance: next.secondDistance,
        extent: next.extent,
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
    if (hasFaceEdgeHoleReference && !activeSketchId) {
      const bodyId = selectedFaceItems[0].bodyId;
      const body = engine.bodies.find((candidate) => candidate.id === bodyId);
      const faceRecord = body?.topology?.faces?.find((record) => record.id === selectedFaceItems[0].id);
      const edgeRecords = selectedEdgeItems.map((item) => body?.topology?.edges?.find((record) => record.id === item.id));
      try {
        resolveFaceEdgeHolePlacement(faceRecord?.descriptor, edgeRecords[0]?.descriptor, edgeRecords[1]?.descriptor, 10, 10);
        const topologyReferences = [
          createTopologyReference({ selection: selectedFaceItems[0], descriptor: faceRecord.descriptor, label: 'Otwór — ściana' }),
          createTopologyReference({ selection: selectedEdgeItems[0], descriptor: edgeRecords[0].descriptor, label: 'Otwór — krawędź 1' }),
          createTopologyReference({ selection: selectedEdgeItems[1], descriptor: edgeRecords[1].descriptor, label: 'Otwór — krawędź 2' }),
        ].map((reference) => ({ ...reference, scope: 'feature-input' }));
        const next = { type: 'hole', placement: 'face-edges', targetBodyId: bodyId, firstOffset: '10', secondOffset: '10', holeType: 'simple', extent: 'distance', diameter: '5', depth: '10', counterboreDiameter: '9', counterboreDepth: '3', countersinkDiameter: '10', countersinkAngle: '90', threadMode: 'none', threadDiameter: '6', threadPitch: '1', threadLength: '8', threadDirection: 'right', clearanceProfile: 'nominal', clearance: '0.2', topologyReferences, previewFeature: null };
        setCommand(next);
        window.setTimeout(() => updateCommand(next), 0);
        setNotice('Otwór jest pozycjonowany parametrycznie od dwóch wskazanych krawędzi.');
      } catch (error) {
        setNotice(`Nie można pozycjonować otworu: ${error.message}`);
      }
      return;
    }
    if (!hasHoleReference || !targetBodyId || activeSketchId) {
      setNotice('Zakończ szkic i wybierz punkt/profil albo planarną ścianę z dwiema prostopadłymi krawędziami.');
      return;
    }
    const next = { type: 'hole', holeType: 'simple', extent: 'distance', diameter: selectedCircleDiameter, depth: '10', counterboreDiameter: '10', counterboreDepth: '3', countersinkDiameter: '10', countersinkAngle: '90', threadMode: 'none', threadDiameter: '10', threadPitch: '1.5', threadLength: '8', threadDirection: 'right', clearanceProfile: 'nominal', clearance: '0.2', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
  };

  const openMeasure = () => {
    setCommand({ type: 'measure' });
    setNotice('Measure jest aktywny. Zaznacz element; Ctrl/Shift dodaje drugi do pomiaru odległości i kąta.');
  };

  const openSectionAnalysis = () => {
    const bounds = engine.bodies[0]?.metrics?.bounds;
    const offset = bounds ? (bounds[0][2] + bounds[1][2]) / 2 : 0;
    setSectionAnalysis({ enabled: true, plane: 'XY', offset: String(offset), flip: false });
    setCommand({ type: 'sectionAnalysis' });
    setNotice('Section Analysis jest aktywne. Wybierz płaszczyznę, położenie i stronę przekroju.');
  };

  const closeSectionAnalysis = () => {
    setSectionAnalysis(null);
    setCommand(null);
    setNotice('Section Analysis wyłączone; model nie został zmieniony.');
  };

  const openMassProperties = () => {
    setCommand({ type: 'massProperties', density: '1.24' });
    setNotice('Właściwości masowe liczą zaznaczone bryły albo cały model, gdy nic nie jest wskazane.');
  };

  const openGeometryInspection = () => {
    setCommand({ type: 'geometryInspection' });
    setNotice('Analiza geometrii pokazuje najmniejszy promień oraz wspólną objętość kolidujących brył.');
  };

  const openBoolean = () => {
    if (readOnly) return readOnlyNotice();
    if (selectedBodyIds.length !== 2) {
      setNotice('Wybierz dokładnie dwie bryły, używając Ctrl lub Shift. Ostatnia wskazana będzie narzędziem.');
      return;
    }
    const [targetBodyId, toolBodyId] = selectedBodyIds;
    const bodyName = (bodyId) => engine.bodies.find((body) => body.id === bodyId)?.name || bodyId;
    const previewFeature = createFeature('boolean', { name: `Boolean ${document.features.length + 1}`, targetBodyId, toolBodyId, operation: 'union' });
    setCommand({ type: 'boolean', operation: 'union', targetBodyId, toolBodyId, targetName: bodyName(targetBodyId), toolName: bodyName(toolBodyId), previewFeature });
    setNotice('Wybierz Union, Subtract albo Intersect i zatwierdź operację Boolean.');
  };

  const openPrimitive = () => {
    if (readOnly) return readOnlyNotice();
    const sequence = document.features.filter((feature) => feature.type === 'primitive').length + 1;
    const next = { type: 'primitive', name: `Box ${sequence}`, primitiveType: 'box', x: '0', y: '0', z: '0', width: '20', depth: '20', height: '20', radius: '10', majorRadius: '15', minorRadius: '4', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
  };

  const openTextSolid = () => {
    if (readOnly) return readOnlyNotice();
    const selectedTargetId = selection?.kind === 'body' ? selection.id : null;
    const selectedTarget = engine.bodies.find((body) => body.id === selectedTargetId);
    const surfaceZ = selectedTarget?.metrics?.bounds?.[1]?.[2] ?? 0;
    const next = { type: 'textSolid', text: 'MADCAD', fontSize: '10', depth: '2', x: '0', y: '0', z: String(surfaceZ), operation: selectedTargetId ? 'emboss' : 'new', targetBodyId: selectedTargetId, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice(selectedTargetId ? 'Tekst zostanie dodany do zaznaczonej bryły. Wybierz Emboss lub Deboss.' : 'Tekst zostanie wyciągnięty jako nowa bryła.');
  };

  const openTransform = (mode) => {
    if (readOnly) return readOnlyNotice();
    if (selection?.kind !== 'body' || !targetBodyId) {
      setNotice('Wybierz jedną bryłę do przesunięcia lub obrotu.');
      return;
    }
    const next = { type: 'transform', mode, targetBodyId, x: '0', y: '0', z: '0', angle: '0', originX: '0', originY: '0', originZ: '0', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
  };

  const openOffsetFace = () => {
    if (readOnly) return readOnlyNotice();
    const selectedFace = selectedFaceItems.length === 1 ? selectedFaceItems[0] : null;
    const body = selectedFace && engine.bodies.find((candidate) => candidate.id === selectedFace.bodyId);
    const record = body?.topology?.faces?.find((face) => face.id === selectedFace.id);
    if (!selectedFace || record?.descriptor?.geometry !== 'PLANE') {
      setNotice('Wybierz dokładnie jedną planarną ścianę dla Offset Face.');
      return;
    }
    const reference = { ...createTopologyReference({ selection: selectedFace, descriptor: record.descriptor, label: 'Offset Face — ściana' }), scope: 'feature-input' };
    const next = { type: 'offsetFace', targetBodyId: selectedFace.bodyId, distance: '1', faceLabel: record.id, topologyReferences: [reference], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
  };

  const openEdgeCommand = (type) => {
    if (readOnly) return readOnlyNotice();
    if (!targetBodyId || activeSketchId) {
      setNotice('Wybierz bryłę docelową.');
      return;
    }
    const selectedEdges = selectedEdgeItems.filter((item) => item.bodyId === targetBodyId);
    if (!selectedEdges.length) {
      setNotice(`Wybierz co najmniej jedną krawędź bryły dla ${type === 'fillet' ? 'Fillet' : 'Chamfer'}.`);
      return;
    }
    const topologyReferences = selectedEdges.map((item, index) => {
      const body = engine.bodies.find((candidate) => candidate.id === item.bodyId);
      const descriptor = body?.topology?.edges?.find((edge) => edge.id === item.id)?.descriptor || null;
      return { ...createTopologyReference({ selection: item, descriptor, label: `${type === 'fillet' ? 'Zaokrąglenie' : 'Fazowanie'} — krawędź ${index + 1}` }), scope: 'feature-input' };
    });
    setCommand({ type, size: '1', previewFeature: null, topologyReferences });
    window.setTimeout(() => updateCommand({ size: '1' }), 0);
  };

  const openShell = () => {
    if (readOnly) return readOnlyNotice();
    if (!targetBodyId || activeSketchId) {
      setNotice('Wybierz ściany bryły, które mają zostać usunięte przez Shell.');
      return;
    }
    const selectedFaces = selectedFaceItems.filter((item) => item.bodyId === targetBodyId);
    if (!selectedFaces.length) {
      setNotice('Wybierz co najmniej jedną ścianę bryły do usunięcia.');
      return;
    }
    const topologyReferences = selectedFaces.map((item, index) => {
      const body = engine.bodies.find((candidate) => candidate.id === item.bodyId);
      const descriptor = body?.topology?.faces?.find((face) => face.id === item.id)?.descriptor || null;
      return { ...createTopologyReference({ selection: item, descriptor, label: `Shell — usuwana ściana ${index + 1}` }), scope: 'feature-input' };
    });
    setCommand({ type: 'shell', thickness: '1', faceCount: selectedFaces.length, previewFeature: null, topologyReferences });
    window.setTimeout(() => updateCommand({ thickness: '1' }), 0);
  };

  const openConstructionPlane = (planeType = 'offset', plane = null) => {
    if (readOnly) return readOnlyNotice();
    const existing = plane;
    const mode = existing?.planeType || planeType;
    const commandType = mode === 'midplane' ? 'midplanePlane' : mode === 'three-points' ? 'threePointPlane' : 'offsetPlane';
    const defaultNames = { offset: 'Płaszczyzna odsunięta', midplane: 'Płaszczyzna środkowa', 'three-points': 'Płaszczyzna przez trzy punkty' };
    const points = existing?.points || [['0', '0', '0'], ['10', '0', '0'], ['0', '10', '0']];
    setCommand({
      type: commandType,
      planeType: mode,
      editId: existing?.id || null,
      name: existing?.name || `${defaultNames[mode]} ${document.references.filter((reference) => reference.kind === 'construction-plane').length + 1}`,
      basePlane: existing?.basePlane || (selection?.kind === 'plane' && PLANE_LABELS[selection.id] ? selection.id : 'XY'),
      offset: existing?.offset || '10',
      firstOffset: existing?.firstOffset || '0',
      secondOffset: existing?.secondOffset || '10',
      x1: points[0][0], y1: points[0][1], z1: points[0][2],
      x2: points[1][0], y2: points[1][1], z2: points[1][2],
      x3: points[2][0], y3: points[2][1], z3: points[2][2],
      visible: existing?.visible ?? true,
    });
    setNotice(existing ? `Edytujesz ${existing.name}.` : `Ustaw parametry: ${defaultNames[mode].toLowerCase()}.`);
  };

  const confirmConstructionPlane = () => {
    if (readOnly) return readOnlyNotice();
    try {
      const plane = command.planeType === 'midplane'
        ? createMidplane({ name: command.name, basePlane: command.basePlane, firstOffset: command.firstOffset, secondOffset: command.secondOffset, visible: command.visible })
        : command.planeType === 'three-points'
          ? createThreePointPlane({ name: command.name, points: [[command.x1, command.y1, command.z1], [command.x2, command.y2, command.z2], [command.x3, command.y3, command.z3]], visible: command.visible })
          : createOffsetPlane({ name: command.name, basePlane: command.basePlane, offset: command.offset, visible: command.visible });
      if (command.editId) plane.id = command.editId;
      resolveConstructionPlane(plane, document.parameters);
      commit((next) => {
        const index = next.references.findIndex((reference) => reference.id === plane.id);
        if (index >= 0) next.references[index] = plane;
        else next.references.push(plane);
      });
      setSelection({ kind: 'constructionPlane', id: plane.id });
      setCommand(null);
      setNotice(`${plane.name} została zapisana jako trwała geometria konstrukcyjna.`);
    } catch (error) {
      setNotice(`Nie udało się utworzyć płaszczyzny: ${error.message}`);
    }
  };

  const openConstructionAxis = (axisType = 'two-points', axis = null) => {
    if (readOnly) return readOnlyNotice();
    const selectedItem = selection?.items?.[0] || selection;
    const body = engine.bodies.find((candidate) => candidate.id === selectedItem?.bodyId);
    const topologyKey = selectedItem?.kind === 'edge' ? 'edges' : selectedItem?.kind === 'face' ? 'faces' : 'vertices';
    const topologyRecord = body?.topology?.[topologyKey]?.find((record) => record.id === selectedItem?.id);
    const points = axis?.points || (axisType === 'edge' ? topologyRecord?.descriptor?.endpoints : null) || [[0, 0, 0], axisType === 'edge' ? [10, 0, 0] : [0, 0, 10]];
    const origin = axis?.origin || topologyRecord?.descriptor?.axisOrigin || topologyRecord?.descriptor?.center || [0, 0, 0];
    const direction = axis?.direction || topologyRecord?.descriptor?.axisDirection || [0, 0, 1];
    const planeOptions = document.references.filter((reference) => reference.kind === 'construction-plane');
    const planeIds = axis?.planeIds || planeOptions.slice(0, 2).map((plane) => plane.id);
    const defaultNames = { edge: 'Oś z krawędzi', cylinder: 'Oś walca', 'two-points': 'Oś przez dwa punkty', 'plane-intersection': 'Oś przecięcia płaszczyzn' };
    setCommand({
      type: 'constructionAxis', axisType, editId: axis?.id || null,
      name: axis?.name || `${defaultNames[axisType]} ${document.references.filter((reference) => reference.kind === 'construction-axis').length + 1}`,
      x1: String(points[0][0]), y1: String(points[0][1]), z1: String(points[0][2]),
      x2: String(points[1][0]), y2: String(points[1][1]), z2: String(points[1][2]),
      origin0: String(origin[0]), origin1: String(origin[1]), origin2: String(origin[2]),
      direction0: String(direction[0]), direction1: String(direction[1]), direction2: String(direction[2]),
      planeOptions, planeId1: planeIds[0] || '', planeId2: planeIds[1] || planeIds[0] || '',
      topologyId: axis?.topologyId || topologyRecord?.id || null, bodyId: axis?.bodyId || body?.id || null,
      visible: axis?.visible ?? true,
    });
    setNotice(axis ? `Edytujesz ${axis.name}.` : `Ustaw parametry: ${defaultNames[axisType].toLowerCase()}.`);
  };

  const confirmConstructionAxis = () => {
    if (readOnly) return readOnlyNotice();
    try {
      const common = { name: command.name, visible: command.visible };
      const points = [[command.x1, command.y1, command.z1], [command.x2, command.y2, command.z2]];
      const axis = command.axisType === 'edge'
        ? createEdgeAxis({ ...common, points, topologyId: command.topologyId, bodyId: command.bodyId })
        : command.axisType === 'cylinder'
          ? createCylinderAxis({ ...common, origin: [command.origin0, command.origin1, command.origin2], direction: [command.direction0, command.direction1, command.direction2], topologyId: command.topologyId, bodyId: command.bodyId })
          : command.axisType === 'plane-intersection'
            ? createPlaneIntersectionAxis({ ...common, planeIds: [command.planeId1, command.planeId2] })
            : createTwoPointAxis({ ...common, points });
      if (command.editId) axis.id = command.editId;
      resolveConstructionAxis(axis, document.references, document.parameters);
      commit((next) => {
        const index = next.references.findIndex((reference) => reference.id === axis.id);
        if (index >= 0) next.references[index] = axis;
        else next.references.push(axis);
      });
      setSelection({ kind: 'constructionAxis', id: axis.id });
      setCommand(null);
      setNotice(`${axis.name} została zapisana jako trwała oś konstrukcyjna.`);
    } catch (error) {
      setNotice(`Nie udało się utworzyć osi: ${error.message}`);
    }
  };

  const openConstructionPoint = (pointType = 'vertex', point = null) => {
    if (readOnly) return readOnlyNotice();
    const selectedItem = selection?.items?.[0] || selection;
    const body = engine.bodies.find((candidate) => candidate.id === selectedItem?.bodyId);
    const topologyKey = selectedItem?.kind === 'vertex' ? 'vertices' : selectedItem?.kind === 'edge' ? 'edges' : 'faces';
    const topologyRecord = body?.topology?.[topologyKey]?.find((record) => record.id === selectedItem?.id);
    const endpoints = topologyRecord?.descriptor?.endpoints;
    const selectedPosition = topologyRecord?.descriptor?.point
      || topologyRecord?.descriptor?.axisOrigin
      || topologyRecord?.descriptor?.center
      || (endpoints?.length === 2 ? endpoints[0].map((value, axis) => (value + endpoints[1][axis]) / 2) : null);
    const position = point?.position || selectedPosition || [0, 0, 0];
    const topologyCompatible = pointType === 'vertex' ? selectedItem?.kind === 'vertex' : pointType === 'center' && ['face', 'edge'].includes(selectedItem?.kind);
    const axisOptions = document.references.filter((reference) => reference.kind === 'construction-axis');
    const planeOptions = document.references.filter((reference) => reference.kind === 'construction-plane');
    const defaultNames = { vertex: 'Punkt na wierzchołku', center: 'Punkt środka', intersection: 'Punkt przecięcia' };
    setCommand({
      type: 'constructionPoint', pointType, editId: point?.id || null,
      name: point?.name || `${defaultNames[pointType]} ${document.references.filter((reference) => reference.kind === 'construction-point').length + 1}`,
      position0: String(position[0]), position1: String(position[1]), position2: String(position[2]),
      axisOptions, planeOptions, axisId: point?.axisId || axisOptions[0]?.id || '', planeId: point?.planeId || planeOptions[0]?.id || '',
      topologyId: point?.topologyId || (topologyCompatible ? topologyRecord?.id : null) || null, bodyId: point?.bodyId || (topologyCompatible ? body?.id : null) || null,
      topologyKind: point?.topologyKind || (selectedItem?.kind === 'edge' ? 'edge' : selectedItem?.kind === 'face' ? 'face' : 'vertex'),
      visible: point?.visible ?? true,
    });
    setNotice(point ? `Edytujesz ${point.name}.` : `Ustaw parametry: ${defaultNames[pointType].toLowerCase()}.`);
  };

  const confirmConstructionPoint = () => {
    if (readOnly) return readOnlyNotice();
    try {
      const common = { name: command.name, visible: command.visible };
      const position = [command.position0, command.position1, command.position2];
      const point = command.pointType === 'center'
        ? createCenterPoint({ ...common, position, topologyId: command.topologyId, bodyId: command.bodyId, topologyKind: ['face', 'edge'].includes(command.topologyKind) ? command.topologyKind : 'face' })
        : command.pointType === 'intersection'
          ? createIntersectionPoint({ ...common, axisId: command.axisId, planeId: command.planeId })
          : createVertexPoint({ ...common, position, topologyId: command.topologyId, bodyId: command.bodyId });
      if (command.editId) point.id = command.editId;
      resolveConstructionPoint(point, document.references, document.parameters, engine.bodies);
      commit((next) => {
        const index = next.references.findIndex((reference) => reference.id === point.id);
        if (index >= 0) next.references[index] = point;
        else next.references.push(point);
      });
      setSelection({ kind: 'constructionPoint', id: point.id });
      setCommand(null);
      setNotice(`${point.name} został zapisany jako trwały punkt konstrukcyjny.`);
    } catch (error) {
      setNotice(`Nie udało się utworzyć punktu: ${error.message}`);
    }
  };

  const confirmFeature = () => {
    if (readOnly) return readOnlyNotice();
    if (!command?.previewFeature) return;
    commit((next) => {
      if (command.editId) {
        const index = next.features.findIndex((feature) => feature.id === command.editId);
        next.features[index] = command.previewFeature;
      } else {
        next.features.push(command.previewFeature);
        for (const reference of command.topologyReferences || []) {
          if (next.references.some((item) => item.id === reference.id)) continue;
          next.references.push({ ...reference, ownerFeatureId: command.previewFeature.id });
        }
      }
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
    if (selection?.kind === 'constructionPlane') {
      const plane = document.references.find((reference) => reference.id === selection.id && reference.kind === 'construction-plane');
      return plane ? openConstructionPlane(plane.planeType, plane) : undefined;
    }
    if (selection?.kind === 'constructionAxis') {
      const axis = document.references.find((reference) => reference.id === selection.id && reference.kind === 'construction-axis');
      return axis ? openConstructionAxis(axis.axisType, axis) : undefined;
    }
    if (selection?.kind === 'constructionPoint') {
      const point = document.references.find((reference) => reference.id === selection.id && reference.kind === 'construction-point');
      return point ? openConstructionPoint(point.pointType, point) : undefined;
    }
    if (selection?.kind !== 'feature') return;
    const feature = document.features.find((item) => item.id === selection.id);
    if (!feature) return;
    const profile = document.sketches.flatMap((sketch) => sketch.profiles).find((item) => feature.profileIds?.includes(item.id) || feature.profileId === item.id);
    if (profile) setSelection({ kind: 'profile', id: profile.id });
    if (feature.type === 'extrude') setCommand({ type: 'extrude', editId: feature.id, distance: feature.distance, secondDistance: feature.secondDistance || feature.distance, extent: feature.extent || 'one-side', operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'boolean') setCommand({ type: 'boolean', editId: feature.id, operation: feature.operation, targetBodyId: feature.targetBodyId, toolBodyId: feature.toolBodyId, targetName: feature.targetBodyId, toolName: feature.toolBodyId, previewFeature: feature });
    else if (feature.type === 'primitive') setCommand({ type: 'primitive', editId: feature.id, name: feature.name, primitiveType: feature.primitiveType, x: feature.x, y: feature.y, z: feature.z, width: feature.width || '20', depth: feature.depth || '20', height: feature.height || '20', radius: feature.radius || '10', majorRadius: feature.majorRadius || '15', minorRadius: feature.minorRadius || '4', previewFeature: feature });
    else if (feature.type === 'transform') setCommand({ type: 'transform', editId: feature.id, targetBodyId: feature.targetBodyId, mode: feature.mode, x: feature.x || '0', y: feature.y || '0', z: feature.z || '0', angle: feature.angle || '0', originX: feature.originX || '0', originY: feature.originY || '0', originZ: feature.originZ || '0', previewFeature: feature });
    else if (feature.type === 'offsetFace') setCommand({ type: 'offsetFace', editId: feature.id, targetBodyId: feature.targetBodyId, distance: feature.distance, faceLabel: '1 wskazana', previewFeature: feature });
    else if (feature.type === 'textSolid') setCommand({ type: 'textSolid', editId: feature.id, text: feature.text, fontSize: feature.fontSize, depth: feature.depth, x: feature.x || '0', y: feature.y || '0', z: feature.z || '0', operation: feature.operation, targetBodyId: feature.targetBodyId || null, previewFeature: feature });
    else if (feature.type === 'hole') {
      const holeOptions = { holeType: feature.holeType || 'simple', extent: feature.extent || 'distance', diameter: feature.diameter, depth: feature.depth || '10', counterboreDiameter: feature.counterboreDiameter || '10', counterboreDepth: feature.counterboreDepth || '3', countersinkDiameter: feature.countersinkDiameter || '10', countersinkAngle: feature.countersinkAngle || '90', threadMode: feature.threadMode || 'none', threadDiameter: feature.threadDiameter || '10', threadPitch: feature.threadPitch || '1.5', threadLength: feature.threadLength || feature.depth || '8', threadDirection: feature.threadDirection || 'right', clearanceProfile: feature.clearanceProfile || 'nominal', clearance: feature.clearance || '0.2' };
      setCommand(feature.placement === 'face-edges'
        ? { type: 'hole', placement: 'face-edges', editId: feature.id, targetBodyId: feature.targetBodyId, firstOffset: feature.firstOffset, secondOffset: feature.secondOffset, ...holeOptions, previewFeature: feature }
        : { type: 'hole', editId: feature.id, ...holeOptions, previewFeature: feature });
    }
    else if (feature.type === 'shell') setCommand({ type: 'shell', editId: feature.id, thickness: feature.thickness, faceCount: feature.referenceIds?.length || 0, previewFeature: feature });
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

  const chooseModelImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const originalFormat = file.name.split('.').pop()?.toLowerCase();
    if (!['step', 'stp', 'stl', '3mf'].includes(originalFormat)) {
      setNotice('Import obsługuje pliki STEP, STL i 3MF.');
      return;
    }
    try {
      const sourceBuffer = await file.arrayBuffer();
      let importFormat = originalFormat === 'step' || originalFormat === 'stp' ? 'step' : 'stl';
      let buffer = sourceBuffer;
      let detectedUnit = 'millimeter';
      if (originalFormat === '3mf') {
        detectedUnit = inspectThreeMfArchive(sourceBuffer).unit;
        const group = new ThreeMFLoader().parse(sourceBuffer);
        group.updateMatrixWorld(true);
        const exported = new STLExporter().parse(group, { binary: true });
        buffer = exported.buffer.slice(exported.byteOffset, exported.byteOffset + exported.byteLength);
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      setImportDraft({
        fileName: file.name,
        name: file.name.replace(/\.(step|stp|stl|3mf)$/i, ''),
        originalFormat: originalFormat === 'stp' ? 'step' : originalFormat,
        importFormat,
        dataBase64: btoa(binary),
        sourceUnit: originalFormat === '3mf' ? detectedUnit : 'auto',
      });
      setNotice(`Wczytano ${file.name}. Potwierdź jednostkę źródłową.`);
    } catch (error) {
      setNotice(`Nie udało się odczytać modelu: ${error.message}`);
    }
  };

  const confirmModelImport = () => {
    if (!importDraft || readOnly) return;
    const unitScale = { auto: 1, millimeter: 1, centimeter: 10, inch: 25.4, meter: 1000, micron: 0.001 }[importDraft.sourceUnit] || 1;
    const feature = createFeature('importedModel', {
      name: importDraft.name || 'Model importowany',
      originalFormat: importDraft.originalFormat,
      importFormat: importDraft.importFormat,
      dataBase64: importDraft.dataBase64,
      sourceUnit: importDraft.sourceUnit,
      unitScale,
    });
    commit((next) => next.features.push(feature));
    setSelection({ kind: 'feature', id: feature.id });
    setImportDraft(null);
    setWorkspace('solid');
    setNotice(`Zaimportowano ${importDraft.fileName} i przeliczono geometrię do milimetrów.`);
  };

  const chooseSketchImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeSketchId || readOnly) return;
    const format = file.name.split('.').pop()?.toLowerCase();
    if (!['svg', 'dxf'].includes(format)) {
      setNotice('Import szkicu obsługuje pliki SVG i DXF.');
      return;
    }
    try {
      const text = await file.text();
      const inspected = inspectSketchImport(text, format);
      setSketchImportDraft({ fileName: file.name, format, text, detectedUnit: inspected.detectedUnit, sourceUnit: 'auto' });
      setNotice(`Wczytano ${file.name}. Potwierdź jednostkę przed dodaniem geometrii.`);
    } catch (error) {
      setNotice(`Nie udało się odczytać szkicu: ${error.message}`);
    }
  };

  const confirmSketchImport = () => {
    if (!sketchImportDraft || !activeSketchId || readOnly) return;
    try {
      const imported = parseSketchImport(sketchImportDraft.text, sketchImportDraft.format, { sourceUnit: sketchImportDraft.sourceUnit });
      commit((next) => {
        const targetSketch = next.sketches.find((item) => item.id === activeSketchId);
        if (!targetSketch) throw new Error('Aktywny szkic nie istnieje.');
        targetSketch.entities.push(...imported.entities);
        refreshDetectedSketchProfiles(targetSketch, next.parameters);
      });
      setSketchImportDraft(null);
      setSelection({ kind: 'sketch', id: activeSketchId });
      setNotice(`Zaimportowano ${imported.curveCount} elementów z ${sketchImportDraft.fileName} · ${imported.profiles.length} profili · jednostka ${imported.sourceUnit}.`);
    } catch (error) {
      setNotice(`Import szkicu nie powiódł się: ${error.message}`);
    }
  };

  const exportModel = async (format) => {
    setNotice(`Przygotowywanie pliku ${format.toUpperCase()}…`);
    try {
      const buffers = await engine.exportModel(format);
      const extension = format === 'step' ? 'step' : format;
      const mime = format === 'stl' ? 'model/stl' : format === '3mf' ? 'model/3mf' : 'model/step';
      buffers.forEach((buffer, index) => downloadBlob(new Blob([buffer], { type: mime }), `${safeName(document.name)}${buffers.length > 1 ? `-${index + 1}` : ''}.${extension}`));
      setNotice(`Wyeksportowano ${format.toUpperCase()} z dokładnej bryły B-Rep.`);
    } catch (error) {
      setNotice(`Eksport nie powiódł się: ${error.message}`);
    }
  };

  const sendToSlicer = async (slicer) => {
    const slicerNames = { bambu: 'Bambu Studio', prusa: 'PrusaSlicer', cura: 'UltiMaker Cura' };
    const name = slicerNames[slicer] || slicer;
    setNotice(`Przygotowywanie STL dla ${name}…`);
    try {
      const buffers = await engine.exportModel('stl');
      if (!window.desktopApp?.sendToSlicer) {
        buffers.forEach((buffer, index) => downloadBlob(new Blob([buffer], { type: 'model/stl' }), `${safeName(document.name)}${buffers.length > 1 ? `-${index + 1}` : ''}.stl`));
        setNotice(`Pobrano STL. Otwórz plik ręcznie w ${name}.`);
        return;
      }
      const result = await window.desktopApp.sendToSlicer({
        slicer,
        files: buffers.map((buffer, index) => ({ name: `${safeName(document.name)}${buffers.length > 1 ? `-${index + 1}` : ''}.stl`, data: new Uint8Array(buffer) })),
      });
      if (!result?.ok) throw new Error(result?.error || `Nie udało się uruchomić ${name}.`);
      setNotice(`Przekazano ${buffers.length} ${buffers.length === 1 ? 'plik' : 'pliki'} STL do ${name}.`);
    } catch (error) {
      setNotice(`Przekazanie do ${name} nie powiodło się: ${error.message}`);
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
      const textEntry = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable;
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
      if (event.key === 'Enter' && command?.type === 'moveSketch') {
        event.preventDefault();
        confirmSketchMove();
        return;
      }
      if (event.key === 'Enter' && command?.type === 'offsetSketch') {
        event.preventDefault();
        confirmSketchOffset();
        return;
      }
      if (event.key === 'Enter' && command?.type === 'cornerSketch') {
        event.preventDefault();
        confirmSketchCorner();
        return;
      }
      if (event.key === 'Enter' && command?.type === 'transformSketch') {
        event.preventDefault();
        confirmSketchTransform();
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
      if (event.key === 'Delete' && !textEntry && !command && activeSketchId && (selectedSketchEntityIds.length || selectedSketchConstraintId) && !readOnly) {
        event.preventDefault();
        deleteSelectedSketchEntities();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'e' && selectedProfile && !activeSketchId && !readOnly) {
        event.preventDefault();
        openExtrude();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [command, selectedProfile, activeSketchId, selectedSketchEntityIds, selectedSketchConstraintId, readOnly, history]);

  const timelineStatus = new Map(engine.timeline?.map((item) => [item.id, item]));
  let directManipulator = null;
  if (command?.type === 'transform') {
    const body = engine.bodies.find((item) => item.id === command.targetBodyId) || engine.bodies[0];
    const origin = body?.metrics?.centerOfMass || [0, 0, 0];
    if (command.mode === 'move') directManipulator = { kind: 'move', value: command.x, origin, axis: [1, 0, 0], min: -100000, max: 100000, label: 'Przesuń bryłę', hint: 'Przeciągnij wspólny uchwyt, aby przesunąć bryłę w osi X', onCommit: (value) => updateCommand({ x: String(value) }) };
    else directManipulator = { kind: 'rotate', value: command.angle, origin, axis: [0, 0, 1], min: -360, max: 360, label: 'Obróć bryłę', hint: 'Przeciągnij wspólny uchwyt, aby ustawić obrót wokół osi Z', onCommit: (value) => updateCommand({ angle: String(value) }) };
  } else if (command?.type === 'offsetFace') {
    const referenceId = command.previewFeature?.referenceIds?.[0];
    const reference = command.topologyReferences?.[0] || document.references.find((item) => item.id === referenceId);
    directManipulator = { kind: 'offsetFace', value: command.distance, origin: reference?.descriptor?.center || [0, 0, 0], axis: reference?.descriptor?.normal || [0, 0, 1], min: -100000, max: 100000, label: 'Offset Face', hint: 'Przeciągnij wspólny uchwyt, aby odsunąć wskazaną ścianę', onCommit: (value) => updateCommand({ distance: String(value) }) };
  }
  const sketch = document.sketches.find((item) => item.id === activeSketchId);
  const draftProfile = command?.type === 'rectangle' && command.definition === 'center'
    ? { type: 'rectangle', geometry: { width: command.width, height: command.height, x: command.x, y: command.y } }
    : command?.type === 'circle' && command.definition === 'centerRadius'
      ? { type: 'circle', geometry: { diameter: command.diameter, x: command.x, y: command.y } }
      : null;

  return (
    <section className="modeling-shell" aria-label="Modelowanie parametryczne MadCAD">
      <header className="modeling-titlebar">
        <div className="app-menu"><div className="brand-mark">M</div><button type="button" title="Dokumentacja" onClick={onClose}><Home size={16} /></button><button className={browserOpen ? 'active' : ''} type="button" title="Pokaż lub ukryj przeglądarkę" onClick={() => setBrowserOpen((open) => !open)}><Grid2X2 size={16} /></button><button type="button" title="Nowy projekt" onClick={createNew}><FilePlus2 size={16} /></button><button type="button" title="Otwórz projekt" onClick={() => fileInputRef.current?.click()}><FolderOpen size={16} /></button><button type="button" title={readOnly ? 'Zapis jest zablokowany dla projektu z nowszej wersji.' : 'Zapisz'} disabled={readOnly} onClick={saveProject}><Save size={16} /></button></div>
        <input ref={fileInputRef} hidden type="file" accept=".madcad,.json,application/json" onChange={openProject} />
        <input ref={importInputRef} hidden type="file" accept=".step,.stp,.stl,.3mf,model/step,model/stl,model/3mf" onChange={chooseModelImport} />
        <input ref={sketchImportInputRef} hidden type="file" accept=".svg,.dxf,image/svg+xml,application/dxf" onChange={chooseSketchImport} />
        <div className="document-tab"><Box size={15} /><input value={document.name} aria-label="Nazwa projektu" disabled={readOnly} onChange={(event) => commit((next) => { next.name = event.target.value; })} />{readOnly ? <span className="read-only-badge">TYLKO ODCZYT · v{documentAccess.sourceVersion}</span> : <span>*</span>}<button type="button" title="Zamknij dokument" onClick={onClose}><X size={13} /></button></div>
        <div className="title-actions"><button type="button" disabled={readOnly || !history.canUndo} onClick={history.undo} title="Cofnij"><Undo2 size={15} /></button><button type="button" disabled={readOnly || !history.canRedo} onClick={history.redo} title="Ponów"><Redo2 size={15} /></button><button type="button" title="Samouczek pierwszej części" aria-label="Samouczek pierwszej części" onClick={() => setTutorialOpen(true)}><CircleHelp size={15} /><span>Samouczek</span></button><button type="button" title="Dokumentacja 2D" onClick={onClose}><AppWindow size={15} /><span>Dokumentacja</span></button></div>
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
                <RibbonGroup label="UTWÓRZ"><ToolButton icon={Minus} label="Linia" onClick={() => openSketchPath('line')} primary disabled={readOnly} /><ToolButton icon={Move} label="Polilinia" onClick={() => openSketchPath('polyline')} disabled={readOnly} /><ToolButton icon={RotateCw} label="Łuk styczny" onClick={() => setCommand((current) => current?.type === 'polyline' ? { ...current, segmentMode: 'tangentArc' } : current)} disabled={readOnly || command?.type !== 'polyline' || !command.segmentIds.length} /><ToolButton icon={Rotate3d} label="Łuk" onClick={() => openMechanicalShape('arc')} disabled={readOnly} /><ToolButton icon={Square} label="Prostokąt" onClick={() => openProfileCommand('rectangle')} disabled={readOnly} /><ToolButton icon={Circle} label="Okrąg" onClick={() => openProfileCommand('circle')} disabled={readOnly} /><ToolButton icon={Hexagon} label="Wielokąt" onClick={() => openMechanicalShape('polygon')} disabled={readOnly} /><ToolButton icon={Shapes} label="Elipsa" onClick={() => openMechanicalShape('ellipse')} disabled={readOnly} /><ToolButton icon={Frame} label="Slot" onClick={() => openMechanicalShape('slot')} disabled={readOnly} /><ToolButton icon={ScanSearch} label="Spline" onClick={() => openMechanicalShape('spline')} disabled={readOnly} /><ToolButton icon={ScanSearch} label="Conic" onClick={() => openMechanicalShape('conic')} disabled={readOnly} /><ToolButton icon={CircleDotDashed} label="Punkt" onClick={() => openMechanicalShape('point')} disabled={readOnly} /><ToolButton icon={Upload} label="Import SVG/DXF" onClick={() => sketchImportInputRef.current?.click()} disabled={readOnly} /></RibbonGroup>
                <RibbonGroup label="EDYTUJ"><ToolButton icon={MousePointer2} label="Wybierz" onClick={() => { setCommand(null); handleSketchSelection([], 'replace'); }} /><ToolButton icon={Scissors} label="Trim" onClick={() => setCommand((current) => current?.type === 'trimSketch' ? null : { type: 'trimSketch' })} primary={command?.type === 'trimSketch'} disabled={readOnly} /><ToolButton icon={Maximize2} label="Extend" onClick={() => setCommand((current) => current?.type === 'extendSketch' ? null : { type: 'extendSketch' })} primary={command?.type === 'extendSketch'} disabled={readOnly} /><ToolButton icon={Minus} label="Break" onClick={() => setCommand((current) => current?.type === 'breakSketch' ? null : { type: 'breakSketch' })} primary={command?.type === 'breakSketch'} disabled={readOnly} /><ToolButton icon={ScanSearch} label="Project" onClick={projectSelectedTopology} primary={command?.type === 'projectSketch'} disabled={readOnly} /><ToolButton icon={Copy} label="Offset" onClick={openSketchOffset} disabled={readOnly || (!selectedSketchEntityIds.length && !activeOffsetProfile)} /><ToolButton icon={CircleDotDashed} label="Fillet szkicu" onClick={() => openSketchCorner('fillet')} disabled={readOnly || selectedSketchEntityIds.length !== 2} /><ToolButton icon={Triangle} label="Faza szkicu" onClick={() => openSketchCorner('chamfer')} disabled={readOnly || selectedSketchEntityIds.length !== 2} /><ToolButton icon={RotateCw} label="Transformuj" onClick={openSketchTransform} disabled={readOnly || !selectedSketchEntityIds.length} /><ToolButton icon={Move3d} label="Przesuń" onClick={openSketchMove} disabled={readOnly || !selectedSketchEntityIds.length} /><ToolButton icon={X} label="Usuń" onClick={deleteSelectedSketchEntities} disabled={readOnly || (!selectedSketchEntityIds.length && !selectedSketchConstraintId)} /></RibbonGroup>
                <RibbonGroup label="WIĘZY"><ToolButton icon={Minus} label="Współliniowe" onClick={() => addSelectedSketchConstraint('collinear')} disabled={readOnly || !canAddCollinear} /><ToolButton icon={Frame} label="Symetria" onClick={() => addSelectedSketchConstraint('symmetry')} disabled={readOnly || !canAddSymmetry} /></RibbonGroup>
                <RibbonGroup label="SZKIC" end><ToolButton icon={Check} label="Zakończ szkic" onClick={finishSketch} primary /></RibbonGroup>
              </>
            ) : workspace === 'print' ? (
              <>
                <RibbonGroup label="PRZYGOTUJ"><ToolButton icon={Printer} label="Kontrola druku" primary onClick={() => setWorkspace('print')} /></RibbonGroup>
                <RibbonGroup label="EKSPORT"><ToolButton icon={HardDriveDownload} label="STL" onClick={() => exportModel('stl')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={FileBox} label="STEP" onClick={() => exportModel('step')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={FileDown} label="3MF" onClick={() => exportModel('3mf')} disabled={!engine.bodies.length || engine.status !== 'ready'} /></RibbonGroup>
              </>
            ) : (
              <>
                <RibbonGroup label="UTWÓRZ"><ToolButton icon={PencilRuler} label="Utwórz szkic" onClick={startSketch} primary disabled={readOnly} /><ToolButton icon={Box} label="Wyciągnij" onClick={openExtrude} disabled={readOnly || !selectedProfile} /><ToolButton icon={Box} label="Prymityw" onClick={openPrimitive} disabled={readOnly} /><ToolButton icon={Type} label="Tekst 3D" onClick={openTextSolid} disabled={readOnly} /><ToolButton icon={Shapes} label="Boolean" onClick={openBoolean} disabled={readOnly || selectedBodyIds.length !== 2} /><ToolButton icon={Cylinder} label="Otwór" onClick={openHole} disabled={readOnly || (!hasHoleReference && !hasFaceEdgeHoleReference) || !engine.bodies.length} /></RibbonGroup>
                <RibbonGroup label="ZMIANA"><ToolButton icon={CircleDotDashed} label="Zaokrąglij" onClick={() => openEdgeCommand('fillet')} disabled={readOnly || !selectedEdgeItems.length} /><ToolButton icon={Triangle} label="Fazuj" onClick={() => openEdgeCommand('chamfer')} disabled={readOnly || !selectedEdgeItems.length} /><ToolButton icon={Layers3} label="Shell" onClick={openShell} disabled={readOnly || !selectedFaceItems.length} /><ToolButton icon={Layers3} label="Offset Face" onClick={openOffsetFace} disabled={readOnly || selectedFaceItems.length !== 1} /><ToolButton icon={Move3d} label="Przesuń bryłę" onClick={() => openTransform('move')} disabled={readOnly || selection?.kind !== 'body'} /><ToolButton icon={Rotate3d} label="Obróć bryłę" onClick={() => openTransform('rotate')} disabled={readOnly || selection?.kind !== 'body'} /><ToolButton icon={PencilRuler} label="Edytuj" onClick={editSelection} disabled={readOnly || !['sketch', 'profile', 'feature', 'constructionPlane', 'constructionAxis', 'constructionPoint'].includes(selection?.kind)} /></RibbonGroup>
                <RibbonGroup label="KONSTRUKCJA"><ToolButton icon={Frame} label="Płaszczyzna offset" onClick={() => openConstructionPlane('offset')} disabled={readOnly} /><ToolButton icon={Layers3} label="Midplane" onClick={() => openConstructionPlane('midplane')} disabled={readOnly} /><ToolButton icon={Triangle} label="Plane 3 punkty" onClick={() => openConstructionPlane('three-points')} disabled={readOnly} /><ToolButton icon={Minus} label="Oś z krawędzi" onClick={() => openConstructionAxis('edge')} disabled={readOnly} /><ToolButton icon={Cylinder} label="Oś walca" onClick={() => openConstructionAxis('cylinder')} disabled={readOnly} /><ToolButton icon={Move3d} label="Oś 2 punkty" onClick={() => openConstructionAxis('two-points')} disabled={readOnly} /><ToolButton icon={Layers3} label="Oś przecięcia" onClick={() => openConstructionAxis('plane-intersection')} disabled={readOnly || document.references.filter((reference) => reference.kind === 'construction-plane').length < 2} /><ToolButton icon={CircleDotDashed} label="Punkt wierzchołka" onClick={() => openConstructionPoint('vertex')} disabled={readOnly} /><ToolButton icon={CircleDotDashed} label="Punkt centrum" onClick={() => openConstructionPoint('center')} disabled={readOnly} /><ToolButton icon={CircleDotDashed} label="Punkt przecięcia" onClick={() => openConstructionPoint('intersection')} disabled={readOnly || !document.references.some((reference) => reference.kind === 'construction-axis') || !document.references.some((reference) => reference.kind === 'construction-plane')} /><ToolButton icon={Variable} label="Parametry" onClick={() => setCommand({ type: 'parameters' })} disabled={readOnly} /></RibbonGroup>
                <RibbonGroup label="INSPECT"><ToolButton icon={Ruler} label="Zmierz" onClick={openMeasure} /><ToolButton icon={ScanSearch} label="Przekrój" onClick={openSectionAnalysis} disabled={!engine.bodies.length} /><ToolButton icon={Box} label="Masa" onClick={openMassProperties} disabled={!engine.bodies.length} /><ToolButton icon={AlertTriangle} label="Analiza" onClick={openGeometryInspection} disabled={!engine.bodies.length} /></RibbonGroup>
                <RibbonGroup label="WSTAW"><ToolButton icon={Upload} label="Import 3D" onClick={() => importInputRef.current?.click()} disabled={readOnly} /></RibbonGroup>
                <RibbonGroup label="WYBIERZ"><ToolButton icon={MousePointer2} label="Wybierz" onClick={() => setSelection({ kind: 'document', id: document.id })} /></RibbonGroup>
                <RibbonGroup label="EKSPORT" end><ToolButton icon={FileDown} label="STL" onClick={() => exportModel('stl')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={FileBox} label="STEP" onClick={() => exportModel('step')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={FileDown} label="3MF" onClick={() => exportModel('3mf')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={Printer} label="Druk 3D" onClick={() => switchWorkspace('print')} /></RibbonGroup>
              </>
            )}
          </div>
        </div>
      </section>

      <div className={`modeling-content ${workspace === 'print' ? 'with-print-panel' : ''} ${browserOpen ? '' : 'without-browser'}`}>
        {browserOpen && <ProjectBrowser document={document} bodies={engine.bodies} selection={selection} activeSketchId={activeSketchId} onSelect={handleBrowserSelection} onToggleReference={toggleConstructionVisibility} onClose={() => setBrowserOpen(false)} />}
        <main className="modeling-stage">
          <ModelViewport
            bodies={engine.bodies}
            sketches={document.sketches}
            activeSketchId={activeSketchId}
            draftProfile={draftProfile}
            draftType={(command?.type === 'rectangle' && command.definition === 'center') || (command?.type === 'circle' && command.definition === 'centerRadius') ? command.type : null}
            onDraftChange={readOnly ? undefined : updateCommand}
            sketchTool={command?.type === 'line' || command?.type === 'polyline' ? command.type : null}
            polylineDraft={command?.type === 'line' || command?.type === 'polyline' ? { lastPoint: command.lastPoint } : null}
            onSketchPoint={readOnly ? undefined : appendSketchPoint}
            selectedSketchEntityIds={selectedSketchEntityIds}
            lostProjectedEntityIds={lostProjectedEntityIds}
            selectedSketchConstraintId={selectedSketchConstraintId}
            onSketchSelection={handleSketchSelection}
            onSketchConstraintSelection={(constraintId) => setSelection({ kind: 'sketchConstraint', id: constraintId, sketchId: activeSketchId })}
            onSketchConstraintValueChange={updateSketchConstraintValue}
            sketchModifierMode={command?.type === 'trimSketch' ? 'trim' : command?.type === 'extendSketch' ? 'extend' : command?.type === 'breakSketch' ? 'break' : command?.type === 'projectSketch' ? 'project' : null}
            onSketchModify={modifySketchAtPoint}
            onSketchProfileSelection={(profileId) => setSelection({ kind: 'profile', id: profileId, sketchId: activeSketchId })}
            onSketchMove={readOnly ? undefined : moveSketchEntities}
            showSketchPoints={sketchOptions.points}
            showSketchProfiles={sketchOptions.profiles}
            showSketchConstraints={sketchOptions.constraints}
            showSketchDimensions={sketchOptions.dimensions}
            showConstructionGeometry={sketchOptions.construction}
            showProjectedGeometry={sketchOptions.projected}
            sliceModel={sketchOptions.slice}
            sectionAnalysis={sectionAnalysis}
            parameters={document.parameters}
            showGrid={!activeSketchId || sketchOptions.grid}
            selectedBodyId={selection?.kind === 'body' ? selection.id : (selection?.bodyId || null)}
            selectedBodyIds={selectedBodyIds}
            onSelectBody={(id) => setSelection(id ? { kind: 'body', id } : { kind: 'document', id: document.id })}
            selectedTopologyIds={selectedTopologyIds}
            onSelectTopology={handleTopologySelection}
            constructionPlanes={constructionPlanes}
            constructionAxes={constructionAxes}
            constructionPoints={constructionPoints}
            selectedConstructionId={selection?.kind === 'constructionPlane' ? selection.id : null}
            selectedConstructionAxisId={selection?.kind === 'constructionAxis' ? selection.id : null}
            selectedConstructionPointId={selection?.kind === 'constructionPoint' ? selection.id : null}
            selectedProfile={selectedProfile}
            selectedProfilePlane={selectedProfileMatch?.sketch.plane || 'XY'}
            selectedProfilePlaneOffset={Number(selectedProfileMatch?.sketch.planeOffset || 0)}
            directExtrudeDistance={command?.type === 'extrude' ? command.distance : 0}
            onDirectExtrude={readOnly ? undefined : beginOrUpdateExtrude}
            directManipulator={readOnly ? null : directManipulator}
            snapEnabled={sketchOptions.snap}
            snapThresholdPx={sketchOptions.snapDistance}
            bed={document.print}
            showBed={workspace === 'print'}
            printLayout={document.print}
          />
          <div className={`engine-status ${engine.status}`}><span />{engine.status === 'ready' ? `${command?.previewFeature ? 'Podgląd' : 'Model'} gotowy · ${engine.bodies.length} ${engine.bodies.length === 1 ? 'bryła' : 'brył'}` : engine.status === 'computing' ? 'Przeliczanie historii…' : engine.status === 'loading' ? 'Uruchamianie OpenCascade…' : engine.error}</div>
          <TopologyReferenceRepairPanel items={lostTopologyReferences} selection={selection} onReassign={repairTopologyReference} />
          {command?.type === 'measure' && <MeasurePanel measurement={measurement} onClose={() => setCommand(null)} />}
          {command?.type === 'sectionAnalysis' && sectionAnalysis && <SectionPanel analysis={sectionAnalysis} onChange={(patch) => setSectionAnalysis((current) => ({ ...current, ...patch }))} onClose={closeSectionAnalysis} />}
          {command?.type === 'massProperties' && <MassPropertiesPanel density={command.density} result={massProperties?.result} error={massProperties?.error} onDensityChange={(density) => setCommand((current) => ({ ...current, density }))} onClose={() => setCommand(null)} />}
          {command?.type === 'geometryInspection' && <GeometryInspectionPanel result={geometryInspection} onClose={() => setCommand(null)} />}
          {!document.sketches.length && !engine.bodies.length && !command && !readOnly && (
            <div className="empty-canvas"><PencilRuler size={28} /><strong>Zacznij od szkicu</strong><span>Wybierz płaszczyznę, narysuj zamknięty profil i wyciągnij go w bryłę.</span><button type="button" onClick={startSketch}>Utwórz szkic</button></div>
          )}
          {command?.type === 'plane' && <PlanePicker onPick={pickPlane} onCancel={() => { setCommand(null); setWorkspace('solid'); }} />}
          <CommandDialog
            command={command}
            profileName={selectedProfile?.name || ''}
            onChange={updateCommand}
            onConfirm={command?.type === 'rectangle' || command?.type === 'circle' ? confirmProfile : command?.type === 'point' ? confirmSketchPoint : ['arc', 'polygon', 'ellipse', 'slot', 'spline', 'conic'].includes(command?.type) ? confirmMechanicalShape : command?.type === 'line' || command?.type === 'polyline' ? confirmExactSketchSegment : command?.type === 'moveSketch' ? confirmSketchMove : command?.type === 'offsetSketch' ? confirmSketchOffset : command?.type === 'cornerSketch' ? confirmSketchCorner : command?.type === 'transformSketch' ? confirmSketchTransform : ['offsetPlane', 'midplanePlane', 'threePointPlane'].includes(command?.type) ? confirmConstructionPlane : command?.type === 'constructionAxis' ? confirmConstructionAxis : command?.type === 'constructionPoint' ? confirmConstructionPoint : confirmFeature}
            onCancel={command?.type === 'line' || command?.type === 'polyline' ? finishSketchPath : () => setCommand(null)}
            onUndoSegment={undoSketchSegment}
            onFinishPath={finishSketchPath}
          />
          <ImportModelDialog draft={importDraft} onChange={(patch) => setImportDraft((current) => ({ ...current, ...patch }))} onConfirm={confirmModelImport} onCancel={() => setImportDraft(null)} />
          <ImportSketchDialog draft={sketchImportDraft} onChange={(patch) => setSketchImportDraft((current) => ({ ...current, ...patch }))} onConfirm={confirmSketchImport} onCancel={() => setSketchImportDraft(null)} />
          {command?.type === 'parameters' && <ParametersDialog document={document} commit={commit} onClose={() => setCommand(null)} />}
          {activeSketchId && <SketchPalette options={sketchOptions} onChange={(key, value) => setSketchOptions((current) => ({ ...current, [key]: value }))} onFinish={finishSketch} />}
        </main>
        {workspace === 'print' && <PrintPanel document={document} bodies={engine.bodies} engine={engine} selectedFace={selectedPrintFace} commit={commit} onSelectIssue={(item) => setSelection(item?.kind === 'document' ? { kind: 'document', id: document.id } : item)} onExport={exportModel} onSendToSlicer={sendToSlicer} onClose={() => switchWorkspace('solid')} readOnly={readOnly} />}
      </div>

      <footer className="modeling-footer">
        <div className="notice" role="status"><span className={`status-dot ${engine.status}`} />{engine.error || notice}</div>
        <div className="timeline" aria-label="Parametryczna oś czasu">
          <div className="timeline-controls"><button type="button" title="Zaznacz pierwszy krok parametrycznej historii." onClick={() => selectTimelineStep('start')}><SkipBack size={14} /></button><button type="button" title="Zaznacz poprzednią operację w historii." onClick={() => selectTimelineStep('previous')}><StepBack size={14} /></button><button type="button" title="Zaznacz następną operację w historii." onClick={() => selectTimelineStep('next')}><StepForward size={14} /></button></div>
          <span className="timeline-start" />
          {document.features.map((feature, index) => {
            const result = timelineStatus.get(feature.id);
            return (
              <button key={feature.id} className={`timeline-item ${selection?.kind === 'feature' && selection.id === feature.id ? 'selected' : ''} ${lostReferenceOwnerIds.has(feature.id) ? 'warning reference-lost' : result?.status || ''}`} type="button" onClick={() => setSelection({ kind: 'feature', id: feature.id })} onDoubleClick={editSelection} title={`${index + 1}. ${feature.name}${lostReferenceOwnerIds.has(feature.id) ? ' — utracona referencja topologii' : result?.error ? ` — ${result.error}` : ''}`}>
                {featureIcon(feature.type, 16)}<span>{index + 1}</span>
              </button>
            );
          })}
          <span className="timeline-end" />
        </div>
      </footer>
      {tutorialOpen && <FirstPartTutorial onClose={() => setTutorialOpen(false)} />}
    </section>
  );
}
