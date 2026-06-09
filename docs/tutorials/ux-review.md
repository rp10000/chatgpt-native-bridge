# UX review tutorial

## Goal

Use ChatGPT image analysis and product judgment to review a page before Codex makes UI changes.

## Command

```bash
cgn ask \
  --task "Review the first-run onboarding screen" \
  --type ux-review,naming-copy \
  --include-screenshots "screenshots/*.png" \
  --include-files "src/components/*.tsx"
```

## Files generated

```text
.chatgpt-native/outbox/{id}/ask.md
.chatgpt-native/outbox/{id}/context.md
.chatgpt-native/outbox/{id}/files/
.chatgpt-native/outbox/{id}/screenshots/
```

## In ChatGPT

1. Paste `ask.md`.
2. Upload `context.md`.
3. Upload screenshots.
4. Ask ChatGPT to separate must-fix issues from nice-to-have polish.

## Example answer shape

```markdown
## Must fix
- The primary action is visually weaker than the secondary action.
- The empty-state copy does not explain what happens next.

## Nice to have
- Reduce card density on mobile.

## Codex next actions
- Increase primary button contrast.
- Rewrite the empty-state title and helper copy.
- Check mobile at 390px width.
```

## What Codex should do next

Codex should apply the must-fix items that match the repo and design system, then verify with screenshots or a browser check.
