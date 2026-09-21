import {
  createDocument,
  createFeature,
  createRectangleProfile,
  createSketch,
  createStarterDocument,
} from '../src/cad-core/document.js';

const LARGE_FEATURE_COUNT = 220;

function createTransformHistory() {
  const document = createStarterDocument();
  document.name = 'Korpus R6.6 — długa historia jednej części';
  const targetBodyId = `body-${document.features[0].id}`;
  for (let index = document.features.length; index < LARGE_FEATURE_COUNT; index += 1) {
    document.features.push(createFeature('transform', {
      name: `Przesunięcie ${index}`,
      targetBodyId,
      mode: 'move',
      x: index % 2 ? '0.25' : '-0.25',
      y: index % 3 ? '0' : '0.1',
      z: '0',
      angle: '0',
      originX: '0',
      originY: '0',
      originZ: '0',
    }));
  }
  return document;
}

function createMultiBodyDocument() {
  const document = createDocument('Korpus R6.6 — wiele brył');
  for (let index = 0; index < LARGE_FEATURE_COUNT; index += 1) {
    document.features.push(createFeature('primitive', {
      name: `Korpus ${index + 1}`,
      primitiveType: index % 3 === 0 ? 'cylinder' : 'box',
      x: String((index % 22) * 16),
      y: String(Math.floor(index / 22) * 16),
      z: '0',
      width: '10',
      depth: '10',
      height: String(6 + (index % 5)),
      radius: '5',
    }));
  }
  return document;
}

function createSketchDrivenDocument() {
  const document = createDocument('Korpus R6.6 — szkice parametryczne');
  for (let index = 0; index < LARGE_FEATURE_COUNT; index += 1) {
    const profile = createRectangleProfile({
      name: `Profil ${index + 1}`,
      width: String(12 + (index % 7)),
      height: String(8 + (index % 5)),
      x: String((index % 20) * 20),
      y: String(Math.floor(index / 20) * 18),
    });
    const sketch = createSketch({ name: `Szkic ${index + 1}`, profiles: [profile] });
    document.sketches.push(sketch);
    document.features.push(createFeature('extrude', {
      name: `Wyciągnięcie ${index + 1}`,
      sketchId: sketch.id,
      profileIds: [profile.id],
      distance: String(4 + (index % 4)),
      operation: 'new',
    }));
  }
  return document;
}

export function createLargeProjectCorpus() {
  return [
    createTransformHistory(),
    createMultiBodyDocument(),
    createSketchDrivenDocument(),
  ];
}

export { LARGE_FEATURE_COUNT };
