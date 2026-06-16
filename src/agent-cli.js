const {
  getAgentStatus,
  readAgentLog,
  readAgentResult,
  startAgentTask,
  stopAgentTask
} = require("./local-agent");

async function runAgentCommand({ subcommand, args, cwd, stdout }) {
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    stdout.write(agentHelpText());
    return;
  }

  if (subcommand === "start") {
    const task = args.flags.task || args.positionals.join(" ");
    const result = await startAgentTask({
      cwd,
      task,
      includeDiff: !args.flags["no-diff"],
      maxBytes: args.flags["max-bytes"]
    });
    stdout.write(formatAgentSummary(result));
    return;
  }

  if (subcommand === "status") {
    const result = await getAgentStatus({ cwd, id: args.positionals[0] || args.flags.id || "latest" });
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (subcommand === "log") {
    const result = await readAgentLog({
      cwd,
      id: args.positionals[0] || args.flags.id || "latest",
      maxBytes: args.flags["max-bytes"]
    });
    stdout.write(result.text);
    return;
  }

  if (subcommand === "result") {
    const result = await readAgentResult({
      cwd,
      id: args.positionals[0] || args.flags.id || "latest",
      maxBytes: args.flags["max-bytes"]
    });
    stdout.write(result.text);
    return;
  }

  if (subcommand === "stop") {
    const result = await stopAgentTask({ cwd, id: args.positionals[0] || args.flags.id || "latest" });
    stdout.write(formatAgentSummary(result));
    return;
  }

  throw new Error(`Unknown agent command "${subcommand}". Run "cgn agent --help".`);
}

function formatAgentSummary(result) {
  return `chatgpt-native-bridge local agent

Run:
  ${result.id}

State:
  ${result.state}

Result:
  ${result.resultPath}

Log:
  ${result.logPath}

Codex inbox:
  ${result.replyPath || "not written yet"}

Next:
  ${result.nextAction}
`;
}

function agentHelpText() {
  return `chatgpt-native-bridge local agent

Usage:
  cgn agent start --task "Review current project"
  cgn agent status [id]
  cgn agent log [id]
  cgn agent result [id]
  cgn agent stop [id]

Safety:
  The local agent does not expose arbitrary shell execution and does not edit source files in this MVP.
  It writes results to .chatgpt-native/agent/runs and .chatgpt-native/inbox.
`;
}

module.exports = {
  agentHelpText,
  formatAgentSummary,
  runAgentCommand
};
