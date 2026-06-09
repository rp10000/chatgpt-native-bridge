# Basic planning handoff

This example shows the smallest useful bridge flow: Codex asks ChatGPT for planning and requirements feedback, then imports the answer and continues locally.

## Problem

You are about to implement a new onboarding flow, but the requirements are still fuzzy. Codex should not start editing until the plan is clearer.

## Why use ChatGPT web?

This is a planning and product-judgment task. ChatGPT can reason through goals, risks, and acceptance criteria in a visible Project session, while Codex keeps local execution.

## Command

```bash
cgn ask \
  --task "Plan the first MVP onboarding flow" \
  --type plan,requirements

cgn open latest
```

## Generated files

```text
.chatgpt-native/outbox/{id}/
  START_HERE.md
  01_PASTE_TO_CHATGPT.md
  02_UPLOAD_THESE_FILES.md
  03_AFTER_CHATGPT_REPLY.md
  ask.md
  context.md
```

See:

- [sample-ask.md](sample-ask.md) as an example paste prompt
- [sample-context.md](sample-context.md)

## In ChatGPT

1. Paste `01_PASTE_TO_CHATGPT.md`.
2. Upload files listed in `02_UPLOAD_THESE_FILES.md` if they contain useful repo context.
3. Ask ChatGPT to end with `Codex next actions`.

## Import

After ChatGPT replies:

```bash
cgn done
```

Sample reply:

- [sample-reply.md](sample-reply.md)

Codex follow-up:

- [codex-next-actions.md](codex-next-actions.md)
