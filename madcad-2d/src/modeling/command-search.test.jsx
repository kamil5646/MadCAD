import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Square } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { searchCommands } from '../cad-core/project-search.js';
import { ProjectSearchPalette } from './WorkspaceOverlays.jsx';
import { RibbonGroup, ToolButton, ToolMenuButton, collectRibbonCommands } from './WorkspaceRibbon.jsx';

function ribbon(onFillet = vi.fn(), onSketch = vi.fn(), showHidden = false) {
  return (
    <>
      <RibbonGroup label="UTWÓRZ">
        <ToolButton icon={Square} label="Utwórz szkic" description="Wybierz płaszczyznę i rozpocznij rysowanie." onClick={onSketch} />
        <ToolButton icon={Square} label="Wyciągnij" onClick={vi.fn()} disabled disabledReason="Zaznacz zamknięty profil." />
        {showHidden && <ToolButton icon={Square} label="Ukryte" onClick={vi.fn()} />}
      </RibbonGroup>
      <RibbonGroup label="ZMIEŃ">
        <>
          <ToolMenuButton icon={Square} label="Więcej zmian" items={[
            { icon: Square, label: 'Fazuj', description: 'Ścięcie krawędzi.', onClick: vi.fn() },
            { icon: Square, label: 'Zaokrąglij', onClick: onFillet },
            { icon: Square, label: 'Powłoka', disabled: true, disabledReason: 'Zaznacz ścianę do usunięcia.', onClick: vi.fn() },
          ]} />
        </>
      </RibbonGroup>
    </>
  );
}

describe('ribbon command collection', () => {
  it('lists direct tools and dropdown items with availability, skipping empty slots', () => {
    const commands = collectRibbonCommands(ribbon());
    expect(commands.map((command) => command.label)).toEqual(['Utwórz szkic', 'Wyciągnij', 'Fazuj', 'Zaokrąglij', 'Powłoka']);
    expect(commands.find((command) => command.label === 'Wyciągnij')).toMatchObject({ disabled: true, disabledReason: 'Zaznacz zamknięty profil.', group: 'UTWÓRZ' });
    expect(commands.find((command) => command.label === 'Fazuj')).toMatchObject({ disabled: false, parent: 'Więcej zmian', group: 'ZMIEŃ' });
    expect(commands.find((command) => command.label === 'Powłoka').disabled).toBe(true);
  });

  it('treats a tool without an operation as unavailable', () => {
    const [command] = collectRibbonCommands(<RibbonGroup label="X"><ToolButton icon={Square} label="Bez akcji" /></RibbonGroup>);
    expect(command.disabled).toBe(true);
    expect(command.disabledReason).toMatch(/nie ma przypisanej operacji/);
  });
});

describe('searchCommands', () => {
  const commands = collectRibbonCommands(ribbon());

  it('matches without diacritics, by description and by group', () => {
    expect(searchCommands(commands, 'zaokraglij')[0].label).toBe('Zaokrąglij');
    expect(searchCommands(commands, 'sciecie')[0].label).toBe('Fazuj');
    expect(searchCommands(commands, 'plaszczyzne')[0].label).toBe('Utwórz szkic');
    expect(searchCommands(commands, '')).toEqual([]);
    expect(searchCommands(commands, 'nieistniejace')).toEqual([]);
  });

  it('puts available commands ahead of unavailable ones with the same match quality', () => {
    const results = searchCommands([
      { id: 'a', label: 'Powłoka', disabled: true },
      { id: 'b', label: 'Powłoka cienka', disabled: false },
    ], 'powloka');
    expect(results.map((entry) => entry.id)).toEqual(['a', 'b']); // exact name still beats prefix
    const same = searchCommands([
      { id: 'a', label: 'Fazuj A', disabled: true },
      { id: 'b', label: 'Fazuj B', disabled: false },
    ], 'fazuj');
    expect(same.map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

describe('command palette', () => {
  it('lists commands that only match a description after the project objects', () => {
    const index = [{ id: 'parameter-1', kind: 'parameter', label: 'Szerokość', secondary: 'szerokosc 60', searchText: 'szerokosc szerokosc 60 parametr', target: { kind: 'settings', id: 'parameter-1' } }];
    const commands = [{ id: 'command-Baza', label: 'Baza blachowa', displayLabel: 'Baza blachowa', description: 'Ustaw szerokość blachy.', group: 'ZMIEŃ', disabled: false, onClick: vi.fn() }];
    render(<ProjectSearchPalette index={index} commands={commands} onNavigate={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Szukaj w projekcie/i }), { target: { value: 'szerokosc' } });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('data-project-search-kind', 'parameter');
    expect(options[1]).toHaveAttribute('data-project-search-kind', 'command');
  });

  it('runs an available command with Enter after closing the palette', async () => {
    const onFillet = vi.fn();
    const onClose = vi.fn();
    const commands = collectRibbonCommands(ribbon(onFillet));
    vi.useFakeTimers();
    try {
      render(<ProjectSearchPalette index={[]} commands={commands} onNavigate={vi.fn()} onClose={onClose} />);
      const input = screen.getByRole('combobox', { name: /Szukaj w projekcie/i });
      fireEvent.change(input, { target: { value: 'zaokr' } });
      expect(screen.getByRole('option')).toHaveTextContent('Zaokrąglij');
      expect(screen.getByRole('option')).toHaveAttribute('data-project-search-kind', 'command');
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onClose).toHaveBeenCalledOnce();
      expect(onFillet).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(onFillet).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows why a command is unavailable and does not run it', async () => {
    const onClose = vi.fn();
    const commands = collectRibbonCommands(ribbon());
    render(<ProjectSearchPalette index={[]} commands={commands} onNavigate={vi.fn()} onClose={onClose} />);
    const input = screen.getByRole('combobox', { name: /Szukaj w projekcie/i });
    fireEvent.change(input, { target: { value: 'wyciagnij' } });
    const option = screen.getByRole('option');
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option).toHaveTextContent('Zaznacz zamknięty profil.');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onClose).not.toHaveBeenCalled());
  });

  it('keeps object results and shows commands first for the same query', () => {
    const index = [{ id: 'sketch-1', kind: 'sketch', label: 'Szkic 1', secondary: 'XY', searchText: 'szkic 1 xy szkic sketch 2d', target: { kind: 'sketch', id: 'sketch-1' } }];
    const commands = collectRibbonCommands(ribbon());
    render(<ProjectSearchPalette index={index} commands={commands} onNavigate={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Szukaj w projekcie/i }), { target: { value: 'szkic' } });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('data-project-search-kind', 'command');
    expect(options.at(-1)).toHaveAttribute('data-project-search-kind', 'sketch');
  });
});
