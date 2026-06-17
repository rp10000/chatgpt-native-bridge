const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  CHATGPT_REVIEW_PROMPT,
  CHATGPT_URL,
  CONTINUE_PROMPT,
  computeBridgeState,
  createDesktopHandlers,
  invokeDesktopHandler
} = require("../src/desktop-ipc");
const { PRO_REPLY_END, PRO_REPLY_START } = require("../src/pro-relay");

test("desktop IPC creates a Pro pack and imports a matching reply", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-ipc-"));
  const clipboard = fakeClipboard();
  const opened = [];
  const handlers = createDesktopHandlers({
    cwd,
    clipboard,
    shell: {
      openExternal(url) {
        opened.push(url);
      }
    }
  });

  const project = await invokeDesktopHandler(handlers, "project:get");
  assert.equal(project.ok, true);
  assert.equal(project.data.cwd, cwd);

  const pack = await invokeDesktopHandler(handlers, "pro:create-pack", {
    task: "Review desktop client",
    includeDiff: false
  });
  assert.equal(pack.ok, true);
  assert.match(pack.data.id, /review-desktop-client/);
  assert.equal(opened[0], CHATGPT_URL);
  assert.match(clipboard.text, new RegExp(`${PRO_REPLY_START} v1 id=${pack.data.id}`));
  assert.equal(await exists(pack.data.promptPath), true);

  const reply = [
    `${PRO_REPLY_START} v1 id=${pack.data.id}`,
    "## Next",
    "- Continue implementation.",
    PRO_REPLY_END
  ].join("\n");
  const imported = await invokeDesktopHandler(handlers, "pro:manual-import", {
    id: pack.data.id,
    text: reply
  });
  assert.equal(imported.ok, true);
  assert.equal(await exists(imported.data.replyPath), true);
  assert.equal(await exists(imported.data.codexReadThisPath), true);

  const status = await invokeDesktopHandler(handlers, "status:get");
  assert.equal(status.ok, true);
  assert.equal(status.data.relay.latest.state, "imported");
});

test("desktop IPC can copy the Codex continue prompt", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-copy-"));
  const clipboard = fakeClipboard();
  const handlers = createDesktopHandlers({ cwd, clipboard });

  const result = await invokeDesktopHandler(handlers, "codex:copy-continue-prompt");

  assert.equal(result.ok, true);
  assert.equal(result.data.text, CONTINUE_PROMPT);
  assert.equal(clipboard.text, CONTINUE_PROMPT);
});

test("desktop IPC can copy the ChatGPT review prompt", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-chatgpt-prompt-"));
  const clipboard = fakeClipboard();
  const opened = [];
  const handlers = createDesktopHandlers({
    cwd,
    clipboard,
    shell: {
      openExternal(url) {
        opened.push(url);
      }
    }
  });

  const result = await invokeDesktopHandler(handlers, "chatgpt:copy-review-prompt");

  assert.equal(result.ok, true);
  assert.equal(result.data.text, CHATGPT_REVIEW_PROMPT);
  assert.equal(clipboard.text, CHATGPT_REVIEW_PROMPT);
  assert.equal(opened[0], CHATGPT_URL);
});

test("desktop bridge state maps the beginner flow", () => {
  assert.deepEqual(computeBridgeState({}), {
    key: "disconnected",
    label: "未连接",
    kind: "warn"
  });
  assert.deepEqual(computeBridgeState({
    mcp: {
      webConnection: { createdAt: "2026-06-17T00:00:00.000Z" }
    }
  }), {
    key: "connected",
    label: "已连接",
    kind: "warn"
  });
  assert.deepEqual(computeBridgeState({
    mcp: {
      webConnection: { createdAt: "2026-06-17T00:00:00.000Z" },
      latestToolCall: { ts: "2026-06-17T00:00:01.000Z" }
    }
  }), {
    key: "called",
    label: "ChatGPT 已调用",
    kind: "ok"
  });
  assert.deepEqual(computeBridgeState({
    handoff: {
      latestReady: { id: "reply-id" }
    }
  }), {
    key: "written",
    label: "已写回",
    kind: "ok"
  });
});

test("desktop IPC starts MCP with injected tunnel dependencies", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-mcp-"));
  let tunnelStarted = false;
  let closed = false;
  const handlers = createDesktopHandlers({
    cwd,
    resolveCloudflaredCommandImpl: async () => "cloudflared",
    startMcpHttpServerImpl: async () => ({
      url: "http://127.0.0.1:47832/mcp",
      close: async () => {
        closed = true;
      }
    }),
    runCloudflareTunnelImpl: async () => {
      tunnelStarted = true;
      return { started: true };
    }
  });

  const result = await invokeDesktopHandler(handlers, "mcp:start");

  assert.equal(result.ok, true);
  assert.equal(result.data.mcpServerRunning, true);
  assert.equal(tunnelStarted, true);
  assert.equal(result.data.log.some((line) => line.includes("Local bridge ready")), true);

  await handlers.dispose();
  assert.equal(closed, true);
});

test("desktop IPC reuses an existing healthy local bridge on the default port", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-existing-mcp-"));
  let tunnelStarted = false;
  const handlers = createDesktopHandlers({
    cwd,
    resolveCloudflaredCommandImpl: async () => "cloudflared",
    startMcpHttpServerImpl: async () => {
      const error = new Error("listen EADDRINUSE: address already in use 127.0.0.1:47832");
      error.code = "EADDRINUSE";
      throw error;
    },
    checkLocalBridgeHealthImpl: async () => true,
    runCloudflareTunnelImpl: async () => {
      tunnelStarted = true;
      return { started: true };
    }
  });

  const result = await invokeDesktopHandler(handlers, "mcp:start");

  assert.equal(result.ok, true);
  assert.equal(result.data.mcpServerRunning, true);
  assert.equal(tunnelStarted, true);
  assert.equal(result.data.log.some((line) => line.includes("Existing local bridge ready")), true);
});

test("desktop preload allows the ChatGPT review prompt channel", async () => {
  const preload = await fs.readFile(path.join(__dirname, "..", "desktop", "preload.js"), "utf8");

  assert.match(preload, /"chatgpt:copy-review-prompt"/);
});

test("desktop main registers the ChatGPT review prompt channel", async () => {
  const main = await fs.readFile(path.join(__dirname, "..", "desktop", "main.js"), "utf8");

  assert.match(main, /"chatgpt:copy-review-prompt"/);
});

test("desktop IPC blocks unknown channels with stable JSON", async () => {
  const handlers = createDesktopHandlers();
  const result = await invokeDesktopHandler(handlers, "unknown:channel");

  assert.equal(result.ok, false);
  assert.match(result.error, /Unknown desktop IPC channel/);
});

function fakeClipboard() {
  return {
    text: "",
    writeText(value) {
      this.text = value;
    },
    readText() {
      return this.text;
    }
  };
}

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
