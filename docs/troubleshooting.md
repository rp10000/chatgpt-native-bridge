# Troubleshooting

## `npx` command not found

Install Node.js and npm, then retry. The package requires Node 18 or newer.

## Package not published yet

This repo is public, but npm registry publication may happen later. Use the GitHub form:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge cgn setup --mcp
```

or clone locally:

```bash
git clone https://github.com/rp10000/chatgpt-native-bridge.git
cd chatgpt-native-bridge
npm link
cgn --help
```

## MCP server is not available in Codex

Install the Codex MCP config:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge cgn setup --mcp
```

Restart Codex, or open a new Codex thread, so the config reloads.

If you are using the manual HTTP fallback, start the local server:

```bash
cgn mcp serve --host 127.0.0.1 --port 47832
```

Then open:

```text
http://127.0.0.1:47832/health
```

It should return a small JSON health response.

## MCP port is already in use

Choose another port:

```bash
cgn mcp serve --host 127.0.0.1 --port 47833
cgn mcp config --port 47833
```

Use the matching `/mcp` endpoint in ChatGPT.

## ChatGPT cannot reach `127.0.0.1`

Some ChatGPT MCP connection paths cannot call your local loopback address directly. Use the official MCP connection flow available to your account or workspace, such as a Secure MCP Tunnel.

Do not solve this by scraping ChatGPT web sessions, extracting cookies, or using hidden endpoints.

## ChatGPT says no bridge tools are available

If ChatGPT says it cannot call `review_current_project`, `write_to_codex`, or `api_tool`, the app is selected but its tools were not exposed to that conversation.

Check these first:

```bash
cgn mcp wait --timeout 30
cgn mcp trace
```

If no tool call is observed:

1. In ChatGPT app settings, open the `chatgpt-native-bridge` draft and refresh tools.
2. If tools still do not appear, delete and recreate the draft app with the latest `https://.../mcp` Server URL.
3. Set Authentication to `No authentication`.
4. Start a new ChatGPT chat, choose Developer mode, select `chatgpt-native-bridge`, then ask it to use `write_to_codex`.

Use version `0.4.0` or newer. Older versions did not include complete ChatGPT app tool descriptors, top-level `securitySchemes`, request tracing, session `GET /mcp` SSE support, GPT Actions write-back fallback, the local MCP agent tools, and clear Pro/read-fetch diagnostics.

If the request log shows `openai-mcp` `initialize` and `tools/list`, but the tool-call log has no new `tools/call`, the server is reachable and ChatGPT scanned the app. The remaining issue is on the ChatGPT side: the app was not exposed to that chat, the chat mode does not support custom apps, or the account only exposes read/fetch MCP actions.

Full automatic write-back requires `write_to_codex`, which is a write action. OpenAI currently documents full MCP, including write/modify actions, as rolling out for ChatGPT Business, Enterprise, and Edu. Pro accounts may connect MCP apps with read/fetch permissions, but `write_to_codex` may not be exposed in chat.

On Pro, use the Markdown fallback:

```bash
cgn handoff --task "Review this project" --type diff-review
cgn done
```

or use the GPT Actions fallback:

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

This fallback uses ChatGPT's official GPT Actions/OpenAPI route instead of MCP write actions. GPT Actions are not available in Pro mode; use an action-capable Custom GPT model for this fallback. It writes only to `.chatgpt-native/inbox`.

You can also test from a workspace with full MCP support.

## I expected a shell tool

The MCP server intentionally does not expose arbitrary shell execution. ChatGPT advises through bounded MCP tools, then Codex executes locally.

Available MCP tools are listed by:

```bash
cgn mcp config
```

## `cgn open` does not open the browser

Run:

```bash
cgn open latest --dry-run
```

Then open `https://chatgpt.com` manually and paste `.chatgpt-native/outbox/{id}/01_PASTE_TO_CHATGPT.md`.

To print paths only:

```bash
cgn open latest --mode manual
```

To open both ChatGPT and the outbox folder:

```bash
cgn open latest --mode auto
```

## Clipboard copy failed

Open the outbox path printed by `cgn open`, then manually copy `01_PASTE_TO_CHATGPT.md`.

## I cannot see what to upload

Run:

```bash
cgn open latest --mode manual
```

Check the output sections:

```text
Paste prompt
Upload/select in ChatGPT
Outbox
```

## Latest handoff not found

Run:

```bash
cgn status
```

If there are no pending or ready items, create one:

```bash
cgn handoff --task "Review onboarding UX" --type plan,ux-review
```

## ChatGPT reply not imported

Copy the ChatGPT reply and run:

```bash
cgn done
```

or save it to a file:

```bash
cgn import latest ./reply.md
```

## Codex did not pick the skill

Ask explicitly:

```text
Use chatgpt-native-bridge for this task.
```

Also verify the Skill exists:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge cgn doctor
```

## Screenshots not included

Check the glob and path:

```bash
cgn handoff --task "Review UI" --type ux-review --include-screenshots "screenshots/*.png"
```

The CLI copies matching files into the outbox `screenshots/` folder.

## Secret guard blocked a file

The bridge blocks obvious sensitive paths and secret-like content. Remove the sensitive material, create a safe summary, or leave the file out of the handoff.
