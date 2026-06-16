const path = require("node:path");

const {
  DEFAULT_PACKAGE_SPEC,
  buildNpxPackageArgs,
  formatCodexMcpInstall,
  installCodexMcp
} = require("./codex-mcp-install");
const { formatDoctorReport, getDoctorReport } = require("./doctor");
const { TOOL_NAMES } = require("./mcp-tools");
const { startMcpHttpServer, startMcpStdio } = require("./mcp-server");
const { formatMcpWebGuide, runCloudflareTunnel, runWebConnect } = require("./mcp-web");
const { DEFAULT_WAIT_SECONDS, formatMcpWaitResult, waitForMcpCall } = require("./mcp-wait");

const DEFAULT_MCP_HOST = "127.0.0.1";
const DEFAULT_MCP_PORT = 47832;

async function runMcpCommand({ subcommand, args, cwd, stdout, stderr }) {
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    stdout.write(mcpHelpText());
    return;
  }

  const parsed = args;
  const root = path.resolve(cwd, parsed.flags.root || ".");
  const host = parsed.flags.host || DEFAULT_MCP_HOST;
  const port = parsePort(parsed.flags.port || DEFAULT_MCP_PORT);

  if (subcommand === "config") {
    stdout.write(formatMcpConfig({ cwd: root, host, port }));
    return;
  }

  if (subcommand === "install") {
    const result = await installCodexMcp({
      cwd: root,
      codexHome: parsed.flags["codex-home"],
      dryRun: Boolean(parsed.flags["dry-run"])
    });
    stdout.write(formatCodexMcpInstall(result));
    return;
  }

  if (subcommand === "doctor") {
    const report = await getDoctorReport({ cwd: root });
    stdout.write(formatMcpDoctor({ cwd: root, host, port, report }));
    return;
  }

  if (subcommand === "wait") {
    const result = await waitForMcpCall({
      cwd: root,
      timeoutSeconds: parsed.flags.timeout || DEFAULT_WAIT_SECONDS
    });
    stdout.write(formatMcpWaitResult(result));
    return;
  }

  if (subcommand === "web") {
    stdout.write(formatMcpWebGuide({ host, port }));
    return;
  }

  if (subcommand === "connect") {
    await runWebConnect({
      host,
      port,
      cwd: root,
      stdout,
      stderr,
      dryRun: Boolean(parsed.flags["dry-run"]),
      yes: Boolean(parsed.flags.yes),
      openChatgpt: Boolean(parsed.flags.open) || Boolean(parsed.flags["open-chatgpt"])
    });
    return;
  }

  if (subcommand === "tunnel" || subcommand === "cloudflare") {
    await runCloudflareTunnel({
      host,
      port,
      stdout,
      stderr,
      dryRun: Boolean(parsed.flags["dry-run"]),
      openChatgpt: Boolean(parsed.flags.open) || Boolean(parsed.flags["open-chatgpt"])
    });
    return;
  }

  if (subcommand === "serve") {
    if (parsed.flags.stdio) {
      await startMcpStdio({ cwd: root });
      stderr.write("chatgpt-native-bridge MCP server running on stdio\n");
      return;
    }

    const server = await startMcpHttpServer({ cwd: root, host, port });
    stdout.write(`chatgpt-native-bridge MCP server running\n`);
    stdout.write(`Endpoint: ${server.url}\n`);
    stdout.write(`Health: ${server.healthUrl}\n`);
    stdout.write("Press Ctrl+C to stop.\n");

    const close = async () => {
      await server.close();
      process.exit(0);
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    return;
  }

  throw new Error(`Unknown mcp command "${subcommand}". Run "cgn mcp --help".`);
}

function formatMcpConfig({ cwd, host = DEFAULT_MCP_HOST, port = DEFAULT_MCP_PORT }) {
  const endpoint = `http://${host}:${port}/mcp`;
  const stdioConfig = {
    mcpServers: {
      "chatgpt-native-bridge": {
        command: "npx",
        args: buildNpxPackageArgs(DEFAULT_PACKAGE_SPEC, ["mcp", "serve", "--stdio", "--root", cwd])
      }
    }
  };

  return `chatgpt-native-bridge MCP config

Codex install:
  npx --yes --package github:rp10000/chatgpt-native-bridge cgn setup --mcp

HTTP endpoint:
  ${endpoint}

Start the local HTTP server:
  cgn mcp serve --host ${host} --port ${port} --root "${cwd}"

For local MCP clients that spawn stdio servers:
${JSON.stringify(stdioConfig, null, 2)}

Tools:
${TOOL_NAMES.map((name) => `  - ${name}`).join("\n")}

Security:
  No API key. No hidden endpoints. No ChatGPT scraping. No arbitrary shell execution.
  File reads are bounded and block .env, keys, cookies, sessions, .git, node_modules, and secret-like content.
`;
}

function formatMcpDoctor({ cwd, host, port, report }) {
  return `chatgpt-native-bridge MCP doctor

Root:
  ${cwd}

Endpoint when running:
  http://${host}:${port}/mcp

Available tools:
${TOOL_NAMES.map((name) => `  - ${name}`).join("\n")}

Base project doctor:
${indent(formatDoctorReport(report).trim(), "  ")}
`;
}

function mcpHelpText() {
  return `chatgpt-native-bridge MCP

Usage:
  cgn mcp install
  cgn mcp connect --yes --open
  cgn mcp wait
  cgn mcp web
  cgn mcp tunnel
  cgn mcp serve --host 127.0.0.1 --port 47832
  cgn mcp serve --stdio
  cgn mcp config
  cgn mcp doctor

Options:
  --root PATH         Project root to expose. Defaults to the current directory.
  --codex-home PATH   Codex home to update for install. Defaults to CODEX_HOME or ~/.codex.
  --dry-run           Show install output without writing config.
  --host HOST         HTTP bind host. Defaults to 127.0.0.1.
  --open             Open the ChatGPT connector settings page when the HTTPS URL is ready.
  --port PORT         HTTP bind port. Defaults to 47832.
  --stdio             Serve over stdio instead of HTTP.
  --timeout SECONDS   How long cgn mcp wait should watch for a real ChatGPT MCP tool call. Defaults to 120.
`;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function indent(text, prefix) {
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

module.exports = {
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  formatMcpConfig,
  formatMcpDoctor,
  mcpHelpText,
  parsePort,
  runMcpCommand
};
