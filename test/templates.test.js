const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

test("skill template starts with valid YAML frontmatter", async () => {
  const skill = await fs.readFile(path.join(__dirname, "..", "templates", "skill", "SKILL.md"), "utf8");
  const lines = skill.split(/\r?\n/);

  assert.equal(lines[0], "---");
  assert.equal(lines[1], "name: chatgpt-native-bridge");
  assert.match(lines[2], /^description: .+/);
  assert.equal(lines[3], "---");
});

test("skill metadata template declares display metadata and implicit invocation", async () => {
  const metadata = await fs.readFile(
    path.join(__dirname, "..", "templates", "skill", "agents", "openai.yaml"),
    "utf8"
  );

  assert.match(metadata, /interface:/);
  assert.match(metadata, /display_name: "ChatGPT Native Bridge"/);
  assert.match(metadata, /default_prompt:/);
  assert.match(metadata, /allow_implicit_invocation: true/);
});
