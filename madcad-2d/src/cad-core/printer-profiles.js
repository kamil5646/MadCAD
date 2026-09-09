export const PRINTER_PROFILES = Object.freeze([
  { id: 'bambu-x1-p1', name: 'Bambu Lab X1/P1', bedWidth: 256, bedDepth: 256, bedHeight: 256 },
  { id: 'prusa-mk4', name: 'Prusa MK4', bedWidth: 250, bedDepth: 210, bedHeight: 220 },
  { id: 'creality-ender3', name: 'Creality Ender-3', bedWidth: 220, bedDepth: 220, bedHeight: 250 },
]);

export const PRINT_MATERIAL_PROFILES = Object.freeze([
  Object.freeze({ id: 'pla', material: 'PLA', name: 'PLA — uniwersalny', nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2, overhangAngle: 45, nozzleTemperature: '195–220°C', bedTemperature: '50–65°C', guidance: 'Łatwy wydruk bez zamkniętej komory.' }),
  Object.freeze({ id: 'petg', material: 'PETG', name: 'PETG — techniczny', nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2.2, overhangAngle: 42, nozzleTemperature: '225–255°C', bedTemperature: '70–90°C', guidance: 'Ogranicz chłodzenie i sprawdź mosty oraz nawisy.' }),
  Object.freeze({ id: 'asa', material: 'ASA', name: 'ASA / ABS — obudowy', nozzleDiameter: 0.4, minimumWallThickness: 1.2, minimumHoleDiameter: 2.2, overhangAngle: 45, nozzleTemperature: '240–270°C', bedTemperature: '90–110°C', guidance: 'Zalecana zamknięta komora i kontrola skurczu.' }),
  Object.freeze({ id: 'tpu', material: 'TPU', name: 'TPU — elastyczny', nozzleDiameter: 0.4, minimumWallThickness: 1.2, minimumHoleDiameter: 2.5, overhangAngle: 38, nozzleTemperature: '210–240°C', bedTemperature: '35–60°C', guidance: 'Drukuj wolniej i ogranicz gwałtowne retrakcje.' }),
]);

export function applyPrinterProfile(print, profileId) {
  const profile = PRINTER_PROFILES.find((item) => item.id === profileId);
  if (!profile) return { ...print, profileId: 'custom' };
  return { ...print, profileId: profile.id, bedWidth: profile.bedWidth, bedDepth: profile.bedDepth, bedHeight: profile.bedHeight };
}

export function applyPrintMaterialProfile(print, profileId) {
  const profile = PRINT_MATERIAL_PROFILES.find((item) => item.id === profileId);
  if (!profile) return { ...print, materialProfileId: 'custom' };
  return {
    ...print,
    materialProfileId: profile.id,
    material: profile.material,
    nozzleDiameter: profile.nozzleDiameter,
    minimumWallThickness: profile.minimumWallThickness,
    minimumHoleDiameter: profile.minimumHoleDiameter,
    overhangAngle: profile.overhangAngle,
  };
}
