const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = new Set([
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
]);

contextBridge.exposeInMainWorld("bridge", {
  invoke(channel, payload) {
    if (!CHANNELS.has(channel)) {
      return Promise.resolve({ ok: false, error: `Blocked channel: ${channel}` });
    }
    return ipcRenderer.invoke(channel, payload || {});
  }
});
