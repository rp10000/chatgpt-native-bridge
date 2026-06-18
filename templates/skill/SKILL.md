---
name: chatgpt-native-bridge
description: Use this when Codex should coordinate with the user's visible ChatGPT web app through the desktop client, MCP workspace, or Markdown fallback. Use for planning, requirements, architecture critique, naming/copy, product judgment, UI/UX review, visual direction, research, direct web-side project work, and final handoff report review.
---

# ChatGPT Native Bridge

Use this skill when the task benefits from ChatGPT web-native review or planning.

## Main idea

ChatGPT web is the main workspace when MCP tools are available.
ChatGPT can read, edit, write files, run commands, show cards, and create a handoff report for Codex review.
Codex remains the final reviewer for tests, commit, and push.
GPT-5.5 Pro is only a packaged-context helper; it cannot directly read local files through this bridge.
The desktop client is the beginner entry point and hides command details.

## Use cases

- long-context planning
- requirement clarification
- architecture critique
- naming, positioning, product copy
- UI/UX screenshot review
- complex research or second opinion
- image generation and visual direction
- direct ChatGPT web work on the current local project
- review of diffs, screenshots, test output, or final reports

## Workflow

1. Check for an existing handoff report first:
   - Run `cgn status` or inspect `.chatgpt-native/inbox`.
   - If `.chatgpt-native/reports/{id}/HANDOFF_REPORT.md` or `.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md` exists, read it before acting.
2. Prefer the desktop main path:
   - Ask the user to run `npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start` if the client is not open.
   - Main buttons are `选择项目`, `连接 ChatGPT`, and `生成交接报告`.
   - ChatGPT prompt: `请使用 chatgpt-native-bridge 打开当前连接项目。你可以直接读取、修改文件并运行必要检查。完成后请生成交接报告，说明改了什么、跑了什么、还需要 Codex 复核什么。`
3. Use Thinking/MCP for real project work:
   - ChatGPT should call bridge tools automatically.
   - Expected loop: `open_workspace`, read/search/edit/write/run commands as needed, call `show_changes`, then call `create_handoff_report`.
   - If MCP is missing in Codex, run `npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp`, then restart Codex or open a new thread.
4. Use Pro only as an auxiliary planning path:
   - Pro can only see the packaged context copied by the desktop client.
   - Pro must not be treated as having direct access to local files, terminals, git state, or MCP tools.
   - If context is insufficient, Pro should say the context is insufficient.
5. When desktop and MCP are unavailable, create a visible fallback handoff with `cgn handoff`.
6. Include only relevant context:
   - task
   - repo summary
   - relevant files
   - diff
   - test output
   - screenshots
   - specific questions
7. For fallback handoffs, `cgn handoff` opens ChatGPT and copies `01_PASTE_TO_CHATGPT.md`.
   - Use `--mode assist` for the default open-and-copy flow.
   - Use `--mode manual` when the user wants paths only.
   - Use `--mode auto` to also open the outbox folder. This does not paste, upload, submit, or scrape ChatGPT.
8. If using fallback, import the result with the desktop client, `cgn import {id}`, or `cgn done`.
9. Read `.chatgpt-native/reports/{id}/HANDOFF_REPORT.md` and `.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md`.
10. Review the actual diff, run relevant tests, then commit or push only after verification.
11. Summarize what was accepted, ignored, or deferred.

## Minimal safety

Do not include `.env`, private keys, session cookies, or authorization tokens.
Do not use hidden ChatGPT endpoints.
Do not scrape ChatGPT output from the web page.
Do not expose global filesystem access through this bridge.
