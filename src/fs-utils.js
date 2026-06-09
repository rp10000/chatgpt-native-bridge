const fs = require("node:fs/promises");
const path = require("node:path");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function pathExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function writeFileIfMissing(filePath, content, force = false) {
  if (!force && (await pathExists(filePath))) {
    return false;
  }
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content);
  return true;
}

async function copyFileWithDirs(source, destination) {
  await ensureDir(path.dirname(destination));
  await fs.copyFile(source, destination);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

module.exports = {
  copyFileWithDirs,
  ensureDir,
  pathExists,
  toPosix,
  writeFileIfMissing
};
