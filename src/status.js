const fs = require("node:fs/promises");
const path = require("node:path");

const { pathExists } = require("./fs-utils");

async function getStatus(options = {}) {
  const cwd = options.cwd || process.cwd();
  const outboxDir = path.join(cwd, ".chatgpt-native", "outbox");
  const inboxDir = path.join(cwd, ".chatgpt-native", "inbox");
  const ids = await listDirs(outboxDir);
  const pending = [];
  const ready = [];

  for (const id of ids) {
    const replyPath = path.join(inboxDir, id, "reply.md");
    const item = {
      id,
      outboxDir: path.join(outboxDir, id),
      replyPath: (await pathExists(replyPath)) ? replyPath : null
    };
    if (item.replyPath) ready.push(item);
    else pending.push(item);
  }

  return { pending, ready };
}

function formatStatus(status) {
  const lines = [];
  lines.push("pending:");
  if (status.pending.length) {
    for (const item of status.pending) lines.push(`- ${item.id}`);
  } else {
    lines.push("- none");
  }

  lines.push("ready:");
  if (status.ready.length) {
    for (const item of status.ready) lines.push(`- ${item.id}`);
  } else {
    lines.push("- none");
  }

  return `${lines.join("\n")}\n`;
}

async function listDirs(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

module.exports = {
  formatStatus,
  getStatus
};
