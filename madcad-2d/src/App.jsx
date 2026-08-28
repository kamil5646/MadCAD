
import React, { lazy, Suspense } from 'react';
const ModelingWorkspace = lazy(() => import('./modeling/ModelingWorkspace.jsx'));

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('MadCAD renderer error', error, info);
  }

  reload = () => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <main className="app-error-screen" role="alert" aria-labelledby="app-error-title">
          <div className="app-error-card">
            <p className="app-error-kicker">Bezpieczne odzyskiwanie</p>
            <h1 id="app-error-title">Projekt pozostał zapisany, ale interfejs napotkał błąd</h1>
            <p>Uruchom ponownie interfejs. MadCAD wczyta ostatni autozapis i nie zamknie aplikacji pustym oknem.</p>
            <button type="button" onClick={this.reload}>Uruchom ponownie interfejs</button>
            <details>
              <summary>Szczegóły techniczne</summary>
              <code>{this.state.error?.message || 'Nieznany błąd interfejsu.'}</code>
            </details>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <div className="react-ui-layer">
      <AppErrorBoundary>
        <Suspense fallback={<div className="app-loading">Ładowanie MadCAD…</div>}>
          <ModelingWorkspace />
        </Suspense>
      </AppErrorBoundary>
    </div>
  );
}
