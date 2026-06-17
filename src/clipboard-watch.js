const { importProReply, parseProReply } = require("./pro-relay");

const WATCH_TIMEOUT_MS = 20 * 60 * 1000;
const WATCH_INTERVAL_MS = 2000;

function startClipboardWatch({ cwd, id, timeoutMs, readFromClipboardImpl, onImported }) {
  const startedAt = new Date();
  const state = {
    id,
    state: "watching",
    startedAt: startedAt.toISOString(),
    expiresAt: new Date(startedAt.getTime() + Number(timeoutMs || WATCH_TIMEOUT_MS)).toISOString(),
    lastCheckAt: null,
    importedAt: null,
    error: null,
    reason: null
  };
  let lastText = "";
  let stopped = false;
  let interval = null;
  let timeout = null;

  const stop = (reason) => {
    if (stopped) return;
    stopped = true;
    state.state = state.state === "imported" ? "imported" : "stopped";
    state.reason = reason;
    if (interval) clearInterval(interval);
    if (timeout) clearTimeout(timeout);
  };

  const tick = async () => {
    if (stopped) return;
    state.lastCheckAt = new Date().toISOString();
    try {
      const text = readFromClipboardImpl();
      if (!text || text === lastText) return;
      lastText = text;
      const parsed = parseProReply(text, id);
      if (!parsed.ok) return;
      const result = await importProReply({ cwd, id, text });
      state.state = "imported";
      state.importedAt = new Date().toISOString();
      state.replyPath = result.replyPath;
      state.codexReadThisPath = result.codexReadThisPath;
      stop("imported");
      if (onImported) onImported(result);
    } catch (error) {
      state.error = error.message;
    }
  };

  interval = setInterval(() => {
    tick();
  }, WATCH_INTERVAL_MS);
  timeout = setTimeout(() => {
    stop("timeout");
  }, Number(timeoutMs || WATCH_TIMEOUT_MS));
  tick();

  return {
    stop,
    publicState: () => ({ ...state })
  };
}

module.exports = {
  WATCH_INTERVAL_MS,
  WATCH_TIMEOUT_MS,
  startClipboardWatch
};
