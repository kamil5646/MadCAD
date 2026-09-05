import { createId } from './ids.js';

export const MAX_ASSEMBLY_STORYBOARDS = 12;
export const MAX_STORYBOARD_KEYFRAMES = 120;

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function normalizeStoryboardKeyframe(source = {}, index = 0) {
  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId('animation-keyframe'),
    time: clamp(source.time ?? index, 0, 300),
    explodeAmount: clamp(source.explodeAmount, 0, 1),
  };
}

export function normalizeAssemblyStoryboard(source = {}, index = 0) {
  const keyframes = (Array.isArray(source.keyframes) ? source.keyframes : [])
    .slice(0, MAX_STORYBOARD_KEYFRAMES)
    .map(normalizeStoryboardKeyframe)
    .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId('storyboard'),
    name: String(source.name || `Storyboard ${index + 1}`).trim().slice(0, 60) || `Storyboard ${index + 1}`,
    duration: Math.max(keyframes.at(-1)?.time || 0, clamp(source.duration || Math.max(5, keyframes.at(-1)?.time || 0), 0.1, 300)),
    keyframes,
  };
}

export function ensureDocumentAssemblyAnimations(document) {
  document.animationStoryboards = (Array.isArray(document.animationStoryboards) ? document.animationStoryboards : [])
    .slice(0, MAX_ASSEMBLY_STORYBOARDS)
    .map(normalizeAssemblyStoryboard);
  return document;
}

export function isAssemblyStoryboardsValid(storyboards) {
  return Array.isArray(storyboards) && storyboards.length <= MAX_ASSEMBLY_STORYBOARDS && storyboards.every((storyboard) => {
    if (!storyboard || typeof storyboard.id !== 'string' || !storyboard.id || typeof storyboard.name !== 'string' || !storyboard.name.trim()) return false;
    if (!Number.isFinite(storyboard.duration) || storyboard.duration < 0.1 || storyboard.duration > 300 || !Array.isArray(storyboard.keyframes) || storyboard.keyframes.length > MAX_STORYBOARD_KEYFRAMES) return false;
    return storyboard.keyframes.every((frame, index) => frame && typeof frame.id === 'string' && frame.id && Number.isFinite(frame.time) && frame.time >= 0 && frame.time <= storyboard.duration && Number.isFinite(frame.explodeAmount) && frame.explodeAmount >= 0 && frame.explodeAmount <= 1 && (index === 0 || frame.time >= storyboard.keyframes[index - 1].time));
  });
}

export function createAssemblyStoryboard(document, options = {}) {
  ensureDocumentAssemblyAnimations(document);
  if (document.animationStoryboards.length >= MAX_ASSEMBLY_STORYBOARDS) throw new Error(`Można zapisać maksymalnie ${MAX_ASSEMBLY_STORYBOARDS} storyboardów.`);
  const storyboard = normalizeAssemblyStoryboard({ id: options.id, name: options.name, duration: options.duration || 5, keyframes: options.keyframes || [{ time: 0, explodeAmount: 0 }] }, document.animationStoryboards.length);
  document.animationStoryboards.push(storyboard);
  return storyboard;
}

export function addStoryboardKeyframe(document, storyboardId, options = {}) {
  ensureDocumentAssemblyAnimations(document);
  const storyboard = document.animationStoryboards.find((item) => item.id === storyboardId);
  if (!storyboard) throw new Error('Nie znaleziono storyboardu.');
  if (storyboard.keyframes.length >= MAX_STORYBOARD_KEYFRAMES) throw new Error(`Storyboard może mieć maksymalnie ${MAX_STORYBOARD_KEYFRAMES} klatek.`);
  const frame = normalizeStoryboardKeyframe({ time: options.time, explodeAmount: options.explodeAmount });
  storyboard.keyframes.push(frame);
  storyboard.keyframes.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  storyboard.duration = Math.max(storyboard.duration, frame.time);
  return frame;
}

export function updateAssemblyStoryboard(document, storyboardId, patch = {}) {
  ensureDocumentAssemblyAnimations(document);
  const index = document.animationStoryboards.findIndex((item) => item.id === storyboardId);
  if (index < 0) throw new Error('Nie znaleziono storyboardu.');
  document.animationStoryboards[index] = normalizeAssemblyStoryboard({ ...document.animationStoryboards[index], ...patch }, index);
  return document.animationStoryboards[index];
}

export function deleteAssemblyStoryboard(document, storyboardId) {
  ensureDocumentAssemblyAnimations(document);
  const index = document.animationStoryboards.findIndex((item) => item.id === storyboardId);
  if (index < 0) throw new Error('Nie znaleziono storyboardu.');
  return document.animationStoryboards.splice(index, 1)[0];
}

export function deleteStoryboardKeyframe(document, storyboardId, keyframeId) {
  ensureDocumentAssemblyAnimations(document);
  const storyboard = document.animationStoryboards.find((item) => item.id === storyboardId);
  const index = storyboard?.keyframes.findIndex((item) => item.id === keyframeId) ?? -1;
  if (index < 0) throw new Error('Nie znaleziono klatki animacji.');
  return storyboard.keyframes.splice(index, 1)[0];
}

export function sampleAssemblyStoryboard(storyboard, time) {
  const normalized = normalizeAssemblyStoryboard(storyboard);
  if (!normalized.keyframes.length) return 0;
  const cursor = clamp(time, 0, normalized.duration);
  const nextIndex = normalized.keyframes.findIndex((frame) => frame.time >= cursor);
  if (nextIndex <= 0) return normalized.keyframes[0].explodeAmount;
  if (nextIndex < 0) return normalized.keyframes.at(-1).explodeAmount;
  const before = normalized.keyframes[nextIndex - 1];
  const after = normalized.keyframes[nextIndex];
  const progress = (cursor - before.time) / Math.max(1e-9, after.time - before.time);
  const eased = progress * progress * (3 - 2 * progress);
  return before.explodeAmount + (after.explodeAmount - before.explodeAmount) * eased;
}
