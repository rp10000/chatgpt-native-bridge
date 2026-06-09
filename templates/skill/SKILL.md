---
name: chatgpt-native-bridge
description: Use this when Codex should hand off high-level advisory work to the user's visible ChatGPT web app using native ChatGPT tools such as reasoning models, Canvas, Web Search, Deep Research, file upload, image analysis, image generation, and data analysis. Use for planning, requirements, architecture critique, naming/copy, product judgment, UI/UX review, visual direction, research, and diff/report review.
---

# ChatGPT Native Bridge

Use this skill when the task benefits from ChatGPT web-native capabilities.

## Main idea

Codex remains the local executor.
ChatGPT web is the native advisor.
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

1. Create a native handoff pack with `cgn ask`.
2. Include only relevant context:
   - task
   - repo summary
   - relevant files
   - diff
   - test output
   - screenshots
   - specific questions
3. Run `cgn open {id}` to open ChatGPT and copy the prompt.
   - Use `--mode assist` for the default open-and-copy flow.
   - Use `--mode manual` when the user wants paths only.
   - Use `--mode auto` to also open the outbox folder. This does not paste, upload, submit, or scrape ChatGPT.
4. Tell the user exactly what the CLI printed:
   - `Paste prompt`
   - `Upload/select in ChatGPT`
   - `Outbox`
5. Let the user use ChatGPT natively.
6. Import the result with `cgn import {id}` or `cgn done`.
7. Read `.chatgpt-native/inbox/{id}/reply.md`.
8. Continue local execution using Codex judgment.
9. Run relevant tests.
10. Summarize what was accepted, ignored, or deferred.

## Minimal safety

Do not include `.env`, private keys, session cookies, or authorization tokens.
Do not use hidden ChatGPT endpoints.
Do not scrape ChatGPT output from the web page.
