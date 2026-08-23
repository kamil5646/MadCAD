import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App.jsx';
import { FullLicenseDialog, LicenseInfoDialog, UpdateDialog } from './modeling/AppDialogs.jsx';
import { CrashRecoveryBanner } from './modeling/ModelingWorkspace.jsx';

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
    expect(dialog).toHaveTextContent(/Wydanie 6.3.0 nie ma podpisu producenta/i);
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
    fireEvent.click(screen.getByRole('button', { name: /Pobierz i otwórz/i }));
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
    expect(screen.queryByRole('button', { name: /Pobierz i otwórz/i })).toBeNull();
  });

  it('delegates signed updates to Microsoft Store without offering a GitHub installer', () => {
    render(<UpdateDialog
      state={{ status: 'idle', error: '', result: { available: false, supported: true, managedByStore: true, installMode: 'store', currentVersion: '6.3.0' } }}
      onCheck={() => {}}
      onInstall={() => {}}
      onClose={() => {}}
    />);
    const dialog = screen.getByRole('dialog', { name: /Aktualizacje MadCAD/i });
    expect(dialog).toHaveTextContent(/Aktualizacje instaluje Microsoft Store/i);
    expect(dialog).toHaveTextContent(/Zainstalowana wersja to 6.3.0/i);
    expect(screen.queryByRole('button', { name: /Pobierz i otwórz/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sprawdź ponownie/i })).toBeNull();
  });

  it('links to the release when a newer version has no compatible package', () => {
    render(<UpdateDialog
      state={{ status: 'idle', error: '', result: { newerVersion: true, supported: false, currentVersion: '6.1.9', latestVersion: '6.2.0', releaseUrl: 'https://github.com/kamil5646/MadCAD2D/releases/tag/v6.2.0' } }}
      onCheck={() => {}}
      onInstall={() => {}}
      onClose={() => {}}
    />);
    expect(screen.getByText(/Wersja 6.2.0 nie ma paczki dla tego komputera/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Strona wydania/i })).toHaveAttribute('href', 'https://github.com/kamil5646/MadCAD2D/releases/tag/v6.2.0');
    expect(screen.queryByRole('button', { name: /Pobierz i otwórz/i })).toBeNull();
  });

  it('confirms that a verified update package was opened for installation', () => {
    render(<UpdateDialog
      state={{ status: 'idle', error: '', result: { available: true }, handoff: { latestVersion: '6.1.9', opened: true, downloadedPath: '/Downloads/MadCAD.zip' } }}
      onCheck={() => {}}
      onInstall={() => {}}
      onClose={() => {}}
    />);
    expect(screen.getByText(/Paczka wersji 6.1.9 jest gotowa/i)).toBeInTheDocument();
    expect(screen.getByText(/MadCAD otworzył zweryfikowaną paczkę/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pobierz i otwórz/i })).toBeNull();
  });

  it('shows a clear recovery banner after an interrupted application session', () => {
    const onSave = vi.fn();
    const onDismiss = vi.fn();
    render(<CrashRecoveryBanner info={{ backup: true, updatedAt: '2026-08-15T20:30:00.000Z' }} onSave={onSave} onDismiss={onDismiss} />);
    const banner = screen.getByRole('alert', { name: /Odzyskiwanie projektu po awarii/i });
    expect(banner).toHaveTextContent(/Odzyskano projekt po nieoczekiwanym zamknięciu/i);
    expect(banner).toHaveTextContent(/poprzedniej poprawnej kopii autozapisu/i);
    fireEvent.click(screen.getByRole('button', { name: /Zapisz odzyskany projekt/i }));
    expect(onSave).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Zamknij komunikat odzyskiwania/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
