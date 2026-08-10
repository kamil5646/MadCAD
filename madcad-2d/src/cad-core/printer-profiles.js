export const PRINTER_PROFILES = Object.freeze([
  { id: 'bambu-x1-p1', name: 'Bambu Lab X1/P1', bedWidth: 256, bedDepth: 256, bedHeight: 256 },
  { id: 'prusa-mk4', name: 'Prusa MK4', bedWidth: 250, bedDepth: 210, bedHeight: 220 },
  { id: 'creality-ender3', name: 'Creality Ender-3', bedWidth: 220, bedDepth: 220, bedHeight: 250 },
]);

export function applyPrinterProfile(print, profileId) {
  const profile = PRINTER_PROFILES.find((item) => item.id === profileId);
  if (!profile) return { ...print, profileId: 'custom' };
  return { ...print, profileId: profile.id, bedWidth: profile.bedWidth, bedDepth: profile.bedDepth, bedHeight: profile.bedHeight };
}
