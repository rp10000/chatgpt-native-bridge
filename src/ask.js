const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureDir, pathExists, toPosix } = require("./fs-utils");
const { getGitDiff, getGitStatus } = require("./git");
const { writeOutboxHandoffFiles } = require("./handoff-files");
const { makeRunId } = require("./id");
const { inspectCandidate } = require("./secret-guard");
const { copySelectedFiles } = require("./select-files");
const { readPromptTemplate } = require("./templates");

const VALID_TYPES = [
  "plan",
  "requirements",
  "architecture",
  "naming-copy",
  "ux-review",
  "research",
  "image-direction",
  "diff-review"
];

async function createAsk(options) {
  const cwd = options.cwd || process.cwd();
  const task = String(options.task || "").trim();
  if (!task) {
    throw new Error("cgn ask requires --task");
  }

  const types = normalizeTypes(options.types);
  const now = options.now || new Date();
  const createdAt = now.toISOString();
  const id = options.id || makeRunId(task, now);
  const bridgeDir = path.join(cwd, ".chatgpt-native");
  const outboxDir = path.join(bridgeDir, "outbox", id);
  const warnings = [];

  await ensureDir(outboxDir);

  const copiedFiles = await copySelectedFiles({
    cwd,
    destinationDir: path.join(outboxDir, "files"),
    patterns: normalizeList(options.includeFiles),
    warnings
  });

  const copiedScreenshots = await copySelectedFiles({
    cwd,
    destinationDir: path.join(outboxDir, "screenshots"),
    patterns: normalizeList(options.includeScreenshots),
    warnings,
    binary: true
  });

  let diffPath = null;
  let diffStatus = "Not requested.";
  if (options.includeDiff) {
    const diff = await getGitDiff(cwd);
    if (!diff.available) {
      diffStatus = diff.reason;
      warnings.push(`Diff not included: ${diff.reason}`);
    } else if (!diff.text.trim()) {
      diffStatus = "No git diff was found.";
    } else {
      const inspection = inspectCandidate({ relativePath: "diff.patch", content: diff.text });
      if (inspection.blocked) {
        diffStatus = `Diff blocked: ${inspection.reason}`;
        warnings.push(diffStatus);
      } else {
        diffPath = path.join(outboxDir, "diff.patch");
        await fs.writeFile(diffPath, diff.text);
        diffStatus = "diff.patch";
      }
    }
  }

  let testOutputPath = null;
  let testStatus = "Not requested.";
  if (options.includeTests) {
    const candidate = await findTestOutput(cwd);
    if (!candidate) {
      testStatus = "No .chatgpt-native/runs/test-output.txt file found.";
      warnings.push("Test output requested but no .chatgpt-native/runs/test-output.txt file exists.");
    } else {
      const content = await fs.readFile(candidate, "utf8");
      const inspection = inspectCandidate({ relativePath: toPosix(path.relative(cwd, candidate)), content });
      if (inspection.blocked) {
        testStatus = `Test output blocked: ${inspection.reason}`;
        warnings.push(testStatus);
      } else {
        testOutputPath = path.join(outboxDir, "test-output.md");
        await fs.writeFile(testOutputPath, content);
        testStatus = "test-output.md";
      }
    }
  }

  const gitStatus = await getGitStatus(cwd);
  const context = buildContext({
    cwd,
    id,
    task,
    types,
    copiedFiles,
    copiedScreenshots,
    diffStatus,
    testStatus,
    gitStatus,
    warnings
  });
  await fs.writeFile(path.join(outboxDir, "context.md"), context);

  const promptModules = [];
  for (const type of types) {
    promptModules.push({ type, content: await readPromptTemplate(type) });
  }

  const ask = buildAsk({
    id,
    task,
    types,
    promptModules,
    copiedFiles,
    copiedScreenshots,
    diffPath,
    testOutputPath,
    warnings
  });
  await fs.writeFile(path.join(outboxDir, "ask.md"), ask);
  await writeOutboxHandoffFiles({
    cwd,
    id,
    outboxDir,
    task,
    types,
    createdAt,
    ask,
    copiedFiles,
    copiedScreenshots,
    diffPath,
    testOutputPath,
    warnings
  });

  await ensureDir(path.join(bridgeDir, "runs"));
  await fs.writeFile(
    path.join(bridgeDir, "runs", `${id}.json`),
    JSON.stringify(
      {
        id,
        task,
        types,
        createdAt,
        outbox: toPosix(path.relative(cwd, outboxDir)),
        warnings
      },
      null,
      2
    )
  );

  return { id, outboxDir, warnings, copiedFiles, copiedScreenshots };
}

function normalizeTypes(types) {
  const normalized = normalizeList(types);
  const result = normalized.length ? normalized : ["plan"];
  for (const type of result) {
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Unknown request type "${type}". Valid types: ${VALID_TYPES.join(", ")}`);
    }
  }
  return result;
}

function normalizeList(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildContext(input) {
  const fileLines = input.copiedFiles.length
    ? input.copiedFiles.map((file) => `- ${file.relativePath}`).join("\n")
    : "- None.";
  const screenshotLines = input.copiedScreenshots.length
    ? input.copiedScreenshots.map((file) => `- ${file.relativePath}`).join("\n")
    : "- None.";
  const warningLines = input.warnings.length
    ? input.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None.";

  return `# Handoff Context

Run: ${input.id}
Working directory: ${input.cwd}

## Task

${input.task}

## Request types

${input.types.map((type) => `- ${type}`).join("\n")}

## Git status

\`\`\`text
${input.gitStatus}
\`\`\`

## Included files

${fileLines}

## Included screenshots

${screenshotLines}

## Diff

${input.diffStatus}

## Test output

${input.testStatus}

## Safety notes

${warningLines}
`;
}

function buildAsk(input) {
  const attached = [
    "- context.md",
    input.diffPath ? "- diff.patch" : null,
    input.testOutputPath ? "- test-output.md" : null,
    input.copiedFiles.length ? "- files/" : null,
    input.copiedScreenshots.length ? "- screenshots/" : null
  ].filter(Boolean);
  const warnings = input.warnings.length
    ? input.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None.";

  const modules = input.promptModules
    .map((module) => `## ${module.type}\n\n${renderPromptContent(module.content, input)}`)
    .join("\n\n");

  return `# ChatGPT Native Bridge Handoff

You are advising Codex, which is the local executor. Use native ChatGPT features freely when useful: Web Search, Deep Research, Canvas, file upload, image analysis, image generation, data analysis, and long-form reasoning.

Do not use hidden endpoints, browser scraping, private tokens, localStorage, cookies, or network-request extraction.

## Task

${input.task}

## Request types

${input.types.map((type) => `- ${type}`).join("\n")}

## Local attachments

${attached.join("\n")}

## Safety warnings

${warnings}

## How to respond

Use clear Markdown. Prefer direct advice over rigid schemas. When reviewing, separate must-fix from nice-to-have. When researching, cite sources if web search is used. When doing visual work, include prompts and placement guidance.

The user will copy your final response back to Codex with \`cgn done\`.

Please end with this section when possible:

## Codex next actions

${modules}
`;
}

function renderPromptContent(content, input) {
  return content.trim().replaceAll("{{task}}", input.task);
}

async function findTestOutput(cwd) {
  const candidates = [
    path.join(cwd, ".chatgpt-native", "runs", "test-output.txt"),
    path.join(cwd, ".chatgpt-native", "runs", "latest-test-output.txt"),
    path.join(cwd, ".chatgpt-native", "runs", "test-output.md"),
    path.join(cwd, ".chatgpt-native", "runs", "latest-test-output.md")
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

module.exports = {
  VALID_TYPES,
  createAsk,
  normalizeTypes
};
