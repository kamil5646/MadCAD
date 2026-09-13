import React from 'react';

function CadSvg({ children, ...props }) {
  return <svg viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props} fill="none">{children}</svg>;
}

export function SketchCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-secondary" d="M3.5 17.5V6.5h11v11z" /><path className="cad-surface-primary" d="m13.5 16 6.6-6.6-2.5-2.5-6.6 6.6-.8 3.3z" /><path className="cad-detail" d="m16.3 8.2 2.5 2.5" /></CadSvg>;
}

export function ExtrudeCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m4 15 6 3 6-3-6-3z" /><path className="cad-surface-secondary" d="m10 12 6-3 4 2-4 2" /><path className="cad-action" d="M10 12V5m0 0L7.5 7.5M10 5l2.5 2.5" /></CadSvg>;
}

export function PressPullCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m4 14 8 4 8-4-8-4z" /><path className="cad-action" d="M12 10V3m0 0L9.5 5.5M12 3l2.5 2.5" /><path className="cad-guide" d="M12 18v3" /></CadSvg>;
}

export function RevolveCadIcon(props) {
  return <CadSvg {...props}><path className="cad-guide" d="M8 5v14" strokeDasharray="2 2" /><path className="cad-surface-primary" d="M10 7h4l2 3-2 3h-4z" /><path className="cad-action" d="M17.5 6.5a7 7 0 0 1 0 11" /><path className="cad-action" d="m17 14.5.5 3 2.8-1" /></CadSvg>;
}

export function SweepCadIcon(props) {
  return <CadSvg {...props}><circle cx="5" cy="17" r="2.5" /><path d="M7.5 17c5 0 3-10 9-10h2" /><path d="m16 4 3 3-3 3" /></CadSvg>;
}

export function LoftCadIcon(props) {
  return <CadSvg {...props}><ellipse className="cad-surface-primary" cx="12" cy="5" rx="4" ry="2" /><path className="cad-surface-secondary" d="m8 5-4 13h16L16 5z" /><path className="cad-detail" d="M4 18h16M6 12h12" /></CadSvg>;
}

export function CoilCadIcon(props) {
  return <CadSvg {...props}><path d="M5 18c0-2 14-2 14-5s-14-3-14-6 14-3 14-1" /><path d="M12 3v18" strokeDasharray="2 2" /></CadSvg>;
}

export function PrimitiveCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m4 8 8-4 8 4-8 4z" /><path className="cad-surface-secondary" d="M4 8v8l8 4 8-4V8M12 12v8" /></CadSvg>;
}

export function HoleCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m3 10 9-5 9 5-9 5z" /><path className="cad-surface-secondary" d="M3 10v6l9 5 9-5v-6" /><ellipse className="cad-cut" cx="12" cy="10" rx="3" ry="1.6" /><path className="cad-guide" d="M12 11.6v5" /></CadSvg>;
}

export function PatternCadIcon(props) {
  return <CadSvg {...props}><rect className="cad-surface-primary" x="3" y="4" width="5" height="5" /><rect className="cad-surface-secondary" x="11" y="4" width="5" height="5" /><rect className="cad-surface-secondary" x="3" y="12" width="5" height="5" /><rect className="cad-surface-primary" x="11" y="12" width="5" height="5" /><path className="cad-action" d="m18 9 3 3-3 3" /></CadSvg>;
}

export function BooleanCadIcon(props) {
  return <CadSvg {...props}><circle className="cad-surface-primary" cx="9" cy="12" r="6" /><circle className="cad-surface-secondary" cx="15" cy="12" r="6" /><path className="cad-action" d="M12 8v8m-4-4h8" /></CadSvg>;
}

export function FilletCadIcon(props) {
  return <CadSvg {...props}><path d="M4 4v16h16" /><path d="M8 20c0-6.6 5.4-12 12-12" /><path d="M8 16v4h4" /></CadSvg>;
}

export function ChamferCadIcon(props) {
  return <CadSvg {...props}><path d="M4 4v16h16" /><path d="m4 14 6 6" /><path d="M4 14h3m3 3v3" /></CadSvg>;
}

export function ShellCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m3 8 9-5 9 5-9 5z" /><path className="cad-surface-secondary" d="M3 8v9l9 4 9-4V8M12 13v8" /><path className="cad-cut" d="m8 8 4-2 4 2-4 2z" /></CadSvg>;
}

export function DraftCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="M7 4h10l3 16H4z" /><path className="cad-guide" d="M12 4v16" strokeDasharray="2 2" /><path className="cad-action" d="m5 16 4-4" /></CadSvg>;
}

export function OffsetFaceCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-secondary" d="m3 14 8 4 8-4-8-4z" /><path className="cad-surface-primary" d="m5 8 6 3 6-3-6-3z" /><path className="cad-action" d="M21 7v9m0-9-2 2m2-2 2 2m-2 7-2-2m2 2 2-2" /></CadSvg>;
}

export function DeleteFaceCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m3 8 8-4 8 4-8 4z" /><path className="cad-surface-secondary" d="M3 8v8l8 4 8-4V8M11 12v8" /><path className="cad-danger" d="m15 12 6 6m0-6-6 6" /></CadSvg>;
}

export function SplitBodyCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m3 8 8-4 8 4-8 4zM3 8v8l8 4 8-4V8M11 12v8" /><path className="cad-cut" d="M2 13h20" strokeDasharray="2 2" /><path className="cad-action" d="m20 11 2 2-2 2" /></CadSvg>;
}

export function SplitFaceCadIcon(props) {
  return <CadSvg {...props}><path d="m3 8 9-4 9 4-9 4z" /><path d="M3 8v8l9 4 9-4V8" /><path d="m12 12 4-6M12 12l-4-6" /></CadSvg>;
}

export function ReplaceFaceCadIcon(props) {
  return <CadSvg {...props}><path d="m3 8 7-4 7 4-7 4zM3 8v7l7 4 7-4V8" /><path d="M16 4h5v5" /><path d="m21 4-7 7" /></CadSvg>;
}

export function MoveBodyCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m4 9 6-3 6 3-6 3zM4 9v6l6 3 6-3V9" /><path className="cad-action" d="M18 5h4m0 0-2-2m2 2-2 2M18 19h4m0 0-2-2m2 2-2 2" /></CadSvg>;
}

export function RotateBodyCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m5 9 6-3 6 3-6 3zM5 9v6l6 3 6-3V9" /><path className="cad-action" d="M4 5a9 9 0 0 1 15 0" /><path className="cad-action" d="m18 2 1 3-3 .5" /></CadSvg>;
}

export function EditFeatureCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-secondary" d="m3 9 7-4 7 4-7 4zM3 9v7l7 4 4-2" /><path className="cad-surface-primary" d="m14 17 6-6 2 2-6 6-3 1z" /></CadSvg>;
}

export function PlaneCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m3 15 8-10 10 4-8 10z" /><path className="cad-guide" d="M5 19 19 5" strokeDasharray="2 2" /></CadSvg>;
}

export function MidplaneCadIcon(props) {
  return <CadSvg {...props}><path d="m2 8 7-4 5 2-7 4zM10 18l7-4 5 2-7 4z" /><path d="m6 14 7-4 5 2-7 4z" strokeDasharray="2 2" /></CadSvg>;
}

export function ThreePointPlaneCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m3 16 7-11 11 4-7 11z" /><circle className="cad-action" cx="6" cy="14" r="1.2" /><circle className="cad-action" cx="10" cy="7" r="1.2" /><circle className="cad-action" cx="18" cy="10" r="1.2" /></CadSvg>;
}

export function AnglePlaneCadIcon(props) {
  return <CadSvg {...props}><path d="M5 19V5h14" /><path d="m5 19 13-7" /><path d="M9 17a5 5 0 0 0-4-5" /><path d="M5 5h14l-3 4H8z" /></CadSvg>;
}

export function TangentPlaneCadIcon(props) {
  return <CadSvg {...props}><circle cx="11" cy="13" r="6" /><path d="M3 6h18" /><circle cx="11" cy="7" r="1" /></CadSvg>;
}

export function PathPlaneCadIcon(props) {
  return <CadSvg {...props}><path d="M3 19c5-1 4-12 11-12h6" /><path d="m13 3 7 4-4 7-7-4z" /><path d="M14 7h6" /></CadSvg>;
}

export function AxisCadIcon(props) {
  return <CadSvg {...props}><path d="M3 12h18" strokeDasharray="3 2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="12" r="2" /></CadSvg>;
}

export function CylinderAxisCadIcon(props) {
  return <CadSvg {...props}><ellipse className="cad-surface-primary" cx="12" cy="6" rx="5" ry="2.5" /><path className="cad-surface-secondary" d="M7 6v12c0 1.4 10 1.4 10 0V6" /><ellipse className="cad-detail" cx="12" cy="18" rx="5" ry="2.5" /><path className="cad-guide" d="M12 2v20" strokeDasharray="2 2" /></CadSvg>;
}

export function PointCadIcon(props) {
  return <CadSvg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 3v5m0 8v5M3 12h5m8 0h5" /></CadSvg>;
}

export function SectionCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m3 8 8-4 8 4-8 4zM3 8v8l8 4 8-4V8" /><path className="cad-cut" d="m8 5 8 14M5 10l8 8M11 4l8 8" /></CadSvg>;
}

export function MassCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m4 8 8-4 8 4-8 4zM4 8v8l8 4 8-4V8" /><circle className="cad-action" cx="12" cy="13" r="2" /><path className="cad-detail" d="M12 11V7" /></CadSvg>;
}

export function GeometryCheckCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-primary" d="m3 8 8-4 8 4-8 4zM3 8v8l8 4 8-4V8" /><path className="cad-success" d="m14 15 2 2 5-6" /></CadSvg>;
}

export function SurfacePatchCadIcon(props) {
  return <CadSvg {...props}>
    <path className="cad-surface-primary" d="M3 17c4.2-7.3 8.3-10.6 18-10-4.6 3.4-6.8 7.2-8.2 12.5C9.3 17.7 6 16.9 3 17z" />
    <path className="cad-detail" d="M4.8 14.3c4.6-2 8.9-2.8 13.4-2.4M8.1 9.7c2.1 2.6 3.6 5.4 4.7 8.5" />
    <circle className="cad-action" cx="3" cy="17" r="1" /><circle className="cad-action" cx="21" cy="7" r="1" />
  </CadSvg>;
}

export function MeshBodyCadIcon(props) {
  return <CadSvg {...props}>
    <path className="cad-surface-primary" d="m3.5 8 8.5-4 8.5 4-8.5 4.5z" />
    <path className="cad-surface-secondary" d="M3.5 8v8l8.5 4.5v-8zM12 12.5l8.5-4v8L12 20.5z" />
    <path className="cad-detail" d="m3.5 8 8.5 4.5 8.5-4M7.8 6 12 12.5 16.3 6M3.5 16l8.5-3.5 8.5 4M7.7 10.2 12 20.5l4.3-10.2" />
  </CadSvg>;
}

export function SheetMetalCadIcon(props) {
  return <CadSvg {...props}>
    <path className="cad-surface-primary" d="M3 5h13v8H7.8L3 17.8z" />
    <path className="cad-surface-secondary" d="m7.8 13 5.2 6h8l-5-6z" />
    <path className="cad-detail" d="M7.8 13H16M5 8h9" /><path className="cad-action" d="m4.5 15.8 3.3-3.3 3 3.5" />
  </CadSvg>;
}

export function PlasticFeatureCadIcon(props) {
  return <CadSvg {...props}>
    <path className="cad-surface-secondary" d="m3 15 9 4.5 9-4.5-9-4.5z" />
    <path className="cad-surface-primary" d="M8.5 13V7c0-2.7 7-2.7 7 0v6c0 2.7-7 2.7-7 0z" />
    <ellipse className="cad-cut" cx="12" cy="7" rx="1.8" ry=".9" /><path className="cad-detail" d="M8.5 7c0 2.7 7 2.7 7 0M8.5 11c0 2.7 7 2.7 7 0" />
  </CadSvg>;
}

export function AssemblyCadIcon(props) {
  return <CadSvg {...props}>
    <path className="cad-surface-primary" d="m2.5 8 5-2.5 5 2.5-5 2.7zM2.5 8v5l5 2.7 5-2.7V8" />
    <path className="cad-surface-secondary" d="m12 13 5-2.5 5 2.5-5 2.7zM12 13v5l5 2.7 5-2.7v-5" />
    <path className="cad-action" d="M10 16.8h4M12 15v3.6" />
  </CadSvg>;
}

export function DrawingSheetCadIcon(props) {
  return <CadSvg {...props}>
    <path className="cad-surface-secondary" d="M4 2.5h11l5 5v14H4z" /><path className="cad-surface-primary" d="M15 2.5v5h5" />
    <path className="cad-detail" d="m7 12 4-2 4 2-4 2zM7 12v4l4 2 4-2v-4M11 14v4" /><path className="cad-action" d="M6.5 6.5h4" />
  </CadSvg>;
}

export function ManufacturingSetupCadIcon(props) {
  return <CadSvg {...props}>
    <path className="cad-surface-secondary" d="m3 13 8 4 8-4-8-4zM3 13v4l8 4 8-4v-4" />
    <path className="cad-surface-primary" d="M14 3h5v7l-2.5 2L14 10z" /><path className="cad-detail" d="M16.5 3v9" /><path className="cad-action" d="M5 7h5M7.5 4.5v5" />
  </CadSvg>;
}

export function ImportMeshCadIcon(props) {
  return <CadSvg {...props}>
    <path className="cad-surface-secondary" d="m3 13 7 3.5 7-3.5-7-3.5zM3 13v5l7 3.5 7-3.5v-5" />
    <path className="cad-detail" d="m3 13 7 3.5 7-3.5M6.5 11.2 10 21.5l3.5-10.3" /><path className="cad-action" d="M18.5 3v8m0-8-3 3m3-3 3 3" />
  </CadSvg>;
}

export function SketchLineCadIcon(props) {
  return <CadSvg {...props}><path className="cad-detail" d="M4 18 20 6" /><circle className="cad-node" cx="4" cy="18" r="1.7" /><circle className="cad-node cad-node-secondary" cx="20" cy="6" r="1.7" /></CadSvg>;
}

export function SketchPolylineCadIcon(props) {
  return <CadSvg {...props}><path className="cad-detail" d="m3.5 18 5-10 6.2 7L21 5" /><circle className="cad-node" cx="3.5" cy="18" r="1.5" /><circle className="cad-node cad-node-secondary" cx="8.5" cy="8" r="1.5" /><circle className="cad-node" cx="14.7" cy="15" r="1.5" /><circle className="cad-node cad-node-secondary" cx="21" cy="5" r="1.5" /></CadSvg>;
}

export function SketchRectangleCadIcon(props) {
  return <CadSvg {...props}><rect className="cad-surface-primary" x="3.5" y="5" width="17" height="14" rx=".8" /><circle className="cad-node" cx="3.5" cy="5" r="1.3" /><circle className="cad-node cad-node-secondary" cx="20.5" cy="19" r="1.3" /></CadSvg>;
}

export function SketchCircleCadIcon(props) {
  return <CadSvg {...props}><circle className="cad-surface-primary" cx="12" cy="12" r="8" /><path className="cad-guide" d="M12 12 18.2 7" /><circle className="cad-node" cx="12" cy="12" r="1.4" /><circle className="cad-node cad-node-secondary" cx="18.2" cy="7" r="1.4" /></CadSvg>;
}

export function SketchArcCadIcon(props) {
  return <CadSvg {...props}><path className="cad-detail" d="M4 17A10 10 0 0 1 20 7" /><path className="cad-guide" d="m12 17 8-10" /><circle className="cad-node" cx="4" cy="17" r="1.5" /><circle className="cad-node cad-node-secondary" cx="20" cy="7" r="1.5" /><circle className="cad-node" cx="12" cy="17" r="1.2" /></CadSvg>;
}

export function SketchShapesCadIcon(props) {
  return <CadSvg {...props}><rect className="cad-surface-primary" x="2.8" y="10.5" width="7" height="7" rx=".8" /><circle className="cad-surface-secondary" cx="15.8" cy="7" r="4" /><path className="cad-action" d="m13 20 4-7 4 7z" /></CadSvg>;
}

export function SketchTrimCadIcon(props) {
  return <CadSvg {...props}><path className="cad-detail" d="M3 6c6 0 10 5 18 12M3 18c6 0 10-5 18-12" /><circle className="cad-cut" cx="12" cy="12" r="2.4" /><path className="cad-action" d="m10.3 10.3 3.4 3.4m0-3.4-3.4 3.4" /></CadSvg>;
}

export function SketchConstraintCadIcon(props) {
  return <CadSvg {...props}><path className="cad-detail" d="M3 17 9 7M15 17l6-10" /><path className="cad-action" d="M8.5 12h7" /><rect className="cad-surface-secondary" x="9" y="10" width="6" height="7" rx="1" /><path className="cad-detail" d="M10.5 10V8.5a1.5 1.5 0 0 1 3 0V10" /></CadSvg>;
}

export function SketchDimensionCadIcon(props) {
  return <CadSvg {...props}><path className="cad-guide" d="M4 5v14M20 5v14" /><path className="cad-action" d="M5 12h14M5 12l3-2m-3 2 3 2m11-2-3-2m3 2-3 2" /><path className="cad-detail" d="M9.5 7h5" /></CadSvg>;
}

export function ProjectGeometryCadIcon(props) {
  return <CadSvg {...props}><path className="cad-surface-secondary" d="m3 16 8-10 10 3-8 10z" /><path className="cad-action" d="M5 5h8m0 0-3-3m3 3-3 3" /><path className="cad-detail" d="m7 15 4-5 5 1.5" /></CadSvg>;
}

export function FinishSketchCadIcon(props) {
  return <CadSvg {...props}><circle className="cad-finish-disc" cx="12" cy="12" r="9" /><path className="cad-finish-check" d="m7.5 12.2 3 3.1 6.4-7" /></CadSvg>;
}
