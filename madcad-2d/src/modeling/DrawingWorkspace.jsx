import React, { useMemo } from 'react';
import { FilePlus2, FileText, Plus, ScanSearch, Scissors, Trash2 } from 'lucide-react';
import { drawingSheetScene, formatDrawingScale } from '../cad-core/drawing-sheets.js';

const ORIENTATION_LABELS = {
  front: 'Przód',
  top: 'Góra',
  right: 'Prawo',
  isometric: 'Izometria',
};

const VIEW_TYPE_LABELS = {
  base: 'Widok bazowy',
  projected: 'Widok rzutowany',
  section: 'Przekrój',
  detail: 'Detal',
};

function DrawingSheetPreview({ documentName, sheet, bodies, selectedViewId, onSelectView }) {
  const scene = useMemo(() => drawingSheetScene(sheet, bodies), [sheet, bodies]);
  const titleTop = scene.height - scene.titleBlockHeight;
  return (
    <div className="drawing-paper-wrap">
      <svg className="drawing-paper" viewBox={`0 0 ${scene.width} ${scene.height}`} role="img" aria-label={`Arkusz ${sheet.name}`}>
        <rect className="drawing-border" x={scene.margin} y={scene.margin} width={scene.width - scene.margin * 2} height={scene.height - scene.margin * 2} />
        {scene.views.map((view) => <g key={view.id} className={`drawing-view drawing-view-${view.type} ${selectedViewId === view.id ? 'selected' : ''}`} role="button" tabIndex="0" aria-label={`${view.name}, ${ORIENTATION_LABELS[view.orientation]}, skala ${formatDrawingScale(view.scale)}`} onClick={() => onSelectView(view.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectView(view.id); } }}>
          {view.segments.map(([first, second], index) => <line key={`edge-${index}`} x1={first[0]} y1={first[1]} x2={second[0]} y2={second[1]} />)}
          {view.hatchSegments.map(([first, second], index) => <line className="drawing-hatch" key={`hatch-${index}`} x1={first[0]} y1={first[1]} x2={second[0]} y2={second[1]} />)}
          {view.type === 'detail' && <circle className="drawing-detail-border" cx={view.x} cy={view.y} r={Math.max(5, view.detailRadiusSheet)} />}
          <text x={view.x} y={Math.min(titleTop - 3, view.y + (view.modelHeight * view.scale) / 2 + 6)} textAnchor="middle">{view.name} · {formatDrawingScale(view.scale)}</text>
        </g>)}
        {scene.annotations.map((annotation) => annotation.type === 'section-line'
          ? <g key={`annotation-${annotation.ownerViewId}`} className={`drawing-annotation drawing-section-callout ${selectedViewId === annotation.ownerViewId ? 'selected' : ''}`} role="button" tabIndex="0" aria-label="Linia przekroju A-A" onClick={() => onSelectView(annotation.ownerViewId)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectView(annotation.ownerViewId); }}><line x1={annotation.x1} y1={annotation.y1} x2={annotation.x2} y2={annotation.y2} /><text x={annotation.x1} y={annotation.y1 - 2}>A</text><text x={annotation.x2} y={annotation.y2 - 2}>A</text></g>
          : <g key={`annotation-${annotation.ownerViewId}`} className={`drawing-annotation drawing-detail-callout ${selectedViewId === annotation.ownerViewId ? 'selected' : ''}`} role="button" tabIndex="0" aria-label="Obszar detalu A" onClick={() => onSelectView(annotation.ownerViewId)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectView(annotation.ownerViewId); }}><circle cx={annotation.x} cy={annotation.y} r={annotation.radius} /><text x={annotation.x + annotation.radius + 2} y={annotation.y}>A</text></g>)}
        <g className="drawing-title-block">
          <rect x={scene.width - 132} y={titleTop} width="122" height="14" />
          <line x1={scene.width - 55} y1={titleTop} x2={scene.width - 55} y2={scene.height - 10} />
          <line x1={scene.width - 28} y1={titleTop} x2={scene.width - 28} y2={scene.height - 10} />
          <text className="drawing-project-name" x={scene.width - 129} y={titleTop + 6}>{documentName}</text>
          <text x={scene.width - 129} y={titleTop + 11}>{sheet.name}</text>
          <text x={scene.width - 53} y={titleTop + 5}>Autor</text>
          <text x={scene.width - 53} y={titleTop + 11}>—</text>
          <text x={scene.width - 26} y={titleTop + 5}>Rew.</text>
          <text x={scene.width - 26} y={titleTop + 11}>A</text>
        </g>
      </svg>
    </div>
  );
}

function DerivedViewControls({ view, readOnly, onUpdateView }) {
  if (view.type === 'projected') return <label><span>Kierunek rzutu</span><select value={view.projectionDirection} disabled={readOnly} onChange={(event) => { const direction = event.target.value; const horizontal = direction === 'left' || direction === 'right'; onUpdateView({ projectionDirection: direction, orientation: horizontal ? 'right' : 'top', alignment: horizontal ? 'horizontal' : 'vertical' }); }}><option value="right">W prawo</option><option value="left">W lewo</option><option value="top">W górę</option><option value="bottom">W dół</option></select></label>;
  if (view.type === 'section') return <>
    <label><span>Kierunek linii cięcia</span><select value={view.sectionAxis} disabled={readOnly} onChange={(event) => { const sectionAxis = event.target.value; onUpdateView({ sectionAxis, alignment: sectionAxis === 'vertical' ? 'horizontal' : 'vertical' }); }}><option value="vertical">Pionowy</option><option value="horizontal">Poziomy</option></select></label>
    <div className="drawing-property-row"><label><span>Pozycja [%]</span><input type="number" min="5" max="95" value={Math.round(view.sectionPosition * 100)} disabled={readOnly} onChange={(event) => onUpdateView({ sectionPosition: Math.max(0.05, Math.min(0.95, Number(event.target.value) / 100 || 0.5)) })} /></label><label><span>Kreskowanie [mm]</span><input type="number" min="1" max="20" value={view.hatchSpacing} disabled={readOnly} onChange={(event) => onUpdateView({ hatchSpacing: Math.max(1, Math.min(20, Number(event.target.value) || 4)) })} /></label></div>
  </>;
  if (view.type === 'detail') return <>
    <div className="drawing-property-row"><label><span>Środek X [%]</span><input type="number" min="0" max="100" value={Math.round(view.detailCenter[0] * 100)} disabled={readOnly} onChange={(event) => onUpdateView({ detailCenter: [Math.max(0, Math.min(1, Number(event.target.value) / 100)), view.detailCenter[1]] })} /></label><label><span>Środek Y [%]</span><input type="number" min="0" max="100" value={Math.round(view.detailCenter[1] * 100)} disabled={readOnly} onChange={(event) => onUpdateView({ detailCenter: [view.detailCenter[0], Math.max(0, Math.min(1, Number(event.target.value) / 100))] })} /></label></div>
    <div className="drawing-property-row"><label><span>Promień [%]</span><input type="number" min="5" max="50" value={Math.round(view.detailRadius * 100)} disabled={readOnly} onChange={(event) => onUpdateView({ detailRadius: Math.max(0.05, Math.min(0.5, Number(event.target.value) / 100 || 0.25)) })} /></label><label><span>Powiększenie</span><input type="number" min="1.1" max="10" step="0.1" value={view.magnification} disabled={readOnly} onChange={(event) => { const magnification = Math.max(1.1, Math.min(10, Number(event.target.value) || 2)); onUpdateView({ magnification, scale: Math.max(0.001, view.scale / view.magnification * magnification) }); }} /></label></div>
  </>;
  return null;
}

export default function DrawingWorkspace({ document, bodies, activeSheetId, selectedViewId, readOnly = false, onCreateSheet, onSelectSheet, onUpdateSheet, onDeleteSheet, onAddBaseView, onAddDerivedView, onSelectView, onUpdateView, onDeleteView, onExportPdf }) {
  const activeSheet = document.drawings.find((sheet) => sheet.id === activeSheetId) || document.drawings[0] || null;
  const activeScene = useMemo(() => activeSheet ? drawingSheetScene(activeSheet, bodies) : null, [activeSheet, bodies]);
  const selectedView = activeScene?.views.find((view) => view.id === selectedViewId) || null;

  if (!activeSheet) {
    return <section className="drawing-workspace drawing-empty" aria-label="Dokumentacja techniczna">
      <FileText size={46} />
      <h2>Utwórz pierwszy arkusz techniczny</h2>
      <p>Arkusz jest zapisany w projekcie i aktualizuje widoki po każdej zmianie geometrii modelu.</p>
      <button type="button" onClick={onCreateSheet} disabled={readOnly}><FilePlus2 size={17} /> Nowy arkusz A4</button>
    </section>;
  }

  return <section className="drawing-workspace" aria-label="Dokumentacja techniczna">
    <nav className="drawing-sheet-list" aria-label="Arkusze dokumentacji">
      <header><strong>Arkusze</strong><button type="button" title="Nowy arkusz" aria-label="Nowy arkusz" onClick={onCreateSheet} disabled={readOnly}><Plus size={15} /></button></header>
      {document.drawings.map((sheet, index) => <button type="button" className={sheet.id === activeSheet.id ? 'active' : ''} key={sheet.id} onClick={() => onSelectSheet(sheet.id)}><FileText size={15} /><span><strong>{sheet.name}</strong><small>{sheet.pageSize} · {sheet.orientation === 'landscape' ? 'poziomo' : 'pionowo'} · {sheet.views.length} wid.</small></span><em>{index + 1}</em></button>)}
    </nav>

    <DrawingSheetPreview documentName={document.name} sheet={activeSheet} bodies={bodies} selectedViewId={selectedViewId} onSelectView={onSelectView} />

    <aside className="drawing-properties" aria-label="Właściwości arkusza">
      <header><FileText size={16} /><strong>Właściwości</strong></header>
      <label><span>Nazwa arkusza</span><input value={activeSheet.name} disabled={readOnly} onChange={(event) => { const name = event.target.value.slice(0, 80); if (name.trim()) onUpdateSheet({ name }); }} /></label>
      <div className="drawing-property-row"><label><span>Format</span><select value={activeSheet.pageSize} disabled={readOnly} onChange={(event) => onUpdateSheet({ pageSize: event.target.value })}><option value="A4">A4</option><option value="A3">A3</option></select></label><label><span>Orientacja</span><select value={activeSheet.orientation} disabled={readOnly} onChange={(event) => onUpdateSheet({ orientation: event.target.value })}><option value="landscape">Pozioma</option><option value="portrait">Pionowa</option></select></label></div>
      <div className="drawing-actions drawing-create-actions">
        <button type="button" onClick={onAddBaseView} disabled={readOnly || !bodies.length}><Plus size={14} /> Bazowy</button>
        <button type="button" title="Utwórz wyrównany rzut od zaznaczonego widoku" onClick={() => onAddDerivedView('projected')} disabled={readOnly || !selectedView}><FileText size={14} /> Rzut</button>
        <button type="button" title="Utwórz przekrój A-A od zaznaczonego widoku" onClick={() => onAddDerivedView('section')} disabled={readOnly || !selectedView || selectedView.orientation === 'isometric'}><Scissors size={14} /> Przekrój</button>
        <button type="button" title="Utwórz powiększony detal od zaznaczonego widoku" onClick={() => onAddDerivedView('detail')} disabled={readOnly || !selectedView}><ScanSearch size={14} /> Detal</button>
      </div>
      {!bodies.length && <p className="drawing-hint">Najpierw utwórz albo zaimportuj model 3D.</p>}
      {selectedView && <div className="drawing-view-properties">
        <strong>{VIEW_TYPE_LABELS[selectedView.type]}</strong>
        <small className="drawing-association-status">Skojarzony z modelem{selectedView.parentViewId ? ' i widokiem nadrzędnym' : ''}</small>
        {selectedView.type === 'base' && <label><span>Kierunek</span><select value={selectedView.orientation} disabled={readOnly} onChange={(event) => onUpdateView({ orientation: event.target.value })}>{Object.entries(ORIENTATION_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
        <DerivedViewControls view={selectedView} readOnly={readOnly} onUpdateView={onUpdateView} />
        <label><span>Skala</span><input type="number" min="0.001" max="1000" step="0.1" value={selectedView.scale} disabled={readOnly || selectedView.type !== 'base'} onChange={(event) => { const scale = Number(event.target.value); if (scale > 0) onUpdateView({ scale }); }} /></label>
        {selectedView.type !== 'base' && <label><span>Wyrównanie</span><select value={selectedView.alignment} disabled={readOnly || selectedView.type === 'section'} onChange={(event) => onUpdateView({ alignment: event.target.value })}><option value="horizontal">Poziome</option><option value="vertical">Pionowe</option><option value="free">Swobodne</option></select></label>}
        <div className="drawing-property-row"><label><span>X [mm]</span><input type="number" value={selectedView.x} disabled={readOnly || selectedView.alignment === 'vertical'} onChange={(event) => onUpdateView({ x: Number(event.target.value) || 0 })} /></label><label><span>Y [mm]</span><input type="number" value={selectedView.y} disabled={readOnly || selectedView.alignment === 'horizontal'} onChange={(event) => onUpdateView({ y: Number(event.target.value) || 0 })} /></label></div>
        <button className="danger" type="button" onClick={onDeleteView} disabled={readOnly}><Trash2 size={14} /> Usuń widok</button>
      </div>}
      <button className="drawing-delete-sheet" type="button" onClick={onDeleteSheet} disabled={readOnly}><Trash2 size={14} /> Usuń arkusz</button>
      <button className="drawing-export-pdf" type="button" onClick={onExportPdf} disabled={!activeSheet.views.length}><FileText size={14} /> Eksport PDF</button>
    </aside>
  </section>;
}
