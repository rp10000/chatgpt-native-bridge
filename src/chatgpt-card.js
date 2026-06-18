const fs = require("node:fs/promises");
const path = require("node:path");

const CHATGPT_CARD_RESOURCE_URI = "ui://chatgpt-native-bridge/workspace-card.html";
const CHATGPT_CARD_MIME_TYPE = "text/html;profile=mcp-app";

const CARD_TOOL_NAMES = new Set([
  "open_workspace",
  "write",
  "edit",
  "bash",
  "show_changes",
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
  "openai/widgetDescription": "Shows local workspace, command, file-change, and Codex write-back status.",
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
      description: "Inline ChatGPT card for workspace commands, file changes, and Codex write-back.",
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
  if (!CARD_TOOL_NAMES.has(toolName) || !result || typeof result !== "object" || result.card) {
    return result;
  }

  return {
    ...result,
    card: buildCard(toolName, result, args, context)
  };
}

function buildCard(toolName, result, args, context) {
  const projectName = safeProjectName(context.cwd, result);
  if (toolName === "open_workspace") {
    return baseCard({
      kind: "workspace",
      title: "Workspace opened",
      status: "ok",
      projectName,
      summary: "ChatGPT is connected to this local project.",
      items: [
        result.workspaceId ? `workspace: ${result.workspaceId}` : "",
        result.open === false ? "workspace not open" : "ready"
      ]
    });
  }

  if (toolName === "bash") {
    const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : null;
    const status = exitCode === 0 ? "ok" : "warn";
    return baseCard({
      kind: "command",
      title: "Command finished",
      status,
      projectName,
      summary: exitCode === null ? "A workspace command finished." : `Exit code ${exitCode}.`,
      command: redact(args.command || result.command || ""),
      exitCode,
      items: [
        previewLine("stdout", result.stdout || result.stdoutPreview),
        previewLine("stderr", result.stderr || result.stderrPreview)
      ]
    });
  }

  if (toolName === "write" || toolName === "edit") {
    const changedPath = result.path || args.path || "";
    return baseCard({
      kind: "file_change",
      title: toolName === "write" ? "File written" : "File edited",
      status: "ok",
      projectName,
      summary: changedPath ? `${toolName === "write" ? "Updated" : "Edited"} ${safeRelativePath(changedPath)}.` : "File change completed.",
      changedFiles: changedPath ? [safeRelativePath(changedPath)] : [],
      items: [
        result.bytes ? `${result.bytes} bytes` : "",
        Number.isInteger(result.replaced) ? `${result.replaced} replacement(s)` : ""
      ]
    });
  }

  if (toolName === "show_changes") {
    const changedFiles = Array.isArray(result.changedFiles) ? result.changedFiles.map(safeRelativePath).slice(0, 8) : [];
    return baseCard({
      kind: "changes",
      title: "Workspace changes",
      status: changedFiles.length ? "warn" : "ok",
      projectName,
      summary: changedFiles.length ? `${changedFiles.length} changed file(s).` : "No file changes reported.",
      changedFiles,
      items: changedFiles
    });
  }

  return baseCard({
    kind: "codex",
    title: "Written back to Codex",
    status: "ok",
    projectName,
    summary: "The final ChatGPT reply is ready for Codex.",
    inboxId: result.id || args.id || "",
    items: [result.id ? `inbox: ${result.id}` : "Codex inbox updated"]
  });
}

function baseCard(card) {
  return {
    kind: card.kind,
    title: clean(card.title),
    status: card.status || "ok",
    projectName: clean(card.projectName || ""),
    summary: clean(card.summary || ""),
    items: normalizeList(card.items),
    command: card.command ? clean(card.command, 160) : undefined,
    exitCode: card.exitCode,
    changedFiles: normalizeList(card.changedFiles),
    inboxId: card.inboxId ? clean(card.inboxId, 120) : undefined
  };
}

function normalizeList(items) {
  return (items || []).filter(Boolean).map((item) => clean(item, 140)).slice(0, 8);
}

function safeProjectName(cwd, result) {
  const root = result.root || result.projectRoot || cwd || "";
  const name = result.projectName || path.basename(String(root));
  return name || "current project";
}

function safeRelativePath(value) {
  const text = String(value || "").replace(/\\/g, "/");
  return clean(path.isAbsolute(text) ? path.basename(text) : text, 140);
}

function previewLine(label, value) {
  const text = clean(value || "", 160);
  return text ? `${label}: ${text}` : "";
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
  buildCard,
  readCardWidgetHtml,
  registerChatGptCardResource,
  withChatGptCardResult,
  withChatGptCardToolConfig
};
