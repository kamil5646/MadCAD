
import React, { lazy, Suspense, useEffect, useState } from 'react';
const ModelingWorkspace = lazy(() => import('./modeling/ModelingWorkspace.jsx'));

export default function App() {
  const [modelingOpen, setModelingOpen] = useState(true);

  useEffect(() => {
    const button = document.getElementById('open3dPrintBtn');
    if (!button) return undefined;
    const handleOpen = () => setModelingOpen(true);
    button.addEventListener('click', handleOpen);
    return () => button.removeEventListener('click', handleOpen);
  }, []);

  return (
    <div className="react-ui-layer">
      {modelingOpen && (
        <Suspense fallback={<div className="print3d-loading">Ładowanie modułu 3D…</div>}>
          <ModelingWorkspace onClose={() => setModelingOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
