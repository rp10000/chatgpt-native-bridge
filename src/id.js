const fs = require("node:fs/promises");
const path = require("node:path");

function makeRunId(task, date) {
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  const slug = slugify(task) || "handoff";
  return `${yyyy}-${mm}-${dd}-${hh}${mi}${ss}-${slug}`;
}

async function resolveRunId(cwd, requested) {
  if (requested && requested !== "latest") return requested;
  const outbox = path.join(cwd, ".chatgpt-native", "outbox");
  let entries;
  try {
    entries = await fs.readdir(outbox, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("No handoff runs found. Run cgn ask first.");
    }
    throw error;
  }
  const ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (!ids.length) throw new Error("No handoff runs found. Run cgn ask first.");
  return ids[ids.length - 1];
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

module.exports = {
  makeRunId,
  resolveRunId,
  slugify
};
