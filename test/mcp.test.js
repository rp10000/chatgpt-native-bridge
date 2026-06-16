const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const { initProject } = require("../src/init");
const { getMcpTrace } = require("../src/mcp-trace");
const { TOOL_NAMES, createMcpToolRegistry, runMcpTool } = require("../src/mcp-tools");
const { startMcpHttpServer } = require("../src/mcp-server");

test("MCP tool list is the stable minimum bridge surface", () => {
  assert.deepEqual(TOOL_NAMES, [
    "review_current_project",
    "bridge_status",
    "create_handoff",
    "list_handoff_files",
    "read_handoff_file",
    "read_repo_file",
    "read_git_diff",
    "agent_start_task",
    "agent_status",
    "agent_read_log",
    "agent_read_result",
    "agent_stop",
    "submit_reply_to_codex",
    "write_to_codex"
  ]);
});

test("MCP tool descriptions guide the automatic ChatGPT loop", () => {
  const tools = createMcpToolRegistry({ cwd: process.cwd() });
  const reviewProject = tools.find((tool) => tool.name === "review_current_project");
  const bridgeStatus = tools.find((tool) => tool.name === "bridge_status");
  const readDiff = tools.find((tool) => tool.name === "read_git_diff");
  const agentStart = tools.find((tool) => tool.name === "agent_start_task");
  const submitReply = tools.find((tool) => tool.name === "submit_reply_to_codex");
  const writeToCodex = tools.find((tool) => tool.name === "write_to_codex");

  assert.match(reviewProject.config.description, /Call this automatically/);
  assert.deepEqual(reviewProject.config.securitySchemes, [{ type: "noauth" }]);
  assert.deepEqual(reviewProject.config._meta.securitySchemes, [{ type: "noauth" }]);
  assert.ok(reviewProject.config.outputSchema);
  assert.match(reviewProject.config._meta["openai/toolInvocation/invoking"], /Reviewing/);
  assert.match(bridgeStatus.config.description, /prefer review_current_project/);
  assert.match(readDiff.config.description, /Call this after bridge_status/);
  assert.match(agentStart.config.description, /local MCP coding-agent/);
  assert.match(submitReply.config.description, /call this automatically before your final answer/);
  assert.match(writeToCodex.config.description, /Alias for submit_reply_to_codex/);
});

test("all MCP tools declare noauth for ChatGPT app discovery", () => {
  const tools = createMcpToolRegistry({ cwd: process.cwd() });

  for (const tool of tools) {
    assert.deepEqual(tool.config.securitySchemes, [{ type: "noauth" }], tool.name);
    assert.deepEqual(tool.config._meta.securitySchemes, [{ type: "noauth" }], tool.name);
    assert.ok(tool.config.outputSchema, tool.name);
  }
});

test("review_current_project returns bounded project status and next action", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-review-"));
  await initProject({ cwd });

  const review = await runMcpTool(
    "review_current_project",
    {
      task: "Review the current project",
      includeDiff: true,
      maxBytes: 1024
    },
    { cwd }
  );

  assert.equal(review.cwd, cwd);
  assert.equal(review.task, "Review the current project");
  assert.equal(review.diff.available, false);
  assert.match(review.nextAction, /submit_reply_to_codex/);
});

test("read_repo_file blocks traversal and sensitive local files", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-safe-"));
  await fs.mkdir(path.join(cwd, "src"), { recursive: true });
  await fs.mkdir(path.join(cwd, ".git"), { recursive: true });
  await fs.writeFile(path.join(cwd, "src", "app.js"), "export const name = 'bridge';\n");
  await fs.writeFile(path.join(cwd, ".env"), "OPENAI_API_KEY=dummy-test-key\n");
  await fs.writeFile(path.join(cwd, ".git", "config"), "[core]\nrepositoryformatversion = 0\n");

  const safe = await runMcpTool("read_repo_file", { path: "src/app.js" }, { cwd });
  assert.equal(safe.path, "src/app.js");
  assert.match(safe.text, /bridge/);

  await assert.rejects(
    () => runMcpTool("read_repo_file", { path: "../outside.txt" }, { cwd }),
    /Path traversal/
  );
  await assert.rejects(() => runMcpTool("read_repo_file", { path: ".env" }, { cwd }), /Blocked/);
  await assert.rejects(() => runMcpTool("read_repo_file", { path: ".git/config" }, { cwd }), /Blocked \.git/);
});

test("MCP tools create a handoff and submit a reply for Codex", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-loop-"));
  await fs.mkdir(path.join(cwd, "src"), { recursive: true });
  await fs.writeFile(path.join(cwd, "src", "app.js"), "export const route = '/pricing';\n");
  await initProject({ cwd });

  const handoff = await runMcpTool(
    "create_handoff",
    {
      task: "Review pricing page copy",
      types: ["plan", "naming-copy"],
      includeFiles: ["src/app.js"]
    },
    { cwd }
  );
  assert.match(handoff.id, /review-pricing-page-copy/);
  assert.match(handoff.pastePromptPath, /01_PASTE_TO_CHATGPT\.md/);

  const listed = await runMcpTool("list_handoff_files", { id: handoff.id }, { cwd });
  assert.ok(listed.files.some((file) => file.path === "01_PASTE_TO_CHATGPT.md"));
  assert.ok(listed.files.some((file) => file.path === "context.md"));

  const context = await runMcpTool(
    "read_handoff_file",
    { id: handoff.id, file: "context.md" },
    { cwd }
  );
  assert.match(context.text, /Review pricing page copy/);
  assert.match(context.text, /src\/app\.js/);

  const reply = await runMcpTool(
    "submit_reply_to_codex",
    {
      id: handoff.id,
      markdown: "## Codex next actions\n- Tighten the headline.\n"
    },
    { cwd }
  );
  assert.equal(reply.id, handoff.id);
  assert.equal(
    await fs.readFile(path.join(cwd, ".chatgpt-native", "inbox", handoff.id, "reply.md"), "utf8"),
    "## Codex next actions\n- Tighten the headline.\n"
  );
  assert.equal(await exists(reply.codexReadThisPath), true);
});

test("MCP writeback works without a prior handoff", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-direct-write-"));
  await initProject({ cwd });

  const listed = await runMcpTool("list_handoff_files", { id: "latest" }, { cwd });
  assert.equal(listed.available, false);
  assert.match(listed.nextAction, /review_current_project/);

  const reply = await runMcpTool(
    "write_to_codex",
    {
      markdown: "## Codex next actions\n- Continue from MCP review.\n"
    },
    { cwd }
  );

  assert.match(reply.id, /mcp-reply/);
  assert.equal(
    await fs.readFile(path.join(cwd, ".chatgpt-native", "inbox", reply.id, "reply.md"), "utf8"),
    "## Codex next actions\n- Continue from MCP review.\n"
  );
  assert.equal(await exists(reply.codexReadThisPath), true);
});

test("MCP local agent creates a run and writes Codex inbox result", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-agent-"));
  await fs.writeFile(path.join(cwd, "README.md"), "# Demo\n");
  await initProject({ cwd });

  const started = await runMcpTool(
    "agent_start_task",
    {
      task: "Review current project through the local MCP agent",
      includeDiff: true,
      maxBytes: 1024
    },
    { cwd }
  );

  assert.equal(started.state, "completed");
  assert.match(started.id, /agent-task-review-current-project/);
  assert.equal(await exists(started.resultPath), true);
  assert.equal(await exists(started.replyPath), true);
  assert.equal(await exists(started.codexReadThisPath), true);

  const status = await runMcpTool("agent_status", { id: started.id }, { cwd });
  assert.equal(status.state, "completed");
  assert.equal(status.id, started.id);

  const log = await runMcpTool("agent_read_log", { id: started.id }, { cwd });
  assert.match(log.text, /started:/);
  assert.match(log.text, /completed/);

  const result = await runMcpTool("agent_read_result", { id: started.id }, { cwd });
  assert.match(result.text, /Local MCP Agent Result/);
  assert.match(result.text, /Codex Next Actions/);
});

test("HTTP MCP server can initialize and list bridge tools", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-http-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0 });
  const client = new Client({ name: "cgn-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(server.url));

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name),
      TOOL_NAMES
    );
    assert.ok(tools.tools.every((tool) => tool.outputSchema));
  } finally {
    await transport.close();
    await server.close();
  }
});

test("HTTP MCP raw tools list includes ChatGPT app descriptor metadata", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-http-raw-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0 });

  try {
    const listed = await rawListMcpTools(server.url);
    assert.ok(listed.tools.every((tool) => tool.securitySchemes));
    assert.ok(listed.tools.every((tool) => tool._meta?.securitySchemes));
    assert.ok(listed.tools.every((tool) => tool._meta?.ui?.visibility?.includes("model")));

    const reviewProject = listed.tools.find((tool) => tool.name === "review_current_project");
    assert.deepEqual(reviewProject.securitySchemes, [{ type: "noauth" }]);
    assert.deepEqual(reviewProject._meta.securitySchemes, [{ type: "noauth" }]);
  } finally {
    await server.close();
  }
});

test("HTTP action OpenAPI exposes GPT Actions write-back fallback", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-action-openapi-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0 });

  try {
    const response = await fetch(`${server.healthUrl.replace("/health", "")}/action/openapi.json`);
    assert.equal(response.status, 200);
    const schema = await response.json();
    assert.equal(schema.openapi, "3.0.3");
    assert.equal(schema.info.title, "chatgpt-native-bridge Actions");
    assert.equal(schema.paths["/action/review-current-project"].post.operationId, "review_current_project");
    assert.equal(schema.paths["/action/write-to-codex"].post.operationId, "write_to_codex");
  } finally {
    await server.close();
  }
});

test("HTTP action write-to-codex writes a Codex inbox reply", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-action-write-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0 });
  const baseUrl = server.healthUrl.replace("/health", "");

  try {
    const response = await fetch(`${baseUrl}/action/write-to-codex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        markdown: "## Codex next actions\n- Continue through GPT Actions fallback.\n"
      })
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.match(result.id, /mcp-reply/);
    assert.equal(
      await fs.readFile(path.join(cwd, ".chatgpt-native", "inbox", result.id, "reply.md"), "utf8"),
      "## Codex next actions\n- Continue through GPT Actions fallback.\n"
    );
    assert.equal(await exists(result.codexReadThisPath), true);
  } finally {
    await server.close();
  }
});

test("HTTP MCP server writes request trace events", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-trace-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0 });
  const client = new Client({ name: "cgn-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(server.url));

  try {
    await client.connect(transport);
    await client.listTools();
    const trace = await waitForTraceMethod(cwd, "tools/list");
    assert.ok(trace.requests.some((event) => event.rpcMethod === "initialize"));
    assert.ok(trace.requests.some((event) => event.rpcMethod === "tools/list"));
  } finally {
    await transport.close();
    await server.close();
  }
});

test("HTTP MCP server allows ChatGPT preflight protocol headers", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-cors-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0 });

  try {
    const response = await fetch(server.url, {
      method: "OPTIONS",
      headers: {
        origin: "https://chatgpt.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,mcp-session-id,mcp-protocol-version"
      }
    });

    assert.equal(response.status, 204);
    assert.match(response.headers.get("access-control-allow-headers") || "", /mcp-protocol-version/);
  } finally {
    await server.close();
  }
});

test("HTTP MCP server supports session GET SSE stream", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-sse-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0 });

  try {
    const initResponse = await fetch(server.url, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "cgn-test", version: "0.0.0" }
        }
      })
    });
    assert.equal(initResponse.status, 200);
    const sessionId = initResponse.headers.get("mcp-session-id");
    assert.ok(sessionId);

    const initializedResponse = await fetch(server.url, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-11-25"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      })
    });
    assert.ok([200, 202].includes(initializedResponse.status));

    const sseResponse = await fetch(server.url, {
      method: "GET",
      headers: {
        accept: "text/event-stream",
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-11-25"
      }
    });

    assert.equal(sseResponse.status, 200);
    assert.match(sseResponse.headers.get("content-type") || "", /text\/event-stream/);
    await sseResponse.body.cancel();
  } finally {
    await server.close();
  }
});

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function waitForTraceMethod(cwd, rpcMethod) {
  const deadline = Date.now() + 2000;
  let trace = await getMcpTrace({ cwd, limit: 20 });

  while (!trace.requests.some((event) => event.rpcMethod === rpcMethod) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    trace = await getMcpTrace({ cwd, limit: 20 });
  }

  return trace;
}

async function rawListMcpTools(url) {
  const initResponse = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-11-25"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "cgn-raw-test", version: "0.0.0" }
      }
    })
  });
  assert.equal(initResponse.status, 200);
  const sessionId = initResponse.headers.get("mcp-session-id");
  assert.ok(sessionId);
  await initResponse.text();

  const listResponse = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": "2025-11-25"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    })
  });
  assert.equal(listResponse.status, 200);
  return (await listResponse.json()).result;
}
