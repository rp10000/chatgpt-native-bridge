---
name: chatgpt-native-bridge
description: Use this when Codex should hand off high-level advisory work to the user's visible ChatGPT web app through the local MCP bridge or the Markdown fallback handoff. Use for planning, requirements, architecture critique, naming/copy, product judgment, UI/UX review, visual direction, research, and diff/report review.
---

# ChatGPT Native Bridge

Use this skill when the task benefits from ChatGPT web-native capabilities.

## Main idea

Codex remains the local executor.
ChatGPT web is the native advisor through the local MCP bridge when available.
The user controls the visible ChatGPT session.

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

1. Prefer the MCP-first path:
   - If `.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md` exists, read it and `reply.md`, then continue local execution.
   - If ChatGPT should inspect the project directly, ask the user to run `cgn mcp serve` or run it when appropriate for the local session.
   - Use `cgn mcp config` to show the user the endpoint and available tools.
2. When MCP is unavailable, create a visible fallback handoff with `cgn handoff`.
3. Include only relevant context:
   - task
   - repo summary
   - relevant files
   - diff
   - test output
   - screenshots
   - specific questions
4. For fallback handoffs, `cgn handoff` opens ChatGPT and copies `01_PASTE_TO_CHATGPT.md`.
   - Use `--mode assist` for the default open-and-copy flow.
   - Use `--mode manual` when the user wants paths only.
   - Use `--mode auto` to also open the outbox folder. This does not paste, upload, submit, or scrape ChatGPT.
5. Always tell the user exactly what to do:
   - MCP path: connect ChatGPT to the endpoint printed by `cgn mcp config`, then let ChatGPT call the bridge tools and submit a reply.
   - Fallback path: paste `.chatgpt-native/outbox/{run_id}/01_PASTE_TO_CHATGPT.md` into ChatGPT.
   - Fallback path: upload/select files listed in `.chatgpt-native/outbox/{run_id}/02_UPLOAD_THESE_FILES.md`.
   - Fallback path: open `.chatgpt-native/outbox/{run_id}/START_HERE.md` if the user needs the full local checklist.
   - Fallback path: after ChatGPT replies, copy the final answer and run `cgn done`.
   - Fallback path: then Codex should read `.chatgpt-native/inbox/{run_id}/reply.md`.
6. Let the user use ChatGPT natively.
7. Import the result with MCP `submit_reply_to_codex`, `cgn import {id}`, or `cgn done`.
8. Read `.chatgpt-native/inbox/{id}/reply.md` and `.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md`.
9. Continue local execution using Codex judgment.
10. Run relevant tests.
11. Summarize what was accepted, ignored, or deferred.

## Minimal safety

Do not include `.env`, private keys, session cookies, or authorization tokens.
Do not use hidden ChatGPT endpoints.
Do not scrape ChatGPT output from the web page.
Do not expose arbitrary shell execution through this bridge.
