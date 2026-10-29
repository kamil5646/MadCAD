import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { drawingSheetHtml, formatDrawingScale } from '../cad-core/drawing-sheets.js';
import { layoutOf, previewHtml, SCALES } from './drawing.js';

const SCALE_OPTIONS = [{ id: 'auto', label: 'Automatyczna' }, ...SCALES.map((scale) => ({ id: String(scale), label: formatDrawingScale(scale) }))];

function Check({ label, checked, onChange }) {
  return <label className="check-row"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

export default function DrawingPane({ document, sheet, bodies, ready, hasBodies, onCreate, onLayout, onSheet, onTitle }) {
  const html = useMemo(() => (sheet && ready ? drawingSheetHtml(sheet, bodies, { documentName: document.name, sketches: document.sketches, parameters: document.parameters, layers: document.layers }) : ''), [bodies, document.layers, document.name, document.parameters, document.sketches, ready, sheet]);
  if (!sheet) {
    return (
      <main className="drawing-host empty-state">
        <FileText size={40} />
        <h2>Rysunek 2D z modelu</h2>
        <p>{hasBodies ? 'Arkusz z widokami przód, góra, bok i izometria, ze skalą dobraną automatycznie.' : 'Najpierw zrób bryłę w zakładce Model.'}</p>
        <button type="button" className="primary" disabled={!hasBodies} onClick={onCreate}>Utwórz rysunek</button>
      </main>
    );
  }
  const layout = layoutOf(sheet);
  const scaleLabel = sheet.views[0] ? formatDrawingScale(sheet.views[0].scale) : '';
  return (
    <main className="drawing-host">
      <div className="drawing-frame">
        {html ? <iframe title="Arkusz rysunku" srcDoc={previewHtml(html)} /> : <p className="hint">Obliczanie rzutów…</p>}
      </div>
      <aside className="drawing-side" aria-label="Ustawienia arkusza">
        <h3>Arkusz</h3>
        <div className="segmented">
          {['A4', 'A3'].map((size) => <button key={size} type="button" className={sheet.pageSize === size ? 'on' : ''} onClick={() => onSheet({ pageSize: size })}>{size}</button>)}
        </div>
        <div className="segmented">
          {[['landscape', 'Poziomo'], ['portrait', 'Pionowo']].map(([id, label]) => <button key={id} type="button" className={sheet.orientation === id ? 'on' : ''} onClick={() => onSheet({ orientation: id })}>{label}</button>)}
        </div>
        <h3>Skala {layout.scale === 'auto' && scaleLabel ? `· ${scaleLabel}` : ''}</h3>
        <select className="select wide" value={String(layout.scale)} onChange={(event) => onLayout({ scale: event.target.value === 'auto' ? 'auto' : Number(event.target.value) })}>
          {SCALE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <h3>Widoki</h3>
        <Check label="Góra (pod przodem)" checked={layout.top} onChange={(top) => onLayout({ top })} />
        <Check label="Bok (obok przodu)" checked={layout.right} onChange={(right) => onLayout({ right })} />
        <Check label="Izometria" checked={layout.isometric} onChange={(isometric) => onLayout({ isometric })} />
        <Check label="Wymiary gabarytowe" checked={layout.dimensions} onChange={(dimensions) => onLayout({ dimensions })} />
        <h3>Tabliczka</h3>
        {[['title', 'Nazwa'], ['partNumber', 'Numer rysunku'], ['material', 'Materiał'], ['author', 'Autor'], ['company', 'Firma']].map(([key, label]) => (
          <label key={key} className="text-row"><span>{label}</span><input value={sheet.titleBlock?.[key] || ''} onChange={(event) => onTitle({ [key]: event.target.value })} /></label>
        ))}
      </aside>
    </main>
  );
}
