const path = require("node:path");

const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require("electron");

const { createDesktopHandlers, invokeDesktopHandler } = require("../src/desktop-ipc");

const CHANNELS = [
  "project:get",
  "project:select",
  "status:get",
  "pro:create-pack",
  "pro:start-watch",
  "pro:manual-import",
  "chatgpt:open",
  "chatgpt:copy-review-prompt",
  "mcp:start",
  "mcp:trace",
  "codex:copy-continue-prompt"
];

let mainWindow = null;
let handlers = null;

function parseRoot(argv) {
  const index = argv.indexOf("--root");
  if (index !== -1 && argv[index + 1]) return path.resolve(argv[index + 1]);
  return process.cwd();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 390,
    minHeight: 620,
    title: "ChatGPT Native Bridge",
    backgroundColor: "#ffc400",
    icon: path.join(__dirname, "assets", "avatar.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function registerIpc() {
  for (const channel of CHANNELS) {
    ipcMain.handle(channel, async (_event, payload) => {
      if (channel === "project:select" && (!payload || !payload.path)) {
        const selected = await dialog.showOpenDialog(mainWindow, {
          title: "Select Codex project",
          properties: ["openDirectory"]
        });
        if (selected.canceled || !selected.filePaths.length) {
          return invokeDesktopHandler(handlers, "project:get", {});
        }
        return invokeDesktopHandler(handlers, channel, { path: selected.filePaths[0] });
      }
      return invokeDesktopHandler(handlers, channel, payload);
    });
  }
}

app.whenReady().then(() => {
  handlers = createDesktopHandlers({
    cwd: parseRoot(process.argv),
    clipboard,
    shell
  });
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  if (handlers && handlers.dispose) await handlers.dispose();
});
