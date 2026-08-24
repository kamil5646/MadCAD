import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createBalloonDrawingAnnotation, createBaseDrawingView, createDrawingSheet, createLinearDrawingDimension } from '../cad-core/drawing-sheets.js';
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
    selectedAnnotationId: null,
    onCreateSheet: vi.fn(),
    onSelectSheet: vi.fn(),
    onUpdateSheet: vi.fn(),
    onDeleteSheet: vi.fn(),
    onAddBaseView: vi.fn(),
    onAddDerivedView: vi.fn(),
    onSelectView: vi.fn(),
    onUpdateView: vi.fn(),
    onDeleteView: vi.fn(),
    onAddAnnotation: vi.fn(),
    onSelectAnnotation: vi.fn(),
    onUpdateAnnotation: vi.fn(),
    onDeleteAnnotation: vi.fn(),
    onAddRevision: vi.fn(),
    onUpdateRevision: vi.fn(),
    onDeleteRevision: vi.fn(),
    onAddTable: vi.fn(),
    onUpdateTable: vi.fn(),
    onDeleteTable: vi.fn(),
    onExportPdf: vi.fn(),
    onExportDxf: vi.fn(),
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
    fireEvent.click(screen.getByRole('button', { name: /Eksport DXF/i }));
    expect(current.onExportDxf).toHaveBeenCalledOnce();
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

  it('adds drawing annotations and edits an associative dimension tolerance', () => {
    const current = props();
    render(<DrawingWorkspace {...current} />);
    fireEvent.click(screen.getByRole('button', { name: /Wymiar X/i }));
    fireEvent.click(screen.getByRole('button', { name: /Oś/i }));
    fireEvent.click(screen.getByRole('button', { name: /Opis otworu/i }));
    fireEvent.click(screen.getByRole('button', { name: /Opis gwintu/i }));
    fireEvent.click(screen.getByRole('button', { name: /GD&T/i }));
    fireEvent.click(screen.getByRole('button', { name: /Balon/i }));
    expect(current.onAddAnnotation.mock.calls.map(([type]) => type)).toEqual(['dimension-horizontal', 'centerline', 'hole-note', 'thread-note', 'feature-control-frame', 'balloon']);

    const sheet = current.document.drawings[0];
    const annotation = createLinearDrawingDimension({ viewId: sheet.views[0].id, toleranceMode: 'symmetric', upperTolerance: 0.1, lowerTolerance: 0.1 });
    sheet.annotations.push(annotation);
    const edited = { ...current, selectedViewId: null, selectedAnnotationId: annotation.id };
    const { unmount } = render(<DrawingWorkspace {...edited} />);
    expect(screen.getByText(/Wartość z modelu:/i)).toHaveTextContent('40.00 ±0.10');
    fireEvent.change(screen.getAllByRole('spinbutton', { name: /± \[mm\]/i }).at(-1), { target: { value: '0.25' } });
    expect(current.onUpdateAnnotation).toHaveBeenCalledWith({ upperTolerance: 0.25, lowerTolerance: 0.25 });
    unmount();
  });

  it('adds associative BOM and hole tables', () => {
    const current = props();
    render(<DrawingWorkspace {...current} />);
    fireEvent.click(screen.getByText(/Tabele \(0\)/i));
    fireEvent.click(screen.getByRole('button', { name: /^BOM$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Otwory$/i }));
    expect(current.onAddTable.mock.calls.map(([type]) => type)).toEqual(['bom', 'hole-table']);
  });

  it('keeps a balloon item number associated with the selected BOM body', () => {
    const current = props();
    const sheet = current.document.drawings[0];
    const secondBody = { id: 'body-2', name: 'Pokrywa', lines: Float32Array.from([0, 0, 0, 20, 0, 0]) };
    current.bodies.push(secondBody);
    sheet.views[0].bodyIds.push(secondBody.id);
    const balloon = createBalloonDrawingAnnotation({ viewId: sheet.views[0].id, bodyId: 'body-1', itemNumber: 1 });
    sheet.annotations.push(balloon);
    render(<DrawingWorkspace {...current} selectedViewId={null} selectedAnnotationId={balloon.id} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Część/i }), { target: { value: secondBody.id } });
    expect(current.onUpdateAnnotation).toHaveBeenCalledWith({ bodyId: secondBody.id, itemNumber: 2 });
  });

  it('edits the title block and creates a revision', () => {
    const current = props();
    render(<DrawingWorkspace {...current} />);
    fireEvent.click(screen.getByText('Tabliczka rysunkowa'));
    fireEvent.change(screen.getByRole('textbox', { name: /Numer części/i }), { target: { value: 'MC-100' } });
    expect(current.onUpdateSheet).toHaveBeenCalledWith({ titleBlock: { ...current.document.drawings[0].titleBlock, partNumber: 'MC-100' } });
    fireEvent.click(screen.getByText(/Rewizje \(0\)/i));
    fireEvent.click(screen.getByRole('button', { name: /Dodaj rewizję/i }));
    expect(current.onAddRevision).toHaveBeenCalledOnce();
  });
});
