const assert = require("node:assert/strict");
const fsSync = require("node:fs");
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
  isUnsafeDefaultRoot,
  invokeDesktopHandler,
  normalizeBridgeHealth
} = require("../src/desktop-ipc");
const { addAllowedRoot } = require("../src/global-config");
const { CHATGPT_CONNECTORS_URL, writeWebConnectionStatus } = require("../src/mcp-web");
const { PRO_REPLY_END, PRO_REPLY_START } = require("../src/pro-relay");
const { getProjectIdentity } = require("../src/project-identity");
const pkg = require("../package.json");

process.env.CGN_CONFIG_HOME = fsSync.mkdtempSync(path.join(os.tmpdir(), "cgn-desktop-config-"));

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
  assert.equal(opened.length, 0);
  assert.match(pack.data.summary, /Pro 只能读取这份上下文/);
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
  assert.equal(result.data.opened, false);
  assert.equal(opened.length, 0);
});

test("desktop IPC can explicitly open ChatGPT with the review prompt", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-chatgpt-open-"));
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

  const result = await invokeDesktopHandler(handlers, "chatgpt:copy-review-prompt", { openChatgpt: true });

  assert.equal(result.ok, true);
  assert.equal(result.data.opened, true);
  assert.equal(opened[0], CHATGPT_URL);
});

test("desktop IPC can recopy the latest Pro pack without opening ChatGPT", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-pro-latest-"));
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

  const pack = await invokeDesktopHandler(handlers, "pro:create-pack", {
    task: "Plan release notes",
    includeDiff: false
  });
  clipboard.text = "";
  const latest = await invokeDesktopHandler(handlers, "pro:copy-latest-pack");

  assert.equal(latest.ok, true);
  assert.equal(latest.data.id, pack.data.id);
  assert.match(clipboard.text, /You cannot directly read the user's local project/);
  assert.equal(opened.length, 0);
});

test("desktop IPC lists projects with Chinese Windows-style paths", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "项目-cgn-"));
  const child = path.join(root, "chatgpt-native-bridge");
  await fs.mkdir(child, { recursive: true });
  const handlers = createDesktopHandlers({ cwd: root });

  const added = await invokeDesktopHandler(handlers, "project:add", { path: child });
  const listed = await invokeDesktopHandler(handlers, "project:list");

  assert.equal(added.ok, true);
  assert.equal(added.data.selected.name, "chatgpt-native-bridge");
  assert.equal(listed.ok, true);
  assert.ok(listed.data.some((project) => project.cwd === child && project.selected));
  assert.ok(listed.data.every((project) => project.projectFingerprint));
});

test("desktop startup treats Windows System32 as an unsafe default root", async () => {
  assert.equal(isUnsafeDefaultRoot("C:\\Windows\\System32"), true);
  assert.equal(isUnsafeDefaultRoot("D:\\项目\\chatgpt-native-bridge"), false);
});

test("desktop startup uses the last selected project when launched from System32", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows-specific cwd behavior");
    return;
  }
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-system32-config-"));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-last-project-"));
  await addAllowedRoot(project, { configDir });
  const handlers = createDesktopHandlers({
    cwd: "C:\\Windows\\System32",
    configDir
  });

  const status = await invokeDesktopHandler(handlers, "status:get");

  assert.equal(status.ok, true);
  assert.equal(status.data.project.cwd, project);
  assert.equal(status.data.projects.some((item) => /\\windows\\system32$/i.test(item.cwd)), false);
});

test("desktop IPC exposes workbench channels with stable JSON", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-v08-"));
  const clipboard = fakeClipboard();
  const handlers = createDesktopHandlers({ cwd, clipboard });

  const approvals = await invokeDesktopHandler(handlers, "approval:list");
  assert.deepEqual(approvals, {
    ok: true,
    data: {
      approvals: [],
      status: "not_required"
    }
  });

  const resolved = await invokeDesktopHandler(handlers, "approval:resolve", {
    id: "approval-1",
    decision: "approved"
  });
  assert.deepEqual(resolved, {
    ok: true,
    data: {
      id: "approval-1",
      decision: "approved",
      resolved: false,
      status: "not_required"
    }
  });

  const changes = await invokeDesktopHandler(handlers, "changes:get");
  assert.equal(changes.ok, true);
  assert.equal(changes.data.status, "ready");
  assert.match(changes.data.summary, /Git|暂无/);
  assert.ok(Array.isArray(changes.data.commands));
  assert.ok(Array.isArray(changes.data.timeline));

  const copied = await invokeDesktopHandler(handlers, "changes:copy-summary");
  assert.equal(copied.ok, true);
  assert.equal(copied.data.copied, true);
  assert.equal(clipboard.text, copied.data.summary);

  const commands = await invokeDesktopHandler(handlers, "command:list");
  assert.deepEqual(commands, {
    ok: true,
    data: {
      commands: [],
      emptyReason: "本轮没有 shell 命令。",
      status: "ready"
    }
  });

  const output = await invokeDesktopHandler(handlers, "command:get-output", { id: "cmd-1" });
  assert.deepEqual(output, {
    ok: true,
    data: {
      id: "cmd-1",
      output: "",
      running: false,
      status: "missing"
    }
  });

  const canceled = await invokeDesktopHandler(handlers, "command:cancel", { id: "cmd-1" });
  assert.deepEqual(canceled, {
    ok: true,
    data: {
      id: "cmd-1",
      canceled: false,
      reason: "not_running",
      status: "idle"
    }
  });

  const permissions = await invokeDesktopHandler(handlers, "project:permissions-get");
  assert.equal(permissions.ok, true);
  assert.equal(permissions.data.project.cwd, cwd);
  assert.deepEqual(permissions.data.permissions, {
    shell: true,
    fileWrite: true
  });
  assert.match(permissions.data.status, /runtime-project|trusted/);

  const updated = await invokeDesktopHandler(handlers, "project:permissions-update", {
    shell: true,
    fileWrite: true
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.data.project.cwd, cwd);
  assert.deepEqual(updated.data.permissions, {
    shell: true,
    fileWrite: true
  });
  assert.equal(updated.data.updated, false);
  assert.match(updated.data.status, /runtime-project|trusted/);
});

test("desktop status uses fresh MCP audit as a called state", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-called-"));
  const handlers = createDesktopHandlers({ cwd });
  await writeJson(path.join(cwd, ".chatgpt-native", "runs", "mcp-web-connection.json"), {
    createdAt: "2026-06-18T01:00:00.000Z",
    serverUrl: "https://called-project.trycloudflare.com/mcp",
    tunnelUrl: "https://called-project.trycloudflare.com",
    projectFingerprint: getProjectIdentity(cwd).projectFingerprint
  });
  await appendJsonl(path.join(cwd, ".chatgpt-native", "runs", "mcp-audit.jsonl"), {
    ts: "2026-06-18T01:00:01.000Z",
    toolName: "read_git_diff",
    ok: true
  });

  const status = await invokeDesktopHandler(handlers, "status:get");

  assert.equal(status.ok, true);
  assert.equal(status.data.mcp.latestToolCall.toolName, "read_git_diff");
  assert.equal(status.data.bridgeState.key, "called");
  assert.equal(status.data.projects.find((project) => project.selected).bridgeState.key, "called");
});

test("desktop status exposes ChatGPT access before tool calls", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-accessed-"));
  const handlers = createDesktopHandlers({ cwd });
  await writeJson(path.join(cwd, ".chatgpt-native", "runs", "mcp-web-connection.json"), {
    createdAt: "2026-06-18T01:00:00.000Z",
    serverUrl: "https://accessed-project.trycloudflare.com/mcp",
    tunnelUrl: "https://accessed-project.trycloudflare.com",
    projectFingerprint: getProjectIdentity(cwd).projectFingerprint
  });
  await appendJsonl(path.join(cwd, ".chatgpt-native", "runs", "mcp-requests.jsonl"), {
    ts: "2026-06-18T01:00:01.000Z",
    rpcMethod: "tools/list",
    statusCode: 200
  });

  const status = await invokeDesktopHandler(handlers, "status:get");

  assert.equal(status.ok, true);
  assert.equal(status.data.mcp.latestRequest.rpcMethod, "tools/list");
  assert.equal(status.data.bridgeState.key, "accessed");
  assert.equal(status.data.bridgeState.label, "ChatGPT 已访问");
});

test("desktop workbench includes tool calls, command fallbacks, and inbox replies", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-evidence-"));
  const handlers = createDesktopHandlers({ cwd });
  await appendJsonl(path.join(cwd, ".chatgpt-native", "runs", "mcp-audit.jsonl"), {
    ts: "2026-06-18T01:02:00.000Z",
    toolName: "read_git_diff",
    ok: true
  });
  await appendJsonl(path.join(cwd, ".chatgpt-native", "runs", "mcp-audit.jsonl"), {
    ts: "2026-06-18T01:03:00.000Z",
    toolName: "agent_read_result",
    ok: false,
    error: "Agent run not found"
  });
  await appendJsonl(path.join(cwd, ".chatgpt-native", "runs", "command-history.jsonl"), {
    id: "cmd-fixture",
    ts: "2026-06-18T01:04:00.000Z",
    commandRedacted: "npm test",
    exitCode: 0,
    durationMs: 1234,
    stdoutPreview: "pass",
    stderrPreview: ""
  });
  await fs.mkdir(path.join(cwd, ".chatgpt-native", "inbox", "mcp-reply-fixture"), { recursive: true });
  await fs.writeFile(
    path.join(cwd, ".chatgpt-native", "inbox", "mcp-reply-fixture", "reply.md"),
    "ChatGPT final review\n",
    "utf8"
  );

  const commands = await invokeDesktopHandler(handlers, "command:list");
  const changes = await invokeDesktopHandler(handlers, "changes:get");

  assert.equal(commands.ok, true);
  assert.equal(commands.data.commands[0].id, "cmd-fixture");
  assert.equal(commands.data.emptyReason, "");
  assert.equal(changes.ok, true);
  assert.equal(changes.data.toolCalls.length, 2);
  assert.equal(changes.data.evidenceSummary.counts.failedToolCalls, 1);
  assert.equal(changes.data.commandPanel.status, "has_commands");
  assert.equal(changes.data.latestReply.id, "mcp-reply-fixture");
  assert.match(changes.data.latestReply.text, /ChatGPT final review/);
  assert.ok(changes.data.timeline.some((item) => item.source === "tool" && item.state === "failed"));
  assert.ok(changes.data.timeline.some((item) => item.source === "reply"));
});

test("desktop workbench explains missing shell output when tools were called", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-no-shell-"));
  const handlers = createDesktopHandlers({ cwd });
  await appendJsonl(path.join(cwd, ".chatgpt-native", "runs", "mcp-audit.jsonl"), {
    ts: "2026-06-18T01:05:00.000Z",
    toolName: "bridge_status",
    ok: true
  });

  const commands = await invokeDesktopHandler(handlers, "command:list");
  const changes = await invokeDesktopHandler(handlers, "changes:get");

  assert.equal(commands.ok, true);
  assert.equal(commands.data.commands.length, 0);
  assert.equal(commands.data.emptyReason, "本轮没有 shell 命令。");
  assert.equal(changes.ok, true);
  assert.equal(changes.data.commandPanel.status, "no_commands");
  assert.match(changes.data.commandPanel.message, /ChatGPT 已调用工具/);
  assert.equal(changes.data.commandPanel.fallbackItems[0].toolName, "bridge_status");
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
    mcp: {
      webConnection: { createdAt: "2026-06-17T00:00:00.000Z" },
      latestRequest: { ts: "2026-06-17T00:00:01.000Z", rpcMethod: "tools/list", statusCode: 200 }
    }
  }), {
    key: "accessed",
    label: "ChatGPT 已访问",
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
  let tunnelOptions = null;
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
    runCloudflareTunnelImpl: async (options) => {
      tunnelOptions = options;
      tunnelStarted = true;
      return { started: true };
    }
  });

  const result = await invokeDesktopHandler(handlers, "mcp:start");

  assert.equal(result.ok, true);
  assert.equal(result.data.mcpServerRunning, true);
  assert.equal(tunnelStarted, true);
  assert.equal(tunnelOptions.port, 47832);
  assert.equal(tunnelOptions.openChatgpt, false);
  assert.equal(result.data.log.some((line) => line.includes("Local bridge ready")), true);

  await handlers.dispose();
  assert.equal(closed, true);
});

test("desktop connect reuses a live project Server URL and opens ChatGPT settings", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-live-url-"));
  const identity = getProjectIdentity(cwd);
  const serverUrl = "https://live-project.trycloudflare.com/mcp";
  await writeWebConnectionStatus({
    cwd,
    tunnelUrl: "https://live-project.trycloudflare.com",
    serverUrl
  });
  const clipboard = fakeClipboard();
  const opened = [];
  let tunnelStarted = false;
  const handlers = createDesktopHandlers({
    cwd,
    clipboard,
    shell: {
      openExternal(url) {
        opened.push(url);
      }
    },
    fetchImpl: async (url) => {
      assert.equal(url, "https://live-project.trycloudflare.com/health");
      return {
        ok: true,
        json: async () => ({
          ok: true,
          name: "chatgpt-native-bridge",
          packageVersion: pkg.version,
          projectFingerprint: identity.projectFingerprint
        })
      };
    },
    runCloudflareTunnelImpl: async () => {
      tunnelStarted = true;
      return { started: true };
    }
  });

  const result = await invokeDesktopHandler(handlers, "mcp:connect-or-refresh");

  assert.equal(result.ok, true);
  assert.equal(result.data.reused, true);
  assert.equal(result.data.serverUrl, serverUrl);
  assert.equal(clipboard.text, serverUrl);
  assert.equal(opened[0], CHATGPT_CONNECTORS_URL);
  assert.equal(tunnelStarted, false);
});

test("desktop connect creates a new URL when the saved URL is unreachable", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-dead-url-"));
  await writeWebConnectionStatus({
    cwd,
    tunnelUrl: "https://dead-project.trycloudflare.com",
    serverUrl: "https://dead-project.trycloudflare.com/mcp"
  });
  const opened = [];
  let tunnelOptions = null;
  const handlers = createDesktopHandlers({
    cwd,
    shell: {
      openExternal(url) {
        opened.push(url);
      }
    },
    fetchImpl: async () => {
      throw new Error("network down");
    },
    resolveCloudflaredCommandImpl: async () => "cloudflared",
    startMcpHttpServerImpl: async () => ({
      url: "http://127.0.0.1:47832/mcp",
      close: async () => {}
    }),
    runCloudflareTunnelImpl: async (options) => {
      tunnelOptions = options;
      return { started: true };
    }
  });

  const result = await invokeDesktopHandler(handlers, "mcp:connect-or-refresh");

  assert.equal(result.ok, true);
  assert.equal(result.data.reused, false);
  assert.equal(tunnelOptions.port, 47832);
  assert.equal(tunnelOptions.openChatgpt, true);
  assert.equal(opened.length, 0);
});

test("desktop connect does not reuse a Server URL from another project", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-wrong-project-"));
  const other = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-other-project-"));
  const otherIdentity = getProjectIdentity(other);
  await writeWebConnectionStatus({
    cwd,
    tunnelUrl: "https://other-project.trycloudflare.com",
    serverUrl: "https://other-project.trycloudflare.com/mcp"
  });
  let tunnelOptions = null;
  const handlers = createDesktopHandlers({
    cwd,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        name: "chatgpt-native-bridge",
        packageVersion: pkg.version,
        projectFingerprint: otherIdentity.projectFingerprint
      })
    }),
    resolveCloudflaredCommandImpl: async () => "cloudflared",
    startMcpHttpServerImpl: async () => ({
      url: "http://127.0.0.1:47832/mcp",
      close: async () => {}
    }),
    runCloudflareTunnelImpl: async (options) => {
      tunnelOptions = options;
      return { started: true };
    }
  });

  const result = await invokeDesktopHandler(handlers, "mcp:connect-or-refresh");

  assert.equal(result.ok, true);
  assert.equal(result.data.reused, false);
  assert.match(result.data.validation.reason, /another project/);
  assert.equal(tunnelOptions.openChatgpt, true);
});

test("desktop IPC reuses an existing healthy local bridge on the default port", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-existing-mcp-"));
  const identity = getProjectIdentity(cwd);
  let tunnelStarted = false;
  const handlers = createDesktopHandlers({
    cwd,
    resolveCloudflaredCommandImpl: async () => "cloudflared",
    startMcpHttpServerImpl: async () => {
      const error = new Error("listen EADDRINUSE: address already in use 127.0.0.1:47832");
      error.code = "EADDRINUSE";
      throw error;
    },
    checkLocalBridgeHealthImpl: async () => ({
      ok: true,
      version: pkg.version,
      currentVersion: pkg.version,
      matchesCurrentVersion: true,
      projectRoot: cwd,
      projectFingerprint: identity.projectFingerprint
    }),
    runCloudflareTunnelImpl: async (options) => {
      assert.equal(options.port, 47832);
      assert.equal(options.openChatgpt, false);
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

test("desktop IPC avoids reusing a stale bridge on the default port", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-stale-mcp-"));
  const startedPorts = [];
  const tunnelPorts = [];
  const handlers = createDesktopHandlers({
    cwd,
    resolveCloudflaredCommandImpl: async () => "cloudflared",
    startMcpHttpServerImpl: async (options) => {
      startedPorts.push(options.port);
      if (options.port === 47832) {
        const error = new Error("listen EADDRINUSE: address already in use 127.0.0.1:47832");
        error.code = "EADDRINUSE";
        throw error;
      }
      return {
        url: "http://127.0.0.1:49123/mcp",
        close: async () => {}
      };
    },
    checkLocalBridgeHealthImpl: async () => ({
      ok: true,
      version: "0.4.1",
      currentVersion: pkg.version,
      matchesCurrentVersion: false
    }),
    runCloudflareTunnelImpl: async (options) => {
      tunnelPorts.push(options.port);
      return { started: true };
    }
  });

  const result = await invokeDesktopHandler(handlers, "mcp:start");

  assert.equal(result.ok, true);
  assert.deepEqual(startedPorts, [47832, 0]);
  assert.deepEqual(tunnelPorts, [49123]);
  assert.equal(result.data.log.some((line) => line.includes("temporary port 49123")), true);
});

test("desktop IPC avoids reusing a same-version bridge from another project", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-wrong-local-"));
  const other = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-wrong-local-other-"));
  const otherIdentity = getProjectIdentity(other);
  const startedPorts = [];
  const tunnelPorts = [];
  const handlers = createDesktopHandlers({
    cwd,
    resolveCloudflaredCommandImpl: async () => "cloudflared",
    startMcpHttpServerImpl: async (options) => {
      startedPorts.push(options.port);
      if (options.port === 47832) {
        const error = new Error("listen EADDRINUSE: address already in use 127.0.0.1:47832");
        error.code = "EADDRINUSE";
        throw error;
      }
      return {
        url: "http://127.0.0.1:49234/mcp",
        close: async () => {}
      };
    },
    checkLocalBridgeHealthImpl: async () => ({
      ok: true,
      version: pkg.version,
      currentVersion: pkg.version,
      matchesCurrentVersion: true,
      projectRoot: other,
      projectFingerprint: otherIdentity.projectFingerprint
    }),
    runCloudflareTunnelImpl: async (options) => {
      tunnelPorts.push(options.port);
      return { started: true };
    }
  });

  const result = await invokeDesktopHandler(handlers, "mcp:start");

  assert.equal(result.ok, true);
  assert.deepEqual(startedPorts, [47832, 0]);
  assert.deepEqual(tunnelPorts, [49234]);
  assert.equal(result.data.log.some((line) => line.includes("another project")), true);
});

test("desktop health normalization requires the current package version", () => {
  assert.deepEqual(normalizeBridgeHealth({
    ok: true,
    version: "0.4.1",
    currentVersion: pkg.version,
    matchesCurrentVersion: false
  }), {
    ok: true,
    version: "0.4.1",
    currentVersion: pkg.version,
    projectRoot: "",
    projectFingerprint: "",
    matchesCurrentVersion: false,
    matchesCurrentProject: false
  });
});

test("desktop health normalization detects a different project", () => {
  const cwd = path.join(os.tmpdir(), "cgn-current-project");
  const current = getProjectIdentity(cwd);
  assert.equal(normalizeBridgeHealth({
    ok: true,
    version: pkg.version,
    currentVersion: pkg.version,
    matchesCurrentVersion: true,
    projectFingerprint: "other-project"
  }, current).matchesCurrentProject, false);
});

test("desktop preload allows the ChatGPT review prompt channel", async () => {
  const preload = await fs.readFile(path.join(__dirname, "..", "desktop", "preload.js"), "utf8");

  for (const channel of [
    "chatgpt:copy-review-prompt",
    "pro:copy-latest-pack",
    "project:list",
    "project:add",
    "mcp:connect-or-refresh",
    "mcp:validate-connection",
    "approval:list",
    "approval:resolve",
    "changes:get",
    "changes:copy-summary",
    "command:list",
    "command:get-output",
    "command:cancel",
    "project:permissions-get",
    "project:permissions-update"
  ]) {
    assert.match(preload, new RegExp(`"${channel}"`));
  }
});

test("desktop main registers the ChatGPT review prompt channel", async () => {
  const main = await fs.readFile(path.join(__dirname, "..", "desktop", "main.js"), "utf8");

  for (const channel of [
    "chatgpt:copy-review-prompt",
    "pro:copy-latest-pack",
    "project:list",
    "project:add",
    "mcp:connect-or-refresh",
    "mcp:validate-connection",
    "approval:list",
    "approval:resolve",
    "changes:get",
    "changes:copy-summary",
    "command:list",
    "command:get-output",
    "command:cancel",
    "project:permissions-get",
    "project:permissions-update"
  ]) {
    assert.match(main, new RegExp(`"${channel}"`));
  }
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

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function appendJsonl(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}
