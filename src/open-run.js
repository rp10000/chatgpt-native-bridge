const fs = require("node:fs/promises");
const path = require("node:path");

const { spawnSync } = require("node:child_process");
const { copyToClipboard } = require("./clipboard");
const { getHandoffSummary } = require("./handoff-summary");
const { resolveRunId } = require("./id");

async function openRun(options) {
  const cwd = options.cwd || process.cwd();
  const id = await resolveRunId(cwd, options.id || "latest");
  const outboxDir = path.join(cwd, ".chatgpt-native", "outbox", id);
  const askPath = path.join(outboxDir, "ask.md");
  const ask = await fs.readFile(askPath, "utf8");

  let copied = false;
  let opened = false;
  let folderOpened = false;
  if (options.copyPrompt !== false) {
    copyToClipboard(ask);
    copied = true;
  }

  if (options.openBrowser !== false) {
    openUrl(options.url || "https://chatgpt.com");
    opened = true;
  }

  if (options.openFolder === true) {
    openPath(outboxDir);
    folderOpened = true;
  }

  return {
    id,
    outboxDir,
    askPath,
    copied,
    opened,
    folderOpened,
    summary: await getHandoffSummary(outboxDir)
  };
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

function openPath(targetPath) {
  if (process.platform === "win32") {
    spawnSync("explorer.exe", [targetPath], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  if (process.platform === "darwin") {
    spawnSync("open", [targetPath], { stdio: "ignore" });
    return;
  }

  spawnSync("xdg-open", [targetPath], { stdio: "ignore" });
}

module.exports = {
  openRun
};
