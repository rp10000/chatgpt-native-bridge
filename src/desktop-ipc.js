const path = require("node:path");

const { getAppStatus } = require("./app-server");
const { startClipboardWatch } = require("./clipboard-watch");
const { startMcpHttpServer } = require("./mcp-server");
const {
  DEFAULT_TUNNEL_HOST,
  DEFAULT_TUNNEL_PORT,
  installCloudflared,
  resolveCloudflaredCommand,
  runCloudflareTunnel
} = require("./mcp-web");
const { getMcpTrace } = require("./mcp-trace");
const { createProPack, getLatestProRelayState, importProReply } = require("./pro-relay");

const CHATGPT_URL = "https://chatgpt.com";
const CONTINUE_PROMPT = "读取最新 Bridge 回复，然后继续执行。";

function createDesktopHandlers(options = {}) {
  const state = {
    cwd: path.resolve(options.cwd || process.cwd()),
    watcher: null,
    mcpServer: null,
    mcpStarting: null,
    mcpLog: []
  };
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
      return projectInfo(state.cwd);
    },

    async "project:select"(payload = {}) {
      const selected = payload.path || (options.selectDirectoryImpl && await options.selectDirectoryImpl());
      if (!selected) return projectInfo(state.cwd);
      state.cwd = path.resolve(selected);
      if (state.watcher) {
        state.watcher.stop("project changed");
        state.watcher = null;
      }
      return projectInfo(state.cwd);
    },

    async "status:get"() {
      const status = await getAppStatus({ cwd: state.cwd, watcher: state.watcher });
      return {
        ...status,
        project: projectInfo(state.cwd),
        desktop: {
          mcpLog: state.mcpLog,
          mcpServerRunning: Boolean(state.mcpServer),
          clipboardWatcher: state.watcher ? state.watcher.publicState() : null
        }
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
      if (payload.openChatgpt !== false) {
        await shell.openExternal(CHATGPT_URL);
      }
      return {
        id: pack.id,
        task: pack.task,
        promptPath: pack.promptPath,
        copied: pack.copied
      };
    },

    async "pro:start-watch"(payload = {}) {
      let id = String(payload.id || "").trim();
      if (!id) {
        const latest = await getLatestProRelayState(state.cwd);
        id = latest && latest.id;
      }
      if (!id) throw new Error("请先生成 Pro 深度规划。");
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

    async "mcp:start"() {
      if (!state.mcpStarting) {
        state.mcpStarting = startDesktopMcp({
          cwd: state.cwd,
          appendLog: appendMcpLog,
          state,
          installCloudflaredImpl: options.installCloudflaredImpl,
          resolveCloudflaredCommandImpl: options.resolveCloudflaredCommandImpl,
          runCloudflareTunnelImpl: options.runCloudflareTunnelImpl,
          startMcpHttpServerImpl: options.startMcpHttpServerImpl
        }).finally(() => {
          state.mcpStarting = null;
        });
      }
      await state.mcpStarting;
      return {
        started: true,
        mcpServerRunning: Boolean(state.mcpServer),
        log: state.mcpLog
      };
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
      if (state.mcpServer) await state.mcpServer.close();
      state.mcpServer = null;
    }
  };
}

async function startDesktopMcp({
  cwd,
  appendLog,
  state,
  installCloudflaredImpl = installCloudflared,
  resolveCloudflaredCommandImpl = resolveCloudflaredCommand,
  runCloudflareTunnelImpl = runCloudflareTunnel,
  startMcpHttpServerImpl = startMcpHttpServer
}) {
  if (!state.mcpServer) {
    appendLog(`Starting local MCP server on ${DEFAULT_TUNNEL_HOST}:${DEFAULT_TUNNEL_PORT}`);
    state.mcpServer = await startMcpHttpServerImpl({
      cwd,
      host: DEFAULT_TUNNEL_HOST,
      port: DEFAULT_TUNNEL_PORT
    });
    appendLog(`Local MCP server ready: ${state.mcpServer.url}`);
  }

  let cloudflared = await resolveCloudflaredCommandImpl({ cwd });
  if (!cloudflared) {
    appendLog("cloudflared not found; installing");
    await installCloudflaredImpl({
      cwd,
      stdout: writer((line) => appendLog(line)),
      stderr: writer((line) => appendLog(line))
    });
    cloudflared = await resolveCloudflaredCommandImpl({ cwd });
  }
  if (!cloudflared) throw new Error("cloudflared is not available.");

  appendLog("Starting ChatGPT HTTPS tunnel");
  runCloudflareTunnelImpl({
    cwd,
    host: DEFAULT_TUNNEL_HOST,
    port: DEFAULT_TUNNEL_PORT,
    command: cloudflared,
    openChatgpt: true,
    stdout: writer((line) => appendLog(line)),
    stderr: writer((line) => appendLog(line))
  }).catch((error) => appendLog(`MCP tunnel stopped: ${error.message}`));
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
  return {
    cwd,
    name: path.basename(cwd)
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
  CHATGPT_URL,
  CONTINUE_PROMPT,
  createDesktopHandlers,
  invokeDesktopHandler,
  projectInfo,
  startDesktopMcp
};
