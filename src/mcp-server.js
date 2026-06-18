const http = require("node:http");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { isInitializeRequest, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const z = require("zod/v4");

const { createMcpToolRegistry, runMcpTool } = require("./mcp-tools");
const {
  registerChatGptCardResource,
  withChatGptCardToolConfig
} = require("./chatgpt-card");
const { getProjectIdentity } = require("./project-identity");
const { createWorkspaceEngine } = require("./workspace/engine");

function createBridgeMcpServer(options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkg = require("../package.json");
  const workspaceEngine = options.workspaceEngine || createWorkspaceEngine({ cwd });
  const tools = createMcpToolRegistry({
    cwd,
    workspaceEngine
  }).map((tool) => ({
    ...tool,
    config: withChatGptCardToolConfig(tool.name, tool.config)
  }));
  const server = new McpServer(
    {
      name: "chatgpt-native-bridge",
      version: pkg.version
    },
    {
      instructions:
        "Use these tools to inspect and work in a local Codex project, create bounded ChatGPT handoffs, and submit final Markdown advice back to Codex. Do not request secrets; use workspace write, edit, and bash tools only for the active local task."
    }
  );

  registerChatGptCardResource(server);
  for (const tool of tools) {
    server.registerTool(tool.name, tool.config, async (args) => toMcpResult(await tool.handler(args || {})));
  }
  installChatGptToolListHandler(server, tools);

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
  const pkg = require("../package.json");
  const project = getProjectIdentity(cwd);
  const workspaceEngine = options.workspaceEngine || createWorkspaceEngine({ cwd });
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
          version: pkg.version,
          packageVersion: pkg.version,
          projectRoot: project.projectRoot,
          projectName: project.projectName,
          projectFingerprint: project.projectFingerprint,
          endpoint: "/mcp",
          actionOpenApi: "/action/openapi.json"
        })
      );
      return;
    }

    if (url.pathname.startsWith("/action/")) {
      await handleActionRequest({ req, res, url, cwd });
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const requestAudit = {
      eventType: "request",
      httpMethod: req.method,
      path: url.pathname,
      sessionId: summarizeSessionId(req.headers["mcp-session-id"]),
      accept: summarizeHeader(req.headers.accept),
      userAgent: summarizeHeader(req.headers["user-agent"]),
      rpcMethod: null,
      rpcId: null
    };
    res.once("finish", () => {
      appendRequestAudit(cwd, { ...requestAudit, statusCode: res.statusCode });
    });

    if (!["GET", "POST", "DELETE"].includes(req.method)) {
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
      const body = req.method === "POST" ? await readJsonBody(req) : null;
      if (body) {
        requestAudit.rpcMethod = summarizeRpcMethod(body);
        requestAudit.rpcId = summarizeRpcId(body);
      }
      const existing = sessionId ? sessions.get(String(sessionId)) : null;

      if (existing) {
        await existing.transport.handleRequest(req, res, body);
        if (req.method === "DELETE") {
          sessions.delete(String(sessionId));
          await existing.server.close();
        }
        return;
      }

      if (req.method === "GET") {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: valid MCP session id required for SSE stream" },
            id: null
          })
        );
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

      const mcpServer = createBridgeMcpServer({ cwd, workspaceEngine });
      let transport;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, { transport, server: mcpServer });
        },
        onsessionclosed: (closedSessionId) => {
          sessions.delete(String(closedSessionId));
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

async function appendRequestAudit(cwd, event) {
  try {
    const requestAuditPath = path.join(cwd, ".chatgpt-native", "runs", "mcp-requests.jsonl");
    await fs.mkdir(path.dirname(requestAuditPath), { recursive: true });
    await fs.appendFile(requestAuditPath, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`);
  } catch {
    // Request audit logging should never break the MCP server.
  }
}

function summarizeRpcMethod(body) {
  if (Array.isArray(body)) return body.map((item) => item && item.method).filter(Boolean).join(",");
  return body && body.method ? String(body.method) : null;
}

function summarizeRpcId(body) {
  if (Array.isArray(body)) return null;
  if (!body || typeof body.id === "undefined") return null;
  return String(body.id).slice(0, 80);
}

function summarizeHeader(value) {
  if (!value) return null;
  return String(value).slice(0, 160);
}

function summarizeSessionId(value) {
  if (!value) return null;
  return String(value).slice(0, 80);
}

function setCorsHeaders(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader(
    "access-control-allow-headers",
    "accept,content-type,mcp-session-id,mcp-protocol-version,authorization,last-event-id"
  );
  res.setHeader("access-control-expose-headers", "mcp-session-id");
}

async function handleActionRequest({ req, res, url, cwd }) {
  try {
    if (req.method === "GET" && url.pathname === "/action/openapi.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(buildActionOpenApi(getPublicBaseUrl(req)), null, 2));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed." }));
      return;
    }

    const body = await readJsonBody(req);
    const toolName = actionPathToToolName(url.pathname);
    if (!toolName) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Unknown action endpoint." }));
      return;
    }

    const result = await runMcpTool(toolName, body || {}, { cwd });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(result, null, 2));
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
    }
    res.end(JSON.stringify({ error: error.message || "Internal server error" }));
  }
}

function actionPathToToolName(pathname) {
  return {
    "/action/review-current-project": "review_current_project",
    "/action/read-repo-file": "read_repo_file",
    "/action/read-git-diff": "read_git_diff",
    "/action/write-to-codex": "write_to_codex"
  }[pathname];
}

function getPublicBaseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "127.0.0.1:47832";
  const proto = req.headers["x-forwarded-proto"] || (String(host).includes("localhost") || String(host).includes("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

function buildActionOpenApi(baseUrl) {
  return {
    openapi: "3.0.3",
    info: {
      title: "chatgpt-native-bridge Actions",
      version: require("../package.json").version,
      description:
        "Fallback REST actions for ChatGPT Custom GPTs when MCP write tools are unavailable. Reads are bounded; write-back is limited to .chatgpt-native/inbox."
    },
    servers: [{ url: baseUrl }],
    paths: {
      "/action/review-current-project": {
        post: {
          operationId: "review_current_project",
          summary: "Review the current local project",
          description:
            "Call first. Returns project status, git status, a bounded diff, safety notes, and the next write-back step for Codex.",
          requestBody: jsonRequest({
            type: "object",
            properties: {
              task: { type: "string", description: "What the user wants reviewed or planned." },
              includeDiff: { type: "boolean", description: "Include current git diff when safe. Defaults to true." },
              maxBytes: { type: "integer", minimum: 1, description: "Maximum diff bytes to return." }
            }
          }),
          responses: jsonResponses()
        }
      },
      "/action/read-repo-file": {
        post: {
          operationId: "read_repo_file",
          summary: "Read a bounded safe repo file",
          description:
            "Read only relevant non-sensitive files. The server blocks path traversal, .env, keys, cookies, sessions, .git, node_modules, and secret-like content.",
          requestBody: jsonRequest({
            type: "object",
            required: ["path"],
            properties: {
              path: { type: "string", description: "Relative path inside the current project." },
              maxBytes: { type: "integer", minimum: 1, description: "Maximum bytes to read." }
            }
          }),
          responses: jsonResponses()
        }
      },
      "/action/read-git-diff": {
        post: {
          operationId: "read_git_diff",
          summary: "Read the current git diff",
          description: "Read the current git diff with secret-content guarding.",
          requestBody: jsonRequest({
            type: "object",
            properties: {
              maxBytes: { type: "integer", minimum: 1, description: "Maximum bytes to return." }
            }
          }),
          responses: jsonResponses()
        }
      },
      "/action/write-to-codex": {
        post: {
          operationId: "write_to_codex",
          summary: "Write final advice back to Codex",
          description:
            "Call last. Writes ChatGPT's final Markdown advice into the local Codex inbox so Codex can continue local implementation and testing.",
          requestBody: jsonRequest({
            type: "object",
            required: ["markdown"],
            properties: {
              id: { type: "string", description: "Optional run id. Omit to create a new MCP reply run." },
              markdown: { type: "string", description: "Final Markdown advice for Codex." }
            }
          }),
          responses: jsonResponses()
        }
      }
    }
  };
}

function jsonRequest(schema) {
  return {
    required: true,
    content: {
      "application/json": {
        schema
      }
    }
  };
}

function jsonResponses() {
  return {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: { type: "object" }
        }
      }
    }
  };
}

function installChatGptToolListHandler(server, tools) {
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool) => toChatGptToolDescriptor(tool))
  }));
}

function toChatGptToolDescriptor(tool) {
  const securitySchemes = tool.config.securitySchemes || tool.config._meta?.securitySchemes || [{ type: "noauth" }];
  const descriptor = {
    name: tool.name,
    title: tool.config.title,
    description: tool.config.description,
    inputSchema: toJsonObjectSchema(tool.config.inputSchema, "input"),
    outputSchema: toJsonObjectSchema(tool.config.outputSchema, "output"),
    annotations: tool.config.annotations,
    securitySchemes,
    _meta: {
      ...(tool.config._meta || {}),
      securitySchemes,
      ui: {
        ...(tool.config._meta?.ui || {}),
        visibility: tool.config._meta?.ui?.visibility || ["model"]
      },
      "openai/visibility": tool.config._meta?.["openai/visibility"] || "public"
    }
  };

  if (!descriptor.outputSchema) delete descriptor.outputSchema;
  return descriptor;
}

function toJsonObjectSchema(schema, io) {
  const objectSchema = normalizeZodObject(schema);
  if (!objectSchema) {
    return {
      type: "object",
      properties: {}
    };
  }

  const jsonSchema = z.toJSONSchema(objectSchema, { io });
  delete jsonSchema.$schema;
  return jsonSchema;
}

function normalizeZodObject(schema) {
  if (!schema) return null;
  if (isZodSchema(schema)) return schema;
  return z.object(schema);
}

function isZodSchema(value) {
  return Boolean(value && typeof value === "object" && "_zod" in value);
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
  buildActionOpenApi,
  createBridgeMcpServer,
  startMcpHttpServer,
  startMcpStdio,
  toMcpResult
};
