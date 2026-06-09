const fs = require("node:fs/promises");
const path = require("node:path");

async function getHandoffSummary(outboxDir) {
  const id = path.basename(outboxDir);
  const bridgeDir = path.dirname(path.dirname(outboxDir));
  const cwd = path.dirname(bridgeDir);
  const pastePromptPath = await firstExistingPath([
    path.join(outboxDir, "01_PASTE_TO_CHATGPT.md"),
    path.join(outboxDir, "ask.md")
  ]);
  const startHerePath = path.join(outboxDir, "START_HERE.md");
  const uploadListPath = path.join(outboxDir, "02_UPLOAD_THESE_FILES.md");
  const afterReplyPath = path.join(outboxDir, "03_AFTER_CHATGPT_REPLY.md");
  const replyPath = path.join(cwd, ".chatgpt-native", "inbox", id, "reply.md");
  const uploadItems = [];

  for (const item of uploadCandidates(outboxDir)) {
    const kind = await existingKind(item.path);
    if (kind) uploadItems.push({ ...item, kind });
  }

  return {
    id,
    outboxDir,
    startHerePath,
    pastePromptPath,
    uploadListPath,
    afterReplyPath,
    replyPath,
    uploadItems
  };
}

function formatHandoffSummary(summary, state = {}) {
  const mode = state.mode || "manual";
  const copied = state.copied ? "yes" : "no";
  const browserOpened = state.opened ? "yes" : "no";
  const folderOpened = state.folderOpened === undefined ? null : state.folderOpened ? "yes" : "no";

  const lines = [
    "",
    "ChatGPT handoff ready",
    "",
    "Run id:",
    `  ${summary.id}`,
    "",
    `Mode: ${mode}`,
    `Ask copied: ${copied}`,
    `Browser opened: ${browserOpened}`
  ];

  if (folderOpened !== null) lines.push(`Outbox folder opened: ${folderOpened}`);

  const pasteStep = state.copied
    ? "1. Paste the copied prompt into ChatGPT:"
    : "1. Copy this file, then paste it into ChatGPT:";

  lines.push(
    "",
    pasteStep,
    "Paste prompt file:",
    `  ${summary.pastePromptPath}`,
    "",
    "2. Upload/select files listed here:",
    "Upload/select in ChatGPT:",
    `  ${summary.uploadListPath}`,
    "",
    "3. If you want the full local instructions, open:",
    `  ${summary.startHerePath}`,
    "",
    "4. After ChatGPT replies, follow this file:",
    `  ${summary.afterReplyPath}`,
    "  Then copy the final answer and run:",
    "  cgn done",
    "",
    "5. Codex should then read:",
    `  ${summary.replyPath}`,
    "",
    "Outbox:",
    `  ${summary.outboxDir}`,
    "",
    "Local upload candidates:",
    ...formatUploadItems(summary.uploadItems),
    "",
    "Safety:",
    "  No browser automation, no auto-upload, no auto-submit, no ChatGPT scraping."
  );

  return `${lines.join("\n")}\n`;
}

function formatUploadItems(uploadItems) {
  if (!uploadItems.length) return ["- None."];
  return uploadItems.map((item) => {
    const hint = item.kind === "directory" ? "open this folder and choose relevant files" : item.hint;
    return `- ${item.label}: ${item.path}${hint ? ` (${hint})` : ""}`;
  });
}

function uploadCandidates(outboxDir) {
  return [
    {
      label: "Context",
      path: path.join(outboxDir, "context.md"),
      hint: "recommended"
    },
    {
      label: "Diff",
      path: path.join(outboxDir, "diff.patch"),
      hint: "if reviewing changes"
    },
    {
      label: "Test output",
      path: path.join(outboxDir, "test-output.md"),
      hint: "if reviewing test results"
    },
    {
      label: "Selected files",
      path: path.join(outboxDir, "files")
    },
    {
      label: "Screenshots",
      path: path.join(outboxDir, "screenshots")
    }
  ];
}

async function existingKind(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isDirectory() ? "directory" : "file";
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (await existingKind(candidate)) return candidate;
  }
  return candidates[0];
}

module.exports = {
  formatHandoffSummary,
  getHandoffSummary
};
