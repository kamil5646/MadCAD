import { validateDocument } from './document.js';

export const PROJECT_HEALTH_SEVERITIES = Object.freeze(['critical', 'warning', 'info']);
export const PROJECT_HEALTH_CATEGORIES = Object.freeze(['document', 'history', 'references', 'links', 'engine', 'storage']);

const MIB = 1024 * 1024;
const STORAGE_INFO_BYTES = 8 * MIB;
const STORAGE_WARNING_BYTES = 32 * MIB;
const STORAGE_CRITICAL_BYTES = 64 * MIB;

function boundedNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function collectionTarget(document, path) {
  const match = String(path || '').match(/^(parameters|sketches|features|components|linkedProjects)\[(\d+)\]/);
  if (!match) return { kind: 'document', id: document?.id || '' };
  const index = Number(match[2]);
  const collection = Array.isArray(document?.[match[1]]) ? document[match[1]] : [];
  const item = collection[index];
  if (match[1] === 'parameters') return { kind: 'settings', id: document?.id || '', parameterName: item?.name || '' };
  if (match[1] === 'linkedProjects') return { kind: 'component', id: item?.linkedComponentId || '', linkedProjectId: item?.id || '' };
  return { kind: match[1] === 'features' ? 'feature' : match[1] === 'sketches' ? 'sketch' : 'component', id: item?.id || '' };
}

function featureName(document, id) {
  return document?.features?.find((feature) => feature.id === id)?.name || id || 'Nieznana operacja';
}

function addIssue(issues, issue) {
  const suffix = String(issue.identity || issue.target?.id || issue.path || issues.length).replace(/[^a-zA-Z0-9_-]+/g, '-');
  issues.push({
    id: `${issue.category}-${issue.code}-${suffix}`,
    severity: issue.severity,
    category: issue.category,
    code: issue.code,
    title: issue.title,
    message: issue.message || '',
    path: issue.path || '',
    target: issue.target || null,
  });
}

function linkedStatus(link, statuses) {
  const status = statuses?.[link.id];
  if (status?.state) return status;
  return { state: 'checking', error: '' };
}

function healthStatus(counts) {
  if (counts.critical > 0) return 'critical';
  if (counts.warning > 0) return 'warning';
  return 'healthy';
}

export function formatProjectBytes(bytes) {
  const size = boundedNumber(bytes);
  if (size >= MIB) return `${(size / MIB).toFixed(size >= 10 * MIB ? 1 : 2)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${Math.round(size)} B`;
}

export function createProjectHealthReport({
  document,
  validation = null,
  timeline = [],
  lostReferences = [],
  linkedProjectStatuses = {},
  engineStatus = 'ready',
  engineError = '',
  engineDiagnostics = [],
  serializedBytes = 0,
  bodyCount = 0,
} = {}) {
  const checkedValidation = validation || validateDocument(document);
  const issues = [];

  for (const issue of checkedValidation?.issues || []) {
    addIssue(issues, {
      severity: 'critical',
      category: 'document',
      code: issue.code || 'INVALID',
      title: 'Nieprawidłowa struktura dokumentu',
      message: issue.message,
      path: issue.path,
      target: collectionTarget(document, issue.path),
      identity: issue.path,
    });
  }

  for (const entry of timeline || []) {
    const featureTarget = { kind: 'feature', id: entry.id || '' };
    const name = featureName(document, entry.id);
    if (entry.status === 'error') {
      addIssue(issues, { severity: 'critical', category: 'history', code: 'FEATURE_ERROR', title: `Błąd operacji: ${name}`, message: entry.error || entry.diagnostics?.[0]?.message || 'Operacja nie została przeliczona.', target: featureTarget });
    } else if (entry.status === 'warning' || entry.status === 'stale') {
      addIssue(issues, { severity: 'warning', category: 'history', code: entry.status === 'stale' ? 'FEATURE_STALE' : 'FEATURE_WARNING', title: `${entry.status === 'stale' ? 'Nieaktualna' : 'Ostrzeżenie operacji'}: ${name}`, message: entry.diagnostics?.[0]?.message || 'Sprawdź diagnostykę tej operacji.', target: featureTarget });
    } else if (entry.status === 'suppressed' || entry.status === 'rolled-back') {
      addIssue(issues, { severity: 'info', category: 'history', code: entry.status === 'suppressed' ? 'FEATURE_SUPPRESSED' : 'FEATURE_ROLLED_BACK', title: `${entry.status === 'suppressed' ? 'Wyłączona operacja' : 'Operacja poza punktem cofnięcia'}: ${name}`, message: 'Stan jest zamierzony, ale ta operacja nie uczestniczy w bieżącym modelu.', target: featureTarget });
    }
  }

  for (const item of lostReferences || []) {
    const reference = item.reference || {};
    addIssue(issues, {
      severity: 'critical',
      category: 'references',
      code: 'TOPOLOGY_REFERENCE_LOST',
      title: `Utracona referencja: ${reference.label || reference.topologyId || reference.id || 'element B-Rep'}`,
      message: item.reason || 'Nie można odnaleźć zapisanej ściany, krawędzi albo wierzchołka.',
      target: reference.ownerFeatureId ? { kind: 'feature', id: reference.ownerFeatureId, referenceId: reference.id || '' } : { kind: 'document', id: document?.id || '', referenceId: reference.id || '' },
      identity: reference.id,
    });
  }

  for (const link of document?.linkedProjects || []) {
    const status = linkedStatus(link, linkedProjectStatuses);
    const target = { kind: 'component', id: link.linkedComponentId || '', linkedProjectId: link.id };
    if (status.state === 'missing' || status.state === 'error') {
      addIssue(issues, { severity: 'critical', category: 'links', code: status.state === 'missing' ? 'LINK_SOURCE_MISSING' : 'LINK_SOURCE_ERROR', title: `${status.state === 'missing' ? 'Brak źródła linku' : 'Błąd linku'}: ${link.sourceName || link.fileName || link.id}`, message: status.error || link.relativePath || 'Źródło projektu nie jest dostępne.', target });
    } else if (status.state === 'changed') {
      addIssue(issues, { severity: 'warning', category: 'links', code: 'LINK_SOURCE_CHANGED', title: `Zmienione źródło linku: ${link.sourceName || link.fileName || link.id}`, message: 'Geometria proxy może nie odpowiadać bieżącemu plikowi źródłowemu.', target });
    } else if (status.state === 'checking') {
      addIssue(issues, { severity: 'info', category: 'links', code: 'LINK_NOT_CHECKED', title: `Link oczekuje na sprawdzenie: ${link.sourceName || link.fileName || link.id}`, message: 'Zapisz projekt i udostępnij plik źródłowy, aby potwierdzić aktualność łącza.', target });
    }
  }

  if (engineStatus === 'error') {
    addIssue(issues, { severity: 'critical', category: 'engine', code: 'ENGINE_ERROR', title: 'Silnik CAD nie przeliczył projektu', message: engineError || 'Silnik geometrii zgłosił błąd.', target: { kind: 'document', id: document?.id || '' } });
  } else if (engineStatus === 'recovering') {
    addIssue(issues, { severity: 'warning', category: 'engine', code: 'ENGINE_RECOVERING', title: 'Silnik CAD jest odtwarzany', message: engineError || 'Poczekaj na ponowne przeliczenie dokumentu.', target: { kind: 'document', id: document?.id || '' } });
  }
  for (const [index, diagnostic] of (engineDiagnostics || []).entries()) {
    addIssue(issues, { severity: engineStatus === 'error' ? 'critical' : 'warning', category: 'engine', code: diagnostic.code || 'ENGINE_DIAGNOSTIC', title: 'Diagnostyka silnika CAD', message: diagnostic.message || String(diagnostic), target: { kind: 'document', id: document?.id || '' }, identity: `${diagnostic.code || 'diagnostic'}-${diagnostic.revision || diagnostic.attempt || index}` });
  }

  const bytes = boundedNumber(serializedBytes);
  if (bytes >= STORAGE_CRITICAL_BYTES) {
    addIssue(issues, { severity: 'critical', category: 'storage', code: 'DOCUMENT_SIZE_CRITICAL', title: 'Projekt przekracza bezpieczny rozmiar', message: `${formatProjectBytes(bytes)} danych dokumentu może utrudniać zapis, autozapis i przenoszenie.`, target: { kind: 'document', id: document?.id || '' } });
  } else if (bytes >= STORAGE_WARNING_BYTES) {
    addIssue(issues, { severity: 'warning', category: 'storage', code: 'DOCUMENT_SIZE_HIGH', title: 'Duży rozmiar projektu', message: `${formatProjectBytes(bytes)} danych dokumentu. Sprawdź ciężkie importy i zbędne siatki.`, target: { kind: 'document', id: document?.id || '' } });
  } else if (bytes >= STORAGE_INFO_BYTES) {
    addIssue(issues, { severity: 'info', category: 'storage', code: 'DOCUMENT_SIZE_NOTICE', title: 'Projekt zawiera dużo danych', message: `${formatProjectBytes(bytes)} danych dokumentu. Rozmiar pozostaje w obsługiwanym zakresie.`, target: { kind: 'document', id: document?.id || '' } });
  }

  const counts = Object.fromEntries(PROJECT_HEALTH_SEVERITIES.map((severity) => [severity, issues.filter((issue) => issue.severity === severity).length]));
  const score = Math.max(0, 100 - counts.critical * 25 - counts.warning * 8 - counts.info);
  const checks = [
    { id: 'document', label: 'Struktura dokumentu', passed: Boolean(checkedValidation?.valid) },
    { id: 'history', label: 'Historia operacji', passed: !issues.some((issue) => issue.category === 'history' && issue.severity !== 'info') },
    { id: 'references', label: 'Referencje B-Rep', passed: !issues.some((issue) => issue.category === 'references') },
    { id: 'links', label: 'Linki zewnętrzne', passed: !issues.some((issue) => issue.category === 'links' && issue.severity !== 'info') },
    { id: 'engine', label: 'Silnik geometrii', passed: !issues.some((issue) => issue.category === 'engine') },
    { id: 'storage', label: 'Rozmiar danych', passed: bytes < STORAGE_WARNING_BYTES },
  ];

  return {
    version: 1,
    document: { id: document?.id || '', name: document?.name || '', schemaVersion: boundedNumber(document?.schemaVersion) },
    status: healthStatus(counts),
    score,
    counts: { ...counts, total: issues.length },
    metrics: {
      serializedBytes: bytes,
      serializedSize: formatProjectBytes(bytes),
      featureCount: document?.features?.length || 0,
      sketchCount: document?.sketches?.length || 0,
      bodyCount: boundedNumber(bodyCount),
      linkedProjectCount: document?.linkedProjects?.length || 0,
      lostReferenceCount: lostReferences?.length || 0,
    },
    checks,
    issues,
  };
}
