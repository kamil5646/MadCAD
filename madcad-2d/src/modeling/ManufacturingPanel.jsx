import React from 'react';
import { AlertTriangle, Box, CheckCircle2, Crosshair, Plus, Trash2 } from 'lucide-react';
import { CAM_MACHINE_PRESETS, CAM_WCS_ORIGINS, calculateManufacturingSetup } from '../cad-core/manufacturing.js';

const millimeter = (value) => Number.isFinite(value) ? `${value.toFixed(2)} mm` : '—';

export function ManufacturingPanel({ manufacturing, bodies = [], readOnly = false, onCreate, onActivate, onUpdate, onDelete }) {
  const setups = manufacturing?.setups || [];
  const activeId = manufacturing?.activeSetupId || setups[0]?.id || '';
  const setup = setups.find((item) => item.id === activeId) || null;
  const result = setup ? calculateManufacturingSetup(setup, bodies) : null;
  const solidBodies = bodies.filter((body) => body.bodyKind !== 'surface');
  const update = (patch) => setup && onUpdate(setup.id, patch);

  return (
    <aside className="manufacturing-panel" aria-label="Setup wytwarzania CAM">
      <header>
        <div><Box size={18} /><span><strong>Setup CAM</strong><small>Frezowanie 3-osiowe</small></span></div>
        <button type="button" disabled={readOnly || !solidBodies.length} onClick={onCreate}><Plus size={15} /> Nowy Setup</button>
      </header>
      {!solidBodies.length ? <div className="manufacturing-empty"><AlertTriangle size={22} /><strong>Najpierw utwórz bryłę</strong><p>Setup wymaga gotowego modelu 3D. Wróć do Projektuj, utwórz albo zaimportuj bryłę i uruchom Wytwarzanie ponownie.</p></div> : !setup ? <div className="manufacturing-empty"><Box size={26} /><strong>Przygotuj pierwszą obróbkę</strong><p>Setup łączy model z obrabiarką, półfabrykatem i układem współrzędnych.</p><button type="button" disabled={readOnly} onClick={onCreate}><Plus size={15} /> Utwórz Setup</button></div> : <>
        <nav aria-label="Setupy CAM">{setups.map((item) => <button key={item.id} type="button" className={item.id === setup.id ? 'active' : ''} onClick={() => onActivate(item.id)}>{item.name}</button>)}</nav>
        <div className="manufacturing-form">
          <label><span>Nazwa</span><input value={setup.name} maxLength="80" disabled={readOnly} onChange={(event) => update({ name: event.target.value })} /></label>
          <label><span>Bryła do obróbki</span><select value={setup.bodyId} disabled={readOnly} onChange={(event) => update({ bodyId: event.target.value })}>{solidBodies.map((body, index) => <option value={body.id} key={body.id}>{body.name || `Bryła ${index + 1}`}</option>)}</select></label>
          <label><span>Obrabiarka</span><select value={setup.machineId} disabled={readOnly} onChange={(event) => update({ machineId: event.target.value })}>{Object.values(CAM_MACHINE_PRESETS).map((machine) => <option value={machine.id} key={machine.id}>{machine.name}</option>)}</select></label>
          <fieldset><legend>Półfabrykat — naddatki</legend><div className="manufacturing-field-grid">
            <label><span>Boki</span><input type="number" min="0" step="0.5" value={setup.stock.sideOffset} disabled={readOnly} onChange={(event) => update({ stock: { ...setup.stock, sideOffset: event.target.value } })} /><em>mm</em></label>
            <label><span>Góra</span><input type="number" min="0" step="0.5" value={setup.stock.topOffset} disabled={readOnly} onChange={(event) => update({ stock: { ...setup.stock, topOffset: event.target.value } })} /><em>mm</em></label>
            <label><span>Dół</span><input type="number" min="0" step="0.5" value={setup.stock.bottomOffset} disabled={readOnly} onChange={(event) => update({ stock: { ...setup.stock, bottomOffset: event.target.value } })} /><em>mm</em></label>
          </div></fieldset>
          <fieldset><legend><Crosshair size={13} /> Układ współrzędnych</legend>
            <label><span>Punkt zerowy WCS</span><select value={setup.wcsOrigin} disabled={readOnly} onChange={(event) => update({ wcsOrigin: event.target.value })}>{CAM_WCS_ORIGINS.map((origin) => <option value={origin.id} key={origin.id}>{origin.name}</option>)}</select></label>
            <label><span>Wysokość bezpieczna</span><input type="number" min="0" step="0.5" value={setup.safeHeight} disabled={readOnly} onChange={(event) => update({ safeHeight: event.target.value })} /><em>mm</em></label>
          </fieldset>
        </div>
        <section className={`manufacturing-summary ${result?.valid ? 'valid' : 'invalid'}`}>
          <h3>{result?.valid ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}{result?.valid ? 'Setup gotowy' : 'Setup wymaga poprawy'}</h3>
          {result?.dimensions && <dl><div><dt>Półfabrykat X × Y × Z</dt><dd>{result.dimensions.map(millimeter).join(' × ')}</dd></div><div><dt>Zero WCS X / Y / Z</dt><dd>{result.origin.map(millimeter).join(' / ')}</dd></div><div><dt>Płaszczyzna bezpieczna Z</dt><dd>{millimeter(result.clearancePlaneZ)}</dd></div></dl>}
          {result?.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </section>
        <footer><span>Kolejny etap: narzędzie i ścieżka 2D Adaptive.</span><button type="button" disabled={readOnly} onClick={() => onDelete(setup.id)}><Trash2 size={14} /> Usuń Setup</button></footer>
      </>}
    </aside>
  );
}
