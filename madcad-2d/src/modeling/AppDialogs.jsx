import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import fullLicenseText from '../../LICENSE?raw';
import { tutorialForLanguage } from './tutorial-content.js';
import { useDialogFocus } from './use-dialog-focus.js';
import { describeLicensePlan } from './license-plan.js';

export function FirstPartTutorial({ onClose }) {
  const content = tutorialForLanguage(window.document.documentElement.lang);
  const dialogRef = useDialogFocus();
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div className="tutorial-backdrop">
      <section ref={dialogRef} className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="firstPartTutorialTitle" tabIndex="-1">
        <header><div><strong id="firstPartTutorialTitle">{content.title}</strong><span>{content.intro}</span></div><button type="button" title={content.close} aria-label={content.close} onClick={onClose} autoFocus><X size={17} /></button></header>
        <div className="tutorial-body">
          <ol>{content.steps.map(([title, description]) => <li key={title}><strong>{title}</strong><span>{description}</span></li>)}</ol>
          <aside><h3><AlertTriangle size={16} />{content.limitationsTitle}</h3><ul>{content.limitations.map((item) => <li key={item}>{item}</li>)}</ul></aside>
        </div>
      </section>
    </div>
  );
}

export function LicenseInfoDialog({ onClose, onShowFullLicense, licensePlan = { mode: 'personal' }, onSelectPlan = () => {} }) {
  const dialogRef = useDialogFocus();
  const planStatus = describeLicensePlan(licensePlan);
  const [commercialFormOpen, setCommercialFormOpen] = useState(false);
  const [commercialHolder, setCommercialHolder] = useState(licensePlan.commercialHolder || '');
  const [commercialReference, setCommercialReference] = useState(licensePlan.commercialReference || '');
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="license-info-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="license-info-dialog" role="dialog" aria-modal="true" aria-labelledby="licenseInfoTitle" tabIndex="-1">
        <header>
          <div>
            <strong id="licenseInfoTitle">Licencja MadCAD</strong>
            <span>Przed rozpoczęciem pracy sprawdź zasady korzystania z MadCAD.</span>
          </div>
          <button type="button" title="Zamknij" aria-label="Zamknij" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="license-info-body">
          <p className="license-info-lead"><AlertTriangle size={17} /> MadCAD jest bezpłatny bez limitu czasu do użytku prywatnego, edukacyjnego i niezarobkowego.</p>
          <p className="license-info-release-warning"><AlertTriangle size={17} /> Wydanie 6.4.7 nie ma podpisu producenta. Wbudowany aktualizator pobiera je z oficjalnego GitHub Release i sprawdza sumę SHA-256 przed otwarciem.</p>
          <div className={`license-plan-status ${planStatus.expired ? 'expired' : ''}`} role="status"><span>Aktywny plan</span><strong>{planStatus.label}</strong><small>{planStatus.detail}</small></div>
          <div className="license-plan-grid" aria-label="Wybierz sposób korzystania z MadCAD">
            <button type="button" className={licensePlan.mode === 'personal' ? 'selected' : ''} aria-pressed={licensePlan.mode === 'personal'} onClick={() => onSelectPlan('personal')}><strong>Osobista</strong><span>Bezpłatnie bez limitu czasu</span><small>Wyłącznie projekty prywatne, edukacyjne i niezarobkowe.</small></button>
            <button type="button" className={licensePlan.mode === 'commercial-trial' ? 'selected' : ''} aria-pressed={licensePlan.mode === 'commercial-trial'} onClick={() => onSelectPlan('commercial-trial')}><strong>Ocena komercyjna</strong><span>40 dni pełnej wersji</span><small>Dla firmy lub organizacji przed zakupem.</small></button>
            <button type="button" className={licensePlan.mode === 'commercial-licensed' ? 'selected' : ''} aria-pressed={licensePlan.mode === 'commercial-licensed'} aria-expanded={commercialFormOpen} onClick={() => setCommercialFormOpen((open) => !open)}><strong>Komercyjna</strong><span>Licencja stanowiskowa</span><small>Aktywuj lokalnie na podstawie faktury lub pisemnego potwierdzenia zakupu.</small></button>
          </div>
          {commercialFormOpen && (
            <form className="commercial-license-form" onSubmit={(event) => { event.preventDefault(); onSelectPlan('commercial-licensed', { holder: commercialHolder, reference: commercialReference }); setCommercialFormOpen(false); }}>
              <strong>Potwierdź zakup licencji</strong>
              <label><span>Licencjobiorca</span><input value={commercialHolder} maxLength="120" required autoComplete="organization" onChange={(event) => setCommercialHolder(event.target.value)} placeholder="Osoba lub firma z dokumentu zakupu" /></label>
              <label><span>Numer faktury lub potwierdzenia</span><input value={commercialReference} maxLength="120" required autoComplete="off" onChange={(event) => setCommercialReference(event.target.value)} placeholder="Np. FV/2026/001" /></label>
              <small>Dane pozostają wyłącznie na tym komputerze. Ten zapis nie zastępuje dokumentu zakupu.</small>
              <div><button type="button" onClick={() => setCommercialFormOpen(false)}>Anuluj</button><button className="commercial" type="submit">Potwierdź licencję</button></div>
            </form>
          )}
          <div className="license-info-card license-info-commercial">
            <strong>Użytek komercyjny jest płatny</strong>
            <ul>
              <li>Po okresie oceny praca firmowa, zarobkowa lub dla klienta wymaga bezterminowej licencji na każde stanowisko.</li>
              <li>Nie ma klucza ani aktywacji — status jest zapisywany lokalnie, a licencję potwierdza dokument zakupu.</li>
              <li>Dobrowolna darowizna wspiera rozwój, ale nie zastępuje licencji komercyjnej.</li>
            </ul>
          </div>
          <p className="license-info-support-copy">Jeśli używasz MadCAD prywatnie i program jest dla Ciebie pomocny, możesz wesprzeć jego dalszy rozwój darowizną.</p>
          <div className="license-info-actions">
            <button className="secondary" type="button" onClick={onShowFullLicense}>Pełna treść licencji</button>
            <a className="commercial" href="https://kamil5646.github.io/MadCAD/#licencja" target="_blank" rel="noopener noreferrer">Kup licencję komercyjną</a>
            <a className="support" href="https://paypal.me/refek1" target="_blank" rel="noopener noreferrer">Przekaż darowiznę</a>
            <button className="confirm" type="button" onClick={onClose} autoFocus>Przejdź do programu</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function FullLicenseDialog({ onClose }) {
  const dialogRef = useDialogFocus();
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="license-info-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="license-info-dialog full-license-dialog" role="dialog" aria-modal="true" aria-labelledby="fullLicenseTitle" tabIndex="-1">
        <header><div><strong id="fullLicenseTitle">Pełna treść licencji MadCAD</strong><span>Wiążąca kopia dołączona bezpośrednio do tej wersji aplikacji.</span></div><button type="button" title="Zamknij" aria-label="Zamknij" onClick={onClose}><X size={17} /></button></header>
        <pre tabIndex="0">{fullLicenseText}</pre>
        <footer><button className="confirm" type="button" onClick={onClose} autoFocus>Zamknij</button></footer>
      </section>
    </div>
  );
}

export function UpdateDialog({ state, onCheck, onInstall, onClose }) {
  const dialogRef = useDialogFocus();
  const result = state.result;
  const handoff = state.handoff;
  const hasNewerVersion = Boolean(result?.newerVersion || result?.available);
  const supportsThisComputer = Boolean(result?.supported ?? result?.available);
  const checking = state.status === 'checking';
  const installing = state.status === 'installing';
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !installing) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [installing, onClose]);
  return (
    <div className="license-info-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !installing) onClose(); }}>
      <section ref={dialogRef} className="license-info-dialog" role="dialog" aria-modal="true" aria-labelledby="updateDialogTitle" tabIndex="-1">
        <header>
          <div><strong id="updateDialogTitle">Aktualizacje MadCAD</strong><span>Pobierz oficjalną paczkę, sprawdź SHA-256 i uruchom instalator.</span></div>
          <button type="button" title="Zamknij" aria-label="Zamknij" disabled={installing} onClick={onClose} autoFocus><X size={17} /></button>
        </header>
        <div className="license-info-body">
          <div className="update-status" role="status" aria-live="polite" aria-atomic="true">
            {checking && <p className="license-info-lead">Sprawdzanie aktualizacji…</p>}
            {installing && <p className="license-info-lead">Pobieranie i sprawdzanie sumy SHA-256…</p>}
            {!checking && !installing && state.error && <p className="license-info-lead"><AlertTriangle size={17} /> {state.error}</p>}
            {!checking && !installing && !state.error && handoff && (
              <div className="license-info-card license-info-commercial update-handoff">
                <strong>Paczka wersji {handoff.latestVersion} jest gotowa</strong>
                <p>{handoff.opened ? 'MadCAD otworzył zweryfikowaną paczkę. Dokończ instalację w systemie, a następnie uruchom nową wersję.' : 'Paczka została zweryfikowana i zapisana w folderze Pobrane. Otwórz ją, aby dokończyć instalację.'}</p>
                {handoff.downloadedPath && <small title={handoff.downloadedPath}>{handoff.downloadedPath}</small>}
              </div>
            )}
            {!checking && !installing && !state.error && !handoff && result?.available && (
              <div className="license-info-card license-info-commercial">
                <strong>Dostępna jest wersja {result.latestVersion}</strong>
                <p>Masz wersję {result.currentVersion}. Paczka zostanie pobrana z oficjalnego wydania GitHub oraz sprawdzona przed uruchomieniem.</p>
              </div>
            )}
            {!checking && !installing && !state.error && !handoff && hasNewerVersion && !supportsThisComputer && (
              <div className="license-info-card license-info-commercial">
                <strong>Wersja {result.latestVersion} nie ma paczki dla tego komputera</strong>
                <p>Zainstalowana wersja to {result.currentVersion}. Otwórz stronę wydania, aby sprawdzić dostępne platformy i architektury.</p>
              </div>
            )}
            {!checking && !installing && !state.error && !handoff && result && !hasNewerVersion && (
              <p className="license-info-lead">Masz aktualną wersję MadCAD{result.currentVersion ? ` (${result.currentVersion})` : ''}.</p>
            )}
          </div>
          <div className="license-info-actions">
            {hasNewerVersion && !supportsThisComputer && result?.releaseUrl && <a href={result.releaseUrl} target="_blank" rel="noopener noreferrer">Strona wydania</a>}
            <button className="secondary" type="button" disabled={checking || installing} onClick={() => onCheck(false)}>Sprawdź ponownie</button>
            {result?.available && !handoff && <button className="confirm" type="button" disabled={checking || installing} onClick={onInstall}>Pobierz i otwórz</button>}
            <button type="button" disabled={installing} onClick={onClose}>Później</button>
          </div>
        </div>
      </section>
    </div>
  );
}
