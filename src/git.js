const { spawnSync } = require("node:child_process");

async function getGitStatus(cwd) {
  const result = runGit(cwd, ["status", "--short"]);
  if (!result.ok) return "Not a git repository.";
  return result.stdout.trim() || "Clean.";
}

async function getGitDiff(cwd) {
  const result = runGit(cwd, ["diff", "--no-ext-diff"]);
  if (!result.ok) {
    return { available: false, text: "", reason: "Not a git repository or git diff failed." };
  }
  return { available: true, text: result.stdout, reason: "" };
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    return { ok: false, stdout: result.stdout || "", stderr: result.stderr || "" };
  }
  return { ok: true, stdout: result.stdout || "", stderr: result.stderr || "" };
}

module.exports = {
  getGitDiff,
  getGitStatus
};
