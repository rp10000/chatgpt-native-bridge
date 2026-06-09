const { spawnSync } = require("node:child_process");

function copyToClipboard(text) {
  if (process.platform === "win32") {
    run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Set-Clipboard -Value ([Console]::In.ReadToEnd())"
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
    return run("powershell.exe", ["-NoProfile", "-Command", "Get-Clipboard -Raw"]);
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

module.exports = {
  copyToClipboard,
  readFromClipboard
};
