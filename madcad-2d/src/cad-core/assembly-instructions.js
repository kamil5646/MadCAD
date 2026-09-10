function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeFrameImage(value) {
  return /^data:image\/png;base64,[a-z0-9+/=]+$/i.test(String(value || '')) ? value : '';
}

export function assemblyInstructionHtml(document, storyboard, options = {}) {
  if (!storyboard?.keyframes?.length) throw new Error('Storyboard nie zawiera klatek instrukcji.');
  const instanceNames = new Map((document.componentInstances || []).map((instance) => [instance.id, instance.name]));
  const jointDefinitions = new Map((document.joints || []).map((joint) => [joint.id, joint]));
  const rows = [...storyboard.keyframes]
    .sort((first, second) => first.time - second.time)
    .map((frame, index) => {
      const rotations = Object.entries(frame.instanceRotations || {})
        .filter(([, vector]) => Array.isArray(vector) && vector.some((value) => Math.abs(Number(value) || 0) > 1e-9))
        .map(([id, vector]) => `${escapeHtml(instanceNames.get(id) || id)}: X ${Number(vector[0] || 0).toFixed(1)}°, Y ${Number(vector[1] || 0).toFixed(1)}°, Z ${Number(vector[2] || 0).toFixed(1)}°`);
      const offsets = Object.entries(frame.instanceOffsets || {})
        .filter(([, vector]) => Array.isArray(vector) && vector.some((value) => Math.abs(Number(value) || 0) > 1e-9))
        .map(([id, vector]) => `${escapeHtml(instanceNames.get(id) || id)}: X ${Number(vector[0] || 0).toFixed(1)}, Y ${Number(vector[1] || 0).toFixed(1)}, Z ${Number(vector[2] || 0).toFixed(1)} mm`);
      const joints = Object.entries(frame.jointValues || {})
        .map(([id, value]) => {
          const joint = jointDefinitions.get(id);
          return `${escapeHtml(joint?.name || id)}: ${Number(value).toFixed(1)} ${joint?.type === 'slider' ? 'mm' : '°'}`;
        });
      const details = [...offsets, ...rotations, ...joints];
      const image = safeFrameImage(options.frameImages?.[index]);
      return `<tr><td>${index + 1}</td><td>${Number(frame.time).toFixed(1)} s</td><td>${Math.round(Number(frame.explodeAmount || 0) * 100)}%</td><td>${image ? `<img src="${image}" alt="Widok kroku ${index + 1}">` : '—'}</td><td><strong>${escapeHtml(frame.note || (index ? `Krok ${index + 1}` : 'Położenie początkowe'))}</strong>${details.length ? `<ul>${details.map((detail) => `<li>${detail}</li>`).join('')}</ul>` : ''}</td></tr>`;
    }).join('');
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(document.name)} — ${escapeHtml(storyboard.name)}</title>
<style>body{font:14px/1.45 system-ui,sans-serif;color:#17212b;max-width:1120px;margin:32px auto;padding:0 24px}header{border-bottom:3px solid #1596bd;margin-bottom:24px}h1{margin:0 0 4px;font-size:25px}p{color:#52616d}table{width:100%;border-collapse:collapse}th,td{border:1px solid #b8c3cb;padding:9px;text-align:left;vertical-align:top}th{background:#eaf2f5}td:first-child{font-weight:700;text-align:center}img{display:block;width:280px;max-width:100%;height:auto;background:#17212b}ul{margin:7px 0 0;padding-left:20px}@media print{body{margin:0;max-width:none}thead{display:table-header-group}tr{break-inside:avoid}img{width:220px}}</style></head>
<body><header><h1>${escapeHtml(storyboard.name)}</h1><p>Projekt: <strong>${escapeHtml(document.name)}</strong> · czas animacji ${Number(storyboard.duration).toFixed(1)} s · liczba klatek ${storyboard.keyframes.length}</p></header>
<table><thead><tr><th>Krok</th><th>Czas</th><th>Rozłożenie</th><th>Widok</th><th>Instrukcja i stan złożenia</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
