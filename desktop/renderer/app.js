const state = {
  currentRelayId: "",
  busy: false,
  lastStatus: null
};

const PROJECT_CLASS = {
  disconnected: "project-state-disconnected",
  connected: "project-state-connected",
  accessed: "project-state-accessed",
  called: "project-state-reviewing",
  written: "project-state-ready",
  error: "project-state-error"
};

const WORKSPACE_CLASS = [
  "workspace-disconnected",
  "workspace-connected",
  "workspace-accessed",
  "workspace-called",
  "workspace-written",
  "workspace-error"
];

const $ = (id) => document.getElementById(id);

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

function setStatus(id, text, kind) {
  const node = $(id);
  node.textContent = text;
  node.className = kind || "";
}

async function refresh() {
  const status = await call("status:get");
  state.lastStatus = status;

  const ready = status.doctor && status.doctor.ready;
  const setupLabel = status.setupState && status.setupState.label;
  setStatus("codexState", ready ? "就绪" : setupLabel || "本地设置待补全", ready ? "ok" : "warn");

  const bridge = status.bridgeState || { key: "disconnected", label: "未连接", kind: "warn" };
  renderProjectList(status.projects || [projectToListItem(status.project, bridge)]);
  setStatus("bridgeState", bridge.label, bridge.kind);
  $("workspaceBadge").textContent = bridge.label;
  $("workspaceBadge").className = `pill ${bridge.kind || ""}`;
  renderWorkspaceSignal(bridge.key);
  updateMainAction(bridge.key);

  const latest = status.relay && status.relay.latest;
  if (latest && latest.id) state.currentRelayId = latest.id;
  if (latest && latest.promptPath) $("proSummary").textContent = `上次备用上下文：${latest.id}`;

  const hasReply = Boolean(
    status.handoff && status.handoff.latestReady ||
    latest && latest.state === "imported"
  );
  setStatus("replyState", hasReply ? "可查看" : "暂无结果", hasReply ? "ok" : "warn");

  await refreshWorkbench();
}

function projectToListItem(project = {}, bridge = {}) {
  return {
    name: project.name || "当前项目",
    cwd: project.cwd || "未选择项目",
    selected: true,
    bridgeState: bridge
  };
}

function renderProjectList(projects) {
  const list = $("projectList");
  list.textContent = "";
  for (const project of projects) {
    const bridge = project.bridgeState || { key: "disconnected", label: "未连接" };
    const row = document.createElement("button");
    row.type = "button";
    row.className = [
      "project-row",
      PROJECT_CLASS[bridge.key] || "project-state-disconnected",
      project.selected ? "selected" : ""
    ].filter(Boolean).join(" ");
    row.dataset.path = project.cwd || "";
    row.title = project.cwd || "";

    const dot = document.createElement("span");
    dot.className = "project-dot";
    dot.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "project-copy";
    const name = document.createElement("strong");
    name.textContent = project.name || "未命名项目";
    const meta = document.createElement("span");
    meta.textContent = `${bridge.label || "未连接"} · ${project.cwd || ""}`;
    copy.append(name, meta);

    row.append(dot, copy);
    list.append(row);
  }
}

async function refreshWorkbench() {
  const [commands, changes, trace] = await Promise.all([
    call("command:list"),
    call("changes:get"),
    call("mcp:trace").catch(() => null)
  ]);

  const commandCount = Array.isArray(commands.commands) ? commands.commands.length : 0;
  const toolCallCount = changes.evidenceSummary && changes.evidenceSummary.counts
    ? changes.evidenceSummary.counts.toolCalls
    : 0;
  setStatus(
    "commandState",
    commandCount ? `${commandCount} 条命令` : toolCallCount ? "已调用工具" : "暂无命令",
    commandCount || toolCallCount ? "ok" : "warn"
  );

  renderTimeline(changes.timeline || []);
  renderToolCalls(Array.isArray(changes.toolCalls) && changes.toolCalls.length ? changes : trace);
  renderCommands(commands.commands || [], changes.commandPanel || commands);
  renderChanges(changes);
  renderReply(changes.latestReply);
}

function renderWorkspaceSignal(key) {
  const current = key || "disconnected";
  const copy = {
    disconnected: {
      title: "还没有连接",
      text: "先连接当前项目，ChatGPT 才能调用本地工具。"
    },
    connected: {
      title: "已连接，可以用了",
      text: "在 ChatGPT 里选择这个工具，或复制左侧提示开始处理。"
    },
    accessed: {
      title: "ChatGPT 已访问连接",
      text: "ChatGPT 已经看到工具列表，下一步会在这里显示调用记录。"
    },
    called: {
      title: "ChatGPT 已经在用本地工具",
      text: "下方会显示调用记录、命令输出、文件变更和写回结果。"
    },
    written: {
      title: "已有结果，交给 Codex",
      text: "查看写回内容后，点击“交给 Codex”继续。"
    },
    error: {
      title: "连接需要处理",
      text: "查看诊断信息，确认 ChatGPT 工具和本地连接是否匹配。"
    }
  }[current] || {
    title: "还没有连接",
    text: "先连接当前项目，ChatGPT 才能调用本地工具。"
  };

  $("signalTitle").textContent = copy.title;
  $("signalText").textContent = copy.text;
  $("workspaceSignal").className = `workspace-signal signal-${current}`;
  const workspace = document.querySelector(".workspace");
  if (workspace) {
    workspace.classList.remove(...WORKSPACE_CLASS);
    workspace.classList.add(`workspace-${current}`);
  }
}

function renderTimeline(items) {
  const list = $("timelineList");
  list.textContent = "";
  const next = items.length ? items : [{ state: "idle", label: "等待 ChatGPT 调用工具" }];
  for (const item of next) {
    const row = document.createElement("li");
    row.className = `timeline-${item.state || "idle"}`;
    row.textContent = item.label;
    list.append(row);
  }
}

function renderToolCalls(trace) {
  if (!trace || !Array.isArray(trace.toolCalls) || !trace.toolCalls.length) {
    setPanelState("tool-calls", false, "等待 ChatGPT 调用工具", "连接就绪后，在 ChatGPT 里发起处理，这里会出现工具调用。");
    $("toolCalls").textContent = "暂无调用。";
    return;
  }
  setPanelState("tool-calls", true);
  $("toolCalls").textContent = trace.toolCalls
    .slice(-8)
    .map((call) => {
      const status = call.ok === false ? `失败：${call.error || "unknown error"}` : "成功";
      return `${call.ts || ""}  ${call.toolName || call.name || "tool"}  ${status}`;
    })
    .join("\n");
}

function renderCommands(commands, commandPanel = {}) {
  if (!commands.length) {
    if (Array.isArray(commandPanel.fallbackItems) && commandPanel.fallbackItems.length) {
      setPanelState("commands", true);
      $("commandOutput").textContent = [
        commandPanel.message || "本轮没有 shell 命令；以下为工具调用证据。",
        "",
        ...commandPanel.fallbackItems.map((item) => `${item.ts || ""}  ${item.toolName || "tool"}  ${item.ok === false ? "失败" : "成功"}`)
      ].join("\n");
      return;
    }
    setPanelState("commands", false, "还没有执行本地命令", commandPanel.message || "ChatGPT 只有调用 shell 工具时，这里才会出现命令输出。");
    $("commandOutput").textContent = commandPanel.message || "暂无命令。";
    return;
  }
  setPanelState("commands", true);
  $("commandOutput").textContent = commands.slice(0, 6).map((command) => [
    `$ ${command.commandRedacted || "(unknown)"}`,
    `exit: ${command.exitCode ?? "unknown"}  time: ${command.durationMs ?? 0}ms`,
    command.stdoutPreview ? `stdout: ${command.stdoutPreview}` : "",
    command.stderrPreview ? `stderr: ${command.stderrPreview}` : ""
  ].filter(Boolean).join("\n")).join("\n\n");
}

function renderChanges(changes) {
  const hasFiles = Array.isArray(changes.files) && changes.files.length;
  setPanelState("changes", true);
  const lines = [changes.summary || "暂无变更。"];
  if (hasFiles) {
    lines.push("");
    lines.push("文件：");
    for (const file of changes.files.slice(0, 12)) lines.push(`${file.code || ""} ${file.path}`);
  } else if (changes.git && changes.git.clean) {
    lines.push("");
    lines.push("Git clean，未检测到工作区变更。");
  } else if (Array.isArray(changes.warnings) && changes.warnings.length) {
    lines.push("");
    lines.push(...changes.warnings);
  }
  $("changeSummary").textContent = lines.join("\n");
}

function renderReply(reply) {
  if (!reply) {
    const bridge = state.lastStatus && state.lastStatus.bridgeState;
    const hasCalls = bridge && (bridge.key === "called" || bridge.key === "accessed");
    setPanelState(
      "reply",
      false,
      "还没有写回结果",
      hasCalls ? "ChatGPT 已调用工具，但还没有写回 Codex。" : "ChatGPT 完成后，这里会显示给 Codex 继续执行的内容。"
    );
    $("replyPreview").textContent = "暂无写回。";
    return;
  }
  setPanelState("reply", true);
  $("replyPreview").textContent = [`${reply.id}`, reply.replyPath, reply.codexReadThisPath, "", reply.text || ""].filter(Boolean).join("\n");
}

function setPanelState(panelName, hasContent, emptyTitle, emptyText) {
  const panel = document.querySelector(`[data-panel="${panelName}"]`);
  if (!panel) return;
  panel.classList.toggle("has-content", Boolean(hasContent));
  panel.classList.toggle("is-empty", !hasContent);
  if (emptyTitle || emptyText) {
    const empty = panel.querySelector(".panel-empty");
    if (empty) {
      const title = empty.querySelector("strong");
      const text = empty.querySelector("p");
      if (title && emptyTitle) title.textContent = emptyTitle;
      if (text && emptyText) text.textContent = emptyText;
    }
  }
}

function updateMainAction(key) {
  if (key === "written") {
    $("workspaceTitle").textContent = "已有写回结果";
    $("nextActionTitle").textContent = "查看结果";
    $("nextActionText").textContent = "ChatGPT 已写回结果。查看变更摘要后交给 Codex。";
    return;
  }
  if (key === "called") {
    $("workspaceTitle").textContent = "ChatGPT 正在处理";
    $("nextActionTitle").textContent = "查看结果";
    $("nextActionText").textContent = "ChatGPT 已调用本地工具。这里会显示命令、文件变更和写回结果。";
    return;
  }
  if (key === "accessed") {
    $("workspaceTitle").textContent = "ChatGPT 已访问连接";
    $("nextActionTitle").textContent = "开始处理";
    $("nextActionText").textContent = "ChatGPT 已经看到这个工具。发送处理请求后，这里会显示调用记录。";
    return;
  }
  if (key === "connected") {
    $("workspaceTitle").textContent = "已连接当前项目";
    $("nextActionTitle").textContent = "开始处理";
    $("nextActionText").textContent = "复制一句话到 ChatGPT，让它使用这个工具处理当前项目。";
    return;
  }
  $("workspaceTitle").textContent = "等待连接";
  $("nextActionTitle").textContent = "连接 ChatGPT";
  $("nextActionText").textContent = "连接当前项目后，在 ChatGPT 里选择这个工具开始处理。";
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

$("copyChatGPTPrompt").addEventListener("click", () => run(async () => {
  const result = await call("chatgpt:copy-review-prompt");
  log(`已复制给 ChatGPT：${result.text}`);
}));

$("viewResults").addEventListener("click", () => run(async () => {
  const result = await call("changes:get");
  renderTimeline(result.timeline || []);
  renderChanges(result);
  renderReply(result.latestReply);
  log("已刷新结果。");
}));

$("copyCodex").addEventListener("click", () => run(async () => {
  const result = await call("codex:copy-continue-prompt");
  log(`已复制给 Codex：${result.text}`);
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

$("projectList").addEventListener("click", (event) => {
  const row = event.target.closest(".project-row");
  if (!row || !row.dataset.path) return;
  run(async () => {
    const project = await call("project:select", { path: row.dataset.path });
    log(`已切换项目：${project.cwd}`);
  });
});

$("windowMinimize").addEventListener("click", () => call("window:minimize").catch((error) => log(error.message)));
$("windowMaximize").addEventListener("click", () => call("window:toggle-maximize").catch((error) => log(error.message)));
$("windowClose").addEventListener("click", () => call("window:close").catch((error) => log(error.message)));

refresh().catch((error) => log(error.message));
setInterval(() => refresh().catch(() => {}), 5000);
