import { describe, expect, it } from 'vitest';
import { resolveExtrudeSource } from './extrude-source.js';

const line = (id, first, second, role = 'standard') => ({ id, type: 'line', role, pointIds: [first, second] });

describe('resolveExtrudeSource', () => {
  it('odnajduje ostatni gotowy profil nawet bez zachowanego zaznaczenia', () => {
    const profile = { id: 'profile-1' };
    const sketch = { id: 'sketch-1', entities: [], profiles: [profile] };
    expect(resolveExtrudeSource({ sketches: [sketch], selection: { kind: 'document' } })).toEqual({ kind: 'profile', sketch, profile });
  });

  it('preferuje szkic wskazany przez zaznaczenie', () => {
    const older = { id: 'sketch-1', entities: [], profiles: [{ id: 'profile-1' }] };
    const selected = { id: 'sketch-2', entities: [], profiles: [{ id: 'profile-2' }] };
    expect(resolveExtrudeSource({ sketches: [older, selected], selection: { kind: 'sketch', id: selected.id } }).profile.id).toBe('profile-2');
  });

  it('nie wraca do starszego profilu, gdy wskazany szkic jest otwartym lancuchem', () => {
    const older = { id: 'sketch-1', entities: [], profiles: [{ id: 'profile-1' }] };
    const selected = { id: 'sketch-2', profiles: [], entities: [line('a', 'p1', 'p2')] };
    expect(resolveExtrudeSource({ sketches: [older, selected], selection: { kind: 'sketch', id: selected.id } })).toEqual({ kind: 'open-chain', sketch: selected, entityIds: ['a'] });
  });

  it('rozpoznaje pojedynczy otwarty lancuch do cienkiego wyciagniecia', () => {
    const sketch = { id: 'sketch-1', profiles: [], entities: [line('a', 'p1', 'p2'), line('b', 'p2', 'p3')] };
    expect(resolveExtrudeSource({ sketches: [sketch] })).toEqual({ kind: 'open-chain', sketch, entityIds: ['a', 'b'] });
  });

  it('nie wyciaga automatycznie rozlacznej lub rozgalezionej geometrii', () => {
    const disconnected = { id: 'sketch-1', profiles: [], entities: [line('a', 'p1', 'p2'), line('b', 'p3', 'p4')] };
    expect(resolveExtrudeSource({ sketches: [disconnected] })).toEqual({ kind: 'incomplete', sketch: disconnected });
  });

  it('pomija profil juz uzyty przez operacje i wybiera wolny', () => {
    const used = { id: 'profile-used' };
    const free = { id: 'profile-free' };
    const sketch = { id: 'sketch-1', entities: [], profiles: [free, used] };
    const features = [{ id: 'f1', type: 'extrude', profileIds: ['profile-used'] }];
    expect(resolveExtrudeSource({ sketches: [sketch], features }).profile.id).toBe('profile-free');
  });

  it('szuka wolnego profilu w starszym szkicu, a do zuzytego wraca tylko gdy brak wolnych', () => {
    const older = { id: 'sketch-1', entities: [], profiles: [{ id: 'old-free' }] };
    const newer = { id: 'sketch-2', entities: [], profiles: [{ id: 'new-used' }] };
    const features = [{ id: 'f1', profileIds: ['new-used'] }];
    expect(resolveExtrudeSource({ sketches: [older, newer], features }).profile.id).toBe('old-free');
    const allUsed = [{ id: 'f1', profileIds: ['new-used', 'old-free'] }];
    expect(resolveExtrudeSource({ sketches: [older, newer], features: allUsed }).profile.id).toBe('new-used');
    expect(resolveExtrudeSource({ sketches: [older, newer], features: [{ id: 'f1', profileIds: ['new-used'], suppressed: true }] }).profile.id).toBe('new-used');
  });
});
