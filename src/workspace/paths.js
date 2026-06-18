const fs = require("node:fs/promises");
const path = require("node:path");

const { toPosix } = require("../fs-utils");
const { sensitivePathReason } = require("../secret-guard");

const DEFAULT_DENIED_SEGMENTS = new Set([".git", ".chatgpt-native", "node_modules"]);
const SENSITIVE_CLASS_SEGMENTS = new Set(["key", "keys", "cookie", "cookies", "session", "sessions"]);

function normalizeWorkspacePath(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("A workspace-relative path is required.");
  if (isAbsoluteOrDrivePath(input)) throw new Error(`Absolute paths are not allowed: ${input}`);

  const posixInput = input.replace(/\\/g, "/");
  for (const segment of posixInput.split("/")) {
    if (segment === "..") throw new Error(`Path traversal is not allowed: ${input}`);
  }

  const normalizedPosix = path.posix.normalize(posixInput);
  if (
    normalizedPosix === "." ||
    normalizedPosix === ".." ||
    normalizedPosix.startsWith("../") ||
    path.posix.isAbsolute(normalizedPosix)
  ) {
    throw new Error(`Path traversal is not allowed: ${input}`);
  }
  return path.normalize(normalizedPosix);
}

function blockedWorkspacePathReason(relativePath) {
  const posix = toPosix(relativePath);
  const lower = posix.toLowerCase();
  const segments = lower.split("/");
  for (const segment of segments) {
    if (DEFAULT_DENIED_SEGMENTS.has(segment)) return `Blocked workspace path: ${posix}`;
    if (SENSITIVE_CLASS_SEGMENTS.has(segment)) return `Blocked sensitive credential path: ${posix}`;
  }
  return sensitivePathReason(posix);
}

async function getCanonicalRoot(rootDir) {
  if (!rootDir) throw new Error("A workspace root is required.");

  const root = path.resolve(rootDir);
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) throw new Error(`Workspace root is not a directory: ${root}`);

  return {
    root,
    canonicalRoot: await fs.realpath(root)
  };
}

async function resolveWorkspacePath(rootDir, relativePath, options = {}) {
  const root = path.resolve(rootDir);
  const normalized = normalizeWorkspacePath(relativePath);
  const blocked = blockedWorkspacePathReason(normalized);
  if (blocked) throw new Error(blocked);

  const target = path.resolve(root, normalized);
  assertInside(root, target);

  const rootReal = await fs.realpath(root);
  let targetReal = null;
  try {
    targetReal = await fs.realpath(target);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (!options.allowMissing) throw error;
    const parentReal = await realpathNearestExistingParent(path.dirname(target));
    assertInside(rootReal, parentReal);
  }

  if (targetReal) {
    assertInside(rootReal, targetReal);
    const lstat = await fs.lstat(target);
    if (lstat.isSymbolicLink()) throw new Error(`Symlink paths are not allowed: ${toPosix(normalized)}`);
  }

  return {
    root,
    relativePath: normalized,
    posixPath: toPosix(normalized),
    targetPath: target,
    targetRealPath: targetReal
  };
}

async function resolveWorkspaceReadPath(rootDir, relativePath) {
  const resolved = await resolveWorkspacePath(rootDir, relativePath);
  return {
    rootReal: await fs.realpath(resolved.root),
    relativePath: resolved.posixPath,
    absolutePath: resolved.targetRealPath
  };
}

async function resolveWorkspaceWritePath(rootDir, relativePath) {
  const resolved = await resolveWorkspacePath(rootDir, relativePath, { allowMissing: true });
  return {
    rootReal: await fs.realpath(resolved.root),
    relativePath: resolved.posixPath,
    absolutePath: resolved.targetPath
  };
}

function assertInside(rootDir, targetPath) {
  const relative = path.relative(rootDir, targetPath);
  if (relative && (relative.startsWith("..") || path.isAbsolute(relative))) {
    throw new Error(`Path escapes the workspace root: ${targetPath}`);
  }
}

async function realpathNearestExistingParent(startPath) {
  let current = startPath;
  while (true) {
    try {
      const stat = await fs.stat(current);
      if (!stat.isDirectory()) throw new Error(`Parent path is not a directory: ${startPath}`);
      return fs.realpath(current);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const next = path.dirname(current);
      if (next === current) throw error;
      current = next;
    }
  }
}

function isAbsoluteOrDrivePath(value) {
  return path.isAbsolute(value) || path.win32.isAbsolute(value) || path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value);
}

module.exports = {
  assertInside,
  assertInsideRoot: assertInside,
  blockedWorkspacePathReason,
  getCanonicalRoot,
  normalizeWorkspacePath,
  resolveWorkspacePath,
  resolveWorkspaceReadPath,
  resolveWorkspaceWritePath
};
