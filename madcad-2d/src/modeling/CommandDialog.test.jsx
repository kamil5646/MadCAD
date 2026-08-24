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
});
