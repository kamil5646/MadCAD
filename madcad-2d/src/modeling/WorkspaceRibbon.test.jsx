import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Ruler, Square } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { ToolButton, ToolHelpContext, ToolMenuButton } from './WorkspaceRibbon.jsx';

function helpContext(overrides = {}) {
  return {
    setToolHelp: vi.fn(),
    registerShortcut: vi.fn(() => vi.fn()),
    customizationForTool: vi.fn(() => null),
    ...overrides,
  };
}

describe('ribbon tool help', () => {
  it('combines action, exact disabled reason and shortcut for a direct tool', () => {
    const context = helpContext();
    render(
      <ToolHelpContext.Provider value={context}>
        <ToolButton icon={Square} label="Wyciągnij" onClick={vi.fn()} disabled disabledReason="Zaznacz zamknięty profil." />
      </ToolHelpContext.Provider>,
    );

    const button = screen.getByRole('button', { name: /Wyciągnij/ });
    expect(button).toHaveAttribute('title', expect.stringContaining('Niedostępne. Zaznacz zamknięty profil.'));
    expect(button).toHaveAttribute('title', expect.stringContaining('Skrót: E.'));
    fireEvent.mouseEnter(button.parentElement);
    expect(context.setToolHelp).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Wyciągnij',
      state: 'Zaznacz zamknięty profil.',
      shortcut: 'E',
    }));
  });

  it('shows and registers the Autodesk-style dimension shortcut on a tool menu', () => {
    const context = helpContext();
    render(
      <ToolHelpContext.Provider value={context}>
        <ToolMenuButton
          icon={Ruler}
          label="Wymiary"
          description="Dodaj wymiar szkicu."
          items={[{ icon: Ruler, label: 'Ordinate X', displayLabel: 'Współrzędna X', disabled: true, onClick: vi.fn() }]}
        />
      </ToolHelpContext.Provider>,
    );

    const trigger = screen.getByRole('button', { name: /Wymiary/ });
    expect(trigger).toHaveAttribute('title', 'Dodaj wymiar szkicu. Skrót: D.');
    expect(context.registerShortcut).toHaveBeenCalledWith('D', expect.objectContaining({ label: 'Wymiary', disabled: false }));
    fireEvent.click(trigger);
    const disabledItem = screen.getByRole('menuitem', { name: /Współrzędna X/ });
    expect(disabledItem).toHaveAttribute('title', expect.stringContaining('Niedostępne. Polecenie nie jest dostępne w bieżącym stanie projektu.'));
  });

  it('never leaves a visible ribbon command enabled without an action', () => {
    const context = helpContext();
    render(
      <ToolHelpContext.Provider value={context}>
        <ToolButton icon={Square} label="Wyciągnij" />
        <ToolMenuButton icon={Ruler} label="Wymiary" items={[{ icon: Ruler, label: 'Ordinate X', displayLabel: 'Współrzędna X' }]} />
      </ToolHelpContext.Provider>,
    );

    const direct = screen.getByRole('button', { name: /Wyciągnij/ });
    expect(direct).toBeDisabled();
    expect(direct).toHaveAttribute('data-operational', 'false');
    expect(direct).toHaveAttribute('title', expect.stringContaining('Polecenie nie ma przypisanej operacji.'));
    fireEvent.click(screen.getByRole('button', { name: /Wymiary/ }));
    const menuItem = screen.getByRole('menuitem', { name: /Współrzędna X/ });
    expect(menuItem).toBeDisabled();
    expect(menuItem).toHaveAttribute('data-operational', 'false');
  });
});
