function budgetFailures(results, budgets) {
  const failures = [];
  for (const result of results) {
    for (const [stage, run] of Object.entries({ initial: result.initial, recovered: result.recovered })) {
      const label = `${result.name} (${stage})`;
      if (!Number.isFinite(run.totalMs) || run.totalMs > budgets.largeProjectEvaluationMs) failures.push(`${label}: przeliczenie ${run.totalMs} ms > ${budgets.largeProjectEvaluationMs} ms`);
      if (!Number.isFinite(run.slowestFeature?.durationMs) || run.slowestFeature.durationMs > budgets.largeProjectSlowestFeatureMs) failures.push(`${label}: operacja ${run.slowestFeature?.name || 'brak'} ${run.slowestFeature?.durationMs} ms > ${budgets.largeProjectSlowestFeatureMs} ms`);
      if (!Number.isFinite(run.slowestMeshBody?.durationMs) || run.slowestMeshBody.durationMs > budgets.displayMeshPerBodyMs) failures.push(`${label}: siatkowanie bryły ${run.slowestMeshBody?.bodyId || 'brak'} ${run.slowestMeshBody?.durationMs} ms > ${budgets.displayMeshPerBodyMs} ms`);
      if (!Number.isFinite(run.peakWorkingSetKb) || run.peakWorkingSetKb > budgets.largeProjectPeakWorkingSetKb) failures.push(`${label}: pamięć ${run.peakWorkingSetKb} KiB > ${budgets.largeProjectPeakWorkingSetKb} KiB`);
    }
  }
  return failures;
}

function githubSummary(results, budgets, failures, platform = process.platform) {
  const rows = results.flatMap((result) => [['przed awarią', result.initial], ['po odzyskaniu', result.recovered]].map(([stage, run]) => (
    `| ${result.name} | ${stage} | ${run.totalMs?.toFixed(0) ?? '—'} | ${run.peakWorkingSetKb ?? '—'} | ${run.slowestFeature?.name || '—'} (${run.slowestFeature?.durationMs?.toFixed(0) ?? '—'} ms) | ${run.slowestMeshBody?.durationMs?.toFixed(0) ?? '—'} |`
  )));
  return `### Duże projekty CAD — OpenCascade (${platform})\n\n| Projekt | Etap | Przeliczenie ms | Szczyt pamięci KiB | Najwolniejsza operacja | Najwolniejsze siatkowanie ms |\n| --- | --- | ---: | ---: | --- | ---: |\n${rows.join('\n')}\n\nBudżety: ${budgets.largeProjectEvaluationMs} ms/przeliczenie, ${budgets.largeProjectSlowestFeatureMs} ms/operację, ${budgets.displayMeshPerBodyMs} ms/siatkowanie bryły, ${budgets.largeProjectPeakWorkingSetKb} KiB/proces. ${failures.length ? `Przekroczenia: ${failures.join('; ')}.` : 'Wszystkie budżety zachowane.'}\n\n`;
}

module.exports = { budgetFailures, githubSummary };
