const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createAsk } = require("../src/ask");
const { main } = require("../src/cli");
const { importReply } = require("../src/import-reply");
const { initProject } = require("../src/init");

test("demo prints the end-to-end native handoff workflow", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-demo-")));

  await main(["demo"], io);

  assert.match(io.output(), /30-second native handoff demo/);
  assert.match(io.output(), /cgn setup/);
  assert.match(io.output(), /cgn handoff --task "Review onboarding UX"/);
  assert.match(io.output(), /cgn done/);
  assert.match(io.output(), /\.chatgpt-native\/inbox\/\{id\}\/reply\.md/);
});

test("help lists beginner guidance commands", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-help-")));

  await main(["--help"], io);

  assert.match(io.output(), /cgn setup/);
  assert.match(io.output(), /cgn handoff/);
  assert.match(io.output(), /cgn done/);
  assert.match(io.output(), /cgn demo/);
  assert.match(io.output(), /cgn doctor/);
  assert.match(io.output(), /cgn guide codex/);
  assert.match(io.output(), /--mode manual/);
  assert.match(io.output(), /--mode auto/);
});

test("guide codex prints a ready-to-copy Codex prompt", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-guide-")));

  await main(["guide", "codex"], io);

  assert.match(io.output(), /Copy this into Codex:/);
  assert.match(io.output(), /Use chatgpt-native-bridge for this task/);
  assert.match(io.output(), /cgn handoff/);
  assert.match(io.output(), /cgn done/);
  assert.match(io.output(), /\.chatgpt-native\/inbox\/\{id\}\/reply\.md/);
});

test("guide codex supports Chinese output", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-guide-zh-")));

  await main(["guide", "codex", "--lang", "zh-CN"], io);

  assert.match(io.output(), /复制下面这段给 Codex/);
  assert.match(io.output(), /请使用 chatgpt-native-bridge/);
  assert.match(io.output(), /你来运行 cgn handoff 生成并打开 handoff/);
  assert.match(io.output(), /cgn done/);
  assert.match(io.output(), /只采纳合理建议/);
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

test("handoff creates a handoff and opens it in dry-run mode", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-handoff-"));
  const io = createIo(cwd);

  await main(["handoff", "--task", "Review onboarding UX", "--type", "plan,ux-review", "--dry-run"], io);

  assert.match(io.output(), /Created handoff:/);
  assert.match(io.output(), /Mode: assist/);
  assert.match(io.output(), /Paste prompt:/);
  assert.match(io.output(), /Upload\/select in ChatGPT:/);
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
  assert.match(io.output(), /Paste prompt:/);
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
