const { spawn } = require("node:child_process");

const DEFAULT_TUNNEL_HOST = "127.0.0.1";
const DEFAULT_TUNNEL_PORT = 47832;

function formatMcpWebGuide({ host = DEFAULT_TUNNEL_HOST, port = DEFAULT_TUNNEL_PORT } = {}) {
  const localBase = `http://${host}:${port}`;

  return `ChatGPT web connector setup

Use this when ChatGPT says localhost URLs are invalid.

Terminal 1 - start the local MCP server:
  cgn mcp serve --host ${host} --port ${port}

Terminal 2 - create a temporary HTTPS tunnel:
  cgn mcp tunnel

Then copy the printed HTTPS /mcp URL into ChatGPT:
  Settings -> Connectors -> Create -> Server URL
  Authentication: No authentication

Local MCP URL:
  ${localBase}/mcp

If cloudflared is not installed:
  winget install --id Cloudflare.cloudflared

Fallback without MCP:
  cgn handoff --task "..." --type plan,diff-review
  cgn done
`;
}

function formatTunnelDryRun({ host = DEFAULT_TUNNEL_HOST, port = DEFAULT_TUNNEL_PORT } = {}) {
  return `Cloudflare tunnel command

Run:
  cloudflared tunnel --url http://${host}:${port}

When cloudflared prints a URL like:
  https://example.trycloudflare.com

Paste this into ChatGPT:
  https://example.trycloudflare.com/mcp
`;
}

async function runCloudflareTunnel({
  host = DEFAULT_TUNNEL_HOST,
  port = DEFAULT_TUNNEL_PORT,
  stdout = process.stdout,
  stderr = process.stderr,
  dryRun = false,
  command = "cloudflared",
  spawnImpl = spawn
} = {}) {
  if (dryRun) {
    stdout.write(formatTunnelDryRun({ host, port }));
    return { started: false, dryRun: true };
  }

  stdout.write(`Starting Cloudflare Tunnel for http://${host}:${port}\n`);
  stdout.write("Keep this terminal open while ChatGPT uses the connector.\n\n");

  const child = spawnImpl(command, ["tunnel", "--url", `http://${host}:${port}`], {
    windowsHide: true
  });

  let printedUrl = false;

  const onData = (chunk) => {
    const text = String(chunk);
    const tunnelUrl = findTryCloudflareUrl(text);
    if (tunnelUrl && !printedUrl) {
      printedUrl = true;
      stdout.write("\nPaste this Server URL into ChatGPT:\n");
      stdout.write(`  ${tunnelUrl}/mcp\n\n`);
      stdout.write("Authentication: No authentication\n\n");
    }
    stdout.write(text);
  };

  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  return await new Promise((resolve, reject) => {
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(
          new Error(
            "cloudflared was not found. Install it with: winget install --id Cloudflare.cloudflared"
          )
        );
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      resolve({ started: true, code, printedUrl });
    });
  });
}

function findTryCloudflareUrl(text) {
  const match = String(text).match(/https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com\b/);
  return match ? match[0] : null;
}

module.exports = {
  DEFAULT_TUNNEL_HOST,
  DEFAULT_TUNNEL_PORT,
  findTryCloudflareUrl,
  formatMcpWebGuide,
  formatTunnelDryRun,
  runCloudflareTunnel
};
