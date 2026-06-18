const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const { buildActionOpenApi, startMcpHttpServer } = require("../src/mcp-server");
const { createMcpToolRegistry, runMcpTool } = require("../src/mcp-tools");

const WORKSPACE_TOOL_NAMES = [
  "list_workspaces",
  "open_workspace",
  "search_workspace",
  "list_directory",
  "read_project_instructions",
  "command_history",
  "read",
  "write",
  "edit",
  "bash",
  "show_changes",
  "workspace_status"
];

test("MCP registry includes workspace tools and keeps write_to_codex", () => {
  const deps = createWorkspaceTestDeps();
  const tools = createMcpToolRegistry({
    cwd: process.cwd(),
    workspaceEngine: deps.workspaceEngine
  });
  const names = tools.map((tool) => tool.name);

  for (const name of WORKSPACE_TOOL_NAMES) {
    assert.ok(names.includes(name), name);
    const tool = tools.find((item) => item.name === name);
    assert.deepEqual(tool.config.securitySchemes, [{ type: "noauth" }], name);
    assert.ok(tool.config.outputSchema, name);
  }

  assert.ok(names.includes("write_to_codex"));
});

test("workspace MCP handlers dispatch to the shared workspace engine", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-workspace-"));
  const deps = createWorkspaceTestDeps();
  const options = {
    cwd,
    workspaceEngine: deps.workspaceEngine
  };

  const opened = await runMcpTool("open_workspace", { path: "." }, options);
  assert.equal(opened.workspaceId, "ws-1");
  assert.equal(opened.card.kind, "workspace");
  assert.equal(opened.card.status, "ok");
  assert.deepEqual(deps.calls.at(-1), {
    target: "workspaceEngine.openWorkspace",
    args: { path: "." }
  });

  const read = await runMcpTool("read", { workspaceId: "ws-1", path: "src/app.js" }, options);
  assert.equal(read.text, "console.log('read');\n");

  const listedWorkspaces = await runMcpTool("list_workspaces", {}, options);
  assert.equal(listedWorkspaces.roots.length, 1);

  const directory = await runMcpTool("list_directory", { workspaceId: "ws-1", path: "." }, options);
  assert.deepEqual(directory.entries, [{ path: "src/app.js", type: "file" }]);

  const search = await runMcpTool("search_workspace", { workspaceId: "ws-1", query: "read" }, options);
  assert.equal(search.results[0].path, "src/app.js");

  const instructions = await runMcpTool("read_project_instructions", { workspaceId: "ws-1" }, options);
  assert.deepEqual(instructions.files.map((file) => file.path), ["AGENTS.md"]);

  await runMcpTool("write", { workspaceId: "ws-1", path: "src/app.js", content: "next\n" }, options);
  assert.deepEqual(deps.calls.at(-1), {
    target: "workspaceEngine.write",
    args: { workspaceId: "ws-1", path: "src/app.js", content: "next\n", ifExists: "error" }
  });

  await runMcpTool(
    "edit",
    { workspaceId: "ws-1", path: "src/app.js", oldText: "read", newText: "edited" },
    options
  );
  assert.deepEqual(deps.calls.at(-1), {
    target: "workspaceEngine.edit",
    args: { workspaceId: "ws-1", path: "src/app.js", oldText: "read", newText: "edited" }
  });

  const bash = await runMcpTool("bash", { workspaceId: "ws-1", command: "npm test" }, options);
  assert.equal(bash.stdout, "ok\n");
  assert.equal(bash.card.kind, "command");
  assert.equal(bash.card.command, "npm test");
  assert.deepEqual(deps.calls.at(-1), {
    target: "workspaceEngine.bash",
    args: { workspaceId: "ws-1", command: "npm test" }
  });

  const changes = await runMcpTool("show_changes", { workspaceId: "ws-1" }, options);
  assert.deepEqual(changes.changedFiles, ["src/app.js"]);
  assert.equal(changes.card.kind, "changes");
  assert.deepEqual(changes.card.changedFiles, ["src/app.js"]);
  assert.deepEqual(deps.calls.at(-1), {
    target: "workspaceEngine.showChanges",
    args: { workspaceId: "ws-1" }
  });

  const status = await runMcpTool("workspace_status", {}, options);
  assert.equal(status.workspaceId, "ws-1");
  assert.deepEqual(deps.calls.at(-1), {
    target: "workspaceEngine.status",
    args: {}
  });

  const history = await runMcpTool("command_history", { workspaceId: "ws-1" }, options);
  assert.deepEqual(history.commands, [{ commandRedacted: "npm test", exitCode: 0 }]);
});

test("HTTP MCP reuses injected workspace engine across rebuilt sessions", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-workspace-http-"));
  const deps = createWorkspaceTestDeps();
  const server = await startMcpHttpServer({
    cwd,
    port: 0,
    workspaceEngine: deps.workspaceEngine
  });

  const clientOne = new Client({ name: "cgn-workspace-one", version: "0.0.0" });
  const transportOne = new StreamableHTTPClientTransport(new URL(server.url));
  const clientTwo = new Client({ name: "cgn-workspace-two", version: "0.0.0" });
  const transportTwo = new StreamableHTTPClientTransport(new URL(server.url));

  try {
    await clientOne.connect(transportOne);
    const opened = await clientOne.callTool({ name: "open_workspace", arguments: { path: "." } });
    assert.equal(readToolJson(opened).workspaceId, "ws-1");
    await transportOne.close();

    await clientTwo.connect(transportTwo);
    const status = await clientTwo.callTool({ name: "workspace_status", arguments: {} });
    assert.equal(readToolJson(status).workspaceId, "ws-1");
  } finally {
    await transportTwo.close();
    await server.close();
  }
});

test("workspace MCP write is conservative by default and show_changes includes operations", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-workspace-real-"));
  await fs.writeFile(path.join(cwd, "notes.txt"), "first", "utf8");

  const opened = await runMcpTool("open_workspace", { path: "." }, { cwd });
  const workspaceId = opened.workspaceId;

  await assert.rejects(
    () => runMcpTool("write", { workspaceId, path: "notes.txt", content: "second" }, { cwd }),
    /already exists/i
  );

  const before = await runMcpTool("read", { workspaceId, path: "notes.txt" }, { cwd });
  const written = await runMcpTool(
    "write",
    { workspaceId, path: "notes.txt", content: "second", expectedHash: before.hash },
    { cwd }
  );
  assert.equal(written.written, true);

  const changes = await runMcpTool("show_changes", { workspaceId, includeDiff: false }, { cwd });
  assert.ok(changes.operations.some((operation) => operation.type === "write" && operation.path === "notes.txt"));
});

test("workspace cards redact sensitive-looking command text", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-workspace-card-"));
  const deps = createWorkspaceTestDeps();
  const result = await runMcpTool(
    "bash",
    { workspaceId: "ws-1", command: "echo token secret .env password" },
    { cwd, workspaceEngine: deps.workspaceEngine }
  );

  const cardText = JSON.stringify(result.card);
  assert.equal(result.card.kind, "command");
  assert.doesNotMatch(cardText, /token/i);
  assert.doesNotMatch(cardText, /secret/i);
  assert.doesNotMatch(cardText, /\.env/i);
  assert.doesNotMatch(cardText, /password/i);
});

test("REST action fallback does not expose workspace bash, write, or edit", () => {
  const schema = buildActionOpenApi("http://127.0.0.1:47832");
  const paths = Object.keys(schema.paths);
  const operationIds = Object.values(schema.paths).map((item) => item.post.operationId);

  assert.ok(!paths.includes("/action/bash"));
  assert.ok(!paths.includes("/action/write"));
  assert.ok(!paths.includes("/action/edit"));
  assert.ok(!operationIds.includes("bash"));
  assert.ok(!operationIds.includes("write"));
  assert.ok(!operationIds.includes("edit"));
  assert.ok(operationIds.includes("write_to_codex"));
});

function createWorkspaceTestDeps() {
  const calls = [];
  let currentWorkspaceId = null;

  return {
    calls,
    workspaceEngine: {
      async openWorkspace(args) {
        calls.push({ target: "workspaceEngine.openWorkspace", args });
        currentWorkspaceId = "ws-1";
        return { workspaceId: currentWorkspaceId, root: args.path || args.cwd };
      },
      async listWorkspaces() {
        calls.push({ target: "workspaceEngine.listWorkspaces", args: {} });
        return { roots: [{ root: "repo", workspaceId: "ws-1" }] };
      },
      async search(args) {
        calls.push({ target: "workspaceEngine.search", args });
        return { results: [{ path: "src/app.js", line: 1, preview: "read" }] };
      },
      async listDirectory(args) {
        calls.push({ target: "workspaceEngine.listDirectory", args });
        return { entries: [{ path: "src/app.js", type: "file" }] };
      },
      async projectInstructions(args) {
        calls.push({ target: "workspaceEngine.projectInstructions", args });
        return { files: [{ path: "AGENTS.md", text: "Guide" }] };
      },
      async commandHistory(args) {
        calls.push({ target: "workspaceEngine.commandHistory", args });
        return { commands: [{ commandRedacted: "npm test", exitCode: 0 }] };
      },
      async read(args) {
        calls.push({ target: "workspaceEngine.read", args });
        return { workspaceId: args.workspaceId, path: args.path, text: "console.log('read');\n" };
      },
      async write(args) {
        calls.push({ target: "workspaceEngine.write", args });
        return { workspaceId: args.workspaceId, path: args.path, bytes: Buffer.byteLength(args.content, "utf8") };
      },
      async edit(args) {
        calls.push({ target: "workspaceEngine.edit", args });
        return { workspaceId: args.workspaceId, path: args.path, replaced: 1 };
      },
      async bash(args) {
        calls.push({ target: "workspaceEngine.bash", args });
        return { workspaceId: args.workspaceId, exitCode: 0, stdout: "ok\n", stderr: "" };
      },
      async showChanges(args) {
        calls.push({ target: "workspaceEngine.showChanges", args });
        return { workspaceId: args.workspaceId, changedFiles: ["src/app.js"], diff: "diff --git a/src/app.js b/src/app.js\n" };
      },
      async status(args) {
        calls.push({ target: "workspaceEngine.status", args });
        return { workspaceId: currentWorkspaceId, open: Boolean(currentWorkspaceId) };
      }
    }
  };
}

function readToolJson(result) {
  if (result.structuredContent) return result.structuredContent;
  return JSON.parse(result.content[0].text);
}
