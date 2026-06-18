const fs = require("node:fs/promises");
const path = require("node:path");

const { getAppStatus } = require("./app-server");
const { startClipboardWatch } = require("./clipboard-watch");
const { addAllowedRoot, isRootAllowed, listAllowedRoots, setLastSelectedProject } = require("./global-config");
const { startMcpHttpServer } = require("./mcp-server");
const {
  CHATGPT_CONNECTORS_URL,
  DEFAULT_TUNNEL_HOST,
  DEFAULT_TUNNEL_PORT,
  installCloudflared,
  readWebConnectionStatus,
  resolveCloudflaredCommand,
  runCloudflareTunnel
} = require("./mcp-web");
const { getMcpTrace } = require("./mcp-trace");
const { createProPack, getLatestProRelayState, importProReply } = require("./pro-relay");
const { getProjectIdentity } = require("./project-identity");
const { getStatus } = require("./status");
const { getWorkspaceChangeSummary } = require("./workspace/change-tracker");
const { readCommandHistory } = require("./workspace/command-history");
const pkg = require("../package.json");

const CHATGPT_URL = "https://chatgpt.com";
const CHATGPT_REVIEW_PROMPT = "请使用 chatgpt-native-bridge 复核当前项目，可以读取文件、运行必要命令并修改文件。完成后请把最终建议写回 Codex。";
const CONTINUE_PROMPT = "读取最新 Bridge 回复，检查变更摘要，然后继续执行、测试和总结。";
const NO_CHANGES_SUMMARY = "暂无可查看的项目变更。";

function createDesktopHandlers(options = {}) {
  const state = {
    cwd: path.resolve(options.cwd || process.cwd()),
    initialUnsafeDefaultRoot: isUnsafeDefaultRoot(options.cwd || process.cwd()),
    initialSelectionChecked: false,
    projects: [],
    watcher: null,
    mcpServer: null,
    mcpServers: new Map(),
    mcpStarting: null,
    mcpLog: [],
    configDir: options.configDir || null
  };
  if (!state.initialUnsafeDefaultRoot) addProject(state, state.cwd);
  const clipboard = options.clipboard || {
    writeText() {},
    readText() {
      return "";
    }
  };
  const shell = options.shell || {
    openExternal() {}
  };

  const appendMcpLog = (line) => {
    state.mcpLog.push(`${new Date().toISOString()} ${line}`);
    state.mcpLog = state.mcpLog.slice(-80);
  };

  return {
    async "project:get"() {
      await ensureSaneSelectedProject(state);
      return projectInfo(state.cwd);
    },

    async "project:list"() {
      await ensureSaneSelectedProject(state);
      return listProjects(state);
    },

    async "project:add"(payload = {}) {
      const selected = payload.path || (options.selectDirectoryImpl && await options.selectDirectoryImpl());
      if (!selected) return { selected: projectInfo(state.cwd), projects: await listProjects(state) };
      state.cwd = path.resolve(selected);
      addProject(state, state.cwd);
      await addAllowedRoot(state.cwd, configOptions(state));
      if (state.watcher) {
        state.watcher.stop("project changed");
        state.watcher = null;
      }
      return { selected: projectInfo(state.cwd), projects: await listProjects(state) };
    },

    async "project:select"(payload = {}) {
      const selected = payload.path || (options.selectDirectoryImpl && await options.selectDirectoryImpl());
      if (!selected) return projectInfo(state.cwd);
      state.cwd = path.resolve(selected);
      addProject(state, state.cwd);
      await addAllowedRoot(state.cwd, configOptions(state));
      await setLastSelectedProject(state.cwd, configOptions(state));
      if (state.watcher) {
        state.watcher.stop("project changed");
        state.watcher = null;
      }
      return projectInfo(state.cwd);
    },

    async "status:get"() {
      await ensureSaneSelectedProject(state);
      const status = await getAppStatus({ cwd: state.cwd, watcher: state.watcher });
      const result = {
        ...status,
        project: projectInfo(state.cwd),
        desktop: {
          mcpLog: state.mcpLog,
          mcpServerRunning: Boolean(getStateServer(state, state.cwd)),
          packageVersion: pkg.version,
          clipboardWatcher: state.watcher ? state.watcher.publicState() : null
        }
      };
      const bridgeState = computeBridgeState(result);
      return {
        ...result,
        bridgeState,
        projects: await listProjects(state, result, bridgeState)
      };
    },

    async "approval:list"() {
      return {
        approvals: [],
        status: "not_required"
      };
    },

    async "approval:resolve"(payload = {}) {
      return {
        id: String(payload.id || ""),
        decision: String(payload.decision || ""),
        resolved: false,
        status: "not_required"
      };
    },

    async "changes:get"() {
      return getWorkbenchSnapshot(state.cwd);
    },

    async "changes:copy-summary"() {
      const snapshot = await getWorkbenchSnapshot(state.cwd);
      clipboard.writeText(snapshot.summary);
      return {
        copied: true,
        summary: snapshot.summary,
        status: snapshot.status
      };
    },

    async "command:list"() {
      const commands = await readCommandHistory(state.cwd, { limit: 20 });
      return {
        commands,
        emptyReason: commands.length ? "" : "本轮没有 shell 命令。",
        status: "ready"
      };
    },

    async "command:get-output"(payload = {}) {
      const id = String(payload.id || "");
      const commands = await readCommandHistory(state.cwd, { limit: 100 });
      const command = commands.find((item) => item.id === id) || null;
      return {
        id,
        output: command ? [command.stdoutPreview, command.stderrPreview].filter(Boolean).join("\n") : "",
        running: false,
        status: command ? "ready" : "missing"
      };
    },

    async "command:cancel"(payload = {}) {
      return {
        id: String(payload.id || ""),
        canceled: false,
        reason: "not_running",
        status: "idle"
      };
    },

    async "project:permissions-get"() {
      return projectPermissions(state.cwd, state);
    },

    async "project:permissions-update"() {
      const permissions = await projectPermissions(state.cwd, state);
      return {
        ...permissions,
        updated: false
      };
    },

    async "pro:create-pack"(payload = {}) {
      const pack = await createProPack({
        cwd: state.cwd,
        task: payload.task,
        includeDiff: payload.includeDiff !== false,
        maxBytes: payload.maxBytes,
        copyToClipboardImpl: (text) => clipboard.writeText(text)
      });
      if (payload.openChatgpt === true) {
        await shell.openExternal(CHATGPT_URL);
      }
      return {
        id: pack.id,
        task: pack.task,
        promptPath: pack.promptPath,
        copied: pack.copied,
        opened: payload.openChatgpt === true,
        summary: describeProPack(pack)
      };
    },

    async "pro:copy-latest-pack"() {
      const latest = await getLatestProRelayState(state.cwd);
      if (!latest || !latest.promptPath) throw new Error("还没有可复用的 Pro 上下文。");
      const prompt = await fs.readFile(latest.promptPath, "utf8");
      clipboard.writeText(prompt);
      return {
        id: latest.id,
        promptPath: latest.promptPath,
        copied: true,
        summary: describeProPack(latest)
      };
    },

    async "pro:start-watch"(payload = {}) {
      let id = String(payload.id || "").trim();
      if (!id) {
        const latest = await getLatestProRelayState(state.cwd);
        id = latest && latest.id;
      }
      if (!id) throw new Error("请先生成 Pro 辅助规划。");
      if (state.watcher) state.watcher.stop("replaced");
      state.watcher = startClipboardWatch({
        cwd: state.cwd,
        id,
        timeoutMs: payload.timeoutMs,
        readFromClipboardImpl: () => clipboard.readText(),
        onImported: () => {
          state.watcher = null;
        }
      });
      return state.watcher.publicState();
    },

    async "pro:manual-import"(payload = {}) {
      const result = await importProReply({ cwd: state.cwd, id: payload.id, text: payload.text });
      return {
        id: result.id,
        replyPath: result.replyPath,
        codexReadThisPath: result.codexReadThisPath
      };
    },

    async "chatgpt:open"() {
      await shell.openExternal(CHATGPT_URL);
      return { opened: true, url: CHATGPT_URL };
    },

    async "chatgpt:copy-review-prompt"(payload = {}) {
      clipboard.writeText(CHATGPT_REVIEW_PROMPT);
      if (payload.openChatgpt === true) {
        await shell.openExternal(CHATGPT_URL);
      }
      return {
        copied: true,
        text: CHATGPT_REVIEW_PROMPT,
        opened: payload.openChatgpt === true,
        url: payload.openChatgpt === true ? CHATGPT_URL : null
      };
    },

    async "mcp:start"() {
      await addAllowedRoot(state.cwd, configOptions(state));
      if (!state.mcpStarting) {
        state.mcpStarting = startDesktopMcp({
          cwd: state.cwd,
          appendLog: appendMcpLog,
          state,
          installCloudflaredImpl: options.installCloudflaredImpl,
          resolveCloudflaredCommandImpl: options.resolveCloudflaredCommandImpl,
          runCloudflareTunnelImpl: options.runCloudflareTunnelImpl,
          startMcpHttpServerImpl: options.startMcpHttpServerImpl,
          checkLocalBridgeHealthImpl: options.checkLocalBridgeHealthImpl
        }).finally(() => {
          state.mcpStarting = null;
        });
      }
      await state.mcpStarting;
      return {
        started: true,
        mcpServerRunning: Boolean(getStateServer(state, state.cwd)),
        log: state.mcpLog
      };
    },

    async "mcp:connect-or-refresh"() {
      await addAllowedRoot(state.cwd, configOptions(state));
      const validation = await validateProjectConnection({
        cwd: state.cwd,
        fetchImpl: options.fetchImpl
      });
      if (validation.ok) {
        clipboard.writeText(validation.connection.serverUrl);
        await shell.openExternal(CHATGPT_CONNECTORS_URL);
        appendMcpLog("Reused current project ChatGPT connection");
        return {
          reused: true,
          opened: true,
          copied: true,
          serverUrl: validation.connection.serverUrl,
          message: "已复用当前项目连接，请在 ChatGPT 里刷新工具。",
          validation
        };
      }

      appendMcpLog(`Current project connection is not reusable: ${validation.reason}`);
      if (!state.mcpStarting) {
        state.mcpStarting = startDesktopMcp({
          cwd: state.cwd,
          appendLog: appendMcpLog,
          state,
          installCloudflaredImpl: options.installCloudflaredImpl,
          resolveCloudflaredCommandImpl: options.resolveCloudflaredCommandImpl,
          runCloudflareTunnelImpl: options.runCloudflareTunnelImpl,
          startMcpHttpServerImpl: options.startMcpHttpServerImpl,
          checkLocalBridgeHealthImpl: options.checkLocalBridgeHealthImpl,
          openChatgpt: true
        }).finally(() => {
          state.mcpStarting = null;
        });
      }
      await state.mcpStarting;
      return {
        reused: false,
        opened: true,
        copied: false,
        message: "已复制新的连接地址，请在 ChatGPT 创建或更新工具。",
        validation,
        log: state.mcpLog
      };
    },

    async "mcp:validate-connection"() {
      return validateProjectConnection({
        cwd: state.cwd,
        fetchImpl: options.fetchImpl
      });
    },

    async "mcp:trace"() {
      return getMcpTrace({ cwd: state.cwd, limit: 10 });
    },

    async "codex:copy-continue-prompt"() {
      clipboard.writeText(CONTINUE_PROMPT);
      return { copied: true, text: CONTINUE_PROMPT };
    },

    async dispose() {
      if (state.watcher) state.watcher.stop("disposed");
      state.watcher = null;
      const servers = state.mcpServers ? [...state.mcpServers.values()] : [state.mcpServer].filter(Boolean);
      for (const server of servers) await server.close();
      if (state.mcpServers) state.mcpServers.clear();
      state.mcpServer = null;
    }
  };
}

function computeBridgeState(status = {}) {
  if (hasLatestReply(status)) {
    return { key: "written", label: "已写回", kind: "ok" };
  }
  if (hasBlockingMcpError(status.mcp || {})) {
    return { key: "error", label: "连接异常", kind: "bad" };
  }
  if (hasFreshToolCall(status.mcp || {})) {
    return { key: "called", label: "ChatGPT 已调用", kind: "ok" };
  }
  if (hasFreshToolRequest(status.mcp || {})) {
    return { key: "called", label: "ChatGPT 已调用", kind: "ok" };
  }
  if (hasFreshRequest(status.mcp || {})) {
    return { key: "accessed", label: "ChatGPT 已访问", kind: "ok" };
  }
  if ((status.desktop && status.desktop.mcpServerRunning) || (status.mcp && status.mcp.webConnection)) {
    return { key: "connected", label: "已连接", kind: "warn" };
  }
  return { key: "disconnected", label: "未连接", kind: "warn" };
}

function hasLatestReply(status = {}) {
  return Boolean(
    (status.handoff && status.handoff.latestReady) ||
    (status.relay && status.relay.latest && status.relay.latest.state === "imported")
  );
}

function hasFreshToolCall(mcp = {}) {
  const latest = mcp.latestSuccessfulToolCall || (mcp.latestToolCall && mcp.latestToolCall.ok !== false ? mcp.latestToolCall : null);
  if (!latest) return false;
  return isFreshMcpEvent(latest, mcp);
}

function hasFreshToolRequest(mcp = {}) {
  if (!mcp.hasToolsCallRequest) return false;
  return hasFreshRequest(mcp);
}

function hasFreshRequest(mcp = {}) {
  const latest = mcp.latestRequest;
  if (!latest) return false;
  return isFreshMcpEvent(latest, mcp);
}

function hasBlockingMcpError(mcp = {}) {
  if (mcp.error) return true;
  const latestRequest = mcp.latestRequest;
  if (latestRequest && Number(latestRequest.statusCode) >= 400) return true;
  return Boolean(mcp.latestToolCall && mcp.latestToolCall.ok === false && !mcp.latestSuccessfulToolCall);
}

function isFreshMcpEvent(event = {}, mcp = {}) {
  const connectionTime = mcp.webConnection && Date.parse(mcp.webConnection.createdAt || "");
  const eventTime = Date.parse(event.ts || "");
  if (Number.isFinite(connectionTime) && Number.isFinite(eventTime)) {
    return eventTime >= connectionTime;
  }
  return true;
}

async function getWorkbenchSnapshot(cwd) {
  const [changes, commands, status, trace] = await Promise.all([
    getWorkspaceChangeSummary({ cwd, includeDiff: true, maxBytes: 80 * 1024 }),
    readCommandHistory(cwd, { limit: 12 }),
    getStatus({ cwd }),
    getMcpTrace({ cwd, limit: 20 }).catch((error) => ({
      toolCalls: [],
      requests: [],
      error: error.message || "Could not read MCP trace."
    }))
  ]);
  const toolCalls = normalizeToolCalls(trace.toolCalls || []);
  const latestReply = status.ready.at(-1) || null;
  const replyText = latestReply && latestReply.replyPath
    ? await readTextPreview(latestReply.replyPath, 8000)
    : "";
  const codexReadThisPath = latestReply && latestReply.replyPath
    ? path.join(path.dirname(latestReply.replyPath), "CODEX_READ_THIS.md")
    : null;
  const files = changes.status && changes.status.entries
    ? changes.status.entries.map((entry) => ({ path: entry.path, code: entry.code }))
    : [];
  const diffFiles = changes.diff && changes.diff.files ? changes.diff.files : [];
  const summary = formatWorkbenchSummary({ changes, commands, latestReply, toolCalls });
  const commandPanel = buildCommandPanel({ commands, toolCalls });
  const evidenceSummary = buildEvidenceSummary({ changes, commands, latestReply, toolCalls });

  return {
    status: "ready",
    summary,
    evidenceSummary,
    toolCalls,
    files,
    diffFiles,
    git: changes.status,
    diff: changes.diff ? {
      bytes: changes.diff.bytes,
      truncated: changes.diff.truncated,
      files: diffFiles
    } : null,
    commands,
    commandPanel,
    latestReply: latestReply ? {
      id: latestReply.id,
      replyPath: latestReply.replyPath,
      codexReadThisPath,
      text: replyText
    } : null,
    timeline: buildTimeline({ changes, commands, latestReply, toolCalls }),
    warnings: changes.warnings || []
  };
}

function normalizeToolCalls(toolCalls) {
  return toolCalls.map((event) => ({
    ts: event.ts || "",
    toolName: event.toolName || event.name || "tool",
    ok: event.ok !== false,
    error: event.error || "",
    kind: classifyTool(event.toolName || event.name || ""),
    argsSummary: summarizeArgs(event.args)
  }));
}

function classifyTool(toolName) {
  if (/bash|command/i.test(toolName)) return "shell";
  if (/write|edit|submit_reply|write_to_codex/i.test(toolName)) return "write";
  if (/status|diff|read|list|open|search/i.test(toolName)) return "read";
  if (/agent/i.test(toolName)) return "agent";
  return "tool";
}

function summarizeArgs(args) {
  if (!args || typeof args !== "object") return "";
  const keys = Object.keys(args).slice(0, 4);
  return keys.map((key) => `${key}=${String(args[key]).slice(0, 80)}`).join(", ");
}

function buildCommandPanel({ commands, toolCalls }) {
  if (commands.length) {
    return {
      status: "has_commands",
      message: `最近 ${commands.length} 条 shell 命令。`,
      fallbackItems: []
    };
  }
  if (toolCalls.length) {
    return {
      status: "no_commands",
      message: "本轮没有 shell 命令；ChatGPT 已调用工具，下面显示工具调用证据。",
      fallbackItems: toolCalls.slice(-5).reverse()
    };
  }
  return {
    status: "no_commands",
    message: "还没有执行本地命令。",
    fallbackItems: []
  };
}

function buildEvidenceSummary({ changes, commands, latestReply, toolCalls }) {
  const files = changes.status && changes.status.entries ? changes.status.entries : [];
  const failedToolCalls = toolCalls.filter((event) => event.ok === false);
  const last = latestReply ? "已有写回" : toolCalls.length ? "尚未写回" : "等待调用";
  return {
    headline: [
      toolCalls.length ? `ChatGPT 已调用 ${toolCalls.length} 次工具` : "等待 ChatGPT 调用工具",
      commands.length ? `运行了 ${commands.length} 条命令` : "本轮没有 shell 命令",
      files.length ? `${files.length} 个文件有变更` : "暂无文件变更",
      last
    ].join("；"),
    counts: {
      toolCalls: toolCalls.length,
      failedToolCalls: failedToolCalls.length,
      commands: commands.length,
      changedFiles: files.length
    },
    lastActivityAt: latestActivityAt({ commands, latestReply, toolCalls })
  };
}

function latestActivityAt({ commands, latestReply, toolCalls }) {
  const values = [
    ...commands.map((item) => item.ts),
    ...toolCalls.map((item) => item.ts),
    latestReply && latestReply.replyPath ? "" : ""
  ].filter(Boolean);
  return values.sort().at(-1) || "";
}

function formatWorkbenchSummary({ changes, commands, latestReply, toolCalls }) {
  const lines = [];
  const entries = changes.status && changes.status.entries ? changes.status.entries : [];
  if (changes.status && changes.status.clean) lines.push("Git：当前没有未提交变更。");
  if (entries.length) lines.push(`Git：${entries.length} 个文件有变更。`);
  if (!changes.status) lines.push("Git：当前目录不是可读取的 Git 仓库，或 git 不可用。");
  if (toolCalls.length) {
    const lastTool = toolCalls.at(-1);
    lines.push(`ChatGPT：已调用 ${toolCalls.length} 次工具，最近是 ${lastTool.toolName}${lastTool.ok ? "" : "（失败）"}。`);
  }
  if (changes.diff && changes.diff.files.length) {
    lines.push(`Diff：${changes.diff.files.map((file) => file.path).slice(0, 8).join(", ")}${changes.diff.files.length > 8 ? " ..." : ""}`);
  }
  if (commands.length) {
    const last = commands[0];
    lines.push(`最近命令：${last.commandRedacted || "(unknown)"}，退出码 ${last.exitCode ?? "unknown"}。`);
  }
  if (latestReply) lines.push(`写回：${latestReply.id}`);
  return lines.length ? lines.join("\n") : NO_CHANGES_SUMMARY;
}

function buildTimeline({ changes, commands, latestReply, toolCalls }) {
  const items = [];
  items.push({ state: "done", label: "已连接项目" });
  for (const event of toolCalls.slice(-8)) {
    items.push({
      ts: event.ts,
      state: event.ok ? "done" : "failed",
      label: event.ok ? `ChatGPT 调用 ${event.toolName}` : `${event.toolName} 调用失败：${event.error || "unknown error"}`,
      source: "tool"
    });
  }
  const entries = changes.status && changes.status.entries ? changes.status.entries : [];
  if (entries.length) items.push({ state: "done", label: `检测到 ${entries.length} 个文件变更`, source: "git" });
  if (commands.length) items.push({ state: "done", label: `最近运行 ${commands.length} 条命令`, source: "command" });
  if (latestReply) items.push({ state: "done", label: "已写回 Codex", source: "reply" });
  if (!entries.length && !commands.length && !latestReply && !toolCalls.length) {
    items.push({ state: "idle", label: "等待 ChatGPT 调用工具", source: "idle" });
  }
  return items;
}

async function readTextPreview(filePath, maxBytes) {
  const buffer = await fs.readFile(filePath);
  return buffer.subarray(0, maxBytes).toString("utf8");
}

async function listProjects(state, currentStatus = null, currentBridgeState = null) {
  await ensureSaneSelectedProject(state);
  const currentCwd = path.resolve(state.cwd);
  const allowed = await listAllowedRoots(configOptions(state)).catch(() => ({ roots: [] }));
  for (const root of allowed.roots || []) addProject(state, root.root);
  const projects = [];
  for (const item of state.projects) {
    const selected = samePath(item.cwd, currentCwd);
    let status = null;
    let bridgeState = null;
    if (selected && currentStatus) {
      status = currentStatus;
      bridgeState = currentBridgeState || computeBridgeState(currentStatus);
    } else {
      status = await safeAppStatus(item.cwd);
      bridgeState = status ? computeBridgeState({
        ...status,
        desktop: {
          mcpServerRunning: Boolean(getStateServer(state, item.cwd))
        }
      }) : { key: "error", label: "连接失效", kind: "bad" };
    }
    const connection = status && status.mcp ? status.mcp.webConnection : null;
    projects.push({
      ...projectInfo(item.cwd),
      selected,
      serverUrl: connection && connection.serverUrl || null,
      connectionCreatedAt: connection && connection.createdAt || null,
      bridgeState
    });
  }
  return projects;
}

async function ensureSaneSelectedProject(state) {
  if (!state || state.initialSelectionChecked) return;
  state.initialSelectionChecked = true;
  if (!state.initialUnsafeDefaultRoot) return;
  const allowed = await listAllowedRoots(configOptions(state)).catch(() => ({ roots: [] }));
  const selected = allowed.lastSelectedProject || (allowed.roots && allowed.roots[0] && allowed.roots[0].root);
  if (!selected) return;
  state.cwd = path.resolve(selected);
  addProject(state, state.cwd);
}

function configOptions(state) {
  return state && state.configDir ? { configDir: state.configDir } : {};
}

async function safeAppStatus(cwd) {
  try {
    return await getAppStatus({ cwd, watcher: null });
  } catch {
    return null;
  }
}

async function validateProjectConnection({ cwd, fetchImpl = fetch } = {}) {
  const identity = getProjectIdentity(cwd || process.cwd());
  const connection = await readWebConnectionStatus({ cwd: identity.projectRoot }).catch(() => null);
  if (!connection || !connection.serverUrl) {
    return {
      ok: false,
      reason: "no recorded Server URL",
      connection: null,
      project: identity
    };
  }

  if (connection.projectFingerprint && connection.projectFingerprint !== identity.projectFingerprint) {
    return {
      ok: false,
      reason: "recorded Server URL belongs to another project",
      connection,
      project: identity,
      storedProjectMatches: false
    };
  }

  let health = null;
  try {
    const response = await fetchImpl(toHealthUrl(connection.serverUrl));
    if (!response.ok) {
      return {
        ok: false,
        reason: `health returned HTTP ${response.status}`,
        connection,
        project: identity
      };
    }
    health = await response.json();
  } catch (error) {
    return {
      ok: false,
      reason: `health check failed: ${error.message || "unknown error"}`,
      connection,
      project: identity
    };
  }

  const version = String(health.packageVersion || health.version || "");
  const projectFingerprint = String(health.projectFingerprint || "");
  const okName = health.ok === true && health.name === "chatgpt-native-bridge";
  const versionMatches = version === pkg.version;
  const projectMatches = projectFingerprint === identity.projectFingerprint;
  const ok = okName && versionMatches && projectMatches;
  return {
    ok,
    reason: ok ? "live" : explainConnectionMismatch({ okName, versionMatches, projectMatches }),
    connection,
    health,
    project: identity,
    versionMatches,
    projectMatches,
    storedProjectMatches: true
  };
}

function explainConnectionMismatch({ okName, versionMatches, projectMatches }) {
  if (!okName) return "health is not chatgpt-native-bridge";
  if (!versionMatches) return "bridge version mismatch";
  if (!projectMatches) return "Server URL belongs to another project";
  return "not reusable";
}

function toHealthUrl(serverUrl) {
  const url = new URL(serverUrl);
  url.pathname = "/health";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function startDesktopMcp({
  cwd,
  appendLog,
  state,
  installCloudflaredImpl = installCloudflared,
  resolveCloudflaredCommandImpl = resolveCloudflaredCommand,
  runCloudflareTunnelImpl = runCloudflareTunnel,
  startMcpHttpServerImpl = startMcpHttpServer,
  checkLocalBridgeHealthImpl = checkLocalBridgeHealth,
  openChatgpt = false
}) {
  let tunnelPort = DEFAULT_TUNNEL_PORT;
  let server = getStateServer(state, cwd);
  if (!server) {
    appendLog(`Starting local bridge on ${DEFAULT_TUNNEL_HOST}:${DEFAULT_TUNNEL_PORT}`);
    try {
      server = await startMcpHttpServerImpl({
        cwd,
        host: DEFAULT_TUNNEL_HOST,
        port: DEFAULT_TUNNEL_PORT
      });
      setStateServer(state, cwd, server);
      tunnelPort = getServerPort(server) || DEFAULT_TUNNEL_PORT;
      appendLog(`Local bridge ready`);
    } catch (error) {
      if (!isAddressInUse(error)) throw error;
      appendLog("Local bridge port is already in use; checking existing bridge");
      const health = normalizeBridgeHealth(await checkLocalBridgeHealthImpl({
        host: DEFAULT_TUNNEL_HOST,
        port: DEFAULT_TUNNEL_PORT,
        cwd
      }), getProjectIdentity(cwd));
      if (health.ok && health.matchesCurrentVersion && health.matchesCurrentProject) {
        server = {
          url: `http://${DEFAULT_TUNNEL_HOST}:${DEFAULT_TUNNEL_PORT}/mcp`,
          external: true,
          close: async () => {}
        };
        setStateServer(state, cwd, server);
        tunnelPort = DEFAULT_TUNNEL_PORT;
        appendLog("Existing local bridge ready");
      } else {
        const versionText = health.version ? `version ${health.version}` : "unknown version";
        const reason = health.matchesCurrentVersion === false
          ? `${versionText}`
          : health.matchesCurrentProject === false
            ? "another project"
            : versionText;
        appendLog(`Existing bridge is ${reason}; starting this project on a temporary port`);
        server = await startMcpHttpServerImpl({
          cwd,
          host: DEFAULT_TUNNEL_HOST,
          port: 0
        });
        setStateServer(state, cwd, server);
        tunnelPort = getServerPort(server);
        if (!tunnelPort) throw new Error("无法读取本地 bridge 临时端口。");
        appendLog(`Local bridge ready on temporary port ${tunnelPort}`);
      }
    }
  } else {
    tunnelPort = getServerPort(server) || DEFAULT_TUNNEL_PORT;
  }

  let cloudflared = await resolveCloudflaredCommandImpl({ cwd });
  if (!cloudflared) {
    appendLog("Installing secure tunnel helper");
    await installCloudflaredImpl({
      cwd,
      stdout: writer((line) => appendLog(line)),
      stderr: writer((line) => appendLog(line))
    });
    cloudflared = await resolveCloudflaredCommandImpl({ cwd });
  }
  if (!cloudflared) throw new Error("无法启动安全通道。请使用 Pro 辅助规划或 Markdown 备用路径。");

  appendLog("Starting ChatGPT connection");
  runCloudflareTunnelImpl({
    cwd,
    host: DEFAULT_TUNNEL_HOST,
    port: tunnelPort,
    command: cloudflared,
    openChatgpt,
    stdout: writer((line) => appendLog(line)),
    stderr: writer((line) => appendLog(line))
  }).catch((error) => appendLog(`ChatGPT connection stopped: ${error.message}`));
}

function isAddressInUse(error) {
  return Boolean(
    error &&
    (error.code === "EADDRINUSE" || /EADDRINUSE|address already in use/i.test(error.message || ""))
  );
}

async function checkLocalBridgeHealth({ host, port, cwd = process.cwd() }) {
  const currentVersion = pkg.version;
  const identity = getProjectIdentity(cwd);
  try {
    const response = await fetch(`http://${host}:${port}/health`);
    if (!response.ok) return {
      ok: false,
      version: "",
      currentVersion,
      matchesCurrentVersion: false,
      matchesCurrentProject: false
    };
    const data = await response.json();
    const version = String(data.packageVersion || data.version || "");
    const ok = data && data.ok === true && data.name === "chatgpt-native-bridge";
    const projectFingerprint = String(data.projectFingerprint || "");
    const projectRoot = String(data.projectRoot || "");
    return {
      ok,
      version,
      currentVersion,
      projectRoot,
      projectFingerprint,
      matchesCurrentVersion: ok && version === currentVersion,
      matchesCurrentProject: ok && projectFingerprint === identity.projectFingerprint
    };
  } catch {
    return {
      ok: false,
      version: "",
      currentVersion,
      matchesCurrentVersion: false,
      matchesCurrentProject: false
    };
  }
}

function normalizeBridgeHealth(health, identity = null) {
  if (health === true) {
    return {
      ok: true,
      version: pkg.version,
      currentVersion: pkg.version,
      projectRoot: identity ? identity.projectRoot : "",
      projectFingerprint: identity ? identity.projectFingerprint : "",
      matchesCurrentVersion: true,
      matchesCurrentProject: true
    };
  }
  if (!health || typeof health !== "object") {
    return {
      ok: false,
      version: "",
      currentVersion: pkg.version,
      projectRoot: "",
      projectFingerprint: "",
      matchesCurrentVersion: false,
      matchesCurrentProject: false
    };
  }
  const projectFingerprint = String(health.projectFingerprint || "");
  const expectedFingerprint = identity ? identity.projectFingerprint : "";
  return {
    ok: Boolean(health.ok),
    version: String(health.version || ""),
    currentVersion: String(health.currentVersion || pkg.version),
    projectRoot: String(health.projectRoot || ""),
    projectFingerprint,
    matchesCurrentVersion: Boolean(health.matchesCurrentVersion),
    matchesCurrentProject: typeof health.matchesCurrentProject === "boolean"
      ? health.matchesCurrentProject
      : Boolean(expectedFingerprint && projectFingerprint === expectedFingerprint)
  };
}

function getServerPort(server) {
  try {
    return Number(new URL(server.url).port);
  } catch {
    return 0;
  }
}

function addProject(state, cwd) {
  const resolved = path.resolve(cwd);
  if (!state.projects.some((project) => samePath(project.cwd, resolved))) {
    state.projects.push({ cwd: resolved });
  }
}

function getStateServer(state, cwd) {
  if (!state.mcpServers) return state.mcpServer;
  const key = getProjectIdentity(cwd).projectFingerprint;
  return state.mcpServers.get(key) || null;
}

function setStateServer(state, cwd, server) {
  state.mcpServer = server;
  if (!state.mcpServers) return;
  const key = getProjectIdentity(cwd).projectFingerprint;
  state.mcpServers.set(key, server);
}

function samePath(a, b) {
  const left = path.resolve(a);
  const right = path.resolve(b);
  if (process.platform === "win32") return left.toLowerCase() === right.toLowerCase();
  return left === right;
}

function isUnsafeDefaultRoot(cwd) {
  const value = String(cwd || "");
  const normalized = value.replace(/\//g, "\\").toLowerCase();
  if (/^[a-z]:\\windows\\system32\\?$/.test(normalized)) return true;
  const windir = String(process.env.WINDIR || process.env.SystemRoot || "").replace(/\//g, "\\").toLowerCase();
  return Boolean(windir && normalized === `${windir}\\system32`);
}

function describeProPack(pack = {}) {
  return [
    "已打包项目根目录、顶层文件、Git 状态和当前 diff（如有）。",
    "Pro 只能读取这份上下文，不能直接访问本地项目。",
    pack.promptPath ? `上下文文件：${pack.promptPath}` : ""
  ].filter(Boolean).join("\n");
}

async function projectPermissions(cwd, state) {
  const allowed = await isRootAllowed(cwd, configOptions(state)).catch(() => ({ allowed: false }));
  return {
    project: projectInfo(cwd),
    permissions: {
      shell: true,
      fileWrite: true
    },
    trusted: allowed.allowed,
    status: allowed.allowed ? "trusted" : "runtime-project"
  };
}

function writer(writeLine) {
  return {
    write(chunk) {
      const text = String(chunk || "").trim();
      if (!text) return;
      for (const line of text.split(/\r?\n/)) writeLine(line);
    }
  };
}

function projectInfo(cwd) {
  const identity = getProjectIdentity(cwd);
  return {
    cwd: identity.projectRoot,
    name: identity.projectName,
    projectFingerprint: identity.projectFingerprint
  };
}

async function invokeDesktopHandler(handlers, channel, payload) {
  const handler = handlers[channel];
  if (!handler) return { ok: false, error: `Unknown desktop IPC channel: ${channel}` };
  try {
    const data = await handler(payload || {});
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || "Desktop action failed." };
  }
}

module.exports = {
  CHATGPT_REVIEW_PROMPT,
  CHATGPT_URL,
  CONTINUE_PROMPT,
  computeBridgeState,
  createDesktopHandlers,
  checkLocalBridgeHealth,
  isUnsafeDefaultRoot,
  invokeDesktopHandler,
  projectInfo,
  normalizeBridgeHealth,
  startDesktopMcp,
  validateProjectConnection
};
