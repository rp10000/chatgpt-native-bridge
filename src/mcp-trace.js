const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_TRACE_LIMIT = 10;

async function getMcpTrace({ cwd = process.cwd(), limit = DEFAULT_TRACE_LIMIT } = {}) {
  const root = path.resolve(cwd);
  const requestPath = getRequestAuditPath(root);
  const toolPath = getToolAuditPath(root);

  return {
    root,
    requestPath,
    toolPath,
    requests: await readJsonlTail(requestPath, limit),
    toolCalls: (await readJsonlTail(toolPath, limit)).filter((event) => event.toolName)
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

Latest MCP requests:
${formatEvents(trace.requests, formatRequestEvent)}

Latest tool calls:
${formatEvents(trace.toolCalls, formatToolEvent)}

Meaning:
  - No MCP requests: ChatGPT is not reaching this Server URL.
  - Requests but no tool calls: ChatGPT reached the MCP server but did not expose/call tools in that chat.
  - Tool calls present: ChatGPT used the bridge; let it finish, then tell Codex to read the latest reply.
`;
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
  getMcpTrace,
  getRequestAuditPath,
  getToolAuditPath,
  readJsonlTail
};
