const state = {
  currentRelayId: "",
  busy: false,
  lastStatus: null
};

const $ = (id) => document.getElementById(id);

const STATUS_COPY = {
  disconnected: {
    title: "未连接",
    text: "选择项目后连接 ChatGPT。"
  },
  connected: {
    title: "已连接",
    text: "在 ChatGPT 里刷新或选择这个工具，然后发送任务。"
  },
  accessed: {
    title: "ChatGPT 已访问",
    text: "ChatGPT 已经看到工具，发送任务后这里会显示操作记录。"
  },
  called: {
    title: "ChatGPT 正在操作",
    text: "ChatGPT 正在读取、修改或运行当前项目。"
  },
  reported: {
    title: "已生成交接报告",
    text: "Codex 可以读取报告，复核变更、运行测试并提交。"
  },
  error: {
    title: "需要处理",
    text: "连接失效或请求的项目不是当前项目。"
  }
};

function setBusy(value) {
  state.busy = value;
  for (const button of document.querySelectorAll("button")) button.disabled = value;
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

async function refresh() {
  const status = await call("status:get");
  state.lastStatus = status;
  renderProject(status.project || {});
  renderBridgeState(status.bridgeState || { key: "disconnected", label: "未连接", kind: "warn" });
  await refreshActivity();

  const latest = status.relay && status.relay.latest;
  if (latest && latest.id) state.currentRelayId = latest.id;
  if (latest && latest.promptPath) $("proSummary").textContent = `上次备用上下文：${latest.id}`;
}

function renderProject(project) {
  $("projectName").textContent = project.name || "当前项目";
  $("projectPath").textContent = project.cwd || "未选择项目";
}

function renderBridgeState(bridge) {
  const key = bridge.key || "disconnected";
  const copy = STATUS_COPY[key] || STATUS_COPY.disconnected;
  $("statusTitle").textContent = bridge.label || copy.title;
  $("statusText").textContent = copy.text;
  $("statusLamp").className = `status-lamp status-${key}`;
}

async function refreshActivity() {
  const [commands, changes, trace] = await Promise.all([
    call("command:list"),
    call("changes:get"),
    call("mcp:trace").catch(() => null)
  ]);

  const toolCalls = Array.isArray(changes.toolCalls) && changes.toolCalls.length
    ? changes.toolCalls
    : trace && Array.isArray(trace.toolCalls)
      ? trace.toolCalls
      : [];
  const commandRows = Array.isArray(commands.commands) ? commands.commands : [];
  const changedFiles = Array.isArray(changes.files) ? changes.files : [];
  const latestReply = changes.latestReply || null;

  $("toolCallCount").textContent = String(toolCalls.length);
  $("commandCount").textContent = String(commandRows.length);
  $("changeCount").textContent = String(changedFiles.length);
  $("reportState").textContent = latestReply ? "已生成" : "暂无";

  renderToolCalls(toolCalls);
  renderCommands(commandRows, changes.commandPanel || commands);
  renderChanges(changes);
  renderReply(latestReply);
}

function renderToolCalls(toolCalls) {
  if (!toolCalls.length) {
    $("toolCalls").textContent = "暂无调用。";
    return;
  }
  $("toolCalls").textContent = toolCalls
    .slice(-12)
    .map((call) => {
      const status = call.ok === false ? `失败：${call.error || "unknown error"}` : "成功";
      return `${call.ts || ""}  ${call.toolName || call.name || "tool"}  ${status}`;
    })
    .join("\n");
}

function renderCommands(commands, commandPanel = {}) {
  if (!commands.length) {
    const fallback = Array.isArray(commandPanel.fallbackItems) && commandPanel.fallbackItems.length
      ? commandPanel.fallbackItems.map((item) => `${item.ts || ""}  ${item.toolName || "tool"}  ${item.ok === false ? "失败" : "成功"}`).join("\n")
      : commandPanel.message || "暂无命令。";
    $("commandOutput").textContent = fallback;
    return;
  }
  $("commandOutput").textContent = commands.slice(0, 8).map((command) => [
    `$ ${command.commandRedacted || "(unknown)"}`,
    `exit: ${command.exitCode ?? "unknown"}  time: ${command.durationMs ?? 0}ms`,
    command.stdoutPreview ? `stdout: ${command.stdoutPreview}` : "",
    command.stderrPreview ? `stderr: ${command.stderrPreview}` : ""
  ].filter(Boolean).join("\n")).join("\n\n");
}

function renderChanges(changes) {
  const lines = [changes.summary || "暂无变更。"];
  if (Array.isArray(changes.files) && changes.files.length) {
    lines.push("", "文件：");
    for (const file of changes.files.slice(0, 16)) lines.push(`${file.code || ""} ${file.path}`);
  } else if (changes.git && changes.git.clean) {
    lines.push("", "Git clean，未检测到工作区变更。");
  }
  $("changeSummary").textContent = lines.join("\n");
}

function renderReply(reply) {
  if (!reply) {
    $("replyPreview").textContent = "暂无报告。";
    return;
  }
  $("replyPreview").textContent = [
    reply.id,
    reply.codexReadThisPath,
    reply.replyPath,
    "",
    reply.text || ""
  ].filter(Boolean).join("\n");
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
  const result = await call("mcp:connect-or-refresh");
  log(result.message || (result.reused ? "已复用当前项目连接。" : "正在创建新的项目连接。"));
}));

$("createHandoffReport").addEventListener("click", () => run(async () => {
  const report = await call("handoff:create-report");
  log(`已生成交接报告：${report.reportPath}`);
}));

$("proPlan").addEventListener("click", () => run(async () => {
  const pack = await call("pro:create-pack", {
    task: $("taskInput").value,
    includeDiff: true
  });
  state.currentRelayId = pack.id;
  $("proSummary").textContent = pack.summary || `已复制备用上下文：${pack.id}`;
  log(`已复制备用上下文：${pack.id}`);
}));

$("copyLatestProPack").addEventListener("click", () => run(async () => {
  const pack = await call("pro:copy-latest-pack");
  state.currentRelayId = pack.id;
  $("proSummary").textContent = pack.summary || `已重新复制备用上下文：${pack.id}`;
  log(`已重新复制备用上下文：${pack.id}`);
}));

$("startProWatch").addEventListener("click", () => run(async () => {
  if (!state.currentRelayId) throw new Error("请先复制备用上下文。");
  await call("pro:start-watch", { id: state.currentRelayId });
  log("正在等待备用回复。");
}));

$("manualImport").addEventListener("click", () => run(async () => {
  const text = $("manualReply").value.trim();
  if (!text) throw new Error("请先粘贴备用回复。");
  if (!state.currentRelayId) throw new Error("请先复制备用上下文。");
  const imported = await call("pro:manual-import", {
    id: state.currentRelayId,
    text
  });
  log(`已导入：${imported.codexReadThisPath}`);
}));

$("selectProject").addEventListener("click", () => run(async () => {
  const result = await call("project:add");
  log(`已选择项目：${result.selected.cwd}`);
}));

$("windowMinimize").addEventListener("click", () => call("window:minimize").catch((error) => log(error.message)));
$("windowMaximize").addEventListener("click", () => call("window:toggle-maximize").catch((error) => log(error.message)));
$("windowClose").addEventListener("click", () => call("window:close").catch((error) => log(error.message)));

refresh().catch((error) => log(error.message));
setInterval(() => refresh().catch(() => {}), 5000);
