import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  ChevronDown,
  Circle,
  CircleDotDashed,
  Cylinder,
  Diamond,
  FolderOpen,
  Frame,
  PanelLeftClose,
  Redo2,
  Save,
  Square,
  Triangle,
  Undo2,
  Variable,
} from 'lucide-react';
import {
  cloneDocument,
  createCircleProfile,
  createFeature,
  createParameter,
  createRectangleProfile,
  createSketch,
  createStarterDocument,
  touchDocument,
  validateDocument,
} from '../cad-core/document.js';
import { useCadEngine } from '../cad-core/useCadEngine.js';
import ModelViewport from './ModelViewport.jsx';
import './modeling.css';

const WORKSPACES = [
  { id: 'model', label: 'Model' },
  { id: 'sketch', label: 'Szkic' },
  { id: 'solid', label: 'Bryła' },
  { id: 'print', label: 'Druk 3D' },
];

function useDocumentHistory(initialDocument) {
  const [history, setHistory] = useState({ past: [], present: initialDocument, future: [] });
  const commit = (mutator) => {
    setHistory((current) => {
      const next = cloneDocument(current.present);
      mutator(next);
      touchDocument(next);
      return { past: [...current.past.slice(-39), current.present], present: next, future: [] };
    });
  };
  const replace = (document) => setHistory({ past: [], present: document, future: [] });
  const undo = () => setHistory((current) => current.past.length ? {
    past: current.past.slice(0, -1),
    present: current.past.at(-1),
    future: [current.present, ...current.future],
  } : current);
  const redo = () => setHistory((current) => current.future.length ? {
    past: [...current.past, current.present],
    present: current.future[0],
    future: current.future.slice(1),
  } : current);
  return {
    document: history.present,
    commit,
    replace,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(value) {
  return value.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'model';
}

function WorkspaceButton({ icon: Icon, iconText, label, detail, onClick, disabled }) {
  return (
    <button className="ribbon-tool" type="button" onClick={onClick} disabled={disabled}>
      <span className="ribbon-icon" aria-hidden="true">{Icon ? <Icon size={19} strokeWidth={1.7} /> : iconText}</span>
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </button>
  );
}

function ProjectTree({ document, bodies, selection, onSelect }) {
  return (
    <aside className="model-browser">
      <div className="panel-heading"><span>Przeglądarka</span><span className="panel-count">{bodies.length} brył</span></div>
      <button
        className={`tree-row tree-root ${selection?.kind === 'document' ? 'selected' : ''}`}
        type="button"
        onClick={() => onSelect({ kind: 'document', id: document.id })}
      >
        <span className="tree-toggle"><ChevronDown size={13} /></span><span className="tree-symbol"><Diamond size={13} /></span><span>{document.name}</span>
      </button>
      <div className="tree-section">
        <div className="tree-label">Parametry</div>
        {document.parameters.map((parameter) => (
          <button
            className={`tree-row tree-child ${selection?.kind === 'parameter' && selection.id === parameter.id ? 'selected' : ''}`}
            key={parameter.id}
            type="button"
            onClick={() => onSelect({ kind: 'parameter', id: parameter.id })}
          >
            <span className="tree-symbol muted"><Variable size={13} /></span><span>{parameter.label}</span><span className="tree-value">{parameter.expression} {parameter.unit}</span>
          </button>
        ))}
      </div>
      <div className="tree-section">
        <div className="tree-label">Szkice</div>
        {document.sketches.map((sketch) => (
          <React.Fragment key={sketch.id}>
            <button
              className={`tree-row tree-child ${selection?.kind === 'sketch' && selection.id === sketch.id ? 'selected' : ''}`}
              type="button"
              onClick={() => onSelect({ kind: 'sketch', id: sketch.id })}
            >
              <span className="tree-symbol"><Frame size={13} /></span><span>{sketch.name}</span><span className="tree-value">{sketch.plane}</span>
            </button>
            {sketch.profiles.map((profile) => (
              <button
                className={`tree-row tree-grandchild ${selection?.kind === 'profile' && selection.id === profile.id ? 'selected' : ''}`}
                key={profile.id}
                type="button"
                onClick={() => onSelect({ kind: 'profile', id: profile.id, sketchId: sketch.id })}
              >
                <span className="tree-symbol muted">{profile.type === 'circle' ? <Circle size={13} /> : <Square size={13} />}</span><span>{profile.name}</span>
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="tree-section">
        <div className="tree-label">Bryły</div>
        {bodies.map((body) => (
          <button
            className={`tree-row tree-child ${selection?.kind === 'body' && selection.id === body.id ? 'selected' : ''}`}
            key={body.id}
            type="button"
            onClick={() => onSelect({ kind: 'body', id: body.id })}
          >
            <span className="body-dot" style={{ background: body.color }} /><span>{body.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function Field({ label, value, onChange, suffix, type = 'text', disabled = false }) {
  return (
    <label className="property-field">
      <span>{label}</span>
      <div className="property-input-wrap">
        <input type={type} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} disabled={disabled} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function Inspector({ document, selection, bodies, engine, commit, onSelect }) {
  const selectedParameter = document.parameters.find((item) => selection?.kind === 'parameter' && item.id === selection.id);
  const selectedSketch = document.sketches.find((item) => selection?.kind === 'sketch' && item.id === selection.id);
  const profileMatch = document.sketches
    .flatMap((sketch) => sketch.profiles.map((profile) => ({ sketch, profile })))
    .find(({ profile }) => selection?.kind === 'profile' && profile.id === selection.id);
  const selectedFeature = document.features.find((item) => selection?.kind === 'feature' && item.id === selection.id);
  const selectedBody = bodies.find((item) => selection?.kind === 'body' && item.id === selection.id);
  const bodySize = selectedBody ? selectedBody.bounds[1].map((max, index) => max - selectedBody.bounds[0][index]) : null;

  if (selectedParameter) {
    return (
      <aside className="property-panel">
        <div className="panel-heading">Parametr użytkownika</div>
        <div className="property-section">
          <Field label="Etykieta" value={selectedParameter.label} onChange={(value) => commit((next) => { next.parameters.find((item) => item.id === selectedParameter.id).label = value; })} />
          <Field label="Nazwa" value={selectedParameter.name} disabled />
          <Field label="Wyrażenie" value={selectedParameter.expression} suffix="mm" onChange={(value) => commit((next) => { next.parameters.find((item) => item.id === selectedParameter.id).expression = value; })} />
          <p className="property-note">Możesz używać innych parametrów oraz działań + − × ÷, np. <code>szerokosc / 2</code>.</p>
        </div>
      </aside>
    );
  }

  if (profileMatch) {
    const { profile } = profileMatch;
    const updateGeometry = (key, value) => commit((next) => {
      const target = next.sketches.flatMap((sketch) => sketch.profiles).find((item) => item.id === profile.id);
      target.geometry[key] = value;
    });
    return (
      <aside className="property-panel">
        <div className="panel-heading">Profil szkicu</div>
        <div className="property-section">
          <Field label="Nazwa" value={profile.name} onChange={(value) => commit((next) => { next.sketches.flatMap((sketch) => sketch.profiles).find((item) => item.id === profile.id).name = value; })} />
          {profile.type === 'rectangle' ? (
            <>
              <Field label="Szerokość" value={profile.geometry.width} suffix="mm" onChange={(value) => updateGeometry('width', value)} />
              <Field label="Głębokość" value={profile.geometry.height} suffix="mm" onChange={(value) => updateGeometry('height', value)} />
            </>
          ) : <Field label="Średnica" value={profile.geometry.diameter} suffix="mm" onChange={(value) => updateGeometry('diameter', value)} />}
          <Field label="Położenie X" value={profile.geometry.x} suffix="mm" onChange={(value) => updateGeometry('x', value)} />
          <Field label="Położenie Y" value={profile.geometry.y} suffix="mm" onChange={(value) => updateGeometry('y', value)} />
        </div>
      </aside>
    );
  }

  if (selectedFeature) {
    const updateFeature = (key, value) => commit((next) => { next.features.find((item) => item.id === selectedFeature.id)[key] = value; });
    const dimension = selectedFeature.type === 'hole'
      ? { label: 'Głębokość', key: 'depth' }
      : selectedFeature.type === 'fillet'
        ? { label: 'Promień', key: 'radius' }
        : selectedFeature.type === 'chamfer'
          ? { label: 'Odległość fazy', key: 'distance' }
          : { label: 'Odległość', key: 'distance' };
    return (
      <aside className="property-panel">
        <div className="panel-heading">Operacja</div>
        <div className="property-section">
          <Field label="Nazwa" value={selectedFeature.name} onChange={(value) => updateFeature('name', value)} />
          <Field
            label={dimension.label}
            value={selectedFeature[dimension.key]}
            suffix="mm"
            onChange={(value) => updateFeature(dimension.key, value)}
          />
          {selectedFeature.type === 'hole' && <Field label="Średnica" value={selectedFeature.diameter} suffix="mm" onChange={(value) => updateFeature('diameter', value)} />}
          {selectedFeature.type === 'extrude' && (
            <label className="property-field">
              <span>Operacja</span>
              <select value={selectedFeature.operation} onChange={(event) => updateFeature('operation', event.target.value)}>
                <option value="new">Nowa bryła</option>
                <option value="join">Połącz</option>
                <option value="cut">Odejmij</option>
                <option value="intersect">Część wspólna</option>
              </select>
            </label>
          )}
          <label className="property-check">
            <input type="checkbox" checked={!selectedFeature.suppressed} onChange={(event) => updateFeature('suppressed', !event.target.checked)} />
            <span>Operacja aktywna</span>
          </label>
        </div>
      </aside>
    );
  }

  if (selectedBody) {
    return (
      <aside className="property-panel">
        <div className="panel-heading">Właściwości bryły</div>
        <div className="property-section body-summary">
          <div className="body-preview" style={{ '--body-color': selectedBody.color }} />
          <h3>{selectedBody.name}</h3>
          <dl>
            <div><dt>Rozmiar X</dt><dd>{bodySize[0].toFixed(2)} mm</dd></div>
            <div><dt>Rozmiar Y</dt><dd>{bodySize[1].toFixed(2)} mm</dd></div>
            <div><dt>Rozmiar Z</dt><dd>{bodySize[2].toFixed(2)} mm</dd></div>
            <div><dt>Siatka</dt><dd>{Math.round(selectedBody.triangles.length / 3)} trójkątów</dd></div>
          </dl>
        </div>
      </aside>
    );
  }

  return (
    <aside className="property-panel">
      <div className="panel-heading">Projekt</div>
      <div className="property-section">
        <Field label="Nazwa projektu" value={document.name} onChange={(value) => commit((next) => { next.name = value; })} />
        <Field label="Jednostki" value="Milimetry" disabled />
        <div className="kernel-card">
          <span className={`kernel-light ${engine.status}`} />
          <div><strong>Silnik geometryczny</strong><small>{engine.status === 'ready' ? 'OpenCascade · gotowy' : engine.status === 'computing' ? 'Przeliczanie modelu…' : engine.status === 'loading' ? 'Uruchamianie…' : 'Wymaga uwagi'}</small></div>
        </div>
        <button className="inline-action" type="button" onClick={() => onSelect({ kind: 'parameter', id: document.parameters[0]?.id })}>Otwórz parametry</button>
      </div>
    </aside>
  );
}

function PrintInspector({ document, bodies, commit, engine, onExport }) {
  const bounds = useMemo(() => {
    if (!bodies.length) return [0, 0, 0];
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    bodies.forEach((body) => body.bounds.forEach((point, pointIndex) => point.forEach((value, axis) => {
      if (pointIndex === 0) min[axis] = Math.min(min[axis], value);
      else max[axis] = Math.max(max[axis], value);
    })));
    return max.map((value, axis) => value - min[axis]);
  }, [bodies]);
  const fits = bounds[0] <= document.print.bedWidth && bounds[1] <= document.print.bedDepth && bounds[2] <= document.print.bedHeight;
  const updatePrint = (key, value) => commit((next) => { next.print[key] = Math.max(1, Number(value) || 1); });
  return (
    <aside className="property-panel print-inspector">
      <div className="panel-heading">Przygotowanie druku</div>
      <div className="property-section">
        <h3>Obszar roboczy drukarki</h3>
        <Field type="number" label="Szerokość X" value={document.print.bedWidth} suffix="mm" onChange={(value) => updatePrint('bedWidth', value)} />
        <Field type="number" label="Głębokość Y" value={document.print.bedDepth} suffix="mm" onChange={(value) => updatePrint('bedDepth', value)} />
        <Field type="number" label="Wysokość Z" value={document.print.bedHeight} suffix="mm" onChange={(value) => updatePrint('bedHeight', value)} />
      </div>
      <div className="property-section print-check">
        <h3>Kontrola modelu</h3>
        <dl>
          <div><dt>Bryły</dt><dd>{bodies.length}</dd></div>
          <div><dt>Rozmiar</dt><dd>{bounds.map((value) => value.toFixed(1)).join(' × ')} mm</dd></div>
        </dl>
        <p className={fits && bodies.length ? 'check-ok' : 'check-warning'}>{!bodies.length ? 'Brak bryły do wydruku.' : fits ? 'Model mieści się na stole drukarki.' : 'Model przekracza obszar drukarki.'}</p>
      </div>
      <div className="export-stack">
        <button type="button" disabled={!bodies.length || engine.status !== 'ready'} onClick={() => onExport('stl')}>Eksportuj STL do druku</button>
        <button type="button" className="secondary" disabled={!bodies.length || engine.status !== 'ready'} onClick={() => onExport('step')}>Eksportuj STEP</button>
      </div>
    </aside>
  );
}

export default function ModelingWorkspace({ onClose }) {
  const history = useDocumentHistory(createStarterDocument());
  const { document, commit } = history;
  const engine = useCadEngine(document);
  const [workspace, setWorkspace] = useState('model');
  const [selection, setSelection] = useState({ kind: 'document', id: document.id });
  const [notice, setNotice] = useState('Projekt jest przeliczany przez dokładny silnik CAD.');
  const fileInputRef = useRef(null);

  const selectBody = (id) => setSelection(id ? { kind: 'body', id } : { kind: 'document', id: document.id });
  const selectedProfile = document.sketches.flatMap((sketch) => sketch.profiles).find((profile) => selection?.kind === 'profile' && profile.id === selection.id);
  const firstBodyId = engine.bodies[0]?.id;

  useEffect(() => {
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (!verifyMode) return undefined;
    window.__madcadVerifyExport = engine.exportModel;
    return () => { delete window.__madcadVerifyExport; };
  }, [engine.exportModel]);

  const addProfile = (type) => {
    let profile;
    commit((next) => {
      if (!next.sketches.length) next.sketches.push(createSketch({ name: 'Szkic XY', plane: 'XY' }));
      profile = type === 'circle'
        ? createCircleProfile({ name: `Okrąg ${next.sketches[0].profiles.length + 1}`, diameter: 10, x: 0, y: 0 })
        : createRectangleProfile({ name: `Prostokąt ${next.sketches[0].profiles.length + 1}`, width: 30, height: 20, x: 0, y: 0 });
      next.sketches[0].profiles.push(profile);
    });
    setSelection({ kind: 'profile', id: profile.id });
    setWorkspace('sketch');
    setNotice('Dodano profil. Ustaw wymiary po prawej stronie.');
  };

  const addExtrude = () => {
    if (!selectedProfile) {
      setNotice('Najpierw wybierz profil w drzewie projektu.');
      return;
    }
    let feature;
    commit((next) => {
      const target = engine.bodies[0]?.id;
      feature = createFeature('extrude', {
        name: `Wyciągnięcie ${next.features.length + 1}`,
        profileIds: [selectedProfile.id],
        distance: 10,
        operation: target ? 'join' : 'new',
        targetBodyId: target,
      });
      next.features.push(feature);
    });
    setSelection({ kind: 'feature', id: feature.id });
    setWorkspace('solid');
    setNotice('Dodano wyciągnięcie. Zmień odległość i typ operacji w panelu właściwości.');
  };

  const addHole = () => {
    if (!selectedProfile || selectedProfile.type !== 'circle' || !firstBodyId) {
      setNotice('Wybierz profil okręgu i upewnij się, że projekt zawiera bryłę.');
      return;
    }
    let feature;
    commit((next) => {
      feature = createFeature('hole', {
        name: `Otwór ${next.features.length + 1}`,
        targetBodyId: firstBodyId,
        profileId: selectedProfile.id,
        diameter: selectedProfile.geometry.diameter,
        depth: 10,
      });
      next.features.push(feature);
    });
    setSelection({ kind: 'feature', id: feature.id });
    setWorkspace('solid');
    setNotice('Dodano otwór. Średnicę i głębokość możesz powiązać z parametrami.');
  };

  const addEdgeFeature = (type) => {
    const targetBodyId = selection?.kind === 'body' ? selection.id : firstBodyId;
    if (!targetBodyId) {
      setNotice('Najpierw utwórz lub wybierz bryłę.');
      return;
    }
    let feature;
    commit((next) => {
      feature = createFeature(type, {
        name: `${type === 'fillet' ? 'Zaokrąglenie' : 'Fazowanie'} ${next.features.length + 1}`,
        targetBodyId,
        ...(type === 'fillet' ? { radius: 1 } : { distance: 1 }),
      });
      next.features.push(feature);
    });
    setSelection({ kind: 'feature', id: feature.id });
    setWorkspace('solid');
    setNotice(type === 'fillet' ? 'Dodano zaokrąglenie wszystkich krawędzi bryły.' : 'Dodano fazowanie wszystkich krawędzi bryły.');
  };

  const addParameter = () => {
    let parameter;
    commit((next) => {
      let number = next.parameters.length + 1;
      while (next.parameters.some((item) => item.name === `parametr${number}`)) number += 1;
      parameter = createParameter(`parametr${number}`, 10, 'mm', `Parametr ${number}`);
      next.parameters.push(parameter);
    });
    setSelection({ kind: 'parameter', id: parameter.id });
    setNotice('Dodano parametr użytkownika.');
  };

  const saveProject = async () => {
    const payload = JSON.stringify(document, null, 2);
    if (window.desktopApp?.saveTextFile) {
      const result = await window.desktopApp.saveTextFile({
        defaultName: `${safeName(document.name)}.madcad`,
        text: payload,
        filters: [{ name: 'Projekt MadCAD', extensions: ['madcad'] }, { name: 'JSON', extensions: ['json'] }],
      });
      setNotice(result?.ok ? `Zapisano projekt: ${result.filePath}` : result?.canceled ? 'Anulowano zapis.' : `Nie udało się zapisać: ${result?.error || 'nieznany błąd'}`);
    } else {
      downloadBlob(new Blob([payload], { type: 'application/json' }), `${safeName(document.name)}.madcad`);
      setNotice('Zapisano projekt MadCAD.');
    }
  };

  const openProject = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const loaded = JSON.parse(await file.text());
      const validation = validateDocument(loaded);
      if (!validation.valid) throw new Error(validation.errors.join(' '));
      history.replace(loaded);
      setSelection({ kind: 'document', id: loaded.id });
      setNotice(`Otwarto projekt ${loaded.name}.`);
    } catch (error) {
      setNotice(`Nie udało się otworzyć projektu: ${error.message}`);
    }
  };

  const exportModel = async (format) => {
    setNotice(`Przygotowywanie pliku ${format.toUpperCase()}…`);
    try {
      const buffers = await engine.exportModel(format);
      buffers.forEach((buffer, index) => {
        const suffix = buffers.length > 1 ? `-${index + 1}` : '';
        downloadBlob(
          new Blob([buffer], { type: format === 'stl' ? 'model/stl' : 'model/step' }),
          `${safeName(document.name)}${suffix}.${format === 'step' ? 'step' : 'stl'}`,
        );
      });
      setNotice(`Wyeksportowano ${format.toUpperCase()} z dokładnej bryły B-Rep.`);
    } catch (error) {
      setNotice(`Eksport nie powiódł się: ${error.message}`);
    }
  };

  const timelineStatus = new Map(engine.timeline?.map((item) => [item.id, item]));

  return (
    <section className="modeling-shell" aria-label="Modelowanie parametryczne MadCAD">
      <header className="modeling-titlebar">
        <div className="brand-mark">M</div>
        <div className="document-title"><strong>MadCAD</strong><span>/</span><input value={document.name} aria-label="Nazwa projektu" onChange={(event) => commit((next) => { next.name = event.target.value; })} /></div>
        <div className="title-actions">
          <button type="button" onClick={() => { history.replace(createStarterDocument()); setSelection({ kind: 'document' }); setNotice('Utworzono nowy projekt przykładowy.'); }}>Nowy</button>
          <button type="button" onClick={() => fileInputRef.current?.click()}><FolderOpen size={14} /> Otwórz</button>
          <input ref={fileInputRef} hidden type="file" accept=".madcad,.json,application/json" onChange={openProject} />
          <button type="button" onClick={saveProject}><Save size={14} /> Zapisz</button>
          <span className="title-divider" />
          <button type="button" disabled={!history.canUndo} onClick={history.undo} title="Cofnij"><Undo2 size={15} /></button>
          <button type="button" disabled={!history.canRedo} onClick={history.redo} title="Ponów"><Redo2 size={15} /></button>
          <button className="return-button" type="button" onClick={onClose}><PanelLeftClose size={14} /> Rysunek 2D</button>
        </div>
      </header>

      <nav className="workspace-tabs" aria-label="Obszary robocze">
        {WORKSPACES.map((item) => <button key={item.id} className={workspace === item.id ? 'active' : ''} type="button" onClick={() => setWorkspace(item.id)}>{item.label}</button>)}
      </nav>

      <div className="modeling-ribbon">
        <div className="ribbon-group">
          <WorkspaceButton icon={Square} label="Prostokąt" detail="profil" onClick={() => addProfile('rectangle')} />
          <WorkspaceButton icon={Circle} label="Okrąg" detail="profil" onClick={() => addProfile('circle')} />
          <WorkspaceButton icon={Variable} label="Parametr" detail="użytkownika" onClick={addParameter} />
        </div>
        <div className="ribbon-group">
          <WorkspaceButton icon={Box} label="Wyciągnij" detail="profil → bryła" onClick={addExtrude} disabled={!selectedProfile} />
          <WorkspaceButton icon={Cylinder} label="Otwór" detail="wytnij walec" onClick={addHole} disabled={selectedProfile?.type !== 'circle' || !firstBodyId} />
          <WorkspaceButton icon={CircleDotDashed} label="Zaokrąglij" detail="krawędzie bryły" onClick={() => addEdgeFeature('fillet')} disabled={!firstBodyId} />
          <WorkspaceButton icon={Triangle} label="Fazuj" detail="krawędzie bryły" onClick={() => addEdgeFeature('chamfer')} disabled={!firstBodyId} />
        </div>
        <div className="ribbon-group ribbon-export">
          <WorkspaceButton iconText="STL" label="Eksport STL" detail="druk 3D" onClick={() => exportModel('stl')} disabled={!engine.bodies.length || engine.status !== 'ready'} />
          <WorkspaceButton iconText="STEP" label="Eksport STEP" detail="wymiana CAD" onClick={() => exportModel('step')} disabled={!engine.bodies.length || engine.status !== 'ready'} />
        </div>
      </div>

      <div className="modeling-content">
        <ProjectTree document={document} bodies={engine.bodies} selection={selection} onSelect={setSelection} />
        <main className="modeling-stage">
          <ModelViewport
            bodies={engine.bodies}
            selectedBodyId={selection?.kind === 'body' ? selection.id : null}
            onSelectBody={selectBody}
            bed={document.print}
            showBed={workspace === 'print'}
          />
          <div className={`engine-status ${engine.status}`}>
            <span />{engine.status === 'ready' ? `Model gotowy · ${engine.bodies.length} brył` : engine.status === 'computing' ? 'Przeliczanie historii…' : engine.status === 'loading' ? 'Uruchamianie silnika OpenCascade…' : engine.error}
          </div>
        </main>
        {workspace === 'print'
          ? <PrintInspector document={document} bodies={engine.bodies} commit={commit} engine={engine} onExport={exportModel} />
          : <Inspector document={document} selection={selection} bodies={engine.bodies} engine={engine} commit={commit} onSelect={setSelection} />}
      </div>

      <footer className="modeling-footer">
        <div className="notice" role="status">{engine.error || notice}</div>
        <div className="timeline" aria-label="Historia operacji">
          <span className="timeline-label">Historia</span>
          {document.features.map((feature, index) => {
            const result = timelineStatus.get(feature.id);
            return (
              <button
                key={feature.id}
                className={`timeline-item ${selection?.kind === 'feature' && selection.id === feature.id ? 'selected' : ''} ${result?.status || ''}`}
                type="button"
                onClick={() => setSelection({ kind: 'feature', id: feature.id })}
                title={result?.error || feature.name}
              >
                <span>{feature.type === 'hole' ? <Cylinder size={16} /> : feature.type === 'fillet' ? <CircleDotDashed size={16} /> : feature.type === 'chamfer' ? <Triangle size={16} /> : <Box size={16} />}</span><strong>{index + 1}</strong><em>{feature.name}</em>
              </button>
            );
          })}
          <span className="timeline-end" />
        </div>
      </footer>
    </section>
  );
}
