const path = require("node:path");

const { createAsk, VALID_TYPES } = require("./ask");
const { demoText } = require("./demo");
const { formatDoctorReport, getDoctorReport } = require("./doctor");
const { codexGuideText } = require("./guide");
const { importReply } = require("./import-reply");
const { initProject } = require("./init");
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
    io.stdout.write(`Outbox: ${result.outboxDir}\n`);
    io.stdout.write(`Ask: ${path.join(result.outboxDir, "ask.md")}\n`);
    for (const warning of result.warnings) {
      io.stderr.write(`warning: ${warning}\n`);
    }
    return;
  }

  if (command === "open") {
    const parsed = parseArgs(rest);
    const id = parsed.positionals[0] || "latest";
    const result = await openRun({
      cwd: io.cwd,
      id,
      openBrowser: !parsed.flags["no-browser"] && !parsed.flags["dry-run"],
      copyPrompt: !parsed.flags["no-clipboard"] && !parsed.flags["dry-run"]
    });
    io.stdout.write(`Run: ${result.id}\n`);
    io.stdout.write(`Outbox: ${result.outboxDir}\n`);
    io.stdout.write(`Ask copied: ${result.copied ? "yes" : "no"}\n`);
    io.stdout.write(`Browser opened: ${result.opened ? "yes" : "no"}\n`);
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
  const valueFlags = new Set(["task", "type", "include-files", "include-screenshots", "lang"]);

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
  cgn ask --task "Review pricing page" --type ux-review,naming-copy --include-diff
  cgn open <id|latest>
  cgn import <id|latest> [reply.md]
  cgn import <id|latest> --from-clipboard
  cgn status
  cgn demo
  cgn doctor
  cgn guide codex

Request types:
  ${VALID_TYPES.join(", ")}

Safety:
  No OpenAI API key, no hidden endpoints, no ChatGPT scraping.
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
  parseArgs
};
