# MCP setup

`chatgpt-native-bridge` is MCP-first as of `v0.2.0`.

The bridge runs a local MCP server that lets ChatGPT inspect bounded project context, create handoff files, read the current diff, and submit final Markdown advice back to Codex.

Codex still executes locally. ChatGPT does not get arbitrary shell access.

## Start the local server

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

Use the official ChatGPT MCP/App connection flow available to your account or workspace. If ChatGPT cannot directly reach a local `127.0.0.1` server, use an official Secure MCP Tunnel or another approved private MCP route.

Official OpenAI references:

- [Apps SDK](https://developers.openai.com/apps-sdk)
- [Build MCP servers for ChatGPT and API clients](https://developers.openai.com/api/docs/mcp)
- [Secure MCP tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)

Do not use hidden ChatGPT endpoints, browser scraping, localStorage extraction, cookie extraction, or reverse-engineered web calls.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `bridge_status` | Read local bridge, git, handoff, and reply status. |
| `create_handoff` | Create a self-explaining handoff pack for a task. |
| `list_handoff_files` | List generated handoff files and upload candidates. |
| `read_handoff_file` | Read a bounded text file from a handoff outbox. |
| `read_repo_file` | Read a bounded non-sensitive text file from the project. |
| `read_git_diff` | Read the current git diff with secret-content guarding. |
| `submit_reply_to_codex` | Save ChatGPT's final Markdown advice into the local inbox. |

## Expected loop

```text
1. Run cgn mcp serve locally.
2. Connect ChatGPT to the MCP endpoint or tunnel.
3. Ask ChatGPT to inspect the project through the MCP tools.
4. ChatGPT calls create_handoff or reads bounded files as needed.
5. ChatGPT calls submit_reply_to_codex with final advice.
6. Codex reads .chatgpt-native/inbox/{id}/CODEX_READ_THIS.md and reply.md.
7. Codex continues local implementation and runs tests.
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
