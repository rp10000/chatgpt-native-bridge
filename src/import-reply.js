const fs = require("node:fs/promises");
const path = require("node:path");

const { readFromClipboard } = require("./clipboard");
const { ensureDir } = require("./fs-utils");
const { resolveRunId } = require("./id");

async function importReply(options) {
  const cwd = options.cwd || process.cwd();
  const id = await resolveRunId(cwd, options.id || "latest");
  let text = options.text;

  if (text === undefined && options.fromClipboard) {
    text = readFromClipboard();
  }

  if (text === undefined && options.sourceFile) {
    text = await fs.readFile(path.resolve(cwd, options.sourceFile), "utf8");
  }

  if (text === undefined) {
    throw new Error("Provide a reply file, --from-clipboard, or text.");
  }

  const inboxDir = path.join(cwd, ".chatgpt-native", "inbox", id);
  const replyPath = path.join(inboxDir, "reply.md");
  await ensureDir(inboxDir);
  await fs.writeFile(replyPath, text);

  return { id, replyPath };
}

module.exports = {
  importReply
};
