const crypto = require("node:crypto");
const path = require("node:path");

const { isRootAllowed, listAllowedRoots } = require("../global-config");
const { getCanonicalRoot } = require("./paths");

function createWorkspaceRegistry(options = {}) {
  const defaultRoot = path.resolve(options.cwd || process.cwd());
  const configOptions = options.configDir ? { configDir: options.configDir } : {};
  let current = null;

  async function openWorkspace(input = {}) {
    const requestedRoot = getRequestedRoot(defaultRoot, input);
    const canonical = await getCanonicalRoot(requestedRoot);
    const canonicalKey = canonicalKeyFor(canonical.canonicalRoot);
    const workspaceId = makeWorkspaceId(canonical.canonicalRoot);

    if (current && current.canonicalKey !== canonicalKey) {
      throw new Error(`A workspace is already open: ${current.canonicalRoot}`);
    }

    const allowed = await checkAllowed(canonical);
    if (!allowed.allowed) {
      throw new Error(`Project is not allowed: ${canonical.root}. Run "cgn projects add ${canonical.root}" first.`);
    }

    if (!current) {
      current = {
        workspaceId,
        root: canonical.root,
        canonicalRoot: canonical.canonicalRoot,
        canonicalKey,
        openedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        operations: []
      };
    } else {
      current.lastUsedAt = new Date().toISOString();
    }

    return publicStatus(current);
  }

  async function listWorkspaces() {
    const listed = await listAllowedRoots(configOptions);
    const defaultCanonical = await getCanonicalRoot(defaultRoot);
    const roots = listed.roots.map((entry) => ({
      ...entry,
      workspaceId: makeWorkspaceId(entry.canonicalRoot),
      current: current ? current.canonicalKey === canonicalKeyFor(entry.canonicalRoot) : false,
      runtimeDefault: canonicalKeyFor(entry.canonicalRoot) === canonicalKeyFor(defaultCanonical.canonicalRoot)
    }));

    if (!roots.some((entry) => canonicalKeyFor(entry.canonicalRoot) === canonicalKeyFor(defaultCanonical.canonicalRoot))) {
      roots.unshift({
        root: defaultCanonical.root,
        canonicalRoot: defaultCanonical.canonicalRoot,
        name: path.basename(defaultCanonical.root) || defaultCanonical.root,
        workspaceId: makeWorkspaceId(defaultCanonical.canonicalRoot),
        current: current ? current.canonicalKey === canonicalKeyFor(defaultCanonical.canonicalRoot) : false,
        runtimeDefault: true,
        addedAt: null,
        lastUsedAt: null
      });
    }

    return {
      roots,
      lastSelectedProject: listed.lastSelectedProject,
      configPath: listed.configPath
    };
  }

  function status() {
    if (!current) {
      return {
        open: false,
        workspaceId: null,
        root: null,
        canonicalRoot: null
      };
    }
    return publicStatus(current);
  }

  function getWorkspace(workspaceId) {
    if (!workspaceId) throw new Error("workspaceId is required.");
    if (!current) throw new Error("No workspace is open.");
    if (workspaceId !== current.workspaceId) throw new Error(`Unknown workspaceId: ${workspaceId}`);

    current.lastUsedAt = new Date().toISOString();
    return current;
  }

  function requireWorkspace(workspaceId) {
    const workspace = getWorkspace(workspaceId);
    return publicStatus(workspace);
  }

  function recordOperation(workspaceId, operation) {
    const workspace = getWorkspace(workspaceId);
    workspace.operations.push({
      ts: new Date().toISOString(),
      ...operation
    });
    workspace.operations = workspace.operations.slice(-100);
  }

  return {
    getWorkspace,
    listWorkspaces,
    openWorkspace,
    recordOperation,
    requireWorkspace,
    status
  };

  async function checkAllowed(canonical) {
    const defaultCanonical = await getCanonicalRoot(defaultRoot);
    if (canonicalKeyFor(canonical.canonicalRoot) === canonicalKeyFor(defaultCanonical.canonicalRoot)) {
      return { allowed: true, runtimeDefault: true };
    }
    return isRootAllowed(canonical.canonicalRoot, configOptions);
  }
}

function getRequestedRoot(defaultRoot, input) {
  if (typeof input === "string") return input;
  if (input.root) return input.root;
  if (input.path) return path.resolve(defaultRoot, input.path);
  return defaultRoot;
}

function makeWorkspaceId(canonicalRoot) {
  const digest = crypto.createHash("sha256").update(canonicalKeyFor(canonicalRoot)).digest("hex").slice(0, 16);
  return `workspace_${digest}`;
}

function canonicalKeyFor(canonicalRoot) {
  return process.platform === "win32" ? canonicalRoot.toLowerCase() : canonicalRoot;
}

function publicStatus(workspace) {
  return {
    open: true,
    workspaceId: workspace.workspaceId,
    root: workspace.root,
    canonicalRoot: workspace.canonicalRoot
  };
}

const defaultRegistry = createWorkspaceRegistry();

module.exports = {
  createWorkspaceRegistry,
  listWorkspaces: defaultRegistry.listWorkspaces,
  makeWorkspaceId,
  openWorkspace: defaultRegistry.openWorkspace,
  recordOperation: defaultRegistry.recordOperation,
  requireWorkspace: defaultRegistry.requireWorkspace,
  status: defaultRegistry.status
};
