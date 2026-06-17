const state = {
  currentRelayId: "",
  busy: false
};

const $ = (id) => document.getElementById(id);

function setBusy(value) {
  state.busy = value;
  for (const button of document.querySelectorAll("button")) {
    button.disabled = value;
  }
}

function log(line) {
  const diagnostics = $("diagnostics");
  const stamp = new Date().toLocaleTimeString();
  diagnostics.textContent = `${stamp} ${line}\n${diagnostics.textContent}`;
}

async function call(channel, payload) {
  const result = await window.bridge.invoke(channel, payload || {});
  if (!result.ok) throw new Error(result.error || "操作失败。");
  return result.data;
}

function setStatus(id, text, kind) {
  const node = $(id);
  node.textContent = text;
  node.className = kind || "";
}

async function refresh() {
  const status = await call("status:get");
  const project = status.project || {};
  $("projectPath").textContent = project.cwd || status.cwd || "未选择项目";

  const ready = status.doctor && status.doctor.ready;
  setStatus("codexState", ready ? "就绪" : "需初始化", ready ? "ok" : "warn");

  const bridge = status.bridgeState || { key: "disconnected", label: "未连接", kind: "warn" };
  setStatus("bridgeState", bridge.label, bridge.kind);
  updateMainAction(bridge.key);

  const latest = status.relay && status.relay.latest;
  if (latest && latest.id) state.currentRelayId = latest.id;

  const hasReply = Boolean(
    status.handoff && status.handoff.latestReady ||
    latest && latest.state === "imported"
  );
  setStatus("replyState", hasReply ? "已写回" : "暂无", hasReply ? "ok" : "warn");

  if (status.relay && status.relay.watcher) {
    setStatus("proState", "等待回复", "warn");
  } else if (latest && latest.state === "imported") {
    setStatus("proState", "已导入", "ok");
  } else {
    setStatus("proState", "辅助", "warn");
  }

  const serverUrl = status.mcp && status.mcp.webConnection && status.mcp.webConnection.serverUrl;
  if (serverUrl) {
    logOnce("server-url-ready", "已复制连接地址，请在 ChatGPT 创建或刷新工具。");
  }
}

function updateMainAction(key) {
  if (key === "written") {
    $("nextActionTitle").textContent = "交给 Codex";
    $("nextActionText").textContent = "ChatGPT 的建议已经写回本地。点击“交给 Codex”，再粘贴到 Codex 继续执行。";
    return;
  }
  if (key === "called") {
    $("nextActionTitle").textContent = "等待写回";
    $("nextActionText").textContent = "ChatGPT 已经调用工具。等它完成后，回到这里交给 Codex。";
    return;
  }
  if (key === "connected") {
    $("nextActionTitle").textContent = "开始复核";
    $("nextActionText").textContent = "连接已准备好。点击“开始复核”，把复制好的话发给 ChatGPT。";
    return;
  }
  $("nextActionTitle").textContent = "连接 ChatGPT";
  $("nextActionText").textContent = "先连接 ChatGPT 工具。连接后，让 ChatGPT 复核当前项目并写回 Codex。";
}

const logged = new Set();
function logOnce(key, line) {
  if (logged.has(key)) return;
  logged.add(key);
  log(line);
}

async function run(action) {
  if (state.busy) return;
  setBusy(true);
  try {
    await action();
    await refresh();
  } catch (error) {
    log(error.message || "操作失败。");
  } finally {
    setBusy(false);
  }
}

$("connectChatGPT").addEventListener("click", () => run(async () => {
  await call("mcp:start");
  log("正在连接 ChatGPT。连接状态变为“已连接”后，去 ChatGPT 创建或刷新工具。");
}));

$("copyChatGPTPrompt").addEventListener("click", () => run(async () => {
  const result = await call("chatgpt:copy-review-prompt");
  log(`已复制给 ChatGPT：${result.text}`);
}));

$("copyCodex").addEventListener("click", () => run(async () => {
  const result = await call("codex:copy-continue-prompt");
  log(`已复制给 Codex：${result.text}`);
}));

$("proPlan").addEventListener("click", () => run(async () => {
  const pack = await call("pro:create-pack", {
    task: $("taskInput").value,
    includeDiff: true,
    openChatgpt: true
  });
  state.currentRelayId = pack.id;
  log(`已复制 Pro 上下文：${pack.id}`);
}));

$("startProWatch").addEventListener("click", () => run(async () => {
  if (!state.currentRelayId) throw new Error("请先复制 Pro 上下文。");
  await call("pro:start-watch", { id: state.currentRelayId });
  log("正在等待 Pro 回复。复制 Pro 回复后会自动导入。");
}));

$("manualImport").addEventListener("click", () => run(async () => {
  const text = $("manualReply").value.trim();
  if (!text) throw new Error("请先粘贴 Pro 回复。");
  if (!state.currentRelayId) throw new Error("请先复制 Pro 上下文。");
  const imported = await call("pro:manual-import", {
    id: state.currentRelayId,
    text
  });
  log(`已导入：${imported.codexReadThisPath}`);
}));

$("selectProject").addEventListener("click", () => run(async () => {
  const project = await call("project:select");
  log(`已选择项目：${project.cwd}`);
}));

$("openChatGPT").addEventListener("click", () => run(async () => {
  await call("chatgpt:open");
  log("已打开 ChatGPT。");
}));

refresh().catch((error) => log(error.message));
setInterval(() => refresh().catch(() => {}), 5000);
