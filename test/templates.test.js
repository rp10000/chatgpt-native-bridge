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
  assert.equal(lines[4], "");
  assert.match(lines[5], /^# /);
});

test("skill metadata template declares display metadata and implicit invocation", async () => {
  const metadata = await fs.readFile(
    path.join(__dirname, "..", "templates", "skill", "agents", "openai.yaml"),
    "utf8"
  );
  const lines = metadata.split(/\r?\n/);

  assert.equal(lines[0], "interface:");
  assert.equal(lines[1], '  display_name: "ChatGPT Native Bridge"');
  assert.match(lines[2], /^  short_description: ".+"/);
  assert.equal(lines[3], "  default_prompt: |");
  assert.equal(lines[9], "policy:");
  assert.equal(lines[10], "  allow_implicit_invocation: true");
});

test("primary user-facing docs keep readable line breaks", async () => {
  const files = [
    ["README.md", 50],
    ["README.zh-CN.md", 50],
    [path.join("templates", "skill", "SKILL.md"), 20],
    [path.join("templates", "chatgpt", "project-instructions.md"), 20]
  ];

  for (const [file, minimumLines] of files) {
    const text = await fs.readFile(path.join(__dirname, "..", file), "utf8");
    assert.ok(countLines(text) > minimumLines, `${file} should have more than ${minimumLines} lines`);
  }
});

function countLines(text) {
  return text.split(/\r?\n/).length;
}
