const assert = require("node:assert/strict");
const test = require("node:test");

const {
  findTryCloudflareUrl,
  formatConnectDryRun,
  formatMcpWebGuide,
  formatTunnelDryRun
} = require("../src/mcp-web");

test("formatMcpWebGuide explains the ChatGPT web connector path", () => {
  const guide = formatMcpWebGuide({ host: "127.0.0.1", port: 47832 });

  assert.match(guide, /ChatGPT web connector setup/);
  assert.match(guide, /cgn mcp connect --yes/);
  assert.match(guide, /cgn mcp serve --host 127\.0\.0\.1 --port 47832/);
  assert.match(guide, /cgn mcp tunnel/);
  assert.match(guide, /Settings -> Connectors -> Create -> Server URL/);
  assert.match(guide, /Authentication: No authentication/);
  assert.match(guide, /http:\/\/127\.0\.0\.1:47832\/mcp/);
});

test("formatConnectDryRun explains the one-command path", () => {
  const guide = formatConnectDryRun({ host: "127.0.0.1", port: 47832 });

  assert.match(guide, /One-command ChatGPT web connect/);
  assert.match(guide, /cgn mcp connect --yes/);
  assert.match(guide, /Start the local MCP server/);
  assert.match(guide, /Install cloudflared/);
  assert.match(guide, /Print the HTTPS \/mcp URL/);
});

test("formatTunnelDryRun shows the final /mcp URL shape", () => {
  const guide = formatTunnelDryRun({ host: "127.0.0.1", port: 47832 });

  assert.match(guide, /cloudflared tunnel --url http:\/\/127\.0\.0\.1:47832/);
  assert.match(guide, /https:\/\/example\.trycloudflare\.com\/mcp/);
});

test("findTryCloudflareUrl extracts cloudflared tunnel output", () => {
  assert.equal(
    findTryCloudflareUrl("Your quick Tunnel has been created! https://abc-def.trycloudflare.com"),
    "https://abc-def.trycloudflare.com"
  );
  assert.equal(findTryCloudflareUrl("no url yet"), null);
});
