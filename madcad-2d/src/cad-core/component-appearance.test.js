import { describe, expect, it } from 'vitest';
import { componentAppearancePreset, createComponent, normalizeComponentAppearance, updateComponent } from './components.js';
import { createDocument, openDocument, validateDocument } from './document.js';

describe('component appearance', () => {
  it('normalizes presets and clamps custom surface parameters', () => {
    expect(componentAppearancePreset('aluminum')).toEqual({ preset: 'aluminum', color: '#b9c2c9', metalness: 0.72, roughness: 0.34 });
    expect(normalizeComponentAppearance({ preset: 'custom', color: '#ABCDEF', metalness: 2, roughness: -1 })).toEqual({ preset: 'custom', color: '#abcdef', metalness: 1, roughness: 0 });
  });

  it('persists an appearance and keeps old v15 components compatible', () => {
    const document = createDocument('Appearance');
    const component = createComponent(document, { name: 'Korpus', createInstance: false });
    updateComponent(document, component.id, { appearance: componentAppearancePreset('brass') });
    expect(validateDocument(document).valid).toBe(true);
    expect(openDocument(JSON.parse(JSON.stringify(document))).document.components[0].appearance).toEqual(componentAppearancePreset('brass'));

    const legacy = JSON.parse(JSON.stringify(document));
    delete legacy.components[0].appearance;
    expect(openDocument(legacy).document.components[0].appearance).toEqual(componentAppearancePreset('cad'));
  });
});
