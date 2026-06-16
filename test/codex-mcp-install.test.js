const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildCodexMcpBlock,
  installCodexMcp,
  mergeCodexMcpBlock,
  resolveCodexConfigPath
} = require("../src/codex-mcp-install");

test("buildCodexMcpBlock uses npx GitHub command by default", () => {
  const root = path.resolve("demo-project");
  const block = buildCodexMcpBlock({ root });

  assert.match(block, /^\[mcp_servers\."chatgpt-native-bridge"\]/);
  assert.match(block, /command = "npx"/);
  assert.match(block, /"github:rp10000\/chatgpt-native-bridge"/);
  assert.match(block, /"mcp"/);
  assert.match(block, /"serve"/);
  assert.match(block, /"--stdio"/);
  assert.match(block, /"--root"/);
  assert.match(block, new RegExp(escapeRegExp(JSON.stringify(root))));
});

test("mergeCodexMcpBlock replaces only the bridge MCP block", () => {
  const existing = `model = "gpt-5.5"

[mcp_servers.node_repl]
command = "node_repl.exe"

[mcp_servers."chatgpt-native-bridge"]
command = "old"
args = ["old"]

[mcp_servers."chatgpt-native-bridge".env]
OLD_ENV = "old"

[features]
memories = true
`;
  const block = buildCodexMcpBlock({ root: path.resolve("demo-project") });
  const merged = mergeCodexMcpBlock(existing, block);

  assert.match(merged, /model = "gpt-5\.5"/);
  assert.match(merged, /\[mcp_servers\.node_repl\]/);
  assert.match(merged, /\[features\]/);
  assert.doesNotMatch(merged, /command = "old"/);
  assert.doesNotMatch(merged, /OLD_ENV/);
  assert.equal((merged.match(/\[mcp_servers\."chatgpt-native-bridge"\]/g) || []).length, 1);
});

test("installCodexMcp writes config and supports dry-run", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-install-project-"));
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-mcp-install-home-"));
  const configPath = resolveCodexConfigPath({ codexHome });
  await fs.writeFile(configPath, "model = \"gpt-5.5\"\n");

  const dryRun = await installCodexMcp({ cwd, codexHome, dryRun: true });
  assert.equal(dryRun.changed, true);
  assert.equal(dryRun.wrote, false);
  assert.equal(await fs.readFile(configPath, "utf8"), "model = \"gpt-5.5\"\n");

  const result = await installCodexMcp({ cwd, codexHome });
  assert.equal(result.changed, true);
  assert.equal(result.wrote, true);
  assert.equal(result.configPath, configPath);

  const written = await fs.readFile(configPath, "utf8");
  assert.match(written, /model = "gpt-5\.5"/);
  assert.match(written, /\[mcp_servers\."chatgpt-native-bridge"\]/);
  assert.match(written, /"--root"/);
  assert.match(written, new RegExp(escapeRegExp(JSON.stringify(cwd))));

  const again = await installCodexMcp({ cwd, codexHome });
  assert.equal(again.changed, false);
  assert.equal(again.wrote, false);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
