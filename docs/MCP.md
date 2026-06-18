# MCP setup

`chatgpt-native-bridge` uses MCP as the main path for ChatGPT modes that can use Apps/tools. The desktop client is the beginner entry point; this page documents the lower-level MCP commands.

The bridge runs a local MCP server that lets ChatGPT inspect bounded project context, search and list the workspace, read project instructions, read the current diff, use workspace read/write/edit/bash tools, and submit final Markdown advice back to Codex.

Codex still owns final review, tests, commit, and push. The REST Actions fallback does not expose shell or source-file write tools.

## One-command Codex install

From a project where you want ChatGPT/Codex to use this bridge:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp
```

This initializes the project files and writes a `chatgpt-native-bridge` MCP server block into the Codex config at `~/.codex/config.toml`.

If the project was already initialized, install only the Codex MCP block:

```bash
cgn mcp install
```

Restart Codex, or open a new Codex thread, so Codex reloads MCP config.

The installed MCP block uses `npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp serve --stdio --root <project>`, so users do not need to globally install `cgn`.

## Manual local server fallback

```bash
cgn mcp serve --host 127.0.0.1 --port 47832
```

The MCP endpoint is:

```text
http://127.0.0.1:47832/mcp
```

Health check:

```text
http://127.0.0.1:47832/health
```

Print a copyable config summary:

```bash
cgn mcp config
```

Check the local bridge setup:

```bash
cgn mcp doctor
```

## Connect ChatGPT

For the shortest ChatGPT web setup, run:

```bash
cgn mcp connect --yes --open
```

This starts the local server, installs `cloudflared` if needed, starts a temporary HTTPS tunnel, copies the `https://.../mcp` Server URL to your clipboard, and opens ChatGPT. On Windows it tries `winget` first; if `winget` fails, it downloads `cloudflared.exe` into `.chatgpt-native/bin/` for this project.

After selecting the app in ChatGPT, verify that ChatGPT really used it:

```bash
cgn mcp wait
cgn mcp trace
```

The ChatGPT UI can show the app as selected before any tool call happens. `cgn mcp wait` watches the local audit log and confirms whether a real MCP call arrived.

## ChatGPT web cards

When ChatGPT supports MCP Apps UI for the current chat, these tools render compact cards in the ChatGPT web conversation:

```text
open_workspace
bash
write
edit
show_changes
write_to_codex
submit_reply_to_codex
```

The cards summarize the project, command exit code, changed files, and Codex write-back id. They are display-only. They do not add browser automation, hidden ChatGPT calls, or extra local permissions.

If you do not see cards, the tools can still work. The most common causes are account/workspace rollout, Developer Mode support, stale app metadata, or a ChatGPT mode that can call tools but does not render MCP Apps UI. Refresh the app tools or recreate the app with the latest `https://.../mcp` URL, then test again.

## Connection reality

ChatGPT Developer Mode supports MCP read and write tools. If ChatGPT says bridge tools are unavailable, first check the connection, not the account tier:

1. The tunnel command is still running.
2. The ChatGPT app uses the exact latest `https://.../mcp` Server URL.
3. The app is selected in a Developer Mode chat.
4. The app metadata/tools were refreshed after code changes.

Cloudflare quick tunnel URLs are temporary. If you restart `cgn mcp connect`, update or recreate the ChatGPT app with the new Server URL. For a long-lived setup, prefer OpenAI Secure MCP Tunnel or another stable HTTPS endpoint.

If the app still does not expose tools, use the Markdown fallback while debugging:

```bash
cgn handoff --task "Review this project" --type diff-review
cgn done
```

You can also use the GPT Actions fallback:

```text
When cgn mcp connect prints:
  https://example.trycloudflare.com/mcp

Import this OpenAPI URL into a Custom GPT Action:
  https://example.trycloudflare.com/action/openapi.json

If ChatGPT shows "Something went wrong", paste the schema JSON manually from:
  .chatgpt-native/actions/openapi.json

Then tell the Custom GPT:
  First call review_current_project.
  Read relevant files only if needed.
  Finally call write_to_codex with your final Markdown advice for Codex.
```

This fallback uses ChatGPT's official GPT Actions/OpenAPI route instead of MCP write actions. It writes only to `.chatgpt-native/inbox`.

If ChatGPT says `review_current_project` or `write_to_codex` is unavailable, refresh the app tools in ChatGPT settings or recreate the draft app with the latest `https://.../mcp` URL and `No authentication`. Use `0.4.1` or newer.

Run `cgn mcp trace` to see whether ChatGPT reached `/mcp`, listed tools, or actually called a tool.

In ChatGPT, use:

```text
Direct link:
  https://chatgpt.com/#settings/Connectors

If the direct link only opens ChatGPT:
  Settings -> Apps & Connectors -> Create

If there is no Create button:
  Settings -> Apps & Connectors -> Advanced settings -> turn on Developer Mode

Fields:
  Name: chatgpt-native-bridge
  Description: Local Codex bridge. Automatically inspect bounded project context and diffs when useful, then submit final ChatGPT advice back to Codex.
  Connection: Server URL
  Server URL: paste the copied https://.../mcp URL
  Authentication: No authentication
  Final step: click Create
```

Use the official ChatGPT MCP/App connection flow available to your account or workspace. The local CLI does not auto-create the ChatGPT app because that would require browser automation or hidden ChatGPT web calls.

For a quick temporary HTTPS URL, keep the local server running and start:

```bash
cgn mcp tunnel
```

Paste the printed `https://.../mcp` URL into ChatGPT as the Server URL.

After the connector is created, users should not name individual tools. In ChatGPT, use:

```text
Use chatgpt-native-bridge to review this project.
Check the current project state and diff, read relevant files if needed,
then send your final advice back to Codex.
```

ChatGPT should call the bridge tools automatically and use `submit_reply_to_codex` before it finishes. Then return to Codex and say:

```text
Read the latest ChatGPT reply and continue.
```

If ChatGPT does not call the connector, send:

```text
Use chatgpt-native-bridge now.
First call review_current_project.
Read relevant files only if needed.
Then call submit_reply_to_codex with your final advice for Codex.
```

Official OpenAI references:

- [Apps SDK](https://developers.openai.com/apps-sdk)
- [Build MCP servers for ChatGPT and API clients](https://developers.openai.com/api/docs/mcp)
- [Secure MCP tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)

Do not use hidden ChatGPT endpoints, browser scraping, localStorage extraction, cookie extraction, or reverse-engineered web calls.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `review_current_project` | One-call project review entry: status, git state, safe diff, and next write-back step. |
| `bridge_status` | Read local bridge, git, handoff, and reply status. |
| `create_handoff` | Create a self-explaining handoff pack for a task. |
| `list_handoff_files` | List generated handoff files and upload candidates. |
| `read_handoff_file` | Read a bounded text file from a handoff outbox. |
| `read_repo_file` | Read a bounded non-sensitive text file from the project. |
| `read_git_diff` | Read the current git diff with secret-content guarding. |
| `agent_start_task` | Start a bounded local MCP agent run and write its result to the Codex inbox. |
| `agent_status` | Read local agent run status. |
| `agent_read_log` | Read a bounded local agent log. |
| `agent_read_result` | Read the local agent result Markdown. |
| `agent_stop` | Cancel a running local agent task. |
| `submit_reply_to_codex` | Save ChatGPT's final Markdown advice into the local inbox. |
| `write_to_codex` | Alias for `submit_reply_to_codex` when ChatGPT looks for a write-back action. |
| `list_workspaces` | List allowed project roots and the runtime project. |
| `open_workspace` | Open the current project or an allowed project workspace. |
| `workspace_status` | Return the open workspace state. |
| `list_directory` | List files and folders in the open workspace. |
| `search_workspace` | Search safe text files in the open workspace. |
| `read_project_instructions` | Read `AGENTS.md`, `CLAUDE.md`, and `README.md` when available. |
| `read` | Read a bounded text file inside the open workspace. |
| `write` | Create or overwrite a text file inside the open workspace. |
| `edit` | Apply hash-checked text edits inside the open workspace. |
| `bash` | Run a shell command inside the open workspace. |
| `command_history` | Read recent shell commands and truncated output previews. |
| `show_changes` | Return git status, diff summary, recent operations, and command history. |

## Expected loop

```text
1. Run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp once per project.
2. Restart Codex, or open a new Codex thread, so MCP config reloads.
3. Ask ChatGPT/Codex to inspect the project through the bridge MCP tools.
4. Optionally run `cgn mcp wait` to confirm ChatGPT really called the connector.
5. ChatGPT calls `review_current_project`, or starts the local agent with `agent_start_task`.
6. ChatGPT calls `submit_reply_to_codex` with final advice, or Codex reads the local agent inbox result.
7. Codex reads .chatgpt-native/inbox/{id}/CODEX_READ_THIS.md and reply.md.
8. Codex continues local implementation and runs tests.
```

## Stdio mode

For local MCP clients that spawn servers directly:

```bash
cgn mcp serve --stdio
```

`cgn mcp config` prints a JSON snippet for stdio-style MCP clients.

## Fallback

If MCP is not available, use the visible Markdown fallback:

```bash
cgn handoff --task "Review pricing page" --type ux-review --include-diff
cgn done
```

That fallback remains supported. It is also useful for accounts or environments where ChatGPT MCP access is not enabled yet.
