const assert = require("node:assert/strict");
const test = require("node:test");

const {
  windowsClipboardUtf8Preamble,
  windowsGetClipboardCommand,
  windowsSetClipboardCommand
} = require("../src/clipboard");

test("Windows clipboard commands force UTF-8 console encoding", () => {
  const preamble = windowsClipboardUtf8Preamble();

  assert.match(preamble, /System\.Text\.UTF8Encoding/);
  assert.match(preamble, /\[Console\]::InputEncoding = \$utf8/);
  assert.match(preamble, /\[Console\]::OutputEncoding = \$utf8/);
});

test("Windows clipboard set command preserves empty input as text", () => {
  const command = windowsSetClipboardCommand();

  assert.match(command, /\$text = \[Console\]::In\.ReadToEnd\(\)/);
  assert.match(command, /\$text\.Length -eq 0/);
  assert.match(command, /System\.Windows\.Forms/);
  assert.match(command, /\[System\.Windows\.Forms\.Clipboard\]::Clear\(\)/);
  assert.match(command, /Set-Clipboard -Value \$text/);
});

test("Windows clipboard get command reads raw text after UTF-8 setup", () => {
  const command = windowsGetClipboardCommand();

  assert.match(command, /System\.Text\.UTF8Encoding/);
  assert.match(command, /Get-Clipboard -Raw/);
});
