# chatgpt-native-bridge

[![CI](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml)

English | [简体中文](README.zh-CN.md)

**Connect MCP once, then work directly in ChatGPT web on the current local project.**

ChatGPT Native Bridge gives ChatGPT a visible MCP workspace for one selected project. ChatGPT can read files, edit files, run commands, show result cards, and create a handoff report for Codex review.

![ChatGPT Native Bridge workflow](docs/assets/readme/hero-workflow.svg)

## Quick Start

Run this inside the project you want ChatGPT to work on:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

Use the desktop client:

```text
Select project -> Connect ChatGPT -> Work in ChatGPT web -> Generate handoff report
```

The desktop client is intentionally small. It only handles project selection, connection state, and local evidence. ChatGPT web is the main workspace.

## Main Flow

1. Select the local project in the desktop client.
2. Click `Connect ChatGPT`.
3. Refresh or select the `chatgpt-native-bridge` tool in ChatGPT.
4. Ask ChatGPT to inspect, edit, and test the current project.
5. Ask ChatGPT to create a handoff report.
6. Let Codex review the diff, run tests, commit, and push.

The copied ChatGPT prompt says:

```text
Use chatgpt-native-bridge to open the current connected project. You may read files, edit files, and run required checks. When finished, create a handoff report describing what changed, what ran, and what Codex should review.
```

## Desktop Client

The client shows a single project and one large status light:

![Desktop live status](docs/assets/readme/desktop-status.svg)

Status meanings:

- Gray: not connected.
- Blue: connected.
- Yellow: ChatGPT reached the tool list.
- Green: ChatGPT is operating on the current project.
- Purple: handoff report generated.
- Red: connection failed or project mismatch.

The main buttons are:

```text
Select project
Connect ChatGPT
Generate handoff report
```

Advanced details are still available behind collapsed panels: tool calls, shell commands, file changes, diagnostics, and fallback helpers.

## ChatGPT Web Cards

When your ChatGPT mode supports MCP Apps UI, tool results appear as compact cards in the ChatGPT conversation.

![ChatGPT web cards](docs/assets/readme/chatgpt-cards.svg)

Cards are attached to the main workspace actions:

- open workspace
- run command
- write or edit file
- show changes
- create handoff report

If cards are not supported by your current ChatGPT account or mode, the tools still return normal structured results.

## MCP Workspace

After the project is connected, ChatGPT can use MCP workspace tools:

```text
list_workspaces
open_workspace
list_directory
search_workspace
read_project_instructions
read
write
edit
bash
command_history
show_changes
create_handoff_report
write_to_codex
```

The current connection is project-scoped. ChatGPT cannot browse your whole computer by default.

`open_workspace` opens the current connected project. If ChatGPT asks for a different path, the bridge rejects it and tells you to switch projects in the desktop client.

## Handoff Report

`create_handoff_report` creates:

```text
.chatgpt-native/reports/{id}/HANDOFF_REPORT.md
.chatgpt-native/inbox/{id}/reply.md
.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md
```

The report includes:

- git status
- diff summary
- recent MCP tool calls
- recent shell commands
- changed files
- ChatGPT notes
- Codex review checklist

`write_to_codex` remains as a compatibility alias, but the preferred action is now `create_handoff_report`.

## Safety Boundary

![Safety boundary](docs/assets/readme/safety-boundary.svg)

The bridge is local-first and visible:

- No OpenAI API key required.
- No browser extension.
- No ChatGPT web scraping.
- No hidden ChatGPT endpoints.
- No global filesystem access by default.
- No automatic commit or push.
- Shell commands and file changes are visible in the desktop client.
- Codex still does the final local review, tests, commit, and push.

Treat the temporary MCP tunnel URL as a sensitive local capability URL.

## CLI

```bash
cgn start
cgn desktop
cgn projects add .
cgn projects list
cgn mcp connect --yes --open
cgn mcp trace
cgn mcp doctor
cgn doctor
```

Use CLI for setup, diagnostics, automation, and advanced workflows. Use the desktop client for normal work.

## Pro Helper

ChatGPT Pro is a fallback planning path when the current ChatGPT chat cannot call MCP tools.

The Pro helper only uses packaged context:

```text
Client copies project context -> You paste it into Pro -> Client imports the marked reply
```

For real local file access, use the MCP workspace path.

## Fallback

If MCP is unavailable:

```bash
cgn handoff --task "Review this project"
cgn done
```

This creates a visible Markdown handoff and imports the ChatGPT reply back into `.chatgpt-native/inbox`.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm test
npm run desktop:dev
npm run desktop:pack
```

The npm package keeps the CLI lightweight. Desktop installers are intended for GitHub Releases.

## Current Status

`v1.2` focuses on:

- Web-first MCP workflow
- current-project-only workspace access
- minimal desktop connector UI
- ChatGPT web cards
- local shell and file-change audit visibility
- handoff reports for Codex review
- Pro and Markdown fallbacks
