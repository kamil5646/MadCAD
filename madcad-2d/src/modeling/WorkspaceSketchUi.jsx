import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Frame, X } from 'lucide-react';
import { createParameter } from '../cad-core/document.js';
import { useDialogFocus } from './use-dialog-focus.js';

const PLANE_LABELS = { XY: 'Góra (XY)', XZ: 'Przód (XZ)', YZ: 'Prawo (YZ)' };

export function PlanePicker({ onPick, onCancel }) {
  const dialogRef = useDialogFocus();
  return (
    <div className="plane-picker-backdrop">
      <section ref={dialogRef} className="plane-picker" role="dialog" aria-modal="true" aria-labelledby="planePickerTitle" tabIndex="-1">
        <header><div><strong id="planePickerTitle">Wybierz płaszczyznę szkicu</strong><span>Wskaż jedną z płaszczyzn początku.</span></div><button type="button" onClick={onCancel} title="Anuluj" aria-label="Anuluj wybór płaszczyzny"><X size={17} /></button></header>
        <div className="plane-options">
          {Object.entries(PLANE_LABELS).map(([plane, label]) => (
            <button key={plane} type="button" data-dialog-initial-focus={plane === 'XY' ? '' : undefined} onClick={() => onPick(plane)}>
              <Frame size={28} strokeWidth={1.25} /><strong>{plane}</strong><span>{label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ParametersDialog({ document, commit, onClose }) {
  const dialogRef = useDialogFocus();
  const add = () => {
    let number = document.parameters.length + 1;
    while (document.parameters.some((item) => item.name === `parametr${number}`)) number += 1;
    commit((next) => next.parameters.push(createParameter(`parametr${number}`, 10, 'mm', `Parametr ${number}`)));
  };
  return (
    <section ref={dialogRef} className="parameters-dialog" role="dialog" aria-modal="true" aria-labelledby="parametersDialogTitle" tabIndex="-1">
      <header><div><strong id="parametersDialogTitle">Parametry</strong><span>Steruj wymiarami modelu z jednego miejsca.</span></div><button type="button" onClick={onClose} title="Zamknij" aria-label="Zamknij parametry"><X size={16} /></button></header>
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

export function SketchPalette({ options, onChange, onFinish }) {
  const [expanded, setExpanded] = useState(false);
  const basicItems = [
    ['grid', 'Siatka szkicu'],
    ['snap', 'Przyciąganie'],
    ['autoConstraints', 'Automatyczne więzy'],
    ['profiles', 'Profile'],
    ['points', 'Punkty'],
    ['dimensions', 'Wymiary'],
    ['constraints', 'Wiązania'],
  ];
  const advancedItems = [
    ['construction', 'Geometrie konstrukcyjne'],
    ['projected', 'Geometria Project'],
    ['slice', 'Slice modelu'],
    ['sketch3d', 'Szkic 3D'],
  ];
  return (
    <aside className={`sketch-palette ${expanded ? '' : 'collapsed'}`}>
      <header>
        <div className="sketch-palette-heading"><strong>PALETA SZKICU</strong><span className={options.snap ? 'active' : ''}>{options.snap ? `SNAP ${options.snapDistance}px` : 'SNAP WYŁ.'}</span></div>
        <button className="sketch-palette-toggle" type="button" title={expanded ? 'Zwiń paletę szkicu' : 'Rozwiń paletę szkicu'} aria-label={expanded ? 'Zwiń paletę szkicu' : 'Rozwiń paletę szkicu'} aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
      </header>
      {expanded && <div className="sketch-palette-body">
        <h3>Widok i snap</h3>
        {basicItems.map(([key, label]) => (
          <label key={key} data-sketch-option={key}><span>{label}</span><input type="checkbox" checked={Boolean(options[key])} onChange={(event) => onChange(key, event.target.checked)} /></label>
        ))}
        <label className="sketch-snap-threshold">
          <span>Próg snap <output>{options.snapDistance}px</output></span>
          <input type="range" min="4" max="24" step="1" value={options.snapDistance} disabled={!options.snap} onChange={(event) => onChange('snapDistance', Number(event.target.value))} />
        </label>
        <details className="sketch-advanced-options">
          <summary>Opcje zaawansowane</summary>
          {advancedItems.map(([key, label]) => (
            <label key={key} data-sketch-option={key}><span>{label}</span><input type="checkbox" checked={Boolean(options[key])} onChange={(event) => onChange(key, event.target.checked)} /></label>
          ))}
        </details>
        <div className="sketch-state-legend" aria-label="Legenda stanów geometrii szkicu">
          <h3>Stany geometrii</h3>
          <span><i className="under" /> Niedowiązana</span>
          <span><i className="fixed" /> W pełni związana</span>
          <span><i className="construction" /> Konstrukcyjna</span>
          <span><i className="projected" /> Rzutowana</span>
          <span><i className="selected" /> Zaznaczona</span>
          <span><i className="error" /> Błąd geometrii</span>
        </div>
      </div>}
      {expanded && <footer><button type="button" onClick={onFinish}>Zakończ szkic</button></footer>}
    </aside>
  );
}
