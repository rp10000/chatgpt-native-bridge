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
  assert.match(text, /1\. 选择项目/);
  assert.match(text, /2\. 连接 ChatGPT/);
  assert.match(text, /3\. 在 ChatGPT 网页端直接操作当前本地项目/);
  assert.match(text, /请使用 chatgpt-native-bridge 打开当前连接项目/);
  assert.match(text, /生成交接报告/);
  assert.match(text, /帮助/);
  assert.match(text, /handoff report for Codex review/);
  assert.match(text, /Each project has its own MCP connection slot/);
  assert.match(text, /No API key/);
});

test("desktop renderer keeps the main client surface minimal and includes built-in help", async () => {
  const root = path.join(__dirname, "..");
  const html = await fs.readFile(path.join(root, "desktop", "renderer", "index.html"), "utf8");
  const css = await fs.readFile(path.join(root, "desktop", "renderer", "styles.css"), "utf8");
  const app = await fs.readFile(path.join(root, "desktop", "renderer", "app.js"), "utf8");

  assert.match(html, /class="window-chrome"/);
  assert.match(html, /id="windowMinimize"/);
  assert.match(html, /id="windowMaximize"/);
  assert.match(html, /id="windowClose"/);
  assert.match(html, /id="projectName"/);
  assert.match(html, /id="projectPath"/);
  assert.match(html, /id="statusLamp"/);
  assert.match(html, /id="statusTitle"/);
  assert.match(html, /id="statusText"/);
  assert.match(html, /id="languageToggle"/);
  assert.match(html, /id="helpOpen"/);
  assert.match(html, /id="helpModal"/);
  assert.match(html, /data-help-tab="connect"/);
  assert.match(html, /data-help-tab="chatgpt"/);
  assert.match(html, /data-help-tab="empty"/);
  assert.match(html, /data-help-tab="models"/);
  assert.match(html, /data-i18n="connectChatGPT"/);
  assert.match(html, /选择项目/);
  assert.match(html, /连接 ChatGPT/);
  assert.match(html, /生成交接报告/);
  assert.match(html, /查看过程/);
  assert.match(html, /备用方式/);
  assert.match(html, /id="copyLatestProPack"/);
  assert.doesNotMatch(html, />打开 ChatGPT</);

  for (const asset of [
    "help-connect.svg",
    "help-chatgpt.svg",
    "help-card-empty.svg",
    "help-pro.svg"
  ]) {
    assert.equal(await exists(path.join(root, "desktop", "assets", "help", asset)), true, asset);
  }

  assert.match(css, /\.status-lamp/);
  assert.match(css, /\.status-connected/);
  assert.match(css, /\.status-accessed/);
  assert.match(css, /\.status-called/);
  assert.match(css, /\.status-reported/);
  assert.match(css, /\.status-error/);
  assert.match(css, /\.lamp-orb/);
  assert.match(css, /\.language-toggle/);
  assert.match(css, /\.help-toggle/);
  assert.match(css, /\.help-modal/);
  assert.match(css, /\.help-card/);
  assert.match(css, /\.help-tabs/);
  assert.match(css, /\.primary-action/);
  assert.match(css, /\.report-action/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@keyframes lampPulse/);
  assert.match(css, /@keyframes orbRing/);
  assert.match(css, /@keyframes auraDrift/);
  assert.match(css, /@keyframes panelGlow/);
  assert.match(css, /\.window-chrome/);
  assert.match(css, /-webkit-app-region: drag/);
  assert.match(css, /prefers-reduced-motion/);

  assert.match(app, /"zh-CN"/);
  assert.match(app, /currentProject: "当前项目"/);
  assert.match(app, /connectChatGPT: "连接 ChatGPT"/);
  assert.match(app, /languageToggle: "EN"/);
  assert.match(app, /currentProject: "Current Project"/);
  assert.match(app, /connectChatGPT: "Connect ChatGPT"/);
  assert.match(app, /reportedTitle: "Handoff Report Created"/);
  assert.match(app, /languageToggle: "中文"/);
  assert.match(app, /bridge_card_test/);
  assert.match(app, /xhigh\/high/);
  assert.match(app, /status-lamp status-/);
  assert.match(app, /renderHelp/);
  assert.match(app, /help-card-empty\.svg/);
  assert.match(app, /mcp:connect-or-refresh/);
  assert.match(app, /handoff:create-report/);
  assert.match(app, /command:list/);
  assert.match(app, /changes:get/);
  assert.match(app, /pro:copy-latest-pack/);
  assert.match(app, /window:minimize/);
  assert.match(app, /window:toggle-maximize/);
  assert.match(app, /window:close/);
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

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

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
