const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const { initProject } = require("../src/init");
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
    "submit_reply_to_codex"
  ]);
});

test("MCP tool descriptions guide the automatic ChatGPT loop", () => {
  const tools = createMcpToolRegistry({ cwd: process.cwd() });
  const reviewProject = tools.find((tool) => tool.name === "review_current_project");
  const bridgeStatus = tools.find((tool) => tool.name === "bridge_status");
  const readDiff = tools.find((tool) => tool.name === "read_git_diff");
  const submitReply = tools.find((tool) => tool.name === "submit_reply_to_codex");

  assert.match(reviewProject.config.description, /Call this automatically/);
  assert.match(reviewProject.config._meta["openai/toolInvocation/invoking"], /Reviewing/);
  assert.match(bridgeStatus.config.description, /prefer review_current_project/);
  assert.match(readDiff.config.description, /Call this after bridge_status/);
  assert.match(submitReply.config.description, /call this automatically before your final answer/);
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
  } finally {
    await transport.close();
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
