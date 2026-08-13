import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App.jsx';
import { FullLicenseDialog, LicenseInfoDialog, UpdateDialog } from './modeling/AppDialogs.jsx';

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
    expect(dialog).toHaveTextContent(/Wydanie 6.1.2 nie ma podpisu producenta/i);
    expect(dialog).toHaveTextContent(/oceniać pełną wersję przez 40 dni/i);
    expect(dialog).toHaveTextContent(/Użytek komercyjny jest płatny/i);
    expect(dialog).toHaveTextContent(/bezterminowej licencji na każde stanowisko/i);
    expect(dialog).toHaveTextContent(/licencję potwierdza dokument zakupu/i);
    expect(dialog).toHaveTextContent(/darowizna wspiera rozwój, ale nie zastępuje licencji komercyjnej/i);
    expect(dialog.querySelector('input, textarea')).toBeNull();
    expect(screen.getByRole('link', { name: /Kup licencję komercyjną/i })).toHaveAttribute('href', 'https://kamil5646.github.io/MadCAD2D/#licencja');
    expect(screen.getByRole('button', { name: /Pełna treść licencji/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Przejdź do programu/i })).toBeInTheDocument();
  });

  it('focuses the full-license dialog and closes it with Escape', () => {
    const onClose = vi.fn();
    render(<FullLicenseDialog onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: /Pełna treść licencji MadCAD/i });
    expect(dialog).toContainElement(document.activeElement);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows only a verified available update as installable', () => {
    const onInstall = vi.fn();
    render(<UpdateDialog
      state={{ status: 'idle', error: '', result: { available: true, currentVersion: '6.1.0', latestVersion: '6.1.1' } }}
      onCheck={() => {}}
      onInstall={onInstall}
      onClose={() => {}}
    />);
    expect(screen.getByRole('dialog', { name: /Aktualizacje MadCAD/i })).toHaveTextContent(/Dostępna jest wersja 6.1.1/i);
    fireEvent.click(screen.getByRole('button', { name: /Pobierz i zainstaluj/i }));
    expect(onInstall).toHaveBeenCalledOnce();
  });

  it('does not offer installation when the current version is up to date', () => {
    render(<UpdateDialog
      state={{ status: 'idle', error: '', result: { available: false, currentVersion: '6.1.0' } }}
      onCheck={() => {}}
      onInstall={() => {}}
      onClose={() => {}}
    />);
    expect(screen.getByText(/Masz aktualną wersję MadCAD \(6.1.0\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pobierz i zainstaluj/i })).toBeNull();
  });
});
