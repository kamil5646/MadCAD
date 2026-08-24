const { contextBridge } = require('electron');

let version = 1;
let missing = false;

function sourceDocument() {
  const size = version === 1 ? '20' : '30';
  return {
    schemaVersion: 15,
    id: 'document-linked-source',
    name: 'Korpus źródłowy',
    units: 'mm',
    parameters: [],
    sketches: [],
    features: [{ id: 'feature-linked-box', name: 'Korpus', type: 'primitive', suppressed: false, primitiveType: 'box', x: '0', y: '0', z: '0', width: size, depth: '12', height: '8' }],
    timelineRollbackFeatureId: '',
    featureGroups: [],
    linkedProjects: [],
    bodies: [],
    components: [],
    componentInstances: [],
    rigidGroups: [],
    joints: [],
    motionLinks: [],
    contactSets: [],
    assemblyConfigurations: [],
    activeAssemblyConfigurationId: '',
    references: [],
    blocks: [],
    drawings: [],
    layers: [{ id: 'layer-0', name: '0', color: '#ffffff', lineType: 'continuous', lineWeight: 0.25, visible: true, locked: false, printable: true }],
    activeLayerId: 'layer-0',
    print: { profileId: 'creality-ender3', bedWidth: 220, bedDepth: 220, bedHeight: 250, material: 'PLA', positionX: 0, positionY: 0, positionZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, copies: 1, copySpacing: 10, orientationAxis: [0, 0, 1], orientationAngle: 0, nozzleDiameter: 0.4, minimumWallThickness: 0.8, minimumHoleDiameter: 2, overhangAngle: 45, slicer: 'bambu' },
    metadata: { createdAt: '2026-08-24T10:00:00.000Z', modifiedAt: `2026-08-24T10:0${version}:00.000Z` },
  };
}

function result() {
  if (missing) return { ok: false, missing: true, error: 'Nie znaleziono linkowanego projektu.' };
  return {
    ok: true,
    canceled: false,
    relativePath: '../części/korpus.madcad',
    fileName: 'korpus.madcad',
    text: JSON.stringify(sourceDocument()),
    hash: String(version).repeat(64),
    size: 4096,
    modifiedAt: `2026-08-24T10:0${version}:00.000Z`,
  };
}

contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  isDesktop: true,
  appLanguage: 'pl',
  saveTextFile: async () => ({ ok: true, canceled: false, filePath: '/tmp/madcad-linked/main.madcad', backupPath: null }),
  autosaveClear: async () => ({ ok: true }),
  selectLinkedProject: async () => { missing = false; return result(); },
  readLinkedProject: async () => result(),
  packAndGoProject: async () => ({ ok: true, canceled: false, destinationDirectory: '/tmp/Korpus-Pack-and-Go', manifest: { files: [{ path: 'main.madcad' }, { path: 'dependencies/korpus.madcad' }] } }),
  verifyLinkedProjectChange: async () => { version = 2; missing = false; return true; },
  verifyLinkedProjectMissing: async () => { missing = true; return true; },
});
