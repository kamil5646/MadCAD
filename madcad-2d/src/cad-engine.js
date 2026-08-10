
  const appRoot = document.querySelector(".app");
  const cadHeader = document.querySelector(".cad-header");
  const workspaceEl = document.querySelector(".workspace");
  const canvasWrap = document.querySelector(".canvas-wrap");
  const canvas = document.getElementById("cadCanvas");
  const ctx = canvas.getContext("2d");

  const ribbonTabs = Array.from(document.querySelectorAll(".ribbon-tab[data-page]"));
  const ribbonGroups = Array.from(document.querySelectorAll(".ribbon-group[data-pages]"));
  const ribbonPageActions = Array.from(document.querySelectorAll(".ribbon-actions button[data-pages]"));
  const paletteFlyouts = Array.from(document.querySelectorAll(".ribbon-group-palette[data-flyout]"));
  const paletteLaunchButtons = Array.from(
    document.querySelectorAll(".palette-launch-btn[data-flyout-target]")
  );
  const toolButtons = Array.from(document.querySelectorAll(".tool-btn"));
  console.log("CAD ENGINE LOADED AND BOUND, toolButtons count:", toolButtons.length);
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  const saveJsonBtn = document.getElementById("saveJsonBtn");
  const loadJsonBtn = document.getElementById("loadJsonBtn");
  const exportDxfBtn = document.getElementById("exportDxfBtn");
  const exportDwgBtn = document.getElementById("exportDwgBtn");
  const exportSvgBtn = document.getElementById("exportSvgBtn");
  const printDrawingBtn = document.getElementById("printDrawingBtn");
  const importDxfBtn = document.getElementById("importDxfBtn");
  const importDwgBtn = document.getElementById("importDwgBtn");
  const updateAppBtn = document.getElementById("updateAppBtn");
  const fileMenu = document.getElementById("fileMenu");
  const fileMenuBtn = document.getElementById("fileMenuBtn");
  const fileMenuPanel = document.getElementById("fileMenuPanel");
  const licenseCategoryBtn = document.getElementById("licenseCategoryBtn");
  const licenseSummaryChip = document.getElementById("licenseSummaryChip") || licenseCategoryBtn;
  const fitViewBtn = document.getElementById("fitViewBtn");
  const clearBtn = document.getElementById("clearBtn");
  const jsonFileInput = document.getElementById("jsonFileInput");
  const dxfFileInput = document.getElementById("dxfFileInput");

  const snapToggle = document.getElementById("snapToggle");
  const showGridToggle = document.getElementById("showGridToggle");
  const orthoToggle = document.getElementById("orthoToggle");
  const gridSizeInput = document.getElementById("gridSizeInput");
  const strokeColorInput = document.getElementById("strokeColorInput");
  const lineWidthInput = document.getElementById("lineWidthInput");
  const lineStyleInput = document.getElementById("lineStyleInput");
  const fillToggle = document.getElementById("fillToggle");
  const fillColorInput = document.getElementById("fillColorInput");
  const fillAlphaInput = document.getElementById("fillAlphaInput");
  const shapeContextWindow = document.getElementById("shapeContextWindow");
  const shapeContextTitle = document.getElementById("shapeContextTitle");
  const shapeContextRectFields = document.getElementById("shapeContextRectFields");
  const shapeContextCircleFields = document.getElementById("shapeContextCircleFields");
  const rectConfigWidthInput = document.getElementById("rectConfigWidthInput");
  const rectConfigHeightInput = document.getElementById("rectConfigHeightInput");
  const circleConfigRadiusInput = document.getElementById("circleConfigRadiusInput");

  const activeLayerSelect = document.getElementById("activeLayerSelect");
  const bottomLayerSelect = document.getElementById("bottomLayerSelect");
  const bottomAddLayerBtn = document.getElementById("bottomAddLayerBtn");
  const layerQuickAddOverlay = document.getElementById("layerQuickAddOverlay");
  const layerQuickAddInput = document.getElementById("layerQuickAddInput");
  const layerQuickAddConfirmBtn = document.getElementById("layerQuickAddConfirmBtn");
  const layerQuickAddCancelBtn = document.getElementById("layerQuickAddCancelBtn");
  const layerQuickAddCloseBtn = document.getElementById("layerQuickAddCloseBtn");
  const newLayerNameInput = document.getElementById("newLayerNameInput");
  const addLayerBtn = document.getElementById("addLayerBtn");
  const layerList = document.getElementById("layerList");
  const steelTemplateSelect = document.getElementById("steelTemplateSelect");
  const steelWidthInput = document.getElementById("steelWidthInput");
  const steelHeightInput = document.getElementById("steelHeightInput");
  const steelFrameProfileSelect = document.getElementById("steelFrameProfileSelect");
  const steelPostWidthInput = document.getElementById("steelPostWidthInput");
  const steelPostLengthInput = document.getElementById("steelPostLengthInput");
  const steelPostWidthHint = document.getElementById("steelPostWidthHint");
  const steelPostLengthHint = document.getElementById("steelPostLengthHint");
  const steelBarWidthInput = document.getElementById("steelBarWidthInput");
  const steelPanelCountInput = document.getElementById("steelPanelCountInput");
  const steelPanelCountHint = document.getElementById("steelPanelCountHint");
  const steelInfillPatternSelect = document.getElementById("steelInfillPatternSelect");
  const steelTopPanelToggle = document.getElementById("steelTopPanelToggle");
  const steelTopPanelSizeInput = document.getElementById("steelTopPanelSizeInput");
  const steelBottomPanelToggle = document.getElementById("steelBottomPanelToggle");
  const steelBottomPanelSizeInput = document.getElementById("steelBottomPanelSizeInput");
  const steelSectionCountInput = document.getElementById("steelSectionCountInput");
  const steelGroundClearanceInput = document.getElementById("steelGroundClearanceInput");
  const steelGateLeafCountSelect = document.getElementById("steelGateLeafCountSelect");
  const steelGateLeafCountHint = document.getElementById("steelGateLeafCountHint");
  const steelBasePlateHeightInput = document.getElementById("steelBasePlateHeightInput");
  const steelInnerFrameToggle = document.getElementById("steelInnerFrameToggle");
  const steelDiagonalToggle = document.getElementById("steelDiagonalToggle");
  const steelDiagonalHint = document.getElementById("steelDiagonalHint");
  const steelGenerateBtn = document.getElementById("steelGenerateBtn");
  const steelTemplateHint = document.getElementById("steelTemplateHint");
  const steelTemplateBadges = document.getElementById("steelTemplateBadges");

  const selectionInfo = document.getElementById("selectionInfo");
  const moveCmdBtn = document.getElementById("moveCmdBtn");
  const copyCmdBtn = document.getElementById("copyCmdBtn");
  const trimCmdBtn = document.getElementById("trimCmdBtn");
  const extendCmdBtn = document.getElementById("extendCmdBtn");
  const offsetCmdBtn = document.getElementById("offsetCmdBtn");
  const dimensionModeSelect = document.getElementById("dimensionModeSelect");
  const dimensionRotationInput = document.getElementById("dimensionRotationInput");
  const dimensionAngleSnapInput = document.getElementById("dimensionAngleSnapInput");
  const dimensionUnitSelect = document.getElementById("dimensionUnitSelect");
  const dimensionDecimalsInput = document.getElementById("dimensionDecimalsInput");
  const dimensionTextSizeInput = document.getElementById("dimensionTextSizeInput");
  const dimensionColorInput = document.getElementById("dimensionColorInput");
  const dimAlignedBtn = document.getElementById("dimAlignedBtn");
  const dimLinearBtn = document.getElementById("dimLinearBtn");
  const dimRotatedBtn = document.getElementById("dimRotatedBtn");
  const dimAngularBtn = document.getElementById("dimAngularBtn");
  const duplicateBtn = document.getElementById("duplicateBtn");
  const deleteBtn = document.getElementById("deleteBtn");
  const toFrontBtn = document.getElementById("toFrontBtn");
  const toBackBtn = document.getElementById("toBackBtn");
  const viewPanBtn = document.getElementById("viewPanBtn");
  const viewResetBtn = document.getElementById("viewResetBtn");
  const steelOptionsCardTitle = document.getElementById("steelOptionsCardTitle");

  const coordsLabel = document.getElementById("coords");
  const zoomInfoLabel = document.getElementById("zoomInfo");
  const entityCountLabel = document.getElementById("entityCount");
  const toolInfoLabel = document.getElementById("toolInfo");
  window.__debugVars = { toolInfoLabel };
  const workspaceStateInfo = document.getElementById("workspaceStateInfo");
  const angleInfoLabel = document.getElementById("angleInfo");
  const toastMessage = document.getElementById("toastMessage");
  const startScreen = document.getElementById("startScreen");
  const startEntitiesCount = document.getElementById("startEntitiesCount");
  const startLayersCount = document.getElementById("startLayersCount");
  const startToolName = document.getElementById("startToolName");
  const startScaleValue = document.getElementById("startScaleValue");
  const licenseOverlay = document.getElementById("licenseOverlay");
  const licenseDeviceIdInput = document.getElementById("licenseDeviceIdInput");
  const licenseOpenWebFormBtn = document.getElementById("licenseOpenWebFormBtn");
  const licenseCopyDeviceIdBtn = document.getElementById("licenseCopyDeviceIdBtn");
  const licenseSupportProjectBtn = document.getElementById("licenseSupportProjectBtn");
  const licenseTokenInput = document.getElementById("licenseTokenInput");
  const licenseActivateTokenBtn = document.getElementById("licenseActivateTokenBtn");
  const licenseClearTokenBtn = document.getElementById("licenseClearTokenBtn");
  const licenseCloseBtn = document.getElementById("licenseCloseBtn");
  const licenseStatus = document.getElementById("licenseStatus");

  const LICENSE_STORAGE_KEY = "madcad-license-v1";
  const LICENSE_CLEARED_MARK_KEY = "madcad-license-cleared-at-v1";
  // Tymczasowy przełącznik produktu. Kod licencji pozostaje gotowy do ponownego włączenia.
  const LICENSE_ENFORCEMENT_ENABLED = false;
  const LICENSE_NAG_ON_START_ENABLED = true;
  const UI_LANGUAGE_STORAGE_KEY = "madcad-ui-language";
  const UI_LANGUAGE_ONBOARDING_KEY = "madcad-ui-language-onboarded-v1";
  const LICENSE_TOKEN_PATTERN = /^M2D[0-9]+\.[A-Za-z0-9_-]{8,512}(?:\.[A-Za-z0-9_-]{8,1200})?$/;
  const LICENSE_PRIVATE_FORM_URL = "https://kamil5646.github.io/MadCAD2D/#token-prywatny";
  const LICENSE_SUPPORT_URL = "https://paypal.me/refek1";
  const LICENSE_REGISTRY_ENDPOINTS_CONFIG_URL = "https://kamil5646.github.io/MadCAD2D/license-endpoints.json";
  const LICENSE_REGISTRY_DEFAULT_API_HOST = "madcad-license-registry.kkasprzak15.workers.dev";
  const LICENSE_REGISTRY_ALLOWED_WEB_ORIGIN = "https://kamil5646.github.io";
  const LICENSE_VERIFY_ENDPOINT_URLS = [
    "https://madcad-license-registry.kkasprzak15.workers.dev/v1/license-tokens/verify"
  ];
  const LICENSE_ENDPOINTS_CACHE_TTL_MS = 60000;
  const LICENSE_REMOTE_CHECK_TTL_MS = 10000;
  const LICENSE_REMOTE_RECHECK_INTERVAL_MS = 30000;
  function normalizeAppLanguage(value) {
    return value === "en" || value === "pl" ? value : null;
  }

  function getStoredUiLanguage() {
    try {
      return normalizeAppLanguage(window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY));
    } catch (_error) {
      return null;
    }
  }

  function saveUiLanguage(value) {
    const normalized = normalizeAppLanguage(value);
    if (!normalized) {
      return;
    }
    try {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, normalized);
    } catch (_error) {}
  }

  function hasCompletedLanguageOnboarding() {
    try {
      return window.localStorage.getItem(UI_LANGUAGE_ONBOARDING_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  function markLanguageOnboardingCompleted() {
    try {
      window.localStorage.setItem(UI_LANGUAGE_ONBOARDING_KEY, "1");
    } catch (_error) {}
  }

  let APP_LANGUAGE =
    getStoredUiLanguage() ||
    (window.desktopApp && window.desktopApp.appLanguage === "en" ? "en" : "pl");
  const t = (pl, en) => (APP_LANGUAGE === "en" ? en : pl);
  const IS_MAC_UI =
    (window.desktopApp && window.desktopApp.platform === "darwin") ||
    /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform || "") ||
    /Mac OS X/i.test(navigator.userAgent || "");

  const ICON_MASK_SVG = {
    default:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    home:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>',
    eye:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    layers:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 12 10 5 10-5"/><path d="m2 16 10 5 10-5"/></svg>',
    undo:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H3v6"/><path d="M3 13c2.5-5 10-7 15-2 2.8 2.8 2.8 7.2 0 10"/></svg>',
    redo:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h6v6"/><path d="M21 13c-2.5-5-10-7-15-2-2.8 2.8-2.8 7.2 0 10"/></svg>',
    tool:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 5 5 5"/><path d="M3 21h4l11-11-4-4L3 17v4z"/><path d="M14 3 11 6"/></svg>',
    target:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>',
    chevron_down:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    chevron_right:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    refresh:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    lock:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    file:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h8l5 5v13H7z"/><path d="M15 3v5h5"/></svg>',
    arrow_up:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 4 4 4h-3v8h-2V8H8z"/><path d="M5 20h14"/></svg>',
    arrow_down:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 20-4-4h3V8h2v8h3z"/><path d="M5 4h14"/></svg>',
    print:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8V3h10v5"/><rect x="5" y="8" width="14" height="8" rx="2"/><path d="M7 16h10v5H7z"/></svg>',
    pencil:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 20 5-.8L20 8 16 4 4.8 15z"/><path d="m14 6 4 4"/></svg>',
    square:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg>',
    circle:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/></svg>',
    paint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a5 5 0 0 0-5 5c0 2 1.2 3.5 3 4l-1 4h6l-1-4c1.8-.5 3-2 3-4a5 5 0 0 0-5-5z"/><path d="M9 20h6"/></svg>',
    measure:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 13-13 3 3-13 13H4z"/><path d="m12 6 6 6"/></svg>',
    hand:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>',
    move:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4-4v3h10v2H9v3z"/></svg>',
    copy:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5h11"/></svg>',
    swap:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h14l-3-3"/><path d="m18 7-3 3"/><path d="M20 17H6l3-3"/><path d="m6 17 3 3"/></svg>',
    trash:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M8 6V4h8v2"/><path d="m7 6 1 14h8l1-14"/></svg>',
    search:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="m16 16 5 5"/></svg>',
    x:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round"><path d="M6 6 18 18M18 6 6 18"/></svg>',
    settings:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
    pin:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 4 4-2 2v4l-2 2-2-2V9L8 7z"/><path d="M11 15v6"/></svg>',
    grid:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg>',
    ortho:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v18"/></svg>',
    modes:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="17" r="2"/></svg>',
    plus:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 5 5 11-11"/></svg>',
    globe:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13 13 0 0 1 0 18"/><path d="M12 3a13 13 0 0 0 0 18"/></svg>',
    heart:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black"><path d="M12 21s-8-5.5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-8 11-8 11z"/></svg>',
    money:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 9h.01M17 15h.01"/></svg>',
    warning:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3z"/><path d="M12 9v6"/><path d="M12 18h.01"/></svg>',
    play:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black"><path d="m7 5 12 7-12 7z"/></svg>',
    briefcase:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/><path d="M3 12h18"/></svg>',
    line:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round"><path d="M4 12h16"/></svg>',
    polyline:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 16 6-8 5 4 5-7"/></svg>'
  };

  const ICON_MASK_URI = Object.fromEntries(
    Object.entries(ICON_MASK_SVG).map(([key, svg]) => [key, `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`])
  );

  const ICON_GLYPH_TO_KEY = {
    "\u2302": "home",
    "\uD83C\uDFE0": "home",
    "\uD83D\uDCCF": "measure",
    "\uD83C\uDFD7": "tool",
    "\uD83D\uDC41": "eye",
    "\uD83D\uDCD1": "layers",
    "\u21B6": "undo",
    "\u21B7": "redo",
    "\uD83D\uDD28": "tool",
    "\uD83C\uDFAF": "target",
    "\u25BC": "chevron_down",
    "\u25B6": "chevron_right",
    "\uD83D\uDD04": "refresh",
    "\uD83D\uDD12": "lock",
    "\uD83D\uDCBE": "file",
    "\uD83D\uDCC1": "file",
    "\uD83D\uDCC2": "file",
    "\uD83D\uDEE0": "tool",
    "\uD83D\uDCE4": "arrow_up",
    "\uD83D\uDCE5": "arrow_down",
    "\uD83D\uDCC4": "file",
    "\uD83D\uDDB6": "print",
    "\u2B59": "target",
    "\u25C9": "target",
    "\uD83D\uDD8B": "pencil",
    "\u25AD": "square",
    "\u25EF": "circle",
    "\u25CB": "circle",
    "\uD83C\uDFA8": "paint",
    "\u270D": "pencil",
    "\uD83D\uDCD0": "measure",
    "\u270B": "hand",
    "\u279C": "move",
    "\uD83D\uDCCB": "copy",
    "\u21C4": "swap",
    "\uD83D\uDDD1": "trash",
    "\u2B06": "arrow_up",
    "\u2B07": "arrow_down",
    "\uD83D\uDD0D": "search",
    "\u274C": "x",
    "\u274E": "x",
    "\uD83D\uDD27": "settings",
    "\u2194": "measure",
    "\u21C6": "measure",
    "\u2220": "measure",
    "\u2221": "measure",
    "\u2699": "settings",
    "\uD83D\uDCCC": "pin",
    "\u229E": "grid",
    "\u2223": "ortho",
    "\u2694": "modes",
    "\u2795": "plus",
    "\uD83D\uDCCD": "pin",
    "\u25A6": "layers",
    "\uD83D\uDDD2": "layers",
    "\u2713": "check",
    "\u2714": "check",
    "\u2715": "x",
    "\u2716": "x",
    "\uD83C\uDF10": "globe",
    "\uD83D\uDC99": "heart",
    "\uD83D\uDCB0": "money",
    "\u2705": "check",
    "\u26A0": "warning",
    "\u23F5": "play",
    "\uD83D\uDCBC": "briefcase",
    "\u2500": "line",
    "\u223F": "polyline",
    "\u21A6": "measure"
  };

  function decodeIconGlyph(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) {
      return "";
    }
    const dec = raw.match(/^&#([0-9]+);$/i);
    if (dec) {
      const codepoint = Number.parseInt(dec[1], 10);
      if (Number.isFinite(codepoint) && codepoint > 0) {
        return String.fromCodePoint(codepoint);
      }
    }
    const hex = raw.match(/^&#x([0-9a-f]+);$/i);
    if (hex) {
      const codepoint = Number.parseInt(hex[1], 16);
      if (Number.isFinite(codepoint) && codepoint > 0) {
        return String.fromCodePoint(codepoint);
      }
    }
    return raw;
  }

  function resolveSvgIconMask(glyph) {
    if (!glyph) {
      return ICON_MASK_URI.default;
    }
    if (Object.prototype.hasOwnProperty.call(ICON_MASK_URI, glyph)) {
      return ICON_MASK_URI[glyph];
    }
    const mappedKey = ICON_GLYPH_TO_KEY[glyph] || "default";
    return ICON_MASK_URI[mappedKey] || ICON_MASK_URI.default;
  }

  function applySvgIconMask(element) {
    if (!(element instanceof HTMLElement) || !element.classList.contains("has-icon")) {
      return;
    }
    const glyph = decodeIconGlyph(element.getAttribute("data-icon"));
    const mask = resolveSvgIconMask(glyph);
    element.style.setProperty("--icon-mask", `url("${mask}")`);
  }

  function refreshSvgIcons(root = document) {
    const target = root instanceof HTMLElement || root instanceof Document ? root : document;
    if (target instanceof HTMLElement && target.classList.contains("has-icon")) {
      applySvgIconMask(target);
    }
    if (typeof target.querySelectorAll === "function") {
      target.querySelectorAll(".has-icon").forEach((node) => applySvgIconMask(node));
    }
  }

  let iconMutationObserver = null;
  function watchSvgIconMutations() {
    if (iconMutationObserver || typeof MutationObserver !== "function" || !document.body) {
      return;
    }
    iconMutationObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === "attributes") {
          applySvgIconMask(record.target);
          return;
        }
        if (record.type === "childList") {
          record.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              refreshSvgIcons(node);
            }
          });
        }
      });
    });
    iconMutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-icon"]
    });
  }

  function formatShortcutTextForPlatform(value) {
    const text = String(value || "");
    if (!text || !IS_MAC_UI) {
      return text;
    }
    return text
      .replace(/CmdOrCtrl\+/g, "⌘")
      .replace(/Ctrl\+/g, "⌘")
      .replace(/Alt\+/g, "⌥")
      .replace(/Shift\+/g, "⇧")
      .replace(/\bBackspace\b/g, "⌫")
      .replace(/\bDelete\b/g, "⌫")
      .replace(/\bEnter\b/g, "↩");
  }

  function applyPlatformShortcutLabels(root = document) {
    if (!IS_MAC_UI || !root || typeof root.querySelectorAll !== "function") {
      return;
    }
    root.querySelectorAll("button, [title]").forEach((element) => {
      if (typeof element.textContent === "string" && element.children.length === 0) {
        element.textContent = formatShortcutTextForPlatform(element.textContent);
      }
      const title = element.getAttribute && element.getAttribute("title");
      if (title) {
        element.setAttribute("title", formatShortcutTextForPlatform(title));
      }
    });
  }

  function localizeMessageText(value) {
    const text = formatShortcutTextForPlatform(String(value || ""));
    if (APP_LANGUAGE !== "en" || !text) {
      return text;
    }
    const exact = {
      "Polecenie anulowane.": "Command canceled.",
      "Brak zaznaczonego obiektu": "No object selected",
      "Gotowe. Użyj przycisków ze wstążki.": "Ready. Use ribbon buttons.",
      "Przywrócono widoczność warstw z istniejącą geometrią.": "Restored visibility for layers with existing geometry.",
      "Możesz aktywować token licencji lub kontynuować pracę bez blokady.":
        "You can activate a license token or continue without any lock.",
      "Wybierz plik DXF do importu.": "Choose a DXF file to import.",
      "Wybierz plik JSON do wczytania.": "Choose a JSON file to load.",
      "Wyczyszczono rysunek.": "Drawing cleared.",
      "Rysunek jest pusty lub anulowano czyszczenie.": "Drawing is empty or clearing was canceled.",
      "Brak zaznaczonego obiektu do usunięcia.": "No selected object to delete.",
      "Najpierw zaznacz obiekt do duplikacji.": "Select an object first to duplicate.",
      "Utworzono nowy pusty rysunek.": "Created a new empty drawing.",
      "Token aktywny.": "Token active.",
      "Zapis anulowany.": "Save canceled.",
      "ODA File Converter skonfigurowany poprawnie.": "ODA File Converter configured correctly.",
      "ODA File Converter zainstalowany. Import i eksport DWG są aktywne.":
        "ODA File Converter installed. DWG import and export are active.",
      "Instalowanie dodatku ODA (DWG)...": "Installing ODA add-on (DWG)...",
      "Eksport DWG anulowany.": "DWG export canceled.",
      "Brak aktywnego polecenia.": "No active command.",
      "Tryb LINIA.": "LINE mode.",
      "Tryb POLILINIA.": "POLYLINE mode.",
      "Tryb PROSTOKĄT.": "RECTANGLE mode.",
      "Tryb OKRĄG.": "CIRCLE mode.",
      "Tryb POMIAR.": "MEASURE mode.",
      "Tryb PRZESUŃ.": "MOVE mode.",
      "Tryb ZAZNACZ.": "SELECT mode.",
      "Przełączono na tryb Rysowanie 2D.": "Switched to 2D drawing mode.",
      "Dopasowano widok do obiektów.": "Fitted view to objects.",
      "Panele: widoczne.": "Panels: visible.",
      "Panele: ukryte.": "Panels: hidden.",
      "Zamknięto aktywny panel.": "Closed active panel.",
      "Otwarto panel: Warstwy.": "Opened panel: Layers.",
      "Polecenie WYCZYŚĆ wykonane.": "CLEAR command executed.",
      "Nie można usunąć warstwy.": "Cannot delete layer.",
      "Nie utworzono geometrii szablonu.": "No template geometry was created.",
      "Automatycznie odkryto i odblokowano warstwy KONSTRUKCJA/WYPELNIENIE.":
        "Automatically unhid and unlocked CONSTRUCTION/FILL layers."
    };
    if (Object.prototype.hasOwnProperty.call(exact, text)) {
      return exact[text];
    }
    return text
      .replace(/^Usunięto obiekty: (\d+)\.$/, "Deleted objects: $1.")
      .replace(/^Zduplikowano obiekty: (\d+)\.$/, "Duplicated objects: $1.")
      .replace(/^Wczytano DXF: (.+) \((\d+) obiektów\)\.$/, "Loaded DXF: $1 ($2 objects).")
      .replace(/^Nie udało się wczytać DXF: (.+)$/, "Failed to load DXF: $1")
      .replace(/^Błąd importu DXF: (.+)$/, "DXF import error: $1")
      .replace(/^Niepoprawny plik JSON: (.+)$/, "Invalid JSON file: $1")
      .replace(/^Wczytano JSON: (.+) \((\d+) obiektów\)\.$/, "Loaded JSON: $1 ($2 objects).")
      .replace(/^Wyeksportowano plik: (.+)$/, "Exported file: $1")
      .replace(/^Przyciąganie: WŁ\.$/, "Snap: ON")
      .replace(/^Przyciąganie: WYŁ\.$/, "Snap: OFF")
      .replace(/^Siatka: WŁ\.$/, "Grid: ON")
      .replace(/^Siatka: WYŁ\.$/, "Grid: OFF")
      .replace(/^Poziom\/Pion: WŁ\.$/, "Horizontal/Vertical: ON")
      .replace(/^Poziom\/Pion: WYŁ\.$/, "Horizontal/Vertical: OFF")
      .replace(/^Poziom\/Pion: WŁ\. \(F8\)$/, "Horizontal/Vertical: ON (F8)")
      .replace(/^Poziom\/Pion: WYŁ\. \(F8\)$/, "Horizontal/Vertical: OFF (F8)")
      .replace(/^ORTHO: WŁ\.$/, "ORTHO: ON")
      .replace(/^ORTHO: WYŁ\.$/, "ORTHO: OFF")
      .replace(/^Wstążka: zwinięta\.$/, "Ribbon: collapsed.")
      .replace(/^Wstążka: rozwinięta\.$/, "Ribbon: expanded.")
      .replace(/^Zakładka: Główne\.$/, "Tab: Home.")
      .replace(/^Zakładka: Wymiarowanie\.$/, "Tab: Dimensioning.")
      .replace(/^Zakładka: Stal\.$/, "Tab: Steel.")
      .replace(/^Zakładka: Widok\.$/, "Tab: View.")
      .replace(/^Zakładka: Warstwy\.$/, "Tab: Layers.")
      .replace(/^Aktywna warstwa: (.+)\.$/, "Active layer: $1.")
      .replace(/^Dodano warstwę: (.+)\.$/, "Added layer: $1.")
      .replace(/^Usunięto warstwę: (.+)\.$/, "Deleted layer: $1.")
      .replace(/^Nieznane polecenie: (.+)$/, "Unknown command: $1")
      .replace(/^Wyeksportowano plik: (.+)$/, "Exported file: $1")
      .replace(/^Wczytano JSON: (.+) \((\d+) obiektów\)\.$/, "Loaded JSON: $1 ($2 objects).")
      .replace(/^Wczytano (DWG|DXF): (.+) \((\d+) obiektów\)\.$/, "Loaded $1: $2 ($3 objects).")
      .replace(/^Błąd importu (DWG|DXF): (.+)$/, "$1 import error: $2")
      .replace(/^Niepoprawny plik JSON: (.+)$/, "Invalid JSON file: $1")
      .replace(/^Warstwa (.+): widoczna\.$/, "Layer $1: visible.")
      .replace(/^Warstwa (.+): ukryta\.$/, "Layer $1: hidden.")
      .replace(/^Warstwa (.+): zablokowana\.$/, "Layer $1: locked.")
      .replace(/^Warstwa (.+): odblokowana\.$/, "Layer $1: unlocked.")
      .replace(/^MadCAD jest aktualny \(v(.+)\)\.$/, "MadCAD is up to date (v$1).")
      .replace(/^Automatyczny aktualizator nie jest dostępny w tej wersji\.$/, "Automatic updater is not available in this version.")
      .replace(/^Pobieranie aktualizacji\. Po chwili aplikacja uruchomi instalator\.$/, "Downloading update. The app will launch installer shortly.")
      .replace(
        /^Aktualizacja uruchomiona\. Aplikacja zamknie się i zainstaluje nową wersję\.$/,
        "Update started. The app will close and install the new version."
      )
      .replace(/^Masz już najnowszą wersję programu\.$/, "You already have the latest version.")
      .replace(/^MOVE: najpierw zaznacz obiekt\.$/, "MOVE: select an object first.")
      .replace(/^MOVE: obiekt jest na zablokowanej warstwie\.$/, "MOVE: object is on a locked layer.")
      .replace(/^MOVE: wskaz punkt bazowy\.$/, "MOVE: select base point.")
      .replace(/^COPY: najpierw zaznacz obiekt\.$/, "COPY: select an object first.")
      .replace(/^COPY: obiekt jest na zablokowanej warstwie\.$/, "COPY: object is on a locked layer.")
      .replace(/^COPY: wskaz punkt bazowy\.$/, "COPY: select base point.")
      .replace(/^OFFSET: wskaz stronę odsunięcia \(dystans (.+)\)\.$/, "OFFSET: select side (distance $1).")
      .replace(/^OFFSET: wskaz obiekt bazowy \(dystans (.+)\)\.$/, "OFFSET: select source object (distance $1).")
      .replace(/^(MOVE|COPY): obiekt źródłowy nie istnieje\.$/, "$1: source object does not exist.")
      .replace(/^(MOVE|COPY): wskaz punkt docelowy\.$/, "$1: select target point.")
      .replace(/^(MOVE|COPY): przemieszczenie 0\. Polecenie anulowane\.$/, "$1: zero displacement. Command canceled.")
      .replace(/^(MOVE|COPY): wykonano\.$/, "$1: done.")
      .replace(/^OFFSET: wskaz linie, prostokąt lub okrąg\.$/, "OFFSET: select a line, rectangle or circle.")
      .replace(/^OFFSET: obiekt jest na zablokowanej warstwie\.$/, "OFFSET: object is on a locked layer.")
      .replace(/^OFFSET: nie można utworzyc offsetu dla tego obiektu\.$/, "OFFSET: cannot create offset for this object.")
      .replace(/^OFFSET: utworzono obiekt\.$/, "OFFSET: object created.")
      .replace(/^Komendy tekstowe są wyłączone\.$/, "Text commands are disabled.")
      .replace(/^Wpisz polecenie\.$/, "Enter a command.")
      .replace(/^Tryb WYMIAR \(wyrównany\)\.$/, "DIMENSION mode (aligned).")
      .replace(/^Tryb WYMIAR \(liniowy\)\.$/, "DIMENSION mode (linear).")
      .replace(/^Tryb WYMIAR \(obrócony\)\.$/, "DIMENSION mode (rotated).")
      .replace(/^Tryb WYMIAR \(kątowy\)\.$/, "DIMENSION mode (angular).")
      .replace(/^Tryb WYMIAR \(obrócony, kąt (.+)\)\.$/, "DIMENSION mode (rotated, angle $1).")
      .replace(
        /^Tryb WYMIAR \(kątowy\)\. Wskaż: wierzchołek, ramię 1, ramię 2, położenie łuku\.$/,
        "DIMENSION mode (angular). Pick: vertex, arm 1, arm 2, arc position."
      )
      .replace(/^Tryb: stal$/, "Mode: steel")
      .replace(/^Tryb: rysunek$/, "Mode: drawing")
      .replace(/^Tryb: RYSOWANIE 2D\.$/, "Mode: 2D DRAWING.")
      .replace(/^Użyj: mode rysunek \| mode stal$/, "Use: mode drawing | mode steel")
      .replace(/^Użyj: tab główne\|wymiarowanie\|stal\|widok\|warstwy$/, "Use: tab home|dimensioning|steel|view|layers")
      .replace(/^Zakładka ([^ ]+) nie jest dostępna w tym trybie\.$/, "Tab $1 is not available in this mode.")
      .replace(/^Układ: Arkusz1\.$/, "Layout: Sheet1.")
      .replace(/^Użyj: layout model \| layout arkusz1$/, "Use: layout model | layout sheet1")
      .replace(/^Wypełnienie: (.+)\.$/, "Infill: $1.")
      .replace(/^Wypełnienie ustawione: (.+)\.$/, "Infill set: $1.")
      .replace(/^Użyj: infill pion\|poziom\|siatka\|x$/, "Use: infill vertical|horizontal|grid|x")
      .replace(/^Ilość paneli: (\d+) szt.\/sekcja\.$/, "Panel count: $1 pcs/section.")
      .replace(/^Użyj: panele <szt>$/, "Use: panels <count>")
      .replace(
        /^Komenda spacing została zastąpiona\. Użyj: panele <szt>\. Aktualnie: (\d+)\.$/,
        "Spacing command was replaced. Use: panels <count>. Current: $1."
      )
      .replace(/^Użyj: panele <szt> \(komenda spacing jest wycofana\)\.$/, "Use: panels <count> (spacing command is deprecated).")
      .replace(
        /^Komenda spacing jest wycofana\. Przeliczono na ilość paneli: (\d+) szt.\/sekcja\.$/,
        "Spacing command is deprecated. Recalculated to panel count: $1 pcs/section."
      )
      .replace(/^Szerokość słupka: ([\d.]+) mm\.$/, "Post width: $1 mm.")
      .replace(/^Użyj: postwidth <mm>$/, "Use: postwidth <mm>")
      .replace(/^Długość słupka: ([\d.]+) mm\.$/, "Post length: $1 mm.")
      .replace(/^Użyj: postlength <mm>$/, "Use: postlength <mm>")
      .replace(/^Sekcje: (\d+)\.$/, "Sections: $1.")
      .replace(/^Użyj: sections <1-6>$/, "Use: sections <1-6>")
      .replace(/^Skrzydła bramy: (\d+)\.$/, "Gate leaves: $1.")
      .replace(/^Użyj: skrzydła <1-2>$/, "Use: leaves <1-2>")
      .replace(/^Prześwit od dołu: ([\d.]+) mm\.$/, "Bottom clearance: $1 mm.")
      .replace(/^Użyj: clearance <mm>$/, "Use: clearance <mm>")
      .replace(/^Podmurówka: ([\d.]+) mm\.$/, "Base plate: $1 mm.")
      .replace(/^Użyj: baseplate <mm>$/, "Use: baseplate <mm>")
      .replace(/^Użyj: innerframe on \| innerframe off \| innerframe toggle$/, "Use: innerframe on | innerframe off | innerframe toggle")
      .replace(/^Rama wewnętrzna: (ON|OFF)\.$/, "Inner frame: $1.")
      .replace(/^Panel górny: (ON|OFF), rozmiar ([\d.]+) mm\.$/, "Top panel: $1, size $2 mm.")
      .replace(/^Użyj: toppanel on\|off\|toggle lub toppanel <mm>$/, "Use: toppanel on|off|toggle or toppanel <mm>")
      .replace(/^Panel dolny: (ON|OFF), rozmiar ([\d.]+) mm\.$/, "Bottom panel: $1, size $2 mm.")
      .replace(/^Użyj: bottompanel on\|off\|toggle lub bottompanel <mm>$/, "Use: bottompanel on|off|toggle or bottompanel <mm>")
      .replace(/^Rozmiar panelu górnego: ([\d.]+) mm\.$/, "Top panel size: $1 mm.")
      .replace(/^Użyj: toppanelsize <mm>$/, "Use: toppanelsize <mm>")
      .replace(/^Rozmiar panelu dolnego: ([\d.]+) mm\.$/, "Bottom panel size: $1 mm.")
      .replace(/^Użyj: bottompanelsize <mm>$/, "Use: bottompanelsize <mm>")
      .replace(/^Dostępne: zoom extents$/, "Available: zoom extents")
      .replace(/^Użyj: snap on \| snap off \| snap toggle$/, "Use: snap on | snap off | snap toggle")
      .replace(/^Użyj: grid on \| grid off \| grid toggle$/, "Use: grid on | grid off | grid toggle")
      .replace(/^Użyj: ortho on \| ortho off \| ortho toggle$/, "Use: ortho on | ortho off | ortho toggle")
      .replace(/^Użyj: ribbon on \| ribbon off \| ribbon toggle$/, "Use: ribbon on | ribbon off | ribbon toggle")
      .replace(/^Użyj: paleta on \| paleta off \| paleta toggle$/, "Use: palette on | palette off | palette toggle")
      .replace(/^Precyzja musi być liczbą 0-4\.$/, "Precision must be a number between 0 and 4.")
      .replace(/^Rozmiar tekstu musi być liczbą 8-48\.$/, "Text size must be a number between 8 and 48.")
      .replace(
        /^Tryb wymiaru: aligned\/wyrównany, linear\/liniowy, rotated\/obrócony lub angular\/kątowy\.$/,
        "Dimension mode: aligned, linear, rotated or angular."
      )
      .replace(/^Kolor DIM musi być w formacie #RRGGBB\.$/, "DIM color must be in #RRGGBB format.")
      .replace(/^Kąt wymiaru: ([\d.-]+)°\.$/, "Dimension angle: $1deg.")
      .replace(/^Użyj: dimangle <stopnie>$/, "Use: dimangle <degrees>")
      .replace(/^Skok kąta wymiaru: ([\d.-]+)°\.$/, "Dimension angle snap: $1deg.")
      .replace(/^Użyj: dimsnap <0-90>$/, "Use: dimsnap <0-90>")
      .replace(/^Użyj: dimcolor #RRGGBB$/, "Use: dimcolor #RRGGBB")
      .replace(/^Nie udało się ustawić warstwy\.$/, "Failed to set layer.")
      .replace(/^Brama: za mała szerokość dla liczby skrzydeł\.$/, "Gate: width too small for selected leaf count.")
      .replace(/^Ogrodzenie: za mała szerokość dla wybranej szerokości słupków\.$/, "Fence: width too small for selected post width.")
      .replace(/^Ogrodzenie: za mała szerokość na odstęp między słupkiem a profilem\.$/, "Fence: width too small for spacing between post and profile.")
      .replace(/^Siatka: pion (\d+) szt\. \(przerwa ([\d.-]+) mm\), poziom (\d+) szt\. \(przerwa ([\d.-]+) mm\)\.$/, "Grid: vertical $1 pcs (gap $2 mm), horizontal $3 pcs (gap $4 mm).")
      .replace(/^Panele dopasowano: (\d+) szt.\/sekcja, przerwa ([\d.-]+) mm\.$/, "Panels adjusted: $1 pcs/section, gap $2 mm.")
      .replace(/^(.+): utworzono (\d+) elementów \((\d+)x(\d+) mm(?:, skrzydła (\d+))?, (.+)\)\.$/, (_m, name, count, width, height, leaves, infill) => {
        const leavesPart = leaves ? `, leaves ${leaves}` : "";
        return `${name}: created ${count} elements (${width}x${height} mm${leavesPart}, ${infill}).`;
      })
      .replace(/^Otwarto podgląd wydruku\. W nowym oknie wybierz Drukuj lub Zapisz jako PDF\.$/, "Opened print preview. In the new window choose Print or Save as PDF.")
      .replace(/^Otwarto podgląd wydruku w oknie aplikacji\. Użyj Drukuj\/Zapisz PDF\.$/, "Opened print preview in app window. Use Print/Save PDF.")
      .replace(/^Otwarto okno systemowe druku \(tryb awaryjny bez popupu\)\.$/, "Opened system print window (fallback mode without popup).")
      .replace(/^Nie udało się otworzyć podglądu wydruku(.+)$/, "Could not open print preview$1")
      .replace(/^Błąd zapisu: (.+)$/, "Save error: $1")
      .replace(/^Błąd ODA: (.+)$/, "ODA error: $1")
      .replace(/^Błąd eksportu DWG: (.+)$/, "DWG export error: $1")
      .replace(/^Instalacja ODA wymaga wersji desktop aplikacji\.$/, "ODA installation requires the desktop app version.")
      .replace(/^Błąd instalacji ODA: (.+)$/, "ODA installation error: $1")
      .replace(/^Wybierz plik JSON do wczytania\.$/, "Select a JSON file to load.")
      .replace(/^Wybierz plik DXF lub DWG do importu\.$/, "Select a DXF or DWG file to import.")
      .replace(/^Wybierz plik DWG do importu\.$/, "Select a DWG file to import.")
      .replace(/^Błąd importu (.+): (.+)$/, "Import error $1: $2")
      .replace(/^Przywrócono autozapis po awaryjnym zamknięciu\.$/, "Restored autosave after unexpected shutdown.")
      .replace(/^Eksport DWG jest dostępny tylko w wersji desktop z konwerterem ODA\.$/, "DWG export is available only in desktop version with ODA converter.")
      .replace(/^Zapisano plik: (.+)$/, "Saved file: $1")
      .replace(/^Cofnięto \(Ctrl\+Z\)\.$/, "Undo (Ctrl+Z).")
      .replace(/^Brak operacji do cofnięcia \(Ctrl\+Z\)\.$/, "No operation to undo (Ctrl+Z).")
      .replace(/^Ponówiono \(Ctrl\+Y\)\.$/, "Redo (Ctrl+Y).")
      .replace(/^Brak operacji do ponówienia \(Ctrl\+Y\)\.$/, "No operation to redo (Ctrl+Y).")
      .replace(/^Zduplikowano obiekt \(Ctrl\+D\)\.$/, "Duplicated object (Ctrl+D).")
      .replace(/^Brak obiektu do duplikacji \(Ctrl\+D\)\.$/, "No object to duplicate (Ctrl+D).")
      .replace(/^Skopiowano obiekt \(Ctrl\+C\)\.$/, "Copied object (Ctrl+C).")
      .replace(/^Brak obiektu do kopiowania \(Ctrl\+C\)\.$/, "No object to copy (Ctrl+C).")
      .replace(/^Wklejono obiekt \(Ctrl\+V\)\.$/, "Pasted object (Ctrl+V).")
      .replace(/^Schowek pusty \(Ctrl\+V\)\.$/, "Clipboard is empty (Ctrl+V).")
      .replace(/^Usunięto zaznaczony obiekt\.$/, "Deleted selected object.")
      .replace(/^Brak obiektu do usunięcia\.$/, "No object to delete.")
      .replace(/^Skrót Z: narzędzie ZAZNACZ\.$/, "Shortcut Z: SELECT tool.")
      .replace(/^Skrót L: narzędzie LINIA\.$/, "Shortcut L: LINE tool.")
      .replace(/^Skrót Y: narzędzie POLILINIA\.$/, "Shortcut Y: POLYLINE tool.")
      .replace(/^Skrót D: narzędzie WYMIAR\.$/, "Shortcut D: DIMENSION tool.")
      .replace(/^Skrót P: narzędzie PROSTOKĄT\.$/, "Shortcut P: RECTANGLE tool.")
      .replace(/^Skrót O: narzędzie OKRĄG\.$/, "Shortcut O: CIRCLE tool.")
      .replace(/^Skrót B: narzędzie MALOWANIE\.$/, "Shortcut B: PAINT tool.")
      .replace(/^Skrót M: narzędzie POMIAR\.$/, "Shortcut M: MEASURE tool.")
      .replace(/^Skrót H: narzędzie PRZESUŃ\.$/, "Shortcut H: PAN tool.")
      .replace(/^Narzędzie: (.+)\.$/, "Tool: $1.")
      .replace(/^Otwarto menedżer licencji\.$/, "Opened license manager.")
      .replace(/^Ta zakładka jest niedostępna w aktualnym trybie\.$/, "This tab is unavailable in the current mode.")
      .replace(/^Aktywny układ: Arkusz1 \(podgląd wydruku\)\.$/, "Active layout: Sheet1 (print preview).")
      .replace(/^Aktywny układ: Model\.$/, "Active layout: Model.")
      .replace(/^Tryb WYMIAR \((.+)\)\.$/, "DIMENSION mode ($1).")
      .replace(/^Zakładka: (.+)\.$/, "Tab: $1.")
      .replace(/^Układ: (Arkusz1|Model)\.$/, (_m, value) => `Layout: ${value === "Arkusz1" ? "Sheet1" : "Model"}.`)
      .replace(/^Siatka: (WŁ\.|WYŁ\.) \(G\)$/, (_m, value) => `Grid: ${value === "WŁ." ? "ON" : "OFF"} (G)`)
      .replace(/^Cofnięto ostatnią operację\.$/, "Undid last operation.")
      .replace(/^Brak operacji do cofnięcia\.$/, "No operation to undo.")
      .replace(/^Przywrócono operacje\.$/, "Restored operations.")
      .replace(/^Brak operacji do ponówienia\.$/, "No operation to redo.")
      .replace(/^Przeniesiono obiekt na wierzch\.$/, "Moved object to front.")
      .replace(/^Nie można przenieść obiektu na wierzch\.$/, "Cannot move object to front.")
      .replace(/^Przeniesiono obiekt na spod\.$/, "Moved object to back.")
      .replace(/^Nie można przenieść obiektu na spod\.$/, "Cannot move object to back.")
      .replace(/^Brak obiektów\. Ustawiono widok domyślny\.$/, "No objects. Default view set.")
      .replace(/^Przeniesiono zaznaczenie do warstwy: (.+)\.$/, "Moved selection to layer: $1.")
      .replace(
        /^Nie przeniesiono obiektów \(brak zaznaczenia lub obiekty są na zablokowanej warstwie\)\.$/,
        "Objects were not moved (no selection or objects are on a locked layer)."
      )
      .replace(/^Wymiar kątowy: ramię 2 nie może być współliniowe z ramieniem 1\.$/, "Angular dimension: arm 2 cannot be collinear with arm 1.")
      .replace(/Nie znaleziono ODA File Converter\./g, "ODA File Converter not found.")
      .replace(/Brak wsparcia ODA w tej wersji aplikacji\./g, "ODA is not supported in this app version.");
  }

  function localizeTextNodes(plToEnMap) {
    if (APP_LANGUAGE !== "en" || !plToEnMap || typeof plToEnMap !== "object") {
      return;
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const raw = String(node.nodeValue || "");
      const normalized = raw.replace(/\s+/g, " ").trim();
      if (normalized && Object.prototype.hasOwnProperty.call(plToEnMap, normalized)) {
        const leading = raw.match(/^\s*/);
        const trailing = raw.match(/\s*$/);
        node.nodeValue = `${leading ? leading[0] : ""}${plToEnMap[normalized]}${trailing ? trailing[0] : ""}`;
      }
      node = walker.nextNode();
    }
  }

  function localizeAttributes(entries) {
    if (APP_LANGUAGE !== "en" || !Array.isArray(entries)) {
      return;
    }
    for (const entry of entries) {
      if (!entry || typeof entry.selector !== "string" || typeof entry.attr !== "string" || typeof entry.value !== "string") {
        continue;
      }
      const element = document.querySelector(entry.selector);
      if (!element) {
        continue;
      }
      element.setAttribute(entry.attr, entry.value);
    }
  }

  async function changeAppLanguage(nextLanguage) {
    const normalized = normalizeAppLanguage(nextLanguage);
    if (!normalized || normalized === APP_LANGUAGE) {
      return;
    }

    APP_LANGUAGE = normalized;
    saveUiLanguage(normalized);

    if (window.desktopApp && typeof window.desktopApp.setAppLanguage === "function") {
      try {
        await window.desktopApp.setAppLanguage({ language: normalized });
      } catch (error) {
        console.warn("Failed to persist app language in desktop shell:", error);
      }
    }

    window.location.reload();
  }

  async function ensureLanguageOnFirstLaunch() {
    const query = new URLSearchParams(window.location.search);
    if (query.has("verify")) {
      APP_LANGUAGE = normalizeAppLanguage(query.get("verifyLanguage")) || "pl";
      saveUiLanguage(APP_LANGUAGE);
      markLanguageOnboardingCompleted();
      return true;
    }
    const storedLanguage = getStoredUiLanguage();
    if (storedLanguage) {
      markLanguageOnboardingCompleted();
      return true;
    }
    if (hasCompletedLanguageOnboarding()) {
      return true;
    }

    const useEnglish = window.confirm(
      "Select app language:\nOK = English\nCancel = Polski"
    );
    const selectedLanguage = useEnglish ? "en" : "pl";
    markLanguageOnboardingCompleted();
    saveUiLanguage(selectedLanguage);

    if (selectedLanguage !== APP_LANGUAGE) {
      await changeAppLanguage(selectedLanguage);
      return false;
    }

    if (window.desktopApp && typeof window.desktopApp.setAppLanguage === "function") {
      try {
        await window.desktopApp.setAppLanguage({ language: selectedLanguage });
      } catch (error) {
        console.warn("Failed to persist language choice in desktop shell:", error);
      }
    }
    return true;
  }

  function localizeStaticUi() {
    document.documentElement.lang = APP_LANGUAGE === "en" ? "en" : "pl";
    if (APP_LANGUAGE !== "en") {
      applyPlatformShortcutLabels();
      return;
    }
    const entries = [
      ["#undoBtn", "Undo (Ctrl+Z)"],
      ["#redoBtn", "Redo (Ctrl+Y)"],
      ["#flyoutLayersBtn", "Layers"],
      ["#flyoutSelectionBtn", "Selection (Alt+Q)"],
      ["#updateAppBtn", "Updates"],
      ["#fileMenuBtn", "Files (Alt+S)"],
      ["#loadJsonBtn", "Load JSON (Ctrl+O)"],
      ["#saveJsonBtn", "Save JSON (Ctrl+S)"],
      ["#importDxfBtn", "Import DXF (Alt+I)"],
      ["#importDwgBtn", "Import DWG (Alt+W)"],
      ["#exportDxfBtn", "Export DXF (Alt+E)"],
      ["#exportDwgBtn", "Export DWG (Alt+R)"],
      ["#exportSvgBtn", "Export SVG (Alt+V)"],
      ["#printDrawingBtn", "Print/PDF (Ctrl+P)"],
      ["#viewPanBtn", "Pan view (H)"],
      ["#viewResetBtn", "Reset view (Shift+0)"],
      ["#activeLayerInfo", "Layer"],
      ["#angleInfo", "Angle: —"],
      [".ribbon-tab[data-page='home']", "Home"],
      [".ribbon-tab[data-page='references']", "Dimensioning"],
      [".ribbon-tab[data-page='design']", "Steel"],
      [".ribbon-tab[data-page='view']", "View"],
      [".ribbon-tab[data-page='layers']", "Layers"],
      [".tool-btn[data-tool='select']", "Select (Z)"],
      [".tool-btn[data-tool='line']", "Line (L)"],
      [".tool-btn[data-tool='polyline']", "Polyline (Y)"],
      [".tool-btn[data-tool='rect']", "Rectangle (P)"],
      [".tool-btn[data-tool='circle']", "Circle (O)"],
      [".tool-btn[data-tool='paint']", "Paint (B)"],
      [".tool-btn[data-tool='measure']", "Measure (M)"],
      [".tool-btn[data-tool='dimension']", "Dimension (D)"],
      [".tool-btn[data-tool='pan']", "Pan view (H)"],
      ["#moveCmdBtn", "Move (Alt+M)"],
      ["#copyCmdBtn", "Copy (Alt+C)"],
      ["#trimCmdBtn", "Trim (Alt+T)"],
      ["#extendCmdBtn", "Extend (Alt+X)"],
      ["#offsetCmdBtn", "Offset (Alt+F)"],
      ["#duplicateBtn", "Duplicate (Ctrl+D)"],
      ["#deleteBtn", "Delete (Delete)"],
      ["#toFrontBtn", "To front (Alt+J)"],
      ["#toBackBtn", "To back (Alt+K)"],
      ["#fitViewBtn", "Fit view (Alt+0)"],
      ["#clearBtn", "Clear (Alt+Delete)"],
      ["#snapToggle", "Snap (F3)"],
      ["#orthoToggle", "Horizontal/Vertical (F8)"],
      ["#showGridToggle", "Grid (G)"],
      ["#selectionInfo", "No object selected"],
      ["#addLayerBtn", "Add (Alt+N)"],
      ["#bottomAddLayerBtn", "+"],
      ["#steelGenerateBtn", "Generate element (Alt+Enter)"]
    ];
    for (const [selector, text] of entries) {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = formatShortcutTextForPlatform(text);
      }
    }
    const titleEntries = [
      ["#undoBtn", "Undo"],
      ["#redoBtn", "Redo"],
      ["#updateAppBtn", "Check and install app updates"],
      ["#licenseCategoryBtn", "License management"]
    ];
    for (const [selector, text] of titleEntries) {
      const element = document.querySelector(selector);
      if (element) {
        element.setAttribute("title", formatShortcutTextForPlatform(text));
      }
    }
    const uiTextMap = {
      Pliki: "Files",
      "Projekt, import/eksport CAD, wydruk i ustawienia aplikacji": "Project, CAD import/export, printing and app settings",
      Projekt: "Project",
      CAD: "CAD",
      Aplikacja: "App",
      Wydruk: "Print",
      Rysuj: "Draw",
      Modyfikuj: "Modify",
      Właściwości: "Properties",
      Warstwy: "Layers",
      Nawigacja: "Navigation",
      "Typ wymiaru": "Dimension type",
      Ustawienia: "Settings",
      "Kąt i snap": "Angle and snap",
      "Konstrukcje stalowe": "Steel structures",
      "Właściwości zaznaczenia": "Selection properties",
      "Brak zaznaczonego obiektu": "No object selected",
      "Tryb wymiaru": "Dimension mode",
      Wyrównany: "Aligned",
      Liniowy: "Linear",
      Obrócony: "Rotated",
      Kątowy: "Angular",
      "Kąt wymiaru [°]": "Dimension angle [deg]",
      "Skok kąta [°]": "Angle snap [deg]",
      Jednostka: "Unit",
      Precyzja: "Precision",
      "Tekst wymiaru": "Dimension text",
      "Kolor wymiaru": "Dimension color",
      "Wyrównany (Alt+1)": "Aligned (Alt+1)",
      "Liniowy (Alt+2)": "Linear (Alt+2)",
      "Obrócony (Alt+3)": "Rotated (Alt+3)",
      "Kątowy (Alt+4)": "Angular (Alt+4)",
      Kolor: "Color",
      Grubość: "Thickness",
      Styl: "Style",
      Ciągła: "Solid",
      Kreskowana: "Dashed",
      Kropkowana: "Dotted",
      Wypełnienie: "Fill",
      "Kolor wyp.": "Fill color",
      Krycie: "Opacity",
      Język: "Language",
      Polski: "Polish",
      "Aktywna": "Active",
      "Warstwa": "Layer",
      "Nowa warstwa": "New layer",
      "Szablon konstrukcji": "Structure template",
      "Opcje bramy": "Gate options",
      "Opcje ogrodzenia": "Fence options",
      "Opcje balkonu": "Balcony options",
      Brama: "Gate",
      Ogrodzenie: "Fence",
      Balkon: "Balcony",
      "Szerokość całkowita [mm]": "Total width [mm]",
      "Wysokość całkowita [mm]": "Total height [mm]",
      "Profil boczny [mm]": "Side profile [mm]",
      "Szerokość słupka [mm]": "Post width [mm]",
      "Długość słupka [mm]": "Post length [mm]",
      "Profil wypełnienia [mm]": "Infill profile [mm]",
      "Ilość paneli [szt./sekcja]": "Panel count [pcs/section]",
      "Typ wypełnienia": "Infill type",
      Pionowe: "Vertical",
      Poziome: "Horizontal",
      Siatka: "Grid",
      "Krzyżowe X": "Cross X",
      "Panel górny": "Top panel",
      "Panel dolny": "Bottom panel",
      Włącz: "Enable",
      "Rozmiar [mm]": "Size [mm]",
      "Ilość pól": "Section count",
      "Prześwit od dołu [mm]": "Bottom clearance [mm]",
      "Skrzydła bramy [szt.]": "Gate leaves [pcs]",
      "Wysokość podmurówki [mm]": "Base plate height [mm]",
      "Rama wewnętrzna": "Inner frame",
      "Zastrzał ukośny": "Diagonal brace",
      "Kontekst: figura": "Context: shape",
      "Prostokąt: szer.": "Rectangle: width",
      "Prostokąt: wys.": "Rectangle: height",
      "Okrąg: promień": "Circle: radius",
      "Aktywacja licencji MadCAD": "MadCAD license reminder",
      Zamknij: "Close",
      "Darmowy klucz licencyjny": "Optional license key",
      "Wsparcie projektu": "Project support",
      "ID urządzenia": "Device ID",
      "Wsparcie projektu - PayPal": "Support project - PayPal",
      "Wklej token licencji": "Paste license token",
      "Aktywuj token": "Activate token",
      "Wyczyść zapis": "Clear saved token",
      "Kopiuj ID urządzenia": "Copy device ID",
      "Otwórz formularz tokenu na GitHub": "Open token form on GitHub",
      "Jeśli MadCAD przyspiesza Twoją codzienną pracę, możesz wesprzeć dalszy rozwój projektu.":
        "If MadCAD speeds up your daily work, you can support further project development.",
      "Link:": "Link:"
    };
    localizeTextNodes(uiTextMap);

    localizeAttributes([
      { selector: "#newLayerNameInput", attr: "placeholder", value: "New layer" }
    ]);
    applyPlatformShortcutLabels();
  }

  const licenseSession = {
    active: false,
    token: "",
    payload: null,
    deviceId: ""
  };

  const licenseRemoteState = {
    lastCheckedAt: 0,
    lastTokenHash: "",
    lastResultOk: null,
    inFlight: null
  };
  const licenseRegistryEndpointsState = {
    lastFetchedAt: 0,
    config: null,
    inFlight: null
  };
  let licenseRemoteRecheckTimer = null;

  const appUpdateState = {
    busy: false,
    installing: false,
    payload: null,
    available: false,
    startupPromptShown: false
  };

  const baseLayerId = createId();
  const state = {
    tool: "select",
    entities: [],
    selectedId: null,
    selectedIds: [],
    view: {
      scale: 1,
      offsetX: 160,
      offsetY: 80
    },
    drawStart: null,
    dimensionSecond: null,
    dimensionThird: null,
    commandState: null,
    offsetDistance: 60,
    previewPoint: null,
    pointerWorld: { x: 0, y: 0 },
    pointerRawWorld: { x: 0, y: 0 },
    panning: false,
    panLast: null,
    dragging: false,
    dragStartScreen: null,
    dragLastWorld: null,
    dragMoved: false,
    selectingBox: false,
    selectionBoxStart: null,
    selectionBoxEnd: null,
    selectionBoxAdditive: false,
    polylineAnchor: null,
    lengthInputBuffer: "",
    spacePan: false,
    snap: true,
    showGrid: true,
    ortho: false,
    gridSize: 10,
    strokeColor: "#d9e7ff",
    lineWidth: 2,
    lineStyle: "solid",
    fillEnabled: false,
    fillColor: "#00a9e0",
    fillAlpha: 20,
    rectConfigWidth: 120,
    rectConfigHeight: 80,
    circleConfigRadius: 60,
    dimensionMode: "aligned",
    dimensionRotation: 0,
    dimensionAngleSnap: 15,
    dimensionUnit: "mm",
    dimensionDecimals: 0,
    dimensionTextSize: 12,
    dimensionColor: "#ffd166",
    steelPreset: "gate",
    steelWidth: 4000,
    steelHeight: 1500,
    steelFrameProfile: 40,
    steelPostWidth: 60,
    steelPostLength: 1700,
    steelBarWidth: 20,
    steelPanelCount: 18,
    steelInfillPattern: "vertical",
    steelTopPanel: true,
    steelTopPanelThickness: 20,
    steelBottomPanel: true,
    steelBottomPanelThickness: 20,
    steelSectionCount: 1,
    steelGateLeafCount: 2,
    steelGroundClearance: 40,
    steelBasePlateHeight: 0,
    steelInnerFrame: false,
    steelDiagonal: false,
    workspaceView: "model",
    workspaceMode: "draw",
    activeFlyout: null,
    layoutTab: "model",
    ribbonPage: "home",
    ribbonCollapsed: false,
    paletteHidden: false,
    paletteWidth: 300,
    splitterDragging: false,
    theme: "dark",
    layers: [
      {
        id: baseLayerId,
        name: `${t("Warstwa", "Layer")} 0`,
        visible: true,
        locked: false
      }
    ],
    activeLayerId: baseLayerId,
    lastMeasure: null,
    clipboard: null,
    historyUndo: [],
    historyRedo: [],
    persistPending: false,
    persistTimer: null,
    autosavePending: false,
    autosaveTimer: null,
    autosaveLastPayload: ""
  };

  const TOOL_LABELS = {
    select: t("Zaznacz", "Select"),
    line: t("Linia", "Line"),
    polyline: t("Polilinia", "Polyline"),
    rect: t("Prostokąt", "Rectangle"),
    circle: t("Okrąg", "Circle"),
    paint: t("Malowanie", "Paint"),
    measure: t("Pomiar", "Measure"),
    dimension: t("Wymiar", "Dimension"),
    pan: t("Pan widoku", "Pan view")
  };

  const TOOL_ICONS = {
    select: "\u25C9",
    line: "\u2500",
    polyline: "\u223F",
    rect: "\u25AD",
    circle: "\u25CB",
    paint: "\uD83C\uDFA8",
    measure: "\uD83D\uDCD0",
    dimension: "\u21A6",
    pan: "\u270B"
  };

  const STEEL_TEMPLATE_PRESETS = {
    gate: {
      width: 4000,
      height: 1500,
      frameProfile: 40,
      postWidth: 60,
      postLength: 1700,
      barWidth: 20,
      panelCount: 18,
      infillPattern: "vertical",
      topPanel: true,
      topPanelThickness: 20,
      bottomPanel: true,
      bottomPanelThickness: 20,
      sectionCount: 1,
      gateLeafCount: 2,
      groundClearance: 40,
      basePlateHeight: 0,
      innerFrame: false,
      diagonal: false
    },
    fence: {
      width: 2500,
      height: 1500,
      frameProfile: 40,
      postWidth: 60,
      postLength: 1700,
      barWidth: 18,
      panelCount: 17,
      infillPattern: "horizontal",
      topPanel: true,
      topPanelThickness: 18,
      bottomPanel: true,
      bottomPanelThickness: 18,
      sectionCount: 1,
      gateLeafCount: 1,
      groundClearance: 60,
      basePlateHeight: 250,
      innerFrame: false,
      diagonal: false
    },
    balcony: {
      width: 3000,
      height: 1100,
      frameProfile: 40,
      postWidth: 50,
      postLength: 1200,
      barWidth: 16,
      panelCount: 10,
      infillPattern: "horizontal",
      topPanel: true,
      topPanelThickness: 16,
      bottomPanel: true,
      bottomPanelThickness: 16,
      sectionCount: 2,
      gateLeafCount: 1,
      groundClearance: 0,
      basePlateHeight: 0,
      innerFrame: false,
      diagonal: false
    }
  };

  const STEEL_TEMPLATE_META = {
    gate: {
      hint: t(
        "Brama: skrzydło pojedyncze lub dwuskrzydłowe z opcjonalnym zastrzałem ukośnym.",
        "Gate: single or double leaf with an optional diagonal brace."
      ),
      badges: [t("Wjazd", "Entry"), t("Skrzydła 1/2", "Leaves 1/2"), t("Ukos opcjonalny", "Optional diagonal")]
    },
    fence: {
      hint: t("Ogrodzenie: przęsło z podmurówką, bez zastrzału ukośnego.", "Fence: section with base plate, no diagonal brace."),
      badges: [t("Przęsło", "Section"), t("Podmurówka", "Base plate"), t("Sztachety", "Pickets")]
    },
    balcony: {
      hint: t("Balkon: balustrada z automatycznymi słupkami i wypełnieniem.", "Balcony: railing with automatic posts and infill."),
      badges: [t("Balustrada", "Railing"), t("Słupki auto", "Auto posts"), t("Bez ukosu", "No diagonal")]
    }
  };

  let renderQueued = false;
  let toastHideTimer = null;
  let canvasResizeRetryFrame = 0;
  let layoutResizeObserver = null;
  let lastCanvasClientWidth = 0;
  let lastCanvasClientHeight = 0;
  const POINTER_DRAG_THRESHOLD_PX = 8;
  const OBJECT_SNAP_THRESHOLD_PX = 18;
  const EDGE_SNAP_THRESHOLD_PX = 28;
  const MIN_DRAW_LENGTH = 0.0001;

  const detectedMac =
    (window.desktopApp && window.desktopApp.platform === "darwin") ||
    /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform || "") ||
    /Mac OS X/i.test(navigator.userAgent || "");
  const detectedWindows =
    (window.desktopApp && window.desktopApp.platform === "win32") ||
    /Win/i.test(navigator.platform || "") ||
    /Windows/i.test(navigator.userAgent || "");

  if (detectedMac) {
    document.documentElement.classList.add("platform-mac");
    document.documentElement.style.setProperty("--traffic-space", "76px");
    document.documentElement.style.setProperty("--window-controls-space", "0px");
  } else if (detectedWindows) {
    document.documentElement.classList.add("platform-win");
    document.documentElement.style.setProperty("--traffic-space", "0px");
    document.documentElement.style.setProperty("--window-controls-space", "136px");
  } else {
    document.documentElement.style.setProperty("--traffic-space", "0px");
    document.documentElement.style.setProperty("--window-controls-space", "0px");
  }

  function queueRender() {
    if (renderQueued) {
      return;
    }
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function markDirty() {
    state.persistPending = true;
    state.autosavePending = true;
    if (state.persistTimer) {
      clearTimeout(state.persistTimer);
    }
    state.persistTimer = setTimeout(persistSession, 500);
    scheduleAutoSave();
  }

  function scheduleAutoSave() {
    if (!window.desktopApp || typeof window.desktopApp.autosaveWrite !== "function") {
      return;
    }
    if (state.autosaveTimer) {
      clearTimeout(state.autosaveTimer);
    }
    state.autosaveTimer = setTimeout(() => {
      state.autosaveTimer = null;
      void flushAutoSave();
    }, 1800);
  }

  async function flushAutoSave(options = {}) {
    const force = Boolean(options && options.force);
    if (!window.desktopApp) {
      return false;
    }
    const canWrite = typeof window.desktopApp.autosaveWrite === "function";
    if (!canWrite) {
      return false;
    }
    if (!force && !state.autosavePending) {
      return false;
    }
    state.autosavePending = false;

    const hasEntities = Array.isArray(state.entities) && state.entities.length > 0;
    if (!hasEntities) {
      if (typeof window.desktopApp.autosaveClear === "function") {
        await window.desktopApp.autosaveClear().catch(() => {});
      }
      state.autosaveLastPayload = "";
      return true;
    }

    let runtimeRaw = "";
    try {
      runtimeRaw = localStorage.getItem("cad-session-v2") || "";
    } catch (_error) {
      runtimeRaw = "";
    }
    if (!runtimeRaw) {
      runtimeRaw = JSON.stringify(
        {
          version: 2,
          entities: state.entities,
          layers: state.layers,
          activeLayerId: state.activeLayerId
        },
        null,
        2
      );
    }
    if (!runtimeRaw) {
      return false;
    }
    if (!force && runtimeRaw === state.autosaveLastPayload) {
      return true;
    }

    const result = await window.desktopApp.autosaveWrite({ text: runtimeRaw });
    if (result && result.ok) {
      state.autosaveLastPayload = runtimeRaw;
      return true;
    }
    return false;
  }

  function persistSession() {
    if (!state.persistPending) {
      return;
    }
    state.persistPending = false;
    const payload = {
      version: 2,
      entities: state.entities,
      layers: state.layers,
      activeLayerId: state.activeLayerId,
      settings: {
        snap: state.snap,
        showGrid: state.showGrid,
        ortho: state.ortho,
        gridSize: state.gridSize,
        strokeColor: state.strokeColor,
        lineWidth: state.lineWidth,
        lineStyle: state.lineStyle,
        fillEnabled: state.fillEnabled,
        fillColor: state.fillColor,
        fillAlpha: state.fillAlpha,
        rectConfigWidth: state.rectConfigWidth,
        rectConfigHeight: state.rectConfigHeight,
        circleConfigRadius: state.circleConfigRadius,
        dimensionMode: state.dimensionMode,
        dimensionRotation: state.dimensionRotation,
        dimensionAngleSnap: state.dimensionAngleSnap,
        dimensionUnit: state.dimensionUnit,
        dimensionDecimals: state.dimensionDecimals,
        dimensionTextSize: state.dimensionTextSize,
        dimensionColor: state.dimensionColor,
        offsetDistance: state.offsetDistance,
        steelPreset: state.steelPreset,
        steelWidth: state.steelWidth,
        steelHeight: state.steelHeight,
        steelFrameProfile: state.steelFrameProfile,
        steelPostWidth: state.steelPostWidth,
        steelPostLength: state.steelPostLength,
        steelBarWidth: state.steelBarWidth,
        steelPanelCount: state.steelPanelCount,
        steelInfillPattern: state.steelInfillPattern,
        steelTopPanel: state.steelTopPanel,
        steelTopPanelThickness: state.steelTopPanelThickness,
        steelBottomPanel: state.steelBottomPanel,
        steelBottomPanelThickness: state.steelBottomPanelThickness,
        steelSectionCount: state.steelSectionCount,
        steelGateLeafCount: state.steelGateLeafCount,
        steelGroundClearance: state.steelGroundClearance,
        steelBasePlateHeight: state.steelBasePlateHeight,
        steelInnerFrame: state.steelInnerFrame,
        steelDiagonal: state.steelDiagonal,
        workspaceView: state.workspaceView,
        workspaceMode: state.workspaceMode,
        layoutTab: state.layoutTab,
        ribbonPage: state.ribbonPage,
        ribbonCollapsed: state.ribbonCollapsed,
        paletteHidden: state.paletteHidden,
        paletteWidth: state.paletteWidth,
        activeFlyout: state.activeFlyout,
        theme: state.theme
      },
      view: state.view
    };

    try {
      localStorage.setItem("cad-session-v2", JSON.stringify(payload));
    } catch (error) {
      console.warn("Nie udało się zapisać sesji:", error);
    }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem("cad-session-v2");
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return;
      }
      state.layers = normalizeLayers(parsed.layers);
      state.activeLayerId = parsed.activeLayerId;
      ensureActiveLayer();
      state.entities = normalizeEntities(parsed.entities);
      ensureEntityLayers();
      state.workspaceView = "model";
      state.workspaceMode = "draw";
      state.ribbonPage = "home";

      if (parsed.settings && typeof parsed.settings === "object") {
        state.snap = Boolean(parsed.settings.snap);
        state.showGrid = parsed.settings.showGrid !== false;
        state.ortho = Boolean(parsed.settings.ortho);
        state.gridSize = Math.max(1, Number(parsed.settings.gridSize) || 10);
        state.strokeColor = parsed.settings.strokeColor || state.strokeColor;
        state.lineWidth = Math.max(1, Number(parsed.settings.lineWidth) || state.lineWidth);
        state.lineStyle = normalizeLineStyle(parsed.settings.lineStyle || state.lineStyle);
        state.fillEnabled = Boolean(parsed.settings.fillEnabled);
        state.fillColor = parsed.settings.fillColor || state.fillColor;
        state.fillAlpha = clamp(Number(parsed.settings.fillAlpha), 0, 100, state.fillAlpha);
        state.rectConfigWidth = Math.max(1, Number(parsed.settings.rectConfigWidth) || state.rectConfigWidth);
        state.rectConfigHeight = Math.max(1, Number(parsed.settings.rectConfigHeight) || state.rectConfigHeight);
        state.circleConfigRadius = Math.max(1, Number(parsed.settings.circleConfigRadius) || state.circleConfigRadius);
        state.dimensionMode = normalizeDimensionMode(parsed.settings.dimensionMode);
        state.dimensionRotation = normalizeAngleDegrees(parsed.settings.dimensionRotation);
        state.dimensionAngleSnap = clamp(
          Math.round(Number(parsed.settings.dimensionAngleSnap)),
          0,
          90,
          state.dimensionAngleSnap
        );
        state.dimensionUnit =
          parsed.settings.dimensionUnit === "cm" || parsed.settings.dimensionUnit === "m"
            ? parsed.settings.dimensionUnit
            : "mm";
        state.dimensionDecimals = clamp(
          Math.round(Number(parsed.settings.dimensionDecimals)),
          0,
          4,
          state.dimensionDecimals
        );
        state.dimensionTextSize = clamp(
          Number(parsed.settings.dimensionTextSize),
          8,
          48,
          state.dimensionTextSize
        );
        if (typeof parsed.settings.dimensionColor === "string" && /^#[0-9a-fA-F]{6}$/.test(parsed.settings.dimensionColor)) {
          state.dimensionColor = parsed.settings.dimensionColor.toLowerCase();
        }
        state.offsetDistance = Math.max(1, Number(parsed.settings.offsetDistance) || state.offsetDistance);
        state.steelPreset =
          parsed.settings.steelPreset === "fence" || parsed.settings.steelPreset === "balcony"
            ? parsed.settings.steelPreset
            : "gate";
        state.steelWidth = Math.max(200, Number(parsed.settings.steelWidth) || state.steelWidth);
        state.steelHeight = Math.max(200, Number(parsed.settings.steelHeight) || state.steelHeight);
        state.steelFrameProfile = Math.max(
          20,
          Number(parsed.settings.steelFrameProfile) || state.steelFrameProfile
        );
        state.steelPostWidth = Math.max(20, Number(parsed.settings.steelPostWidth) || state.steelPostWidth);
        state.steelPostLength = Math.max(200, Number(parsed.settings.steelPostLength) || state.steelPostLength);
        state.steelBarWidth = Math.max(5, Number(parsed.settings.steelBarWidth) || state.steelBarWidth);
        const parsedPanelCount = Number(parsed.settings.steelPanelCount);
        const legacySpacing = Number(parsed.settings.steelBarSpacing);
        state.steelInfillPattern =
          normalizeInfillPattern(parsed.settings.steelInfillPattern) || state.steelInfillPattern;
        state.steelTopPanel =
          parsed.settings.steelTopPanel === undefined ? state.steelTopPanel : parsed.settings.steelTopPanel !== false;
        state.steelTopPanelThickness = Math.max(
          2,
          Number(parsed.settings.steelTopPanelThickness) || state.steelTopPanelThickness
        );
        state.steelBottomPanel =
          parsed.settings.steelBottomPanel === undefined
            ? state.steelBottomPanel
            : parsed.settings.steelBottomPanel !== false;
        state.steelBottomPanelThickness = Math.max(
          2,
          Number(parsed.settings.steelBottomPanelThickness) || state.steelBottomPanelThickness
        );
        state.steelSectionCount = Math.max(
          1,
          Math.min(6, Math.round(Number(parsed.settings.steelSectionCount) || state.steelSectionCount))
        );
        state.steelGateLeafCount = Math.max(
          1,
          Math.min(2, Math.round(Number(parsed.settings.steelGateLeafCount) || state.steelGateLeafCount))
        );
        const parsedGroundClearance = Number(parsed.settings.steelGroundClearance);
        state.steelGroundClearance = Math.max(
          0,
          Number.isFinite(parsedGroundClearance) ? parsedGroundClearance : state.steelGroundClearance
        );
        const parsedBasePlate = Number(parsed.settings.steelBasePlateHeight);
        state.steelBasePlateHeight = Math.max(
          0,
          Number.isFinite(parsedBasePlate) ? parsedBasePlate : state.steelBasePlateHeight
        );
        state.steelInnerFrame = Boolean(parsed.settings.steelInnerFrame);
        state.steelDiagonal = parsed.settings.steelDiagonal !== false;
        const looksLikeLegacyGateDefaults =
          state.steelPreset === "gate" &&
          state.steelInfillPattern === "horizontal" &&
          state.steelSectionCount === 2 &&
          state.steelDiagonal === true &&
          (!Array.isArray(parsed.entities) || parsed.entities.length === 0);
        if (looksLikeLegacyGateDefaults) {
          state.steelSectionCount = 1;
          state.steelDiagonal = false;
        }
        const looksLikeOldGateInfillDefault =
          state.steelPreset === "gate" &&
          state.steelInfillPattern === "horizontal" &&
          (!Array.isArray(parsed.entities) || parsed.entities.length === 0);
        if (looksLikeOldGateInfillDefault) {
          state.steelInfillPattern = "vertical";
        }
        if (Number.isFinite(parsedPanelCount)) {
          state.steelPanelCount = clamp(Math.round(parsedPanelCount), 1, 120, state.steelPanelCount);
        } else {
          const inferred = inferPanelCountFromLegacySpacing(legacySpacing, {
            template: state.steelPreset,
            infillPattern: state.steelInfillPattern,
            width: state.steelWidth,
            height: state.steelHeight,
            frameProfile: state.steelFrameProfile,
            postWidth: state.steelPostWidth,
            barWidth: state.steelBarWidth,
            sectionCount: state.steelSectionCount,
            gateLeafCount: state.steelGateLeafCount,
            groundClearance: state.steelGroundClearance,
            basePlateHeight: state.steelBasePlateHeight,
            innerFrame: state.steelInnerFrame,
            topPanel: state.steelTopPanel,
            topPanelThickness: state.steelTopPanelThickness,
            bottomPanel: state.steelBottomPanel,
            bottomPanelThickness: state.steelBottomPanelThickness
          });
          state.steelPanelCount = clamp(Math.round(inferred), 1, 120, state.steelPanelCount);
        }
        if (parsed.settings.workspaceView === "start" || parsed.settings.workspaceView === "model") {
          state.workspaceView = normalizeWorkspaceView(parsed.settings.workspaceView);
        }
        if (parsed.settings.workspaceMode === "draw" || parsed.settings.workspaceMode === "steel") {
          state.workspaceMode = parsed.settings.workspaceMode;
        }
        if (parsed.settings.layoutTab === "model" || parsed.settings.layoutTab === "sheet1") {
          state.layoutTab = parsed.settings.layoutTab;
        }
        state.ribbonPage = normalizeRibbonPage(parsed.settings.ribbonPage);
        state.ribbonCollapsed = parsed.settings.ribbonCollapsed === true;
        state.paletteHidden = Boolean(parsed.settings.paletteHidden);
        state.paletteWidth = Math.max(255, Number(parsed.settings.paletteWidth) || state.paletteWidth);
        const parsedFlyout = String(parsed.settings.activeFlyout || "")
          .trim()
          .toLowerCase();
        if (["layers", "steel", "selection"].includes(parsedFlyout)) {
          state.activeFlyout = parsedFlyout;
        }
        applyTheme("dark");
      }

      if (parsed.view && typeof parsed.view === "object") {
        state.view.scale = clamp(Number(parsed.view.scale), 0.1, 10, state.view.scale);
        state.view.offsetX = Number(parsed.view.offsetX) || state.view.offsetX;
        state.view.offsetY = Number(parsed.view.offsetY) || state.view.offsetY;
      }
    } catch (error) {
      console.warn("Nie udało się odtworzyć sesji:", error);
    }
  }

  async function restoreDesktopAutoSaveIfNeeded() {
    const hasGeometry = Array.isArray(state.entities) && state.entities.length > 0;
    if (hasGeometry) {
      return false;
    }
    if (!window.desktopApp || typeof window.desktopApp.autosaveRead !== "function") {
      return false;
    }
    const result = await window.desktopApp.autosaveRead();
    if (!result || result.ok !== true || result.exists !== true || typeof result.text !== "string") {
      return false;
    }

    try {
      const parsed = JSON.parse(result.text);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entities)) {
        throw new Error("Niepoprawny format autozapisu.");
      }
      localStorage.setItem("cad-session-v2", JSON.stringify(parsed));
      restoreSession();
      state.autosaveLastPayload = JSON.stringify(parsed);
      echoCommand(result.warning || "Przywrócono autozapis po awaryjnym zamknięciu.");
      return true;
    } catch (error) {
      console.warn("Nie udało się przywrócić autozapisu:", error);
      if (typeof window.desktopApp.autosaveClear === "function") {
        await window.desktopApp.autosaveClear().catch(() => {});
      }
      return false;
    }
  }

  function cssColor(variableName, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    return value || fallback;
  }

  function applyTheme(theme) {
    const resolvedTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    state.theme = resolvedTheme;
    queueRender();
    markDirty();
  }

  function syncLayoutChrome() {
    if (!appRoot) {
      return;
    }
    appRoot.classList.toggle("ribbon-collapsed", state.ribbonCollapsed);
    appRoot.classList.toggle("palette-hidden", state.paletteHidden);
    appRoot.classList.toggle("splitter-dragging", state.splitterDragging);
    appRoot.style.setProperty("--palette-width", `${state.paletteWidth}px`);

    if (state.paletteHidden || state.ribbonCollapsed) {
      state.activeFlyout = null;
      setFileMenuOpen(false);
    }
    syncPaletteFlyouts();
    updateToastAnchor();
  }

  function isFileMenuOpen() {
    return Boolean(fileMenu && fileMenu.classList.contains("open"));
  }

  function positionFileMenuPanel() {
    if (!fileMenuBtn || !fileMenuPanel || fileMenuPanel.hidden) {
      return;
    }
    const buttonRect = fileMenuBtn.getBoundingClientRect();
    const margin = 6;
    const panelWidth = Math.max(196, fileMenuPanel.offsetWidth || 0);
    const panelHeight = Math.max(120, fileMenuPanel.offsetHeight || 0);

    let left = buttonRect.right - panelWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

    let top = buttonRect.bottom + 4;
    if (top + panelHeight > window.innerHeight - margin) {
      const aboveTop = buttonRect.top - panelHeight - 4;
      if (aboveTop >= margin) {
        top = aboveTop;
      } else {
        top = Math.max(margin, window.innerHeight - panelHeight - margin);
      }
    }

    fileMenuPanel.style.left = `${Math.round(left)}px`;
    fileMenuPanel.style.top = `${Math.round(top)}px`;
    fileMenuPanel.style.maxHeight = `${Math.max(200, window.innerHeight - 110)}px`;
  }

  function setFileMenuOpen(value) {
    const open = Boolean(value);
    if (!fileMenu || !fileMenuBtn || !fileMenuPanel) {
      return;
    }
    fileMenu.classList.toggle("open", open);
    fileMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    fileMenuPanel.hidden = !open;
    if (open) {
      requestAnimationFrame(positionFileMenuPanel);
    } else {
      fileMenuPanel.style.left = "";
      fileMenuPanel.style.top = "";
      fileMenuPanel.style.maxHeight = "";
    }
  }

  function setUpdateButtonUi(mode, payload) {
    if (!updateAppBtn) {
      return;
    }
    const t = (pl, en) => (APP_LANGUAGE === "en" ? en : pl);
    const normalizedMode = String(mode || "idle").toLowerCase();
    updateAppBtn.classList.remove("update-available", "update-busy");
    updateAppBtn.disabled = false;

    if (normalizedMode === "checking") {
      updateAppBtn.classList.add("update-busy");
      updateAppBtn.disabled = true;
      updateAppBtn.textContent = t("Sprawdzam...", "Checking...");
      updateAppBtn.title = t("Trwa sprawdzanie najnowszej wersji.", "Checking latest release.");
      return;
    }

    if (normalizedMode === "installing") {
      updateAppBtn.classList.add("update-busy");
      updateAppBtn.disabled = true;
      updateAppBtn.textContent = t("Instaluję...", "Installing...");
      updateAppBtn.title = t("Trwa pobieranie i instalacja aktualizacji.", "Downloading and installing update.");
      return;
    }

    if (normalizedMode === "available") {
      const versionText =
        payload && payload.latestVersion ? `v${String(payload.latestVersion).trim()}` : t("nowa", "new");
      updateAppBtn.classList.add("update-available");
      updateAppBtn.textContent = t(`Aktualizuj ${versionText}`, `Update ${versionText}`);
      updateAppBtn.title = t(
        "Dostępna nowa wersja. Kliknij, aby pobrać i zainstalować.",
        "New version available. Click to download and install."
      );
      return;
    }

    if (normalizedMode === "current") {
      const versionText =
        payload && payload.currentVersion ? `v${String(payload.currentVersion).trim()}` : "";
      updateAppBtn.textContent = versionText ? t(`Aktualne ${versionText}`, `Up to date ${versionText}`) : t("Aktualne", "Up to date");
      updateAppBtn.title = t("Masz najnowszą wersję aplikacji.", "You have the latest app version.");
      return;
    }

    if (normalizedMode === "unsupported") {
      updateAppBtn.textContent = t("Aktualizacje: ręcznie", "Updates: manual");
      updateAppBtn.title = t(
        "Automatyczna aktualizacja nie jest dostępna w tym trybie.",
        "Automatic update is not available in this mode."
      );
      return;
    }

    if (normalizedMode === "offline") {
      updateAppBtn.textContent = t("Aktualizacje: offline", "Updates: offline");
      updateAppBtn.title = t(
        "Brak połączenia z internetem lub GitHub. Sprawdź połączenie i spróbuj ponownie.",
        "No internet or GitHub connection. Check connection and try again."
      );
      return;
    }

    updateAppBtn.textContent = t("Aktualizacje", "Updates");
    updateAppBtn.title = t("Sprawdza i instaluje aktualizacje aplikacji.", "Checks and installs app updates.");
  }

  async function checkForAppUpdates(options) {
    const silent = Boolean(options && options.silent);
    if (!updateAppBtn) {
      return null;
    }
    if (
      !window.desktopApp ||
      typeof window.desktopApp.checkForUpdates !== "function" ||
      typeof window.desktopApp.downloadAndInstallUpdate !== "function"
    ) {
      setUpdateButtonUi("unsupported");
      return null;
    }
    if (appUpdateState.busy || appUpdateState.installing) {
      return appUpdateState.payload;
    }

    appUpdateState.busy = true;
    setUpdateButtonUi("checking");
    let result = null;
    try {
      result = await window.desktopApp.checkForUpdates();
    } catch (error) {
      result = {
        ok: false,
        error: error && error.message ? String(error.message) : "Błąd sprawdzania aktualizacji."
      };
    }
    appUpdateState.busy = false;

    if (!result || result.ok !== true) {
      appUpdateState.payload = null;
      appUpdateState.available = false;
      const isOffline = Boolean(
        result && (String(result.code || "").toUpperCase() === "NETWORK" || String(result.code || "").toUpperCase() === "ENOTFOUND")
      );
      setUpdateButtonUi(silent ? "idle" : isOffline ? "offline" : "idle");
      if (!silent) {
        echoCommand(
          isOffline
            ? "Aktualizacje chwilowo niedostępne (brak połączenia z serwerem)."
            : `Nie udało się sprawdzić aktualizacji${result && result.error ? `: ${result.error}` : "."}`,
          true,
          { toast: false }
        );
      }
      return null;
    }

    appUpdateState.payload = result;
    appUpdateState.available = Boolean(result.available);
    if (result.available) {
      setUpdateButtonUi("available", result);
      if (!silent) {
        echoCommand(
          `Dostępna aktualizacja v${result.latestVersion || "?"}. Kliknij przycisk Aktualizacje, aby zainstalować.`
        );
      }
      return result;
    }

    if (result.supported === false) {
      setUpdateButtonUi("unsupported");
      if (!silent && result.error) {
        echoCommand(result.error, true, { toast: false });
      }
      return result;
    }

    setUpdateButtonUi("current", result);
    if (!silent) {
      echoCommand(`MadCAD jest aktualny (v${result.currentVersion || "?"}).`);
    }
    return result;
  }

  async function installAvailableUpdate(payload) {
    if (
      !window.desktopApp ||
      typeof window.desktopApp.downloadAndInstallUpdate !== "function"
    ) {
      echoCommand("Automatyczny aktualizator nie jest dostępny w tej wersji.", true);
      return null;
    }
    if (appUpdateState.busy || appUpdateState.installing) {
      return null;
    }
    const source =
      payload && typeof payload === "object"
        ? payload
        : appUpdateState.payload && typeof appUpdateState.payload === "object"
          ? appUpdateState.payload
          : null;
    if (!source || !source.available) {
      return checkForAppUpdates({ silent: false });
    }

    appUpdateState.busy = true;
    appUpdateState.installing = true;
    setUpdateButtonUi("installing");
    echoCommand("Pobieranie aktualizacji. Po chwili aplikacja uruchomi instalator.");

    let result = null;
    try {
      result = await window.desktopApp.downloadAndInstallUpdate({
        downloadUrl: source.downloadUrl || "",
        assetName: source.assetName || "",
        latestVersion: source.latestVersion || ""
      });
    } catch (error) {
      result = {
        ok: false,
        installing: false,
        error: error && error.message ? String(error.message) : "Błąd aktualizacji."
      };
    }

    if (result && result.ok && result.installing) {
      echoCommand("Aktualizacja uruchomiona. Aplikacja zamknie się i zainstaluje nową wersję.");
      return result;
    }

    appUpdateState.busy = false;
    appUpdateState.installing = false;

    if (result && result.ok && result.upToDate) {
      appUpdateState.available = false;
      appUpdateState.payload = {
        ...source,
        available: false,
        currentVersion: result.currentVersion || source.currentVersion,
        latestVersion: result.latestVersion || source.latestVersion
      };
      setUpdateButtonUi("current", appUpdateState.payload);
      echoCommand("Masz już najnowszą wersję programu.");
      return result;
    }

    setUpdateButtonUi(appUpdateState.available ? "available" : "idle", appUpdateState.payload);
    echoCommand(
      `Nie udało się zainstalować aktualizacji${result && result.error ? `: ${result.error}` : "."}`,
      true,
      { toast: false }
    );
    return result;
  }

  async function promptForStartupUpdateIfNeeded(updateResult) {
    if (appUpdateState.startupPromptShown) {
      return;
    }
    appUpdateState.startupPromptShown = true;
    if (!updateResult || updateResult.ok !== true || !updateResult.available) {
      return;
    }

    const t = (pl, en) => (APP_LANGUAGE === "en" ? en : pl);
    const versionText = updateResult.latestVersion ? `v${String(updateResult.latestVersion).trim()}` : t("nowsza wersja", "newer version");
    const ask = window.confirm(
      t(
        `Dostępna jest aktualizacja ${versionText}.\n\nCzy chcesz zainstalować ją teraz?`,
        `Update ${versionText} is available.\n\nDo you want to install it now?`
      )
    );

    if (ask) {
      await installAvailableUpdate(updateResult);
      return;
    }

    echoCommand(
      t(
        `Aktualizacja ${versionText} jest dostępna. Możesz uruchomić ją później przyciskiem Aktualizacje.`,
        `Update ${versionText} is available. You can install it later using the Updates button.`
      ),
      false,
      { toast: false }
    );
  }

  function updateToastAnchor() {
    if (!toastMessage) {
      return;
    }
    const fallbackToastTop = 108;
    const fallbackDockTop = 92;
    let toastTop = fallbackToastTop;
    let dockTop = fallbackDockTop;
    if (cadHeader) {
      const headerRect = cadHeader.getBoundingClientRect();
      toastTop = Math.ceil(headerRect.bottom + 8);
      dockTop = Math.ceil(headerRect.bottom + 1);
    }
    document.documentElement.style.setProperty("--toast-top", `${Math.max(56, toastTop)}px`);
    document.documentElement.style.setProperty("--dock-top", `${Math.max(52, dockTop)}px`);
  }

  function normalizeWorkspaceView(_view) {
    return "model";
  }

  function normalizeWorkspaceMode(mode) {
    return mode === "steel" ? "steel" : "draw";
  }

  function normalizeLayoutTab(tab) {
    const value = String(tab || "")
      .trim()
      .toLowerCase();
    if (["sheet1", "arkusz1", "sheet", "paperspace"].includes(value)) {
      return "sheet1";
    }
    return "model";
  }

  function normalizeRibbonPage(page) {
    const value = String(page || "")
      .trim()
      .toLowerCase();
    if (["start", "poczatek", "początek", "startowa", "startowy"].includes(value)) {
      return "home";
    }
    if (["home", "główne", "glowne"].includes(value)) {
      return "home";
    }
    if (["design", "projekt", "stal", "steel"].includes(value)) {
      return "design";
    }
    if (["references", "reference", "annotate", "adnotacje", "adnotacja", "wymiarowanie", "wymiary"].includes(value)) {
      return "references";
    }
    if (["view", "widok"].includes(value)) {
      return "view";
    }
    if (["layers", "layer", "warstwy", "warstwa", "manage", "zarzadzaj", "zarządzaj"].includes(value)) {
      return "layers";
    }
    return "home";
  }

  function getAvailableRibbonPages() {
    return ["home", "references", "design", "view", "layers"];
  }

  function ribbonPageLabel(page) {
    const normalized = normalizeRibbonPage(page);
    if (normalized === "references") {
      return t("Wymiarowanie", "Dimensioning");
    }
    if (normalized === "design") {
      return t("Stal", "Steel");
    }
    if (normalized === "view") {
      return t("Widok", "View");
    }
    if (normalized === "layers") {
      return t("Warstwy", "Layers");
    }
    return t("Główne", "Home");
  }

  function syncStartSummary() {
    if (!startScreen) {
      return;
    }
    if (startEntitiesCount) {
      startEntitiesCount.textContent = String(state.entities.length);
    }
    if (startLayersCount) {
      startLayersCount.textContent = String(state.layers.length);
    }
    if (startToolName) {
      startToolName.textContent = TOOL_LABELS[state.tool] || state.tool;
    }
    if (startScaleValue) {
      startScaleValue.textContent = `${(state.view.scale * 100).toFixed(0)}%`;
    }
  }

  function syncLayoutTabs() {
    const normalized = normalizeLayoutTab(state.layoutTab);
    state.layoutTab = normalized;
    if (appRoot) {
      appRoot.classList.toggle("layout-sheet", normalized === "sheet1");
    }
  }

  function syncRibbonPage() {
    const availablePages = getAvailableRibbonPages();
    let page = normalizeRibbonPage(state.ribbonPage);
    if (!availablePages.includes(page)) {
      page = availablePages[0] || "home";
    }
    state.ribbonPage = page;
    if (appRoot) {
      appRoot.dataset.ribbonPage = page;
    }

    ribbonTabs.forEach((tab) => {
      const tabPage = normalizeRibbonPage(tab.dataset.page);
      const disabled = !availablePages.includes(tabPage);
      tab.classList.toggle("tab-disabled", disabled);
      tab.toggleAttribute("disabled", disabled);
      tab.setAttribute("aria-disabled", disabled ? "true" : "false");
      tab.classList.toggle("active", tabPage === page);
    });

    if (ribbonGroups.length === 0) {
      return;
    }

    const activeMode = normalizeWorkspaceMode(state.workspaceMode);
    ribbonGroups.forEach((group) => {
      const pages = String(group.dataset.pages || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const modes = String(group.dataset.modes || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const pageMatch = pages.length === 0 || pages.includes("all") || pages.includes(page);
      const modeMatch = modes.length === 0 || modes.includes("all") || modes.includes(activeMode);
      const shouldShow = pageMatch && modeMatch;
      group.classList.toggle("ribbon-group-hidden", !shouldShow);
    });

    ribbonPageActions.forEach((button) => {
      const pages = String(button.dataset.pages || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const shouldShow = pages.length === 0 || pages.includes("all") || pages.includes(page);
      button.classList.toggle("ribbon-group-hidden", !shouldShow);
      button.toggleAttribute("hidden", !shouldShow);
    });

    syncPaletteFlyouts();
  }

  function setActiveFlyout(name, options) {
    const value = name ? String(name).trim().toLowerCase() : null;
    state.activeFlyout = value;
    syncPaletteFlyouts();
    resizeCanvas();
    queueRender();
    if (!options || options.persist !== false) {
      markDirty();
    }
  }

  function syncPaletteFlyouts() {
    let active = state.activeFlyout;
    const hidden = state.paletteHidden;
    const ribbonCollapsed = state.ribbonCollapsed;

    const activeFlyoutKnown = paletteFlyouts.some((flyout) => {
      const flyoutName = String(flyout.dataset.flyout || "").trim().toLowerCase();
      return flyoutName === active;
    });

    if (!activeFlyoutKnown) {
      state.activeFlyout = null;
      active = null;
    }

    const activeFlyoutVisible = paletteFlyouts.some((flyout) => {
      const flyoutName = String(flyout.dataset.flyout || "").trim().toLowerCase();
      return flyoutName === active && !flyout.classList.contains("ribbon-group-hidden");
    });

    if (hidden || ribbonCollapsed || !activeFlyoutVisible) {
      active = null;
    }

    if (appRoot) {
      appRoot.classList.remove("steel-dock-open");
    }

    paletteFlyouts.forEach((flyout) => {
      const flyoutName = String(flyout.dataset.flyout || "").trim().toLowerCase();
      const unavailable = flyout.classList.contains("ribbon-group-hidden");
      const shouldShow = !hidden && !ribbonCollapsed && active && flyoutName === active && !unavailable;
      flyout.classList.toggle("flyout-visible", shouldShow);
    });

    paletteLaunchButtons.forEach((button) => {
      const target = String(button.dataset.flyoutTarget || "").trim().toLowerCase();
      const flyout = paletteFlyouts.find(
        (entry) => String(entry.dataset.flyout || "").trim().toLowerCase() === target
      );
      const unavailable = !flyout || flyout.classList.contains("ribbon-group-hidden");
      button.disabled = ribbonCollapsed || unavailable;
      button.classList.toggle("active", Boolean(active && active === target && !button.disabled));
    });
  }

  function syncWorkspaceView() {
    const normalized = normalizeWorkspaceView(state.workspaceView);
    const mode = normalizeWorkspaceMode(state.workspaceMode);
    state.workspaceView = normalized;
    state.workspaceMode = mode;
    const startOpen = normalized === "start";
    if (appRoot) {
      appRoot.classList.toggle("workspace-start", startOpen);
      appRoot.classList.toggle("workspace-model", !startOpen);
      appRoot.classList.toggle("workspace-mode-draw", !startOpen && mode === "draw");
      appRoot.classList.toggle("workspace-mode-steel", !startOpen && mode === "steel");
    }
    if (canvasWrap) {
      canvasWrap.classList.toggle("start-open", startOpen);
    }
    if (startScreen) {
      startScreen.setAttribute("aria-hidden", startOpen ? "false" : "true");
    }
    if (startOpen && state.layoutTab !== "model") {
      state.layoutTab = "model";
    }
    if (startOpen && state.activeFlyout) {
      state.activeFlyout = null;
    }
    syncLayoutTabs();
    syncStartSummary();
  }

  function setWorkspaceView(view, options) {
    const normalized = normalizeWorkspaceView(view);
    const nextMode =
      options && options.mode ? normalizeWorkspaceMode(options.mode) : normalizeWorkspaceMode(state.workspaceMode);
    const viewChanged = state.workspaceView !== normalized;
    const modeChanged = state.workspaceMode !== nextMode;
    const pageResetNeeded = normalized === "start" && state.ribbonPage !== "home";
    if (!viewChanged && !modeChanged && !pageResetNeeded && !(options && options.force)) {
      return;
    }
    state.workspaceView = normalized;
    state.workspaceMode = nextMode;
    if (normalized === "start") {
      state.ribbonPage = "home";
    }
    syncWorkspaceView();
    syncRibbonPage();
    if (normalized === "model") {
      resizeCanvas();
      queueRender();
    }
    if (!options || options.persist !== false) {
      markDirty();
    }
  }

  function setWorkspaceMode(mode, options) {
    const normalized = normalizeWorkspaceMode(mode);
    if (normalized !== "steel" && state.activeFlyout === "steel") {
      state.activeFlyout = null;
    }
    setWorkspaceView("model", {
      force: options && options.force,
      persist: options && options.persist,
      mode: normalized
    });
  }

  function ensureHomeFlyoutVisible() {
    if (state.ribbonPage !== "home" || state.paletteHidden || state.ribbonCollapsed) {
      return;
    }

    const activeVisible = paletteFlyouts.some((flyout) => {
      const flyoutName = String(flyout.dataset.flyout || "").trim().toLowerCase();
      return flyoutName === state.activeFlyout && !flyout.classList.contains("ribbon-group-hidden");
    });

    if (activeVisible) {
      return;
    }

    const selectionVisible = paletteFlyouts.some((flyout) => {
      const flyoutName = String(flyout.dataset.flyout || "").trim().toLowerCase();
      return flyoutName === "selection" && !flyout.classList.contains("ribbon-group-hidden");
    });

    if (selectionVisible) {
      setActiveFlyout("selection", { persist: false });
    }
  }

  function setRibbonPage(page, options) {
    const normalized = normalizeRibbonPage(page);
    if (state.ribbonPage === normalized && !(options && options.force)) {
      ensureHomeFlyoutVisible();
      return;
    }
    state.ribbonPage = normalized;
    syncRibbonPage();
    ensureHomeFlyoutVisible();
    if (!options || options.persist !== false) {
      markDirty();
    }
  }

  function setLayoutTab(tab, options) {
    const normalized = normalizeLayoutTab(tab);
    if (state.layoutTab === normalized && !(options && options.force)) {
      return;
    }
    state.layoutTab = normalized;
    syncLayoutTabs();
    queueRender();
    if (!options || options.persist !== false) {
      markDirty();
    }
  }

  function getPaletteWidthLimits() {
    const workspaceWidth = workspaceEl ? workspaceEl.clientWidth : window.innerWidth;
    const min = 255;
    const max = Math.max(min + 40, Math.min(620, Math.floor(workspaceWidth * 0.58)));
    return { min, max };
  }

  function setPaletteWidth(width, options) {
    const limits = getPaletteWidthLimits();
    const next = clamp(Number(width), limits.min, limits.max, state.paletteWidth);
    if (!Number.isFinite(next)) {
      return;
    }
    state.paletteWidth = next;
    syncLayoutChrome();
    resizeCanvas();
    if (!options || options.persist !== false) {
      markDirty();
    }
  }

  function setRibbonCollapsed(value, options) {
    const next = Boolean(value);
    if (state.ribbonCollapsed === next) {
      return;
    }
    state.ribbonCollapsed = next;
    syncLayoutChrome();
    resizeCanvas();
    if (!options || options.persist !== false) {
      markDirty();
    }
  }

  function setPaletteHidden(value, options) {
    const next = Boolean(value);
    if (state.paletteHidden === next) {
      return;
    }
    state.paletteHidden = next;
    if (next) {
      state.activeFlyout = null;
    }
    syncLayoutChrome();
    resizeCanvas();
    if (!options || options.persist !== false) {
      markDirty();
    }
  }

  function clamp(value, min, max, fallback) {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, value));
  }

  function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
  }

  function fnv1aHash(input, seed) {
    const text = String(input || "");
    let hash = Number.isFinite(seed) ? seed >>> 0 : 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function encodeBase64Url(text) {
    const utf8 = unescape(encodeURIComponent(String(text || "")));
    return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function normalizeLicenseEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getLicenseDeviceId() {
    if (licenseSession.deviceId) {
      return licenseSession.deviceId;
    }
    if (window.desktopApp && typeof window.desktopApp.deviceId === "string" && window.desktopApp.deviceId.length >= 12) {
      licenseSession.deviceId = window.desktopApp.deviceId;
      return licenseSession.deviceId;
    }
    const fallbackRaw = `${navigator.userAgent}|${navigator.platform}|${screen.width}x${screen.height}`;
    licenseSession.deviceId = `web-${fnv1aHash(fallbackRaw)}${fnv1aHash(fallbackRaw, 0x9e3779b9)}`;
    return licenseSession.deviceId;
  }

  function parseLicenseToken(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) {
      return { ok: false, error: "Wklej token licencji." };
    }
    if (!LICENSE_TOKEN_PATTERN.test(token)) {
      return { ok: false, error: "Nieprawidłowy format tokenu." };
    }
    return {
      ok: true,
      token,
      payload: null
    };
  }

  function verifyLicenseToken(rawToken) {
    const parsed = parseLicenseToken(rawToken);
    if (!parsed.ok) {
      return parsed;
    }
    return {
      ok: true,
      token: parsed.token,
      payload: null,
      scope: "private"
    };
  }

  function setLicenseStatus(message, variant) {
    if (!licenseStatus) {
      return;
    }
    licenseStatus.textContent = String(message || "");
    licenseStatus.classList.remove("is-error", "is-ok");
    if (variant === "error") {
      licenseStatus.classList.add("is-error");
    } else if (variant === "ok") {
      licenseStatus.classList.add("is-ok");
    }
  }

  function readPersistedLicenseToken() {
    try {
      const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
      if (!raw) {
        return "";
      }
      const record = JSON.parse(raw);
      return String(record && record.token ? record.token : "").trim();
    } catch (_error) {
      return "";
    }
  }

  function readPersistedLicenseRecord() {
    try {
      const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const record = JSON.parse(raw);
      if (!record || typeof record !== "object") {
        return null;
      }
      return {
        token: String(record.token || "").trim(),
        payload: record.payload && typeof record.payload === "object" ? record.payload : null,
        activatedAt: String(record.activatedAt || "").trim()
      };
    } catch (_error) {
      return null;
    }
  }

  function parseIsoTimestamp(value) {
    const ts = Date.parse(String(value || "").trim());
    return Number.isFinite(ts) ? ts : null;
  }

  function getLicenseClearedMarkerTimestamp() {
    try {
      const raw = localStorage.getItem(LICENSE_CLEARED_MARK_KEY);
      return parseIsoTimestamp(raw);
    } catch (_error) {
      return null;
    }
  }

  function setLicenseClearedMarker() {
    try {
      localStorage.setItem(LICENSE_CLEARED_MARK_KEY, new Date().toISOString());
    } catch (_error) {}
  }

  function clearLicenseClearedMarker() {
    try {
      localStorage.removeItem(LICENSE_CLEARED_MARK_KEY);
    } catch (_error) {}
  }

  async function sha256Hex(text) {
    const value = String(text || "");
    if (!value) {
      return "";
    }
    try {
      if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
        const data = new TextEncoder().encode(value);
        const digest = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      }
    } catch (_error) {}
    return `${fnv1aHash(value)}${fnv1aHash(value, 0x9e3779b9)}${fnv1aHash(value, 0x85ebca6b)}`;
  }

  function getSanitizedUrls(list) {
    const source = Array.isArray(list) ? list : [];
    const out = [];
    const seen = new Set();
    source.forEach((entry) => {
      const value = String(entry || "").trim();
      if (!value || seen.has(value)) {
        return;
      }
      if (!/^https?:\/\//i.test(value)) {
        return;
      }
      seen.add(value);
      out.push(value);
    });
    return out;
  }

  function deriveVerifyUrlFromRegistryApiUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    try {
      const parsed = new URL(raw);
      if (!parsed.pathname.endsWith("/v1/license-registry")) {
        return "";
      }
      parsed.pathname = `${parsed.pathname.slice(0, -"/v1/license-registry".length)}/v1/license-tokens/verify`;
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch (_error) {
      return "";
    }
  }

  function normalizeLicenseEndpointsConfig(payload) {
    const source = payload && typeof payload === "object" ? payload : {};
    const registryApiUrls = getSanitizedUrls(source.registryApiUrls);
    const verifyUrls = getSanitizedUrls([
      ...(Array.isArray(source.verifyUrls) ? source.verifyUrls : []),
      source.verifyUrl,
      ...registryApiUrls.map((entry) => deriveVerifyUrlFromRegistryApiUrl(entry)),
      ...LICENSE_VERIFY_ENDPOINT_URLS
    ]);
    return {
      verifyUrls
    };
  }

  async function fetchLicenseEndpointsConfig() {
    const now = Date.now();
    if (
      licenseRegistryEndpointsState.config &&
      now - licenseRegistryEndpointsState.lastFetchedAt <= LICENSE_ENDPOINTS_CACHE_TTL_MS
    ) {
      return licenseRegistryEndpointsState.config;
    }
    if (licenseRegistryEndpointsState.inFlight) {
      return licenseRegistryEndpointsState.inFlight;
    }
    const task = (async () => {
      try {
        if (typeof fetch !== "function") {
          throw new Error("Brak API fetch.");
        }
        const response = await fetch(`${LICENSE_REGISTRY_ENDPOINTS_CONFIG_URL}?ts=${Date.now()}`, {
          method: "GET",
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const normalized = normalizeLicenseEndpointsConfig(payload);
        licenseRegistryEndpointsState.config = normalized;
        licenseRegistryEndpointsState.lastFetchedAt = Date.now();
        return normalized;
      } catch (_error) {
        const fallback = normalizeLicenseEndpointsConfig(null);
        licenseRegistryEndpointsState.config = fallback;
        licenseRegistryEndpointsState.lastFetchedAt = Date.now();
        return fallback;
      }
    })();
    licenseRegistryEndpointsState.inFlight = task;
    try {
      return await task;
    } finally {
      if (licenseRegistryEndpointsState.inFlight === task) {
        licenseRegistryEndpointsState.inFlight = null;
      }
    }
  }

  function shouldSkipRemoteRegistryCall(rawUrl) {
    if (window.desktopApp && window.desktopApp.isDesktop) {
      return false;
    }
    const currentOrigin = String(window.location && window.location.origin ? window.location.origin : "").trim();
    if (!currentOrigin || currentOrigin === "null") {
      return false;
    }
    try {
      const target = new URL(String(rawUrl || ""));
      if (target.host !== LICENSE_REGISTRY_DEFAULT_API_HOST) {
        return false;
      }
    } catch {
      return false;
    }
    return currentOrigin !== LICENSE_REGISTRY_ALLOWED_WEB_ORIGIN;
  }

  async function readApiError(response) {
    const fallbackResponse = response && typeof response.clone === "function" ? response.clone() : null;
    try {
      const data = await response.json();
      if (data && typeof data === "object" && String(data.error || "").trim()) {
        return String(data.error).trim();
      }
    } catch (_error) {}
    try {
      const text = fallbackResponse ? await fallbackResponse.text() : "";
      const message = String(text || "").trim();
      return message ? message.slice(0, 240) : "";
    } catch (_error) {
      return "";
    }
  }

  function invalidateCurrentLicense(message, auditContext) {
    clearPersistedLicenseRecord();
    setLicenseClearedMarker();
    licenseSession.token = "";
    licenseSession.payload = null;
    if (licenseTokenInput) {
      licenseTokenInput.value = "";
    }
    setLicenseLocked(true);
    setLicenseStatus(message, "error");
    appendPrivateLicenseAudit(String(auditContext || "Walidacja licencji"), String(message || ""), {
      deviceId: getLicenseDeviceId()
    });
  }

  function stopRemoteLicenseRecheck() {
    if (licenseRemoteRecheckTimer !== null) {
      clearInterval(licenseRemoteRecheckTimer);
      licenseRemoteRecheckTimer = null;
    }
  }

  function startRemoteLicenseRecheck() {
    if (!LICENSE_ENFORCEMENT_ENABLED) {
      return;
    }
    if (licenseRemoteRecheckTimer !== null || !licenseSession.active || !licenseSession.token) {
      return;
    }
    licenseRemoteRecheckTimer = setInterval(() => {
      if (!licenseSession.active || !licenseSession.token) {
        stopRemoteLicenseRecheck();
        return;
      }
      void validateLicenseWithPublicRegistry({
        force: true,
        audit: false,
        persist: false,
        context: "Cykliczna walidacja online"
      });
    }, LICENSE_REMOTE_RECHECK_INTERVAL_MS);
  }

  async function validateLicenseWithPublicRegistry(options) {
    if (!LICENSE_ENFORCEMENT_ENABLED) {
      return true;
    }
    const opts = options && typeof options === "object" ? options : {};
    if (!licenseSession.active || !licenseSession.token) {
      return false;
    }

    const contextLabel = String(opts.context || "Walidacja online");
    const tokenHash = await sha256Hex(licenseSession.token);
    if (!tokenHash) {
      return true;
    }

    const now = Date.now();
    if (
      !opts.force &&
      licenseRemoteState.lastResultOk !== null &&
      licenseRemoteState.lastTokenHash === tokenHash &&
      now - licenseRemoteState.lastCheckedAt <= LICENSE_REMOTE_CHECK_TTL_MS
    ) {
      return licenseRemoteState.lastResultOk;
    }

    if (licenseRemoteState.inFlight) {
      return licenseRemoteState.inFlight;
    }

    const task = (async () => {
      const endpoints = await fetchLicenseEndpointsConfig();
      const verifyUrls = getSanitizedUrls(endpoints && endpoints.verifyUrls ? endpoints.verifyUrls : []);
      if (verifyUrls.length === 0) {
        licenseRemoteState.lastCheckedAt = Date.now();
        licenseRemoteState.lastTokenHash = tokenHash;
        licenseRemoteState.lastResultOk = false;
        invalidateCurrentLicense(
          "Brak skonfigurowanego endpointu weryfikacji licencji. Licencja została zablokowana.",
          contextLabel
        );
        return false;
      }

      const deviceId = getLicenseDeviceId();
      let lastError = null;
      for (const verifyUrl of verifyUrls) {
        if (shouldSkipRemoteRegistryCall(verifyUrl)) {
          lastError = new Error(
            "Weryfikacja online działa tylko na stronie produkcyjnej lub w aplikacji desktop."
          );
          continue;
        }
        try {
          const response = await fetch(`${verifyUrl}?ts=${Date.now()}`, {
            method: "POST",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              token: licenseSession.token,
              deviceId
            })
          });
          if (!response.ok) {
            const message = (await readApiError(response)) || `HTTP ${response.status}`;
            if ([400, 403, 404].includes(response.status)) {
              licenseRemoteState.lastCheckedAt = Date.now();
              licenseRemoteState.lastTokenHash = tokenHash;
              licenseRemoteState.lastResultOk = false;
              invalidateCurrentLicense(`Serwer odrzucił token (${message}).`, contextLabel);
              return false;
            }
            throw new Error(message);
          }

          const payload = await response.json();
          const serverPayload = payload && payload.payload && typeof payload.payload === "object" ? payload.payload : {};
          const remoteDeviceId = String(serverPayload.deviceId || "").trim();
          if (remoteDeviceId && remoteDeviceId !== deviceId) {
            licenseRemoteState.lastCheckedAt = Date.now();
            licenseRemoteState.lastTokenHash = tokenHash;
            licenseRemoteState.lastResultOk = false;
            invalidateCurrentLicense("Token jest przypisany do innego urządzenia.", contextLabel);
            return false;
          }

          licenseSession.payload = serverPayload;
          if (opts.persist !== false) {
            persistLicenseRecord(licenseSession.token, licenseSession.payload);
          }
          updateLicenseSummaryChip();
          licenseRemoteState.lastCheckedAt = Date.now();
          licenseRemoteState.lastTokenHash = tokenHash;
          licenseRemoteState.lastResultOk = true;

          if (opts.audit === true) {
            appendPrivateLicenseAudit(contextLabel, "Token potwierdzony przez serwer licencji.", {
              deviceId: getLicenseDeviceId()
            });
          }
          return true;
        } catch (error) {
          lastError = error;
        }
      }

      const reason = String(lastError && lastError.message ? lastError.message : "nieznany błąd");
      licenseRemoteState.lastCheckedAt = Date.now();
      licenseRemoteState.lastTokenHash = tokenHash;
      licenseRemoteState.lastResultOk = false;
      invalidateCurrentLicense(
        `Nie udało się zweryfikować licencji online (${reason}). Licencja została zablokowana.`,
        contextLabel
      );
      return false;
    })();

    licenseRemoteState.inFlight = task;
    try {
      return await task;
    } finally {
      if (licenseRemoteState.inFlight === task) {
        licenseRemoteState.inFlight = null;
      }
    }
  }

  function normalizeLicenseOwner(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }
    const ownerName = String(payload.ownerName || "").trim();
    if (ownerName) {
      return ownerName;
    }
    const email = normalizeLicenseEmail(payload.email);
    if (email) {
      return email;
    }
    return "";
  }

  function getLicenseScopeLabel(payload) {
    const scope = String(payload && payload.scope ? payload.scope : "")
      .trim()
      .toLowerCase();
    return scope === "commercial" ? "Komercyjna" : "Free";
  }

  function updateLicenseSummaryChip() {
    if (!licenseSummaryChip) {
      return;
    }
    licenseSummaryChip.classList.remove("is-free", "is-commercial", "is-missing");

    if (!LICENSE_ENFORCEMENT_ENABLED) {
      licenseSummaryChip.dataset.icon = "\u2713";
      licenseSummaryChip.textContent = "Licencja: wyłączona";
      licenseSummaryChip.classList.add("is-free");
      licenseSummaryChip.title = "Aktywacja licencji jest tymczasowo wyłączona.";
      return;
    }

    if (!licenseSession.active) {
      licenseSummaryChip.dataset.icon = "\u26A0";
      licenseSummaryChip.textContent = "Licencja: brak";
      licenseSummaryChip.classList.add("is-missing");
      licenseSummaryChip.title = "Brak aktywnej licencji na tym urządzeniu.";
      return;
    }

    const payload = licenseSession.payload;
    const scopeLabel = getLicenseScopeLabel(payload);
    const owner = normalizeLicenseOwner(payload) || "bez nazwy";
    const scopeRaw = String(payload && payload.scope ? payload.scope : "").toLowerCase();
    const isCommercial = scopeRaw === "commercial";
    licenseSummaryChip.dataset.icon = isCommercial ? "\uD83D\uDCBC" : "\uD83C\uDFE0";
    licenseSummaryChip.textContent = `Licencja: ${scopeLabel} • ${owner}`;
    licenseSummaryChip.classList.add(isCommercial ? "is-commercial" : "is-free");
    licenseSummaryChip.title = `Aktywna licencja ${scopeLabel.toLowerCase()} (${owner}).`;
  }

  function appendPrivateLicenseAudit(type, details, meta) {
    if (!window.desktopApp || typeof window.desktopApp.appendLicenseAudit !== "function") {
      return;
    }
    const payload = {
      type: String(type || "akcja"),
      details: String(details || ""),
      meta: meta && typeof meta === "object" ? meta : {}
    };
    window.desktopApp.appendLicenseAudit(payload).catch((error) => {
      console.warn("Nie udało się zapisać prywatnego audytu licencji:", error);
    });
  }

  function setLicenseOverlayVisible(visible) {
    if (!licenseOverlay) {
      return;
    }
    const next = Boolean(visible);
    licenseOverlay.hidden = !next;
    licenseOverlay.setAttribute("aria-hidden", next ? "false" : "true");
  }

  function enforceLicenseStorageIntegrity(options) {
    if (!LICENSE_ENFORCEMENT_ENABLED) {
      return true;
    }
    const opts = options && typeof options === "object" ? options : {};
    const storedRecord = readPersistedLicenseRecord();
    const storedToken = String(storedRecord && storedRecord.token ? storedRecord.token : "").trim();
    const activeToken = String(licenseSession.token || "").trim();
    if (storedToken && activeToken && storedToken === activeToken) {
      return true;
    }
    licenseSession.token = "";
    licenseSession.payload = null;
    clearPersistedLicenseRecord();
    setLicenseClearedMarker();
    if (licenseTokenInput) {
      licenseTokenInput.value = "";
    }
    setLicenseLocked(true);
    if (opts.silent !== true) {
      setLicenseStatus("Wykryto brak lub zmianę klucza licencji. Wymagana ponowna aktywacja.", "error");
      echoCommand("Licencja została usunięta lub zmieniona. Aplikacja została zablokowana.", true);
    }
    appendPrivateLicenseAudit(
      "Integralność licencji",
      "Wykryto brak lub zmianę lokalnego tokenu. Sesja została zablokowana.",
      { deviceId: getLicenseDeviceId() }
    );
    return false;
  }

  function openLicenseManager() {
    if (!LICENSE_ENFORCEMENT_ENABLED) {
      setLicenseOverlayVisible(true);
      if (licenseTokenInput) {
        licenseTokenInput.focus();
      }
      return;
    }
    setLicenseOverlayVisible(true);
    if (licenseTokenInput) {
      licenseTokenInput.focus();
    }
  }

  function closeLicenseManager() {
    if (!licenseSession.active) {
      return;
    }
    setLicenseOverlayVisible(false);
  }

  function setLicenseLocked(locked) {
    const isLocked = LICENSE_ENFORCEMENT_ENABLED ? Boolean(locked) : false;
    licenseSession.active = !isLocked;
    if (appRoot) {
      appRoot.classList.toggle("license-locked", isLocked);
    }
    if (licenseCloseBtn) {
      licenseCloseBtn.hidden = isLocked;
    }
    setLicenseOverlayVisible(isLocked);
    if (isLocked) {
      stopRemoteLicenseRecheck();
    } else {
      startRemoteLicenseRecheck();
    }
    updateLicenseSummaryChip();
  }

  function persistLicenseRecord(token, payload) {
    try {
      const record = {
        token,
        payload,
        activatedAt: new Date().toISOString()
      };
      localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(record));
      clearLicenseClearedMarker();
    } catch (error) {
      console.warn("Nie udało się zapisać licencji:", error);
    }
  }

  function clearPersistedLicenseRecord() {
    try {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
    } catch (error) {
      console.warn("Nie udało się usunąć zapisanej licencji:", error);
    }
  }

  function validateStoredLicenseAtStartup(storedRecord, options) {
    if (!LICENSE_ENFORCEMENT_ENABLED) {
      setLicenseLocked(false);
      return true;
    }
    const opts = options && typeof options === "object" ? options : {};
    const auditEnabled = opts.audit !== false;
    const contextLabel = String(opts.context || "Walidacja przy uruchomieniu");
    const record = storedRecord && typeof storedRecord === "object" ? storedRecord : null;
    const token = String(record && record.token ? record.token : "").trim();
    if (!token) {
      setLicenseLocked(true);
      setLicenseStatus("Tryb licencjonowany jest aktywny. Wklej token, aby kontynuować.", "error");
      return false;
    }

    const clearMarkerTs = getLicenseClearedMarkerTimestamp();
    const activatedAtTs = parseIsoTimestamp(record && record.activatedAt ? record.activatedAt : "");
    if (clearMarkerTs !== null && (activatedAtTs === null || activatedAtTs <= clearMarkerTs)) {
      clearPersistedLicenseRecord();
      licenseSession.token = "";
      licenseSession.payload = null;
      if (licenseTokenInput) {
        licenseTokenInput.value = "";
      }
      setLicenseLocked(true);
      setLicenseStatus("Licencja została wcześniej usunięta. Wymagana ponowna aktywacja.", "error");
      if (auditEnabled) {
        appendPrivateLicenseAudit(contextLabel, "Odrzucono token zapisany przed czyszczeniem.", {
          deviceId: getLicenseDeviceId()
        });
      }
      return false;
    }

    const result = activateLicenseToken(token, {
      persist: false,
      silent: true,
      payload: record && record.payload && typeof record.payload === "object" ? record.payload : null
    });
    if (result.ok) {
      updateLicenseSummaryChip();
      if (auditEnabled) {
        appendPrivateLicenseAudit(contextLabel, "Token zapisany lokalnie. Oczekiwanie na potwierdzenie serwera.", {
          deviceId: getLicenseDeviceId(),
          scope: result.scope
        });
      }
      return true;
    }

    clearPersistedLicenseRecord();
    licenseSession.token = "";
    licenseSession.payload = null;
    if (licenseTokenInput) {
      licenseTokenInput.value = "";
    }
    setLicenseLocked(true);
    setLicenseStatus(`Token nieważny: ${result.error}. Wymagana ponowna aktywacja.`, "error");
    if (auditEnabled) {
      appendPrivateLicenseAudit(contextLabel, `Token odrzucony: ${result.error}`, {
        deviceId: getLicenseDeviceId()
      });
    }
    return false;
  }

  function activateLicenseToken(rawToken, options) {
    const opts = options && typeof options === "object" ? options : {};
    const verified = verifyLicenseToken(rawToken);
    if (!verified.ok) {
      setLicenseLocked(true);
      if (opts.silent !== true) {
        setLicenseStatus(`Błąd licencji: ${verified.error}`, "error");
      }
      return verified;
    }

    const initialPayload = opts.payload && typeof opts.payload === "object" ? opts.payload : null;
    const fallbackPayload = {
      v: 2,
      scope: "private",
      ownerName: "",
      email: "",
      purpose: "",
      deviceId: getLicenseDeviceId(),
      issuedAt: new Date().toISOString()
    };

    licenseSession.token = verified.token;
    licenseSession.payload = initialPayload || fallbackPayload;
    if (opts.persist !== false) {
      persistLicenseRecord(verified.token, licenseSession.payload);
    }
    setLicenseLocked(false);
    const scope = String(licenseSession.payload.scope || "private").trim().toLowerCase() === "commercial"
      ? "commercial"
      : "private";
    const scopeLabel = scope === "commercial" ? "komercyjny" : "prywatny";
    if (opts.silent !== true) {
      setLicenseStatus("Token zapisany. Trwa walidacja online...", "ok");
      const owner = normalizeLicenseOwner(licenseSession.payload) || "bez nazwy";
      appendPrivateLicenseAudit("Aktywacja tokenu", `${scopeLabel} | ${owner} | oczekiwanie na walidację online`, {
        scope,
        owner
      });
    }
    return {
      ...verified,
      scope,
      payload: licenseSession.payload
    };
  }

  function openSupportProjectPage() {
    window.open(LICENSE_SUPPORT_URL, "_blank", "noopener,noreferrer");
    setLicenseStatus("Otwarto stronę wsparcia projektu (PayPal).", "ok");
    appendPrivateLicenseAudit("Wsparcie projektu", LICENSE_SUPPORT_URL, {
      url: LICENSE_SUPPORT_URL
    });
  }

  async function copyLicenseText(text) {
    const value = String(text || "").trim();
    if (!value) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function initializeLicenseManager() {
    if (!LICENSE_ENFORCEMENT_ENABLED) {
      licenseSession.active = true;
      stopRemoteLicenseRecheck();
      setLicenseOverlayVisible(false);
      if (licenseCategoryBtn) {
        licenseCategoryBtn.hidden = false;
      }
      if (licenseCloseBtn) {
        licenseCloseBtn.hidden = false;
      }
      if (appRoot) {
        appRoot.classList.remove("license-locked");
      }
      if (licenseStatus) {
        setLicenseStatus(
          "Tryb przypomnienia: aplikacja działa bez blokady, ale możesz aktywować token lub wesprzeć projekt.",
          "ok"
        );
      }
      if (LICENSE_NAG_ON_START_ENABLED && licenseOverlay) {
        window.setTimeout(() => {
          setLicenseOverlayVisible(true);
        }, 350);
      }
      updateLicenseSummaryChip();
      return true;
    }
    if (!licenseOverlay) {
      licenseSession.active = true;
      updateLicenseSummaryChip();
      return true;
    }

    const deviceId = getLicenseDeviceId();
    if (licenseDeviceIdInput) {
      licenseDeviceIdInput.value = deviceId;
    }

    if (licenseOpenWebFormBtn) {
      licenseOpenWebFormBtn.addEventListener("click", () => {
        const url = `${LICENSE_PRIVATE_FORM_URL}?deviceId=${encodeURIComponent(deviceId)}`;
        window.open(url, "_blank", "noopener,noreferrer");
        setLicenseStatus("Otworzono formularz tokenu prywatnego na GitHub Pages.", "ok");
        appendPrivateLicenseAudit("Formularz prywatny", `ID urządzenia: ${deviceId}`, {
          deviceId
        });
      });
    }
    if (licenseCopyDeviceIdBtn) {
      licenseCopyDeviceIdBtn.addEventListener("click", async () => {
        const copied = await copyLicenseText(deviceId);
        setLicenseStatus(
          copied ? "Skopiowano ID urządzenia do schowka." : "Nie udało się skopiować ID urządzenia.",
          copied ? "ok" : "error"
        );
      });
    }
    if (licenseSupportProjectBtn) {
      licenseSupportProjectBtn.addEventListener("click", () => {
        openSupportProjectPage();
      });
    }
    if (licenseActivateTokenBtn) {
      licenseActivateTokenBtn.addEventListener("click", async () => {
        const token = licenseTokenInput ? licenseTokenInput.value : "";
        const result = activateLicenseToken(token);
        if (result.ok) {
          const remoteOk = await validateLicenseWithPublicRegistry({
            force: true,
            audit: true,
            persist: true,
            context: "Walidacja online po aktywacji"
          });
          if (remoteOk) {
            setLicenseStatus("Token został potwierdzony przez serwer licencji.", "ok");
            echoCommand("Token aktywny.");
          }
        }
      });
    }
    if (licenseCloseBtn) {
      licenseCloseBtn.addEventListener("click", () => {
        closeLicenseManager();
      });
    }
    if (licenseClearTokenBtn) {
      licenseClearTokenBtn.addEventListener("click", async () => {
        clearPersistedLicenseRecord();
        if (window.desktopApp && typeof window.desktopApp.clearLicenseStorage === "function") {
          try {
            await window.desktopApp.clearLicenseStorage();
          } catch (_error) {}
          // Po czyszczeniu sesji Electron ustawiamy to jeszcze raz po stronie renderera.
          clearPersistedLicenseRecord();
        }
        setLicenseClearedMarker();
        licenseSession.token = "";
        licenseSession.payload = null;
        if (licenseTokenInput) {
          licenseTokenInput.value = "";
        }
        setLicenseLocked(true);
        setLicenseStatus("Usunięto zapisany token. Przypomnienie pozostaje aktywne, ale aplikacja działa dalej.", "ok");
        appendPrivateLicenseAudit("Czyszczenie tokenu", "Usunięto lokalnie zapisany token.", {
          deviceId: getLicenseDeviceId()
        });
      });
    }

    updateLicenseSummaryChip();

    const storedRecord = readPersistedLicenseRecord();
    return validateStoredLicenseAtStartup(storedRecord);
  }

  function resetViewTransform() {
    state.view.scale = 1;
    state.view.offsetX = 160;
    state.view.offsetY = 80;
  }

  function ensureValidViewState() {
    let changed = false;
    const scale = Number(state.view.scale);
    const offsetX = Number(state.view.offsetX);
    const offsetY = Number(state.view.offsetY);

    if (!Number.isFinite(scale) || scale < 0.01 || scale > 50) {
      state.view.scale = 1;
      changed = true;
    }
    if (!Number.isFinite(offsetX)) {
      state.view.offsetX = 160;
      changed = true;
    }
    if (!Number.isFinite(offsetY)) {
      state.view.offsetY = 80;
      changed = true;
    }

    return changed;
  }

  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cloneEntity(entity) {
    return JSON.parse(JSON.stringify(entity));
  }

  function normalizeLineStyle(style) {
    return style === "dashed" || style === "dotted" ? style : "solid";
  }

  function lineStyleLabel(style) {
    const normalized = normalizeLineStyle(style);
    if (normalized === "dashed") {
      return t("kreskowana", "dashed");
    }
    if (normalized === "dotted") {
      return t("kropkowana", "dotted");
    }
    return t("ciągła", "solid");
  }

  function normalizeDimensionMode(mode) {
    if (mode === "linear") {
      return "linear";
    }
    if (mode === "rotated") {
      return "rotated";
    }
    if (mode === "angular") {
      return "angular";
    }
    return "aligned";
  }

  function normalizeAngleDegrees(value) {
    let angle = Number(value);
    if (!Number.isFinite(angle)) {
      angle = 0;
    }
    while (angle <= -180) {
      angle += 360;
    }
    while (angle > 180) {
      angle -= 360;
    }
    return angle;
  }

  function dimensionModeLabel(mode) {
    const normalized = normalizeDimensionMode(mode);
    if (normalized === "linear") {
      return t("liniowy", "linear");
    }
    if (normalized === "rotated") {
      return t("obrócony", "rotated");
    }
    if (normalized === "angular") {
      return t("kątowy", "angular");
    }
    return t("wyrównany", "aligned");
  }

  function normalizeLayers(layers) {
    const source = Array.isArray(layers) ? layers : [];
    const normalized = source
      .map((layer, index) => {
        if (!layer || typeof layer !== "object") {
          return null;
        }
        return {
          id: layer.id || createId(),
          name: layer.name || `${t("Warstwa", "Layer")} ${index}`,
          visible: layer.visible !== false,
          locked: Boolean(layer.locked)
        };
      })
      .filter(Boolean);

    if (normalized.length === 0) {
      normalized.push({
        id: createId(),
        name: `${t("Warstwa", "Layer")} 0`,
        visible: true,
        locked: false
      });
    }

    return normalized;
  }

  function normalizeEntities(entities) {
    const source = Array.isArray(entities) ? entities : [];
    return source
      .map((entity) => {
        if (!entity || typeof entity !== "object") {
          return null;
        }

        const base = {
          id: entity.id || createId(),
          stroke: entity.stroke || "#d9e7ff",
          lineWidth: Math.max(1, Number(entity.lineWidth) || 2),
          lineStyle: normalizeLineStyle(entity.lineStyle),
          layerId: entity.layerId || state.activeLayerId
        };

        if (entity.type === "line") {
          return {
            ...base,
            type: "line",
            x1: Number(entity.x1) || 0,
            y1: Number(entity.y1) || 0,
            x2: Number(entity.x2) || 0,
            y2: Number(entity.y2) || 0
          };
        }

        if (entity.type === "dimension") {
          const hasRawDimX = entity.dimX !== null && entity.dimX !== undefined && entity.dimX !== "";
          const hasRawDimY = entity.dimY !== null && entity.dimY !== undefined && entity.dimY !== "";
          const hasRawX3 = entity.x3 !== null && entity.x3 !== undefined && entity.x3 !== "";
          const hasRawY3 = entity.y3 !== null && entity.y3 !== undefined && entity.y3 !== "";
          const parsedDimX = hasRawDimX ? Number(entity.dimX) : NaN;
          const parsedDimY = hasRawDimY ? Number(entity.dimY) : NaN;
          const parsedX3 = hasRawX3 ? Number(entity.x3) : NaN;
          const parsedY3 = hasRawY3 ? Number(entity.y3) : NaN;
          const parsedOffset = Number(entity.offset);
          const parsedRotation = Number(entity.rotation);
          const parsedDecimals = Math.round(Number(entity.decimals));
          return {
            ...base,
            type: "dimension",
            stroke: entity.stroke || state.dimensionColor || "#ffd166",
            x1: Number(entity.x1) || 0,
            y1: Number(entity.y1) || 0,
            x2: Number(entity.x2) || 0,
            y2: Number(entity.y2) || 0,
            x3: Number.isFinite(parsedX3) ? parsedX3 : null,
            y3: Number.isFinite(parsedY3) ? parsedY3 : null,
            textSize: Math.max(8, Number(entity.textSize) || 12),
            unit: entity.unit || "mm",
            dimX: Number.isFinite(parsedDimX) ? parsedDimX : null,
            dimY: Number.isFinite(parsedDimY) ? parsedDimY : null,
            offset: Number.isFinite(parsedOffset) ? parsedOffset : null,
            mode: normalizeDimensionMode(entity.mode),
            rotation: Number.isFinite(parsedRotation) ? normalizeAngleDegrees(parsedRotation) : 0,
            decimals: Number.isFinite(parsedDecimals) ? clamp(parsedDecimals, 0, 4, 0) : 0
          };
        }

        if (entity.type === "rect") {
          return {
            ...base,
            type: "rect",
            x: Number(entity.x) || 0,
            y: Number(entity.y) || 0,
            w: Number(entity.w) || 0,
            h: Number(entity.h) || 0,
            fill: Boolean(entity.fill),
            fillColor: entity.fillColor || "#00a9e0",
            fillAlpha: clamp(Number(entity.fillAlpha), 0, 100, 20)
          };
        }

        if (entity.type === "circle") {
          return {
            ...base,
            type: "circle",
            cx: Number(entity.cx) || 0,
            cy: Number(entity.cy) || 0,
            r: Math.max(0, Number(entity.r) || 0),
            fill: Boolean(entity.fill),
            fillColor: entity.fillColor || "#00a9e0",
            fillAlpha: clamp(Number(entity.fillAlpha), 0, 100, 20)
          };
        }

        if (entity.type === "fillRegion") {
          const points = Array.isArray(entity.points)
            ? entity.points
                .map((point) => ({ x: Number(point?.x) || 0, y: Number(point?.y) || 0 }))
                .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
            : [];
          if (points.length < 3) {
            return null;
          }
          return {
            ...base,
            type: "fillRegion",
            stroke: "none",
            lineWidth: 1,
            lineStyle: "solid",
            points,
            fill: true,
            fillColor: entity.fillColor || "#00a9e0",
            fillAlpha: clamp(Number(entity.fillAlpha), 0, 100, 20)
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  function ensureActiveLayer() {
    if (!state.layers.some((layer) => layer.id === state.activeLayerId)) {
      state.activeLayerId = state.layers[0].id;
    }
  }

  function ensureEntityLayers() {
    const fallbackLayerId = state.layers[0].id;
    for (const entity of state.entities) {
      if (!state.layers.some((layer) => layer.id === entity.layerId)) {
        entity.layerId = fallbackLayerId;
      }
    }
  }

  function makeSnapshot() {
    return JSON.stringify({
      entities: state.entities,
      layers: state.layers,
      activeLayerId: state.activeLayerId,
      selectedId: state.selectedId,
      selectedIds: state.selectedIds,
      lastMeasure: state.lastMeasure
    });
  }

  function saveHistory() {
    state.historyUndo.push(makeSnapshot());
    if (state.historyUndo.length > 250) {
      state.historyUndo.shift();
    }
    state.historyRedo = [];
  }

  function restoreSnapshot(snapshot) {
    try {
      const parsed = JSON.parse(snapshot);
      state.layers = normalizeLayers(parsed.layers);
      state.activeLayerId = parsed.activeLayerId;
      ensureActiveLayer();
      state.entities = normalizeEntities(parsed.entities);
      ensureEntityLayers();
      const restoredSelectedIds = Array.isArray(parsed.selectedIds)
        ? parsed.selectedIds
        : parsed.selectedId
        ? [parsed.selectedId]
        : [];
      setSelection(restoredSelectedIds, parsed.selectedId || restoredSelectedIds[0] || null);
      state.lastMeasure = parsed.lastMeasure || null;
      queueRender();
    } catch (error) {
      console.error("Nie udało się odtworzyć stanu historii:", error);
    }
  }

  function undo() {
    const previous = state.historyUndo.pop();
    if (!previous) {
      return false;
    }
    state.historyRedo.push(makeSnapshot());
    restoreSnapshot(previous);
    return true;
  }

  function redo() {
    const next = state.historyRedo.pop();
    if (!next) {
      return false;
    }
    state.historyUndo.push(makeSnapshot());
    restoreSnapshot(next);
    return true;
  }

  function getLayerById(id) {
    return state.layers.find((layer) => layer.id === id) || null;
  }

  function getLayerNameById(id) {
    const layer = getLayerById(id);
    return layer ? layer.name : `${t("Warstwa", "Layer")} ?`;
  }

  function getActiveLayer() {
    return getLayerById(state.activeLayerId);
  }

  function isEntityVisible(entity) {
    const layer = getLayerById(entity.layerId);
    return layer ? layer.visible !== false : true;
  }

  function isEntityLocked(entity) {
    const layer = getLayerById(entity.layerId);
    return layer ? Boolean(layer.locked) : false;
  }

  function assertCanDrawOnActiveLayer() {
    const layer = getActiveLayer();
    if (!layer) {
      alert(t("Brak aktywnej warstwy.", "No active layer."));
      return false;
    }
    if (!layer.visible) {
      alert(t("Aktywna warstwa jest ukryta. Odkryj ja lub wybierz inna.", "Active layer is hidden. Unhide it or choose another."));
      return false;
    }
    if (layer.locked) {
      alert(t("Aktywna warstwa jest zablokowana.", "Active layer is locked."));
      return false;
    }
    return true;
  }

  function createBaseEntity(type) {
    return {
      id: createId(),
      type,
      stroke: state.strokeColor,
      lineWidth: state.lineWidth,
      lineStyle: state.lineStyle,
      layerId: state.activeLayerId
    };
  }

  function getMouseScreen(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function worldToScreen(point) {
    ensureValidViewState();
    const px = Number(point && point.x);
    const py = Number(point && point.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return { x: state.view.offsetX, y: state.view.offsetY };
    }
    return {
      x: px * state.view.scale + state.view.offsetX,
      y: py * state.view.scale + state.view.offsetY
    };
  }

  function screenToWorld(point) {
    ensureValidViewState();
    const px = Number(point && point.x);
    const py = Number(point && point.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return { x: 0, y: 0 };
    }
    return {
      x: (px - state.view.offsetX) / state.view.scale,
      y: (py - state.view.offsetY) / state.view.scale
    };
  }

  function snapPoint(point) {
    if (!state.snap) {
      return point;
    }
    const objectSnap = findObjectSnapPoint(point);
    const edgeSnap = findEdgeSnapPoint(point);
    const g = Math.max(1, state.gridSize);
    const gridSnap = {
      x: Math.round(point.x / g) * g,
      y: Math.round(point.y / g) * g
    };
    if (objectSnap) {
      return objectSnap;
    }
    if (edgeSnap) {
      return edgeSnap;
    }
    return gridSnap;
  }

  function isPointNearBounds(point, bounds, padding) {
    if (!bounds) {
      return true;
    }
    return (
      point.x >= bounds.minX - padding &&
      point.x <= bounds.maxX + padding &&
      point.y >= bounds.minY - padding &&
      point.y <= bounds.maxY + padding
    );
  }

  function closestPointOnSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.000001) {
      return { x: a.x, y: a.y };
    }
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq, 0, 1, 0);
    return {
      x: a.x + dx * t,
      y: a.y + dy * t
    };
  }

  function segmentIntersectionPoint(a, b, c, d) {
    const x1 = a.x;
    const y1 = a.y;
    const x2 = b.x;
    const y2 = b.y;
    const x3 = c.x;
    const y3 = c.y;
    const x4 = d.x;
    const y4 = d.y;
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.000001) {
      return null;
    }
    const det1 = x1 * y2 - y1 * x2;
    const det2 = x3 * y4 - y3 * x4;
    const px = (det1 * (x3 - x4) - (x1 - x2) * det2) / denom;
    const py = (det1 * (y3 - y4) - (y1 - y2) * det2) / denom;
    const inRange = (value, min, max) => value >= min - 0.0001 && value <= max + 0.0001;
    if (
      !inRange(px, Math.min(x1, x2), Math.max(x1, x2)) ||
      !inRange(py, Math.min(y1, y2), Math.max(y1, y2)) ||
      !inRange(px, Math.min(x3, x4), Math.max(x3, x4)) ||
      !inRange(py, Math.min(y3, y4), Math.max(y3, y4))
    ) {
      return null;
    }
    return { x: px, y: py };
  }

  function lineCircleIntersectionPoints(a, b, circle) {
    const radius = Math.max(0, Number(circle && circle.r) || 0);
    if (radius <= 0) {
      return [];
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const fx = a.x - circle.cx;
    const fy = a.y - circle.cy;
    const qa = dx * dx + dy * dy;
    if (qa < 0.000001) {
      return [];
    }
    const qb = 2 * (fx * dx + fy * dy);
    const qc = fx * fx + fy * fy - radius * radius;
    const discriminant = qb * qb - 4 * qa * qc;
    if (discriminant < -0.000001) {
      return [];
    }
    const epsilon = 0.000001;
    const result = [];
    const discriminantSafe = Math.max(0, discriminant);
    const sqrtDisc = Math.sqrt(discriminantSafe);
    const candidates = [
      (-qb - sqrtDisc) / (2 * qa),
      (-qb + sqrtDisc) / (2 * qa)
    ];
    for (const t of candidates) {
      if (!Number.isFinite(t) || t < -epsilon || t > 1 + epsilon) {
        continue;
      }
      const clampedT = clamp(t, 0, 1, 0);
      const point = {
        x: a.x + dx * clampedT,
        y: a.y + dy * clampedT
      };
      if (result.some((entry) => Math.hypot(entry.x - point.x, entry.y - point.y) <= 0.0005)) {
        continue;
      }
      result.push(point);
    }
    return result;
  }

  function lineCircleIntersectionParamsInfinite(a, b, circle) {
    const radius = Math.max(0, Number(circle && circle.r) || 0);
    if (radius <= 0) {
      return [];
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const fx = a.x - circle.cx;
    const fy = a.y - circle.cy;
    const qa = dx * dx + dy * dy;
    if (qa < 0.000001) {
      return [];
    }
    const qb = 2 * (fx * dx + fy * dy);
    const qc = fx * fx + fy * fy - radius * radius;
    const discriminant = qb * qb - 4 * qa * qc;
    if (discriminant < -0.000001) {
      return [];
    }
    const discriminantSafe = Math.max(0, discriminant);
    const sqrtDisc = Math.sqrt(discriminantSafe);
    const candidates = [
      (-qb - sqrtDisc) / (2 * qa),
      (-qb + sqrtDisc) / (2 * qa)
    ];
    const result = [];
    for (const t of candidates) {
      if (!Number.isFinite(t)) {
        continue;
      }
      if (result.some((entry) => Math.abs(entry - t) <= 0.0005)) {
        continue;
      }
      result.push(t);
    }
    result.sort((aValue, bValue) => aValue - bValue);
    return result;
  }

  function pointAtLineParam(line, tValue) {
    const t = clamp(Number(tValue), 0, 1, 0);
    return {
      x: line.x1 + (line.x2 - line.x1) * t,
      y: line.y1 + (line.y2 - line.y1) * t
    };
  }

  function pointOnLineAtParam(line, tValue) {
    const t = Number(tValue);
    return {
      x: line.x1 + (line.x2 - line.x1) * t,
      y: line.y1 + (line.y2 - line.y1) * t
    };
  }

  function cross2d(a, b) {
    return a.x * b.y - a.y * b.x;
  }

  function lineInfiniteSegmentIntersectionParam(line, segment) {
    if (!line || !segment) {
      return null;
    }
    const p = { x: line.x1, y: line.y1 };
    const r = { x: line.x2 - line.x1, y: line.y2 - line.y1 };
    const q = segment.a;
    const s = { x: segment.b.x - segment.a.x, y: segment.b.y - segment.a.y };
    const rxs = cross2d(r, s);
    if (Math.abs(rxs) < 0.000001) {
      return null;
    }
    const qp = { x: q.x - p.x, y: q.y - p.y };
    const t = cross2d(qp, s) / rxs;
    const u = cross2d(qp, r) / rxs;
    if (u < -0.000001 || u > 1.000001) {
      return null;
    }
    return t;
  }

  function lineParamForPoint(line, point) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.000001) {
      return 0;
    }
    return clamp(((point.x - line.x1) * dx + (point.y - line.y1) * dy) / lenSq, 0, 1, 0);
  }

  function getTrimSegmentsForEntity(entity) {
    if (!entity) {
      return [];
    }
    if (entity.type === "line") {
      return [
        {
          a: { x: entity.x1, y: entity.y1 },
          b: { x: entity.x2, y: entity.y2 }
        }
      ];
    }
    if (entity.type === "rect") {
      const bounds = getEntityBounds(entity);
      if (!bounds) {
        return [];
      }
      const corners = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY }
      ];
      return corners.map((corner, index) => ({
        a: corner,
        b: corners[(index + 1) % corners.length]
      }));
    }
    return [];
  }

  function collectTrimIntersectionParams(targetLine, cutterEntity) {
    if (!targetLine || targetLine.type !== "line") {
      return [];
    }
    const targetA = { x: targetLine.x1, y: targetLine.y1 };
    const targetB = { x: targetLine.x2, y: targetLine.y2 };
    const intersections = [];
    const epsilon = 0.0005;

    if (cutterEntity && cutterEntity.type === "circle") {
      for (const hit of lineCircleIntersectionPoints(targetA, targetB, cutterEntity)) {
        const t = lineParamForPoint(targetLine, hit);
        if (t <= epsilon || t >= 1 - epsilon) {
          continue;
        }
        if (intersections.some((entry) => Math.abs(entry.t - t) <= epsilon)) {
          continue;
        }
        intersections.push({ t, point: hit });
      }
    } else {
      for (const segment of getTrimSegmentsForEntity(cutterEntity)) {
        const hit = segmentIntersectionPoint(targetA, targetB, segment.a, segment.b);
        if (!hit) {
          continue;
        }
        const t = lineParamForPoint(targetLine, hit);
        if (t <= epsilon || t >= 1 - epsilon) {
          continue;
        }
        if (intersections.some((entry) => Math.abs(entry.t - t) <= epsilon)) {
          continue;
        }
        intersections.push({ t, point: hit });
      }
    }

    intersections.sort((a, b) => a.t - b.t);
    return intersections;
  }

  function buildTrimmedLineEntities(targetLine, cutterEntity, clickPoint) {
    const intersections = collectTrimIntersectionParams(targetLine, cutterEntity);
    if (intersections.length === 0) {
      return null;
    }

    const boundaries = [0, ...intersections.map((entry) => entry.t), 1];
    const intervals = [];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      if (end - start <= 0.0005) {
        continue;
      }
      intervals.push({
        start,
        end,
        mid: (start + end) / 2
      });
    }

    if (intervals.length <= 1) {
      return null;
    }

    const clickT = lineParamForPoint(targetLine, clickPoint);
    let trimmedInterval = intervals[0];
    let bestDistance = Math.abs(clickT - trimmedInterval.mid);
    for (let index = 1; index < intervals.length; index += 1) {
      const distance = Math.abs(clickT - intervals[index].mid);
      if (distance < bestDistance) {
        trimmedInterval = intervals[index];
        bestDistance = distance;
      }
    }

    const keptIntervals = intervals.filter(
      (interval) =>
        Math.abs(interval.start - trimmedInterval.start) > 0.0005 ||
        Math.abs(interval.end - trimmedInterval.end) > 0.0005
    );
    if (keptIntervals.length === 0) {
      return null;
    }

    return keptIntervals.map((interval, index) => {
      const copy = cloneEntity(targetLine);
      copy.id = index === 0 ? targetLine.id : createId();
      const startPoint = pointAtLineParam(targetLine, interval.start);
      const endPoint = pointAtLineParam(targetLine, interval.end);
      copy.x1 = startPoint.x;
      copy.y1 = startPoint.y;
      copy.x2 = endPoint.x;
      copy.y2 = endPoint.y;
      return copy;
    });
  }

  function collectExtendIntersectionParams(targetLine, cutterEntity) {
    if (!targetLine || targetLine.type !== "line") {
      return [];
    }
    const intersections = [];
    const epsilon = 0.0005;

    if (cutterEntity && cutterEntity.type === "circle") {
      for (const t of lineCircleIntersectionParamsInfinite(
        { x: targetLine.x1, y: targetLine.y1 },
        { x: targetLine.x2, y: targetLine.y2 },
        cutterEntity
      )) {
        if (intersections.some((entry) => Math.abs(entry - t) <= epsilon)) {
          continue;
        }
        intersections.push(t);
      }
    } else {
      for (const segment of getTrimSegmentsForEntity(cutterEntity)) {
        const t = lineInfiniteSegmentIntersectionParam(targetLine, segment);
        if (!Number.isFinite(t)) {
          continue;
        }
        if (intersections.some((entry) => Math.abs(entry - t) <= epsilon)) {
          continue;
        }
        intersections.push(t);
      }
    }

    intersections.sort((aValue, bValue) => aValue - bValue);
    return intersections;
  }

  function buildExtendedLineEntity(targetLine, cutterEntity, clickPoint) {
    const intersections = collectExtendIntersectionParams(targetLine, cutterEntity);
    if (intersections.length === 0) {
      return null;
    }

    const clickT = lineParamForPoint(targetLine, clickPoint);
    const extendStart = clickT <= 0.5;
    const epsilon = 0.0005;
    const targetT = extendStart
      ? intersections.filter((value) => value < -epsilon).sort((aValue, bValue) => bValue - aValue)[0]
      : intersections.filter((value) => value > 1 + epsilon).sort((aValue, bValue) => aValue - bValue)[0];

    if (!Number.isFinite(targetT)) {
      return null;
    }

    const copy = cloneEntity(targetLine);
    const extensionPoint = pointOnLineAtParam(targetLine, targetT);
    if (extendStart) {
      copy.x1 = extensionPoint.x;
      copy.y1 = extensionPoint.y;
    } else {
      copy.x2 = extensionPoint.x;
      copy.y2 = extensionPoint.y;
    }
    return copy;
  }

  function pushSnapCandidate(output, x, y, priority) {
    if (!output) {
      return;
    }
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return;
    }
    output.push({
      x: px,
      y: py,
      priority: clamp(Math.round(Number(priority)), 0, 4, 1)
    });
  }

  function collectSnapPointsForEntity(entity, output) {
    if (!entity || !output) {
      return;
    }
    if (entity.type === "line") {
      pushSnapCandidate(output, entity.x1, entity.y1, 0);
      pushSnapCandidate(output, entity.x2, entity.y2, 0);
      pushSnapCandidate(output, (entity.x1 + entity.x2) / 2, (entity.y1 + entity.y2) / 2, 1);
      return;
    }
    if (entity.type === "rect") {
      const x1 = Math.min(entity.x, entity.x + entity.w);
      const x2 = Math.max(entity.x, entity.x + entity.w);
      const y1 = Math.min(entity.y, entity.y + entity.h);
      const y2 = Math.max(entity.y, entity.y + entity.h);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      pushSnapCandidate(output, x1, y1, 0);
      pushSnapCandidate(output, x2, y1, 0);
      pushSnapCandidate(output, x2, y2, 0);
      pushSnapCandidate(output, x1, y2, 0);
      pushSnapCandidate(output, mx, y1, 1);
      pushSnapCandidate(output, x2, my, 1);
      pushSnapCandidate(output, mx, y2, 1);
      pushSnapCandidate(output, x1, my, 1);
      pushSnapCandidate(output, mx, my, 2);
      return;
    }
    if (entity.type === "circle") {
      pushSnapCandidate(output, entity.cx + entity.r, entity.cy, 0);
      pushSnapCandidate(output, entity.cx - entity.r, entity.cy, 0);
      pushSnapCandidate(output, entity.cx, entity.cy + entity.r, 0);
      pushSnapCandidate(output, entity.cx, entity.cy - entity.r, 0);
      pushSnapCandidate(output, entity.cx, entity.cy, 1);
      return;
    }
    if (entity.type === "dimension") {
      const geometry = getDimensionGeometry(entity);
      pushSnapCandidate(output, entity.x1, entity.y1, 0);
      pushSnapCandidate(output, entity.x2, entity.y2, 0);
      if (entity.x3 !== null && entity.x3 !== undefined && entity.x3 !== "") {
        const x3 = Number(entity.x3);
        const y3 = Number(entity.y3);
        if (Number.isFinite(x3) && Number.isFinite(y3)) {
          pushSnapCandidate(output, x3, y3, 0);
        }
      }
      if (geometry) {
        pushSnapCandidate(output, geometry.d1.x, geometry.d1.y, 1);
        pushSnapCandidate(output, geometry.d2.x, geometry.d2.y, 1);
        if (geometry.kind === "angular") {
          pushSnapCandidate(output, geometry.vertex.x, geometry.vertex.y, 0);
        }
      }
    }
  }

  function collectSnapSegmentsForEntity(entity, output) {
    if (!entity || !output) {
      return;
    }
    if (entity.type === "line") {
      output.push({ a: { x: entity.x1, y: entity.y1 }, b: { x: entity.x2, y: entity.y2 } });
      return;
    }
    if (entity.type === "circle") {
      const steps = 36;
      const radius = Math.max(0, Number(entity.r) || 0);
      if (radius <= 0) {
        return;
      }
      for (let i = 0; i < steps; i += 1) {
        const t1 = (i / steps) * Math.PI * 2;
        const t2 = ((i + 1) / steps) * Math.PI * 2;
        output.push({
          a: { x: entity.cx + Math.cos(t1) * radius, y: entity.cy + Math.sin(t1) * radius },
          b: { x: entity.cx + Math.cos(t2) * radius, y: entity.cy + Math.sin(t2) * radius }
        });
      }
      return;
    }
    if (entity.type === "rect") {
      const x1 = Math.min(entity.x, entity.x + entity.w);
      const x2 = Math.max(entity.x, entity.x + entity.w);
      const y1 = Math.min(entity.y, entity.y + entity.h);
      const y2 = Math.max(entity.y, entity.y + entity.h);
      output.push({ a: { x: x1, y: y1 }, b: { x: x2, y: y1 } });
      output.push({ a: { x: x2, y: y1 }, b: { x: x2, y: y2 } });
      output.push({ a: { x: x2, y: y2 }, b: { x: x1, y: y2 } });
      output.push({ a: { x: x1, y: y2 }, b: { x: x1, y: y1 } });
      return;
    }
    if (entity.type === "dimension") {
      const geometry = getDimensionGeometry(entity);
      if (!geometry) {
        return;
      }
      if (geometry.kind === "angular") {
        output.push({ a: geometry.vertex, b: geometry.d1 });
        output.push({ a: geometry.vertex, b: geometry.d2 });
        const arcPoints = getAngularArcPolyline(geometry, 56);
        for (let i = 0; i < arcPoints.length - 1; i += 1) {
          output.push({ a: arcPoints[i], b: arcPoints[i + 1] });
        }
      } else {
        output.push({ a: { x: geometry.x1, y: geometry.y1 }, b: { x: geometry.d1.x, y: geometry.d1.y } });
        output.push({ a: { x: geometry.x2, y: geometry.y2 }, b: { x: geometry.d2.x, y: geometry.d2.y } });
        output.push({ a: { x: geometry.d1.x, y: geometry.d1.y }, b: { x: geometry.d2.x, y: geometry.d2.y } });
      }
    }
  }

  function findObjectSnapPoint(point) {
    if (!Array.isArray(state.entities) || state.entities.length === 0) {
      return null;
    }
    const thresholdWorld = OBJECT_SNAP_THRESHOLD_PX / Math.max(0.05, state.view.scale);
    const thresholdSq = thresholdWorld * thresholdWorld;
    let bestPoint = null;
    let bestPointDistSq = thresholdSq;
    let bestPointScore = Number.POSITIVE_INFINITY;
    let bestIntersection = null;
    let bestIntersectionDistSq = thresholdSq;
    let bestSegment = null;
    let bestSegmentDistSq = thresholdSq * 0.64;
    const segments = [];

    for (const entity of state.entities) {
      if (!entity || !isEntityVisible(entity)) {
        continue;
      }
      const bounds = getEntityBounds(entity);
      if (!isPointNearBounds(point, bounds, thresholdWorld)) {
        continue;
      }

      const points = [];
      collectSnapPointsForEntity(entity, points);
      for (const candidate of points) {
        const dx = candidate.x - point.x;
        const dy = candidate.y - point.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > thresholdSq) {
          continue;
        }
        const priority = clamp(Math.round(Number(candidate.priority)), 0, 4, 1);
        const score = distSq + thresholdSq * 0.18 * priority;
        if (score <= bestPointScore) {
          bestPointScore = score;
          bestPointDistSq = distSq;
          bestPoint = { x: candidate.x, y: candidate.y };
        }
      }
      collectSnapSegmentsForEntity(entity, segments);
    }

    for (const segment of segments) {
      const minX = Math.min(segment.a.x, segment.b.x) - thresholdWorld;
      const maxX = Math.max(segment.a.x, segment.b.x) + thresholdWorld;
      const minY = Math.min(segment.a.y, segment.b.y) - thresholdWorld;
      const maxY = Math.max(segment.a.y, segment.b.y) + thresholdWorld;
      if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
        continue;
      }
      const projected = closestPointOnSegment(point, segment.a, segment.b);
      const dx = projected.x - point.x;
      const dy = projected.y - point.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestSegmentDistSq) {
        bestSegmentDistSq = distSq;
        bestSegment = projected;
      }
    }

    const nearbySegments = [];
    const nearbyPadding = thresholdWorld * 1.6;
    for (const segment of segments) {
      const minX = Math.min(segment.a.x, segment.b.x) - nearbyPadding;
      const maxX = Math.max(segment.a.x, segment.b.x) + nearbyPadding;
      const minY = Math.min(segment.a.y, segment.b.y) - nearbyPadding;
      const maxY = Math.max(segment.a.y, segment.b.y) + nearbyPadding;
      if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
        continue;
      }
      nearbySegments.push(segment);
    }

    const maxNearbyForIntersection = 80;
    let segmentsForIntersection = nearbySegments;
    if (nearbySegments.length > maxNearbyForIntersection) {
      segmentsForIntersection = [...nearbySegments]
        .map((segment) => {
          const projected = closestPointOnSegment(point, segment.a, segment.b);
          const dx = projected.x - point.x;
          const dy = projected.y - point.y;
          return { segment, distSq: dx * dx + dy * dy };
        })
        .sort((left, right) => left.distSq - right.distSq)
        .slice(0, maxNearbyForIntersection)
        .map((entry) => entry.segment);
    }

    if (segmentsForIntersection.length > 1) {
      for (let i = 0; i < segmentsForIntersection.length; i += 1) {
        for (let j = i + 1; j < segmentsForIntersection.length; j += 1) {
          const intersection = segmentIntersectionPoint(
            segmentsForIntersection[i].a,
            segmentsForIntersection[i].b,
            segmentsForIntersection[j].a,
            segmentsForIntersection[j].b
          );
          if (!intersection) {
            continue;
          }
          const dx = intersection.x - point.x;
          const dy = intersection.y - point.y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= bestIntersectionDistSq) {
            bestIntersectionDistSq = distSq;
            bestIntersection = intersection;
          }
        }
      }
    }

    const pointBias = bestPoint ? 0 : Number.POSITIVE_INFINITY;
    const intersectionBias = bestIntersection ? thresholdSq * 0.08 : Number.POSITIVE_INFINITY;
    const segmentBias = bestSegment ? thresholdSq * 0.34 : Number.POSITIVE_INFINITY;
    const pointScore = bestPoint ? bestPointScore + pointBias : Number.POSITIVE_INFINITY;
    const intersectionScore =
      bestIntersection ? bestIntersectionDistSq + intersectionBias : Number.POSITIVE_INFINITY;
    const segmentScore = bestSegment ? bestSegmentDistSq + segmentBias : Number.POSITIVE_INFINITY;

    if (pointScore <= intersectionScore && pointScore <= segmentScore) {
      return bestPoint;
    }
    if (intersectionScore <= segmentScore) {
      return bestIntersection;
    }
    return bestSegment;
  }

  function findEdgeSnapPoint(point) {
    if (!Array.isArray(state.entities) || state.entities.length === 0) {
      return null;
    }

    const thresholdWorld = EDGE_SNAP_THRESHOLD_PX / Math.max(0.05, state.view.scale);
    const thresholdSq = thresholdWorld * thresholdWorld;
    let best = null;
    let bestDistSq = thresholdSq;
    const segments = [];

    for (const entity of state.entities) {
      if (!entity || !isEntityVisible(entity)) {
        continue;
      }
      const bounds = getEntityBounds(entity);
      if (!isPointNearBounds(point, bounds, thresholdWorld * 1.4)) {
        continue;
      }
      collectSnapSegmentsForEntity(entity, segments);
    }

    for (const segment of segments) {
      const projected = closestPointOnSegment(point, segment.a, segment.b);
      const dx = projected.x - point.x;
      const dy = projected.y - point.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = projected;
      }
    }

    return best;
  }

  function constrainOrtho(anchor, point, enabled) {
    if (!enabled || !anchor) {
      return point;
    }
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: point.x, y: anchor.y };
    }
    return { x: anchor.x, y: point.y };
  }

  function constrainPolar(anchor, point, stepDegrees, enabled) {
    if (!enabled || !anchor) {
      return point;
    }
    const step = Math.max(0, Number(stepDegrees) || 0);
    if (step <= 0) {
      return point;
    }
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.000001) {
      return point;
    }
    const angle = Math.atan2(dy, dx);
    const stepRad = (step * Math.PI) / 180;
    const snappedAngle = Math.round(angle / stepRad) * stepRad;
    return {
      x: anchor.x + Math.cos(snappedAngle) * distance,
      y: anchor.y + Math.sin(snappedAngle) * distance
    };
  }

  function getEntityById(id) {
    return state.entities.find((entity) => entity.id === id) || null;
  }

  function getSelectionIds() {
    const candidateIds = [];
    if (Array.isArray(state.selectedIds)) {
      candidateIds.push(...state.selectedIds);
    }
    if (state.selectedId) {
      candidateIds.push(state.selectedId);
    }

    const uniqueValidIds = [];
    const seen = new Set();
    for (const id of candidateIds) {
      if (!id || seen.has(id) || !getEntityById(id)) {
        continue;
      }
      seen.add(id);
      uniqueValidIds.push(id);
    }

    const primary =
      state.selectedId && seen.has(state.selectedId)
        ? state.selectedId
        : uniqueValidIds.length > 0
        ? uniqueValidIds[uniqueValidIds.length - 1]
        : null;

    const changedIds =
      uniqueValidIds.length !== state.selectedIds.length ||
      uniqueValidIds.some((id, index) => state.selectedIds[index] !== id);
    if (changedIds) {
      state.selectedIds = uniqueValidIds;
    }
    if (state.selectedId !== primary) {
      state.selectedId = primary;
    }

    return state.selectedIds;
  }

  function getSelectedEntities() {
    return getSelectionIds()
      .map((id) => getEntityById(id))
      .filter(Boolean);
  }

  function isEntitySelected(entityId) {
    if (!entityId) {
      return false;
    }
    return getSelectionIds().includes(entityId);
  }

  function setSelection(ids, primaryId) {
    const nextIdsRaw = Array.isArray(ids) ? ids : [];
    const nextIds = [];
    const seen = new Set();
    for (const id of nextIdsRaw) {
      if (!id || seen.has(id) || !getEntityById(id)) {
        continue;
      }
      seen.add(id);
      nextIds.push(id);
    }

    let nextPrimary = null;
    if (primaryId && seen.has(primaryId)) {
      nextPrimary = primaryId;
    } else if (nextIds.length > 0) {
      nextPrimary = nextIds[nextIds.length - 1];
    }

    state.selectedIds = nextIds;
    state.selectedId = nextPrimary;
  }

  function setPrimarySelection(entityId) {
    if (!entityId || !getEntityById(entityId)) {
      state.selectedIds = [];
      state.selectedId = null;
      return;
    }
    state.selectedIds = [entityId];
    state.selectedId = entityId;
  }

  function clearSelection() {
    state.selectedIds = [];
    state.selectedId = null;
  }

  function toggleSelection(entityId) {
    const currentIds = getSelectionIds();
    if (!entityId || !getEntityById(entityId)) {
      return false;
    }
    if (currentIds.includes(entityId)) {
      const remaining = currentIds.filter((id) => id !== entityId);
      setSelection(remaining, remaining.length > 0 ? remaining[remaining.length - 1] : null);
      return false;
    }
    const added = [...currentIds, entityId];
    setSelection(added, entityId);
    return true;
  }

  export function setTool(tool) {
    if (state.commandState) {
      cancelActiveCommand({ echo: false });
    }
    if (state.workspaceView === "start") {
      setWorkspaceView("model", { persist: false, mode: "draw" });
    }
    state.tool = tool;
    if (tool !== "line" && tool !== "rect" && tool !== "circle" && tool !== "measure" && tool !== "dimension") {
      state.drawStart = null;
      state.previewPoint = null;
      state.dimensionSecond = null;
      state.dimensionThird = null;
      state.lengthInputBuffer = "";
    }
    if (tool !== "polyline") {
      state.polylineAnchor = null;
      if (tool !== "line" && tool !== "measure") {
        state.lengthInputBuffer = "";
      }
    }
    toolButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tool === tool);
    });
    syncShapeConfigControls();
    queueRender();
  }

  function updateStatus(pointer) {
    const point = pointer || state.pointerWorld;
    if (coordsLabel) {
      coordsLabel.textContent = `X: ${point.x.toFixed(2)} Y: ${point.y.toFixed(2)}`;
    }
    if (zoomInfoLabel) {
      zoomInfoLabel.textContent = `${t("Skala", "Scale")}: ${(state.view.scale * 100).toFixed(0)}%`;
    }
    if (entityCountLabel) {
      entityCountLabel.textContent = `${t("Obiekty", "Objects")}: ${state.entities.length}`;
    }
    if (state.commandState) {
      if (toolInfoLabel) {
        toolInfoLabel.textContent = `${t("Polecenie", "Command")}: ${String(state.commandState.name || "").toUpperCase()}`;
        toolInfoLabel.dataset.icon = "\u23F5";
      }
    } else {
      const lengthPreview = String(state.lengthInputBuffer || "").trim();
      const lengthSuffix = lengthPreview ? ` | ${t("Długość", "Length")}: ${lengthPreview}` : "";
      const snapSuffix = state.snap ? ` | SNAP: ${t("WŁ", "ON")}` : ` | SNAP: ${t("WYŁ", "OFF")}`;
      if (toolInfoLabel) {
        toolInfoLabel.textContent = `${t("Narzędzie", "Tool")}: ${TOOL_LABELS[state.tool] || state.tool}${lengthSuffix}${snapSuffix}`;
        toolInfoLabel.dataset.icon = TOOL_ICONS[state.tool] || "\u2699";
      }
    }
    if (angleInfoLabel) {
      let angleText = "—";
      if (state.drawStart && ["line", "measure", "dimension"].includes(state.tool)) {
        const targetPoint = state.previewPoint || point || state.pointerWorld;
        if (targetPoint) {
          const dx = targetPoint.x - state.drawStart.x;
          const dy = targetPoint.y - state.drawStart.y;
          if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
            angleText = `${normalizeAngleDegrees((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(2)}°`;
          }
        }
      }
      angleInfoLabel.textContent = `${t("Kąt", "Angle")}: ${angleText}`;
    }
    if (workspaceStateInfo) {
      const modeLabel = state.workspaceMode === "steel" ? t("Generator stali", "Steel generator") : t("Rysowanie 2D", "2D drawing");
      const layoutLabel = state.layoutTab === "sheet1" ? t("Arkusz1", "Sheet1") : t("Model", "Model");
      workspaceStateInfo.textContent = `${t("Tryb", "Mode")}: ${modeLabel} | ${t("Układ", "Layout")}: ${layoutLabel}`;
    }
    syncStartSummary();
  }

  function syncActionButtonsState() {
    const selectedEntities = getSelectedEntities();
    const hasSelected = selectedEntities.length > 0;
    const selectedLocked = hasSelected ? selectedEntities.some((entity) => isEntityLocked(entity)) : false;
    const commandActive = Boolean(state.commandState);
    const selectedIndexes = hasSelected
      ? selectedEntities
          .map((selected) => state.entities.findIndex((entity) => entity.id === selected.id))
          .filter((index) => index >= 0)
      : [];
    const minSelectedIndex = selectedIndexes.length ? Math.min(...selectedIndexes) : -1;
    const maxSelectedIndex = selectedIndexes.length ? Math.max(...selectedIndexes) : -1;

    undoBtn.disabled = state.historyUndo.length === 0;
    redoBtn.disabled = state.historyRedo.length === 0;
    duplicateBtn.disabled = !hasSelected || selectedLocked;
    if (moveCmdBtn) {
      moveCmdBtn.disabled = commandActive || !hasSelected || selectedLocked;
    }
    if (copyCmdBtn) {
      copyCmdBtn.disabled = commandActive || !hasSelected || selectedLocked;
    }
    if (trimCmdBtn) {
      trimCmdBtn.disabled = commandActive;
    }
    if (extendCmdBtn) {
      extendCmdBtn.disabled = commandActive;
    }
    if (offsetCmdBtn) {
      offsetCmdBtn.disabled = commandActive;
    }
    deleteBtn.disabled = !hasSelected || selectedLocked;
    toFrontBtn.disabled =
      !hasSelected || selectedLocked || maxSelectedIndex === -1 || maxSelectedIndex === state.entities.length - 1;
    toBackBtn.disabled = !hasSelected || selectedLocked || minSelectedIndex <= 0;
    clearBtn.disabled = state.entities.length === 0;
    fitViewBtn.disabled = state.entities.length === 0;
  }

  function pushActivityMessage(message, isError) {
    // Historia w pasku aktywności została usunięta - zostawiamy tylko komunikaty toast.
    void message;
    void isError;
  }

  function showToastMessage(message, isError) {
    if (!toastMessage) {
      return;
    }
    const text = String(message || "").trim();
    if (!text) {
      return;
    }
    const error = Boolean(isError);
    const duration = error ? 3200 : 2300;
    updateToastAnchor();
    toastMessage.textContent = text;
    toastMessage.dataset.icon = error ? "\u26A0" : "\u2713";
    toastMessage.classList.toggle("error", error);
    toastMessage.setAttribute("role", error ? "alert" : "status");
    toastMessage.setAttribute("aria-atomic", "true");
    const sameMessage = toastMessage.dataset.message === text && toastMessage.dataset.error === String(error);
    toastMessage.dataset.message = text;
    toastMessage.dataset.error = String(error);
    if (!sameMessage || !toastMessage.classList.contains("visible")) {
      toastMessage.classList.remove("visible");
      void toastMessage.offsetWidth;
      toastMessage.classList.add("visible");
    }
    if (toastHideTimer) {
      clearTimeout(toastHideTimer);
    }
    toastHideTimer = setTimeout(() => {
      toastMessage.classList.remove("visible");
    }, duration);
  }

  function echoCommand(message, isError, options) {
    const text = localizeMessageText(String(message || ""));
    pushActivityMessage(text, Boolean(isError));
    const showToast = !options || options.toast !== false;
    if (showToast) {
      showToastMessage(text, Boolean(isError));
    }
  }

  function selectedEntityLabel(entity) {
    if (!entity) {
      return t("obiekt", "object");
    }
    if (entity.type === "line") {
      return t("linia", "line");
    }
    if (entity.type === "rect") {
      return t("prostokąt", "rectangle");
    }
    if (entity.type === "circle") {
      return t("okrąg", "circle");
    }
    if (entity.type === "dimension") {
      return t("wymiar", "dimension");
    }
    if (entity.type === "fillRegion") {
      return t("wypełnienie", "fill");
    }
    return t("obiekt", "object");
  }

  function setDimensionMode(mode, options) {
    const normalized = normalizeDimensionMode(mode);
    state.dimensionMode = normalized;
    if (dimensionModeSelect) {
      dimensionModeSelect.value = normalized;
    }
    queueRender();
    if (!options || options.persist !== false) {
      markDirty();
    }
  }

  function cancelActiveCommand(options) {
    if (!state.commandState) {
      return false;
    }
    state.commandState = null;
    clearDrawingPreview();
    if (!options || options.echo !== false) {
      echoCommand("Polecenie anulowane.");
    }
    queueRender();
    return true;
  }

  function startMoveCommand() {
    clearDrawingPreview();
    finishPolyline();
    const selectedEntities = getSelectedEntities();
    if (selectedEntities.length === 0) {
      echoCommand("MOVE: najpierw zaznacz obiekt.", true);
      return false;
    }
    if (selectedEntities.some((entity) => isEntityLocked(entity))) {
      echoCommand("MOVE: obiekt jest na zablokowanej warstwie.", true);
      return false;
    }
    state.commandState = {
      name: "move",
      phase: "pick-base",
      sourceIds: selectedEntities.map((entity) => entity.id),
      basePoint: null
    };
    echoCommand("MOVE: wskaz punkt bazowy.");
    return true;
  }

  function startCopyCommand() {
    clearDrawingPreview();
    finishPolyline();
    const selectedEntities = getSelectedEntities();
    if (selectedEntities.length === 0) {
      echoCommand("COPY: najpierw zaznacz obiekt.", true);
      return false;
    }
    if (selectedEntities.some((entity) => isEntityLocked(entity))) {
      echoCommand("COPY: obiekt jest na zablokowanej warstwie.", true);
      return false;
    }
    state.commandState = {
      name: "copy",
      phase: "pick-base",
      sourceIds: selectedEntities.map((entity) => entity.id),
      basePoint: null
    };
    echoCommand("COPY: wskaz punkt bazowy.");
    return true;
  }

  function startOffsetCommand(distanceValue) {
    clearDrawingPreview();
    finishPolyline();
    const parsed = Number(distanceValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      state.offsetDistance = parsed;
      markDirty();
    }

    const selected = getEntityById(state.selectedId);
    const canUseSelected =
      selected && !isEntityLocked(selected) && (selected.type === "line" || selected.type === "rect" || selected.type === "circle");

    state.commandState = {
      name: "offset",
      phase: canUseSelected ? "pick-side" : "pick-source",
      sourceId: canUseSelected ? selected.id : null,
      distance: state.offsetDistance
    };
    if (canUseSelected) {
      echoCommand(`OFFSET: wskaz stronę odsunięcia (dystans ${state.offsetDistance}).`);
    } else {
      echoCommand(`OFFSET: wskaz obiekt bazowy (dystans ${state.offsetDistance}).`);
    }
    return true;
  }

  function startTrimCommand() {
    clearDrawingPreview();
    finishPolyline();
    const selected = getEntityById(state.selectedId);
    const canUseSelected =
      selected && !isEntityLocked(selected) && ["line", "rect", "circle"].includes(selected.type);
    state.commandState = {
      name: "trim",
      phase: canUseSelected ? "pick-target" : "pick-cutter",
      cutterId: canUseSelected ? selected.id : null
    };
    if (canUseSelected) {
      echoCommand("TRIM: kliknij fragment linii do odcięcia.");
    } else {
      echoCommand("TRIM: wskaż krawędź tnącą (linia, prostokąt lub okrąg).");
    }
    return true;
  }

  function startExtendCommand() {
    clearDrawingPreview();
    finishPolyline();
    const selected = getEntityById(state.selectedId);
    const canUseSelected =
      selected && !isEntityLocked(selected) && ["line", "rect", "circle"].includes(selected.type);
    state.commandState = {
      name: "extend",
      phase: canUseSelected ? "pick-target" : "pick-cutter",
      cutterId: canUseSelected ? selected.id : null
    };
    if (canUseSelected) {
      echoCommand("EXTEND: kliknij stronę linii do przedłużenia.");
    } else {
      echoCommand("EXTEND: wskaż krawędź ograniczającą (linia, prostokąt lub okrąg).");
    }
    return true;
  }

  function createOffsetEntity(source, distance, sidePoint) {
    const d = Math.abs(Number(distance) || 0);
    if (!source || !sidePoint || d <= 0) {
      return null;
    }

    if (source.type === "line") {
      const dx = source.x2 - source.x1;
      const dy = source.y2 - source.y1;
      const len = Math.hypot(dx, dy);
      if (len <= 0.0001) {
        return null;
      }
      const nx = -dy / len;
      const ny = dx / len;
      const midX = (source.x1 + source.x2) / 2;
      const midY = (source.y1 + source.y2) / 2;
      const side = (sidePoint.x - midX) * nx + (sidePoint.y - midY) * ny >= 0 ? 1 : -1;
      const copy = cloneEntity(source);
      copy.id = createId();
      copy.x1 += nx * d * side;
      copy.y1 += ny * d * side;
      copy.x2 += nx * d * side;
      copy.y2 += ny * d * side;
      return copy;
    }

    if (source.type === "circle") {
      const dist = Math.hypot(sidePoint.x - source.cx, sidePoint.y - source.cy);
      const sign = dist >= source.r ? 1 : -1;
      const nextRadius = source.r + sign * d;
      if (nextRadius <= 0.5) {
        return null;
      }
      const copy = cloneEntity(source);
      copy.id = createId();
      copy.r = nextRadius;
      return copy;
    }

    if (source.type === "rect") {
      const minX = Math.min(source.x, source.x + source.w);
      const maxX = Math.max(source.x, source.x + source.w);
      const minY = Math.min(source.y, source.y + source.h);
      const maxY = Math.max(source.y, source.y + source.h);
      const outside = sidePoint.x < minX || sidePoint.x > maxX || sidePoint.y < minY || sidePoint.y > maxY;
      const sign = outside ? 1 : -1;
      const nextMinX = minX - sign * d;
      const nextMaxX = maxX + sign * d;
      const nextMinY = minY - sign * d;
      const nextMaxY = maxY + sign * d;
      const width = nextMaxX - nextMinX;
      const height = nextMaxY - nextMinY;
      if (width <= 0.5 || height <= 0.5) {
        return null;
      }
      const copy = cloneEntity(source);
      copy.id = createId();
      copy.x = nextMinX;
      copy.y = nextMinY;
      copy.w = width;
      copy.h = height;
      return copy;
    }

    return null;
  }

  function handleActiveCommandMouseDown(rawPoint, snappedPoint, event) {
    const command = state.commandState;
    if (!command) {
      return false;
    }

    const point = state.snap ? snappedPoint : rawPoint;

    if (command.name === "move" || command.name === "copy") {
      const sourceIds = Array.isArray(command.sourceIds) ? command.sourceIds : command.sourceId ? [command.sourceId] : [];
      const sources = sourceIds.map((id) => getEntityById(id)).filter(Boolean);
      if (sources.length === 0) {
        cancelActiveCommand({ echo: false });
        echoCommand(`${command.name.toUpperCase()}: obiekt źródłowy nie istnieje.`, true);
        return true;
      }

      if (command.phase === "pick-base") {
        command.basePoint = point;
        command.phase = "pick-target";
        echoCommand(`${command.name.toUpperCase()}: wskaz punkt docelowy.`);
        return true;
      }

      if (command.phase === "pick-target" && command.basePoint) {
        const target = getConstrainedPoint(command.basePoint, rawPoint, event);
        const dx = target.x - command.basePoint.x;
        const dy = target.y - command.basePoint.y;
        if (dx === 0 && dy === 0) {
          echoCommand(`${command.name.toUpperCase()}: przemieszczenie 0. Polecenie anulowane.`, true);
          state.commandState = null;
          return true;
        }

        saveHistory();
        if (command.name === "move") {
          for (const source of sources) {
            moveEntity(source, dx, dy);
          }
          setSelection(
            sources.map((source) => source.id),
            sources[sources.length - 1].id
          );
        } else {
          const createdIds = [];
          for (const source of sources) {
            const copy = cloneEntity(source);
            copy.id = createId();
            moveEntity(copy, dx, dy);
            state.entities.push(copy);
            createdIds.push(copy.id);
          }
          setSelection(createdIds, createdIds.length ? createdIds[createdIds.length - 1] : null);
        }
        state.commandState = null;
        markDirty();
        queueRender();
        echoCommand(`${command.name.toUpperCase()}: wykonano.`);
        return true;
      }
    }

    if (command.name === "offset") {
      if (command.phase === "pick-source") {
        const hitId = hitTest(rawPoint);
        const hit = getEntityById(hitId);
        if (!hit || !["line", "rect", "circle"].includes(hit.type)) {
          echoCommand("OFFSET: wskaz linie, prostokąt lub okrąg.", true);
          return true;
        }
        if (isEntityLocked(hit)) {
          echoCommand("OFFSET: obiekt jest na zablokowanej warstwie.", true);
          return true;
        }
        command.sourceId = hit.id;
        command.phase = "pick-side";
        setPrimarySelection(hit.id);
        queueRender();
        echoCommand(`OFFSET: wskaz stronę odsunięcia (dystans ${command.distance}).`);
        return true;
      }

      if (command.phase === "pick-side") {
        const source = getEntityById(command.sourceId);
        const created = createOffsetEntity(source, command.distance, point);
        if (!created) {
          echoCommand("OFFSET: nie można utworzyc offsetu dla tego obiektu.", true);
          return true;
        }
        saveHistory();
        state.entities.push(created);
        setPrimarySelection(created.id);
        markDirty();
        queueRender();
        echoCommand("OFFSET: utworzono obiekt.");
        state.commandState = null;
        return true;
      }
    }

    if (command.name === "trim") {
      if (command.phase === "pick-cutter") {
        const hitId = hitTest(rawPoint) || hitTest(snappedPoint);
        const hit = getEntityById(hitId);
        if (!hit || !["line", "rect", "circle"].includes(hit.type)) {
          echoCommand("TRIM: wskaż linię, prostokąt lub okrąg jako krawędź tnącą.", true);
          return true;
        }
        if (isEntityLocked(hit)) {
          echoCommand("TRIM: obiekt jest na zablokowanej warstwie.", true);
          return true;
        }
        command.cutterId = hit.id;
        command.phase = "pick-target";
        setPrimarySelection(hit.id);
        queueRender();
        echoCommand("TRIM: kliknij fragment linii do odcięcia.");
        return true;
      }

      if (command.phase === "pick-target") {
        const targetId = hitTest(rawPoint) || hitTest(snappedPoint);
        const target = getEntityById(targetId);
        const cutter = getEntityById(command.cutterId);
        if (!cutter) {
          cancelActiveCommand({ echo: false });
          echoCommand("TRIM: krawędź tnąca nie istnieje.", true);
          return true;
        }
        if (!target || target.type !== "line") {
          echoCommand("TRIM: kliknij linię do przycięcia.", true);
          return true;
        }
        if (target.id === cutter.id) {
          echoCommand("TRIM: wybierz inną linię niż krawędź tnąca.", true);
          return true;
        }
        if (isEntityLocked(target)) {
          echoCommand("TRIM: linia jest na zablokowanej warstwie.", true);
          return true;
        }

        const replacement = buildTrimmedLineEntities(target, cutter, point);
        if (!replacement) {
          echoCommand("TRIM: nie znaleziono fragmentu linii do odcięcia względem tej krawędzi.", true);
          return true;
        }

        const targetIndex = state.entities.findIndex((entity) => entity.id === target.id);
        if (targetIndex === -1) {
          echoCommand("TRIM: wskazana linia nie istnieje.", true);
          return true;
        }

        saveHistory();
        state.entities.splice(targetIndex, 1, ...replacement);
        setSelection(
          replacement.map((entity) => entity.id),
          replacement[replacement.length - 1].id
        );
        markDirty();
        queueRender();
        echoCommand(
          replacement.length > 1
            ? "TRIM: linia została rozcięta. Kliknij kolejny fragment linii do odcięcia."
            : "TRIM: linia została przycięta. Kliknij kolejny fragment linii do odcięcia."
        );
        return true;
      }
    }

    if (command.name === "extend") {
      if (command.phase === "pick-cutter") {
        const hitId = hitTest(rawPoint) || hitTest(snappedPoint);
        const hit = getEntityById(hitId);
        if (!hit || !["line", "rect", "circle"].includes(hit.type)) {
          echoCommand("EXTEND: wskaż linię, prostokąt lub okrąg jako krawędź ograniczającą.", true);
          return true;
        }
        if (isEntityLocked(hit)) {
          echoCommand("EXTEND: obiekt jest na zablokowanej warstwie.", true);
          return true;
        }
        command.cutterId = hit.id;
        command.phase = "pick-target";
        setPrimarySelection(hit.id);
        queueRender();
        echoCommand("EXTEND: kliknij stronę linii do przedłużenia.");
        return true;
      }

      if (command.phase === "pick-target") {
        const targetId = hitTest(rawPoint) || hitTest(snappedPoint);
        const target = getEntityById(targetId);
        const cutter = getEntityById(command.cutterId);
        if (!cutter) {
          cancelActiveCommand({ echo: false });
          echoCommand("EXTEND: krawędź ograniczająca nie istnieje.", true);
          return true;
        }
        if (!target || target.type !== "line") {
          echoCommand("EXTEND: kliknij linię do przedłużenia.", true);
          return true;
        }
        if (target.id === cutter.id) {
          echoCommand("EXTEND: wybierz inną linię niż krawędź ograniczająca.", true);
          return true;
        }
        if (isEntityLocked(target)) {
          echoCommand("EXTEND: linia jest na zablokowanej warstwie.", true);
          return true;
        }

        const replacement = buildExtendedLineEntity(target, cutter, point);
        if (!replacement) {
          echoCommand("EXTEND: nie znaleziono przecięcia poza końcem wskazanej linii.", true);
          return true;
        }

        const targetIndex = state.entities.findIndex((entity) => entity.id === target.id);
        if (targetIndex === -1) {
          echoCommand("EXTEND: wskazana linia nie istnieje.", true);
          return true;
        }

        saveHistory();
        state.entities.splice(targetIndex, 1, replacement);
        setPrimarySelection(replacement.id);
        markDirty();
        queueRender();
        echoCommand("EXTEND: linia została przedłużona. Kliknij kolejną linię do przedłużenia.");
        return true;
      }
    }

    return false;
  }

  function setBinaryControlState(control, value) {
    if (!control) {
      return;
    }
    const next = Boolean(value);
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      control.checked = next;
      return;
    }
    control.setAttribute("aria-pressed", next ? "true" : "false");
    control.classList.toggle("active", next);
  }

  function syncModeIndicators() {
    setBinaryControlState(snapToggle, state.snap);
    setBinaryControlState(showGridToggle, state.showGrid);
    setBinaryControlState(orthoToggle, state.ortho);
  }

  function setSnapEnabled(value) {
    state.snap = Boolean(value);
    syncModeIndicators();
    markDirty();
    queueRender();
  }

  function setGridEnabled(value) {
    state.showGrid = value;
    syncModeIndicators();
    markDirty();
    queueRender();
  }

  function setOrthoEnabled(value) {
    state.ortho = value;
    syncModeIndicators();
    markDirty();
    queueRender();
  }

  function findLayerByName(name) {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return state.layers.find((layer) => layer.name.toLowerCase() === normalized) || null;
  }

  function updateFillControlsAvailability(selected) {
    const supportsFill =
      !selected ||
      selected.type === "rect" ||
      selected.type === "circle" ||
      selected.type === "fillRegion" ||
      state.tool === "paint" ||
      state.tool === "rect" ||
      state.tool === "circle";
    fillToggle.disabled = !supportsFill;
    fillColorInput.disabled = !supportsFill;
    fillAlphaInput.disabled = !supportsFill;
  }

  function getEditableSelectedFillEntities() {
    return getSelectedEntities().filter(
      (entity) =>
        (entity.type === "rect" || entity.type === "circle" || entity.type === "fillRegion") &&
        !isEntityLocked(entity)
    );
  }

  function syncShapeConfigControls() {
    if (!rectConfigWidthInput || !rectConfigHeightInput || !circleConfigRadiusInput) {
      return;
    }
    const selectedEntities = getSelectedEntities();
    const selected = selectedEntities.length === 1 ? selectedEntities[0] : null;

    const selectedRect = selected && selected.type === "rect";
    const selectedCircle = selected && selected.type === "circle";
    const contextMode = selectedRect || state.tool === "rect" ? "rect" : selectedCircle || state.tool === "circle" ? "circle" : null;

    if (shapeContextWindow) {
      shapeContextWindow.hidden = !contextMode;
    }
    if (shapeContextRectFields) {
      shapeContextRectFields.hidden = contextMode !== "rect";
    }
    if (shapeContextCircleFields) {
      shapeContextCircleFields.hidden = contextMode !== "circle";
    }
    if (shapeContextTitle) {
      shapeContextTitle.textContent =
        contextMode === "rect"
          ? t("Kontekst: Prostokąt/Kwadrat", "Context: Rectangle/Square")
          : contextMode === "circle"
            ? t("Kontekst: Okrąg", "Context: Circle")
            : t("Kontekst: figura", "Context: shape");
    }

    let rectWidth = state.rectConfigWidth;
    let rectHeight = state.rectConfigHeight;
    let circleRadius = state.circleConfigRadius;

    if (selectedRect) {
      rectWidth = Math.max(1, Math.abs(Number(selected.w) || 0));
      rectHeight = Math.max(1, Math.abs(Number(selected.h) || 0));
    }
    if (selectedCircle) {
      circleRadius = Math.max(1, Number(selected.r) || 0);
    }

    rectConfigWidthInput.value = String(Math.round(rectWidth));
    rectConfigHeightInput.value = String(Math.round(rectHeight));
    circleConfigRadiusInput.value = String(Math.round(circleRadius));

    const rectEditable = contextMode === "rect" && (state.tool === "rect" || (selectedRect && !isEntityLocked(selected)));
    const circleEditable =
      contextMode === "circle" && (state.tool === "circle" || (selectedCircle && !isEntityLocked(selected)));

    rectConfigWidthInput.disabled = !rectEditable;
    rectConfigHeightInput.disabled = !rectEditable;
    circleConfigRadiusInput.disabled = !circleEditable;
  }

  function syncControlsFromSelection() {
    syncShapeConfigControls();
    const selectedEntities = getSelectedEntities();
    if (selectedEntities.length > 1) {
      updateFillControlsAvailability(null);
      if (dimensionColorInput) {
        dimensionColorInput.value = state.dimensionColor;
      }
      selectionInfo.textContent = `${t("Zaznaczono obiekty", "Selected objects")}: ${selectedEntities.length}`;
      return;
    }

    const selected = selectedEntities[0] || null;
    if (!selected) {
      updateFillControlsAvailability(null);
      if (dimensionColorInput) {
        dimensionColorInput.value = state.dimensionColor;
      }
      if (state.lastMeasure) {
        selectionInfo.textContent =
          `${t("Ostatni pomiar", "Last measurement")}\n` +
          `${t("Start", "Start")}: (${state.lastMeasure.p1.x.toFixed(2)}, ${state.lastMeasure.p1.y.toFixed(2)})\n` +
          `${t("Koniec", "End")}: (${state.lastMeasure.p2.x.toFixed(2)}, ${state.lastMeasure.p2.y.toFixed(2)})\n` +
          `${t("Długość", "Length")}: ${state.lastMeasure.distance.toFixed(2)}\n` +
          `${t("Kąt", "Angle")}: ${state.lastMeasure.angle.toFixed(2)} ${t("stopni", "degrees")}`;
      } else {
        selectionInfo.textContent = t("Brak zaznaczonego obiektu", "No object selected");
      }
      return;
    }

    updateFillControlsAvailability(selected);

    strokeColorInput.value = selected.type === "dimension" ? state.strokeColor : selected.stroke;
    lineWidthInput.value = String(selected.lineWidth);
    lineStyleInput.value = normalizeLineStyle(selected.lineStyle);
    if (dimensionColorInput && selected.type === "dimension") {
      dimensionColorInput.value = selected.stroke || state.dimensionColor;
    }

    if (selected.type === "rect" || selected.type === "circle" || selected.type === "fillRegion") {
      fillToggle.checked = Boolean(selected.fill);
      fillColorInput.value = selected.fillColor || state.fillColor;
      fillAlphaInput.value = String(clamp(Number(selected.fillAlpha), 0, 100, 20));
    }

    const layerName = getLayerNameById(selected.layerId);

    if (selected.type === "line") {
      selectionInfo.textContent =
        `${t("Typ", "Type")}: ${t("Linia", "Line")}\n` +
        `${t("Warstwa", "Layer")}: ${layerName}\n` +
        `${t("Styl", "Style")}: ${lineStyleLabel(selected.lineStyle)}\n` +
        `${t("Początek", "Start")}: (${selected.x1.toFixed(2)}, ${selected.y1.toFixed(2)})\n` +
        `${t("Koniec", "End")}: (${selected.x2.toFixed(2)}, ${selected.y2.toFixed(2)})`;
      return;
    }

    if (selected.type === "rect") {
      selectionInfo.textContent =
        `${t("Typ", "Type")}: ${t("Prostokąt", "Rectangle")}\n` +
        `${t("Warstwa", "Layer")}: ${layerName}\n` +
        `${t("Styl", "Style")}: ${lineStyleLabel(selected.lineStyle)}\n` +
        `${t("Początek", "Start")}: (${selected.x.toFixed(2)}, ${selected.y.toFixed(2)})\n` +
        `${t("Szerokość", "Width")}: ${selected.w.toFixed(2)}\n` +
        `${t("Wysokość", "Height")}: ${selected.h.toFixed(2)}\n` +
        `${t("Wypełnienie", "Fill")}: ${selected.fill ? t("tak", "yes") : t("nie", "no")}`;
      return;
    }

    if (selected.type === "circle") {
      selectionInfo.textContent =
        `${t("Typ", "Type")}: ${t("Okrąg", "Circle")}\n` +
        `${t("Warstwa", "Layer")}: ${layerName}\n` +
        `${t("Styl", "Style")}: ${lineStyleLabel(selected.lineStyle)}\n` +
        `${t("Środek", "Center")}: (${selected.cx.toFixed(2)}, ${selected.cy.toFixed(2)})\n` +
        `${t("Promień", "Radius")}: ${selected.r.toFixed(2)}\n` +
        `${t("Wypełnienie", "Fill")}: ${selected.fill ? t("tak", "yes") : t("nie", "no")}`;
      return;
    }

    if (selected.type === "fillRegion") {
      selectionInfo.textContent =
        `${t("Typ", "Type")}: ${t("Wypełnienie", "Fill region")}\n` +
        `${t("Warstwa", "Layer")}: ${layerName}\n` +
        `${t("Punkty", "Points")}: ${selected.points.length}\n` +
        `${t("Wypełnienie", "Fill")}: ${t("tak", "yes")}`;
      return;
    }

    if (selected.type === "dimension") {
      const geometry = getDimensionGeometry(selected);
      const distance = geometry ? geometry.length : Math.hypot(selected.x2 - selected.x1, selected.y2 - selected.y1);
      const rotationInfo =
        normalizeDimensionMode(selected.mode) === "rotated"
          ? `\n${t("Kąt", "Angle")}: ${normalizeAngleDegrees(selected.rotation).toFixed(1)}°`
          : "";
      const angularInfo =
        geometry && geometry.kind === "angular"
          ? `\n${t("Wierzchołek", "Vertex")}: (${selected.x1.toFixed(2)}, ${selected.y1.toFixed(2)})\n` +
            `${t("Ramię", "Arm")} 1: (${selected.x2.toFixed(2)}, ${selected.y2.toFixed(2)})\n` +
            `${t("Ramię", "Arm")} 2: (${Number(selected.x3 || 0).toFixed(2)}, ${Number(selected.y3 || 0).toFixed(2)})`
          : `\n${t("Start", "Start")}: (${selected.x1.toFixed(2)}, ${selected.y1.toFixed(2)})\n` +
            `${t("Koniec", "End")}: (${selected.x2.toFixed(2)}, ${selected.y2.toFixed(2)})`;
      const valueLabel =
        geometry && geometry.kind === "angular"
          ? formatDimensionAngle(distance, selected.decimals)
          : formatDimensionDistance(distance, selected.unit || "mm", selected.decimals);
      selectionInfo.textContent =
        `${t("Typ", "Type")}: ${t("Wymiar", "Dimension")}\n` +
        `${t("Tryb", "Mode")}: ${dimensionModeLabel(selected.mode)}\n` +
        `${t("Warstwa", "Layer")}: ${layerName}\n` +
        `${t("Styl", "Style")}: ${lineStyleLabel(selected.lineStyle)}\n` +
        angularInfo +
        `\n${t("Wartość", "Value")}: ${valueLabel}` +
        rotationInfo;
      return;
    }

    selectionInfo.textContent = t("Nieznany obiekt", "Unknown object");
  }

  function resizeCanvas(options) {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const allowRetry = !options || options.allowRetry !== false;
    let width = Math.floor(canvas.clientWidth);
    let height = Math.floor(canvas.clientHeight);

    if (width < 2 || height < 2) {
      if (lastCanvasClientWidth >= 2 && lastCanvasClientHeight >= 2) {
        width = lastCanvasClientWidth;
        height = lastCanvasClientHeight;
      } else {
        if (allowRetry && !canvasResizeRetryFrame) {
          canvasResizeRetryFrame = requestAnimationFrame(() => {
            canvasResizeRetryFrame = 0;
            resizeCanvas({ allowRetry: false });
          });
        }
        return;
      }
    } else {
      lastCanvasClientWidth = width;
      lastCanvasClientHeight = height;
    }

    const targetWidth = Math.max(2, Math.floor(width * ratio));
    const targetHeight = Math.max(2, Math.floor(height * ratio));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    queueRender();
  }

  function getCanvasSize() {
    return {
      width: Math.max(2, Math.floor(canvas.clientWidth || lastCanvasClientWidth || 0)),
      height: Math.max(2, Math.floor(canvas.clientHeight || lastCanvasClientHeight || 0))
    };
  }

  function initializeLayoutObservers() {
    if (typeof ResizeObserver !== "function") {
      return;
    }
    if (layoutResizeObserver) {
      layoutResizeObserver.disconnect();
    }
    layoutResizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      updateToastAnchor();
    });
    [workspaceEl, canvasWrap, cadHeader].forEach((element) => {
      if (element) {
        layoutResizeObserver.observe(element);
      }
    });
  }

  function drawGrid() {
    const { width, height } = getCanvasSize();
    ctx.save();
    const canvasBg = cssColor("--canvas-bg", "#0e1116");
    const gridColor = cssColor("--grid", "#1f2630");
    const axisXColor = cssColor("--axis-x", "#d97706");
    const axisYColor = cssColor("--axis-y", "#16a34a");
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, width, height);

    if (state.showGrid) {
      let spacing = Math.max(1, state.gridSize);
      while (spacing * state.view.scale < 18) {
        spacing *= 2;
      }

      const topLeft = screenToWorld({ x: 0, y: 0 });
      const bottomRight = screenToWorld({ x: width, y: height });

      const minX = Math.floor(topLeft.x / spacing) * spacing;
      const maxX = Math.ceil(bottomRight.x / spacing) * spacing;
      const minY = Math.floor(topLeft.y / spacing) * spacing;
      const maxY = Math.ceil(bottomRight.y / spacing) * spacing;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      for (let x = minX; x <= maxX; x += spacing) {
        const sx = worldToScreen({ x, y: 0 }).x;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
        ctx.stroke();
      }

      for (let y = minY; y <= maxY; y += spacing) {
        const sy = worldToScreen({ x: 0, y }).y;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
        ctx.stroke();
      }
    }

    const xAxis = worldToScreen({ x: 0, y: 0 }).y;
    const yAxis = worldToScreen({ x: 0, y: 0 }).x;

    ctx.strokeStyle = axisXColor;
    ctx.beginPath();
    ctx.moveTo(0, xAxis);
    ctx.lineTo(width, xAxis);
    ctx.stroke();

    ctx.strokeStyle = axisYColor;
    ctx.beginPath();
    ctx.moveTo(yAxis, 0);
    ctx.lineTo(yAxis, height);
    ctx.stroke();

    ctx.restore();
  }

  function getDashForStyle(style) {
    if (style === "dashed") {
      return [12, 8];
    }
    if (style === "dotted") {
      return [2, 7];
    }
    return [];
  }

  function hexToRgba(hex, alphaPercent) {
    const normalized = hex.replace("#", "");
    if (normalized.length !== 6) {
      return `rgba(0, 169, 224, ${clamp(alphaPercent / 100, 0, 1, 0.2)})`;
    }
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const alpha = clamp(alphaPercent / 100, 0, 1, 0.2);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawLine(entity, isSelected, asPreview) {
    const start = worldToScreen({ x: entity.x1, y: entity.y1 });
    const end = worldToScreen({ x: entity.x2, y: entity.y2 });
    const previewColor = cssColor("--preview", "#00d2ff");
    ctx.save();
    ctx.strokeStyle = asPreview ? previewColor : entity.stroke;
    ctx.lineWidth = entity.lineWidth;
    ctx.setLineDash(asPreview ? [8, 6] : getDashForStyle(entity.lineStyle));
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    if (isSelected) {
      drawSelectionBox(entity);
    }
    ctx.restore();
  }

  function drawDimension(entity, isSelected, asPreview) {
    const geometry = getDimensionGeometry(entity);
    if (!geometry) {
      return;
    }

    const previewColor = cssColor("--preview", "#00d2ff");
    const color = asPreview ? previewColor : entity.stroke;
    const label = formatDimensionLabel(entity, geometry);

    const drawArrow = (tipX, tipY, dirX, dirY, size) => {
      const bx = tipX + dirX * size;
      const by = tipY + dirY * size;
      const px = -dirY;
      const py = dirX;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(bx + px * (size * 0.45), by + py * (size * 0.45));
      ctx.lineTo(bx - px * (size * 0.45), by - py * (size * 0.45));
      ctx.closePath();
      ctx.fill();
    };

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, entity.lineWidth || 1);
    ctx.setLineDash(asPreview ? [8, 6] : getDashForStyle(entity.lineStyle));

    if (geometry.kind === "angular") {
      const vertex = worldToScreen(geometry.vertex);
      const dimStart = worldToScreen(geometry.d1);
      const dimEnd = worldToScreen(geometry.d2);
      const textPoint = worldToScreen(geometry.text);
      const arcPoints = getAngularArcPolyline(geometry, 88).map(worldToScreen);

      ctx.beginPath();
      ctx.moveTo(vertex.x, vertex.y);
      ctx.lineTo(dimStart.x, dimStart.y);
      ctx.moveTo(vertex.x, vertex.y);
      ctx.lineTo(dimEnd.x, dimEnd.y);
      if (arcPoints.length > 1) {
        ctx.moveTo(arcPoints[0].x, arcPoints[0].y);
        for (let i = 1; i < arcPoints.length; i += 1) {
          ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
        }
      }
      ctx.stroke();

      ctx.setLineDash([]);
      drawArrow(dimStart.x, dimStart.y, geometry.tangentStart.x, geometry.tangentStart.y, 9);
      drawArrow(dimEnd.x, dimEnd.y, -geometry.tangentEnd.x, -geometry.tangentEnd.y, 9);

      const textSize = Math.max(10, entity.textSize || 12);
      ctx.font = `${textSize}px Segoe UI, sans-serif`;
      const paddingX = 5;
      const paddingY = 3;
      const textWidth = ctx.measureText(label).width;
      const rectW = textWidth + paddingX * 2;
      const rectH = Math.max(16, textSize + paddingY * 2);
      const textAngleRaw = geometry.midAngle + Math.PI / 2;
      const textAngle =
        textAngleRaw > Math.PI / 2 || textAngleRaw < -Math.PI / 2 ? textAngleRaw + Math.PI : textAngleRaw;
      ctx.save();
      ctx.translate(textPoint.x, textPoint.y);
      ctx.rotate(textAngle);
      ctx.fillStyle = asPreview ? "rgba(15, 26, 40, 0.72)" : "rgba(14, 24, 38, 0.84)";
      ctx.fillRect(-rectW / 2, -rectH / 2, rectW, rectH);
      ctx.strokeStyle = color;
      ctx.strokeRect(-rectW / 2, -rectH / 2, rectW, rectH);
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 0.5);
      ctx.restore();
    } else {
      const start = worldToScreen({ x: geometry.x1, y: geometry.y1 });
      const end = worldToScreen({ x: geometry.x2, y: geometry.y2 });
      const dimStart = worldToScreen(geometry.d1);
      const dimEnd = worldToScreen(geometry.d2);
      const textPoint = worldToScreen(geometry.text);
      const dx = dimEnd.x - dimStart.x;
      const dy = dimEnd.y - dimStart.y;
      const length = Math.hypot(dx, dy);
      if (length < 1) {
        ctx.restore();
        return;
      }

      const ux = dx / length;
      const uy = dy / length;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(dimStart.x, dimStart.y);
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(dimEnd.x, dimEnd.y);
      ctx.moveTo(dimStart.x, dimStart.y);
      ctx.lineTo(dimEnd.x, dimEnd.y);
      ctx.stroke();

      if (asPreview) {
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      drawArrow(dimStart.x, dimStart.y, ux, uy, 9);
      drawArrow(dimEnd.x, dimEnd.y, -ux, -uy, 9);

      const textX = textPoint.x;
      const textY = textPoint.y;
      const textSize = Math.max(10, entity.textSize || 12);
      ctx.font = `${textSize}px Segoe UI, sans-serif`;
      const paddingX = 5;
      const paddingY = 3;
      const textWidth = ctx.measureText(label).width;
      const rectW = textWidth + paddingX * 2;
      const rectH = Math.max(16, textSize + paddingY * 2);
      const textAngleRaw = Math.atan2(dimEnd.y - dimStart.y, dimEnd.x - dimStart.x);
      const textAngle =
        textAngleRaw > Math.PI / 2 || textAngleRaw < -Math.PI / 2 ? textAngleRaw + Math.PI : textAngleRaw;
      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(textAngle);
      ctx.fillStyle = asPreview ? "rgba(15, 26, 40, 0.72)" : "rgba(14, 24, 38, 0.84)";
      ctx.fillRect(-rectW / 2, -rectH / 2, rectW, rectH);
      ctx.strokeStyle = color;
      ctx.strokeRect(-rectW / 2, -rectH / 2, rectW, rectH);
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 0.5);
      ctx.restore();
    }

    if (isSelected) {
      drawSelectionBox(entity);
    }
    ctx.restore();
  }

  function drawRect(entity, isSelected, asPreview) {
    const topLeft = worldToScreen({ x: entity.x, y: entity.y });
    const previewColor = cssColor("--preview", "#00d2ff");
    ctx.save();
    ctx.strokeStyle = asPreview ? previewColor : entity.stroke;
    ctx.lineWidth = entity.lineWidth;
    ctx.setLineDash(asPreview ? [8, 6] : getDashForStyle(entity.lineStyle));

    if (!asPreview && entity.fill) {
      ctx.fillStyle = hexToRgba(entity.fillColor || "#00a9e0", entity.fillAlpha ?? 20);
      ctx.fillRect(
        topLeft.x,
        topLeft.y,
        entity.w * state.view.scale,
        entity.h * state.view.scale
      );
    }

    ctx.strokeRect(
      topLeft.x,
      topLeft.y,
      entity.w * state.view.scale,
      entity.h * state.view.scale
    );

    if (isSelected) {
      drawSelectionBox(entity);
    }
    ctx.restore();
  }

  function drawCircle(entity, isSelected, asPreview) {
    const center = worldToScreen({ x: entity.cx, y: entity.cy });
    const previewColor = cssColor("--preview", "#00d2ff");
    ctx.save();
    ctx.strokeStyle = asPreview ? previewColor : entity.stroke;
    ctx.lineWidth = entity.lineWidth;
    ctx.setLineDash(asPreview ? [8, 6] : getDashForStyle(entity.lineStyle));

    if (!asPreview && entity.fill) {
      ctx.fillStyle = hexToRgba(entity.fillColor || "#00a9e0", entity.fillAlpha ?? 20);
      ctx.beginPath();
      ctx.arc(center.x, center.y, entity.r * state.view.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(center.x, center.y, entity.r * state.view.scale, 0, Math.PI * 2);
    ctx.stroke();
    if (isSelected) {
      drawSelectionBox(entity);
    }
    ctx.restore();
  }

  function drawFillRegion(entity, isSelected) {
    if (!Array.isArray(entity.points) || entity.points.length < 3) {
      return;
    }
    ctx.save();
    ctx.beginPath();
    entity.points.forEach((point, index) => {
      const p = worldToScreen(point);
      if (index === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = hexToRgba(entity.fillColor || "#00a9e0", entity.fillAlpha ?? 20);
    ctx.fill();
    if (isSelected) {
      drawSelectionBox(entity);
    }
    ctx.restore();
  }

  function getEntityBounds(entity) {
    if (entity.type === "line") {
      return {
        minX: Math.min(entity.x1, entity.x2),
        maxX: Math.max(entity.x1, entity.x2),
        minY: Math.min(entity.y1, entity.y2),
        maxY: Math.max(entity.y1, entity.y2)
      };
    }
    if (entity.type === "dimension") {
      const geometry = getDimensionGeometry(entity);
      if (!geometry) {
        return null;
      }
      const textSize = Math.max(10, Number(entity.textSize) || 12);
      const label = formatDimensionLabel(entity, geometry);
      const textHalfW = Math.max(18, label.length * textSize * 0.33);
      const textHalfH = Math.max(10, textSize * 0.6);
      const pad = 4;
      if (geometry.kind === "angular") {
        const points = [
          geometry.vertex,
          { x: geometry.x2, y: geometry.y2 },
          { x: geometry.x3, y: geometry.y3 },
          geometry.d1,
          geometry.d2,
          geometry.text
        ];
        const checkpoints = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        checkpoints.forEach((angle) => {
          if (isAngleOnForwardPath(angle, geometry.startAngle, geometry.endAngle)) {
            points.push({
              x: geometry.vertex.x + Math.cos(angle) * geometry.radius,
              y: geometry.vertex.y + Math.sin(angle) * geometry.radius
            });
          }
        });
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        points.forEach((point) => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
        return {
          minX: Math.min(minX, geometry.text.x - textHalfW) - pad,
          maxX: Math.max(maxX, geometry.text.x + textHalfW) + pad,
          minY: Math.min(minY, geometry.text.y - textHalfH) - pad,
          maxY: Math.max(maxY, geometry.text.y + textHalfH) + pad
        };
      }
      return {
        minX:
          Math.min(geometry.x1, geometry.x2, geometry.d1.x, geometry.d2.x, geometry.text.x - textHalfW) - pad,
        maxX:
          Math.max(geometry.x1, geometry.x2, geometry.d1.x, geometry.d2.x, geometry.text.x + textHalfW) + pad,
        minY:
          Math.min(geometry.y1, geometry.y2, geometry.d1.y, geometry.d2.y, geometry.text.y - textHalfH) - pad,
        maxY:
          Math.max(geometry.y1, geometry.y2, geometry.d1.y, geometry.d2.y, geometry.text.y + textHalfH) + pad
      };
    }
    if (entity.type === "rect") {
      return {
        minX: Math.min(entity.x, entity.x + entity.w),
        maxX: Math.max(entity.x, entity.x + entity.w),
        minY: Math.min(entity.y, entity.y + entity.h),
        maxY: Math.max(entity.y, entity.y + entity.h)
      };
    }
    if (entity.type === "circle") {
      return {
        minX: entity.cx - entity.r,
        maxX: entity.cx + entity.r,
        minY: entity.cy - entity.r,
        maxY: entity.cy + entity.r
      };
    }
    if (entity.type === "fillRegion") {
      if (!Array.isArray(entity.points) || entity.points.length < 3) {
        return null;
      }
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      entity.points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
      return { minX, minY, maxX, maxY };
    }
    return null;
  }

  function drawSelectionBox(entity) {
    const bounds = getEntityBounds(entity);
    if (!bounds) {
      return;
    }
    const topLeft = worldToScreen({ x: bounds.minX, y: bounds.minY });
    const bottomRight = worldToScreen({ x: bounds.maxX, y: bounds.maxY });
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;

    const selectionColor = cssColor("--selection", "#00b5ff");
    ctx.save();
    ctx.strokeStyle = selectionColor;
    ctx.fillStyle = selectionColor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(topLeft.x - 4, topLeft.y - 4, width + 8, height + 8);
    ctx.setLineDash([]);
    const handle = 6;
    ctx.fillRect(topLeft.x - handle / 2, topLeft.y - handle / 2, handle, handle);
    ctx.fillRect(bottomRight.x - handle / 2, topLeft.y - handle / 2, handle, handle);
    ctx.fillRect(topLeft.x - handle / 2, bottomRight.y - handle / 2, handle, handle);
    ctx.fillRect(bottomRight.x - handle / 2, bottomRight.y - handle / 2, handle, handle);
    ctx.restore();
  }

  function drawSelectionWindow() {
    if (!state.selectingBox || !state.selectionBoxStart || !state.selectionBoxEnd) {
      return;
    }
    const a = worldToScreen(state.selectionBoxStart);
    const b = worldToScreen(state.selectionBoxEnd);
    const movedPx = Math.hypot(b.x - a.x, b.y - a.y);
    if (movedPx < POINTER_DRAG_THRESHOLD_PX) {
      return;
    }
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    const crossing = b.x < a.x;
    const selectionColor = crossing ? "#7bd74e" : cssColor("--selection", "#00b5ff");

    ctx.save();
    ctx.fillStyle = selectionColor + "22";
    ctx.strokeStyle = selectionColor;
    ctx.setLineDash([6, 5]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function drawCrosshair() {
    const { width, height } = getCanvasSize();
    const pointer = worldToScreen(state.pointerRawWorld);
    const crosshairColor = cssColor("--crosshair", "#2c3d4f");

    ctx.save();
    ctx.strokeStyle = crosshairColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(pointer.x, 0);
    ctx.lineTo(pointer.x, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pointer.y);
    ctx.lineTo(width, pointer.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawSnapIndicator() {
    if (!state.snap) {
      return;
    }

    const raw = state.pointerRawWorld;
    const snapped = state.pointerWorld;
    const dxWorld = snapped.x - raw.x;
    const dyWorld = snapped.y - raw.y;
    const worldDist = Math.hypot(dxWorld, dyWorld);
    const hasSnapTarget = worldDist > 0.000001;
    if (!hasSnapTarget) {
      return;
    }

    const marker = worldToScreen(snapped);
    const modeLabel = "SNAP";
    const color = cssColor("--preview", "#00d2ff");

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([]);

    const radius = 5;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(marker.x - 8, marker.y);
    ctx.lineTo(marker.x + 8, marker.y);
    ctx.moveTo(marker.x, marker.y - 8);
    ctx.lineTo(marker.x, marker.y + 8);
    ctx.stroke();

    ctx.font = "11px Segoe UI, sans-serif";
    const labelW = ctx.measureText(modeLabel).width + 8;
    const labelH = 16;

    const { width: canvasW, height: canvasH } = getCanvasSize();
    const snapCandidates = [
      { x: marker.x + 10, y: marker.y - 22 },
      { x: marker.x + 10, y: marker.y + 10 },
      { x: marker.x - labelW - 10, y: marker.y - 22 },
      { x: marker.x - labelW - 10, y: marker.y + 10 }
    ];

    let measureLabelBounds = null;
    if (state.tool === "measure" && state.drawStart && state.previewPoint) {
      const measureEnd = worldToScreen(state.previewPoint);
      const measureText = `D: ${Math.hypot(state.previewPoint.x - state.drawStart.x, state.previewPoint.y - state.drawStart.y).toFixed(2)} | Kąt: ${
        ((Math.atan2(state.previewPoint.y - state.drawStart.y, state.previewPoint.x - state.drawStart.x) * 180) / Math.PI).toFixed(2)
      }°`;
      ctx.save();
      ctx.font = "12px Rajdhani, sans-serif";
      const measureW = ctx.measureText(measureText).width;
      ctx.restore();
      measureLabelBounds = {
        x: measureEnd.x + 10,
        y: measureEnd.y - 20,
        w: measureW,
        h: 16
      };
    }

    const overlaps = (a, b) => {
      if (!a || !b) {
        return false;
      }
      return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    };

    let labelX = snapCandidates[0].x;
    let labelY = snapCandidates[0].y;
    for (const candidate of snapCandidates) {
      const rect = { x: candidate.x, y: candidate.y, w: labelW, h: labelH };
      const insideCanvas =
        rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= canvasW && rect.y + rect.h <= canvasH;
      if (insideCanvas && !overlaps(rect, measureLabelBounds)) {
        labelX = candidate.x;
        labelY = candidate.y;
        break;
      }
    }

    ctx.fillStyle = "rgba(10, 16, 24, 0.82)";
    ctx.fillRect(labelX, labelY, labelW, labelH);
    ctx.strokeStyle = color;
    ctx.strokeRect(labelX, labelY, labelW, labelH);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(modeLabel, labelX + 4, labelY + labelH / 2);
    ctx.restore();
  }

  function drawMeasureOverlay(start, end) {
    const a = worldToScreen(start);
    const b = worldToScreen(end);
    const previewColor = cssColor("--preview", "#00d2ff");
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;

    ctx.save();
    ctx.strokeStyle = previewColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = previewColor;
    ctx.font = "12px Rajdhani, sans-serif";
    ctx.fillText(`D: ${distance.toFixed(2)} | Kąt: ${angle.toFixed(2)}°`, b.x + 10, b.y - 8);
    ctx.restore();
  }

  function drawPreviewEntity() {
    if (state.polylineAnchor && state.previewPoint) {
      drawLine(
        {
          type: "line",
          x1: state.polylineAnchor.x,
          y1: state.polylineAnchor.y,
          x2: state.previewPoint.x,
          y2: state.previewPoint.y,
          stroke: state.strokeColor,
          lineWidth: state.lineWidth,
          lineStyle: state.lineStyle
        },
        false,
        true
      );
      return;
    }

    if (!state.drawStart || !state.previewPoint) {
      return;
    }

    if (state.tool === "measure") {
      drawMeasureOverlay(state.drawStart, state.previewPoint);
      return;
    }

    const stroke = state.tool === "dimension" ? state.dimensionColor : state.strokeColor;
    const lineWidth = state.lineWidth;
    const lineStyle = state.lineStyle;
    if (state.tool === "line") {
      drawLine(
        {
          type: "line",
          x1: state.drawStart.x,
          y1: state.drawStart.y,
          x2: state.previewPoint.x,
          y2: state.previewPoint.y,
          stroke,
          lineWidth,
          lineStyle
        },
        false,
        true
      );
    } else if (state.tool === "dimension") {
      const dimensionMode = normalizeDimensionMode(state.dimensionMode);
      if (dimensionMode === "angular") {
        if (!state.dimensionSecond) {
          drawLine(
            {
              type: "line",
              x1: state.drawStart.x,
              y1: state.drawStart.y,
              x2: state.previewPoint.x,
              y2: state.previewPoint.y,
              stroke,
              lineWidth,
              lineStyle
            },
            false,
            true
          );
        } else if (!state.dimensionThird) {
          drawLine(
            {
              type: "line",
              x1: state.drawStart.x,
              y1: state.drawStart.y,
              x2: state.dimensionSecond.x,
              y2: state.dimensionSecond.y,
              stroke,
              lineWidth,
              lineStyle
            },
            false,
            true
          );
          drawLine(
            {
              type: "line",
              x1: state.drawStart.x,
              y1: state.drawStart.y,
              x2: state.previewPoint.x,
              y2: state.previewPoint.y,
              stroke,
              lineWidth,
              lineStyle
            },
            false,
            true
          );
        } else {
          const previewEntity = {
            type: "dimension",
            x1: state.drawStart.x,
            y1: state.drawStart.y,
            x2: state.dimensionSecond.x,
            y2: state.dimensionSecond.y,
            x3: state.dimensionThird.x,
            y3: state.dimensionThird.y,
            dimX: state.previewPoint.x,
            dimY: state.previewPoint.y,
            offset: null,
            mode: "angular",
            rotation: 0,
            stroke,
            lineWidth,
            lineStyle,
            textSize: state.dimensionTextSize,
            unit: state.dimensionUnit,
            decimals: state.dimensionDecimals
          };
          drawDimension(previewEntity, false, true);
        }
      } else if (!state.dimensionSecond) {
        drawLine(
          {
            type: "line",
            x1: state.drawStart.x,
            y1: state.drawStart.y,
            x2: state.previewPoint.x,
            y2: state.previewPoint.y,
            stroke,
            lineWidth,
            lineStyle
          },
          false,
          true
        );
      } else {
        const previewEntity = {
          type: "dimension",
          x1: state.drawStart.x,
          y1: state.drawStart.y,
          x2: state.dimensionSecond.x,
          y2: state.dimensionSecond.y,
          dimX: state.previewPoint.x,
          dimY: state.previewPoint.y,
          offset: null,
          mode: normalizeDimensionMode(state.dimensionMode),
          rotation: normalizeAngleDegrees(state.dimensionRotation),
          stroke,
          lineWidth,
          lineStyle,
          textSize: state.dimensionTextSize,
          unit: state.dimensionUnit,
          decimals: state.dimensionDecimals
        };
        drawDimension(previewEntity, false, true);
      }
    } else if (state.tool === "rect") {
      drawRect(
        {
          type: "rect",
          x: state.drawStart.x,
          y: state.drawStart.y,
          w: state.previewPoint.x - state.drawStart.x,
          h: state.previewPoint.y - state.drawStart.y,
          stroke,
          lineWidth,
          lineStyle,
          fill: state.fillEnabled,
          fillColor: state.fillColor,
          fillAlpha: state.fillAlpha
        },
        false,
        true
      );
    } else if (state.tool === "circle") {
      const radius = Math.hypot(
        state.previewPoint.x - state.drawStart.x,
        state.previewPoint.y - state.drawStart.y
      );
      drawCircle(
        {
          type: "circle",
          cx: state.drawStart.x,
          cy: state.drawStart.y,
          r: radius,
          stroke,
          lineWidth,
          lineStyle,
          fill: state.fillEnabled,
          fillColor: state.fillColor,
          fillAlpha: state.fillAlpha
        },
        false,
        true
      );
    }
  }

  function renderLayerPanel() {
    const counts = new Map();
    for (const entity of state.entities) {
      counts.set(entity.layerId, (counts.get(entity.layerId) || 0) + 1);
    }

    const verboseLayerOptions = state.layers
      .map((layer) => {
        const suffix = [layer.locked ? t("zabl.", "locked") : "", !layer.visible ? t("ukryta", "hidden") : ""]
          .filter(Boolean)
          .join(", ");
        return `<option value="${layer.id}">${escapeHtml(layer.name)}${
          suffix ? ` (${suffix})` : ""
        }</option>`;
      })
      .join("");
    const compactLayerOptions = state.layers
      .map((layer) => `<option value="${layer.id}">${escapeHtml(layer.name)}</option>`)
      .join("");
    if (activeLayerSelect) {
      activeLayerSelect.innerHTML = verboseLayerOptions;
      activeLayerSelect.value = state.activeLayerId;
    }
    if (bottomLayerSelect) {
      bottomLayerSelect.innerHTML = compactLayerOptions;
      bottomLayerSelect.value = state.activeLayerId;
    }

    layerList.innerHTML = state.layers
      .map((layer) => {
        const itemCount = counts.get(layer.id) || 0;
        return `
          <div class="layer-item ${layer.id === state.activeLayerId ? "layer-active" : ""}" data-layer-id="${
            layer.id
          }">
            <div class="layer-item-head">
              <span class="layer-item-name">${escapeHtml(layer.name)}</span>
              <span class="layer-pill">${itemCount} ${t("ob.", "obj.")}</span>
            </div>
            <div class="layer-item-meta">
              <label class="layer-toggle">
                <input class="layer-visible" type="checkbox" data-layer-id="${layer.id}" ${
                  layer.visible ? "checked" : ""
                } title="${t("Pokazuje lub ukrywa warstwę.", "Shows or hides the layer.")}" />
                ${t("widoczna", "visible")}
              </label>
              <label class="layer-toggle">
                <input class="layer-locked" type="checkbox" data-layer-id="${layer.id}" ${
                  layer.locked ? "checked" : ""
                } title="${t("Blokuje edycję obiektów na warstwie.", "Locks editing of objects on this layer.")}" />
                ${t("zablokowana", "locked")}
              </label>
            </div>
            <div class="layer-actions">
              <button class="layer-set-active has-icon" data-icon="&#9989;" data-layer-id="${layer.id}" title="${t(
                "Ustawia tę warstwę jako aktywną.",
                "Sets this layer as active."
              )}">${t("Aktywna", "Active")}</button>
              <button class="layer-move-selection has-icon" data-icon="&#8645;" data-layer-id="${layer.id}" title="${t(
                "Przenosi zaznaczone obiekty na tę warstwę.",
                "Moves selected objects to this layer."
              )}">${t("Przenieś zazn.", "Move sel.")}</button>
              <button class="layer-delete has-icon" data-icon="&#128465;" data-layer-id="${layer.id}" ${
                state.layers.length <= 1 ? "disabled" : ""
              } title="${t(
                "Usuwa warstwę i przenosi obiekty do aktywnej warstwy.",
                "Deletes the layer and moves objects to the active layer."
              )}">${t("Usuń", "Delete")}</button>
            </div>
          </div>
        `;
      })
      .join("");
    refreshSvgIcons(layerList);
  }

  function render() {
    ensureValidViewState();
    drawGrid();

    for (const entity of state.entities) {
      if (!isEntityVisible(entity) || entity.type !== "fillRegion") {
        continue;
      }
      const selected = isEntitySelected(entity.id);
      drawFillRegion(entity, selected);
    }

    for (const entity of state.entities) {
      if (!isEntityVisible(entity) || entity.type === "fillRegion") {
        continue;
      }
      const selected = isEntitySelected(entity.id);
      if (entity.type === "line") {
        drawLine(entity, selected, false);
      } else if (entity.type === "dimension") {
        drawDimension(entity, selected, false);
      } else if (entity.type === "rect") {
        drawRect(entity, selected, false);
      } else if (entity.type === "circle") {
        drawCircle(entity, selected, false);
      }
    }

    drawPreviewEntity();
    drawSelectionWindow();
    drawCrosshair();
    drawSnapIndicator();
    renderLayerPanel();
    updateStatus();
    syncActionButtonsState();
    syncControlsFromSelection();
  }

  function distanceToSegment(point, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = point.x - a.x;
    const wy = point.y - a.y;
    const vv = vx * vx + vy * vy;
    if (vv === 0) {
      return Math.hypot(point.x - a.x, point.y - a.y);
    }
    let t = (wx * vx + wy * vy) / vv;
    t = Math.max(0, Math.min(1, t));
    const proj = {
      x: a.x + t * vx,
      y: a.y + t * vy
    };
    return Math.hypot(point.x - proj.x, point.y - proj.y);
  }

  function pointInRect(point, bounds) {
    return (
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY
    );
  }

  function pointInPolygon(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return false;
    }
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i];
      const b = polygon[j];
      if (distanceToSegment(point, a, b) <= 0.001) {
        return true;
      }
      const intersects =
        (a.y > point.y) !== (b.y > point.y) &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
      if (intersects) {
        inside = !inside;
      }
    }
    return inside;
  }

  function polygonAreaAbs(points) {
    if (!Array.isArray(points) || points.length < 3) {
      return 0;
    }
    let area2 = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area2 += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area2 / 2);
  }

  function findClosedLineLoopAtPoint(point) {
    const tolerance = Math.max(0.001, 1 / Math.max(1, state.view.scale));
    const quantize = (value) => Math.round(value / tolerance);
    const keyForPoint = (p) => `${quantize(p.x)}:${quantize(p.y)}`;

    const nodes = new Map();
    const adjacency = new Map();

    function ensureNode(pointValue) {
      const key = keyForPoint(pointValue);
      if (!nodes.has(key)) {
        nodes.set(key, { key, point: { x: pointValue.x, y: pointValue.y } });
        adjacency.set(key, []);
      }
      return key;
    }

    for (const entity of state.entities) {
      if (!entity || entity.type !== "line" || !isEntityVisible(entity)) {
        continue;
      }
      const a = { x: Number(entity.x1) || 0, y: Number(entity.y1) || 0 };
      const b = { x: Number(entity.x2) || 0, y: Number(entity.y2) || 0 };
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len <= 0.001) {
        continue;
      }
      const aKey = ensureNode(a);
      const bKey = ensureNode(b);
      adjacency.get(aKey).push(bKey);
      adjacency.get(bKey).push(aKey);
    }

    const visitedNodes = new Set();
    const candidates = [];

    for (const [startKey] of nodes) {
      if (visitedNodes.has(startKey)) {
        continue;
      }
      const stack = [startKey];
      const component = [];
      visitedNodes.add(startKey);
      while (stack.length > 0) {
        const current = stack.pop();
        component.push(current);
        const neighbors = adjacency.get(current) || [];
        neighbors.forEach((nextKey) => {
          if (!visitedNodes.has(nextKey)) {
            visitedNodes.add(nextKey);
            stack.push(nextKey);
          }
        });
      }

      if (component.length < 3) {
        continue;
      }
      const allDegreeTwo = component.every((key) => (adjacency.get(key) || []).length === 2);
      if (!allDegreeTwo) {
        continue;
      }

      const cycle = [];
      let current = component[0];
      let previous = null;
      const maxSteps = component.length + 2;

      for (let step = 0; step < maxSteps; step += 1) {
        const node = nodes.get(current);
        if (!node) {
          break;
        }
        cycle.push({ x: node.point.x, y: node.point.y });
        const neighbors = adjacency.get(current) || [];
        const next = neighbors.find((key) => key !== previous);
        if (!next) {
          break;
        }
        previous = current;
        current = next;
        if (current === component[0]) {
          break;
        }
      }

      if (current !== component[0] || cycle.length < 3) {
        continue;
      }
      const area = polygonAreaAbs(cycle);
      if (area < 0.5) {
        continue;
      }
      if (pointInPolygon(point, cycle)) {
        candidates.push({ points: cycle, area });
      }
    }

    if (candidates.length === 0) {
      return null;
    }
    candidates.sort((a, b) => a.area - b.area);
    return candidates[0].points;
  }

  function boundsIntersect(a, b) {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
  }

  function hitTest(worldPoint) {
    const threshold = 12 / state.view.scale;
    let best = null;

    function pickCandidate(entity, priority, distance, zIndex) {
      if (!entity) {
        return;
      }
      const candidate = {
        id: entity.id,
        priority,
        distance,
        zIndex
      };
      if (!best) {
        best = candidate;
        return;
      }
      if (candidate.priority < best.priority) {
        best = candidate;
        return;
      }
      if (candidate.priority === best.priority) {
        if (candidate.distance < best.distance - 0.0001) {
          best = candidate;
          return;
        }
        if (Math.abs(candidate.distance - best.distance) <= 0.0001 && candidate.zIndex > best.zIndex) {
          best = candidate;
        }
      }
    }

    for (let i = state.entities.length - 1; i >= 0; i -= 1) {
      const entity = state.entities[i];
      if (!isEntityVisible(entity)) {
        continue;
      }
      if (entity.type === "line") {
        const distance = distanceToSegment(
          worldPoint,
          { x: entity.x1, y: entity.y1 },
          { x: entity.x2, y: entity.y2 }
        );
        if (distance <= threshold) {
          pickCandidate(entity, 0, distance, i);
        }
      } else if (entity.type === "dimension") {
        const geometry = getDimensionGeometry(entity);
        if (!geometry) {
          continue;
        }
        if (geometry.kind === "angular") {
          const dExt1 = distanceToSegment(worldPoint, geometry.vertex, geometry.d1);
          const dExt2 = distanceToSegment(worldPoint, geometry.vertex, geometry.d2);
          if (dExt1 <= threshold) {
            pickCandidate(entity, 0, dExt1, i);
          }
          if (dExt2 <= threshold) {
            pickCandidate(entity, 0, dExt2, i);
          }
          const radial = Math.hypot(worldPoint.x - geometry.vertex.x, worldPoint.y - geometry.vertex.y);
          const angle = Math.atan2(worldPoint.y - geometry.vertex.y, worldPoint.x - geometry.vertex.x);
          if (isAngleOnForwardPath(angle, geometry.startAngle, geometry.endAngle)) {
            const dArc = Math.abs(radial - geometry.radius);
            if (dArc <= threshold) {
              pickCandidate(entity, 0, dArc, i);
            }
          }
        } else {
          const dExt1 = distanceToSegment(worldPoint, { x: geometry.x1, y: geometry.y1 }, geometry.d1);
          const dExt2 = distanceToSegment(worldPoint, { x: geometry.x2, y: geometry.y2 }, geometry.d2);
          const dMain = distanceToSegment(worldPoint, geometry.d1, geometry.d2);
          if (dExt1 <= threshold) {
            pickCandidate(entity, 0, dExt1, i);
          }
          if (dExt2 <= threshold) {
            pickCandidate(entity, 0, dExt2, i);
          }
          if (dMain <= threshold) {
            pickCandidate(entity, 0, dMain, i);
          }
        }
        const textSize = Math.max(10, Number(entity.textSize) || 12);
        const label = formatDimensionLabel(entity, geometry);
        const textBounds = {
          minX: geometry.text.x - Math.max(18, label.length * textSize * 0.33),
          maxX: geometry.text.x + Math.max(18, label.length * textSize * 0.33),
          minY: geometry.text.y - Math.max(10, textSize * 0.6),
          maxY: geometry.text.y + Math.max(10, textSize * 0.6)
        };
        if (pointInRect(worldPoint, textBounds)) {
          pickCandidate(entity, 1, 0, i);
        }
      } else if (entity.type === "rect") {
        const bounds = getEntityBounds(entity);
        if (!bounds) {
          continue;
        }
        const corners = [
          { x: bounds.minX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.maxY },
          { x: bounds.minX, y: bounds.maxY }
        ];
        let edgeDistance = Number.POSITIVE_INFINITY;
        for (let j = 0; j < corners.length; j += 1) {
          const a = corners[j];
          const b = corners[(j + 1) % corners.length];
          edgeDistance = Math.min(edgeDistance, distanceToSegment(worldPoint, a, b));
        }
        if (edgeDistance <= threshold) {
          pickCandidate(entity, 0, edgeDistance, i);
        } else if (pointInRect(worldPoint, bounds)) {
          const insideDepth = Math.min(
            worldPoint.x - bounds.minX,
            bounds.maxX - worldPoint.x,
            worldPoint.y - bounds.minY,
            bounds.maxY - worldPoint.y
          );
          pickCandidate(entity, 2, insideDepth, i);
        }
      } else if (entity.type === "circle") {
        const dist = Math.hypot(worldPoint.x - entity.cx, worldPoint.y - entity.cy);
        const edgeDistance = Math.abs(dist - entity.r);
        if (edgeDistance <= threshold) {
          pickCandidate(entity, 0, edgeDistance, i);
        } else if (dist < entity.r) {
          pickCandidate(entity, 2, entity.r - dist, i);
        }
      } else if (entity.type === "fillRegion") {
        if (!Array.isArray(entity.points) || entity.points.length < 3) {
          continue;
        }
        if (pointInPolygon(worldPoint, entity.points)) {
          pickCandidate(entity, 3, 0, i);
        }
      }
    }

    return best ? best.id : null;
  }

  function selectByWindow(start, end, mode, additive) {
    const box = {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y)
    };
    const normalizedMode = mode === "window" ? "window" : "crossing";

    const matchedIds = [];
    for (let i = state.entities.length - 1; i >= 0; i -= 1) {
      const entity = state.entities[i];
      if (!isEntityVisible(entity)) {
        continue;
      }
      const bounds = getEntityBounds(entity);
      if (!bounds) {
        continue;
      }
      const insideWindow =
        bounds.minX >= box.minX && bounds.maxX <= box.maxX && bounds.minY >= box.minY && bounds.maxY <= box.maxY;
      const intersectsWindow = boundsIntersect(bounds, box);
      const matches = normalizedMode === "window" ? insideWindow : intersectsWindow;
      if (matches) {
        matchedIds.unshift(entity.id);
      }
    }

    if (additive) {
      setSelection([...getSelectionIds(), ...matchedIds], matchedIds.length > 0 ? matchedIds[matchedIds.length - 1] : state.selectedId);
      return;
    }
    setSelection(matchedIds, matchedIds.length > 0 ? matchedIds[matchedIds.length - 1] : null);
  }

  function moveEntity(entity, dx, dy) {
    if (entity.type === "line") {
      entity.x1 += dx;
      entity.y1 += dy;
      entity.x2 += dx;
      entity.y2 += dy;
    } else if (entity.type === "dimension") {
      entity.x1 += dx;
      entity.y1 += dy;
      entity.x2 += dx;
      entity.y2 += dy;
      if (entity.x3 !== null && entity.x3 !== undefined && entity.x3 !== "") {
        entity.x3 += dx;
      }
      if (entity.y3 !== null && entity.y3 !== undefined && entity.y3 !== "") {
        entity.y3 += dy;
      }
      if (entity.dimX !== null && entity.dimX !== undefined && entity.dimX !== "") {
        entity.dimX += dx;
      }
      if (entity.dimY !== null && entity.dimY !== undefined && entity.dimY !== "") {
        entity.dimY += dy;
      }
    } else if (entity.type === "rect") {
      entity.x += dx;
      entity.y += dy;
    } else if (entity.type === "circle") {
      entity.cx += dx;
      entity.cy += dy;
    } else if (entity.type === "fillRegion" && Array.isArray(entity.points)) {
      entity.points = entity.points.map((point) => ({
        x: point.x + dx,
        y: point.y + dy
      }));
    }
  }

  function deleteSelected() {
    const selectedIds = getSelectionIds();
    if (selectedIds.length === 0) {
      return false;
    }
    const selectedEntities = selectedIds.map((id) => getEntityById(id)).filter(Boolean);
    if (selectedEntities.length === 0) {
      clearSelection();
      queueRender();
      return false;
    }
    if (selectedEntities.some((entity) => isEntityLocked(entity))) {
      alert(t("Nie można usunąć obiektu z zablokowanej warstwy.", "Cannot delete object from a locked layer."));
      return false;
    }
    const selectedSet = new Set(selectedEntities.map((entity) => entity.id));
    saveHistory();
    state.entities = state.entities.filter((entity) => !selectedSet.has(entity.id));
    clearSelection();
    markDirty();
    queueRender();
    return true;
  }

  function copySelected() {
    const selected = getEntityById(state.selectedId);
    if (!selected) {
      return false;
    }
    state.clipboard = cloneEntity(selected);
    return true;
  }

  function duplicateSelected() {
    const selectedEntities = getSelectedEntities();
    if (selectedEntities.length === 0) {
      return false;
    }
    if (selectedEntities.some((entity) => isEntityLocked(entity))) {
      alert(t("Nie można duplikować obiektu z zablokowanej warstwy.", "Cannot duplicate object from a locked layer."));
      return false;
    }
    saveHistory();
    const duplicatedIds = [];
    for (const selected of selectedEntities) {
      const duplicated = cloneEntity(selected);
      duplicated.id = createId();
      moveEntity(duplicated, state.gridSize, state.gridSize);
      state.entities.push(duplicated);
      duplicatedIds.push(duplicated.id);
    }
    setSelection(duplicatedIds, duplicatedIds.length > 0 ? duplicatedIds[duplicatedIds.length - 1] : null);
    markDirty();
    queueRender();
    return true;
  }

  function pasteClipboard() {
    if (!state.clipboard) {
      return false;
    }
    saveHistory();
    const pasted = cloneEntity(state.clipboard);
    pasted.id = createId();
    if (!getLayerById(pasted.layerId)) {
      pasted.layerId = state.activeLayerId;
    }
    moveEntity(pasted, state.gridSize * 2, state.gridSize * 2);
    state.entities.push(pasted);
    setPrimarySelection(pasted.id);
    markDirty();
    queueRender();
    return true;
  }

  function bringSelectedToFront() {
    const selectedEntities = getSelectedEntities();
    if (selectedEntities.length === 0) {
      return false;
    }
    if (selectedEntities.some((entity) => isEntityLocked(entity))) {
      return false;
    }
    const selectedSet = new Set(selectedEntities.map((entity) => entity.id));
    const selectedTail = state.entities.filter((entity) => selectedSet.has(entity.id));
    if (selectedTail.length === 0 || state.entities.slice(-selectedTail.length).every((entity) => selectedSet.has(entity.id))) {
      return false;
    }
    saveHistory();
    state.entities = state.entities.filter((entity) => !selectedSet.has(entity.id));
    state.entities.push(...selectedTail);
    markDirty();
    queueRender();
    return true;
  }

  function sendSelectedToBack() {
    const selectedEntities = getSelectedEntities();
    if (selectedEntities.length === 0) {
      return false;
    }
    if (selectedEntities.some((entity) => isEntityLocked(entity))) {
      return false;
    }
    const selectedSet = new Set(selectedEntities.map((entity) => entity.id));
    const selectedHead = state.entities.filter((entity) => selectedSet.has(entity.id));
    if (selectedHead.length === 0 || state.entities.slice(0, selectedHead.length).every((entity) => selectedSet.has(entity.id))) {
      return false;
    }
    saveHistory();
    state.entities = state.entities.filter((entity) => !selectedSet.has(entity.id));
    state.entities.unshift(...selectedHead);
    markDirty();
    queueRender();
    return true;
  }

  function clearDrawingPreview() {
    state.drawStart = null;
    state.dimensionSecond = null;
    state.dimensionThird = null;
    state.previewPoint = null;
    state.lengthInputBuffer = "";
  }

  function finishPolyline() {
    state.polylineAnchor = null;
    state.previewPoint = null;
    state.lengthInputBuffer = "";
    queueRender();
  }

  function isDirectLengthInputActive() {
    if (state.tool === "polyline") {
      return Boolean(state.polylineAnchor);
    }
    if (state.tool === "line" || state.tool === "measure") {
      return Boolean(state.drawStart);
    }
    return false;
  }

  function parseLengthInputBuffer() {
    const normalized = String(state.lengthInputBuffer || "")
      .trim()
      .replace(",", ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  function getDirectLengthAnchor() {
    if (state.tool === "polyline") {
      return state.polylineAnchor;
    }
    if (state.tool === "line" || state.tool === "measure") {
      return state.drawStart;
    }
    return null;
  }

  function buildPointByDistance(anchor, distance) {
    const reference = state.previewPoint || state.pointerRawWorld || state.pointerWorld || { x: anchor.x + 1, y: anchor.y };
    let dx = reference.x - anchor.x;
    let dy = reference.y - anchor.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.000001) {
      dx = 1;
      dy = 0;
    } else {
      dx /= len;
      dy /= len;
    }
    return {
      x: anchor.x + dx * distance,
      y: anchor.y + dy * distance
    };
  }

  function applyDirectLengthInput() {
    if (!isDirectLengthInputActive()) {
      return false;
    }
    const distance = parseLengthInputBuffer();
    if (!distance) {
      echoCommand(t("Podaj poprawną dodatnią długość.", "Enter a valid positive length."), true);
      return false;
    }
    const anchor = getDirectLengthAnchor();
    if (!anchor) {
      return false;
    }
    const endpoint = buildPointByDistance(anchor, distance);

    if (state.tool === "polyline") {
      saveHistory();
      const entity = createLineEntity(anchor, endpoint);
      state.entities.push(entity);
      setPrimarySelection(entity.id);
      state.polylineAnchor = endpoint;
      state.previewPoint = endpoint;
      state.lengthInputBuffer = "";
      state.lastMeasure = null;
      markDirty();
      queueRender();
      echoCommand(t(`Polilinia: dodano odcinek ${distance.toFixed(2)}.`, `Polyline: added segment ${distance.toFixed(2)}.`));
      return true;
    }

    if (state.tool === "line") {
      saveHistory();
      const entity = createLineEntity(anchor, endpoint);
      state.entities.push(entity);
      setPrimarySelection(entity.id);
      clearDrawingPreview();
      markDirty();
      queueRender();
      echoCommand(t(`Linia: ustawiono długość ${distance.toFixed(2)}.`, `Line: set length ${distance.toFixed(2)}.`));
      return true;
    }

    if (state.tool === "measure") {
      const finalized = finalizeMeasure(anchor, endpoint);
      if (!finalized) {
        echoCommand(t("Pomiar jest zbyt krótki.", "Measurement is too short."), true);
        return false;
      }
      clearDrawingPreview();
      queueRender();
      echoCommand(t(`Pomiar: długość ${distance.toFixed(2)}.`, `Measure: distance ${distance.toFixed(2)}.`));
      return true;
    }

    return false;
  }

  function effectiveTool() {
    return state.spacePan ? "pan" : state.tool;
  }

  function resolvePointerFromEvent(event) {
    const screen = getMouseScreen(event);
    const raw = screenToWorld(screen);
    const snapped = state.snap ? snapPoint(raw) : raw;
    return { screen, raw, snapped };
  }

  function getConstrainedPoint(anchor, rawPoint, event, options) {
    const config = options && typeof options === "object" ? options : {};
    const shouldOrtho = Boolean(state.ortho || event.shiftKey);
    let point = rawPoint;
    const polarEnabled = Boolean(config.polar);
    if (polarEnabled && !shouldOrtho) {
      point = constrainPolar(anchor, point, config.polarStep, true);
    }
    if (shouldOrtho) {
      point = constrainOrtho(anchor, point, true);
    }
    return state.snap ? snapPoint(point) : point;
  }

  function getDimensionPickPoint(rawPoint, snappedPoint) {
    if (state.snap) {
      return snappedPoint;
    }
    return rawPoint;
  }

  function createLineEntity(start, end) {
    return {
      ...createBaseEntity("line"),
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y
    };
  }

  function createRectEntity(start, end) {
    return {
      ...createBaseEntity("rect"),
      x: start.x,
      y: start.y,
      w: end.x - start.x,
      h: end.y - start.y,
      fill: state.fillEnabled,
      fillColor: state.fillColor,
      fillAlpha: state.fillAlpha
    };
  }

  function createCircleEntity(start, end) {
    return {
      ...createBaseEntity("circle"),
      cx: start.x,
      cy: start.y,
      r: Math.hypot(end.x - start.x, end.y - start.y),
      fill: state.fillEnabled,
      fillColor: state.fillColor,
      fillAlpha: state.fillAlpha
    };
  }

  function formatDimensionDistance(distance, unit, decimals) {
    const rawValue = Math.max(0, Number(distance) || 0);
    const safeUnit = String(unit || "mm").trim() || "mm";
    const value =
      safeUnit === "m" ? rawValue / 1000 : safeUnit === "cm" ? rawValue / 10 : rawValue;
    const precision = clamp(Math.round(Number(decimals)), 0, 4, 0);
    return `${value.toFixed(precision)} ${safeUnit}`;
  }

  function formatDimensionAngle(angleDegrees, decimals) {
    const value = Math.max(0, Number(angleDegrees) || 0);
    const precision = clamp(Math.round(Number(decimals)), 0, 4, 0);
    return `${value.toFixed(precision)}\u00B0`;
  }

  function formatDimensionLabel(entity, geometry) {
    if (geometry && geometry.kind === "angular") {
      return formatDimensionAngle(geometry.length, entity.decimals);
    }
    return formatDimensionDistance(geometry ? geometry.length : 0, entity.unit || "mm", entity.decimals);
  }

  function normalizeAngleRadians(value) {
    const tau = Math.PI * 2;
    let angle = Number(value);
    if (!Number.isFinite(angle)) {
      angle = 0;
    }
    while (angle < 0) {
      angle += tau;
    }
    while (angle >= tau) {
      angle -= tau;
    }
    return angle;
  }

  function angleDeltaForward(startAngle, endAngle) {
    const tau = Math.PI * 2;
    let delta = normalizeAngleRadians(endAngle) - normalizeAngleRadians(startAngle);
    if (delta < 0) {
      delta += tau;
    }
    return delta;
  }

  function isAngleOnForwardPath(angle, startAngle, endAngle) {
    const total = angleDeltaForward(startAngle, endAngle);
    const progress = angleDeltaForward(startAngle, angle);
    return progress <= total + 0.00001;
  }

  function getAngularArcPolyline(geometry, stepHint) {
    if (!geometry || geometry.kind !== "angular") {
      return [];
    }
    const steps = Math.max(
      12,
      Math.min(96, Math.ceil((geometry.span / (Math.PI * 2)) * (Number(stepHint) || 72)))
    );
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const angle = geometry.startAngle + (geometry.span * i) / steps;
      points.push({
        x: geometry.vertex.x + Math.cos(angle) * geometry.radius,
        y: geometry.vertex.y + Math.sin(angle) * geometry.radius
      });
    }
    return points;
  }

  function getDimensionGeometry(entity) {
    if (!entity || entity.type !== "dimension") {
      return null;
    }

    const mode = normalizeDimensionMode(entity.mode);
    const x1 = Number(entity.x1);
    const y1 = Number(entity.y1);
    const x2 = Number(entity.x2);
    const y2 = Number(entity.y2);
    if (![x1, y1, x2, y2].every(Number.isFinite)) {
      return null;
    }

    const rawDimX = entity.dimX;
    const rawDimY = entity.dimY;
    const dimX = Number(rawDimX);
    const dimY = Number(rawDimY);
    const hasDimPoint =
      rawDimX !== null &&
      rawDimX !== undefined &&
      rawDimX !== "" &&
      rawDimY !== null &&
      rawDimY !== undefined &&
      rawDimY !== "" &&
      Number.isFinite(dimX) &&
      Number.isFinite(dimY);

    if (mode === "angular") {
      const x3 = Number(entity.x3);
      const y3 = Number(entity.y3);
      if (![x3, y3].every(Number.isFinite)) {
        return null;
      }

      const v1x = x2 - x1;
      const v1y = y2 - y1;
      const v2x = x3 - x1;
      const v2y = y3 - y1;
      const leg1 = Math.hypot(v1x, v1y);
      const leg2 = Math.hypot(v2x, v2y);
      if (leg1 <= 0.0001 || leg2 <= 0.0001) {
        return null;
      }

      const a1 = Math.atan2(v1y, v1x);
      const a2 = Math.atan2(v2y, v2x);
      const span12 = angleDeltaForward(a1, a2);
      const span21 = angleDeltaForward(a2, a1);
      let startAngle = a1;
      let endAngle = a2;
      let span = span12;

      if (hasDimPoint) {
        const pointerAngle = Math.atan2(dimY - y1, dimX - x1);
        if (!isAngleOnForwardPath(pointerAngle, a1, a2)) {
          startAngle = a2;
          endAngle = a1;
          span = span21;
        }
      } else if (span12 > Math.PI) {
        startAngle = a2;
        endAngle = a1;
        span = span21;
      }
      if (span <= 0.0001 || Math.abs(span - Math.PI * 2) <= 0.0001) {
        return null;
      }

      const minLeg = Math.max(12, Math.min(leg1, leg2));
      let radius = hasDimPoint ? Math.hypot(dimX - x1, dimY - y1) : minLeg * 0.6;
      if (!Number.isFinite(radius) || radius < 12) {
        radius = Math.max(12, minLeg * 0.6);
      }
      radius = clamp(radius, 12, Math.max(24, Math.max(leg1, leg2) * 2), minLeg * 0.6);
      const midAngle = normalizeAngleRadians(startAngle + span / 2);
      const textRadius = radius + 14;
      const d1 = { x: x1 + Math.cos(startAngle) * radius, y: y1 + Math.sin(startAngle) * radius };
      const d2 = { x: x1 + Math.cos(endAngle) * radius, y: y1 + Math.sin(endAngle) * radius };
      const text = {
        x: x1 + Math.cos(midAngle) * textRadius,
        y: y1 + Math.sin(midAngle) * textRadius
      };

      return {
        x1,
        y1,
        x2,
        y2,
        x3,
        y3,
        dx: v1x,
        dy: v1y,
        length: (span * 180) / Math.PI,
        rawLength: leg1,
        ux: v1x / leg1,
        uy: v1y / leg1,
        nx: 0,
        ny: 0,
        mode,
        rotation: 0,
        midX: x1,
        midY: y1,
        offset: radius,
        d1,
        d2,
        text,
        kind: "angular",
        vertex: { x: x1, y: y1 },
        span,
        startAngle,
        endAngle,
        midAngle,
        radius,
        tangentStart: { x: -Math.sin(startAngle), y: Math.cos(startAngle) },
        tangentEnd: { x: -Math.sin(endAngle), y: Math.cos(endAngle) }
      };
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length <= 0.0001) {
      return null;
    }

    const ux = dx / length;
    const uy = dy / length;
    let nx = -uy;
    let ny = ux;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    let offset = Number(entity.offset);
    let d1 = null;
    let d2 = null;
    let measureLength = length;
    if (mode === "linear") {
      const horizontal = hasDimPoint ? Math.abs(dimY - midY) >= Math.abs(dimX - midX) : Math.abs(dx) >= Math.abs(dy);
      if (horizontal) {
        nx = 0;
        ny = 1;
        if (!Number.isFinite(offset) && hasDimPoint) {
          offset = dimY - midY;
        }
        if (!Number.isFinite(offset) || Math.abs(offset) < 2) {
          offset = offset < 0 ? -24 : 24;
        }
        const yDim = midY + offset;
        d1 = { x: x1, y: yDim };
        d2 = { x: x2, y: yDim };
        measureLength = Math.abs(x2 - x1);
      } else {
        nx = 1;
        ny = 0;
        if (!Number.isFinite(offset) && hasDimPoint) {
          offset = dimX - midX;
        }
        if (!Number.isFinite(offset) || Math.abs(offset) < 2) {
          offset = offset < 0 ? -24 : 24;
        }
        const xDim = midX + offset;
        d1 = { x: xDim, y: y1 };
        d2 = { x: xDim, y: y2 };
        measureLength = Math.abs(y2 - y1);
      }
    } else if (mode === "rotated") {
      const rotation = normalizeAngleDegrees(entity.rotation);
      const rotationRad = (rotation * Math.PI) / 180;
      const rux = Math.cos(rotationRad);
      const ruy = Math.sin(rotationRad);
      nx = -ruy;
      ny = rux;
      const t1 = x1 * rux + y1 * ruy;
      const t2 = x2 * rux + y2 * ruy;
      const midN = midX * nx + midY * ny;
      if (!Number.isFinite(offset) && hasDimPoint) {
        offset = dimX * nx + dimY * ny - midN;
      }
      if (!Number.isFinite(offset) || Math.abs(offset) < 2) {
        offset = offset < 0 ? -24 : 24;
      }
      const dimN = midN + offset;
      d1 = { x: rux * t1 + nx * dimN, y: ruy * t1 + ny * dimN };
      d2 = { x: rux * t2 + nx * dimN, y: ruy * t2 + ny * dimN };
      measureLength = Math.abs(t2 - t1);
    } else {
      if (!Number.isFinite(offset) && hasDimPoint) {
        offset = (dimX - midX) * nx + (dimY - midY) * ny;
      }
      if (!Number.isFinite(offset) || Math.abs(offset) < 2) {
        offset = offset < 0 ? -24 : 24;
      }
      d1 = { x: x1 + nx * offset, y: y1 + ny * offset };
      d2 = { x: x2 + nx * offset, y: y2 + ny * offset };
    }

    const textShift = offset >= 0 ? 10 : -10;
    const text = {
      x: (d1.x + d2.x) / 2 + nx * textShift,
      y: (d1.y + d2.y) / 2 + ny * textShift
    };

    return {
      x1,
      y1,
      x2,
      y2,
      dx,
      dy,
      length: measureLength,
      rawLength: length,
      ux,
      uy,
      nx,
      ny,
      mode,
      rotation: mode === "rotated" ? normalizeAngleDegrees(entity.rotation) : 0,
      midX,
      midY,
      offset,
      d1,
      d2,
      text,
      kind: "linear"
    };
  }

  function createDimensionEntity(start, end, dimPoint) {
    const mode = normalizeDimensionMode(state.dimensionMode);
    if (mode === "angular") {
      return null;
    }
    const probe = {
      type: "dimension",
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      mode,
      rotation: state.dimensionRotation,
      dimX: dimPoint ? dimPoint.x : null,
      dimY: dimPoint ? dimPoint.y : null
    };
    const geometry = getDimensionGeometry(probe);
    if (!geometry) {
      return null;
    }

    const dimensionLayer = ensureLayerByName("Wymiary");
    ensureLayerVisibleUnlocked(dimensionLayer);

    return {
      ...createBaseEntity("dimension"),
      stroke: state.dimensionColor,
      layerId: dimensionLayer.id,
      x1: geometry.x1,
      y1: geometry.y1,
      x2: geometry.x2,
      y2: geometry.y2,
      dimX: geometry.midX + geometry.nx * geometry.offset,
      dimY: geometry.midY + geometry.ny * geometry.offset,
      offset: geometry.offset,
      mode,
      rotation: mode === "rotated" ? normalizeAngleDegrees(state.dimensionRotation) : 0,
      textSize: state.dimensionTextSize,
      unit: state.dimensionUnit,
      decimals: state.dimensionDecimals
    };
  }

  function createAngularDimensionEntity(vertex, ray1, ray2, dimPoint) {
    const probe = {
      type: "dimension",
      mode: "angular",
      x1: vertex.x,
      y1: vertex.y,
      x2: ray1.x,
      y2: ray1.y,
      x3: ray2.x,
      y3: ray2.y,
      dimX: dimPoint ? dimPoint.x : null,
      dimY: dimPoint ? dimPoint.y : null
    };
    const geometry = getDimensionGeometry(probe);
    if (!geometry || geometry.kind !== "angular") {
      return null;
    }

    const dimensionLayer = ensureLayerByName("Wymiary");
    ensureLayerVisibleUnlocked(dimensionLayer);

    return {
      ...createBaseEntity("dimension"),
      stroke: state.dimensionColor,
      layerId: dimensionLayer.id,
      x1: geometry.vertex.x,
      y1: geometry.vertex.y,
      x2: geometry.x2,
      y2: geometry.y2,
      x3: geometry.x3,
      y3: geometry.y3,
      dimX: dimPoint ? dimPoint.x : geometry.text.x,
      dimY: dimPoint ? dimPoint.y : geometry.text.y,
      offset: geometry.radius,
      mode: "angular",
      rotation: 0,
      textSize: state.dimensionTextSize,
      unit: state.dimensionUnit,
      decimals: state.dimensionDecimals
    };
  }

  function finalizeMeasure(start, end) {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (!Number.isFinite(distance) || distance <= MIN_DRAW_LENGTH) {
      return false;
    }
    const rawAngle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
    const angle = normalizeAngleDegrees(rawAngle);
    state.lastMeasure = {
      p1: start,
      p2: end,
      distance,
      angle
    };
    clearSelection();
    return true;
  }

  function handleCanvasMouseDown(event) {
    if (!licenseSession.active) {
      return;
    }
    if (event.button === 2) {
      if (state.commandState) {
        cancelActiveCommand({ echo: false });
        echoCommand("Polecenie anulowane.");
        return;
      }
      if (state.tool === "polyline" && state.polylineAnchor) {
        finishPolyline();
      } else if (state.tool === "dimension" && (state.drawStart || state.dimensionSecond)) {
        clearDrawingPreview();
        queueRender();
      }
      return;
    }

    const { screen, raw, snapped } = resolvePointerFromEvent(event);
    state.pointerRawWorld = raw;
    state.pointerWorld = state.snap ? snapped : raw;

    if (state.commandState && event.button === 0) {
      handleActiveCommandMouseDown(raw, snapped, event);
      return;
    }

    const tool = effectiveTool();
    if (tool === "pan" || event.button === 1) {
      state.panning = true;
      state.panLast = screen;
      return;
    }

    if (tool === "paint") {
      let hit = hitTest(raw);
      if (!hit && state.snap) {
        hit = hitTest(snapped);
      }
      clearDrawingPreview();
      if (hit) {
        const entity = getEntityById(hit);
        if (!entity) {
          queueRender();
          return;
        }

        setPrimarySelection(entity.id);

        if (entity.type === "rect" || entity.type === "circle" || entity.type === "fillRegion") {
          if (isEntityLocked(entity)) {
            echoCommand(t("Nie można malować: obiekt jest na zablokowanej warstwie.", "Cannot paint: object is on a locked layer."), true);
            queueRender();
            return;
          }
          saveHistory();
          state.fillEnabled = true;
          entity.fill = true;
          entity.fillColor = state.fillColor;
          entity.fillAlpha = state.fillAlpha;
          markDirty();
          queueRender();
          return;
        }
      }

      if (!assertCanDrawOnActiveLayer()) {
        queueRender();
        return;
      }

      const loopPoints = findClosedLineLoopAtPoint(state.snap ? snapped : raw);
      if (!loopPoints) {
        echoCommand(t("Brak zamkniętego obszaru do wypełnienia.", "No closed area to fill."), true);
        queueRender();
        return;
      }

      saveHistory();
      state.fillEnabled = true;
      const fillRegion = {
        ...createBaseEntity("fillRegion"),
        stroke: "none",
        lineWidth: 1,
        lineStyle: "solid",
        points: loopPoints,
        fill: true,
        fillColor: state.fillColor,
        fillAlpha: state.fillAlpha
      };
      state.entities.push(fillRegion);
      setPrimarySelection(fillRegion.id);
      markDirty();
      queueRender();
      return;
    }

    if (tool === "select") {
      state.dragging = false;
      state.dragStartScreen = null;
      state.dragLastWorld = null;
      state.dragMoved = false;
      state.selectingBox = false;
      state.selectionBoxStart = null;
      state.selectionBoxEnd = null;
      state.selectionBoxAdditive = false;
      let hit = hitTest(raw);
      if (!hit && state.snap) {
        hit = hitTest(snapped);
      }

      clearDrawingPreview();
      state.polylineAnchor = null;

      if (hit) {
        if (event.shiftKey) {
          toggleSelection(hit);
        } else if (!isEntitySelected(hit)) {
          setPrimarySelection(hit);
        }
        const selected = getEntityById(hit);
        if (selected && !isEntityLocked(selected) && isEntitySelected(hit)) {
          state.dragging = true;
          state.dragStartScreen = screen;
          state.dragLastWorld = state.snap ? snapped : raw;
          state.dragMoved = false;
        }
      } else {
        if (!event.shiftKey) {
          clearSelection();
        }
        state.selectingBox = true;
        state.selectionBoxStart = raw;
        state.selectionBoxEnd = raw;
        state.selectionBoxAdditive = event.shiftKey;
      }

      queueRender();
      return;
    }

    if (tool === "polyline") {
      if (!assertCanDrawOnActiveLayer()) {
        return;
      }
      if (!state.polylineAnchor) {
        state.polylineAnchor = state.snap ? snapped : raw;
        state.previewPoint = state.polylineAnchor;
        state.lastMeasure = null;
      } else {
        const endpoint = getConstrainedPoint(state.polylineAnchor, raw, event);
        const length = Math.hypot(endpoint.x - state.polylineAnchor.x, endpoint.y - state.polylineAnchor.y);
        if (length > 0) {
          saveHistory();
          const entity = createLineEntity(state.polylineAnchor, endpoint);
          state.entities.push(entity);
          setPrimarySelection(entity.id);
          state.polylineAnchor = endpoint;
          state.previewPoint = endpoint;
          markDirty();
        }
      }

      if (event.detail >= 2) {
        finishPolyline();
      }

      queueRender();
      return;
    }

    if (tool === "dimension") {
      if (!assertCanDrawOnActiveLayer()) {
        return;
      }
      const dimensionMode = normalizeDimensionMode(state.dimensionMode);

      if (!state.drawStart) {
        state.drawStart = state.snap ? snapped : raw;
        state.dimensionSecond = null;
        state.dimensionThird = null;
        state.previewPoint = state.drawStart;
        state.lastMeasure = null;
        queueRender();
        return;
      }

      if (dimensionMode === "angular") {
        if (!state.dimensionSecond) {
          const secondPoint = getDimensionPickPoint(raw, snapped);
          const length = Math.hypot(secondPoint.x - state.drawStart.x, secondPoint.y - state.drawStart.y);
          if (length > 0.0001) {
            state.dimensionSecond = secondPoint;
            state.previewPoint = secondPoint;
          }
          queueRender();
          return;
        }

        if (!state.dimensionThird) {
          const thirdPoint = getDimensionPickPoint(raw, snapped);
          const length = Math.hypot(thirdPoint.x - state.drawStart.x, thirdPoint.y - state.drawStart.y);
          if (length > 0.0001) {
            const cross =
              (state.dimensionSecond.x - state.drawStart.x) * (thirdPoint.y - state.drawStart.y) -
              (state.dimensionSecond.y - state.drawStart.y) * (thirdPoint.x - state.drawStart.x);
            if (Math.abs(cross) < 0.001) {
              echoCommand("Wymiar kątowy: ramię 2 nie może być współliniowe z ramieniem 1.", true);
            } else {
              state.dimensionThird = thirdPoint;
              state.previewPoint = state.snap ? snapped : raw;
            }
          }
          queueRender();
          return;
        }

        const dimPoint = state.snap ? snapped : raw;
        const entity = createAngularDimensionEntity(
          state.drawStart,
          state.dimensionSecond,
          state.dimensionThird,
          dimPoint
        );
        if (entity) {
          saveHistory();
          state.entities.push(entity);
          setPrimarySelection(entity.id);
          markDirty();
        }
        clearDrawingPreview();
        queueRender();
        return;
      }

      if (!state.dimensionSecond) {
        const secondPoint = getDimensionPickPoint(raw, snapped);
        const length = Math.hypot(secondPoint.x - state.drawStart.x, secondPoint.y - state.drawStart.y);
        if (length > 0) {
          state.dimensionSecond = secondPoint;
          state.previewPoint = state.snap ? snapped : raw;
        }
        queueRender();
        return;
      }

      const dimPoint = state.snap ? snapped : raw;
      const entity = createDimensionEntity(state.drawStart, state.dimensionSecond, dimPoint);
      if (entity) {
        saveHistory();
        state.entities.push(entity);
        setPrimarySelection(entity.id);
        markDirty();
      }
      clearDrawingPreview();
      queueRender();
      return;
    }

    if (tool === "line" || tool === "rect" || tool === "circle" || tool === "measure") {
      if (!state.drawStart) {
        if (tool !== "measure" && !assertCanDrawOnActiveLayer()) {
          return;
        }
        state.drawStart = state.snap ? snapped : raw;
        state.previewPoint = state.drawStart;
        if (tool !== "measure") {
          state.lastMeasure = null;
        }
      } else {
        let endpoint = state.snap ? snapped : raw;

        if (tool === "line" || tool === "measure") {
          endpoint = getConstrainedPoint(state.drawStart, raw, event);
        }

        if (tool === "rect" && (state.ortho || event.shiftKey)) {
          const dx = endpoint.x - state.drawStart.x;
          const dy = endpoint.y - state.drawStart.y;
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          endpoint = {
            x: state.drawStart.x + (dx >= 0 ? size : -size),
            y: state.drawStart.y + (dy >= 0 ? size : -size)
          };
          if (state.snap) {
            endpoint = snapPoint(endpoint);
          }
        }

        if (tool === "line") {
          if (!assertCanDrawOnActiveLayer()) {
            clearDrawingPreview();
            queueRender();
            return;
          }
          const length = Math.hypot(endpoint.x - state.drawStart.x, endpoint.y - state.drawStart.y);
          if (length > 0) {
            saveHistory();
            const entity = createLineEntity(state.drawStart, endpoint);
            state.entities.push(entity);
            setPrimarySelection(entity.id);
            markDirty();
          }
        } else if (tool === "rect") {
          if (!assertCanDrawOnActiveLayer()) {
            clearDrawingPreview();
            queueRender();
            return;
          }
          const w = endpoint.x - state.drawStart.x;
          const h = endpoint.y - state.drawStart.y;
          if (Math.abs(w) > MIN_DRAW_LENGTH && Math.abs(h) > MIN_DRAW_LENGTH) {
            saveHistory();
            const entity = createRectEntity(state.drawStart, endpoint);
            state.entities.push(entity);
            setPrimarySelection(entity.id);
            markDirty();
          }
        } else if (tool === "circle") {
          if (!assertCanDrawOnActiveLayer()) {
            clearDrawingPreview();
            queueRender();
            return;
          }
          const r = Math.hypot(endpoint.x - state.drawStart.x, endpoint.y - state.drawStart.y);
          if (r > MIN_DRAW_LENGTH) {
            saveHistory();
            const entity = createCircleEntity(state.drawStart, endpoint);
            state.entities.push(entity);
            setPrimarySelection(entity.id);
            markDirty();
          }
        } else if (tool === "measure") {
          const finalized = finalizeMeasure(state.drawStart, endpoint);
          if (!finalized) {
            echoCommand(t("Pomiar jest zbyt krótki.", "Measurement is too short."), true);
          }
        }

        clearDrawingPreview();
      }
      queueRender();
    }
  }

  function handleCanvasMouseMove(event) {
    if (!licenseSession.active) {
      return;
    }
    if (state.splitterDragging) {
      if (!workspaceEl) {
        return;
      }
      const rect = workspaceEl.getBoundingClientRect();
      const targetWidth = rect.right - event.clientX;
      const limits = getPaletteWidthLimits();
      state.paletteWidth = clamp(targetWidth, limits.min, limits.max, state.paletteWidth);
      syncLayoutChrome();
      resizeCanvas();
      return;
    }

    const { screen, raw, snapped } = resolvePointerFromEvent(event);
    state.pointerRawWorld = raw;
    state.pointerWorld = state.snap ? snapped : raw;

    if (state.panning) {
      const dx = screen.x - state.panLast.x;
      const dy = screen.y - state.panLast.y;
      state.view.offsetX += dx;
      state.view.offsetY += dy;
      state.panLast = screen;
      queueRender();
      return;
    }

    if (state.selectingBox && state.selectionBoxStart) {
      state.selectionBoxEnd = raw;
      queueRender();
      return;
    }

    if (state.dragging && getSelectionIds().length > 0) {
      const draggable = getSelectedEntities().filter((entity) => !isEntityLocked(entity));
      if (draggable.length > 0) {
        if (!state.dragMoved && state.dragStartScreen) {
          const movedPx = Math.hypot(screen.x - state.dragStartScreen.x, screen.y - state.dragStartScreen.y);
          if (movedPx < POINTER_DRAG_THRESHOLD_PX) {
            return;
          }
        }
        const current = state.snap ? snapped : raw;
        const dx = current.x - state.dragLastWorld.x;
        const dy = current.y - state.dragLastWorld.y;
        if (dx !== 0 || dy !== 0) {
          if (!state.dragMoved) {
            saveHistory();
            state.dragMoved = true;
          }
          for (const entity of draggable) {
            moveEntity(entity, dx, dy);
          }
          state.dragLastWorld = current;
          markDirty();
          queueRender();
          return;
        }
      }
    }

    if (state.polylineAnchor) {
      state.previewPoint = getConstrainedPoint(state.polylineAnchor, raw, event);
      queueRender();
      return;
    }

    if (state.drawStart) {
      let preview = state.snap ? snapped : raw;
      if (state.tool === "dimension") {
        const dimensionMode = normalizeDimensionMode(state.dimensionMode);
        if (dimensionMode === "angular") {
          if (!state.dimensionSecond || !state.dimensionThird) {
            preview = getDimensionPickPoint(raw, snapped);
          } else {
            preview = state.snap ? snapped : raw;
          }
        } else if (state.dimensionSecond) {
          preview = state.snap ? snapped : raw;
        } else {
          preview = getDimensionPickPoint(raw, snapped);
        }
      } else if (state.tool === "line" || state.tool === "measure") {
        preview = getConstrainedPoint(state.drawStart, raw, event);
      }
      if (state.tool === "rect" && (state.ortho || event.shiftKey)) {
        const dx = preview.x - state.drawStart.x;
        const dy = preview.y - state.drawStart.y;
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        preview = {
          x: state.drawStart.x + (dx >= 0 ? size : -size),
          y: state.drawStart.y + (dy >= 0 ? size : -size)
        };
        if (state.snap) {
          preview = snapPoint(preview);
        }
      }
      state.previewPoint = preview;
      queueRender();
      return;
    }

    updateStatus(state.pointerWorld);
    queueRender();
  }

  function handleCanvasMouseUp() {
    if (!licenseSession.active) {
      return;
    }
    if (state.splitterDragging) {
      state.splitterDragging = false;
      syncLayoutChrome();
      markDirty();
      return;
    }

    if (state.selectingBox && state.selectionBoxStart && state.selectionBoxEnd) {
      const a = worldToScreen(state.selectionBoxStart);
      const b = worldToScreen(state.selectionBoxEnd);
      const movedPx = Math.hypot(b.x - a.x, b.y - a.y);
      if (movedPx >= POINTER_DRAG_THRESHOLD_PX) {
        const mode = state.selectionBoxEnd.x >= state.selectionBoxStart.x ? "window" : "crossing";
        selectByWindow(state.selectionBoxStart, state.selectionBoxEnd, mode, state.selectionBoxAdditive);
      }
    }

    state.panning = false;
    state.dragging = false;
    state.dragStartScreen = null;
    state.dragLastWorld = null;
    state.dragMoved = false;
    state.selectingBox = false;
    state.selectionBoxStart = null;
    state.selectionBoxEnd = null;
    state.selectionBoxAdditive = false;

    queueRender();
  }

  function handleCanvasWheel(event) {
    if (!licenseSession.active) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const screen = getMouseScreen(event);
    const before = screenToWorld(screen);
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    const nextScale = clamp(state.view.scale * factor, 0.1, 10, state.view.scale);
    state.view.scale = nextScale;
    state.view.offsetX = screen.x - before.x * state.view.scale;
    state.view.offsetY = screen.y - before.y * state.view.scale;
    queueRender();
    markDirty();
  }

  function fitViewToEntities(options) {
    ensureValidViewState();
    const includeHidden = Boolean(options && options.includeHidden);
    const sourceEntities =
      options && Array.isArray(options.entities) && options.entities.length > 0
        ? options.entities
        : state.entities;
    if (sourceEntities.length === 0) {
      state.view.scale = 1;
      state.view.offsetX = 160;
      state.view.offsetY = 80;
      queueRender();
      return false;
    }

    let bounds = null;
    for (const entity of sourceEntities) {
      if (!includeHidden && !isEntityVisible(entity)) {
        continue;
      }
      const current = getEntityBounds(entity);
      if (!current) {
        continue;
      }
      if (![current.minX, current.minY, current.maxX, current.maxY].every((value) => isFiniteNumber(value))) {
        continue;
      }
      if (!bounds) {
        bounds = { ...current };
      } else {
        bounds.minX = Math.min(bounds.minX, current.minX);
        bounds.minY = Math.min(bounds.minY, current.minY);
        bounds.maxX = Math.max(bounds.maxX, current.maxX);
        bounds.maxY = Math.max(bounds.maxY, current.maxY);
      }
    }

    if (!bounds) {
      return false;
    }

    const canvasSize = getCanvasSize();
    if (canvasSize.width < 20 || canvasSize.height < 20) {
      return false;
    }
    const margin = 40;
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const scaleX = (canvasSize.width - margin * 2) / width;
    const scaleY = (canvasSize.height - margin * 2) / height;
    const nextScale = clamp(Math.min(scaleX, scaleY), 0.1, 10, 1);
    const nextOffsetX = margin - bounds.minX * nextScale + (canvasSize.width - margin * 2 - width * nextScale) / 2;
    const nextOffsetY = margin - bounds.minY * nextScale + (canvasSize.height - margin * 2 - height * nextScale) / 2;
    if (![nextScale, nextOffsetX, nextOffsetY].every((value) => isFiniteNumber(value))) {
      resetViewTransform();
      queueRender();
      markDirty();
      return false;
    }

    state.view.scale = nextScale;
    state.view.offsetX = nextOffsetX;
    state.view.offsetY = nextOffsetY;

    queueRender();
    markDirty();
    return true;
  }

  function clearDrawing() {
    if (state.entities.length === 0) {
      return false;
    }
    const approved = window.confirm(t("Czy na pewno chcesz wyczyścić cały rysunek?", "Are you sure you want to clear the whole drawing?"));
    if (!approved) {
      return false;
    }
    saveHistory();
    state.entities = [];
    clearSelection();
    state.lastMeasure = null;
    state.commandState = null;
    state.drawStart = null;
    state.dimensionSecond = null;
    state.dimensionThird = null;
    state.previewPoint = null;
    state.polylineAnchor = null;
    markDirty();
    queueRender();
    return true;
  }

  function startNewDrawing(options) {
    const skipPrompt = Boolean(options && options.skipPrompt);
    if (state.entities.length > 0) {
      if (!skipPrompt) {
        const approved = window.confirm(t("Czy rozpoczac nowy rysunek i usunąć bieżącą geometrię?", "Start a new drawing and remove current geometry?"));
        if (!approved) {
          return false;
        }
      }
      saveHistory();
    }

    state.entities = [];
    clearSelection();
    state.lastMeasure = null;
    state.commandState = null;
    state.drawStart = null;
    state.dimensionSecond = null;
    state.dimensionThird = null;
    state.previewPoint = null;
    state.polylineAnchor = null;
    state.selectionBoxStart = null;
    state.selectionBoxEnd = null;
    state.view.scale = 1;
    state.view.offsetX = 160;
    state.view.offsetY = 80;
    const geometryLayer = ensureLayerByName("Geometria");
    ensureLayerByName("Wymiary");
    state.activeLayerId = geometryLayer.id;
    setTool("select");
    setWorkspaceMode("draw", { persist: false });
    setRibbonPage("home", { persist: false });
    markDirty();
    queueRender();
    echoCommand(t("Utworzono nowy pusty rysunek.", "Created a new empty drawing."));
    return true;
  }

  function createLayer(name) {
    const trimmed = String(name || "").trim();
    const base = trimmed || `${t("Warstwa", "Layer")} ${state.layers.length}`;
    let candidate = base;
    let index = 1;
    while (state.layers.some((layer) => layer.name.toLowerCase() === candidate.toLowerCase())) {
      candidate = `${base} ${index}`;
      index += 1;
    }

    const newLayer = {
      id: createId(),
      name: candidate,
      visible: true,
      locked: false
    };

    saveHistory();
    state.layers.push(newLayer);
    state.activeLayerId = newLayer.id;
    newLayerNameInput.value = "";
    markDirty();
    queueRender();
    return newLayer;
  }

  function setLayerQuickAddOpen(open) {
    if (!layerQuickAddOverlay) {
      return;
    }
    const next = Boolean(open);
    layerQuickAddOverlay.hidden = !next;
    layerQuickAddOverlay.setAttribute("aria-hidden", next ? "false" : "true");
    if (next) {
      const suggestedName = `${t("Warstwa", "Layer")} ${state.layers.length}`;
      if (layerQuickAddInput) {
        layerQuickAddInput.value = suggestedName;
        requestAnimationFrame(() => {
          layerQuickAddInput.focus();
          layerQuickAddInput.select();
        });
      }
    } else if (layerQuickAddInput) {
      layerQuickAddInput.value = "";
    }
  }

  function submitQuickLayerAdd() {
    const proposedName = layerQuickAddInput ? layerQuickAddInput.value : "";
    const layer = createLayer(proposedName);
    if (!layer) {
      return false;
    }
    renderLayerPanel();
    updateStatus();
    echoCommand(`Dodano warstwę: ${layer.name}.`);
    setLayerQuickAddOpen(false);
    return true;
  }

  function deleteLayer(layerId) {
    if (state.layers.length <= 1) {
      alert(t("Musi zostac co najmniej jedna warstwa.", "At least one layer must remain."));
      return false;
    }

    const index = state.layers.findIndex((layer) => layer.id === layerId);
    if (index < 0) {
      return false;
    }

    saveHistory();
    const [removed] = state.layers.splice(index, 1);
    const fallback = state.layers[0];

    for (const entity of state.entities) {
      if (entity.layerId === removed.id) {
        entity.layerId = fallback.id;
      }
    }

    if (state.activeLayerId === removed.id) {
      state.activeLayerId = fallback.id;
    }

    ensureActiveLayer();
    markDirty();
    queueRender();
    return true;
  }

  function setLayerVisible(layerId, visible) {
    const layer = getLayerById(layerId);
    if (!layer) {
      return;
    }
    layer.visible = visible;

    if (!visible) {
      const remainingSelectedIds = getSelectionIds().filter((id) => {
        const selected = getEntityById(id);
        return selected && selected.layerId !== layer.id;
      });
      setSelection(remainingSelectedIds, remainingSelectedIds.length ? remainingSelectedIds[remainingSelectedIds.length - 1] : null);
    }

    markDirty();
    queueRender();
  }

  function setLayerLocked(layerId, locked) {
    const layer = getLayerById(layerId);
    if (!layer) {
      return;
    }
    layer.locked = locked;

    const selectedOnLayer = getSelectedEntities().some((selected) => selected.layerId === layer.id);
    if (selectedOnLayer && locked) {
      state.dragging = false;
    }

    markDirty();
    queueRender();
  }

  function setActiveLayer(layerId) {
    if (!getLayerById(layerId)) {
      return;
    }
    state.activeLayerId = layerId;
    queueRender();
    markDirty();
  }

  function moveSelectedToLayer(layerId) {
    const targetLayer = getLayerById(layerId);
    if (!targetLayer) {
      return false;
    }
    const selectedEntities = getSelectedEntities();
    if (selectedEntities.length === 0) {
      return false;
    }
    if (selectedEntities.some((entity) => isEntityLocked(entity))) {
      return false;
    }
    const needsMove = selectedEntities.some((entity) => entity.layerId !== targetLayer.id);
    if (!needsMove) {
      return false;
    }

    saveHistory();
    for (const entity of selectedEntities) {
      entity.layerId = targetLayer.id;
    }
    if (!targetLayer.visible) {
      const remainingSelectedIds = getSelectionIds().filter((id) => {
        const selected = getEntityById(id);
        return selected && selected.layerId !== targetLayer.id;
      });
      setSelection(remainingSelectedIds, remainingSelectedIds.length ? remainingSelectedIds[remainingSelectedIds.length - 1] : null);
    }
    markDirty();
    queueRender();
    return true;
  }

  function moveSelectedByNudge(dx, dy) {
    const selectedEntities = getSelectedEntities();
    if (selectedEntities.length === 0) {
      return;
    }
    if (selectedEntities.some((entity) => isEntityLocked(entity))) {
      return;
    }
    saveHistory();
    for (const selected of selectedEntities) {
      moveEntity(selected, dx, dy);
    }
    markDirty();
    queueRender();
  }

  function normalizeSteelTemplate(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (["gate", "brama"].includes(normalized)) {
      return "gate";
    }
    if (["fence", "ogrodzenie", "przeslo", "przęsło"].includes(normalized)) {
      return "fence";
    }
    if (["balcony", "balkon"].includes(normalized)) {
      return "balcony";
    }
    return null;
  }

  function normalizeInfillPattern(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return null;
    }
    if (["vertical", "pion", "pionowe", "bar"].includes(normalized)) {
      return "vertical";
    }
    if (["horizontal", "poziom", "poziome"].includes(normalized)) {
      return "horizontal";
    }
    if (["grid", "siatka", "krata"].includes(normalized)) {
      return "grid";
    }
    if (["cross", "x", "krzyz", "krzyż", "krzyzowe", "krzyżowe", "ukos"].includes(normalized)) {
      return "cross";
    }
    return null;
  }

  function infillPatternLabel(pattern) {
    if (pattern === "horizontal") {
      return t("poziome", "horizontal");
    }
    if (pattern === "grid") {
      return t("siatka", "grid");
    }
    if (pattern === "cross") {
      return t("krzyżowe X", "cross X");
    }
    return t("pionowe", "vertical");
  }

  function steelTemplateLabel(template) {
    if (template === "fence") {
      return t("Ogrodzenie", "Fence");
    }
    if (template === "balcony") {
      return t("Balkon", "Balcony");
    }
    return t("Brama", "Gate");
  }

  function getSteelPreset(template) {
    const normalized = normalizeSteelTemplate(template) || "gate";
    const preset = STEEL_TEMPLATE_PRESETS[normalized] || STEEL_TEMPLATE_PRESETS.gate;
    return {
      template: normalized,
      width: preset.width,
      height: preset.height,
      frameProfile: preset.frameProfile,
      postWidth: Math.max(20, Number(preset.postWidth) || 60),
      postLength: Math.max(Number(preset.height) || 200, Number(preset.postLength) || Number(preset.height) || 200),
      barWidth: preset.barWidth,
      panelCount: clamp(Math.round(Number(preset.panelCount) || 12), 1, 120, 12),
      infillPattern: preset.infillPattern,
      topPanel: preset.topPanel !== false,
      topPanelThickness: Math.max(2, Number(preset.topPanelThickness) || Number(preset.barWidth) || 20),
      bottomPanel: preset.bottomPanel !== false,
      bottomPanelThickness: Math.max(2, Number(preset.bottomPanelThickness) || Number(preset.barWidth) || 20),
      sectionCount: preset.sectionCount,
      gateLeafCount: Math.max(1, Math.min(2, Number(preset.gateLeafCount) || (normalized === "gate" ? 2 : 1))),
      groundClearance: preset.groundClearance,
      basePlateHeight: preset.basePlateHeight,
      innerFrame: preset.innerFrame,
      diagonal: preset.diagonal
    };
  }

  function syncSteelTemplateMeta() {
    const template = normalizeSteelTemplate(state.steelPreset) || "gate";
    const meta = STEEL_TEMPLATE_META[template] || STEEL_TEMPLATE_META.gate;
    const visibleFieldsByTemplate = {
      gate: new Set([
        "template",
        "width",
        "height",
        "frameProfile",
        "groundClearance",
        "infillPattern",
        "barWidth",
        "panelCount",
        "topPanel",
        "bottomPanel",
        "gateLeafCount",
        "innerFrame",
        "diagonal"
      ]),
      fence: new Set([
        "template",
        "width",
        "height",
        "frameProfile",
        "groundClearance",
        "basePlateHeight",
        "sectionCount",
        "infillPattern",
        "barWidth",
        "panelCount",
        "topPanel",
        "bottomPanel",
        "postWidth",
        "postLength"
      ]),
      balcony: new Set([
        "template",
        "width",
        "height",
        "frameProfile",
        "infillPattern",
        "barWidth",
        "panelCount",
        "topPanel",
        "bottomPanel",
        "sectionCount",
        "postWidth"
      ])
    };
    const visibleFields = visibleFieldsByTemplate[template] || visibleFieldsByTemplate.gate;

    if (steelTemplateHint) {
      steelTemplateHint.textContent = meta.hint;
    }
    if (steelTemplateBadges) {
      steelTemplateBadges.replaceChildren();
      meta.badges.forEach((badgeText) => {
        const badge = document.createElement("span");
        badge.className = "steel-template-badge";
        badge.textContent = badgeText;
        steelTemplateBadges.appendChild(badge);
      });
    }

    document.querySelectorAll(".steel-control[data-steel-field]").forEach((control) => {
      const field = String(control.getAttribute("data-steel-field") || "").trim();
      control.toggleAttribute("hidden", !visibleFields.has(field));
    });
    document.querySelectorAll(".steel-card").forEach((card) => {
      const controls = Array.from(card.querySelectorAll(".steel-control[data-steel-field]"));
      if (!controls.length) {
        card.hidden = false;
        return;
      }
      const anyVisible = controls.some((control) => !control.hasAttribute("hidden"));
      card.toggleAttribute("hidden", !anyVisible);
    });
    if (steelOptionsCardTitle) {
      steelOptionsCardTitle.textContent =
        template === "fence"
          ? t("Opcje ogrodzenia", "Fence options")
          : template === "balcony"
            ? t("Opcje balkonu", "Balcony options")
            : t("Opcje bramy", "Gate options");
    }

    state.steelPanelCount = clamp(Math.round(Number(state.steelPanelCount) || 12), 1, 120, 12);

    const postControlEnabled = template === "fence";
    const postWidthControl =
      steelPostWidthInput && steelPostWidthInput.closest(".steel-control")
        ? steelPostWidthInput.closest(".steel-control")
        : null;
    const postLengthControl =
      steelPostLengthInput && steelPostLengthInput.closest(".steel-control")
        ? steelPostLengthInput.closest(".steel-control")
        : null;
    if (steelPostWidthInput) {
      steelPostWidthInput.disabled = !postControlEnabled;
    }
    if (steelPostLengthInput) {
      steelPostLengthInput.disabled = !postControlEnabled;
    }
    if (steelPostWidthHint) {
      steelPostWidthHint.textContent = postControlEnabled
        ? t("Dotyczy słupków ogrodzenia.", "Applies to fence posts.")
        : t("Opcja dostępna tylko dla szablonu Ogrodzenie.", "Option available only for Fence template.");
    }
    if (steelPostLengthHint) {
      steelPostLengthHint.textContent = postControlEnabled
        ? t("Nadmiar długości słupka schodzi w dół poniżej przęsła.", "Extra post length extends below the section.")
        : t("Opcja dostępna tylko dla szablonu Ogrodzenie.", "Option available only for Fence template.");
    }
    if (postWidthControl) {
      postWidthControl.classList.toggle("is-disabled", !postControlEnabled);
    }
    if (postLengthControl) {
      postLengthControl.classList.toggle("is-disabled", !postControlEnabled);
    }

    const leafControl =
      steelGateLeafCountSelect && steelGateLeafCountSelect.closest(".steel-control")
        ? steelGateLeafCountSelect.closest(".steel-control")
        : null;
    const leafAllowed = template === "gate";
    if (steelGateLeafCountSelect) {
      steelGateLeafCountSelect.disabled = !leafAllowed;
      steelGateLeafCountSelect.value = String(Math.max(1, Math.min(2, state.steelGateLeafCount)));
    }
    if (steelGateLeafCountHint) {
      steelGateLeafCountHint.textContent = leafAllowed
        ? t("Podział szerokości na skrzydła (dotyczy tylko bramy).", "Splits width into leaves (gate only).")
        : t("Opcja dostępna tylko dla szablonu Brama.", "Option available only for Gate template.");
    }
    if (leafControl) {
      leafControl.classList.toggle("is-disabled", !leafAllowed);
    }

    const diagonalAllowed = template === "gate";
    if (!diagonalAllowed) {
      state.steelDiagonal = false;
    }
    if (steelDiagonalToggle) {
      steelDiagonalToggle.disabled = !diagonalAllowed;
      steelDiagonalToggle.checked = state.steelDiagonal;
    }
    if (steelDiagonalHint) {
      steelDiagonalHint.textContent = diagonalAllowed
        ? t("Dodatkowe usztywnienie po przekątnej.", "Additional diagonal reinforcement.")
        : t("Opcja dostępna tylko dla szablonu Brama.", "Option available only for Gate template.");
    }
    const diagonalControl =
      steelDiagonalToggle && steelDiagonalToggle.closest(".steel-control")
        ? steelDiagonalToggle.closest(".steel-control")
        : null;
    if (diagonalControl) {
      diagonalControl.classList.toggle("is-disabled", !diagonalAllowed);
    }
    updateSteelPanelCountHint();
  }

  function applySteelPreset(template, options) {
    const preset = getSteelPreset(template);
    state.steelPreset = preset.template;
    state.steelWidth = preset.width;
    state.steelHeight = preset.height;
    state.steelFrameProfile = preset.frameProfile;
    state.steelPostWidth = preset.postWidth;
    state.steelPostLength = preset.postLength;
    state.steelBarWidth = preset.barWidth;
    state.steelPanelCount = preset.panelCount;
    state.steelInfillPattern = preset.infillPattern;
    state.steelTopPanel = preset.topPanel;
    state.steelTopPanelThickness = preset.topPanelThickness;
    state.steelBottomPanel = preset.bottomPanel;
    state.steelBottomPanelThickness = preset.bottomPanelThickness;
    state.steelSectionCount = preset.sectionCount;
    state.steelGateLeafCount = preset.gateLeafCount;
    state.steelGroundClearance = preset.groundClearance;
    state.steelBasePlateHeight = preset.basePlateHeight;
    state.steelInnerFrame = preset.innerFrame;
    state.steelDiagonal = preset.diagonal;

    syncDocumentControls();
    markDirty();

    if (!options || options.announce !== false) {
      echoCommand(
        t(
          `Szablon ${steelTemplateLabel(preset.template)}: ustawiono domyślne parametry (${preset.width}x${preset.height} mm).`,
          `Template ${steelTemplateLabel(preset.template)}: set default parameters (${preset.width}x${preset.height} mm).`
        )
      );
    }
  }

  function isFinitePositiveNumber(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0;
  }

  function ensureLayerByName(name) {
    const existing = findLayerByName(name);
    if (existing) {
      return existing;
    }
    const layer = {
      id: createId(),
      name,
      visible: true,
      locked: false
    };
    state.layers.push(layer);
    return layer;
  }

  function ensureDefaultDrawingLayers() {
    const geometryLayer = ensureLayerByName("Geometria");
    ensureLayerByName("Wymiary");

    if (!getLayerById(state.activeLayerId)) {
      state.activeLayerId = geometryLayer.id;
    }
  }

  function ensureLayerVisibleUnlocked(layer) {
    if (!layer) {
      return false;
    }
    let changed = false;
    if (layer.visible === false) {
      layer.visible = true;
      changed = true;
    }
    if (layer.locked) {
      layer.locked = false;
      changed = true;
    }
    return changed;
  }

  function ensureVisibleLayersForExistingEntities() {
    if (!Array.isArray(state.entities) || state.entities.length === 0) {
      return false;
    }
    const anyVisibleEntity = state.entities.some((entity) => isEntityVisible(entity));
    if (anyVisibleEntity) {
      return false;
    }

    const usedLayerIds = new Set(state.entities.map((entity) => entity.layerId));
    let changed = false;
    state.layers.forEach((layer) => {
      if (!usedLayerIds.has(layer.id)) {
        return;
      }
      if (layer.visible === false) {
        layer.visible = true;
        changed = true;
      }
      if (layer.locked) {
        layer.locked = false;
        changed = true;
      }
    });
    return changed;
  }

  function getViewportCenterWorld() {
    const size = getCanvasSize();
    return screenToWorld({ x: size.width / 2, y: size.height / 2 });
  }

  function addSteelRect(x, y, w, h, layerId, stroke, fillAlpha) {
    if (![x, y, w, h].every((value) => isFiniteNumber(value))) {
      return 0;
    }
    if (Math.abs(w) < 0.001 || Math.abs(h) < 0.001) {
      return 0;
    }
    const entity = {
      ...createBaseEntity("rect"),
      x,
      y,
      w,
      h,
      layerId,
      stroke: stroke || state.strokeColor,
      lineWidth: 1,
      lineStyle: "solid",
      fill: true,
      fillColor: stroke || state.fillColor,
      fillAlpha: clamp(Number(fillAlpha), 0, 100, 16)
    };
    state.entities.push(entity);
    return 1;
  }

  function addSteelLine(x1, y1, x2, y2, layerId, stroke) {
    if (![x1, y1, x2, y2].every((value) => isFiniteNumber(value))) {
      return 0;
    }
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 0.001) {
      return 0;
    }
    const entity = {
      ...createBaseEntity("line"),
      x1,
      y1,
      x2,
      y2,
      layerId,
      stroke: stroke || state.strokeColor,
      lineWidth: 1,
      lineStyle: "solid"
    };
    state.entities.push(entity);
    return 1;
  }

  function addFrameProfile(originX, originY, width, height, sideProfile, layerId, stroke) {
    if (![originX, originY, width, height, sideProfile].every((value) => isFiniteNumber(value))) {
      return {
        created: 0,
        inner: {
          x: 0,
          y: 0,
          w: 0,
          h: 0
        },
        thickness: 0
      };
    }
    const side = Math.max(8, Math.min(Number(sideProfile) || 8, width / 2, height));
    let created = 0;
    created += addSteelRect(originX, originY, side, height, layerId, stroke, 18);
    created += addSteelRect(originX + width - side, originY, side, height, layerId, stroke, 18);

    return {
      created,
      inner: {
        x: originX + side,
        y: originY,
        w: Math.max(0, width - 2 * side),
        h: Math.max(0, height)
      },
      thickness: side
    };
  }

  function resolvePanelCountFromGap(span, bar, requestedGap) {
    const safeSpan = Math.max(0, Number(span) || 0);
    const safeBar = Math.max(5, Number(bar) || 5);
    const safeGap = Math.max(5, Number(requestedGap) || 5);
    const minGap = 5;

    if (safeSpan <= safeBar) {
      return { count: 1, gap: 0, edgeOffset: Math.max(0, (safeSpan - safeBar) / 2), maxCount: 1, minGap };
    }

    const maxCount = Math.max(1, Math.floor(safeSpan / safeBar));
    let count = Math.floor((safeSpan + safeGap) / (safeBar + safeGap));
    count = Math.max(1, Math.min(maxCount, count));

    if (count === 1) {
      return { count: 1, gap: 0, edgeOffset: Math.max(0, (safeSpan - safeBar) / 2), maxCount, minGap };
    }

    let gap = (safeSpan - count * safeBar) / (count + 1);
    while (count > 1 && (!Number.isFinite(gap) || gap < minGap)) {
      count -= 1;
      gap = (safeSpan - count * safeBar) / (count + 1);
    }
    if (count <= 1 || !Number.isFinite(gap)) {
      return { count: 1, gap: 0, edgeOffset: Math.max(0, (safeSpan - safeBar) / 2), maxCount, minGap };
    }

    const edgeOffset = Math.max(0, gap);
    return { count, gap, edgeOffset, maxCount, minGap };
  }

  function resolveBarLayoutByCount(span, bar, requestedCount) {
    const safeSpan = Math.max(0, Number(span) || 0);
    const safeBar = Math.max(5, Number(bar) || 5);
    const minGap = Math.max(2, Math.round(safeBar * 0.2));

    if (safeSpan <= safeBar) {
      return { count: 1, gap: 0, edgeOffset: Math.max(0, (safeSpan - safeBar) / 2), maxCount: 1, minGap };
    }

    const maxCount = Math.max(1, Math.floor((safeSpan + minGap) / (safeBar + minGap)));
    const parsedCount = Math.round(Number(requestedCount));
    let count = Number.isFinite(parsedCount) ? parsedCount : Math.min(12, maxCount);
    count = Math.max(1, Math.min(maxCount, count));

    let gap = (safeSpan - count * safeBar) / (count + 1);
    while (count > 1 && (!Number.isFinite(gap) || gap < minGap)) {
      count -= 1;
      gap = (safeSpan - count * safeBar) / (count + 1);
    }

    if (count <= 1 || !Number.isFinite(gap)) {
      return { count: 1, gap: 0, edgeOffset: Math.max(0, (safeSpan - safeBar) / 2), maxCount, minGap };
    }

    return { count, gap: Math.max(0, gap), edgeOffset: Math.max(0, gap), maxCount, minGap };
  }

  function addVerticalBars(area, barWidth, panelCount, layerId, stroke) {
    if (area.w <= 0 || area.h <= 0) {
      return { created: 0, layout: null };
    }
    const bar = Math.max(5, barWidth);
    const layout = resolveBarLayoutByCount(area.w, bar, panelCount);
    let created = 0;

    for (let index = 0; index < layout.count; index += 1) {
      const x = area.x + layout.edgeOffset + index * (bar + layout.gap);
      created += addSteelRect(x, area.y, bar, area.h, layerId, stroke, 14);
    }

    return { created, layout };
  }

  function addHorizontalBars(area, barWidth, panelCount, layerId, stroke) {
    if (area.w <= 0 || area.h <= 0) {
      return { created: 0, layout: null };
    }
    const bar = Math.max(5, barWidth);
    const layout = resolveBarLayoutByCount(area.h, bar, panelCount);
    let created = 0;
    for (let index = 0; index < layout.count; index += 1) {
      const y = area.y + layout.edgeOffset + index * (bar + layout.gap);
      created += addSteelRect(area.x, y, area.w, bar, layerId, stroke, 14);
    }
    return { created, layout };
  }

  function addCrossInfill(area, layerId, stroke) {
    if (area.w <= 0 || area.h <= 0) {
      return 0;
    }
    let created = 0;
    created += addSteelLine(area.x, area.y, area.x + area.w, area.y + area.h, layerId, stroke);
    created += addSteelLine(area.x, area.y + area.h, area.x + area.w, area.y, layerId, stroke);
    return created;
  }

  function estimateSteelSectionInfillArea(options) {
    const source = options && typeof options === "object" ? options : {};
    const template = normalizeSteelTemplate(source.template) || normalizeSteelTemplate(state.steelPreset) || "gate";
    const width = Math.max(200, Number(source.width) || state.steelWidth);
    const height = Math.max(200, Number(source.height) || state.steelHeight);
    const postWidth = Math.max(20, Number(source.postWidth) || state.steelPostWidth);
    const frameProfile = Math.max(20, Number(source.frameProfile) || state.steelFrameProfile);
    const barWidth = Math.max(5, Number(source.barWidth) || state.steelBarWidth);
    const sectionCount = Math.max(
      1,
      Math.min(
        6,
        Math.round(
          Number.isFinite(Number(source.sectionCount))
            ? Number(source.sectionCount)
            : Number(state.steelSectionCount)
        )
      )
    );
    const gateLeafCount = Math.max(
      1,
      Math.min(
        2,
        Math.round(
          Number.isFinite(Number(source.gateLeafCount))
            ? Number(source.gateLeafCount)
            : Number(state.steelGateLeafCount)
        )
      )
    );
    const groundClearance = Math.max(
      0,
      Number.isFinite(Number(source.groundClearance))
        ? Number(source.groundClearance)
        : Number(state.steelGroundClearance)
    );
    const basePlateHeight = Math.max(
      0,
      Number.isFinite(Number(source.basePlateHeight))
        ? Number(source.basePlateHeight)
        : Number(state.steelBasePlateHeight)
    );
    const innerFrame =
      typeof source.innerFrame === "boolean" ? source.innerFrame : Boolean(state.steelInnerFrame);
    const topPanel = typeof source.topPanel === "boolean" ? source.topPanel : Boolean(state.steelTopPanel);
    const bottomPanel = typeof source.bottomPanel === "boolean" ? source.bottomPanel : Boolean(state.steelBottomPanel);
    const topPanelThickness = Math.max(
      2,
      Number.isFinite(Number(source.topPanelThickness))
        ? Number(source.topPanelThickness)
        : Number(state.steelTopPanelThickness) || barWidth
    );
    const bottomPanelThickness = Math.max(
      2,
      Number.isFinite(Number(source.bottomPanelThickness))
        ? Number(source.bottomPanelThickness)
        : Number(state.steelBottomPanelThickness) || barWidth
    );

    let clearWidth = 0;
    let clearHeight = height;

    if (template === "gate") {
      const leafGap = gateLeafCount > 1 ? Math.max(8, Math.round(frameProfile * 0.35)) : 0;
      const totalGap = leafGap * (gateLeafCount - 1);
      const usableWidth = width - totalGap;
      if (usableWidth <= frameProfile * 2 + 20) {
        return null;
      }
      const leafWidth = usableWidth / gateLeafCount;
      const side = Math.max(8, Math.min(frameProfile, leafWidth / 2, height));
      clearWidth = Math.max(0, leafWidth - side * 2);
    } else if (template === "fence") {
      if (width <= postWidth * 2 + 20) {
        return null;
      }
      const spanBetweenPosts = width - 2 * postWidth;
      const desiredPostGap = Math.max(8, Math.round(frameProfile * 0.25));
      const maxUsableGap = Math.max(0, (spanBetweenPosts - 2 * frameProfile - 40) / 2);
      const postGap = Math.min(desiredPostGap, maxUsableGap);
      if (postGap < 2 || spanBetweenPosts - postGap * 2 <= frameProfile * 2 + 20) {
        return null;
      }
      const frameWidth = spanBetweenPosts - postGap * 2;
      const side = Math.max(8, Math.min(frameProfile, frameWidth / 2, height));
      clearWidth = Math.max(0, frameWidth - side * 2);
    } else {
      const balconyPostWidth = Math.max(barWidth, Math.round(frameProfile * 0.8));
      clearWidth = Math.max(0, width - 2 * balconyPostWidth);
    }

    const clearanceUsed = Math.min(Math.max(0, groundClearance), Math.max(0, clearHeight - 20));
    clearHeight = Math.max(0, clearHeight - clearanceUsed);
    const baseUsed = Math.min(Math.max(0, basePlateHeight), Math.max(0, clearHeight - 20));
    clearHeight = Math.max(0, clearHeight - baseUsed);

    if (innerFrame && clearWidth > 0 && clearHeight > 0) {
      const innerProfile = Math.max(
        10,
        Math.min(Math.round(frameProfile * 0.45), Math.min(clearWidth, clearHeight) / 2)
      );
      clearWidth = Math.max(0, clearWidth - innerProfile * 2);
      clearHeight = Math.max(0, clearHeight - innerProfile * 2);
    }

    const divider = Math.max(6, barWidth);
    const availableWidth = clearWidth - divider * (sectionCount - 1);
    if (sectionCount > 1 && availableWidth > sectionCount * 20) {
      clearWidth = availableWidth / sectionCount;
    }

    if (topPanel) {
      const topUsed = Math.min(topPanelThickness, Math.max(0, clearHeight - 10));
      clearHeight = Math.max(0, clearHeight - topUsed);
    }
    if (bottomPanel) {
      const bottomUsed = Math.min(bottomPanelThickness, Math.max(0, clearHeight - 10));
      clearHeight = Math.max(0, clearHeight - bottomUsed);
    }

    if (clearWidth <= 0 || clearHeight <= 0) {
      return null;
    }

    return { w: clearWidth, h: clearHeight };
  }

  function buildSteelPanelCountAutoInfo(options) {
    const source = options && typeof options === "object" ? options : {};
    const pattern = normalizeInfillPattern(source.infillPattern) || normalizeInfillPattern(state.steelInfillPattern) || "vertical";
    if (pattern === "cross") {
      return null;
    }
    const sectionArea = estimateSteelSectionInfillArea(source);
    if (!sectionArea) {
      return null;
    }

    const bar = Math.max(
      5,
      Number.isFinite(Number(source.barWidth)) ? Number(source.barWidth) : Number(state.steelBarWidth) || 5
    );
    const requestedCount = Number.isFinite(Number(source.panelCount))
      ? Number(source.panelCount)
      : Number(state.steelPanelCount);
    const vertical = resolveBarLayoutByCount(sectionArea.w, bar, requestedCount);
    const horizontal = resolveBarLayoutByCount(sectionArea.h, bar, requestedCount);
    if (!vertical || !horizontal) {
      return null;
    }

    return {
      pattern,
      requestedCount: clamp(Math.round(requestedCount), 1, 120, 12),
      sectionArea,
      vertical,
      horizontal
    };
  }

  function updateSteelPanelCountHint() {
    if (!steelPanelCountHint) {
      return;
    }
    const baseText = t(
      "Podajesz ilość paneli, a aplikacja automatycznie dopasowuje równe przerwy.",
      "Provide panel count and the app will automatically calculate equal spacing."
    );
    const autoInfo = buildSteelPanelCountAutoInfo();
    if (!autoInfo) {
      steelPanelCountHint.textContent = baseText;
      return;
    }

    if (autoInfo.pattern === "grid") {
      steelPanelCountHint.textContent =
        t(
          `Siatka: pion ${autoInfo.vertical.count} szt. (przerwa ${Math.max(0, Math.round(autoInfo.vertical.gap))} mm), ` +
            `poziom ${autoInfo.horizontal.count} szt. (przerwa ${Math.max(0, Math.round(autoInfo.horizontal.gap))} mm).`,
          `Grid: vertical ${autoInfo.vertical.count} pcs (gap ${Math.max(0, Math.round(autoInfo.vertical.gap))} mm), ` +
            `horizontal ${autoInfo.horizontal.count} pcs (gap ${Math.max(0, Math.round(autoInfo.horizontal.gap))} mm).`
        );
      return;
    }

    const axisLayout = autoInfo.pattern === "horizontal" ? autoInfo.horizontal : autoInfo.vertical;
    const axisName = autoInfo.pattern === "horizontal" ? t("poziomo", "horizontal") : t("pionowo", "vertical");
    const clampNote =
      autoInfo.requestedCount > axisLayout.maxCount
        ? t(
            ` (maksymalnie ${axisLayout.maxCount} dla tej sekcji)`,
            ` (max ${axisLayout.maxCount} for this section)`
          )
        : "";
    steelPanelCountHint.textContent =
      t(
        `Auto ${axisName}: ${axisLayout.count} szt./sekcja${clampNote}, przerwa ${Math.max(
          0,
          Math.round(axisLayout.gap)
        )} mm.`,
        `Auto ${axisName}: ${axisLayout.count} pcs/section${clampNote}, gap ${Math.max(0, Math.round(axisLayout.gap))} mm.`
      );
  }

  function inferPanelCountFromLegacySpacing(legacySpacing, options) {
    const source = options && typeof options === "object" ? options : {};
    const pattern = normalizeInfillPattern(source.infillPattern) || normalizeInfillPattern(state.steelInfillPattern) || "vertical";
    const sectionArea = estimateSteelSectionInfillArea(source);
    if (!sectionArea) {
      return clamp(Math.round(Number(state.steelPanelCount) || 12), 1, 120, 12);
    }
    const bar = Math.max(5, Number(source.barWidth) || state.steelBarWidth);
    const gap = Math.max(5, Number(legacySpacing) || Math.round(bar * 3));
    const span = pattern === "horizontal" ? sectionArea.h : sectionArea.w;
    const layout = resolvePanelCountFromGap(span, bar, gap);
    return clamp(Math.round(layout.count), 1, 120, 12);
  }

  function addInfillPattern(
    area,
    pattern,
    barWidth,
    panelCount,
    layerId,
    stroke
  ) {
    if (area.w <= 0 || area.h <= 0) {
      return 0;
    }
    const normalized = normalizeInfillPattern(pattern) || "vertical";
    if (normalized === "cross") {
      return addCrossInfill(area, layerId, stroke);
    }
    if (normalized === "horizontal") {
      return addHorizontalBars(area, barWidth, panelCount, layerId, stroke).created;
    }
    if (normalized === "grid") {
      const vertical = addVerticalBars(area, barWidth, panelCount, layerId, stroke);
      const horizontal = addHorizontalBars(area, barWidth, panelCount, layerId, stroke);
      return vertical.created + horizontal.created;
    }
    return addVerticalBars(area, barWidth, panelCount, layerId, stroke).created;
  }

  function buildPanelInfoForArea(area, pattern, barWidth, panelCount) {
    if (!area || area.w <= 0 || area.h <= 0) {
      return null;
    }
    const normalized = normalizeInfillPattern(pattern) || "vertical";
    if (normalized === "cross") {
      return null;
    }
    const bar = Math.max(5, Number(barWidth) || 5);
    if (normalized === "horizontal") {
      return {
        pattern: normalized,
        horizontal: resolveBarLayoutByCount(area.h, bar, panelCount)
      };
    }
    if (normalized === "grid") {
      return {
        pattern: normalized,
        vertical: resolveBarLayoutByCount(area.w, bar, panelCount),
        horizontal: resolveBarLayoutByCount(area.h, bar, panelCount)
      };
    }
    return {
      pattern: normalized,
      vertical: resolveBarLayoutByCount(area.w, bar, panelCount)
    };
  }

  function getPrimaryPanelLayout(panelInfo) {
    if (!panelInfo) {
      return null;
    }
    if (panelInfo.pattern === "horizontal") {
      return panelInfo.horizontal || null;
    }
    return panelInfo.vertical || panelInfo.horizontal || null;
  }

  function applyGroundClearance(area, clearance) {
    if (!area || area.w <= 0 || area.h <= 0) {
      return {
        x: area?.x || 0,
        y: area?.y || 0,
        w: area?.w || 0,
        h: 0
      };
    }
    const safeClearance = Math.min(Math.max(0, clearance), Math.max(0, area.h - 20));
    return { x: area.x, y: area.y, w: area.w, h: Math.max(0, area.h - safeClearance) };
  }

  function applyBasePlate(area, basePlateHeight, layerId, stroke) {
    if (!area || area.w <= 0 || area.h <= 0) {
      return {
        area: {
          x: area?.x || 0,
          y: area?.y || 0,
          w: area?.w || 0,
          h: 0
        },
        created: 0
      };
    }

    const safeBase = Math.min(Math.max(0, basePlateHeight), Math.max(0, area.h - 20));
    if (safeBase <= 0) {
      return { area, created: 0 };
    }

    const created = addSteelRect(
      area.x,
      area.y + area.h - safeBase,
      area.w,
      safeBase,
      layerId,
      stroke,
      22
    );

    return {
      area: {
        x: area.x,
        y: area.y,
        w: area.w,
        h: Math.max(0, area.h - safeBase)
      },
      created
    };
  }

  function applyTopBottomPanels(area, options) {
    const topEnabled = Boolean(options?.topPanel);
    const bottomEnabled = Boolean(options?.bottomPanel);
    if (!topEnabled && !bottomEnabled) {
      return {
        area,
        created: 0
      };
    }
    if (!area || area.w <= 0 || area.h <= 0) {
      return {
        area: {
          x: area?.x || 0,
          y: area?.y || 0,
          w: area?.w || 0,
          h: 0
        },
        created: 0
      };
    }

    const fallbackThickness = Math.max(2, Number(options?.thickness) || 5);
    let topThickness = topEnabled
      ? Math.max(2, Number(options?.topThickness) || fallbackThickness)
      : 0;
    let bottomThickness = bottomEnabled
      ? Math.max(2, Number(options?.bottomThickness) || fallbackThickness)
      : 0;
    const totalThickness = topThickness + bottomThickness;
    if (totalThickness > area.h && totalThickness > 0) {
      const ratio = area.h / totalThickness;
      topThickness = topEnabled ? Math.max(1, topThickness * ratio) : 0;
      bottomThickness = bottomEnabled ? Math.max(1, bottomThickness * ratio) : 0;
    }
    let created = 0;
    let topY = area.y;
    let bottomY = area.y + area.h;

    if (topEnabled) {
      created += addSteelRect(
        area.x,
        topY,
        area.w,
        topThickness,
        options.layerId,
        options.stroke,
        14
      );
      topY += topThickness;
    }

    if (bottomEnabled) {
      bottomY -= bottomThickness;
      created += addSteelRect(
        area.x,
        bottomY,
        area.w,
        bottomThickness,
        options.layerId,
        options.stroke,
        14
      );
    }

    return {
      area: {
        x: area.x,
        y: topY,
        w: area.w,
        h: Math.max(0, bottomY - topY)
      },
      created
    };
  }

  function addSectionDivisions(area, sectionCount, dividerWidth, layerId, stroke) {
    const count = Math.max(1, Math.min(6, Math.round(sectionCount || 1)));
    if (count <= 1 || area.w <= 0 || area.h <= 0) {
      return {
        areas: [area],
        created: 0
      };
    }

    const separator = Math.max(6, dividerWidth || 10);
    const availableWidth = area.w - separator * (count - 1);
    if (availableWidth <= count * 20) {
      return {
        areas: [area],
        created: 0
      };
    }

    const sectionWidth = availableWidth / count;
    const areas = [];
    let created = 0;
    let cursor = area.x;

    for (let i = 0; i < count; i += 1) {
      areas.push({
        x: cursor,
        y: area.y,
        w: sectionWidth,
        h: area.h
      });
      cursor += sectionWidth;
      if (i < count - 1) {
        created += addSteelRect(cursor, area.y, separator, area.h, layerId, stroke, 16);
        cursor += separator;
      }
    }

    return { areas, created };
  }

  function addOptionalInnerFrame(area, enabled, profile, layerId, stroke) {
    if (!enabled || area.w <= 0 || area.h <= 0) {
      return {
        area,
        created: 0
      };
    }

    const innerProfile = Math.max(10, Math.min(Math.round(profile * 0.45), Math.min(area.w, area.h) / 2));
    const inner = addFrameProfile(area.x, area.y, area.w, area.h, innerProfile, layerId, stroke);
    return {
      area: inner.inner,
      created: inner.created
    };
  }

  function generateSteelTemplate(options) {
    const template = normalizeSteelTemplate(options.template) || "gate";
    const width = Math.max(200, Number(options.width) || state.steelWidth);
    const height = Math.max(200, Number(options.height) || state.steelHeight);
    const frameProfile = Math.max(20, Number(options.frameProfile) || state.steelFrameProfile);
    const postWidth = Math.max(20, Number(options.postWidth) || state.steelPostWidth);
    const postLengthRequested = Math.max(200, Number(options.postLength) || state.steelPostLength);
    const postLength = Math.max(height, postLengthRequested);
    const barWidth = Math.max(5, Number(options.barWidth) || state.steelBarWidth);
    let panelCount = clamp(
      Math.round(
        Number.isFinite(Number(options.panelCount))
          ? Number(options.panelCount)
          : Number(state.steelPanelCount)
      ),
      1,
      120,
      state.steelPanelCount
    );
    const infillPattern = normalizeInfillPattern(options.infillPattern) || state.steelInfillPattern;
    const sectionCount = Math.max(
      1,
      Math.min(
        6,
        Math.round(
          Number.isFinite(Number(options.sectionCount))
            ? Number(options.sectionCount)
            : Number(state.steelSectionCount)
        )
      )
    );
    const gateLeafCount = Math.max(
      1,
      Math.min(
        2,
        Math.round(Number.isFinite(Number(options.gateLeafCount)) ? Number(options.gateLeafCount) : state.steelGateLeafCount)
      )
    );
    const groundClearance = Math.max(
      0,
      Number.isFinite(Number(options.groundClearance))
        ? Number(options.groundClearance)
        : Number(state.steelGroundClearance)
    );
    const basePlateHeight = Math.max(
      0,
      Number.isFinite(Number(options.basePlateHeight))
        ? Number(options.basePlateHeight)
        : Number(state.steelBasePlateHeight)
    );
    const topPanel = typeof options.topPanel === "boolean" ? options.topPanel : Boolean(state.steelTopPanel);
    const topPanelThickness = Math.max(
      2,
      Number.isFinite(Number(options.topPanelThickness))
        ? Number(options.topPanelThickness)
        : Number(state.steelTopPanelThickness) || barWidth
    );
    const bottomPanel =
      typeof options.bottomPanel === "boolean" ? options.bottomPanel : Boolean(state.steelBottomPanel);
    const bottomPanelThickness = Math.max(
      2,
      Number.isFinite(Number(options.bottomPanelThickness))
        ? Number(options.bottomPanelThickness)
        : Number(state.steelBottomPanelThickness) || barWidth
    );
    const innerFrame =
      typeof options.innerFrame === "boolean" ? options.innerFrame : Boolean(state.steelInnerFrame);
    const diagonalRequested =
      typeof options.diagonal === "boolean" ? options.diagonal : Boolean(state.steelDiagonal);
    const diagonal = template === "gate" ? diagonalRequested : false;
    const viewportCenter = getViewportCenterWorld();
    const fallbackCenter = {
      x: isFiniteNumber(viewportCenter.x) ? Number(viewportCenter.x) : 0,
      y: isFiniteNumber(viewportCenter.y) ? Number(viewportCenter.y) : 0
    };
    const centerCandidate = options.center || state.pointerRawWorld || fallbackCenter;
    const center = {
      x: isFiniteNumber(centerCandidate && centerCandidate.x) ? Number(centerCandidate.x) : fallbackCenter.x,
      y: isFiniteNumber(centerCandidate && centerCandidate.y) ? Number(centerCandidate.y) : fallbackCenter.y
    };
    const originX = center.x - width / 2;
    const originY = center.y - height / 2;
    if (!Number.isFinite(Number(options.panelCount)) && Number.isFinite(Number(options.barSpacing))) {
      panelCount = inferPanelCountFromLegacySpacing(Number(options.barSpacing), {
        template,
        infillPattern,
        width,
        height,
        frameProfile,
        postWidth,
        barWidth,
        sectionCount,
        gateLeafCount,
        groundClearance,
        basePlateHeight,
        innerFrame,
        topPanel,
        topPanelThickness,
        bottomPanel,
        bottomPanelThickness
      });
    }

    const autoPanelPlan = buildSteelPanelCountAutoInfo({
      template,
      infillPattern,
      width,
      height,
      frameProfile,
      postWidth,
      barWidth,
      panelCount,
      sectionCount,
      gateLeafCount,
      groundClearance,
      basePlateHeight,
      innerFrame,
      topPanel,
      topPanelThickness,
      bottomPanel,
      bottomPanelThickness
    });

    const frameLayer = ensureLayerByName("KONSTRUKCJA");
    const infillLayer = ensureLayerByName("WYPELNIENIE");
    const frameStroke = "#9ad9ff";
    const infillStroke = "#d7e8ff";

    if (state.workspaceView !== "model" || state.workspaceMode !== "steel") {
      setWorkspaceMode("steel", { persist: false });
    }

    saveHistory();
    const entityCountBefore = state.entities.length;

    const layerStateAdjusted =
      ensureLayerVisibleUnlocked(frameLayer) || ensureLayerVisibleUnlocked(infillLayer);

    let created = 0;
    let generatedPanelInfo = null;
    if (template === "gate") {
      const leafGap = gateLeafCount > 1 ? Math.max(8, Math.round(frameProfile * 0.35)) : 0;
      const totalGap = leafGap * (gateLeafCount - 1);
      const usableWidth = width - totalGap;
      if (usableWidth <= frameProfile * 2 + 20) {
        echoCommand("Brama: za mała szerokość dla liczby skrzydeł.", true);
        return false;
      }
      const leafWidth = usableWidth / gateLeafCount;

      for (let leafIndex = 0; leafIndex < gateLeafCount; leafIndex += 1) {
        const leafOriginX = originX + leafIndex * (leafWidth + leafGap);
        const frame = addFrameProfile(
          leafOriginX,
          originY,
          leafWidth,
          height,
          frameProfile,
          frameLayer.id,
          frameStroke
        );
        created += frame.created;
        let infillArea = applyGroundClearance(frame.inner, groundClearance);
        const nestedFrame = addOptionalInnerFrame(
          infillArea,
          innerFrame,
          frameProfile,
          frameLayer.id,
          frameStroke
        );
        infillArea = nestedFrame.area;
        created += nestedFrame.created;
        const basePlate = applyBasePlate(infillArea, basePlateHeight, frameLayer.id, frameStroke);
        infillArea = basePlate.area;
        created += basePlate.created;
        const sections = addSectionDivisions(
          infillArea,
          sectionCount,
          Math.max(6, barWidth),
          frameLayer.id,
          frameStroke
        );
        created += sections.created;
        const diagonalSections = [];
        for (const section of sections.areas) {
          const edgePanels = applyTopBottomPanels(section, {
            topPanel,
            bottomPanel,
            thickness: barWidth,
            topThickness: topPanelThickness,
            bottomThickness: bottomPanelThickness,
            layerId: infillLayer.id,
            stroke: infillStroke
          });
          created += edgePanels.created;
          if (edgePanels.area.w > 0 && edgePanels.area.h > 0) {
            if (!generatedPanelInfo) {
              generatedPanelInfo = buildPanelInfoForArea(
                edgePanels.area,
                infillPattern,
                barWidth,
                panelCount
              );
            }
            diagonalSections.push(edgePanels.area);
            created += addInfillPattern(
              edgePanels.area,
              infillPattern,
              barWidth,
              panelCount,
              infillLayer.id,
              infillStroke
            );
          }
        }
        if (diagonal) {
          const mirrored = gateLeafCount > 1 && leafIndex % 2 === 1;
          for (const section of diagonalSections) {
            if (mirrored) {
              created += addSteelLine(
                section.x + section.w,
                section.y + section.h,
                section.x,
                section.y,
                frameLayer.id,
                frameStroke
              );
            } else {
              created += addSteelLine(
                section.x,
                section.y + section.h,
                section.x + section.w,
                section.y,
                frameLayer.id,
                frameStroke
              );
            }
          }
        }
      }
    } else if (template === "fence") {
      if (width <= postWidth * 2 + 20) {
        echoCommand("Ogrodzenie: za mała szerokość dla wybranej szerokości słupków.", true);
        return false;
      }
      const postTopY = originY;

      created += addSteelRect(originX, postTopY, postWidth, postLength, frameLayer.id, frameStroke, 20);
      created += addSteelRect(
        originX + width - postWidth,
        postTopY,
        postWidth,
        postLength,
        frameLayer.id,
        frameStroke,
        20
      );
      const spanBetweenPosts = width - 2 * postWidth;
      const desiredPostGap = Math.max(8, Math.round(frameProfile * 0.25));
      const maxUsableGap = Math.max(0, (spanBetweenPosts - 2 * frameProfile - 40) / 2);
      const postGap = Math.min(desiredPostGap, maxUsableGap);
      if (postGap < 2 || spanBetweenPosts - postGap * 2 <= frameProfile * 2 + 20) {
        echoCommand("Ogrodzenie: za mała szerokość na odstęp między słupkiem a profilem.", true);
        return false;
      }

      const outerFrame = addFrameProfile(
        originX + postWidth + postGap,
        originY,
        spanBetweenPosts - postGap * 2,
        height,
        frameProfile,
        frameLayer.id,
        frameStroke
      );
      created += outerFrame.created;
      let infillArea = outerFrame.inner;
      infillArea = applyGroundClearance(infillArea, groundClearance);
      const nestedFrame = addOptionalInnerFrame(
        infillArea,
        innerFrame,
        frameProfile,
        frameLayer.id,
        frameStroke
      );
      infillArea = nestedFrame.area;
      created += nestedFrame.created;
      const basePlate = applyBasePlate(infillArea, basePlateHeight, frameLayer.id, frameStroke);
      infillArea = basePlate.area;
      created += basePlate.created;
      const sections = addSectionDivisions(
        infillArea,
        sectionCount,
        Math.max(6, barWidth),
        frameLayer.id,
        frameStroke
      );
      created += sections.created;
      for (const section of sections.areas) {
        const edgePanels = applyTopBottomPanels(section, {
          topPanel,
          bottomPanel,
          thickness: barWidth,
          topThickness: topPanelThickness,
          bottomThickness: bottomPanelThickness,
          layerId: infillLayer.id,
          stroke: infillStroke
        });
        created += edgePanels.created;
        if (!generatedPanelInfo) {
          generatedPanelInfo = buildPanelInfoForArea(edgePanels.area, infillPattern, barWidth, panelCount);
        }
        created += addInfillPattern(
          edgePanels.area,
          infillPattern,
          barWidth,
          panelCount,
          infillLayer.id,
          infillStroke
        );
      }
    } else if (template === "balcony") {
      const postWidth = Math.max(barWidth, Math.round(frameProfile * 0.8));
      const maxPostSpacing = 1200;

      const segmentCount = Math.max(1, Math.ceil(width / maxPostSpacing));
      for (let i = 0; i <= segmentCount; i += 1) {
        const x = originX + ((width - postWidth) * i) / segmentCount;
        created += addSteelRect(x, originY, postWidth, height, frameLayer.id, frameStroke, 20);
      }

      let infillArea = {
        x: originX + postWidth,
        y: originY,
        w: Math.max(0, width - 2 * postWidth),
        h: height
      };
      infillArea = applyGroundClearance(infillArea, groundClearance);
      const nestedFrame = addOptionalInnerFrame(
        infillArea,
        innerFrame,
        frameProfile,
        frameLayer.id,
        frameStroke
      );
      infillArea = nestedFrame.area;
      created += nestedFrame.created;
      const basePlate = applyBasePlate(infillArea, basePlateHeight, frameLayer.id, frameStroke);
      infillArea = basePlate.area;
      created += basePlate.created;
      const sections = addSectionDivisions(
        infillArea,
        sectionCount,
        Math.max(6, barWidth),
        frameLayer.id,
        frameStroke
      );
      created += sections.created;
      for (const section of sections.areas) {
        const edgePanels = applyTopBottomPanels(section, {
          topPanel,
          bottomPanel,
          thickness: barWidth,
          topThickness: topPanelThickness,
          bottomThickness: bottomPanelThickness,
          layerId: infillLayer.id,
          stroke: infillStroke
        });
        created += edgePanels.created;
        if (!generatedPanelInfo) {
          generatedPanelInfo = buildPanelInfoForArea(edgePanels.area, infillPattern, barWidth, panelCount);
        }
        created += addInfillPattern(
          edgePanels.area,
          infillPattern,
          barWidth,
          panelCount,
          infillLayer.id,
          infillStroke
        );
      }
    }

    if (created === 0) {
      echoCommand("Nie utworzono geometrii szablonu.", true);
      return false;
    }

    state.steelPreset = template;
    state.steelWidth = width;
    state.steelHeight = height;
    state.steelFrameProfile = frameProfile;
    state.steelPostWidth = postWidth;
    state.steelPostLength = postLength;
    state.steelBarWidth = barWidth;
    state.steelInfillPattern = infillPattern;
    state.steelTopPanel = topPanel;
    state.steelTopPanelThickness = topPanelThickness;
    state.steelBottomPanel = bottomPanel;
    state.steelBottomPanelThickness = bottomPanelThickness;
    state.steelSectionCount = sectionCount;
    state.steelGateLeafCount = gateLeafCount;
    state.steelGroundClearance = groundClearance;
    state.steelBasePlateHeight = basePlateHeight;
    state.steelInnerFrame = innerFrame;
    state.steelDiagonal = diagonal;
    const finalPanelAutoInfo = generatedPanelInfo || autoPanelPlan;
    const finalPrimaryLayout = getPrimaryPanelLayout(finalPanelAutoInfo);
    state.steelPanelCount = finalPrimaryLayout
      ? clamp(Math.round(finalPrimaryLayout.count), 1, 120, panelCount)
      : panelCount;
    setPrimarySelection(state.entities[state.entities.length - 1].id);
    state.activeLayerId = frameLayer.id;
    if (!state.showGrid) {
      state.showGrid = true;
      syncModeIndicators();
    }
    state.lastMeasure = null;
    setWorkspaceMode("steel", { persist: false });
    setRibbonPage("design", { persist: false });
    syncDocumentControls();
    markDirty();
    resizeCanvas();
    const generatedEntities = state.entities.slice(entityCountBefore);
    const fitted = fitViewToEntities({ includeHidden: true, entities: generatedEntities });
    if (!fitted) {
      fitViewToEntities({ includeHidden: true });
    }
    queueRender();

    const templateName = steelTemplateLabel(template);
    const gateLeafSuffix = template === "gate" ? `, skrzydła ${gateLeafCount}` : "";
    echoCommand(
      `${templateName}: utworzono ${created} elementów (${Math.round(width)}x${Math.round(height)} mm${gateLeafSuffix}, ${infillPatternLabel(
        infillPattern
      )}).`
    );
    if (steelPanelCountInput) {
      steelPanelCountInput.value = String(state.steelPanelCount);
    }
    if (finalPanelAutoInfo) {
      if (finalPanelAutoInfo.pattern === "grid") {
        const vCount = finalPanelAutoInfo.vertical?.count || 0;
        const vGap = Math.max(0, Math.round(finalPanelAutoInfo.vertical?.gap || 0));
        const hCount = finalPanelAutoInfo.horizontal?.count || 0;
        const hGap = Math.max(0, Math.round(finalPanelAutoInfo.horizontal?.gap || 0));
        echoCommand(`Siatka: pion ${vCount} szt. (przerwa ${vGap} mm), poziom ${hCount} szt. (przerwa ${hGap} mm).`);
      } else {
        const layout = getPrimaryPanelLayout(finalPanelAutoInfo);
        if (layout) {
          echoCommand(
            `Panele dopasowano: ${layout.count} szt./sekcja, przerwa ${Math.max(
              0,
              Math.round(layout.gap)
            )} mm.`
          );
        }
      }
    }
    if (layerStateAdjusted) {
      echoCommand("Automatycznie odkryto i odblokowano warstwy KONSTRUKCJA/WYPELNIENIE.");
    }
    return true;
  }

  function generateSteelTemplateFromState() {
    return generateSteelTemplate({
      template: steelTemplateSelect.value,
      width: Number(steelWidthInput.value),
      height: Number(steelHeightInput.value),
      frameProfile: Number(steelFrameProfileSelect.value),
      postWidth: Number(steelPostWidthInput.value),
      postLength: Number(steelPostLengthInput.value),
      barWidth: Number(steelBarWidthInput.value),
      panelCount: Number(steelPanelCountInput.value),
      infillPattern: steelInfillPatternSelect.value,
      topPanel: steelTopPanelToggle.checked,
      topPanelThickness: Number(steelTopPanelSizeInput.value),
      bottomPanel: steelBottomPanelToggle.checked,
      bottomPanelThickness: Number(steelBottomPanelSizeInput.value),
      sectionCount: Number(steelSectionCountInput.value),
      gateLeafCount: Number(steelGateLeafCountSelect.value),
      groundClearance: Number(steelGroundClearanceInput.value),
      basePlateHeight: Number(steelBasePlateHeightInput.value),
      innerFrame: steelInnerFrameToggle.checked,
      diagonal: steelDiagonalToggle.checked,
      center: getViewportCenterWorld()
    });
  }

  function mapDxfEntities(entities) {
    const imported = [];

    function getOrCreateLayerIdByName(layerName) {
      const normalizedName = (layerName || "0").trim() || "0";
      const existing = state.layers.find((layer) => layer.name === normalizedName);
      if (existing) {
        return existing.id;
      }
      const newLayer = {
        id: createId(),
        name: normalizedName,
        visible: true,
        locked: false
      };
      state.layers.push(newLayer);
      return newLayer.id;
    }

    for (const entity of entities) {
      const layerId = getOrCreateLayerIdByName(entity["8"] || "0");

      if (entity.type === "LINE") {
        const x1 = parseFloat(entity["10"]);
        const y1 = parseFloat(entity["20"]);
        const x2 = parseFloat(entity["11"]);
        const y2 = parseFloat(entity["21"]);
        if ([x1, y1, x2, y2].every((n) => Number.isFinite(n))) {
          imported.push({
            ...createBaseEntity("line"),
            x1,
            y1,
            x2,
            y2,
            layerId
          });
        }
      } else if (entity.type === "CIRCLE") {
        const cx = parseFloat(entity["10"]);
        const cy = parseFloat(entity["20"]);
        const r = parseFloat(entity["40"]);
        if ([cx, cy, r].every((n) => Number.isFinite(n)) && r > 0) {
          imported.push({
            ...createBaseEntity("circle"),
            cx,
            cy,
            r,
            fill: false,
            fillColor: state.fillColor,
            fillAlpha: state.fillAlpha,
            layerId
          });
        }
      } else if (entity.type === "LWPOLYLINE") {
        const points = [];
        for (let i = 0; i < entity.raw.length; i += 1) {
          const pair = entity.raw[i];
          if (pair.code === "10") {
            const x = parseFloat(pair.value);
            const yPair = entity.raw[i + 1];
            if (Number.isFinite(x) && yPair && yPair.code === "20") {
              const y = parseFloat(yPair.value);
              if (Number.isFinite(y)) {
                points.push({ x, y });
              }
            }
          }
        }

        const closed = ((parseInt(entity["70"] || "0", 10) || 0) & 1) === 1;
        for (let i = 0; i < points.length - 1; i += 1) {
          imported.push({
            ...createBaseEntity("line"),
            x1: points[i].x,
            y1: points[i].y,
            x2: points[i + 1].x,
            y2: points[i + 1].y,
            layerId
          });
        }
        if (closed && points.length > 2) {
          imported.push({
            ...createBaseEntity("line"),
            x1: points[points.length - 1].x,
            y1: points[points.length - 1].y,
            x2: points[0].x,
            y2: points[0].y,
            layerId
          });
        }
      }
    }
    return imported;
  }

  function parseDxfText(text) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const pairs = [];
    for (let i = 0; i < lines.length - 1; i += 2) {
      pairs.push({ code: lines[i], value: lines[i + 1] });
    }

    const entities = [];
    let i = 0;
    while (i < pairs.length) {
      const pair = pairs[i];
      if (pair.code === "0" && pair.value !== "SECTION" && pair.value !== "ENDSEC") {
        const entity = {
          type: pair.value,
          raw: []
        };
        i += 1;
        while (i < pairs.length) {
          const current = pairs[i];
          if (current.code === "0") {
            break;
          }
          entity.raw.push(current);
          entity[current.code] = current.value;
          i += 1;
        }
        entities.push(entity);
        continue;
      }
      i += 1;
    }

    return mapDxfEntities(entities);
  }

  function toDxfText() {
    const lines = [
      "0",
      "SECTION",
      "2",
      "HEADER",
      "0",
      "ENDSEC",
      "0",
      "SECTION",
      "2",
      "ENTITIES"
    ];

    const pushLine = (layerName, x1, y1, x2, y2) => {
      lines.push(
        "0",
        "LINE",
        "8",
        layerName,
        "10",
        String(x1),
        "20",
        String(y1),
        "11",
        String(x2),
        "21",
        String(y2)
      );
    };

    for (const entity of state.entities) {
      const layerName = getLayerNameById(entity.layerId);
      if (entity.type === "line") {
        pushLine(layerName, entity.x1, entity.y1, entity.x2, entity.y2);
      } else if (entity.type === "dimension") {
        const geometry = getDimensionGeometry(entity);
        if (!geometry) {
          continue;
        }
        if (geometry.kind === "angular") {
          pushLine(layerName, geometry.vertex.x, geometry.vertex.y, geometry.d1.x, geometry.d1.y);
          pushLine(layerName, geometry.vertex.x, geometry.vertex.y, geometry.d2.x, geometry.d2.y);
          const arcPoints = getAngularArcPolyline(geometry, 36);
          for (let i = 0; i < arcPoints.length - 1; i += 1) {
            pushLine(layerName, arcPoints[i].x, arcPoints[i].y, arcPoints[i + 1].x, arcPoints[i + 1].y);
          }
        } else {
          pushLine(layerName, geometry.x1, geometry.y1, geometry.d1.x, geometry.d1.y);
          pushLine(layerName, geometry.x2, geometry.y2, geometry.d2.x, geometry.d2.y);
          pushLine(layerName, geometry.d1.x, geometry.d1.y, geometry.d2.x, geometry.d2.y);
        }
        lines.push(
          "0",
          "TEXT",
          "8",
          layerName,
          "10",
          String(geometry.text.x),
          "20",
          String(geometry.text.y),
          "40",
          String(Math.max(10, Number(entity.textSize) || 12)),
          "1",
          formatDimensionLabel(entity, geometry)
        );
      } else if (entity.type === "rect") {
        const corners = [
          { x: entity.x, y: entity.y },
          { x: entity.x + entity.w, y: entity.y },
          { x: entity.x + entity.w, y: entity.y + entity.h },
          { x: entity.x, y: entity.y + entity.h }
        ];
        for (let i = 0; i < corners.length; i += 1) {
          const a = corners[i];
          const b = corners[(i + 1) % corners.length];
          pushLine(layerName, a.x, a.y, b.x, b.y);
        }
      } else if (entity.type === "circle") {
        lines.push(
          "0",
          "CIRCLE",
          "8",
          layerName,
          "10",
          String(entity.cx),
          "20",
          String(entity.cy),
          "40",
          String(entity.r)
        );
      }
    }

    lines.push("0", "ENDSEC", "0", "EOF");
    return lines.join("\n");
  }

  function dashArrayForSvg(style) {
    if (style === "dashed") {
      return "12 8";
    }
    if (style === "dotted") {
      return "2 7";
    }
    return "";
  }

  function escapeXml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function parseHexColor(color) {
    const value = String(color || "").trim().toLowerCase();
    const match = value.match(/^#([0-9a-f]{6})$/i);
    if (!match) {
      return null;
    }
    const hex = match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (![r, g, b].every((v) => Number.isFinite(v))) {
      return null;
    }
    return { r, g, b, hex: `#${hex}` };
  }

  function getRelativeLuminance(color) {
    const rgb = parseHexColor(color);
    if (!rgb) {
      return null;
    }
    return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  }

  function toPrintStrokeColor(color) {
    const luminance = getRelativeLuminance(color);
    if (luminance === null) {
      return "#1f2d45";
    }
    return luminance > 0.72 ? "#1f2d45" : String(color);
  }

  function toPrintFillColor(color) {
    const luminance = getRelativeLuminance(color);
    if (luminance === null) {
      return "#8ea1ba";
    }
    return luminance > 0.82 ? "#8ea1ba" : String(color);
  }

  function toSvgText(options = {}) {
    const selectionOnly = Boolean(options.selectionOnly);
    const includeXmlDeclaration = options.includeXmlDeclaration !== false;
    const printFriendly = Boolean(options.printFriendly);
    const customViewBox =
      options.viewBox && typeof options.viewBox === "object" ? options.viewBox : null;
    const drawable = state.entities.filter((entity) => isEntityVisible(entity));
    const selectedVisible = getSelectedEntities().filter((entity) => isEntityVisible(entity));
    const entitiesRaw = selectionOnly
      ? selectedVisible
      : drawable.length > 0
      ? drawable
      : state.entities;
    const entities = [
      ...entitiesRaw.filter((entity) => entity.type === "fillRegion"),
      ...entitiesRaw.filter((entity) => entity.type !== "fillRegion")
    ];

    let bounds = null;
    for (const entity of entities) {
      const b = getEntityBounds(entity);
      if (!b) {
        continue;
      }
      if (!bounds) {
        bounds = { ...b };
      } else {
        bounds.minX = Math.min(bounds.minX, b.minX);
        bounds.minY = Math.min(bounds.minY, b.minY);
        bounds.maxX = Math.max(bounds.maxX, b.maxX);
        bounds.maxY = Math.max(bounds.maxY, b.maxY);
      }
    }

    if (!bounds) {
      bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    }

    let viewX;
    let viewY;
    let viewW;
    let viewH;
    if (
      customViewBox &&
      [customViewBox.x, customViewBox.y, customViewBox.w, customViewBox.h].every((value) => isFiniteNumber(value))
    ) {
      viewX = Number(customViewBox.x);
      viewY = Number(customViewBox.y);
      viewW = Math.max(1, Number(customViewBox.w));
      viewH = Math.max(1, Number(customViewBox.h));
    } else {
      const margin = 20;
      viewX = bounds.minX - margin;
      viewY = bounds.minY - margin;
      viewW = Math.max(1, bounds.maxX - bounds.minX + margin * 2);
      viewH = Math.max(1, bounds.maxY - bounds.minY + margin * 2);
    }

    const lines = entities.map((entity) => {
      const stroke = printFriendly ? toPrintStrokeColor(entity.stroke) : entity.stroke;
      const strokeWidth = entity.lineWidth;
      const dash = dashArrayForSvg(normalizeLineStyle(entity.lineStyle));
      const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";

      if (entity.type === "line") {
        return `<line x1="${entity.x1}" y1="${entity.y1}" x2="${entity.x2}" y2="${entity.y2}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr} />`;
      }

      if (entity.type === "fillRegion") {
        if (!Array.isArray(entity.points) || entity.points.length < 3) {
          return "";
        }
        const fillOpacity = clamp((entity.fillAlpha ?? 20) / 100, 0, 1, 0.2);
        const fillColor = printFriendly ? toPrintFillColor(entity.fillColor || "#00a9e0") : entity.fillColor || "#00a9e0";
        const pointsAttr = entity.points.map((point) => `${point.x},${point.y}`).join(" ");
        return `<polygon points="${pointsAttr}" stroke="none" fill="${fillColor}" fill-opacity="${fillOpacity}" />`;
      }

      if (entity.type === "dimension") {
        const geometry = getDimensionGeometry(entity);
        if (!geometry) {
          return "";
        }
        const arrow = 9;
        const label = escapeXml(formatDimensionLabel(entity, geometry));
        const textSize = Math.max(10, Number(entity.textSize) || 12);
        if (geometry.kind === "angular") {
          const arcPoints = getAngularArcPolyline(geometry, 64);
          const arcPath = arcPoints
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");
          const tangentStartX = geometry.tangentStart.x;
          const tangentStartY = geometry.tangentStart.y;
          const tangentEndX = -geometry.tangentEnd.x;
          const tangentEndY = -geometry.tangentEnd.y;
          const nxStart = -tangentStartY;
          const nyStart = tangentStartX;
          const nxEnd = -tangentEndY;
          const nyEnd = tangentEndX;
          const arrowStart1X = geometry.d1.x + tangentStartX * arrow + nxStart * (arrow * 0.45);
          const arrowStart1Y = geometry.d1.y + tangentStartY * arrow + nyStart * (arrow * 0.45);
          const arrowStart2X = geometry.d1.x + tangentStartX * arrow - nxStart * (arrow * 0.45);
          const arrowStart2Y = geometry.d1.y + tangentStartY * arrow - nyStart * (arrow * 0.45);
          const arrowEnd1X = geometry.d2.x + tangentEndX * arrow + nxEnd * (arrow * 0.45);
          const arrowEnd1Y = geometry.d2.y + tangentEndY * arrow + nyEnd * (arrow * 0.45);
          const arrowEnd2X = geometry.d2.x + tangentEndX * arrow - nxEnd * (arrow * 0.45);
          const arrowEnd2Y = geometry.d2.y + tangentEndY * arrow - nyEnd * (arrow * 0.45);
          const textAngleRaw = geometry.midAngle + Math.PI / 2;
          const textAngle =
            textAngleRaw > Math.PI / 2 || textAngleRaw < -Math.PI / 2 ? textAngleRaw + Math.PI : textAngleRaw;
          const textAngleDeg = (textAngle * 180) / Math.PI;

          return [
            `<line x1="${geometry.vertex.x}" y1="${geometry.vertex.y}" x2="${geometry.d1.x}" y2="${geometry.d1.y}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr} />`,
            `<line x1="${geometry.vertex.x}" y1="${geometry.vertex.y}" x2="${geometry.d2.x}" y2="${geometry.d2.y}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr} />`,
            `<path d="${arcPath}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr} />`,
            `<polygon points="${geometry.d1.x},${geometry.d1.y} ${arrowStart1X},${arrowStart1Y} ${arrowStart2X},${arrowStart2Y}" fill="${stroke}" />`,
            `<polygon points="${geometry.d2.x},${geometry.d2.y} ${arrowEnd1X},${arrowEnd1Y} ${arrowEnd2X},${arrowEnd2Y}" fill="${stroke}" />`,
            `<text x="${geometry.text.x}" y="${geometry.text.y}" fill="${stroke}" font-size="${textSize}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${textAngleDeg} ${geometry.text.x} ${geometry.text.y})" font-family="Segoe UI, Arial, sans-serif">${label}</text>`
          ].join("");
        }

        const ux = geometry.ux;
        const uy = geometry.uy;
        const nx = geometry.nx;
        const ny = geometry.ny;
        const arrowStart1X = geometry.d1.x + ux * arrow + nx * (arrow * 0.45);
        const arrowStart1Y = geometry.d1.y + uy * arrow + ny * (arrow * 0.45);
        const arrowStart2X = geometry.d1.x + ux * arrow - nx * (arrow * 0.45);
        const arrowStart2Y = geometry.d1.y + uy * arrow - ny * (arrow * 0.45);
        const arrowEnd1X = geometry.d2.x - ux * arrow + nx * (arrow * 0.45);
        const arrowEnd1Y = geometry.d2.y - uy * arrow + ny * (arrow * 0.45);
        const arrowEnd2X = geometry.d2.x - ux * arrow - nx * (arrow * 0.45);
        const arrowEnd2Y = geometry.d2.y - uy * arrow - ny * (arrow * 0.45);
        const textAngleRaw = Math.atan2(geometry.d2.y - geometry.d1.y, geometry.d2.x - geometry.d1.x);
        const textAngle =
          textAngleRaw > Math.PI / 2 || textAngleRaw < -Math.PI / 2 ? textAngleRaw + Math.PI : textAngleRaw;
        const textAngleDeg = (textAngle * 180) / Math.PI;

        return [
          `<line x1="${geometry.x1}" y1="${geometry.y1}" x2="${geometry.d1.x}" y2="${geometry.d1.y}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr} />`,
          `<line x1="${geometry.x2}" y1="${geometry.y2}" x2="${geometry.d2.x}" y2="${geometry.d2.y}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr} />`,
          `<line x1="${geometry.d1.x}" y1="${geometry.d1.y}" x2="${geometry.d2.x}" y2="${geometry.d2.y}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr} />`,
          `<polygon points="${geometry.d1.x},${geometry.d1.y} ${arrowStart1X},${arrowStart1Y} ${arrowStart2X},${arrowStart2Y}" fill="${stroke}" />`,
          `<polygon points="${geometry.d2.x},${geometry.d2.y} ${arrowEnd1X},${arrowEnd1Y} ${arrowEnd2X},${arrowEnd2Y}" fill="${stroke}" />`,
          `<text x="${geometry.text.x}" y="${geometry.text.y}" fill="${stroke}" font-size="${textSize}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${textAngleDeg} ${geometry.text.x} ${geometry.text.y})" font-family="Segoe UI, Arial, sans-serif">${label}</text>`
        ].join("");
      }

      if (entity.type === "rect") {
        const x = Math.min(entity.x, entity.x + entity.w);
        const y = Math.min(entity.y, entity.y + entity.h);
        const width = Math.abs(entity.w);
        const height = Math.abs(entity.h);
        const fill = entity.fill ? (printFriendly ? toPrintFillColor(entity.fillColor) : entity.fillColor) : "none";
        const fillOpacity = entity.fill ? clamp((entity.fillAlpha ?? 20) / 100, 0, 1, 0.2) : 1;
        return `<rect x="${x}" y="${y}" width="${width}" height="${height}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" fill-opacity="${fillOpacity}"${dashAttr} />`;
      }

      if (entity.type === "circle") {
        const fill = entity.fill ? (printFriendly ? toPrintFillColor(entity.fillColor) : entity.fillColor) : "none";
        const fillOpacity = entity.fill ? clamp((entity.fillAlpha ?? 20) / 100, 0, 1, 0.2) : 1;
        return `<circle cx="${entity.cx}" cy="${entity.cy}" r="${entity.r}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" fill-opacity="${fillOpacity}"${dashAttr} />`;
      }

      return "";
    });

    const svgLines = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewX} ${viewY} ${viewW} ${viewH}">`,
      ...lines,
      `</svg>`
    ];
    if (includeXmlDeclaration) {
      svgLines.unshift(`<?xml version="1.0" encoding="UTF-8"?>`);
    }
    return svgLines.join("\n");
  }

  async function openPrintPreview() {
    const canvasSize = getCanvasSize();
    const viewportViewBox = {
      x: -state.view.offsetX / Math.max(0.0001, state.view.scale),
      y: -state.view.offsetY / Math.max(0.0001, state.view.scale),
      w: Math.max(1, canvasSize.width / Math.max(0.0001, state.view.scale)),
      h: Math.max(1, canvasSize.height / Math.max(0.0001, state.view.scale))
    };
    const svgContent = toSvgText({ includeXmlDeclaration: false, printFriendly: true });
    const viewportSvgContent = toSvgText({
      includeXmlDeclaration: false,
      viewBox: viewportViewBox,
      printFriendly: true
    });
    const selectedSvgContent = toSvgText({
      selectionOnly: true,
      includeXmlDeclaration: false,
      printFriendly: true
    });
    const hasSelectionForPrint = getSelectedEntities().some((entity) => isEntityVisible(entity));
    const timestamp = new Date().toLocaleString("pl-PL");
    const documentTitle = "MadCAD - wydruk";
    let desktopError = "";
    const html = [
      "<!doctype html>",
      "<html lang=\"pl\">",
      "<head>",
      "<meta charset=\"UTF-8\" />",
      `<title>${documentTitle}</title>`,
      "<style>",
      ":root { --print-margin: 10mm; --paper-w: 210mm; --paper-h: 297mm; --svg-w: 120mm; --svg-h: 80mm; }",
      "html, body { margin: 0; padding: 0; background: #f3f5fa; color: #101418; font-family: 'Segoe UI', Arial, sans-serif; }",
      ".page { max-width: 1320px; margin: 0 auto; padding: 16px; }",
      ".header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }",
      ".header h1 { margin: 0; font-size: 18px; font-weight: 700; }",
      ".header p { margin: 0; font-size: 12px; color: #3e4a5c; }",
      ".actions { display: flex; gap: 8px; }",
      ".actions button { border: 1px solid #374968; border-radius: 6px; background: #1e2d46; color: #f7faff; padding: 8px 12px; font-size: 12px; cursor: pointer; }",
      ".toolbar { display: grid; grid-template-columns: repeat(4, minmax(170px, 1fr)); gap: 8px; align-items: end; margin-bottom: 10px; }",
      ".toolbar label { display: grid; gap: 4px; font-size: 11px; color: #2d3a4f; }",
      ".toolbar input, .toolbar select { height: 30px; border: 1px solid #9db1cc; border-radius: 6px; padding: 0 8px; background: #fff; color: #18263a; }",
      ".toolbar .check { display: flex; align-items: center; gap: 8px; height: 30px; font-size: 12px; }",
      ".toolbar-note { margin: 0 0 10px; font-size: 12px; color: #36465f; }",
      ".sheet { background: #e8edf6; border: 1px solid #c6cfdb; border-radius: 10px; box-shadow: 0 8px 18px rgba(16, 20, 30, 0.08); padding: 12px; overflow: auto; max-height: calc(100vh - 205px); display: flex; justify-content: center; align-items: flex-start; }",
      ".paper { width: var(--paper-w); min-height: var(--paper-h); background: #ffffff; border: 1px solid #d5deeb; box-shadow: 0 6px 16px rgba(17, 26, 44, 0.16); padding: var(--print-margin); }",
      ".sheet-inner { width: 100%; min-height: calc(var(--paper-h) - (var(--print-margin) * 2)); display: flex; align-items: flex-start; justify-content: flex-start; overflow: hidden; }",
      ".sheet.centered .sheet-inner { justify-content: center; align-items: center; }",
      ".sheet svg { width: var(--svg-w); height: var(--svg-h); display: block; background: #fff; max-width: none; }",
      "#printHeader[hidden] { display: none; }",
      "#printPageStyle { display: none; }",
      "@page { size: A4 portrait; margin: 10mm; }",
      "@media print {",
      "  html, body { background: #ffffff; width: var(--paper-w); height: var(--paper-h); overflow: hidden; }",
      "  .page { width: var(--paper-w); height: var(--paper-h); max-width: none; margin: 0; padding: 0; overflow: hidden; }",
      "  .header, .toolbar, .toolbar-note { display: none; }",
      "  .sheet { width: 100%; height: 100%; border: 0; border-radius: 0; box-shadow: none; padding: 0; margin: 0; overflow: hidden; max-height: none; background: #fff; display: block; break-inside: avoid; page-break-inside: avoid; }",
      "  .paper { width: 100%; height: 100%; border: 0; box-shadow: none; padding: var(--print-margin); margin: 0; box-sizing: border-box; break-inside: avoid; page-break-inside: avoid; }",
      "  .sheet-inner { width: 100%; height: 100%; min-height: 0; overflow: hidden !important; }",
      "  .sheet svg { width: var(--svg-w) !important; height: var(--svg-h) !important; max-width: none !important; }",
      "}",
      "</style>",
      "<style id=\"printPageStyle\"></style>",
      "</head>",
      "<body>",
      "<div class=\"page\">",
      "<div id=\"printHeader\" class=\"header\">",
      `<div><h1>${documentTitle}</h1><p>Data: ${timestamp}</p></div>`,
      "<div class=\"actions\"><button id=\"printNowBtn\" type=\"button\">Drukuj / Zapisz PDF</button><button type=\"button\" onclick=\"window.close()\">Zamknij</button></div>",
      "</div>",
      "<div class=\"toolbar\">",
      "<label>Zakres wydruku<select id=\"printRange\"><option value=\"current\" selected>Bieżący widok</option><option value=\"drawing\">Cały rysunek</option><option value=\"selection\">Tylko zaznaczenie</option></select></label>",
      "<label>Format strony<select id=\"printSize\"><option value=\"A4\" selected>A4</option><option value=\"A3\">A3</option><option value=\"Letter\">Letter</option><option value=\"Legal\">Legal</option></select></label>",
      "<label>Orientacja strony<select id=\"printOrientation\"><option value=\"portrait\" selected>Pion</option><option value=\"landscape\">Poziom</option></select></label>",
      "<label>Margines [mm]<input id=\"printMargin\" type=\"number\" min=\"0\" max=\"30\" step=\"1\" value=\"10\" /></label>",
      "<label>Skala wydruku [%]<input id=\"printScale\" type=\"number\" min=\"25\" max=\"2000\" step=\"5\" value=\"100\" /></label>",
      "<label class=\"check\"><input id=\"printFitToPage\" type=\"checkbox\" checked />Skala automatyczna (zalecane)</label>",
      "<label class=\"check\"><input id=\"printCenterOnPage\" type=\"checkbox\" checked />Wyśrodkuj na stronie</label>",
      "<label class=\"check\"><input id=\"printShowHeader\" type=\"checkbox\" checked />Pokaż nagłówek podglądu</label>",
      "</div>",
      "<p id=\"printSummary\" class=\"toolbar-note\"></p>",
      "<div id=\"printSheet\" class=\"sheet\">",
      "<div id=\"printPaper\" class=\"paper\">",
      "<div id=\"printCanvas\" class=\"sheet-inner\">",
      viewportSvgContent,
      "</div>",
      "</div>",
      "</div>",
      "</div>",
      "<script>",
      "(() => {",
      "  const sizeEl = document.getElementById('printSize');",
      "  const orientationEl = document.getElementById('printOrientation');",
      "  const marginEl = document.getElementById('printMargin');",
      "  const scaleEl = document.getElementById('printScale');",
      "  const rangeEl = document.getElementById('printRange');",
      "  const fitToPageEl = document.getElementById('printFitToPage');",
      "  const centerOnPageEl = document.getElementById('printCenterOnPage');",
      "  const showHeaderEl = document.getElementById('printShowHeader');",
      "  const summaryEl = document.getElementById('printSummary');",
      "  const pageStyleEl = document.getElementById('printPageStyle');",
      "  const headerEl = document.getElementById('printHeader');",
      "  const sheetEl = document.getElementById('printSheet');",
      "  const paperEl = document.getElementById('printPaper');",
      "  const printCanvasEl = document.getElementById('printCanvas');",
      "  const printNowBtn = document.getElementById('printNowBtn');",
      `  const hasSelection = ${hasSelectionForPrint ? "true" : "false"};`,
      `  const fullSvgContent = ${JSON.stringify(svgContent)};`,
      `  const viewportSvgContent = ${JSON.stringify(viewportSvgContent)};`,
      `  const selectedSvgContent = ${JSON.stringify(selectedSvgContent)};`,
      "",
      "  const clamp = (value, min, max, fallback) => {",
      "    const n = Number(value);",
      "    if (!Number.isFinite(n)) return fallback;",
      "    return Math.min(max, Math.max(min, n));",
      "  };",
      "",
      "  const getPaperSize = (size, orientation) => {",
      "    const map = { A4: [210, 297], A3: [297, 420], Letter: [216, 279], Legal: [216, 356] };",
      "    const base = map[size] || map.A4;",
      "    if (orientation === 'landscape') {",
      "      return { width: base[1], height: base[0] };",
      "    }",
      "    return { width: base[0], height: base[1] };",
      "  };",
      "",
      "  const getSvgViewBox = () => {",
      "    const svg = printCanvasEl ? printCanvasEl.querySelector('svg') : null;",
      "    if (!svg) return null;",
      "    const viewBox = svg.getAttribute('viewBox');",
      "    if (!viewBox) return null;",
      "    const values = viewBox.trim().split(/\\s+/).map((value) => Number(value));",
      "    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;",
      "    const width = Math.abs(values[2]);",
      "    const height = Math.abs(values[3]);",
      "    if (width < 0.0001 || height < 0.0001) return null;",
      "    return { width, height };",
      "  };",
      "",
      "  const getSvgGeometrySize = () => {",
      "    const svg = printCanvasEl ? printCanvasEl.querySelector('svg') : null;",
      "    if (!svg) return null;",
      "    try {",
      "      const bbox = svg.getBBox();",
      "      if (bbox && Number.isFinite(bbox.width) && Number.isFinite(bbox.height) && bbox.width > 0.0001 && bbox.height > 0.0001) {",
      "        return { width: Math.abs(bbox.width), height: Math.abs(bbox.height) };",
      "      }",
      "    } catch (_error) {}",
      "    return getSvgViewBox();",
      "  };",
      "",
      "  const getPrintableAreaMm = (paper, margin) => {",
      "    const safeMargin = clamp(margin, 0, 30, 10);",
      "    return {",
      "      width: Math.max(10, Number(paper && paper.width) - safeMargin * 2),",
      "      height: Math.max(10, Number(paper && paper.height) - safeMargin * 2)",
      "    };",
      "  };",
      "",
      "  const applySvgOutputSize = (geometry, scalePercent, paper, margin, forceFit) => {",
      "    const source = geometry && geometry.width > 0 && geometry.height > 0 ? geometry : { width: 100, height: 100 };",
      "    const printable = getPrintableAreaMm(paper, margin);",
      "    const scaleFactor = Math.max(0.25, Number(scalePercent) / 100);",
      "    let widthMm = Math.max(1, source.width * scaleFactor);",
      "    let heightMm = Math.max(1, source.height * scaleFactor);",
      "    if (forceFit) {",
      "      const shrink = Math.min(1, printable.width / Math.max(0.0001, widthMm), printable.height / Math.max(0.0001, heightMm));",
      "      widthMm *= shrink;",
      "      heightMm *= shrink;",
      "    }",
      "    document.documentElement.style.setProperty('--svg-w', `${widthMm}mm`);",
      "    document.documentElement.style.setProperty('--svg-h', `${heightMm}mm`);",
      "    return { widthMm, heightMm, printable };",
      "  };",
      "",
      "  const computeAutoScale = (paper, margin) => {",
      "    const geometry = getSvgGeometrySize();",
      "    if (!geometry) return 100;",
      "    const printable = getPrintableAreaMm(paper, margin);",
      "    const ratio = Math.min(printable.width / geometry.width, printable.height / geometry.height);",
      "    if (!Number.isFinite(ratio) || ratio <= 0) return 100;",
      "    return clamp(ratio * 100, 25, 2000, 100);",
      "  };",
      "",
      "  const parseSvgMarkup = (markup) => {",
      "    const parser = new DOMParser();",
      "    const doc = parser.parseFromString(String(markup || ''), 'image/svg+xml');",
      "    const svg = doc.documentElement && doc.documentElement.tagName && doc.documentElement.tagName.toLowerCase() === 'svg'",
      "      ? doc.documentElement",
      "      : null;",
      "    return svg ? svg.outerHTML : '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"></svg>';",
      "  };",
      "",
      "  const svgHasGeometry = (svgMarkup) => {",
      "    const parser = new DOMParser();",
      "    const doc = parser.parseFromString(String(svgMarkup || ''), 'image/svg+xml');",
      "    const svg = doc.documentElement && doc.documentElement.tagName && doc.documentElement.tagName.toLowerCase() === 'svg'",
      "      ? doc.documentElement",
      "      : null;",
      "    if (!svg) return false;",
      "    return Boolean(svg.querySelector('line,rect,circle,path,polyline,polygon,text,ellipse'));",
      "  };",
      "",
      "  const resolveRange = () => {",
      "    const requested = String((rangeEl && rangeEl.value) || 'current').toLowerCase();",
      "    if (requested === 'selection' && !hasSelection) {",
      "      return 'current';",
      "    }",
      "    return requested === 'drawing' || requested === 'selection' ? requested : 'current';",
      "  };",
      "",
      "  const applyCanvasSource = () => {",
      "    const range = resolveRange();",
      "    if (rangeEl && rangeEl.value !== range) {",
      "      rangeEl.value = range;",
      "    }",
      "    let effectiveRange = range;",
      "    let autoFallbackNote = '';",
      "    let source = viewportSvgContent;",
      "    if (range === 'drawing') {",
      "      source = fullSvgContent;",
      "    } else if (range === 'selection') {",
      "      source = selectedSvgContent;",
      "    }",
      "    if (!svgHasGeometry(source) && range === 'current' && svgHasGeometry(fullSvgContent)) {",
      "      source = fullSvgContent;",
      "      effectiveRange = 'drawing';",
      "      autoFallbackNote = 'W bieżącym widoku nie było obiektów, pokazano cały rysunek.';",
      "    }",
      "    if (printCanvasEl) {",
      "      printCanvasEl.innerHTML = parseSvgMarkup(source);",
      "    }",
      "    return { range: effectiveRange, autoFallbackNote };",
      "  };",
      "",
      "  const applySettings = (options = {}) => {",
      "    const preserveScale = Boolean(options.preserveScale);",
      "    const size = String(sizeEl.value || 'A4');",
      "    const orientation = String(orientationEl.value || 'portrait');",
      "    const margin = clamp(marginEl.value, 0, 30, 10);",
      "    const fitToPage = Boolean(fitToPageEl && fitToPageEl.checked);",
      "    const centerOnPage = Boolean(centerOnPageEl && centerOnPageEl.checked);",
      "    const showHeader = Boolean(showHeaderEl.checked);",
      "    const paper = getPaperSize(size, orientation);",
      "",
      "    const sourceState = applyCanvasSource();",
      "    const range = sourceState.range;",
      "",
      "    const manualScale = clamp(scaleEl.value, 25, 2000, 100);",
      "    const scale = fitToPage ? (preserveScale ? manualScale : computeAutoScale(paper, margin)) : manualScale;",
      "    if (scaleEl) {",
      "      scaleEl.disabled = fitToPage;",
      "    }",
      "",
      "    marginEl.value = String(Math.round(margin));",
      "    scaleEl.value = String(Math.round(scale));",
      "",
      "    document.documentElement.style.setProperty('--print-margin', `${margin}mm`);",
      "    document.documentElement.style.setProperty('--paper-w', `${paper.width}mm`);",
      "    document.documentElement.style.setProperty('--paper-h', `${paper.height}mm`);",
      "    pageStyleEl.textContent = `@page { size: ${size} ${orientation}; margin: 0; }`;",
      "    if (paperEl) {",
      "      paperEl.style.padding = `${margin}mm`;",
      "    }",
      "    const geometry = getSvgGeometrySize();",
      "    const output = applySvgOutputSize(geometry, scale, paper, margin, fitToPage);",
      "    headerEl.hidden = !showHeader;",
      "    if (sheetEl) {",
      "      sheetEl.classList.toggle('centered', centerOnPage);",
      "    }",
      "    if (summaryEl) {",
      "      const rangeLabel = range === 'drawing' ? 'Cały rysunek' : range === 'selection' ? 'Tylko zaznaczenie' : 'Bieżący widok';",
      "      const rangeInfo = range === 'current' ? 'to, co widzisz na ekranie' : range === 'drawing' ? 'cała geometria projektu' : 'tylko aktualne zaznaczenie';",
      "      const fallbackPart = sourceState.autoFallbackNote ? ` | ${sourceState.autoFallbackNote}` : '';",
      "      const scaleLabel = fitToPage ? `Auto (${Math.round(scale)}%)` : `${Math.round(scale)}%`;",
      "      summaryEl.textContent = `Zakres: ${rangeLabel} (${rangeInfo}) | Format: ${size} ${orientation === 'landscape' ? 'poziom' : 'pion'} | Skala: ${scaleLabel} | Margines: ${Math.round(margin)} mm | Rysunek: ${Math.round(output.widthMm)}×${Math.round(output.heightMm)} mm${fallbackPart}`;",
      "    }",
      "  };",
      "",
      "  if (rangeEl && !hasSelection) {",
      "    const option = rangeEl.querySelector('option[value=\"selection\"]');",
      "    if (option) {",
      "      option.disabled = true;",
      "    }",
      "    if (rangeEl.value === 'selection') {",
      "      rangeEl.value = 'current';",
      "    }",
      "  }",
      "",
      "  [rangeEl, sizeEl, orientationEl, marginEl, scaleEl, fitToPageEl, centerOnPageEl, showHeaderEl].forEach((el) => {",
      "    if (!el) return;",
      "    el.addEventListener('change', () => applySettings());",
      "    el.addEventListener('input', () => applySettings());",
      "  });",
      "",
      "  const triggerPrint = () => {",
      "    applySettings({ preserveScale: false });",
      "    requestAnimationFrame(() => {",
      "      requestAnimationFrame(() => {",
      "        window.print();",
      "      });",
      "    });",
      "  };",
      "",
      "  if (printNowBtn) {",
      "    printNowBtn.addEventListener('click', triggerPrint);",
      "  }",
      "",
      "  window.addEventListener('beforeprint', () => {",
      "    applySettings({ preserveScale: true });",
      "  });",
      "  applySettings();",
      "})();",
      "</script>",
      "</body>",
      "</html>"
    ].join("");
    if (
      window.desktopApp &&
      window.desktopApp.isDesktop &&
      typeof window.desktopApp.openPrintPreviewWindow === "function"
    ) {
      try {
        const desktopResult = await window.desktopApp.openPrintPreviewWindow({
          html,
          title: documentTitle
        });
        if (desktopResult && desktopResult.ok) {
          return { ok: true, mode: "desktop-window" };
        }
        if (desktopResult && desktopResult.error) {
          desktopError = String(desktopResult.error);
        }
      } catch (error) {
        desktopError = error && error.message ? String(error.message) : "Błąd desktopowego podglądu.";
      }
    }

    let printWindow = null;
    try {
      printWindow = window.open("", "_blank", "width=1200,height=860");
    } catch (error) {
      printWindow = null;
    }

    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return { ok: true, mode: "window" };
    }

    // Fallback bez popupu: tymczasowy iframe i systemowe okno druku.
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      iframe.setAttribute("aria-hidden", "true");
      document.body.append(iframe);
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) {
        iframe.remove();
        return { ok: false, mode: "none" };
      }
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      let didPrint = false;
      const printOnce = () => {
        if (didPrint) {
          return;
        }
        didPrint = true;
        const iframeWindow = iframe.contentWindow;
        if (iframeWindow) {
          iframeWindow.focus();
          iframeWindow.print();
        }
        setTimeout(() => {
          iframe.remove();
        }, 1200);
      };
      iframe.addEventListener("load", printOnce, { once: true });
      setTimeout(printOnce, 220);
      return { ok: true, mode: "iframe" };
    } catch (error) {
      const iframeError = error && error.message ? String(error.message) : "";
      const finalError = [desktopError, iframeError].filter(Boolean).join(" | ");
      return { ok: false, mode: "none", error: finalError || "Nie udało się otworzyć podglądu wydruku." };
    }
  }

  async function triggerPrintWithFeedback() {
    const printed = await openPrintPreview();
    echoCommand(
      printed.ok
        ? printed.mode === "window"
          ? "Otwarto podgląd wydruku. W nowym oknie wybierz Drukuj lub Zapisz jako PDF."
          : printed.mode === "desktop-window"
          ? "Otwarto podgląd wydruku w oknie aplikacji. Użyj Drukuj/Zapisz PDF."
          : "Otwarto okno systemowe druku (tryb awaryjny bez popupu)."
        : `Nie udało się otworzyć podglądu wydruku${printed.error ? `: ${printed.error}` : " (sprawdź blokadę popup)."}`,
      !printed.ok
    );
    return printed.ok;
  }

  function detectFileFilters(filename) {
    const lower = String(filename || "").trim().toLowerCase();
    if (lower.endsWith(".json")) {
      return [{ name: "JSON", extensions: ["json"] }];
    }
    if (lower.endsWith(".dxf")) {
      return [{ name: "DXF", extensions: ["dxf"] }];
    }
    if (lower.endsWith(".dwg")) {
      return [{ name: "DWG", extensions: ["dwg"] }];
    }
    if (lower.endsWith(".svg")) {
      return [{ name: "SVG", extensions: ["svg"] }];
    }
    return [{ name: "Pliki tekstowe", extensions: ["txt"] }];
  }

  async function downloadTextFile(filename, text) {
    const normalizedFilename = String(filename || "rysunek.txt").trim() || "rysunek.txt";
    const normalizedText = String(text ?? "");

    if (
      window.desktopApp &&
      window.desktopApp.isDesktop &&
      typeof window.desktopApp.saveTextFile === "function"
    ) {
      const result = await window.desktopApp.saveTextFile({
        defaultName: normalizedFilename,
        text: normalizedText,
        filters: detectFileFilters(normalizedFilename)
      });
      return result || { ok: false, canceled: false, error: "Brak odpowiedzi modułu zapisu." };
    }

    try {
      const blob = new Blob([normalizedText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = normalizedFilename;
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        anchor.remove();
      }, 0);
      return { ok: true, canceled: false };
    } catch (error) {
      return {
        ok: false,
        canceled: false,
        error: error && error.message ? String(error.message) : "Nie udało się pobrać pliku."
      };
    }
  }

  async function saveTextWithFeedback(filename, text, successLabel) {
    const result = await downloadTextFile(filename, text);
    if (!result || result.ok !== true) {
      if (result && result.canceled) {
        echoCommand("Zapis anulowany.");
      } else {
        const details = result && result.error ? `: ${result.error}` : ".";
        echoCommand(`Błąd zapisu${details}`, true);
      }
      return false;
    }
    const savedPath = result.filePath ? ` (${result.filePath})` : "";
    echoCommand(`${successLabel}${savedPath}`);
    return true;
  }

  async function ensureOdaConverterReady(options = {}) {
    if (!window.desktopApp || typeof window.desktopApp.getOdaStatus !== "function") {
      return {
        ok: false,
        canceled: false,
        error: "Brak wsparcia ODA w tej wersji aplikacji."
      };
    }

    const initialStatus = await window.desktopApp.getOdaStatus();
    if (initialStatus && initialStatus.ok && initialStatus.installed) {
      return { ok: true, canceled: false, path: initialStatus.path || null };
    }

    const interactive = options.interactive !== false;
    if (!interactive) {
      return {
        ok: false,
        canceled: false,
        error: "Nie znaleziono ODA File Converter."
      };
    }

    const chooseNow = window.confirm(
      localizeMessageText(
        "Brak ODA File Converter (wymagane dla DWG). Kliknij OK, aby wskazać ODAFileConverter albo folder/aplikację ODA File Converter, albo Anuluj, aby otworzyć stronę pobrania."
      )
    );

    if (chooseNow && typeof window.desktopApp.chooseOdaConverterPath === "function") {
      const chosen = await window.desktopApp.chooseOdaConverterPath();
      if (!chosen || chosen.canceled) {
        return { ok: false, canceled: true, error: "Wybór ODA anulowany." };
      }
      if (!chosen.ok) {
        return {
          ok: false,
          canceled: false,
          error: chosen.error || "Nie udało się ustawić ścieżki ODA."
        };
      }
      const statusAfterChoose = await window.desktopApp.getOdaStatus();
      if (statusAfterChoose && statusAfterChoose.ok && statusAfterChoose.installed) {
        echoCommand("ODA File Converter skonfigurowany poprawnie.");
        return { ok: true, canceled: false, path: statusAfterChoose.path || null };
      }
      return {
        ok: false,
        canceled: false,
        error: "Wybrana ścieżka ODA jest nieprawidłowa."
      };
    }

    if (typeof window.desktopApp.openOdaDownload === "function") {
      await window.desktopApp.openOdaDownload();
    }
    return {
      ok: false,
      canceled: true,
      error: "ODA nie jest skonfigurowane."
    };
  }

  async function exportDwgWithFeedback() {
    if (!window.desktopApp || typeof window.desktopApp.convertCadFile !== "function") {
      echoCommand("Eksport DWG jest dostępny tylko w wersji desktop z konwerterem ODA.", true);
      return false;
    }
    const oda = await ensureOdaConverterReady({ interactive: true });
    if (!oda.ok) {
      if (!oda.canceled) {
        alert(localizeMessageText(oda.error || "Nie znaleziono ODA File Converter."));
        echoCommand(`Błąd ODA: ${oda.error || "Nie znaleziono ODA File Converter."}`, true);
      }
      return false;
    }
    const result = await window.desktopApp.convertCadFile({
      mode: "dxf-text-to-dwg",
      dxfText: toDxfText(),
      defaultName: "rysunek.dwg"
    });
    if (!result || result.ok !== true) {
      if (result && result.canceled) {
        echoCommand("Eksport DWG anulowany.", true, { toast: false });
        return false;
      }
      const errorMessage =
        result && result.error
          ? String(result.error)
          : "Nie udało się wyeksportować pliku DWG.";
      alert(localizeMessageText(errorMessage));
      echoCommand(`Błąd eksportu DWG: ${errorMessage}`, true);
      return false;
    }
    const savedPath = result.filePath ? ` (${result.filePath})` : "";
    echoCommand(`Wyeksportowano plik: rysunek.dwg${savedPath}`);
    return true;
  }

  function setDwgExportButtonState(installed) {
    if (!exportDwgBtn) {
      return;
    }
    if (installed) {
      exportDwgBtn.dataset.mode = "export-dwg";
      exportDwgBtn.textContent = formatShortcutTextForPlatform(
        t("Eksport DWG (Alt+R)", "Export DWG (Alt+R)")
      );
      return;
    }
    exportDwgBtn.dataset.mode = "install-oda";
    exportDwgBtn.textContent = t(
      "Brakuje dodatku DWG — zainstaluj (eksport)",
      "DWG add-on missing — install (export)"
    );
  }

  function setDwgImportButtonState(installed) {
    if (!importDwgBtn) {
      return;
    }
    if (installed) {
      importDwgBtn.dataset.mode = "import-dwg";
      importDwgBtn.textContent = formatShortcutTextForPlatform(
        t("Wczytaj DWG (Alt+W)", "Import DWG (Alt+W)")
      );
      return;
    }
    importDwgBtn.dataset.mode = "install-oda";
    importDwgBtn.textContent = t(
      "Brakuje dodatku DWG — zainstaluj (import)",
      "DWG add-on missing — install (import)"
    );
  }

  async function refreshDwgExportButtonState() {
    if (!window.desktopApp || typeof window.desktopApp.getOdaStatus !== "function") {
      setDwgExportButtonState(false);
      setDwgImportButtonState(false);
      return;
    }
    try {
      const status = await window.desktopApp.getOdaStatus();
      const installed = Boolean(status && status.ok && status.installed);
      setDwgExportButtonState(installed);
      setDwgImportButtonState(installed);
    } catch (_error) {
      setDwgExportButtonState(false);
      setDwgImportButtonState(false);
    }
  }

  async function installOdaAddonWithFeedback() {
    if (!window.desktopApp) {
      echoCommand("Instalacja ODA wymaga wersji desktop aplikacji.", true);
      return false;
    }
    if (typeof window.desktopApp.installOdaAddon !== "function") {
      echoCommand(
        "Automatyczna instalacja ODA niedostępna. Wskaż ODAFileConverter albo folder/aplikację ODA ręcznie.",
        true,
        { toast: false }
      );
      if (typeof window.desktopApp.chooseOdaConverterPath === "function") {
        const chosen = await window.desktopApp.chooseOdaConverterPath();
        if (!chosen || chosen.canceled) {
          return false;
        }
        if (chosen.ok) {
          echoCommand("ODA File Converter skonfigurowany poprawnie.");
          await refreshDwgExportButtonState();
          return true;
        }
      }
      if (typeof window.desktopApp.openOdaDownload === "function") {
        await window.desktopApp.openOdaDownload();
      }
      return false;
    }
    echoCommand("Instalowanie dodatku ODA (DWG)...", false, { toast: false });
    const result = await window.desktopApp.installOdaAddon();
    if (!result || result.ok !== true) {
      const errorMessage =
        result && result.error
          ? String(result.error)
          : "Nie udało się zainstalować dodatku ODA.";
      alert(localizeMessageText(errorMessage));
      echoCommand(`Błąd instalacji ODA: ${errorMessage}`, true);
      await refreshDwgExportButtonState();
      return false;
    }
    echoCommand("ODA File Converter zainstalowany. Import i eksport DWG są aktywne.");
    await refreshDwgExportButtonState();
    return true;
  }

  async function loadCadFileWithFeedback(file) {
    const fileName = String((file && file.name) || "").toLowerCase();
    const isDwg = fileName.endsWith(".dwg");
    const snapshotBeforeImport = makeSnapshot();
    let dxfText = "";

    if (isDwg) {
      if (!window.desktopApp || typeof window.desktopApp.convertCadFile !== "function") {
        throw new Error("Import DWG jest dostępny tylko w wersji desktop z konwerterem ODA.");
      }
      const oda = await ensureOdaConverterReady({ interactive: true });
      if (!oda.ok) {
        throw new Error(oda.error || "Nie znaleziono ODA File Converter.");
      }
      const sourcePath = String(file.path || "");
      if (!sourcePath) {
        throw new Error("Brak ścieżki pliku DWG. Wybierz plik z dysku lokalnego.");
      }
      const converted = await window.desktopApp.convertCadFile({
        mode: "dwg-to-dxf",
        sourcePath
      });
      if (!converted || converted.ok !== true || typeof converted.text !== "string") {
        throw new Error(
          converted && converted.error
            ? String(converted.error)
            : "Nie udało się przekonwertować DWG do DXF."
        );
      }
      dxfText = converted.text;
    } else {
      dxfText = await file.text();
    }

    const imported = parseDxfText(dxfText);
    if (imported.length === 0) {
      throw new Error("Nie znaleziono obsługiwanych encji LINE/CIRCLE/LWPOLYLINE");
    }

    state.historyUndo.push(snapshotBeforeImport);
    if (state.historyUndo.length > 250) {
      state.historyUndo.shift();
    }
    state.historyRedo = [];
    state.entities.push(...imported);
    setPrimarySelection(imported[imported.length - 1].id);
    ensureEntityLayers();
    setWorkspaceMode("draw", { persist: false });
    setRibbonPage("home", { persist: false });
    markDirty();
    queueRender();
    echoCommand(`Wczytano ${isDwg ? "DWG" : "DXF"}: ${file.name} (${imported.length} obiektów).`);
  }

  function buildProjectPayload() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      entities: state.entities,
      layers: state.layers,
      activeLayerId: state.activeLayerId
    };
  }

  function applyHoverHelpTooltips() {
    const tooltipById = {
      fileMenuBtn: "Menu plików: otwieranie, zapis, import, eksport i ustawienia aplikacji.",
      updateAppBtn: "Sprawdza i instaluje aktualizacje aplikacji.",
      licenseCategoryBtn: "Otwiera przypomnienie o licencji i wsparciu projektu.",
      loadJsonBtn: "Wczytuje projekt z pliku JSON.",
      saveJsonBtn: "Zapisuje projekt do pliku JSON.",
      importDxfBtn: "Importuje geometrię z pliku DXF.",
      importDwgBtn: "Importuje geometrię z pliku DWG przez konwerter ODA.",
      exportDxfBtn: "Eksportuje rysunek do pliku DXF.",
      exportDwgBtn: "Eksportuje rysunek do pliku DWG przez konwerter ODA.",
      exportSvgBtn: "Eksportuje rysunek do pliku SVG.",
      printDrawingBtn: "Otwiera podgląd wydruku i zapis do PDF.",
      viewPanBtn: "Włącza narzędzie panoramowania widoku.",
      viewResetBtn: "Przywraca domyślny widok roboczy.",
      undoBtn: "Cofa ostatnią operację.",
      redoBtn: "Ponawia cofniętą operację.",
      moveCmdBtn: "Przesuwa zaznaczone obiekty.",
      copyCmdBtn: "Kopiuje zaznaczone obiekty.",
      trimCmdBtn: "Przycina wskazany fragment linii do krawędzi tnącej.",
      extendCmdBtn: "Przedłuża linię do wskazanej krawędzi tnącej.",
      offsetCmdBtn: "Tworzy odsuniętą kopię wskazanego obiektu.",
      duplicateBtn: "Tworzy duplikat zaznaczonego obiektu.",
      deleteBtn: "Usuwa zaznaczony obiekt.",
      toFrontBtn: "Przenosi zaznaczony obiekt na wierzch.",
      toBackBtn: "Przenosi zaznaczony obiekt pod spód.",
      fitViewBtn: "Dopasowuje widok do wszystkich obiektów.",
      clearBtn: "Czyści cały rysunek po potwierdzeniu.",
      dimAlignedBtn: "Włącza wymiar wyrównany do mierzonego odcinka.",
      dimLinearBtn: "Włącza wymiar liniowy (poziomy/pionowy).",
      dimRotatedBtn: "Włącza wymiar obrócony według zadanego kąta.",
      dimAngularBtn: "Włącza wymiar kątowy (4 wskazania: wierzchołek, ramię 1, ramię 2, położenie łuku).",
      flyoutLayersBtn: "Otwiera panel warstw i ustawień siatki.",
      flyoutSelectionBtn: "Otwiera panel właściwości zaznaczenia.",
      layoutTabModel: "Przełącza na układ modelu roboczego.",
      layoutTabSheet1: "Przełącza na układ arkusza wydruku.",
      snapToggle: "Przyciąga kursor do siatki i punktów charakterystycznych.",
      showGridToggle: "Włącza lub wyłącza siatkę roboczą.",
      orthoToggle: "Ogranicza rysowanie do kierunku poziomego i pionowego.",
      activeLayerSelect: "Wybiera aktywną warstwę dla nowych obiektów.",
      gridSizeInput: "Ustawia rozmiar oczka siatki roboczej.",
      rectConfigWidthInput: "Ustawia szerokość prostokąta oraz szerokość zaznaczonego prostokąta.",
      rectConfigHeightInput: "Ustawia wysokość prostokąta oraz wysokość zaznaczonego prostokąta.",
      circleConfigRadiusInput: "Ustawia promień okręgu oraz promień zaznaczonego okręgu.",
      dimensionRotationInput: "Ustawia kąt wymiaru dla trybu obróconego.",
      dimensionAngleSnapInput: "Ustawia skok przyciągania kątowego podczas wskazywania punktów wymiaru.",
      newLayerNameInput: "Wpisz nazwę nowej warstwy.",
      addLayerBtn: "Dodaje nową warstwę do projektu.",
      bottomLayerSelect: "Szybko wybiera aktywną warstwę dla nowych obiektów.",
      bottomAddLayerBtn: "Szybko dodaje nową warstwę i ustawia ją jako aktywną.",
      layerQuickAddInput: "Wpisz nazwę nowej warstwy w szybkim oknie dodawania.",
      layerQuickAddConfirmBtn: "Tworzy nową warstwę i ustawia ją jako aktywną.",
      layerQuickAddCancelBtn: "Zamyka szybkie dodawanie warstwy bez zapisu.",
      layerQuickAddCloseBtn: "Zamyka szybkie dodawanie warstwy.",
      steelTopPanelSizeInput: "Ustawia wysokość panelu górnego w milimetrach.",
      steelBottomPanelSizeInput: "Ustawia wysokość panelu dolnego w milimetrach.",
      steelGenerateBtn: "Generuje konstrukcję według bieżących parametrów."
    };

    Object.entries(tooltipById).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) {
        el.title = text;
      }
    });

    const tabHelp = {
      home: "Narzędzia rysowania, modyfikacji i właściwości obiektów.",
      references: "Narzędzia i ustawienia wymiarowania.",
      design: "Generator i konfiguracja konstrukcji stalowych.",
      layout: "Przełączanie między modelem i arkuszem.",
      view: "Ustawienia widoku, siatki i paneli.",
      paint: "Wypełnia zamknięte obszary aktualnym kolorem i kryciem."
    };
    document.querySelectorAll(".ribbon-tab[data-page]").forEach((tab) => {
      const key = String(tab.dataset.page || "").trim().toLowerCase();
      if (tabHelp[key]) {
        tab.title = tabHelp[key];
      }
    });

    const toolHelp = {
      select: "Zaznacza obiekty i pozwala je edytować.",
      line: "Rysuje pojedynczy odcinek między dwoma punktami.",
      polyline: "Rysuje wieloodcinkową polilinię.",
      rect: "Rysuje prostokąt z dwóch punktów narożnych.",
      circle: "Rysuje okrąg od środka i promienia.",
      measure: "Mierzy odległość i kąt między punktami.",
      dimension: "Wstawia wymiar techniczny na rysunku.",
      pan: "Przesuwa widok roboczy bez zmiany skali."
    };
    document.querySelectorAll(".tool-btn[data-tool]").forEach((button) => {
      const key = String(button.dataset.tool || "").trim().toLowerCase();
      if (toolHelp[key]) {
        button.title = toolHelp[key];
      }
    });

    document.querySelectorAll(".control").forEach((control) => {
      const label = control.querySelector("span");
      const help = control.querySelector("small");
      const fields = Array.from(control.querySelectorAll("input, select, textarea"));
      const labelText = label ? label.textContent.replace(/\s+/g, " ").trim() : "";
      const helpText = help ? help.textContent.replace(/\s+/g, " ").trim() : "";
      const tooltipText = helpText || (labelText ? `${t("Ustawienie", "Setting")}: ${labelText}.` : "");
      if (!tooltipText) {
        return;
      }
      if (!control.title) {
        control.title = tooltipText;
      }
      fields.forEach((field) => {
        if (!field.title) {
          field.title = tooltipText;
        }
      });
    });

    document.querySelectorAll("button").forEach((button) => {
      if (button.title) {
        return;
      }
      const text = button.textContent.replace(/\s+/g, " ").trim();
      if (text) {
        button.title = `${t("Funkcja", "Action")}: ${text}.`;
      }
    });
  }

  function syncDocumentControls() {
    syncModeIndicators();
    gridSizeInput.value = String(state.gridSize);
    strokeColorInput.value = state.strokeColor;
    lineWidthInput.value = String(state.lineWidth);
    lineStyleInput.value = state.lineStyle;
    fillToggle.checked = state.fillEnabled;
    fillColorInput.value = state.fillColor;
    fillAlphaInput.value = String(state.fillAlpha);
    syncShapeConfigControls();
    if (dimensionModeSelect) {
      dimensionModeSelect.value = state.dimensionMode;
    }
    if (dimensionRotationInput) {
      dimensionRotationInput.value = String(normalizeAngleDegrees(state.dimensionRotation));
    }
    if (dimensionAngleSnapInput) {
      dimensionAngleSnapInput.value = String(clamp(Math.round(state.dimensionAngleSnap), 0, 90, 15));
    }
    if (dimensionUnitSelect) {
      dimensionUnitSelect.value = state.dimensionUnit;
    }
    if (dimensionDecimalsInput) {
      dimensionDecimalsInput.value = String(state.dimensionDecimals);
    }
    if (dimensionTextSizeInput) {
      dimensionTextSizeInput.value = String(state.dimensionTextSize);
    }
    if (dimensionColorInput) {
      dimensionColorInput.value = state.dimensionColor;
    }
    steelTemplateSelect.value = state.steelPreset;
    steelWidthInput.value = String(state.steelWidth);
    steelHeightInput.value = String(state.steelHeight);
    steelFrameProfileSelect.value = String(state.steelFrameProfile);
    if (steelFrameProfileSelect.value !== String(state.steelFrameProfile)) {
      steelFrameProfileSelect.value = "40";
      state.steelFrameProfile = 40;
    }
    steelPostWidthInput.value = String(state.steelPostWidth);
    steelPostLengthInput.value = String(state.steelPostLength);
    steelBarWidthInput.value = String(state.steelBarWidth);
    steelPanelCountInput.value = String(state.steelPanelCount);
    steelInfillPatternSelect.value = state.steelInfillPattern;
    if (steelInfillPatternSelect.value !== state.steelInfillPattern) {
      steelInfillPatternSelect.value = "vertical";
      state.steelInfillPattern = "vertical";
    }
    steelSectionCountInput.value = String(state.steelSectionCount);
    steelTopPanelToggle.checked = state.steelTopPanel;
    if (steelTopPanelSizeInput) {
      steelTopPanelSizeInput.value = String(state.steelTopPanelThickness);
    }
    steelBottomPanelToggle.checked = state.steelBottomPanel;
    if (steelBottomPanelSizeInput) {
      steelBottomPanelSizeInput.value = String(state.steelBottomPanelThickness);
    }
    steelGateLeafCountSelect.value = String(state.steelGateLeafCount);
    if (steelGateLeafCountSelect.value !== String(state.steelGateLeafCount)) {
      steelGateLeafCountSelect.value = "2";
      state.steelGateLeafCount = 2;
    }
    steelGroundClearanceInput.value = String(state.steelGroundClearance);
    steelBasePlateHeightInput.value = String(state.steelBasePlateHeight);
    steelInnerFrameToggle.checked = state.steelInnerFrame;
    steelDiagonalToggle.checked = state.steelDiagonal;
    syncSteelTemplateMeta();
    if (activeLayerSelect) {
      activeLayerSelect.value = state.activeLayerId;
    }
    if (bottomLayerSelect) {
      bottomLayerSelect.value = state.activeLayerId;
    }
    syncLayoutTabs();
    syncStartSummary();
  }

  function handleKeyDown(event) {
    const target = event.target;
    const isTextInput =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    const inLicenseDialog =
      target instanceof Element ? Boolean(target.closest("#licenseOverlay")) : false;

    if (licenseSession.active && !inLicenseDialog) {
      const isStillLicensed = enforceLicenseStorageIntegrity();
      if (!isStillLicensed) {
        event.preventDefault();
        return;
      }
    }

    if (!licenseSession.active && !inLicenseDialog) {
      event.preventDefault();
      return;
    }

    if (!isTextInput && event.code === "Space") {
      state.spacePan = true;
      event.preventDefault();
      return;
    }

    if (event.key === "F4") {
      event.preventDefault();
      setRibbonCollapsed(!state.ribbonCollapsed);
      echoCommand(`Wstążka: ${state.ribbonCollapsed ? "zwinięta" : "rozwinięta"}.`);
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      setRibbonPage("home");
      echoCommand("Zakładka: Główne.");
      return;
    }

    if (event.key === "F6") {
      event.preventDefault();
      if (state.paletteHidden) {
        setPaletteHidden(false);
        echoCommand("Panele: widoczne.");
      } else {
        setPaletteHidden(true);
        echoCommand("Panele: ukryte.");
      }
      return;
    }

    if (event.key === "F11") {
      event.preventDefault();
      setLayoutTab("model");
      echoCommand("Aktywny układ: Model.");
      return;
    }

    if (event.key === "F12") {
      event.preventDefault();
      setLayoutTab("sheet1");
      echoCommand("Aktywny układ: Arkusz1 (podgląd wydruku).");
      return;
    }

    if (event.key === "F8") {
      event.preventDefault();
      setOrthoEnabled(!state.ortho);
      echoCommand(`Poziom/Pion: ${state.ortho ? "WŁ." : "WYŁ."} (F8)`);
      return;
    }

    if (event.key === "F3") {
      event.preventDefault();
      setSnapEnabled(!state.snap);
      echoCommand(`Przyciąganie: ${state.snap ? "WŁ." : "WYŁ."} (F3)`);
      return;
    }

    if (event.key === "Escape") {
      if (isFileMenuOpen()) {
        setFileMenuOpen(false);
        return;
      }
      if (licenseOverlay && !licenseOverlay.hidden && licenseSession.active) {
        closeLicenseManager();
        return;
      }
    }

    if (isTextInput) {
      return;
    }

    if (isDirectLengthInputActive()) {
      const keyRaw = String(event.key || "");
      if (/^[0-9]$/.test(keyRaw)) {
        state.lengthInputBuffer += keyRaw;
        event.preventDefault();
        queueRender();
        return;
      }
      if ((keyRaw === "." || keyRaw === ",") && !state.lengthInputBuffer.includes(".") && !state.lengthInputBuffer.includes(",")) {
        state.lengthInputBuffer += ".";
        event.preventDefault();
        queueRender();
        return;
      }
      if ((keyRaw === "Backspace" || keyRaw === "Delete") && state.lengthInputBuffer.length > 0) {
        state.lengthInputBuffer = state.lengthInputBuffer.slice(0, -1);
        event.preventDefault();
        queueRender();
        return;
      }
      if (keyRaw === "Enter") {
        event.preventDefault();
        applyDirectLengthInput();
        return;
      }
      if (keyRaw === "Escape" && state.lengthInputBuffer.length > 0) {
        state.lengthInputBuffer = "";
        event.preventDefault();
      }
    }

    const key = event.key.toLowerCase();

    if (event.shiftKey && key === "0") {
      event.preventDefault();
      resetViewTransform();
      queueRender();
      markDirty();
      echoCommand(t("Widok został zresetowany.", "View has been reset."));
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      if (key === "z") {
        event.preventDefault();
        const changed = undo();
        echoCommand(changed ? "Cofnięto (Ctrl+Z)." : "Brak operacji do cofnięcia (Ctrl+Z).", !changed);
        return;
      }
      if (key === "y") {
        event.preventDefault();
        const changed = redo();
        echoCommand(changed ? "Ponówiono (Ctrl+Y)." : "Brak operacji do ponówienia (Ctrl+Y).", !changed);
        return;
      }
      if (key === "d") {
        event.preventDefault();
        const duplicated = duplicateSelected();
        echoCommand(
          duplicated ? "Zduplikowano obiekt (Ctrl+D)." : "Brak obiektu do duplikacji (Ctrl+D).",
          !duplicated
        );
        return;
      }
      if (key === "c") {
        event.preventDefault();
        const copied = copySelected();
        echoCommand(copied ? "Skopiowano obiekt (Ctrl+C)." : "Brak obiektu do kopiowania (Ctrl+C).", !copied);
        return;
      }
      if (key === "v") {
        event.preventDefault();
        const pasted = pasteClipboard();
        echoCommand(pasted ? "Wklejono obiekt (Ctrl+V)." : "Schowek pusty (Ctrl+V).", !pasted);
        return;
      }
      if (key === "n") {
        event.preventDefault();
        startNewDrawing();
        return;
      }
      if (key === "p") {
        event.preventDefault();
        void triggerPrintWithFeedback();
        return;
      }
      if (key === "s") {
        event.preventDefault();
        const payload = buildProjectPayload();
        void saveTextWithFeedback("rysunek.json", JSON.stringify(payload, null, 2), "Zapisano plik: rysunek.json (Ctrl+S).");
        return;
      }
      if (key === "o") {
        event.preventDefault();
        loadJsonBtn.click();
        return;
      }
      return;
    }

    if (event.altKey) {
      if (key === "m") {
        event.preventDefault();
        moveCmdBtn.click();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        copyCmdBtn.click();
        return;
      }
      if (key === "f") {
        event.preventDefault();
        offsetCmdBtn.click();
        return;
      }
      if (key === "t") {
        event.preventDefault();
        trimCmdBtn.click();
        return;
      }
      if (key === "x") {
        event.preventDefault();
        extendCmdBtn.click();
        return;
      }
      if (key === "j") {
        event.preventDefault();
        toFrontBtn.click();
        return;
      }
      if (key === "k") {
        event.preventDefault();
        toBackBtn.click();
        return;
      }
      if (key === "0") {
        event.preventDefault();
        fitViewBtn.click();
        return;
      }
      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        clearBtn.click();
        return;
      }
      if (key === "1") {
        event.preventDefault();
        dimAlignedBtn.click();
        return;
      }
      if (key === "2") {
        event.preventDefault();
        dimLinearBtn.click();
        return;
      }
      if (key === "3") {
        event.preventDefault();
        dimRotatedBtn.click();
        return;
      }
      if (key === "4") {
        event.preventDefault();
        dimAngularBtn.click();
        return;
      }
      if (key === "n") {
        event.preventDefault();
        addLayerBtn.click();
        return;
      }
      if (key === "i") {
        event.preventDefault();
        importDxfBtn.click();
        return;
      }
      if (key === "w") {
        event.preventDefault();
        if (importDwgBtn) {
          importDwgBtn.click();
        }
        return;
      }
      if (key === "e") {
        event.preventDefault();
        exportDxfBtn.click();
        return;
      }
      if (key === "r") {
        event.preventDefault();
        if (exportDwgBtn) {
          exportDwgBtn.click();
        }
        return;
      }
      if (key === "v") {
        event.preventDefault();
        exportSvgBtn.click();
        return;
      }
      if (key === "enter") {
        event.preventDefault();
        steelGenerateBtn.click();
        return;
      }
      if (key === "g") {
        event.preventDefault();
        steelGenerateBtn.click();
        return;
      }
      if (key === "q") {
        event.preventDefault();
        setActiveFlyout("selection", { persist: false });
        return;
      }
      if (key === "s") {
        event.preventDefault();
        setFileMenuOpen(!isFileMenuOpen());
        return;
      }
    }

    if (key === "enter" && state.tool === "polyline") {
      event.preventDefault();
      finishPolyline();
      return;
    }

    if (key === "delete" || key === "backspace") {
      event.preventDefault();
      const deleted = deleteSelected();
      echoCommand(deleted ? "Usunięto zaznaczony obiekt." : "Brak obiektu do usunięcia.", !deleted);
      return;
    }

    if (key === "escape") {
      resetTransientInputState();
      if (isFileMenuOpen()) {
        setFileMenuOpen(false);
        return;
      }
      if (state.activeFlyout) {
        setActiveFlyout(null, { persist: false });
        return;
      }
      const commandCancelled = cancelActiveCommand({ echo: false });
      state.lengthInputBuffer = "";
      state.panning = false;
      state.dragging = false;
      if (commandCancelled) {
        echoCommand("Polecenie anulowane.");
      }
      clearDrawingPreview();
      finishPolyline();
      clearSelection();
      if (state.tool !== "select") {
        setTool("select");
      }
      queueRender();
      return;
    }

    if (key === "arrowleft") {
      moveSelectedByNudge(-(event.shiftKey ? state.gridSize * 5 : state.gridSize), 0);
      return;
    }
    if (key === "arrowright") {
      moveSelectedByNudge(event.shiftKey ? state.gridSize * 5 : state.gridSize, 0);
      return;
    }
    if (key === "arrowup") {
      moveSelectedByNudge(0, -(event.shiftKey ? state.gridSize * 5 : state.gridSize));
      return;
    }
    if (key === "arrowdown") {
      moveSelectedByNudge(0, event.shiftKey ? state.gridSize * 5 : state.gridSize);
      return;
    }

    if (key === "z") {
      setTool("select");
      echoCommand("Skrót Z: narzędzie ZAZNACZ.");
    } else if (key === "l") {
      setTool("line");
      echoCommand("Skrót L: narzędzie LINIA.");
    } else if (key === "y") {
      setTool("polyline");
      echoCommand("Skrót Y: narzędzie POLILINIA.");
    } else if (key === "d") {
      setTool("dimension");
      echoCommand("Skrót D: narzędzie WYMIAR.");
    } else if (key === "p") {
      setTool("rect");
      echoCommand("Skrót P: narzędzie PROSTOKĄT.");
    } else if (key === "o") {
      setTool("circle");
      echoCommand("Skrót O: narzędzie OKRĄG.");
    } else if (key === "b") {
      setTool("paint");
      echoCommand("Skrót B: narzędzie MALOWANIE.");
    } else if (key === "m") {
      setTool("measure");
      echoCommand("Skrót M: narzędzie POMIAR.");
    } else if (key === "h") {
      setTool("pan");
      echoCommand("Skrót H: narzędzie PRZESUŃ.");
    } else if (key === "g") {
      setGridEnabled(!state.showGrid);
      echoCommand(`Siatka: ${state.showGrid ? "WŁ." : "WYŁ."} (G)`);
    }
  }

  function handleKeyUp(event) {
    if (event.code === "Space") {
      state.spacePan = false;
    }
  }

  function resetTransientInputState() {
    state.spacePan = false;
  }

  function initializeEvents() {
    const isLicenseUiEventTarget = (target) => {
      return target instanceof Element && Boolean(target.closest("#licenseOverlay, #licenseCategoryBtn"));
    };

    const isPassiveUiEventTarget = (target) => {
      return (
        target instanceof Element &&
        Boolean(
          target.closest(
            [
              ".ribbon-tab[data-page]",
              "#fileMenuBtn",
              "#fileMenuPanel",
              "#updateAppBtn",
              "#fitViewBtn",
              "#viewPanBtn",
              "#viewResetBtn",
              "#bottomLayerSelect",
              "#bottomAddLayerBtn",
              "#layerQuickAddOverlay",
              "#layerQuickAddInput",
              "#layerQuickAddConfirmBtn",
              "#layerQuickAddCancelBtn",
              "#layerQuickAddCloseBtn",
              "#snapToggle",
              "#showGridToggle",
              "#orthoToggle",
              ".palette-launch-btn",
              "#licenseCloseBtn",
              "#licenseOpenWebFormBtn",
              "#licenseCopyDeviceIdBtn",
              "#licenseSupportProjectBtn"
            ].join(",")
          )
        )
      );
    };

    const guardInteractionWhenLocked = (event) => {
      if (isLicenseUiEventTarget(event.target)) {
        return;
      }
      if (isPassiveUiEventTarget(event.target)) {
        return;
      }
      if (licenseSession.active) {
        const isStillLicensed = enforceLicenseStorageIntegrity();
        if (isStillLicensed) {
          return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
      openLicenseManager();
    };

    document.addEventListener("pointerdown", guardInteractionWhenLocked, true);
    document.addEventListener("click", guardInteractionWhenLocked, true);
    document.addEventListener("submit", guardInteractionWhenLocked, true);

    const licenseEntryButtons = [licenseCategoryBtn].filter(Boolean);
    licenseEntryButtons.forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        openLicenseManager();
        setFileMenuOpen(false);
        echoCommand("Otwarto menedżer licencji.");
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.detail === 0) {
          openLicenseManager();
          setFileMenuOpen(false);
          echoCommand("Otwarto menedżer licencji.");
        }
      });
    });

    if (fileMenuBtn && fileMenuPanel) {
      const toggleFileMenu = () => {
        setFileMenuOpen(!isFileMenuOpen());
      };
      let pointerHandled = false;

      fileMenuBtn.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        toggleFileMenu();
        pointerHandled = true;
      });

      fileMenuBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (pointerHandled) {
          pointerHandled = false;
          return;
        }
        toggleFileMenu();
      });

      fileMenuPanel.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        if (target.closest("button")) {
          setFileMenuOpen(false);
        }
      });
    }

    if (updateAppBtn) {
      updateAppBtn.addEventListener("click", async () => {
        if (appUpdateState.busy || appUpdateState.installing) {
          return;
        }
        const knownUpdate = appUpdateState.payload && appUpdateState.payload.available;
        if (knownUpdate) {
          await installAvailableUpdate(appUpdateState.payload);
          return;
        }
        const checked = await checkForAppUpdates({ silent: false });
        if (checked && checked.available) {
          await installAvailableUpdate(checked);
        }
      });
    }

    if (viewPanBtn) {
      viewPanBtn.addEventListener("click", () => {
        setTool("pan");
        echoCommand(`Narzędzie: ${String(TOOL_LABELS.pan || "Pan widoku").toUpperCase()}.`);
      });
    }

    if (viewResetBtn) {
      viewResetBtn.addEventListener("click", () => {
        resetViewTransform();
        queueRender();
        markDirty();
        echoCommand(t("Widok został zresetowany.", "View has been reset."));
      });
    }

    ribbonTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setFileMenuOpen(false);
        const page = normalizeRibbonPage(tab.dataset.page);
        if (state.workspaceMode === "steel") {
          setWorkspaceMode("draw", { persist: false });
        }
        if (state.workspaceView === "start") {
          setWorkspaceMode("draw", { persist: false });
        }
        if (!getAvailableRibbonPages().includes(page)) {
          echoCommand("Ta zakładka jest niedostępna w aktualnym trybie.", true);
          return;
        }
        setRibbonPage(page);
        echoCommand(`Zakładka: ${ribbonPageLabel(page)}.`);
      });
    });

    paletteLaunchButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const target = String(button.dataset.flyoutTarget || "").trim().toLowerCase();
        if (!target) {
          return;
        }
        if (state.paletteHidden) {
          setPaletteHidden(false, { persist: false });
        }
        const next = state.activeFlyout === target ? null : target;
        setActiveFlyout(next, { persist: false });
      });
    });

    toolButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setTool(button.dataset.tool);
        const label = TOOL_LABELS[button.dataset.tool] || button.dataset.tool;
        echoCommand(`Narzędzie: ${String(label).toUpperCase()}.`);
      });
    });

    if (moveCmdBtn) {
      moveCmdBtn.addEventListener("click", () => {
        startMoveCommand();
      });
    }
    if (copyCmdBtn) {
      copyCmdBtn.addEventListener("click", () => {
        startCopyCommand();
      });
    }
    if (trimCmdBtn) {
      trimCmdBtn.addEventListener("click", () => {
        startTrimCommand();
      });
    }
    if (extendCmdBtn) {
      extendCmdBtn.addEventListener("click", () => {
        startExtendCommand();
      });
    }
    if (offsetCmdBtn) {
      offsetCmdBtn.addEventListener("click", () => {
        startOffsetCommand();
      });
    }
    if (dimAlignedBtn) {
      dimAlignedBtn.addEventListener("click", () => {
        setDimensionMode("aligned");
        setTool("dimension");
        echoCommand("Tryb WYMIAR (wyrównany).");
      });
    }
    if (dimLinearBtn) {
      dimLinearBtn.addEventListener("click", () => {
        setDimensionMode("linear");
        setTool("dimension");
        echoCommand("Tryb WYMIAR (liniowy).");
      });
    }
    if (dimRotatedBtn) {
      dimRotatedBtn.addEventListener("click", () => {
        setDimensionMode("rotated");
        setTool("dimension");
        echoCommand(`Tryb WYMIAR (obrócony, kąt ${state.dimensionRotation.toFixed(1)}°).`);
      });
    }
    if (dimAngularBtn) {
      dimAngularBtn.addEventListener("click", () => {
        setDimensionMode("angular");
        setTool("dimension");
        echoCommand("Tryb WYMIAR (kątowy). Wskaż: wierzchołek, ramię 1, ramię 2, położenie łuku.");
      });
    }

    undoBtn.addEventListener("click", () => {
      const changed = undo();
      echoCommand(changed ? "Cofnięto ostatnią operację." : "Brak operacji do cofnięcia.", !changed);
    });
    redoBtn.addEventListener("click", () => {
      const changed = redo();
      echoCommand(changed ? "Przywrócono operacje." : "Brak operacji do ponówienia.", !changed);
    });
    duplicateBtn.addEventListener("click", () => {
      const selected = getEntityById(state.selectedId);
      const selectedCount = getSelectionIds().length;
      const duplicated = duplicateSelected();
      if (!duplicated) {
        echoCommand("Najpierw zaznacz obiekt do duplikacji.", true);
        return;
      }
      echoCommand(
        selectedCount > 1
          ? `Zduplikowano obiekty: ${selectedCount}.`
          : `Zduplikowano: ${selectedEntityLabel(selected)}.`
      );
    });
    deleteBtn.addEventListener("click", () => {
      const selected = getEntityById(state.selectedId);
      const selectedCount = getSelectionIds().length;
      const deleted = deleteSelected();
      if (!deleted) {
        echoCommand("Brak zaznaczonego obiektu do usunięcia.", true);
        return;
      }
      echoCommand(
        selectedCount > 1
          ? `Usunięto obiekty: ${selectedCount}.`
          : `Usunięto: ${selectedEntityLabel(selected)}.`
      );
    });
    toFrontBtn.addEventListener("click", () => {
      const moved = bringSelectedToFront();
      echoCommand(moved ? "Przeniesiono obiekt na wierzch." : "Nie można przenieść obiektu na wierzch.", !moved);
    });
    toBackBtn.addEventListener("click", () => {
      const moved = sendSelectedToBack();
      echoCommand(moved ? "Przeniesiono obiekt na spod." : "Nie można przenieść obiektu na spod.", !moved);
    });

    fitViewBtn.addEventListener("click", () => {
      const fitted = fitViewToEntities();
      echoCommand(
        fitted ? "Dopasowano widok do obiektów." : "Brak obiektów. Ustawiono widok domyślny.",
        false
      );
    });
    clearBtn.addEventListener("click", () => {
      const cleared = clearDrawing();
      if (!cleared) {
        echoCommand("Rysunek jest pusty lub anulowano czyszczenie.", true);
        return;
      }
      echoCommand("Wyczyszczono rysunek.");
    });
    snapToggle.addEventListener("click", () => {
      setSnapEnabled(!state.snap);
      echoCommand(`Przyciąganie: ${state.snap ? "WŁ." : "WYŁ."}`);
    });

    showGridToggle.addEventListener("click", () => {
      setGridEnabled(!state.showGrid);
      echoCommand(`Siatka: ${state.showGrid ? "WŁ." : "WYŁ."}`);
    });

    orthoToggle.addEventListener("click", () => {
      setOrthoEnabled(!state.ortho);
      echoCommand(`Poziom/Pion: ${state.ortho ? "WŁ." : "WYŁ."}`);
    });

    gridSizeInput.addEventListener("change", () => {
      state.gridSize = Math.max(1, Number(gridSizeInput.value) || 10);
      gridSizeInput.value = String(state.gridSize);
      queueRender();
      markDirty();
    });

    strokeColorInput.addEventListener("input", () => {
      state.strokeColor = strokeColorInput.value;
      const selected = getEntityById(state.selectedId);
      if (selected && selected.type !== "dimension" && !isEntityLocked(selected)) {
        saveHistory();
        selected.stroke = state.strokeColor;
        markDirty();
      }
      queueRender();
    });

    lineWidthInput.addEventListener("change", () => {
      state.lineWidth = Math.max(1, Number(lineWidthInput.value) || 2);
      lineWidthInput.value = String(state.lineWidth);
      const selected = getEntityById(state.selectedId);
      if (selected && !isEntityLocked(selected)) {
        saveHistory();
        selected.lineWidth = state.lineWidth;
        markDirty();
      }
      queueRender();
    });

    lineStyleInput.addEventListener("change", () => {
      state.lineStyle = normalizeLineStyle(lineStyleInput.value);
      const selected = getEntityById(state.selectedId);
      if (selected && !isEntityLocked(selected)) {
        saveHistory();
        selected.lineStyle = state.lineStyle;
        markDirty();
      }
      queueRender();
    });

    fillToggle.addEventListener("change", () => {
      state.fillEnabled = fillToggle.checked;
      const selectedFillEntities = getEditableSelectedFillEntities();
      if (selectedFillEntities.length > 0) {
        saveHistory();
        selectedFillEntities.forEach((entity) => {
          entity.fill = state.fillEnabled;
        });
        markDirty();
      }
      queueRender();
    });

    fillColorInput.addEventListener("input", () => {
      state.fillColor = fillColorInput.value;
      const selectedFillEntities = getEditableSelectedFillEntities();
      if (selectedFillEntities.length > 0) {
        saveHistory();
        selectedFillEntities.forEach((entity) => {
          entity.fillColor = state.fillColor;
        });
        markDirty();
      }
      queueRender();
    });

    fillAlphaInput.addEventListener("input", () => {
      state.fillAlpha = clamp(Number(fillAlphaInput.value), 0, 100, 20);
      fillAlphaInput.value = String(state.fillAlpha);
      const selectedFillEntities = getEditableSelectedFillEntities();
      if (selectedFillEntities.length > 0) {
        saveHistory();
        selectedFillEntities.forEach((entity) => {
          entity.fillAlpha = state.fillAlpha;
        });
        markDirty();
      }
      queueRender();
    });

    if (rectConfigWidthInput) {
      rectConfigWidthInput.addEventListener("change", () => {
        state.rectConfigWidth = Math.max(1, Number(rectConfigWidthInput.value) || state.rectConfigWidth);
        rectConfigWidthInput.value = String(Math.round(state.rectConfigWidth));
        const selected = getEntityById(state.selectedId);
        if (selected && selected.type === "rect" && !isEntityLocked(selected)) {
          saveHistory();
          selected.w = (selected.w < 0 ? -1 : 1) * state.rectConfigWidth;
          markDirty();
          queueRender();
          syncControlsFromSelection();
          return;
        }
        markDirty();
        syncShapeConfigControls();
      });
    }

    if (rectConfigHeightInput) {
      rectConfigHeightInput.addEventListener("change", () => {
        state.rectConfigHeight = Math.max(1, Number(rectConfigHeightInput.value) || state.rectConfigHeight);
        rectConfigHeightInput.value = String(Math.round(state.rectConfigHeight));
        const selected = getEntityById(state.selectedId);
        if (selected && selected.type === "rect" && !isEntityLocked(selected)) {
          saveHistory();
          selected.h = (selected.h < 0 ? -1 : 1) * state.rectConfigHeight;
          markDirty();
          queueRender();
          syncControlsFromSelection();
          return;
        }
        markDirty();
        syncShapeConfigControls();
      });
    }

    if (circleConfigRadiusInput) {
      circleConfigRadiusInput.addEventListener("change", () => {
        state.circleConfigRadius = Math.max(1, Number(circleConfigRadiusInput.value) || state.circleConfigRadius);
        circleConfigRadiusInput.value = String(Math.round(state.circleConfigRadius));
        const selected = getEntityById(state.selectedId);
        if (selected && selected.type === "circle" && !isEntityLocked(selected)) {
          saveHistory();
          selected.r = state.circleConfigRadius;
          markDirty();
          queueRender();
          syncControlsFromSelection();
          return;
        }
        markDirty();
        syncShapeConfigControls();
      });
    }

    if (dimensionModeSelect) {
      dimensionModeSelect.addEventListener("change", () => {
        setDimensionMode(dimensionModeSelect.value);
      });
    }

    if (dimensionRotationInput) {
      dimensionRotationInput.addEventListener("change", () => {
        state.dimensionRotation = normalizeAngleDegrees(dimensionRotationInput.value);
        dimensionRotationInput.value = String(state.dimensionRotation);
        markDirty();
        queueRender();
      });
    }

    if (dimensionAngleSnapInput) {
      dimensionAngleSnapInput.addEventListener("change", () => {
        state.dimensionAngleSnap = clamp(
          Math.round(Number(dimensionAngleSnapInput.value)),
          0,
          90,
          state.dimensionAngleSnap
        );
        dimensionAngleSnapInput.value = String(state.dimensionAngleSnap);
        markDirty();
      });
    }

    if (dimensionUnitSelect) {
      dimensionUnitSelect.addEventListener("change", () => {
        const value = dimensionUnitSelect.value;
        if (!["mm", "cm", "m"].includes(value)) {
          dimensionUnitSelect.value = state.dimensionUnit;
          return;
        }
        state.dimensionUnit = value;
        markDirty();
        queueRender();
      });
    }

    if (dimensionDecimalsInput) {
      dimensionDecimalsInput.addEventListener("change", () => {
        state.dimensionDecimals = clamp(
          Math.round(Number(dimensionDecimalsInput.value)),
          0,
          4,
          state.dimensionDecimals
        );
        dimensionDecimalsInput.value = String(state.dimensionDecimals);
        markDirty();
        queueRender();
      });
    }

    if (dimensionTextSizeInput) {
      dimensionTextSizeInput.addEventListener("change", () => {
        state.dimensionTextSize = clamp(Number(dimensionTextSizeInput.value), 8, 48, state.dimensionTextSize);
        dimensionTextSizeInput.value = String(state.dimensionTextSize);
        markDirty();
        queueRender();
      });
    }

    if (dimensionColorInput) {
      dimensionColorInput.addEventListener("input", () => {
        state.dimensionColor = dimensionColorInput.value;
        const selected = getEntityById(state.selectedId);
        if (selected && selected.type === "dimension" && !isEntityLocked(selected)) {
          saveHistory();
          selected.stroke = state.dimensionColor;
        }
        markDirty();
        queueRender();
      });
    }

    steelTemplateSelect.addEventListener("change", () => {
      const template = normalizeSteelTemplate(steelTemplateSelect.value);
      if (!template) {
        return;
      }
      applySteelPreset(template, { announce: true });
    });

    steelWidthInput.addEventListener("change", () => {
      state.steelWidth = Math.max(200, Number(steelWidthInput.value) || state.steelWidth);
      steelWidthInput.value = String(state.steelWidth);
      updateSteelPanelCountHint();
      markDirty();
    });

    steelHeightInput.addEventListener("change", () => {
      state.steelHeight = Math.max(200, Number(steelHeightInput.value) || state.steelHeight);
      steelHeightInput.value = String(state.steelHeight);
      updateSteelPanelCountHint();
      markDirty();
    });

    steelFrameProfileSelect.addEventListener("change", () => {
      state.steelFrameProfile = Math.max(
        20,
        Number(steelFrameProfileSelect.value) || state.steelFrameProfile
      );
      updateSteelPanelCountHint();
      markDirty();
    });

    steelPostWidthInput.addEventListener("change", () => {
      state.steelPostWidth = Math.max(20, Number(steelPostWidthInput.value) || state.steelPostWidth);
      steelPostWidthInput.value = String(state.steelPostWidth);
      updateSteelPanelCountHint();
      markDirty();
    });

    steelPostLengthInput.addEventListener("change", () => {
      state.steelPostLength = Math.max(200, Number(steelPostLengthInput.value) || state.steelPostLength);
      steelPostLengthInput.value = String(state.steelPostLength);
      markDirty();
    });

    steelBarWidthInput.addEventListener("change", () => {
      state.steelBarWidth = Math.max(5, Number(steelBarWidthInput.value) || state.steelBarWidth);
      steelBarWidthInput.value = String(state.steelBarWidth);
      updateSteelPanelCountHint();
      markDirty();
    });

    steelPanelCountInput.addEventListener("change", () => {
      state.steelPanelCount = clamp(
        Math.round(Number(steelPanelCountInput.value)),
        1,
        120,
        state.steelPanelCount
      );
      steelPanelCountInput.value = String(state.steelPanelCount);
      updateSteelPanelCountHint();
      markDirty();
    });

    steelInfillPatternSelect.addEventListener("change", () => {
      const pattern = normalizeInfillPattern(steelInfillPatternSelect.value);
      if (!pattern) {
        steelInfillPatternSelect.value = state.steelInfillPattern;
        return;
      }
      state.steelInfillPattern = pattern;
      syncSteelTemplateMeta();
      updateSteelPanelCountHint();
      markDirty();
    });

    steelTopPanelToggle.addEventListener("change", () => {
      state.steelTopPanel = steelTopPanelToggle.checked;
      updateSteelPanelCountHint();
      markDirty();
    });

    if (steelTopPanelSizeInput) {
      steelTopPanelSizeInput.addEventListener("change", () => {
        const parsed = Number(steelTopPanelSizeInput.value);
        state.steelTopPanelThickness = Math.max(
          2,
          Number.isFinite(parsed) ? parsed : state.steelTopPanelThickness
        );
        steelTopPanelSizeInput.value = String(state.steelTopPanelThickness);
        updateSteelPanelCountHint();
        markDirty();
      });
    }

    steelBottomPanelToggle.addEventListener("change", () => {
      state.steelBottomPanel = steelBottomPanelToggle.checked;
      updateSteelPanelCountHint();
      markDirty();
    });

    if (steelBottomPanelSizeInput) {
      steelBottomPanelSizeInput.addEventListener("change", () => {
        const parsed = Number(steelBottomPanelSizeInput.value);
        state.steelBottomPanelThickness = Math.max(
          2,
          Number.isFinite(parsed) ? parsed : state.steelBottomPanelThickness
        );
        steelBottomPanelSizeInput.value = String(state.steelBottomPanelThickness);
        updateSteelPanelCountHint();
        markDirty();
      });
    }

    steelSectionCountInput.addEventListener("change", () => {
      const parsed = Number(steelSectionCountInput.value);
      state.steelSectionCount = Math.max(
        1,
        Math.min(6, Math.round(Number.isFinite(parsed) ? parsed : state.steelSectionCount))
      );
      steelSectionCountInput.value = String(state.steelSectionCount);
      updateSteelPanelCountHint();
      markDirty();
    });

    steelGateLeafCountSelect.addEventListener("change", () => {
      const parsed = Number(steelGateLeafCountSelect.value);
      state.steelGateLeafCount = Math.max(
        1,
        Math.min(2, Math.round(Number.isFinite(parsed) ? parsed : state.steelGateLeafCount))
      );
      steelGateLeafCountSelect.value = String(state.steelGateLeafCount);
      updateSteelPanelCountHint();
      markDirty();
    });

    steelGroundClearanceInput.addEventListener("change", () => {
      const parsed = Number(steelGroundClearanceInput.value);
      state.steelGroundClearance = Math.max(
        0,
        Number.isFinite(parsed) ? parsed : state.steelGroundClearance
      );
      steelGroundClearanceInput.value = String(state.steelGroundClearance);
      updateSteelPanelCountHint();
      markDirty();
    });

    steelBasePlateHeightInput.addEventListener("change", () => {
      const parsed = Number(steelBasePlateHeightInput.value);
      state.steelBasePlateHeight = Math.max(
        0,
        Number.isFinite(parsed) ? parsed : state.steelBasePlateHeight
      );
      steelBasePlateHeightInput.value = String(state.steelBasePlateHeight);
      updateSteelPanelCountHint();
      markDirty();
    });

    steelInnerFrameToggle.addEventListener("change", () => {
      state.steelInnerFrame = steelInnerFrameToggle.checked;
      updateSteelPanelCountHint();
      markDirty();
    });

    steelDiagonalToggle.addEventListener("change", () => {
      state.steelDiagonal = steelDiagonalToggle.checked;
      syncSteelTemplateMeta();
      markDirty();
    });

    steelGenerateBtn.addEventListener("click", () => {
      generateSteelTemplateFromState();
    });
    activeLayerSelect.addEventListener("change", () => {
      setActiveLayer(activeLayerSelect.value);
      renderLayerPanel();
      updateStatus();
      echoCommand(`Aktywna warstwa: ${getLayerNameById(state.activeLayerId)}.`);
    });

    if (bottomLayerSelect) {
      bottomLayerSelect.addEventListener("change", () => {
        setActiveLayer(bottomLayerSelect.value);
        renderLayerPanel();
        updateStatus();
        echoCommand(`Aktywna warstwa: ${getLayerNameById(state.activeLayerId)}.`);
      });
    }

    addLayerBtn.addEventListener("click", () => {
      const layer = createLayer(newLayerNameInput.value);
      if (layer) {
        echoCommand(`Dodano warstwę: ${layer.name}.`);
      }
    });

    newLayerNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const layer = createLayer(newLayerNameInput.value);
        if (layer) {
          echoCommand(`Dodano warstwę: ${layer.name}.`);
        }
      }
    });

    if (bottomAddLayerBtn) {
      bottomAddLayerBtn.addEventListener("click", () => {
        setLayerQuickAddOpen(true);
      });
    }

    if (layerQuickAddConfirmBtn) {
      layerQuickAddConfirmBtn.addEventListener("click", () => {
        submitQuickLayerAdd();
      });
    }

    if (layerQuickAddCancelBtn) {
      layerQuickAddCancelBtn.addEventListener("click", () => {
        setLayerQuickAddOpen(false);
      });
    }

    if (layerQuickAddCloseBtn) {
      layerQuickAddCloseBtn.addEventListener("click", () => {
        setLayerQuickAddOpen(false);
      });
    }

    if (layerQuickAddOverlay) {
      layerQuickAddOverlay.addEventListener("click", (event) => {
        if (event.target === layerQuickAddOverlay) {
          setLayerQuickAddOpen(false);
        }
      });
    }

    if (layerQuickAddInput) {
      layerQuickAddInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitQuickLayerAdd();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setLayerQuickAddOpen(false);
        }
      });
    }

    layerList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.classList.contains("layer-set-active")) {
        const id = target.dataset.layerId;
        if (id) {
          setActiveLayer(id);
          echoCommand(`Aktywna warstwa: ${getLayerNameById(id)}.`);
        }
      }
      if (target.classList.contains("layer-move-selection")) {
        const id = target.dataset.layerId;
        if (id) {
          const moved = moveSelectedToLayer(id);
          if (moved) {
            echoCommand(`Przeniesiono zaznaczenie do warstwy: ${getLayerNameById(id)}.`);
          } else {
            echoCommand("Nie przeniesiono obiektów (brak zaznaczenia lub obiekty są na zablokowanej warstwie).", true);
          }
        }
      }
      if (target.classList.contains("layer-delete")) {
        const id = target.dataset.layerId;
        if (id) {
          const layerName = getLayerNameById(id);
          const deleted = deleteLayer(id);
          if (deleted) {
            echoCommand(`Usunięto warstwę: ${layerName}.`);
          } else {
            echoCommand("Nie można usunąć warstwy.", true);
          }
        }
      }
    });

    layerList.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      const id = target.dataset.layerId;
      if (!id) {
        return;
      }
      if (target.classList.contains("layer-visible")) {
        setLayerVisible(id, target.checked);
        echoCommand(`Warstwa ${getLayerNameById(id)}: ${target.checked ? "widoczna" : "ukryta"}.`);
      }
      if (target.classList.contains("layer-locked")) {
        setLayerLocked(id, target.checked);
        echoCommand(`Warstwa ${getLayerNameById(id)}: ${target.checked ? "zablokowana" : "odblokowana"}.`);
      }
    });

    saveJsonBtn.addEventListener("click", async () => {
      const payload = buildProjectPayload();
      await saveTextWithFeedback("rysunek.json", JSON.stringify(payload, null, 2), "Zapisano plik: rysunek.json");
    });

    const openJsonImportPicker = (message) => {
      jsonFileInput.click();
      echoCommand(message);
    };

    loadJsonBtn.addEventListener("click", () => {
      openJsonImportPicker("Wybierz plik JSON do wczytania.");
    });
    jsonFileInput.addEventListener("change", async () => {
      const [file] = jsonFileInput.files;
      if (!file) {
        return;
      }
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        const entitiesRaw = Array.isArray(parsed) ? parsed : parsed.entities;
        const layersRaw = Array.isArray(parsed.layers) ? parsed.layers : state.layers;
        if (!Array.isArray(entitiesRaw)) {
          throw new Error("Plik nie zawiera poprawnej tablicy entities");
        }
        saveHistory();
        state.layers = normalizeLayers(layersRaw);
        state.activeLayerId = parsed.activeLayerId;
        ensureActiveLayer();
        state.entities = normalizeEntities(entitiesRaw);
        ensureEntityLayers();
        clearSelection();
        state.lastMeasure = null;
        setWorkspaceMode("draw", { persist: false });
        setRibbonPage("home", { persist: false });
        markDirty();
        queueRender();
        setFileMenuOpen(false);
        echoCommand(`Wczytano JSON: ${file.name} (${state.entities.length} obiektów).`);
      } catch (error) {
        alert(localizeMessageText(`Niepoprawny plik JSON: ${error.message}`));
        echoCommand(`Niepoprawny plik JSON: ${error.message}`, true);
      } finally {
        jsonFileInput.value = "";
      }
    });

    exportDxfBtn.addEventListener("click", async () => {
      await saveTextWithFeedback("rysunek.dxf", toDxfText(), "Wyeksportowano plik: rysunek.dxf");
    });

    if (exportDwgBtn) {
      exportDwgBtn.addEventListener("click", async () => {
        if (exportDwgBtn.dataset.mode === "install-oda") {
          await installOdaAddonWithFeedback();
          return;
        }
        await exportDwgWithFeedback();
      });
    }

    exportSvgBtn.addEventListener("click", async () => {
      await saveTextWithFeedback("rysunek.svg", toSvgText(), "Wyeksportowano plik: rysunek.svg");
    });

    if (printDrawingBtn) {
      printDrawingBtn.addEventListener("click", () => {
        void triggerPrintWithFeedback();
      });
    }

    importDxfBtn.addEventListener("click", () => {
      dxfFileInput.click();
      echoCommand("Wybierz plik DXF lub DWG do importu.");
    });
    if (importDwgBtn) {
      importDwgBtn.addEventListener("click", () => {
        if (importDwgBtn.dataset.mode === "install-oda") {
          void installOdaAddonWithFeedback();
          return;
        }
        dxfFileInput.click();
        echoCommand("Wybierz plik DWG do importu.");
      });
    }
    dxfFileInput.addEventListener("change", async () => {
      const [file] = dxfFileInput.files;
      if (!file) {
        return;
      }
      try {
        await loadCadFileWithFeedback(file);
      } catch (error) {
        const isDwg = String(file.name || "").toLowerCase().endsWith(".dwg");
        const prefix = isDwg ? "DWG" : "DXF";
        alert(localizeMessageText(`Nie udało się wczytać ${prefix}: ${error.message}`));
        echoCommand(`Błąd importu ${prefix}: ${error.message}`, true);
      } finally {
        dxfFileInput.value = "";
      }
    });

    canvas.addEventListener("mousedown", handleCanvasMouseDown);
    window.addEventListener("mousemove", handleCanvasMouseMove);
    window.addEventListener("mouseup", handleCanvasMouseUp);
    canvas.addEventListener("wheel", handleCanvasWheel, { passive: false });
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (isFileMenuOpen() && !target.closest("#fileMenu")) {
        setFileMenuOpen(false);
      }

      if (!state.activeFlyout) {
        return;
      }
      if (
        target.closest(".ribbon-group-palette.flyout-visible") ||
        target.closest(".palette-launch-btn")
      ) {
        return;
      }
      setActiveFlyout(null, { persist: false });
    });
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("resize", updateToastAnchor);
    window.addEventListener("resize", () => {
      if (isFileMenuOpen()) {
        positionFileMenuPanel();
      }
    });
    window.addEventListener(
      "scroll",
      () => {
        if (isFileMenuOpen()) {
          positionFileMenuPanel();
        }
      },
      true
    );
    window.addEventListener("blur", () => {
      resetTransientInputState();
      setFileMenuOpen(false);
    });
    window.addEventListener("focus", () => {
      // Re-validation only matters when enforcement is enabled.
      // In WinRAR-style reminder mode we keep the overlay, but enforcement is off.
      if (!licenseOverlay) {
        return;
      }
      const storedRecord = readPersistedLicenseRecord();
      const isStillValid = validateStoredLicenseAtStartup(storedRecord, {
        audit: false,
        context: "Walidacja przy wejściu do aplikacji"
      });
      if (isStillValid && licenseSession.active) {
        enforceLicenseStorageIntegrity({ silent: true });
        void validateLicenseWithPublicRegistry({
          force: true,
          persist: false,
          context: "Walidacja online przy wejściu do aplikacji"
        });
      }
    });
    window.addEventListener("storage", (event) => {
      if (!licenseOverlay) {
        return;
      }
      if (
        event.key === LICENSE_STORAGE_KEY ||
        event.key === LICENSE_CLEARED_MARK_KEY
      ) {
        const storedRecord = readPersistedLicenseRecord();
        const isStillValid = validateStoredLicenseAtStartup(storedRecord, {
          audit: false,
          context: "Walidacja po zmianie storage"
        });
        if (isStillValid && licenseSession.active) {
          enforceLicenseStorageIntegrity();
          void validateLicenseWithPublicRegistry({
            force: true,
            persist: false,
            context: "Walidacja online po zmianie storage"
          });
        }
      }
    });
    window.addEventListener("online", () => {
      void checkForAppUpdates({ silent: true });
    });
    window.addEventListener("offline", () => {
      appUpdateState.payload = null;
      appUpdateState.available = false;
      setUpdateButtonUi("idle");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        resetTransientInputState();
      }
    });
  }

  async function bootstrap() {
    const canContinue = await ensureLanguageOnFirstLaunch();
    if (!canContinue) {
      return;
    }
    localizeStaticUi();
    refreshSvgIcons();
    watchSvgIconMutations();
    applyTheme("dark");
    let licensedAtBoot = initializeLicenseManager();
    if (licensedAtBoot && licenseOverlay) {
      // In reminder mode this call no-ops (enforcement disabled), but keeping
      // the branch shared with enforced mode keeps behavior consistent if
      // enforcement is enabled again in the future.
      licensedAtBoot = await validateLicenseWithPublicRegistry({
        force: true,
        audit: true,
        persist: false,
        context: "Walidacja online przy uruchomieniu"
      });
    }

    restoreSession();
    await restoreDesktopAutoSaveIfNeeded();
    state.ribbonCollapsed = false;
    state.activeFlyout = null;
    setWorkspaceView("model", { mode: "draw", force: true, persist: false });
    setFileMenuOpen(false);
    ensureActiveLayer();
    ensureEntityLayers();
    ensureDefaultDrawingLayers();
    const restoredHiddenLayers = ensureVisibleLayersForExistingEntities();
    syncLayoutChrome();
    syncWorkspaceView();
    syncRibbonPage();
    setPaletteWidth(state.paletteWidth, { persist: false });
    syncDocumentControls();
    applyHoverHelpTooltips();
    setUpdateButtonUi("idle");
    initializeEvents();
    initializeLayoutObservers();
    updateToastAnchor();
    resizeCanvas();
    updateStatus({ x: 0, y: 0 });
    echoCommand("Gotowe. Użyj przycisków ze wstążki.", false, { toast: false });
    if (restoredHiddenLayers) {
      echoCommand("Przywrócono widoczność warstw z istniejącą geometrią.");
    }
    if (!licensedAtBoot && licenseOverlay) {
      echoCommand("Możesz aktywować token licencji lub kontynuować pracę bez blokady.", false, { toast: false });
    }
    if (window.desktopApp && typeof window.desktopApp.getOdaStatus === "function") {
      void refreshDwgExportButtonState();
    } else {
      setDwgExportButtonState(false);
      setDwgImportButtonState(false);
    }
    const startupUpdateResult = await checkForAppUpdates({ silent: true });
    await promptForStartupUpdateIfNeeded(startupUpdateResult);
    queueRender();
  }

  window.__madcadGetSessionExport = () => {
    return JSON.stringify(buildProjectPayload(), null, 2);
  };

  window.__madcadGet3DSource = () => {
    const selectedIds = new Set([
      ...(Array.isArray(state.selectedIds) ? state.selectedIds : []),
      ...(state.selectedId ? [state.selectedId] : [])
    ]);
    const printableTypes = new Set(["rect", "circle", "fillRegion"]);
    const entities = state.entities
      .filter((entity) => printableTypes.has(entity.type) && isEntityVisible(entity))
      .map((entity) => ({
        ...cloneEntity(entity),
        selected: selectedIds.has(entity.id)
      }));

    return {
      version: 1,
      units: "mm",
      entities
    };
  };

  window.__madcadHasDrawableContent = () => {
    try {
      return Array.isArray(state.entities) && state.entities.length > 0;
    } catch (_error) {
      return false;
    }
  };

  window.__madcadClearRuntimeSession = () => {
    try {
      localStorage.removeItem("cad-session-v2");
      state.persistPending = false;
      if (state.persistTimer) {
        clearTimeout(state.persistTimer);
        state.persistTimer = null;
      }
      state.autosavePending = false;
      state.autosaveLastPayload = "";
      if (state.autosaveTimer) {
        clearTimeout(state.autosaveTimer);
        state.autosaveTimer = null;
      }
      if (window.desktopApp && typeof window.desktopApp.autosaveClear === "function") {
        void window.desktopApp.autosaveClear();
      }
      return true;
    } catch (_error) {
      return false;
    }
  };

  void bootstrap();
