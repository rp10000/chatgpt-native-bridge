const state = {
  currentRelayId: "",
  busy: false,
  lastStatus: null,
  lang: localStorage.getItem("cgn-lang") || "zh-CN",
  proTaskEdited: false,
  helpTab: "connect"
};

const $ = (id) => document.getElementById(id);

const I18N = {
  "zh-CN": {
    help: "帮助",
    close: "关闭",
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
    connectedText: "去 ChatGPT 刷新这个工具，然后发送任务。",
    accessedTitle: "ChatGPT 已访问",
    accessedText: "ChatGPT 已经看到工具。发送任务后这里会显示操作记录。",
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
    languageAria: "Switch to English",
    helpEyebrow: "内置教程",
    helpTitle: "怎么用",
    helpConnect: "连接",
    helpChatGPT: "在 ChatGPT 里说什么",
    helpEmpty: "卡片为空",
    helpModels: "Thinking / Pro"
  },
  en: {
    help: "Help",
    close: "Close",
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
    languageAria: "Switch to Chinese",
    helpEyebrow: "Built-in Guide",
    helpTitle: "How to use it",
    helpConnect: "Connect",
    helpChatGPT: "What to ask",
    helpEmpty: "Empty cards",
    helpModels: "Thinking / Pro"
  }
};

const HELP = {
  "zh-CN": {
    connect: { image: "../assets/help/help-connect.svg", title: "第一次只做三步", items: ["选择你要让 ChatGPT 操作的项目。", "点击连接 ChatGPT。客户端会复制连接地址并打开 ChatGPT 的工具设置页。", "在 ChatGPT 里创建或刷新这个工具；地址还活着时不用重复创建。"] },
    chatgpt: { image: "../assets/help/help-chatgpt.svg", title: "连好以后，在 ChatGPT 里发这句话", prompt: "请使用 chatgpt-native-bridge 打开当前连接项目。你可以直接读取、修改文件并运行必要检查。完成后请生成交接报告，说明改了什么、跑了什么、还需要 Codex 复核什么。", items: ["ChatGPT 应该调用 open_workspace，然后按需 read/edit/write/bash/show_changes。", "完成后让它调用 create_handoff_report。", "客户端状态灯变绿说明 ChatGPT 已经在操作当前项目。"] },
    empty: { image: "../assets/help/help-card-empty.svg", title: "卡片空白时怎么判断", items: ["先让 ChatGPT 调用 bridge_card_test。", "如果测试卡片正常，说明 UI 通道没问题；刷新工具后再调用 open_workspace。", "如果测试卡片也空，通常是当前 ChatGPT 模式没有把 Apps 工具结果传给 iframe，换支持工具的模式或重建工具。"] },
    models: { image: "../assets/help/help-pro.svg", title: "Thinking 和 Pro 的分工", items: ["支持工具的 Thinking/ChatGPT 模式可以通过 MCP 直接读写当前项目。", "Pro 不要假设能直接调用 MCP；如果当前 Pro 看不到工具，就用备用方式打包上下文给它做规划。", "xhigh/high 是 ChatGPT 模型侧能力，不由 Bridge 控制；能否调用工具取决于当前账号、模式和 Developer Mode 支持。"] }
  },
  en: {
    connect: { image: "../assets/help/help-connect.svg", title: "First run: three steps", items: ["Select the project ChatGPT should operate on.", "Click Connect ChatGPT. The client copies the server URL and opens ChatGPT tool settings.", "Create or refresh the tool in ChatGPT. Reuse the URL while it is still live."] },
    chatgpt: { image: "../assets/help/help-chatgpt.svg", title: "After connecting, send this in ChatGPT", prompt: "Use chatgpt-native-bridge to open the current connected project. You may read files, edit files, and run required checks. When finished, create a handoff report describing what changed, what ran, and what Codex should review.", items: ["ChatGPT should call open_workspace, then read/edit/write/bash/show_changes as needed.", "At the end, ask it to call create_handoff_report.", "The client turns green when ChatGPT is operating on the current project."] },
    empty: { image: "../assets/help/help-card-empty.svg", title: "When a card is empty", items: ["Ask ChatGPT to call bridge_card_test.", "If the test card works, refresh the tool metadata and call open_workspace again.", "If the test card is still empty, the selected ChatGPT mode may not be delivering Apps tool results. Switch to a tool-capable mode or recreate the tool."] },
    models: { image: "../assets/help/help-pro.svg", title: "Thinking and Pro split", items: ["Tool-capable Thinking/ChatGPT modes can use MCP to read and edit the current project directly.", "Do not assume Pro can call MCP. If Pro cannot see tools, use the fallback packaged context for planning.", "xhigh/high is controlled by ChatGPT, not Bridge. Tool access depends on your account, mode, and Developer Mode support."] }
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
  for (const element of document.querySelectorAll("[data-i18n]")) element.textContent = t(element.dataset.i18n);
  $("languageToggle").textContent = t("languageToggle");
  $("languageToggle").setAttribute("aria-label", t("languageAria"));
  if (!state.proTaskEdited) $("taskInput").value = t("proTaskDefault");
  if (!$("proSummary").dataset.state) $("proSummary").textContent = t("proSummaryDefault");
  if (!$("diagnostics").dataset.touched) $("diagnostics").textContent = t("ready");
  renderHelp();
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
  diagnostics.textContent = stamp + " " + line + "\n" + diagnostics.textContent;
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
  if (latest && latest.promptPath && !$("proSummary").dataset.state) $("proSummary").textContent = t("latestFallback") + latest.id;
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
  $("statusLamp").className = "status-lamp status-" + key;
}

async function refreshActivity() {
  const [commands, changes, trace] = await Promise.all([call("command:list"), call("changes:get"), call("mcp:trace").catch(() => null)]);
  const toolCalls = Array.isArray(changes.toolCalls) && changes.toolCalls.length ? changes.toolCalls : trace && Array.isArray(trace.toolCalls) ? trace.toolCalls : [];
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
  $("toolCalls").textContent = toolCalls.slice(-12).map((toolCall) => {
    const status = toolCall.ok === false ? t("failed") + ": " + (toolCall.error || t("unknownError")) : t("success");
    return [toolCall.ts || "", toolCall.toolName || toolCall.name || "tool", status].join("  ");
  }).join("\n");
}

function renderCommands(commands, commandPanel = {}) {
  if (!commands.length) {
    const fallback = Array.isArray(commandPanel.fallbackItems) && commandPanel.fallbackItems.length ? commandPanel.fallbackItems.map((item) => [item.ts || "", item.toolName || "tool", item.ok === false ? t("failed") : t("success")].join("  ")).join("\n") : t("noCommands");
    $("commandOutput").textContent = fallback;
    return;
  }
  $("commandOutput").textContent = commands.slice(0, 8).map((command) => ["$ " + (command.commandRedacted || "(unknown)"), "exit: " + (command.exitCode ?? "unknown") + "  time: " + (command.durationMs ?? 0) + "ms", command.stdoutPreview ? "stdout: " + command.stdoutPreview : "", command.stderrPreview ? "stderr: " + command.stderrPreview : ""].filter(Boolean).join("\n")).join("\n\n");
}

function renderChanges(changes) {
  const lines = [t("noChanges")];
  if (Array.isArray(changes.files) && changes.files.length) {
    lines[0] = changes.summary || String(changes.files.length) + " " + t("files");
    lines.push("", t("files"));
    for (const file of changes.files.slice(0, 16)) lines.push((file.code || "") + " " + file.path);
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
  $("replyPreview").textContent = [reply.id, reply.projectRoot ? "Project: " + reply.projectRoot : "", reply.reportPath ? "Report: " + reply.reportPath : "", reply.codexReadThisPath ? "Codex: " + reply.codexReadThisPath : "", "", reply.text || ""].filter(Boolean).join("\n");
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

function openHelp(tab) {
  state.helpTab = tab || state.helpTab;
  $("helpModal").classList.add("open");
  $("helpModal").setAttribute("aria-hidden", "false");
  renderHelp();
}

function closeHelp() {
  $("helpModal").classList.remove("open");
  $("helpModal").setAttribute("aria-hidden", "true");
}

function renderHelp() {
  const content = HELP[state.lang][state.helpTab] || HELP[state.lang].connect;
  for (const tab of document.querySelectorAll(".help-tab")) tab.classList.toggle("active", tab.dataset.helpTab === state.helpTab);
  $("helpImage").src = content.image;
  const prompt = content.prompt ? '<pre class="help-prompt">' + escapeHtml(content.prompt) + '</pre>' : '';
  $("helpBody").innerHTML = '<h3>' + escapeHtml(content.title) + '</h3>' + prompt + '<ul>' + content.items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

$("connectChatGPT").addEventListener("click", () => run(async () => {
  const result = await call("mcp:connect-or-refresh");
  log(result.message || (result.reused ? t("reusedConnection") : t("creatingConnection")));
}));

$("createHandoffReport").addEventListener("click", () => run(async () => {
  const report = await call("handoff:create-report");
  log(t("reportCreated") + report.reportPath);
}));

$("proPlan").addEventListener("click", () => run(async () => {
  const pack = await call("pro:create-pack", { task: $("taskInput").value, includeDiff: true });
  state.currentRelayId = pack.id;
  $("proSummary").dataset.state = "packed";
  $("proSummary").textContent = pack.summary || t("copiedFallback") + pack.id;
  log(t("copiedFallback") + pack.id);
}));

$("copyLatestProPack").addEventListener("click", () => run(async () => {
  const pack = await call("pro:copy-latest-pack");
  state.currentRelayId = pack.id;
  $("proSummary").dataset.state = "packed";
  $("proSummary").textContent = pack.summary || t("recopiedFallback") + pack.id;
  log(t("recopiedFallback") + pack.id);
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
  const imported = await call("pro:manual-import", { id: state.currentRelayId, text });
  log(t("imported") + imported.codexReadThisPath);
}));

$("selectProject").addEventListener("click", () => run(async () => {
  const result = await call("project:add");
  log(t("selected") + result.selected.cwd);
}));

$("languageToggle").addEventListener("click", () => {
  state.lang = state.lang === "zh-CN" ? "en" : "zh-CN";
  localStorage.setItem("cgn-lang", state.lang);
  applyLanguage();
});

$("taskInput").addEventListener("input", () => { state.proTaskEdited = true; });
$("helpOpen").addEventListener("click", () => openHelp("connect"));
$("helpClose").addEventListener("click", closeHelp);
$("helpCloseBackdrop").addEventListener("click", closeHelp);
for (const tab of document.querySelectorAll(".help-tab")) tab.addEventListener("click", () => openHelp(tab.dataset.helpTab));

$("windowMinimize").addEventListener("click", () => call("window:minimize").catch((error) => log(error.message)));
$("windowMaximize").addEventListener("click", () => call("window:toggle-maximize").catch((error) => log(error.message)));
$("windowClose").addEventListener("click", () => call("window:close").catch((error) => log(error.message)));

applyLanguage();
refresh().catch((error) => log(error.message));
setInterval(() => refresh().catch(() => {}), 5000);
