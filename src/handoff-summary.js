const fs = require("node:fs/promises");
const path = require("node:path");

async function getHandoffSummary(outboxDir) {
  const askPath = path.join(outboxDir, "ask.md");
  const uploadItems = [];

  for (const item of uploadCandidates(outboxDir)) {
    const kind = await existingKind(item.path);
    if (kind) uploadItems.push({ ...item, kind });
  }

  return {
    outboxDir,
    askPath,
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
    "ChatGPT handoff:",
    `Mode: ${mode}`,
    `Outbox: ${summary.outboxDir}`,
    `Paste prompt: ${summary.askPath}`,
    `Ask copied: ${copied}`,
    `Browser opened: ${browserOpened}`
  ];

  if (folderOpened !== null) lines.push(`Outbox folder opened: ${folderOpened}`);

  lines.push("", "Upload/select in ChatGPT:");
  if (summary.uploadItems.length) {
    for (const item of summary.uploadItems) {
      const hint = item.kind === "directory" ? "open this folder and choose relevant files" : item.hint;
      lines.push(`- ${item.label}: ${item.path}${hint ? ` (${hint})` : ""}`);
    }
  } else {
    lines.push("- None.");
  }

  const pasteStep = state.copied
    ? "1. Paste the copied prompt into ChatGPT."
    : "1. Copy ask.md manually, then paste it into ChatGPT.";

  lines.push(
    "",
    "Next:",
    pasteStep,
    "2. Upload only the listed files that the task needs.",
    "3. After ChatGPT replies, copy the final answer and run: cgn done"
  );

  return `${lines.join("\n")}\n`;
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

module.exports = {
  formatHandoffSummary,
  getHandoffSummary
};
