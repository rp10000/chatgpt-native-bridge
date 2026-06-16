const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { ensureDir } = require("./fs-utils");

const DEFAULT_PACKAGE_SPEC = "github:rp10000/chatgpt-native-bridge";
const SERVER_NAME = "chatgpt-native-bridge";

function resolveCodexHome(options = {}) {
  return path.resolve(options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
}

function resolveCodexConfigPath(options = {}) {
  return path.join(resolveCodexHome(options), "config.toml");
}

function buildCodexMcpBlock(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const command = options.command || "npx";
  const packageSpec = options.packageSpec || DEFAULT_PACKAGE_SPEC;
  const args = buildNpxPackageArgs(packageSpec, ["mcp", "serve", "--stdio", "--root", root]);

  return [
    `[mcp_servers."${SERVER_NAME}"]`,
    `command = ${tomlString(command)}`,
    `args = ${tomlArray(args)}`,
    "startup_timeout_sec = 120",
    ""
  ].join("\n");
}

function mergeCodexMcpBlock(existing, block) {
  const normalizedExisting = existing || "";
  const cleaned = removeBridgeBlock(normalizedExisting).trimEnd();

  if (!cleaned) {
    return ensureTrailingNewline(block);
  }

  return ensureTrailingNewline(`${cleaned}\n\n${block.trimEnd()}`);
}

async function installCodexMcp(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const configPath = options.configPath || resolveCodexConfigPath(options);
  const existing = await readTextIfExists(configPath);
  const block = buildCodexMcpBlock({
    root: cwd,
    command: options.command,
    packageSpec: options.packageSpec
  });
  const next = mergeCodexMcpBlock(existing, block);
  const changed = next !== existing;

  if (!options.dryRun && changed) {
    await ensureDir(path.dirname(configPath));
    await fs.writeFile(configPath, next);
  }

  return {
    changed,
    command: options.command || "npx",
    configPath,
    dryRun: Boolean(options.dryRun),
    packageSpec: options.packageSpec || DEFAULT_PACKAGE_SPEC,
    root: cwd,
    serverName: SERVER_NAME,
    wrote: !options.dryRun && changed
  };
}

function formatCodexMcpInstall(result) {
  const mode = result.dryRun ? "dry-run" : result.wrote ? "written" : "already current";

  return `Codex MCP install: ${mode}

Config:
  ${result.configPath}

Server:
  ${result.serverName}

Project root:
  ${result.root}

Command:
  ${formatCommandLine(result.command, buildNpxPackageArgs(result.packageSpec, ["mcp", "serve", "--stdio", "--root", result.root]))}

Next:
  Restart Codex, or open a new Codex thread, so it reloads MCP config.
`;
}

function buildNpxPackageArgs(packageSpec, commandArgs) {
  return ["--yes", "--package", packageSpec, "--", "cgn", ...commandArgs];
}

function formatCommandLine(command, args) {
  return [command, ...args].map(shellArg).join(" ");
}

function shellArg(value) {
  const text = String(value);
  if (!/[\s"]/u.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function removeBridgeBlock(text) {
  const lines = text.split(/\r?\n/);
  const output = [];
  let skipping = false;

  for (const line of lines) {
    if (isBridgeHeader(line)) {
      skipping = true;
      continue;
    }

    if (skipping && isTableHeader(line)) {
      if (isBridgeSubtable(line)) {
        continue;
      }
      skipping = false;
    }

    if (!skipping) {
      output.push(line);
    }
  }

  return output.join("\n");
}

function isBridgeHeader(line) {
  return /^\s*\[mcp_servers\."chatgpt-native-bridge"\]\s*$/.test(line);
}

function isBridgeSubtable(line) {
  return /^\s*\[mcp_servers\."chatgpt-native-bridge"\.[^\]]+\]\s*$/.test(line);
}

function isTableHeader(line) {
  return /^\s*\[[^\]]+\]\s*$/.test(line);
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function tomlArray(values) {
  return `[${values.map(tomlString).join(", ")}]`;
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

module.exports = {
  DEFAULT_PACKAGE_SPEC,
  SERVER_NAME,
  buildCodexMcpBlock,
  buildNpxPackageArgs,
  formatCommandLine,
  formatCodexMcpInstall,
  installCodexMcp,
  mergeCodexMcpBlock,
  resolveCodexConfigPath,
  resolveCodexHome
};
