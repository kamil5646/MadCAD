import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComponentPanel } from './WorkspacePanels.jsx';
import { ProjectBrowser } from './WorkspaceOverlays.jsx';

const components = [
  { id: 'assembly-1', name: 'Wspornik', type: 'assembly', partNumber: 'A-001', description: '', material: '', quantity: 1, origin: { x: 0, y: 0, z: 0 }, bodyIds: [], sketchIds: [], componentIds: ['part-1'] },
  { id: 'part-1', name: 'Rama', type: 'part', partNumber: 'P-001', description: 'Rama główna', material: 'S355', quantity: 2, origin: { x: 1, y: 2, z: 3 }, bodyIds: ['body-1'], sketchIds: [], componentIds: [] },
];
const identity = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0 };
const componentInstances = [
  { id: 'occurrence-assembly', componentId: 'assembly-1', parentInstanceId: '', name: 'Wspornik', transform: identity, grounded: true, visible: true, primary: true },
  { id: 'occurrence-part', componentId: 'part-1', parentInstanceId: 'occurrence-assembly', name: 'Rama:1', transform: identity, grounded: false, visible: true, primary: true },
  { id: 'occurrence-part-2', componentId: 'part-1', parentInstanceId: 'occurrence-assembly', name: 'Rama:2', transform: { ...identity, x: 25 }, grounded: false, visible: true, primary: false },
];
const joints = [
  { id: 'joint-1', name: 'Obrót ramy', type: 'revolute', referenceInstanceId: 'occurrence-part', movingInstanceId: 'occurrence-part-2', axis: 'z', axisReference: { kind: 'component-origin-axis', instanceId: 'occurrence-part', axis: 'z' }, anchor: { x: 0, y: 0, z: 0 }, limits: { enabled: true, min: -30, max: 60 }, value: 15, restTransform: { ...identity, x: 25 }, enabled: true },
  { id: 'joint-2', name: 'Suwak osłony', type: 'slider', referenceInstanceId: 'occurrence-part-2', movingInstanceId: 'occurrence-part', axis: 'x', axisReference: { kind: 'component-origin-axis', instanceId: 'occurrence-part-2', axis: 'x' }, anchor: { x: 0, y: 0, z: 0 }, limits: { enabled: true, min: 0, max: 100 }, value: 20, restTransform: identity, enabled: true },
];

function panelProps(overrides = {}) {
  return {
    document: { components, componentInstances, rigidGroups: [], joints: [], motionLinks: [], contactSets: [], assemblyConfigurations: [], activeAssemblyConfigurationId: '', sketches: [], references: [] },
    bodies: [{ id: 'body-1', name: 'Bryła ramy' }, { id: 'body-2', name: 'Pokrywa' }],
    selectedComponentId: 'part-1',
    selectedBodyIds: ['body-2'],
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
    onAssignBodies: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onSelect: vi.fn(),
    onSelectInstance: vi.fn(),
    onCreateInstance: vi.fn(),
    onUpdateInstance: vi.fn(),
    onDuplicateInstance: vi.fn(),
    onDeleteInstance: vi.fn(),
    onCreateRigidGroup: vi.fn(),
    onDeleteRigidGroup: vi.fn(),
    onSelectJoint: vi.fn(),
    onCreateJoint: vi.fn(),
    onUpdateJoint: vi.fn(),
    onSetJointValue: vi.fn(),
    onDeleteJoint: vi.fn(),
    onSelectMotionLink: vi.fn(),
    onCreateMotionLink: vi.fn(),
    onUpdateMotionLink: vi.fn(),
    onDeleteMotionLink: vi.fn(),
    onSelectConfiguration: vi.fn(),
    onCreateConfiguration: vi.fn(),
    onUpdateConfiguration: vi.fn(),
    onApplyConfiguration: vi.fn(),
    onDeleteConfiguration: vi.fn(),
    onSelectContactSet: vi.fn(),
    onCreateContactSet: vi.fn(),
    onUpdateContactSet: vi.fn(),
    onDeleteContactSet: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('ComponentPanel', () => {
  it('creates parts and assemblies and edits professional component properties', () => {
    const props = panelProps();
    render(<ComponentPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Nowa część/i }));
    fireEvent.click(screen.getByRole('button', { name: /Nowe złożenie/i }));
    expect(props.onCreate.mock.calls.map(([type]) => type)).toEqual(['part', 'assembly']);
    fireEvent.change(screen.getByRole('textbox', { name: /Materiał komponentu/i }), { target: { value: 'Aluminium' } });
    expect(props.onUpdate).toHaveBeenCalledWith('part-1', { material: 'Aluminium' });
    fireEvent.change(screen.getByRole('combobox', { name: /Złożenie nadrzędne/i }), { target: { value: '' } });
    expect(props.onMove).toHaveBeenCalledWith('part-1', '');
  });

  it('edits occurrence placement, Ground and duplication independently from the definition', () => {
    const props = panelProps({ selectedInstanceId: 'occurrence-part' });
    render(<ComponentPanel {...props} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /Położenie X/i }), { target: { value: '25' } });
    expect(props.onUpdateInstance).toHaveBeenCalledWith('occurrence-part', { transform: { x: 25 } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Ground/i }));
    expect(props.onUpdateInstance).toHaveBeenCalledWith('occurrence-part', { grounded: true });
    fireEvent.click(screen.getByRole('button', { name: /Powiel/i }));
    expect(props.onDuplicateInstance).toHaveBeenCalledWith('occurrence-part');
  });

  it('assigns selected bodies and exposes an explicit delete action', () => {
    const props = panelProps();
    render(<ComponentPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Przypisz zaznaczone/i }));
    expect(props.onAssignBodies).toHaveBeenCalledWith('part-1', ['body-2']);
    fireEvent.click(screen.getByRole('button', { name: /^Usuń$/i }));
    expect(props.onDelete).toHaveBeenCalledWith('part-1');
  });

  it('creates a revolute joint between sibling occurrences', () => {
    const props = panelProps({ selectedInstanceId: 'occurrence-part-2' });
    render(<ComponentPanel {...props} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Bazowe wystąpienie jointa/i }), { target: { value: 'occurrence-part' } });
    fireEvent.click(screen.getByRole('button', { name: /Utwórz joint/i }));
    expect(props.onCreateJoint).toHaveBeenCalledWith({ type: 'revolute', axis: 'z', referenceInstanceId: 'occurrence-part', movingInstanceId: 'occurrence-part-2' });
  });

  it('edits joint limits and motion without obscuring it with occurrence placement', () => {
    const props = panelProps({ document: { components, componentInstances, rigidGroups: [], joints, motionLinks: [], assemblyConfigurations: [], activeAssemblyConfigurationId: '', sketches: [], references: [] }, selectedInstanceId: 'occurrence-part-2', selectedJointId: 'joint-1' });
    render(<ComponentPanel {...props} />);
    expect(screen.queryByRole('spinbutton', { name: /Położenie X/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: /Numeryczna wartość jointa/i }), { target: { value: '35' } });
    expect(props.onSetJointValue).toHaveBeenCalledWith('joint-1', 35);
    fireEvent.change(screen.getByRole('spinbutton', { name: /Maksymalny limit jointa/i }), { target: { value: '90' } });
    expect(props.onUpdateJoint).toHaveBeenCalledWith('joint-1', { limits: { max: 90 } });
    fireEvent.click(screen.getByRole('button', { name: /Usuń joint/i }));
    expect(props.onDeleteJoint).toHaveBeenCalledWith('joint-1');
  });

  it('creates a Motion Link and saves a configuration without duplicating component definitions', () => {
    const props = panelProps({ document: { components, componentInstances, rigidGroups: [], joints, motionLinks: [], assemblyConfigurations: [], activeAssemblyConfigurationId: '', sketches: [], references: [] } });
    render(<ComponentPanel {...props} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Źródłowy joint Motion Link/i }), { target: { value: 'joint-1' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Docelowy joint Motion Link/i }), { target: { value: 'joint-2' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Przełożenie Motion Link$/i }), { target: { value: '-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Utwórz Motion Link/i }));
    expect(props.onCreateMotionLink).toHaveBeenCalledWith({ sourceJointId: 'joint-1', targetJointId: 'joint-2', ratio: -2, offset: 0 });
    fireEvent.change(screen.getByRole('textbox', { name: /Nazwa nowej konfiguracji/i }), { target: { value: 'Transport' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz nową/i }));
    expect(props.onCreateConfiguration).toHaveBeenCalledWith({ name: 'Transport' });
  });

  it('reports moving assembly collisions and selects the first occurrence', () => {
    const props = panelProps({ collisionResult: { checkedPairs: 1, collisions: [{ firstInstanceId: 'occurrence-part', secondInstanceId: 'occurrence-part-2', firstName: 'Rama:1', secondName: 'Rama:2', overlap: [5, 5, 5], overlapVolume: 125, status: 'exact' }] } });
    render(<ComponentPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Rama:1.*Rama:2/i }));
    expect(props.onSelectInstance).toHaveBeenCalledWith('occurrence-part');
  });

  it('runs Interference only for the two indicated occurrences', () => {
    const cube = {
      id: 'body-1',
      metrics: { bounds: [[0, 0, 0], [10, 10, 10]] },
      vertices: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10],
      triangles: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7],
    };
    const props = panelProps({ bodies: [cube] });
    render(<ComponentPanel {...props} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Pierwsze wystąpienie analizy Interference/i }), { target: { value: 'occurrence-part' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Drugie wystąpienie analizy Interference/i }), { target: { value: 'occurrence-part-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Analizuj parę/i }));
    expect(screen.getAllByText(/BRAK KOLIZJI/i).length).toBeGreaterThan(0);
    expect(props.onSelectInstance).toHaveBeenCalledWith('occurrence-part');
  });

  it('creates a persistent Contact Set for two occurrences', () => {
    const props = panelProps();
    render(<ComponentPanel {...props} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Pierwsze wystąpienie Contact Set/i }), { target: { value: 'occurrence-part' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Drugie wystąpienie Contact Set/i }), { target: { value: 'occurrence-part-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Utwórz Contact Set/i }));
    expect(props.onCreateContactSet).toHaveBeenCalledWith({ firstInstanceId: 'occurrence-part', secondInstanceId: 'occurrence-part-2' });
  });
});

describe('ProjectBrowser components', () => {
  it('shows the nested assembly tree and selects a component', () => {
    const onSelect = vi.fn();
    const motionLinks = [{ id: 'motion-1', name: 'Przełożenie testowe', sourceJointId: 'joint-1', targetJointId: 'joint-2', ratio: -2, offset: 0, enabled: true }];
    const contactSets = [{ id: 'contact-1', name: 'Kontakt ram', firstInstanceId: 'occurrence-part', secondInstanceId: 'occurrence-part-2', enabled: true }];
    const assemblyConfigurations = [{ id: 'configuration-1', name: 'Transport', description: '', instanceStates: [], jointStates: [] }];
    render(<ProjectBrowser document={{ id: 'document-1', name: 'Projekt', components, componentInstances, rigidGroups: [], joints, motionLinks, contactSets, assemblyConfigurations, activeAssemblyConfigurationId: 'configuration-1', sketches: [], references: [] }} bodies={[]} selection={{ kind: 'document', id: 'document-1' }} onSelect={onSelect} onToggleReference={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Zaznacz wystąpienie złożenia Wspornik/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Zaznacz wystąpienie części Rama:1\./i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'componentInstance', id: 'occurrence-part', componentId: 'part-1' });
    fireEvent.click(screen.getByRole('button', { name: /Obrót ramy/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'joint', id: 'joint-1', movingInstanceId: 'occurrence-part-2' });
    fireEvent.click(screen.getByRole('button', { name: /Przełożenie testowe/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'motionLink', id: 'motion-1' });
    fireEvent.click(screen.getByRole('button', { name: /Kontakt ram/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'contactSet', id: 'contact-1' });
    fireEvent.click(screen.getByRole('button', { name: /Transport/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'assemblyConfiguration', id: 'configuration-1' });
  });
});
