# MadCAD — Design QA

## Comparison target

- Source visual truth:
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\fusion-audit\02-fusion-design-empty.png`
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\fusion-audit\04-fusion-sketch-workspace.png`
- Normalized source captures:
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\fusion-qa-empty-content.png`
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\fusion-qa-sketch-content.png`
- Rendered implementation:
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\madcad-qa-empty.png`
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\madcad-qa-sketch.png`
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\madcad-direct-extrude.png`
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\modeling-checkpoint.png`
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\madcad-qa-narrow.png`
- Final combined comparison evidence:
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\qa-comparison-empty-pass2.png`
  - `C:\Users\adria\Desktop\MadCAD2D\madcad-2d\artifacts\qa-comparison-sketch-pass2.png`

## Normalization

- Source pixels after removing the 31 px native Windows title bar: 1936 × 1017.
- Implementation pixels and CSS viewport: 1936 × 1017.
- Device scale factor: 1.
- Density normalization: none required after the source crop; source and implementation are compared at equal pixel and CSS dimensions.
- Primary states: empty Design/Bryła workspace and active XY sketch workspace.
- Additional responsive state: 1100 × 760 desktop viewport.

## Findings — final pass

- No actionable P0, P1, or P2 differences remain for the agreed basic Fusion-style workflow.
- Fonts and typography: both use compact Segoe UI-style desktop UI typography. MadCAD preserves the small label hierarchy and avoids wrapping in the tested viewports.
- Spacing and layout rhythm: the 114 px command area, 306 px Browser, full-height viewport, top-right view controls, right sketch palette, and compact bottom timeline reproduce the source composition closely.
- Colors and visual tokens: dark blue-gray chrome, subdued separators, cyan selection, red/green sketch axes, and disabled-command contrast map consistently to the source.
- Image and asset fidelity: the target contains product UI and icons rather than photographic imagery. MadCAD uses a real icon library; no emoji, placeholder imagery, handcrafted SVG, or CSS-drawn product asset replaces source imagery. Autodesk logos and proprietary icons were intentionally not copied.
- Copy and content: Polish command names describe the implemented MadCAD actions. The central empty-state guidance is an intentional onboarding addition rather than source drift.
- Interaction states: active, disabled, selected, loading/ready, empty, sketch-editing, command-dialog, print-check, undo/redo, and export states were exercised.
- Accessibility: visible focus styles, native buttons/inputs/selects, associated field labels, status announcements, and checkbox controls are present. Full assistive-technology certification is outside this visual QA.
- Responsive behavior: at 1100 × 760 there is no horizontal document overflow; the Browser, core creation tools, viewport controls, and timeline remain visible.

## Comparison history

### Pass 1 — blocked

- [P1] Sparse command ribbon made the shell feel unfinished beside Fusion.
  - Fix: expanded the ribbon with grouped Create, Modify, Construct, Inspect, Insert, Select, Export, and contextual Sketch commands using real library icons.
- [P1] The finite, small grid did not read as a CAD workspace.
  - Fix: enlarged and densified the modeling grid so it fills the viewport at the same scale as the reference.
- [P1] Sketch mode lacked Fusion's orientation and option structure.
  - Fix: added red/green axes, a right-side Sketch Palette with working grid toggle, contextual sketch ribbon, and two-click canvas sizing for rectangles/circles.
- [P2] Browser width and regional proportions differed visibly.
  - Fix: changed the desktop Browser track from 280 px to 306 px and retained a compact 226 px responsive track.

### Pass 2 — passed

- Post-fix evidence: `qa-comparison-empty-pass2.png` and `qa-comparison-sketch-pass2.png`.
- The prior P1/P2 differences are resolved. Remaining differences are intentional product scope: MadCAD exposes the implemented basic command set and does not copy Autodesk branding or proprietary assets.

## Focused region evidence

The sketch comparison provides readable evidence for the densest areas: contextual toolbar, Browser hierarchy, sketch axes, command dialog, ViewCube controls, and Sketch Palette. Separate crops were not needed because the equal-size 1936 × 1017 comparison remains legible at original detail.

## Functional verification

- Automated desktop path: new document → XY sketch → rectangle → finish sketch → drag the direct extrusion handle → exact distance edit → extrude → second XY sketch → circle → hole → fillet → chamfer → parameters → undo/redo → 3D print check.
- Direct manipulation: the selected profile exposes a visible 3D arrow; pointer drag updates a translucent solid preview and millimeter label, then transfers the value into the B-Rep command and parametric timeline.
- Control clarity: every active ribbon command keeps a visible label and descriptive hover text; viewport navigation and timeline controls also expose descriptive hover help.
- Honest scope pass: non-functional ribbon placeholders and inactive workspace tabs were removed from the primary interface. Visible primary commands now have real handlers.
- License reminder mode: startup remains unlocked, a non-blocking private/commercial-use reminder is shown, and no device ID, token, key, or activation path exists.
- Exact exports after the full rounded-and-chamfered verification model: STL 582,884 bytes; STEP 73,213 bytes.
- Core tests: 4 passed.
- Runtime console: no application exceptions. Electron reports its development-only CSP warning; OpenCascade emits expected STEP writer diagnostics.

final result: passed
