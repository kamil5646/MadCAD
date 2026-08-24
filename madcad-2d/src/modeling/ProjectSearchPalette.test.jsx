import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSearchPalette } from './WorkspaceOverlays.jsx';

const index = [
  { id: 'parameter-1', kind: 'parameter', label: 'Szerokość', secondary: 'szerokosc 60', searchText: 'szerokosc szerokosc 60 parametr parameter wymiar variable', target: { kind: 'settings', id: 'parameter-1' } },
  { id: 'feature-1', kind: 'feature', label: 'Otwór centralny', secondary: 'hole', searchText: 'otwor centralny hole operacja feature historia timeline 3d', target: { kind: 'feature', id: 'feature-1' } },
  { id: 'feature-2', kind: 'feature', label: 'Podstawa', secondary: 'extrude', searchText: 'podstawa extrude operacja feature historia timeline 3d', target: { kind: 'feature', id: 'feature-2' } },
];

describe('ProjectSearchPalette', () => {
  it('filters without Polish diacritics and navigates to the active result with Enter', async () => {
    const onNavigate = vi.fn();
    render(<ProjectSearchPalette index={index} onNavigate={onNavigate} onClose={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: /Szukaj w projekcie/i });
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: 'otwor centralny' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Otwór centralny');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: 'feature-1', target: { kind: 'feature', id: 'feature-1' } }));
  });

  it('supports type search, arrow navigation, Escape and the English interface', async () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<ProjectSearchPalette index={index} language="en" onNavigate={onNavigate} onClose={onClose} />);
    const input = screen.getByRole('combobox', { name: /Szukaj w projekcie/i });
    expect(screen.getByRole('dialog', { name: /Idź do obiektu projektu/i })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'feature' } });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Feature');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true'));
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: 'feature-1' }));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
