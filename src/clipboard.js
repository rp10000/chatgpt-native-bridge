const { spawnSync } = require("node:child_process");

function copyToClipboard(text) {
  if (process.platform === "win32") {
    run("powershell.exe", [
      "-NoProfile",
      "-Command",
      windowsSetClipboardCommand()
    ], text);
    return;
  }

  if (process.platform === "darwin") {
    run("pbcopy", [], text);
    return;
  }

  const linuxTools = [
    ["wl-copy", []],
    ["xclip", ["-selection", "clipboard"]],
    ["xsel", ["--clipboard", "--input"]]
  ];
  for (const [command, args] of linuxTools) {
    const result = spawnSync(command, args, {
      input: text,
      encoding: "utf8",
      windowsHide: true
    });
    if (!result.error && result.status === 0) return;
  }

  throw new Error("No supported clipboard command found.");
}

function readFromClipboard() {
  if (process.platform === "win32") {
    return run("powershell.exe", [
      "-NoProfile",
      "-Command",
      windowsGetClipboardCommand()
    ]);
  }

  if (process.platform === "darwin") {
    return run("pbpaste", []);
  }

  const linuxTools = [
    ["wl-paste", []],
    ["xclip", ["-selection", "clipboard", "-out"]],
    ["xsel", ["--clipboard", "--output"]]
  ];
  for (const [command, args] of linuxTools) {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      windowsHide: true
    });
    if (!result.error && result.status === 0) return result.stdout;
  }

  throw new Error("No supported clipboard command found.");
}

function run(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} exited with status ${result.status}`);
  }
  return result.stdout || "";
}

function windowsClipboardUtf8Preamble() {
  return [
    "$utf8 = New-Object System.Text.UTF8Encoding $false;",
    "[Console]::InputEncoding = $utf8;",
    "[Console]::OutputEncoding = $utf8;"
  ].join(" ");
}

function windowsSetClipboardCommand() {
  return `${windowsClipboardUtf8Preamble()} $text = [Console]::In.ReadToEnd(); if ($null -eq $text -or $text.Length -eq 0) { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::Clear(); } else { Set-Clipboard -Value $text; }`;
}

function windowsGetClipboardCommand() {
  return `${windowsClipboardUtf8Preamble()} Get-Clipboard -Raw`;
}

module.exports = {
  copyToClipboard,
  readFromClipboard,
  windowsClipboardUtf8Preamble,
  windowsGetClipboardCommand,
  windowsSetClipboardCommand
};
