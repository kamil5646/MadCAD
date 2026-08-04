import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import atomicFile from '../electron/atomic-file.cjs';
import {
  DOCUMENT_SCHEMA_VERSION,
  createStarterDocument,
  openDocument,
  validateDocument,
} from '../src/cad-core/document.js';
import { buildDependencyGraph } from '../src/cad-core/dependency-graph.js';
import { evaluateExpression, listExpressionIdentifiers, resolveParameters } from '../src/cad-core/expressions.js';
import { FEATURE_STATUS, prepareDocument } from '../src/cad-core/evaluator.js';
import { evaluateFeatureHistory } from '../src/cad-core/feature-history.js';
import { executeFeatureTransaction } from '../src/cad-core/feature-transaction.js';
import { GEOMETRY_POLICY, isPositiveLength, nearlyEqual } from '../src/cad-core/geometry-policy.js';
import { assignStableTopologyIds } from '../src/cad-core/topology-naming.js';
import { RevisionCache, SerialTaskQueue, WorkerRecoveryPolicy, isStaleRevision } from '../src/cad-core/worker-runtime.js';

const { atomicWriteTextFile } = atomicFile;

test('bezpiecznie oblicza wyrażenia parametryczne', () => {
  assert.equal(evaluateExpression('szerokosc / 2 + 3', { szerokosc: 60 }), 33);
  assert.equal(evaluateExpression('(8 + 2) * 4', {}), 40);
  assert.throws(() => evaluateExpression('globalThis.alert(1)', {}), /Niedozwolony znak|Nieznany parametr/);
  assert.throws(() => evaluateExpression('10 / 0', {}), /Dzielenie przez zero/);
});

test('wykrywa identyfikatory wyrażeń i stosuje jedną politykę tolerancji', () => {
  assert.deepEqual(listExpressionIdentifiers('szerokosc / 2 + luz + szerokosc'), ['szerokosc', 'luz']);
  assert.equal(isPositiveLength(GEOMETRY_POLICY.linearTolerance / 2), false);
  assert.equal(isPositiveLength(1), true);
  assert.equal(nearlyEqual(10, 10 + GEOMETRY_POLICY.linearTolerance / 2), true);
});

test('rozwiązuje parametry zależne niezależnie od kolejności', () => {
  const result = resolveParameters([
    { name: 'polowa', expression: 'baza / 2' },
    { name: 'baza', expression: '80' },
  ]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.values, { baza: 80, polowa: 40 });
  assert.deepEqual(result.errors, {});
});

test('wykrywa cykliczne zależności parametrów', () => {
  const result = resolveParameters([
    { name: 'a', expression: 'b + 1' },
    { name: 'b', expression: 'a + 1' },
  ]);
  assert.equal(result.valid, false);
  assert.match(result.errors.a, /Nieznany parametr|cykliczna/);
});

test('przygotowuje historię modelu startowego dla jądra CAD', () => {
  const document = createStarterDocument();
  assert.equal(validateDocument(document).valid, true);
  const prepared = prepareDocument(document);
  assert.equal(prepared.features.length, 2);
  assert.equal(prepared.features[0].distanceValue, 8);
  assert.equal(prepared.features[0].profiles[0].geometry.width, 60);
  assert.equal(prepared.features[1].diameterValue, 8);
});

test('graf zależności wyznacza elementy dotknięte zmianą parametru', () => {
  const document = createStarterDocument();
  const graph = buildDependencyGraph(document);
  const heightParameter = document.parameters.find((parameter) => parameter.name === 'wysokosc');
  const baseFeature = document.features[0];
  const holeFeature = document.features[1];
  const baseBodyId = `body-${baseFeature.id}`;
  const affected = new Set(graph.affectedBy(heightParameter.id));

  assert.ok(affected.has(baseFeature.id));
  assert.ok(affected.has(holeFeature.id));
  assert.ok(affected.has(baseBodyId));
  assert.equal(graph.producerOfBody(baseBodyId), baseFeature.id);
  assert.ok(graph.toJSON().edges.some((edge) => edge.from === baseFeature.id && edge.to === baseBodyId && edge.kind === 'produces'));
});

test('transakcja operacji zachowuje ostatni poprawny model po błędzie', () => {
  const originalBody = { id: 'body-base', shape: { version: 1 } };
  const bodyMap = new Map([[originalBody.id, originalBody]]);
  const bodyOrder = [originalBody.id];
  const transaction = executeFeatureTransaction(
    { id: 'feature-failing' },
    bodyMap,
    bodyOrder,
    (_feature, draftMap, draftOrder) => {
      draftMap.get(originalBody.id).shape = { version: 2 };
      draftOrder.push('body-partial');
      throw new Error('Kontrolowany błąd kernela.');
    },
  );

  assert.equal(transaction.committed, false);
  assert.equal(transaction.error.message, 'Kontrolowany błąd kernela.');
  assert.equal(transaction.bodyMap, bodyMap);
  assert.equal(transaction.bodyOrder, bodyOrder);
  assert.equal(bodyMap.get(originalBody.id).shape.version, 1);
  assert.deepEqual(bodyOrder, ['body-base']);
});

test('historia nadaje stany ok, warning, error, stale i suppressed bez częściowego wyniku', () => {
  const features = [
    { id: 'feature-ok', name: 'Poprawna', status: 'ready' },
    { id: 'feature-warning', name: 'Ostrzeżenie', status: 'ready' },
    { id: 'feature-error', name: 'Błędna', status: 'ready' },
    { id: 'feature-stale', name: 'Nieprzeliczona', status: 'ready' },
    { id: 'feature-suppressed', name: 'Wyłączona', status: FEATURE_STATUS.SUPPRESSED },
  ];
  const history = evaluateFeatureHistory(features, (feature, bodyMap, bodyOrder) => {
    if (feature.id === 'feature-error') {
      bodyMap.set('body-partial', { id: 'body-partial' });
      bodyOrder.push('body-partial');
      throw new Error('Błąd kontrolowany.');
    }
    bodyMap.set(`body-${feature.id}`, { id: `body-${feature.id}` });
    bodyOrder.push(`body-${feature.id}`);
    return feature.id === 'feature-warning'
      ? { diagnostics: [{ level: 'warning', code: 'TEST_WARNING', message: 'Kontrolowane ostrzeżenie.' }] }
      : { diagnostics: [] };
  });

  assert.deepEqual(history.timeline.map((item) => item.status), [
    FEATURE_STATUS.OK,
    FEATURE_STATUS.WARNING,
    FEATURE_STATUS.ERROR,
    FEATURE_STATUS.STALE,
    FEATURE_STATUS.SUPPRESSED,
  ]);
  assert.equal(history.bodyMap.has('body-partial'), false);
  assert.deepEqual(history.bodyOrder, ['body-feature-ok', 'body-feature-warning']);
  assert.equal(history.timeline[2].diagnostics[0].code, 'KERNEL_OPERATION_FAILED');
  assert.equal(history.timeline[3].diagnostics[0].code, 'UPSTREAM_FEATURE_FAILED');
});

test('trwałe nazwy topologii przeżywają zmianę kolejności i szum tolerancji', () => {
  const descriptors = [
    { surface: 'plane', center: [0, 0, 0], area: 100 },
    { surface: 'cylinder', center: [5, 0, 0], radius: 2, area: 40 },
  ];
  const initial = assignStableTopologyIds('feature-base', 'face', descriptors);
  const rebuilt = assignStableTopologyIds('feature-base', 'face', [
    { ...descriptors[1], radius: 2 + GEOMETRY_POLICY.linearTolerance / 4 },
    descriptors[0],
  ], initial);

  assert.equal(rebuilt[0].id, initial[1].id);
  assert.equal(rebuilt[1].id, initial[0].id);

  const changed = assignStableTopologyIds('feature-base', 'face', [
    { ...descriptors[1], radius: 2.01 },
  ], initial);
  assert.notEqual(changed[0].id, initial[1].id);
});

test('kolejka workera zachowuje kolejność, a cache rewizji ma limit i LRU', async () => {
  const queue = new SerialTaskQueue();
  const order = [];
  await Promise.all([
    queue.enqueue(async () => {
      order.push('a-start');
      await Promise.resolve();
      order.push('a-end');
    }),
    queue.enqueue(async () => { order.push('b'); }),
  ]);
  assert.deepEqual(order, ['a-start', 'a-end', 'b']);

  const evicted = [];
  const cache = new RevisionCache({ maxEntries: 2, maxBytes: 10, onEvict: (_value, revision) => evicted.push(revision) });
  cache.set(1, { name: 'one' }, 4);
  cache.set(2, { name: 'two' }, 4);
  assert.equal(cache.get(1).name, 'one');
  cache.set(3, { name: 'three' }, 4);
  assert.equal(cache.get(2), null);
  assert.deepEqual(evicted, [2]);
  assert.deepEqual(cache.stats, { entries: 2, bytes: 8 });
  assert.equal(isStaleRevision(4, 5), true);
  assert.equal(isStaleRevision(5, 5), false);
});

test('polityka odtwarzania workera ma limit prób i reset po sukcesie', () => {
  const policy = new WorkerRecoveryPolicy({ maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 15 });
  assert.deepEqual(policy.recordCrash(), { attempt: 1, shouldRestart: true, delayMs: 10 });
  assert.deepEqual(policy.recordCrash(), { attempt: 2, shouldRestart: true, delayMs: 15 });
  assert.deepEqual(policy.recordCrash(), { attempt: 3, shouldRestart: false, delayMs: 15 });
  policy.recordSuccess();
  assert.deepEqual(policy.recordCrash(), { attempt: 1, shouldRestart: true, delayMs: 10 });
});

test('migruje rzeczywisty fixture dokumentu v2 do v3 bez utraty geometrii', async () => {
  const raw = await readFile(new URL('./fixtures/document-v2.madcad', import.meta.url), 'utf8');
  const source = JSON.parse(raw);
  const sourceSnapshot = structuredClone(source);
  const migratedAt = '2026-08-04T12:00:00.000Z';
  const opened = openDocument(source, { now: migratedAt });

  assert.equal(opened.migrated, true);
  assert.equal(opened.readOnly, false);
  assert.equal(opened.sourceVersion, 2);
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(source, sourceSnapshot, 'migracja nie może zmieniać źródłowego obiektu v2');
  assert.deepEqual(opened.document.sketches[0].entities, []);
  assert.deepEqual(opened.document.sketches[0].constraints, []);
  assert.deepEqual(opened.document.sketches[0].dimensions, []);
  assert.deepEqual(opened.document.bodies, []);
  assert.deepEqual(opened.document.components, []);
  assert.deepEqual(opened.document.references, []);
  assert.equal(opened.document.metadata.migratedFromVersion, 2);
  assert.equal(opened.document.metadata.migratedAt, migratedAt);
  assert.equal(validateDocument(opened.document).valid, true);

  const prepared = prepareDocument(opened.document);
  assert.equal(prepared.features.length, 2);
  assert.equal(prepared.features[0].profiles[0].geometry.width, 60);
  assert.equal(prepared.features[0].distanceValue, 8);
  assert.equal(prepared.features[1].diameterValue, 8);

  const reopened = openDocument(JSON.parse(JSON.stringify(opened.document)));
  assert.equal(reopened.migrated, false);
  assert.deepEqual(reopened.document, opened.document);
});

test('otwiera zgodny dokument z nowszej wersji wyłącznie do odczytu', () => {
  const future = createStarterDocument();
  future.schemaVersion = DOCUMENT_SCHEMA_VERSION + 1;
  future.futureWorkspace = { enabled: true };

  const opened = openDocument(future);
  assert.equal(opened.readOnly, true);
  assert.equal(opened.migrated, false);
  assert.equal(opened.sourceVersion, DOCUMENT_SCHEMA_VERSION + 1);
  assert.equal(opened.document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.equal(opened.document.futureWorkspace.enabled, true);
  assert.equal(opened.originalDocument.schemaVersion, DOCUMENT_SCHEMA_VERSION + 1);
  assert.match(opened.warning, /tylko do odczytu/i);
  assert.equal(validateDocument(opened.document).valid, true);
});

test('walidacja wskazuje dokładną ścieżkę zerwanej referencji i duplikatu ID', () => {
  const document = createStarterDocument();
  document.features[0].profileIds[0] = 'profile-missing';
  document.sketches[0].profiles[0].id = document.sketches[0].id;
  document.sketches[0].constraints.push({
    id: 'constraint-broken-reference',
    type: 'coincident',
    entityIds: ['entity-missing'],
  });

  const validation = validateDocument(document);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.path === 'features[0].profileIds[0]' && issue.code === 'BROKEN_REFERENCE'));
  assert.ok(validation.issues.some((issue) => issue.path === 'sketches[0].profiles[0].id' && issue.code === 'DUPLICATE_ID'));
  assert.ok(validation.issues.some((issue) => issue.path === 'sketches[0].constraints[0].entityIds[0]' && issue.code === 'BROKEN_REFERENCE'));
});

test('zapis atomowy zachowuje poprzednią poprawną wersję jako .bak', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'madcad-atomic-'));
  const targetPath = join(directory, 'projekt.madcad');
  try {
    await writeFile(targetPath, 'wersja-poprzednia', 'utf8');
    const result = await atomicWriteTextFile(targetPath, 'wersja-nowa', { backup: true });

    assert.equal(await readFile(targetPath, 'utf8'), 'wersja-nowa');
    assert.equal(await readFile(`${targetPath}.bak`, 'utf8'), 'wersja-poprzednia');
    assert.equal(result.filePath, targetPath);
    assert.equal(result.backupPath, `${targetPath}.bak`);

    await atomicWriteTextFile(targetPath, 'wersja-najnowsza', { backup: true });
    assert.equal(await readFile(targetPath, 'utf8'), 'wersja-najnowsza');
    assert.equal(await readFile(`${targetPath}.bak`, 'utf8'), 'wersja-nowa');
    assert.equal((await readdir(directory)).some((name) => name.endsWith('.tmp')), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
