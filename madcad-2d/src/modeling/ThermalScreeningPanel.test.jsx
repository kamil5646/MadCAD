import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThermalScreeningPanel } from './WorkspacePanels.jsx';

describe('ThermalScreeningPanel', () => {
  it('shows scope and updates material and temperatures', () => {
    const onChange = vi.fn();
    render(<ThermalScreeningPanel
      bodies={[{ id: 'body-1', name: 'Płyta' }]}
      bodyId="body-1"
      result={{ status: 'safe', deltaTemperature: 80, pathLength: 100, area: 200, thermalResistance: 10, heatFlow: 8, heatFlux: 40000, freeExpansion: 0.096, material: { maxServiceTemperature: 250 }, limitations: ['Tylko model przesiewowy.'] }}
      onChange={onChange}
      onClose={vi.fn()}
    />);
    expect(screen.getByText(/nie pełny solver termiczny MES/i)).toBeInTheDocument();
    expect(screen.getByText(/8 W/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: /Materiał analizy cieplnej/i }), { target: { value: 'petg' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Strona ciepła/i }), { target: { value: '90' } });
    expect(onChange).toHaveBeenCalledWith({ materialId: 'petg' });
    expect(onChange).toHaveBeenCalledWith({ hotTemperature: '90' });
  });

  it('shows calculation errors without stale results', () => {
    render(<ThermalScreeningPanel bodies={[{ id: 'body-1', name: 'Płyta' }]} bodyId="body-1" error="Temperatury muszą być różne." onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/muszą być różne/i)).toBeInTheDocument();
    expect(screen.queryByText(/Przepływ ciepła/i)).not.toBeInTheDocument();
  });
});
