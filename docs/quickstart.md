# Quickstart tutorial

This tutorial shows the full native handoff loop. It uses simple diagrams instead of private account screenshots.

## 1. Initialize the bridge

![Run cgn init](assets/quickstart/01-init.svg)

```bash
cgn init
```

This creates the Codex Skill and `.chatgpt-native` workspace.

## 2. Create a ChatGPT Project

![Paste Project instructions](assets/quickstart/02-project-instructions.svg)

Create a ChatGPT Project named `Codex Native Advisor`, then paste:

```text
.chatgpt-native/project-instructions.md
```

into the Project instructions.

## 3. Create a handoff pack

![Create handoff](assets/quickstart/03-create-handoff.svg)

```bash
cgn ask \
  --task "Review the new pricing page" \
  --type ux-review,naming-copy \
  --include-diff
```

The outbox contains the prompt, context, and optional attachments.

## 4. Open ChatGPT

![Open ChatGPT](assets/quickstart/04-open-chatgpt.svg)

```bash
cgn open latest
```

Paste the copied prompt into ChatGPT. Upload `context.md`, `diff.patch`, files, or screenshots if the task needs them.

## 5. Use ChatGPT native tools

![Use native tools](assets/quickstart/05-chatgpt-native-tools.svg)

Use the ChatGPT features that fit the task: file upload, image analysis, research, Canvas, or image generation.

## 6. Import the reply

![Import reply](assets/quickstart/06-import-reply.svg)

```bash
cgn import latest --from-clipboard
```

The answer is saved to:

```text
.chatgpt-native/inbox/<id>/reply.md
```

## 7. Codex continues locally

![Codex continues](assets/quickstart/07-codex-continues.svg)

Ask Codex to read `reply.md`, apply the useful parts, ignore or defer the rest, and run relevant checks.
