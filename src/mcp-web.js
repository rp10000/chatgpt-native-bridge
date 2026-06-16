const { spawn } = require("node:child_process");
const { createWriteStream } = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const { copyToClipboard } = require("./clipboard");

const DEFAULT_TUNNEL_HOST = "127.0.0.1";
const DEFAULT_TUNNEL_PORT = 47832;
const CHATGPT_CONNECTORS_URL = "https://chatgpt.com/#settings/Connectors";
const CONNECTOR_NAME = "chatgpt-native-bridge";
const CONNECTOR_DESCRIPTION = "Local Codex bridge. Use it to inspect bounded project context, read diffs, create handoff files, and submit ChatGPT advice back to Codex.";
const CLOUDFLARED_WINDOWS_DOWNLOAD_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe";

function formatMcpWebGuide({ host = DEFAULT_TUNNEL_HOST, port = DEFAULT_TUNNEL_PORT } = {}) {
  const localBase = `http://${host}:${port}`;

  return `ChatGPT web connector setup

Use this when ChatGPT says localhost URLs are invalid.

One-command path:
  cgn mcp connect --yes --open

Terminal 1 - start the local MCP server:
  cgn mcp serve --host ${host} --port ${port}

Terminal 2 - create a temporary HTTPS tunnel:
  cgn mcp tunnel

Then copy the printed HTTPS /mcp URL into ChatGPT:
  Direct link: ${CHATGPT_CONNECTORS_URL}
  Fallback path: Settings -> Apps & Connectors -> Create
  If there is no Create button: Settings -> Apps & Connectors -> Advanced settings -> turn on Developer Mode
  Name: ${CONNECTOR_NAME}
  Description: ${CONNECTOR_DESCRIPTION}
  Connection: Server URL
  Server URL: the printed https://.../mcp URL
  Authentication: No authentication

Local MCP URL:
  ${localBase}/mcp

If cloudflared is not installed:
  cgn mcp connect --yes --open tries winget first, then downloads cloudflared into .chatgpt-native/bin/

Fallback without MCP:
  cgn handoff --task "..." --type plan,diff-review
  cgn done
`;
}

function formatConnectDryRun({ host = DEFAULT_TUNNEL_HOST, port = DEFAULT_TUNNEL_PORT } = {}) {
  return `One-command ChatGPT web connect

Run:
  cgn mcp connect --yes --open

This will:
  1. Start the local MCP server at http://${host}:${port}/mcp
  2. Install cloudflared if it is missing
     - Windows: try winget first, then project-local download
  3. Start a temporary HTTPS tunnel
  4. Copy and print the HTTPS /mcp URL
  5. Open the ChatGPT connector settings page

ChatGPT fields:
  Direct link: ${CHATGPT_CONNECTORS_URL}
  Name: ${CONNECTOR_NAME}
  Description: ${CONNECTOR_DESCRIPTION}
  Connection: Server URL
  Server URL: the printed https://.../mcp URL
  Authentication: No authentication
  Final step: click Create in ChatGPT
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

ChatGPT direct link:
  ${CHATGPT_CONNECTORS_URL}
`;
}

async function runWebConnect({
  host = DEFAULT_TUNNEL_HOST,
  port = DEFAULT_TUNNEL_PORT,
  cwd = process.cwd(),
  stdout = process.stdout,
  stderr = process.stderr,
  dryRun = false,
  yes = false,
  openChatgpt = false,
  spawnImpl = spawn
} = {}) {
  if (dryRun) {
    stdout.write(formatConnectDryRun({ host, port }));
    return { dryRun: true, started: false };
  }

  stdout.write("Starting one-command ChatGPT web connect\n\n");
  const server = await ensureLocalMcpServer({ host, port, cwd, stdout, stderr, spawnImpl });

  let cloudflared = await resolveCloudflaredCommand({ cwd });
  if (!cloudflared) {
    if (!yes) {
      throw new Error(
        "cloudflared was not found. Re-run with --yes to install it automatically, or install it with: winget install --id Cloudflare.cloudflared -e"
      );
    }
    await installCloudflared({ cwd, stdout, stderr, spawnImpl });
    cloudflared = await resolveCloudflaredCommand({ cwd });
    if (!cloudflared) {
      throw new Error("cloudflared installed, but this terminal cannot find it yet. Close this terminal and run cgn mcp connect --yes --open again.");
    }
  }

  stdout.write("\nOpening HTTPS tunnel for ChatGPT...\n");
  try {
    return await runCloudflareTunnel({
      host,
      port,
      stdout,
      stderr,
      command: cloudflared,
      openChatgpt,
      spawnImpl
    });
  } finally {
    if (server.child) {
      server.child.kill();
    }
  }
}

async function runCloudflareTunnel({
  host = DEFAULT_TUNNEL_HOST,
  port = DEFAULT_TUNNEL_PORT,
  stdout = process.stdout,
  stderr = process.stderr,
  dryRun = false,
  command = "cloudflared",
  openChatgpt = false,
  openUrlImpl = openUrl,
  copyToClipboardImpl = copyToClipboard,
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
  let openedChatgpt = false;

  const onData = (chunk) => {
    const text = String(chunk);
    const tunnelUrl = findTryCloudflareUrl(text);
    if (tunnelUrl && !printedUrl) {
      const serverUrl = `${tunnelUrl}/mcp`;
      printedUrl = true;
      try {
        copyToClipboardImpl(serverUrl);
        stdout.write("\nCopied Server URL to clipboard.\n");
      } catch {
        stdout.write("\nCould not copy Server URL automatically. Copy it manually from below.\n");
      }
      if (openChatgpt && !openedChatgpt) {
        openedChatgpt = true;
        openUrlImpl(CHATGPT_CONNECTORS_URL);
        stdout.write(`Opened ChatGPT connector settings: ${CHATGPT_CONNECTORS_URL}\n`);
      }
      stdout.write("\nChatGPT connector fields:\n");
      stdout.write(`  Direct link: ${CHATGPT_CONNECTORS_URL}\n`);
      stdout.write("  If it does not open the form: Settings -> Apps & Connectors -> Create\n");
      stdout.write(`  Name: ${CONNECTOR_NAME}\n`);
      stdout.write(`  Description: ${CONNECTOR_DESCRIPTION}\n`);
      stdout.write("  Connection: Server URL\n");
      stdout.write(`  Server URL: ${serverUrl}\n`);
      stdout.write("  Authentication: No authentication\n");
      stdout.write("  Final step: click Create in ChatGPT\n\n");
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

async function ensureLocalMcpServer({ host, port, cwd, stdout, stderr, spawnImpl }) {
  const healthUrl = `http://${host}:${port}/health`;
  if (await isHealthy(healthUrl)) {
    stdout.write(`Local MCP server already running: http://${host}:${port}/mcp\n`);
    return { child: null, alreadyRunning: true };
  }

  stdout.write(`Starting local MCP server: http://${host}:${port}/mcp\n`);
  const child = spawnImpl(process.execPath, [process.argv[1], "mcp", "serve", "--host", host, "--port", String(port)], {
    cwd,
    windowsHide: true
  });

  child.stdout.on("data", (chunk) => stdout.write(String(chunk)));
  child.stderr.on("data", (chunk) => stderr.write(String(chunk)));

  await waitForHealth(healthUrl, 20000);
  return { child, alreadyRunning: false };
}

async function waitForHealth(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isHealthy(url)) return true;
    await sleep(500);
  }
  throw new Error(`Local MCP server did not become ready: ${url}`);
}

async function isHealthy(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveCloudflaredCommand({ cwd = process.cwd() } = {}) {
  if (await commandExists("cloudflared")) return "cloudflared";
  if (process.platform !== "win32") return null;

  const candidates = [
    getProjectCloudflaredPath(cwd),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "cloudflared.exe"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "cloudflared", "cloudflared.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "cloudflared", "cloudflared.exe")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

async function installCloudflared({
  cwd = process.cwd(),
  stdout = process.stdout,
  stderr = process.stderr,
  spawnImpl = spawn,
  fetchImpl = fetch
} = {}) {
  if (process.platform !== "win32") {
    throw new Error("Automatic cloudflared install currently supports Windows. Install cloudflared manually, then run cgn mcp connect again.");
  }

  if (await commandExists("winget")) {
    stdout.write("cloudflared not found. Installing with winget...\n");
    try {
      await runProcess("winget", [
        "install",
        "--id",
        "Cloudflare.cloudflared",
        "-e",
        "--accept-source-agreements",
        "--accept-package-agreements"
      ], { stdout, stderr, spawnImpl });
      return;
    } catch (error) {
      stdout.write(`winget install failed: ${error.message}\n`);
      stdout.write("Falling back to a project-local cloudflared download...\n");
    }
  } else {
    stdout.write("winget was not found. Falling back to a project-local cloudflared download...\n");
  }

  await downloadCloudflared({ cwd, stdout, fetchImpl });
}

async function downloadCloudflared({
  cwd = process.cwd(),
  stdout = process.stdout,
  fetchImpl = fetch
} = {}) {
  const target = getProjectCloudflaredPath(cwd);
  const temp = `${target}.download`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rm(temp, { force: true });

  stdout.write(`Downloading cloudflared to ${target}\n`);
  const response = await fetchImpl(CLOUDFLARED_WINDOWS_DOWNLOAD_URL);
  if (!response.ok || !response.body) {
    throw new Error(`cloudflared download failed with HTTP ${response.status || "unknown"}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(temp));
  await fs.rename(temp, target);
  stdout.write("cloudflared downloaded.\n");
  return target;
}

function getProjectCloudflaredPath(cwd) {
  return path.join(cwd, ".chatgpt-native", "bin", "cloudflared.exe");
}

async function commandExists(command) {
  const probe = process.platform === "win32" ? "where.exe" : "which";
  const args = [command];
  try {
    const result = await runProcess(probe, args, { quiet: true });
    return result.code === 0;
  } catch {
    return false;
  }
}

async function runProcess(command, args, { stdout, stderr, spawnImpl = spawn, quiet = false } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, { windowsHide: true });
    child.stdout.on("data", (chunk) => {
      if (!quiet && stdout) stdout.write(String(chunk));
    });
    child.stderr.on("data", (chunk) => {
      if (!quiet && stderr) stderr.write(String(chunk));
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || quiet) {
        resolve({ code });
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function fileExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function findTryCloudflareUrl(text) {
  const match = String(text).match(/https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com\b/);
  return match ? match[0] : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openUrl(url) {
  const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  }).unref();
}

module.exports = {
  CHATGPT_CONNECTORS_URL,
  CLOUDFLARED_WINDOWS_DOWNLOAD_URL,
  CONNECTOR_DESCRIPTION,
  CONNECTOR_NAME,
  DEFAULT_TUNNEL_HOST,
  DEFAULT_TUNNEL_PORT,
  downloadCloudflared,
  findTryCloudflareUrl,
  formatConnectDryRun,
  formatMcpWebGuide,
  formatTunnelDryRun,
  getProjectCloudflaredPath,
  installCloudflared,
  resolveCloudflaredCommand,
  runWebConnect,
  runCloudflareTunnel
};
