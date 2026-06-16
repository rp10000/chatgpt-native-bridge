# MCP security boundary

`chatgpt-native-bridge` exposes a local MCP server for ChatGPT. It is designed as a bounded context bridge, not a remote-control agent.

## What MCP can do

- Read bridge status.
- Create handoff files under `.chatgpt-native/outbox`.
- List and read bounded handoff text files.
- Read bounded non-sensitive repo text files.
- Read the current git diff after secret-content checks.
- Write ChatGPT's final Markdown reply under `.chatgpt-native/inbox`.

## What MCP cannot do

- Run shell commands.
- Edit arbitrary repo files.
- Commit or push.
- Read `.env` or `.env.*`.
- Read private key files such as `*.pem`, `*.key`, `*.p12`, or `*.pfx`.
- Read SSH private keys.
- Read cookie or session files.
- Read `.git`.
- Read `node_modules` through `read_repo_file`.
- Use hidden ChatGPT endpoints.
- Scrape ChatGPT output from the browser.

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

The MCP server only writes bridge-owned files:

```text
.chatgpt-native/outbox/
.chatgpt-native/inbox/
.chatgpt-native/runs/mcp-audit.jsonl
```

It does not write source files. Codex remains the local executor.

## Audit log

MCP tool calls append a compact audit event to:

```text
.chatgpt-native/runs/mcp-audit.jsonl
```

The audit log records tool name, bounded arguments, success/failure, and timestamp. It does not store full submitted Markdown replies; it records only their byte length.

## Binding

The default HTTP server binds to:

```text
127.0.0.1:47832
```

Avoid binding to `0.0.0.0` unless you understand the network exposure and have an approved private tunnel or firewall rule.

## Why no shell tool

The project exists to let ChatGPT plan, review, research, and advise while Codex executes locally. A shell tool would collapse that boundary and turn the bridge into a remote-control agent. That is intentionally out of scope for `v0.2.0`.
