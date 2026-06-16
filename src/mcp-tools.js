const fs = require("node:fs/promises");
const path = require("node:path");

const z = require("zod/v4");

const { createAsk, VALID_TYPES } = require("./ask");
const { ensureDir, toPosix } = require("./fs-utils");
const { getGitDiff, getGitStatus } = require("./git");
const { getHandoffSummary } = require("./handoff-summary");
const { importReply } = require("./import-reply");
const { resolveRunId } = require("./id");
const { inspectCandidate, sensitivePathReason } = require("./secret-guard");
const { getStatus } = require("./status");

const DEFAULT_MAX_BYTES = 200 * 1024;
const MAX_LISTED_FILES = 200;
const TOOL_NAMES = [
  "review_current_project",
  "bridge_status",
  "create_handoff",
  "list_handoff_files",
  "read_handoff_file",
  "read_repo_file",
  "read_git_diff",
  "submit_reply_to_codex",
  "write_to_codex"
];

function createMcpToolRegistry(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  return [
    {
      name: "review_current_project",
      config: {
        title: "Review current project",
        description: "Call this automatically when the user asks chatgpt-native-bridge to review, inspect, plan, or continue work on the current local project. It returns project status, git status, current diff when safe, and the expected next write-back step for Codex.",
        securitySchemes: noAuthSecuritySchemes(),
        inputSchema: {
          task: z.string().optional().describe("What the user wants reviewed or planned."),
          includeDiff: z.boolean().optional().describe("Include the current git diff when safe. Defaults to true."),
          maxBytes: z.number().int().positive().optional().describe("Maximum diff bytes to return.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Reviewing the local project", "Local project review ready")
      },
      handler: withAudit(cwd, "review_current_project", async (args) => {
        const status = await getStatus({ cwd });
        let latestHandoff = null;
        try {
          latestHandoff = await resolveRunId(cwd, "latest");
        } catch {
          latestHandoff = null;
        }

        const includeDiff = args.includeDiff !== false;
        const diff = includeDiff
          ? await readGitDiffForMcp(cwd, args.maxBytes)
          : {
              available: false,
              reason: "includeDiff was false",
              text: "",
              bytes: 0,
              truncated: false
            };

        return {
          cwd,
          packageVersion: require("../package.json").version,
          task: args.task || "",
          gitStatus: await getGitStatus(cwd),
          latestHandoff,
          pending: status.pending.map((item) => item.id),
          ready: status.ready.map((item) => item.id),
          diff,
          safety: safetySummary(),
          nextAction:
            "Use this context to answer the user. Read only relevant repo files if needed, then call submit_reply_to_codex with final Markdown advice before your final answer so Codex can continue locally."
        };
      })
    },
    {
      name: "bridge_status",
      config: {
        title: "Bridge status",
        description: "Return the local project root, git state, latest handoff, and reply status. For normal project review, prefer review_current_project because it combines status and safe diff context.",
        securitySchemes: noAuthSecuritySchemes(),
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Checking bridge status", "Bridge status ready")
      },
      handler: withAudit(cwd, "bridge_status", async () => {
        const status = await getStatus({ cwd });
        let latestHandoff = null;
        try {
          latestHandoff = await resolveRunId(cwd, "latest");
        } catch {
          latestHandoff = null;
        }

        return {
          cwd,
          packageVersion: require("../package.json").version,
          gitStatus: await getGitStatus(cwd),
          latestHandoff,
          pending: status.pending.map((item) => item.id),
          ready: status.ready.map((item) => item.id),
          safety: safetySummary(),
          nextAction:
            "For normal project advice, call review_current_project or read_git_diff next, then read relevant files only as needed, then call submit_reply_to_codex with final Markdown advice before answering the user."
        };
      })
    },
    {
      name: "create_handoff",
      config: {
        title: "Create handoff",
        description: "Create a self-explaining handoff pack when a task needs a packaged context bundle. For simple MCP-connected review, prefer bridge_status/read_git_diff/read_repo_file first.",
        securitySchemes: noAuthSecuritySchemes(),
        inputSchema: {
          task: z.string().min(1).describe("Task or question for ChatGPT."),
          types: z
            .union([z.string(), z.array(z.enum(VALID_TYPES))])
            .optional()
            .describe("Request types, as a comma-separated string or array."),
          includeDiff: z.boolean().optional().describe("Include current git diff."),
          includeTests: z.boolean().optional().describe("Include latest saved test output."),
          includeFiles: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe("Glob(s) of files to copy into the handoff."),
          includeScreenshots: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe("Glob(s) of screenshots to copy into the handoff.")
        },
        annotations: {
          title: "Create handoff",
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false
        },
        _meta: toolMeta("Creating handoff", "Handoff ready")
      },
      handler: withAudit(cwd, "create_handoff", async (args) => {
        const result = await createAsk({
          cwd,
          task: args.task,
          types: args.types,
          includeDiff: Boolean(args.includeDiff),
          includeTests: Boolean(args.includeTests),
          includeFiles: args.includeFiles,
          includeScreenshots: args.includeScreenshots
        });
        const summary = await getHandoffSummary(result.outboxDir);

        return {
          id: result.id,
          outboxDir: result.outboxDir,
          pastePromptPath: summary.pastePromptPath,
          uploadListPath: summary.uploadListPath,
          startHerePath: summary.startHerePath,
          warnings: result.warnings,
          nextAction:
            "Use list_handoff_files/read_handoff_file to inspect the handoff, then submit final advice with submit_reply_to_codex."
        };
      })
    },
    {
      name: "list_handoff_files",
      config: {
        title: "List handoff files",
        description: "List files generated for a handoff run.",
        securitySchemes: noAuthSecuritySchemes(),
        inputSchema: {
          id: z.string().optional().describe('Run id, or omit/use "latest".')
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Listing handoff files", "Handoff files ready")
      },
      handler: withAudit(cwd, "list_handoff_files", async (args) => {
        let id;
        try {
          id = await resolveRunId(cwd, args.id || "latest");
        } catch (error) {
          if ((args.id || "latest") !== "latest") throw error;
          return {
            available: false,
            reason: error.message,
            files: [],
            uploadItems: [],
            nextAction:
              "No handoff exists yet. For MCP-connected project review, call review_current_project instead. For final advice, call submit_reply_to_codex or write_to_codex."
          };
        }
        const outboxDir = path.join(cwd, ".chatgpt-native", "outbox", id);
        const files = await listFiles(outboxDir, outboxDir);
        const summary = await getHandoffSummary(outboxDir);

        return {
          id,
          outboxDir,
          files,
          uploadItems: summary.uploadItems
        };
      })
    },
    {
      name: "read_handoff_file",
      config: {
        title: "Read handoff file",
        description: "Read a bounded text file from a handoff outbox. Use after list_handoff_files when reviewing a created handoff.",
        securitySchemes: noAuthSecuritySchemes(),
        inputSchema: {
          id: z.string().optional().describe('Run id, or omit/use "latest".'),
          file: z.string().min(1).describe("Relative file path inside the handoff outbox."),
          maxBytes: z.number().int().positive().optional().describe("Maximum bytes to read.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Reading handoff file", "Handoff file ready")
      },
      handler: withAudit(cwd, "read_handoff_file", async (args) => {
        const id = await resolveRunId(cwd, args.id || "latest");
        const outboxDir = path.join(cwd, ".chatgpt-native", "outbox", id);
        const read = await readSafeTextFile({
          rootDir: outboxDir,
          relativePath: args.file,
          maxBytes: args.maxBytes,
          blockNodeModules: false
        });

        return {
          id,
          file: toPosix(read.relativePath),
          bytes: read.bytes,
          text: read.text
        };
      })
    },
    {
      name: "read_repo_file",
      config: {
        title: "Read repo file",
        description: "Read a bounded non-sensitive text file from the local repository. Use only for relevant files needed to answer the user or prepare advice for Codex.",
        securitySchemes: noAuthSecuritySchemes(),
        inputSchema: {
          path: z.string().min(1).describe("Relative path inside the current project."),
          maxBytes: z.number().int().positive().optional().describe("Maximum bytes to read.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Reading repo file", "Repo file ready")
      },
      handler: withAudit(cwd, "read_repo_file", async (args) => {
        const read = await readSafeTextFile({
          rootDir: cwd,
          relativePath: args.path,
          maxBytes: args.maxBytes,
          blockNodeModules: true
        });

        return {
          path: toPosix(read.relativePath),
          bytes: read.bytes,
          text: read.text
        };
      })
    },
    {
      name: "read_git_diff",
      config: {
        title: "Read git diff",
        description: "Read the current git diff with secret-content guarding. Call this after bridge_status for code review, planning, or 'what changed' tasks.",
        securitySchemes: noAuthSecuritySchemes(),
        inputSchema: {
          maxBytes: z.number().int().positive().optional().describe("Maximum bytes to return.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Reading git diff", "Git diff ready")
      },
      handler: withAudit(cwd, "read_git_diff", async (args) => {
        const diff = await readGitDiffForMcp(cwd, args.maxBytes);
        return {
          ...diff,
          nextAction:
            "If the diff is enough, call submit_reply_to_codex with final Markdown advice. If context is missing, call read_repo_file for only the relevant files, then submit_reply_to_codex."
        };
      })
    },
    {
      name: "submit_reply_to_codex",
      config: {
        title: "Submit reply to Codex",
        description: "Write ChatGPT's final Markdown advice into the local inbox for Codex. For normal project tasks, call this automatically before your final answer so Codex can continue locally.",
        securitySchemes: noAuthSecuritySchemes(),
        inputSchema: {
          id: z.string().optional().describe('Run id, or omit/use "latest".'),
          markdown: z.string().min(1).describe("Final ChatGPT response for Codex.")
        },
        annotations: {
          title: "Submit reply",
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false
        },
        _meta: toolMeta("Writing reply for Codex", "Reply saved for Codex")
      },
      handler: createSubmitReplyHandler(cwd, "submit_reply_to_codex")
    },
    {
      name: "write_to_codex",
      config: {
        title: "Write to Codex",
        description: "Alias for submit_reply_to_codex. Use this when ChatGPT wants to write final advice back to the local Codex inbox.",
        securitySchemes: noAuthSecuritySchemes(),
        inputSchema: {
          id: z.string().optional().describe('Run id, or omit/use "latest".'),
          markdown: z.string().min(1).describe("Final ChatGPT response for Codex.")
        },
        annotations: {
          title: "Write to Codex",
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false
        },
        _meta: toolMeta("Writing reply for Codex", "Reply saved for Codex")
      },
      handler: createSubmitReplyHandler(cwd, "write_to_codex")
    }
  ];
}

function createSubmitReplyHandler(cwd, toolName) {
  return withAudit(cwd, toolName, async (args) => {
    const result = await importReply({
      cwd,
      id: args.id || "latest",
      text: args.markdown,
      allowNewRun: true
    });

    return {
      id: result.id,
      replyPath: result.replyPath,
      codexReadThisPath: result.codexReadThisPath,
      nextAction:
        "Tell Codex to read CODEX_READ_THIS.md and reply.md, accept reasonable suggestions, continue local implementation, and run tests."
    };
  });
}

async function runMcpTool(name, args = {}, options = {}) {
  const tool = createMcpToolRegistry(options).find((item) => item.name === name);
  if (!tool) throw new Error(`Unknown MCP tool "${name}".`);
  return tool.handler(args);
}

async function readSafeTextFile(options) {
  const rootDir = path.resolve(options.rootDir);
  const relativePath = normalizeRelativePath(options.relativePath);
  const blockedPath = blockedRelativePathReason(relativePath, Boolean(options.blockNodeModules));
  if (blockedPath) throw new Error(blockedPath);

  const target = path.resolve(rootDir, relativePath);
  assertInside(rootDir, target);

  const rootReal = await fs.realpath(rootDir);
  const targetReal = await fs.realpath(target);
  assertInside(rootReal, targetReal);

  const stat = await fs.stat(targetReal);
  if (!stat.isFile()) throw new Error(`Not a file: ${relativePath}`);

  const maxBytes = clampMaxBytes(options.maxBytes);
  if (stat.size > maxBytes) {
    throw new Error(`File is too large to read safely: ${relativePath} (${stat.size} bytes).`);
  }

  const text = await fs.readFile(targetReal, "utf8");
  if (text.includes("\u0000")) throw new Error(`Binary file blocked: ${relativePath}`);

  const inspection = inspectCandidate({ relativePath, content: text });
  if (inspection.blocked) throw new Error(inspection.reason);

  return {
    relativePath,
    bytes: Buffer.byteLength(text, "utf8"),
    text
  };
}

async function listFiles(rootDir, currentDir, result = []) {
  if (result.length >= MAX_LISTED_FILES) return result;
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return result;
    throw error;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (result.length >= MAX_LISTED_FILES) break;
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);
    if (entry.isDirectory()) {
      await listFiles(rootDir, fullPath, result);
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(fullPath);
    result.push({
      path: toPosix(relativePath),
      bytes: stat.size
    });
  }

  return result;
}

async function readGitDiffForMcp(cwd, maxBytesValue) {
  const diff = await getGitDiff(cwd);
  if (!diff.available) {
    return {
      available: false,
      reason: diff.reason,
      bytes: 0,
      truncated: false,
      text: ""
    };
  }

  const inspection = inspectCandidate({ relativePath: "git-diff.patch", content: diff.text });
  if (inspection.blocked) throw new Error(inspection.reason);

  const maxBytes = clampMaxBytes(maxBytesValue);
  const buffer = Buffer.from(diff.text, "utf8");
  const truncated = buffer.length > maxBytes;
  const text = truncated ? buffer.subarray(0, maxBytes).toString("utf8") : diff.text;

  return {
    available: true,
    bytes: buffer.length,
    truncated,
    text
  };
}

function normalizeRelativePath(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("A relative path is required.");
  if (path.isAbsolute(input)) throw new Error(`Absolute paths are not allowed: ${input}`);
  const normalized = path.normalize(input);
  if (normalized === "." || normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error(`Path traversal is not allowed: ${input}`);
  }
  return normalized;
}

function blockedRelativePathReason(relativePath, blockNodeModules) {
  const posix = toPosix(relativePath);
  const segments = posix.toLowerCase().split("/");
  if (segments.includes(".git")) return `Blocked .git path: ${posix}`;
  if (blockNodeModules && segments.includes("node_modules")) return `Blocked node_modules path: ${posix}`;
  return sensitivePathReason(posix);
}

function assertInside(rootDir, targetPath) {
  const relative = path.relative(rootDir, targetPath);
  if (relative && (relative.startsWith("..") || path.isAbsolute(relative))) {
    throw new Error(`Path escapes the allowed root: ${targetPath}`);
  }
}

function clampMaxBytes(value) {
  if (!value) return DEFAULT_MAX_BYTES;
  return Math.min(Math.max(Number(value), 1), DEFAULT_MAX_BYTES);
}

function readOnlyAnnotations() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  };
}

function noAuthSecuritySchemes() {
  return [{ type: "noauth" }];
}

function toolMeta(invoking, invoked) {
  return {
    securitySchemes: noAuthSecuritySchemes(),
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked
  };
}

function safetySummary() {
  return {
    noApiKeyRequired: true,
    noHiddenEndpoints: true,
    noChatgptScraping: true,
    noArbitraryShell: true,
    writesLimitedTo: ".chatgpt-native/outbox and .chatgpt-native/inbox"
  };
}

function withAudit(cwd, toolName, handler) {
  return async (args = {}) => {
    try {
      const result = await handler(args);
      await appendAudit(cwd, { toolName, args: summarizeArgs(args), ok: true });
      return result;
    } catch (error) {
      await appendAudit(cwd, {
        toolName,
        args: summarizeArgs(args),
        ok: false,
        error: error.message
      });
      throw error;
    }
  };
}

async function appendAudit(cwd, event) {
  try {
    const auditPath = path.join(cwd, ".chatgpt-native", "runs", "mcp-audit.jsonl");
    await ensureDir(path.dirname(auditPath));
    await fs.appendFile(auditPath, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`);
  } catch {
    // Audit logging should never break a local handoff.
  }
}

function summarizeArgs(args) {
  const summary = {};
  for (const [key, value] of Object.entries(args || {})) {
    if (key === "markdown") {
      summary.markdownBytes = Buffer.byteLength(String(value || ""), "utf8");
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

module.exports = {
  TOOL_NAMES,
  createMcpToolRegistry,
  readSafeTextFile,
  runMcpTool
};
