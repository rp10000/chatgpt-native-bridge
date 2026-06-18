const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureDir } = require("./fs-utils");
const { makeRunId } = require("./id");
const { getWorkspaceChangeSummary } = require("./workspace/change-tracker");
const { readCommandHistory } = require("./workspace/command-history");

async function createHandoffReport(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const id = normalizeReportId(options.id, options.now || new Date());
  const reportDir = path.join(cwd, ".chatgpt-native", "reports", id);
  const inboxDir = path.join(cwd, ".chatgpt-native", "inbox", id);
  const reportPath = path.join(reportDir, "HANDOFF_REPORT.md");
  const replyPath = path.join(inboxDir, "reply.md");
  const codexReadThisPath = path.join(inboxDir, "CODEX_READ_THIS.md");

  const snapshot = await collectReportSnapshot(cwd, options);
  const markdown = buildHandoffReport({
    id,
    cwd,
    task: options.task || "",
    notes: options.markdown || options.notes || "",
    snapshot
  });

  await ensureDir(reportDir);
  await ensureDir(inboxDir);
  await fs.writeFile(reportPath, markdown, "utf8");
  await fs.writeFile(replyPath, markdown, "utf8");
  await fs.writeFile(codexReadThisPath, buildCodexReviewPrompt({ id, reportPath, replyPath }), "utf8");

  return {
    id,
    reportPath,
    replyPath,
    codexReadThisPath,
    summary: summarizeReport(snapshot)
  };
}

async function collectReportSnapshot(cwd, options = {}) {
  const [changes, commands, trace] = await Promise.all([
    getWorkspaceChangeSummary({ cwd, includeDiff: true, maxBytes: options.maxBytes || 80 * 1024 }),
    readCommandHistory(cwd, { limit: options.commandLimit || 12 }),
    readTraceSnapshot(cwd, options.traceLimit || 20)
  ]);

  return {
    changes,
    commands,
    trace
  };
}

async function readTraceSnapshot(cwd, limit) {
  const runsDir = path.join(cwd, ".chatgpt-native", "runs");
  const [requests, toolCalls] = await Promise.all([
    readJsonlTail(path.join(runsDir, "mcp-requests.jsonl"), limit),
    readJsonlTail(path.join(runsDir, "mcp-audit.jsonl"), limit)
  ]);
  return {
    requests,
    toolCalls: toolCalls.filter((event) => event.toolName)
  };
}

async function readJsonlTail(filePath, limit) {
  let text = "";
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-Math.max(Number(limit) || 1, 1))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeReportId(id, now) {
  const value = String(id || "").trim();
  if (value && value !== "latest") return value;
  return makeRunId("handoff-report", now);
}

function buildHandoffReport({ id, cwd, task, notes, snapshot }) {
  const changes = snapshot.changes || {};
  const statusEntries = changes.status && changes.status.entries ? changes.status.entries : [];
  const diffFiles = changes.diff && changes.diff.files ? changes.diff.files : [];
  const commands = Array.isArray(snapshot.commands) ? snapshot.commands : [];
  const toolCalls = snapshot.trace && Array.isArray(snapshot.trace.toolCalls) ? snapshot.trace.toolCalls : [];
  const requests = snapshot.trace && Array.isArray(snapshot.trace.requests) ? snapshot.trace.requests : [];
  const warnings = Array.isArray(changes.warnings) ? changes.warnings : [];

  return `# ChatGPT Native Bridge Handoff Report

Run: ${id}
Project: ${cwd}

## Task

${task || "No explicit task was provided."}

## ChatGPT Notes

${notes || "No final notes were provided by ChatGPT."}

## Git Status

${formatGitStatus(changes.status)}

## Diff Summary

${formatDiffSummary(diffFiles, changes.diff)}

## Recent Tool Calls

${formatToolCalls(toolCalls)}

## Recent Shell Commands

${formatCommands(commands)}

## Recent MCP Requests

${formatRequests(requests)}

## Warnings

${warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "- None."}

## Codex Review Checklist

- Review the current diff before trusting the changes.
- Run the relevant tests locally.
- Check that no secrets, credentials, caches, logs, or generated runtime data are committed.
- Commit and push only after the local checks pass.
`;
}

function buildCodexReviewPrompt({ id, reportPath, replyPath }) {
  return `# Codex: review this ChatGPT handoff report

ChatGPT worked through the MCP bridge and generated a handoff report.

Run: ${id}

## Files

- Report: \`${reportPath}\`
- Inbox copy: \`${replyPath}\`

## Your job

1. Read \`HANDOFF_REPORT.md\` or \`reply.md\`.
2. Inspect the actual working tree and diff.
3. Run relevant tests.
4. Fix anything unsafe or incomplete.
5. Commit and push only after verification.

Do not assume ChatGPT's changes are correct without checking them locally.
`;
}

function summarizeReport(snapshot) {
  const changes = snapshot.changes || {};
  const statusEntries = changes.status && changes.status.entries ? changes.status.entries : [];
  const diffFiles = changes.diff && changes.diff.files ? changes.diff.files : [];
  const commands = Array.isArray(snapshot.commands) ? snapshot.commands : [];
  const toolCalls = snapshot.trace && Array.isArray(snapshot.trace.toolCalls) ? snapshot.trace.toolCalls : [];
  return {
    changedFiles: statusEntries.length,
    diffFiles: diffFiles.length,
    commands: commands.length,
    toolCalls: toolCalls.length
  };
}

function formatGitStatus(status) {
  if (!status) return "- Git status is unavailable.";
  if (status.clean) return "- Working tree is clean.";
  return status.entries.map((entry) => `- ${entry.code} ${entry.path}`).join("\n") || "- No status entries.";
}

function formatDiffSummary(files, diff) {
  if (!diff) return "- Git diff is unavailable.";
  const lines = [];
  lines.push(`- Diff bytes: ${diff.bytes || 0}${diff.truncated ? " (truncated)" : ""}`);
  if (files.length) {
    for (const file of files.slice(0, 20)) lines.push(`- ${file.path}`);
  } else {
    lines.push("- No diff files detected.");
  }
  return lines.join("\n");
}

function formatToolCalls(toolCalls) {
  if (!toolCalls.length) return "- No MCP tool calls recorded.";
  return toolCalls.slice(-20).map((event) => {
    const status = event.ok === false ? `failed: ${event.error || "unknown error"}` : "ok";
    return `- ${event.ts || ""} ${event.toolName || "tool"} ${status}`.trim();
  }).join("\n");
}

function formatCommands(commands) {
  if (!commands.length) return "- No shell commands recorded.";
  return commands.slice(0, 12).map((command) => {
    const exit = command.exitCode ?? "unknown";
    return `- ${command.ts || ""} \`${command.commandRedacted || "(unknown)"}\` exit ${exit}`.trim();
  }).join("\n");
}

function formatRequests(requests) {
  if (!requests.length) return "- No MCP HTTP requests recorded.";
  return requests.slice(-20).map((event) => {
    const method = event.rpcMethod ? ` ${event.rpcMethod}` : "";
    const status = event.statusCode ? ` -> ${event.statusCode}` : "";
    return `- ${event.ts || ""} ${event.httpMethod || ""}${method}${status}`.trim();
  }).join("\n");
}

module.exports = {
  buildHandoffReport,
  buildCodexReviewPrompt,
  createHandoffReport
};
