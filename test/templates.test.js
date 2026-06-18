const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

test("skill template starts with valid YAML frontmatter", async () => {
  const skill = await fs.readFile(path.join(__dirname, "..", "templates", "skill", "SKILL.md"), "utf8");
  const lines = skill.split(/\r?\n/);

  assert.match(skill, /^---\r?\nname: chatgpt-native-bridge\r?\ndescription: .+\r?\n---\r?\n/s);
  assert.equal(lines[0], "---");
  assert.equal(lines[1], "name: chatgpt-native-bridge");
  assert.match(lines[2], /^description: .+/);
  assert.equal(lines[3], "---");
  assert.equal(lines[4], "");
  assert.match(lines[5], /^# /);
  assert.ok(lines.length > 40, "SKILL.md should keep readable line breaks");
  assert.equal(skill.startsWith("--- name:"), false);
});

test("skill metadata template declares display metadata and implicit invocation", async () => {
  const metadata = await fs.readFile(
    path.join(__dirname, "..", "templates", "skill", "agents", "openai.yaml"),
    "utf8"
  );
  const lines = metadata.split(/\r?\n/);

  assert.match(metadata, /^interface:\r?\n  display_name:/);
  assert.match(metadata, /\r?\n  default_prompt: \|\r?\n/);
  assert.match(metadata, /\r?\npolicy:\r?\n  allow_implicit_invocation: true\r?\n?$/);
  assert.equal(lines[0], "interface:");
  assert.equal(lines[1], '  display_name: "ChatGPT Native Bridge"');
  assert.match(lines[2], /^  short_description: ".+"/);
  assert.equal(lines[3], "  default_prompt: |");
  const policyIndex = lines.indexOf("policy:");
  assert.ok(policyIndex > 4, "policy block should appear after default_prompt");
  assert.equal(lines[policyIndex + 1], "  allow_implicit_invocation: true");
  assert.ok(lines.length >= 10, "openai.yaml should keep nested YAML line breaks");
  assert.equal(metadata.startsWith("interface: display_name:"), false);
});

test("ChatGPT project instructions define the automatic MCP loop", async () => {
  const instructions = await fs.readFile(
    path.join(__dirname, "..", "templates", "chatgpt", "project-instructions.md"),
    "utf8"
  );

  assert.match(instructions, /Use the local MCP bridge automatically/);
  assert.match(instructions, /The user should not need to name MCP tools/);
  assert.match(instructions, /Call `review_current_project` first/);
  assert.match(instructions, /Before your final answer, call `submit_reply_to_codex`/);
  assert.match(instructions, /Submit the final advice back to Codex yourself/);
});

test("primary user-facing docs keep readable line breaks", async () => {
  const files = [
    ["README.md", 80],
    ["README.zh-CN.md", 80],
    [path.join("templates", "skill", "SKILL.md"), 40],
    [path.join("templates", "chatgpt", "project-instructions.md"), 20]
  ];

  for (const [file, minimumLines] of files) {
    const text = await fs.readFile(path.join(__dirname, "..", file), "utf8");
    assert.ok(countLines(text) > minimumLines, `${file} should have more than ${minimumLines} lines`);
  }
});

test("readme files keep expected section breaks", async () => {
  const readme = await fs.readFile(path.join(__dirname, "..", "README.md"), "utf8");
  const readmeZh = await fs.readFile(path.join(__dirname, "..", "README.zh-CN.md"), "utf8");

  assert.ok(readme.includes("\n## Quick Start\n"));
  assert.ok(readme.includes("\n## CLI\n"));
  assert.ok(readme.includes("\n## MCP Workspace\n"));
  assert.ok(readme.includes("\n## Pro Helper\n"));
  assert.ok(readme.includes("\n## Fallback\n"));
  assert.ok(readmeZh.includes("\n## 快速开始\n"));
  assert.ok(readmeZh.includes("\n## 常用命令\n"));
  assert.ok(readmeZh.includes("\n## MCP 工作区\n"));
  assert.ok(readmeZh.includes("\n## Pro 辅助规划\n"));
  assert.ok(readmeZh.includes("\n## 备用方式\n"));
});

test("ci workflow keeps valid nested YAML shape", async () => {
  const ci = await fs.readFile(path.join(__dirname, "..", ".github", "workflows", "ci.yml"), "utf8");

  assert.ok(countLines(ci) > 20, "ci.yml should keep readable line breaks");
  assert.ok(ci.includes("\non:\n"));
  assert.ok(ci.includes("\n  pull_request:\n"));
  assert.ok(ci.includes("\n    strategy:\n"));
  assert.ok(ci.includes("\n      matrix:\n"));
  assert.ok(ci.includes("node-version: [20, 22, 24]"));
});

function countLines(text) {
  return text.split(/\r?\n/).length;
}
