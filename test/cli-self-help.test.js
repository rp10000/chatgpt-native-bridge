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
  assert.match(io.output(), /cgn init/);
  assert.match(io.output(), /cgn ask --task "Review onboarding UX"/);
  assert.match(io.output(), /cgn open latest/);
  assert.match(io.output(), /cgn import latest --from-clipboard/);
  assert.match(io.output(), /\.chatgpt-native\/inbox\/<id>\/reply\.md/);
});

test("help lists beginner guidance commands", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-help-")));

  await main(["--help"], io);

  assert.match(io.output(), /cgn demo/);
  assert.match(io.output(), /cgn doctor/);
  assert.match(io.output(), /cgn guide codex/);
});

test("guide codex prints a ready-to-copy Codex prompt", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-guide-")));

  await main(["guide", "codex"], io);

  assert.match(io.output(), /Copy this into Codex:/);
  assert.match(io.output(), /Use chatgpt-native-bridge for this task/);
  assert.match(io.output(), /cgn ask/);
  assert.match(io.output(), /cgn open latest/);
  assert.match(io.output(), /cgn import latest --from-clipboard/);
  assert.match(io.output(), /\.chatgpt-native\/inbox\/<id>\/reply\.md/);
});

test("guide codex supports Chinese output", async () => {
  const io = createIo(await fs.mkdtemp(path.join(os.tmpdir(), "cgn-guide-zh-")));

  await main(["guide", "codex", "--lang", "zh-CN"], io);

  assert.match(io.output(), /复制下面这段给 Codex/);
  assert.match(io.output(), /请使用 chatgpt-native-bridge/);
  assert.match(io.output(), /你来运行 cgn ask 生成 handoff/);
  assert.match(io.output(), /cgn import latest --from-clipboard/);
  assert.match(io.output(), /只采纳合理建议/);
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
