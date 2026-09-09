import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SolidFeaPanel } from './WorkspacePanels.jsx';

describe('SolidFeaPanel', () => {
  it('shows the verified linear scope, mesh quality and equilibrium without claiming certification', () => {
    const onChange = vi.fn();
    render(<SolidFeaPanel bodies={[{ id: 'body-1', name: 'Wspornik' }]} bodyId="body-1" result={{ status: 'safe', nodeCount: 63, elementCount: 144, fixedNodeCount: 9, loadedNodeCount: 9, maximumDisplacement: 0.01234, maximumStress: 42.5, safetyFactor: 5.52, volumeErrorPercent: 1.25, equilibriumErrorPercent: 0.0001, iterationCount: 87, adaptation: { addedPlaneCount: 4 }, verification: { status: 'verified' }, limitations: ['Zakres liniowy.'] }} onChange={onChange} onClose={vi.fn()} />);
    expect(screen.getByRole('complementary', { name: /Liniowy MES bryły 3D/i })).toBeInTheDocument();
    expect(screen.getByText(/63 węzłów · 144 elem/i)).toBeInTheDocument();
    expect(screen.getByText(/Błąd objętości siatki/i)).toBeInTheDocument();
    expect(screen.getByText(/Błąd równowagi sił/i)).toBeInTheDocument();
    expect(screen.getByText('Zakres liniowy.')).toBeInTheDocument();
    expect(screen.getByText('Zweryfikowany')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Gęstość siatki'), { target: { value: '8' } });
    expect(onChange).toHaveBeenCalledWith({ meshDensity: '8' });
  });

  it('renders solver errors as an alert-like error message', () => {
    render(<SolidFeaPanel bodies={[{ id: 'body-1', name: 'Wspornik' }]} bodyId="body-1" error="Solver MES nie osiągnął wymaganej zbieżności." onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/nie osiągnął wymaganej zbieżności/i)).toHaveClass('measure-error');
  });
});
