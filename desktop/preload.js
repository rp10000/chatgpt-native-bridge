const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = new Set([
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
  "codex:copy-continue-prompt",
  "window:minimize",
  "window:toggle-maximize",
  "window:close"
]);

contextBridge.exposeInMainWorld("bridge", {
  invoke(channel, payload) {
    if (!CHANNELS.has(channel)) {
      return Promise.resolve({ ok: false, error: `Blocked channel: ${channel}` });
    }
    return ipcRenderer.invoke(channel, payload || {});
  }
});
