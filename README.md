# chatgpt-native-bridge

[![CI](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml)

English | [简体中文](README.zh-CN.md)

ChatGPT Native Bridge is a local desktop bridge for Codex.

Codex edits files and runs tests locally. ChatGPT does planning, review, UX judgment, research, and visual direction. The bridge moves context and replies between them without an API key, hidden endpoints, browser scraping, or arbitrary shell execution.

![chatgpt-native-bridge usage preview](docs/assets/marketing/hero.svg)

## Main Path: Desktop Client

Run this inside the project you want Codex to work on:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

`cgn start`, `cgn desktop`, and `cgn client` open the desktop client.

The client keeps the normal user flow to three buttons:

- `Pro 深度规划`
- `Thinking 工具复核`
- `写回 Codex`

## GPT-5.5 Pro Flow

Use this when you want Pro to plan or review but Pro cannot directly call ChatGPT Apps/MCP.

```text
1. Open the desktop client.
2. Click Pro 深度规划.
3. Paste the copied prompt into ChatGPT Pro.
4. Copy Pro's reply.
5. The client imports the matching reply into Codex inbox.
6. Click 写回 Codex, then paste the copied sentence into Codex.
```

The client only watches the clipboard after you click the button, only accepts the current relay id, and times out automatically.

## Thinking / MCP Flow

Use this when your ChatGPT mode can call tools through Developer Mode MCP.

```text
1. Open the desktop client.
2. Click Thinking 工具复核.
3. The client starts the local MCP server and tunnel.
4. Create or refresh the ChatGPT connector with the shown Server URL.
5. Ask Thinking to review the project and write back to Codex.
```

The MCP tool surface is bounded: read project status, read safe files/diffs, create handoffs, and submit replies to Codex inbox. It does not expose arbitrary shell, arbitrary file writes, commit, or push.

## Fallbacks

Local web GUI:

```bash
cgn app
```

Manual Markdown handoff:

```bash
cgn handoff --task "Review this project"
cgn done
```

MCP terminal setup:

```bash
cgn mcp connect --yes --open
cgn mcp trace
```

## Install Into Codex

For first-time setup in a project:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp
```

Then restart Codex if it asks you to.

In Codex, trigger the Skill with:

- `/skills` then choose `chatgpt-native-bridge`
- `$chatgpt-native-bridge`
- `Use chatgpt-native-bridge for this task`

## Desktop Development

```bash
npm install
npm run desktop:dev
npm run desktop:pack
```

The npm package keeps the CLI lightweight. Desktop installers are intended for GitHub Releases.

## Safety

- No OpenAI API key required.
- No hidden ChatGPT endpoints.
- No ChatGPT web scraping.
- No browser plugin.
- No arbitrary shell execution.
- No automatic commit or push.

## Useful Commands

```bash
cgn start
cgn desktop
cgn client
cgn app
cgn setup --mcp
cgn mcp connect --yes --open
cgn mcp trace
cgn handoff
cgn done
cgn doctor
```

## Status

`v0.6.2` keeps the Windows-first desktop client path and rejects placeholder-only Pro relay replies instead of importing them.
