const path = require("node:path");

const { appendWorkspaceAudit } = optionalRequire("./audit", {
  appendWorkspaceAudit: async () => {}
});
const { getWorkspaceChanges } = optionalRequire("./change-tracker", {
  getWorkspaceChanges: async () => ({ gitStatus: "change tracker unavailable" })
});
const { appendCommandHistory, readCommandHistory } = require("./command-history");
const {
  listWorkspaceDirectory,
  readProjectInstructions,
  searchWorkspace
} = require("./discovery");
const { editWorkspaceFile, readWorkspaceFile, writeWorkspaceFile } = require("./files");
const { resolveWorkspacePath } = require("./paths");
const { createWorkspaceRegistry } = require("./registry");
const { runWorkspaceShell } = optionalRequire("./shell-runner", {
  runWorkspaceShell: async () => {
    throw new Error("Workspace shell runner is not available.");
  }
});

function createWorkspaceEngine(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const registry = createWorkspaceRegistry({ cwd, configDir: options.configDir });

  async function openWorkspace(args = {}) {
    return registry.openWorkspace(args);
  }

  async function listWorkspaces() {
    return registry.listWorkspaces();
  }

  function status(args = {}) {
    if (args.workspaceId) return registry.requireWorkspace(args.workspaceId);
    return registry.status();
  }

  async function read(args = {}) {
    const workspace = registry.getWorkspace(args.workspaceId);
    return readWorkspaceFile({ root: workspace.root, ...args });
  }

  async function write(args = {}) {
    const workspace = registry.getWorkspace(args.workspaceId);
    const result = await writeWorkspaceFile({ root: workspace.root, ...args });
    registry.recordOperation(args.workspaceId, { type: "write", path: result.path, newHash: result.newHash });
    await appendWorkspaceAudit(workspace.root, {
      toolName: "write",
      actionType: "file_write",
      affectedPaths: [result.path],
      oldHash: result.oldHash,
      newHash: result.newHash
    });
    return result;
  }

  async function edit(args = {}) {
    const workspace = registry.getWorkspace(args.workspaceId);
    const result = await editWorkspaceFile({ root: workspace.root, ...args });
    registry.recordOperation(args.workspaceId, { type: "edit", path: result.path, newHash: result.newHash });
    await appendWorkspaceAudit(workspace.root, {
      toolName: "edit",
      actionType: "file_edit",
      affectedPaths: [result.path],
      oldHash: result.oldHash,
      newHash: result.newHash,
      editsApplied: result.editsApplied
    });
    return result;
  }

  async function bash(args = {}) {
    const workspace = registry.getWorkspace(args.workspaceId);
    const workingDirectory = args.workingDirectory
      ? (await resolveWorkspacePath(workspace.root, args.workingDirectory)).targetRealPath
      : workspace.root;
    const result = await runWorkspaceShell({ cwd: workingDirectory, ...args });
    const changes = await getWorkspaceChanges(workspace.root, { includeDiff: false });
    registry.recordOperation(args.workspaceId, {
      type: "bash",
      commandHash: result.commandHash,
      commandRedacted: result.commandRedacted,
      exitCode: result.exitCode,
      timedOut: result.timedOut
    });
    const commandRecord = await appendCommandHistory(workspace.root, {
      workspaceId: args.workspaceId,
      workingDirectory,
      result
    });
    await appendWorkspaceAudit(workspace.root, {
      toolName: "bash",
      actionType: "shell",
      commandHash: result.commandHash,
      commandRedacted: result.commandRedacted,
      cwdRelative: path.relative(workspace.root, workingDirectory) || ".",
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
      stdoutBytes: Buffer.byteLength(result.stdout || "", "utf8"),
      stderrBytes: Buffer.byteLength(result.stderr || "", "utf8"),
      truncated: result.truncated
    });
    return {
      ...result,
      historyId: commandRecord.id,
      changesSummary: changes.gitStatus
    };
  }

  async function showChanges(args = {}) {
    const workspace = registry.getWorkspace(args.workspaceId);
    const changes = await getWorkspaceChanges(workspace.root, args);
    const recentCommands = await readCommandHistory(workspace.root, { limit: args.commandLimit || 10 });
    return {
      workspaceId: workspace.workspaceId,
      root: workspace.root,
      operations: workspace.operations || [],
      recentCommands,
      ...changes
    };
  }

  async function search(args = {}) {
    const workspace = registry.getWorkspace(args.workspaceId);
    return searchWorkspace({ root: workspace.root, ...args });
  }

  async function listDirectory(args = {}) {
    const workspace = registry.getWorkspace(args.workspaceId);
    return listWorkspaceDirectory({ root: workspace.root, ...args });
  }

  async function projectInstructions(args = {}) {
    const workspace = registry.getWorkspace(args.workspaceId);
    return readProjectInstructions({ root: workspace.root, ...args });
  }

  async function commandHistory(args = {}) {
    const workspace = registry.getWorkspace(args.workspaceId);
    const commands = await readCommandHistory(workspace.root, args);
    return {
      workspaceId: workspace.workspaceId,
      commands
    };
  }

  return {
    bash,
    commandHistory,
    edit,
    listDirectory,
    listWorkspaces,
    openWorkspace,
    projectInstructions,
    read,
    search,
    showChanges,
    status,
    write
  };
}

module.exports = {
  createWorkspaceEngine
};

function optionalRequire(modulePath, fallback) {
  try {
    return require(modulePath);
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND" && error.message.includes(modulePath)) {
      return fallback;
    }
    throw error;
  }
}
