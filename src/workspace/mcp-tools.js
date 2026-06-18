const z = require("zod/v4");

const WORKSPACE_TOOL_NAMES = [
  "list_workspaces",
  "open_workspace",
  "workspace_status",
  "search_workspace",
  "list_directory",
  "read_project_instructions",
  "command_history",
  "read",
  "write",
  "edit",
  "bash",
  "show_changes"
];

function createWorkspaceMcpTools(engine) {
  return [
    {
      name: "list_workspaces",
      config: {
        title: "List workspaces",
        description: "List project roots known to the bridge. The active project is the only project ChatGPT can open in this connection.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Listing workspaces", "Workspaces ready")
      },
      handler: () => engine.listWorkspaces()
    },
    {
      name: "open_workspace",
      config: {
        title: "Open workspace",
        description: "Open the current connected project as a workspace. Call this once before read, write, edit, bash, show_changes, search_workspace, list_directory, command_history, or workspace_status. Do not guess or pass old project paths.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          path: z.string().optional().describe('Optional current project path. Defaults to ".". Other paths are rejected; switch projects in the desktop client first.')
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Opening workspace", "Workspace opened")
      },
      handler: (args) => engine.openWorkspace(args)
    },
    {
      name: "workspace_status",
      config: {
        title: "Workspace status",
        description: "Return open workspace state, project root, git state, locks, and latest command summary.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().optional().describe("Workspace identifier returned by open_workspace.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Checking workspace", "Workspace status ready")
      },
      handler: (args) => engine.status(args)
    },
    {
      name: "search_workspace",
      config: {
        title: "Search workspace",
        description: "Search text files inside an open workspace. Skips .git, .chatgpt-native, node_modules, .env, and credential-like paths.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().min(1).describe("Workspace identifier returned by open_workspace."),
          query: z.string().min(2).describe("Text to search for."),
          maxResults: z.number().int().positive().optional().describe("Maximum results to return.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Searching workspace", "Search results ready")
      },
      handler: (args) => engine.search(args)
    },
    {
      name: "list_directory",
      config: {
        title: "List directory",
        description: "List files and directories inside an open workspace. Skips private and dependency folders.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().min(1).describe("Workspace identifier returned by open_workspace."),
          path: z.string().optional().describe('Workspace-relative directory. Defaults to ".".'),
          maxEntries: z.number().int().positive().optional().describe("Maximum entries to return.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Listing directory", "Directory ready")
      },
      handler: (args) => engine.listDirectory(args)
    },
    {
      name: "read_project_instructions",
      config: {
        title: "Read project instructions",
        description: "Read AGENTS.md, CLAUDE.md, and README.md from the open workspace in that order when available.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().min(1).describe("Workspace identifier returned by open_workspace."),
          maxBytes: z.number().int().positive().optional().describe("Maximum bytes per file.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Reading project instructions", "Project instructions ready")
      },
      handler: (args) => engine.projectInstructions(args)
    },
    {
      name: "command_history",
      config: {
        title: "Command history",
        description: "Read recent shell commands run through the workspace bash tool, including exit status and truncated output previews.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().min(1).describe("Workspace identifier returned by open_workspace."),
          limit: z.number().int().positive().optional().describe("Maximum command history rows.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Reading command history", "Command history ready")
      },
      handler: (args) => engine.commandHistory(args)
    },
    {
      name: "read",
      config: {
        title: "Read file",
        description: "Read a bounded text file inside an open workspace. Call open_workspace first and pass workspaceId.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().min(1).describe("Workspace identifier returned by open_workspace."),
          path: z.string().min(1).describe("Workspace-relative file path."),
          startLine: z.number().int().positive().optional().describe("1-indexed start line."),
          maxLines: z.number().int().positive().optional().describe("Maximum lines to return."),
          maxBytes: z.number().int().positive().optional().describe("Maximum bytes to read.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Reading file", "File ready")
      },
      handler: (args) => engine.read(args)
    },
    {
      name: "write",
      config: {
        title: "Write file",
        description: "Create or overwrite a text file inside an open workspace. Prefer edit for targeted modifications. Call open_workspace first and pass workspaceId.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().min(1).describe("Workspace identifier returned by open_workspace."),
          path: z.string().min(1).describe("Workspace-relative file path."),
          content: z.string().describe("Complete file content."),
          ifExists: z.enum(["error", "overwrite"]).optional().describe('Defaults to "error". Use "overwrite" for existing files.'),
          expectedHash: z.string().optional().describe("Expected sha256 hash for overwrite conflict detection."),
          createParents: z.boolean().optional().describe("Create parent directories when writing a new file.")
        },
        annotations: writeAnnotations("Write file"),
        _meta: toolMeta("Writing file", "File written")
      },
      handler: (args) => engine.write({
        ...args,
        ifExists: args.ifExists || (args.expectedHash ? "overwrite" : "error")
      })
    },
    {
      name: "edit",
      config: {
        title: "Edit file",
        description: "Edit a text file inside an open workspace by replacing exact text blocks. Call read first and pass expectedHash.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().min(1).describe("Workspace identifier returned by open_workspace."),
          path: z.string().min(1).describe("Workspace-relative file path."),
          expectedHash: z.string().min(1).describe("sha256 hash returned by read."),
          edits: z.array(z.object({
            oldText: z.string().min(1).describe("Exact text to replace."),
            newText: z.string().describe("Replacement text."),
            replaceAll: z.boolean().optional().describe("Replace all matches instead of requiring one unique match.")
          })).min(1)
        },
        annotations: writeAnnotations("Edit file"),
        _meta: toolMeta("Editing file", "File edited")
      },
      handler: (args) => engine.edit(args)
    },
    {
      name: "bash",
      config: {
        title: "Run shell",
        description: "Run a shell command inside an open workspace for tests, builds, git inspection, and project scripts. On Windows the default shell is PowerShell. Use write/edit for file changes.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().min(1).describe("Workspace identifier returned by open_workspace."),
          command: z.string().min(1).describe("Command to run in the workspace."),
          workingDirectory: z.string().optional().describe("Workspace-relative working directory."),
          timeoutMs: z.number().int().positive().optional().describe("Timeout in milliseconds. Defaults to 30000, max 300000."),
          shell: z.enum(["powershell", "git-bash", "wsl", "bash"]).optional().describe("Optional shell override.")
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true
        },
        _meta: toolMeta("Running command", "Command finished")
      },
      handler: (args) => engine.bash(args)
    },
    {
      name: "show_changes",
      config: {
        title: "Show changes",
        description: "Show git status, current diff, and recent workspace operations after read/write/edit/bash activity.",
        securitySchemes: noAuthSecuritySchemes(),
        outputSchema: looseOutputSchema(),
        inputSchema: {
          workspaceId: z.string().min(1).describe("Workspace identifier returned by open_workspace."),
          maxBytes: z.number().int().positive().optional().describe("Maximum diff bytes."),
          includeDiff: z.boolean().optional().describe("Include current diff. Defaults to true."),
          includeOperations: z.boolean().optional().describe("Include recent workspace operations.")
        },
        annotations: readOnlyAnnotations(),
        _meta: toolMeta("Reading changes", "Changes ready")
      },
      handler: (args) => engine.showChanges(args)
    }
  ];
}

function readOnlyAnnotations() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  };
}

function writeAnnotations(title) {
  return {
    title,
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  };
}

function noAuthSecuritySchemes() {
  return [{ type: "noauth" }];
}

function looseOutputSchema() {
  return z.looseObject({});
}

function toolMeta(invoking, invoked) {
  return {
    securitySchemes: noAuthSecuritySchemes(),
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked
  };
}

module.exports = {
  WORKSPACE_TOOL_NAMES,
  createWorkspaceMcpTools
};
