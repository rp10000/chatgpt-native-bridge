const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { initProject } = require("../src/init");
const { createAsk } = require("../src/ask");
const { importReply } = require("../src/import-reply");
const { getStatus } = require("../src/status");

test("importReply saves a reply and status marks the run ready", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-import-"));
  await initProject({ cwd });
  const ask = await createAsk({
    cwd,
    task: "Review the diff",
    types: ["diff-review"],
    now: new Date("2026-06-09T12:01:00.000Z")
  });

  const before = await getStatus({ cwd });
  assert.deepEqual(before.pending.map((item) => item.id), [ask.id]);
  assert.deepEqual(before.ready, []);

  const result = await importReply({
    cwd,
    id: "latest",
    text: "## Codex next actions\n- Keep the MVP small.\n"
  });

  assert.equal(result.id, ask.id);
  assert.equal(
    await fs.readFile(path.join(cwd, ".chatgpt-native", "inbox", ask.id, "reply.md"), "utf8"),
    "## Codex next actions\n- Keep the MVP small.\n"
  );
  const codexReadThis = await fs.readFile(
    path.join(cwd, ".chatgpt-native", "inbox", ask.id, "CODEX_READ_THIS.md"),
    "utf8"
  );
  assert.match(codexReadThis, /Read `reply\.md`/);
  assert.match(codexReadThis, /accepted suggestions/);
  assert.match(codexReadThis, /Do not/);

  const after = await getStatus({ cwd });
  assert.deepEqual(after.pending, []);
  assert.deepEqual(after.ready.map((item) => item.id), [ask.id]);
});

test("status lists inbox-only Pro relay replies as ready", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-status-pro-"));
  const inbox = path.join(cwd, ".chatgpt-native", "inbox", "pro-reply-id");
  await fs.mkdir(inbox, { recursive: true });
  await fs.writeFile(path.join(inbox, "reply.md"), "# GPT-5.5 Pro Reply\n", "utf8");

  const status = await getStatus({ cwd });

  assert.deepEqual(status.pending, []);
  assert.deepEqual(status.ready.map((item) => item.id), ["pro-reply-id"]);
  assert.equal(status.ready[0].outboxDir, null);
});
