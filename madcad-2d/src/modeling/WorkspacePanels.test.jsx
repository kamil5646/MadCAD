import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './WorkspacePanels.jsx';

describe('Field', () => {
  it('selects the initial value so typing replaces it', () => {
    render(<Field label="Odległość" ariaLabel="Odległość" value="10" onChange={() => {}} autoFocus />);
    const input = screen.getByLabelText('Odległość');
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 2]);
  });

  it('leaves fields without autofocus untouched', () => {
    render(<Field label="Wysokość" ariaLabel="Wysokość" value="30" onChange={() => {}} />);
    expect(document.activeElement).not.toBe(screen.getByLabelText('Wysokość'));
  });
});
