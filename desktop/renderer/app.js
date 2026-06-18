const state = {
  currentRelayId: "",
  busy: false,
  lastStatus: null,
  lang: localStorage.getItem("cgn-lang") || "zh-CN",
  proTaskEdited: false
};

const $ = (id) => document.getElementById(id);

const I18N = {
  "zh-CN": {
    currentProject: "当前项目",
    loadingProject: "正在读取项目",
    loadingPath: "请稍等",
    selectedProject: "当前项目",
    noProject: "未选择项目",
    selectProject: "选择项目",
    connectChatGPT: "连接 ChatGPT",
    createReport: "生成交接报告",
    calls: "调用",
    commands: "命令",
    changes: "变更",
    report: "报告",
    none: "暂无",
    generated: "已生成",
    activity: "查看过程",
    toolCalls: "调用记录",
    commandOutput: "命令输出",
    fileChanges: "文件变更",
    handoffReport: "交接报告",
    fallback: "备用方式",
    fallbackHint: "仅在当前 ChatGPT 无法调用工具时使用。",
    proTask: "Pro 辅助规划任务",
    proTaskDefault: "基于打包上下文给 Codex 一个简洁的复核建议。上下文不足时请明确说明。",
    proSummaryDefault: "尚未打包备用上下文。",
    packContext: "打包上下文",
    copyAgain: "重新复制",
    waitReply: "等待回复",
    manualImportLabel: "手动导入回复",
    importReply: "导入回复",
    diagnostics: "诊断",
    ready: "准备就绪。",
    disconnectedTitle: "未连接",
    disconnectedText: "选择项目后连接 ChatGPT。",
    connectedTitle: "已连接",
    connectedText: "在 ChatGPT 里刷新或选择这个工具，然后发送任务。",
    accessedTitle: "ChatGPT 已访问",
    accessedText: "ChatGPT 已经看到工具，发送任务后这里会显示操作记录。",
    calledTitle: "ChatGPT 正在操作",
    calledText: "ChatGPT 正在读取、修改或运行当前项目。",
    reportedTitle: "已生成交接报告",
    reportedText: "Codex 可以读取报告，复核变更、运行测试并提交。",
    errorTitle: "需要处理",
    errorText: "连接失效，或请求的项目不是当前项目。",
    noCalls: "暂无调用。",
    noCommands: "暂无命令。",
    noChanges: "暂无变更。",
    cleanGit: "Git clean，未检测到工作区变更。",
    files: "文件：",
    noReport: "暂无报告。",
    success: "成功",
    failed: "失败",
    unknownError: "未知错误",
    operationFailed: "操作失败。",
    reusedConnection: "已复用当前项目连接。",
    creatingConnection: "正在创建新的项目连接。",
    reportCreated: "已生成交接报告：",
    copiedFallback: "已复制备用上下文：",
    recopiedFallback: "已重新复制备用上下文：",
    waitFallback: "正在等待备用回复。",
    copyFallbackFirst: "请先复制备用上下文。",
    pasteFallbackFirst: "请先粘贴备用回复。",
    imported: "已导入：",
    selected: "已选择项目：",
    latestFallback: "上次备用上下文：",
    languageToggle: "EN",
    languageAria: "Switch to English"
  },
  en: {
    currentProject: "Current Project",
    loadingProject: "Loading project",
    loadingPath: "Please wait",
    selectedProject: "Current Project",
    noProject: "No project selected",
    selectProject: "Select Project",
    connectChatGPT: "Connect ChatGPT",
    createReport: "Create Handoff Report",
    calls: "Calls",
    commands: "Commands",
    changes: "Changes",
    report: "Report",
    none: "None",
    generated: "Generated",
    activity: "Activity",
    toolCalls: "Tool Calls",
    commandOutput: "Command Output",
    fileChanges: "File Changes",
    handoffReport: "Handoff Report",
    fallback: "Fallback",
    fallbackHint: "Use only when the current ChatGPT chat cannot call tools.",
    proTask: "Pro Planning Task",
    proTaskDefault: "Give Codex a concise review based on the packaged context. Say when context is insufficient.",
    proSummaryDefault: "No fallback context has been packaged.",
    packContext: "Package Context",
    copyAgain: "Copy Again",
    waitReply: "Wait for Reply",
    manualImportLabel: "Manual Reply Import",
    importReply: "Import Reply",
    diagnostics: "Diagnostics",
    ready: "Ready.",
    disconnectedTitle: "Not Connected",
    disconnectedText: "Select a project, then connect ChatGPT.",
    connectedTitle: "Connected",
    connectedText: "Refresh or select this tool in ChatGPT, then send the task.",
    accessedTitle: "ChatGPT Accessed",
    accessedText: "ChatGPT has seen the tool. Activity appears here after it sends a task.",
    calledTitle: "ChatGPT Is Working",
    calledText: "ChatGPT is reading, editing, or running the current project.",
    reportedTitle: "Handoff Report Created",
    reportedText: "Codex can read the report, review changes, run tests, and commit.",
    errorTitle: "Action Needed",
    errorText: "The connection is stale, or the requested project does not match.",
    noCalls: "No calls yet.",
    noCommands: "No commands yet.",
    noChanges: "No changes yet.",
    cleanGit: "Git is clean. No workspace changes detected.",
    files: "Files:",
    noReport: "No report yet.",
    success: "Success",
    failed: "Failed",
    unknownError: "unknown error",
    operationFailed: "Operation failed.",
    reusedConnection: "Reused the current project connection.",
    creatingConnection: "Creating a new project connection.",
    reportCreated: "Handoff report created: ",
    copiedFallback: "Fallback context copied: ",
    recopiedFallback: "Fallback context copied again: ",
    waitFallback: "Waiting for fallback reply.",
    copyFallbackFirst: "Package fallback context first.",
    pasteFallbackFirst: "Paste the fallback reply first.",
    imported: "Imported: ",
    selected: "Selected project: ",
    latestFallback: "Latest fallback context: ",
    languageToggle: "中文",
    languageAria: "切换到中文"
  }
};

function t(key) {
  const dict = I18N[state.lang] || I18N["zh-CN"];
  return dict[key] || I18N["zh-CN"][key] || key;
}

function statusCopy(key) {
  return {
    disconnected: { title: t("disconnectedTitle"), text: t("disconnectedText") },
    connected: { title: t("connectedTitle"), text: t("connectedText") },
    accessed: { title: t("accessedTitle"), text: t("accessedText") },
    called: { title: t("calledTitle"), text: t("calledText") },
    reported: { title: t("reportedTitle"), text: t("reportedText") },
    error: { title: t("errorTitle"), text: t("errorText") }
  }[key] || { title: t("disconnectedTitle"), text: t("disconnectedText") };
}

function setBusy(value) {
  state.busy = value;
  for (const button of document.querySelectorAll("button")) button.disabled = value;
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  $("languageToggle").textContent = t("languageToggle");
  $("languageToggle").setAttribute("aria-label", t("languageAria"));

  if (!state.proTaskEdited) $("taskInput").value = t("proTaskDefault");
  if (!$("proSummary").dataset.state) $("proSummary").textContent = t("proSummaryDefault");
  if (!$("diagnostics").dataset.touched) $("diagnostics").textContent = t("ready");

  if (state.lastStatus) {
    renderProject(state.lastStatus.project || {});
    renderBridgeState(state.lastStatus.bridgeState || { key: "disconnected" });
    refreshActivity().catch(() => {});
    return;
  }

  $("projectName").textContent = t("loadingProject");
  $("projectPath").textContent = t("loadingPath");
  renderBridgeState({ key: "disconnected" });
}

function log(line) {
  const diagnostics = $("diagnostics");
  const stamp = new Date().toLocaleTimeString();
  diagnostics.dataset.touched = "true";
  diagnostics.textContent = `${stamp} ${line}\n${diagnostics.textContent}`;
}

async function call(channel, payload) {
  const result = await window.bridge.invoke(channel, payload || {});
  if (!result.ok) throw new Error(result.error || t("operationFailed"));
  return result.data;
}

async function refresh() {
  const status = await call("status:get");
  state.lastStatus = status;
  renderProject(status.project || {});
  renderBridgeState(status.bridgeState || { key: "disconnected" });
  await refreshActivity();

  const latest = status.relay && status.relay.latest;
  if (latest && latest.id) state.currentRelayId = latest.id;
  if (latest && latest.promptPath && !$("proSummary").dataset.state) {
    $("proSummary").textContent = `${t("latestFallback")}${latest.id}`;
  }
}

function renderProject(project) {
  $("projectName").textContent = project.name || t("selectedProject");
  $("projectPath").textContent = project.cwd || t("noProject");
}

function renderBridgeState(bridge) {
  const key = bridge.key || "disconnected";
  const copy = statusCopy(key);
  $("statusTitle").textContent = copy.title;
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
  $("reportState").textContent = latestReply ? t("generated") : t("none");

  renderToolCalls(toolCalls);
  renderCommands(commandRows, changes.commandPanel || commands);
  renderChanges(changes);
  renderReply(latestReply);
}

function renderToolCalls(toolCalls) {
  if (!toolCalls.length) {
    $("toolCalls").textContent = t("noCalls");
    return;
  }

  $("toolCalls").textContent = toolCalls
    .slice(-12)
    .map((toolCall) => {
      const status = toolCall.ok === false
        ? `${t("failed")}: ${toolCall.error || t("unknownError")}`
        : t("success");
      return `${toolCall.ts || ""}  ${toolCall.toolName || toolCall.name || "tool"}  ${status}`;
    })
    .join("\n");
}

function renderCommands(commands, commandPanel = {}) {
  if (!commands.length) {
    const fallback = Array.isArray(commandPanel.fallbackItems) && commandPanel.fallbackItems.length
      ? commandPanel.fallbackItems
        .map((item) => `${item.ts || ""}  ${item.toolName || "tool"}  ${item.ok === false ? t("failed") : t("success")}`)
        .join("\n")
      : t("noCommands");
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
  const lines = [t("noChanges")];
  if (Array.isArray(changes.files) && changes.files.length) {
    lines[0] = changes.summary || `${changes.files.length} ${t("files")}`;
    lines.push("", t("files"));
    for (const file of changes.files.slice(0, 16)) lines.push(`${file.code || ""} ${file.path}`);
  } else if (changes.git && changes.git.clean) {
    lines.push("", t("cleanGit"));
  }
  $("changeSummary").textContent = lines.join("\n");
}

function renderReply(reply) {
  if (!reply) {
    $("replyPreview").textContent = t("noReport");
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
    log(error.message || t("operationFailed"));
  } finally {
    setBusy(false);
  }
}

$("connectChatGPT").addEventListener("click", () => run(async () => {
  const result = await call("mcp:connect-or-refresh");
  log(result.message || (result.reused ? t("reusedConnection") : t("creatingConnection")));
}));

$("createHandoffReport").addEventListener("click", () => run(async () => {
  const report = await call("handoff:create-report");
  log(`${t("reportCreated")}${report.reportPath}`);
}));

$("proPlan").addEventListener("click", () => run(async () => {
  const pack = await call("pro:create-pack", {
    task: $("taskInput").value,
    includeDiff: true
  });
  state.currentRelayId = pack.id;
  $("proSummary").dataset.state = "packed";
  $("proSummary").textContent = pack.summary || `${t("copiedFallback")}${pack.id}`;
  log(`${t("copiedFallback")}${pack.id}`);
}));

$("copyLatestProPack").addEventListener("click", () => run(async () => {
  const pack = await call("pro:copy-latest-pack");
  state.currentRelayId = pack.id;
  $("proSummary").dataset.state = "packed";
  $("proSummary").textContent = pack.summary || `${t("recopiedFallback")}${pack.id}`;
  log(`${t("recopiedFallback")}${pack.id}`);
}));

$("startProWatch").addEventListener("click", () => run(async () => {
  if (!state.currentRelayId) throw new Error(t("copyFallbackFirst"));
  await call("pro:start-watch", { id: state.currentRelayId });
  log(t("waitFallback"));
}));

$("manualImport").addEventListener("click", () => run(async () => {
  const text = $("manualReply").value.trim();
  if (!text) throw new Error(t("pasteFallbackFirst"));
  if (!state.currentRelayId) throw new Error(t("copyFallbackFirst"));
  const imported = await call("pro:manual-import", {
    id: state.currentRelayId,
    text
  });
  log(`${t("imported")}${imported.codexReadThisPath}`);
}));

$("selectProject").addEventListener("click", () => run(async () => {
  const result = await call("project:add");
  log(`${t("selected")}${result.selected.cwd}`);
}));

$("languageToggle").addEventListener("click", () => {
  state.lang = state.lang === "zh-CN" ? "en" : "zh-CN";
  localStorage.setItem("cgn-lang", state.lang);
  applyLanguage();
});

$("taskInput").addEventListener("input", () => {
  state.proTaskEdited = true;
});

$("windowMinimize").addEventListener("click", () => call("window:minimize").catch((error) => log(error.message)));
$("windowMaximize").addEventListener("click", () => call("window:toggle-maximize").catch((error) => log(error.message)));
$("windowClose").addEventListener("click", () => call("window:close").catch((error) => log(error.message)));

applyLanguage();
refresh().catch((error) => log(error.message));
setInterval(() => refresh().catch(() => {}), 5000);
