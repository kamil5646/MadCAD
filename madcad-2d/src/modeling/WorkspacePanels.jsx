import React from 'react';
import { AlertTriangle, Blocks, Box, Check, CheckCircle2, Eye, EyeOff, FileDown, Keyboard, Layers3, Lock, LockOpen, Plus, Printer, RotateCcw, Ruler, ScanSearch, Trash2, Ungroup, X, XCircle } from 'lucide-react';
import { formatModelFileSize } from '../cad-core/model-import.js';
import { BY_LAYER, DEFAULT_LAYER_ID, LINE_TYPES, LINE_WEIGHTS } from '../cad-core/layers.js';
import { commandCustomizationRows, validateCommandCustomization } from './command-customization.js';
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

function commonSelectionValue(entities, key, fallback = BY_LAYER) {
  if (!entities.length) return fallback;
  const values = [...new Set(entities.map((entity) => entity[key] ?? fallback))];
  return values.length === 1 ? values[0] : 'mixed';
}

export function LayersPanel({ document, selectedEntities = [], readOnly = false, onAdd, onUpdate, onDelete, onActivate, onAssign, onStyleSelected, onClose }) {
  const selectedLayerId = commonSelectionValue(selectedEntities, 'layerId', document.activeLayerId);
  const selectedColor = commonSelectionValue(selectedEntities, 'color');
  const selectedLineType = commonSelectionValue(selectedEntities, 'lineType');
  const selectedLineWeight = commonSelectionValue(selectedEntities, 'lineWeight');
  const customColor = selectedColor !== BY_LAYER && selectedColor !== 'mixed' ? selectedColor : '#ffffff';
  return (
    <aside className="measure-panel layers-panel" aria-label="Menedżer warstw">
      <header><div><Layers3 size={16} /><strong>Warstwy</strong></div><button type="button" title="Zamknij warstwy" aria-label="Zamknij warstwy" onClick={onClose}><X size={15} /></button></header>
      <div className="layers-toolbar">
        <button type="button" onClick={onAdd} disabled={readOnly}><Plus size={14} /> Nowa warstwa</button>
        <span>{document.layers.length} {document.layers.length === 1 ? 'warstwa' : 'warstw'}</span>
      </div>
      <div className="layers-list" role="radiogroup" aria-label="Aktywna warstwa">
        {document.layers.map((layer) => (
          <div className={`layer-row ${layer.id === document.activeLayerId ? 'active' : ''}`} key={layer.id}>
            <button className="layer-active" type="button" role="radio" aria-checked={layer.id === document.activeLayerId} title="Ustaw jako aktywną" onClick={() => onActivate(layer.id)}><span style={{ backgroundColor: layer.color }} /></button>
            <input aria-label={`Nazwa warstwy ${layer.name}`} value={layer.name} disabled={readOnly || layer.id === DEFAULT_LAYER_ID} onChange={(event) => onUpdate(layer.id, { name: event.target.value })} />
            <input className="layer-color" aria-label={`Kolor warstwy ${layer.name}`} type="color" value={layer.color} disabled={readOnly} onChange={(event) => onUpdate(layer.id, { color: event.target.value })} />
            <button type="button" className={layer.visible ? 'enabled' : ''} aria-label={`${layer.visible ? 'Ukryj' : 'Pokaż'} warstwę ${layer.name}`} aria-pressed={layer.visible} onClick={() => onUpdate(layer.id, { visible: !layer.visible })}>{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
            <button type="button" className={layer.locked ? 'enabled' : ''} aria-label={`${layer.locked ? 'Odblokuj' : 'Zablokuj'} warstwę ${layer.name}`} aria-pressed={layer.locked} onClick={() => onUpdate(layer.id, { locked: !layer.locked })}>{layer.locked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
            <button type="button" className={layer.printable ? 'enabled' : ''} aria-label={`${layer.printable ? 'Wyłącz' : 'Włącz'} drukowanie warstwy ${layer.name}`} aria-pressed={layer.printable} onClick={() => onUpdate(layer.id, { printable: !layer.printable })}><Printer size={14} /></button>
            <button type="button" aria-label={`Usuń warstwę ${layer.name}`} title="Usuń i przenieś elementy na warstwę 0" disabled={readOnly || layer.id === DEFAULT_LAYER_ID} onClick={() => onDelete(layer.id)}><Trash2 size={14} /></button>
            <select aria-label={`Typ linii warstwy ${layer.name}`} value={layer.lineType} disabled={readOnly} onChange={(event) => onUpdate(layer.id, { lineType: event.target.value })}>{LINE_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
            <select aria-label={`Grubość linii warstwy ${layer.name}`} value={layer.lineWeight} disabled={readOnly} onChange={(event) => onUpdate(layer.id, { lineWeight: Number(event.target.value) })}>{LINE_WEIGHTS.map((weight) => <option key={weight} value={weight}>{weight.toFixed(2)} mm</option>)}</select>
          </div>
        ))}
      </div>
      <div className="layer-selection-properties">
        <strong>Wybrane elementy · {selectedEntities.length}</strong>
        <label><span>Warstwa</span><select value={selectedLayerId} disabled={readOnly || !selectedEntities.length} onChange={(event) => onAssign(event.target.value)}>{selectedLayerId === 'mixed' && <option value="mixed" disabled>Różne</option>}{document.layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
        <label><span>Typ linii</span><select value={selectedLineType} disabled={readOnly || !selectedEntities.length} onChange={(event) => onStyleSelected({ lineType: event.target.value })}>{selectedLineType === 'mixed' && <option value="mixed" disabled>Różne</option>}<option value={BY_LAYER}>ByLayer</option>{LINE_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Grubość</span><select value={selectedLineWeight} disabled={readOnly || !selectedEntities.length} onChange={(event) => onStyleSelected({ lineWeight: event.target.value === BY_LAYER ? BY_LAYER : Number(event.target.value) })}>{selectedLineWeight === 'mixed' && <option value="mixed" disabled>Różne</option>}<option value={BY_LAYER}>ByLayer</option>{LINE_WEIGHTS.map((weight) => <option key={weight} value={weight}>{weight.toFixed(2)} mm</option>)}</select></label>
        <label className="layer-color-override"><span>Kolor</span><select value={selectedColor === 'mixed' ? 'mixed' : selectedColor === BY_LAYER ? BY_LAYER : 'custom'} disabled={readOnly || !selectedEntities.length} onChange={(event) => onStyleSelected({ color: event.target.value === BY_LAYER ? BY_LAYER : customColor })}>{selectedColor === 'mixed' && <option value="mixed" disabled>Różne</option>}<option value={BY_LAYER}>ByLayer</option><option value="custom">Własny</option></select><input aria-label="Własny kolor wybranych elementów" type="color" value={customColor} disabled={readOnly || !selectedEntities.length || selectedColor === BY_LAYER} onChange={(event) => onStyleSelected({ color: event.target.value })} /></label>
      </div>
    </aside>
  );
}

export function BlocksPanel({ document, selectedEntities = [], selectedInstance = null, readOnly = false, onCreate, onInsert, onDeleteDefinition, onAddAttribute, onUpdateInstanceAttribute, onExplode, onDeleteInstance, onClose }) {
  const [selectedBlockId, setSelectedBlockId] = React.useState(document.blocks[0]?.id || '');
  const [name, setName] = React.useState(`Blok ${document.blocks.length + 1}`);
  const [baseX, setBaseX] = React.useState('0');
  const [baseY, setBaseY] = React.useState('0');
  const [insertX, setInsertX] = React.useState('0');
  const [insertY, setInsertY] = React.useState('0');
  const [rotation, setRotation] = React.useState('0');
  const [scale, setScale] = React.useState('1');
  const [attributeTag, setAttributeTag] = React.useState('NUMER');
  const [attributeDefault, setAttributeDefault] = React.useState('');
  const selectedBlock = document.blocks.find((block) => block.id === selectedBlockId) || document.blocks[0] || null;
  const instanceBlock = selectedInstance ? document.blocks.find((block) => block.id === selectedInstance.blockId) : null;
  const usageCount = (blockId) => document.sketches.reduce((total, sketch) => total + (sketch.blockInstances || []).filter((instance) => instance.blockId === blockId).length, 0);
  return (
    <aside className="measure-panel blocks-panel" aria-label="Biblioteka bloków">
      <header><div><Blocks size={16} /><strong>Bloki 2D</strong></div><button type="button" title="Zamknij bloki" aria-label="Zamknij bloki" onClick={onClose}><X size={15} /></button></header>
      <div className="block-create-section">
        <strong>Utwórz z zaznaczenia · {selectedEntities.length}</strong>
        <input aria-label="Nazwa nowego bloku" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nazwa bloku" />
        <div className="block-coordinate-row"><label><span>Baza X</span><input value={baseX} onChange={(event) => setBaseX(event.target.value)} /></label><label><span>Baza Y</span><input value={baseY} onChange={(event) => setBaseY(event.target.value)} /></label></div>
        <button type="button" disabled={readOnly || !selectedEntities.length || !name.trim()} onClick={() => onCreate({ name, basePoint: [baseX, baseY] })}><Plus size={14} /> Utwórz blok</button>
      </div>
      <div className="block-library" aria-label="Biblioteka dokumentu">
        <strong>Biblioteka dokumentu · {document.blocks.length}</strong>
        {!document.blocks.length && <p>Zaznacz zamknięty lub połączony fragment szkicu i utwórz pierwszy blok.</p>}
        {document.blocks.map((block) => <div className={`block-library-row ${selectedBlock?.id === block.id ? 'active' : ''}`} key={block.id}><button type="button" onClick={() => setSelectedBlockId(block.id)}><Blocks size={15} /><span><strong>{block.name}</strong><small>{block.entities.filter((entity) => entity.type !== 'point').length} elementów · {usageCount(block.id)} wyst.</small></span></button><button type="button" aria-label={`Usuń definicję ${block.name}`} disabled={readOnly || usageCount(block.id) > 0} onClick={() => onDeleteDefinition(block.id)}><Trash2 size={14} /></button></div>)}
      </div>
      {selectedBlock && <div className="block-insert-section">
        <strong>Wstaw „{selectedBlock.name}”</strong>
        <div className="block-coordinate-row"><label><span>X</span><input value={insertX} onChange={(event) => setInsertX(event.target.value)} /></label><label><span>Y</span><input value={insertY} onChange={(event) => setInsertY(event.target.value)} /></label></div>
        <div className="block-coordinate-row"><label><span>Obrót °</span><input value={rotation} onChange={(event) => setRotation(event.target.value)} /></label><label><span>Skala</span><input value={scale} onChange={(event) => setScale(event.target.value)} /></label></div>
        <button type="button" disabled={readOnly} onClick={() => onInsert(selectedBlock.id, { insertionPoint: [insertX, insertY], rotation, scale })}><Plus size={14} /> Wstaw wystąpienie</button>
        <div className="block-attribute-add"><input aria-label="Tag nowego atrybutu" value={attributeTag} onChange={(event) => setAttributeTag(event.target.value.toUpperCase())} /><input aria-label="Wartość domyślna atrybutu" value={attributeDefault} onChange={(event) => setAttributeDefault(event.target.value)} placeholder="Wartość domyślna" /><button type="button" disabled={readOnly || !attributeTag.trim()} onClick={() => onAddAttribute(selectedBlock.id, { tag: attributeTag, prompt: attributeTag, defaultValue: attributeDefault })}><Plus size={14} /> Atrybut</button></div>
        {!!selectedBlock.attributeDefinitions.length && <div className="block-attribute-tags">{selectedBlock.attributeDefinitions.map((attribute) => <span key={attribute.id}>{attribute.tag} · {attribute.defaultValue || '—'}</span>)}</div>}
      </div>}
      {selectedInstance && instanceBlock && <div className="block-instance-section">
        <strong>Zaznaczone wystąpienie · {instanceBlock.name}</strong>
        {instanceBlock.attributeDefinitions.map((attribute) => <label key={attribute.id}><span>{attribute.prompt || attribute.tag}</span><input value={selectedInstance.attributes[attribute.tag] ?? ''} disabled={readOnly} onChange={(event) => onUpdateInstanceAttribute(selectedInstance.id, attribute.tag, event.target.value)} /></label>)}
        {!instanceBlock.attributeDefinitions.length && <p>Ten blok nie ma atrybutów.</p>}
        <div><button type="button" disabled={readOnly} onClick={() => onExplode(selectedInstance.id)}><Ungroup size={14} /> Rozbij</button><button type="button" className="danger" disabled={readOnly} onClick={() => onDeleteInstance(selectedInstance.id)}><Trash2 size={14} /> Usuń</button></div>
      </div>}
    </aside>
  );
}

export function CommandCustomizationPanel({ customization, onSave, onReset, onClose }) {
  const [draft, setDraft] = React.useState(() => structuredClone(customization));
  const validation = validateCommandCustomization(draft);
  const rows = commandCustomizationRows(draft);
  const update = (label, key, value) => setDraft((current) => ({
    ...current,
    commands: { ...current.commands, [label]: { ...current.commands[label], [key]: value.toUpperCase().replace(/\s+/g, '') } },
  }));
  return (
    <aside className="measure-panel command-customization-panel" aria-label="Aliasy i skróty poleceń">
      <header><div><Keyboard size={16} /><strong>Aliasy i skróty</strong></div><button type="button" title="Zamknij ustawienia skrótów" aria-label="Zamknij ustawienia skrótów" onClick={onClose}><X size={15} /></button></header>
      <div className="command-customization-intro"><p>Alias wpisujesz w linii poleceń. Klawisz uruchamia narzędzie bezpośrednio, gdy nie edytujesz pola tekstowego.</p><div><span>Polecenie</span><span>Alias</span><span>Klawisz</span></div></div>
      <div className="command-customization-list">
        {rows.map((row) => <div className="command-customization-row" key={row.label}><strong>{row.label}</strong><input aria-label={`Alias polecenia ${row.label}`} value={row.alias} maxLength={16} onChange={(event) => update(row.label, 'alias', event.target.value)} /><input aria-label={`Klawisz polecenia ${row.label}`} value={row.shortcut} maxLength={3} placeholder="—" onChange={(event) => update(row.label, 'shortcut', event.target.value)} /></div>)}
      </div>
      {!!validation.errors.length && <div className="command-customization-errors" role="alert">{validation.errors.slice(0, 4).map((error) => <span key={error}>{error}</span>)}</div>}
      <footer><button type="button" onClick={() => { const reset = onReset(); setDraft(structuredClone(reset)); }}><RotateCcw size={14} /> Autodesk</button><button className="confirm" type="button" disabled={!validation.valid} onClick={() => onSave(validation.customization)}><Check size={14} /> Zapisz</button></footer>
    </aside>
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

export function ImportRepairReportDialog({ report, onSave, onClose }) {
  if (!report) return null;
  const iconFor = (status) => status === 'changed' ? AlertTriangle : status === 'skipped' ? XCircle : CheckCircle2;
  return (
    <section className="command-dialog import-repair-report" aria-label="Raport naprawy importu">
      <header><strong>Raport importu</strong><button type="button" onClick={onClose} title="Zamknij raport" aria-label="Zamknij raport"><X size={15} /></button></header>
      <div className="import-report-heading"><div><strong>{report.fileName}</strong><span>{report.format.toUpperCase()} · {report.sourceUnit || 'jednostka automatyczna'}</span></div><CheckCircle2 size={20} /></div>
      <div className="import-report-summary" aria-label="Podsumowanie raportu">
        <span><b>{report.imported}</b> dodano</span>
        <span className="changed"><b>{report.changed}</b> zmieniono</span>
        <span className="skipped"><b>{report.skipped}</b> pominięto</span>
        <span><b>{report.warnings}</b> ostrzeżeń</span>
      </div>
      <div className="import-report-list">
        <h3>Zmiany i pominięcia</h3>
        {report.entries.length ? report.entries.map((entry) => {
          const StatusIcon = iconFor(entry.status);
          return <div key={entry.id} className={`import-report-entry ${entry.status}`}><StatusIcon size={15} /><div><strong>{entry.status === 'changed' ? 'Zmieniono' : entry.status === 'skipped' ? 'Pominięto' : 'Sprawdź'}</strong><span>{entry.message}</span><small>{entry.code}</small></div></div>;
        }) : <div className="import-report-clean"><CheckCircle2 size={17} /><span>Nie zmieniono ani nie pominięto żadnego elementu.</span></div>}
      </div>
      <footer><button className="secondary" type="button" onClick={onSave}><FileDown size={14} /> Zapisz JSON</button><button className="confirm" type="button" onClick={onClose}><Check size={14} /> Gotowe</button></footer>
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
