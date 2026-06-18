const path = require("node:path");

const { pathExists } = require("./fs-utils");
const { getStatus } = require("./status");

async function getDoctorReport(options = {}) {
  const cwd = options.cwd || process.cwd();
  const checks = [];

  checks.push({
    label: "Node version",
    ok: isSupportedNode(process.versions.node),
    detail: process.versions.node,
    required: true
  });

  checks.push(await fileCheck("Codex skill", path.join(cwd, ".agents", "skills", "chatgpt-native-bridge", "SKILL.md")));
  checks.push(await fileCheck("Project instructions", path.join(cwd, ".chatgpt-native", "project-instructions.md")));
  checks.push(await fileCheck("Outbox directory", path.join(cwd, ".chatgpt-native", "outbox")));
  checks.push(await fileCheck("Inbox directory", path.join(cwd, ".chatgpt-native", "inbox")));

  const status = await getStatus({ cwd });
  const latest = [...status.pending, ...status.ready].sort((a, b) => a.id.localeCompare(b.id)).at(-1);
  checks.push({
    label: "Latest handoff",
    ok: Boolean(latest),
    detail: latest ? latest.id : "none",
    required: false,
    missingLabel: "none"
  });
  checks.push({
    label: "Latest reply",
    ok: Boolean(latest && latest.replyPath),
    detail: latest && latest.replyPath ? "ready" : "pending or none",
    required: false,
    missingLabel: "pending"
  });

  return { cwd, checks, status };
}

function formatDoctorReport(report) {
  const lines = [`chatgpt-native-bridge doctor`, `Project: ${report.cwd}`, ""];
  for (const check of report.checks) {
    lines.push(`${check.label}: ${check.ok ? "ok" : check.missingLabel || "missing"} (${check.detail})`);
  }

  const hasMissing = report.checks.some((check) => check.required !== false && !check.ok);
  lines.push("");
  lines.push(hasMissing ? "Result: attention needed" : "Result: ready");
  return `${lines.join("\n")}\n`;
}

function isSupportedNode(version) {
  const major = Number(String(version).split(".")[0]);
  return Number.isFinite(major) && major >= 20;
}

async function fileCheck(label, filePath) {
  return {
    label,
    ok: await pathExists(filePath),
    detail: filePath,
    required: true
  };
}

module.exports = {
  formatDoctorReport,
  getDoctorReport,
  isSupportedNode
};
