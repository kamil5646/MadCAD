import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  it('renders without crashing and mounts the 3D workspace shell', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.react-ui-layer')).toBeInTheDocument();
    expect(screen.getByText(/Ładowanie modułu 3D/)).toBeInTheDocument();
  });

  it('opens the 3D print workspace when the open3dPrintBtn button is clicked', async () => {
    const button = document.createElement('button');
    button.id = 'open3dPrintBtn';
    document.body.appendChild(button);

    render(<App />);
    button.click();

    expect(await screen.findByText(/Ładowanie modułu 3D/)).toBeInTheDocument();

    document.body.removeChild(button);
  });
});
