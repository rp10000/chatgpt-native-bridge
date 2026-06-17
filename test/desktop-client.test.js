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
  assert.match(text, /Pro 深度规划/);
  assert.match(text, /Thinking 工具复核/);
  assert.match(text, /写回 Codex/);
  assert.match(text, /No API key/);
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
