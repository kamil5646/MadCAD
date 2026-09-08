import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BeamFeaPanel } from './WorkspacePanels.jsx';

describe('BeamFeaPanel', () => {
  it('shows validated results and updates mesh density', () => {
    const onChange = vi.fn();
    render(<BeamFeaPanel bodies={[{ id: 'body-1', name: 'Belka' }]} bodyId="body-1" result={{ status: 'failed', elementCount: 8, nodeCount: 9, length: 100, nodalDeflections: [{ x: 0, displacement: 0 }, { x: 100, displacement: -0.5 }], bendingMoments: [{ x: 0, moment: 50000 }, { x: 100, moment: 0 }], bendingStresses: [{ x: 0, stress: 300, utilizationPercent: 127.66, exceedsYield: true }, { x: 100, stress: 0, utilizationPercent: 0, exceedsYield: false }], shearForces: [{ x: 0, shear: 500 }, { x: 100, shear: 0 }], tipDeflection: 0.5, convergenceError: 0, maximumMoment: 50000, maximumStress: 300, utilizationPercent: 127.66, yieldExceededNodeCount: 1, reactionForce: 500, reactionMoment: 50000, safetyFactor: 0.78, requiredSafetyFactor: 2, safetyMarginPercent: -61, limitations: ['Model belkowy.'] }} onChange={onChange} onClose={vi.fn()} />);
    expect(screen.getByText(/nie MES dowolnej bryły 3D/i)).toBeInTheDocument();
    expect(screen.getByText('9 / 18')).toBeInTheDocument();
    expect(screen.getByLabelText(/Legenda warunków brzegowych/i)).toHaveTextContent('UtwierdzenieObciążenieDeformacja');
    expect(screen.getByRole('img', { name: /Wykres ugięcia/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Wykres momentu zginającego/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Moment' }));
    expect(screen.getByRole('img', { name: /Wykres momentu zginającego/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tnąca' }));
    expect(screen.getByRole('img', { name: /Wykres siły tnącej/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Naprężenie' }));
    expect(screen.getByRole('img', { name: /Wykres naprężenia zginającego/i })).toBeInTheDocument();
    expect(screen.getByText('1 / 9')).toBeInTheDocument();
    expect(document.querySelector('.beam-fea-stress-chart circle.failed')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Wymagany współczynnik bezpieczeństwa/i }), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith({ requiredSafetyFactor: '3' });
    fireEvent.change(screen.getByRole('textbox', { name: /Elementy/i }), { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith({ elementCount: '12' });
  });

  it('shows solver errors without stale results', () => {
    render(<BeamFeaPanel bodies={[{ id: 'body-1', name: 'Belka' }]} bodyId="body-1" error="Liczba elementów MES musi być całkowita od 1 do 100." onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/od 1 do 100/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ugięcie końca/i)).not.toBeInTheDocument();
  });

  it('switches between point and distributed load units', () => {
    const onChange = vi.fn();
    render(<BeamFeaPanel bodies={[{ id: 'body-1', name: 'Belka' }]} bodyId="body-1" loadType="distributed" force="10" onChange={onChange} onClose={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /Obciążenie liniowe/i })).toHaveValue('10');
    expect(screen.getByText('N/mm')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: /Typ obciążenia/i }), { target: { value: 'tip' } });
    expect(onChange).toHaveBeenCalledWith({ loadType: 'tip' });
  });

  it('edits the position of a concentrated force', () => {
    const onChange = vi.fn();
    render(<BeamFeaPanel bodies={[{ id: 'body-1', name: 'Belka' }]} bodyId="body-1" loadType="tip" loadPositionPercent="37" force="500" onChange={onChange} onClose={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /Położenie od utwierdzenia/i })).toHaveValue('37');
    fireEvent.change(screen.getByRole('textbox', { name: /Położenie od utwierdzenia/i }), { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith({ loadPositionPercent: '50' });
  });

  it('shows both load inputs for a combined case', () => {
    const onChange = vi.fn();
    render(<BeamFeaPanel bodies={[{ id: 'body-1', name: 'Belka' }]} bodyId="body-1" loadType="combined" force="500" distributedForce="10" loadPositionPercent="40" onChange={onChange} onClose={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /^Siła skupiona N$/i })).toHaveValue('500');
    expect(screen.getByRole('textbox', { name: /Obciążenie liniowe kombinacji/i })).toHaveValue('10');
    expect(screen.getByRole('textbox', { name: /Położenie od utwierdzenia/i })).toHaveValue('40');
    fireEvent.change(screen.getByRole('textbox', { name: /Obciążenie liniowe kombinacji/i }), { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith({ distributedForce: '12' });
  });
});
