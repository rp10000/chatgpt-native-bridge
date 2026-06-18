const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { appendShellRunAuditEvent } = require("../src/workspace/audit");
const { getWorkspaceChangeSummary } = require("../src/workspace/change-tracker");
const { createWorkspaceEngine } = require("../src/workspace/engine");
const { runWorkspaceShell } = require("../src/workspace/shell-runner");

test("workspace shell runs a successful command", async () => {
  const cwd = await tempDir("cgn-shell-ok-");
  const result = await runWorkspaceShell({
    cwd,
    command: nodeCommand("process.stdout.write('ok')"),
    timeoutMs: 5000
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.stdout, "ok");
  assert.equal(result.stderr, "");
  assert.equal(result.truncated.stdout, false);
  assert.equal(result.truncated.stderr, false);
  assert.ok(result.durationMs >= 0);
});

test("workspace shell returns non-zero exits without throwing", async () => {
  const cwd = await tempDir("cgn-shell-exit-");
  const result = await runWorkspaceShell({
    cwd,
    command: nodeCommand("process.exit(7)"),
    timeoutMs: 5000
  });

  assert.equal(result.exitCode, 7);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
});

test("workspace shell times out non-interactive commands", async () => {
  const cwd = await tempDir("cgn-shell-timeout-");
  const result = await runWorkspaceShell({
    cwd,
    command: nodeCommand("setTimeout(() => {}, 5000)"),
    timeoutMs: 100
  });

  assert.equal(result.exitCode, null);
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs >= 90);
});

test("workspace shell truncates stdout and stderr", async () => {
  const cwd = await tempDir("cgn-shell-truncate-");
  const result = await runWorkspaceShell({
    cwd,
    command: nodeCommand("process.stdout.write(Buffer.alloc(2048, 120)); process.stderr.write(Buffer.alloc(2048, 121))"),
    timeoutMs: 5000,
    maxOutputBytes: 64
  });

  assert.equal(result.exitCode, 0);
  assert.equal(Buffer.byteLength(result.stdout), 64);
  assert.equal(Buffer.byteLength(result.stderr), 64);
  assert.equal(result.truncated.stdout, true);
  assert.equal(result.truncated.stderr, true);
});

test("change tracker returns warnings instead of throwing outside git repos", async () => {
  const cwd = await tempDir("cgn-change-tracker-");
  const summary = await getWorkspaceChangeSummary({ cwd });

  assert.equal(summary.ok, false);
  assert.ok(summary.warnings.length >= 1);
  assert.match(summary.warnings[0], /git/i);
});

test("audit appends jsonl shell summaries without full command or output", async () => {
  const cwd = await tempDir("cgn-audit-");
  const auditPath = path.join(cwd, "audit.jsonl");
  const result = await runWorkspaceShell({
    cwd,
    command: nodeCommand("process.stdout.write('audit-out'); process.stderr.write('audit-err')"),
    timeoutMs: 5000
  });

  const event = await appendShellRunAuditEvent(auditPath, {
    cwd,
    command: `${nodeCommand("process.stdout.write('ok')")} --token sk-secret`,
    shell: "powershell",
    result
  });

  const lines = (await fs.readFile(auditPath, "utf8")).trim().split(/\r?\n/);
  const row = JSON.parse(lines[0]);

  assert.deepEqual(row, event);
  assert.equal(row.type, "workspace.shell.run");
  assert.equal(row.exitCode, 0);
  assert.equal(row.timedOut, false);
  assert.equal(row.stdout.bytes, Buffer.byteLength("audit-out"));
  assert.match(row.stdout.hash, /^[a-f0-9]{64}$/);
  assert.equal(row.stderr.bytes, Buffer.byteLength("audit-err"));
  assert.match(row.stderr.hash, /^[a-f0-9]{64}$/);
  assert.equal(row.command, undefined);
  assert.equal(row.stdout.text, undefined);
  assert.equal(row.stderr.text, undefined);
  assert.match(row.commandRedacted, /\[REDACTED\]/);
  assert.doesNotMatch(JSON.stringify(row), /audit-out|audit-err|sk-secret/);
});

test("workspace engine records command history for bash and show_changes", async () => {
  const cwd = await tempDir("cgn-engine-history-");
  const engine = createWorkspaceEngine({ cwd });
  const { workspaceId } = await engine.openWorkspace({ root: cwd });

  const result = await engine.bash({
    workspaceId,
    command: nodeCommand("process.stdout.write('history-ok')"),
    timeoutMs: 5000
  });
  assert.equal(result.exitCode, 0);
  assert.ok(result.historyId);

  const history = await engine.commandHistory({ workspaceId });
  assert.equal(history.commands.length, 1);
  assert.match(history.commands[0].commandRedacted, /node -e/);
  assert.equal(history.commands[0].stdoutPreview, "history-ok");

  const changes = await engine.showChanges({ workspaceId, includeDiff: false });
  assert.equal(changes.recentCommands[0].stdoutPreview, "history-ok");
});

async function tempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function nodeCommand(script) {
  assert.equal(script.includes('"'), false, "nodeCommand scripts must not contain double quotes");
  return `node -e "${script}"`;
}
