const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createAsk } = require("../src/ask");
const { main } = require("../src/cli");
const { importReply } = require("../src/import-reply");
const { initProject } = require("../src/init");

test("demo prints the GUI-first bridge workflow", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-demo-")));

  await main(["demo"], io);

  assert.match(io.output(), /30-second chatgpt-native-bridge demo/);
  assert.match(io.output(), /cgn start/);
  assert.match(io.output(), /Main path/);
  assert.match(io.output(), /Pro helper path/);
  assert.match(io.output(), /cgn setup/);
  assert.match(io.output(), /cgn setup --mcp/);
  assert.match(io.output(), /cgn mcp install/);
  assert.match(io.output(), /cgn mcp connect --yes --open/);
  assert.match(io.output(), /cgn mcp wait/);
  assert.match(io.output(), /cgn mcp web/);
  assert.match(io.output(), /cgn handoff --task "Review onboarding UX"/);
  assert.match(io.output(), /cgn done/);
  assert.match(io.output(), /\.chatgpt-native\/inbox\/\{id\}\/reply\.md/);
});

test("help lists beginner guidance commands", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-help-")));

  await main(["--help"], io);

  assert.match(io.output(), /cgn start/);
  assert.match(io.output(), /cgn desktop/);
  assert.match(io.output(), /cgn client/);
  assert.match(io.output(), /cgn app/);
  assert.match(io.output(), /cgn setup/);
  assert.match(io.output(), /cgn setup --mcp/);
  assert.match(io.output(), /cgn mcp install/);
  assert.match(io.output(), /cgn mcp connect --yes --open/);
  assert.match(io.output(), /cgn mcp trace/);
  assert.match(io.output(), /cgn mcp web/);
  assert.match(io.output(), /cgn mcp tunnel/);
  assert.match(io.output(), /cgn mcp serve/);
  assert.match(io.output(), /cgn mcp config/);
  assert.match(io.output(), /cgn agent start/);
  assert.match(io.output(), /cgn handoff/);
  assert.match(io.output(), /cgn done/);
  assert.match(io.output(), /cgn demo/);
  assert.match(io.output(), /cgn doctor/);
  assert.match(io.output(), /cgn guide codex/);
  assert.match(io.output(), /--mode manual/);
  assert.match(io.output(), /--mode auto/);
});

test("start dry-run explains the desktop client", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-start-dry-run-")));

  await main(["start", "--dry-run"], io);

  assert.match(io.output(), /ChatGPT Native Bridge Desktop/);
  assert.match(io.output(), /连接 ChatGPT/);
  assert.match(io.output(), /开始复核/);
  assert.match(io.output(), /交给 Codex/);
  assert.match(io.output(), /Pro 辅助规划/);

  const desktopIo = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-desktop-dry-run-")));
  await main(["desktop", "--dry-run"], desktopIo);
  assert.match(desktopIo.output(), /ChatGPT Native Bridge Desktop/);

  const clientIo = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-client-dry-run-")));
  await main(["client", "--dry-run"], clientIo);
  assert.match(clientIo.output(), /ChatGPT Native Bridge Desktop/);

  const aliasIo = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-app-dry-run-")));
  await main(["app", "--dry-run"], aliasIo);
  assert.match(aliasIo.output(), /local GUI/);
  assert.match(aliasIo.output(), /http:\/\/127\.0\.0\.1:47833/);
});

test("agent start creates a local agent run and Codex inbox reply", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-agent-start-"));
  const io = createIo(cwd);

  await initProject({ cwd });
  await main(["agent", "start", "--task", "Review current project"], io);

  assert.match(io.output(), /local agent/);
  assert.match(io.output(), /State:\n  completed/);
  assert.match(io.output(), /Codex inbox:/);

  const inbox = path.join(cwd, ".chatgpt-native", "inbox");
  const entries = await fs.readdir(inbox, { withFileTypes: true });
  const ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.equal(ids.length, 1);
  assert.equal(await exists(path.join(inbox, ids[0], "reply.md")), true);
  assert.equal(await exists(path.join(inbox, ids[0], "CODEX_READ_THIS.md")), true);
});

test("guide codex prints a ready-to-copy Codex prompt", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-guide-")));

  await main(["guide", "codex"], io);

  assert.match(io.output(), /Copy this into Codex:/);
  assert.match(io.output(), /Use chatgpt-native-bridge for this task/);
  assert.match(io.output(), /npx --yes --package github:rp10000\/chatgpt-native-bridge -- cgn setup --mcp/);
  assert.match(io.output(), /restart Codex/);
  assert.match(io.output(), /cgn handoff/);
  assert.match(io.output(), /cgn done/);
  assert.match(io.output(), /\.chatgpt-native\/inbox\/\{id\}\/reply\.md/);
  assert.match(io.output(), /CODEX_READ_THIS\.md/);
});

test("guide codex supports Chinese output", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-guide-zh-")));

  await main(["guide", "codex", "--lang", "zh-CN"], io);

  assert.match(io.output(), /chatgpt-native-bridge/);
  assert.match(io.output(), /npx --yes --package github:rp10000\/chatgpt-native-bridge -- cgn setup --mcp/);
  assert.match(io.output(), /重启 Codex/);
  assert.match(io.output(), /cgn done/);
  assert.match(io.output(), /CODEX_READ_THIS\.md/);
});

test("setup initializes the project, runs doctor, and prints the Codex guide", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-setup-"));
  const io = createIo(cwd);

  await main(["setup"], io);

  assert.match(io.output(), /Created:/);
  assert.match(io.output(), /chatgpt-native-bridge doctor/);
  assert.match(io.output(), /Result: ready/);
  assert.match(io.output(), /Copy this into Codex:/);
  assert.equal(
    await exists(path.join(cwd, ".agents", "skills", "chatgpt-native-bridge", "SKILL.md")),
    true
  );
});

test("setup --mcp initializes the project and installs Codex MCP config", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-setup-mcp-"));
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-setup-mcp-home-"));
  const io = createIo(cwd);

  await main(["setup", "--mcp", "--codex-home", codexHome], io);

  assert.match(io.output(), /Created:/);
  assert.match(io.output(), /Codex MCP install: written/);
  assert.match(io.output(), /Restart Codex/);

  const config = await fs.readFile(path.join(codexHome, "config.toml"), "utf8");
  assert.match(config, /\[mcp_servers\."chatgpt-native-bridge"\]/);
  assert.match(config, /command = "npx"/);
  assert.match(config, /"--package"/);
  assert.match(config, /"github:rp10000\/chatgpt-native-bridge"/);
  assert.match(config, /"cgn"/);
  assert.match(config, /"--root"/);
  assert.match(config, new RegExp(escapeRegExp(JSON.stringify(cwd))));
});

test("mcp web prints a beginner ChatGPT connector guide", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-web-")));

  await main(["mcp", "web"], io);

  assert.match(io.output(), /ChatGPT web connector setup/);
  assert.match(io.output(), /cgn mcp connect --yes --open/);
  assert.match(io.output(), /cgn mcp serve --host 127\.0\.0\.1 --port 47832/);
  assert.match(io.output(), /cgn mcp tunnel/);
  assert.match(io.output(), /https:\/\/chatgpt\.com\/#settings\/Connectors/);
  assert.match(io.output(), /Settings -> Apps & Connectors -> Create/);
  assert.match(io.output(), /Authentication: No authentication/);
});

test("mcp connect supports dry-run without starting long-lived processes", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-connect-")));

  await main(["mcp", "connect", "--dry-run"], io);

  assert.match(io.output(), /One-command ChatGPT web connect/);
  assert.match(io.output(), /cgn mcp connect --yes --open/);
  assert.match(io.output(), /Start the local MCP server/);
  assert.match(io.output(), /Install cloudflared/);
  assert.match(io.output(), /Open the ChatGPT connector settings page/);
});

test("mcp wait explains when ChatGPT selected the app but did not call it", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-wait-")));

  await main(["mcp", "wait", "--timeout", "0"], io);

  assert.match(io.output(), /No MCP tool call observed/);
  assert.match(io.output(), /selected in the UI/);
  assert.match(io.output(), /Latest Server URL/);
  assert.match(io.output(), /review_current_project/);
});

test("mcp trace explains request and tool-call logs", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-trace-")));

  await main(["mcp", "trace"], io);

  assert.match(io.output(), /MCP trace/);
  assert.match(io.output(), /Latest ChatGPT Server URL/);
  assert.match(io.output(), /Latest MCP requests/);
  assert.match(io.output(), /Latest tool calls/);
  assert.match(io.output(), /No MCP requests/);
  assert.match(io.output(), /latest Server URL/);
});

test("mcp tunnel supports dry-run without starting a long-lived process", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-tunnel-")));

  await main(["mcp", "tunnel", "--dry-run"], io);

  assert.match(io.output(), /cloudflared tunnel --url http:\/\/127\.0\.0\.1:47832/);
  assert.match(io.output(), /https:\/\/example\.trycloudflare\.com\/mcp/);
});

test("handoff creates a handoff and opens it in dry-run mode", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-handoff-"));
  const io = createIo(cwd);

  await main(["handoff", "--task", "Review onboarding UX", "--type", "plan,ux-review", "--dry-run"], io);

  assert.match(io.output(), /Created handoff:/);
  assert.match(io.output(), /Mode: assist/);
  assert.match(io.output(), /Paste prompt file:/);
  assert.match(io.output(), /Upload\/select in ChatGPT:/);
  assert.match(io.output(), /01_PASTE_TO_CHATGPT\.md/);
  assert.match(io.output(), /02_UPLOAD_THESE_FILES\.md/);
  assert.match(io.output(), /03_AFTER_CHATGPT_REPLY\.md/);
  assert.match(io.output(), /Context:/);
  assert.match(io.output(), /Ask copied: no/);
  assert.match(io.output(), /Browser opened: no/);
  assert.equal((await listOutboxIds(cwd)).length, 1);
});

test("handoff manual mode prints paths without browser or clipboard actions", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-handoff-manual-"));
  const io = createIo(cwd);

  await main(["handoff", "--task", "Review onboarding UX", "--mode", "manual"], io);

  assert.match(io.output(), /Mode: manual/);
  assert.match(io.output(), /Paste prompt file:/);
  assert.match(io.output(), /Ask copied: no/);
  assert.match(io.output(), /Browser opened: no/);
  assert.match(io.output(), /Outbox folder opened: no/);
});

test("open auto mode can be dry-run without opening browser or folder", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-open-auto-"));
  const ask = await createAsk({
    cwd,
    task: "Review current diff",
    types: ["diff-review"],
    now: new Date("2026-06-09T12:04:00.000Z")
  });
  const io = createIo(cwd);

  await main(["open", ask.id, "--mode", "auto", "--dry-run"], io);

  assert.match(io.output(), /Mode: auto/);
  assert.match(io.output(), /Ask copied: no/);
  assert.match(io.output(), /Browser opened: no/);
  assert.match(io.output(), /Outbox folder opened: no/);
  assert.match(io.output(), /Upload\/select in ChatGPT:/);
  assert.match(io.output(), /01_PASTE_TO_CHATGPT\.md/);
});

test("done imports the latest reply from a file", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-done-"));
  await initProject({ cwd });
  const ask = await createAsk({
    cwd,
    task: "Review implementation",
    types: ["diff-review"],
    now: new Date("2026-06-09T12:03:00.000Z")
  });
  const replyFile = path.join(cwd, "reply.md");
  await fs.writeFile(replyFile, "## Codex next actions\n- Continue locally.\n");
  const io = createIo(cwd);

  await main(["done", replyFile], io);

  assert.match(io.output(), /Imported reply:/);
  assert.equal(
    await fs.readFile(path.join(cwd, ".chatgpt-native", "inbox", ask.id, "reply.md"), "utf8"),
    "## Codex next actions\n- Continue locally.\n"
  );
});

test("doctor reports initialized bridge setup and latest reply state", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-doctor-"));
  await initProject({ cwd });
  const ask = await createAsk({
    cwd,
    task: "Review onboarding UX",
    types: ["ux-review"],
    now: new Date("2026-06-09T12:02:00.000Z")
  });
  await importReply({ cwd, id: ask.id, text: "## Codex next actions\n- Continue locally.\n" });
  const io = createIo(cwd);

  await main(["doctor"], io);

  assert.match(io.output(), /Node version: ok/);
  assert.match(io.output(), /Codex skill: ok/);
  assert.match(io.output(), /Project instructions: ok/);
  assert.match(io.output(), /Latest handoff: ok/);
  assert.match(io.output(), /Latest reply: ok/);
  assert.match(io.output(), /ready/);
});

function createIo(cwd) {
  let stdout = "";
  let stderr = "";
  return {
    cwd,
    stdout: {
      write(chunk) {
        stdout += chunk;
      }
    },
    stderr: {
      write(chunk) {
        stderr += chunk;
      }
    },
    output() {
      return stdout;
    },
    errors() {
      return stderr;
    }
  };
}

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function listOutboxIds(cwd) {
  const outbox = path.join(cwd, ".chatgpt-native", "outbox");
  try {
    const entries = await fs.readdir(outbox, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
