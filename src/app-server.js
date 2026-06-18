const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");

const { readFromClipboard } = require("./clipboard");
const { WATCH_TIMEOUT_MS, startClipboardWatch } = require("./clipboard-watch");
const { getDoctorReport } = require("./doctor");
const { getStatus } = require("./status");
const { getMcpTrace } = require("./mcp-trace");
const {
  createProPack,
  getLatestProRelayState,
  importProReply
} = require("./pro-relay");
const pkg = require("../package.json");

const DEFAULT_APP_HOST = "127.0.0.1";
const DEFAULT_APP_PORT = 47833;
const CHATGPT_URL = "https://chatgpt.com";
function formatAppDryRun({ host = DEFAULT_APP_HOST, port = DEFAULT_APP_PORT } = {}) {
  return `chatgpt-native-bridge local GUI

Run:
  cgn app

This will open:
  http://${host}:${port}

What it does:
  - Shows current project, MCP trace, and latest Codex inbox state.
  - Creates a GPT-5.5 Pro packaged-context helper pack.
  - Copies the Pro prompt to clipboard.
  - Watches clipboard only after you click Start Clipboard Watch.
  - Imports a matching CGN_BRIDGE_REPLY back into .chatgpt-native/inbox.

Safety:
  No API key. No browser plugin. No ChatGPT scraping. No hidden web calls.
  Clipboard watch is opt-in, local, id-bound, and times out after 20 minutes.
`;
}

async function startAppServer(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const host = options.host || DEFAULT_APP_HOST;
  const port = Number(options.port ?? DEFAULT_APP_PORT);
  const openBrowser = options.openBrowser !== false;
  const stdout = options.stdout || process.stdout;
  const openUrlImpl = options.openUrlImpl || openUrl;
  const readFromClipboardImpl = options.readFromClipboardImpl || readFromClipboard;
  let watcher = null;

  const server = http.createServer(async (req, res) => {
    try {
      setHeaders(res);
      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }

      const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
      if (req.method === "GET" && url.pathname === "/") {
        sendHtml(res, renderAppHtml());
        return;
      }

      if (req.method === "GET" && url.pathname === "/assets/avatar.png") {
        await sendAvatar(res);
        return;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, {
          ok: true,
          name: "chatgpt-native-bridge",
          app: "clipboard-relay-gui",
          version: pkg.version,
          packageVersion: pkg.version
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        sendJson(res, await getAppStatus({ cwd, watcher }));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/pro-pack") {
        const body = await readJsonBody(req);
        const pack = await createProPack({
          cwd,
          task: body.task,
          includeDiff: body.includeDiff !== false,
          maxBytes: body.maxBytes,
          copyToClipboardImpl: options.copyToClipboardImpl
        });
        sendJson(res, {
          id: pack.id,
          task: pack.task,
          promptPath: pack.promptPath,
          copied: pack.copied,
          prompt: pack.prompt
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/clipboard-watch/start") {
        const body = await readJsonBody(req);
        const id = String(body.id || "").trim();
        if (!id) throw new Error("id is required");
        if (watcher) watcher.stop("replaced");
        watcher = startClipboardWatch({
          cwd,
          id,
          timeoutMs: body.timeoutMs || WATCH_TIMEOUT_MS,
          readFromClipboardImpl,
          onImported: () => {
            watcher = null;
          }
        });
        sendJson(res, watcher.publicState());
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/clipboard/import") {
        const body = await readJsonBody(req);
        const result = await importProReply({ cwd, id: body.id, text: body.text });
        sendJson(res, {
          imported: true,
          id: result.id,
          replyPath: result.replyPath,
          codexReadThisPath: result.codexReadThisPath
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/open-chatgpt") {
        openUrlImpl(CHATGPT_URL);
        sendJson(res, { opened: true, url: CHATGPT_URL });
        return;
      }

      sendJson(res, { error: "Not found" }, 404);
    } catch (error) {
      sendJson(res, { error: error.message || "Internal server error" }, 500);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  const url = `http://${host}:${boundPort}`;
  if (openBrowser) openUrlImpl(url);
  stdout.write(`chatgpt-native-bridge GUI running\n`);
  stdout.write(`URL: ${url}\n`);
  stdout.write("Press Ctrl+C to stop.\n");

  return {
    url,
    close: async () => {
      if (watcher) watcher.stop("server closed");
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

async function getAppStatus({ cwd, watcher }) {
  const doctor = await getDoctorReport({ cwd });
  const status = await getStatus({ cwd });
  let trace = null;
  try {
    const rawTrace = await getMcpTrace({ cwd, limit: 5 });
    trace = {
      webConnection: rawTrace.webConnection,
      requestCount: rawTrace.requestCount,
      toolCallCount: rawTrace.toolCallCount,
      latestRequest: rawTrace.latestRequest,
      latestToolCall: rawTrace.latestToolCall,
      latestSuccessfulToolCall: rawTrace.latestSuccessfulToolCall,
      latestFailedToolCall: rawTrace.latestFailedToolCall,
      hasHttpAccess: rawTrace.hasHttpAccess,
      hasToolsCallRequest: rawTrace.hasToolsCallRequest,
      lastError: rawTrace.lastError
    };
  } catch (error) {
    trace = { error: error.message };
  }
  const requiredMissing = doctor.checks.filter((check) => check.required !== false && !check.ok);

  return {
    cwd,
    packageVersion: pkg.version,
    doctor: {
      ready: requiredMissing.length === 0,
      checks: doctor.checks
    },
    setupState: {
      ready: requiredMissing.length === 0,
      label: requiredMissing.length === 0 ? "本地设置就绪" : "本地设置待补全",
      missingRequired: requiredMissing.map((check) => check.name || check.id || check.label || "unknown")
    },
    handoff: {
      pending: status.pending,
      ready: status.ready,
      latestReady: status.ready.at(-1) || null
    },
    mcp: trace,
    relay: {
      latest: await getLatestProRelayState(cwd),
      watcher: watcher ? watcher.publicState() : null
    }
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

function setHeaders(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

function sendHtml(res, html) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

async function sendAvatar(res) {
  const avatarPath = path.join(__dirname, "..", "docs", "assets", "gui", "avatar.png");
  try {
    const image = await fs.readFile(avatarPath);
    res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
    res.end(image);
  } catch {
    res.writeHead(404).end();
  }
}

function openUrl(url) {
  if (process.platform === "win32") {
    spawnSync("cmd.exe", ["/c", "start", "", url], { stdio: "ignore", windowsHide: true });
    return;
  }
  if (process.platform === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
    return;
  }
  spawnSync("xdg-open", [url], { stdio: "ignore" });
}

function renderAppHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>chatgpt-native-bridge</title>
  <style>
    :root {
      color-scheme: light;
      --yellow: #ffc400;
      --ink: #14101f;
      --panel: #1c172a;
      --blue: #295bff;
      --pink: #ff3d94;
      --soft: #fff4cf;
      --line: rgba(255,255,255,.14);
      --text: #fff8df;
      --muted: rgba(255,248,223,.72);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--yellow);
      color: var(--text);
      letter-spacing: 0;
    }
    main {
      width: min(460px, 100vw);
      min-height: 100vh;
      background: linear-gradient(180deg, #211936 0%, #100d19 100%);
      border-right: 1px solid rgba(20,16,31,.22);
      box-shadow: 18px 0 60px rgba(20,16,31,.28);
      padding: 18px;
    }
    header {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 18px;
    }
    .avatar {
      width: 54px;
      height: 54px;
      border-radius: 8px;
      object-fit: cover;
      border: 2px solid var(--yellow);
      box-shadow: 0 0 0 3px rgba(41,91,255,.28);
      flex: 0 0 auto;
    }
    h1 {
      font-size: 19px;
      line-height: 1.1;
      margin: 0;
    }
    .subtitle {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 12px;
    }
    .status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }
    .tile, .section {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255,255,255,.06);
      padding: 12px;
    }
    .tile strong {
      display: block;
      font-size: 12px;
      color: var(--muted);
      font-weight: 600;
      margin-bottom: 5px;
    }
    .tile span {
      font-size: 14px;
      font-weight: 700;
    }
    .ok { color: #7cffcb; }
    .warn { color: #ffd36b; }
    .bad { color: #ff7d98; }
    .section { margin-top: 10px; }
    .section h2 {
      margin: 0 0 9px;
      font-size: 14px;
    }
    label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 6px;
    }
    textarea, input {
      width: 100%;
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 8px;
      background: rgba(5,4,10,.72);
      color: var(--text);
      padding: 10px;
      font: inherit;
      font-size: 13px;
      resize: vertical;
    }
    textarea { min-height: 96px; }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    button {
      min-height: 38px;
      border: 0;
      border-radius: 8px;
      padding: 0 13px;
      background: var(--yellow);
      color: var(--ink);
      font-weight: 800;
      cursor: pointer;
    }
    button.secondary {
      background: var(--blue);
      color: white;
    }
    button.ghost {
      background: rgba(255,255,255,.1);
      color: var(--text);
      border: 1px solid var(--line);
    }
    pre {
      max-height: 180px;
      overflow: auto;
      white-space: pre-wrap;
      border-radius: 8px;
      padding: 10px;
      background: rgba(0,0,0,.35);
      color: var(--soft);
      font-size: 12px;
      line-height: 1.45;
    }
    .hint {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <img class="avatar" src="/assets/avatar.png" alt="">
      <div>
        <h1>chatgpt-native-bridge</h1>
        <p class="subtitle">Pro clipboard relay for Codex</p>
      </div>
    </header>

    <section class="status-grid">
      <div class="tile"><strong>Codex</strong><span id="codexState">checking</span></div>
      <div class="tile"><strong>Relay</strong><span id="relayState">idle</span></div>
      <div class="tile"><strong>MCP</strong><span id="mcpState">checking</span></div>
      <div class="tile"><strong>Inbox</strong><span id="inboxState">none</span></div>
    </section>

    <section class="section">
      <h2>Pro 辅助规划</h2>
      <label for="task">Task for GPT-5.5 Pro</label>
      <textarea id="task">Review this project and produce a concise implementation plan for Codex.</textarea>
      <div class="actions">
        <button id="createPack">Copy Pro Prompt</button>
        <button class="secondary" id="openChatgpt">Open ChatGPT</button>
        <button class="ghost" id="watchClipboard">Start Clipboard Watch</button>
      </div>
      <p class="hint">Paste the copied prompt into GPT-5.5 Pro. After Pro replies, click ChatGPT's copy button. This app imports only replies with the matching CGN_BRIDGE_REPLY id.</p>
    </section>

    <section class="section">
      <h2>Manual Fallback</h2>
      <label for="reply">Paste Pro reply if clipboard watch misses it</label>
      <textarea id="reply"></textarea>
      <div class="actions">
        <button class="secondary" id="importReply">Send to Codex</button>
      </div>
    </section>

    <section class="section">
      <h2>Log</h2>
      <pre id="log">Ready.</pre>
    </section>
  </main>

  <script>
    let currentId = "";
    const $ = (id) => document.getElementById(id);
    const log = (line) => {
      $("log").textContent = new Date().toLocaleTimeString() + " " + line + "\\n" + $("log").textContent;
    };
    async function api(path, options) {
      const res = await fetch(path, {
        ...options,
        headers: { "content-type": "application/json", ...(options && options.headers || {}) }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json;
    }
    async function refresh() {
      const status = await api("/api/status");
      $("codexState").textContent = status.doctor.ready ? "ready" : "setup";
      $("codexState").className = status.doctor.ready ? "ok" : "warn";
      const latest = status.relay.latest;
      currentId = latest && latest.id || currentId;
      $("relayState").textContent = status.relay.watcher ? status.relay.watcher.state : latest ? latest.state : "idle";
      $("relayState").className = status.relay.latest && status.relay.latest.state === "imported" ? "ok" : "warn";
      $("mcpState").textContent = status.mcp && status.mcp.latestToolCall ? "called" : status.mcp && status.mcp.webConnection ? "url ready" : "not linked";
      $("mcpState").className = status.mcp && status.mcp.latestToolCall ? "ok" : "warn";
      $("inboxState").textContent = status.handoff.latestReady ? "ready" : "none";
      $("inboxState").className = status.handoff.latestReady ? "ok" : "warn";
      if (status.relay.latest && status.relay.latest.codexReadThisPath) {
        log("Latest Codex file: " + status.relay.latest.codexReadThisPath);
      }
    }
    $("createPack").onclick = async () => {
      const result = await api("/api/pro-pack", {
        method: "POST",
        body: JSON.stringify({ task: $("task").value })
      });
      currentId = result.id;
      log("Copied Pro prompt: " + result.id);
      refresh();
    };
    $("openChatgpt").onclick = async () => {
      await api("/api/open-chatgpt", { method: "POST", body: "{}" });
      log("Opened ChatGPT.");
    };
    $("watchClipboard").onclick = async () => {
      if (!currentId) throw new Error("Create a Pro prompt first.");
      const result = await api("/api/clipboard-watch/start", {
        method: "POST",
        body: JSON.stringify({ id: currentId })
      });
      log("Watching clipboard for " + result.id);
      refresh();
    };
    $("importReply").onclick = async () => {
      if (!currentId) throw new Error("Create a Pro prompt first.");
      const result = await api("/api/clipboard/import", {
        method: "POST",
        body: JSON.stringify({ id: currentId, text: $("reply").value })
      });
      log("Imported reply: " + result.codexReadThisPath);
      refresh();
    };
    refresh().catch((error) => log(error.message));
    setInterval(() => refresh().catch(() => {}), 5000);
  </script>
</body>
</html>`;
}

module.exports = {
  DEFAULT_APP_HOST,
  DEFAULT_APP_PORT,
  formatAppDryRun,
  getAppStatus,
  renderAppHtml,
  startAppServer,
  startClipboardWatch
};
