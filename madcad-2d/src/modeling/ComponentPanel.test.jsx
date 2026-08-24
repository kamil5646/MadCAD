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
];

function panelProps(overrides = {}) {
  return {
    document: { components, componentInstances, rigidGroups: [], sketches: [], references: [] },
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
});

describe('ProjectBrowser components', () => {
  it('shows the nested assembly tree and selects a component', () => {
    const onSelect = vi.fn();
    render(<ProjectBrowser document={{ id: 'document-1', name: 'Projekt', components, componentInstances, rigidGroups: [], sketches: [], references: [] }} bodies={[]} selection={{ kind: 'document', id: 'document-1' }} onSelect={onSelect} onToggleReference={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Zaznacz wystąpienie złożenia Wspornik/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Zaznacz wystąpienie części Rama/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'componentInstance', id: 'occurrence-part', componentId: 'part-1' });
  });
});
