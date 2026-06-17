const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { initProject } = require("../src/init");
const {
  buildProPrompt,
  createProPack,
  importProReply,
  parseProReply,
  PRO_REPLY_END,
  PRO_REPLY_START
} = require("../src/pro-relay");

test("Pro prompt includes project context and id-bound reply markers", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-pro-prompt-"));
  await fs.writeFile(path.join(cwd, "package.json"), "{\"name\":\"sample\"}\n");

  const prompt = await buildProPrompt({
    cwd,
    id: "pro-test-1",
    task: "Plan the next release",
    includeDiff: false
  });

  assert.match(prompt, /GPT-5\.5 Pro Planning Pack/);
  assert.match(prompt, /Plan the next release/);
  assert.match(prompt, /Relay id: pro-test-1/);
  assert.match(prompt, new RegExp(`${PRO_REPLY_START} v1 id=pro-test-1`));
  assert.match(prompt, new RegExp(PRO_REPLY_END));
});

test("parseProReply accepts only the matching relay id", () => {
  const good = `${PRO_REPLY_START} v1 id=abc-123\n## Plan\nDo the work.\n${PRO_REPLY_END}`;

  assert.deepEqual(parseProReply(good, "abc-123"), {
    ok: true,
    id: "abc-123",
    markdown: "## Plan\nDo the work."
  });
  assert.equal(parseProReply(good, "other").ok, false);
  assert.equal(parseProReply("plain answer", "abc-123").ok, false);
  assert.equal(parseProReply(`${PRO_REPLY_START} v1 id=abc-123\n${PRO_REPLY_END}`, "abc-123").ok, false);
});

test("createProPack copies the prompt and writes Pro pack state", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-pro-pack-"));
  let copied = "";

  const pack = await createProPack({
    cwd,
    id: "pro-pack-id",
    task: "Review architecture",
    includeDiff: false,
    copyToClipboardImpl: (text) => {
      copied = text;
    }
  });

  assert.equal(pack.id, "pro-pack-id");
  assert.equal(pack.copied, true);
  assert.match(copied, /Review architecture/);
  assert.equal(await exists(pack.promptPath), true);
  assert.equal(await exists(path.join(cwd, ".chatgpt-native", "pro-packs", "latest.json")), true);
});

test("importProReply writes reply and CODEX_READ_THIS for Codex", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-pro-import-"));
  await initProject({ cwd });
  const text = `${PRO_REPLY_START} v1 id=pro-import-id\n## Findings\nShip the GUI.\n${PRO_REPLY_END}`;

  const result = await importProReply({ cwd, id: "pro-import-id", text });

  assert.equal(result.id, "pro-import-id");
  assert.equal(await exists(result.replyPath), true);
  assert.equal(await exists(result.codexReadThisPath), true);
  const reply = await fs.readFile(result.replyPath, "utf8");
  assert.match(reply, /GPT-5\.5 Pro Reply/);
  assert.match(reply, /Ship the GUI/);
});

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
