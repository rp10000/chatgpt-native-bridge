const http = require("node:http");
const { randomUUID } = require("node:crypto");

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { isInitializeRequest } = require("@modelcontextprotocol/sdk/types.js");

const { createMcpToolRegistry } = require("./mcp-tools");

function createBridgeMcpServer(options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkg = require("../package.json");
  const server = new McpServer(
    {
      name: "chatgpt-native-bridge",
      version: pkg.version
    },
    {
      instructions:
        "Use these tools to inspect a local Codex project, create bounded ChatGPT handoffs, and submit final Markdown advice back to Codex. Do not request secrets or arbitrary shell execution."
    }
  );

  for (const tool of createMcpToolRegistry({ cwd })) {
    server.registerTool(tool.name, tool.config, async (args) => toMcpResult(await tool.handler(args || {})));
  }

  return server;
}

async function startMcpStdio(options = {}) {
  const server = createBridgeMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return { server, transport };
}

async function startMcpHttpServer(options = {}) {
  const cwd = options.cwd || process.cwd();
  const host = options.host || "127.0.0.1";
  const port = Number(options.port ?? 47832);
  const sessions = new Map();

  const httpServer = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          name: "chatgpt-native-bridge",
          endpoint: "/mcp"
        })
      );
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    if (req.method === "GET") {
      res.writeHead(405, { allow: "POST, DELETE", "content-type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    if (!["POST", "DELETE"].includes(req.method)) {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed." },
          id: null
        })
      );
      return;
    }

    try {
      const sessionId = req.headers["mcp-session-id"];
      const existing = sessionId ? sessions.get(String(sessionId)) : null;

      if (existing) {
        await existing.transport.handleRequest(req, res);
        if (req.method === "DELETE") {
          sessions.delete(String(sessionId));
          await existing.server.close();
        }
        return;
      }

      if (req.method === "DELETE") {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32001, message: "Session not found" },
            id: null
          })
        );
        return;
      }

      const body = await readJsonBody(req);
      if (!isInitializeRequest(body)) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: initialize first" },
            id: null
          })
        );
        return;
      }

      const mcpServer = createBridgeMcpServer({ cwd });
      let transport;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, { transport, server: mcpServer });
        }
      });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
      }
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: error.message || "Internal server error" },
          id: null
        })
      );
    }
  });

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, resolve);
  });
  const address = httpServer.address();
  const boundPort = typeof address === "object" && address ? address.port : port;

  return {
    url: `http://${host}:${boundPort}/mcp`,
    healthUrl: `http://${host}:${boundPort}/health`,
    close: async () => {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
      for (const { transport, server } of sessions.values()) {
        await transport.close();
        await server.close();
      }
      sessions.clear();
    }
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) throw new Error("Missing JSON body.");
  return JSON.parse(text);
}

function setCorsHeaders(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader(
    "access-control-allow-headers",
    "content-type,mcp-session-id,authorization,last-event-id"
  );
  res.setHeader("access-control-expose-headers", "mcp-session-id");
}

function toMcpResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ],
    structuredContent: value
  };
}

module.exports = {
  createBridgeMcpServer,
  startMcpHttpServer,
  startMcpStdio,
  toMcpResult
};
