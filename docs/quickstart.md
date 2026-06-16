# Quickstart tutorial

This tutorial shows the MCP-first loop, then the Markdown fallback loop. It uses simple diagrams instead of private account screenshots.

## 1. Initialize and install the Codex MCP bridge

![Run cgn setup --mcp](assets/quickstart/01-init.svg)

```bash
npx github:rp10000/chatgpt-native-bridge setup --mcp
```

This creates the Codex Skill, the `.chatgpt-native` workspace, and the Codex MCP config block. Restart Codex, or open a new Codex thread, after this step.

If `cgn` is not installed globally, run later commands as `npx github:rp10000/chatgpt-native-bridge <command>`.

## 2. Create a ChatGPT Project

![Paste Project instructions](assets/quickstart/02-project-instructions.svg)

Create a ChatGPT Project named `Codex Native Advisor`, then paste:

```text
.chatgpt-native/project-instructions.md
```

into the Project instructions.

## 3. Connect ChatGPT web

Run:

```bash
cgn mcp connect --yes --open
```

Create the ChatGPT connector with the printed fields.

Manual HTTP server fallback:

```bash
cgn mcp serve --host 127.0.0.1 --port 47832
```

## 4. Let ChatGPT inspect and reply through MCP

Ask ChatGPT naturally:

```text
Use chatgpt-native-bridge to review this project.
Check the current project state and diff, read relevant files if needed,
then send your final advice back to Codex.
```

ChatGPT should inspect the project and write its final advice back to:

```text
.chatgpt-native/inbox/{id}/reply.md
```

Codex can then read `CODEX_READ_THIS.md` and continue locally.

## 5. Fallback: create and open a handoff

![Create handoff](assets/quickstart/03-create-handoff.svg)

```bash
cgn handoff \
  --task "Review the new pricing page" \
  --type ux-review,naming-copy \
  --include-diff
```

The outbox contains self-explaining handoff files, context, and optional attachments.

## 6. Work in ChatGPT manually

![Open ChatGPT](assets/quickstart/04-open-chatgpt.svg)

Paste the copied `01_PASTE_TO_CHATGPT.md` prompt into ChatGPT. Upload files listed in `02_UPLOAD_THESE_FILES.md` only if the task needs them. Open `START_HERE.md` if you want the full local checklist.

## 7. Use ChatGPT native tools

![Use native tools](assets/quickstart/05-chatgpt-native-tools.svg)

Use the ChatGPT features that fit the task: file upload, image analysis, research, Canvas, or image generation.

## 8. Import the reply manually

![Import reply](assets/quickstart/06-import-reply.svg)

```bash
cgn done
```

The answer is saved to:

```text
.chatgpt-native/inbox/{id}/reply.md
```

## 9. Codex continues locally

![Codex continues](assets/quickstart/07-codex-continues.svg)

Ask Codex to read `reply.md`, apply the useful parts, ignore or defer the rest, and run relevant checks.
