const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureDir } = require("../fs-utils");

async function appendWorkspaceAudit(root, event) {
  try {
    const auditPath = path.join(root, ".chatgpt-native", "runs", "devspace-audit.jsonl");
    await ensureDir(path.dirname(auditPath));
    await fs.appendFile(auditPath, `${JSON.stringify(sanitizeAuditEvent({ ts: new Date().toISOString(), ...event }))}\n`);
  } catch {
    // Audit logging should not break local development commands.
  }
}

async function appendShellRunAuditEvent(auditPath, details) {
  const event = buildShellRunAuditEvent(details);
  await appendAuditEvent(auditPath, event);
  return event;
}

async function appendAuditEvent(auditPath, event) {
  await ensureDir(path.dirname(auditPath));
  await fs.appendFile(auditPath, `${JSON.stringify(sanitizeAuditEvent(event))}\n`, "utf8");
}

function buildShellRunAuditEvent(details) {
  const result = details.result || {};
  return sanitizeAuditEvent({
    timestamp: new Date().toISOString(),
    type: "workspace.shell.run",
    cwd: details.cwd,
    shell: details.shell || result.shell || null,
    commandRedacted: redact(details.command || ""),
    commandHash: sha256(details.command || ""),
    exitCode: result.exitCode ?? null,
    signal: result.signal ?? null,
    timedOut: result.timedOut === true,
    durationMs: typeof result.durationMs === "number" ? result.durationMs : null,
    truncated: result.truncated || { stdout: false, stderr: false },
    stdout: outputSummary(result, "stdout"),
    stderr: outputSummary(result, "stderr")
  });
}

function summarizeCommand(command) {
  const normalized = String(command || "").replace(/\s+/g, " ").trim();
  return {
    commandRedacted: redact(normalized).slice(0, 240),
    commandHash: sha256(normalized)
  };
}

function redact(value) {
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, "$1[redacted]")
    .replace(/(--(?:api-key|token|secret|password)(?:=|\s+))("[^"]+"|'[^']+'|\S+)/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key|token|secret|password)=([^\s]+)/gi, "$1=[redacted]");
}

function sanitizeAuditEvent(event) {
  const copy = { ...event };
  delete copy.command;

  if (typeof copy.stdout === "string") copy.stdout = outputSummary({ stdout: copy.stdout }, "stdout");
  if (typeof copy.stderr === "string") copy.stderr = outputSummary({ stderr: copy.stderr }, "stderr");
  if (copy.stdout && typeof copy.stdout === "object") delete copy.stdout.text;
  if (copy.stderr && typeof copy.stderr === "object") delete copy.stderr.text;

  return copy;
}

function outputSummary(result, streamName) {
  const text = typeof result[streamName] === "string" ? result[streamName] : "";
  const bytesKey = `${streamName}Bytes`;
  const hashKey = `${streamName}Hash`;
  return {
    bytes: typeof result[bytesKey] === "number" ? result[bytesKey] : Buffer.byteLength(text),
    hash: typeof result[hashKey] === "string" ? result[hashKey] : sha256(text)
  };
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

module.exports = {
  appendAuditEvent,
  appendShellRunAuditEvent,
  appendWorkspaceAudit,
  buildShellRunAuditEvent,
  redact,
  sanitizeAuditEvent,
  sha256,
  summarizeCommand
};
