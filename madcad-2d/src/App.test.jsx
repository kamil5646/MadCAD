import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  it('renders the current modeling workspace as the only application interface', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.react-ui-layer')).toBeInTheDocument();
    expect(screen.getByText(/Ładowanie MadCAD/)).toBeInTheDocument();
    expect(document.getElementById('open3dPrintBtn')).toBeNull();
    expect(document.getElementById('licenseTokenInput')).toBeNull();
  });
});
