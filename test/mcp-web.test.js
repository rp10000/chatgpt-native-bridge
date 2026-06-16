const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  CHATGPT_CONNECTORS_URL,
  CLOUDFLARED_WINDOWS_DOWNLOAD_URL,
  downloadCloudflared,
  findTryCloudflareUrl,
  formatConnectDryRun,
  formatMcpWebGuide,
  formatTunnelDryRun,
  getProjectCloudflaredPath,
  runCloudflareTunnel
} = require("../src/mcp-web");

test("formatMcpWebGuide explains the ChatGPT web connector path", () => {
  const guide = formatMcpWebGuide({ host: "127.0.0.1", port: 47832 });

  assert.match(guide, /ChatGPT web connector setup/);
  assert.match(guide, /cgn mcp connect --yes --open/);
  assert.match(guide, /cgn mcp wait/);
  assert.match(guide, /cgn mcp serve --host 127\.0\.0\.1 --port 47832/);
  assert.match(guide, /cgn mcp tunnel/);
  assert.match(guide, /https:\/\/chatgpt\.com\/#settings\/Connectors/);
  assert.match(guide, /Settings -> Apps & Connectors -> Create/);
  assert.match(guide, /Name: chatgpt-native-bridge/);
  assert.match(guide, /Authentication: No authentication/);
  assert.match(guide, /\/action\/openapi\.json/);
  assert.match(guide, /not available in Pro mode/);
  assert.match(guide, /Pro accounts may scan/);
  assert.match(guide, /http:\/\/127\.0\.0\.1:47832\/mcp/);
});

test("formatConnectDryRun explains the one-command path", () => {
  const guide = formatConnectDryRun({ host: "127.0.0.1", port: 47832 });

  assert.match(guide, /One-command ChatGPT web connect/);
  assert.match(guide, /cgn mcp connect --yes --open/);
  assert.match(guide, /cgn mcp wait/);
  assert.match(guide, /Start the local MCP server/);
  assert.match(guide, /Install cloudflared/);
  assert.match(guide, /project-local download/);
  assert.match(guide, /Copy and print the HTTPS \/mcp URL/);
  assert.match(guide, /https:\/\/chatgpt\.com\/#settings\/Connectors/);
  assert.match(guide, /GPT Actions write-back fallback/);
  assert.match(guide, /not available in Pro mode/);
  assert.match(guide, /Full automatic write-back/);
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
  assert.match(output, /https:\/\/abc-def\.trycloudflare\.com\/action\/openapi\.json/);
  assert.match(output, /not available in Pro mode/);
  assert.match(output, /Pro accounts may scan/);
  assert.match(output, /Final step: click Create in ChatGPT/);
});

test("downloadCloudflared writes a project-local executable", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-cloudflared-"));
  const writes = [];
  const target = await downloadCloudflared({
    cwd,
    stdout: { write: (text) => writes.push(text) },
    fetchImpl: async (url) => {
      assert.equal(url, CLOUDFLARED_WINDOWS_DOWNLOAD_URL);
      return {
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("fake exe"));
            controller.close();
          }
        })
      };
    }
  });

  assert.equal(target, getProjectCloudflaredPath(cwd));
  assert.equal(await fs.readFile(target, "utf8"), "fake exe");
  assert.match(writes.join(""), /cloudflared downloaded/);
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
