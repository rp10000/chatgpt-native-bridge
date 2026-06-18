const fs = require("node:fs/promises");
const path = require("node:path");

const CHATGPT_CARD_RESOURCE_URI = "ui://chatgpt-native-bridge/workspace-card.html";
const CHATGPT_CARD_MIME_TYPE = "text/html;profile=mcp-app";

const CARD_TOOL_NAMES = new Set([
  "open_workspace",
  "read_project_instructions",
  "list_directory",
  "search_workspace",
  "read",
  "write",
  "edit",
  "bash",
  "command_history",
  "show_changes",
  "create_handoff_report",
  "submit_reply_to_codex",
  "write_to_codex"
]);

const RESOURCE_META = {
  ui: {
    csp: {
      connectDomains: [],
      resourceDomains: [],
      frameDomains: []
    },
    prefersBorder: true
  },
  "openai/widgetDescription": "Shows local workspace, command, file-change, and handoff report status.",
  "openai/widgetPrefersBorder": true,
  "openai/widgetCSP": {
    connect_domains: [],
    resource_domains: [],
    frame_domains: []
  }
};

function registerChatGptCardResource(server) {
  server.registerResource(
    "ChatGPT Native Bridge workspace card",
    CHATGPT_CARD_RESOURCE_URI,
    {
      title: "ChatGPT Native Bridge workspace card",
      description: "Inline ChatGPT card for workspace commands, file changes, and handoff reports.",
      mimeType: CHATGPT_CARD_MIME_TYPE,
      _meta: RESOURCE_META
    },
    async () => ({
      contents: [
        {
          uri: CHATGPT_CARD_RESOURCE_URI,
          mimeType: CHATGPT_CARD_MIME_TYPE,
          text: await readCardWidgetHtml(),
          _meta: RESOURCE_META
        }
      ]
    })
  );
}

async function readCardWidgetHtml() {
  return fs.readFile(path.join(__dirname, "widget", "workspace-card.html"), "utf8");
}

function withChatGptCardToolConfig(toolName, config) {
  if (!CARD_TOOL_NAMES.has(toolName)) return config;
  const meta = config._meta || {};
  return {
    ...config,
    _meta: {
      ...meta,
      ui: {
        ...(meta.ui || {}),
        resourceUri: CHATGPT_CARD_RESOURCE_URI
      },
      "ui/resourceUri": CHATGPT_CARD_RESOURCE_URI,
      "openai/outputTemplate": CHATGPT_CARD_RESOURCE_URI
    }
  };
}

function withChatGptCardResult(toolName, result, args = {}, context = {}) {
  if (!CARD_TOOL_NAMES.has(toolName) || !result || typeof result !== "object") return result;

  const cardV2 = result.cardV2 || buildCardV2(toolName, result, args, context);
  return {
    ...result,
    cardV2,
    card: result.card || downgradeCardV2(cardV2)
  };
}

function buildCardV2(toolName, result = {}, args = {}, context = {}) {
  const project = { name: safeProjectName(context.cwd, result) };
  const builder = CARD_BUILDERS[toolName] || buildReportCard;
  return normalizeCardV2({ version: 2, project, ...builder(toolName, result, args, context) });
}

const CARD_BUILDERS = {
  open_workspace: (_toolName, result) => ({
    kind: "workspace",
    title: "Workspace opened",
    status: result.open === false ? "warn" : "ok",
    summary: result.open === false
      ? "The workspace is not open yet."
      : "ChatGPT is connected to the current local project.",
    metrics: [
      metric("Git", gitStatusLabel(result)),
      metric("Branch", result.branch || result.gitBranch || "unknown"),
      metric("Instructions", instructionLabel(result))
    ],
    sections: [
      section("Workspace", [
        result.workspaceId ? `Workspace ID: ${result.workspaceId}` : "Workspace opened",
        result.root ? `Project: ${safeRelativePath(result.root)}` : ""
      ]),
      section("Next", ["Read project instructions, inspect files, then run show_changes before the handoff report."])
    ],
    nextAction: "Read project instructions or inspect the files needed for the task."
  }),

  read_project_instructions: (_toolName, result) => {
    const files = normalizeList((result.files || []).map((file) => file.path || file.name));
    return {
      kind: "file",
      title: "Project instructions loaded",
      status: files.length ? "ok" : "warn",
      summary: files.length ? `Loaded ${files.length} instruction file(s).` : "No AGENTS, CLAUDE, or README instructions were found.",
      metrics: [metric("Files", files.length)],
      sections: [section("Files", files.length ? files : ["No instruction files found."])],
      nextAction: "Use the instructions before reading or editing project files."
    };
  },

  list_directory: (_toolName, result, args) => {
    const entries = normalizeList((result.entries || []).map((entry) => `${entry.type || "item"}: ${entry.path || entry.name || ""}`));
    return {
      kind: "file",
      title: "Directory listed",
      status: "ok",
      summary: `Listed ${entries.length} visible item(s) in ${safeRelativePath(args.path || result.path || ".")}.`,
      metrics: [metric("Entries", entries.length)],
      sections: [
        section("Items", entries.length ? entries : ["No visible entries."]),
        section("Skipped", ["Private, dependency, and credential-like paths stay hidden."])
      ],
      nextAction: "Open only the files needed for the current task."
    };
  },

  search_workspace: (_toolName, result, args) => {
    const matches = normalizeList((result.results || []).map((item) => {
      const line = item.line || item.lineNumber;
      return `${safeRelativePath(item.path || "")}${line ? `:${line}` : ""} ${item.preview || item.text || ""}`.trim();
    }));
    return {
      kind: "search",
      title: "Search completed",
      status: "ok",
      summary: `Found ${matches.length} visible match(es) for "${clean(args.query || result.query || "query", 60)}".`,
      metrics: [metric("Matches", matches.length)],
      sections: [
        section("Matches", matches.length ? matches : ["No visible matches."]),
        section("Skipped", ["Private, dependency, and credential-like paths stay hidden."])
      ],
      nextAction: "Read the most relevant matching files before editing."
    };
  },

  read: (_toolName, result, args) => ({
    kind: "file",
    title: "File read",
    status: result.truncated ? "warn" : "ok",
    summary: `Read ${safeRelativePath(result.path || args.path || "file")}${result.truncated ? " with truncation" : ""}.`,
    metrics: [
      metric("Lines", lineCount(result.text)),
      metric("Bytes", result.bytes || byteCount(result.text))
    ],
    sections: [section("Read", [
      result.startLine ? `Start line: ${result.startLine}` : "",
      result.maxLines ? `Max lines: ${result.maxLines}` : "",
      result.truncated ? "Output was truncated." : "File preview is available in the tool result."
    ])],
    nextAction: "Use exact edits with the returned file content when changing this file."
  }),

  write: (_toolName, result, args) => fileChangeCard("File written", "write", result, args),
  edit: (_toolName, result, args) => fileChangeCard("File edited", "edit", result, args),

  bash: (_toolName, result, args) => {
    const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : null;
    const command = args.command || result.command || "";
    const isCheck = isVerificationCommand(command);
    return {
      kind: "command",
      title: "Command finished",
      status: exitCode === 0 ? "ok" : "warn",
      summary: exitCode === null
        ? "A workspace command finished."
        : `Command finished with exit code ${exitCode}${isCheck ? " and looks like a verification command" : ""}.`,
      command: redact(command),
      exitCode,
      metrics: [
        metric("Exit", exitCode === null ? "unknown" : String(exitCode), exitCode === 0 ? "ok" : "warn"),
        metric("Time", result.durationMs ? `${result.durationMs}ms` : "unknown"),
        metric("Mode", result.shellMode || "default")
      ],
      sections: [section("Output", [
        previewLine("stdout", result.stdout || result.stdoutPreview),
        previewLine("stderr", result.stderr || result.stderrPreview)
      ])],
      nextAction: "Review the command output, then call show_changes when the task is complete."
    };
  },

  command_history: (_toolName, result) => {
    const commands = normalizeList((result.commands || []).map((command) => {
      const exit = command.exitCode ?? "unknown";
      return `${command.commandRedacted || command.command || "(unknown command)"} -> exit ${exit}`;
    }));
    return {
      kind: "command",
      title: "Command history",
      status: "ok",
      summary: commands.length ? `${commands.length} recent command(s) recorded.` : "No shell commands were recorded.",
      metrics: [metric("Commands", commands.length)],
      sections: [section("Recent Commands", commands.length ? commands : ["No shell commands were recorded."])],
      nextAction: "Use this history to decide whether more verification is needed."
    };
  },

  show_changes: (_toolName, result) => {
    const changedFiles = normalizeChangedFiles(result);
    const commands = normalizeList((result.commands || result.recentCommands || []).map((command) =>
      `${command.commandRedacted || command.command || "(unknown command)"} -> exit ${command.exitCode ?? "unknown"}`
    ));
    const calls = normalizeList((result.toolCalls || result.recentToolCalls || []).map((event) =>
      `${event.toolName || event.name || "tool"} ${event.ok === false ? "failed" : "ok"}`
    ));
    return {
      kind: "changes",
      title: "Workspace changes",
      status: changedFiles.length ? "warn" : "ok",
      summary: changedFiles.length ? `${changedFiles.length} changed file(s) need review.` : "No file changes reported.",
      changedFiles,
      metrics: [
        metric("Files", changedFiles.length),
        metric("Commands", commands.length),
        metric("Tool calls", calls.length)
      ],
      sections: [
        section("Changed Files", changedFiles.length ? changedFiles : ["No changed files reported."]),
        section("Recent Commands", commands.length ? commands : ["No shell commands were recorded."]),
        section("Recent Tool Calls", calls.length ? calls : ["No recent tool calls were included."])
      ],
      nextAction: "Create a handoff report when the work is ready for Codex review."
    };
  },

  create_handoff_report: buildReportCard,
  submit_reply_to_codex: buildReportCard,
  write_to_codex: buildReportCard
};

function buildReportCard(_toolName, result) {
  const summary = result.summary || {};
  const changed = summary.changedFiles ?? summary.diffFiles ?? 0;
  const commands = summary.commands ?? 0;
  const toolCalls = summary.toolCalls ?? 0;
  return {
    kind: "report",
    title: "Handoff report ready",
    status: "ok",
    summary: "The handoff report is ready. Codex can review the diff, commands, tests, and remaining work.",
    inboxId: result.id || "",
    metrics: [
      metric("Changed", changed),
      metric("Commands", commands),
      metric("Tool calls", toolCalls)
    ],
    sections: [
      section("Report", [
        result.id ? `Run: ${result.id}` : "",
        result.reportPath ? `Report: ${safeRelativePath(result.reportPath)}` : "Report created"
      ]),
      section("Codex Review", [
        "Read the handoff report.",
        "Inspect the actual diff.",
        "Run relevant tests before commit."
      ])
    ],
    nextAction: "Tell Codex to read the latest Bridge handoff report and verify the changes."
  };
}

function fileChangeCard(title, action, result, args) {
  const changedPath = safeRelativePath(result.path || args.path || "");
  const replacementCount = Number.isInteger(result.replaced) ? result.replaced : null;
  return {
    kind: "file_change",
    title,
    status: "ok",
    summary: changedPath ? `${action === "write" ? "Updated" : "Edited"} ${changedPath}.` : "File change completed.",
    changedFiles: changedPath ? [changedPath] : [],
    metrics: [
      metric("Files", changedPath ? 1 : 0),
      metric("Bytes", result.bytes || byteCount(args.content)),
      metric("Replacements", replacementCount === null ? "n/a" : replacementCount)
    ],
    sections: [section("Changed Files", changedPath ? [changedPath] : ["No changed file path returned."])],
    nextAction: "Call show_changes after related edits are complete."
  };
}

function downgradeCardV2(cardV2) {
  const changedFiles = normalizeList(cardV2.changedFiles || firstSectionItems(cardV2, "Changed Files"));
  return {
    kind: legacyKind(cardV2.kind),
    title: cardV2.title,
    status: cardV2.status,
    projectName: cardV2.project && cardV2.project.name,
    summary: cardV2.summary,
    items: normalizeList([
      ...(cardV2.sections || []).flatMap((section) => section.items || []),
      cardV2.nextAction ? `Next: ${cardV2.nextAction}` : ""
    ]),
    command: cardV2.command,
    exitCode: cardV2.exitCode,
    changedFiles,
    inboxId: cardV2.inboxId
  };
}

function normalizeCardV2(card) {
  return {
    version: 2,
    kind: card.kind || "result",
    status: card.status || "ok",
    title: clean(card.title || "Bridge result"),
    project: { name: clean(card.project?.name || "current project", 80) },
    summary: clean(card.summary || "Tool result is available.", 180),
    metrics: normalizeMetrics(card.metrics),
    sections: normalizeSections(card.sections),
    nextAction: clean(card.nextAction || "", 180),
    command: card.command ? clean(card.command, 180) : undefined,
    exitCode: card.exitCode,
    changedFiles: normalizeList(card.changedFiles),
    inboxId: card.inboxId ? clean(card.inboxId, 120) : undefined
  };
}

function normalizeMetrics(metrics) {
  return (metrics || [])
    .filter((item) => item && item.label)
    .map((item) => ({
      label: clean(item.label, 40),
      value: clean(item.value, 80),
      status: item.status ? clean(item.status, 20) : undefined
    }))
    .slice(0, 6);
}

function normalizeSections(sections) {
  return (sections || [])
    .filter((item) => item && item.title)
    .map((item) => ({
      title: clean(item.title, 60),
      items: normalizeList(item.items)
    }))
    .slice(0, 5);
}

function metric(label, value, status) {
  return { label, value: value === undefined || value === null || value === "" ? "n/a" : String(value), status };
}

function section(title, items) {
  return { title, items: normalizeList(items) };
}

function normalizeList(items) {
  return (items || []).filter(Boolean).map((item) => clean(item, 160)).slice(0, 8);
}

function normalizeChangedFiles(result) {
  if (Array.isArray(result.changedFiles)) return normalizeList(result.changedFiles.map(safeRelativePath));
  const statusEntries = result.status?.entries || result.changes?.status?.entries || [];
  if (statusEntries.length) return normalizeList(statusEntries.map((entry) => safeRelativePath(entry.path)));
  const diffFiles = result.diff?.files || result.changes?.diff?.files || [];
  return normalizeList(diffFiles.map((file) => safeRelativePath(file.path || file)));
}

function firstSectionItems(cardV2, title) {
  const sectionMatch = (cardV2.sections || []).find((item) => item.title === title);
  return sectionMatch ? sectionMatch.items : [];
}

function safeProjectName(cwd, result) {
  const root = result.root || result.projectRoot || cwd || "";
  const name = result.projectName || path.basename(String(root));
  return clean(name || "current project", 80);
}

function safeRelativePath(value) {
  const text = String(value || "").replace(/\\/g, "/");
  if (!text) return "";
  return clean(path.isAbsolute(text) ? path.basename(text) : text, 140);
}

function previewLine(label, value) {
  const text = clean(value || "", 160);
  return text ? `${label}: ${text}` : "";
}

function gitStatusLabel(result) {
  if (result.git?.clean || result.status?.clean) return "clean";
  if (Array.isArray(result.git?.statusEntries)) return `${result.git.statusEntries.length} changes`;
  if (Array.isArray(result.status?.entries)) return `${result.status.entries.length} changes`;
  return result.git ? "available" : "unknown";
}

function instructionLabel(result) {
  const files = result.instructions || result.instructionFiles || result.projectInstructions;
  if (Array.isArray(files)) return files.length;
  if (result.hasAgents || result.hasReadme) return "yes";
  return "unknown";
}

function lineCount(text) {
  if (!text) return 0;
  return String(text).split(/\r?\n/).filter(Boolean).length;
}

function byteCount(text) {
  return text ? Buffer.byteLength(String(text), "utf8") : 0;
}

function isVerificationCommand(command) {
  return /\b(test|pytest|ruff|lint|typecheck|check|build|compileall|smoke)\b/i.test(String(command || ""));
}

function legacyKind(kind) {
  if (kind === "report") return "codex";
  if (kind === "file") return "file";
  return kind || "result";
}

function clean(value, maxLength = 120) {
  return redact(String(value || "").replace(/\s+/g, " ").trim()).slice(0, maxLength);
}

function redact(value) {
  return String(value || "")
    .replace(/\.env/gi, "[redacted]")
    .replace(/api[_-]?key/gi, "[redacted]")
    .replace(/token/gi, "[redacted]")
    .replace(/secret/gi, "[redacted]")
    .replace(/password/gi, "[redacted]")
    .replace(/private[_ -]?key/gi, "[redacted]");
}

module.exports = {
  CARD_TOOL_NAMES,
  CHATGPT_CARD_MIME_TYPE,
  CHATGPT_CARD_RESOURCE_URI,
  buildCardV2,
  downgradeCardV2,
  readCardWidgetHtml,
  registerChatGptCardResource,
  withChatGptCardResult,
  withChatGptCardToolConfig
};
