const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  RELEASES_URL,
  formatDesktopDryRun,
  getElectronBinaryPath,
  launchDesktopClient,
  resolveElectronCommand
} = require("../src/desktop-client");

test("desktop dry-run explains the final client entry", () => {
  const text = formatDesktopDryRun();

  assert.match(text, /ChatGPT Native Bridge Desktop/);
  assert.match(text, /cgn desktop/);
  assert.match(text, /cgn client/);
  assert.match(text, /cgn start/);
  assert.match(text, /连接 ChatGPT/);
  assert.match(text, /开始处理/);
  assert.match(text, /查看结果/);
  assert.match(text, /交给 Codex/);
  assert.match(text, /Pro 辅助规划/);
  assert.match(text, /ChatGPT tool calls/);
  assert.match(text, /cannot read local files directly/);
  assert.match(text, /Each project has its own MCP connection slot/);
  assert.match(text, /Reuse the current project Server URL/);
  assert.match(text, /No API key/);
});

test("desktop renderer has project connection rows and no standalone ChatGPT open button", async () => {
  const root = path.join(__dirname, "..");
  const html = await fs.readFile(path.join(root, "desktop", "renderer", "index.html"), "utf8");
  const css = await fs.readFile(path.join(root, "desktop", "renderer", "styles.css"), "utf8");
  const app = await fs.readFile(path.join(root, "desktop", "renderer", "app.js"), "utf8");

  assert.match(html, /id="projectList"/);
  assert.match(html, /class="window-chrome"/);
  assert.match(html, /id="windowMinimize"/);
  assert.match(html, /id="windowMaximize"/);
  assert.match(html, /id="windowClose"/);
  assert.match(html, /本地工作区/);
  assert.match(html, /工作区时间线/);
  assert.match(html, /开始处理/);
  assert.match(html, /查看结果/);
  assert.match(html, /交给 Codex/);
  assert.match(html, /ChatGPT 调用记录/);
  assert.match(html, /命令输出/);
  assert.match(html, /文件变更/);
  assert.match(html, /写回 Codex/);
  assert.match(html, /id="workspaceSignal"/);
  assert.match(html, /id="signalTitle"/);
  assert.match(html, /id="signalText"/);
  assert.match(html, /id="toolCallsEmpty"/);
  assert.match(html, /id="commandOutputEmpty"/);
  assert.match(html, /id="changeSummaryEmpty"/);
  assert.match(html, /id="replyPreviewEmpty"/);
  assert.match(html, /id="copyLatestProPack"/);
  assert.doesNotMatch(html, />打开 ChatGPT</);
  assert.doesNotMatch(html, /开始复核/);
  assert.match(css, /\.project-state-connected/);
  assert.match(css, /\.project-state-reviewing/);
  assert.match(css, /\.project-state-ready/);
  assert.match(css, /\.workspace-signal/);
  assert.match(css, /\.signal-connected/);
  assert.match(css, /\.signal-called/);
  assert.match(css, /\.signal-written/);
  assert.match(css, /\.signal-orb/);
  assert.match(css, /@keyframes signalPulse/);
  assert.match(css, /\.workspace/);
  assert.match(css, /\.result-grid/);
  assert.match(css, /\.panel-empty/);
  assert.match(css, /\.result-panel\.is-empty/);
  assert.match(css, /\.result-panel\.has-content/);
  assert.match(css, /\.window-chrome/);
  assert.match(css, /-webkit-app-region: drag/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(app, /project-state-reviewing/);
  assert.match(app, /renderWorkspaceSignal/);
  assert.match(app, /setPanelState/);
  assert.match(app, /workspace-connected/);
  assert.match(app, /已连接，可以用了/);
  assert.match(app, /ChatGPT 已经在用本地工具/);
  assert.match(app, /已有结果，交给 Codex/);
  assert.match(app, /等待 ChatGPT 调用工具/);
  assert.match(app, /mcp:connect-or-refresh/);
  assert.match(app, /command:list/);
  assert.match(app, /changes:get/);
  assert.match(app, /pro:copy-latest-pack/);
  assert.match(app, /window:minimize/);
  assert.match(app, /window:toggle-maximize/);
  assert.match(app, /window:close/);
  assert.doesNotMatch(app, /开始复核/);
  assert.doesNotMatch(app, /openChatgpt: true/);
});

test("desktop main uses a frameless window without the default menu bar", async () => {
  const root = path.join(__dirname, "..");
  const main = await fs.readFile(path.join(root, "desktop", "main.js"), "utf8");
  const preload = await fs.readFile(path.join(root, "desktop", "preload.js"), "utf8");

  assert.match(main, /frame: false/);
  assert.match(main, /autoHideMenuBar: true/);
  assert.match(main, /Menu\.setApplicationMenu\(null\)/);
  assert.match(main, /setMenuBarVisibility\(false\)/);
  for (const channel of ["window:minimize", "window:toggle-maximize", "window:close"]) {
    assert.match(main, new RegExp(`"${channel}"`));
    assert.match(preload, new RegExp(`"${channel}"`));
  }
});

test("resolveElectronCommand finds a local Electron binary", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-electron-"));
  const electronPath = getElectronBinaryPath(path.join(root, "node_modules", "electron"));
  await fs.mkdir(path.dirname(electronPath), { recursive: true });
  await fs.writeFile(electronPath, "");

  assert.equal(resolveElectronCommand({ cwd: root }), electronPath);
});

test("resolveElectronCommand ignores an Electron shim without the binary", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-electron-shim-"));
  const bin = path.join(root, "node_modules", ".bin");
  await fs.mkdir(bin, { recursive: true });
  const command = process.platform === "win32" ? "electron.cmd" : "electron";
  await fs.writeFile(path.join(bin, command), "");

  assert.equal(resolveElectronCommand({ cwd: root }), null);
});

test("desktop launcher opens release page when client is not installed", async () => {
  const packageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-missing-"));
  let opened = "";
  const io = createIo();

  const result = await launchDesktopClient({
    cwd: packageRoot,
    packageRoot,
    stdout: io.stdout,
    openUrlImpl(url) {
      opened = url;
    }
  });

  assert.equal(result.launched, false);
  assert.equal(result.releaseUrl, RELEASES_URL);
  assert.equal(opened, RELEASES_URL);
  assert.match(io.output(), /Desktop is not installed/);
});

function createIo() {
  let stdout = "";
  return {
    stdout: {
      write(chunk) {
        stdout += chunk;
      }
    },
    output() {
      return stdout;
    }
  };
}
