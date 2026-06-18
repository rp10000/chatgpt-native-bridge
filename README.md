# chatgpt-native-bridge

[![CI](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml)

English | [简体中文](README.zh-CN.md)

**ChatGPT Native Bridge is a desktop bridge between ChatGPT, Codex, and your local project.**

It gives ChatGPT a visible MCP workspace so it can inspect files, run commands, edit the connected project, show result cards in ChatGPT, and write the final answer back for Codex to continue locally.

![ChatGPT Native Bridge workflow](docs/assets/readme/hero-workflow.svg)

## Quick Start

Run this inside the project you want to work on:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

Then use the desktop client:

```text
Select project -> Connect ChatGPT -> Start work -> View results -> Hand to Codex
```

The desktop client is the beginner path. The CLI is still available for setup, diagnostics, automation, and advanced users.

## What You See

The client is not just a launcher. It shows whether ChatGPT really reached the bridge, which tools it called, what shell commands ran, what files changed, and what was written back to Codex.

![Desktop live status](docs/assets/readme/desktop-status.svg)

Status is based on local evidence:

- MCP request log
- MCP tool-call audit log
- command history
- git status and diff
- Codex inbox replies

## ChatGPT Web Cards

When your ChatGPT mode supports MCP Apps UI, bridge results appear as compact cards in the ChatGPT conversation.

![ChatGPT web cards](docs/assets/readme/chatgpt-cards.svg)

Cards are attached to the main workspace tools:

- open workspace
- run command
- write or edit file
- show changes
- write back to Codex

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
write_to_codex
```

The current project can be opened directly. Other projects must be allowed first:

```bash
cgn projects add D:\path\to\project
```

## Safety Boundary

![Safety boundary](docs/assets/readme/safety-boundary.svg)

The bridge is local-first and visible:

- No OpenAI API key required.
- No browser extension.
- No ChatGPT web scraping.
- No hidden ChatGPT endpoints.
- No automatic commit or push.
- Shell commands and file changes are shown in the desktop client.
- Codex still does the final local review, tests, commit, and push.

Treat the temporary MCP tunnel URL as a sensitive local capability URL.

## CLI

```bash
cgn start
cgn setup --mcp
cgn projects add .
cgn projects list
cgn auth rotate
cgn sessions list
cgn mcp connect --yes --open
cgn mcp trace
cgn mcp doctor
cgn doctor
```

## Pro Helper

ChatGPT Pro does not directly read your local project through this bridge unless it can call the MCP app in that chat.

Use the desktop client's Pro helper only for packaged-context planning:

```text
Client copies a project summary -> You paste it into Pro -> Client imports the marked reply
```

For real local file access, use the Thinking/MCP path.

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

`v1.0.0` includes:

- Desktop client
- MCP workspace tools
- shell and file-change audit visibility
- ChatGPT web cards
- Codex inbox write-back
- Markdown handoff fallback
