const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const RELEASES_URL = "https://github.com/rp10000/chatgpt-native-bridge/releases/latest";

function formatDesktopDryRun() {
  return `ChatGPT Native Bridge Desktop

Run:
  cgn desktop

Aliases:
  cgn client
  cgn start

First-run flow:
  1. 选择项目
  2. 连接 ChatGPT
  3. 在 ChatGPT 网页端直接操作当前本地项目

After connecting, send this in ChatGPT:
  请使用 chatgpt-native-bridge 打开当前连接项目。你可以直接读取、修改文件并运行必要检查。完成后请生成交接报告，说明改了什么、跑了什么、还需要 Codex 复核什么。

Main buttons:
  - 选择项目
  - 连接 ChatGPT
  - 生成交接报告
  - 帮助

What the client shows:
  - current project
  - connection state
  - ChatGPT tool calls
  - command history
  - file changes
  - handoff report for Codex review

Each project has its own MCP connection slot. ChatGPT can only work on the currently selected project.

Install fallback:
  If the desktop client is not installed in this checkout, open the latest GitHub Release:
  ${RELEASES_URL}

Safety:
  No API key. No browser plugin. No ChatGPT scraping. No hidden web calls.
`;
}

async function launchDesktopClient(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const stdout = options.stdout || process.stdout;
  const openUrlImpl = options.openUrlImpl || openUrl;
  const spawnImpl = options.spawnImpl || spawn;

  if (options.dryRun) {
    stdout.write(formatDesktopDryRun());
    return { dryRun: true, launched: false };
  }

  const electronCommand = resolveElectronCommand({ cwd: options.packageRoot || path.join(__dirname, "..") });
  if (!electronCommand) {
    stdout.write("ChatGPT Native Bridge Desktop is not installed in this checkout.\n");
    stdout.write(`Opening latest release: ${RELEASES_URL}\n`);
    openUrlImpl(RELEASES_URL);
    if (options.webFallback) {
      const { startAppServer } = require("./app-server");
      const server = await startAppServer({ cwd, stdout, openBrowser: true });
      return { launched: false, fallback: "web", url: server.url };
    }
    return { launched: false, releaseUrl: RELEASES_URL };
  }

  const mainPath = path.join(__dirname, "..", "desktop", "main.js");
  const child = spawnImpl(electronCommand, [mainPath, "--root", cwd], {
    cwd: path.join(__dirname, ".."),
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();
  stdout.write("ChatGPT Native Bridge Desktop launched.\n");
  return { launched: true, command: electronCommand };
}

function resolveElectronCommand({ cwd = path.join(__dirname, "..") } = {}) {
  const localBinary = getElectronBinaryPath(path.join(cwd, "node_modules", "electron"));
  if (localBinary && fs.existsSync(localBinary)) return localBinary;

  try {
    const electronPackage = require.resolve("electron", { paths: [cwd] });
    const electronRoot = path.dirname(path.dirname(electronPackage));
    const binary = getElectronBinaryPath(electronRoot);
    if (fs.existsSync(binary)) return binary;
  } catch {
    // Missing Electron should fall back to the release page.
  }

  return null;
}

function getElectronBinaryPath(electronRoot) {
  if (!electronRoot) return null;
  if (process.platform === "win32") return path.join(electronRoot, "dist", "electron.exe");
  if (process.platform === "darwin") return path.join(electronRoot, "dist", "Electron.app", "Contents", "MacOS", "Electron");
  return path.join(electronRoot, "dist", "electron");
}

function openUrl(url) {
  if (process.platform === "win32") {
    spawnSync("cmd.exe", ["/c", "start", "", url], { stdio: "ignore", windowsHide: true });
    return;
  }
  if (process.platform === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
    return;
  }
  spawnSync("xdg-open", [url], { stdio: "ignore" });
}

module.exports = {
  RELEASES_URL,
  formatDesktopDryRun,
  getElectronBinaryPath,
  launchDesktopClient,
  resolveElectronCommand
};
