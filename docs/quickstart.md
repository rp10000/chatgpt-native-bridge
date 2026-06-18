# Quickstart

Start with the desktop client. It hides MCP, tunnel, and path details from normal use.

## 1. Start the client

Run this in the project you want Codex and ChatGPT to work on:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

The client flow is:

```text
Select project -> Connect ChatGPT -> Work in ChatGPT web -> Create handoff report
```

## 2. Main path: Thinking / MCP

1. Click `Connect ChatGPT`.
2. Create or refresh the ChatGPT tool with the copied connection address.
3. In ChatGPT, send: `Use chatgpt-native-bridge to open the current connected project.`
4. Describe the task you want ChatGPT to handle.
5. Let ChatGPT read, edit, write, run useful checks, and call `show_changes`.
6. Ask ChatGPT to call `create_handoff_report`, or click `Generate handoff report` in the client.
7. Ask Codex to review the generated report and actual diff.

The Codex review sentence is:

```text
读取最新 Bridge 交接报告，检查真实 diff，然后复核、测试、提交和总结。
```

## 3. Pro helper path

Use `Pro helper` only when you want GPT-5.5 Pro to plan from a packaged context.

Important boundary:

```text
Pro cannot directly read your local project.
It only sees the context copied by the client.
```

## 4. Project boundary

ChatGPT can only work in the current project selected by the client. To work on another project, switch it in the client and reconnect.

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
