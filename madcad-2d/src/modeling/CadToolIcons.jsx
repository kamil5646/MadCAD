import React from 'react';

function CadSvg({ children, ...props }) {
  return <svg viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props} fill="none">{children}</svg>;
}

export function SketchCadIcon(props) {
  return <CadSvg {...props}><path d="M3.5 17.5V6.5h11v11z" /><path d="m13.5 16 6.6-6.6-2.5-2.5-6.6 6.6-.8 3.3z" /><path d="m16.3 8.2 2.5 2.5" /></CadSvg>;
}

export function ExtrudeCadIcon(props) {
  return <CadSvg {...props}><path d="m4 15 6 3 6-3-6-3z" /><path d="m10 12 6-3 4 2-4 2" /><path d="M10 12V5m0 0L7.5 7.5M10 5l2.5 2.5" /></CadSvg>;
}

export function PressPullCadIcon(props) {
  return <CadSvg {...props}><path d="m4 14 8 4 8-4-8-4z" /><path d="M12 10V3m0 0L9.5 5.5M12 3l2.5 2.5" /><path d="M12 18v3" /></CadSvg>;
}

export function RevolveCadIcon(props) {
  return <CadSvg {...props}><path d="M8 5v14" strokeDasharray="2 2" /><path d="M10 7h4l2 3-2 3h-4" /><path d="M17.5 6.5a7 7 0 0 1 0 11" /><path d="m17 14.5.5 3 2.8-1" /></CadSvg>;
}

export function SweepCadIcon(props) {
  return <CadSvg {...props}><circle cx="5" cy="17" r="2.5" /><path d="M7.5 17c5 0 3-10 9-10h2" /><path d="m16 4 3 3-3 3" /></CadSvg>;
}

export function LoftCadIcon(props) {
  return <CadSvg {...props}><ellipse cx="12" cy="5" rx="4" ry="2" /><path d="m8 5-4 13m12-13 4 13" /><path d="M4 18h16" /><path d="M6 12h12" /></CadSvg>;
}

export function CoilCadIcon(props) {
  return <CadSvg {...props}><path d="M5 18c0-2 14-2 14-5s-14-3-14-6 14-3 14-1" /><path d="M12 3v18" strokeDasharray="2 2" /></CadSvg>;
}

export function PrimitiveCadIcon(props) {
  return <CadSvg {...props}><path d="m4 8 8-4 8 4-8 4z" /><path d="M4 8v8l8 4 8-4V8M12 12v8" /></CadSvg>;
}

export function HoleCadIcon(props) {
  return <CadSvg {...props}><path d="m3 10 9-5 9 5-9 5z" /><path d="M3 10v6l9 5 9-5v-6" /><ellipse cx="12" cy="10" rx="3" ry="1.6" /><path d="M12 11.6v5" /></CadSvg>;
}

export function PatternCadIcon(props) {
  return <CadSvg {...props}><rect x="3" y="4" width="5" height="5" /><rect x="11" y="4" width="5" height="5" /><rect x="3" y="12" width="5" height="5" /><rect x="11" y="12" width="5" height="5" /><path d="m18 9 3 3-3 3" /></CadSvg>;
}

export function BooleanCadIcon(props) {
  return <CadSvg {...props}><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /><path d="M12 8v8m-4-4h8" /></CadSvg>;
}

export function FilletCadIcon(props) {
  return <CadSvg {...props}><path d="M4 4v16h16" /><path d="M8 20c0-6.6 5.4-12 12-12" /><path d="M8 16v4h4" /></CadSvg>;
}

export function ChamferCadIcon(props) {
  return <CadSvg {...props}><path d="M4 4v16h16" /><path d="m4 14 6 6" /><path d="M4 14h3m3 3v3" /></CadSvg>;
}

export function ShellCadIcon(props) {
  return <CadSvg {...props}><path d="m3 8 9-5 9 5-9 5z" /><path d="M3 8v9l9 4 9-4V8M12 13v8" /><path d="m8 8 4-2 4 2-4 2z" /></CadSvg>;
}

export function DraftCadIcon(props) {
  return <CadSvg {...props}><path d="M7 4h10l3 16H4z" /><path d="M12 4v16" strokeDasharray="2 2" /><path d="m5 16 4-4" /></CadSvg>;
}

export function OffsetFaceCadIcon(props) {
  return <CadSvg {...props}><path d="m3 14 8 4 8-4-8-4z" /><path d="m5 8 6 3 6-3-6-3z" /><path d="M21 7v9m0-9-2 2m2-2 2 2m-2 7-2-2m2 2 2-2" /></CadSvg>;
}

export function DeleteFaceCadIcon(props) {
  return <CadSvg {...props}><path d="m3 8 8-4 8 4-8 4z" /><path d="M3 8v8l8 4 8-4V8M11 12v8" /><path d="m15 12 6 6m0-6-6 6" /></CadSvg>;
}

export function SplitBodyCadIcon(props) {
  return <CadSvg {...props}><path d="m3 8 8-4 8 4-8 4zM3 8v8l8 4 8-4V8M11 12v8" /><path d="M2 13h20" strokeDasharray="2 2" /><path d="m20 11 2 2-2 2" /></CadSvg>;
}

export function SplitFaceCadIcon(props) {
  return <CadSvg {...props}><path d="m3 8 9-4 9 4-9 4z" /><path d="M3 8v8l9 4 9-4V8" /><path d="m12 12 4-6M12 12l-4-6" /></CadSvg>;
}

export function ReplaceFaceCadIcon(props) {
  return <CadSvg {...props}><path d="m3 8 7-4 7 4-7 4zM3 8v7l7 4 7-4V8" /><path d="M16 4h5v5" /><path d="m21 4-7 7" /></CadSvg>;
}

export function MoveBodyCadIcon(props) {
  return <CadSvg {...props}><path d="m4 9 6-3 6 3-6 3zM4 9v6l6 3 6-3V9" /><path d="M18 5h4m0 0-2-2m2 2-2 2M18 19h4m0 0-2-2m2 2-2 2" /></CadSvg>;
}

export function RotateBodyCadIcon(props) {
  return <CadSvg {...props}><path d="m5 9 6-3 6 3-6 3zM5 9v6l6 3 6-3V9" /><path d="M4 5a9 9 0 0 1 15 0" /><path d="m18 2 1 3-3 .5" /></CadSvg>;
}

export function EditFeatureCadIcon(props) {
  return <CadSvg {...props}><path d="m3 9 7-4 7 4-7 4zM3 9v7l7 4 4-2" /><path d="m14 17 6-6 2 2-6 6-3 1z" /></CadSvg>;
}

export function PlaneCadIcon(props) {
  return <CadSvg {...props}><path d="m3 15 8-10 10 4-8 10z" /><path d="M5 19 19 5" strokeDasharray="2 2" /></CadSvg>;
}

export function MidplaneCadIcon(props) {
  return <CadSvg {...props}><path d="m2 8 7-4 5 2-7 4zM10 18l7-4 5 2-7 4z" /><path d="m6 14 7-4 5 2-7 4z" strokeDasharray="2 2" /></CadSvg>;
}

export function ThreePointPlaneCadIcon(props) {
  return <CadSvg {...props}><path d="m3 16 7-11 11 4-7 11z" /><circle cx="6" cy="14" r="1.2" /><circle cx="10" cy="7" r="1.2" /><circle cx="18" cy="10" r="1.2" /></CadSvg>;
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
  return <CadSvg {...props}><ellipse cx="12" cy="6" rx="5" ry="2.5" /><path d="M7 6v12c0 1.4 10 1.4 10 0V6" /><ellipse cx="12" cy="18" rx="5" ry="2.5" /><path d="M12 2v20" strokeDasharray="2 2" /></CadSvg>;
}

export function PointCadIcon(props) {
  return <CadSvg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 3v5m0 8v5M3 12h5m8 0h5" /></CadSvg>;
}

export function SectionCadIcon(props) {
  return <CadSvg {...props}><path d="m3 8 8-4 8 4-8 4zM3 8v8l8 4 8-4V8" /><path d="m8 5 8 14M5 10l8 8M11 4l8 8" /></CadSvg>;
}

export function MassCadIcon(props) {
  return <CadSvg {...props}><path d="m4 8 8-4 8 4-8 4zM4 8v8l8 4 8-4V8" /><circle cx="12" cy="13" r="2" /><path d="M12 11V7" /></CadSvg>;
}

export function GeometryCheckCadIcon(props) {
  return <CadSvg {...props}><path d="m3 8 8-4 8 4-8 4zM3 8v8l8 4 8-4V8" /><path d="m14 15 2 2 5-6" /></CadSvg>;
}
