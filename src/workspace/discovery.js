const fs = require("node:fs/promises");
const path = require("node:path");

const { toPosix } = require("../fs-utils");
const { inspectCandidate } = require("../secret-guard");
const {
  assertInsideRoot,
  blockedWorkspacePathReason,
  normalizeWorkspacePath
} = require("./paths");

const DEFAULT_MAX_RESULTS = 50;
const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024;
const INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", "README.md"];

async function listWorkspaceDirectory(options = {}) {
  const root = path.resolve(options.root);
  const resolved = await resolveWorkspaceDirectory(root, options.path || ".");
  const maxEntries = Math.min(Math.max(Number(options.maxEntries || DEFAULT_MAX_ENTRIES), 1), 1000);
  const entries = await fs.readdir(resolved.absolutePath, { withFileTypes: true });
  const visible = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (visible.length >= maxEntries) break;
    const relativePath = toPosix(path.join(resolved.relativePath === "." ? "" : resolved.relativePath, entry.name));
    if (blockedWorkspacePathReason(relativePath)) continue;
    visible.push({
      name: entry.name,
      path: relativePath,
      type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other"
    });
  }

  return {
    path: resolved.relativePath,
    entries: visible,
    truncated: entries.length > visible.length
  };
}

async function searchWorkspace(options = {}) {
  const root = path.resolve(options.root);
  const query = String(options.query || "").trim();
  if (query.length < 2) throw new Error("query must be at least 2 characters.");
  const maxResults = Math.min(Math.max(Number(options.maxResults || DEFAULT_MAX_RESULTS), 1), 200);
  const results = [];
  const lowerQuery = query.toLowerCase();

  await walk(root, ".", async (absolutePath, relativePath) => {
    if (results.length >= maxResults) return false;
    const stat = await fs.stat(absolutePath);
    if (stat.size > DEFAULT_MAX_FILE_BYTES) return true;
    let text;
    try {
      text = await fs.readFile(absolutePath, "utf8");
    } catch {
      return true;
    }
    if (text.includes("\u0000")) return true;
    const inspection = inspectCandidate({ relativePath, content: text });
    if (inspection.blocked) return true;
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length && results.length < maxResults; index += 1) {
      const line = lines[index];
      if (!line.toLowerCase().includes(lowerQuery)) continue;
      results.push({
        path: relativePath,
        line: index + 1,
        preview: line.trim().slice(0, 240)
      });
    }
    return true;
  });

  return {
    query,
    results,
    truncated: results.length >= maxResults
  };
}

async function readProjectInstructions(options = {}) {
  const root = path.resolve(options.root);
  const files = [];
  for (const fileName of INSTRUCTION_FILES) {
    const absolutePath = path.join(root, fileName);
    try {
      const stat = await fs.stat(absolutePath);
      if (!stat.isFile()) continue;
      const text = await fs.readFile(absolutePath, "utf8");
      if (text.includes("\u0000")) continue;
      const inspection = inspectCandidate({ relativePath: fileName, content: text });
      if (inspection.blocked) continue;
      files.push({
        path: fileName,
        bytes: Buffer.byteLength(text, "utf8"),
        text: text.slice(0, Number(options.maxBytes || 32 * 1024)),
        truncated: Buffer.byteLength(text, "utf8") > Number(options.maxBytes || 32 * 1024)
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return {
    files,
    order: INSTRUCTION_FILES
  };
}

async function walk(root, relativeDir, onFile) {
  const absoluteDir = relativeDir === "." ? root : path.join(root, relativeDir);
  let entries;
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relativePath = toPosix(path.join(relativeDir === "." ? "" : relativeDir, entry.name));
    if (blockedWorkspacePathReason(relativePath)) continue;
    const absolutePath = path.join(root, relativePath);
    if (entry.isDirectory()) {
      await walk(root, relativePath, onFile);
    } else if (entry.isFile()) {
      const shouldContinue = await onFile(absolutePath, relativePath);
      if (shouldContinue === false) return;
    }
  }
}

async function resolveWorkspaceDirectory(root, relativePath) {
  const relative = relativePath === "." || relativePath === "" ? "." : normalizeWorkspacePath(relativePath);
  if (relative !== ".") {
    const blocked = blockedWorkspacePathReason(relative);
    if (blocked) throw new Error(blocked);
  }
  const absolutePath = relative === "." ? root : path.resolve(root, relative);
  assertInsideRoot(root, absolutePath);
  const rootReal = await fs.realpath(root);
  const targetReal = await fs.realpath(absolutePath);
  assertInsideRoot(rootReal, targetReal);
  const stat = await fs.stat(targetReal);
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${relative}`);
  return {
    relativePath: toPosix(relative),
    absolutePath: targetReal
  };
}

module.exports = {
  listWorkspaceDirectory,
  readProjectInstructions,
  searchWorkspace
};
