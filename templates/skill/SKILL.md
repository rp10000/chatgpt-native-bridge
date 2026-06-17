---
name: chatgpt-native-bridge
description: Use this when Codex should hand off high-level advisory work to the user's visible ChatGPT web app through the local GUI, MCP bridge, or Markdown fallback handoff. Use for planning, requirements, architecture critique, naming/copy, product judgment, UI/UX review, visual direction, research, and diff/report review.
---

# ChatGPT Native Bridge

Use this skill when the task benefits from ChatGPT web-native capabilities.

## Main idea

Codex remains the local executor.
The local GUI handles GPT-5.5 Pro clipboard relay.
ChatGPT web can also act as the native advisor through the local MCP bridge when available.
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

1. Start automatically:
   - Run `cgn status` or inspect `.chatgpt-native/inbox`.
   - If `.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md` exists, read it and `reply.md`, then continue local execution without asking the user for tool names.
2. Prefer the local GUI path for GPT-5.5 Pro planning:
   - Ask the user to run `npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start`.
   - The GUI creates a Pro prompt, watches for a matching marked reply, and imports it into the Codex inbox.
3. Use MCP when ChatGPT Thinking should read/write through tools:
   - Tell the user to ask ChatGPT naturally, such as: "Use chatgpt-native-bridge to review this project and send your final advice back to Codex."
   - ChatGPT should call MCP tools and `submit_reply_to_codex` automatically.
   - If the MCP server is not available in Codex, ask the user to run `npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp`, then restart Codex or open a new thread.
   - If the project was already initialized but MCP is missing, run `cgn mcp install`.
4. When GUI relay and MCP are unavailable, create a visible fallback handoff with `cgn handoff`.
5. Include only relevant context:
   - task
   - repo summary
   - relevant files
   - diff
   - test output
   - screenshots
   - specific questions
6. For fallback handoffs, `cgn handoff` opens ChatGPT and copies `01_PASTE_TO_CHATGPT.md`.
   - Use `--mode assist` for the default open-and-copy flow.
   - Use `--mode manual` when the user wants paths only.
   - Use `--mode auto` to also open the outbox folder. This does not paste, upload, submit, or scrape ChatGPT.
7. Keep user instructions simple:
   - GUI path: run `cgn start`, use Deep Pro Plan, then let the GUI import the marked Pro reply.
   - MCP path: ask ChatGPT naturally and let it submit the reply back to Codex.
   - Fallback path: paste `.chatgpt-native/outbox/{run_id}/01_PASTE_TO_CHATGPT.md` into ChatGPT.
   - Fallback path: upload/select files listed in `.chatgpt-native/outbox/{run_id}/02_UPLOAD_THESE_FILES.md`.
   - Fallback path: open `.chatgpt-native/outbox/{run_id}/START_HERE.md` if the user needs the full local checklist.
   - Fallback path: after ChatGPT replies, copy the final answer and run `cgn done`.
   - Fallback path: then Codex should read `.chatgpt-native/inbox/{run_id}/reply.md`.
8. Let the user use ChatGPT natively.
9. Import the result with the GUI relay, MCP `submit_reply_to_codex`, `cgn import {id}`, or `cgn done`.
10. Read `.chatgpt-native/inbox/{id}/reply.md` and `.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md`.
11. Continue local execution using Codex judgment.
12. Run relevant tests.
13. Summarize what was accepted, ignored, or deferred.

## Minimal safety

Do not include `.env`, private keys, session cookies, or authorization tokens.
Do not use hidden ChatGPT endpoints.
Do not scrape ChatGPT output from the web page.
Do not expose arbitrary shell execution through this bridge.
