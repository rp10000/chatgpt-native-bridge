# Frontend UX review

This example shows how to send screenshots and component context to ChatGPT for UI critique before Codex changes the frontend.

## Problem

The first-run screen works, but the hierarchy and copy may be weak. Codex needs a second pass focused on UX and naming.

## Why use ChatGPT web?

The visible ChatGPT session can analyze screenshots, compare visual hierarchy, critique copy, and suggest practical UI changes. Codex then implements locally.

## Command

```bash
cgn ask \
  --task "Review the first-run onboarding screen" \
  --type ux-review,naming-copy \
  --include-screenshots "screenshots/*.png" \
  --include-files "src/components/*.tsx"

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
  files/
  screenshots/
```

See:

- [sample-ask.md](sample-ask.md) as an example paste prompt
- [sample-context.md](sample-context.md)
- [sample-reply.md](sample-reply.md)
- [codex-next-actions.md](codex-next-actions.md)

## In ChatGPT

1. Paste `01_PASTE_TO_CHATGPT.md`.
2. Open `02_UPLOAD_THESE_FILES.md`.
3. Upload `context.md` and screenshots from `screenshots/` when relevant.
4. Ask for `Must fix`, `Nice to have`, and `Codex next actions`.

## Codex follow-up

Codex should verify the suggestions against the design system, implement must-fix changes only, and take a fresh screenshot after editing.
