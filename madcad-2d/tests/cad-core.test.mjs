import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument, validateDocument } from '../src/cad-core/document.js';
import { evaluateExpression, resolveParameters } from '../src/cad-core/expressions.js';
import { prepareDocument } from '../src/cad-core/evaluator.js';

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
  assert.equal(prepared.features.length, 3);
  assert.equal(prepared.features[0].distanceValue, 8);
  assert.equal(prepared.features[0].profiles[0].geometry.width, 60);
  assert.equal(prepared.features[1].diameterValue, 8);
  assert.equal(prepared.features[2].sizeValue, 1.5);
});
