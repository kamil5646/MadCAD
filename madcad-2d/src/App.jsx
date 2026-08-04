
import React, { lazy, Suspense, useEffect, useState } from 'react';
import './print3d.css';

const Print3DWorkspace = lazy(() => import('./Print3DWorkspace.jsx'));

export default function App() {
  const [print3dOpen, setPrint3dOpen] = useState(false);

  useEffect(() => {
    const button = document.getElementById('open3dPrintBtn');
    if (!button) return undefined;
    const handleOpen = () => setPrint3dOpen(true);
    button.addEventListener('click', handleOpen);
    return () => button.removeEventListener('click', handleOpen);
  }, []);

  return (
    <div className="react-ui-layer">
      {print3dOpen && (
        <Suspense fallback={<div className="print3d-loading">Ładowanie modułu 3D…</div>}>
          <Print3DWorkspace onClose={() => setPrint3dOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
