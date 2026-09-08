import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createManufacturingSetup } from '../cad-core/manufacturing.js';
import { ManufacturingPanel } from './ManufacturingPanel.jsx';

describe('ManufacturingPanel', () => {
  it('shows calculated stock and edits the persisted CAM setup', () => {
    const setup = createManufacturingSetup({ bodyId: 'body-1', stock: { sideOffset: 2, topOffset: 3, bottomOffset: 1 } });
    const onUpdate = vi.fn();
    render(<ManufacturingPanel manufacturing={{ setups: [setup], activeSetupId: setup.id }} bodies={[{ id: 'body-1', name: 'Korpus', bounds: [[0, 0, 0], [100, 50, 20]] }]} onCreate={vi.fn()} onActivate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);
    expect(screen.getByText('Setup gotowy')).toBeInTheDocument();
    expect(screen.getByText('104.00 mm × 54.00 mm × 24.00 mm')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: /Góra/ }), { target: { value: '5' } });
    expect(onUpdate).toHaveBeenCalledWith(setup.id, { stock: { ...setup.stock, topOffset: '5' } });
  });

  it('explains that a solid body is required instead of exposing dead controls', () => {
    render(<ManufacturingPanel manufacturing={{ setups: [], activeSetupId: '' }} bodies={[]} onCreate={vi.fn()} onActivate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Najpierw utwórz bryłę')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nowy Setup/i })).toBeDisabled();
  });
});
