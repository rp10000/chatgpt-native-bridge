const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { summarizeCommand } = require("./audit");

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 300000;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
const SHELL_MODES = new Set(["trusted", "safe", "off"]);

async function runWorkspaceShell(options) {
  if (!options || typeof options !== "object") throw new Error("options are required.");
  if (typeof options.cwd !== "string" || !path.isAbsolute(options.cwd)) {
    throw new Error("cwd must be an absolute path.");
  }
  const cwd = options.cwd;
  const command = String(options.command || "").trim();
  if (!command) throw new Error("command is required.");
  const shellMode = normalizeShellMode(options.shellMode || process.env.CGN_SHELL_MODE || "trusted");
  assertCommandAllowed(command, shellMode);
  const timeoutMs = Math.min(Math.max(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS), 1), MAX_TIMEOUT_MS);
  const maxOutputBytes = Math.max(Number(options.maxOutputBytes || DEFAULT_MAX_OUTPUT_BYTES), 1);
  const shell = resolveShell(options.shell);
  const startedAt = Date.now();
  const shellCommand = shell.wrap ? shell.wrap(command) : command;

  const result = await runProcess(shell.command, [...shell.args, shellCommand], {
    cwd,
    timeoutMs,
    maxOutputBytes
  });

  return {
    commandId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    shell: shell.name,
    shellMode,
    cwd,
    ...summarizeCommand(command),
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    durationMs: Date.now() - startedAt,
    stdout: result.stdout,
    stderr: result.stderr,
    truncated: result.truncated,
    stdoutBytes: result.stdoutBytes,
    stderrBytes: result.stderrBytes,
    stdoutHash: result.stdoutHash,
    stderrHash: result.stderrHash
  };
}

function normalizeShellMode(value) {
  const mode = String(value || "trusted").trim().toLowerCase();
  if (!SHELL_MODES.has(mode)) throw new Error(`Invalid shell mode: ${value}`);
  return mode;
}

function assertCommandAllowed(command, shellMode) {
  if (shellMode === "trusted") return;
  if (shellMode === "off") {
    throw new Error("Workspace shell is disabled. Set shell mode to trusted or safe to run commands.");
  }

  const normalized = command.replace(/\s+/g, " ").trim();
  if (/[;&|<>`]/.test(normalized) || normalized.includes("$(")) {
    throw new Error("Safe shell mode blocks chained commands, pipes, redirects, and command substitution.");
  }

  const lower = normalized.toLowerCase();
  const allowed = [
    /^git (status|diff|log|show|branch|rev-parse|ls-files)(\b|$)/,
    /^npm test(\b|$)/,
    /^npm run (test|build|lint|typecheck|check|smoke|desktop:smoke)(\b|$)/,
    /^pnpm test(\b|$)/,
    /^pnpm run (test|build|lint|typecheck|check|smoke)(\b|$)/,
    /^yarn test(\b|$)/,
    /^yarn (test|build|lint|typecheck|check)(\b|$)/,
    /^node --test(\b|$)/,
    /^python -m (pytest|compileall|ruff check)(\b|$)/,
    /^py -m (pytest|compileall|ruff check)(\b|$)/,
    /^pytest(\b|$)/,
    /^ruff check(\b|$)/
  ].some((pattern) => pattern.test(lower));

  if (!allowed) {
    throw new Error(
      "Safe shell mode allows only common test, build, lint, and git inspection commands. Use trusted mode for broader shell access."
    );
  }
}

function resolveShell(value) {
  const requested = String(value || "").trim().toLowerCase();
  if (requested === "wsl") return { name: "wsl", command: "wsl.exe", args: ["bash", "-lc"] };
  if (requested === "git-bash") return { name: "git-bash", command: findGitBash(), args: ["--noprofile", "--norc", "-lc"] };
  if (requested === "bash") return { name: "bash", command: "bash", args: ["--noprofile", "--norc", "-lc"] };
  if (requested === "powershell" || process.platform === "win32") {
    return {
      name: "powershell",
      command: "powershell.exe",
      args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"],
      wrap: (command) => `${command}; exit $LASTEXITCODE`
    };
  }
  return { name: "bash", command: "bash", args: ["--noprofile", "--norc", "-lc"] };
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    let settled = false;
    let child;
    const stdout = captureOutput(options.maxOutputBytes);
    const stderr = captureOutput(options.maxOutputBytes);
    let timedOut = false;
    let timer;

    function finish(exitCode, signal) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdoutResult = stdout.finish();
      const stderrResult = stderr.finish();
      resolve({
        exitCode: timedOut ? null : exitCode,
        signal: signal || null,
        timedOut,
        stdout: stdoutResult.text,
        stderr: stderrResult.text,
        stdoutBytes: stdoutResult.bytes,
        stderrBytes: stderrResult.bytes,
        stdoutHash: stdoutResult.hash,
        stderrHash: stderrResult.hash,
        truncated: {
          stdout: stdoutResult.truncated,
          stderr: stderrResult.truncated
        }
      });
    }

    child = spawn(command, args, {
      cwd: options.cwd,
      env: minimalEnv(process.env),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr.push(chunk);
    });
    child.on("error", (error) => {
      stderr.push(Buffer.from(error.message));
      finish(null, null);
    });
    child.on("close", (exitCode, signal) => {
      finish(exitCode, signal);
    });
  });
}

function findGitBash() {
  const candidates = [
    process.env.GIT_BASH_PATH,
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "bash.exe";
}

function killProcessTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    killer.on("error", () => {});
    return;
  }
  child.kill("SIGTERM");
}

function captureOutput(maxBytes) {
  const hash = crypto.createHash("sha256");
  const chunks = [];
  let bytes = 0;
  let keptBytes = 0;

  return {
    push(chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      bytes += buffer.length;
      hash.update(buffer);
      if (keptBytes >= maxBytes) return;
      const slice = buffer.subarray(0, Math.min(buffer.length, maxBytes - keptBytes));
      chunks.push(slice);
      keptBytes += slice.length;
    },
    finish() {
      return {
        text: Buffer.concat(chunks).toString("utf8"),
        bytes,
        hash: hash.digest("hex"),
        truncated: bytes > keptBytes
      };
    }
  };
}

function minimalEnv(env) {
  const allowed = [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "ComSpec",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
    "LOCALAPPDATA",
    "APPDATA"
  ];
  const next = { CI: "1", NO_COLOR: "1" };
  for (const key of allowed) {
    if (env[key]) next[key] = env[key];
  }
  return next;
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  assertCommandAllowed,
  normalizeShellMode,
  runWorkspaceShell
};
