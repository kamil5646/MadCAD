import { describe, expect, it } from 'vitest';
import { commandSuggestions, describeActiveCommand, parseCommandLineInput, planCommandLineSubmission, resolveCommandAlias } from './command-controller.js';

describe('CAD command controller', () => {
  it('resolves Autodesk-style aliases and Polish command names', () => {
    expect(resolveCommandAlias('line')).toMatchObject({ shortcut: 'L', label: 'Linia' });
    expect(resolveCommandAlias('PL')).toMatchObject({ shortcut: 'PL', label: 'Polilinia' });
    expect(resolveCommandAlias('usuń')).toMatchObject({ shortcut: 'DEL', label: 'Usuń' });
    expect(resolveCommandAlias('arc')).toMatchObject({ shortcut: 'A', label: 'Łuk' });
    expect(resolveCommandAlias('array')).toMatchObject({ shortcut: 'AR', label: 'Szyk szkicu' });
    expect(resolveCommandAlias('revolve')).toMatchObject({ shortcut: 'REV', label: 'Revolve' });
    expect(resolveCommandAlias('patch')).toMatchObject({ shortcut: 'PA', label: 'Patch' });
    expect(resolveCommandAlias('surfaceextrude')).toMatchObject({ shortcut: 'SE', label: 'Surface Extrude' });
    expect(resolveCommandAlias('surfacerevolve')).toMatchObject({ shortcut: 'SR', label: 'Surface Revolve' });
    expect(resolveCommandAlias('pogrub')).toMatchObject({ shortcut: 'TH', label: 'Thicken' });
    expect(resolveCommandAlias('massprop')).toMatchObject({ shortcut: 'MP', label: 'Masa' });
  });

  it('parses decimal lengths with a dot or comma', () => {
    expect(parseCommandLineInput('25,5')).toEqual({ type: 'number', raw: '25,5', value: 25.5 });
    expect(parseCommandLineInput('-4.25')).toEqual({ type: 'number', raw: '-4.25', value: -4.25 });
  });

  it('distinguishes cancel, blank and unknown input', () => {
    expect(parseCommandLineInput('esc').type).toBe('cancel');
    expect(parseCommandLineInput(' ').type).toBe('empty');
    expect(parseCommandLineInput('xyz').type).toBe('unknown');
  });

  it('describes point-first line input and suggests matching commands', () => {
    expect(describeActiveCommand({ type: 'line' })).toContain('pierwszy punkt');
    expect(describeActiveCommand({ type: 'line', lastPoint: { x: 0, y: 0 } })).toContain('wpisz długość');
    expect(commandSuggestions('li')[0]).toMatchObject({ shortcut: 'L', label: 'Linia' });
  });

  it('prioritizes a configured alias without removing built-in command names', () => {
    const customization = { commands: { Linia: { alias: 'XL', shortcut: 'G' } } };
    expect(resolveCommandAlias('XL', customization)).toMatchObject({ label: 'Linia' });
    expect(resolveCommandAlias('LINE', customization)).toMatchObject({ label: 'Linia' });
  });

  it('plans command-line effects without coupling parsing to the workspace component', () => {
    expect(planCommandLineSubmission('esc').action).toBe('cancel');
    expect(planCommandLineSubmission('')).toMatchObject({ action: 'confirm-active' });
    expect(planCommandLineSubmission('25', { command: { type: 'line' } }).action).toBe('number-unavailable');
    expect(planCommandLineSubmission('-2', { command: { type: 'line', lastPoint: [0, 0] } }).action).toBe('invalid-length');
    expect(planCommandLineSubmission('25,5', { command: { type: 'polyline', lastPoint: [0, 0] } })).toMatchObject({ action: 'confirm-segment-length', length: 25.5 });
    expect(planCommandLineSubmission('line')).toMatchObject({ action: 'execute-command', shortcut: 'L' });
    expect(planCommandLineSubmission('niewiadome').action).toBe('unknown-command');
  });
});
