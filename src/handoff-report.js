const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureDir } = require("./fs-utils");
const { makeRunId } = require("./id");
const { getWorkspaceChangeSummary } = require("./workspace/change-tracker");
const { readCommandHistory } = require("./workspace/command-history");
const { getProjectIdentity } = require("./project-identity");

async function createHandoffReport(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const id = normalizeReportId(options.id, options.now || new Date());
  const reportDir = path.join(cwd, ".chatgpt-native", "reports", id);
  const inboxDir = path.join(cwd, ".chatgpt-native", "inbox", id);
  const reportPath = path.join(reportDir, "HANDOFF_REPORT.md");
  const replyPath = path.join(inboxDir, "reply.md");
  const codexReadThisPath = path.join(inboxDir, "CODEX_READ_THIS.md");
  const reportMetaPath = path.join(reportDir, "report-meta.json");
  const inboxMetaPath = path.join(inboxDir, "report-meta.json");
  const project = getProjectIdentity(cwd);

  const snapshot = await collectReportSnapshot(cwd, options);
  const markdown = buildHandoffReport({
    id,
    cwd,
    project,
    task: options.task || "",
    notes: options.markdown || options.notes || "",
    snapshot
  });

  await ensureDir(reportDir);
  await ensureDir(inboxDir);
  const meta = {
    id,
    createdAt: new Date().toISOString(),
    projectRoot: project.projectRoot,
    projectName: project.projectName,
    projectFingerprint: project.projectFingerprint,
    reportPath,
    replyPath,
    codexReadThisPath
  };
  await fs.writeFile(reportPath, markdown, "utf8");
  await fs.writeFile(replyPath, markdown, "utf8");
  await fs.writeFile(reportMetaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
  await fs.writeFile(inboxMetaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
  await fs.writeFile(codexReadThisPath, buildCodexReviewPrompt({ id, reportPath, replyPath, project }), "utf8");

  return {
    id,
    reportPath,
    replyPath,
    codexReadThisPath,
    projectRoot: project.projectRoot,
    projectName: project.projectName,
    projectFingerprint: project.projectFingerprint,
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

function buildHandoffReport({ id, cwd, project, task, notes, snapshot }) {
  const changes = snapshot.changes || {};
  const statusEntries = changes.status && changes.status.entries ? changes.status.entries : [];
  const diffFiles = changes.diff && changes.diff.files ? changes.diff.files : [];
  const commands = Array.isArray(snapshot.commands) ? snapshot.commands : [];
  const toolCalls = snapshot.trace && Array.isArray(snapshot.trace.toolCalls) ? snapshot.trace.toolCalls : [];
  const requests = snapshot.trace && Array.isArray(snapshot.trace.requests) ? snapshot.trace.requests : [];
  const warnings = Array.isArray(changes.warnings) ? changes.warnings : [];
  const testResults = inferTestResults(commands);

  return `# ChatGPT Native Bridge Handoff Report

Run: ${id}
Project: ${project && project.projectName ? project.projectName : path.basename(cwd)}
Project root: ${cwd}
Project fingerprint: ${project && project.projectFingerprint ? project.projectFingerprint : "unknown"}

## Goal

${task || "No explicit task was provided."}

## ChatGPT Notes

${notes || "No final notes were provided by ChatGPT."}

## What ChatGPT Actually Did

${formatActualWork(toolCalls, commands, statusEntries, diffFiles)}

## Modified Files

${formatModifiedFiles(statusEntries, diffFiles)}

## Key Diff Summary

${formatDiffSummary(diffFiles, changes.diff)}

## Commands and Results

${formatCommands(commands)}

## Test Results

${formatTestResults(testResults)}

## Risks and Remaining Work

${formatRisksAndRemainingWork(warnings, testResults, statusEntries, diffFiles)}

## Recent Tool Calls

${formatToolCalls(toolCalls)}

## Recent MCP Requests

${formatRequests(requests)}

## Suggested Commit Message

${suggestCommitMessage(task, statusEntries, diffFiles)}

## Codex Review Steps

- Read this report.
- Inspect the actual diff.
- Run relevant tests locally.
- Check that no secrets, credentials, caches, logs, or generated runtime data are committed.
- Commit and push only after verification passes.

## Codex Review Checklist

- Review the current diff before trusting the changes.
- Run the relevant tests locally.
- Check that no secrets, credentials, caches, logs, or generated runtime data are committed.
- Commit and push only after the local checks pass.
`;
}

function buildCodexReviewPrompt({ id, reportPath, replyPath, project }) {
  const projectRoot = project && project.projectRoot ? project.projectRoot : path.dirname(path.dirname(path.dirname(reportPath)));
  const projectName = project && project.projectName ? project.projectName : path.basename(projectRoot);
  return [
    "# Codex: review this Bridge handoff",
    "",
    `Run: ${id}`,
    `Project: ${projectName}`,
    `Project root: \`${projectRoot}\``,
    "",
    "Only use this handoff in a Codex session opened for the project root above. If your current workspace is a different project, stop and switch/open that project first.",
    "",
    `- Report: \`${reportPath}\``,
    `- Inbox copy: \`${replyPath}\``,
    "",
    "Read the handoff report. Inspect the actual diff in that project. Run relevant tests. Fix anything unsafe or incomplete. Commit and push only after verification.",
    ""
  ].join("\n");
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

function formatActualWork(toolCalls, commands, statusEntries, diffFiles) {
  const lines = [];
  if (toolCalls.length) lines.push(`- MCP tool calls recorded: ${toolCalls.length}.`);
  if (commands.length) lines.push(`- Shell commands recorded: ${commands.length}.`);
  if (statusEntries.length || diffFiles.length) {
    lines.push(`- File changes detected: ${Math.max(statusEntries.length, diffFiles.length)}.`);
  }
  if (!lines.length) lines.push("- No tool calls, shell commands, or file changes were recorded.");
  return lines.join("\n");
}

function formatModifiedFiles(statusEntries, diffFiles) {
  const byPath = new Map();
  for (const entry of statusEntries) {
    if (entry.path) byPath.set(entry.path, entry.code ? `${entry.code} ${entry.path}` : entry.path);
  }
  for (const file of diffFiles) {
    if (file.path && !byPath.has(file.path)) byPath.set(file.path, file.path);
  }
  const files = [...byPath.values()];
  if (!files.length) return "- No modified files were detected.";
  return files.slice(0, 30).map((file) => `- ${file}`).join("\n");
}

function formatToolCalls(toolCalls) {
  if (!toolCalls.length) return "- No MCP tool calls recorded.";
  return toolCalls.slice(-20).map((event) => {
    const status = event.ok === false ? `failed: ${event.error || "unknown error"}` : "ok";
    return `- ${event.ts || ""} ${event.toolName || "tool"} ${status}`.trim();
  }).join("\n");
}

function formatCommands(commands) {
  if (!commands.length) return "- No shell commands were recorded.";
  return commands.slice(0, 12).map((command) => {
    const exit = command.exitCode ?? "unknown";
    return `- ${command.ts || ""} \`${command.commandRedacted || "(unknown)"}\` exit ${exit}`.trim();
  }).join("\n");
}

function inferTestResults(commands) {
  const checks = commands.filter((command) => /\b(test|pytest|ruff|lint|typecheck|check|build|compileall|smoke)\b/i.test(command.commandRedacted || command.command || ""));
  return {
    checks,
    failed: checks.filter((command) => Number.isInteger(command.exitCode) && command.exitCode !== 0),
    passed: checks.filter((command) => command.exitCode === 0)
  };
}

function formatTestResults(testResults) {
  if (!testResults.checks.length) return "- No test, lint, build, or smoke command was recorded.";
  const lines = testResults.checks.slice(0, 12).map((command) => {
    const exit = command.exitCode ?? "unknown";
    return `- \`${command.commandRedacted || command.command || "(unknown)"}\` exit ${exit}`;
  });
  if (testResults.failed.length) lines.push(`- Failed verification commands: ${testResults.failed.length}.`);
  if (!testResults.failed.length && testResults.passed.length) lines.push("- Recorded verification commands passed.");
  return lines.join("\n");
}

function formatRisksAndRemainingWork(warnings, testResults, statusEntries, diffFiles) {
  const lines = [];
  if (!statusEntries.length && !diffFiles.length) lines.push("- No file changes were detected; confirm whether the task required code edits.");
  if (!testResults.checks.length) lines.push("- No test or verification command was recorded.");
  if (testResults.failed.length) lines.push("- One or more verification commands failed.");
  if (warnings.length) lines.push(...warnings.slice(0, 8).map((warning) => `- ${warning}`));
  if (!lines.length) lines.push("- No obvious unresolved risks were recorded. Codex should still inspect the diff before commit.");
  return lines.join("\n");
}

function suggestCommitMessage(task, statusEntries, diffFiles) {
  const fileCount = Math.max(statusEntries.length, diffFiles.length);
  if (!fileCount) return "chore: record ChatGPT handoff review";
  const normalized = String(task || "").trim().toLowerCase();
  if (normalized.includes("doc") || normalized.includes("readme")) return "docs: update bridge workflow documentation";
  if (normalized.includes("test")) return "test: update bridge verification coverage";
  if (normalized.includes("fix")) return "fix: apply ChatGPT bridge review changes";
  return "chore: apply ChatGPT bridge handoff changes";
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
