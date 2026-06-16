const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_WAIT_SECONDS = 120;

async function waitForMcpCall({
  cwd = process.cwd(),
  timeoutSeconds = DEFAULT_WAIT_SECONDS,
  pollMs = 1000,
  sleepImpl = sleep
} = {}) {
  const root = path.resolve(cwd);
  const startedMs = Date.now() - 1000;
  const timeoutMs = Math.max(Number(timeoutSeconds) || 0, 0) * 1000;
  const deadline = Date.now() + timeoutMs;
  const auditPath = getAuditPath(root);

  while (true) {
    const event = await readLatestAuditEventSince(root, startedMs);
    if (event) {
      return {
        observed: true,
        auditPath,
        event
      };
    }

    if (Date.now() >= deadline) {
      return {
        observed: false,
        auditPath,
        timeoutSeconds: timeoutMs / 1000
      };
    }

    await sleepImpl(Math.min(pollMs, Math.max(deadline - Date.now(), 0)));
  }
}

async function readLatestAuditEventSince(cwd, sinceMs) {
  const auditPath = getAuditPath(cwd);
  let text;
  try {
    text = await fs.readFile(auditPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    let event;
    try {
      event = JSON.parse(lines[index]);
    } catch {
      continue;
    }
    const eventMs = Date.parse(event.ts);
    if (Number.isNaN(eventMs) || eventMs < sinceMs) continue;
    return event;
  }
  return null;
}

function formatMcpWaitResult(result) {
  if (result.observed) {
    return `ChatGPT used chatgpt-native-bridge.

Tool:
  ${result.event.toolName}

At:
  ${result.event.ts}

Audit log:
  ${result.auditPath}

Next:
  Let ChatGPT finish. It should call submit_reply_to_codex before its final answer.
  Then return to Codex and say: Read the latest ChatGPT reply and continue.
`;
  }

  return `No MCP tool call observed within ${result.timeoutSeconds} seconds.

This means ChatGPT may be selected in the UI, but it has not actually used the connector in this chat yet.

Audit log:
  ${result.auditPath}

Important:
  Full automatic write-back requires ChatGPT full MCP support.
  If ChatGPT says write_to_codex is unavailable, your plan or chat mode may expose only read/fetch actions.
  Use a Business/Enterprise/Edu workspace with full MCP support, or use the Markdown fallback: cgn handoff, then cgn done.

In ChatGPT, select chatgpt-native-bridge and send:
  Use chatgpt-native-bridge to review this project.
  First call review_current_project, read relevant files only if needed,
  then call submit_reply_to_codex with your final advice for Codex.
`;
}

function getAuditPath(cwd) {
  return path.join(path.resolve(cwd), ".chatgpt-native", "runs", "mcp-audit.jsonl");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  DEFAULT_WAIT_SECONDS,
  formatMcpWaitResult,
  getAuditPath,
  readLatestAuditEventSince,
  waitForMcpCall
};
