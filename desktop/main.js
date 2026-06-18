const path = require("node:path");

const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, shell } = require("electron");

const { createDesktopHandlers, invokeDesktopHandler } = require("../src/desktop-ipc");

const CHANNELS = [
  "project:get",
  "project:list",
  "project:add",
  "project:select",
  "project:permissions-get",
  "project:permissions-update",
  "status:get",
  "approval:list",
  "approval:resolve",
  "changes:get",
  "changes:copy-summary",
  "command:list",
  "command:get-output",
  "command:cancel",
  "pro:create-pack",
  "pro:copy-latest-pack",
  "pro:start-watch",
  "pro:manual-import",
  "handoff:create-report",
  "chatgpt:open",
  "chatgpt:copy-review-prompt",
  "mcp:connect-or-refresh",
  "mcp:validate-connection",
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
    width: 1040,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    title: "ChatGPT Native Bridge",
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#ffc400",
    icon: path.join(__dirname, "assets", "avatar.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function registerIpc() {
  for (const channel of CHANNELS) {
    ipcMain.handle(channel, async (_event, payload) => {
      if ((channel === "project:select" || channel === "project:add") && (!payload || !payload.path)) {
        const selected = await dialog.showOpenDialog(mainWindow, {
          title: "Select Codex project",
          properties: ["openDirectory"]
        });
        if (selected.canceled || !selected.filePaths.length) {
          return invokeDesktopHandler(handlers, channel, {});
        }
        return invokeDesktopHandler(handlers, channel, { path: selected.filePaths[0] });
      }
      return invokeDesktopHandler(handlers, channel, payload);
    });
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  handlers = createDesktopHandlers({
    cwd: parseRoot(process.argv),
    clipboard,
    shell
  });
  registerIpc();
  registerWindowIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function registerWindowIpc() {
  ipcMain.handle("window:minimize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    return { minimized: true };
  });
  ipcMain.handle("window:toggle-maximize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return { maximized: false };
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return { maximized: mainWindow.isMaximized() };
  });
  ipcMain.handle("window:close", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
    return { closed: true };
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  if (handlers && handlers.dispose) await handlers.dispose();
});
