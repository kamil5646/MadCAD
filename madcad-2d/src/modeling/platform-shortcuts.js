export function normalizeDesktopPlatform(platform) {
  return ['darwin', 'win32', 'linux'].includes(platform) ? platform : 'web';
}

export function primaryModifierPressed(event, platform) {
  return normalizeDesktopPlatform(platform) === 'darwin' ? Boolean(event?.metaKey) : Boolean(event?.ctrlKey);
}

export function alternateModifierPressed(event) {
  return Boolean(event?.altKey);
}

export function formatShortcut(shortcut, platform) {
  const normalized = String(shortcut || '').trim().toUpperCase();
  const target = normalizeDesktopPlatform(platform);
  if (!normalized) return '';
  if (normalized === 'ESC') return 'Esc';
  if (normalized === 'DEL') return target === 'darwin' ? '⌫' : 'Del';
  const labels = normalized.split('+').map((part) => {
    if (part === 'CTRL' || part === 'CMDORCTRL' || part === 'PRIMARY') return target === 'darwin' ? '⌘' : 'Ctrl';
    if (part === 'ALT' || part === 'OPTION') return target === 'darwin' ? '⌥ Option' : 'Alt';
    if (part === 'SHIFT') return target === 'darwin' ? '⇧' : 'Shift';
    if (part === 'ENTER') return 'Enter';
    return part.length === 1 ? part : `${part[0]}${part.slice(1).toLowerCase()}`;
  });
  return labels.join(target === 'darwin' ? ' ' : '+');
}

export function multipleSelectionLabel(platform) {
  return `${normalizeDesktopPlatform(platform) === 'darwin' ? '⌘' : 'Ctrl'}/Shift`;
}
