const fs = require("node:fs/promises");
const path = require("node:path");

const TEMPLATE_ROOT = path.join(__dirname, "..", "templates");

const DEFAULT_CONFIG = {
  mode: "auto_native",
  openChatGPT: true,
  copyPromptToClipboard: true,
  includeDiff: true,
  includeTests: true,
  includeScreenshots: "when-found",
  simpleSecretGuard: true,
  preferredChatGPTModes: {
    reasoning: "best available reasoning model",
    nativeTools: "best available ChatGPT mode with native tools"
  }
};

async function readTemplate(relativePath) {
  return fs.readFile(path.join(TEMPLATE_ROOT, relativePath), "utf8");
}

async function readPromptTemplate(type) {
  return readTemplate(path.join("prompts", `${type}.md`));
}

module.exports = {
  DEFAULT_CONFIG,
  readPromptTemplate,
  readTemplate
};
