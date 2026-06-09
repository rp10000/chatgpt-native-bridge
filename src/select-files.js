const fs = require("node:fs/promises");
const path = require("node:path");

const { copyFileWithDirs, ensureDir, pathExists, toPosix } = require("./fs-utils");
const { inspectCandidate } = require("./secret-guard");

async function copySelectedFiles(options) {
  const patterns = options.patterns || [];
  const copied = [];
  if (!patterns.length) return copied;

  await ensureDir(options.destinationDir);
  const files = await expandGlobs(options.cwd, patterns);

  for (const source of files) {
    const relativePath = toPosix(path.relative(options.cwd, source));
    const stat = await fs.stat(source);
    if (!stat.isFile()) continue;

    let content;
    if (!options.binary) {
      content = await fs.readFile(source, "utf8");
    }

    const inspection = inspectCandidate({ relativePath, content, binary: options.binary });
    if (inspection.blocked) {
      options.warnings.push(inspection.reason);
      continue;
    }

    const destination = path.join(options.destinationDir, relativePath);
    await copyFileWithDirs(source, destination);
    copied.push({ relativePath, source, destination });
  }

  return copied;
}

async function expandGlobs(cwd, patterns) {
  const allFiles = await walkFiles(cwd);
  const selected = new Map();

  for (const pattern of patterns) {
    const normalized = toPosix(pattern).replace(/^\.\//, "");
    const direct = path.resolve(cwd, pattern);
    if (!hasGlob(normalized) && (await pathExists(direct))) {
      selected.set(path.resolve(direct), path.resolve(direct));
      continue;
    }

    const regex = globToRegExp(normalized);
    for (const file of allFiles) {
      const relative = toPosix(path.relative(cwd, file));
      if (regex.test(relative)) selected.set(file, file);
    }
  }

  return [...selected.values()].sort();
}

async function walkFiles(cwd, current = "") {
  const dir = path.join(cwd, current);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const relative = path.join(current, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(relative)) continue;
      result.push(...(await walkFiles(cwd, relative)));
    } else if (entry.isFile()) {
      result.push(path.join(cwd, relative));
    }
  }

  return result;
}

function shouldSkipDir(relative) {
  const normalized = toPosix(relative);
  return (
    normalized === ".git" ||
    normalized === "node_modules" ||
    normalized === ".chatgpt-native" ||
    normalized.startsWith(".git/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith(".chatgpt-native/") ||
    normalized.startsWith(".chatgpt-native/outbox/") ||
    normalized.startsWith(".chatgpt-native/inbox/") ||
    normalized.startsWith(".chatgpt-native/runs/")
  );
}

function hasGlob(pattern) {
  return /[*?]/.test(pattern);
}

function globToRegExp(pattern) {
  let output = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      output += ".*";
      index += 1;
    } else if (char === "*") {
      output += "[^/]*";
    } else if (char === "?") {
      output += "[^/]";
    } else {
      output += escapeRegex(char);
    }
  }
  output += "$";
  return new RegExp(output);
}

function escapeRegex(char) {
  return /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char;
}

module.exports = {
  copySelectedFiles,
  expandGlobs,
  globToRegExp
};
