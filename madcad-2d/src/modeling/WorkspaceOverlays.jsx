import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  Box,
  Boxes,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDotDashed,
  Eye,
  EyeOff,
  FileBox,
  FolderOpen,
  Frame,
  Layers3,
  Link2,
  Minus,
  PanelLeftClose,
  PencilRuler,
  Settings2,
  Square,
  X,
} from 'lucide-react';
import madcadIconUrl from '../../assets/icons/madcad-512.png';
import { componentInstanceTree } from '../cad-core/components.js';
import { formatShortcut } from './platform-shortcuts.js';

const PLANE_LABELS = { XY: 'Góra (XY)', XZ: 'Przód (XZ)', YZ: 'Prawo (YZ)' };

export function CrashRecoveryBanner({ info, onSave, onDismiss }) {
  if (!info) return null;
  const parsedTime = Date.parse(info.updatedAt || '');
  const savedAt = Number.isFinite(parsedTime)
    ? new Date(parsedTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
    : null;
  return (
    <section className="crash-recovery-banner" role="alert" aria-label="Odzyskiwanie projektu po awarii">
      <div>
        <strong>Odzyskano projekt po nieoczekiwanym zamknięciu MadCAD</strong>
        <span>{info.backup ? 'Użyto poprzedniej poprawnej kopii autozapisu' : 'Użyto ostatniego poprawnego autozapisu'}{savedAt ? ` · ${savedAt}` : ''}.</span>
      </div>
      <button type="button" onClick={onSave}>Zapisz odzyskany projekt</button>
      <button className="icon-only" type="button" aria-label="Zamknij komunikat odzyskiwania" title="Zamknij komunikat" onClick={onDismiss}><X size={15} /></button>
    </section>
  );
}

export function ProjectBrowser({ document, bodies, selection, activeSketchId, onSelect, onToggleReference, onClose }) {
  const [expanded, setExpanded] = useState({ origin: true, construction: true, components: true, joints: true, sketches: true, bodies: true });
  const toggle = (key) => setExpanded((current) => ({ ...current, [key]: !current[key] }));
  const constructionReferences = document.references.filter((reference) => ['construction-plane', 'construction-axis', 'construction-point'].includes(reference.kind));
  const componentRoots = componentInstanceTree(document);
  const renderComponent = (instance, depth = 0) => (
    <React.Fragment key={instance.id}>
      <button
        className={`tree-row tree-component ${selection?.kind === 'componentInstance' && selection.id === instance.id ? 'selected' : ''}`}
        style={{ '--component-depth': depth }}
        type="button"
        aria-label={`Zaznacz wystąpienie ${instance.component?.type === 'assembly' ? 'złożenia' : 'części'} ${instance.name}.`}
        title={`${instance.grounded ? 'Ground · ' : ''}${instance.component?.partNumber || ''} · ${instance.visible ? 'widoczne' : 'ukryte'}`}
        onClick={() => onSelect({ kind: 'componentInstance', id: instance.id, componentId: instance.componentId })}
      >
        <span />{instance.grounded ? <Anchor size={13} /> : instance.component?.type === 'assembly' ? <Boxes size={13} /> : <Box size={13} />}<span>{instance.name}</span><small>{instance.component?.partNumber}</small>
      </button>
      {(instance.children || []).map((child) => renderComponent(child, depth + 1))}
    </React.Fragment>
  );
  return (
    <aside className="model-browser" aria-label="Przeglądarka projektu">
      <div className="browser-heading"><strong>PRZEGLĄDARKA</strong><button type="button" title="Zwiń przeglądarkę" onClick={onClose}><PanelLeftClose size={14} /></button></div>
      <button className={`tree-row tree-root ${selection?.kind === 'document' ? 'selected' : ''}`} type="button" title="Zaznacz cały dokument projektu." onClick={() => onSelect({ kind: 'document', id: document.id })}>
        <ChevronDown size={13} /><FileBox size={14} /><strong>{document.name || 'Bez nazwy'}</strong>
      </button>
      <button className="tree-row tree-child" type="button" title="Otwórz nazwane parametry sterujące wymiarami modelu." onClick={() => onSelect({ kind: 'settings', id: document.id })}>
        <span /><Settings2 size={14} /><span>Parametry modelu</span><small>mm</small>
      </button>

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj płaszczyzny początku układu." onClick={() => toggle('origin')}>
        {expanded.origin ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Layers3 size={14} /><span>Początek</span>
      </button>
      {expanded.origin && (
        <div className="tree-nested">
          {Object.entries(PLANE_LABELS).map(([plane, label]) => (
            <button key={plane} className="tree-row tree-grandchild" type="button" title={`Zaznacz płaszczyznę ${plane} jako bazę szkicu.`} onClick={() => onSelect({ kind: 'plane', id: plane })}>
              <span /><Frame size={13} /><span>{label}</span>
            </button>
          ))}
        </div>
      )}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj geometrię konstrukcyjną." onClick={() => toggle('construction')}>
        {expanded.construction ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Frame size={14} /><span>Konstrukcja</span><small>{constructionReferences.length}</small>
      </button>
      {expanded.construction && constructionReferences.map((reference) => (
        <div className="tree-reference-row" key={reference.id}>
          <button className={`tree-row tree-grandchild ${selection?.kind === (reference.kind === 'construction-axis' ? 'constructionAxis' : reference.kind === 'construction-point' ? 'constructionPoint' : 'constructionPlane') && selection.id === reference.id ? 'selected' : ''}`} type="button" title={`Zaznacz ${reference.name}.`} onClick={() => onSelect({ kind: reference.kind === 'construction-axis' ? 'constructionAxis' : reference.kind === 'construction-point' ? 'constructionPoint' : 'constructionPlane', id: reference.id })}>
            <span />{reference.kind === 'construction-axis' ? <Minus size={13} /> : reference.kind === 'construction-point' ? <CircleDotDashed size={13} /> : <Frame size={13} />}<span>{reference.name}</span><small>{reference.kind === 'construction-axis' ? 'OŚ' : reference.kind === 'construction-point' ? 'PKT' : (reference.basePlane || '3P')}</small>
          </button>
          <button className="tree-reference-visibility" type="button" title={reference.visible ? `Ukryj ${reference.name}` : `Pokaż ${reference.name}`} onClick={() => onToggleReference(reference.id)}>{reference.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
        </div>
      ))}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj strukturę części i złożeń." onClick={() => toggle('components')}>
        {expanded.components ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Boxes size={14} /><span>Złożenie</span><small>{document.componentInstances?.length || 0}</small>
      </button>
      {expanded.components && (componentRoots.length
        ? componentRoots.map((component) => renderComponent(component))
        : <div className="tree-empty">Brak komponentów</div>)}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj jointy złożenia." onClick={() => toggle('joints')}>
        {expanded.joints ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Link2 size={14} /><span>Jointy</span><small>{document.joints?.length || 0}</small>
      </button>
      {expanded.joints && (document.joints?.length
        ? document.joints.map((joint) => <button className={`tree-row tree-joint ${selection?.kind === 'joint' && selection.id === joint.id ? 'selected' : ''}`} type="button" key={joint.id} title={`${joint.type} · oś ${joint.axis.toUpperCase()} · ${joint.value}`} onClick={() => onSelect({ kind: 'joint', id: joint.id, movingInstanceId: joint.movingInstanceId })}><span /><Link2 size={13} /><span>{joint.name}</span><small>{joint.type === 'rigid' ? 'LOCK' : joint.value}</small></button>)
        : <div className="tree-empty">Brak jointów</div>)}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj szkice i ich profile." onClick={() => toggle('sketches')}>
        {expanded.sketches ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Szkice</span><small>{document.sketches.length}</small>
      </button>
      {expanded.sketches && document.sketches.map((sketch) => (
        <React.Fragment key={sketch.id}>
          <button
            className={`tree-row tree-grandchild ${selection?.kind === 'sketch' && selection.id === sketch.id ? 'selected' : ''} ${activeSketchId === sketch.id ? 'editing' : ''}`}
            type="button"
            title={`Zaznacz ${sketch.name}; użyj Edytuj, aby wrócić do szkicu.`}
            onClick={() => onSelect({ kind: 'sketch', id: sketch.id })}
          >
            <span /><PencilRuler size={13} /><span>{sketch.name}</span><small>{sketch.plane}</small>
          </button>
          {sketch.profiles.map((profile) => (
            <button
              className={`tree-row tree-profile ${selection?.kind === 'profile' && selection.id === profile.id ? 'selected' : ''}`}
              key={profile.id}
              type="button"
              title={`Zaznacz ${profile.name}; przeciągnij strzałkę lub użyj Wyciągnij.`}
              onClick={() => onSelect({ kind: 'profile', id: profile.id, sketchId: sketch.id })}
            >
              <span />{profile.type === 'circle' ? <Circle size={12} /> : <Square size={12} />}<span>{profile.name}</span>
            </button>
          ))}
        </React.Fragment>
      ))}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj utworzone bryły." onClick={() => toggle('bodies')}>
        {expanded.bodies ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Bryły</span><small>{bodies.length}</small>
      </button>
      {expanded.bodies && bodies.map((body) => (
        <button
          className={`tree-row tree-grandchild ${selection?.kind === 'body' && selection.id === body.id ? 'selected' : ''}`}
          key={body.id}
          type="button"
          title={body.representation === 'mesh-import'
            ? `${body.name}: ${body.meshBooleanCapable === false ? 'otwarta siatka do pomiaru, transformacji i eksportu' : 'zamknięta siatka 3D'}.`
            : `Zaznacz dokładną bryłę B-Rep ${body.name} do dalszych operacji.`}
          onClick={() => onSelect({ kind: 'body', id: body.id })}
        >
          <span /><Box size={13} /><span>{body.name}</span><span className="body-kind"><small>{body.representation === 'mesh-import' ? (body.meshBooleanCapable === false ? 'SIATKA OTW.' : 'SIATKA') : 'B-REP'}</small><i className="body-color" style={{ background: body.color }} /></span>
        </button>
      ))}
    </aside>
  );
}

export function StartPage({ onStartSketch, onOpenProject, commandCustomization = null }) {
  const shortcut = (label, fallback) => commandCustomization?.commands?.[label]?.shortcut || commandCustomization?.commands?.[label]?.alias || fallback;
  return (
    <section className="empty-canvas start-page" aria-labelledby="start-page-title">
      <div className="start-page-shell">
        <div className="start-page-intro">
          <div className="start-page-brand">
            <img src={madcadIconUrl} alt="MadCAD" />
            <span>MadCAD · CAD 2D/3D</span>
          </div>
          <h1 id="start-page-title">Rysuj 2D. Modeluj parametrycznie w 3D.</h1>
          <p>Zacznij od precyzyjnego szkicu jak w klasycznym CAD. Narzędzia bryłowe rozwijają projekt, a druk 3D pozostaje opcjonalnym etapem eksportu.</p>
          <div className="start-page-actions">
            <button className="start-page-action primary" type="button" onClick={onStartSketch}>
              <PencilRuler size={22} />
              <span><strong>Nowy rysunek 2D</strong><small>Wybierz płaszczyznę, rysuj myszą i wpisuj dokładne wymiary.</small></span>
              <ArrowRight size={18} />
            </button>
            <button className="start-page-action" type="button" onClick={onOpenProject}>
              <FolderOpen size={22} />
              <span><strong>Otwórz istniejący projekt</strong><small>Wczytaj plik .madcad i kontynuuj historię modelu.</small></span>
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="start-page-shortcuts" role="group" aria-label="Szybki start">
            <strong>Szybki start</strong>
            <span><kbd>{shortcut('Linia', 'L')}</kbd> Linia</span>
            <span><kbd>{shortcut('Prostokąt', 'R')}</kbd> Prostokąt</span>
            <span><kbd>{shortcut('Okrąg', 'C')}</kbd> Okrąg</span>
          </div>
        </div>

        <aside className="start-page-flow" aria-label="Przepływ pracy">
          <strong>Przepływ pracy</strong>
          <ol>
            <li><span>1</span><div><PencilRuler size={18} /><strong>Szkic 2D</strong><small>Linie, łuki, snap, trim, offset, więzy i wymiary.</small></div></li>
            <li><span>2</span><div><Layers3 size={18} /><strong>Model parametryczny</strong><small>Wyciągnięcia, operacje bryłowe i edytowalna historia.</small></div></li>
            <li><span>3</span><div><FileBox size={18} /><strong>Eksport</strong><small>STEP do wymiany CAD; STL, 3MF i kontrola druku jako dodatki.</small></div></li>
          </ol>
        </aside>
      </div>
    </section>
  );
}

export function TopologyReferenceRepairPanel({ items, selection, onReassign, onPreview }) {
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    const collapseForCompactViewport = () => {
      if (window.innerWidth <= 1200) setExpanded(false);
    };
    collapseForCompactViewport();
    window.addEventListener('resize', collapseForCompactViewport);
    return () => window.removeEventListener('resize', collapseForCompactViewport);
  }, []);
  useEffect(() => {
    setActiveIndex((current) => Math.max(0, Math.min(current, items.length - 1)));
  }, [items.length]);
  if (!items.length) return null;
  const selectedItem = selection?.items?.at(-1) || selection;
  const item = items[activeIndex] || items[0];
  const canUseSelection = selectedItem && selectedItem.kind === item.reference.topologyKind && selectedItem.id;
  const topologyKindLabel = { face: 'ściana', edge: 'krawędź', vertex: 'wierzchołek' }[item.reference.topologyKind] || item.reference.topologyKind;
  const highConfidenceRepairs = items.map((entry) => ({ entry, candidate: entry.candidates.find((candidate) => candidate.confidence === 'high') })).filter(({ candidate }) => candidate);
  const formatDifference = (value, suffix, fallback = 'brak danych') => Number.isFinite(value) ? `${value.toFixed(value >= 10 ? 1 : 2)}${suffix}` : fallback;
  const confidenceLabel = { high: 'wysoka', medium: 'średnia', low: 'niska' };
  const autoRepair = () => highConfidenceRepairs.forEach(({ entry, candidate }) => onReassign(entry.reference.id, candidate, candidate.descriptor));
  return (
    <aside className={`reference-repair-panel ${expanded ? '' : 'collapsed'}`} role="region" aria-live="polite" aria-label="Kreator naprawy utraconych referencji">
      <header><AlertTriangle size={16} /><div><strong>Kreator naprawy referencji</strong><span>{items.length === 1 ? '1 element wymaga przypisania' : `${items.length} elementy wymagają przypisania`}</span></div><button className="reference-repair-toggle" type="button" aria-expanded={expanded} title={expanded ? 'Zwiń kreator naprawy' : 'Rozwiń kreator naprawy'} aria-label={expanded ? 'Zwiń kreator naprawy' : 'Rozwiń kreator naprawy'} onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></header>
      {expanded && <>
        <div className="reference-repair-progress"><span>Krok {activeIndex + 1} z {items.length}</span><progress max={items.length} value={activeIndex + 1} /></div>
        <section key={item.reference.id}>
          <div className="reference-repair-summary">
            <strong>{item.ownerFeature?.name || item.reference.label || 'Operacja zależna'}</strong>
            <span>Źródło: {item.sourceFeature?.name || item.reference.sourceFeatureId || 'nieznane'}</span>
            <small>{item.reason}</small>
            <small>Oczekiwany typ: <b>{topologyKindLabel}</b> · poprzednie ID: <code>{item.reference.topologyId}</code></small>
          </div>
          <div className="reference-repair-selection">
            <span>Wskaż {topologyKindLabel} w modelu albo wybierz dopasowanie poniżej.</span>
            <button type="button" disabled={!canUseSelection} onClick={() => onReassign(item.reference.id, selectedItem)}>Przypisz zaznaczenie</button>
          </div>
          <div className="reference-candidates" aria-label="Sugerowane dopasowania">
            {item.candidates.slice(0, 3).map((candidate, index) => (
              <article className={`reference-candidate confidence-${candidate.confidence}`} key={`${candidate.bodyId}:${candidate.id}`}>
                <div><strong>{confidenceLabel[candidate.confidence]} · {candidate.score}%</strong><span>{candidate.id}</span></div>
                <small>Odległość {formatDifference(candidate.distance, ' mm')} · rozmiar {formatDifference(candidate.sizeDifference, '%')} · orientacja {formatDifference(candidate.orientationDifference, '°')}</small>
                <div className="reference-candidate-actions">
                  <button className="secondary" type="button" onClick={() => onPreview(candidate)}>Pokaż</button>
                  <button type="button" data-reference-action={`candidate-${index + 1}`} onClick={() => onReassign(item.reference.id, candidate, candidate.descriptor)}>{`Kandydat ${index + 1}`}</button>
                </div>
              </article>
            ))}
            {!item.candidates.length && <p>Brak automatycznych kandydatów. Zaznacz zgodny element bezpośrednio w modelu.</p>}
          </div>
        </section>
        <footer>
          <button className="secondary" type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}>Wstecz</button>
          <button className="secondary" type="button" disabled={activeIndex >= items.length - 1} onClick={() => setActiveIndex((index) => Math.min(items.length - 1, index + 1))}>Dalej</button>
          <button type="button" data-reference-action="repair-certain" disabled={!highConfidenceRepairs.length} onClick={autoRepair}>Napraw pewne ({highConfidenceRepairs.length})</button>
          <small>Każdą naprawę można cofnąć przez {formatShortcut('CTRL+Z', window.desktopApp?.platform)}.</small>
        </footer>
      </>}
    </aside>
  );
}
