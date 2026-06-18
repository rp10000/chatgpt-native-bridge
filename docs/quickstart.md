# Quickstart

Start with the desktop client. It hides MCP, tunnel, and path details from normal use.

## 1. Start the client

Run this in the project you want Codex and ChatGPT to work on:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

The client flow is:

```text
Select project -> Connect ChatGPT -> Start work -> View results -> Hand to Codex
```

## 2. Main path: Thinking / MCP

1. Click `Connect ChatGPT`.
2. Create or refresh the ChatGPT tool with the copied connection address.
3. Click `Start work`.
4. Paste the copied sentence into ChatGPT.
5. Wait for ChatGPT to use the tool and write back.
6. Click `View results` to inspect command output, file changes, and the latest reply.
7. Click `Hand to Codex`, then paste the copied sentence into Codex.

The copied Codex sentence is:

```text
读取最新 Bridge 回复，检查变更摘要，然后继续执行、测试和总结。
```

## 3. Pro helper path

Use `Pro helper` only when you want GPT-5.5 Pro to plan from a packaged context.

Important boundary:

```text
Pro cannot directly read your local project.
It only sees the context copied by the client.
```

## 4. Project allow-list

The current project can be opened by the running bridge. To let ChatGPT switch to another project, add it first:

```bash
cgn projects add D:\path\to\project
```

## 5. First-time Codex setup

Install the Codex Skill and MCP config in the current project:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp
```

Restart Codex, or open a new Codex thread, if Codex asks you to reload tools.

## 6. Markdown fallback

If the desktop client or ChatGPT tools are not available, use the manual handoff:

```bash
cgn handoff --task "Review this project"
cgn done
```
