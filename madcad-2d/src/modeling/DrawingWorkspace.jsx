import React, { useEffect, useMemo, useRef } from 'react';
import { FilePlus2, FileText, Plus, Trash2 } from 'lucide-react';
import { drawingBomItemNumber, drawingSheetScene, formatDrawingScale } from '../cad-core/drawing-sheets.js';

const ORIENTATION_LABELS = {
  front: 'Przód',
  top: 'Góra',
  right: 'Prawo',
  isometric: 'Izometria',
};

const VIEW_TYPE_LABELS = {
  base: 'Widok bazowy',
  sketch: 'Szkic 2D',
  projected: 'Widok rzutowany',
  section: 'Przekrój',
  detail: 'Detal',
};

const ANNOTATION_TYPE_LABELS = {
  'linear-dimension': 'Wymiar gabarytowy',
  centerline: 'Oś',
  'center-mark': 'Znacznik środka',
  'hole-note': 'Opis otworu',
  'feature-control-frame': 'Tolerancja geometryczna',
  balloon: 'Oznaczenie pozycji',
};

function DrawingTableGraphic({ table }) {
  const starts = table.columns.reduce((values, column) => [...values, values.at(-1) + column.width], [table.x]);
  const height = 10 + table.rows.length * table.rowHeight;
  return <g className={`drawing-table drawing-table-${table.type}`} aria-label={table.title}>
    <rect x={table.x} y={table.y} width={table.width} height={height} />
    {Array.from({ length: table.rows.length + 1 }, (_, index) => <line key={`row-${index}`} x1={table.x} y1={table.y + (index + 1) * table.rowHeight} x2={table.x + table.width} y2={table.y + (index + 1) * table.rowHeight} />)}
    {starts.slice(1, -1).map((x, index) => <line key={`column-${index}`} x1={x} y1={table.y + 5} x2={x} y2={table.y + height} />)}
    <text className="drawing-table-title" x={table.x + table.width / 2} y={table.y + 3.7} textAnchor="middle">{table.title}</text>
    {table.columns.map((column, index) => <text key={column.label} x={starts[index] + 1} y={table.y + 8.5}>{column.label}</text>)}
    {table.rows.map((row, rowIndex) => <g className="drawing-table-row" key={`table-row-${rowIndex}`}>{row.map((cell, columnIndex) => <text key={`${rowIndex}-${columnIndex}`} x={starts[columnIndex] + 1} y={table.y + 13.5 + rowIndex * table.rowHeight}>{cell}</text>)}</g>)}
  </g>;
}

function DrawingSheetPreview({ documentName, sheet, bodies, components, componentInstances, sketches, parameters, layers, selectedViewId, selectedAnnotationId, onSelectView, onSelectAnnotation }) {
  const scene = useMemo(() => drawingSheetScene(sheet, bodies, { components, componentInstances, sketches, parameters, layers }), [sheet, bodies, components, componentInstances, sketches, parameters, layers]);
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
          : annotation.type === 'detail-callout'
            ? <g key={`annotation-${annotation.ownerViewId}`} className={`drawing-annotation drawing-detail-callout ${selectedViewId === annotation.ownerViewId ? 'selected' : ''}`} role="button" tabIndex="0" aria-label="Obszar detalu A" onClick={() => onSelectView(annotation.ownerViewId)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectView(annotation.ownerViewId); }}><circle cx={annotation.x} cy={annotation.y} r={annotation.radius} /><text x={annotation.x + annotation.radius + 2} y={annotation.y}>A</text></g>
            : <g key={annotation.id} className={`drawing-annotation drawing-user-annotation drawing-${annotation.type} ${selectedAnnotationId === annotation.id ? 'selected' : ''}`} role="button" tabIndex="0" aria-label={ANNOTATION_TYPE_LABELS[annotation.type]} onClick={(event) => { event.stopPropagation(); onSelectAnnotation(annotation.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectAnnotation(annotation.id); } }}>
              {(annotation.segments || []).map(([first, second], index) => <line key={`segment-${index}`} x1={first[0]} y1={first[1]} x2={second[0]} y2={second[1]} />)}
              {annotation.text && <text x={annotation.textX} y={annotation.textY} transform={annotation.textRotation ? `rotate(${annotation.textRotation} ${annotation.textX} ${annotation.textY})` : undefined}>{annotation.text}</text>}
              {annotation.frame && <><rect x={annotation.frame.x} y={annotation.frame.y} width={annotation.frame.width} height={annotation.frame.height} />{annotation.cells.slice(1).map((_, index) => <line key={`cell-${index}`} x1={annotation.frame.x + (index + 1) * annotation.frame.cellWidth} y1={annotation.frame.y} x2={annotation.frame.x + (index + 1) * annotation.frame.cellWidth} y2={annotation.frame.y + annotation.frame.height} />)}{annotation.cells.map((cell, index) => <text key={`text-${index}`} x={annotation.frame.x + index * annotation.frame.cellWidth + annotation.frame.cellWidth / 2} y={annotation.frame.y + 4.2} textAnchor="middle">{cell}</text>)}</>}
              {annotation.circle && <circle cx={annotation.circle.x} cy={annotation.circle.y} r={annotation.circle.radius} />}
            </g>)}
        {scene.tables.map((table) => <DrawingTableGraphic table={table} key={table.id} />)}
        <g className="drawing-title-block">
          <rect x={scene.width - 192} y={titleTop} width="60" height="14" />
          <rect x={scene.width - 132} y={titleTop} width="122" height="14" />
          <line x1={scene.width - 55} y1={titleTop} x2={scene.width - 55} y2={scene.height - 10} />
          <line x1={scene.width - 28} y1={titleTop} x2={scene.width - 28} y2={scene.height - 10} />
          {(sheet.revisions || []).slice(-3).map((revision, index) => <text key={revision.id} x={scene.width - 191} y={titleTop + 4 + index * 4}>{revision.code} · {revision.date}</text>)}
          <text className="drawing-project-name" x={scene.width - 129} y={titleTop + 5}>{sheet.titleBlock?.title || documentName}</text>
          <text x={scene.width - 129} y={titleTop + 9}>{sheet.titleBlock?.partNumber || sheet.name} · {sheet.titleBlock?.material || '—'}</text>
          <text x={scene.width - 129} y={titleTop + 12.5}>{sheet.titleBlock?.company || ''}</text>
          <text x={scene.width - 53} y={titleTop + 5}>Autor</text>
          <text x={scene.width - 53} y={titleTop + 11}>{sheet.titleBlock?.author || '—'}</text>
          <text x={scene.width - 26} y={titleTop + 5}>Rew.</text>
          <text x={scene.width - 26} y={titleTop + 11}>{sheet.revisions?.at(-1)?.code || sheet.titleBlock?.revision || 'A'}</text>
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

function AnnotationControls({ annotation, rendered, bodies, allBodies, components, readOnly, onUpdateAnnotation, onDeleteAnnotation }) {
  const updateCenter = (index, value) => {
    const center = [...annotation.center];
    center[index] = Math.max(0, Math.min(1, Number(value) / 100));
    onUpdateAnnotation({ center });
  };
  return <div className="drawing-view-properties drawing-annotation-properties">
    <strong>{ANNOTATION_TYPE_LABELS[annotation.type]}</strong>
    <small className="drawing-association-status">Aktualizowane z widokiem źródłowym</small>
    {(annotation.type === 'linear-dimension' || annotation.type === 'centerline') && <label><span>Kierunek</span><select value={annotation.axis} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ axis: event.target.value })}><option value="horizontal">Poziomy</option><option value="vertical">Pionowy</option></select></label>}
    {annotation.type === 'linear-dimension' && <>
      <div className="drawing-property-row"><label><span>Odsunięcie [mm]</span><input type="number" min="-100" max="100" value={annotation.offset} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ offset: Math.max(-100, Math.min(100, Number(event.target.value) || 0)) })} /></label><label><span>Miejsca</span><input type="number" min="0" max="4" value={annotation.precision} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ precision: Math.max(0, Math.min(4, Math.trunc(Number(event.target.value) || 0))) })} /></label></div>
      <label><span>Tolerancja</span><select value={annotation.toleranceMode} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ toleranceMode: event.target.value })}><option value="none">Bez tolerancji</option><option value="symmetric">Symetryczna ±</option><option value="deviation">Odchyłki +/−</option></select></label>
      {annotation.toleranceMode !== 'none' && <div className="drawing-property-row"><label><span>{annotation.toleranceMode === 'symmetric' ? '± [mm]' : 'Górna [mm]'}</span><input type="number" min="0" step="0.01" value={annotation.upperTolerance} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ upperTolerance: Math.max(0, Number(event.target.value) || 0), ...(annotation.toleranceMode === 'symmetric' ? { lowerTolerance: Math.max(0, Number(event.target.value) || 0) } : {}) })} /></label>{annotation.toleranceMode === 'deviation' && <label><span>Dolna [mm]</span><input type="number" min="0" step="0.01" value={annotation.lowerTolerance} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ lowerTolerance: Math.max(0, Number(event.target.value) || 0) })} /></label>}</div>}
      <small className="drawing-calculated-value">Wartość z modelu: {rendered?.text || '—'} mm</small>
    </>}
    {annotation.type === 'centerline' && <label><span>Położenie [%]</span><input type="number" min="-100" max="100" value={Math.round(annotation.offset * 100)} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ offset: Math.max(-1, Math.min(1, Number(event.target.value) / 100 || 0)) })} /></label>}
    {(annotation.type === 'center-mark' || annotation.type === 'hole-note' || annotation.type === 'feature-control-frame' || annotation.type === 'balloon') && <div className="drawing-property-row"><label><span>Środek X [%]</span><input type="number" min="0" max="100" value={Math.round(annotation.center[0] * 100)} disabled={readOnly} onChange={(event) => updateCenter(0, event.target.value)} /></label><label><span>Środek Y [%]</span><input type="number" min="0" max="100" value={Math.round(annotation.center[1] * 100)} disabled={readOnly} onChange={(event) => updateCenter(1, event.target.value)} /></label></div>}
    {annotation.type === 'center-mark' && <label><span>Rozmiar [mm]</span><input type="number" min="2" max="20" value={annotation.size} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ size: Math.max(2, Math.min(20, Number(event.target.value) || 5)) })} /></label>}
    {annotation.type === 'hole-note' && <>
      <label><span>Rodzaj opisu</span><select value={annotation.noteMode} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ noteMode: event.target.value })}><option value="hole">Otwór</option><option value="thread">Gwint</option></select></label>
      {annotation.noteMode === 'hole' ? <>
        <label><span>Średnica</span><select value={annotation.diameterSource} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ diameterSource: event.target.value, ...(event.target.value === 'manual' && !(annotation.diameter > 0) ? { diameter: rendered?.diameter || 1 } : {}) })}><option value="model">Automatycznie z modelu</option><option value="manual">Wartość ręczna</option></select></label>
        <label><span>⌀ [mm]</span><input type="number" min="0.001" step="0.1" value={annotation.diameterSource === 'model' ? rendered?.diameter || 0 : annotation.diameter} disabled={readOnly || annotation.diameterSource === 'model'} onChange={(event) => onUpdateAnnotation({ diameter: Math.max(0.001, Number(event.target.value) || 1) })} /></label>
      </> : <div className="drawing-property-row"><label><span>Oznaczenie</span><input value={annotation.threadDesignation} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ threadDesignation: event.target.value.slice(0, 30) })} /></label><label><span>Klasa</span><input value={annotation.threadClass} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ threadClass: event.target.value.slice(0, 12) })} /></label></div>}
      <label><span>Liczba otworów</span><input type="number" min="1" max="99" value={annotation.quantity} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ quantity: Math.max(1, Math.min(99, Math.trunc(Number(event.target.value) || 1))) })} /></label>
      <label className="drawing-checkbox"><input type="checkbox" checked={annotation.through} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ through: event.target.checked })} /><span>Otwór przelotowy (THRU)</span></label>
      <small className="drawing-calculated-value">Opis: {rendered?.text || 'Brak walcowej geometrii'}</small>
    </>}
    {annotation.type === 'feature-control-frame' && <>
      <label><span>Symbol GD&amp;T</span><select value={annotation.symbol} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ symbol: event.target.value })}><option value="position">Pozycja ⌖</option><option value="flatness">Płaskość ⏥</option><option value="parallelism">Równoległość ∥</option><option value="perpendicularity">Prostopadłość ⊥</option><option value="circularity">Okrągłość ○</option></select></label>
      <div className="drawing-property-row"><label><span>Tolerancja [mm]</span><input type="number" min="0.001" max="100" step="0.01" value={annotation.tolerance} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ tolerance: Math.max(0.001, Math.min(100, Number(event.target.value) || 0.1)) })} /></label><label><span>Baza</span><input value={annotation.datum} maxLength="8" disabled={readOnly} onChange={(event) => onUpdateAnnotation({ datum: event.target.value.toUpperCase().slice(0, 8) })} /></label></div>
    </>}
    {annotation.type === 'balloon' && <><label><span>Część</span><select value={annotation.bodyId} disabled={readOnly} onChange={(event) => { const bodyId = event.target.value; const itemNumber = drawingBomItemNumber(bodyId, allBodies, components); onUpdateAnnotation({ bodyId, ...(itemNumber ? { itemNumber } : {}) }); }}>{bodies.map((body) => <option value={body.id} key={body.id}>{body.name || body.id}</option>)}</select></label><label><span>Numer pozycji</span><input type="number" min="1" max="999" value={annotation.itemNumber} disabled={readOnly} onChange={(event) => onUpdateAnnotation({ itemNumber: Math.max(1, Math.min(999, Math.trunc(Number(event.target.value) || 1))) })} /></label></>}
    <button className="danger" type="button" onClick={onDeleteAnnotation} disabled={readOnly}><Trash2 size={14} /> Usuń oznaczenie</button>
  </div>;
}

export default function DrawingWorkspace({ document, bodies, activeSheetId, selectedViewId, selectedAnnotationId, focusSection = null, readOnly = false, onCreateSheet, onSelectSheet, onUpdateSheet, onSelectView, onUpdateView, onDeleteView, onSelectAnnotation, onUpdateAnnotation, onDeleteAnnotation, onAddRevision, onUpdateRevision, onDeleteRevision, onUpdateTable, onDeleteTable }) {
  const titleBlockRef = useRef(null);
  const revisionsRef = useRef(null);
  const activeSheet = document.drawings.find((sheet) => sheet.id === activeSheetId) || document.drawings[0] || null;
  const activeScene = useMemo(() => activeSheet ? drawingSheetScene(activeSheet, bodies, { components: document.components || [], componentInstances: document.componentInstances || [], sketches: document.sketches || [], parameters: document.parameters || [], layers: document.layers || [] }) : null, [activeSheet, bodies, document.components, document.componentInstances, document.sketches, document.parameters, document.layers]);
  const selectedView = activeScene?.views.find((view) => view.id === selectedViewId) || null;
  const selectedAnnotation = activeSheet?.annotations?.find((annotation) => annotation.id === selectedAnnotationId) || null;
  const renderedSelectedAnnotation = activeScene?.annotations.find((annotation) => annotation.id === selectedAnnotationId) || null;
  const drawableSketches = (document.sketches || []).filter((sketch) => (sketch.entities || []).some((entity) => !['point', 'text'].includes(entity.type) && entity.role !== 'construction'));
  useEffect(() => {
    const target = focusSection?.section === 'revisions' ? revisionsRef.current : focusSection?.section === 'title-block' ? titleBlockRef.current : null;
    if (!target) return;
    target.open = true;
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    target.querySelector('input, button, select')?.focus({ preventScroll: true });
  }, [focusSection]);

  if (!activeSheet) {
    return <section className="drawing-workspace drawing-empty" aria-label="Dokumentacja techniczna">
      <FileText size={46} />
      <h2>Utwórz pierwszy arkusz techniczny</h2>
      <p>Arkusz jest zapisany w projekcie i aktualizuje widoki po każdej zmianie modelu albo szkicu 2D.</p>
      <div className="drawing-empty-features" aria-label="Możliwości arkusza"><span>A4 / A3</span><span>Rzuty, przekroje i detale</span><span>Wymiary i GD&amp;T</span><span>Tabliczka, rewizje i BOM</span></div>
      <button type="button" onClick={onCreateSheet} disabled={readOnly}><FilePlus2 size={17} /> Nowy arkusz A4</button>
    </section>;
  }

  return <section className="drawing-workspace" aria-label="Dokumentacja techniczna">
    <nav className="drawing-sheet-list" aria-label="Arkusze dokumentacji">
      <header><strong>Arkusze</strong><button type="button" title="Nowy arkusz" aria-label="Nowy arkusz" onClick={onCreateSheet} disabled={readOnly}><Plus size={15} /></button></header>
      {document.drawings.map((sheet, index) => <button type="button" className={sheet.id === activeSheet.id ? 'active' : ''} key={sheet.id} onClick={() => onSelectSheet(sheet.id)}><FileText size={15} /><span><strong>{sheet.name}</strong><small>{sheet.pageSize} · {sheet.orientation === 'landscape' ? 'poziomo' : 'pionowo'} · {sheet.views.length} wid.</small></span><em>{index + 1}</em></button>)}
    </nav>

    <DrawingSheetPreview documentName={document.name} sheet={activeSheet} bodies={bodies} components={document.components || []} componentInstances={document.componentInstances || []} sketches={document.sketches || []} parameters={document.parameters || []} layers={document.layers || []} selectedViewId={selectedViewId} selectedAnnotationId={selectedAnnotationId} onSelectView={onSelectView} onSelectAnnotation={onSelectAnnotation} />

    <aside className="drawing-properties" aria-label="Właściwości arkusza">
      <header><FileText size={16} /><strong>Właściwości</strong></header>
      <label><span>Nazwa arkusza</span><input value={activeSheet.name} disabled={readOnly} onChange={(event) => { const name = event.target.value.slice(0, 80); if (name.trim()) onUpdateSheet({ name }); }} /></label>
      <div className="drawing-property-row"><label><span>Format</span><select value={activeSheet.pageSize} disabled={readOnly} onChange={(event) => onUpdateSheet({ pageSize: event.target.value })}><option value="A4">A4</option><option value="A3">A3</option></select></label><label><span>Orientacja</span><select value={activeSheet.orientation} disabled={readOnly} onChange={(event) => onUpdateSheet({ orientation: event.target.value })}><option value="landscape">Pozioma</option><option value="portrait">Pionowa</option></select></label></div>
      <details className="drawing-sheet-details" ref={titleBlockRef}>
        <summary>Tabliczka rysunkowa</summary>
        <label><span>Tytuł</span><input value={activeSheet.titleBlock?.title || ''} placeholder={document.name} disabled={readOnly} onChange={(event) => onUpdateSheet({ titleBlock: { ...activeSheet.titleBlock, title: event.target.value.slice(0, 80) } })} /></label>
        <div className="drawing-property-row"><label><span>Numer części</span><input value={activeSheet.titleBlock?.partNumber || ''} disabled={readOnly} onChange={(event) => onUpdateSheet({ titleBlock: { ...activeSheet.titleBlock, partNumber: event.target.value.slice(0, 40) } })} /></label><label><span>Materiał</span><input value={activeSheet.titleBlock?.material || ''} disabled={readOnly} onChange={(event) => onUpdateSheet({ titleBlock: { ...activeSheet.titleBlock, material: event.target.value.slice(0, 40) } })} /></label></div>
        <div className="drawing-property-row"><label><span>Autor</span><input value={activeSheet.titleBlock?.author || ''} disabled={readOnly} onChange={(event) => onUpdateSheet({ titleBlock: { ...activeSheet.titleBlock, author: event.target.value.slice(0, 60) } })} /></label><label><span>Firma</span><input value={activeSheet.titleBlock?.company || ''} disabled={readOnly} onChange={(event) => onUpdateSheet({ titleBlock: { ...activeSheet.titleBlock, company: event.target.value.slice(0, 60) } })} /></label></div>
      </details>
      <details className="drawing-sheet-details drawing-revisions" ref={revisionsRef}>
        <summary>Rewizje ({activeSheet.revisions?.length || 0})</summary>
        {(activeSheet.revisions || []).map((revision) => <div className="drawing-revision" key={revision.id}><div className="drawing-property-row"><label><span>Rew.</span><input value={revision.code} disabled={readOnly} onChange={(event) => onUpdateRevision(revision.id, { code: event.target.value.slice(0, 8) })} /></label><label><span>Data</span><input type="date" value={revision.date} disabled={readOnly} onChange={(event) => onUpdateRevision(revision.id, { date: event.target.value })} /></label></div><label><span>Opis</span><input value={revision.description} disabled={readOnly} onChange={(event) => onUpdateRevision(revision.id, { description: event.target.value.slice(0, 120) })} /></label><button type="button" className="drawing-revision-delete" title="Usuń rewizję" onClick={() => onDeleteRevision(revision.id)} disabled={readOnly}><Trash2 size={13} /> Usuń</button></div>)}
        <button type="button" className="drawing-add-revision" onClick={onAddRevision} disabled={readOnly}><Plus size={14} /> Dodaj rewizję</button>
      </details>
      {!!activeSheet.tables?.length && <details className="drawing-sheet-details drawing-tables">
        <summary>Tabele ({activeSheet.tables.length})</summary>
        {(activeSheet.tables || []).map((table) => <div className="drawing-table-control" key={table.id}><strong>{table.type === 'bom' ? 'Zestawienie części' : 'Tabela otworów'}</strong><div className="drawing-property-row"><label><span>X [mm]</span><input type="number" value={table.x} disabled={readOnly} onChange={(event) => onUpdateTable(table.id, { x: Number(event.target.value) || 0 })} /></label><label><span>Y [mm]</span><input type="number" value={table.y} disabled={readOnly} onChange={(event) => onUpdateTable(table.id, { y: Number(event.target.value) || 0 })} /></label></div><button type="button" className="drawing-revision-delete" onClick={() => onDeleteTable(table.id)} disabled={readOnly}><Trash2 size={13} /> Usuń tabelę</button></div>)}
      </details>}
      {!selectedView && !selectedAnnotation && <div className="drawing-selection-hint"><strong>Wybierz element arkusza</strong><span>Kliknij widok lub oznaczenie. Nowe elementy dodasz ze wstążki u góry.</span></div>}
      {!bodies.length && !drawableSketches.length && <p className="drawing-hint">Najpierw narysuj szkic 2D albo utwórz lub zaimportuj model 3D.</p>}
      {selectedView && <div className="drawing-view-properties">
        <strong>{VIEW_TYPE_LABELS[selectedView.type]}</strong>
        <small className="drawing-association-status">{selectedView.type === 'sketch' ? 'Skojarzony ze szkicem 2D' : `Skojarzony z modelem${selectedView.parentViewId ? ' i widokiem nadrzędnym' : ''}`}</small>
        {selectedView.type === 'base' && <label><span>Kierunek</span><select value={selectedView.orientation} disabled={readOnly} onChange={(event) => onUpdateView({ orientation: event.target.value })}>{Object.entries(ORIENTATION_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
        {selectedView.type === 'sketch' && <label><span>Szkic źródłowy</span><select value={selectedView.sketchId} disabled={readOnly} onChange={(event) => onUpdateView({ sketchId: event.target.value })}>{drawableSketches.map((sketch) => <option value={sketch.id} key={sketch.id}>{sketch.name}</option>)}</select></label>}
        <DerivedViewControls view={selectedView} readOnly={readOnly} onUpdateView={onUpdateView} />
        <label><span>Skala</span><input type="number" min="0.001" max="1000" step="0.1" value={selectedView.scale} disabled={readOnly || !['base', 'sketch'].includes(selectedView.type)} onChange={(event) => { const scale = Number(event.target.value); if (scale > 0) onUpdateView({ scale }); }} /></label>
        {!['base', 'sketch'].includes(selectedView.type) && <label><span>Wyrównanie</span><select value={selectedView.alignment} disabled={readOnly || selectedView.type === 'section'} onChange={(event) => onUpdateView({ alignment: event.target.value })}><option value="horizontal">Poziome</option><option value="vertical">Pionowe</option><option value="free">Swobodne</option></select></label>}
        <div className="drawing-property-row"><label><span>X [mm]</span><input type="number" value={selectedView.x} disabled={readOnly || selectedView.alignment === 'vertical'} onChange={(event) => onUpdateView({ x: Number(event.target.value) || 0 })} /></label><label><span>Y [mm]</span><input type="number" value={selectedView.y} disabled={readOnly || selectedView.alignment === 'horizontal'} onChange={(event) => onUpdateView({ y: Number(event.target.value) || 0 })} /></label></div>
        <button className="danger" type="button" onClick={onDeleteView} disabled={readOnly}><Trash2 size={14} /> Usuń widok</button>
      </div>}
      {selectedAnnotation && <AnnotationControls annotation={selectedAnnotation} rendered={renderedSelectedAnnotation} bodies={bodies.filter((body) => activeSheet.views.find((view) => view.id === selectedAnnotation.viewId)?.bodyIds?.includes(body.id))} allBodies={bodies} components={document.components || []} readOnly={readOnly} onUpdateAnnotation={onUpdateAnnotation} onDeleteAnnotation={onDeleteAnnotation} />}
    </aside>
  </section>;
}
