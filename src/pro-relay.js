const fs = require("node:fs/promises");
const path = require("node:path");

const { copyToClipboard } = require("./clipboard");
const { ensureDir } = require("./fs-utils");
const { getGitDiff, getGitStatus } = require("./git");
const { makeRunId } = require("./id");
const { importReply } = require("./import-reply");
const { inspectCandidate } = require("./secret-guard");

const PRO_REPLY_START = "CGN_BRIDGE_REPLY";
const PRO_REPLY_END = "CGN_BRIDGE_REPLY_END";
const DEFAULT_PRO_MAX_BYTES = 80 * 1024;

async function createProPack(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const task = String(options.task || "Review this project and produce a deep implementation plan.").trim();
  const id = options.id || makeRunId(`pro-pack-${task}`, options.now || new Date());
  const runDir = getProPackDir(cwd, id);
  const promptPath = path.join(runDir, "prompt.md");
  const statePath = path.join(runDir, "state.json");
  const createdAt = new Date().toISOString();

  const prompt = await buildProPrompt({
    cwd,
    id,
    task,
    includeDiff: options.includeDiff !== false,
    maxBytes: options.maxBytes
  });

  const state = {
    id,
    task,
    state: "prompt-ready",
    createdAt,
    updatedAt: createdAt,
    runDir,
    promptPath,
    replyPath: path.join(cwd, ".chatgpt-native", "inbox", id, "reply.md"),
    codexReadThisPath: path.join(cwd, ".chatgpt-native", "inbox", id, "CODEX_READ_THIS.md")
  };

  await ensureDir(runDir);
  await fs.writeFile(promptPath, prompt, "utf8");
  await writeProRelayState(cwd, state);

  let copied = false;
  if (options.copy !== false) {
    const copyImpl = options.copyToClipboardImpl || copyToClipboard;
    copyImpl(prompt);
    copied = true;
  }

  return { ...state, prompt, copied, statePath };
}

async function buildProPrompt(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const id = options.id || makeRunId("pro-pack", options.now || new Date());
  const task = String(options.task || "Review this project and produce a deep implementation plan.").trim();
  const gitStatus = await getGitStatus(cwd);
  const topFiles = await listTopLevelFiles(cwd);
  const diff = options.includeDiff === false ? null : await getBoundedDiff(cwd, options.maxBytes);

  return `# GPT-5.5 Pro Planning Pack

You are GPT-5.5 Pro. Use the local project context below to produce a deep planning and review answer for Codex.

Important boundaries:
- You do not need MCP, Apps, browser automation, or API calls for this step.
- Do not ask the user to run commands unless the missing fact is essential.
- Do not invent file contents not shown here.
- Focus on decisions, risks, implementation order, and what Codex should do next.

When you answer, use this exact wrapper so chatgpt-native-bridge can import your reply:

\`\`\`text
${PRO_REPLY_START} v1 id=${id}
<your Markdown advice for Codex>
${PRO_REPLY_END}
\`\`\`

## Task

${task}

## Project

- Root: ${cwd}
- Relay id: ${id}

## Git Status

\`\`\`text
${gitStatus}
\`\`\`

## Top-Level Files

${topFiles.length ? topFiles.map((file) => `- ${file}`).join("\n") : "- none"}

${formatDiffSection(diff)}

## What Codex Needs Back

Return concise Markdown for Codex with:
- Findings or decisions that matter.
- Concrete implementation steps.
- Files or modules Codex should inspect first.
- Tests or checks Codex should run.
- Risks, rejected ideas, and assumptions.

Start your response with \`${PRO_REPLY_START} v1 id=${id}\` and end with \`${PRO_REPLY_END}\`.
`;
}

function parseProReply(text, expectedId) {
  const raw = String(text || "");
  if (!raw.trim()) {
    return { ok: false, reason: "empty reply" };
  }

  const pattern = new RegExp(
    `${PRO_REPLY_START}\\s+v1\\s+id=([^\\s]+)\\s*\\n([\\s\\S]*?)\\n?${PRO_REPLY_END}`,
    "m"
  );
  const match = raw.match(pattern);
  if (!match) {
    return { ok: false, reason: "reply markers not found" };
  }

  const id = match[1].trim();
  if (expectedId && id !== expectedId) {
    return { ok: false, reason: `reply id mismatch: expected ${expectedId}, got ${id}`, id };
  }

  const markdown = match[2].trim();
  if (!markdown) {
    return { ok: false, reason: "reply body is empty", id };
  }

  return { ok: true, id, markdown };
}

async function importProReply(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const parsed = parseProReply(options.text, options.id);
  if (!parsed.ok) throw new Error(parsed.reason);

  const markdown = `# GPT-5.5 Pro Reply

Relay id: ${parsed.id}

${parsed.markdown}
`;
  const result = await importReply({
    cwd,
    id: parsed.id,
    text: markdown,
    allowNewRun: true
  });

  const state = {
    ...(await readProRelayState(cwd, parsed.id).catch(() => ({ id: parsed.id }))),
    id: parsed.id,
    state: "imported",
    updatedAt: new Date().toISOString(),
    replyPath: result.replyPath,
    codexReadThisPath: result.codexReadThisPath
  };
  await writeProRelayState(cwd, state);

  return { ...result, id: parsed.id, markdown };
}

async function getLatestProRelayState(cwd = process.cwd()) {
  const latestPath = getProRelayLatestPath(cwd);
  try {
    const latest = JSON.parse(await fs.readFile(latestPath, "utf8"));
    return readProRelayState(cwd, latest.id);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const root = getProRelayRoot(cwd);
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    if (!ids.length) return null;
    return readProRelayState(cwd, ids[ids.length - 1]);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readProRelayState(cwd, id) {
  const statePath = path.join(getProPackDir(cwd, id), "state.json");
  return JSON.parse(await fs.readFile(statePath, "utf8"));
}

async function writeProRelayState(cwd, state) {
  const runDir = getProPackDir(cwd, state.id);
  const statePath = path.join(runDir, "state.json");
  await ensureDir(runDir);
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await ensureDir(path.dirname(getProRelayLatestPath(cwd)));
  await fs.writeFile(getProRelayLatestPath(cwd), `${JSON.stringify({ id: state.id }, null, 2)}\n`, "utf8");
  return statePath;
}

async function getBoundedDiff(cwd, maxBytes) {
  const diff = await getGitDiff(cwd);
  if (!diff.available) return { ...diff, bytes: 0, truncated: false };

  const inspection = inspectCandidate({ relativePath: "git.diff", content: diff.text });
  if (inspection.blocked) {
    return {
      available: false,
      reason: `Diff omitted: ${inspection.reason}`,
      text: "",
      bytes: 0,
      truncated: false
    };
  }

  const limit = clampBytes(maxBytes, DEFAULT_PRO_MAX_BYTES);
  const bytes = Buffer.byteLength(diff.text, "utf8");
  if (bytes <= limit) return { ...diff, bytes, truncated: false };
  return {
    ...diff,
    text: diff.text.slice(0, limit),
    bytes,
    truncated: true
  };
}

function formatDiffSection(diff) {
  if (!diff) return "## Current Diff\n\nSkipped.\n";
  if (!diff.available) return `## Current Diff\n\nUnavailable. ${diff.reason || ""}\n`;
  return `## Current Diff

Bytes: ${diff.bytes}
Truncated: ${diff.truncated ? "yes" : "no"}

\`\`\`diff
${diff.text}
\`\`\`
`;
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
    .slice(0, 60)
    .map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`)
    .sort();
}

function getProRelayRoot(cwd) {
  return path.join(path.resolve(cwd), ".chatgpt-native", "pro-packs");
}

function getProPackDir(cwd, id) {
  return path.join(getProRelayRoot(cwd), id);
}

function getProRelayLatestPath(cwd) {
  return path.join(getProRelayRoot(cwd), "latest.json");
}

function clampBytes(value, fallback) {
  const number = Number(value || fallback);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.max(Math.floor(number), 1024), 300 * 1024);
}

module.exports = {
  DEFAULT_PRO_MAX_BYTES,
  PRO_REPLY_END,
  PRO_REPLY_START,
  buildProPrompt,
  createProPack,
  getLatestProRelayState,
  getProPackDir,
  getProRelayLatestPath,
  getProRelayRoot,
  importProReply,
  parseProReply,
  readProRelayState,
  writeProRelayState
};
