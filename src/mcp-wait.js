const fs = require("node:fs/promises");
const path = require("node:path");

const { readWebConnectionStatus } = require("./mcp-web");

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
        webConnection: await readWebConnectionStatus({ cwd: root }),
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
  Let ChatGPT finish. It should call create_handoff_report before its final answer.
  Then return to Codex and say: Read the latest Bridge handoff report and review the changes.
`;
  }

  return `No MCP tool call observed within ${result.timeoutSeconds} seconds.

This means ChatGPT may be selected in the UI, but it has not actually used the connector in this chat yet.

Audit log:
  ${result.auditPath}

Important:
  ChatGPT must use the latest Server URL while the tunnel command stays open.
${formatWaitConnection(result.webConnection)}
  If this URL is missing, stale, or different from the ChatGPT app settings, recreate or refresh the app.

In ChatGPT, select chatgpt-native-bridge and send:
  Use chatgpt-native-bridge to open the current connected project.
  First call open_workspace.
  Read, edit, write, and run checks as needed.
  Then call show_changes and create_handoff_report.
`;
}

function formatWaitConnection(connection) {
  if (!connection) {
    return "  Latest Server URL: none recorded. Run cgn mcp connect --yes --open first.";
  }
  return [
    `  Latest Server URL: ${connection.serverUrl || "unknown"}`,
    `  Created: ${connection.createdAt || "unknown"}`,
    "  Cloudflare quick tunnel URLs are temporary and change after restart."
  ].join("\n");
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
  formatWaitConnection,
  getAuditPath,
  readLatestAuditEventSince,
  waitForMcpCall
};
