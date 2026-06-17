# Quickstart

Use the desktop client first. It hides the MCP and tunnel details from normal use.

## 1. Start the client

Run this in the project you want Codex and ChatGPT to review:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

The client has three main buttons:

- `连接 ChatGPT`
- `开始复核`
- `交给 Codex`

## 2. Main path: Thinking / MCP

1. Click `连接 ChatGPT`.
2. Create or refresh the ChatGPT tool with the copied connection address.
3. Click `开始复核`.
4. Paste the copied sentence into ChatGPT:

```text
请使用 chatgpt-native-bridge 复核当前项目，并把最终建议写回 Codex。
```

5. Wait for ChatGPT to use the tool and write back.
6. Click `交给 Codex`, then paste the copied sentence into Codex.

The copied Codex sentence is:

```text
读取最新 Bridge 回复，然后继续执行。
```

## 3. Pro helper path

Use `Pro 辅助规划` only when you want GPT-5.5 Pro to plan from a packaged context.

Important boundary:

```text
Pro cannot directly read your local project.
It only sees the context copied by the client.
```

Flow:

1. Open `Pro 辅助规划`.
2. Click `复制 Pro 上下文`.
3. Paste it into GPT-5.5 Pro.
4. Copy Pro's reply.
5. The client imports the matching reply into the Codex inbox.
6. Click `交给 Codex`.

## 4. First-time Codex setup

Install the Codex Skill and MCP config in the current project:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp
```

Restart Codex, or open a new Codex thread, if Codex asks you to reload tools.

## 5. Markdown fallback

If the desktop client or ChatGPT tools are not available, use the manual handoff:

```bash
cgn handoff --task "Review this project"
cgn done
```

Codex then reads:

```text
.chatgpt-native/inbox/{id}/reply.md
.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md
```
