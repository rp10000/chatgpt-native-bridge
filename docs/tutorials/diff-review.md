# Diff review tutorial

## Goal

Use ChatGPT as a second-pass reviewer after Codex has implemented local changes.

## Command

```bash
cgn ask \
  --task "Review Codex's current implementation before commit" \
  --type diff-review \
  --include-diff \
  --include-tests
```

## Files generated

```text
.chatgpt-native/outbox/<id>/ask.md
.chatgpt-native/outbox/<id>/context.md
.chatgpt-native/outbox/<id>/diff.patch
.chatgpt-native/outbox/<id>/test-output.md
```

## In ChatGPT

1. Paste `ask.md`.
2. Upload `context.md`, `diff.patch`, and `test-output.md`.
3. Ask ChatGPT to separate must-fix from nice-to-have.

## Example answer shape

```markdown
## Must fix
- The CLI help mentions a command that is not documented in README.

## Nice to have
- Add a troubleshooting note for clipboard failures.

## Codex next actions
- Update README command list.
- Add a focused test for the help output.
```

## What Codex should do next

Codex should verify each must-fix item against the codebase before implementing it, then rerun tests and package checks.
