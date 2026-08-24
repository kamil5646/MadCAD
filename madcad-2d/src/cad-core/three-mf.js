import { strToU8, unzipSync, zipSync } from 'three/examples/jsm/libs/fflate.module.js';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
const RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;

function finiteNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Siatka 3MF zawiera nieprawidłową współrzędną.');
  return parsed;
}

export function createThreeMfArchive(meshes = []) {
  if (!meshes.length) throw new Error('Brak siatki do eksportu 3MF.');
  const resources = [];
  const items = [];
  meshes.forEach((mesh, meshIndex) => {
    const vertices = Array.from(mesh.vertices || [], finiteNumber);
    const triangles = Array.from(mesh.triangles || [], Number);
    if (vertices.length % 3 || triangles.length % 3 || !vertices.length || !triangles.length) throw new Error('Nieprawidłowa siatka do eksportu 3MF.');
    const objectId = meshIndex + 1;
    const vertexXml = Array.from({ length: vertices.length / 3 }, (_, index) => `<vertex x="${vertices[index * 3]}" y="${vertices[index * 3 + 1]}" z="${vertices[index * 3 + 2]}"/>`).join('');
    const triangleXml = Array.from({ length: triangles.length / 3 }, (_, index) => `<triangle v1="${triangles[index * 3]}" v2="${triangles[index * 3 + 1]}" v3="${triangles[index * 3 + 2]}"/>`).join('');
    resources.push(`<object id="${objectId}" type="model" name="${String(mesh.name || `Część ${objectId}`).replace(/[<>&"']/g, '')}"><mesh><vertices>${vertexXml}</vertices><triangles>${triangleXml}</triangles></mesh></object>`);
    items.push(`<item objectid="${objectId}"/>`);
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="pl-PL" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">MadCAD</metadata><resources>${resources.join('')}</resources><build>${items.join('')}</build></model>`;
  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELATIONSHIPS),
    '3D/3dmodel.model': strToU8(model),
  }, { level: 6 });
}

export function inspectThreeMfArchive(data) {
  const files = unzipSync(data instanceof Uint8Array ? data : new Uint8Array(data));
  const decoder = new TextDecoder();
  const modelEntries = Object.entries(files)
    .filter(([name]) => /^3D\/.*\.model$/i.test(name))
    .map(([name, bytes]) => ({ name, xml: decoder.decode(bytes) }));
  if (!modelEntries.length) throw new Error('Archiwum 3MF nie zawiera modelu 3D.');
  const mainModel = modelEntries.find(({ name }) => /^3D\/3dmodel\.model$/i.test(name)) || modelEntries[0];
  let objectCount = 0;
  let triangleCount = 0;
  for (const { xml } of modelEntries) {
    const objects = xml.match(/<object\b[\s\S]*?<\/object>/gi) || [];
    objectCount += objects.filter((objectXml) => /<mesh\b/i.test(objectXml)).length;
    triangleCount += (xml.match(/<triangle\b/gi) || []).length;
  }
  return {
    unit: mainModel.xml.match(/<model[^>]*\bunit="([^"]+)"/i)?.[1] || 'millimeter',
    objectCount,
    triangleCount,
    modelFileCount: modelEntries.length,
  };
}
