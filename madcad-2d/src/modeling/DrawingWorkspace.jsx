import React, { useMemo } from 'react';
import { FilePlus2, FileText, Plus, Trash2 } from 'lucide-react';
import { drawingSheetScene, formatDrawingScale } from '../cad-core/drawing-sheets.js';

const ORIENTATION_LABELS = {
  front: 'Przód',
  top: 'Góra',
  right: 'Prawo',
  isometric: 'Izometria',
};

function DrawingSheetPreview({ documentName, sheet, bodies, selectedViewId, onSelectView }) {
  const scene = useMemo(() => drawingSheetScene(sheet, bodies), [sheet, bodies]);
  const titleTop = scene.height - scene.titleBlockHeight;
  return (
    <div className="drawing-paper-wrap">
      <svg className="drawing-paper" viewBox={`0 0 ${scene.width} ${scene.height}`} role="img" aria-label={`Arkusz ${sheet.name}`}>
        <rect className="drawing-border" x={scene.margin} y={scene.margin} width={scene.width - scene.margin * 2} height={scene.height - scene.margin * 2} />
        {scene.views.map((view) => <g key={view.id} className={`drawing-view ${selectedViewId === view.id ? 'selected' : ''}`} role="button" tabIndex="0" aria-label={`${view.name}, ${ORIENTATION_LABELS[view.orientation]}, skala ${formatDrawingScale(view.scale)}`} onClick={() => onSelectView(view.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectView(view.id); } }}>
          {view.segments.map(([first, second], index) => <line key={index} x1={first[0]} y1={first[1]} x2={second[0]} y2={second[1]} />)}
          <text x={view.x} y={Math.min(titleTop - 3, view.y + (view.modelHeight * view.scale) / 2 + 6)} textAnchor="middle">{ORIENTATION_LABELS[view.orientation]} · {formatDrawingScale(view.scale)}</text>
        </g>)}
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

export default function DrawingWorkspace({ document, bodies, activeSheetId, selectedViewId, readOnly = false, onCreateSheet, onSelectSheet, onUpdateSheet, onDeleteSheet, onAddBaseView, onSelectView, onUpdateView, onDeleteView, onExportPdf }) {
  const activeSheet = document.drawings.find((sheet) => sheet.id === activeSheetId) || document.drawings[0] || null;
  const selectedView = activeSheet?.views.find((view) => view.id === selectedViewId) || null;

  if (!activeSheet) {
    return <section className="drawing-workspace drawing-empty" aria-label="Dokumentacja techniczna">
      <FileText size={46} />
      <h2>Utwórz pierwszy arkusz techniczny</h2>
      <p>Arkusz jest zapisany w projekcie i aktualizuje widok z bieżącej geometrii modelu.</p>
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
      <div className="drawing-actions">
        <button type="button" onClick={onAddBaseView} disabled={readOnly || !bodies.length}><Plus size={14} /> Widok bazowy</button>
        <button type="button" onClick={onExportPdf} disabled={!activeSheet.views.length}><FileText size={14} /> Eksport PDF</button>
      </div>
      {!bodies.length && <p className="drawing-hint">Najpierw utwórz albo zaimportuj model 3D.</p>}
      {selectedView && <div className="drawing-view-properties">
        <strong>Widok bazowy</strong>
        <label><span>Kierunek</span><select value={selectedView.orientation} disabled={readOnly} onChange={(event) => onUpdateView({ orientation: event.target.value })}>{Object.entries(ORIENTATION_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Skala</span><input type="number" min="0.001" max="1000" step="0.1" value={selectedView.scale} disabled={readOnly} onChange={(event) => { const scale = Number(event.target.value); if (scale > 0) onUpdateView({ scale }); }} /></label>
        <div className="drawing-property-row"><label><span>X [mm]</span><input type="number" value={selectedView.x} disabled={readOnly} onChange={(event) => onUpdateView({ x: Number(event.target.value) || 0 })} /></label><label><span>Y [mm]</span><input type="number" value={selectedView.y} disabled={readOnly} onChange={(event) => onUpdateView({ y: Number(event.target.value) || 0 })} /></label></div>
        <button className="danger" type="button" onClick={onDeleteView} disabled={readOnly}><Trash2 size={14} /> Usuń widok</button>
      </div>}
      <button className="drawing-delete-sheet" type="button" onClick={onDeleteSheet} disabled={readOnly}><Trash2 size={14} /> Usuń arkusz</button>
    </aside>
  </section>;
}
