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
  CheckCircle2,
  CornerDownLeft,
  Download,
  Eye,
  EyeOff,
  FileBox,
  FolderOpen,
  Frame,
  GitCompareArrows,
  History,
  Layers3,
  Link2,
  Magnet,
  Minus,
  Network,
  PanelLeftClose,
  PencilRuler,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import madcadIconUrl from '../../assets/icons/madcad-512.png';
import { componentInstanceTree } from '../cad-core/components.js';
import { searchProjectIndex } from '../cad-core/project-search.js';
import { translateModelingText } from './i18n.js';
import { formatShortcut } from './platform-shortcuts.js';

const PLANE_LABELS = { XY: 'Góra (XY)', XZ: 'Przód (XZ)', YZ: 'Prawo (YZ)' };

export function CrashRecoveryBanner({ info, onSave, onOpenSnapshots, onDismiss }) {
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
      {onOpenSnapshots && <button type="button" onClick={onOpenSnapshots}>Otwórz punkty zapisu</button>}
      <button className="icon-only" type="button" aria-label="Zamknij komunikat odzyskiwania" title="Zamknij komunikat" onClick={onDismiss}><X size={15} /></button>
    </section>
  );
}

export function ProjectDashboard({ document, bodyCount, health, snapshotCount, onOpenParameters, onOpenSnapshots, onOpenComparison, onOpenHealth, onOpenDependencies, onOpenComponents, onCreatePart, onCreateAssembly, onOpenNamedViews, readOnly = false, onBack }) {
  const counts = health?.counts || {};
  const healthLabel = health?.status === 'critical' ? 'Wymaga działania' : health?.status === 'warning' ? 'Wymaga uwagi' : 'Projekt zdrowy';
  const issueCount = (counts.critical || 0) + (counts.warning || 0);
  const actionGroups = [
    ['PARAMETRY I WERSJE', [
      ['projectParametersBtn', Settings2, 'Parametry', `${document.parameters.length} zdefiniowanych`, onOpenParameters, readOnly],
      ['projectSnapshotsBtn', History, 'Punkty zapisu', `${snapshotCount} lokalnych wersji`, onOpenSnapshots],
      ['projectComparisonBtn', GitCompareArrows, 'Porównaj wersje', 'Sprawdź różnice bez zmiany projektu', onOpenComparison],
    ]],
    ['KONTROLA', [
      ['projectHealthBtn', ShieldCheck, 'Kondycja projektu', issueCount ? `${issueCount} elementów do sprawdzenia` : 'Brak wykrytych problemów', onOpenHealth],
      ['projectDependenciesBtn', Network, 'Gdzie używane', 'Referencje i zależności obiektów', onOpenDependencies],
      ['projectNamedViewsBtn', Eye, 'Zapisane widoki', 'Pozycje kamery zapisane w projekcie', onOpenNamedViews],
    ]],
    ['STRUKTURA', [
      ['projectComponentsBtn', Boxes, 'Komponenty', `${document.components.length} komponentów`, onOpenComponents],
      ['projectCreatePartBtn', Box, 'Nowa część', 'Dodaj część do bieżącego dokumentu', onCreatePart, readOnly],
      ['projectCreateAssemblyBtn', Boxes, 'Nowe złożenie', 'Dodaj złożenie i uporządkuj części', onCreateAssembly, readOnly],
    ]],
  ];
  return (
    <section className="project-dashboard" aria-label="Pulpit zarządzania projektem">
      <header className="workspace-guidebar project-dashboard-guide">
        <div><strong>ZARZĄDZAJ · projekt i jego historia</strong><small>Najważniejsze informacje, wersje i zależności są widoczne bez przełączania się na pusty model 3D.</small></div>
        <button type="button" onClick={onBack}>Wróć do projektowania <ArrowRight size={14} /></button>
      </header>
      <div className="project-dashboard-summary">
        <article className={`project-dashboard-health ${health?.status || 'healthy'}`}>
          <ShieldCheck size={24} />
          <div><span>Kondycja</span><strong>{healthLabel}</strong><small>{issueCount ? `${issueCount} ostrzeżeń lub błędów` : 'Historia i referencje są spójne'}</small></div>
          <button type="button" onClick={onOpenHealth}>Otwórz raport</button>
        </article>
        <article><Layers3 size={23} /><div><span>Model</span><strong>{bodyCount} brył · {document.features.length} operacji</strong><small>{document.sketches.length} szkiców w projekcie</small></div></article>
        <article><FileBox size={23} /><div><span>Dokumentacja</span><strong>{document.drawings.length} arkuszy</strong><small>{document.drawings.reduce((total, sheet) => total + (sheet.views?.length || 0), 0)} widoków technicznych</small></div></article>
      </div>
      <div className="project-dashboard-action-groups">
        {actionGroups.map(([groupLabel, actions]) => <section key={groupLabel} aria-label={groupLabel}>
          <h2>{groupLabel}</h2>
          <nav className="project-dashboard-actions" aria-label={groupLabel}>
            {actions.map(([id, Icon, title, description, action, disabled]) => <button id={id} key={title} type="button" disabled={disabled} onClick={action}><Icon size={22} /><span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={15} /></button>)}
          </nav>
        </section>)}
      </div>
    </section>
  );
}

export function ProjectSnapshotsPanel({ snapshots, loading, error, readOnly = false, onCreate, onRestore, onDelete, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await onCreate({ name: name.trim(), description: description.trim() });
      if (created) {
        setName('');
        setDescription('');
      }
    } finally {
      setSubmitting(false);
    }
  };
  const formatTime = (value) => {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'brak daty';
  };
  return (
    <aside className="project-snapshots-panel" role="dialog" aria-modal="false" aria-label="Punkty zapisu projektu">
      <header><div><History size={16} /><span><strong>PUNKTY ZAPISU</strong><small>Lokalne wersje projektu · maks. 20</small></span></div><button type="button" aria-label="Zamknij punkty zapisu" title="Zamknij" onClick={onClose}><X size={15} /></button></header>
      <form onSubmit={submit}>
        <label><span>Nazwa wersji</span><input autoFocus value={name} maxLength={80} placeholder="np. Przed otworami" onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Opis zmian</span><textarea value={description} maxLength={240} rows={2} placeholder="Co jest ważne w tej wersji?" onChange={(event) => setDescription(event.target.value)} /></label>
        <button className="confirm" data-snapshot-action="create" type="submit" disabled={!name.trim() || submitting}>{submitting ? 'Zapisywanie…' : 'Utwórz punkt zapisu'}</button>
      </form>
      {error && <div className="project-snapshots-error" role="alert">{error}</div>}
      <div className="project-snapshots-list" aria-live="polite">
        {loading ? <div className="project-snapshots-empty">Wczytywanie punktów zapisu…</div> : snapshots.length ? snapshots.map((snapshot) => (
          <article className="project-snapshot-item" key={snapshot.id} data-snapshot-id={snapshot.id}>
            <div><strong>{snapshot.name}</strong><time dateTime={snapshot.createdAt}>{formatTime(snapshot.createdAt)}</time></div>
            {snapshot.description && <p>{snapshot.description}</p>}
            <small>{snapshot.documentName} · {snapshot.sketchCount} szk. · {snapshot.featureCount} oper. · {(snapshot.size / (snapshot.size > 1024 * 1024 ? 1024 * 1024 : 1024)).toFixed(snapshot.size > 1024 * 1024 ? 1 : 0)} {snapshot.size > 1024 * 1024 ? 'MB' : 'KB'}</small>
            <footer>
              <button data-snapshot-action="restore" type="button" disabled={readOnly} title={readOnly ? 'Przywracanie jest niedostępne dla projektu tylko do odczytu' : 'Przywróć ten punkt zapisu'} onClick={() => { void onRestore(snapshot.id); }}><History size={13} /> Przywróć</button>
              {deleteConfirmId === snapshot.id ? <><button className="danger" data-snapshot-action="confirm-delete" type="button" onClick={() => { void onDelete(snapshot.id); setDeleteConfirmId(''); }}>Usuń wersję</button><button type="button" onClick={() => setDeleteConfirmId('')}>Anuluj</button></> : <button className="icon-only" data-snapshot-action="delete" type="button" title={`Usuń punkt zapisu ${snapshot.name}`} aria-label={`Usuń punkt zapisu ${snapshot.name}`} onClick={() => setDeleteConfirmId(snapshot.id)}><Trash2 size={13} /></button>}
            </footer>
          </article>
        )) : <div className="project-snapshots-empty"><History size={22} /><strong>Brak punktów zapisu</strong><span>Utwórz nazwaną wersję przed większą zmianą modelu.</span></div>}
      </div>
      <p className="project-snapshots-hint">Przywrócenie nie usuwa bieżącego stanu. Możesz je cofnąć przez Undo.</p>
    </aside>
  );
}

export function ProjectComparisonPanel({ snapshots = [], comparison = null, sourceLabel = '', loading = false, error = '', onCompareSnapshot, onCompareFile, onClose }) {
  const [snapshotId, setSnapshotId] = useState('');
  const [filter, setFilter] = useState('changes');
  useEffect(() => {
    if (!snapshots.some((snapshot) => snapshot.id === snapshotId)) setSnapshotId(snapshots[0]?.id || '');
  }, [snapshots, snapshotId]);
  const states = filter === 'changes' ? new Set(['added', 'removed', 'modified']) : filter === 'all' ? null : new Set([filter]);
  const labels = { added: 'DODANE', removed: 'USUNIĘTE', modified: 'ZMIENIONE', unchanged: 'BEZ ZMIAN' };
  return (
    <aside className="project-comparison-panel" role="dialog" aria-modal="false" aria-label="Porównanie wersji projektu">
      <header><div><GitCompareArrows size={16} /><span><strong>PORÓWNANIE PROJEKTU</strong><small>Bieżący dokument pozostaje bez zmian</small></span></div><button type="button" aria-label="Zamknij porównanie projektu" title="Zamknij" onClick={onClose}><X size={15} /></button></header>
      <section className="project-comparison-source">
        <label><span>Punkt zapisu</span><select aria-label="Punkt zapisu do porównania" value={snapshotId} onChange={(event) => setSnapshotId(event.target.value)}><option value="">Wybierz wersję</option>{snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.name}</option>)}</select></label>
        <button type="button" data-project-compare="snapshot" disabled={!snapshotId || loading} onClick={() => { void onCompareSnapshot(snapshotId); }}><History size={13} /> Porównaj punkt</button>
        <button type="button" data-project-compare="file" disabled={loading} onClick={() => { void onCompareFile(); }}><FolderOpen size={13} /> Wybierz plik</button>
      </section>
      {error && <div className="project-comparison-error" role="alert">{error}</div>}
      {loading ? <div className="project-comparison-empty">Porównywanie wersji…</div> : comparison ? <>
        <section className="project-comparison-summary">
          <div><span>Źródło</span><strong>{sourceLabel || comparison.before.name}</strong></div>
          <div className="added"><span>Dodane</span><strong>{comparison.counts.added}</strong></div>
          <div className="removed"><span>Usunięte</span><strong>{comparison.counts.removed}</strong></div>
          <div className="modified"><span>Zmienione</span><strong>{comparison.counts.modified}</strong></div>
        </section>
        <nav className="project-comparison-filters" aria-label="Filtr zmian projektu">{[['changes', 'Zmiany'], ['added', 'Dodane'], ['removed', 'Usunięte'], ['modified', 'Zmienione'], ['all', 'Wszystko']].map(([id, label]) => <button type="button" className={filter === id ? 'active' : ''} aria-pressed={filter === id} key={id} onClick={() => setFilter(id)}>{label}</button>)}</nav>
        <div className="project-comparison-list" aria-live="polite">
          {comparison.categories.map((category) => {
            const items = category.items.filter((item) => !states || states.has(item.state));
            if (!items.length) return null;
            return <section key={category.id} data-diff-category={category.id}><h3>{category.label}<span>{items.length}</span></h3>{items.map((item) => <article className={item.state} data-diff-state={item.state} key={item.id}><span>{labels[item.state]}</span><div><strong>{item.label}</strong>{item.changedFields.length > 0 && <small>{item.changedFields.join(', ')}</small>}</div></article>)}</section>;
          })}
          {!comparison.categories.some((category) => category.items.some((item) => !states || states.has(item.state))) && <div className="project-comparison-empty"><GitCompareArrows size={22} /><strong>Brak zmian dla wybranego filtra</strong></div>}
        </div>
      </> : <div className="project-comparison-empty"><GitCompareArrows size={24} /><strong>Wybierz wersję do porównania</strong><span>Możesz użyć lokalnego punktu zapisu albo zewnętrznego projektu .madcad.</span></div>}
    </aside>
  );
}

export function ProjectHealthPanel({ report, language = 'pl', onNavigate, onExport, onClose }) {
  const [severity, setSeverity] = useState('all');
  const [category, setCategory] = useState('all');
  const issues = (report?.issues || []).filter((issue) => (severity === 'all' || issue.severity === severity) && (category === 'all' || issue.category === category));
  const severityLabels = { critical: 'KRYTYCZNY', warning: 'OSTRZEŻENIE', info: 'INFORMACJA' };
  const categoryLabels = { document: 'Dokument', history: 'Historia', references: 'Referencje B-Rep', links: 'Linki', engine: 'Silnik CAD', storage: 'Dane' };
  const statusLabel = report?.status === 'critical' ? 'Wymaga działania' : report?.status === 'warning' ? 'Wymaga uwagi' : 'Projekt zdrowy';
  const issueSummary = language === 'en'
    ? `${report?.counts?.critical || 0} critical · ${report?.counts?.warning || 0} warnings · ${report?.counts?.info || 0} information`
    : `${report?.counts?.critical || 0} krytycznych · ${report?.counts?.warning || 0} ostrzeżeń · ${report?.counts?.info || 0} informacji`;
  return (
    <aside className="project-health-panel" role="dialog" aria-modal="false" aria-label="Kondycja projektu">
      <header><div><ShieldCheck size={16} /><span><strong>KONDYCJA PROJEKTU</strong><small>Raport tylko do odczytu</small></span></div><button type="button" aria-label="Zamknij kondycję projektu" title="Zamknij" onClick={onClose}><X size={15} /></button></header>
      <section className={`project-health-score ${report?.status || 'healthy'}`}>
        <div><strong>{report?.score ?? 100}</strong><span>/ 100</span></div>
        <p><strong>{statusLabel}</strong><span>{issueSummary}</span></p>
        <button type="button" data-health-action="export" onClick={onExport}><Download size={13} /> Eksportuj JSON</button>
      </section>
      <section className="project-health-metrics" aria-label="Metryki projektu">
        <div><span>Rozmiar</span><strong>{report?.metrics?.serializedSize || '0 B'}</strong></div>
        <div><span>Operacje</span><strong>{report?.metrics?.featureCount || 0}</strong></div>
        <div><span>Szkice</span><strong>{report?.metrics?.sketchCount || 0}</strong></div>
        <div><span>Bryły</span><strong>{report?.metrics?.bodyCount || 0}</strong></div>
      </section>
      <section className="project-health-checks" aria-label="Kontrole kondycji">
        {(report?.checks || []).map((check) => <div className={check.passed ? 'passed' : 'failed'} key={check.id}><CheckCircle2 size={12} /><span>{check.label}</span></div>)}
      </section>
      <nav className="project-health-filters" aria-label="Filtry raportu kondycji">
        <select aria-label="Priorytet problemu" value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">Wszystkie priorytety</option><option value="critical">Krytyczne</option><option value="warning">Ostrzeżenia</option><option value="info">Informacje</option></select>
        <select aria-label="Kategoria problemu" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Wszystkie kategorie</option>{Object.entries(categoryLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
      </nav>
      <div className="project-health-list" aria-live="polite">
        {issues.length ? issues.map((issue) => (
          <button className={issue.severity} type="button" data-health-issue={issue.code} key={issue.id} onClick={() => onNavigate(issue)}>
            <span>{severityLabels[issue.severity]}</span>
            <div><strong>{translateModelingText(issue.title, language)}</strong><small>{categoryLabels[issue.category] || issue.category}{issue.message ? ` · ${translateModelingText(issue.message, language)}` : ''}</small></div>
            <ArrowRight size={13} />
          </button>
        )) : <div className="project-health-empty"><ShieldCheck size={24} /><strong>{report?.issues?.length ? 'Brak wyników dla wybranego filtra' : 'Nie wykryto problemów'}</strong><span>{report?.issues?.length ? 'Zmień priorytet albo kategorię.' : 'Wszystkie kontrole zakończyły się poprawnie.'}</span></div>}
      </div>
      <p className="project-health-hint">Kliknij problem, aby przejść do powiązanego obiektu. Raport nie zmienia modelu.</p>
    </aside>
  );
}

export function ProjectDependenciesPanel({ inspection, language = 'pl', onSelectNode, onNavigate, onClose }) {
  const [view, setView] = useState('usedBy');
  const [query, setQuery] = useState('');
  const kindLabels = { document: 'Dokument', parameter: 'Parametr', sketch: 'Szkic', profile: 'Profil', 'sketch-entity': 'Geometria szkicu', reference: 'Konstrukcja / referencja', feature: 'Operacja', body: 'Bryła', component: 'Komponent', 'linked-project': 'Projekt linkowany' };
  const relationLabels = { drives: 'steruje', references: 'używa', bounds: 'ogranicza profil', 'bounds-hole': 'ogranicza otwór', supports: 'podpiera szkic', projects: 'rzutuje', modifies: 'modyfikuje', consumes: 'zużywa', produces: 'tworzy', updates: 'aktualizuje', 'owned-by': 'należy do', 'feeds-component': 'zasila komponent', 'provides-proxy': 'dostarcza proxy', 'references-topology': 'używa topologii', 'references-open-chain': 'używa łańcucha', 'sweep-path': 'prowadzi Sweep', 'pipe-path': 'prowadzi Pipe', 'to-object': 'wyznacza zakres', 'revolve-axis': 'wyznacza oś', 'coil-axis': 'wyznacza oś', 'pattern-axis': 'wyznacza oś' };
  const lists = { uses: inspection?.uses || [], usedBy: inspection?.usedBy || [], affected: inspection?.affected || [] };
  const list = lists[view];
  const normalizedQuery = query.trim().toLocaleLowerCase('pl');
  const kindLabel = (kind) => translateModelingText(kindLabels[kind] || kind, language);
  const options = (inspection?.nodes || []).filter((node) => node.id === inspection?.selected?.id || !normalizedQuery || `${node.label} ${kindLabels[node.kind] || node.kind}`.toLocaleLowerCase('pl').includes(normalizedQuery));
  const selectedSummary = language === 'en'
    ? `${inspection?.counts?.uses || 0} inputs · ${inspection?.counts?.usedBy || 0} direct uses · ${inspection?.counts?.affected || 0} affected items`
    : `${inspection?.counts?.uses || 0} wejść · ${inspection?.counts?.usedBy || 0} bezpośrednich użyć · ${inspection?.counts?.affected || 0} elementów pod wpływem`;
  return (
    <aside className="project-dependencies-panel" role="dialog" aria-modal="false" aria-label="Gdzie używane i wpływ zmiany">
      <header><div><Network size={16} /><span><strong>GDZIE UŻYWANE</strong><small>Graf zależności tylko do odczytu</small></span></div><button type="button" aria-label="Zamknij graf zależności" title="Zamknij" onClick={onClose}><X size={15} /></button></header>
      <section className="project-dependencies-source">
        <label><span>Znajdź obiekt</span><input value={query} placeholder="Nazwa albo typ…" onChange={(event) => setQuery(event.target.value)} /></label>
        <label><span>Analizowany obiekt</span><select data-dependency-source value={inspection?.selected?.id || ''} onChange={(event) => onSelectNode(event.target.value)}>{options.map((node) => <option key={node.id} value={node.id}>{kindLabel(node.kind)} · {node.label}</option>)}</select></label>
      </section>
      <section className="project-dependencies-selected">
        <span>{kindLabel(inspection?.selected?.kind || 'Obiekt')}</span>
        <strong>{inspection?.selected?.label || 'Brak obiektu'}</strong>
        <small>{selectedSummary}</small>
      </section>
      <nav className="project-dependencies-tabs" aria-label="Zakres grafu zależności">{[['usedBy', 'UŻYWANY PRZEZ'], ['uses', 'UŻYWA'], ['affected', 'WPŁYW ZMIANY']].map(([id, label]) => <button type="button" className={view === id ? 'active' : ''} aria-pressed={view === id} key={id} onClick={() => setView(id)}>{label}<span>{inspection?.counts?.[id] || 0}</span></button>)}</nav>
      <div className="project-dependencies-list" aria-live="polite">
        {list.length ? list.map((item) => <button type="button" data-dependency-node={item.id} data-dependency-kind={item.kind} key={`${view}-${item.id}`} onClick={() => onNavigate(item)}><span className="dependency-kind">{kindLabel(item.kind)}</span><div><strong>{item.label}</strong><small>{translateModelingText(relationLabels[item.relation] || item.relation, language)}{view === 'affected' ? language === 'en' ? ` · level ${item.depth}` : ` · poziom ${item.depth}` : ''}</small></div><ArrowRight size={13} /></button>) : <div className="project-dependencies-empty"><Network size={23} /><strong>Brak zależności w tym kierunku</strong><span>Wybierz inny obiekt albo zakres analizy.</span></div>}
      </div>
      <p className="project-dependencies-hint">Kliknij element, aby zaznaczyć go w projekcie. Analiza nie zmienia dokumentu.</p>
    </aside>
  );
}

export function ProjectSearchPalette({ index = [], language = 'pl', onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = React.useRef(null);
  const resultsRef = React.useRef(null);
  const results = searchProjectIndex(index, query, { limit: 30 });
  const kindLabels = { document: 'Dokument', parameter: 'Parametr', sketch: 'Szkic', feature: 'Operacja', body: 'Bryła', component: 'Komponent', 'component-instance': 'Wystąpienie', drawing: 'Arkusz', 'linked-project': 'Projekt linkowany', reference: 'Konstrukcja / referencja' };
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { resultsRef.current?.querySelector(`[data-project-search-position="${activeIndex}"]`)?.scrollIntoView?.({ block: 'nearest' }); }, [activeIndex, query]);
  const choose = (item) => { if (item) onNavigate(item); };
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => results.length ? Math.min(results.length - 1, current + 1) : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };
  return (
    <div className="project-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="project-search-palette" role="dialog" aria-modal="true" aria-label="Idź do obiektu projektu">
        <header><div><Search size={17} /><span><strong>IDŹ DO</strong><small>Wyszukaj nazwę albo typ obiektu</small></span></div><kbd>Ctrl/⌘ K</kbd><button type="button" aria-label="Zamknij wyszukiwanie projektu" title="Zamknij" onClick={onClose}><X size={15} /></button></header>
        <label className="project-search-input"><Search size={16} /><input ref={inputRef} data-project-search-input value={query} role="combobox" aria-controls="project-search-results" aria-expanded="true" aria-autocomplete="list" aria-activedescendant={results[activeIndex] ? `project-search-option-${activeIndex}` : undefined} placeholder="Parametr, szkic, operacja, komponent…" aria-label="Szukaj w projekcie" onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={handleKeyDown} /><span>{results.length}</span></label>
        <div ref={resultsRef} id="project-search-results" className="project-search-results" role="listbox" aria-label="Wyniki wyszukiwania projektu">
          {results.length ? results.map((item, resultIndex) => <button id={`project-search-option-${resultIndex}`} className={resultIndex === activeIndex ? 'active' : ''} type="button" role="option" aria-selected={resultIndex === activeIndex} data-project-search-position={resultIndex} data-project-search-result={item.id} data-project-search-kind={item.kind} key={item.id} onMouseEnter={() => setActiveIndex(resultIndex)} onClick={() => choose(item)}><span>{translateModelingText(kindLabels[item.kind] || item.kind, language)}</span><div><strong>{item.label}</strong>{item.secondary && <small>{item.secondary}</small>}</div><CornerDownLeft size={13} /></button>) : <div className="project-search-empty"><Search size={22} /><strong>Brak pasujących obiektów</strong><span>Spróbuj nazwy, typu albo numeru części.</span></div>}
        </div>
        <footer><span><kbd>↑</kbd><kbd>↓</kbd> wybór</span><span><kbd>Enter</kbd> przejdź</span><span><kbd>Esc</kbd> zamknij</span></footer>
      </section>
    </div>
  );
}

export function ProjectBrowser({ document, bodies, selection, activeSketchId, onSelect, onToggleReference, onToggleSketchVisibility = () => {}, onToggleBodyVisibility = () => {}, onClose }) {
  const [expanded, setExpanded] = useState({ origin: true, construction: true, components: true, joints: true, motionLinks: true, contactSets: true, configurations: true, sketches: true, surfaces: true, bodies: true });
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
  const solidBodies = bodies.filter((body) => body.bodyKind !== 'surface');
  const surfaceBodies = bodies.filter((body) => body.bodyKind === 'surface');
  const renderBody = (body) => {
    const bodyVisible = document.features.find((feature) => feature.id === body.sourceFeatureId)?.visible !== false;
    const surface = body.bodyKind === 'surface';
    return <div className="tree-reference-row" key={body.id}>
      <button
        className={`tree-row tree-grandchild ${selection?.kind === 'body' && selection.id === body.id ? 'selected' : ''} ${bodyVisible ? '' : 'hidden-object'}`}
        type="button"
        title={surface ? `Zaznacz powierzchnię ${body.name}; użyj Pogrub, aby utworzyć bryłę.` : body.representation === 'mesh-import' ? `${body.name}: ${body.meshBooleanCapable === false ? 'otwarta siatka do pomiaru, transformacji i eksportu' : 'zamknięta siatka 3D'}.` : `Zaznacz dokładną bryłę B-Rep ${body.name} do dalszych operacji.`}
        onClick={() => onSelect({ kind: 'body', id: body.id })}
      >
        <span />{surface ? <Frame size={13} /> : <Box size={13} />}<span>{body.name}</span><span className="body-kind"><small>{surface ? 'POW.' : body.representation === 'mesh-import' ? (body.meshBooleanCapable === false ? 'SIATKA OTW.' : 'SIATKA') : 'B-REP'}</small><i className="body-color" style={{ background: body.color }} /></span>
      </button>
      <button className="tree-reference-visibility" type="button" aria-pressed={bodyVisible} title={bodyVisible ? `Ukryj ${body.name}` : `Pokaż ${body.name}`} onClick={() => onToggleBodyVisibility(body.id)}>{bodyVisible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
    </div>;
  };
  return (
    <aside className="model-browser" aria-label="Przeglądarka projektu">
      <div className="browser-heading"><strong>PRZEGLĄDARKA</strong><button type="button" title="Zwiń przeglądarkę" onClick={onClose}><PanelLeftClose size={14} /></button></div>
      <button className={`tree-row tree-root ${selection?.kind === 'document' ? 'selected' : ''}`} type="button" title="Zaznacz cały dokument projektu." onClick={() => onSelect({ kind: 'document', id: document.id })}>
        <ChevronDown size={13} /><FileBox size={14} /><strong>{document.name || 'Bez nazwy'}</strong>
      </button>
      <button className="tree-row tree-child" type="button" title="Otwórz nazwane parametry sterujące wymiarami modelu." onClick={() => onSelect({ kind: 'settings', id: document.id })}>
        <span /><Settings2 size={14} /><span>Parametry modelu</span><small>mm</small>
      </button>

      <button className="tree-row tree-child tree-folder" type="button" title={`${expanded.origin ? 'Zwiń' : 'Rozwiń'} płaszczyzny początku układu.`} onClick={() => toggle('origin')}>
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

      <button className="tree-row tree-child tree-folder" type="button" title={`${expanded.construction ? 'Zwiń' : 'Rozwiń'} geometrię konstrukcyjną.`} onClick={() => toggle('construction')}>
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

      <button className="tree-row tree-child tree-folder" type="button" title={`${expanded.components ? 'Zwiń' : 'Rozwiń'} strukturę części i złożeń.`} onClick={() => toggle('components')}>
        {expanded.components ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Boxes size={14} /><span>Złożenie</span><small>{document.componentInstances?.length || 0}</small>
      </button>
      {expanded.components && (componentRoots.length
        ? componentRoots.map((component) => renderComponent(component))
        : <div className="tree-empty">Brak komponentów</div>)}

      {!!document.joints?.length && <><button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj jointy złożenia." onClick={() => toggle('joints')}>
        {expanded.joints ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Link2 size={14} /><span>Jointy</span><small>{document.joints?.length || 0}</small>
      </button>
      {expanded.joints && document.joints.map((joint) => <button className={`tree-row tree-joint ${selection?.kind === 'joint' && selection.id === joint.id ? 'selected' : ''}`} type="button" key={joint.id} title={`${joint.type} · oś ${joint.axis.toUpperCase()} · ${joint.value}`} onClick={() => onSelect({ kind: 'joint', id: joint.id, movingInstanceId: joint.movingInstanceId })}><span /><Link2 size={13} /><span>{joint.name}</span><small>{joint.type === 'rigid' ? 'LOCK' : joint.value}</small></button>)}</>}

      {!!document.motionLinks?.length && <><button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj powiązania ruchu." onClick={() => toggle('motionLinks')}>
        {expanded.motionLinks ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<GitCompareArrows size={14} /><span>Motion Links</span><small>{document.motionLinks?.length || 0}</small>
      </button>
      {expanded.motionLinks && document.motionLinks.map((link) => <button className={`tree-row tree-motion-link ${selection?.kind === 'motionLink' && selection.id === link.id ? 'selected' : ''}`} type="button" key={link.id} title={`${link.ratio}× ${link.offset ? `· offset ${link.offset}` : ''}`} onClick={() => onSelect({ kind: 'motionLink', id: link.id })}><span /><GitCompareArrows size={13} /><span>{link.name}</span><small>{link.ratio}×</small></button>)}</>}

      {!!document.contactSets?.length && <><button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj monitorowane pary kontaktowe." onClick={() => toggle('contactSets')}>
        {expanded.contactSets ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Magnet size={14} /><span>Contact Sets</span><small>{document.contactSets?.length || 0}</small>
      </button>
      {expanded.contactSets && document.contactSets.map((contactSet) => <button className={`tree-row tree-contact-set ${selection?.kind === 'contactSet' && selection.id === contactSet.id ? 'selected' : ''}`} type="button" key={contactSet.id} title={contactSet.enabled ? 'Monitorowanie kontaktu aktywne' : 'Monitorowanie kontaktu wyłączone'} onClick={() => onSelect({ kind: 'contactSet', id: contactSet.id })}><span /><Magnet size={13} /><span>{contactSet.name}</span><small>{contactSet.enabled ? 'ON' : 'OFF'}</small></button>)}</>}

      {!!document.assemblyConfigurations?.length && <><button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj konfiguracje złożenia." onClick={() => toggle('configurations')}>
        {expanded.configurations ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Save size={14} /><span>Konfiguracje</span><small>{document.assemblyConfigurations?.length || 0}</small>
      </button>
      {expanded.configurations && document.assemblyConfigurations.map((configuration) => <button className={`tree-row tree-configuration ${selection?.kind === 'assemblyConfiguration' && selection.id === configuration.id ? 'selected' : ''} ${document.activeAssemblyConfigurationId === configuration.id ? 'active' : ''}`} type="button" key={configuration.id} title={configuration.description || 'Zapisany stan złożenia'} onClick={() => onSelect({ kind: 'assemblyConfiguration', id: configuration.id })}><span /><Save size={13} /><span>{configuration.name}</span><small>{document.activeAssemblyConfigurationId === configuration.id ? 'AKTYWNA' : ''}</small></button>)}</>}

      <button className="tree-row tree-child tree-folder" type="button" title={`${expanded.sketches ? 'Zwiń' : 'Rozwiń'} listę szkiców i profili.`} onClick={() => toggle('sketches')}>
        {expanded.sketches ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Szkice</span><small>{document.sketches.length}</small>
      </button>
      {expanded.sketches && document.sketches.map((sketch) => (
        <React.Fragment key={sketch.id}>
          <div className="tree-reference-row">
          <button
            className={`tree-row tree-grandchild ${selection?.kind === 'sketch' && selection.id === sketch.id ? 'selected' : ''} ${activeSketchId === sketch.id ? 'editing' : ''} ${sketch.visible === false ? 'hidden-object' : ''}`}
            type="button"
            title={`Zaznacz ${sketch.name}; użyj Edytuj, aby wrócić do szkicu.`}
            onClick={() => onSelect({ kind: 'sketch', id: sketch.id })}
          >
            <span /><PencilRuler size={13} /><span>{sketch.name}</span><small>{sketch.plane}</small>
          </button>
          <button className="tree-reference-visibility" type="button" aria-pressed={sketch.visible !== false} title={sketch.visible !== false ? `Ukryj ${sketch.name}` : `Pokaż ${sketch.name}`} onClick={() => onToggleSketchVisibility(sketch.id)}>{sketch.visible !== false ? <Eye size={13} /> : <EyeOff size={13} />}</button>
          </div>
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

      <button className="tree-row tree-child tree-folder" type="button" title={`${expanded.surfaces ? 'Zwiń' : 'Rozwiń'} listę powierzchni.`} onClick={() => toggle('surfaces')}>
        {expanded.surfaces ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Powierzchnie</span><small>{surfaceBodies.length}</small>
      </button>
      {expanded.surfaces && surfaceBodies.map(renderBody)}

      <button className="tree-row tree-child tree-folder" type="button" title={`${expanded.bodies ? 'Zwiń' : 'Rozwiń'} listę utworzonych brył.`} onClick={() => toggle('bodies')}>
        {expanded.bodies ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Bryły</span><small>{solidBodies.length}</small>
      </button>
      {expanded.bodies && solidBodies.map(renderBody)}
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
          <h1 id="start-page-title">Zacznij od szkicu 2D. Potem wybierz dalszy cel.</h1>
          <p>Szkic jest wspólnym początkiem. Możesz przygotować z niego arkusz techniczny 2D albo zbudować model 3D. Druk 3D jest osobnym, opcjonalnym etapem.</p>
          <div className="start-page-actions">
            <button className="start-page-action primary" type="button" onClick={onStartSketch}>
              <PencilRuler size={22} />
              <span><strong>Nowy szkic 2D</strong><small>Wybierz płaszczyznę, rysuj myszą i wpisuj dokładne wymiary.</small></span>
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
          <strong>Co możesz zrobić dalej</strong>
          <ol>
            <li><span>1</span><div><PencilRuler size={18} /><strong>Szkic 2D</strong><small>Linie, łuki, snap, trim, offset, więzy i wymiary.</small></div></li>
            <li><span>2A</span><div><FileBox size={18} /><strong>Arkusz techniczny 2D</strong><small>Widoki, wymiary oraz zapis do PDF lub DXF.</small></div></li>
            <li><span>2B</span><div><Layers3 size={18} /><strong>Model parametryczny 3D</strong><small>Wyciągnięcia, operacje bryłowe i edytowalna historia.</small></div></li>
            <li><span>3</span><div><Box size={18} /><strong>Opcjonalnie: druk 3D</strong><small>Osobne przygotowanie modelu i przekazanie do slicera.</small></div></li>
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
