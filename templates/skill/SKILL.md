---
name: chatgpt-native-bridge
description: Use this when Codex should hand off high-level advisory work to the user's visible ChatGPT web app through the desktop client, MCP bridge, or Markdown fallback handoff. Use for planning, requirements, architecture critique, naming/copy, product judgment, UI/UX review, visual direction, research, and diff/report review.
---

# ChatGPT Native Bridge

Use this skill when the task benefits from ChatGPT web-native review or planning.

## Main idea

Codex remains the local executor.
ChatGPT Thinking/MCP is the main path for reading the local project and writing advice back to Codex.
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
- review of Codex diffs, screenshots, test output, or final reports

## Workflow

1. Check for existing write-back first:
   - Run `cgn status` or inspect `.chatgpt-native/inbox`.
   - If `.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md` exists, read it and `reply.md`, then continue local execution.
2. Prefer the desktop main path:
   - Ask the user to run `npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start` if the client is not open.
   - Main buttons are `连接 ChatGPT`, `开始复核`, and `交给 Codex`.
   - ChatGPT prompt: `请使用 chatgpt-native-bridge 复核当前项目，并把最终建议写回 Codex。`
3. Use Thinking/MCP for real project review:
   - ChatGPT should call bridge tools automatically.
   - Expected loop: inspect project status, read diff/files as needed, then write final advice with `submit_reply_to_codex` or `write_to_codex`.
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
8. Import the result with the desktop client, MCP write-back, `cgn import {id}`, or `cgn done`.
9. Read `.chatgpt-native/inbox/{id}/reply.md` and `.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md`.
10. Continue local execution using Codex judgment.
11. Run relevant tests.
12. Summarize what was accepted, ignored, or deferred.

## Minimal safety

Do not include `.env`, private keys, session cookies, or authorization tokens.
Do not use hidden ChatGPT endpoints.
Do not scrape ChatGPT output from the web page.
Do not expose arbitrary shell execution through this bridge.
