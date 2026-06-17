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
  readWebConnectionStatus,
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
  assert.match(guide, /Developer Mode supports MCP read and write tools/);
  assert.match(guide, /quick tunnel URL is temporary/);
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
  assert.match(guide, /Developer Mode supports MCP read and write tools/);
  assert.match(guide, /quick tunnel URL is temporary/);
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
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-action-schema-"));

  const result = await runCloudflareTunnel({
    cwd,
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
  assert.match(output, /paste the schema JSON manually/);
  assert.match(output, /Developer Mode supports MCP read and write tools/);
  assert.match(output, /quick tunnel URL is temporary/);
  assert.match(output, /Final step: click Create in ChatGPT/);
  const schema = JSON.parse(await fs.readFile(path.join(cwd, ".chatgpt-native", "actions", "openapi.json"), "utf8"));
  assert.equal(schema.openapi, "3.0.3");
  assert.equal(schema.servers[0].url, "https://abc-def.trycloudflare.com");
  const status = await readWebConnectionStatus({ cwd });
  assert.equal(status.serverUrl, "https://abc-def.trycloudflare.com/mcp");
  assert.equal(status.temporary, true);
});

test("runCloudflareTunnel repeats the Server URL after cloudflared precheck logs", async () => {
  let output = "";
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-tunnel-reminder-"));

  const result = await runCloudflareTunnel({
    cwd,
    stdout: { write: (text) => { output += text; } },
    stderr: { write: (text) => { output += text; } },
    copyToClipboardImpl: () => {},
    spawnImpl: fakeCloudflaredSpawn([
      "Your quick Tunnel has been created! https://abc-def.trycloudflare.com",
      "precheck complete hard_fail=false suggested_protocol=quic"
    ])
  });

  assert.equal(result.started, true);
  assert.equal(result.printedUrl, true);
  assert.match(output, /Tunnel ready\. Keep this terminal open\./);
  assert.match(output, /Server URL: https:\/\/abc-def\.trycloudflare\.com\/mcp/);
  assert.ok(
    output.lastIndexOf("Server URL: https://abc-def.trycloudflare.com/mcp") >
      output.lastIndexOf("precheck complete"),
    "Server URL should be repeated after noisy precheck logs"
  );
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
      for (const chunk of Array.isArray(text) ? text : [text]) {
        child.stderr.emit("data", chunk);
      }
      child.emit("close", 0);
    });
    return child;
  };
}
