const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const CONFIG_VERSION = 1;
const CONFIG_FILE = "config.json";
const SHELL_MODES = new Set(["trusted", "safe", "off"]);
const TOOL_MODES = new Set(["standard", "simple"]);

function getGlobalConfigDir(options = {}) {
  return path.resolve(
    options.configDir ||
    process.env.CGN_CONFIG_HOME ||
    path.join(os.homedir(), ".chatgpt-native")
  );
}

function getGlobalConfigPath(options = {}) {
  return path.join(getGlobalConfigDir(options), CONFIG_FILE);
}

async function loadGlobalConfig(options = {}) {
  const configPath = getGlobalConfigPath(options);
  try {
    const parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
    return normalizeConfig(parsed, configPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return normalizeConfig({}, configPath);
  }
}

async function saveGlobalConfig(config, options = {}) {
  const configPath = getGlobalConfigPath(options);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const normalized = normalizeConfig(config, configPath);
  await fs.writeFile(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

async function addAllowedRoot(root, options = {}) {
  const config = await loadGlobalConfig(options);
  const item = await normalizeRoot(root || ".", options.cwd);
  const now = new Date().toISOString();
  const existing = config.allowedRoots.find((entry) => entry.canonicalKey === item.canonicalKey);
  if (existing) {
    existing.root = item.root;
    existing.canonicalRoot = item.canonicalRoot;
    existing.name = item.name;
    existing.lastUsedAt = now;
  } else {
    config.allowedRoots.push({
      root: item.root,
      canonicalRoot: item.canonicalRoot,
      canonicalKey: item.canonicalKey,
      name: item.name,
      addedAt: now,
      lastUsedAt: now
    });
  }
  config.lastSelectedProject = item.canonicalRoot;
  await saveGlobalConfig(config, options);
  return { config, project: item, configPath: config.__configPath };
}

async function removeAllowedRoot(root, options = {}) {
  const config = await loadGlobalConfig(options);
  const item = await normalizeRoot(root || ".", options.cwd);
  const before = config.allowedRoots.length;
  config.allowedRoots = config.allowedRoots.filter((entry) => entry.canonicalKey !== item.canonicalKey);
  if (config.lastSelectedProject && canonicalKeyFor(config.lastSelectedProject) === item.canonicalKey) {
    config.lastSelectedProject = config.allowedRoots[0] ? config.allowedRoots[0].canonicalRoot : null;
  }
  await saveGlobalConfig(config, options);
  return {
    removed: before !== config.allowedRoots.length,
    project: item,
    config,
    configPath: config.__configPath
  };
}

async function listAllowedRoots(options = {}) {
  const config = await loadGlobalConfig(options);
  return {
    configPath: config.__configPath,
    lastSelectedProject: config.lastSelectedProject,
    preferredTunnelMode: config.preferredTunnelMode,
    roots: config.allowedRoots.map(publicRoot)
  };
}

async function isRootAllowed(root, options = {}) {
  const config = await loadGlobalConfig(options);
  const item = await normalizeRoot(root || ".", options.cwd);
  const match = config.allowedRoots.find((entry) => entry.canonicalKey === item.canonicalKey);
  return {
    allowed: Boolean(match),
    project: item,
    match: match ? publicRoot(match) : null,
    configPath: config.__configPath
  };
}

async function setLastSelectedProject(root, options = {}) {
  const config = await loadGlobalConfig(options);
  const item = await normalizeRoot(root || ".", options.cwd);
  config.lastSelectedProject = item.canonicalRoot;
  for (const entry of config.allowedRoots) {
    if (entry.canonicalKey === item.canonicalKey) entry.lastUsedAt = new Date().toISOString();
  }
  await saveGlobalConfig(config, options);
  return item;
}

async function rotateAuthToken(options = {}) {
  const config = await loadGlobalConfig(options);
  const token = `cgn_${crypto.randomBytes(24).toString("base64url")}`;
  const tokenId = crypto.createHash("sha256").update(token).digest("hex").slice(0, 12);
  config.auth = {
    tokenId,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    rotatedAt: new Date().toISOString()
  };
  await saveGlobalConfig(config, options);
  return {
    token,
    tokenId,
    rotatedAt: config.auth.rotatedAt,
    configPath: config.__configPath
  };
}

async function listSessions(options = {}) {
  const config = await loadGlobalConfig(options);
  return {
    configPath: config.__configPath,
    revokedAt: config.sessions.revokedAt || null,
    sessions: config.sessions.items || []
  };
}

async function getBridgePreferences(options = {}) {
  const config = await loadGlobalConfig(options);
  return {
    configPath: config.__configPath,
    preferredTunnelMode: config.preferredTunnelMode,
    shellMode: config.shellMode,
    toolMode: config.toolMode
  };
}

async function setBridgePreference(key, value, options = {}) {
  const config = await loadGlobalConfig(options);
  const normalizedKey = normalizePreferenceKey(key);
  const normalizedValue = normalizePreferenceValue(normalizedKey, value);
  config[normalizedKey] = normalizedValue;
  await saveGlobalConfig(config, options);
  return {
    configPath: config.__configPath,
    key: normalizedKey,
    value: normalizedValue,
    preferences: {
      preferredTunnelMode: config.preferredTunnelMode,
      shellMode: config.shellMode,
      toolMode: config.toolMode
    }
  };
}

async function revokeSessions(options = {}) {
  const config = await loadGlobalConfig(options);
  config.sessions.revokedAt = new Date().toISOString();
  config.sessions.items = [];
  await saveGlobalConfig(config, options);
  return {
    configPath: config.__configPath,
    revokedAt: config.sessions.revokedAt,
    revoked: true
  };
}

async function normalizeRoot(root, cwd) {
  const resolved = path.resolve(cwd || process.cwd(), root);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) throw new Error(`Project root is not a directory: ${resolved}`);
  const canonicalRoot = await fs.realpath(resolved);
  return {
    root: resolved,
    canonicalRoot,
    canonicalKey: canonicalKeyFor(canonicalRoot),
    name: path.basename(resolved) || resolved
  };
}

function normalizeConfig(value, configPath) {
  const config = {
    version: CONFIG_VERSION,
    allowedRoots: [],
    lastSelectedProject: null,
    auth: null,
    preferredTunnelMode: "quick",
    shellMode: "trusted",
    toolMode: "standard",
    sessions: {
      revokedAt: null,
      items: []
    },
    ...value
  };

  config.allowedRoots = Array.isArray(config.allowedRoots)
    ? config.allowedRoots
        .filter((entry) => entry && entry.root && entry.canonicalRoot)
        .map((entry) => ({
          root: path.resolve(entry.root),
          canonicalRoot: path.resolve(entry.canonicalRoot),
          canonicalKey: entry.canonicalKey || canonicalKeyFor(entry.canonicalRoot),
          name: entry.name || path.basename(entry.root) || entry.root,
          addedAt: entry.addedAt || null,
          lastUsedAt: entry.lastUsedAt || null
        }))
    : [];
  config.sessions = config.sessions && typeof config.sessions === "object"
    ? { revokedAt: config.sessions.revokedAt || null, items: Array.isArray(config.sessions.items) ? config.sessions.items : [] }
    : { revokedAt: null, items: [] };
  if (!["quick", "manual"].includes(config.preferredTunnelMode)) config.preferredTunnelMode = "quick";
  if (!SHELL_MODES.has(config.shellMode)) config.shellMode = "trusted";
  if (!TOOL_MODES.has(config.toolMode)) config.toolMode = "standard";
  Object.defineProperty(config, "__configPath", {
    value: configPath,
    enumerable: false
  });
  return config;
}

function normalizePreferenceKey(key) {
  const normalized = String(key || "").trim().toLowerCase().replace(/_/g, "-");
  return {
    "preferred-tunnel-mode": "preferredTunnelMode",
    "tunnel-mode": "preferredTunnelMode",
    "shell-mode": "shellMode",
    "tool-mode": "toolMode",
    "tools-mode": "toolMode"
  }[normalized] || normalized;
}

function normalizePreferenceValue(key, value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (key === "preferredTunnelMode") {
    if (!["quick", "manual"].includes(normalized)) throw new Error("tunnel mode must be quick or manual.");
    return normalized;
  }
  if (key === "shellMode") {
    if (!SHELL_MODES.has(normalized)) throw new Error("shell mode must be trusted, safe, or off.");
    return normalized;
  }
  if (key === "toolMode") {
    if (!TOOL_MODES.has(normalized)) throw new Error("tool mode must be standard or simple.");
    return normalized;
  }
  throw new Error("Unknown config key. Use shell-mode, tool-mode, or tunnel-mode.");
}

function publicRoot(entry) {
  return {
    root: entry.root,
    canonicalRoot: entry.canonicalRoot,
    name: entry.name,
    addedAt: entry.addedAt || null,
    lastUsedAt: entry.lastUsedAt || null
  };
}

function canonicalKeyFor(root) {
  const resolved = path.resolve(root);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

module.exports = {
  addAllowedRoot,
  getGlobalConfigDir,
  getGlobalConfigPath,
  getBridgePreferences,
  isRootAllowed,
  listAllowedRoots,
  listSessions,
  loadGlobalConfig,
  removeAllowedRoot,
  revokeSessions,
  rotateAuthToken,
  saveGlobalConfig,
  setBridgePreference,
  setLastSelectedProject
};
