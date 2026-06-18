# MCP security boundary

`chatgpt-native-bridge` exposes a local MCP server for ChatGPT. The same HTTP server can also expose a GPT Actions fallback under `/action/*` when MCP write tools are unavailable. v0.9 adds a DevSpace-style workspace line so a connected ChatGPT mode can read files, search the workspace, write files, edit files, run shell commands in the project, and write the final result back to Codex.

## What MCP can do

- Read bridge status.
- Create handoff files under `.chatgpt-native/outbox`.
- List and read bounded handoff text files.
- Read bounded non-sensitive repo text files.
- Read the current git diff after secret-content checks.
- Start a bounded local agent run under `.chatgpt-native/agent/runs`.
- Read local agent status, logs, and result files.
- Write ChatGPT's final Markdown reply under `.chatgpt-native/inbox`.
- Open the current project as a workspace.
- List allowed project roots.
- List directories.
- Search safe text files.
- Read project instructions from `AGENTS.md`, `CLAUDE.md`, and `README.md`.
- Read workspace text files.
- Create or overwrite workspace text files.
- Edit workspace text files with hash checks.
- Run shell commands with the workspace as the current directory.
- Read command history with truncated output previews.
- Show recent workspace operations, command history, and git changes.

The GPT Actions fallback exposes the same bounded read/write capability through REST endpoints:

- `/action/openapi.json`
- `/action/review-current-project`
- `/action/read-repo-file`
- `/action/read-git-diff`
- `/action/write-to-codex`

## What MCP cannot do

- Edit files outside the authorized project root.
- Commit or push.
- Read `.env` or `.env.*`.
- Read private key files such as `*.pem`, `*.key`, `*.p12`, or `*.pfx`.
- Read SSH private keys.
- Read cookie or session files.
- Read `.git`.
- Read `node_modules` through `read_repo_file`.
- Use hidden ChatGPT endpoints.
- Scrape ChatGPT output from the browser.

Shell commands are powerful. The server starts them in the workspace directory, but shell syntax itself can still reach outside that directory. Only connect projects and ChatGPT sessions you are willing to trust with local command execution.

You can choose the shell mode:

```bash
cgn config set shell-mode trusted
cgn config set shell-mode safe
cgn config set shell-mode off
```

- `trusted` is the default and keeps the current project shell useful.
- `safe` allows common test, build, lint, typecheck, and git inspection commands, and blocks shell chaining, pipes, redirects, and command substitution.
- `off` disables the workspace shell tool.

You can also choose the ChatGPT tool surface:

```bash
cgn config set tool-mode standard
cgn config set tool-mode simple
```

- `standard` is the default full bridge surface.
- `simple` keeps the workspace loop short: open workspace, search/list/read instructions, read/write/edit, bash, show changes, and create a handoff report.

Non-current projects must be added to the allowed roots list before `open_workspace` can open them:

```bash
cgn projects add <path>
```

## File-read guardrails

`read_repo_file` and `read_handoff_file` enforce:

- project-root containment
- symlink realpath containment
- no absolute paths
- no `..` traversal
- maximum response size of 200 KB
- text-only reads
- path checks for common sensitive files
- content checks for private key blocks, Authorization headers, API key-like tokens, and secret-like assignments

These checks are lightweight safeguards, not enterprise DLP. Do not expose a project containing data you would not allow ChatGPT to inspect.

## Write boundary

The legacy bridge tools and GPT Actions fallback only write bridge-owned files:

```text
.chatgpt-native/outbox/
.chatgpt-native/inbox/
.chatgpt-native/agent/runs/
.chatgpt-native/runs/mcp-audit.jsonl
```

The workspace tools can write or edit source files inside the connected project. `write` blocks existing-file overwrite by default unless the caller provides an expected file hash or explicit overwrite mode. `edit` requires the expected hash returned by `read`.

## Audit log

MCP tool calls append a compact audit event to:

```text
.chatgpt-native/runs/mcp-audit.jsonl
```

The audit log records tool name, bounded arguments, success/failure, and timestamp. It does not store full submitted Markdown replies; it records only their byte length.

Shell command history is stored separately at:

```text
.chatgpt-native/runs/command-history.jsonl
```

It stores command metadata, exit status, and truncated/redacted stdout/stderr previews for desktop display.

## Binding

The default HTTP server binds to:

```text
127.0.0.1:47832
```

Avoid binding to `0.0.0.0` unless you understand the network exposure and have an approved private tunnel or firewall rule.

## Tunnel exposure

Temporary tunnel URLs are bearer-like addresses. Anyone with the URL can reach the exposed MCP/Action endpoints while the tunnel is running. Keep the tunnel private, stop it when finished, and do not expose repositories containing data you would not allow ChatGPT to inspect.

## Why shell is explicit

The project exists to let ChatGPT work with a local project while keeping the boundary visible. Shell and source-file writes are exposed as named MCP workspace tools, not through hidden browser control or REST fallback endpoints. Codex still handles final review, tests, commit, and push.
