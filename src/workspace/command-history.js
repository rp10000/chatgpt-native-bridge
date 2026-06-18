const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureDir, toPosix } = require("../fs-utils");
const { redact } = require("./audit");

const HISTORY_FILE = path.join(".chatgpt-native", "runs", "command-history.jsonl");
const DEFAULT_LIMIT = 20;
const PREVIEW_LIMIT = 2000;

async function appendCommandHistory(root, details = {}) {
  const historyPath = path.join(root, HISTORY_FILE);
  const result = details.result || {};
  const record = {
    id: result.commandId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    workspaceId: details.workspaceId || null,
    cwdRelative: toPosix(path.relative(root, details.workingDirectory || root) || "."),
    shell: result.shell || null,
    commandRedacted: result.commandRedacted || "",
    commandHash: result.commandHash || null,
    exitCode: result.exitCode ?? null,
    signal: result.signal || null,
    timedOut: result.timedOut === true,
    durationMs: typeof result.durationMs === "number" ? result.durationMs : null,
    stdoutBytes: result.stdoutBytes || Buffer.byteLength(result.stdout || "", "utf8"),
    stderrBytes: result.stderrBytes || Buffer.byteLength(result.stderr || "", "utf8"),
    stdoutPreview: preview(result.stdout),
    stderrPreview: preview(result.stderr),
    truncated: result.truncated || { stdout: false, stderr: false }
  };

  await ensureDir(path.dirname(historyPath));
  await fs.appendFile(historyPath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

async function readCommandHistory(root, options = {}) {
  const historyPath = path.join(root, HISTORY_FILE);
  const limit = Math.min(Math.max(Number(options.limit || DEFAULT_LIMIT), 1), 100);
  try {
    const text = await fs.readFile(historyPath, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => safeJson(line))
      .filter(Boolean)
      .slice(-limit)
      .reverse();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function preview(value) {
  return redact(String(value || "")).slice(0, PREVIEW_LIMIT);
}

function safeJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

module.exports = {
  appendCommandHistory,
  readCommandHistory
};
