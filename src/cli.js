const { createAsk, VALID_TYPES } = require("./ask");
const { demoText } = require("./demo");
const { formatDoctorReport, getDoctorReport } = require("./doctor");
const { codexGuideText } = require("./guide");
const { formatHandoffSummary, getHandoffSummary } = require("./handoff-summary");
const { importReply } = require("./import-reply");
const { initProject } = require("./init");
const { formatCodexMcpInstall, installCodexMcp } = require("./codex-mcp-install");
const { runMcpCommand } = require("./mcp-cli");
const { openRun } = require("./open-run");
const { formatStatus, getStatus } = require("./status");

async function main(argv, io = defaultIo()) {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    io.stdout.write(helpText());
    return;
  }

  if (command === "--version" || command === "-v") {
    const pkg = require("../package.json");
    io.stdout.write(`${pkg.version}\n`);
    return;
  }

  if (command === "init") {
    const parsed = parseArgs(rest);
    const result = await initProject({ cwd: io.cwd, force: Boolean(parsed.flags.force) });
    printCreated(io, result);
    return;
  }

  if (command === "setup") {
    const parsed = parseArgs(rest);
    const result = await initProject({ cwd: io.cwd, force: Boolean(parsed.flags.force) });
    printCreated(io, result);
    io.stdout.write("\n");
    const report = await getDoctorReport({ cwd: io.cwd });
    io.stdout.write(formatDoctorReport(report));
    io.stdout.write("\n");
    if (parsed.flags.mcp) {
      const mcp = await installCodexMcp({
        cwd: io.cwd,
        codexHome: parsed.flags["codex-home"],
        dryRun: Boolean(parsed.flags["dry-run"])
      });
      io.stdout.write(formatCodexMcpInstall(mcp));
      io.stdout.write("\n");
    }
    io.stdout.write(codexGuideText(parsed.flags.lang || "en"));
    return;
  }

  if (command === "demo") {
    io.stdout.write(demoText());
    return;
  }

  if (command === "doctor") {
    const report = await getDoctorReport({ cwd: io.cwd });
    io.stdout.write(formatDoctorReport(report));
    return;
  }

  if (command === "guide") {
    const parsed = parseArgs(rest);
    const subject = parsed.positionals[0];
    if (subject !== "codex") {
      throw new Error('Unknown guide. Run "cgn guide codex".');
    }
    io.stdout.write(codexGuideText(parsed.flags.lang || "en"));
    return;
  }

  if (command === "mcp") {
    const [subcommand, ...mcpRest] = rest;
    await runMcpCommand({
      subcommand,
      args: parseArgs(mcpRest),
      cwd: io.cwd,
      stdout: io.stdout,
      stderr: io.stderr
    });
    return;
  }

  if (command === "ask") {
    const parsed = parseArgs(rest);
    const result = await createAsk({
      cwd: io.cwd,
      task: parsed.flags.task,
      types: parsed.flags.type,
      includeDiff: Boolean(parsed.flags["include-diff"]),
      includeTests: Boolean(parsed.flags["include-tests"]),
      includeFiles: parsed.flags["include-files"],
      includeScreenshots: parsed.flags["include-screenshots"]
    });
    io.stdout.write(`Created handoff: ${result.id}\n`);
    const summary = await getHandoffSummary(result.outboxDir);
    io.stdout.write(formatHandoffSummary(summary, { mode: "manual", copied: false, opened: false }));
    for (const warning of result.warnings) {
      io.stderr.write(`warning: ${warning}\n`);
    }
    return;
  }

  if (command === "handoff") {
    const parsed = parseArgs(rest);
    const ask = await createAsk({
      cwd: io.cwd,
      task: parsed.flags.task,
      types: parsed.flags.type,
      includeDiff: Boolean(parsed.flags["include-diff"]),
      includeTests: Boolean(parsed.flags["include-tests"]),
      includeFiles: parsed.flags["include-files"],
      includeScreenshots: parsed.flags["include-screenshots"]
    });
    io.stdout.write(`Created handoff: ${ask.id}\n`);
    for (const warning of ask.warnings) {
      io.stderr.write(`warning: ${warning}\n`);
    }
    const openOptions = resolveOpenOptions(parsed.flags);
    const opened = await openRun({
      cwd: io.cwd,
      id: ask.id,
      openBrowser: openOptions.openBrowser,
      copyPrompt: openOptions.copyPrompt,
      openFolder: openOptions.openFolder
    });
    io.stdout.write(`Run: ${opened.id}\n`);
    io.stdout.write(formatHandoffSummary(opened.summary, {
      mode: openOptions.mode,
      copied: opened.copied,
      opened: opened.opened,
      folderOpened: opened.folderOpened
    }));
    return;
  }

  if (command === "open") {
    const parsed = parseArgs(rest);
    const id = parsed.positionals[0] || "latest";
    const openOptions = resolveOpenOptions(parsed.flags);
    const result = await openRun({
      cwd: io.cwd,
      id,
      openBrowser: openOptions.openBrowser,
      copyPrompt: openOptions.copyPrompt,
      openFolder: openOptions.openFolder
    });
    io.stdout.write(`Run: ${result.id}\n`);
    io.stdout.write(formatHandoffSummary(result.summary, {
      mode: openOptions.mode,
      copied: result.copied,
      opened: result.opened,
      folderOpened: result.folderOpened
    }));
    return;
  }

  if (command === "import") {
    const parsed = parseArgs(rest);
    const id = parsed.positionals[0] || "latest";
    const sourceFile = parsed.positionals[1];
    const result = await importReply({
      cwd: io.cwd,
      id,
      sourceFile,
      fromClipboard: Boolean(parsed.flags["from-clipboard"])
    });
    io.stdout.write(`Imported reply: ${result.id}\n`);
    io.stdout.write(`Reply: ${result.replyPath}\n`);
    io.stdout.write(`Codex guide: ${result.codexReadThisPath}\n`);
    return;
  }

  if (command === "done") {
    const parsed = parseArgs(rest);
    const sourceFile = parsed.positionals[0];
    const result = await importReply({
      cwd: io.cwd,
      id: "latest",
      sourceFile,
      fromClipboard: Boolean(parsed.flags["from-clipboard"]) || !sourceFile
    });
    io.stdout.write(`Imported reply: ${result.id}\n`);
    io.stdout.write(`Reply: ${result.replyPath}\n`);
    io.stdout.write(`Codex guide: ${result.codexReadThisPath}\n`);
    return;
  }

  if (command === "status") {
    const status = await getStatus({ cwd: io.cwd });
    io.stdout.write(formatStatus(status));
    return;
  }

  throw new Error(`Unknown command "${command}". Run cgn --help.`);
}

function parseArgs(args) {
  const flags = {};
  const positionals = [];
  const valueFlags = new Set([
    "task",
    "type",
    "include-files",
    "include-screenshots",
    "lang",
    "mode",
    "host",
    "port",
    "root",
    "codex-home"
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const eq = arg.indexOf("=");
    if (eq !== -1) {
      const key = arg.slice(2, eq);
      addFlag(flags, key, arg.slice(eq + 1));
      continue;
    }

    const key = arg.slice(2);
    if (valueFlags.has(key)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`--${key} requires a value`);
      }
      addFlag(flags, key, value);
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return { flags, positionals };
}

function resolveOpenOptions(flags) {
  const requestedMode = flags.mode || (flags.manual ? "manual" : "assist");
  const dryRun = Boolean(flags["dry-run"]);

  if (requestedMode === "manual") {
    return {
      mode: "manual",
      openBrowser: false,
      copyPrompt: false,
      openFolder: false
    };
  }

  if (requestedMode === "assist" || requestedMode === "assisted") {
    return {
      mode: "assist",
      openBrowser: !flags["no-browser"] && !dryRun,
      copyPrompt: !flags["no-clipboard"] && !dryRun,
      openFolder: false
    };
  }

  if (requestedMode === "auto") {
    return {
      mode: "auto",
      openBrowser: !flags["no-browser"] && !dryRun,
      copyPrompt: !flags["no-clipboard"] && !dryRun,
      openFolder: !flags["no-folder"] && !dryRun
    };
  }

  throw new Error("--mode must be manual, assist, or auto.");
}

function addFlag(flags, key, value) {
  if (flags[key] === undefined) {
    flags[key] = value;
  } else if (Array.isArray(flags[key])) {
    flags[key].push(value);
  } else {
    flags[key] = [flags[key], value];
  }
}

function printCreated(io, result) {
  if (result.created.length) {
    io.stdout.write("Created:\n");
    for (const item of result.created) io.stdout.write(`- ${item}\n`);
  }
  if (result.skipped.length) {
    io.stdout.write("Skipped existing:\n");
    for (const item of result.skipped) io.stdout.write(`- ${item}\n`);
  }
}

function helpText() {
  return `chatgpt-native-bridge

Usage:
  cgn init
  cgn setup
  cgn setup --mcp
  cgn mcp install
  cgn mcp serve --host 127.0.0.1 --port 47832
  cgn mcp config
  cgn ask --task "Review pricing page" --type ux-review,naming-copy --include-diff
  cgn handoff --task "Review pricing page" --type ux-review --include-diff
  cgn handoff --task "Review pricing page" --mode manual
  cgn open {id|latest} --mode assist
  cgn import {id|latest} [reply.md]
  cgn import {id|latest} --from-clipboard
  cgn done
  cgn status
  cgn demo
  cgn doctor
  cgn guide codex

Request types:
  ${VALID_TYPES.join(", ")}

Safety:
  No OpenAI API key, no hidden endpoints, no ChatGPT scraping, no arbitrary shell execution.

MCP:
  cgn setup --mcp  Initialize the project and install this MCP into Codex config.
  cgn mcp install  Install the Codex MCP config block for this project.
  cgn mcp serve   Start the local MCP server at http://127.0.0.1:47832/mcp.
  cgn mcp config  Print ChatGPT/Codex MCP connection hints.
  cgn mcp doctor  Check the local bridge and list MCP tools.

Modes:
  --mode assist  Open ChatGPT and copy 01_PASTE_TO_CHATGPT.md. This is the default.
  --mode manual  Print paths only. No browser or clipboard.
  --mode auto    Open ChatGPT, copy the prompt, and open the outbox folder. It does not submit or upload automatically.
`;
}

function defaultIo() {
  return {
    cwd: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr
  };
}

module.exports = {
  main,
  parseArgs,
  resolveOpenOptions
};
