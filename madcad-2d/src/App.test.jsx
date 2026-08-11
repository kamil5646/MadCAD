import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';
import { LicenseInfoDialog } from './modeling/ModelingWorkspace.jsx';

describe('App', () => {
  it('renders the current modeling workspace as the only application interface', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.react-ui-layer')).toBeInTheDocument();
    expect(screen.getByText(/Ładowanie MadCAD/)).toBeInTheDocument();
    expect(document.getElementById('open3dPrintBtn')).toBeNull();
    expect(document.getElementById('licenseTokenInput')).toBeNull();
  });

  it('shows the private-use, evaluation, and commercial-license terms without a key field', () => {
    render(<LicenseInfoDialog onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: /Licencja MadCAD/i });
    expect(dialog).toHaveTextContent(/bezpłatny bez limitu czasu do użytku prywatnego/i);
    expect(dialog).toHaveTextContent(/oceniać pełną wersję przez 40 dni/i);
    expect(dialog).toHaveTextContent(/Użytek komercyjny jest płatny/i);
    expect(dialog).toHaveTextContent(/bezterminowej licencji na każde stanowisko/i);
    expect(dialog).toHaveTextContent(/licencję potwierdza dokument zakupu/i);
    expect(dialog).toHaveTextContent(/darowizna wspiera rozwój, ale nie zastępuje licencji komercyjnej/i);
    expect(dialog.querySelector('input, textarea')).toBeNull();
    expect(screen.getByRole('link', { name: /Kup licencję komercyjną/i })).toHaveAttribute('href', expect.stringMatching(/^mailto:kkasprzak15@icloud\.com/));
    expect(screen.getByRole('button', { name: /Przejdź do programu/i })).toBeInTheDocument();
  });
});
