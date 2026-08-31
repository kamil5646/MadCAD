import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, MoreHorizontal, X } from 'lucide-react';
import { createParameter } from '../cad-core/document.js';
import { useDialogFocus } from './use-dialog-focus.js';

const PLANE_LABELS = { XY: 'Góra (XY)', XZ: 'Przód (XZ)', YZ: 'Prawo (YZ)' };

function PlaneGlyph({ plane }) {
  const polygons = {
    XY: '8,24 28,14 48,24 28,34',
    XZ: '10,31 10,10 46,17 46,38',
    YZ: '12,17 32,8 48,18 28,29',
  };
  const accent = { XY: '#62d7f2', XZ: '#f3bd63', YZ: '#72d5a1' }[plane];
  return (
    <svg className={`plane-glyph plane-glyph-${plane.toLowerCase()}`} viewBox="0 0 56 44" aria-hidden="true">
      <polygon points={polygons[plane]} fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="2" />
      <path d="M28 22V4M28 22L52 34M28 22L5 37" fill="none" stroke="#d9e4eb" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="28" cy="22" r="2.2" fill={accent} />
    </svg>
  );
}

export function PlanePicker({ existingSketchesByPlane = {}, onPick, onCancel, variant = 'dialog' }) {
  const canvasVariant = variant === 'canvas';
  const dialogRef = useDialogFocus(true, { trap: !canvasVariant });
  const [forceNew, setForceNew] = useState(false);
  const hasExistingSketch = Object.values(existingSketchesByPlane).some(Boolean);
  useEffect(() => {
    const onKeyDown = (event) => {
      const plane = { 1: 'XY', 2: 'XZ', 3: 'YZ' }[event.key];
      if (plane) {
        event.preventDefault();
        onPick(plane, { forceNew });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [forceNew, onCancel, onPick]);
  const picker = (
      <section ref={dialogRef} className={`plane-picker ${canvasVariant ? 'plane-picker-canvas' : ''}`} role="dialog" aria-modal={canvasVariant ? 'false' : 'true'} aria-labelledby="planePickerTitle" aria-describedby="planePickerHint" tabIndex="-1">
        <header><div><strong id="planePickerTitle">Wybierz płaszczyznę szkicu</strong><span>{canvasVariant ? 'Kliknij kolorową płaszczyznę bezpośrednio w modelu.' : 'Wskaż jedną z płaszczyzn początku.'}</span></div><button type="button" onClick={onCancel} title="Anuluj" aria-label="Anuluj wybór płaszczyzny"><X size={17} /></button></header>
        {canvasVariant && <p id="planePickerHint" className="plane-picker-hint">Możesz też wybrać płaszczyznę z panelu projektu albo nacisnąć 1–3. Esc anuluje.</p>}
        <div className="plane-options">
          {Object.entries(PLANE_LABELS).map(([plane, label], index) => {
            const existing = existingSketchesByPlane[plane];
            const continuing = Boolean(existing && !forceNew);
            return (
              <button key={plane} type="button" aria-label={`${plane} · ${label} · ${continuing ? `Kontynuuj ${existing.name}` : 'Nowy szkic'}`} data-dialog-initial-focus={plane === 'XY' ? '' : undefined} onClick={() => onPick(plane, { forceNew })}>
                <kbd>{index + 1}</kbd><PlaneGlyph plane={plane} /><strong>{label}</strong><span>{continuing ? `Kontynuuj ${existing.name}` : `Nowy szkic · ${plane}`}</span>
              </button>
            );
          })}
        </div>
        {hasExistingSketch && <label className="plane-new-sketch-option"><input type="checkbox" checked={forceNew} onChange={(event) => setForceNew(event.target.checked)} /><span>Utwórz oddzielny szkic zamiast kontynuować istniejący</span></label>}
      </section>
  );
  return canvasVariant ? picker : <div className="plane-picker-backdrop">{picker}</div>;
}

export function AdaptiveToolShelf({ title, subtitle, actions = [], moreActions = [], onClear }) {
  if (!actions.length && !moreActions.length) return null;
  return (
    <aside className="adaptive-tool-shelf" role="toolbar" aria-label={`Narzędzia dla zaznaczenia: ${title}`}>
      <header>
        <span><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span>
        {onClear && <button className="adaptive-tool-clear" type="button" title="Wyczyść zaznaczenie" aria-label="Wyczyść zaznaczenie" onClick={onClear}><X size={14} /></button>}
      </header>
      <div className="adaptive-tool-actions">
        {actions.map(({ icon: Icon, label, onClick, disabled = false, primary = false, danger = false }) => (
          <button key={label} className={`${primary ? 'primary' : ''} ${danger ? 'danger' : ''}`} type="button" disabled={disabled} onClick={onClick} title={label} aria-label={label}>
            <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
          </button>
        ))}
        {moreActions.length > 0 && <details className="adaptive-tool-more">
          <summary title="Więcej pasujących narzędzi"><MoreHorizontal size={18} /><span>Więcej</span></summary>
          <div role="menu" aria-label="Więcej pasujących narzędzi">
            {moreActions.map(({ icon: Icon, label, onClick, disabled = false, danger = false }) => (
              <button key={label} className={danger ? 'danger' : ''} type="button" role="menuitem" disabled={disabled} onClick={(event) => { onClick?.(event); event.currentTarget.closest('details')?.removeAttribute('open'); }}>
                <Icon size={17} strokeWidth={1.9} /><span>{label}</span>
              </button>
            ))}
          </div>
        </details>}
      </div>
    </aside>
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
