const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { initProject } = require("../src/init");
const { createAsk } = require("../src/ask");

test("createAsk writes a Markdown handoff pack and skips unsafe files", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-ask-"));
  await fs.mkdir(path.join(cwd, "src"), { recursive: true });
  await fs.writeFile(path.join(cwd, "src", "app.js"), "export const name = 'bridge';\n");
  await fs.writeFile(path.join(cwd, ".env"), "OPENAI_API_KEY=dummy-test-key\n");
  await initProject({ cwd });

  const result = await createAsk({
    cwd,
    task: "Review the onboarding flow",
    types: ["plan", "ux-review", "naming-copy"],
    includeFiles: ["src/*.js", ".env"],
    now: new Date("2026-06-09T12:00:00.000Z")
  });

  assert.equal(result.id, "2026-06-09-120000-review-the-onboarding-flow");
  const ask = await fs.readFile(path.join(result.outboxDir, "ask.md"), "utf8");
  const context = await fs.readFile(path.join(result.outboxDir, "context.md"), "utf8");

  assert.match(ask, /# ChatGPT Native Bridge Handoff/);
  assert.match(ask, /Review the onboarding flow/);
  assert.match(ask, /## Codex next actions/);
  assert.doesNotMatch(ask, /\{\{task\}\}/);
  assert.match(context, /src\/app\.js/);
  assert.equal(await exists(path.join(result.outboxDir, "files", "src", "app.js")), true);
  assert.equal(await exists(path.join(result.outboxDir, "files", ".env")), false);
  assert.equal(result.warnings.some((warning) => warning.includes(".env")), true);
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
