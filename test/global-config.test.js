const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  addAllowedRoot,
  getBridgePreferences,
  getGlobalConfigPath,
  isRootAllowed,
  listAllowedRoots,
  removeAllowedRoot,
  revokeSessions,
  rotateAuthToken,
  setBridgePreference
} = require("../src/global-config");

test("global config stores allowed project roots without plain-text auth tokens", async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-config-"));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-project-"));

  const added = await addAllowedRoot(project, { configDir });
  assert.equal(added.project.root, project);
  assert.equal(added.configPath, getGlobalConfigPath({ configDir }));

  const listed = await listAllowedRoots({ configDir });
  assert.equal(listed.roots.length, 1);
  assert.equal(listed.roots[0].root, project);

  const allowed = await isRootAllowed(project, { configDir });
  assert.equal(allowed.allowed, true);

  const auth = await rotateAuthToken({ configDir });
  assert.match(auth.token, /^cgn_/);
  assert.match(auth.tokenId, /^[a-f0-9]{12}$/);
  const raw = await fs.readFile(getGlobalConfigPath({ configDir }), "utf8");
  assert.equal(raw.includes(auth.token), false);
  assert.match(raw, /tokenHash/);
});

test("global config removes roots and revokes sessions", async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-config-"));
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-project-"));
  await addAllowedRoot(project, { configDir });

  const removed = await removeAllowedRoot(project, { configDir });
  assert.equal(removed.removed, true);
  assert.equal((await listAllowedRoots({ configDir })).roots.length, 0);

  const revoked = await revokeSessions({ configDir });
  assert.equal(revoked.revoked, true);
  assert.match(revoked.revokedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("global config stores bridge modes", async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-config-modes-"));

  const defaults = await getBridgePreferences({ configDir });
  assert.equal(defaults.shellMode, "trusted");
  assert.equal(defaults.toolMode, "standard");

  const shell = await setBridgePreference("shell-mode", "safe", { configDir });
  assert.equal(shell.value, "safe");

  const tools = await setBridgePreference("tool-mode", "simple", { configDir });
  assert.equal(tools.value, "simple");

  const updated = await getBridgePreferences({ configDir });
  assert.equal(updated.shellMode, "safe");
  assert.equal(updated.toolMode, "simple");

  await assert.rejects(() => setBridgePreference("shell-mode", "danger", { configDir }), /trusted, safe, or off/);
  await assert.rejects(() => setBridgePreference("tool-mode", "huge", { configDir }), /standard or simple/);
});
