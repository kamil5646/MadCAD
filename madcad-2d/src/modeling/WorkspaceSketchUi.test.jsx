import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanePicker } from './WorkspaceSketchUi.jsx';

function PlanePickerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Utwórz szkic</button>
      {open && <PlanePicker onPick={vi.fn()} onCancel={() => setOpen(false)} />}
    </>
  );
}

describe('PlanePicker accessibility', () => {
  it('announces a modal, focuses the primary plane, traps Tab and restores focus', async () => {
    render(<PlanePickerHarness />);
    const trigger = screen.getByRole('button', { name: 'Utwórz szkic' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Wybierz płaszczyznę szkicu' });
    const close = screen.getByRole('button', { name: 'Anuluj wybór płaszczyzny' });
    const xy = screen.getByRole('button', { name: /XY.*Góra/ });
    const yz = screen.getByRole('button', { name: /YZ.*Prawo/ });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(xy).toHaveFocus());

    yz.focus();
    fireEvent.keyDown(yz, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(yz).toHaveFocus();

    fireEvent.click(close);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog', { name: 'Wybierz płaszczyznę szkicu' })).not.toBeInTheDocument();
  });

  it('domyślnie kontynuuje istniejący szkic i pozwala jawnie utworzyć oddzielny', () => {
    const onPick = vi.fn();
    render(<PlanePicker existingSketchesByPlane={{ XY: { id: 'sketch-1', name: 'Szkic 1' } }} onPick={onPick} onCancel={vi.fn()} />);

    const xy = screen.getByRole('button', { name: /XY.*Kontynuuj Szkic 1/ });
    fireEvent.click(xy);
    expect(onPick).toHaveBeenLastCalledWith('XY', { forceNew: false });

    fireEvent.click(screen.getByRole('checkbox', { name: /Utwórz oddzielny szkic/ }));
    fireEvent.click(screen.getByRole('button', { name: /XY.*Nowy szkic/ }));
    expect(onPick).toHaveBeenLastCalledWith('XY', { forceNew: true });
  });
});
