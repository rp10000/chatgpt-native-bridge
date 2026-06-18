const { spawn } = require("node:child_process");
const path = require("node:path");

async function getWorkspaceChanges(root, options = {}) {
  const status = await git(root, ["status", "--short"]);
  const includeDiff = options.includeDiff !== false;
  const diff = includeDiff ? await git(root, ["diff", "--no-ext-diff", "--no-color"]) : { ok: false, stdout: "", stderr: "" };
  const maxBytes = Math.max(Number(options.maxBytes || 200 * 1024), 1);
  const diffBytes = Buffer.byteLength(diff.stdout || "", "utf8");
  const truncated = diffBytes > maxBytes;
  const diffText = truncated ? Buffer.from(diff.stdout, "utf8").subarray(0, maxBytes).toString("utf8") : diff.stdout;

  return {
    gitStatus: status.ok
      ? { available: true, text: status.stdout }
      : { available: false, reason: status.stderr || "git status failed", text: "" },
    diff: includeDiff
      ? {
          available: diff.ok,
          reason: diff.ok ? "" : diff.stderr || "git diff failed",
          text: diffText,
          bytes: diffBytes,
          truncated
        }
      : { available: false, reason: "includeDiff was false", text: "", bytes: 0, truncated: false },
    warnings: [status, diff]
      .filter((item) => item && !item.ok && item.stderr)
      .map((item) => item.stderr)
  };
}

async function getWorkspaceChangeSummary(options) {
  const cwd = typeof options === "string" ? options : options && options.cwd;
  if (typeof cwd !== "string" || !path.isAbsolute(cwd)) {
    return { ok: false, warnings: ["cwd must be an absolute path"], status: null, diff: null };
  }

  const changes = await getWorkspaceChanges(cwd, options || {});
  const warnings = changes.warnings.length > 0 ? changes.warnings : collectWarnings(changes);

  return {
    ok: warnings.length === 0,
    warnings,
    status: changes.gitStatus.available
      ? {
          clean: changes.gitStatus.text.trim().length === 0,
          entries: parseStatus(changes.gitStatus.text),
          text: changes.gitStatus.text.trim()
        }
      : null,
    diff: changes.diff.available
      ? {
          text: changes.diff.text,
          bytes: changes.diff.bytes,
          truncated: changes.diff.truncated,
          files: parseDiffFiles(changes.diff.text)
        }
      : null
  };
}

async function git(cwd, args) {
  return run("git", args, { cwd, timeoutMs: 10000, maxBytes: 1024 * 1024 });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true
    });
    const stdout = [];
    const stderr = [];
    const maxBytes = options.maxBytes || 200 * 1024;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs || 30000);

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= maxBytes) stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= maxBytes) stderr.push(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout: "", stderr: error.message, timedOut });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        code,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        timedOut,
        truncated: stdoutBytes > maxBytes || stderrBytes > maxBytes
      });
    });
  });
}

function collectWarnings(changes) {
  return [changes.gitStatus, changes.diff]
    .filter((item) => item && item.available === false && item.reason)
    .map((item) => item.reason);
}

function parseStatus(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      code: line.slice(0, 2),
      path: line.slice(3)
    }));
}

function parseDiffFiles(text) {
  const files = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\+\+\+ b\/(.+)$/);
    if (match) files.add(match[1]);
  }
  return [...files].map((filePath) => ({ path: filePath }));
}

module.exports = {
  getWorkspaceChangeSummary,
  getWorkspaceChanges
};
