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
