const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureDir, pathExists } = require("./fs-utils");
const { getGitDiff, getGitStatus } = require("./git");
const { writeCodexReadThis } = require("./handoff-files");
const { makeRunId } = require("./id");

const DEFAULT_AGENT_MAX_BYTES = 60 * 1024;
const MAX_AGENT_READ_BYTES = 200 * 1024;

async function startAgentTask(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const task = String(options.task || "").trim();
  if (!task) throw new Error("agent_start_task requires a task.");

  const id = makeRunId(`agent-task-${task}`, options.now || new Date());
  const runDir = getAgentRunDir(cwd, id);
  const createdAt = new Date().toISOString();
  const status = {
    id,
    task,
    state: "running",
    createdAt,
    updatedAt: createdAt,
    runDir,
    resultPath: path.join(runDir, "result.md"),
    logPath: path.join(runDir, "agent.log"),
    inboxDir: path.join(cwd, ".chatgpt-native", "inbox", id)
  };

  await ensureDir(runDir);
  await fs.writeFile(path.join(runDir, "task.md"), `${task}\n`, "utf8");
  await writeAgentStatus(cwd, status);
  await appendAgentLog(cwd, id, `started: ${task}`);

  try {
    const resultMarkdown = await buildAgentResult({
      cwd,
      id,
      task,
      includeDiff: options.includeDiff !== false,
      maxBytes: options.maxBytes
    });
    await fs.writeFile(status.resultPath, resultMarkdown, "utf8");
    const reply = await writeAgentReply({ cwd, id, markdown: resultMarkdown });
    const completedAt = new Date().toISOString();
    const completed = {
      ...status,
      state: "completed",
      updatedAt: completedAt,
      completedAt,
      replyPath: reply.replyPath,
      codexReadThisPath: reply.codexReadThisPath
    };
    await writeAgentStatus(cwd, completed);
    await appendAgentLog(cwd, id, "completed and wrote Codex inbox reply");
    return formatAgentReturn(completed);
  } catch (error) {
    const failedAt = new Date().toISOString();
    const failed = {
      ...status,
      state: "failed",
      updatedAt: failedAt,
      failedAt,
      error: error.message
    };
    await writeAgentStatus(cwd, failed);
    await appendAgentLog(cwd, id, `failed: ${error.message}`);
    throw error;
  }
}

async function getAgentStatus(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const id = await resolveAgentId(cwd, options.id || "latest");
  return readAgentStatus(cwd, id);
}

async function readAgentLog(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const id = await resolveAgentId(cwd, options.id || "latest");
  const status = await readAgentStatus(cwd, id);
  const text = await readBoundedText(status.logPath, options.maxBytes);
  return {
    id,
    logPath: status.logPath,
    bytes: Buffer.byteLength(text, "utf8"),
    text
  };
}

async function readAgentResult(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const id = await resolveAgentId(cwd, options.id || "latest");
  const status = await readAgentStatus(cwd, id);
  const text = await readBoundedText(status.resultPath, options.maxBytes);
  return {
    id,
    resultPath: status.resultPath,
    bytes: Buffer.byteLength(text, "utf8"),
    text
  };
}

async function stopAgentTask(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const id = await resolveAgentId(cwd, options.id || "latest");
  const status = await readAgentStatus(cwd, id);
  if (status.state !== "running") {
    return {
      ...formatAgentReturn(status),
      stopped: false,
      reason: `Agent run is ${status.state}, not running.`
    };
  }

  const stoppedAt = new Date().toISOString();
  const stopped = {
    ...status,
    state: "canceled",
    updatedAt: stoppedAt,
    stoppedAt
  };
  await writeAgentStatus(cwd, stopped);
  await appendAgentLog(cwd, id, "canceled");
  return {
    ...formatAgentReturn(stopped),
    stopped: true
  };
}

async function buildAgentResult({ cwd, id, task, includeDiff, maxBytes }) {
  const gitStatus = await getGitStatus(cwd);
  const topFiles = await listTopLevelFiles(cwd);
  const diff = includeDiff ? await getBoundedGitDiff(cwd, maxBytes) : null;
  const diffSection = diff
    ? `## Current Diff\n\nAvailable: ${diff.available ? "yes" : "no"}\n${diff.reason ? `Reason: ${diff.reason}\n` : ""}${diff.truncated ? "Truncated: yes\n" : ""}\n\`\`\`diff\n${diff.text}\n\`\`\`\n`
    : "## Current Diff\n\nSkipped because includeDiff was false.\n";

  return `# Local MCP Agent Result

Run: ${id}

## Task

${task}

## Project

- Root: ${cwd}
- Git status:

\`\`\`text
${gitStatus}
\`\`\`

## Top-Level Files

${topFiles.length ? topFiles.map((file) => `- ${file}`).join("\n") : "- none"}

${diffSection}

## Local Agent Boundary

- Ran inside the local MCP connector process.
- Did not expose arbitrary shell execution.
- Did not edit source files.
- Wrote this result into \`.chatgpt-native/inbox/${id}\` for Codex to continue.

## Codex Next Actions

1. Read this result and decide whether the task needs code edits.
2. Inspect only the relevant files.
3. Make local changes if justified.
4. Run the appropriate tests.
5. Summarize accepted, ignored, and deferred suggestions.
`;
}

async function getBoundedGitDiff(cwd, maxBytes) {
  const diff = await getGitDiff(cwd);
  if (!diff.available) {
    return {
      ...diff,
      bytes: 0,
      truncated: false
    };
  }

  const limit = clampBytes(maxBytes, DEFAULT_AGENT_MAX_BYTES);
  const bytes = Buffer.byteLength(diff.text, "utf8");
  if (bytes <= limit) {
    return {
      ...diff,
      bytes,
      truncated: false
    };
  }

  return {
    ...diff,
    text: diff.text.slice(0, limit),
    bytes,
    truncated: true
  };
}

async function listTopLevelFiles(cwd) {
  let entries;
  try {
    entries = await fs.readdir(cwd, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => ![".git", "node_modules", ".chatgpt-native"].includes(entry.name))
    .slice(0, 40)
    .map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`)
    .sort();
}

async function writeAgentReply({ cwd, id, markdown }) {
  const inboxDir = path.join(cwd, ".chatgpt-native", "inbox", id);
  const replyPath = path.join(inboxDir, "reply.md");
  await ensureDir(inboxDir);
  await fs.writeFile(replyPath, markdown, "utf8");
  const codexReadThisPath = await writeCodexReadThis({ id, inboxDir, replyPath });
  return { replyPath, codexReadThisPath };
}

async function readAgentStatus(cwd, id) {
  const statusPath = getAgentStatusPath(cwd, id);
  try {
    return JSON.parse(await fs.readFile(statusPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Agent run not found: ${id}`);
    throw error;
  }
}

async function writeAgentStatus(cwd, status) {
  const statusPath = getAgentStatusPath(cwd, status.id);
  await ensureDir(path.dirname(statusPath));
  await fs.writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

async function appendAgentLog(cwd, id, line) {
  const logPath = path.join(getAgentRunDir(cwd, id), "agent.log");
  await ensureDir(path.dirname(logPath));
  await fs.appendFile(logPath, `${new Date().toISOString()} ${line}\n`, "utf8");
}

async function resolveAgentId(cwd, id) {
  if (id && id !== "latest") return id;
  const root = getAgentRoot(cwd);
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") throw new Error("No local agent runs found.");
    throw error;
  }
  const ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (!ids.length) throw new Error("No local agent runs found.");
  return ids[ids.length - 1];
}

async function readBoundedText(filePath, maxBytes) {
  if (!(await pathExists(filePath))) throw new Error(`File not found: ${filePath}`);
  const stat = await fs.stat(filePath);
  const limit = clampBytes(maxBytes, MAX_AGENT_READ_BYTES);
  if (stat.size > limit) throw new Error(`File is too large to read safely: ${filePath}`);
  const text = await fs.readFile(filePath, "utf8");
  if (text.includes("\u0000")) throw new Error(`Binary file blocked: ${filePath}`);
  return text;
}

function formatAgentReturn(status) {
  return {
    id: status.id,
    task: status.task,
    state: status.state,
    runDir: status.runDir,
    resultPath: status.resultPath,
    logPath: status.logPath,
    replyPath: status.replyPath || null,
    codexReadThisPath: status.codexReadThisPath || null,
    nextAction:
      status.state === "completed"
        ? "Tell Codex to read the generated inbox reply and continue local implementation/testing."
        : "Use agent_status and agent_read_log to inspect the local run."
  };
}

function getAgentRoot(cwd) {
  return path.join(path.resolve(cwd), ".chatgpt-native", "agent", "runs");
}

function getAgentRunDir(cwd, id) {
  return path.join(getAgentRoot(cwd), id);
}

function getAgentStatusPath(cwd, id) {
  return path.join(getAgentRunDir(cwd, id), "status.json");
}

function clampBytes(value, fallback) {
  if (!value) return fallback;
  return Math.min(Math.max(Number(value), 1), MAX_AGENT_READ_BYTES);
}

module.exports = {
  getAgentStatus,
  readAgentLog,
  readAgentResult,
  startAgentTask,
  stopAgentTask
};
