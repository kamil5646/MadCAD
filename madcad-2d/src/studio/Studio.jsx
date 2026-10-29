import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Check, ChevronDown, Download, Eye, EyeOff, FilePlus2, FileText, FolderOpen, Pencil, Printer, Redo2, Ruler, Save, Trash2, Undo2, X,
} from 'lucide-react';
import { createDocument, createSketch, nextSketchName, openDocument } from '../cad-core/document.js';
import { deleteSketchSelection } from '../cad-core/sketch-model.js';
import { trimSketchEntity } from '../cad-core/sketch-modifiers.js';
import { refreshDetectedSketchProfiles } from '../cad-core/sketch-topology.js';
import { sketchDxf } from '../cad-core/sketch-dxf-export.js';
import { createTopologyReference } from '../cad-core/topology-references.js';
import { moveTrackedFaceSketchSupports } from '../cad-core/face-sketch-support.js';
import { frameFromNormal } from '../cad-core/sketch-frame.js';
import { deleteTimelineFeatureCascade, insertTimelineFeature, setTimelineFeatureSuppressed } from '../cad-core/timeline-operations.js';
import { useCadEngine } from '../cad-core/useCadEngine.js';
import ModelViewport from '../modeling/ModelViewport.jsx';
import { LicenseInfoDialog, FullLicenseDialog, UpdateDialog } from '../modeling/AppDialogs.jsx';
import { DEFAULT_LICENSE_STATUS, normalizeLicenseStatus } from '../modeling/license-plan.js';
import { clearLocalAutosave, loadInitialDocument, writeLocalAutosave } from '../modeling/document-session.js';
import { downloadBlob, prepareProjectSave, readProjectFile, safeName, useDocumentHistory } from '../modeling/workspace-document.js';
import { resolveVisibleSketchId } from '../modeling/sketch-visibility.js';
import { resolveExtrudeSource } from '../modeling/extrude-source.js';
import {
  ChamferCadIcon, ExtrudeCadIcon, FilletCadIcon, FinishSketchCadIcon, HoleCadIcon, MirrorCadIcon, PatternCadIcon, PointCadIcon, RevolveCadIcon, ShellCadIcon, SketchArcCadIcon, SketchCadIcon,
  SketchCircleCadIcon, SketchConstraintCadIcon, SketchDimensionCadIcon, SketchLineCadIcon, SketchRectangleCadIcon, SketchTrimCadIcon,
} from '../modeling/CadToolIcons.jsx';
import {
  addConstraint, addDimension, addLine, addPoint, addShape, constraintAvailable, holePointIds, CONSTRAINTS, dimensionForSelection, moveEntities, setConstraintValue, tryEdit,
} from './sketch-actions.js';
import { buildFeature, commandFromFeature, commandProblem, FEATURE_LABELS, featureLabel, OPERATIONS, REPEATABLE_TYPES, revolveAxes } from './features.js';
import { attachDrawingProjections, drawingProjectionGroups } from '../cad-core/drawing-projections.js';
import { drawingSheetDxf, drawingSheetHtml } from '../cad-core/drawing-sheets.js';
import DrawingPane from './DrawingPane.jsx';
import { arrangeSheet, createStandardSheet } from './drawing.js';
import './studio.css';

const EMPTY = Object.freeze([]);
const PLANE_NAMES = Object.freeze({ XY: 'Góra (XY)', XZ: 'Przód (XZ)', YZ: 'Prawo (YZ)' });
const SKETCH_TOOLS = Object.freeze([
  { id: 'line', label: 'Linia', key: 'l', Icon: SketchLineCadIcon, points: 2, prompt: ['Kliknij początek linii', 'Kliknij koniec linii'] },
  { id: 'rectangle', label: 'Prostokąt', key: 'r', Icon: SketchRectangleCadIcon, points: 2, prompt: ['Kliknij pierwszy narożnik', 'Kliknij przeciwległy narożnik'] },
  { id: 'circle', label: 'Okrąg', key: 'c', Icon: SketchCircleCadIcon, points: 2, prompt: ['Kliknij środek okręgu', 'Kliknij punkt na okręgu'] },
  { id: 'arc', label: 'Łuk', key: 'a', Icon: SketchArcCadIcon, points: 3, prompt: ['Kliknij początek łuku', 'Kliknij koniec łuku', 'Kliknij punkt, przez który przechodzi łuk'] },
  { id: 'point', label: 'Punkt', key: 'p', Icon: PointCadIcon, points: 1, prompt: ['Kliknij miejsce punktu (np. środek otworu)'] },
  { id: 'trim', label: 'Przytnij', key: 't', Icon: SketchTrimCadIcon, prompt: ['Kliknij fragment linii do usunięcia'] },
]);
const MODEL_TOOLS = Object.freeze([
  { id: 'extrude', label: 'Wyciągnij', key: 'e', Icon: ExtrudeCadIcon },
  { id: 'revolve', label: 'Obróć', Icon: RevolveCadIcon },
  { id: 'fillet', label: 'Zaokrąglij', key: 'f', Icon: FilletCadIcon },
  { id: 'chamfer', label: 'Fazuj', Icon: ChamferCadIcon },
  { id: 'shell', label: 'Skorupa', Icon: ShellCadIcon },
  { id: 'hole', label: 'Otwór', key: 'h', Icon: HoleCadIcon },
  { id: 'pattern', label: 'Szyk', Icon: PatternCadIcon },
  { id: 'mirror', label: 'Lustro', Icon: MirrorCadIcon },
]);
const PLANE_OPTIONS = Object.freeze([{ id: 'XY', label: 'XY' }, { id: 'XZ', label: 'XZ' }, { id: 'YZ', label: 'YZ' }]);
const AXIS_OPTIONS = Object.freeze([{ id: 'Z_AXIS', label: 'Oś Z' }, { id: 'X_AXIS', label: 'Oś X' }, { id: 'Y_AXIS', label: 'Oś Y' }]);

function selectionItems(selection) {
  if (!selection) return EMPTY;
  return selection.items || [selection];
}

function ToolButton({ label, Icon, active = false, disabled = false, onClick, shortcut, accent = false }) {
  return (
    <button type="button" className={`tool ${active ? 'active' : ''} ${accent ? 'accent' : ''}`} disabled={disabled} onClick={onClick} title={shortcut ? `${label} (${shortcut.toUpperCase()})` : label} data-tool={label}>
      <Icon className="tool-icon" />
      <span>{label}</span>
    </button>
  );
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((option) => (
        <button key={option.id} type="button" role="radio" aria-checked={value === option.id} className={value === option.id ? 'on' : ''} onClick={() => onChange(option.id)}>{option.label}</button>
      ))}
    </div>
  );
}

export default function Studio() {
  const verifyMode = useMemo(() => new URLSearchParams(window.location.search).has('verify'), []);
  const [initialOpen] = useState(loadInitialDocument);
  const history = useDocumentHistory(initialOpen.document);
  const document = history.document;
  const [savedText, setSavedText] = useState(() => (initialOpen.recovered ? '' : JSON.stringify(initialOpen.document)));
  const [currentPath, setCurrentPath] = useState('');
  const [activeSketchId, setActiveSketchId] = useState(null);
  const [tool, setTool] = useState(null);
  const [command, setCommand] = useState(null);
  const [selection, setSelection] = useState(null);
  const [notice, setNotice] = useState(initialOpen.warning || '');
  const [fitRequest, setFitRequest] = useState(null);
  const [cameraView, setCameraView] = useState(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [constraintMenuOpen, setConstraintMenuOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [licensePlan, setLicensePlan] = useState(DEFAULT_LICENSE_STATUS);
  const [licenseKnown, setLicenseKnown] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(verifyMode);
  const [fullLicenseOpen, setFullLicenseOpen] = useState(false);
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [licenseError, setLicenseError] = useState('');
  const [updateState, setUpdateState] = useState({ open: false, status: 'idle', result: null, handoff: null, error: '' });
  const fileInputRef = useRef(null);
  const pointerRef = useRef(null);
  const shiftRef = useRef(false);
  const pendingHoleRef = useRef(null);
  const [mode, setMode] = useState('model');
  const [projection, setProjection] = useState({ revision: -1, data: null });
  const fitPendingRef = useRef(true);
  useEffect(() => {
    const track = (event) => { shiftRef.current = event.shiftKey; };
    window.addEventListener('keydown', track);
    window.addEventListener('keyup', track);
    window.addEventListener('pointerdown', track, true);
    return () => {
      window.removeEventListener('keydown', track);
      window.removeEventListener('keyup', track);
      window.removeEventListener('pointerdown', track, true);
    };
  }, []);

  const serialized = useMemo(() => JSON.stringify(document), [document]);
  const dirty = serialized !== savedText;
  const activeSketch = document.sketches.find((sketch) => sketch.id === activeSketchId) || null;
  const items = selectionItems(selection);
  const selectedSketchEntityIds = selection?.kind === 'sketchEntities' ? selection.ids : EMPTY;
  const selectedEntities = useMemo(() => selectedSketchEntityIds.map((id) => activeSketch?.entities.find((entity) => entity.id === id)).filter(Boolean), [activeSketch, selectedSketchEntityIds]);
  const selectedTopologyIds = useMemo(() => items.filter((item) => ['face', 'edge', 'vertex'].includes(item.kind)).map((item) => item.id), [items]);
  const selectedBodyIds = useMemo(() => items.filter((item) => item.kind === 'body').map((item) => item.id), [items]);
  const selectedEdges = items.filter((item) => item.kind === 'edge' && item.bodyId);
  const selectedFaces = items.filter((item) => item.kind === 'face' && item.bodyId);
  const firstBodyId = `body-${document.features.find((feature) => ['extrude', 'revolve'].includes(feature.type) && feature.operation === 'new')?.id || ''}`;

  const flash = useCallback((text) => setNotice(text), []);

  // History edits go through one place so face-sketch supports follow moved faces.
  const commit = useCallback((mutator) => {
    history.commit((next) => {
      mutator(next);
      moveTrackedFaceSketchSupports(document, next);
    });
  }, [document, history]);

  const safeEdit = (edit, success) => {
    try {
      tryEdit(document, edit);
      commit(edit);
      if (success) flash(success);
      return true;
    } catch (error) {
      flash(error.message);
      return false;
    }
  };

  // ---- Preview: the active command's feature is inserted into a copy of the document.
  const formProblem = command && command.type !== 'dimension' && command.type !== 'pickPlane' ? commandProblem(command, document.parameters) : '';
  const previewFeature = useMemo(() => (command && command.type !== 'dimension' && !formProblem ? buildFeature(command, { features: document.features, firstBodyId }) : null), [command, document.features, firstBodyId, formProblem]);
  const previewDocument = useMemo(() => {
    if (!previewFeature) return document;
    const next = structuredClone(document);
    for (const reference of command.references || []) {
      if (!next.references.some((item) => item.id === reference.id)) next.references.push({ ...reference, ownerFeatureId: previewFeature.id });
    }
    if (command.editId) {
      const index = next.features.findIndex((feature) => feature.id === command.editId);
      if (index >= 0) next.features[index] = previewFeature;
    } else insertTimelineFeature(next, previewFeature);
    return next;
  }, [command, document, previewFeature]);
  const engine = useCadEngine(previewDocument, { quality: previewFeature ? 'preview' : 'display' });
  const timelineStatus = useMemo(() => new Map((engine.timeline || []).map((entry) => [entry.id, entry])), [engine.timeline]);
  const previewError = formProblem || (previewFeature ? timelineStatus.get(previewFeature.id)?.error || '' : '');
  const bodies = useMemo(() => engine.bodies.filter((body) => document.features.find((feature) => feature.id === body.sourceFeatureId)?.visible !== false), [engine.bodies, document.features]);

  const visibleSketchId = resolveVisibleSketchId({ activeSketchId, selection, sketches: document.sketches, bodyCount: document.bodies.length, featureCount: document.features.length, features: document.features });
  const selectedProfileMatch = selection?.kind === 'profile'
    ? document.sketches.flatMap((sketch) => sketch.profiles.map((profile) => ({ sketch, profile }))).find(({ profile }) => profile.id === selection.id) || null
    : null;

  // The kernel puts face-supported profiles back on their face; store that placement so
  // the sketch is drawn and edited where the model uses it.
  useEffect(() => {
    if (previewFeature || engine.status !== 'ready' || !engine.isCurrent || !engine.supportPlacements?.length) return;
    const differs = (sketch, placement) => (placement.frame
      ? JSON.stringify(sketch.frame?.origin) !== JSON.stringify(placement.frame.origin)
      : Math.abs(Number(sketch.planeOffset || 0) - Number(placement.planeOffset)) > 1e-6);
    const updates = engine.supportPlacements.filter((placement) => {
      const sketch = document.sketches.find((item) => item.id === placement.sketchId);
      return sketch && differs(sketch, placement);
    });
    if (!updates.length) return;
    history.synchronize((next) => {
      for (const placement of updates) {
        const sketch = next.sketches.find((item) => item.id === placement.sketchId);
        if (!sketch) continue;
        if (placement.frame) sketch.frame = placement.frame;
        else sketch.planeOffset = String(Number(Number(placement.planeOffset).toFixed(9)));
      }
    });
  }, [document.sketches, engine.isCurrent, engine.status, engine.supportPlacements, history, previewFeature]);

  // ---- Session hooks used by Electron when the window closes.
  useEffect(() => {
    const timeout = window.setTimeout(() => { if (dirty) writeLocalAutosave(serialized); }, 400);
    return () => window.clearTimeout(timeout);
  }, [dirty, serialized]);
  // Refreshed on every render so Electron and verification always read the live state.
  useEffect(() => {
    window.__madcadGetSessionExport = () => JSON.stringify(document, null, 2);
    window.__madcadHasDrawableContent = () => Boolean(document.features.length || document.sketches.some((sketch) => sketch.entities.length));
    window.__madcadHasUnsavedChanges = () => dirty;
    window.__madcadPersistenceReady = () => true;
    window.__madcadClearRuntimeSession = () => clearLocalAutosave();
    window.__madcadStudio = { document, engine: { status: engine.status, bodies: engine.bodies.length, error: engine.error, revision: engine.revision, timeline: engine.timeline, current: engine.isCurrent, ...(verifyMode ? { bodyData: engine.bodies } : {}) } };
    if (verifyMode) window.__madcadStudioLoad = (next) => { history.replace(next); resetView(); };
    if (verifyMode) window.__madcadScenarios = () => import('../../tests/studio-scenarios.js').then((module) => module.runScenarios());
    // Verification runs pick sketch geometry directly instead of hunting pixels.
    if (verifyMode) window.__madcadStudioSelect = (ids) => setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids });
  });

  // ---- Licence and updates (same desktop bridge as before).
  const runLicenseAction = useCallback(async (action, payload) => {
    const method = window.desktopApp?.[action];
    if (typeof method !== 'function') {
      setLicenseError('Zarządzanie kontem jest dostępne w zainstalowanej aplikacji desktopowej.');
      return null;
    }
    setLicenseBusy(true);
    setLicenseError('');
    try {
      const result = await method(payload);
      if (result?.status) setLicensePlan(normalizeLicenseStatus(result.status));
      if (!result?.ok) setLicenseError(result?.error || 'Nie udało się sprawdzić licencji.');
      return result;
    } catch (error) {
      setLicenseError(error?.message || 'Nie udało się połączyć z serwerem licencji.');
      return null;
    } finally {
      setLicenseBusy(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve(runLicenseAction('licenseGetStatus')).finally(() => setLicenseKnown(true)); }, [runLicenseAction]);
  useEffect(() => { if (licenseKnown && !licensePlan.accessAllowed && !verifyMode) setLicenseOpen(true); }, [licenseKnown, licensePlan.accessAllowed, verifyMode]);
  const checkForUpdates = useCallback(async (silent = false) => {
    if (!window.desktopApp?.checkForUpdates) {
      if (!silent) setUpdateState({ open: true, status: 'idle', result: null, error: 'Aktualizacje są dostępne w zainstalowanej aplikacji.' });
      return;
    }
    setUpdateState((current) => ({ ...current, open: !silent || current.open, status: 'checking', error: '' }));
    try {
      const result = await window.desktopApp.checkForUpdates();
      setUpdateState({ open: !silent || Boolean(result?.available), status: 'idle', result, handoff: null, error: result?.ok === false ? result.error || 'Nie udało się sprawdzić aktualizacji.' : '' });
    } catch (error) {
      setUpdateState({ open: !silent, status: 'idle', result: null, error: error.message });
    }
  }, []);
  useEffect(() => {
    if (verifyMode) return undefined;
    const timeout = window.setTimeout(() => { void checkForUpdates(true); }, 2000);
    return () => window.clearTimeout(timeout);
  }, [checkForUpdates, verifyMode]);
  const installUpdate = async () => {
    if (!window.desktopApp?.downloadAndInstallUpdate) return;
    setUpdateState((current) => ({ ...current, status: 'installing', error: '' }));
    try {
      const result = await window.desktopApp.downloadAndInstallUpdate();
      setUpdateState((current) => ({ ...current, status: 'idle', handoff: result?.handoff ? result : null, error: result?.ok ? '' : result?.error || 'Nie udało się rozpocząć instalacji.' }));
    } catch (error) {
      setUpdateState((current) => ({ ...current, status: 'idle', error: error.message }));
    }
  };

  // ---- Files
  const confirmDiscard = async (reason) => {
    if (!dirty) return true;
    if (window.desktopApp?.confirmUnsavedChanges) {
      const result = await window.desktopApp.confirmUnsavedChanges({ reason });
      if (result?.decision === 'save') return Boolean(await saveProject());
      return result?.decision === 'discard';
    }
    return verifyMode || window.confirm('Projekt ma niezapisane zmiany. Odrzucić je?');
  };
  const resetView = () => {
    setActiveSketchId(null);
    setTool(null);
    setCommand(null);
    setSelection(null);
    fitPendingRef.current = true;
  };
  // A freshly opened project is framed once its bodies have been computed.
  useEffect(() => {
    if (!fitPendingRef.current || engine.status !== 'ready' || !engine.isCurrent) return;
    fitPendingRef.current = false;
    setFitRequest({ requestId: `fit:${Date.now()}` });
  }, [engine.isCurrent, engine.status, engine.bodies]);
  const newProject = async () => {
    setFileMenuOpen(false);
    if (!(await confirmDiscard('new'))) return;
    const blank = createDocument('Bez nazwy');
    history.replace(blank);
    setSavedText(JSON.stringify(blank));
    setCurrentPath('');
    clearLocalAutosave();
    resetView();
    flash('Nowy projekt. Kliknij „Szkic”, aby zacząć.');
  };
  const applyOpened = (opened, filePath) => {
    history.replace(opened.document);
    setSavedText(JSON.stringify(opened.document));
    setCurrentPath(filePath || '');
    resetView();
    flash(opened.warning || `Otwarto ${opened.document.name}.`);
  };
  const openProject = async () => {
    setFileMenuOpen(false);
    if (!(await confirmDiscard('open'))) return;
    if (!window.desktopApp?.openProjectFile) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const result = await window.desktopApp.openProjectFile();
      if (!result?.ok) {
        if (!result?.canceled) flash(`Nie udało się otworzyć projektu: ${result?.error || 'nieznany błąd'}`);
        return;
      }
      applyOpened(openDocument(JSON.parse(result.text)), result.filePath);
    } catch (error) {
      flash(`Nie udało się otworzyć projektu: ${error.message}`);
    }
  };
  const openFromInput = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const opened = await readProjectFile(file);
      applyOpened(opened, opened.filePath);
    } catch (error) {
      flash(`Nie udało się otworzyć projektu: ${error.message}`);
    }
  };
  async function saveProject() {
    setFileMenuOpen(false);
    const request = prepareProjectSave(document);
    if (window.desktopApp?.saveTextFile) {
      const result = await window.desktopApp.saveTextFile({ defaultName: request.defaultName, text: request.text, filters: request.filters, atomic: true, createBackup: true, targetPath: currentPath || '' });
      if (!result?.ok) {
        flash(result?.canceled ? 'Anulowano zapis.' : `Nie udało się zapisać: ${result?.error || 'nieznany błąd'}`);
        return false;
      }
      setCurrentPath(result.filePath || '');
      setSavedText(request.snapshot);
      clearLocalAutosave();
      flash(`Zapisano: ${result.filePath}`);
      return result.filePath;
    }
    downloadBlob(new Blob([request.text], { type: 'application/json' }), request.defaultName);
    setSavedText(request.snapshot);
    clearLocalAutosave();
    flash('Zapisano projekt.');
    return true;
  }
  const exportModel = async (format) => {
    setFileMenuOpen(false);
    flash(`Przygotowywanie pliku ${format.toUpperCase()}…`);
    try {
      const buffers = await engine.exportModel(format);
      const mime = format === 'stl' ? 'model/stl' : 'model/step';
      buffers.forEach((buffer, index) => downloadBlob(new Blob([buffer], { type: mime }), `${safeName(document.name)}${buffers.length > 1 ? `-${index + 1}` : ''}.${format}`));
      flash(`Wyeksportowano ${format.toUpperCase()}.`);
    } catch (error) {
      flash(`Eksport nie powiódł się: ${error.message}`);
    }
  };
  // ---- Drawing: exact projections are computed by the kernel only while the sheet is open.
  const storedSheet = document.drawings?.[0] || null;
  const projectionReady = projection.revision === engine.revision && Boolean(projection.data);
  const drawingBodies = useMemo(() => (projectionReady ? attachDrawingProjections(engine.bodies, projection.data) : engine.bodies), [engine.bodies, projection.data, projectionReady]);
  const sheet = useMemo(() => (storedSheet && engine.bodies.length ? arrangeSheet(storedSheet, drawingBodies) : storedSheet), [drawingBodies, engine.bodies.length, storedSheet]);
  const projectDrawingViews = engine.projectDrawingViews;
  useEffect(() => {
    if (mode !== 'drawing' || previewFeature || engine.status !== 'ready' || !engine.isCurrent || !engine.bodies.length || projection.revision === engine.revision) return undefined;
    let active = true;
    const groups = drawingProjectionGroups([{ views: [{ type: 'base', bodyIds: [] }] }], engine.bodies);
    projectDrawingViews(['front', 'top', 'right', 'isometric'], groups, [], 0.001)
      .then((data) => { if (active) setProjection({ revision: engine.revision, data }); })
      .catch((error) => { if (active && error.code !== 'PROJECTION_MODEL_PENDING') flash(`Rzuty rysunku: ${error.message}`); });
    return () => { active = false; };
  }, [engine.bodies, engine.isCurrent, engine.revision, engine.status, flash, mode, previewFeature, projectDrawingViews, projection.revision]);
  const createDrawing = () => commit((next) => { next.drawings = [...(next.drawings || []), createStandardSheet(next)]; });
  const updateSheet = (patch) => commit((next) => { next.drawings[0] = { ...next.drawings[0], ...patch }; });
  const updateLayout = (patch) => commit((next) => { next.drawings[0] = { ...next.drawings[0], layout: { ...next.drawings[0].layout, ...patch } }; });
  const updateTitle = (patch) => commit((next) => { next.drawings[0] = { ...next.drawings[0], titleBlock: { ...next.drawings[0].titleBlock, ...patch } }; });
  const sheetHtml = () => drawingSheetHtml(sheet, drawingBodies, { documentName: document.name, sketches: document.sketches, parameters: document.parameters, layers: document.layers });
  const drawingFileName = (extension) => `${safeName(document.name)}-rysunek.${extension}`;
  const exportDrawingPdf = async () => {
    if (!sheet || !projectionReady) return flash('Poczekaj, aż rzuty zostaną obliczone.');
    if (window.desktopApp?.saveDrawingPdf) {
      const result = await window.desktopApp.saveDrawingPdf({ html: sheetHtml(), title: document.name, defaultName: drawingFileName('pdf'), pageSize: sheet.pageSize, orientation: sheet.orientation });
      return flash(result?.ok ? `Zapisano PDF: ${result.filePath}` : result?.canceled ? 'Anulowano eksport PDF.' : `Eksport PDF nie powiódł się: ${result?.error || 'nieznany błąd'}`);
    }
    downloadBlob(new Blob([sheetHtml()], { type: 'text/html' }), drawingFileName('html'));
    flash('Pobrano arkusz HTML — wydrukuj go do PDF w przeglądarce.');
  };
  const exportDrawingDxf = () => {
    if (!sheet || !projectionReady) return flash('Poczekaj, aż rzuty zostaną obliczone.');
    downloadBlob(new Blob([drawingSheetDxf(sheet, drawingBodies, { sketches: document.sketches, parameters: document.parameters, layers: document.layers })], { type: 'application/dxf;charset=utf-8' }), drawingFileName('dxf'));
    flash('Wyeksportowano rysunek DXF (mm).');
  };
  const printDrawing = async () => {
    if (!sheet || !projectionReady) return flash('Poczekaj, aż rzuty zostaną obliczone.');
    if (!window.desktopApp?.openPrintPreviewWindow) return exportDrawingPdf();
    const result = await window.desktopApp.openPrintPreviewWindow({ html: sheetHtml(), title: document.name });
    if (!result?.ok) flash(`Podgląd wydruku nie powiódł się: ${result?.error || 'nieznany błąd'}`);
  };
  const switchMode = (next) => {
    if (next === mode) return;
    if (activeSketchId) finishSketch();
    setCommand(null);
    setTool(null);
    setSelection(null);
    setNotice('');
    setMode(next);
  };

  const exportSketchDxf = () => {
    setFileMenuOpen(false);
    const sketch = activeSketch || document.sketches.find((item) => item.id === (selection?.sketchId || selection?.id)) || document.sketches.at(-1);
    if (!sketch) return flash('Brak szkicu do eksportu.');
    downloadBlob(new Blob([sketchDxf(sketch, { parameters: document.parameters, layers: document.layers })], { type: 'application/dxf' }), `${safeName(sketch.name)}.dxf`);
    flash(`Wyeksportowano ${sketch.name} do DXF.`);
  };

  // ---- Sketch lifecycle
  const enterSketch = (sketch, message, firstTool = 'line') => {
    setActiveSketchId(sketch.id);
    setSelection(null);
    setCommand(null);
    setTool({ type: firstTool, points: [] });
    flash(message);
  };
  const createPlaneSketch = (plane) => {
    const sketch = createSketch({ name: 'Szkic', plane });
    commit((next) => { sketch.name = nextSketchName(next.sketches); next.sketches.push(sketch); });
    setCameraView({ requestId: `view:${Date.now()}`, plane });
    enterSketch(sketch, `Rysujesz na płaszczyźnie ${PLANE_NAMES[plane]}. Wybierz narzędzie albo zacznij od linii.`);
  };
  const createFaceSketch = (faceItem, firstTool = 'line') => {
    const body = engine.bodies.find((candidate) => candidate.id === faceItem.bodyId);
    const face = body?.topology?.faces?.find((candidate) => candidate.id === faceItem.id);
    if (face?.descriptor?.geometry !== 'PLANE') return flash('Szkic można założyć tylko na płaskiej ścianie.');
    const center = face.descriptor.center || [0, 0, 0];
    const normal = face.descriptor.normal || [0, 0, 1];
    const dominant = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
    const axisAligned = normal.every((value, index) => index === dominant || Math.abs(value) <= 1e-6);
    const plane = dominant === 0 ? 'YZ' : dominant === 1 ? 'XZ' : 'XY';
    const planeOffset = dominant === 1 ? -center[1] : center[dominant];
    const reference = createTopologyReference({ selection: faceItem, descriptor: face.descriptor, label: 'Podpora szkicu' });
    const sketch = createSketch({ name: 'Szkic', plane, planeOffset, ...(axisAligned ? {} : { frame: frameFromNormal(center, normal) }), support: { kind: 'face', referenceId: reference.id } });
    commit((next) => { next.references.push(reference); sketch.name = nextSketchName(next.sketches); next.sketches.push(sketch); });
    if (firstTool === 'point') pendingHoleRef.current = sketch.id;
    enterSketch(sketch, firstTool === 'point' ? 'Kliknij środki otworów, potem „Zakończ szkic”.' : 'Rysujesz na ścianie bryły.', firstTool);
  };
  const startSketch = () => {
    if (activeSketchId) return;
    const face = selectedFaces[0];
    if (face) return createFaceSketch(face);
    setCommand({ type: 'pickPlane' });
    setTool(null);
    flash('Wybierz płaszczyznę bazową albo płaską ścianę bryły.');
  };
  const finishSketch = () => {
    const sketch = activeSketch;
    setActiveSketchId(null);
    setTool(null);
    setConstraintMenuOpen(false);
    setCommand(null);
    setCameraView({ requestId: `view:${Date.now()}`, plane: 'iso' });
    window.setTimeout(() => setFitRequest({ requestId: `fit:${Date.now()}` }), 0);
    if (!sketch) return;
    if (pendingHoleRef.current === sketch.id) {
      pendingHoleRef.current = null;
      if (holePointIds(sketch).length) {
        window.setTimeout(() => openHole(sketch), 0);
        return;
      }
    }
    if (!sketch.entities.length) {
      commit((next) => { next.sketches = next.sketches.filter((item) => item.id !== sketch.id); });
      setSelection(null);
      return flash('Pusty szkic został usunięty.');
    }
    const source = resolveExtrudeSource({ sketches: [sketch], selection: { kind: 'sketch', id: sketch.id }, features: document.features });
    if (source.kind === 'profile') {
      setSelection({ kind: 'profile', id: source.profile.id, sketchId: sketch.id });
      flash('Szkic gotowy. Kliknij „Wyciągnij”, aby zrobić z niego bryłę.');
    } else {
      setSelection({ kind: 'sketch', id: sketch.id });
      flash('Szkic zakończony. Obrys nie jest zamknięty — domknij go, aby zrobić bryłę.');
    }
  };
  const editSketch = (sketchId) => {
    const sketch = document.sketches.find((item) => item.id === sketchId);
    if (!sketch) return;
    setActiveSketchId(sketch.id);
    setSelection(null);
    setCommand(null);
    setTool(null);
    flash(`Edytujesz ${sketch.name}.`);
  };

  // ---- Sketch tools
  const chooseTool = (id) => {
    setConstraintMenuOpen(false);
    setCommand(null);
    setTool((current) => (current?.type === id ? null : { type: id, points: [] }));
  };
  const toolDefinition = SKETCH_TOOLS.find((item) => item.id === tool?.type) || null;
  const handleSketchPoint = (coordinates) => {
    if (!toolDefinition?.points || !activeSketchId) return;
    const point = coordinates.map(Number);
    const points = [...tool.points, point];
    if (points.length < toolDefinition.points) {
      setTool({ ...tool, points });
      return;
    }
    const ok = safeEdit((next) => (tool.type === 'line' ? addLine(next, activeSketchId, points[0], points[1])
      : tool.type === 'point' ? addPoint(next, activeSketchId, points[0])
        : addShape(next, activeSketchId, tool.type, points)));
    // Line restarts from scratch; every tool stays armed for the next shape.
    setTool({ type: tool.type, points: ok || points.length > 1 ? [] : tool.points });
  };
  const handleTrim = ({ entityId, point }) => {
    safeEdit((next) => trimSketchEntity(next, activeSketchId, entityId, point), 'Przycięto.');
  };
  const handleSketchSelection = (ids, mode = 'replace') => {
    setSelection((current) => {
      const existing = current?.kind === 'sketchEntities' ? current.ids : [];
      let next = ids;
      if (mode === 'add') next = [...new Set([...existing, ...ids])];
      if (mode === 'toggle') next = existing.filter((id) => !ids.includes(id)).concat(ids.filter((id) => !existing.includes(id)));
      return next.length ? { kind: 'sketchEntities', sketchId: activeSketchId, ids: next } : null;
    });
  };
  const deleteSketchEntities = () => {
    if (!selectedSketchEntityIds.length) return;
    safeEdit((next) => {
      deleteSketchSelection(next, activeSketchId, selectedSketchEntityIds);
      refreshDetectedSketchProfiles(next.sketches.find((item) => item.id === activeSketchId), next.parameters);
    }, 'Usunięto zaznaczone elementy.');
    setSelection(null);
  };
  const applyConstraint = (type) => {
    setConstraintMenuOpen(false);
    const definition = CONSTRAINTS.find((item) => item.id === type);
    if (!constraintAvailable(type, selectedEntities)) return flash(definition.hint);
    safeEdit((next) => addConstraint(next, activeSketchId, type, selectedSketchEntityIds), `Dodano więz: ${definition.label.toLowerCase()}.`);
  };
  const openDimension = () => {
    setTool(null);
    setConstraintMenuOpen(false);
    if (!selectedSketchEntityIds.length) {
      setCommand({ type: 'dimension', pending: true });
      return flash('Zaznacz linię, okrąg, łuk albo dwa punkty, aby nadać wymiar.');
    }
    try {
      const dimension = dimensionForSelection(document, activeSketchId, selectedSketchEntityIds);
      if (!dimension) return flash('Wymiar: zaznacz linię, okrąg, łuk, dwa punkty albo dwie linie.');
      setCommand({ type: 'dimension', dimension, value: String(Number(dimension.value.toFixed(3))) });
    } catch (error) {
      flash(error.message);
    }
  };
  // Picking geometry while the dimension tool waits opens the value box right away.
  useEffect(() => {
    if (command?.type !== 'dimension' || !command.pending || !selectedSketchEntityIds.length || !activeSketchId) return;
    try {
      const dimension = dimensionForSelection(document, activeSketchId, selectedSketchEntityIds);
      if (dimension) setCommand({ type: 'dimension', dimension, value: String(Number(dimension.value.toFixed(3))) });
    } catch { /* Keep waiting for a valid pick. */ }
  }, [activeSketchId, command, document, selectedSketchEntityIds]);
  const confirmDimension = () => {
    const ok = safeEdit((next) => addDimension(next, activeSketchId, command.dimension, command.value), `${command.dimension.label}: ${command.value}${command.dimension.type === 'angle' ? '°' : ' mm'}.`);
    if (ok) {
      setCommand({ type: 'dimension', pending: true });
      setSelection(null);
    }
  };

  // ---- Solid commands
  const profileSource = () => {
    if (selectedProfileMatch) return { sketch: selectedProfileMatch.sketch, profile: selectedProfileMatch.profile };
    const source = resolveExtrudeSource({ sketches: document.sketches, selection, features: document.features });
    return source.kind === 'profile' ? source : null;
  };
  // Hole drills at the free points of a sketch; with a face picked it first opens a sketch
  // there with the Point tool and continues after "Zakończ szkic".
  const openHole = (sketch) => {
    const pointIds = holePointIds(sketch);
    const supportBody = document.references.find((reference) => reference.id === sketch.support?.referenceId)?.bodyId;
    const targetBodyId = supportBody || selectedBodyIds[0] || engine.bodies[0]?.id;
    if (!targetBodyId) return flash('Najpierw zrób bryłę.');
    setSelection(null);
    setNotice('');
    setCommand({ type: 'hole', sketchId: sketch.id, pointIds, targetBodyId, holeType: 'simple', extent: 'through-all', diameter: '6', depth: '10' });
  };
  const repeatSources = (bodyId) => document.features.filter((feature) => REPEATABLE_TYPES.includes(feature.type) && !feature.suppressed
    && (feature.targetBodyId === bodyId || `body-${feature.id}` === bodyId));
  const openRepeatTool = (id) => {
    const bodyId = selectedBodyIds[0] || selectedFaces[0]?.bodyId || selectedEdges[0]?.bodyId || engine.bodies[0]?.id;
    if (!bodyId) return flash('Najpierw zrób bryłę.');
    const sources = repeatSources(bodyId);
    const last = sources.findLast((feature) => feature.type === 'hole' || (feature.operation && feature.operation !== 'new'));
    const sourceId = last?.id || 'body';
    const sketchPlane = document.sketches.find((sketch) => sketch.id === last?.sketchId)?.plane || 'XY';
    if (id === 'pattern') {
      setCommand({ type: 'pattern', targetBodyId: bodyId, sourceId, patternType: 'rectangular', plane: sketchPlane, countX: '3', spacingX: '15', countY: '1', spacingY: '15', occurrences: '6', totalAngle: '360', axisId: 'Z_AXIS' });
    } else {
      setCommand({ type: 'mirror', targetBodyId: bodyId, sourceId, plane: 'YZ' });
    }
  };

  const openSolidTool = (id) => {
    if (activeSketchId && id !== 'hole') finishSketch();
    setNotice('');
    if (id === 'hole') {
      const sketch = activeSketch || document.sketches.find((item) => item.id === (selection?.sketchId || (selection?.kind === 'sketch' ? selection.id : null)))
        || document.sketches.findLast((item) => holePointIds(item).length && !document.features.some((feature) => feature.sketchId === item.id));
      if (activeSketchId) {
        if (!holePointIds(activeSketch).length) return flash('Dodaj punkty narzędziem „Punkt” (P) — w nich powstaną otwory.');
        finishSketch();
        return openHole(activeSketch);
      }
      if (selectedFaces[0]) {
        createFaceSketch(selectedFaces[0], 'point');
        return;
      }
      if (sketch && holePointIds(sketch).length) return openHole(sketch);
      return flash('Kliknij płaską ścianę bryły, potem „Otwór”.');
    }
    if (id === 'pattern' || id === 'mirror') return openRepeatTool(id);
    if (id === 'extrude' || id === 'revolve') {
      const source = profileSource();
      if (!source) return flash('Najpierw narysuj zamknięty szkic (np. prostokąt) i zakończ go.');
      setSelection({ kind: 'profile', id: source.profile.id, sketchId: source.sketch.id });
      const operation = engine.bodies.length ? 'join' : 'new';
      const picked = selection?.kind === 'profile' && selection.sketchId === source.sketch.id && selection.ids?.length > 1 && id === 'extrude' ? selection.ids : [source.profile.id];
      const base = { sketchId: source.sketch.id, profileIds: picked, operation, hasBodies: engine.bodies.length > 0, targetBodyId: selectedBodyIds[0] || selectedFaces[0]?.bodyId || null };
      if (id === 'extrude') setCommand({ type: 'extrude', ...base, distance: '10', extent: 'one-side', flip: false });
      else setCommand({ type: 'revolve', ...base, axisId: revolveAxes(source.sketch.plane)[0].id, angle: '360' });
      return;
    }
    const edgeTool = id === 'fillet' || id === 'chamfer';
    const picks = edgeTool ? selectedEdges : selectedFaces;
    const targetBodyId = picks[0]?.bodyId || selectedBodyIds[0] || engine.bodies[0]?.id;
    if (!targetBodyId) return flash('Najpierw zrób bryłę.');
    const references = picks.filter((item) => item.bodyId === targetBodyId).map((item) => referenceFor(item, FEATURE_LABELS[id]));
    setCommand({ type: id, targetBodyId, references, ...(edgeTool ? { size: id === 'fillet' ? '2' : '1' } : { thickness: '2' }) });
    if (!references.length) flash(edgeTool ? 'Kliknij krawędzie bryły.' : 'Kliknij ściany, które mają zostać otwarte.');
  };
  const referenceFor = (item, label) => {
    const body = engine.bodies.find((candidate) => candidate.id === item.bodyId);
    const records = item.kind === 'edge' ? body?.topology?.edges : body?.topology?.faces;
    const found = records?.find((record) => record.id === item.id)?.descriptor;
    // Body bounds let the engine find the same edge again after a dimension change.
    const descriptor = found ? { ...found, ...(body?.bounds ? { bodyBounds: body.bounds } : {}) } : null;
    return { ...createTopologyReference({ selection: item, descriptor, label }), scope: 'feature-input' };
  };
  const updateCommand = (patch) => setCommand((current) => ({ ...current, ...patch }));
  const confirmCommand = () => {
    if (!previewFeature) return;
    if (previewError) return flash(`Nie można zatwierdzić: ${previewError}`);
    const feature = previewFeature;
    commit((next) => {
      for (const reference of command.references || []) {
        if (!next.references.some((item) => item.id === reference.id)) next.references.push({ ...reference, ownerFeatureId: feature.id });
      }
      if (command.editId) {
        const index = next.features.findIndex((item) => item.id === command.editId);
        next.features[index] = feature;
      } else insertTimelineFeature(next, feature);
    });
    setCommand(null);
    setSelection(null);
    // Frame the first body; later steps keep the camera where the user left it.
    if (command.hasBodies === false) setFitRequest({ requestId: `fit:${Date.now()}` });
    flash(`${feature.name} — gotowe.`);
  };
  const cancelCommand = () => {
    setCommand(null);
    if (tool?.points?.length) setTool({ ...tool, points: [] });
  };
  const handleTopologySelection = (topology, mode = 'replace') => {
    if (command?.type === 'pickPlane' && topology?.kind === 'face') {
      setCommand(null);
      return createFaceSketch(topology);
    }
    if (command && ['fillet', 'chamfer', 'shell'].includes(command.type) && topology) {
      const wanted = command.type === 'shell' ? 'face' : 'edge';
      if (topology.kind !== wanted || topology.bodyId !== command.targetBodyId) return;
      const exists = command.references.find((reference) => reference.topologyId === topology.id);
      const references = exists
        ? command.references.filter((reference) => reference !== exists)
        : [...command.references, referenceFor(topology, FEATURE_LABELS[command.type])];
      updateCommand({ references });
      const picked = references.map((reference) => ({ kind: reference.topologyKind, id: reference.topologyId, bodyId: reference.bodyId }));
      setSelection(picked.length ? { ...picked.at(-1), items: picked } : null);
      return;
    }
    if (!topology) return setSelection(null);
    const body = engine.bodies.find((candidate) => candidate.id === topology.bodyId);
    const records = topology.kind === 'face' ? body?.topology?.faces : topology.kind === 'edge' ? body?.topology?.edges : null;
    const descriptor = records?.find((record) => record.id === topology.id)?.descriptor;
    const mm = (value) => Number(value).toLocaleString('pl-PL', { maximumFractionDigits: 2 });
    flash(topology.kind === 'edge' ? `Krawędź${descriptor?.length ? ` · ${mm(descriptor.length)} mm` : ''} — Zaokrąglij (F) albo Fazuj.`
      : topology.kind === 'face' ? `Ściana${descriptor?.area ? ` · ${mm(descriptor.area)} mm²` : ''} — Szkic (S) rysuje na niej.`
        : `Zaznaczono ${body?.name || 'bryłę'}.`);
    const item = topology.kind === 'body' ? { kind: 'body', id: topology.bodyId, bodyId: topology.bodyId } : { kind: topology.kind, id: topology.id, bodyId: topology.bodyId, sourceFeatureId: topology.sourceFeatureId };
    setSelection((current) => {
      if (mode === 'replace') return { ...item, items: [item] };
      const existing = selectionItems(current).filter((entry) => ['body', 'face', 'edge', 'vertex'].includes(entry.kind));
      const has = existing.some((entry) => entry.kind === item.kind && entry.id === item.id);
      const next = has ? existing.filter((entry) => !(entry.kind === item.kind && entry.id === item.id)) : [...existing, item];
      return next.length ? { ...next.at(-1), items: next } : null;
    });
  };

  // Clicking an area picks it; Shift adds or removes areas, also while Extrude is open.
  const handleProfilePick = (profileId, pickedSketchId) => {
    const sketchId = pickedSketchId || activeSketchId;
    const toggle = (ids) => (ids.includes(profileId) ? ids.filter((id) => id !== profileId) : [...ids, profileId]);
    if (command?.type === 'extrude' || command?.type === 'revolve') {
      if (command.sketchId !== sketchId) return flash('Obszary muszą pochodzić z jednego szkicu.');
      const profileIds = shiftRef.current && command.type === 'extrude' ? toggle(command.profileIds) : [profileId];
      if (!profileIds.length) return;
      updateCommand({ profileIds });
      setSelection({ kind: 'profile', id: profileIds.at(-1), sketchId, ids: profileIds });
      return;
    }
    setSelection((current) => {
      const ids = shiftRef.current && current?.kind === 'profile' && current.sketchId === sketchId ? toggle(current.ids || [current.id]) : [profileId];
      return ids.length ? { kind: 'profile', id: ids.at(-1), sketchId, ids } : null;
    });
  };

  // ---- Timeline and browser
  const editFeature = (feature) => {
    if (activeSketchId) finishSketch();
    const next = commandFromFeature(feature, document);
    if (!next) return flash(`${feature.name}: tej operacji nie można edytować w nowym interfejsie.`);
    setCommand(next);
    setSelection(null);
  };
  const deleteFeature = (featureId) => {
    commit((next) => { deleteTimelineFeatureCascade(next, featureId); });
    if (command?.editId === featureId) setCommand(null);
    flash('Usunięto operację.');
  };
  const toggleFeature = (feature) => commit((next) => { setTimelineFeatureSuppressed(next, feature.id, !feature.suppressed); });
  const toggleSketchVisible = (sketchId) => commit((next) => {
    const sketch = next.sketches.find((item) => item.id === sketchId);
    if (sketch) sketch.visible = sketch.visible === false;
  });
  const deleteSketch = (sketchId) => {
    const used = document.features.some((feature) => feature.sketchId === sketchId);
    if (used) return flash('Ten szkic jest używany przez operację. Usuń najpierw operację.');
    commit((next) => { next.sketches = next.sketches.filter((item) => item.id !== sketchId); });
    if (activeSketchId === sketchId) setActiveSketchId(null);
  };
  const toggleBodyVisible = (body) => commit((next) => {
    const feature = next.features.find((item) => item.id === body.sourceFeatureId);
    if (feature) feature.visible = feature.visible === false;
  });
  const renameDocument = (name) => commit((next) => { next.name = name.trim() || 'Bez nazwy'; });

  // ---- Keyboard
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target.closest?.('input, textarea, select')) {
        if (event.key === 'Escape') event.target.blur();
        // Enter in a command field confirms the command, like OK.
        if (event.key === 'Enter' && event.target.closest('.panel') && command && command.type !== 'dimension') {
          event.preventDefault();
          confirmCommand();
        }
        return;
      }
      const primary = event.metaKey || event.ctrlKey;
      if (primary && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) history.redo(); else history.undo();
        return;
      }
      if (primary && event.key.toLowerCase() === 'y') { event.preventDefault(); history.redo(); return; }
      if (primary && event.key.toLowerCase() === 's') { event.preventDefault(); void saveProject(); return; }
      if (primary && event.key.toLowerCase() === 'o') { event.preventDefault(); void openProject(); return; }
      if (primary || event.altKey || mode === 'drawing') return;
      if (event.key === 'Escape') {
        if (constraintMenuOpen || fileMenuOpen) { setConstraintMenuOpen(false); setFileMenuOpen(false); return; }
        if (tool?.points?.length) return setTool({ ...tool, points: [] });
        if (command) return cancelCommand();
        if (tool) return setTool(null);
        if (selection) return setSelection(null);
        return;
      }
      if (event.key === 'Enter' && command && command.type !== 'pickPlane') {
        if (command.type === 'dimension') { if (!command.pending) confirmDimension(); } else confirmCommand();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && activeSketchId) { deleteSketchEntities(); return; }
      const key = event.key.toLowerCase();
      // preventDefault keeps the shortcut letter out of the panel field it opens.
      if (activeSketchId) {
        const sketchTool = SKETCH_TOOLS.find((item) => item.key === key);
        if (sketchTool) { event.preventDefault(); chooseTool(sketchTool.id); }
        if (key === 'd') { event.preventDefault(); openDimension(); }
        return;
      }
      if (key === 's') { event.preventDefault(); startSketch(); }
      const modelTool = MODEL_TOOLS.find((item) => item.key === key);
      if (modelTool) { event.preventDefault(); openSolidTool(modelTool.id); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // ---- Viewport wiring
  const sketchToolId = activeSketchId && toolDefinition?.points ? tool.type : null;
  const lastPoint = tool?.points?.at(-1) || null;
  const polylineDraft = sketchToolId ? { lastPoint, shape: tool.type === 'rectangle' && tool.points.length === 1 ? 'rectangle' : undefined } : null;
  const prompt = toolDefinition ? toolDefinition.prompt[Math.min(tool.points?.length || 0, toolDefinition.prompt.length - 1)] : '';
  const constructionPlanes = EMPTY;
  const cameraRequest = useMemo(() => {
    if (!cameraView) return null;
    const views = { XY: { position: [0, 0, 260], up: [0, 1, 0] }, XZ: { position: [0, -260, 0], up: [0, 0, 1] }, YZ: { position: [260, 0, 0], up: [0, 0, 1] }, iso: { position: [170, -170, 150], up: [0, 0, 1] } };
    const view = views[cameraView.plane];
    return view ? { requestId: cameraView.requestId, camera: { position: view.position, target: [0, 0, 0], up: view.up, zoom: 1, projection: 'perspective' } } : null;
  }, [cameraView]);

  const inSketch = Boolean(activeSketchId);
  const status = engine.status === 'computing' ? 'Przeliczanie…' : engine.status === 'loading' ? 'Uruchamianie silnika…' : engine.status === 'error' ? 'Błąd silnika' : '';
  const solidFeatures = document.features;

  return (
    <div className={`studio ${inSketch ? 'is-sketch' : ''}`}>
      <header className="topbar">
        <div className="brand"><Box size={18} /><strong>MadCAD</strong></div>
        <div className="menu-wrap">
          <button type="button" className="menu-button" onClick={() => setFileMenuOpen((open) => !open)} aria-expanded={fileMenuOpen}>Plik <ChevronDown size={14} /></button>
          {fileMenuOpen && (
            <div className="menu" role="menu" onMouseLeave={() => setFileMenuOpen(false)}>
              <button type="button" role="menuitem" onClick={newProject}><FilePlus2 size={15} />Nowy projekt</button>
              <button type="button" role="menuitem" onClick={openProject}><FolderOpen size={15} />Otwórz…<kbd>⌘O</kbd></button>
              <button type="button" role="menuitem" onClick={() => void saveProject()}><Save size={15} />Zapisz<kbd>⌘S</kbd></button>
              <hr />
              <button type="button" role="menuitem" onClick={() => exportModel('step')}><Download size={15} />Eksportuj STEP</button>
              <button type="button" role="menuitem" onClick={() => exportModel('stl')}><Download size={15} />Eksportuj STL</button>
              <button type="button" role="menuitem" onClick={exportSketchDxf}><Download size={15} />Eksportuj szkic DXF</button>
              <hr />
              <button type="button" role="menuitem" onClick={() => { setFileMenuOpen(false); void checkForUpdates(false); }}>Sprawdź aktualizacje</button>
              <button type="button" role="menuitem" onClick={() => { setFileMenuOpen(false); setLicenseOpen(true); }}>Konto i licencja</button>
            </div>
          )}
        </div>
        <button type="button" className="icon-button" title="Cofnij (⌘Z)" disabled={!history.canUndo} onClick={history.undo}><Undo2 size={17} /></button>
        <button type="button" className="icon-button" title="Ponów (⇧⌘Z)" disabled={!history.canRedo} onClick={history.redo}><Redo2 size={17} /></button>
        <input className="doc-name" value={document.name} onChange={(event) => renameDocument(event.target.value)} aria-label="Nazwa projektu" spellCheck="false" />
        {dirty && <span className="dirty-dot" title="Niezapisane zmiany" />}
        <span className="spacer" />
        <div className="mode-tabs" role="tablist">
          {[['model', 'Model'], ['drawing', 'Rysunek']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => switchMode(id)}>{label}</button>)}
        </div>
        <span className="spacer" />
        {status && <span className={`engine ${engine.status}`}>{status}</span>}
      </header>

      <nav className="toolbar" aria-label={mode === 'drawing' ? 'Rysunek' : inSketch ? 'Narzędzia szkicu' : 'Narzędzia modelu'}>
        {mode === 'drawing' ? (
          <>
            <div className="group">
              <ToolButton label="PDF" Icon={FileText} disabled={!sheet} onClick={() => void exportDrawingPdf()} />
              <ToolButton label="DXF" Icon={Download} disabled={!sheet} onClick={exportDrawingDxf} />
              <ToolButton label="Drukuj" Icon={Printer} disabled={!sheet} onClick={() => void printDrawing()} />
            </div>
            <span className="spacer" />
          </>
        ) : inSketch ? (
          <>
            <div className="group">
              {SKETCH_TOOLS.filter((item) => item.id !== 'trim').map((item) => (
                <ToolButton key={item.id} label={item.label} Icon={item.Icon} shortcut={item.key} active={tool?.type === item.id} onClick={() => chooseTool(item.id)} />
              ))}
            </div>
            <div className="group">
              <ToolButton label="Przytnij" Icon={SketchTrimCadIcon} shortcut="t" active={tool?.type === 'trim'} onClick={() => chooseTool('trim')} />
              <ToolButton label="Wymiar" Icon={SketchDimensionCadIcon} shortcut="d" active={command?.type === 'dimension'} onClick={openDimension} />
              <div className="menu-wrap">
                <ToolButton label="Więzy" Icon={SketchConstraintCadIcon} active={constraintMenuOpen} onClick={() => { setTool(null); setConstraintMenuOpen((open) => !open); }} />
                {constraintMenuOpen && (
                  <div className="menu constraints" role="menu">
                    <p className="menu-note">{selectedEntities.length ? `Zaznaczono: ${selectedEntities.length}` : 'Najpierw zaznacz geometrię'}</p>
                    {CONSTRAINTS.map((item) => (
                      <button key={item.id} type="button" role="menuitem" disabled={!constraintAvailable(item.id, selectedEntities)} title={item.hint} onClick={() => applyConstraint(item.id)}>{item.label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <span className="spacer" />
            <ToolButton label="Zakończ szkic" Icon={FinishSketchCadIcon} accent onClick={finishSketch} />
          </>
        ) : (
          <>
            <div className="group">
              <ToolButton label="Szkic" Icon={SketchCadIcon} shortcut="s" active={command?.type === 'pickPlane'} onClick={startSketch} />
            </div>
            <div className="group">
              {MODEL_TOOLS.map((item) => (
                <ToolButton key={item.id} label={item.label} Icon={item.Icon} shortcut={item.key} active={command?.type === item.id} onClick={() => openSolidTool(item.id)} />
              ))}
            </div>
            <span className="spacer" />
          </>
        )}
      </nav>

      {mode === 'drawing' ? (
        <div className="workarea">
          <DrawingPane document={document} sheet={sheet} bodies={drawingBodies} ready={projectionReady} hasBodies={engine.bodies.length > 0} onCreate={createDrawing} onLayout={updateLayout} onSheet={updateSheet} onTitle={updateTitle} />
          {notice && <div className="notice" role="status" aria-live="polite">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Zamknij"><X size={13} /></button></div>}
        </div>
      ) : (
      <div className="workarea">
        {browserOpen && (
          <aside className="browser" aria-label="Przeglądarka projektu">
            <div className="browser-head"><span>Projekt</span><button type="button" className="icon-button small" title="Ukryj" onClick={() => setBrowserOpen(false)}><X size={14} /></button></div>
            <section>
              <h3>Bryły</h3>
              {!engine.bodies.length && <p className="empty">Brak brył</p>}
              {engine.bodies.map((body) => {
                const hidden = document.features.find((feature) => feature.id === body.sourceFeatureId)?.visible === false;
                return (
                  <div key={body.id} className={`row ${selectedBodyIds.includes(body.id) ? 'selected' : ''}`} onClick={() => setSelection({ kind: 'body', id: body.id, bodyId: body.id, items: [{ kind: 'body', id: body.id, bodyId: body.id }] })}>
                    <Box size={14} /><span>{body.name}</span>
                    <button type="button" className="icon-button small" title={hidden ? 'Pokaż' : 'Ukryj'} onClick={(event) => { event.stopPropagation(); toggleBodyVisible(body); }}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  </div>
                );
              })}
            </section>
            <section>
              <h3>Szkice</h3>
              {!document.sketches.length && <p className="empty">Brak szkiców</p>}
              {document.sketches.map((sketch) => (
                <div key={sketch.id} className={`row ${sketch.id === activeSketchId || selection?.id === sketch.id || selection?.sketchId === sketch.id ? 'selected' : ''}`} onClick={() => !activeSketchId && setSelection({ kind: 'sketch', id: sketch.id })} onDoubleClick={() => editSketch(sketch.id)}>
                  <Pencil size={14} /><span>{sketch.name}</span>
                  <button type="button" className="icon-button small" title="Edytuj szkic" onClick={(event) => { event.stopPropagation(); editSketch(sketch.id); }}><Pencil size={13} /></button>
                  <button type="button" className="icon-button small" title={sketch.visible === false ? 'Pokaż' : 'Ukryj'} onClick={(event) => { event.stopPropagation(); toggleSketchVisible(sketch.id); }}>{sketch.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <button type="button" className="icon-button small" title="Usuń szkic" onClick={(event) => { event.stopPropagation(); deleteSketch(sketch.id); }}><Trash2 size={13} /></button>
                </div>
              ))}
            </section>
          </aside>
        )}

        <main className="viewport-host">
          {!browserOpen && <button type="button" className="browser-toggle" onClick={() => setBrowserOpen(true)}>Projekt</button>}
          <ModelViewport
            bodies={bodies}
            sketches={document.sketches}
            layers={document.layers}
            parameters={document.parameters}
            activeSketchId={activeSketchId}
            visibleSketchId={visibleSketchId}
            sketchTool={sketchToolId}
            sketchToolPrompt={prompt}
            polylineDraft={polylineDraft}
            onSketchPoint={handleSketchPoint}
            onSketchPointerMove={(point) => { pointerRef.current = point; }}
            selectedSketchEntityIds={selectedSketchEntityIds}
            onSketchSelection={handleSketchSelection}
            onSketchConstraintSelection={() => {}}
            onSketchConstraintValueChange={(constraintId, value) => safeEdit((next) => setConstraintValue(next, activeSketchId, constraintId, value), `Wymiar zmieniony na ${value}.`)}
            onDeleteSketchSelection={deleteSketchEntities}
            sketchModifierMode={activeSketchId && tool?.type === 'trim' ? 'trim' : null}
            onSketchModify={handleTrim}
            onSketchProfileSelection={handleProfilePick}
            onSketchMove={({ ids = selectedSketchEntityIds, dx = 0, dy = 0 } = {}) => safeEdit((next) => moveEntities(next, activeSketchId, ids, dx, dy))}
            showGrid
            selectedBodyId={selectedBodyIds[0] || null}
            selectedBodyIds={selectedBodyIds}
            cameraRequest={cameraRequest}
            fitRequest={fitRequest}
            activeCommand={command}
            onSelectBody={(id) => setSelection(id ? { kind: 'body', id, bodyId: id, items: [{ kind: 'body', id, bodyId: id }] } : null)}
            selectedTopologyIds={selectedTopologyIds}
            onSelectTopology={handleTopologySelection}
            planeSelectionMode={command?.type === 'pickPlane'}
            onSelectOriginPlane={(plane) => { setCommand(null); createPlaneSketch(plane); }}
            constructionPlanes={constructionPlanes}
            selectedProfile={!command || command.type === 'extrude' ? selectedProfileMatch?.profile || null : null}
            selectedProfilePlane={selectedProfileMatch?.sketch.plane || 'XY'}
            selectedProfilePlaneOffset={Number(selectedProfileMatch?.sketch.planeOffset || 0)}
            selectedProfileFrame={selectedProfileMatch?.sketch.frame || null}
            directExtrudeDistance={command?.type === 'extrude' ? Number(command.distance) || 0 : 0}
            onDirectExtrude={(distance) => {
              const value = Number(distance);
              if (command?.type === 'extrude') updateCommand({ distance: String(Number(Math.abs(value).toFixed(2))) });
              else openSolidTool('extrude');
            }}
          />
          {notice && <div className="notice" role="status" aria-live="polite">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Zamknij"><X size={13} /></button></div>}

          {command && command.type !== 'pickPlane' && (
            <section className="panel" aria-label="Operacja">
              {command.type === 'dimension' ? (
                <>
                  <header><Ruler size={16} /><strong>Wymiar</strong></header>
                  {command.pending ? <p className="hint">Kliknij linię, okrąg albo łuk.</p> : (
                    <Field label={command.dimension.label}>
                      <input autoFocus onFocus={(event) => event.target.select()} value={command.value} onChange={(event) => updateCommand({ value: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') confirmDimension(); }} />
                      <em>{command.dimension.type === 'angle' ? '°' : 'mm'}</em>
                    </Field>
                  )}
                  <footer>
                    <button type="button" onClick={cancelCommand}>Zamknij</button>
                    {!command.pending && <button type="button" className="primary" onClick={confirmDimension}><Check size={15} />OK</button>}
                  </footer>
                </>
              ) : (
                <>
                  <header>
                    {React.createElement(MODEL_TOOLS.find((item) => item.id === command.type)?.Icon || Box, { className: 'tool-icon small' })}
                    <strong>{command.editId ? `Edycja: ${command.name}` : MODEL_TOOLS.find((item) => item.id === command.type)?.label}</strong>
                  </header>
                  {(command.type === 'extrude' || command.type === 'revolve') && (
                    <Field label="Operacja"><Segmented value={command.operation} options={command.hasBodies || command.editId ? OPERATIONS : OPERATIONS.filter((item) => item.id === 'new')} onChange={(operation) => updateCommand({ operation })} /></Field>
                  )}
                  {command.type === 'extrude' && (
                    <>
                      <p className="hint">Obszary: {command.profileIds.length} · Shift+klik dodaje kolejny</p>
                      <Field label="Zakres"><Segmented value={command.extent} options={[{ id: 'one-side', label: 'Odległość' }, { id: 'symmetric', label: 'Symetrycznie' }, ...(command.operation === 'cut' ? [{ id: 'through-all', label: 'Na wylot' }] : [])]} onChange={(extent) => updateCommand({ extent })} /></Field>
                      {command.extent !== 'through-all' && (
                        <Field label="Odległość">
                          <input autoFocus onFocus={(event) => event.target.select()} value={command.distance} onChange={(event) => updateCommand({ distance: event.target.value })} />
                          <em>mm</em>
                        </Field>
                      )}
                      {command.extent === 'one-side' && <label className="check"><input type="checkbox" checked={command.flip} onChange={(event) => updateCommand({ flip: event.target.checked })} />Odwróć kierunek</label>}
                    </>
                  )}
                  {command.type === 'revolve' && (
                    <>
                      <Field label="Oś"><Segmented value={command.axisId} options={revolveAxes(document.sketches.find((sketch) => sketch.id === command.sketchId)?.plane)} onChange={(axisId) => updateCommand({ axisId })} /></Field>
                      <Field label="Kąt"><input value={command.angle} onChange={(event) => updateCommand({ angle: event.target.value })} /><em>°</em></Field>
                    </>
                  )}
                  {(command.type === 'fillet' || command.type === 'chamfer') && (
                    <>
                      <p className="hint">Krawędzie: {command.references.length || 'kliknij krawędzie bryły'}</p>
                      <Field label={command.type === 'fillet' ? 'Promień' : 'Odległość'}><input autoFocus onFocus={(event) => event.target.select()} value={command.size} onChange={(event) => updateCommand({ size: event.target.value })} /><em>mm</em></Field>
                    </>
                  )}
                  {command.type === 'shell' && (
                    <>
                      <p className="hint">Otwarte ściany: {command.references.length || 'kliknij ściany do usunięcia'}</p>
                      <Field label="Grubość ścianki"><input autoFocus onFocus={(event) => event.target.select()} value={command.thickness} onChange={(event) => updateCommand({ thickness: event.target.value })} /><em>mm</em></Field>
                    </>
                  )}
                  {command.type === 'hole' && (
                    <>
                      <p className="hint">Otwory: {command.pointIds.length} · kierunek w głąb bryły</p>
                      <Field label="Typ"><Segmented value={command.holeType} options={[{ id: 'simple', label: 'Prosty' }, { id: 'counterbore', label: 'Pogłębiony' }, { id: 'countersink', label: 'Stożkowy' }]} onChange={(holeType) => updateCommand({ holeType })} /></Field>
                      <Field label="Średnica"><input autoFocus onFocus={(event) => event.target.select()} value={command.diameter} onChange={(event) => updateCommand({ diameter: event.target.value })} /><em>mm</em></Field>
                      <Field label="Zakres"><Segmented value={command.extent} options={[{ id: 'through-all', label: 'Na wylot' }, { id: 'distance', label: 'Głębokość' }]} onChange={(extent) => updateCommand({ extent })} /></Field>
                      {command.extent === 'distance' && <Field label="Głębokość"><input onFocus={(event) => event.target.select()} value={command.depth} onChange={(event) => updateCommand({ depth: event.target.value })} /><em>mm</em></Field>}
                    </>
                  )}
                  {(command.type === 'pattern' || command.type === 'mirror') && (
                    <Field label="Powtórz">
                      <select className="select" value={command.sourceId} onChange={(event) => updateCommand({ sourceId: event.target.value })}>
                        {repeatSources(command.targetBodyId).filter((feature) => feature.id !== command.editId).map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}
                        <option value="body">Całą bryłę</option>
                      </select>
                    </Field>
                  )}
                  {command.type === 'pattern' && (
                    <>
                      <Field label="Układ"><Segmented value={command.patternType} options={[{ id: 'rectangular', label: 'Prostokątny' }, { id: 'circular', label: 'Kołowy' }]} onChange={(patternType) => updateCommand({ patternType })} /></Field>
                      {command.patternType === 'rectangular' ? (
                        <>
                          <Field label="Płaszczyzna"><Segmented value={command.plane} options={PLANE_OPTIONS} onChange={(plane) => updateCommand({ plane })} /></Field>
                          <Field label="Ilość"><input autoFocus onFocus={(event) => event.target.select()} value={command.countX} onChange={(event) => updateCommand({ countX: event.target.value })} /><em>szt.</em></Field>
                          <Field label="Odstęp"><input onFocus={(event) => event.target.select()} value={command.spacingX} onChange={(event) => updateCommand({ spacingX: event.target.value })} /><em>mm</em></Field>
                          <Field label="Rzędy"><input onFocus={(event) => event.target.select()} value={command.countY} onChange={(event) => updateCommand({ countY: event.target.value })} /><em>szt.</em></Field>
                          {String(command.countY).trim() !== '1' && <Field label="Odstęp rzędów"><input onFocus={(event) => event.target.select()} value={command.spacingY} onChange={(event) => updateCommand({ spacingY: event.target.value })} /><em>mm</em></Field>}
                        </>
                      ) : (
                        <>
                          <Field label="Oś"><Segmented value={command.axisId} options={AXIS_OPTIONS} onChange={(axisId) => updateCommand({ axisId })} /></Field>
                          <Field label="Ilość"><input autoFocus onFocus={(event) => event.target.select()} value={command.occurrences} onChange={(event) => updateCommand({ occurrences: event.target.value })} /><em>szt.</em></Field>
                          <Field label="Kąt"><input onFocus={(event) => event.target.select()} value={command.totalAngle} onChange={(event) => updateCommand({ totalAngle: event.target.value })} /><em>°</em></Field>
                        </>
                      )}
                    </>
                  )}
                  {command.type === 'mirror' && (
                    <Field label="Płaszczyzna"><Segmented value={command.plane} options={PLANE_OPTIONS} onChange={(plane) => updateCommand({ plane })} /></Field>
                  )}
                  {previewError && <p className="error">{previewError}</p>}
                  <footer>
                    <button type="button" onClick={cancelCommand}>Anuluj</button>
                    <button type="button" className="primary" disabled={!previewFeature || Boolean(previewError) || (command.references && !command.references.length)} onClick={confirmCommand}><Check size={15} />OK</button>
                  </footer>
                </>
              )}
            </section>
          )}
          {command?.type === 'pickPlane' && (
            <div className="plane-picker">
              <strong>Wybierz płaszczyznę</strong>
              {Object.entries(PLANE_NAMES).map(([plane, label]) => <button key={plane} type="button" onClick={() => { setCommand(null); createPlaneSketch(plane); }}>{label}</button>)}
              <button type="button" className="ghost" onClick={() => setCommand(null)}>Anuluj</button>
            </div>
          )}
        </main>
      </div>
      )}

      <footer className="timeline" aria-label="Historia operacji">
        <span className="timeline-label">Historia</span>
        <div className="timeline-track">
          {!solidFeatures.length && <span className="empty">Tu pojawią się operacje: wyciągnięcia, zaokrąglenia…</span>}
          {solidFeatures.map((feature) => {
            const state = timelineStatus.get(feature.id);
            const failed = state?.status === 'error';
            return (
              <div key={feature.id} className={`step ${failed ? 'failed' : ''} ${feature.suppressed ? 'suppressed' : ''} ${command?.editId === feature.id ? 'editing' : ''}`} title={failed ? state.error : `${feature.name} — dwuklik: edytuj`} onDoubleClick={() => editFeature(feature)}>
                <span className="step-name">{feature.name || featureLabel(feature)}</span>
                <span className="step-actions">
                  <button type="button" title="Edytuj" onClick={() => editFeature(feature)}><Pencil size={12} /></button>
                  <button type="button" title={feature.suppressed ? 'Włącz' : 'Wyłącz'} onClick={() => toggleFeature(feature)}>{feature.suppressed ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                  <button type="button" title="Usuń" onClick={() => deleteFeature(feature.id)}><Trash2 size={12} /></button>
                </span>
              </div>
            );
          })}
        </div>
      </footer>

      <input ref={fileInputRef} type="file" accept=".madcad,.json" hidden onChange={openFromInput} />
      {licenseOpen && (
        <LicenseInfoDialog
          licensePlan={licensePlan} busy={licenseBusy} error={licenseError} allowVerificationBypass={verifyMode}
          onLogin={(data) => runLicenseAction('licenseLogin', data)} onRegister={(data) => runLicenseAction('licenseRegister', data)}
          onStartTrial={() => runLicenseAction('licenseStartTrial')} onLogout={() => runLicenseAction('licenseLogout')} onRefresh={() => runLicenseAction('licenseGetStatus')}
          onRequestPasswordReset={(data) => runLicenseAction('licenseRequestPasswordReset', data)} onResetPassword={(data) => runLicenseAction('licenseResetPassword', data)}
          onResendVerification={() => runLicenseAction('licenseResendVerification')} onVerifyEmail={(data) => runLicenseAction('licenseVerifyEmail', data)}
          onClose={() => { if (licensePlan.accessAllowed || verifyMode) setLicenseOpen(false); }}
          onShowFullLicense={() => { setLicenseOpen(false); setFullLicenseOpen(true); }}
        />
      )}
      {fullLicenseOpen && <FullLicenseDialog onClose={() => { setFullLicenseOpen(false); if (!licensePlan.accessAllowed && !verifyMode) setLicenseOpen(true); }} />}
      {updateState.open && !licenseOpen && <UpdateDialog state={updateState} onCheck={checkForUpdates} onInstall={installUpdate} onClose={() => setUpdateState((current) => ({ ...current, open: false }))} />}
    </div>
  );
}
