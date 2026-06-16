const assert = require("node:assert/strict");
const test = require("node:test");

const { findTryCloudflareUrl, formatMcpWebGuide, formatTunnelDryRun } = require("../src/mcp-web");

test("formatMcpWebGuide explains the ChatGPT web connector path", () => {
  const guide = formatMcpWebGuide({ host: "127.0.0.1", port: 47832 });

  assert.match(guide, /ChatGPT web connector setup/);
  assert.match(guide, /cgn mcp serve --host 127\.0\.0\.1 --port 47832/);
  assert.match(guide, /cgn mcp tunnel/);
  assert.match(guide, /Settings -> Connectors -> Create -> Server URL/);
  assert.match(guide, /Authentication: No authentication/);
  assert.match(guide, /http:\/\/127\.0\.0\.1:47832\/mcp/);
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
