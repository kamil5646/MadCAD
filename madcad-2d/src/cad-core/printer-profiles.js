export const PRINTER_PROFILES = Object.freeze([
  { id: 'bambu-x1-p1', name: 'Bambu Lab X1/P1', bedWidth: 256, bedDepth: 256, bedHeight: 256 },
  { id: 'prusa-mk4', name: 'Prusa MK4', bedWidth: 250, bedDepth: 210, bedHeight: 220 },
  { id: 'creality-ender3', name: 'Creality Ender-3', bedWidth: 220, bedDepth: 220, bedHeight: 250 },
]);

export const PRINT_MATERIAL_PROFILES = Object.freeze([
  Object.freeze({ id: 'pla', group: 'general', material: 'PLA', name: 'PLA — uniwersalny', nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2, overhangAngle: 45, nozzleTemperature: '195–220°C', bedTemperature: '50–65°C', cooling: 'wysokie', enclosure: 'niewymagana', guidance: 'Punkt wyjścia do analizy zwykłego PLA; właściwe ustawienia dobierz w slicerze.' }),
  Object.freeze({ id: 'petg', group: 'general', material: 'PETG', name: 'PETG — techniczny', nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2.2, overhangAngle: 42, nozzleTemperature: '225–255°C', bedTemperature: '70–90°C', cooling: 'umiarkowane', enclosure: 'niewymagana', guidance: 'Punkt wyjścia do analizy PETG; sprawdź mosty, nawisy i przyczepność do stołu.' }),
  Object.freeze({ id: 'asa', group: 'general', material: 'ASA', name: 'ASA / ABS — obudowy', nozzleDiameter: 0.4, minimumWallThickness: 1.2, minimumHoleDiameter: 2.2, overhangAngle: 45, nozzleTemperature: '240–270°C', bedTemperature: '90–110°C', cooling: 'niskie', enclosure: 'zalecana', guidance: 'Punkt wyjścia do analizy tworzyw kurczliwych; kontroluj komorę i odkształcenia.' }),
  Object.freeze({ id: 'tpu', group: 'general', material: 'TPU', name: 'TPU — elastyczny', nozzleDiameter: 0.4, minimumWallThickness: 1.2, minimumHoleDiameter: 2.5, overhangAngle: 38, nozzleTemperature: '210–240°C', bedTemperature: '35–60°C', cooling: 'umiarkowane', enclosure: 'niewymagana', guidance: 'Punkt wyjścia do analizy elastomeru; drukuj wolniej i ogranicz gwałtowne retrakcje.' }),
  Object.freeze({ id: 'bambu-petg-hf', group: 'manufacturer', manufacturer: 'Bambu Lab', material: 'PETG HF', name: 'PETG HF', nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2.2, overhangAngle: 42, nozzleTemperature: '230–260°C', bedTemperature: '65–75°C', cooling: 'preset producenta', enclosure: 'niewymagana', drying: '65°C przez 8 h', maxSpeed: '300 mm/s', sourceName: 'Bambu Lab PETG HF', sourceUrl: 'https://us.store.bambulab.com/collections/bambu-lab-3d-printer-filament/products/petg-hf', guidance: 'Wysusz przed drukiem i przechowuj poniżej 20% RH. Temperatury dotyczą stołu z klejem.' }),
  Object.freeze({ id: 'prusament-pla', group: 'manufacturer', manufacturer: 'Prusament', material: 'PLA', name: 'PLA', nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2, overhangAngle: 45, nozzleTemperature: '200–220°C', bedTemperature: '40–60°C', cooling: '100%', enclosure: 'niewymagana', maxSpeed: 'do 200 mm/s', sourceName: 'Prusament PLA', sourceUrl: 'https://prusament.com/materials/pla/', guidance: 'Producent zaleca pełne chłodzenie części; podgrzewany stół jest opcjonalny.' }),
  Object.freeze({ id: 'prusament-petg', group: 'manufacturer', manufacturer: 'Prusament', material: 'PETG', name: 'PETG', nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2.2, overhangAngle: 42, nozzleTemperature: '240–260°C', bedTemperature: '70–90°C', cooling: '50%', enclosure: 'niewymagana', maxSpeed: 'do 200 mm/s', sourceName: 'Prusament PETG', sourceUrl: 'https://prusament.com/materials/prusament-petg/', guidance: 'Na gładkim PEI użyj warstwy separacyjnej; ograniczenie chłodzenia poprawia spójność warstw.' }),
  Object.freeze({ id: 'prusament-asa', group: 'manufacturer', manufacturer: 'Prusament', material: 'ASA', name: 'ASA', nozzleDiameter: 0.4, minimumWallThickness: 1.2, minimumHoleDiameter: 2.2, overhangAngle: 45, nozzleTemperature: '255–265°C', bedTemperature: '105–115°C', cooling: '30%', enclosure: 'zalecana', sourceName: 'Prusament ASA', sourceUrl: 'https://prusament.com/materials/prusament-asa/', guidance: 'Osłona lub zamknięta komora ogranicza skurcz, zwłaszcza przy dużych modelach.' }),
  Object.freeze({ id: 'creality-hyper-pla', group: 'manufacturer', manufacturer: 'Creality', material: 'Hyper PLA', name: 'Hyper PLA', nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2, overhangAngle: 45, nozzleTemperature: '190–230°C', bedTemperature: '25–60°C', cooling: '100%', enclosure: 'niewymagana', maxSpeed: 'do 600 mm/s', sourceName: 'Creality Hyper Series PLA', sourceUrl: 'https://store.creality.com/products/hyper-series-pla-3d-printing-filament-1kg', guidance: 'Zakres 30–600 mm/s jest deklaracją producenta; rzeczywistą prędkość ograniczają drukarka i geometria.' }),
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
