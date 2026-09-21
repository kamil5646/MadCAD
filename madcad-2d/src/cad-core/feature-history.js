import { FEATURE_STATUS } from './evaluator.js';
import { executeFeatureTransaction } from './feature-transaction.js';

function normalizeDiagnostics(diagnostics, defaultLevel = 'info') {
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics.map((diagnostic) => (
    typeof diagnostic === 'string'
      ? { level: defaultLevel, code: 'KERNEL_MESSAGE', message: diagnostic }
      : { level: defaultLevel, code: 'KERNEL_MESSAGE', ...diagnostic }
  ));
}

export function evaluateFeatureHistory(features, executor, initialState = {}) {
  const state = {
    bodyMap: initialState.bodyMap || new Map(),
    bodyOrder: initialState.bodyOrder || [],
    timeline: [],
  };

  for (let featureIndex = 0; featureIndex < features.length; featureIndex += 1) {
    if (!evaluateFeatureAtIndex(features, featureIndex, executor, state)) break;
  }

  return state;
}

function evaluateFeatureAtIndex(features, featureIndex, executor, state) {
  const feature = features[featureIndex];
  if (feature.status === FEATURE_STATUS.SUPPRESSED || feature.status === FEATURE_STATUS.ROLLED_BACK) {
    state.timeline.push({ id: feature.id, status: feature.status, diagnostics: [] });
    return true;
  }
  const transaction = executeFeatureTransaction(feature, state.bodyMap, state.bodyOrder, executor);
  if (!transaction.committed) {
    const message = transaction.error?.message || String(transaction.error || 'Nieznany błąd operacji kernela.');
    state.timeline.push({
      id: feature.id,
      status: FEATURE_STATUS.ERROR,
      error: message,
      diagnostics: [{ level: 'error', code: 'KERNEL_OPERATION_FAILED', message }],
    });
    for (const staleFeature of features.slice(featureIndex + 1)) {
      const suppressed = staleFeature.status === FEATURE_STATUS.SUPPRESSED;
      const rolledBack = staleFeature.status === FEATURE_STATUS.ROLLED_BACK;
      state.timeline.push({
        id: staleFeature.id,
        status: suppressed ? FEATURE_STATUS.SUPPRESSED : rolledBack ? FEATURE_STATUS.ROLLED_BACK : FEATURE_STATUS.STALE,
        diagnostics: suppressed || rolledBack
          ? []
          : [{
            level: 'warning',
            code: 'UPSTREAM_FEATURE_FAILED',
            message: `Nie przeliczono po błędzie operacji „${feature.name}”.`,
          }],
      });
    }
    return false;
  }

  state.bodyMap = transaction.bodyMap;
  state.bodyOrder = transaction.bodyOrder;
  const diagnostics = normalizeDiagnostics(transaction.result?.diagnostics || feature.diagnostics);
  const hasWarning = diagnostics.some((diagnostic) => diagnostic.level === 'warning');
  state.timeline.push({
    id: feature.id,
    status: hasWarning ? FEATURE_STATUS.WARNING : FEATURE_STATUS.OK,
    diagnostics,
  });
  return true;
}

export async function evaluateFeatureHistoryCooperatively(features, executor, initialState = {}, {
  checkpoint = async () => {},
  checkpointInterval = 4,
} = {}) {
  if (!Number.isInteger(checkpointInterval) || checkpointInterval < 1) {
    throw new Error('Interwał kontroli przebudowy historii musi być dodatnią liczbą całkowitą.');
  }
  const state = {
    bodyMap: initialState.bodyMap || new Map(),
    bodyOrder: initialState.bodyOrder || [],
    timeline: [],
  };
  for (let featureIndex = 0; featureIndex < features.length; featureIndex += 1) {
    const shouldContinue = evaluateFeatureAtIndex(features, featureIndex, executor, state);
    if (!shouldContinue) break;
    if ((featureIndex + 1) % checkpointInterval === 0 || featureIndex === features.length - 1) {
      await checkpoint({ featureIndex, processedFeatures: featureIndex + 1, state });
    }
  }
  return state;
}
