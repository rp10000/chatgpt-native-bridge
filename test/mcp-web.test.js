const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const {
  CHATGPT_CONNECTORS_URL,
  findTryCloudflareUrl,
  formatConnectDryRun,
  formatMcpWebGuide,
  formatTunnelDryRun,
  runCloudflareTunnel
} = require("../src/mcp-web");

test("formatMcpWebGuide explains the ChatGPT web connector path", () => {
  const guide = formatMcpWebGuide({ host: "127.0.0.1", port: 47832 });

  assert.match(guide, /ChatGPT web connector setup/);
  assert.match(guide, /cgn mcp connect --yes --open/);
  assert.match(guide, /cgn mcp serve --host 127\.0\.0\.1 --port 47832/);
  assert.match(guide, /cgn mcp tunnel/);
  assert.match(guide, /https:\/\/chatgpt\.com\/#settings\/Connectors/);
  assert.match(guide, /Settings -> Apps & Connectors -> Create/);
  assert.match(guide, /Name: chatgpt-native-bridge/);
  assert.match(guide, /Authentication: No authentication/);
  assert.match(guide, /http:\/\/127\.0\.0\.1:47832\/mcp/);
});

test("formatConnectDryRun explains the one-command path", () => {
  const guide = formatConnectDryRun({ host: "127.0.0.1", port: 47832 });

  assert.match(guide, /One-command ChatGPT web connect/);
  assert.match(guide, /cgn mcp connect --yes --open/);
  assert.match(guide, /Start the local MCP server/);
  assert.match(guide, /Install cloudflared/);
  assert.match(guide, /Copy and print the HTTPS \/mcp URL/);
  assert.match(guide, /https:\/\/chatgpt\.com\/#settings\/Connectors/);
  assert.match(guide, /Final step: click Create in ChatGPT/);
});

test("formatTunnelDryRun shows the final /mcp URL shape", () => {
  const guide = formatTunnelDryRun({ host: "127.0.0.1", port: 47832 });

  assert.match(guide, /cloudflared tunnel --url http:\/\/127\.0\.0\.1:47832/);
  assert.match(guide, /https:\/\/example\.trycloudflare\.com\/mcp/);
  assert.match(guide, /https:\/\/chatgpt\.com\/#settings\/Connectors/);
});

test("findTryCloudflareUrl extracts cloudflared tunnel output", () => {
  assert.equal(
    findTryCloudflareUrl("Your quick Tunnel has been created! https://abc-def.trycloudflare.com"),
    "https://abc-def.trycloudflare.com"
  );
  assert.equal(findTryCloudflareUrl("no url yet"), null);
});

test("runCloudflareTunnel copies the Server URL and opens ChatGPT when requested", async () => {
  let output = "";
  let copied = "";
  let opened = "";

  const result = await runCloudflareTunnel({
    stdout: { write: (text) => { output += text; } },
    stderr: { write: (text) => { output += text; } },
    copyToClipboardImpl: (text) => { copied = text; },
    openUrlImpl: (url) => { opened = url; },
    openChatgpt: true,
    spawnImpl: fakeCloudflaredSpawn("Your quick Tunnel has been created! https://abc-def.trycloudflare.com")
  });

  assert.equal(result.started, true);
  assert.equal(result.printedUrl, true);
  assert.equal(copied, "https://abc-def.trycloudflare.com/mcp");
  assert.equal(opened, CHATGPT_CONNECTORS_URL);
  assert.match(output, /Copied Server URL to clipboard/);
  assert.match(output, /Name: chatgpt-native-bridge/);
  assert.match(output, /Final step: click Create in ChatGPT/);
});

function fakeCloudflaredSpawn(text) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    process.nextTick(() => {
      child.stderr.emit("data", text);
      child.emit("close", 0);
    });
    return child;
  };
}
