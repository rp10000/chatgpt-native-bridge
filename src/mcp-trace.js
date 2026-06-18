const fs = require("node:fs/promises");
const path = require("node:path");

const { readWebConnectionStatus } = require("./mcp-web");

const DEFAULT_TRACE_LIMIT = 10;

async function getMcpTrace({ cwd = process.cwd(), limit = DEFAULT_TRACE_LIMIT } = {}) {
  const root = path.resolve(cwd);
  const requestPath = getRequestAuditPath(root);
  const toolPath = getToolAuditPath(root);
  const requests = await readJsonlTail(requestPath, limit);
  const toolCalls = (await readJsonlTail(toolPath, limit)).filter((event) => event.toolName);
  const latestRequest = requests.at(-1) || null;
  const latestToolCall = toolCalls.at(-1) || null;
  const latestSuccessfulToolCall = [...toolCalls].reverse().find((event) => event.ok !== false) || null;
  const latestFailedToolCall = [...toolCalls].reverse().find((event) => event.ok === false) || null;

  return {
    root,
    requestPath,
    toolPath,
    webConnection: await readWebConnectionStatus({ cwd: root }),
    requests,
    toolCalls,
    requestCount: requests.length,
    toolCallCount: toolCalls.length,
    latestRequest,
    latestToolCall,
    latestSuccessfulToolCall,
    latestFailedToolCall,
    hasHttpAccess: Boolean(latestRequest),
    hasToolsCallRequest: requests.some((event) => event.rpcMethod === "tools/call"),
    lastError: latestFailedToolCall ? latestFailedToolCall.error || "Tool call failed" : ""
  };
}

function formatMcpTrace(trace) {
  return `chatgpt-native-bridge MCP trace

Root:
  ${trace.root}

Request log:
  ${trace.requestPath}

Tool-call log:
  ${trace.toolPath}

Latest ChatGPT Server URL:
${formatWebConnection(trace.webConnection)}

Latest MCP requests:
${formatEvents(trace.requests, formatRequestEvent)}

Latest tool calls:
${formatEvents(trace.toolCalls, formatToolEvent)}

Meaning:
  - No MCP requests: ChatGPT is not reaching the current Server URL.
    If you use Cloudflare quick tunnel, the URL changes when connect restarts. Recreate or refresh the ChatGPT app with the latest Server URL above.
  - Requests but no tool calls: ChatGPT reached the MCP server but did not expose/call tools in that chat.
    Check Developer Mode, selected app, app metadata refresh, and the exact chat mode.
  - Tool calls present: ChatGPT used the bridge; let it finish, then tell Codex to read the latest reply.
`;
}

function formatWebConnection(connection) {
  if (!connection) {
    return "  none recorded. Run cgn mcp connect --yes --open or cgn mcp tunnel first.";
  }
  const temporary = connection.temporary ? "yes" : "no";
  return [
    `  Server URL: ${connection.serverUrl || "unknown"}`,
    `  Created: ${connection.createdAt || "unknown"}`,
    `  Temporary URL: ${temporary}`,
    "  Important: ChatGPT must use this exact Server URL while the tunnel command stays open."
  ].join("\n");
}

function formatEvents(events, formatter) {
  if (!events.length) return "  none";
  return events.map((event) => `  - ${formatter(event)}`).join("\n");
}

function formatRequestEvent(event) {
  const rpc = event.rpcMethod ? ` ${event.rpcMethod}` : "";
  const status = event.statusCode ? ` -> ${event.statusCode}` : "";
  return `${event.ts} ${event.httpMethod || ""}${rpc}${status}`.trim();
}

function formatToolEvent(event) {
  const status = event.ok === false ? `failed: ${event.error || "unknown error"}` : "ok";
  return `${event.ts} ${event.toolName} ${status}`;
}

async function readJsonlTail(filePath, limit) {
  let text;
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
    .slice(-Math.max(Number(limit) || DEFAULT_TRACE_LIMIT, 1))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getRequestAuditPath(cwd) {
  return path.join(path.resolve(cwd), ".chatgpt-native", "runs", "mcp-requests.jsonl");
}

function getToolAuditPath(cwd) {
  return path.join(path.resolve(cwd), ".chatgpt-native", "runs", "mcp-audit.jsonl");
}

module.exports = {
  DEFAULT_TRACE_LIMIT,
  formatMcpTrace,
  formatWebConnection,
  getMcpTrace,
  getRequestAuditPath,
  getToolAuditPath,
  readJsonlTail
};
