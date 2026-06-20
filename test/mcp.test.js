const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const { initProject } = require("../src/init");
const {
  CHATGPT_CARD_MIME_TYPE,
  CHATGPT_CARD_RESOURCE_URI,
  buildCardV2,
  downgradeCardV2,
  readCardWidgetHtml
} = require("../src/chatgpt-card");
const { getMcpTrace } = require("../src/mcp-trace");
const { TOOL_NAMES, createMcpToolRegistry, runMcpTool } = require("../src/mcp-tools");
const { startMcpHttpServer } = require("../src/mcp-server");
const { getProjectIdentity } = require("../src/project-identity");
const pkg = require("../package.json");

test("MCP tool list is the stable minimum bridge surface", () => {
  assert.deepEqual(TOOL_NAMES, [
    "review_current_project",
    "bridge_card_test",
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
    "create_handoff_report",
    "submit_reply_to_codex",
    "write_to_codex",
    "list_workspaces",
    "open_workspace",
    "workspace_status",
    "search_workspace",
    "list_directory",
    "read_project_instructions",
    "command_history",
    "read",
    "write",
    "edit",
    "bash",
    "show_changes"
  ]);
});

test("MCP tool descriptions guide the automatic ChatGPT loop", () => {
  const tools = createMcpToolRegistry({ cwd: process.cwd() });
  const reviewProject = tools.find((tool) => tool.name === "review_current_project");
  const bridgeStatus = tools.find((tool) => tool.name === "bridge_status");
  const readDiff = tools.find((tool) => tool.name === "read_git_diff");
  const agentStart = tools.find((tool) => tool.name === "agent_start_task");
  const handoffReport = tools.find((tool) => tool.name === "create_handoff_report");
  const submitReply = tools.find((tool) => tool.name === "submit_reply_to_codex");
  const writeToCodex = tools.find((tool) => tool.name === "write_to_codex");

  assert.match(reviewProject.config.description, /Call this automatically/);
  assert.deepEqual(reviewProject.config.securitySchemes, [{ type: "noauth" }]);
  assert.deepEqual(reviewProject.config._meta.securitySchemes, [{ type: "noauth" }]);
  assert.ok(reviewProject.config.outputSchema);
  assert.match(reviewProject.config._meta["openai/toolInvocation/invoking"], /Reviewing/);
  assert.match(bridgeStatus.config.description, /prefer open_workspace/);
  assert.match(readDiff.config.description, /Call this after bridge_status/);
  assert.match(agentStart.config.description, /local MCP coding-agent/);
  assert.match(handoffReport.config.description, /handoff report for Codex review/);
  assert.match(submitReply.config.description, /Compatibility alias for create_handoff_report/);
  assert.match(writeToCodex.config.description, /Compatibility alias for create_handoff_report/);
});

test("MCP simple tool mode keeps the ChatGPT workspace surface short", () => {
  const tools = createMcpToolRegistry({ cwd: process.cwd(), toolMode: "simple" });
  const names = tools.map((tool) => tool.name);

  assert.deepEqual(names, [
    "review_current_project",
    "bridge_card_test",
    "create_handoff_report",
    "open_workspace",
    "workspace_status",
    "search_workspace",
    "list_directory",
    "read_project_instructions",
    "read",
    "write",
    "edit",
    "bash",
    "show_changes"
  ]);
  assert.ok(!names.includes("agent_start_task"));
  assert.ok(!names.includes("create_handoff"));
});

test("all MCP tools declare noauth for ChatGPT app discovery", () => {
  const tools = createMcpToolRegistry({ cwd: process.cwd() });

  for (const tool of tools) {
    assert.deepEqual(tool.config.securitySchemes, [{ type: "noauth" }], tool.name);
    assert.deepEqual(tool.config._meta.securitySchemes, [{ type: "noauth" }], tool.name);
    assert.ok(tool.config.outputSchema, tool.name);
  }
});

test("ChatGPT card tools declare app UI metadata", () => {
  const tools = createMcpToolRegistry({ cwd: process.cwd() });
  const cardTools = [
    "bridge_card_test",
    "open_workspace",
    "read_project_instructions",
    "list_directory",
    "search_workspace",
    "read",
    "write",
    "edit",
    "bash",
    "command_history",
    "show_changes",
    "create_handoff_report",
    "submit_reply_to_codex",
    "write_to_codex"
  ];

  for (const name of cardTools) {
    const tool = tools.find((item) => item.name === name);
    assert.equal(tool.config._meta.ui.resourceUri, CHATGPT_CARD_RESOURCE_URI, name);
    assert.equal(tool.config._meta["ui/resourceUri"], CHATGPT_CARD_RESOURCE_URI, name);
    assert.equal(tool.config._meta["openai/outputTemplate"], CHATGPT_CARD_RESOURCE_URI, name);
  }

  const bridgeStatus = tools.find((item) => item.name === "bridge_status");
  assert.equal(bridgeStatus.config._meta?.["openai/outputTemplate"], undefined);
});

test("ChatGPT cards expose cardV2 and compatibility card summaries", () => {
  const cwd = path.join("D:", "project", "demo-app");
  const card = buildCardV2("bash", {
    command: "npm test",
    exitCode: 0,
    durationMs: 1280,
    stdoutPreview: "tests passed",
    stderrPreview: "",
    shellMode: "trusted"
  }, { command: "npm test" }, { cwd });
  const legacy = downgradeCardV2(card);

  assert.equal(card.version, 2);
  assert.equal(card.kind, "command");
  assert.equal(card.project.name, "demo-app");
  assert.equal(card.status, "ok");
  assert.ok(card.metrics.some((metric) => metric.label === "Exit" && metric.value === "0"));
  assert.ok(card.sections.some((section) => section.title === "Output" && section.items[0].includes("tests passed")));
  assert.equal(card.nextAction, "Review the command output, then call show_changes when the task is complete.");
  assert.equal(legacy.kind, "command");
  assert.equal(legacy.command, "npm test");
  assert.match(legacy.summary, /Command finished/);
});

test("bridge_card_test returns a deterministic ChatGPT card payload", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-card-test-"));
  await initProject({ cwd });

  const result = await runMcpTool("bridge_card_test", {}, { cwd });

  assert.equal(result.ok, true);
  assert.equal(result.bridge_tool, "bridge_card_test");
  assert.equal(result.bridge_title, "Bridge card test");
  assert.equal(result.cardV2.kind, "diagnostic");
  assert.equal(result.cardV2.status, "ok");
  assert.match(result.cardV2.summary, /receiving real tool data/i);
  assert.ok(result.cardV2.sections.some((section) => section.title === "Next"));
});

test("MCP workspace tools return cardV2 for ChatGPT web cards", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-cardv2-"));
  await fs.mkdir(path.join(cwd, "src"), { recursive: true });
  await fs.writeFile(path.join(cwd, "AGENTS.md"), "Use tests.\n", "utf8");
  await fs.writeFile(path.join(cwd, "src", "app.js"), "console.log('bridge');\n", "utf8");
  await initProject({ cwd });

  const opened = await runMcpTool("open_workspace", {}, { cwd });
  const workspaceId = opened.workspaceId;
  assert.equal(opened.cardV2.kind, "workspace");
  assert.ok(opened.cardV2.metrics.some((metric) => metric.label === "Git"));

  const instructions = await runMcpTool("read_project_instructions", { workspaceId }, { cwd });
  assert.equal(instructions.cardV2.kind, "file");
  assert.ok(instructions.cardV2.sections.some((section) => section.title === "Files"));

  const listed = await runMcpTool("list_directory", { workspaceId, path: "." }, { cwd });
  assert.equal(listed.cardV2.kind, "file");
  assert.ok(listed.cardV2.metrics.some((metric) => metric.label === "Entries"));

  const search = await runMcpTool("search_workspace", { workspaceId, query: "bridge" }, { cwd });
  assert.equal(search.cardV2.kind, "search");
  assert.ok(search.cardV2.metrics.some((metric) => metric.label === "Matches"));

  const read = await runMcpTool("read", { workspaceId, path: "src/app.js" }, { cwd });
  assert.equal(read.cardV2.kind, "file");
  assert.ok(read.cardV2.sections.some((section) => section.title === "Read"));

  const history = await runMcpTool("command_history", { workspaceId }, { cwd });
  assert.equal(history.cardV2.kind, "command");
  assert.ok(history.cardV2.sections.some((section) => section.title === "Recent Commands"));
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
  assert.match(review.nextAction, /open_workspace/);
  assert.match(review.nextAction, /create_handoff_report/);
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

  await fs.writeFile(path.join(cwd, "src", "large.js"), `${"x".repeat(200)}\n`);
  const large = await runMcpTool("read_repo_file", { path: "src/large.js", maxBytes: 32 }, { cwd });
  assert.equal(large.path, "src/large.js");
  assert.equal(large.truncated, true);
  assert.equal(large.bytes, 32);
  assert.equal(large.totalBytes, 201);
  assert.equal(Buffer.byteLength(large.text, "utf8"), 32);

  await assert.rejects(
    () => runMcpTool("read_repo_file", { path: "../outside.txt" }, { cwd }),
    /Path traversal/
  );
  await assert.rejects(() => runMcpTool("read_repo_file", { path: ".env" }, { cwd }), /Blocked/);
  await assert.rejects(() => runMcpTool("read_repo_file", { path: ".git/config" }, { cwd }), /Blocked \.git/);
});

test("MCP tools create a handoff and a Codex review report", async () => {
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
    "create_handoff_report",
    {
      task: "Review pricing page copy",
      markdown: "## Codex next actions\n- Tighten the headline.\n"
    },
    { cwd }
  );
  assert.match(reply.id, /handoff-report/);
  assert.equal(await exists(reply.reportPath), true);
  const report = await fs.readFile(reply.replyPath, "utf8");
  assert.match(report, /ChatGPT Native Bridge Handoff Report/);
  assert.match(report, /## What ChatGPT Actually Did/);
  assert.match(report, /## Modified Files/);
  assert.match(report, /## Test Results/);
  assert.match(report, /## Risks and Remaining Work/);
  assert.match(report, /## Suggested Commit Message/);
  assert.match(report, /Tighten the headline/);
  assert.match(report, /No shell commands were recorded/);
  assert.match(reply.cardV2.summary, /handoff report is ready/i);
  assert.ok(reply.cardV2.metrics.some((metric) => metric.label === "Commands"));
  assert.ok(reply.cardV2.sections.some((section) => section.title === "Codex Review"));
  assert.equal(await exists(reply.codexReadThisPath), true);
  const codexPrompt = await fs.readFile(reply.codexReadThisPath, "utf8");
  assert.match(codexPrompt, /Project root:/);
  assert.equal(codexPrompt.includes(cwd), true);
  assert.match(codexPrompt, /Only use this handoff in a Codex session opened for the project root above/);
  assert.match(codexPrompt, /Read the handoff report/);
  assert.match(codexPrompt, /Inspect the actual diff/);
  assert.match(codexPrompt, /Run relevant tests/);
  const reportMeta = JSON.parse(await fs.readFile(path.join(cwd, ".chatgpt-native", "inbox", reply.id, "report-meta.json"), "utf8"));
  assert.equal(reportMeta.projectRoot, cwd);
  assert.equal(reportMeta.projectFingerprint, reply.projectFingerprint);
});

test("MCP writeback works without a prior handoff", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-direct-write-"));
  await initProject({ cwd });

  const listed = await runMcpTool("list_handoff_files", { id: "latest" }, { cwd });
  assert.equal(listed.available, false);
  assert.match(listed.nextAction, /open_workspace/);
  assert.match(listed.nextAction, /create_handoff_report/);

  const reply = await runMcpTool(
    "write_to_codex",
    {
      markdown: "## Codex next actions\n- Continue from MCP review.\n"
    },
    { cwd }
  );

  assert.match(reply.id, /handoff-report/);
  assert.equal(reply.card.kind, "codex");
  assert.equal(reply.card.status, "ok");
  assert.equal(reply.card.inboxId, reply.id);
  assert.equal(await exists(reply.reportPath), true);
  assert.match(
    await fs.readFile(path.join(cwd, ".chatgpt-native", "inbox", reply.id, "reply.md"), "utf8"),
    /Continue from MCP review/
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

test("HTTP MCP health exposes the current package version", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-health-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0 });
  const identity = getProjectIdentity(cwd);

  try {
    const response = await fetch(server.healthUrl);
    assert.equal(response.status, 200);
    const health = await response.json();
    assert.equal(health.name, "chatgpt-native-bridge");
    assert.equal(health.version, pkg.version);
    assert.equal(health.packageVersion, pkg.version);
    assert.equal(health.projectRoot, identity.projectRoot);
    assert.equal(health.projectName, identity.projectName);
    assert.equal(health.projectFingerprint, identity.projectFingerprint);
    assert.equal(health.shellMode, "trusted");
    assert.equal(health.toolMode, "standard");
  } finally {
    await server.close();
  }
});

test("HTTP MCP server honors configured tool and shell modes", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-modes-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0, toolMode: "simple", shellMode: "safe" });
  const client = new Client({ name: "cgn-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(server.url));

  try {
    const healthResponse = await fetch(server.healthUrl);
    const health = await healthResponse.json();
    assert.equal(health.shellMode, "safe");
    assert.equal(health.toolMode, "simple");

    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "open_workspace"));
    assert.ok(!tools.tools.some((tool) => tool.name === "agent_start_task"));
  } finally {
    await transport.close();
    await server.close();
  }
});

test("project fingerprints differ by project root", async () => {
  const one = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-fingerprint-one-"));
  const two = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-fingerprint-two-"));

  assert.notEqual(getProjectIdentity(one).projectFingerprint, getProjectIdentity(two).projectFingerprint);
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

    const bash = listed.tools.find((tool) => tool.name === "bash");
    assert.equal(bash._meta.ui.resourceUri, CHATGPT_CARD_RESOURCE_URI);
    assert.equal(bash._meta["openai/outputTemplate"], CHATGPT_CARD_RESOURCE_URI);
  } finally {
    await server.close();
  }
});

test("HTTP MCP exposes the ChatGPT card UI resource", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-resource-"));
  await initProject({ cwd });
  const server = await startMcpHttpServer({ cwd, port: 0 });
  const client = new Client({ name: "cgn-resource-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(server.url));

  try {
    await client.connect(transport);
    const resources = await client.listResources();
    const resource = resources.resources.find((item) => item.uri === CHATGPT_CARD_RESOURCE_URI);
    assert.ok(resource);
    assert.equal(resource.mimeType, CHATGPT_CARD_MIME_TYPE);

    const read = await client.readResource({ uri: CHATGPT_CARD_RESOURCE_URI });
    assert.equal(read.contents[0].mimeType, CHATGPT_CARD_MIME_TYPE);
    assert.match(read.contents[0].text, /ui\/notifications\/tool-result/);
    assert.match(read.contents[0].text, /window\.openai/);
  } finally {
    await transport.close();
    await server.close();
  }
});

test("ChatGPT card widget supports bridge notifications and OpenAI fallback", async () => {
  const html = await readCardWidgetHtml();

  assert.match(html, /ui\/notifications\/tool-result/);
  assert.match(html, /openai:set_globals/);
  assert.match(html, /cardV2/);
  assert.match(html, /renderCardV2/);
  assert.match(html, /extractStructuredContent/);
  assert.match(html, /metrics/);
  assert.match(html, /sections/);
  assert.match(html, /nextAction/);
  assert.match(html, /window\.openai/);
  assert.match(html, /toolOutput/);
  assert.match(html, /toolResponseMetadata/);
  assert.match(html, /bridge_card_test/);
  assert.match(html, /Ask ChatGPT to call/);
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
    assert.match(result.id, /handoff-report/);
    assert.match(
      await fs.readFile(path.join(cwd, ".chatgpt-native", "inbox", result.id, "reply.md"), "utf8"),
      /Continue through GPT Actions fallback/
    );
    assert.equal(await exists(result.reportPath), true);
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
