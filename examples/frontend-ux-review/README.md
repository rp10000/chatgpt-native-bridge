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
.chatgpt-native/outbox/<id>/
  ask.md
  context.md
  files/
  screenshots/
```

See:

- [sample-ask.md](sample-ask.md)
- [sample-context.md](sample-context.md)
- [sample-reply.md](sample-reply.md)
- [codex-next-actions.md](codex-next-actions.md)

## In ChatGPT

1. Paste `ask.md`.
2. Upload `context.md`.
3. Upload screenshots from `screenshots/`.
4. Ask for `Must fix`, `Nice to have`, and `Codex next actions`.

## Codex follow-up

Codex should verify the suggestions against the design system, implement must-fix changes only, and take a fresh screenshot after editing.
