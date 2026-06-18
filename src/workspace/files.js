const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { inspectCandidate } = require("../secret-guard");
const {
  assertInsideRoot,
  resolveWorkspaceReadPath,
  resolveWorkspaceWritePath
} = require("./paths");

const DEFAULT_MAX_BYTES = 64 * 1024;
const HASH_PREFIX = "sha256:";

async function readWorkspaceFile(options = {}) {
  const resolved = await resolveWorkspaceReadPath(options.root, getRelativePath(options));
  const current = await readTextFile(resolved.absolutePath, resolved.relativePath, true);
  const maxBytes = clampMaxBytes(options.maxBytes);
  const truncated = truncateText(current.text, maxBytes);

  return {
    path: resolved.relativePath,
    relativePath: resolved.relativePath,
    text: truncated.text,
    hash: hashText(current.text),
    truncation: {
      truncated: truncated.truncated,
      bytes: truncated.bytes,
      totalBytes: current.bytes,
      maxBytes
    }
  };
}

async function writeWorkspaceFile(options = {}) {
  const text = getWriteText(options);
  const ifExists = options.ifExists || "overwrite";
  validateIfExists(ifExists);

  const resolved = await resolveWorkspaceWritePath(options.root, getRelativePath(options));
  const current = await readCurrentIfExists(resolved.absolutePath, resolved.relativePath);

  if (current.exists && ifExists === "error") {
    throw new Error(`File already exists: ${resolved.relativePath}`);
  }
  if (current.exists && ifExists === "skip") {
    return {
      path: resolved.relativePath,
      relativePath: resolved.relativePath,
      hash: current.hash,
      bytes: current.bytes,
      written: false,
      skipped: true
    };
  }

  assertExpectedHash(current, options.expectedHash, resolved.relativePath);
  inspectText(resolved.relativePath, text);
  await atomicWriteFile(resolved.absolutePath, text, resolved.rootReal);

  const hash = hashText(text);
  return {
    path: resolved.relativePath,
    relativePath: resolved.relativePath,
    created: !current.exists,
    overwritten: current.exists,
    hash,
    newHash: hash,
    oldHash: current.hash || null,
    bytes: Buffer.byteLength(text, "utf8"),
    written: true,
    skipped: false
  };
}

async function editWorkspaceFile(options = {}) {
  if (!options.expectedHash) {
    throw new Error("expectedHash is required for edit.");
  }

  const edits = getEdits(options);
  const resolved = await resolveWorkspaceReadPath(options.root, getRelativePath(options));
  const current = await readTextFile(resolved.absolutePath, resolved.relativePath, true);
  const currentHash = hashText(current.text);
  if (currentHash !== options.expectedHash) {
    throw new Error(`Hash mismatch for ${resolved.relativePath}.`);
  }

  let nextText = current.text;
  let editsApplied = 0;
  for (const edit of edits) {
    const oldText = requireText(edit.oldText, "oldText");
    const newText = requireText(edit.newText, "newText");
    if (oldText === "") throw new Error("oldText must not be empty.");

    const occurrences = countOccurrences(nextText, oldText);
    if (occurrences === 0) {
      throw new Error(`oldText was not found in ${resolved.relativePath}.`);
    }
    if (occurrences > 1 && !edit.replaceAll) {
      throw new Error(`oldText is not unique in ${resolved.relativePath}.`);
    }

    nextText = edit.replaceAll ? nextText.split(oldText).join(newText) : nextText.replace(oldText, newText);
    editsApplied += edit.replaceAll ? occurrences : 1;
  }

  inspectText(resolved.relativePath, nextText);
  await atomicWriteFile(resolved.absolutePath, nextText, resolved.rootReal);

  const hash = hashText(nextText);
  return {
    path: resolved.relativePath,
    relativePath: resolved.relativePath,
    editsApplied,
    oldHash: currentHash,
    hash,
    newHash: hash,
    bytes: Buffer.byteLength(nextText, "utf8"),
    written: true,
    skipped: false
  };
}

function hashText(text) {
  return hashBuffer(Buffer.from(text, "utf8"));
}

function sha256(value) {
  return hashBuffer(Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8"));
}

function hashBuffer(buffer) {
  return HASH_PREFIX + crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readCurrentIfExists(absolutePath, relativePath) {
  try {
    const current = await readTextFile(absolutePath, relativePath, false);
    return {
      exists: true,
      ...current,
      hash: hashText(current.text)
    };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false };
    throw error;
  }
}

async function readTextFile(absolutePath, relativePath, inspectContent) {
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) throw new Error(`Not a file: ${relativePath}`);

  const text = await fs.readFile(absolutePath, "utf8");
  if (text.includes("\u0000")) throw new Error(`Binary file blocked: ${relativePath}`);
  if (inspectContent) inspectText(relativePath, text);

  return {
    text,
    bytes: Buffer.byteLength(text, "utf8")
  };
}

async function atomicWriteFile(absolutePath, text, rootReal) {
  const dir = path.dirname(absolutePath);
  await fs.mkdir(dir, { recursive: true });
  const parentReal = await fs.realpath(dir);
  assertInsideRoot(rootReal, parentReal, `Path escapes the workspace root: ${absolutePath}`);

  const tempPath = path.join(
    dir,
    `.${path.basename(absolutePath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString("hex")}.tmp`
  );

  try {
    await fs.writeFile(tempPath, text, { encoding: "utf8", flag: "wx" });
    await fs.rename(tempPath, absolutePath);
  } catch (error) {
    await fs.unlink(tempPath).catch((unlinkError) => {
      if (unlinkError.code !== "ENOENT") throw unlinkError;
    });
    throw error;
  }
}

function assertExpectedHash(current, expectedHash, relativePath) {
  if (expectedHash === undefined) return;
  if (!current.exists) {
    throw new Error(`Hash mismatch for ${relativePath}: file does not exist.`);
  }
  if (current.hash !== expectedHash) {
    throw new Error(`Hash mismatch for ${relativePath}.`);
  }
}

function inspectText(relativePath, text) {
  const inspection = inspectCandidate({ relativePath, content: text });
  if (inspection.blocked) throw new Error(inspection.reason);
}

function truncateText(text, maxBytes) {
  const totalBytes = Buffer.byteLength(text, "utf8");
  if (totalBytes <= maxBytes) {
    return {
      text,
      bytes: totalBytes,
      truncated: false
    };
  }

  let bytes = 0;
  let end = 0;
  for (const char of text) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (bytes + charBytes > maxBytes) break;
    bytes += charBytes;
    end += char.length;
  }

  return {
    text: text.slice(0, end),
    bytes,
    truncated: true
  };
}

function countOccurrences(text, search) {
  let count = 0;
  let index = 0;
  while (true) {
    index = text.indexOf(search, index);
    if (index === -1) return count;
    count += 1;
    index += search.length;
  }
}

function clampMaxBytes(value) {
  if (value === undefined || value === null) return DEFAULT_MAX_BYTES;
  const maxBytes = Number(value);
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error("maxBytes must be a positive integer.");
  }
  return Math.min(maxBytes, DEFAULT_MAX_BYTES);
}

function getRelativePath(options) {
  return options.relativePath ?? options.path;
}

function getWriteText(options) {
  if (options.text !== undefined) return requireText(options.text, "text");
  if (options.content !== undefined) return requireText(options.content, "content");
  return requireText(undefined, "text");
}

function getEdits(options) {
  if (Array.isArray(options.edits)) return options.edits;
  return [{
    oldText: options.oldText,
    newText: options.newText,
    replaceAll: options.replaceAll
  }];
}

function requireText(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  return value;
}

function validateIfExists(value) {
  if (!["overwrite", "error", "skip"].includes(value)) {
    throw new Error("ifExists must be one of: overwrite, error, skip.");
  }
}

module.exports = {
  editWorkspaceFile,
  hashText,
  readWorkspaceFile,
  sha256,
  writeWorkspaceFile
};
