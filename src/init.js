const path = require("node:path");

const { ensureDir, toPosix, writeFileIfMissing } = require("./fs-utils");
const { DEFAULT_CONFIG, readTemplate } = require("./templates");

async function initProject(options = {}) {
  const cwd = options.cwd || process.cwd();
  const force = Boolean(options.force);
  const created = [];
  const skipped = [];

  const skillPath = path.join(cwd, ".agents", "skills", "chatgpt-native-bridge", "SKILL.md");
  const skillMetadataPath = path.join(cwd, ".agents", "skills", "chatgpt-native-bridge", "agents", "openai.yaml");
  const configPath = path.join(cwd, ".chatgpt-native", "config.json");
  const projectInstructionsPath = path.join(cwd, ".chatgpt-native", "project-instructions.md");
  const directories = [
    path.join(cwd, ".chatgpt-native", "outbox"),
    path.join(cwd, ".chatgpt-native", "inbox"),
    path.join(cwd, ".chatgpt-native", "assets"),
    path.join(cwd, ".chatgpt-native", "runs"),
    path.join(cwd, ".chatgpt-native", "prompts")
  ];

  await recordWrite(
    skillPath,
    await readTemplate("skill/SKILL.md"),
    ".agents/skills/chatgpt-native-bridge/SKILL.md"
  );
  await recordWrite(
    skillMetadataPath,
    await readTemplate("skill/agents/openai.yaml"),
    ".agents/skills/chatgpt-native-bridge/agents/openai.yaml"
  );
  await recordWrite(
    configPath,
    `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`,
    ".chatgpt-native/config.json"
  );
  await recordWrite(
    projectInstructionsPath,
    await readTemplate("chatgpt/project-instructions.md"),
    ".chatgpt-native/project-instructions.md"
  );

  for (const dirPath of directories) {
    await ensureDir(dirPath);
    created.push(toPosix(path.relative(cwd, dirPath)));
  }

  return { created, skipped };

  async function recordWrite(filePath, content, label) {
    const wrote = await writeFileIfMissing(filePath, content, force);
    if (wrote) created.push(label);
    else skipped.push(label);
  }
}

module.exports = {
  initProject
};
