const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { formatAppDryRun, startAppServer } = require("../src/app-server");
const { PRO_REPLY_END, PRO_REPLY_START } = require("../src/pro-relay");
const pkg = require("../package.json");

test("formatAppDryRun explains GUI URL and safety boundary", () => {
  const text = formatAppDryRun({ host: "127.0.0.1", port: 47833 });

  assert.match(text, /http:\/\/127\.0\.0\.1:47833/);
  assert.match(text, /GPT-5\.5 Pro packaged-context helper pack/);
  assert.match(text, /No API key/);
  assert.match(text, /No ChatGPT scraping/);
  assert.match(text, /Clipboard watch is opt-in/);
});

test("GUI server health, status, pro-pack, and manual import work", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-app-server-"));
  let copied = "";
  const server = await startAppServer({
    cwd,
    port: 0,
    openBrowser: false,
    stdout: sink(),
    copyToClipboardImpl: (text) => {
      copied = text;
    }
  });

  try {
    const health = await getJson(`${server.url}/health`);
    assert.equal(health.ok, true);
    assert.equal(health.packageVersion, pkg.version);

    const status = await getJson(`${server.url}/api/status`);
    assert.equal(status.cwd, cwd);
    assert.equal(status.packageVersion, pkg.version);
    assert.equal(Array.isArray(status.doctor.checks), true);
    assert.equal(status.relay.latest, null);

    const pack = await postJson(`${server.url}/api/pro-pack`, { task: "Plan v0.5", includeDiff: false });
    assert.match(pack.id, /plan-v0-5/);
    assert.match(pack.prompt, /Plan v0\.5/);
    assert.match(copied, /CGN_BRIDGE_REPLY v1 id=/);

    const replyText = `${PRO_REPLY_START} v1 id=${pack.id}\n## Plan\nImplement relay GUI.\n${PRO_REPLY_END}`;
    const imported = await postJson(`${server.url}/api/clipboard/import`, {
      id: pack.id,
      text: replyText
    });
    assert.equal(imported.imported, true);
    assert.equal(await exists(imported.replyPath), true);
    assert.equal(await exists(imported.codexReadThisPath), true);
  } finally {
    await server.close();
  }
});

test("GUI clipboard watch imports only matching Pro replies", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cgn-app-watch-"));
  let clipboard = "nothing yet";
  const server = await startAppServer({
    cwd,
    port: 0,
    openBrowser: false,
    stdout: sink(),
    readFromClipboardImpl: () => clipboard,
    copyToClipboardImpl: () => {}
  });

  try {
    const pack = await postJson(`${server.url}/api/pro-pack`, { task: "Watch import", includeDiff: false });
    const watch = await postJson(`${server.url}/api/clipboard-watch/start`, {
      id: pack.id,
      timeoutMs: 8000
    });
    assert.equal(watch.state, "watching");

    clipboard = `${PRO_REPLY_START} v1 id=wrong\nnope\n${PRO_REPLY_END}`;
    await sleep(2300);
    let status = await getJson(`${server.url}/api/status`);
    assert.equal(status.relay.latest.state, "prompt-ready");

    clipboard = `${PRO_REPLY_START} v1 id=${pack.id}\n## Done\nReady for Codex.\n${PRO_REPLY_END}`;
    await sleep(2300);
    status = await getJson(`${server.url}/api/status`);
    assert.equal(status.relay.latest.state, "imported");
    assert.equal(await exists(status.relay.latest.replyPath), true);
  } finally {
    await server.close();
  }
});

async function getJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  assert.equal(response.ok, true, text);
  return JSON.parse(text);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  assert.equal(response.ok, true, text);
  return JSON.parse(text);
}

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function sink() {
  return { write() {} };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
