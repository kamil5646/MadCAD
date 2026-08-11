
import React, { lazy, Suspense } from 'react';
const ModelingWorkspace = lazy(() => import('./modeling/ModelingWorkspace.jsx'));

export default function App() {
  return (
    <div className="react-ui-layer">
      <Suspense fallback={<div className="app-loading">Ładowanie MadCAD…</div>}>
        <ModelingWorkspace />
      </Suspense>
    </div>
  );
}
