import React from 'react';
import { AlertOctagon, AlertTriangle, Anchor, Blocks, Box, Boxes, Check, CheckCircle2, Copy, Eye, EyeOff, FileDown, FolderOpen, GitCompareArrows, Keyboard, Layers3, Link2, Lock, LockOpen, Magnet, PackageOpen, Play, Plus, Printer, RotateCcw, Ruler, Save, ScanSearch, Search, Trash2, Ungroup, X, XCircle } from 'lucide-react';
import { detectAssemblyCollisions } from '../cad-core/assembly-motion.js';
import { COMPONENT_APPEARANCE_PRESETS, componentAppearancePreset, componentDescendantIds, componentInstanceDescendantIds, componentInstanceTree, componentParentMap, componentTree, normalizeComponentAppearance } from '../cad-core/components.js';
import { formatModelFileSize } from '../cad-core/model-import.js';
import { BY_LAYER, DEFAULT_LAYER_ID, LINE_TYPES, LINE_WEIGHTS } from '../cad-core/layers.js';
import { commandCustomizationRows, validateCommandCustomization } from './command-customization.js';
import { multipleSelectionLabel } from './platform-shortcuts.js';
import { useDialogFocus } from './use-dialog-focus.js';

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

export function NamedViewsPanel({ views = [], currentCamera = null, readOnly = false, onCreate, onActivate, onDelete, onClose }) {
  const [name, setName] = React.useState('');
  return (
    <aside className="measure-panel named-views-panel" aria-label="Zapisane widoki modelu">
      <header><div><Eye size={16} /><strong>Zapisane widoki</strong></div><button type="button" title="Zamknij zapisane widoki" aria-label="Zamknij zapisane widoki" onClick={onClose}><X size={15} /></button></header>
      <form onSubmit={(event) => { event.preventDefault(); onCreate(name); setName(''); }}>
        <label><span>Nazwa widoku</span><input aria-label="Nazwa nowego widoku" value={name} maxLength="60" placeholder={`Widok ${views.length + 1}`} disabled={readOnly} onChange={(event) => setName(event.target.value)} /></label>
        <button type="submit" disabled={readOnly || !currentCamera || !name.trim()}><Save size={14} /> Zapisz bieżącą kamerę</button>
      </form>
      <div className="named-views-list">
        {!views.length && <p>Obróć lub przesuń model, a następnie zapisz bieżące ustawienie kamery.</p>}
        {views.map((view) => <div className="named-view-row" key={view.id}><button type="button" onClick={() => onActivate(view)}><Eye size={14} /><span><strong>{view.name}</strong><small>{view.camera.position.map((value) => value.toFixed(1)).join(', ')}</small></span></button><button type="button" aria-label={`Usuń zapisany widok ${view.name}`} disabled={readOnly} onClick={() => onDelete(view.id)}><Trash2 size={13} /></button></div>)}
      </div>
      <p className="named-view-note">Widok zapisuje pozycję kamery, punkt celu i kierunek góry. Nie zmienia geometrii modelu.</p>
    </aside>
  );
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

export function ComponentPanel({ document, bodies = [], collisionResult = { collisions: [], contactSets: [], checkedPairs: 0 }, selectedComponentId = '', selectedInstanceId = '', selectedJointId = '', selectedMotionLinkId = '', selectedConfigurationId = '', selectedContactSetId = '', selectedBodyIds = [], linkedProjectStatuses = {}, readOnly = false, explodeAmount = 0, onExplodeAmountChange, onCreate, onLinkProject, onPackAndGo, onRefreshLinkedProject, onRepairLinkedProject, onUpdate, onAssignBodies, onMove, onDelete, onSelect, onSelectInstance, onCreateInstance, onUpdateInstance, onDuplicateInstance, onDeleteInstance, onCreateRigidGroup, onDeleteRigidGroup, onSelectJoint, onCreateJoint, onUpdateJoint, onSetJointValue, onDeleteJoint, onSelectMotionLink, onCreateMotionLink, onUpdateMotionLink, onDeleteMotionLink, onSelectConfiguration, onCreateConfiguration, onUpdateConfiguration, onApplyConfiguration, onDeleteConfiguration, onSelectContactSet, onCreateContactSet, onUpdateContactSet, onDeleteContactSet, onClose }) {
  const [rigidMateId, setRigidMateId] = React.useState('');
  const [jointMateId, setJointMateId] = React.useState('');
  const [jointType, setJointType] = React.useState('revolute');
  const [jointAxis, setJointAxis] = React.useState('z');
  const [motionSourceId, setMotionSourceId] = React.useState('');
  const [motionTargetId, setMotionTargetId] = React.useState('');
  const [motionRatio, setMotionRatio] = React.useState('1');
  const [motionOffset, setMotionOffset] = React.useState('0');
  const [configurationName, setConfigurationName] = React.useState('');
  const [contactFirstId, setContactFirstId] = React.useState('');
  const [contactSecondId, setContactSecondId] = React.useState('');
  const [interferenceFirstId, setInterferenceFirstId] = React.useState('');
  const [interferenceSecondId, setInterferenceSecondId] = React.useState('');
  const [interferencePair, setInterferencePair] = React.useState([]);
  const selected = document.components.find((component) => component.id === selectedComponentId) || null;
  const selectedLink = selected?.linkedProjectId ? document.linkedProjects.find((link) => link.id === selected.linkedProjectId) : null;
  const selectedLinkStatus = selectedLink ? linkedProjectStatuses[selectedLink.id] || { state: 'checking' } : null;
  const linkedStateLabels = { current: 'AKTUALNY', changed: 'ZMIENIONY', missing: 'BRAK PLIKU', error: 'BŁĄD', checking: 'SPRAWDZANIE' };
  const selectedInstance = (document.componentInstances || []).find((instance) => instance.id === selectedInstanceId) || null;
  const parentId = selected ? componentParentMap(document.components).get(selected.id) || '' : '';
  const excludedParents = selected ? new Set([selected.id, ...componentDescendantIds(document.components, selected.id)]) : new Set();
  const componentRows = [];
  const collectRows = (component, depth = 0) => {
    componentRows.push({ component, depth });
    component.children.forEach((child) => collectRows(child, depth + 1));
  };
  componentTree(document.components).forEach((component) => collectRows(component));
  const instanceRows = [];
  const collectInstanceRows = (instance, depth = 0) => {
    instanceRows.push({ instance, depth });
    instance.children.forEach((child) => collectInstanceRows(child, depth + 1));
  };
  componentInstanceTree(document).forEach((instance) => collectInstanceRows(instance));
  const instances = React.useMemo(() => document.componentInstances || [], [document.componentInstances]);
  const explodedOccurrenceCount = instances.filter((instance) => instance.visible && document.components.find((component) => component.id === instance.componentId)?.bodyIds?.length).length;
  const interferenceResult = React.useMemo(() => (
    interferencePair.length === 2 && interferencePair.every((instanceId) => instances.some((instance) => instance.id === instanceId))
      ? detectAssemblyCollisions(document, bodies, { instanceIds: interferencePair })
      : null
  ), [document, bodies, instances, interferencePair]);
  const interferenceCollision = interferenceResult?.collisions?.[0] || null;
  const interferenceStatus = !interferenceResult ? 'idle' : interferenceCollision?.status || 'clear';
  const interferenceStatusLabel = interferenceStatus === 'exact' ? 'POTWIERDZONA KOLIZJA' : interferenceStatus === 'broad-phase' ? 'RYZYKO — TYLKO OBWIEDNIE' : interferenceStatus === 'clear' ? 'BRAK KOLIZJI' : 'WYBIERZ PARĘ';
  const rigidGroups = document.rigidGroups || [];
  const instanceDescendants = selectedInstance ? componentInstanceDescendantIds(instances, selectedInstance.id) : new Set();
  const assemblyInstances = instances.filter((instance) => document.components.find((component) => component.id === instance.componentId)?.type === 'assembly' && instance.id !== selectedInstance?.id && !instanceDescendants.has(instance.id));
  const rigidGroup = selectedInstance ? rigidGroups.find((group) => group.instanceIds.includes(selectedInstance.id)) : null;
  const rigidMates = selectedInstance ? instances.filter((instance) => instance.id !== selectedInstance.id && instance.parentInstanceId === selectedInstance.parentInstanceId && !rigidGroups.some((group) => group.instanceIds.includes(instance.id))) : [];
  const joints = document.joints || [];
  const selectedJoint = joints.find((joint) => joint.id === selectedJointId) || null;
  const motionLinks = document.motionLinks || [];
  const selectedMotionLink = motionLinks.find((link) => link.id === selectedMotionLinkId) || null;
  const configurations = document.assemblyConfigurations || [];
  const selectedConfiguration = configurations.find((configuration) => configuration.id === selectedConfigurationId) || null;
  const contactSets = document.contactSets || [];
  const selectedContactSet = contactSets.find((contactSet) => contactSet.id === selectedContactSetId) || null;
  const jointMates = selectedInstance ? instances.filter((instance) => instance.id !== selectedInstance.id && instance.parentInstanceId === selectedInstance.parentInstanceId) : [];
  const jointUnit = selectedJoint?.type === 'slider' ? 'mm' : '°';
  const updateOrigin = (axis, value) => onUpdate(selected.id, { origin: { ...selected.origin, [axis]: Number(value) } });
  const selectedAppearance = normalizeComponentAppearance(selected?.appearance);
  const updateAppearancePreset = (presetId) => onUpdate(selected.id, { appearance: { ...componentAppearancePreset(presetId) } });
  const updateAppearance = (patch) => onUpdate(selected.id, { appearance: normalizeComponentAppearance({ ...selectedAppearance, ...patch, preset: 'custom' }) });
  const toggleBody = (bodyId, checked) => onAssignBodies(selected.id, checked
    ? [...selected.bodyIds, bodyId]
    : selected.bodyIds.filter((id) => id !== bodyId));
  return (
    <aside className="measure-panel component-panel" aria-label="Komponenty i złożenia">
      <header><div><Boxes size={16} /><strong>Komponenty i złożenia</strong></div><button type="button" title="Zamknij komponenty" aria-label="Zamknij komponenty" onClick={onClose}><X size={15} /></button></header>
      <div className="component-toolbar">
        <button type="button" data-component-action="create-part" disabled={readOnly} onClick={() => onCreate('part')}><Box size={14} /> Nowa część</button>
        <button type="button" data-component-action="create-assembly" disabled={readOnly} onClick={() => onCreate('assembly')}><Boxes size={14} /> Nowe złożenie</button>
        <button type="button" data-component-action="link-project" disabled={readOnly || !onLinkProject} onClick={onLinkProject}><Link2 size={14} /> Linkuj projekt</button>
        <button type="button" data-component-action="pack-and-go" disabled={!onPackAndGo} onClick={onPackAndGo}><PackageOpen size={14} /> Pack &amp; Go</button>
      </div>
      <div className={`component-exploded-view ${explodeAmount > 0 ? 'active' : ''}`}>
        <div><Ungroup size={15} /><span><strong>Widok rozstrzelony</strong><small>{explodeAmount > 0 ? `${Math.round(explodeAmount * 100)}% rozłożenia` : 'Położenia projektowe'}</small></span><button type="button" disabled={!explodeAmount} onClick={() => onExplodeAmountChange?.(0)}>Złóż</button></div>
        <label><span>Rozłożenie</span><input aria-label="Stopień rozstrzelenia złożenia" type="range" min="0" max="1" step="0.05" value={explodeAmount} disabled={explodedOccurrenceCount < 2} onChange={(event) => onExplodeAmountChange?.(Number(event.target.value))} /><output>{Math.round(explodeAmount * 100)}%</output></label>
        <p>{explodedOccurrenceCount < 2 ? 'Wstaw co najmniej dwa wystąpienia części.' : 'Tylko podgląd: położenia, jointy i historia modelu pozostają bez zmian.'}</p>
      </div>
      <div className="component-list" aria-label="Struktura dokumentu">
        <div className="component-section-title"><strong>Definicje</strong><span>{document.components.length}</span></div>
        {!document.components.length && <p>Utwórz część z zaznaczonej bryły albo puste złożenie nadrzędne.</p>}
        {componentRows.map(({ component, depth }) => <button className={selected?.id === component.id ? 'active' : ''} style={{ '--component-list-depth': depth }} type="button" key={component.id} onClick={() => onSelect(component.id)}><span>{component.linkedProjectId ? <Link2 size={15} /> : component.type === 'assembly' ? <Boxes size={15} /> : <Box size={15} />}<strong>{component.name}</strong><small>{component.partNumber}</small></span><em>{component.linkedProjectId ? linkedStateLabels[linkedProjectStatuses[component.linkedProjectId]?.state || 'checking'] : component.type === 'assembly' ? `${component.componentIds.length} elem.` : `${component.bodyIds.length} brył`}</em></button>)}
      </div>
      <div className="component-occurrences" aria-label="Wystąpienia komponentów">
        <div className="component-section-title"><strong>Wystąpienia w złożeniu</strong><span>{instances.length}</span></div>
        {!instanceRows.length && <p>Brak wystąpień w modelu.</p>}
        {instanceRows.map(({ instance, depth }) => <button className={selectedInstance?.id === instance.id ? 'active' : ''} style={{ '--component-list-depth': depth }} type="button" key={instance.id} onClick={() => onSelectInstance(instance.id)}><span>{instance.grounded ? <Anchor size={14} /> : instance.component?.type === 'assembly' ? <Boxes size={14} /> : <Box size={14} />}<strong>{instance.name}</strong></span><em>{instance.visible ? 'WID.' : 'UKR.'}</em></button>)}
      </div>
      {selectedInstance && !selectedJoint && <div className="component-instance-properties">
        <div className="component-section-title"><strong>Położenie wystąpienia</strong><span>{rigidGroup ? rigidGroup.name : selectedInstance.grounded ? 'GROUND' : 'SWOBODNE'}</span></div>
        <label><span>Nazwa</span><input aria-label="Nazwa wystąpienia" value={selectedInstance.name} disabled={readOnly} onChange={(event) => onUpdateInstance(selectedInstance.id, { name: event.target.value })} /></label>
        <label><span>Złożenie nadrzędne</span><select aria-label="Nadrzędne wystąpienie złożenia" value={selectedInstance.parentInstanceId} disabled={readOnly || selectedInstance.primary} onChange={(event) => onUpdateInstance(selectedInstance.id, { parentInstanceId: event.target.value })}><option value="">Poziom główny</option>{assemblyInstances.map((instance) => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select></label>
        <div className="component-origin">{['x', 'y', 'z'].map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input aria-label={`Położenie ${axis.toUpperCase()}`} type="number" step="0.1" value={selectedInstance.transform[axis]} disabled={readOnly || selectedInstance.grounded} onChange={(event) => onUpdateInstance(selectedInstance.id, { transform: { [axis]: Number(event.target.value) } })} /></label>)}</div>
        <div className="component-origin component-rotation">{['rotationX', 'rotationY', 'rotationZ'].map((axis) => <label key={axis}><span>{axis.at(-1)}°</span><input aria-label={`Obrót ${axis.at(-1)}`} type="number" step="1" value={selectedInstance.transform[axis]} disabled={readOnly || selectedInstance.grounded} onChange={(event) => onUpdateInstance(selectedInstance.id, { transform: { [axis]: Number(event.target.value) } })} /></label>)}</div>
        <div className="component-instance-toggles"><label><input type="checkbox" checked={selectedInstance.grounded} disabled={readOnly} onChange={(event) => onUpdateInstance(selectedInstance.id, { grounded: event.target.checked })} /><Anchor size={14} /> Ground — zablokuj położenie</label><label><input type="checkbox" checked={selectedInstance.visible} disabled={readOnly} onChange={(event) => onUpdateInstance(selectedInstance.id, { visible: event.target.checked })} /><Eye size={14} /> Widoczne</label></div>
        <div className="component-actions"><button type="button" disabled={readOnly} onClick={() => onDuplicateInstance(selectedInstance.id)}><Copy size={14} /> Powiel</button><button className="danger" type="button" disabled={readOnly || selectedInstance.primary} onClick={() => onDeleteInstance(selectedInstance.id)}><Trash2 size={14} /> Usuń wystąpienie</button></div>
        <div className="component-rigid-group"><div className="component-section-title"><strong>Rigid Group</strong><span>{rigidGroup ? rigidGroup.instanceIds.length : 0}</span></div>{rigidGroup ? <button type="button" disabled={readOnly} onClick={() => onDeleteRigidGroup(rigidGroup.id)}><Ungroup size={14} /> Rozwiąż „{rigidGroup.name}”</button> : <div><select aria-label="Drugie wystąpienie grupy sztywnej" value={rigidMateId} disabled={readOnly || !rigidMates.length} onChange={(event) => setRigidMateId(event.target.value)}><option value="">Wybierz drugi element</option>{rigidMates.map((instance) => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select><button type="button" disabled={readOnly || !rigidMateId} onClick={() => { onCreateRigidGroup([selectedInstance.id, rigidMateId]); setRigidMateId(''); }}><Link2 size={14} /> Utwórz grupę sztywną</button></div>}</div>
      </div>}
      <div className="component-joints" aria-label="Jointy złożenia">
        <div className="component-section-title"><strong>Jointy</strong><span>{joints.length}</span></div>
        <div className="component-joint-list">{!joints.length && <p>Połącz dwa wystąpienia przez rigid, obrót albo suwak.</p>}{joints.map((joint) => <button className={selectedJoint?.id === joint.id ? 'active' : ''} type="button" key={joint.id} onClick={() => onSelectJoint(joint.id)}><Link2 size={14} /><span><strong>{joint.name}</strong><small>{joint.type.toUpperCase()} · oś {joint.axis.toUpperCase()}</small></span><em>{joint.type === 'rigid' ? 'LOCK' : joint.value}</em></button>)}</div>
        {selectedInstance && !selectedJoint && <div className="component-joint-create"><select aria-label="Typ nowego jointa" value={jointType} disabled={readOnly} onChange={(event) => setJointType(event.target.value)}><option value="rigid">Rigid</option><option value="revolute">Revolute</option><option value="slider">Slider</option></select><select aria-label="Oś nowego jointa" value={jointAxis} disabled={readOnly || jointType === 'rigid'} onChange={(event) => setJointAxis(event.target.value)}><option value="x">Oś X</option><option value="y">Oś Y</option><option value="z">Oś Z</option></select><select aria-label="Bazowe wystąpienie jointa" value={jointMateId} disabled={readOnly || selectedInstance.grounded || !jointMates.length} onChange={(event) => setJointMateId(event.target.value)}><option value="">Wybierz element bazowy</option>{jointMates.map((instance) => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select><button type="button" disabled={readOnly || selectedInstance.grounded || !jointMateId} onClick={() => { onCreateJoint({ type: jointType, axis: jointAxis, referenceInstanceId: jointMateId, movingInstanceId: selectedInstance.id }); setJointMateId(''); }}><Plus size={14} /> Utwórz joint</button></div>}
        {selectedJoint && <div className="component-joint-properties"><label><span>Nazwa</span><input aria-label="Nazwa jointa" value={selectedJoint.name} disabled={readOnly} onChange={(event) => onUpdateJoint(selectedJoint.id, { name: event.target.value })} /></label><div className="component-joint-grid"><label><span>Typ</span><select aria-label="Typ jointa" value={selectedJoint.type} disabled={readOnly} onChange={(event) => onUpdateJoint(selectedJoint.id, { type: event.target.value })}><option value="rigid">Rigid</option><option value="revolute">Revolute</option><option value="slider">Slider</option></select></label><label><span>Oś</span><select aria-label="Oś jointa" value={selectedJoint.axis} disabled={readOnly || selectedJoint.type === 'rigid'} onChange={(event) => onUpdateJoint(selectedJoint.id, { axis: event.target.value })}><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label></div>{selectedJoint.type !== 'rigid' && <><label className="joint-limit-toggle"><input type="checkbox" checked={selectedJoint.limits.enabled} disabled={readOnly} onChange={(event) => onUpdateJoint(selectedJoint.id, { limits: { enabled: event.target.checked } })} /> Aktywne limity</label><div className="component-joint-grid"><label><span>Minimum {jointUnit}</span><input aria-label="Minimalny limit jointa" type="number" value={selectedJoint.limits.min} disabled={readOnly} onChange={(event) => onUpdateJoint(selectedJoint.id, { limits: { min: Number(event.target.value) } })} /></label><label><span>Maksimum {jointUnit}</span><input aria-label="Maksymalny limit jointa" type="number" value={selectedJoint.limits.max} disabled={readOnly} onChange={(event) => onUpdateJoint(selectedJoint.id, { limits: { max: Number(event.target.value) } })} /></label></div><label><span>Położenie {jointUnit}</span><input aria-label="Wartość jointa" type="range" min={selectedJoint.limits.enabled ? selectedJoint.limits.min : selectedJoint.type === 'slider' ? -100 : -180} max={selectedJoint.limits.enabled ? selectedJoint.limits.max : selectedJoint.type === 'slider' ? 100 : 180} step={selectedJoint.type === 'slider' ? 0.5 : 1} value={selectedJoint.value} disabled={readOnly || !selectedJoint.enabled} onChange={(event) => onSetJointValue(selectedJoint.id, Number(event.target.value))} /><input aria-label="Numeryczna wartość jointa" type="number" value={selectedJoint.value} disabled={readOnly || !selectedJoint.enabled} onChange={(event) => onSetJointValue(selectedJoint.id, Number(event.target.value))} /></label></>}<div className="component-instance-toggles"><label><input type="checkbox" checked={selectedJoint.enabled} disabled={readOnly} onChange={(event) => onUpdateJoint(selectedJoint.id, { enabled: event.target.checked })} /> Joint aktywny</label></div><div className="component-actions"><button type="button" disabled={readOnly} onClick={() => onUpdateJoint(selectedJoint.id, { captureRest: true })}><RotateCcw size={14} /> Ustaw bieżące jako zero</button><button className="danger" type="button" disabled={readOnly} onClick={() => onDeleteJoint(selectedJoint.id)}><Trash2 size={14} /> Usuń joint</button></div></div>}
      </div>
      <div className="component-motion-links" aria-label="Powiązania ruchu">
        <div className="component-section-title"><strong>Motion Links</strong><span>{motionLinks.length}</span></div>
        <div className="component-motion-list">
          {!motionLinks.length && <p>Powiąż dwa jointy przełożeniem i opcjonalnym offsetem.</p>}
          {motionLinks.map((link) => <button className={selectedMotionLink?.id === link.id ? 'active' : ''} type="button" key={link.id} onClick={() => onSelectMotionLink(link.id)}><GitCompareArrows size={14} /><span><strong>{link.name}</strong><small>{joints.find((joint) => joint.id === link.sourceJointId)?.name} → {joints.find((joint) => joint.id === link.targetJointId)?.name}</small></span><em>{link.ratio}× {link.offset ? `${link.offset > 0 ? '+' : ''}${link.offset}` : ''}</em></button>)}
        </div>
        {joints.length >= 2 && !selectedMotionLink && <div className="component-motion-create"><select aria-label="Źródłowy joint Motion Link" value={motionSourceId} disabled={readOnly} onChange={(event) => setMotionSourceId(event.target.value)}><option value="">Joint źródłowy</option>{joints.map((joint) => <option key={joint.id} value={joint.id}>{joint.name}</option>)}</select><select aria-label="Docelowy joint Motion Link" value={motionTargetId} disabled={readOnly} onChange={(event) => setMotionTargetId(event.target.value)}><option value="">Joint docelowy</option>{joints.map((joint) => <option key={joint.id} value={joint.id}>{joint.name}</option>)}</select><div className="component-joint-grid"><label><span>Przełożenie</span><input aria-label="Przełożenie Motion Link" type="number" step="0.1" value={motionRatio} disabled={readOnly} onChange={(event) => setMotionRatio(event.target.value)} /></label><label><span>Offset</span><input aria-label="Offset Motion Link" type="number" step="0.1" value={motionOffset} disabled={readOnly} onChange={(event) => setMotionOffset(event.target.value)} /></label></div><button type="button" disabled={readOnly || !motionSourceId || !motionTargetId || motionSourceId === motionTargetId} onClick={() => { onCreateMotionLink({ sourceJointId: motionSourceId, targetJointId: motionTargetId, ratio: Number(motionRatio), offset: Number(motionOffset) }); setMotionTargetId(''); }}><Plus size={14} /> Utwórz Motion Link</button></div>}
        {selectedMotionLink && <div className="component-motion-properties"><label><span>Nazwa</span><input aria-label="Nazwa Motion Link" value={selectedMotionLink.name} disabled={readOnly} onChange={(event) => onUpdateMotionLink(selectedMotionLink.id, { name: event.target.value })} /></label><div className="component-joint-grid"><label><span>Przełożenie</span><input aria-label="Przełożenie wybranego Motion Link" type="number" step="0.1" value={selectedMotionLink.ratio} disabled={readOnly} onChange={(event) => onUpdateMotionLink(selectedMotionLink.id, { ratio: Number(event.target.value) })} /></label><label><span>Offset</span><input aria-label="Offset wybranego Motion Link" type="number" step="0.1" value={selectedMotionLink.offset} disabled={readOnly} onChange={(event) => onUpdateMotionLink(selectedMotionLink.id, { offset: Number(event.target.value) })} /></label></div><div className="component-instance-toggles"><label><input type="checkbox" checked={selectedMotionLink.enabled} disabled={readOnly} onChange={(event) => onUpdateMotionLink(selectedMotionLink.id, { enabled: event.target.checked })} /> Motion Link aktywny</label></div><div className="component-actions"><button type="button" onClick={() => onSelectMotionLink('')}><X size={14} /> Zamknij edycję</button><button className="danger" type="button" disabled={readOnly} onClick={() => { onDeleteMotionLink(selectedMotionLink.id); onSelectMotionLink(''); }}><Trash2 size={14} /> Usuń Motion Link</button></div></div>}
      </div>
      <div className="component-configurations" aria-label="Konfiguracje złożenia">
        <div className="component-section-title"><strong>Konfiguracje</strong><span>{configurations.length}</span></div>
        <div className="component-configuration-create"><input aria-label="Nazwa nowej konfiguracji" value={configurationName} disabled={readOnly} placeholder={`Konfiguracja ${configurations.length + 1}`} onChange={(event) => setConfigurationName(event.target.value)} /><button type="button" disabled={readOnly} onClick={() => { onCreateConfiguration({ name: configurationName }); setConfigurationName(''); }}><Save size={14} /> Zapisz nową</button></div>
        <div className="component-configuration-list">{configurations.map((configuration) => <div className={`component-configuration-row ${configuration.id === document.activeAssemblyConfigurationId ? 'active' : ''} ${configuration.id === selectedConfigurationId ? 'selected' : ''}`} key={configuration.id}><button type="button" onClick={() => onSelectConfiguration(configuration.id)}><span><strong>{configuration.name}</strong><small>{configuration.instanceStates.length} wyst. · {configuration.jointStates.length} joint.</small></span></button><button type="button" aria-label={`Aktywuj konfigurację ${configuration.name}`} disabled={readOnly} onClick={() => onApplyConfiguration(configuration.id)}><Play size={13} /></button></div>)}</div>
        {selectedConfiguration && <div className="component-configuration-properties"><label><span>Nazwa</span><input aria-label="Nazwa konfiguracji" value={selectedConfiguration.name} disabled={readOnly} onChange={(event) => onUpdateConfiguration(selectedConfiguration.id, { name: event.target.value })} /></label><label><span>Opis</span><textarea aria-label="Opis konfiguracji" rows="2" value={selectedConfiguration.description} disabled={readOnly} onChange={(event) => onUpdateConfiguration(selectedConfiguration.id, { description: event.target.value })} /></label><div className="component-actions"><button type="button" disabled={readOnly} onClick={() => onUpdateConfiguration(selectedConfiguration.id, { captureCurrent: true })}><Save size={14} /> Zapisz bieżący stan</button><button className="danger" type="button" disabled={readOnly} onClick={() => { onDeleteConfiguration(selectedConfiguration.id); onSelectConfiguration(''); }}><Trash2 size={14} /> Usuń konfigurację</button></div></div>}
      </div>
      <div className="component-contact-sets" aria-label="Pary kontaktowe złożenia">
        <div className="component-section-title"><strong>Contact Sets</strong><span>{contactSets.length}</span></div>
        <div className="component-contact-list">
          {!contactSets.length && <p>Wskaż pary, które mają być stale monitorowane podczas ruchu złożenia.</p>}
          {contactSets.map((contactSet) => {
            const state = collisionResult.contactSets?.find((item) => item.id === contactSet.id);
            const firstName = instances.find((instance) => instance.id === contactSet.firstInstanceId)?.name || 'Brak';
            const secondName = instances.find((instance) => instance.id === contactSet.secondInstanceId)?.name || 'Brak';
            return <button className={`${selectedContactSet?.id === contactSet.id ? 'active' : ''} ${state?.status || ''}`} type="button" key={contactSet.id} onClick={() => onSelectContactSet(contactSet.id)}><Magnet size={14} /><span><strong>{contactSet.name}</strong><small>{firstName} ↔ {secondName}</small></span><em>{state?.status === 'exact' ? 'KONTAKT' : state?.status === 'broad-phase' ? 'RYZYKO' : contactSet.enabled ? 'LUZ' : 'OFF'}</em></button>;
          })}
        </div>
        {instances.length >= 2 && !selectedContactSet && <div className="component-contact-create"><select aria-label="Pierwsze wystąpienie Contact Set" value={contactFirstId} disabled={readOnly} onChange={(event) => setContactFirstId(event.target.value)}><option value="">Pierwsze wystąpienie</option>{instances.map((instance) => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select><select aria-label="Drugie wystąpienie Contact Set" value={contactSecondId} disabled={readOnly} onChange={(event) => setContactSecondId(event.target.value)}><option value="">Drugie wystąpienie</option>{instances.map((instance) => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select><button type="button" disabled={readOnly || !contactFirstId || !contactSecondId || contactFirstId === contactSecondId} onClick={() => { onCreateContactSet({ firstInstanceId: contactFirstId, secondInstanceId: contactSecondId }); setContactSecondId(''); }}><Plus size={14} /> Utwórz Contact Set</button></div>}
        {selectedContactSet && <div className="component-contact-properties"><label><span>Nazwa</span><input aria-label="Nazwa Contact Set" value={selectedContactSet.name} disabled={readOnly} onChange={(event) => onUpdateContactSet(selectedContactSet.id, { name: event.target.value })} /></label><div className="component-instance-toggles"><label><input type="checkbox" checked={selectedContactSet.enabled} disabled={readOnly} onChange={(event) => onUpdateContactSet(selectedContactSet.id, { enabled: event.target.checked })} /> Monitorowanie kontaktu aktywne</label></div><div className="component-actions"><button type="button" onClick={() => onSelectContactSet('')}><X size={14} /> Zamknij edycję</button><button className="danger" type="button" disabled={readOnly} onClick={() => { onDeleteContactSet(selectedContactSet.id); onSelectContactSet(''); }}><Trash2 size={14} /> Usuń Contact Set</button></div></div>}
      </div>
      <div className={`component-interference ${interferenceStatus}`} aria-label="Analiza kolizji wskazanych komponentów">
        <div className="component-section-title"><strong>Interference</strong><span>{interferenceStatusLabel}</span></div>
        <div className="component-interference-pair">
          <select aria-label="Pierwsze wystąpienie analizy Interference" value={interferenceFirstId} onChange={(event) => setInterferenceFirstId(event.target.value)}><option value="">Pierwszy komponent</option>{instances.map((instance) => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select>
          <select aria-label="Drugie wystąpienie analizy Interference" value={interferenceSecondId} onChange={(event) => setInterferenceSecondId(event.target.value)}><option value="">Drugi komponent</option>{instances.map((instance) => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select>
          <button type="button" disabled={!interferenceFirstId || !interferenceSecondId || interferenceFirstId === interferenceSecondId} onClick={() => { setInterferencePair([interferenceFirstId, interferenceSecondId]); onSelectInstance(interferenceFirstId); }}><ScanSearch size={14} /> Analizuj parę</button>
        </div>
        {interferenceResult && <div className="component-interference-result" role="status">
          {interferenceStatus === 'exact' ? <AlertOctagon size={16} /> : interferenceStatus === 'broad-phase' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <div><strong>{interferenceStatusLabel}</strong><small>{interferenceCollision ? `Nakładanie obwiedni: ${interferenceCollision.overlap.map((value) => value.toFixed(2)).join(' × ')} mm` : 'Dokładny test siatek nie wykrył przecięcia.'}</small></div>
        </div>}
        <p>Niebieskie zaznaczenie wskazuje pierwszy element pary. Czerwień potwierdza przecięcie siatek, a pomarańczowy oznacza wynik ograniczony do obwiedni.</p>
      </div>
      <div className={`component-collision-status ${collisionResult.collisions.length ? 'warning' : 'clear'}`} aria-label="Kontrola kolizji w ruchu" role="status">
        <div className="component-section-title"><strong>Kolizje w ruchu</strong><span>{collisionResult.collisions.length}</span></div>
        {collisionResult.collisions.length ? <><p><AlertOctagon size={15} /> Czerwony oznacza potwierdzone przecięcie siatek, a pomarańczowy ryzyko wykryte tylko przez obwiednie.</p>{collisionResult.collisions.slice(0, 4).map((collision) => <button className={collision.status === 'exact' ? 'exact' : 'risk'} type="button" key={`${collision.firstInstanceId}:${collision.secondInstanceId}`} onClick={() => onSelectInstance(collision.firstInstanceId)}><span>{collision.firstName} ↔ {collision.secondName}</span><strong>{collision.status === 'exact' ? 'KOLIZJA' : 'RYZYKO'} · obwiednia {collision.overlap.map((value) => value.toFixed(1)).join('×')} mm</strong></button>)}</> : <p><CheckCircle2 size={15} /> Brak kolizji w {collisionResult.checkedPairs || 0} sprawdzonych parach.</p>}
      </div>
      {selected ? <div className="component-properties">
        <div className="component-section-title"><strong>Właściwości</strong><span>{selected.type === 'assembly' ? 'ZŁOŻENIE' : 'CZĘŚĆ'}</span></div>
        {selectedLink && <div className={`linked-project-card ${selectedLinkStatus.state}`} data-linked-project-state={selectedLinkStatus.state}>
          <div><Link2 size={15} /><span><strong>Projekt linkowany</strong><small>{selectedLink.relativePath}</small></span><em>{linkedStateLabels[selectedLinkStatus.state]}</em></div>
          <p>{selectedLinkStatus.state === 'changed' ? 'Plik źródłowy zmienił się od ostatniego odświeżenia.' : selectedLinkStatus.state === 'missing' ? 'Nie znaleziono pliku pod zapisaną ścieżką.' : selectedLinkStatus.error || `Źródło: ${selectedLink.sourceName} · v${selectedLink.sourceSchemaVersion}`}</p>
          <footer><button type="button" data-linked-project-action="refresh" disabled={readOnly || selectedLinkStatus.state === 'checking' || selectedLinkStatus.state === 'missing'} onClick={() => onRefreshLinkedProject(selectedLink.id)}><RotateCcw size={13} /> Odśwież</button><button type="button" data-linked-project-action="repair" disabled={readOnly || selectedLinkStatus.state === 'checking'} onClick={() => onRepairLinkedProject(selectedLink.id)}><FolderOpen size={13} /> Napraw łącze</button></footer>
        </div>}
        <label><span>Nazwa</span><input aria-label="Nazwa komponentu" value={selected.name} disabled={readOnly} onChange={(event) => onUpdate(selected.id, { name: event.target.value })} /></label>
        <label><span>Numer części</span><input aria-label="Numer części komponentu" value={selected.partNumber} disabled={readOnly} onChange={(event) => onUpdate(selected.id, { partNumber: event.target.value })} /></label>
        <label><span>Typ</span><select aria-label="Typ komponentu" value={selected.type} disabled={readOnly || (selected.type === 'assembly' && selected.componentIds.length > 0)} onChange={(event) => onUpdate(selected.id, { type: event.target.value })}><option value="part">Część</option><option value="assembly">Złożenie</option></select></label>
        <label><span>Materiał</span><input aria-label="Materiał komponentu" value={selected.material} disabled={readOnly} placeholder="np. Aluminium 6061" onChange={(event) => onUpdate(selected.id, { material: event.target.value })} /></label>
        <div className="component-section-title"><strong>Wygląd modelu</strong><span>APPEARANCE</span></div>
        <div className="component-appearance-preview" style={{ '--appearance-color': selectedAppearance.color }}><span aria-hidden="true" /><div><strong>{COMPONENT_APPEARANCE_PRESETS.find((preset) => preset.id === selectedAppearance.preset)?.label || 'Własny'}</strong><small>{Math.round(selectedAppearance.metalness * 100)}% metal · {Math.round(selectedAppearance.roughness * 100)}% chropowatości</small></div></div>
        <label><span>Preset</span><select aria-label="Preset wyglądu komponentu" value={selectedAppearance.preset} disabled={readOnly} onChange={(event) => updateAppearancePreset(event.target.value)}>{selectedAppearance.preset === 'custom' && <option value="custom">Własny</option>}{COMPONENT_APPEARANCE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
        <label><span>Kolor</span><input aria-label="Kolor wyglądu komponentu" type="color" value={selectedAppearance.color} disabled={readOnly} onChange={(event) => updateAppearance({ color: event.target.value })} /></label>
        <label className="component-appearance-range"><span>Metaliczność</span><input aria-label="Metaliczność wyglądu komponentu" type="range" min="0" max="1" step="0.01" value={selectedAppearance.metalness} disabled={readOnly} onChange={(event) => updateAppearance({ metalness: Number(event.target.value) })} /><output>{Math.round(selectedAppearance.metalness * 100)}%</output></label>
        <label className="component-appearance-range"><span>Chropowatość</span><input aria-label="Chropowatość wyglądu komponentu" type="range" min="0" max="1" step="0.01" value={selectedAppearance.roughness} disabled={readOnly} onChange={(event) => updateAppearance({ roughness: Number(event.target.value) })} /><output>{Math.round(selectedAppearance.roughness * 100)}%</output></label>
        <label><span>Ilość</span><input aria-label="Ilość komponentu" type="number" min="1" max="9999" value={selected.quantity} disabled={readOnly} onChange={(event) => onUpdate(selected.id, { quantity: event.target.value })} /></label>
        <label><span>Nadrzędne</span><select aria-label="Złożenie nadrzędne" value={parentId} disabled={readOnly} onChange={(event) => onMove(selected.id, event.target.value)}><option value="">Poziom główny</option>{document.components.filter((component) => !excludedParents.has(component.id)).map((component) => <option key={component.id} value={component.id}>{component.name}</option>)}</select></label>
        <label className="component-description"><span>Opis</span><textarea aria-label="Opis komponentu" value={selected.description} disabled={readOnly} rows="2" onChange={(event) => onUpdate(selected.id, { description: event.target.value })} /></label>
        <div className="component-section-title"><strong>Początek komponentu</strong><span>mm</span></div>
        <div className="component-origin">{['x', 'y', 'z'].map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input aria-label={`Początek ${axis.toUpperCase()}`} type="number" step="0.1" value={selected.origin[axis]} disabled={readOnly} onChange={(event) => updateOrigin(axis, event.target.value)} /></label>)}</div>
        <div className="component-section-title"><strong>Przypisane bryły</strong><span>{selected.bodyIds.length}</span></div>
        <div className="component-body-list">
          {!bodies.length && <p>Model nie zawiera jeszcze brył.</p>}
          {bodies.map((body) => <label key={body.id}><input type="checkbox" checked={selected.bodyIds.includes(body.id)} disabled={readOnly || selected.type === 'assembly' || Boolean(selectedLink)} onChange={(event) => toggleBody(body.id, event.target.checked)} /><span>{body.name || body.id}</span></label>)}
        </div>
        <div className="component-actions"><button type="button" disabled={readOnly} onClick={() => onCreateInstance(selected.id)}><Plus size={14} /> Wstaw kolejne</button><button type="button" disabled={readOnly || !selectedBodyIds.length || selected.type === 'assembly'} onClick={() => onAssignBodies(selected.id, selectedBodyIds)}><Check size={14} /> Przypisz zaznaczone ({selectedBodyIds.length})</button><button className="danger" type="button" data-component-action="delete" disabled={readOnly} onClick={() => onDelete(selected.id)}><Trash2 size={14} /> Usuń</button></div>
      </div> : <div className="component-empty"><Boxes size={25} /><strong>Wybierz komponent</strong><p>Właściwości, origin i przypisania brył pojawią się tutaj.</p></div>}
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
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('WSZYSTKIE');
  const validation = validateCommandCustomization(draft);
  const rows = commandCustomizationRows(draft);
  const categories = [...new Set(rows.map((row) => row.category))];
  const normalizedQuery = query.trim().toLocaleLowerCase('pl');
  const visibleRows = rows.filter((row) => (
    (category === 'WSZYSTKIE' || row.category === category)
    && (!normalizedQuery || [row.label, row.alias, row.shortcut, ...row.builtInAliases].some((value) => String(value || '').toLocaleLowerCase('pl').includes(normalizedQuery)))
  ));
  const groups = visibleRows.reduce((result, row) => {
    const group = result.find((item) => item.category === row.category);
    if (group) group.rows.push(row);
    else result.push({ category: row.category, rows: [row] });
    return result;
  }, []);
  const primaryKey = window.desktopApp?.platform === 'darwin' ? '⌘' : 'Ctrl';
  const update = (label, key, value) => setDraft((current) => ({
    ...current,
    commands: { ...current.commands, [label]: { ...current.commands[label], [key]: value.toUpperCase().replace(/\s+/g, '') } },
  }));
  return (
    <aside className="measure-panel command-customization-panel" aria-label="Skróty i polecenia">
      <header><div><Keyboard size={16} /><strong>Skróty i polecenia</strong></div><button type="button" title="Zamknij ustawienia skrótów" aria-label="Zamknij ustawienia skrótów" onClick={onClose}><X size={15} /></button></header>
      <div className="command-shortcut-essentials" aria-label="Podstawowe skróty">
        <span><kbd>Esc</kbd>Anuluj</span>
        <span><kbd>Enter</kbd>Zatwierdź</span>
        <span><kbd>{primaryKey}+Enter</kbd>Zakończ szkic</span>
        <span><kbd>F3</kbd>Snap</span>
        <span><kbd>{primaryKey}+Z</kbd>Cofnij</span>
        <span><kbd>Delete</kbd>Usuń</span>
      </div>
      <div className="command-customization-filters">
        <label><Search size={14} aria-hidden="true" /><span className="sr-only">Szukaj polecenia</span><input type="search" value={query} placeholder="Szukaj polecenia lub aliasu" onChange={(event) => setQuery(event.target.value)} /></label>
        <label><span className="sr-only">Kategoria poleceń</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="WSZYSTKIE">Wszystkie kategorie</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <div className="command-customization-intro"><p>Wpisz alias w linii poleceń i naciśnij Enter. Pojedynczy klawisz uruchamia narzędzie od razu.</p><div><span>Polecenie</span><span>Alias</span><span>Klawisz</span></div></div>
      <div className="command-customization-list">
        {groups.map((group) => <section className="command-customization-category" key={group.category} aria-label={group.category}>
          <h3>{group.category}</h3>
          {group.rows.map((row) => <div className="command-customization-row" key={row.label}><strong>{row.label}</strong><input aria-label={`Alias polecenia ${row.label}`} value={row.alias} maxLength={16} onChange={(event) => update(row.label, 'alias', event.target.value)} /><input aria-label={`Klawisz polecenia ${row.label}`} value={row.shortcut} maxLength={3} placeholder="—" onChange={(event) => update(row.label, 'shortcut', event.target.value)} /></div>)}
        </section>)}
        {!groups.length && <p className="command-customization-empty">Brak poleceń pasujących do wyszukiwania.</p>}
      </div>
      {!!validation.errors.length && <div className="command-customization-errors" role="alert">{validation.errors.slice(0, 4).map((error) => <span key={error}>{error}</span>)}</div>}
      <footer><button type="button" onClick={() => { const reset = onReset(); setDraft(structuredClone(reset)); }}><RotateCcw size={14} /> Przywróć skróty Autodesk</button><button className="confirm" type="button" disabled={!validation.valid} onClick={() => onSave(validation.customization)}><Check size={14} /> Zapisz</button></footer>
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

export function GeometryInspectionPanel({ result, draftDirection = 'z-positive', draftTolerance = '0.5', onChange, onClose }) {
  const draft = result.draft;
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
        <div className="draft-analysis-section">
          <strong>Analiza pochylenia ścian</strong>
          <label><span>Kierunek wyciągania</span><select value={draftDirection} onChange={(event) => onChange?.({ draftDirection: event.target.value })}><option value="x-positive">+X</option><option value="x-negative">−X</option><option value="y-positive">+Y</option><option value="y-negative">−Y</option><option value="z-positive">+Z</option><option value="z-negative">−Z</option></select></label>
          <Field label="Tolerancja" value={draftTolerance} onChange={(value) => onChange?.({ draftTolerance: value })} suffix="°" />
          <div className="draft-analysis-legend" aria-label="Legenda analizy pochylenia">
            {[['positive', 'Dodatnie'], ['neutral', 'Zerowe'], ['negative', 'Ujemne'], ['mixed', 'Mieszane']].map(([classification, label]) => <div key={classification} className={classification}><span aria-hidden="true" /><em>{label}</em><strong>{draft?.counts?.[classification] || 0}</strong></div>)}
          </div>
          {draft?.unsupportedBodies?.length > 0 && <p>Brak mapy ścian dla {draft.unsupportedBodies.length} zaimportowanej siatki.</p>}
        </div>
      </div>
    </aside>
  );
}

export function SurfaceAnalysisPanel({ analysis, continuity, curvature, onChange, onClose }) {
  const counts = continuity?.counts || { smooth: 0, warning: 0, sharp: 0 };
  return (
    <aside className="measure-panel surface-analysis-panel" aria-label="Analiza powierzchni">
      <header><div><ScanSearch size={16} /><strong>Analiza powierzchni</strong></div><button type="button" title="Zamknij analizę powierzchni" aria-label="Zamknij analizę powierzchni" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        <label className="command-field"><span>Tryb widoku</span><select value={analysis.mode} onChange={(event) => onChange({ mode: event.target.value })}><option value="zebra">Zebra ciągłości</option><option value="curvature">Mapa krzywizny</option><option value="comb">Grzebień krzywizny</option><option value="isocurves">Izolinie XYZ</option></select></label>
        {analysis.mode === 'zebra' && <Field label="Gęstość pasów" type="number" value={analysis.bands} onChange={(bands) => onChange({ bands })} />}
        {analysis.mode === 'curvature' && <>
          <Field label="Górny zakres" type="number" value={analysis.curvatureMax} onChange={(curvatureMax) => onChange({ curvatureMax })} suffix="1/mm" />
          <div className="curvature-map-legend" aria-label="Legenda mapy krzywizny"><span><i /><i /><i /><i /></span><div><em>0 · płasko</em><em>{Number(analysis.curvatureMax || 0.2).toLocaleString('pl-PL')} 1/mm</em></div></div>
          <div className="measure-row"><span>Największa w modelu</span><strong>{Number(curvature?.maximum || 0).toLocaleString('pl-PL', { maximumFractionDigits: 5 })} 1/mm</strong></div>
        </>}
        {analysis.mode === 'isocurves' && <>
          <label className="command-field"><span>Oś przekrojów</span><select value={analysis.isocurveAxis} onChange={(event) => onChange({ isocurveAxis: event.target.value })}><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
          <Field label="Rozstaw" type="number" value={analysis.isocurveSpacing} onChange={(isocurveSpacing) => onChange({ isocurveSpacing })} suffix="mm" />
        </>}
        {analysis.mode === 'comb' && <Field label="Wzmocnienie" type="number" value={analysis.combScale} onChange={(combScale) => onChange({ combScale })} suffix="×" />}
        <label className="section-toggle"><input type="checkbox" checked={analysis.showEdges} onChange={(event) => onChange({ showEdges: event.target.checked })} /><span>Pokaż krawędzie B-Rep</span></label>
        <div className="surface-continuity-summary" aria-label="Diagnostyka ciągłości siatki powierzchni">
          <strong>Granice ścian</strong>
          <div className="surface-continuity-row smooth"><span aria-hidden="true" /><em>Płynne ≤ 2°</em><strong>{counts.smooth}</strong></div>
          <div className="surface-continuity-row warning"><span aria-hidden="true" /><em>Przejściowe 2–8°</em><strong>{counts.warning}</strong></div>
          <div className="surface-continuity-row sharp"><span aria-hidden="true" /><em>Ostre &gt; 8°</em><strong>{counts.sharp}</strong></div>
        </div>
        {continuity?.unsupportedBodyIds?.length > 0 && <p>Bez diagnostyki: {continuity.unsupportedBodyIds.length} elementów bez mapy ścian lub normalnych.</p>}
        {analysis.mode === 'zebra' && <p>Pasy reagują na obrót kamery. Załamanie wzoru ujawnia zmianę styczności.</p>}
        {analysis.mode === 'curvature' && <p>Kolor pokazuje zmianę normalnej na jednostkę długości: niebieski oznacza obszar płaski, czerwony największą krzywiznę zakresu.</p>}
        {analysis.mode === 'comb' && <p>Turkusowe odcinki pokazują kierunek i względną wielkość zmiany stycznej na próbkowanych krawędziach krzywoliniowych.</p>}
        {analysis.mode === 'isocurves' && <p>Linie pokazują przecięcia modelu z równoległymi płaszczyznami wybranej osi i pomagają ocenić przebieg powierzchni.</p>}
        <p>Analiza nie zmienia modelu ani historii.</p>
      </div>
    </aside>
  );
}

export function MeshToolsPanel({ body, report, groups = [], readOnly = false, onRepair, onReduce, onSmooth, onGroup, onClose }) {
  const [reduction, setReduction] = React.useState('50');
  const [iterations, setIterations] = React.useState('2');
  const [strength, setStrength] = React.useState('25');
  const [featureAngle, setFeatureAngle] = React.useState('30');
  const clean = report && !report.degenerateTriangles && !report.duplicateTriangles;
  return (
    <aside className="measure-panel mesh-tools-panel" aria-label="Diagnostyka i naprawa siatki">
      <header><div><ScanSearch size={16} /><strong>Narzędzia siatki</strong></div><button type="button" title="Zamknij narzędzia siatki" aria-label="Zamknij narzędzia siatki" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        <strong>{body?.name || 'Siatka'}</strong>
        <div className="mesh-diagnostics-grid">
          <div><span>Wierzchołki</span><strong>{report?.vertexCount?.toLocaleString('pl-PL') || 0}</strong></div>
          <div><span>Trójkąty</span><strong>{report?.triangleCount?.toLocaleString('pl-PL') || 0}</strong></div>
          <div><span>Zdegenerowane</span><strong>{report?.degenerateTriangles || 0}</strong></div>
          <div><span>Powtórzone</span><strong>{report?.duplicateTriangles || 0}</strong></div>
          <div><span>Otwarte brzegi</span><strong>{report?.boundaryEdges || 0}</strong></div>
          <div><span>Niemanifold</span><strong>{report?.nonManifoldEdges || 0}</strong></div>
        </div>
        <p>Naprawa scala duplikaty i usuwa niebezpieczne trójkąty. Nie wypełnia otworów.</p>
        <button className="mesh-action-button primary" type="button" disabled={readOnly || !report || clean} onClick={onRepair}><RotateCcw size={14} />{clean ? 'Geometria jest oczyszczona' : 'Bezpieczna naprawa'}</button>
        <section className="mesh-operation-section">
          <header><strong>Redukcja</strong><span>Mniej trójkątów</span></header>
          <div className="mesh-operation-controls"><Field label="Pozostaw" type="number" value={reduction} onChange={setReduction} suffix="%" /><button type="button" disabled={readOnly || !report || report.triangleCount < 2} onClick={() => onReduce(Number(reduction) / 100)}>Redukuj</button></div>
        </section>
        <section className="mesh-operation-section">
          <header><strong>Wygładzanie</strong><span>Otwarte brzegi chronione</span></header>
          <div className="mesh-operation-controls two-fields"><Field label="Kroki" type="number" value={iterations} onChange={setIterations} /><Field label="Siła" type="number" value={strength} onChange={setStrength} suffix="%" /><button type="button" disabled={readOnly || !report} onClick={() => onSmooth({ iterations: Number(iterations), strength: Number(strength) / 100, preserveBoundary: true })}>Wygładź</button></div>
        </section>
        <section className="mesh-operation-section">
          <header><strong>Grupy ścian</strong><span>{groups.length ? (groups.length === 1 ? '1 grupa' : `${groups.length} grup`) : 'Nie wyznaczono'}</span></header>
          <div className="mesh-operation-controls"><Field label="Kąt cechy" type="number" value={featureAngle} onChange={setFeatureAngle} suffix="°" /><button type="button" disabled={readOnly || !report} onClick={() => onGroup(Number(featureAngle))}>Grupuj</button></div>
          {groups.length > 0 && <div className="mesh-group-summary"><span>Największa grupa</span><strong>{groups[0].triangleCount.toLocaleString('pl-PL')} trójkątów</strong></div>}
        </section>
        <p>Każda operacja trafia do projektu osobno; Cofnij przywraca poprzednią siatkę.</p>
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
  const dialogRef = useDialogFocus(Boolean(draft));
  if (!draft) return null;
  return (
    <section ref={dialogRef} className="command-dialog import-model-dialog" role="dialog" aria-modal="true" aria-labelledby="importModelDialogTitle" tabIndex="-1">
      <header><strong id="importModelDialogTitle">Import modelu 3D</strong><button type="button" onClick={onCancel} title="Zamknij" aria-label="Zamknij import modelu 3D"><X size={15} /></button></header>
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
  const dialogRef = useDialogFocus(Boolean(draft));
  if (!draft) return null;
  return (
    <section ref={dialogRef} className="command-dialog import-sketch-dialog" role="dialog" aria-modal="true" aria-labelledby="importSketchDialogTitle" tabIndex="-1">
      <header><strong id="importSketchDialogTitle">Import geometrii szkicu</strong><button type="button" onClick={onCancel} title="Zamknij" aria-label="Zamknij import geometrii szkicu"><X size={15} /></button></header>
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
  const dialogRef = useDialogFocus(Boolean(report));
  if (!report) return null;
  const iconFor = (status) => status === 'changed' ? AlertTriangle : status === 'skipped' ? XCircle : CheckCircle2;
  return (
    <section ref={dialogRef} className="command-dialog import-repair-report" role="dialog" aria-modal="true" aria-labelledby="importRepairReportTitle" tabIndex="-1">
      <header><strong id="importRepairReportTitle">Raport importu</strong><button type="button" onClick={onClose} title="Zamknij raport" aria-label="Zamknij raport"><X size={15} /></button></header>
      <div className="import-report-heading"><div><strong>{report.fileName}</strong><span>{report.format.toUpperCase()} · {report.sourceUnit || 'jednostka automatyczna'}</span></div><CheckCircle2 size={20} /></div>
      <div className="import-report-summary" role="group" aria-label="Podsumowanie raportu">
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
  const dialogRef = useDialogFocus(command?.type === 'sketchDimension');
  if (command?.type !== 'sketchDimension') return null;
  const titles = {
    ordinateX: 'Wymiar ordinate X',
    ordinateY: 'Wymiar ordinate Y',
    arcLength: 'Wymiar długości łuku',
  };
  return (
    <section ref={dialogRef} className="command-dialog sketch-dimension-dialog" role="dialog" aria-modal="true" aria-labelledby="sketchDimensionDialogTitle" tabIndex="-1">
      <header><strong id="sketchDimensionDialogTitle">{titles[command.dimensionType]}</strong><button type="button" onClick={onCancel} title="Zamknij" aria-label="Zamknij wymiar szkicu"><X size={15} /></button></header>
      <div className="command-dialog-body">
        <Field label="Wartość" value={command.value} onChange={(value) => onChange({ value })} suffix="mm" autoFocus />
        <div className="command-preview-note"><span className="preview-dot" />Wymiar steruje geometrią i można go później zmienić bezpośrednio na szkicu.</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> Dodaj wymiar</button></footer>
    </section>
  );
}
