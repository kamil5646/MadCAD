import { createId } from './ids.js';
import { evaluateExpression, resolveParameters } from './expressions.js';

export const CAM_MACHINE_PRESETS = Object.freeze({
  'desktop-3018': Object.freeze({ id: 'desktop-3018', name: 'Frezarka biurkowa 3018', kind: 'mill-3axis', travel: [300, 180, 45], maxSpindleRpm: 10000 }),
  'mill-500': Object.freeze({ id: 'mill-500', name: 'Frezarka 3-osiowa 500', kind: 'mill-3axis', travel: [500, 400, 350], maxSpindleRpm: 12000 }),
  'mill-1000': Object.freeze({ id: 'mill-1000', name: 'Frezarka 3-osiowa 1000', kind: 'mill-3axis', travel: [1000, 600, 600], maxSpindleRpm: 18000 }),
  'laser-600': Object.freeze({ id: 'laser-600', name: 'Laser CNC 600 × 400', kind: 'cut-2d', process: 'laser', travel: [600, 400, 50], maxFeedRate: 6000 }),
  'plasma-1250': Object.freeze({ id: 'plasma-1250', name: 'Plazma CNC 1250 × 1250', kind: 'cut-2d', process: 'plasma', travel: [1250, 1250, 100], maxFeedRate: 12000 }),
  'lathe-300': Object.freeze({ id: 'lathe-300', name: 'Tokarka CNC Ø300 × 500', kind: 'turning-2axis', travel: [500, 300, 300], maxSpindleRpm: 3500 }),
});

export const CAM_WCS_ORIGINS = Object.freeze([
  Object.freeze({ id: 'stock-top-center', name: 'Środek górnej powierzchni półfabrykatu' }),
  Object.freeze({ id: 'stock-top-front-left', name: 'Lewy przedni narożnik półfabrykatu' }),
  Object.freeze({ id: 'model-origin', name: 'Początek układu modelu' }),
]);

export const CAM_TOOL_PRESETS = Object.freeze({
  'flat-3': Object.freeze({ id: 'flat-3', name: 'Frez palcowy płaski Ø3', type: 'flat-end-mill', diameter: 3, fluteLength: 12, stickout: 20, holderDiameter: 16, flutes: 2 }),
  'flat-6': Object.freeze({ id: 'flat-6', name: 'Frez palcowy płaski Ø6', type: 'flat-end-mill', diameter: 6, fluteLength: 20, stickout: 30, holderDiameter: 20, flutes: 2 }),
  'face-16': Object.freeze({ id: 'face-16', name: 'Frez do planowania Ø16', type: 'face-mill', diameter: 16, fluteLength: 8, stickout: 25, holderDiameter: 32, flutes: 3 }),
  'drill-3': Object.freeze({ id: 'drill-3', name: 'Wiertło kręte Ø3', type: 'twist-drill', diameter: 3, fluteLength: 25, stickout: 35, holderDiameter: 13, flutes: 2 }),
  'drill-5': Object.freeze({ id: 'drill-5', name: 'Wiertło kręte Ø5', type: 'twist-drill', diameter: 5, fluteLength: 35, stickout: 45, holderDiameter: 13, flutes: 2 }),
  'drill-6': Object.freeze({ id: 'drill-6', name: 'Wiertło kręte Ø6', type: 'twist-drill', diameter: 6, fluteLength: 40, stickout: 50, holderDiameter: 13, flutes: 2 }),
  'drill-6.8': Object.freeze({ id: 'drill-6.8', name: 'Wiertło kręte Ø6,8 (M8)', type: 'twist-drill', diameter: 6.8, fluteLength: 45, stickout: 55, holderDiameter: 13, flutes: 2 }),
  'drill-8': Object.freeze({ id: 'drill-8', name: 'Wiertło kręte Ø8', type: 'twist-drill', diameter: 8, fluteLength: 50, stickout: 60, holderDiameter: 13, flutes: 2 }),
});

export const CAM_HOLE_TOOL_TYPES = Object.freeze([
  Object.freeze({ id: 'twist-drill', name: 'Wiertło kręte' }),
  Object.freeze({ id: 'spot-drill', name: 'Nawiertak' }),
  Object.freeze({ id: 'tap', name: 'Gwintownik' }),
]);

export function normalizeCustomCamTool(tool = {}, index = 0) {
  const type = CAM_HOLE_TOOL_TYPES.some((item) => item.id === tool.type) ? tool.type : 'twist-drill';
  const diameter = Math.min(100, Math.max(0.1, Number(tool.diameter) || 5));
  return {
    id: typeof tool.id === 'string' && tool.id && !CAM_TOOL_PRESETS[tool.id] ? tool.id : createId('cam-tool'),
    name: String(tool.name || `Narzędzie własne ${index + 1}`).trim().slice(0, 80) || `Narzędzie własne ${index + 1}`,
    type,
    diameter,
    fluteLength: Math.min(500, Math.max(0.1, Number(tool.fluteLength) || Math.max(10, diameter * 5))),
    stickout: Math.min(500, Math.max(0.1, Number(tool.stickout) || Math.max(15, diameter * 7))),
    holderDiameter: Math.min(200, Math.max(diameter, Number(tool.holderDiameter) || 13)),
    flutes: Math.min(12, Math.max(1, Math.round(Number(tool.flutes) || (type === 'tap' ? 3 : 2)))),
    pitch: type === 'tap' ? Math.min(10, Math.max(0.1, Number(tool.pitch) || 1)) : null,
    pointAngle: type === 'spot-drill' ? Math.min(170, Math.max(30, Number(tool.pointAngle) || 90)) : null,
  };
}

export function createCustomCamTool(options = {}) {
  return normalizeCustomCamTool({ ...options, id: createId('cam-tool') });
}

export function resolveCamTool(toolId, document = null) {
  return CAM_TOOL_PRESETS[toolId] || document?.manufacturing?.tools?.find((tool) => tool.id === toolId) || null;
}

export const CAM_TURNING_TOOL_PRESETS = Object.freeze({
  'turn-rough-r08': Object.freeze({ id: 'turn-rough-r08', name: 'Nóż zewnętrzny R0,8', type: 'turning-rough', noseRadius: 0.8, stickout: 25 }),
  'turn-finish-r04': Object.freeze({ id: 'turn-finish-r04', name: 'Nóż wykańczający R0,4', type: 'turning-finish', noseRadius: 0.4, stickout: 20 }),
});

export const CAM_POST_PROCESSORS = Object.freeze({
  grbl: Object.freeze({ id: 'grbl', name: 'GRBL 1.1', extension: 'nc', commentStyle: 'semicolon', toolChange: false }),
  linuxcnc: Object.freeze({ id: 'linuxcnc', name: 'LinuxCNC', extension: 'ngc', commentStyle: 'parentheses', toolChange: true }),
  mach3: Object.freeze({ id: 'mach3', name: 'Mach3 / Mach4', extension: 'tap', commentStyle: 'parentheses', toolChange: true }),
  'grbl-laser': Object.freeze({ id: 'grbl-laser', name: 'GRBL Laser', extension: 'nc', commentStyle: 'semicolon', toolChange: false }),
  'linuxcnc-plasma': Object.freeze({ id: 'linuxcnc-plasma', name: 'LinuxCNC Plasma', extension: 'ngc', commentStyle: 'parentheses', toolChange: false }),
  'linuxcnc-turn': Object.freeze({ id: 'linuxcnc-turn', name: 'LinuxCNC Tokarka', extension: 'ngc', commentStyle: 'parentheses', toolChange: true }),
});

const normalizePostProcessorId = (value) => CAM_POST_PROCESSORS[value] ? value : 'grbl';

export function normalizeFacingOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Planowanie ${index + 1}`).trim().slice(0, 80) || `Planowanie ${index + 1}`,
    type: 'face',
    toolId: CAM_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'flat-6',
    stepover: Math.min(0.9, Math.max(0.1, Number(operation.stepover) || 0.6)),
    maxStepdown: Math.max(0.05, Number(operation.maxStepdown) || 1),
    feedRate: Math.max(1, Number(operation.feedRate) || 600),
    plungeRate: Math.max(1, Number(operation.plungeRate) || 180),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 8000)),
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
  };
}

export function normalizeContourOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Kontur 2D ${index + 1}`).trim().slice(0, 80) || `Kontur 2D ${index + 1}`,
    type: 'contour',
    toolId: CAM_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'flat-6',
    targetDepth: Math.max(0.05, Number(operation.targetDepth) || 2),
    maxStepdown: Math.max(0.05, Number(operation.maxStepdown) || 1),
    feedRate: Math.max(1, Number(operation.feedRate) || 500),
    plungeRate: Math.max(1, Number(operation.plungeRate) || 150),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 8000)),
    compensation: 'outside',
    boundaryFaceId: typeof operation.boundaryFaceId === 'string' ? operation.boundaryFaceId : '',
    boundarySketchId: typeof operation.boundarySketchId === 'string' ? operation.boundarySketchId : '',
    boundaryProfileId: typeof operation.boundaryProfileId === 'string' ? operation.boundaryProfileId : '',
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
  };
}

export function normalizePocketOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Kieszeń 2D ${index + 1}`).trim().slice(0, 80) || `Kieszeń 2D ${index + 1}`,
    type: 'pocket',
    toolId: CAM_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'flat-6',
    targetDepth: Math.max(0.05, Number(operation.targetDepth) || 2),
    maxStepdown: Math.max(0.05, Number(operation.maxStepdown) || 1),
    stepover: Math.min(0.8, Math.max(0.1, Number(operation.stepover) || 0.45)),
    feedRate: Math.max(1, Number(operation.feedRate) || 500),
    plungeRate: Math.max(1, Number(operation.plungeRate) || 150),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 8000)),
    boundary: 'body-top',
    boundaryFaceId: typeof operation.boundaryFaceId === 'string' ? operation.boundaryFaceId : '',
    boundarySketchId: typeof operation.boundarySketchId === 'string' ? operation.boundarySketchId : '',
    boundaryProfileId: typeof operation.boundaryProfileId === 'string' ? operation.boundaryProfileId : '',
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
  };
}

export function normalizeAdaptiveOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Adaptacyjne 2D ${index + 1}`).trim().slice(0, 80) || `Adaptacyjne 2D ${index + 1}`,
    type: 'adaptive',
    toolId: CAM_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'flat-6',
    targetDepth: Math.max(0.05, Number(operation.targetDepth) || 2),
    maxStepdown: Math.max(0.05, Number(operation.maxStepdown) || 1),
    optimalLoad: Math.min(0.6, Math.max(0.1, Number(operation.optimalLoad) || 0.3)),
    feedRate: Math.max(1, Number(operation.feedRate) || 650),
    plungeRate: Math.max(1, Number(operation.plungeRate) || 160),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 9000)),
    boundary: 'body-top',
    boundaryFaceId: typeof operation.boundaryFaceId === 'string' ? operation.boundaryFaceId : '',
    boundarySketchId: typeof operation.boundarySketchId === 'string' ? operation.boundarySketchId : '',
    boundaryProfileId: typeof operation.boundaryProfileId === 'string' ? operation.boundaryProfileId : '',
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
  };
}

export function normalizeDrillingOperation(operation = {}, index = 0) {
  const cycleType = ['normal', 'peck', 'dwell'].includes(operation.cycleType) ? operation.cycleType : 'peck';
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Wiercenie ${index + 1}`).trim().slice(0, 80) || `Wiercenie ${index + 1}`,
    type: 'drill',
    toolId: typeof operation.toolId === 'string' && operation.toolId ? operation.toolId : 'drill-5',
    holeFeatureIds: Array.isArray(operation.holeFeatureIds) ? [...new Set(operation.holeFeatureIds.filter((id) => typeof id === 'string' && id))] : [],
    cycleType,
    peckDepth: Math.max(0.05, Number(operation.peckDepth) || 3),
    dwellSeconds: Number.isFinite(Number(operation.dwellSeconds)) ? Math.min(60, Math.max(0, Number(operation.dwellSeconds))) : 0.5,
    retractHeight: Number.isFinite(Number(operation.retractHeight)) ? Math.max(0, Number(operation.retractHeight)) : 1,
    breakthroughDepth: Number.isFinite(Number(operation.breakthroughDepth)) ? Math.max(0, Number(operation.breakthroughDepth)) : 0.2,
    feedRate: Math.max(1, Number(operation.feedRate) || 120),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 3000)),
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
  };
}

export function normalizeTappingOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Gwintowanie ${index + 1}`).trim().slice(0, 80) || `Gwintowanie ${index + 1}`,
    type: 'tap',
    toolId: typeof operation.toolId === 'string' ? operation.toolId : '',
    holeFeatureIds: Array.isArray(operation.holeFeatureIds) ? [...new Set(operation.holeFeatureIds.filter((id) => typeof id === 'string' && id))] : [],
    retractHeight: Number.isFinite(Number(operation.retractHeight)) ? Math.max(0, Number(operation.retractHeight)) : 1,
    bottomClearance: Number.isFinite(Number(operation.bottomClearance)) ? Math.max(0, Number(operation.bottomClearance)) : 1,
    spindleRpm: Math.min(3000, Math.max(1, Math.round(Number(operation.spindleRpm) || 500))),
    postProcessorId: ['linuxcnc', 'mach3'].includes(operation.postProcessorId) ? operation.postProcessorId : 'linuxcnc',
  };
}

export function normalizeSpotDrillingOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Nawiertanie ${index + 1}`).trim().slice(0, 80) || `Nawiertanie ${index + 1}`,
    type: 'spot',
    toolId: typeof operation.toolId === 'string' ? operation.toolId : '',
    holeFeatureIds: Array.isArray(operation.holeFeatureIds) ? [...new Set(operation.holeFeatureIds.filter((id) => typeof id === 'string' && id))] : [],
    targetDiameter: Math.max(0.1, Number(operation.targetDiameter) || 10),
    retractHeight: Number.isFinite(Number(operation.retractHeight)) ? Math.max(0, Number(operation.retractHeight)) : 1,
    feedRate: Math.max(1, Number(operation.feedRate) || 100),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 2500)),
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
  };
}

export function normalizeCounterboreOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Pogłębianie walcowe ${index + 1}`).trim().slice(0, 80) || `Pogłębianie walcowe ${index + 1}`,
    type: 'counterbore',
    toolId: CAM_TOOL_PRESETS[operation.toolId]?.type === 'flat-end-mill' ? operation.toolId : 'flat-6',
    holeFeatureIds: Array.isArray(operation.holeFeatureIds) ? [...new Set(operation.holeFeatureIds.filter((id) => typeof id === 'string' && id))] : [],
    targetDiameter: Math.max(0.1, Number(operation.targetDiameter) || 12),
    targetDepth: Math.max(0.05, Number(operation.targetDepth) || 2),
    maxStepdown: Math.max(0.05, Number(operation.maxStepdown) || 1),
    retractHeight: Number.isFinite(Number(operation.retractHeight)) ? Math.max(0, Number(operation.retractHeight)) : 1,
    feedRate: Math.max(1, Number(operation.feedRate) || 300),
    plungeRate: Math.max(1, Number(operation.plungeRate) || 100),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 8000)),
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
  };
}

export function normalizeCut2dOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Cięcie konturu ${index + 1}`).trim().slice(0, 80) || `Cięcie konturu ${index + 1}`,
    type: 'cut2d',
    kerfWidth: Math.max(0.01, Number(operation.kerfWidth) || 0.2),
    leadIn: Math.max(0, Number(operation.leadIn) || 2),
    feedRate: Math.max(1, Number(operation.feedRate) || 1200),
    powerPercent: Math.min(100, Math.max(1, Number(operation.powerPercent) || 80)),
    passes: Math.min(100, Math.max(1, Math.round(Number(operation.passes) || 1))),
    compensation: ['inside', 'center', 'outside'].includes(operation.compensation) ? operation.compensation : 'outside',
    boundaryFaceId: typeof operation.boundaryFaceId === 'string' ? operation.boundaryFaceId : '',
    boundarySketchId: typeof operation.boundarySketchId === 'string' ? operation.boundarySketchId : '',
    boundaryProfileId: typeof operation.boundaryProfileId === 'string' ? operation.boundaryProfileId : '',
    postProcessorId: ['grbl-laser', 'linuxcnc-plasma'].includes(operation.postProcessorId) ? operation.postProcessorId : 'grbl-laser',
  };
}

export function normalizeTurningOperation(operation = {}, index = 0) {
  const type = operation.type === 'turn-profile' ? 'turn-profile' : 'turn-face';
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || (type === 'turn-profile' ? `Toczenie zewnętrzne ${index + 1}` : `Planowanie czoła ${index + 1}`)).trim().slice(0, 80),
    type,
    toolId: CAM_TURNING_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'turn-rough-r08',
    stockDiameter: Math.max(0.1, Number(operation.stockDiameter) || 50),
    targetDiameter: Math.max(0.1, Number(operation.targetDiameter) || 40),
    axialLength: Math.max(0.1, Number(operation.axialLength) || 20),
    maxDepthOfCut: Math.max(0.05, Number(operation.maxDepthOfCut) || 1),
    feedRate: Math.max(0.01, Number(operation.feedRate) || 0.2),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 1200)),
    postProcessorId: 'linuxcnc-turn',
  };
}

export function normalizeManufacturingOperation(operation = {}, index = 0) {
  let normalized;
  if (operation?.type === 'contour') normalized = normalizeContourOperation(operation, index);
  else if (operation?.type === 'pocket') normalized = normalizePocketOperation(operation, index);
  else if (operation?.type === 'adaptive') normalized = normalizeAdaptiveOperation(operation, index);
  else if (operation?.type === 'drill') normalized = normalizeDrillingOperation(operation, index);
  else if (operation?.type === 'tap') normalized = normalizeTappingOperation(operation, index);
  else if (operation?.type === 'spot') normalized = normalizeSpotDrillingOperation(operation, index);
  else if (operation?.type === 'counterbore') normalized = normalizeCounterboreOperation(operation, index);
  else if (operation?.type === 'cut2d') normalized = normalizeCut2dOperation(operation, index);
  else if (operation?.type === 'turn-face' || operation?.type === 'turn-profile') normalized = normalizeTurningOperation(operation, index);
  else normalized = normalizeFacingOperation(operation, index);
  return { ...normalized, groupId: typeof operation.groupId === 'string' ? operation.groupId : '' };
}

const finiteNonNegative = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

export function normalizeManufacturingSetup(setup = {}, index = 0) {
  const machineId = CAM_MACHINE_PRESETS[setup.machineId] ? setup.machineId : 'mill-500';
  const wcsOrigin = CAM_WCS_ORIGINS.some((item) => item.id === setup.wcsOrigin) ? setup.wcsOrigin : 'stock-top-center';
  const groupIds = new Set();
  const operationGroups = (Array.isArray(setup.operationGroups) ? setup.operationGroups : []).slice(0, 50).map((group, groupIndex) => {
    const requestedId = typeof group?.id === 'string' && group.id ? group.id : createId('cam-group');
    const id = groupIds.has(requestedId) ? createId('cam-group') : requestedId;
    groupIds.add(id);
    return {
      id,
      name: String(group?.name || `Folder ${groupIndex + 1}`).trim().slice(0, 80) || `Folder ${groupIndex + 1}`,
      collapsed: Boolean(group?.collapsed),
    };
  });
  const operations = (Array.isArray(setup.operations) ? setup.operations : []).map(normalizeManufacturingOperation)
    .map((operation) => ({ ...operation, groupId: groupIds.has(operation.groupId) ? operation.groupId : '' }));
  return {
    id: typeof setup.id === 'string' && setup.id ? setup.id : createId('cam-setup'),
    name: String(setup.name || `Setup ${index + 1}`).trim().slice(0, 80) || `Setup ${index + 1}`,
    operationKind: CAM_MACHINE_PRESETS[machineId].kind,
    bodyId: typeof setup.bodyId === 'string' ? setup.bodyId : '',
    machineId,
    stock: {
      sideOffset: finiteNonNegative(setup.stock?.sideOffset, 2),
      topOffset: finiteNonNegative(setup.stock?.topOffset, 2),
      bottomOffset: finiteNonNegative(setup.stock?.bottomOffset, 0),
    },
    wcsOrigin,
    safeHeight: finiteNonNegative(setup.safeHeight, 5),
    operationGroups,
    operations,
  };
}

export function normalizeManufacturingOperationTemplate(template = {}, index = 0) {
  const source = template?.operation && typeof template.operation === 'object' ? template.operation : template;
  const operation = normalizeManufacturingOperation(source, index);
  return {
    id: typeof template.id === 'string' && template.id ? template.id : createId('cam-template'),
    name: String(template.name || operation.name || `Szablon ${index + 1}`).trim().slice(0, 80) || `Szablon ${index + 1}`,
    operation: {
      ...operation,
      id: '',
      name: String(operation.name || template.name || `Operacja ${index + 1}`).trim().slice(0, 80),
      groupId: '',
      ...(Object.hasOwn(operation, 'boundaryFaceId') ? { boundaryFaceId: '' } : {}),
      ...(Object.hasOwn(operation, 'boundarySketchId') ? { boundarySketchId: '' } : {}),
      ...(Object.hasOwn(operation, 'boundaryProfileId') ? { boundaryProfileId: '' } : {}),
      ...(Object.hasOwn(operation, 'holeFeatureIds') ? { holeFeatureIds: [] } : {}),
    },
  };
}

export function ensureDocumentManufacturing(document) {
  if (!document.manufacturing || typeof document.manufacturing !== 'object' || Array.isArray(document.manufacturing)) {
    document.manufacturing = { setups: [], activeSetupId: '', tools: [], operationTemplates: [] };
  }
  if (!Array.isArray(document.manufacturing.setups)) document.manufacturing.setups = [];
  if (!Array.isArray(document.manufacturing.tools)) document.manufacturing.tools = [];
  if (!Array.isArray(document.manufacturing.operationTemplates)) document.manufacturing.operationTemplates = [];
  document.manufacturing.tools = document.manufacturing.tools.slice(0, 100).map(normalizeCustomCamTool);
  document.manufacturing.operationTemplates = document.manufacturing.operationTemplates.slice(0, 100).map(normalizeManufacturingOperationTemplate);
  document.manufacturing.setups = document.manufacturing.setups.map(normalizeManufacturingSetup);
  if (typeof document.manufacturing.activeSetupId !== 'string') document.manufacturing.activeSetupId = '';
  if (!document.manufacturing.setups.some((setup) => setup.id === document.manufacturing.activeSetupId)) {
    document.manufacturing.activeSetupId = document.manufacturing.setups[0]?.id || '';
  }
  return document;
}

export function createManufacturingSetup(options = {}) {
  return normalizeManufacturingSetup({ ...options, id: createId('cam-setup') });
}

export function createManufacturingOperationGroup(options = {}) {
  return {
    id: createId('cam-group'),
    name: String(options.name || 'Nowy folder').trim().slice(0, 80) || 'Nowy folder',
    collapsed: Boolean(options.collapsed),
  };
}

export function deleteManufacturingOperationGroup(setup, groupId) {
  const normalized = normalizeManufacturingSetup(setup);
  if (!normalized.operationGroups.some((group) => group.id === groupId)) return { ...normalized, changed: false };
  return {
    ...normalized,
    changed: true,
    operationGroups: normalized.operationGroups.filter((group) => group.id !== groupId),
    operations: normalized.operations.map((operation) => operation.groupId === groupId ? { ...operation, groupId: '' } : operation),
  };
}

export function createManufacturingOperationTemplate(operation, options = {}) {
  if (!operation || typeof operation !== 'object') throw new Error('Szablon wymaga istniejącej operacji CAM.');
  return normalizeManufacturingOperationTemplate({
    id: createId('cam-template'),
    name: options.name || `${operation.name || 'Operacja'} — szablon`,
    operation,
  });
}

const operationMatchesSetupKind = (operation, operationKind) => {
  const turning = operation.type === 'turn-face' || operation.type === 'turn-profile';
  if (operationKind === 'turning-2axis') return turning;
  if (operationKind === 'cut-2d') return operation.type === 'cut2d';
  return !turning && operation.type !== 'cut2d';
};

export function instantiateManufacturingOperationTemplate(template, setup, options = {}) {
  const normalizedTemplate = normalizeManufacturingOperationTemplate(template);
  const normalizedSetup = normalizeManufacturingSetup(setup);
  if (!operationMatchesSetupKind(normalizedTemplate.operation, normalizedSetup.operationKind)) {
    throw new Error('Typ operacji w szablonie nie pasuje do rodzaju aktywnego Setupu.');
  }
  const baseName = String(options.name || normalizedTemplate.operation.name || normalizedTemplate.name).trim().slice(0, 80) || 'Operacja z szablonu';
  const names = new Set(normalizedSetup.operations.map((operation) => operation.name.toLocaleLowerCase()));
  let name = baseName;
  let copyNumber = 2;
  while (names.has(name.toLocaleLowerCase())) name = `${baseName} ${copyNumber++}`.slice(0, 80);
  return normalizeManufacturingOperation({
    ...normalizedTemplate.operation,
    id: createId('cam-operation'),
    name,
    groupId: typeof options.groupId === 'string' ? options.groupId : '',
  }, normalizedSetup.operations.length);
}

export function calculateManufacturingSetup(setup, bodies = []) {
  const normalized = normalizeManufacturingSetup(setup);
  const machine = CAM_MACHINE_PRESETS[normalized.machineId];
  const body = bodies.find((item) => item.id === normalized.bodyId);
  if (!body) return { valid: false, machine, body: null, warnings: ['Wybierz istniejącą bryłę do obróbki.'] };
  const bounds = body.bounds || body.metrics?.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 2 || bounds.flat().length !== 6 || bounds.flat().some((value) => !Number.isFinite(Number(value)))) {
    return { valid: false, machine, body, warnings: ['Silnik CAD nie zwrócił prawidłowych granic wybranej bryły.'] };
  }
  const minimum = bounds[0].map(Number);
  const maximum = bounds[1].map(Number);
  const side = normalized.stock.sideOffset;
  const stockBounds = [
    [minimum[0] - side, minimum[1] - side, minimum[2] - normalized.stock.bottomOffset],
    [maximum[0] + side, maximum[1] + side, maximum[2] + normalized.stock.topOffset],
  ];
  const dimensions = stockBounds[1].map((value, axis) => value - stockBounds[0][axis]);
  let origin;
  if (machine.kind === 'turning-2axis') origin = [stockBounds[1][0], (stockBounds[0][1] + stockBounds[1][1]) / 2, (stockBounds[0][2] + stockBounds[1][2]) / 2];
  else if (normalized.wcsOrigin === 'model-origin') origin = [0, 0, 0];
  else if (normalized.wcsOrigin === 'stock-top-front-left') origin = [stockBounds[0][0], stockBounds[0][1], stockBounds[1][2]];
  else origin = [(stockBounds[0][0] + stockBounds[1][0]) / 2, (stockBounds[0][1] + stockBounds[1][1]) / 2, stockBounds[1][2]];
  const warnings = [];
  const exceededAxes = dimensions.map((value, axis) => value > machine.travel[axis] ? ['X', 'Y', 'Z'][axis] : null).filter(Boolean);
  if (exceededAxes.length) warnings.push(`Półfabrykat przekracza przesuw maszyny w osi ${exceededAxes.join(', ')}.`);
  if (dimensions.some((value) => value <= 0)) warnings.push('Półfabrykat musi mieć dodatnie wymiary.');
  const clearancePlaneZ = origin[2] + normalized.safeHeight;
  if (machine.kind !== 'turning-2axis' && clearancePlaneZ <= stockBounds[1][2] + 1e-7) warnings.push('Płaszczyzna bezpieczna musi znajdować się ponad górą półfabrykatu.');
  return {
    valid: warnings.length === 0,
    machine,
    body,
    stockBounds,
    dimensions,
    origin,
    clearancePlaneZ,
    warnings,
  };
}

export function createFacingOperation(options = {}) {
  return normalizeFacingOperation({ ...options, id: createId('cam-operation') });
}

export function createContourOperation(options = {}) {
  return normalizeContourOperation({ ...options, id: createId('cam-operation') });
}

export function createPocketOperation(options = {}) {
  return normalizePocketOperation({ ...options, id: createId('cam-operation') });
}

export function createAdaptiveOperation(options = {}) {
  return normalizeAdaptiveOperation({ ...options, id: createId('cam-operation') });
}

export function createDrillingOperation(options = {}) {
  return normalizeDrillingOperation({ ...options, id: createId('cam-operation') });
}

export function createTappingOperation(options = {}) {
  return normalizeTappingOperation({ ...options, id: createId('cam-operation') });
}

export function createSpotDrillingOperation(options = {}) {
  return normalizeSpotDrillingOperation({ ...options, id: createId('cam-operation') });
}

export function createCounterboreOperation(options = {}) {
  return normalizeCounterboreOperation({ ...options, id: createId('cam-operation') });
}

export function createCut2dOperation(options = {}) {
  return normalizeCut2dOperation({ ...options, id: createId('cam-operation') });
}

export function createTurningOperation(type = 'turn-face', options = {}) {
  return normalizeTurningOperation({ ...options, type, id: createId('cam-operation') });
}

export function calculateFacingToolpath(setup, operation, bodies = []) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeFacingOperation(operation);
  const tool = CAM_TOOL_PRESETS[normalized.toolId];
  if (!setupResult.stockBounds || !setupResult.body) return { valid: false, tool, segments: [], warnings: setupResult.warnings };
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const stockTop = setupResult.stockBounds[1][2];
  const targetZ = Number(bodyBounds[1][2]);
  const depth = stockTop - targetZ;
  if (depth <= 1e-9) return { valid: false, tool, segments: [], warnings: ['Planowanie wymaga dodatniego naddatku na górze półfabrykatu.'] };
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return { valid: false, tool, segments: [], warnings: [`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`] };
  const radius = tool.diameter / 2;
  const [stockMin, stockMax] = setupResult.stockBounds;
  const xMin = stockMin[0] - radius;
  const xMax = stockMax[0] + radius;
  const yMin = stockMin[1] - radius;
  const yMax = stockMax[1] + radius;
  const layerCount = Math.max(1, Math.ceil(depth / normalized.maxStepdown));
  const rowStep = tool.diameter * normalized.stepover;
  const rowCount = Math.max(2, Math.ceil((yMax - yMin) / rowStep) + 1);
  const segments = [];
  let previous = [xMin, yMin, setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => { segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) }); previous = to; };
  for (let layer = 1; layer <= layerCount; layer += 1) {
    const z = stockTop - Math.min(depth, layer * depth / layerCount);
    push('rapid', [xMin, yMin, setupResult.clearancePlaneZ]);
    push('plunge', [xMin, yMin, z], normalized.plungeRate);
    for (let row = 0; row < rowCount; row += 1) {
      const y = Math.min(yMax, yMin + row * (yMax - yMin) / (rowCount - 1));
      const x = row % 2 === 0 ? xMax : xMin;
      push('cut', [x, y, z], normalized.feedRate);
      if (row < rowCount - 1) {
        const nextY = Math.min(yMax, yMin + (row + 1) * (yMax - yMin) / (rowCount - 1));
        push('cut', [x, nextY, z], normalized.feedRate);
      }
    }
    push('rapid', [previous[0], previous[1], setupResult.clearancePlaneZ]);
  }
  const distance = segments.reduce((sum, segment) => sum + Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis])), 0);
  const cuttingDistance = segments.filter((segment) => segment.kind !== 'rapid').reduce((sum, segment) => sum + Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis])), 0);
  const durationMinutes = segments.reduce((sum, segment) => {
    const length = Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis]));
    return sum + length / (segment.kind === 'rapid' ? 3000 : segment.feed);
  }, 0);
  const estimatedRemovedVolume = Math.max(0, (stockMax[0] - stockMin[0]) * (stockMax[1] - stockMin[1]) * depth);
  return { valid: setupResult.valid, setup: setupResult, stockBounds: setupResult.stockBounds, origin: setupResult.origin, clearancePlaneZ: setupResult.clearancePlaneZ, operation: normalized, tool, segments, layerCount, rowCount, distance, cuttingDistance, durationMinutes, estimatedRemovedVolume, warnings: setupResult.warnings };
}

const pointKey = (point, tolerance) => `${Math.round(point[0] / tolerance)},${Math.round(point[1] / tolerance)}`;
const signedPolygonArea = (points) => points.reduce((area, point, index) => {
  const next = points[(index + 1) % points.length];
  return area + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;

export function extractTopBoundaryLoops(body, faceId = '') {
  const vertices = Array.from(body?.vertices || []);
  const allTriangles = Array.from(body?.triangles || []);
  const bounds = body?.bounds || body?.metrics?.bounds;
  if (vertices.length < 9 || allTriangles.length < 3 || !Array.isArray(bounds?.[1])) return [];
  const faceGroup = faceId ? body?.faceGroups?.find((group) => group.topologyId === faceId) : null;
  if (faceId && !faceGroup) return [];
  const triangles = faceGroup ? allTriangles.slice(faceGroup.start, faceGroup.start + faceGroup.count) : allTriangles;
  const span = Math.max(1, ...bounds[1].map((value, axis) => Math.abs(Number(value) - Number(bounds[0]?.[axis] || 0))));
  const tolerance = Math.max(1e-7, span * 1e-6);
  const topZ = faceGroup
    ? vertices[triangles[0] * 3 + 2]
    : vertices.reduce((maximum, value, index) => index % 3 === 2 ? Math.max(maximum, value) : maximum, -Infinity);
  if (faceGroup && triangles.some((vertexIndex) => Math.abs(vertices[vertexIndex * 3 + 2] - topZ) > tolerance)) return [];
  const points = new Map();
  const edges = new Map();
  const addEdge = (a, b) => {
    const aKey = pointKey(a, tolerance);
    const bKey = pointKey(b, tolerance);
    if (aKey === bKey) return;
    points.set(aKey, [a[0], a[1]]);
    points.set(bKey, [b[0], b[1]]);
    const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
    const entry = edges.get(key) || { a: aKey, b: bKey, count: 0 };
    entry.count += 1;
    edges.set(key, entry);
  };
  for (let index = 0; index + 2 < triangles.length; index += 3) {
    const triangle = triangles.slice(index, index + 3).map((vertexIndex) => vertices.slice(vertexIndex * 3, vertexIndex * 3 + 3));
    if (triangle.some((point) => point.length < 3 || Math.abs(point[2] - topZ) > tolerance)) continue;
    addEdge(triangle[0], triangle[1]);
    addEdge(triangle[1], triangle[2]);
    addEdge(triangle[2], triangle[0]);
  }
  const boundary = [...edges.values()].filter((edge) => edge.count === 1);
  const adjacency = new Map();
  for (const edge of boundary) {
    adjacency.set(edge.a, [...(adjacency.get(edge.a) || []), edge.b]);
    adjacency.set(edge.b, [...(adjacency.get(edge.b) || []), edge.a]);
  }
  const unused = new Set(boundary.map((edge) => edge.a < edge.b ? `${edge.a}|${edge.b}` : `${edge.b}|${edge.a}`));
  const loops = [];
  while (unused.size) {
    const firstEdge = unused.values().next().value;
    const [start, next] = firstEdge.split('|');
    const keys = [start];
    let previous = start;
    let current = next;
    unused.delete(firstEdge);
    while (current !== start && keys.length <= boundary.length + 1) {
      keys.push(current);
      const candidate = (adjacency.get(current) || []).find((item) => {
        const edgeKey = current < item ? `${current}|${item}` : `${item}|${current}`;
        return item !== previous && unused.has(edgeKey);
      });
      if (!candidate) break;
      const edgeKey = current < candidate ? `${current}|${candidate}` : `${candidate}|${current}`;
      unused.delete(edgeKey);
      previous = current;
      current = candidate;
    }
    if (current === start && keys.length >= 3) loops.push(keys.map((key) => points.get(key)));
  }
  return loops.sort((a, b) => Math.abs(signedPolygonArea(b)) - Math.abs(signedPolygonArea(a)));
}

export function offsetClosedContour(points, distance) {
  if (!Array.isArray(points) || points.length < 3 || !Number.isFinite(distance) || Math.abs(distance) <= 1e-9) return points?.map((point) => [...point]) || [];
  const orientation = Math.sign(signedPolygonArea(points)) || 1;
  const lineIntersection = (a, directionA, b, directionB) => {
    const cross = directionA[0] * directionB[1] - directionA[1] * directionB[0];
    if (Math.abs(cross) < 1e-9) return null;
    const delta = [b[0] - a[0], b[1] - a[1]];
    const t = (delta[0] * directionB[1] - delta[1] * directionB[0]) / cross;
    return [a[0] + t * directionA[0], a[1] + t * directionA[1]];
  };
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const normalize = (vector) => {
      const length = Math.hypot(...vector) || 1;
      return vector.map((value) => value / length);
    };
    const incoming = normalize([point[0] - previous[0], point[1] - previous[1]]);
    const outgoing = normalize([next[0] - point[0], next[1] - point[1]]);
    const outward = (direction) => orientation > 0 ? [direction[1], -direction[0]] : [-direction[1], direction[0]];
    const normalA = outward(incoming);
    const normalB = outward(outgoing);
    const offsetA = [point[0] + normalA[0] * distance, point[1] + normalA[1] * distance];
    const offsetB = [point[0] + normalB[0] * distance, point[1] + normalB[1] * distance];
    const intersection = lineIntersection(offsetA, incoming, offsetB, outgoing);
    if (intersection && Math.hypot(intersection[0] - point[0], intersection[1] - point[1]) <= Math.abs(distance) * 5) return intersection;
    const bisector = normalize([normalA[0] + normalB[0], normalA[1] + normalB[1]]);
    return [point[0] + bisector[0] * distance, point[1] + bisector[1] * distance];
  });
}

function boundaryPlaneZ(body, faceId = '') {
  const vertices = Array.from(body?.vertices || []);
  const triangles = Array.from(body?.triangles || []);
  const faceGroup = faceId ? body?.faceGroups?.find((group) => group.topologyId === faceId) : null;
  if (faceGroup && Number.isInteger(triangles[faceGroup.start])) return vertices[triangles[faceGroup.start] * 3 + 2];
  return vertices.length >= 3
    ? vertices.reduce((maximum, value, index) => index % 3 === 2 ? Math.max(maximum, value) : maximum, -Infinity)
    : Number((body?.bounds || body?.metrics?.bounds)?.[1]?.[2]);
}

function resolveSketchProfileBoundary(document, operation) {
  if (!operation.boundarySketchId && !operation.boundaryProfileId) return null;
  if (!document) throw new Error('Dokument projektu jest wymagany do odtworzenia granicy profilu szkicu.');
  const sketch = document.sketches?.find((item) => item.id === operation.boundarySketchId);
  const profile = sketch?.profiles?.find((item) => item.id === operation.boundaryProfileId);
  if (!sketch || !profile) throw new Error('Wybrany profil szkicu już nie istnieje. Wskaż nową granicę operacji.');
  if (sketch.space === '3d' || sketch.plane !== 'XY') throw new Error('CAM 2D wymaga profilu szkicu na poziomej płaszczyźnie XY.');
  const parameters = resolveParameters(document.parameters || []);
  if (!parameters.valid) throw new Error('Nie można obliczyć profilu, ponieważ jego parametry zawierają błąd.');
  const read = (value) => evaluateExpression(value ?? 0, parameters.values);
  let points;
  if (profile.type === 'rectangle') {
    const x = read(profile.geometry?.x);
    const y = read(profile.geometry?.y);
    const halfWidth = read(profile.geometry?.width) / 2;
    const halfHeight = read(profile.geometry?.height) / 2;
    points = [[x - halfWidth, y - halfHeight], [x + halfWidth, y - halfHeight], [x + halfWidth, y + halfHeight], [x - halfWidth, y + halfHeight]];
  } else if (profile.type === 'circle') {
    const x = read(profile.geometry?.x);
    const y = read(profile.geometry?.y);
    const radius = read(profile.geometry?.diameter) / 2;
    points = Array.from({ length: 72 }, (_unused, index) => {
      const angle = index / 72 * Math.PI * 2;
      return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
    });
  } else {
    points = (profile.geometry?.points || []).map((point) => [read(point.x), read(point.y)]);
    if (points.length > 3 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) <= 1e-7) points.pop();
  }
  if (points.length < 3 || points.some((point) => !point.every(Number.isFinite)) || Math.abs(signedPolygonArea(points)) <= 1e-7) throw new Error('Wybrany profil nie tworzy prawidłowej zamkniętej granicy CAM.');
  return { loops: [points], planeZ: read(sketch.planeOffset || 0), source: 'sketch-profile' };
}

function resolveOperationBoundary(setupResult, operation, document) {
  const sketchBoundary = resolveSketchProfileBoundary(document, operation);
  if (sketchBoundary) {
    const [minimum, maximum] = setupResult.stockBounds;
    if (sketchBoundary.loops[0].some((point) => point[0] < minimum[0] || point[0] > maximum[0] || point[1] < minimum[1] || point[1] > maximum[1])) throw new Error('Wybrany profil szkicu wykracza poza półfabrykat.');
    return sketchBoundary;
  }
  const loops = extractTopBoundaryLoops(setupResult.body, operation.boundaryFaceId);
  if (!loops.length) throw new Error(operation.boundaryFaceId ? 'Wybrana ściana nie istnieje albo nie jest pozioma i płaska.' : 'Nie znaleziono zamkniętej górnej krawędzi bryły.');
  return { loops, planeZ: boundaryPlaneZ(setupResult.body, operation.boundaryFaceId), source: operation.boundaryFaceId ? 'selected-face' : 'body-top' };
}

function summarizeToolpath(segments) {
  const segmentLength = (segment) => Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis]));
  return {
    distance: segments.reduce((sum, segment) => sum + segmentLength(segment), 0),
    cuttingDistance: segments.filter((segment) => segment.kind !== 'rapid').reduce((sum, segment) => sum + segmentLength(segment), 0),
    durationMinutes: segments.reduce((sum, segment) => sum + segmentLength(segment) / (segment.kind === 'rapid' ? 3000 : segment.feed), 0),
  };
}

export function calculateDrillingToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeDrillingOperation(operation);
  const tool = resolveCamTool(normalized.toolId, document);
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Wiercenie wymaga poprawnego Setupu i bryły.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem wiercenia.');
  if (!tool) return fail('Wybrane narzędzie nie istnieje w bibliotece projektu.');
  if (tool.type === 'tap') return fail('Gwintownik wymaga cyklu gwintowania.');
  if (tool.type !== 'twist-drill') return fail('Nawiertak wymaga dedykowanej operacji nawiertania.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.retractHeight > setupResult.clearancePlaneZ - setupResult.stockBounds[1][2] + 1e-7) return fail('Wysokość wycofania nie może przekraczać wysokości bezpiecznej Setupu.');
  const selectedIds = new Set(normalized.holeFeatureIds);
  const holes = (setupResult.body.manufacturingHoles || []).filter((hole) => !selectedIds.size || selectedIds.has(hole.featureId));
  if (!holes.length) return fail(selectedIds.size ? 'Wybrane cechy otworów już nie istnieją.' : 'Bryła nie zawiera rozpoznanych otworów do wiercenia.');
  const resolvedHoles = [];
  for (const hole of holes) {
    if (tool.diameter > Number(hole.diameter) + 0.05) return fail(`Wiertło Ø${tool.diameter} jest większe niż otwór Ø${hole.diameter}.`);
    const instances = Array.isArray(hole.instances) && hole.instances.length
      ? hole.instances
      : hole.position && hole.direction
        ? [{ position: hole.position, direction: hole.direction, depth: hole.depth }]
        : [];
    if (!instances.length) return fail(`Otwór ${hole.featureId || ''} nie zawiera danych położenia. Przebuduj model.`.trim());
    for (const instance of instances) {
      if (![instance.position, instance.direction].every((vector) => Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite)) || !Number.isFinite(Number(instance.depth)) || Number(instance.depth) <= 0) return fail('Dane położenia otworu są nieprawidłowe. Przebuduj model.');
      const directionLength = Math.hypot(...instance.direction);
      if (directionLength <= 1e-9) return fail('Oś otworu ma zerowy kierunek. Przebuduj model.');
      const direction = instance.direction.map((value) => value / directionLength);
      if (Math.abs(direction[2]) < 0.999 || Math.hypot(direction[0], direction[1]) > 0.045) return fail('Wiercenie 3-osiowe obsługuje obecnie otwory równoległe do osi Z.');
      const otherEnd = instance.position.map((value, axis) => value + direction[axis] * Number(instance.depth));
      const entry = instance.position[2] >= otherEnd[2] ? instance.position : otherEnd;
      const bottom = instance.position[2] >= otherEnd[2] ? otherEnd : instance.position;
      const breakthrough = hole.through ? normalized.breakthroughDepth : 0;
      const targetZ = bottom[2] - breakthrough;
      const drillingDepth = setupResult.stockBounds[1][2] - targetZ;
      if (drillingDepth > tool.fluteLength + 1e-7) return fail(`Głębokość wiercenia ${drillingDepth.toFixed(2)} mm przekracza długość rowków wiertła (${tool.fluteLength} mm).`);
      resolvedHoles.push({ featureId: hole.featureId, diameter: Number(hole.diameter), through: Boolean(hole.through), x: entry[0], y: entry[1], entryZ: entry[2], targetZ, drillingDepth });
    }
  }
  if (!resolvedHoles.length) return fail('Nie znaleziono położeń otworów do wiercenia.');
  const stockTop = setupResult.stockBounds[1][2];
  const retractZ = stockTop + normalized.retractHeight;
  const segments = [];
  let previous = [resolvedHoles[0].x, resolvedHoles[0].y, setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  let peckCount = 0;
  for (const hole of resolvedHoles) {
    push('rapid', [hole.x, hole.y, setupResult.clearancePlaneZ]);
    push('rapid', [hole.x, hole.y, retractZ]);
    if (normalized.cycleType === 'peck') {
      let currentDepth = 0;
      while (currentDepth < hole.drillingDepth - 1e-9) {
        currentDepth = Math.min(hole.drillingDepth, currentDepth + normalized.peckDepth);
        push('plunge', [hole.x, hole.y, stockTop - currentDepth], normalized.feedRate);
        peckCount += 1;
        push('rapid', [hole.x, hole.y, retractZ]);
      }
    } else {
      push('plunge', [hole.x, hole.y, hole.targetZ], normalized.feedRate);
      if (normalized.cycleType === 'dwell' && segments.length) segments.at(-1).dwellSeconds = normalized.dwellSeconds;
      peckCount += 1;
      push('rapid', [hole.x, hole.y, retractZ]);
    }
    push('rapid', [hole.x, hole.y, setupResult.clearancePlaneZ]);
  }
  const summary = summarizeToolpath(segments);
  return {
    valid: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool,
    segments,
    holes: resolvedHoles,
    holeCount: resolvedHoles.length,
    peckCount,
    layerCount: peckCount,
    estimatedRemovedVolume: resolvedHoles.reduce((sum, hole) => sum + Math.PI * (tool.diameter / 2) ** 2 * hole.drillingDepth, 0),
    ...summary,
    durationMinutes: summary.durationMinutes + (normalized.cycleType === 'dwell' ? resolvedHoles.length * normalized.dwellSeconds / 60 : 0),
    warnings: [],
  };
}

export function calculateTappingToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeTappingOperation(operation);
  const tool = resolveCamTool(normalized.toolId, document);
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds || !setupResult.valid) return fail('Gwintowanie wymaga poprawnego Setupu i bryły.');
  if (!tool) return fail('Wybierz gwintownik z biblioteki projektu.');
  if (tool.type !== 'tap' || !Number.isFinite(tool.pitch) || tool.pitch <= 0) return fail('Gwintowanie wymaga gwintownika z prawidłowym skokiem.');
  if (!['linuxcnc', 'mach3'].includes(normalized.postProcessorId)) return fail('Gwintowanie wymaga sterownika obsługującego synchronizowany cykl G84.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.retractHeight > setupResult.clearancePlaneZ - setupResult.stockBounds[1][2] + 1e-7) return fail('Wysokość wycofania nie może przekraczać wysokości bezpiecznej Setupu.');
  const selectedIds = new Set(normalized.holeFeatureIds);
  const holes = (setupResult.body.manufacturingHoles || []).filter((hole) => !selectedIds.size || selectedIds.has(hole.featureId));
  if (!holes.length) return fail(selectedIds.size ? 'Wybrane cechy otworów już nie istnieją.' : 'Bryła nie zawiera rozpoznanych otworów do gwintowania.');
  const recommendedPilot = tool.diameter - tool.pitch;
  const pilotTolerance = Math.max(0.15, tool.pitch * 0.25);
  const resolvedHoles = [];
  for (const hole of holes) {
    if (Math.abs(Number(hole.diameter) - recommendedPilot) > pilotTolerance) return fail(`Otwór Ø${Number(hole.diameter).toFixed(2)} nie pasuje do gwintownika Ø${tool.diameter} × ${tool.pitch}; oczekiwane wiertło około Ø${recommendedPilot.toFixed(2)}.`);
    const instances = Array.isArray(hole.instances) && hole.instances.length ? hole.instances : hole.position && hole.direction ? [{ position: hole.position, direction: hole.direction, depth: hole.depth }] : [];
    if (!instances.length) return fail('Otwór nie zawiera danych położenia. Przebuduj model.');
    for (const instance of instances) {
      if (![instance.position, instance.direction].every((vector) => Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite)) || !Number.isFinite(Number(instance.depth)) || Number(instance.depth) <= 0) return fail('Dane położenia otworu są nieprawidłowe. Przebuduj model.');
      const length = Math.hypot(...instance.direction);
      const direction = length > 1e-9 ? instance.direction.map((value) => value / length) : [0, 0, 0];
      if (Math.abs(direction[2]) < 0.999 || Math.hypot(direction[0], direction[1]) > 0.045) return fail('Gwintowanie 3-osiowe obsługuje obecnie otwory równoległe do osi Z.');
      const otherEnd = instance.position.map((value, axis) => value + direction[axis] * Number(instance.depth));
      const entry = instance.position[2] >= otherEnd[2] ? instance.position : otherEnd;
      const bottom = instance.position[2] >= otherEnd[2] ? otherEnd : instance.position;
      const targetZ = Math.min(entry[2] - 0.1, bottom[2] + normalized.bottomClearance);
      const tappingDepth = setupResult.stockBounds[1][2] - targetZ;
      if (tappingDepth > tool.fluteLength + 1e-7 || tappingDepth > tool.stickout + 1e-7) return fail(`Głębokość gwintowania ${tappingDepth.toFixed(2)} mm przekracza roboczą długość gwintownika.`);
      resolvedHoles.push({ featureId: hole.featureId, x: entry[0], y: entry[1], entryZ: entry[2], targetZ, tappingDepth });
    }
  }
  const stockTop = setupResult.stockBounds[1][2];
  const retractZ = stockTop + normalized.retractHeight;
  const feedRate = normalized.spindleRpm * tool.pitch;
  const segments = [];
  let previous = [resolvedHoles[0].x, resolvedHoles[0].y, setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => { if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return; segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) }); previous = to; };
  for (const hole of resolvedHoles) {
    push('rapid', [hole.x, hole.y, setupResult.clearancePlaneZ]);
    push('rapid', [hole.x, hole.y, retractZ]);
    push('tap-down', [hole.x, hole.y, hole.targetZ], feedRate);
    push('tap-up', [hole.x, hole.y, retractZ], feedRate);
    push('rapid', [hole.x, hole.y, setupResult.clearancePlaneZ]);
  }
  return { valid: true, tapping: true, setup: setupResult, stockBounds: setupResult.stockBounds, origin: setupResult.origin, clearancePlaneZ: setupResult.clearancePlaneZ, operation: { ...normalized, feedRate }, tool, segments, holes: resolvedHoles, holeCount: resolvedHoles.length, tapCount: resolvedHoles.length, layerCount: resolvedHoles.length, estimatedRemovedVolume: 0, ...summarizeToolpath(segments), warnings: [] };
}

export function calculateSpotDrillingToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeSpotDrillingOperation(operation);
  const tool = resolveCamTool(normalized.toolId, document);
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds || !setupResult.valid) return fail('Nawiertanie wymaga poprawnego Setupu i bryły.');
  if (!tool || tool.type !== 'spot-drill' || !Number.isFinite(tool.pointAngle)) return fail('Nawiertanie wymaga nawiertaka z prawidłowym kątem ostrza.');
  if (normalized.targetDiameter > tool.diameter + 1e-7) return fail(`Docelowa średnica Ø${normalized.targetDiameter} przekracza średnicę nawiertaka Ø${tool.diameter}.`);
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.retractHeight > setupResult.clearancePlaneZ - setupResult.stockBounds[1][2] + 1e-7) return fail('Wysokość wycofania nie może przekraczać wysokości bezpiecznej Setupu.');
  const selectedIds = new Set(normalized.holeFeatureIds);
  const holes = (setupResult.body.manufacturingHoles || []).filter((hole) => !selectedIds.size || selectedIds.has(hole.featureId));
  if (!holes.length) return fail(selectedIds.size ? 'Wybrane cechy otworów już nie istnieją.' : 'Bryła nie zawiera rozpoznanych otworów do nawiertania.');
  const resolvedHoles = [];
  const halfAngleRadians = tool.pointAngle * Math.PI / 360;
  for (const hole of holes) {
    const holeDiameter = Number(hole.diameter);
    if (!Number.isFinite(holeDiameter) || normalized.targetDiameter <= holeDiameter + 1e-7) return fail(`Docelowa średnica nawiertania musi być większa niż otwór Ø${holeDiameter}.`);
    const coneDepth = (normalized.targetDiameter - holeDiameter) / (2 * Math.tan(halfAngleRadians));
    if (!Number.isFinite(coneDepth) || coneDepth <= 0 || coneDepth > tool.fluteLength + 1e-7) return fail('Geometria nawiertania przekracza roboczą długość narzędzia.');
    const instances = Array.isArray(hole.instances) && hole.instances.length ? hole.instances : hole.position && hole.direction ? [{ position: hole.position, direction: hole.direction, depth: hole.depth }] : [];
    if (!instances.length) return fail('Otwór nie zawiera danych położenia. Przebuduj model.');
    for (const instance of instances) {
      if (![instance.position, instance.direction].every((vector) => Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite))) return fail('Dane położenia otworu są nieprawidłowe. Przebuduj model.');
      if (!Number.isFinite(Number(instance.depth)) || Number(instance.depth) <= 0) return fail('Głębokość otworu jest nieprawidłowa. Przebuduj model.');
      const length = Math.hypot(...instance.direction);
      const direction = length > 1e-9 ? instance.direction.map((value) => value / length) : [0, 0, 0];
      if (Math.abs(direction[2]) < 0.999 || Math.hypot(direction[0], direction[1]) > 0.045) return fail('Nawiertanie 3-osiowe obsługuje obecnie otwory równoległe do osi Z.');
      const otherEnd = instance.position.map((value, axis) => value + direction[axis] * Number(instance.depth));
      const entry = instance.position[2] >= otherEnd[2] ? instance.position : otherEnd;
      const targetZ = entry[2] - coneDepth;
      const totalDepth = setupResult.stockBounds[1][2] - targetZ;
      if (totalDepth > tool.fluteLength + 1e-7 || totalDepth > tool.stickout + 1e-7) return fail(`Głębokość nawiertania ${totalDepth.toFixed(2)} mm przekracza roboczą długość narzędzia.`);
      resolvedHoles.push({ featureId: hole.featureId, holeDiameter, x: entry[0], y: entry[1], entryZ: entry[2], targetZ, coneDepth, targetDiameter: normalized.targetDiameter });
    }
  }
  const stockTop = setupResult.stockBounds[1][2];
  const retractZ = stockTop + normalized.retractHeight;
  const segments = [];
  let previous = [resolvedHoles[0].x, resolvedHoles[0].y, setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => { if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return; segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) }); previous = to; };
  for (const hole of resolvedHoles) {
    push('rapid', [hole.x, hole.y, setupResult.clearancePlaneZ]);
    push('rapid', [hole.x, hole.y, retractZ]);
    push('plunge', [hole.x, hole.y, hole.targetZ], normalized.feedRate);
    push('rapid', [hole.x, hole.y, retractZ]);
    push('rapid', [hole.x, hole.y, setupResult.clearancePlaneZ]);
  }
  return { valid: true, spotting: true, setup: setupResult, stockBounds: setupResult.stockBounds, origin: setupResult.origin, clearancePlaneZ: setupResult.clearancePlaneZ, operation: normalized, tool, segments, holes: resolvedHoles, holeCount: resolvedHoles.length, spotCount: resolvedHoles.length, layerCount: resolvedHoles.length, estimatedRemovedVolume: resolvedHoles.reduce((sum, hole) => { const outer = hole.targetDiameter / 2; const inner = hole.holeDiameter / 2; return sum + Math.PI * hole.coneDepth * (outer ** 2 + outer * inner - 2 * inner ** 2) / 3; }, 0), ...summarizeToolpath(segments), warnings: [] };
}

export function calculateCounterboreToolpath(setup, operation, bodies = []) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeCounterboreOperation(operation);
  const tool = CAM_TOOL_PRESETS[normalized.toolId];
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds || !setupResult.valid) return fail('Pogłębianie walcowe wymaga poprawnego Setupu i bryły.');
  if (!tool || tool.type !== 'flat-end-mill') return fail('Pogłębianie walcowe wymaga płaskiego freza palcowego.');
  if (normalized.targetDiameter <= tool.diameter + 1e-7) return fail(`Średnica pogłębienia musi być większa niż frez Ø${tool.diameter}.`);
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.retractHeight > setupResult.clearancePlaneZ - setupResult.stockBounds[1][2] + 1e-7) return fail('Wysokość wycofania nie może przekraczać wysokości bezpiecznej Setupu.');
  const selectedIds = new Set(normalized.holeFeatureIds);
  const holes = (setupResult.body.manufacturingHoles || []).filter((hole) => !selectedIds.size || selectedIds.has(hole.featureId));
  if (!holes.length) return fail(selectedIds.size ? 'Wybrane cechy otworów już nie istnieją.' : 'Bryła nie zawiera rozpoznanych otworów do pogłębiania.');
  const resolvedHoles = [];
  for (const hole of holes) {
    const holeDiameter = Number(hole.diameter);
    if (!Number.isFinite(holeDiameter) || normalized.targetDiameter <= holeDiameter + 1e-7) return fail(`Średnica pogłębienia musi być większa niż otwór Ø${holeDiameter}.`);
    if (tool.diameter > holeDiameter + 1e-7) return fail(`Frez Ø${tool.diameter} nie mieści się w otworze pilotowym Ø${holeDiameter}; bezpieczne wejście wymaga mniejszego narzędzia.`);
    const instances = Array.isArray(hole.instances) && hole.instances.length ? hole.instances : hole.position && hole.direction ? [{ position: hole.position, direction: hole.direction, depth: hole.depth }] : [];
    if (!instances.length) return fail('Otwór nie zawiera danych położenia. Przebuduj model.');
    for (const instance of instances) {
      if (![instance.position, instance.direction].every((vector) => Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite)) || !Number.isFinite(Number(instance.depth)) || Number(instance.depth) <= 0) return fail('Dane położenia albo głębokości otworu są nieprawidłowe. Przebuduj model.');
      const length = Math.hypot(...instance.direction);
      const direction = length > 1e-9 ? instance.direction.map((value) => value / length) : [0, 0, 0];
      if (Math.abs(direction[2]) < 0.999 || Math.hypot(direction[0], direction[1]) > 0.045) return fail('Pogłębianie 3-osiowe obsługuje obecnie otwory równoległe do osi Z.');
      if (normalized.targetDepth > Number(instance.depth) + 1e-7) return fail(`Głębokość pogłębienia ${normalized.targetDepth} mm przekracza głębokość otworu.`);
      const otherEnd = instance.position.map((value, axis) => value + direction[axis] * Number(instance.depth));
      const entry = instance.position[2] >= otherEnd[2] ? instance.position : otherEnd;
      const targetZ = entry[2] - normalized.targetDepth;
      const totalDepth = setupResult.stockBounds[1][2] - targetZ;
      if (totalDepth > tool.fluteLength + 1e-7 || totalDepth > tool.stickout + 1e-7) return fail(`Głębokość pogłębiania ${totalDepth.toFixed(2)} mm przekracza roboczą długość freza.`);
      resolvedHoles.push({ featureId: hole.featureId, holeDiameter, x: entry[0], y: entry[1], entryZ: entry[2], targetZ });
    }
  }
  const stockTop = setupResult.stockBounds[1][2];
  const retractZ = stockTop + normalized.retractHeight;
  const layerCount = Math.max(1, Math.ceil(normalized.targetDepth / normalized.maxStepdown));
  const segments = [];
  let previous = [resolvedHoles[0].x, resolvedHoles[0].y, setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => { if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return; segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) }); previous = to; };
  for (const hole of resolvedHoles) {
    push('rapid', [hole.x, hole.y, setupResult.clearancePlaneZ]);
    push('rapid', [hole.x, hole.y, retractZ]);
    for (let layer = 1; layer <= layerCount; layer += 1) {
      const z = hole.entryZ - Math.min(normalized.targetDepth, layer * normalized.targetDepth / layerCount);
      push('plunge', [hole.x, hole.y, z], normalized.plungeRate);
      const maximumRadius = (normalized.targetDiameter - tool.diameter) / 2;
      const firstRadius = Math.min(maximumRadius, hole.holeDiameter / 2 + tool.diameter / 2);
      const radii = [firstRadius];
      while (radii.at(-1) < maximumRadius - 1e-7) radii.push(Math.min(maximumRadius, radii.at(-1) + tool.diameter * 0.5));
      for (const radius of radii) {
        push('cut', [hole.x + radius, hole.y, z], normalized.feedRate);
        const pointCount = Math.max(24, Math.ceil(Math.PI * 2 * radius / 1.5));
        for (let pointIndex = 1; pointIndex <= pointCount; pointIndex += 1) {
          const angle = pointIndex / pointCount * Math.PI * 2;
          push('cut', [hole.x + Math.cos(angle) * radius, hole.y + Math.sin(angle) * radius, z], normalized.feedRate);
        }
      }
      push('cut', [hole.x, hole.y, z], normalized.feedRate);
    }
    push('rapid', [hole.x, hole.y, retractZ]);
    push('rapid', [hole.x, hole.y, setupResult.clearancePlaneZ]);
  }
  const estimatedRemovedVolume = resolvedHoles.reduce((sum, hole) => sum + Math.PI / 4 * (normalized.targetDiameter ** 2 - hole.holeDiameter ** 2) * normalized.targetDepth, 0);
  return { valid: true, counterboring: true, setup: setupResult, stockBounds: setupResult.stockBounds, origin: setupResult.origin, clearancePlaneZ: setupResult.clearancePlaneZ, operation: normalized, tool, segments, holes: resolvedHoles, holeCount: resolvedHoles.length, counterboreCount: resolvedHoles.length, layerCount, estimatedRemovedVolume, ...summarizeToolpath(segments), warnings: [] };
}

export function calculateContourToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeContourOperation(operation);
  const tool = CAM_TOOL_PRESETS[normalized.toolId];
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Kontur wymaga poprawnego Setupu i bryły.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem konturu.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const bodyHeight = Number(bodyBounds[1][2]) - Number(bodyBounds[0][2]);
  if (normalized.targetDepth > tool.fluteLength) return fail(`Głębokość przekracza długość ostrza narzędzia (${tool.fluteLength} mm).`);
  if (normalized.targetDepth > bodyHeight + setupResult.stockBounds[0][2] - Number(bodyBounds[0][2]) + 1e-7) return fail('Głębokość konturu przekracza wysokość dostępnego materiału.');
  let resolvedBoundary;
  try { resolvedBoundary = resolveOperationBoundary(setupResult, normalized, document); } catch (error) { return fail(error.message); }
  const { loops } = resolvedBoundary;
  const contour = offsetClosedContour(loops[0], tool.diameter / 2);
  const topZ = resolvedBoundary.planeZ;
  const layerCount = Math.max(1, Math.ceil(normalized.targetDepth / normalized.maxStepdown));
  const segments = [];
  let previous = [contour[0][0], contour[0][1], setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  for (let layer = 1; layer <= layerCount; layer += 1) {
    const z = topZ - Math.min(normalized.targetDepth, layer * normalized.targetDepth / layerCount);
    push('rapid', [contour[0][0], contour[0][1], setupResult.clearancePlaneZ]);
    push('plunge', [contour[0][0], contour[0][1], z], normalized.plungeRate);
    for (let index = 1; index <= contour.length; index += 1) {
      const point = contour[index % contour.length];
      push('cut', [point[0], point[1], z], normalized.feedRate);
    }
    push('rapid', [previous[0], previous[1], setupResult.clearancePlaneZ]);
  }
  return {
    valid: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool,
    segments,
    layerCount,
    contourPointCount: contour.length,
    estimatedRemovedVolume: contour.reduce((sum, point, index) => {
      const next = contour[(index + 1) % contour.length];
      return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
    }, 0) * tool.diameter * normalized.targetDepth,
    ...summarizeToolpath(segments),
    warnings: [],
  };
}

function scanlineIntervals(polygon, y) {
  const intersections = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    if ((a[1] > y) === (b[1] > y)) continue;
    intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
  }
  intersections.sort((a, b) => a - b);
  const intervals = [];
  for (let index = 0; index + 1 < intersections.length; index += 2) {
    if (intersections[index + 1] - intersections[index] > 1e-7) intervals.push([intersections[index], intersections[index + 1]]);
  }
  return intervals;
}

export function calculatePocketToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizePocketOperation(operation);
  const tool = CAM_TOOL_PRESETS[normalized.toolId];
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Kieszeń wymaga poprawnego Setupu i bryły.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem kieszeni.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.targetDepth > tool.fluteLength) return fail(`Głębokość przekracza długość ostrza narzędzia (${tool.fluteLength} mm).`);
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const bodyHeight = Number(bodyBounds[1][2]) - Number(bodyBounds[0][2]);
  if (normalized.targetDepth > bodyHeight + 1e-7) return fail('Głębokość kieszeni przekracza wysokość bryły.');
  let resolvedBoundary;
  try { resolvedBoundary = resolveOperationBoundary(setupResult, normalized, document); } catch (error) { return fail(error.message); }
  const { loops } = resolvedBoundary;
  const boundary = offsetClosedContour(loops[0], -tool.diameter / 2);
  const xs = boundary.map((point) => point[0]);
  const ys = boundary.map((point) => point[1]);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  if (!(Math.max(...xs) - Math.min(...xs) > 1e-7) || !(maximumY - minimumY > 1e-7)) return fail('Obrys jest za mały dla wybranego narzędzia.');
  const rowStep = tool.diameter * normalized.stepover;
  const rowCount = Math.max(2, Math.ceil((maximumY - minimumY) / rowStep) + 1);
  const rows = [];
  for (let row = 0; row < rowCount; row += 1) {
    const y = minimumY + (maximumY - minimumY) * row / (rowCount - 1);
    const intervals = scanlineIntervals(boundary, y);
    if (row % 2) intervals.reverse().forEach((interval) => interval.reverse());
    rows.push(...intervals.map((interval) => ({ y, interval })));
  }
  if (!rows.length) return fail('Nie udało się wyznaczyć bezpiecznych przejść wewnątrz kieszeni.');
  const topZ = resolvedBoundary.planeZ;
  const layerCount = Math.max(1, Math.ceil(normalized.targetDepth / normalized.maxStepdown));
  const segments = [];
  let previous = [rows[0].interval[0], rows[0].y, setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  for (let layer = 1; layer <= layerCount; layer += 1) {
    const z = topZ - Math.min(normalized.targetDepth, layer * normalized.targetDepth / layerCount);
    for (const row of rows) {
      const start = [row.interval[0], row.y, z];
      const end = [row.interval[1], row.y, z];
      push('rapid', [start[0], start[1], setupResult.clearancePlaneZ]);
      push('plunge', start, normalized.plungeRate);
      push('cut', end, normalized.feedRate);
      push('rapid', [end[0], end[1], setupResult.clearancePlaneZ]);
    }
  }
  return {
    valid: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool,
    segments,
    layerCount,
    rowCount: rows.length,
    estimatedRemovedVolume: Math.abs(signedPolygonArea(boundary)) * normalized.targetDepth,
    ...summarizeToolpath(segments),
    warnings: [],
  };
}

export function calculateAdaptiveToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeAdaptiveOperation(operation);
  const tool = CAM_TOOL_PRESETS[normalized.toolId];
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Obróbka adaptacyjna wymaga poprawnego Setupu i bryły.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem obróbki adaptacyjnej.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.targetDepth > tool.fluteLength) return fail(`Głębokość przekracza długość ostrza narzędzia (${tool.fluteLength} mm).`);
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const bodyHeight = Number(bodyBounds[1][2]) - Number(bodyBounds[0][2]);
  if (normalized.targetDepth > bodyHeight + 1e-7) return fail('Głębokość adaptacyjna przekracza wysokość bryły.');
  let resolvedBoundary;
  try { resolvedBoundary = resolveOperationBoundary(setupResult, normalized, document); } catch (error) { return fail(error.message); }
  const { loops } = resolvedBoundary;
  const radialStep = tool.diameter * normalized.optimalLoad;
  const rings = [];
  let ring = offsetClosedContour(loops[0], -tool.diameter / 2);
  let previousArea = Math.abs(signedPolygonArea(ring));
  for (let index = 0; index < 200 && previousArea > tool.diameter * tool.diameter * 0.2; index += 1) {
    if (ring.some((point) => !point.every(Number.isFinite))) break;
    rings.push(ring);
    const next = offsetClosedContour(ring, -radialStep);
    const nextArea = Math.abs(signedPolygonArea(next));
    const xs = next.map((point) => point[0]);
    const ys = next.map((point) => point[1]);
    if (nextArea >= previousArea - 1e-7 || Math.max(...xs) - Math.min(...xs) < radialStep || Math.max(...ys) - Math.min(...ys) < radialStep) break;
    ring = next;
    previousArea = nextArea;
  }
  if (!rings.length) return fail('Obrys jest za mały dla wybranego narzędzia i obciążenia optymalnego.');
  const topZ = resolvedBoundary.planeZ;
  const layerCount = Math.max(1, Math.ceil(normalized.targetDepth / normalized.maxStepdown));
  const segments = [];
  let previous = [rings[0][0][0], rings[0][0][1], setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  for (let layer = 1; layer <= layerCount; layer += 1) {
    const z = topZ - Math.min(normalized.targetDepth, layer * normalized.targetDepth / layerCount);
    const outer = rings[0];
    push('rapid', [outer[0][0], outer[0][1], setupResult.clearancePlaneZ]);
    push('plunge', [outer[0][0], outer[0][1], topZ], normalized.plungeRate);
    for (let index = 1; index <= outer.length; index += 1) {
      const point = outer[index % outer.length];
      const rampZ = topZ + (z - topZ) * index / outer.length;
      push('cut', [point[0], point[1], rampZ], normalized.feedRate);
    }
    for (let ringIndex = 1; ringIndex < rings.length; ringIndex += 1) {
      const current = rings[ringIndex];
      push('cut', [current[0][0], current[0][1], z], normalized.feedRate);
      for (let pointIndex = 1; pointIndex <= current.length; pointIndex += 1) {
        const point = current[pointIndex % current.length];
        push('cut', [point[0], point[1], z], normalized.feedRate);
      }
    }
    push('rapid', [previous[0], previous[1], setupResult.clearancePlaneZ]);
  }
  return {
    valid: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool,
    segments,
    layerCount,
    ringCount: rings.length,
    estimatedRemovedVolume: Math.abs(signedPolygonArea(loops[0])) * normalized.targetDepth,
    ...summarizeToolpath(segments),
    warnings: [],
  };
}

export function calculateCut2dToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeCut2dOperation(operation);
  const tool = { id: 'cutting-beam', name: setupResult.machine?.process === 'plasma' ? 'Łuk plazmowy' : 'Wiązka lasera', type: 'cutting-beam', diameter: normalized.kerfWidth, stickout: Infinity, holderDiameter: 0 };
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Cięcie 2D wymaga poprawnego Setupu i bryły albo profilu szkicu.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem cięcia.');
  if (setupResult.machine.kind !== 'cut-2d') return fail('Cięcie 2D wymaga maszyny laserowej albo plazmowej.');
  if (setupResult.machine.process === 'laser' && normalized.postProcessorId !== 'grbl-laser') return fail('Laser wymaga postprocesora GRBL Laser.');
  if (setupResult.machine.process === 'plasma' && normalized.postProcessorId !== 'linuxcnc-plasma') return fail('Plazma wymaga postprocesora LinuxCNC Plasma.');
  if (normalized.feedRate > setupResult.machine.maxFeedRate) return fail(`Posuw przekracza limit maszyny ${setupResult.machine.maxFeedRate} mm/min.`);
  let resolvedBoundary;
  try { resolvedBoundary = resolveOperationBoundary(setupResult, normalized, document); } catch (error) { return fail(error.message); }
  const offset = normalized.compensation === 'center' ? 0 : normalized.kerfWidth / 2 * (normalized.compensation === 'inside' ? -1 : 1);
  const contour = offsetClosedContour(resolvedBoundary.loops[0], offset);
  if (contour.length < 3 || contour.some((point) => !point.every(Number.isFinite))) return fail('Nie udało się skompensować szerokości szczeliny dla wybranego obrysu.');
  const planeZ = resolvedBoundary.planeZ;
  const first = contour[0];
  const second = contour[1];
  const direction = [second[0] - first[0], second[1] - first[1]];
  const length = Math.hypot(...direction) || 1;
  const leadStart = [first[0] - direction[0] / length * normalized.leadIn, first[1] - direction[1] / length * normalized.leadIn];
  const segments = [];
  let previous = [leadStart[0], leadStart[1], setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  for (let pass = 0; pass < normalized.passes; pass += 1) {
    push('rapid', [leadStart[0], leadStart[1], setupResult.clearancePlaneZ]);
    push('rapid', [leadStart[0], leadStart[1], planeZ]);
    push('cut', [first[0], first[1], planeZ], normalized.feedRate);
    for (let index = 1; index <= contour.length; index += 1) {
      const point = contour[index % contour.length];
      push('cut', [point[0], point[1], planeZ], normalized.feedRate);
    }
    push('rapid', [previous[0], previous[1], setupResult.clearancePlaneZ]);
  }
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const materialThickness = Math.max(0, Number(bodyBounds[1][2]) - Number(bodyBounds[0][2]));
  return {
    valid: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool,
    segments,
    layerCount: normalized.passes,
    contourPointCount: contour.length,
    estimatedRemovedVolume: contour.reduce((sum, point, index) => {
      const next = contour[(index + 1) % contour.length];
      return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
    }, 0) * normalized.kerfWidth * materialThickness * normalized.passes,
    ...summarizeToolpath(segments),
    warnings: [],
  };
}

export function calculateTurningToolpath(setup, operation, bodies = []) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeTurningOperation(operation);
  const tool = CAM_TURNING_TOOL_PRESETS[normalized.toolId];
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Toczenie wymaga poprawnego Setupu i bryły.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem toczenia.');
  if (setupResult.machine.kind !== 'turning-2axis') return fail('Operacja wymaga Setupu tokarki.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit tokarki ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.targetDiameter >= normalized.stockDiameter) return fail('Średnica docelowa musi być mniejsza od średnicy półfabrykatu.');
  if (normalized.stockDiameter > setupResult.machine.travel[1]) return fail(`Średnica półfabrykatu przekracza zakres tokarki Ø${setupResult.machine.travel[1]} mm.`);
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  if (normalized.axialLength > setupResult.stockBounds[1][0] - setupResult.stockBounds[0][0] + 1e-7) return fail('Długość toczenia przekracza długość półfabrykatu w osi wrzeciona.');
  const centerY = setupResult.origin[1];
  const centerZ = setupResult.origin[2];
  const stockRadius = normalized.stockDiameter / 2;
  const targetRadius = normalized.targetDiameter / 2;
  const safeRadius = stockRadius + Math.max(2, setup.safeHeight);
  const stockFront = setupResult.stockBounds[1][0];
  const bodyFront = Number(bodyBounds[1][0]);
  const segments = [];
  let previous = [stockFront + 2, centerY + safeRadius, centerZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  let passCount = 0;
  if (normalized.type === 'turn-face') {
    const allowance = Math.max(0.05, stockFront - bodyFront);
    passCount = Math.max(1, Math.ceil(allowance / normalized.maxDepthOfCut));
    for (let pass = 1; pass <= passCount; pass += 1) {
      const axial = stockFront - allowance * pass / passCount;
      push('rapid', [axial + 1, centerY + safeRadius, centerZ]);
      push('rapid', [axial, centerY + stockRadius + 1, centerZ]);
      push('cut', [axial, centerY, centerZ], normalized.feedRate);
      push('rapid', [axial + 1, centerY + safeRadius, centerZ]);
    }
  } else {
    passCount = Math.max(1, Math.ceil((stockRadius - targetRadius) / normalized.maxDepthOfCut));
    for (let pass = 1; pass <= passCount; pass += 1) {
      const radius = stockRadius - (stockRadius - targetRadius) * pass / passCount;
      push('rapid', [stockFront + 1, centerY + safeRadius, centerZ]);
      push('rapid', [stockFront, centerY + radius, centerZ]);
      push('cut', [stockFront - normalized.axialLength, centerY + radius, centerZ], normalized.feedRate);
      push('rapid', [stockFront + 1, centerY + safeRadius, centerZ]);
    }
  }
  const summary = summarizeToolpath(segments);
  const removedArea = Math.PI * (stockRadius ** 2 - targetRadius ** 2);
  return {
    valid: true,
    turning: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool: { ...tool, diameter: tool.noseRadius * 2, holderDiameter: 0 },
    segments,
    layerCount: passCount,
    passCount,
    estimatedRemovedVolume: normalized.type === 'turn-profile' ? removedArea * normalized.axialLength : Math.PI * stockRadius ** 2 * Math.max(0.05, stockFront - bodyFront),
    ...summary,
    durationMinutes: segments.reduce((sum, segment) => sum + Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis])) / (segment.kind === 'rapid' ? 3000 : normalized.feedRate * normalized.spindleRpm), 0),
    warnings: [],
  };
}

export function calculateOperationToolpath(setup, operation, bodies = [], document = null) {
  if (operation?.type === 'contour') return calculateContourToolpath(setup, operation, bodies, document);
  if (operation?.type === 'pocket') return calculatePocketToolpath(setup, operation, bodies, document);
  if (operation?.type === 'adaptive') return calculateAdaptiveToolpath(setup, operation, bodies, document);
  if (operation?.type === 'drill') return calculateDrillingToolpath(setup, operation, bodies, document);
  if (operation?.type === 'tap') return calculateTappingToolpath(setup, operation, bodies, document);
  if (operation?.type === 'spot') return calculateSpotDrillingToolpath(setup, operation, bodies, document);
  if (operation?.type === 'counterbore') return calculateCounterboreToolpath(setup, operation, bodies);
  if (operation?.type === 'cut2d') return calculateCut2dToolpath(setup, operation, bodies, document);
  if (operation?.type === 'turn-face' || operation?.type === 'turn-profile') return calculateTurningToolpath(setup, operation, bodies);
  return calculateFacingToolpath(setup, operation, bodies);
}

export function analyzeToolpathSafety(toolpath) {
  const issues = [];
  if (!toolpath?.valid) return (toolpath?.warnings || ['Ścieżka nie jest prawidłowa.']).map((message) => ({ code: 'INVALID_TOOLPATH', message }));
  const points = toolpath.segments.flatMap((segment) => [segment.from, segment.to]);
  if (points.some((point) => point.length !== 3 || point.some((value) => !Number.isFinite(value)))) issues.push({ code: 'NON_FINITE', message: 'Ścieżka zawiera nieprawidłową współrzędną.' });
  const machine = toolpath.setup.machine;
  for (let axis = 0; axis < 3; axis += 1) {
    const values = points.map((point) => point[axis]);
    if (Math.max(...values) - Math.min(...values) > machine.travel[axis] + 1e-7) issues.push({ code: 'MACHINE_TRAVEL', message: `Ścieżka przekracza przesuw maszyny w osi ${['X', 'Y', 'Z'][axis]}.` });
  }
  if (toolpath.turning) return issues;
  const stockTop = toolpath.stockBounds[1][2];
  for (const segment of toolpath.segments) {
    const horizontalDistance = Math.hypot(segment.to[0] - segment.from[0], segment.to[1] - segment.from[1]);
    if (segment.kind === 'rapid' && horizontalDistance > 1e-7 && Math.min(segment.from[2], segment.to[2]) < stockTop - 1e-7) {
      issues.push({ code: 'RAPID_IN_STOCK', message: 'Wykryto szybki przejazd poziomy poniżej góry półfabrykatu.' });
      break;
    }
  }
  const cuttingPoints = toolpath.segments.filter((segment) => segment.kind !== 'rapid').flatMap((segment) => [segment.from, segment.to]);
  const minimumCutZ = cuttingPoints.length ? Math.min(...cuttingPoints.map((point) => point[2])) : stockTop;
  if (stockTop - minimumCutZ > toolpath.tool.stickout + 1e-7) issues.push({ code: 'HOLDER_COLLISION', message: 'Głębokość ścieżki powoduje ryzyko kolizji oprawki z półfabrykatem.' });
  return issues;
}

const HOLE_STAGE_LABELS = Object.freeze({ spot: 'nawiertanie', drill: 'wiercenie', counterbore: 'pogłębianie walcowe', tap: 'gwintowanie' });
const HOLE_STAGE_ORDER = Object.freeze({ spot: 10, drill: 20, counterbore: 30, tap: 40 });

const countToolChanges = (operations) => operations.reduce((result, operation) => {
  if (!operation.toolId) return result;
  return { lastToolId: operation.toolId, count: result.lastToolId && result.lastToolId !== operation.toolId ? result.count + 1 : result.count };
}, { lastToolId: '', count: 0 }).count;

function buildManufacturingOperationDependencies(operations, body = null) {
  const edges = operations.map(() => new Set());
  const addEdge = (from, to) => {
    if (from !== to) edges[from].add(to);
  };
  const knownFeatureIds = new Set((body?.manufacturingHoles || []).map((hole) => hole.featureId).filter(Boolean));
  const selectedIds = (operation) => new Set((operation.holeFeatureIds || []).filter((id) => !knownFeatureIds.size || knownFeatureIds.has(id)));
  const overlaps = (first, second) => {
    const firstIds = selectedIds(first);
    const secondIds = selectedIds(second);
    return !firstIds.size || !secondIds.size || [...firstIds].some((id) => secondIds.has(id));
  };
  for (let first = 0; first < operations.length; first += 1) {
    for (let second = first + 1; second < operations.length; second += 1) {
      const firstOperation = operations[first];
      const secondOperation = operations[second];
      if (firstOperation.type === 'face' && secondOperation.type !== 'face') addEdge(first, second);
      else if (secondOperation.type === 'face' && firstOperation.type !== 'face') addEdge(second, first);
      if (firstOperation.type === 'contour' && secondOperation.type !== 'contour') addEdge(second, first);
      else if (secondOperation.type === 'contour' && firstOperation.type !== 'contour') addEdge(first, second);
      const firstStage = HOLE_STAGE_ORDER[firstOperation.type];
      const secondStage = HOLE_STAGE_ORDER[secondOperation.type];
      if (firstStage && secondStage && firstStage !== secondStage && overlaps(firstOperation, secondOperation)) addEdge(firstStage < secondStage ? first : second, firstStage < secondStage ? second : first);
    }
  }
  return edges;
}

export function validateManufacturingOperationOrder(setup, body = null) {
  const operations = normalizeManufacturingSetup(setup).operations;
  const edges = buildManufacturingOperationDependencies(operations, body);
  const warnings = [];
  edges.forEach((targets, source) => targets.forEach((target) => {
    if (source > target) warnings.push(`„${operations[source].name}” musi być przed „${operations[target].name}”.`);
  }));
  return { valid: warnings.length === 0, warnings };
}

export function moveManufacturingOperation(setup, operationId, direction, body = null) {
  const normalized = normalizeManufacturingSetup(setup);
  const operations = normalized.operations;
  const sourceIndex = operations.findIndex((operation) => operation.id === operationId);
  const targetIndex = sourceIndex + (direction === 'up' ? -1 : direction === 'down' ? 1 : 0);
  if (sourceIndex < 0) return { operations, changed: false, warnings: ['Nie znaleziono operacji CAM.'] };
  if (targetIndex < 0 || targetIndex >= operations.length || targetIndex === sourceIndex) return { operations, changed: false, warnings: [] };
  const candidate = [...operations];
  [candidate[sourceIndex], candidate[targetIndex]] = [candidate[targetIndex], candidate[sourceIndex]];
  const validation = validateManufacturingOperationOrder({ ...normalized, operations: candidate }, body);
  if (!validation.valid) return { operations, changed: false, warnings: [`Ruch zablokowany przez zależność technologiczną: ${validation.warnings[0]}`] };
  return { operations: candidate, changed: true, warnings: [] };
}

export function duplicateManufacturingOperation(setup, operationId) {
  const normalized = normalizeManufacturingSetup(setup);
  const sourceIndex = normalized.operations.findIndex((operation) => operation.id === operationId);
  if (sourceIndex < 0) return { operations: normalized.operations, operation: null };
  const source = normalized.operations[sourceIndex];
  const usedNames = new Set(normalized.operations.map((operation) => operation.name.toLocaleLowerCase()));
  let name = `${source.name} — kopia`;
  for (let copyIndex = 2; usedNames.has(name.toLocaleLowerCase()); copyIndex += 1) name = `${source.name} — kopia ${copyIndex}`;
  const operation = normalizeManufacturingOperation({ ...source, id: createId('cam-operation'), name }, sourceIndex + 1);
  const operations = [...normalized.operations];
  operations.splice(sourceIndex + 1, 0, operation);
  return { operations, operation };
}

export function optimizeManufacturingOperationOrder(setup, body = null) {
  const normalized = normalizeManufacturingSetup(setup);
  const operations = normalized.operations;
  if (operations.length < 2) return { operations, changed: false, toolChangesBefore: 0, toolChangesAfter: 0, warnings: [] };
  const edges = buildManufacturingOperationDependencies(operations, body);
  const indegree = operations.map(() => 0);
  edges.forEach((targets) => targets.forEach((target) => { indegree[target] += 1; }));
  const typePriority = { face: 0, adaptive: 10, pocket: 10, spot: 20, drill: 30, counterbore: 40, tap: 50, contour: 100 };
  const remaining = new Set(operations.map((_operation, index) => index));
  const orderedIndices = [];
  let lastToolId = '';
  while (remaining.size) {
    const ready = [...remaining].filter((index) => indegree[index] === 0);
    if (!ready.length) return { operations, changed: false, toolChangesBefore: countToolChanges(operations), toolChangesAfter: countToolChanges(operations), warnings: ['Nie można uporządkować operacji z powodu cyklu zależności.'] };
    ready.sort((first, second) => {
      const firstSameTool = lastToolId && operations[first].toolId === lastToolId ? 0 : 1;
      const secondSameTool = lastToolId && operations[second].toolId === lastToolId ? 0 : 1;
      return firstSameTool - secondSameTool || (typePriority[operations[first].type] ?? 60) - (typePriority[operations[second].type] ?? 60) || first - second;
    });
    const selected = ready[0];
    remaining.delete(selected);
    orderedIndices.push(selected);
    lastToolId = operations[selected].toolId || lastToolId;
    for (const target of edges[selected]) indegree[target] -= 1;
  }
  const ordered = orderedIndices.map((index) => operations[index]);
  return {
    operations: ordered,
    changed: ordered.some((operation, index) => operation.id !== operations[index].id),
    toolChangesBefore: countToolChanges(operations),
    toolChangesAfter: countToolChanges(ordered),
    warnings: [],
  };
}

export function analyzeHoleMachiningCompleteness(setup, body, operationReports = []) {
  const holes = body?.manufacturingHoles || [];
  const validOperationIds = new Set(operationReports.filter((operation) => operation.valid).map((operation) => operation.id));
  const operations = normalizeManufacturingSetup(setup).operations;
  const entries = holes.map((hole, holeIndex) => {
    const featureId = hole.featureId || `hole-${holeIndex + 1}`;
    const requiredStages = ['drill'];
    if (hole.holeType === 'countersink') requiredStages.unshift('spot');
    if (hole.holeType === 'counterbore') requiredStages.push('counterbore');
    if (hole.threadDesignation || ['tapped', 'npt-tapped', 'bspt-tapped'].includes(hole.holeApplication)) requiredStages.push('tap');
    const relevantOperations = operations
      .map((operation, index) => ({ operation, index }))
      .filter(({ operation }) => HOLE_STAGE_ORDER[operation.type] && (!operation.holeFeatureIds.length || operation.holeFeatureIds.includes(featureId)) && validOperationIds.has(operation.id));
    const plannedStages = [...new Set(relevantOperations.map(({ operation }) => operation.type))];
    const missingStages = requiredStages.filter((stage) => !plannedStages.includes(stage));
    const requiredOperations = relevantOperations.filter(({ operation }) => requiredStages.includes(operation.type));
    const orderingIssues = [];
    for (let index = 1; index < requiredOperations.length; index += 1) {
      const previous = requiredOperations[index - 1];
      const current = requiredOperations[index];
      if (HOLE_STAGE_ORDER[current.operation.type] < HOLE_STAGE_ORDER[previous.operation.type]) orderingIssues.push(`${HOLE_STAGE_LABELS[current.operation.type]} powinno poprzedzać ${HOLE_STAGE_LABELS[previous.operation.type]}`);
    }
    return {
      featureId,
      diameter: Number(hole.diameter) || 0,
      quantity: Number(hole.quantity) || hole.instances?.length || 1,
      requiredStages,
      plannedStages,
      missingStages,
      orderingIssues,
      complete: missingStages.length === 0 && orderingIssues.length === 0,
    };
  });
  const totalHoleCount = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const completeHoleCount = entries.filter((entry) => entry.complete).reduce((sum, entry) => sum + entry.quantity, 0);
  return {
    complete: entries.every((entry) => entry.complete),
    groupCount: entries.length,
    completeGroupCount: entries.filter((entry) => entry.complete).length,
    totalHoleCount,
    completeHoleCount,
    entries,
  };
}

export function analyzeManufacturingProgram(setup, bodies = [], document = null) {
  const normalized = normalizeManufacturingSetup(setup);
  const operations = normalized.operations.map((operation) => {
    const toolpath = calculateOperationToolpath(normalized, operation, bodies, document);
    const issues = analyzeToolpathSafety(toolpath);
    return {
      id: operation.id,
      name: operation.name,
      type: operation.type,
      valid: toolpath.valid && issues.length === 0,
      segmentCount: toolpath.segments.length,
      durationMinutes: toolpath.durationMinutes || 0,
      cuttingDistance: toolpath.cuttingDistance || 0,
      estimatedRemovedVolume: toolpath.estimatedRemovedVolume || 0,
      issues,
    };
  });
  const setupResult = calculateManufacturingSetup(normalized, bodies);
  const holeCompleteness = analyzeHoleMachiningCompleteness(normalized, setupResult.body, operations);
  const stockVolume = setupResult.dimensions?.reduce((volume, dimension) => volume * dimension, 1) || 0;
  const estimatedRemovedVolume = operations.reduce((sum, operation) => sum + operation.estimatedRemovedVolume, 0);
  return {
    valid: setupResult.valid && operations.length > 0 && operations.every((operation) => operation.valid) && holeCompleteness.complete,
    setupIssues: setupResult.warnings,
    operations,
    segmentCount: operations.reduce((sum, operation) => sum + operation.segmentCount, 0),
    durationMinutes: operations.reduce((sum, operation) => sum + operation.durationMinutes, 0),
    cuttingDistance: operations.reduce((sum, operation) => sum + operation.cuttingDistance, 0),
    stockVolume,
    estimatedRemovedVolume,
    estimatedRemovalPercent: stockVolume ? Math.min(100, estimatedRemovedVolume / stockVolume * 100) : 0,
    holeCompleteness,
  };
}

const escapeManufacturingHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const formatSetupSheetNumber = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';

export function createManufacturingSetupSheet(setup, bodies = [], { projectName = 'MadCAD', document = null } = {}) {
  const normalized = normalizeManufacturingSetup(setup);
  const setupResult = calculateManufacturingSetup(normalized, bodies);
  if (!setupResult.body || !setupResult.stockBounds) throw new Error('Arkusz ustawczy wymaga poprawnego Setupu i istniejącej bryły.');
  const report = analyzeManufacturingProgram(normalized, bodies, document);
  const toolUsage = new Map();
  normalized.operations.forEach((operation, index) => {
    const tool = CAM_TURNING_TOOL_PRESETS[operation.toolId] || resolveCamTool(operation.toolId, document) || { id: operation.toolId, name: operation.toolId || 'Źródło cięcia', diameter: null, stickout: null };
    if (!toolUsage.has(operation.toolId || tool.id)) toolUsage.set(operation.toolId || tool.id, { tool, operationNumbers: [] });
    toolUsage.get(operation.toolId || tool.id).operationNumbers.push(index + 1);
  });
  const typeLabels = { face: 'Planowanie', pocket: 'Kieszeń 2D', adaptive: 'Adaptacyjne 2D', contour: 'Kontur 2D', drill: 'Wiercenie', spot: 'Nawiertanie', counterbore: 'Pogłębianie walcowe', tap: 'Gwintowanie', cut2d: 'Cięcie 2D', 'turn-face': 'Toczenie czoła', 'turn-profile': 'Toczenie profilu' };
  const operationRows = normalized.operations.map((operation, index) => {
    const operationReport = report.operations[index];
    const tool = CAM_TURNING_TOOL_PRESETS[operation.toolId] || resolveCamTool(operation.toolId, document);
    return `<tr><td>${index + 1}</td><td><strong>${escapeManufacturingHtml(operation.name)}</strong><small>${escapeManufacturingHtml(typeLabels[operation.type] || operation.type)}</small></td><td>${escapeManufacturingHtml(tool?.name || 'Źródło cięcia')}</td><td>${operation.spindleRpm ? `${formatSetupSheetNumber(operation.spindleRpm, 0)} obr./min` : '—'}</td><td>${operation.feedRate ? `${formatSetupSheetNumber(operation.feedRate, operation.type?.startsWith('turn-') ? 2 : 0)} ${operation.type?.startsWith('turn-') ? 'mm/obr.' : 'mm/min'}` : '—'}</td><td>${Math.max(1, Math.ceil(operationReport?.durationMinutes || 0))} min</td><td class="${operationReport?.valid ? 'ok' : 'bad'}">${operationReport?.valid ? 'OK' : 'SPRAWDŹ'}</td></tr>`;
  }).join('');
  const toolRows = [...toolUsage.values()].map(({ tool, operationNumbers }, index) => `<tr><td>T${index + 1}</td><td><strong>${escapeManufacturingHtml(tool.name)}</strong><small>${escapeManufacturingHtml(tool.type || '')}</small></td><td>${tool.diameter ? `Ø${formatSetupSheetNumber(tool.diameter)}` : '—'}</td><td>${tool.stickout ? `${formatSetupSheetNumber(tool.stickout)} mm` : '—'}</td><td>${operationNumbers.join(', ')}</td></tr>`).join('');
  const issues = [...(report.setupIssues || []), ...report.operations.flatMap((operation) => operation.issues.map((issue) => `${operation.name}: ${issue.message}`)), ...(report.holeCompleteness?.entries || []).flatMap((entry) => [...entry.missingStages.map((stage) => `Ø${formatSetupSheetNumber(entry.diameter)}: brak etapu ${HOLE_STAGE_LABELS[stage] || stage}.`), ...entry.orderingIssues])];
  const issueMarkup = issues.length ? `<ul>${issues.map((issue) => `<li>${escapeManufacturingHtml(issue)}</li>`).join('')}</ul>` : '<p>Kontrola Setupu, ścieżek, kolizji i kompletności obróbki zakończona bez błędów.</p>';
  const dimensions = setupResult.dimensions.map((value) => formatSetupSheetNumber(value)).join(' × ');
  const origin = setupResult.origin.map((value) => formatSetupSheetNumber(value)).join(' / ');
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeManufacturingHtml(projectName)} — ${escapeManufacturingHtml(normalized.name)} — arkusz ustawczy</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#18212a;font:12px/1.4 Arial,sans-serif}header{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #bd252d;padding-bottom:8px}h1,h2,p{margin:0}h1{font-size:23px}header p{color:#52606d}.status{align-self:start;padding:7px 12px;border:2px solid #27815f;color:#176348;font-weight:800}.status.bad{border-color:#bd252d;color:#9c1820}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:10px 0}.fact{border:1px solid #abb5be;padding:7px}.fact span,td small{display:block;color:#66737e;font-size:10px}.fact strong{font-size:13px}section{margin-top:11px}h2{margin-bottom:5px;font-size:14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aeb8c0;padding:5px 6px;text-align:left;vertical-align:top}th{background:#e9edf0;font-size:10px;text-transform:uppercase}.ok{color:#176348;font-weight:800}.bad{color:#9c1820;font-weight:800}.checks{border:1px solid #aeb8c0;padding:8px}.checks ul{margin:0;padding-left:18px}.checks p{color:#176348;font-weight:700}footer{margin-top:10px;border-top:1px solid #aeb8c0;padding-top:6px;color:#66737e;font-size:10px}@media print{body{print-color-adjust:exact}}</style></head><body><header><div><h1>Arkusz ustawczy CAM</h1><p>${escapeManufacturingHtml(projectName)} · ${escapeManufacturingHtml(normalized.name)}</p></div><div class="status${report.valid ? '' : ' bad'}">${report.valid ? 'GOTOWY' : 'WYMAGA POPRAWY'}</div></header><div class="facts"><div class="fact"><span>Obrabiarka</span><strong>${escapeManufacturingHtml(setupResult.machine.name)}</strong></div><div class="fact"><span>Bryła</span><strong>${escapeManufacturingHtml(setupResult.body.name || setupResult.body.id)}</strong></div><div class="fact"><span>Półfabrykat X × Y × Z</span><strong>${dimensions} mm</strong></div><div class="fact"><span>Zero WCS X / Y / Z</span><strong>${origin} mm</strong></div><div class="fact"><span>Płaszczyzna bezpieczna</span><strong>${formatSetupSheetNumber(setupResult.clearancePlaneZ)} mm</strong></div><div class="fact"><span>Operacje</span><strong>${normalized.operations.length}</strong></div><div class="fact"><span>Szacowany czas</span><strong>${Math.max(1, Math.ceil(report.durationMinutes))} min</strong></div><div class="fact"><span>Długość skrawania</span><strong>${formatSetupSheetNumber(report.cuttingDistance, 0)} mm</strong></div></div><section><h2>Narzędzia</h2><table><thead><tr><th>Poz.</th><th>Narzędzie</th><th>Średnica</th><th>Wysięg</th><th>Operacje</th></tr></thead><tbody>${toolRows || '<tr><td colspan="5">Brak narzędzi</td></tr>'}</tbody></table></section><section><h2>Program operacji</h2><table><thead><tr><th>#</th><th>Operacja</th><th>Narzędzie</th><th>Obroty</th><th>Posuw</th><th>Czas</th><th>Kontrola</th></tr></thead><tbody>${operationRows || '<tr><td colspan="7">Brak operacji</td></tr>'}</tbody></table></section><section><h2>Kontrola przed uruchomieniem</h2><div class="checks">${issueMarkup}</div></section><footer>Wygenerowano w MadCAD. Operator odpowiada za sprawdzenie mocowania, korekcji narzędzi, punktu zerowego i przejazdu bez materiału na obrabiarce.</footer></body></html>`;
  return { html, report, operationCount: normalized.operations.length, toolCount: toolUsage.size };
}

export function simulateMaterialRemoval(setup, bodies = [], document = null, progress = 1, resolution = 36) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const report = analyzeManufacturingProgram(setup, bodies, document);
  if (!setupResult.valid || !report.operations.length) return { valid: false, progress: 0, columns: [], cutter: null, removedVolume: 0, warnings: setupResult.warnings };
  const toolpaths = normalizeManufacturingSetup(setup).operations
    .map((operation) => calculateOperationToolpath(setup, operation, bodies, document))
    .filter((toolpath) => toolpath.valid);
  const entries = toolpaths.flatMap((toolpath) => toolpath.segments.map((segment) => ({ segment, tool: toolpath.tool, operationId: toolpath.operation.id })));
  const normalizedProgress = Math.min(1, Math.max(0, Number(progress) || 0));
  const processedCount = Math.min(entries.length, Math.ceil(entries.length * normalizedProgress));
  const [minimum, maximum] = setupResult.stockBounds;
  const width = maximum[0] - minimum[0];
  const depth = maximum[1] - minimum[1];
  const baseResolution = Math.max(12, Math.min(64, Math.round(Number(resolution) || 36)));
  const xCount = width >= depth ? baseResolution : Math.max(12, Math.round(baseResolution * width / depth));
  const yCount = depth >= width ? baseResolution : Math.max(12, Math.round(baseResolution * depth / width));
  const cellWidth = width / xCount;
  const cellDepth = depth / yCount;
  const stockTop = maximum[2];
  const heights = new Float32Array(xCount * yCount).fill(stockTop);
  let cutter = entries[0] ? { position: [...entries[0].segment.from], diameter: entries[0].tool.diameter, operationId: entries[0].operationId } : null;
  for (const entry of entries.slice(0, processedCount)) {
    cutter = { position: [...entry.segment.to], diameter: entry.tool.diameter, operationId: entry.operationId };
    if (entry.segment.kind === 'rapid') continue;
    const length = Math.hypot(...entry.segment.to.map((value, axis) => value - entry.segment.from[axis]));
    const sampleStep = Math.max(0.1, Math.min(cellWidth, cellDepth, entry.tool.diameter / 2) / 2);
    const samples = Math.max(1, Math.ceil(length / sampleStep));
    const radius = entry.tool.diameter / 2;
    for (let sample = 0; sample <= samples; sample += 1) {
      const ratio = sample / samples;
      const point = entry.segment.from.map((value, axis) => value + (entry.segment.to[axis] - value) * ratio);
      const minX = Math.max(0, Math.floor((point[0] - radius - minimum[0]) / cellWidth));
      const maxX = Math.min(xCount - 1, Math.floor((point[0] + radius - minimum[0]) / cellWidth));
      const minY = Math.max(0, Math.floor((point[1] - radius - minimum[1]) / cellDepth));
      const maxY = Math.min(yCount - 1, Math.floor((point[1] + radius - minimum[1]) / cellDepth));
      for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
        const centerX = minimum[0] + (x + 0.5) * cellWidth;
        const centerY = minimum[1] + (y + 0.5) * cellDepth;
        if (Math.hypot(centerX - point[0], centerY - point[1]) <= radius + Math.hypot(cellWidth, cellDepth) / 2) {
          const index = y * xCount + x;
          heights[index] = Math.max(minimum[2], Math.min(heights[index], point[2]));
        }
      }
    }
  }
  const columns = [];
  let removedVolume = 0;
  for (let y = 0; y < yCount; y += 1) for (let x = 0; x < xCount; x += 1) {
    const top = heights[y * xCount + x];
    if (stockTop - top <= 1e-7) continue;
    const volume = (stockTop - top) * cellWidth * cellDepth;
    removedVolume += volume;
    columns.push({ x: minimum[0] + (x + 0.5) * cellWidth, y: minimum[1] + (y + 0.5) * cellDepth, bottom: top, top: stockTop, width: cellWidth, depth: cellDepth });
  }
  return { valid: report.valid, progress: normalizedProgress, columns, cutter, removedVolume, processedSegments: processedCount, totalSegments: entries.length, warnings: report.setupIssues };
}

function gcodeNumber(value) {
  if (!Number.isFinite(Number(value))) throw new Error('Ścieżka CAM zawiera nieprawidłową współrzędną.');
  return Number(Number(value).toFixed(4)).toString();
}

export function createMachineGcode(setup, operation, bodies = [], { projectName = 'MadCAD', document = null, postProcessorId = operation?.postProcessorId, programFragment = false, includeToolChange = true } = {}) {
  const toolpath = calculateOperationToolpath(setup, operation, bodies, document);
  if (!toolpath.valid || !toolpath.segments.length) throw new Error(toolpath.warnings.join(' ') || 'Ścieżka CAM nie jest gotowa do eksportu.');
  const safetyIssues = analyzeToolpathSafety(toolpath);
  if (safetyIssues.length) throw new Error(`Eksport zablokowany przez kontrolę bezpieczeństwa: ${safetyIssues.map((issue) => issue.message).join(' ')}`);
  const origin = toolpath.origin;
  const safeLocalZ = toolpath.clearancePlaneZ - origin[2];
  const postProcessor = CAM_POST_PROCESSORS[postProcessorId] || CAM_POST_PROCESSORS.grbl;
  if (toolpath.operation.type === 'tap' && !['linuxcnc', 'mach3'].includes(postProcessor.id)) throw new Error('Gwintowanie wymaga postprocesora z synchronizowanym cyklem G84.');
  const cleanComment = (value) => String(value).replace(/[\r\n;()]/g, ' ').trim();
  const comment = (value) => postProcessor.commentStyle === 'parentheses' ? `(${cleanComment(value)})` : `; ${cleanComment(value)}`;
  if (toolpath.turning) {
    if (postProcessor.id !== 'linuxcnc-turn') throw new Error('Toczenie wymaga postprocesora LinuxCNC Tokarka.');
    const toolNumber = Object.keys(CAM_TURNING_TOOL_PRESETS).indexOf(toolpath.operation.toolId) + 1;
    const lines = programFragment
      ? [comment(`${operation.name} | ${toolpath.tool.name}`), ...(includeToolChange ? [`T${toolNumber} M6`] : []), `S${toolpath.operation.spindleRpm} M3`]
      : ['%', comment(cleanComment(projectName) || 'MadCAD'), comment(`${operation.name} | ${toolpath.tool.name}`), comment('Sprawdź mocowanie, zero osi Z i średnicę X przed uruchomieniem.'), 'G21', 'G90', 'G18', 'G95', 'G40', `T${toolNumber} M6`, `S${toolpath.operation.spindleRpm} M3`];
    let lastFeed = null;
    for (const segment of toolpath.segments) {
      const diameter = Math.abs(segment.to[1] - origin[1]) * 2;
      const axial = segment.to[0] - origin[0];
      if (segment.kind === 'rapid') lines.push(`G0 X${gcodeNumber(diameter)} Z${gcodeNumber(axial)}`);
      else {
        const feed = segment.feed || toolpath.operation.feedRate;
        lines.push(`G1 X${gcodeNumber(diameter)} Z${gcodeNumber(axial)}${feed !== lastFeed ? ` F${gcodeNumber(feed)}` : ''}`);
        lastFeed = feed;
      }
    }
    lines.push('M5');
    if (!programFragment) lines.push('M2', '%');
    lines.push('');
    return { text: lines.join('\n'), lineCount: lines.length - 1, toolpath, postProcessor: postProcessor.id, extension: postProcessor.extension };
  }
  if (toolpath.operation.type === 'cut2d') {
    if (!['grbl-laser', 'linuxcnc-plasma'].includes(postProcessor.id)) throw new Error('Wybierz postprocesor przeznaczony do cięcia 2D.');
    const isPlasma = postProcessor.id === 'linuxcnc-plasma';
    const lines = programFragment ? [comment(`${operation.name} | ${toolpath.tool.name}`)] : [];
    if (!programFragment && isPlasma) lines.push('%');
    if (!programFragment) lines.push(comment(cleanComment(projectName) || 'MadCAD'), comment(`${operation.name} | ${toolpath.tool.name}`), comment('Sprawdź zero WCS, moc i przejazd bez materiału.'), 'G21', 'G90', 'G17', 'G94');
    if (!programFragment && isPlasma) lines.push('G40', 'G64 P0.01');
    let processOn = false;
    for (const segment of toolpath.segments) {
      const local = segment.to.map((value, axis) => value - origin[axis]);
      if (segment.kind === 'rapid') {
        if (processOn) { lines.push('M5'); processOn = false; }
        lines.push(`G0 X${gcodeNumber(local[0])} Y${gcodeNumber(local[1])} Z${gcodeNumber(local[2])}`);
      } else {
        if (!processOn) {
          lines.push(isPlasma ? 'M3' : `M4 S${Math.round(toolpath.operation.powerPercent * 10)}`);
          if (isPlasma) lines.push('G4 P0.5');
          processOn = true;
        }
        lines.push(`G1 X${gcodeNumber(local[0])} Y${gcodeNumber(local[1])} Z${gcodeNumber(local[2])} F${gcodeNumber(segment.feed || toolpath.operation.feedRate)}`);
      }
    }
    if (processOn) lines.push('M5');
    if (!programFragment) lines.push(isPlasma ? 'M2' : 'M30');
    if (!programFragment && isPlasma) lines.push('%');
    lines.push('');
    return { text: lines.join('\n'), lineCount: lines.length - 1, toolpath, postProcessor: postProcessor.id, extension: postProcessor.extension };
  }
  const presetToolIndex = Object.keys(CAM_TOOL_PRESETS).indexOf(toolpath.tool.id);
  const customToolIndex = document?.manufacturing?.tools?.findIndex((tool) => tool.id === toolpath.tool.id) ?? -1;
  const toolNumber = presetToolIndex >= 0 ? presetToolIndex + 1 : 100 + Math.max(0, customToolIndex);
  const lines = [];
  if (!programFragment && postProcessor.id === 'linuxcnc') lines.push('%');
  if (programFragment) lines.push(comment(`${operation.name} | ${toolpath.tool.name}`));
  else lines.push(
    comment(cleanComment(projectName) || 'MadCAD'),
    comment(`${operation.name} | ${toolpath.tool.name}`),
    comment('Sprawdź punkt zerowy WCS i wykonaj symulację bez materiału przed obróbką.'),
    'G21', 'G90', 'G17', 'G94',
  );
  if (!programFragment && postProcessor.id === 'linuxcnc') lines.push('G40', 'G49', 'G64 P0.01');
  if (!programFragment && postProcessor.id === 'mach3') lines.push('G40', 'G49', 'G80');
  if (includeToolChange && postProcessor.toolChange) lines.push(`T${toolNumber} M6`);
  else if (includeToolChange) lines.push(comment(`Narzędzie T${toolNumber}: ${toolpath.tool.name} — zmień ręcznie przed startem`));
  lines.push(`S${toolpath.operation.spindleRpm} M3`, `G0 Z${gcodeNumber(safeLocalZ)}`);
  if (toolpath.operation.type === 'tap') {
    const retractLocalZ = toolpath.stockBounds[1][2] + toolpath.operation.retractHeight - origin[2];
    lines.push('G98');
    for (const hole of toolpath.holes) lines.push(`G84 X${gcodeNumber(hole.x - origin[0])} Y${gcodeNumber(hole.y - origin[1])} Z${gcodeNumber(hole.targetZ - origin[2])} R${gcodeNumber(retractLocalZ)} F${gcodeNumber(toolpath.operation.feedRate)}`);
    lines.push('G80', `G0 Z${gcodeNumber(safeLocalZ)}`, 'M5');
    if (!programFragment) lines.push(postProcessor.id === 'linuxcnc' ? 'M2' : 'M30');
    if (!programFragment && postProcessor.id === 'linuxcnc') lines.push('%');
    lines.push('');
    return { text: lines.join('\n'), lineCount: lines.length - 1, toolpath, postProcessor: postProcessor.id, extension: postProcessor.extension };
  }
  const supportsCannedDrilling = toolpath.operation.type === 'drill' && ['linuxcnc', 'mach3'].includes(postProcessor.id);
  if (supportsCannedDrilling) {
    const cycleCode = toolpath.operation.cycleType === 'peck' ? 'G83' : toolpath.operation.cycleType === 'dwell' ? 'G82' : 'G81';
    const retractLocalZ = toolpath.stockBounds[1][2] + toolpath.operation.retractHeight - origin[2];
    lines.push('G98');
    for (const hole of toolpath.holes) {
      const words = [cycleCode, `X${gcodeNumber(hole.x - origin[0])}`, `Y${gcodeNumber(hole.y - origin[1])}`, `Z${gcodeNumber(hole.targetZ - origin[2])}`, `R${gcodeNumber(retractLocalZ)}`];
      if (cycleCode === 'G83') words.push(`Q${gcodeNumber(toolpath.operation.peckDepth)}`);
      if (cycleCode === 'G82') words.push(`P${gcodeNumber(toolpath.operation.dwellSeconds)}`);
      words.push(`F${gcodeNumber(toolpath.operation.feedRate)}`);
      lines.push(words.join(' '));
    }
    lines.push('G80', `G0 Z${gcodeNumber(safeLocalZ)}`, 'M5');
    if (!programFragment) lines.push(postProcessor.id === 'linuxcnc' ? 'M2' : 'M30');
    if (!programFragment && postProcessor.id === 'linuxcnc') lines.push('%');
    lines.push('');
    return { text: lines.join('\n'), lineCount: lines.length - 1, toolpath, postProcessor: postProcessor.id, extension: postProcessor.extension };
  }
  let lastFeed = null;
  for (const segment of toolpath.segments) {
    const local = segment.to.map((value, axis) => value - origin[axis]);
    if (segment.kind === 'rapid') lines.push(`G0 X${gcodeNumber(local[0])} Y${gcodeNumber(local[1])} Z${gcodeNumber(local[2])}`);
    else {
      const feed = segment.feed;
      const feedWord = feed !== lastFeed ? ` F${gcodeNumber(feed)}` : '';
      lines.push(`G1 X${gcodeNumber(local[0])} Y${gcodeNumber(local[1])} Z${gcodeNumber(local[2])}${feedWord}`);
      if (segment.dwellSeconds > 0) lines.push(`G4 P${gcodeNumber(segment.dwellSeconds)}`);
      lastFeed = feed;
    }
  }
  lines.push(`G0 Z${gcodeNumber(safeLocalZ)}`, 'M5');
  if (!programFragment) lines.push(postProcessor.id === 'linuxcnc' ? 'M2' : 'M30');
  if (!programFragment && postProcessor.id === 'linuxcnc') lines.push('%');
  lines.push('');
  return { text: lines.join('\n'), lineCount: lines.length - 1, toolpath, postProcessor: postProcessor.id, extension: postProcessor.extension };
}

export function createManufacturingProgramGcode(setup, bodies = [], { projectName = 'MadCAD', document = null, postProcessorId = null } = {}) {
  const normalized = normalizeManufacturingSetup(setup);
  if (!normalized.operations.length) throw new Error('Program CAM wymaga co najmniej jednej operacji.');
  const report = analyzeManufacturingProgram(normalized, bodies, document);
  if (!report.valid) throw new Error('Eksport programu zablokowany: popraw Setup, ścieżki, bezpieczeństwo i kompletność obróbki otworów.');
  const tappingOperation = normalized.operations.find((operation) => operation.type === 'tap');
  const selectedPostId = postProcessorId || tappingOperation?.postProcessorId || normalized.operations[0].postProcessorId;
  const postProcessor = CAM_POST_PROCESSORS[selectedPostId] || CAM_POST_PROCESSORS.grbl;
  const cleanComment = (value) => String(value).replace(/[\r\n;()]/g, ' ').trim();
  const comment = (value) => postProcessor.commentStyle === 'parentheses' ? `(${cleanComment(value)})` : `; ${cleanComment(value)}`;
  const isTurning = normalized.operationKind === 'turning-2axis';
  const isCutting = normalized.operationKind === 'cut-2d';
  if (isTurning && postProcessor.id !== 'linuxcnc-turn') throw new Error('Program tokarski wymaga postprocesora LinuxCNC Tokarka.');
  if (isCutting && !['grbl-laser', 'linuxcnc-plasma'].includes(postProcessor.id)) throw new Error('Program cięcia wymaga postprocesora laserowego albo plazmowego.');
  const linuxCncEnvelope = ['linuxcnc', 'linuxcnc-turn', 'linuxcnc-plasma'].includes(postProcessor.id);
  const lines = [];
  if (linuxCncEnvelope) lines.push('%');
  lines.push(
    comment(cleanComment(projectName) || 'MadCAD'),
    comment(`${normalized.name} | kompletny program CAM | ${normalized.operations.length} operacji`),
    comment('Sprawdź mocowanie, punkt zerowy WCS i wykonaj przejazd bez materiału przed obróbką.'),
    'G21', 'G90', isTurning ? 'G18' : 'G17', isTurning ? 'G95' : 'G94', 'G40',
  );
  if (!isCutting) lines.push('G49');
  if (postProcessor.id === 'linuxcnc' || postProcessor.id === 'linuxcnc-plasma') lines.push('G64 P0.01');
  if (postProcessor.id === 'mach3') lines.push('G80');
  let previousToolId = null;
  const outputs = normalized.operations.map((operation) => {
    const output = createMachineGcode(normalized, operation, bodies, { projectName, document, postProcessorId: postProcessor.id, programFragment: true, includeToolChange: operation.toolId !== previousToolId });
    previousToolId = operation.toolId;
    return output;
  });
  for (const output of outputs) lines.push('', ...output.text.trim().split('\n'));
  lines.push('', 'M5', linuxCncEnvelope ? 'M2' : 'M30');
  if (linuxCncEnvelope) lines.push('%');
  lines.push('');
  return {
    text: lines.join('\n'),
    lineCount: lines.length - 1,
    operationCount: outputs.length,
    toolpaths: outputs.map((output) => output.toolpath),
    postProcessor: postProcessor.id,
    extension: postProcessor.extension,
    report,
  };
}

export function createGrblGcode(setup, operation, bodies = [], options = {}) {
  const output = createMachineGcode(setup, { ...operation, postProcessorId: 'grbl' }, bodies, { ...options, postProcessorId: 'grbl' });
  return { ...output, postProcessor: 'grbl-mm-absolute' };
}

export function validateManufacturing(manufacturing) {
  const issues = [];
  if (!manufacturing || typeof manufacturing !== 'object' || Array.isArray(manufacturing)) return [{ path: 'manufacturing', message: 'Wymagane są dane wytwarzania.', code: 'TYPE' }];
  if (!Array.isArray(manufacturing.setups)) return [{ path: 'manufacturing.setups', message: 'Setupy CAM muszą być tablicą.', code: 'TYPE' }];
  const customToolIds = new Set();
  const customToolNames = new Set();
  if (manufacturing.tools !== undefined && !Array.isArray(manufacturing.tools)) issues.push({ path: 'manufacturing.tools', message: 'Biblioteka narzędzi CAM musi być tablicą.', code: 'TYPE' });
  else (manufacturing.tools || []).forEach((tool, index) => {
    const base = `manufacturing.tools[${index}]`;
    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) { issues.push({ path: base, message: 'Narzędzie CAM musi być obiektem.', code: 'TYPE' }); return; }
    if (typeof tool.id !== 'string' || !tool.id) issues.push({ path: `${base}.id`, message: 'Narzędzie CAM wymaga ID.', code: 'REQUIRED' });
    else if (CAM_TOOL_PRESETS[tool.id] || customToolIds.has(tool.id)) issues.push({ path: `${base}.id`, message: 'ID narzędzia CAM jest zarezerwowane lub powtórzone.', code: 'DUPLICATE_ID' });
    else customToolIds.add(tool.id);
    const name = typeof tool.name === 'string' ? tool.name.trim() : '';
    if (!name) issues.push({ path: `${base}.name`, message: 'Narzędzie CAM wymaga nazwy.', code: 'REQUIRED' });
    else if (customToolNames.has(name.toLocaleLowerCase())) issues.push({ path: `${base}.name`, message: 'Nazwa narzędzia CAM jest powtórzona.', code: 'DUPLICATE' });
    else customToolNames.add(name.toLocaleLowerCase());
    if (!CAM_HOLE_TOOL_TYPES.some((item) => item.id === tool.type)) issues.push({ path: `${base}.type`, message: 'Nieobsługiwany typ narzędzia otworowego.', code: 'UNSUPPORTED' });
    for (const key of ['diameter', 'fluteLength', 'stickout', 'holderDiameter', 'flutes']) if (!Number.isFinite(Number(tool[key])) || Number(tool[key]) <= 0) issues.push({ path: `${base}.${key}`, message: 'Wymiar narzędzia musi być dodatni.', code: 'VALUE' });
    if (tool.type === 'tap' && (!Number.isFinite(Number(tool.pitch)) || Number(tool.pitch) <= 0)) issues.push({ path: `${base}.pitch`, message: 'Gwintownik wymaga dodatniego skoku.', code: 'VALUE' });
    if (tool.type === 'spot-drill' && (!Number.isFinite(Number(tool.pointAngle)) || Number(tool.pointAngle) < 30 || Number(tool.pointAngle) > 170)) issues.push({ path: `${base}.pointAngle`, message: 'Kąt nawiertaka musi mieścić się w zakresie 30–170°.', code: 'VALUE' });
  });
  const templateIds = new Set();
  const templateNames = new Set();
  if (manufacturing.operationTemplates !== undefined && !Array.isArray(manufacturing.operationTemplates)) issues.push({ path: 'manufacturing.operationTemplates', message: 'Szablony operacji CAM muszą być tablicą.', code: 'TYPE' });
  else (manufacturing.operationTemplates || []).forEach((template, index) => {
    const base = `manufacturing.operationTemplates[${index}]`;
    if (!template || typeof template !== 'object' || Array.isArray(template)) { issues.push({ path: base, message: 'Szablon operacji CAM musi być obiektem.', code: 'TYPE' }); return; }
    if (typeof template.id !== 'string' || !template.id) issues.push({ path: `${base}.id`, message: 'Szablon operacji CAM wymaga ID.', code: 'REQUIRED' });
    else if (templateIds.has(template.id)) issues.push({ path: `${base}.id`, message: 'ID szablonu operacji CAM jest powtórzone.', code: 'DUPLICATE_ID' });
    else templateIds.add(template.id);
    const name = typeof template.name === 'string' ? template.name.trim() : '';
    if (!name) issues.push({ path: `${base}.name`, message: 'Szablon operacji CAM wymaga nazwy.', code: 'REQUIRED' });
    else if (templateNames.has(name.toLocaleLowerCase())) issues.push({ path: `${base}.name`, message: 'Nazwa szablonu operacji CAM jest powtórzona.', code: 'DUPLICATE' });
    else templateNames.add(name.toLocaleLowerCase());
    if (!template.operation || typeof template.operation !== 'object' || Array.isArray(template.operation)) issues.push({ path: `${base}.operation`, message: 'Szablon wymaga parametrów operacji CAM.', code: 'TYPE' });
    else {
      const operation = template.operation;
      const supported = ['face', 'contour', 'pocket', 'adaptive', 'drill', 'tap', 'spot', 'counterbore', 'cut2d', 'turn-face', 'turn-profile'].includes(operation.type);
      const isTurning = operation.type === 'turn-face' || operation.type === 'turn-profile';
      if (!supported) issues.push({ path: `${base}.operation.type`, message: 'Szablon zawiera nieobsługiwany typ operacji CAM.', code: 'UNSUPPORTED' });
      if (supported && operation.type !== 'cut2d' && !isTurning && !CAM_TOOL_PRESETS[operation.toolId] && !customToolIds.has(operation.toolId)) issues.push({ path: `${base}.operation.toolId`, message: 'Szablon wskazuje nieznane narzędzie CAM.', code: 'UNSUPPORTED' });
      if (supported && isTurning && !CAM_TURNING_TOOL_PRESETS[operation.toolId]) issues.push({ path: `${base}.operation.toolId`, message: 'Szablon wskazuje nieznany nóż tokarski.', code: 'UNSUPPORTED' });
      if (supported && !CAM_POST_PROCESSORS[operation.postProcessorId]) issues.push({ path: `${base}.operation.postProcessorId`, message: 'Szablon wskazuje nieznany postprocesor CAM.', code: 'UNSUPPORTED' });
      const positiveKeys = operation.type === 'cut2d' ? ['kerfWidth', 'feedRate', 'powerPercent', 'passes'] : operation.type === 'drill' ? ['peckDepth', 'feedRate', 'spindleRpm'] : operation.type === 'tap' ? ['spindleRpm'] : operation.type === 'spot' ? ['targetDiameter', 'feedRate', 'spindleRpm'] : operation.type === 'counterbore' ? ['targetDiameter', 'targetDepth', 'maxStepdown', 'feedRate', 'plungeRate', 'spindleRpm'] : isTurning ? ['stockDiameter', 'targetDiameter', 'axialLength', 'maxDepthOfCut', 'feedRate', 'spindleRpm'] : ['maxStepdown', 'feedRate', 'plungeRate', 'spindleRpm'];
      if (supported) for (const key of positiveKeys) if (!Number.isFinite(Number(operation[key])) || Number(operation[key]) <= 0) issues.push({ path: `${base}.operation.${key}`, message: 'Parametr szablonu operacji musi być dodatni.', code: 'VALUE' });
    }
  });
  const ids = new Set();
  const names = new Set();
  manufacturing.setups.forEach((setup, index) => {
    const base = `manufacturing.setups[${index}]`;
    if (!setup || typeof setup !== 'object' || Array.isArray(setup)) { issues.push({ path: base, message: 'Setup CAM musi być obiektem.', code: 'TYPE' }); return; }
    if (typeof setup.id !== 'string' || !setup.id) issues.push({ path: `${base}.id`, message: 'Setup CAM wymaga ID.', code: 'REQUIRED' });
    else if (ids.has(setup.id)) issues.push({ path: `${base}.id`, message: 'ID setupu CAM jest powtórzone.', code: 'DUPLICATE_ID' });
    else ids.add(setup.id);
    const name = typeof setup.name === 'string' ? setup.name.trim() : '';
    if (!name) issues.push({ path: `${base}.name`, message: 'Setup CAM wymaga nazwy.', code: 'REQUIRED' });
    else if (names.has(name.toLocaleLowerCase())) issues.push({ path: `${base}.name`, message: 'Nazwa setupu CAM jest powtórzona.', code: 'DUPLICATE' });
    else names.add(name.toLocaleLowerCase());
    if (!['mill-3axis', 'cut-2d', 'turning-2axis'].includes(setup.operationKind)) issues.push({ path: `${base}.operationKind`, message: 'Nieobsługiwany rodzaj obróbki.', code: 'UNSUPPORTED' });
    if (typeof setup.bodyId !== 'string') issues.push({ path: `${base}.bodyId`, message: 'Identyfikator bryły musi być tekstem.', code: 'TYPE' });
    if (!CAM_MACHINE_PRESETS[setup.machineId]) issues.push({ path: `${base}.machineId`, message: 'Nieznany profil obrabiarki.', code: 'UNSUPPORTED' });
    if (!CAM_WCS_ORIGINS.some((item) => item.id === setup.wcsOrigin)) issues.push({ path: `${base}.wcsOrigin`, message: 'Nieznany początek układu WCS.', code: 'UNSUPPORTED' });
    for (const key of ['sideOffset', 'topOffset', 'bottomOffset']) if (!Number.isFinite(Number(setup.stock?.[key])) || Number(setup.stock[key]) < 0) issues.push({ path: `${base}.stock.${key}`, message: 'Naddatek musi być liczbą nieujemną.', code: 'VALUE' });
    if (!Number.isFinite(Number(setup.safeHeight)) || Number(setup.safeHeight) < 0) issues.push({ path: `${base}.safeHeight`, message: 'Wysokość bezpieczna musi być liczbą nieujemną.', code: 'VALUE' });
    const groupIds = new Set();
    const groupNames = new Set();
    if (!Array.isArray(setup.operationGroups)) issues.push({ path: `${base}.operationGroups`, message: 'Foldery operacji CAM muszą być tablicą.', code: 'TYPE' });
    else setup.operationGroups.forEach((group, groupIndex) => {
      const groupBase = `${base}.operationGroups[${groupIndex}]`;
      if (!group || typeof group !== 'object' || Array.isArray(group)) { issues.push({ path: groupBase, message: 'Folder operacji CAM musi być obiektem.', code: 'TYPE' }); return; }
      if (typeof group.id !== 'string' || !group.id) issues.push({ path: `${groupBase}.id`, message: 'Folder operacji CAM wymaga ID.', code: 'REQUIRED' });
      else if (groupIds.has(group.id)) issues.push({ path: `${groupBase}.id`, message: 'ID folderu operacji CAM jest powtórzone.', code: 'DUPLICATE_ID' });
      else groupIds.add(group.id);
      const groupName = typeof group.name === 'string' ? group.name.trim() : '';
      if (!groupName) issues.push({ path: `${groupBase}.name`, message: 'Folder operacji CAM wymaga nazwy.', code: 'REQUIRED' });
      else if (groupNames.has(groupName.toLocaleLowerCase())) issues.push({ path: `${groupBase}.name`, message: 'Nazwa folderu operacji CAM jest powtórzona.', code: 'DUPLICATE' });
      else groupNames.add(groupName.toLocaleLowerCase());
      if (typeof group.collapsed !== 'boolean') issues.push({ path: `${groupBase}.collapsed`, message: 'Stan folderu operacji CAM musi być logiczny.', code: 'TYPE' });
    });
    if (!Array.isArray(setup.operations)) issues.push({ path: `${base}.operations`, message: 'Operacje CAM muszą być tablicą.', code: 'TYPE' });
    else setup.operations.forEach((operation, operationIndex) => {
      const operationBase = `${base}.operations[${operationIndex}]`;
      if (!operation || typeof operation !== 'object') issues.push({ path: operationBase, message: 'Operacja CAM musi być obiektem.', code: 'TYPE' });
      else {
        if (!['face', 'contour', 'pocket', 'adaptive', 'drill', 'tap', 'spot', 'counterbore', 'cut2d', 'turn-face', 'turn-profile'].includes(operation.type)) issues.push({ path: `${operationBase}.type`, message: 'Nieobsługiwany typ operacji CAM.', code: 'UNSUPPORTED' });
        const isTurning = operation.type === 'turn-face' || operation.type === 'turn-profile';
        if (operation.type !== 'cut2d' && !isTurning && !CAM_TOOL_PRESETS[operation.toolId] && !customToolIds.has(operation.toolId)) issues.push({ path: `${operationBase}.toolId`, message: 'Nieznane narzędzie CAM.', code: 'UNSUPPORTED' });
        if (isTurning && !CAM_TURNING_TOOL_PRESETS[operation.toolId]) issues.push({ path: `${operationBase}.toolId`, message: 'Nieznany nóż tokarski.', code: 'UNSUPPORTED' });
        if (!CAM_POST_PROCESSORS[operation.postProcessorId]) issues.push({ path: `${operationBase}.postProcessorId`, message: 'Nieznany postprocesor CAM.', code: 'UNSUPPORTED' });
        if (operation.groupId !== undefined && typeof operation.groupId !== 'string') issues.push({ path: `${operationBase}.groupId`, message: 'Folder operacji CAM musi być identyfikatorem tekstowym.', code: 'TYPE' });
        else if (operation.groupId && !groupIds.has(operation.groupId)) issues.push({ path: `${operationBase}.groupId`, message: 'Folder przypisany do operacji CAM nie istnieje.', code: 'BROKEN_REFERENCE' });
        const positiveKeys = operation.type === 'cut2d' ? ['kerfWidth', 'feedRate', 'powerPercent', 'passes'] : operation.type === 'drill' ? ['peckDepth', 'feedRate', 'spindleRpm'] : operation.type === 'tap' ? ['spindleRpm'] : operation.type === 'spot' ? ['targetDiameter', 'feedRate', 'spindleRpm'] : operation.type === 'counterbore' ? ['targetDiameter', 'targetDepth', 'maxStepdown', 'feedRate', 'plungeRate', 'spindleRpm'] : isTurning ? ['stockDiameter', 'targetDiameter', 'axialLength', 'maxDepthOfCut', 'feedRate', 'spindleRpm'] : ['maxStepdown', 'feedRate', 'plungeRate', 'spindleRpm'];
        for (const key of positiveKeys) if (!Number.isFinite(Number(operation[key])) || Number(operation[key]) <= 0) issues.push({ path: `${operationBase}.${key}`, message: 'Parametr operacji musi być dodatni.', code: 'VALUE' });
        if (operation.type === 'drill') for (const key of ['retractHeight', 'breakthroughDepth']) if (!Number.isFinite(Number(operation[key])) || Number(operation[key]) < 0) issues.push({ path: `${operationBase}.${key}`, message: 'Parametr wiercenia musi być nieujemny.', code: 'VALUE' });
        if (operation.type === 'drill' && !['normal', 'peck', 'dwell'].includes(operation.cycleType)) issues.push({ path: `${operationBase}.cycleType`, message: 'Nieobsługiwany cykl wiercenia.', code: 'UNSUPPORTED' });
        if (operation.type === 'drill' && (!Number.isFinite(Number(operation.dwellSeconds)) || Number(operation.dwellSeconds) < 0 || Number(operation.dwellSeconds) > 60)) issues.push({ path: `${operationBase}.dwellSeconds`, message: 'Postój wiercenia musi mieścić się w zakresie 0–60 s.', code: 'VALUE' });
        if (operation.type === 'drill' && (!Array.isArray(operation.holeFeatureIds) || operation.holeFeatureIds.some((id) => typeof id !== 'string' || !id))) issues.push({ path: `${operationBase}.holeFeatureIds`, message: 'Grupy otworów muszą być zapisane jako identyfikatory.', code: 'TYPE' });
        if (operation.type === 'tap' && (!Array.isArray(operation.holeFeatureIds) || operation.holeFeatureIds.some((id) => typeof id !== 'string' || !id))) issues.push({ path: `${operationBase}.holeFeatureIds`, message: 'Grupy otworów muszą być zapisane jako identyfikatory.', code: 'TYPE' });
        if (operation.type === 'tap') for (const key of ['retractHeight', 'bottomClearance']) if (!Number.isFinite(Number(operation[key])) || Number(operation[key]) < 0) issues.push({ path: `${operationBase}.${key}`, message: 'Parametr gwintowania musi być nieujemny.', code: 'VALUE' });
        if (operation.type === 'spot' && (!Array.isArray(operation.holeFeatureIds) || operation.holeFeatureIds.some((id) => typeof id !== 'string' || !id))) issues.push({ path: `${operationBase}.holeFeatureIds`, message: 'Grupy otworów muszą być zapisane jako identyfikatory.', code: 'TYPE' });
        if (operation.type === 'spot' && (!Number.isFinite(Number(operation.retractHeight)) || Number(operation.retractHeight) < 0)) issues.push({ path: `${operationBase}.retractHeight`, message: 'Wycofanie nawiertania musi być nieujemne.', code: 'VALUE' });
        if (operation.type === 'counterbore' && (!Array.isArray(operation.holeFeatureIds) || operation.holeFeatureIds.some((id) => typeof id !== 'string' || !id))) issues.push({ path: `${operationBase}.holeFeatureIds`, message: 'Grupy otworów muszą być zapisane jako identyfikatory.', code: 'TYPE' });
        if (operation.type === 'counterbore' && (!Number.isFinite(Number(operation.retractHeight)) || Number(operation.retractHeight) < 0)) issues.push({ path: `${operationBase}.retractHeight`, message: 'Wycofanie pogłębiania musi być nieujemne.', code: 'VALUE' });
        if (['contour', 'pocket', 'adaptive'].includes(operation.type) && (!Number.isFinite(Number(operation.targetDepth)) || Number(operation.targetDepth) <= 0)) issues.push({ path: `${operationBase}.targetDepth`, message: 'Głębokość obróbki musi być dodatnia.', code: 'VALUE' });
        if (setup.operationKind === 'cut-2d' && operation.type !== 'cut2d') issues.push({ path: `${operationBase}.type`, message: 'Setup cięcia może zawierać tylko operacje cięcia 2D.', code: 'INCOMPATIBLE' });
        if (setup.operationKind === 'mill-3axis' && operation.type === 'cut2d') issues.push({ path: `${operationBase}.type`, message: 'Operacja cięcia wymaga Setupu laserowego lub plazmowego.', code: 'INCOMPATIBLE' });
        if (setup.operationKind === 'turning-2axis' && !isTurning) issues.push({ path: `${operationBase}.type`, message: 'Setup tokarki może zawierać tylko operacje toczenia.', code: 'INCOMPATIBLE' });
        if (setup.operationKind !== 'turning-2axis' && isTurning) issues.push({ path: `${operationBase}.type`, message: 'Operacja toczenia wymaga Setupu tokarki.', code: 'INCOMPATIBLE' });
      }
    });
  });
  if (typeof manufacturing.activeSetupId !== 'string') issues.push({ path: 'manufacturing.activeSetupId', message: 'Aktywny setup musi być identyfikatorem tekstowym.', code: 'TYPE' });
  else if (manufacturing.activeSetupId && !ids.has(manufacturing.activeSetupId)) issues.push({ path: 'manufacturing.activeSetupId', message: 'Aktywny setup CAM nie istnieje.', code: 'BROKEN_REFERENCE' });
  return issues;
}
