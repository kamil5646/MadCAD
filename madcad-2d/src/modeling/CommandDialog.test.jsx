import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandDialog } from './CommandDialog.jsx';

const initialHole = {
  type: 'hole',
  holeType: 'simple',
  extent: 'distance',
  diameter: '5',
  depth: '10',
  counterboreDiameter: '9',
  counterboreDepth: '3',
  countersinkDiameter: '10',
  countersinkAngle: '90',
  threadMode: 'none',
  threadDiameter: '6',
  threadPitch: '1',
  threadLength: '8',
  threadDirection: 'right',
  holeStandard: 'custom',
  holeApplication: 'custom',
  standardSize: 'M6',
  clearanceClass: 'medium',
  threadClass: '6H',
  clearanceProfile: 'nominal',
  clearance: '0.2',
  previewFeature: { id: 'preview-hole' },
};

function HoleDialogHarness() {
  const [command, setCommand] = useState(initialHole);
  return <CommandDialog command={command} collapsed={false} dock="right" onChange={(patch) => setCommand((current) => ({ ...current, ...patch }))} onConfirm={vi.fn()} onCancel={vi.fn()} onToggleCollapsed={vi.fn()} onToggleDock={vi.fn()} />;
}

describe('CommandDialog standard holes', () => {
  it('applies ISO metric tapped and ISO 273 clearance dimensions from one choice', () => {
    render(<HoleDialogHarness />);
    fireEvent.change(screen.getByLabelText('Zastosowanie'), { target: { value: 'tapped' } });
    expect(screen.getByRole('textbox', { name: /Średnica wiertła/ })).toHaveValue('5');
    expect(screen.getByRole('textbox', { name: /Średnica wiertła/ })).toBeDisabled();
    expect(screen.getByLabelText('Skok gwintu')).toHaveValue('1');
    expect(screen.getByLabelText('Klasa gwintu')).toHaveValue('6H');
    expect(screen.queryByLabelText('Profil luzu')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rozmiar śruby / gwintu'), { target: { value: 'M8' } });
    expect(screen.getByRole('textbox', { name: /Średnica wiertła/ })).toHaveValue('6.75');
    fireEvent.change(screen.getByLabelText('Skok gwintu'), { target: { value: '1' } });
    expect(screen.getByRole('textbox', { name: /Średnica wiertła/ })).toHaveValue('7');

    fireEvent.change(screen.getByLabelText('Zastosowanie'), { target: { value: 'clearance-medium' } });
    expect(screen.getByRole('textbox', { name: /^Średnica.*mm/ })).toHaveValue('9');
    expect(screen.queryByLabelText('Gwint')).not.toBeInTheDocument();
  });

  it('shows NPT/BSPT taper, TPI, preparation and explicit manufacturing tolerances', () => {
    render(<HoleDialogHarness />);
    fireEvent.change(screen.getByLabelText('Zastosowanie'), { target: { value: 'npt-tapped' } });
    expect(screen.getByLabelText('Rozmiar śruby / gwintu')).toHaveValue('npt-1-8');
    expect(screen.getByRole('textbox', { name: /Średnica przy wejściu/ })).toHaveValue('8.74');
    expect(screen.getByRole('textbox', { name: /Stożek średnicy/ })).toHaveValue('1:16');
    expect(screen.getByRole('textbox', { name: /Zwoje na cal/ })).toHaveValue('27');
    expect(screen.getByRole('textbox', { name: /Sprawdzian/ })).toHaveValue('ASME B1.20.1');
    fireEvent.change(screen.getByLabelText('Przygotowanie otworu'), { target: { value: 'cylindrical' } });
    expect(screen.getByRole('textbox', { name: /Średnica przy wejściu/ })).toHaveValue('8.4');
    fireEvent.change(screen.getByLabelText('Zastosowanie'), { target: { value: 'bspt-tapped' } });
    expect(screen.getByLabelText('Rozmiar śruby / gwintu')).toHaveValue('bspt-1-8');
    expect(screen.getByRole('textbox', { name: /Sprawdzian/ })).toHaveValue('ISO 7-2');
    expect(screen.getByRole('textbox', { name: /Odchyłka dolna/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Odchyłka górna/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Zastosowanie'), { target: { value: 'tapped' } });
    expect(screen.getByLabelText('Rozmiar śruby / gwintu')).toHaveValue('M6');
  });
});

describe('CommandDialog confirmation', () => {
  it('edits a 3D path segment using explicit XYZ coordinates', () => {
    const onChange = vi.fn();
    const onConfirm = vi.fn();
    render(<CommandDialog
      command={{ type: 'sketch3d', startX: '0', startY: '0', startZ: '0', endX: '20', endY: '5', endZ: '10', pointIds: [], segmentIds: [] }}
      collapsed={false}
      dock="right"
      onChange={onChange}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
      onUndoSegment={vi.fn()}
      onFinishPath={vi.fn()}
      onToggleCollapsed={vi.fn()}
      onToggleDock={vi.fn()}
    />);
    expect(screen.getByRole('textbox', { name: /Początek Z/ })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Koniec Z/ }), { target: { value: '18' } });
    expect(onChange).toHaveBeenCalledWith({ endZ: '18' });
    fireEvent.click(screen.getByRole('button', { name: /Dodaj odcinek/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('confirms exact sketch data without leaking the click event into the command', () => {
    const onConfirm = vi.fn();
    render(<CommandDialog
      command={{ type: 'rectangle', name: 'Prostokąt', definition: 'center', width: '40', height: '20', x: '0', y: '0', rotation: '0', gesturePoints: [] }}
      collapsed={false}
      dock="right"
      onChange={vi.fn()}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
      onToggleCollapsed={vi.fn()}
      onToggleDock={vi.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Utwórz z danych/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]).toEqual([]);
  });
});
