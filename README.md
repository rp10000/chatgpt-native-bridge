# chatgpt-native-bridge

[![CI](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml)

English | [简体中文](README.zh-CN.md)

ChatGPT Native Bridge is a local desktop bridge for Codex.

Codex edits files and runs tests locally. ChatGPT reviews, plans, and writes advice back through a bounded local bridge. GPT-5.5 Pro can still help with deeper planning, but only from the context the client packages for it.

![chatgpt-native-bridge usage preview](docs/assets/marketing/hero.svg)

## Main Path

Run this inside the project you want Codex to work on:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

The desktop client shows three main actions:

```text
Connect ChatGPT -> Start Review -> Hand to Codex
```

In the client:

1. Click `连接 ChatGPT`.
2. Create or refresh the ChatGPT tool when the connection is ready.
3. Click `开始复核` and paste the copied request into ChatGPT.
4. Wait for ChatGPT to write back.
5. Click `交给 Codex` and paste the copied sentence into Codex.

## Paths

Main path:

```text
ChatGPT Thinking/MCP reads the project -> writes back to Codex
```

Helper path:

```text
Pro 辅助规划 -> clipboard relay
```

Pro cannot directly read local files. It only sees the context copied by the desktop client.

## Fallback

Fallback path:

```bash
cgn handoff --task "Review this project"
cgn done
```

## First-Time Setup

For Codex MCP setup in a project:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp
```

Restart Codex if prompted.

## Useful Commands

```bash
cgn start
cgn desktop
cgn client
cgn setup --mcp
cgn mcp connect --yes --open
cgn mcp trace
cgn handoff
cgn done
cgn doctor
```

## Safety

- No OpenAI API key required.
- No browser plugin.
- No ChatGPT web scraping.
- No hidden ChatGPT endpoints.
- No arbitrary shell execution.
- No automatic commit or push.

## Desktop Development

```bash
npm install
npm run desktop:dev
npm run desktop:pack
```

The npm package keeps the CLI lightweight. Desktop installers are intended for GitHub Releases.

## Status

`v0.7.0` makes Thinking/MCP the main path for real local project review, and keeps GPT-5.5 Pro as packaged-context planning only.
