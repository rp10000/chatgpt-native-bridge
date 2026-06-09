const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { initProject } = require("../src/init");

test("initProject creates the Codex skill and ChatGPT workspace files", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-init-"));

  const result = await initProject({ cwd });

  assert.equal(result.created.length, 8);
  assert.equal(
    await exists(path.join(cwd, ".agents", "skills", "chatgpt-native-bridge", "SKILL.md")),
    true
  );
  assert.equal(await exists(path.join(cwd, ".chatgpt-native", "config.json")), true);
  assert.equal(await exists(path.join(cwd, ".chatgpt-native", "project-instructions.md")), true);
  assert.equal(await exists(path.join(cwd, ".chatgpt-native", "outbox")), true);
  assert.equal(await exists(path.join(cwd, ".chatgpt-native", "inbox")), true);
  assert.equal(await exists(path.join(cwd, ".chatgpt-native", "assets")), true);
  assert.equal(await exists(path.join(cwd, ".chatgpt-native", "runs")), true);

  const config = await fs.readFile(path.join(cwd, ".chatgpt-native", "config.json"), "utf8");
  assert.doesNotMatch(config, /GPT-5\.5/);
  assert.match(config, /best available reasoning model/);
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
