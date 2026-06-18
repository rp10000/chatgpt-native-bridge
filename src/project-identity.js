const crypto = require("node:crypto");
const path = require("node:path");

function getProjectIdentity(cwd = process.cwd()) {
  const projectRoot = path.resolve(cwd);
  const canonicalRoot = process.platform === "win32" ? projectRoot.toLowerCase() : projectRoot;
  return {
    projectRoot,
    projectName: path.basename(projectRoot),
    projectFingerprint: crypto.createHash("sha256").update(canonicalRoot).digest("hex").slice(0, 16)
  };
}

module.exports = {
  getProjectIdentity
};
