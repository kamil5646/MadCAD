import React from 'react';
import { Box, Check, Ruler, ScanSearch, X } from 'lucide-react';
import { formatModelFileSize } from '../cad-core/model-import.js';
import { multipleSelectionLabel } from './platform-shortcuts.js';

export function Field({ label, value, onChange, suffix = '', type = 'text', disabled = false, autoFocus = false }) {
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

export function MeasurePanel({ measurement, onClose }) {
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
        {!measurement?.selectionCount && <p>Zaznacz bryłę, ścianę, krawędź lub wierzchołek. {multipleSelectionLabel(window.desktopApp?.platform)} wybiera drugi element.</p>}
        {rows.map(([label, value]) => <div className="measure-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
    </aside>
  );
}

export function SectionPanel({ analysis, onChange, onClose }) {
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

export function MassPropertiesPanel({ density, result, error, onDensityChange, onClose }) {
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

export function GeometryInspectionPanel({ result, onClose }) {
  return (
    <aside className="measure-panel geometry-inspection-panel" aria-label="Analiza geometrii">
      <header><div><ScanSearch size={16} /><strong>Analiza geometrii</strong></div><button type="button" title="Zamknij analizę geometrii" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        <div className="measure-row"><span>Bryły</span><strong>{result.bodyCount}</strong></div>
        <div className="measure-row"><span>Min. promień</span><strong>{result.minimumRadius === null ? 'Brak powierzchni krzywoliniowych' : measureValue(result.minimumRadius, 'mm')}</strong></div>
        <div className="measure-row"><span>Kolizje</span><strong>{result.collisions.length}</strong></div>
        {result.skippedPairs > 0 && <div className="measure-row"><span>Pominięte pary</span><strong>{result.skippedPairs} · niezgodna/otwarta siatka</strong></div>}
        {result.collisions.map((collision) => <div className="collision-row" key={`${collision.firstBodyId}:${collision.secondBodyId}`}><span>{collision.firstBodyId} ↔ {collision.secondBodyId}</span><strong>{measureValue(collision.volume, 'mm³')}</strong></div>)}
        {!result.collisions.length && <p>{result.skippedPairs ? 'Nie wykryto kolizji w sprawdzonych parach; pominięte pary nie mają dokładnego wyniku.' : 'Nie wykryto wspólnej objętości pomiędzy bryłami.'}</p>}
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
  ['foot', 'Stopy (ft)'],
];

export function ImportModelDialog({ draft, onChange, onConfirm, onCancel }) {
  if (!draft) return null;
  return (
    <section className="command-dialog import-model-dialog" aria-label="Import modelu 3D">
      <header><strong>Import modelu 3D</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        <Field label="Plik" value={draft.fileName} disabled />
        <Field label="Format" value={draft.originalFormat.toUpperCase()} disabled />
        <Field label="Rozmiar" value={formatModelFileSize(draft.sourceBytes)} disabled />
        {draft.storedBytes !== draft.sourceBytes && <Field label="Dane projektu" value={formatModelFileSize(draft.storedBytes)} disabled />}
        <Field label="Tryb" value={draft.importMode === 'brep' ? 'Dokładna geometria B-Rep' : 'Natywna siatka trójkątów'} disabled />
        {Number.isFinite(draft.objectCount) && <Field label="Obiekty" value={String(draft.objectCount)} disabled />}
        {Number.isFinite(draft.triangleCount) && <Field label="Trójkąty" value={draft.triangleCount.toLocaleString('pl-PL')} disabled />}
        {draft.originalFormat === '3mf' && <Field label="Wykryta jedn." value={IMPORT_UNIT_OPTIONS.find(([value]) => value === draft.detectedUnit)?.[1] || draft.detectedUnit} disabled />}
        <label className="command-field"><span>Jednostka źródłowa</span><select value={draft.sourceUnit} onChange={(event) => onChange({ sourceUnit: event.target.value })}>{IMPORT_UNIT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="command-preview-note"><span className="preview-dot" />{draft.importMode === 'brep' ? 'STEP zachowa dokładne powierzchnie, krawędzie i operacje CAD.' : 'STL/3MF zostanie zachowany jako szybka siatka: można go oglądać, mierzyć, przesuwać i eksportować bez zawodnej konwersji do B-Rep.'}</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> Importuj</button></footer>
    </section>
  );
}

export function ImportSketchDialog({ draft, onChange, onConfirm, onCancel }) {
  if (!draft) return null;
  return (
    <section className="command-dialog import-sketch-dialog" aria-label="Import SVG, DXF lub DWG do szkicu">
      <header><strong>Import geometrii szkicu</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        <Field label="Plik" value={draft.fileName} disabled />
        <Field label="Format" value={(draft.sourceFormat || draft.format).toUpperCase()} disabled />
        <Field label="Wykryta jednostka" value={IMPORT_UNIT_OPTIONS.find(([value]) => value === draft.detectedUnit)?.[1] || draft.detectedUnit} disabled />
        <label className="command-field"><span>Jednostka źródłowa</span><select value={draft.sourceUnit} onChange={(event) => onChange({ sourceUnit: event.target.value })}>{IMPORT_UNIT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="command-preview-note"><span className="preview-dot" />Linie, polilinie, prostokąty, okręgi i łuki zostaną dodane do aktywnego szkicu w milimetrach. Zamknięte pętle utworzą profile.</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> Importuj do szkicu</button></footer>
    </section>
  );
}

export function SketchDimensionDialog({ command, onChange, onConfirm, onCancel }) {
  if (command?.type !== 'sketchDimension') return null;
  const titles = {
    ordinateX: 'Wymiar ordinate X',
    ordinateY: 'Wymiar ordinate Y',
    arcLength: 'Wymiar długości łuku',
  };
  return (
    <section className="command-dialog sketch-dimension-dialog" aria-label={titles[command.dimensionType]}>
      <header><strong>{titles[command.dimensionType]}</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        <Field label="Wartość" value={command.value} onChange={(value) => onChange({ value })} suffix="mm" autoFocus />
        <div className="command-preview-note"><span className="preview-dot" />Wymiar steruje geometrią i można go później zmienić bezpośrednio na szkicu.</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> Dodaj wymiar</button></footer>
    </section>
  );
}
