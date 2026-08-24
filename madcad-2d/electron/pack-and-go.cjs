const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');

const PACK_AND_GO_VERSION = 1;
const MAX_PROJECT_BYTES = 64 * 1024 * 1024;
const MAX_PROJECTS = 200;

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function portableName(value, fallback = 'project') {
  const source = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return source.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || fallback;
}

async function readProject(filePath, fileSystem = fs) {
  const stats = await fileSystem.stat(filePath);
  if (!stats.isFile()) throw new Error(`Łącze nie wskazuje pliku: ${path.basename(filePath)}.`);
  if (stats.size > MAX_PROJECT_BYTES) throw new Error(`Projekt ${path.basename(filePath)} przekracza limit 64 MiB.`);
  const text = await fileSystem.readFile(filePath, 'utf8');
  let document;
  try {
    document = JSON.parse(text);
  } catch (_error) {
    throw new Error(`Projekt ${path.basename(filePath)} nie zawiera poprawnego JSON.`);
  }
  if (!document || typeof document !== 'object' || typeof document.id !== 'string' || !document.id) throw new Error(`Projekt ${path.basename(filePath)} nie ma prawidłowego ID.`);
  if (!Array.isArray(document.linkedProjects)) document.linkedProjects = [];
  return { document, text, hash: sha256(text), size: stats.size };
}

async function buildPackGraph(rootProjectPath, { fileSystem = fs } = {}) {
  const rootPath = path.normalize(rootProjectPath);
  if (!path.isAbsolute(rootPath) || path.extname(rootPath).toLowerCase() !== '.madcad') throw new Error('Pack & Go wymaga zapisanego projektu .madcad.');
  const nodes = new Map();
  const documentPaths = new Map();
  const visiting = [];
  const postOrder = [];

  async function visit(filePath) {
    const absolutePath = path.normalize(filePath);
    const cycleIndex = visiting.indexOf(absolutePath);
    if (cycleIndex >= 0) {
      const cycle = [...visiting.slice(cycleIndex), absolutePath].map((item) => path.basename(item)).join(' → ');
      throw new Error(`Wykryto cykl linków projektu: ${cycle}.`);
    }
    if (nodes.has(absolutePath)) return nodes.get(absolutePath);
    if (nodes.size >= MAX_PROJECTS) throw new Error(`Pack & Go przekracza limit ${MAX_PROJECTS} projektów.`);
    visiting.push(absolutePath);
    let source;
    try {
      source = await readProject(absolutePath, fileSystem);
    } catch (error) {
      if (error?.code === 'ENOENT') throw new Error(`Brakuje linkowanego projektu: ${path.basename(absolutePath)}.`);
      throw error;
    }
    const previousPath = documentPaths.get(source.document.id);
    if (previousPath && previousPath !== absolutePath) throw new Error(`To samo ID projektu występuje w dwóch plikach: ${path.basename(previousPath)} i ${path.basename(absolutePath)}.`);
    documentPaths.set(source.document.id, absolutePath);
    const node = { absolutePath, ...source, edges: [] };
    nodes.set(absolutePath, node);
    for (let index = 0; index < source.document.linkedProjects.length; index += 1) {
      const link = source.document.linkedProjects[index];
      if (!link || typeof link.relativePath !== 'string' || !link.relativePath || path.isAbsolute(link.relativePath)) throw new Error(`Projekt ${path.basename(absolutePath)} ma nieprawidłową ścieżkę łącza.`);
      const targetPath = path.resolve(path.dirname(absolutePath), link.relativePath);
      const target = await visit(targetPath);
      if (link.sourceDocumentId && link.sourceDocumentId !== target.document.id) throw new Error(`Łącze ${link.fileName || path.basename(targetPath)} wskazuje projekt o innym ID.`);
      if (link.sourceHash && link.sourceHash !== target.hash) throw new Error(`Projekt ${link.fileName || path.basename(targetPath)} zmienił się. Odśwież łącze przed Pack & Go.`);
      node.edges.push({ index, targetPath });
    }
    visiting.pop();
    postOrder.push(absolutePath);
    return node;
  }

  await visit(rootPath);
  return { rootPath, nodes, postOrder };
}

function assignOutputPaths(graph) {
  const outputPaths = new Map();
  const used = new Set();
  const rootName = `${portableName(path.basename(graph.rootPath, '.madcad'), 'main')}.madcad`;
  outputPaths.set(graph.rootPath, rootName);
  used.add(rootName.toLowerCase());
  for (const [absolutePath, node] of graph.nodes) {
    if (absolutePath === graph.rootPath) continue;
    const stem = portableName(path.basename(absolutePath, '.madcad'), 'linked-project');
    let fileName = `${stem}-${node.hash.slice(0, 8)}.madcad`;
    let suffix = 2;
    while (used.has(`dependencies/${fileName}`.toLowerCase())) fileName = `${stem}-${node.hash.slice(0, 8)}-${suffix++}.madcad`;
    const relativePath = `dependencies/${fileName}`;
    used.add(relativePath.toLowerCase());
    outputPaths.set(absolutePath, relativePath);
  }
  return outputPaths;
}

function renderPackedProjects(graph, { now = new Date().toISOString() } = {}) {
  const outputPaths = assignOutputPaths(graph);
  const rendered = new Map();
  for (const absolutePath of graph.postOrder) {
    const node = graph.nodes.get(absolutePath);
    const document = structuredClone(node.document);
    const sourceOutputPath = outputPaths.get(absolutePath);
    for (const edge of node.edges) {
      const targetOutputPath = outputPaths.get(edge.targetPath);
      const targetRendered = rendered.get(edge.targetPath);
      const relativePath = path.posix.relative(path.posix.dirname(sourceOutputPath), targetOutputPath) || path.posix.basename(targetOutputPath);
      document.linkedProjects[edge.index] = {
        ...document.linkedProjects[edge.index],
        relativePath,
        fileName: path.posix.basename(targetOutputPath),
        sourceHash: targetRendered.hash,
        sourceModifiedAt: now,
        refreshedAt: now,
      };
    }
    const text = `${JSON.stringify(document, null, 2)}\n`;
    rendered.set(absolutePath, { outputPath: sourceOutputPath, text, hash: sha256(text), size: Buffer.byteLength(text, 'utf8'), document });
  }
  return { outputPaths, rendered };
}

async function createPackAndGo(rootProjectPath, destinationDirectory, { fileSystem = fs, now = () => new Date().toISOString(), randomId = () => crypto.randomUUID() } = {}) {
  const destination = path.normalize(destinationDirectory);
  if (!path.isAbsolute(destination) || path.parse(destination).root === destination) throw new Error('Nieprawidłowy folder docelowy Pack & Go.');
  try {
    await fileSystem.stat(destination);
    throw new Error('Folder docelowy Pack & Go już istnieje. Wybierz nową nazwę.');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const graph = await buildPackGraph(rootProjectPath, { fileSystem });
  const createdAt = now();
  const packed = renderPackedProjects(graph, { now: createdAt });
  const temporaryDirectory = `${destination}.tmp-${randomId()}`;
  try {
    await fileSystem.mkdir(temporaryDirectory, { recursive: false });
    await fileSystem.mkdir(path.join(temporaryDirectory, 'dependencies'), { recursive: true });
    const files = [];
    for (const absolutePath of graph.postOrder) {
      const node = graph.nodes.get(absolutePath);
      const item = packed.rendered.get(absolutePath);
      const outputPath = path.join(temporaryDirectory, ...item.outputPath.split('/'));
      await fileSystem.writeFile(outputPath, item.text, { encoding: 'utf8', flag: 'wx' });
      files.push({
        path: item.outputPath,
        fileName: path.basename(absolutePath),
        documentId: item.document.id,
        name: String(item.document.name || path.basename(absolutePath, '.madcad')),
        sha256: item.hash,
        size: item.size,
        dependencies: node.edges.map((edge) => packed.outputPaths.get(edge.targetPath)),
      });
    }
    files.sort((first, second) => first.path.localeCompare(second.path));
    const manifest = { version: PACK_AND_GO_VERSION, createdAt, rootProject: packed.outputPaths.get(graph.rootPath), files };
    await fileSystem.writeFile(path.join(temporaryDirectory, 'madcad-pack.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await fileSystem.rename(temporaryDirectory, destination);
    return { destinationDirectory: destination, manifest };
  } catch (error) {
    await fileSystem.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

module.exports = { MAX_PROJECTS, PACK_AND_GO_VERSION, buildPackGraph, createPackAndGo, portableName, renderPackedProjects, sha256 };
