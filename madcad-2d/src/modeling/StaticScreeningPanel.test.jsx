import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StaticScreeningPanel } from './WorkspacePanels.jsx';

describe('StaticScreeningPanel', () => {
  it('edits study inputs and clearly distinguishes screening from FEA', () => {
    const onChange = vi.fn();
    render(<StaticScreeningPanel
      bodies={[{ id: 'body-1', name: 'Belka' }]}
      bodyId="body-1"
      materialId="s235"
      spanAxis="x"
      loadAxis="z"
      fixedEnd="min"
      force="1000"
      result={{ status: 'warning', safetyFactor: 1.4, length: 100, sectionWidth: 20, sectionHeight: 10, maximumStress: 167.8, tipDeflection: 0.42, material: { yieldStrength: 235 }, mass: 157, limitations: ['Wynik służy do wstępnego doboru, nie do odbioru konstrukcji.'] }}
      onChange={onChange}
      onClose={vi.fn()}
    />);
    expect(screen.getByText(/nie pełny solver MES/i)).toBeInTheDocument();
    expect(screen.getByText(/Mały zapas/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: /Materiał analizy/i }), { target: { value: 's355' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Siła na wolnym końcu/i }), { target: { value: '500' } });
    expect(onChange).toHaveBeenCalledWith({ materialId: 's355' });
    expect(onChange).toHaveBeenCalledWith({ force: '500' });
  });

  it('shows calculation errors instead of stale results', () => {
    render(<StaticScreeningPanel bodies={[{ id: 'body-1', name: 'Belka' }]} bodyId="body-1" error="Oś długości i kierunek siły muszą być różne." onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/muszą być różne/i)).toBeInTheDocument();
    expect(screen.queryByText(/Maks. naprężenie/i)).not.toBeInTheDocument();
  });
});
