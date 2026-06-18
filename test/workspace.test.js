const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { addAllowedRoot } = require("../src/global-config");
const { createWorkspaceEngine } = require("../src/workspace/engine");

test("openWorkspace binds one workspaceId to a canonical root", async () => {
  const root = await makeTempRoot("cgn workspace 中文 ");
  const otherRoot = await makeTempRoot("cgn-workspace-other-");
  const engine = createWorkspaceEngine({ cwd: root });

  assert.deepEqual(engine.status(), {
    open: false,
    workspaceId: null,
    root: null,
    canonicalRoot: null
  });

  const opened = await engine.openWorkspace({ root: path.join(root, ".") });
  const reopened = await engine.openWorkspace({ root });

  assert.match(opened.workspaceId, /^workspace_[a-f0-9]{16}$/);
  assert.equal(reopened.workspaceId, opened.workspaceId);
  assert.equal(opened.canonicalRoot, await fs.realpath(root));
  assert.deepEqual(engine.status(), {
    open: true,
    workspaceId: opened.workspaceId,
    root: path.resolve(root),
    canonicalRoot: opened.canonicalRoot
  });
  await assert.rejects(
    () => engine.openWorkspace({ root: otherRoot }),
    /workspace is already open/i
  );
});

test("openWorkspace allows the runtime project and blocks other roots until authorized", async () => {
  const configDir = await makeTempRoot("cgn-config-");
  const runtimeRoot = await makeTempRoot("cgn-workspace-runtime-");
  const otherRoot = await makeTempRoot("cgn-workspace-allowed-");
  const engine = createWorkspaceEngine({ cwd: runtimeRoot, configDir });

  const runtime = await engine.openWorkspace({ root: runtimeRoot });
  assert.equal(runtime.root, path.resolve(runtimeRoot));

  const fresh = createWorkspaceEngine({ cwd: runtimeRoot, configDir });
  await assert.rejects(
    () => fresh.openWorkspace({ root: otherRoot }),
    /Project is not allowed/
  );

  await addAllowedRoot(otherRoot, { configDir });
  const allowed = await createWorkspaceEngine({ cwd: runtimeRoot, configDir }).openWorkspace({ root: otherRoot });
  assert.equal(allowed.root, path.resolve(otherRoot));
});

test("workspace discovery lists directories, searches text, and reads project instructions", async () => {
  const root = await makeTempRoot("cgn-workspace-discovery-");
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
  await fs.writeFile(path.join(root, "AGENTS.md"), "# Agent guide\nUse tests.\n", "utf8");
  await fs.writeFile(path.join(root, "README.md"), "# Demo\n", "utf8");
  await fs.writeFile(path.join(root, "src", "app.js"), "export const target = 'needle';\n", "utf8");
  await fs.writeFile(path.join(root, ".env"), "needle=secret\n", "utf8");
  await fs.writeFile(path.join(root, "node_modules", "pkg", "index.js"), "needle\n", "utf8");

  const engine = createWorkspaceEngine({ cwd: root });
  const { workspaceId } = await engine.openWorkspace({ root });

  const directory = await engine.listDirectory({ workspaceId, path: "." });
  assert.ok(directory.entries.some((entry) => entry.path === "src" && entry.type === "directory"));
  assert.ok(!directory.entries.some((entry) => entry.path === ".env"));
  assert.ok(!directory.entries.some((entry) => entry.path === "node_modules"));

  const search = await engine.search({ workspaceId, query: "needle" });
  assert.deepEqual(search.results.map((item) => item.path), ["src/app.js"]);

  const instructions = await engine.projectInstructions({ workspaceId });
  assert.deepEqual(instructions.files.map((file) => file.path), ["AGENTS.md", "README.md"]);
});

test("read and write handle Chinese and space paths with hashes and truncation metadata", async () => {
  const root = await makeTempRoot("cgn workspace 中文 ");
  const engine = createWorkspaceEngine({ cwd: root });
  const { workspaceId } = await engine.openWorkspace({ root });
  const relativePath = "资料 目录/你好 world.txt";
  const text = "第一行\nsecond line\n第三行";

  const written = await engine.write({ workspaceId, relativePath, text });
  assert.equal(written.relativePath, relativePath);
  assert.match(written.hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(written.bytes, Buffer.byteLength(text, "utf8"));

  const read = await engine.read({ workspaceId, relativePath });
  assert.equal(read.text, text);
  assert.equal(read.hash, written.hash);
  assert.deepEqual(read.truncation, {
    truncated: false,
    bytes: Buffer.byteLength(text, "utf8"),
    totalBytes: Buffer.byteLength(text, "utf8"),
    maxBytes: 65536
  });

  const truncated = await engine.read({ workspaceId, relativePath, maxBytes: 10 });
  assert.equal(truncated.hash, written.hash);
  assert.equal(truncated.truncation.truncated, true);
  assert.equal(truncated.truncation.maxBytes, 10);
  assert.ok(truncated.truncation.bytes <= 10);
  assert.ok(truncated.text.length < text.length);
});

test("write enforces expectedHash and ifExists", async () => {
  const root = await makeTempRoot("cgn-workspace-");
  const engine = createWorkspaceEngine({ cwd: root });
  const { workspaceId } = await engine.openWorkspace({ root });
  const relativePath = "notes/file.txt";

  const first = await engine.write({ workspaceId, relativePath, text: "first" });
  await assert.rejects(
    () => engine.write({ workspaceId, relativePath, text: "second", ifExists: "error" }),
    /already exists/i
  );
  await assert.rejects(
    () => engine.write({ workspaceId, relativePath, text: "second", expectedHash: "sha256:" + "0".repeat(64) }),
    /hash mismatch/i
  );

  const second = await engine.write({ workspaceId, relativePath, text: "second", expectedHash: first.hash });
  assert.notEqual(second.hash, first.hash);
  assert.equal((await engine.read({ workspaceId, relativePath })).text, "second");
});

test("workspace paths reject traversal, private directories, dependency folders, and sensitive path classes", async () => {
  const root = await makeTempRoot("cgn-workspace-");
  const engine = createWorkspaceEngine({ cwd: root });
  const { workspaceId } = await engine.openWorkspace({ root });
  const blockedPaths = [
    path.resolve("outside.txt"),
    "../outside.txt",
    "safe/../outside.txt",
    ".git/config",
    ".chatgpt-native/config.json",
    "node_modules/pkg/index.js",
    ".env.local",
    "keys/api.txt",
    "cookie/auth.txt",
    "sessions/current.json",
    "id_rsa"
  ];

  for (const relativePath of blockedPaths) {
    await assert.rejects(
      () => engine.write({ workspaceId, relativePath, text: "content" }),
      /absolute paths|path traversal|blocked/i,
      relativePath
    );
  }

  await assert.rejects(
    () => engine.write({ workspaceId, relativePath: "safe.txt", text: "OPENAI_API_KEY=sk-1234567890abcdef" }),
    /blocked/i
  );
});

test("read rejects symlink paths that escape the workspace root", async (t) => {
  const root = await makeTempRoot("cgn-workspace-");
  const outside = await makeTempRoot("cgn-outside-");
  const engine = createWorkspaceEngine({ cwd: root });
  const { workspaceId } = await engine.openWorkspace({ root });

  await fs.writeFile(path.join(outside, "secret.txt"), "outside", "utf8");
  try {
    await fs.symlink(outside, path.join(root, "linked-outside"), process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      t.skip(`symlink creation is not permitted on this machine: ${error.code}`);
      return;
    }
    throw error;
  }

  await assert.rejects(
    () => engine.read({ workspaceId, relativePath: "linked-outside/secret.txt" }),
    /escapes the workspace root/i
  );
});

test("edit requires expectedHash and replaces only a unique oldText unless replaceAll is true", async () => {
  const root = await makeTempRoot("cgn-workspace-");
  const engine = createWorkspaceEngine({ cwd: root });
  const { workspaceId } = await engine.openWorkspace({ root });

  await engine.write({ workspaceId, relativePath: "edit.txt", text: "alpha beta gamma" });
  await assert.rejects(
    () => engine.edit({ workspaceId, relativePath: "edit.txt", oldText: "beta", newText: "BETA" }),
    /expectedHash is required/i
  );

  const before = await engine.read({ workspaceId, relativePath: "edit.txt" });
  const edited = await engine.edit({
    workspaceId,
    relativePath: "edit.txt",
    expectedHash: before.hash,
    oldText: "beta",
    newText: "BETA"
  });
  assert.notEqual(edited.hash, before.hash);
  assert.equal((await engine.read({ workspaceId, relativePath: "edit.txt" })).text, "alpha BETA gamma");

  const after = await engine.read({ workspaceId, relativePath: "edit.txt" });
  await assert.rejects(
    () => engine.edit({
      workspaceId,
      relativePath: "edit.txt",
      expectedHash: after.hash,
      oldText: "missing",
      newText: "value"
    }),
    /oldText was not found/i
  );

  const multi = await engine.write({ workspaceId, relativePath: "multi.txt", text: "same same same" });
  await assert.rejects(
    () => engine.edit({
      workspaceId,
      relativePath: "multi.txt",
      expectedHash: multi.hash,
      oldText: "same",
      newText: "done"
    }),
    /oldText is not unique/i
  );

  const replaceAll = await engine.edit({
    workspaceId,
    relativePath: "multi.txt",
    expectedHash: multi.hash,
    oldText: "same",
    newText: "done",
    replaceAll: true
  });
  assert.equal((await engine.read({ workspaceId, relativePath: "multi.txt" })).text, "done done done");
  assert.match(replaceAll.hash, /^sha256:[a-f0-9]{64}$/);
});

async function makeTempRoot(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}
