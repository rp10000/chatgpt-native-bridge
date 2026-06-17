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

  const latest = status.relay && status.relay.latest;
  if (latest && latest.id) state.currentRelayId = latest.id;

  if (latest && latest.state === "imported") {
    setStatus("replyState", "已写回", "ok");
    setStatus("proState", "已完成", "ok");
    $("nextActionTitle").textContent = "交给 Codex 继续";
    $("nextActionText").textContent = "回复已经写入本地 inbox。点击“写回 Codex”复制一句话，贴给 Codex 继续执行。";
  } else if (status.relay && status.relay.watcher) {
    setStatus("replyState", "监听中", "warn");
    setStatus("proState", "等 Pro 回复", "warn");
  } else if (latest) {
    setStatus("replyState", "待复制回复", "warn");
    setStatus("proState", "提示词已复制", "warn");
  } else {
    setStatus("replyState", "暂无", "warn");
    setStatus("proState", "待开始", "warn");
  }

  const mcp = status.mcp || {};
  if (mcp.latestToolCall || (mcp.toolCallCount && mcp.toolCallCount > 0)) {
    setStatus("mcpState", "已调用", "ok");
  } else if ((status.desktop && status.desktop.mcpServerRunning) || mcp.webConnection) {
    setStatus("mcpState", "已准备", "warn");
  } else {
    setStatus("mcpState", "未连接", "warn");
  }
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

$("proPlan").addEventListener("click", () => run(async () => {
  const pack = await call("pro:create-pack", {
    task: $("taskInput").value,
    includeDiff: true,
    openChatgpt: true
  });
  state.currentRelayId = pack.id;
  log(`已复制 Pro 提示词：${pack.id}`);
  await call("pro:start-watch", { id: pack.id });
  log("已开始监听剪贴板。复制 Pro 回复后会自动写回。");
}));

$("thinkingReview").addEventListener("click", () => run(async () => {
  const result = await call("mcp:start");
  log(result.log && result.log.length ? result.log.at(-1) : "Thinking 连接已启动。");
}));

$("copyCodex").addEventListener("click", () => run(async () => {
  const result = await call("codex:copy-continue-prompt");
  log(`已复制给 Codex：${result.text}`);
}));

$("manualImport").addEventListener("click", () => run(async () => {
  const text = $("manualReply").value.trim();
  if (!text) throw new Error("请先粘贴 Pro 回复。");
  if (!state.currentRelayId) throw new Error("请先生成一次 Pro 深度规划。");
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
