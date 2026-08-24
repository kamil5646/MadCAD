import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createBaseDrawingView, createDrawingSheet } from '../cad-core/drawing-sheets.js';
import DrawingWorkspace from './DrawingWorkspace.jsx';

function props(overrides = {}) {
  const sheet = createDrawingSheet({ name: 'Arkusz 1' });
  const view = createBaseDrawingView({ bodyIds: ['body-1'], sheet });
  sheet.views.push(view);
  return {
    document: { name: 'Korpus', drawings: [sheet] },
    bodies: [{ id: 'body-1', lines: Float32Array.from([0, 0, 0, 40, 0, 0, 40, 0, 0, 40, 0, 20]) }],
    activeSheetId: sheet.id,
    selectedViewId: view.id,
    onCreateSheet: vi.fn(),
    onSelectSheet: vi.fn(),
    onUpdateSheet: vi.fn(),
    onDeleteSheet: vi.fn(),
    onAddBaseView: vi.fn(),
    onAddDerivedView: vi.fn(),
    onSelectView: vi.fn(),
    onUpdateView: vi.fn(),
    onDeleteView: vi.fn(),
    onExportPdf: vi.fn(),
    ...overrides,
  };
}

describe('DrawingWorkspace', () => {
  it('renders an associative sheet and exposes the base-view controls', () => {
    const current = props();
    render(<DrawingWorkspace {...current} />);
    expect(screen.getByRole('img', { name: /Arkusz Arkusz 1/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Kierunek/i })).toHaveValue('front');
    fireEvent.click(screen.getByRole('button', { name: /Eksport PDF/i }));
    expect(current.onExportPdf).toHaveBeenCalledOnce();
  });

  it('offers a real sheet action for an empty document', () => {
    const onCreateSheet = vi.fn();
    render(<DrawingWorkspace {...props({ document: { name: 'Pusty', drawings: [] }, activeSheetId: null, selectedViewId: null, onCreateSheet })} />);
    fireEvent.click(screen.getByRole('button', { name: /Nowy arkusz A4/i }));
    expect(onCreateSheet).toHaveBeenCalledOnce();
  });

  it('offers projected, section and detail commands for the selected view', () => {
    const current = props();
    render(<DrawingWorkspace {...current} />);
    fireEvent.click(screen.getByRole('button', { name: /Rzut/i }));
    fireEvent.click(screen.getByRole('button', { name: /Przekrój/i }));
    fireEvent.click(screen.getByRole('button', { name: /Detal/i }));
    expect(current.onAddDerivedView.mock.calls.map(([type]) => type)).toEqual(['projected', 'section', 'detail']);
  });
});
