import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Box, Ruler } from 'lucide-react';
import { AdaptiveToolShelf, PlanePicker } from './WorkspaceSketchUi.jsx';

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

  it('ma nieblokujący wariant obszaru roboczego ze skrótami 1–3 i Escape', () => {
    const onPick = vi.fn();
    const onCancel = vi.fn();
    render(<PlanePicker variant="canvas" onPick={onPick} onCancel={onCancel} />);

    const picker = screen.getByRole('dialog', { name: 'Wybierz płaszczyznę szkicu' });
    expect(picker).toHaveAttribute('aria-modal', 'false');
    expect(picker).toHaveClass('plane-picker-canvas');

    fireEvent.keyDown(window, { key: '2' });
    expect(onPick).toHaveBeenCalledWith('XZ', { forceNew: false });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('AdaptiveToolShelf', () => {
  it('pokazuje tylko zalecane działania, a kolejne chowa w menu Więcej', () => {
    const extrude = vi.fn();
    const measure = vi.fn();
    render(<AdaptiveToolShelf
      title="Zamknięty profil"
      subtitle="Dostępne działania"
      actions={[{ icon: Box, label: 'Wyciągnij', onClick: extrude, primary: true }]}
      moreActions={[{ icon: Ruler, label: 'Zmierz', onClick: measure }]}
      onClear={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Wyciągnij' }));
    expect(extrude).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Więcej')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Więcej'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zmierz' }));
    expect(measure).toHaveBeenCalledTimes(1);
  });
});
