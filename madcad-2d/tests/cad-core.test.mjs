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
import { evaluateExpression, resolveParameters } from '../src/cad-core/expressions.js';
import { prepareDocument } from '../src/cad-core/evaluator.js';

const { atomicWriteTextFile } = atomicFile;

test('bezpiecznie oblicza wyrażenia parametryczne', () => {
  assert.equal(evaluateExpression('szerokosc / 2 + 3', { szerokosc: 60 }), 33);
  assert.equal(evaluateExpression('(8 + 2) * 4', {}), 40);
  assert.throws(() => evaluateExpression('globalThis.alert(1)', {}), /Niedozwolony znak|Nieznany parametr/);
  assert.throws(() => evaluateExpression('10 / 0', {}), /Dzielenie przez zero/);
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
