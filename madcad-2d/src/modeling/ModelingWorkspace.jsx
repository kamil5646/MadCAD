import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Blocks,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDotDashed,
  Copy,
  Crosshair,
  Cylinder,
  FileBox,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderPlus,
  Frame,
  Grid2X2,
  HardDriveDownload,
  History,
  Hexagon,
  CircleHelp,
  Eye,
  EyeOff,
  Layers3,
  Keyboard,
  Maximize2,
  Minus,
  Move,
  Move3d,
  Pencil,
  PencilRuler,
  Printer,
  Redo2,
  Rotate3d,
  RotateCw,
  Ruler,
  Save,
  ScanSearch,
  Search,
  Scissors,
  Shapes,
  SkipBack,
  Square,
  StepBack,
  StepForward,
  Triangle,
  Trash2,
  Type,
  Ungroup,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import madcadIconUrl from '../../assets/icons/madcad-512.png';
import {
  DOCUMENT_SCHEMA_VERSION,
  cloneDocument,
  createCircleProfile,
  createDocument,
  createFeature,
  createRectangleProfile,
  createSketch,
  createStarterDocument,
  openDocument,
  validateDocument,
} from '../cad-core/document.js';
import { createLinkedProject, linkedProjectState } from '../cad-core/linked-projects.js';
import { compareProjectDocuments } from '../cad-core/project-diff.js';
import { createProjectHealthReport } from '../cad-core/project-health.js';
import { dependencyNodeIdForSelection, inspectProjectDependencies } from '../cad-core/project-dependencies.js';
import { buildProjectSearchIndex } from '../cad-core/project-search.js';
import { formControlSymmetryPairs, translateFormControlPoints, updateFormControlOffset } from '../cad-core/subdivision-form.js';
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
import { addAutomaticConstraintsForLine, inferLineConstraintSuggestion } from '../cad-core/sketch-constraint-suggestions.js';
import { breakSketchEntity, chamferSketchLines, extendSketchEntity, filletSketchLines, offsetSketchEntities, offsetSketchProfile, trimSketchEntity } from '../cad-core/sketch-modifiers.js';
import { copySketchSelection, mirrorSketchSelection, rotateSketchSelection, scaleSketchSelection } from '../cad-core/sketch-transforms.js';
import { circularSketchPattern, pathSketchPattern, rectangularSketchPattern } from '../cad-core/sketch-patterns.js';
import { applySketchConstraintSolution, solveSketchConstraints, SKETCH_SOLVER_STATUS } from '../cad-core/sketch-solver.js';
import { evaluateExpression, resolveParameters } from '../cad-core/expressions.js';
import { useCadEngine } from '../cad-core/useCadEngine.js';
import { createTopologyReference, inspectTopologyReferences, reassignTopologyReference } from '../cad-core/topology-references.js';
import { createAnglePlane, createMidplane, createOffsetPlane, createPathPlane, createTangentPlane, createThreePointPlane, resolveConstructionPlane, resolveConstructionPlanes } from '../cad-core/construction-planes.js';
import { createCylinderAxis, createEdgeAxis, createPlaneIntersectionAxis, createPlaneNormalAxis, createTwoPointAxis, resolveConstructionAxis, resolveConstructionAxes } from '../cad-core/construction-axes.js';
import { createCenterPoint, createIntersectionPoint, createMidpointPoint, createPointOnAxis, createVertexPoint, resolveConstructionPoint, resolveConstructionPoints } from '../cad-core/construction-points.js';
import { projectTopologyToSketch, synchronizeProjectedGeometry } from '../cad-core/sketch-projection.js';
import { resolveFaceEdgeHolePlacement } from '../cad-core/face-edge-hole.js';
import { measureSelection } from '../cad-core/measure-selection.js';
import { calculateMassProperties } from '../cad-core/mass-properties.js';
import { DRAFT_DIRECTIONS, analyzeDraftAngles, analyzeWallThickness, summarizeGeometryInspection } from '../cad-core/geometry-inspection.js';
import { applyPrinterProfile, PRINTER_PROFILES } from '../cad-core/printer-profiles.js';
import { calculatePrintLayout, orientationForBedFace } from '../cad-core/print-layout.js';
import { inspectThreeMfArchive } from '../cad-core/three-mf.js';
import { formatModelFileSize, inspectModelImportBuffer, normalizeModelUnit, parseStlMesh } from '../cad-core/model-import.js';
import { fillMeshHoles, groupMeshFaces, inspectMesh, meshToBinaryStl, orientMeshFaces, reduceMesh, remeshUniform, repairMesh, smoothMesh } from '../cad-core/mesh-tools.js';
import { analyzePrintability } from '../cad-core/print-analysis.js';
import { inspectSketchImport, parseSketchImport } from '../cad-core/sketch-import.js';
import { createId } from '../cad-core/ids.js';
import { createBalloonDrawingAnnotation, createBaseDrawingView, createCenterMarkDrawingAnnotation, createCenterlineDrawingAnnotation, createDetailDrawingView, createDrawingRevision, createDrawingSheet, createDrawingTable, createFeatureControlFrameDrawingAnnotation, createHoleNoteDrawingAnnotation, createLinearDrawingDimension, createProjectedDrawingView, createSectionDrawingView, createSketchDrawingView, drawingBomItemNumber, drawingPageDimensions, drawingSheetDxf, drawingSheetHtml, recommendedDrawingScale, recommendedSketchDrawingScale } from '../cad-core/drawing-sheets.js';
import { assignEntitiesToLayer, createLayer, deleteLayer } from '../cad-core/layers.js';
import { assignBodiesToComponent, componentParentMap, createComponent, createComponentInstance, createRigidGroup, deleteComponent, deleteComponentInstance, deleteRigidGroup, duplicateComponentInstance, moveComponent, updateComponent, updateComponentInstance } from '../cad-core/components.js';
import { createAssemblyJoint, createMotionLink, deleteAssemblyJoint, deleteMotionLink, setJointValue, updateAssemblyJoint, updateMotionLink } from '../cad-core/assembly-joints.js';
import { applyAssemblyConfiguration, createAssemblyConfiguration, createContactSet, deleteAssemblyConfiguration, deleteContactSet, detectAssemblyCollisions, updateAssemblyConfiguration, updateContactSet } from '../cad-core/assembly-motion.js';
import { createNamedView, deleteNamedView } from '../cad-core/named-views.js';
import {
  addBlockAttributeDefinition,
  createBlockDefinition,
  deleteBlockDefinition,
  deleteBlockInstance,
  explodeBlockInstance,
  insertBlockInstance,
  updateBlockInstanceAttributes,
} from '../cad-core/blocks.js';
import {
  createTimelineFeatureGroup,
  deleteTimelineFeatureGroup,
  deleteTimelineFeatureCascade,
  dependentTimelineFeatureIds,
  insertTimelineFeature,
  moveTimelineFeature,
  renameTimelineFeature,
  setTimelineRollback,
  setTimelineFeatureSuppressed,
  updateTimelineFeatureGroup,
} from '../cad-core/timeline-operations.js';
import { findUntranslatedModelingText, observeModelingLocalization, resolveModelingLanguage } from './i18n.js';
import { FirstPartTutorial, FullLicenseDialog, LicenseInfoDialog, UpdateDialog } from './AppDialogs.jsx';
import { CommandLine } from './CommandLine.jsx';
import { CommandDialog } from './CommandDialog.jsx';
import { planCommandLineSubmission } from './command-controller.js';
import {
  createDefaultCommandCustomization,
  customizationForTool,
  loadCommandCustomization,
  saveCommandCustomization,
} from './command-customization.js';
import { isDockableCommand, panelScreenKey, readPanelLayout, writePanelLayout } from './panel-layout.js';
import { mergeResumableSketches, resolveResumableSketch, resolveResumableSketches, resolveVisibleSketchId } from './sketch-visibility.js';
import { resolveExtrudeSource } from './extrude-source.js';
import { analyzeSurfaceContinuity, summarizeMeshCurvature } from './surface-analysis.js';
import { multipleSelectionLabel, primaryModifierPressed } from './platform-shortcuts.js';
import { downloadBlob, prepareProjectSave, readProjectFile, safeName, useDocumentHistory } from './workspace-document.js';
import { ResponsiveRibbon, RibbonGroup, ToolButton, ToolHelpContext, ToolMenuButton } from './WorkspaceRibbon.jsx';
import {
  AnglePlaneCadIcon,
  AxisCadIcon,
  BooleanCadIcon,
  ChamferCadIcon,
  CoilCadIcon,
  CylinderAxisCadIcon,
  DeleteFaceCadIcon,
  DraftCadIcon,
  EditFeatureCadIcon,
  ExtrudeCadIcon,
  FilletCadIcon,
  GeometryCheckCadIcon,
  HoleCadIcon,
  LoftCadIcon,
  MassCadIcon,
  MidplaneCadIcon,
  MoveBodyCadIcon,
  OffsetFaceCadIcon,
  PathPlaneCadIcon,
  PatternCadIcon,
  PlaneCadIcon,
  PointCadIcon,
  PressPullCadIcon,
  PrimitiveCadIcon,
  ReplaceFaceCadIcon,
  RevolveCadIcon,
  RotateBodyCadIcon,
  SectionCadIcon,
  ShellCadIcon,
  SketchCadIcon,
  SplitBodyCadIcon,
  SplitFaceCadIcon,
  SweepCadIcon,
  TangentPlaneCadIcon,
  ThreePointPlaneCadIcon,
} from './CadToolIcons.jsx';
import { WorkspaceDialogStack } from './WorkspaceDialogStack.jsx';
import { AdaptiveToolShelf } from './WorkspaceSketchUi.jsx';
import DrawingWorkspace from './DrawingWorkspace.jsx';
import { CrashRecoveryBanner, ProjectBrowser, ProjectComparisonPanel, ProjectDashboard, ProjectDependenciesPanel, ProjectHealthPanel, ProjectSearchPalette, ProjectSnapshotsPanel, StartPage, TopologyReferenceRepairPanel } from './WorkspaceOverlays.jsx';
import { BlocksPanel, CommandCustomizationPanel, ComponentPanel, Field, GeometryInspectionPanel, LayersPanel, MassPropertiesPanel, MeasurePanel, MeshToolsPanel, NamedViewsPanel, SectionPanel, SurfaceAnalysisPanel } from './WorkspacePanels.jsx';
import {
  AUTOSAVE_KEY,
  clearLocalAutosave,
  documentModifiedAt,
  hasUnsavedSession,
  loadInitialDocument,
  writeLocalAutosave,
} from './document-session.js';
import './modeling.css';

function pointerPromptForCommand(command) {
  if (!command) return null;
  const step = command.gesturePoints?.length || 0;
  if (command.type === 'rectangle') {
    if (command.definition === 'center') return step ? 'Wskaż narożnik wyznaczający rozmiar' : 'Wskaż środek prostokąta';
    if (command.definition === 'threePoints') return ['Wskaż początek pierwszego boku', 'Wskaż koniec pierwszego boku', 'Wskaż punkt wysokości'][step] || 'Wskaż punkt wysokości';
    return step ? 'Wskaż przeciwległy narożnik' : 'Wskaż pierwszy narożnik';
  }
  if (command.type === 'circle') {
    if (command.definition === 'twoPoints') return step ? 'Wskaż drugi punkt średnicy' : 'Wskaż pierwszy punkt średnicy';
    if (command.definition === 'threePoints') return ['Wskaż pierwszy punkt okręgu', 'Wskaż drugi punkt okręgu', 'Wskaż trzeci punkt okręgu'][step] || 'Wskaż trzeci punkt okręgu';
    return step ? 'Wskaż punkt promienia' : 'Wskaż środek okręgu';
  }
  if (command.type === 'arc') return command.definition === 'centerStartEnd' ? ['Wskaż środek łuku', 'Wskaż początek łuku', 'Wskaż koniec łuku'][step] : ['Wskaż początek łuku', 'Wskaż punkt na łuku', 'Wskaż koniec łuku'][step];
  if (command.type === 'polygon') return command.definition === 'edge' ? (step ? 'Wskaż koniec krawędzi' : 'Wskaż początek krawędzi') : (step ? 'Wskaż wierzchołek' : 'Wskaż środek wielokąta');
  if (command.type === 'ellipse') return ['Wskaż środek elipsy', 'Wskaż koniec osi głównej', 'Wskaż szerokość elipsy'][step];
  if (command.type === 'slot') return ['Wskaż początek osi slotu', 'Wskaż koniec osi slotu', 'Wskaż szerokość slotu'][step];
  if (command.type === 'spline') return 'Klikaj kolejne punkty spline';
  if (command.type === 'conic') return ['Wskaż początek krzywej', 'Wskaż punkt kontrolny', 'Wskaż koniec krzywej'][step];
  if (command.type === 'point') return 'Wskaż położenie punktu';
  if (command.type === 'line') return command.lastPoint ? 'Ustaw kierunek kursorem' : 'Wskaż punkt początkowy linii';
  if (command.type === 'polyline') return 'Klikaj kolejne punkty; kliknij początek, aby zamknąć';
  return null;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

const ModelViewport = React.lazy(() => import('./ModelViewport.jsx'));
const DESKTOP_PLATFORM = ['darwin', 'win32', 'linux'].includes(window.desktopApp?.platform)
  ? window.desktopApp.platform
  : 'web';

const MAIN_TABS = [
  { id: 'solid', label: 'PROJEKTUJ' },
  { id: 'drawing', label: 'ARKUSZ 2D' },
  { id: 'tools', label: 'ZARZĄDZAJ' },
];
const LANGUAGE_KEY = 'madcad:interface-language';

function readStoredLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY);
  } catch (_error) {
    return null;
  }
}

const PLANE_LABELS = { XY: 'Góra (XY)', XZ: 'Przód (XZ)', YZ: 'Prawo (YZ)' };






function PrintPanel({ document, bodies, engine, selectedFace, commit, collapsed, onSelectIssue, onExport, onSendToSlicer, onClose, onToggleCollapsed, readOnly = false }) {
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
    <aside className={`print-panel print-inspector ${collapsed ? 'collapsed' : ''}`}>
      <header>
        <div><strong>DRUK 3D</strong>{!collapsed && <span>Ułożenie na stole, kontrola drukowalności i przekazanie do slicera.</span>}</div>
        <div className="dock-panel-actions">
          <button type="button" data-panel-action="collapse" onClick={onToggleCollapsed} title={collapsed ? 'Rozwiń panel druku 3D' : 'Zwiń panel druku 3D'} aria-label={collapsed ? 'Rozwiń panel druku 3D' : 'Zwiń panel druku 3D'} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>
          {!collapsed && <button type="button" onClick={onClose} title="Zamknij panel druku 3D" aria-label="Zamknij panel druku 3D"><X size={16} /></button>}
        </div>
      </header>
      {!collapsed && <>
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
      </>}
    </aside>
  );
}

function featureIcon(type, size = 16) {
  if (type === 'revolve' || type === 'surfaceRevolve') return <Rotate3d size={size} />;
  if (type === 'sweep' || type === 'surfaceSweep') return <Move3d size={size} />;
  if (type === 'loft' || type === 'surfaceLoft') return <Layers3 size={size} />;
  if (type === 'rib') return <Frame size={size} />;
  if (type === 'coil') return <RotateCw size={size} />;
  if (type === 'pipe') return <Cylinder size={size} />;
  if (type === 'pattern') return <Grid2X2 size={size} />;
  if (type === 'boolean') return <Shapes size={size} />;
  if (type === 'hole') return <Cylinder size={size} />;
  if (type === 'fillet') return <CircleDotDashed size={size} />;
  if (type === 'chamfer') return <Triangle size={size} />;
  if (type === 'shell') return <Layers3 size={size} />;
  if (type === 'draft') return <Triangle size={size} />;
  if (type === 'splitBody') return <Scissors size={size} />;
  if (type === 'splitFace') return <Scissors size={size} />;
  if (type === 'deleteFace') return <X size={size} />;
  if (type === 'replaceFace') return <Layers3 size={size} />;
  if (type === 'primitive') return <Box size={size} />;
  if (type === 'transform') return <Move3d size={size} />;
  if (type === 'offsetFace' || type === 'surfaceOffset' || type === 'surfaceStitch') return <Layers3 size={size} />;
  if (type === 'surfaceTrim' || type === 'surfaceExtend') return <Scissors size={size} />;
  if (type === 'textSolid') return <Type size={size} />;
  if (type === 'importedModel') return <Upload size={size} />;
  return <Box size={size} />;
}

export default function ModelingWorkspace() {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [licenseInfoOpen, setLicenseInfoOpen] = useState(true);
  const [fullLicenseOpen, setFullLicenseOpen] = useState(false);
  const [expandedSketchRibbon, setExpandedSketchRibbon] = useState(() => window.matchMedia('(min-width: 1260px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1260px)');
    const update = () => setExpandedSketchRibbon(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [language] = useState(() => {
    const requestedLanguage = new URLSearchParams(window.location.search).get('verifyLanguage')
      || readStoredLanguage()
      || window.desktopApp?.appLanguage;
    return resolveModelingLanguage(requestedLanguage, window.navigator.language);
  });
  const [updateState, setUpdateState] = useState({ open: false, promptPending: false, status: 'idle', result: null, handoff: null, error: '' });
  const checkForUpdates = useCallback(async (silent = false) => {
    if (!window.desktopApp?.checkForUpdates) {
      if (!silent) setUpdateState({ open: true, promptPending: false, status: 'idle', result: null, error: 'Aktualizacje są dostępne w zainstalowanej aplikacji desktopowej.' });
      return null;
    }
    setUpdateState((current) => ({ ...current, open: !silent || current.open, status: 'checking', error: '' }));
    try {
      const result = await window.desktopApp.checkForUpdates();
      setUpdateState({
        open: !silent,
        promptPending: silent && Boolean(result?.available),
        status: 'idle',
        result,
        handoff: null,
        error: result?.ok === false ? result.error || 'Nie udało się sprawdzić aktualizacji.' : '',
      });
      return result;
    } catch (error) {
      setUpdateState({ open: !silent, promptPending: false, status: 'idle', result: null, error: error.message });
      return null;
    }
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => { void checkForUpdates(true); }, 1800);
    return () => window.clearTimeout(timeout);
  }, [checkForUpdates]);
  const updatePromptBlocked = tutorialOpen || licenseInfoOpen || fullLicenseOpen;
  useEffect(() => {
    if (updatePromptBlocked || !updateState.promptPending) return;
    setUpdateState((current) => ({ ...current, open: true, promptPending: false }));
  }, [updatePromptBlocked, updateState.promptPending]);
  useEffect(() => {
    const root = window.document.querySelector('.modeling-shell');
    window.document.documentElement.lang = language;
    return observeModelingLocalization(root, language);
  }, [language]);
  const [initialOpen] = useState(loadInitialDocument);
  const history = useDocumentHistory(initialOpen.document);
  const { document } = history;
  const replaceDocument = history.replace;
  const serializedDocument = useMemo(() => JSON.stringify(document), [document]);
  const initialDocumentTextRef = useRef(JSON.stringify(initialOpen.document));
  const documentRef = useRef(document);
  documentRef.current = document;
  const [documentAccess, setDocumentAccess] = useState({
    readOnly: Boolean(initialOpen.readOnly),
    sourceVersion: initialOpen.sourceVersion,
    originalDocument: initialOpen.originalDocument || null,
  });
  const [savedDocumentText, setSavedDocumentText] = useState(() => (
    initialOpen.recovered ? null : initialDocumentTextRef.current
  ));
  const [currentPath, setCurrentPath] = useState('');
  const currentPathRef = useRef('');
  currentPathRef.current = currentPath;
  const [persistenceReady, setPersistenceReady] = useState(() => !window.desktopApp?.autosaveRead);
  const [workspace, setWorkspace] = useState('solid');
  const [activeDrawingSheetId, setActiveDrawingSheetId] = useState(() => document.drawings[0]?.id || null);
  const [selectedDrawingViewId, setSelectedDrawingViewId] = useState(null);
  const [selectedDrawingAnnotationId, setSelectedDrawingAnnotationId] = useState(null);
  const [drawingPropertyFocus, setDrawingPropertyFocus] = useState(null);
  const [selection, setSelection] = useState({ kind: 'document', id: document.id });
  const [activeSketchId, setActiveSketchId] = useState(null);
  const [command, setCommand] = useState(null);
  const [commandHistory, setCommandHistory] = useState([]);
  const [toolHelp, setToolHelp] = useState(null);
  const [sectionAnalysis, setSectionAnalysis] = useState(null);
  const [surfaceAnalysis, setSurfaceAnalysis] = useState(null);
  const [meshToolsOpen, setMeshToolsOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(true);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [componentsOpen, setComponentsOpen] = useState(false);
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [namedViewsOpen, setNamedViewsOpen] = useState(false);
  const [cameraRequest, setCameraRequest] = useState(null);
  const [linkedProjectStatuses, setLinkedProjectStatuses] = useState({});
  const [commandCustomizationOpen, setCommandCustomizationOpen] = useState(false);
  const [commandCustomization, setCommandCustomization] = useState(() => loadCommandCustomization(window.localStorage));
  const [printPanelOpen, setPrintPanelOpen] = useState(false);
  const [timelineRename, setTimelineRename] = useState(null);
  const [timelineGroupRename, setTimelineGroupRename] = useState(null);
  const [timelineDeleteId, setTimelineDeleteId] = useState(null);
  const [projectSnapshotsOpen, setProjectSnapshotsOpen] = useState(false);
  const [projectSnapshots, setProjectSnapshots] = useState([]);
  const [projectSnapshotsLoading, setProjectSnapshotsLoading] = useState(false);
  const [projectSnapshotsError, setProjectSnapshotsError] = useState('');
  const [projectComparisonOpen, setProjectComparisonOpen] = useState(false);
  const [projectComparisonBaseline, setProjectComparisonBaseline] = useState(null);
  const [projectComparisonLoading, setProjectComparisonLoading] = useState(false);
  const [projectComparisonError, setProjectComparisonError] = useState('');
  const [projectHealthOpen, setProjectHealthOpen] = useState(false);
  const [projectDependenciesOpen, setProjectDependenciesOpen] = useState(false);
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [projectDependencyNodeId, setProjectDependencyNodeId] = useState(() => initialOpen.document.id);
  const panelScreenKeyRef = useRef(panelScreenKey(window.screen));
  const [panelLayout, setPanelLayout] = useState(() => readPanelLayout(window.localStorage, window.screen));
  const [recoveryInfo, setRecoveryInfo] = useState(() => initialOpen.recovered ? {
    source: initialOpen.recoverySource || 'local-primary',
    backup: initialOpen.recoverySource === 'local-backup',
    updatedAt: initialOpen.document?.metadata?.modifiedAt || null,
  } : null);
  const [sketchOptions, setSketchOptions] = useState({ grid: true, snap: true, snapDistance: 12, autoConstraints: true, profiles: true, points: true, dimensions: true, constraints: true, construction: true, projected: true, slice: false, sketch3d: false });
  const [notice, setNotice] = useState(initialOpen.warning || 'Gotowe. Zacznij od rysunku 2D albo otwórz projekt.');
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);
  const sketchImportInputRef = useRef(null);
  const sketchPointerRef = useRef(null);
  const sketchDynamicLengthRef = useRef('');
  const currentCameraRef = useRef(null);
  const helpMenuRef = useRef(null);
  const shortcutRegistryRef = useRef(new Map());
  const autosaveQueueRef = useRef(Promise.resolve());
  const autosaveSuspendedRef = useRef(false);
  const [importDraft, setImportDraft] = useState(null);
  const [modelImportBusy, setModelImportBusy] = useState(false);
  const [pendingModelImport, setPendingModelImport] = useState(null);
  const [fitViewRequest, setFitViewRequest] = useState(null);
  const [sketchImportDraft, setSketchImportDraft] = useState(null);
  const [importRepairReport, setImportRepairReport] = useState(null);
  useEffect(() => setExplodeAmount(0), [document.id]);
  useEffect(() => {
    if (command) setImportRepairReport(null);
  }, [command]);
  useEffect(() => {
    writePanelLayout(panelLayout, window.localStorage, window.screen);
  }, [panelLayout]);
  useEffect(() => {
    if (!fileMenuOpen) return undefined;
    const closeFileMenu = (event) => { if (event.key === 'Escape') setFileMenuOpen(false); };
    window.addEventListener('keydown', closeFileMenu);
    return () => window.removeEventListener('keydown', closeFileMenu);
  }, [fileMenuOpen]);
  useEffect(() => {
    setToolHelp(null);
    helpMenuRef.current?.removeAttribute('open');
    if (workspace === 'drawing') setBrowserOpen(false);
  }, [workspace, activeSketchId, command?.type]);
  useEffect(() => {
    const dismissTransientChrome = (event) => {
      setToolHelp(null);
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && helpMenuRef.current?.contains(event.target)) return;
      helpMenuRef.current?.removeAttribute('open');
    };
    window.addEventListener('pointerdown', dismissTransientChrome, true);
    window.addEventListener('keydown', dismissTransientChrome, true);
    return () => {
      window.removeEventListener('pointerdown', dismissTransientChrome, true);
      window.removeEventListener('keydown', dismissTransientChrome, true);
    };
  }, []);
  useEffect(() => {
    const restoreLayoutForCurrentMonitor = () => {
      const nextKey = panelScreenKey(window.screen);
      if (nextKey === panelScreenKeyRef.current) return;
      panelScreenKeyRef.current = nextKey;
      setPanelLayout(readPanelLayout(window.localStorage, window.screen));
    };
    window.addEventListener('resize', restoreLayoutForCurrentMonitor);
    return () => window.removeEventListener('resize', restoreLayoutForCurrentMonitor);
  }, []);
  const registerShortcut = useCallback((shortcut, entry) => {
    const normalizedShortcut = shortcut.toUpperCase();
    shortcutRegistryRef.current.set(normalizedShortcut, entry);
    return () => {
      if (shortcutRegistryRef.current.get(normalizedShortcut) === entry) shortcutRegistryRef.current.delete(normalizedShortcut);
    };
  }, []);
  const appendCommandHistory = useCallback((input, message) => {
    setCommandHistory((current) => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      input: String(input || '').trim(),
      message,
    }, ...current].slice(0, 30));
  }, []);
  const resolveToolCustomization = useCallback((label) => customizationForTool(commandCustomization, label), [commandCustomization]);
  const toolHelpContext = useMemo(() => ({ setToolHelp, registerShortcut, customizationForTool: resolveToolCustomization }), [registerShortcut, resolveToolCustomization]);
  const readOnly = documentAccess.readOnly;
  const dirty = hasUnsavedSession({ readOnly, savedDocumentText, serializedDocument });
  const queueDesktopAutosave = useCallback((text) => {
    if (!window.desktopApp?.autosaveWrite) return Promise.resolve(false);
    const write = autosaveQueueRef.current.catch(() => {}).then(async () => {
      const result = await window.desktopApp.autosaveWrite({ text });
      if (result && result.ok === false) throw new Error(result.error || 'Nie udało się zapisać plikowego autozapisu.');
      return true;
    });
    autosaveQueueRef.current = write;
    return write;
  }, []);
  const persistAutosaveNow = useCallback(async (text) => {
    let localError = null;
    try {
      writeLocalAutosave(text);
    } catch (error) {
      localError = error;
    }
    let desktopSaved = false;
    try {
      desktopSaved = await queueDesktopAutosave(text);
    } catch (error) {
      if (localError) throw new Error(`Lokalny autozapis: ${localError.message}; plikowy autozapis: ${error.message}`);
      throw error;
    }
    if (localError && !desktopSaved) throw localError;
    if (localError) setNotice(`Pamięć lokalna jest pełna (${localError.message}). Projekt zabezpieczono w plikowym autozapisie.`);
    return { localSaved: !localError, desktopSaved };
  }, [queueDesktopAutosave]);
  const clearAutosaveSnapshots = useCallback(async () => {
    autosaveSuspendedRef.current = true;
    try {
      await autosaveQueueRef.current.catch(() => {});
      clearLocalAutosave();
      if (window.desktopApp?.autosaveClear) {
        const result = await window.desktopApp.autosaveClear();
        if (result && result.ok === false) throw new Error(result.error || 'Nie udało się usunąć plikowego autozapisu.');
      }
    } finally {
      autosaveSuspendedRef.current = false;
    }
  }, []);
  const refreshProjectSnapshots = useCallback(async () => {
    if (!window.desktopApp?.projectSnapshotList) {
      setProjectSnapshotsError('Punkty zapisu są dostępne w aplikacji desktopowej.');
      return false;
    }
    setProjectSnapshotsLoading(true);
    setProjectSnapshotsError('');
    try {
      const result = await window.desktopApp.projectSnapshotList();
      if (result?.ok === false) throw new Error(result.error || 'Nie udało się odczytać punktów zapisu.');
      setProjectSnapshots(Array.isArray(result?.snapshots) ? result.snapshots : []);
      if (result?.warning) setNotice(result.warning);
      return true;
    } catch (error) {
      setProjectSnapshotsError(error.message);
      return false;
    } finally {
      setProjectSnapshotsLoading(false);
    }
  }, []);
  const openProjectSnapshots = () => {
    setProjectComparisonOpen(false);
    setProjectHealthOpen(false);
    setProjectDependenciesOpen(false);
    setProjectSearchOpen(false);
    setProjectSnapshotsOpen(true);
    void refreshProjectSnapshots();
  };
  const projectComparison = useMemo(() => projectComparisonBaseline ? compareProjectDocuments(projectComparisonBaseline.document, document) : null, [projectComparisonBaseline, document]);
  const openProjectComparison = () => {
    setProjectSnapshotsOpen(false);
    setProjectHealthOpen(false);
    setProjectDependenciesOpen(false);
    setProjectSearchOpen(false);
    setProjectComparisonOpen(true);
    setProjectComparisonError('');
    void refreshProjectSnapshots();
  };
  const compareProjectText = (text, label) => {
    const opened = openDocument(JSON.parse(text));
    setProjectComparisonBaseline({ document: opened.document, label });
  };
  const compareProjectSnapshot = async (snapshotId) => {
    if (!window.desktopApp?.projectSnapshotRead) return;
    setProjectComparisonLoading(true);
    setProjectComparisonError('');
    try {
      const result = await window.desktopApp.projectSnapshotRead({ id: snapshotId });
      if (result?.ok === false) throw new Error(result.error || 'Nie udało się odczytać punktu zapisu.');
      compareProjectText(result.text, result.snapshot?.name || 'Punkt zapisu');
    } catch (error) {
      setProjectComparisonError(error.message);
    } finally {
      setProjectComparisonLoading(false);
    }
  };
  const compareExternalProject = async () => {
    if (!window.desktopApp?.openProjectFile) {
      setProjectComparisonError('Porównanie z plikiem jest dostępne w aplikacji desktopowej.');
      return;
    }
    setProjectComparisonLoading(true);
    setProjectComparisonError('');
    try {
      const result = await window.desktopApp.openProjectFile();
      if (!result?.ok) {
        if (!result?.canceled) throw new Error(result?.error || 'Nie udało się odczytać projektu.');
        return;
      }
      compareProjectText(result.text, result.filePath?.split(/[\\/]/).pop() || 'Projekt zewnętrzny');
    } catch (error) {
      setProjectComparisonError(error.message);
    } finally {
      setProjectComparisonLoading(false);
    }
  };
  const createProjectSnapshot = async ({ name, description }) => {
    if (!window.desktopApp?.projectSnapshotCreate) return false;
    setProjectSnapshotsError('');
    try {
      const result = await window.desktopApp.projectSnapshotCreate({ name, description, text: serializedDocument });
      if (result?.ok === false) throw new Error(result.error || 'Nie udało się utworzyć punktu zapisu.');
      await refreshProjectSnapshots();
      setNotice(`Utworzono lokalny punkt zapisu „${result.snapshot?.name || name}”.`);
      return true;
    } catch (error) {
      setProjectSnapshotsError(error.message);
      return false;
    }
  };
  const restoreProjectSnapshot = async (snapshotId) => {
    if (!window.desktopApp?.projectSnapshotRead) return;
    setProjectSnapshotsError('');
    try {
      if (readOnly) throw new Error('Przywracanie jest niedostępne dla projektu tylko do odczytu.');
      const result = await window.desktopApp.projectSnapshotRead({ id: snapshotId });
      if (result?.ok === false) throw new Error(result.error || 'Nie udało się otworzyć punktu zapisu.');
      const opened = openDocument(JSON.parse(result.text));
      if (opened.readOnly) throw new Error('Ten punkt zapisu pochodzi z nowszej wersji MadCAD i można go tylko wyświetlić.');
      const restored = cloneDocument(opened.document);
      history.commit((next) => {
        Object.keys(next).forEach((key) => { delete next[key]; });
        Object.assign(next, cloneDocument(restored));
      });
      setDocumentAccess({ readOnly: opened.readOnly, sourceVersion: opened.sourceVersion, originalDocument: opened.originalDocument || null });
      setSavedDocumentText(null);
      setActiveSketchId(null);
      setActiveDrawingSheetId(restored.drawings[0]?.id || null);
      setSelection({ kind: 'document', id: restored.id });
      setWorkspace('solid');
      setCommand(null);
      setRecoveryInfo(null);
      setNotice(`Przywrócono punkt zapisu „${result.snapshot?.name || 'bez nazwy'}”. Undo wraca do poprzedniego stanu.`);
    } catch (error) {
      setProjectSnapshotsError(error.message);
    }
  };
  const deleteProjectSnapshot = async (snapshotId) => {
    if (!window.desktopApp?.projectSnapshotDelete) return;
    setProjectSnapshotsError('');
    try {
      const result = await window.desktopApp.projectSnapshotDelete({ id: snapshotId });
      if (result?.ok === false) throw new Error(result.error || 'Nie udało się usunąć punktu zapisu.');
      await refreshProjectSnapshots();
      setNotice(`Usunięto punkt zapisu „${result.snapshot?.name || 'bez nazwy'}”.`);
    } catch (error) {
      setProjectSnapshotsError(error.message);
    }
  };
  const changeAppLanguage = async (nextLanguage) => {
    const normalized = nextLanguage === 'en' ? 'en' : 'pl';
    if (normalized === language) return;
    if (dirty && !readOnly) {
      try {
        await persistAutosaveNow(serializedDocument);
      } catch (error) {
        setNotice(`Nie zmieniono języka, ponieważ nie udało się zabezpieczyć projektu: ${error.message}`);
        return;
      }
    }
    if (window.desktopApp?.setAppLanguage) {
      const result = await window.desktopApp.setAppLanguage({ language: normalized });
      if (result?.ok === false) {
        setNotice(`Nie udało się zapisać języka: ${result.error || 'nieznany błąd'}`);
        return;
      }
    }
    try {
      window.localStorage.setItem(LANGUAGE_KEY, normalized);
    } catch (error) {
      if (!window.desktopApp?.setAppLanguage) {
        setNotice(`Nie udało się zapisać języka: ${error.message}`);
        return;
      }
    }
    window.location.reload();
  };

  useEffect(() => {
    if (!window.desktopApp?.autosaveRead) return undefined;
    let active = true;
    void (async () => {
      try {
        const result = await window.desktopApp.autosaveRead();
        if (!active) return;
        if (result?.ok === false) {
          setNotice(`Nie udało się odczytać plikowego autozapisu: ${result.error || 'nieznany błąd'}`);
          return;
        }
        if (!result?.exists || !result.text) return;
        const opened = openDocument(JSON.parse(result.text));
        const initialDocumentUnchanged = JSON.stringify(documentRef.current) === initialDocumentTextRef.current;
        if (!initialDocumentUnchanged) {
          setNotice('Znaleziono plikowy autozapis, ale bieżący projekt został już zmieniony. Autozapis pozostawiono bez nadpisywania.');
          return;
        }
        const fileIsPreferred = !initialOpen.recovered
          || documentModifiedAt(opened.document) >= documentModifiedAt(initialOpen.document);
        if (fileIsPreferred && JSON.stringify(opened.document) !== initialDocumentTextRef.current) {
          replaceDocument(opened.document);
          setDocumentAccess({
            readOnly: opened.readOnly,
            sourceVersion: opened.sourceVersion,
            originalDocument: opened.originalDocument || null,
          });
          setSavedDocumentText(null);
          setSelection({ kind: 'document', id: opened.document.id });
          setRecoveryInfo({ source: result.recovered ? 'file-backup' : 'file-primary', backup: Boolean(result.recovered), updatedAt: result.updatedAt || opened.document?.metadata?.modifiedAt || null });
          setNotice(`${result.warning ? `${result.warning} ` : ''}Odzyskano projekt po nieoczekiwanym zamknięciu aplikacji.`);
        } else if (result.warning) {
          setNotice(result.warning);
        }
      } catch (error) {
        if (active) setNotice(`Nie udało się odtworzyć plikowego autozapisu: ${error.message}`);
      } finally {
        if (active) setPersistenceReady(true);
      }
    })();
    return () => { active = false; };
  }, [initialOpen, replaceDocument]);
  useEffect(() => {
    if (command?.type !== 'sectionAnalysis' && sectionAnalysis) setSectionAnalysis(null);
  }, [command?.type, sectionAnalysis]);
  useEffect(() => {
    if (command?.type !== 'surfaceAnalysis' && surfaceAnalysis) setSurfaceAnalysis(null);
  }, [command?.type, surfaceAnalysis]);
  const readOnlyNotice = () => setNotice(`Projekt v${documentAccess.sourceVersion} jest otwarty tylko do odczytu. Utwórz nowy projekt albo otwórz obsługiwaną wersję, aby edytować.`);
  const commit = (mutator) => {
    if (readOnly) {
      readOnlyNotice();
      return;
    }
    history.commit((next) => {
      const existingEntityIds = new Set(next.sketches.flatMap((sketch) => sketch.entities.map((entity) => entity.id)));
      mutator(next);
      for (const sketch of next.sketches) {
        sketch.entities = sketch.entities.map((entity) => existingEntityIds.has(entity.id)
          ? entity
          : { ...entity, layerId: next.activeLayerId });
      }
    });
  };

  const saveNamedView = (name) => {
    try {
      if (!currentCameraRef.current) throw new Error('Kamera modelu nie jest jeszcze gotowa.');
      let created;
      commit((next) => { created = createNamedView(next, { name, camera: currentCameraRef.current }); });
      setNotice(`Zapisano widok „${created.name}”.`);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const activateNamedView = (view) => {
    setCameraRequest({ requestId: `${view.id}:${Date.now()}`, camera: structuredClone(view.camera) });
    setNotice(`Przywrócono widok „${view.name}”.`);
  };
  const removeNamedView = (viewId) => {
    let removed;
    commit((next) => { removed = deleteNamedView(next, viewId); });
    setNotice(`Usunięto widok „${removed.name}”. Operację można cofnąć.`);
  };

  const selectedProfileMatch = document.sketches
    .flatMap((sketch) => sketch.profiles.map((profile) => ({ sketch, profile })))
    .find(({ profile }) => selection?.kind === 'profile' && profile.id === selection.id);
  const selectedProfile = selectedProfileMatch?.profile;
  const commandProfileName = selectedProfile?.name || document.sketches.flatMap((sketch) => sketch.profiles).find((profile) => profile.id === command?.previewFeature?.profileIds?.[0])?.name || '';
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
  const visibleSketchId = resolveVisibleSketchId({
    activeSketchId,
    selection,
    sketches: document.sketches,
    bodyCount: document.bodies.length,
    featureCount: document.features.length,
  });
  const resumableSketchesByPlane = useMemo(() => Object.fromEntries(['XY', 'XZ', 'YZ']
    .map((plane) => [plane, resolveResumableSketch({
      plane,
      sketches: document.sketches,
      bodyCount: document.bodies.length,
      featureCount: document.features.length,
    })])
    .filter(([, sketch]) => Boolean(sketch))), [document.bodies.length, document.features.length, document.sketches]);
  const selectedSketchEntities = (document.sketches.find((item) => item.id === activeSketchId)?.entities || [])
    .filter((entity) => selectedSketchEntityIds.includes(entity.id));
  const selectedBlockInstance = (() => {
    const instanceIds = [...new Set(selectedSketchEntities.map((entity) => entity.blockInstanceId).filter(Boolean))];
    if (instanceIds.length !== 1) return null;
    return document.sketches.find((item) => item.id === activeSketchId)?.blockInstances?.find((instance) => instance.id === instanceIds[0]) || null;
  })();
  const canExtrudeOpenChain = Boolean(activeSketchId && selectedSketchEntities.length && selectedSketchEntities.every((entity) => entity.type === 'line'));
  const canAddCollinear = selectedSketchEntities.length === 2 && selectedSketchEntities.every((entity) => entity.type === 'line');
  const canAddSymmetry = selectedSketchEntities.filter((entity) => entity.type === 'point').length === 2
    && selectedSketchEntities.filter((entity) => entity.type === 'line').length === 1
    && selectedSketchEntities.length === 3;
  const canAddCurvature = selectedSketchEntities.length === 2
    && selectedSketchEntities.every((entity) => entity.type === 'arc')
    && selectedSketchEntities[0].pointIds.slice(1).filter((pointId) => selectedSketchEntities[1].pointIds.slice(1).includes(pointId)).length === 1;
  const canAddOrdinate = selectedSketchEntities.length === 1 && selectedSketchEntities[0].type === 'point';
  const canAddArcLength = selectedSketchEntities.length === 1 && selectedSketchEntities[0].type === 'arc';
  const addDocumentLayer = () => commit((next) => {
    const usedNames = new Set(next.layers.map((layer) => layer.name.toLocaleLowerCase()));
    let index = next.layers.length;
    let name = `Warstwa ${index}`;
    while (usedNames.has(name.toLocaleLowerCase())) name = `Warstwa ${++index}`;
    const layer = createLayer({ name });
    next.layers.push(layer);
    next.activeLayerId = layer.id;
    setNotice(`Utworzono i aktywowano warstwę „${name}”.`);
  });
  const updateDocumentLayer = (layerId, patch) => commit((next) => {
    const layer = next.layers.find((item) => item.id === layerId);
    if (!layer) return;
    Object.assign(layer, patch);
  });
  const removeDocumentLayer = (layerId) => commit((next) => {
    const layer = next.layers.find((item) => item.id === layerId);
    const reassigned = deleteLayer(next, layerId);
    setNotice(`Usunięto warstwę „${layer?.name || layerId}”; przeniesiono ${reassigned} elementów na warstwę 0.`);
  });
  const activateDocumentLayer = (layerId) => commit((next) => { next.activeLayerId = layerId; });
  const assignSelectionToLayer = (layerId) => commit((next) => {
    const changed = assignEntitiesToLayer(next, activeSketchId, selectedSketchEntityIds, layerId);
    setNotice(`Przypisano ${changed} elementów do wybranej warstwy.`);
  });
  const styleSelectedEntities = (patch) => commit((next) => {
    const selected = new Set(selectedSketchEntityIds);
    const sketch = next.sketches.find((item) => item.id === activeSketchId);
    if (!sketch) return;
    sketch.entities = sketch.entities.map((entity) => selected.has(entity.id) ? { ...entity, ...patch } : entity);
  });
  const saveCommandSettings = (nextCustomization) => {
    try {
      const saved = saveCommandCustomization(nextCustomization, window.localStorage);
      setCommandCustomization(saved);
      setNotice('Zapisano skróty i aliasy poleceń. Nowe ustawienia działają od razu.');
    } catch (error) {
      setNotice(`Nie zapisano skrótów: ${error.message}`);
    }
  };
  const createBlockFromSelection = (options) => {
    try {
      const checked = cloneDocument(document);
      const result = createBlockDefinition(checked, activeSketchId, selectedSketchEntityIds, options);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: result.instance.entityIds });
      setNotice(`Utworzono blok „${result.block.name}” i dodano go do biblioteki dokumentu.`);
    } catch (error) {
      setNotice(`Nie utworzono bloku: ${error.message}`);
    }
  };
  const insertDocumentBlock = (blockId, options) => {
    try {
      const checked = cloneDocument(document);
      const result = insertBlockInstance(checked, activeSketchId, blockId, { ...options, layerId: checked.activeLayerId });
      refreshDetectedSketchProfiles(checked.sketches.find((item) => item.id === activeSketchId), checked.parameters);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: result.instance.entityIds });
      setNotice(`Wstawiono blok z ${result.entities.filter((entity) => entity.type !== 'point').length} elementami.`);
    } catch (error) {
      setNotice(`Nie wstawiono bloku: ${error.message}`);
    }
  };
  const removeBlockDefinition = (blockId) => {
    try {
      const checked = cloneDocument(document);
      deleteBlockDefinition(checked, blockId);
      commit((next) => Object.assign(next, checked));
      setNotice('Usunięto nieużywaną definicję z biblioteki bloków.');
    } catch (error) {
      setNotice(`Nie usunięto definicji: ${error.message}`);
    }
  };
  const addDocumentBlockAttribute = (blockId, attribute) => {
    try {
      const checked = cloneDocument(document);
      addBlockAttributeDefinition(checked, blockId, attribute);
      commit((next) => Object.assign(next, checked));
      setNotice(`Dodano atrybut ${attribute.tag.toUpperCase()} do definicji bloku.`);
    } catch (error) {
      setNotice(`Nie dodano atrybutu: ${error.message}`);
    }
  };
  const updateDocumentBlockAttribute = (instanceId, tag, value) => commit((next) => {
    updateBlockInstanceAttributes(next, activeSketchId, instanceId, { [tag]: value });
  });
  const explodeDocumentBlock = (instanceId) => {
    try {
      const checked = cloneDocument(document);
      const entityIds = explodeBlockInstance(checked, activeSketchId, instanceId);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: entityIds });
      setNotice('Rozbito blok na zwykłą edytowalną geometrię. Cofnij przywraca wystąpienie.');
    } catch (error) {
      setNotice(`Nie rozbito bloku: ${error.message}`);
    }
  };
  const removeDocumentBlockInstance = (instanceId) => {
    try {
      const checked = cloneDocument(document);
      deleteBlockInstance(checked, activeSketchId, instanceId);
      refreshDetectedSketchProfiles(checked.sketches.find((item) => item.id === activeSketchId), checked.parameters);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'sketch', id: activeSketchId });
      setNotice('Usunięto wystąpienie bloku. Cofnij przywraca cały blok.');
    } catch (error) {
      setNotice(`Nie usunięto bloku: ${error.message}`);
    }
  };
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
      insertTimelineFeature(next, command.previewFeature);
    }
    return next;
  }, [document, command]);
  const engine = useCadEngine(previewDocument, { quality: command?.previewFeature ? 'preview' : 'display' });
  const selectedBodies = selectedBodyIds.map((bodyId) => engine.bodies.find((body) => body.id === bodyId)).filter(Boolean);
  const selectedMeshBody = selectedBodies.length === 1 && selectedBodies[0].representation === 'mesh-import' ? selectedBodies[0] : null;
  const selectedMeshFeature = selectedMeshBody ? document.features.find((feature) => feature.id === selectedMeshBody.sourceFeatureId && feature.type === 'importedModel' && feature.importFormat === 'stl') || null : null;
  const selectedFacetedBrepFeature = selectedBodies.length === 1 && selectedBodies[0].representation === 'brep'
    ? document.features.find((feature) => feature.id === selectedBodies[0].sourceFeatureId && feature.type === 'importedModel' && feature.representationMode === 'brep-faceted') || null
    : null;
  const selectedMeshReport = useMemo(() => {
    if (!selectedMeshFeature) return null;
    try {
      return inspectMesh(parseStlMesh(base64ToBytes(selectedMeshFeature.dataBase64)));
    } catch {
      return null;
    }
  }, [selectedMeshFeature]);
  const meshBrepBlocker = !selectedMeshReport
    ? 'Nie można odczytać siatki.'
    : selectedMeshReport.degenerateTriangles || selectedMeshReport.duplicateTriangles
      ? 'Najpierw wykonaj bezpieczną naprawę.'
      : selectedMeshReport.boundaryEdges
        ? `Siatka ma ${selectedMeshReport.boundaryEdges} otwartych krawędzi.`
        : selectedMeshReport.nonManifoldEdges
          ? `Siatka ma ${selectedMeshReport.nonManifoldEdges} krawędzi niemanifold.`
          : selectedMeshReport.inconsistentEdges
            ? `Siatka ma ${selectedMeshReport.inconsistentEdges} niespójnych krawędzi.`
            : selectedMeshReport.triangleCount > 2500
              ? 'Najpierw zredukuj do 2 500 trójkątów.'
              : '';
  const selectedSurfaceBodies = selectedBodies.filter((body) => body.bodyKind === 'surface');
  const selectedSolidBodies = selectedBodies.filter((body) => body.bodyKind !== 'surface');
  const canStitchSelectedSurfaces = selectedBodyIds.length >= 2 && selectedSurfaceBodies.length === selectedBodyIds.length;
  const canTrimSelectedSurface = selectedBodyIds.length === 2 && selectedSurfaceBodies.length === 1 && selectedSolidBodies.length === 1;
  const assemblyCollisionResult = React.useMemo(() => detectAssemblyCollisions(document, engine.bodies), [document, engine.bodies]);
  const collisionInstanceIds = React.useMemo(() => [...new Set(assemblyCollisionResult.collisions.flatMap((collision) => [collision.firstInstanceId, collision.secondInstanceId]))], [assemblyCollisionResult]);
  const exactCollisionInstanceIds = React.useMemo(() => [...new Set(assemblyCollisionResult.collisions.filter((collision) => collision.status === 'exact').flatMap((collision) => [collision.firstInstanceId, collision.secondInstanceId]))], [assemblyCollisionResult]);
  const selectedJoint = selection?.kind === 'joint'
    ? document.joints.find((joint) => joint.id === selection.id) || null
    : null;
  const selectedMotionLink = selection?.kind === 'motionLink'
    ? document.motionLinks.find((link) => link.id === selection.id) || null
    : null;
  const selectedAssemblyConfiguration = selection?.kind === 'assemblyConfiguration'
    ? document.assemblyConfigurations.find((configuration) => configuration.id === selection.id) || null
    : null;
  const selectedContactSet = selection?.kind === 'contactSet'
    ? document.contactSets.find((contactSet) => contactSet.id === selection.id) || null
    : null;
  const selectedInstance = selection?.kind === 'componentInstance'
    ? document.componentInstances.find((instance) => instance.id === selection.id) || null
    : selectedJoint
      ? document.componentInstances.find((instance) => instance.id === selectedJoint.movingInstanceId) || null
      : null;
  const selectedComponent = selection?.kind === 'component'
    ? document.components.find((component) => component.id === selection.id) || null
    : selectedInstance
      ? document.components.find((component) => component.id === selectedInstance.componentId) || null
      : null;
  const openComponentManager = () => {
    setNamedViewsOpen(false);
    setLayersOpen(false);
    setBlocksOpen(false);
    setCommandCustomizationOpen(false);
    setComponentsOpen(true);
    setBrowserOpen(true);
    if (!selectedComponent && document.components.length) setSelection({ kind: 'component', id: document.components[0].id });
  };
  const applyLinkedProjectProxy = async (sourceResult, existingLink = null, { allowDifferentSource = false } = {}) => {
    const opened = openDocument(JSON.parse(sourceResult.text));
    if (opened.document.id === document.id) throw new Error('Projekt nie może być linkiem do samego siebie.');
    if (existingLink?.sourceDocumentId && opened.document.id !== existingLink.sourceDocumentId && !allowDifferentSource) {
      throw new Error('Wybrany plik ma inne ID projektu. Użyj „Napraw łącze”, aby świadomie podmienić źródło.');
    }
    const buffers = await engine.exportExternalDocument(opened.document, 'step');
    if (!buffers.length) throw new Error('Projekt źródłowy nie zawiera brył do podlinkowania.');
    const checked = cloneDocument(document);
    const linkId = existingLink?.id || createLinkedProject().id;
    const previousIds = existingLink?.proxyFeatureIds || [];
    const previousIndices = previousIds.map((id) => checked.features.findIndex((feature) => feature.id === id)).filter((index) => index >= 0);
    const insertionIndex = previousIndices.length ? Math.min(...previousIndices) : checked.features.length;
    const proxyFeatures = buffers.map((buffer, index) => createFeature('importedModel', {
      ...(previousIds[index] ? { id: previousIds[index] } : {}),
      name: `${opened.document.name} · ${index + 1}`,
      originalFormat: 'step',
      importFormat: 'step',
      dataBase64: arrayBufferToBase64(buffer),
      sourceUnit: 'millimeter',
      unitScale: 1,
      sourceBytes: buffer.byteLength,
      linkedProjectId: linkId,
    }));
    checked.features = checked.features.filter((feature) => !previousIds.includes(feature.id));
    checked.features.splice(insertionIndex, 0, ...proxyFeatures);
    checked.featureGroups = checked.featureGroups.map((group) => ({ ...group, featureIds: group.featureIds.filter((id) => !previousIds.includes(id)) })).filter((group) => group.featureIds.length);
    if (previousIds.includes(checked.timelineRollbackFeatureId)) checked.timelineRollbackFeatureId = '';
    let component;
    if (existingLink) {
      component = checked.components.find((item) => item.id === existingLink.linkedComponentId);
      if (!component) throw new Error('Nie znaleziono komponentu przypisanego do łącza.');
      component.name = opened.document.name;
      component.description = `Link do ${sourceResult.fileName}`;
      component.bodyIds = proxyFeatures.map((feature) => `body-${feature.id}`);
    } else {
      const created = createComponent(checked, {
        type: 'part',
        name: opened.document.name,
        description: `Link do ${sourceResult.fileName}`,
        bodyIds: proxyFeatures.map((feature) => `body-${feature.id}`),
      });
      component = checked.components.find((item) => item.id === created.id);
    }
    const record = createLinkedProject({
      ...existingLink,
      id: linkId,
      relativePath: sourceResult.relativePath,
      fileName: sourceResult.fileName,
      sourceDocumentId: opened.document.id,
      sourceName: opened.document.name,
      sourceSchemaVersion: opened.sourceVersion,
      sourceHash: sourceResult.hash,
      sourceModifiedAt: sourceResult.modifiedAt,
      linkedComponentId: component.id,
      proxyFeatureIds: proxyFeatures.map((feature) => feature.id),
      refreshedAt: new Date().toISOString(),
    });
    component.linkedProjectId = record.id;
    const linkIndex = checked.linkedProjects.findIndex((link) => link.id === record.id);
    if (linkIndex >= 0) checked.linkedProjects[linkIndex] = record;
    else checked.linkedProjects.push(record);
    const validation = validateDocument(checked);
    if (!validation.valid) throw new Error(`Odświeżenie zerwałoby zależność: ${validation.errors[0]}`);
    commit((next) => Object.assign(next, checked));
    setSelection({ kind: 'component', id: component.id });
    setLinkedProjectStatuses((current) => ({ ...current, [record.id]: { state: 'current', hash: record.sourceHash, checkedAt: new Date().toISOString() } }));
    return record;
  };
  const linkExternalProject = async () => {
    if (readOnly || !window.desktopApp?.selectLinkedProject) return;
    let baseProjectPath = currentPathRef.current;
    if (!baseProjectPath || !/^(?:\/|[A-Za-z]:[\\/])/.test(baseProjectPath)) baseProjectPath = await saveProject();
    if (typeof baseProjectPath !== 'string') return;
    try {
      setNotice('Wybierz projekt .madcad do podlinkowania…');
      const result = await window.desktopApp.selectLinkedProject({ baseProjectPath });
      if (!result?.ok) {
        if (!result?.canceled) throw new Error(result?.error || 'Nie udało się wybrać projektu.');
        setNotice('Anulowano tworzenie łącza.');
        return;
      }
      const record = await applyLinkedProjectProxy(result);
      setNotice(`Podlinkowano projekt „${record.sourceName}”. Geometria proxy STEP jest gotowa.`);
    } catch (error) {
      setNotice(`Nie utworzono łącza: ${error.message}`);
    }
  };
  const refreshLinkedProject = async (linkId, repair = false) => {
    const link = document.linkedProjects.find((item) => item.id === linkId);
    if (!link || !window.desktopApp?.readLinkedProject || !currentPathRef.current) return;
    try {
      setLinkedProjectStatuses((current) => ({ ...current, [linkId]: { state: 'checking' } }));
      const result = repair
        ? await window.desktopApp.selectLinkedProject({ baseProjectPath: currentPathRef.current })
        : await window.desktopApp.readLinkedProject({ baseProjectPath: currentPathRef.current, relativePath: link.relativePath });
      if (!result?.ok) {
        if (result?.canceled) return;
        setLinkedProjectStatuses((current) => ({ ...current, [linkId]: { state: result?.missing ? 'missing' : 'error', error: result?.error } }));
        throw new Error(result?.error || 'Nie udało się odczytać źródła.');
      }
      const record = await applyLinkedProjectProxy(result, link, { allowDifferentSource: repair });
      setNotice(`${repair ? 'Naprawiono' : 'Odświeżono'} łącze „${record.sourceName}”. Operację można cofnąć.`);
    } catch (error) {
      setNotice(`Nie odświeżono łącza: ${error.message}`);
    }
  };
  const packAndGoProject = async () => {
    if (!window.desktopApp?.packAndGoProject) return;
    let baseProjectPath = currentPathRef.current;
    if (dirty || !baseProjectPath || !/^(?:\/|[A-Za-z]:[\\/])/.test(baseProjectPath)) baseProjectPath = await saveProject();
    if (typeof baseProjectPath !== 'string') return;
    try {
      setNotice('Sprawdzanie grafu linków i tworzenie paczki Pack & Go…');
      const result = await window.desktopApp.packAndGoProject({ baseProjectPath });
      if (!result?.ok) {
        if (!result?.canceled) setNotice(`Nie utworzono Pack & Go: ${result?.error || 'nieznany błąd'}`);
        return;
      }
      setNotice(`Utworzono Pack & Go: ${result.destinationDirectory} · ${result.manifest?.files?.length || 0} projektów · manifest SHA-256.`);
    } catch (error) {
      setNotice(`Nie utworzono Pack & Go: ${error.message}`);
    }
  };
  useEffect(() => {
    if ((!componentsOpen && !projectHealthOpen) || !currentPath || !window.desktopApp?.readLinkedProject) return;
    for (const link of document.linkedProjects) {
      window.desktopApp.readLinkedProject({ baseProjectPath: currentPath, relativePath: link.relativePath }).then((result) => {
        setLinkedProjectStatuses((current) => ({ ...current, [link.id]: {
          state: linkedProjectState(link, result?.ok ? result : { missing: result?.missing, error: result?.error }),
          hash: result?.hash,
          error: result?.error || '',
          checkedAt: new Date().toISOString(),
        } }));
      });
    }
  }, [componentsOpen, projectHealthOpen, currentPath, document.linkedProjects]);
  const createDocumentComponent = (type = 'part') => {
    try {
      const checked = cloneDocument(document);
      const created = createComponent(checked, {
        type,
        name: type === 'assembly' ? 'Złożenie' : 'Komponent',
        bodyIds: type === 'part' ? selectedBodyIds : [],
      });
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'component', id: created.id });
      setComponentsOpen(true);
      setBrowserOpen(true);
      setNotice(type === 'assembly'
        ? `Utworzono złożenie „${created.name}”. Dodaj części i ustaw je jako podkomponenty.`
        : `Utworzono część „${created.name}”${selectedBodyIds.length ? ` i przypisano ${selectedBodyIds.length} brył.` : '.'}`);
    } catch (error) {
      setNotice(`Nie utworzono komponentu: ${error.message}`);
    }
  };
  const updateDocumentComponent = (componentId, patch) => {
    try {
      const checked = cloneDocument(document);
      updateComponent(checked, componentId, patch);
      commit((next) => Object.assign(next, checked));
    } catch (error) {
      setNotice(`Nie zmieniono komponentu: ${error.message}`);
    }
  };
  const assignDocumentComponentBodies = (componentId, bodyIds) => {
    try {
      const checked = cloneDocument(document);
      assignBodiesToComponent(checked, componentId, bodyIds);
      commit((next) => Object.assign(next, checked));
      setNotice(`Zaktualizowano przypisanie brył do komponentu (${bodyIds.length}).`);
    } catch (error) {
      setNotice(`Nie przypisano brył: ${error.message}`);
    }
  };
  const moveDocumentComponent = (componentId, parentId) => {
    try {
      const checked = cloneDocument(document);
      moveComponent(checked, componentId, parentId);
      commit((next) => Object.assign(next, checked));
      setNotice(parentId ? 'Przeniesiono komponent do wskazanego złożenia.' : 'Przeniesiono komponent na poziom główny.');
    } catch (error) {
      setNotice(`Nie przeniesiono komponentu: ${error.message}`);
    }
  };
  const removeDocumentComponent = (componentId) => {
    try {
      const component = document.components.find((item) => item.id === componentId);
      const parentId = componentParentMap(document.components).get(componentId);
      const checked = cloneDocument(document);
      const linkedProject = checked.linkedProjects.find((link) => link.linkedComponentId === componentId);
      deleteComponent(checked, componentId);
      if (linkedProject) {
        const proxyIds = new Set(linkedProject.proxyFeatureIds);
        checked.features = checked.features.filter((feature) => !proxyIds.has(feature.id));
        checked.featureGroups = checked.featureGroups.map((group) => ({ ...group, featureIds: group.featureIds.filter((id) => !proxyIds.has(id)) })).filter((group) => group.featureIds.length);
        if (proxyIds.has(checked.timelineRollbackFeatureId)) checked.timelineRollbackFeatureId = '';
        checked.linkedProjects = checked.linkedProjects.filter((link) => link.id !== linkedProject.id);
      }
      const validation = validateDocument(checked);
      if (!validation.valid) throw new Error(`Usunięcie zerwałoby zależność: ${validation.errors[0]}`);
      commit((next) => Object.assign(next, checked));
      setSelection(parentId ? { kind: 'component', id: parentId } : { kind: 'document', id: document.id });
      setNotice(`Usunięto komponent „${component?.name || componentId}”${linkedProject ? ' i jego proxy linku' : ''}. Jego podkomponenty zachowano; operację można cofnąć.`);
    } catch (error) {
      setNotice(`Nie usunięto komponentu: ${error.message}`);
    }
  };
  const createDocumentComponentInstance = (componentId) => {
    try {
      const checked = cloneDocument(document);
      const current = selectedInstance || document.componentInstances.find((instance) => instance.componentId === componentId && instance.primary);
      const currentComponent = current ? document.components.find((component) => component.id === current.componentId) : null;
      const parentInstanceId = currentComponent?.type === 'assembly' ? current.id : current?.parentInstanceId || '';
      const created = createComponentInstance(checked, { componentId, parentInstanceId, transform: { x: 20 } });
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'componentInstance', id: created.id, componentId });
      setNotice(`Wstawiono kolejne wystąpienie „${created.name}”. Ustaw jego położenie XYZ.`);
    } catch (error) {
      setNotice(`Nie wstawiono wystąpienia: ${error.message}`);
    }
  };
  const updateDocumentComponentInstance = (instanceId, patch) => {
    try {
      const checked = cloneDocument(document);
      updateComponentInstance(checked, instanceId, patch);
      commit((next) => Object.assign(next, checked));
    } catch (error) {
      setNotice(`Nie zmieniono wystąpienia: ${error.message}`);
    }
  };
  const duplicateDocumentComponentInstance = (instanceId) => {
    try {
      const checked = cloneDocument(document);
      const created = duplicateComponentInstance(checked, instanceId);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'componentInstance', id: created.id, componentId: created.componentId });
      setNotice(`Powielono wystąpienie „${created.name}” i odsunięto je o 20 mm.`);
    } catch (error) {
      setNotice(`Nie powielono wystąpienia: ${error.message}`);
    }
  };
  const removeDocumentComponentInstance = (instanceId) => {
    try {
      const checked = cloneDocument(document);
      const instance = checked.componentInstances.find((item) => item.id === instanceId);
      deleteComponentInstance(checked, instanceId);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'component', id: instance.componentId });
      setNotice(`Usunięto wystąpienie „${instance.name}” wraz z jego podwystąpieniami. Operację można cofnąć.`);
    } catch (error) {
      setNotice(`Nie usunięto wystąpienia: ${error.message}`);
    }
  };
  const createDocumentRigidGroup = (instanceIds) => {
    try {
      const checked = cloneDocument(document);
      const group = createRigidGroup(checked, instanceIds);
      commit((next) => Object.assign(next, checked));
      setNotice(`Utworzono „${group.name}”. Jej elementy przesuwają się i obracają razem.`);
    } catch (error) {
      setNotice(`Nie utworzono grupy sztywnej: ${error.message}`);
    }
  };
  const removeDocumentRigidGroup = (groupId) => {
    try {
      const checked = cloneDocument(document);
      const group = deleteRigidGroup(checked, groupId);
      commit((next) => Object.assign(next, checked));
      setNotice(`Rozwiązano grupę sztywną „${group.name}”.`);
    } catch (error) {
      setNotice(`Nie rozwiązano grupy sztywnej: ${error.message}`);
    }
  };
  const createDocumentJoint = (options) => {
    try {
      const checked = cloneDocument(document);
      const joint = createAssemblyJoint(checked, options);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'joint', id: joint.id, movingInstanceId: joint.movingInstanceId });
      setNotice(`Utworzono joint „${joint.name}” (${joint.type}). Steruj ruchem wartością i limitami.`);
    } catch (error) {
      setNotice(`Nie utworzono jointa: ${error.message}`);
    }
  };
  const updateDocumentJoint = (jointId, patch) => {
    try {
      const checked = cloneDocument(document);
      updateAssemblyJoint(checked, jointId, patch);
      commit((next) => Object.assign(next, checked));
    } catch (error) {
      setNotice(`Nie zmieniono jointa: ${error.message}`);
    }
  };
  const setDocumentJointValue = (jointId, value) => {
    try {
      const checked = cloneDocument(document);
      setJointValue(checked, jointId, value, { clamp: true });
      commit((next) => Object.assign(next, checked));
    } catch (error) {
      setNotice(`Nie ustawiono ruchu jointa: ${error.message}`);
    }
  };
  const removeDocumentJoint = (jointId) => {
    try {
      const checked = cloneDocument(document);
      const joint = deleteAssemblyJoint(checked, jointId);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'componentInstance', id: joint.movingInstanceId });
      setNotice(`Usunięto joint „${joint.name}”. Operację można cofnąć.`);
    } catch (error) {
      setNotice(`Nie usunięto jointa: ${error.message}`);
    }
  };
  const createDocumentMotionLink = (options) => {
    try {
      const checked = cloneDocument(document);
      const link = createMotionLink(checked, options);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'motionLink', id: link.id });
      setNotice(`Utworzono Motion Link „${link.name}”. Ruch jointa docelowego jest teraz powiązany ze źródłem.`);
    } catch (error) {
      setNotice(`Nie utworzono Motion Link: ${error.message}`);
    }
  };
  const updateDocumentMotionLink = (linkId, patch) => {
    try {
      const checked = cloneDocument(document);
      updateMotionLink(checked, linkId, patch);
      commit((next) => Object.assign(next, checked));
    } catch (error) {
      setNotice(`Nie zmieniono Motion Link: ${error.message}`);
    }
  };
  const removeDocumentMotionLink = (linkId) => {
    try {
      const checked = cloneDocument(document);
      const link = deleteMotionLink(checked, linkId);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'document', id: checked.id });
      setNotice(`Usunięto Motion Link „${link.name}”.`);
    } catch (error) {
      setNotice(`Nie usunięto Motion Link: ${error.message}`);
    }
  };
  const createDocumentAssemblyConfiguration = (options) => {
    try {
      const checked = cloneDocument(document);
      const configuration = createAssemblyConfiguration(checked, options);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'assemblyConfiguration', id: configuration.id });
      setNotice(`Zapisano konfigurację złożenia „${configuration.name}”.`);
    } catch (error) {
      setNotice(`Nie zapisano konfiguracji: ${error.message}`);
    }
  };
  const updateDocumentAssemblyConfiguration = (configurationId, patch) => {
    try {
      const checked = cloneDocument(document);
      const configuration = updateAssemblyConfiguration(checked, configurationId, patch);
      commit((next) => Object.assign(next, checked));
      if (patch.captureCurrent) setNotice(`Zaktualizowano zapisany stan „${configuration.name}”.`);
    } catch (error) {
      setNotice(`Nie zmieniono konfiguracji: ${error.message}`);
    }
  };
  const applyDocumentAssemblyConfiguration = (configurationId) => {
    try {
      const checked = cloneDocument(document);
      const configuration = applyAssemblyConfiguration(checked, configurationId);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'assemblyConfiguration', id: configuration.id });
      setNotice(`Aktywowano konfigurację „${configuration.name}”.`);
    } catch (error) {
      setNotice(`Nie aktywowano konfiguracji: ${error.message}`);
    }
  };
  const removeDocumentAssemblyConfiguration = (configurationId) => {
    try {
      const checked = cloneDocument(document);
      const configuration = deleteAssemblyConfiguration(checked, configurationId);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'document', id: checked.id });
      setNotice(`Usunięto konfigurację „${configuration.name}”.`);
    } catch (error) {
      setNotice(`Nie usunięto konfiguracji: ${error.message}`);
    }
  };
  const createDocumentContactSet = (options) => {
    try {
      const checked = cloneDocument(document);
      const contactSet = createContactSet(checked, options);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'contactSet', id: contactSet.id });
      setNotice(`Utworzono Contact Set „${contactSet.name}”. Para jest stale monitorowana podczas ruchu.`);
    } catch (error) {
      setNotice(`Nie utworzono Contact Set: ${error.message}`);
    }
  };
  const updateDocumentContactSet = (contactSetId, patch) => {
    try {
      const checked = cloneDocument(document);
      updateContactSet(checked, contactSetId, patch);
      commit((next) => Object.assign(next, checked));
    } catch (error) {
      setNotice(`Nie zmieniono Contact Set: ${error.message}`);
    }
  };
  const removeDocumentContactSet = (contactSetId) => {
    try {
      const checked = cloneDocument(document);
      const contactSet = deleteContactSet(checked, contactSetId);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'document', id: checked.id });
      setNotice(`Usunięto Contact Set „${contactSet.name}”.`);
    } catch (error) {
      setNotice(`Nie usunięto Contact Set: ${error.message}`);
    }
  };
  const selectedBodyRepresentations = selectedBodies.map((body) => body.representation);
  const canBooleanSelectedBodies = selectedBodyIds.length === 2
    && selectedBodyRepresentations.length === 2
    && new Set(selectedBodyRepresentations).size === 1
    && selectedBodies.every((body) => body.bodyKind !== 'surface')
    && selectedBodies.every((body) => body.meshBooleanCapable !== false);
  const containsImportedMesh = engine.bodies.some((body) => body.representation === 'mesh-import');
  const canCreateRib = Boolean(canExtrudeOpenChain && engine.bodies.length);
  const pressPullFace = selectedFaceItems.length === 1
    ? engine.bodies.find((body) => body.id === selectedFaceItems[0].bodyId)?.topology?.faces?.find((face) => face.id === selectedFaceItems[0].id)
    : null;
  const canPressPull = Boolean((selectedProfile && !activeSketchId) || pressPullFace?.descriptor?.geometry === 'PLANE');
  const splitFaceSupport = selectedProfileMatch?.sketch.support?.kind === 'face'
    ? document.references.find((reference) => reference.id === selectedProfileMatch.sketch.support.referenceId)
    : null;
  const canSplitFace = Boolean(selectedProfile && !activeSketchId
    && splitFaceSupport?.kind === 'topology'
    && splitFaceSupport.topologyKind === 'face'
    && splitFaceSupport.descriptor?.geometry === 'PLANE'
    && engine.bodies.some((body) => body.id === splitFaceSupport.bodyId));
  const measurement = useMemo(() => measureSelection(engine.bodies, selection), [engine.bodies, selection]);
  const massBodies = useMemo(() => {
    const ids = new Set((selection?.items || [selection]).map((item) => item?.bodyId || (item?.kind === 'body' ? item.id : null)).filter(Boolean));
    return (ids.size ? engine.bodies.filter((body) => ids.has(body.id)) : engine.bodies).filter((body) => body.bodyKind !== 'surface');
  }, [engine.bodies, selection]);
  const massProperties = useMemo(() => {
    if (command?.type !== 'massProperties') return null;
    try {
      return { result: calculateMassProperties(massBodies, command.density), error: '' };
    } catch (error) {
      return { result: null, error: error.message };
    }
  }, [command?.type, command?.density, massBodies]);
  const draftAnalysis = useMemo(() => command?.type === 'geometryInspection'
    ? analyzeDraftAngles(engine.bodies, {
      direction: DRAFT_DIRECTIONS[command.draftDirection] || DRAFT_DIRECTIONS['z-positive'],
      tolerance: Number.isFinite(Number(command.draftTolerance)) ? Math.min(45, Math.max(0, Number(command.draftTolerance))) : 0.5,
    })
    : null, [command?.type, command?.draftDirection, command?.draftTolerance, engine.bodies]);
  const thicknessAnalysis = useMemo(() => command?.type === 'geometryInspection'
    ? analyzeWallThickness(engine.bodies, {
      target: Number.isFinite(Number(command.thicknessTarget)) && Number(command.thicknessTarget) > 0 ? Number(command.thicknessTarget) : 2,
      tolerance: Number.isFinite(Number(command.thicknessTolerance)) && Number(command.thicknessTolerance) >= 0 ? Math.min(Number(command.thicknessTolerance), Math.max(0, Number(command.thicknessTarget || 2) - 0.001)) : 0.25,
    })
    : null, [command?.type, command?.thicknessTarget, command?.thicknessTolerance, engine.bodies]);
  const geometryInspection = useMemo(() => ({ ...summarizeGeometryInspection(engine.bodies, engine.analysis), draft: draftAnalysis, thickness: thicknessAnalysis }), [engine.bodies, engine.analysis, draftAnalysis, thicknessAnalysis]);
  const activeGeometryFaceAnalysis = command?.type === 'geometryInspection' && command.inspectionMode === 'thickness' ? thicknessAnalysis : draftAnalysis;
  const surfaceContinuity = useMemo(() => analyzeSurfaceContinuity(engine.bodies), [engine.bodies]);
  const surfaceCurvature = useMemo(() => summarizeMeshCurvature(engine.bodies), [engine.bodies]);
  const selectedPrintFace = useMemo(() => {
    if (selectedFaceItems.length !== 1) return null;
    const selected = selectedFaceItems[0];
    const descriptor = engine.bodies.find((body) => body.id === selected.bodyId)?.topology?.faces?.find((face) => face.id === selected.id)?.descriptor;
    return descriptor?.geometry === 'PLANE' && Array.isArray(descriptor.normal) ? descriptor : null;
  }, [engine.bodies, selectedFaceItems]);
  const constructionAxes = useMemo(() => resolveConstructionAxes(document.references, document.parameters, engine.bodies), [document.references, document.parameters, engine.bodies]);
  const constructionPoints = useMemo(() => resolveConstructionPoints(document.references, document.parameters, engine.bodies), [document.references, document.parameters, engine.bodies]);
  const actualBodyIds = useMemo(() => new Set(document.features.filter((feature) => (['extrude', 'revolve', 'sweep', 'loft', 'coil', 'pipe'].includes(feature.type) && feature.operation === 'new') || feature.type === 'sheetBase' || feature.type === 'primitive' || feature.type === 'formBody' || feature.type === 'importedModel' || feature.type === 'splitBody' || (feature.type === 'textSolid' && feature.operation === 'new')).map((feature) => `body-${feature.id}`)), [document.features]);
  const actualBodies = command?.previewFeature ? engine.bodies.filter((body) => actualBodyIds.has(body.id)) : engine.bodies;
  const visibleViewportBodies = engine.bodies.filter((body) => document.features.find((feature) => feature.id === body.sourceFeatureId)?.visible !== false);
  useEffect(() => {
    if (!pendingModelImport) return;
    const rollbackFailedImport = (message) => {
      setPendingModelImport(null);
      history.commit((next) => { deleteTimelineFeatureCascade(next, pendingModelImport.featureId); });
      setSelection({ kind: 'document', id: document.id });
      setNotice(`Nie zaimportowano ${pendingModelImport.fileName}: ${message} Błędną operację usunięto, aby nie blokowała dalszego modelowania.`);
    };
    if (engine.status === 'error') {
      rollbackFailedImport(engine.error || 'Silnik CAD nie utworzył geometrii.');
      return;
    }
    if (engine.evaluatedDocument !== document || engine.status !== 'ready') return;
    const body = engine.bodies.find((item) => item.sourceFeatureId === pendingModelImport.featureId);
    const timelineEntry = engine.timeline.find((item) => item.id === pendingModelImport.featureId);
    if (body && !['error', 'stale'].includes(timelineEntry?.status)) {
      setPendingModelImport(null);
      setFitViewRequest({ requestId: `${pendingModelImport.featureId}:${Date.now()}` });
      setNotice(`Zaimportowano ${pendingModelImport.fileName} · ${body.representation === 'brep' ? 'dokładna bryła B-Rep' : 'siatka 3D'}. Widok dopasowano do modelu.`);
      return;
    }
    if (timelineEntry?.status === 'error') {
      const message = timelineEntry?.error || engine.error || 'Silnik CAD nie utworzył geometrii.';
      rollbackFailedImport(message);
    }
  }, [document, engine.bodies, engine.error, engine.evaluatedDocument, engine.status, engine.timeline, history, pendingModelImport]);
  const targetBodyId = selection?.kind === 'body' ? selection.id : (selection?.bodyId || engine.bodies[0]?.id || firstBodyId || null);
  const targetBody = engine.bodies.find((body) => body.id === targetBodyId);
  const targetBodySupportsSolidOperations = targetBody?.bodyKind !== 'surface' && targetBody?.meshBooleanCapable !== false;
  const sheetBodies = engine.bodies.filter((body) => body.sheetMetal);
  const activeSheetBody = targetBody?.sheetMetal ? targetBody : sheetBodies.length === 1 ? sheetBodies[0] : null;
  const canUnfoldSheet = Boolean(activeSheetBody && !activeSheetBody.sheetMetal.unfolded && activeSheetBody.sheetMetal.flatSegments?.length);
  const canRefoldSheet = Boolean(activeSheetBody?.sheetMetal.unfolded);
  const selectedSheetEdgeBody = selectedEdgeItems.length === 1 ? engine.bodies.find((body) => body.id === selectedEdgeItems[0].bodyId && body.sheetMetal) || null : null;
  const selectedSheetEdgeDescriptor = selectedSheetEdgeBody?.topology?.edges?.find((edge) => edge.id === selectedEdgeItems[0]?.id)?.descriptor || null;
  const canCreateSheetFlange = Boolean(selectedSheetEdgeBody && !selectedSheetEdgeBody.sheetMetal.unfolded && selectedSheetEdgeDescriptor?.geometry === 'LINE' && !selectedSheetEdgeDescriptor?.closed);
  const selectedSurfaceBody = selectedBodyIds.length === 1 && selectedBodies[0]?.bodyKind === 'surface' ? selectedBodies[0] : null;
  const selectedSurfaceEdgeBody = selectedEdgeItems.length === 1 ? engine.bodies.find((body) => body.id === selectedEdgeItems[0].bodyId && body.bodyKind === 'surface') || null : null;
  const selectedSurfaceEdgeDescriptor = selectedSurfaceEdgeBody?.topology?.edges?.find((edge) => edge.id === selectedEdgeItems[0]?.id)?.descriptor || null;
  const canExtendSelectedSurface = Boolean(selectedSurfaceEdgeBody && selectedSurfaceEdgeDescriptor?.geometry === 'LINE' && !selectedSurfaceEdgeDescriptor?.closed);
  const topologyReferenceStates = useMemo(() => inspectTopologyReferences(document, actualBodies), [document, actualBodies]);
  const lostTopologyReferences = useMemo(
    () => engine.status === 'ready' && !command?.previewFeature ? topologyReferenceStates.filter((item) => item.status === 'lost') : [],
    [engine.status, command?.previewFeature, topologyReferenceStates],
  );
  const lostReferenceOwnerIds = useMemo(() => new Set(lostTopologyReferences.map((item) => item.reference.ownerFeatureId).filter(Boolean)), [lostTopologyReferences]);
  const lostProjectedEntityIds = useMemo(() => {
    const lostIds = new Set(lostTopologyReferences.map((item) => item.reference.id));
    return document.sketches.flatMap((sketch) => sketch.entities
      .filter((entity) => entity.role === 'projected' && lostIds.has(entity.projectionReferenceId || entity.sourceReferenceId))
      .map((entity) => entity.id));
  }, [document.sketches, lostTopologyReferences]);
  const projectHealthReport = useMemo(() => createProjectHealthReport({
    document,
    validation: validateDocument(document),
    timeline: engine.timeline,
    lostReferences: lostTopologyReferences,
    linkedProjectStatuses,
    engineStatus: engine.status,
    engineError: engine.error,
    engineDiagnostics: engine.diagnostics,
    serializedBytes: new TextEncoder().encode(serializedDocument).byteLength,
    bodyCount: actualBodies.length,
  }), [document, engine.timeline, engine.status, engine.error, engine.diagnostics, linkedProjectStatuses, lostTopologyReferences, serializedDocument, actualBodies.length]);
  const projectSearchIndex = useMemo(() => buildProjectSearchIndex(document), [document]);
  const openProjectHealth = () => {
    setProjectSnapshotsOpen(false);
    setProjectComparisonOpen(false);
    setProjectDependenciesOpen(false);
    setProjectSearchOpen(false);
    setProjectHealthOpen(true);
  };
  const navigateProjectHealthIssue = (issue) => {
    const target = issue?.target;
    if (!target) return;
    setProjectHealthOpen(false);
    if (target.kind === 'feature') {
      setWorkspace('solid');
      setActiveSketchId(null);
      setSelection({ kind: 'feature', id: target.id });
    } else if (target.kind === 'sketch') {
      setBrowserOpen(true);
      setSelection({ kind: 'sketch', id: target.id });
    } else if (target.kind === 'component') {
      if (target.id) setSelection({ kind: 'component', id: target.id });
      openComponentManager();
    } else if (target.kind === 'settings') {
      setCommand({ type: 'parameters' });
    } else {
      setSelection({ kind: 'document', id: document.id });
      setBrowserOpen(true);
    }
    setNotice(`Przejście z raportu kondycji: ${issue.title}`);
  };
  const exportProjectHealthReport = () => {
    const payload = JSON.stringify({ ...projectHealthReport, generatedAt: new Date().toISOString() }, null, 2);
    downloadBlob(new Blob([payload], { type: 'application/json;charset=utf-8' }), `${safeName(document.name)}-kondycja.json`);
    setNotice('Wyeksportowano raport kondycji projektu JSON.');
  };
  const projectDependencyInspection = useMemo(
    () => inspectProjectDependencies(document, projectDependencyNodeId),
    [document, projectDependencyNodeId],
  );
  const openProjectDependencies = () => {
    setProjectSnapshotsOpen(false);
    setProjectComparisonOpen(false);
    setProjectHealthOpen(false);
    setProjectSearchOpen(false);
    setProjectDependencyNodeId(dependencyNodeIdForSelection(selection, document));
    setProjectDependenciesOpen(true);
  };
  const navigateProjectDependency = (item) => {
    if (!item?.target) return;
    setProjectDependencyNodeId(item.id);
    const target = item.target;
    if (target.kind === 'feature') {
      setWorkspace('solid');
      setActiveSketchId(null);
      setSelection({ kind: 'feature', id: target.id });
    } else if (target.kind === 'sketch') {
      setBrowserOpen(true);
      setSelection({ kind: 'sketch', id: target.id });
    } else if (target.kind === 'component') {
      setBrowserOpen(true);
      setSelection({ kind: 'component', id: target.id });
    } else if (target.kind === 'body') {
      setSelection({ kind: 'body', id: target.id });
    } else if (target.kind === 'settings') {
      setProjectDependenciesOpen(false);
      setCommand({ type: 'parameters' });
    } else if (['constructionPlane', 'constructionAxis', 'constructionPoint'].includes(target.kind)) {
      setBrowserOpen(true);
      setSelection({ kind: target.kind, id: target.id });
    } else {
      setBrowserOpen(true);
      setSelection({ kind: 'document', id: document.id });
    }
    setNotice(`Wybrano zależność „${item.label}” (${item.relation}).`);
  };
  const openProjectSearch = () => {
    setProjectSnapshotsOpen(false);
    setProjectComparisonOpen(false);
    setProjectHealthOpen(false);
    setProjectDependenciesOpen(false);
    setProjectSearchOpen(true);
  };
  const navigateProjectSearchResult = (item) => {
    const target = item?.target;
    if (!target) return;
    setProjectSearchOpen(false);
    if (target.kind === 'feature') {
      setWorkspace('solid');
      setActiveSketchId(null);
      setSelection({ kind: 'feature', id: target.id });
    } else if (target.kind === 'sketch') {
      setWorkspace('solid');
      setBrowserOpen(true);
      setSelection({ kind: 'sketch', id: target.id });
    } else if (target.kind === 'body') {
      setWorkspace('solid');
      setActiveSketchId(null);
      setSelection({ kind: 'body', id: target.id });
    } else if (target.kind === 'component') {
      setBrowserOpen(true);
      setSelection(target.id ? { kind: 'component', id: target.id } : { kind: 'document', id: document.id });
    } else if (target.kind === 'componentInstance') {
      setBrowserOpen(true);
      setSelection({ kind: 'componentInstance', id: target.id, componentId: target.componentId });
    } else if (target.kind === 'drawingSheet') {
      setWorkspace('drawing');
      setActiveDrawingSheetId(target.id);
      setSelection({ kind: 'drawingSheet', id: target.id });
    } else if (target.kind === 'settings') {
      setSelection({ kind: 'settings', id: document.id, parameterName: target.parameterName });
      setCommand({ type: 'parameters' });
    } else if (['constructionPlane', 'constructionAxis', 'constructionPoint'].includes(target.kind)) {
      setBrowserOpen(true);
      setSelection({ kind: target.kind, id: target.id });
    } else {
      setBrowserOpen(true);
      setSelection({ kind: 'document', id: document.id });
    }
    setNotice(`Przejście „Idź do”: ${item.label}.`);
  };

  useEffect(() => {
    if (readOnly || command?.previewFeature || engine.status !== 'ready' || engine.evaluatedDocument !== document) return;
    const probe = cloneDocument(document);
    const result = synchronizeProjectedGeometry(probe, actualBodies);
    if (!result.updatedEntityIds.length && !result.updatedReferenceIds.length) return;
    history.synchronize((next) => synchronizeProjectedGeometry(next, actualBodies));
    setNotice(`Project odświeżony automatycznie · ${result.updatedEntityIds.length} ${result.updatedEntityIds.length === 1 ? 'element' : 'elementów'}.`);
  }, [document, actualBodies, command?.previewFeature, engine.status, engine.evaluatedDocument, history, readOnly]);

  useEffect(() => {
    if (!persistenceReady || readOnly || !dirty) return undefined;
    let canceled = false;
    let timeout;
    const persistWhenReady = () => {
      if (canceled) return;
      if (autosaveSuspendedRef.current) {
        timeout = window.setTimeout(persistWhenReady, 100);
        return;
      }
      void persistAutosaveNow(serializedDocument).catch((error) => setNotice(`Błąd autozapisu: ${error.message}`));
    };
    timeout = window.setTimeout(persistWhenReady, 300);
    return () => {
      canceled = true;
      window.clearTimeout(timeout);
    };
  }, [dirty, persistenceReady, persistAutosaveNow, readOnly, serializedDocument]);

  useEffect(() => {
    window.__madcadGetSessionExport = () => JSON.stringify(readOnly && documentAccess.originalDocument ? documentAccess.originalDocument : document, null, 2);
    window.__madcadHasDrawableContent = () => Boolean(
      document.features.length
      || document.sketches.some((sketch) => sketch.entities.length || sketch.profiles.length)
      || document.imports?.length
    );
    window.__madcadHasUnsavedChanges = () => dirty;
    window.__madcadPersistenceReady = () => persistenceReady;
    window.__madcadClearRuntimeSession = () => clearLocalAutosave();
    return () => {
      delete window.__madcadGetSessionExport;
      delete window.__madcadHasDrawableContent;
      delete window.__madcadHasUnsavedChanges;
      delete window.__madcadPersistenceReady;
      delete window.__madcadClearRuntimeSession;
    };
  }, [dirty, document, documentAccess.originalDocument, persistenceReady, readOnly]);

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
      evaluatedFeatureData: engine.evaluatedDocument?.features?.map((feature) => ({
        id: feature.id,
        type: feature.type,
        threadMode: feature.threadMode,
        threadDirection: feature.threadDirection,
      })) || [],
    };
    return () => { delete window.__madcadVerifyEngineState; };
  }, [engine.status, engine.revision, engine.cache, engine.bodies, engine.timeline, engine.diagnostics, engine.performance, engine.evaluatedDocument]);

  const updateCommand = (patch) => {
    if (Object.hasOwn(patch, 'dynamicLength')) sketchDynamicLengthRef.current = patch.dynamicLength;
    setCommand((current) => {
      const next = { ...current, ...patch };
      if (next.type === 'surfacePatch') {
        next.previewFeature = createFeature('surfacePatch', {
          name: current.previewFeature?.name || `Patch ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (selectedProfile ? [selectedProfile.id] : []),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'surfaceExtrude') {
        next.previewFeature = createFeature('surfaceExtrude', {
          name: current.previewFeature?.name || `Powierzchnia wyciągnięta ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || next.sourceSketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (next.openChain ? [] : (selectedProfile ? [selectedProfile.id] : [])),
          openEntityIds: current.previewFeature?.openEntityIds || (next.openChain ? next.openEntityIds : undefined),
          distance: next.distance,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'surfaceRevolve') {
        next.previewFeature = createFeature('surfaceRevolve', {
          name: current.previewFeature?.name || `Powierzchnia obrotowa ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || next.sourceSketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (next.openChain ? [] : (selectedProfile ? [selectedProfile.id] : [])),
          openEntityIds: current.previewFeature?.openEntityIds || (next.openChain ? next.openEntityIds : undefined),
          axisId: next.axisId,
          angle: next.angle,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'surfaceSweep') {
        next.previewFeature = createFeature('surfaceSweep', {
          name: current.previewFeature?.name || `Powierzchnia po ścieżce ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || next.sourceSketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (next.openChain ? [] : (selectedProfile ? [selectedProfile.id] : [])),
          openEntityIds: current.previewFeature?.openEntityIds || (next.openChain ? next.openEntityIds : undefined),
          pathSketchId: next.pathSketchId,
          pathEntityIds: next.pathEntityIds,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'surfaceLoft') {
        const sourceSketchId = current.previewFeature?.sketchIds?.[0] || selectedProfileMatch?.sketch.id;
        const sourceProfileId = current.previewFeature?.profileIds?.[0] || selectedProfile?.id;
        next.previewFeature = createFeature('surfaceLoft', {
          name: current.previewFeature?.name || `Powierzchnia przejściowa ${document.features.length + 1}`,
          sketchId: sourceSketchId,
          sketchIds: [sourceSketchId, next.endSketchId],
          profileIds: [sourceProfileId, next.endProfileId],
          loftMode: next.loftMode,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'surfaceOffset') {
        next.previewFeature = createFeature('surfaceOffset', {
          name: current.previewFeature?.name || `Odsunięcie powierzchni ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          distance: next.distance,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'surfaceStitch') {
        next.previewFeature = createFeature('surfaceStitch', {
          name: current.previewFeature?.name || `Zszycie powierzchni ${document.features.length + 1}`,
          targetBodyIds: current.previewFeature?.targetBodyIds || next.targetBodyIds,
          tolerance: next.tolerance,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'surfaceTrim') {
        next.previewFeature = createFeature('surfaceTrim', {
          name: current.previewFeature?.name || `Przycięcie powierzchni ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          toolBodyId: current.previewFeature?.toolBodyId || next.toolBodyId,
          keepTool: next.keepTool !== false,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'surfaceExtend') {
        next.previewFeature = createFeature('surfaceExtend', {
          name: current.previewFeature?.name || `Przedłużenie powierzchni ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          distance: next.distance,
          referenceIds: (next.topologyReferences || current.topologyReferences || []).map((reference) => reference.id),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'thickenSurface') {
        next.previewFeature = createFeature('thickenSurface', {
          name: current.previewFeature?.name || `Pogrubienie ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          thickness: next.thickness,
          side: next.side,
          reverse: Boolean(next.reverse),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'sheetBase') {
        next.previewFeature = createFeature('sheetBase', {
          name: current.previewFeature?.name || `Baza blachowa ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (selectedProfile ? [selectedProfile.id] : []),
          thickness: next.thickness,
          bendRadius: next.bendRadius,
          kFactor: next.kFactor,
          side: next.side,
          reverse: Boolean(next.reverse),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'sheetFlange') {
        next.previewFeature = createFeature('sheetFlange', {
          name: current.previewFeature?.name || `Kołnierz blachy ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          referenceIds: (next.topologyReferences || current.topologyReferences || []).map((reference) => reference.id),
          length: next.length,
          angle: next.angle,
          bendRadius: next.bendRadius,
          reverse: Boolean(next.reverse),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'sheetHem') {
        next.previewFeature = createFeature('sheetHem', {
          name: current.previewFeature?.name || `Zawinięcie blachy ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          referenceIds: (next.topologyReferences || current.topologyReferences || []).map((reference) => reference.id),
          length: next.length,
          gap: next.gap,
          reverse: Boolean(next.reverse),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'sheetRip') {
        next.previewFeature = createFeature('sheetRip', {
          name: current.previewFeature?.name || `Szczelina blachy ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          referenceIds: (next.topologyReferences || current.topologyReferences || []).map((reference) => reference.id),
          gap: next.gap,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'plasticBoss') {
        next.previewFeature = createFeature('plasticBoss', {
          name: current.previewFeature?.name || `Boss ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          referenceIds: (next.topologyReferences || current.topologyReferences || []).map((reference) => reference.id),
          outerDiameter: next.outerDiameter,
          holeDiameter: next.holeDiameter,
          height: next.height,
          holeDepth: next.holeDepth,
          offsetX: next.offsetX,
          offsetY: next.offsetY,
          reverse: Boolean(next.reverse),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'plasticSnapFit') {
        next.previewFeature = createFeature('plasticSnapFit', {
          name: current.previewFeature?.name || `Snap-fit ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          referenceIds: (next.topologyReferences || current.topologyReferences || []).map((reference) => reference.id),
          length: next.length,
          width: next.width,
          thickness: next.thickness,
          clearance: next.clearance,
          hookLength: next.hookLength,
          hookHeight: next.hookHeight,
          offsetX: next.offsetX,
          offsetY: next.offsetY,
          reverse: Boolean(next.reverse),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'plasticGrille') {
        next.previewFeature = createFeature('plasticGrille', {
          name: current.previewFeature?.name || `Grille ${document.features.length + 1}`,
          targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId,
          referenceIds: (next.topologyReferences || current.topologyReferences || []).map((reference) => reference.id),
          ribCount: next.ribCount,
          ribWidth: next.ribWidth,
          gap: next.gap,
          length: next.length,
          depth: next.depth,
          offsetX: next.offsetX,
          offsetY: next.offsetY,
          reverse: Boolean(next.reverse),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'extrude') {
        if (next.extent === 'through-all' && !['cut', 'intersect'].includes(next.operation)) next.extent = 'one-side';
        if (next.extent === 'to-object' && !next.targetReferenceId) next.targetReferenceId = next.targetOptions[0]?.id;
        const targetOption = next.targetOptions.find((option) => option.id === next.targetReferenceId);
        next.topologyReferences = next.extent === 'to-object' && targetOption?.reference ? [targetOption.reference] : [];
        next.previewFeature = createFeature('extrude', {
          name: current.previewFeature?.name || `Wyciągnięcie ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (selectedProfile ? [selectedProfile.id] : []),
          openEntityIds: current.previewFeature?.openEntityIds,
          distance: next.distance,
          secondDistance: next.secondDistance,
          startOffset: next.startOffset,
          extent: next.extent,
          targetReferenceId: next.extent === 'to-object' ? next.targetReferenceId : undefined,
          thin: Boolean(next.thin),
          wallThickness: next.wallThickness,
          wallSide: next.wallSide,
          endCap: next.endCap,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'revolve') {
        next.previewFeature = createFeature('revolve', {
          name: current.previewFeature?.name || `Revolve ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (selectedProfile ? [selectedProfile.id] : []),
          axisId: next.axisId,
          angle: next.angle,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'sweep') {
        next.previewFeature = createFeature('sweep', {
          name: current.previewFeature?.name || `Sweep ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (selectedProfile ? [selectedProfile.id] : []),
          pathSketchId: next.pathSketchId,
          pathEntityIds: next.pathEntityIds,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'loft') {
        const sourceSketchId = current.previewFeature?.sketchIds?.[0] || selectedProfileMatch?.sketch.id;
        const sourceProfileId = current.previewFeature?.profileIds?.[0] || selectedProfile?.id;
        next.previewFeature = createFeature('loft', {
          name: current.previewFeature?.name || `Loft ${document.features.length + 1}`,
          sketchId: sourceSketchId,
          sketchIds: [sourceSketchId, next.endSketchId],
          profileIds: [sourceProfileId, next.endProfileId],
          loftMode: next.loftMode,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'rib') {
        next.previewFeature = createFeature('rib', {
          name: current.previewFeature?.name || `Rib/Web ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || next.sourceSketchId,
          openEntityIds: current.previewFeature?.openEntityIds || next.openEntityIds,
          targetBodyId: current.previewFeature?.targetBodyId || targetBodyId,
          ribMode: next.ribMode,
          thickness: next.thickness,
          depth: next.depth,
          wallSide: next.wallSide,
          reverse: Boolean(next.reverse),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'coil') {
        next.previewFeature = createFeature('coil', {
          name: current.previewFeature?.name || `Coil ${document.features.length + 1}`,
          axisId: next.axisId,
          coilDiameter: next.coilDiameter,
          wireDiameter: next.wireDiameter,
          pitch: next.pitch,
          turns: next.turns,
          handedness: next.handedness,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'pipe') {
        next.previewFeature = createFeature('pipe', {
          name: current.previewFeature?.name || `Pipe ${document.features.length + 1}`,
          pathSketchId: current.previewFeature?.pathSketchId || next.pathSketchId,
          pathEntityIds: current.previewFeature?.pathEntityIds || next.pathEntityIds,
          outsideDiameter: next.outsideDiameter,
          wallThickness: next.wallThickness,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'pattern') {
        next.previewFeature = createFeature('pattern', { name: current.previewFeature?.name || `Pattern ${document.features.length + 1}`, targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId, patternType: next.patternType, countX: next.countX, countY: next.countY, spacingX: next.spacingX, spacingY: next.spacingY, axisId: next.axisId, occurrences: next.occurrences, totalAngle: next.totalAngle, pathSketchId: next.pathSketchId, pathEntityIds: next.pathEntityIds });
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
            holeStandard: next.holeStandard, holeApplication: next.holeApplication, standardSize: next.standardSize, clearanceClass: next.clearanceClass, threadClass: next.threadClass, threadDesignation: next.threadDesignation, threadInspection: next.threadInspection,
            pipePreparation: next.pipePreparation, threadTaper: next.threadTaper, threadProfileAngle: next.threadProfileAngle, diameterToleranceLower: next.diameterToleranceLower, diameterToleranceUpper: next.diameterToleranceUpper,
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
            holeStandard: next.holeStandard, holeApplication: next.holeApplication, standardSize: next.standardSize, clearanceClass: next.clearanceClass, threadClass: next.threadClass, threadDesignation: next.threadDesignation, threadInspection: next.threadInspection,
            pipePreparation: next.pipePreparation, threadTaper: next.threadTaper, threadProfileAngle: next.threadProfileAngle, diameterToleranceLower: next.diameterToleranceLower, diameterToleranceUpper: next.diameterToleranceUpper,
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
      if (next.type === 'formBody') {
        next.previewFeature = createFeature('formBody', {
          name: next.name,
          width: next.width,
          depth: next.depth,
          height: next.height,
          subdivisions: next.subdivisions,
          symmetry: next.symmetry || 'none',
          controlOffsets: next.controlOffsets,
          creaseEdges: next.creaseEdges || [],
          insertEdgeEnabled: next.insertEdgeEnabled === true,
          insertEdgeIndex: next.insertEdgeIndex,
          insertEdgePosition: next.insertEdgePosition,
          insertEdgeOffsets: next.insertEdgeOffsets,
          bridgeEnabled: next.bridgeEnabled === true,
          bridgeFirstFace: next.bridgeFirstFace,
          bridgeSecondFace: next.bridgeSecondFace,
          bridgeInset: next.bridgeInset,
          bridgeOffsets: next.bridgeOffsets,
          x: next.x, y: next.y, z: next.z,
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
          placement: next.placement,
          referenceIds: current.previewFeature?.referenceIds || next.topologyReferences?.map((reference) => reference.id) || [],
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
      if (next.type === 'draft') {
        next.previewFeature = createFeature('draft', {
          name: current.previewFeature?.name || `Draft ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId || targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
          neutralPlaneId: next.neutralPlaneId,
          angle: next.angle,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'splitBody') {
        next.previewFeature = createFeature('splitBody', {
          name: current.previewFeature?.name || `Split Body ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId || targetBodyId,
          planeId: next.planeId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'splitFace') {
        next.previewFeature = createFeature('splitFace', {
          name: current.previewFeature?.name || `Split Face ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId,
          sketchId: next.sketchId,
          profileId: next.profileId,
          referenceIds: current.previewFeature?.referenceIds || [next.referenceId],
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'deleteFace') {
        next.previewFeature = createFeature('deleteFace', {
          name: current.previewFeature?.name || `Delete Face + Heal ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'replaceFace') {
        next.previewFeature = createFeature('replaceFace', {
          name: current.previewFeature?.name || `Replace Face ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
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

  const pickPlane = (plane, { forceNew = false } = {}) => {
    if (readOnly) return readOnlyNotice();
    const resumableSketches = !forceNew ? resolveResumableSketches({
      plane,
      sketches: document.sketches,
      bodyCount: engine.bodies.length,
      featureCount: document.features.length,
    }) : [];
    const resumable = resumableSketches.at(-1) || null;
    if (resumable) {
      commit((next) => {
        const result = mergeResumableSketches(next, plane);
        if (result.sketch) refreshDetectedSketchProfiles(result.sketch, next.parameters);
      });
      setActiveSketchId(resumable.id);
      setSelection({ kind: 'sketch', id: resumable.id });
      setCommand(null);
      setWorkspace('sketch');
      setNotice(resumableSketches.length > 1
        ? `Kontynuujesz ${resumable.name} na płaszczyźnie ${plane}. Połączono ${resumableSketches.length} wcześniejsze szkice, więc cała geometria tworzy wspólne profile.`
        : `Kontynuujesz ${resumable.name} na płaszczyźnie ${plane}. Stara i nowa geometria tworzą wspólne profile.`);
      return;
    }
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
    const finishedSource = sketch ? resolveExtrudeSource({ sketches: [sketch], selection: { kind: 'sketch', id: sketch.id } }) : { kind: 'none' };
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
    else if (sketch) setSelection({ kind: 'sketch', id: sketch.id });
    setNotice(lastProfile
      ? 'Szkic zakończony. Ostatni profil jest zaznaczony i gotowy do operacji bryłowej.'
      : finishedSource.kind === 'open-chain'
        ? 'Szkic zakończony. Otwarty łańcuch jest widoczny i gotowy do cienkiego wyciągnięcia.'
        : 'Szkic zakończony. Obrys nie jest domknięty; popraw przerwy, aby utworzyć profil bryłowy.');
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
      setCommand({ type, definition: 'center', gesturePoints: [], editId: profile?.id || null, name: profile?.name || `Prostokąt ${document.sketches.flatMap((item) => item.profiles).length + 1}`, width: profile?.geometry.width || '40', height: profile?.geometry.height || '30', x: profile?.geometry.x || '0', y: profile?.geometry.y || '0', rotation: '0', x1: '-20', y1: '-15', x2: '20', y2: '15', x3: '20', y3: '15' });
    } else {
      setCommand({ type, definition: 'centerRadius', gesturePoints: [], editId: profile?.id || null, name: profile?.name || `Okrąg ${document.sketches.flatMap((item) => item.profiles).length + 1}`, diameter: profile?.geometry.diameter || '10', x: profile?.geometry.x || '0', y: profile?.geometry.y || '0', x1: '-5', y1: '0', x2: '5', y2: '0', x3: '0', y3: '5' });
    }
    setNotice(profile ? 'Kliknij nowe punkty na płótnie albo wpisz dokładne dane.' : 'Wskaż punkty figury bezpośrednio na płótnie; pola służą do opcjonalnego wpisania dokładnych danych.');
  };

  const openMechanicalShape = (type) => {
    if (readOnly) return readOnlyNotice();
    if (!activeSketchId) {
      startSketch();
      return;
    }
    const number = document.sketches.flatMap((item) => item.profiles).length + 1;
    if (type === 'arc') setCommand({ type, definition: 'threePoints', gesturePoints: [], name: `Łuk ${number}`, x1: '-10', y1: '0', x2: '0', y2: '10', x3: '10', y3: '0', direction: 'ccw' });
    if (type === 'polygon') setCommand({ type, definition: 'inscribed', gesturePoints: [], name: `Wielokąt ${number}`, sides: '6', radius: '15', x: '0', y: '0', rotation: '0', x1: '-10', y1: '0', x2: '10', y2: '0' });
    if (type === 'ellipse') setCommand({ type, definition: 'full', gesturePoints: [], name: `Elipsa ${number}`, majorRadius: '20', minorRadius: '10', x: '0', y: '0', rotation: '0', startAngle: '0', endAngle: '180', direction: 'ccw' });
    if (type === 'slot') setCommand({ type, definition: 'centerToCenter', gesturePoints: [], name: `Slot ${number}`, x1: '-15', y1: '0', x2: '15', y2: '0', x3: '-15', y3: '5', x: '0', y: '0', radius: '25', startAngle: '0', endAngle: '90', direction: 'ccw', width: '10' });
    if (type === 'spline') setCommand({ type, definition: 'fit', gesturePoints: [], name: `Spline ${number}`, pointsText: '-20,0; -8,15; 8,-15; 20,0' });
    if (type === 'conic') setCommand({ type, gesturePoints: [], name: `Conic ${number}`, x1: '-20', y1: '0', x2: '0', y2: '20', x3: '20', y3: '0', rho: '0.7071067812', continuity: 'tangent' });
    if (type === 'point') setCommand({ type, gesturePoints: [], x: '0', y: '0', role: 'standard' });
    setNotice(type === 'spline' ? 'Klikaj punkty spline na płótnie; Enter kończy, a Escape anuluje polecenie.' : 'Wskaż kolejne punkty figury na płótnie albo wpisz dokładne dane w panelu.');
  };

  const openSketchPath = (type) => {
    if (readOnly) return readOnlyNotice();
    if (!activeSketchId) {
      startSketch();
      return;
    }
    sketchPointerRef.current = null;
    sketchDynamicLengthRef.current = '';
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
      dynamicLength: '',
      segmentMode: 'line',
    });
    setNotice(type === 'line' ? 'Wskaż punkt początkowy linii.' : 'Klikaj kolejne punkty polilinii; kliknij początek, aby zamknąć profil.');
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

  const appendSketchPoint = (coordinates, snapResult = null) => {
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
      sketchDynamicLengthRef.current = '';
      setCommand((current) => ({ ...current, pointIds: [start.id], points: [point], firstPoint: point, lastPoint: point, dynamicLength: '' }));
      setNotice('Punkt początkowy ustawiony. Ustaw kierunek kursorem, wpisz długość i naciśnij Enter albo kliknij koniec.');
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

    const suggestion = !closes && !snapResult?.snapped && command.segmentMode === 'line' && sketchOptions.autoConstraints
      ? inferLineConstraintSuggestion(start, point)
      : null;
    const end = closes ? command.firstPoint : (suggestion?.adjustedEnd || point);
    const targetPoint = closes ? null : createSketchPoint({ x: end[0].toFixed(3), y: end[1].toFixed(3) });
    const targetPointId = closes ? command.pointIds[0] : targetPoint.id;
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
    const automaticConstraints = sketchOptions.autoConstraints && segment.type === 'line'
      ? addAutomaticConstraintsForLine(detectionSketch, segment.id, document.parameters)
      : [];
    const topology = refreshDetectedSketchProfiles(detectionSketch, document.parameters);
    const detectedProfile = topology.profiles.find((profile) => profile.entityIds.includes(segment.id)) || null;
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      if (targetPoint) sketch.entities.push(targetPoint);
      if (auxiliaryPoint) sketch.entities.push(auxiliaryPoint);
      sketch.entities.push(segment);
      sketch.constraints = structuredClone(detectionSketch.constraints || []);
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
      } else {
        setSelection({ kind: 'sketchEntities', ids: [segment.id], sketchId: activeSketchId });
        setNotice(automaticConstraints.length
          ? `Linia została dodana i zaznaczona · automatyczny więz: ${automaticConstraints.map((constraint) => constraint.type === 'horizontal' ? 'poziomo' : constraint.type === 'vertical' ? 'pionowo' : 'zbieżność').join(', ')}.`
          : 'Linia została dodana i zaznaczona. Możesz użyć Thin Extrude albo Pipe.');
      }
      return;
    }
    setCommand((current) => ({
      ...current,
      pointIds: [...current.pointIds, targetPoint.id],
      segmentIds: [...current.segmentIds, segment.id],
      auxiliaryPointIds: [...current.auxiliaryPointIds, auxiliaryPoint?.id || null],
      points: [...current.points, end],
      tangents: [...current.tangents, endTangent],
      lastPoint: end,
      lastTangent: endTangent,
      segmentMode: 'line',
      dynamicLength: '',
    }));
    sketchDynamicLengthRef.current = '';
    setNotice(automaticConstraints.length
      ? `Segment dodany · automatyczny więz: ${automaticConstraints.map((constraint) => constraint.type === 'horizontal' ? 'poziomo' : constraint.type === 'vertical' ? 'pionowo' : 'zbieżność').join(', ')}.`
      : 'Segment dodany. Kliknij kolejny punkt, wybierz łuk styczny albo zamknij profil.');
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

  const confirmDynamicSketchSegment = () => {
    if (!command?.lastPoint) return;
    const length = Number(sketchDynamicLengthRef.current.replace(',', '.'));
    if (!(length > 0)) {
      setNotice('Wpisz dodatnią długość linii.');
      return;
    }
    const pointer = sketchPointerRef.current;
    const deltaX = Number(pointer?.[0]) - command.lastPoint[0];
    const deltaY = Number(pointer?.[1]) - command.lastPoint[1];
    const pointerDistance = Math.hypot(deltaX, deltaY);
    const radians = pointerDistance > 1e-7
      ? Math.atan2(deltaY, deltaX)
      : Number(command.angle || 0) * Math.PI / 180;
    sketchDynamicLengthRef.current = '';
    appendSketchPoint([
      command.lastPoint[0] + (Math.cos(radians) * length),
      command.lastPoint[1] + (Math.sin(radians) * length),
    ]);
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
    const sketch = document.sketches.find((item) => item.id === activeSketchId);
    const expanded = new Set(ids || []);
    for (const instance of sketch?.blockInstances || []) {
      if (instance.entityIds.some((entityId) => expanded.has(entityId))) instance.entityIds.forEach((entityId) => expanded.add(entityId));
    }
    const candidates = [...expanded];
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
      setNotice(`${details.crossing ? 'Wybór przecinający' : 'Zaznaczenie'}: ${candidates.length} ${candidates.length === 1 ? 'element' : 'elementy'}. ${multipleSelectionLabel(DESKTOP_PLATFORM)} dodaje kolejne.`);
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
    setNotice(`${label} zaznaczona przez trwałe ID: ${topology.id}.${mode === 'replace' ? '' : ` ${multipleSelectionLabel(DESKTOP_PLATFORM)} utrzymuje wybór wielokrotny.`}`);
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

  const toggleSketchVisibility = (sketchId) => {
    if (readOnly) return readOnlyNotice();
    let willBeVisible = false;
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === sketchId);
      if (!sketch) return;
      sketch.visible = sketch.visible === false;
      willBeVisible = sketch.visible;
    });
    if (willBeVisible) setSelection({ kind: 'sketch', id: sketchId });
    else if (selection?.id === sketchId || selection?.sketchId === sketchId) setSelection({ kind: 'document', id: document.id });
    setNotice(willBeVisible ? 'Szkic jest widoczny na płótnie.' : 'Szkic ukryto na płótnie.');
  };

  const toggleBodyVisibility = (bodyId) => {
    if (readOnly) return readOnlyNotice();
    const body = engine.bodies.find((item) => item.id === bodyId);
    const sourceFeatureId = body?.sourceFeatureId || (body?.id?.startsWith('body-') ? body.id.slice(5) : '');
    let willBeVisible = false;
    commit((next) => {
      const feature = next.features.find((item) => item.id === sourceFeatureId);
      if (!feature) return;
      feature.visible = feature.visible === false;
      willBeVisible = feature.visible;
    });
    if (!willBeVisible && (selection?.id === bodyId || selection?.bodyId === bodyId)) setSelection({ kind: 'document', id: document.id });
    else if (willBeVisible) setSelection({ kind: 'body', id: bodyId });
    setNotice(willBeVisible ? 'Bryła jest widoczna na płótnie.' : 'Bryłę ukryto na płótnie.');
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
    const valid = type === 'collinear' ? canAddCollinear : type === 'symmetry' ? canAddSymmetry : type === 'curvature' ? canAddCurvature : false;
    if (!activeSketchId || !valid) {
      setNotice(type === 'collinear' ? 'Współliniowość wymaga zaznaczenia dwóch linii.' : type === 'symmetry' ? 'Symetria wymaga zaznaczenia dwóch punktów i jednej linii osi.' : 'Krzywizna G2 wymaga dwóch łuków z jednym wspólnym końcem.');
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
      setNotice(type === 'collinear' ? 'Dodano więz współliniowości. Cofnij przywraca poprzednią geometrię.' : type === 'symmetry' ? 'Dodano więz symetrii względem wskazanej osi. Cofnij przywraca poprzednią geometrię.' : 'Dodano ciągłość krzywizny G2 między łukami. Cofnij przywraca poprzednią geometrię.');
    } catch (error) {
      setNotice(`Nie dodano więzu: ${error.message}`);
    }
  };

  const openSketchDimension = (dimensionType) => {
    if (readOnly) return readOnlyNotice();
    const sketch = document.sketches.find((item) => item.id === activeSketchId);
    const entity = selectedSketchEntities[0];
    if (!sketch || (dimensionType === 'arcLength' ? !canAddArcLength : !canAddOrdinate)) {
      setNotice(dimensionType === 'arcLength' ? 'Długość łuku wymaga zaznaczenia jednego łuku.' : 'Wymiar ordinate wymaga zaznaczenia jednego punktu.');
      return;
    }
    let value = dimensionType === 'ordinateX' ? entity.geometry.x : entity.geometry.y;
    if (dimensionType === 'arcLength') {
      const resolved = resolveParameters(document.parameters);
      if (!resolved.valid) {
        setNotice('Nie można odczytać długości łuku, dopóki parametry dokumentu zawierają błędy.');
        return;
      }
      const [center, start, end] = entity.pointIds.map((pointId) => sketch.entities.find((item) => item.id === pointId));
      const point = (item) => ({
        x: evaluateExpression(item?.geometry?.x, resolved.values),
        y: evaluateExpression(item?.geometry?.y, resolved.values),
      });
      const centerValue = point(center); const startValue = point(start); const endValue = point(end);
      if ([centerValue, startValue, endValue].some((item) => !Number.isFinite(item.x) || !Number.isFinite(item.y))) {
        setNotice('Nie można odczytać bieżącej długości łuku. Sprawdź współrzędne jego punktów.');
        return;
      }
      const radius = Math.hypot(startValue.x - centerValue.x, startValue.y - centerValue.y);
      let sweep = Math.atan2(endValue.y - centerValue.y, endValue.x - centerValue.x) - Math.atan2(startValue.y - centerValue.y, startValue.x - centerValue.x);
      if (entity.geometry.direction === 'cw') { while (sweep >= 0) sweep -= Math.PI * 2; }
      else { while (sweep <= 0) sweep += Math.PI * 2; }
      value = String(radius * Math.abs(sweep));
    }
    setCommand({ type: 'sketchDimension', dimensionType, entityIds: [...selectedSketchEntityIds], value: String(value) });
    setNotice('Podaj wartość sterującą wymiaru szkicu.');
  };

  const confirmSketchDimension = () => {
    if (command?.type !== 'sketchDimension' || readOnly) return;
    try {
      const checked = cloneDocument(document);
      const checkedSketch = checked.sketches.find((item) => item.id === activeSketchId);
      if (!checkedSketch) throw new Error('Nie znaleziono aktywnego szkicu.');
      const created = addDrivingSketchDimension(checkedSketch, command.dimensionType, command.entityIds, { expression: command.value });
      const checkedSolution = solveSketchConstraints(checkedSketch, checked.parameters);
      if (!checkedSolution.converged || !checkedSolution.solved || checkedSolution.status === SKETCH_SOLVER_STATUS.CONFLICT) {
        throw new Error(checkedSolution.diagnostics?.[0]?.message || 'Solver nie znalazł poprawnego rozwiązania.');
      }
      applySketchConstraintSolution(checkedSketch, checkedSolution);
      refreshDetectedSketchProfiles(checkedSketch, checked.parameters);
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        sketch.constraints.push({ ...created.constraint, entityIds: [...created.constraint.entityIds] });
        sketch.dimensions.push({ ...created.dimension, entityIds: [...created.dimension.entityIds] });
        const solution = solveSketchConstraints(sketch, next.parameters);
        if (!solution.converged || !solution.solved || solution.status === SKETCH_SOLVER_STATUS.CONFLICT) throw new Error('Solver nie odtworzył wymiaru.');
        applySketchConstraintSolution(sketch, solution);
        refreshDetectedSketchProfiles(sketch, next.parameters);
      });
      setSelection({ kind: 'sketchConstraint', id: created.constraint.id, sketchId: activeSketchId });
      setCommand(null);
      setNotice('Dodano sterujący wymiar szkicu. Zaznacz jego znacznik, aby zmienić wartość.');
    } catch (error) {
      setNotice(`Nie dodano wymiaru: ${error.message}`);
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
      commit((next) => Object.assign(next, checked));
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
      commit((next) => Object.assign(next, checked));
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
      commit((next) => Object.assign(next, checked));
      const resultIds = result.createdEntityIds || result.transformedEntityIds;
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: resultIds });
      setCommand(null);
      const label = command.operation[0].toUpperCase() + command.operation.slice(1);
      setNotice(`${label} wykonany dla ${resultIds.length} ${resultIds.length === 1 ? 'elementu' : 'elementów'}${result.removedConstraintIds?.length ? `; usunięto ${result.removedConstraintIds.length} zerwanych więzów` : ''}. Cofnij przywraca stan.`);
    } catch (error) {
      setNotice(`Transformacja nie została wykonana: ${error.message}`);
    }
  };

  const openSketchPattern = () => {
    if (!selectedSketchEntityIds.length) {
      setNotice('Najpierw zaznacz geometrię źródłową szyku.');
      return;
    }
    const sketch = document.sketches.find((item) => item.id === activeSketchId);
    const pathOptions = (sketch?.entities || []).filter((entity) => ['line', 'arc'].includes(entity.type) && !selectedSketchEntityIds.includes(entity.id))
      .map((entity, index) => ({ id: entity.id, label: `${entity.type === 'line' ? 'Linia' : 'Łuk'} ścieżki ${index + 1}` }));
    setCommand({ type: 'patternSketch', mode: 'rectangular', columns: '3', rows: '2', spacingX: '15', spacingY: '15', count: '6', centerX: '0', centerY: '0', totalAngle: '360', pathEntityId: pathOptions[0]?.id || '', pathOptions, orientToPath: true, skippedOccurrences: '' });
    setNotice('Wybierz szyk prostokątny lub kołowy oraz opcjonalne wystąpienia do pominięcia.');
  };

  const confirmSketchPattern = () => {
    const applyPattern = (next) => command.mode === 'circular'
      ? circularSketchPattern(next, activeSketchId, selectedSketchEntityIds, { count: command.count, centerX: command.centerX, centerY: command.centerY, totalAngle: command.totalAngle, skippedOccurrences: command.skippedOccurrences })
      : command.mode === 'path'
        ? pathSketchPattern(next, activeSketchId, selectedSketchEntityIds, { pathEntityId: command.pathEntityId, count: command.count, orientToPath: command.orientToPath, skippedOccurrences: command.skippedOccurrences })
        : rectangularSketchPattern(next, activeSketchId, selectedSketchEntityIds, { columns: command.columns, rows: command.rows, spacingX: command.spacingX, spacingY: command.spacingY, skippedOccurrences: command.skippedOccurrences });
    try {
      const checked = cloneDocument(document);
      const result = applyPattern(checked);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: result.createdEntityIds });
      setCommand(null);
      setNotice(`${command.mode === 'circular' ? 'Szyk kołowy' : command.mode === 'path' ? 'Szyk po ścieżce' : 'Szyk prostokątny'} utworzył ${result.occurrences.length} ${result.occurrences.length === 1 ? 'kopię' : 'kopie'}${result.skippedOccurrences.length ? `; pominięto: ${result.skippedOccurrences.join(', ')}` : ''}. Cofnij przywraca stan.`);
    } catch (error) {
      setNotice(`Szyk nie został wykonany: ${error.message}`);
    }
  };

  const projectSelectedTopology = () => {
    if (readOnly) return readOnlyNotice();
    const selected = (selection?.items || (['edge', 'vertex'].includes(selection?.kind) ? [selection] : [])).filter((item) => ['edge', 'vertex'].includes(item.kind));
    if (command?.type !== 'projectSketch' || !selected.length) {
      setCommand({ type: 'projectSketch' });
      setNotice(`Project: kliknij wierzchołek albo krawędź modelu. ${multipleSelectionLabel(DESKTOP_PLATFORM)} dodaje kolejne; ponownie wybierz Project, aby zatwierdzić.`);
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
      const checked = cloneDocument(document);
      const result = projectTopologyToSketch(checked, activeSketchId, sources);
      commit((next) => Object.assign(next, checked));
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
    window.__madcadVerifyCanvasSketchPoint = handleSketchCanvasPoint;
    window.__madcadVerifyFinishCanvasSketchTool = finishCanvasSketchTool;
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
    window.__madcadVerifyOpenFirstSketch = () => {
      const sketch = document.sketches[0];
      if (!sketch) throw new Error('Brak szkicu do otwarcia.');
      setActiveSketchId(sketch.id);
      setWorkspace('sketch');
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
      return sketch.id;
    };
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
    window.__madcadVerifyLoadSketchDrawingFixture = () => {
      const fixture = createDocument('Rysunek techniczny 2D');
      const coordinates = [[0, 0], [80, 0], [80, 40], [0, 40]];
      const points = coordinates.map(([x, y]) => createSketchPoint({ x, y }));
      const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
      fixture.sketches.push(createSketch({ name: 'Obrys płyty 80 × 40', plane: 'XY', entities: [...points, ...lines] }));
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
      const curvatureCenters = [createSketchPoint({ x: 20, y: 0, fixed: true }), createSketchPoint({ x: 22, y: 1 })];
      const curvaturePoints = [createSketchPoint({ x: 10, y: 0 }), createSketchPoint({ x: 30, y: 0 }), createSketchPoint({ x: 20, y: 10 })];
      const curvatureArcs = [
        createSketchArc({ centerPointId: curvatureCenters[0].id, startPointId: curvaturePoints[0].id, endPointId: curvaturePoints[1].id, direction: 'ccw' }),
        createSketchArc({ centerPointId: curvatureCenters[1].id, startPointId: curvaturePoints[1].id, endPointId: curvaturePoints[2].id, direction: 'ccw' }),
      ];
      const sketch = createSketch({ name: 'Szkic więzów P1', plane: 'XY', entities: [...sourcePoints, ...targetPoints, sourceLine, targetLine, ...axisPoints, axisLine, ...symmetryPoints, ...curvatureCenters, ...curvaturePoints, ...curvatureArcs] });
      fixture.sketches.push(sketch);
      window.__madcadConstraintFixtureIds = {
        collinear: [sourceLine.id, targetLine.id],
        symmetry: [symmetryPoints[0].id, symmetryPoints[1].id, axisLine.id],
        targetPointIds: targetPoints.map((point) => point.id),
        reflectedPointId: symmetryPoints[1].id,
        curvature: curvatureArcs.map((arc) => arc.id),
        curvatureCenterId: curvatureCenters[1].id,
      };
      history.replace(fixture);
      setActiveSketchId(sketch.id);
      setWorkspace('sketch');
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadDimensionFixture = () => {
      const fixture = createDocument('Wymiary P1');
      const ordinatePoint = createSketchPoint({ x: 3, y: 4 });
      const center = createSketchPoint({ x: 0, y: 0, fixed: true });
      const start = createSketchPoint({ x: 10, y: 0 });
      const end = createSketchPoint({ x: 0, y: 10 });
      const arc = createSketchArc({ centerPointId: center.id, startPointId: start.id, endPointId: end.id, direction: 'ccw' });
      const sketch = createSketch({ name: 'Szkic wymiarów P1', plane: 'XY', entities: [ordinatePoint, center, start, end, arc] });
      fixture.sketches.push(sketch);
      window.__madcadDimensionFixtureIds = {
        pointId: ordinatePoint.id,
        arcId: arc.id,
        centerId: center.id,
        startId: start.id,
        endId: end.id,
      };
      history.replace(fixture);
      setActiveSketchId(sketch.id);
      setWorkspace('sketch');
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadPatternFixture = (mode = 'rectangular') => {
      const fixture = createDocument(`Szyk ${mode}`);
      if (mode === 'path') {
        const source = createSketchPoint({ x: 0, y: 0 });
        const pathStart = createSketchPoint({ x: 0, y: 0, role: 'construction' });
        const pathEnd = createSketchPoint({ x: 30, y: 0, role: 'construction' });
        const pathLine = createSketchLine({ startPointId: pathStart.id, endPointId: pathEnd.id, role: 'construction' });
        const sketch = createSketch({ name: 'Szkic szyku po ścieżce', plane: 'XY', entities: [source, pathStart, pathEnd, pathLine] });
        fixture.sketches.push(sketch);
        window.__madcadPatternFixtureIds = { sourceIds: [source.id], pathId: pathLine.id };
        history.replace(fixture);
        setActiveSketchId(sketch.id);
        setWorkspace('sketch');
        setSelection({ kind: 'sketch', id: sketch.id });
        setCommand(null);
        return;
      }
      const points = [[10, -2], [14, -2], [14, 2], [10, 2]].map(([x, y]) => createSketchPoint({ x, y }));
      const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
      const sketch = createSketch({ name: `Szkic szyku ${mode}`, plane: 'XY', entities: [...points, ...lines] });
      refreshDetectedSketchProfiles(sketch, fixture.parameters);
      fixture.sketches.push(sketch);
      window.__madcadPatternFixtureIds = { lineIds: lines.map((line) => line.id) };
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
    window.__madcadVerifyReopenCurrentDocument = () => {
      const opened = openDocument(JSON.parse(JSON.stringify(document)));
      history.replace(opened.document);
      setSavedDocumentText(JSON.stringify(opened.document));
      setActiveSketchId(null);
      setWorkspace('solid');
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
    window.__madcadVerifyLoadTimelineFixture = () => {
      const fixture = createStarterDocument();
      fixture.features.push(createFeature('primitive', {
        name: 'Niezależny korpus',
        primitiveType: 'box',
        x: '70', y: '0', z: '0',
        width: '12', depth: '12', height: '12',
      }));
      history.replace(fixture);
      setActiveSketchId(null);
      setWorkspace('solid');
      setSelection({ kind: 'document', id: fixture.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadSurfaceFixture = (mode = 'patch') => {
      const fixture = createDocument('Przepływ powierzchniowy');
      if (mode === 'trim-source') {
        const trimProfile = createRectangleProfile({ name: 'Profil powierzchni Trim', width: 48, height: 32, x: 0, y: 0 });
        const trimSketch = createSketch({ name: 'Szkic powierzchni Trim', plane: 'XY', profiles: [trimProfile] });
        const trimSurface = createFeature('surfacePatch', { name: 'Powierzchnia do przycięcia', sketchId: trimSketch.id, profileIds: [trimProfile.id] });
        const trimTool = createFeature('primitive', { name: 'Bryła tnąca', primitiveType: 'box', x: '0', y: '-20', z: '-5', width: '30', depth: '40', height: '10' });
        fixture.sketches.push(trimSketch);
        fixture.features.push(trimSurface, trimTool);
        history.replace(fixture);
        setActiveSketchId(null);
        setWorkspace('solid');
        setSelection({ kind: 'document', id: fixture.id });
        setCommand(null);
        return;
      }
      if (mode === 'stitch-box' || mode === 'stitch-open') {
        const definitions = [
          { name: 'Dół', plane: 'XY', planeOffset: '0', width: 20, height: 10 },
          { name: 'Góra', plane: 'XY', planeOffset: '8', width: 20, height: 10 },
          { name: 'Przód', plane: 'XZ', planeOffset: '-5', width: 20, height: 8, y: 4 },
          { name: 'Tył', plane: 'XZ', planeOffset: '5', width: 20, height: 8, y: 4 },
          { name: 'Lewo', plane: 'YZ', planeOffset: '-10', width: 10, height: 8, y: 4 },
          { name: 'Prawo', plane: 'YZ', planeOffset: '10', width: 10, height: 8, y: 4 },
        ].filter((definition) => mode !== 'stitch-open' || definition.name !== 'Góra');
        const patchBodyIds = [];
        definitions.forEach((definition) => {
          const sideProfile = createRectangleProfile({ name: `Profil ${definition.name}`, width: definition.width, height: definition.height, x: 0, y: definition.y || 0 });
          const sideSketch = createSketch({ name: `Szkic ${definition.name}`, plane: definition.plane, planeOffset: definition.planeOffset, profiles: [sideProfile] });
          const sidePatch = createFeature('surfacePatch', { name: `Powierzchnia ${definition.name}`, sketchId: sideSketch.id, profileIds: [sideProfile.id] });
          fixture.sketches.push(sideSketch);
          fixture.features.push(sidePatch);
          patchBodyIds.push(`body-${sidePatch.id}`);
        });
        if (mode === 'stitch-open') fixture.features.push(createFeature('surfaceStitch', { name: 'Otwarty płaszcz', targetBodyIds: patchBodyIds, tolerance: '0.01' }));
        history.replace(fixture);
        setActiveSketchId(null);
        setWorkspace('solid');
        setSelection({ kind: 'document', id: fixture.id });
        setCommand(null);
        return;
      }
      const isExtrude = mode.startsWith('extrude');
      const isRevolve = mode.startsWith('revolve');
      const isSweep = mode.startsWith('sweep');
      const isLoft = mode.startsWith('loft');
      const profile = isExtrude
        ? createCircleProfile({ name: 'Profil powierzchni wyciągniętej', diameter: 24, x: 0, y: 0 })
        : (isRevolve || isSweep) ? null : createRectangleProfile({ name: isLoft ? 'Dolny profil powierzchni' : 'Profil Patch', width: isLoft ? 24 : 48, height: isLoft ? 16 : 32, x: 0, y: 0 });
      const openStart = (isRevolve || isSweep) ? createSketchPoint({ x: isRevolve ? 12 : 0, y: isRevolve ? -10 : -6 }) : null;
      const openEnd = (isRevolve || isSweep) ? createSketchPoint({ x: isRevolve ? 12 : 0, y: isRevolve ? 10 : 6 }) : null;
      const openLine = (isRevolve || isSweep) ? createSketchLine({ startPointId: openStart.id, endPointId: openEnd.id }) : null;
      const sketch = createSketch({ name: 'Szkic powierzchni', plane: 'XY', profiles: profile ? [profile] : [], entities: (isRevolve || isSweep) ? [openStart, openEnd, openLine] : [] });
      const pathStart = isSweep ? createSketchPoint({ x: 0, y: 0 }) : null;
      const pathCorner = isSweep ? createSketchPoint({ x: 25, y: 0 }) : null;
      const pathEnd = isSweep ? createSketchPoint({ x: 25, y: 18 }) : null;
      const pathLines = isSweep ? [createSketchLine({ startPointId: pathStart.id, endPointId: pathCorner.id }), createSketchLine({ startPointId: pathCorner.id, endPointId: pathEnd.id })] : [];
      const pathSketch = isSweep ? createSketch({ name: 'Ścieżka powierzchni', plane: 'XY', entities: [pathStart, pathCorner, pathEnd, ...pathLines] }) : null;
      const loftProfile = isLoft ? createRectangleProfile({ name: 'Górny profil powierzchni', width: 12, height: 8, x: 3, y: 2 }) : null;
      const loftSketch = isLoft ? createSketch({ name: 'Górny szkic powierzchni', plane: 'XY', planeOffset: '20', profiles: [loftProfile] }) : null;
      const surface = isExtrude
        ? createFeature('surfaceExtrude', { name: 'Powierzchnia walcowa', sketchId: sketch.id, profileIds: [profile.id], distance: '18' })
        : isRevolve
          ? createFeature('surfaceRevolve', { name: 'Powierzchnia obrotowa', sketchId: sketch.id, profileIds: [], openEntityIds: [openLine.id], axisId: 'Y_AXIS', angle: '270' })
          : isSweep
            ? createFeature('surfaceSweep', { name: 'Powierzchnia po ścieżce', sketchId: sketch.id, profileIds: [], openEntityIds: [openLine.id], pathSketchId: pathSketch.id, pathEntityIds: pathLines.map((line) => line.id) })
          : isLoft
            ? createFeature('surfaceLoft', { name: 'Powierzchnia przejściowa', sketchId: sketch.id, sketchIds: [sketch.id, loftSketch.id], profileIds: [profile.id, loftProfile.id], loftMode: 'smooth' })
        : createFeature('surfacePatch', { name: 'Powierzchnia bazowa', sketchId: sketch.id, profileIds: [profile.id] });
      fixture.sketches.push(sketch);
      if (pathSketch) fixture.sketches.push(pathSketch);
      if (loftSketch) fixture.sketches.push(loftSketch);
      if (!mode.endsWith('-source')) fixture.features.push(surface);
      if (mode === 'extrude-transformed') {
        fixture.features.push(createFeature('transform', {
          name: 'Przesuń powierzchnię',
          targetBodyId: `body-${surface.id}`,
          mode: 'move',
          x: '35', y: '0', z: '0', angle: '0', originX: '0', originY: '0', originZ: '0',
        }));
      }
      history.replace(fixture);
      setActiveSketchId(mode.endsWith('-source') && !isLoft ? sketch.id : null);
      setWorkspace(mode.endsWith('-source') && !isLoft ? 'sketch' : 'solid');
      setSelection(mode.endsWith('-source') ? (isLoft ? { kind: 'profile', id: profile.id } : { kind: 'sketch', id: sketch.id }) : { kind: 'document', id: fixture.id });
      setCommand(null);
    };
    window.__madcadVerifyDocumentState = {
      schemaVersion: document.schemaVersion,
      activeSketchId,
      sketches: document.sketches.map((sketch) => ({
        id: sketch.id,
        plane: sketch.plane,
        planeOffset: sketch.planeOffset,
        visible: sketch.visible !== false,
        support: sketch.support,
        entities: sketch.entities.length,
        entityData: sketch.entities.map((entity) => ({ id: entity.id, type: entity.type, role: entity.role, fixed: entity.fixed, layerId: entity.layerId, color: entity.color, lineType: entity.lineType, lineWeight: entity.lineWeight, projectionReferenceId: entity.projectionReferenceId, pointIds: entity.pointIds, geometry: entity.geometry })),
        profiles: sketch.profiles.length,
        profileIds: sketch.profiles.map((profile) => profile.id),
        constraints: sketch.constraints.map((constraint) => ({ id: constraint.id, type: constraint.type, entityIds: constraint.entityIds, value: constraint.value, automatic: constraint.automatic })),
        dimensions: sketch.dimensions.map((dimension) => ({ id: dimension.id, type: dimension.type, entityIds: dimension.entityIds, constraintId: dimension.constraintId, expression: dimension.expression })),
        blockInstances: (sketch.blockInstances || []).map((instance) => ({ ...instance, attributes: { ...instance.attributes } })),
      })),
      features: document.features.length,
      projectSnapshots: projectSnapshots.map((snapshot) => ({ ...snapshot })),
      linkedProjects: document.linkedProjects.map((link) => ({ ...link, proxyFeatureIds: [...link.proxyFeatureIds] })),
      namedViews: (document.namedViews || []).map((view) => ({ ...view, camera: structuredClone(view.camera) })),
      linkedProjectStatuses: structuredClone(linkedProjectStatuses),
      projectHealth: structuredClone(projectHealthReport),
      projectDependencies: structuredClone(projectDependencyInspection),
      projectSearchCount: projectSearchIndex.length,
      sketchOptions: { ...sketchOptions },
      timelineRollbackFeatureId: document.timelineRollbackFeatureId,
      featureGroups: document.featureGroups.map((group) => ({ ...group, featureIds: [...group.featureIds] })),
      activeLayerId: document.activeLayerId,
      layers: document.layers.map((layer) => ({ ...layer })),
      blocks: document.blocks.map((block) => ({ id: block.id, name: block.name, entities: block.entities.length, attributeDefinitions: block.attributeDefinitions.map((attribute) => ({ ...attribute })) })),
      components: document.components.map((component) => ({ ...component, origin: { ...component.origin }, bodyIds: [...component.bodyIds], sketchIds: [...component.sketchIds], componentIds: [...component.componentIds] })),
      componentInstances: document.componentInstances.map((instance) => ({ ...instance, transform: { ...instance.transform } })),
      rigidGroups: document.rigidGroups.map((group) => ({ ...group, instanceIds: [...group.instanceIds] })),
      joints: document.joints.map((joint) => ({ ...joint, anchor: { ...joint.anchor }, limits: { ...joint.limits }, restTransform: { ...joint.restTransform } })),
      motionLinks: document.motionLinks.map((link) => ({ ...link })),
      contactSets: document.contactSets.map((contactSet) => ({ ...contactSet })),
      assemblyConfigurations: document.assemblyConfigurations.map((configuration) => ({ ...configuration, instanceStates: configuration.instanceStates.map((state) => ({ ...state, transform: { ...state.transform } })), jointStates: configuration.jointStates.map((state) => ({ ...state })) })),
      activeAssemblyConfigurationId: document.activeAssemblyConfigurationId,
      assemblyCollisions: assemblyCollisionResult.collisions.map((collision) => ({ ...collision, overlap: [...collision.overlap] })),
      bodyIds: engine.bodies.map((body) => body.id),
      bodyKinds: engine.bodies.map((body) => body.bodyKind || 'solid'),
      drawings: document.drawings.map((sheet) => ({ ...sheet, views: sheet.views.map((view) => ({ ...view })) })),
      featureIds: document.features.map((feature) => feature.id),
      featureData: document.features.map((feature) => ({ id: feature.id, name: feature.name, type: feature.type, suppressed: feature.suppressed, visible: feature.visible !== false, sketchId: feature.sketchId, sketchIds: feature.sketchIds, profileId: feature.profileId, profileIds: feature.profileIds, pathSketchId: feature.pathSketchId, pathEntityIds: feature.pathEntityIds, loftMode: feature.loftMode, ribMode: feature.ribMode, patternType: feature.patternType, countX: feature.countX, countY: feature.countY, spacingX: feature.spacingX, spacingY: feature.spacingY, occurrences: feature.occurrences, totalAngle: feature.totalAngle, thickness: feature.thickness, tolerance: feature.tolerance, reverse: feature.reverse, operation: feature.operation, placement: feature.placement, holeType: feature.holeType, holeStandard: feature.holeStandard, holeApplication: feature.holeApplication, standardSize: feature.standardSize, clearanceClass: feature.clearanceClass, threadClass: feature.threadClass, threadDesignation: feature.threadDesignation, threadInspection: feature.threadInspection, pipePreparation: feature.pipePreparation, threadTaper: feature.threadTaper, threadProfileAngle: feature.threadProfileAngle, diameterToleranceLower: feature.diameterToleranceLower, diameterToleranceUpper: feature.diameterToleranceUpper, extent: feature.extent, distance: feature.distance, startOffset: feature.startOffset, targetReferenceId: feature.targetReferenceId, thin: feature.thin, wallThickness: feature.wallThickness, outsideDiameter: feature.outsideDiameter, wallSide: feature.wallSide, endCap: feature.endCap, openEntityIds: feature.openEntityIds, depth: feature.depth, diameter: feature.diameter, coilDiameter: feature.coilDiameter, wireDiameter: feature.wireDiameter, pitch: feature.pitch, turns: feature.turns, handedness: feature.handedness, clearanceProfile: feature.clearanceProfile, clearance: feature.clearance, secondDistance: feature.secondDistance, firstOffset: feature.firstOffset, secondOffset: feature.secondOffset, counterboreDiameter: feature.counterboreDiameter, counterboreDepth: feature.counterboreDepth, countersinkDiameter: feature.countersinkDiameter, countersinkAngle: feature.countersinkAngle, threadMode: feature.threadMode, threadDiameter: feature.threadDiameter, threadPitch: feature.threadPitch, threadLength: feature.threadLength, threadDirection: feature.threadDirection, referenceIds: feature.referenceIds, targetBodyId: feature.targetBodyId, targetBodyIds: feature.targetBodyIds, toolBodyId: feature.toolBodyId, keepTool: feature.keepTool, neutralPlaneId: feature.neutralPlaneId, planeId: feature.planeId, axisId: feature.axisId, mode: feature.mode, x: feature.x, y: feature.y, z: feature.z, angle: feature.angle, symmetry: feature.symmetry, controlOffsets: feature.controlOffsets, creaseEdges: feature.creaseEdges, insertEdgeEnabled: feature.insertEdgeEnabled, insertEdgeIndex: feature.insertEdgeIndex, insertEdgePosition: feature.insertEdgePosition, insertEdgeOffsets: feature.insertEdgeOffsets, bridgeEnabled: feature.bridgeEnabled, bridgeFirstFace: feature.bridgeFirstFace, bridgeSecondFace: feature.bridgeSecondFace, bridgeInset: feature.bridgeInset, bridgeOffsets: feature.bridgeOffsets, triangleCount: feature.triangleCount, representationMode: feature.representationMode, meshGroups: feature.meshGroups, meshGroupAngle: feature.meshGroupAngle, meshOperations: feature.meshOperations })),
      references: document.references.map((reference) => ({ id: reference.id, kind: reference.kind, planeType: reference.planeType, axisType: reference.axisType, pointType: reference.pointType, name: reference.name, basePlane: reference.basePlane, offset: reference.offset, firstOffset: reference.firstOffset, secondOffset: reference.secondOffset, rotationAxis: reference.rotationAxis, angle: reference.angle, surfaceType: reference.surfaceType, center: reference.center, point: reference.point, axis: reference.axis, points: reference.points, position: reference.position, origin: reference.origin, direction: reference.direction, distance: reference.distance, planeIds: reference.planeIds, planeId: reference.planeId, axisId: reference.axisId, visible: reference.visible, topologyId: reference.topologyId, topologyKind: reference.topologyKind, bodyId: reference.bodyId, sourceFeatureId: reference.sourceFeatureId, ownerFeatureId: reference.ownerFeatureId, repairedAt: reference.repairedAt })),
      selection: selection?.kind === 'sketchEntities'
        ? { kind: selection.kind, ids: selection.ids }
        : { kind: selection?.kind, id: selection?.id, items: selection?.items?.map((item) => ({ kind: item.kind, id: item.id })) || [] },
      command: command ? {
        type: command.type,
        previewReady: Boolean(command.previewFeature),
        previewThreadMode: command.previewFeature?.threadMode,
        previewThreadDirection: command.previewFeature?.threadDirection,
        previewClearanceProfile: command.previewFeature?.clearanceProfile,
        points: command.points?.length || 0,
        segments: command.segmentIds?.length || 0,
        gesturePoints: command.gesturePoints?.length || 0,
        dynamicLength: command.dynamicLength || '',
        selectedControlPoint: command.selectedControlPoint,
        selectedControlEdge: command.selectedControlEdge,
        selectedControlFace: command.selectedControlFace,
        selectedControlKind: command.selectedControlKind,
        controlOffsets: command.controlOffsets,
        creaseEdges: command.creaseEdges,
        insertEdgeEnabled: command.insertEdgeEnabled,
        insertEdgeIndex: command.insertEdgeIndex,
        insertEdgePosition: command.insertEdgePosition,
        insertEdgeOffsets: command.insertEdgeOffsets,
        bridgeEnabled: command.bridgeEnabled,
        bridgeFirstFace: command.bridgeFirstFace,
        bridgeSecondFace: command.bridgeSecondFace,
        bridgeInset: command.bridgeInset,
        bridgeOffsets: command.bridgeOffsets,
        measurement: command.type === 'measure' ? measurement : null,
        sectionAnalysis: command.type === 'sectionAnalysis' ? sectionAnalysis : null,
        massProperties: command.type === 'massProperties' ? massProperties : null,
        inspectionMode: command.type === 'geometryInspection' ? command.inspectionMode : null,
        geometryInspection: command.type === 'geometryInspection' ? geometryInspection : null,
        surfaceAnalysis: command.type === 'surfaceAnalysis' ? { ...surfaceAnalysis, continuity: surfaceContinuity, curvature: surfaceCurvature } : null,
      } : null,
    };
    return () => {
      delete window.__madcadVerifySketchPoint;
      delete window.__madcadVerifyCanvasSketchPoint;
      delete window.__madcadVerifyFinishCanvasSketchTool;
      delete window.__madcadVerifySketchSelection;
      delete window.__madcadVerifyTopologySelection;
      delete window.__madcadVerifyCreateLostTopologyReference;
      delete window.__madcadVerifyBreakProjectedReference;
      delete window.__madcadVerifyMoveSketch;
      delete window.__madcadVerifyDeleteSketch;
      delete window.__madcadVerifyOpenFirstSketch;
      delete window.__madcadVerifyLoadTopologyFixture;
      delete window.__madcadVerifyLoadSketchDrawingFixture;
      delete window.__madcadVerifyLoadMechanicalFixture;
      delete window.__madcadVerifyLoadParametricBracketFixture;
      delete window.__madcadVerifyLoadConstraintFixture;
      delete window.__madcadVerifyLoadDimensionFixture;
      delete window.__madcadVerifyLoadPatternFixture;
      delete window.__madcadVerifyUpdateConstraint;
      delete window.__madcadVerifyReopenAutosave;
      delete window.__madcadVerifyReopenCurrentDocument;
      delete window.__madcadVerifyLoadPointHoleFixture;
      delete window.__madcadVerifyLoadTimelineFixture;
      delete window.__madcadVerifyLoadSurfaceFixture;
      delete window.__madcadVerifyDocumentState;
    };
  // Verification hooks refresh only when the state exposed to the desktop harness changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, command, selection, activeSketchId, engine.bodies, measurement, sectionAnalysis, surfaceAnalysis, surfaceContinuity, surfaceCurvature, massProperties, geometryInspection, assemblyCollisionResult, projectSnapshots, linkedProjectStatuses, projectHealthReport, projectDependencyInspection, projectSearchIndex, sketchOptions]);

  const confirmProfile = (sourceCommand = command) => {
    if (readOnly) return readOnlyNotice();
    if (!sourceCommand.editId) return confirmMechanicalShape(sourceCommand);
    const profile = sourceCommand.type === 'rectangle'
      ? createRectangleProfile({ name: sourceCommand.name, width: sourceCommand.width, height: sourceCommand.height, x: sourceCommand.x, y: sourceCommand.y })
      : createCircleProfile({ name: sourceCommand.name, diameter: sourceCommand.diameter, x: sourceCommand.x, y: sourceCommand.y });
    if (sourceCommand.editId) profile.id = sourceCommand.editId;
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      upsertSketchProfile(sketch, profile);
    });
    setSelection({ kind: 'profile', id: profile.id, sketchId: activeSketchId });
    setCommand(null);
    setNotice(`${profile.name} dodany do szkicu.`);
  };

  const confirmMechanicalShape = (sourceCommand = command) => {
    if (readOnly) return readOnlyNotice();
    const coordinate = (x, y) => [Number(x), Number(y)];
    let shape;
    try {
      if (sourceCommand.type === 'rectangle') {
        if (sourceCommand.definition === 'twoPoints') shape = rectangleTwoPoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2));
        else if (sourceCommand.definition === 'threePoints') shape = rectangleThreePoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3));
        else shape = rectangleFromCenter(coordinate(sourceCommand.x, sourceCommand.y), sourceCommand.width, sourceCommand.height, sourceCommand.rotation);
      } else if (sourceCommand.type === 'circle') {
        if (sourceCommand.definition === 'twoPoints') shape = circleTwoPoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2));
        else if (sourceCommand.definition === 'threePoints') shape = circleThreePoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3));
        else shape = circleCenterRadius(coordinate(sourceCommand.x, sourceCommand.y), Number(sourceCommand.diameter) / 2);
      } else if (sourceCommand.type === 'arc') {
        shape = sourceCommand.definition === 'centerStartEnd'
          ? arcCenterStartEnd(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3), sourceCommand.direction)
          : arcThroughThreePoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3));
      } else if (sourceCommand.type === 'polygon') {
        shape = sourceCommand.definition === 'edge'
          ? polygonFromEdge(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), sourceCommand.sides)
          : regularPolygon({ center: coordinate(sourceCommand.x, sourceCommand.y), radius: sourceCommand.radius, sides: sourceCommand.sides, rotation: sourceCommand.rotation, circumscribed: sourceCommand.definition === 'circumscribed' });
      } else if (sourceCommand.type === 'ellipse') {
        shape = sourceCommand.definition === 'arc'
          ? ellipticalArcFromCenter(coordinate(sourceCommand.x, sourceCommand.y), sourceCommand.majorRadius, sourceCommand.minorRadius, sourceCommand.startAngle, sourceCommand.endAngle, sourceCommand.rotation, sourceCommand.direction)
          : ellipseFromCenter(coordinate(sourceCommand.x, sourceCommand.y), sourceCommand.majorRadius, sourceCommand.minorRadius, sourceCommand.rotation);
      } else if (sourceCommand.type === 'slot') {
        if (sourceCommand.definition === 'arc') shape = slotArc({ center: coordinate(sourceCommand.x, sourceCommand.y), radius: sourceCommand.radius, width: sourceCommand.width, startAngle: sourceCommand.startAngle, endAngle: sourceCommand.endAngle, direction: sourceCommand.direction });
        else if (sourceCommand.definition === 'threePoints') shape = slotThreePoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3));
        else shape = sourceCommand.definition === 'overall' ? slotOverall(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), sourceCommand.width) : slotCenterToCenter(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), sourceCommand.width);
      } else if (sourceCommand.type === 'spline') {
        const points = sourceCommand.pointsText.split(';').map((entry) => entry.split(',').map((value) => Number(value.trim())));
        if (points.some((entry) => entry.length !== 2 || entry.some((value) => !Number.isFinite(value)))) throw new Error('Punkty spline wpisz jako x,y; x,y; …');
        shape = sourceCommand.definition === 'control' ? controlPointSpline(points) : fitPointSpline(points);
      } else if (sourceCommand.type === 'conic') {
        shape = conicThroughControlPoint(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3), sourceCommand.rho, sourceCommand.continuity);
      }
      if (!shape || shape.entities.some((entity) => entity.type === 'point' && (!Number.isFinite(Number(entity.geometry.x)) || !Number.isFinite(Number(entity.geometry.y))))) throw new Error('Współrzędne figury muszą być liczbami.');
    } catch (error) {
      setNotice(`Nie można utworzyć figury: ${error.message}`);
      return;
    }
    const curveIds = shape.curves.map((entity) => entity.id);
    const curveIdSet = new Set(curveIds);
    const shapeName = sourceCommand.name?.trim() || 'Figura szkicu';
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

  const confirmSketchPoint = (sourceCommand = command) => {
    const x = Number(sourceCommand.x);
    const y = Number(sourceCommand.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setNotice('Punkt wymaga prawidłowych współrzędnych X i Y.');
      return;
    }
    const point = createSketchPoint({ x: String(x), y: String(y), role: sourceCommand.role });
    commit((next) => next.sketches.find((item) => item.id === activeSketchId).entities.push(point));
    setSelection({ kind: 'sketchEntities', ids: [point.id], sketchId: activeSketchId });
    setCommand(null);
    setNotice(sourceCommand.role === 'construction' ? 'Dodano punkt konstrukcyjny.' : 'Dodano punkt referencyjny gotowy do utworzenia otworu.');
  };

  const directSketchTypes = ['rectangle', 'circle', 'arc', 'polygon', 'ellipse', 'slot', 'spline', 'conic', 'point'];
  const requiredGesturePoints = (sourceCommand) => {
    if (!sourceCommand) return 0;
    if (sourceCommand.type === 'point') return 1;
    if (sourceCommand.type === 'rectangle') return sourceCommand.definition === 'threePoints' ? 3 : 2;
    if (sourceCommand.type === 'circle') return sourceCommand.definition === 'threePoints' ? 3 : 2;
    if (['arc', 'conic', 'ellipse'].includes(sourceCommand.type)) return 3;
    if (sourceCommand.type === 'polygon') return 2;
    if (sourceCommand.type === 'slot') return sourceCommand.definition === 'arc' ? 4 : 3;
    return Number.POSITIVE_INFINITY;
  };
  const pointText = ([x, y]) => `${Number(x).toFixed(3)},${Number(y).toFixed(3)}`;
  const distanceBetween = (first, second) => Math.hypot(second[0] - first[0], second[1] - first[1]);
  const distanceFromAxis = (point, first, second) => {
    const length = distanceBetween(first, second);
    if (length <= 1e-9) return 0;
    return Math.abs(((second[0] - first[0]) * (first[1] - point[1])) - ((first[0] - point[0]) * (second[1] - first[1]))) / length;
  };
  const gesturePatch = (sourceCommand, points) => {
    const patch = { gesturePoints: points };
    const [first, second, third, fourth] = points;
    if (sourceCommand.type === 'rectangle') {
      if (sourceCommand.definition === 'center') {
        if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
        if (second) Object.assign(patch, { width: String(Math.abs(second[0] - first[0]) * 2), height: String(Math.abs(second[1] - first[1]) * 2) });
      } else {
        if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
        if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
        if (third) Object.assign(patch, { x3: String(third[0]), y3: String(third[1]) });
      }
    } else if (sourceCommand.type === 'circle') {
      if (sourceCommand.definition === 'centerRadius') {
        if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
        if (second) patch.diameter = String(distanceBetween(first, second) * 2);
      } else {
        if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
        if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
        if (third) Object.assign(patch, { x3: String(third[0]), y3: String(third[1]) });
      }
    } else if (['arc', 'conic'].includes(sourceCommand.type)) {
      if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
      if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
      if (third) Object.assign(patch, { x3: String(third[0]), y3: String(third[1]) });
    } else if (sourceCommand.type === 'polygon') {
      if (sourceCommand.definition === 'edge') {
        if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
        if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
      } else {
        if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
        if (second) Object.assign(patch, {
          radius: String(distanceBetween(first, second)),
          rotation: String(Math.atan2(second[1] - first[1], second[0] - first[0]) * 180 / Math.PI),
        });
      }
    } else if (sourceCommand.type === 'ellipse') {
      if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
      if (second) Object.assign(patch, {
        majorRadius: String(distanceBetween(first, second)),
        rotation: String(Math.atan2(second[1] - first[1], second[0] - first[0]) * 180 / Math.PI),
      });
      if (third) patch.minorRadius = String(distanceFromAxis(third, first, second));
    } else if (sourceCommand.type === 'slot') {
      if (sourceCommand.definition === 'arc') {
        if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
        if (second) Object.assign(patch, { radius: String(distanceBetween(first, second)), startAngle: String(Math.atan2(second[1] - first[1], second[0] - first[0]) * 180 / Math.PI) });
        if (third) patch.endAngle = String(Math.atan2(third[1] - first[1], third[0] - first[0]) * 180 / Math.PI);
        if (fourth) patch.width = String(Math.abs(distanceBetween(first, fourth) - distanceBetween(first, second)) * 2);
      } else {
        if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
        if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
        if (third) Object.assign(patch, { x3: String(third[0]), y3: String(third[1]), width: String(distanceFromAxis(third, first, second) * 2) });
      }
    } else if (sourceCommand.type === 'spline') {
      patch.pointsText = points.map(pointText).join('; ');
    } else if (sourceCommand.type === 'point' && first) {
      Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
    }
    return patch;
  };

  const handleSketchCanvasPoint = (coordinates) => {
    if (command?.type === 'line' || command?.type === 'polyline') return appendSketchPoint(coordinates);
    if (!directSketchTypes.includes(command?.type)) return;
    const point = coordinates.map((value) => Number(value));
    if (point.some((value) => !Number.isFinite(value))) return;
    const points = [...(command.gesturePoints || []), point];
    const patch = gesturePatch(command, points);
    const nextCommand = { ...command, ...patch };
    const required = requiredGesturePoints(nextCommand);
    if (points.length < required) {
      setCommand(nextCommand);
      setNotice(nextCommand.type === 'spline'
        ? `Dodano punkt ${points.length}. Klikaj dalej; Enter zakończy spline, a Escape anuluje polecenie.`
        : `Wskazano ${points.length} z ${required} punktów. Kliknij następny punkt na płótnie.`);
      return;
    }
    if (nextCommand.type === 'point') confirmSketchPoint(nextCommand);
    else if (nextCommand.type === 'rectangle' || nextCommand.type === 'circle') confirmProfile(nextCommand);
    else confirmMechanicalShape(nextCommand);
  };

  const finishCanvasSketchTool = () => {
    if (command?.type === 'line' || command?.type === 'polyline') return finishSketchPath();
    if (!directSketchTypes.includes(command?.type)) return;
    const points = command.gesturePoints || [];
    if (command.type === 'spline') {
      if (points.length < 3) {
        setNotice('Spline wymaga co najmniej trzech punktów. Kliknij kolejne punkty albo naciśnij Escape.');
        return;
      }
      confirmMechanicalShape(command);
      return;
    }
    if (points.length) {
      setNotice(`Figura wymaga ${requiredGesturePoints(command)} punktów. Dokończ wskazywanie albo naciśnij Escape.`);
      return;
    }
    if (command.type === 'point') confirmSketchPoint(command);
    else if (command.type === 'rectangle' || command.type === 'circle') confirmProfile(command);
    else confirmMechanicalShape(command);
  };

  const openExtrude = () => {
    if (readOnly) return readOnlyNotice();
    if (!activeSketchId && pressPullFace?.descriptor?.geometry === 'PLANE') {
      openOffsetFace();
      setNotice('Wyciąganie ściany jest aktywne. Przeciągnij uchwyt albo wpisz odległość; wartość ujemna wciska ścianę do środka.');
      return;
    }
    if (canExtrudeOpenChain) {
      const operation = engine.bodies.length ? 'join' : 'new';
      const targetOptions = createExtrudeTargetOptions();
      const previewFeature = createFeature('extrude', {
        name: `Wyciągnięcie ${document.features.length + 1}`,
        sketchId: activeSketchId,
        profileIds: [],
        openEntityIds: [...selectedSketchEntityIds],
        distance: '10',
        secondDistance: '10',
        startOffset: '0',
        extent: 'one-side',
        thin: true,
        wallThickness: '2',
        wallSide: 'symmetric',
        endCap: 'butt',
        operation,
        targetBodyId: operation === 'new' ? null : targetBodyId,
      });
      setCommand({ type: 'extrude', openChain: true, sourceSketchId: activeSketchId, distance: '10', secondDistance: '10', startOffset: '0', extent: 'one-side', thin: true, wallThickness: '2', wallSide: 'symmetric', endCap: 'butt', operation, targetOptions, targetReferenceId: targetOptions[0]?.id, previewFeature });
      setActiveSketchId(null);
      setWorkspace('solid');
      setNotice('Podgląd cienkościennego wyciągnięcia otwartego łańcucha jest aktywny.');
      return;
    }
    if (activeSketchId) {
      setNotice('Zakończ szkic. Ostatni zamknięty profil zostanie zaznaczony automatycznie do wyciągnięcia.');
      return;
    }
    const source = resolveExtrudeSource({ sketches: document.sketches, selection });
    if (source.kind === 'profile') {
      setSelection({ kind: 'profile', id: source.profile.id, sketchId: source.sketch.id });
      beginOrUpdateExtrude(10, source);
      setNotice('Podgląd wyciągnięcia jest aktywny. Potwierdź operację przyciskiem OK.');
      return;
    }
    if (source.kind === 'open-chain') {
      beginOpenChainExtrude(source.sketch.id, source.entityIds);
      return;
    }
    if (source.kind === 'incomplete') {
      setSelection({ kind: 'sketch', id: source.sketch.id });
      setFitViewRequest({ requestId: `show-incomplete-sketch:${source.sketch.id}:${Date.now()}` });
      setNotice(`Szkic „${source.sketch.name}” nie tworzy jednego zamkniętego profilu. Domknij obrys albo wybierz połączone linie do cienkiego wyciągnięcia.`);
      return;
    }
    startSketch();
    window.setTimeout(() => setNotice('Wyciągnięcie: wybierz płaszczyznę, narysuj zamknięty profil i zakończ szkic. Profil zostanie zaznaczony automatycznie.'), 0);
  };

  const openSheetBase = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) {
      setNotice('Zakończ szkic, a następnie zaznacz jego zamknięty profil.');
      return;
    }
    if (!selectedProfile || !selectedProfileMatch) {
      setNotice('Baza blachowa wymaga jednego zaznaczonego, zamkniętego profilu.');
      return;
    }
    const next = { type: 'sheetBase', thickness: '1.5', bendRadius: '2', kFactor: '0.42', side: 'symmetric', reverse: false, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Podgląd bazy blachowej jest aktywny. Ustaw regułę blachy i potwierdź operację.');
  };

  const openSheetFlange = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    if (!canCreateSheetFlange) return setNotice('Kołnierz wymaga dokładnie jednej prostej krawędzi istniejącej blachy.');
    const selectionItem = selectedEdgeItems[0];
    const reference = { ...createTopologyReference({ selection: selectionItem, descriptor: selectedSheetEdgeDescriptor, label: 'Kołnierz blachy — krawędź' }), scope: 'feature-input' };
    const next = {
      type: 'sheetFlange',
      targetBodyId: selectionItem.bodyId,
      edgeLabel: `${Number(selectedSheetEdgeDescriptor.length || 0).toFixed(2)} mm`,
      length: '20',
      angle: '90',
      bendRadius: String(selectedSheetEdgeBody.sheetMetal.bendRadius || 2),
      reverse: false,
      topologyReferences: [reference],
      previewFeature: null,
    };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Podgląd kołnierza jest aktywny. Ustaw długość, kąt i kierunek, a następnie potwierdź operację.');
  };

  const openSheetHem = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    if (!canCreateSheetFlange) return setNotice('Zawinięcie wymaga dokładnie jednej prostej krawędzi istniejącej blachy.');
    const selectionItem = selectedEdgeItems[0];
    const reference = { ...createTopologyReference({ selection: selectionItem, descriptor: selectedSheetEdgeDescriptor, label: 'Zawinięcie blachy — krawędź' }), scope: 'feature-input' };
    const next = { type: 'sheetHem', targetBodyId: selectionItem.bodyId, edgeLabel: `${Number(selectedSheetEdgeDescriptor.length || 0).toFixed(2)} mm`, length: '8', gap: '0.5', reverse: false, topologyReferences: [reference], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Podgląd zawinięcia 180° jest aktywny. Szczelina określa prześwit między równoległymi warstwami.');
  };

  const openSheetRip = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    if (!canCreateSheetFlange) return setNotice('Szczelina wymaga dokładnie jednej prostej krawędzi istniejącej blachy.');
    const selectionItem = selectedEdgeItems[0];
    const reference = { ...createTopologyReference({ selection: selectionItem, descriptor: selectedSheetEdgeDescriptor, label: 'Szczelina blachy — krawędź' }), scope: 'feature-input' };
    const next = { type: 'sheetRip', targetBodyId: selectionItem.bodyId, edgeLabel: `${Number(selectedSheetEdgeDescriptor.length || 0).toFixed(2)} mm`, gap: '1', topologyReferences: [reference], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Podgląd szczeliny jest aktywny. Operacja usuwa kontrolowany pas materiału wzdłuż wybranej krawędzi.');
  };

  const openPlasticBoss = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    if (selectedFaceItems.length !== 1) return setNotice('Boss wymaga zaznaczenia dokładnie jednej planarnej ściany bryły.');
    const selectedFace = selectedFaceItems[0];
    const body = engine.bodies.find((candidate) => candidate.id === selectedFace.bodyId);
    const face = body?.topology?.faces?.find((candidate) => candidate.id === selectedFace.id);
    if (!body || body.bodyKind === 'surface' || body.representation !== 'brep' || face?.descriptor?.geometry !== 'PLANE') return setNotice('Boss można osadzić wyłącznie na planarnej ścianie bryły B-Rep.');
    const reference = { ...createTopologyReference({ selection: selectedFace, descriptor: face.descriptor, label: 'Boss — powierzchnia bazowa' }), scope: 'feature-input' };
    const next = { type: 'plasticBoss', targetBodyId: body.id, faceLabel: body.name, outerDiameter: '10', holeDiameter: '4', height: '8', holeDepth: '4', offsetX: '0', offsetY: '0', reverse: false, topologyReferences: [reference], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Podgląd Boss jest aktywny. Ustaw średnice, wysokość, głębokość otworu i pozycję na ścianie.');
  };

  const openPlasticSnapFit = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    if (selectedFaceItems.length !== 1) return setNotice('Snap-fit wymaga zaznaczenia dokładnie jednej planarnej ściany bryły.');
    const selectedFace = selectedFaceItems[0];
    const body = engine.bodies.find((candidate) => candidate.id === selectedFace.bodyId);
    const face = body?.topology?.faces?.find((candidate) => candidate.id === selectedFace.id);
    if (!body || body.bodyKind === 'surface' || body.representation !== 'brep' || face?.descriptor?.geometry !== 'PLANE') return setNotice('Snap-fit można osadzić wyłącznie na planarnej ścianie bryły B-Rep.');
    const reference = { ...createTopologyReference({ selection: selectedFace, descriptor: face.descriptor, label: 'Snap-fit — powierzchnia bazowa' }), scope: 'feature-input' };
    const next = { type: 'plasticSnapFit', targetBodyId: body.id, faceLabel: body.name, length: '24', width: '8', thickness: '2', clearance: '1.5', hookLength: '5', hookHeight: '3', offsetX: '0', offsetY: '0', reverse: false, topologyReferences: [reference], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Podgląd Snap-fit jest aktywny. Ustaw ramię, zaczep i pozycję na ścianie.');
  };

  const openPlasticGrille = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    if (selectedFaceItems.length !== 1) return setNotice('Grille wymaga zaznaczenia dokładnie jednej planarnej ściany bryły.');
    const selectedFace = selectedFaceItems[0];
    const body = engine.bodies.find((candidate) => candidate.id === selectedFace.bodyId);
    const face = body?.topology?.faces?.find((candidate) => candidate.id === selectedFace.id);
    if (!body || body.bodyKind === 'surface' || body.representation !== 'brep' || face?.descriptor?.geometry !== 'PLANE') return setNotice('Grille można wykonać wyłącznie na planarnej ścianie bryły B-Rep.');
    const reference = { ...createTopologyReference({ selection: selectedFace, descriptor: face.descriptor, label: 'Grille — powierzchnia bazowa' }), scope: 'feature-input' };
    const next = { type: 'plasticGrille', targetBodyId: body.id, faceLabel: body.name, ribCount: '5', ribWidth: '2', gap: '2', length: '20', depth: '4', offsetX: '0', offsetY: '0', reverse: false, topologyReferences: [reference], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Podgląd Grille jest aktywny. Ustaw liczbę żeber, szczeliny, głębokość i pozycję na ścianie.');
  };

  const addSheetStateFeature = (type) => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    if (!activeSheetBody) return setNotice('Zaznacz bryłę blachową albo pozostaw w projekcie tylko jedną blachę.');
    if (type === 'sheetUnfold' && !canUnfoldSheet) return setNotice(activeSheetBody.sheetMetal.unfolded ? 'Blacha jest już rozwinięta.' : 'Rozwinięcie wymaga co najmniej jednego gięcia albo zawinięcia.');
    if (type === 'sheetRefold' && !canRefoldSheet) return setNotice('Ponowne zagięcie wymaga wcześniej rozwiniętej blachy.');
    const feature = createFeature(type, {
      name: `${type === 'sheetUnfold' ? 'Rozwinięcie blachy' : 'Ponowne zagięcie blachy'} ${document.features.length + 1}`,
      targetBodyId: activeSheetBody.id,
    });
    commit((next) => insertTimelineFeature(next, feature));
    setSelection({ kind: 'feature', id: feature.id });
    setWorkspace('solid');
    setCommand(null);
    setFitViewRequest({ requestId: `${type}:${feature.id}:${Date.now()}` });
    setNotice(type === 'sheetUnfold'
      ? 'Blacha została rozwinięta według promieni gięcia i współczynnika K. Linie kolejnych odcinków zachowują naddatki gięcia.'
      : 'Przywrócono dokładną geometrię zagiętej blachy bez utraty wcześniejszych operacji.');
  };

  const openSurfacePatch = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) return setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Patch wymaga zaznaczonego zamkniętego profilu.');
    const next = { type: 'surfacePatch', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Patch wypełnia zamknięty profil dokładną planarną powierzchnią B-Rep.');
  };

  const openSurfaceExtrude = () => {
    if (readOnly) return readOnlyNotice();
    if (canExtrudeOpenChain) {
      const next = { type: 'surfaceExtrude', openChain: true, sourceSketchId: activeSketchId, openEntityIds: [...selectedSketchEntityIds], distance: '10', previewFeature: null };
      setCommand(next);
      setActiveSketchId(null);
      setWorkspace('solid');
      window.setTimeout(() => updateCommand(next), 0);
      setNotice('Wyciągnięcie powierzchni tworzy otwartą powłokę z zaznaczonego łańcucha.');
      return;
    }
    if (!selectedProfile || activeSketchId) return setNotice(activeSketchId ? 'Zaznacz ciągły otwarty łańcuch albo zakończ szkic.' : 'Zaznacz zamknięty profil powierzchni.');
    const next = { type: 'surfaceExtrude', openChain: false, distance: '10', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Wyciągnięcie powierzchni tworzy otwartą powłokę bez zamykania jej w bryłę.');
  };

  const openSurfaceRevolve = () => {
    if (readOnly) return readOnlyNotice();
    const sourceSketch = canExtrudeOpenChain
      ? document.sketches.find((sketch) => sketch.id === activeSketchId)
      : selectedProfileMatch?.sketch;
    if (!sourceSketch || (!canExtrudeOpenChain && (!selectedProfile || activeSketchId))) {
      setNotice(activeSketchId ? 'Zaznacz ciągły otwarty łańcuch linii.' : 'Zaznacz zamknięty profil albo otwarty łańcuch do obrotu powierzchni.');
      return;
    }
    const axisOptions = [
      { id: 'X_AXIS', name: 'Oś bazowa X' },
      { id: 'Y_AXIS', name: 'Oś bazowa Y' },
      { id: 'Z_AXIS', name: 'Oś bazowa Z' },
      ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name })),
    ];
    const defaultAxisId = sourceSketch.plane === 'XZ' ? 'X_AXIS' : 'Y_AXIS';
    const next = {
      type: 'surfaceRevolve',
      openChain: Boolean(canExtrudeOpenChain),
      sourceSketchId: sourceSketch.id,
      openEntityIds: canExtrudeOpenChain ? [...selectedSketchEntityIds] : [],
      axisId: defaultAxisId,
      axisOptions,
      angle: '360',
      previewFeature: null,
    };
    setCommand(next);
    if (canExtrudeOpenChain) {
      setActiveSketchId(null);
      setWorkspace('solid');
    }
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Obrót powierzchni tworzy powłokę wokół osi bez automatycznego zamykania jej w bryłę.');
  };

  const openThickenSurface = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedSurfaceBody) return setNotice('Zaznacz jedną powierzchnię Patch, Surface Extrude, Surface Revolve, Surface Sweep albo Surface Loft.');
    const next = { type: 'thickenSurface', targetBodyId: selectedSurfaceBody.id, targetName: selectedSurfaceBody.name, thickness: '2', side: 'one-side', reverse: false, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Pogrub zamieni powierzchnię w edytowalną bryłę B-Rep.');
  };

  const openSurfaceOffset = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedSurfaceBody) return setNotice('Zaznacz jedną powierzchnię do odsunięcia.');
    const next = { type: 'surfaceOffset', targetBodyId: selectedSurfaceBody.id, targetName: selectedSurfaceBody.name, distance: '2', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Surface Offset odsuwa całą powierzchnię o dokładną odległość. Wartość ujemna zmienia kierunek.');
  };

  const openSurfaceStitch = () => {
    if (readOnly) return readOnlyNotice();
    if (!canStitchSelectedSurfaces) return setNotice('Zaznacz co najmniej dwie powierzchnie do zszycia.');
    const next = { type: 'surfaceStitch', targetBodyIds: [...selectedBodyIds], tolerance: '0.01', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Stitch łączy wspólne krawędzie powierzchni. Zamknięty płaszcz automatycznie staje się bryłą.');
  };

  const openSurfaceTrim = () => {
    if (readOnly) return readOnlyNotice();
    if (!canTrimSelectedSurface) return setNotice('Zaznacz jedną powierzchnię i jedną bryłę tnącą.');
    const target = selectedSurfaceBodies[0];
    const tool = selectedSolidBodies[0];
    const next = {
      type: 'surfaceTrim',
      targetBodyId: target.id,
      targetName: target.name,
      toolBodyId: tool.id,
      toolName: tool.name,
      keepTool: true,
      previewFeature: null,
    };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Surface Trim usuwa z powierzchni obszar przecinający bryłę tnącą.');
  };

  const openSurfaceExtend = () => {
    if (readOnly) return readOnlyNotice();
    if (!canExtendSelectedSurface) return setNotice('Zaznacz jedną prostą krawędź planarnej powierzchni.');
    const selectedEdge = selectedEdgeItems[0];
    const reference = { ...createTopologyReference({ selection: selectedEdge, descriptor: selectedSurfaceEdgeDescriptor, label: 'Surface Extend — krawędź' }), scope: 'feature-input' };
    const next = { type: 'surfaceExtend', targetBodyId: selectedSurfaceEdgeBody.id, targetName: selectedSurfaceEdgeBody.name, edgeLabel: selectedSurfaceEdgeDescriptor.length ? `${selectedSurfaceEdgeDescriptor.length.toFixed(2)} mm` : selectedEdge.id, distance: '10', topologyReferences: [reference], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Surface Extend przedłuża wskazaną krawędź planarnej powierzchni o dokładną odległość.');
  };

  const beginOpenChainExtrude = (sketchId, entityIds) => {
    const operation = engine.bodies.length ? 'join' : 'new';
    const targetOptions = createExtrudeTargetOptions();
    const previewFeature = createFeature('extrude', {
      name: `Wyciągnięcie ${document.features.length + 1}`,
      sketchId,
      profileIds: [],
      openEntityIds: [...entityIds],
      distance: '10',
      secondDistance: '10',
      startOffset: '0',
      extent: 'one-side',
      thin: true,
      wallThickness: '2',
      wallSide: 'symmetric',
      endCap: 'butt',
      operation,
      targetBodyId: operation === 'new' ? null : targetBodyId,
    });
    setCommand({ type: 'extrude', openChain: true, sourceSketchId: sketchId, distance: '10', secondDistance: '10', startOffset: '0', extent: 'one-side', thin: true, wallThickness: '2', wallSide: 'symmetric', endCap: 'butt', operation, targetOptions, targetReferenceId: targetOptions[0]?.id, previewFeature });
    setActiveSketchId(null);
    setWorkspace('solid');
    setSelection({ kind: 'sketch', id: sketchId });
    setNotice('Podgląd cienkościennego wyciągnięcia otwartego szkicu jest aktywny. Ustaw grubość i potwierdź operację.');
  };

  const openRib = () => {
    if (readOnly) return readOnlyNotice();
    if (!canCreateRib) return setNotice(engine.bodies.length ? 'Wybierz ciągły otwarty łańcuch linii szkicu.' : 'Rib/Web wymaga istniejącej bryły docelowej.');
    const next = {
      type: 'rib',
      openChain: true,
      sourceSketchId: activeSketchId,
      openEntityIds: [...selectedSketchEntityIds],
      ribMode: 'web',
      thickness: '2',
      depth: '5',
      wallSide: 'symmetric',
      reverse: false,
      previewFeature: null,
    };
    setCommand(next);
    setActiveSketchId(null);
    setWorkspace('solid');
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Rib/Web tworzy cienkie wzmocnienie połączone z istniejącą bryłą.');
  };

  const openPipe = () => {
    if (readOnly) return readOnlyNotice();
    if (!canExtrudeOpenChain) return setNotice('Pipe wymaga zaznaczonego ciągłego otwartego łańcucha linii szkicu.');
    const next = { type: 'pipe', pathSketchId: activeSketchId, pathEntityIds: [...selectedSketchEntityIds], outsideDiameter: '4', wallThickness: '0.5', operation: 'new', previewFeature: null };
    setCommand(next);
    setActiveSketchId(null);
    setWorkspace('solid');
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Pipe prowadzi pusty przekrój rurowy po wskazanej ścieżce.');
  };

  const openRevolve = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) {
      setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz jeden zamknięty profil dla Revolve.');
      return;
    }
    const axisOptions = [
      { id: 'X_AXIS', name: 'Oś bazowa X' },
      { id: 'Y_AXIS', name: 'Oś bazowa Y' },
      { id: 'Z_AXIS', name: 'Oś bazowa Z' },
      ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name })),
    ];
    const defaultAxisId = selectedProfileMatch.sketch.plane === 'XZ' ? 'X_AXIS' : 'Y_AXIS';
    const operation = engine.bodies.length ? 'join' : 'new';
    const next = { type: 'revolve', axisId: defaultAxisId, axisOptions, angle: '360', operation, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Revolve obraca wybrany profil wokół osi leżącej w płaszczyźnie szkicu.');
  };

  const sweepPathOptions = (profileSketchId = selectedProfileMatch?.sketch.id) => document.sketches
    .filter((sketch) => sketch.id !== profileSketchId)
    .map((sketch) => ({ id: sketch.id, name: sketch.name, entityIds: sketch.entities.filter((entity) => entity.type === 'line' && entity.role !== 'construction').map((entity) => entity.id) }))
    .filter((path) => path.entityIds.length);

  const openSurfaceSweep = () => {
    if (readOnly) return readOnlyNotice();
    const sourceSketchId = canExtrudeOpenChain ? activeSketchId : selectedProfileMatch?.sketch.id;
    if (!sourceSketchId || (!canExtrudeOpenChain && (!selectedProfile || activeSketchId))) return setNotice(activeSketchId ? 'Zaznacz ciągły otwarty profil linii.' : 'Wybierz profil Surface Sweep.');
    const pathOptions = sweepPathOptions(sourceSketchId);
    if (!pathOptions.length) return setNotice('Surface Sweep wymaga osobnego szkicu z ciągłą otwartą ścieżką linii.');
    const path = pathOptions[0];
    const next = {
      type: 'surfaceSweep',
      openChain: Boolean(canExtrudeOpenChain),
      sourceSketchId,
      openEntityIds: canExtrudeOpenChain ? [...selectedSketchEntityIds] : [],
      pathOptions,
      pathSketchId: path.id,
      pathEntityIds: path.entityIds,
      previewFeature: null,
    };
    setCommand(next);
    if (canExtrudeOpenChain) {
      setActiveSketchId(null);
      setWorkspace('solid');
    }
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Surface Sweep prowadzi profil jako otwartą powierzchnię po osobnym szkicu ścieżki.');
  };

  const openSweep = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) return setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz zamknięty profil Sweep.');
    const pathOptions = sweepPathOptions();
    if (!pathOptions.length) return setNotice('Sweep wymaga osobnego szkicu z ciągłą otwartą ścieżką linii.');
    const operation = engine.bodies.length ? 'join' : 'new';
    const next = { type: 'sweep', pathOptions, pathSketchId: pathOptions[0].id, pathEntityIds: pathOptions[0].entityIds, operation, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Sweep prowadzi profil po wskazanej ciągłej ścieżce szkicu.');
  };

  const loftProfileOptions = (sourceSketchId = selectedProfileMatch?.sketch.id) => document.sketches
    .filter((sketch) => sketch.id !== sourceSketchId)
    .flatMap((sketch) => sketch.profiles.map((profile) => ({ id: profile.id, sketchId: sketch.id, name: `${sketch.name} · ${profile.name}` })));

  const openSurfaceLoft = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) return setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz zamknięty profil początkowy Surface Loft.');
    const profileOptions = loftProfileOptions();
    if (!profileOptions.length) return setNotice('Surface Loft wymaga drugiego zamkniętego profilu w osobnym szkicu.');
    const target = profileOptions[0];
    const next = { type: 'surfaceLoft', profileOptions, endProfileId: target.id, endSketchId: target.sketchId, loftMode: 'smooth', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Surface Loft łączy dwa profile otwartą powierzchnią na równoległych płaszczyznach.');
  };

  const openLoft = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) return setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz zamknięty profil początkowy Loft.');
    const profileOptions = loftProfileOptions();
    if (!profileOptions.length) return setNotice('Loft wymaga drugiego zamkniętego profilu w osobnym szkicu.');
    const target = profileOptions[0];
    const operation = engine.bodies.length ? 'join' : 'new';
    const next = { type: 'loft', profileOptions, endProfileId: target.id, endSketchId: target.sketchId, loftMode: 'smooth', operation, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Loft łączy profile z osobnych, równoległych płaszczyzn szkicu.');
  };

  const openCoil = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    const axisOptions = [
      { id: 'X_AXIS', name: 'Oś bazowa X' },
      { id: 'Y_AXIS', name: 'Oś bazowa Y' },
      { id: 'Z_AXIS', name: 'Oś bazowa Z' },
      ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name })),
    ];
    const operation = engine.bodies.length ? 'join' : 'new';
    const next = { type: 'coil', axisId: 'Z_AXIS', axisOptions, coilDiameter: '10', wireDiameter: '2', pitch: '4', turns: '3', handedness: 'right', operation, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Coil tworzy parametryczną spiralę bryłową wokół wskazanej osi.');
  };

  const openPattern = () => {
    if (readOnly) return readOnlyNotice();
    if (!targetBodyId || activeSketchId) return setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Pattern wymaga wskazanej bryły.');
    const axisOptions = [{ id: 'X_AXIS', name: 'Oś bazowa X' }, { id: 'Y_AXIS', name: 'Oś bazowa Y' }, { id: 'Z_AXIS', name: 'Oś bazowa Z' }, ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name }))];
    const pathOptions = document.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, entityIds: sketch.entities.filter((entity) => entity.type === 'line' && entity.role !== 'construction').map((entity) => entity.id) })).filter((path) => path.entityIds.length);
    const next = { type: 'pattern', targetBodyId, patternType: 'rectangular', countX: '3', countY: '1', spacingX: '20', spacingY: '20', axisId: 'Z_AXIS', axisOptions, occurrences: '4', totalAngle: '360', pathOptions, pathSketchId: pathOptions[0]?.id, pathEntityIds: pathOptions[0]?.entityIds || [], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Pattern powiela wskazaną bryłę prostokątnie, kołowo albo po ścieżce.');
  };

  const createExtrudeTargetOptions = (editingFeatureId = null) => {
    const options = constructionPlanes.filter((plane) => plane.status === 'ok').map((plane) => ({ id: plane.id, name: plane.name, kind: 'construction-plane' }));
    const existingFeature = document.features.find((feature) => feature.id === editingFeatureId);
    const existingReference = document.references.find((reference) => reference.id === existingFeature?.targetReferenceId && reference.kind === 'topology');
    if (existingReference) options.push({ id: existingReference.id, name: existingReference.label || 'Planarna ściana', kind: 'topology', reference: existingReference });
    if (editingFeatureId) return options;
    engine.bodies.forEach((body) => {
      body.topology?.faces?.filter((face) => face.descriptor?.geometry === 'PLANE').forEach((face, index) => {
        const normal = face.descriptor.normal || [0, 0, 1];
        const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
        const axisName = ['X', 'Y', 'Z'][axis];
        const coordinate = Number(face.descriptor.center?.[axis] || 0).toFixed(3);
        const reference = createTopologyReference({
          selection: { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId },
          descriptor: face.descriptor,
          label: `Ściana planarna ${index + 1} · ${axisName}=${coordinate} · ${body.name}`,
        });
        options.push({ id: reference.id, name: reference.label, kind: 'topology', reference });
      });
    });
    return options;
  };

  const beginOrUpdateExtrude = (distance, profileMatch = selectedProfileMatch) => {
    if (readOnly) return readOnlyNotice();
    const profile = profileMatch?.profile;
    if (!profile || activeSketchId) return;
    setCommand((current) => {
      const editing = current?.type === 'extrude' ? current : null;
      const operation = editing?.operation || (engine.bodies.length ? 'join' : 'new');
      const targetOptions = editing?.targetOptions || createExtrudeTargetOptions(editing?.editId);
      const next = {
        ...(editing || {}),
        type: 'extrude',
        distance: String(distance),
        secondDistance: editing?.secondDistance || '10',
        startOffset: editing?.startOffset || '0',
        thin: Boolean(editing?.thin),
        wallThickness: editing?.wallThickness || '2',
        wallSide: editing?.wallSide || 'inside',
        endCap: editing?.endCap || 'butt',
        extent: editing?.extent || 'one-side',
        operation,
        targetOptions,
        targetReferenceId: editing?.targetReferenceId || targetOptions[0]?.id,
      };
      next.previewFeature = createFeature('extrude', {
        name: editing?.previewFeature?.name || `Wyciągnięcie ${document.features.length + 1}`,
        sketchId: profileMatch.sketch.id,
        profileIds: [profile.id],
        distance: next.distance,
        secondDistance: next.secondDistance,
        startOffset: next.startOffset,
        extent: next.extent,
        targetReferenceId: next.extent === 'to-object' ? next.targetReferenceId : undefined,
        thin: Boolean(next.thin),
        wallThickness: next.wallThickness,
        wallSide: next.wallSide,
        endCap: next.endCap,
        operation,
        targetBodyId: operation === 'new' ? null : targetBodyId,
      });
      if (editing?.previewFeature?.id) next.previewFeature.id = editing.previewFeature.id;
      if (editing?.editId) next.editId = editing.editId;
      const targetOption = targetOptions.find((option) => option.id === next.targetReferenceId);
      next.topologyReferences = next.extent === 'to-object' && targetOption?.reference ? [targetOption.reference] : [];
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
        const next = { type: 'hole', placement: 'face-edges', targetBodyId: bodyId, firstOffset: '10', secondOffset: '10', holeType: 'simple', extent: 'distance', diameter: '5', depth: '10', counterboreDiameter: '9', counterboreDepth: '3', countersinkDiameter: '10', countersinkAngle: '90', threadMode: 'none', threadDiameter: '6', threadPitch: '1', threadLength: '8', threadDirection: 'right', holeStandard: 'custom', holeApplication: 'custom', standardSize: 'M6', clearanceClass: 'medium', threadClass: '6H', threadDesignation: '', threadInspection: '', pipePreparation: 'conical', threadTaper: '0', threadProfileAngle: '60', diameterToleranceLower: '', diameterToleranceUpper: '', clearanceProfile: 'nominal', clearance: '0.2', topologyReferences, previewFeature: null };
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
    const next = { type: 'hole', holeType: 'simple', extent: 'distance', diameter: selectedCircleDiameter, depth: '10', counterboreDiameter: '10', counterboreDepth: '3', countersinkDiameter: '10', countersinkAngle: '90', threadMode: 'none', threadDiameter: '10', threadPitch: '1.5', threadLength: '8', threadDirection: 'right', holeStandard: 'custom', holeApplication: 'custom', standardSize: 'M6', clearanceClass: 'medium', threadClass: '6H', threadDesignation: '', threadInspection: '', pipePreparation: 'conical', threadTaper: '0', threadProfileAngle: '60', diameterToleranceLower: '', diameterToleranceUpper: '', clearanceProfile: 'nominal', clearance: '0.2', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
  };

  const openMeasure = () => {
    setCommand({ type: 'measure' });
    setNotice(`Measure jest aktywny. Zaznacz element; ${multipleSelectionLabel(DESKTOP_PLATFORM)} dodaje drugi do pomiaru odległości i kąta.`);
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

  const openSurfaceAnalysis = () => {
    setSurfaceAnalysis({ enabled: true, mode: 'zebra', bands: '12', curvatureMax: '0.2', combScale: '10', isocurveAxis: 'z', isocurveSpacing: '10', showEdges: true });
    setCommand({ type: 'surfaceAnalysis' });
    setNotice('Analiza powierzchni jest aktywna. Obracaj model, aby sprawdzić płynność pasów zebra na granicach ścian.');
  };

  const closeSurfaceAnalysis = () => {
    setSurfaceAnalysis(null);
    setCommand(null);
    setNotice('Analiza powierzchni wyłączona; model nie został zmieniony.');
  };

  const openMeshTools = () => {
    if (!selectedMeshFeature) {
      setNotice('Zaznacz jedną zaimportowaną siatkę STL albo 3MF. Dokładne modele STEP nie wymagają naprawy siatki źródłowej.');
      return;
    }
    setImportRepairReport(null);
    setMeshToolsOpen(true);
    setNotice('Diagnostyka siatki jest gotowa. Naprawa nie wypełnia otworów ani nie zgaduje brakującej geometrii.');
  };

  const safelyRepairSelectedMesh = () => {
    if (!selectedMeshFeature || readOnly) return;
    try {
      const result = repairMesh(parseStlMesh(base64ToBytes(selectedMeshFeature.dataBase64)));
      const buffer = meshToBinaryStl(result.mesh);
      commit((next) => {
        const feature = next.features.find((item) => item.id === selectedMeshFeature.id);
        feature.dataBase64 = arrayBufferToBase64(buffer);
        feature.triangleCount = result.after.triangleCount;
        feature.meshRepair = {
          repairedAt: new Date().toISOString(),
          removedTriangles: result.before.triangleCount - result.after.triangleCount,
          weldedVertices: result.before.duplicateVertices,
        };
        feature.meshOperations = [...(feature.meshOperations || []), { type: 'repair', timestamp: new Date().toISOString(), beforeTriangles: result.before.triangleCount, afterTriangles: result.after.triangleCount }];
        feature.meshGroups = [];
      });
      setNotice(`Naprawiono siatkę: scalono ${result.before.duplicateVertices} duplikatów wierzchołków i usunięto ${result.before.triangleCount - result.after.triangleCount} niebezpiecznych trójkątów. Cofnij przywraca oryginał.`);
    } catch (error) {
      setNotice(`Nie udało się naprawić siatki: ${error.message}`);
    }
  };

  const orientSelectedMeshFaces = () => {
    if (!selectedMeshFeature || readOnly) return;
    try {
      const result = orientMeshFaces(parseStlMesh(base64ToBytes(selectedMeshFeature.dataBase64)));
      if (!result.flippedTriangles) {
        setNotice('Kierunek ścian jest już spójny; nie zmieniono siatki.');
        return;
      }
      const buffer = meshToBinaryStl(result.mesh);
      commit((next) => {
        const feature = next.features.find((item) => item.id === selectedMeshFeature.id);
        feature.dataBase64 = arrayBufferToBase64(buffer);
        feature.triangleCount = result.after.triangleCount;
        feature.meshOperations = [...(feature.meshOperations || []), { type: 'orient', timestamp: new Date().toISOString(), flippedTriangles: result.flippedTriangles, componentCount: result.componentCount, outwardComponents: result.outwardComponents }];
        feature.meshGroups = [];
      });
      setNotice(`Uporządkowano kierunek ${result.flippedTriangles.toLocaleString('pl-PL')} trójkątów w ${result.componentCount.toLocaleString('pl-PL')} komponentach. Cofnij przywraca poprzednią orientację.`);
    } catch (error) {
      setNotice(`Nie udało się uporządkować kierunku ścian: ${error.message}`);
    }
  };

  const fillSelectedMeshHoles = (maximumDiameter) => {
    if (!selectedMeshFeature || readOnly) return;
    try {
      const result = fillMeshHoles(parseStlMesh(base64ToBytes(selectedMeshFeature.dataBase64)), { maximumDiameter, maximumEdges: 64 });
      if (!result.filledHoles) {
        setNotice(result.holeCount
          ? `Nie wypełniono otworów: wszystkie przekraczają limit ${result.maximumDiameter.toLocaleString('pl-PL')} mm albo nie tworzą prostej pętli.`
          : 'Siatka nie ma otwartych pętli wymagających wypełnienia.');
        return;
      }
      const buffer = meshToBinaryStl(result.mesh);
      commit((next) => {
        const feature = next.features.find((item) => item.id === selectedMeshFeature.id);
        feature.dataBase64 = arrayBufferToBase64(buffer);
        feature.triangleCount = result.after.triangleCount;
        feature.meshOperations = [...(feature.meshOperations || []), { type: 'fillHoles', timestamp: new Date().toISOString(), maximumDiameter: result.maximumDiameter, maximumEdges: result.maximumEdges, filledHoles: result.filledHoles, skippedHoles: result.skippedHoles, insertedTriangles: result.insertedTriangles, orientedTriangles: result.orientedTriangles }];
        feature.meshGroups = [];
      });
      setNotice(`Wypełniono ${result.filledHoles} ${result.filledHoles === 1 ? 'mały otwór' : 'małe otwory'} (${result.insertedTriangles} nowych trójkątów); pominięto ${result.skippedHoles}. Cofnij przywraca otwartą siatkę.`);
    } catch (error) {
      setNotice(`Nie udało się wypełnić otworów: ${error.message}`);
    }
  };

  const reduceSelectedMesh = (ratio) => {
    if (!selectedMeshFeature || readOnly) return;
    try {
      const result = reduceMesh(parseStlMesh(base64ToBytes(selectedMeshFeature.dataBase64)), ratio);
      if (result.after.triangleCount >= result.before.triangleCount) {
        setNotice('Ta siatka jest już zbyt mała lub regularna, aby bezpiecznie uzyskać wybraną redukcję.');
        return;
      }
      const buffer = meshToBinaryStl(result.mesh);
      commit((next) => {
        const feature = next.features.find((item) => item.id === selectedMeshFeature.id);
        feature.dataBase64 = arrayBufferToBase64(buffer);
        feature.triangleCount = result.after.triangleCount;
        feature.meshOperations = [...(feature.meshOperations || []), { type: 'reduce', timestamp: new Date().toISOString(), ratio: result.ratio, beforeTriangles: result.before.triangleCount, afterTriangles: result.after.triangleCount }];
        feature.meshGroups = [];
      });
      setNotice(`Zredukowano siatkę z ${result.before.triangleCount.toLocaleString('pl-PL')} do ${result.after.triangleCount.toLocaleString('pl-PL')} trójkątów. Cofnij przywraca geometrię sprzed redukcji.`);
    } catch (error) {
      setNotice(`Nie udało się zredukować siatki: ${error.message}`);
    }
  };

  const smoothSelectedMesh = (options) => {
    if (!selectedMeshFeature || readOnly) return;
    try {
      const result = smoothMesh(parseStlMesh(base64ToBytes(selectedMeshFeature.dataBase64)), options);
      const buffer = meshToBinaryStl(result.mesh);
      commit((next) => {
        const feature = next.features.find((item) => item.id === selectedMeshFeature.id);
        feature.dataBase64 = arrayBufferToBase64(buffer);
        feature.triangleCount = result.after.triangleCount;
        feature.meshOperations = [...(feature.meshOperations || []), { type: 'smooth', timestamp: new Date().toISOString(), iterations: result.iterations, strength: result.strength, preservedBoundaryVertices: result.preservedBoundaryVertices }];
        feature.meshGroups = [];
      });
      setNotice(`Wygładzono siatkę w ${result.iterations} krokach; ochroniono ${result.preservedBoundaryVertices} wierzchołków otwartych brzegów. Cofnij przywraca poprzedni kształt.`);
    } catch (error) {
      setNotice(`Nie udało się wygładzić siatki: ${error.message}`);
    }
  };

  const remeshSelectedMesh = (targetEdgeLength) => {
    if (!selectedMeshFeature || readOnly) return;
    try {
      const result = remeshUniform(parseStlMesh(base64ToBytes(selectedMeshFeature.dataBase64)), targetEdgeLength);
      if (!result.collapsedEdges && !result.insertedVertices) {
        setNotice(`Siatka już mieści się w zakresie docelowej krawędzi ${result.targetEdgeLength.toLocaleString('pl-PL')} mm.`);
        return;
      }
      const buffer = meshToBinaryStl(result.mesh);
      commit((next) => {
        const feature = next.features.find((item) => item.id === selectedMeshFeature.id);
        feature.dataBase64 = arrayBufferToBase64(buffer);
        feature.triangleCount = result.after.triangleCount;
        feature.meshOperations = [...(feature.meshOperations || []), { type: 'remesh', timestamp: new Date().toISOString(), targetEdgeLength: result.targetEdgeLength, beforeTriangles: result.before.triangleCount, afterTriangles: result.after.triangleCount, collapsedEdges: result.collapsedEdges, insertedVertices: result.insertedVertices }];
        feature.meshGroups = [];
      });
      setNotice(`Przebudowano siatkę do krawędzi około ${result.targetEdgeLength.toLocaleString('pl-PL')} mm: ${result.before.triangleCount.toLocaleString('pl-PL')} → ${result.after.triangleCount.toLocaleString('pl-PL')} trójkątów. Cofnij przywraca poprzednią siatkę.`);
    } catch (error) {
      setNotice(`Nie udało się wykonać remesh: ${error.message}`);
    }
  };

  const groupSelectedMeshFaces = (featureAngle) => {
    if (!selectedMeshFeature || readOnly) return;
    try {
      const result = groupMeshFaces(parseStlMesh(base64ToBytes(selectedMeshFeature.dataBase64)), featureAngle);
      const buffer = meshToBinaryStl(result.mesh);
      const groups = result.groups.map((group) => ({ id: group.id, triangleCount: group.triangleCount, triangleIndices: [...group.triangleIndices], area: group.area }));
      commit((next) => {
        const feature = next.features.find((item) => item.id === selectedMeshFeature.id);
        feature.dataBase64 = arrayBufferToBase64(buffer);
        feature.triangleCount = result.mesh.triangles.length / 3;
        feature.meshGroups = groups;
        feature.meshGroupAngle = result.featureAngle;
        feature.meshOperations = [...(feature.meshOperations || []), { type: 'group', timestamp: new Date().toISOString(), featureAngle: result.featureAngle, groupCount: groups.length }];
      });
      setNotice(`Wyznaczono ${groups.length} ${groups.length === 1 ? 'grupę' : 'grup'} ścian przy kącie ${result.featureAngle}°. Grupy zapisano w projekcie.`);
    } catch (error) {
      setNotice(`Nie udało się pogrupować ścian siatki: ${error.message}`);
    }
  };

  const convertSelectedMeshToBrep = () => {
    if (!selectedMeshFeature || readOnly) return;
    if (meshBrepBlocker) {
      setNotice(`Nie można utworzyć B-Rep: ${meshBrepBlocker}`);
      return;
    }
    commit((next) => {
      const feature = next.features.find((item) => item.id === selectedMeshFeature.id);
      feature.representationMode = 'brep-faceted';
      feature.meshOperations = [...(feature.meshOperations || []), { type: 'convertToBrep', timestamp: new Date().toISOString(), triangleCount: selectedMeshReport.triangleCount }];
    });
    setMeshToolsOpen(false);
    setNotice(`Tworzenie fasetowej bryły B-Rep z ${selectedMeshReport.triangleCount.toLocaleString('pl-PL')} trójkątów. Cofnij przywraca edytowalną siatkę.`);
  };

  const restoreSelectedBrepToMesh = () => {
    if (!selectedFacetedBrepFeature || readOnly) return;
    commit((next) => {
      const feature = next.features.find((item) => item.id === selectedFacetedBrepFeature.id);
      feature.representationMode = 'mesh';
      feature.meshOperations = [...(feature.meshOperations || []), { type: 'convertToMesh', timestamp: new Date().toISOString(), triangleCount: feature.triangleCount }];
    });
    setNotice('Przywracanie siatki źródłowej STL. Cofnij ponownie włącza fasetową bryłę B-Rep.');
  };

  const openMassProperties = () => {
    setCommand({ type: 'massProperties', density: '1.24' });
    setNotice('Właściwości masowe liczą zaznaczone bryły albo cały model, gdy nic nie jest wskazane.');
  };

  const openGeometryInspection = async () => {
    setNotice('Analiza geometrii: szybki filtr granic i dokładne sprawdzanie możliwych kolizji…');
    try {
      const analysis = await engine.analyzeCollisions();
      setCommand({ type: 'geometryInspection', inspectionMode: 'draft', draftDirection: 'z-positive', draftTolerance: '0.5', thicknessTarget: '2', thicknessTolerance: '0.25' });
      setNotice(analysis.skippedPairs
        ? `Analiza częściowa · sprawdzono ${analysis.exactPairs}/${analysis.candidatePairs} par; pominięto ${analysis.skippedPairs} par mieszanych lub otwartych siatek.`
        : `Analiza zakończona · ${analysis.exactPairs}/${analysis.candidatePairs} par wymagało dokładnego przecięcia.`);
    } catch (error) {
      setNotice(`Nie udało się przeprowadzić analizy kolizji: ${error.message}`);
    }
  };

  const openBoolean = () => {
    if (readOnly) return readOnlyNotice();
    if (selectedBodyIds.length !== 2) {
      setNotice('Wybierz dokładnie dwie bryły, używając Ctrl lub Shift. Ostatnia wskazana będzie narzędziem.');
      return;
    }
    if (!canBooleanSelectedBodies) {
      setNotice('Boolean wymaga dwóch zgodnych brył B-Rep albo dwóch zamkniętych siatek. Otwarta lub mieszana geometria nie może zostać połączona bryłowo.');
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

  const openFormBody = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    const sequence = document.features.filter((feature) => feature.type === 'formBody').length + 1;
    const next = { type: 'formBody', name: `Form ${sequence}`, width: '40', depth: '30', height: '20', subdivisions: '2', symmetry: 'none', controlOffsets: Array.from({ length: 8 }, () => ['0', '0', '0']), selectedControlKind: 'point', selectedControlPoint: 0, selectedControlEdge: 0, selectedControlFace: 0, creaseEdges: [], insertEdgeEnabled: false, insertEdgeIndex: 0, insertEdgePosition: '0.5', insertEdgeOffsets: [], bridgeEnabled: false, bridgeFirstFace: 0, bridgeSecondFace: 1, bridgeInset: '0.45', bridgeOffsets: [], x: '0', y: '0', z: '0', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Form tworzy wygładzoną powierzchnię z kontrolnej klatki i kończy ją jako edytowalną bryłę B-Rep.');
  };

  const openTextSolid = () => {
    if (readOnly) return readOnlyNotice();
    const selectedFace = selectedFaceItems.length === 1 ? selectedFaceItems[0] : null;
    const selectedBody = selectedFace ? engine.bodies.find((body) => body.id === selectedFace.bodyId) : null;
    const faceRecord = selectedBody?.topology?.faces?.find((face) => face.id === selectedFace?.id);
    const planarFace = faceRecord?.descriptor?.geometry === 'PLANE' ? faceRecord : null;
    const selectedTargetId = planarFace ? selectedFace.bodyId : selection?.kind === 'body' ? selection.id : null;
    const selectedTarget = engine.bodies.find((body) => body.id === selectedTargetId);
    const surfaceZ = selectedTarget?.metrics?.bounds?.[1]?.[2] ?? 0;
    const topologyReferences = planarFace ? [createTopologyReference({ selection: { kind: 'face', id: planarFace.id, bodyId: selectedBody.id, sourceFeatureId: selectedBody.sourceFeatureId }, descriptor: planarFace.descriptor, label: `Powierzchnia Emboss/Deboss · ${selectedBody.name}` })] : [];
    const next = { type: 'textSolid', text: 'MADCAD', fontSize: '10', depth: '2', x: '0', y: '0', z: String(surfaceZ), operation: selectedTargetId ? 'emboss' : 'new', targetBodyId: selectedTargetId, placement: planarFace ? 'face' : 'world', topologyReferences, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice(planarFace ? 'Tekst jest trwale związany ze wskazaną planarną ścianą.' : selectedTargetId ? 'Tekst zostanie dodany do zaznaczonej bryły. Wybierz Emboss lub Deboss.' : 'Tekst zostanie wyciągnięty jako nowa bryła.');
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

  const openPressPull = () => {
    if (readOnly) return readOnlyNotice();
    if (selectedProfile && !activeSketchId) {
      openExtrude();
      setNotice('Press Pull profilu używa parametrycznego Extrude. Ustaw odległość i operację bryłową.');
      return;
    }
    if (pressPullFace?.descriptor?.geometry === 'PLANE') {
      openOffsetFace();
      setNotice('Press Pull planarnej ściany używa parametrycznego Offset Face. Znak odległości steruje kierunkiem.');
      return;
    }
    setNotice('Press Pull wymaga zamkniętego profilu albo dokładnie jednej planarnej ściany.');
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

  const draftNeutralPlaneOptions = () => [
    ...Object.entries(PLANE_LABELS).map(([id, name]) => ({ id, name })),
    ...constructionPlanes.filter((plane) => plane.status === 'ok').map((plane) => ({ id: plane.id, name: plane.name })),
  ];

  const openDraft = () => {
    if (readOnly) return readOnlyNotice();
    const selectedFaces = selectedFaceItems.filter((item) => item.bodyId === selectedFaceItems[0]?.bodyId);
    const body = engine.bodies.find((candidate) => candidate.id === selectedFaces[0]?.bodyId);
    const faceRecords = selectedFaces.map((item) => body?.topology?.faces?.find((face) => face.id === item.id));
    if (!selectedFaces.length || selectedFaces.length !== selectedFaceItems.length || faceRecords.some((face) => face?.descriptor?.geometry !== 'PLANE')) {
      setNotice('Draft wymaga planarnych ścian należących do jednej bryły.');
      return;
    }
    const topologyReferences = selectedFaces.map((item, index) => ({
      ...createTopologyReference({ selection: item, descriptor: faceRecords[index].descriptor, label: `Draft — ściana ${index + 1}` }),
      scope: 'feature-input',
    }));
    const neutralPlaneOptions = draftNeutralPlaneOptions();
    const next = { type: 'draft', targetBodyId: body.id, angle: '3', neutralPlaneId: 'XY', neutralPlaneOptions, faceCount: selectedFaces.length, topologyReferences, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Ustaw kąt pochylenia i płaszczyznę neutralną Draft. Znak kąta odwraca kierunek.');
  };

  const openSplitBody = () => {
    if (readOnly) return readOnlyNotice();
    if (selection?.kind !== 'body' || !engine.bodies.some((body) => body.id === selection.id)) {
      setNotice('Wybierz dokładnie jedną bryłę do podziału.');
      return;
    }
    const planeOptions = draftNeutralPlaneOptions();
    const next = { type: 'splitBody', targetBodyId: selection.id, targetName: engine.bodies.find((body) => body.id === selection.id)?.name || selection.id, planeId: 'XY', planeOptions, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Wybierz płaszczyznę przecinającą bryłę. Split Body zachowa obie wynikowe bryły.');
  };

  const openSplitFace = () => {
    if (readOnly) return readOnlyNotice();
    if (!canSplitFace) {
      setNotice('Split Face wymaga zamkniętego profilu szkicu założonego bezpośrednio na planarnej ścianie.');
      return;
    }
    const next = {
      type: 'splitFace',
      targetBodyId: splitFaceSupport.bodyId,
      sketchId: selectedProfileMatch.sketch.id,
      profileId: selectedProfile.id,
      profileName: selectedProfile.name,
      referenceId: splitFaceSupport.id,
      faceName: splitFaceSupport.label,
      previewFeature: null,
    };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Split Face utworzy trwały region B-Rep bez zmiany objętości bryły.');
  };

  const openDeleteFace = () => {
    if (readOnly) return readOnlyNotice();
    const selectedFaces = selectedFaceItems.filter((item) => item.bodyId === selectedFaceItems[0]?.bodyId);
    const body = engine.bodies.find((candidate) => candidate.id === selectedFaces[0]?.bodyId);
    if (!body || !selectedFaces.length || selectedFaces.length !== selectedFaceItems.length) {
      setNotice('Delete Face + Heal wymaga co najmniej jednej ściany należącej do tej samej bryły.');
      return;
    }
    const topologyReferences = selectedFaces.map((item, index) => {
      const descriptor = body.topology.faces.find((face) => face.id === item.id)?.descriptor;
      return { ...createTopologyReference({ selection: item, descriptor, label: `Delete Face + Heal — region ${index + 1}` }), scope: 'feature-input' };
    });
    const next = { type: 'deleteFace', targetBodyId: body.id, faceCount: selectedFaces.length, topologyReferences, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Delete Face + Heal scali wskazane regiony ze zgodnymi sąsiednimi ścianami bez zmiany objętości.');
  };

  const openReplaceFace = () => {
    if (readOnly) return readOnlyNotice();
    if (selectedFaceItems.length !== 2 || selectedFaceItems[0].bodyId === selectedFaceItems[1].bodyId) {
      setNotice('Replace Face wymaga dwóch planarnych ścian z różnych brył: najpierw zastępowanej, potem docelowej.');
      return;
    }
    const [sourceSelection, destinationSelection] = selectedFaceItems;
    const sourceBody = engine.bodies.find((body) => body.id === sourceSelection.bodyId);
    const destinationBody = engine.bodies.find((body) => body.id === destinationSelection.bodyId);
    const sourceFace = sourceBody?.topology.faces.find((face) => face.id === sourceSelection.id);
    const destinationFace = destinationBody?.topology.faces.find((face) => face.id === destinationSelection.id);
    if (sourceFace?.descriptor?.geometry !== 'PLANE' || destinationFace?.descriptor?.geometry !== 'PLANE') {
      setNotice('Replace Face obsługuje obecnie dwie planarne powierzchnie.');
      return;
    }
    const topologyReferences = [
      { ...createTopologyReference({ selection: sourceSelection, descriptor: sourceFace.descriptor, label: 'Replace Face — ściana zastępowana' }), scope: 'feature-input' },
      { ...createTopologyReference({ selection: destinationSelection, descriptor: destinationFace.descriptor, label: 'Replace Face — powierzchnia docelowa' }), scope: 'feature-input' },
    ];
    const next = { type: 'replaceFace', targetBodyId: sourceBody.id, sourceName: sourceBody.name, destinationName: destinationBody.name, topologyReferences, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Replace Face dopasuje pierwszą planarną ścianę do płaszczyzny drugiej, bez modyfikowania bryły referencyjnej.');
  };

  const openConstructionPlane = (planeType = 'offset', plane = null) => {
    if (readOnly) return readOnlyNotice();
    const existing = plane;
    const mode = existing?.planeType || planeType;
    const commandTypes = { offset: 'offsetPlane', midplane: 'midplanePlane', 'three-points': 'threePointPlane', angle: 'anglePlane', tangent: 'tangentPlane', path: 'pathPlane' };
    const commandType = commandTypes[mode] || 'offsetPlane';
    const defaultNames = { offset: 'Płaszczyzna odsunięta', midplane: 'Płaszczyzna środkowa', 'three-points': 'Płaszczyzna przez trzy punkty', angle: 'Płaszczyzna pod kątem', tangent: 'Płaszczyzna styczna', path: 'Płaszczyzna na ścieżce' };
    const points = existing?.points || [['0', '0', '0'], ['10', '0', '0'], ['0', '10', '0']];
    setCommand({
      type: commandType,
      planeType: mode,
      editId: existing?.id || null,
      name: existing?.name || `${defaultNames[mode]} ${document.references.filter((reference) => reference.kind === 'construction-plane').length + 1}`,
      basePlane: existing?.basePlane || (selection?.kind === 'plane' && PLANE_LABELS[selection.id] ? selection.id : 'XY'),
      offset: existing?.offset || (mode === 'angle' ? '0' : '10'),
      firstOffset: existing?.firstOffset || '0',
      secondOffset: existing?.secondOffset || '10',
      rotationAxis: existing?.rotationAxis || 'u', angle: existing?.angle || '45',
      surfaceType: existing?.surfaceType || 'sphere',
      center0: existing?.center?.[0] || '0', center1: existing?.center?.[1] || '0', center2: existing?.center?.[2] || '0',
      point0: existing?.point?.[0] || '10', point1: existing?.point?.[1] || '0', point2: existing?.point?.[2] || '0',
      axis0: existing?.axis?.[0] || '0', axis1: existing?.axis?.[1] || '0', axis2: existing?.axis?.[2] || '1',
      direction0: existing?.direction?.[0] || '1', direction1: existing?.direction?.[1] || '0', direction2: existing?.direction?.[2] || '0',
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
          : command.planeType === 'angle'
            ? createAnglePlane({ name: command.name, basePlane: command.basePlane, rotationAxis: command.rotationAxis, angle: command.angle, offset: command.offset, visible: command.visible })
            : command.planeType === 'tangent'
              ? createTangentPlane({ name: command.name, surfaceType: command.surfaceType, center: [command.center0, command.center1, command.center2], point: [command.point0, command.point1, command.point2], axis: [command.axis0, command.axis1, command.axis2], visible: command.visible })
              : command.planeType === 'path'
                ? createPathPlane({ name: command.name, point: [command.point0, command.point1, command.point2], direction: [command.direction0, command.direction1, command.direction2], visible: command.visible })
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
    const defaultNames = { edge: 'Oś z krawędzi', cylinder: 'Oś walca', 'two-points': 'Oś przez dwa punkty', 'plane-intersection': 'Oś przecięcia płaszczyzn', 'plane-normal': 'Oś normalna do płaszczyzny' };
    setCommand({
      type: 'constructionAxis', axisType, editId: axis?.id || null,
      name: axis?.name || `${defaultNames[axisType]} ${document.references.filter((reference) => reference.kind === 'construction-axis').length + 1}`,
      x1: String(points[0][0]), y1: String(points[0][1]), z1: String(points[0][2]),
      x2: String(points[1][0]), y2: String(points[1][1]), z2: String(points[1][2]),
      origin0: String(origin[0]), origin1: String(origin[1]), origin2: String(origin[2]),
      direction0: String(direction[0]), direction1: String(direction[1]), direction2: String(direction[2]),
      planeOptions, planeId1: axis?.planeId || planeIds[0] || '', planeId2: planeIds[1] || planeIds[0] || '',
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
            : command.axisType === 'plane-normal'
              ? createPlaneNormalAxis({ ...common, planeId: command.planeId1, origin: [command.origin0, command.origin1, command.origin2] })
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
    const points = point?.points || [[0, 0, 0], [10, 0, 0]];
    const topologyCompatible = pointType === 'vertex' ? selectedItem?.kind === 'vertex' : pointType === 'center' && ['face', 'edge'].includes(selectedItem?.kind);
    const axisOptions = document.references.filter((reference) => reference.kind === 'construction-axis');
    const planeOptions = document.references.filter((reference) => reference.kind === 'construction-plane');
    const defaultNames = { vertex: 'Punkt na wierzchołku', center: 'Punkt środka', intersection: 'Punkt przecięcia', midpoint: 'Punkt środkowy', 'on-axis': 'Punkt na osi' };
    setCommand({
      type: 'constructionPoint', pointType, editId: point?.id || null,
      name: point?.name || `${defaultNames[pointType]} ${document.references.filter((reference) => reference.kind === 'construction-point').length + 1}`,
      position0: String(position[0]), position1: String(position[1]), position2: String(position[2]),
      x1: String(points[0][0]), y1: String(points[0][1]), z1: String(points[0][2]),
      x2: String(points[1][0]), y2: String(points[1][1]), z2: String(points[1][2]), distance: String(point?.distance ?? 0),
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
          : command.pointType === 'midpoint'
            ? createMidpointPoint({ ...common, points: [[command.x1, command.y1, command.z1], [command.x2, command.y2, command.z2]] })
            : command.pointType === 'on-axis'
              ? createPointOnAxis({ ...common, axisId: command.axisId, distance: command.distance })
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
    if (!command?.previewFeature) {
      setNotice('Podgląd operacji jest jeszcze obliczany. Poczekaj chwilę i spróbuj ponownie.');
      return;
    }
    commit((next) => {
      for (const reference of command.topologyReferences || []) {
        if (next.references.some((item) => item.id === reference.id)) continue;
        next.references.push({ ...reference, ownerFeatureId: command.previewFeature.id });
      }
      if (command.editId) {
        const index = next.features.findIndex((feature) => feature.id === command.editId);
        next.features[index] = command.previewFeature;
      } else {
        insertTimelineFeature(next, command.previewFeature);
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
    if (feature.type === 'sheetUnfold' || feature.type === 'sheetRefold') {
      setNotice('Ta operacja nie ma osobnych parametrów. Zmień regułę blachy, kołnierz albo zawinięcie wcześniej na osi czasu.');
      return;
    }
    const profile = document.sketches.flatMap((sketch) => sketch.profiles).find((item) => feature.profileIds?.includes(item.id) || feature.profileId === item.id);
    if (profile) setSelection({ kind: 'profile', id: profile.id });
    if (feature.type === 'surfacePatch') setCommand({ type: 'surfacePatch', editId: feature.id, previewFeature: feature });
    else if (feature.type === 'sheetBase') setCommand({ type: 'sheetBase', editId: feature.id, thickness: feature.thickness, bendRadius: feature.bendRadius, kFactor: feature.kFactor, side: feature.side || 'one-side', reverse: Boolean(feature.reverse), previewFeature: feature });
    else if (feature.type === 'sheetFlange') {
      const topologyReferences = (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean);
      setCommand({ type: 'sheetFlange', editId: feature.id, targetBodyId: feature.targetBodyId, edgeLabel: topologyReferences[0]?.descriptor?.length ? `${Number(topologyReferences[0].descriptor.length).toFixed(2)} mm` : '1 prosta krawędź', length: feature.length, angle: feature.angle, bendRadius: feature.bendRadius, reverse: Boolean(feature.reverse), topologyReferences, previewFeature: feature });
    }
    else if (feature.type === 'sheetHem') {
      const topologyReferences = (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean);
      setCommand({ type: 'sheetHem', editId: feature.id, targetBodyId: feature.targetBodyId, edgeLabel: topologyReferences[0]?.descriptor?.length ? `${Number(topologyReferences[0].descriptor.length).toFixed(2)} mm` : '1 prosta krawędź', length: feature.length, gap: feature.gap, reverse: Boolean(feature.reverse), topologyReferences, previewFeature: feature });
    }
    else if (feature.type === 'sheetRip') {
      const topologyReferences = (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean);
      setCommand({ type: 'sheetRip', editId: feature.id, targetBodyId: feature.targetBodyId, edgeLabel: topologyReferences[0]?.descriptor?.length ? `${Number(topologyReferences[0].descriptor.length).toFixed(2)} mm` : '1 prosta krawędź', gap: feature.gap, topologyReferences, previewFeature: feature });
    }
    else if (feature.type === 'plasticBoss') {
      const topologyReferences = (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean);
      setCommand({ type: 'plasticBoss', editId: feature.id, targetBodyId: feature.targetBodyId, faceLabel: topologyReferences[0]?.label || 'Planarna ściana', outerDiameter: feature.outerDiameter, holeDiameter: feature.holeDiameter, height: feature.height, holeDepth: feature.holeDepth, offsetX: feature.offsetX, offsetY: feature.offsetY, reverse: Boolean(feature.reverse), topologyReferences, previewFeature: feature });
    }
    else if (feature.type === 'plasticSnapFit') {
      const topologyReferences = (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean);
      setCommand({ type: 'plasticSnapFit', editId: feature.id, targetBodyId: feature.targetBodyId, faceLabel: topologyReferences[0]?.label || 'Planarna ściana', length: feature.length, width: feature.width, thickness: feature.thickness, clearance: feature.clearance, hookLength: feature.hookLength, hookHeight: feature.hookHeight, offsetX: feature.offsetX, offsetY: feature.offsetY, reverse: Boolean(feature.reverse), topologyReferences, previewFeature: feature });
    }
    else if (feature.type === 'plasticGrille') {
      const topologyReferences = (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean);
      setCommand({ type: 'plasticGrille', editId: feature.id, targetBodyId: feature.targetBodyId, faceLabel: topologyReferences[0]?.label || 'Planarna ściana', ribCount: feature.ribCount, ribWidth: feature.ribWidth, gap: feature.gap, length: feature.length, depth: feature.depth, offsetX: feature.offsetX, offsetY: feature.offsetY, reverse: Boolean(feature.reverse), topologyReferences, previewFeature: feature });
    }
    else if (feature.type === 'surfaceExtrude') setCommand({ type: 'surfaceExtrude', openChain: Boolean(feature.openEntityIds?.length), editId: feature.id, sourceSketchId: feature.sketchId, openEntityIds: feature.openEntityIds || [], distance: feature.distance, previewFeature: feature });
    else if (feature.type === 'surfaceRevolve') setCommand({ type: 'surfaceRevolve', openChain: Boolean(feature.openEntityIds?.length), editId: feature.id, sourceSketchId: feature.sketchId, openEntityIds: feature.openEntityIds || [], axisId: feature.axisId, axisOptions: [{ id: 'X_AXIS', name: 'Oś bazowa X' }, { id: 'Y_AXIS', name: 'Oś bazowa Y' }, { id: 'Z_AXIS', name: 'Oś bazowa Z' }, ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name }))], angle: feature.angle, previewFeature: feature });
    else if (feature.type === 'surfaceSweep') setCommand({ type: 'surfaceSweep', openChain: Boolean(feature.openEntityIds?.length), editId: feature.id, sourceSketchId: feature.sketchId, openEntityIds: feature.openEntityIds || [], pathOptions: sweepPathOptions(feature.sketchId), pathSketchId: feature.pathSketchId, pathEntityIds: feature.pathEntityIds, previewFeature: feature });
    else if (feature.type === 'surfaceLoft') setCommand({ type: 'surfaceLoft', editId: feature.id, profileOptions: loftProfileOptions(feature.sketchIds[0]), endProfileId: feature.profileIds[1], endSketchId: feature.sketchIds[1], loftMode: feature.loftMode || 'smooth', previewFeature: feature });
    else if (feature.type === 'surfaceOffset') {
      const surfaceBody = engine.bodies.find((body) => body.id === feature.targetBodyId);
      setCommand({ type: 'surfaceOffset', editId: feature.id, targetBodyId: feature.targetBodyId, targetName: surfaceBody?.name || feature.targetBodyId, distance: feature.distance, previewFeature: feature });
    }
    else if (feature.type === 'surfaceStitch') setCommand({ type: 'surfaceStitch', editId: feature.id, targetBodyIds: feature.targetBodyIds, tolerance: feature.tolerance, previewFeature: feature });
    else if (feature.type === 'surfaceTrim') {
      const surfaceBody = engine.bodies.find((body) => body.id === feature.targetBodyId);
      const toolBody = engine.bodies.find((body) => body.id === feature.toolBodyId);
      setCommand({ type: 'surfaceTrim', editId: feature.id, targetBodyId: feature.targetBodyId, targetName: surfaceBody?.name || feature.targetBodyId, toolBodyId: feature.toolBodyId, toolName: toolBody?.name || feature.toolBodyId, keepTool: feature.keepTool !== false, previewFeature: feature });
    }
    else if (feature.type === 'surfaceExtend') {
      const surfaceBody = engine.bodies.find((body) => body.id === feature.targetBodyId);
      const topologyReferences = (feature.referenceIds || []).map((referenceId) => document.references.find((reference) => reference.id === referenceId)).filter(Boolean);
      setCommand({ type: 'surfaceExtend', editId: feature.id, targetBodyId: feature.targetBodyId, targetName: surfaceBody?.name || feature.targetBodyId, edgeLabel: topologyReferences[0]?.label || '1 wybrana', distance: feature.distance, topologyReferences, previewFeature: feature });
    }
    else if (feature.type === 'thickenSurface') {
      const surfaceBody = engine.bodies.find((body) => body.id === feature.targetBodyId);
      setCommand({ type: 'thickenSurface', editId: feature.id, targetBodyId: feature.targetBodyId, targetName: surfaceBody?.name || feature.targetBodyId, thickness: feature.thickness, side: feature.side || 'one-side', reverse: Boolean(feature.reverse), previewFeature: feature });
    }
    else if (feature.type === 'extrude') {
      const targetOptions = createExtrudeTargetOptions(feature.id);
      setCommand({ type: 'extrude', openChain: Boolean(feature.openEntityIds?.length), editId: feature.id, distance: feature.distance, secondDistance: feature.secondDistance || feature.distance, startOffset: feature.startOffset || '0', thin: Boolean(feature.thin), wallThickness: feature.wallThickness || '2', wallSide: feature.wallSide || 'inside', endCap: feature.endCap || 'butt', extent: feature.extent || 'one-side', operation: feature.operation, targetOptions, targetReferenceId: feature.targetReferenceId || targetOptions[0]?.id, previewFeature: feature });
    }
    else if (feature.type === 'revolve') setCommand({ type: 'revolve', editId: feature.id, axisId: feature.axisId, axisOptions: [{ id: 'X_AXIS', name: 'Oś bazowa X' }, { id: 'Y_AXIS', name: 'Oś bazowa Y' }, { id: 'Z_AXIS', name: 'Oś bazowa Z' }, ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name }))], angle: feature.angle, operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'sweep') setCommand({ type: 'sweep', editId: feature.id, pathOptions: sweepPathOptions(feature.sketchId), pathSketchId: feature.pathSketchId, pathEntityIds: feature.pathEntityIds, operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'loft') setCommand({ type: 'loft', editId: feature.id, profileOptions: loftProfileOptions(feature.sketchIds[0]), endProfileId: feature.profileIds[1], endSketchId: feature.sketchIds[1], loftMode: feature.loftMode || 'smooth', operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'rib') setCommand({ type: 'rib', openChain: true, editId: feature.id, openEntityIds: feature.openEntityIds, ribMode: feature.ribMode || 'web', thickness: feature.thickness, depth: feature.depth, wallSide: feature.wallSide || 'symmetric', reverse: Boolean(feature.reverse), previewFeature: feature });
    else if (feature.type === 'coil') setCommand({ type: 'coil', editId: feature.id, axisId: feature.axisId, axisOptions: [{ id: 'X_AXIS', name: 'Oś bazowa X' }, { id: 'Y_AXIS', name: 'Oś bazowa Y' }, { id: 'Z_AXIS', name: 'Oś bazowa Z' }, ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name }))], coilDiameter: feature.coilDiameter, wireDiameter: feature.wireDiameter, pitch: feature.pitch, turns: feature.turns, handedness: feature.handedness || 'right', operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'pipe') setCommand({ type: 'pipe', editId: feature.id, pathSketchId: feature.pathSketchId, pathEntityIds: feature.pathEntityIds, outsideDiameter: feature.outsideDiameter, wallThickness: feature.wallThickness, operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'pattern') {
      const pathOptions = document.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, entityIds: sketch.entities.filter((entity) => entity.type === 'line' && entity.role !== 'construction').map((entity) => entity.id) })).filter((path) => path.entityIds.length);
      setCommand({ type: 'pattern', editId: feature.id, targetBodyId: feature.targetBodyId, patternType: feature.patternType, countX: feature.countX || '3', countY: feature.countY || '1', spacingX: feature.spacingX || '20', spacingY: feature.spacingY || '20', axisId: feature.axisId || 'Z_AXIS', occurrences: feature.occurrences || '4', totalAngle: feature.totalAngle || '360', pathOptions, pathSketchId: feature.pathSketchId || pathOptions[0]?.id, pathEntityIds: feature.pathEntityIds || pathOptions[0]?.entityIds || [], axisOptions: [{ id: 'X_AXIS', name: 'Oś bazowa X' }, { id: 'Y_AXIS', name: 'Oś bazowa Y' }, { id: 'Z_AXIS', name: 'Oś bazowa Z' }, ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name }))], previewFeature: feature });
    }
    else if (feature.type === 'boolean') setCommand({ type: 'boolean', editId: feature.id, operation: feature.operation, targetBodyId: feature.targetBodyId, toolBodyId: feature.toolBodyId, targetName: feature.targetBodyId, toolName: feature.toolBodyId, previewFeature: feature });
    else if (feature.type === 'primitive') setCommand({ type: 'primitive', editId: feature.id, name: feature.name, primitiveType: feature.primitiveType, x: feature.x, y: feature.y, z: feature.z, width: feature.width || '20', depth: feature.depth || '20', height: feature.height || '20', radius: feature.radius || '10', majorRadius: feature.majorRadius || '15', minorRadius: feature.minorRadius || '4', previewFeature: feature });
    else if (feature.type === 'formBody') setCommand({ type: 'formBody', editId: feature.id, name: feature.name, width: feature.width, depth: feature.depth, height: feature.height, subdivisions: feature.subdivisions, symmetry: feature.symmetry || 'none', controlOffsets: feature.controlOffsets || Array.from({ length: 8 }, () => ['0', '0', '0']), selectedControlKind: 'point', selectedControlPoint: 0, selectedControlEdge: 0, selectedControlFace: 0, creaseEdges: feature.creaseEdges || [], insertEdgeEnabled: feature.insertEdgeEnabled === true, insertEdgeIndex: feature.insertEdgeIndex || 0, insertEdgePosition: feature.insertEdgePosition || '0.5', insertEdgeOffsets: feature.insertEdgeOffsets || [], bridgeEnabled: feature.bridgeEnabled === true, bridgeFirstFace: feature.bridgeFirstFace || 0, bridgeSecondFace: feature.bridgeSecondFace ?? 1, bridgeInset: feature.bridgeInset || '0.45', bridgeOffsets: feature.bridgeOffsets || [], x: feature.x || '0', y: feature.y || '0', z: feature.z || '0', previewFeature: feature });
    else if (feature.type === 'transform') setCommand({ type: 'transform', editId: feature.id, targetBodyId: feature.targetBodyId, mode: feature.mode, x: feature.x || '0', y: feature.y || '0', z: feature.z || '0', angle: feature.angle || '0', originX: feature.originX || '0', originY: feature.originY || '0', originZ: feature.originZ || '0', previewFeature: feature });
    else if (feature.type === 'offsetFace') setCommand({ type: 'offsetFace', editId: feature.id, targetBodyId: feature.targetBodyId, distance: feature.distance, faceLabel: '1 wskazana', previewFeature: feature });
    else if (feature.type === 'textSolid') setCommand({ type: 'textSolid', editId: feature.id, text: feature.text, fontSize: feature.fontSize, depth: feature.depth, x: feature.x || '0', y: feature.y || '0', z: feature.z || '0', operation: feature.operation, targetBodyId: feature.targetBodyId || null, placement: feature.placement || 'world', topologyReferences: (feature.referenceIds || []).map((id) => document.references.find((reference) => reference.id === id)).filter(Boolean), previewFeature: feature });
    else if (feature.type === 'hole') {
      const holeOptions = { holeType: feature.holeType || 'simple', extent: feature.extent || 'distance', diameter: feature.diameter, depth: feature.depth || '10', counterboreDiameter: feature.counterboreDiameter || '10', counterboreDepth: feature.counterboreDepth || '3', countersinkDiameter: feature.countersinkDiameter || '10', countersinkAngle: feature.countersinkAngle || '90', threadMode: feature.threadMode || 'none', threadDiameter: feature.threadDiameter || '10', threadPitch: feature.threadPitch || '1.5', threadLength: feature.threadLength || feature.depth || '8', threadDirection: feature.threadDirection || 'right', holeStandard: feature.holeStandard || 'custom', holeApplication: feature.holeApplication || 'custom', standardSize: feature.standardSize || 'M6', clearanceClass: feature.clearanceClass || 'medium', threadClass: feature.threadClass ?? '6H', threadDesignation: feature.threadDesignation || '', threadInspection: feature.threadInspection || '', pipePreparation: feature.pipePreparation || 'conical', threadTaper: feature.threadTaper || '0', threadProfileAngle: feature.threadProfileAngle || '60', diameterToleranceLower: feature.diameterToleranceLower ?? '', diameterToleranceUpper: feature.diameterToleranceUpper ?? '', clearanceProfile: feature.clearanceProfile || 'nominal', clearance: feature.clearance || '0.2' };
      setCommand(feature.placement === 'face-edges'
        ? { type: 'hole', placement: 'face-edges', editId: feature.id, targetBodyId: feature.targetBodyId, firstOffset: feature.firstOffset, secondOffset: feature.secondOffset, ...holeOptions, previewFeature: feature }
        : { type: 'hole', editId: feature.id, ...holeOptions, previewFeature: feature });
    }
    else if (feature.type === 'shell') setCommand({ type: 'shell', editId: feature.id, thickness: feature.thickness, faceCount: feature.referenceIds?.length || 0, previewFeature: feature });
    else if (feature.type === 'draft') setCommand({ type: 'draft', editId: feature.id, targetBodyId: feature.targetBodyId, angle: feature.angle, neutralPlaneId: feature.neutralPlaneId, neutralPlaneOptions: draftNeutralPlaneOptions(), faceCount: feature.referenceIds?.length || 0, previewFeature: feature });
    else if (feature.type === 'splitBody') setCommand({ type: 'splitBody', editId: feature.id, targetBodyId: feature.targetBodyId, targetName: feature.targetBodyId, planeId: feature.planeId, planeOptions: draftNeutralPlaneOptions(), previewFeature: feature });
    else if (feature.type === 'splitFace') {
      const reference = document.references.find((item) => item.id === feature.referenceIds?.[0]);
      setCommand({ type: 'splitFace', editId: feature.id, targetBodyId: feature.targetBodyId, sketchId: feature.sketchId, profileId: feature.profileId, profileName: profile?.name || feature.profileId, referenceId: reference?.id, faceName: reference?.label, previewFeature: feature });
    }
    else if (feature.type === 'deleteFace') setCommand({ type: 'deleteFace', editId: feature.id, targetBodyId: feature.targetBodyId, faceCount: feature.referenceIds?.length || 0, previewFeature: feature });
    else if (feature.type === 'replaceFace') setCommand({ type: 'replaceFace', editId: feature.id, targetBodyId: feature.targetBodyId, sourceName: 'Ściana z trwałej referencji', destinationName: 'Powierzchnia z trwałej referencji', previewFeature: feature });
    else setCommand({ type: feature.type, editId: feature.id, size: feature.type === 'fillet' ? feature.radius : feature.distance, previewFeature: feature });
  };

  const saveProject = async () => {
    if (readOnly) {
      readOnlyNotice();
      return false;
    }
    const saveRequest = prepareProjectSave(document);
    if (window.desktopApp?.saveTextFile) {
      const result = await window.desktopApp.saveTextFile({
        defaultName: saveRequest.defaultName,
        text: saveRequest.text,
        filters: saveRequest.filters,
        atomic: true,
        createBackup: true,
        targetPath: currentPath || '',
      });
      if (!result?.ok) {
        setNotice(result?.canceled ? 'Anulowano zapis.' : `Nie udało się zapisać: ${result?.error || 'nieznany błąd'}`);
        return false;
      }
      setSavedDocumentText(saveRequest.snapshot);
      setCurrentPath(result.filePath || '');
      try {
        await clearAutosaveSnapshots();
      } catch (error) {
        setNotice(`Projekt zapisano, ale nie udało się wyczyścić autozapisu: ${error.message}`);
        return result.filePath;
      }
      setRecoveryInfo(null);
      setNotice(`Zapisano projekt atomowo: ${result.filePath}${result.backupPath ? ' · poprzednia wersja: .bak' : ''}`);
      return result.filePath;
    }
    downloadBlob(new Blob([saveRequest.text], { type: 'application/json' }), saveRequest.defaultName);
    setSavedDocumentText(saveRequest.snapshot);
    clearLocalAutosave();
    setNotice('Zapisano projekt MadCAD.');
    return false;
  };

  const confirmUnsavedChanges = async (reason) => {
    if (!persistenceReady) {
      setNotice('Poczekaj na zakończenie odzyskiwania autozapisu przed zmianą projektu lub aktualizacją.');
      return false;
    }
    if (!dirty) return true;
    let decision = 'cancel';
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (verifyMode) {
      decision = ['save', 'discard', 'cancel'].includes(window.__madcadVerifyUnsavedDecision)
        ? window.__madcadVerifyUnsavedDecision
        : 'discard';
    } else if (window.desktopApp?.confirmUnsavedChanges) {
      const result = await window.desktopApp.confirmUnsavedChanges({ reason });
      decision = result?.decision || 'cancel';
    } else {
      decision = window.confirm('Projekt zawiera niezapisane zmiany. Odrzucić je i kontynuować?') ? 'discard' : 'cancel';
    }
    if (decision === 'save') return saveProject();
    return decision === 'discard';
  };

  const installAvailableUpdate = async () => {
    if (!window.desktopApp?.downloadAndInstallUpdate) {
      setUpdateState((current) => ({ ...current, error: 'Instalowanie aktualizacji jest dostępne tylko w aplikacji desktopowej.' }));
      return;
    }
    if (updateState.result?.installMode === 'automatic' && !(await confirmUnsavedChanges('update'))) return;
    try {
      setUpdateState((current) => ({ ...current, status: 'installing', error: '' }));
      const result = await window.desktopApp.downloadAndInstallUpdate();
      if (result?.ok && result.handoff) {
        setUpdateState((current) => ({ ...current, status: 'idle', handoff: result, error: '' }));
        return;
      }
      if (!result?.ok || !result.installing) {
        setUpdateState((current) => ({
          ...current,
          status: 'idle',
          error: result?.error || (result?.upToDate ? 'Masz już aktualną wersję.' : 'Nie udało się rozpocząć instalacji.'),
        }));
        return;
      }
    } catch (error) {
      setUpdateState((current) => ({ ...current, status: 'idle', error: error.message }));
    }
  };

  const createNew = async () => {
    if (!(await confirmUnsavedChanges('new'))) return;
    const blank = createDocument('Bez nazwy');
    await clearAutosaveSnapshots().catch((error) => setNotice(`Nie udało się wyczyścić poprzedniego autozapisu: ${error.message}`));
    history.replace(blank);
    setSavedDocumentText(JSON.stringify(blank));
    setCurrentPath('');
    setRecoveryInfo(null);
    setDocumentAccess({ readOnly: false, sourceVersion: DOCUMENT_SCHEMA_VERSION, originalDocument: null });
    setSelection({ kind: 'document', id: blank.id });
    setActiveSketchId(null);
    setCommand(null);
    setWorkspace('solid');
    setNotice('Nowy pusty projekt. Utwórz pierwszy szkic.');
  };

  const applyOpenedProject = async (opened) => {
    await clearAutosaveSnapshots().catch((error) => setNotice(`Nie udało się wyczyścić poprzedniego autozapisu: ${error.message}`));
    history.replace(opened.document);
    setSavedDocumentText(JSON.stringify(opened.document));
    setCurrentPath(opened.filePath);
    setRecoveryInfo(null);
    setDocumentAccess({ readOnly: opened.readOnly, sourceVersion: opened.sourceVersion, originalDocument: opened.originalDocument });
    setSelection({ kind: 'document', id: opened.document.id });
    setActiveSketchId(null);
    setCommand(null);
    setWorkspace('solid');
    setNotice(`${opened.warning ? `${opened.warning} ` : ''}Otwarto projekt ${opened.document.name}.`);
  };

  const requestOpenProject = async () => {
    if (!window.desktopApp?.openProjectFile) {
      fileInputRef.current?.click();
      return;
    }
    if (!(await confirmUnsavedChanges('open'))) return;
    try {
      const result = await window.desktopApp.openProjectFile();
      if (!result?.ok) {
        if (!result?.canceled) setNotice(`Nie udało się otworzyć projektu: ${result?.error || 'nieznany błąd'}`);
        return;
      }
      const opened = openDocument(JSON.parse(result.text));
      await applyOpenedProject({ ...opened, filePath: result.filePath });
    } catch (error) {
      setNotice(`Nie udało się otworzyć projektu: ${error.message}`);
    }
  };

  const openProject = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!(await confirmUnsavedChanges('open'))) return;
    try {
      const opened = await readProjectFile(file);
      await applyOpenedProject(opened);
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
    setModelImportBusy(true);
    setNotice(`Sprawdzanie i przygotowywanie pliku ${file.name}…`);
    try {
      const sourceBuffer = await file.arrayBuffer();
      const normalizedFormat = originalFormat === 'stp' ? 'step' : originalFormat;
      const inspection = inspectModelImportBuffer(sourceBuffer, normalizedFormat);
      let importFormat = originalFormat === 'step' || originalFormat === 'stp' ? 'step' : 'stl';
      let buffer = sourceBuffer;
      let detectedUnit = 'millimeter';
      let objectCount = null;
      let triangleCount = inspection.triangleCount;
      if (originalFormat === '3mf') {
        const [{ ThreeMFLoader }, { STLExporter }] = await Promise.all([
          import('three/examples/jsm/loaders/3MFLoader.js'),
          import('three/examples/jsm/exporters/STLExporter.js'),
        ]);
        const archiveInfo = inspectThreeMfArchive(sourceBuffer);
        detectedUnit = normalizeModelUnit(archiveInfo.unit);
        objectCount = archiveInfo.objectCount;
        triangleCount = archiveInfo.triangleCount;
        const group = new ThreeMFLoader().parse(sourceBuffer);
        group.updateMatrixWorld(true);
        const exported = new STLExporter().parse(group, { binary: true });
        buffer = exported.buffer.slice(exported.byteOffset, exported.byteOffset + exported.byteLength);
        inspectModelImportBuffer(buffer, 'stl');
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
        detectedUnit,
        sourceBytes: inspection.bytes,
        storedBytes: buffer.byteLength,
        objectCount,
        triangleCount,
        importMode: inspection.importMode,
      });
      setNotice(`Wczytano ${file.name} · ${formatModelFileSize(inspection.bytes)}${Number.isFinite(triangleCount) ? ` · ${triangleCount.toLocaleString('pl-PL')} trójkątów` : ''}. Potwierdź jednostkę źródłową.`);
    } catch (error) {
      setNotice(`Nie udało się odczytać modelu: ${error.message}`);
    } finally {
      setModelImportBusy(false);
    }
  };

  const confirmModelImport = () => {
    if (!importDraft || readOnly) return;
    const unitScale = { auto: 1, millimeter: 1, centimeter: 10, inch: 25.4, meter: 1000, micron: 0.001, foot: 304.8 }[importDraft.sourceUnit] || 1;
    const feature = createFeature('importedModel', {
      name: importDraft.name || 'Model importowany',
      originalFormat: importDraft.originalFormat,
      importFormat: importDraft.importFormat,
      dataBase64: importDraft.dataBase64,
      sourceUnit: importDraft.sourceUnit,
      unitScale,
      sourceBytes: importDraft.sourceBytes,
      objectCount: importDraft.objectCount,
      triangleCount: importDraft.triangleCount,
    });
    commit((next) => insertTimelineFeature(next, feature));
    setPendingModelImport({ featureId: feature.id, fileName: importDraft.fileName });
    const modelEntries = [];
    if (importDraft.originalFormat === '3mf') modelEntries.push({ id: 'model-conversion', status: 'changed', code: '3MF_MESH_NORMALIZED', message: 'Obiekty 3MF połączono w wewnętrzną siatkę STL z zachowaniem położenia i skali.' });
    if (importDraft.sourceUnit !== 'auto' && unitScale !== 1) modelEntries.push({ id: 'model-unit-scale', status: 'changed', code: 'UNIT_SCALE_APPLIED', message: `Przeskalowano geometrię współczynnikiem ${unitScale} do milimetrów.` });
    setImportRepairReport({
      fileName: importDraft.fileName,
      format: importDraft.originalFormat,
      sourceUnit: importDraft.sourceUnit,
      imported: Number.isFinite(importDraft.objectCount) ? importDraft.objectCount : 1,
      changed: modelEntries.filter((entry) => entry.status === 'changed').length,
      skipped: 0,
      warnings: 0,
      entries: modelEntries,
      createdAt: new Date().toISOString(),
    });
    setSelection({ kind: 'feature', id: feature.id });
    setImportDraft(null);
    setWorkspace('solid');
    setNotice(`Importowanie ${importDraft.fileName} w silniku CAD… Po zakończeniu pokażę wynik albo dokładny powód odrzucenia pliku.`);
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

  const prepareDwgSketchImport = useCallback((result) => {
    if (result?.canceled) {
      setNotice('Anulowano import DWG.');
      return false;
    }
    if (result?.setupRequired) {
      setNotice('Otworzono stronę lokalnego konwertera DWG. Po instalacji ponownie wybierz Import DWG.');
      return false;
    }
    if (!result?.ok || !result.text) throw new Error(result?.error || 'Konwerter nie zwrócił danych DXF.');
    const inspected = inspectSketchImport(result.text, 'dxf');
    setSketchImportDraft({
      fileName: result.fileName || 'import.dwg',
      sourceFormat: 'dwg',
      format: 'dxf',
      text: result.text,
      detectedUnit: inspected.detectedUnit,
      sourceUnit: 'auto',
    });
    setNotice(`Przekonwertowano ${result.fileName || 'DWG'} lokalnie przez ${result.converter === 'libredwg' ? 'GNU LibreDWG' : 'ODA'}. Potwierdź jednostkę.`);
    return true;
  }, []);

  const chooseDwgSketchImport = async () => {
    if (!activeSketchId || readOnly) return;
    if (!window.desktopApp?.importDwgSketch) {
      setNotice('Import DWG jest dostępny w zainstalowanej aplikacji desktopowej.');
      return;
    }
    setNotice('Wybierz plik DWG. Konwersja zostanie wykonana lokalnie.');
    try {
      prepareDwgSketchImport(await window.desktopApp.importDwgSketch());
    } catch (error) {
      setNotice(`Import DWG nie powiódł się: ${error.message}`);
    }
  };

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('verify')) return undefined;
    window.__madcadVerifyDwgImport = prepareDwgSketchImport;
    window.__madcadVerifyFindUntranslatedText = () => findUntranslatedModelingText(globalThis.document.querySelector('.modeling-shell'));
    window.__madcadVerifyShowImportRepairReport = () => {
      const imported = parseSketchImport('<svg width="40mm" height="20mm"><rect x="0" y="0" width="20" height="10" rx="2"/><path d="M 0 0 C 1 1 2 2 3 3"/><text x="2" y="2">opis</text></svg>', 'svg');
      setImportRepairReport({ fileName: 'test-naprawy.svg', format: 'svg', sourceUnit: imported.sourceUnit, ...imported.repairReport, createdAt: new Date().toISOString() });
      return imported.repairReport;
    };
    return () => { delete window.__madcadVerifyDwgImport; delete window.__madcadVerifyShowImportRepairReport; delete window.__madcadVerifyFindUntranslatedText; };
  }, [prepareDwgSketchImport]);

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
      setImportRepairReport({
        fileName: sketchImportDraft.fileName,
        format: sketchImportDraft.sourceFormat || imported.format,
        sourceUnit: imported.sourceUnit,
        ...imported.repairReport,
        createdAt: new Date().toISOString(),
      });
      setSketchImportDraft(null);
      setSelection({ kind: 'sketch', id: activeSketchId });
      setNotice(`Zaimportowano ${imported.curveCount} elementów z ${sketchImportDraft.fileName} · ${imported.profiles.length} profili · jednostka ${imported.sourceUnit}.`);
    } catch (error) {
      setNotice(`Import szkicu nie powiódł się: ${error.message}`);
    }
  };

  const saveImportRepairReport = async () => {
    if (!importRepairReport) return;
    const payload = JSON.stringify(importRepairReport, null, 2);
    const defaultName = `${safeName(importRepairReport.fileName.replace(/\.[^.]+$/, ''))}-raport-importu.json`;
    if (window.desktopApp?.saveTextFile) {
      const result = await window.desktopApp.saveTextFile({ defaultName, text: payload, filters: [{ name: 'Raport JSON', extensions: ['json'] }], atomic: true, createBackup: false });
      setNotice(result?.ok ? `Zapisano raport importu: ${result.filePath}` : result?.canceled ? 'Anulowano zapis raportu.' : `Nie udało się zapisać raportu: ${result?.error || 'nieznany błąd'}`);
      return;
    }
    downloadBlob(new Blob([payload], { type: 'application/json' }), defaultName);
    setNotice('Pobrano raport importu JSON.');
  };

  const exportModel = async (format) => {
    setNotice(`Przygotowywanie pliku ${format.toUpperCase()}…`);
    try {
      const buffers = await engine.exportModel(format);
      const extension = format === 'step' ? 'step' : format;
      const mime = format === 'stl' ? 'model/stl' : format === '3mf' ? 'model/3mf' : 'model/step';
      buffers.forEach((buffer, index) => downloadBlob(new Blob([buffer], { type: mime }), `${safeName(document.name)}${buffers.length > 1 ? `-${index + 1}` : ''}.${extension}`));
      setNotice(format === 'step'
        ? 'Wyeksportowano STEP z dokładnej bryły B-Rep.'
        : `Wyeksportowano ${format.toUpperCase()} jako siatkę 3D.`);
    } catch (error) {
      setNotice(`Eksport nie powiódł się: ${error.message}`);
    }
  };

  const activeDrawingSheet = document.drawings.find((sheet) => sheet.id === activeDrawingSheetId) || document.drawings[0] || null;
  const selectedDrawingView = activeDrawingSheet?.views.find((view) => view.id === selectedDrawingViewId) || null;
  const selectedDrawingAnnotation = activeDrawingSheet?.annotations?.find((annotation) => annotation.id === selectedDrawingAnnotationId) || null;
  const drawableSketches = document.sketches.filter((sketch) => sketch.entities.some((entity) => !['point', 'text'].includes(entity.type) && entity.role !== 'construction'));
  const selectedDrawingIsSketch = selectedDrawingView?.type === 'sketch';

  const createDrawingSheetInDocument = () => {
    if (readOnly) return readOnlyNotice();
    const sheet = createDrawingSheet({ name: `Arkusz ${document.drawings.length + 1}` });
    commit((next) => { next.drawings.push(sheet); });
    setActiveDrawingSheetId(sheet.id);
    setSelectedDrawingViewId(null);
    setSelectedDrawingAnnotationId(null);
    setNotice(`Utworzono ${sheet.name} · A4 poziomo.`);
  };

  const updateActiveDrawingSheet = (patch) => {
    if (!activeDrawingSheet || readOnly) return;
    commit((next) => {
      const sheet = next.drawings.find((item) => item.id === activeDrawingSheet.id);
      if (sheet) Object.assign(sheet, patch);
    });
  };

  const deleteActiveDrawingSheet = () => {
    if (!activeDrawingSheet || readOnly) return;
    const remaining = document.drawings.filter((sheet) => sheet.id !== activeDrawingSheet.id);
    commit((next) => { next.drawings = next.drawings.filter((sheet) => sheet.id !== activeDrawingSheet.id); });
    setActiveDrawingSheetId(remaining[0]?.id || null);
    setSelectedDrawingViewId(null);
    setSelectedDrawingAnnotationId(null);
    setNotice(`Usunięto arkusz „${activeDrawingSheet.name}”.`);
  };

  const addBaseDrawingView = () => {
    if (!activeDrawingSheet || !engine.bodies.length || readOnly) return;
    const orientation = 'front';
    const scale = recommendedDrawingScale(activeDrawingSheet, engine.bodies, orientation);
    const view = createBaseDrawingView({ bodyIds: engine.bodies.map((body) => body.id), orientation, scale, sheet: activeDrawingSheet });
    commit((next) => { next.drawings.find((sheet) => sheet.id === activeDrawingSheet.id)?.views.push(view); });
    setSelectedDrawingViewId(view.id);
    setSelectedDrawingAnnotationId(null);
    setNotice(`Dodano skojarzony widok bazowy · Przód · skala ${scale}:1.`);
  };

  const addSketchDrawingView = () => {
    if (!activeDrawingSheet || !drawableSketches.length || readOnly) return;
    const sketch = drawableSketches.find((candidate) => candidate.id === activeSketchId) || drawableSketches.at(-1);
    const scale = recommendedSketchDrawingScale(activeDrawingSheet, sketch, document.parameters, document.layers);
    const view = createSketchDrawingView({ sketchId: sketch.id, name: sketch.name || 'Szkic 2D', scale, sheet: activeDrawingSheet });
    commit((next) => { next.drawings.find((sheet) => sheet.id === activeDrawingSheet.id)?.views.push(view); });
    setSelectedDrawingViewId(view.id);
    setSelectedDrawingAnnotationId(null);
    setNotice(`Dodano skojarzony szkic 2D „${sketch.name}” · skala ${scale}:1.`);
  };

  const addDerivedDrawingView = (type) => {
    if (!activeDrawingSheet || !selectedDrawingView || selectedDrawingView.type === 'sketch' || readOnly) return;
    const page = drawingPageDimensions(activeDrawingSheet);
    const parentView = selectedDrawingView.type === 'base' ? {
      ...selectedDrawingView,
      x: page.width * 0.34,
      y: (page.height - 24) * 0.35,
      scale: Math.min(selectedDrawingView.scale, recommendedDrawingScale(activeDrawingSheet, engine.bodies, selectedDrawingView.orientation) * 0.5),
    } : selectedDrawingView;
    let view;
    if (type === 'projected') view = createProjectedDrawingView({ parentView });
    else if (type === 'section' && selectedDrawingView.orientation !== 'isometric') view = createSectionDrawingView({ parentView });
    else if (type === 'detail') view = createDetailDrawingView({ parentView });
    if (!view) return;
    if (selectedDrawingView.type === 'base') {
      if (type === 'projected') Object.assign(view, { x: page.width * 0.68, y: parentView.y });
      else if (type === 'section') Object.assign(view, { x: parentView.x, y: (page.height - 24) * 0.72 });
      else Object.assign(view, { x: page.width * 0.68, y: (page.height - 24) * 0.72 });
    }
    commit((next) => {
      const sheet = next.drawings.find((item) => item.id === activeDrawingSheet.id);
      const parent = sheet?.views.find((item) => item.id === selectedDrawingView.id);
      if (parent && selectedDrawingView.type === 'base') Object.assign(parent, { x: parentView.x, y: parentView.y, scale: parentView.scale });
      sheet?.views.push(view);
    });
    setSelectedDrawingViewId(view.id);
    setSelectedDrawingAnnotationId(null);
    setNotice(`${view.name} jest skojarzony z widokiem nadrzędnym i aktualnym modelem.`);
  };

  const updateSelectedDrawingView = (patch) => {
    if (!activeDrawingSheet || !selectedDrawingViewId || readOnly) return;
    const normalizedPatch = { ...patch };
    const parent = activeDrawingSheet.views.find((view) => view.id === selectedDrawingView?.parentViewId);
    if (selectedDrawingView?.type === 'base' && normalizedPatch.orientation) {
      normalizedPatch.scale = Math.min(selectedDrawingView.scale, recommendedDrawingScale(activeDrawingSheet, engine.bodies, normalizedPatch.orientation));
    }
    if (parent && normalizedPatch.projectionDirection) {
      const direction = normalizedPatch.projectionDirection;
      normalizedPatch.x = Number(parent.x) + (direction === 'right' ? 70 : direction === 'left' ? -70 : 0);
      normalizedPatch.y = Number(parent.y) + (direction === 'bottom' ? 55 : direction === 'top' ? -55 : 0);
    }
    if (parent && normalizedPatch.sectionAxis) {
      normalizedPatch.x = Number(parent.x) + (normalizedPatch.sectionAxis === 'vertical' ? 82 : 0);
      normalizedPatch.y = Number(parent.y) + (normalizedPatch.sectionAxis === 'horizontal' ? 62 : 0);
    }
    commit((next) => {
      const view = next.drawings.find((sheet) => sheet.id === activeDrawingSheet.id)?.views.find((item) => item.id === selectedDrawingViewId);
      if (view) Object.assign(view, normalizedPatch);
    });
  };

  const deleteSelectedDrawingView = () => {
    if (!activeDrawingSheet || !selectedDrawingViewId || readOnly) return;
    const deletedIds = new Set([selectedDrawingViewId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const view of activeDrawingSheet.views) {
        if (view.parentViewId && deletedIds.has(view.parentViewId) && !deletedIds.has(view.id)) {
          deletedIds.add(view.id);
          changed = true;
        }
      }
    }
    commit((next) => {
      const sheet = next.drawings.find((item) => item.id === activeDrawingSheet.id);
      if (sheet) {
        sheet.views = sheet.views.filter((view) => !deletedIds.has(view.id));
        sheet.annotations = (sheet.annotations || []).filter((annotation) => !deletedIds.has(annotation.viewId));
        sheet.tables = (sheet.tables || []).filter((table) => !deletedIds.has(table.viewId));
      }
    });
    setSelectedDrawingViewId(null);
    setSelectedDrawingAnnotationId(null);
    setNotice(deletedIds.size === 1 ? 'Usunięto widok z arkusza. Model pozostał bez zmian.' : `Usunięto widok i ${deletedIds.size - 1} zależne widoki. Model pozostał bez zmian.`);
  };

  const addDrawingAnnotation = (type) => {
    if (!activeDrawingSheet || !selectedDrawingView || readOnly) return;
    const viewId = selectedDrawingView.id;
    let annotation;
    if (type === 'dimension-horizontal') annotation = createLinearDrawingDimension({ viewId, axis: 'horizontal', offset: 16, precision: 2 });
    else if (type === 'dimension-vertical') annotation = createLinearDrawingDimension({ viewId, axis: 'vertical', offset: 10, precision: 2 });
    else if (type === 'centerline') annotation = createCenterlineDrawingAnnotation({ viewId });
    else if (type === 'center-mark') annotation = createCenterMarkDrawingAnnotation({ viewId });
    else if (type === 'hole-note') annotation = createHoleNoteDrawingAnnotation({ viewId, center: [0.7, 0.3], labelOffset: [12, -12] });
    else if (type === 'thread-note') annotation = createHoleNoteDrawingAnnotation({ viewId, center: [0.2, 0.25], noteMode: 'thread', labelOffset: [10, -18] });
    else if (type === 'feature-control-frame') annotation = createFeatureControlFrameDrawingAnnotation({ viewId, center: [0.7, 0.7], labelOffset: [12, 12] });
    else if (type === 'balloon') {
      const bodyId = selectedDrawingView.bodyIds[0];
      annotation = createBalloonDrawingAnnotation({ viewId, bodyId, center: [0.25, 0.2], labelOffset: [-10, -10], itemNumber: drawingBomItemNumber(bodyId, engine.bodies, document.components, document.componentInstances) || (activeDrawingSheet.annotations || []).filter((item) => item.type === 'balloon').length + 1 });
    }
    if (!annotation) return;
    commit((next) => {
      const sheet = next.drawings.find((item) => item.id === activeDrawingSheet.id);
      if (sheet) (sheet.annotations ||= []).push(annotation);
    });
    setSelectedDrawingViewId(null);
    setSelectedDrawingAnnotationId(annotation.id);
    setNotice('Dodano skojarzone oznaczenie rysunkowe.');
  };

  const updateSelectedDrawingAnnotation = (patch) => {
    if (!activeDrawingSheet || !selectedDrawingAnnotation || readOnly) return;
    commit((next) => {
      const annotation = next.drawings.find((sheet) => sheet.id === activeDrawingSheet.id)?.annotations?.find((item) => item.id === selectedDrawingAnnotation.id);
      if (annotation) Object.assign(annotation, patch);
    });
  };

  const deleteSelectedDrawingAnnotation = () => {
    if (!activeDrawingSheet || !selectedDrawingAnnotation || readOnly) return;
    commit((next) => {
      const sheet = next.drawings.find((item) => item.id === activeDrawingSheet.id);
      if (sheet) sheet.annotations = (sheet.annotations || []).filter((annotation) => annotation.id !== selectedDrawingAnnotation.id);
    });
    setSelectedDrawingAnnotationId(null);
    setNotice('Usunięto oznaczenie rysunkowe.');
  };

  const addDrawingRevision = () => {
    if (!activeDrawingSheet || readOnly) return;
    const nextCode = String.fromCharCode(65 + Math.min(25, activeDrawingSheet.revisions?.length || 0));
    const revision = createDrawingRevision({ code: nextCode, author: activeDrawingSheet.titleBlock?.author || '' });
    commit((next) => { next.drawings.find((sheet) => sheet.id === activeDrawingSheet.id)?.revisions.push(revision); });
    setNotice(`Dodano rewizję ${revision.code}.`);
  };

  const updateDrawingRevision = (revisionId, patch) => {
    if (!activeDrawingSheet || readOnly) return;
    commit((next) => {
      const revision = next.drawings.find((sheet) => sheet.id === activeDrawingSheet.id)?.revisions.find((item) => item.id === revisionId);
      if (revision) Object.assign(revision, patch);
    });
  };

  const deleteDrawingRevision = (revisionId) => {
    if (!activeDrawingSheet || readOnly) return;
    commit((next) => {
      const sheet = next.drawings.find((item) => item.id === activeDrawingSheet.id);
      if (sheet) sheet.revisions = sheet.revisions.filter((revision) => revision.id !== revisionId);
    });
    setNotice('Usunięto wpis rewizji.');
  };

  const addDrawingTable = (type) => {
    if (!activeDrawingSheet || readOnly || (type === 'hole-table' && !selectedDrawingView)) return;
    if ((activeDrawingSheet.tables || []).some((table) => table.type === type && (type !== 'hole-table' || table.viewId === selectedDrawingView?.id))) {
      setNotice(type === 'bom' ? 'Arkusz ma już zestawienie części.' : type === 'bend-table' ? 'Arkusz ma już tabelę gięć.' : 'Wybrany widok ma już tabelę otworów.');
      return;
    }
    const table = createDrawingTable({ type, viewId: selectedDrawingView?.id, sheet: activeDrawingSheet });
    commit((next) => { next.drawings.find((sheet) => sheet.id === activeDrawingSheet.id)?.tables.push(table); });
    setNotice(type === 'bom' ? 'Dodano skojarzone zestawienie części.' : type === 'bend-table' ? 'Dodano skojarzoną tabelę gięć blachy.' : 'Dodano skojarzoną tabelę otworów.');
  };

  const updateDrawingTable = (tableId, patch) => {
    if (!activeDrawingSheet || readOnly) return;
    commit((next) => {
      const table = next.drawings.find((sheet) => sheet.id === activeDrawingSheet.id)?.tables.find((item) => item.id === tableId);
      if (table) Object.assign(table, patch);
    });
  };

  const deleteDrawingTable = (tableId) => {
    if (!activeDrawingSheet || readOnly) return;
    commit((next) => {
      const sheet = next.drawings.find((item) => item.id === activeDrawingSheet.id);
      if (sheet) sheet.tables = sheet.tables.filter((table) => table.id !== tableId);
    });
    setNotice('Usunięto tabelę z arkusza.');
  };

  const exportActiveDrawingDxf = () => {
    if (!activeDrawingSheet?.views.length) return;
    const dxf = drawingSheetDxf(activeDrawingSheet, engine.bodies, { components: document.components, componentInstances: document.componentInstances, sketches: document.sketches, parameters: document.parameters, layers: document.layers });
    downloadBlob(new Blob([dxf], { type: 'application/dxf;charset=utf-8' }), `${safeName(document.name)}-${safeName(activeDrawingSheet.name)}.dxf`);
    setNotice('Wyeksportowano arkusz DXF w jednostkach mm.');
  };

  const exportActiveDrawingPdf = async () => {
    if (!activeDrawingSheet?.views.length) return;
    const html = drawingSheetHtml(activeDrawingSheet, engine.bodies, { documentName: document.name, components: document.components, componentInstances: document.componentInstances, sketches: document.sketches, parameters: document.parameters, layers: document.layers });
    setNotice(`Przygotowywanie ${activeDrawingSheet.pageSize} PDF…`);
    if (window.desktopApp?.saveDrawingPdf) {
      const result = await window.desktopApp.saveDrawingPdf({
        html,
        title: `${document.name} · ${activeDrawingSheet.name}`,
        defaultName: `${safeName(document.name)}-${safeName(activeDrawingSheet.name)}.pdf`,
        pageSize: activeDrawingSheet.pageSize,
        orientation: activeDrawingSheet.orientation,
      });
      setNotice(result?.ok ? `Zapisano dokumentację PDF: ${result.filePath}` : result?.canceled ? 'Anulowano eksport PDF.' : `Eksport PDF nie powiódł się: ${result?.error || 'nieznany błąd'}`);
      return;
    }
    if (window.desktopApp?.openPrintPreviewWindow) {
      const result = await window.desktopApp.openPrintPreviewWindow({ html, title: `${document.name} · ${activeDrawingSheet.name}` });
      setNotice(result?.ok ? 'Otworzono podgląd wydruku. Wybierz systemowy zapis PDF.' : `Podgląd nie powiódł się: ${result?.error || 'nieznany błąd'}`);
      return;
    }
    downloadBlob(new Blob([html], { type: 'text/html' }), `${safeName(document.name)}-${safeName(activeDrawingSheet.name)}.html`);
    setNotice('Pobrano arkusz HTML do wydruku PDF w przeglądarce.');
  };

  const previewActiveDrawing = async () => {
    if (!activeDrawingSheet?.views.length || !window.desktopApp?.openPrintPreviewWindow) return;
    const result = await window.desktopApp.openPrintPreviewWindow({ html: drawingSheetHtml(activeDrawingSheet, engine.bodies, { documentName: document.name, components: document.components, componentInstances: document.componentInstances, sketches: document.sketches, parameters: document.parameters, layers: document.layers }), title: `${document.name} · ${activeDrawingSheet.name}` });
    setNotice(result?.ok ? 'Otworzono podgląd arkusza 1:1.' : `Podgląd nie powiódł się: ${result?.error || 'nieznany błąd'}`);
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
    setCommand(null);
    setActiveSketchId(null);
    setToolHelp(null);
    setBrowserOpen(id !== 'drawing');
    setWorkspace(id);
    setPrintPanelOpen(false);
    setNotice(id === 'drawing'
        ? 'Arkusz 2D: przygotuj rysunek techniczny do PDF albo DXF.'
      : id === 'tools'
        ? 'Zarządzaj: parametry, wersje, struktura i kondycja projektu.'
        : 'Projektuj: szkicuj, twórz, modyfikuj i sprawdzaj geometrię.');
  };

  const openPrintPreparation = () => {
    setCommand(null);
    setActiveSketchId(null);
    setWorkspace('solid');
    setFileMenuOpen(false);
    setPrintPanelOpen(true);
    setNotice('Druk 3D: ułóż gotowy model na stole, sprawdź go i przekaż do slicera.');
  };

  const handleWorkspaceTabKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? MAIN_TABS.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + MAIN_TABS.length) % MAIN_TABS.length;
    switchWorkspace(MAIN_TABS[nextIndex].id);
    window.requestAnimationFrame(() => document.querySelectorAll('.workspace-tabs [role="tab"]')[nextIndex]?.focus());
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
    setTimelineRename(null);
    setTimelineDeleteId(null);
    setNotice(`${nextIndex + 1}. ${feature.name}`);
  };

  const selectTimelineFeature = (feature, index) => {
    setSelection({ kind: 'feature', id: feature.id });
    setTimelineRename(null);
    setTimelineDeleteId(null);
    setNotice(`${index + 1}. ${feature.name}`);
  };

  const moveSelectedTimelineFeature = (delta) => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    const result = moveTimelineFeature(document, selection.id, delta);
    if (!result.ok) {
      setNotice(`Nie można zmienić kolejności: ${result.reason}`);
      return;
    }
    commit((next) => { next.features = result.features; });
    setTimelineDeleteId(null);
    setNotice(`Przeniesiono operację na pozycję ${result.toIndex + 1}. Zależności modelu pozostały poprawne.`);
  };

  const toggleSelectedTimelineFeature = () => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    const feature = document.features.find((item) => item.id === selection.id);
    if (!feature) return;
    const suppressed = !feature.suppressed;
    commit((next) => { setTimelineFeatureSuppressed(next, feature.id, suppressed); });
    setTimelineDeleteId(null);
    setNotice(suppressed ? `Wyłączono „${feature.name}”. Operacje zależne zostaną oznaczone na osi czasu.` : `Włączono „${feature.name}” i uruchomiono ponowne przeliczenie historii.`);
  };

  const beginTimelineRename = () => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    const feature = document.features.find((item) => item.id === selection.id);
    if (!feature) return;
    setTimelineDeleteId(null);
    setTimelineRename({ id: feature.id, value: feature.name });
  };

  const confirmTimelineRename = () => {
    const nextName = String(timelineRename?.value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!timelineRename?.id || !nextName) {
      setNotice('Nazwa operacji nie może być pusta.');
      return;
    }
    commit((next) => { renameTimelineFeature(next, timelineRename.id, nextName); });
    setTimelineRename(null);
    setNotice(`Zmieniono nazwę operacji na „${nextName}”.`);
  };

  const requestTimelineDelete = () => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    setTimelineRename(null);
    setTimelineDeleteId(selection.id);
  };

  const requestSelectedBodyDelete = () => {
    if (readOnly) return readOnlyNotice();
    if (selectedBodyIds.length !== 1) {
      setNotice('Zaznacz jedną bryłę do usunięcia.');
      return;
    }
    const body = engine.bodies.find((item) => item.id === selectedBodyIds[0]);
    const sourceFeatureId = body?.sourceFeatureId || (body?.id?.startsWith('body-') ? body.id.slice(5) : '');
    if (!sourceFeatureId || !document.features.some((feature) => feature.id === sourceFeatureId)) {
      setNotice('Nie znaleziono operacji źródłowej tej bryły.');
      return;
    }
    setSelection({ kind: 'feature', id: sourceFeatureId });
    setTimelineRename(null);
    setTimelineDeleteId(sourceFeatureId);
    setNotice('Potwierdź usunięcie operacji źródłowej bryły i jej zależności na osi czasu.');
  };

  const confirmTimelineDelete = () => {
    if (!timelineDeleteId) return;
    const deletedIds = dependentTimelineFeatureIds(document, timelineDeleteId);
    const deletedSet = new Set(deletedIds);
    const deletedIndex = document.features.findIndex((feature) => feature.id === timelineDeleteId);
    const nextSelection = document.features.slice(deletedIndex + 1).find((feature) => !deletedSet.has(feature.id))
      || [...document.features.slice(0, deletedIndex)].reverse().find((feature) => !deletedSet.has(feature.id));
    commit((next) => { deleteTimelineFeatureCascade(next, timelineDeleteId); });
    setTimelineDeleteId(null);
    setTimelineRename(null);
    setCommand(null);
    setSelection(nextSelection ? { kind: 'feature', id: nextSelection.id } : { kind: 'document', id: document.id });
    setNotice(`Usunięto ${deletedIds.length} ${deletedIds.length === 1 ? 'operację' : 'operacje'} z osi czasu wraz z zależnościami.`);
  };

  const toggleTimelineRollback = () => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    const selectedGroup = document.featureGroups.find((group) => group.featureIds.includes(selection.id));
    const effectiveMarkerId = selectedGroup?.featureIds.at(-1) || selection.id;
    const clearing = document.timelineRollbackFeatureId === effectiveMarkerId;
    commit((next) => { setTimelineRollback(next, clearing ? '' : selection.id); });
    setTimelineDeleteId(null);
    setNotice(clearing
      ? 'Przywrócono pełną historię modelu.'
      : `Cofnięto model do „${selectedTimelineFeature?.name}”. Nowa operacja zostanie wstawiona w tym miejscu.`);
  };

  const createTimelineGroupFromSelection = () => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    const dependentIds = new Set(dependentTimelineFeatureIds(document, selection.id));
    const lastIndex = Math.max(selectedTimelineIndex, ...document.features.map((feature, index) => dependentIds.has(feature.id) ? index : -1));
    const featureIds = document.features.slice(selectedTimelineIndex, lastIndex + 1).map((feature) => feature.id);
    try {
      const groupId = createId('feature-group');
      const groupName = `Grupa ${document.featureGroups.length + 1}`;
      commit((next) => { createTimelineFeatureGroup(next, featureIds, groupName, groupId); });
      setSelection({ kind: 'featureGroup', id: groupId });
      setTimelineGroupRename({ id: groupId, value: groupName });
      setNotice(`Utworzono grupę historii z ${featureIds.length} ${featureIds.length === 1 ? 'operacją' : 'operacjami'}.`);
    } catch (error) {
      setNotice(`Nie utworzono grupy: ${error.message}`);
    }
  };

  const confirmTimelineGroupRename = () => {
    const nextName = String(timelineGroupRename?.value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!timelineGroupRename?.id || !nextName) return setNotice('Nazwa grupy nie może być pusta.');
    commit((next) => { updateTimelineFeatureGroup(next, timelineGroupRename.id, { name: nextName }); });
    setTimelineGroupRename(null);
    setNotice(`Zmieniono nazwę grupy na „${nextName}”.`);
  };

  const toggleSelectedTimelineGroup = () => {
    if (readOnly || selection?.kind !== 'featureGroup') return readOnly ? readOnlyNotice() : undefined;
    const group = document.featureGroups.find((item) => item.id === selection.id);
    if (!group) return;
    commit((next) => { updateTimelineFeatureGroup(next, group.id, { collapsed: !group.collapsed }); });
  };

  const ungroupSelectedTimelineGroup = () => {
    if (readOnly || selection?.kind !== 'featureGroup') return readOnly ? readOnlyNotice() : undefined;
    const group = document.featureGroups.find((item) => item.id === selection.id);
    if (!group) return;
    commit((next) => { deleteTimelineFeatureGroup(next, group.id); });
    const firstFeatureId = group.featureIds[0];
    setSelection(firstFeatureId ? { kind: 'feature', id: firstFeatureId } : { kind: 'document', id: document.id });
    setTimelineGroupRename(null);
    setNotice(`Rozwiązano grupę „${group.name}”; operacje pozostały w historii.`);
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
    if (nextSelection.kind === 'component' || nextSelection.kind === 'componentInstance' || nextSelection.kind === 'joint' || nextSelection.kind === 'motionLink' || nextSelection.kind === 'contactSet' || nextSelection.kind === 'assemblyConfiguration') {
      setComponentsOpen(true);
      setLayersOpen(false);
      setBlocksOpen(false);
      setCommandCustomizationOpen(false);
    }
    setSelection(nextSelection);
  };

  const executeBasicShortcut = useCallback((rawShortcut) => {
    const shortcut = String(rawShortcut || '').trim().toUpperCase();
    if (!shortcut) return false;
    const entry = shortcutRegistryRef.current.get(shortcut);
    if (!entry) return false;
    setToolHelp(null);
    if (entry.disabled) {
      setNotice(`Narzędzie „${entry.label}” jest teraz niedostępne. Najpierw wybierz wymaganą geometrię.`);
      return { handled: true, disabled: true, label: entry.label };
    }
    entry.onClick?.();
    return { handled: true, disabled: false, label: entry.label };
  }, []);

  const cancelActiveCommand = () => {
    if (!command) return false;
    if (command.type === 'line' || command.type === 'polyline') finishSketchPath();
    else {
      if (command.openChain && command.sourceSketchId) {
        setActiveSketchId(command.sourceSketchId);
        setWorkspace('sketch');
      }
      setCommand(null);
      setNotice('Anulowano polecenie.');
    }
    return true;
  };

  const executeCommandEnter = ({ preferExact = false } = {}) => {
    if (!command) return false;
    if (command.type === 'line' || command.type === 'polyline') {
      if (preferExact && command.lastPoint) confirmExactSketchSegment();
      else if (command.lastPoint && sketchDynamicLengthRef.current) confirmDynamicSketchSegment();
      else finishSketchPath();
      return true;
    }
    if (directSketchTypes.includes(command.type)) finishCanvasSketchTool();
    else if (command.previewFeature) confirmFeature();
    else if (command.type === 'moveSketch') confirmSketchMove();
    else if (command.type === 'offsetSketch') confirmSketchOffset();
    else if (command.type === 'cornerSketch') confirmSketchCorner();
    else if (command.type === 'transformSketch') confirmSketchTransform();
    else if (command.type === 'patternSketch') confirmSketchPattern();
    else return false;
    return true;
  };

  const handleCommandLineCancel = () => {
    if (cancelActiveCommand()) {
      appendCommandHistory('ESC', 'Anulowano aktywne polecenie.');
      return;
    }
    if (activeSketchId) {
      handleSketchSelection([], 'replace');
      setNotice('Wyczyszczono zaznaczenie szkicu.');
    } else {
      setSelection({ kind: 'document', id: document.id });
      setNotice('Wyczyszczono zaznaczenie.');
    }
  };

  const handleCommandLineSubmit = (rawInput) => {
    const plan = planCommandLineSubmission(rawInput, { command, customization: commandCustomization });
    const { parsed } = plan;
    if (plan.action === 'cancel') {
      handleCommandLineCancel();
      return true;
    }
    if (plan.action === 'confirm-active') {
      const handled = executeCommandEnter();
      appendCommandHistory('', handled ? 'Zatwierdzono aktywne polecenie.' : 'Brak aktywnego polecenia.');
      if (!handled) setNotice('Wpisz polecenie albo uruchom narzędzie z wstążki.');
      return true;
    }
    if (plan.action === 'invalid-length') {
      setNotice('Długość linii musi być dodatnia.');
      appendCommandHistory(parsed.raw, 'Odrzucono: długość musi być dodatnia.');
      return true;
    }
    if (plan.action === 'confirm-segment-length') {
      sketchDynamicLengthRef.current = String(plan.length);
      setCommand((current) => ({ ...current, dynamicLength: String(plan.length) }));
      appendCommandHistory(parsed.raw, `Długość segmentu: ${plan.length} mm.`);
      confirmDynamicSketchSegment();
      return true;
    }
    if (plan.action === 'number-unavailable') {
      setNotice('Wartość liczbowa działa po wskazaniu pierwszego punktu linii lub polilinii.');
      appendCommandHistory(parsed.raw, 'Brak polecenia oczekującego na długość.');
      return true;
    }
    if (plan.action === 'execute-command') {
      const result = executeBasicShortcut(plan.shortcut);
      if (!result) {
        const message = `Polecenie „${parsed.command.label}” nie jest dostępne w bieżącym obszarze.`;
        setNotice(message);
        appendCommandHistory(parsed.raw, message);
        return true;
      }
      appendCommandHistory(parsed.raw, result.disabled
        ? `Narzędzie „${result.label}” jest teraz niedostępne.`
        : `Uruchomiono: ${result.label}.`);
      return true;
    }
    setNotice(`Nieznane polecenie „${parsed.raw}”. Wpisz np. LINE, PLINE, CIRCLE, OFFSET albo TRIM.`);
    appendCommandHistory(parsed.raw, 'Nieznane polecenie.');
    return true;
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const textEntry = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable;
      if (event.key === 'F1') {
        event.preventDefault();
        setLayersOpen(false);
        setBlocksOpen(false);
        setComponentsOpen(false);
        setCommandCustomizationOpen((open) => !open);
        return;
      }
      if (!textEntry && event.key === 'F3' && activeSketchId && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setSketchOptions((current) => ({ ...current, snap: !current.snap }));
        setNotice(`Snap ${sketchOptions.snap ? 'wyłączony' : 'włączony'} · F3.`);
        return;
      }
      if (primaryModifierPressed(event, DESKTOP_PLATFORM) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (projectSearchOpen) setProjectSearchOpen(false);
        else openProjectSearch();
        return;
      }
      if (timelineRename && event.key === 'Escape') {
        event.preventDefault();
        setTimelineRename(null);
        return;
      }
      if (timelineGroupRename && event.key === 'Escape') {
        event.preventDefault();
        setTimelineGroupRename(null);
        return;
      }
      if (!textEntry && !command && selection?.kind === 'feature' && event.key === 'F2' && !readOnly) {
        event.preventDefault();
        beginTimelineRename();
        return;
      }
      if (!textEntry && !command && (event.ctrlKey || event.metaKey) && event.key === 'Enter' && activeSketchId) {
        event.preventDefault();
        finishSketch();
        return;
      }
      if (!textEntry && !command && event.key === 'Escape') {
        event.preventDefault();
        if (activeSketchId) {
          handleSketchSelection([], 'replace');
          setNotice('Wyczyszczono zaznaczenie szkicu.');
        } else {
          setSelection({ kind: 'document', id: document.id });
          setNotice('Wyczyszczono zaznaczenie.');
        }
        return;
      }
      if (!textEntry && !command && !event.ctrlKey && !event.metaKey && !event.altKey && (/^[a-z0-9]$/i.test(event.key) || /^F(?:[4-9]|1[0-2])$/.test(event.key))) {
        if (executeBasicShortcut(event.key.toUpperCase())) event.preventDefault();
        return;
      }
      if (event.key === 'Escape' && command) {
        event.preventDefault();
        cancelActiveCommand();
        return;
      }
      if (event.key === 'Enter' && command) {
        event.preventDefault();
        if (executeCommandEnter({ preferExact: textEntry })) return;
      }
      if (!textEntry && command?.lastPoint && (command.type === 'line' || command.type === 'polyline') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const current = sketchDynamicLengthRef.current;
        if (/^[0-9]$/.test(event.key)) {
          event.preventDefault();
          const next = `${current}${event.key}`;
          sketchDynamicLengthRef.current = next;
          setCommand((value) => ({ ...value, dynamicLength: next }));
          return;
        }
        if ((event.key === '.' || event.key === ',') && !/[.,]/.test(current)) {
          event.preventDefault();
          const next = `${current || '0'}${event.key}`;
          sketchDynamicLengthRef.current = next;
          setCommand((value) => ({ ...value, dynamicLength: next }));
          return;
        }
        if (event.key === 'Backspace' && current) {
          event.preventDefault();
          const next = current.slice(0, -1);
          sketchDynamicLengthRef.current = next;
          setCommand((value) => ({ ...value, dynamicLength: next }));
          return;
        }
      }
      if (primaryModifierPressed(event, DESKTOP_PLATFORM) && command?.type === 'polyline' && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undoSketchSegment();
        return;
      }
      if (primaryModifierPressed(event, DESKTOP_PLATFORM) && !command && !readOnly && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
        event.preventDefault();
        if (event.key.toLowerCase() === 'y' || event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !textEntry && !command && activeSketchId && (selectedSketchEntityIds.length || selectedSketchConstraintId) && !readOnly) {
        event.preventDefault();
        deleteSelectedSketchEntities();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !textEntry && !command && selection?.kind === 'feature' && !readOnly) {
        event.preventDefault();
        requestTimelineDelete();
        return;
      }
      if (primaryModifierPressed(event, DESKTOP_PLATFORM) && event.key.toLowerCase() === 'e' && selectedProfile && !activeSketchId && !readOnly) {
        event.preventDefault();
        openExtrude();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // Command state is the stable boundary for the keyboard handler; command helpers are render-local callbacks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, selectedProfile, activeSketchId, selectedSketchEntityIds, selectedSketchConstraintId, readOnly, history, executeBasicShortcut, projectSearchOpen, sketchOptions.snap]);

  const timelineStatus = new Map(engine.timeline?.map((item) => [item.id, item]));
  const selectedTimelineFeature = selection?.kind === 'feature'
    ? document.features.find((feature) => feature.id === selection.id)
    : null;
  const selectedTimelineIndex = selectedTimelineFeature
    ? document.features.findIndex((feature) => feature.id === selectedTimelineFeature.id)
    : -1;
  const selectedTimelineFeatureGroup = selectedTimelineFeature
    ? document.featureGroups.find((group) => group.featureIds.includes(selectedTimelineFeature.id)) || null
    : null;
  const selectedTimelineFeatureIsRollback = Boolean(selectedTimelineFeature
    && document.timelineRollbackFeatureId === (selectedTimelineFeatureGroup?.featureIds.at(-1) || selectedTimelineFeature.id));
  const selectedTimelineGroup = selection?.kind === 'featureGroup'
    ? document.featureGroups.find((group) => group.id === selection.id) || null
    : null;
  const timelineDeleteCount = timelineDeleteId
    ? dependentTimelineFeatureIds(document, timelineDeleteId).length
    : 0;
  let directManipulator = null;
  if (command?.type === 'transform') {
    const body = engine.bodies.find((item) => item.id === command.targetBodyId) || engine.bodies[0];
    const origin = body?.metrics?.centerOfMass || [0, 0, 0];
    if (command.mode === 'move') directManipulator = { kind: 'move', value: command.x, origin, axis: [1, 0, 0], min: -100000, max: 100000, label: 'Przesuń bryłę', hint: 'Przeciągnij wspólny uchwyt, aby przesunąć bryłę w osi X', onCommit: (value) => updateCommand({ x: String(value) }) };
    else directManipulator = { kind: 'rotate', value: command.angle, origin, axis: [0, 0, 1], min: -360, max: 360, label: 'Obróć bryłę', hint: 'Przeciągnij wspólny uchwyt, aby ustawić obrót wokół osi Z', onCommit: (value) => updateCommand({ angle: String(value) }) };
  } else if (command?.type === 'surfaceExtrude') {
    const sourceSketch = document.sketches.find((sketch) => sketch.id === command.previewFeature?.sketchId);
    const axis = sourceSketch?.plane === 'XZ' ? [0, -1, 0] : sourceSketch?.plane === 'YZ' ? [1, 0, 0] : [0, 0, 1];
    directManipulator = { kind: 'extrude', value: command.distance, origin: [0, 0, 0], axis, min: -100000, max: 100000, label: 'Wyciągnij powierzchnię', hint: 'Przeciągnij uchwyt albo wpisz dokładną odległość', onCommit: (value) => updateCommand({ distance: String(value) }) };
  } else if (command?.type === 'surfaceRevolve') {
    const axes = { X_AXIS: [1, 0, 0], Y_AXIS: [0, 1, 0], Z_AXIS: [0, 0, 1] };
    directManipulator = { kind: 'rotate', value: command.angle, origin: [0, 0, 0], axis: axes[command.axisId] || [0, 1, 0], min: -360, max: 360, label: 'Obróć powierzchnię', hint: 'Przeciągnij uchwyt albo wpisz dokładny kąt', onCommit: (value) => updateCommand({ angle: String(value) }) };
  } else if (command?.type === 'offsetFace') {
    const referenceId = command.previewFeature?.referenceIds?.[0];
    const reference = command.topologyReferences?.[0] || document.references.find((item) => item.id === referenceId);
    directManipulator = { kind: 'offsetFace', value: command.distance, origin: reference?.descriptor?.center || [0, 0, 0], axis: reference?.descriptor?.normal || [0, 0, 1], min: -100000, max: 100000, label: 'Offset Face', hint: 'Przeciągnij wspólny uchwyt, aby odsunąć wskazaną ścianę', onCommit: (value) => updateCommand({ distance: String(value) }) };
  }
  const draftProfile = command?.type === 'rectangle' && command.definition === 'center'
    ? { type: 'rectangle', geometry: { width: command.width, height: command.height, x: command.x, y: command.y } }
    : command?.type === 'circle' && command.definition === 'centerRadius'
      ? { type: 'circle', geometry: { diameter: command.diameter, x: command.x, y: command.y } }
      : null;
  const sketchToolPrompt = pointerPromptForCommand(command);
  const bodyCountLabel = `${engine.bodies.length} ${engine.bodies.length === 1 ? 'bryła' : 'brył'}`;
  const hasSketchProfile = document.sketches.some((sketch) => sketch.profiles.length > 0);
  const lastSketch = document.sketches.at(-1) || null;
  const readyEngineLabel = command?.previewFeature
    ? `Podgląd operacji · ${bodyCountLabel}`
    : activeSketchId
      ? `Krok 1/3 · Szkic 2D · ${document.sketches.find((sketch) => sketch.id === activeSketchId)?.plane || 'XY'}`
      : selectedProfile
        ? 'Krok 2/3 · Profil gotowy do wyciągnięcia'
        : engine.bodies.length > 0
          ? `Model gotowy · ${bodyCountLabel}`
          : hasSketchProfile
            ? 'Krok 2/3 · Wybierz profil i użyj Wyciągnij'
            : 'Krok 1/3 · Zacznij od szkicu 2D';
  const workspaceGuide = engine.status !== 'ready'
    ? {
      title: engine.status === 'computing' ? 'Przeliczanie modelu' : engine.status === 'loading' ? 'Uruchamianie silnika CAD' : 'Model wymaga poprawy',
      text: engine.status === 'error' ? engine.error : 'Poczekaj na zakończenie obliczeń.',
    }
    : workspace === 'tools'
      ? { title: 'ZARZĄDZAJ · projekt i jego historia', text: 'Parametry, wersje, zależności i struktura projektu są zebrane w jednym miejscu.', action: 'Wróć do projektowania', onAction: () => switchWorkspace('solid') }
      : workspace === 'solid' && lastSketch && !engine.bodies.length
            ? hasSketchProfile
              ? { title: 'KROK 2 · utwórz bryłę z zamkniętego szkicu', text: selectedProfile ? 'Profil jest zaznaczony. Kliknij Wyciągnij i podaj wysokość.' : 'Kliknij wnętrze zamkniętego profilu, a następnie wybierz Wyciągnij.', action: selectedProfile ? 'Wyciągnij profil' : `Edytuj: ${lastSketch.name}`, onAction: selectedProfile ? openExtrude : () => editSketch(lastSketch.id) }
              : { title: 'KROK 1 · dokończ szkic 2D', text: 'Szkic nie ma jeszcze zamkniętego obrysu. Domknij linie, zakończ szkic, potem zaznacz jego wnętrze.', action: `Edytuj: ${lastSketch.name}`, onAction: () => editSketch(lastSketch.id) }
            : { title: 'PROJEKTUJ · szkic 2D i model 3D', text: readyEngineLabel };
  const startPageVisible = workspace === 'solid' && !document.sketches.length && !engine.bodies.length && !command && !readOnly;
  const showProjectBrowser = browserOpen && workspace !== 'drawing' && !startPageVisible;
  let adaptiveContext = null;
  if (!command && activeSketchId && (selectedSketchEntityIds.length || selectedSketchConstraintId)) {
    const recommended = [];
    const more = [];
    if (canAddCollinear) recommended.push({ icon: Minus, label: 'Współliniowe', onClick: () => addSelectedSketchConstraint('collinear'), primary: true });
    if (canAddSymmetry) recommended.push({ icon: Frame, label: 'Symetria', onClick: () => addSelectedSketchConstraint('symmetry'), primary: true });
    if (canAddCurvature) recommended.push({ icon: CircleDotDashed, label: 'Krzywizna G2', onClick: () => addSelectedSketchConstraint('curvature'), primary: true });
    if (canAddOrdinate) {
      recommended.push({ icon: Ruler, label: 'Wymiar X', onClick: () => openSketchDimension('ordinateX'), primary: true });
      more.push({ icon: Ruler, label: 'Wymiar Y', onClick: () => openSketchDimension('ordinateY') });
    }
    if (canAddArcLength) recommended.push({ icon: RotateCw, label: 'Długość łuku', onClick: () => openSketchDimension('arcLength'), primary: true });
    if (selectedSketchEntityIds.length) {
      recommended.push({ icon: Move, label: 'Przesuń', onClick: openSketchMove });
      more.push({ icon: RotateCw, label: 'Transformuj', onClick: openSketchTransform });
    }
    recommended.push({ icon: Trash2, label: 'Usuń', onClick: deleteSelectedSketchEntities, danger: true });
    adaptiveContext = {
      title: selectedSketchConstraintId ? 'Wybrany więz' : `${selectedSketchEntityIds.length} ${selectedSketchEntityIds.length === 1 ? 'element szkicu' : 'elementy szkicu'}`,
      subtitle: 'Dostępne są tylko pasujące działania',
      actions: recommended.slice(0, 4),
      moreActions: [...recommended.slice(4), ...more],
      onClear: () => handleSketchSelection([], 'replace'),
    };
  } else if (!command && !activeSketchId && workspace === 'solid') {
    const clearModelSelection = () => setSelection({ kind: 'document', id: document.id });
    if (selectedProfile) {
      adaptiveContext = {
        title: 'Zamknięty profil',
        subtitle: 'Utwórz z niego bryłę albo powierzchnię',
        actions: [
          { icon: ExtrudeCadIcon, label: 'Wyciągnij', onClick: openExtrude, primary: true },
          { icon: PressPullCadIcon, label: 'Naciśnij / wyciągnij', onClick: openPressPull },
          { icon: PlaneCadIcon, label: 'Patch', onClick: openSurfacePatch },
          { icon: RevolveCadIcon, label: 'Bryła obrotowa', onClick: openRevolve },
        ],
        moreActions: [
          { icon: ExtrudeCadIcon, label: 'Wyciągnij powierzchnię', onClick: openSurfaceExtrude },
          { icon: RevolveCadIcon, label: 'Obróć powierzchnię', onClick: openSurfaceRevolve },
          { icon: SweepCadIcon, label: 'Powierzchnia po ścieżce', onClick: openSurfaceSweep },
          { icon: LoftCadIcon, label: 'Powierzchnia przejściowa', onClick: openSurfaceLoft },
          { icon: SweepCadIcon, label: 'Po ścieżce', onClick: openSweep },
          { icon: LoftCadIcon, label: 'Loft', onClick: openLoft },
        ],
        onClear: clearModelSelection,
      };
    } else if (selectedFaceItems.length) {
      adaptiveContext = {
        title: selectedFaceItems.length === 1 ? 'Ściana' : `${selectedFaceItems.length} ściany`,
        subtitle: 'Modeluj bezpośrednio na zaznaczonej geometrii',
        actions: [
          ...(selectedFaceItems.length === 1 ? [{ icon: SketchCadIcon, label: 'Szkic na ścianie', onClick: startSketch, primary: true }] : []),
          ...(canPressPull ? [{ icon: PressPullCadIcon, label: 'Naciśnij / wyciągnij', onClick: openPressPull }] : []),
          ...(selectedFaceItems.length === 1 ? [{ icon: OffsetFaceCadIcon, label: 'Odsuń ścianę', onClick: openOffsetFace }] : []),
        ],
        moreActions: [
          ...(selectedFaceItems.length === 1 ? [{ icon: CircleDotDashed, label: 'Boss', onClick: openPlasticBoss }, { icon: Blocks, label: 'Snap-fit', onClick: openPlasticSnapFit }, { icon: Grid2X2, label: 'Grille', onClick: openPlasticGrille }] : []),
          { icon: ShellCadIcon, label: 'Powłoka', onClick: openShell },
          { icon: DraftCadIcon, label: 'Pochylenie', onClick: openDraft },
          { icon: DeleteFaceCadIcon, label: 'Usuń i napraw', onClick: openDeleteFace, danger: true },
          ...(selectedFaceItems.length === 2 ? [{ icon: ReplaceFaceCadIcon, label: 'Zastąp ścianę', onClick: openReplaceFace }] : []),
        ],
        onClear: clearModelSelection,
      };
    } else if (selectedEdgeItems.length) {
      adaptiveContext = {
        title: selectedSurfaceEdgeBody ? 'Krawędź powierzchni' : selectedEdgeItems.length === 1 ? 'Krawędź' : `${selectedEdgeItems.length} krawędzie`,
        subtitle: selectedSurfaceEdgeBody ? 'Przedłuż otwartą powierzchnię' : 'Zmień wybrane krawędzie bryły',
        actions: selectedSurfaceEdgeBody
          ? [{ icon: Scissors, label: 'Przedłuż powierzchnię', onClick: openSurfaceExtend, primary: true }]
          : [
            { icon: FilletCadIcon, label: 'Zaokrąglij', onClick: () => openEdgeCommand('fillet'), primary: true },
            { icon: ChamferCadIcon, label: 'Fazuj', onClick: () => openEdgeCommand('chamfer') },
          ],
        moreActions: [],
        onClear: clearModelSelection,
      };
    } else if (selectedBodyIds.length) {
      const surfaceSelection = selectedBodyIds.length === 1 && selectedSurfaceBody;
      const multipleSurfaceSelection = canStitchSelectedSurfaces;
      const trimSelection = canTrimSelectedSurface;
      adaptiveContext = {
        title: surfaceSelection ? 'Powierzchnia' : multipleSurfaceSelection ? `${selectedBodyIds.length} powierzchnie` : trimSelection ? 'Powierzchnia + bryła' : selectedBodyIds.length === 1 ? 'Bryła' : `${selectedBodyIds.length} bryły`,
        subtitle: surfaceSelection ? 'Zamień ją w bryłę albo zmień położenie' : multipleSurfaceSelection ? 'Połącz wspólne krawędzie w jeden płaszcz' : trimSelection ? 'Przytnij powierzchnię bryłą' : selectedBodyIds.length > 1 ? 'Wykonaj operację na wspólnym wyborze' : 'Przekształć albo powiel bryłę',
        actions: [
          ...(surfaceSelection ? [{ icon: ShellCadIcon, label: 'Pogrub', onClick: openThickenSurface, primary: true }, { icon: Layers3, label: 'Odsuń powierzchnię', onClick: openSurfaceOffset }] : []),
          ...(multipleSurfaceSelection ? [{ icon: Layers3, label: 'Zszyj powierzchnie', onClick: openSurfaceStitch, primary: true }] : []),
          ...(trimSelection ? [{ icon: Scissors, label: 'Przytnij powierzchnię', onClick: openSurfaceTrim, primary: true }] : []),
          ...(canBooleanSelectedBodies ? [{ icon: BooleanCadIcon, label: 'Połącz / odejmij', onClick: openBoolean, primary: true }] : []),
          ...(selectedFacetedBrepFeature ? [{ icon: ScanSearch, label: 'Przywróć siatkę', onClick: restoreSelectedBrepToMesh, primary: true }] : []),
          ...(selectedBodyIds.length === 1 ? [
            { icon: MoveBodyCadIcon, label: 'Przesuń', onClick: () => openTransform('move'), primary: !surfaceSelection },
            { icon: RotateBodyCadIcon, label: 'Obróć', onClick: () => openTransform('rotate') },
            ...(!surfaceSelection ? [{ icon: PatternCadIcon, label: 'Szyk', onClick: openPattern }] : []),
          ] : []),
        ],
        moreActions: selectedBodyIds.length === 1 ? [
          ...(selectedMeshBody ? [{ icon: ScanSearch, label: 'Narzędzia siatki', onClick: openMeshTools }] : []),
          ...(!surfaceSelection ? [{ icon: MassCadIcon, label: 'Właściwości masy', onClick: openMassProperties }, { icon: SplitBodyCadIcon, label: 'Podziel bryłę', onClick: openSplitBody }] : []),
          { icon: Trash2, label: surfaceSelection ? 'Usuń powierzchnię' : 'Usuń bryłę', onClick: requestSelectedBodyDelete, danger: true },
        ] : [],
        onClear: clearModelSelection,
      };
    } else if (['sketch', 'feature', 'constructionPlane', 'constructionAxis', 'constructionPoint'].includes(selection?.kind)) {
      const selectedHistoryFeature = selection.kind === 'feature' ? document.features.find((feature) => feature.id === selection.id) : null;
      const historyFeatureEditable = !['sheetUnfold', 'sheetRefold'].includes(selectedHistoryFeature?.type);
      adaptiveContext = {
        title: selection.kind === 'sketch' ? 'Szkic' : selection.kind === 'feature' ? 'Operacja historii' : 'Geometria konstrukcyjna',
        subtitle: historyFeatureEditable ? 'Edytuj zaznaczony element projektu' : 'Stan blachy sterowany kolejnością osi czasu',
        actions: [
          ...(selection.kind === 'constructionPlane' ? [{ icon: SketchCadIcon, label: 'Szkic na płaszczyźnie', onClick: startSketch, primary: true }] : []),
          ...(historyFeatureEditable ? [{ icon: EditFeatureCadIcon, label: 'Edytuj', onClick: editSelection, primary: selection.kind !== 'constructionPlane' }] : []),
        ],
        moreActions: [],
        onClear: clearModelSelection,
      };
    }
  }

  return (
    <ToolHelpContext.Provider value={toolHelpContext}>
    <section className={`modeling-shell platform-${DESKTOP_PLATFORM} ${workspace === 'drawing' ? 'drawing-mode' : workspace === 'tools' ? 'tools-mode' : activeSketchId ? 'sketch-mode' : document.features.length ? '' : 'timeline-empty'} ${startPageVisible ? 'start-page-mode' : ''}`} aria-label="Modelowanie parametryczne MadCAD">
      <header className="modeling-titlebar">
        <div className="app-menu" role="toolbar" aria-label="Plik i przeglądarka projektu">
          <button id="fileMenuBtn" className={fileMenuOpen ? 'active' : ''} type="button" aria-label="Menu Plik" aria-expanded={fileMenuOpen} aria-controls="file-backstage" title="Projekt, import, eksport i druk" onClick={() => setFileMenuOpen((open) => !open)}><FileText size={15} /><span>Plik</span></button>
          <span className="app-menu-separator" aria-hidden="true" />
          <button id="newProjectBtn" type="button" aria-label="Nowy projekt" title="Nowy projekt" onClick={createNew}><FilePlus2 size={15} /><span>Nowy</span></button>
          <button id="openProjectBtn" type="button" aria-label="Otwórz projekt" title="Otwórz projekt" onClick={requestOpenProject}><FolderOpen size={15} /><span>Otwórz</span></button>
          <button id="saveProjectBtn" type="button" aria-label={readOnly ? 'Zapis jest zablokowany dla projektu z nowszej wersji.' : dirty ? 'Zapisz zmiany' : 'Projekt jest zapisany'} title={readOnly ? 'Zapis jest zablokowany dla projektu z nowszej wersji.' : dirty ? 'Zapisz zmiany' : 'Projekt jest zapisany'} disabled={readOnly} onClick={saveProject}><Save size={15} /><span>Zapisz</span></button>
          <span className="app-menu-separator" aria-hidden="true" />
          {workspace !== 'drawing' && <button className={browserOpen ? 'active' : ''} type="button" aria-label="Pokaż lub ukryj przeglądarkę" aria-pressed={browserOpen} title="Pokaż lub ukryj przeglądarkę" onClick={() => setBrowserOpen((open) => !open)}><Grid2X2 size={15} /><span>Panel</span></button>}
          <button id="projectSearchBtn" className={projectSearchOpen ? 'active' : ''} type="button" aria-label="Idź do obiektu projektu" aria-pressed={projectSearchOpen} title="Wyszukaj obiekt w projekcie · Ctrl/⌘ K" onClick={() => { if (projectSearchOpen) setProjectSearchOpen(false); else openProjectSearch(); }}><Search size={15} /><span>Szukaj</span></button>
        </div>
        <input ref={fileInputRef} hidden type="file" accept=".madcad,.json,application/json" onChange={openProject} />
        <input ref={importInputRef} hidden type="file" accept=".step,.stp,.stl,.3mf,model/step,model/stl,model/3mf" onChange={chooseModelImport} />
        <input ref={sketchImportInputRef} hidden type="file" accept=".svg,.dxf,image/svg+xml,application/dxf" onChange={chooseSketchImport} />
        <div className="document-tab" title={currentPath || (dirty ? 'Projekt zawiera niezapisane zmiany' : 'Projekt zapisany')}><Box size={15} /><input value={document.name} aria-label="Nazwa projektu" disabled={readOnly} onChange={(event) => commit((next) => { next.name = event.target.value; })} />{readOnly ? <span className="read-only-badge">TYLKO ODCZYT · v{documentAccess.sourceVersion}</span> : dirty ? <span role="img" aria-label="Niezapisane zmiany">*</span> : null}</div>
        <div className="title-actions">
          <button id="undoProjectBtn" type="button" disabled={readOnly || !history.canUndo} onClick={history.undo} title="Cofnij"><Undo2 size={15} /></button>
          <button id="redoProjectBtn" type="button" disabled={readOnly || !history.canRedo} onClick={history.redo} title="Ponów"><Redo2 size={15} /></button>
          <button id="commandShortcutsBtn" className={commandCustomizationOpen ? 'active' : ''} type="button" aria-pressed={commandCustomizationOpen} title="Skróty klawiszowe i polecenia · F1" onClick={() => { setLayersOpen(false); setBlocksOpen(false); setComponentsOpen(false); setCommandCustomizationOpen((open) => !open); }}><Keyboard size={15} /><span>Skróty</span></button>
          <details className="app-help-menu" ref={helpMenuRef}>
            <summary title="Pomoc i ustawienia"><CircleHelp size={15} /><span>Pomoc</span><ChevronDown size={12} /></summary>
            <div>
              <button type="button" title="Samouczek pierwszego projektu CAD" aria-label="Samouczek pierwszego projektu CAD" onClick={(event) => { setTutorialOpen(true); event.currentTarget.closest('details')?.removeAttribute('open'); }}><CircleHelp size={15} /><span>Samouczek</span></button>
              <button id="checkUpdatesBtn" type="button" title="Sprawdź aktualizacje" onClick={(event) => { void checkForUpdates(false); event.currentTarget.closest('details')?.removeAttribute('open'); }}><HardDriveDownload size={15} /><span>Aktualizacje</span></button>
              <button id="licenseInfoBtn" type="button" title="Licencja i informacje" onClick={(event) => { setLicenseInfoOpen(true); event.currentTarget.closest('details')?.removeAttribute('open'); }}><CircleHelp size={15} /><span>Licencja i informacje</span></button>
              <label className="language-select" title="Język interfejsu"><span>Język</span><select aria-label="Język interfejsu" value={language} onChange={(event) => { void changeAppLanguage(event.target.value); }}><option value="pl">Polski</option><option value="en">English</option></select></label>
            </div>
          </details>
          <div className="brand-mark" title="MadCAD"><img src={madcadIconUrl} alt="MadCAD" /></div>
        </div>
      </header>

      {fileMenuOpen && <div className="file-backstage-layer" id="file-backstage" role="dialog" aria-modal="true" aria-label="Plik">
        <button className="file-backstage-dismiss" type="button" aria-label="Zamknij menu Plik" onClick={() => setFileMenuOpen(false)} />
        <aside className="file-backstage">
          <header><div><strong>PLIK</strong><span>Projekt, import, eksport i druk</span></div><button type="button" aria-label="Zamknij menu Plik" title="Zamknij" onClick={() => setFileMenuOpen(false)}><X size={18} /></button></header>
          <div className="file-backstage-content">
            <section><h2>PROJEKT</h2>
              <button type="button" onClick={() => { setFileMenuOpen(false); createNew(); }}><FilePlus2 /><span><strong>Nowy projekt</strong><small>Rozpocznij pusty dokument MadCAD.</small></span></button>
              <button type="button" onClick={() => { setFileMenuOpen(false); requestOpenProject(); }}><FolderOpen /><span><strong>Otwórz projekt</strong><small>Wczytaj plik .madcad.</small></span></button>
              <button type="button" disabled={readOnly} onClick={() => { setFileMenuOpen(false); void saveProject(); }}><Save /><span><strong>Zapisz projekt</strong><small>{dirty ? 'Zapisz bieżące zmiany.' : 'Projekt jest już zapisany.'}</small></span></button>
            </section>
            <section><h2>IMPORT</h2>
              <button id="fileImportModelBtn" type="button" disabled={readOnly || modelImportBusy} onClick={() => { setFileMenuOpen(false); window.requestAnimationFrame(() => importInputRef.current?.click()); }}><Upload /><span><strong>Model 3D</strong><small>STEP, STL albo 3MF.</small></span></button>
              <button id="fileImportSketchBtn" type="button" disabled={readOnly || !activeSketchId} onClick={() => { setFileMenuOpen(false); window.requestAnimationFrame(() => sketchImportInputRef.current?.click()); }}><Upload /><span><strong>Szkic 2D</strong><small>SVG albo DXF · dostępne podczas edycji szkicu.</small></span></button>
              <button id="fileImportDwgBtn" type="button" disabled={readOnly || !activeSketchId} onClick={() => { setFileMenuOpen(false); void chooseDwgSketchImport(); }}><Upload /><span><strong>Szkic DWG</strong><small>Lokalna konwersja podczas edycji szkicu.</small></span></button>
            </section>
            <section><h2>EKSPORT MODELU</h2>
              <button id="fileExportStepBtn" type="button" disabled={!engine.bodies.length || engine.status !== 'ready' || containsImportedMesh} onClick={() => { setFileMenuOpen(false); void exportModel('step'); }}><FileBox /><span><strong>STEP</strong><small>Dokładna geometria CAD B-Rep.</small></span></button>
              <button id="fileExportStlBtn" type="button" disabled={!engine.bodies.length || engine.status !== 'ready'} onClick={() => { setFileMenuOpen(false); void exportModel('stl'); }}><HardDriveDownload /><span><strong>STL</strong><small>Siatka modelu 3D.</small></span></button>
              <button id="fileExport3mfBtn" type="button" disabled={!engine.bodies.length || engine.status !== 'ready'} onClick={() => { setFileMenuOpen(false); void exportModel('3mf'); }}><FileDown /><span><strong>3MF</strong><small>Siatka 3D z jednostkami.</small></span></button>
            </section>
            <section><h2>RYSUNEK TECHNICZNY</h2>
              <button type="button" disabled={!activeDrawingSheet?.views.length || !window.desktopApp?.openPrintPreviewWindow} onClick={() => { setFileMenuOpen(false); void previewActiveDrawing(); }}><Eye /><span><strong>Podgląd wydruku</strong><small>Arkusz 2D w skali 1:1.</small></span></button>
              <button id="fileExportPdfBtn" type="button" disabled={!activeDrawingSheet?.views.length} onClick={() => { setFileMenuOpen(false); void exportActiveDrawingPdf(); }}><FileText /><span><strong>PDF</strong><small>Zapisz aktywny arkusz techniczny.</small></span></button>
              <button id="fileExportDxfBtn" type="button" disabled={!activeDrawingSheet?.views.length} onClick={() => { setFileMenuOpen(false); exportActiveDrawingDxf(); }}><FileText /><span><strong>DXF</strong><small>Eksport geometrii arkusza w mm.</small></span></button>
            </section>
            <section className="file-backstage-print"><h2>DRUK 3D</h2>
              <button id="filePrint3dBtn" type="button" onClick={openPrintPreparation}><Printer /><span><strong>Przygotuj druk 3D</strong><small>Stół, orientacja, kontrola modelu i slicer.</small></span><ArrowRight /></button>
            </section>
          </div>
        </aside>
      </div>}

      <section className="command-area">
        <div className="command-ribbon">
          <nav className="workspace-tabs" aria-label="Obszary robocze" role="tablist">
            {activeSketchId ? <button className="active" type="button" role="tab" aria-selected="true" title="Aktywny obszar edycji szkicu 2D.">SZKICUJ</button> : MAIN_TABS.map((item, index) => <button key={item.id} className={workspace === item.id ? 'active' : ''} type="button" role="tab" aria-selected={workspace === item.id} tabIndex={workspace === item.id ? 0 : -1} title={item.id === 'solid' ? 'Szkicuj, twórz, modyfikuj i sprawdzaj geometrię.' : item.id === 'drawing' ? 'Przygotuj arkusz techniczny 2D.' : 'Parametry, wersje, struktura i kontrola projektu.'} onKeyDown={(event) => handleWorkspaceTabKeyDown(event, index)} onClick={() => switchWorkspace(item.id)}>{item.label}</button>)}
          </nav>
          <ResponsiveRibbon key={licenseInfoOpen ? 'license-open' : 'license-closed'} language={language}>
            {activeSketchId ? (
              <>
                <RibbonGroup label="UTWÓRZ">
                  <ToolButton icon={Minus} label="Linia" onClick={() => openSketchPath('line')} primary disabled={readOnly} />
                  <ToolButton icon={Move} label="Polilinia" onClick={() => openSketchPath('polyline')} disabled={readOnly} />
                  <ToolButton icon={Square} label="Prostokąt" onClick={() => openProfileCommand('rectangle')} disabled={readOnly} />
                  <ToolButton icon={Circle} label="Okrąg" onClick={() => openProfileCommand('circle')} disabled={readOnly} />
                  {expandedSketchRibbon && <ToolButton icon={Rotate3d} label="Łuk" onClick={() => openMechanicalShape('arc')} disabled={readOnly} />}
                  <ToolMenuButton icon={Shapes} label="Więcej kształtów" description="Łuki, wielokąty, elipsy i pozostałe kształty szkicu." items={[
                    ...(!expandedSketchRibbon ? [{ icon: Rotate3d, label: 'Łuk', onClick: () => openMechanicalShape('arc'), disabled: readOnly }] : []),
                    { icon: RotateCw, label: 'Łuk styczny', onClick: () => setCommand((current) => current?.type === 'polyline' ? { ...current, segmentMode: 'tangentArc' } : current), disabled: readOnly || command?.type !== 'polyline' || !command.segmentIds.length, disabledReason: 'Najpierw rozpocznij polilinię i dodaj pierwszy odcinek.' },
                    { icon: Hexagon, label: 'Wielokąt', onClick: () => openMechanicalShape('polygon'), disabled: readOnly },
                    { icon: Shapes, label: 'Elipsa', onClick: () => openMechanicalShape('ellipse'), disabled: readOnly },
                    { icon: Frame, label: 'Slot', displayLabel: 'Rowek', onClick: () => openMechanicalShape('slot'), disabled: readOnly },
                    { icon: ScanSearch, label: 'Spline', displayLabel: 'Krzywa spline', onClick: () => openMechanicalShape('spline'), disabled: readOnly },
                    { icon: ScanSearch, label: 'Conic', displayLabel: 'Krzywa stożkowa', onClick: () => openMechanicalShape('conic'), disabled: readOnly },
                    { icon: CircleDotDashed, label: 'Punkt', onClick: () => openMechanicalShape('point'), disabled: readOnly },
                  ]} />
                  {Boolean(document.sketches.find((sketch) => sketch.id === activeSketchId)?.entities?.length) && <ToolMenuButton icon={Box} label="Utwórz 3D" description="Utwórz bryłę z otwartej geometrii aktywnego szkicu." items={[
                    { icon: Box, label: 'Thin Extrude', displayLabel: 'Wyciągnij cienkościennie', onClick: openExtrude, disabled: readOnly || !canExtrudeOpenChain, disabledReason: 'Zaznacz ciągły otwarty łańcuch.' },
                    { icon: ExtrudeCadIcon, label: 'Surface Extrude', displayLabel: 'Wyciągnij powierzchnię', onClick: openSurfaceExtrude, disabled: readOnly || !canExtrudeOpenChain, disabledReason: 'Zaznacz ciągły otwarty łańcuch.' },
                    { icon: RevolveCadIcon, label: 'Surface Revolve', displayLabel: 'Obróć powierzchnię', onClick: openSurfaceRevolve, disabled: readOnly || !canExtrudeOpenChain, disabledReason: 'Zaznacz ciągły otwarty łańcuch.' },
                    { icon: SweepCadIcon, label: 'Surface Sweep', displayLabel: 'Powierzchnia po ścieżce', onClick: openSurfaceSweep, disabled: readOnly || !canExtrudeOpenChain || !sweepPathOptions(activeSketchId).length, disabledReason: 'Zaznacz profil i przygotuj osobny szkic ścieżki.' },
                    { icon: Frame, label: 'Rib/Web', displayLabel: 'Żebro / ścianka', onClick: openRib, disabled: readOnly || !canCreateRib, disabledReason: 'Zaznacz otwartą linię połączoną z bryłą.' },
                    { icon: Cylinder, label: 'Pipe', displayLabel: 'Rura', onClick: openPipe, disabled: readOnly || !canExtrudeOpenChain, disabledReason: 'Zaznacz ciągłą otwartą ścieżkę.' },
                  ]} />}
                </RibbonGroup>
                <RibbonGroup label="ZMIEŃ">
                  <ToolButton icon={Scissors} label="Trim" displayLabel="Przytnij" onClick={() => setCommand((current) => current?.type === 'trimSketch' ? null : { type: 'trimSketch' })} primary={command?.type === 'trimSketch'} disabled={readOnly} />
                  <ToolMenuButton icon={Copy} label="Modyfikuj" description="Przedłużanie, dzielenie, odsuwanie i dokładne przekształcenia." items={[
                    { icon: Maximize2, label: 'Extend', displayLabel: 'Przedłuż', onClick: () => setCommand((current) => current?.type === 'extendSketch' ? null : { type: 'extendSketch' }), disabled: readOnly },
                    { icon: Minus, label: 'Break', displayLabel: 'Podziel', onClick: () => setCommand((current) => current?.type === 'breakSketch' ? null : { type: 'breakSketch' }), disabled: readOnly },
                    { icon: Copy, label: 'Offset', displayLabel: 'Odsuń', onClick: openSketchOffset, disabled: readOnly || (!selectedSketchEntityIds.length && !activeOffsetProfile), disabledReason: 'Zaznacz krzywą albo profil.' },
                    { icon: Move3d, label: 'Przesuń', onClick: openSketchMove, disabled: readOnly || !selectedSketchEntityIds.length, disabledReason: 'Zaznacz geometrię szkicu.' },
                    { icon: CircleDotDashed, label: 'Fillet szkicu', displayLabel: 'Zaokrąglij narożnik', onClick: () => openSketchCorner('fillet'), disabled: readOnly || selectedSketchEntityIds.length !== 2, disabledReason: 'Zaznacz dokładnie dwie stykające się linie.' },
                    { icon: Triangle, label: 'Faza szkicu', displayLabel: 'Fazuj narożnik', onClick: () => openSketchCorner('chamfer'), disabled: readOnly || selectedSketchEntityIds.length !== 2, disabledReason: 'Zaznacz dokładnie dwie stykające się linie.' },
                    { icon: RotateCw, label: 'Transformuj', onClick: openSketchTransform, disabled: readOnly || !selectedSketchEntityIds.length, disabledReason: 'Zaznacz geometrię szkicu.' },
                    { icon: Grid2X2, label: 'Szyk szkicu', onClick: openSketchPattern, disabled: readOnly || !selectedSketchEntityIds.length, disabledReason: 'Zaznacz geometrię szkicu.' },
                  ]} />
                  <ToolButton icon={X} label="Usuń" onClick={deleteSelectedSketchEntities} disabled={readOnly || (!selectedSketchEntityIds.length && !selectedSketchConstraintId)} disabledReason="Zaznacz geometrię albo więz." />
                </RibbonGroup>
                <RibbonGroup label="WIĄZANIA">
                  <ToolButton icon={ScanSearch} label="Project" displayLabel="Rzutuj" onClick={projectSelectedTopology} primary={command?.type === 'projectSketch'} disabled={readOnly} />
                  <ToolMenuButton icon={Frame} label="Więzy" description="Zaawansowane więzy geometryczne zaznaczonej geometrii." items={[
                    { icon: Minus, label: 'Współliniowe', onClick: () => addSelectedSketchConstraint('collinear'), disabled: readOnly || !canAddCollinear, disabledReason: 'Zaznacz dwie linie.' },
                    { icon: Frame, label: 'Symetria', onClick: () => addSelectedSketchConstraint('symmetry'), disabled: readOnly || !canAddSymmetry, disabledReason: 'Zaznacz geometrię i oś symetrii.' },
                    { icon: CircleDotDashed, label: 'Krzywizna G2', onClick: () => addSelectedSketchConstraint('curvature'), disabled: readOnly || !canAddCurvature, disabledReason: 'Zaznacz dwie zgodne krzywe.' },
                  ]} />
                  <ToolMenuButton icon={Ruler} label="Wymiary" description="Wymiary współrzędnych i długości łuku." items={[
                    { icon: Ruler, label: 'Ordinate X', displayLabel: 'Współrzędna X', onClick: () => openSketchDimension('ordinateX'), disabled: readOnly || !canAddOrdinate, disabledReason: 'Zaznacz punkt szkicu.' },
                    { icon: Ruler, label: 'Ordinate Y', displayLabel: 'Współrzędna Y', onClick: () => openSketchDimension('ordinateY'), disabled: readOnly || !canAddOrdinate, disabledReason: 'Zaznacz punkt szkicu.' },
                    { icon: RotateCw, label: 'Długość łuku', onClick: () => openSketchDimension('arcLength'), disabled: readOnly || !canAddArcLength, disabledReason: 'Zaznacz łuk.' },
                  ]} />
                </RibbonGroup>
                <RibbonGroup label="ORGANIZUJ">
                  <ToolMenuButton icon={Layers3} label="Warstwy i bloki" description="Porządkuj geometrię szkicu za pomocą warstw i bloków wielokrotnego użytku." items={[
                    { icon: Layers3, label: 'Warstwy', onClick: () => { setBlocksOpen(false); setComponentsOpen(false); setLayersOpen(true); } },
                    { icon: Blocks, label: 'Bloki', onClick: () => { setLayersOpen(false); setComponentsOpen(false); setBlocksOpen(true); } },
                  ]} />
                </RibbonGroup>
                <RibbonGroup label="ZAKOŃCZ SZKIC"><ToolButton icon={Check} label="Zakończ szkic" onClick={finishSketch} primary /></RibbonGroup>
              </>
            ) : workspace === 'drawing' ? (
              <>
                <RibbonGroup label="ARKUSZ"><ToolButton icon={FilePlus2} label="Nowy arkusz" onClick={createDrawingSheetInDocument} disabled={readOnly} primary /><ToolMenuButton icon={FileText} label="Ustawienia" description="Format, tabliczka rysunkowa, rewizje i usuwanie arkusza." items={[
                  { icon: FileText, label: 'Tabliczka rysunkowa', onClick: () => setDrawingPropertyFocus({ section: 'title-block', token: Date.now() }), disabled: !activeDrawingSheet },
                  { icon: History, label: 'Rewizje arkusza', onClick: () => setDrawingPropertyFocus({ section: 'revisions', token: Date.now() }), disabled: !activeDrawingSheet },
                  { icon: Trash2, label: 'Usuń arkusz', onClick: deleteActiveDrawingSheet, disabled: readOnly || !activeDrawingSheet },
                ]} /></RibbonGroup>
                <RibbonGroup label="WIDOKI"><ToolButton icon={FileText} label="Szkic 2D" onClick={addSketchDrawingView} disabled={readOnly || !activeDrawingSheet || !drawableSketches.length} description="Umieść szkic bezpośrednio na arkuszu, bez tworzenia bryły 3D." primary /><ToolButton icon={Frame} label="Model 3D" onClick={addBaseDrawingView} disabled={readOnly || !activeDrawingSheet || !engine.bodies.length} description="Utwórz skojarzony rzut modelu 3D." /><ToolMenuButton icon={SectionCadIcon} label="Widoki zależne" description="Dodaj rzut, przekrój lub detal do wybranego widoku." items={[
                  { icon: FileText, label: 'Rzut', onClick: () => addDerivedDrawingView('projected'), disabled: readOnly || !selectedDrawingView || selectedDrawingIsSketch },
                  { icon: SectionCadIcon, label: 'Przekrój', onClick: () => addDerivedDrawingView('section'), disabled: readOnly || !selectedDrawingView || selectedDrawingIsSketch || selectedDrawingView?.orientation === 'isometric' },
                  { icon: ScanSearch, label: 'Detal', onClick: () => addDerivedDrawingView('detail'), disabled: readOnly || !selectedDrawingView || selectedDrawingIsSketch },
                  { icon: Trash2, label: 'Usuń widok', onClick: deleteSelectedDrawingView, disabled: readOnly || !selectedDrawingView },
                ]} /></RibbonGroup>
                <RibbonGroup label="OPISZ"><ToolMenuButton icon={Ruler} label="Wymiary" description="Dodaj skojarzony wymiar poziomy albo pionowy." items={[
                  { icon: Ruler, label: 'Wymiar X', onClick: () => addDrawingAnnotation('dimension-horizontal'), disabled: readOnly || !selectedDrawingView },
                  { icon: Ruler, label: 'Wymiar Y', onClick: () => addDrawingAnnotation('dimension-vertical'), disabled: readOnly || !selectedDrawingView },
                ]} /><ToolMenuButton icon={CircleDotDashed} label="Osie i środki" description="Dodaj oś symetrii albo znacznik środka." items={[
                  { icon: Minus, label: 'Oś', onClick: () => addDrawingAnnotation('centerline'), disabled: readOnly || !selectedDrawingView },
                  { icon: CircleDotDashed, label: 'Środek', onClick: () => addDrawingAnnotation('center-mark'), disabled: readOnly || !selectedDrawingView },
                ]} /><ToolMenuButton icon={Crosshair} label="Opisy techniczne" description="Otwory, gwinty, balony oraz tolerancje GD&T." items={[
                  { icon: Cylinder, label: 'Opis otworu', onClick: () => addDrawingAnnotation('hole-note'), disabled: readOnly || !selectedDrawingView || selectedDrawingIsSketch },
                  { icon: Cylinder, label: 'Opis gwintu', onClick: () => addDrawingAnnotation('thread-note'), disabled: readOnly || !selectedDrawingView || selectedDrawingIsSketch },
                  { icon: CircleDotDashed, label: 'Balon', onClick: () => addDrawingAnnotation('balloon'), disabled: readOnly || !selectedDrawingView || selectedDrawingIsSketch },
                  { icon: Crosshair, label: 'GD&T', onClick: () => addDrawingAnnotation('feature-control-frame'), disabled: readOnly || !selectedDrawingView },
                  { icon: Trash2, label: 'Usuń oznaczenie', onClick: deleteSelectedDrawingAnnotation, disabled: readOnly || !selectedDrawingAnnotation },
                ]} /></RibbonGroup>
                <RibbonGroup label="ZESTAWIENIA"><ToolButton icon={Grid2X2} label="BOM" onClick={() => addDrawingTable('bom')} disabled={readOnly || !activeDrawingSheet || !engine.bodies.length} description="Dodaj automatyczne zestawienie części z modelu 3D." /><ToolButton icon={Grid2X2} label="Tabela otworów" onClick={() => addDrawingTable('hole-table')} disabled={readOnly || !selectedDrawingView || selectedDrawingIsSketch || !engine.bodies.length} description="Dodaj tabelę średnic z zaznaczonego widoku modelu 3D." /><ToolButton icon={Grid2X2} label="Tabela gięć" onClick={() => addDrawingTable('bend-table')} disabled={readOnly || !activeDrawingSheet || !sheetBodies.some((body) => body.sheetMetal.flatSegments?.length)} description="Dodaj skojarzoną tabelę kątów, promieni, długości i naddatków gięcia blachy." /></RibbonGroup>
              </>
            ) : workspace === 'tools' ? null : (
              <>
                <RibbonGroup label="UTWÓRZ"><ToolButton icon={SketchCadIcon} label="Utwórz szkic" onClick={startSketch} primary disabled={readOnly} /><ToolButton icon={ExtrudeCadIcon} label="Wyciągnij" onClick={openExtrude} disabled={readOnly} description={pressPullFace?.descriptor?.geometry === 'PLANE' && !activeSketchId ? 'Wyciągnij albo wciśnij zaznaczoną płaską ścianę.' : !selectedProfile && !canExtrudeOpenChain ? 'Rozpocznij od szkicu; po zamknięciu profilu uruchom wyciągnięcie.' : 'Wyciągnij zaznaczony profil w dokładną bryłę B-Rep.'} /><ToolMenuButton icon={Layers3} label="Blacha" description="Utwórz bazę blachową, a następnie dodawaj kołnierze na jej krawędziach." items={[
                  { icon: Layers3, label: 'Baza blachowa', onClick: openSheetBase, disabled: readOnly || !selectedProfile || Boolean(activeSketchId), disabledReason: 'Zaznacz zamknięty profil i zakończ szkic.' },
                  { icon: Layers3, label: 'Kołnierz blachy', onClick: openSheetFlange, disabled: readOnly || !canCreateSheetFlange || Boolean(activeSketchId), disabledReason: 'Zaznacz jedną prostą krawędź istniejącej blachy.' },
                  { icon: Layers3, label: 'Zawinięcie blachy', onClick: openSheetHem, disabled: readOnly || !canCreateSheetFlange || Boolean(activeSketchId), disabledReason: 'Zaznacz jedną prostą krawędź istniejącej blachy.' },
                  { icon: Scissors, label: 'Szczelina blachy', onClick: openSheetRip, disabled: readOnly || !canCreateSheetFlange || Boolean(activeSketchId), disabledReason: 'Zaznacz jedną prostą krawędź istniejącej blachy.' },
                  { icon: Ungroup, label: 'Rozwiń blachę', onClick: () => addSheetStateFeature('sheetUnfold'), disabled: readOnly || !canUnfoldSheet || Boolean(activeSketchId), disabledReason: activeSheetBody?.sheetMetal.unfolded ? 'Blacha jest już rozwinięta.' : 'Zaznacz blachę z co najmniej jednym gięciem.' },
                  { icon: Layers3, label: 'Zagnij ponownie', onClick: () => addSheetStateFeature('sheetRefold'), disabled: readOnly || !canRefoldSheet || Boolean(activeSketchId), disabledReason: 'Najpierw rozwiń blachę.' },
                ]} /><ToolMenuButton icon={PlaneCadIcon} label="Powierzchnie" description="Twórz, odsuwaj, zszywaj i pogrubiaj dokładne powierzchnie B-Rep." items={[
                  { icon: PlaneCadIcon, label: 'Patch', displayLabel: 'Wypełnij profil', onClick: openSurfacePatch, disabled: readOnly || !selectedProfile || Boolean(activeSketchId), disabledReason: 'Zaznacz zamknięty profil i zakończ szkic.' },
                  { icon: ExtrudeCadIcon, label: 'Surface Extrude', displayLabel: 'Wyciągnij powierzchnię', onClick: openSurfaceExtrude, disabled: readOnly || (!selectedProfile && !canExtrudeOpenChain), disabledReason: 'Zaznacz zamknięty profil albo ciągły otwarty łańcuch.' },
                  { icon: RevolveCadIcon, label: 'Surface Revolve', displayLabel: 'Obróć powierzchnię', onClick: openSurfaceRevolve, disabled: readOnly || (!selectedProfile && !canExtrudeOpenChain), disabledReason: 'Zaznacz zamknięty profil albo ciągły otwarty łańcuch.' },
                  { icon: SweepCadIcon, label: 'Surface Sweep', displayLabel: 'Powierzchnia po ścieżce', onClick: openSurfaceSweep, disabled: readOnly || !selectedProfile || Boolean(activeSketchId) || !sweepPathOptions().length, disabledReason: 'Zaznacz profil i przygotuj osobny szkic ścieżki.' },
                  { icon: LoftCadIcon, label: 'Surface Loft', displayLabel: 'Powierzchnia przejściowa', onClick: openSurfaceLoft, disabled: readOnly || !selectedProfile || Boolean(activeSketchId) || !loftProfileOptions().length, disabledReason: 'Przygotuj dwa profile w osobnych szkicach.' },
                  { icon: Layers3, label: 'Surface Offset', displayLabel: 'Odsuń powierzchnię', onClick: openSurfaceOffset, disabled: readOnly || !selectedSurfaceBody, disabledReason: 'Zaznacz jedną powierzchnię.' },
                  { icon: Layers3, label: 'Stitch', displayLabel: 'Zszyj powierzchnie', onClick: openSurfaceStitch, disabled: readOnly || !canStitchSelectedSurfaces, disabledReason: 'Zaznacz co najmniej dwie powierzchnie.' },
                  { icon: Scissors, label: 'Surface Trim', displayLabel: 'Przytnij powierzchnię', onClick: openSurfaceTrim, disabled: readOnly || !canTrimSelectedSurface, disabledReason: 'Zaznacz jedną powierzchnię i jedną bryłę tnącą.' },
                  { icon: Scissors, label: 'Surface Extend', displayLabel: 'Przedłuż powierzchnię', onClick: openSurfaceExtend, disabled: readOnly || !canExtendSelectedSurface, disabledReason: 'Zaznacz jedną prostą krawędź planarnej powierzchni.' },
                  { icon: ShellCadIcon, label: 'Thicken', displayLabel: 'Pogrub powierzchnię', onClick: openThickenSurface, disabled: readOnly || !selectedSurfaceBody, disabledReason: 'Zaznacz jedną powierzchnię.' },
                ]} /><ToolMenuButton icon={CircleDotDashed} label="Plastic" description="Funkcje konstrukcyjne elementów z tworzyw sztucznych." items={[
                  { icon: CircleDotDashed, label: 'Boss', onClick: openPlasticBoss, disabled: readOnly || activeSketchId || selectedFaceItems.length !== 1, disabledReason: 'Zaznacz jedną planarną ścianę bryły B-Rep.' },
                  { icon: Blocks, label: 'Snap-fit', onClick: openPlasticSnapFit, disabled: readOnly || activeSketchId || selectedFaceItems.length !== 1, disabledReason: 'Zaznacz jedną planarną ścianę bryły B-Rep.' },
                  { icon: Grid2X2, label: 'Grille', onClick: openPlasticGrille, disabled: readOnly || activeSketchId || selectedFaceItems.length !== 1, disabledReason: 'Zaznacz jedną planarną ścianę bryły B-Rep.' },
                ]} /><ToolMenuButton icon={PrimitiveCadIcon} label="Więcej brył" description="Prymitywy, bryły obrotowe, prowadzone, przejściowe oraz dodatki 3D." items={[
                  { icon: PrimitiveCadIcon, label: 'Prymityw', onClick: openPrimitive, disabled: readOnly },
                  { icon: Shapes, label: 'Form', onClick: openFormBody, disabled: readOnly || Boolean(activeSketchId), disabledReason: 'Zakończ aktywny szkic.' },
                  { icon: RevolveCadIcon, label: 'Revolve', displayLabel: 'Bryła obrotowa', onClick: openRevolve, disabled: readOnly || !selectedProfile || Boolean(activeSketchId), disabledReason: 'Zaznacz zamknięty profil i zakończ szkic.' },
                  { icon: SweepCadIcon, label: 'Sweep', displayLabel: 'Przeciągnięcie po ścieżce', onClick: openSweep, disabled: readOnly || !selectedProfile || Boolean(activeSketchId), disabledReason: 'Zaznacz profil i osobną ścieżkę.' },
                  { icon: LoftCadIcon, label: 'Loft', displayLabel: 'Bryła przejściowa', onClick: openLoft, disabled: readOnly || !selectedProfile || Boolean(activeSketchId), disabledReason: 'Przygotuj co najmniej dwa profile.' },
                  { icon: CoilCadIcon, label: 'Coil', displayLabel: 'Spirala', onClick: openCoil, disabled: readOnly || Boolean(activeSketchId), disabledReason: 'Zakończ aktywny szkic.' },
                  { icon: Type, label: 'Tekst 3D', onClick: openTextSolid, disabled: readOnly },
                  { icon: HoleCadIcon, label: 'Otwór', onClick: openHole, disabled: readOnly || (!hasHoleReference && !hasFaceEdgeHoleReference) || !engine.bodies.length, disabledReason: 'Zaznacz punkt szkicu albo płaską ścianę i dwie krawędzie odniesienia.' },
                ]} /></RibbonGroup>
                <RibbonGroup label="ZMIEŃ"><ToolButton icon={PressPullCadIcon} label="Press Pull" displayLabel="Naciśnij / wyciągnij" onClick={openPressPull} disabled={readOnly || !canPressPull} disabledReason="Zaznacz zamknięty profil albo płaską ścianę." /><ToolButton icon={FilletCadIcon} label="Zaokrąglij" onClick={() => openEdgeCommand('fillet')} disabled={readOnly || !selectedEdgeItems.length} disabledReason="Zaznacz co najmniej jedną krawędź bryły." /><ToolMenuButton icon={ChamferCadIcon} label="Więcej zmian" description="Fazowanie, powłoka, pochylenie, ściany i położenie bryły." items={[
                  { icon: ChamferCadIcon, label: 'Fazuj', onClick: () => openEdgeCommand('chamfer'), disabled: readOnly || !selectedEdgeItems.length, disabledReason: 'Zaznacz co najmniej jedną krawędź.' },
                  { icon: ShellCadIcon, label: 'Shell', displayLabel: 'Powłoka', onClick: openShell, disabled: readOnly || !selectedFaceItems.length, disabledReason: 'Zaznacz ścianę do usunięcia.' },
                  { icon: DraftCadIcon, label: 'Draft', displayLabel: 'Pochylenie ścian', onClick: openDraft, disabled: readOnly || !selectedFaceItems.length, disabledReason: 'Zaznacz ściany do pochylenia.' },
                  { icon: OffsetFaceCadIcon, label: 'Offset Face', displayLabel: 'Odsuń ścianę', onClick: openOffsetFace, disabled: readOnly || selectedFaceItems.length !== 1, disabledReason: 'Zaznacz dokładnie jedną płaską ścianę.' },
                  { icon: DeleteFaceCadIcon, label: 'Delete Face + Heal', displayLabel: 'Usuń i napraw ścianę', onClick: openDeleteFace, disabled: readOnly || !selectedFaceItems.length, disabledReason: 'Zaznacz ściany do usunięcia.' },
                  { icon: ScanSearch, label: 'Narzędzia siatki', onClick: openMeshTools, disabled: readOnly || !selectedMeshFeature, disabledReason: 'Zaznacz jedną zaimportowaną siatkę STL albo 3MF.' },
                  { icon: ScanSearch, label: 'Przywróć siatkę', onClick: restoreSelectedBrepToMesh, disabled: readOnly || !selectedFacetedBrepFeature, disabledReason: 'Zaznacz model STL przekonwertowany do fasetowego B-Rep.' },
                  { icon: MoveBodyCadIcon, label: 'Przesuń bryłę', onClick: () => openTransform('move'), disabled: readOnly || selection?.kind !== 'body' },
                  { icon: RotateBodyCadIcon, label: 'Obróć bryłę', onClick: () => openTransform('rotate'), disabled: readOnly || selection?.kind !== 'body' },
                  { icon: EditFeatureCadIcon, label: 'Edytuj', onClick: editSelection, disabled: readOnly || !['sketch', 'profile', 'feature', 'constructionPlane', 'constructionAxis', 'constructionPoint'].includes(selection?.kind) },
                  { icon: PatternCadIcon, label: 'Pattern', displayLabel: 'Szyk', onClick: openPattern, disabled: readOnly || !targetBodyId || !targetBodySupportsSolidOperations || Boolean(activeSketchId), disabledReason: 'Zaznacz obsługiwaną bryłę i zakończ szkic.' },
                  { icon: BooleanCadIcon, label: 'Boolean', displayLabel: 'Połącz / odejmij', onClick: openBoolean, disabled: readOnly || !canBooleanSelectedBodies, disabledReason: 'Zaznacz co najmniej dwie bryły.' },
                  { icon: SplitBodyCadIcon, label: 'Split Body', displayLabel: 'Podziel bryłę', onClick: openSplitBody, disabled: readOnly || selection?.kind !== 'body', disabledReason: 'Zaznacz bryłę.' },
                  { icon: SplitFaceCadIcon, label: 'Split Face', displayLabel: 'Podziel ścianę', onClick: openSplitFace, disabled: readOnly || !canSplitFace, disabledReason: 'Zaznacz profil szkicu i płaską ścianę.' },
                  { icon: ReplaceFaceCadIcon, label: 'Replace Face', displayLabel: 'Zastąp ścianę', onClick: openReplaceFace, disabled: readOnly || selectedFaceItems.length !== 2, disabledReason: 'Zaznacz dwie równoległe ściany.' },
                ]} /></RibbonGroup>
                <RibbonGroup label="KONSTRUKCJA">
                  <ToolMenuButton icon={PlaneCadIcon} label="Płaszczyzny" description="Utwórz pomocniczą płaszczyznę konstrukcyjną." items={[
                    { icon: PlaneCadIcon, label: 'Płaszczyzna odsunięta', onClick: () => openConstructionPlane('offset'), disabled: readOnly },
                    { icon: MidplaneCadIcon, label: 'Płaszczyzna środkowa', onClick: () => openConstructionPlane('midplane'), disabled: readOnly },
                    { icon: ThreePointPlaneCadIcon, label: 'Przez 3 punkty', onClick: () => openConstructionPlane('three-points'), disabled: readOnly },
                    { icon: AnglePlaneCadIcon, label: 'Pod kątem', onClick: () => openConstructionPlane('angle'), disabled: readOnly },
                    { icon: TangentPlaneCadIcon, label: 'Styczna', onClick: () => openConstructionPlane('tangent'), disabled: readOnly },
                    { icon: PathPlaneCadIcon, label: 'Na ścieżce', onClick: () => openConstructionPlane('path'), disabled: readOnly },
                  ]} />
                  <ToolMenuButton icon={AxisCadIcon} label="Osie" description="Utwórz pomocniczą oś konstrukcyjną." items={[
                    { icon: AxisCadIcon, label: 'Oś z krawędzi', onClick: () => openConstructionAxis('edge'), disabled: readOnly },
                    { icon: CylinderAxisCadIcon, label: 'Oś walca', onClick: () => openConstructionAxis('cylinder'), disabled: readOnly },
                    { icon: AxisCadIcon, label: 'Oś 2 punkty', onClick: () => openConstructionAxis('two-points'), disabled: readOnly },
                    { icon: AxisCadIcon, label: 'Oś przecięcia', onClick: () => openConstructionAxis('plane-intersection'), disabled: readOnly || document.references.filter((reference) => reference.kind === 'construction-plane').length < 2 },
                    { icon: AxisCadIcon, label: 'Oś normalna', onClick: () => openConstructionAxis('plane-normal'), disabled: readOnly || !document.references.some((reference) => reference.kind === 'construction-plane') },
                  ]} />
                  <ToolMenuButton icon={PointCadIcon} label="Punkty" description="Utwórz pomocniczy punkt konstrukcyjny." items={[
                    { icon: PointCadIcon, label: 'Punkt wierzchołka', onClick: () => openConstructionPoint('vertex'), disabled: readOnly },
                    { icon: PointCadIcon, label: 'Punkt centrum', onClick: () => openConstructionPoint('center'), disabled: readOnly },
                    { icon: PointCadIcon, label: 'Punkt przecięcia', onClick: () => openConstructionPoint('intersection'), disabled: readOnly || !document.references.some((reference) => reference.kind === 'construction-axis') || !document.references.some((reference) => reference.kind === 'construction-plane') },
                    { icon: PointCadIcon, label: 'Punkt środkowy', onClick: () => openConstructionPoint('midpoint'), disabled: readOnly },
                    { icon: PointCadIcon, label: 'Punkt na osi', onClick: () => openConstructionPoint('on-axis'), disabled: readOnly || !document.references.some((reference) => reference.kind === 'construction-axis') },
                  ]} />
                </RibbonGroup>
                <RibbonGroup label="SPRAWDŹ"><ToolMenuButton icon={GeometryCheckCadIcon} label="Analiza" description="Pomiary, przekrój, masa i kontrola geometrii." items={[
                  { icon: Ruler, label: 'Zmierz', onClick: openMeasure },
                  { icon: SectionCadIcon, label: 'Przekrój', onClick: openSectionAnalysis, disabled: !engine.bodies.length },
                  { icon: ScanSearch, label: 'Analiza powierzchni', onClick: openSurfaceAnalysis, disabled: !engine.bodies.length },
                  { icon: MassCadIcon, label: 'Właściwości masy', onClick: openMassProperties, disabled: !engine.bodies.length },
                  { icon: GeometryCheckCadIcon, label: 'Sprawdź geometrię', onClick: openGeometryInspection, disabled: !engine.bodies.length },
                ]} /></RibbonGroup>
              </>
            )}
          </ResponsiveRibbon>
        </div>
      </section>

      <div
        className={`modeling-content command-dock-right ${showProjectBrowser ? '' : 'without-browser'} ${printPanelOpen ? 'with-print-panel' : ''}`}
        style={{
          '--browser-column': showProjectBrowser ? '252px' : '0px',
          '--command-column': isDockableCommand(command) ? (panelLayout.commandCollapsed ? '38px' : '280px') : '0px',
          '--print-column': printPanelOpen ? (panelLayout.printCollapsed ? '38px' : '286px') : '0px',
        }}
      >
        {showProjectBrowser && <ProjectBrowser document={document} bodies={engine.bodies} selection={selection} activeSketchId={activeSketchId} onSelect={handleBrowserSelection} onToggleReference={toggleConstructionVisibility} onToggleSketchVisibility={toggleSketchVisibility} onToggleBodyVisibility={toggleBodyVisibility} onClose={() => setBrowserOpen(false)} />}
        <CommandDialog
          command={command}
          profileName={command?.type === 'pipe' ? `Otwarta ścieżka (${command.previewFeature?.pathEntityIds?.length || command.pathEntityIds?.length || 0})` : command?.openChain ? `Otwarty łańcuch (${command.previewFeature?.openEntityIds?.length || 0})` : commandProfileName}
          collapsed={panelLayout.commandCollapsed}
          dock="right"
          onChange={updateCommand}
          onConfirm={command?.type === 'rectangle' || command?.type === 'circle' ? confirmProfile : command?.type === 'point' ? confirmSketchPoint : ['arc', 'polygon', 'ellipse', 'slot', 'spline', 'conic'].includes(command?.type) ? confirmMechanicalShape : command?.type === 'line' || command?.type === 'polyline' ? confirmExactSketchSegment : command?.type === 'moveSketch' ? confirmSketchMove : command?.type === 'offsetSketch' ? confirmSketchOffset : command?.type === 'cornerSketch' ? confirmSketchCorner : command?.type === 'transformSketch' ? confirmSketchTransform : command?.type === 'patternSketch' ? confirmSketchPattern : ['offsetPlane', 'midplanePlane', 'threePointPlane', 'anglePlane', 'tangentPlane', 'pathPlane'].includes(command?.type) ? confirmConstructionPlane : command?.type === 'constructionAxis' ? confirmConstructionAxis : command?.type === 'constructionPoint' ? confirmConstructionPoint : confirmFeature}
          onConfirmDynamic={confirmDynamicSketchSegment}
          onCancel={command?.type === 'line' || command?.type === 'polyline' ? finishSketchPath : () => { if (command?.openChain && command.sourceSketchId) { setActiveSketchId(command.sourceSketchId); setWorkspace('sketch'); } setCommand(null); setNotice('Anulowano polecenie.'); }}
          onUndoSegment={undoSketchSegment}
          onFinishPath={finishSketchPath}
          onToggleCollapsed={() => setPanelLayout((current) => ({ ...current, commandCollapsed: !current.commandCollapsed }))}
        />
        <main className="modeling-stage">
          {workspace === 'drawing' ? <DrawingWorkspace
            document={document}
            bodies={visibleViewportBodies}
            activeSheetId={activeDrawingSheetId}
            selectedViewId={selectedDrawingViewId}
            selectedAnnotationId={selectedDrawingAnnotationId}
            focusSection={drawingPropertyFocus}
            readOnly={readOnly}
            onCreateSheet={createDrawingSheetInDocument}
            onSelectSheet={(sheetId) => { setActiveDrawingSheetId(sheetId); setSelectedDrawingViewId(null); setSelectedDrawingAnnotationId(null); }}
            onUpdateSheet={updateActiveDrawingSheet}
            onDeleteSheet={deleteActiveDrawingSheet}
            onAddBaseView={addBaseDrawingView}
            onAddSketchView={addSketchDrawingView}
            onAddDerivedView={addDerivedDrawingView}
            onSelectView={(viewId) => { setSelectedDrawingViewId(viewId); setSelectedDrawingAnnotationId(null); }}
            onUpdateView={updateSelectedDrawingView}
            onDeleteView={deleteSelectedDrawingView}
            onAddAnnotation={addDrawingAnnotation}
            onSelectAnnotation={(annotationId) => { setSelectedDrawingAnnotationId(annotationId); setSelectedDrawingViewId(null); }}
            onUpdateAnnotation={updateSelectedDrawingAnnotation}
            onDeleteAnnotation={deleteSelectedDrawingAnnotation}
            onAddRevision={addDrawingRevision}
            onUpdateRevision={updateDrawingRevision}
            onDeleteRevision={deleteDrawingRevision}
            onAddTable={addDrawingTable}
            onUpdateTable={updateDrawingTable}
            onDeleteTable={deleteDrawingTable}
            onExportPdf={() => { void exportActiveDrawingPdf(); }}
            onExportDxf={exportActiveDrawingDxf}
          /> : workspace === 'tools' ? <ProjectDashboard
            document={document}
            bodyCount={engine.bodies.length}
            health={projectHealthReport}
            snapshotCount={projectSnapshots.length}
            onOpenParameters={() => setCommand({ type: 'parameters' })}
            onOpenSnapshots={openProjectSnapshots}
            onOpenComparison={openProjectComparison}
            onOpenHealth={openProjectHealth}
            onOpenDependencies={openProjectDependencies}
            onOpenComponents={openComponentManager}
            onCreatePart={() => createDocumentComponent('part')}
            onCreateAssembly={() => createDocumentComponent('assembly')}
            onOpenNamedViews={() => { setComponentsOpen(false); setNamedViewsOpen((open) => !open); switchWorkspace('solid'); }}
            readOnly={readOnly}
            onBack={() => switchWorkspace('solid')}
          /> : <React.Suspense fallback={<div className="viewport-loading" role="status">Uruchamianie widoku 3D…</div>}>
          <ModelViewport
            bodies={visibleViewportBodies}
            sketches={document.sketches}
            layers={document.layers}
            activeSketchId={activeSketchId}
            visibleSketchId={visibleSketchId}
            draftProfile={draftProfile}
            draftType={null}
            onDraftChange={readOnly ? undefined : updateCommand}
            sketchTool={command?.type === 'line' || command?.type === 'polyline' || directSketchTypes.includes(command?.type) ? command.type : null}
            sketchToolPrompt={sketchToolPrompt}
            polylineDraft={command?.type === 'line' || command?.type === 'polyline' ? { lastPoint: command.lastPoint } : directSketchTypes.includes(command?.type) ? { lastPoint: command.gesturePoints?.at(-1) || null } : null}
            onSketchPoint={readOnly ? undefined : handleSketchCanvasPoint}
            onSketchPointerMove={(point) => { sketchPointerRef.current = point; }}
            sketchDynamicLength={command?.dynamicLength || ''}
            autoConstraints={sketchOptions.autoConstraints}
            selectedSketchEntityIds={selectedSketchEntityIds}
            lostProjectedEntityIds={lostProjectedEntityIds}
            selectedSketchConstraintId={selectedSketchConstraintId}
            onSketchSelection={handleSketchSelection}
            onSketchConstraintSelection={(constraintId) => setSelection({ kind: 'sketchConstraint', id: constraintId, sketchId: activeSketchId })}
            onSketchConstraintValueChange={updateSketchConstraintValue}
            onDeleteSketchSelection={readOnly ? undefined : deleteSelectedSketchEntities}
            sketchModifierMode={command?.type === 'trimSketch' ? 'trim' : command?.type === 'extendSketch' ? 'extend' : command?.type === 'breakSketch' ? 'break' : command?.type === 'projectSketch' ? 'project' : null}
            onSketchModify={modifySketchAtPoint}
            onSketchProfileSelection={(profileId, sketchId) => setSelection({ kind: 'profile', id: profileId, sketchId: sketchId || activeSketchId })}
            onSketchMove={readOnly ? undefined : moveSketchEntities}
            showSketchPoints={sketchOptions.points}
            showSketchProfiles={sketchOptions.profiles}
            showSketchConstraints={sketchOptions.constraints}
            showSketchDimensions={sketchOptions.dimensions}
            showConstructionGeometry={sketchOptions.construction}
            showProjectedGeometry={sketchOptions.projected}
            sliceModel={sketchOptions.slice}
            sectionAnalysis={sectionAnalysis}
            draftAnalysis={activeGeometryFaceAnalysis}
            surfaceAnalysis={surfaceAnalysis}
            parameters={document.parameters}
            showGrid={!activeSketchId || sketchOptions.grid}
            selectedBodyId={selection?.kind === 'body' ? selection.id : (selection?.bodyId || null)}
            selectedBodyIds={selectedBodyIds}
            components={document.components}
            componentInstances={document.componentInstances}
            joints={document.joints}
            collisionInstanceIds={collisionInstanceIds}
            exactCollisionInstanceIds={exactCollisionInstanceIds}
            explodeAmount={explodeAmount}
            cameraRequest={cameraRequest}
            fitRequest={fitViewRequest}
            activeCommand={command}
            onFormControlPointSelection={(selectedControlPoint) => updateCommand({ selectedControlKind: 'point', selectedControlPoint })}
            onFormControlEdgeSelection={(selectedControlEdge) => updateCommand({ selectedControlKind: 'edge', selectedControlEdge })}
            onFormControlFaceSelection={(selectedControlFace) => updateCommand({ selectedControlKind: 'face', selectedControlFace })}
            onFormControlPointMove={(selectedControlPoint, offset) => {
              const insertCount = command?.insertEdgeEnabled ? 4 : 0;
              const currentOffsets = [...Array.from({ length: 8 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command?.controlOffsets?.[index]?.[axis] ?? '0')), ...(insertCount ? Array.from({ length: 4 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command?.insertEdgeOffsets?.[index]?.[axis] ?? '0')) : []), ...(command?.bridgeEnabled ? Array.from({ length: 8 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command?.bridgeOffsets?.[index]?.[axis] ?? '0')) : [])];
              const symmetryPairs = formControlSymmetryPairs({ enabled: command?.insertEdgeEnabled, edgeIndex: command?.insertEdgeIndex || 0, position: Number(command?.insertEdgePosition) || 0.5 }, command?.symmetry, { enabled: command?.bridgeEnabled, firstFaceIndex: command?.bridgeFirstFace || 0, secondFaceIndex: command?.bridgeSecondFace ?? 1, inset: Number(command?.bridgeInset) || 0.45 });
              const nextOffsets = updateFormControlOffset(currentOffsets, selectedControlPoint, offset.map((value) => String(Number(value.toFixed(3)))), command?.symmetry, symmetryPairs);
              updateCommand({ selectedControlPoint, controlOffsets: nextOffsets.slice(0, 8), insertEdgeOffsets: nextOffsets.slice(8, 8 + insertCount), bridgeOffsets: nextOffsets.slice(8 + insertCount) });
            }}
            onFormControlSelectionMove={(pointIndexes, axisIndex, delta) => {
              const insertCount = command?.insertEdgeEnabled ? 4 : 0;
              const currentOffsets = [...Array.from({ length: 8 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command?.controlOffsets?.[index]?.[axis] ?? '0')), ...(insertCount ? Array.from({ length: 4 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command?.insertEdgeOffsets?.[index]?.[axis] ?? '0')) : []), ...(command?.bridgeEnabled ? Array.from({ length: 8 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command?.bridgeOffsets?.[index]?.[axis] ?? '0')) : [])];
              const symmetryPairs = formControlSymmetryPairs({ enabled: command?.insertEdgeEnabled, edgeIndex: command?.insertEdgeIndex || 0, position: Number(command?.insertEdgePosition) || 0.5 }, command?.symmetry, { enabled: command?.bridgeEnabled, firstFaceIndex: command?.bridgeFirstFace || 0, secondFaceIndex: command?.bridgeSecondFace ?? 1, inset: Number(command?.bridgeInset) || 0.45 });
              const nextOffsets = translateFormControlPoints(currentOffsets, pointIndexes, axisIndex, delta, command?.symmetry, symmetryPairs).map((point) => point.map((value) => String(Number(value.toFixed(3)))));
              updateCommand({ controlOffsets: nextOffsets.slice(0, 8), insertEdgeOffsets: nextOffsets.slice(8, 8 + insertCount), bridgeOffsets: nextOffsets.slice(8 + insertCount) });
            }}
            onCameraStateChange={(camera) => { currentCameraRef.current = camera; }}
            selectedComponentInstanceId={selectedInstance?.id || null}
            selectedJointId={selectedJoint?.id || null}
            onSelectBody={(id) => setSelection(id ? { kind: 'body', id } : { kind: 'document', id: document.id })}
            onSelectComponentInstance={(instanceId) => { const instance = document.componentInstances.find((item) => item.id === instanceId); setSelection({ kind: 'componentInstance', id: instanceId, componentId: instance?.componentId }); setComponentsOpen(true); }}
            onSelectJoint={(jointId) => { const joint = document.joints.find((item) => item.id === jointId); setSelection({ kind: 'joint', id: jointId, movingInstanceId: joint?.movingInstanceId }); setComponentsOpen(true); }}
            selectedTopologyIds={selectedTopologyIds}
            onSelectTopology={handleTopologySelection}
            planeSelectionMode={command?.type === 'plane'}
            onSelectOriginPlane={pickPlane}
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
            showBed={printPanelOpen}
            printLayout={document.print}
          />
          </React.Suspense>}
          {workspace !== 'drawing' && workspace !== 'tools' && !activeSketchId && !command && !adaptiveContext && <section className={`engine-status workspace-guidebar ${engine.status}`} role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true" /><div><strong>{workspaceGuide.title}</strong><small>{workspaceGuide.text}</small></div>{workspaceGuide.action && <button type="button" onClick={workspaceGuide.onAction}>{workspaceGuide.action}<ArrowRight size={13} /></button>}</section>}
          {workspace !== 'drawing' && (activeSketchId || command) && <div className={`engine-status ${engine.status}`} role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true" />{engine.status === 'ready' ? readyEngineLabel : engine.status === 'computing' ? 'Przeliczanie historii…' : engine.status === 'loading' ? 'Uruchamianie OpenCascade…' : engine.error}</div>}
          {workspace === 'solid' && !activeSketchId && !command && adaptiveContext && <div className={`engine-status adaptive-engine-status ${engine.status}`} role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true" />{engine.status === 'ready' ? readyEngineLabel : engine.status === 'computing' ? 'Przeliczanie historii…' : engine.status === 'loading' ? 'Uruchamianie OpenCascade…' : engine.error}</div>}
          {workspace !== 'drawing' && workspace !== 'tools' && adaptiveContext && !meshToolsOpen && <AdaptiveToolShelf {...adaptiveContext} />}
          {notice && <div className={`workspace-notice ${command ? 'command-active' : ''}`} role="status" aria-live="polite" aria-atomic="true">{notice}</div>}
          <CrashRecoveryBanner
            info={recoveryInfo}
            onSave={() => { void saveProject(); }}
            onOpenSnapshots={openProjectSnapshots}
            onDismiss={() => setRecoveryInfo(null)}
          />
          {projectSnapshotsOpen && <ProjectSnapshotsPanel snapshots={projectSnapshots} loading={projectSnapshotsLoading} error={projectSnapshotsError} readOnly={readOnly} onCreate={createProjectSnapshot} onRestore={restoreProjectSnapshot} onDelete={deleteProjectSnapshot} onClose={() => setProjectSnapshotsOpen(false)} />}
          {projectComparisonOpen && <ProjectComparisonPanel snapshots={projectSnapshots} comparison={projectComparison} sourceLabel={projectComparisonBaseline?.label || ''} loading={projectComparisonLoading || projectSnapshotsLoading} error={projectComparisonError || projectSnapshotsError} onCompareSnapshot={compareProjectSnapshot} onCompareFile={compareExternalProject} onClose={() => setProjectComparisonOpen(false)} />}
          {projectHealthOpen && <ProjectHealthPanel report={projectHealthReport} language={language} onNavigate={navigateProjectHealthIssue} onExport={exportProjectHealthReport} onClose={() => setProjectHealthOpen(false)} />}
          {projectDependenciesOpen && <ProjectDependenciesPanel inspection={projectDependencyInspection} language={language} onSelectNode={setProjectDependencyNodeId} onNavigate={navigateProjectDependency} onClose={() => setProjectDependenciesOpen(false)} />}
          {projectSearchOpen && <ProjectSearchPalette index={projectSearchIndex} language={language} onNavigate={navigateProjectSearchResult} onClose={() => setProjectSearchOpen(false)} />}
          <TopologyReferenceRepairPanel items={lostTopologyReferences} selection={selection} onReassign={repairTopologyReference} onPreview={(candidate) => handleTopologySelection(candidate)} />
          {command?.type === 'measure' && <MeasurePanel measurement={measurement} onClose={() => setCommand(null)} />}
          {command?.type === 'sectionAnalysis' && sectionAnalysis && <SectionPanel analysis={sectionAnalysis} onChange={(patch) => setSectionAnalysis((current) => ({ ...current, ...patch }))} onClose={closeSectionAnalysis} />}
          {command?.type === 'surfaceAnalysis' && surfaceAnalysis && <SurfaceAnalysisPanel analysis={surfaceAnalysis} continuity={surfaceContinuity} curvature={surfaceCurvature} onChange={(patch) => setSurfaceAnalysis((current) => ({ ...current, ...patch }))} onClose={closeSurfaceAnalysis} />}
          {meshToolsOpen && selectedMeshBody && <MeshToolsPanel body={selectedMeshBody} report={selectedMeshReport} groups={selectedMeshFeature?.meshGroups || []} brepBlocker={meshBrepBlocker} readOnly={readOnly} onRepair={safelyRepairSelectedMesh} onOrient={orientSelectedMeshFaces} onFillHoles={fillSelectedMeshHoles} onReduce={reduceSelectedMesh} onSmooth={smoothSelectedMesh} onRemesh={remeshSelectedMesh} onGroup={groupSelectedMeshFaces} onConvertToBrep={convertSelectedMeshToBrep} onClose={() => setMeshToolsOpen(false)} />}
          {command?.type === 'massProperties' && <MassPropertiesPanel density={command.density} result={massProperties?.result} error={massProperties?.error} onDensityChange={(density) => setCommand((current) => ({ ...current, density }))} onClose={() => setCommand(null)} />}
          {command?.type === 'geometryInspection' && <GeometryInspectionPanel result={geometryInspection} inspectionMode={command.inspectionMode} draftDirection={command.draftDirection} draftTolerance={command.draftTolerance} thicknessTarget={command.thicknessTarget} thicknessTolerance={command.thicknessTolerance} onChange={(patch) => setCommand((current) => ({ ...current, ...patch }))} onClose={() => setCommand(null)} />}
          {namedViewsOpen && <NamedViewsPanel views={document.namedViews || []} currentCamera={currentCameraRef.current} readOnly={readOnly} onCreate={saveNamedView} onActivate={activateNamedView} onDelete={removeNamedView} onClose={() => setNamedViewsOpen(false)} />}
          {componentsOpen && <ComponentPanel
            document={document} bodies={engine.bodies} collisionResult={assemblyCollisionResult}
            selectedComponentId={selectedComponent?.id || ''} selectedInstanceId={selectedInstance?.id || ''} selectedJointId={selectedJoint?.id || ''} selectedMotionLinkId={selectedMotionLink?.id || ''} selectedConfigurationId={selectedAssemblyConfiguration?.id || ''} selectedContactSetId={selectedContactSet?.id || ''} selectedBodyIds={selectedBodyIds}
            linkedProjectStatuses={linkedProjectStatuses} readOnly={readOnly} explodeAmount={explodeAmount} onExplodeAmountChange={setExplodeAmount}
            onCreate={createDocumentComponent} onLinkProject={() => { void linkExternalProject(); }} onPackAndGo={() => { void packAndGoProject(); }} onRefreshLinkedProject={(linkId) => { void refreshLinkedProject(linkId); }} onRepairLinkedProject={(linkId) => { void refreshLinkedProject(linkId, true); }}
            onUpdate={updateDocumentComponent} onAssignBodies={assignDocumentComponentBodies} onMove={moveDocumentComponent} onDelete={removeDocumentComponent} onSelect={(componentId) => setSelection({ kind: 'component', id: componentId })} onSelectInstance={(instanceId) => { const instance = document.componentInstances.find((item) => item.id === instanceId); setSelection({ kind: 'componentInstance', id: instanceId, componentId: instance?.componentId }); }} onCreateInstance={createDocumentComponentInstance} onUpdateInstance={updateDocumentComponentInstance} onDuplicateInstance={duplicateDocumentComponentInstance} onDeleteInstance={removeDocumentComponentInstance}
            onCreateRigidGroup={createDocumentRigidGroup} onDeleteRigidGroup={removeDocumentRigidGroup} onSelectJoint={(jointId) => setSelection(jointId ? { kind: 'joint', id: jointId } : { kind: 'document', id: document.id })} onCreateJoint={createDocumentJoint} onUpdateJoint={updateDocumentJoint} onSetJointValue={setDocumentJointValue} onDeleteJoint={removeDocumentJoint}
            onSelectMotionLink={(linkId) => setSelection(linkId ? { kind: 'motionLink', id: linkId } : { kind: 'document', id: document.id })} onCreateMotionLink={createDocumentMotionLink} onUpdateMotionLink={updateDocumentMotionLink} onDeleteMotionLink={removeDocumentMotionLink}
            onSelectConfiguration={(configurationId) => setSelection(configurationId ? { kind: 'assemblyConfiguration', id: configurationId } : { kind: 'document', id: document.id })} onCreateConfiguration={createDocumentAssemblyConfiguration} onUpdateConfiguration={updateDocumentAssemblyConfiguration} onApplyConfiguration={applyDocumentAssemblyConfiguration} onDeleteConfiguration={removeDocumentAssemblyConfiguration}
            onSelectContactSet={(contactSetId) => setSelection(contactSetId ? { kind: 'contactSet', id: contactSetId } : { kind: 'document', id: document.id })} onCreateContactSet={createDocumentContactSet} onUpdateContactSet={updateDocumentContactSet} onDeleteContactSet={removeDocumentContactSet} onClose={() => setComponentsOpen(false)}
          />}
          {layersOpen && <LayersPanel document={document} selectedEntities={selectedSketchEntities} readOnly={readOnly} onAdd={addDocumentLayer} onUpdate={updateDocumentLayer} onDelete={removeDocumentLayer} onActivate={activateDocumentLayer} onAssign={assignSelectionToLayer} onStyleSelected={styleSelectedEntities} onClose={() => setLayersOpen(false)} />}
          {blocksOpen && activeSketchId && <BlocksPanel document={document} selectedEntities={selectedSketchEntities} selectedInstance={selectedBlockInstance} readOnly={readOnly} onCreate={createBlockFromSelection} onInsert={insertDocumentBlock} onDeleteDefinition={removeBlockDefinition} onAddAttribute={addDocumentBlockAttribute} onUpdateInstanceAttribute={updateDocumentBlockAttribute} onExplode={explodeDocumentBlock} onDeleteInstance={removeDocumentBlockInstance} onClose={() => setBlocksOpen(false)} />}
          {commandCustomizationOpen && <CommandCustomizationPanel customization={commandCustomization} onSave={saveCommandSettings} onReset={createDefaultCommandCustomization} onClose={() => setCommandCustomizationOpen(false)} />}
          {startPageVisible && <StartPage onStartSketch={startSketch} onOpenProject={requestOpenProject} commandCustomization={commandCustomization} />}
          <WorkspaceDialogStack
            state={{ activeSketchId, command, document, importDraft, importRepairReport, resumableSketchesByPlane, sketchImportDraft, sketchOptions }}
            actions={{
              cancelCommand: () => setCommand(null),
              cancelModelImport: () => setImportDraft(null),
              cancelPlane: () => { setCommand(null); setWorkspace('solid'); setNotice('Anulowano tworzenie szkicu.'); },
              cancelSketchImport: () => setSketchImportDraft(null),
              changeModelImport: (patch) => setImportDraft((current) => ({ ...current, ...patch })),
              changeSketchImport: (patch) => setSketchImportDraft((current) => ({ ...current, ...patch })),
              changeSketchOption: (key, value) => setSketchOptions((current) => ({ ...current, [key]: value })),
              closeImportReport: () => setImportRepairReport(null),
              commit,
              confirmModelImport,
              confirmSketchDimension,
              confirmSketchImport,
              finishSketch,
              pickPlane,
              saveImportReport: () => { void saveImportRepairReport(); },
              updateCommand,
            }}
          />
        </main>
        {printPanelOpen && <PrintPanel document={document} bodies={engine.bodies} engine={engine} selectedFace={selectedPrintFace} commit={commit} collapsed={panelLayout.printCollapsed} onSelectIssue={(item) => setSelection(item?.kind === 'document' ? { kind: 'document', id: document.id } : item)} onExport={exportModel} onSendToSlicer={sendToSlicer} onClose={() => setPrintPanelOpen(false)} onToggleCollapsed={() => setPanelLayout((current) => ({ ...current, printCollapsed: !current.printCollapsed }))} readOnly={readOnly} />}
      </div>

      <footer className="modeling-footer">
        <CommandLine
          command={command}
          history={commandHistory}
          notice={notice}
          customization={commandCustomization}
          onCancel={handleCommandLineCancel}
          onSubmit={handleCommandLineSubmit}
        />
        {workspace !== 'drawing' && !activeSketchId && <div className="timeline" role="region" aria-label="Parametryczna oś czasu">
          {document.features.length ? <><div className="timeline-controls" role="toolbar" aria-label="Nawigacja osi czasu"><button type="button" aria-label="Pierwszy krok historii" title="Zaznacz pierwszy krok parametrycznej historii." onClick={() => selectTimelineStep('start')}><SkipBack size={14} /></button><button type="button" aria-label="Poprzednia operacja" title="Zaznacz poprzednią operację w historii." onClick={() => selectTimelineStep('previous')}><StepBack size={14} /></button><button type="button" aria-label="Następna operacja" title="Zaznacz następną operację w historii." onClick={() => selectTimelineStep('next')}><StepForward size={14} /></button></div>
          {selectedTimelineGroup && <div className="timeline-selection-tools timeline-group-tools" role="toolbar" aria-label={`Zarządzaj grupą ${selectedTimelineGroup.name}`}>
            {timelineGroupRename?.id === selectedTimelineGroup.id ? <div className="timeline-rename"><input autoFocus aria-label="Nowa nazwa grupy historii" maxLength={80} value={timelineGroupRename.value} onChange={(event) => setTimelineGroupRename((current) => ({ ...current, value: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); confirmTimelineGroupRename(); } }} /><button type="button" data-timeline-action="confirm-group-rename" title="Zapisz nazwę grupy" aria-label="Zapisz nazwę grupy" onClick={confirmTimelineGroupRename}><Check size={13} /></button><button type="button" aria-label="Anuluj zmianę nazwy grupy" onClick={() => setTimelineGroupRename(null)}><X size={13} /></button></div> : <><strong title={selectedTimelineGroup.name}>{selectedTimelineGroup.name} · {selectedTimelineGroup.featureIds.length}</strong><button type="button" data-timeline-action="rename-group" title="Zmień nazwę grupy" aria-label="Zmień nazwę grupy" disabled={readOnly} onClick={() => setTimelineGroupRename({ id: selectedTimelineGroup.id, value: selectedTimelineGroup.name })}><Pencil size={13} /></button><button type="button" data-timeline-action="collapse-group" title={selectedTimelineGroup.collapsed ? 'Rozwiń grupę' : 'Zwiń grupę'} aria-label={selectedTimelineGroup.collapsed ? 'Rozwiń grupę historii' : 'Zwiń grupę historii'} onClick={toggleSelectedTimelineGroup}>{selectedTimelineGroup.collapsed ? <FolderOpen size={13} /> : <FolderPlus size={13} />}</button><button type="button" data-timeline-action="ungroup" title="Rozwiąż grupę bez usuwania operacji" aria-label="Rozwiąż grupę historii" disabled={readOnly} onClick={ungroupSelectedTimelineGroup}><Ungroup size={13} /></button></>}
          </div>}
          {selectedTimelineFeature && <div className="timeline-selection-tools" role="toolbar" aria-label={`Zarządzaj operacją ${selectedTimelineFeature.name}`}>
            {timelineRename?.id === selectedTimelineFeature.id ? (
              <div className="timeline-rename">
                <input autoFocus aria-label="Nowa nazwa operacji" maxLength={80} value={timelineRename.value} onChange={(event) => setTimelineRename((current) => ({ ...current, value: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); confirmTimelineRename(); } }} />
                <button type="button" data-timeline-action="confirm-rename" title="Zapisz nazwę" aria-label="Zapisz nazwę" onClick={confirmTimelineRename}><Check size={13} /></button>
                <button type="button" title="Anuluj zmianę nazwy" aria-label="Anuluj zmianę nazwy" onClick={() => setTimelineRename(null)}><X size={13} /></button>
              </div>
            ) : timelineDeleteId === selectedTimelineFeature.id ? (
              <div className="timeline-delete-confirm" role="alert">
                <span>Usunąć {timelineDeleteCount === 1 ? 'operację' : `${timelineDeleteCount} operacje`}?</span>
                <button className="danger" type="button" data-timeline-action="confirm-delete" onClick={confirmTimelineDelete}>Usuń</button>
                <button type="button" onClick={() => setTimelineDeleteId(null)}>Anuluj</button>
              </div>
            ) : <>
              <strong title={selectedTimelineFeature.name}>{selectedTimelineIndex + 1}. {selectedTimelineFeature.name}</strong>
              <button type="button" data-timeline-action="edit" title="Edytuj parametry operacji" aria-label="Edytuj parametry operacji" disabled={readOnly} onClick={editSelection}><PencilRuler size={13} /></button>
              <button type="button" data-timeline-action="rename" title="Zmień nazwę (F2)" aria-label="Zmień nazwę operacji" disabled={readOnly} onClick={beginTimelineRename}><Pencil size={13} /></button>
              <button type="button" data-timeline-action="rollback" title={selectedTimelineFeatureIsRollback ? 'Przywróć pełną historię' : 'Cofnij model do tej operacji'} aria-label={selectedTimelineFeatureIsRollback ? 'Przywróć pełną historię' : 'Ustaw marker rollback po operacji'} disabled={readOnly} onClick={toggleTimelineRollback}><History size={13} /></button>
              <button type="button" data-timeline-action="group" title="Grupuj operację i jej zależności" aria-label="Utwórz grupę historii" disabled={readOnly || document.featureGroups.some((group) => group.featureIds.includes(selectedTimelineFeature.id))} onClick={createTimelineGroupFromSelection}><FolderPlus size={13} /></button>
              <button type="button" data-timeline-action="move-left" title="Przenieś wcześniej" aria-label="Przenieś operację wcześniej" disabled={readOnly || selectedTimelineIndex === 0} onClick={() => moveSelectedTimelineFeature(-1)}><ArrowLeft size={13} /></button>
              <button type="button" data-timeline-action="move-right" title="Przenieś później" aria-label="Przenieś operację później" disabled={readOnly || selectedTimelineIndex === document.features.length - 1} onClick={() => moveSelectedTimelineFeature(1)}><ArrowRight size={13} /></button>
              <button type="button" data-timeline-action="suppress" title={selectedTimelineFeature.suppressed ? 'Włącz operację' : 'Wyłącz operację'} aria-label={selectedTimelineFeature.suppressed ? 'Włącz operację' : 'Wyłącz operację'} disabled={readOnly} onClick={toggleSelectedTimelineFeature}>{selectedTimelineFeature.suppressed ? <Eye size={13} /> : <EyeOff size={13} />}</button>
              <button className="danger" type="button" data-timeline-action="delete" title="Usuń operację i zależności" aria-label="Usuń operację i zależności" disabled={readOnly} onClick={requestTimelineDelete}><Trash2 size={13} /></button>
            </>}
          </div>}
          <span className="timeline-start" />
          {document.features.map((feature, index) => {
            const group = document.featureGroups.find((item) => item.featureIds[0] === feature.id);
            const containingGroup = group || document.featureGroups.find((item) => item.featureIds.includes(feature.id));
            if (containingGroup?.collapsed && !group) return null;
            const result = timelineStatus.get(feature.id);
            return (
              <React.Fragment key={feature.id}>
                {group && <button className={`timeline-group ${selection?.kind === 'featureGroup' && selection.id === group.id ? 'selected' : ''} ${group.collapsed ? 'collapsed' : ''}`} type="button" aria-label={`Grupa historii ${group.name}, ${group.featureIds.length} operacji`} title={group.name} onClick={() => { setSelection({ kind: 'featureGroup', id: group.id }); setTimelineRename(null); setTimelineDeleteId(null); }}><FolderOpen size={14} /><span>{group.name}</span><small>{group.featureIds.length}</small></button>}
                {group?.collapsed && group.featureIds.includes(document.timelineRollbackFeatureId) && <span className="timeline-rollback-marker" role="separator" aria-label="Marker rollback" title="Nowe operacje zostaną wstawione po grupie"><History size={12} /></span>}
                {!group?.collapsed && <button id={`timeline-${feature.id}`} className={`timeline-item ${selection?.kind === 'feature' && selection.id === feature.id ? 'selected' : ''} ${feature.suppressed ? 'suppressed' : ''} ${lostReferenceOwnerIds.has(feature.id) ? 'warning reference-lost' : result?.status || ''}`} type="button" aria-pressed={selection?.kind === 'feature' && selection.id === feature.id} aria-label={`${index + 1}. ${feature.name}${feature.suppressed ? ', operacja wyłączona' : ''}`} onClick={() => selectTimelineFeature(feature, index)} onDoubleClick={editSelection} title={`${index + 1}. ${feature.name}${feature.suppressed ? ' — wyłączona' : result?.status === 'rolled-back' ? ' — poza markerem rollback' : lostReferenceOwnerIds.has(feature.id) ? ' — utracona referencja topologii' : result?.error ? ` — ${result.error}` : ''}`}>
                  {featureIcon(feature.type, 16)}<span aria-hidden="true">{index + 1}</span>
                </button>}
                {document.timelineRollbackFeatureId === feature.id && <span className="timeline-rollback-marker" role="separator" aria-label="Marker rollback" title="Nowe operacje zostaną wstawione tutaj"><History size={12} /></span>}
              </React.Fragment>
            );
          })}
          <span className="timeline-end" /></> : <span className="timeline-empty-label">Historia operacji pojawi się po utworzeniu pierwszej bryły.</span>}
        </div>}
      </footer>
      {tutorialOpen && <FirstPartTutorial onClose={() => setTutorialOpen(false)} />}
      {licenseInfoOpen && <LicenseInfoDialog onClose={() => setLicenseInfoOpen(false)} onShowFullLicense={() => { setLicenseInfoOpen(false); setFullLicenseOpen(true); }} />}
      {fullLicenseOpen && <FullLicenseDialog onClose={() => setFullLicenseOpen(false)} />}
      {updateState.open && !updatePromptBlocked && <UpdateDialog state={updateState} onCheck={checkForUpdates} onInstall={installAvailableUpdate} onClose={() => setUpdateState((current) => ({ ...current, open: false, promptPending: false }))} />}
      {toolHelp && (
        <div className="tool-help-tooltip" role="tooltip" style={{ left: toolHelp.x, top: toolHelp.y }}>
          <header><strong>{toolHelp.label}</strong>{toolHelp.shortcut && <kbd>{toolHelp.shortcut}</kbd>}</header>
          {toolHelp.state && <p className="tool-help-state">Niedostępne · {toolHelp.state}</p>}
          <p>{toolHelp.help}</p>
        </div>
      )}
    </section>
    </ToolHelpContext.Provider>
  );
}
