import React from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { BSPT_THREAD_SIZES, ISO_CLEARANCE_THREAD_SIZES, ISO_INTERNAL_THREAD_CLASSES, ISO_METRIC_THREAD_SIZES, NPT_THREAD_SIZES, applyHoleStandard, findMetricThreadSize, findPipeThreadSize } from '../cad-core/hole-standards.js';
import { isDockableCommand } from './panel-layout.js';
import { Field } from './WorkspacePanels.jsx';
import { FORM_CONTROL_EDGES, FORM_CONTROL_FACES, bridgeFormFaces, createBoxControlCage, formControlSymmetryPairs, insertFormEdgeLoop, symmetricFormFaceIndexes, updateFormControlOffset as applyFormControlOffset } from '../cad-core/subdivision-form.js';

export function CommandDialog({ command, profileName, collapsed, dock, onChange, onConfirm, onConfirmDynamic, onCancel, onUndoSegment, onFinishPath, onToggleCollapsed }) {
  if (!isDockableCommand(command)) return null;
  const isRectangle = command.type === 'rectangle';
  const isCircle = command.type === 'circle';
  const isArc = command.type === 'arc';
  const isPolygon = command.type === 'polygon';
  const isEllipse = command.type === 'ellipse';
  const isSlot = command.type === 'slot';
  const isSpline = command.type === 'spline';
  const isConic = command.type === 'conic';
  const isPoint = command.type === 'point';
  const isSketch3D = command.type === 'sketch3d';
  const isSketch3DEdit = command.type === 'editSketch3d';
  const isMechanicalShape = isRectangle || isCircle || isArc || isPolygon || isEllipse || isSlot || isSpline || isConic;
  const isExtrude = command.type === 'extrude';
  const isSheetBase = command.type === 'sheetBase';
  const isSheetFlange = command.type === 'sheetFlange';
  const isSheetHem = command.type === 'sheetHem';
  const isSheetRip = command.type === 'sheetRip';
  const isPlasticBoss = command.type === 'plasticBoss';
  const isPlasticSnapFit = command.type === 'plasticSnapFit';
  const isPlasticGrille = command.type === 'plasticGrille';
  const isSurfacePatch = command.type === 'surfacePatch';
  const isSurfaceExtrude = command.type === 'surfaceExtrude';
  const isSurfaceRevolve = command.type === 'surfaceRevolve';
  const isSurfaceSweep = command.type === 'surfaceSweep';
  const isSurfaceLoft = command.type === 'surfaceLoft';
  const isSurfaceOffset = command.type === 'surfaceOffset';
  const isSurfaceStitch = command.type === 'surfaceStitch';
  const isSurfaceTrim = command.type === 'surfaceTrim';
  const isSurfaceExtend = command.type === 'surfaceExtend';
  const isThickenSurface = command.type === 'thickenSurface';
  const isRevolve = command.type === 'revolve';
  const isSweep = command.type === 'sweep';
  const isLoft = command.type === 'loft';
  const isRib = command.type === 'rib';
  const isCoil = command.type === 'coil';
  const isPipe = command.type === 'pipe';
  const isPattern = command.type === 'pattern';
  const isBoolean = command.type === 'boolean';
  const isPrimitive = command.type === 'primitive';
  const isFormBody = command.type === 'formBody';
  const baseFormControlOffsets = Array.from({ length: 8 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command.controlOffsets?.[index]?.[axis] ?? '0'));
  const insertedFormControlOffsets = command.insertEdgeEnabled ? Array.from({ length: 4 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command.insertEdgeOffsets?.[index]?.[axis] ?? '0')) : [];
  let formTopologyCage = createBoxControlCage(2, 2, 2);
  if (command.insertEdgeEnabled) formTopologyCage = insertFormEdgeLoop(formTopologyCage, FORM_CONTROL_EDGES[command.insertEdgeIndex || 0], Number(command.insertEdgePosition) || 0.5);
  const formControlFaces = formTopologyCage.faces;
  const bridgeConfig = { enabled: command.bridgeEnabled, firstFaceIndex: command.bridgeFirstFace || 0, secondFaceIndex: command.bridgeSecondFace ?? 1, inset: Number(command.bridgeInset) > 0.1 && Number(command.bridgeInset) < 0.9 ? Number(command.bridgeInset) : 0.45 };
  let fillTopologyCage = formTopologyCage;
  if (bridgeConfig.enabled) fillTopologyCage = bridgeFormFaces(fillTopologyCage, bridgeConfig.firstFaceIndex, bridgeConfig.secondFaceIndex, bridgeConfig.inset);
  const fillControlFaces = fillTopologyCage.faces;
  const resolveFillHoleFaceIndexes = (faceIndex = command.fillHoleFace || 0, symmetry = command.symmetry) => symmetricFormFaceIndexes(
    fillTopologyCage,
    symmetry && symmetry !== 'none' ? formControlSymmetryPairs({ enabled: command.insertEdgeEnabled, edgeIndex: command.insertEdgeIndex || 0, position: Number(command.insertEdgePosition) || 0.5 }, symmetry, bridgeConfig) : null,
    Math.min(fillControlFaces.length - 1, Math.max(0, Number(faceIndex) || 0)),
  );
  const bridgeFormControlOffsets = command.bridgeEnabled ? Array.from({ length: 8 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command.bridgeOffsets?.[index]?.[axis] ?? '0')) : [];
  const fillHoleControlOffsets = command.fillHoleEnabled ? Array.from({ length: resolveFillHoleFaceIndexes().length }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => command.fillHoleOffsets?.[index]?.[axis] ?? '0')) : [];
  const formControlOffsets = [...baseFormControlOffsets, ...insertedFormControlOffsets, ...bridgeFormControlOffsets, ...fillHoleControlOffsets];
  const findBridgePair = (preferredFace = 0, symmetry = command.symmetry, faces = formControlFaces, insertEdge = { enabled: command.insertEdgeEnabled, edgeIndex: command.insertEdgeIndex || 0, position: Number(command.insertEdgePosition) || 0.5 }) => {
    const pointPairs = formControlSymmetryPairs(insertEdge, symmetry);
    const candidates = [preferredFace, ...faces.map((_face, index) => index).filter((index) => index !== preferredFace)];
    for (const firstFace of candidates) {
      for (let secondFace = 0; secondFace < faces.length; secondFace += 1) {
        if (secondFace === firstFace || faces[secondFace].some((point) => faces[firstFace]?.includes(point))) continue;
        const sourcePoints = new Set([...faces[firstFace], ...faces[secondFace]]);
        if (!symmetry || symmetry === 'none' || [...sourcePoints].every((point) => sourcePoints.has(pointPairs[point]))) return [firstFace, secondFace];
      }
    }
    return [0, 1];
  };
  const selectedFormControlPoint = Math.min(formControlOffsets.length - 1, Math.max(0, Number(command.selectedControlPoint) || 0));
  const selectedFormControlEdge = command.insertEdgeEnabled ? Math.max(0, Number(command.selectedControlEdge) || 0) : Math.min(FORM_CONTROL_EDGES.length - 1, Math.max(0, Number(command.selectedControlEdge) || 0));
  const selectedFormControlFace = command.insertEdgeEnabled ? Math.max(0, Number(command.selectedControlFace) || 0) : Math.min(FORM_CONTROL_FACES.length - 1, Math.max(0, Number(command.selectedControlFace) || 0));
  const selectedFormControlKind = ['point', 'edge', 'face'].includes(command.selectedControlKind) ? command.selectedControlKind : 'point';
  const formCreaseEdges = new Set(command.creaseEdges || []);
  const updateFormControlOffset = (axis, value) => {
    const offset = [...formControlOffsets[selectedFormControlPoint]];
    offset[axis] = value;
    const symmetryPairs = formControlSymmetryPairs({ enabled: command.insertEdgeEnabled, edgeIndex: command.insertEdgeIndex || 0, position: Number(command.insertEdgePosition) || 0.5 }, command.symmetry, bridgeConfig, { enabled: command.fillHoleEnabled, faceIndex: command.fillHoleFace || 0 });
    const nextOffsets = applyFormControlOffset(formControlOffsets, selectedFormControlPoint, offset, command.symmetry, symmetryPairs);
    const insertEnd = 8 + insertedFormControlOffsets.length;
    const bridgeEnd = insertEnd + bridgeFormControlOffsets.length;
    onChange({ controlOffsets: nextOffsets.slice(0, 8), insertEdgeOffsets: nextOffsets.slice(8, insertEnd), bridgeOffsets: nextOffsets.slice(insertEnd, bridgeEnd), fillHoleOffsets: nextOffsets.slice(bridgeEnd) });
  };
  const isTransform = command.type === 'transform';
  const isOffsetFace = command.type === 'offsetFace';
  const isTextSolid = command.type === 'textSolid';
  const isHole = command.type === 'hole';
  const holeStandardApplication = command.holeApplication === 'clearance'
    ? `clearance-${command.clearanceClass || 'medium'}`
    : ['tapped', 'npt-tapped', 'bspt-tapped'].includes(command.holeApplication) ? command.holeApplication : 'custom';
  const pipeFamily = holeStandardApplication === 'npt-tapped' ? 'npt' : holeStandardApplication === 'bspt-tapped' ? 'bspt' : null;
  const isPipeThread = Boolean(pipeFamily);
  const selectedMetricSize = findMetricThreadSize(command.standardSize) || ISO_METRIC_THREAD_SIZES.find((size) => size.id === 'M6');
  const pipeSizes = pipeFamily === 'npt' ? NPT_THREAD_SIZES : BSPT_THREAD_SIZES;
  const selectedPipeSize = findPipeThreadSize(command.standardSize, pipeFamily) || pipeSizes[0];
  const selectableMetricSizes = holeStandardApplication.startsWith('clearance-') ? ISO_CLEARANCE_THREAD_SIZES : ISO_METRIC_THREAD_SIZES;
  const isStandardThread = holeStandardApplication === 'tapped' || isPipeThread;
  const isFillet = command.type === 'fillet';
  const isShell = command.type === 'shell';
  const isDraftFeature = command.type === 'draft';
  const isSplitBody = command.type === 'splitBody';
  const isSplitFace = command.type === 'splitFace';
  const isDeleteFace = command.type === 'deleteFace';
  const isReplaceFace = command.type === 'replaceFace';
  const requiresFeaturePreview = isExtrude || isSheetBase || isSheetFlange || isSheetHem || isSheetRip || isPlasticBoss || isPlasticSnapFit || isPlasticGrille || isSurfacePatch || isSurfaceExtrude || isSurfaceRevolve || isSurfaceSweep || isSurfaceLoft || isSurfaceOffset || isSurfaceStitch || isSurfaceTrim || isSurfaceExtend || isThickenSurface || isRevolve || isSweep || isLoft || isRib || isCoil || isPipe || isPattern || isBoolean || isPrimitive || isFormBody || isTransform || isOffsetFace || isTextSolid || isHole || isFillet || isShell || isDraftFeature || isSplitBody || isSplitFace || isDeleteFace || isReplaceFace;
  const featurePreviewPending = requiresFeaturePreview && !command.previewFeature;
  const isSketchPath = command.type === 'line' || command.type === 'polyline' || isSketch3D;
  const isSketchMove = command.type === 'moveSketch';
  const isSketchOffset = command.type === 'offsetSketch';
  const isSketchCorner = command.type === 'cornerSketch';
  const isSketchTransform = command.type === 'transformSketch';
  const isSketchPattern = command.type === 'patternSketch';
  const isProjectSketch = command.type === 'projectSketch';
  const isProjectSurface = command.type === 'projectSurface';
  const isOffsetPlane = command.type === 'offsetPlane';
  const isMidplane = command.type === 'midplanePlane';
  const isThreePointPlane = command.type === 'threePointPlane';
  const isAnglePlane = command.type === 'anglePlane';
  const isTangentPlane = command.type === 'tangentPlane';
  const isPathPlane = command.type === 'pathPlane';
  const isConstructionPlane = isOffsetPlane || isMidplane || isThreePointPlane || isAnglePlane || isTangentPlane || isPathPlane;
  const isConstructionAxis = command.type === 'constructionAxis';
  const axisTitles = { edge: 'Oś z krawędzi', cylinder: 'Oś walca', 'two-points': 'Oś przez dwa punkty', 'plane-intersection': 'Oś przecięcia płaszczyzn', 'plane-normal': 'Oś normalna do płaszczyzny' };
  const isConstructionPoint = command.type === 'constructionPoint';
  const pointTitles = { vertex: 'Punkt na wierzchołku', center: 'Punkt środka', intersection: 'Punkt przecięcia', midpoint: 'Punkt środkowy', 'on-axis': 'Punkt na osi' };
  const title = isRectangle ? 'Prostokąt' : isCircle ? 'Okrąg' : isArc ? 'Łuk' : isPolygon ? 'Wielokąt regularny' : isEllipse ? 'Elipsa' : isSlot ? 'Slot' : isSpline ? 'Spline' : isConic ? 'Krzywa conic' : isPoint ? 'Punkt szkicu' : isSketch3D ? 'Szkic 3D' : isSketch3DEdit ? 'Edytuj krzywą 3D' : isProjectSketch ? (command.resumeSketch3D ? 'Pobierz krawędzie' : 'Project') : isExtrude ? 'Wyciągnięcie' : isSheetBase ? 'Baza blachowa' : isSheetFlange ? 'Kołnierz blachy' : isSheetHem ? 'Zawinięcie blachy' : isSheetRip ? 'Szczelina blachy' : isPlasticBoss ? 'Boss' : isSurfacePatch ? 'Patch powierzchni' : isSurfaceExtrude ? 'Wyciągnięcie powierzchni' : isSurfaceRevolve ? 'Obrót powierzchni' : isSurfaceSweep ? 'Powierzchnia po ścieżce' : isSurfaceLoft ? 'Powierzchnia przejściowa' : isSurfaceOffset ? 'Odsunięcie powierzchni' : isSurfaceStitch ? 'Zszyj powierzchnie' : isSurfaceTrim ? 'Przytnij powierzchnię' : isSurfaceExtend ? 'Przedłuż powierzchnię' : isThickenSurface ? 'Pogrub powierzchnię' : isRevolve ? 'Revolve' : isSweep ? 'Sweep' : isLoft ? 'Loft' : isRib ? 'Rib/Web' : isCoil ? 'Coil' : isPipe ? 'Pipe' : isPattern ? 'Pattern' : isBoolean ? 'Boolean' : isPrimitive ? 'Prymityw 3D' : isTransform ? (command.mode === 'rotate' ? 'Obróć bryłę' : 'Przesuń bryłę') : isOffsetFace ? 'Offset Face' : isTextSolid ? 'Tekst 3D' : isHole ? 'Otwór' : isFillet ? 'Zaokrąglenie' : isShell ? 'Shell' : isDraftFeature ? 'Draft' : isSplitBody ? 'Split Body' : isSplitFace ? 'Split Face' : isDeleteFace ? 'Delete Face + Heal' : isReplaceFace ? 'Replace Face' : command.type === 'line' ? 'Linia' : command.type === 'polyline' ? 'Polilinia' : isSketchMove ? 'Przesuń geometrię' : isSketchOffset ? 'Offset szkicu' : isSketchCorner ? (command.mode === 'fillet' ? 'Fillet szkicu' : 'Chamfer szkicu') : isSketchTransform ? 'Transformuj szkic' : isSketchPattern ? 'Szyk szkicu' : isOffsetPlane ? 'Płaszczyzna odsunięta' : isMidplane ? 'Płaszczyzna środkowa' : isThreePointPlane ? 'Płaszczyzna przez trzy punkty' : isAnglePlane ? 'Płaszczyzna pod kątem' : isTangentPlane ? 'Płaszczyzna styczna' : isPathPlane ? 'Płaszczyzna na ścieżce' : isConstructionAxis ? axisTitles[command.axisType] : isConstructionPoint ? pointTitles[command.pointType] : 'Fazowanie';
  const dialogTitle = isProjectSurface ? 'Project to Surface' : isPlasticSnapFit ? 'Snap-fit' : isPlasticGrille ? 'Grille' : isFormBody ? 'Form' : title;
  return (
    <section className={`command-dialog docked dock-${dock} ${collapsed ? 'collapsed' : ''} ${isSketchPath ? 'sketch-path-dialog' : ''}`} aria-label={`${dialogTitle} — panel polecenia`}>
      <header>
        <strong>{dialogTitle}</strong>
        <div className="dock-panel-actions">
          <button type="button" data-panel-action="collapse" onClick={onToggleCollapsed} title={collapsed ? 'Rozwiń panel polecenia' : 'Zwiń panel polecenia'} aria-label={collapsed ? 'Rozwiń panel polecenia' : 'Zwiń panel polecenia'} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>
          {!collapsed && <button type="button" onClick={onCancel} title="Zamknij polecenie" aria-label="Zamknij polecenie"><X size={15} /></button>}
        </div>
      </header>
      {!collapsed && <>
      <div className="command-dialog-body">
        {isProjectSketch && <p className="command-hint">Wybierz krawędzie albo wierzchołki modelu, a następnie kliknij Pobierz.</p>}
        {isProjectSurface && <p className="command-hint">Wybierz zakrzywioną ścianę modelu, a następnie kliknij Rzutuj.</p>}
        {isMechanicalShape && <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} />}
        {(isRectangle || isCircle || isArc || isPolygon || isEllipse || isSlot || isSpline) && (
          <label className="command-field">
            <span>Metoda</span>
            <select value={command.definition} onChange={(event) => onChange({ definition: event.target.value, gesturePoints: [] })} disabled={Boolean(command.editId)}>
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
        {(isExtrude || isSheetBase || isSurfacePatch || isSurfaceExtrude || isSurfaceRevolve || isSurfaceSweep || isSurfaceLoft || isRevolve || isSweep || isLoft || isRib || (isHole && command.placement !== 'face-edges')) && <Field label={isLoft || isSurfaceLoft ? 'Profil początkowy' : isRib || ((isSurfaceExtrude || isSurfaceRevolve || isSurfaceSweep) && command.openChain) ? 'Otwarty profil' : 'Profil'} value={profileName || (command.openChain ? 'Zaznaczony łańcuch' : '')} disabled />}
        {isSheetBase && <><Field label="Grubość blachy" value={command.thickness} onChange={(thickness) => onChange({ thickness })} suffix="mm" autoFocus /><Field label="Promień gięcia" value={command.bendRadius} onChange={(bendRadius) => onChange({ bendRadius })} suffix="mm" /><Field label="Współczynnik K" value={command.kFactor} onChange={(kFactor) => onChange({ kFactor })} /><label className="command-field"><span>Strona</span><select value={command.side} onChange={(event) => onChange({ side: event.target.value })}><option value="one-side">Jedna strona</option><option value="symmetric">Symetrycznie</option></select></label><label className="command-field"><span>Odwróć kierunek</span><input type="checkbox" checked={Boolean(command.reverse)} disabled={command.side === 'symmetric'} onChange={(event) => onChange({ reverse: event.target.checked })} /></label><p className="command-hint">Te wartości tworzą regułę blachy używaną przez kolejne gięcia i rozwinięcie.</p></>}
        {isSheetFlange && <><Field label="Wybrana krawędź" value={command.edgeLabel || '1 prosta krawędź'} disabled /><Field label="Długość kołnierza" value={command.length} onChange={(length) => onChange({ length })} suffix="mm" autoFocus /><Field label="Kąt gięcia" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" /><Field label="Promień gięcia" value={command.bendRadius} onChange={(bendRadius) => onChange({ bendRadius })} suffix="mm" /><label className="command-field"><span>Odwróć kierunek</span><input type="checkbox" checked={Boolean(command.reverse)} onChange={(event) => onChange({ reverse: event.target.checked })} /></label><p className="command-hint">Kołnierz pozostaje częścią tej samej bryły i dziedziczy grubość oraz współczynnik K z reguły blachy.</p></>}
        {isSheetHem && <><Field label="Wybrana krawędź" value={command.edgeLabel || '1 prosta krawędź'} disabled /><Field label="Długość zakładki" value={command.length} onChange={(length) => onChange({ length })} suffix="mm" autoFocus /><Field label="Szczelina zawinięcia" value={command.gap} onChange={(gap) => onChange({ gap })} suffix="mm" /><label className="command-field"><span>Odwróć kierunek</span><input type="checkbox" checked={Boolean(command.reverse)} onChange={(event) => onChange({ reverse: event.target.checked })} /></label><p className="command-hint">Zawinięcie wykonuje pełny łuk 180°; szczelina określa prześwit między równoległymi warstwami blachy.</p></>}
        {isSheetRip && <><Field label="Wybrana krawędź" value={command.edgeLabel || '1 prosta krawędź'} disabled /><Field label="Szerokość szczeliny" value={command.gap} onChange={(gap) => onChange({ gap })} suffix="mm" autoFocus /><p className="command-hint">Szczelina usuwa kontrolowany pas materiału wzdłuż całej wybranej krawędzi.</p></>}
        {isPlasticBoss && <><Field label="Powierzchnia" value={command.faceLabel || 'Planarna ściana'} disabled /><Field label="Średnica zewnętrzna" value={command.outerDiameter} onChange={(outerDiameter) => onChange({ outerDiameter })} suffix="mm" autoFocus /><Field label="Średnica otworu" value={command.holeDiameter} onChange={(holeDiameter) => onChange({ holeDiameter })} suffix="mm" /><Field label="Wysokość" value={command.height} onChange={(height) => onChange({ height })} suffix="mm" /><Field label="Głębokość otworu" value={command.holeDepth} onChange={(holeDepth) => onChange({ holeDepth })} suffix="mm" /><Field label="Przesunięcie X" value={command.offsetX} onChange={(offsetX) => onChange({ offsetX })} suffix="mm" /><Field label="Przesunięcie Y" value={command.offsetY} onChange={(offsetY) => onChange({ offsetY })} suffix="mm" /><label className="command-field"><span>Odwróć kierunek</span><input type="checkbox" checked={Boolean(command.reverse)} onChange={(event) => onChange({ reverse: event.target.checked })} /></label><p className="command-hint">Boss jest łączony z tą samą bryłą, a otwór przechodzi przez Boss i na zadaną głębokość w podporę.</p></>}
        {isPlasticSnapFit && <><Field label="Powierzchnia" value={command.faceLabel || 'Planarna ściana'} disabled /><Field label="Długość ramienia" value={command.length} onChange={(length) => onChange({ length })} suffix="mm" autoFocus /><Field label="Szerokość ramienia" value={command.width} onChange={(width) => onChange({ width })} suffix="mm" /><Field label="Grubość ramienia" value={command.thickness} onChange={(thickness) => onChange({ thickness })} suffix="mm" /><Field label="Prześwit pod ramieniem" value={command.clearance} onChange={(clearance) => onChange({ clearance })} suffix="mm" /><Field label="Długość zaczepu" value={command.hookLength} onChange={(hookLength) => onChange({ hookLength })} suffix="mm" /><Field label="Wysokość zaczepu" value={command.hookHeight} onChange={(hookHeight) => onChange({ hookHeight })} suffix="mm" /><Field label="Przesunięcie X" value={command.offsetX} onChange={(offsetX) => onChange({ offsetX })} suffix="mm" /><Field label="Przesunięcie Y" value={command.offsetY} onChange={(offsetY) => onChange({ offsetY })} suffix="mm" /><label className="command-field"><span>Odwróć kierunek</span><input type="checkbox" checked={Boolean(command.reverse)} onChange={(event) => onChange({ reverse: event.target.checked })} /></label><p className="command-hint">Stopa łączy zatrzask z bryłą, a prześwit pozostawia wolną część ramienia zdolną do ugięcia.</p></>}
        {isPlasticGrille && <><Field label="Powierzchnia" value={command.faceLabel || 'Planarna ściana'} disabled /><Field label="Liczba żeber" value={command.ribCount} onChange={(ribCount) => onChange({ ribCount })} autoFocus /><Field label="Szerokość żebra" value={command.ribWidth} onChange={(ribWidth) => onChange({ ribWidth })} suffix="mm" /><Field label="Prześwit" value={command.gap} onChange={(gap) => onChange({ gap })} suffix="mm" /><Field label="Długość szczelin" value={command.length} onChange={(length) => onChange({ length })} suffix="mm" /><Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" /><Field label="Przesunięcie X" value={command.offsetX} onChange={(offsetX) => onChange({ offsetX })} suffix="mm" /><Field label="Przesunięcie Y" value={command.offsetY} onChange={(offsetY) => onChange({ offsetY })} suffix="mm" /><label className="command-field"><span>Odwróć kierunek</span><input type="checkbox" checked={Boolean(command.reverse)} onChange={(event) => onChange({ reverse: event.target.checked })} /></label><p className="command-hint">Narzędzie wycina równoległe szczeliny i pozostawia parametryczne żebra wentylacyjne w tej samej bryle.</p></>}
        {isSurfacePatch && <p className="command-hint">Powstanie planarna powierzchnia B-Rep powiązana z tym profilem szkicu.</p>}
        {isSurfaceExtrude && <Field label="Odległość" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus />}
        {isSurfaceRevolve && <><label className="command-field"><span>Oś obrotu</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><Field label="Kąt obrotu" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" autoFocus /><p className="command-hint">Tworzy otwartą powierzchnię B-Rep. Poleceniem Pogrub możesz później zamienić ją w bryłę.</p></>}
        {isSurfaceSweep && <><label className="command-field"><span>Ścieżka</span><select value={command.pathSketchId} onChange={(event) => { const path = command.pathOptions.find((item) => item.id === event.target.value); onChange({ pathSketchId: path.id, pathEntityIds: path.entityIds }); }}>{command.pathOptions.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label><p className="command-hint">Prowadzi profil jako otwartą powierzchnię B-Rep po osobnym szkicu ścieżki.</p></>}
        {isSurfaceLoft && <><label className="command-field"><span>Profil końcowy</span><select value={command.endProfileId} onChange={(event) => { const target = command.profileOptions.find((profile) => profile.id === event.target.value); onChange({ endProfileId: target?.id || '', endSketchId: target?.sketchId || '' }); }}>{command.profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="command-field"><span>Przejście</span><select value={command.loftMode} onChange={(event) => onChange({ loftMode: event.target.value })}><option value="smooth">Gładkie</option><option value="ruled">Odcinkowe</option></select></label><p className="command-hint">Łączy dwa zamknięte profile otwartą powierzchnią B-Rep.</p></>}
        {isSurfaceOffset && <><Field label="Powierzchnia" value={command.targetName || command.targetBodyId} disabled /><Field label="Odległość" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus /><p className="command-hint">Wartość ujemna odsuwa powierzchnię w przeciwnym kierunku.</p></>}
        {isSurfaceStitch && <><Field label="Powierzchnie" value={`${command.targetBodyIds.length} wybrane`} disabled /><Field label="Tolerancja" value={command.tolerance} onChange={(tolerance) => onChange({ tolerance })} suffix="mm" autoFocus /><p className="command-hint">Łączy stykające się krawędzie. Zamknięty płaszcz automatycznie staje się bryłą.</p></>}
        {isSurfaceTrim && <><Field label="Powierzchnia" value={command.targetName || command.targetBodyId} disabled /><Field label="Bryła tnąca" value={command.toolName || command.toolBodyId} disabled /><label className="command-field"><span>Zachowaj bryłę tnącą</span><input type="checkbox" checked={command.keepTool !== false} onChange={(event) => onChange({ keepTool: event.target.checked })} /></label><p className="command-hint">Usuwa część powierzchni znajdującą się wewnątrz bryły tnącej.</p></>}
        {isSurfaceExtend && <><Field label="Powierzchnia" value={command.targetName || command.targetBodyId} disabled /><Field label="Krawędź" value={command.edgeLabel || '1 wybrana'} disabled /><Field label="Odległość" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus /><p className="command-hint">Przedłuża wybraną prostą krawędź planarnej powierzchni bez zmiany pozostałego obrysu.</p></>}
        {isThickenSurface && <><Field label="Powierzchnia" value={command.targetName || command.targetBodyId} disabled /><Field label="Grubość" value={command.thickness} onChange={(thickness) => onChange({ thickness })} suffix="mm" autoFocus /><label className="command-field"><span>Strona</span><select value={command.side} onChange={(event) => onChange({ side: event.target.value })}><option value="one-side">Jedna strona</option><option value="symmetric">Symetrycznie</option></select></label><label className="command-field"><span>Odwróć kierunek</span><input type="checkbox" checked={Boolean(command.reverse)} onChange={(event) => onChange({ reverse: event.target.checked })} /></label></>}
        {isExtrude && (
          <>
            {!['through-all', 'to-object'].includes(command.extent) && <Field label={command.extent === 'symmetric' ? 'Długość całkowita' : 'Odległość'} value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus />}
            {command.extent === 'two-sides' && <Field label="Druga strona" value={command.secondDistance} onChange={(secondDistance) => onChange({ secondDistance })} suffix="mm" />}
            {command.extent === 'to-object' && <label className="command-field"><span>Obiekt docelowy</span><select value={command.targetReferenceId || ''} onChange={(event) => onChange({ targetReferenceId: event.target.value })}>{command.targetOptions.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>}
            <Field label="Odsunięcie początku" value={command.startOffset} onChange={(startOffset) => onChange({ startOffset })} suffix="mm" />
            <label className="command-field"><span>Cienka ścianka</span><input type="checkbox" checked={Boolean(command.thin)} disabled={command.openChain} onChange={(event) => onChange({ thin: event.target.checked })} /></label>
            {command.thin && <><Field label="Grubość ścianki" value={command.wallThickness} onChange={(wallThickness) => onChange({ wallThickness })} suffix="mm" /><label className="command-field"><span>Strona ścianki</span><select value={command.wallSide} onChange={(event) => onChange({ wallSide: event.target.value })}><option value="inside">Do wewnątrz</option><option value="outside">Na zewnątrz</option><option value="symmetric">Symetrycznie</option></select></label>{command.openChain && <label className="command-field"><span>Zakończenie</span><select value={command.endCap} onChange={(event) => onChange({ endCap: event.target.value })}><option value="butt">Proste</option><option value="square">Wydłużone</option></select></label>}</>}
            <label className="command-field">
              <span>Operacja</span>
              <select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}>
                <option value="new">Nowa bryła</option>
                <option value="join">Połącz</option>
                <option value="cut">Wytnij</option>
                <option value="intersect">Część wspólna</option>
              </select>
            </label>
            <label className="command-field"><span>Kierunek</span><select value={command.extent} onChange={(event) => onChange({ extent: event.target.value })}><option value="one-side">Jedna strona</option><option value="two-sides">Dwie strony</option><option value="symmetric">Symetrycznie</option><option value="to-object" disabled={!command.targetOptions.length}>Do obiektu</option><option value="through-all" disabled={!['cut', 'intersect'].includes(command.operation)}>Through All</option></select></label>
          </>
        )}
        {isRevolve && <><label className="command-field"><span>Oś obrotu</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><Field label="Kąt Revolve" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" autoFocus /><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isSweep && <><label className="command-field"><span>Ścieżka Sweep</span><select value={command.pathSketchId} onChange={(event) => onChange({ pathSketchId: event.target.value, pathEntityIds: command.pathOptions.find((path) => path.id === event.target.value)?.entityIds || [] })}>{command.pathOptions.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isLoft && <><label className="command-field"><span>Profil końcowy</span><select value={command.endProfileId} onChange={(event) => { const target = command.profileOptions.find((profile) => profile.id === event.target.value); onChange({ endProfileId: target?.id || '', endSketchId: target?.sketchId || '' }); }}>{command.profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="command-field"><span>Przejście</span><select value={command.loftMode} onChange={(event) => onChange({ loftMode: event.target.value })}><option value="smooth">Gładkie</option><option value="ruled">Odcinkowe</option></select></label><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isRib && <><label className="command-field"><span>Typ</span><select value={command.ribMode} onChange={(event) => onChange({ ribMode: event.target.value })}><option value="rib">Rib · wzrost w płaszczyźnie</option><option value="web">Web · wzrost prostopadły</option></select></label><Field label="Grubość" value={command.thickness} onChange={(thickness) => onChange({ thickness })} suffix="mm" autoFocus /><Field label="Zasięg" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" /><label className="command-field"><span>Strona</span><select value={command.wallSide} onChange={(event) => onChange({ wallSide: event.target.value })}><option value="inside">Lewa</option><option value="outside">Prawa</option><option value="symmetric">Symetrycznie</option></select></label><label className="command-field"><span>Odwróć kierunek</span><input type="checkbox" checked={Boolean(command.reverse)} onChange={(event) => onChange({ reverse: event.target.checked })} /></label></>}
        {isCoil && <><label className="command-field"><span>Oś Coil</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><Field label="Średnica Coil" value={command.coilDiameter} onChange={(coilDiameter) => onChange({ coilDiameter })} suffix="mm" autoFocus /><Field label="Średnica przekroju" value={command.wireDiameter} onChange={(wireDiameter) => onChange({ wireDiameter })} suffix="mm" /><Field label="Skok" value={command.pitch} onChange={(pitch) => onChange({ pitch })} suffix="mm" /><Field label="Liczba zwojów" value={command.turns} onChange={(turns) => onChange({ turns })} /><label className="command-field"><span>Kierunek zwoju</span><select value={command.handedness} onChange={(event) => onChange({ handedness: event.target.value })}><option value="right">Prawoskrętny</option><option value="left">Lewoskrętny</option></select></label><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isPipe && <><Field label="Ścieżka Pipe" value={profileName} disabled /><Field label="Średnica zewnętrzna" value={command.outsideDiameter} onChange={(outsideDiameter) => onChange({ outsideDiameter })} suffix="mm" autoFocus /><Field label="Grubość ścianki" value={command.wallThickness} onChange={(wallThickness) => onChange({ wallThickness })} suffix="mm" /><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isPattern && <><Field label="Bryła źródłowa" value={command.targetBodyId} disabled /><label className="command-field"><span>Typ szyku</span><select value={command.patternType} onChange={(event) => onChange({ patternType: event.target.value })}><option value="rectangular">Prostokątny</option><option value="circular">Kołowy</option><option value="path" disabled={!command.pathOptions.length}>Po ścieżce</option></select></label>{command.patternType === 'rectangular' && <><Field label="Kolumny" value={command.countX} onChange={(countX) => onChange({ countX })} /><Field label="Wiersze" value={command.countY} onChange={(countY) => onChange({ countY })} /><Field label="Odstęp X" value={command.spacingX} onChange={(spacingX) => onChange({ spacingX })} suffix="mm" /><Field label="Odstęp Y" value={command.spacingY} onChange={(spacingY) => onChange({ spacingY })} suffix="mm" /></>}{command.patternType === 'circular' && <><label className="command-field"><span>Oś szyku</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><Field label="Wystąpienia" value={command.occurrences} onChange={(occurrences) => onChange({ occurrences })} /><Field label="Kąt całkowity" value={command.totalAngle} onChange={(totalAngle) => onChange({ totalAngle })} suffix="°" /></>}{command.patternType === 'path' && <><label className="command-field"><span>Ścieżka</span><select value={command.pathSketchId} onChange={(event) => { const path = command.pathOptions.find((item) => item.id === event.target.value); onChange({ pathSketchId: path?.id, pathEntityIds: path?.entityIds || [] }); }}>{command.pathOptions.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label><Field label="Wystąpienia" value={command.occurrences} onChange={(occurrences) => onChange({ occurrences })} /></>}</>}
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
        {isFormBody && <>
          <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} />
          <Field label="Szerokość klatki" value={command.width} onChange={(width) => onChange({ width })} suffix="mm" autoFocus />
          <Field label="Głębokość klatki" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" />
          <Field label="Wysokość klatki" value={command.height} onChange={(height) => onChange({ height })} suffix="mm" />
          <Field label="Poziom wygładzenia" value={command.subdivisions} onChange={(subdivisions) => onChange({ subdivisions })} />
          <label className="command-field"><span>Symetria klatki</span><select value={command.symmetry || 'none'} onChange={(event) => {
            const symmetry = event.target.value;
            const [bridgeFirstFace, bridgeSecondFace] = command.bridgeEnabled ? findBridgePair(command.bridgeFirstFace || 0, symmetry) : [command.bridgeFirstFace, command.bridgeSecondFace];
            onChange({ symmetry, bridgeFirstFace, bridgeSecondFace });
          }}><option value="none">Wyłączona</option><option value="x">Względem X</option><option value="y">Względem Y</option><option value="z">Względem Z</option></select></label>
          <label className="command-field"><span>Tryb edycji</span><select value={selectedFormControlKind} onChange={(event) => onChange({ selectedControlKind: event.target.value })}><option value="point">Punkt</option><option value="edge">Krawędź</option><option value="face">Ściana</option></select></label>
          {selectedFormControlKind === 'point' && <>
            <label className="command-field"><span>Punkt kontrolny</span><select value={selectedFormControlPoint} onChange={(event) => onChange({ selectedControlPoint: Number(event.target.value) })}>{formControlOffsets.map((_point, index) => <option key={index} value={index}>Punkt {index + 1}</option>)}</select></label>
            <Field label="Przesunięcie punktu X" value={formControlOffsets[selectedFormControlPoint][0]} onChange={(value) => updateFormControlOffset(0, value)} suffix="mm" />
            <Field label="Przesunięcie punktu Y" value={formControlOffsets[selectedFormControlPoint][1]} onChange={(value) => updateFormControlOffset(1, value)} suffix="mm" />
            <Field label="Przesunięcie punktu Z" value={formControlOffsets[selectedFormControlPoint][2]} onChange={(value) => updateFormControlOffset(2, value)} suffix="mm" />
          </>}
          {selectedFormControlKind === 'edge' && <>
            {!command.insertEdgeEnabled && <label className="command-field"><span>Krawędź kontrolna</span><select value={selectedFormControlEdge} onChange={(event) => onChange({ selectedControlEdge: Number(event.target.value) })}>{FORM_CONTROL_EDGES.map(([first, second], index) => <option key={index} value={index}>Krawędź {index + 1} · P{first + 1}–P{second + 1}</option>)}</select></label>}
            {command.insertEdgeEnabled && <Field label="Krawędź kontrolna" value={`Krawędź ${selectedFormControlEdge + 1}`} disabled />}
            {!command.insertEdgeEnabled && <label className="command-field"><span>Charakter krawędzi</span><select value={formCreaseEdges.has(selectedFormControlEdge) ? 'crease' : 'smooth'} onChange={(event) => {
              const creaseEdges = new Set(command.creaseEdges || []);
              if (event.target.value === 'crease') creaseEdges.add(selectedFormControlEdge);
              else creaseEdges.delete(selectedFormControlEdge);
              onChange({ creaseEdges: [...creaseEdges].sort((first, second) => first - second) });
            }}><option value="smooth">Gładka</option><option value="crease">Ostra · Crease</option></select></label>}
            <label className="command-field"><span>Insert Edge</span><select value={command.insertEdgeEnabled ? 'enabled' : 'disabled'} onChange={(event) => {
              const enabled = event.target.value === 'enabled';
              let nextCage = createBoxControlCage(2, 2, 2);
              if (enabled) nextCage = insertFormEdgeLoop(nextCage, FORM_CONTROL_EDGES[selectedFormControlEdge], Number(command.insertEdgePosition) || 0.5);
              const nextInsertEdge = { enabled, edgeIndex: selectedFormControlEdge, position: Number(command.insertEdgePosition) || 0.5 };
              const [bridgeFirstFace, bridgeSecondFace] = findBridgePair(Math.min(nextCage.faces.length - 1, Number(command.bridgeFirstFace) || 0), command.symmetry, nextCage.faces, nextInsertEdge);
              onChange({ insertEdgeEnabled: enabled, insertEdgeIndex: selectedFormControlEdge, insertEdgePosition: command.insertEdgePosition || '0.5', insertEdgeOffsets: enabled ? Array.from({ length: 4 }, () => ['0', '0', '0']) : [], bridgeFirstFace, bridgeSecondFace });
            }}><option value="disabled">Brak pętli</option><option value="enabled">Wstaw pętlę</option></select></label>
            {command.insertEdgeEnabled && <><Field label="Krawędź źródłowa" value={`Krawędź ${(command.insertEdgeIndex || 0) + 1}`} disabled /><Field label="Położenie pętli" value={command.insertEdgePosition || '0.5'} onChange={(insertEdgePosition) => onChange({ insertEdgePosition })} suffix="0–1" /></>}
          </>}
          {selectedFormControlKind === 'face' && <>
            <Field label="Wybrana na modelu" value={`Ściana ${selectedFormControlFace + 1}`} disabled />
            <label className="command-field"><span>Bridge</span><select value={command.bridgeEnabled ? 'enabled' : 'disabled'} onChange={(event) => {
              const enabled = event.target.value === 'enabled';
              const [bridgeFirstFace, bridgeSecondFace] = findBridgePair(selectedFormControlFace);
              onChange({ bridgeEnabled: enabled, bridgeFirstFace, bridgeSecondFace, bridgeInset: command.bridgeInset || '0.45', bridgeOffsets: enabled ? Array.from({ length: 8 }, () => ['0', '0', '0']) : [] });
            }}><option value="disabled">Bez tunelu</option><option value="enabled">Połącz dwie ściany</option></select></label>
            {command.bridgeEnabled && <>
              <label className="command-field"><span>Ściana źródłowa A</span><select value={command.bridgeFirstFace ?? 0} onChange={(event) => {
                const firstFace = Number(event.target.value);
                const [bridgeFirstFace, bridgeSecondFace] = findBridgePair(firstFace);
                onChange({ bridgeFirstFace, bridgeSecondFace });
              }}>{formControlFaces.map((_face, index) => <option key={index} value={index}>Ściana {index + 1}</option>)}</select></label>
              <label className="command-field"><span>Ściana źródłowa B</span><select value={command.bridgeSecondFace ?? 1} onChange={(event) => {
                const secondFace = Number(event.target.value);
                const [bridgeSecondFace, bridgeFirstFace] = findBridgePair(secondFace);
                onChange({ bridgeFirstFace, bridgeSecondFace });
              }}>{formControlFaces.map((_face, index) => <option key={index} value={index} disabled={index === command.bridgeFirstFace || formControlFaces[index].some((point) => formControlFaces[command.bridgeFirstFace]?.includes(point))}>Ściana {index + 1}</option>)}</select></label>
              <Field label="Wielkość otworu" value={command.bridgeInset || '0.45'} onChange={(bridgeInset) => onChange({ bridgeInset })} suffix="0–1" />
            </>}
            <label className="command-field"><span>Fill Hole</span><select value={command.fillHoleEnabled ? 'enabled' : 'disabled'} onChange={(event) => {
              const enabled = event.target.value === 'enabled';
              const fillHoleFace = Math.min(fillControlFaces.length - 1, selectedFormControlFace);
              const fillHoleCount = enabled ? resolveFillHoleFaceIndexes(fillHoleFace).length : 0;
              onChange({ fillHoleEnabled: enabled, fillHoleFace, fillHoleOffsets: Array.from({ length: fillHoleCount }, (_unused, index) => command.fillHoleOffsets?.[index] || ['0', '0', '0']) });
            }}><option value="disabled">Oryginalna ściana</option><option value="enabled">Zamknij granicę płatami</option></select></label>
            {command.fillHoleEnabled && <>
              <label className="command-field"><span>Granica do zamknięcia</span><select value={Math.min(fillControlFaces.length - 1, command.fillHoleFace || 0)} onChange={(event) => {
                const fillHoleFace = Number(event.target.value);
                const fillHoleCount = resolveFillHoleFaceIndexes(fillHoleFace).length;
                onChange({ fillHoleFace, fillHoleOffsets: Array.from({ length: fillHoleCount }, (_unused, index) => command.fillHoleOffsets?.[index] || ['0', '0', '0']) });
              }}>{fillControlFaces.map((_face, index) => <option key={index} value={index}>Granica ściany {index + 1}</option>)}</select></label>
              <p className="command-hint">Fill Hole zastępuje wskazaną ścianę płatami zbiegającymi się w edytowalnym punkcie. Przy symetrii druga granica zamyka się automatycznie.</p>
            </>}
          </>}
          <Field label="Położenie X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" />
          <Field label="Położenie Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" />
          <Field label="Położenie Z" value={command.z} onChange={(z) => onChange({ z })} suffix="mm" />
          <p className="command-hint">Kliknij punkt, krawędź albo ścianę klatki i przeciągnij oś X, Y lub Z. Crease działa na wybranej krawędzi: turkusowa jest gładka, fioletowa ostra, a żółta wybrana.</p>
        </>}
        {isTransform && (command.mode === 'move' ? <><Field label="Przesunięcie X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" autoFocus /><Field label="Przesunięcie Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Przesunięcie Z" value={command.z} onChange={(z) => onChange({ z })} suffix="mm" /></> : <><Field label="Kąt Z" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" autoFocus /><Field label="Środek X" value={command.originX} onChange={(originX) => onChange({ originX })} suffix="mm" /><Field label="Środek Y" value={command.originY} onChange={(originY) => onChange({ originY })} suffix="mm" /><Field label="Środek Z" value={command.originZ} onChange={(originZ) => onChange({ originZ })} suffix="mm" /></>)}
        {isOffsetFace && <><Field label="Ściana" value={command.faceLabel || '1 wskazana'} disabled /><Field label="Odległość" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus /></>}
        {isTextSolid && <><Field label="Tekst" value={command.text} onChange={(text) => onChange({ text })} autoFocus /><Field label="Rozmiar" value={command.fontSize} onChange={(fontSize) => onChange({ fontSize })} suffix="mm" /><Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" /><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="emboss" disabled={!command.targetBodyId}>Emboss — wypukły</option><option value="deboss" disabled={!command.targetBodyId}>Deboss — wklęsły</option></select></label>{command.placement === 'face' && <Field label="Powierzchnia" value="Planarna ściana (trwała referencja)" disabled />}<Field label="Położenie X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Położenie Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" />{command.placement !== 'face' && <Field label={command.operation === 'new' ? 'Położenie Z' : 'Powierzchnia Z'} value={command.z} onChange={(z) => onChange({ z })} suffix="mm" />}</>}
        {isHole && (
          <>
            {command.placement === 'face-edges' && <><Field label="Pozycjonowanie" value="Ściana + 2 krawędzie" disabled /><Field label="Od krawędzi 1" value={command.firstOffset} onChange={(firstOffset) => onChange({ firstOffset })} suffix="mm" autoFocus /><Field label="Od krawędzi 2" value={command.secondOffset} onChange={(secondOffset) => onChange({ secondOffset })} suffix="mm" /></>}
            <label className="command-field"><span>Zastosowanie</span><select value={holeStandardApplication} onChange={(event) => onChange(applyHoleStandard(command, event.target.value, command.standardSize || 'M6'))}><option value="custom">Własne wymiary</option><option value="clearance-fine">ISO 273 — przejściowy bliski</option><option value="clearance-medium">ISO 273 — przejściowy normalny</option><option value="clearance-coarse">ISO 273 — przejściowy duży</option><option value="tapped">ISO metryczny — gwintowany</option><option value="npt-tapped">NPT — stożkowy 1:16</option><option value="bspt-tapped">BSPT / Rc — stożkowy 1:16</option></select></label>
            {holeStandardApplication !== 'custom' && <label className="command-field"><span>Rozmiar śruby / gwintu</span><select value={isPipeThread ? selectedPipeSize.id : selectedMetricSize.id} onChange={(event) => onChange(applyHoleStandard(command, holeStandardApplication, event.target.value))}>{(isPipeThread ? pipeSizes : selectableMetricSizes).map((size) => <option key={size.id} value={size.id}>{isPipeThread ? size.nominal : size.id}</option>)}</select></label>}
            {isPipeThread && <><label className="command-field"><span>Przygotowanie otworu</span><select value={command.pipePreparation || 'conical'} onChange={(event) => onChange(applyHoleStandard({ ...command, pipePreparation: event.target.value }, holeStandardApplication, selectedPipeSize.id))}><option value="conical">Stożkowe — zalecane</option><option value="cylindrical">Walcowe — wiertło wstępne</option></select></label><Field label="Stożek średnicy" value="1:16" disabled /><Field label="Zwoje na cal" value={String(selectedPipeSize.tpi)} disabled /></>}
            <label className="command-field"><span>Typ otworu</span><select value={command.holeType} onChange={(event) => onChange({ holeType: event.target.value })}><option value="simple">Prosty</option><option value="counterbore">Counterbore</option><option value="countersink">Countersink</option></select></label>
            <Field label={isPipeThread ? 'Średnica przy wejściu' : holeStandardApplication === 'tapped' ? 'Średnica wiertła' : 'Średnica'} value={command.diameter} onChange={(diameter) => onChange({ diameter })} suffix="mm" disabled={holeStandardApplication !== 'custom'} autoFocus />
            <label className="command-field"><span>Zakres</span><select value={command.extent} onChange={(event) => onChange({ extent: event.target.value })}><option value="distance">Na odległość</option><option value="through-all" disabled={isPipeThread}>Przez wszystko</option></select></label>
            {command.extent === 'distance' && <Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" />}
            {command.holeType === 'counterbore' && <><Field label="Średnica Counterbore" value={command.counterboreDiameter} onChange={(counterboreDiameter) => onChange({ counterboreDiameter })} suffix="mm" /><Field label="Głębokość Counterbore" value={command.counterboreDepth} onChange={(counterboreDepth) => onChange({ counterboreDepth })} suffix="mm" /></>}
            {command.holeType === 'countersink' && <><Field label="Średnica Countersink" value={command.countersinkDiameter} onChange={(countersinkDiameter) => onChange({ countersinkDiameter })} suffix="mm" /><Field label="Kąt Countersink" value={command.countersinkAngle} onChange={(countersinkAngle) => onChange({ countersinkAngle })} suffix="°" /></>}
            {command.holeApplication !== 'clearance' && <label className="command-field"><span>Gwint</span><select value={command.threadMode} onChange={(event) => onChange({ threadMode: event.target.value })}><option value="none" disabled={isStandardThread}>Brak</option><option value="cosmetic">Kosmetyczny</option><option value="modeled">Modelowany</option></select></label>}
            {command.threadMode !== 'none' && command.holeApplication !== 'clearance' && <><Field label="Średnica gwintu" value={command.threadDiameter} onChange={(threadDiameter) => onChange({ threadDiameter })} suffix="mm" disabled={isStandardThread} />{holeStandardApplication === 'tapped' ? <label className="command-field"><span>Skok gwintu</span><select value={String(command.threadPitch)} onChange={(event) => onChange(applyHoleStandard(command, 'tapped', selectedMetricSize.id, event.target.value))}>{selectedMetricSize.pitches.map((pitch) => <option key={pitch} value={pitch}>{pitch} mm</option>)}</select></label> : <Field label="Skok gwintu" value={command.threadPitch} onChange={(threadPitch) => onChange({ threadPitch })} suffix="mm" disabled={isPipeThread} />}<Field label="Długość gwintu" value={command.threadLength} onChange={(threadLength) => onChange({ threadLength })} suffix="mm" /><label className="command-field"><span>Kierunek gwintu</span><select value={command.threadDirection} onChange={(event) => onChange({ threadDirection: event.target.value })}><option value="right">Prawy</option><option value="left">Lewy</option></select></label>{holeStandardApplication === 'tapped' && <label className="command-field"><span>Klasa gwintu</span><select value={command.threadClass || '6H'} onChange={(event) => onChange({ threadClass: event.target.value })}>{ISO_INTERNAL_THREAD_CLASSES.map((threadClass) => <option key={threadClass} value={threadClass}>{threadClass}</option>)}</select></label>}{isPipeThread && <Field label="Sprawdzian" value={command.threadInspection?.replace(/^sprawdzian /, '')} disabled />}</>}
            <Field label="Odchyłka dolna Ø" value={command.diameterToleranceLower ?? ''} onChange={(diameterToleranceLower) => onChange({ diameterToleranceLower })} suffix="mm" />
            <Field label="Odchyłka górna Ø" value={command.diameterToleranceUpper ?? ''} onChange={(diameterToleranceUpper) => onChange({ diameterToleranceUpper })} suffix="mm" />
            {holeStandardApplication === 'custom' && <label className="command-field"><span>Profil luzu</span><select value={command.clearanceProfile} onChange={(event) => onChange({ clearanceProfile: event.target.value })}><option value="nominal">Nominalny</option><option value="fff">FFF</option></select></label>}
            {holeStandardApplication === 'custom' && command.clearanceProfile === 'fff' && <Field label="Luz promieniowy FFF" value={command.clearance} onChange={(clearance) => onChange({ clearance })} suffix="mm" />}
          </>
        )}
        {(isFillet || command.type === 'chamfer') && (
          <Field label={isFillet ? 'Promień' : 'Odległość'} value={command.size} onChange={(size) => onChange({ size })} suffix="mm" autoFocus />
        )}
        {isShell && <><Field label="Usuwane ściany" value={`${command.faceCount || 0}`} disabled /><Field label="Grubość" value={command.thickness} onChange={(thickness) => onChange({ thickness })} suffix="mm" autoFocus /></>}
        {isDraftFeature && <><Field label="Pochylane ściany" value={`${command.faceCount || 0}`} disabled /><label className="command-field"><span>Płaszczyzna neutralna</span><select value={command.neutralPlaneId} onChange={(event) => onChange({ neutralPlaneId: event.target.value })}>{command.neutralPlaneOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label><Field label="Kąt Draft" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" autoFocus /></>}
        {isSplitBody && <><Field label="Bryła dzielona" value={command.targetName || command.targetBodyId} disabled /><label className="command-field"><span>Płaszczyzna podziału</span><select value={command.planeId} onChange={(event) => onChange({ planeId: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></>}
        {isSplitFace && <><Field label="Profil podziału" value={command.profileName || command.profileId} disabled /><Field label="Ściana dzielona" value={command.faceName || 'Planarna ściana szkicu'} disabled /></>}
        {isDeleteFace && <><Field label="Usuwane regiony" value={`${command.faceCount || 0}`} disabled /><p className="command-hint">Operacja scala wskazane regiony z sąsiednimi ścianami leżącymi na tej samej powierzchni.</p></>}
        {isReplaceFace && <><Field label="Ściana zastępowana" value={command.sourceName || 'Pierwsza zaznaczona ściana'} disabled /><Field label="Powierzchnia docelowa" value={command.destinationName || 'Druga zaznaczona ściana'} disabled /><p className="command-hint">Planarne i równoległe ściany mogą należeć do dwóch różnych brył; bryła powierzchni docelowej pozostaje bez zmian.</p></>}
        {isConstructionPlane && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} autoFocus />
            {(isOffsetPlane || isMidplane || isAnglePlane) && <label className="command-field"><span>Płaszczyzna bazowa</span><select value={command.basePlane} onChange={(event) => onChange({ basePlane: event.target.value })}><option value="XY">Góra (XY)</option><option value="XZ">Przód (XZ)</option><option value="YZ">Prawo (YZ)</option></select></label>}
            {isOffsetPlane && <Field label="Odległość" value={command.offset} onChange={(offset) => onChange({ offset })} suffix="mm" />}
            {isMidplane && <><Field label="Położenie A" value={command.firstOffset} onChange={(firstOffset) => onChange({ firstOffset })} suffix="mm" /><Field label="Położenie B" value={command.secondOffset} onChange={(secondOffset) => onChange({ secondOffset })} suffix="mm" /></>}
            {isThreePointPlane && <>{[1, 2, 3].map((index) => <React.Fragment key={index}><Field label={`Punkt ${index} X`} value={command[`x${index}`]} onChange={(value) => onChange({ [`x${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Y`} value={command[`y${index}`]} onChange={(value) => onChange({ [`y${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Z`} value={command[`z${index}`]} onChange={(value) => onChange({ [`z${index}`]: value })} suffix="mm" /></React.Fragment>)}</>}
            {isAnglePlane && <><label className="command-field"><span>Oś obrotu</span><select value={command.rotationAxis} onChange={(event) => onChange({ rotationAxis: event.target.value })}><option value="u">Oś U</option><option value="v">Oś V</option></select></label><Field label="Kąt" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" /><Field label="Odległość" value={command.offset} onChange={(offset) => onChange({ offset })} suffix="mm" /></>}
            {isTangentPlane && <><label className="command-field"><span>Powierzchnia</span><select value={command.surfaceType} onChange={(event) => onChange({ surfaceType: event.target.value })}><option value="sphere">Sfera</option><option value="cylinder">Walec</option></select></label>{['X', 'Y', 'Z'].map((axis, index) => <React.Fragment key={`tangent-${axis}`}><Field label={`Środek ${axis}`} value={command[`center${index}`]} onChange={(value) => onChange({ [`center${index}`]: value })} suffix="mm" /><Field label={`Styczność ${axis}`} value={command[`point${index}`]} onChange={(value) => onChange({ [`point${index}`]: value })} suffix="mm" />{command.surfaceType === 'cylinder' && <Field label={`Oś ${axis}`} value={command[`axis${index}`]} onChange={(value) => onChange({ [`axis${index}`]: value })} />}</React.Fragment>)}</>}
            {isPathPlane && <>{['X', 'Y', 'Z'].map((axis, index) => <React.Fragment key={`path-${axis}`}><Field label={`Punkt ścieżki ${axis}`} value={command[`point${index}`]} onChange={(value) => onChange({ [`point${index}`]: value })} suffix="mm" /><Field label={`Kierunek ścieżki ${axis}`} value={command[`direction${index}`]} onChange={(value) => onChange({ [`direction${index}`]: value })} /></React.Fragment>)}</>}
            <label className="command-field"><span>Widoczna</span><select value={command.visible ? 'yes' : 'no'} onChange={(event) => onChange({ visible: event.target.value === 'yes' })}><option value="yes">Tak</option><option value="no">Nie</option></select></label>
          </>
        )}
        {isConstructionAxis && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} autoFocus />
            {['edge', 'two-points'].includes(command.axisType) && <>{[1, 2].map((index) => <React.Fragment key={index}><Field label={`Punkt ${index} X`} value={command[`x${index}`]} onChange={(value) => onChange({ [`x${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Y`} value={command[`y${index}`]} onChange={(value) => onChange({ [`y${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Z`} value={command[`z${index}`]} onChange={(value) => onChange({ [`z${index}`]: value })} suffix="mm" /></React.Fragment>)}</>}
            {command.axisType === 'cylinder' && <>{['X', 'Y', 'Z'].map((axis, index) => <Field key={`origin-${axis}`} label={`Środek ${axis}`} value={command[`origin${index}`]} onChange={(value) => onChange({ [`origin${index}`]: value })} suffix="mm" />)}{['X', 'Y', 'Z'].map((axis, index) => <Field key={`direction-${axis}`} label={`Kierunek ${axis}`} value={command[`direction${index}`]} onChange={(value) => onChange({ [`direction${index}`]: value })} />)}</>}
            {command.axisType === 'plane-intersection' && <><label className="command-field"><span>Płaszczyzna A</span><select value={command.planeId1} onChange={(event) => onChange({ planeId1: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label><label className="command-field"><span>Płaszczyzna B</span><select value={command.planeId2} onChange={(event) => onChange({ planeId2: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></>}
            {command.axisType === 'plane-normal' && <><label className="command-field"><span>Płaszczyzna</span><select value={command.planeId1} onChange={(event) => onChange({ planeId1: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label>{['X', 'Y', 'Z'].map((axis, index) => <Field key={`normal-origin-${axis}`} label={`Punkt osi ${axis}`} value={command[`origin${index}`]} onChange={(value) => onChange({ [`origin${index}`]: value })} suffix="mm" />)}</>}
            <label className="command-field"><span>Widoczna</span><select value={command.visible ? 'yes' : 'no'} onChange={(event) => onChange({ visible: event.target.value === 'yes' })}><option value="yes">Tak</option><option value="no">Nie</option></select></label>
          </>
        )}
        {isConstructionPoint && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} autoFocus />
            {['vertex', 'center'].includes(command.pointType) && <>{['X', 'Y', 'Z'].map((axis, index) => <Field key={axis} label={axis} value={command[`position${index}`]} onChange={(value) => onChange({ [`position${index}`]: value })} suffix="mm" />)}</>}
            {command.pointType === 'intersection' && <><label className="command-field"><span>Oś</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><label className="command-field"><span>Płaszczyzna</span><select value={command.planeId} onChange={(event) => onChange({ planeId: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></>}
            {command.pointType === 'midpoint' && <>{[1, 2].map((index) => <React.Fragment key={index}>{['X', 'Y', 'Z'].map((axis) => <Field key={`${index}-${axis}`} label={`Punkt ${index} ${axis}`} value={command[`${axis.toLowerCase()}${index}`]} onChange={(value) => onChange({ [`${axis.toLowerCase()}${index}`]: value })} suffix="mm" />)}</React.Fragment>)}</>}
            {command.pointType === 'on-axis' && <><label className="command-field"><span>Oś</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><Field label="Odległość na osi" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" /></>}
            <label className="command-field"><span>Widoczny</span><select value={command.visible ? 'yes' : 'no'} onChange={(event) => onChange({ visible: event.target.value === 'yes' })}><option value="yes">Tak</option><option value="no">Nie</option></select></label>
          </>
        )}
        {isSketch3D && (
          <>
            <p className="command-hint">Dodawaj połączone linie, łuki i spline po dokładnych współrzędnych XYZ. Kamera pozostaje swobodna.</p>
            <label className="command-field"><span>Typ krzywej</span><select value={command.segmentType || 'line'} onChange={(event) => onChange({ segmentType: event.target.value })}><option value="line">Linia 3D</option><option value="arc">Łuk przez 3 punkty</option><option value="spline">Spline Béziera</option></select></label>
            <Field label="Początek X" value={command.startX} disabled suffix="mm" />
            <Field label="Początek Y" value={command.startY} disabled suffix="mm" />
            <Field label="Początek Z" value={command.startZ} disabled suffix="mm" />
            {command.segmentType === 'arc' && <><Field label="Punkt łuku X" value={command.throughX} onChange={(throughX) => onChange({ throughX })} suffix="mm" autoFocus /><Field label="Punkt łuku Y" value={command.throughY} onChange={(throughY) => onChange({ throughY })} suffix="mm" /><Field label="Punkt łuku Z" value={command.throughZ} onChange={(throughZ) => onChange({ throughZ })} suffix="mm" /></>}
            {command.segmentType === 'spline' && <>
              {command.segmentIds.length > 0 && <label className="command-field"><span>Ciągłość początku</span><select value={command.continuity || 'g0'} onChange={(event) => onChange({ continuity: event.target.value })}><option value="g0">G0 · pozycja</option><option value="g1">G1 · styczność</option><option value="g2">G2 · krzywizna</option></select></label>}
              {(command.continuity || 'g0') !== 'g0' && command.segmentIds.length > 0 && <Field label="Długość uchwytu" value={command.handleLength} onChange={(handleLength) => onChange({ handleLength })} suffix="mm" autoFocus />}
              {((command.continuity || 'g0') === 'g0' || !command.segmentIds.length) && <><Field label="Uchwyt 1 X" value={command.control1X} onChange={(control1X) => onChange({ control1X })} suffix="mm" autoFocus /><Field label="Uchwyt 1 Y" value={command.control1Y} onChange={(control1Y) => onChange({ control1Y })} suffix="mm" /><Field label="Uchwyt 1 Z" value={command.control1Z} onChange={(control1Z) => onChange({ control1Z })} suffix="mm" /></>}
              {((command.continuity || 'g0') !== 'g2' || !command.segmentIds.length) && <><Field label="Uchwyt 2 X" value={command.control2X} onChange={(control2X) => onChange({ control2X })} suffix="mm" /><Field label="Uchwyt 2 Y" value={command.control2Y} onChange={(control2Y) => onChange({ control2Y })} suffix="mm" /><Field label="Uchwyt 2 Z" value={command.control2Z} onChange={(control2Z) => onChange({ control2Z })} suffix="mm" /></>}
              {(command.continuity || 'g0') === 'g2' && command.segmentIds.length > 0 && <p className="command-hint">Oba uchwyty są wyliczane z kierunku i krzywizny poprzedniej krzywej.</p>}
            </>}
            <Field label="Koniec X" value={command.endX} onChange={(endX) => onChange({ endX })} suffix="mm" autoFocus />
            <Field label="Koniec Y" value={command.endY} onChange={(endY) => onChange({ endY })} suffix="mm" />
            <Field label="Koniec Z" value={command.endZ} onChange={(endZ) => onChange({ endZ })} suffix="mm" />
            <p className="command-hint">Utworzono krzywych: {command.segmentIds.length}. Ścieżka współpracuje z Sweep, Pipe i Pattern.</p>
          </>
        )}
        {isSketch3DEdit && (
          <>
            <p className="command-hint">Edytujesz: {command.curveLabel}. Wspólne końce aktualizują wszystkie połączone krzywe ścieżki.</p>
            <Field label="Początek X" value={command.startX} onChange={(startX) => onChange({ startX })} suffix="mm" autoFocus />
            <Field label="Początek Y" value={command.startY} onChange={(startY) => onChange({ startY })} suffix="mm" />
            <Field label="Początek Z" value={command.startZ} onChange={(startZ) => onChange({ startZ })} suffix="mm" />
            {command.curveType === 'arc3d' && <><Field label="Punkt łuku X" value={command.throughX} onChange={(throughX) => onChange({ throughX })} suffix="mm" /><Field label="Punkt łuku Y" value={command.throughY} onChange={(throughY) => onChange({ throughY })} suffix="mm" /><Field label="Punkt łuku Z" value={command.throughZ} onChange={(throughZ) => onChange({ throughZ })} suffix="mm" /></>}
            {command.curveType === 'spline3d' && <>
              <label className="command-field"><span>Ciągłość początku</span><select value={command.continuity || 'g0'} onChange={(event) => onChange({ continuity: event.target.value })}><option value="g0">G0 · pozycja</option><option value="g1">G1 · styczność</option><option value="g2">G2 · krzywizna</option></select></label>
              {(command.continuity || 'g0') !== 'g0' && <Field label="Długość uchwytu" value={command.handleLength} onChange={(handleLength) => onChange({ handleLength })} suffix="mm" />}
              {(command.continuity || 'g0') === 'g0' && <><Field label="Uchwyt 1 X" value={command.control1X} onChange={(control1X) => onChange({ control1X })} suffix="mm" /><Field label="Uchwyt 1 Y" value={command.control1Y} onChange={(control1Y) => onChange({ control1Y })} suffix="mm" /><Field label="Uchwyt 1 Z" value={command.control1Z} onChange={(control1Z) => onChange({ control1Z })} suffix="mm" /></>}
              {(command.continuity || 'g0') !== 'g2' && <><Field label="Uchwyt 2 X" value={command.control2X} onChange={(control2X) => onChange({ control2X })} suffix="mm" /><Field label="Uchwyt 2 Y" value={command.control2Y} onChange={(control2Y) => onChange({ control2Y })} suffix="mm" /><Field label="Uchwyt 2 Z" value={command.control2Z} onChange={(control2Z) => onChange({ control2Z })} suffix="mm" /></>}
              {(command.continuity || 'g0') !== 'g0' && <p className="command-hint">Uchwyt początku jest wyliczany z poprzedniej krzywej. Dla G2 program dopasowuje również krzywiznę.</p>}
            </>}
            <Field label="Koniec X" value={command.endX} onChange={(endX) => onChange({ endX })} suffix="mm" />
            <Field label="Koniec Y" value={command.endY} onChange={(endY) => onChange({ endY })} suffix="mm" />
            <Field label="Koniec Z" value={command.endZ} onChange={(endZ) => onChange({ endZ })} suffix="mm" />
          </>
        )}
        {!isSketch3D && isSketchPath && (
          <>
          {command.lastPoint && <label className="sketch-length-entry"><span>Długość następnego odcinka</span><div><input type="text" inputMode="decimal" value={command.dynamicLength || ''} placeholder="np. 25" onChange={(event) => { const value = event.target.value.replace(',', '.'); if (/^\d*(?:\.\d*)?$/.test(value)) onChange({ dynamicLength: value }); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onConfirmDynamic?.(); } }} /><span>mm</span><kbd>Enter</kbd></div></label>}
          <details className="sketch-path-exact">
            <summary><span>Dokładna długość i kąt</span><small>opcjonalnie</small></summary>
            <div>
              <Field label="Długość" value={command.length} onChange={(length) => onChange({ length })} suffix="mm" />
              <Field label="Kąt" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" />
              <label className="command-field">
                <span>Segment</span>
                <select value={command.segmentMode} onChange={(event) => onChange({ segmentMode: event.target.value })}>
                  <option value="line">Linia</option>
                  <option value="tangentArc" disabled={!command.segmentIds.length}>Łuk styczny</option>
                </select>
              </label>
            </div>
          </details>
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
        {isSketchPattern && (
          <>
            <label className="command-field"><span>Typ szyku</span><select value={command.mode} onChange={(event) => onChange({ mode: event.target.value })}><option value="rectangular">Prostokątny</option><option value="circular">Kołowy</option><option value="path">Po ścieżce</option></select></label>
            {command.mode === 'rectangular' ? <><Field label="Kolumny" value={command.columns} onChange={(columns) => onChange({ columns })} autoFocus /><Field label="Wiersze" value={command.rows} onChange={(rows) => onChange({ rows })} /><Field label="Odstęp X" value={command.spacingX} onChange={(spacingX) => onChange({ spacingX })} suffix="mm" /><Field label="Odstęp Y" value={command.spacingY} onChange={(spacingY) => onChange({ spacingY })} suffix="mm" /></> : command.mode === 'circular' ? <><Field label="Wystąpienia" value={command.count} onChange={(count) => onChange({ count })} autoFocus /><Field label="Środek X" value={command.centerX} onChange={(centerX) => onChange({ centerX })} suffix="mm" /><Field label="Środek Y" value={command.centerY} onChange={(centerY) => onChange({ centerY })} suffix="mm" /><Field label="Kąt całkowity" value={command.totalAngle} onChange={(totalAngle) => onChange({ totalAngle })} suffix="°" /></> : <><label className="command-field"><span>Ścieżka</span><select value={command.pathEntityId} onChange={(event) => onChange({ pathEntityId: event.target.value })}>{command.pathOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><Field label="Wystąpienia" value={command.count} onChange={(count) => onChange({ count })} autoFocus /><label className="command-field"><span>Orientacja</span><select value={command.orientToPath ? 'path' : 'fixed'} onChange={(event) => onChange({ orientToPath: event.target.value === 'path' })}><option value="path">Zgodnie ze ścieżką</option><option value="fixed">Stała</option></select></label></>}
            <Field label="Pomiń wystąpienia" value={command.skippedOccurrences} onChange={(skippedOccurrences) => onChange({ skippedOccurrences })} />
            <p className="command-hint">Numery oddziel przecinkami lub podaj zakres, np. 3, 5-7. Wystąpienie 1 jest źródłem.</p>
          </>
        )}
        {!isSketchPath && !isProjectSketch && !isProjectSurface && <div className="command-preview-note"><span className="preview-dot" />{isSketch3DEdit ? 'Zmiana zachowuje identyfikator krzywej i aktualizuje zależne warunki ciągłości.' : isSketchMove ? 'Wpisz dokładne przesunięcie zaznaczenia w osiach szkicu.' : isSketchOffset ? 'Operacja powstanie dopiero po zatwierdzeniu; Anuluj nie zmienia szkicu.' : isSketchCorner ? 'Oryginalne linie zachowają ID; zerwane więzy zostaną jawnie usunięte.' : isSketchTransform ? 'Transformacja jest transakcyjna; Scale odrzuca geometrię z blokującym wymiarem.' : isSketchPattern ? 'Szyk powstanie transakcyjnie; pominięte kopie nie zostaną utworzone.' : isConstructionPlane ? 'Współrzędne i odległości mogą być liczbami albo wyrażeniami z parametrów modelu.' : isPoint ? 'Kliknij położenie na płótnie. Pola X/Y są opcjonalnym wejściem dokładnym.' : isMechanicalShape ? 'Klikaj punkty figury na płótnie. Pola pozostają opcjonalnym wejściem dokładnym.' : isExtrude ? 'Przeciągnij niebieską strzałkę na modelu albo wpisz dokładną odległość.' : 'Podgląd jest przeliczany na dokładnej bryle B-Rep.'}</div>}
      </div>
      {isSketchPath ? (
        <footer><button className="secondary" type="button" onClick={onUndoSegment} disabled={isSketch3D ? !command.segmentIds.length : !command.pointIds.length}>{isSketch3D ? 'Cofnij krzywą' : 'Cofnij segment'}</button><button className="secondary" type="button" onClick={onFinishPath}>Zakończ</button><button className="confirm" type="button" onClick={() => onConfirm()} disabled={!isSketch3D && !command.lastPoint}><Check size={14} /> {isSketch3D ? 'Dodaj krzywą' : 'Dodaj dokładnie'}</button></footer>
      ) : (
        <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={() => onConfirm()} disabled={featurePreviewPending} aria-busy={featurePreviewPending} title={featurePreviewPending ? 'Trwa obliczanie podglądu operacji' : undefined}><Check size={14} /> {featurePreviewPending ? 'Obliczanie…' : isProjectSketch ? 'Pobierz' : isProjectSurface ? 'Rzutuj' : isMechanicalShape || isPoint ? 'Utwórz z danych' : 'OK'}</button></footer>
      )}
      </>}
    </section>
  );
}
