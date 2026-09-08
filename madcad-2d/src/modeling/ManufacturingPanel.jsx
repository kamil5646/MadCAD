import React, { useEffect, useState } from 'react';
import { AlertTriangle, Box, CheckCircle2, Crosshair, FileDown, Gauge, Layers3, Plus, Route, ScanLine, Trash2 } from 'lucide-react';
import { CAM_MACHINE_PRESETS, CAM_TOOL_PRESETS, CAM_WCS_ORIGINS, calculateManufacturingSetup, calculateOperationToolpath } from '../cad-core/manufacturing.js';

const millimeter = (value) => Number.isFinite(value) ? `${value.toFixed(2)} mm` : '—';

export function ManufacturingPanel({ manufacturing, bodies = [], projectDocument = null, readOnly = false, onCreate, onActivate, onUpdate, onDelete, onCreateOperation, onUpdateOperation, onDeleteOperation, onExportOperation }) {
  const setups = manufacturing?.setups || [];
  const activeId = manufacturing?.activeSetupId || setups[0]?.id || '';
  const setup = setups.find((item) => item.id === activeId) || null;
  const result = setup ? calculateManufacturingSetup(setup, bodies) : null;
  const solidBodies = bodies.filter((body) => body.bodyKind !== 'surface');
  const update = (patch) => setup && onUpdate(setup.id, patch);
  const [panelPage, setPanelPage] = useState('setup');
  useEffect(() => setPanelPage('setup'), [setup?.id]);

  return (
    <aside className="manufacturing-panel" aria-label="Setup wytwarzania CAM">
      <header>
        <div><Box size={18} /><span><strong>Setup CAM</strong><small>Frezowanie 3-osiowe</small></span></div>
        <button type="button" disabled={readOnly || !solidBodies.length} onClick={onCreate}><Plus size={15} /> Nowy Setup</button>
      </header>
      {!solidBodies.length ? <div className="manufacturing-empty"><AlertTriangle size={22} /><strong>Najpierw utwórz bryłę</strong><p>Setup wymaga gotowego modelu 3D. Wróć do Projektuj, utwórz albo zaimportuj bryłę i uruchom Wytwarzanie ponownie.</p></div> : !setup ? <div className="manufacturing-empty"><Box size={26} /><strong>Przygotuj pierwszą obróbkę</strong><p>Setup łączy model z obrabiarką, półfabrykatem i układem współrzędnych.</p><button type="button" disabled={readOnly} onClick={onCreate}><Plus size={15} /> Utwórz Setup</button></div> : <>
        <nav aria-label="Setupy CAM">{setups.map((item) => <button key={item.id} type="button" className={item.id === setup.id ? 'active' : ''} onClick={() => onActivate(item.id)}>{item.name}</button>)}</nav>
        <div className="manufacturing-page-tabs" role="tablist" aria-label="Sekcja Setupu CAM"><button type="button" role="tab" aria-selected={panelPage === 'setup'} className={panelPage === 'setup' ? 'active' : ''} onClick={() => setPanelPage('setup')}>Ustawienia</button><button type="button" role="tab" aria-selected={panelPage === 'operations'} className={panelPage === 'operations' ? 'active' : ''} onClick={() => setPanelPage('operations')}>Operacje <span>{setup.operations.length}</span></button></div>
        {panelPage === 'setup' && <>
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
        </>}
        {panelPage === 'operations' && <section className="manufacturing-operation-list" aria-label="Operacje CAM">
          <header><div><strong>Operacje</strong><small>Kolejność wykonania od góry</small></div><div className="manufacturing-add-actions"><button type="button" disabled={readOnly || !result?.valid} onClick={() => onCreateOperation(setup.id, 'face')}><ScanLine size={14} /> Planowanie</button><button type="button" disabled={readOnly || !result?.valid} onClick={() => onCreateOperation(setup.id, 'pocket')}><Layers3 size={14} /> Kieszeń</button><button type="button" disabled={readOnly || !result?.valid} onClick={() => onCreateOperation(setup.id, 'adaptive')}><Gauge size={14} /> Adaptacyjne</button><button type="button" disabled={readOnly || !result?.valid} onClick={() => onCreateOperation(setup.id, 'contour')}><Route size={14} /> Kontur</button></div></header>
          {!setup.operations.length && <div className="manufacturing-operation-empty"><div><strong>Dodaj pierwszą operację</strong><small>Bez zaznaczenia używana jest góra bryły. Aby ograniczyć kieszeń lub kontur, zaznacz wcześniej poziomą ścianę modelu.</small></div></div>}
          {setup.operations.map((operation, operationIndex) => {
            const toolpath = calculateOperationToolpath(setup, operation, bodies, projectDocument);
            const isContour = operation.type === 'contour';
            const isPocket = operation.type === 'pocket';
            const isAdaptive = operation.type === 'adaptive';
            const OperationIcon = isContour ? Route : isPocket ? Layers3 : isAdaptive ? Gauge : ScanLine;
            return <section className="manufacturing-operation" key={operation.id}>
              <header><div><OperationIcon size={15} /><span><strong>{operationIndex + 1} · {operation.name}</strong><small>{isContour ? 'Zewnętrzny obrys górnej powierzchni' : isPocket ? 'Wnętrze górnego obrysu bryły' : isAdaptive ? 'Stałe obciążenie i wejście rampą' : 'Równoległe planowanie powierzchni'}</small></span></div><button type="button" aria-label={`Usuń operację ${operation.name}`} disabled={readOnly} onClick={() => onDeleteOperation(setup.id, operation.id)}><Trash2 size={13} /></button></header>
              <div className="manufacturing-form operation-form">
                <label><span>Nazwa</span><input value={operation.name} maxLength="80" disabled={readOnly} onChange={(event) => onUpdateOperation(setup.id, operation.id, { name: event.target.value })} /></label>
                {(isContour || isPocket || isAdaptive) && <div className="manufacturing-boundary"><Crosshair size={13} /><span><strong>Granica</strong><small>{operation.boundaryProfileId ? 'Skojarzony profil szkicu XY' : operation.boundaryFaceId ? 'Zaznaczona pozioma ściana' : 'Automatycznie: górny obrys bryły'}</small></span></div>}
                <label><span>Narzędzie</span><select value={operation.toolId} disabled={readOnly} onChange={(event) => onUpdateOperation(setup.id, operation.id, { toolId: event.target.value })}>{Object.values(CAM_TOOL_PRESETS).map((tool) => <option value={tool.id} key={tool.id}>{tool.name}</option>)}</select></label>
                <div className="manufacturing-field-grid">
                  {isContour || isPocket || isAdaptive ? <label><span>Głębokość</span><input type="number" min="0.05" step="0.1" value={operation.targetDepth} disabled={readOnly} onChange={(event) => onUpdateOperation(setup.id, operation.id, { targetDepth: event.target.value })} /><em>mm</em></label> : <label><span>Stepover</span><input type="number" min="0.1" max="0.9" step="0.05" value={operation.stepover} disabled={readOnly} onChange={(event) => onUpdateOperation(setup.id, operation.id, { stepover: event.target.value })} /><em>×D</em></label>}
                  {isPocket && <label><span>Zakładka</span><input type="number" min="0.1" max="0.8" step="0.05" value={operation.stepover} disabled={readOnly} onChange={(event) => onUpdateOperation(setup.id, operation.id, { stepover: event.target.value })} /><em>×D</em></label>}
                  {isAdaptive && <label><span>Obciążenie</span><input type="number" min="0.1" max="0.6" step="0.05" value={operation.optimalLoad} disabled={readOnly} onChange={(event) => onUpdateOperation(setup.id, operation.id, { optimalLoad: event.target.value })} /><em>×D</em></label>}
                  <label><span>Zejście</span><input type="number" min="0.05" step="0.1" value={operation.maxStepdown} disabled={readOnly} onChange={(event) => onUpdateOperation(setup.id, operation.id, { maxStepdown: event.target.value })} /><em>mm</em></label>
                  <label><span>Posuw</span><input type="number" min="1" step="10" value={operation.feedRate} disabled={readOnly} onChange={(event) => onUpdateOperation(setup.id, operation.id, { feedRate: event.target.value })} /><em>mm/min</em></label>
                </div>
              </div>
              <div className={`manufacturing-toolpath-summary ${toolpath?.valid ? 'valid' : 'invalid'}`}>{toolpath?.valid ? <><CheckCircle2 size={14} /><span><strong>{toolpath.segments.length} segmentów · {toolpath.layerCount} warstwy</strong><small>{toolpath.cuttingDistance.toFixed(0)} mm skrawania · ok. {Math.max(1, Math.ceil(toolpath.durationMinutes))} min</small></span><button type="button" disabled={readOnly} onClick={() => onExportOperation(setup.id, operation.id)}><FileDown size={13} /> G-code</button></> : <><AlertTriangle size={14} /><span>{toolpath?.warnings.join(' ')}</span></>}</div>
            </section>;
          })}
        </section>}
        <footer><span>Setup i ścieżka są zapisane w projekcie oraz działają z Cofnij/Ponów.</span><button type="button" disabled={readOnly} onClick={() => onDelete(setup.id)}><Trash2 size={14} /> Usuń Setup</button></footer>
      </>}
    </aside>
  );
}
