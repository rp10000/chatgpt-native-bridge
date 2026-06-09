const fs = require("node:fs/promises");
const path = require("node:path");

const { spawnSync } = require("node:child_process");
const { copyToClipboard } = require("./clipboard");
const { resolveRunId } = require("./id");

async function openRun(options) {
  const cwd = options.cwd || process.cwd();
  const id = await resolveRunId(cwd, options.id || "latest");
  const outboxDir = path.join(cwd, ".chatgpt-native", "outbox", id);
  const askPath = path.join(outboxDir, "ask.md");
  const ask = await fs.readFile(askPath, "utf8");

  let copied = false;
  let opened = false;
  if (options.copyPrompt !== false) {
    copyToClipboard(ask);
    copied = true;
  }

  if (options.openBrowser !== false) {
    openUrl(options.url || "https://chatgpt.com");
    opened = true;
  }

  return { id, outboxDir, askPath, copied, opened };
}

function openUrl(url) {
  if (process.platform === "win32") {
    spawnSync("cmd.exe", ["/c", "start", "", url], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  if (process.platform === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
    return;
  }

  spawnSync("xdg-open", [url], { stdio: "ignore" });
}

module.exports = {
  openRun
};
