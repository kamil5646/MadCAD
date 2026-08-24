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
  let bodyMap = initialState.bodyMap || new Map();
  let bodyOrder = initialState.bodyOrder || [];
  const timeline = [];

  for (let featureIndex = 0; featureIndex < features.length; featureIndex += 1) {
    const feature = features[featureIndex];
    if (feature.status === FEATURE_STATUS.SUPPRESSED || feature.status === FEATURE_STATUS.ROLLED_BACK) {
      timeline.push({ id: feature.id, status: feature.status, diagnostics: [] });
      continue;
    }
    const transaction = executeFeatureTransaction(feature, bodyMap, bodyOrder, executor);
    if (!transaction.committed) {
      const message = transaction.error?.message || String(transaction.error || 'Nieznany błąd operacji kernela.');
      timeline.push({
        id: feature.id,
        status: FEATURE_STATUS.ERROR,
        error: message,
        diagnostics: [{ level: 'error', code: 'KERNEL_OPERATION_FAILED', message }],
      });
      for (const staleFeature of features.slice(featureIndex + 1)) {
        const suppressed = staleFeature.status === FEATURE_STATUS.SUPPRESSED;
        const rolledBack = staleFeature.status === FEATURE_STATUS.ROLLED_BACK;
        timeline.push({
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
      break;
    }

    bodyMap = transaction.bodyMap;
    bodyOrder = transaction.bodyOrder;
    const diagnostics = normalizeDiagnostics(transaction.result?.diagnostics || feature.diagnostics);
    const hasWarning = diagnostics.some((diagnostic) => diagnostic.level === 'warning');
    timeline.push({
      id: feature.id,
      status: feature.status === FEATURE_STATUS.SUPPRESSED || feature.status === FEATURE_STATUS.ROLLED_BACK
        ? feature.status
        : hasWarning
          ? FEATURE_STATUS.WARNING
          : FEATURE_STATUS.OK,
      diagnostics,
    });
  }

  return { bodyMap, bodyOrder, timeline };
}
